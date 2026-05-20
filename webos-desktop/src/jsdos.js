import { Achievements } from "./achievements.js";
import { bus, BusEvents } from "./core/EventBus.js";
import { zipSync } from "fflate";
import { BaseApp } from "./core/BaseApp.js";
import { WindowHelper } from "./utils/WindowHelper.js";
import { CDN_BASES } from "./shared/assetResolver.js";
import { resolveIconUrl } from "./assetUrl.js";
import { PersistenceTypes } from "./runtime/AppSchema.js";

const GAMES_DIR = ["Games"];

export class JsDosApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this._explorerApp = services.explorerApp;
  }

  open(opts = {}) {
    if (this._isSingletonOpen("jsdos-win")) return;
    this._isDeclarative = true;
  }

  getDeclarativeSchema(opts) {
    const games = [
      { file: "dn3d.jsdos", name: "Duke Nukem 3D", icon: "fa-solid fa-crosshairs" },
      { file: "doom.jsdos", name: "DOOM", icon: "fa-solid fa-skull" },
      { file: "wolfenstein.jsdos", name: "Wolfenstein", icon: "fa-solid fa-skull" },
      { file: "jazz.jsdos", name: "Jazz Jackrabbit", icon: "fa-solid fa-drum" },
      { file: "raptor.jsdos", name: "Raptor", icon: "fa-solid fa-jet-fighter" },
      { file: "skyroads.jsdos", name: "SkyRoads", icon: "fa-solid fa-rocket" }
    ];

    const self = this;

    return {
      id: "jsdos-win",
      name: "JsDos Game Launcher",
      icon: resolveIconUrl("static/icons/jsdos.webp"),
      windows: [
        {
          id: "jsdos-win",
          title: "JsDos Game Launcher",
          size: ["600px", "560px"],
          icon: resolveIconUrl("static/icons/jsdos.webp"),
          ui: {
            type: "element",
            tag: "div",
            props: {
              className: "window-content",
              style: {
                width: "100%",
                height: "100%",
                background: "#1a1a2e",
                color: "#eee",
                fontFamily: "monospace",
                overflowY: "auto",
                overflowX: "hidden"
              }
            },
            children: [
              {
                type: "element",
                tag: "div",
                props: {
                  className: "jsdos-header"
                },
                children: [
                  {
                    type: "element",
                    tag: "i",
                    props: {
                      className: "fa-solid fa-gamepad jsdos-header-icon"
                    }
                  },
                  {
                    type: "element",
                    tag: "div",
                    props: {
                      className: "jsdos-header-text"
                    },
                    children: [
                      {
                        type: "element",
                        tag: "div",
                        props: {
                          className: "jsdos-header-title"
                        },
                        text: "JsDos Game Library"
                      },
                      {
                        type: "element",
                        tag: "div",
                        props: {
                          className: "jsdos-header-subtitle"
                        },
                        text: "Select a game to launch"
                      }
                    ]
                  }
                ]
              },
              {
                type: "element",
                tag: "div",
                props: {
                  style: {
                    padding: "16px 16px 8px",
                    fontSize: "11px",
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: "1px"
                  }
                },
                text: "My Games"
              },
              {
                type: "element",
                tag: "div",
                props: {
                  id: "jsdos-upload-zone",
                  style: {
                    margin: "0 16px 12px",
                    border: "2px dashed #444",
                    borderRadius: "8px",
                    padding: "18px",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "border-color .2s,background .2s",
                    background: "transparent"
                  }
                },
                children: [
                  {
                    type: "element",
                    tag: "i",
                    props: {
                      className: "fa-solid fa-upload",
                      style: {
                        fontSize: "20px",
                        color: "#7b5ea7",
                        marginBottom: "8px",
                        display: "block"
                      }
                    }
                  },
                  {
                    type: "element",
                    tag: "div",
                    props: {
                      style: {
                        fontSize: "13px",
                        color: "#bbb"
                      }
                    },
                    children: [
                      { text: "Drop a " },
                      {
                        type: "element",
                        tag: "strong",
                        props: {
                          style: { color: "#fff" }
                        },
                        text: ".jsdos"
                      },
                      { text: " or " },
                      {
                        type: "element",
                        tag: "strong",
                        props: {
                          style: { color: "#fff" }
                        },
                        text: ".exe"
                      },
                      { text: " file here" }
                    ]
                  },
                  {
                    type: "element",
                    tag: "div",
                    props: {
                      style: {
                        fontSize: "11px",
                        color: "#666",
                        marginTop: "4px"
                      }
                    },
                    text: "or click to browse"
                  },
                  {
                    type: "element",
                    tag: "input",
                    props: {
                      id: "jsdos-file-input",
                      type: "file",
                      accept: ".jsdos,.exe,.com,.bat",
                      style: { display: "none" }
                    }
                  }
                ],
                events: {
                  click: {
                    type: "custom:uploadClick",
                    stopPropagation: true
                  },
                  dragover: {
                    type: "custom:dragOver",
                    stopPropagation: false
                  },
                  dragleave: {
                    type: "custom:dragLeave",
                    stopPropagation: false
                  },
                  drop: {
                    type: "custom:dropFile",
                    stopPropagation: false
                  }
                }
              },
              {
                type: "element",
                tag: "div",
                props: {
                  id: "jsdos-user-games",
                  style: {
                    padding: "0 16px 16px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px"
                  }
                }
              },
              {
                type: "element",
                tag: "div",
                props: {
                  style: {
                    padding: "0 16px 8px",
                    fontSize: "11px",
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: "1px"
                  }
                },
                text: "Featured Games"
              },
              {
                type: "element",
                tag: "div",
                props: {
                  className: "jsdos-game-grid",
                  id: "jsdos-game-grid"
                },
                children: games.map((game) => ({
                  type: "element",
                  tag: "div",
                  props: {
                    className: "jsdos-game-card",
                    "data-game": game.file
                  },
                  events: {
                    click: {
                      type: "custom:launchGame",
                      stopPropagation: true
                    }
                  },
                  children: [
                    {
                      type: "element",
                      tag: "i",
                      props: {
                        className: `${game.icon} jsdos-game-icon`
                      }
                    },
                    {
                      type: "element",
                      tag: "div",
                      props: {
                        className: "jsdos-game-title"
                      },
                      text: game.name
                    }
                  ]
                }))
              }
            ]
          },
          events: {
            "#jsdos-file-input": {
              change: {
                type: "custom:fileChange",
                stopPropagation: false
              }
            }
          }
        }
      ],
      state: {
        initial: {
          userGames: []
        },
        persistence: PersistenceTypes.MEMORY
      },
      actions: {
        uploadClick: (payload, event, element, state) => {
          const input = document.getElementById("jsdos-file-input");
          if (input) input.click();
        },
        dragOver: (payload, event, element, state) => {
          event.preventDefault();
          element.style.borderColor = "#c77dff";
          element.style.background = "rgba(199,125,255,0.07)";
        },
        dragLeave: (payload, event, element, state) => {
          element.style.borderColor = "#444";
          element.style.background = "transparent";
        },
        dropFile: async (payload, event, element, state) => {
          event.preventDefault();
          element.style.borderColor = "#444";
          element.style.background = "transparent";
          const file = event.dataTransfer.files[0];
          if (file) await self._handleUploadedFile(file, element);
        },
        fileChange: async (payload, event, element, state) => {
          const file = element.files[0];
          if (file) await self._handleUploadedFile(file, document.getElementById("jsdos-upload-zone"));
          element.value = "";
        },
        launchGame: (payload, event, element, state) => {
          const gameFile = element.dataset.game;
          const gameName = element.querySelector(".jsdos-game-title").textContent;
          self.launchGame(gameFile, gameName);
        }
      },
      onMount: (winId, state) => {
        self._loadUserGames(document.getElementById(winId));
      }
    };
  }

  async _handleUploadedFile(file, zone) {
    const originalHTML = zone.innerHTML;

    zone.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size:20px;color:#c77dff;margin-bottom:8px;display:block;"></i><div style="font-size:13px;color:#bbb;">Saving <strong style="color:#fff;">${file.name}</strong>…</div>`;

    try {
      const blob = new Blob([await file.arrayBuffer()], { type: file.type || "application/octet-stream" });
      await this.fs.writeBinaryFile(GAMES_DIR, file.name, blob, "other", resolveIconUrl("static/icons/jsdos.webp"));
      this.wm.sendNotify(`Saved ${file.name} at Games/ directory. `);
      zone.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size:20px;color:#4caf50;margin-bottom:8px;display:block;"></i><div style="font-size:13px;color:#bbb;">Saved!</div>`;
      await this._loadUserGames(document.querySelector("#jsdos-win"));
      setTimeout(() => {
        zone.innerHTML = originalHTML;
      }, 1500);
    } catch (err) {
      zone.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size:20px;color:#ff6b6b;margin-bottom:8px;display:block;"></i><div style="font-size:13px;color:#ff6b6b;">${err.message}</div>`;
      setTimeout(() => {
        zone.innerHTML = originalHTML;
      }, 2500);
    }
  }

  async _loadUserGames(win) {
    const container = win.querySelector("#jsdos-user-games");
    if (!container) return;

    try {
      await this.fs.fsReady;
      const dir = this.fs.resolveUserPath(GAMES_DIR);
      await this.fs.p("mkdir", dir, { recursive: true }).catch(() => {});
      const files = await this.fs.pRead("readdir", dir).catch(() => []);
      const gameFiles = files.filter(
        (f) => !f.startsWith(".") && (f.endsWith(".jsdos") || f.endsWith(".exe") || f.endsWith(".com"))
      );

      if (gameFiles.length === 0) {
        container.innerHTML = `<div style="font-size:12px;color:#555;padding:4px 0;">No uploaded games yet.</div>`;
        return;
      }

      container.innerHTML = gameFiles
        .map((f) => {
          const displayName = f
            .replace(/\.[^.]+$/, "")
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          return `
        <div class="jsdos-game-card jsdos-user-card" data-user-file="${f}" style="position:relative;">
          <i class="fa-solid fa-floppy-disk jsdos-game-icon" style="color:#c77dff;"></i>
          <div class="jsdos-game-title">${displayName}</div>
          <button class="jsdos-delete-btn" data-file="${f}" title="Delete" style="
            position:absolute;top:6px;right:6px;background:none;border:none;
            color:#666;cursor:pointer;font-size:13px;padding:2px 4px;line-height:1;
          "><i class="fa-solid fa-xmark"></i></button>
        </div>
      `;
        })
        .join("");

      container.querySelectorAll(".jsdos-user-card").forEach((card) => {
        card.addEventListener("click", (e) => {
          if (e.target.closest(".jsdos-delete-btn")) return;
          const fileName = card.dataset.userFile;
          this.launchExe(fileName, GAMES_DIR);
        });
      });

      container.querySelectorAll(".jsdos-delete-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const fileName = btn.dataset.file;
          await this.fs.deleteBinaryFile(GAMES_DIR, fileName);
          await this._loadUserGames(win);
        });
      });
    } catch {}
  }

  async launchGame(fileName, displayName) {
    const wm = this.wm;
    const winId = `jsdos-${Date.now()}`;
    const content = `
    <div class="window-content" style="width:100%;height:calc(100% - 30px);background:#000;position:relative;">
      <div id="${winId}-inner" style="width:100%;height:100%;" class="jsdos-loading">
        <i class="fa-solid fa-compact-disc jsdos-loading-spinner"></i>
        <div style="font-size:15px;color:#c77dff;">Loading <strong style="color:#fff;">${displayName}</strong>…</div>
        <div id="${winId}-log" style="font-size:11px;color:#888;max-width:400px;text-align:center;"></div>
      </div>
    </div>`;

    bus.emit(BusEvents.ACHIEVEMENT_TRIGGER, { key: Achievements.RetroPlayer });

    const win = this.windowHelper.createAndMountWindow(winId, displayName, content, "800px", "600px", {
      icon: resolveIconUrl("static/icons/jsdos.webp")
    });

    const inner = win.querySelector(`#${winId}-inner`);
    const log = win.querySelector(`#${winId}-log`);
    const setLog = (msg) => {
      if (log) log.textContent = msg;
    };
    const showError = (msg) => {
      if (inner)
        inner.innerHTML = `
      <div class="jsdos-error">
        <i class="fa-solid fa-triangle-exclamation jsdos-error-icon"></i>
        <div class="jsdos-error-msg">${msg}</div>
      </div>`;
    };

    let iframeEl = null;
    let bundleUrl = null;
    let iframePageUrl = null;

    const cleanup = () => {
      try {
        iframeEl?.contentWindow?.postMessage("mute", "*");
      } catch {}
      if (bundleUrl) URL.revokeObjectURL(bundleUrl);
      if (iframePageUrl) URL.revokeObjectURL(iframePageUrl);
    };

    win.querySelector(".close-btn").addEventListener("click", () => {
      cleanup();
      wm.removeFromTaskbar(winId);
      win.remove();
    });

    win.querySelector(".minimize-btn").addEventListener("click", () => {
      try {
        iframeEl?.contentWindow?.postMessage("mute", "*");
      } catch {}
      wm.minimizeWindow(win);
    });

    try {
      setLog("Downloading game…");
      const gameUrl = `${CDN_BASES.MAIN}/static/apps/jsdos/${fileName}`;

      const response = await fetch(gameUrl);
      if (!response.ok) {
        showError(`Failed to download: ${response.statusText}`);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const bundleBlob = new Blob([arrayBuffer], { type: "application/zip" });
      bundleUrl = URL.createObjectURL(bundleBlob);

      wm.sendNotify(`Saved ${fileName} jsdos game at Games/ directory. `);
      setLog("Launching…");

      const iframeHTML = this._buildIframeHTML(bundleUrl);
      const iframeBlobUrl = URL.createObjectURL(new Blob([iframeHTML], { type: "text/html" }));
      iframePageUrl = iframeBlobUrl;

      inner.innerHTML = "";
      inner.style.cssText = "width:100%;height:100%;";
      inner.classList.remove("jsdos-loading");

      iframeEl = document.createElement("iframe");
      iframeEl.src = iframeBlobUrl;
      iframeEl.style.cssText = "width:100%;height:100%;border:none;display:block;";
      iframeEl.setAttribute("allowfullscreen", "");
      inner.appendChild(iframeEl);
    } catch (e) {
      showError(`Error: ${e.message}`);
    }
  }

  _buildIframeHTML(bundleUrl) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">

<link rel="stylesheet" href="https://v8.js-dos.com/latest/js-dos.css">
</head>
<body>
<div id="dos"></div>
<script src="https://v8.js-dos.com/latest/js-dos.js"><\/script>
<script>
  Dos(document.getElementById("dos"), {
    url: ${JSON.stringify(bundleUrl)},
    onEvent: function(event, ci) {
      if (event === "ci-ready") {
        window._ci = ci;
      }
    }
  });
  window.addEventListener("message", function(e) {
    if (e.data === "mute" && window._ci) { try { window._ci.mute(); } catch {} }
  });
<\/script>
</body>
</html>`;
  }

  async _buildBundle(name, arrayBuffer) {
    const conf = [
      "[sdl]",
      "output=surface",
      "",
      "[dosbox]",
      "machine=svga_s3",
      "",
      "[cpu]",
      "core=auto",
      "cputype=auto",
      "cycles=max",
      "",
      "[autoexec]",
      `mount c /`,
      `c:`,
      `${name}`
    ].join("\n");
    const zipEntries = {
      ".jsdos": {
        "dosbox.conf": new TextEncoder().encode(conf)
      },
      [name]: new Uint8Array(arrayBuffer)
    };
    const zipped = zipSync(zipEntries);
    return new Blob([zipped], { type: "application/zip" });
  }

  async launchExe(name, path) {
    const wm = this.wm;
    const winId = `jsdos-${Date.now()}`;
    const content = `
    <div class="window-content" style="width:100%;height:calc(100% - 30px);background:#000;position:relative;">
      <div id="${winId}-inner" style="width:100%;height:100%;" class="jsdos-loading">
        <i class="fa-solid fa-compact-disc jsdos-loading-spinner"></i>
        <div style="font-size:15px;color:#c77dff;">Loading <strong style="color:#fff;">${name}</strong>…</div>
        <div id="${winId}-log" style="font-size:11px;color:#888;max-width:400px;text-align:center;"></div>
      </div>
    </div>`;

    bus.emit(BusEvents.ACHIEVEMENT_TRIGGER, { key: Achievements.RetroPlayer });

    const win = this.windowHelper.createAndMountWindow(winId, name, content, "800px", "600px", {
      icon: resolveIconUrl("static/icons/jsdos.webp")
    });

    const inner = win.querySelector(`#${winId}-inner`);
    const log = win.querySelector(`#${winId}-log`);
    const setLog = (msg) => {
      if (log) log.textContent = msg;
    };
    const showError = (msg) => {
      if (inner)
        inner.innerHTML = `
      <div class="jsdos-error" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:32px;color:#ff6b6b;"></i>
        <div style="color:#ff6b6b;font-size:14px;font-family:monospace;">${msg}</div>
      </div>`;
    };

    let iframeEl = null;
    let bundleUrl = null;
    let iframePageUrl = null;

    const cleanup = () => {
      try {
        iframeEl?.contentWindow?.postMessage("mute", "*");
      } catch {}
      if (bundleUrl) URL.revokeObjectURL(bundleUrl);
      if (iframePageUrl) URL.revokeObjectURL(iframePageUrl);
    };

    win.querySelector(".close-btn").addEventListener("click", () => {
      cleanup();
      wm.removeFromTaskbar(winId);
      win.remove();
    });

    win.querySelector(".minimize-btn").addEventListener("click", () => {
      try {
        iframeEl?.contentWindow?.postMessage("mute", "*");
      } catch {}
      wm.minimizeWindow(win);
    });

    try {
      setLog("Reading file…");
      const normalizedPath = Array.isArray(path)
        ? path
        : typeof path === "string"
          ? path.split("/").filter(Boolean)
          : Object.values(path ?? {}).filter((v) => typeof v === "string");

      const blob = await this.fs.readBinaryFile(normalizedPath, name);
      if (!blob || blob.size === 0) {
        showError("Failed to read file.");
        return;
      }

      const isBundle = name.toLowerCase().endsWith(".jsdos");

      setLog(isBundle ? "Preparing bundle…" : "Building js-dos bundle…");
      const arrayBuffer = await blob.arrayBuffer();
      const bundleBlob = isBundle
        ? new Blob([arrayBuffer], { type: "application/zip" })
        : await this._buildBundle(name, arrayBuffer);

      bundleUrl = URL.createObjectURL(bundleBlob);

      setLog("Launching…");

      const iframeHTML = this._buildIframeHTML(bundleUrl);
      const iframeBlobUrl = URL.createObjectURL(new Blob([iframeHTML], { type: "text/html" }));
      iframePageUrl = iframeBlobUrl;

      inner.innerHTML = "";
      inner.style.cssText = "width:100%;height:100%;";
      inner.classList.remove("jsdos-loading");

      iframeEl = document.createElement("iframe");
      iframeEl.src = iframeBlobUrl;
      iframeEl.style.cssText = "width:100%;height:100%;border:none;display:block;";
      iframeEl.setAttribute("allowfullscreen", "");
      inner.appendChild(iframeEl);
    } catch (e) {
      showError(`Error: ${e.message}`);
    }
  }
}
