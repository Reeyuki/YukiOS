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
            <button class="cam-action-btn secondary" id="open-history-btn" title="History">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"/>
                <path d="M3 3v9h9"/>
              </svg>
            </button>

            <button class="cam-shutter-btn" id="shutter-btn">
              <span class="shutter-inner"></span>
            </button>

            <button class="cam-action-btn secondary" id="stop-record-btn" title="Stop" disabled>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            </button>
          </div>

          <a id="download-link"></a>
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
    this.stopRecordBtn = win.querySelector("#stop-record-btn");
    this.downloadLink = win.querySelector("#download-link");
    this.recordingIcon = win.querySelector("#recording-icon");
    this.recordingTimer = win.querySelector("#recording-timer");
    this.historyBtn = win.querySelector("#open-history-btn");
    this.modeIndicator = win.querySelector("#mode-indicator");
    this.modeBtns = win.querySelectorAll(".cam-mode-btn");

    this.currentMode = "photo";
    this.isRecording = false;

    win.style.width = "560px";
    win.style.height = "520px";
    win.style.left = "30vw";
    win.style.top = "15vh";
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
        }
      } else if (this.currentMode === "screen") {
        if (!this.isRecording) {
          this.startScreenRecording();
        }
      }
    };

    this.stopRecordBtn.onclick = () => this.stopRecording();
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
      inner.classList.add("video");
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

  takePhoto() {
    const canvas = document.createElement("canvas");
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    canvas.getContext("2d").drawImage(this.video, 0, 0);

    const dataUrl = canvas.toDataURL("image/png");
    this.downloadLink.href = dataUrl;
    this.downloadLink.download = "photo.png";
    this.downloadLink.textContent = "Download Photo";
    this.downloadLink.style.display = "flex";
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
      this.addRecording(url, blob);

      this.isRecording = false;
      this.stopTimer();
      this.shutterBtn.classList.remove("recording");
      this.stopRecordBtn.disabled = true;
      this.downloadLink.href = url;
      this.downloadLink.download = `video-${Date.now()}.webm`;
      this.downloadLink.textContent = "Download Video";
      this.downloadLink.style.display = "flex";
    };

    this.mediaRecorder.start();
    this.shutterBtn.classList.add("recording");
    this.stopRecordBtn.disabled = false;
    this.recordingIcon.style.display = "block";
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
        this.addRecording(url, blob);

        this.isRecording = false;
        this.downloadLink.href = url;
        this.downloadLink.download = `screen-${Date.now()}.webm`;
        this.downloadLink.textContent = "Download Screen Recording";
        this.downloadLink.style.display = "flex";
        this.stopTimer();
        this.recordingIcon.style.display = "none";
        this.shutterBtn.classList.remove("recording");
        this.stopRecordBtn.disabled = true;
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
      this.stopRecordBtn.disabled = false;
      this.recordingIcon.style.display = "block";
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

  async addRecording(url, blob) {
    const displayName = `Recording ${new Date().toLocaleTimeString()}`;
    const fileName = `recording-${Date.now()}.webm`;
    const savedName = await this.fs.writeBinaryFile("Videos", fileName, blob, "video", "/static/icons/obs.webp");

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
        <span>Recordings History</span>
        ${this.wm.getWindowControls()}
      </div>
      <div id="history-list"></div>
    `;

    desktop.appendChild(this.historyWin);
    this.wm.makeDraggable(this.historyWin);
    this.wm.makeResizable(this.historyWin);
    this.wm.setupWindowControls(this.historyWin);
    this.wm.bringToFront(this.historyWin);

    this.historyWin.querySelector(".close-btn").onclick = () => {
      this.historyWin.remove();
      this.historyWin = null;
    };

    this.historyWin.style.width = "30vw";
    this.historyWin.style.height = "50vh";
    this.historyWin.style.left = "60vw";
    this.historyWin.style.top = "20vh";

    this.renderHistory();
  }

  renderHistory() {
    if (!this.historyWin) return;
    const list = this.historyWin.querySelector("#history-list");
    list.innerHTML = "";

    this.recordings.forEach((rec) => {
      const row = document.createElement("div");
      row.className = "history-item";

      const title = document.createElement("span");
      title.textContent = rec.name;
      title.onclick = () => this.playRecording(rec.url);

      const actions = document.createElement("div");
      actions.className = "history-actions";

      const renameBtn = document.createElement("button");
      renameBtn.textContent = "Rename";
      renameBtn.onclick = () => this.renameRecording(rec.id);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.onclick = () => this.deleteRecording(rec.id);

      actions.appendChild(renameBtn);
      actions.appendChild(deleteBtn);
      row.appendChild(title);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  async renameRecording(id) {
    const rec = this.recordings.find((r) => r.id === id);
    if (!rec) return;
    const name = prompt("Rename recording:", rec.name);
    if (!name) return;
    const newFileName = `${name}.webm`;
    await this.fs.renameBinaryFile("Videos", rec.id, newFileName);
    rec.id = newFileName;
    rec.name = name;
    this.renderHistory();
  }

  async deleteRecording(id) {
    const index = this.recordings.findIndex((r) => r.id === id);
    if (index === -1) return;
    URL.revokeObjectURL(this.recordings[index].url);
    await this.fs.deleteBinaryFile("Videos", id);
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
    const folder = await this.fs.getFolder("Videos").catch(() => ({}));
    const entries = Object.keys(folder).filter((k) => folder[k].type === "file");

    this.recordings = [];
    for (const name of entries) {
      const blob = await this.fs.readBinaryFile("Videos", name);
      if (!blob) continue;
      this.recordings.push({
        id: name,
        name: name.replace(/\.webm$/, ""),
        url: URL.createObjectURL(blob),
        blob
      });
    }

    if (this.historyWin) this.renderHistory();
  }
}
