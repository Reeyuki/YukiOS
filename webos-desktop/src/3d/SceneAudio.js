const NOISE_LENGTH = 0.5;

export class SceneAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.reverbMix = null;
    this.cameraGetter = null;
    this.lastHoverId = null;
    this.footstepTimer = 0;
    this.prevMoving = false;
    this.uiEnabled = true;
    this.footstepEnabled = true;
    this.ambientEnabled = true;
  }

  ensure() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.4;
    this.masterGain.connect(this.ctx.destination);
    this.createReverb();
  }

  createReverb() {
    const sr = this.ctx.sampleRate;
    const len = sr * 0.08;
    const buffer = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.015));
      }
    }
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = buffer;
    this.reverbMix = this.ctx.createGain();
    this.reverbMix.gain.value = 0.25;
    this.reverbNode.connect(this.reverbMix);
    this.reverbMix.connect(this.masterGain);
  }

  createGain(vol) {
    const g = this.ctx.createGain();
    g.gain.value = vol;
    return g;
  }

  createOsc(type, freq) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }

  getNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * NOISE_LENGTH;
    const buffer = this.ctx.createBuffer(1, len, sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  playTone(freq, duration, opts = {}) {
    this.ensure();
    const { type = "sine", volume = 0.1, sweep = 0, delay = 0, filter = 0, pan = 0 } = opts;
    const now = this.ctx.currentTime + delay;
    const osc = this.createOsc(type, freq);
    const gain = this.createGain(0);
    if (pan) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      gain.connect(this.masterGain);
    }
    if (filter) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = "lowpass";
      bp.frequency.value = filter;
      osc.connect(bp);
      bp.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.005);
    if (sweep) osc.frequency.linearRampToValueAtTime(freq + sweep, now + duration);
    gain.gain.setValueAtTime(volume, now + duration * 0.7);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  playNoise(duration, opts = {}) {
    this.ensure();
    const { volume = 0.05, filter = 0, delay = 0, pan = 0 } = opts;
    const now = this.ctx.currentTime + delay;
    const buffer = this.getNoiseBuffer();
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const gain = this.createGain(0);
    if (filter) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = "lowpass";
      bp.frequency.value = filter;
      src.connect(bp);
      bp.connect(gain);
    } else {
      src.connect(gain);
    }
    if (pan) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      gain.connect(this.masterGain);
    }
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.setValueAtTime(volume, now + duration * 0.7);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    src.start(now);
    src.stop(now + duration + 0.02);
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
    };
  }

  playSweep(from, to, duration, opts = {}) {
    this.ensure();
    const { type = "sine", volume = 0.1, delay = 0, filter = 0 } = opts;
    const now = this.ctx.currentTime + delay;
    const osc = this.createOsc(type, from);
    const gain = this.createGain(0);
    if (filter) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = "lowpass";
      bp.frequency.value = filter;
      osc.connect(bp);
      bp.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(this.masterGain);
    osc.frequency.linearRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.005);
    gain.gain.setValueAtTime(volume, now + duration * 0.7);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  playChord(freqs, duration, opts = {}) {
    for (const f of freqs) {
      this.playTone(f, duration, opts);
    }
  }

  playReverbTone(freq, duration, opts = {}) {
    this.ensure();
    const { type = "sine", volume = 0.1, delay = 0 } = opts;
    const now = this.ctx.currentTime + delay;
    const osc = this.createOsc(type, freq);
    const gain = this.createGain(0);
    osc.connect(gain);
    gain.connect(this.reverbNode);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.setValueAtTime(volume, now + duration * 0.5);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.05);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  spatialGain(pos) {
    if (!this.cameraGetter || !pos) return null;
    const cam = this.cameraGetter();
    if (!cam) return null;
    const dx = cam.position.x - pos.x;
    const dz = cam.position.z - (pos.z || 0);
    const dist = Math.sqrt(dx * dx + dz * dz);
    const vol = Math.max(0.1, Math.min(1, 1 - dist / 8));
    const g = this.ctx.createGain();
    g.gain.value = vol;
    return g;
  }

  playHover() {
    if (!this.uiEnabled) return;
    this.playTone(800, 0.03, { type: "triangle", volume: 0.05, filter: 2000 });
  }

  playClick() {
    if (!this.uiEnabled) return;
    this.playTone(600, 0.015, { type: "sine", volume: 0.1 });
    this.playNoise(0.015, { volume: 0.04, filter: 3000 });
  }

  playToggleOn() {
    if (!this.uiEnabled) return;
    this.playSweep(400, 800, 0.06, { type: "sine", volume: 0.08 });
  }

  playToggleOff() {
    if (!this.uiEnabled) return;
    this.playNoise(0.04, { volume: 0.04, filter: 200 });
  }

  playEKey() {
    if (!this.uiEnabled) return;
    this.playTone(440, 0.05, { type: "triangle", volume: 0.08 });
    this.playTone(660, 0.05, { type: "triangle", volume: 0.05, delay: 0.015 });
  }

  playBookGrab(pos) {
    if (!this.ambientEnabled) return;
    const vol = 0.07;
    this.playNoise(0.1, { volume: 0.04, filter: 500 });
    this.playTone(300, 0.08, { type: "sine", volume: vol });
  }

  playBookThrow() {
    if (!this.ambientEnabled) return;
    this.playSweep(200, 2000, 0.15, { type: "sine", volume: 0.05, filter: 1000 });
  }

  playBookShelve() {
    if (!this.ambientEnabled) return;
    this.playTone(800, 0.04, { type: "sine", volume: 0.12 });
    this.playTone(400, 0.03, { type: "sine", volume: 0.08, delay: 0.02 });
    this.playTone(80, 0.03, { type: "sine", volume: 0.06 });
  }

  playFurnitureGrab() {
    if (!this.ambientEnabled) return;
    this.playTone(150, 0.08, { type: "sawtooth", volume: 0.05, filter: 300 });
    this.playNoise(0.08, { volume: 0.04, filter: 200 });
  }

  playFurnitureRelease() {
    if (!this.ambientEnabled) return;
    this.playTone(60, 0.1, { type: "sine", volume: 0.1 });
    this.playNoise(0.1, { volume: 0.04, filter: 100 });
  }

  playSit() {
    if (!this.ambientEnabled) return;
    this.playSweep(250, 200, 0.06, { type: "triangle", volume: 0.07 });
    this.playNoise(0.04, { volume: 0.03, filter: 300 });
  }

  playStand() {
    if (!this.ambientEnabled) return;
    this.playSweep(200, 280, 0.08, { type: "triangle", volume: 0.06 });
  }

  playBallGrab() {
    if (!this.ambientEnabled) return;
    this.playTone(600, 0.03, { type: "sine", volume: 0.08 });
  }

  playBallThrow() {
    if (!this.ambientEnabled) return;
    this.playSweep(1200, 800, 0.2, { type: "sine", volume: 0.05, filter: 2000 });
  }

  playBallBounce() {
    if (!this.ambientEnabled) return;
    this.playTone(400, 0.1, { type: "sine", volume: 0.07 });
    const playBounce = (f, d, vol) => {
      this.playTone(f, d * 0.8, { type: "sine", volume: vol, delay: d });
    };
    playBounce(350, 0.1, 0.05);
    playBounce(300, 0.2, 0.04);
    playBounce(260, 0.35, 0.03);
  }

  playBookGrabPOV() {
    if (!this.ambientEnabled) return;
    this.playNoise(0.06, { volume: 0.03, filter: 600 });
    this.playTone(350, 0.06, { type: "sine", volume: 0.06 });
  }

  playReleasePOV() {
    if (!this.ambientEnabled) return;
    this.playSweep(300, 200, 0.1, { type: "sine", volume: 0.06, filter: 400 });
  }

  playHoloHover() {
    if (!this.uiEnabled) return;
    this.playTone(1200, 0.04, { type: "sine", volume: 0.04, filter: 3000 });
  }

  playHoloClick() {
    if (!this.uiEnabled) return;
    this.playTone(800, 0.06, { type: "sine", volume: 0.1 });
    this.playTone(1200, 0.06, { type: "sine", volume: 0.06, delay: 0.02 });
  }

  playHoloPage() {
    if (!this.uiEnabled) return;
    this.playNoise(0.04, { volume: 0.03, filter: 1000 });
    this.playTone(600, 0.06, { type: "sine", volume: 0.07, delay: 0.03 });
  }

  playHoloDot() {
    if (!this.uiEnabled) return;
    this.playTone(1000, 0.03, { type: "sine", volume: 0.05 });
  }

  playTabSwitch() {
    if (!this.uiEnabled) return;
    this.playSweep(500, 700, 0.05, { type: "triangle", volume: 0.06 });
  }

  playCardHover() {
    if (!this.uiEnabled) return;
    this.playTone(900, 0.02, { type: "sine", volume: 0.03, filter: 2000 });
  }

  playSpawnFromCatalog() {
    if (!this.uiEnabled) return;
    this.playSweep(400, 800, 0.06, { type: "sine", volume: 0.08 });
    this.playNoise(0.08, { volume: 0.04, filter: 1000, delay: 0.04 });
  }

  playRecover() {
    if (!this.uiEnabled) return;
    this.playSweep(800, 400, 0.12, { type: "sine", volume: 0.07 });
    this.playNoise(0.1, { volume: 0.03, filter: 800, delay: 0.05 });
  }

  playCloseCatalog() {
    if (!this.uiEnabled) return;
    this.playSweep(800, 200, 0.12, { type: "sine", volume: 0.06, filter: 600 });
    this.playNoise(0.12, { volume: 0.04, filter: 200 });
  }

  playFootstep(sprint) {
    if (!this.footstepEnabled) return;
    const dur = sprint ? 0.04 : 0.06;
    const vol = sprint ? 0.15 : 0.1;
    const filterVal = sprint ? 500 : 400;
    this.playNoise(dur, { volume: vol, filter: filterVal });
    this.playTone(sprint ? 100 : 80, dur, { type: "sine", volume: vol * 0.5 });
  }

  playJump() {
    if (!this.ambientEnabled) return;
    this.playSweep(200, 600, 0.08, { type: "sine", volume: 0.05, filter: 800 });
  }

  playLand() {
    if (!this.ambientEnabled) return;
    this.playTone(80, 0.06, { type: "sine", volume: 0.1 });
    this.playNoise(0.06, { volume: 0.05, filter: 100 });
  }

  playGameStart() {
    if (!this.ambientEnabled) return;
    this.playTone(400, 0.08, { type: "triangle", volume: 0.1 });
    this.playTone(500, 0.08, { type: "triangle", volume: 0.08, delay: 0.08 });
    this.playTone(600, 0.08, { type: "triangle", volume: 0.07, delay: 0.16 });
    this.playTone(800, 0.15, { type: "triangle", volume: 0.09, delay: 0.24 });
  }

  playCorrect() {
    if (!this.ambientEnabled) return;
    this.playReverbTone(880, 0.15, { type: "sine", volume: 0.15 });
    this.playTone(1320, 0.2, { type: "sine", volume: 0.1, delay: 0.04 });
  }

  playWrong() {
    if (!this.ambientEnabled) return;
    this.playTone(150, 0.12, { type: "sawtooth", volume: 0.08, filter: 300 });
  }

  playGameComplete() {
    if (!this.ambientEnabled) return;
    const notes = [293, 369, 440, 554];
    notes.forEach((f, i) => {
      this.playReverbTone(f, 0.3, { type: "sine", volume: 0.12, delay: i * 0.1 });
    });
  }

  playTimerTick() {
    if (!this.ambientEnabled) return;
    this.playTone(600, 0.02, { type: "sine", volume: 0.05 });
  }

  playEditorEnter() {
    if (!this.uiEnabled) return;
    this.playSweep(300, 900, 0.2, { type: "triangle", volume: 0.08, filter: 1000 });
    this.playTone(450, 0.1, { type: "triangle", volume: 0.06, delay: 0.1 });
    this.playTone(600, 0.1, { type: "triangle", volume: 0.05, delay: 0.15 });
  }

  playEditorExit() {
    if (!this.uiEnabled) return;
    this.playSweep(900, 300, 0.15, { type: "triangle", volume: 0.07 });
  }

  playEquip() {
    if (!this.uiEnabled) return;
    this.playTone(800, 0.06, { type: "sine", volume: 0.08 });
    this.playTone(120, 0.06, { type: "sine", volume: 0.06, delay: 0.015 });
  }

  playPlaceValid() {
    if (!this.uiEnabled) return;
    this.playTone(100, 0.06, { type: "sine", volume: 0.12 });
    this.playNoise(0.06, { volume: 0.05, filter: 150 });
  }

  playPlaceInvalid() {
    if (!this.uiEnabled) return;
    this.playTone(100, 0.1, { type: "sawtooth", volume: 0.06, filter: 200 });
  }

  playSelect() {
    if (!this.uiEnabled) return;
    this.playSweep(1000, 800, 0.05, { type: "sine", volume: 0.08 });
  }

  playDeselect() {
    if (!this.uiEnabled) return;
    this.playSweep(600, 400, 0.04, { type: "triangle", volume: 0.06 });
  }

  playUndo() {
    if (!this.uiEnabled) return;
    this.playTone(800, 0.03, { type: "sine", volume: 0.07 });
    this.playTone(600, 0.03, { type: "sine", volume: 0.06, delay: 0.03 });
    this.playTone(400, 0.03, { type: "sine", volume: 0.05, delay: 0.06 });
  }

  playRedo() {
    if (!this.uiEnabled) return;
    this.playTone(400, 0.03, { type: "sine", volume: 0.07 });
    this.playTone(600, 0.03, { type: "sine", volume: 0.06, delay: 0.03 });
    this.playTone(800, 0.03, { type: "sine", volume: 0.05, delay: 0.06 });
  }

  playSnap(on) {
    if (!this.uiEnabled) return;
    if (on) {
      this.playTone(1000, 0.03, { type: "sine", volume: 0.08 });
    } else {
      this.playTone(400, 0.02, { type: "triangle", volume: 0.05 });
    }
  }

  playDayNight() {
    if (!this.uiEnabled) return;
    this.playNoise(0.5, { volume: 0.03, filter: 400 });
    this.playSweep(300, 500, 0.4, { type: "triangle", volume: 0.04 });
  }

  playScreenshot() {
    if (!this.uiEnabled) return;
    this.playNoise(0.03, { volume: 0.06, filter: 3000 });
    this.playTone(1200, 0.02, { type: "sine", volume: 0.06 });
  }

  playAutoSave() {
    if (!this.uiEnabled) return;
    this.playTone(600, 0.03, { type: "sine", volume: 0.04 });
    this.playTone(600, 0.03, { type: "sine", volume: 0.04, delay: 0.03 });
  }

  checkHover(targetId) {
    if (targetId !== this.lastHoverId) {
      this.lastHoverId = targetId;
      if (targetId) this.playHover();
    }
  }

  resetHover() {
    this.lastHoverId = null;
  }

  setMasterVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  setUIEnabled(enabled) {
    this.uiEnabled = enabled;
  }

  setFootstepEnabled(enabled) {
    this.footstepEnabled = enabled;
  }

  setAmbientEnabled(enabled) {
    this.ambientEnabled = enabled;
  }

  setCameraGetter(fn) {
    this.cameraGetter = fn;
  }

  dispose() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.reverbMix = null;
    this.reverbNode = null;
  }
}
