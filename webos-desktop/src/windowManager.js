export class WindowManager {
  constructor() {
    this.openWindows = new Map();
    this.zIndexCounter = 1000;
  }

  createWindow(id, title, width = "80vw", height = "80vh") {
    const win = document.createElement("div");
    win.className = "window";
    win.id = id;
    win.dataset.fullscreen = "false";

    const vw = width.includes("vw") ? (window.innerWidth * parseFloat(width)) / 100 : parseInt(width);
    const vh = height.includes("vh") ? (window.innerHeight * parseFloat(height)) / 100 : parseInt(height);

    Object.assign(win.style, {
      width: `${vw}px`,
      height: `${vh}px`,
      left: `${(window.innerWidth - vw) / 2}px`,
      top: `${(window.innerHeight - vh) / 2}px`,
      position: "absolute",
      zIndex: this.zIndexCounter++
    });

    return win;
  }
  addToTaskbar(winId, title, iconUrl) {
    if (document.getElementById(`taskbar-${winId}`)) return;

    const taskbarItem = document.createElement("div");
    taskbarItem.id = `taskbar-${winId}`;
    taskbarItem.className = "taskbar-item";

    if (iconUrl) {
      const icon = document.createElement("img");
      icon.src = iconUrl;
      taskbarItem.appendChild(icon);
    }

    const text = document.createElement("span");
    text.textContent = title;
    taskbarItem.appendChild(text);

    taskbarItem.onclick = () => {
      const win = document.getElementById(winId);
      if (win) {
        if (win.style.display === "none") {
          win.style.display = "block";
          taskbarItem.classList.add("active");
        } else {
          this.bringToFront(win);
        }
      }
    };

    const taskbarWindows = document.getElementById("taskbar-windows");
    taskbarWindows.appendChild(taskbarItem);
    this.openWindows.set(winId, { taskbarItem, title });
  }

  removeFromTaskbar(winId) {
    const taskbarItem = document.getElementById(`taskbar-${winId}`);
    if (taskbarItem) taskbarItem.remove();
    this.openWindows.delete(winId);
  }

  bringToFront(win) {
    win.style.zIndex = this.zIndexCounter++;
  }

  minimizeWindow(win) {
    win.style.display = "none";
    const taskbarItem = document.getElementById(`taskbar-${win.id}`);
    if (taskbarItem) taskbarItem.style.background = "#1a1a1a";
  }

  toggleFullscreen(win) {
    const wasFullscreen = win.dataset.fullscreen === "true";
    const header = win.querySelector(".window-header");

    if (wasFullscreen) {
      if (document.fullscreenElement === win) {
        document.exitFullscreen();
      }

      Object.assign(win.style, {
        width: win.dataset.prevWidth,
        height: win.dataset.prevHeight,
        left: win.dataset.prevLeft,
        top: win.dataset.prevTop
      });

      if (header) header.style.display = "";
      win.dataset.fullscreen = "false";
    } else {
      Object.assign(win.dataset, {
        prevWidth: win.style.width,
        prevHeight: win.style.height,
        prevLeft: win.style.left,
        prevTop: win.style.top
      });

      const makeFullscreen = () => {
        Object.assign(win.style, {
          width: "100vw",
          height: "100vh",
          left: "0",
          top: "0"
        });
        if (header) header.style.display = "none";
      };

      if (win.requestFullscreen) {
        win.requestFullscreen().then(makeFullscreen).catch(makeFullscreen);
      } else {
        makeFullscreen();
      }

      win.dataset.fullscreen = "true";

      const onFullscreenChange = () => {
        if (!document.fullscreenElement) {
          if (header) header.style.display = "";
          win.dataset.fullscreen = "false";
          document.removeEventListener("fullscreenchange", onFullscreenChange);
        }
      };

      document.addEventListener("fullscreenchange", onFullscreenChange);
    }
  }

  setupWindowControls(win) {
    win.querySelector(".close-btn").onclick = () => {
      this.removeFromTaskbar(win.id);
      win.remove();
    };
    win.querySelector(".minimize-btn").onclick = () => this.minimizeWindow(win);
    win.querySelector(".maximize-btn").onclick = () => this.toggleFullscreen(win);
    win.addEventListener("mousedown", () => this.bringToFront(win));
  }

  makeDraggable(win) {
    const header = win.querySelector(".window-header");
    header.onmousedown = (e) => {
      if (e.target.tagName === "BUTTON") return;
      const ox = e.clientX - win.offsetLeft;
      const oy = e.clientY - win.offsetTop;
      document.onmousemove = (e) => {
        win.style.left = `${e.clientX - ox}px`;
        win.style.top = `${e.clientY - oy}px`;
      };
      document.onmouseup = () => (document.onmousemove = null);
    };
  }

  makeResizable(win) {
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

    win.addEventListener("mousemove", (e) => {
      const dir = getDirection(e);
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
      win.style.cursor = cursorMap[dir] || "default";
    });

    win.addEventListener("mousedown", (e) => {
      const direction = getDirection(e);
      if (!direction) return;

      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const rect = win.getBoundingClientRect();
      const startWidth = rect.width;
      const startHeight = rect.height;
      const startLeft = rect.left;
      const startTop = rect.top;

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
        const MIN_SIZE = 300;

        if (newWidth > MIN_SIZE) {
          win.style.width = `${newWidth}px`;
          win.style.left = `${newLeft}px`;
        }
        if (newHeight > MIN_SIZE) {
          win.style.height = `${newHeight}px`;
          win.style.top = `${newTop}px`;
        }
      };

      const stopDrag = () => {
        document.removeEventListener("mousemove", doDrag);
        document.removeEventListener("mouseup", stopDrag);
      };

      document.addEventListener("mousemove", doDrag);
      document.addEventListener("mouseup", stopDrag);
    });
  }
}
