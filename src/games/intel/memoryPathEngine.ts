// Motor puro de Palacio Mental y Memoria Asociativa con Interferencia (sin DOM)

export type MemorySymbolId =
  | 'key'
  | 'compass'
  | 'book'
  | 'lamp'
  | 'anchor'
  | 'crown'
  | 'bell'
  | 'leaf'
  | 'clock'
  | 'crystal'
  | 'feather'
  | 'shield'
  | 'tower'
  | 'star';

export type MemoryLevel = 1 | 2 | 3 | 4;

export interface MemorySymbolDef {
  id: MemorySymbolId;
  word: string;
  svgInner: string;
}

export interface MemoryItem {
  order: number; // 1..N
  cellIndex: number;
  row: number;
  col: number;
  symbolId: MemorySymbolId;
  word: string;
  anchorNum: number;
}

export interface MemoryRound {
  level: MemoryLevel;
  seed: number;
  count: number;
  cols: number;
  rows: number;
  items: MemoryItem[];
  needsInterference: boolean;
  encodeTimeSec: number;
  mnemonicTip: string;
}

export interface InterferenceTask {
  kind: 'math' | 'stroop';
  prompt: string;
  stroopWord?: string;
  stroopHex?: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

export interface MemorySubmission {
  cellIndex: number;
  symbolId: MemorySymbolId;
}

export interface MemoryItemResult {
  item: MemoryItem;
  status: 'correct' | 'wrong_symbol' | 'wrong_cell' | 'missing';
  submittedSymbol?: MemorySymbolId;
  detail: string;
}

export interface MemoryRecallEvaluation {
  exactMatches: number;
  total: number;
  accuracy: number;
  allCorrect: boolean;
  details: MemoryItemResult[];
  summary: string;
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

export const MEMORY_SYMBOLS: readonly MemorySymbolDef[] = [
  {
    id: 'key',
    word: 'Llave',
    svgInner:
      '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M11 12l9-9"/><path d="M17 6l2 2"/><path d="M14.5 8.5l2 2"/>',
  },
  {
    id: 'compass',
    word: 'Brújula',
    svgInner:
      '<circle cx="12" cy="12" r="9"/><polygon points="16 8 14 14 8 16 10 10 16 8"/>',
  },
  {
    id: 'book',
    word: 'Libro',
    svgInner:
      '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  },
  {
    id: 'lamp',
    word: 'Lámpara',
    svgInner:
      '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M15.1 14c.2-1 .7-1.7 1.4-2.5A4.6 4.6 0 0 0 18 8a6 6 0 0 0-12 0c0 1 .2 2.2 1.5 3.5.7.8 1.2 1.5 1.4 2.5"/>',
  },
  {
    id: 'anchor',
    word: 'Ancla',
    svgInner:
      '<circle cx="12" cy="5" r="2.5"/><line x1="12" y1="7.5" x2="12" y2="21"/><path d="M5 13a7 7 0 0 0 14 0"/><line x1="8" y1="11" x2="16" y2="11"/>',
  },
  {
    id: 'crown',
    word: 'Corona',
    svgInner:
      '<path d="M3 18h18l-2-10-4.5 4L12 5l-2.5 7L5 8l-2 10z"/>',
  },
  {
    id: 'bell',
    word: 'Campana',
    svgInner:
      '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  },
  {
    id: 'leaf',
    word: 'Hoja',
    svgInner:
      '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M4 21l6-6"/>',
  },
  {
    id: 'clock',
    word: 'Reloj',
    svgInner:
      '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
  },
  {
    id: 'crystal',
    word: 'Cristal',
    svgInner:
      '<polygon points="12 2 19 9 12 22 5 9 12 2"/><line x1="5" y1="9" x2="19" y2="9"/>',
  },
  {
    id: 'feather',
    word: 'Pluma',
    svgInner:
      '<path d="M20.2 3.8a5.5 5.5 0 0 0-7.8 0L5 11.2V19h7.8l7.4-7.4a5.5 5.5 0 0 0 0-7.8z"/><line x1="3" y1="21" x2="15" y2="9"/>',
  },
  {
    id: 'shield',
    word: 'Escudo',
    svgInner:
      '<path d="M12 21s7-3.5 7-9V5l-7-2.5L5 5v7c0 5.5 7 9 7 9z"/>',
  },
  {
    id: 'tower',
    word: 'Torre',
    svgInner:
      '<path d="M7 21h10"/><path d="M8 21l1-11h6l1 11"/><path d="M7 10h10V5h-2v2h-2V5h-2v2H9V5H7v5z"/>',
  },
  {
    id: 'star',
    word: 'Estrella',
    svgInner:
      '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>',
  },
];

const SYMBOL_BY_ID = new Map<MemorySymbolId, MemorySymbolDef>(
  MEMORY_SYMBOLS.map((s) => [s.id, s])
);

export function renderMemorySymbolSvg(symbolId: MemorySymbolId, size = 28): string {
  const def = SYMBOL_BY_ID.get(symbolId) ?? MEMORY_SYMBOLS[0];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${def.svgInner}</svg>`;
}

export function getSymbolWord(symbolId: MemorySymbolId): string {
  return SYMBOL_BY_ID.get(symbolId)?.word ?? symbolId;
}

export function buildMnemonicTip(items: readonly MemoryItem[]): string {
  if (items.length === 0) return '';
  const ordered = [...items].sort((a, b) => a.order - b.order);
  const steps = ordered.map(
    (it) => `${it.order}. ${it.word} en (F${it.row + 1}, C${it.col + 1})`
  );
  if (ordered.length >= 2) {
    return (
      `Palacio Mental: recorre mentalmente las salas en orden creando una escena entre objetos vecinos: ` +
      `${steps.join(' → ')}. Visualiza cómo el objeto ${ordered[0].word} interactúa con ${ordered[1].word}.`
    );
  }
  return `Palacio Mental: fija ${steps[0]} en su coordenada exacta.`;
}

export function generateMemoryRound(
  countInput: number,
  level: MemoryLevel,
  seed: number
): MemoryRound {
  const rng = mulberry32(seed);
  const count = Math.max(3, Math.min(10, Math.round(countInput)));

  const cols = count <= 4 ? 3 : count <= 7 ? 4 : 5;
  const rows = count <= 4 ? 3 : 4;
  const totalCells = cols * rows;

  const allCells = Array.from({ length: totalCells }, (_, i) => i);
  const pickedCells = shuffle(allCells, rng).slice(0, count);
  const pickedSymbols = shuffle(MEMORY_SYMBOLS, rng).slice(0, count);

  const items: MemoryItem[] = pickedCells.map((cellIndex, idx) => {
    const row = Math.floor(cellIndex / cols);
    const col = cellIndex % cols;
    const sym = pickedSymbols[idx];
    const anchorNum = 10 + Math.floor(rng() * 89);
    return {
      order: idx + 1,
      cellIndex,
      row,
      col,
      symbolId: sym.id,
      word: sym.word,
      anchorNum,
    };
  });

  const needsInterference = level >= 2 || count >= 5;
  const encodeTimeSec = Math.max(8, Math.min(26, 6 + count * 2));
  const mnemonicTip = buildMnemonicTip(items);

  return {
    level,
    seed,
    count,
    cols,
    rows,
    items,
    needsInterference,
    encodeTimeSec,
    mnemonicTip,
  };
}

interface StroopColor {
  name: string;
  hex: string;
}

const STROOP_COLORS: readonly StroopColor[] = [
  { name: 'Rojo', hex: '#EF4444' },
  { name: 'Azul', hex: '#3B82F6' },
  { name: 'Verde', hex: '#22C55E' },
  { name: 'Amarillo', hex: '#EAB308' },
];

export function generateInterferenceTask(
  level: MemoryLevel,
  seed: number
): InterferenceTask {
  const rng = mulberry32(seed ^ 0x517cc1b7);
  const useStroop = rng() < 0.5;

  if (useStroop) {
    const wordIdx = Math.floor(rng() * STROOP_COLORS.length);
    let inkIdx = Math.floor(rng() * STROOP_COLORS.length);
    if (inkIdx === wordIdx) {
      inkIdx = (inkIdx + 1) % STROOP_COLORS.length;
    }
    const wordObj = STROOP_COLORS[wordIdx];
    const inkObj = STROOP_COLORS[inkIdx];
    const shuffled = shuffle(STROOP_COLORS, rng);
    const options: [string, string, string, string] = [
      shuffled[0].name,
      shuffled[1].name,
      shuffled[2].name,
      shuffled[3].name,
    ];
    const correctIndex = options.indexOf(inkObj.name);

    return {
      kind: 'stroop',
      prompt: 'Control de interferencia (Stroop): elige el COLOR de la tinta, NO lo que dice la palabra.',
      stroopWord: wordObj.name.toUpperCase(),
      stroopHex: inkObj.hex,
      options,
      correctIndex,
      explanation: `La palabra decía "${wordObj.name.toUpperCase()}", pero estaba pintada en color ${inkObj.name}.`,
    };
  }

  // Interferencia aritmetica rapida
  let expr = '';
  let ans = 0;
  if (level <= 2) {
    const a = 14 + Math.floor(rng() * 35);
    const b = 12 + Math.floor(rng() * 28);
    expr = `${a} + ${b}`;
    ans = a + b;
  } else {
    const a = 6 + Math.floor(rng() * 6);
    const b = 4 + Math.floor(rng() * 6);
    const c = 3 + Math.floor(rng() * 9);
    expr = `${a} × ${b} - ${c}`;
    ans = a * b - c;
  }

  const wrongSet = new Set<number>([ans]);
  const wrongArr: number[] = [];
  const deltas = [-10, -2, -1, 1, 2, 10, 3, -3];
  for (const d of shuffle(deltas, rng)) {
    const cand = ans + d;
    if (cand > 0 && !wrongSet.has(cand)) {
      wrongSet.add(cand);
      wrongArr.push(cand);
      if (wrongArr.length === 3) break;
    }
  }
  while (wrongArr.length < 3) {
    const cand = ans + wrongArr.length + 4;
    if (!wrongSet.has(cand)) {
      wrongSet.add(cand);
      wrongArr.push(cand);
    }
  }

  const pool = shuffle([ans, wrongArr[0], wrongArr[1], wrongArr[2]], rng);
  const options: [string, string, string, string] = [
    String(pool[0]),
    String(pool[1]),
    String(pool[2]),
    String(pool[3]),
  ];
  const correctIndex = pool.indexOf(ans);

  return {
    kind: 'math',
    prompt: `Control de interferencia: resuelve mentalmente\n${expr} = ?`,
    options,
    correctIndex,
    explanation: `El resultado exacto de ${expr} es ${ans}.`,
  };
}

export function evaluateMemoryRecall(
  targets: readonly MemoryItem[],
  submissions: readonly MemorySubmission[]
): MemoryRecallEvaluation {
  const byCell = new Map<number, MemorySymbolId>();
  const bySymbol = new Map<MemorySymbolId, number>();

  for (const sub of submissions) {
    byCell.set(sub.cellIndex, sub.symbolId);
    bySymbol.set(sub.symbolId, sub.cellIndex);
  }

  let exactMatches = 0;
  const details: MemoryItemResult[] = targets.map((item) => {
    const atCell = byCell.get(item.cellIndex);
    if (atCell === item.symbolId) {
      exactMatches++;
      return {
        item,
        status: 'correct',
        submittedSymbol: atCell,
        detail: `${item.word} recordada en (F${item.row + 1}, C${item.col + 1}).`,
      };
    }
    if (atCell !== undefined) {
      return {
        item,
        status: 'wrong_symbol',
        submittedSymbol: atCell,
        detail: `En (F${item.row + 1}, C${item.col + 1}) iba ${item.word}, no ${getSymbolWord(atCell)}.`,
      };
    }
    const placedCell = bySymbol.get(item.symbolId);
    if (placedCell !== undefined) {
      return {
        item,
        status: 'wrong_cell',
        submittedSymbol: item.symbolId,
        detail: `${item.word} iba en (F${item.row + 1}, C${item.col + 1}), pero la colocaste en otra casilla.`,
      };
    }
    return {
      item,
      status: 'missing',
      detail: `Faltó colocar ${item.word} en (F${item.row + 1}, C${item.col + 1}).`,
    };
  });

  const total = targets.length;
  const extraWrong = submissions.filter(
    (s) => !targets.some((t) => t.cellIndex === s.cellIndex && t.symbolId === s.symbolId)
  ).length;
  const accuracy = total === 0 ? 100 : Math.round((exactMatches / total) * 100);
  const allCorrect = exactMatches === total && extraWrong === 0;

  const summary = allCorrect
    ? `Recuerdo perfecto: ${exactMatches} de ${total} asociaciones en su posición exacta.`
    : `Acertaste ${exactMatches} de ${total} asociaciones exactas (${accuracy}%). Revisa las casillas marcadas para fijar la ruta.`;

  return {
    exactMatches,
    total,
    accuracy,
    allCorrect,
    details,
    summary,
  };
}
