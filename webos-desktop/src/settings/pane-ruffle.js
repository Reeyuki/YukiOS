import { os, StorageKeys } from "../framework.js";
import { renderSelectMenu, getSelectMenuValue, setSelectMenuValue, bindSelectMenu } from "../shared/selectMenu.js";
import { loadRuffleConfig, saveRuffleConfig } from "../ruffle/ruffleSettings.js";
import { BusEvents } from "../core/EventBus.js";

export function renderRuffleSettings() {
  const cfg = loadRuffleConfig();
  return `
    <div id="pane-ruffle" class="settings-category-pane">
      <div class="settings-category-header">Ruffle (Flash)</div>

      <div class="settings-card" id="sc-ruffle-display">
        <div class="settings-card-header"><i class="fas fa-display"></i> Display</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Letterbox</span>
            <span class="settings-label-desc">How the stage fits the window</span>
          </div>
          ${renderSelectMenu("settingsRuffleLetterbox", [
            { value: "off", label: "Off stretches to fill" },
            { value: "on", label: "On keeps aspect ratio (default)" },
            { value: "fullscreen", label: "Fullscreen fills viewport" }
          ], cfg.letterbox)}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Scale Mode</span>
            <span class="settings-label-desc">SWF stage scaling</span>
          </div>
          ${renderSelectMenu("settingsRuffleScale", [
            { value: "showAll", label: "Show All" },
            { value: "noBorder", label: "No Border" },
            { value: "exactFit", label: "Exact Fit" },
            { value: "noScale", label: "No Scale" }
          ], cfg.scale)}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Background Color</span>
            <span class="settings-label-desc">Stage background when letterboxed</span>
          </div>
          <input type="color" id="settingsRuffleBg" value="${cfg.backgroundColor}" style="width:44px;height:28px;padding:0;border:1px solid var(--glass-border);border-radius:6px;background:transparent;">
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Splash Screen</span>
            <span class="settings-label-desc">Show Ruffle loading animation</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsRuffleSplash" ${cfg.splashScreen ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
      </div>

      <div class="settings-card" id="sc-ruffle-playback" style="margin-top:16px;">
        <div class="settings-card-header"><i class="fas fa-play"></i> Playback</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Autoplay</span>
            <span class="settings-label-desc">Start SWF without user gesture</span>
          </div>
          ${renderSelectMenu("settingsRuffleAutoplay", [
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
            { value: "auto", label: "Auto" }
          ], cfg.autoplay)}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Unmute Overlay</span>
            <span class="settings-label-desc">Click-to-unmute prompt for audio</span>
          </div>
          ${renderSelectMenu("settingsRuffleUnmuteOverlay", [
            { value: "visible", label: "Visible" },
            { value: "hidden", label: "Hidden" }
          ], cfg.unmuteOverlay)}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Context Menu</span>
            <span class="settings-label-desc">Right-click menu inside player</span>
          </div>
          ${renderSelectMenu("settingsRuffleContextMenu", [
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
            { value: "rightClickOnly", label: "Right-click only" }
          ], cfg.contextMenu)}
        </div>
      </div>

      <div class="settings-card" id="sc-ruffle-compat" style="margin-top:16px;">
        <div class="settings-card-header"><i class="fas fa-shield-halved"></i> Compatibility</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Allow Script Access</span>
            <span class="settings-label-desc">Let SWF call JavaScript</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsRuffleScriptAccess" ${cfg.allowScriptAccess ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
      </div>

      <div class="settings-card" id="sc-ruffle-advanced" style="margin-top:16px;">
        <details>
          <summary class="settings-card-header" style="cursor:pointer;list-style:none;"><i class="fas fa-sliders"></i> Advanced</summary>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:0;">
            <div class="settings-row">
              <div class="settings-label-group">
                <span class="settings-label-title">Max Execution Duration</span>
                <span class="settings-label-desc">Seconds before script timeout</span>
              </div>
              <input type="number" id="settingsRuffleMaxExec" min="1" max="120" step="1" value="${cfg.maxExecutionDuration}" style="width:84px;" class="settings-input">
            </div>
            <div class="settings-row">
              <div class="settings-label-group">
                <span class="settings-label-title">Upgrade to HTTPS</span>
                <span class="settings-label-desc">Rewrite http subrequests to https</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="settingsRuffleUpgradeHttps" ${cfg.upgradeToHttps ? "checked" : ""}/>
                <span class="settings-track"><span class="settings-thumb"></span></span>
              </label>
            </div>
            <div class="settings-row">
              <div class="settings-label-group">
                <span class="settings-label-title">Show SWF Download</span>
                <span class="settings-label-desc">Offer download button on failure</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="settingsRuffleSwfDownload" ${cfg.showSwfDownload ? "checked" : ""}/>
                <span class="settings-track"><span class="settings-thumb"></span></span>
              </label>
            </div>
            <div class="settings-row">
              <div class="settings-label-group">
                <span class="settings-label-title">Warn on Unsupported Content</span>
                <span class="settings-label-desc">Console warning for unimplemented AS APIs</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="settingsRuffleWarnUnsupported" ${cfg.warnOnUnsupportedContent ? "checked" : ""}/>
                <span class="settings-track"><span class="settings-thumb"></span></span>
              </label>
            </div>
            <div class="settings-row">
              <div class="settings-label-group">
                <span class="settings-label-title">Open URL Mode</span>
                <span class="settings-label-desc">How navigateToURL is handled</span>
              </div>
              ${renderSelectMenu("settingsRuffleOpenUrl", [
                { value: "allow", label: "Allow" },
                { value: "confirm", label: "Confirm" },
                { value: "deny", label: "Deny" }
              ], cfg.openUrlMode)}
            </div>
            <div class="settings-row">
              <div class="settings-label-group">
                <span class="settings-label-title">Log Level</span>
                <span class="settings-label-desc">Verbosity inside player console</span>
              </div>
              ${renderSelectMenu("settingsRuffleLogLevel", [
                { value: "error", label: "Error" },
                { value: "warn", label: "Warn" },
                { value: "info", label: "Info" },
                { value: "debug", label: "Debug" },
                { value: "trace", label: "Trace" }
              ], cfg.logLevel)}
            </div>
          </div>
        </details>
      </div>

      <div class="settings-card" style="margin-top:16px;">
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Reset Ruffle Settings</span>
            <span class="settings-label-desc">Restore all Flash options to defaults</span>
          </div>
          <button class="settings-btn" id="settingsRuffleReset"><i class="fas fa-rotate-left"></i> Reset</button>
        </div>
      </div>
    </div>
  `;
}

