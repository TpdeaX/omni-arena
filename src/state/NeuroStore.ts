import type {
  GameModeId,
  NeuroCourseProgress,
  NeuroDailyPlan,
  NeuroDailyStep,
  NeuroHistoryEntry,
  NeuroPillar,
  NeuroPillarScores,
  NeuroProfile,
  RunMetrics,
  StandaloneGameId,
} from '../types.ts';

export const NEURO_PILLARS: readonly NeuroPillar[] = ['memory', 'attention', 'speed', 'reasoning'];

export const NEURO_PILLAR_META: Record<
  NeuroPillar,
  { id: NeuroPillar; label: string; short: string; accent: string; desc: string }
> = {
  memory: {
    id: 'memory',
    label: 'Memoria de Trabajo',
    short: 'MEMORIA',
    accent: '#6366F1',
    desc: 'Retención activa, rutas Corsi directas/inversas, N-Back y Palacio Mental.',
  },
  attention: {
    id: 'attention',
    label: 'Atención y Vigilancia',
    short: 'ATENCIÓN',
    accent: '#0EA5E9',
    desc: 'Vigilancia sostenida (Mackworth), rastreo múltiple (MOT) y visión periférica.',
  },
  speed: {
    id: 'speed',
    label: 'Velocidad Mental',
    short: 'VELOCIDAD',
    accent: '#F59E0B',
    desc: 'Procesamiento visual WAIS, cálculo encadenado y agilidad verbal.',
  },
  reasoning: {
    id: 'reasoning',
    label: 'Razonamiento y Flexibilidad',
    short: 'RAZONAMIENTO',
    accent: '#EC4899',
    desc: 'Cambio de reglas Stroop/Go-No-Go, matrices Raven, lógica y rotación 3D.',
  },
};

export const NEURO_MODE_PILLAR: Partial<Record<StandaloneGameId, NeuroPillar>> = {
  // Memoria
  pathfinder2d: 'memory',
  nback2d: 'memory',
  memory2d: 'memory',
  memorypath2d: 'memory',
  // Atención
  mackworth2d: 'attention',
  mot2d: 'attention',
  schulte2d: 'attention',
  track2d: 'attention',
  parry2d: 'attention',
  // Velocidad
  symbolspeed2d: 'speed',
  chainmath2d: 'speed',
  verbal2d: 'speed',
  puzzle2d: 'speed',
  // Razonamiento
  colorcraze2d: 'reasoning',
  raven2d: 'reasoning',
  spatial3d: 'reasoning',
  logicseq2d: 'reasoning',
  sudoku2d: 'reasoning',
  nonogram2d: 'reasoning',
};

export const PILLAR_MODES: Record<NeuroPillar, StandaloneGameId[]> = {
  memory: ['pathfinder2d', 'nback2d', 'memorypath2d', 'memory2d'],
  attention: ['mackworth2d', 'mot2d', 'schulte2d', 'track2d', 'parry2d'],
  speed: ['symbolspeed2d', 'chainmath2d', 'verbal2d', 'puzzle2d'],
  reasoning: ['colorcraze2d', 'raven2d', 'spatial3d', 'logicseq2d', 'sudoku2d', 'nonogram2d'],
};

export const NEUROLAB_CORE_IDS: StandaloneGameId[] = [
  'mackworth2d',
  'chainmath2d',
  'colorcraze2d',
  'mot2d',
  'pathfinder2d',
  'symbolspeed2d',
  'verbal2d',
];

export interface NeuroDiagnosticStage {
  pillar: NeuroPillar;
  modeId: StandaloneGameId;
  durationSec: number;
  title: string;
}

export const DIAGNOSTIC_STAGES: readonly NeuroDiagnosticStage[] = [
  { pillar: 'memory', modeId: 'pathfinder2d', durationSec: 25, title: 'Pilar 1/4 · Memoria de Trabajo' },
  { pillar: 'attention', modeId: 'mackworth2d', durationSec: 25, title: 'Pilar 2/4 · Atención y Vigilancia' },
  { pillar: 'speed', modeId: 'symbolspeed2d', durationSec: 25, title: 'Pilar 3/4 · Velocidad de Procesamiento' },
  { pillar: 'reasoning', modeId: 'colorcraze2d', durationSec: 25, title: 'Pilar 4/4 · Flexibilidad e Inhibición' },
];

export interface NeuroCourseSpec {
  id: string;
  title: string;
  subtitle: string;
  days: number;
  pillar: NeuroPillar;
  accent: string;
  description: string;
  dayModes: StandaloneGameId[];
}

