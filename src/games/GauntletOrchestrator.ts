import { CIRCUIT_IDS, GAME_CATALOG } from '../catalog';
import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics, SkillAxis, StandaloneGameId } from '../types';
import { renderControlHintRow } from '../ui/GuideOverlay';
import { Aim3DGame } from './Aim3DGame';
import { BlitzStacker2DGame } from './BlitzStacker2DGame';
import { BulletHell2DGame } from './BulletHell2DGame';
import { CheckersAcademyGame } from './CheckersAcademyGame';
import { ChessAcademyGame } from './ChessAcademyGame';
import { DualNBack2DGame } from './DualNBack2DGame';
import { FlashParry2DGame } from './FlashParry2DGame';
import { FlightPortals3DGame } from './FlightPortals3DGame';
import { HanoiLogic2DGame } from './HanoiLogic2DGame';
import { LaserTrack2DGame } from './LaserTrack2DGame';
import { MemoryGrid2DGame } from './MemoryGrid2DGame';
import { NeonSnake2DGame } from './NeonSnake2DGame';
import { OrbitBreaker3DGame } from './OrbitBreaker3DGame';
import { PianoEar2DGame } from './PianoEar2DGame';
import { PokerAcademyGame } from './PokerAcademyGame';
import { PrecisionTarget2DGame } from './PrecisionTarget2DGame';
import { PuzzleMatrix2DGame } from './PuzzleMatrix2DGame';
import { RavenMatrix2DGame } from './RavenMatrix2DGame';
import { Rhythm2DGame } from './Rhythm2DGame';
import { RubikCube3DGame } from './RubikCube3DGame';
import { Runner3DGame } from './Runner3DGame';
import { SchulteGrid2DGame } from './SchulteGrid2DGame';
import { SkyVault3DGame } from './SkyVault3DGame';
import { SonicRing2DGame } from './SonicRing2DGame';
import { SudokuGuide2DGame } from './SudokuGuide2DGame';
import { TwinStick2DGame } from './TwinStick2DGame';

// Alternating 3D / 2D sequence across the 18 fast circuit disciplines
const ALTERNATING_CIRCUIT: StandaloneGameId[] = [
  'aim3d',
  'schulte2d',
  'flight3d',
  'track2d',
  'parkour3d',
  'pulse2d',
  'cube3d',
  'nback2d',
  'runner3d',
  'parry2d',
  'rhythm2d',
  'sniper2d',
  'memory2d',
  'bullet2d',
  'snake2d',
  'tetris2d',
  'twinstick2d',
  'puzzle2d',
];

const SEQUENCE: StandaloneGameId[] =
  ALTERNATING_CIRCUIT.length === CIRCUIT_IDS.length ? ALTERNATING_CIRCUIT : [...CIRCUIT_IDS];

export function createMiniGame(id: StandaloneGameId, isSlice: boolean): MiniGame {
  switch (id) {
    case 'aim3d':
      return new Aim3DGame(isSlice);
    case 'runner3d':
      return new Runner3DGame(isSlice);
    case 'cube3d':
      return new OrbitBreaker3DGame(isSlice);
    case 'parkour3d':
      return new SkyVault3DGame(isSlice);
    case 'flight3d':
      return new FlightPortals3DGame(isSlice);
    case 'rhythm2d':
      return new Rhythm2DGame(isSlice);
    case 'pulse2d':
      return new SonicRing2DGame(isSlice);
    case 'parry2d':
      return new FlashParry2DGame(isSlice);
    case 'bullet2d':
      return new BulletHell2DGame(isSlice);
    case 'puzzle2d':
      return new PuzzleMatrix2DGame(isSlice);
    case 'schulte2d':
      return new SchulteGrid2DGame(isSlice);
    case 'nback2d':
      return new DualNBack2DGame(isSlice);
    case 'tetris2d':
      return new BlitzStacker2DGame(isSlice);
    case 'twinstick2d':
      return new TwinStick2DGame(isSlice);
    case 'track2d':
      return new LaserTrack2DGame(isSlice);
    case 'memory2d':
      return new MemoryGrid2DGame(isSlice);
    case 'snake2d':
      return new NeonSnake2DGame(isSlice);
    case 'sniper2d':
      return new PrecisionTarget2DGame(isSlice);
    // 8 Nuevas Academias
    case 'chess2d':
      return new ChessAcademyGame(isSlice);
    case 'checkers2d':
      return new CheckersAcademyGame(isSlice);
    case 'poker2d':
      return new PokerAcademyGame(isSlice);
    case 'rubik3d':
      return new RubikCube3DGame(isSlice);
    case 'piano2d':
      return new PianoEar2DGame(isSlice);
    case 'raven2d':
      return new RavenMatrix2DGame(isSlice);
    case 'sudoku2d':
      return new SudokuGuide2DGame(isSlice);
    case 'hanoi2d':
      return new HanoiLogic2DGame(isSlice);
  }
}

