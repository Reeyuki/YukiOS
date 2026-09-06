import { StorageKeys, os, createElement } from "../framework.js";
class PerformanceManager {
  constructor() {
    let mode = null;
    try {
      mode = os.storage.get(StorageKeys.performanceMode);
      if (mode == null) {
        const raw = localStorage.getItem(StorageKeys.performanceMode);
        if (raw != null) {
          try {
            const parsed = JSON.parse(raw);
            if (typeof parsed === "string" && parsed) mode = parsed;
            else if (raw === "performance" || raw === "balanced" || raw === "high") mode = raw;
          } catch {
            const cleaned = raw.replace(/^"|"$/g, "");
            if (cleaned === "performance" || cleaned === "balanced" || cleaned === "high") mode = cleaned;
          }
        }
      }
      if (mode === "high" && os.storage.get(StorageKeys.performanceMode) == null) {
        const legacy = os.storage.get(StorageKeys.powerMode);
        if (legacy === "performance" || legacy === "balanced" || legacy === "high") mode = legacy;
      }
    } catch {
      mode = null;
    }
    this.currentMode = mode || "balanced";
    this.styleEl = null;
    this.init();
  }
  init() {
    document.documentElement.setAttribute("data-performance", this.currentMode);
    this.applyPerformanceMode(this.currentMode);
  }
  getMode() {
    return this.currentMode;
  }
  setMode(mode) {
    const prevMode = this.currentMode;
    this.currentMode = mode;
    try {
      os.storage.set(StorageKeys.performanceMode, mode);
    } catch {}
    document.documentElement.setAttribute("data-performance", mode);
    this.applyPerformanceMode(mode);
    if (prevMode !== "performance" && mode === "performance") {
      this.handleVantaSwitch();
    }
    if (prevMode === "performance" && mode !== "performance") {
      this.dismissPerfToast();
    }
  }

  async handleVantaSwitch() {
    try {
      let current = null;
      try {
        current = os.storage.get(StorageKeys.wallpaperKey);
      } catch {}
      if (!current || typeof current !== "string") return;
      const isVanta = current.startsWith("vanta:");
      if (!isVanta) return;
      try {
        const existingPrev = os.storage.get(StorageKeys.performancePrevWallpaper);
        if (existingPrev) return;
      } catch {}
      try {
        os.storage.set(StorageKeys.performancePrevWallpaper, current);
      } catch {}
      const { DEFAULT_WALLPAPER_FILES, WALLPAPER_STATIC_DIR } = await import("../wallpaperConfig.js");
      if (!DEFAULT_WALLPAPER_FILES || !DEFAULT_WALLPAPER_FILES.length) return;
      const randomFile = DEFAULT_WALLPAPER_FILES[Math.floor(Math.random() * DEFAULT_WALLPAPER_FILES.length)];
      const randomStatic = `${WALLPAPER_STATIC_DIR}${randomFile}`;
      try {
        const { SystemUtilities } = await import("../system.js");
        await SystemUtilities.setWallpaper(randomStatic);
      } catch {}
      this.showPerfToast(current);
    } catch {}
  }

