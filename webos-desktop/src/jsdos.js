import { desktop } from "./desktop.js";
import JSZip from "jszip";

export class JsDosApp {
  constructor(fileSystemManager, windowManager, explorerApp) {
    this._fs = fileSystemManager;
    this._windowManager = windowManager;
    this._explorerApp = explorerApp;
  }

  open() {
    if (document.getElementById("jsdos-win")) {
      this._windowManager.bringToFront(document.getElementById("jsdos-win"));
      return;
    }
    const win = this._windowManager.createWindow("jsdos-win", "js-dos", "600px", "400px");
    win.innerHTML = `
      <div class="window-header">
        <span>js-dos</span>
        ${this._windowManager.getWindowControls()}
      </div>
      <div class="window-content" style="width:100%;height:100%;">
        <div id="jsdos-container" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;height:100%;box-sizing:border-box;background:#1a1a2e;color:#eee;font-family:monospace;">
          <div style="font-size:48px;">💾</div>
          <div style="font-size:18px;font-weight:bold;color:#c77dff;">js-dos</div>
          <div style="color:#aaa;font-size:13px;text-align:center;">Run DOS/Win9x executables in your browser.<br>Open an .exe file from the File Explorer to launch it.</div>
          <div id="jsdos-status" style="color:#888;font-size:12px;margin-top:8px;"></div>
        </div>
      </div>`;
    desktop.appendChild(win);
    this._windowManager.makeDraggable(win);
    this._windowManager.makeResizable(win);
    this._windowManager.setupWindowControls(win);
    this._windowManager.addToTaskbar(win.id, "js-dos", "/static/icons/jsdos.webp");
  }

  _ensureJsDosAssets() {
    if (document.getElementById("jsdos-css")) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.id = "jsdos-css";
      link.rel = "stylesheet";
      link.href = "https://v8.js-dos.com/latest/js-dos.css";
      document.head.appendChild(link);

      if (window.Dos) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.id = "jsdos-js";
      script.src = "https://v8.js-dos.com/latest/js-dos.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Failed to load js-dos runtime."));
      document.head.appendChild(script);
    });
  }

  async _buildBundle(name, arrayBuffer) {
    const zip = new JSZip();
    const conf = [
      "[sdl]",
      "output=surface",
      "",
      "[dosbox]",
      "machine=svga_s3",
      "",
      "[cpu]",
      "core=auto",
      "cputype=auto",
      "cycles=max",
      "",
      "[autoexec]",
      `mount c /`,
      `c:`,
      `${name}`
    ].join("\n");
    zip.folder(".jsdos").file("dosbox.conf", conf);
    zip.file(name, arrayBuffer);
    return zip.generateAsync({ type: "blob" });
  }

  async launchExe(name, path) {
    const wm = this._windowManager;
    const winId = `jsdos-${Date.now()}`;
    const win = wm.createWindow(winId, name, "800px", "600px");
    win.innerHTML = `
    <div class="window-header">
      <span>${name}</span>
      ${wm.getWindowControls()}
    </div>
    <div class="window-content" style="width:100%;height:calc(100% - 30px);background:#000;position:relative;">
      <div id="${winId}-inner" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ccc;font-family:monospace;gap:12px;">
        <div style="font-size:36px;">💾</div>
        <div style="font-size:15px;color:#c77dff;">Loading <strong style="color:#fff;">${name}</strong>…</div>
        <div id="${winId}-log" style="font-size:11px;color:#888;max-width:400px;text-align:center;"></div>
      </div>
    </div>`;
    desktop.appendChild(win);
    wm.makeDraggable(win);
    wm.makeResizable(win);
    wm.addToTaskbar(winId, name, "/static/icons/jsdos.webp");

    const inner = win.querySelector(`#${winId}-inner`);
    const log = win.querySelector(`#${winId}-log`);
    const setLog = (msg) => {
      if (log) log.textContent = msg;
    };
    const showError = (msg) => {
      if (inner)
        inner.innerHTML = `
      <div style="font-size:32px;">⚠️</div>
      <div style="color:#ff6b6b;font-size:14px;font-family:monospace;">${msg}</div>`;
    };

    let dosProps = null;
    let ciRef = null;

    const cleanup = () => {
      try {
        ciRef?.mute();
      } catch {}
      try {
        dosProps?.stop();
      } catch {}
      URL.revokeObjectURL(bundleUrl);
    };

    win.querySelector(".close-btn").addEventListener("click", () => {
      cleanup();
      wm.removeFromTaskbar(winId);
      win.remove();
    });

    win.querySelector(".minimize-btn").addEventListener("click", () => {
      ciRef?.mute();
      wm.minimizeWindow(win);
    });

    let bundleUrl = null;

    try {
      setLog("Reading file…");
      const normalizedPath = Array.isArray(path)
        ? path
        : typeof path === "string"
          ? path.split("/").filter(Boolean)
          : Object.values(path ?? {}).filter((v) => typeof v === "string");

      const blob = await this._fs.readBinaryFile(normalizedPath, name);
      if (!blob || blob.size === 0) {
        showError("Failed to read file.");
        return;
      }

      const isBundle = name.toLowerCase().endsWith(".jsdos");

      setLog(isBundle ? "Preparing bundle…" : "Building js-dos bundle…");
      const arrayBuffer = await blob.arrayBuffer();
      const bundleBlob = isBundle
        ? new Blob([arrayBuffer], { type: "application/zip" })
        : await this._buildBundle(name, arrayBuffer);

      bundleUrl = URL.createObjectURL(bundleBlob);

      setLog("Loading js-dos runtime…");
      await this._ensureJsDosAssets();

      if (typeof Dos === "undefined") {
        showError("js-dos runtime unavailable.");
        return;
      }

      inner.innerHTML = "";
      inner.style.cssText = "width:100%;height:100%;";

      dosProps = Dos(inner, {
        url: bundleUrl,
        onEvent: (event, ci) => {
          if (event === "ci-ready") ciRef = ci;
        }
      });
    } catch (e) {
      showError(`Error: ${e.message}`);
    }
  }
}
