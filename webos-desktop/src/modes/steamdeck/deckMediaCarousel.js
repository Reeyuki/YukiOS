import { os } from "../../framework.js";
import { createElement, setHTML, setText } from "../../shared/domUtils.js";
import { steamDeckAudio } from "./SteamDeckAudio.js";
import { showDeckPrompt, showDeckConfirm } from "./deckDialog.js";
import { isImageFile } from "../../shared/fileKindDetector.js";

const SCREENSHOT_DIR = ["Pictures", "Screenshots"];
const GRID_PAGE_SIZE = 48;

let active = null;

function formatCaptureDate(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  let hour = d.getHours();
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${month} ${d.getDate()} @${hour}:${minute} ${suffix}`;
}

function toTimestamp(item, meta) {
  if (meta && meta.capturedAt) return meta.capturedAt;
  const mtime = item && item.mtime ? item.mtime : 0;
  if (!mtime) return Date.now();
  return mtime < 1e12 ? mtime * 1000 : mtime;
}

async function readObjectUrl(name) {
  try {
    const blob = await os.fs.readBinaryFile(SCREENSHOT_DIR, name);
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

function destroyViewer() {
  if (!active) return;
  if (active.viewer) {
    active.viewer.remove();
    active.viewer = null;
  }
  if (active.onKey) {
    document.removeEventListener("keydown", active.onKey, true);
    active.onKey = null;
  }
  active.container?.classList.remove("deck-carousel-open");
}

export function destroyActiveCarousel() {
  if (!active) return;
  if (active.io) active.io.disconnect();
  active.urls.forEach((url) => URL.revokeObjectURL(url));
  active.viewer?.remove();
  active.container?.classList.remove("deck-carousel-open");
  if (active.onKey) document.removeEventListener("keydown", active.onKey, true);
  active = null;
}

async function buildThumb(name, entry, container) {
  const url = await readObjectUrl(name);
  if (!url) return null;
  if (!active || active.container !== container) {
    URL.revokeObjectURL(url);
    return null;
  }
  active.urls.set(name, url);
  const tile = createElement("button", { className: "deck-media-thumb", attributes: { tabindex: "0" } });
  const img = createElement("img", { className: "deck-media-thumb-img", attributes: { loading: "lazy", decoding: "async" } });
  img.src = url;
  tile.appendChild(img);
  const captured = createElement("div", { className: "deck-media-thumb-meta" });
  captured.textContent = formatCaptureDate(toTimestamp(entry, null));
  tile.appendChild(captured);
  const open = () => openViewer(name);
  tile.addEventListener("click", (e) => {
    e.stopPropagation();
    open();
  });
  tile.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });
  active.thumbs.set(name, tile);
  return tile;
}

export async function renderDeckMediaView(container) {
  destroyActiveCarousel();
  if (!container) return;
  setHTML(container, "");
  container.classList.add("deck-media-view");

  let entries = [];
  try {
    const folder = await os.fs.readdir(SCREENSHOT_DIR);
    entries = Object.entries(folder || {})
      .filter(([name, entry]) => entry?.type === "file" && isImageFile(name))
      .sort((a, b) => (b[1].mtime || 0) - (a[1].mtime || 0))
      .map(([name, entry]) => ({ name, entry }));
  } catch {}

  active = {
    container,
    list: entries.map((e) => e.name),
    urls: new Map(),
    metas: new Map(),
    thumbs: new Map(),
    viewer: null,
    io: null,
    grid: null,
    onKey: null
  };

  if (entries.length === 0) {
    const empty = createElement("div", { className: "deck-carousel-empty" });
    empty.innerHTML =
      `<i class="fas fa-camera" style="font-size:40px;opacity:0.6"></i><span>No screenshots yet</span><span style="font-size:12px;opacity:0.6">Press F12 on the Steam Deck to capture</span>`;
    container.appendChild(empty);
    return;
  }

  const grid = createElement("div", { className: "deck-media-grid" });
  container.appendChild(grid);
  active.grid = grid;

  let offset = 0;
  let sentinel = null;
  let io = null;

  const renderPage = () => {
    if (!active || active.container !== container) return;
    const chunk = entries.slice(offset, offset + GRID_PAGE_SIZE);
    offset += chunk.length;
    if (!chunk.length) {
      io?.disconnect();
      sentinel?.remove();
      return;
    }
    Promise.allSettled(chunk.map(({ name, entry }) => buildThumb(name, entry, container))).then((results) => {
      if (!active || active.container !== container) return;
      results.forEach((res) => {
        if (res.status === "fulfilled" && res.value) grid.insertBefore(res.value, sentinel);
      });
    });
  };

  sentinel = createElement("div", { className: "deck-load-sentinel" });
  grid.appendChild(sentinel);
  io = new IntersectionObserver((ioEntries) => {
    if (ioEntries[0]?.isIntersecting) renderPage();
  }, { root: grid, rootMargin: "800px 0px" });
  active.io = io;
  renderPage();
  io.observe(sentinel);
}

function openViewer(startName) {
  if (!active) return;
  const startIndex = Math.max(0, active.list.indexOf(startName));
  renderCarouselOverlay(active.container, startIndex);
}

async function renderCarouselOverlay(container, startIndex) {
  if (!active || active.container !== container) return;
  destroyViewer();

  const overlay = createElement("div", { className: "deck-carousel deck-carousel-overlay" });
  container.appendChild(overlay);
  active.viewer = overlay;
  container.classList.add("deck-carousel-open");

  const backBtn = createElement("button", { className: "deck-carousel-back", attributes: { title: "Back to grid" } });
  backBtn.innerHTML = `<i class="fas fa-arrow-left"></i>`;
  overlay.appendChild(backBtn);

  const stage = createElement("div", { className: "deck-carousel-stage", attributes: { tabindex: "0" } });
  const track = createElement("div", { className: "deck-carousel-track" });
  stage.appendChild(track);
  const prevBtn = createElement("button", {
    className: "deck-carousel-arrow deck-carousel-prev",
    attributes: { title: "Previous screenshot" }
  });
  prevBtn.innerHTML = `<i class="fas fa-chevron-left"></i>`;
  const nextBtn = createElement("button", {
    className: "deck-carousel-arrow deck-carousel-next",
    attributes: { title: "Next screenshot" }
  });
  nextBtn.innerHTML = `<i class="fas fa-chevron-right"></i>`;
  stage.appendChild(prevBtn);
  stage.appendChild(nextBtn);

  const bar = createElement("div", { className: "deck-carousel-bar" });
  const sourceEl = createElement("div", { className: "deck-carousel-source" });
  const capturedEl = createElement("div", { className: "deck-carousel-captured" });
  const actionsEl = createElement("div", { className: "deck-carousel-actions" });
  const renameBtn = createElement("button", { className: "deck-carousel-action", attributes: { title: "Rename" } });
  renameBtn.innerHTML = `<i class="fas fa-pen"></i>`;
  const deleteBtn = createElement("button", { className: "deck-carousel-action deck-carousel-delete", attributes: { title: "Delete" } });
  deleteBtn.innerHTML = `<i class="fas fa-trash"></i>`;
  actionsEl.appendChild(renameBtn);
  actionsEl.appendChild(deleteBtn);
  bar.appendChild(sourceEl);
  bar.appendChild(capturedEl);
  bar.appendChild(actionsEl);

  overlay.appendChild(stage);
  overlay.appendChild(bar);

  const imgElements = [];
  for (const name of active.list) {
    if (!active || active.container !== container) return;
    let url = active.urls.get(name);
    if (!url) {
      url = await readObjectUrl(name);
      if (url) active.urls.set(name, url);
    }
    if (!url) {
      imgElements.push(null);
      continue;
    }
    const img = createElement("img", { className: "deck-carousel-item" });
    img.src = url;
    track.appendChild(img);
    imgElements.push(img);
  }

  let index = Math.min(Math.max(startIndex, 0), active.list.length - 1);
  let animating = false;

  const currentMeta = () => {
    const name = active.list[index];
    if (!active.metas.has(name)) {
      (async () => {
        try {
          const meta = await os.fs.getMetadata(SCREENSHOT_DIR, name);
          if (active) active.metas.set(name, meta || {});
          updateTrack();
        } catch {}
      })();
    }
    return active.metas.get(name) || {};
  };

  const updateTrack = () => {
    if (!active || !active.viewer) return;
    const itemWidth = track.clientWidth;
    track.style.transform = `translateX(-${index * itemWidth}px)`;
    imgElements.forEach((img, i) => {
      if (!img) return;
      img.classList.remove("active", "prev", "next");
      if (i === index) {
        img.classList.add("active");
      } else if (i === (index - 1 + active.list.length) % active.list.length) {
        img.classList.add("prev");
      } else if (i === (index + 1) % active.list.length) {
        img.classList.add("next");
      }
    });
    const meta = currentMeta();
    setText(sourceEl, meta.source || "Yuki Steam Client");
    setText(capturedEl, `CAPTURED ${formatCaptureDate(toTimestamp(null, meta))}`);
  };

  const navigate = (dir) => {
    if (!active || active.list.length < 2 || animating) return;
    animating = true;
    index = (index + dir + active.list.length) % active.list.length;
    steamDeckAudio.playSwitchNav();
    updateTrack();
    setTimeout(() => {
      animating = false;
    }, 300);
  };

  const showRenameDialog = () => {
    showDeckPrompt(container, "Rename Screenshot", active.list[index], async (newName) => {
      if (!newName || newName === active.list[index]) return;
      const oldName = active.list[index];
      const ext = oldName.split(".").pop();
      const finalName = newName.endsWith("." + ext) ? newName : newName + "." + ext;
      try {
        await os.fs.renameItem(SCREENSHOT_DIR, oldName, finalName);
        const url = active.urls.get(oldName);
        const meta = active.metas.get(oldName);
        active.urls.delete(oldName);
        active.metas.delete(oldName);
        if (url) active.urls.set(finalName, url);
        if (meta) active.metas.set(finalName, meta);
        const thumb = active.thumbs.get(oldName);
        if (thumb) {
          active.thumbs.delete(oldName);
          active.thumbs.set(finalName, thumb);
        }
        active.list[index] = finalName;
        steamDeckAudio.playSwitchNav();
        updateTrack();
      } catch {}
    });
  };

  const showDeleteDialog = () => {
    showDeckConfirm(container, "Delete Screenshot", `Are you sure you want to delete "${active.list[index]}"?`, async () => {
      try {
        const name = active.list[index];
        const url = active.urls.get(name);
        if (url) URL.revokeObjectURL(url);
        active.urls.delete(name);
        active.metas.delete(name);
        const thumb = active.thumbs.get(name);
        if (thumb) thumb.remove();
        active.thumbs.delete(name);
        active.list.splice(index, 1);
        imgElements[index]?.remove();
        imgElements.splice(index, 1);

        if (active.list.length === 0) {
          destroyActiveCarousel();
          renderDeckMediaView(container);
          return;
        }

        if (index >= active.list.length) {
          index = active.list.length - 1;
        }

        steamDeckAudio.playSwitchNav();
        updateTrack();
      } catch {}
    });
  };

  const handleRename = () => {
    if (!active || active.list.length === 0) return;
    showRenameDialog();
  };

  const handleDelete = () => {
    if (!active || active.list.length === 0) return;
    showDeleteDialog();
  };

  backBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    destroyViewer();
  });
  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigate(-1);
  });
  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigate(1);
  });
  overlay.addEventListener("click", (e) => {
    if (e.button === 0 && e.target === stage || e.target === track) {
      navigate(1);
    }
  });
  renameBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handleRename();
  });
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handleDelete();
  });

  active.onKey = (e) => {
    if (!active?.viewer) return;
    if (container.querySelector(".deck-carousel-dialog")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      destroyViewer();
      return;
    }
    const isLeft = e.key === "ArrowLeft";
    const isRight = e.key === "ArrowRight";
    if (!isLeft && !isRight) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    navigate(isLeft ? -1 : 1);
  };
  document.addEventListener("keydown", active.onKey, true);

  setTimeout(() => updateTrack(), 0);
  stage.focus();
}