function getClientXY(e) {
  if (e.touches) {
    const t = e.touches[0] || e.changedTouches[0];
    return { clientX: t.clientX, clientY: t.clientY };
  }
  return { clientX: e.clientX, clientY: e.clientY };
}

export function makeResizable(win, wm, setHeightUnsetElement = null) {
  const margin = 10;

  const getDirection = (e) => {
    const rect = win.getBoundingClientRect();
    const { clientX, clientY } = getClientXY(e);
    let dir = "";
    if (clientY - rect.top < margin) dir += "n";
    else if (rect.bottom - clientY < margin) dir += "s";
    if (clientX - rect.left < margin) dir += "w";
    else if (rect.right - clientX < margin) dir += "e";
    return dir;
  };

  const cursorMap = {
    n: "n-resize",
    s: "s-resize",
    w: "w-resize",
    e: "e-resize",
    nw: "nw-resize",
    ne: "ne-resize",
    sw: "sw-resize",
    se: "se-resize",
    "": "default"
  };

  const updateCursor = (e) => {
    const dir = getDirection(e);
    win.style.cursor = cursorMap[dir] || "default";
  };

  win.addEventListener("mousemove", updateCursor);

  const startResize = (e) => {
    const direction = getDirection(e);
    if (!direction) return;

    wm.bringToFront(win);
    document.body.classList.add("is-resizing");
    e.preventDefault();

    const { clientX: startX, clientY: startY } = getClientXY(e);
    const rect = win.getBoundingClientRect();
    const startWidth = rect.width;
    const startHeight = rect.height;
    const startLeft = rect.left;
    const startTop = rect.top;
    const MIN_SIZE = 300;

    const doDrag = (e) => {
      const { clientX, clientY } = getClientXY(e);
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;

      if (direction.includes("e")) newWidth = startWidth + (clientX - startX);
      if (direction.includes("s")) newHeight = startHeight + (clientY - startY);
      if (direction.includes("w")) {
        newWidth = startWidth - (clientX - startX);
        newLeft = startLeft + (clientX - startX);
      }
      if (direction.includes("n")) {
        newHeight = startHeight - (clientY - startY);
        newTop = startTop + (clientY - startY);
      }

      if (newWidth > MIN_SIZE) {
        win.style.width = `${newWidth}px`;
        win.style.left = `${newLeft}px`;
      }
      if (newHeight > MIN_SIZE) {
        win.style.height = `${newHeight}px`;
        win.style.top = `${newTop}px`;
      }

      const entry = wm.openWindows.get(win.id);
      if (entry?.record) {
        entry.record.setGeometry(newLeft, newTop, newWidth, newHeight);
      }

      if (setHeightUnsetElement?.style) setHeightUnsetElement.style.height = "unset";
    };

    const stopDrag = () => {
      document.body.classList.remove("is-resizing");
      document.removeEventListener("mousemove", doDrag);
      document.removeEventListener("mouseup", stopDrag);
      document.removeEventListener("touchmove", doDrag);
      document.removeEventListener("touchend", stopDrag);
      document.removeEventListener("touchcancel", stopDrag);
      if (wm.triggerSessionSave) wm.triggerSessionSave();
    };

    document.addEventListener("mousemove", doDrag);
    document.addEventListener("mouseup", stopDrag);
    document.addEventListener("touchmove", doDrag, { passive: false });
    document.addEventListener("touchend", stopDrag);
    document.addEventListener("touchcancel", stopDrag);
  };

  win.addEventListener("mousedown", startResize);
  win.addEventListener("touchstart", startResize, { passive: false });
}
