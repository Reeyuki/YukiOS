import "../styles/camera.css";
import { openMediaViewer } from "../fileDisplay.js";
import { FileKind, isImageFile } from "../shared/fileKindDetector.js";
import { formatSize } from "../utils/utils.js";
import { renderSelectMenu, bindSelectMenu, getSelectMenuValue } from "../shared/selectMenu.js";
import { BaseApp, os } from "../framework.js";
import { $, $$, setStyle, createElement } from "../framework.js";

export class CameraApp extends BaseApp {
  singletonWindowIds = ["camera-win"];

  constructor(services) {
    super(services);
    this.stream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordings = [];
    this.recordingInterval = null;
    this.historyWin = null;
    this.state = {
      currentMode: "photo",
      isRecording: false,
      recordings: [],
      historyFilter: "all",
      historySort: "newest",
      bulkSelectMode: false,
      selectedItems: [],
      currentPage: 1,
      itemsPerPage: 12
    };
  }

  open() {
    const winId = "camera-win";

    const win = os.window.create(winId, "Camera", "800px", "600px", {
      icon: "static/icons/obs.webp",
      appId: "camera",
      style: { minWidth: "400px", minHeight: "400px" }
    });

    this.win = win;
    this.trackWindow(winId, win);
    win.innerHTML = this.buildUI();
    this.bindCameraEvents(win);
    this.initCamera(null, null, win, this.state);

    win.addEventListener("remove", () => {
      this.stopCamera();
    });
  }

  buildUI() {
    return `<div class="camera-app">
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
</div>`;
  }

