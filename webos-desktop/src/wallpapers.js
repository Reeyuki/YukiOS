import { FileKind } from "./fs.js";
import { SystemUtilities } from "./system.js";
import { videos } from "./wallpaperList.js";
import { resolveWallpaperUrl, CDN_BASES } from "./shared/assetResolver.js";
import { vantaPresets } from "./vantaPresets.js";

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

function renderVantaPresets(grid, previewZone) {
  grid.innerHTML = "";

  vantaPresets.forEach((preset) => {
    const card = document.createElement("div");
    card.className = "wp-card wp-vanta-card";
    card.title = preset.name;

    const thumbEl = document.createElement("div");
    thumbEl.className = "wp-thumb wp-vanta-thumb";
    if (preset.previewStyle) {
      Object.assign(thumbEl.style, preset.previewStyle);
    } else {
      thumbEl.style.background = "linear-gradient(135deg, #1e1e1e 0%, #4a00e0 100%)";
    }

    const nameEl = document.createElement("div");
    nameEl.className = "wp-card-name";
    nameEl.textContent = preset.name;

    const actions = document.createElement("div");
    actions.className = "wp-card-actions";

    const setBtn = document.createElement("button");
    setBtn.className = "wp-card-btn wp-set-btn";
    setBtn.textContent = "Set Desktop";
    setBtn.onclick = async (e) => {
      e.stopPropagation();
      await SystemUtilities.setWallpaper(`vanta:${preset.id}`);
      os.notify.send(`Desktop wallpaper set to "${preset.name}"`, { type: "info" });
    };

    actions.appendChild(setBtn);

    card.appendChild(thumbEl);
    card.appendChild(nameEl);
    card.appendChild(actions);

    card.addEventListener("click", () => {
      showVantaPreview(preset, previewZone);
    });

    grid.appendChild(card);
  });
}

function showVantaPreview(preset, previewZone) {
  previewZone.classList.add("wp-preview-active");
  previewZone.innerHTML = "";

  const inner = document.createElement("div");
  inner.className = "wp-preview-inner";

  const previewContainer = document.createElement("div");
  previewContainer.className = "wp-vanta-preview-container";
  if (preset.previewStyle) {
    Object.assign(previewContainer.style, preset.previewStyle);
  } else {
    previewContainer.style.background = "linear-gradient(135deg, #1e1e1e 0%, #4a00e0 100%)";
  }

  const overlay = document.createElement("div");
  overlay.className = "wp-preview-overlay";
  overlay.innerHTML = `
    <div class="wp-preview-label">${preset.name}</div>
    <div class="wp-preview-btns">
      <button class="wp-action-btn wp-discard-btn">✕ Close</button>
      <button class="wp-action-btn wp-customize-btn">⚙ Customize</button>
      <button class="wp-action-btn wp-save-btn">✔ Set Desktop</button>
    </div>
  `;

  overlay.querySelector(".wp-discard-btn").onclick = () => {
    previewZone.classList.remove("wp-preview-active");
    previewZone.innerHTML = "";
  };

  overlay.querySelector(".wp-save-btn").onclick = async () => {
    await SystemUtilities.setWallpaper(`vanta:${preset.id}`);
    os.notify.send(`Desktop wallpaper set to "${preset.name}"`, { type: "info" });
    previewZone.classList.remove("wp-preview-active");
    previewZone.innerHTML = "";
  };

  overlay.querySelector(".wp-customize-btn").onclick = () => {
    showVantaCustomizeDialog(preset, previewZone);
  };

  inner.appendChild(previewContainer);
  inner.appendChild(overlay);
  previewZone.appendChild(inner);
}

