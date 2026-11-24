import '../styles/neurolab.css';
import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';
import {
  CRAZE_COLORS,
  CRAZE_RULES,
  ColorCrazeTrial,
  CrazeRuleId,
  CrazeShapeId,
  generateColorCrazeTrial,
} from './neuro/neuroEngines';

const RULE_POOL: CrazeRuleId[] = ['ink', 'word', 'shape', 'nogo_red'];

function renderStimulusShapeSvg(shape: CrazeShapeId, colorHex: string, wordLabel: string): string {
  let shapeEl = '';
  if (shape === 'circulo') {
    shapeEl = `<circle cx="110" cy="80" r="64" fill="rgba(255,255,255,0.04)" stroke="${colorHex}" stroke-width="5"/>`;
  } else if (shape === 'triangulo') {
    shapeEl = `<polygon points="110,14 182,138 38,138" fill="rgba(255,255,255,0.04)" stroke="${colorHex}" stroke-width="5"/>`;
  } else if (shape === 'cuadrado') {
    shapeEl = `<rect x="46" y="18" width="128" height="124" rx="10" fill="rgba(255,255,255,0.04)" stroke="${colorHex}" stroke-width="5"/>`;
  } else {
    shapeEl = `<polygon points="110,12 184,80 110,148 36,80" fill="rgba(255,255,255,0.04)" stroke="${colorHex}" stroke-width="5"/>`;
  }

  return `<svg width="220" height="160" viewBox="0 0 220 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Estímulo ${wordLabel}">${shapeEl}<text x="110" y="${
    shape === 'triangulo' ? 108 : 88
  }" text-anchor="middle" fill="${colorHex}" font-family="'Chakra Petch', sans-serif" font-size="26" font-weight="700" letter-spacing="1.5">${wordLabel}</text></svg>`;
}

export class ColorCraze2DGame implements MiniGame {
  public readonly id = 'colorcraze2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private boardEl!: HTMLDivElement;

  private currentRule: CrazeRuleId = 'ink';
  private trialsUntilSwitch = 4;
  private trial!: ColorCrazeTrial;
  private trialStartMs = 0;
  private ruleSwitchFlash = 0;
  private feedbackText = 'Observa la regla superior y responde rápido';
  private feedbackTone: 'neutral' | 'good' | 'bad' = 'neutral';

