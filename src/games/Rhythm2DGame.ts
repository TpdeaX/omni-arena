import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

interface RhythmNote {
  id: number;
  lane: number; // 0..3
  targetTime: number; // seconds relative to trackStart
  hit: boolean;
  missed: boolean;
}

interface JudgeFx {
  text: string;
  color: string;
  sub: string;
  x: number;
  y: number;
  life: number;
}

const LANE_COLORS = ['#00E5FF', '#7B61FF', '#FFB800', '#FF4D38'];
const LANE_KEYS = ['D', 'F', 'J', 'K'];
const BASS_SEQ = [65.41, 65.41, 77.78, 87.31, 65.41, 65.41, 98.0, 87.31];

export class Rhythm2DGame implements MiniGame {
  public readonly id = 'rhythm2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private g!: CanvasRenderingContext2D;

  private width = 800;
  private height = 520;
  private dpr = 1;

  private notes: RhythmNote[] = [];
  private laneFlash = [0, 0, 0, 0];
  private laneHeld = [false, false, false, false];
  private judgeFx: JudgeFx[] = [];

  private bpm = 128;
  private beatDur = 60 / 128;
  private startIntensity = 1.0;
  private readonly travelTime = 1.35; // seconds from top to hit line
  private readonly standaloneDuration = 50;

  private elapsedReal = 0;
  private trackTime = 0;
  private nextBeatIndex = 0;
  private lastAudioBeat = -1;
  private nextNoteId = 1;

  private hits = 0;
  private perfects = 0;
  private misses = 0;
  private offsetAbsSum = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;

  private isGauntletSlice = false;
  private paused = false;
  private destroyed = false;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'oa-stage oa-stage-2d';
    this.ctx.container.appendChild(this.wrapper);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'oa-canvas-2d';
    this.wrapper.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d')!;

    this.onResize();
    synthAudio.ensure();

    const startIntensity = ctx.getIntensity();
    this.startIntensity = startIntensity;
    this.bpm = Math.round(112 + (startIntensity - 0.78) * 62);
    this.bpm = Math.max(106, Math.min(156, this.bpm));
    this.beatDur = 60 / this.bpm;

