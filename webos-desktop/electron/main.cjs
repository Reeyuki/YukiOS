const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, desktopCapturer, screen, Notification, session, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { execSync, exec, spawn } = require("child_process");

const isDev = !app.isPackaged;

const ICON_PATH = path.join(__dirname, "..", "dist", "icon-32.png");
const TRAY_ICON_PATH = path.join(__dirname, "..", "dist", "icon-16.png");

const ANALYTICS_BASE = "https://analytics.liventcord-a60.workers.dev";

function getFFmpegFilename() {
  const key = `${process.platform}-${process.arch}`;
  const map = {
    "win32-x64": "win32-x64.exe",
    "win32-ia32": "win32-ia32.exe",
    "darwin-x64": "darwin-x64",
    "darwin-arm64": "darwin-arm64",
    "linux-x64": "linux-x64",
    "linux-arm64": "linux-arm64"
  };
  return map[key];
}

function getFFmpegCachePath() {
  const name = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  return path.join(app.getPath("userData"), "ffmpeg-bin", name);
}

function getFFmpegDownloadURLs() {
  const filename = getFFmpegFilename();
  if (!filename) return [];
  return [
    `https://github.com/nickel-org/ffmpeg-static/releases/download/v5.1.0/${filename}`,
    `https://github.com/eugeneware/ffmpeg-static/releases/download/v5.1.0/${filename}`
  ];
}

async function ensureFFmpeg() {
  const cachePath = getFFmpegCachePath();
  if (fs.existsSync(cachePath)) {
    try {
      execSync(`"${cachePath}" -version`, { timeout: 5000 });
      return cachePath;
    } catch {}
    fs.unlinkSync(cachePath);
  }

  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const urls = getFFmpegDownloadURLs();
  let downloaded = false;

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1024 * 1024) continue;
      fs.writeFileSync(cachePath, buf);
      fs.chmodSync(cachePath, 0o755);
      execSync(`"${cachePath}" -version`, { timeout: 5000 });
      downloaded = true;
      break;
    } catch {}
  }

  if (!downloaded) {
    throw new Error(
      "Could not download FFmpeg. The file converter will use the browser-based (WASM) FFmpeg instead, which is slower but works."
    );
  }

  return cachePath;
}

function sendAnalytics(endpoint, payload) {
  try {
    const body = JSON.stringify(Array.isArray(payload) ? payload : [payload]);
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    }).catch(() => {});
  } catch {}
}

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
  } else {
    Menu.setApplicationMenu(null);
  }

  setupInputHandlers();
  setupRemoteHostHandlers();
  setupAnalyticsHandlers();
  setupFFmpegHandlers();

  sendAnalytics(ANALYTICS_BASE + "/api/electron-usage", {
    action: "app:start",
    platform: process.platform,
    version: app.getVersion(),
    details: "Electron app started",
    isDev,
    timestamp: Date.now()
  });

  mainWindow.webContents.on("did-finish-load", () => {
    sendAnalytics(ANALYTICS_BASE + "/api/electron-usage", {
      action: "app:ready",
      platform: process.platform,
      version: app.getVersion(),
      details: "Main window loaded",
      isDev,
      timestamp: Date.now()
    });
  });

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
  sendAnalytics(ANALYTICS_BASE + "/api/electron-usage", {
    action: "app:quit",
    platform: process.platform,
    version: app.getVersion(),
    details: "Electron app quitting",
    isDev,
    timestamp: Date.now()
  });
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
        lastMouseX = px;
        lastMouseY = py;
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
        const isRight = input.button === "right";
        if (platform === "linux") {
          const btn = isRight ? 3 : 1;
          if (isWayland) {
            execSync(`ydotool ${isDown ? "mousedown" : "mouseup"} ${btn} 2>/dev/null || true`);
          } else {
            execSync(`xdotool ${isDown ? "mousedown" : "mouseup"} ${btn} 2>/dev/null || true`);
          }
        } else if (platform === "darwin") {
          try {
            execSync(`cliclick ${isRight ? "rc" : "c"}:${lastMouseX},${lastMouseY} 2>/dev/null || true`, { timeout: 500 });
          } catch {
            const btn = isRight ? " using {control down}" : "";
            if (isDown) {
              execSync(`osascript -e 'tell application "System Events" to click at {${lastMouseX}, ${lastMouseY}}${btn}' 2>/dev/null || true`);
            }
          }
        } else if (platform === "win32") {
          const [dn, up] = isRight ? ["0x0008", "0x0010"] : ["0x0002", "0x0004"];
          const cmd = isDown ? dn : up;
          execSync(`powershell -Command "Add-Type @\\\"using System;using System.Runtime.InteropServices;public class W{public delegate void m(int f,int x,int y,int d,int e);[DllImport(\\\"user32\\\")]public static extern void mouse_event(int f,int x,int y,int d,int e);}\\\";[W]::mouse_event(${cmd},0,0,0,0)" 2>/dev/null || true`);
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
          const dy = input.deltaY || 0;
          if (dy !== 0) {
            try {
              execSync(`python3 -c "
import ctypes,ctypes.util,sys
f=ctypes.cdll.LoadLibrary(ctypes.util.find_library('CoreGraphics'))
C=f.CGEventCreateScrollWheelEvent;C.restype=ctypes.c_void_p;C.argtypes=[ctypes.c_void_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.c_int32]
p=f.CGEventPost;p.restype=None;p.argtypes=[ctypes.c_void_p,ctypes.c_void_p]
e=C(None,1,1,${Math.round(dy)})
p(0,e)
" 2>/dev/null`, { timeout: 500 });
            } catch {}
          }
        } else if (platform === "win32") {
          const dy = Math.round(input.deltaY);
          if (dy !== 0) {
            const d = Math.min(Math.max(dy, -120), 120);
            execSync(`powershell -Command "Add-Type @\\\"using System;using System.Runtime.InteropServices;public class W{public delegate void m(int f,int x,int y,int d,int e);[DllImport(\\\"user32\\\")]public static extern void mouse_event(int f,int x,int y,int d,int e);}\\\";[W]::mouse_event(0x0800,0,0,${d},0)" 2>/dev/null || true`);
          }
        }
        break;

      case "gamepad":
        simulateGamepad(input);
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

