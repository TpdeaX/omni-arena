import '../styles/neurolab.css';
import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';
import { stepMackworthTick } from './neuro/neuroEngines';

function cssVar(name: string, fallback: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

export class MackworthClock2DGame implements MiniGame {
  public readonly id = 'mackworth2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private g!: CanvasRenderingContext2D;
  private statusEl!: HTMLDivElement;
  private actionBtn!: HTMLButtonElement;

  private totalNodes = 20;
  private currentIdx = 0;
  private stepsSinceJump = 0;
  private tickTimer = 0.72;
  private tickInterval = 0.72;

  private activeDoubleJump = false;
  private jumpStartedMs = 0;
  private jumpWindowLeft = 0;
  private lastSkippedIdx: number | null = null;
  private feedbackFlash: { tone: 'good' | 'bad'; timer: number; text: string } | null = null;

  private hits = 0;
  private misses = 0;
  private falseAlarms = 0;
  private reactionSamples: number[] = [];
  private combo = 0;
  private maxCombo = 0;
  private score = 0;

  private elapsed = 0;
  private readonly standaloneDuration = 65;
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
          <span class="oa-mem-pill" id="oa-mw-pill">VIGILANCIA · 20 NODOS</span>
          <div class="oa-mem-status" id="oa-mw-status">Observa la aguja y pulsa ESPACIO ante un doble salto</div>
        </div>
        <div class="oa-neuro-canvas-wrap">
          <canvas class="oa-neuro-canvas" id="oa-mw-canvas" aria-label="Reloj de Mackworth"></canvas>
        </div>
        <div class="oa-neuro-action-bar">
          <button type="button" class="oa-neuro-big-btn" id="oa-mw-detect">
            <strong>DOBLE SALTO DETECTADO</strong>
            <span>${ctx.isTouch ? 'Tocar aquí o sobre el reloj' : 'Pulsa ESPACIO / ENTER o Clic'}</span>
          </button>
        </div>
      </div>
    `;

    this.ctx.container.appendChild(this.wrapper);
    this.canvas = this.wrapper.querySelector('#oa-mw-canvas')!;
    this.g = this.canvas.getContext('2d')!;
    this.statusEl = this.wrapper.querySelector('#oa-mw-status')!;
    this.actionBtn = this.wrapper.querySelector('#oa-mw-detect')!;

    this.actionBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.handleDetect();
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.handleDetect();
    });
    window.addEventListener('keydown', this.onKeyDown);

    this.computeDifficultyParams();
    this.onResize();

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'RELOJ DE MACKWORTH',
      accent: '#0EA5E9',
      timeLeftSec: this.isGauntletSlice || this.ctx.infiniteMode ? null : this.standaloneDuration,
      subStat: 'VIGILANCIA SOSTENIDA · ESPACIO EN DOBLE SALTO',
    });

    this.draw();
  }

  private computeDifficultyParams(): void {
    const intensity = this.ctx.getIntensity();
    const extraNodes = Math.min(4, Math.floor(this.hits / 4) + (intensity >= 1.25 ? 2 : 0));
    const nextNodes = Math.max(18, Math.min(24, 18 + extraNodes * 2));
    if (nextNodes !== this.totalNodes) {
      this.totalNodes = nextNodes;
      this.currentIdx = this.currentIdx % this.totalNodes;
      const pill = this.wrapper.querySelector('#oa-mw-pill');
      if (pill) pill.textContent = `VIGILANCIA · ${this.totalNodes} NODOS`;
    }
    const baseTick = this.ctx.practiceMode ? 0.82 : 0.72;
    this.tickInterval = Math.max(0.42, baseTick / Math.max(0.75, intensity * 0.94));
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      this.handleDetect();
    }
  };

  private handleDetect(): void {
    if (this.paused || this.destroyed) return;
    synthAudio.ensure();

    if (this.activeDoubleJump && this.jumpWindowLeft > 0) {
      const rx = Math.max(80, Math.round(performance.now() - this.jumpStartedMs));
      this.reactionSamples.push(rx);
      this.activeDoubleJump = false;
      this.jumpWindowLeft = 0;

      this.hits += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      const speedBonus = Math.max(0, Math.round((900 - rx) * 0.25));
      const pts = 180 + speedBonus;
      this.score += pts;
      this.ctx.addScore(pts, 1);
      synthAudio.bullseye(this.combo);

      this.feedbackFlash = { tone: 'good', timer: 0.6, text: `DETECTADO · ${rx} ms (+${pts})` };
      this.statusEl.textContent = `¡Doble salto captado en ${rx} ms!`;
      this.updateSubStat();
      this.computeDifficultyParams();
    } else {
      // False alarm
      this.falseAlarms += 1;
      this.misses += 1;
      this.combo = 0;
      this.ctx.breakCombo();
      synthAudio.damage();

      this.feedbackFlash = { tone: 'bad', timer: 0.65, text: 'FALSA ALARMA (PASO NORMAL)' };
      this.statusEl.textContent = 'Paso normal de 1 nodo · espera al doble salto';
      this.updateSubStat();

      if (!this.ctx.practiceMode) {
        const left = this.ctx.damage(1);
        if (left <= 0) {
          this.ctx.finish(this.getMetrics(false));
        }
      }
    }
  }

  private updateSubStat(): void {
    const total = this.hits + this.misses;
    const acc = total > 0 ? Math.round((this.hits / total) * 100) : 100;
    const avg =
      this.reactionSamples.length > 0
        ? Math.round(this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length)
        : 0;
    this.ctx.setHud({
      subStat: `PRECISIÓN ${acc}%${avg ? ` · ${avg} ms` : ''} · FALSAS ${this.falseAlarms}`,
    });
  }

  private advanceTick(): void {
    // Check if previous double jump went undetected
    if (this.activeDoubleJump && this.jumpWindowLeft <= 0) {
      this.registerMissedJump();
    }

    this.computeDifficultyParams();
    const res = stepMackworthTick(this.currentIdx, this.totalNodes, 0.25, this.stepsSinceJump);
    this.currentIdx = res.nextIndex;
    this.stepsSinceJump = res.stepsSinceLastJump;
    this.lastSkippedIdx = res.skippedIndex;

    if (res.isDoubleJump) {
      this.activeDoubleJump = true;
      this.jumpStartedMs = performance.now();
      this.jumpWindowLeft = Math.max(1.05, this.tickInterval * 1.65);
      synthAudio.playMetronomeClick(true);
    } else {
      synthAudio.playMetronomeClick(false);
    }
  }

  private registerMissedJump(): void {
    this.activeDoubleJump = false;
    this.jumpWindowLeft = 0;
    this.misses += 1;
    this.combo = 0;
    this.ctx.breakCombo();
    synthAudio.damage();
    this.feedbackFlash = { tone: 'bad', timer: 0.65, text: 'DOBLE SALTO NO DETECTADO' };
    this.statusEl.textContent = 'Se escapó un doble salto · mantén la atención';
    this.updateSubStat();

    if (!this.ctx.practiceMode) {
      const left = this.ctx.damage(1);
      if (left <= 0) {
        this.ctx.finish(this.getMetrics(false));
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

    if (this.feedbackFlash) {
      this.feedbackFlash.timer -= dt;
      if (this.feedbackFlash.timer <= 0) this.feedbackFlash = null;
    }

    if (this.activeDoubleJump) {
      this.jumpWindowLeft -= dt;
      if (this.jumpWindowLeft <= 0) {
        this.registerMissedJump();
        if (this.destroyed) return;
      }
    }

    this.tickTimer -= dt;
    if (this.tickTimer <= 0) {
      this.tickTimer += this.tickInterval;
      this.advanceTick();
    }

    this.draw();
  }

  private draw(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    if (w <= 0 || h <= 0) return;

    const g = this.g;
    g.save();
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);

    const bgPanel = cssVar('--bg-panel', '#131822');
    const borderStrong = cssVar('--border-strong', '#34435e');
    const inkPrimary = cssVar('--ink-primary', '#f2f5f9');
    const inkMuted = cssVar('--ink-muted', '#6f8099');
    const accentCyan = cssVar('--accent-cyan', '#00e5ff');

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.max(72, Math.min(w, h) * 0.39);

    // Outer subtle dial ring
    g.beginPath();
    g.arc(cx, cy, radius + 18, 0, Math.PI * 2);
    g.fillStyle = bgPanel;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = this.feedbackFlash
      ? this.feedbackFlash.tone === 'good'
        ? '#22C55E'
        : '#EF4444'
      : borderStrong;
    g.stroke();

    // Inner track circle
    g.beginPath();
    g.arc(cx, cy, radius, 0, Math.PI * 2);
    g.strokeStyle = borderStrong;
    g.lineWidth = 1.5;
    g.setLineDash([4, 6]);
    g.stroke();
    g.setLineDash([]);

    // Draw nodes
    for (let i = 0; i < this.totalNodes; i++) {
      const angle = (i / this.totalNodes) * Math.PI * 2 - Math.PI / 2;
      const nx = cx + Math.cos(angle) * radius;
      const ny = cy + Math.sin(angle) * radius;
      const isCurrent = i === this.currentIdx;
      const isSkippedPractice =
        this.ctx.practiceMode && this.activeDoubleJump && i === this.lastSkippedIdx;

      if (isCurrent) {
        // Luminous glow + pointer line
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(nx, ny);
        g.strokeStyle = accentCyan;
        g.lineWidth = 3;
        g.stroke();

        g.beginPath();
        g.arc(nx, ny, 14, 0, Math.PI * 2);
        g.fillStyle = 'rgba(14, 165, 233, 0.22)';
        g.fill();

        g.beginPath();
        g.arc(nx, ny, 8.5, 0, Math.PI * 2);
        g.fillStyle = accentCyan;
        g.fill();
      } else {
        g.beginPath();
        g.arc(nx, ny, 5.5, 0, Math.PI * 2);
        g.fillStyle = isSkippedPractice ? 'rgba(245, 158, 11, 0.35)' : bgPanel;
        g.fill();
        g.lineWidth = isSkippedPractice ? 2 : 1.5;
        g.strokeStyle = isSkippedPractice ? '#F59E0B' : inkMuted;
        g.stroke();
      }
    }

    // Center hub + feedback text
    g.beginPath();
    g.arc(cx, cy, 24, 0, Math.PI * 2);
    g.fillStyle = bgPanel;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = accentCyan;
    g.stroke();

    g.beginPath();
    g.arc(cx, cy, 5, 0, Math.PI * 2);
    g.fillStyle = accentCyan;
    g.fill();

    if (this.feedbackFlash) {
      g.font = '700 13px "Chakra Petch", system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = this.feedbackFlash.tone === 'good' ? '#22C55E' : '#EF4444';
      g.fillText(this.feedbackFlash.text, cx, cy + radius * 0.48);
    } else {
      g.font = '600 11px "JetBrains Mono", monospace';
      g.textAlign = 'center';
      g.fillStyle = inkPrimary;
      g.fillText(`RACHA ${this.combo}`, cx, cy + radius * 0.48);
    }

    g.restore();
  }

  public onResize(): void {
    const wrap = this.canvas?.parentElement;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const side = Math.max(240, Math.min(rect.width || 360, rect.height || 360, 440));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(side * dpr);
    this.canvas.height = Math.round(side * dpr);
    this.canvas.style.width = `${side}px`;
    this.canvas.style.height = `${side}px`;
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
        : 650;
    const perf =
      total === 0
        ? 160
        : Math.max(
            120,
            Math.min(
              990,
              Math.round(280 + this.hits * 42 + acc * 3.1 + Math.max(0, 750 - avgRx) * 0.35 - this.misses * 35)
            )
          );
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy: acc,
      avgReactionMs: avgRx,
      hits: this.hits,
      misses: this.misses,
      puzzlesSolved: this.hits,
      survived,
      axisPerformances: {
        reflex: perf,
        logic: Math.round(perf * 0.82),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.wrapper.remove();
  }
}
