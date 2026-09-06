import { os, StorageKeys, BusEvents, $, $$, bindEvent, toggleClass, setText, setHTML, createElement } from "../framework.js";
import { getThemeByValue, getCustomThemes, addCustomTheme, getThemeColors } from "../shared/themeEngine.js";
import { buildThemeContract, THEME_EFFECT_OPTIONS, THEME_CONFIG_FONTS, THEME_CONFIG_DENSITIES, sanitizeThemeContract } from "../shared/themeContract.js";
import { applyThemeEffects } from "../shared/themeEffects.js";
import { applyTheme, applyThemeConfig } from "./settingsApply.js";
import { buildControlsForStyle, getHeaderStyle, resolveHeaderStyleId } from "../windowManager/headerStyles.js";
import { renderSelectMenu, bindSelectMenu, getSelectMenuValue } from "../shared/selectMenu.js";
import { renderRangeSlider, bindRangeSlider, getRangeSliderValue } from "../shared/rangeSlider.js";

const EDITABLE_COLOR_KEYS = [
  { key: "brand", label: "Brand" },
  { key: "bg-base", label: "Background Base", advanced: true },
  { key: "bg-elev-1", label: "Background Elevated 1", advanced: true },
  { key: "bg-elev-2", label: "Background Elevated 2", advanced: true },
  { key: "bg-primary", label: "Background Primary" },
  { key: "bg-secondary", label: "Background Secondary" },
  { key: "glass", label: "Glass" },
  { key: "glass-border", label: "Glass Border", advanced: true },
  { key: "text-primary", label: "Text Primary" },
  { key: "text-secondary", label: "Text Secondary" },
  { key: "text-muted", label: "Text Muted", advanced: true },
  { key: "window-bg", label: "Window Background", advanced: true }
];

const WINDOW_PREVIEW_FALLBACKS = {
  brand: "#6b5ce7",
  "bg-primary": "#141420",
  "bg-secondary": "#1a1a2e",
  "bg-elev-1": "#1c1c2b",
  "bg-elev-2": "#242438",
  "text-primary": "#ffffff",
  "text-secondary": "#a0a0b0",
  "text-muted": "#77778a",
  glass: "#ffffff",
  "glass-border": "#2c2c44",
  "window-bg": "#191927",
  "text-on-brand": "#ffffff"
};

function channelToHex(part) {
  const n = Math.max(0, Math.min(255, Math.round(Number(part))));
  return n.toString(16).padStart(2, "0");
}

function parseColorToHex(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) return trimmed.slice(0, 7);
  const rgb = trimmed.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb) return "#" + [rgb[1], rgb[2], rgb[3]].map(channelToHex).join("");
  return null;
}

function colorInputValue(value, fallback) {
  return parseColorToHex(value) || fallback;
}

