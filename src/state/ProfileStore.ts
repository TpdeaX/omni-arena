import {
  ACADEMY_IDS,
  AXIS_META,
  CIRCUIT_IDS,
  DIFFICULTY_META,
  GAME_CATALOG,
  STANDALONE_IDS,
} from '../catalog.ts';
import type {
  DifficultyId,
  GameModeId,
  NeuroPillar,
  NeuroProfile,
  PlayerProfile,
  RunMetrics,
  SkillAxis,
  StandaloneGameId,
  ThemeMode,
  UserSettings,
} from '../types.ts';
import {
  applyDiagnosticBaseline,
  applyRunToNeuroProfile,
  defaultNeuroProfile,
  markCourseDayCompleted,
  normalizeNeuroProfile,
} from './NeuroStore.ts';

const STORAGE_KEY = 'omni_arena_profile_v1';
const ECO_THEME_KEY = 'umbral-theme';
const CATALOG_META_KEY = 'omni_arena_catalog_meta_v1';

const VALID_DIFFICULTIES = new Set<DifficultyId>([
  'chill',
  'standard',
  'hyper',
  'adaptive',
  'progressive',
]);

function normalizeEcoTheme(raw: string | null | undefined): 'light' | 'dark' | null {
  if (!raw) return null;
  const clean = raw.trim().toLowerCase();
  if (clean === 'light' || clean === 'day') return 'light';
  if (clean === 'dark' || clean === 'night') return 'dark';
  return null;
}

function consumeIncomingEcoTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const param = normalizeEcoTheme(url.searchParams.get('eco_theme'));
    if (param) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ECO_THEME_KEY, param);
      }
      url.searchParams.delete('eco_theme');
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(null, '', nextUrl);
      return param === 'light' ? 'day' : 'night';
    }
  } catch {
    // Ignore URL errors
  }
  return null;
}

function readStoredEcoTheme(): ThemeMode | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(ECO_THEME_KEY);
    const norm = normalizeEcoTheme(raw);
    return norm ? (norm === 'light' ? 'day' : 'night') : null;
  } catch {
    return null;
  }
}

function writeStoredEcoTheme(theme: ThemeMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ECO_THEME_KEY, theme === 'day' ? 'light' : 'dark');
    }
  } catch {
    // Ignore storage errors
  }
}

function publishArenaCatalogMeta(meta: {
  total: number;
  academies: number;
  dexterity2d: number;
  action3d: number;
}): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const payload = {
      version: 1,
      total: meta.total,
      academies: meta.academies,
      dexterity2d: meta.dexterity2d,
      action3d: meta.action3d,
      updatedAt: Date.now(),
    };
    localStorage.setItem(CATALOG_META_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function initialThemeFromEcosystem(): ThemeMode {
  const incoming = consumeIncomingEcoTheme();
  if (incoming) return incoming;
  const stored = readStoredEcoTheme();
  if (stored) return stored;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'day';
    }
  }
  return 'night';
}

function initialReduceMotion(): boolean {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return false;
}

export function createZeroModeMap(): Record<GameModeId, number> {
  const out = {} as Record<GameModeId, number>;
  (Object.keys(GAME_CATALOG) as GameModeId[]).forEach((id) => {
    out[id] = 0;
  });
  return out;
}

export function meetsInfiniteMinimum(
  durationSec: number,
  hits = 0,
  puzzlesSolved = 0
): boolean {
  const safeDur = Number.isFinite(durationSec) ? durationSec : 0;
  const safeEvents =
    (Number.isFinite(hits) ? hits : 0) + (Number.isFinite(puzzlesSolved) ? puzzlesSolved : 0);
  return safeDur >= 20 || safeEvents >= 3;
}

export function defaultProfile(): PlayerProfile {
  return {
    xp: 0,
    level: 1,
    ratings: {
      aim: 300,
      rhythm: 300,
      logic: 300,
      reflex: 300,
      agility: 300,
    },
    bestScores: createZeroModeMap(),
    bestInfiniteScores: createZeroModeMap(),
    playCounts: createZeroModeMap(),
    history: [],
    dailyStreak: 0,
    lastPlayedDay: '',
    dailyCompletedIds: [],
    settings: {
      volume: 0.65,
      muted: false,
      aimSensitivity: 1.0,
      touchControls: 'auto',
      screenShake: true,
      reduceMotion: initialReduceMotion(),
      difficulty: 'adaptive',
      infiniteModeDefault: false,
      theme: initialThemeFromEcosystem(),
      hubTab: 'academy',
      academySubFilter: 'all',
      skipGuideFor: {},
    },
    neuro: defaultNeuroProfile(),
    updatedAt: 0,
  };
}

