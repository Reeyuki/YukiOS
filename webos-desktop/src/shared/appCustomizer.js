import { StorageKeys, os } from "../framework.js";
import { showIconPicker } from "./iconPicker.js";
import { resolveIconUrl, resolveYukiAsset } from "./assetResolver.js";
import { createElement, $ } from "./domUtils.js";

function getCustomIcons() {
  try {
    return os.storage.get(StorageKeys.appCustomIcons) || {};
  } catch {
    return {};
  }
}

function getCustomTitles() {
  try {
    return os.storage.get(StorageKeys.appCustomTitles) || {};
  } catch {
    return {};
  }
}

export function getAppCustomIcon(appId) {
  const icons = getCustomIcons();
  return icons[appId] || null;
}

export function getAppCustomTitle(appId) {
  const titles = getCustomTitles();
  return titles[appId] || null;
}

export function setAppCustomIcon(appId, iconValue) {
  const icons = getCustomIcons();
  if (iconValue === null || iconValue === undefined || iconValue === "") {
    delete icons[appId];
  } else {
    icons[appId] = iconValue;
  }
  try {
    os.storage.set(StorageKeys.appCustomIcons, icons);
  } catch {}
}

export function setAppCustomTitle(appId, title) {
  const titles = getCustomTitles();
  if (title === null || title === undefined || title === "") {
    delete titles[appId];
  } else {
    titles[appId] = title;
  }
  try {
    os.storage.set(StorageKeys.appCustomTitles, titles);
  } catch {}
}

export function clearAppCustomization(appId) {
  setAppCustomIcon(appId, null);
  setAppCustomTitle(appId, null);
  patchAppDom(appId, null, null);
  try {
    os.events.emit("appCustomizationChanged", { appId });
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("app-custom-changed", { detail: { appId } }));
  } catch {}
}

export function resolveAppIcon(appId, fallbackIcon) {
  const custom = getAppCustomIcon(appId);
  return custom || fallbackIcon;
}

export function applyAppCustomizations() {
  const icons = getCustomIcons();
  const titles = getCustomTitles();
  const appIds = new Set([...Object.keys(icons), ...Object.keys(titles)]);
  appIds.forEach((appId) => {
    patchAppDom(appId, icons[appId] || null, titles[appId] || null);
  });
}

function resolveImageUrl(value) {
  if (!value) return "";
  if (value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("static/") || value.startsWith("/static/")) return resolveIconUrl(value);
  if (!value.includes("/")) return resolveYukiAsset(`static/icons/${value}`);
  return value;
}

function patchAppDom(appId, iconValue, titleValue) {
  const resolvedIcon = iconValue ? resolveImageUrl(iconValue) : null;
  document.querySelectorAll(`[data-app="${CSS.escape(appId)}"]`).forEach((el) => {
    if (resolvedIcon) {
      const img = el.querySelector("img");
      if (img) {
        img.src = resolvedIcon;
      } else {
        const i = el.querySelector("i");
        if (i) {
          const newImg = createElement("img");
          newImg.src = resolvedIcon;
          newImg.alt = "";
          i.replaceWith(newImg);
        }
      }
    } else if (iconValue === null) {
    }
    if (titleValue !== null && titleValue !== undefined) {
      const titleEl = el.querySelector(".app-title") || el.querySelector("div:last-child") || el.querySelector("span");
      if (titleEl && titleEl.textContent !== undefined) {
        const isTitleEl = titleEl.classList && titleEl.classList.contains("app-title");
        if (isTitleEl) titleEl.textContent = titleValue;
        else if (el.dataset.app && titleEl.textContent.trim().length < 100) {
          const maybeTitle = el.querySelector("div:last-child");
          if (maybeTitle) maybeTitle.textContent = titleValue;
        }
      }
      const labelDiv = el.querySelector("div:last-child");
      if (labelDiv && !el.querySelector(".app-title")) {
        labelDiv.textContent = titleValue;
      }
    }
  });
  document.querySelectorAll(`.start-menu-item[data-app="${CSS.escape(appId)}"] .app-title`).forEach((el) => {
    if (titleValue) el.textContent = titleValue;
  });
  document.querySelectorAll(`.start-menu-item[data-app="${CSS.escape(appId)}"] img`).forEach((img) => {
    if (resolvedIcon) img.src = resolvedIcon;
  });
}

