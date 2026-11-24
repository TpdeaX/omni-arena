import '../styles/neurolab.css';
import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

interface MotOrb {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  isTarget: boolean;
  picked: boolean;
}

type MotPhase = 'cue' | 'move' | 'pick' | 'reveal';

function cssVar(name: string, fallback: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

export class MultipleObjectTrack2DGame implements MiniGame {
  public readonly id = 'mot2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private g!: CanvasRenderingContext2D;
  private statusEl!: HTMLDivElement;
  private pillEl!: HTMLSpanElement;

  private width = 560;
  private height = 380;
  private orbs: MotOrb[] = [];
  private phase: MotPhase = 'cue';
  private phaseTimer = 2.5;
  private round = 1;
  private targetCount = 3;
  private pickedCount = 0;
  private pickStartedMs = 0;

  private hits = 0;
  private misses = 0;
  private roundsCleared = 0;
  private reactionSamples: number[] = [];
  private combo = 0;
  private maxCombo = 0;
  private score = 0;

  private elapsed = 0;
  private readonly standaloneDuration = 70;
  private readonly isGauntletSlice: boolean;
  private paused = false;
  private destroyed = false;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'oa-stage oa-neuro-stage';
    this.wrapper.innerHTML = `
      <div class="oa-neuro-canvas-layout">
        <div class="oa-neuro-top-strip">
          <span class="oa-mem-pill" id="oa-mot-pill">RONDA 1 · 3 OBJETIVOS</span>
          <div class="oa-mem-status" id="oa-mot-status">Memoriza las esferas doradas...</div>
        </div>
        <div class="oa-neuro-canvas-wrap oa-mot-wrap">
          <canvas class="oa-neuro-canvas" id="oa-mot-canvas" aria-label="Arena de Rastreo Múltiple"></canvas>
        </div>
      </div>
    `;
    this.ctx.container.appendChild(this.wrapper);
    this.canvas = this.wrapper.querySelector('#oa-mot-canvas')!;
    this.g = this.canvas.getContext('2d')!;
    this.statusEl = this.wrapper.querySelector('#oa-mot-status')!;
    this.pillEl = this.wrapper.querySelector('#oa-mot-pill')!;

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.onResize();

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'RASTREO MÚLTIPLE',
      accent: '#10B981',
      timeLeftSec: this.isGauntletSlice || this.ctx.infiniteMode ? null : this.standaloneDuration,
      subStat: 'ATENCIÓN DIVIDIDA · MOT',
    });

    this.startRound();
  }

  private startRound(): void {
    const intensity = this.ctx.getIntensity();
    const totalOrbs = Math.max(8, Math.min(14, 8 + Math.floor((this.round - 1) / 2) * 2));
    this.targetCount = Math.max(3, Math.min(6, 3 + Math.floor((this.round - 1) / 2)));
    const speedBase = (this.ctx.practiceMode ? 88 : 112) * Math.max(0.75, Math.min(1.65, intensity));
    const orbR = Math.max(17, Math.min(24, Math.min(this.width, this.height) * 0.056));

    this.orbs = [];
    for (let i = 0; i < totalOrbs; i++) {
      let x = orbR + 18 + Math.random() * Math.max(40, this.width - (orbR + 18) * 2);
      let y = orbR + 18 + Math.random() * Math.max(40, this.height - (orbR + 18) * 2);
      for (let tries = 0; tries < 25; tries++) {
        const overlaps = this.orbs.some((o) => Math.hypot(o.x - x, o.y - y) < orbR * 2.5);
        if (!overlaps) break;
        x = orbR + 18 + Math.random() * Math.max(40, this.width - (orbR + 18) * 2);
        y = orbR + 18 + Math.random() * Math.max(40, this.height - (orbR + 18) * 2);
      }
      const angle = Math.random() * Math.PI * 2;
      const spd = speedBase * (0.85 + Math.random() * 0.32);
      this.orbs.push({
        id: i,
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        r: orbR,
        isTarget: i < this.targetCount,
        picked: false,
      });
    }

    this.pickedCount = 0;
    this.phase = 'cue';
    this.phaseTimer = 2.5;
    this.pillEl.textContent = `RONDA ${this.round} · ${this.targetCount} DE ${totalOrbs} ESFERAS`;
    this.statusEl.textContent = `Fija tu atención en las ${this.targetCount} esferas iluminadas (2.5s)`;
    synthAudio.scheduleNoteCue(1);
    this.draw();
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.paused || this.destroyed || this.phase !== 'pick') return;
    const rect = this.canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / Math.max(1, rect.width)) * this.width;
    const py = ((e.clientY - rect.top) / Math.max(1, rect.height)) * this.height;

    const hitOrb = this.orbs.find(
      (o) => !o.picked && Math.hypot(o.x - px, o.y - py) <= o.r + 10
    );
    if (!hitOrb) return;

    hitOrb.picked = true;
    this.pickedCount += 1;
    const now = performance.now();
    this.reactionSamples.push(Math.max(120, Math.round(now - this.pickStartedMs)));
    this.pickStartedMs = now;
    synthAudio.uiClick();

    if (this.pickedCount >= this.targetCount) {
      this.evaluateRound();
    } else {
      this.statusEl.textContent = `Seleccionadas ${this.pickedCount}/${this.targetCount} esferas`;
      this.draw();
    }
  };

  private evaluateRound(): void {
    let correct = 0;
    let wrong = 0;
    for (const o of this.orbs) {
      if (o.picked && o.isTarget) correct += 1;
      else if (o.picked && !o.isTarget) wrong += 1;
    }

    this.hits += correct;
    this.misses += wrong;

    if (wrong === 0 && correct === this.targetCount) {
      this.roundsCleared += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const pts = 260 + this.targetCount * 75;
      this.score += pts;
      this.ctx.addScore(pts, 2);
      synthAudio.puzzleSuccess(this.combo);
      this.statusEl.textContent = `¡RASTREO PERFECTO ${correct}/${this.targetCount}! (+${pts})`;
      this.round += 1;
    } else {
      const partialPts = correct * 55;
      if (partialPts > 0) {
        this.score += partialPts;
        this.ctx.addScore(partialPts, 0);
      }
      this.combo = 0;
      this.ctx.breakCombo();
      synthAudio.damage();
      this.statusEl.textContent = `Acertaste ${correct}/${this.targetCount} · revisa los anillos dorados`;
      if (!this.ctx.practiceMode) {
        const left = this.ctx.damage(1);
        if (left <= 0) {
          this.ctx.finish(this.getMetrics(false));
          return;
        }
      }
    }

    const total = this.hits + this.misses;
    const acc = total > 0 ? Math.round((this.hits / total) * 100) : 100;
    this.ctx.setHud({
      subStat: `RONDA ${this.round} · PRECISIÓN ${acc}% · PERFECTAS ${this.roundsCleared}`,
    });

    this.phase = 'reveal';
    this.phaseTimer = 1.65;
    this.draw();
  }

  private stepPhysics(dt: number): void {
    const pad = 10;
    for (const o of this.orbs) {
      o.x += o.vx * dt;
      o.y += o.vy * dt;

      if (o.x - o.r < pad) {
        o.x = pad + o.r;
        o.vx = Math.abs(o.vx);
      } else if (o.x + o.r > this.width - pad) {
        o.x = this.width - pad - o.r;
        o.vx = -Math.abs(o.vx);
      }
      if (o.y - o.r < pad) {
        o.y = pad + o.r;
        o.vy = Math.abs(o.vy);
      } else if (o.y + o.r > this.height - pad) {
        o.y = this.height - pad - o.r;
        o.vy = -Math.abs(o.vy);
      }
    }

    // Soft elastic orb-orb collision so targets never obscure each other
    for (let i = 0; i < this.orbs.length; i++) {
      for (let j = i + 1; j < this.orbs.length; j++) {
        const a = this.orbs[i];
        const b = this.orbs[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.r + b.r + 4;
        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;

          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const rel = dvx * nx + dvy * ny;
          if (rel > 0) {
            a.vx -= rel * nx;
            a.vy -= rel * ny;
            b.vx += rel * nx;
            b.vy += rel * ny;
          }
        }
      }
    }
  }

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

    if (this.phase === 'cue') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'move';
        const intensity = this.ctx.getIntensity();
        this.phaseTimer = Math.min(7.0, 5.0 + Math.min(1.8, (this.round - 1) * 0.25 + (intensity - 1)));
        this.statusEl.textContent = '¡Síguelas con la mirada sin perder el grupo!';
      }
    } else if (this.phase === 'move') {
      this.stepPhysics(dt);
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'pick';
        this.pickStartedMs = performance.now();
        this.statusEl.textContent = `Selecciona las ${this.targetCount} esferas objetivo (0/${this.targetCount})`;
        synthAudio.scheduleNoteCue(2);
      }
    } else if (this.phase === 'reveal') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.startRound();
        return;
      }
    }

    this.draw();
  }

  private draw(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const g = this.g;
    g.save();
    g.scale(dpr, dpr);
    g.clearRect(0, 0, this.width, this.height);

    const bgPanel = cssVar('--bg-panel', '#131822');
    const bgElevated = cssVar('--bg-elevated', '#1a2130');
    const borderStrong = cssVar('--border-strong', '#34435e');
    const accentCyan = cssVar('--accent-cyan', '#00e5ff');

    g.fillStyle = bgPanel;
    g.fillRect(0, 0, this.width, this.height);

    // Subtle reference grid
    g.strokeStyle = borderStrong;
    g.globalAlpha = 0.22;
    g.lineWidth = 1;
    for (let x = 48; x < this.width; x += 48) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, this.height);
      g.stroke();
    }
    for (let y = 48; y < this.height; y += 48) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(this.width, y);
      g.stroke();
    }
    g.globalAlpha = 1;

    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 9);

    for (const o of this.orbs) {
      let fill = bgElevated;
      let stroke = borderStrong;
      let lineW = 2.5;

      if (this.phase === 'cue' && o.isTarget) {
        fill = '#10B981';
        stroke = '#F59E0B';
        lineW = 3.5;
        g.beginPath();
        g.arc(o.x, o.y, o.r + 5 + pulse * 4, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(245, 158, 11, 0.55)';
        g.lineWidth = 2;
        g.stroke();
      } else if (this.phase === 'pick' && o.picked) {
        fill = 'rgba(0, 229, 255, 0.28)';
        stroke = accentCyan;
        lineW = 3.5;
      } else if (this.phase === 'reveal') {
        if (o.picked && o.isTarget) {
          fill = '#22C55E';
          stroke = '#FFFFFF';
          lineW = 3;
        } else if (o.picked && !o.isTarget) {
          fill = '#EF4444';
          stroke = '#FFFFFF';
          lineW = 3;
        } else if (!o.picked && o.isTarget) {
          fill = 'rgba(245, 158, 11, 0.25)';
          stroke = '#F59E0B';
          lineW = 3.5;
        }
      }

      g.beginPath();
      g.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      g.fillStyle = fill;
      g.fill();
      g.lineWidth = lineW;
      g.strokeStyle = stroke;
      g.stroke();

      // Inner specular dot for crisp depth
      g.beginPath();
      g.arc(o.x - o.r * 0.28, o.y - o.r * 0.28, o.r * 0.22, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fill();
    }

    g.restore();
  }

  public onResize(): void {
    const wrap = this.canvas?.parentElement;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(280, Math.min(rect.width || 560, 680));
    const h = Math.max(240, Math.min(rect.height || 380, 440));
    const prevW = this.width;
    const prevH = this.height;
    this.width = w;
    this.height = h;

    if (this.orbs.length > 0 && prevW > 0 && prevH > 0) {
      const sx = w / prevW;
      const sy = h / prevH;
      for (const o of this.orbs) {
        o.x = Math.max(o.r + 8, Math.min(w - o.r - 8, o.x * sx));
        o.y = Math.max(o.r + 8, Math.min(h - o.r - 8, o.y * sy));
      }
    }

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.draw();
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getMetrics(
    survived = true
  ): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const total = this.hits + this.misses;
    const acc = total > 0 ? (this.hits / total) * 100 : 0;
    const avgRx =
      this.reactionSamples.length > 0
        ? Math.round(this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length)
        : 780;
    const perf =
      total === 0
        ? 160
        : Math.max(
            120,
            Math.min(
              990,
              Math.round(240 + this.roundsCleared * 115 + this.hits * 18 + acc * 2.2 - this.misses * 25)
            )
          );
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy: acc,
      avgReactionMs: avgRx,
      hits: this.hits,
      misses: this.misses,
      puzzlesSolved: this.roundsCleared,
      survived,
      axisPerformances: {
        aim: perf,
        logic: Math.round(perf * 0.85),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.wrapper.remove();
  }
}
