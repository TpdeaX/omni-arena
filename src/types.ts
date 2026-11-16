export type SkillAxis = 'aim' | 'rhythm' | 'logic' | 'reflex' | 'agility';

export type DifficultyId = 'chill' | 'standard' | 'hyper' | 'adaptive';

export type GameModeId =
  | 'aim3d'
  | 'runner3d'
  | 'cube3d'
  | 'parkour3d'
  | 'rhythm2d'
  | 'bullet2d'
  | 'puzzle2d'
  | 'twinstick2d'
  | 'parry2d'
  | 'tetris2d'
  | 'gauntlet'
  | 'ranked';

export type StandaloneGameId = Exclude<GameModeId, 'gauntlet' | 'ranked'>;

export interface GameDescriptor {
  id: GameModeId;
  title: string;
  subtitle: string;
  dimension: '3D' | '2D' | '2D ↔ 3D';
  axis: SkillAxis | 'all';
  accent: string;
  accentSoft: string;
  controlsPC: string;
  controlsTouch: string;
  description: string;
}

export interface RunMetrics {
  modeId: GameModeId;
  difficulty: DifficultyId;
  peakIntensity: number;
  score: number;
  maxCombo: number;
  accuracy?: number; // 0..100
  avgReactionMs?: number;
  hits?: number;
  misses?: number;
  grazes?: number;
  puzzlesSolved?: number;
  wavesCleared?: number;
  durationSec: number;
  survived: boolean;
  /** Per-axis performance normalized 0..1000 for rating updates */
  axisPerformances: Partial<Record<SkillAxis, number>>;
}

export interface RunRecord {
  id: string;
  modeId: GameModeId;
  difficulty: DifficultyId;
  score: number;
  rank: string;
  timestamp: number;
  durationSec: number;
}

export interface UserSettings {
  volume: number; // 0..1
  muted: boolean;
  aimSensitivity: number; // 0.3..2.5
  touchControls: 'auto' | 'always' | 'off';
  screenShake: boolean;
  difficulty: DifficultyId;
}

export interface PlayerProfile {
  xp: number;
  level: number;
  ratings: Record<SkillAxis, number>; // 0..1000
  bestScores: Record<GameModeId, number>;
  playCounts: Record<GameModeId, number>;
  history: RunRecord[];
  dailyStreak: number;
  lastPlayedDay: string;
  dailyCompletedIds: StandaloneGameId[];
  settings: UserSettings;
}

export interface GameContext {
  container: HTMLElement;
  isTouch: boolean;
  settings: UserSettings;
  difficulty: DifficultyId;
  /** Current dynamic intensity multiplier (e.g. 0.78..1.80) */
  getIntensity: () => number;
  /** Report live HUD state back to the Arena shell */
  setHud: (hud: Partial<HudState>) => void;
  /** Report a shield/life hit; returns remaining shields */
  damage: (amount?: number) => number;
  /** Heal shield */
  heal: (amount?: number) => void;
  /** Add score & update combo (also nudges adaptive difficulty up) */
  addScore: (points: number, comboIncrement?: number) => void;
  /** Reset combo on miss (also eases adaptive difficulty slightly) */
  breakCombo: () => void;
  /** End the run immediately with metrics */
  finish: (metrics: Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'>) => void;
  /** Trigger brief floating feedback in center/top */
  toast: (text: string, tone?: 'good' | 'warn' | 'bad' | 'accent') => void;
}

export interface HudState {
  score: number;
  combo: number;
  shields: number;
  maxShields: number;
  timeLeftSec: number | null; // null = endless/survival
  phaseLabel: string;
  dimension: '2D' | '3D';
  accent: string;
  subStat: string;
  intensity: number;
}

export interface MiniGame {
  readonly id: StandaloneGameId;
  mount(ctx: GameContext): void;
  update(dt: number, elapsed: number): void;
  onResize(): void;
  setPaused(paused: boolean): void;
  /** Snapshot partial metrics when switched out mid-run in Gauntlet/Ranked */
  getMetrics(): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'>;
  destroy(): void;
}
