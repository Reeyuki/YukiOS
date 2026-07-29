import { StorageKeys, os } from "../../framework.js";
import { BusEvents } from "../../core/EventBus.js";
import { $, $$, bindEvent, toggleClass } from "../../shared/domUtils.js";

function getSettings() {
  return {
    shelfPosition: os.storage.get(StorageKeys.chromeOsShelfPosition) || "bottom",
    shelfAutoHide: os.storage.get(StorageKeys.chromeOsShelfAutoHide) === "true",
    clock24h: os.storage.get(StorageKeys.chromeOsClock24h) === "true"
  };
}

export function renderChromeOsSettings() {
  const s = getSettings();
  return `
    <div id="pane-chromeos" class="settings-category-pane">
      <div class="settings-category-header">Chrome OS</div>

      <div class="settings-card">
        <div class="settings-card-header"><i class="fab fa-chrome"></i> Shelf</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Shelf Position</span>
            <span class="settings-label-desc">Choose which edge the shelf sits on</span>
          </div>
          <div class="settings-button-group">
            <button class="settings-btn ${s.shelfPosition === "bottom" ? "active" : ""}" data-shelf-pos="bottom"><i class="fas fa-arrow-down"></i> Bottom</button>
            <button class="settings-btn ${s.shelfPosition === "left" ? "active" : ""}" data-shelf-pos="left"><i class="fas fa-arrow-left"></i> Left</button>
            <button class="settings-btn ${s.shelfPosition === "right" ? "active" : ""}" data-shelf-pos="right"><i class="fas fa-arrow-right"></i> Right</button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Auto-Hide Shelf</span>
            <span class="settings-label-desc">Shelf hides until you hover near the edge</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsChromeOsShelfAutoHide" ${s.shelfAutoHide ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">24-Hour Clock</span>
            <span class="settings-label-desc">Show time in 24-hour format on the shelf</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsChromeOsClock24h" ${s.clock24h ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
      </div>

    </div>
  `;
}

export function bindChromeOsCategory(win, showSaved) {
  const applyShelfPosition = (pos) => {
    $$(".settings-btn[data-shelf-pos]", win).forEach((b) => toggleClass(b, "active", b.dataset.shelfPos === pos));
    os.storage.set(StorageKeys.chromeOsShelfPosition, pos);
    const shelf = $("#chromeos-shelf");
    if (shelf) {
      shelf.dataset.shelfPos = pos;
      shelf.className = shelf.className
        .replace(/shelf-pos-\w+/g, "")
        .trim()
        .split(" ")
        .filter(Boolean)
        .concat(`shelf-pos-${pos}`)
        .join(" ");
    }
    showSaved();
  };

  $$(".settings-btn[data-shelf-pos]", win).forEach((btn) => {
    bindEvent(btn, "click", () => applyShelfPosition(btn.dataset.shelfPos));
  });

  const autoHideToggle = $("#settingsChromeOsShelfAutoHide", win);
  if (autoHideToggle) {
    bindEvent(autoHideToggle, "change", () => {
      const enabled = autoHideToggle.checked;
      os.storage.set(StorageKeys.chromeOsShelfAutoHide, String(enabled));
      const shelf = $("#chromeos-shelf");
      if (shelf) {
        shelf.classList.toggle("shelf-autohide", enabled);
        if (!enabled) shelf.classList.remove("show");
      }
      showSaved();
    });
  }

  const clock24hToggle = $("#settingsChromeOsClock24h", win);
  if (clock24hToggle) {
    bindEvent(clock24hToggle, "change", () => {
      os.storage.set(StorageKeys.chromeOsClock24h, String(clock24hToggle.checked));
      os.events.emit(BusEvents.SETTINGS_CHANGED, {});
      showSaved();
    });
  }
}
