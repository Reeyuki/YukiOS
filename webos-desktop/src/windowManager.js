const styleEl = document.getElementById("window-style");
let styleParent = styleEl.parentNode;

function hideTransparency() {
  if (styleEl.parentNode) {
    styleParent.removeChild(styleEl);
  }
}

function restoreTransparency() {
  if (!styleEl.parentNode) {
    styleParent.appendChild(styleEl);
  }
}

export class WindowManager {
  constructor() {
    this.openWindows = new Map();
    this.zIndexCounter = 1000;
    this.gameWindowCount = 0;
  }
  updateTransparency() {
    if (this.gameWindowCount > 0) {
      hideTransparency();
    } else {
      restoreTransparency();
    }
  }
  createWindow(id, title, width = "80vw", height = "80vh", isGame = false) {
    const win = document.createElement("div");
    win.className = "window";
    win.id = id;
    win.dataset.fullscreen = "false";

    const widthStr = width != null ? String(width) : "80vw";
    const heightStr = height != null ? String(height) : "80vh";

    const vw = widthStr.includes("vw") ? (window.innerWidth * parseFloat(widthStr)) / 100 : parseInt(widthStr);
    const vh = heightStr.includes("vh") ? (window.innerHeight * parseFloat(heightStr)) / 100 : parseInt(heightStr);

    Object.assign(win.style, {
      width: `${vw}px`,
      height: `${vh}px`,
      left: `${(window.innerWidth - vw) / 2}px`,
      top: `${(window.innerHeight - vh) / 2}px`,
      position: "absolute",
      zIndex: this.zIndexCounter++
    });
    if (isGame) {
      this.gameWindowCount++;
    }
    this.updateTransparency();

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
    taskbarItem.oncontextmenu = (e) => {
      e.preventDefault();
      const existingMenu = document.getElementById("taskbar-context-menu");
      if (existingMenu) existingMenu.remove();

      const menu = document.createElement("div");
      menu.id = "taskbar-context-menu";
      menu.className = "kde-menu";

      const win = document.getElementById(winId);

      const addMenuItem = (text, action) => {
        const item = document.createElement("div");
        item.textContent = text;
        item.className = "kde-item";
        item.onclick = () => {
          action();
          menu.remove();
        };
        menu.appendChild(item);
      };

      addMenuItem(win.style.display === "none" ? "Restore" : "Minimize", () => {
        if (win.style.display === "none") win.style.display = "block";
        else this.minimizeWindow(win);
        this.bringToFront(win);
      });

      addMenuItem(win.dataset.fullscreen === "true" ? "Restore Size" : "Maximize", () => {
        this.toggleFullscreen(win);
        this.bringToFront(win);
      });

      addMenuItem("Bring to Front", () => this.bringToFront(win));

      addMenuItem("Properties", () => {
        const appInfo = this.openWindows.get(winId);
        if (!appInfo) return;

        const win = document.getElementById(winId);
        if (!win) return;

        const dataset = win.dataset;
        const rect = win.getBoundingClientRect();

        const infoLines = [
          `Window ID: ${winId}`,
          `Title: ${appInfo.title}`,
          dataset.appType ? `Type: ${dataset.appType}` : "",
          dataset.appId ? `App ID: ${dataset.appId}` : "",
          dataset.swf ? `SWF Path: ${dataset.swf}` : "",
          dataset.rom ? `ROM: ${dataset.rom}` : "",
          dataset.core ? `Core: ${dataset.core}` : "",
          dataset.externalUrl ? `URL: ${dataset.externalUrl}` : "",
          `Width: ${Math.round(rect.width)}px`,
          `Height: ${Math.round(rect.height)}px`,
          `Left: ${Math.round(rect.left)}px`,
          `Top: ${Math.round(rect.top)}px`,
          `Z-Index: ${win.style.zIndex}`,
          `Fullscreen: ${dataset.fullscreen === "true" ? "Yes" : "No"}`
        ].filter(Boolean);

        const contentHtml = infoLines.map((line) => `<div style="margin:2px 0;">${line}</div>`).join("");

        const propsWin = this.createWindow(`${winId}-props`, `Properties: ${appInfo.title}`, "40vw", "40vh");

        propsWin.innerHTML = `
          <div class="window-header">
            <span>Properties: ${appInfo.title}</span>
            <div class="window-controls">
              <button class="minimize-btn" title="Minimize">−</button>
              <button class="maximize-btn" title="Maximize">□</button>
              <button class="close-btn" title="Close">X</button>
            </div>
          </div>
          <div class="window-content" style="width:100%; height:100%; overflow:auto; user-select:text;">
            ${contentHtml}
          </div>
        `;

        desktop.appendChild(propsWin);
        this.makeDraggable(propsWin);
        this.makeResizable(propsWin);
        this.setupWindowControls(propsWin);
      });

      addMenuItem("Close Window", () => {
        this.removeFromTaskbar(winId);
        if (win) win.remove();
      });

      document.body.appendChild(menu);

      const rect = menu.getBoundingClientRect();
      let posX = e.pageX;
      let posBottom = window.innerHeight - e.pageY;

      if (posX + rect.width > window.innerWidth) posX = window.innerWidth - rect.width - 10;
      if (posBottom + rect.height > window.innerHeight) posBottom = 10;

      menu.style.setProperty("--ctx-left", `${posX}px`);
      menu.style.setProperty("--ctx-bottom", `${posBottom}px`);

      document.addEventListener("click", function removeMenu() {
        menu.remove();
        document.removeEventListener("click", removeMenu);
      });
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
    if (win) win.style.zIndex = this.zIndexCounter++;
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
      const isGame = win.dataset.isGame === "true";
      if (isGame) {
        this.gameWindowCount = Math.max(0, this.gameWindowCount - 1);
      }
      this.updateTransparency();
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
