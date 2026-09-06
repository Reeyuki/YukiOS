import { os } from "../framework.js";

export function makePaneResizable(containerEl, sidebarEl, resizerEl, options = {}) {
  const { storageKey, min = 140, max = 320, defaultWidth } = options;
  if (!sidebarEl || !resizerEl) return;
  const clamp = (v) => Math.max(min, Math.min(max, v));
  const applyWidth = (w) => {
    const cw = clamp(w);
    sidebarEl.style.width = cw + "px";
    if (containerEl) containerEl.style.setProperty("--pane-sidebar-w", cw + "px");
  };
  let stored = null;
  try {
    stored = storageKey ? os.storage.get(storageKey) : null;
  } catch {}
  const initial = stored != null ? Number(stored) : defaultWidth;
  if (Number.isFinite(initial)) applyWidth(initial);
  else if (Number.isFinite(defaultWidth)) applyWidth(defaultWidth);
  let startX = 0;
  let startW = 0;
  let dragging = false;
  const onMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const dx = e.clientX - startX;
    const next = clamp(startW + dx);
    applyWidth(next);
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("pane-resizing");
    const width = parseInt(sidebarEl.style.width, 10);
    if (Number.isFinite(width) && storageKey) {
      try {
        os.storage.set(storageKey, width);
      } catch {}
    }
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };
  resizerEl.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startX = e.clientX;
    startW = sidebarEl.getBoundingClientRect().width;
    dragging = true;
    document.body.classList.add("pane-resizing");
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}
