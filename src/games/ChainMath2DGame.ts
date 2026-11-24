import '../styles/neurolab.css';
import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';
import { ChainMathRound, generateChainMathRound } from './neuro/neuroEngines';

type ChainPhase = 'showing' | 'answering' | 'feedback';

export class ChainMath2DGame implements MiniGame {
  public readonly id = 'chainmath2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private boardEl!: HTMLDivElement;

  private level = 1;
  private roundNum = 1;
  private round!: ChainMathRound;
  private phase: ChainPhase = 'showing';
  private showIdx = -1; // -1 = start number, 0..steps.length-1 = operations
  private stepTimer = 0;
  private stepDuration = 1.45;
  private feedbackTimer = 0;
  private feedbackTone: 'good' | 'bad' = 'good';
  private feedbackMsg = '';
  private answerStartedMs = 0;

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
      phaseLabel: 'REACCIÓN EN CADENA',
      accent: '#F59E0B',
      timeLeftSec: this.isGauntletSlice || this.ctx.infiniteMode ? null : this.standaloneDuration,
      subStat: 'CÁLCULO ENCADENADO · NIVEL 1',
    });

    this.startRound();
  }

  private startRound(): void {
    const intensity = this.ctx.getIntensity();
    const baseLvl = Math.max(1, Math.min(10, Math.round(this.level + (intensity - 1) * 2)));
    this.round = generateChainMathRound(baseLvl);
    this.phase = 'showing';
    this.showIdx = -1;
    const baseDur = this.ctx.practiceMode ? 1.85 : 1.45;
    this.stepDuration = Math.max(0.72, baseDur / Math.max(0.75, intensity * 0.94));
    this.stepTimer = this.stepDuration;
    synthAudio.scheduleNoteCue(0);
    this.render();
  }

  private advanceRevealStep(): void {
    if (this.phase !== 'showing') return;
    this.showIdx += 1;
    if (this.showIdx >= this.round.steps.length) {
      this.phase = 'answering';
      this.answerStartedMs = performance.now();
      synthAudio.uiClick();
    } else {
      this.stepTimer = this.stepDuration;
      synthAudio.scheduleNoteCue((this.showIdx + 1) % 4);
    }
    this.render();
  }

  private submitChoice(val: number): void {
    if (this.phase !== 'answering' || this.paused || this.destroyed) return;
    const rx = Math.max(120, Math.round(performance.now() - this.answerStartedMs));
    this.reactionSamples.push(rx);

    if (val === this.round.result) {
      this.hits += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const pts = 200 + this.round.steps.length * 45 + Math.max(0, Math.round((2500 - rx) * 0.06));
      this.score += pts;
      this.ctx.addScore(pts, 1);
      synthAudio.puzzleSuccess(this.combo);

      if (this.combo % 2 === 0 && this.level < 10) {
        this.level += 1;
      }
      this.feedbackTone = 'good';
      this.feedbackMsg = `EXACTO (${this.round.result}) · ${rx} ms`;
    } else {
      this.misses += 1;
      this.combo = 0;
      this.ctx.breakCombo();
      synthAudio.damage();
      this.level = Math.max(1, this.level - 1);
      this.feedbackTone = 'bad';
      this.feedbackMsg = `Era ${this.round.result} · ${this.round.explanation}`;
      if (!this.ctx.practiceMode) {
        const left = this.ctx.damage(1);
        if (left <= 0) {
          this.ctx.finish(this.getMetrics(false));
          return;
        }
      }
    }

    this.roundNum += 1;
    this.phase = 'feedback';
    this.feedbackTimer = this.feedbackTone === 'good' ? 0.72 : 1.45;
    this.updateSubStat();
    this.render();
  }

  private updateSubStat(): void {
    const total = this.hits + this.misses;
    const acc = total > 0 ? Math.round((this.hits / total) * 100) : 100;
    const avg =
      this.reactionSamples.length > 0
        ? Math.round(this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length)
        : 0;
    this.ctx.setHud({
      subStat: `NV ${this.level} · PRECISIÓN ${acc}%${avg ? ` · ${avg} ms` : ''}`,
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed) return;
    if (this.phase === 'showing' && e.code === 'Space' && this.ctx.practiceMode) {
      e.preventDefault();
      this.advanceRevealStep();
      return;
    }
    if (this.phase === 'answering') {
      const map: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
      const idx = map[e.code];
      if (idx !== undefined && this.round.options[idx] !== undefined) {
        e.preventDefault();
        this.submitChoice(this.round.options[idx]);
      }
    }
  };

  private render(): void {
    const totalSteps = this.round.steps.length;
    const dotsHtml = Array.from({ length: totalSteps + 1 }, (_, i) => {
      const done = this.phase !== 'showing' || i - 1 < this.showIdx;
      const active = this.phase === 'showing' && i - 1 === this.showIdx;
      return `<span class="oa-chain-dot ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}"></span>`;
    }).join('');

    let centerHtml = '';
    if (this.phase === 'showing') {
      const isSeed = this.showIdx === -1;
      const token = isSeed ? String(this.round.start) : this.round.steps[this.showIdx].label;
      const label = isSeed
        ? 'NÚMERO INICIAL'
        : `OPERACIÓN ${this.showIdx + 1} DE ${totalSteps}`;
      const pct = Math.max(0, Math.min(100, (this.stepTimer / this.stepDuration) * 100));
      centerHtml = `
        <div class="oa-chain-card">
          <span class="oa-chain-label">${label}</span>
          <div class="oa-chain-token ${isSeed ? 'is-seed' : ''}">${token}</div>
          <div class="oa-nback-timer-wrap"><div class="oa-nback-timer-fill" id="oa-cm-fill" style="width:${pct.toFixed(1)}%"></div></div>
          ${
            this.ctx.practiceMode
              ? `<button type="button" class="oa-btn oa-btn-sm" id="oa-cm-next">Siguiente paso (Espacio)</button>`
              : ''
          }
        </div>
      `;
    } else if (this.phase === 'answering') {
      centerHtml = `
        <div class="oa-chain-card">
          <span class="oa-chain-label">¿CUÁL ES EL RESULTADO FINAL?</span>
          <div class="oa-chain-token is-question">= ?</div>
          <div class="oa-neuro-options-grid">
            ${this.round.options
              .map(
                (opt, i) => `
              <button type="button" class="oa-neuro-opt-btn" data-cm-opt="${opt}">
                <kbd>${i + 1}</kbd>
                <strong>${opt}</strong>
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      `;
    } else {
      centerHtml = `
        <div class="oa-chain-card is-feedback-${this.feedbackTone}">
          <span class="oa-chain-label">${this.feedbackTone === 'good' ? 'CORRECTO' : 'REVISIÓN'}</span>
          <div class="oa-chain-feedback">${this.feedbackMsg}</div>
        </div>
      `;
    }

    this.boardEl.innerHTML = `
      <div class="oa-mem-head">
        <span class="oa-mem-pill">CADENA #${this.roundNum} · ${totalSteps} PASOS · NV ${this.level}</span>
        <div class="oa-chain-dots" aria-label="Progreso de cadena">${dotsHtml}</div>
      </div>
      ${centerHtml}
    `;

    this.boardEl.querySelector('#oa-cm-next')?.addEventListener('click', () => this.advanceRevealStep());
    this.boardEl.querySelectorAll<HTMLButtonElement>('[data-cm-opt]').forEach((btn) => {
      btn.addEventListener('click', () => this.submitChoice(Number(btn.dataset.cmOpt)));
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
        return;
      }
    }

    if (this.phase === 'showing') {
      this.stepTimer -= dt;
      const fill = this.boardEl.querySelector<HTMLDivElement>('#oa-cm-fill');
      if (fill) {
        fill.style.width = `${Math.max(0, Math.min(100, (this.stepTimer / this.stepDuration) * 100)).toFixed(1)}%`;
      }
      if (this.stepTimer <= 0) {
        this.advanceRevealStep();
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
        : 1200;
    const perf =
      total === 0
        ? 160
        : Math.max(
            120,
            Math.min(
              990,
              Math.round(250 + this.hits * 48 + this.level * 26 + acc * 2.4 - this.misses * 35)
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
