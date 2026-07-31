import "../styles/about.css";
import { resolveIconUrl, resolveGhUrl } from "../shared/assetResolver.js";
import { BaseApp, os, StorageKeys } from "../framework.js";
import { bindEvent, $ } from "../shared/domUtils.js";
import versionTxt from "../../version.txt?raw";
export const YUKIOS_VERSION = versionTxt.trim();

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
    desc: "2900+ games via Steam integration, Flash (Ruffle), DOS (JS-DOS), and console emulation."
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

  open(opts = {}) {
    const win = os.window.create("about-yukios", "About YukiOS", "720px", "85vh", {
      icon: "fa fa-circle-info"
    });

    win.innerHTML = `
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
                target="blank"
                rel="noopener noreferrer"
                href="https://discord.gg/wufbWFwr4G"
              >
                <i class="fab fa-discord"></i> Join Discord
              </a>

              <a
                class="abx-meta-link"
                target="blank"
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

            <div class="abx-panel">
              <div class="abx-panel-h">Support YukiOS</div>
              <div class="abx-panel-b">
                <div class="abx-sponsor">
                  <div class="abx-sponsor-icon">
                    <i class="fab fa-github"></i>
                  </div>
                  <div class="abx-sponsor-content">
                    <div class="abx-sponsor-title">Become a Sponsor</div>
                    <div class="abx-sponsor-desc">Help keep YukiOS free and open source. Your support directly funds development.</div>
                    <div class="abx-sponsor-buttons">
                      <a href="https://ko-fi.com/Reeyuki" target="_blank" rel="noopener noreferrer" class="abx-sponsor-btn abx-sponsor-btn-kofi">
                        <i class="fab fa-coffe"></i> Ko-fi
                      </a>
                      <a href="https://www.patreon.com/Reeyuki" target="_blank" rel="noopener noreferrer" class="abx-sponsor-btn abx-sponsor-btn-patreon"><i class="fab fa-patreon"></i> Patreon</a>
                      <span class="abx-sponsor-btn abx-sponsor-btn-monero" id="about-monero-btn" style="cursor:pointer;">
                        <i class="fab fa-monero"></i> Monero
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div class="abx-foot">
            <span>Made by Reeyuki</span>
          </div>

        </div>
      </div>
    `;

    const moneroBtn = $("#about-monero-btn", win);
    if (moneroBtn) {
      bindEvent(moneroBtn, "click", () => {
        const address =
          "4B5RKGR4C5WDkHGKVemU4rDcnKDG5NbwBLogE1tnxAWJAqbLPpNiDNaVZC1jrfwSdB7Sh1ALQNe3TMMvhdEJTPRcAUJhyVm";
        navigator.clipboard
          .writeText(address)
          .then(() => {
            moneroBtn.innerHTML = '<i class="fab fa-monero"></i> Copied!';
            setTimeout(() => {
              moneroBtn.innerHTML = '<i class="fab fa-monero"></i> Monero';
            }, 2000);
          })
          .catch(() => {
            os.dialog.alert("Monero Address", address);
          });
      });
    }
  }

  onClose(winId) {}
}
