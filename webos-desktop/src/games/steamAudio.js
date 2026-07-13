export class LargeModeAudio {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }

  playTone({
    frequency,
    duration = 0.05,
    volume = 0.08,
    waveform = "triangle",
    endFrequency = null,
    harmonic = false
  }) {
    if (!this.enabled) return;

    this.init();

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = waveform;

    osc.frequency.setValueAtTime(frequency * 0.96, now);

    osc.frequency.exponentialRampToValueAtTime(endFrequency ?? frequency, now + duration);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);

    if (harmonic) {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc2.type = "sine";
      osc2.frequency.value = frequency * 2;

      gain2.gain.setValueAtTime(0, now);
      gain2.gain.linearRampToValueAtTime(volume * 0.18, now + 0.004);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now);
      osc2.stop(now + duration);
    }
  }

  playNavigate() {
    this.playTone({
      frequency: 760,
      endFrequency: 900,
      duration: 0.045,
      volume: 0.055,
      harmonic: true
    });
  }

  playHover() {
    this.playTone({
      frequency: 980,
      endFrequency: 1030,
      duration: 0.025,
      volume: 0.025
    });
  }

  playSelect() {
    this.playTone({
      frequency: 820,
      endFrequency: 980,
      duration: 0.05,
      volume: 0.08,
      harmonic: true
    });

    setTimeout(() => {
      this.playTone({
        frequency: 1240,
        endFrequency: 1420,
        duration: 0.045,
        volume: 0.055,
        harmonic: true
      });
    }, 35);
  }

  playBack() {
    this.playTone({
      frequency: 820,
      endFrequency: 640,
      duration: 0.055,
      volume: 0.07
    });

    setTimeout(() => {
      this.playTone({
        frequency: 560,
        endFrequency: 420,
        duration: 0.045,
        volume: 0.045
      });
    }, 30);
  }

  playError() {
    this.playTone({
      frequency: 420,
      endFrequency: 340,
      duration: 0.08,
      volume: 0.07,
      waveform: "square"
    });
  }
}

export const steamAudio = new LargeModeAudio();
