import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics } from '../types';

type PuzzleKind = 'chimp' | 'stroop' | 'math' | 'simon';

const STROOP_PALETTE = [
  { name: 'ROJO', hex: '#FF4D38' },
  { name: 'CIAN', hex: '#00E5FF' },
  { name: 'VERDE', hex: '#A6FF00' },
  { name: 'ORO', hex: '#FFB800' },
];

export class PuzzleMatrix2DGame implements MiniGame {
  public readonly id = 'puzzle2d' as const;

  private ctx!: GameContext;
  private wrapper!: HTMLDivElement;
  private boardEl!: HTMLDivElement;

  private currentKind: PuzzleKind = 'math';
  private roundIndex = 0;
  private roundStartMs = 0;

  private solved = 0;
  private attempts = 0;
  private reactionSamples: number[] = [];
  private combo = 0;
  private maxCombo = 0;
  private score = 0;

  private elapsed = 0;
  private readonly standaloneDuration = 50;
  private isGauntletSlice = false;
  private paused = false;
  private destroyed = false;

  // Chimp state
  private chimpNext = 1;
  private chimpMax = 4;
  private chimpHidden = false;

  // Simon state
  private simonSeq: number[] = [];
  private simonStep = 0;
  private simonPlaying = false;
  private simonTimers: number[] = [];

