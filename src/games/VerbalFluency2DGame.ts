import '../styles/neurolab.css';
import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';
import { generateVerbalRound, VerbalRound } from './neuro/neuroEngines';

const MECHANIC_ORDER: VerbalRound['kind'][] = ['classify', 'semantic', 'chain'];

export class VerbalFluency2DGame implements MiniGame {
  public readonly id = 'verbal2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private boardEl!: HTMLDivElement;

  private roundNum = 1;
  private round!: VerbalRound;
  private roundStartMs = 0;
  private feedbackText = 'Responde con rapidez y precisión léxica';
  private feedbackTone: 'neutral' | 'good' | 'bad' = 'neutral';

  private hits = 0;
  private misses = 0;
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
    this.wrapper.className = 'oa-stage oa-stage-puzzle';
    this.boardEl = document.createElement('div');
    this.boardEl.className = 'oa-puzzle-board oa-neuro-board';
    this.wrapper.appendChild(this.boardEl);
    this.ctx.container.appendChild(this.wrapper);

    window.addEventListener('keydown', this.onKeyDown);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'FLUIDEZ VERBAL',
      accent: '#8B5CF6',
      timeLeftSec: this.isGauntletSlice || this.ctx.infiniteMode ? null : this.standaloneDuration,
      subStat: 'CLASIFICACIÓN · SEMÁNTICA · CADENAS',
    });

    this.nextRound();
  }

  private nextRound(): void {
    // Rotate mechanics every 2 rounds so all 3 verbal agility dimensions are exercised
    const mechanicIdx = Math.floor((this.roundNum - 1) / 2) % MECHANIC_ORDER.length;
    this.round = generateVerbalRound(MECHANIC_ORDER[mechanicIdx]);
    this.roundStartMs = performance.now();
    this.render();
  }

  private submit(optionId: string): void {
    if (this.paused || this.destroyed) return;
    const rx = Math.max(120, Math.round(performance.now() - this.roundStartMs));
    this.reactionSamples.push(rx);

    if (optionId === this.round.correctId) {
      this.hits += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const speedBonus = Math.max(0, Math.round((1500 - rx) * 0.1));
      const pts = 155 + speedBonus;
      this.score += pts;
      this.ctx.addScore(pts, 1);
      synthAudio.hitmarker(this.combo);
      this.feedbackTone = 'good';
      this.feedbackText = `${this.round.explanation} · ${rx} ms (+${pts})`;
    } else {
      this.misses += 1;
      this.combo = 0;
      this.ctx.breakCombo();
      synthAudio.damage();
      this.feedbackTone = 'bad';
      this.feedbackText = `Incorrecto: ${this.round.explanation}`;
      if (!this.ctx.practiceMode) {
        const left = this.ctx.damage(1);
        if (left <= 0) {
          this.ctx.finish(this.getMetrics(false));
          return;
        }
      }
    }

    this.roundNum += 1;
    const total = this.hits + this.misses;
    const acc = total > 0 ? Math.round((this.hits / total) * 100) : 100;
    const avg = Math.round(this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length);
    this.ctx.setHud({
      subStat: `PREC ${acc}% · MEDIA ${avg} ms · ACIERTOS ${this.hits}`,
    });

    this.nextRound();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed) return;
    if (this.round.kind === 'classify') {
      if (e.code === 'ArrowLeft' || e.key === 's' || e.key === 'S' || e.code === 'Digit1') {
        e.preventDefault();
        this.submit('yes');
        return;
      }
      if (e.code === 'ArrowRight' || e.key === 'n' || e.key === 'N' || e.code === 'Digit2') {
        e.preventDefault();
        this.submit('no');
        return;
      }
    }
    const map: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
    const idx = map[e.code];
    if (idx !== undefined && this.round.options[idx]) {
      e.preventDefault();
      this.submit(this.round.options[idx].id);
    }
  };

  private render(): void {
    const isBinary = this.round.kind === 'classify';
    this.boardEl.innerHTML = `
      <div class="oa-mem-head">
        <span class="oa-mem-pill">${this.round.badge} · RONDA ${this.roundNum}</span>
        <span class="oa-mem-status">${this.round.prompt}</span>
      </div>

      <div class="oa-verbal-card">
        <div class="oa-verbal-word">${this.round.stimulus}</div>
      </div>

      <div class="oa-craze-feedback is-${this.feedbackTone}">${this.feedbackText}</div>

      <div class="oa-neuro-options-grid ${isBinary ? 'is-binary' : ''}">
        ${this.round.options
          .map(
            (opt, i) => `
          <button type="button" class="oa-neuro-opt-btn ${
            isBinary ? (opt.id === 'yes' ? 'is-yes' : 'is-no') : ''
          }" data-vb-opt="${opt.id}">
            <kbd>${isBinary ? (opt.id === 'yes' ? 'Izq / 1' : 'Der / 2') : i + 1}</kbd>
            <strong>${opt.label}</strong>
          </button>
        `
          )
          .join('')}
      </div>
    `;

    this.boardEl.querySelectorAll<HTMLButtonElement>('[data-vb-opt]').forEach((btn) => {
      btn.addEventListener('click', () => this.submit(btn.dataset.vbOpt!));
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
        : 1050;
    const perf =
      total === 0
        ? 160
        : Math.max(
            120,
            Math.min(
              990,
              Math.round(250 + this.hits * 22 + acc * 2.6 + Math.max(0, 1400 - avgRx) * 0.2 - this.misses * 25)
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
        logic: perf,
        reflex: Math.round(perf * 0.8),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.wrapper.remove();
  }
}
