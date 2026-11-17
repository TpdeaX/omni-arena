import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

export class LaserTrack2DGame implements MiniGame {
  public readonly id = 'track2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;

  private tx = 400;
  private ty = 260;
  private tvx = 175;
  private tvy = 135;
  private targetRadius = 38;

  private dx = 220;
  private dy = 180;
  private dvx = -140;
  private dvy = 115;

  private px = 400;
  private py = 260;
  private hasPointer = false;
  private pointerActive = false;

  private trackTicks = 0;
  private totalTicks = 0;
  private lockStreak = 0;
  private tickAccum = 0;
  private decoyHoverTime = 0;
  private shiftTimer = 2.4;

  private hits = 0;
  private misses = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private elapsed = 0;
  private readonly standaloneDuration = 45;
  private isGauntletSlice = false;
  private paused = false;
  private destroyed = false;

  private trail: { x: number; y: number }[] = [];

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
    this.tx = this.canvas.width * 0.5;
    this.ty = this.canvas.height * 0.5;
    this.px = this.tx;
    this.py = this.ty;
    this.dx = this.canvas.width * 0.25;
    this.dy = this.canvas.height * 0.3;

    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'RASTREO QUIRÚRGICO',
      accent: '#EC4899',
      timeLeftSec: this.isGauntletSlice ? null : this.standaloneDuration,
      subStat: 'FIJACIÓN 100% · SIGUE EL NÚCLEO',
    });
  }

  private updatePointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.px = ((e.clientX - rect.left) / Math.max(1, rect.width)) * this.canvas.width;
    this.py = ((e.clientY - rect.top) / Math.max(1, rect.height)) * this.canvas.height;
    this.hasPointer = true;
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (this.paused || this.destroyed) return;
    if (e.pointerType !== 'touch' || this.pointerActive) {
      this.updatePointer(e);
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.paused || this.destroyed) return;
    this.pointerActive = true;
    this.updatePointer(e);
  };

  private onPointerUp = (): void => {
    this.pointerActive = false;
  };

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

    const w = this.canvas.width;
    const h = this.canvas.height;
    const intensity = this.ctx.getIntensity();
    const speedScale = 0.85 + intensity * 0.38;

    this.targetRadius = Math.max(26, Math.round(42 - intensity * 4.5));

    this.shiftTimer -= dt;
    if (this.shiftTimer <= 0) {
      const angle = (Math.random() - 0.5) * 2.1;
      const spd = Math.hypot(this.tvx, this.tvy);
      const curAngle = Math.atan2(this.tvy, this.tvx) + angle;
      const targetSpd = Math.min(360, Math.max(165, spd * (0.94 + Math.random() * 0.16)));
      this.tvx = Math.cos(curAngle) * targetSpd;
      this.tvy = Math.sin(curAngle) * targetSpd;
      this.shiftTimer = Math.max(1.1, 2.3 / Math.max(0.8, intensity));
    }

    const pad = this.targetRadius + 24;
    this.tx += this.tvx * speedScale * dt;
    this.ty += this.tvy * speedScale * dt;
    if (this.tx < pad) {
      this.tx = pad;
      this.tvx = Math.abs(this.tvx);
    } else if (this.tx > w - pad) {
      this.tx = w - pad;
      this.tvx = -Math.abs(this.tvx);
    }
    if (this.ty < pad) {
      this.ty = pad;
      this.tvy = Math.abs(this.tvy);
    } else if (this.ty > h - pad) {
      this.ty = h - pad;
      this.tvy = -Math.abs(this.tvy);
    }

    this.trail.push({ x: this.tx, y: this.ty });
    if (this.trail.length > 16) this.trail.shift();

    // Move decoy orb smoothly
    this.dx += this.dvx * (0.75 + intensity * 0.25) * dt;
    this.dy += this.dvy * (0.75 + intensity * 0.25) * dt;
    if (this.dx < 36 || this.dx > w - 36) {
      this.dvx = -this.dvx;
      this.dx = Math.max(36, Math.min(w - 36, this.dx));
    }
    if (this.dy < 36 || this.dy > h - 36) {
      this.dvy = -this.dvy;
      this.dy = Math.max(36, Math.min(h - 36, this.dy));
    }

    const dist = Math.hypot(this.px - this.tx, this.py - this.ty);
    const decoyDist = Math.hypot(this.px - this.dx, this.py - this.dy);
    const inOuter = this.hasPointer && dist <= this.targetRadius;
    const inCore = this.hasPointer && dist <= this.targetRadius * 0.45;

    if (this.hasPointer && decoyDist <= 28 && !inOuter) {
      this.decoyHoverTime += dt;
      if (this.decoyHoverTime >= 0.35) {
        this.decoyHoverTime = 0;
        this.misses += 1;
        this.combo = 0;
        this.lockStreak = 0;
        this.ctx.breakCombo();
        synthAudio.damage();
        const left = this.ctx.damage(1);
        if (left <= 0) {
          this.ctx.finish(this.getMetrics(false));
          return;
        }
      }
    } else {
      this.decoyHoverTime = Math.max(0, this.decoyHoverTime - dt * 2);
    }

    this.tickAccum += dt;
    while (this.tickAccum >= 0.14) {
      this.tickAccum -= 0.14;
      if (!this.hasPointer) continue;
      this.totalTicks += 1;
      if (inOuter) {
        this.trackTicks += 1;
        this.lockStreak += 1;
        const pts = inCore ? 42 : 24;
        this.score += pts;
        const incCombo = this.lockStreak % 5 === 0 ? 1 : 0;
        if (incCombo) {
          this.combo += 1;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          this.hits += 1;
          synthAudio.hitmarker(this.combo);
        }
        this.ctx.addScore(pts, incCombo);
      } else {
        this.lockStreak = 0;
        if (this.combo > 0 && this.totalTicks % 4 === 0) {
          this.misses += 1;
          this.combo = 0;
          this.ctx.breakCombo();
        }
      }
    }

    const pct = this.totalTicks > 0 ? Math.round((this.trackTicks / this.totalTicks) * 100) : 100;
    this.ctx.setHud({
      subStat: `FIJACIÓN ${pct}% · ${inCore ? 'NÚCLEO EXACTA' : inOuter ? 'EN BLANCO' : 'MUEVE EL PUNTERO'}`,
    });

    this.draw(inOuter, inCore);
  }

  private draw(inOuter: boolean, inCore: boolean): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const g = this.c2d;
    g.fillStyle = '#090D16';
    g.fillRect(0, 0, w, h);

    // Subtle spatial guide grid
    g.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    g.lineWidth = 1;
    for (let x = 60; x < w; x += 60) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let y = 60; y < h; y += 60) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }

    // Target motion trail
    for (let i = 0; i < this.trail.length; i++) {
      const pt = this.trail[i];
      const alpha = ((i + 1) / this.trail.length) * 0.25;
      g.fillStyle = inOuter ? `rgba(16, 185, 129, ${alpha})` : `rgba(236, 72, 153, ${alpha})`;
      g.beginPath();
      g.arc(pt.x, pt.y, this.targetRadius * 0.35 * ((i + 1) / this.trail.length), 0, Math.PI * 2);
      g.fill();
    }

    // Decoy hazard orb
    g.strokeStyle = '#EF4444';
    g.lineWidth = 2.5;
    g.fillStyle = 'rgba(239, 68, 68, 0.2)';
    g.beginPath();
    g.arc(this.dx, this.dy, 24, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#FCA5A5';
    g.font = 'bold 11px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('NO', this.dx, this.dy);

    // Main target outer ring
    const ringColor = inCore ? '#10B981' : inOuter ? '#38BDF8' : '#EC4899';
    g.fillStyle = ringColor;
    g.globalAlpha = 0.2;
    g.beginPath();
    g.arc(this.tx, this.ty, this.targetRadius, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;

    g.strokeStyle = ringColor;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(this.tx, this.ty, this.targetRadius, 0, Math.PI * 2);
    g.stroke();

    // Inner bullseye
    g.fillStyle = inCore ? '#34D399' : '#FFFFFF';
    g.beginPath();
    g.arc(this.tx, this.ty, this.targetRadius * 0.38, 0, Math.PI * 2);
    g.fill();

    // Player precision reticle
    if (this.hasPointer) {
      g.strokeStyle = inOuter ? '#10B981' : '#E2E8F0';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(this.px, this.py, 14, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = inOuter ? '#10B981' : '#F43F5E';
      g.beginPath();
      g.arc(this.px, this.py, 3, 0, Math.PI * 2);
      g.fill();
    }
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
    const pct = this.totalTicks > 0 ? (this.trackTicks / this.totalTicks) * 100 : 80;
    const aimScore = Math.min(980, 240 + pct * 6.5 + this.maxCombo * 8 - this.misses * 25);
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy: pct,
      hits: this.hits,
      misses: this.misses,
      survived,
      axisPerformances: {
        aim: Math.max(120, Math.round(aimScore)),
        reflex: Math.max(120, Math.round(aimScore * 0.88)),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.wrapper.remove();
  }
}
