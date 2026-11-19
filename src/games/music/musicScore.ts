export type HitGrade = 'perfect' | 'good' | 'ok' | 'miss';

export interface MusicRunInput {
  hits: number;
  misses: number;
  perfect: number;
  good: number;
  ok: number;
  totalTargets: number;
  timingDeviationsMs: number[];
  maxCombo: number;
}

export interface MusicRunSummary {
  score: number;
  accuracy: number;
  rhythmPerf: number;
  consistencyPct: number;
  avgErrorMs: number;
}

/** Clasifica un golpe respecto al pulso objetivo en ms absolutos. */
export function gradeTiming(deltaMs: number): HitGrade {
  const abs = Math.abs(deltaMs);
  if (abs <= 55) return 'perfect';
  if (abs <= 115) return 'good';
  if (abs <= 190) return 'ok';
  return 'miss';
}

export function gradePoints(grade: HitGrade, combo: number): number {
  const base = grade === 'perfect' ? 120 : grade === 'good' ? 90 : grade === 'ok' ? 60 : 0;
  if (base === 0) return 0;
  return base + Math.min(80, combo * 6);
}

/**
 * Resume una sesión musical completa sin cortar al jugador por errores intermedios.
 * Calcula precisión de aciertos, consistencia temporal y rendimiento para `axisPerformances.rhythm`.
 */
export function summarizeMusicRun(input: MusicRunInput): MusicRunSummary {
  const totalTargets = Math.max(0, input.totalTargets);
  const attempts = Math.max(totalTargets, input.hits + input.misses);
  const accuracy = attempts > 0 ? Math.round((input.hits / attempts) * 100) : 0;

  let avgErrorMs = 0;
  let consistencyPct = accuracy;
  if (input.timingDeviationsMs.length > 0) {
    const absSum = input.timingDeviationsMs.reduce((acc, v) => acc + Math.abs(v), 0);
    avgErrorMs = Math.round(absSum / input.timingDeviationsMs.length);
    consistencyPct = Math.max(0, Math.min(100, Math.round(100 - (avgErrorMs / 210) * 100)));
  }

  const qualityWeighted =
    totalTargets > 0
      ? ((input.perfect * 1.0 + input.good * 0.82 + input.ok * 0.58) / totalTargets) * 100
      : 0;
  const comboBonus = totalTargets > 0 ? Math.min(12, (input.maxCombo / Math.max(4, totalTargets)) * 12) : 0;
  const rawPerf = qualityWeighted * 0.55 + consistencyPct * 0.35 + comboBonus;
  const rhythmPerf =
    input.hits === 0 ? 20 : Math.max(20, Math.min(100, Math.round(rawPerf)));

  const score = Math.max(
    input.hits > 0 ? 150 : 0,
    input.perfect * 120 + input.good * 90 + input.ok * 60 + input.maxCombo * 18
  );

  return { score, accuracy, rhythmPerf, consistencyPct, avgErrorMs };
}
