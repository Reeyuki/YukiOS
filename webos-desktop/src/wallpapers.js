import { FileKind } from "./fs.js";
import { SystemUtilities } from "./system.js";
import { videos } from "./wallpaperList.js";

function toBlobUrl(src) {
  if (!src || !src.startsWith("data:")) return src;
  const [header, base64] = src.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] ?? "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

function getThumbnailUrl(src) {
  const match = src.match(/\/media\/(\d+)\/(.*?)(?:\.\d+x\d+)?\.mp4$/);
  if (match) return `https://motionbgs.com/i/c/364x205/media/${match[1]}/${match[2]}.jpg`;
  return null;
}

export async function renderWallpapersPage(explorerInstance, view) {
  const fs = explorerInstance.fs;
  const wm = explorerInstance.wm;

  view.innerHTML = "";
  view.classList.add("wallpapers-page");

  const header = document.createElement("div");
  header.className = "wp-header";
  header.innerHTML = `
    <div class="wp-title">Wallpapers</div>
    <button class="wp-random-btn" id="wp-try-random">
      <span class="wp-btn-icon">✦</span>
      Try Random Wallpaper
    </button>
  `;
  view.appendChild(header);

  const previewZone = document.createElement("div");
  previewZone.className = "wp-preview-zone";
  view.appendChild(previewZone);

  const grid = document.createElement("div");
  grid.className = "wp-grid";
  view.appendChild(grid);

  await refreshWallpaperGrid(fs, grid, wm, previewZone);

  header.querySelector("#wp-try-random").onclick = () => showRandomPreview(explorerInstance, previewZone, grid, fs, wm);
}

async function refreshWallpaperGrid(fs, grid, wm, previewZone) {
  grid.innerHTML = "";

  const folder = await fs.getFolder(["Pictures", "Wallpapers"]);

  for (const [name, data] of Object.entries(folder)) {
    if (data?.type !== "file") continue;
    const isVideo = data.kind === FileKind.VIDEO;
    const src = data.content;
    const thumbUrl = isVideo ? getThumbnailUrl(src) : null;

    const card = document.createElement("div");
    card.className = "wp-card";
    card.title = name;

    const thumbEl = document.createElement("div");
    thumbEl.className = "wp-thumb" + (isVideo ? " wp-thumb-video" : "");

    if (isVideo) {
      if (thumbUrl) {
        const img = document.createElement("img");
        img.className = "wp-thumb-img";
        img.src = thumbUrl;
        img.onerror = () => img.remove();
        thumbEl.appendChild(img);
      }
      const badge = document.createElement("div");
      badge.className = "wp-play-badge";
      badge.textContent = "▶";
      thumbEl.appendChild(badge);
    } else {
      thumbEl.style.backgroundImage = `url('${data.icon || data.content}')`;
    }

    const nameEl = document.createElement("div");
    nameEl.className = "wp-card-name";
    nameEl.textContent = name;

    const actions = document.createElement("div");
    actions.className = "wp-card-actions";

    const setBtn = document.createElement("button");
    setBtn.className = "wp-card-btn wp-set-btn";
    setBtn.textContent = "Set";
    setBtn.onclick = async (e) => {
      e.stopPropagation();
      const content = await fs.getFileContent(["Pictures", "Wallpapers"], name);
      await SystemUtilities.setWallpaper(toBlobUrl(content));
      wm.showPopup(`Wallpaper set to "${name}"`);
    };

    actions.appendChild(setBtn);

    card.appendChild(thumbEl);
    card.appendChild(nameEl);
    card.appendChild(actions);

card.addEventListener("click", async (e) => {
  if (e.target === setBtn) return;
  const content = await fs.getFileContent(["Pictures", "Wallpapers"], name);
  showCardPreview(name, toBlobUrl(content), isVideo, previewZone, fs, wm);
});

    grid.appendChild(card);
  }
}
function showCardPreview(name, src, isVideo, previewZone, fs, wm) {
  previewZone.classList.add("wp-preview-active");
  previewZone.innerHTML = "";

  const inner = document.createElement("div");
  inner.className = "wp-preview-inner";

  const media = isVideo ? document.createElement("video") : document.createElement("img");
  media.className = "wp-preview-media";
  media.src = src || "";

  if (isVideo) {
    media.autoplay = true;
    media.loop = true;
    media.muted = true;
    media.playsInline = true;
  }

  const overlay = document.createElement("div");
  overlay.className = "wp-preview-overlay";
  overlay.innerHTML = `
    <div class="wp-preview-label">${name}</div>
  `;

  inner.appendChild(media);
  inner.appendChild(overlay);
  previewZone.appendChild(inner);
}

function showRandomPreview(explorerInstance, previewZone, grid, fs, wm) {
  const src = videos[Math.floor(Math.random() * videos.length)];
  const isVideo = src.endsWith(".mp4");

  previewZone.classList.add("wp-preview-active");
  previewZone.innerHTML = "";

  const inner = document.createElement("div");
  inner.className = "wp-preview-inner";

  const media = isVideo ? document.createElement("video") : document.createElement("img");
  media.className = "wp-preview-media";
  media.src = src;
  if (isVideo) {
    media.autoplay = true;
    media.loop = true;
    media.muted = true;
    media.playsInline = true;
  }

  const overlay = document.createElement("div");
  overlay.className = "wp-preview-overlay";
  overlay.innerHTML = `
    <div class="wp-preview-label">Random Wallpaper Preview</div>
    <div class="wp-preview-btns">
      <button class="wp-action-btn wp-discard-btn">✕ Discard</button>
      <button class="wp-action-btn wp-another-btn">↻ Another</button>
      <button class="wp-action-btn wp-save-btn">✓ Set Wallpaper</button>
    </div>
  `;

  overlay.querySelector(".wp-discard-btn").onclick = () => {
    previewZone.classList.remove("wp-preview-active");
    previewZone.innerHTML = "";
  };

  overlay.querySelector(".wp-another-btn").onclick = () =>
    showRandomPreview(explorerInstance, previewZone, grid, fs, wm);

  overlay.querySelector(".wp-save-btn").onclick = async () => {
    await SystemUtilities.setWallpaper(src);

    const urlParts = src.split("/");
    const rawName = urlParts[urlParts.length - 1]
      .replace(/\.\d+x\d+\.mp4$/, "")
      .replace(/\.mp4$/, "")
      .replace(/-/g, " ")
      .slice(0, 32)
      .trim();
    const ext = isVideo ? ".mp4" : ".webp";
    const fileName = rawName + ext;

    await fs.ensureFolder(["Pictures", "Wallpapers"]);
    await fs.createFile(
      ["Pictures", "Wallpapers"],
      fileName,
      src,
      isVideo ? FileKind.VIDEO : FileKind.IMAGE,
      isVideo ? "/static/icons/file.webp" : src
    );

    wm.showPopup(`Saved as "${fileName}"`);
    previewZone.classList.remove("wp-preview-active");
    previewZone.innerHTML = "";
    await refreshWallpaperGrid(fs, grid, wm, previewZone);
  };

  inner.appendChild(media);
  inner.appendChild(overlay);
  previewZone.appendChild(inner);
}