export const NEURO_COURSES: readonly NeuroCourseSpec[] = [
  {
    id: 'memowork',
    title: 'MemoWork',
    subtitle: '14 días · Memoria de Trabajo',
    days: 14,
    pillar: 'memory',
    accent: '#6366F1',
    description:
      'Expande tu capacidad de retención activa combinando secuencias Corsi inversas, Dual N-Back y Palacio Mental.',
    dayModes: [
      'pathfinder2d',
      'nback2d',
      'memory2d',
      'pathfinder2d',
      'memorypath2d',
      'nback2d',
      'pathfinder2d',
      'memorypath2d',
      'nback2d',
      'pathfinder2d',
      'memory2d',
      'memorypath2d',
      'nback2d',
      'pathfinder2d',
    ],
  },
  {
    id: 'foco',
    title: 'Foco Inquebrantable',
    subtitle: '14 días · Atención y Vigilancia',
    days: 14,
    pillar: 'attention',
    accent: '#0EA5E9',
    description:
      'Entrena vigilancia sostenida sin fatiga con el Reloj de Mackworth, Rastreo Múltiple MOT y lectura periférica Schulte.',
    dayModes: [
      'mackworth2d',
      'mot2d',
      'schulte2d',
      'mackworth2d',
      'mot2d',
      'track2d',
      'mackworth2d',
      'schulte2d',
      'mot2d',
      'parry2d',
      'mackworth2d',
      'mot2d',
      'schulte2d',
      'mackworth2d',
    ],
  },
  {
    id: 'velocidad',
    title: 'Velocidad Mental',
    subtitle: '14 días · Cálculo y Procesamiento',
    days: 14,
    pillar: 'speed',
    accent: '#F59E0B',
    description:
      'Acelera tu velocidad de procesamiento visual, cálculo mental encadenado y acceso léxico en español.',
    dayModes: [
      'symbolspeed2d',
      'chainmath2d',
      'verbal2d',
      'symbolspeed2d',
      'chainmath2d',
      'puzzle2d',
      'verbal2d',
      'symbolspeed2d',
      'chainmath2d',
      'verbal2d',
      'symbolspeed2d',
      'chainmath2d',
      'verbal2d',
      'symbolspeed2d',
    ],
  },
  {
    id: 'flexible',
    title: 'Mente Flexible Pro',
    subtitle: '28 días · Razonamiento, Inhibición y Estrategia',
    days: 28,
    pillar: 'reasoning',
    accent: '#EC4899',
    description:
      'Programa completo de 4 semanas para control ejecutivo, cambio de reglas, deducción abstracta y agilidad espacial.',
    dayModes: [
      'colorcraze2d',
      'raven2d',
      'logicseq2d',
      'colorcraze2d',
      'spatial3d',
      'sudoku2d',
      'nonogram2d',
      'colorcraze2d',
      'chainmath2d',
      'raven2d',
      'pathfinder2d',
      'logicseq2d',
      'colorcraze2d',
      'spatial3d',
      'mackworth2d',
      'raven2d',
      'sudoku2d',
      'colorcraze2d',
      'verbal2d',
      'nonogram2d',
      'mot2d',
      'logicseq2d',
      'colorcraze2d',
      'symbolspeed2d',
      'raven2d',
      'spatial3d',
      'nback2d',
      'colorcraze2d',
    ],
  },
];