const GAMEPAD_BUTTON_MAP = [
  { key: " ", code: "Space" },       // 0: A
  { key: "Escape", code: "Escape" }, // 1: B
  { key: "Shift", code: "ShiftLeft" },// 2: X
  { key: "Tab", code: "Tab" },       // 3: Y
  { key: "q", code: "KeyQ" },        // 4: LB
  { key: "e", code: "KeyE" },        // 5: RB
  { key: "Control", code: "ControlLeft" },// 6: LT
  { key: "Alt", code: "AltLeft" },   // 7: RT
  { key: "Tab", code: "Tab" },       // 8: Select
  { key: "Enter", code: "Enter" },   // 9: Start
  { key: "Shift", code: "ShiftLeft" },// 10: L3
  { key: "Control", code: "ControlLeft" },// 11: R3
  { key: "ArrowUp", code: "ArrowUp" },   // 12: D-pad Up
  { key: "ArrowDown", code: "ArrowDown" },// 13: D-pad Down
  { key: "ArrowLeft", code: "ArrowLeft" },// 14: D-pad Left
  { key: "ArrowRight", code: "ArrowRight" }// 15: D-pad Right
];

const GAMEPAD_AXIS_THRESHOLD = 0.4;
let prevGamepadState = { buttons: [], axes: [] };

