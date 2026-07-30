const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, desktopCapturer, screen, Notification, session, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");
const { execSync, exec } = require("child_process");

const isDev = !app.isPackaged;

const ICON_PATH = path.join(__dirname, "..", "dist", "icon-32.png");
const TRAY_ICON_PATH = path.join(__dirname, "..", "dist", "icon-16.png");

let mainWindow = null;
let remoteHostWindow = null;
let fsRoot = null;

function resolveFsPath(filePath, absolute) {
  return absolute ? filePath : path.join(fsRoot, filePath);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: "#0d0d0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [`--yukios-dev=${!app.isPackaged}`]
    },
    icon: ICON_PATH
  });

  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require("electron").shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  app.commandLine.appendSwitch("enable-usermedia-screen-capturing");

  createWindow();
  setupTray();

  if (isDev) {
    mainWindow.webContents.openDevTools();

    globalShortcut.register("F12", () => {
      const focused = BrowserWindow.getFocusedWindow();
      if (focused) {
        focused.webContents.toggleDevTools();
      }
    });
  }

  setupInputHandlers();
  setupRemoteHostHandlers();

  globalShortcut.register("Alt+Space", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
  createWindow();

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "media") {
      callback(true);
    } else {
      callback(false);
    }
  });
  } else {
    mainWindow.show();
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
  if (remoteHostWindow) {
    remoteHostWindow.close();
    remoteHostWindow = null;
  }
});

// ---- Input Simulation ----

const isWayland = process.env.XDG_SESSION_TYPE === "wayland" || !!process.env.WAYLAND_DISPLAY;

function getScreenSize() {
  const primary = screen.getPrimaryDisplay();
  return { width: primary.size.width, height: primary.size.height };
}

function toPixels(ratio, dimension) {
  return Math.round(Math.max(0, Math.min(1, ratio || 0)) * dimension);
}

function simulateInput(input) {
  if (!input || !input.type) return;
  const platform = process.platform;

  try {
    switch (input.type) {
      case "mousemove": {
        const { width, height } = getScreenSize();
        const px = toPixels(input.x, width);
        const py = toPixels(input.y, height);
        if (platform === "linux") {
          if (isWayland) {
            execSync(`ydotool mousemove --absolute -x ${px} -y ${py} 2>/dev/null || true`);
          } else {
            execSync(`xdotool mousemove ${px} ${py} 2>/dev/null || true`);
          }
        } else if (platform === "darwin") {
          execSync(`osascript -e 'tell application "System Events" to set mouse position to {${px}, ${py}}' 2>/dev/null || true`);
        } else if (platform === "win32") {
          execSync(`powershell -Command "[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${px}, ${py})" 2>/dev/null || true`);
        }
        break;
      }

      case "mousedown":
      case "mouseup": {
        const isDown = input.type === "mousedown";
        if (platform === "linux") {
          const btn = input.button === "right" ? 3 : 1;
          if (isWayland) {
            execSync(`ydotool ${isDown ? "mousedown" : "mouseup"} ${btn} 2>/dev/null || true`);
          } else {
            execSync(`xdotool ${isDown ? "mousedown" : "mouseup"} ${btn} 2>/dev/null || true`);
          }
        } else if (platform === "darwin") {
          execSync(`osascript -e 'tell application "System Events" to ${isDown ? "click" : "click"} (process 1)' 2>/dev/null || true`);
        } else if (platform === "win32") {
          execSync(`powershell -Command "[System.Windows.Forms.Cursor]::Position = [System.Windows.Forms.Cursor]::Position" 2>/dev/null || true`);
        }
        break;
      }

      case "keydown":
      case "keyup": {
        if (platform === "linux") {
          if (isWayland) {
            const code = mapKeyToYdotool(input.key, input.code);
            if (code !== null) {
              execSync(`ydotool ${input.type === "keydown" ? "keydown" : "keyup"} ${code} 2>/dev/null || true`);
            }
          } else {
            const key = mapKeyToXdotool(input.key);
            if (key) {
              execSync(`xdotool ${input.type === "keydown" ? "keydown" : "keyup"} ${key} 2>/dev/null || true`);
            }
          }
        } else if (platform === "darwin") {
          const k = input.key === " " ? "space" : input.key;
          exec(`osascript -e 'tell application "System Events" to ${input.type === "keydown" ? "key down" : "key up"} "${k}"' 2>/dev/null || true`);
        } else if (platform === "win32") {
          const k = mapKeyToWindows(input.key);
          if (k) {
            execSync(`powershell -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('${k}')" 2>/dev/null || true`);
          }
        }
        break;
      }

      case "scroll":
        if (platform === "linux") {
          const dy = Math.round(input.deltaY / 120);
          if (dy > 0) {
            if (isWayland) execSync("ydotool click 6 2>/dev/null || true");
            else execSync("xdotool click 5 2>/dev/null || true");
          } else if (dy < 0) {
            if (isWayland) execSync("ydotool click 4 2>/dev/null || true");
            else execSync("xdotool click 4 2>/dev/null || true");
          }
        } else if (platform === "darwin") {
        } else if (platform === "win32") {
        }
        break;
    }
  } catch (err) {
    console.error("Input simulation error:", err.message);
  }
}

