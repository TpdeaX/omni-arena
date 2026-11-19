export type SkillAxis = 'aim' | 'rhythm' | 'logic' | 'reflex' | 'agility';

export type DifficultyId = 'chill' | 'standard' | 'hyper' | 'adaptive' | 'progressive';

export type ThemeMode = 'day' | 'night';

export type GameCategory = 'academy' | 'dexterity2d' | 'action3d' | 'circuit';

export type HubTabId = 'academy' | 'dexterity2d' | 'action3d' | 'all';

export type AcademySubFilter = 'all' | 'music' | 'iq' | 'strategy';

export type InstrumentTimbre =
  | 'piano'
  | 'organ'
  | 'soft'
  | 'bell'
  | 'guitar'
  | 'bass'
  | 'ukulele'
  | 'marimba'
  | 'flute';

export type DrumPieceId =
  | 'kick'
  | 'snare'
  | 'hihat_closed'
  | 'hihat_open'
  | 'tom_high'
  | 'tom_low'
  | 'crash'
  | 'ride';

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
  | 'track2d'
  | 'schulte2d'
  | 'nback2d'
  | 'pulse2d'
  // Academias Guiadas (15)
  | 'chess2d'
  | 'checkers2d'
  | 'poker2d'
  | 'rubik3d'
  | 'piano2d'
  | 'drums2d'
  | 'strings2d'
  | 'band2d'
  | 'raven2d'
  | 'sudoku2d'
  | 'hanoi2d'
  | 'spatial3d'
  | 'nonogram2d'
  | 'logicseq2d'
  | 'memorypath2d'
  // Circuitos
  | 'gauntlet'
  | 'ranked';

export type StandaloneGameId = Exclude<GameModeId, 'gauntlet' | 'ranked'>;

export interface ControlHint {
  keys: string[];
  touch: string;
  action: string;
  tone?: 'default' | 'primary' | 'danger';
}

export interface GuideExampleFrame {
  svg: string;
  caption: string;
}

export interface GuideExampleSpec {
  frames: GuideExampleFrame[];
}

export interface GameGuideSpec {
  objective: string;
  howToPlay: string[];
  controls: ControlHint[];
  example: GuideExampleSpec;
  practice: string;
  challenge: string;
}

export interface GameDescriptor {
  id: GameModeId;
  title: string;
  subtitle: string;
  dimension: '3D' | '2D' | '2D + 3D';
  category: GameCategory;
  axis: SkillAxis | 'all';
  accent: string;
  accentSoft: string;
  controlsPC: string;
  controlsTouch: string;
  description: string;
  keywords?: string[];
  supportsInfinite?: boolean;
  academyGroup?: Exclude<AcademySubFilter, 'all'>;
  guide: GameGuideSpec;
}

export interface RunMetrics {
  modeId: GameModeId;
  difficulty: DifficultyId;
  peakIntensity: number;
  infiniteMode?: boolean;
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
  infiniteMode?: boolean;
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
  reduceMotion?: boolean;
  difficulty: DifficultyId;
  infiniteModeDefault?: boolean;
  theme: ThemeMode;
  hubTab?: HubTabId;
  academySubFilter?: AcademySubFilter;
  skipGuideFor?: Partial<Record<GameModeId, boolean>>;
}

export interface PlayerProfile {
  xp: number;
  level: number;
  ratings: Record<SkillAxis, number>; // 0..1000
  bestScores: Record<GameModeId, number>;
  bestInfiniteScores: Record<GameModeId, number>;
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
  practiceMode?: boolean;
  infiniteMode?: boolean;
  settings: UserSettings;
  difficulty: DifficultyId;
  getIntensity: () => number;
  setHud: (hud: Partial<HudState>) => void;
  setControls?: (controls: ControlHint[]) => void;
  onOpenGuide?: () => void;
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
