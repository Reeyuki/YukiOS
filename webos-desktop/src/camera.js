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
        <div style="position:relative; width:100%; max-width:600px;">
          <video id="camera-video" autoplay playsinline style="width:100%; border:1px solid #ccc; border-radius:8px;"></video>
          <span id="recording-icon" style="position:absolute; top:10px; left:10px; width:15px; height:15px; border-radius:50%; background:red; display:none;"></span>
          <span id="recording-timer" style="position:absolute; top:10px; right:10px; font-weight:bold;"></span>
        </div>
        <div style="margin-top:10px; display:flex; gap:10px;">
          <button id="take-photo-btn" style="padding:5px 15px;">Take Photo</button>
          <button id="start-record-btn" style="padding:5px 15px;">Start Recording</button>
          <button id="stop-record-btn" style="padding:5px 15px;" disabled>Stop Recording</button>
          <button id="open-history-btn" style="padding:5px 15px;">History</button>
        </div>
        <a id="download-link" style="display:none; margin-top:10px;"></a>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Camera", "/static/icons/camera.svg");

    win.querySelector(".close-btn").onclick = () => {
      this.stopCamera();
      win.remove();
      if (this.historyWin) this.historyWin.remove();
    };

    this.video = win.querySelector("#camera-video");
    this.takePhotoBtn = win.querySelector("#take-photo-btn");
    this.startRecordBtn = win.querySelector("#start-record-btn");
    this.stopRecordBtn = win.querySelector("#stop-record-btn");
    this.downloadLink = win.querySelector("#download-link");
    this.recordingIcon = win.querySelector("#recording-icon");
    this.recordingTimer = win.querySelector("#recording-timer");
    this.historyBtn = win.querySelector("#open-history-btn");

    win.style.width = "50vw";
    win.style.height = "70vh";
    win.style.left = "25vw";
    win.style.top = "15vh";

    this.startCamera();

    this.takePhotoBtn.onclick = () => this.takePhoto();
    this.startRecordBtn.onclick = () => this.startRecording();
    this.stopRecordBtn.onclick = () => this.stopRecording();
    this.historyBtn.onclick = () => this.openHistoryWindow();
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.video.srcObject = this.stream;
    } catch (err) {
      alert("Camera access denied or not available.");
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
      this.addRecording(url);
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
      this.startRecordBtn.disabled = false;
      this.stopRecordBtn.disabled = true;
      this.recordingIcon.style.display = "none";
      this.stopTimer();
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

  addRecording(url) {
    this.recordings.unshift(url);
    if (this.recordings.length > 5) this.recordings.pop();
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
    this.recordings.forEach((url, index) => {
      const item = document.createElement("div");
      item.textContent = `Recording ${this.recordings.length - index}`;
      item.style.cursor = "pointer";
      item.style.padding = "5px";
      item.style.borderBottom = "1px solid #ccc";
      item.onclick = () => this.playRecording(url);
      list.appendChild(item);
    });
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
}
