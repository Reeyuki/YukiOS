import { os, StorageKeys, createElement } from "../framework.js";
import { applyTheme } from "../settings/settingsApply.js";
import { buildWindowHeader } from "./windowHeader.js";
import "../styles/customColorsDialog.css";

export const CUSTOM_COLOR_FIELDS = [
  { key: "brand", label: "Brand Color", fallback: "#b4befe" },
  { key: "bg-primary", label: "Background Primary", fallback: "#1e1e2e" },
  { key: "bg-secondary", label: "Background Secondary", fallback: "#313244" },
  { key: "text-primary", label: "Text Primary", fallback: "#cdd6f4" },
  { key: "text-secondary", label: "Text Secondary", fallback: "#a6adc8" },
  { key: "glass", label: "Glass", fallback: "#45475a" }
];

export function getStoredCustomColors() {
  return os.storage.get(StorageKeys.customColors) || null;
}

export function applyCustomColors(colors) {
  os.storage.set(StorageKeys.customColors, colors);
  applyTheme(os.storage.get(StorageKeys.theme) || "dark", () => getStoredCustomColors());
}

export function clearCustomColors() {
  os.storage.remove(StorageKeys.customColors);
  applyTheme(os.storage.get(StorageKeys.theme) || "dark", () => getStoredCustomColors());
}

export function pickCustomColors(colors) {
  const picked = {};
  CUSTOM_COLOR_FIELDS.forEach((field) => {
    picked[field.key] = colors && colors[field.key] ? colors[field.key] : field.fallback;
  });
  return picked;
}

export function openCustomColorsDialog(initialColors = null) {
  const seed = initialColors || getStoredCustomColors() || {};
  const overlay = createElement("div");
  overlay.className = "explorer-confirmation-overlay";
  overlay.style.zIndex = "999999";

  const dialog = createElement("div");
  dialog.className = "overlay-dialog";

  const fieldInputs = CUSTOM_COLOR_FIELDS.map(
    (field) => `
      <div>
        <label style="font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px;">${field.label}</label>
        <input type="color" id="custom-${field.key}" value="${seed[field.key] || field.fallback}" style="width:100%;height:36px;border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;background:var(--glass);">
      </div>
    `
  ).join("");

  dialog.innerHTML = `
    <div class="conflict-header">
      <i class="fas fa-palette conflict-icon"></i>
      <span class="conflict-title">Custom Colors</span>
    </div>
    <div class="conflict-message">Override theme colors manually. Changes apply on top of the selected theme.</div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
      ${fieldInputs}
    </div>
    <div style="margin-bottom: 16px;">
      <label style="font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px;">Preview</label>
      <div id="color-preview" class="custom-colors-preview" style="border-radius:8px;overflow:hidden;border:1px solid var(--glass-border);background:var(--bg-primary);padding:16px;">
        ${buildWindowHeader("Preview Window")}
        <div style="background:var(--glass);border-radius:6px;padding:12px;margin-bottom:8px;">
          <h3 style="margin:0 0 8px 0;font-size:14px;color:var(--text-primary);">Sample Heading</h3>
          <p style="margin:0;font-size:12px;color:var(--text-secondary);line-height:1.5;">This is sample text to preview how your custom colors will look in the interface.</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button style="flex:1;padding:8px;border-radius:6px;border:none;background:var(--brand);color:#fff;font-size:12px;cursor:pointer;">Primary Button</button>
          <button style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--glass-border);background:var(--glass);color:var(--text-primary);font-size:12px;cursor:pointer;">Secondary</button>
        </div>
      </div>
    </div>
    <div class="conflict-actions">
      <button class="conflict-btn conflict-btn-skip" id="custom-colors-reset"><i class="fas fa-undo conflict-btn-icon"></i> Reset to Theme</button>
      <button class="conflict-btn conflict-btn-keep" id="custom-colors-apply"><i class="fas fa-check conflict-btn-icon"></i> Apply</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const previewEl = dialog.querySelector("#color-preview");
  const updatePreview = () => {
    CUSTOM_COLOR_FIELDS.forEach((field) => {
      const value = dialog.querySelector(`#custom-${field.key}`).value;
      previewEl.style.setProperty(`--${field.key}`, value);
    });
    const glass = dialog.querySelector("#custom-glass").value;
    previewEl.style.setProperty("--glass-border", glass + "40");
    previewEl.style.setProperty("--tx1", dialog.querySelector("#custom-text-primary").value);
    previewEl.style.setProperty("--surface-hover", dialog.querySelector("#custom-bg-secondary").value);
    previewEl.style.setProperty("--error", "#e5534b");
    previewEl.style.setProperty("--text-on-brand", "#ffffff");
  };

  updatePreview();

  CUSTOM_COLOR_FIELDS.forEach((field) => {
    dialog.querySelector(`#custom-${field.key}`).addEventListener("input", updatePreview);
  });

  dialog.querySelector("#custom-colors-reset").addEventListener("click", () => {
    clearCustomColors();
    overlay.remove();
  });

  dialog.querySelector("#custom-colors-apply").addEventListener("click", () => {
    const colors = {};
    CUSTOM_COLOR_FIELDS.forEach((field) => {
      colors[field.key] = dialog.querySelector(`#custom-${field.key}`).value;
    });
    applyCustomColors(colors);
    overlay.remove();
  });

  return overlay;
}
