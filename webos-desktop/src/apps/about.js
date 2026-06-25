import "../styles/about.css";
import { resolveIconUrl, resolveGhUrl } from "../shared/assetResolver.js";
import { BaseApp, PersistenceTypes } from "../framework.js";
export const YUKIOS_VERSION = "v1.4.5";

const capabilities = [
  {
    tag: "WM",
    title: "Windowed Multitasking",
    desc: "Drag, resize, snap, minimize, maximize, and layer apps like a real desktop with window animations."
  },
  {
    tag: "VFS",
    title: "Virtual Filesystem",
    desc: "Your files live in the browser. Close the tab and they're still there when you come back."
  },
  {
    tag: "PLAY",
    title: "Games Library",
    desc: "3700+ games via Steam integration, Flash (Ruffle), DOS (JS-DOS), and console emulation."
  },
  {
    tag: "APPS",
    title: "80 Built-in Apps",
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
  YukiOS collects limited anonymous analytics to help improve stability and usage insights.

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

  YukiOS does not sell user data or share it with advertisers.
`;

const copyrightText = `
  Copyright & Takedown Requests

  YukiOS doesn't host any copyrighted content. Games and apps are loaded from their original sources or CDNs.

  If you believe something here violates your rights, contact us at:

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
      name: "About YukiOS",
      icon: "fa fa-circle-info",
      windows: [
        {
          id: "about-yukios",
          title: "About YukiOS",
          size: ["720px", "85vh"],
          icon: "fa fa-circle-info",
          ui: `
     
      <div class="abx">
        <div class="abx-shell">

          <div class="abx-top">
            <div class="abx-mark">
              <img class="abx-badge" src="${resolveIconUrl("static/icons/logo.png")}">
              <h1 class="abx-title">YukiOS</h1>
              <p class="abx-sub">
                A browser-based desktop with apps, games, emulators, and a virtual filesystem.
              </p>
            </div>

            <div class="abx-meta">
              <div class="abx-pill">Version ${YUKIOS_VERSION}</div>
              <div class="abx-pill">
                50k+ Total Users
              </div>
              <a
                class="abx-meta-link"
                target="_blank"
                rel="noopener noreferrer"
                href="https://discord.gg/wufbWFwr4G"
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
            <span>Made by Reeyuki</span>
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