function simulateGamepad(input) {
  const platform = process.platform;
  const isWayland = process.env.XDG_SESSION_TYPE === "wayland";
  const buttons = input.buttons || [];
  const axes = input.axes || [];
  const prev = prevGamepadState;

  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    const prevB = prev.buttons[i];
    if (!b || !prevB) continue;
    if (b.p === prevB.p) continue;
    const map = GAMEPAD_BUTTON_MAP[i];
    if (!map) continue;
    if (platform === "linux") {
      if (isWayland) {
        const code = mapKeyToYdotool(map.key, map.code);
        if (code !== null) execSync(`ydotool ${b.p ? "keydown" : "keyup"} ${code} 2>/dev/null || true`);
      } else {
        const key = mapKeyToXdotool(map.key);
        if (key) execSync(`xdotool ${b.p ? "keydown" : "keyup"} ${key} 2>/dev/null || true`);
      }
    } else if (platform === "darwin") {
      const k = map.key === " " ? "space" : map.key;
      execSync(`osascript -e 'tell application "System Events" to ${b.p ? "key down" : "key up"} "${k}"' 2>/dev/null || true`);
    } else if (platform === "win32") {
      const k = mapKeyToWindows(map.key);
      if (k) execSync(`powershell -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('${k}')" 2>/dev/null || true`);
    }
  }

  if (axes.length >= 2) {
    const dx = Math.abs(axes[0]) > GAMEPAD_AXIS_THRESHOLD ? axes[0] : 0;
    const dy = Math.abs(axes[1]) > GAMEPAD_AXIS_THRESHOLD ? axes[1] : 0;
    if (dx !== 0 || dy !== 0) {
      const moveX = Math.round(dx * 10);
      const moveY = Math.round(dy * 10);
      if (platform === "linux") {
        if (isWayland) execSync(`ydotool mousemove ${moveX} ${moveY} 2>/dev/null || true`);
        else execSync(`xdotool mousemove_relative -- ${moveX} ${moveY} 2>/dev/null || true`);
      }
    }
  }

  if (axes.length >= 4) {
    const lx = Math.abs(axes[2]) > GAMEPAD_AXIS_THRESHOLD ? axes[2] : 0;
    const ly = Math.abs(axes[3]) > GAMEPAD_AXIS_THRESHOLD ? axes[3] : 0;
    const wasdInput = [];
    if (ly < -GAMEPAD_AXIS_THRESHOLD) wasdInput.push({ type: "keydown", key: "w", code: "KeyW" });
    else wasdInput.push({ type: "keyup", key: "w", code: "KeyW" });
    if (ly > GAMEPAD_AXIS_THRESHOLD) wasdInput.push({ type: "keydown", key: "s", code: "KeyS" });
    else wasdInput.push({ type: "keyup", key: "s", code: "KeyS" });
    if (lx < -GAMEPAD_AXIS_THRESHOLD) wasdInput.push({ type: "keydown", key: "a", code: "KeyA" });
    else wasdInput.push({ type: "keyup", key: "a", code: "KeyA" });
    if (lx > GAMEPAD_AXIS_THRESHOLD) wasdInput.push({ type: "keydown", key: "d", code: "KeyD" });
    else wasdInput.push({ type: "keyup", key: "d", code: "KeyD" });
    for (const ev of wasdInput) {
      if (platform === "linux") {
        if (isWayland) {
          const code = mapKeyToYdotool(ev.key, ev.code);
          if (code !== null) execSync(`ydotool ${ev.type === "keydown" ? "keydown" : "keyup"} ${code} 2>/dev/null || true`);
        } else {
          const key = mapKeyToXdotool(ev.key);
          if (key) execSync(`xdotool ${ev.type === "keydown" ? "keydown" : "keyup"} ${key} 2>/dev/null || true`);
        }
      } else if (platform === "darwin") {
        execSync(`osascript -e 'tell application "System Events" to ${ev.type === "keydown" ? "key down" : "key up"} "${ev.key}"' 2>/dev/null || true`);
      } else if (platform === "win32") {
        const k = mapKeyToWindows(ev.key);
        if (k) execSync(`powershell -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('${k}')" 2>/dev/null || true`);
      }
    }
  }

  prevGamepadState = {
    buttons: buttons.map(b => ({ p: b.p })),
    axes: [...axes]
  };
}

// ---- GStreamer Pipeline ----

let gstreamerProc = null;

