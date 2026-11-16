import { AXIS_META, GAME_CATALOG, STANDALONE_IDS } from '../catalog';
import {
  GameModeId,
  PlayerProfile,
  RunMetrics,
  SkillAxis,
  StandaloneGameId,
  UserSettings,
} from '../types';

const STORAGE_KEY = 'omni_arena_profile_v1';

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultProfile(): PlayerProfile {
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
    bestScores: {
      aim3d: 0,
      runner3d: 0,
      cube3d: 0,
      parkour3d: 0,
      rhythm2d: 0,
      parry2d: 0,
      bullet2d: 0,
      puzzle2d: 0,
      tetris2d: 0,
      twinstick2d: 0,
      gauntlet: 0,
      ranked: 0,
    },
    playCounts: {
      aim3d: 0,
      runner3d: 0,
      cube3d: 0,
      parkour3d: 0,
      rhythm2d: 0,
      parry2d: 0,
      bullet2d: 0,
      puzzle2d: 0,
      tetris2d: 0,
      twinstick2d: 0,
      gauntlet: 0,
      ranked: 0,
    },
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
      difficulty: 'adaptive',
    },
  };
}

export function getDailyTriad(): StandaloneGameId[] {
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const pool = [...STANDALONE_IDS];
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
  if (rating >= 900) return { grade: 'OMNI', label: 'Maestro Total', color: '#00E5FF' };
  if (rating >= 800) return { grade: 'SS', label: 'Élite Multigénero', color: '#FFB800' };
  if (rating >= 700) return { grade: 'S', label: 'Veterano Técnico', color: '#A6FF00' };
  if (rating >= 580) return { grade: 'A', label: 'Competidor Sólido', color: '#FF6B4A' };
  if (rating >= 460) return { grade: 'B', label: 'Aprendiz Veloz', color: '#7B61FF' };
  if (rating >= 340) return { grade: 'C', label: 'Iniciado', color: '#9FB0C7' };
  return { grade: 'D', label: 'Recluta', color: '#6E7F96' };
}

export function xpForLevel(level: number): number {
  return Math.round(180 * Math.pow(level, 1.35));
}

export class ProfileStore {
  private profile: PlayerProfile;

  constructor() {
    this.profile = this.load();
    this.refreshDaily();
  }

  private load(): PlayerProfile {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProfile();
      const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
      const base = defaultProfile();
      return {
        ...base,
        ...parsed,
        ratings: { ...base.ratings, ...(parsed.ratings ?? {}) },
        bestScores: { ...base.bestScores, ...(parsed.bestScores ?? {}) },
        playCounts: { ...base.playCounts, ...(parsed.playCounts ?? {}) },
        settings: { ...base.settings, ...(parsed.settings ?? {}) },
        history: Array.isArray(parsed.history) ? parsed.history.slice(0, 30) : [],
        dailyCompletedIds: Array.isArray(parsed.dailyCompletedIds) ? parsed.dailyCompletedIds : [],
      };
    } catch {
      return defaultProfile();
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
    } catch {
      // Ignore storage quota errors
    }
  }

  private refreshDaily(): void {
    const today = todayStamp();
    if (this.profile.lastPlayedDay && this.profile.lastPlayedDay !== today) {
      const prev = new Date(this.profile.lastPlayedDay);
      const curr = new Date(today);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        this.profile.dailyStreak = 0;
      }
      this.profile.dailyCompletedIds = [];
      this.save();
    }
  }

  public get(): PlayerProfile {
    return this.profile;
  }

  public updateSettings(patch: Partial<UserSettings>): void {
    this.profile.settings = { ...this.profile.settings, ...patch };
    this.save();
  }

  public resetAll(): void {
    this.profile = defaultProfile();
    this.save();
  }

  public recordRun(metrics: RunMetrics): {
    ratingDeltas: Partial<Record<SkillAxis, number>>;
    xpEarned: number;
    leveledUp: boolean;
    isNewBest: boolean;
    runRank: string;
    coachingTips: string[];
  } {
    const today = todayStamp();
    const ratingDeltas: Partial<Record<SkillAxis, number>> = {};

    // Update each skill axis involved in this run via weighted Elo smoothing
    const intensityBonus = Math.max(0, Math.round((metrics.peakIntensity - 1) * 90));
    for (const [axisKey, perfRaw] of Object.entries(metrics.axisPerformances)) {
      const axis = axisKey as SkillAxis;
      const perf = Math.max(80, Math.min(1000, Math.round((perfRaw ?? 300) + intensityBonus)));
      const current = this.profile.ratings[axis];
      // Faster upward gain when performing above rating; softer downward pull
      const alpha = perf >= current ? 0.28 : 0.14;
      const next = Math.max(100, Math.min(1000, Math.round(current + (perf - current) * alpha)));
      ratingDeltas[axis] = next - current;
      this.profile.ratings[axis] = next;
    }

    const prevBest = this.profile.bestScores[metrics.modeId] ?? 0;
    const isNewBest = metrics.score > prevBest;
    if (isNewBest) {
      this.profile.bestScores[metrics.modeId] = metrics.score;
    }
    this.profile.playCounts[metrics.modeId] = (this.profile.playCounts[metrics.modeId] ?? 0) + 1;

    // Daily triad check
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

    // XP & leveling
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

    // Run grade based on average axis performance achieved
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
      score: metrics.score,
      rank: runRank,
      timestamp: Date.now(),
      durationSec: Math.round(metrics.durationSec),
    });
    this.profile.history = this.profile.history.slice(0, 25);

    this.save();

    return {
      ratingDeltas,
      xpEarned,
      leveledUp,
      isNewBest,
      runRank,
      coachingTips: this.buildCoachingTips(metrics),
    };
  }

  private buildCoachingTips(metrics: RunMetrics): string[] {
    const tips: string[] = [];
    if (typeof metrics.accuracy === 'number') {
      if (metrics.accuracy < 65) {
        tips.push(
          `Precisión en ${metrics.accuracy.toFixed(0)}%: prioriza asegurar cada clic/nota antes de acelerar.`
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
      tips.push(`Buen control fino: lograste ${metrics.grazes} rozamientos (Graze) sin daño.`);
    }
    if (!metrics.survived) {
      tips.push('Te quedaste sin escudos antes del cierre: usa el modo lento/dash en picos de peligro.');
    }
    if (metrics.difficulty === 'adaptive' && metrics.peakIntensity >= 1.35) {
      tips.push(
        `Alcanzaste intensidad dinámica ${metrics.peakIntensity.toFixed(2)}×: el sistema escaló la velocidad para exigirte más.`
      );
    }

    // Suggest weakest axis overall
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