  private hits = 0;
  private misses = 0;
  private reactionSamples: number[] = [];
  private stayRx: number[] = [];
  private switchRx: number[] = [];
  private nogoHits = 0;
  private nogoTotal = 0;
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
      phaseLabel: 'LOCURA DE COLOR',
      accent: '#EC4899',
      timeLeftSec: this.isGauntletSlice || this.ctx.infiniteMode ? null : this.standaloneDuration,
      subStat: 'STROOP · CAMBIO DE REGLAS · GO/NO-GO',
    });

    this.nextTrial(null);
  }

  private nextTrial(prevRule: CrazeRuleId | null): void {
    this.trialsUntilSwitch -= 1;
    let nextRule = this.currentRule;
    if (this.trialsUntilSwitch <= 0) {
      const others = RULE_POOL.filter((r) => r !== this.currentRule);
      nextRule = others[Math.floor(Math.random() * others.length)];
      this.currentRule = nextRule;
      const intensity = this.ctx.getIntensity();
      this.trialsUntilSwitch = intensity >= 1.25 ? 3 : 4 + Math.floor(Math.random() * 2);
      this.ruleSwitchFlash = 0.75;
      synthAudio.shiftTransition();
      this.ctx.toast(`CAMBIO DE REGLA: ${CRAZE_RULES[nextRule].banner}`, 'accent');
    }

    this.trial = generateColorCrazeTrial(this.currentRule, prevRule);
    this.trialStartMs = performance.now();
    this.render();
  }

  private submit(answerId: string): void {
    if (this.paused || this.destroyed) return;
    const rx = Math.max(90, Math.round(performance.now() - this.trialStartMs));
    this.reactionSamples.push(rx);
    if (this.trial.isSwitch) this.switchRx.push(rx);
    else this.stayRx.push(rx);

    if (this.trial.isNoGo) {
      this.nogoTotal += 1;
    }

    const prevRule = this.trial.rule;
    if (answerId === this.trial.expectedAnswer) {
      if (this.trial.isNoGo) this.nogoHits += 1;
      this.hits += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const speedBonus = Math.max(0, Math.round((1100 - rx) * 0.14));
      const pts = (this.trial.isNoGo ? 190 : 140) + speedBonus + (this.trial.isSwitch ? 60 : 0);
      this.score += pts;
      this.ctx.addScore(pts, 1);
      synthAudio.hitmarker(this.combo);

      this.feedbackTone = 'good';
      this.feedbackText = this.trial.isNoGo
        ? `IMPULSO INHIBIDO · ${rx} ms (+${pts})`
        : `ACIERTO · ${rx} ms (+${pts})`;
    } else {
      this.misses += 1;
      this.combo = 0;
      this.ctx.breakCombo();
      synthAudio.damage();

      this.feedbackTone = 'bad';
      this.feedbackText = this.trial.isNoGo
        ? 'Era rojo: debías pulsar INHIBIR (Espacio)'
        : `Regla ${CRAZE_RULES[this.trial.rule].banner}: la respuesta era ${this.trial.expectedAnswer.toUpperCase()}`;

      if (!this.ctx.practiceMode) {
        const left = this.ctx.damage(1);
        if (left <= 0) {
          this.ctx.finish(this.getMetrics(false));
          return;
        }
      }
    }

    this.updateSubStat();
    this.nextTrial(prevRule);
  }

  private computeSwitchCostMs(): number {
    if (this.switchRx.length === 0 || this.stayRx.length === 0) return 0;
    const avgS = this.switchRx.reduce((a, b) => a + b, 0) / this.switchRx.length;
    const avgBase = this.stayRx.reduce((a, b) => a + b, 0) / this.stayRx.length;
    return Math.max(0, Math.round(avgS - avgBase));
  }

  private updateSubStat(): void {
    const total = this.hits + this.misses;
    const acc = total > 0 ? Math.round((this.hits / total) * 100) : 100;
    const sw = this.computeSwitchCostMs();
    const inhibPct = this.nogoTotal > 0 ? Math.round((this.nogoHits / this.nogoTotal) * 100) : 100;
    this.ctx.setHud({
      subStat: `PREC ${acc}% · COSTO CAMBIO +${sw} ms · INHIBICIÓN ${inhibPct}%`,
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed) return;
    if (e.code === 'Space') {
      e.preventDefault();
      this.submit('inhibit');
      return;
    }
    const map: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
    const idx = map[e.code];
    if (idx !== undefined && this.trial.options[idx]) {
      e.preventDefault();
      this.submit(this.trial.options[idx].id);
    }
  };

  private render(): void {
    const ruleMeta = CRAZE_RULES[this.trial.rule];
    const inkHex = CRAZE_COLORS[this.trial.inkId].hex;
    const wordLabel = CRAZE_COLORS[this.trial.wordId].label;

    this.boardEl.innerHTML = `
      <div class="oa-craze-banner ${this.ruleSwitchFlash > 0 ? 'is-flash' : ''}" style="--rule-accent:${ruleMeta.accent}">
        <span class="oa-craze-rule-tag">REGLA ACTIVA</span>
        <strong>${ruleMeta.banner}</strong>
        <small>${ruleMeta.hint}</small>
      </div>

      <div class="oa-craze-stimulus">
        ${renderStimulusShapeSvg(this.trial.shapeId, inkHex, wordLabel)}
      </div>

      <div class="oa-craze-feedback is-${this.feedbackTone}">${this.feedbackText}</div>

      <div class="oa-neuro-options-grid">
        ${this.trial.options
          .map(
            (opt, i) => `
          <button type="button" class="oa-neuro-opt-btn" data-cz-opt="${opt.id}" ${
              opt.colorHex ? `style="--opt-accent:${opt.colorHex}"` : ''
            }>
            <kbd>${i + 1}</kbd>
            ${opt.colorHex ? `<span class="oa-craze-swatch" style="background:${opt.colorHex}"></span>` : ''}
            <strong>${opt.label}</strong>
          </button>
        `
          )
          .join('')}
      </div>

      ${
        this.trial.rule === 'nogo_red'
          ? `<button type="button" class="oa-neuro-inhibit-btn" id="oa-cz-inhibit">
               <strong>INHIBIR / NO TOCAR</strong>
               <span>Pulsa ESPACIO si la tinta es roja</span>
             </button>`
          : ''
      }
    `;

    this.boardEl.querySelectorAll<HTMLButtonElement>('[data-cz-opt]').forEach((btn) => {
      btn.addEventListener('click', () => this.submit(btn.dataset.czOpt!));
    });
    this.boardEl.querySelector('#oa-cz-inhibit')?.addEventListener('click', () => this.submit('inhibit'));
  }

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;

    if (this.ruleSwitchFlash > 0) {
      this.ruleSwitchFlash = Math.max(0, this.ruleSwitchFlash - dt);
    }

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
        : 850;
    const perf =
      total === 0
        ? 160
        : Math.max(
            120,
            Math.min(
              990,
              Math.round(240 + this.hits * 22 + acc * 2.9 + Math.max(0, 950 - avgRx) * 0.28 - this.misses * 28)
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
        reflex: Math.round(perf * 0.88),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.wrapper.remove();
  }
}