  showPerfToast(prevWallpaper) {
    try {
      this.dismissPerfToast();
      const toast = createElement("div");
      toast.id = "perf-wallpaper-toast";
      Object.assign(toast.style, {
        position: "fixed",
        bottom: "70px",
        right: "20px",
        zIndex: "100001",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "14px 16px",
        maxWidth: "380px",
        background: "var(--surface-1, #1e1e28)",
        border: "1px solid var(--glass-border)",
        borderRadius: "10px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        color: "var(--text-primary)",
        fontSize: "13px",
        lineHeight: "1.4"
      });
      toast.innerHTML = `
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; margin-bottom:2px;">Performance mode</div>
          <div style="color:var(--text-secondary); font-size:12px;">Switched to static wallpaper for performance, do you want to restore?</div>
        </div>
      `;
      const restoreBtn = createElement("button");
      restoreBtn.textContent = "Restore";
      Object.assign(restoreBtn.style, {
        padding: "6px 12px",
        borderRadius: "6px",
        border: "1px solid var(--brand)",
        background: "var(--brand)",
        color: "#fff",
        fontSize: "12px",
        fontWeight: "600",
        cursor: "pointer",
        flexShrink: "0"
      });
      const keepBtn = createElement("button");
      keepBtn.textContent = "Keep";
      Object.assign(keepBtn.style, {
        padding: "6px 12px",
        borderRadius: "6px",
        border: "1px solid var(--glass-border)",
        background: "var(--surface-2, rgba(255,255,255,0.06))",
        color: "var(--text-primary)",
        fontSize: "12px",
        fontWeight: "500",
        cursor: "pointer",
        flexShrink: "0"
      });
      const closeBtn = createElement("button");
      closeBtn.textContent = "×";
      Object.assign(closeBtn.style, {
        background: "transparent",
        border: "none",
        color: "var(--text-secondary)",
        fontSize: "18px",
        cursor: "pointer",
        padding: "0 2px",
        flexShrink: "0"
      });
      const dismiss = () => this.dismissPerfToast();
      restoreBtn.addEventListener("click", async () => {
        try {
          const { SystemUtilities } = await import("../system.js");
          await SystemUtilities.setWallpaper(prevWallpaper);
          try {
            os.storage.remove(StorageKeys.performancePrevWallpaper);
          } catch {}
          try {
            os.notify.send("Wallpaper restored", "Vanta wallpaper restored", {
              type: "success",
              duration: 2000,
              icon: "fa-undo"
            });
          } catch {}
        } catch {}
        dismiss();
      });
      keepBtn.addEventListener("click", () => {
        try {
          os.storage.remove(StorageKeys.performancePrevWallpaper);
        } catch {}
        dismiss();
      });
      closeBtn.addEventListener("click", () => {
        try {
          os.storage.remove(StorageKeys.performancePrevWallpaper);
        } catch {}
        dismiss();
      });
      toast.appendChild(restoreBtn);
      toast.appendChild(keepBtn);
      toast.appendChild(closeBtn);
      document.body.appendChild(toast);
      this.perfToastEl = toast;
      this.perfToastTimer = setTimeout(() => {
        try {
          os.storage.remove(StorageKeys.performancePrevWallpaper);
        } catch {}
        this.dismissPerfToast();
      }, 8000);
    } catch {}
  }

