import { BaseApp } from "../core/BaseApp.js";
import { resolveGhUrl } from "../shared/assetResolver.js";
import { PersistenceTypes } from "../runtime/AppSchema.js";
export const YUKIOS_VERSION = "v1.4";

const capabilities = [
  {
    tag: "WM",
    title: "Windowed Multitasking",
    desc: "Drag, resize, snap, minimize, maximize, and layer apps like a real desktop with window animations."
  },
  {
    tag: "VFS",
    title: "Virtual Filesystem",
    desc: "BrowserFS + IndexedDB provides persistent storage at /home/reeyuki/ that survives browser restarts."
  },
  {
    tag: "PLAY",
    title: "Games Library",
    desc: "3700+ games via Steam integration, Flash (Ruffle), DOS (JS-DOS), and console emulation."
  },
  {
    tag: "APPS",
    title: "40+ Built-in Apps",
    desc: "Terminal, browser, editors (Notepad, Markdown, Monaco), paint, calculator, office viewer, and more."
  },
  {
    tag: "RUN",
    title: "Multi-Runtime Engine",
    desc: "HTML5, WebAssembly, emulation (JS-DOS, V86, Azahar 3DS), Flash (Ruffle) in one place."
  },
  {
    tag: "WORK",
    title: "Virtual Workspaces",
    desc: "Multiple virtual desktops for organizing different tasks and contexts with window assignment."
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

export class AboutApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  getDeclarativeSchema(opts) {
    return {
      id: "about-yukios",
      name: "About Yuki OS",
      icon: "fa fa-circle-info",
      windows: [
        {
          id: "about-yukios",
          title: "About Yuki OS",
          size: ["720px", "680px"],
          icon: "fa fa-circle-info",
          ui: `
     
      <div class="abx">
        <div class="abx-shell">

          <div class="abx-top">
            <div class="abx-mark">
              <img class="abx-badge" src="${resolveGhUrl("static/icons/logo.png")}">
              <h1 class="abx-title">Yuki OS</h1>
              <p class="abx-sub">
                Browser desktop environment with apps, games, and sandboxed runtime systems.
              </p>
            </div>

            <div class="abx-meta">
              <div class="abx-pill">Version ${YUKIOS_VERSION}</div>

              <a
                class="abx-meta-link"
                target="_blank"
                rel="noopener noreferrer"
                href="https://discord.gg/2Z8Gvtqt7"
              >
                <i class="fab fa-discord"></i> Join Discord
              </a>

              <a
                class="abx-meta-link"
                target="_blank"
                rel="noopener noreferrer"
                href="https://github.com/reeyuki/YukiOS"
              >
                <i class="fab fa-github"></i> GitHub
              </a>
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
          </div>

        </div>
      </div>
    `
        }
      ],
      state: {
        initial: {},
        persistence: PersistenceTypes.NONE
      },
      onMount: "init"
    };
  }

  init(payload, event, element, state) {}
}
