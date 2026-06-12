import { BaseApp } from "../core/BaseApp.js";
import { resolveGhUrl } from "../shared/assetResolver.js";
import { PersistenceTypes } from "../runtime/AppSchema.js";
export const YUKIOS_VERSION = "v1.4.1";

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
  Yuki OS collects limited anonymous analytics to help improve stability and usage insights.

  Collected data:
  • App launches and feature usage
  • Session activity and timestamps
  • Anonymous analytics identifiers

  Not collected:
  • Files, documents, or personal content
  • Passwords or account credentials

  Data use:
  • Improving performance and reliability
  • Understanding feature usage
  • Diagnosing issues and errors

  Yuki OS does not sell user data or share it with advertisers.
`;

const copyrightText = `
  Copyright & Takedown Requests

  Yuki OS respects the intellectual property rights of developers, publishers, artists, and content owners.

  If you believe that any content, game, asset, or material accessible through Yuki OS infringes your copyright or other intellectual property rights, please contact:

  <a href="mailto:yukios-os@proton.me">yukios-os@proton.me</a>

  Include enough information to identify the content and your connection to it. Requests will be reviewed and processed.
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
              <div class="abx-pill">
                35k+ Total Users
              </div>
              <a
                class="abx-meta-link"
                target="_blank"
                rel="noopener noreferrer"
                href="https://discord.gg/uFuGfseB9Z"
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

            <div class="abx-panel">
              <div class="abx-panel-h">DMCA & Copyright</div>
              <div class="abx-panel-b">
                <div class="abx-legal">${copyrightText}</div>
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
