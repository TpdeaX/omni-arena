class SynthAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.65;
  private muted = false;

  public ensure(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public get currentTime(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  public setConfig(volume: number, muted: boolean): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    gainPeak: number,
    when?: number
  ): void {
    const ctx = this.ensure();
    if (!this.master) return;
    const t = when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainPeak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  public playNoiseBurst(duration: number, gainPeak: number, highpassHz = 1200, when?: number): void {
    const ctx = this.ensure();
    if (!this.master) return;
    const t = when ?? ctx.currentTime;
    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(highpassHz, t);

    const g = ctx.createGain();
    g.gain.setValueAtTime(gainPeak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.01);
  }

  public uiClick(): void {
    this.playTone(540, 820, 0.045, 'triangle', 0.14);
  }

  public shoot(): void {
    this.playTone(460, 120, 0.075, 'sawtooth', 0.14);
  }

  public hitmarker(combo = 1): void {
    const boost = Math.min(1.6, 1 + combo * 0.02);
    this.playTone(760 * boost, 1180 * boost, 0.06, 'sine', 0.22);
  }

  public bullseye(combo = 1): void {
    const boost = Math.min(1.5, 1 + combo * 0.025);
    this.playTone(920 * boost, 1480 * boost, 0.09, 'triangle', 0.26);
  }

  public puzzleSuccess(streak = 1): void {
    const base = 440 * Math.pow(1.05946, Math.min(12, streak));
    const ctx = this.ensure();
    const t = ctx.currentTime;
    this.playTone(base, base, 0.08, 'triangle', 0.2, t);
    this.playTone(base * 1.25, base * 1.25, 0.11, 'triangle', 0.22, t + 0.055);
  }

  public jump(): void {
    this.playTone(220, 560, 0.11, 'sine', 0.18);
  }

  public dash(): void {
    this.playNoiseBurst(0.09, 0.16, 1600);
    this.playTone(340, 170, 0.09, 'triangle', 0.14);
  }

  public pickup(): void {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    this.playTone(660, 880, 0.06, 'sine', 0.18, t);
    this.playTone(990, 1320, 0.09, 'sine', 0.16, t + 0.05);
  }

  public graze(): void {
    this.playTone(1350, 1750, 0.04, 'sine', 0.09);
  }

  public damage(): void {
    this.playTone(145, 58, 0.22, 'sawtooth', 0.28);
    this.playNoiseBurst(0.16, 0.2, 400);
  }

  public shiftTransition(): void {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    this.playTone(220, 660, 0.24, 'sawtooth', 0.16, t);
    this.playTone(440, 880, 0.2, 'triangle', 0.18, t + 0.12);
  }

  // --- Rhythm Track Scheduler Helpers ---
  public scheduleKick(when: number): void {
    this.playTone(145, 42, 0.13, 'sine', 0.34, when);
  }

  public scheduleSnare(when: number): void {
    this.playNoiseBurst(0.1, 0.18, 1100, when);
    this.playTone(210, 115, 0.08, 'triangle', 0.15, when);
  }

  public scheduleHat(when: number): void {
    this.playNoiseBurst(0.035, 0.08, 6000, when);
  }

  public scheduleBass(freq: number, when: number, dur = 0.18): void {
    this.playTone(freq, freq * 0.98, dur, 'sawtooth', 0.11, when);
  }

  public scheduleNoteCue(lane: number, when?: number): void {
    const scale = [523.25, 659.25, 783.99, 1046.5];
    const f = scale[lane % 4];
    this.playTone(f, f * 1.02, 0.085, 'triangle', 0.2, when);
  }
}

export const synthAudio = new SynthAudioEngine();
