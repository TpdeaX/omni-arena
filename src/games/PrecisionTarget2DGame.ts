import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

interface TargetOrb {
  x: number;
  y: number;
  r: number;
  ttl: number;
  maxTtl: number;
  kind: 'normal' | 'gold' | 'decoy';
  spawnedAt: number;
}

export class PrecisionTarget2DGame implements MiniGame {
  public readonly id = 'sniper2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private c2d!: CanvasRenderingContext2D;

  private targets: TargetOrb[] = [];
  private spawnTimer = 0.2;

  private hits = 0;
  private misses = 0;
  private reactionSamples: number[] = [];
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private elapsed = 0;
  private readonly standaloneDuration = 45;
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
    this.canvas.addEventListener('pointerdown', this.onPointerDown);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'CAZADOR DE REFLEJOS',
      accent: '#F43F5E',
      timeLeftSec: this.isGauntletSlice || this.ctx.infiniteMode ? null : this.standaloneDuration,
      subStat: 'BLANCOS 0 · PRECISIÓN 100%',
    });
  }

  private spawnTarget(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const pad = 64;
    const roll = Math.random();
    const kind: TargetOrb['kind'] = roll < 0.16 ? 'decoy' : roll < 0.32 ? 'gold' : 'normal';
    const intensity = this.ctx.getIntensity();
    const prog =
      this.ctx.infiniteMode || this.ctx.difficulty === 'progressive'
        ? Math.min(0.45, this.elapsed * 0.005)
        : 0;
    const eff = intensity + prog;
    const baseR = kind === 'gold' ? 24 : 30;
    const r = Math.max(18, Math.round(baseR - Math.max(0, eff - 1) * 3.5));
    const minTtl = this.ctx.infiniteMode || this.ctx.difficulty === 'progressive' ? 0.72 : 0.85;
    const maxTtl = Math.max(minTtl, (kind === 'gold' ? 1.35 : 1.75) / Math.max(0.8, eff));

    this.targets.push({
      x: pad + Math.random() * Math.max(40, w - pad * 2),
      y: pad + Math.random() * Math.max(40, h - pad * 2),
      r,
      ttl: maxTtl,
      maxTtl,
      kind,
      spawnedAt: performance.now(),
    });
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.paused || this.destroyed) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * this.canvas.height;

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (Math.hypot(px - t.x, py - t.y) <= t.r + 10) {
        this.targets.splice(i, 1);
        if (t.kind === 'decoy') {
          this.misses += 1;
          this.combo = 0;
          this.ctx.breakCombo();
          synthAudio.damage();
          const left = this.ctx.damage(1);
          if (left <= 0) {
            this.ctx.finish(this.getMetrics(false));
            return;
          }
          return;
        }
        const rx = performance.now() - t.spawnedAt;
        this.reactionSamples.push(rx);
        this.hits += 1;
        this.combo += 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        const pts = t.kind === 'gold' ? 220 : 120;
        this.score += pts;
        this.ctx.addScore(pts, 1);
        synthAudio.hitmarker(this.combo);
        return;
      }
    }

    this.misses += 1;
    this.combo = 0;
    this.ctx.breakCombo();
    synthAudio.damage();
  };

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;

    if (!this.isGauntletSlice && !this.ctx.infiniteMode) {
      const left = Math.max(0, this.standaloneDuration - this.elapsed);
      this.ctx.setHud({ timeLeftSec: left });
      if (left <= 0) {
        this.ctx.finish(this.getMetrics(true));
        return;
      }
    }

    const intensity = this.ctx.getIntensity();
    const maxTargets =
      this.ctx.infiniteMode || this.ctx.difficulty === 'progressive'
        ? Math.min(6, 4 + Math.floor(Math.max(0, intensity - 1.1) * 2.5))
        : 4;
    const minSpawn = this.ctx.infiniteMode || this.ctx.difficulty === 'progressive' ? 0.24 : 0.32;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.targets.length < maxTargets) {
      this.spawnTarget();
      this.spawnTimer = Math.max(minSpawn, 0.78 / Math.max(0.8, intensity));
    }

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      t.ttl -= dt;
      if (t.ttl <= 0) {
        this.targets.splice(i, 1);
        if (t.kind !== 'decoy') {
          this.misses += 1;
          this.combo = 0;
          this.ctx.breakCombo();
          if (this.ctx.infiniteMode && !this.isGauntletSlice && t.kind === 'normal') {
            synthAudio.damage();
            this.ctx.toast('BLANCO PERDIDO -1 ESCUDO', 'bad');
            const left = this.ctx.damage(1);
            if (left <= 0) {
              this.ctx.finish(this.getMetrics(false));
              return;
            }
          }
        }
      }
    }

    const total = this.hits + this.misses;
    const acc = total > 0 ? Math.round((this.hits / total) * 100) : 100;
    this.ctx.setHud({ subStat: `BLANCOS ${this.hits} · PRECISIÓN ${acc}%` });

    this.draw();
  }

  private draw(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const g = this.c2d;
    g.fillStyle = '#0B1019';
    g.fillRect(0, 0, w, h);

    for (const t of this.targets) {
      const ratio = Math.max(0, t.ttl / t.maxTtl);
      const color = t.kind === 'decoy' ? '#EF4444' : t.kind === 'gold' ? '#FBBF24' : '#38BDF8';

      g.strokeStyle = color;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(t.x, t.y, t.r + ratio * 18, 0, Math.PI * 2);
      g.stroke();

      g.fillStyle = color;
      g.globalAlpha = 0.25;
      g.beginPath();
      g.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;

      if (t.kind === 'decoy') {
        const xr = t.r * 0.48;
        g.strokeStyle = '#FFFFFF';
        g.lineWidth = 3;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(t.x - xr, t.y - xr);
        g.lineTo(t.x + xr, t.y + xr);
        g.moveTo(t.x + xr, t.y - xr);
        g.lineTo(t.x - xr, t.y + xr);
        g.stroke();

        g.fillStyle = '#FCA5A5';
        g.font = '700 12px "JetBrains Mono", monospace';
        g.textAlign = 'center';
        g.textBaseline = 'top';
        g.fillText('NO', t.x, t.y + t.r + 6);
      } else {
        g.fillStyle = '#FFFFFF';
        g.beginPath();
        g.arc(t.x, t.y, 5, 0, Math.PI * 2);
        g.fill();
      }
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
    const total = this.hits + this.misses;
    const accuracy = total > 0 ? (this.hits / total) * 100 : 0;
    const avgRx =
      this.reactionSamples.length > 0
        ? this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length
        : 520;
    const aimScore =
      total === 0
        ? 140
        : Math.min(980, 260 + this.hits * 28 + Math.max(0, 580 - avgRx) * 0.45 - this.misses * 22);
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy,
      avgReactionMs: Math.round(avgRx),
      hits: this.hits,
      misses: this.misses,
      survived,
      axisPerformances: {
        aim: Math.max(120, Math.round(aimScore)),
        reflex: Math.max(120, Math.round(aimScore * 0.9)),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.wrapper.remove();
  }
}