export function neuroTodayStamp(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export function clampNeuroScore(val: number): number {
  if (!Number.isFinite(val)) return 300;
  return Math.max(0, Math.min(1000, Math.round(val)));
}

export function clampMicroLevel(val: number): number {
  if (!Number.isFinite(val)) return 1;
  return Math.max(1, Math.min(300, Math.round(val)));
}

export function computeNeuroScore(pillars: NeuroPillarScores): number {
  const sum = pillars.memory + pillars.attention + pillars.speed + pillars.reasoning;
  return clampNeuroScore(sum / 4);
}

export function computePercentile(samples: readonly number[], pct: number): number {
  const clean = samples.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (clean.length === 0) return 0;
  const idx = Math.min(clean.length - 1, Math.max(0, Math.ceil((pct / 100) * clean.length) - 1));
  return Math.round(clean[idx]);
}

function daySeed(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function generateDailyPlan(pillars: NeuroPillarScores, day = neuroTodayStamp()): NeuroDailyPlan {
  const sorted = [...NEURO_PILLARS].sort((a, b) => pillars[a] - pillars[b]);
  const weakest = sorted[0];
  const reinforceA = sorted[1];
  const reinforceB = sorted[2];
  const seed = daySeed(day);

  const weakPool = PILLAR_MODES[weakest];
  const w1 = weakPool[seed % weakPool.length];
  const w2 = weakPool[(seed + 1) % weakPool.length];
  const r1 = PILLAR_MODES[reinforceA][(seed >>> 3) % PILLAR_MODES[reinforceA].length];
  const r2 = PILLAR_MODES[reinforceB][(seed >>> 6) % PILLAR_MODES[reinforceB].length];

  const steps: NeuroDailyStep[] = [
    { modeId: w1, pillar: weakest, completed: false },
    { modeId: r1, pillar: reinforceA, completed: false },
    { modeId: w2, pillar: weakest, completed: false },
    { modeId: r2, pillar: reinforceB, completed: false },
  ];

  return {
    day,
    steps,
    activePauseDone: false,
  };
}

export function defaultNeuroProfile(day = neuroTodayStamp()): NeuroProfile {
  const pillars: NeuroPillarScores = {
    memory: 320,
    attention: 320,
    speed: 320,
    reasoning: 320,
  };
  return {
    pillars,
    neuroScore: computeNeuroScore(pillars),
    baselineCompleted: false,
    history: [],
    dailyPlan: generateDailyPlan(pillars, day),
    courses: {},
    microLevelByMode: {},
    reactionHistoryMs: [],
  };
}

export function normalizeNeuroProfile(
  raw: Partial<NeuroProfile> | null | undefined,
  day = neuroTodayStamp()
): NeuroProfile {
  const base = defaultNeuroProfile(day);
  if (!raw || typeof raw !== 'object') return base;

  const pillars: NeuroPillarScores = {
    memory: clampNeuroScore(raw.pillars?.memory ?? base.pillars.memory),
    attention: clampNeuroScore(raw.pillars?.attention ?? base.pillars.attention),
    speed: clampNeuroScore(raw.pillars?.speed ?? base.pillars.speed),
    reasoning: clampNeuroScore(raw.pillars?.reasoning ?? base.pillars.reasoning),
  };

  const history: NeuroHistoryEntry[] = Array.isArray(raw.history)
    ? raw.history
        .filter((h) => h && typeof h === 'object' && typeof h.day === 'string')
        .slice(-60)
        .map((h) => ({
          day: h.day,
          neuroScore: clampNeuroScore(h.neuroScore),
          pillars: {
            memory: clampNeuroScore(h.pillars?.memory ?? pillars.memory),
            attention: clampNeuroScore(h.pillars?.attention ?? pillars.attention),
            speed: clampNeuroScore(h.pillars?.speed ?? pillars.speed),
            reasoning: clampNeuroScore(h.pillars?.reasoning ?? pillars.reasoning),
          },
          avgReactionMs: Math.max(0, Math.round(Number(h.avgReactionMs) || 0)),
          p90ReactionMs: Math.max(0, Math.round(Number(h.p90ReactionMs) || 0)),
          sessions: Math.max(1, Math.round(Number(h.sessions) || 1)),
        }))
    : [];

  let dailyPlan: NeuroDailyPlan;
  if (
    raw.dailyPlan &&
    typeof raw.dailyPlan === 'object' &&
    raw.dailyPlan.day === day &&
    Array.isArray(raw.dailyPlan.steps) &&
    raw.dailyPlan.steps.length === 4
  ) {
    dailyPlan = {
      day,
      steps: raw.dailyPlan.steps.map((s) => ({
        modeId: s.modeId,
        pillar: s.pillar,
        completed: Boolean(s.completed),
        score: typeof s.score === 'number' ? s.score : undefined,
        reactionMs: typeof s.reactionMs === 'number' ? s.reactionMs : undefined,
      })),
      activePauseDone: Boolean(raw.dailyPlan.activePauseDone),
    };
  } else {
    dailyPlan = generateDailyPlan(pillars, day);
  }

  const courses: Record<string, NeuroCourseProgress> = {};
  if (raw.courses && typeof raw.courses === 'object') {
    for (const [cid, prog] of Object.entries(raw.courses)) {
      if (prog && typeof prog === 'object') {
        courses[cid] = {
          startedAt: Number(prog.startedAt) || Date.now(),
          completedDays: Array.isArray(prog.completedDays)
            ? Array.from(new Set(prog.completedDays.map((d) => Math.max(1, Math.round(Number(d) || 1)))))
            : [],
          currentLevel: clampMicroLevel(prog.currentLevel ?? 1),
        };
      }
    }
  }

  const microLevelByMode: Record<string, number> = {};
  if (raw.microLevelByMode && typeof raw.microLevelByMode === 'object') {
    for (const [k, v] of Object.entries(raw.microLevelByMode)) {
      microLevelByMode[k] = clampMicroLevel(Number(v) || 1);
    }
  }

  const reactionHistoryMs = Array.isArray(raw.reactionHistoryMs)
    ? raw.reactionHistoryMs
        .map((n) => Math.round(Number(n) || 0))
        .filter((n) => n >= 60 && n <= 8000)
        .slice(-80)
    : [];

  return {
    pillars,
    neuroScore: computeNeuroScore(pillars),
    baselineCompleted: Boolean(raw.baselineCompleted),
    history,
    dailyPlan,
    courses,
    microLevelByMode,
    reactionHistoryMs,
  };
}

export function getMicroLevel(neuro: NeuroProfile, modeId: string): number {
  return clampMicroLevel(neuro.microLevelByMode[modeId] ?? 1);
}

export function applyRunToNeuroProfile(
  current: NeuroProfile,
  metrics: RunMetrics,
  day = neuroTodayStamp()
): {
  next: NeuroProfile;
  pillarAffected: NeuroPillar | null;
  pillarDelta: number;
  newMicroLevel: number;
} {
  const modeId = metrics.modeId as StandaloneGameId;
  const pillar = NEURO_MODE_PILLAR[modeId] ?? null;
  const normalized = normalizeNeuroProfile(current, day);

  if (!pillar) {
    return {
      next: normalized,
      pillarAffected: null,
      pillarDelta: 0,
      newMicroLevel: getMicroLevel(normalized, modeId),
    };
  }

  const axisVals = Object.values(metrics.axisPerformances).filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  );
  const rawPerf =
    axisVals.length > 0
      ? axisVals.reduce((a, b) => a + b, 0) / axisVals.length
      : Math.min(960, 260 + metrics.score * 0.14);

  const accBonus = typeof metrics.accuracy === 'number' ? (metrics.accuracy - 65) * 2.2 : 0;
  const targetPerf = clampNeuroScore(rawPerf + accBonus);
  const prevPillarScore = normalized.pillars[pillar];
  const alpha = targetPerf >= prevPillarScore ? 0.28 : 0.14;
  const nextPillarScore = clampNeuroScore(prevPillarScore + (targetPerf - prevPillarScore) * alpha);
  const pillarDelta = nextPillarScore - prevPillarScore;

  const nextPillars: NeuroPillarScores = {
    ...normalized.pillars,
    [pillar]: nextPillarScore,
  };
  const nextNeuroScore = computeNeuroScore(nextPillars);

  // Adaptive micro-level 1..300
  const prevMicro = getMicroLevel(normalized, modeId);
  const acc = typeof metrics.accuracy === 'number' ? metrics.accuracy : metrics.survived ? 75 : 45;
  let microDelta = 0;
  if (acc >= 88 && metrics.survived) microDelta = 8;
  else if (acc >= 75 && metrics.survived) microDelta = 4;
  else if (acc >= 60) microDelta = 1;
  else microDelta = -3;
  const newMicroLevel = clampMicroLevel(prevMicro + microDelta);

  const nextMicroMap = {
    ...normalized.microLevelByMode,
    [modeId]: newMicroLevel,
  };

  // Reaction samples
  const nextRxHistory = [...(normalized.reactionHistoryMs ?? [])];
  if (typeof metrics.avgReactionMs === 'number' && metrics.avgReactionMs >= 60 && metrics.avgReactionMs <= 8000) {
    nextRxHistory.push(Math.round(metrics.avgReactionMs));
  }
  const trimmedRx = nextRxHistory.slice(-80);
  const p50 = computePercentile(trimmedRx, 50);
  const p90 = computePercentile(trimmedRx, 90);

  // Update daily plan step if matching first incomplete step for this mode
  const nextSteps = normalized.dailyPlan.steps.map((s) => ({ ...s }));
  const matchStep = nextSteps.find((s) => s.modeId === modeId && !s.completed);
  if (matchStep) {
    matchStep.completed = true;
    matchStep.score = metrics.score;
    matchStep.reactionMs = metrics.avgReactionMs;
  }

  // Upsert today's history entry
  const nextHistory = normalized.history.map((h) => ({ ...h, pillars: { ...h.pillars } }));
  const existingIdx = nextHistory.findIndex((h) => h.day === day);
  if (existingIdx >= 0) {
    const prevEntry = nextHistory[existingIdx];
    const totalSess = prevEntry.sessions + 1;
    const blendedAvg =
      typeof metrics.avgReactionMs === 'number' && metrics.avgReactionMs > 0
        ? prevEntry.avgReactionMs > 0
          ? Math.round((prevEntry.avgReactionMs * prevEntry.sessions + metrics.avgReactionMs) / totalSess)
          : Math.round(metrics.avgReactionMs)
        : prevEntry.avgReactionMs || p50;
    nextHistory[existingIdx] = {
      day,
      neuroScore: nextNeuroScore,
      pillars: { ...nextPillars },
      avgReactionMs: blendedAvg,
      p90ReactionMs: Math.max(prevEntry.p90ReactionMs, p90 || blendedAvg),
      sessions: totalSess,
    };
  } else {
    nextHistory.push({
      day,
      neuroScore: nextNeuroScore,
      pillars: { ...nextPillars },
      avgReactionMs:
        typeof metrics.avgReactionMs === 'number' && metrics.avgReactionMs > 0
          ? Math.round(metrics.avgReactionMs)
          : p50,
      p90ReactionMs: p90 || Math.round(metrics.avgReactionMs ?? 0),
      sessions: 1,
    });
  }

  return {
    next: {
      ...normalized,
      pillars: nextPillars,
      neuroScore: nextNeuroScore,
      history: nextHistory.slice(-60),
      dailyPlan: {
        ...normalized.dailyPlan,
        steps: nextSteps,
      },
      microLevelByMode: nextMicroMap,
      reactionHistoryMs: trimmedRx,
    },
    pillarAffected: pillar,
    pillarDelta,
    newMicroLevel,
  };
}

export function applyDiagnosticBaseline(
  current: NeuroProfile,
  results: Partial<Record<NeuroPillar, { score: number; accuracy?: number; avgReactionMs?: number }>>,
  day = neuroTodayStamp()
): NeuroProfile {
  const normalized = normalizeNeuroProfile(current, day);
  const nextPillars: NeuroPillarScores = { ...normalized.pillars };
  const rxList = [...(normalized.reactionHistoryMs ?? [])];

  for (const pillar of NEURO_PILLARS) {
    const r = results[pillar];
    if (!r) continue;
    const accPart = typeof r.accuracy === 'number' ? r.accuracy * 4.5 : 260;
    const scorePart = Math.min(420, r.score * 0.28);
    const rxBonus =
      typeof r.avgReactionMs === 'number' && r.avgReactionMs > 0
        ? Math.max(0, Math.min(180, Math.round((1100 - r.avgReactionMs) * 0.22)))
        : 60;
    nextPillars[pillar] = clampNeuroScore(160 + accPart + scorePart + rxBonus);
    if (typeof r.avgReactionMs === 'number' && r.avgReactionMs >= 60 && r.avgReactionMs <= 8000) {
      rxList.push(Math.round(r.avgReactionMs));
    }
  }

  const nextNeuroScore = computeNeuroScore(nextPillars);
  const trimmedRx = rxList.slice(-80);
  const nextHistory = normalized.history.filter((h) => h.day !== day);
  nextHistory.push({
    day,
    neuroScore: nextNeuroScore,
    pillars: { ...nextPillars },
    avgReactionMs: computePercentile(trimmedRx, 50),
    p90ReactionMs: computePercentile(trimmedRx, 90),
    sessions: Math.max(1, (normalized.history.find((h) => h.day === day)?.sessions ?? 0) + 1),
  });

  return {
    ...normalized,
    pillars: nextPillars,
    neuroScore: nextNeuroScore,
    baselineCompleted: true,
    dailyPlan: generateDailyPlan(nextPillars, day),
    history: nextHistory.slice(-60),
    reactionHistoryMs: trimmedRx,
  };
}

export function markCourseDayCompleted(
  current: NeuroProfile,
  courseId: string,
  dayNumber: number,
  day = neuroTodayStamp()
): NeuroProfile {
  const normalized = normalizeNeuroProfile(current, day);
  const courseSpec = NEURO_COURSES.find((c) => c.id === courseId);
  if (!courseSpec) return normalized;

  const existing = normalized.courses[courseId] ?? {
    startedAt: Date.now(),
    completedDays: [],
    currentLevel: 1,
  };

  const safeDay = Math.max(1, Math.min(courseSpec.days, Math.round(dayNumber)));
  const completedDays = existing.completedDays.includes(safeDay)
    ? [...existing.completedDays]
    : [...existing.completedDays, safeDay].sort((a, b) => a - b);

  return {
    ...normalized,
    courses: {
      ...normalized.courses,
      [courseId]: {
        ...existing,
        completedDays,
        currentLevel: clampMicroLevel(existing.currentLevel + 5),
      },
    },
  };
}

// ==================== VITALITY CORRELATION (ATELIER DIARIO) ====================

export interface VitalityDayLog {
  day: string;
  sleepHours?: number;
  energyLevel?: number;
  externalWorkout?: boolean;
}

export interface VitalityCorrelationReport {
  hasAtelierData: boolean;
  matchedDays: number;
  goodSleepAvgRxMs: number | null;
  shortSleepAvgRxMs: number | null;
  sleepDeltaMs: number | null;
  workoutAvgScore: number | null;
  restAvgScore: number | null;
  insights: string[];
}

export function parseAtelierVitalityLogs(raw: unknown): VitalityDayLog[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  const progress = obj.progress as Record<string, unknown> | undefined;
  const vitality = (progress?.vitality ?? obj.vitality) as Record<string, unknown> | undefined;
  const dayLogs = vitality?.dayLogs;
  if (!dayLogs) return [];

  const out: VitalityDayLog[] = [];
  if (Array.isArray(dayLogs)) {
    for (const item of dayLogs) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const day = String(rec.day ?? rec.date ?? '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      out.push({
        day,
        sleepHours: typeof rec.sleepHours === 'number' ? rec.sleepHours : undefined,
        energyLevel: typeof rec.energyLevel === 'number' ? rec.energyLevel : undefined,
        externalWorkout: Boolean(rec.externalWorkout || rec.workout || rec.exercise),
      });
    }
  } else if (typeof dayLogs === 'object') {
    for (const [k, v] of Object.entries(dayLogs as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const rec = v as Record<string, unknown>;
      const day = (/^\d{4}-\d{2}-\d{2}$/.test(k) ? k : String(rec.day ?? rec.date ?? '')).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      out.push({
        day,
        sleepHours: typeof rec.sleepHours === 'number' ? rec.sleepHours : undefined,
        energyLevel: typeof rec.energyLevel === 'number' ? rec.energyLevel : undefined,
        externalWorkout: Boolean(rec.externalWorkout || rec.workout || rec.exercise),
      });
    }
  }
  return out;
}

