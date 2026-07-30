const $ = (id) => document.getElementById(id);

const connectScreen = $("connectScreen");
const viewerScreen = $("viewerScreen");
const roomInput = $("roomInput");
const connectBtn = $("connectBtn");
const qrBtn = $("qrBtn");
const qrFileInput = $("qrFileInput");
const disconnectBtn = $("disconnectBtn");
const remoteVideo = $("remoteVideo");
const overlay = $("overlay");
const statusText = $("statusText");
const statusDot = $("statusDot");
const roomBadge = $("roomBadge");
const toast = $("toast");

function showToast(msg) {
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => toast.style.display = "none", 4000);
}

const core = new RemoteClientCore({
  videoElement: remoteVideo,
  videoContainer: $("videoContainer"),
  onStatus(text, connected) {
    statusText.textContent = text;
    statusDot.classList.toggle("disconnected", !connected);
  },
  onError(msg) {
    showToast(msg);
    disconnect();
  },
  onOverlay(visible) {
    overlay.classList.toggle("hidden", !visible);
  },
  onKeydown(e) {
    if (e.key === "Escape" && viewerScreen.style.display !== "none") {
      disconnect();
      return true;
    }
    return false;
  },
  onInput(input) {}
});

roomInput.addEventListener("input", () => {
  roomInput.value = roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  connectBtn.disabled = roomInput.value.length !== 6;
});

roomInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && roomInput.value.length === 6) {
    connectBtn.click();
  }
});

connectBtn.addEventListener("click", () => {
  const code = roomInput.value.trim();
  if (code.length !== 6) return;
  connectScreen.style.display = "none";
  viewerScreen.style.display = "flex";
  roomBadge.textContent = code.slice(0, 3) + "-" + code.slice(3);
  core.connect(code);
});

disconnectBtn.addEventListener("click", disconnect);

qrBtn.addEventListener("click", () => {
  qrFileInput.click();
});

qrFileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const imageUrl = URL.createObjectURL(file);
    const code = await decodeQR(imageUrl);
    URL.revokeObjectURL(imageUrl);
    if (code && (code.length === 6 || code.replace(/-/g, "").length === 6)) {
      roomInput.value = code.toUpperCase().replace(/-/g, "");
      connectBtn.disabled = false;
      connectBtn.click();
    } else {
      showToast("Could not read a valid code from QR");
    }
  } catch {
    showToast("Failed to decode QR image");
  }
  qrFileInput.value = "";
});

async function decodeQR(imageUrl) {
  const img = new Image();
  img.src = imageUrl;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  if (typeof jsQR !== "undefined") {
    const result = jsQR(imageData.data, imageData.width, imageData.height);
    return result ? result.data : null;
  }

  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  const result = jsQR(imageData.data, imageData.width, imageData.height);
  return result ? result.data : null;
}

function disconnect() {
  core.disconnect();
  const existingCanvas = document.querySelector(".decoder-canvas");
  if (existingCanvas) existingCanvas.remove();
  remoteVideo.style.display = "";
  connectScreen.style.display = "flex";
  viewerScreen.style.display = "none";
  roomInput.value = "";
  connectBtn.disabled = true;
  statusDot.classList.add("disconnected");
  statusText.textContent = "Disconnected";
  overlay.classList.remove("hidden");
}

const fileInput = $("fileInput");
const fileUploadBtn = $("fileUploadBtn");

fileUploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  showToast("Sending " + file.name + "...");
  core.sendFile(file);
  fileInput.value = "";
});

const copyRoomBtn = $("copyRoomBtn");
copyRoomBtn.addEventListener("click", () => {
  const code = roomBadge.textContent;
  if (code) {
    navigator.clipboard.writeText(code.replace(/-/g, ""));
    showToast("Room code copied");
  }
});