  // 4-option key handler
  private activeOptions: (() => void)[] = [];

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
      phaseLabel: 'MATRIZ MENTAL',
      accent: '#FFB800',
      timeLeftSec: this.isGauntletSlice ? null : this.standaloneDuration,
      subStat: 'RESUELTOS 0 · RACHA 0',
    });

    this.nextPuzzle();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed) return;
    const idxMap: Record<string, number> = {
      Digit1: 0,
      Digit2: 1,
      Digit3: 2,
      Digit4: 3,
      Numpad1: 0,
      Numpad2: 1,
      Numpad3: 2,
      Numpad4: 3,
    };
    const idx = idxMap[e.code];
    if (idx !== undefined && this.activeOptions[idx]) {
      e.preventDefault();
      this.activeOptions[idx]();
    }
  };

  private clearSimonTimers(): void {
    for (const id of this.simonTimers) {
      window.clearTimeout(id);
    }
    this.simonTimers = [];
  }

  private nextPuzzle(): void {
    this.clearSimonTimers();
    this.activeOptions = [];
    const order: PuzzleKind[] = ['stroop', 'math', 'chimp', 'simon'];
    this.currentKind = order[this.roundIndex % order.length];
    this.roundIndex += 1;
    this.roundStartMs = performance.now();

    if (this.currentKind === 'stroop') this.renderStroop();
    else if (this.currentKind === 'math') this.renderMath();
    else if (this.currentKind === 'chimp') this.renderChimp();
    else this.renderSimon();
  }

  private handleSuccess(basePoints: number): void {
    if (this.destroyed) return;
    const rx = performance.now() - this.roundStartMs;
    this.reactionSamples.push(rx);
    this.attempts += 1;
    this.solved += 1;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    const speedBonus = Math.max(0, Math.round((4500 - rx) * 0.05));
    const pts = basePoints + speedBonus;
    this.score += pts;
    this.ctx.addScore(pts, 1);
    synthAudio.puzzleSuccess(this.combo);
    this.updateSubStat();
    this.nextPuzzle();
  }

  private handleFail(msg: string): void {
    if (this.destroyed) return;
    this.attempts += 1;
    this.combo = 0;
    this.ctx.breakCombo();
    synthAudio.damage();
    this.ctx.toast(msg, 'bad');
    this.updateSubStat();
    const left = this.ctx.damage(1);
    if (left <= 0) {
      this.ctx.finish({ ...this.getMetrics(), survived: false });
      return;
    }
    this.nextPuzzle();
  }

  private updateSubStat(): void {
    const acc = this.attempts > 0 ? Math.round((this.solved / this.attempts) * 100) : 100;
    this.ctx.setHud({
      subStat: `RESUELTOS ${this.solved} · PREC ${acc}%`,
    });
  }

  private renderStroop(): void {
    const wordIdx = Math.floor(Math.random() * STROOP_PALETTE.length);
    let inkIdx = Math.floor(Math.random() * STROOP_PALETTE.length);
    if (inkIdx === wordIdx) inkIdx = (inkIdx + 1) % STROOP_PALETTE.length;

    const word = STROOP_PALETTE[wordIdx].name;
    const ink = STROOP_PALETTE[inkIdx];

    this.boardEl.innerHTML = `
      <div class="oa-pz-type">RETO DE COLOR · TOCA EL COLOR DE LA TINTA</div>
      <div class="oa-pz-prompt" style="color: ${ink.hex}">${word}</div>
      <div class="oa-pz-options"></div>
    `;
    const optWrap = this.boardEl.querySelector('.oa-pz-options')!;
    STROOP_PALETTE.forEach((p, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-pz-btn';
      btn.innerHTML = `<span class="oa-pz-key">${idx + 1}</span><span>${p.name}</span><span class="oa-pz-swatch" style="background:${p.hex}"></span>`;
      const action = () => {
        if (this.paused) return;
        if (p.name === ink.name) this.handleSuccess(170);
        else this.handleFail(`ERA TINTA ${ink.name}`);
      };
      btn.addEventListener('click', action);
      this.activeOptions.push(action);
      optWrap.appendChild(btn);
    });
  }

  private renderMath(): void {
    const intensity = this.ctx.getIntensity();
    const tier = Math.min(4, Math.floor(this.solved / 4) + (intensity >= 1.25 ? 1 : 0));
    let a = 4 + Math.floor(Math.random() * (9 + tier * 5));
    let b = 3 + Math.floor(Math.random() * (8 + tier * 4));
    const op = Math.random() < 0.45 ? '×' : Math.random() < 0.5 ? '+' : '−';
    if (op === '−' && b > a) [a, b] = [b, a];
    if (op === '×') {
      a = 3 + Math.floor(Math.random() * (7 + tier * 3));
      b = 2 + Math.floor(Math.random() * 8);
    }
    const ans = op === '×' ? a * b : op === '+' ? a + b : a - b;

    const choices = new Set<number>([ans]);
    while (choices.size < 4) {
      const delta = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 6));
      const candidate = Math.max(0, ans + delta);
      choices.add(candidate);
    }
    const list = Array.from(choices).sort(() => Math.random() - 0.5);

    this.boardEl.innerHTML = `
      <div class="oa-pz-type">CÁLCULO FLASH</div>
      <div class="oa-pz-prompt">${a} ${op} ${b} = ?</div>
      <div class="oa-pz-options"></div>
    `;
    const optWrap = this.boardEl.querySelector('.oa-pz-options')!;
    list.forEach((val, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-pz-btn';
      btn.innerHTML = `<span class="oa-pz-key">${idx + 1}</span><span>${val}</span>`;
      const action = () => {
        if (this.paused) return;
        if (val === ans) this.handleSuccess(190);
        else this.handleFail(`ERA ${ans}`);
      };
      btn.addEventListener('click', action);
      this.activeOptions.push(action);
      optWrap.appendChild(btn);
    });
  }

  private renderChimp(): void {
    const bonus = this.ctx.getIntensity() >= 1.28 ? 1 : 0;
    this.chimpMax = Math.min(8, 4 + Math.floor(this.solved / 5) + bonus);
    this.chimpNext = 1;
    this.chimpHidden = false;

    const slots = Array.from({ length: 12 }, (_, i) => i).sort(() => Math.random() - 0.5);
    const chosen = new Map<number, number>();
    for (let n = 1; n <= this.chimpMax; n++) {
      chosen.set(slots[n - 1], n);
    }

    this.boardEl.innerHTML = `
      <div class="oa-pz-type">MEMORIA NUMÉRICA · PULSA 1 → ${this.chimpMax} EN ORDEN</div>
      <div class="oa-pz-grid oa-pz-grid-4x3"></div>
    `;
    const grid = this.boardEl.querySelector('.oa-pz-grid')!;

    for (let i = 0; i < 12; i++) {
      const num = chosen.get(i);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = num ? 'oa-pz-cell has-num' : 'oa-pz-cell is-empty';
      if (num) {
        cell.textContent = String(num);
        cell.dataset.num = String(num);
        cell.addEventListener('click', () => {
          if (this.paused || cell.classList.contains('is-cleared')) return;
          synthAudio.ensure();
          if (num === this.chimpNext) {
            cell.classList.add('is-cleared');
            cell.textContent = String(num);
            synthAudio.uiClick();
            if (this.chimpNext === 1 && !this.chimpHidden) {
              this.chimpHidden = true;
              grid.querySelectorAll<HTMLButtonElement>('.has-num:not(.is-cleared)').forEach((el) => {
                el.classList.add('is-masked');
              });
            }
            this.chimpNext += 1;
            if (this.chimpNext > this.chimpMax) {
              this.handleSuccess(260);
            }
          } else {
            this.handleFail(`SECUENCIA ROTA (ERA ${this.chimpNext})`);
          }
        });
      } else {
        cell.disabled = true;
      }
      grid.appendChild(cell);
    }
  }

  private renderSimon(): void {
    const intensity = this.ctx.getIntensity();
    const len = Math.min(7, 3 + Math.floor(this.solved / 5) + (intensity >= 1.3 ? 1 : 0));
    const stepMs = Math.max(210, Math.round(360 / Math.sqrt(intensity)));
    this.simonSeq = Array.from({ length: len }, () => Math.floor(Math.random() * 9));
    this.simonStep = 0;
    this.simonPlaying = true;

    this.boardEl.innerHTML = `
      <div class="oa-pz-type">SECUENCIA VISUAL · OBSERVA (${len} PASOS)</div>
      <div class="oa-pz-grid oa-pz-grid-3x3"></div>
    `;
    const grid = this.boardEl.querySelector('.oa-pz-grid')!;
    const cells: HTMLButtonElement[] = [];

    for (let i = 0; i < 9; i++) {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'oa-pz-cell oa-pz-simon';
      c.addEventListener('click', () => {
        if (this.paused || this.simonPlaying) return;
        synthAudio.ensure();
        c.classList.add('is-lit');
        window.setTimeout(() => c.classList.remove('is-lit'), 160);
        if (i === this.simonSeq[this.simonStep]) {
          synthAudio.scheduleNoteCue(i % 4);
          this.simonStep += 1;
          if (this.simonStep >= this.simonSeq.length) {
            this.handleSuccess(250);
          }
        } else {
          this.handleFail('PATRÓN INCORRECTO');
        }
      });
      cells.push(c);
      grid.appendChild(c);
    }

    // Play sequence
    const titleEl = this.boardEl.querySelector('.oa-pz-type')!;
    this.simonSeq.forEach((cellIdx, step) => {
      const tOn = window.setTimeout(() => {
        if (this.destroyed) return;
        cells[cellIdx]?.classList.add('is-lit');
        synthAudio.scheduleNoteCue(cellIdx % 4);
      }, 240 + step * stepMs);
      const tOff = window.setTimeout(() => {
        cells[cellIdx]?.classList.remove('is-lit');
      }, 240 + step * stepMs + Math.round(stepMs * 0.58));
      this.simonTimers.push(tOn, tOff);
    });

    const tReady = window.setTimeout(() => {
      if (this.destroyed) return;
      this.simonPlaying = false;
      this.roundStartMs = performance.now();
      titleEl.textContent = `SECUENCIA VISUAL · TU TURNO (${len} PASOS)`;
    }, 240 + this.simonSeq.length * stepMs + 70);
    this.simonTimers.push(tReady);
  }

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;
    if (!this.isGauntletSlice) {
      const rem = Math.max(0, this.standaloneDuration - this.elapsed);
      this.ctx.setHud({ timeLeftSec: rem });
      if (rem <= 0) {
        this.ctx.finish(this.getMetrics());
      }
    }
  }

  public onResize(): void {
    // CSS handles responsive grid scaling
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getMetrics(): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const acc = this.attempts > 0 ? (this.solved / this.attempts) * 100 : 100;
    const avgRx = this.reactionSamples.length
      ? this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length
      : 1800;

    const speedScore = Math.max(0, Math.min(350, (3600 - avgRx) * 0.14));
    const solveScore = Math.min(420, this.solved * 32);
    const accScore = acc * 2.3;
    const logicPerf = Math.max(150, Math.min(1000, Math.round(speedScore + solveScore + accScore)));

    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy: acc,
      avgReactionMs: avgRx,
      puzzlesSolved: this.solved,
      survived: true,
      axisPerformances: {
        logic: logicPerf,
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    this.clearSimonTimers();
    window.removeEventListener('keydown', this.onKeyDown);
    this.wrapper.remove();
  }
}