function showVantaCustomizeDialog(preset, previewZone) {
  previewZone.innerHTML = "";

  const dialog = document.createElement("div");
  dialog.className = "wp-vanta-customize-dialog";

  const header = document.createElement("div");
  header.className = "wp-customize-header";
  header.innerHTML = `
    <div class="wp-customize-title">Customize ${preset.name}</div>
    <button class="wp-customize-close">✕</button>
  `;

  const content = document.createElement("div");
  content.className = "wp-customize-content";

  const controls = getVantaControls(preset);
  controls.forEach((control) => {
    const controlGroup = document.createElement("div");
    controlGroup.className = "wp-control-group";

    const label = document.createElement("label");
    label.className = "wp-control-label";
    label.textContent = control.label;

    const input = document.createElement("input");
    input.className = "wp-control-input";
    input.type = control.type;
    input.min = control.min;
    input.max = control.max;
    input.step = control.step;
    input.value = control.value;
    input.dataset.key = control.key;
    input.dataset.type = control.type;

    if (control.type === "color") {
      input.value = control.value;
    }

    const valueDisplay = document.createElement("span");
    valueDisplay.className = "wp-control-value";
    valueDisplay.textContent = control.value;

    input.addEventListener("input", () => {
      valueDisplay.textContent = input.value;
    });

    controlGroup.appendChild(label);
    controlGroup.appendChild(input);
    controlGroup.appendChild(valueDisplay);
    content.appendChild(controlGroup);
  });

  const footer = document.createElement("div");
  footer.className = "wp-customize-footer";
  footer.innerHTML = `
    <button class="wp-customize-btn wp-customize-cancel">Cancel</button>
    <button class="wp-customize-btn wp-customize-apply">Apply</button>
  `;

  header.querySelector(".wp-customize-close").onclick = () => {
    showVantaPreview(preset, previewZone);
  };

  footer.querySelector(".wp-customize-cancel").onclick = () => {
    showVantaPreview(preset, previewZone);
  };

  footer.querySelector(".wp-customize-apply").onclick = () => {
    const customOptions = {};
    const inputs = content.querySelectorAll(".wp-control-input");
    inputs.forEach((input) => {
      const key = input.dataset.key;
      const type = input.dataset.type;
      if (type === "color") {
        customOptions[key] = parseInt(input.value.replace("#", "0x"), 16);
      } else if (type === "number") {
        customOptions[key] = parseFloat(input.value);
      }
    });

    const customPreset = {
      ...preset,
      options: { ...preset.options, ...customOptions }
    };

    applyCustomVantaWallpaper(customPreset);
    previewZone.classList.remove("wp-preview-active");
    previewZone.innerHTML = "";
  };

  dialog.appendChild(header);
  dialog.appendChild(content);
  dialog.appendChild(footer);
  previewZone.appendChild(dialog);
}

function getVantaControls(preset) {
  const controls = [];
  const options = preset.options;

  if (preset.effect === "WAVES") {
    controls.push(
      { label: "Color", type: "color", key: "color", value: "#" + options.color.toString(16).padStart(6, "0") },
      { label: "Wave Height", type: "range", key: "waveHeight", value: options.waveHeight, min: 5, max: 50, step: 1 },
      { label: "Wave Speed", type: "range", key: "waveSpeed", value: options.waveSpeed, min: 0.1, max: 3, step: 0.1 },
      { label: "Zoom", type: "range", key: "zoom", value: options.zoom, min: 0.5, max: 2, step: 0.1 }
    );
  } else if (preset.effect === "BIRDS") {
    controls.push(
      { label: "Color 1", type: "color", key: "color1", value: "#" + options.color1.toString(16).padStart(6, "0") },
      { label: "Color 2", type: "color", key: "color2", value: "#" + options.color2.toString(16).padStart(6, "0") },
      { label: "Bird Size", type: "range", key: "birdSize", value: options.birdSize, min: 0.5, max: 3, step: 0.1 },
      { label: "Speed Limit", type: "range", key: "speedLimit", value: options.speedLimit, min: 1, max: 10, step: 0.5 }
    );
  } else if (preset.effect === "NET") {
    controls.push(
      { label: "Color", type: "color", key: "color", value: "#" + options.color.toString(16).padStart(6, "0") },
      { label: "Points", type: "range", key: "points", value: options.points, min: 5, max: 20, step: 1 },
      { label: "Distance", type: "range", key: "distance", value: options.distance, min: 10, max: 30, step: 1 }
    );
  } else if (preset.effect === "DOTS") {
    controls.push(
      { label: "Color", type: "color", key: "color", value: "#" + options.color.toString(16).padStart(6, "0") },
      { label: "Color 2", type: "color", key: "color2", value: "#" + options.color2.toString(16).padStart(6, "0") },
      { label: "Size", type: "range", key: "size", value: options.size, min: 1, max: 5, step: 0.5 },
      { label: "Spacing", type: "range", key: "spacing", value: options.spacing, min: 20, max: 80, step: 5 }
    );
  } else if (preset.effect === "GLOBE") {
    controls.push(
      { label: "Color", type: "color", key: "color", value: "#" + options.color.toString(16).padStart(6, "0") },
      { label: "Color 2", type: "color", key: "color2", value: "#" + options.color2.toString(16).padStart(6, "0") },
      { label: "Size", type: "range", key: "size", value: options.size, min: 0.5, max: 3, step: 0.1 },
      { label: "Deviation", type: "range", key: "deviation", value: options.deviation, min: 50, max: 500, step: 10 }
    );
  } else if (preset.effect === "HALO") {
    controls.push(
      { label: "Color", type: "color", key: "color", value: "#" + options.color.toString(16).padStart(6, "0") },
      { label: "Size", type: "range", key: "size", value: options.size, min: 0.5, max: 3, step: 0.1 }
    );
  } else if (preset.effect === "FOG") {
    controls.push(
      { label: "Color", type: "color", key: "color", value: "#" + options.color.toString(16).padStart(6, "0") },
      {
        label: "Highlight Color",
        type: "color",
        key: "highlightColor",
        value: "#" + options.highlightColor.toString(16).padStart(6, "0")
      },
      { label: "Speed", type: "range", key: "speed", value: options.speed, min: 0.1, max: 3, step: 0.1 }
    );
  } else if (preset.effect === "CELLS") {
    controls.push(
      { label: "Color", type: "color", key: "color", value: "#" + options.color.toString(16).padStart(6, "0") },
      { label: "Color 2", type: "color", key: "color2", value: "#" + options.color2.toString(16).padStart(6, "0") },
      { label: "Size", type: "range", key: "size", value: options.size, min: 0.5, max: 3, step: 0.1 },
      { label: "Speed", type: "range", key: "speed", value: options.speed, min: 0.1, max: 3, step: 0.1 }
    );
  }

  return controls;
}

