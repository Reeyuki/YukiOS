import { WindowHelper } from "./utils/WindowHelper.js";
import { BaseApp } from "./core/BaseApp.js";
import { resolveGhUrl, resolveIconUrl } from "./shared/assetResolver.js";
import { audioMixer } from "./audioMixer.js";

const SHITTIFY_ICON = resolveIconUrl("/static/icons/shittify.webp");

const SHITTIFY_CDN_URL = "https://cdn.jsdelivr.net/gh/Reeyuki/shittifylol@master/shittify21.html";

const SHITTIFY_BRIDGE_SCRIPT = `
<script>
(function() {
  function post(data) {
    try { parent.postMessage({ __shittify: true, ...data }, '*'); } catch(e) {}
  }

  function readPlayerDOM(state) {
    var nameEl = document.querySelector('.player-song-name');
    var artistEl = document.querySelector('.player-artist-name');
    var imgEl = document.querySelector('.player-img');
    var track = nameEl ? nameEl.textContent.trim() : '';
    var artist = artistEl ? artistEl.textContent.trim() : '';
    var artwork = imgEl ? (imgEl.src || '') : '';
    post({ type: 'track', track: track, artist: artist, album: '', artwork: artwork, playbackState: state });
  }

  var _trackedAudios = new WeakSet();
  var _currentAudio = null;

  function attachToAudio(audio) {
    if (_trackedAudios.has(audio)) return;
    _trackedAudios.add(audio);
    _currentAudio = audio;
    audio.addEventListener('play', function() { setTimeout(function() { readPlayerDOM('playing'); }, 80); });
    audio.addEventListener('pause', function() { readPlayerDOM('paused'); });
    audio.addEventListener('ended', function() { readPlayerDOM('none'); });
  }

  var OrigAudio = window.Audio;
  window.Audio = function(src) {
    var a = src !== undefined ? new OrigAudio(src) : new OrigAudio();
    attachToAudio(a);
    return a;
  };
  window.Audio.prototype = OrigAudio.prototype;

  var obs = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var nodes = mutations[i].addedNodes;
      for (var j = 0; j < nodes.length; j++) {
        var node = nodes[j];
        if (node && node.classList && node.classList.contains('song-player')) {
          setTimeout(function() { readPlayerDOM(_currentAudio && !_currentAudio.paused ? 'playing' : 'paused'); }, 150);
        }
      }
    }
  });
  obs.observe(document.body || document.documentElement, { childList: true, subtree: true });

  window.addEventListener('message', function(e) {
    try {
      var d = e.data;
      if (!d || d.__shittify_cmd !== true) return;
      if (d.cmd === 'volume') {
        var v = Math.max(0, Math.min(1, Number(d.value) || 0));
        if (_currentAudio) _currentAudio.volume = v;
        return;
      }
      if (!_currentAudio) return;
      if (d.cmd === 'play') { try { _currentAudio.play(); } catch(ex) {} }
      else if (d.cmd === 'pause') { try { _currentAudio.pause(); } catch(ex) {} }
      else if (d.cmd === 'nexttrack') { var nb = document.querySelector('.player-next'); if (nb) nb.click(); }
      else if (d.cmd === 'previoustrack') { var bb = document.querySelector('.player-back'); if (bb) bb.click(); }
    } catch(e) {}
  });
})();
<\/script>`;

export class ShittifyApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this._msgListener = null;
    this._iframe = null;
    this._winId = "shittify-window";
  }

  async open() {
    const winId = this._winId;

    if (document.getElementById(winId)) {
      const win = document.getElementById(winId);
      if (win.style.display === "none") {
        this.restoreFromTray(winId);
      } else {
        this.wm.bringToFront(win);
      }
      return;
    }

    const resolvedUrl = resolveGhUrl(SHITTIFY_CDN_URL);

    const loadingContent = `
      <div class="window-content" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
        <span style="opacity:0.5;font-size:0.9em;"><i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>Loading Shittify...</span>
      </div>
    `;

    const win = this.windowHelper.createAndMountWindow(winId, "Shittify", loadingContent, "820px", "600px", {
      icon: SHITTIFY_ICON
    });

    this.registerTray(winId, SHITTIFY_ICON, "Shittify", { showInTray: true });

    audioMixer.registerWindow(
      winId,
      "Shittify",
      `<img src="${SHITTIFY_ICON}" style="width:14px;height:14px;border-radius:2px;object-fit:contain;vertical-align:middle;" />`
    );
    audioMixer.setChannelCommandHandler(winId, (cmd) => this.sendCommand(cmd));
    this._setupMessageBridge(winId);

    try {
      const res = await fetch(resolvedUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let html = await res.text();

      html = html.replace(
        /https?:\/\/(cdn\.jsdelivr\.net|quantil\.jsdelivr\.net|originfastly\.jsdelivr\.net|gcore\.jsdelivr\.net|esm\.sh|cdn\.statically\.io|cdn\.staticdelivr\.com)\/gh\/[^"'\s\)]+/gi,
        (match) => {
          let url = match;
          if (/\/shittifylol\//i.test(url) && !url.includes("@")) {
            url = url.replace(/\/shittifylol\//i, "/shittifylol@master/");
          }
          return resolveGhUrl(url);
        }
      );

      const injected = html.replace(/<\/head>/i, `${SHITTIFY_BRIDGE_SCRIPT}</head>`);
      const blobUrl = URL.createObjectURL(new Blob([injected], { type: "text/html" }));

      const content = win.querySelector(".window-content");
      if (content) {
        content.innerHTML = `<iframe id="shittify-iframe" src="${blobUrl}" style="width:100%;height:100%;border:none;" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock"></iframe>`;
        this._iframe = content.querySelector("iframe");
      }
    } catch (err) {
      const content = win.querySelector(".window-content");
      if (content) {
        content.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px;opacity:0.6;"><i class="fas fa-exclamation-circle" style="font-size:2em;"></i><span>Failed to load Shittify</span><span style="font-size:0.75em;opacity:0.6;">${err.message}</span></div>`;
      }
    }
  }

  _setupMessageBridge(winId) {
    if (this._msgListener) {
      window.removeEventListener("message", this._msgListener);
    }
    this._msgListener = (e) => {
      const d = e.data;
      if (!d || d.__shittify !== true || d.type !== "track") return;
      audioMixer.updateChannelMeta(winId, {
        track: d.track || "",
        artist: d.artist || "",
        album: d.album || "",
        artwork: d.artwork || "",
        playbackState: d.playbackState || "none"
      });
    };
    window.addEventListener("message", this._msgListener);
  }

  sendCommand(cmd) {
    if (this._iframe && this._iframe.contentWindow) {
      this._iframe.contentWindow.postMessage({ __shittify_cmd: true, cmd }, "*");
    }
  }

  onClose(winId) {
    if (this._msgListener) {
      window.removeEventListener("message", this._msgListener);
      this._msgListener = null;
    }
    this._iframe = null;
    audioMixer.unregisterWindow(winId);
    this.unregisterTray(winId);
  }

  loadContent() {
    this.open();
  }
}