    // Pre-schedule first notes ahead
    this.nextBeatIndex = 2;
    this.scheduleNotesAhead();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointerup', this.onPointerUp);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'RITMO SOBRECARGA',
      accent: '#0891B2',
      timeLeftSec: this.isGauntletSlice || this.ctx.infiniteMode ? null : this.standaloneDuration,
      subStat: `${this.bpm} BPM · PREC 100%`,
    });
  }

  private laneGeometry() {
    const laneCount = 4;
    const totalW = Math.min(this.width * 0.88, 440);
    const laneW = totalW / laneCount;
    const startX = (this.width - totalW) / 2;
    const hitY = this.height - Math.max(76, this.height * 0.16);
    return { totalW, laneW, startX, hitY };
  }

  private getTempoScale(): number {
    if (!this.ctx.infiniteMode && this.ctx.difficulty !== 'progressive') {
      return 1;
    }
    const intensity = this.ctx.getIntensity();
    const intensityBoost = Math.max(0, intensity - this.startIntensity) * 0.28;
    const timeBoost = this.ctx.infiniteMode ? Math.min(0.24, this.elapsedReal * 0.0018) : 0;
    return Math.min(1.48, 1 + intensityBoost + timeBoost);
  }

  private scheduleNotesAhead(): void {
    const horizon = this.trackTime + this.travelTime + 1.2;
    while (this.nextBeatIndex * (this.beatDur / 2) <= horizon) {
      const eighthIdx = this.nextBeatIndex;
      const t = eighthIdx * (this.beatDur / 2);
      const isQuarter = eighthIdx % 2 === 0;
      const barPos = eighthIdx % 16;

      // Musical pattern: steady quarters + energetic 8th fills (denser at higher live intensity)
      const density = this.ctx.getIntensity();
      const doEighth =
        barPos === 3 ||
        barPos === 7 ||
        barPos === 11 ||
        barPos === 14 ||
        barPos === 15 ||
        (density >= 1.25 && (barPos === 5 || barPos === 13)) ||
        (density >= 1.55 && (barPos === 1 || barPos === 9));
      if (isQuarter || doEighth) {
        const prev = this.notes[this.notes.length - 1];
        let lane = (eighthIdx * 3 + Math.floor(eighthIdx / 4)) % 4;
        if (prev && prev.lane === lane && Math.abs(prev.targetTime - t) < 0.35) {
          lane = (lane + 1) % 4;
        }
        this.notes.push({
          id: this.nextNoteId++,
          lane,
          targetTime: t,
          hit: false,
          missed: false,
        });

        // Occasional chord on downbeat after beat 16
        const chordChance =
          this.ctx.infiniteMode || this.ctx.difficulty === 'progressive'
            ? Math.min(0.75, 0.55 + Math.max(0, density - 1.2) * 0.25)
            : 0.55;
        if (eighthIdx > 16 && barPos === 0 && Math.random() < chordChance) {
          this.notes.push({
            id: this.nextNoteId++,
            lane: (lane + 2) % 4,
            targetTime: t,
            hit: false,
            missed: false,
          });
        }
      }
      this.nextBeatIndex += 1;
    }
  }

  private triggerLane(lane: number): void {
    if (this.paused || this.destroyed) return;
    synthAudio.ensure();
    this.laneFlash[lane] = 1;
    this.laneHeld[lane] = true;

    // Find closest unhit note in this lane within 175ms real-time window
    const tempoScale = this.getTempoScale();
    let best: RhythmNote | null = null;
    let bestAbs = 999;
    for (const n of this.notes) {
      if (n.hit || n.missed || n.lane !== lane) continue;
      const diff = Math.abs(this.trackTime - n.targetTime) / tempoScale;
      if (diff <= 0.175 && diff < bestAbs) {
        best = n;
        bestAbs = diff;
      }
    }

    const { startX, laneW, hitY } = this.laneGeometry();
    const fxX = startX + lane * laneW + laneW / 2;

    if (!best) {
      return;
    }

    best.hit = true;
    const signedMs = Math.round(((this.trackTime - best.targetTime) / tempoScale) * 1000);
    const absMs = Math.abs(signedMs);
    this.offsetAbsSum += absMs;
    this.hits += 1;

    let label = 'BIEN';
    let color = '#FFB800';
    let pts = 90;
    if (absMs <= 48) {
      label = 'PERFECTO';
      color = '#00E5FF';
      pts = 200;
      this.perfects += 1;
    } else if (absMs <= 98) {
      label = 'GENIAL';
      color = '#A6FF00';
      pts = 140;
    }

    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += pts;
    this.ctx.addScore(pts, 1);
    synthAudio.scheduleNoteCue(lane);

    const timingNote = absMs <= 18 ? 'EXACTO' : signedMs < 0 ? `${signedMs}ms` : `+${signedMs}ms`;
    this.judgeFx.push({
      text: label,
      color,
      sub: timingNote,
      x: fxX,
      y: hitY - 34,
      life: 0.48,
    });
    this.updateSubStat();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    const map: Record<string, number> = {
      KeyD: 0,
      ArrowLeft: 0,
      KeyF: 1,
      ArrowDown: 1,
      KeyJ: 2,
      ArrowUp: 2,
      KeyK: 3,
      ArrowRight: 3,
    };
    const lane = map[e.code];
    if (lane !== undefined) {
      e.preventDefault();
      this.triggerLane(lane);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const map: Record<string, number> = {
      KeyD: 0,
      ArrowLeft: 0,
      KeyF: 1,
      ArrowDown: 1,
      KeyJ: 2,
      ArrowUp: 2,
      KeyK: 3,
      ArrowRight: 3,
    };
    const lane = map[e.code];
    if (lane !== undefined) {
      this.laneHeld[lane] = false;
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const { startX, laneW, totalW } = this.laneGeometry();
    if (x >= startX - 24 && x <= startX + totalW + 24) {
      const clamped = Math.max(0, Math.min(3, Math.floor((x - startX) / laneW)));
      this.triggerLane(clamped);
    }
  };

  private onPointerUp = (): void => {
    this.laneHeld.fill(false);
  };

  private updateSubStat(): void {
    const total = this.hits + this.misses;
    const acc = total > 0 ? Math.round((this.hits / total) * 100) : 100;
    const avgMs = this.hits > 0 ? Math.round(this.offsetAbsSum / this.hits) : 0;
    const liveBpm = Math.round(this.bpm * this.getTempoScale());
    this.ctx.setHud({
      subStat: `${liveBpm} BPM · PREC ${acc}% · ±${avgMs}ms`,
    });
  }

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsedReal += dt;
    const tempoScale = this.getTempoScale();
    this.trackTime += dt * tempoScale;

    if (!this.isGauntletSlice && !this.ctx.infiniteMode) {
      const rem = Math.max(0, this.standaloneDuration - this.elapsedReal);
      this.ctx.setHud({ timeLeftSec: rem });
      if (rem <= 0) {
        this.ctx.finish(this.getMetrics());
        return;
      }
    }

    // Trigger backing beat audio on each eighth-note boundary
    const currEighth = Math.floor(this.trackTime / (this.beatDur / 2));
    if (currEighth > this.lastAudioBeat) {
      this.lastAudioBeat = currEighth;
      const now = synthAudio.currentTime + 0.01;
      const step = currEighth % 8;
      if (step % 2 === 0) {
        synthAudio.scheduleKick(now);
        synthAudio.scheduleBass(BASS_SEQ[currEighth % BASS_SEQ.length], now, 0.16);
      } else {
        synthAudio.scheduleHat(now);
      }
      if (step === 2 || step === 6) {
        synthAudio.scheduleSnare(now);
      }
    }

    this.scheduleNotesAhead();

    // Check missed notes
    const { startX, laneW, hitY } = this.laneGeometry();
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      if (!n.hit && !n.missed && (this.trackTime - n.targetTime) / tempoScale > 0.18) {
        n.missed = true;
        this.misses += 1;
        this.combo = 0;
        this.ctx.breakCombo();
        synthAudio.damage();
        this.judgeFx.push({
          text: 'FALLO',
          color: '#FF4D38',
          sub: 'TARDE',
          x: startX + n.lane * laneW + laneW / 2,
          y: hitY - 28,
          life: 0.42,
        });
        const left = this.ctx.damage(1);
        this.updateSubStat();
        if (left <= 0) {
          this.ctx.finish({ ...this.getMetrics(), survived: false });
          return;
        }
      }
      if (this.trackTime - n.targetTime > 0.8 || n.hit) {
        if (n.hit || this.trackTime - n.targetTime > 0.8) {
          this.notes.splice(i, 1);
        }
      }
    }

    for (let l = 0; l < 4; l++) {
      this.laneFlash[l] = Math.max(0, this.laneFlash[l] - dt * 5.2);
    }

    for (let i = this.judgeFx.length - 1; i >= 0; i--) {
      const fx = this.judgeFx[i];
      fx.life -= dt;
      fx.y -= dt * 36;
      if (fx.life <= 0) this.judgeFx.splice(i, 1);
    }

    this.draw();
  }

  private draw(): void {
    const g = this.g;
    g.clearRect(0, 0, this.width, this.height);

    // Background highway
    g.fillStyle = '#090D14';
    g.fillRect(0, 0, this.width, this.height);

    const { totalW, laneW, startX, hitY } = this.laneGeometry();

    // Subtle beat pulse line across highway
    const beatPhase = (this.trackTime % this.beatDur) / this.beatDur;
    const pulseAlpha = Math.max(0, 1 - beatPhase * 2) * 0.14;

    // Draw 4 lanes
    for (let l = 0; l < 4; l++) {
      const x = startX + l * laneW;
      g.fillStyle = l % 2 === 0 ? '#111722' : '#0E131D';
      g.fillRect(x, 0, laneW, this.height);

      if (this.laneFlash[l] > 0 || this.laneHeld[l]) {
        const alpha = Math.max(this.laneFlash[l] * 0.25, this.laneHeld[l] ? 0.16 : 0);
        g.fillStyle = LANE_COLORS[l];
        g.globalAlpha = alpha;
        g.fillRect(x, 0, laneW, this.height);
        g.globalAlpha = 1;
      }

      // Lane divider
      g.strokeStyle = '#1E2738';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, this.height);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(startX + totalW, 0);
    g.lineTo(startX + totalW, this.height);
    g.stroke();

    // Beat bar guides
    const firstBeat = Math.floor(this.trackTime / this.beatDur);
    for (let b = firstBeat; b < firstBeat + 5; b++) {
      const t = b * this.beatDur;
      const progress = 1 - (t - this.trackTime) / this.travelTime;
      const y = progress * hitY;
      if (y >= 0 && y <= hitY) {
        g.strokeStyle = `rgba(255,255,255,${0.08 + pulseAlpha * 0.5})`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(startX, y);
        g.lineTo(startX + totalW, y);
        g.stroke();
      }
    }

    // Hit line & receptors
    g.fillStyle = `rgba(0, 229, 255, ${0.12 + pulseAlpha})`;
    g.fillRect(startX, hitY - 4, totalW, 8);

    for (let l = 0; l < 4; l++) {
      const cx = startX + l * laneW;
      const pad = 8;
      g.strokeStyle = LANE_COLORS[l];
      g.lineWidth = this.laneHeld[l] ? 3 : 2;
      g.strokeRect(cx + pad, hitY - 16, laneW - pad * 2, 32);

      g.fillStyle = '#DCE5F2';
      g.font = '700 14px "Chakra Petch", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(this.ctx.isTouch ? 'TOCA' : LANE_KEYS[l], cx + laneW / 2, hitY + 34);
    }

    // Notes
    for (const n of this.notes) {
      if (n.hit || n.missed) continue;
      const progress = 1 - (n.targetTime - this.trackTime) / this.travelTime;
      if (progress < -0.1 || progress > 1.2) continue;
      const y = progress * hitY;
      const x = startX + n.lane * laneW + 10;
      const w = laneW - 20;

      g.fillStyle = LANE_COLORS[n.lane];
      g.beginPath();
      g.roundRect(x, y - 11, w, 22, 6);
      g.fill();

      g.fillStyle = '#090D14';
      g.fillRect(x + 8, y - 2, w - 16, 4);
    }

    // Judgment popups
    for (const fx of this.judgeFx) {
      g.globalAlpha = Math.max(0, fx.life / 0.48);
      g.fillStyle = fx.color;
      g.font = '700 18px "Chakra Petch", sans-serif';
      g.textAlign = 'center';
      g.fillText(fx.text, fx.x, fx.y);
      g.fillStyle = '#C9D6E8';
      g.font = '600 11px "JetBrains Mono", monospace';
      g.fillText(fx.sub, fx.x, fx.y + 16);
      g.globalAlpha = 1;
    }
  }

  public onResize(): void {
    const w = this.wrapper.clientWidth || 800;
    const h = this.wrapper.clientHeight || 520;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = w;
    this.height = h;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getMetrics(): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const total = this.hits + this.misses;
    const acc = total > 0 ? (this.hits / total) * 100 : 0;
    const avgOffset = this.hits > 0 ? this.offsetAbsSum / this.hits : 85;
    const perfectRatio = this.hits > 0 ? this.perfects / this.hits : 0;

    const timingScore = Math.max(0, (130 - avgOffset) * 4.2);
    const accScore = acc * 4.2 + perfectRatio * 180;
    const rhythmPerf =
      total === 0 ? 150 : Math.max(150, Math.min(1000, Math.round(timingScore + accScore)));

    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy: acc,
      avgReactionMs: avgOffset,
      hits: this.hits,
      misses: this.misses,
      survived: true,
      axisPerformances: {
        rhythm: rhythmPerf,
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.wrapper.remove();
  }
}