export function computeVitalityCorrelation(
  history: readonly NeuroHistoryEntry[],
  vitalityLogs: readonly VitalityDayLog[]
): VitalityCorrelationReport {
  const hasAtelierData = vitalityLogs.length > 0;
  const logByDay = new Map<string, VitalityDayLog>();
  for (const l of vitalityLogs) logByDay.set(l.day, l);

  const goodSleepRx: number[] = [];
  const shortSleepRx: number[] = [];
  const workoutScores: number[] = [];
  const restScores: number[] = [];
  let matchedDays = 0;

  for (const h of history) {
    const v = logByDay.get(h.day);
    if (!v) continue;
    matchedDays += 1;
    if (typeof v.sleepHours === 'number' && h.avgReactionMs > 0) {
      if (v.sleepHours >= 7) goodSleepRx.push(h.avgReactionMs);
      else shortSleepRx.push(h.avgReactionMs);
    }
    if (v.externalWorkout) workoutScores.push(h.neuroScore);
    else restScores.push(h.neuroScore);
  }

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  const goodSleepAvgRxMs = avg(goodSleepRx);
  const shortSleepAvgRxMs = avg(shortSleepRx);
  const sleepDeltaMs =
    goodSleepAvgRxMs !== null && shortSleepAvgRxMs !== null
      ? shortSleepAvgRxMs - goodSleepAvgRxMs
      : null;
  const workoutAvgScore = avg(workoutScores);
  const restAvgScore = avg(restScores);

  const insights: string[] = [];
  if (!hasAtelierData) {
    insights.push(
      'Registra tus horas de sueño y ejercicio en Atelier Diario (mismo origen) para cruzar tu vitalidad con NeuroLab.'
    );
  } else if (matchedDays === 0) {
    insights.push(
      `Detectamos ${vitalityLogs.length} días en Atelier Diario. Completa sesiones de NeuroLab hoy para iniciar la correlación sueño/rendimiento.`
    );
  } else {
    if (sleepDeltaMs !== null) {
      if (sleepDeltaMs > 15) {
        insights.push(
          `Cuando duermes >= 7h tu tiempo de reacción mejora ${sleepDeltaMs} ms (${goodSleepAvgRxMs} ms vs ${shortSleepAvgRxMs} ms).`
        );
      } else if (sleepDeltaMs < -15) {
        insights.push(
          `Tu reacción se mantiene estable incluso con menos sueño (${shortSleepAvgRxMs} ms), pero priorizar 7h+ consolida la memoria.`
        );
      } else {
        insights.push(
          `Tu latencia de reacción promedia ${goodSleepAvgRxMs} ms en días con >= 7h de sueño.`
        );
      }
    }
    if (workoutAvgScore !== null && restAvgScore !== null) {
      const diff = workoutAvgScore - restAvgScore;
      if (diff >= 10) {
        insights.push(
          `En días con ejercicio físico tu NeuroScore sube +${diff} pts (${workoutAvgScore} vs ${restAvgScore}).`
        );
      } else {
        insights.push(
          `NeuroScore medio con entrenamiento físico: ${workoutAvgScore} pts (días sin ejercicio: ${restAvgScore} pts).`
        );
      }
    }
    if (insights.length === 0) {
      insights.push(
        `${matchedDays} ${matchedDays === 1 ? 'día sincronizado' : 'días sincronizados'} con Atelier Diario. Sigue registrando sueño y ejercicio para detectar tendencias.`
      );
    }
  }

  return {
    hasAtelierData,
    matchedDays,
    goodSleepAvgRxMs,
    shortSleepAvgRxMs,
    sleepDeltaMs,
    workoutAvgScore,
    restAvgScore,
    insights,
  };
}

