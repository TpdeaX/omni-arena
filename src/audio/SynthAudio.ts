import { DrumPieceId, InstrumentTimbre } from '../types';

export type { DrumPieceId, InstrumentTimbre };

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface ActiveVoice {
  stop: () => void;
  startedAt: number;
}

const MAX_ACTIVE_VOICES = 14;

class SynthAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.65;
  private muted = false;
  private activeVoices = new Map<string, ActiveVoice>();
  private oneShotCounter = 0;

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

  private evictOldestVoiceIfFull(): void {
    while (this.activeVoices.size >= MAX_ACTIVE_VOICES) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, voice] of this.activeVoices.entries()) {
        if (voice.startedAt < oldestTime) {
          oldestTime = voice.startedAt;
          oldestKey = key;
        }
      }
      if (!oldestKey) break;
      const v = this.activeVoices.get(oldestKey);
      this.activeVoices.delete(oldestKey);
      v?.stop();
    }
  }

  private createTimbreVoice(
    key: string,
    midi: number,
    timbre: InstrumentTimbre,
    startTime: number,
    durationSec?: number
  ): void {
    const ctx = this.ensure();
    if (!this.master) return;
    const existing = this.activeVoices.get(key);
    if (existing) {
      this.activeVoices.delete(key);
      existing.stop();
    }
    this.evictOldestVoiceIfFull();

    const freq = midiToFreq(midi);
    const outGain = ctx.createGain();
    let voiceDest: AudioNode = outGain;
    outGain.connect(this.master);

    const oscs: OscillatorNode[] = [];
    const addOsc = (type: OscillatorType, mult: number, amp: number, dest: AudioNode = voiceDest) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq * mult, startTime);
      g.gain.setValueAtTime(amp, startTime);
      o.connect(g);
      g.connect(dest);
      o.start(startTime);
      oscs.push(o);
      return o;
    };

    let releaseSec = 0.16;
    if (timbre === 'piano') {
      addOsc('triangle', 1, 0.72);
      addOsc('sine', 2, 0.22);
      addOsc('sine', 3, 0.08);
      outGain.gain.setValueAtTime(0.0001, startTime);
      outGain.gain.linearRampToValueAtTime(0.24, startTime + 0.008);
      if (durationSec !== undefined) {
        outGain.gain.exponentialRampToValueAtTime(0.001, startTime + Math.max(0.08, durationSec));
      } else {
        outGain.gain.exponentialRampToValueAtTime(0.09, startTime + 0.45);
      }
      releaseSec = 0.14;
    } else if (timbre === 'organ') {
      addOsc('sine', 1, 0.6);
      addOsc('triangle', 2, 0.3);
      addOsc('sine', 4, 0.12);
      outGain.gain.setValueAtTime(0.0001, startTime);
      outGain.gain.linearRampToValueAtTime(0.18, startTime + 0.015);
      if (durationSec !== undefined) {
        outGain.gain.setValueAtTime(0.18, startTime + Math.max(0.03, durationSec - 0.04));
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);
      }
      releaseSec = 0.08;
    } else if (timbre === 'soft') {
      addOsc('sine', 1, 0.85);
      addOsc('triangle', 0.5, 0.15);
      outGain.gain.setValueAtTime(0.0001, startTime);
      outGain.gain.linearRampToValueAtTime(0.22, startTime + 0.045);
      if (durationSec !== undefined) {
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.max(0.1, durationSec));
      } else {
        outGain.gain.setTargetAtTime(0.15, startTime + 0.06, 0.2);
      }
      releaseSec = 0.22;
    } else if (timbre === 'guitar' || timbre === 'ukulele') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      const peakCutoff = timbre === 'ukulele' ? Math.min(5200, freq * 6.5) : Math.min(4400, freq * 5.5);
      const sustainCutoff = timbre === 'ukulele' ? Math.max(700, freq * 2.4) : Math.max(520, freq * 2.0);
      filter.frequency.setValueAtTime(peakCutoff, startTime);
      filter.frequency.exponentialRampToValueAtTime(sustainCutoff, startTime + 0.18);
      filter.Q.setValueAtTime(1.4, startTime);
      filter.connect(outGain);
      voiceDest = filter;

      addOsc('sawtooth', 1, 0.52);
      addOsc('triangle', 1, 0.38);
      addOsc('sine', 2, timbre === 'ukulele' ? 0.24 : 0.16);

      outGain.gain.setValueAtTime(0.0001, startTime);
      outGain.gain.linearRampToValueAtTime(0.25, startTime + 0.005);
      const decay = durationSec !== undefined ? Math.max(0.12, durationSec) : timbre === 'ukulele' ? 0.65 : 0.95;
      outGain.gain.exponentialRampToValueAtTime(0.0008, startTime + decay);
      releaseSec = 0.12;
    } else if (timbre === 'bass') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(580, startTime);
      filter.frequency.exponentialRampToValueAtTime(360, startTime + 0.14);
      filter.Q.setValueAtTime(1.2, startTime);
      filter.connect(outGain);
      voiceDest = filter;

      addOsc('triangle', 1, 0.75);
      addOsc('sine', 0.5, 0.35);
      addOsc('sawtooth', 1, 0.22);

      outGain.gain.setValueAtTime(0.0001, startTime);
      outGain.gain.linearRampToValueAtTime(0.3, startTime + 0.008);
      const decay = durationSec !== undefined ? Math.max(0.12, durationSec) : 0.75;
      outGain.gain.exponentialRampToValueAtTime(0.001, startTime + decay);
      releaseSec = 0.1;
    } else if (timbre === 'marimba') {
      addOsc('sine', 1, 0.82);
      addOsc('sine', 4, 0.24);
      addOsc('triangle', 2, 0.08);
      outGain.gain.setValueAtTime(0.0001, startTime);
      outGain.gain.linearRampToValueAtTime(0.28, startTime + 0.003);
      const decay = durationSec !== undefined ? Math.min(0.45, Math.max(0.12, durationSec)) : 0.28;
      outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
      releaseSec = 0.09;
    } else if (timbre === 'flute') {
      const mainOsc = addOsc('sine', 1, 0.72);
      addOsc('triangle', 2, 0.12);
      // Subtle 5 Hz vibrato LFO
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(5.0, startTime);
      lfoGain.gain.setValueAtTime(freq * 0.008, startTime);
      lfo.connect(lfoGain);
      lfoGain.connect(mainOsc.frequency);
      lfo.start(startTime);
      oscs.push(lfo);

      outGain.gain.setValueAtTime(0.0001, startTime);
      outGain.gain.linearRampToValueAtTime(0.21, startTime + 0.048);
      if (durationSec !== undefined) {
        outGain.gain.setValueAtTime(0.21, startTime + Math.max(0.06, durationSec - 0.05));
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.max(0.12, durationSec));
      } else {
        outGain.gain.setTargetAtTime(0.18, startTime + 0.06, 0.18);
      }
      releaseSec = 0.14;
    } else {
      // bell
      addOsc('sine', 1, 0.7);
      addOsc('sine', 2.0, 0.25);
      addOsc('sine', 3.01, 0.14);
      outGain.gain.setValueAtTime(0.0001, startTime);
      outGain.gain.linearRampToValueAtTime(0.22, startTime + 0.004);
      const decay = durationSec !== undefined ? Math.max(0.15, durationSec) : 1.1;
      outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
      releaseSec = 0.18;
    }

    let stopped = false;
    const stopImmediate = () => {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      try {
        outGain.gain.cancelScheduledValues(now);
        outGain.gain.setValueAtTime(Math.max(0.0001, outGain.gain.value), now);
        outGain.gain.exponentialRampToValueAtTime(0.0001, now + releaseSec);
        for (const o of oscs) {
          o.stop(now + releaseSec + 0.02);
        }
      } catch {
        // oscillator already stopped
      }
      this.activeVoices.delete(key);
    };

    this.activeVoices.set(key, {
      stop: stopImmediate,
      startedAt: startTime,
    });

    if (durationSec !== undefined) {
      const endAt = startTime + durationSec + 0.04;
      for (const o of oscs) {
        o.stop(endAt);
      }
      const delayMs = Math.max(20, (endAt - ctx.currentTime) * 1000 + 30);
      window.setTimeout(() => {
        if (!stopped && this.activeVoices.get(key)?.startedAt === startTime) {
          this.activeVoices.delete(key);
        }
      }, delayMs);
    }
  }

  public playMidiNote(
    midi: number,
    durationSec = 0.65,
    timbre: InstrumentTimbre = 'piano',
    whenOffset = 0
  ): void {
    const ctx = this.ensure();
    const t = ctx.currentTime + Math.max(0, whenOffset);
    const key = `oneshot_${++this.oneShotCounter}`;
    this.createTimbreVoice(key, midi, timbre, t, durationSec);
  }

  public playChord(
    midis: number[],
    durationSec = 0.85,
    timbre: InstrumentTimbre = 'piano',
    arpeggioStepSec = 0
  ): void {
    midis.forEach((m, idx) => {
      this.playMidiNote(m, durationSec, timbre, idx * arpeggioStepSec);
    });
  }

  public noteOn(id: string | number, midi: number, timbre: InstrumentTimbre = 'piano'): void {
    const ctx = this.ensure();
    const key = `held_${String(id)}`;
    this.createTimbreVoice(key, midi, timbre, ctx.currentTime);
  }

  public noteOff(id: string | number): void {
    const key = `held_${String(id)}`;
    const voice = this.activeVoices.get(key);
    if (voice) {
      voice.stop();
    }
  }

  public stopAllNotes(): void {
    const entries = Array.from(this.activeVoices.values());
    this.activeVoices.clear();
    for (const v of entries) {
      v.stop();
    }
  }

  public playNoiseBurst(duration: number, gainPeak: number, highpassHz = 1200, when?: number): void {
    const ctx = this.ensure();
    if (!this.master) return;
    const t = when ?? ctx.currentTime;
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
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
    g.gain.setValueAtTime(Math.max(0.0001, gainPeak), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.01);
  }

  public playDrum(piece: DrumPieceId, velocity = 0.9, whenOffset = 0): void {
    const ctx = this.ensure();
    if (!this.master) return;
    const v = Math.max(0.1, Math.min(1.2, velocity));
    const t = ctx.currentTime + Math.max(0, whenOffset);

    switch (piece) {
      case 'kick': {
        this.playTone(132, 42, 0.16, 'sine', 0.38 * v, t);
        this.playTone(85, 36, 0.12, 'triangle', 0.18 * v, t);
        break;
      }
      case 'snare': {
        this.playNoiseBurst(0.13, 0.22 * v, 1300, t);
        this.playTone(215, 118, 0.085, 'triangle', 0.18 * v, t);
        break;
      }
      case 'hihat_closed': {
        this.playNoiseBurst(0.045, 0.12 * v, 7000, t);
        break;
      }
      case 'hihat_open': {
        this.playNoiseBurst(0.26, 0.14 * v, 6000, t);
        break;
      }
      case 'tom_high': {
        this.playTone(195, 110, 0.18, 'sine', 0.3 * v, t);
        this.playTone(290, 145, 0.07, 'triangle', 0.1 * v, t);
        break;
      }
      case 'tom_low': {
        this.playTone(128, 68, 0.22, 'sine', 0.32 * v, t);
        this.playTone(180, 92, 0.09, 'triangle', 0.11 * v, t);
        break;
      }
      case 'crash': {
        this.playNoiseBurst(0.75, 0.18 * v, 3800, t);
        this.playTone(940, 620, 0.35, 'triangle', 0.07 * v, t);
        break;
      }
      case 'ride': {
        this.playNoiseBurst(0.42, 0.11 * v, 5200, t);
        this.playTone(1180, 1175, 0.28, 'sine', 0.11 * v, t);
        this.playTone(1790, 1780, 0.18, 'sine', 0.06 * v, t);
        break;
      }
    }
  }

  public playMetronomeClick(accent: boolean, whenOffset = 0): void {
    const ctx = this.ensure();
    const t = ctx.currentTime + Math.max(0, whenOffset);
    const freq = accent ? 1320 : 880;
    const gain = accent ? 0.22 : 0.14;
    this.playTone(freq, freq * 0.96, 0.032, 'triangle', gain, t);
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