export function bindRuffleCategory(win) {
  if (!win) return;
  const save = (patch) => {
    saveRuffleConfig(patch);
    os.events.emit(BusEvents.SETTINGS_CHANGED, { key: StorageKeys.ruffleConfig, value: patch });
  };

  win.querySelector("#settingsRuffleLetterbox")?.addEventListener("change", () => save({ letterbox: getSelectMenuValue("settingsRuffleLetterbox", win) }));
  win.querySelector("#settingsRuffleScale")?.addEventListener("change", () => save({ scale: getSelectMenuValue("settingsRuffleScale", win) }));
  win.querySelector("#settingsRuffleAutoplay")?.addEventListener("change", () => save({ autoplay: getSelectMenuValue("settingsRuffleAutoplay", win) }));
  win.querySelector("#settingsRuffleUnmuteOverlay")?.addEventListener("change", () => save({ unmuteOverlay: getSelectMenuValue("settingsRuffleUnmuteOverlay", win) }));
  win.querySelector("#settingsRuffleContextMenu")?.addEventListener("change", () => save({ contextMenu: getSelectMenuValue("settingsRuffleContextMenu", win) }));
  win.querySelector("#settingsRuffleOpenUrl")?.addEventListener("change", () => save({ openUrlMode: getSelectMenuValue("settingsRuffleOpenUrl", win) }));
  win.querySelector("#settingsRuffleLogLevel")?.addEventListener("change", () => save({ logLevel: getSelectMenuValue("settingsRuffleLogLevel", win) }));

  const bg = win.querySelector("#settingsRuffleBg");
  bg?.addEventListener("change", () => save({ backgroundColor: bg.value }));
  bg?.addEventListener("input", () => save({ backgroundColor: bg.value }));

  const splash = win.querySelector("#settingsRuffleSplash");
  splash?.addEventListener("change", () => save({ splashScreen: splash.checked }));

  const scriptAccess = win.querySelector("#settingsRuffleScriptAccess");
  scriptAccess?.addEventListener("change", () => save({ allowScriptAccess: scriptAccess.checked }));

  const upgrade = win.querySelector("#settingsRuffleUpgradeHttps");
  upgrade?.addEventListener("change", () => save({ upgradeToHttps: upgrade.checked }));

  const swfDl = win.querySelector("#settingsRuffleSwfDownload");
  swfDl?.addEventListener("change", () => save({ showSwfDownload: swfDl.checked }));

  const warn = win.querySelector("#settingsRuffleWarnUnsupported");
  warn?.addEventListener("change", () => save({ warnOnUnsupportedContent: warn.checked }));

  const maxExec = win.querySelector("#settingsRuffleMaxExec");
  maxExec?.addEventListener("change", () => {
    const n = Math.max(1, Math.min(120, Number(maxExec.value) || 15));
    maxExec.value = String(n);
    save({ maxExecutionDuration: n });
  });

  win.querySelector("#settingsRuffleReset")?.addEventListener("click", async () => {
    if (!(await os.dialog.confirm("Reset Ruffle Settings", "Restore all Ruffle defaults?"))) return;
    os.storage.remove(StorageKeys.ruffleConfig);
    os.events.emit(BusEvents.SETTINGS_CHANGED, { key: StorageKeys.ruffleConfig, value: null });
    const fresh = loadRuffleConfig();
    setSelectMenuValue(win, "settingsRuffleLetterbox", fresh.letterbox);
    setSelectMenuValue(win, "settingsRuffleScale", fresh.scale);
    setSelectMenuValue(win, "settingsRuffleAutoplay", fresh.autoplay);
    setSelectMenuValue(win, "settingsRuffleUnmuteOverlay", fresh.unmuteOverlay);
    setSelectMenuValue(win, "settingsRuffleContextMenu", fresh.contextMenu);
    setSelectMenuValue(win, "settingsRuffleOpenUrl", fresh.openUrlMode);
    setSelectMenuValue(win, "settingsRuffleLogLevel", fresh.logLevel);
    const bg2 = win.querySelector("#settingsRuffleBg");
    if (bg2) bg2.value = fresh.backgroundColor;
    const ids = ["settingsRuffleSplash", "settingsRuffleScriptAccess", "settingsRuffleUpgradeHttps", "settingsRuffleSwfDownload", "settingsRuffleWarnUnsupported"];
    const vals = [fresh.splashScreen, fresh.allowScriptAccess, fresh.upgradeToHttps, fresh.showSwfDownload, fresh.warnOnUnsupportedContent];
    ids.forEach((id, i) => {
      const el = win.querySelector(`#${id}`);
      if (el) el.checked = vals[i];
    });
    const me = win.querySelector("#settingsRuffleMaxExec");
    if (me) me.value = String(fresh.maxExecutionDuration);
  });
}
