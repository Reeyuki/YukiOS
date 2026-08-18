function getPos(e) {
  const src = e.touches ? e.touches[0] || e.changedTouches[0] : e;
  return { x: src.clientX, y: src.clientY };
}

function getPagePos(e) {
  const src = e.touches ? e.touches[0] || e.changedTouches[0] : e;
  return { x: src.pageX, y: src.pageY };
}

function addDocListeners(handlers) {
  document.addEventListener("mousemove", handlers.move);
  document.addEventListener("mouseup", handlers.up);
  document.addEventListener("touchmove", handlers.move, { passive: false });
  document.addEventListener("touchend", handlers.up);
  document.addEventListener("touchcancel", handlers.up);
}

function removeDocListeners(handlers) {
  document.removeEventListener("mousemove", handlers.move);
  document.removeEventListener("mouseup", handlers.up);
  document.removeEventListener("touchmove", handlers.move);
  document.removeEventListener("touchend", handlers.up);
  document.removeEventListener("touchcancel", handlers.up);
}

export function makeDraggable(element, callbacks, options = {}) {
  const { ignoreFrom = null, axis = "both" } = options;
  let isDragging = false;
  let startX = 0,
    startY = 0;
  let lastX = 0,
    lastY = 0;
  let current = { x: 0, y: 0 };

  function matchesIgnore(target) {
    if (!ignoreFrom) return false;
    return !!target.closest(ignoreFrom);
  }

  function onDown(e) {
    if (matchesIgnore(e.target)) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();

    const pos = getPos(e);
    startX = pos.x;
    startY = pos.y;
    lastX = pos.x;
    lastY = pos.y;
    current = { x: 0, y: 0 };
    isDragging = true;

    addDocListeners({ move: onMove, up: onUp });

    if (callbacks.start) callbacks.start(e, pos.x, pos.y);
  }

  function onMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const pos = getPos(e);
    const dx = axis !== "y" ? pos.x - lastX : 0;
    const dy = axis !== "x" ? pos.y - lastY : 0;
    current.x += dx;
    current.y += dy;
    lastX = pos.x;
    lastY = pos.y;
    if (callbacks.move) {
      const pp = getPagePos(e);
      callbacks.move(e, dx, dy, pos.x, pos.y, pp.x, pp.y, current.x, current.y);
    }
  }

  function onUp(e) {
    if (!isDragging) return;
    isDragging = false;
    removeDocListeners({ move: onMove, up: onUp });
    if (callbacks.end) callbacks.end(e, current.x, current.y);
  }

  element.addEventListener("mousedown", onDown);
  element.addEventListener("touchstart", onDown, { passive: false });

  return function cleanup() {
    element.removeEventListener("mousedown", onDown);
    element.removeEventListener("touchstart", onDown);
    isDragging = false;
    removeDocListeners({ move: onMove, up: onUp });
  };
}

export function makeResizable(element, callbacks, options = {}) {
  const {
    edges: edgeOpts = { top: true, left: true, bottom: true, right: true },
    minWidth = 300,
    minHeight = 300
  } = options;
  const MARGIN = 10;
  let activeEdges = null;
  let startRect = null;
  let startPointer = null;

  function getEdge(e) {
    const rect = element.getBoundingClientRect();
    const pos = getPos(e);
    const edge = { top: false, left: false, bottom: false, right: false };
    if (edgeOpts.top && pos.y - rect.top <= MARGIN) edge.top = true;
    if (edgeOpts.bottom && rect.bottom - pos.y <= MARGIN) edge.bottom = true;
    if (edgeOpts.left && pos.x - rect.left <= MARGIN) edge.left = true;
    if (edgeOpts.right && rect.right - pos.x <= MARGIN) edge.right = true;
    if (!edge.top && !edge.bottom && !edge.left && !edge.right) return null;
    return edge;
  }

  function getCursorForEdge(edge) {
    if (edge.top && edge.left) return "nwse-resize";
    if (edge.top && edge.right) return "nesw-resize";
    if (edge.bottom && edge.left) return "nesw-resize";
    if (edge.bottom && edge.right) return "nwse-resize";
    if (edge.top || edge.bottom) return "ns-resize";
    if (edge.left || edge.right) return "ew-resize";
    return "";
  }

  function onHover(e) {
    if (activeEdges) return;
    const edge = getEdge(e);
    element.style.cursor = edge ? getCursorForEdge(edge) : "";
  }

  function onLeave() {
    if (!activeEdges) element.style.cursor = "";
  }

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const edge = getEdge(e);
    if (!edge) return;
    e.preventDefault();
    activeEdges = edge;
    startRect = element.getBoundingClientRect();
    startPointer = getPos(e);
    addDocListeners({ move: onMove, up: onUp });
    if (callbacks.start) callbacks.start(e);
  }

  function onMove(e) {
    if (!activeEdges || !startRect) return;
    e.preventDefault();
    const pos = getPos(e);
    const dx = pos.x - startPointer.x;
    const dy = pos.y - startPointer.y;

    let w = startRect.width,
      h = startRect.height;
    let l = startRect.left,
      t = startRect.top;

    if (activeEdges.right) w = Math.max(minWidth, startRect.width + dx);
    if (activeEdges.left) {
      w = Math.max(minWidth, startRect.width - dx);
      l = startRect.right - w;
    }
    if (activeEdges.bottom) h = Math.max(minHeight, startRect.height + dy);
    if (activeEdges.top) {
      h = Math.max(minHeight, startRect.height - dy);
      t = startRect.bottom - h;
    }

    if (callbacks.move) callbacks.move(e, { left: l, top: t, width: w, height: h });
  }

  function onUp(e) {
    if (!activeEdges) return;
    activeEdges = null;
    startRect = null;
    startPointer = null;
    removeDocListeners({ move: onMove, up: onUp });
    if (callbacks.end) callbacks.end(e);
  }

  element.addEventListener("mousedown", onDown);
  element.addEventListener("touchstart", onDown, { passive: false });
  element.addEventListener("mousemove", onHover);
  element.addEventListener("mouseleave", onLeave);

  return function cleanup() {
    element.removeEventListener("mousedown", onDown);
    element.removeEventListener("touchstart", onDown);
    element.removeEventListener("mousemove", onHover);
    element.removeEventListener("mouseleave", onLeave);
    activeEdges = null;
    removeDocListeners({ move: onMove, up: onUp });
  };
}