export function readAtelierVitalityFromStorage(): VitalityDayLog[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem('atelier_diario_profile_v1');
    if (!raw) return [];
    return parseAtelierVitalityLogs(JSON.parse(raw));
  } catch {
    return [];
  }
}

// ==================== TRANSFER MODE (FLASHCARDS / ACTIVE RECALL) ====================

export interface TransferCard {
  id: string;
  deck: string;
  front: string;
  back: string;
  source: 'atelier' | 'builtin';
}

export const BUILTIN_TRANSFER_CARDS: readonly TransferCard[] = [
  {
    id: 'cs-1',
    deck: 'Ciencias de la Computación',
    front: '¿Cuál es la complejidad temporal de la búsqueda binaria en un arreglo ordenado?',
    back: 'O(log n): divide el espacio de búsqueda a la mitad en cada comparación.',
    source: 'builtin',
  },
  {
    id: 'cs-2',
    deck: 'Ciencias de la Computación',
    front: '¿Qué estructura de datos sigue el principio LIFO (último en entrar, primero en salir)?',
    back: 'Pila (Stack), usada en llamadas de funciones y deshacer/rehacer.',
    source: 'builtin',
  },
  {
    id: 'cs-3',
    deck: 'Ciencias de la Computación',
    front: '¿Qué diferencia a una tabla hash de un árbol binario balanceado en búsqueda promedio?',
    back: 'La tabla hash busca en O(1) promedio sin orden; el árbol balanceado en O(log n) manteniendo orden.',
    source: 'builtin',
  },
  {
    id: 'cs-4',
    deck: 'Ciencias de la Computación',
    front: '¿Qué garantiza la propiedad ACID "Atomicidad" en una base de datos?',
    back: 'Que una transacción se ejecuta por completo o se revierte íntegra sin estados intermedios.',
    source: 'builtin',
  },
  {
    id: 'cs-5',
    deck: 'Ciencias de la Computación',
    front: '¿Para qué sirve un índice B-Tree en SQL?',
    back: 'Acelera búsquedas por igualdad y rangos manteniendo claves ordenadas en O(log n).',
    source: 'builtin',
  },
  {
    id: 'cs-6',
    deck: 'Ciencias de la Computación',
    front: '¿Qué describe el teorema CAP en sistemas distribuidos?',
    back: 'Ante una partición de red (P), un sistema debe priorizar Consistencia (C) o Disponibilidad (A).',
    source: 'builtin',
  },
  {
    id: 'log-1',
    deck: 'Lógica y Pensamiento Crítico',
    front: '¿En qué consiste el Modus Tollens?',
    back: 'Si P implica Q, y Q es falso, entonces P necesariamente es falso.',
    source: 'builtin',
  },
  {
    id: 'log-2',
    deck: 'Lógica y Pensamiento Crítico',
    front: '¿Qué error comete la falacia de la tasa base?',
    back: 'Ignorar la probabilidad previa general de un evento al valorar una evidencia específica.',
    source: 'builtin',
  },
  {
    id: 'log-3',
    deck: 'Lógica y Pensamiento Crítico',
    front: '¿Qué es el sesgo de supervivencia?',
    back: 'Analizar solo los casos que superaron un filtro e ignorar los fracasos invisibles.',
    source: 'builtin',
  },
  {
    id: 'log-4',
    deck: 'Lógica y Pensamiento Crítico',
    front: '¿Qué distingue correlación de causalidad?',
    back: 'Dos variables pueden variar juntas por azar o por una tercera variable oculta sin causarse entre sí.',
    source: 'builtin',
  },
  {
    id: 'log-5',
    deck: 'Lógica y Pensamiento Crítico',
    front: '¿Qué es la contrapositiva de "Si llueve, la calle se moja"?',
    back: '"Si la calle no está mojada, entonces no llueve" (lógicamente equivalente).',
    source: 'builtin',
  },
  {
    id: 'mem-1',
    deck: 'Memoria y Neurociencia',
    front: '¿Por qué la evocación activa (Active Recall) supera a la relectura pasiva?',
    back: 'Forzar la recuperación desde la memoria fortalece las rutas sinápticas (efecto de prueba).',
    source: 'builtin',
  },
  {
    id: 'mem-2',
    deck: 'Memoria y Neurociencia',
    front: '¿Cómo funciona el Suspiro Fisiológico para bajar la activación aguda?',
    back: 'Doble inhalación nasal (reabre alvéolos) seguida de una exhalación larga que activa el nervio vago.',
    source: 'builtin',
  },
  {
    id: 'mem-3',
    deck: 'Memoria y Neurociencia',
    front: '¿Qué papel cumple el sueño profundo y REM en el aprendizaje?',
    back: 'Consolida memorias declarativas del hipocampo a la corteza e integra patrones creativos.',
    source: 'builtin',
  },
  {
    id: 'mem-4',
    deck: 'Memoria y Neurociencia',
    front: '¿En qué consiste el efecto de repetición espaciada?',
    back: 'Repasar justo antes de olvidar amplía cada intervalo de retención con mínimo esfuerzo.',
    source: 'builtin',
  },
  {
    id: 'mem-5',
    deck: 'Memoria y Neurociencia',
    front: '¿Qué es la regla visual 20-20-20?',
    back: 'Cada 20 minutos mirar a 6 metros (20 pies) durante 20 segundos para relajar el músculo ciliar.',
    source: 'builtin',
  },
];

