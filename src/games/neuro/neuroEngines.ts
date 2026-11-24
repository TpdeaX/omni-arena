// Pure deterministic-capable engines for the 7 NeuroLab scientific games.
// Zero DOM dependencies so they can be unit-tested directly under Node.

export type Rng = () => number;

export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWithRng<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickWithRng<T>(arr: readonly T[], rng: Rng = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ==================== 1. MACKWORTH CLOCK ====================

export interface MackworthTickResult {
  nextIndex: number;
  isDoubleJump: boolean;
  skippedIndex: number | null;
  stepsSinceLastJump: number;
}

export function stepMackworthTick(
  currentIndex: number,
  totalNodes: number,
  doubleJumpProb: number,
  stepsSinceLastJump: number,
  rng: Rng = Math.random
): MackworthTickResult {
  const canJump = stepsSinceLastJump >= 2;
  const forceJump = stepsSinceLastJump >= 7;
  const isDoubleJump = forceJump || (canJump && rng() < doubleJumpProb);
  const delta = isDoubleJump ? 2 : 1;
  const nextIndex = (currentIndex + delta) % totalNodes;
  const skippedIndex = isDoubleJump ? (currentIndex + 1) % totalNodes : null;
  return {
    nextIndex,
    isDoubleJump,
    skippedIndex,
    stepsSinceLastJump: isDoubleJump ? 0 : stepsSinceLastJump + 1,
  };
}

// ==================== 2. CHAIN MATH ====================

export interface ChainMathStep {
  op: '+' | '-' | '×';
  value: number;
  label: string;
  runningTotal: number;
}

export interface ChainMathRound {
  start: number;
  steps: ChainMathStep[];
  result: number;
  options: number[];
  explanation: string;
}

export function generateChainMathRound(
  level: number,
  rng: Rng = Math.random
): ChainMathRound {
  const safeLevel = Math.max(1, Math.min(12, Math.floor(level)));
  const chainLen = Math.min(7, 3 + Math.floor((safeLevel - 1) / 2));
  const maxAdd = Math.min(24, 6 + safeLevel * 2);
  const start = 4 + Math.floor(rng() * (8 + safeLevel * 3));

  let current = start;
  const steps: ChainMathStep[] = [];
  let multCount = 0;

  for (let i = 0; i < chainLen; i++) {
    const allowMult = safeLevel >= 2 && multCount < (safeLevel >= 6 ? 2 : 1) && current >= 3 && current <= 28;
    const roll = rng();
    let op: '+' | '-' | '×' = '+';
    let value = 2;

    if (allowMult && roll < 0.24) {
      op = '×';
      value = current <= 14 && safeLevel >= 5 && rng() < 0.45 ? 3 : 2;
      multCount += 1;
    } else if (roll < 0.62 || current <= 5) {
      op = '+';
      value = 2 + Math.floor(rng() * maxAdd);
    } else {
      op = '-';
      const cap = Math.min(maxAdd, Math.max(2, current - 1));
      value = 2 + Math.floor(rng() * Math.max(1, cap - 1));
    }

    if (op === '+') current += value;
    else if (op === '-') current -= value;
    else current *= value;

    steps.push({
      op,
      value,
      label: `${op}${value}`,
      runningTotal: current,
    });
  }

  const distractors = new Set<number>([current]);
  const offsets = [-12, -10, -8, -6, -4, -3, -2, -1, 1, 2, 3, 4, 6, 8, 10, 12];
  let guard = 0;
  while (distractors.size < 4 && guard < 60) {
    guard++;
    const delta = pickWithRng(offsets, rng);
    const cand = current + delta;
    if (cand >= 0 && cand !== current) {
      distractors.add(cand);
    }
  }
  while (distractors.size < 4) {
    distractors.add(current + distractors.size + 1);
  }

  const options = shuffleWithRng(Array.from(distractors), rng);
  const explanation = `${start} ${steps.map((s) => `${s.label} (${s.runningTotal})`).join(' -> ')}`;

  return {
    start,
    steps,
    result: current,
    options,
    explanation,
  };
}

// ==================== 3. COLOR CRAZE (STROOP + RULE SWITCH + GO/NO-GO) ====================

export type CrazeColorId = 'rojo' | 'azul' | 'verde' | 'amarillo';
export type CrazeShapeId = 'circulo' | 'triangulo' | 'cuadrado' | 'rombo';
export type CrazeRuleId = 'ink' | 'word' | 'shape' | 'nogo_red';

export const CRAZE_COLORS: Record<
  CrazeColorId,
  { id: CrazeColorId; label: string; hex: string }
> = {
  rojo: { id: 'rojo', label: 'ROJO', hex: '#EF4444' },
  azul: { id: 'azul', label: 'AZUL', hex: '#0EA5E9' },
  verde: { id: 'verde', label: 'VERDE', hex: '#10B981' },
  amarillo: { id: 'amarillo', label: 'AMARILLO', hex: '#F59E0B' },
};

export const CRAZE_SHAPES: Record<CrazeShapeId, { id: CrazeShapeId; label: string }> = {
  circulo: { id: 'circulo', label: 'CÍRCULO' },
  triangulo: { id: 'triangulo', label: 'TRIÁNGULO' },
  cuadrado: { id: 'cuadrado', label: 'CUADRADO' },
  rombo: { id: 'rombo', label: 'ROMBO' },
};

export const CRAZE_RULES: Record<
  CrazeRuleId,
  { id: CrazeRuleId; banner: string; hint: string; accent: string }
> = {
  ink: {
    id: 'ink',
    banner: 'COLOR DE TINTA',
    hint: 'Elige el color con el que está pintada la palabra.',
    accent: '#0EA5E9',
  },
  word: {
    id: 'word',
    banner: 'PALABRA',
    hint: 'Elige el color que dice el texto (ignora la tinta).',
    accent: '#8B5CF6',
  },
  shape: {
    id: 'shape',
    banner: 'FORMA',
    hint: 'Elige la figura geométrica que rodea al estímulo.',
    accent: '#10B981',
  },
  nogo_red: {
    id: 'nogo_red',
    banner: 'NO TOQUES SI ES ROJO',
    hint: 'Si la tinta es ROJA pulsa INHIBIR (Espacio); si no, elige el COLOR DE TINTA.',
    accent: '#EF4444',
  },
};

export interface ColorCrazeTrial {
  rule: CrazeRuleId;
  isSwitch: boolean;
  wordId: CrazeColorId;
  inkId: CrazeColorId;
  shapeId: CrazeShapeId;
  isNoGo: boolean;
  expectedAnswer: string; // colorId, shapeId, or 'inhibit'
  options: { id: string; label: string; colorHex?: string }[];
}

const COLOR_IDS: CrazeColorId[] = ['rojo', 'azul', 'verde', 'amarillo'];
const SHAPE_IDS: CrazeShapeId[] = ['circulo', 'triangulo', 'cuadrado', 'rombo'];

export function generateColorCrazeTrial(
  rule: CrazeRuleId,
  prevRule: CrazeRuleId | null,
  rng: Rng = Math.random
): ColorCrazeTrial {
  const isSwitch = prevRule !== null && prevRule !== rule;
  let inkId = pickWithRng(COLOR_IDS, rng);
  let wordId = pickWithRng(COLOR_IDS, rng);
  const shapeId = pickWithRng(SHAPE_IDS, rng);

  // Bias Stroop incongruence 75% of the time so the exercise genuinely trains executive control
  if (wordId === inkId && rng() < 0.75) {
    const others = COLOR_IDS.filter((c) => c !== inkId);
    wordId = pickWithRng(others, rng);
  }

  // In nogo_red mode, ensure ~42% of trials are red ink (No-Go)
  if (rule === 'nogo_red') {
    if (rng() < 0.42) {
      inkId = 'rojo';
    } else if (inkId === 'rojo') {
      inkId = pickWithRng(['azul', 'verde', 'amarillo'] as CrazeColorId[], rng);
    }
  }

  const isNoGo = rule === 'nogo_red' && inkId === 'rojo';
  const expectedAnswer = isNoGo
    ? 'inhibit'
    : rule === 'word'
    ? wordId
    : rule === 'shape'
    ? shapeId
    : inkId;

  const options =
    rule === 'shape'
      ? SHAPE_IDS.map((s) => ({ id: s, label: CRAZE_SHAPES[s].label }))
      : COLOR_IDS.map((c) => ({
          id: c,
          label: CRAZE_COLORS[c].label,
          colorHex: CRAZE_COLORS[c].hex,
        }));

  return {
    rule,
    isSwitch,
    wordId,
    inkId,
    shapeId,
    isNoGo,
    expectedAnswer,
    options,
  };
}

// ==================== 4. PATHFINDER (CORSI DIRECTO E INVERSO) ====================

export interface PathfinderRound {
  gridSize: 4 | 5;
  path: number[];
  expected: number[];
  reverse: boolean;
  distractors: number[];
}

export function generatePathfinderRound(
  gridSize: 4 | 5,
  length: number,
  reverse: boolean,
  distractorCount: number,
  rng: Rng = Math.random
): PathfinderRound {
  const total = gridSize * gridSize;
  const targetLen = Math.max(3, Math.min(total - 2, length));
  const neighborsOf = (idx: number): number[] => {
    const r = Math.floor(idx / gridSize);
    const c = idx % gridSize;
    const out: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        // Prefer orthogonal + diagonal neighbors for fluid connected routes
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) {
          out.push(nr * gridSize + nc);
        }
      }
    }
    return out;
  };

  let bestPath: number[] = [];
  for (let attempt = 0; attempt < 24; attempt++) {
    const start = Math.floor(rng() * total);
    const visited = new Set<number>([start]);
    const path = [start];

    while (path.length < targetLen) {
      const curr = path[path.length - 1];
      const cands = neighborsOf(curr).filter((n) => !visited.has(n));
      if (cands.length === 0) break;
      const next = pickWithRng(cands, rng);
      visited.add(next);
      path.push(next);
    }

    if (path.length > bestPath.length) {
      bestPath = path;
    }
    if (bestPath.length === targetLen) break;
  }

  const inPath = new Set(bestPath);
  const pool = Array.from({ length: total }, (_, i) => i).filter((i) => !inPath.has(i));
  const distractors = shuffleWithRng(pool, rng).slice(0, Math.max(0, distractorCount));
  const expected = reverse ? [...bestPath].reverse() : [...bestPath];

  return {
    gridSize,
    path: bestPath,
    expected,
    reverse,
    distractors,
  };
}

