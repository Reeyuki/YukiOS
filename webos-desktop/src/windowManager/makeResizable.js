export function makeResizable(win, wm, setHeightUnsetElement = null) {
  const margin = 10;

  const getDirection = (e) => {
    const rect = win.getBoundingClientRect();
    let dir = "";
    if (e.clientY - rect.top < margin) dir += "n";
    else if (rect.bottom - e.clientY < margin) dir += "s";
    if (e.clientX - rect.left < margin) dir += "w";
    else if (rect.right - e.clientX < margin) dir += "e";
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

  win.addEventListener("mousemove", (e) => {
    win.style.cursor = cursorMap[getDirection(e)] || "default";
  });

  win.addEventListener("mousedown", (e) => {
    const direction = getDirection(e);
    if (!direction) return;

    wm.bringToFront(win);
    document.body.classList.add("is-resizing");
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = win.getBoundingClientRect();
    const startWidth = rect.width;
    const startHeight = rect.height;
    const startLeft = rect.left;
    const startTop = rect.top;
    const MIN_SIZE = 300;

    const doDrag = (e) => {
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;

      if (direction.includes("e")) newWidth = startWidth + (e.clientX - startX);
      if (direction.includes("s")) newHeight = startHeight + (e.clientY - startY);
      if (direction.includes("w")) {
        newWidth = startWidth - (e.clientX - startX);
        newLeft = startLeft + (e.clientX - startX);
      }
      if (direction.includes("n")) {
        newHeight = startHeight - (e.clientY - startY);
        newTop = startTop + (e.clientY - startY);
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
    };

    document.addEventListener("mousemove", doDrag);
    document.addEventListener("mouseup", stopDrag);
  });
}
