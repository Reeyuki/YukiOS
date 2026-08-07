import { setStyle, os, StorageKeys, MODES, $, createElement } from "../framework.js";
import { ScramjetBaseApp } from "../core/ScramjetBaseApp.js";
import { SYSTEM_APPS } from "../AppRegistryConfig.js";

export class DiscordApp extends ScramjetBaseApp {
  constructor(services) {
    super(services);
    this.winId = null;
  }

  getTargetURL() {
    return "https://discord.com/app";
  }

  getAppId() {
    return "discordApp";
  }

  getAppName() {
    return "Discord";
  }

  getAppIcon() {
    return "fab fa-discord";
  }

  getWindowSize() {
    return ["90vw", "85vh"];
  }

  async open(opts = {}) {
    const iconHtml = '<i class="fab fa-discord" style="margin-right:8px;font-size:16px;"></i>';
    const controlsHtml = os.window.getWindowControls();
    const winId = `${this.getAppId()}-window`;
    this.winId = winId;
    const size = this.getWindowSize();

    if (await this.isSingletonOpen(winId)) {
      return;
    }

    this.createSplash();

    const win = os.window.create(winId, this.getAppName(), size[0], size[1], {
      appId: this.getAppId(),
      skipHeader: true,
      icon: this.getAppIcon()
    });

    win.innerHTML = `
      <div class="window-header">
        <span>${iconHtml}${this.getAppName()}</span>
        ${controlsHtml}
      </div>
      <div class="window-content" style="overflow:hidden;">
        <div class="scramjet-base-container" style="width:100%;height:100%;overflow:hidden;">
          <iframe
            id="${this.getAppId()}-iframe"
            style="width:100%;height:100%;border:none;"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
          ></iframe>
        </div>
      </div>
    `;
    win.getAnimations().forEach((a) => a.cancel());
    setStyle(win, { opacity: "0" });

    await this.initScramjet(null, null, win, {});

    const cleanup = () => this.removeSplash();
    const closeObserver = new MutationObserver(() => {
      if (!$("#" + winId)) {
        cleanup();
        closeObserver.disconnect();
      }
    });
    closeObserver.observe(document.body, { childList: true });

    setTimeout(() => {
      this.removeSplash();
      closeObserver.disconnect();
      setStyle(win, { transition: "opacity 0.6s ease", opacity: "" });
    }, 3500);

    return win;
  }

  createSplash() {
    const existing = $("#discord-splash");
    if (existing) existing.remove();

    const splash = createElement("div");
    splash.id = "discord-splash";
    setStyle(splash, {
      position: "fixed",
      width: "220px",
      height: "220px",
      zIndex: "99999",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-secondary)",
      border: "1px solid var(--glass-border)",
      borderRadius: "14px",
      backdropFilter: "blur(32px)",
      boxShadow: "0 24px 64px rgba(0,0,0,0.65)",
      pointerEvents: "none"
    });
    splash.style.left = `${Math.round((window.innerWidth - 220) / 2)}px`;
    splash.style.top = `${Math.round((window.innerHeight - 220) / 2)}px`;

    splash.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <i class="fab fa-discord"
        style="font-size:56px;color:var(--brand);animation: discordLoader 2s ease-in-out infinite;transform-origin:center;"></i>
        <div style="color:var(--text-secondary);font-size:11px;font-family:var(--font-ui);opacity:0.6;">Starting</div>
      </div>
    `;

    document.body.appendChild(splash);

    if (!$("#discord-splash-style")) {
      const style = createElement("style");
      style.id = "discord-splash-style";
      style.textContent = `
        @keyframes discordLoader {
          0% {
            transform: rotate(0deg);
            animation-timing-function: cubic-bezier(0.65, 0.05, 0.36, 1);
          }

          55% {
            transform: rotate(360deg);
          }

          100% {
            transform: rotate(360deg);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  removeSplash() {
    const splash = $("#discord-splash");
    if (splash) splash.remove();
    const style = $("#discord-splash-style");
    if (style) style.remove();
  }

  async initScramjet(payload, vt, element, state) {
    await super.initScramjet(payload, vt, element, state);

    const appConfig = SYSTEM_APPS[this.getAppId()];
    const trayOpts = appConfig?.trayOptions;
    if (trayOpts && this.winId && !os.modes.isActive(MODES.MAC)) {
      os.tray.register(this.winId, this.getAppIcon(), this.getAppName(), {
        showInTray: true,
        priority: 50,
        ...trayOpts,
        onClick: () => {
          if (trayOpts.onClick) {
            trayOpts.onClick();
          } else {
            os.tray.restoreFromTray(this.winId);
          }
        },
        onQuit: () => {
          if (trayOpts.onQuit) {
            trayOpts.onQuit();
          } else {
            os.window.close(this.winId);
          }
        }
      });
    }
  }

  cleanupScramjet() {
    this.removeSplash();
    if (this.winId) {
      os.tray.unregister(this.winId);
      os.window.removeFromTaskbar(this.winId);
    }
    this.iframe = null;
    this.scramjetController = null;
  }

  onClose(winId) {
    this.removeSplash();
  }
}