const TRANSITION_WAIT_SEC = 8;

export class GauntletOrchestrator {
  private ctx!: GameContext;
  private isRanked: boolean;
  private readonly sliceDuration = 15;

  private activeGame: MiniGame | null = null;
  private shiftBannerEl: HTMLDivElement | null = null;
  private countdownTextEl: HTMLSpanElement | null = null;
  private countdownRingEl: SVGCircleElement | null = null;

  private phaseIndex = 0;
  private phaseElapsed = 0;
  private shiftCooldown = 0;
  private totalElapsed = 0;
  private paused = false;
  private destroyed = false;

  private axisBuckets: Partial<Record<SkillAxis, number[]>> = {};
  private totalHits = 0;
  private totalMisses = 0;
  private totalGrazes = 0;
  private totalPuzzles = 0;
  private bestCombo = 0;
  private totalScore = 0;

  constructor(isRanked: boolean) {
    this.isRanked = isRanked;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;

    this.shiftBannerEl = document.createElement('div');
    this.shiftBannerEl.className = 'oa-shift-banner is-hidden';
    this.shiftBannerEl.addEventListener('click', () => {
      if (this.shiftCooldown > 0 && !this.paused && !this.destroyed) {
        this.dismissShiftBanner();
      }
    });
    this.ctx.container.appendChild(this.shiftBannerEl);

    window.addEventListener('keydown', this.onKeyDown);
    this.launchPhase(0);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed || this.shiftCooldown <= 0) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      this.dismissShiftBanner();
    }
  };

  private dismissShiftBanner(): void {
    this.shiftCooldown = 0;
    this.shiftBannerEl?.classList.add('is-hidden');
    if (!this.paused) {
      this.activeGame?.setPaused(false);
    }
  }

  private launchPhase(idx: number): void {
    if (this.activeGame) {
      this.collectMetrics(this.activeGame.getMetrics());
      this.activeGame.destroy();
      this.activeGame = null;
    }

    const modeId = SEQUENCE[idx % SEQUENCE.length];
    const desc = GAME_CATALOG[modeId];

    this.shiftCooldown = TRANSITION_WAIT_SEC;
    synthAudio.shiftTransition();
    this.ctx.setControls?.(desc.guide.controls);

    if (this.shiftBannerEl) {
      this.shiftBannerEl.style.setProperty('--shift-accent', desc.accent);
      const topControls = desc.guide.controls
        .slice(0, 3)
        .map((c) => renderControlHintRow(c, this.ctx.isTouch))
        .join('');
      const reduceMotion = Boolean(this.ctx.settings.reduceMotion);
      const ringSvg = reduceMotion
        ? ''
        : `<svg width="34" height="34" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border-strong)" stroke-width="3"/>
            <circle id="oa-shift-ring" cx="18" cy="18" r="15" fill="none" stroke="${desc.accent}" stroke-width="3" stroke-dasharray="94.2" stroke-dashoffset="0" transform="rotate(-90 18 18)"/>
          </svg>`;

      this.shiftBannerEl.innerHTML = `
        <div class="oa-shift-dim">${desc.dimension}</div>
        <div class="oa-shift-title">${desc.title}</div>
        <p class="oa-shift-goal">${desc.guide.objective}</p>
        <div class="oa-guide-hints">${topControls}</div>
        <div class="oa-shift-actions">
          <button type="button" class="oa-btn oa-btn-primary oa-shift-ready-btn" id="oa-shift-ready">
            ${this.ctx.isTouch ? 'Listo (Tocar)' : 'Listo (Espacio)'}
          </button>
          ${ringSvg}
          <span class="oa-shift-countdown" id="oa-shift-cd">${TRANSITION_WAIT_SEC}s</span>
        </div>
      `;
      this.shiftBannerEl.classList.remove('is-hidden');
      this.countdownTextEl = this.shiftBannerEl.querySelector('#oa-shift-cd');
      this.countdownRingEl = this.shiftBannerEl.querySelector('#oa-shift-ring');
      this.shiftBannerEl.querySelector('#oa-shift-ready')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.paused && !this.destroyed) {
          synthAudio.uiClick();
          this.dismissShiftBanner();
        }
      });
    }

    const sliceCtx: GameContext = {
      ...this.ctx,
      addScore: (pts, comboInc) => {
        this.totalScore += pts;
        this.ctx.addScore(pts, comboInc);
      },
      finish: (metrics) => {
        if (!metrics.survived) {
          this.collectMetrics(metrics);
          this.ctx.finish(this.buildFinalMetrics(false));
        }
      },
    };

    const game = createMiniGame(modeId, true);
    this.activeGame = game;
    game.mount(sliceCtx);
    game.setPaused(true);

    if (this.shiftBannerEl) {
      this.ctx.container.appendChild(this.shiftBannerEl);
    }

    const cycle = Math.floor(idx / SEQUENCE.length) + 1;
    const prefix = this.isRanked ? `FASE ${idx + 1}/${SEQUENCE.length}` : `CICLO ${cycle}`;
    this.ctx.setHud({
      phaseLabel: `${prefix} · ${desc.title}`,
      dimension: desc.dimension as '2D' | '3D',
      accent: desc.accent,
      timeLeftSec: this.isRanked
        ? Math.max(0, SEQUENCE.length * this.sliceDuration - this.totalElapsed)
        : this.sliceDuration,
    });
  }

  private collectMetrics(
    m: Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'>
  ): void {
    this.bestCombo = Math.max(this.bestCombo, m.maxCombo);
    this.totalHits += m.hits ?? 0;
    this.totalMisses += m.misses ?? 0;
    this.totalGrazes += m.grazes ?? 0;
    this.totalPuzzles += m.puzzlesSolved ?? 0;
    for (const [k, val] of Object.entries(m.axisPerformances)) {
      const axis = k as SkillAxis;
      if (typeof val === 'number') {
        if (!this.axisBuckets[axis]) this.axisBuckets[axis] = [];
        this.axisBuckets[axis]!.push(val);
      }
    }
  }

  private buildFinalMetrics(
    survived: boolean
  ): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    if (this.activeGame) {
      this.collectMetrics(this.activeGame.getMetrics());
    }
    const axisPerformances: Partial<Record<SkillAxis, number>> = {};
    for (const [k, arr] of Object.entries(this.axisBuckets)) {
      const axis = k as SkillAxis;
      if (arr && arr.length > 0) {
        axisPerformances[axis] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
      }
    }
    const totalAttempts = this.totalHits + this.totalMisses;
    const accuracy = totalAttempts > 0 ? (this.totalHits / totalAttempts) * 100 : undefined;

    return {
      score: this.totalScore,
      maxCombo: this.bestCombo,
      accuracy,
      hits: this.totalHits,
      misses: this.totalMisses,
      grazes: this.totalGrazes,
      puzzlesSolved: this.totalPuzzles,
      wavesCleared: this.phaseIndex + 1,
      survived,
      axisPerformances,
    };
  }

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;

    if (this.shiftCooldown > 0) {
      this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);
      if (this.countdownTextEl) {
        this.countdownTextEl.textContent = `${Math.ceil(this.shiftCooldown)}s`;
      }
      if (this.countdownRingEl) {
        const ratio = 1 - this.shiftCooldown / TRANSITION_WAIT_SEC;
        this.countdownRingEl.setAttribute('stroke-dashoffset', (94.2 * ratio).toFixed(1));
      }
      if (this.shiftCooldown <= 0) {
        this.dismissShiftBanner();
      }
      return;
    }

    this.phaseElapsed += dt;
    this.totalElapsed += dt;

    if (this.isRanked) {
      const totalGoal = SEQUENCE.length * this.sliceDuration;
      this.ctx.setHud({ timeLeftSec: Math.max(0, totalGoal - this.totalElapsed) });
      if (this.totalElapsed >= totalGoal) {
        this.ctx.finish(this.buildFinalMetrics(true));
        return;
      }
    } else {
      this.ctx.setHud({ timeLeftSec: Math.max(0, this.sliceDuration - this.phaseElapsed) });
    }

    this.activeGame?.update(dt, this.phaseElapsed);

    if (this.phaseElapsed >= this.sliceDuration) {
      this.phaseElapsed = 0;
      this.phaseIndex += 1;
      if (!this.isRanked && this.phaseIndex % 5 === 0) {
        this.ctx.heal(1);
        this.ctx.toast('RACHA DE FASES +1 ESCUDO', 'good');
      }
      this.launchPhase(this.phaseIndex);
    }
  }

  public onResize(): void {
    this.activeGame?.onResize();
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (this.shiftCooldown <= 0) {
      this.activeGame?.setPaused(paused);
    }
  }

  public getMetrics(): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    return this.buildFinalMetrics(true);
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.activeGame?.destroy();
    this.activeGame = null;
    this.shiftBannerEl?.remove();
  }
}
