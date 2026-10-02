import { BaseApp, os } from "../framework.js";
import { getWispUrl } from "../shared/wispConfig.js";

const SOURCE = "https://youtube-liard-ten.vercel.app/";
const BLOCKED_MARKERS = [
  "blocked",
  "access denied",
  "content filter",
  "fortiguard",
  "lightspeed",
  "iboss",
  "securly",
  "goguardian",
  "block page",
  "web filter",
  "category blocked",
  "you are being filtered",
  "not allowed",
  "policy violation",
  "restricted",
  "filtering",
  "school filter",
  "network policy"
];
const REAL_MARKERS = ["infrared", "youtube", "invidious", "watch", "search", "playlist", "channel", "trending"];

function isBlockedHtml(html, title) {
  const low = (html || "").toLowerCase();
  const tlow = (title || "").toLowerCase();
  const hasBlocked = BLOCKED_MARKERS.some((m) => low.includes(m) || tlow.includes(m));
  const hasReal = REAL_MARKERS.some((m) => low.includes(m));
  if (hasBlocked && !hasReal) return true;
  if (low.length < 800 && hasBlocked) return true;
  if (low.length < 500 && !hasReal && (low.includes("forbidden") || low.includes("blocked"))) return true;
  return false;
}

function buildDetectionScript() {
  return `<script>
(function(){
  function isBlocked(){
    try{
      var html=(document.documentElement.innerHTML||"").toLowerCase();
      var title=(document.title||"").toLowerCase();
      var blocked=${JSON.stringify(BLOCKED_MARKERS)};
      var real=${JSON.stringify(REAL_MARKERS)};
      var hasBlocked=blocked.some(function(m){return html.indexOf(m)!==-1||title.indexOf(m)!==-1;});
      var hasReal=real.some(function(m){return html.indexOf(m)!==-1;});
      if(hasBlocked&&!hasReal) return true;
      if(html.length<800&&hasBlocked) return true;
      var bodyText=(document.body&&document.body.innerText)||"";
      if(bodyText.trim().length<200&&hasBlocked) return true;
      return false;
    }catch(e){return false;}
  }
  function notify(blocked){
    try{parent.postMessage({infraredCheck:true,blocked:blocked,href:location.href}, "*");}catch(e){}
  }
  function schedule(){
    var blocked=isBlocked();
    if(blocked) notify(true);
    else notify(false);
  }
  window.addEventListener("load", function(){ setTimeout(schedule, 1200); });
  setTimeout(function(){
    try{ if(document.readyState==="complete") schedule(); }catch(e){}
  }, 3000);
  setTimeout(function(){
    try{ if(isBlocked()) notify(true); }catch(e){}
  }, 5000);
})();
<\/script>`;
}

function buildDirectBlobHtml(rawHtml) {
  const baseHref = SOURCE;
  const detection = buildDetectionScript();
  const baseTag = '<base href="' + baseHref + '">';
  let html = rawHtml;
  if (/<base[^>]*>/i.test(html)) {
    html = html.replace(/<base[^>]*>/i, function (m) {
      return m + "\n" + baseTag + "\n" + detection;
    });
  } else if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, function (m) {
      return m + "\n" + baseTag + "\n" + detection;
    });
  } else {
    html = baseTag + "\n" + detection + "\n" + html;
  }
  return html;
}