export function normalizeProfile(parsed: Partial<PlayerProfile> | null | undefined): PlayerProfile {
  const base = defaultProfile();
  if (!parsed || typeof parsed !== 'object') return base;
  const parsedHistory = Array.isArray(parsed.history) ? parsed.history.slice(0, 30) : [];
  const rawDiff = parsed.settings?.difficulty;
  const safeDifficulty: DifficultyId =
    rawDiff && VALID_DIFFICULTIES.has(rawDiff) ? rawDiff : base.settings.difficulty;

  const mergedSettings: UserSettings = {
    ...base.settings,
    ...(parsed.settings ?? {}),
    difficulty: safeDifficulty,
    infiniteModeDefault: Boolean(parsed.settings?.infiniteModeDefault),
    skipGuideFor: {
      ...(base.settings.skipGuideFor ?? {}),
      ...(parsed.settings?.skipGuideFor ?? {}),
    },
  };
  if (!parsed.settings?.hubTab) {
    mergedSettings.hubTab = parsedHistory.length === 0 ? 'academy' : 'all';
  }
  if (!parsed.settings?.academySubFilter) {
    mergedSettings.academySubFilter = 'all';
  }
  return {
    ...base,
    ...parsed,
    ratings: { ...base.ratings, ...(parsed.ratings ?? {}) },
    bestScores: { ...base.bestScores, ...(parsed.bestScores ?? {}) },
    bestInfiniteScores: {
      ...base.bestInfiniteScores,
      ...(parsed.bestInfiniteScores ?? {}),
    },
    playCounts: { ...base.playCounts, ...(parsed.playCounts ?? {}) },
    settings: mergedSettings,
    history: parsedHistory,
    dailyCompletedIds: Array.isArray(parsed.dailyCompletedIds) ? parsed.dailyCompletedIds : [],
    neuro: normalizeNeuroProfile(parsed.neuro),
    updatedAt: Number(parsed.updatedAt) || 0,
  };
}

