import '../styles/neurolab.css';
import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';
import {
  generateSymbolSpeedRound,
  renderSymbolSvg,
  SymbolSpeedRound,
} from './neuro/neuroEngines';

export class SymbolSpeed2DGame implements MiniGame {
  public readonly id = 'symbolspeed2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private boardEl!: HTMLDivElement;

  private roundNum = 1;
  private round!: SymbolSpeedRound;
  private roundStartMs = 0;
  private feedbackText = 'Encuentra el símbolo idéntico o pulsa Ninguno';
  private feedbackTone: 'neutral' | 'good' | 'bad' = 'neutral';

  private hits = 0;
  private misses = 0;
  private reactionSamples: number[] = [];
  private combo = 0;
  private maxCombo = 0;
  private score = 0;

  private elapsed = 0;
  private readonly standaloneDuration = 60;
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
      phaseLabel: 'VELOCIDAD DE SÍMBOLOS',
      accent: '#06B6D4',
      timeLeftSec: this.isGauntletSlice || this.ctx.infiniteMode ? null : this.standaloneDuration,
      subStat: 'VELOCIDAD DE PROCESAMIENTO WAIS',
    });

    this.nextRound();
  }

  private nextRound(): void {
    const intensity = this.ctx.getIntensity();
    const isFusion = this.roundNum % 3 === 0;
    const candCount = intensity >= 1.25 || this.roundNum >= 8 ? 6 : 5;
    this.round = generateSymbolSpeedRound(isFusion ? 'fusion' : 'match', candCount);
    this.roundStartMs = performance.now();
    this.render();
  }

  private submitChoice(choiceIdx: number): void {
    if (this.paused || this.destroyed) return;
    const rx = Math.max(110, Math.round(performance.now() - this.roundStartMs));
    this.reactionSamples.push(rx);

    if (choiceIdx === this.round.matchIndex) {
      this.hits += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const speedBonus = Math.max(0, Math.round((1300 - rx) * 0.14));
      const pts = (this.round.mode === 'fusion' ? 190 : 145) + speedBonus;
      this.score += pts;
      this.ctx.addScore(pts, 1);
      synthAudio.hitmarker(this.combo);
      this.feedbackTone = 'good';
      this.feedbackText =
        choiceIdx === -1
          ? `CORRECTO (SIN COINCIDENCIA) · ${rx} ms (+${pts})`
          : `EXACTO · ${rx} ms (+${pts})`;
    } else {
      this.misses += 1;
      this.combo = 0;
      this.ctx.breakCombo();
      synthAudio.damage();
      this.feedbackTone = 'bad';
      this.feedbackText =
        this.round.matchIndex === -1
          ? 'Ningún candidato coincidía (debías pulsar Ninguno)'
          : `La coincidencia exacta era la opción #${this.round.matchIndex + 1}`;
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
    if ((e.code === 'Digit0' || e.code === 'Space') && this.round.mode === 'match') {
      e.preventDefault();
      this.submitChoice(-1);
      return;
    }
    const map: Record<string, number> = {
      Digit1: 0,
      Digit2: 1,
      Digit3: 2,
      Digit4: 3,
      Digit5: 4,
      Digit6: 5,
    };
    const idx = map[e.code];
    if (idx !== undefined && idx < this.round.candidates.length) {
      e.preventDefault();
      this.submitChoice(idx);
    }
  };

  private render(): void {
    const isFusion = this.round.mode === 'fusion';
    const targetBlock = isFusion
      ? `
        <div class="oa-sym-targets">
          <div class="oa-sym-target-card">${renderSymbolSvg(this.round.targets[0], 60, 'outer', '#06B6D4')}</div>
          <span class="oa-sym-plus">+</span>
          <div class="oa-sym-target-card">${renderSymbolSvg(this.round.targets[0], 60, 'inner', '#06B6D4')}</div>
        </div>
      `
      : `
        <div class="oa-sym-targets">
          ${this.round.targets
            .map((t) => `<div class="oa-sym-target-card">${renderSymbolSvg(t, 60, 'full', '#06B6D4')}</div>`)
            .join('')}
        </div>
      `;

    this.boardEl.innerHTML = `
      <div class="oa-mem-head">
        <span class="oa-mem-pill">${isFusion ? 'FUSIÓN DE FORMAS' : 'EMPAREJAMIENTO WAIS'} · RONDA ${this.roundNum}</span>
        <span class="oa-mem-status">${
          isFusion ? 'Une mentalmente las 2 piezas superiores' : '¿Alguno de arriba aparece abajo?'
        }</span>
      </div>

      ${targetBlock}

      <div class="oa-craze-feedback is-${this.feedbackTone}">${this.feedbackText}</div>

      <div class="oa-sym-candidates" style="grid-template-columns: repeat(${this.round.candidates.length}, minmax(0, 1fr));">
        ${this.round.candidates
          .map(
            (cand, i) => `
          <button type="button" class="oa-sym-cand-btn" data-sym-idx="${i}" aria-label="Candidato ${i + 1}">
            <kbd>${i + 1}</kbd>
            ${renderSymbolSvg(cand, 56, 'full', 'currentColor')}
          </button>
        `
          )
          .join('')}
      </div>

      ${
        !isFusion
          ? `<button type="button" class="oa-neuro-inhibit-btn oa-sym-none-btn" id="oa-sym-none">
               <strong>NINGUNO COINCIDE</strong>
               <span>Pulsa 0 o Espacio</span>
             </button>`
          : ''
      }
    `;

    this.boardEl.querySelectorAll<HTMLButtonElement>('[data-sym-idx]').forEach((btn) => {
      btn.addEventListener('click', () => this.submitChoice(Number(btn.dataset.symIdx)));
    });
    this.boardEl.querySelector('#oa-sym-none')?.addEventListener('click', () => this.submitChoice(-1));
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
        : 980;
    const perf =
      total === 0
        ? 160
        : Math.max(
            120,
            Math.min(
              990,
              Math.round(240 + this.hits * 22 + acc * 2.7 + Math.max(0, 1200 - avgRx) * 0.25 - this.misses * 28)
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
        logic: Math.round(perf * 0.85),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.wrapper.remove();
  }
}
