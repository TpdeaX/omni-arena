export type SkillAxis = 'aim' | 'rhythm' | 'logic' | 'reflex' | 'agility';

export type DifficultyId = 'chill' | 'standard' | 'hyper' | 'adaptive';

export type ThemeMode = 'day' | 'night';

export type GameModeId =
  | 'aim3d'
  | 'runner3d'
  | 'cube3d'
  | 'parkour3d'
  | 'flight3d'
  | 'rhythm2d'
  | 'bullet2d'
  | 'puzzle2d'
  | 'twinstick2d'
  | 'parry2d'
  | 'tetris2d'
  | 'memory2d'
  | 'snake2d'
  | 'sniper2d'
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
  theme: ThemeMode;
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
  updatedAt: number;
}

export interface GameContext {
  container: HTMLElement;
  isTouch: boolean;
  settings: UserSettings;
  difficulty: DifficultyId;
  getIntensity: () => number;
  setHud: (hud: Partial<HudState>) => void;
  damage: (amount?: number) => number;
  heal: (amount?: number) => void;
  addScore: (points: number, comboIncrement?: number) => void;
  breakCombo: () => void;
  finish: (metrics: Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'>) => void;
  toast: (text: string, tone?: 'good' | 'warn' | 'bad' | 'accent') => void;
}

export interface HudState {
  score: number;
  combo: number;
  shields: number;
  maxShields: number;
  timeLeftSec: number | null;
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
  getMetrics(): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'>;
  destroy(): void;
}