// ==================== 5. SYMBOL SPEED (WAIS + SHAPE FUSION) ====================

export type OuterShape = 'circle' | 'square' | 'diamond' | 'triangle' | 'hex';
export type InnerMark = 'dot' | 'cross' | 'barH' | 'barV' | 'ring' | 'diag';

export interface SymbolSpec {
  outer: OuterShape;
  inner: InnerMark;
  rotation: 0 | 90 | 180 | 270;
  notch: 'none' | 'top' | 'right' | 'bottom' | 'left';
}

export function symbolKey(s: SymbolSpec): string {
  return `${s.outer}|${s.inner}|${s.rotation}|${s.notch}`;
}

const OUTER_SHAPES: OuterShape[] = ['circle', 'square', 'diamond', 'triangle', 'hex'];
const INNER_MARKS: InnerMark[] = ['dot', 'cross', 'barH', 'barV', 'ring', 'diag'];
const NOTCHES: SymbolSpec['notch'][] = ['none', 'top', 'right', 'bottom', 'left'];
const ROTATIONS: SymbolSpec['rotation'][] = [0, 90, 180, 270];

export function randomSymbol(rng: Rng = Math.random): SymbolSpec {
  return {
    outer: pickWithRng(OUTER_SHAPES, rng),
    inner: pickWithRng(INNER_MARKS, rng),
    rotation: pickWithRng(ROTATIONS, rng),
    notch: pickWithRng(NOTCHES, rng),
  };
}

