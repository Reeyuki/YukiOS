const DRAG_THRESHOLD = 4;
const EDGE_SCROLL_MARGIN = 40;
const EDGE_SCROLL_STEP = 24;
const SNAP_FALLBACK_MS = 320;

function getAxis(container) {
  const dir = getComputedStyle(container).flexDirection;
  return dir === "column" || dir === "column-reverse" ? "y" : "x";
}

function getSign(container, axis) {
  const cs = getComputedStyle(container);
  if (axis === "y") return cs.flexDirection === "column-reverse" ? -1 : 1;
  if (cs.flexDirection === "row-reverse") return -1;
  return cs.direction === "rtl" ? -1 : 1;
}

function getGap(container, axis) {
  const cs = getComputedStyle(container);
  const raw = axis === "x" ? cs.columnGap || cs.gap : cs.rowGap || cs.gap;
  return parseFloat(raw) || 0;
}

function midpoint(rect, axis) {
  return axis === "x" ? (rect.left + rect.right) / 2 : (rect.top + rect.bottom) / 2;
}

function computeTargetIndex(center, sibRects, axis, sign) {
  let idx = 0;
  for (let i = 0; i < sibRects.length; i++) {
    const mid = midpoint(sibRects[i], axis);
    if (sign > 0 ? center > mid : center < mid) idx = i + 1;
    else break;
  }
  return idx;
}

function autoScroll(ev, container, axis) {
  const rect = container.getBoundingClientRect();
  if (axis === "x") {
    if (ev.clientX > rect.right - EDGE_SCROLL_MARGIN) container.scrollLeft += EDGE_SCROLL_STEP;
    else if (ev.clientX < rect.left + EDGE_SCROLL_MARGIN) container.scrollLeft -= EDGE_SCROLL_STEP;
  } else {
    if (ev.clientY > rect.bottom - EDGE_SCROLL_MARGIN) container.scrollTop += EDGE_SCROLL_STEP;
    else if (ev.clientY < rect.top + EDGE_SCROLL_MARGIN) container.scrollTop -= EDGE_SCROLL_STEP;
  }
}