export function loadTransferCardsFromStorage(): { cards: TransferCard[]; fromAtelier: boolean } {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('atelier_diario_profile_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const extracted: TransferCard[] = [];

        const pushList = (arr: unknown, deckName: string) => {
          if (!Array.isArray(arr)) return;
          arr.forEach((item, idx) => {
            if (!item || typeof item !== 'object') return;
            const c = item as Record<string, unknown>;
            const front = String(c.front ?? c.question ?? c.prompt ?? c.term ?? '').trim();
            const back = String(c.back ?? c.answer ?? c.definition ?? '').trim();
            if (front.length >= 3 && back.length >= 2) {
              extracted.push({
                id: String(c.id ?? `at-${idx}`),
                deck: String(c.deck ?? c.topic ?? c.category ?? deckName),
                front,
                back,
                source: 'atelier',
              });
            }
          });
        };

        pushList(parsed.flashcards, 'Atelier Diario');
        const progress = parsed.progress as Record<string, unknown> | undefined;
        const study = progress?.study as Record<string, unknown> | undefined;
        pushList(study?.flashcards ?? study?.cards, 'Estudio Atelier');
        if (Array.isArray(parsed.decks)) {
          for (const d of parsed.decks) {
            if (d && typeof d === 'object') {
              const dk = d as Record<string, unknown>;
              pushList(dk.cards, String(dk.name ?? dk.title ?? 'Mazo Atelier'));
            }
          }
        }

        if (extracted.length >= 3) {
          return { cards: extracted.slice(0, 60), fromAtelier: true };
        }
      }
    }
  } catch {
    // Fallback to built-in deck
  }
  return { cards: [...BUILTIN_TRANSFER_CARDS], fromAtelier: false };
}

export function isCognitiveNeuroMode(modeId: GameModeId): boolean {
  return Boolean(NEURO_MODE_PILLAR[modeId as StandaloneGameId]);
}
