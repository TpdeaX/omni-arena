import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

export class MemoryGrid2DGame implements MiniGame {
  public readonly id = 'memory2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private boardEl!: HTMLDivElement;

  private gridSize = 3;
  private targetCells = new Set<number>();
  private trapCells = new Set<number>();
  private revealedCells = new Set<number>();
  private wrongCell: number | null = null;
  private phase: 'memorize' | 'recall' | 'reveal' = 'memorize';
  private phaseTimer = 1.2;

  private round = 1;
  private hits = 0;
  private misses = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;

  private elapsed = 0;
  private readonly standaloneDuration = 55;
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
      phaseLabel: 'MEMORIA RELÁMPAGO',
      accent: '#8B5CF6',
      timeLeftSec: this.isGauntletSlice || this.ctx.infiniteMode ? null : this.standaloneDuration,
      subStat: 'RONDA 1 · PATRÓN 3×3',
    });

    this.startRound();
  }

  private startRound(): void {
    const intensity = this.ctx.getIntensity();
    const escalate6 = this.ctx.infiniteMode || this.ctx.difficulty === 'progressive';
    if (escalate6) {
      this.gridSize =
        this.round <= 2
          ? 3
          : this.round <= 5
          ? 4
          : this.round <= 9 && intensity < 1.65
          ? 5
          : 6;
    } else {
      this.gridSize = this.round <= 2 ? 3 : this.round <= 6 ? 4 : this.round <= 10 ? 5 : 6;
    }
    const total = this.gridSize * this.gridSize;
    const targetCount = Math.min(Math.min(total - 4, 14), 3 + Math.floor(this.round / 2));
    const trapCount = this.round >= 3 ? Math.min(5, Math.floor((this.round - 1) / 2)) : 0;

    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    this.targetCells = new Set(indices.slice(0, targetCount));
    this.trapCells = new Set(indices.slice(targetCount, targetCount + trapCount));
    this.revealedCells = new Set();
    this.wrongCell = null;
    this.phase = 'memorize';
    this.phaseTimer = Math.max(
      0.85,
      (1.55 + targetCount * 0.14) / Math.max(0.8, Math.min(1.85, intensity))
    );

    this.renderBoard();
  }

  private renderBoard(): void {
    const total = this.gridSize * this.gridSize;
    const statusText =
      this.phase === 'memorize'
        ? 'MEMORIZA LOS NODOS VIOLETA (EVITA LOS ROJOS)'
        : this.phase === 'reveal'
        ? 'SOLUCIÓN DEL PATRÓN (BORDE VERDE = OBJETIVO)'
        : `REPRODUCE EL PATRÓN (${this.revealedCells.size}/${this.targetCells.size})`;

    const inputLocked = this.phase !== 'recall';

    this.boardEl.innerHTML = `
      <div class="oa-mem-head">
        <span class="oa-mem-pill">RONDA ${this.round} · ${this.gridSize}×${this.gridSize}</span>
        <span class="oa-mem-status">${statusText}</span>
      </div>
      <div class="oa-mem-grid" style="grid-template-columns: repeat(${this.gridSize}, minmax(0, 1fr));${
        this.gridSize >= 6 ? 'gap:6px;' : ''
      }">
        ${Array.from({ length: total }, (_, idx) => {
          const isTarget = this.targetCells.has(idx);
          const isTrap = this.trapCells.has(idx);
          const isFound = this.revealedCells.has(idx);
          let cls = 'oa-mem-cell';
          if (this.phase === 'memorize') {
            if (isTarget) cls += ' is-target';
            else if (isTrap) cls += ' is-trap';
          } else if (this.phase === 'reveal') {
            if (idx === this.wrongCell) cls += ' is-wrong';
            else if (isTarget) cls += ' is-reveal-target';
          } else if (isFound) {
            cls += ' is-found';
          }
          return `<button type="button" class="${cls}" data-cell="${idx}" ${inputLocked ? 'disabled' : ''}></button>`;
        }).join('')}
      </div>
    `;

    if (this.phase === 'recall') {
      this.boardEl.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (this.paused || this.destroyed || this.phase !== 'recall') return;
          const idx = Number(btn.dataset.cell);
          if (this.revealedCells.has(idx)) return;

          if (this.targetCells.has(idx)) {
            this.revealedCells.add(idx);
            this.hits += 1;
            this.combo += 1;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            this.score += 75;
            this.ctx.addScore(75, 1);
            synthAudio.puzzleSuccess(this.combo);

            if (this.revealedCells.size >= this.targetCells.size) {
              this.score += 180;
              this.ctx.addScore(180, 1);
              this.round += 1;
              this.ctx.toast(`PATRÓN COMPLETADO`, 'good');
              this.startRound();
              return;
            }
            this.renderBoard();
          } else {
            this.misses += 1;
            this.combo = 0;
            this.ctx.breakCombo();
            synthAudio.damage();
            const left = this.ctx.damage(1);
            if (left <= 0) {
              this.ctx.finish(this.getMetrics(false));
              return;
            }
            this.wrongCell = idx;
            this.phase = 'reveal';
            this.phaseTimer = 1.1;
            this.renderBoard();
          }
        });
      });
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

    if (this.phase === 'memorize') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'recall';
        this.renderBoard();
      }
    } else if (this.phase === 'reveal') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.round = Math.max(1, this.round);
        this.startRound();
      }
    }

    this.ctx.setHud({
      subStat: `RONDA ${this.round} · ACIERTOS ${this.hits}`,
    });
  }

  public onResize(): void {}

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getMetrics(
    survived = true
  ): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const total = this.hits + this.misses;
    const accuracy = total > 0 ? (this.hits / total) * 100 : 0;
    const logicScore =
      total === 0
        ? 140
        : Math.min(980, 260 + this.hits * 26 + this.round * 45 - this.misses * 40);
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy,
      hits: this.hits,
      misses: this.misses,
      puzzlesSolved: this.round - 1,
      survived,
      axisPerformances: {
        logic: Math.max(120, logicScore),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    this.wrapper.remove();
  }
}
