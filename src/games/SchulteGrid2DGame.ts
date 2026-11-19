import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

export class SchulteGrid2DGame implements MiniGame {
  public readonly id = 'schulte2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private boardEl!: HTMLDivElement;

  private gridSize = 4;
  private values: number[] = [];
  private nextExpected = 1;
  private round = 1;
  private roundStartMs = 0;

  private hits = 0;
  private misses = 0;
  private reactionSamples: number[] = [];
  private boardsCleared = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;

  private elapsed = 0;
  private readonly standaloneDuration = 60;
  private isGauntletSlice = false;
  private paused = false;
  private destroyed = false;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'oa-stage oa-stage-puzzle';
    this.boardEl = document.createElement('div');
    this.boardEl.className = 'oa-puzzle-board';
    this.wrapper.appendChild(this.boardEl);
    this.ctx.container.appendChild(this.wrapper);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'TABLA SCHULTE PRO',
      accent: '#0EA5E9',
      timeLeftSec: this.isGauntletSlice || this.ctx.infiniteMode ? null : this.standaloneDuration,
      subStat: 'BUSCA EL NÚMERO 1 · VISIÓN PERIFÉRICA',
    });

    this.startRound();
  }

  private startRound(): void {
    const intensity = this.ctx.getIntensity();
    const escalate6 = this.ctx.infiniteMode || this.ctx.difficulty === 'progressive';
    if (escalate6) {
      this.gridSize =
        this.round >= 4 || intensity >= 1.65
          ? 6
          : this.round >= 2 || intensity >= 1.25
          ? 5
          : 4;
    } else {
      this.gridSize =
        this.round >= 5
          ? 6
          : this.round >= 3 || intensity >= 1.28
          ? 5
          : 4;
    }
    const total = this.gridSize * this.gridSize;
    this.values = Array.from({ length: total }, (_, i) => i + 1);
    for (let i = this.values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.values[i], this.values[j]] = [this.values[j], this.values[i]];
    }
    this.nextExpected = 1;
    this.roundStartMs = performance.now();
    this.renderBoard();
  }

  private renderBoard(): void {
    const total = this.values.length;
    const centerIdx = Math.floor(total / 2);
    this.boardEl.innerHTML = `
      <div class="oa-mem-head">
        <span class="oa-mem-pill">TABLA ${this.gridSize}×${this.gridSize} · RONDA ${this.round}</span>
        <span class="oa-mem-status">SIGUIENTE NÚMERO: <strong>${this.nextExpected}</strong> / ${total}</span>
      </div>
      <div class="oa-schulte-grid" style="grid-template-columns: repeat(${this.gridSize}, minmax(0, 1fr));${
        this.gridSize >= 6 ? 'gap:6px;' : ''
      }">
        ${this.values
          .map((val, idx) => {
            const done = val < this.nextExpected;
            const isCenter = idx === centerIdx;
            return `<button type="button" class="oa-schulte-cell ${done ? 'is-done' : ''} ${isCenter ? 'is-center' : ''}" data-val="${val}" ${done ? 'disabled' : ''}>${val}</button>`;
          })
          .join('')}
      </div>
    `;

    this.boardEl.querySelectorAll<HTMLButtonElement>('[data-val]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.paused || this.destroyed) return;
        const val = Number(btn.dataset.val);
        if (val === this.nextExpected) {
          const now = performance.now();
          this.reactionSamples.push(now - this.roundStartMs);
          this.roundStartMs = now;

          this.hits += 1;
          this.combo += 1;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          const pts = 70 + Math.min(90, this.combo * 5);
          this.score += pts;
          this.ctx.addScore(pts, 1);
          synthAudio.hitmarker(Math.min(18, this.combo));

          this.nextExpected += 1;
          if (this.nextExpected > total) {
            this.boardsCleared += 1;
            this.round += 1;
            const bonus = 450;
            this.score += bonus;
            this.ctx.addScore(bonus, 2);
            synthAudio.puzzleSuccess(this.boardsCleared);
            this.ctx.toast(`TABLA ${this.gridSize}×${this.gridSize} COMPLETADA +${bonus}`, 'good');
            this.startRound();
          } else {
            this.ctx.setHud({ subStat: `SIGUIENTE ${this.nextExpected}/${total} · TABLAS ${this.boardsCleared}` });
            this.renderBoard();
          }
        } else {
          this.misses += 1;
          this.combo = 0;
          this.ctx.breakCombo();
          synthAudio.damage();
          btn.classList.add('is-wrong');
          window.setTimeout(() => btn.classList.remove('is-wrong'), 260);
          const errStep = this.ctx.infiniteMode && !this.isGauntletSlice ? 2 : 3;
          if (this.misses % errStep === 0) {
            this.ctx.toast('ERRORES ACUMULADOS -1 ESCUDO', 'bad');
            const left = this.ctx.damage(1);
            if (left <= 0) {
              this.ctx.finish(this.getMetrics(false));
            }
          }
        }
      });
    });
  }

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;

    if (!this.isGauntletSlice && !this.ctx.infiniteMode) {
      const left = Math.max(0, this.standaloneDuration - this.elapsed);
      this.ctx.setHud({ timeLeftSec: left });
      if (left <= 0) {
        this.ctx.finish(this.getMetrics(true));
      }
    }
  }

  public onResize(): void {
    // Responsive CSS grid
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getMetrics(survived = true): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const total = this.hits + this.misses;
    const acc = total > 0 ? (this.hits / total) * 100 : 0;
    const avgRx =
      this.reactionSamples.length > 0
        ? this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length
        : 900;
    const logicScore =
      total === 0
        ? 140
        : Math.min(
            980,
            260 +
              this.hits * 16 +
              this.boardsCleared * 110 +
              Math.max(0, 950 - avgRx) * 0.25 -
              this.misses * 20
          );
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy: acc,
      avgReactionMs: Math.round(avgRx),
      hits: this.hits,
      misses: this.misses,
      puzzlesSolved: this.boardsCleared,
      survived,
      axisPerformances: {
        logic: Math.max(120, Math.round(logicScore)),
        aim: Math.max(120, Math.round(logicScore * 0.85)),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    this.wrapper.remove();
  }
}