export function showAppCustomizer(appId, currentTitle, currentIcon) {
  if ($("#app-customizer-overlay")) return;
  const existingIcon = getAppCustomIcon(appId);
  const existingTitle = getAppCustomTitle(appId);
  const initialTitle = existingTitle || currentTitle || appId;
  let pendingIcon = existingIcon !== null ? existingIcon : null;
  let pickerIcon = existingIcon || "";

  const overlay = createElement("div");
  overlay.id = "app-customizer-overlay";
  overlay.className = "explorer-confirmation-overlay";
  overlay.style.zIndex = "10001";
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) overlay.remove();
  });
  const dialog = createElement("div");
  dialog.className = "start-picker-dialog";
  overlay.appendChild(dialog);

  const header = createElement("div");
  header.className = "start-picker-header";
  header.innerHTML = `<span class="start-picker-title">Customize App</span><button class="start-picker-close" aria-label="Close"><i class="fas fa-times"></i></button>`;
  dialog.appendChild(header);
  const closeBtn = $(".start-picker-close", header);
  closeBtn.addEventListener("click", () => overlay.remove());

  const body = createElement("div");
  body.className = "start-picker-content";
  body.style.padding = "12px";
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "12px";
  body.style.overflowY = "auto";
  dialog.appendChild(body);

  const titleField = createElement("div");
  titleField.style.display = "flex";
  titleField.style.flexDirection = "column";
  titleField.style.gap = "6px";
  const titleLabel = createElement("label");
  titleLabel.textContent = "App Title";
  titleLabel.style.fontSize = "12px";
  titleLabel.style.color = "var(--text-secondary)";
  titleLabel.style.fontWeight = "500";
  const titleInput = createElement("input");
  titleInput.type = "text";
  titleInput.value = initialTitle;
  titleInput.placeholder = "Enter app title";
  titleInput.className = "start-picker-search";
  titleField.appendChild(titleLabel);
  titleField.appendChild(titleInput);
  body.appendChild(titleField);

  const iconSection = createElement("div");
  iconSection.style.display = "flex";
  iconSection.style.flexDirection = "column";
  iconSection.style.gap = "8px";
  const iconLabel = createElement("label");
  iconLabel.textContent = "App Icon";
  iconLabel.style.fontSize = "12px";
  iconLabel.style.color = "var(--text-secondary)";
  iconLabel.style.fontWeight = "500";
  iconSection.appendChild(iconLabel);

  const previewWrap = createElement("div");
  previewWrap.className = "start-picker-preview";
  previewWrap.style.borderRadius = "8px";
  const previewBox = createElement("div");
  previewBox.className = "start-picker-preview-box";
  function getPreviewUrl(val) {
    if (val) return resolveImageUrl(val);
    if (currentIcon && (currentIcon.startsWith("data:") || currentIcon.startsWith("http") || currentIcon.startsWith("blob:"))) return currentIcon;
    if (currentIcon && (currentIcon.startsWith("static/") || currentIcon.startsWith("/static/"))) return resolveIconUrl(currentIcon);
    if (currentIcon && !currentIcon.includes("/") && !currentIcon.startsWith("fa")) return resolveYukiAsset(`static/icons/${currentIcon}`);
    return "";
  }
  const initialPreview = pendingIcon ? getPreviewUrl(pendingIcon) : getPreviewUrl(currentIcon);
  if (initialPreview) previewBox.innerHTML = `<img src="${initialPreview}" alt="" />`;
  else previewBox.innerHTML = `<span style="color:var(--text-muted);font-size:11px;">No icon</span>`;
  const previewLabelEl = createElement("span");
  previewLabelEl.className = "start-picker-preview-label";
  previewLabelEl.textContent = "Preview";
  previewWrap.appendChild(previewLabelEl);
  previewWrap.appendChild(previewBox);
  iconSection.appendChild(previewWrap);

  const pickBtn = createElement("button");
  pickBtn.className = "start-picker-btn secondary";
  pickBtn.textContent = "Choose Icon...";
  pickBtn.style.alignSelf = "flex-start";
  pickBtn.addEventListener("click", () => {
    showIconPicker({
      title: "Select Icon",
      initialValue: pickerIcon,
      onConfirm: (value) => {
        pickerIcon = value || "";
        pendingIcon = value;
        if (value) {
          const u = resolveImageUrl(value);
          previewBox.innerHTML = `<img src="${u}" alt="" />`;
        } else {
          const fallback = getPreviewUrl(currentIcon);
          if (fallback) previewBox.innerHTML = `<img src="${fallback}" alt="" />`;
          else previewBox.innerHTML = `<span style="color:var(--text-muted);font-size:11px;">No icon</span>`;
        }
      }
    });
  });
  iconSection.appendChild(pickBtn);
  body.appendChild(iconSection);

  const footer = createElement("div");
  footer.className = "start-picker-footer";
  footer.innerHTML = `<button class="start-picker-btn secondary" data-action="cancel">Cancel</button><button class="start-picker-btn secondary" data-action="reset">Reset</button><button class="start-picker-btn primary" data-action="apply">Apply</button>`;
  dialog.appendChild(footer);
  const cancelBtn = $('[data-action="cancel"]', footer);
  const resetBtn = $('[data-action="reset"]', footer);
  const applyBtn = $('[data-action="apply"]', footer);
  cancelBtn.addEventListener("click", () => overlay.remove());
  resetBtn.addEventListener("click", () => {
    clearAppCustomization(appId);
    os.notify.send("App customization reset");
    overlay.remove();
  });
  applyBtn.addEventListener("click", () => {
    const newTitle = titleInput.value.trim();
    if (newTitle && newTitle !== currentTitle) {
      setAppCustomTitle(appId, newTitle);
    } else if (!newTitle) {
      setAppCustomTitle(appId, null);
    } else if (existingTitle && newTitle === initialTitle) {
    } else if (newTitle !== existingTitle) {
      setAppCustomTitle(appId, newTitle);
    }
    if (pendingIcon !== null) {
      setAppCustomIcon(appId, pendingIcon);
    }
    const finalTitle = getAppCustomTitle(appId) || newTitle || null;
    const finalIcon = getAppCustomIcon(appId);
    patchAppDom(appId, finalIcon, finalTitle);
    try {
      os.events.emit("appCustomizationChanged", { appId });
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent("app-custom-changed", { detail: { appId } }));
    } catch {}
    try {
      window.dispatchEvent(new Event("app-custom-changed"));
    } catch {}
    os.notify.send("App customization saved");
    overlay.remove();
  });
  document.body.appendChild(overlay);
  titleInput.focus();
  titleInput.select();
}