export function enableTaskbarReorder(item, config) {
  if (!item) return;
  const getContainer = config.getContainer;
  const getSiblings = config.getSiblings;
  const onDragStart = config.onDragStart;
  const onDragEnd = config.onDragEnd;
  const onDrop = config.onDrop;

  const state = {
    started: false,
    startX: 0,
    startY: 0,
    startRect: null,
    axis: "x",
    sign: 1,
    shift: 0,
    lastTarget: 0,
    bounds: null,
    zoom: 1
  };

  const cleanupListeners = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
    window.removeEventListener("blur", onUp);
  };

  const beginDrag = (e) => {
    state.started = true;
    const taskbarEl = document.getElementById("taskbar");
    state.zoom = parseFloat(getComputedStyle(taskbarEl).zoom) || 1;
    const container = getContainer();
    state.bounds = container.getBoundingClientRect();
    const siblings = getSiblings();
    const firstRects = siblings.map((s) => s.getBoundingClientRect());

    item.style.position = "fixed";
    item.style.margin = "0";
    item.style.left = `${state.startRect.left}px`;
    item.style.top = `${state.startRect.top}px`;
    item.style.width = `${state.startRect.width}px`;
    item.style.height = `${state.startRect.height}px`;
    item.style.right = "auto";
    item.style.bottom = "auto";
    item.style.zIndex = "99999";
    item.style.pointerEvents = "none";
    item.style.transition = "none";
    item.classList.add("dragging");
    document.body.appendChild(item);

    const lastRects = siblings.map((s) => s.getBoundingClientRect());
    siblings.forEach((s, i) => {
      const dx = (firstRects[i].left - lastRects[i].left) / state.zoom;
      const dy = (firstRects[i].top - lastRects[i].top) / state.zoom;
      s.style.transition = "none";
      s.style.transform = `translate(${dx}px, ${dy}px)`;
      s.classList.add("taskbar-reorder-anim");
    });
    void document.body.offsetWidth;
    siblings.forEach((s) => {
      s.style.transition = "";
      s.style.transform = "";
    });

    state.axis = getAxis(container);
    state.sign = getSign(container, state.axis);
    const gap = getGap(container, state.axis);
    const draggedSize = state.axis === "x" ? state.startRect.width : state.startRect.height;
    state.shift = draggedSize + gap;
    state.lastTarget = -1;

    if (typeof onDragStart === "function") onDragStart();
  };

  const applyPush = (siblings, target) => {
    const axis = state.axis;
    const sign = state.sign;
    const shift = state.shift;
    siblings.forEach((s, i) => {
      s.style.transform =
        i >= target ? `translate${axis === "x" ? "X" : "Y"}(${(sign * shift) / state.zoom}px)` : "";
    });
  };

  const handleMove = (ev) => {
    if (!state.started) {
      const dx = ev.clientX - state.startX;
      const dy = ev.clientY - state.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      beginDrag(ev);
    }
    if (!state.started) return;
    if (!document.body.contains(item)) {
      cleanupListeners();
      return;
    }

    const dx = ev.clientX - state.startX;
    const dy = ev.clientY - state.startY;

    let tx = state.axis === "x" ? dx : 0;
    let ty = state.axis === "y" ? dy : 0;

    const bounds = state.bounds;
    if (state.axis === "x") {
      const minLeft = bounds.left;
      const maxLeft = bounds.right - state.startRect.width;
      const newLeft = Math.max(minLeft, Math.min(state.startRect.left + tx, maxLeft));
      tx = newLeft - state.startRect.left;
    } else {
      const minTop = bounds.top;
      const maxTop = bounds.bottom - state.startRect.height;
      const newTop = Math.max(minTop, Math.min(state.startRect.top + ty, maxTop));
      ty = newTop - state.startRect.top;
    }

    item.style.transform = `translate(${tx}px, ${ty}px)`;

    const container = getContainer();
    const siblings = getSiblings();
    const draggedRect = item.getBoundingClientRect();
    const center =
      state.axis === "x"
        ? (draggedRect.left + draggedRect.right) / 2
        : (draggedRect.top + draggedRect.bottom) / 2;
    const sibRects = siblings.map((s) => s.getBoundingClientRect());
    const target = computeTargetIndex(center, sibRects, state.axis, state.sign);

    if (target !== state.lastTarget) {
      state.lastTarget = target;
    }
    applyPush(siblings, target);

    autoScroll(ev, container, state.axis);
  };

  const endDrag = () => {
    if (!state.started) {
      cleanupListeners();
      return;
    }
    const container = getContainer();
    const siblings = getSiblings();
    const dropRect = item.getBoundingClientRect();
    const target = state.lastTarget < 0 ? 0 : state.lastTarget;
    const ref = siblings[target] || null;
    container.insertBefore(item, ref);

    item.classList.remove("dragging");
    item.style.position = "";
    item.style.left = "";
    item.style.top = "";
    item.style.width = "";
    item.style.height = "";
    item.style.right = "";
    item.style.bottom = "";
    item.style.zIndex = "";
    item.style.pointerEvents = "";
    item.style.transition = "";
    item.style.transform = "";

    void item.offsetWidth;
    const slotRect = item.getBoundingClientRect();
    const ddx = (dropRect.left - slotRect.left) / state.zoom;
    const ddy = (dropRect.top - slotRect.top) / state.zoom;

    item.classList.add("drop-anim");
    item.style.transition = "none";
    item.style.transform = `translate(${ddx}px, ${ddy}px)`;
    void item.offsetWidth;
    item.style.transition = "";
    item.style.transform = "";

    siblings.forEach((s) => {
      s.style.transform = "";
    });

    const finalize = () => {
      item.classList.remove("drop-anim");
      item.style.transition = "";
      item.style.transform = "";
      siblings.forEach((s) => s.classList.remove("taskbar-reorder-anim"));
      item.removeEventListener("transitionend", finalize);
    };
    item.addEventListener("transitionend", finalize);
    setTimeout(finalize, SNAP_FALLBACK_MS);

    item.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        e.preventDefault();
      },
      { capture: true, once: true }
    );

    if (typeof onDrop === "function") onDrop();
    if (typeof onDragEnd === "function") onDragEnd();

    cleanupListeners();
  };

  const onMove = (ev) => handleMove(ev);
  const onUp = () => endDrag();

  item.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".taskbar-speaker-indicator")) return;
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.startRect = item.getBoundingClientRect();
    state.started = false;
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
  });
}
