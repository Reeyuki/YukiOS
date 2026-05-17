import { FileKind } from "./fs.js";
import { SystemUtilities } from "./system.js";
import { videos } from "./wallpaperList.js";
import { resolveWallpaperUrl, CDN_BASES } from "./shared/assetResolver.js";

function isBlob(obj) {
  if (!obj) return false;
  return (
    obj instanceof Blob ||
    (typeof obj === "object" &&
      typeof obj.size === "number" &&
      typeof obj.type === "string" &&
      typeof obj.slice === "function")
  );
}

function resolveWallpaperStaticUrl(url) {
  return resolveWallpaperUrl(url);
}

function toBlobUrl(content) {
  if (!content) return null;

  if (isBlob(content)) {
    return URL.createObjectURL(content);
  }
  if (typeof content === "string") {
    if (content.startsWith("http") || content.startsWith("/") || content.startsWith("blob:")) {
      return resolveWallpaperStaticUrl(content);
    }
    if (content.startsWith("data:")) {
      const [header, base64] = content.split(",");
      const mime = header.match(/data:(.*?);/)?.[1] ?? "application/octet-stream";
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: mime }));
    }
  }

  return null;
}

function getThumbnailUrl(src) {
  if (typeof src !== "string") return null;
  const match = src.match(/\/media\/(\d+)\/(.*?)(?:\.\d+x\d+)?\.mp4$/);
  if (match) return `https://motionbgs.com/i/c/364x205/media/${match[1]}/${match[2]}.jpg`;
  return null;
}

export async function renderWallpapersPage(fs, wm, view) {
  view.innerHTML = "";
  view.classList.add("wallpapers-page");

  const header = document.createElement("div");
  header.className = "wp-header";
  header.innerHTML = `
    <div class="wp-title">Wallpapers</div>
    <div style="display:flex;gap:10px;">
      <button class="wp-random-btn" id="wp-try-random">
        <span class="wp-btn-icon">✦</span>
        Try Random Wallpaper
      </button>
      <button class="wp-random-btn" id="wp-reset-login">
        <span class="wp-btn-icon">↺</span>
        Reset Login Wallpaper
      </button>
    </div>
  `;
  view.appendChild(header);

  const previewZone = document.createElement("div");
  previewZone.className = "wp-preview-zone";
  view.appendChild(previewZone);

  const grid = document.createElement("div");
  grid.className = "wp-grid";
  view.appendChild(grid);

  await refreshWallpaperGrid(fs, grid, wm, previewZone);

  header.querySelector("#wp-try-random").onclick = () => showRandomPreview(previewZone, grid, fs, wm);
  header.querySelector("#wp-reset-login").onclick = async () => {
    await SystemUtilities.setLoginWallpaper("none");
    wm.sendNotify("Login wallpaper reset to default");
  };
}

