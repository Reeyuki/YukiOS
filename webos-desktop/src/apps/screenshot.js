import "../styles/screenshot.css";
import { BaseApp, os } from "../framework.js";

export class ScreenshotApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
    this._win = null;
    this._recording = false;
    this._mediaRecorder = null;
    this._recordedChunks = [];
    this._cleanupOverlay = null;
    this._stream = null;
    this._autoSave = false;
    this._registerGlobalShortcuts();
  }

  _registerGlobalShortcuts() {
    const handler = (e) => {
      if (e.target.closest("input, textarea, [contenteditable]")) return;
      if (e.ctrlKey && e.shiftKey && e.key === "s") {
        e.preventDefault();
        if (!document.getElementById("screenshot")) this.open();
        this.captureFull(true);
      }
      if (e.ctrlKey && e.altKey && e.key === "s") {
        e.preventDefault();
        if (!document.getElementById("screenshot")) this.open();
        this.captureArea(true);
      }
      if (e.ctrlKey && e.shiftKey && e.key === "r") {
        e.preventDefault();
        if (!document.getElementById("screenshot")) this.open();
        this.toggleRecording();
      }
    };
    document.addEventListener("keydown", handler);
  }

  open() {
    const winId = "screenshot";
    if (document.getElementById(winId)) {
      os.window.focus(winId);
      return;
    }

    const win = os.window.create(winId, "Screenshot", "600px", "480px", {
      icon: "fas fa-camera"
    });

    win.classList.add("sc-window");
    win.innerHTML = this.buildUI();
    this._win = win;
    this.openWindows.add(winId);

    this.setupEvents(win);

    win.addEventListener("remove", () => {
      this.openWindows.delete(winId);
      this._win = null;
    });
  }

  buildUI() {
    return `
      <div class="sc-root">
        <div class="sc-toolbar">
          <button class="sc-btn" data-mode="full">
            <i class="fas fa-desktop"></i> Full Screen
          </button>
          <button class="sc-btn" data-mode="area">
            <i class="fas fa-crop-alt"></i> Area
          </button>
          <button class="sc-btn" data-mode="record">
            <i class="fas fa-video"></i> <span class="sc-record-label">Record</span>
          </button>
        </div>
        <div class="sc-preview" id="sc-preview">
          <div class="sc-preview-placeholder">
            <i class="fas fa-camera"></i>
            <span>Take a screenshot or start recording</span>
            <span style="font-size:12px;opacity:0.6">Ctrl+Shift+S · Ctrl+Alt+S · Ctrl+Shift+R</span>
          </div>
        </div>
        <div class="sc-actions" id="sc-actions" style="display:none">
          <button class="sc-action-btn" id="sc-download"><i class="fas fa-download"></i> Download</button>
          <button class="sc-action-btn secondary" id="sc-save"><i class="fas fa-save"></i> Save to Pictures</button>
          <button class="sc-action-btn secondary" id="sc-copy"><i class="fas fa-copy"></i> Copy</button>
        </div>
      </div>
    `;
  }

  setupEvents(win) {
    win.querySelector('[data-mode="full"]').addEventListener("click", () => this.captureFull());
    win.querySelector('[data-mode="area"]').addEventListener("click", () => this.captureArea(true));
    win.querySelector('[data-mode="record"]').addEventListener("click", () => this.toggleRecording());
    win.querySelector("#sc-download").addEventListener("click", () => this._downloadCurrent());
    win.querySelector("#sc-save").addEventListener("click", () => this._saveCurrent());
    win.querySelector("#sc-copy").addEventListener("click", () => this._copyCurrent());
  }

  async _loadHtml2canvasPro() {
    if (window.html2canvas) return;
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/html2canvas-pro@1.5.8/dist/html2canvas-pro.min.js";
    document.head.appendChild(s);
    await new Promise((resolve, reject) => {
      s.onload = resolve;
      s.onerror = () => reject(new Error("html2canvas-pro failed to load"));
    });
  }

  async _pageCapture() {
    try {
      await this._loadHtml2canvasPro();
    } catch (e) {
      console.warn("[Screenshot] html2canvas-pro CDN failed, trying getDisplayMedia fallback:", e);
      return await this._fallbackCapture();
    }
    const win = document.getElementById("screenshot");
    if (win) win.style.display = "none";
    const opts = [
      { useCORS: true, allowTaint: true, backgroundColor: null },
      { useCORS: false, allowTaint: false, backgroundColor: "#1a1a2e" }
    ];
    for (const extra of opts) {
      try {
        const canvas = await window.html2canvas(document.body, {
          ...extra,
          scale: window.devicePixelRatio || 1,
          width: window.innerWidth,
          height: window.innerHeight,
          x: window.scrollX,
          y: window.scrollY
        });
        if (win) win.style.display = "";
        return new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob), "image/png");
        });
      } catch (e) {
        if (e.name === "SecurityError") {
          console.warn("[Screenshot] canvas tainted with", extra, "retrying with safer options:", e);
          continue;
        }
        throw e;
      }
    }
    if (win) win.style.display = "";
    console.warn("[Screenshot] all html2canvas options tainted, trying getDisplayMedia fallback");
    return await this._fallbackCapture();
  }

  async _fallbackCapture() {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      preferCurrentTab: false,
      video: { displaySurface: "monitor" }
    });
    const track = stream.getVideoTracks()[0];
    const capture = new ImageCapture(track);
    const bitmap = await capture.grabFrame();
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    bitmap.close();
    stream.getTracks().forEach((t) => t.stop());
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  async captureFull(autoSave) {
    if (this._recording) return;
    try {
      this._showStatus("Capturing page...");
      const blob = await this._pageCapture();
      this._currentBlob = blob;
      this._currentType = "screenshot";
      if (autoSave) {
        await this._saveCurrent();
      }
      this._showResult(blob, "screenshot");
    } catch (e) {
      console.error("[Screenshot] captureFull failed:", e);
      this._showStatus("Capture failed: " + (e.message || "unknown error"));
    }
  }

  async captureArea(autoSave) {
    if (this._recording) return;
    try {
      this._showStatus("Capturing page...");
      const blob = await this._pageCapture();
      this._currentBlob = blob;
      this._currentType = "screenshot";
      this._autoSave = autoSave;
      this._showCropOverlay(blob);
    } catch (e) {
      console.error("[Screenshot] captureArea failed:", e);
      this._showStatus("Capture failed: " + (e.message || "unknown error"));
    }
  }

  async toggleRecording() {
    if (this._recording) {
      this._stopRecording();
      return;
    }
    try {
      this._showStatus("Select a screen to record...");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        preferCurrentTab: false,
        video: { displaySurface: "monitor" },
        audio: false
      });
      this._stream = stream;
      this._recordedChunks = [];
      this._mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      this._mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this._recordedChunks.push(e.data);
      };
      this._mediaRecorder.onstop = () => {
        const blob = new Blob(this._recordedChunks, { type: "video/webm" });
        this._recordedChunks = [];
        this._showResult(blob, "recording");
      };
      this._mediaRecorder.start();
      this._recording = true;
      this._updateRecordUI();
      os.notify.send("Screenshot", "Recording started. Press Ctrl+Shift+R to stop.");
    } catch {
      this._showStatus("Recording cancelled");
    }
  }

  _stopRecording() {
    if (this._mediaRecorder && this._mediaRecorder.state !== "inactive") {
      this._mediaRecorder.stop();
    }
    if (this._stream) {
      this._stream.getTracks().forEach((t) => t.stop());
    }
    this._recording = false;
    this._stream = null;
    this._mediaRecorder = null;
    this._updateRecordUI();
  }

  _updateRecordUI() {
    if (!this._win) return;
    const label = this._win.querySelector(".sc-record-label");
    if (!label) return;
    if (this._recording) {
      label.innerHTML = '<span class="sc-recording-indicator"><span class="sc-rec-dot"></span> Recording</span>';
    } else {
      label.textContent = "Record";
    }
  }

  _showStatus(msg) {
    const preview = document.getElementById("sc-preview");
    const actions = document.getElementById("sc-actions");
    if (preview) {
      preview.innerHTML = `<div class="sc-preview-placeholder"><span>${msg}</span></div>`;
    }
    if (actions) actions.style.display = "none";
  }

  _showResult(blob, type) {
    this._currentBlob = blob;
    this._currentType = type;
    const preview = document.getElementById("sc-preview");
    const actions = document.getElementById("sc-actions");
    if (!preview || !actions) return;

    const url = URL.createObjectURL(blob);
    if (type === "recording") {
      preview.innerHTML = `<video src="${url}" controls autoplay muted></video>`;
    } else {
      preview.innerHTML = `<img src="${url}" alt="Screenshot" />`;
    }

    this._currentUrl = url;
    actions.style.display = "flex";
  }

  _showCropOverlay(blob) {
    const url = URL.createObjectURL(blob);
    const overlay = document.createElement("div");
    overlay.className = "sc-overlay";

    const img = document.createElement("img");
    img.className = "sc-overlay-img";
    img.src = url;
    overlay.appendChild(img);

    let dragStart = null;
    let rectEl = null;

    const info = document.createElement("div");
    info.className = "sc-overlay-info";
    info.innerHTML = `
      <span>Drag to select area</span>
      <button class="sc-confirm-btn" id="sc-crop-confirm" disabled>Crop</button>
      <kbd>Esc</kbd> cancel
    `;
    document.getElementById("browser-drop-overlay")?.remove();
    document.body.appendChild(info);
    document.body.appendChild(overlay);

    overlay.style.cursor = "crosshair";

    const onMouseDown = (e) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      const r = overlay.getBoundingClientRect();
      dragStart = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (rectEl) rectEl.remove();
      rectEl = document.createElement("div");
      rectEl.className = "sc-select-rect";
      overlay.appendChild(rectEl);
    };

    const onMouseMove = (e) => {
      if (!dragStart || !rectEl) return;
      e.stopPropagation();
      const r = overlay.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      const x = Math.min(dragStart.x, cx);
      const y = Math.min(dragStart.y, cy);
      const w = Math.abs(cx - dragStart.x);
      const h = Math.abs(cy - dragStart.y);
      rectEl.style.left = `${x}px`;
      rectEl.style.top = `${y}px`;
      rectEl.style.width = `${w}px`;
      rectEl.style.height = `${h}px`;
      const btn = document.getElementById("sc-crop-confirm");
      if (btn) btn.disabled = w < 5 || h < 5;
    };

    const onMouseUp = (e) => {
      e.stopPropagation();
      dragStart = null;
    };

    const doCrop = () => {
      if (!rectEl) return;
      const r = overlay.getBoundingClientRect();
      const imgR = img.getBoundingClientRect();
      const scaleX = img.naturalWidth / imgR.width;
      const scaleY = img.naturalHeight / imgR.height;
      const rx = (parseFloat(rectEl.style.left) - (imgR.left - r.left)) * scaleX;
      const ry = (parseFloat(rectEl.style.top) - (imgR.top - r.top)) * scaleY;
      const rw = parseFloat(rectEl.style.width) * scaleX;
      const rh = parseFloat(rectEl.style.height) * scaleY;

      const canvas = document.createElement("canvas");
      canvas.width = rw;
      canvas.height = rh;
      const ctx = canvas.getContext("2d");
      const tempImg = new Image();
      tempImg.onload = () => {
        ctx.drawImage(tempImg, rx, ry, rw, rh, 0, 0, rw, rh);
        canvas.toBlob(async (cropped) => {
          if (cropped) {
            this._currentBlob = cropped;
            this._currentType = "screenshot";
            if (this._autoSave) {
              await this._saveCurrent();
              this._autoSave = false;
            }
            this._showResult(cropped, "screenshot");
            URL.revokeObjectURL(url);
          }
        }, "image/png");
        this._removeCropOverlay(overlay, info);
      };
      tempImg.src = url;
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        this._removeCropOverlay(overlay, info);
        URL.revokeObjectURL(url);
      }
      if (e.key === "Enter") {
        doCrop();
      }
    };

    overlay.addEventListener("mousedown", onMouseDown);
    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keydown", onKeyDown);

    const confirmBtn = info.querySelector("#sc-crop-confirm");
    if (confirmBtn)
      confirmBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        doCrop();
      });

    this._cleanupOverlay = () => {
      overlay.removeEventListener("mousedown", onMouseDown);
      overlay.removeEventListener("mousemove", onMouseMove);
      overlay.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keydown", onKeyDown);
      this._removeCropOverlay(overlay, info);
    };
  }

  _removeCropOverlay(overlay, info) {
    if (overlay && overlay.parentNode) overlay.remove();
    if (info && info.parentNode) info.remove();
  }

  _downloadCurrent() {
    if (!this._currentBlob) return;
    const ext = this._currentType === "recording" ? "webm" : "png";
    const name = `screenshot-${Date.now()}.${ext}`;
    const url = URL.createObjectURL(this._currentBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    os.notify.send("Screenshot", `Downloaded ${name}`);
  }

  async _saveCurrent() {
    if (!this._currentBlob) return;
    try {
      const ext = this._currentType === "recording" ? "webm" : "png";
      const name = `Screenshot-${Date.now()}.${ext}`;
      await os.fs.mkdir(["Pictures", "Screenshots"]);
      await os.fs.writeBinaryFile(["Pictures", "Screenshots"], name, this._currentBlob, "image", "@content");
      os.notify.send("Screenshot", `Saved to Pictures/Screenshots/${name}`);
    } catch {
      os.notify.send("Screenshot", "Failed to save to Pictures", { type: "error" });
    }
  }

  async _copyCurrent() {
    if (!this._currentBlob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ [this._currentBlob.type]: this._currentBlob })]);
      os.notify.send("Screenshot", "Copied to clipboard");
    } catch {
      os.notify.send("Screenshot", "Failed to copy", { type: "error" });
    }
  }

  onClose(winId) {
    this.openWindows.delete(winId);
    this._win = null;
    if (this._recording) this._stopRecording();
    if (this._cleanupOverlay) {
      this._cleanupOverlay();
      this._cleanupOverlay = null;
    }
    if (this._currentUrl) {
      URL.revokeObjectURL(this._currentUrl);
      this._currentUrl = null;
    }
    this._currentBlob = null;
  }
}
