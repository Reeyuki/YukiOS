import { StorageKeys, os } from "../framework.js";
import { $, $$, bindEvent } from "../shared/domUtils.js";
import { getRangeSliderValue, bindRangeSlider, renderRangeSlider } from "../shared/rangeSlider.js";
import { getSelectMenuValue, bindSelectMenu } from "../shared/selectMenu.js";
import { BusEvents } from "../core/EventBus.js";

function getConfigVal(key, dflt) {
  const cfg = os.tiling.getEffectiveConfig();
  if (!cfg) return dflt;
  const parts = key.split(".");
  let val = cfg;
  for (const p of parts) {
    if (val == null) return dflt;
    val = val[p];
  }
  return val != null ? val : dflt;
}

function rs(id, value, min, max, step) {
  return `<div style="width:200px">${renderRangeSlider(id, min, max, step, value)}</div>`;
}

export function renderTilingSettings() {
  const barEnabled = os.storage.get(StorageKeys.tilingBarEnabled) !== "false";
  const barPosition = os.storage.get(StorageKeys.tilingBarPosition) || "top";
  const barHeight = Number(os.storage.get(StorageKeys.tilingBarHeight)) || 36;
  const showClock = os.storage.get(StorageKeys.tilingBarShowClock) !== "false";
  const showWorkspace = os.storage.get(StorageKeys.tilingBarShowWorkspace) !== "false";
  const showTitle = os.storage.get(StorageKeys.tilingBarShowFocusedTitle) !== "false";
  const showTray = os.storage.get(StorageKeys.tilingBarShowTray) !== "false";
  const rofiEnabled = os.storage.get(StorageKeys.tilingRofiEnabled) !== "false";
  const rofiMaxResults = Number(os.storage.get(StorageKeys.tilingRofiMaxResults)) || 10;
  const rofiWidth = Number(os.storage.get(StorageKeys.tilingRofiWidth)) || 50;

  const innerGap = getConfigVal("gaps.inner", 5);
  const outerGap = getConfigVal("gaps.outer", 10);
  const splitRatio = getConfigVal("split_ratio", 0.5);
  const borderWidth = getConfigVal("border_width", 2);
  const borderRadius = getConfigVal("border_radius", 4);
  const resizeDelta = getConfigVal("resize_delta", 0.05);
  const animDuration = getConfigVal("animation_duration", 200);
  const mouseResize = getConfigVal("mouse_resize", true);
  const wsDelay = getConfigVal("workspace_switch_delay", 320);
  const resizeDebounce = getConfigVal("resize_debounce", 150);

  return `
    <div id="pane-tiling" class="settings-category-pane">
      <div class="settings-category-header">Tiling</div>

      <div class="settings-card" id="sc-tiling-bar">
        <div class="settings-card-header"><i class="fas fa-window-maximize"></i> Bar Settings</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Enable Top Bar</span>
            <span class="settings-label-desc">Show a top bar when tiling mode is active</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsTilingBarEnabled" ${barEnabled ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Bar Position</span>
            <span class="settings-label-desc">Where the bar appears on screen</span>
          </div>
          <div id="settingsTilingBarPosition" class="select-menu" data-placeholder="Top" data-selected="${barPosition}">
            <div class="select-menu-trigger"><span class="select-menu-label">${barPosition === "top" ? "Top" : "Bottom"}</span><i class="fas fa-chevron-down"></i></div>
            <div class="select-menu-options">
              <div class="select-menu-option" data-value="top">Top</div>
              <div class="select-menu-option" data-value="bottom">Bottom</div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Bar Height</span>
            <span class="settings-label-desc">Height of the bar in pixels (24–56)</span>
          </div>
          ${rs("settingsTilingBarHeight", barHeight, 24, 56, 1)}
        </div>
      </div>

      <div class="settings-card" id="sc-tiling-elements">
        <div class="settings-card-header"><i class="fas fa-puzzle-piece"></i> Bar Elements</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Show Clock</span>
            <span class="settings-label-desc">Display the current time and date</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsTilingShowClock" ${showClock ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Show Workspace Indicator</span>
            <span class="settings-label-desc">Show workspace dots for switching</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsTilingShowWorkspace" ${showWorkspace ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Show Focused Window Title</span>
            <span class="settings-label-desc">Show the title of the focused window</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsTilingShowFocusedTitle" ${showTitle ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Show Tray Icons</span>
            <span class="settings-label-desc">Display tray icons in the bar</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsTilingShowTray" ${showTray ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
      </div>

      <div class="settings-card" id="sc-tiling-rofi">
        <div class="settings-card-header"><i class="fas fa-search"></i> Rofi Launcher</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Enable Rofi</span>
            <span class="settings-label-desc">Enable the rofi-style app launcher overlay</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsTilingRofiEnabled" ${rofiEnabled ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Max Results</span>
            <span class="settings-label-desc">Maximum number of search results (5–20)</span>
          </div>
          ${rs("settingsTilingRofiMaxResults", rofiMaxResults, 5, 20, 1)}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Overlay Width</span>
            <span class="settings-label-desc">Width of the rofi overlay as a percentage (30–90%)</span>
          </div>
          ${rs("settingsTilingRofiWidth", rofiWidth, 30, 90, 5)}
        </div>
      </div>

      <div class="settings-card" id="sc-tiling-layout">
        <div class="settings-card-header"><i class="fas fa-th-large"></i> Layout</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Inner Gap</span>
            <span class="settings-label-desc">Space between tiled windows (0–20px)</span>
          </div>
          ${rs("settingsTilingInnerGap", innerGap, 0, 20, 1)}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Outer Gap</span>
            <span class="settings-label-desc">Space around the edge of the screen (0–30px)</span>
          </div>
          ${rs("settingsTilingOuterGap", outerGap, 0, 30, 1)}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Default Split Ratio</span>
            <span class="settings-label-desc">Initial split ratio for new windows (0.1–0.9)</span>
          </div>
          ${rs("settingsTilingSplitRatio", splitRatio, 0.1, 0.9, 0.05)}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Resize Increment</span>
            <span class="settings-label-desc">Amount to resize per keypress (0.01–0.2)</span>
          </div>
          ${rs("settingsTilingResizeDelta", resizeDelta, 0.01, 0.2, 0.01)}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Mouse Resize</span>
            <span class="settings-label-desc">Enable resizing tiled windows with the mouse</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsTilingMouseResize" ${mouseResize ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
      </div>

      <div class="settings-card" id="sc-tiling-appearance">
        <div class="settings-card-header"><i class="fas fa-paint-brush"></i> Appearance</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Border Width</span>
            <span class="settings-label-desc">Border width of tiled windows (0–8px)</span>
          </div>
          ${rs("settingsTilingBorderWidth", borderWidth, 0, 8, 1)}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Border Radius</span>
            <span class="settings-label-desc">Corner radius of tiled windows (0–16px)</span>
          </div>
          ${rs("settingsTilingBorderRadius", borderRadius, 0, 16, 1)}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Animation Duration</span>
            <span class="settings-label-desc">Duration of layout transitions (0–500ms)</span>
          </div>
          ${rs("settingsTilingAnimDuration", animDuration, 0, 500, 25)}
        </div>
      </div>

      <div class="settings-card" id="sc-tiling-performance">
        <div class="settings-card-header"><i class="fas fa-tachometer-alt"></i> Performance</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Workspace Switch Delay</span>
            <span class="settings-label-desc">Delay before reapplying layout on workspace switch (100–500ms)</span>
          </div>
          ${rs("settingsTilingWsDelay", wsDelay, 100, 500, 20)}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Resize Debounce</span>
            <span class="settings-label-desc">Debounce period for window resize events (50–300ms)</span>
          </div>
          ${rs("settingsTilingResizeDebounce", resizeDebounce, 50, 300, 10)}
        </div>
      </div>
    </div>
  `;
}