  dismissPerfToast() {
    try {
      if (this.perfToastTimer) {
        clearTimeout(this.perfToastTimer);
        this.perfToastTimer = null;
      }
      if (this.perfToastEl) {
        this.perfToastEl.remove();
        this.perfToastEl = null;
      }
      const existing = document.getElementById("perf-wallpaper-toast");
      if (existing) existing.remove();
    } catch {}
  }
  applyPerformanceMode(mode) {
    const effective = mode || "high";
    if (!this.styleEl) {
      this.styleEl = createElement("style");
      this.styleEl.id = "yukios-performance-override";
      document.head.appendChild(this.styleEl);
    }
    if (effective === "performance") {
      this.styleEl.textContent = `
        @keyframes perfFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes perfStartIn { from { opacity: 0; transform: translateY(8px) scale(0.99) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes perfStartOut { from { opacity: 1; transform: translateY(0) } to { opacity: 0; transform: translateY(4px) } }
        @keyframes perfToastIn { from { opacity: 0; transform: translateX(20px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes perfToastOut { from { opacity: 1; transform: translateX(0) } to { opacity: 0; transform: translateX(10px) } }
        @keyframes perfCtxIn { from { opacity: 0; transform: scale(0.98) } to { opacity: 1; transform: scale(1) } }
        @keyframes perfCtxOut { from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(0.98) } }
        @keyframes perfTrayIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes perfTrayOut { from { opacity: 1; transform: translateY(0) } to { opacity: 0; transform: translateY(4px) } }
        @keyframes perfTooltipIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes perfSearchIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
        html[data-performance="performance"] .window,
        html[data-performance="performance"] .window-header,
        html[data-performance="performance"] .taskbar-preview,
        html[data-performance="performance"] .context-menu,
        html[data-performance="performance"] #tray-overflow-popup,
        html[data-performance="performance"] #display-performance-tray-popup,
        html[data-performance="performance"] #clipboard-tray-popup,
        html[data-performance="performance"] #audio-mixer-panel,
        html[data-performance="performance"] .start-menu,
        html[data-performance="performance"] .qs-panel,
        html[data-performance="performance"] .notification-container,
        html[data-performance="performance"] .ntf-toast {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        html[data-performance="performance"] .start-menu {
          background: var(--surface-1, var(--bg-elev-1, #1e1e28)) !important;
          background-color: var(--surface-1, var(--bg-elev-1, #1e1e28)) !important;
          border-color: var(--glass-border) !important;
        }
        html[data-performance="performance"] .context-menu,
        html[data-performance="performance"] .context-menu-glass,
        html[data-performance="performance"] #tray-overflow-popup,
        html[data-performance="performance"] #display-performance-tray-popup,
        html[data-performance="performance"] #clipboard-tray-popup,
        html[data-performance="performance"] #audio-mixer-panel,
        html[data-performance="performance"] .qs-panel,
        html[data-performance="performance"] #ntf-panel,
        html[data-performance="performance"] .taskbar-preview {
          background: var(--surface-1, var(--bg-elev-1, #1e1e28)) !important;
          background-color: var(--surface-1, var(--bg-elev-1, #1e1e28)) !important;
        }
        html[data-performance="performance"] #taskbar {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          background: var(--bg-elev-1, #1a1a20) !important;
          background-color: var(--bg-elev-1, #1a1a20) !important;
        }
        html[data-performance="performance"] .window,
        html[data-performance="performance"] .taskbar-preview,
        html[data-performance="performance"] .context-menu,
        html[data-performance="performance"] #tray-overflow-popup,
        html[data-performance="performance"] #audio-mixer-panel,
        html[data-performance="performance"] .start-menu {
          box-shadow: var(--shadow-sm) !important;
        }
        html[data-performance="performance"] .wa-z-lift {
          box-shadow: var(--shadow-sm) !important;
        }
        html[data-performance="performance"] .window {
          animation: none !important;
          transition: opacity 50ms ease-out, box-shadow 50ms ease-out !important;
        }
        html[data-performance="performance"] .window.dragging {
          transition: none !important;
        }
        html[data-performance="performance"] .window.minimizing,
        html[data-performance="performance"] .window.maximizing,
        html[data-performance="performance"] .window.closing,
        html[data-performance="performance"] .window.opening {
          animation: none !important;
          transition: opacity 50ms ease-out !important;
        }
        html[data-performance="performance"] #snap-ghost {
          transition: opacity 50ms ease-out, transform 50ms ease-out !important;
        }
        html[data-performance="performance"] #snap-ghost:not(.snap-ghost-active) {
          display: none !important;
        }
        html[data-performance="performance"] #wallpaper-img {
          animation: none !important;
        }
        html[data-performance="performance"] .wallpaper-enter {
          animation: perfFadeIn 50ms ease-out !important;
        }
        html[data-performance="performance"] .wa-ripple,
        html[data-performance="performance"] .wa-focus-glow,
        html[data-performance="performance"] .wa-ripple-expand,
        html[data-performance="performance"] .wa-focus-pulse {
          display: none !important;
          animation: none !important;
        }
        html[data-performance="performance"] .wa-wobble-settle-anim,
        html[data-performance="performance"] .wa-start-expand,
        html[data-performance="performance"] .wa-start-collapse,
        html[data-performance="performance"] .wa-magic-lamp,
        html[data-performance="performance"] .wa-dock-zoom-out,
        html[data-performance="performance"] .wa-burn-out,
        html[data-performance="performance"] .wa-slide-in-growth,
        html[data-performance="performance"] .wa-glass-blur-in,
        html[data-performance="performance"] .wa-slide-up-in,
        html[data-performance="performance"] .wa-slide-left-in,
        html[data-performance="performance"] .wa-slide-right-in,
        html[data-performance="performance"] .wa-ws-left,
        html[data-performance="performance"] .wa-ws-right {
          animation: perfFadeIn 50ms ease-out !important;
        }
        html[data-performance="performance"] .start-menu {
          animation: perfStartIn 75ms ease-out both !important;
        }
        html[data-performance="performance"] .start-menu.closing {
          animation: perfStartOut 70ms ease-in both !important;
        }
        html[data-performance="performance"] .start-menu.search-mode .start-page[data-page="search-results"] {
          animation: perfSearchIn 50ms ease-out both !important;
        }
        html[data-performance="performance"] .start-item,
        html[data-performance="performance"] .start-cat,
        html[data-performance="performance"] .start-menu-item,
        html[data-performance="performance"] .recent-item {
          transition: background-color 50ms ease-out, color 50ms ease-out, border-color 50ms ease-out !important;
          transform: none !important;
        }
        html[data-performance="performance"] .start-item:hover,
        html[data-performance="performance"] .recent-item:hover,
        html[data-performance="performance"] .start-menu-item:hover {
          transform: none !important;
        }
        html[data-performance="performance"] .start-item:active,
        html[data-performance="performance"] .recent-item:active {
          transform: none !important;
        }
        html[data-performance="performance"] .start-menu * {
          animation-delay: 0s !important;
        }
        html[data-performance="performance"] .search-input-wrapper,
        html[data-performance="performance"] #start-menu-search {
          transition: border-color 50ms ease-out, background 50ms ease-out !important;
        }
        html[data-performance="performance"] .ntf-toast {
          animation: perfToastIn 120ms ease-out both !important;
        }
        html[data-performance="performance"] .ntf-toast.ntf-toast--exit,
        html[data-performance="performance"] .ntf-toast.closing {
          animation: perfToastOut 80ms ease-in both !important;
        }
        html[data-performance="performance"] .ntf-toast-progress {
          animation: toastProgress linear forwards !important;
        }
        html[data-performance="performance"] .context-menu,
        html[data-performance="performance"] .wa-ctx-pop,
        html[data-performance="performance"] .dekstop-context-menu {
          animation: perfCtxIn 40ms ease-out both !important;
        }
        html[data-performance="performance"] .context-menu.closing,
        html[data-performance="performance"] .context-menu.hiding {
          animation: perfCtxOut 40ms ease-in both !important;
        }
        html[data-performance="performance"] #tray-overflow-popup,
        html[data-performance="performance"] #display-performance-tray-popup,
        html[data-performance="performance"] #clipboard-tray-popup,
        html[data-performance="performance"] #audio-mixer-panel,
        html[data-performance="performance"] .qs-panel,
        html[data-performance="performance"] .power-popup {
          animation: perfTrayIn 70ms ease-out both !important;
        }
        html[data-performance="performance"] #tray-overflow-popup.closing,
        html[data-performance="performance"] #display-performance-tray-popup.closing,
        html[data-performance="performance"] #clipboard-tray-popup.closing,
        html[data-performance="performance"] #audio-mixer-panel.closing,
        html[data-performance="performance"] .qs-panel.closing {
          animation: perfTrayOut 60ms ease-in both !important;
        }
        html[data-performance="performance"] .taskbar-item,
        html[data-performance="performance"] .taskbar-dot,
        html[data-performance="performance"] .taskbar-icon {
          transition: background-color 50ms ease-out, opacity 50ms ease-out !important;
          animation: none !important;
          transform: none !important;
        }
        html[data-performance="performance"] .taskbar-item:hover {
          transform: none !important;
        }
        html[data-performance="performance"] .dock-magnify,
        html[data-performance="performance"] .taskbar-magnify {
          transition: none !important;
          transform: none !important;
        }
        html[data-performance="performance"] .speaker-pop {
          animation: none !important;
        }
        html[data-performance="performance"] .pulse-news-badge {
          animation: none !important;
        }
        html[data-performance="performance"] .news-badge {
          animation: none !important;
        }
        html[data-performance="performance"] .file-item,
        html[data-performance="performance"] .explorer-item,
        html[data-performance="performance"] .fd-row,
        html[data-performance="performance"] .folder-item {
          transition: background-color 50ms ease-out, color 50ms ease-out !important;
          transform: none !important;
        }
        html[data-performance="performance"] .file-item:hover,
        html[data-performance="performance"] .explorer-item:hover {
          transform: none !important;
        }
        html[data-performance="performance"] .settings-panel,
        html[data-performance="performance"] .settings-content,
        html[data-performance="performance"] .settings-pane {
          animation: perfFadeIn 60ms ease-out both !important;
          transition: opacity 60ms ease-out !important;
        }
        html[data-performance="performance"] .settings-nav-item,
        html[data-performance="performance"] .settings-btn,
        html[data-performance="performance"] .settings-card {
          transition: background-color 50ms ease-out, color 50ms ease-out, border-color 50ms ease-out !important;
        }
        html[data-performance="performance"] .settings-toggle,
        html[data-performance="performance"] .toggle-switch,
        html[data-performance="performance"] input[type="checkbox"] {
          transition: background-color 50ms ease-out, transform 50ms ease-out !important;
        }
        html[data-performance="performance"] input[type="range"],
        html[data-performance="performance"] .range-slider,
        html[data-performance="performance"] .settings-thumb,
        html[data-performance="performance"] .slider-thumb {
          transition: background-color 50ms ease-out, transform 50ms ease-out !important;
        }
        html[data-performance="performance"] .tooltip,
        html[data-performance="performance"] .user-tooltip,
        html[data-performance="performance"] .description-tooltip,
        html[data-performance="performance"] .file-tooltip {
          animation: perfTooltipIn 45ms ease-out both !important;
          transition: opacity 45ms ease-out !important;
        }
        html[data-performance="performance"] .hover-lift:hover,
        html[data-performance="performance"] .icon:hover img,
        html[data-performance="performance"] .window:hover {
          transform: none !important;
        }
        html[data-performance="performance"] *:not(.start-menu):not(.start-menu *) {
          text-shadow: none !important;
        }
        html[data-performance="performance"] .launchpad,
        html[data-performance="performance"] .calendar-popup,
        html[data-performance="performance"] .command-palette,
        html[data-performance="performance"] .system-dialog {
          animation: perfFadeIn 60ms ease-out both !important;
        }
        html[data-performance="performance"] .gac-glow-pulse,
        html[data-performance="performance"] .wePulse,
        html[data-performance="performance"] .steam-zoom-out,
        html[data-performance="performance"] .deckBgFloat,
        html[data-performance="performance"] .aura-shift,
        html[data-performance="performance"] .aurora-flow,
        html[data-performance="performance"] .sith-pulse,
        html[data-performance="performance"] .jedi-pulse {
          animation: none !important;
        }
      `;
    } else if (effective === "balanced") {
      this.styleEl.textContent = `
        html[data-performance="balanced"] .window,
        html[data-performance="balanced"] .taskbar-item,
        html[data-performance="balanced"] .icon,
        html[data-performance="balanced"] .context-menu,
        html[data-performance="balanced"] .dropdown-item,
        html[data-performance="balanced"] .settings-btn,
        html[data-performance="balanced"] button,
        html[data-performance="balanced"] input,
        html[data-performance="balanced"] select {
          transition-duration: 0.15s !important;
        }
        html[data-performance="balanced"] .window {
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
        }
        html[data-performance="balanced"] .window-header {
          backdrop-filter: blur(8px) saturate(1.1) !important;
          -webkit-backdrop-filter: blur(8px) saturate(1.1) !important;
        }
        html[data-performance="balanced"] .window,
        html[data-performance="balanced"] .taskbar-preview,
        html[data-performance="balanced"] .context-menu {
          box-shadow: var(--shadow-md) !important;
        }
        html[data-performance="balanced"] .wa-z-lift {
          box-shadow: var(--shadow-md) !important;
        }
        html[data-performance="balanced"] .window:hover {
          transform: none !important;
        }
        html[data-performance="balanced"] .icon:hover img {
          transform: scale(1.02) !important;
        }
        html[data-performance="balanced"] #snap-ghost {
          transition-duration: 0.1s !important;
        }
      `;
    } else {
      this.styleEl.textContent = "";
    }
  }
}
const performanceManager = new PerformanceManager();
export { performanceManager };