async function applyCustomVantaWallpaper(customPreset) {
  const customConfig = JSON.stringify(customPreset);
  const base64Config = btoa(customConfig);
  await SystemUtilities.setWallpaper(`vanta:custom:${base64Config}`);
  os.notify.send(`Desktop wallpaper set to custom "${customPreset.name}"`, { type: "info" });
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

  const vantaSection = document.createElement("div");
  vantaSection.className = "wp-vanta-section";
  vantaSection.innerHTML = `<div class="wp-section-title">Vanta.js Animated Wallpapers</div>`;
  view.appendChild(vantaSection);

  const vantaGrid = document.createElement("div");
  vantaGrid.className = "wp-grid wp-vanta-grid";
  view.appendChild(vantaGrid);

  await renderVantaPresets(vantaGrid, previewZone);

  const regularSection = document.createElement("div");
  regularSection.className = "wp-regular-section";
  regularSection.innerHTML = `<div class="wp-section-title">Your Wallpapers</div>`;
  view.appendChild(regularSection);

  const grid = document.createElement("div");
  grid.className = "wp-grid";
  view.appendChild(grid);

  await refreshWallpaperGrid(fs, grid, wm, previewZone);

  header.querySelector("#wp-try-random").onclick = () => showRandomPreview(previewZone, grid, fs, wm);
  header.querySelector("#wp-reset-login").onclick = async () => {
    await SystemUtilities.setLoginWallpaper("none");
    os.notify.send("Login wallpaper reset to default", { type: "info" });
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
        os.notify.send(`Desktop wallpaper set to "${name}"`, { type: "info" });
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
        os.notify.send(`Login wallpaper set to "${name}"`, { type: "info" });
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
      os.notify.send(`Desktop wallpaper set to "${name}"`);
    }
    previewZone.classList.remove("wp-preview-active");
    previewZone.innerHTML = "";
  };

  overlay.querySelector(".wp-save-login-btn").onclick = async () => {
    const content = await fs.getFileContent(["Pictures", "Wallpapers"], name);
    const url = toBlobUrl(content);
    if (content) {
      await SystemUtilities.setLoginWallpaper(content);
      os.notify.send(`Login wallpaper set to "${name}"`, { type: "info" });
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

      os.notify.send(`Saved as "${fileName}"`, { type: "info" });
    } else {
      os.notify.send(`${isLogin ? "Login" : "Desktop"} wallpaper set to "${selection.label}"`, { type: "info" });
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