async function refreshWallpaperGrid(fs, grid, wm, previewZone) {
  grid.innerHTML = "";

  const folder = await fs.getFolder(["Pictures", "Wallpapers"]);

  for (const [name, data] of Object.entries(folder)) {
    if (data?.type !== "file") continue;
    const isVideo = data.kind === FileKind.VIDEO;

    const card = document.createElement("div");
    card.className = "wp-card";
    card.title = name;

    const thumbEl = document.createElement("div");
    thumbEl.className = "wp-thumb" + (isVideo ? " wp-thumb-video" : "");

    if (isVideo) {
      const content = await fs.getFileContent(["Pictures", "Wallpapers"], name);
      const contentStr = content instanceof Blob ? null : content;
      const thumbUrl = getThumbnailUrl(contentStr);

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
      let thumbSrc = null;

      if (data.icon === "@content") {
        const content = await fs.getFileContent(["Pictures", "Wallpapers"], name);
        thumbSrc = toBlobUrl(content);
      } else if (data.icon) {
        thumbSrc = resolveWallpaperStaticUrl(data.icon);
      }

      if (thumbSrc) {
        thumbEl.style.backgroundImage = `url('${thumbSrc}')`;
      }
    }

    const nameEl = document.createElement("div");
    nameEl.className = "wp-card-name";
    nameEl.textContent = name;

    const actions = document.createElement("div");
    actions.className = "wp-card-actions";

    const setBtn = document.createElement("button");
    setBtn.className = "wp-card-btn wp-set-btn";
    setBtn.textContent = "Desktop";
    setBtn.onclick = async (e) => {
      e.stopPropagation();
      const content = await fs.getFileContent(["Pictures", "Wallpapers"], name);
      const url = toBlobUrl(content);
      if (content) {
        await SystemUtilities.setWallpaper(content);
        wm.sendNotify(`Desktop wallpaper set to "${name}"`);
      }
    };

    const setLoginBtn = document.createElement("button");
    setLoginBtn.className = "wp-card-btn wp-set-btn";
    setLoginBtn.textContent = "Login";
    setLoginBtn.style.marginLeft = "4px";
    setLoginBtn.onclick = async (e) => {
      e.stopPropagation();
      const content = await fs.getFileContent(["Pictures", "Wallpapers"], name);
      const url = toBlobUrl(content);
      if (content) {
        await SystemUtilities.setLoginWallpaper(content);
        wm.sendNotify(`Login wallpaper set to "${name}"`);
      }
    };

    actions.appendChild(setBtn);
    actions.appendChild(setLoginBtn);

    card.appendChild(thumbEl);
    card.appendChild(nameEl);
    card.appendChild(actions);

    card.addEventListener("click", async (e) => {
      if (e.target === setBtn) return;
      const content = await fs.getFileContent(["Pictures", "Wallpapers"], name);
      const url = toBlobUrl(content);
      if (url) {
        showCardPreview(name, url, isVideo, previewZone, fs, wm);
      }
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
    <div class="wp-preview-btns">
      <button class="wp-action-btn wp-discard-btn">✕ Close</button>
      <button class="wp-action-btn wp-save-login-btn">✔ Set Login</button>
      <button class="wp-action-btn wp-save-btn">✔ Set Desktop</button>
    </div>
  `;

  overlay.querySelector(".wp-discard-btn").onclick = () => {
    previewZone.classList.remove("wp-preview-active");
    previewZone.innerHTML = "";
  };

  overlay.querySelector(".wp-save-btn").onclick = async () => {
    const content = await fs.getFileContent(["Pictures", "Wallpapers"], name);
    const url = toBlobUrl(content);
    if (content) {
      await SystemUtilities.setWallpaper(content);
      wm.sendNotify(`Desktop wallpaper set to "${name}"`);
    }
    previewZone.classList.remove("wp-preview-active");
    previewZone.innerHTML = "";
  };

  overlay.querySelector(".wp-save-login-btn").onclick = async () => {
    const content = await fs.getFileContent(["Pictures", "Wallpapers"], name);
    const url = toBlobUrl(content);
    if (content) {
      await SystemUtilities.setLoginWallpaper(content);
      wm.sendNotify(`Login wallpaper set to "${name}"`);
    }
    previewZone.classList.remove("wp-preview-active");
    previewZone.innerHTML = "";
  };

  inner.appendChild(media);
  inner.appendChild(overlay);
  previewZone.appendChild(inner);
}

function showRandomPreview(previewZone, grid, fs, wm) {
  let selection = (() => {
    const src = videos[Math.floor(Math.random() * videos.length)];
    return {
      src,
      isVideo: typeof src === "string" && src.endsWith(".mp4"),
      fromLibrary: false,
      label: "Random Wallpaper"
    };
  })();

  previewZone.classList.add("wp-preview-active");
  previewZone.innerHTML = "";

  const inner = document.createElement("div");
  inner.className = "wp-preview-inner";

  let media = selection.isVideo ? document.createElement("video") : document.createElement("img");
  media.className = "wp-preview-media";
  media.src = selection.src;

  const setUpVideoEl = (videoEl) => {
    videoEl.autoplay = true;
    videoEl.loop = true;
    videoEl.muted = true;
    videoEl.playsInline = true;
  };

  const pickRandomStaticFromLibrary = async () => {
    try {
      const folder = await fs.getFolder(["Pictures", "Wallpapers"]);
      const candidates = Object.entries(folder)
        .filter(([, data]) => data?.type === "file" && data.kind === FileKind.IMAGE)
        .map(([name]) => name);
      if (!candidates.length) return null;
      const name = candidates[Math.floor(Math.random() * candidates.length)];
      const content = await fs.getFileContent(["Pictures", "Wallpapers"], name);
      const url = toBlobUrl(content);
      if (!url) return null;
      return { name, url };
    } catch {
      return null;
    }
  };

  const fallbackToStatic = async () => {
    if (!selection.isVideo || selection.fromLibrary) return;
    const picked = await pickRandomStaticFromLibrary();
    if (!picked) return;

    selection = { src: picked.url, isVideo: false, fromLibrary: true, label: picked.name };

    const img = document.createElement("img");
    img.className = "wp-preview-media";
    img.src = selection.src;
    media.replaceWith(img);
    media = img;
  };

  if (selection.isVideo) {
    setUpVideoEl(media);
    media.addEventListener("error", fallbackToStatic, { once: true });
    const playAttempt = () => {
      try {
        const p = media.play?.();
        if (p && typeof p.catch === "function") p.catch(fallbackToStatic);
      } catch {
        fallbackToStatic();
      }
    };
    const timeoutId = setTimeout(() => {
      if (media.readyState < 2) fallbackToStatic();
    }, 8000);
    media.addEventListener("playing", () => clearTimeout(timeoutId), { once: true });
    media.addEventListener("loadeddata", () => clearTimeout(timeoutId), { once: true });
    media.addEventListener("canplay", playAttempt, { once: true });
    setTimeout(playAttempt, 0);
  }

  const overlay = document.createElement("div");
  overlay.className = "wp-preview-overlay";
  overlay.innerHTML = `
    <div class="wp-preview-label">Random Wallpaper Preview</div>
    <div class="wp-preview-btns">
      <button class="wp-action-btn wp-discard-btn">✕ Discard</button>
      <button class="wp-action-btn wp-another-btn">↻ Another</button>
      <button class="wp-action-btn wp-save-login-btn">✔ Set Login</button>
      <button class="wp-action-btn wp-save-btn">✔ Set Desktop</button>
    </div>
  `;

  overlay.querySelector(".wp-discard-btn").onclick = () => {
    previewZone.classList.remove("wp-preview-active");
    previewZone.innerHTML = "";
  };

  overlay.querySelector(".wp-another-btn").onclick = () => showRandomPreview(previewZone, grid, fs, wm);

  const saveRandomWallpaper = async (isLogin) => {
    if (isLogin) {
      await SystemUtilities.setLoginWallpaper(selection.src);
    } else {
      await SystemUtilities.setWallpaper(selection.src);
    }

    if (!selection.fromLibrary) {
      const urlParts = selection.src.split("/");
      const rawName = urlParts[urlParts.length - 1]
        .replace(/\.\d+x\d+\.mp4$/, "")
        .replace(/\.mp4$/, "")
        .replace(/-/g, " ")
        .slice(0, 32)
        .trim();
      const ext = selection.isVideo ? ".mp4" : ".webp";
      const fileName = rawName + ext;

      await fs.ensureFolder(["Pictures", "Wallpapers"]);
      await fs.createFile(
        ["Pictures", "Wallpapers"],
        fileName,
        selection.src,
        selection.isVideo ? FileKind.VIDEO : FileKind.IMAGE,
        selection.isVideo ? "static/icons/file.webp" : selection.src
      );

      wm.sendNotify(`Saved as "${fileName}"`);
    } else {
      wm.sendNotify(`${isLogin ? "Login" : "Desktop"} wallpaper set to "${selection.label}"`);
    }

    previewZone.classList.remove("wp-preview-active");
    previewZone.innerHTML = "";
    await refreshWallpaperGrid(fs, grid, wm, previewZone);
  };

  overlay.querySelector(".wp-save-btn").onclick = () => saveRandomWallpaper(false);
  overlay.querySelector(".wp-save-login-btn").onclick = () => saveRandomWallpaper(true);

  inner.appendChild(media);
  inner.appendChild(overlay);
  previewZone.appendChild(inner);
}
