import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

interface NBackStep {
  pos: number; // 0..8
  tone: number; // 0..3
}

const TONE_LABELS = ['DO', 'MI', 'SOL', 'SI'];
const TONE_COLORS = ['#38BDF8', '#A855F7', '#10B981', '#F59E0B'];

export class DualNBack2DGame implements MiniGame {
  public readonly id = 'nback2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private boardEl!: HTMLDivElement;

  private nLevel = 1;
  private history: NBackStep[] = [];
  private stepTimer = 0.4;
  private stepDuration = 2.15;
  private flashElapsed = 0;

  private pressedPos = false;
  private pressedSound = false;
  private stepEvaluated = true;
  private feedbackText = 'MEMORIZA EL PRIMER ESTÍMULO';

  private hits = 0;
  private misses = 0;
  private puzzlesSolved = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;

  private elapsed = 0;
  private readonly standaloneDuration = 65;
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

    window.addEventListener('keydown', this.onKeyDown);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'N-BACK CUÁNTICO',
      accent: '#7C3AED',
      timeLeftSec: this.isGauntletSlice ? null : this.standaloneDuration,
      subStat: '1-BACK · MEMORIA DE TRABAJO',
    });

    this.advanceStep();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed) return;
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
      e.preventDefault();
      this.toggleChoice('pos');
    } else if (e.key === 'l' || e.key === 'L' || e.key === 'ArrowRight') {
      e.preventDefault();
      this.toggleChoice('sound');
    } else if (e.code === 'Space') {
      e.preventDefault();
      this.confirmNoMatch();
    }
  };

  private toggleChoice(kind: 'pos' | 'sound'): void {
    if (this.history.length <= this.nLevel || this.stepEvaluated) return;
    if (kind === 'pos') {
      this.pressedPos = !this.pressedPos;
    } else {
      this.pressedSound = !this.pressedSound;
    }
    synthAudio.uiClick();
    this.renderBoard();
  }

  private confirmNoMatch(): void {
    if (this.history.length <= this.nLevel || this.stepEvaluated) return;
    this.pressedPos = false;
    this.pressedSound = false;
    synthAudio.uiClick();
    this.advanceStep();
  }

  private evaluateCurrentStep(): void {
    if (this.stepEvaluated || this.history.length <= this.nLevel) {
      this.stepEvaluated = true;
      return;
    }
    this.stepEvaluated = true;

    const curr = this.history[this.history.length - 1];
    const target = this.history[this.history.length - 1 - this.nLevel];
    const matchPos = curr.pos === target.pos;
    const matchSound = curr.tone === target.tone;

    let stepErrors = 0;
    let stepHits = 0;

    if (matchPos) {
      if (this.pressedPos) stepHits += 1;
      else stepErrors += 1;
    } else if (this.pressedPos) {
      stepErrors += 1;
    }

    if (matchSound) {
      if (this.pressedSound) stepHits += 1;
      else stepErrors += 1;
    } else if (this.pressedSound) {
      stepErrors += 1;
    }

    if (stepErrors === 0) {
      this.hits += Math.max(1, stepHits);
      this.puzzlesSolved += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const pts = (stepHits > 0 ? 180 : 85) * this.nLevel;
      this.score += pts;
      this.ctx.addScore(pts, 1);
      if (stepHits > 0) synthAudio.puzzleSuccess(this.combo);

      this.feedbackText =
        stepHits > 0 ? `COINCIDENCIA EXACTA +${pts}` : `RECHAZO CORRECTO +${pts}`;

      const maxN = this.isGauntletSlice ? 2 : 3;
      if (this.combo > 0 && this.combo % 5 === 0 && this.nLevel < maxN) {
        this.nLevel += 1;
        this.ctx.toast(`NIVEL COGNITIVO ${this.nLevel}-BACK`, 'accent');
      }
    } else {
      this.misses += stepErrors;
      this.combo = 0;
      this.ctx.breakCombo();
      synthAudio.damage();
      this.feedbackText = matchPos || matchSound ? 'FALTÓ MARCAR COINCIDENCIA' : 'FALSA ALARMA';
      if (this.misses % 3 === 0) {
        const left = this.ctx.damage(1);
        if (left <= 0) {
          this.ctx.finish(this.getMetrics(false));
          return;
        }
      }
    }
  }

  private advanceStep(): void {
    this.evaluateCurrentStep();
    if (this.destroyed) return;

    const intensity = this.ctx.getIntensity();
    this.stepDuration = Math.max(1.55, 2.28 / Math.max(0.8, intensity * 0.92));
    this.stepTimer = this.stepDuration;
    this.flashElapsed = 0;
    this.pressedPos = false;
    this.pressedSound = false;
    this.stepEvaluated = false;

    const ref =
      this.history.length >= this.nLevel ? this.history[this.history.length - this.nLevel] : null;
    const pos = ref && Math.random() < 0.38 ? ref.pos : Math.floor(Math.random() * 9);
    const tone = ref && Math.random() < 0.38 ? ref.tone : Math.floor(Math.random() * 4);
    this.history.push({ pos, tone });
    if (this.history.length > 16) this.history.shift();

    synthAudio.scheduleNoteCue(tone);

    const readyCompare = this.history.length > this.nLevel;
    if (!readyCompare) {
      this.feedbackText = `OBSERVA (${this.history.length}/${this.nLevel + 1} PARA COMPARAR)`;
    } else {
      this.feedbackText = `¿IGUAL QUE HACE ${this.nLevel} ${this.nLevel === 1 ? 'PASO' : 'PASOS'}?`;
    }

    const total = this.hits + this.misses;
    const acc = total > 0 ? Math.round((this.hits / total) * 100) : 100;
    this.ctx.setHud({
      subStat: `${this.nLevel}-BACK · PRECISIÓN ${acc}% · PASOS ${this.puzzlesSolved}`,
    });

    this.renderBoard();
  }

  private renderBoard(): void {
    const curr = this.history[this.history.length - 1];
    const showStimulus = this.flashElapsed < this.stepDuration * 0.65;
    const canAnswer = this.history.length > this.nLevel;
    const timerPct = Math.max(0, Math.min(100, (this.stepTimer / this.stepDuration) * 100));

    this.boardEl.innerHTML = `
      <div class="oa-mem-head">
        <span class="oa-mem-pill">${this.nLevel}-BACK CUÁNTICO · PASO ${this.history.length}</span>
        <span class="oa-mem-status">${this.feedbackText}</span>
      </div>
      <div class="oa-nback-timer-wrap" aria-label="Tiempo del paso actual">
        <div class="oa-nback-timer-fill" id="oa-nb-timer-fill" style="width:${timerPct.toFixed(1)}%"></div>
      </div>
      <div class="oa-nback-tone" style="border-color:${showStimulus ? TONE_COLORS[curr.tone] : 'var(--border-strong)'}">
        ${
          showStimulus
            ? `SEÑAL SONORA: <strong style="color:${TONE_COLORS[curr.tone]}">${TONE_LABELS[curr.tone]}</strong>`
            : 'DECIDE ANTES DEL SIGUIENTE PULSO...'
        }
      </div>
      <div class="oa-nback-grid">
        ${Array.from({ length: 9 }, (_, i) => {
          const active = showStimulus && curr.pos === i;
          return `<div class="oa-nback-cell ${active ? 'is-active' : ''}" style="${
            active ? `background:${TONE_COLORS[curr.tone]};border-color:#fff;` : ''
          }">${active ? '<span class="oa-nback-dot"></span>' : ''}</div>`;
        }).join('')}
      </div>
      <div class="oa-nback-actions">
        <button type="button" class="oa-nback-btn ${this.pressedPos ? 'is-selected' : ''}" id="oa-nb-pos" ${
          !canAnswer ? 'disabled' : ''
        }>
          <strong>POSICIÓN</strong>
          <span>Tecla A / Izq</span>
        </button>
        <button type="button" class="oa-nback-btn" id="oa-nb-none" ${!canAnswer ? 'disabled' : ''}>
          <strong>No coincide</strong>
          <span>Espacio</span>
        </button>
        <button type="button" class="oa-nback-btn ${this.pressedSound ? 'is-selected' : ''}" id="oa-nb-sound" ${
          !canAnswer ? 'disabled' : ''
        }>
          <strong>SONIDO</strong>
          <span>Tecla L / Der</span>
        </button>
      </div>
    `;

    this.boardEl.querySelector('#oa-nb-pos')?.addEventListener('click', () => this.toggleChoice('pos'));
    this.boardEl
      .querySelector('#oa-nb-sound')
      ?.addEventListener('click', () => this.toggleChoice('sound'));
    this.boardEl
      .querySelector('#oa-nb-none')
      ?.addEventListener('click', () => this.confirmNoMatch());
  }

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;

    if (!this.isGauntletSlice) {
      const left = Math.max(0, this.standaloneDuration - this.elapsed);
      this.ctx.setHud({ timeLeftSec: left });
      if (left <= 0) {
        this.evaluateCurrentStep();
        this.ctx.finish(this.getMetrics(true));
        return;
      }
    }

    const wasShown = this.flashElapsed < this.stepDuration * 0.65;
    this.flashElapsed += dt;
    const nowShown = this.flashElapsed < this.stepDuration * 0.65;
    if (wasShown && !nowShown) {
      this.renderBoard();
    }

    this.stepTimer -= dt;
    const fillEl = this.boardEl.querySelector<HTMLDivElement>('#oa-nb-timer-fill');
    if (fillEl) {
      const pct = Math.max(0, Math.min(100, (this.stepTimer / this.stepDuration) * 100));
      fillEl.style.width = `${pct.toFixed(1)}%`;
    }

    if (this.stepTimer <= 0) {
      this.advanceStep();
    }
  }

  public onResize(): void {
    // CSS handles sizing
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getMetrics(
    survived = true
  ): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const total = this.hits + this.misses;
    const acc = total > 0 ? (this.hits / total) * 100 : 85;
    const logicScore = Math.min(
      990,
      260 + this.nLevel * 95 + this.hits * 22 + this.maxCombo * 12 - this.misses * 22
    );
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy: acc,
      hits: this.hits,
      misses: this.misses,
      puzzlesSolved: this.puzzlesSolved,
      survived,
      axisPerformances: {
        logic: Math.max(120, Math.round(logicScore)),
        rhythm: Math.max(120, Math.round(logicScore * 0.78)),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.wrapper.remove();
  }
}
