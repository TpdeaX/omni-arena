import '../styles/neurolab.css';
import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';
import { generatePathfinderRound, PathfinderRound } from './neuro/neuroEngines';

type PathPhase = 'showing' | 'input' | 'feedback';

export class Pathfinder2DGame implements MiniGame {
  public readonly id = 'pathfinder2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private boardEl!: HTMLDivElement;

  private roundNum = 1;
  private span = 4;
  private maxSpanCleared = 0;
  private round!: PathfinderRound;
  private phase: PathPhase = 'showing';
  private showCursor = 0;
  private showTimer = 0;
  private showStepDur = 0.62;
  private activeDistractor: number | null = null;
  private feedbackTimer = 0;
  private feedbackTone: 'good' | 'bad' = 'good';
  private feedbackMsg = '';

  private entered: number[] = [];
  private lastTapMs = 0;

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
    this.wrapper.className = 'oa-stage oa-stage-puzzle';
    this.boardEl = document.createElement('div');
    this.boardEl.className = 'oa-puzzle-board oa-neuro-board';
    this.wrapper.appendChild(this.boardEl);
    this.ctx.container.appendChild(this.wrapper);

    window.addEventListener('keydown', this.onKeyDown);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'BUSCADOR DE RUTAS',
      accent: '#6366F1',
      timeLeftSec: this.isGauntletSlice || this.ctx.infiniteMode ? null : this.standaloneDuration,
      subStat: 'CORSI DIRECTO E INVERSO · SPAN 4',
    });

    this.startRound();
  }

  private startRound(): void {
    const intensity = this.ctx.getIntensity();
    const gridSize: 4 | 5 = this.roundNum >= 4 || intensity >= 1.28 ? 5 : 4;
    const reverse = this.roundNum % 2 === 0;
    const distractors = this.roundNum >= 3 || intensity >= 1.2 ? Math.min(2, Math.floor(this.roundNum / 3)) : 0;

    this.round = generatePathfinderRound(gridSize, this.span, reverse, distractors);
    this.entered = [];
    this.phase = 'showing';
    this.showCursor = 0;
    this.activeDistractor = null;
    this.showStepDur = Math.max(0.38, (this.ctx.practiceMode ? 0.72 : 0.6) / Math.max(0.8, intensity * 0.94));
    this.showTimer = this.showStepDur;
    synthAudio.scheduleNoteCue(0);
    this.render();
  }

  private replaySequence(): void {
    if (!this.ctx.practiceMode || this.phase !== 'input') return;
    this.entered = [];
    this.phase = 'showing';
    this.showCursor = 0;
    this.showTimer = this.showStepDur;
    this.render();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed) return;
    if ((e.key === 'r' || e.key === 'R') && this.ctx.practiceMode && this.phase === 'input') {
      e.preventDefault();
      this.replaySequence();
    }
  };

  private handleCellClick(cellIdx: number): void {
    if (this.paused || this.destroyed || this.phase !== 'input') return;
    if (this.entered.includes(cellIdx)) return;

    const now = performance.now();
    this.reactionSamples.push(Math.max(100, Math.round(now - this.lastTapMs)));
    this.lastTapMs = now;

    const expectedIdx = this.round.expected[this.entered.length];
    if (cellIdx === expectedIdx) {
      this.entered.push(cellIdx);
      this.hits += 1;
      synthAudio.hitmarker(this.entered.length);

      if (this.entered.length >= this.round.expected.length) {
        this.roundsCleared += 1;
        this.maxSpanCleared = Math.max(this.maxSpanCleared, this.round.path.length);
        this.combo += 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        const pts = 220 + this.round.path.length * 55 + (this.round.reverse ? 90 : 0);
        this.score += pts;
        this.ctx.addScore(pts, 2);
        synthAudio.puzzleSuccess(this.combo);

        this.roundNum += 1;
        if (this.roundNum % 2 === 1 && this.span < 9) {
          this.span += 1;
        }
        this.feedbackTone = 'good';
        this.feedbackMsg = `RUTA ${this.round.reverse ? 'INVERSA' : 'DIRECTA'} PERFECTA (+${pts})`;
        this.phase = 'feedback';
        this.feedbackTimer = 0.9;
        this.updateSubStat();
      }
      this.render();
    } else {
      this.misses += 1;
      this.combo = 0;
      this.ctx.breakCombo();
      synthAudio.damage();
      this.span = Math.max(4, this.span - 1);
      this.feedbackTone = 'bad';
      this.feedbackMsg = `Nodo incorrecto · recuerda: ${this.round.reverse ? 'del último al primero' : 'del primero al último'}`;
      this.phase = 'feedback';
      this.feedbackTimer = 1.35;
      this.updateSubStat();

      if (!this.ctx.practiceMode) {
        const left = this.ctx.damage(1);
        if (left <= 0) {
          this.ctx.finish(this.getMetrics(false));
          return;
        }
      }
      this.render();
    }
  }

  private updateSubStat(): void {
    const total = this.hits + this.misses;
    const acc = total > 0 ? Math.round((this.hits / total) * 100) : 100;
    this.ctx.setHud({
      subStat: `SPAN ${this.span} · ${this.round.reverse ? 'INVERSO' : 'DIRECTO'} · PREC ${acc}%`,
    });
  }

  private render(): void {
    const gSize = this.round.gridSize;
    const totalCells = gSize * gSize;
    const currentLitNode =
      this.phase === 'showing' && this.showCursor < this.round.path.length
        ? this.round.path[this.showCursor]
        : -1;
    const revealedTrail =
      this.phase === 'showing'
        ? new Set(this.round.path.slice(0, this.showCursor + 1))
        : new Set<number>();

    const modeBadge = this.round.reverse ? 'ORDEN INVERSO (FIN -> INICIO)' : 'ORDEN DIRECTO (INICIO -> FIN)';
    const statusLine =
      this.phase === 'showing'
        ? `Memorizando paso ${Math.min(this.showCursor + 1, this.round.path.length)}/${this.round.path.length}...`
        : this.phase === 'input'
        ? `Tu turno: ${this.entered.length}/${this.round.expected.length} nodos (${this.round.reverse ? 'al revés' : 'en orden'})`
        : this.feedbackMsg;

    this.boardEl.innerHTML = `
      <div class="oa-mem-head">
        <span class="oa-mem-pill ${this.round.reverse ? 'is-warn' : ''}">${modeBadge}</span>
        <span class="oa-mem-status">${statusLine}</span>
      </div>
      <div class="oa-path-grid" style="grid-template-columns: repeat(${gSize}, minmax(0, 1fr));">
        ${Array.from({ length: totalCells }, (_, idx) => {
          const isLit = idx === currentLitNode;
          const isTrail = revealedTrail.has(idx) && !isLit;
          const isDistractor = this.phase === 'showing' && this.activeDistractor === idx;
          const pickedOrder = this.entered.indexOf(idx);
          const isPicked = pickedOrder >= 0;
          const showRevealNum =
            this.phase === 'feedback' && this.feedbackTone === 'bad'
              ? this.round.expected.indexOf(idx)
              : -1;

          const cls = [
            'oa-path-cell',
            isLit ? 'is-lit' : '',
            isTrail ? 'is-trail' : '',
            isDistractor ? 'is-distractor' : '',
            isPicked ? 'is-picked' : '',
            showRevealNum >= 0 ? 'is-reveal' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const label = isLit
            ? String(this.showCursor + 1)
            : isPicked
            ? String(pickedOrder + 1)
            : showRevealNum >= 0
            ? String(showRevealNum + 1)
            : isDistractor
            ? 'X'
            : '';

          return `<button type="button" class="${cls}" data-pf-cell="${idx}" ${
            this.phase !== 'input' ? 'disabled' : ''
          }>${label}</button>`;
        }).join('')}
      </div>
      ${
        this.ctx.practiceMode && this.phase === 'input'
          ? `<div class="oa-neuro-foot-row"><button type="button" class="oa-btn oa-btn-sm" id="oa-pf-replay">Repetir secuencia (R)</button></div>`
          : ''
      }
    `;

    this.boardEl.querySelectorAll<HTMLButtonElement>('[data-pf-cell]').forEach((btn) => {
      btn.addEventListener('click', () => this.handleCellClick(Number(btn.dataset.pfCell)));
    });
    this.boardEl.querySelector('#oa-pf-replay')?.addEventListener('click', () => this.replaySequence());
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

    if (this.phase === 'showing') {
      this.showTimer -= dt;
      if (this.showTimer <= 0) {
        this.showCursor += 1;
        if (this.showCursor >= this.round.path.length) {
          this.phase = 'input';
          this.activeDistractor = null;
          this.lastTapMs = performance.now();
          synthAudio.uiClick();
          this.render();
        } else {
          this.showTimer = this.showStepDur;
          this.activeDistractor =
            this.round.distractors.length > 0 && this.showCursor === 2
              ? this.round.distractors[0]
              : null;
          synthAudio.scheduleNoteCue(this.showCursor % 4);
          this.render();
        }
      }
    } else if (this.phase === 'feedback') {
      this.feedbackTimer -= dt;
      if (this.feedbackTimer <= 0) {
        this.startRound();
      }
    }
  }

  public onResize(): void {}

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
              Math.round(250 + this.roundsCleared * 95 + this.maxSpanCleared * 34 + acc * 2.1 - this.misses * 35)
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
        logic: perf,
        agility: Math.round(perf * 0.8),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.wrapper.remove();
  }
}
