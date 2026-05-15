import { BaseApp } from "./core/BaseApp.js";
import { WindowHelper } from "./utils/WindowHelper.js";
import { resolveGhUrl } from "./shared/assetResolver.js";

export class AboutApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
  }

  open() {
    const winId = "about-yukios";
    if (this._isSingletonOpen(winId)) return;

    const version = "1.2.0";

    const capabilities = [
      {
        tag: "WM",
        title: "Windowed Multitasking",
        desc: "Drag, resize, and layer apps like a real desktop."
      },
      {
        tag: "VFS",
        title: "Virtual Filesystem",
        desc: "Explorer + app storage living in the browser."
      },
      {
        tag: "PLAY",
        title: "Games Library",
        desc: "A growing catalog of ready-to-play games."
      },
      {
        tag: "APPS",
        title: "Built-in Apps",
        desc: "Terminal, browser, editor, paint, calculator, and more."
      },
      {
        tag: "RUN",
        title: "Multi-Runtime",
        desc: "HTML5, WASM, emulation, flash and more in one place."
      },
      {
        tag: "LOOK",
        title: "Personalization",
        desc: "Bring your own wallpapers and tweak the vibe."
      }
    ];

    const privacyText = `
      Yuki OS collects minimal usage data required for stability and analytics.

      What is collected:
      • Anonymous daily identifier derived from IP (rotates every UTC day using HMAC)
      • Event analytics such as app launches, session duration, and feature usage
      • Timestamps of interactions

      What is NOT stored:
      • Raw IP addresses are not permanently stored in the database
      • No passwords, files, or personal content are collected

      How data is used:
      • To measure performance and usage trends
      • To detect broken games or errors reported by users
      • To improve app stability and features

      Data retention:
      • Analytics can be automatically purged by admin settings
      • Old records can be deleted by retention rules

      Third parties:
      • Optional Discord webhook logging may be enabled for admin monitoring
      • No selling or sharing of user data with advertisers
      `;

    const content = `
      <style>
        #about-yukios .abx {
          background:
            radial-gradient(circle at 20% 0%, rgba(200, 65, 27, 0.12), transparent 55%),
            linear-gradient(#0b0b10, #0b0b10);
          color: rgba(255, 255, 255, 0.92);
          height: calc(100% - 40px);
          overflow-y: auto;
          box-sizing: border-box;
          font-family: "Barlow", system-ui, -apple-system, "Segoe UI", sans-serif;
        }

        #about-yukios .abx-shell {
          padding: 18px;
          display: grid;
          gap: 14px;
        }

        #about-yukios .abx-top {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: start;
          padding: 14px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(18px);
        }

        #about-yukios .abx-mark {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          text-align: center;
        }

        #about-yukios .abx-badge {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          display: block;
          object-fit: cover;
        }

        #about-yukios .abx-title {
          margin: 0;
          font-weight: 800;
          font-size: 1.5rem;
        }

        #about-yukios .abx-sub {
          margin: 6px 0 0;
          color: rgba(255,255,255,0.66);
          font-size: 0.88rem;
        }

        #about-yukios .abx-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }

        #about-yukios .abx-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }

        #about-yukios .abx-panel {
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(18px);
          overflow: hidden;
        }

        #about-yukios .abx-panel-h {
          display: flex;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.18);
          font-weight: 700;
        }

        #about-yukios .abx-panel-b {
          padding: 12px 14px;
        }

        #about-yukios .abx-caps {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        #about-yukios .abx-cap {
          border-radius: 12px;
          padding: 10px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.22);
        }

        #about-yukios .abx-cap-tag {
          font-size: 0.68rem;
          text-transform: uppercase;
          opacity: 0.7;
        }

        #about-yukios .abx-cap-title {
          font-weight: 700;
          font-size: 0.92rem;
        }

        #about-yukios .abx-cap-desc {
          font-size: 0.82rem;
          color: rgba(255,255,255,0.64);
        }

        #about-yukios .abx-legal {
          font-size: 0.84rem;
          color: rgba(255,255,255,0.75);
          white-space: pre-wrap;
          line-height: 1.6;
        }

        #about-yukios .abx-foot {
          display: flex;
          justify-content: space-between;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
        }

        #about-yukios .abx-link {
          text-decoration: none;
          font-size: 0.72rem;
          padding: 0.45rem 0.8rem;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.16);
          color: rgba(255,255,255,0.92);
        }
      </style>

      <div class="abx">
        <div class="abx-shell">

          <div class="abx-top">
            <div class="abx-mark">
              <img class="abx-badge" src="${resolveGhUrl("https://cdn.jsdelivr.net/gh/Reeyuki/yukios@857d9aa378415b8f2ea3c7f4c2c4fd671af35511/static/icons/logo.png")}">
              <h1 class="abx-title">Yuki OS</h1>
              <p class="abx-sub">
                Browser desktop environment with apps, games, and sandboxed runtime systems.
              </p>
            </div>

            <div class="abx-meta">
              <div class="abx-pill">Version ${version}</div>
            </div>
          </div>

          <div class="abx-grid">

            <div class="abx-panel">
              <div class="abx-panel-h">Capabilities</div>
              <div class="abx-panel-b">
                <div class="abx-caps">
                  ${capabilities
                    .map(
                      (c) => `
                    <div class="abx-cap">
                      <div class="abx-cap-tag">${c.tag}</div>
                      <div class="abx-cap-title">${c.title}</div>
                      <div class="abx-cap-desc">${c.desc}</div>
                    </div>
                  `
                    )
                    .join("")}
                </div>
              </div>
            </div>

            <div class="abx-panel">
              <div class="abx-panel-h">Privacy</div>
              <div class="abx-panel-b">
                <div class="abx-legal">${privacyText}</div>
              </div>
            </div>

          </div>

          <div class="abx-foot">
            <span>Built by Reeyuki</span>
            <a class="abx-link" target="_blank" href="https://github.com/reeyuki/YukiOS">Repository ↗</a>
          </div>

        </div>
      </div>
    `;

    this.windowHelper.createAndMountWindow(winId, "About Yuki OS", content, "720px", "680px", {
      icon: "fa fa-circle-info"
    });
  }
}
