import { $, bindEvent } from "../shared/domUtils.js";
import { mountShortcutsPanel } from "../shared/shortcutsPanel.js";

export function renderShortcutsSettings() {
  return `
    <div id="pane-shortcuts" class="settings-category-pane">
      <div class="settings-category-header">Shortcuts</div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Keyboard Shortcuts</span>
            <span class="settings-label-desc">Rebind keys and create custom shortcut actions</span>
          </div>
        </div>
      </div>
      <div id="shortcuts-panel-mount"></div>
    </div>
  `;
}

export function bindShortcutsCategory(win) {
  const mountPoint = $("#shortcuts-panel-mount", win);
  if (!mountPoint || mountPoint.dataset.mounted === "true") return;
  mountPoint.dataset.mounted = "true";
  const handle = mountShortcutsPanel(mountPoint, { embedded: true });
  bindEvent(win, "remove", () => handle.destroy());
}