function checkGstreamer() {
  try {
    execSync("gst-launch-1.0 --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function startGstreamerPipeline(quality, fps, onFrame, onError) {
  const height = quality === "1080p" ? 1080 : 720;
  const width = Math.round(height * 16 / 9);
  const framerate = fps || 30;
  const platform = process.platform;

  let source;
  if (platform === "linux") {
    const wl = process.env.XDG_SESSION_TYPE === "wayland" || !!process.env.WAYLAND_DISPLAY;
    source = wl ? "pipewiresrc" : "ximagesrc use-damage=false";
  } else if (platform === "win32") {
    source = "dxgiscreencapsrc";
  } else if (platform === "darwin") {
    source = "avfvideosrc capture-screen=true";
  } else {
    onError("Unsupported platform");
    return null;
  }

  const pipeline = [
    "gst-launch-1.0 -q",
    source,
    `! videoconvert ! videoscale ! video/x-raw,width=${width},height=${height},framerate=${framerate}/1,format=I420`,
    "! x264enc speed-preset=ultrafast tune=zerolatency bitrate=2000 key-int-max=" + (framerate * 2),
    "! h264parse config-interval=1",
    "! video/x-h264,alignment=nal",
    "! fdsink fd=1"
  ].join(" ");

  try {
    const proc = spawn("sh", ["-c", pipeline], { stdio: ["pipe", "pipe", "pipe"] });
    gstreamerProc = proc;

    let nalBuf = Buffer.alloc(0);

    proc.stdout.on("data", (data) => {
      nalBuf = Buffer.concat([nalBuf, data]);
      while (nalBuf.length >= 4) {
        let scLen = 0, scPos = -1;
        for (let i = 0; i <= nalBuf.length - 3; i++) {
          if (nalBuf[i] === 0 && nalBuf[i + 1] === 0) {
            if (nalBuf[i + 2] === 1) { scLen = 3; scPos = i; break; }
            if (i <= nalBuf.length - 4 && nalBuf[i + 2] === 0 && nalBuf[i + 3] === 1) { scLen = 4; scPos = i; break; }
          }
        }
        if (scPos === -1) break;

        let nextSc = -1;
        for (let i = scPos + scLen; i <= nalBuf.length - 3; i++) {
          if (nalBuf[i] === 0 && nalBuf[i + 1] === 0) {
            if (nalBuf[i + 2] === 1) { nextSc = i; break; }
            if (i <= nalBuf.length - 4 && nalBuf[i + 2] === 0 && nalBuf[i + 3] === 1) { nextSc = i; break; }
          }
        }
        if (nextSc === -1) {
          if (nalBuf.length > 1048576) {
            const data = nalBuf.slice(scPos + scLen);
            nalBuf = Buffer.alloc(0);
            if (data.length > 0) onFrame(data, (data[0] & 0x1F) === 5);
          }
          break;
        }
        const nal = nalBuf.slice(scPos + scLen, nextSc);
        nalBuf = nalBuf.slice(nextSc);
        if (nal.length > 0) onFrame(nal, (nal[0] & 0x1F) === 5);
      }
    });

    proc.stderr.on("data", (d) => { if (isDev) process.stderr.write("[GStreamer] " + d); });

    proc.on("error", (err) => { gstreamerProc = null; onError(err.message); });
    proc.on("close", (code) => {
      gstreamerProc = null;
      if (code !== 0 && code !== null) onError("GStreamer exited with code " + code);
    });

    return proc;
  } catch (err) {
    onError(err.message);
    return null;
  }
}

function stopGstreamerPipeline() {
  if (gstreamerProc) {
    gstreamerProc.kill("SIGTERM");
    setTimeout(() => {
      if (gstreamerProc) { gstreamerProc.kill("SIGKILL"); gstreamerProc = null; }
    }, 3000);
    gstreamerProc = null;
  }
}

// ---- IPC Handlers ----

let tray = null;
let rebuildTrayMenu = null;

let lastMouseX = 0;
let lastMouseY = 0;

const TURN_SECRET = process.env.TURN_SECRET || "";
const TURN_URL = process.env.TURN_URL || "turn:turn.example.com:3478";
const TURNS_URL = process.env.TURNS_URL || "turns:turn.example.com:5349";

function getTurnCreds() {
  if (!TURN_SECRET) return null;
  const expiry = Math.floor(Date.now() / 1000) + 86400;
  const username = expiry + ":yukios";
  const credential = crypto.createHmac("sha1", TURN_SECRET).update(username).digest("base64");
  return { urls: [TURN_URL, TURNS_URL].filter(Boolean), username, credential };
}

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

  ipcMain.handle("remote-host:turn-creds", () => getTurnCreds());
}

function setupAnalyticsHandlers() {
  ipcMain.handle("analytics:track-download", async (event, info) => {
    try {
      const payload = {
        app: info.app || "electron",
        fileName: info.fileName || "unknown",
        fileSize: typeof info.fileSize === "number" ? info.fileSize : 0,
        fileType: info.fileType || "",
        source: info.source || "electron-filesave",
        timestamp: Date.now()
      };
      sendAnalytics(ANALYTICS_BASE + "/api/download", payload);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("analytics:track-electron-usage", async (event, info) => {
    try {
      const payload = {
        action: info.action || "unknown",
        platform: process.platform,
        version: app.getVersion(),
        details: info.details || "",
        isDev,
        timestamp: Date.now()
      };
      sendAnalytics(ANALYTICS_BASE + "/api/electron-usage", payload);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

let _ffmpegPath = null;

function setupFFmpegHandlers() {
  ipcMain.handle("ffmpeg:ensure", async () => {
    try {
      if (!_ffmpegPath || !fs.existsSync(_ffmpegPath)) {
        _ffmpegPath = await ensureFFmpeg();
      }
      return { success: true, path: _ffmpegPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("ffmpeg:convert", async (event, { fileData, inputExt, outputExt, extraArgs }) => {
    try {
      if (!_ffmpegPath || !fs.existsSync(_ffmpegPath)) {
        _ffmpegPath = await ensureFFmpeg();
      }

      const tmpDir = app.getPath("temp");
      const inputFile = path.join(tmpDir, `ffmpeg-input-${Date.now()}.${inputExt}`);
      const outputFile = path.join(tmpDir, `ffmpeg-output-${Date.now()}.${outputExt}`);

      const buf = fileData.buffer
        ? Buffer.from(fileData.buffer, fileData.byteOffset, fileData.byteLength)
        : Buffer.from(fileData);
      fs.writeFileSync(inputFile, buf);

      const args = ["-y", "-i", inputFile, ...(extraArgs || []), outputFile];

      await new Promise((resolve, reject) => {
        const proc = spawn(_ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
        let stderr = "";
        proc.stderr.on("data", (d) => { stderr += d.toString(); });
        proc.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-200)}`));
        });
        proc.on("error", reject);
      });

      const outBuf = fs.readFileSync(outputFile);

      try { fs.unlinkSync(inputFile); } catch {}
      try { fs.unlinkSync(outputFile); } catch {}

      return { success: true, data: outBuf };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("ffmpeg:probe", async (event, { fileData, inputExt }) => {
    try {
      if (!_ffmpegPath || !fs.existsSync(_ffmpegPath)) {
        _ffmpegPath = await ensureFFmpeg();
      }

      const tmpDir = app.getPath("temp");
      const inputFile = path.join(tmpDir, `ffmpeg-probe-${Date.now()}.${inputExt}`);
      fs.writeFileSync(inputFile, Buffer.from(fileData));

      const result = execSync(`"${_ffmpegPath}" -i "${inputFile}" 2>&1`, { timeout: 10000 }).toString();

      try { fs.unlinkSync(inputFile); } catch {}

      const info = {};
      const dur = result.match(/Duration:\s*(\d+:\d+:\d+\.\d+)/);
      if (dur) info.duration = dur[1];
      const bitrate = result.match(/bitrate:\s*(\d+)\s*kb\/s/);
      if (bitrate) info.bitrate = parseInt(bitrate[1]);
      const videoStream = result.match(/Stream.*Video.*?(\d+x\d+)/);
      if (videoStream) {
        const [w, h] = videoStream[1].split("x").map(Number);
        info.width = w;
        info.height = h;
      }
      const audioStream = result.match(/Stream.*Audio/);
      info.hasAudio = !!audioStream;

      return { success: true, info };
    } catch (err) {
      return { success: false, error: err.message };
    }
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

      const quality = (config && config.quality) || "1080p";
      const fps = (config && config.fps) || 30;
      const pb = primary.workAreaSize || primary.size;
      const useGst = config && config.useGstreamer === true;
      const qs = new URLSearchParams({ quality, fps: String(fps), mw: String(pb.width), mh: String(pb.height), gstreamer: useGst ? "1" : "0" });
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

  ipcMain.handle("remote-host:gstreamer-available", () => checkGstreamer());

  ipcMain.handle("remote-host:gstreamer-start", async (event, config) => {
    stopGstreamerPipeline();
    const quality = (config && config.quality) || "1080p";
    const fps = (config && config.fps) || 30;

    return new Promise((resolve) => {
      startGstreamerPipeline(quality, fps,
        (nalData, keyframe) => {
          if (remoteHostWindow && !remoteHostWindow.isDestroyed()) {
            remoteHostWindow.webContents.send("remote-host:event", {
              type: "gstreamer-frame",
              data: Array.from(nalData),
              keyframe,
              ts: Date.now() * 1000
            });
          }
        },
        (error) => {
          if (remoteHostWindow && !remoteHostWindow.isDestroyed()) {
            remoteHostWindow.webContents.send("remote-host:event", { type: "gstreamer-error", error });
          }
          resolve({ success: false, error });
        }
      );
      resolve({ success: true });
    });
  });

  ipcMain.handle("remote-host:gstreamer-stop", () => {
    stopGstreamerPipeline();
    return { success: true };
  });

  ipcMain.handle("file:save", async (event, { fileName, data, analytics }) => {
    try {
      const downloads = app.getPath("downloads");
      const filePath = path.join(downloads, fileName);
      fs.writeFileSync(filePath, Buffer.from(data));

      if (analytics !== false) {
        const ext = path.extname(fileName).replace(".", "").toLowerCase();
        sendAnalytics(ANALYTICS_BASE + "/api/download", {
          app: (analytics && analytics.app) || "electron",
          fileName,
          fileSize: Buffer.from(data).length,
          fileType: ext || "unknown",
          source: (analytics && analytics.source) || "electron-filesave",
          timestamp: Date.now()
        });
      }

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
