import { desktop } from "./desktop.js";
export class CameraApp {
  constructor(windowManager) {
    this.wm = windowManager;
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
      <div style="padding:10px; display:flex; flex-direction:column; align-items:center; position:relative;">
      <div class="video-shell">
        <video id="camera-video" autoplay playsinline></video>
        <span id="recording-icon"></span>
        <span id="recording-timer"></span>
      </div>

        <div style="margin-top:10px; display:flex; gap:10px;">
          <button id="take-photo-btn" style="padding:5px 15px;">Take Photo</button>
          <button id="start-record-btn" style="padding:5px 15px;">Start Recording</button>
          <button id="stop-record-btn" style="padding:5px 15px;" disabled>Stop Recording</button>
          <button id="start-screen-btn" style="padding:5px 15px;">Record Screen</button>
          <button id="open-history-btn" style="padding:5px 15px;">History</button>
        </div>
        <a id="download-link" style="display:none; margin-top:10px;"></a>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Camera", "/static/icons/obs.webp");
    this.wm.bringToFront(win);
    const closebtn = win.querySelector(".close-btn");
    closebtn.addEventListener("click", () => {
      this.stopCamera();
      if (this.historyWin) this.historyWin.remove();
    });

    this.wm.registerCloseWindow(closebtn, win.id);

    this.video = win.querySelector("#camera-video");
    this.takePhotoBtn = win.querySelector("#take-photo-btn");
    this.startRecordBtn = win.querySelector("#start-record-btn");
    this.stopRecordBtn = win.querySelector("#stop-record-btn");
    this.downloadLink = win.querySelector("#download-link");
    this.recordingIcon = win.querySelector("#recording-icon");
    this.recordingTimer = win.querySelector("#recording-timer");
    this.historyBtn = win.querySelector("#open-history-btn");
    this.startScreenBtn = win.querySelector("#start-screen-btn");

    win.style.width = "50vw";
    win.style.height = "70vh";
    win.style.left = "25vw";
    win.style.top = "15vh";

    this.startCamera();

    this.takePhotoBtn.onclick = () => this.takePhoto();
    this.startRecordBtn.onclick = () => this.startRecording();
    this.stopRecordBtn.onclick = () => this.stopRecording();
    this.historyBtn.onclick = () => this.openHistoryWindow();
    this.startScreenBtn.onclick = () => this.startScreenRecording();
    this.db = this.initDB();
    this.restoreHistory();
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.video.srcObject = this.stream;
    } catch (err) {
      this.wm.showPopup("Camera access denied or not available.");
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
    this.downloadLink.style.display = "block";
  }

  startRecording() {
    if (!this.stream) return;

    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      this.addRecording(url, blob);

      this.stopTimer();
      this.downloadLink.href = url;
      this.downloadLink.download = `video-${Date.now()}.webm`;
      this.downloadLink.textContent = "Download Video";
      this.downloadLink.style.display = "block";
      if (this.historyWin) this.renderHistory();
    };

    this.mediaRecorder.start();
    this.startRecordBtn.disabled = true;
    this.stopRecordBtn.disabled = false;
    this.recordingIcon.style.display = "block";
    this.startTimer();
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
      this.stopTimer();
      this.recordingIcon.style.display = "none";
      this.startRecordBtn.disabled = false;
      this.stopRecordBtn.disabled = true;
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

        this.downloadLink.href = url;
        this.downloadLink.download = `screen-${Date.now()}.webm`;
        this.downloadLink.textContent = "Download Screen Recording";
        this.downloadLink.style.display = "block";
        this.stopTimer();
        this.recordingIcon.style.display = "none";
        this.startRecordBtn.disabled = false;
        this.stopRecordBtn.disabled = true;
        this.activeStream.getTracks().forEach((t) => t.stop());
        this.activeStream = null;
        this.video.srcObject = this.stream;
        if (this.historyWin) this.renderHistory();
      };

      screenStream.getVideoTracks()[0].onended = () => {
        if (this.mediaRecorder.state !== "inactive") this.mediaRecorder.stop();
      };

      this.mediaRecorder.start();
      this.startRecordBtn.disabled = true;
      this.stopRecordBtn.disabled = false;
      this.recordingIcon.style.display = "block";
      this.startTimer();
    } catch (e) {
      console.error(e);
      this.wm.showPopup("Screen capture cancelled or not allowed");
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
    const rec = {
      id: crypto.randomUUID(),
      name: `Recording ${new Date().toLocaleTimeString()}`,
      blob
    };

    this.recordings.unshift({
      ...rec,
      url: URL.createObjectURL(blob)
    });

    await this.saveRecordingToDB(rec);

    if (this.recordings.length > 5) {
      const removed = this.recordings.pop();
      URL.revokeObjectURL(removed.url);
      await this.deleteRecordingFromDB(removed.id);
    }
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
      <div id="history-list" style="padding:10px; display:flex; flex-direction:column; gap:5px; overflow-y:auto; height:calc(100% - 30px);"></div>
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
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.gap = "6px";
      row.style.borderBottom = "1px solid #ccc";
      row.style.padding = "6px";

      const title = document.createElement("span");
      title.textContent = rec.name;
      title.style.cursor = "pointer";
      title.onclick = () => this.playRecording(rec.url);

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "4px";

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
    rec.name = name;
    const dbRec = { id, name, blob: rec.blob };
    await this.saveRecordingToDB(dbRec);
    this.renderHistory();
  }

  async deleteRecording(id) {
    const index = this.recordings.findIndex((r) => r.id === id);
    if (index === -1) return;
    URL.revokeObjectURL(this.recordings[index].url);
    this.recordings.splice(index, 1);
    await this.deleteRecordingFromDB(id);
    this.renderHistory();
  }

  playRecording(url) {
    const playerWin = document.createElement("div");
    playerWin.className = "window";

    playerWin.innerHTML = `
      <div class="window-header">
        <span>Playback</span>
        <div class="window-controls">
          <button class="close-btn">X</button>
        </div>
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

  async initDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("camera-recordings-db", 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        db.createObjectStore("recordings", { keyPath: "id" });
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e);
    });
  }

  async saveRecordingToDB(rec) {
    const db = await this.db;
    return new Promise((resolve) => {
      const tx = db.transaction("recordings", "readwrite");
      tx.objectStore("recordings").put(rec);
      tx.oncomplete = resolve;
    });
  }

  async deleteRecordingFromDB(id) {
    const db = await this.db;
    return new Promise((resolve) => {
      const tx = db.transaction("recordings", "readwrite");
      tx.objectStore("recordings").delete(id);
      tx.oncomplete = resolve;
    });
  }

  async loadRecordingsFromDB() {
    const db = await this.db;
    return new Promise((resolve) => {
      const tx = db.transaction("recordings", "readonly");
      const req = tx.objectStore("recordings").getAll();
      req.onsuccess = () => resolve(req.result);
    });
  }
  async restoreHistory() {
    const stored = await this.loadRecordingsFromDB();
    this.recordings = stored.map((r) => ({
      ...r,
      url: URL.createObjectURL(r.blob)
    }));
  }
}
