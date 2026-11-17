import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

export class SonicRing2DGame implements MiniGame {
  public readonly id = 'pulse2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;

  private needleAngle = 0;
  private spinDir = 1;
  private spinSpeed = 2.65; // rad/sec

  private targetAngle = Math.PI * 0.75;
  private targetWidth = 0.56; // radians
  private targetKind: 'normal' | 'gold' = 'normal';
  private arcPassedOnce = false;

  private beatTimer = 0;
  private beatStep = 0;
  private pulseFlash = 0;
  private flashColor = '#06B6D4';

  private hits = 0;
  private misses = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private elapsed = 0;
  private readonly standaloneDuration = 48;
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
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'oa-canvas-2d';
    this.wrapper.appendChild(this.canvas);
    this.ctx.container.appendChild(this.wrapper);
    this.c2d = this.canvas.getContext('2d')!;

    this.onResize();
    this.spawnNextArc(true);

    this.canvas.addEventListener('pointerdown', this.onTrigger);
    window.addEventListener('keydown', this.onKeyDown);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'ANILLO SÓNICO',
      accent: '#14B8A6',
      timeLeftSec: this.isGauntletSlice ? null : this.standaloneDuration,
      subStat: 'GOLPEA EL ARCO · ESPACIO / CLIC',
    });
  }

  private normalizeAngle(a: number): number {
    const twoPi = Math.PI * 2;
    return ((a % twoPi) + twoPi) % twoPi;
  }

  private angularDiff(a: number, b: number): number {
    const d = Math.abs(this.normalizeAngle(a) - this.normalizeAngle(b));
    return Math.min(d, Math.PI * 2 - d);
  }

  private spawnNextArc(first = false): void {
    const intensity = this.ctx.getIntensity();
    const offset = first ? Math.PI * 0.85 : (Math.PI * 0.58 + Math.random() * Math.PI * 0.9) * this.spinDir;
    this.targetAngle = this.normalizeAngle(this.needleAngle + offset);
    this.targetKind = Math.random() < 0.24 ? 'gold' : 'normal';
    const baseWidth = this.targetKind === 'gold' ? 0.38 : 0.56;
    this.targetWidth = Math.max(0.26, baseWidth - Math.min(0.14, this.combo * 0.008) / Math.max(0.8, intensity));
    this.arcPassedOnce = false;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed) return;
    if (e.code === 'Space' || e.key === 'j' || e.key === 'J' || e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      this.handleStrike();
    }
  };

  private onTrigger = (): void => {
    if (this.paused || this.destroyed) return;
    this.handleStrike();
  };

  private handleStrike(): void {
    const diff = this.angularDiff(this.needleAngle, this.targetAngle);
    const half = this.targetWidth * 0.5 + 0.06;

    if (diff <= half) {
      const isPerfect = diff <= half * 0.42;
      this.hits += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      const basePts = this.targetKind === 'gold' ? 230 : 140;
      const pts = isPerfect ? basePts + 60 : basePts;
      this.score += pts;
      this.ctx.addScore(pts, 1);

      this.pulseFlash = 0.22;
      this.flashColor = isPerfect ? '#10B981' : '#38BDF8';
      if (isPerfect) synthAudio.bullseye(this.combo);
      else synthAudio.hitmarker(this.combo);

      if (this.combo % 4 === 0) {
        this.spinDir *= -1;
      }
      this.spawnNextArc();
    } else {
      this.registerMiss('FUERA DE ARCO');
    }
  }

  private registerMiss(reason: string): void {
    this.misses += 1;
    this.combo = 0;
    this.ctx.breakCombo();
    this.pulseFlash = 0.22;
    this.flashColor = '#EF4444';
    synthAudio.damage();
    this.ctx.toast(reason, 'bad');
    if (this.misses % 2 === 0) {
      const left = this.ctx.damage(1);
      if (left <= 0) {
        this.ctx.finish(this.getMetrics(false));
        return;
      }
    }
    this.spawnNextArc();
  }

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;

    if (!this.isGauntletSlice) {
      const left = Math.max(0, this.standaloneDuration - this.elapsed);
      this.ctx.setHud({ timeLeftSec: left });
      if (left <= 0) {
        this.ctx.finish(this.getMetrics(true));
        return;
      }
    }

    const intensity = this.ctx.getIntensity();
    this.spinSpeed = (2.45 + Math.min(1.6, this.combo * 0.06)) * (0.85 + intensity * 0.22);

    this.needleAngle = this.normalizeAngle(this.needleAngle + this.spinSpeed * this.spinDir * dt);

    // Detect if needle enters then passes far past the arc without striking
    const diff = this.angularDiff(this.needleAngle, this.targetAngle);
    if (diff <= this.targetWidth * 0.5) {
      this.arcPassedOnce = true;
    } else if (this.arcPassedOnce && diff > this.targetWidth * 0.5 + 0.16) {
      this.registerMiss('TIEMPO AGOTADO');
      if (this.destroyed) return;
    }

    // Subtle synth pulse tick every ~0.46s
    this.beatTimer += dt;
    const beatInterval = Math.max(0.32, 0.46 / Math.max(0.85, intensity * 0.92));
    if (this.beatTimer >= beatInterval) {
      this.beatTimer -= beatInterval;
      this.beatStep += 1;
      const now = synthAudio.currentTime;
      if (this.beatStep % 2 === 0) synthAudio.scheduleKick(now);
      else synthAudio.scheduleHat(now);
    }

    if (this.pulseFlash > 0) this.pulseFlash = Math.max(0, this.pulseFlash - dt);

    const total = this.hits + this.misses;
    const acc = total > 0 ? Math.round((this.hits / total) * 100) : 100;
    this.ctx.setHud({
      subStat: `ACIERTOS ${this.hits} · PRECISIÓN ${acc}% · ${this.spinDir > 0 ? '↻' : '↺'}`,
    });

    this.draw();
  }

  private draw(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const g = this.c2d;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const radius = Math.max(85, Math.min(w, h) * 0.31);

    g.fillStyle = '#090F1A';
    g.fillRect(0, 0, w, h);

    if (this.pulseFlash > 0) {
      g.strokeStyle = this.flashColor;
      g.globalAlpha = this.pulseFlash * 2.5;
      g.lineWidth = 10;
      g.beginPath();
      g.arc(cx, cy, radius + 18, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }

    // Outer track ring
    g.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    g.lineWidth = 14;
    g.beginPath();
    g.arc(cx, cy, radius, 0, Math.PI * 2);
    g.stroke();

    // Target hit arc
    const startA = this.targetAngle - this.targetWidth * 0.5;
    const endA = this.targetAngle + this.targetWidth * 0.5;
    g.strokeStyle = this.targetKind === 'gold' ? '#FBBF24' : '#14B8A6';
    g.lineWidth = 16;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, cy, radius, startA, endA);
    g.stroke();

    // Perfect core sliver
    const coreStart = this.targetAngle - this.targetWidth * 0.16;
    const coreEnd = this.targetAngle + this.targetWidth * 0.16;
    g.strokeStyle = '#FFFFFF';
    g.lineWidth = 16;
    g.beginPath();
    g.arc(cx, cy, radius, coreStart, coreEnd);
    g.stroke();
    g.lineCap = 'butt';

    // Sweeping needle
    const nx = cx + Math.cos(this.needleAngle) * radius;
    const ny = cy + Math.sin(this.needleAngle) * radius;
    g.strokeStyle = '#38BDF8';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(nx, ny);
    g.stroke();

    g.fillStyle = '#FFFFFF';
    g.beginPath();
    g.arc(nx, ny, 8, 0, Math.PI * 2);
    g.fill();

    // Center hub + direction cue
    g.fillStyle = '#0F172A';
    g.strokeStyle = '#38BDF8';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, 34, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    g.fillStyle = '#E2E8F0';
    g.font = 'bold 18px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(`${this.spinDir > 0 ? '↻' : '↺'} ${this.combo}`, cx, cy);
  }

  public onResize(): void {
    const rect = this.wrapper.getBoundingClientRect();
    this.canvas.width = Math.max(320, Math.floor(rect.width || 800));
    this.canvas.height = Math.max(260, Math.floor(rect.height || 520));
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getMetrics(survived = true): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const total = this.hits + this.misses;
    const acc = total > 0 ? (this.hits / total) * 100 : 100;
    const rhythmScore = Math.min(980, 260 + this.hits * 24 + this.maxCombo * 14 - this.misses * 20);
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy: acc,
      hits: this.hits,
      misses: this.misses,
      survived,
      axisPerformances: {
        rhythm: Math.max(120, Math.round(rhythmScore)),
        reflex: Math.max(120, Math.round(rhythmScore * 0.9)),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    this.canvas.removeEventListener('pointerdown', this.onTrigger);
    window.removeEventListener('keydown', this.onKeyDown);
    this.wrapper.remove();
  }
}