function mapKeyToXdotool(key) {
  const map = {
    "Enter": "Return", "Escape": "Escape", "Tab": "Tab",
    "Backspace": "BackSpace", "Delete": "Delete", "Home": "Home",
    "End": "End", "PageUp": "Page_Up", "PageDown": "Page_Down",
    "ArrowUp": "Up", "ArrowDown": "Down", "ArrowLeft": "Left", "ArrowRight": "Right",
    "Control": "Control_L", "Shift": "Shift_L", "Alt": "Alt_L", "Meta": "Super_L",
    "CapsLock": "Caps_Lock", " ": "space"
  };
  if (map[key]) return map[key];
  if (key && key.length === 1) return key;
  return null;
}

function mapKeyToYdotool(key, code) {
  const map = {
    "Escape": 1, "1": 2, "2": 3, "3": 4, "4": 5, "5": 6, "6": 7,
    "7": 8, "8": 9, "9": 10, "0": 11,
    "Backspace": 14, "Tab": 15,
    "CapsLock": 58, "Enter": 28, "Shift": 42, "Control": 29, "Alt": 56, "Meta": 125, " ": 57,
    "Delete": 111, "Home": 102, "End": 107, "PageUp": 104, "PageDown": 109,
    "ArrowUp": 103, "ArrowDown": 108, "ArrowLeft": 105, "ArrowRight": 106,
  };

  if (code && code.startsWith("Key") && code.length === 4) {
    return 30 + (code.charCodeAt(3) - 65);
  }
  if (code && code.startsWith("Digit") && code.length === 6) {
    const d = parseInt(code[5], 10);
    if (d === 0) return 11;
    return d + 1;
  }
  if (map[key] !== undefined) return map[key];
  if (key && key.length === 1 && key >= "a" && key <= "z") {
    return 30 + (key.charCodeAt(0) - 97);
  }
  return null;
}

function mapKeyToWindows(key) {
  const map = {
    "Enter": "{ENTER}", "Escape": "{ESC}", "Tab": "{TAB}",
    "Backspace": "{BACKSPACE}", "Delete": "{DELETE}", "Home": "{HOME}",
    "End": "{END}", "PageUp": "{PGUP}", "PageDown": "{PGDN}",
    "ArrowUp": "{UP}", "ArrowDown": "{DOWN}", "ArrowLeft": "{LEFT}", "ArrowRight": "{RIGHT}",
    "Control": "^", "Shift": "+", "Alt": "%",
    "CapsLock": "{CAPSLOCK}", " ": " "
  };
  if (map[key]) return map[key];
  if (key && key.length === 1) return `{${key}}`;
  return null;
}

// ---- IPC Handlers ----

let tray = null;
let rebuildTrayMenu = null;

let trayState = {
  dnd: false,
  muted: false,
  powerMode: "balanced",
  sessionMode: "normal",
  remoteDesktopActive: false,
  remoteDesktopCode: null
};

