import { GAME_CATALOG } from '../catalog';
import { synthAudio } from '../audio/SynthAudio';
import { GameContext, MiniGame, RunMetrics, SkillAxis, StandaloneGameId } from '../types';
import { Aim3DGame } from './Aim3DGame';
import { BlitzStacker2DGame } from './BlitzStacker2DGame';
import { BulletHell2DGame } from './BulletHell2DGame';
import { FlashParry2DGame } from './FlashParry2DGame';
import { OrbitBreaker3DGame } from './OrbitBreaker3DGame';
import { PuzzleMatrix2DGame } from './PuzzleMatrix2DGame';
import { Rhythm2DGame } from './Rhythm2DGame';
import { Runner3DGame } from './Runner3DGame';
import { SkyVault3DGame } from './SkyVault3DGame';
import { TwinStick2DGame } from './TwinStick2DGame';

// Alternating 3D <-> 2D sequence across all 10 disciplines
const SEQUENCE: StandaloneGameId[] = [
  'aim3d',
  'parry2d',
  'parkour3d',
  'rhythm2d',
  'cube3d',
  'tetris2d',
  'runner3d',
  'bullet2d',
  'twinstick2d',
  'puzzle2d',
];

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
    case 'rhythm2d':
      return new Rhythm2DGame(isSlice);
    case 'parry2d':
      return new FlashParry2DGame(isSlice);
    case 'bullet2d':
      return new BulletHell2DGame(isSlice);
    case 'puzzle2d':
      return new PuzzleMatrix2DGame(isSlice);
    case 'tetris2d':
      return new BlitzStacker2DGame(isSlice);
    case 'twinstick2d':
      return new TwinStick2DGame(isSlice);
  }
}

export class GauntletOrchestrator {
  private ctx!: GameContext;
  private isRanked: boolean;
  private readonly sliceDuration = 15;

  private activeGame: MiniGame | null = null;
  private shiftBannerEl: HTMLDivElement | null = null;

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
    this.ctx.container.appendChild(this.shiftBannerEl);

    this.launchPhase(0);
  }

  private launchPhase(idx: number): void {
    if (this.activeGame) {
      this.collectMetrics(this.activeGame.getMetrics());
      this.activeGame.destroy();
      this.activeGame = null;
    }

    const modeId = SEQUENCE[idx % SEQUENCE.length];
    const desc = GAME_CATALOG[modeId];

    // Show brief transition banner between phases
    this.shiftCooldown = idx === 0 ? 0.85 : 1.15;
    synthAudio.shiftTransition();

    if (this.shiftBannerEl) {
      this.shiftBannerEl.style.setProperty('--shift-accent', desc.accent);
      this.shiftBannerEl.innerHTML = `
        <div class="oa-shift-dim">${desc.dimension}</div>
        <div class="oa-shift-title">${desc.title}</div>
        <div class="oa-shift-ctrl">${this.ctx.isTouch ? desc.controlsTouch : desc.controlsPC}</div>
      `;
      this.shiftBannerEl.classList.remove('is-hidden');
    }

    // Wrap GameContext so individual slices can't terminate the whole Gauntlet unless shields hit 0
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

    // Ensure shift banner stays on top of freshly appended stage
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

  private collectMetrics(m: Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'>): void {
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
      this.shiftCooldown -= dt;
      if (this.shiftCooldown <= 0) {
        this.shiftBannerEl?.classList.add('is-hidden');
        this.activeGame?.setPaused(false);
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
      // Bonus shield every 5 phases in endless Gauntlet
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
    this.activeGame?.destroy();
    this.activeGame = null;
    this.shiftBannerEl?.remove();
  }
}
