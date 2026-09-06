import { StorageKeys, os } from "../framework.js";
import { resolveIconUrl, resolveYukiAsset } from "../shared/assetResolver.js";
import { createElement, $ } from "../shared/domUtils.js";
import { showDynamicContextMenu } from "../shared/contextMenu.js";
import { showIconPicker } from "../shared/iconPicker.js";
import logoFallback from "../assets/logo.png";

function getFallbackUrl() {
  if (logoFallback) return logoFallback;
  return resolveYukiAsset("static/icons/logo.png");
}

export function getStoredStartIcon() {
  try {
    return os.storage.get(StorageKeys.startButtonIcon) || null;
  } catch {
    return null;
  }
}

function resolveImageUrl(value) {
  if (value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("static/") || value.startsWith("/static/")) return resolveIconUrl(value);
  if (!value.includes("/")) return resolveIconUrl(`static/icons/${value}`);
  return value;
}

export function applyStartButtonIcon() {
  const stored = getStoredStartIcon();
  const btn = $("#start-button");
  const fallbackUrl = getFallbackUrl();
  if (!stored) {
    document.documentElement.style.setProperty("--start-logo-url", `url("${fallbackUrl}")`);
    if (btn) {
      btn.innerHTML = "";
    }
    return;
  }
  const url = resolveImageUrl(stored);
  document.documentElement.style.setProperty("--start-logo-url", `url("${url}")`);
  if (btn) {
    btn.innerHTML = "";
  }
}

export function setStartButtonIcon(iconValue) {
  try {
    os.storage.set(StorageKeys.startButtonIcon, iconValue);
  } catch {}
  applyStartButtonIcon();
}

export function resetStartButtonIcon() {
  try {
    os.storage.remove(StorageKeys.startButtonIcon);
  } catch {}
  applyStartButtonIcon();
}

function triggerFilePicker() {
  const input = createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.display = "none";
  document.body.appendChild(input);
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) {
      input.remove();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setStartButtonIcon(reader.result);
      os.notify.send("Start button updated");
      input.remove();
    };
    reader.readAsDataURL(file);
  });
  input.click();
}

export function showStartButtonContextMenu(e) {
  e.preventDefault();
  showDynamicContextMenu(e, (menu, item, hr) => {
    menu.appendChild(item("Change Start Icon", () => showStartButtonPicker(), "fa-palette"));
    if (getStoredStartIcon()) {
      menu.appendChild(item("Reset to Default", () => {
        resetStartButtonIcon();
        os.notify.send("Start button reset to default");
      }, "fa-undo"));
    }
    menu.appendChild(hr());
    menu.appendChild(item("Upload Custom Icon", () => triggerFilePicker(), "fa-upload"));
  });
}

export function showStartButtonPicker() {
  if ($("#icon-picker-overlay") || $("#start-button-picker-overlay")) return;
  showIconPicker({
    title: "Customize Start Button",
    initialValue: getStoredStartIcon() || "",
    onConfirm: (value) => {
      if (!value) {
        resetStartButtonIcon();
        os.notify.send("Start button reset to default");
      } else {
        setStartButtonIcon(value);
        os.notify.send("Start button updated");
      }
    }
  });
}