function humanizeEffectValue(v) {
  const spaced = String(v).replace(/([A-Z])/g, " $1").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function getCurrentWin(win) {
  if (win && win.querySelector) return win;
  return $("#yukiOS-settings");
}

function buildWindowPreviewHTML(colors, title) {
  const c = (k) => colors[k] || WINDOW_PREVIEW_FALLBACKS[k] || "#6b5ce7";
  const t = escapeHtml(title || "Sample Window");
  const styleId = resolveHeaderStyleId();
  const headerStyle = getHeaderStyle(styleId);
  const controls = buildControlsForStyle(styleId);
  const headerClass = headerStyle.headerClass ? ` ${headerStyle.headerClass}` : "";
  return `<div style="border:1px solid ${c("glass-border")};border-radius:12px;overflow:hidden;background:${c("window-bg")};box-shadow:0 12px 32px rgba(0,0,0,0.35);font-family:var(--font-ui);"><div class="window-header tc-preview-header${headerClass}" style="background:${c("bg-elev-1")};border-bottom:1px solid ${c("glass-border")};color:${c("text-primary")};pointer-events:none"><span>${t}</span>${controls}</div><div style="display:flex;height:172px"><div style="width:112px;background:${c("bg-secondary")};border-right:1px solid ${c("glass-border")};padding:10px;display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;background:${c("brand")}22;border:1px solid ${c("brand")}44"><span style="width:14px;height:14px;border-radius:4px;background:${c("brand")};display:inline-block"></span><span style="font-size:11px;color:${c("brand")};font-weight:600">Selected</span></div><div style="display:flex;align-items:center;gap:6px;padding:6px 8px;opacity:0.7"><span style="width:14px;height:14px;border-radius:4px;background:${c("glass-border")};display:inline-block"></span><span style="font-size:11px;color:${c("text-secondary")}">Documents</span></div><div style="display:flex;align-items:center;gap:6px;padding:6px 8px;opacity:0.45"><span style="width:14px;height:14px;border-radius:4px;background:${c("glass-border")};display:inline-block"></span><span style="font-size:11px;color:${c("text-muted")}">Downloads</span></div><div style="margin-top:auto;padding:7px 8px;background:${c("bg-elev-2")};border:1px solid ${c("glass-border")};border-radius:6px;display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:${c("brand")};display:inline-block"></span><span style="font-size:10px;color:${c("text-secondary")}">128 MB used</span></div></div><div style="flex:1;background:${c("bg-primary")};padding:14px;display:flex;flex-direction:column;gap:10px;overflow:hidden"><div style="font-size:14px;font-weight:700;color:${c("text-primary")};line-height:1">Project Notes</div><div style="font-size:11px;line-height:1.5;color:${c("text-secondary")}">This is sample text previewing how the window content will look with this theme. Colors update live.</div><div style="background:${c("glass")};border:1px solid ${c("glass-border")};border-radius:8px;padding:10px;display:flex;align-items:center;gap:10px"><div style="width:30px;height:30px;border-radius:7px;background:${c("brand")};display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px"><i class="fas fa-file"></i></div><div style="flex:1"><div style="font-size:12px;color:${c("text-primary")};font-weight:600">example.txt</div><div style="font-size:10px;color:${c("text-muted")}">2.4 KB • Text • Today</div></div><div style="font-size:10px;color:${c("text-muted")}">12:34</div></div><div style="display:flex;gap:8px;margin-top:auto"><div style="flex:1;height:30px;border-radius:7px;background:${c("brand")};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 2px 10px ${c("brand")}55">Primary Button</div><div style="flex:1;height:30px;border-radius:7px;background:${c("bg-elev-2")};border:1px solid ${c("glass-border")};color:${c("text-primary")};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500">Secondary</div></div></div></div><div style="height:26px;background:${c("bg-elev-1")};border-top:1px solid ${c("glass-border")};display:flex;align-items:center;justify-content:space-between;padding:0 10px;font-size:10px;color:${c("text-muted")}"><span>3 items • 12 MB</span><span style="display:flex;gap:4px"><span style="width:16px;height:16px;border-radius:4px;background:${c("glass-border")};display:inline-block"></span><span style="width:16px;height:16px;border-radius:4px;background:${c("brand")};display:inline-block"></span></span></div></div>`;
}

export function refreshCustomThemesUI(win) {
  const target = getCurrentWin(win);
  if (!target) return;
  const grid = $("#settingsCustomGrid", target);
  if (grid) {
    const customs = getCustomThemes();
    const cur = os.storage.get(StorageKeys.theme) || "";
    if (customs.length === 0) {
      setHTML(grid, '<span style="grid-column:1/-1;color:var(--text-secondary);font-size:12px;text-align:center;padding:8px;">No custom themes yet. Click "Create Theme" to make one</span>');
    } else {
      setHTML(grid, customs.map(t => `<button class="settings-btn theme-preview-btn ${cur===t.value?"active":""}" data-theme-val="${t.value}" data-custom-theme="${t.value}" style="height:56px;background:${t.preview||"linear-gradient(135deg,#6b5ce7,#312e81)"};color:${t.textColor||"#fff"};"><span>${t.label}</span></button>`).join(""));
      $$("[data-theme-val]", grid).forEach(btn => {
        bindEvent(btn, "click", () => {
          const val = btn.dataset.themeVal;
          os.storage.set(StorageKeys.theme, val);
          applyTheme(val, () => os.storage.get(StorageKeys.customColors));
          $$(".theme-preview-btn", target).forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          os.notify.send("Themes", `Theme: ${val}`);
          os.events.emit(BusEvents.SETTINGS_CHANGED, { key: "theme", value: val });
        });
      });
    }
  }
  const list = $("#settingsCustomThemesList", target);
  if (list) {
    const customs = getCustomThemes();
    if (customs.length === 0) {
      setHTML(list, "");
      list.style.display = "none";
    } else {
      list.style.display = "";
      setHTML(list, customs.map(t => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--glass-border);"><span style="flex:1;font-size:13px;color:var(--text-primary);">${escapeHtml(t.label)}</span><button class="settings-btn" data-edit="${t.value}" style="padding:4px 8px;font-size:12px;">Edit</button><button class="settings-btn" data-export="${t.value}" style="padding:4px 8px;font-size:12px;">Export</button><button class="settings-btn" data-remove="${t.value}" style="padding:4px 8px;font-size:12px;color:var(--error);">Remove</button></div>`).join(""));
      $$("[data-edit]", list).forEach(btn => bindEvent(btn, "click", () => editTheme(btn.dataset.edit, target)));
      $$("[data-export]", list).forEach(btn => bindEvent(btn, "click", () => exportTheme(btn.dataset.export)));
      $$("[data-remove]", list).forEach(btn => bindEvent(btn, "click", () => removeTheme(btn.dataset.remove, target)));
    }
  }
}

export function exportTheme(themeValue) {
  const theme = getThemeByValue(themeValue);
  if (!theme) {
    os.dialog.alert("Themes", "Theme not found");
    return;
  }
  let contract;
  try {
    contract = buildThemeContract({
      name: theme.label,
      description: theme.description || "",
      author: theme.author || "",
      icon: theme.icon || "fas fa-palette",
      colors: theme.colors || {},
      effects: theme.effects || {},
      config: theme.config || {}
    });
  } catch (e) {
    os.dialog.alert("Themes", String(e.message || e));
    return;
  }
  const blob = new Blob([JSON.stringify(contract, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = createElement("a", { attributes: { href: url, download: theme.label + ".yukiotheme" } });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  os.notify.send("Themes", `Exported "${theme.label}"`);
}

export async function removeTheme(themeValue, win) {
  const theme = getThemeByValue(themeValue);
  if (!theme) return;
  const ok = await os.dialog.confirm("Remove Theme", `Delete "${theme.label}" permanently?`);
  if (!ok) return;
  let themes = os.storage.get(StorageKeys.customThemes);
  if (!Array.isArray(themes)) themes = getCustomThemes();
  const remaining = themes.filter(t => String(t.value) !== String(themeValue));
  os.storage.set(StorageKeys.customThemes, remaining);
  if (os.storage.get(StorageKeys.theme) === themeValue) {
    os.storage.set(StorageKeys.theme, "dark");
    applyTheme("dark", () => os.storage.get(StorageKeys.customColors));
  }
  os.notify.send("Themes", `Removed "${theme.label}"`);
  os.events.emit(BusEvents.SETTINGS_CHANGED, { key: "theme", value: os.storage.get(StorageKeys.theme) });
  const target = getCurrentWin(win);
  if (target) refreshCustomThemesUI(target);
}

export function editTheme(themeValue, win) {
  const theme = getThemeByValue(themeValue);
  if (!theme) {
    os.dialog.alert("Themes", "Theme not found");
    return;
  }
  const target = getCurrentWin(win);
  openThemeCreator(target, {
    name: theme.label,
    author: theme.author || "",
    description: theme.description || "",
    colors: { ...(theme.colors || {}) },
    effects: { ...(theme.effects || {}) },
    config: { ...(theme.config || {}) }
  });
}

export function openThemeCreator(win, prefill) {
  const settingsWin = getCurrentWin(win);
  let initial = { name: "", author: "", description: "", colors: {}, effects: {}, config: {} };
  if (typeof prefill === "string") {
    const t = getThemeByValue(prefill);
    if (t) initial = { name: t.label, author: t.author || "", description: t.description || "", colors: { ...(t.colors || {}) }, effects: { ...(t.effects || {}) }, config: { ...(t.config || {}) } };
  } else if (prefill && typeof prefill === "object" && prefill.colors) {
    initial = {
      name: prefill.name || "",
      author: prefill.author || "",
      description: prefill.description || "",
      colors: { ...(prefill.colors || {}) },
      effects: { ...(prefill.effects || {}) },
      config: { ...(prefill.config || {}) }
    };
  }
  if (!initial.colors || Object.keys(initial.colors).length === 0) {
    const cur = os.storage.get(StorageKeys.theme);
    const curColors = getThemeColors(cur);
    if (curColors) initial.colors = { ...curColors };
  }
  const existing = document.getElementById("theme-creator");
  if (existing) os.window.close(existing);
  const title = initial.name ? `Edit Theme` : "Create Theme";
  const windowWidth = Math.min(860, Math.floor(window.innerWidth * 0.94));
  const windowHeight = Math.min(560, Math.floor(window.innerHeight * 0.82));
  const creatorWin = os.window.create("theme-creator", title, `${windowWidth}px`, `${windowHeight}px`, { icon: "fas fa-palette", appId: "settingsApp" });
  const stateColors = { ...initial.colors };
  let selectedDensity = initial.config.density || "";
  const previewHTML = buildWindowPreviewHTML(stateColors, initial.name || "Sample Window");
  creatorWin.innerHTML = `<div class="theme-creator-root" style="display:flex;flex-direction:column;height:100%;background:var(--bg-secondary);overflow:hidden"><div style="flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:16px"><div id="tc-preview-wrap" style="position:sticky;top:0;z-index:2;background:var(--bg-secondary);padding-bottom:8px">${previewHTML}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div style="display:flex;flex-direction:column;gap:6px"><label style="font-size:12px;color:var(--text-secondary);font-weight:500">Theme name</label><input id="tc-name" placeholder="My Awesome Theme" value="${escapeHtml(initial.name)}" style="padding:9px 10px;border:1px solid var(--glass-border);border-radius:8px;background:var(--bg-primary);color:var(--text-primary);font-size:13px"/></div><div style="display:flex;flex-direction:column;gap:6px"><label style="font-size:12px;color:var(--text-secondary);font-weight:500">Author</label><input id="tc-author" placeholder="Optional" value="${escapeHtml(initial.author)}" style="padding:9px 10px;border:1px solid var(--glass-border);border-radius:8px;background:var(--bg-primary);color:var(--text-primary);font-size:13px"/></div></div><div style="display:flex;flex-direction:column;gap:6px"><label style="font-size:12px;color:var(--text-secondary);font-weight:500">Description</label><textarea id="tc-desc" placeholder="Short description (optional)" style="padding:9px 10px;border:1px solid var(--glass-border);border-radius:8px;background:var(--bg-primary);color:var(--text-primary);min-height:56px;resize:vertical;font-size:13px">${escapeHtml(initial.description)}</textarea></div><div style="font-size:12px;color:var(--text-secondary);font-weight:600;letter-spacing:0.02em;text-transform:uppercase">Colors</div><div id="tc-color-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${EDITABLE_COLOR_KEYS.filter(k=>!k.advanced).map(({key,label})=>`<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--glass-border);border-radius:8px;background:var(--bg-primary)"><input type="color" data-color-key="${key}" value="${colorInputValue(stateColors[key], WINDOW_PREVIEW_FALLBACKS[key]||"#6b5ce7")}" style="width:34px;height:26px;padding:0;border:none;border-radius:6px;cursor:pointer"/><span style="font-size:12px;color:var(--text-primary);font-weight:500">${label}</span></div>`).join("")}</div><button class="settings-btn" id="tc-advanced-toggle" style="align-self:flex-start;display:flex;align-items:center;gap:6px"><i class="fas fa-chevron-down" id="tc-adv-icon" style="font-size:10px"></i> Advanced</button><div id="tc-advanced" style="display:none;flex-direction:column;gap:14px"><div style="font-size:12px;color:var(--text-secondary);font-weight:600;letter-spacing:0.02em;text-transform:uppercase">More Colors</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${EDITABLE_COLOR_KEYS.filter(k=>k.advanced).map(({key,label})=>`<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--glass-border);border-radius:8px;background:var(--bg-primary)"><input type="color" data-color-key="${key}" value="${colorInputValue(stateColors[key], WINDOW_PREVIEW_FALLBACKS[key]||"#6b5ce7")}" style="width:34px;height:26px;padding:0;border:none;border-radius:6px;cursor:pointer"/><span style="font-size:12px;color:var(--text-primary);font-weight:500">${label}</span></div>`).join("")}</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px"><div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:11px;color:var(--text-secondary)">Open animation</label>${renderSelectMenu("tc-open", [{value:"",label:"Default"}, ...THEME_EFFECT_OPTIONS.open.map(o=>({value:o,label:humanizeEffectValue(o)}))], initial.effects.windowAnimation||"")}</div><div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:11px;color:var(--text-secondary)">Close animation</label>${renderSelectMenu("tc-close-sel", [{value:"",label:"Default"}, ...THEME_EFFECT_OPTIONS.close.map(o=>({value:o,label:humanizeEffectValue(o)}))], initial.effects.closeAnimation||"")}</div><div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:11px;color:var(--text-secondary)">Minimize</label>${renderSelectMenu("tc-minimize", [{value:"",label:"Default"}, ...THEME_EFFECT_OPTIONS.minimize.map(o=>({value:o,label:humanizeEffectValue(o)}))], initial.effects.minimizeAnimation||"")}</div><div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:11px;color:var(--text-secondary)">Restore</label>${renderSelectMenu("tc-restore", [{value:"",label:"Default"}, ...THEME_EFFECT_OPTIONS.restore.map(o=>({value:o,label:humanizeEffectValue(o)}))], initial.effects.restoreAnimation||"")}</div></div><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:13px;color:var(--text-primary);font-weight:500">Disable cursor effect</span><span style="font-size:11px;color:var(--text-secondary)">Turn off the custom cursor animation</span></div><label class="settings-toggle"><input type="checkbox" id="tc-cursorOff" ${initial.effects.cursorOff?"checked":""}/><span class="settings-track"><span class="settings-thumb"></span></span></label></div><div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:11px;color:var(--text-secondary)">Custom background</label><input id="tc-bg" placeholder="e.g. #1a1a2e or linear-gradient(...)" value="${escapeHtml(initial.effects.background||"")}" style="padding:8px;border:1px solid var(--glass-border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:12px"/></div><div style="font-size:12px;color:var(--text-secondary);font-weight:600;letter-spacing:0.02em;text-transform:uppercase">Config</div><div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:11px;color:var(--text-secondary)">Font</label>${renderSelectMenu("tc-font", [{value:"",label:"Default"}, ...THEME_CONFIG_FONTS.map(f=>({value:f,label:f}))], initial.config.fontFamily||"")}</div><div style="display:flex;flex-direction:column;gap:6px"><label style="font-size:11px;color:var(--text-secondary)">Density</label><div style="display:flex;gap:8px" id="tc-density-row">${THEME_CONFIG_DENSITIES.map(d=>`<button class="settings-btn ${initial.config.density===d?"active":""}" data-density="${d}" style="flex:1;padding:7px;font-size:12px">${d}</button>`).join("")}</div></div><div style="display:flex;flex-direction:column;gap:6px"><label style="font-size:11px;color:var(--text-secondary)">Window transparency</label><div style="display:flex;align-items:center;gap:10px">${renderRangeSlider("tc-transparency", 20, 100, 1, initial.config.windowTransparency||90)}<span id="tc-transparency-val" style="font-size:12px;color:var(--text-secondary);min-width:36px;text-align:right">${initial.config.windowTransparency||90}%</span></div></div></div></div><div style="padding:12px 16px;border-top:1px solid var(--glass-border);display:flex;justify-content:flex-end;gap:8px;background:var(--bg-primary);flex-shrink:0"><button class="settings-btn" id="tc-cancel">Cancel</button><button class="settings-btn" id="tc-create" style="background:var(--brand);color:var(--text-on-brand);border:none;min-width:120px"><i class="fas fa-check"></i> ${initial.name ? "Save" : "Create"} Theme</button></div></div>`;
  bindSelectMenu(creatorWin);
  bindRangeSlider(creatorWin);
  const nameInput = $("#tc-name", creatorWin);
  const previewWrap = $("#tc-preview-wrap", creatorWin);
  function rerenderPreview() {
    const titleVal = nameInput ? nameInput.value.trim() : "";
    setHTML(previewWrap, buildWindowPreviewHTML(stateColors, titleVal || "Sample Window"));
  }
  if (nameInput) bindEvent(nameInput, "input", rerenderPreview);
  const onSettingsChanged = () => rerenderPreview();
  os.events.on(BusEvents.SETTINGS_CHANGED, onSettingsChanged);
  creatorWin.addEventListener("remove", () => os.events.off(BusEvents.SETTINGS_CHANGED, onSettingsChanged));
  const colorInputs = $$("[data-color-key]", creatorWin);
  colorInputs.forEach(inp => {
    bindEvent(inp, "input", () => {
      stateColors[inp.dataset.colorKey] = inp.value;
      rerenderPreview();
    });
  });
  const advToggle = $("#tc-advanced-toggle", creatorWin);
  const advPanel = $("#tc-advanced", creatorWin);
  const advIcon = $("#tc-adv-icon", creatorWin);
  if (advToggle && advPanel) {
    bindEvent(advToggle, "click", () => {
      const hidden = advPanel.style.display === "none";
      advPanel.style.display = hidden ? "flex" : "none";
      if (advIcon) advIcon.className = hidden ? "fas fa-chevron-up" : "fas fa-chevron-down";
    });
  }
  const densityRow = $("#tc-density-row", creatorWin);
  if (densityRow) {
    $$("[data-density]", densityRow).forEach(btn => {
      bindEvent(btn, "click", () => {
        selectedDensity = btn.dataset.density;
        $$("[data-density]", densityRow).forEach(b => toggleClass(b, "active", b===btn));
      });
    });
  }
  const transVal = $("#tc-transparency-val", creatorWin);
  const transSlider = $("#tc-transparency", creatorWin);
  if (transSlider && transVal) {
    bindEvent(transSlider, "input", () => setText(transVal, getRangeSliderValue("tc-transparency", creatorWin) + "%"));
  }
  const closeWin = () => os.window.close(creatorWin);
  const cancelBtn = $("#tc-cancel", creatorWin);
  if (cancelBtn) bindEvent(cancelBtn, "click", closeWin);
  const createBtn = $("#tc-create", creatorWin);
  if (createBtn) bindEvent(createBtn, "click", () => {
    const name = $("#tc-name", creatorWin).value.trim();
    if (!name) { os.dialog.alert("Themes", "Give your theme a name first."); return; }
    const author = $("#tc-author", creatorWin).value.trim();
    const description = $("#tc-desc", creatorWin).value.trim();
    const colors = {};
    $$("[data-color-key]", creatorWin).forEach(inp => { colors[inp.dataset.colorKey] = inp.value; });
    const effects = {};
    const openVal = getSelectMenuValue("tc-open", creatorWin);
    const closeVal = getSelectMenuValue("tc-close-sel", creatorWin);
    const minimizeVal = getSelectMenuValue("tc-minimize", creatorWin);
    const restoreVal = getSelectMenuValue("tc-restore", creatorWin);
    if (openVal) effects.windowAnimation = openVal;
    if (closeVal) effects.closeAnimation = closeVal;
    if (minimizeVal) effects.minimizeAnimation = minimizeVal;
    if (restoreVal) effects.restoreAnimation = restoreVal;
    const cursorOffEl = $("#tc-cursorOff", creatorWin);
    if (cursorOffEl && cursorOffEl.checked) effects.cursorOff = true;
    const bg = $("#tc-bg", creatorWin).value.trim();
    if (bg) effects.background = bg;
    const config = {};
    const fontVal = getSelectMenuValue("tc-font", creatorWin);
    if (fontVal) config.fontFamily = fontVal;
    if (selectedDensity) config.density = selectedDensity;
    const transRaw = String(getRangeSliderValue("tc-transparency", creatorWin));
    const transNum = Number(transRaw);
    if (Number.isFinite(transNum)) config.windowTransparency = Math.round(transNum);
    let contract;
    try {
      contract = buildThemeContract({ name, description, author, icon: "fas fa-palette", colors, effects, config });
    } catch (err) {
      os.dialog.alert("Themes", String(err.message || err));
      return;
    }
    const data = { value: contract.name.toLowerCase().replace(/[^a-z0-9-]/g, "-") + "-" + Math.random().toString(36).slice(2,6), label: contract.name, icon: contract.icon, colors: contract.colors, description: contract.description, author: contract.author, effects: contract.effects, config: contract.config };
    try {
      addCustomTheme({ value: data.value, label: data.label, icon: data.icon, colors: data.colors, description: data.description, author: data.author, effects: data.effects, config: data.config });
    } catch (err) {
      os.dialog.alert("Themes", String(err.message || err));
      return;
    }
    os.storage.set(StorageKeys.theme, data.value);
    applyTheme(data.value, () => os.storage.get(StorageKeys.customColors));
    if (Object.keys(contract.effects).length > 0) applyThemeEffects(contract.effects);
    if (Object.keys(contract.config).length > 0) applyThemeConfig(contract.config);
    os.notify.send("Themes", `Created "${contract.name}"`);
    os.events.emit(BusEvents.SETTINGS_CHANGED, { key: "theme", value: data.value });
    if (settingsWin) refreshCustomThemesUI(settingsWin);
    closeWin();
  });
}
