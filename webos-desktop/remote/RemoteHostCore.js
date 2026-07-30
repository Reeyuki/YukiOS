const SIGNALING_BASE = "wss://yukios-remote-signaling.liventcord-a60.workers.dev";
const STUN_SERVERS = [
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.l.google.com:19302" }
];

class RemoteHostCore {
  constructor(options) {
    this.options = options;
    this.ws = null;
    this.pc = null;
    this.dataChannel = null;
    this.fileChannel = null;
    this.captureStream = null;
    this.videoEncoder = null;
    this.encoderReader = null;
    this.audioTrack = null;
    this.hostAudioEnabled = true;
    this.roomId = null;
    this.roomCode = null;
    this.useWebCodecs = false;
    this.cleaned = false;
  }

  async start(quality, fps) {
    const res = this.resolveResolution(quality);
    const frameRate = fps || 30;

    this.options.onStatus("Requesting screen capture...");

    try {
      this.captureStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: res.w }, height: { ideal: res.h }, frameRate: { ideal: frameRate } },
        audio: true
      });
    } catch (e) {
      try {
        this.captureStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: res.w }, height: { ideal: res.h }, frameRate: { ideal: frameRate } },
          audio: false
        });
      } catch (e2) {
        this.options.onError("Screen capture permission denied or unavailable");
        return false;
      }
    }

    if (!this.captureStream || this.captureStream.getVideoTracks().length === 0) {
      this.options.onError("No video track in captured stream");
      return false;
    }

    this.audioTrack = this.captureStream.getAudioTracks()[0] || null;
    if (this.audioTrack) {
      this.audioTrack.enabled = this.hostAudioEnabled;
      this.options.onAudioState(true, this.hostAudioEnabled);
    }

    const track = this.captureStream.getVideoTracks()[0];
    track.addEventListener("ended", () => {
      this.stop();
      this.options.onError("Screen capture stopped by user");
    });

    this.options.onStatus("Connecting to signaling server...");

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    this.roomId = Array.from(bytes).map(b => chars[b % chars.length]).join("");

    try {
      const connected = await this.connectSignaling();
      if (!connected) return false;
    } catch (e) {
      this.options.onError("Signaling connection failed: " + e.message);
      this.cleanupResources();
      return false;
    }

    this.initWebRTC();
    this.options.onStatus("Room: " + this.formatRoomCode(this.roomId));
    this.options.onRoomReady(this.roomId);

    this.checkWebCodecs();
    return true;
  }

  resolveResolution(quality) {
    if (quality === "max") {
      return { w: screen.width || 1920, h: screen.height || 1080 };
    } else if (quality === "1080p") {
      return { w: 1920, h: 1080 };
    }
    return { w: 1280, h: 720 };
  }

  formatRoomCode(code) {
    return code.length === 6 ? code.slice(0, 3) + "-" + code.slice(3) : code;
  }

  connectSignaling() {
    return new Promise((resolve) => {
      const wsUrl = SIGNALING_BASE + "?room=" + this.roomId;
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.send(JSON.stringify({ type: "register-host" }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "host-registered") {
            this.roomCode = msg.room;
            this.ws = ws;
            resolve(true);
          } else if (msg.type === "client-joined") {
            this.options.onClientJoined();
            this.startStreaming();
          } else {
            this.handleSignalingMsg(msg);
          }
        } catch (e) {
          console.error("Signaling parse error:", e);
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        if (!this.cleaned) {
          this.options.onError("Signaling connection lost");
          this.stop();
        }
      };
    });
  }

  handleSignalingMsg(msg) {
    switch (msg.type) {
      case "answer":
        if (this.useWebCodecs) break;
        if (this.pc && this.pc.localDescription && this.pc.localDescription.type === "offer") {
          this.pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: msg.sdp })).catch(console.error);
        }
        break;
      case "ice-candidate":
        if (this.pc && msg.candidate) {
          this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(console.error);
        }
        break;
    }
  }

  initWebRTC() {
    this.pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate.toJSON(), from: "host" }));
      }
    };

    this.pc.onconnectionstatechange = () => {
      this.options.onConnectionState(this.pc.connectionState);
    };

    this.dataChannel = this.pc.createDataChannel("relay");
    this.dataChannel.binaryType = "arraybuffer";
    this.dataChannel.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          this.options.onInput(JSON.parse(event.data));
        } catch (e) {
          console.error("Input parse error:", e);
        }
      }
    };

    let fileBuffer = [];
    let fileMeta = null;
    this.fileChannel = this.pc.createDataChannel("file-transfer");
    this.fileChannel.binaryType = "arraybuffer";
    this.fileChannel.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
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
        } catch (e) {
          console.error("File channel parse error:", e);
        }
      } else if (event.data instanceof ArrayBuffer) {
        fileBuffer.push(event.data);
      }
    };
  }

  checkWebCodecs() {
    if (typeof MediaStreamTrackProcessor !== "undefined" && typeof VideoEncoder !== "undefined") {
      VideoEncoder.isConfigSupported({
        codec: "avc1.42001E",
        width: 640,
        height: 480,
        bitrate: 1_000_000,
        framerate: 30,
        hardwareAcceleration: "prefer-hardware",
        avc: { format: "annexb" }
      }).then((support) => {
        if (support.supported) {
          this.useWebCodecs = true;
        }
      }).catch(() => {});
    }
  }

  async startStreaming() {
    const track = this.captureStream.getVideoTracks()[0];
    if (!track) return;

    if (this.useWebCodecs) {
      try {
        await this.startWebCodecsStream(track);
        const audioTracks = this.captureStream.getAudioTracks();
        for (const t of audioTracks) {
          this.pc.addTrack(t, this.captureStream);
        }
        return;
      } catch (err) {
        console.error("WebCodecs failed, falling back to WebRTC track:", err);
      }
    }

    const tracks = this.captureStream.getTracks();
    for (const t of tracks) {
      this.pc.addTrack(t, this.captureStream);
    }

    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.ws.send(JSON.stringify({ type: "offer", sdp: this.pc.localDescription.sdp }));
    } catch (err) {
      this.options.onError("Failed to create offer: " + err.message);
    }
  }

  async startWebCodecsStream(track) {
    const s = track.getSettings();
    const width = s.width || 1280;
    const height = s.height || 720;
    const frameRate = s.frameRate || 30;
    const totalPixels = width * height;
    const bitrate = Math.min(Math.max(Math.round(totalPixels / (1280 * 720) * 2_500_000), 1_000_000), 20_000_000);

    const encoderConfig = {
      codec: "avc1.42001E",
      width,
      height,
      bitrate,
      framerate: frameRate,
      hardwareAcceleration: "prefer-hardware",
      avc: { format: "annexb" }
    };

    let supported = (await VideoEncoder.isConfigSupported(encoderConfig)).supported;
    if (!supported) {
      encoderConfig.hardwareAcceleration = "prefer-software";
      supported = (await VideoEncoder.isConfigSupported(encoderConfig)).supported;
      if (!supported) throw new Error("H.264 encoding not supported");
    }

    this.videoEncoder = new VideoEncoder({
      output: (chunk) => {
        if (this.dataChannel && this.dataChannel.readyState === "open") {
          const raw = new Uint8Array(chunk.byteLength);
          chunk.copyTo(raw);
          const typeByte = chunk.type === "key" ? 1 : 0;
          const tsView = new DataView(new ArrayBuffer(4));
          tsView.setUint32(0, chunk.timestamp, true);
          const durView = new DataView(new ArrayBuffer(4));
          durView.setUint32(0, chunk.duration || 33000, true);
          const header = new Uint8Array([typeByte, ...new Uint8Array(tsView.buffer), ...new Uint8Array(durView.buffer)]);
          const merged = new Uint8Array(header.length + raw.length);
          merged.set(header);
          merged.set(raw, header.length);
          this.dataChannel.send(merged.buffer);
        }
      },
      error: (err) => console.error("VideoEncoder error:", err)
    });
    this.videoEncoder.configure(encoderConfig);

    const processor = new MediaStreamTrackProcessor({ track });
    this.encoderReader = processor.readable.getReader();

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.ws.send(JSON.stringify({ type: "offer", sdp: this.pc.localDescription.sdp, codec: "h264" }));

    this.readEncoderFrames();
  }

  async readEncoderFrames() {
    try {
      while (this.videoEncoder && this.videoEncoder.state !== "closed") {
        const { done, value: frame } = await this.encoderReader.read();
        if (done) break;
        this.videoEncoder.encode(frame);
        frame.close();
      }
    } catch (err) {
      console.error("Encoder read loop error:", err);
    } finally {
      if (this.encoderReader) {
        try { await this.encoderReader.cancel(); } catch (e) {}
        this.encoderReader = null;
      }
    }
  }

  toggleAudio() {
    this.hostAudioEnabled = !this.hostAudioEnabled;
    if (this.audioTrack) {
      this.audioTrack.enabled = this.hostAudioEnabled;
    }
    this.options.onAudioState(!!this.audioTrack, this.hostAudioEnabled);
  }

  stop() {
    this.cleaned = true;
    this.cleanupResources();
  }

  cleanupResources() {
    if (this.encoderReader) {
      try { this.encoderReader.cancel(); } catch (e) {}
      this.encoderReader = null;
    }
    if (this.videoEncoder) {
      try { this.videoEncoder.close(); } catch (e) {}
      this.videoEncoder = null;
    }
    if (this.dataChannel) { try { this.dataChannel.close(); } catch (e) {} this.dataChannel = null; }
    if (this.fileChannel) { try { this.fileChannel.close(); } catch (e) {} this.fileChannel = null; }
    if (this.pc) { try { this.pc.close(); } catch (e) {} this.pc = null; }
    if (this.captureStream) {
      this.captureStream.getTracks().forEach(t => t.stop());
      this.captureStream = null;
    }
    if (this.ws) { try { this.ws.close(); } catch (e) {} this.ws = null; }
    this.roomId = null;
    this.roomCode = null;
    this.useWebCodecs = false;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { RemoteHostCore };
} else if (typeof window !== "undefined") {
  window.RemoteHostCore = RemoteHostCore;
}