function mutateSymbol(base: SymbolSpec, rng: Rng): SymbolSpec {
  const field = Math.floor(rng() * 3);
  if (field === 0) {
    return { ...base, outer: pickWithRng(OUTER_SHAPES.filter((o) => o !== base.outer), rng) };
  }
  if (field === 1) {
    return { ...base, inner: pickWithRng(INNER_MARKS.filter((m) => m !== base.inner), rng) };
  }
  return { ...base, notch: pickWithRng(NOTCHES.filter((n) => n !== base.notch), rng) };
}

export function renderSymbolSvg(
  spec: SymbolSpec,
  size = 56,
  part: 'full' | 'outer' | 'inner' = 'full',
  accent = 'currentColor'
): string {
  let outerSvg = '';
  if (part === 'full' || part === 'outer') {
    switch (spec.outer) {
      case 'circle':
        outerSvg = `<circle cx="32" cy="32" r="21" fill="none" stroke="${accent}" stroke-width="3.2"/>`;
        break;
      case 'square':
        outerSvg = `<rect x="13" y="13" width="38" height="38" rx="4" fill="none" stroke="${accent}" stroke-width="3.2"/>`;
        break;
      case 'diamond':
        outerSvg = `<polygon points="32,9 55,32 32,55 9,32" fill="none" stroke="${accent}" stroke-width="3.2"/>`;
        break;
      case 'triangle':
        outerSvg = `<polygon points="32,10 54,50 10,50" fill="none" stroke="${accent}" stroke-width="3.2"/>`;
        break;
      case 'hex':
        outerSvg = `<polygon points="32,9 51,20 51,44 32,55 13,44 13,20" fill="none" stroke="${accent}" stroke-width="3.2"/>`;
        break;
    }
    if (spec.notch !== 'none') {
      const coords: Record<Exclude<SymbolSpec['notch'], 'none'>, [number, number]> = {
        top: [32, 6],
        right: [58, 32],
        bottom: [32, 58],
        left: [6, 32],
      };
      const [nx, ny] = coords[spec.notch];
      outerSvg += `<circle cx="${nx}" cy="${ny}" r="4.2" fill="${accent}"/>`;
    }
  }

  let innerSvg = '';
  if (part === 'full' || part === 'inner') {
    switch (spec.inner) {
      case 'dot':
        innerSvg = `<circle cx="32" cy="32" r="6" fill="${accent}"/>`;
        break;
      case 'ring':
        innerSvg = `<circle cx="32" cy="32" r="8.5" fill="none" stroke="${accent}" stroke-width="3"/>`;
        break;
      case 'cross':
        innerSvg = `<line x1="23" y1="32" x2="41" y2="32" stroke="${accent}" stroke-width="3.2" stroke-linecap="round"/><line x1="32" y1="23" x2="32" y2="41" stroke="${accent}" stroke-width="3.2" stroke-linecap="round"/>`;
        break;
      case 'barH':
        innerSvg = `<line x1="21" y1="32" x2="43" y2="32" stroke="${accent}" stroke-width="3.6" stroke-linecap="round"/>`;
        break;
      case 'barV':
        innerSvg = `<line x1="32" y1="21" x2="32" y2="43" stroke="${accent}" stroke-width="3.6" stroke-linecap="round"/>`;
        break;
      case 'diag':
        innerSvg = `<line x1="23" y1="41" x2="41" y2="23" stroke="${accent}" stroke-width="3.4" stroke-linecap="round"/>`;
        break;
    }
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${outerSvg}${innerSvg}</svg>`;
}

export interface SymbolSpeedRound {
  mode: 'match' | 'fusion';
  targets: SymbolSpec[]; // 2 targets in 'match', 1 composite spec in 'fusion' (rendered as outer + inner)
  candidates: SymbolSpec[];
  matchIndex: number; // 0..candidates.length-1, or -1 if 'Ninguno' (only in 'match')
}

export function generateSymbolSpeedRound(
  mode: 'match' | 'fusion',
  candidateCount: number,
  rng: Rng = Math.random
): SymbolSpeedRound {
  const count = Math.max(4, Math.min(6, candidateCount));
  const used = new Set<string>();

  if (mode === 'fusion') {
    const target = randomSymbol(rng);
    target.rotation = 0;
    used.add(symbolKey(target));

    const distractors: SymbolSpec[] = [];
    let guard = 0;
    while (distractors.length < count - 1 && guard < 80) {
      guard++;
      const d = mutateSymbol(target, rng);
      d.rotation = 0;
      const k = symbolKey(d);
      if (!used.has(k)) {
        used.add(k);
        distractors.push(d);
      }
    }
    const candidates = shuffleWithRng([target, ...distractors], rng);
    const matchIndex = candidates.findIndex((c) => symbolKey(c) === symbolKey(target));
    return { mode, targets: [target], candidates, matchIndex };
  }

  // 'match' (WAIS Symbol Search)
  const t1 = randomSymbol(rng);
  t1.rotation = 0;
  used.add(symbolKey(t1));
  let t2 = mutateSymbol(t1, rng);
  t2.rotation = 0;
  while (used.has(symbolKey(t2))) {
    t2 = randomSymbol(rng);
    t2.rotation = 0;
  }
  used.add(symbolKey(t2));

  const hasMatch = rng() < 0.72;
  const chosenTarget = rng() < 0.5 ? t1 : t2;
  const candidates: SymbolSpec[] = [];

  if (hasMatch) {
    candidates.push(chosenTarget);
  }

  let guard = 0;
  while (candidates.length < count && guard < 120) {
    guard++;
    const base = rng() < 0.5 ? t1 : t2;
    const d = mutateSymbol(base, rng);
    d.rotation = 0;
    const k = symbolKey(d);
    if (!used.has(k)) {
      used.add(k);
      candidates.push(d);
    }
  }

  const shuffled = shuffleWithRng(candidates, rng);
  const matchIndex = hasMatch
    ? shuffled.findIndex((c) => symbolKey(c) === symbolKey(chosenTarget))
    : -1;

  return {
    mode,
    targets: [t1, t2],
    candidates: shuffled,
    matchIndex,
  };
}

// ==================== 6. VERBAL FLUENCY (160+ CURATED SPANISH WORDS) ====================

export type WordCategoryId = 'naturaleza' | 'ciencia' | 'ciudad' | 'arte' | 'cuerpo' | 'emocion';

export interface CuratedWord {
  word: string;
  category: WordCategoryId;
  syllables: number;
  lastSyllable: string;
}

export const WORD_CATEGORY_LABELS: Record<WordCategoryId, string> = {
  naturaleza: 'Naturaleza',
  ciencia: 'Ciencia y Tecnología',
  ciudad: 'Ciudad y Objetos',
  arte: 'Arte y Música',
  cuerpo: 'Cuerpo y Salud',
  emocion: 'Mente y Emociones',
};

// 168 curated Spanish words across 6 semantic categories (28 per category)
export const SPANISH_WORD_BANK: readonly CuratedWord[] = [
  // Naturaleza (28)
  { word: 'BOSQUE', category: 'naturaleza', syllables: 2, lastSyllable: 'QUE' },
  { word: 'VOLCÁN', category: 'naturaleza', syllables: 2, lastSyllable: 'CAN' },
  { word: 'RÍO', category: 'naturaleza', syllables: 2, lastSyllable: 'O' },
  { word: 'GLACIAR', category: 'naturaleza', syllables: 2, lastSyllable: 'CIAR' },
  { word: 'SELVA', category: 'naturaleza', syllables: 2, lastSyllable: 'VA' },
  { word: 'MONTAÑA', category: 'naturaleza', syllables: 3, lastSyllable: 'ÑA' },
  { word: 'NUBE', category: 'naturaleza', syllables: 2, lastSyllable: 'BE' },
  { word: 'CASCADA', category: 'naturaleza', syllables: 3, lastSyllable: 'DA' },
  { word: 'DESIERTO', category: 'naturaleza', syllables: 3, lastSyllable: 'TO' },
  { word: 'PRADERA', category: 'naturaleza', syllables: 3, lastSyllable: 'RA' },
  { word: 'TORMENTA', category: 'naturaleza', syllables: 3, lastSyllable: 'TA' },
  { word: 'CORAL', category: 'naturaleza', syllables: 2, lastSyllable: 'RAL' },
  { word: 'BRISA', category: 'naturaleza', syllables: 2, lastSyllable: 'SA' },
  { word: 'SEMILLA', category: 'naturaleza', syllables: 3, lastSyllable: 'LLA' },
  { word: 'ÁRBOL', category: 'naturaleza', syllables: 2, lastSyllable: 'BOL' },
  { word: 'ARENA', category: 'naturaleza', syllables: 3, lastSyllable: 'NA' },
  { word: 'ESTRELLA', category: 'naturaleza', syllables: 3, lastSyllable: 'LLA' },
  { word: 'OCÉANO', category: 'naturaleza', syllables: 4, lastSyllable: 'NO' },
  { word: 'TRUENO', category: 'naturaleza', syllables: 2, lastSyllable: 'NO' },
  { word: 'LAGO', category: 'naturaleza', syllables: 2, lastSyllable: 'GO' },
  { word: 'ROBLE', category: 'naturaleza', syllables: 2, lastSyllable: 'BLE' },
  { word: 'ISLA', category: 'naturaleza', syllables: 2, lastSyllable: 'LA' },
  { word: 'NIEVE', category: 'naturaleza', syllables: 2, lastSyllable: 'VE' },
  { word: 'LLUVIA', category: 'naturaleza', syllables: 2, lastSyllable: 'VIA' },
  { word: 'VALLE', category: 'naturaleza', syllables: 2, lastSyllable: 'LLE' },
  { word: 'MARIPOSA', category: 'naturaleza', syllables: 4, lastSyllable: 'SA' },
  { word: 'HALCÓN', category: 'naturaleza', syllables: 2, lastSyllable: 'CON' },
  { word: 'ORQUÍDEA', category: 'naturaleza', syllables: 4, lastSyllable: 'A' },

  // Ciencia y Tecnología (28)
  { word: 'ÁTOMO', category: 'ciencia', syllables: 3, lastSyllable: 'MO' },
  { word: 'RADAR', category: 'ciencia', syllables: 2, lastSyllable: 'DAR' },
  { word: 'LÁSER', category: 'ciencia', syllables: 2, lastSyllable: 'SER' },
  { word: 'ÓRBITA', category: 'ciencia', syllables: 3, lastSyllable: 'TA' },
  { word: 'PRISMA', category: 'ciencia', syllables: 2, lastSyllable: 'MA' },
  { word: 'VECTOR', category: 'ciencia', syllables: 2, lastSyllable: 'TOR' },
  { word: 'CÉLULA', category: 'ciencia', syllables: 3, lastSyllable: 'LA' },
  { word: 'FOTÓN', category: 'ciencia', syllables: 2, lastSyllable: 'TON' },
  { word: 'NEURONA', category: 'ciencia', syllables: 3, lastSyllable: 'NA' },
  { word: 'IMÁN', category: 'ciencia', syllables: 2, lastSyllable: 'MAN' },
  { word: 'SENSOR', category: 'ciencia', syllables: 2, lastSyllable: 'SOR' },
  { word: 'GENOMA', category: 'ciencia', syllables: 3, lastSyllable: 'MA' },
  { word: 'PLASMA', category: 'ciencia', syllables: 2, lastSyllable: 'MA' },
  { word: 'CÓDIGO', category: 'ciencia', syllables: 3, lastSyllable: 'GO' },
  { word: 'SATÉLITE', category: 'ciencia', syllables: 4, lastSyllable: 'TE' },
  { word: 'ALGORITMO', category: 'ciencia', syllables: 4, lastSyllable: 'MO' },
  { word: 'MATRIZ', category: 'ciencia', syllables: 2, lastSyllable: 'TRIZ' },
  { word: 'GRAVEDAD', category: 'ciencia', syllables: 3, lastSyllable: 'DAD' },
  { word: 'ENERGÍA', category: 'ciencia', syllables: 4, lastSyllable: 'A' },
  { word: 'CIRCUITO', category: 'ciencia', syllables: 3, lastSyllable: 'TO' },
  { word: 'NÚCLEO', category: 'ciencia', syllables: 3, lastSyllable: 'O' },
  { word: 'TELESCOPIO', category: 'ciencia', syllables: 4, lastSyllable: 'PIO' },
  { word: 'ESPECTRO', category: 'ciencia', syllables: 3, lastSyllable: 'TRO' },
  { word: 'QUÍMICA', category: 'ciencia', syllables: 3, lastSyllable: 'CA' },
  { word: 'DATOS', category: 'ciencia', syllables: 2, lastSyllable: 'TOS' },
  { word: 'PULSO', category: 'ciencia', syllables: 2, lastSyllable: 'SO' },
  { word: 'GALAXIA', category: 'ciencia', syllables: 3, lastSyllable: 'XIA' },
  { word: 'HIPÓTESIS', category: 'ciencia', syllables: 4, lastSyllable: 'SIS' },

  // Ciudad y Objetos (28)
  { word: 'PUENTE', category: 'ciudad', syllables: 2, lastSyllable: 'TE' },
  { word: 'TORRE', category: 'ciudad', syllables: 2, lastSyllable: 'RRE' },
  { word: 'BRÚJULA', category: 'ciudad', syllables: 3, lastSyllable: 'LA' },
  { word: 'LÁMPARA', category: 'ciudad', syllables: 3, lastSyllable: 'RA' },
  { word: 'RELOJ', category: 'ciudad', syllables: 2, lastSyllable: 'LOJ' },
  { word: 'LLAVE', category: 'ciudad', syllables: 2, lastSyllable: 'VE' },
  { word: 'FARO', category: 'ciudad', syllables: 2, lastSyllable: 'RO' },
  { word: 'PLAZA', category: 'ciudad', syllables: 2, lastSyllable: 'ZA' },
  { word: 'TREN', category: 'ciudad', syllables: 1, lastSyllable: 'TREN' },
  { word: 'ESPEJO', category: 'ciudad', syllables: 3, lastSyllable: 'JO' },
  { word: 'VENTANA', category: 'ciudad', syllables: 3, lastSyllable: 'NA' },
  { word: 'MUSEO', category: 'ciudad', syllables: 3, lastSyllable: 'O' },
  { word: 'ESTACIÓN', category: 'ciudad', syllables: 3, lastSyllable: 'CION' },
  { word: 'PUERTO', category: 'ciudad', syllables: 2, lastSyllable: 'TO' },
  { word: 'ESCALERA', category: 'ciudad', syllables: 4, lastSyllable: 'RA' },
  { word: 'CÚPULA', category: 'ciudad', syllables: 3, lastSyllable: 'LA' },
  { word: 'ANCLA', category: 'ciudad', syllables: 2, lastSyllable: 'CLA' },
  { word: 'MAPA', category: 'ciudad', syllables: 2, lastSyllable: 'PA' },
  { word: 'LIBRO', category: 'ciudad', syllables: 2, lastSyllable: 'BRO' },
  { word: 'MONEDA', category: 'ciudad', syllables: 3, lastSyllable: 'DA' },
  { word: 'MERCADO', category: 'ciudad', syllables: 3, lastSyllable: 'DO' },
  { word: 'AVENIDA', category: 'ciudad', syllables: 4, lastSyllable: 'DA' },
  { word: 'TEJADO', category: 'ciudad', syllables: 3, lastSyllable: 'DO' },
  { word: 'BALCÓN', category: 'ciudad', syllables: 2, lastSyllable: 'CON' },
  { word: 'MOCHILA', category: 'ciudad', syllables: 3, lastSyllable: 'LA' },
  { word: 'TIMÓN', category: 'ciudad', syllables: 2, lastSyllable: 'MON' },
  { word: 'CAMPANA', category: 'ciudad', syllables: 3, lastSyllable: 'NA' },
  { word: 'LINTE', category: 'ciudad', syllables: 2, lastSyllable: 'TE' },

  // Arte y Música (28)
  { word: 'PIANO', category: 'arte', syllables: 2, lastSyllable: 'NO' },
  { word: 'LIENZO', category: 'arte', syllables: 2, lastSyllable: 'ZO' },
  { word: 'SONATA', category: 'arte', syllables: 3, lastSyllable: 'TA' },
  { word: 'PINCEL', category: 'arte', syllables: 2, lastSyllable: 'CEL' },
  { word: 'ACORDE', category: 'arte', syllables: 3, lastSyllable: 'DE' },
  { word: 'MELODÍA', category: 'arte', syllables: 4, lastSyllable: 'A' },
  { word: 'VERSO', category: 'arte', syllables: 2, lastSyllable: 'SO' },
  { word: 'TEATRO', category: 'arte', syllables: 3, lastSyllable: 'TRO' },
  { word: 'VIOLÍN', category: 'arte', syllables: 2, lastSyllable: 'LIN' },
  { word: 'DANZA', category: 'arte', syllables: 2, lastSyllable: 'ZA' },
  { word: 'CORO', category: 'arte', syllables: 2, lastSyllable: 'RO' },
  { word: 'ESTATUA', category: 'arte', syllables: 3, lastSyllable: 'TUA' },
  { word: 'GUITARRA', category: 'arte', syllables: 3, lastSyllable: 'RRA' },
  { word: 'ÓPERA', category: 'arte', syllables: 3, lastSyllable: 'RA' },
  { word: 'RITMO', category: 'arte', syllables: 2, lastSyllable: 'MO' },
  { word: 'COMPÁS', category: 'arte', syllables: 2, lastSyllable: 'PAS' },
  { word: 'FLAUTA', category: 'arte', syllables: 2, lastSyllable: 'TA' },
  { word: 'NOVELA', category: 'arte', syllables: 3, lastSyllable: 'LA' },
  { word: 'PALETA', category: 'arte', syllables: 3, lastSyllable: 'TA' },
  { word: 'POEMA', category: 'arte', syllables: 3, lastSyllable: 'MA' },
  { word: 'BOCETO', category: 'arte', syllables: 3, lastSyllable: 'TO' },
  { word: 'MURAL', category: 'arte', syllables: 2, lastSyllable: 'RAL' },
  { word: 'TAMBOR', category: 'arte', syllables: 2, lastSyllable: 'BOR' },
  { word: 'ARPA', category: 'arte', syllables: 2, lastSyllable: 'PA' },
  { word: 'SINFONÍA', category: 'arte', syllables: 4, lastSyllable: 'A' },
  { word: 'CINE', category: 'arte', syllables: 2, lastSyllable: 'NE' },
  { word: 'GRABADO', category: 'arte', syllables: 3, lastSyllable: 'DO' },
  { word: 'CANTO', category: 'arte', syllables: 2, lastSyllable: 'TO' },

  // Cuerpo y Salud (28)
  { word: 'CORAZÓN', category: 'cuerpo', syllables: 3, lastSyllable: 'ZON' },
  { word: 'PULMÓN', category: 'cuerpo', syllables: 2, lastSyllable: 'MON' },
  { word: 'CEREBRO', category: 'cuerpo', syllables: 3, lastSyllable: 'BRO' },
  { word: 'MÚSCULO', category: 'cuerpo', syllables: 3, lastSyllable: 'LO' },
  { word: 'HUESO', category: 'cuerpo', syllables: 2, lastSyllable: 'SO' },
  { word: 'SANGRE', category: 'cuerpo', syllables: 2, lastSyllable: 'GRE' },
  { word: 'MANO', category: 'cuerpo', syllables: 2, lastSyllable: 'NO' },
  { word: 'RODILLA', category: 'cuerpo', syllables: 3, lastSyllable: 'LLA' },
  { word: 'HOMBRO', category: 'cuerpo', syllables: 2, lastSyllable: 'BRO' },
  { word: 'TENDÓN', category: 'cuerpo', syllables: 2, lastSyllable: 'DON' },
  { word: 'PIEL', category: 'cuerpo', syllables: 1, lastSyllable: 'PIEL' },
  { word: 'RETINA', category: 'cuerpo', syllables: 3, lastSyllable: 'NA' },
  { word: 'COLUMNA', category: 'cuerpo', syllables: 3, lastSyllable: 'NA' },
  { word: 'ARTERIA', category: 'cuerpo', syllables: 3, lastSyllable: 'RIA' },
  { word: 'NERVIO', category: 'cuerpo', syllables: 2, lastSyllable: 'VIO' },
  { word: 'LATIDO', category: 'cuerpo', syllables: 3, lastSyllable: 'DO' },
  { word: 'ALIENTO', category: 'cuerpo', syllables: 3, lastSyllable: 'TO' },
  { word: 'OXÍGENO', category: 'cuerpo', syllables: 4, lastSyllable: 'NO' },
  { word: 'REFLEJO', category: 'cuerpo', syllables: 3, lastSyllable: 'JO' },
  { word: 'POSTURA', category: 'cuerpo', syllables: 3, lastSyllable: 'RA' },
  { word: 'DESCANSO', category: 'cuerpo', syllables: 3, lastSyllable: 'SO' },
  { word: 'SUEÑO', category: 'cuerpo', syllables: 2, lastSyllable: 'ÑO' },
  { word: 'VIGOR', category: 'cuerpo', syllables: 2, lastSyllable: 'GOR' },
  { word: 'CINTURA', category: 'cuerpo', syllables: 3, lastSyllable: 'RA' },
  { word: 'TOBILLO', category: 'cuerpo', syllables: 3, lastSyllable: 'LLO' },
  { word: 'CRÁNEO', category: 'cuerpo', syllables: 3, lastSyllable: 'O' },
  { word: 'OÍDO', category: 'cuerpo', syllables: 3, lastSyllable: 'DO' },
  { word: 'MIRADA', category: 'cuerpo', syllables: 3, lastSyllable: 'DA' },

  // Mente y Emociones (28)
  { word: 'CALMA', category: 'emocion', syllables: 2, lastSyllable: 'MA' },
  { word: 'ASOMBRO', category: 'emocion', syllables: 3, lastSyllable: 'BRO' },
  { word: 'CORAJE', category: 'emocion', syllables: 3, lastSyllable: 'JE' },
  { word: 'ALEGRÍA', category: 'emocion', syllables: 4, lastSyllable: 'A' },
  { word: 'ENFOQUE', category: 'emocion', syllables: 3, lastSyllable: 'QUE' },
  { word: 'INGENIO', category: 'emocion', syllables: 3, lastSyllable: 'NIO' },
  { word: 'MEMORIA', category: 'emocion', syllables: 3, lastSyllable: 'RIA' },
  { word: 'SERENIDAD', category: 'emocion', syllables: 4, lastSyllable: 'DAD' },
  { word: 'CLARIDAD', category: 'emocion', syllables: 3, lastSyllable: 'DAD' },
  { word: 'EMPATE', category: 'emocion', syllables: 3, lastSyllable: 'TE' },
  { word: 'IMPULSO', category: 'emocion', syllables: 3, lastSyllable: 'SO' },
  { word: 'PACIENCIA', category: 'emocion', syllables: 3, lastSyllable: 'CIA' },
  { word: 'EMPATÍA', category: 'emocion', syllables: 4, lastSyllable: 'A' },
  { word: 'EUFORIA', category: 'emocion', syllables: 3, lastSyllable: 'RIA' },
  { word: 'DUDA', category: 'emocion', syllables: 2, lastSyllable: 'DA' },
  { word: 'CERTEZA', category: 'emocion', syllables: 3, lastSyllable: 'ZA' },
  { word: 'TEMPLE', category: 'emocion', syllables: 2, lastSyllable: 'PLE' },
  { word: 'LUCIDEZ', category: 'emocion', syllables: 3, lastSyllable: 'DEZ' },
  { word: 'ANHELO', category: 'emocion', syllables: 3, lastSyllable: 'LO' },
  { word: 'GRATITUD', category: 'emocion', syllables: 3, lastSyllable: 'TUD' },
  { word: 'NOSTALGIA', category: 'emocion', syllables: 3, lastSyllable: 'GIA' },
  { word: 'AUDACIA', category: 'emocion', syllables: 3, lastSyllable: 'CIA' },
  { word: 'FIRMEZA', category: 'emocion', syllables: 3, lastSyllable: 'ZA' },
  { word: 'INTUICIÓN', category: 'emocion', syllables: 3, lastSyllable: 'CION' },
  { word: 'ASERTIVO', category: 'emocion', syllables: 4, lastSyllable: 'VO' },
  { word: 'CRITERIO', category: 'emocion', syllables: 3, lastSyllable: 'RIO' },
  { word: 'ESTÍMULO', category: 'emocion', syllables: 4, lastSyllable: 'LO' },
  { word: 'HÁBITO', category: 'emocion', syllables: 3, lastSyllable: 'TO' },
];

export const SYNONYM_PAIRS: readonly [string, string][] = [
  ['VELOZ', 'RÁPIDO'],
  ['SERENO', 'CALMADO'],
  ['BRILLANTE', 'LUMINOSO'],
  ['ROBUSTO', 'FUERTE'],
  ['BREVE', 'CORTO'],
  ['ASTUTO', 'INGENIOSO'],
  ['ANTIGUO', 'AÑEJO'],
  ['CLARO', 'NÍTIDO'],
  ['OCULTO', 'ESCONDIDO'],
  ['FIRME', 'ESTABLE'],
  ['ENORME', 'COLOSAL'],
  ['PRECISO', 'EXACTO'],
  ['ÁGIL', 'LIGERO'],
  ['SINCERO', 'FRANCO'],
  ['TENAZ', 'CONSTANTE'],
  ['NUEVO', 'RECIENTE'],
  ['DIFÍCIL', 'ARDUO'],
  ['ALEGRE', 'JOVIAL'],
  ['AUDAZ', 'VALIENTE'],
  ['SIMPLE', 'SENCILLO'],
];

export const ANTONYM_PAIRS: readonly [string, string][] = [
  ['VELOZ', 'LENTO'],
  ['CLARO', 'OSCURO'],
  ['FIRME', 'FRÁGIL'],
  ['BREVE', 'EXTENSO'],
  ['CALMA', 'CAOS'],
  ['SUBIR', 'BAJAR'],
  ['LLENO', 'VACÍO'],
  ['ALTO', 'BAJO'],
  ['CERCA', 'LEJOS'],
  ['FÁCIL', 'COMPLEJO'],
  ['RIGIDEZ', 'FLEXIBILIDAD'],
  ['RUIDO', 'SILENCIO'],
  ['INICIO', 'FINAL'],
  ['GANAR', 'PERDER'],
  ['UNIR', 'SEPARAR'],
  ['ACTIVO', 'PASIVO'],
  ['DULCE', 'AMARGO'],
  ['CÁLIDO', 'GÉLIDO'],
  ['ORDEN', 'DESORDEN'],
  ['CERTEZA', 'DUDA'],
];

function stripAccentsUpper(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export interface VerbalRound {
  kind: 'classify' | 'semantic' | 'chain';
  badge: string;
  prompt: string;
  stimulus: string;
  options: { id: string; label: string }[];
  correctId: string;
  explanation: string;
}

export function generateVerbalRound(
  kind: 'classify' | 'semantic' | 'chain',
  rng: Rng = Math.random
): VerbalRound {
  if (kind === 'classify') {
    const ruleType = Math.floor(rng() * 4);
    const wordEntry = pickWithRng(SPANISH_WORD_BANK, rng);
    const clean = stripAccentsUpper(wordEntry.word);

    if (ruleType === 0) {
      // Category rule
      const targetCat: WordCategoryId =
        rng() < 0.52 ? wordEntry.category : pickWithRng(Object.keys(WORD_CATEGORY_LABELS) as WordCategoryId[], rng);
      const matches = wordEntry.category === targetCat;
      return {
        kind,
        badge: 'CLASIFICACIÓN SEMÁNTICA',
        prompt: `¿Pertenece a ${WORD_CATEGORY_LABELS[targetCat].toUpperCase()}?`,
        stimulus: wordEntry.word,
        options: [
          { id: 'yes', label: 'SÍ' },
          { id: 'no', label: 'NO' },
        ],
        correctId: matches ? 'yes' : 'no',
        explanation: `${wordEntry.word} pertenece a ${WORD_CATEGORY_LABELS[wordEntry.category]}.`,
      };
    }

    if (ruleType === 1) {
      // Syllable count rule
      const targetSyl = rng() < 0.5 ? wordEntry.syllables : wordEntry.syllables === 2 ? 3 : 2;
      const matches = wordEntry.syllables === targetSyl;
      return {
        kind,
        badge: 'CONTEO SILÁBICO',
        prompt: `¿Tiene exactamente ${targetSyl} sílabas?`,
        stimulus: wordEntry.word,
        options: [
          { id: 'yes', label: 'SÍ' },
          { id: 'no', label: 'NO' },
        ],
        correctId: matches ? 'yes' : 'no',
        explanation: `${wordEntry.word} tiene ${wordEntry.syllables} ${wordEntry.syllables === 1 ? 'sílaba' : 'sílabas'}.`,
      };
    }

    if (ruleType === 2) {
      // Starts with letter
      const letters = ['A', 'B', 'C', 'E', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V'];
      const targetLetter = rng() < 0.52 ? clean[0] : pickWithRng(letters, rng);
      const matches = clean[0] === targetLetter;
      return {
        kind,
        badge: 'LETRA INICIAL',
        prompt: `¿Empieza por la letra «${targetLetter}»?`,
        stimulus: wordEntry.word,
        options: [
          { id: 'yes', label: 'SÍ' },
          { id: 'no', label: 'NO' },
        ],
        correctId: matches ? 'yes' : 'no',
        explanation: `${wordEntry.word} empieza por «${clean[0]}».`,
      };
    }

    // Ends with vowel vs consonant
    const askVowel = rng() < 0.5;
    const lastChar = clean[clean.length - 1];
    const isVowel = ['A', 'E', 'I', 'O', 'U'].includes(lastChar);
    const matches = askVowel ? isVowel : !isVowel;
    return {
      kind,
      badge: 'TERMINACIÓN',
      prompt: askVowel ? '¿Termina en VOCAL?' : '¿Termina en CONSONANTE?',
      stimulus: wordEntry.word,
      options: [
        { id: 'yes', label: 'SÍ' },
        { id: 'no', label: 'NO' },
      ],
      correctId: matches ? 'yes' : 'no',
      explanation: `${wordEntry.word} termina en «${lastChar}» (${isVowel ? 'vocal' : 'consonante'}).`,
    };
  }

  if (kind === 'semantic') {
    const sub = Math.floor(rng() * 3);
    if (sub === 0) {
      // Odd-one-out
      const cats = shuffleWithRng(Object.keys(WORD_CATEGORY_LABELS) as WordCategoryId[], rng);
      const mainCat = cats[0];
      const oddCat = cats[1];
      const mainWords = shuffleWithRng(
        SPANISH_WORD_BANK.filter((w) => w.category === mainCat),
        rng
      ).slice(0, 3);
      const oddWord = pickWithRng(
        SPANISH_WORD_BANK.filter((w) => w.category === oddCat),
        rng
      );
      const opts = shuffleWithRng([...mainWords, oddWord], rng).map((w) => ({
        id: w.word,
        label: w.word,
      }));
      return {
        kind,
        badge: 'DETECTA EL INTRUSO',
        prompt: 'Elige la única palabra que NO pertenece al mismo grupo:',
        stimulus: '¿CUÁL ES EL INTRUSO?',
        options: opts,
        correctId: oddWord.word,
        explanation: `${oddWord.word} es de ${WORD_CATEGORY_LABELS[oddCat]}; las otras 3 son de ${WORD_CATEGORY_LABELS[mainCat]}.`,
      };
    }

    if (sub === 1) {
      // Synonym
      const pair = pickWithRng(SYNONYM_PAIRS, rng);
      const flip = rng() < 0.5;
      const clue = flip ? pair[0] : pair[1];
      const answer = flip ? pair[1] : pair[0];
      const distractors = shuffleWithRng(
        SYNONYM_PAIRS.filter((p) => p !== pair).map((p) => (rng() < 0.5 ? p[0] : p[1])),
        rng
      )
        .filter((w) => w !== clue && w !== answer)
        .slice(0, 3);
      const opts = shuffleWithRng([answer, ...distractors], rng).map((w) => ({ id: w, label: w }));
      return {
        kind,
        badge: 'SINÓNIMO RELÁMPAGO',
        prompt: 'Elige el SINÓNIMO más cercano a:',
        stimulus: clue,
        options: opts,
        correctId: answer,
        explanation: `${answer} es sinónimo de ${clue}.`,
      };
    }

    // Antonym
    const pair = pickWithRng(ANTONYM_PAIRS, rng);
    const flip = rng() < 0.5;
    const clue = flip ? pair[0] : pair[1];
    const answer = flip ? pair[1] : pair[0];
    const distractors = shuffleWithRng(
      ANTONYM_PAIRS.filter((p) => p !== pair).map((p) => (rng() < 0.5 ? p[0] : p[1])),
      rng
    )
      .filter((w) => w !== clue && w !== answer)
      .slice(0, 3);
    const opts = shuffleWithRng([answer, ...distractors], rng).map((w) => ({ id: w, label: w }));
    return {
      kind,
      badge: 'ANTÓNIMO RELÁMPAGO',
      prompt: 'Elige el ANTÓNIMO (opuesto) de:',
      stimulus: clue,
      options: opts,
      correctId: answer,
      explanation: `${answer} es el opuesto de ${clue}.`,
    };
  }

  // 'chain' — word starts with the last letter of the guide word
  const candidatesWithLink = SPANISH_WORD_BANK.filter((w) => {
    const clean = stripAccentsUpper(w.word);
    const last = clean[clean.length - 1];
    return SPANISH_WORD_BANK.some(
      (other) => other.word !== w.word && stripAccentsUpper(other.word)[0] === last
    );
  });

  const anchor = pickWithRng(candidatesWithLink, rng);
  const anchorClean = stripAccentsUpper(anchor.word);
  const targetStart = anchorClean[anchorClean.length - 1];

  const matchingNext = SPANISH_WORD_BANK.filter(
    (w) => w.word !== anchor.word && stripAccentsUpper(w.word)[0] === targetStart
  );
  const nonMatching = SPANISH_WORD_BANK.filter(
    (w) => w.word !== anchor.word && stripAccentsUpper(w.word)[0] !== targetStart
  );

  const answer = pickWithRng(matchingNext, rng);
  const distractors = shuffleWithRng(nonMatching, rng).slice(0, 3);
  const opts = shuffleWithRng([answer, ...distractors], rng).map((w) => ({
    id: w.word,
    label: w.word,
  }));

  return {
    kind,
    badge: 'CADENA LÉXICA',
    prompt: `Elige la palabra que empieza con la última letra de «${anchor.word}» (${targetStart}):`,
    stimulus: `${anchor.word} -> ?`,
    options: opts,
    correctId: answer.word,
    explanation: `${anchor.word} termina en «${targetStart}» y ${answer.word} empieza por «${targetStart}».`,
  };
}