  bindCameraEvents(win) {
    $$(".cam-mode-btn", win).forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".cam-mode-btn", win).forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.state.currentMode = btn.dataset.mode;
        const indicator = $("#mode-indicator", win);
        if (indicator) {
          indicator.textContent = $("span", btn)?.textContent || this.state.currentMode;
        }
        this.updateShutterButton(this.state, win);
      });
    });

    $("#shutter-btn", win)?.addEventListener("click", async () => {
      const shutterBtn = $("#shutter-btn", win);
      if (shutterBtn) {
        shutterBtn.classList.add("shutter-snap");
        setTimeout(() => shutterBtn.classList.remove("shutter-snap"), 200);
      }

      if (this.state.currentMode === "photo") {
        await this.takePhoto(this.state);
      } else if (this.state.currentMode === "video") {
        if (!this.state.isRecording) {
          this.startRecording(this.state, win);
        } else {
          this.stopRecording();
        }
      } else if (this.state.currentMode === "screen") {
        if (!this.state.isRecording) {
          await this.startScreenRecording(this.state, win);
        } else {
          this.stopRecording();
        }
      }
    });

    $("#open-history-btn", win)?.addEventListener("click", () => {
      this.openHistoryWindow(this.state);
    });
  }

  openHistoryWindow(state) {
    const historyWin = os.window.create("history-win", "Recordings History", "45vw", "70vh", {
      icon: "static/icons/obs.webp"
    });

    historyWin.innerHTML = `
      <div class="window-content">
        <div class="history-controls">
          <div class="history-filter">
            ${renderSelectMenu(
              "history-type-filter",
              [
                { value: "all", label: "All" },
                { value: "photo", label: "Photos" },
                { value: "video", label: "Videos" },
                { value: "screen", label: "Screen" }
              ],
              state.historyFilter || "all",
              "history-filter-select"
            )}
            ${renderSelectMenu(
              "history-sort",
              [
                { value: "newest", label: "Newest First" },
                { value: "oldest", label: "Oldest First" }
              ],
              state.historySort || "newest",
              "history-sort-select"
            )}
            <span id="history-count" class="history-count"></span>
          </div>
          <div class="history-actions">
            <button id="bulk-select-btn" class="history-btn secondary">Bulk Select</button>
            <button id="delete-selected-btn" class="history-btn danger" style="display: none;">Delete Selected</button>
          </div>
        </div>
        <div id="history-list" class="history-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; padding: 16px; overflow-y: auto; max-height: calc(70vh - 120px);"></div>
        <div class="history-pagination" style="display: flex; justify-content: center; align-items: center; gap: 16px; padding: 16px; border-top: 1px solid var(--glass-border);">
          <button id="prev-page" class="history-btn secondary" disabled>Previous</button>
          <span id="page-info">Page 1 of 1</span>
          <button id="next-page" class="history-btn secondary" disabled>Next</button>
        </div>
      </div>
    `;

    bindSelectMenu(historyWin);

    state.currentPage = 1;
    state.itemsPerPage = 12;

    const typeFilter = $("#history-type-filter", historyWin);
    const sortSelect = $("#history-sort", historyWin);
    const bulkSelectBtn = $("#bulk-select-btn", historyWin);
    const deleteSelectedBtn = $("#delete-selected-btn", historyWin);
    const prevPageBtn = $("#prev-page", historyWin);
    const nextPageBtn = $("#next-page", historyWin);
    const pageInfo = $("#page-info", historyWin);

    typeFilter.addEventListener("change", () => {
      state.currentPage = 1;
      this.renderHistory(state, historyWin);
    });
    sortSelect.addEventListener("change", () => {
      state.currentPage = 1;
      this.renderHistory(state, historyWin);
    });

    bulkSelectBtn.onclick = () => {
      state.bulkSelectMode = !state.bulkSelectMode;
      bulkSelectBtn.textContent = state.bulkSelectMode ? "Cancel Select" : "Bulk Select";
      setStyle(deleteSelectedBtn, { display: state.bulkSelectMode ? "block" : "none" });
      state.selectedItems = [];
      this.renderHistory(state, historyWin);
    };

    deleteSelectedBtn.onclick = async () => {
      if (state.selectedItems.length === 0) return;
      const confirmed = await os.dialog.confirm("Confirm", `Delete ${state.selectedItems.length} selected items?`);
      if (!confirmed) return;
      for (const id of state.selectedItems) {
        await this.deleteRecording(id, state);
      }
      state.selectedItems = [];
      this.renderHistory(state, historyWin);
    };

    prevPageBtn.onclick = () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        this.renderHistory(state, historyWin);
      }
    };

    nextPageBtn.onclick = () => {
      const totalPages = Math.ceil(state.recordings.length / state.itemsPerPage);
      if (state.currentPage < totalPages) {
        state.currentPage++;
        this.renderHistory(state, historyWin);
      }
    };

    this.renderHistory(state, historyWin);
  }

  updateShutterButton(state, cameraApp) {
    const shutterBtn = $("#shutter-btn", cameraApp);
    const inner = $(".shutter-inner", shutterBtn);
    inner.className = "shutter-inner";
    if (state.currentMode === "photo") {
      inner.classList.add("photo");
    } else if (state.currentMode === "video" || state.currentMode === "screen") {
      if (state.isRecording) {
        inner.classList.add("stop");
      } else {
        inner.classList.add("video");
      }
    }
  }

  async initCamera(payload, event, element, state) {
    const cameraApp = $(".camera-app");
    if (!cameraApp) {
      console.error("Camera app container not found");
      return;
    }
    this.video = $("#camera-video", cameraApp);
    this.shutterBtn = $("#shutter-btn", cameraApp);
    this.downloadLink = $("#download-link", cameraApp);
    this.recordingIcon = $("#recording-icon", cameraApp);
    this.recordingTimer = $("#recording-timer", cameraApp);
    this.modeIndicator = $("#mode-indicator", cameraApp);

    state.currentMode = "photo";
    state.isRecording = false;

    await this.startCamera();
    this.updateShutterButton(state, cameraApp);
    await this.restoreHistory(state);
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.video.srcObject = this.stream;
    } catch (err) {
      os.notify.send("No camera permission", "Camera access denied or not available.");
      console.error(err);
    }
  }

  async takePhoto(state) {
    const canvas = createElement("canvas");
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    canvas.getContext("2d").drawImage(this.video, 0, 0);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

    const fileName = `photo-${Date.now()}.png`;
    await os.fs.writeBinaryFile(["Pictures", "Camera"], fileName, blob, "image", "@content");

    const dataUrl = canvas.toDataURL("image/png");
    this.downloadLink.href = dataUrl;
    this.downloadLink.download = fileName;
    this.downloadLink.textContent = "Download Photo";
    setStyle(this.downloadLink, { display: "flex" });

    await this.addRecording(dataUrl, blob, fileName, fileName.replace(".png", ""), state);

    const flash = createElement("div");
    flash.className = "cam-viewfinder-flash";
    const viewfinder = this.video.parentElement;
    viewfinder.appendChild(flash);
    flash.addEventListener("animationend", () => flash.remove());
  }

  startRecording(state, cameraApp) {
    if (!this.stream || state.isRecording) return;

    state.isRecording = true;
    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    this.mediaRecorder.onstop = async () => {
      const blob = new Blob(this.recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);

      const fileName = `video-${Date.now()}.webm`;
      try {
        await os.fs.writeBinaryFile(["Videos", "Camera"], fileName, blob, "video", "fas fa-camera");
      } catch (e) {
        console.error("Failed to save video:", e);
      }

      await this.addRecording(url, blob, fileName, fileName.replace(".webm", ""), state);

      state.isRecording = false;
      this.stopTimer();
      this.shutterBtn.classList.remove("recording");
      this.updateShutterButton(state, cameraApp);
      this.downloadLink.href = url;
      this.downloadLink.download = fileName;
      this.downloadLink.textContent = "Download Video";
      setStyle(this.downloadLink, { display: "flex" });
    };

    this.mediaRecorder.start();
    this.shutterBtn.classList.add("recording");
    setStyle(this.recordingIcon, { display: "block" });
    this.updateShutterButton(state, cameraApp);
    this.startTimer();
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
  }

  async startScreenRecording(state, cameraApp) {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      this.activeStream = screenStream;
      this.video.srcObject = screenStream;

      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(screenStream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordedChunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.recordedChunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);

        const fileName = `screen-${Date.now()}.webm`;
        try {
          await os.fs.writeBinaryFile(["Videos", "Camera"], fileName, blob, "video", "fas fa-camera");
        } catch (e) {
          console.error("Failed to save screen recording:", e);
        }

        await this.addRecording(url, blob, fileName, fileName.replace(".webm", ""), state);

        state.isRecording = false;
        this.downloadLink.href = url;
        this.downloadLink.download = fileName;
        this.downloadLink.textContent = "Download Screen Recording";
        setStyle(this.downloadLink, { display: "flex" });
        this.stopTimer();
        setStyle(this.recordingIcon, { display: "none" });
        this.shutterBtn.classList.remove("recording");
        this.updateShutterButton(state, cameraApp);
        this.activeStream.getTracks().forEach((t) => t.stop());
        this.activeStream = null;
        this.video.srcObject = this.stream;
      };

      screenStream.getVideoTracks()[0].onended = () => {
        if (this.mediaRecorder.state !== "inactive") this.mediaRecorder.stop();
      };

      state.isRecording = true;
      this.mediaRecorder.start();
      this.shutterBtn.classList.add("recording");
      setStyle(this.recordingIcon, { display: "block" });
      this.updateShutterButton(state, cameraApp);
      this.startTimer();
    } catch (e) {
      console.error(e);
      os.notify.send("No camera permission", "Screen capture cancelled or not allowed");
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

  async addRecording(url, blob, savedName = null, displayName = null, state) {
    if (!displayName) {
      displayName = `Recording ${new Date().toLocaleTimeString()}`;
    }
    if (!savedName) {
      const fileName = `recording-${Date.now()}.webm`;
      await os.fs.writeBinaryFile(["Videos", "Camera"], fileName, blob, "video", "fas fa-camera");
      savedName = fileName;
    }

    state.recordings.unshift({
      id: savedName,
      name: displayName,
      url,
      blob
    });

    this.renderHistory(state);
  }

  closePreviewModal() {
    const modal = $("#preview-modal");
    if (modal) modal.remove();
  }

  renderHistory(state, historyWin = null) {
    const list = $("#history-list", historyWin);
    const count = $("#history-count", historyWin);
    const typeFilter = $("#history-type-filter", historyWin);
    const sortSelect = $("#history-sort", historyWin);
    const prevPageBtn = $("#prev-page", historyWin);
    const nextPageBtn = $("#next-page", historyWin);
    const pageInfo = $("#page-info", historyWin);

    if (!list) return;

    list.innerHTML = "";

    const filterVal = getSelectMenuValue("history-type-filter", historyWin || document) || "all";
    const sortVal = getSelectMenuValue("history-sort", historyWin || document) || "newest";

    let filtered = state.recordings.filter((rec) => {
      const type = this.getRecordingType(rec);
      return filterVal === "all" || type === filterVal;
    });

    filtered.sort((a, b) => {
      const aTime = this.extractTimestamp(a.id);
      const bTime = this.extractTimestamp(b.id);
      return sortVal === "newest" ? bTime - aTime : aTime - bTime;
    });

    if (count) count.textContent = `(${filtered.length})`;

    const totalPages = Math.ceil(filtered.length / state.itemsPerPage);
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    const paginatedItems = filtered.slice(startIndex, endIndex);

    paginatedItems.forEach((rec) => {
      const item = this.createHistoryItem(rec, state);
      list.appendChild(item);
    });

    if (prevPageBtn) prevPageBtn.disabled = state.currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = state.currentPage >= totalPages;
    if (pageInfo) pageInfo.textContent = `Page ${state.currentPage} of ${totalPages || 1}`;
  }

  getRecordingType(rec) {
    const id = String(rec.id || "");
    const name = String(rec.name || "");
    if (isImageFile(id)) return "photo";
    if (name.toLowerCase().includes("screen")) return "screen";
    return "video";
  }

  extractTimestamp(id) {
    const idStr = String(id || "");
    const match = idStr.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }

  createHistoryItem(rec, state) {
    const type = this.getRecordingType(rec);
    const isPhoto = type === "photo";
    const item = createElement("div");
    item.className = "cam-history-item";
    item.onclick = () => this.openMediaViewer(rec);

    const thumbnail = createElement("div");
    thumbnail.className = "cam-history-thumb";

    if (state.bulkSelectMode) {
      const checkbox = createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "history-checkbox";
      checkbox.checked = state.selectedItems.includes(rec.id);
      checkbox.onclick = (e) => e.stopPropagation();
      checkbox.onchange = () => {
        const idx = state.selectedItems.indexOf(rec.id);
        if (checkbox.checked && idx === -1) state.selectedItems.push(rec.id);
        else if (!checkbox.checked && idx > -1) state.selectedItems.splice(idx, 1);
      };
      thumbnail.appendChild(checkbox);
    }

    if (isPhoto) {
      const img = createElement("img");
      img.src = rec.url;
      img.className = "cam-media-fill";
      thumbnail.appendChild(img);
    } else {
      const video = createElement("video");
      video.src = rec.url;
      video.muted = true;
      video.className = "cam-media-fill";
      thumbnail.appendChild(video);
    }

    const info = createElement("div");
    info.className = "cam-history-info";

    const name = createElement("div");
    name.className = "cam-history-name";
    name.textContent = rec.id;

    const timestamp = createElement("div");
    timestamp.className = "cam-history-timestamp";
    timestamp.textContent = this.formatTimestamp(rec.id);

    info.appendChild(name);
    info.appendChild(timestamp);

    const size = createElement("div");
    size.className = "cam-history-size";
    size.textContent = rec.blob ? formatSize(rec.blob.size) : "";
    info.appendChild(size);

    const actions = createElement("div");
    actions.className = "cam-history-actions";

    const renameBtn = createElement("button");
    renameBtn.innerHTML = '<i class="fas fa-pencil"></i>';
    renameBtn.className = "cam-hist-btn";
    renameBtn.title = "Rename";
    renameBtn.onclick = (e) => {
      e.stopPropagation();
      this.startInlineRename(rec, state, name);
    };
    actions.appendChild(renameBtn);

    const deleteBtn = createElement("button");
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.className = "cam-hist-btn danger";
    deleteBtn.title = "Delete";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      this.deleteRecording(rec.id, state);
    };
    actions.appendChild(deleteBtn);

    item.appendChild(thumbnail);
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
      const video = createElement("video");
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
    } catch (e) {
      console.error("Failed to copy to clipboard:", e);
      os.notify.send("Clipboard failure", "Failed to copy to clipboard");
    }
  }

  openMediaViewer(rec) {
    const type = this.getRecordingType(rec);
    let kind;
    if (type === "photo") {
      kind = FileKind.IMAGE;
    } else {
      kind = FileKind.VIDEO;
    }
    openMediaViewer(rec.id, rec.url, kind);
  }

  startInlineRename(rec, state, nameEl) {
    const input = createElement("input");
    input.type = "text";
    input.className = "cam-inline-rename-input";
    input.value = rec.name;

    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = async (save) => {
      if (finished) return;
      finished = true;

      if (save) {
        const newName = input.value.trim();
        if (newName && newName !== rec.name) {
          const ext = isImageFile(rec.id) ? ".png" : ".webm";
          const newFileName = `${newName}${ext}`;
          try {
            await os.fs.renameBinaryFile(["Pictures", "Camera"], rec.id, newFileName);
          } catch {
            await os.fs.renameBinaryFile(["Videos", "Camera"], rec.id, newFileName);
          }
          rec.id = newFileName;
          rec.name = newName;
        }
      }

      const restoredName = createElement("div");
      restoredName.className = "cam-history-name";
      restoredName.textContent = rec.id;
      input.replaceWith(restoredName);
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });

    input.addEventListener("blur", () => finish(true));
  }

  async deleteRecording(id, state) {
    const index = state.recordings.findIndex((r) => r.id === id);
    if (index === -1) return;

    const confirmed = await os.dialog.confirm("Delete Recording", `Delete "${id}" for good?`);
    if (!confirmed) return;

    URL.revokeObjectURL(state.recordings[index].url);

    try {
      await os.fs.deleteBinaryFile(["Pictures", "Camera"], id);
    } catch {
      await os.fs.deleteBinaryFile(["Videos", "Camera"], id);
    }

    state.recordings.splice(index, 1);
    this.renderHistory(state);
  }

  playRecording(url) {
    const playerWin = os.window.create(`camera-playback-${Date.now()}`, "Playback", "50vw", "70vh", {
      icon: "static/icons/obs.webp"
    });

    playerWin.innerHTML = `
      <div class="window-content">
        <video controls autoplay style="width:100%; height:100%;"></video>
      </div>
    `;

    const videoEl = $("video", playerWin);
    videoEl.src = url;
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
  }

  async restoreHistory(state) {
    const cameraFolder = await os.fs.readdir(["Pictures", "Camera"]).catch(() => ({}));
    const videosFolder = await os.fs.readdir(["Videos", "Camera"]).catch(() => ({}));

    const cameraEntries = Object.keys(cameraFolder).filter((k) => cameraFolder[k].type === "file");
    const videoEntries = Object.keys(videosFolder).filter((k) => videosFolder[k].type === "file");
    const allEntries = [...cameraEntries, ...videoEntries];

    const existingIds = new Set(state.recordings.map((r) => r.id));
    for (const name of allEntries) {
      if (existingIds.has(name)) continue;

      let blob = await os.fs.readBinaryFile(["Pictures", "Camera"], name).catch(() => null);
      if (!blob) {
        blob = await os.fs.readBinaryFile(["Videos", "Camera"], name).catch(() => null);
      }

      if (!blob) continue;
      state.recordings.push({
        id: name,
        name: name.replace(/\.(png|webm|jpg|jpeg)$/, ""),
        url: URL.createObjectURL(blob),
        blob
      });
    }

    this.renderHistory(state);
  }
}