export function getDailyTriad(): StandaloneGameId[] {
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const pool = [...CIRCUIT_IDS];
  const picked: StandaloneGameId[] = [];
  let s = seed;
  for (let i = 0; i < 3; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const idx = s % pool.length;
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

export function computeOverallRating(ratings: Record<SkillAxis, number>): number {
  const vals = Object.values(ratings);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function ratingToRank(rating: number): {
  grade: string;
  label: string;
  color: string;
} {
  if (rating >= 900) return { grade: 'OMNI', label: 'Maestro Total', color: '#0891B2' };
  if (rating >= 800) return { grade: 'SS', label: 'Élite Multigénero', color: '#D97706' };
  if (rating >= 700) return { grade: 'S', label: 'Veterano Técnico', color: '#65A30D' };
  if (rating >= 580) return { grade: 'A', label: 'Competidor Sólido', color: '#EA580C' };
  if (rating >= 460) return { grade: 'B', label: 'Aprendiz Veloz', color: '#7B61FF' };
  if (rating >= 340) return { grade: 'C', label: 'Iniciado', color: '#64748B' };
  return { grade: 'D', label: 'Recluta', color: '#6E7F96' };
}

export function xpForLevel(level: number): number {
  return Math.round(180 * Math.pow(level, 1.35));
}

export class ProfileStore {
  private profile: PlayerProfile;
  private listeners = new Set<() => void>();
  private pushTimer = 0;

  constructor() {
    this.profile = this.load();
    const incomingTheme = consumeIncomingEcoTheme();
    if (incomingTheme) {
      this.profile.settings.theme = incomingTheme;
      this.save(false);
    } else {
      const storedEco = readStoredEcoTheme();
      if (storedEco && storedEco !== this.profile.settings.theme) {
        this.profile.settings.theme = storedEco;
        this.save(false);
      } else {
        writeStoredEcoTheme(this.profile.settings.theme);
      }
    }
    this.refreshDaily();
    this.publishCatalogMetadata();
  }

  public publishCatalogMetadata(): void {
    const dexterity2d = STANDALONE_IDS.filter(
      (id) => GAME_CATALOG[id].category === 'dexterity2d'
    ).length;
    const action3d = STANDALONE_IDS.filter(
      (id) => GAME_CATALOG[id].category === 'action3d'
    ).length;
    publishArenaCatalogMeta({
      total: STANDALONE_IDS.length,
      academies: ACADEMY_IDS.length,
      dexterity2d,
      action3d,
    });
  }

  private load(): PlayerProfile {
    try {
      if (typeof localStorage === 'undefined') return defaultProfile();
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProfile();
      return normalizeProfile(JSON.parse(raw) as Partial<PlayerProfile>);
    } catch {
      return defaultProfile();
    }
  }

  private save(syncCloud = true): void {
    this.profile.updatedAt = Date.now();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
      }
      writeStoredEcoTheme(this.profile.settings.theme);
    } catch {
      // Ignore storage quota errors
    }
    this.listeners.forEach((fn) => fn());
    if (syncCloud && typeof window !== 'undefined') {
      void import('../services/CloudSync')
        .then(({ arenaCloudSync }) => {
          const cfg = arenaCloudSync.reloadConfig();
          if (arenaCloudSync.isConfigured() && cfg.autoSync) {
            window.clearTimeout(this.pushTimer);
            this.pushTimer = window.setTimeout(() => {
              void arenaCloudSync.pushProfile(this.profile);
            }, 600);
          }
        })
        .catch(() => {});
    }
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public async pushNow(): Promise<{ ok: boolean; message: string }> {
    const { arenaCloudSync } = await import('../services/CloudSync');
    return arenaCloudSync.pushProfile(this.profile);
  }

  public async syncFromCloud(force = false): Promise<{ ok: boolean; message: string; updated: boolean }> {
    const { arenaCloudSync } = await import('../services/CloudSync');
    const res = await arenaCloudSync.pullProfile();
    if (!res.ok) return { ok: false, message: res.message, updated: false };
    if (!res.profile) {
      return { ok: true, message: res.message, updated: false };
    }
    const remoteTs = res.updatedAt || Number(res.profile.updatedAt) || 0;
    if (force || remoteTs > this.profile.updatedAt) {
      const deviceTheme = readStoredEcoTheme();
      this.profile = normalizeProfile({ ...res.profile, updatedAt: remoteTs });
      if (deviceTheme) {
        this.profile.settings.theme = deviceTheme;
      }
      this.refreshDaily(false);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
        }
        writeStoredEcoTheme(this.profile.settings.theme);
      } catch {
        // Ignore
      }
      this.listeners.forEach((fn) => fn());
      return { ok: true, message: res.message, updated: true };
    }
    return { ok: true, message: 'Progreso local al día con Supabase.', updated: false };
  }

  public applyExternalTheme(theme: ThemeMode): void {
    if (this.profile.settings.theme === theme) return;
    this.profile.settings.theme = theme;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
      }
    } catch {
      // Ignore
    }
    this.listeners.forEach((fn) => fn());
  }

  public replaceAll(raw: Partial<PlayerProfile>): void {
    this.profile = normalizeProfile(raw);
    this.save(true);
  }

  private refreshDaily(sync = true): void {
    const today = todayStamp();
    if (this.profile.lastPlayedDay && this.profile.lastPlayedDay !== today) {
      const prev = new Date(this.profile.lastPlayedDay);
      const curr = new Date(today);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        this.profile.dailyStreak = 0;
      }
      this.profile.dailyCompletedIds = [];
      this.save(sync);
    }
  }

  public get(): PlayerProfile {
    return this.profile;
  }

  public updateSettings(patch: Partial<UserSettings>): void {
    const nextDiff =
      patch.difficulty && VALID_DIFFICULTIES.has(patch.difficulty)
        ? patch.difficulty
        : this.profile.settings.difficulty;
    this.profile.settings = {
      ...this.profile.settings,
      ...patch,
      difficulty: nextDiff,
    };
    this.save();
  }

  public setSkipGuide(modeId: GameModeId, skip: boolean): void {
    const nextMap = { ...(this.profile.settings.skipGuideFor ?? {}) };
    if (skip) {
      nextMap[modeId] = true;
    } else {
      delete nextMap[modeId];
    }
    this.updateSettings({ skipGuideFor: nextMap });
  }

  public resetAllGuides(): void {
    this.updateSettings({ skipGuideFor: {} });
  }

  public resetAll(): void {
    this.profile = defaultProfile();
    this.save();
  }

  public getNeuro(): NeuroProfile {
    const norm = normalizeNeuroProfile(this.profile.neuro);
    this.profile.neuro = norm;
    return norm;
  }

  public saveDiagnosticBaseline(
    results: Partial<Record<NeuroPillar, { score: number; accuracy?: number; avgReactionMs?: number }>>
  ): NeuroProfile {
    const next = applyDiagnosticBaseline(this.getNeuro(), results);
    this.profile.neuro = next;
    this.save();
    return next;
  }

  public markNeuroActivePauseDone(): NeuroProfile {
    const curr = this.getNeuro();
    this.profile.neuro = {
      ...curr,
      dailyPlan: {
        ...curr.dailyPlan,
        activePauseDone: true,
      },
    };
    this.save();
    return this.profile.neuro;
  }

  public completeNeuroCourseDay(courseId: string, dayNumber: number): NeuroProfile {
    const next = markCourseDayCompleted(this.getNeuro(), courseId, dayNumber);
    this.profile.neuro = next;
    this.save();
    return next;
  }

  public recordPracticeRun(durationSec: number): { xpEarned: number; leveledUp: boolean } {
    const xpEarned = Math.min(60, Math.max(5, Math.round(durationSec * 0.8)));
    this.profile.xp += xpEarned;
    let leveledUp = false;
    while (this.profile.xp >= xpForLevel(this.profile.level)) {
      this.profile.xp -= xpForLevel(this.profile.level);
      this.profile.level += 1;
      leveledUp = true;
    }
    this.save();
    return { xpEarned, leveledUp };
  }

  public recordRun(metrics: RunMetrics): {
    ratingDeltas: Partial<Record<SkillAxis, number>>;
    xpEarned: number;
    leveledUp: boolean;
    isNewBest: boolean;
    runRank: string;
    qualifiedForRank: boolean;
    coachingTips: string[];
  } {
    const today = todayStamp();
    const ratingDeltas: Partial<Record<SkillAxis, number>> = {};
    const isInf = Boolean(metrics.infiniteMode);
    const qualifiedForRank =
      !isInf ||
      meetsInfiniteMinimum(metrics.durationSec, metrics.hits ?? 0, metrics.puzzlesSolved ?? 0);

    this.profile.playCounts[metrics.modeId] = (this.profile.playCounts[metrics.modeId] ?? 0) + 1;

    if (!qualifiedForRank) {
      const xpEarned = Math.max(5, Math.min(20, Math.round(metrics.durationSec * 0.5)));
      this.profile.xp += xpEarned;
      let leveledUp = false;
      while (this.profile.xp >= xpForLevel(this.profile.level)) {
        this.profile.xp -= xpForLevel(this.profile.level);
        this.profile.level += 1;
        leveledUp = true;
      }
      this.save();
      return {
        ratingDeltas: {},
        xpEarned,
        leveledUp,
        isNewBest: false,
        runRank: 'C',
        qualifiedForRank: false,
        coachingTips: [
          'Sesión infinita finalizada antes del umbral mínimo (20s activos o 3 aciertos/rondas): no altera tu radar ni racha diaria.',
        ],
      };
    }

    const intensityBonus = Math.max(0, Math.round((metrics.peakIntensity - 1) * 90));
    for (const [axisKey, perfRaw] of Object.entries(metrics.axisPerformances)) {
      const axis = axisKey as SkillAxis;
      const perf = Math.max(80, Math.min(1000, Math.round((perfRaw ?? 300) + intensityBonus)));
      const current = this.profile.ratings[axis];
      const alpha = perf >= current ? 0.28 : 0.14;
      const next = Math.max(100, Math.min(1000, Math.round(current + (perf - current) * alpha)));
      ratingDeltas[axis] = next - current;
      this.profile.ratings[axis] = next;
    }

    let isNewBest = false;
    if (isInf) {
      const prevInf = this.profile.bestInfiniteScores[metrics.modeId] ?? 0;
      isNewBest = metrics.score > prevInf;
      if (isNewBest) {
        this.profile.bestInfiniteScores[metrics.modeId] = metrics.score;
      }
    } else {
      const prevBest = this.profile.bestScores[metrics.modeId] ?? 0;
      isNewBest = metrics.score > prevBest;
      if (isNewBest) {
        this.profile.bestScores[metrics.modeId] = metrics.score;
      }
    }

    const triad = getDailyTriad();
    if (
      triad.includes(metrics.modeId as StandaloneGameId) &&
      !this.profile.dailyCompletedIds.includes(metrics.modeId as StandaloneGameId)
    ) {
      this.profile.dailyCompletedIds.push(metrics.modeId as StandaloneGameId);
      if (this.profile.lastPlayedDay !== today) {
        this.profile.dailyStreak += 1;
        this.profile.lastPlayedDay = today;
      }
    } else if (!this.profile.lastPlayedDay) {
      this.profile.lastPlayedDay = today;
    }

    const xpEarned = Math.max(
      25,
      Math.round(metrics.score * 0.04 + metrics.durationSec * 1.4 + (isNewBest ? 60 : 0))
    );
    this.profile.xp += xpEarned;
    let leveledUp = false;
    while (this.profile.xp >= xpForLevel(this.profile.level)) {
      this.profile.xp -= xpForLevel(this.profile.level);
      this.profile.level += 1;
      leveledUp = true;
    }

    const perfList = Object.values(metrics.axisPerformances).filter(
      (v): v is number => typeof v === 'number'
    );
    const avgPerf = perfList.length
      ? perfList.reduce((a, b) => a + b, 0) / perfList.length
      : Math.min(950, 280 + metrics.score * 0.12);
    const runRank = ratingToRank(avgPerf).grade;

    this.profile.history.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      modeId: metrics.modeId,
      difficulty: metrics.difficulty,
      infiniteMode: isInf,
      score: metrics.score,
      rank: runRank,
      timestamp: Date.now(),
      durationSec: Math.round(metrics.durationSec),
    });
    this.profile.history = this.profile.history.slice(0, 25);

    // Sync cognitive metrics into NeuroLab profile (pillars, micro-levels 1..300, daily plan & history)
    const neuroUpdate = applyRunToNeuroProfile(
      normalizeNeuroProfile(this.profile.neuro),
      metrics,
      today
    );
    this.profile.neuro = neuroUpdate.next;

    this.save();

    return {
      ratingDeltas,
      xpEarned,
      leveledUp,
      isNewBest,
      runRank,
      qualifiedForRank: true,
      coachingTips: this.buildCoachingTips(metrics),
    };
  }

  private buildCoachingTips(metrics: RunMetrics): string[] {
    const tips: string[] = [];
    if (typeof metrics.accuracy === 'number') {
      if (metrics.accuracy < 65) {
        tips.push(
          `Precisión en ${metrics.accuracy.toFixed(0)}%: prioriza asegurar cada clic o nota antes de acelerar.`
        );
      } else if (metrics.accuracy >= 90) {
        tips.push(
          `Precisión sobresaliente (${metrics.accuracy.toFixed(0)}%): ya puedes arriesgar transiciones más rápidas.`
        );
      }
    }
    if (typeof metrics.avgReactionMs === 'number' && metrics.avgReactionMs > 0) {
      if (metrics.avgReactionMs > 480) {
        tips.push(
          `Reacción media de ${Math.round(metrics.avgReactionMs)} ms: anticipa el siguiente blanco con la mirada periférica.`
        );
      } else if (metrics.avgReactionMs < 310) {
        tips.push(`Reflejo veloz de ${Math.round(metrics.avgReactionMs)} ms: nivel competitivo.`);
      }
    }
    if (typeof metrics.grazes === 'number' && metrics.grazes >= 8) {
      tips.push(`Buen control fino: lograste ${metrics.grazes} rozamientos sin daño.`);
    }
    if (!metrics.survived) {
      tips.push('Te quedaste sin escudos antes del cierre: prueba Práctica Guiada para dominar el patrón.');
    }
    if (
      (metrics.difficulty === 'adaptive' || metrics.difficulty === 'progressive') &&
      metrics.peakIntensity >= 1.35
    ) {
      tips.push(
        `Alcanzaste intensidad ${metrics.peakIntensity.toFixed(2)}× (${DIFFICULTY_META[metrics.difficulty].label}): el sistema escaló la exigencia.`
      );
    }

    const entries = Object.entries(this.profile.ratings) as [SkillAxis, number][];
    entries.sort((a, b) => a[1] - b[1]);
    const weakest = entries[0];
    if (weakest) {
      const meta = AXIS_META[weakest[0]];
      const targetMode: Record<SkillAxis, GameModeId> = {
        aim: 'aim3d',
        rhythm: 'rhythm2d',
        logic: 'puzzle2d',
        reflex: 'bullet2d',
        agility: 'runner3d',
      };
      const recName = GAME_CATALOG[targetMode[weakest[0]]].title;
      tips.push(
        `Tu área más baja es ${meta.label} (${weakest[1]} pts). Practica ${recName} para equilibrar tu radar.`
      );
    }

    return tips.slice(0, 3);
  }
}

export const profileStore = new ProfileStore();
