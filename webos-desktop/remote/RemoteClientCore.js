const SIGNALING_URL = "wss://yukios-remote-signaling.liventcord-a60.workers.dev";
const STUN_SERVERS = [
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.l.google.com:19302" }
];
const MAX_RECONNECT = 20;

class RemoteClientCore {
  constructor(options) {
    this.options = options;
    this.ws = null;
    this.pc = null;
    this.dataChannel = null;
    this.fileChannel = null;
    this.roomCode = null;
    this.connected = false;
    this.useWebCodecs = false;
    this.videoDecoder = null;
    this.decoderCanvas = null;
    this.decoderCtx = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.isIntentionalDisconnect = false;
  }

  connect(code) {
    this.roomCode = code;
    this.isIntentionalDisconnect = false;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.options.onOverlay(true);
    this.options.onStatus("Connecting to signaling server...", false);

    const wsUrl = SIGNALING_URL + "?room=" + encodeURIComponent(code);
    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      this.options.onError("Failed to connect to signaling server");
      this.disconnect();
      return;
    }

    this.ws.onopen = () => {
      this.options.onStatus("Joining room...", false);
      this.ws.send(JSON.stringify({ type: "join-as-client" }));
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleSignaling(msg);
      } catch (err) {
        console.error("Invalid signaling message:", err);
      }
    };

    this.ws.onerror = () => {
      this.options.onError("Signaling connection error");
    };

    this.ws.onclose = () => {
      if (this.isIntentionalDisconnect || !this.roomCode || this.reconnectAttempts >= MAX_RECONNECT) {
        if (this.connected) {
          this.options.onError("Disconnected from host");
        }
        this.options.onStatus("Disconnected", false);
        this.options.onOverlay(true);
        this.connected = false;
        this.reconnectAttempts = 0;
        return;
      }
      this.connected = false;
      this.startReconnect();
    };
  }

  handleSignaling(msg) {
    switch (msg.type) {
      case "room-joined":
        this.options.onStatus("Connected to room, waiting for stream...", true);
        this.connected = true;
        this.initWebRTC();
        break;

      case "offer":
        if (!this.pc) this.initWebRTC();
        this.pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: msg.sdp }))
          .then(() => this.pc.createAnswer())
          .then((answer) => this.pc.setLocalDescription(answer))
          .then(() => {
            this.ws.send(JSON.stringify({ type: "answer", sdp: this.pc.localDescription.sdp }));
            if (msg.codec === "h264") {
              this.options.onStatus("H.264 stream starting...", true);
              this.options.onOverlay(false);
            }
          })
          .catch((err) => console.error("Failed to handle offer:", err));
        break;

      case "ice-candidate":
        if (this.pc && msg.candidate) {
          try {
            this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (err) {
            console.error("Failed to add ICE candidate:", err);
          }
        }
        break;

      case "host-disconnected":
        this.options.onError("Host disconnected");
        this.disconnect();
        break;

      case "error":
        this.options.onError(msg.message || "Server error");
        break;
    }
  }

  initWebRTC() {
    try {
      this.pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    } catch (err) {
      this.options.onError("WebRTC not supported in this browser");
      return;
    }

    this.pc.ontrack = (event) => {
      if (this.options.videoElement && !this.options.videoElement.srcObject) {
        this.options.videoElement.srcObject = event.streams[0];
      }
      if (event.track.kind === "video") {
        this.options.onOverlay(false);
        this.options.onStatus("Streaming", true);
      }
      if (event.track.kind === "audio" && this.options.onAudio) {
        this.options.onAudio(true);
        event.track.onmute = () => this.options.onAudio && this.options.onAudio(false);
        event.track.onunmute = () => this.options.onAudio && this.options.onAudio(true);
      }
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.ws.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate.toJSON(), from: "client" }));
      }
    };

    this.pc.onconnectionstatechange = () => {
      switch (this.pc.connectionState) {
        case "connected":
          this.options.onStatus("Streaming", true);
          break;
        case "disconnected":
        case "failed":
          this.options.onError("Connection lost");
          break;
        case "closed":
          this.options.onStatus("Disconnected", false);
          this.options.onOverlay(true);
          break;
      }
    };

    this.pc.ondatachannel = (event) => {
      const channel = event.channel;
      channel.binaryType = "arraybuffer";

      if (channel.label === "file-transfer") {
        this.fileChannel = channel;
        this.handleFileChannel(channel);
        return;
      }

      channel.onmessage = (msgEvent) => {
        if (msgEvent.data instanceof ArrayBuffer) {
          if (this.useWebCodecs) {
            try {
              const buf = new Uint8Array(msgEvent.data);
              const typeByte = buf[0];
              const timestamp = new DataView(buf.buffer, 1, 4).getUint32(0, true);
              const duration = new DataView(buf.buffer, 5, 4).getUint32(0, true);
              const h264Data = buf.subarray(9);
              const chunk = new EncodedVideoChunk({
                type: typeByte === 1 ? "key" : "delta",
                timestamp: timestamp,
                duration: duration || 33000,
                data: h264Data
              });
              this.videoDecoder.decode(chunk);
            } catch (e) {
              console.error("Decode error:", e);
            }
          }
        } else if (typeof msgEvent.data === "string") {
          try {
            const input = JSON.parse(msgEvent.data);
            this.options.onInput(input);
          } catch (err) {
            console.error("Failed to parse input:", err);
          }
        }
      };
    };

    this.initDecoder();
    this.setupInputCapture();
  }

  initDecoder() {
    const videoElement = this.options.videoElement;

    if (typeof VideoDecoder === "undefined") {
      this.useWebCodecs = false;
      return;
    }

    this.videoDecoder = new VideoDecoder({
      output: (frame) => {
        if (!this.decoderCanvas) {
          this.decoderCanvas = document.createElement("canvas");
          this.decoderCtx = this.decoderCanvas.getContext("2d");
        }
        this.decoderCanvas.width = frame.displayWidth;
        this.decoderCanvas.height = frame.displayHeight;
        this.decoderCtx.drawImage(frame, 0, 0);
        frame.close();

        if (videoElement) {
          videoElement.style.display = "none";
        }
        const parent = videoElement ? videoElement.parentElement : null;
        if (parent) {
          let existingCanvas = parent.querySelector(".decoder-canvas");
          if (!existingCanvas) {
            existingCanvas = document.createElement("canvas");
            existingCanvas.className = "decoder-canvas";
            existingCanvas.style.maxWidth = "100%";
            existingCanvas.style.maxHeight = "100%";
            existingCanvas.style.objectFit = "contain";
            parent.insertBefore(existingCanvas, videoElement);
          }
          existingCanvas.width = this.decoderCanvas.width;
          existingCanvas.height = this.decoderCanvas.height;
          const ctx = existingCanvas.getContext("2d");
          ctx.drawImage(this.decoderCanvas, 0, 0, existingCanvas.width, existingCanvas.height);
          this.options.onOverlay(false);
          this.options.onStatus("Streaming (H.264)", true);
        }
      },
      error: (err) => {
        console.error("VideoDecoder error:", err);
        this.useWebCodecs = false;
      }
    });

    this.useWebCodecs = true;
  }

  decodeH264(data) {
    if (!this.videoDecoder || this.videoDecoder.state === "closed") return;
    try {
      const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
      const typeByte = buf[0];
      const timestamp = new DataView(buf.buffer, 1, 4).getUint32(0, true);
      const duration = new DataView(buf.buffer, 5, 4).getUint32(0, true);
      const h264Data = buf.subarray(9);
      const chunk = new EncodedVideoChunk({
        type: typeByte === 1 ? "key" : "delta",
        timestamp: timestamp,
        duration: duration || 33000,
        data: h264Data
      });
      this.videoDecoder.decode(chunk);
    } catch (e) {
      console.error("Decode error:", e);
    }
  }

  handleFileChannel(channel) {
    let fileMeta = null;
    let fileBuffer = [];

    channel.onmessage = (msgEvent) => {
      if (typeof msgEvent.data === "string") {
        try {
          const msg = JSON.parse(msgEvent.data);
          if (msg.type === "file-start") {
            fileMeta = msg;
            fileBuffer = [];
          } else if (msg.type === "file-end" && fileMeta) {
            const total = fileBuffer.reduce((s, c) => s + c.byteLength, 0);
            const data = new Uint8Array(total);
            let off = 0;
            for (const chunk of fileBuffer) {
              data.set(new Uint8Array(chunk), off);
              off += chunk.byteLength;
            }
            const blob = new Blob([data], { type: fileMeta.mime || "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileMeta.name;
            a.click();
            URL.revokeObjectURL(url);
            fileMeta = null;
            fileBuffer = [];
          }
        } catch (err) {
          console.error("File channel parse error:", err);
        }
      } else if (msgEvent.data instanceof ArrayBuffer) {
        fileBuffer.push(msgEvent.data);
      }
    };
  }

  sendFile(file) {
    const channel = this.fileChannel;
    if (!channel || channel.readyState !== "open") {
      console.error("File channel not open");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const data = new Uint8Array(reader.result);
      const chunkSize = 16384;

      channel.send(JSON.stringify({
        type: "file-start",
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream"
      }));

      for (let offset = 0; offset < data.length; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, data.length);
        channel.send(data.buffer.slice(offset, end));
      }

      channel.send(JSON.stringify({ type: "file-end" }));
    };
    reader.readAsArrayBuffer(file);
  }

  setupInputCapture() {
    const container = this.options.videoContainer;
    if (!container) return;

    this.containerMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      this.sendInput({ type: "mousemove", x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000 });
    };
    this.containerMouseDown = (e) => {
      this.sendInput({ type: "mousedown", button: e.button === 2 ? "right" : "left" });
    };
    this.containerMouseUp = (e) => {
      this.sendInput({ type: "mouseup", button: e.button === 2 ? "right" : "left" });
    };
    this.containerWheel = (e) => {
      e.preventDefault();
      this.sendInput({ type: "scroll", deltaX: e.deltaX, deltaY: e.deltaY });
    };
    this.docKeydown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (this.options.onKeydown && this.options.onKeydown(e)) {
        return;
      }
      e.preventDefault();
      this.sendInput({ type: "keydown", key: e.key, code: e.code, alt: e.altKey, ctrl: e.ctrlKey, shift: e.shiftKey, meta: e.metaKey });
    };
    this.docKeyup = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      e.preventDefault();
      this.sendInput({ type: "keyup", key: e.key, code: e.code, alt: e.altKey, ctrl: e.ctrlKey, shift: e.shiftKey, meta: e.metaKey });
    };
    this.docContextMenu = (e) => {
      if (this.options.onContextMenu) {
        this.options.onContextMenu(e);
      } else {
        e.preventDefault();
      }
    };

    container.addEventListener("mousemove", this.containerMouseMove);
    container.addEventListener("mousedown", this.containerMouseDown);
    container.addEventListener("mouseup", this.containerMouseUp);
    container.addEventListener("wheel", this.containerWheel, { passive: false });
    document.addEventListener("keydown", this.docKeydown);
    document.addEventListener("keyup", this.docKeyup);
    document.addEventListener("contextmenu", this.docContextMenu);
  }

  sendInput(input) {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      this.dataChannel.send(JSON.stringify(input));
    } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "input-event", input }));
    }
  }

  startReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    const secs = (delay / 1000).toFixed(0);
    this.options.onStatus("Reconnecting in " + secs + "s... (" + this.reconnectAttempts + "/" + MAX_RECONNECT + ")", false);
    this.options.onOverlay(true);

    this.reconnectTimer = setTimeout(() => {
      const wsUrl = SIGNALING_URL + "?room=" + encodeURIComponent(this.roomCode);
      let newWs;
      try {
        newWs = new WebSocket(wsUrl);
      } catch (err) {
        this.startReconnect();
        return;
      }

      this.options.onStatus("Reconnecting...", false);

      newWs.onopen = () => {
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        this.ws = newWs;
        this.options.onStatus("Joining room...", false);
        this.ws.send(JSON.stringify({ type: "join-as-client" }));

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this.handleSignaling(msg);
          } catch (err) {
            console.error("Invalid signaling message:", err);
          }
        };

        this.ws.onerror = () => {
          this.options.onStatus("Reconnect error", false);
        };

        this.ws.onclose = () => {
          if (!this.isIntentionalDisconnect && this.roomCode && this.reconnectAttempts < MAX_RECONNECT) {
            this.startReconnect();
          } else {
            this.options.onStatus("Disconnected", false);
            this.options.onOverlay(true);
            this.connected = false;
          }
        };
      };

      newWs.onerror = () => {
        this.options.onStatus("Reconnect failed", false);
        this.startReconnect();
      };

      newWs.onclose = () => {
        if (this.reconnectAttempts < MAX_RECONNECT) {
          this.startReconnect();
        } else {
          this.options.onError("Max reconnection attempts reached");
          this.options.onStatus("Disconnected", false);
          this.options.onOverlay(true);
        }
      };
    }, delay);
  }

  removeInputListeners() {
    const container = this.options.videoContainer;
    if (container) {
      if (this.containerMouseMove) container.removeEventListener("mousemove", this.containerMouseMove);
      if (this.containerMouseDown) container.removeEventListener("mousedown", this.containerMouseDown);
      if (this.containerMouseUp) container.removeEventListener("mouseup", this.containerMouseUp);
      if (this.containerWheel) container.removeEventListener("wheel", this.containerWheel);
    }
    if (this.docKeydown) document.removeEventListener("keydown", this.docKeydown);
    if (this.docKeyup) document.removeEventListener("keyup", this.docKeyup);
    if (this.docContextMenu) document.removeEventListener("contextmenu", this.docContextMenu);
    this.containerMouseMove = null;
    this.containerMouseDown = null;
    this.containerMouseUp = null;
    this.containerWheel = null;
    this.docKeydown = null;
    this.docKeyup = null;
    this.docContextMenu = null;
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.reconnectAttempts = 0;
    this.removeInputListeners();
    if (this.videoDecoder) {
      try { this.videoDecoder.close(); } catch (e) {}
      this.videoDecoder = null;
    }
    this.useWebCodecs = false;
    const existingCanvas = this.options.videoElement
      ? this.options.videoElement.parentElement?.querySelector(".decoder-canvas")
      : null;
    if (existingCanvas) existingCanvas.remove();
    this.decoderCanvas = null;
    this.decoderCtx = null;
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.fileChannel) {
      this.fileChannel.close();
      this.fileChannel = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.roomCode = null;
    if (this.options.videoElement) {
      this.options.videoElement.srcObject = null;
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { RemoteClientCore };
} else if (typeof window !== "undefined") {
  window.RemoteClientCore = RemoteClientCore;
}