export function bindTilingCategory(win, save, settings) {
  const els = {
    barEnabled: $("#settingsTilingBarEnabled", win),
    barHeight: () => getRangeSliderValue("settingsTilingBarHeight", win),
    showClock: $("#settingsTilingShowClock", win),
    showWorkspace: $("#settingsTilingShowWorkspace", win),
    showTitle: $("#settingsTilingShowFocusedTitle", win),
    showTray: $("#settingsTilingShowTray", win),
    rofiEnabled: $("#settingsTilingRofiEnabled", win),
    rofiMaxResults: () => getRangeSliderValue("settingsTilingRofiMaxResults", win),
    rofiWidth: () => getRangeSliderValue("settingsTilingRofiWidth", win),
    innerGap: () => getRangeSliderValue("settingsTilingInnerGap", win),
    outerGap: () => getRangeSliderValue("settingsTilingOuterGap", win),
    splitRatio: () => getRangeSliderValue("settingsTilingSplitRatio", win),
    resizeDelta: () => getRangeSliderValue("settingsTilingResizeDelta", win),
    mouseResize: $("#settingsTilingMouseResize", win),
    borderWidth: () => getRangeSliderValue("settingsTilingBorderWidth", win),
    borderRadius: () => getRangeSliderValue("settingsTilingBorderRadius", win),
    animDuration: () => getRangeSliderValue("settingsTilingAnimDuration", win),
    wsDelay: () => getRangeSliderValue("settingsTilingWsDelay", win),
    resizeDebounce: () => getRangeSliderValue("settingsTilingResizeDebounce", win)
  };

  const saveTiling = () => {
    os.tiling.updateConfig({
      gaps: {
        inner: Number(els.innerGap()),
        outer: Number(els.outerGap())
      },
      split_ratio: Number(els.splitRatio()),
      border_width: Number(els.borderWidth()),
      border_radius: Number(els.borderRadius()),
      resize_delta: Number(els.resizeDelta()),
      animation_duration: Number(els.animDuration()),
      mouse_resize: els.mouseResize?.checked ?? true,
      workspace_switch_delay: Number(els.wsDelay()),
      resize_debounce: Number(els.resizeDebounce())
    });

    os.storage.set(StorageKeys.tilingBarEnabled, String(!!els.barEnabled?.checked));
    os.storage.set(StorageKeys.tilingBarPosition, getSelectMenuValue("settingsTilingBarPosition", win) || "top");
    os.storage.set(StorageKeys.tilingBarHeight, String(Number(els.barHeight())));
    os.storage.set(StorageKeys.tilingBarShowClock, String(!!els.showClock?.checked));
    os.storage.set(StorageKeys.tilingBarShowWorkspace, String(!!els.showWorkspace?.checked));
    os.storage.set(StorageKeys.tilingBarShowFocusedTitle, String(!!els.showTitle?.checked));
    os.storage.set(StorageKeys.tilingBarShowTray, String(!!els.showTray?.checked));
    os.storage.set(StorageKeys.tilingRofiEnabled, String(!!els.rofiEnabled?.checked));
    os.storage.set(StorageKeys.tilingRofiMaxResults, String(Number(els.rofiMaxResults())));
    os.storage.set(StorageKeys.tilingRofiWidth, String(Number(els.rofiWidth())));

    os.tiling.applyBarSettings();

    os.events.emit(BusEvents.SETTINGS_CHANGED, { tiling: true });
    save();
  };

  const inputs = win.querySelectorAll("#pane-tiling input, #pane-tiling .select-menu, #pane-tiling .range-slider");
  inputs.forEach((el) => {
    bindEvent(el, "change", saveTiling);
    bindEvent(el, "input", saveTiling);
  });
}
