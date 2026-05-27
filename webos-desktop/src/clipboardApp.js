import { BaseApp } from "./core/BaseApp.js";
import { showConfirm, showPrompt } from "./shared/dialogs.js";

class ClipboardManagerApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
    this.clipboardManager = services.clipboardManager;
    this.winId = "clipboard-manager-window";
    this.popupId = "clipboard-tray-popup";
    this.enabled = localStorage.getItem("yukiOS_clipboard_manager_enabled") !== "false";
    this._popupVisible = false;
    this._initTray();
  }

  _initTray() {
    if (this.enabled) {
      this.registerTray(this.winId, "fas fa-paste", "Clipboard", {
        resident: true,
        showInTray: true,
        onClick: () => {
          this.togglePopup();
        }
      });
    }
  }

  togglePopup() {
    if (this._popupVisible) {
      this.closePopup();
    } else {
      this.openPopup();
    }
  }

  openPopup() {
    if (this._popupVisible) return;

    const existingPopup = document.getElementById(this.popupId);
    if (existingPopup) {
      existingPopup.remove();
    }

    const history = this.clipboardManager.getHistory();
    const currentItem = this.clipboardManager.get();

    const popup = document.createElement("div");
    popup.id = this.popupId;
    popup.className = "clipboard-tray-popup";
    popup.innerHTML = `
      <div class="clipboard-popup-header">
        <span class="clipboard-popup-title">Clipboard History</span>
        <button id="clear-clipboard" class="clipboard-clear-btn">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      <div id="clipboard-history" class="clipboard-history-list">
        ${history.length === 0 ? '<div class="clipboard-empty">No clipboard history</div>' : ""}
      </div>
      <div class="clipboard-popup-footer">
        <i class="fas fa-info-circle"></i>
        <span>Clipboard captures all copy operations automatically</span>
      </div>
    `;

    document.body.appendChild(popup);

    const trayEl = document.getElementById("app-tray");
    const trayRect = trayEl ? trayEl.getBoundingClientRect() : { right: 16, top: window.innerHeight - 48 };

    popup.style.right = `${window.innerWidth - trayRect.right}px`;
    popup.style.bottom = `${window.innerHeight - trayRect.top + 8}px`;
    popup.style.display = "block";

    this._popupVisible = true;
    this._renderHistory(popup, history, currentItem);
    this._bindEvents(popup, this.popupId);

    document.addEventListener("click", this._handleOutsideClick);
  }

  closePopup() {
    const popup = document.getElementById(this.popupId);
    if (popup) {
      popup.classList.add("closing");
      popup.addEventListener(
        "animationend",
        () => {
          popup.remove();
        },
        { once: true }
      );
    }
    this._popupVisible = false;
    document.removeEventListener("click", this._handleOutsideClick);
  }

  _handleOutsideClick = (e) => {
    const popup = document.getElementById(this.popupId);
    const trayEl = document.getElementById("app-tray");
    if (popup && !e.target.closest("#clipboard-tray-popup") && !e.target.closest("#app-tray")) {
      this.closePopup();
    }
  };

  open(options = {}) {
    this.togglePopup();
  }

  _renderHistory(popup, history, currentItem) {
    const container = popup.querySelector("#clipboard-history");
    if (!container) return;

    if (history.length === 0) {
      container.innerHTML = '<div class="clipboard-empty">No clipboard history</div>';
      return;
    }

    container.innerHTML = history
      .map((item, index) => {
        const isLatest = index === 0;
        const preview = this._getPreview(item);
        const timestamp = new Date(item.timestamp).toLocaleTimeString();
        const isStarred = this.clipboardManager.isStarred(item.id);

        return `
        <div class="clipboard-item" data-index="${index}">
          ${isLatest ? '<div class="clipboard-item-badge">Latest</div>' : ""}
          <div class="clipboard-item-meta">
            <i class="fas ${this._getTypeIcon(item.type)}"></i>
            <span class="clipboard-item-time">${timestamp}</span>
            <span class="clipboard-item-type">${item.type}</span>
          </div>
          <div class="clipboard-item-content">
            ${preview}
          </div>
          <div class="clipboard-item-actions">
            <button class="clipboard-action-btn edit-btn" data-index="${index}" title="Edit contents">
              <i class="fas fa-pen"></i>
            </button>
            <button class="clipboard-action-btn star-btn ${isStarred ? "starred" : ""}" data-index="${index}" title="${isStarred ? "Unstar" : "Star"}">
              <i class="fas fa-star"></i>
            </button>
            <button class="clipboard-action-btn remove-btn" data-index="${index}" title="Remove from history">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    const currentPopup = document.getElementById(this.popupId);
    container.querySelectorAll(".clipboard-item").forEach((el) => {
      el.addEventListener("click", async (e) => {
        if (e.target.closest(".clipboard-action-btn")) return;

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
          copiedIndicator.className = "clipboard-copied-indicator";
          copiedIndicator.textContent = "Copied!";
          copiedIndicator.style.cssText = `position:fixed;top:${rect.top + rect.height / 2}px;left:${rect.left + rect.width / 2}px;transform:translate(-50%,-50%);background:var(--brand);color:var(--text-on-brand);font-size:13px;padding:6px 16px;border-radius:6px;font-weight:600;pointer-events:none;z-index:10000;box-shadow:0 4px 12px var(--brand-glow);transition:opacity 0.3s ease;`;
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

    container.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        const item = history[index];
        if (item) {
          const newData = await showPrompt(
            "Edit Clipboard Contents",
            "Edit clipboard contents:",
            String(item.data),
            "Save"
          );
          if (newData !== null && newData !== item.data) {
            this.clipboardManager.updateItem(index, newData);
            this._renderHistory(currentPopup, this.clipboardManager.getHistory(), this.clipboardManager.get());
            this.notify("Updated", "Clipboard item updated", "success", 2000, "fa-pen");
          }
        }
      });
    });

    container.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        const confirmed = await showConfirm("Remove Item", "Remove this item from history?", "Remove", "Cancel");
        if (confirmed) {
          this.clipboardManager.removeFromHistory(index);
          this._renderHistory(currentPopup, this.clipboardManager.getHistory(), this.clipboardManager.get());
          this.notify("Removed", "Item removed from history", "info", 2000, "fa-trash");
        }
      });
    });

    container.querySelectorAll(".star-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        const item = history[index];
        if (item) {
          const isStarred = this.clipboardManager.toggleStar(item.id);
          this._renderHistory(currentPopup, this.clipboardManager.getHistory(), this.clipboardManager.get());
          this.notify(
            isStarred ? "Starred" : "Unstarred",
            isStarred ? "Item starred" : "Item unstarred",
            "success",
            2000,
            "fa-star"
          );
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

  _bindEvents(popup, popupId) {
    const clearBtn = popup.querySelector("#clear-clipboard");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        this.clipboardManager.clear();
        this._renderHistory(popup, this.clipboardManager.getHistory(), this.clipboardManager.get());
        this.notify("Cleared", "Clipboard cleared", "info", 2000, "fa-trash");
      });
    }

    this.clipboardManager.onChange((item) => {
      if (this._isCopyingFromHistory) return;
      const currentPopup = document.getElementById(this.popupId);
      if (currentPopup) {
        this._renderHistory(currentPopup, this.clipboardManager.getHistory(), this.clipboardManager.get());
      }
    });
  }

  onClose(winId) {
    this.closePopup();
    this.openWindows.delete(winId);
    if (!this.enabled) {
      this.unregisterTray(winId);
    }
  }
}

export { ClipboardManagerApp };