export class InfaredYoutubeApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
    this.activeMode = new Map();
  }

  getSource() {
    return SOURCE;
  }

  getScramjetUrl() {
    const wispUrl = getWispUrl();
    const target = this.getSource();
    return (
      window.location.origin +
      "/sapps/set-template.html?wisp=" +
      encodeURIComponent(wispUrl) +
      "&target=" +
      encodeURIComponent(target)
    );
  }

  async open() {
    const winId = "infrared-youtube-win";
    const altWinId = "infared-youtube-win";
    if (await this.isSingletonOpen(winId)) return;
    if (await this.isSingletonOpen(altWinId)) return;
    if (this.openWindows.has(winId)) return;

    const win = os.window.create(winId, "Infared Youtube", "90vw", "85vh", {
      icon: "static/icons/youtube.webp",
      appId: "infaredYoutubeApp"
    });

    win.innerHTML =
      '<div class="infrared-root" style="width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--bg-primary)"><div class="infrared-loading" style="display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;height:100%;color:var(--text-secondary)"><div style="width:28px;height:28px;border:2px solid var(--glass-border);border-top-color:var(--brand);border-radius:50%;animation:spin 0.8s linear infinite"></div><div style="font-size:13px">Loading Infrared...</div><div class="infrared-status" style="font-size:11px;opacity:0.7"></div></div><iframe class="infrared-iframe" style="width:100%;height:100%;border:none;display:none" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"></iframe><div class="infrared-fallback-bar" style="display:none;align-items:center;gap:8px;padding:6px 10px;background:var(--glass);border-top:1px solid var(--glass-border);font-size:12px;color:var(--text-secondary)"><span>Blocked on this network, switched to proxy</span><button class="infrared-retry-direct" style="margin-left:auto;padding:4px 8px;border-radius:6px;border:1px solid var(--glass-border);background:var(--surface-1);color:var(--text-primary);cursor:pointer;font-size:11px">Try direct</button></div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';

    const iframe = win.querySelector(".infrared-iframe");
    const loading = win.querySelector(".infrared-loading");
    const statusEl = win.querySelector(".infrared-status");
    const fallbackBar = win.querySelector(".infrared-fallback-bar");
    const retryBtn = win.querySelector(".infrared-retry-direct");

    this.openWindows.add(winId);
    this.activeMode.set(winId, "direct");

    const showIframe = () => {
      if (loading) loading.style.display = "none";
      if (iframe) iframe.style.display = "block";
    };

    const showFallbackBar = () => {
      if (fallbackBar) fallbackBar.style.display = "flex";
    };

    const setStatus = (t) => {
      if (statusEl) statusEl.textContent = t;
    };

    let messageHandler = null;
    let fallbackTriggered = false;
    let blobUrl = null;
    let directBlobUrl = null;

    const cleanup = () => {
      if (messageHandler) window.removeEventListener("message", messageHandler);
      if (blobUrl && blobUrl.startsWith("blob:"))
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {}
      if (directBlobUrl && directBlobUrl.startsWith("blob:"))
        try {
          URL.revokeObjectURL(directBlobUrl);
        } catch {}
    };

    win.addEventListener("remove", () => {
      this.openWindows.delete(winId);
      this.activeMode.delete(winId);
      cleanup();
    });

    const loadViaScramjet = () => {
      if (fallbackTriggered && this.activeMode.get(winId) === "scramjet") return;
      fallbackTriggered = true;
      this.activeMode.set(winId, "scramjet");
      setStatus("Network filter detected, loading via proxy...");
      showFallbackBar();
      const scramjetUrl = this.getScramjetUrl();
      if (blobUrl && blobUrl.startsWith("blob:"))
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {}
      iframe.style.display = "block";
      if (loading) loading.style.display = "none";
      iframe.removeAttribute("srcdoc");
      iframe.src = scramjetUrl;
      showIframe();
      try {
        os.notify.send("Infared Youtube", "Direct load blocked, switched to proxy", { type: "info", duration: 3000 });
      } catch {}
    };

    const loadDirectBlob = (html) => {
      const built = buildDirectBlobHtml(html);
      directBlobUrl = URL.createObjectURL(new Blob([built], { type: "text/html" }));
      blobUrl = directBlobUrl;
      iframe.src = directBlobUrl;
      iframe.onload = () => {
        setTimeout(() => showIframe(), 300);
      };
      iframe.onerror = () => loadViaScramjet();
    };

    messageHandler = (e) => {
      const data = e.data;
      if (!data) return;
      if (data.infraredCheck) {
        if (data.blocked) {
          loadViaScramjet();
        } else {
          setTimeout(() => showIframe(), 200);
        }
      }
    };
    window.addEventListener("message", messageHandler);

    if (retryBtn) {
      retryBtn.addEventListener("click", async () => {
        fallbackTriggered = false;
        this.activeMode.set(winId, "direct");
        if (fallbackBar) fallbackBar.style.display = "none";
        if (loading) loading.style.display = "flex";
        if (iframe) iframe.style.display = "none";
        setStatus("Retrying direct...");
        iframe.removeAttribute("src");
        await attemptDirect();
      });
    }

    const attemptDirect = async () => {
      setStatus("Checking direct access...");
      let controller = null;
      let timeoutId = null;
      try {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 7000);
        const res = await fetch(SOURCE, { cache: "no-store", signal: controller.signal, redirect: "follow" });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const html = await res.text();
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : "";
        if (isBlockedHtml(html, title)) {
          loadViaScramjet();
          return;
        }
        const hasReal = REAL_MARKERS.some((m) => html.toLowerCase().includes(m));
        if (!hasReal && html.toLowerCase().includes("blocked")) {
          loadViaScramjet();
          return;
        }
        loadDirectBlob(html);
        setTimeout(() => {
          if (!fallbackTriggered && this.activeMode.get(winId) === "direct") {
            const cur = iframe.style.display;
            if (cur === "none") showIframe();
          }
        }, 4500);
        setTimeout(() => {
          if (!fallbackTriggered) {
            try {
              const doc = iframe.contentDocument;
              if (!doc || !doc.documentElement || doc.documentElement.innerHTML.length < 300) {
                const inner = doc && doc.documentElement ? doc.documentElement.innerHTML : "";
                if (isBlockedHtml(inner, doc ? doc.title : "")) loadViaScramjet();
              }
            } catch {}
          }
        }, 6000);
      } catch (err) {
        clearTimeout(timeoutId);
        const msg = String((err && err.message) || err);
        const isAbort = msg.toLowerCase().includes("abort") || (err && err.name === "AbortError");
        if (isAbort) {
          setStatus("Direct load timed out, switching to proxy...");
          loadViaScramjet();
          return;
        }
        const isCors = msg.toLowerCase().includes("cors") || msg.toLowerCase().includes("failed to fetch");
        if (isCors) {
          setStatus("Trying direct iframe...");
          iframe.removeAttribute("srcdoc");
          iframe.src = SOURCE;
          iframe.onload = () => {
            showIframe();
            setTimeout(() => {
              try {
                const doc = iframe.contentDocument;
                if (doc) {
                  const html = doc.documentElement ? doc.documentElement.innerHTML : "";
                  if (isBlockedHtml(html, doc.title)) loadViaScramjet();
                }
              } catch {
                setTimeout(() => {
                  if (!fallbackTriggered) showIframe();
                }, 2000);
              }
            }, 1800);
          };
          iframe.onerror = () => loadViaScramjet();
          setTimeout(() => {
            if (!fallbackTriggered && iframe.style.display === "none") showIframe();
          }, 3500);
          setTimeout(() => {
            if (!fallbackTriggered) {
              let maybeBlocked = false;
              try {
                const doc = iframe.contentDocument;
                if (doc) maybeBlocked = isBlockedHtml(doc.documentElement.innerHTML, doc.title);
              } catch {}
              if (maybeBlocked) loadViaScramjet();
            }
          }, 6000);
          return;
        }
        loadViaScramjet();
      }
    };

    await attemptDirect();

    setTimeout(() => {
      if (this.activeMode.get(winId) === "direct" && !fallbackTriggered) {
        try {
          if (iframe.style.display === "none") showIframe();
        } catch {}
      }
    }, 8000);
  }

  onClose(winId) {
    this.openWindows.delete(winId);
    this.activeMode.delete(winId);
  }
}