function setupTray() {
  const iconPath = TRAY_ICON_PATH;
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip("YukiOS");

  rebuildTrayMenu = () => {
    const autostart = app.getLoginItemSettings().openAtLogin;

    const remoteSubmenu = trayState.remoteDesktopActive
      ? [
          { label: `Status: Active`, enabled: false },
          { label: `Room: ${trayState.remoteDesktopCode}`, enabled: false },
          { type: "separator" },
          {
            label: "Copy Code",
            click: () => {
              clipboard.writeText(trayState.remoteDesktopCode.replace(/-/g, ""));
            }
          },
          {
            label: "Stop Sharing",
            click: () => {
              mainWindow.webContents.send("tray:action", { action: "remote-stop" });
            }
          }
        ]
      : [
          { label: "Status: Inactive", enabled: false }
        ];

    const menu = Menu.buildFromTemplate([
      {
        label: "Do Not Disturb",
        type: "checkbox",
        checked: trayState.dnd,
        click: () => {
          trayState.dnd = !trayState.dnd;
          mainWindow.webContents.send("tray:action", { action: "toggle-dnd" });
          rebuildTrayMenu();
        }
      },
      {
        label: "Mute",
        type: "checkbox",
        checked: trayState.muted,
        click: () => {
          trayState.muted = !trayState.muted;
          mainWindow.webContents.send("tray:action", { action: "toggle-mute" });
          rebuildTrayMenu();
        }
      },
      { type: "separator" },
      {
        label: "Power Mode",
        submenu: [
          {
            label: "Turbo",
            type: "radio",
            checked: trayState.powerMode === "turbo",
            click: () => {
              trayState.powerMode = "turbo";
              mainWindow.webContents.send("tray:action", { action: "set-power-mode", value: "turbo" });
              rebuildTrayMenu();
            }
          },
          {
            label: "Balanced",
            type: "radio",
            checked: trayState.powerMode === "balanced",
            click: () => {
              trayState.powerMode = "balanced";
              mainWindow.webContents.send("tray:action", { action: "set-power-mode", value: "balanced" });
              rebuildTrayMenu();
            }
          },
          {
            label: "High Quality",
            type: "radio",
            checked: trayState.powerMode === "high",
            click: () => {
              trayState.powerMode = "high";
              mainWindow.webContents.send("tray:action", { action: "set-power-mode", value: "high" });
              rebuildTrayMenu();
            }
          }
        ]
      },
      {
        label: "Desktop Mode",
        submenu: [
          {
            label: "Normal",
            type: "radio",
            checked: trayState.sessionMode === "normal",
            click: () => {
              trayState.sessionMode = "normal";
              mainWindow.webContents.send("tray:action", { action: "set-session-mode", value: "normal" });
              rebuildTrayMenu();
            }
          },
          {
            label: "Mac",
            type: "radio",
            checked: trayState.sessionMode === "mac",
            click: () => {
              trayState.sessionMode = "mac";
              mainWindow.webContents.send("tray:action", { action: "set-session-mode", value: "mac" });
              rebuildTrayMenu();
            }
          },
          {
            label: "ChromeOS",
            type: "radio",
            checked: trayState.sessionMode === "chromeos",
            click: () => {
              trayState.sessionMode = "chromeos";
              mainWindow.webContents.send("tray:action", { action: "set-session-mode", value: "chromeos" });
              rebuildTrayMenu();
            }
          },
          {
            label: "Tiling",
            type: "radio",
            checked: trayState.sessionMode === "tiling",
            click: () => {
              trayState.sessionMode = "tiling";
              mainWindow.webContents.send("tray:action", { action: "set-session-mode", value: "tiling" });
              rebuildTrayMenu();
            }
          }
        ]
      },
      { type: "separator" },
      {
        label: "Lock Screen",
        click: () => {
          mainWindow.webContents.send("tray:action", { action: "lock-screen" });
        }
      },
      { type: "separator" },
      {
        label: "Remote Desktop",
        submenu: remoteSubmenu
      },
      { type: "separator" },
      {
        label: "Autostart on boot",
        type: "checkbox",
        checked: autostart,
        click: () => {
          const newVal = !app.getLoginItemSettings().openAtLogin;
          app.setLoginItemSettings({ openAtLogin: newVal });
          rebuildTrayMenu();
        }
      },
      { type: "separator" },
      {
        label: "Show YukiOS",
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        }
      },
      {
        label: "Quit YukiOS",
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.setContextMenu(menu);
  };

  rebuildTrayMenu();
  tray.on("click", () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

function setupInputHandlers() {
  ipcMain.handle("app:get-autostart", () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle("app:set-autostart", (event, enabled) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
    if (rebuildTrayMenu) rebuildTrayMenu();
    return enabled;
  });

  ipcMain.on("tray:state-update", (event, state) => {
    if (state.dnd !== undefined) trayState.dnd = state.dnd;
    if (state.muted !== undefined) trayState.muted = state.muted;
    if (state.powerMode !== undefined) trayState.powerMode = state.powerMode;
    if (state.sessionMode !== undefined) trayState.sessionMode = state.sessionMode;
    if (state.remoteDesktopActive !== undefined) trayState.remoteDesktopActive = state.remoteDesktopActive;
    if (state.remoteDesktopCode !== undefined) trayState.remoteDesktopCode = state.remoteDesktopCode;
    if (rebuildTrayMenu) rebuildTrayMenu();
  });

  ipcMain.handle("input:simulate", (event, input) => {
    simulateInput(input);
  });

  ipcMain.handle("desktop-capturer:get-sources", async () => {
    const sources = await desktopCapturer.getSources({ types: ["screen"] });
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL()
    }));
  });

  ipcMain.handle("remote-host:settings", () => {
    const primaryDisplay = screen.getPrimaryDisplay();
    const isDev = !app.isPackaged;
    return {
      quality: isDev ? "1080p" : "720p",
      fps: isDev ? 60 : 30,
      displayCount: screen.getAllDisplays().length,
      primaryBounds: {
        width: primaryDisplay.size.width,
        height: primaryDisplay.size.height
      }
    };
  });
}

function setupRemoteHostHandlers() {
  ipcMain.on("remote-host:event", (event, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("remote-host:event", data);
    }
  });

  ipcMain.handle("remote-host:start", async (event, config) => {
    if (remoteHostWindow) {
      return { success: false, error: "Already running" };
    }

    try {
      const primary = screen.getPrimaryDisplay();
      const w = 320;
      const h = 200;

      remoteHostWindow = new BrowserWindow({
        width: w,
        height: h,
        x: primary.workArea.x + primary.workArea.width - w - 20,
        y: primary.workArea.y + primary.workArea.height - h - 60,
        show: true,
        frame: false,
        resizable: false,
        skipTaskbar: false,
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
          webSecurity: false
        }
      });

      const quality = (config && config.quality) || (isDev ? "1080p" : "720p");
      const fps = (config && config.fps) || (isDev ? 60 : 30);
      const pb = primary.workAreaSize || primary.size;
      const qs = new URLSearchParams({ quality, fps: String(fps), mw: String(pb.width), mh: String(pb.height) });
      remoteHostWindow.loadFile(path.join(__dirname, "remote-host.html"), { query: Object.fromEntries(qs) });

      if (isDev) {
        remoteHostWindow.webContents.openDevTools({ mode: "detach" });
      }

      remoteHostWindow.on("closed", () => {
        remoteHostWindow = null;
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("remote-host:stop", async () => {
    if (remoteHostWindow) {
      remoteHostWindow.close();
      remoteHostWindow = null;
    }
    return { success: true };
  });

  ipcMain.handle("remote-host:toggle-audio", () => {
    if (remoteHostWindow && !remoteHostWindow.isDestroyed()) {
      remoteHostWindow.webContents.executeJavaScript("setAudioEnabled(!hostAudioEnabled)");
    }
    return { success: true };
  });

  ipcMain.handle("remote-host:status", () => {
    return {
      running: remoteHostWindow !== null && !remoteHostWindow.isDestroyed()
    };
  });

  ipcMain.handle("file:save", async (event, { fileName, data }) => {
    try {
      const downloads = app.getPath("downloads");
      const filePath = path.join(downloads, fileName);
      fs.writeFileSync(filePath, Buffer.from(data));
      return { success: true, path: filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("remote-host:get-room", () => {
    try {
      const filePath = path.join(app.getPath("userData"), "remote-room.json");
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        return { roomId: data.roomId || null };
      }
      return { roomId: null };
    } catch {
      return { roomId: null };
    }
  });

  ipcMain.handle("remote-host:save-room", (event, roomId) => {
    try {
      const filePath = path.join(app.getPath("userData"), "remote-room.json");
      fs.writeFileSync(filePath, JSON.stringify({ roomId }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("remote-host:clear-room", () => {
    try {
      const filePath = path.join(app.getPath("userData"), "remote-room.json");
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("fs:init", (event, { sessionKey }) => {
    try {
      fsRoot = app.getPath("userData");
      const homeDir = path.join(fsRoot, "home", sessionKey || "guest");
      if (!fs.existsSync(homeDir)) {
        fs.mkdirSync(homeDir, { recursive: true });
      }
      const userHomeDir = require("os").homedir();
      return { success: true, homeDir: userHomeDir && userHomeDir !== "/" ? userHomeDir : null };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("fs:writeFile", async (event, { filePath, content, encoding, absolute }) => {
    try {
      const fullPath = resolveFsPath(filePath, absolute);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (content === undefined || content === null) {
        fs.writeFileSync(fullPath, "");
      } else if (encoding === "base64") {
        fs.writeFileSync(fullPath, Buffer.from(content, "base64"));
      } else if (typeof content === "string") {
        fs.writeFileSync(fullPath, content, "utf-8");
      } else {
        fs.writeFileSync(fullPath, Buffer.from(content));
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("fs:readFile", async (event, { filePath, encoding, absolute }) => {
    try {
      const fullPath = resolveFsPath(filePath, absolute);
      if (encoding === "base64") {
        const buf = fs.readFileSync(fullPath);
        return { success: true, data: buf.toString("base64"), encoding: "base64" };
      }
      const data = fs.readFileSync(fullPath, "utf-8");
      return { success: true, data, encoding: "utf8" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("fs:mkdir", async (event, { filePath, recursive, absolute }) => {
    try {
      const fullPath = resolveFsPath(filePath, absolute);
      if (recursive) {
        fs.mkdirSync(fullPath, { recursive: true });
      } else {
        fs.mkdirSync(fullPath);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("fs:readdir", async (event, { filePath, absolute }) => {
    try {
      const fullPath = resolveFsPath(filePath, absolute);
      const entries = fs.readdirSync(fullPath);
      return { success: true, entries };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("fs:unlink", async (event, { filePath, absolute }) => {
    try {
      fs.unlinkSync(resolveFsPath(filePath, absolute));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("fs:rmdir", async (event, { filePath, absolute }) => {
    try {
      fs.rmdirSync(resolveFsPath(filePath, absolute));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("fs:rename", async (event, { oldPath, newPath, absolute }) => {
    try {
      const fullOld = resolveFsPath(oldPath, absolute);
      const fullNew = resolveFsPath(newPath, absolute);
      const dir = path.dirname(fullNew);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.renameSync(fullOld, fullNew);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("fs:stat", async (event, { filePath, absolute }) => {
    try {
      const stat = fs.statSync(resolveFsPath(filePath, absolute));
      return {
        success: true,
        stat: {
          isDirectory: stat.isDirectory(),
          isFile: stat.isFile(),
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          birthtimeMs: stat.birthtimeMs
        }
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("fs:exists", async (event, { filePath, absolute }) => {
    try {
      return { success: true, exists: fs.existsSync(resolveFsPath(filePath, absolute)) };
    } catch {
      return { success: true, exists: false };
    }
  });

  ipcMain.handle("fs:copyFile", async (event, { src, dest, absolute }) => {
    try {
      const fullSrc = resolveFsPath(src, absolute);
      const fullDest = resolveFsPath(dest, absolute);
      const dir = path.dirname(fullDest);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.copyFileSync(fullSrc, fullDest);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("native-window:open-url", async (event, { url, title, width, height, icon }) => {
    if (!url) return { success: false, error: "No URL provided" };
    const nativeWin = new BrowserWindow({
      width: parseInt(width) || 1280,
      height: parseInt(height) || 720,
      title: title || "Game",
      icon: icon || undefined,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false
      },
      autoHideMenuBar: true,
      backgroundColor: "#0d0d0f"
    });
    nativeWin.loadURL(url);
    nativeWin.on("closed", () => {});
    return { success: true };
  });
}
