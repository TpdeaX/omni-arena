// Motor puro de Matrices Lógicas 3x3 tipo Raven (sin DOM, con RNG sembrado)

export type RavenShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'hexagon';
export type RavenSize = 'S' | 'M' | 'L';
export type RavenFill = 'empty' | 'striped' | 'solid';
export type RavenRotation = 0 | 45 | 90;
export type RavenLevel = 1 | 2 | 3 | 4;

export interface RavenCell {
  kind: 'shapes' | 'xor';
  shape: RavenShape;
  count: 1 | 2 | 3;
  size: RavenSize;
  fill: RavenFill;
  rotation: RavenRotation;
  xorMask?: number; // 8-bit bitmask for level 4 XOR segments
}

export type AttributeKey = 'shape' | 'count' | 'size' | 'fill' | 'rotation';

export type AttributeRuleKind =
  | 'constant'
  | 'row_constant'
  | 'col_constant'
  | 'progression'
  | 'distribution';

export interface AttributeRule {
  attribute: AttributeKey;
  kind: AttributeRuleKind;
  // 3x3 matrix of expected values for this attribute
  grid: (string | number)[][];
  description: string;
}

export interface RavenPuzzle {
  level: RavenLevel;
  seed: number;
  // 3x3 grid; cell [2][2] is the target solution
  matrix: (RavenCell | null)[][];
  solution: RavenCell;
  options: RavenCell[];
  correctIndex: number;
  rules: AttributeRule[];
  hint: string;
  explanation: string;
  highlightRuleAttribute?: AttributeKey | 'xor';
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

const ALL_SHAPES: RavenShape[] = ['circle', 'square', 'triangle', 'diamond', 'hexagon'];
const ALL_COUNTS: (1 | 2 | 3)[] = [1, 2, 3];
const ALL_SIZES: RavenSize[] = ['S', 'M', 'L'];
const ALL_FILLS: RavenFill[] = ['empty', 'striped', 'solid'];
const ALL_ROTATIONS: RavenRotation[] = [0, 45, 90];

const SHAPE_LABEL: Record<RavenShape, string> = {
  circle: 'círculo',
  square: 'cuadrado',
  triangle: 'triángulo',
  diamond: 'rombo',
  hexagon: 'hexágono',
};

const SIZE_LABEL: Record<RavenSize, string> = {
  S: 'pequeño',
  M: 'mediano',
  L: 'grande',
};

const FILL_LABEL: Record<RavenFill, string> = {
  empty: 'vacío',
  striped: 'rayado',
  solid: 'lleno',
};

function formatVal(attr: AttributeKey, val: string | number): string {
  if (attr === 'shape') return SHAPE_LABEL[val as RavenShape];
  if (attr === 'size') return SIZE_LABEL[val as RavenSize];
  if (attr === 'fill') return FILL_LABEL[val as RavenFill];
  if (attr === 'rotation') return `${val}°`;
  return String(val);
}

function buildConstantRule(attr: AttributeKey, val: string | number): AttributeRule {
  return {
    attribute: attr,
    kind: 'constant',
    grid: [
      [val, val, val],
      [val, val, val],
      [val, val, val],
    ],
    description: '',
  };
}

function buildRowConstantRule(attr: AttributeKey, vals: [string | number, string | number, string | number]): AttributeRule {
  const attrName =
    attr === 'shape'
      ? 'La forma'
      : attr === 'count'
        ? 'La cantidad'
        : attr === 'size'
          ? 'El tamaño'
          : attr === 'fill'
            ? 'El relleno'
            : 'La rotación';
  return {
    attribute: attr,
    kind: 'row_constant',
    grid: [
      [vals[0], vals[0], vals[0]],
      [vals[1], vals[1], vals[1]],
      [vals[2], vals[2], vals[2]],
    ],
    description: `${attrName} se mantiene igual en cada fila (en la fila 3 es ${formatVal(attr, vals[2])}).`,
  };
}

function buildColConstantRule(attr: AttributeKey, vals: [string | number, string | number, string | number]): AttributeRule {
  const attrName =
    attr === 'shape'
      ? 'La forma'
      : attr === 'count'
        ? 'La cantidad'
        : attr === 'size'
          ? 'El tamaño'
          : attr === 'fill'
            ? 'El relleno'
            : 'La rotación';
  return {
    attribute: attr,
    kind: 'col_constant',
    grid: [
      [vals[0], vals[1], vals[2]],
      [vals[0], vals[1], vals[2]],
      [vals[0], vals[1], vals[2]],
    ],
    description: `${attrName} se mantiene igual en cada columna (en la columna 3 es ${formatVal(attr, vals[2])}).`,
  };
}

function buildProgressionRule(
  attr: AttributeKey,
  ordered: [string | number, string | number, string | number],
  reverse: boolean
): AttributeRule {
  const seq = reverse ? ([ordered[2], ordered[1], ordered[0]] as [string | number, string | number, string | number]) : ordered;
  const labelSeq = `${formatVal(attr, seq[0])} -> ${formatVal(attr, seq[1])} -> ${formatVal(attr, seq[2])}`;
  const attrName =
    attr === 'count'
      ? 'la cantidad'
      : attr === 'size'
        ? 'el tamaño'
        : attr === 'fill'
          ? 'el relleno'
          : attr === 'rotation'
            ? 'la rotación'
            : 'la forma';
  return {
    attribute: attr,
    kind: 'progression',
    grid: [
      [seq[0], seq[1], seq[2]],
      [seq[0], seq[1], seq[2]],
      [seq[0], seq[1], seq[2]],
    ],
    description: `En cada fila ${attrName} progresa en orden ${labelSeq}.`,
  };
}

function buildDistributionRule(
  attr: AttributeKey,
  vals: [string | number, string | number, string | number],
  rng: () => number
): AttributeRule {
  const perm = shuffle(vals, rng);
  const shiftDir = rng() < 0.5 ? 1 : 2;
  const row0 = [perm[0], perm[1], perm[2]];
  const row1 = [perm[shiftDir % 3], perm[(shiftDir + 1) % 3], perm[(shiftDir + 2) % 3]];
  const row2 = [perm[(shiftDir * 2) % 3], perm[(shiftDir * 2 + 1) % 3], perm[(shiftDir * 2 + 2) % 3]];
  const attrName =
    attr === 'shape'
      ? 'La forma'
      : attr === 'count'
        ? 'La cantidad'
        : attr === 'size'
          ? 'El tamaño'
          : attr === 'fill'
            ? 'El relleno'
            : 'La rotación';
  const missing = row2[2];
  return {
    attribute: attr,
    kind: 'distribution',
    grid: [row0, row1, row2],
    description: `${attrName} sigue una distribución de tres: cada fila y cada columna incluye los 3 valores (${vals.map((v) => formatVal(attr, v)).join(', ')}) sin repetir; en la fila 3 falta ${formatVal(attr, missing)}.`,
  };
}

function normalizeRotationForVisual(shape: RavenShape, rot: RavenRotation): RavenRotation {
  if (shape === 'circle') return 0;
  if (shape === 'square' || shape === 'diamond') return rot === 90 ? 0 : rot;
  return rot;
}

export function cellVisualKey(cell: RavenCell): string {
  if (cell.kind === 'xor') {
    return `xor:${cell.xorMask ?? 0}`;
  }
  const rot = normalizeRotationForVisual(cell.shape, cell.rotation);
  return `${cell.shape}:${cell.count}:${cell.size}:${cell.fill}:${rot}`;
}

export function doesOptionMatchRules(puzzle: RavenPuzzle, candidate: RavenCell): boolean {
  if (puzzle.level === 4) {
    return candidate.kind === 'xor' && candidate.xorMask === puzzle.solution.xorMask;
  }
  if (candidate.kind !== 'shapes') return false;
  for (const rule of puzzle.rules) {
    const expected = rule.grid[2][2];
    if (candidate[rule.attribute] !== expected) {
      return false;
    }
  }
  return true;
}

function generateDistractorsForShapes(
  solution: RavenCell,
  targetCount: number,
  activeAttrs: AttributeKey[],
  rng: () => number
): RavenCell[] {
  const seen = new Set<string>([cellVisualKey(solution)]);
  const distractors: RavenCell[] = [];

  const poolForAttr = (attr: AttributeKey): (string | number)[] => {
    if (attr === 'shape') return ALL_SHAPES;
    if (attr === 'count') return ALL_COUNTS;
    if (attr === 'size') return ALL_SIZES;
    if (attr === 'fill') return ALL_FILLS;
    // Rotation pool depends on shape symmetry so every variant looks visibly different
    if (solution.shape === 'circle') return [];
    if (solution.shape === 'square' || solution.shape === 'diamond') {
      return solution.rotation === 45 ? [0] : [45];
    }
    return ALL_ROTATIONS;
  };

  // Prioritize mutating 1 active attribute first, then 1 inactive attribute
  const orderedAttrs: AttributeKey[] = [
    ...shuffle(activeAttrs, rng),
    ...shuffle(
      (['shape', 'count', 'size', 'fill', 'rotation'] as AttributeKey[]).filter(
        (a) => !activeAttrs.includes(a)
      ),
      rng
    ),
  ];

  // Pass 1: single-attribute mutations
  for (const attr of orderedAttrs) {
    if (distractors.length >= targetCount) break;
    const candidates = shuffle(poolForAttr(attr), rng);
    for (const val of candidates) {
      if (distractors.length >= targetCount) break;
      if (val === solution[attr]) continue;
      const cand: RavenCell = {
        ...solution,
        [attr]: val,
      };
      const key = cellVisualKey(cand);
      if (!seen.has(key)) {
        seen.add(key);
        distractors.push(cand);
      }
    }
  }

  // Pass 2: if still short (rare, e.g. circle with few active attrs), combine two single-attribute changes
  let guard = 0;
  while (distractors.length < targetCount && guard < 120) {
    guard++;
    const a1 = pick(orderedAttrs, rng);
    const a2 = pick(orderedAttrs, rng);
    const p1 = poolForAttr(a1);
    const p2 = poolForAttr(a2);
    if (p1.length === 0 || p2.length === 0) continue;
    const cand: RavenCell = {
      ...solution,
      [a1]: pick(p1, rng),
      [a2]: pick(p2, rng),
    };
    const key = cellVisualKey(cand);
    if (!seen.has(key)) {
      seen.add(key);
      distractors.push(cand);
    }
  }

  return distractors;
}

function generateXorLevel4(seed: number, rng: () => number): RavenPuzzle {
  // 8 geometric segments in bitmask (0..255):
  // 0: top edge, 1: right edge, 2: bottom edge, 3: left edge,
  // 4: vertical center, 5: horizontal center, 6: diag TL-BR, 7: diag TR-BL
  const makeNonEmptyMask = (minBits: number, maxBits: number): number => {
    const bits = shuffle([0, 1, 2, 3, 4, 5, 6, 7], rng);
    const k = minBits + Math.floor(rng() * (maxBits - minBits + 1));
    let mask = 0;
    for (let i = 0; i < k; i++) mask |= 1 << bits[i];
    return mask;
  };

  let a = 0;
  let b = 0;
  let c = 0;
  let d = 0;
  for (let attempt = 0; attempt < 40; attempt++) {
    a = makeNonEmptyMask(2, 4);
    b = makeNonEmptyMask(2, 4);
    c = makeNonEmptyMask(2, 4);
    d = makeNonEmptyMask(2, 4);
    const r0c2 = a ^ b;
    const r1c2 = c ^ d;
    const r2c0 = a ^ c;
    const r2c1 = b ^ d;
    const r2c2 = r0c2 ^ r1c2;
    const all = [a, b, r0c2, c, d, r1c2, r2c0, r2c1, r2c2];
    if (all.every((m) => m !== 0) && new Set([a, b, c, d, r2c2]).size >= 4) {
      break;
    }
  }

  const masks: number[][] = [
    [a, b, a ^ b],
    [c, d, c ^ d],
    [a ^ c, b ^ d, a ^ b ^ c ^ d],
  ];

  const makeXorCell = (mask: number): RavenCell => ({
    kind: 'xor',
    shape: 'square',
    count: 1,
    size: 'M',
    fill: 'empty',
    rotation: 0,
    xorMask: mask,
  });

  const matrix: (RavenCell | null)[][] = masks.map((row, r) =>
    row.map((m, cIdx) => (r === 2 && cIdx === 2 ? null : makeXorCell(m)))
  );
  const solution = makeXorCell(masks[2][2]);

  // Distractors: flip 1 bit each (guarantees each fails XOR and differs by exactly 1 segment)
  const distractors: RavenCell[] = [];
  const bitOrder = shuffle([0, 1, 2, 3, 4, 5, 6, 7], rng);
  for (const bit of bitOrder) {
    if (distractors.length >= 7) break;
    const mutated = masks[2][2] ^ (1 << bit);
    if (mutated !== 0) {
      distractors.push(makeXorCell(mutated));
    }
  }
  // If 0 was skipped, flip 2 bits for 7th distractor
  if (distractors.length < 7) {
    distractors.push(makeXorCell(masks[2][2] ^ (1 << bitOrder[0]) ^ (1 << bitOrder[1])));
  }

  const combined = shuffle([solution, ...distractors], rng);
  const correctIndex = combined.findIndex((o) => o.xorMask === solution.xorMask);

  const explanation =
    'Superposición XOR por filas y columnas: un segmento aparece en la tercera casilla si y solo si está en exactamente una de las dos primeras casillas (los segmentos repetidos en ambas se cancelan).';
  const hint =
    'Observa la fila 3 (o la columna 3): compara los trazos de las dos primeras casillas. Si un trazo aparece en ambas, desaparece; si aparece solo en una, se conserva.';

  return {
    level: 4,
    seed,
    matrix,
    solution,
    options: combined,
    correctIndex,
    rules: [],
    hint,
    explanation,
    highlightRuleAttribute: 'xor',
  };
}

export function generateRavenPuzzle(level: RavenLevel, seed: number): RavenPuzzle {
  const rng = mulberry32(seed);
  if (level === 4) {
    return generateXorLevel4(seed, rng);
  }

  // Choose base constants
  const threeShapes = shuffle(ALL_SHAPES, rng).slice(0, 3) as [RavenShape, RavenShape, RavenShape];
  const baseShape = threeShapes[0];
  const baseCount = pick(ALL_COUNTS, rng);
  const baseSize = pick(ALL_SIZES, rng);
  const baseFill = pick(ALL_FILLS, rng);
  const baseRot: RavenRotation = 0;

  const rulesMap: Record<AttributeKey, AttributeRule> = {
    shape: buildConstantRule('shape', baseShape),
    count: buildConstantRule('count', baseCount),
    size: buildConstantRule('size', baseSize),
    fill: buildConstantRule('fill', baseFill),
    rotation: buildConstantRule('rotation', baseRot),
  };

  const activeAttrs: AttributeKey[] = [];

  if (level === 1) {
    // 1 main rule (progression or distribution) + optional row-constant shape/fill for clarity
    const kindPool: AttributeKey[] = ['count', 'size', 'fill', 'shape'];
    const mainAttr = pick(kindPool, rng);
    activeAttrs.push(mainAttr);

    if (mainAttr === 'count') {
      rulesMap.count = buildProgressionRule('count', ALL_COUNTS as [number, number, number], rng() < 0.5);
    } else if (mainAttr === 'size') {
      rulesMap.size = buildProgressionRule('size', ALL_SIZES as [string, string, string], rng() < 0.5);
    } else if (mainAttr === 'fill') {
      rulesMap.fill = buildProgressionRule('fill', ALL_FILLS as [string, string, string], rng() < 0.5);
    } else {
      rulesMap.shape = buildDistributionRule('shape', threeShapes, rng);
    }

    // Add a clean row_constant anchor when mainAttr isn't shape so rows look structured
    if (mainAttr !== 'shape' && rng() < 0.65) {
      rulesMap.shape = buildRowConstantRule('shape', threeShapes);
      activeAttrs.push('shape');
    }
  } else if (level === 2) {
    // 2 rules: e.g. progression on count/size/fill + row/col constant or distribution on another
    const pairPool: [AttributeKey, AttributeKey][] = [
      ['count', 'shape'],
      ['fill', 'shape'],
      ['size', 'fill'],
      ['count', 'fill'],
      ['rotation', 'fill'],
    ];
    const [a1, a2] = pick(pairPool, rng);
    activeAttrs.push(a1, a2);

    if (a1 === 'rotation') {
      // Force triangle so all 3 rotations (0, 45, 90) are distinct
      rulesMap.shape = buildConstantRule('shape', 'triangle');
      rulesMap.rotation = buildProgressionRule('rotation', [0, 45, 90], rng() < 0.5);
    } else if (a1 === 'count') {
      rulesMap.count = buildProgressionRule('count', [1, 2, 3], rng() < 0.5);
    } else if (a1 === 'fill') {
      rulesMap.fill = buildProgressionRule('fill', ['empty', 'striped', 'solid'], rng() < 0.5);
    } else if (a1 === 'size') {
      rulesMap.size = buildProgressionRule('size', ['S', 'M', 'L'], rng() < 0.5);
    }

    if (a2 === 'shape') {
      const rPick = rng();
      rulesMap.shape =
        rPick < 0.34
          ? buildRowConstantRule('shape', threeShapes)
          : rPick < 0.67
            ? buildColConstantRule('shape', threeShapes)
            : buildDistributionRule('shape', threeShapes, rng);
    } else if (a2 === 'fill') {
      rulesMap.fill = buildDistributionRule('fill', ['empty', 'striped', 'solid'], rng);
    }
  } else {
    // Level 3: 3 rules with distribution
    const triplePool: [AttributeKey, AttributeKey, AttributeKey][] = [
      ['shape', 'count', 'fill'],
      ['shape', 'size', 'fill'],
      ['count', 'size', 'fill'],
      ['rotation', 'count', 'fill'],
    ];
    const [a1, a2, a3] = pick(triplePool, rng);
    activeAttrs.push(a1, a2, a3);

    if (a1 === 'rotation') {
      rulesMap.shape = buildConstantRule('shape', 'triangle');
      rulesMap.rotation = buildDistributionRule('rotation', [0, 45, 90], rng);
    } else if (a1 === 'shape') {
      rulesMap.shape = buildDistributionRule('shape', threeShapes, rng);
    } else {
      rulesMap.count = buildDistributionRule('count', [1, 2, 3], rng);
    }

    if (a2 === 'count') {
      rulesMap.count = buildProgressionRule('count', [1, 2, 3], rng() < 0.5);
    } else if (a2 === 'size') {
      rulesMap.size = buildDistributionRule('size', ['S', 'M', 'L'], rng);
    }

    rulesMap.fill =
      a2 === 'size' && a1 === 'shape'
        ? buildProgressionRule('fill', ['empty', 'striped', 'solid'], rng() < 0.5)
        : buildDistributionRule('fill', ['empty', 'striped', 'solid'], rng);
  }

  const makeCell = (r: number, c: number): RavenCell => ({
    kind: 'shapes',
    shape: rulesMap.shape.grid[r][c] as RavenShape,
    count: rulesMap.count.grid[r][c] as 1 | 2 | 3,
    size: rulesMap.size.grid[r][c] as RavenSize,
    fill: rulesMap.fill.grid[r][c] as RavenFill,
    rotation: rulesMap.rotation.grid[r][c] as RavenRotation,
  });

  const matrix: (RavenCell | null)[][] = [
    [makeCell(0, 0), makeCell(0, 1), makeCell(0, 2)],
    [makeCell(1, 0), makeCell(1, 1), makeCell(1, 2)],
    [makeCell(2, 0), makeCell(2, 1), null],
  ];
  const solution = makeCell(2, 2);

  const optionCount = level === 1 ? 6 : 8;
  const distractors = generateDistractorsForShapes(solution, optionCount - 1, activeAttrs, rng);
  const options = shuffle([solution, ...distractors], rng);
  const solutionKey = cellVisualKey(solution);
  const correctIndex = options.findIndex((o) => cellVisualKey(o) === solutionKey);

  const activeRules = activeAttrs.map((a) => rulesMap[a]);
  const allRules = Object.values(rulesMap);

  const explanation = activeRules.map((r) => r.description).join(' ');
  const firstRule = activeRules[0];
  const hint = `Fíjate primero en la fila 3: ${firstRule.description.replace(/\.$/, '')}. Luego comprueba ${activeRules.length > 1 ? 'los demás atributos en filas y columnas.' : 'que los demás atributos permanezcan estables.'}`;

  return {
    level,
    seed,
    matrix,
    solution,
    options,
    correctIndex,
    rules: allRules,
    hint,
    explanation,
    highlightRuleAttribute: activeAttrs[0],
  };
}

function shapePathD(shape: RavenShape, cx: number, cy: number, r: number): string {
  if (shape === 'square') {
    const h = r * 0.86;
    return `M ${cx - h} ${cy - h} L ${cx + h} ${cy - h} L ${cx + h} ${cy + h} L ${cx - h} ${cy + h} Z`;
  }
  if (shape === 'diamond') {
    return `M ${cx} ${cy - r} L ${cx + r * 0.85} ${cy} L ${cx} ${cy + r} L ${cx - r * 0.85} ${cy} Z`;
  }
  if (shape === 'triangle') {
    const h = r * 0.96;
    const w = r * 0.92;
    return `M ${cx} ${cy - h} L ${cx + w} ${cy + h * 0.78} L ${cx - w} ${cy + h * 0.78} Z`;
  }
  // hexagon
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(ang)).toFixed(2)} ${(cy + r * Math.sin(ang)).toFixed(2)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

export function renderRavenCellSvg(cell: RavenCell, uid: string): string {
  if (cell.kind === 'xor') {
    const mask = cell.xorMask ?? 0;
    const segs: [number, number, number, number][] = [
      [20, 20, 80, 20], // 0: top
      [80, 20, 80, 80], // 1: right
      [20, 80, 80, 80], // 2: bottom
      [20, 20, 20, 80], // 3: left
      [50, 16, 50, 84], // 4: vertical center
      [16, 50, 84, 50], // 5: horizontal center
      [20, 20, 80, 80], // 6: diag TL-BR
      [80, 20, 20, 80], // 7: diag TR-BL
    ];
    const guides = segs
      .map(
        ([x1, y1, x2, y2]) =>
          `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-opacity="0.14" stroke-width="2" stroke-dasharray="3 4"/>`
      )
      .join('');
    const active = segs
      .map(([x1, y1, x2, y2], idx) =>
        (mask & (1 << idx)) !== 0
          ? `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`
          : ''
      )
      .join('');
    return `<svg viewBox="0 0 100 100" class="oa-raven-svg" aria-hidden="true">${guides}${active}<circle cx="50" cy="50" r="3.5" fill="currentColor" opacity="0.5"/></svg>`;
  }

  const patternId = `stripe_${uid}`;
  const defs = `<defs><pattern id="${patternId}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" stroke-width="3.2"/></pattern></defs>`;

  const fillAttr =
    cell.fill === 'empty'
      ? 'none'
      : cell.fill === 'solid'
        ? 'currentColor'
        : `url(#${patternId})`;

  const radius = cell.size === 'S' ? 11 : cell.size === 'M' ? 16 : 21;
  const centers: [number, number][] =
    cell.count === 1
      ? [[50, 50]]
      : cell.count === 2
        ? [
            [30, 50],
            [70, 50],
          ]
        : [
            [50, 28],
            [28, 69],
            [72, 69],
          ];
  const rScaled = cell.count === 1 ? radius * 1.35 : cell.count === 2 ? radius * 0.96 : radius * 0.82;

  const shapes = centers
    .map(([cx, cy]) => {
      const transform = cell.rotation !== 0 ? ` transform="rotate(${cell.rotation} ${cx} ${cy})"` : '';
      if (cell.shape === 'circle') {
        return `<circle cx="${cx}" cy="${cy}" r="${rScaled.toFixed(1)}" fill="${fillAttr}" stroke="currentColor" stroke-width="3.5"/>`;
      }
      const d = shapePathD(cell.shape, cx, cy, rScaled);
      return `<path d="${d}" fill="${fillAttr}" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"${transform}/>`;
    })
    .join('');

  return `<svg viewBox="0 0 100 100" class="oa-raven-svg" aria-hidden="true">${defs}${shapes}</svg>`;
}
