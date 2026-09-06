import { ICON_REGISTRY } from "../generated/iconRegistry.js";
import { resolveIconUrl, resolveYukiAsset } from "./assetResolver.js";
import { createElement, $ } from "./domUtils.js";

function resolveImageUrl(value) {
  if (!value) return "";
  if (value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("static/") || value.startsWith("/static/")) return resolveIconUrl(value);
  if (!value.includes("/")) return resolveYukiAsset(`static/icons/${value}`);
  return value;
}

function buildPickerPreview(pending) {
  if (!pending) return `<span style="color:var(--text-muted);font-size:12px;">No icon</span>`;
  const url = resolveImageUrl(pending);
  return `<img src="${url}" alt="" />`;
}

export function showIconPicker(options = {}) {
  const { title = "Select Icon", initialValue = "", onConfirm } = options;
  if ($("#icon-picker-overlay")) return;
  let pendingValue = initialValue || "";
  const overlay = createElement("div");
  overlay.id = "icon-picker-overlay";
  overlay.className = "explorer-confirmation-overlay";
  overlay.style.zIndex = "10000";
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) overlay.remove();
  });
  const dialog = createElement("div");
  dialog.className = "start-picker-dialog";
  overlay.appendChild(dialog);

  const header = createElement("div");
  header.className = "start-picker-header";
  header.innerHTML = `<span class="start-picker-title">${title}</span><button class="start-picker-close" aria-label="Close"><i class="fas fa-times"></i></button>`;
  dialog.appendChild(header);
  const closeBtn = $(".start-picker-close", header);
  closeBtn.addEventListener("click", () => overlay.remove());

  const previewWrap = createElement("div");
  previewWrap.className = "start-picker-preview";
  const previewBox = createElement("div");
  previewBox.className = "start-picker-preview-box";
  previewBox.innerHTML = buildPickerPreview(pendingValue);
  const previewLabel = createElement("span");
  previewLabel.className = "start-picker-preview-label";
  previewLabel.textContent = "Preview";
  previewWrap.appendChild(previewLabel);
  previewWrap.appendChild(previewBox);
  dialog.appendChild(previewWrap);

  function updatePreview(value) {
    pendingValue = value;
    previewBox.innerHTML = buildPickerPreview(value);
  }

  const tabs = createElement("div");
  tabs.className = "start-picker-tabs";
  tabs.innerHTML = `<button class="start-picker-tab active" data-tab="yuki">Yuki Icons</button><button class="start-picker-tab" data-tab="upload">Upload</button>`;
  dialog.appendChild(tabs);

  const content = createElement("div");
  content.className = "start-picker-content";
  dialog.appendChild(content);

  const yukiPanel = createElement("div");
  yukiPanel.className = "start-picker-panel active";
  yukiPanel.dataset.panel = "yuki";
  const searchWrap = createElement("div");
  searchWrap.className = "start-picker-search-wrap";
  const searchInput = createElement("input");
  searchInput.className = "start-picker-search";
  searchInput.placeholder = "Search icons...";
  searchInput.type = "text";
  searchWrap.appendChild(searchInput);
  yukiPanel.appendChild(searchWrap);
  const grid = createElement("div");
  grid.className = "start-picker-grid";
  yukiPanel.appendChild(grid);
  content.appendChild(yukiPanel);

  const uploadPanel = createElement("div");
  uploadPanel.className = "start-picker-panel";
  uploadPanel.dataset.panel = "upload";
  const dropZone = createElement("div");
  dropZone.className = "start-picker-upload-zone";
  dropZone.innerHTML = `<i class="fas fa-cloud-upload-alt"></i><span>Click or drop image here</span><span class="start-picker-upload-hint">Supports PNG, JPG, WEBP, GIF</span>`;
  const fileInput = createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  const uploadPreview = createElement("div");
  uploadPreview.className = "start-picker-upload-preview";
  uploadPreview.style.display = "none";
  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (ev) => {
    ev.preventDefault();
    dropZone.classList.remove("dragover");
    const file = ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (file) handleUploadFile(file);
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) handleUploadFile(file);
  });
  function handleUploadFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      updatePreview(dataUrl);
      uploadPreview.style.display = "flex";
      uploadPreview.innerHTML = `<img src="${dataUrl}" alt="" /><span class="start-picker-upload-name">${file.name}</span>`;
      highlightSelection(dataUrl);
    };
    reader.readAsDataURL(file);
  }
  uploadPanel.appendChild(dropZone);
  uploadPanel.appendChild(fileInput);
  uploadPanel.appendChild(uploadPreview);
  content.appendChild(uploadPanel);

  function highlightSelection(value) {
    grid.querySelectorAll(".start-picker-icon").forEach((el) => {
      el.classList.toggle("selected", el.dataset.value === value);
    });
  }

  function renderGrid(filter) {
    grid.innerHTML = "";
    const q = (filter || "").toLowerCase();
    const filtered = q ? ICON_REGISTRY.filter((n) => n.toLowerCase().includes(q)) : ICON_REGISTRY;
    filtered.forEach((name) => {
      const url = resolveYukiAsset(`static/icons/${name}`);
      const item = createElement("div");
      item.className = "start-picker-icon";
      item.dataset.value = name;
      if (pendingValue === name) item.classList.add("selected");
      item.innerHTML = `<img src="${url}" alt="${name}" loading="lazy" />`;
      item.title = name;
      item.addEventListener("click", () => {
        updatePreview(name);
        highlightSelection(name);
      });
      grid.appendChild(item);
    });
    if (!filtered.length) {
      const empty = createElement("div");
      empty.className = "start-picker-empty";
      empty.textContent = "No icons found";
      grid.appendChild(empty);
    }
  }

  renderGrid("");
  searchInput.addEventListener("input", () => renderGrid(searchInput.value));

  const allTabs = tabs.querySelectorAll(".start-picker-tab");
  const allPanels = content.querySelectorAll(".start-picker-panel");
  tabs.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".start-picker-tab");
    if (!btn) return;
    const tab = btn.dataset.tab;
    allTabs.forEach((b) => b.classList.toggle("active", b === btn));
    allPanels.forEach((p) => p.classList.toggle("active", p.dataset.panel === tab));
  });

  const footer = createElement("div");
  footer.className = "start-picker-footer";
  footer.innerHTML = `<button class="start-picker-btn secondary" data-action="cancel">Cancel</button><button class="start-picker-btn secondary" data-action="reset">Reset</button><button class="start-picker-btn primary" data-action="apply">Apply</button>`;
  dialog.appendChild(footer);
  const cancelBtn = $('[data-action="cancel"]', footer);
  const resetBtn = $('[data-action="reset"]', footer);
  const applyBtn = $('[data-action="apply"]', footer);
  cancelBtn.addEventListener("click", () => overlay.remove());
  resetBtn.addEventListener("click", () => {
    overlay.remove();
    if (typeof onConfirm === "function") onConfirm(null);
  });
  applyBtn.addEventListener("click", () => {
    overlay.remove();
    if (typeof onConfirm === "function") onConfirm(pendingValue || null);
  });
  document.body.appendChild(overlay);
}
