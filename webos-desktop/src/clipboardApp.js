import { BaseApp } from "./core/BaseApp.js";

class ClipboardManagerApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
    this.clipboardManager = services.clipboardManager;
    this.winId = "clipboard-manager-window";
    this.enabled = localStorage.getItem("yukiOS_clipboard_manager_enabled") !== "false";
    this._initTray();
  }

  _initTray() {
    if (this.enabled) {
      this.registerTray(this.winId, "fas fa-paste", "Clipboard", {
        resident: true,
        showInTray: true,
        onClick: () => {
          this.open();
        }
      });
    }
  }

  open(options = {}) {
    const existingWin = document.getElementById(this.winId);
    if (existingWin) {
      this.wm._animateAndRemove(existingWin);
      this.wm.removeFromTaskbar(this.winId);
    }
    this.openWindows.delete(this.winId);

    const history = this.clipboardManager.getHistory();
    const currentItem = this.clipboardManager.get();

    const win = this.wm.createWindow(this.winId, "Clipboard Manager", "500px", "400px");

    win.innerHTML = `
      <div class="window-header">
        <span>Clipboard Manager</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="window-content" style="width:100%;height:100%;display:flex;flex-direction:column;background:rgba(18,18,24,0.95);padding:16px;gap:12px;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.1);">
          <h3 style="margin:0;font-size:16px;color:rgba(255,255,255,0.9);">Clipboard History</h3>
          <button id="clear-clipboard" style="background:rgba(239,68,68,0.8);color:rgba(255,255,255,0.95);border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;transition:opacity 0.2s;">
            <i class="fas fa-trash" style="margin-right:6px;"></i>Clear
          </button>
        </div>
        <div id="clipboard-history" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:8px;">
          ${history.length === 0 ? '<div style="text-align:center;color:rgba(255,255,255,0.5);padding:32px;font-size:14px;">No clipboard history</div>' : ""}
        </div>
        <div style="padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);font-size:13px;color:rgba(255,255,255,0.6);">
          <i class="fas fa-info-circle" style="margin-right:6px;"></i>Clipboard captures all copy operations automatically
        </div>
      </div>
    `;

    document.body.appendChild(win);
    this.wm.mountWindow(win, this.winId, "Clipboard Manager", "fas fa-paste");

    this.openWindows.add(this.winId);
    this._renderHistory(win, history, currentItem);
    this._bindEvents(win, this.winId);
  }

  _renderHistory(win, history, currentItem) {
    const container = win.querySelector("#clipboard-history");
    if (!container) return;

    if (history.length === 0) {
      container.innerHTML =
        '<div style="text-align:center;color:var(--text-muted);padding:32px;font-size:13px;">No clipboard history</div>';
      return;
    }

    container.innerHTML = history
      .map((item, index) => {
        const isLatest = index === 0;
        const preview = this._getPreview(item);
        const timestamp = new Date(item.timestamp).toLocaleTimeString();

        return `
        <div class="clipboard-item" data-index="${index}" style="background:var(--glass);border:1px solid ${isLatest ? "var(--brand)" : "var(--glass-border)"};border-radius:8px;padding:12px;cursor:pointer;transition:all 0.2s;position:relative;">
          ${isLatest ? '<div style="position:absolute;top:4px;right:4px;background:var(--brand);color:var(--text-on-brand);font-size:11px;padding:2px 6px;border-radius:4px;">Latest</div>' : ""}
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-right:40px;">
            <i class="fas ${this._getTypeIcon(item.type)}" style="color:var(--brand);font-size:14px;"></i>
            <span style="font-size:13px;color:var(--text-secondary);">${timestamp}</span>
            <span style="font-size:12px;color:var(--text-muted);margin-left:auto;">${item.type}</span>
          </div>
          <div style="font-size:14px;color:var(--text-primary);word-break:break-all;max-height:60px;overflow:hidden;text-overflow:ellipsis;">
            ${preview}
          </div>
        </div>
      `;
      })
      .join("");

    const currentWin = document.getElementById(this.winId);
    container.querySelectorAll(".clipboard-item").forEach((el) => {
      el.addEventListener("click", async () => {
        const index = parseInt(el.dataset.index);
        const item = history[index];
        if (item) {
          this._isCopyingFromHistory = true;

          const rect = el.getBoundingClientRect();
          const originalBorder = el.style.borderColor;
          const originalBackground = el.style.background;
          const originalBoxShadow = el.style.boxShadow;

          el.style.background = "var(--brand-dim)";
          el.style.borderColor = "var(--brand)";
          el.style.boxShadow = "0 0 30px var(--brand-glow)";
          el.style.transition = "all 0.3s ease";

          const copiedIndicator = document.createElement("div");
          copiedIndicator.style.cssText = `position:fixed;top:${rect.top + rect.height / 2}px;left:${rect.left + rect.width / 2}px;transform:translate(-50%,-50%);background:var(--brand);color:var(--text-on-brand);font-size:13px;padding:6px 16px;border-radius:6px;font-weight:600;pointer-events:none;z-index:10000;box-shadow:0 4px 12px var(--brand-glow);transition:opacity 0.3s ease;`;
          copiedIndicator.textContent = "Copied!";
          document.body.appendChild(copiedIndicator);

          try {
            await navigator.clipboard.writeText(String(item.data));
          } catch (e) {
            console.error("[ClipboardApp] Failed to copy to browser clipboard:", e);
            copiedIndicator.textContent = "Failed";
            copiedIndicator.style.background = "var(--error)";
          }

          setTimeout(() => {
            copiedIndicator.style.opacity = "0";
          }, 1500);

          setTimeout(() => {
            el.style.background = originalBackground;
            el.style.borderColor = originalBorder;
            el.style.boxShadow = originalBoxShadow;
            copiedIndicator.remove();
            this._isCopyingFromHistory = false;
          }, 1800);
        }
      });
    });
  }

  _getPreview(item) {
    if (item.type === "text") {
      return item.data.length > 100 ? item.data.substring(0, 100) + "..." : item.data;
    } else if (item.type === "json") {
      try {
        const str = JSON.stringify(item.data);
        return str.length > 100 ? str.substring(0, 100) + "..." : str;
      } catch {
        return "[Invalid JSON]";
      }
    } else if (item.type === "image") {
      return "[Image data]";
    }
    return String(item.data);
  }

  _getTypeIcon(type) {
    switch (type) {
      case "text":
        return "fa-font";
      case "json":
        return "fa-code";
      case "image":
        return "fa-image";
      default:
        return "fa-file";
    }
  }

  _bindEvents(win, winId) {
    const clearBtn = win.querySelector("#clear-clipboard");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        this.clipboardManager.clear();
        this._renderHistory(win, this.clipboardManager.getHistory(), this.clipboardManager.get());
        this.notify("Cleared", "Clipboard cleared", "info", 2000, "fa-trash");
      });
    }

    this.clipboardManager.onChange((item) => {
      if (this._isCopyingFromHistory) return;
      const currentWin = document.getElementById(this.winId);
      if (currentWin) {
        this._renderHistory(currentWin, this.clipboardManager.getHistory(), this.clipboardManager.get());
      }
    });
  }

  onClose(winId) {
    this.openWindows.delete(winId);
    if (!this.enabled) {
      this.unregisterTray(winId);
    }
  }
}

export { ClipboardManagerApp };
