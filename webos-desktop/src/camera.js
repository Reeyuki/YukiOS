import { BaseApp } from "./core/BaseApp.js";
import { desktop } from "./desktop.js";

export class CameraApp extends BaseApp {
  constructor(services) {
    super(services);
    this.stream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordings = [];
    this.recordingInterval = null;
    this.historyWin = null;
  }

  open() {
    if (document.getElementById("camera-win")) {
      this.wm.bringToFront(document.getElementById("camera-win"));
      return;
    }

    const win = document.createElement("div");
    win.className = "window";
    win.id = "camera-win";
    win.dataset.fullscreen = "false";

    win.innerHTML = `
      <div class="window-header">
        <span>Camera</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="camera-app">
        <div class="camera-viewfinder">
          <video id="camera-video" autoplay playsinline></video>
          <div class="camera-rec-status">
            <span id="recording-icon"></span>
            <span id="recording-timer"></span>
          </div>
          <div class="camera-mode-indicator" id="mode-indicator">Photo</div>
          <div class="camera-download-overlay">
            <a id="download-link" class="download-link"></a>
          </div>
        </div>

        <div class="camera-toolbar">
          <div class="camera-modes">
            <button class="cam-mode-btn active" data-mode="photo" id="mode-photo">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="6" width="18" height="12" rx="2"/>
                <circle cx="12" cy="12" r="3"/>
                <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/>
              </svg>
              <span>Photo</span>
            </button>
            <button class="cam-mode-btn" data-mode="video" id="mode-video">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="6" width="14" height="12" rx="2"/>
                <polygon points="17,10 21,8 21,16 17,14" fill="currentColor" stroke="none"/>
              </svg>
              <span>Video</span>
            </button>
            <button class="cam-mode-btn" data-mode="screen" id="mode-screen">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="4" width="20" height="14" rx="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="18" x2="12" y2="21"/>
              </svg>
              <span>Screen</span>
            </button>
          </div>

          <div class="camera-actions">
            <div class="cam-actions-side cam-actions-left">
              <button class="cam-action-btn secondary" id="open-history-btn" title="History">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"/>
                  <path d="M3 3v9h9"/>
                </svg>
              </button>
            </div>

            <button class="cam-shutter-btn" id="shutter-btn">
              <span class="shutter-inner"></span>
            </button>

            <div class="cam-actions-side cam-actions-right"></div>
          </div>
        </div>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Camera", "static/icons/obs.webp");
    this.wm.bringToFront(win);

    const closebtn = win.querySelector(".close-btn");
    closebtn.addEventListener("click", () => {
      this.stopCamera();
      if (this.historyWin) {
        this.historyWin.remove();
        this.historyWin = null;
      }
      this.wm.removeFromTaskbar(win.id);
      win.style.animation = "popUp 0.5s ease forwards";
      setTimeout(() => win.remove(), 500);
    });

    this.video = win.querySelector("#camera-video");
    this.shutterBtn = win.querySelector("#shutter-btn");
    this.downloadLink = win.querySelector("#download-link");
    this.recordingIcon = win.querySelector("#recording-icon");
    this.recordingTimer = win.querySelector("#recording-timer");
    this.historyBtn = win.querySelector("#open-history-btn");
    this.modeIndicator = win.querySelector("#mode-indicator");
    this.modeBtns = win.querySelectorAll(".cam-mode-btn");

    this.currentMode = "photo";
    this.isRecording = false;

    win.style.minWidth = "400px";
    win.style.minHeight = "400px";

    this.startCamera();

    this.modeBtns.forEach((btn) => {
      btn.onclick = () => {
        this.modeBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.currentMode = btn.dataset.mode;
        this.updateShutterButton();
        this.modeIndicator.textContent = btn.querySelector("span").textContent;
      };
    });

    this.shutterBtn.onclick = () => {
      if (this.currentMode === "photo") {
        this.takePhoto();
      } else if (this.currentMode === "video") {
        if (!this.isRecording) {
          this.startRecording();
        } else {
          this.stopRecording();
        }
      } else if (this.currentMode === "screen") {
        if (!this.isRecording) {
          this.startScreenRecording();
        } else {
          this.stopRecording();
        }
      }
    };

    this.historyBtn.onclick = () => this.openHistoryWindow();

    this.updateShutterButton();
    this.restoreHistory();
  }

  updateShutterButton() {
    const inner = this.shutterBtn.querySelector(".shutter-inner");
    inner.className = "shutter-inner";
    if (this.currentMode === "photo") {
      inner.classList.add("photo");
    } else if (this.currentMode === "video" || this.currentMode === "screen") {
      if (this.isRecording) {
        inner.classList.add("stop");
      } else {
        inner.classList.add("video");
      }
    }
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.video.srcObject = this.stream;
    } catch (err) {
      this.wm.sendNotify("Camera access denied or not available.");
      console.error(err);
    }
  }

  async takePhoto() {
    const canvas = document.createElement("canvas");
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    canvas.getContext("2d").drawImage(this.video, 0, 0);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

    const fileName = `photo-${Date.now()}.png`;
    const savedName = await this.fs.writeBinaryFile(["Pictures", "Camera"], fileName, blob, "image", "@content");

    const dataUrl = canvas.toDataURL("image/png");
    this.downloadLink.href = dataUrl;
    this.downloadLink.download = fileName;
    this.downloadLink.textContent = "Download Photo";
    this.downloadLink.style.display = "flex";

    this.addRecording(dataUrl, blob, savedName, fileName.replace(".png", ""));
  }

  startRecording() {
    if (!this.stream || this.isRecording) return;

    this.isRecording = true;
    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);

      const fileName = `video-${Date.now()}.webm`;
      const savedName = this.fs.writeBinaryFile(
        ["Pictures", "Camera"],
        fileName,
        blob,
        "video",
        "/static/icons/obs.webp"
      );

      this.addRecording(url, blob, savedName, fileName.replace(".webm", ""));

      this.isRecording = false;
      this.stopTimer();
      this.shutterBtn.classList.remove("recording");
      this.updateShutterButton();
      this.downloadLink.href = url;
      this.downloadLink.download = fileName;
      this.downloadLink.textContent = "Download Video";
      this.downloadLink.style.display = "flex";
    };

    this.mediaRecorder.start();
    this.shutterBtn.classList.add("recording");
    this.recordingIcon.style.display = "block";
    this.updateShutterButton();
    this.startTimer();
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
  }

  async startScreenRecording() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      this.activeStream = screenStream;
      this.video.srcObject = screenStream;

      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(screenStream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordedChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);

        const fileName = `screen-${Date.now()}.webm`;
        const savedName = this.fs.writeBinaryFile(
          ["Pictures", "Camera"],
          fileName,
          blob,
          "video",
          "/static/icons/obs.webp"
        );

        this.addRecording(url, blob, savedName, fileName.replace(".webm", ""));

        this.isRecording = false;
        this.downloadLink.href = url;
        this.downloadLink.download = fileName;
        this.downloadLink.textContent = "Download Screen Recording";
        this.downloadLink.style.display = "flex";
        this.stopTimer();
        this.recordingIcon.style.display = "none";
        this.shutterBtn.classList.remove("recording");
        this.updateShutterButton();
        this.activeStream.getTracks().forEach((t) => t.stop());
        this.activeStream = null;
        this.video.srcObject = this.stream;
      };

      screenStream.getVideoTracks()[0].onended = () => {
        if (this.mediaRecorder.state !== "inactive") this.mediaRecorder.stop();
      };

      this.isRecording = true;
      this.mediaRecorder.start();
      this.shutterBtn.classList.add("recording");
      this.recordingIcon.style.display = "block";
      this.updateShutterButton();
      this.startTimer();
    } catch (e) {
      console.error(e);
      this.wm.sendNotify("Screen capture cancelled or not allowed");
    }
  }

  startTimer() {
    let seconds = 0;
    this.recordingTimer.textContent = "00:00";
    this.recordingInterval = setInterval(() => {
      seconds++;
      const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
      const secs = String(seconds % 60).padStart(2, "0");
      this.recordingTimer.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.recordingInterval);
    this.recordingTimer.textContent = "";
  }

  async addRecording(url, blob, savedName = null, displayName = null) {
    if (!displayName) {
      displayName = `Recording ${new Date().toLocaleTimeString()}`;
    }
    if (!savedName) {
      const fileName = `recording-${Date.now()}.webm`;
      savedName = await this.fs.writeBinaryFile(
        ["Pictures", "Camera"],
        fileName,
        blob,
        "video",
        "/static/icons/obs.webp"
      );
    }

    this.recordings.unshift({
      id: savedName,
      name: displayName,
      url,
      blob
    });

    if (this.historyWin) this.renderHistory();
  }

  openHistoryWindow() {
    if (this.historyWin) {
      this.wm.bringToFront(this.historyWin);
      return;
    }

    this.historyWin = document.createElement("div");
    this.historyWin.className = "window";
    this.historyWin.id = "history-win";

    this.historyWin.innerHTML = `
      <div class="window-header">
        <span>Recordings History <span id="history-count" class="history-count">(0)</span></span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="history-controls">
        <div class="history-filter">
          <select id="history-type-filter" class="history-filter-select">
            <option value="all">All</option>
            <option value="photo">Photos</option>
            <option value="video">Videos</option>
            <option value="screen">Screen</option>
          </select>
          <select id="history-sort" class="history-sort-select">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
        <div class="history-actions">
          <button id="bulk-select-btn" class="history-btn secondary">Bulk Select</button>
          <button id="delete-selected-btn" class="history-btn danger" style="display: none;">Delete Selected</button>
        </div>
      </div>
      <div id="history-list" class="history-grid"></div>
    `;

    desktop.appendChild(this.historyWin);
    this.wm.makeDraggable(this.historyWin);
    this.wm.makeResizable(this.historyWin);
    this.wm.setupWindowControls(this.historyWin);
    this.wm.bringToFront(this.historyWin);

    this.historyWin.querySelector(".close-btn").onclick = () => {
      this.closePreviewModal();
      this.historyWin.remove();
      this.historyWin = null;
    };

    this.historyWin.style.width = "45vw";
    this.historyWin.style.height = "70vh";
    this.historyWin.style.left = "55vw";
    this.historyWin.style.top = "15vh";

    this.setupHistoryControls();
    this.renderHistory();
  }

  setupHistoryControls() {
    const typeFilter = this.historyWin.querySelector("#history-type-filter");
    const sortSelect = this.historyWin.querySelector("#history-sort");
    const bulkSelectBtn = this.historyWin.querySelector("#bulk-select-btn");
    const deleteSelectedBtn = this.historyWin.querySelector("#delete-selected-btn");

    this.bulkSelectMode = false;
    this.selectedItems = new Set();

    typeFilter.onchange = () => this.renderHistory();
    sortSelect.onchange = () => this.renderHistory();

    bulkSelectBtn.onclick = () => {
      this.bulkSelectMode = !this.bulkSelectMode;
      bulkSelectBtn.textContent = this.bulkSelectMode ? "Cancel Select" : "Bulk Select";
      deleteSelectedBtn.style.display = this.bulkSelectMode ? "block" : "none";
      this.selectedItems.clear();
      this.renderHistory();
    };

    deleteSelectedBtn.onclick = () => this.deleteSelected();
  }

  closePreviewModal() {
    const modal = document.querySelector("#preview-modal");
    if (modal) modal.remove();
  }

  renderHistory() {
    if (!this.historyWin) return;
    const list = this.historyWin.querySelector("#history-list");
    const count = this.historyWin.querySelector("#history-count");
    const typeFilter = this.historyWin.querySelector("#history-type-filter");
    const sortSelect = this.historyWin.querySelector("#history-sort");

    list.innerHTML = "";

    let filtered = this.recordings.filter((rec) => {
      const type = this.getRecordingType(rec);
      return typeFilter.value === "all" || type === typeFilter.value;
    });

    filtered.sort((a, b) => {
      const aTime = this.extractTimestamp(a.id);
      const bTime = this.extractTimestamp(b.id);
      return sortSelect.value === "newest" ? bTime - aTime : aTime - bTime;
    });

    count.textContent = `(${filtered.length})`;

    filtered.forEach((rec) => {
      const item = this.createHistoryItem(rec);
      list.appendChild(item);
    });
  }

  getRecordingType(rec) {
    const id = String(rec.id || "");
    const name = String(rec.name || "");
    if (id.includes(".png") || id.includes(".jpg") || id.includes(".jpeg")) return "photo";
    if (name.toLowerCase().includes("screen")) return "screen";
    return "video";
  }

  extractTimestamp(id) {
    const idStr = String(id || "");
    const match = idStr.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }

  createHistoryItem(rec) {
    const type = this.getRecordingType(rec);
    const isPhoto = type === "photo";
    const item = document.createElement("div");
    item.className = `history-item ${isPhoto ? "photo-item" : "video-item"}`;

    const thumbnail = document.createElement("div");
    thumbnail.className = "history-thumbnail";

    if (isPhoto) {
      thumbnail.style.backgroundImage = `url(${rec.url})`;
      thumbnail.style.backgroundSize = "cover";
      thumbnail.style.backgroundPosition = "center";
    } else {
      const video = document.createElement("video");
      video.src = rec.url;
      video.muted = true;
      video.currentTime = 1;
      video.onloadeddata = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        thumbnail.style.backgroundImage = `url(${canvas.toDataURL()})`;
        thumbnail.style.backgroundSize = "cover";
        thumbnail.style.backgroundPosition = "center";
      };
    }

    const typeBadge = document.createElement("span");
    typeBadge.className = `history-type-badge ${type}`;
    typeBadge.textContent = type.charAt(0).toUpperCase() + type.slice(1);

    const info = document.createElement("div");
    info.className = "history-info";

    const title = document.createElement("div");
    title.className = "history-title";
    title.textContent = rec.name;
    title.onclick = () => this.showPreview(rec);

    const timestamp = document.createElement("div");
    timestamp.className = "history-timestamp";
    timestamp.textContent = this.formatTimestamp(rec.id);

    info.appendChild(title);
    info.appendChild(timestamp);

    if (!isPhoto) {
      const duration = document.createElement("div");
      duration.className = "history-duration";
      this.getVideoDuration(rec.url).then((d) => {
        duration.textContent = this.formatDuration(d);
      });
      info.appendChild(duration);
    }

    const actions = document.createElement("div");
    actions.className = "history-item-actions";

    if (this.bulkSelectMode) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "history-checkbox";
      checkbox.checked = this.selectedItems.has(rec.id);
      checkbox.onchange = () => {
        if (checkbox.checked) {
          this.selectedItems.add(rec.id);
        } else {
          this.selectedItems.delete(rec.id);
        }
      };
      actions.appendChild(checkbox);
    }

    if (isPhoto) {
      const copyBtn = document.createElement("button");
      copyBtn.className = "history-action-btn copy";
      copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
      copyBtn.title = "Copy to clipboard";
      copyBtn.onclick = () => this.copyToClipboard(rec.url);
      actions.appendChild(copyBtn);
    }

    const renameBtn = document.createElement("button");
    renameBtn.className = "history-action-btn rename";
    renameBtn.innerHTML = '<i class="fas fa-edit"></i>';
    renameBtn.title = "Rename";
    renameBtn.onclick = () => this.renameRecording(rec.id);
    actions.appendChild(renameBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "history-action-btn delete";
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.title = "Delete";
    deleteBtn.onclick = () => this.deleteRecording(rec.id);
    actions.appendChild(deleteBtn);

    item.appendChild(thumbnail);
    item.appendChild(typeBadge);
    item.appendChild(info);
    item.appendChild(actions);

    return item;
  }

  formatTimestamp(id) {
    const timestamp = this.extractTimestamp(id);
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  async getVideoDuration(url) {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.src = url;
      video.onloadedmetadata = () => {
        resolve(video.duration);
      };
      video.onerror = () => resolve(0);
    });
  }

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  async copyToClipboard(url) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      this.wm.sendNotify("Image copied to clipboard");
    } catch (e) {
      console.error("Failed to copy to clipboard:", e);
      this.wm.sendNotify("Failed to copy to clipboard");
    }
  }

  showPreview(rec) {
    this.closePreviewModal();

    const modal = document.createElement("div");
    modal.id = "preview-modal";
    modal.className = "preview-modal";

    const isPhoto = this.getRecordingType(rec) === "photo";

    modal.innerHTML = `
      <div class="preview-content">
        <div class="preview-header">
          <span>${rec.name}</span>
          <button class="preview-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="preview-media">
          ${isPhoto ? `<img src="${rec.url}" alt="${rec.name}" />` : `<video src="${rec.url}" controls autoplay></video>`}
        </div>
        <div class="preview-info">
          <span>${this.formatTimestamp(rec.id)}</span>
          ${!isPhoto ? `<span id="preview-duration">Loading...</span>` : ""}
        </div>
      </div>
    `;

    modal.querySelector(".preview-close").onclick = () => modal.remove();
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    document.body.appendChild(modal);

    if (!isPhoto) {
      this.getVideoDuration(rec.url).then((duration) => {
        const durationEl = modal.querySelector("#preview-duration");
        if (durationEl) durationEl.textContent = this.formatDuration(duration);
      });
    }
  }

  async deleteSelected() {
    if (this.selectedItems.size === 0) return;

    const confirmed = confirm(`Delete ${this.selectedItems.size} selected items?`);
    if (!confirmed) return;

    const itemsToDelete = Array.from(this.selectedItems);
    for (const id of itemsToDelete) {
      await this.deleteRecording(id);
    }

    this.selectedItems.clear();
    this.renderHistory();
  }

  async renameRecording(id) {
    const rec = this.recordings.find((r) => r.id === id);
    if (!rec) return;
    const name = prompt("Rename recording:", rec.name);
    if (!name) return;

    const ext = rec.id.includes(".png") ? ".png" : ".webm";
    const newFileName = `${name}${ext}`;

    try {
      await this.fs.renameBinaryFile(["Pictures", "Camera"], rec.id, newFileName);
    } catch {
      await this.fs.renameBinaryFile("Videos", rec.id, newFileName);
    }

    rec.id = newFileName;
    rec.name = name;
    this.renderHistory();
  }

  async deleteRecording(id) {
    const index = this.recordings.findIndex((r) => r.id === id);
    if (index === -1) return;
    URL.revokeObjectURL(this.recordings[index].url);

    try {
      await this.fs.deleteBinaryFile(["Pictures", "Camera"], id);
    } catch {
      await this.fs.deleteBinaryFile("Videos", id);
    }

    this.recordings.splice(index, 1);
    this.renderHistory();
  }

  playRecording(url) {
    const playerWin = document.createElement("div");
    playerWin.className = "window";

    playerWin.innerHTML = `
      <div class="window-header">
        <span>Playback</span>
        ${this.wm.getWindowControls()}
      </div>
      <video controls autoplay style="width:100%; height:90%;"></video>
    `;

    desktop.appendChild(playerWin);
    this.wm.makeDraggable(playerWin);
    this.wm.makeResizable(playerWin);
    this.wm.bringToFront(playerWin);

    playerWin.querySelector(".close-btn").onclick = () => playerWin.remove();

    const videoEl = playerWin.querySelector("video");
    videoEl.src = url;

    playerWin.style.width = "50vw";
    playerWin.style.height = "50vh";
    playerWin.style.left = "30vw";
    playerWin.style.top = "25vh";
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
  }

  async restoreHistory() {
    await this.fs.fsReady;
    const cameraFolder = await this.fs.getFolder(["Pictures", "Camera"]).catch(() => ({}));
    const videosFolder = await this.fs.getFolder("Videos").catch(() => ({}));

    const cameraEntries = Object.keys(cameraFolder).filter((k) => cameraFolder[k].type === "file");
    const videoEntries = Object.keys(videosFolder).filter((k) => videosFolder[k].type === "file");
    const allEntries = [...cameraEntries, ...videoEntries];

    this.recordings = [];
    for (const name of allEntries) {
      let blob;

      blob = await this.fs.readBinaryFile(["Pictures", "Camera"], name).catch(() => null);
      if (!blob) {
        blob = await this.fs.readBinaryFile("Videos", name).catch(() => null);
      }

      if (!blob) continue;
      this.recordings.push({
        id: name,
        name: name.replace(/\.(png|webm|jpg|jpeg)$/, ""),
        url: URL.createObjectURL(blob),
        blob
      });
    }

    if (this.historyWin) this.renderHistory();
  }
}
