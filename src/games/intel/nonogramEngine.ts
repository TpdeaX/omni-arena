// Motor puro de Nonogramas Deductivos 5x5, 8x8 y 10x10 (sin DOM, con solver por lineas)

export type NonogramSize = 5 | 8 | 10;
export type NonogramCellMark = 0 | 1 | -1; // 0: vacia, 1: pintada, -1: descartada (X)

export interface NonogramClues {
  rows: number[][];
  cols: number[][];
}

export interface NonogramPuzzle {
  size: NonogramSize;
  seed: number;
  title: string;
  clues: NonogramClues;
  solution: number[][]; // matriz 0 | 1
}

export interface NonogramSolveResult {
  solved: boolean;
  contradicted: boolean;
  board: NonogramCellMark[][];
  solution: number[][] | null;
}

export interface NonogramHint {
  row: number;
  col: number;
  value: 1 | -1;
  axis: 'row' | 'col';
  lineIndex: number;
  highlightCells: { row: number; col: number }[];
  title: string;
  explanation: string;
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

export function computeLineClues(line: readonly number[]): number[] {
  const runs: number[] = [];
  let cur = 0;
  for (const cell of line) {
    if (cell === 1) {
      cur++;
    } else if (cur > 0) {
      runs.push(cur);
      cur = 0;
    }
  }
  if (cur > 0) runs.push(cur);
  return runs.length > 0 ? runs : [0];
}

export function computeCluesFromGrid(grid: readonly (readonly number[])[]): NonogramClues {
  const size = grid.length;
  const rows: number[][] = [];
  const cols: number[][] = [];
  for (let r = 0; r < size; r++) {
    rows.push(computeLineClues(grid[r]));
  }
  for (let c = 0; c < size; c++) {
    const col: number[] = [];
    for (let r = 0; r < size; r++) {
      col.push(grid[r][c]);
    }
    cols.push(computeLineClues(col));
  }
  return { rows, cols };
}

export function isLineSatisfied(
  lineMarks: readonly NonogramCellMark[],
  clue: readonly number[]
): boolean {
  if (clue.length === 1 && clue[0] === 0) {
    return lineMarks.every((m) => m === -1);
  }
  const actual = computeLineClues(lineMarks.map((m) => (m === 1 ? 1 : 0)));
  if (actual.length !== clue.length) return false;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== clue[i]) return false;
  }
  return true;
}

interface LineDeduction {
  validCount: number;
  forcedFill: number[];
  forcedEmpty: number[];
}

function deduceLine(
  line: readonly NonogramCellMark[],
  clue: readonly number[]
): LineDeduction {
  const n = line.length;

  // Caso especial pista [0]: toda la linea debe estar vacia
  if (clue.length === 1 && clue[0] === 0) {
    for (let i = 0; i < n; i++) {
      if (line[i] === 1) return { validCount: 0, forcedFill: [], forcedEmpty: [] };
    }
    const forcedEmpty: number[] = [];
    for (let i = 0; i < n; i++) {
      if (line[i] === 0) forcedEmpty.push(i);
    }
    return { validCount: 1, forcedFill: [], forcedEmpty };
  }

  const k = clue.length;
  const minTailLen = new Array<number>(k + 1).fill(0);
  for (let idx = k - 1; idx >= 0; idx--) {
    minTailLen[idx] = clue[idx] + (idx < k - 1 ? 1 + minTailLen[idx + 1] : 0);
  }

  const fillCount = new Int32Array(n);
  const emptyCount = new Int32Array(n);
  const buf = new Int8Array(n);
  let validCount = 0;

  function placeBlock(blockIdx: number, startPos: number): void {
    if (blockIdx === k) {
      for (let i = startPos; i < n; i++) {
        if (line[i] === 1) return;
        buf[i] = 0;
      }
      validCount++;
      for (let i = 0; i < n; i++) {
        if (buf[i] === 1) fillCount[i]++;
        else emptyCount[i]++;
      }
      return;
    }

    const len = clue[blockIdx];
    const maxStart = n - minTailLen[blockIdx];
    for (let pos = startPos; pos <= maxStart; pos++) {
      // Celdas previas a pos deben admitir 0
      if (pos > startPos && line[pos - 1] === 1) break;

      let canPlace = true;
      for (let p = pos; p < pos + len; p++) {
        if (line[p] === -1) {
          canPlace = false;
          break;
        }
      }
      if (!canPlace) {
        if (pos > startPos) buf[pos - 1] = 0;
        continue;
      }

      // Separador despues del bloque si no es el ultimo
      const afterPos = pos + len;
      if (blockIdx < k - 1 && afterPos < n && line[afterPos] === 1) {
        continue;
      }

      for (let i = startPos; i < pos; i++) buf[i] = 0;
      for (let p = pos; p < pos + len; p++) buf[p] = 1;
      if (blockIdx < k - 1) {
        buf[afterPos] = 0;
        placeBlock(blockIdx + 1, afterPos + 1);
      } else {
        placeBlock(blockIdx + 1, afterPos);
      }
    }
  }

  placeBlock(0, 0);

  if (validCount === 0) {
    return { validCount: 0, forcedFill: [], forcedEmpty: [] };
  }

  const forcedFill: number[] = [];
  const forcedEmpty: number[] = [];
  for (let i = 0; i < n; i++) {
    if (line[i] !== 0) continue;
    if (fillCount[i] === validCount) forcedFill.push(i);
    else if (emptyCount[i] === validCount) forcedEmpty.push(i);
  }
  return { validCount, forcedFill, forcedEmpty };
}

export function solveNonogramLineWise(clues: NonogramClues): NonogramSolveResult {
  const size = clues.rows.length;
  const board: NonogramCellMark[][] = Array.from({ length: size }, () =>
    Array<NonogramCellMark>(size).fill(0)
  );

  let changed = true;
  while (changed) {
    changed = false;

    for (let r = 0; r < size; r++) {
      const ded = deduceLine(board[r], clues.rows[r]);
      if (ded.validCount === 0) {
        return { solved: false, contradicted: true, board, solution: null };
      }
      for (const c of ded.forcedFill) {
        board[r][c] = 1;
        changed = true;
      }
      for (const c of ded.forcedEmpty) {
        board[r][c] = -1;
        changed = true;
      }
    }

    for (let c = 0; c < size; c++) {
      const colLine = board.map((row) => row[c]);
      const ded = deduceLine(colLine, clues.cols[c]);
      if (ded.validCount === 0) {
        return { solved: false, contradicted: true, board, solution: null };
      }
      for (const r of ded.forcedFill) {
        board[r][c] = 1;
        changed = true;
      }
      for (const r of ded.forcedEmpty) {
        board[r][c] = -1;
        changed = true;
      }
    }
  }

  const allResolved = board.every((row) => row.every((cell) => cell !== 0));
  if (!allResolved) {
    return { solved: false, contradicted: false, board, solution: null };
  }

  const solution = board.map((row) => row.map((cell) => (cell === 1 ? 1 : 0)));
  return { solved: true, contradicted: false, board, solution };
}

export function getNonogramHint(
  board: readonly (readonly NonogramCellMark[])[],
  clues: NonogramClues
): NonogramHint | null {
  const size = clues.rows.length;

  interface CandidateHint {
    priority: number;
    hint: NonogramHint;
  }

  const candidates: CandidateHint[] = [];

  const evaluateLine = (
    axis: 'row' | 'col',
    lineIdx: number,
    lineMarks: NonogramCellMark[],
    clue: number[]
  ) => {
    const ded = deduceLine(lineMarks, clue);
    if (ded.validCount === 0) return;
    if (ded.forcedFill.length === 0 && ded.forcedEmpty.length === 0) return;

    const lineName = axis === 'row' ? `Fila ${lineIdx + 1}` : `Columna ${lineIdx + 1}`;
    const clueText = `[${clue.join(', ')}]`;
    const highlightCells = Array.from({ length: size }, (_, k) =>
      axis === 'row' ? { row: lineIdx, col: k } : { row: k, col: lineIdx }
    );

    const sumRuns = clue.reduce((a, b) => a + b, 0);
    const minNeeded = clue[0] === 0 ? 0 : sumRuns + (clue.length - 1);
    const placedFilled = lineMarks.filter((m) => m === 1).length;

    let priority = 5;
    let title = `Deducción en ${lineName}`;
    let targetPos = ded.forcedFill.length > 0 ? ded.forcedFill[0] : ded.forcedEmpty[0];
    let targetVal: 1 | -1 = ded.forcedFill.length > 0 ? 1 : -1;
    let explanation = '';

    if (clue.length === 1 && clue[0] === 0) {
      priority = 1;
      title = `Línea vacía en ${lineName}`;
      targetPos = ded.forcedEmpty[0];
      targetVal = -1;
      explanation = `${lineName} tiene pista [0]: no lleva ninguna casilla pintada, por lo que puedes descartar sus casillas con X.`;
    } else if (minNeeded === size && lineMarks.every((m) => m === 0)) {
      priority = 2;
      title = `Suma exacta en ${lineName}`;
      explanation = `${lineName} tiene pista ${clueText} en largo ${size}: los bloques más sus espacios mínimos suman exactamente ${size}, así que toda la línea queda determinada.`;
    } else if (placedFilled === sumRuns && ded.forcedEmpty.length > 0) {
      priority = 2;
      title = `Bloques completos en ${lineName}`;
      targetPos = ded.forcedEmpty[0];
      targetVal = -1;
      explanation = `${lineName} ya tiene las ${sumRuns} casillas pintadas de su pista ${clueText}: las casillas libres restantes deben marcarse con X.`;
    } else if (
      clue.length === 1 &&
      clue[0] > Math.floor(size / 2) &&
      ded.forcedFill.length > 0 &&
      lineMarks.every((m) => m === 0)
    ) {
      priority = 3;
      const overlapCount = 2 * clue[0] - size;
      title = `Solapamiento en ${lineName}`;
      explanation = `${lineName} tiene pista ${clueText} en largo ${size}: las ${overlapCount} casillas centrales deben ir pintadas sin importar desde qué borde empiece el bloque.`;
    } else {
      const coordLabel =
        axis === 'row'
          ? `Fila ${lineIdx + 1}, Columna ${targetPos + 1}`
          : `Fila ${targetPos + 1}, Columna ${lineIdx + 1}`;
      explanation =
        `${lineName} con pista ${clueText}: considerando las casillas pintadas y las X actuales, ` +
        `la casilla (${coordLabel}) queda forzada como ${targetVal === 1 ? 'pintada' : 'descartada (X)'}.`;
    }

    const row = axis === 'row' ? lineIdx : targetPos;
    const col = axis === 'row' ? targetPos : lineIdx;

    candidates.push({
      priority,
      hint: {
        row,
        col,
        value: targetVal,
        axis,
        lineIndex: lineIdx,
        highlightCells,
        title,
        explanation,
      },
    });
  };

  for (let r = 0; r < size; r++) {
    evaluateLine('row', r, [...board[r]], clues.rows[r]);
  }
  for (let c = 0; c < size; c++) {
    evaluateLine(
      'col',
      c,
      board.map((row) => row[c]),
      clues.cols[c]
    );
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0].hint;
}

interface CuratedPattern {
  title: string;
  rows: string[];
}

const CURATED_5: readonly CuratedPattern[] = [
  {
    title: 'Corazón',
    rows: ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'],
  },
  {
    title: 'Flecha',
    rows: ['..X..', '.XXX.', 'X.X.X', '..X..', '..X..'],
  },
  {
    title: 'Reloj de arena',
    rows: ['XXXXX', '.XXX.', '..X..', '.XXX.', 'XXXXX'],
  },
  {
    title: 'Copa',
    rows: ['XXXXX', 'XXXXX', '.XXX.', '..X..', '.XXX.'],
  },
  {
    title: 'Llave',
    rows: ['.XX..', 'X..X.', '.XXXX', '...X.', '...XX'],
  },
  {
    title: 'Pino',
    rows: ['..X..', '.XXX.', 'XXXXX', '..X..', '.XXX.'],
  },
];

const CURATED_8: readonly CuratedPattern[] = [
  {
    title: 'Barco',
    rows: [
      '....X...',
      '...XX...',
      '..XXX...',
      '.XXXX...',
      '....X...',
      'XXXXXXXX',
      '.XXXXXX.',
      '..XXXX..',
    ],
  },
  {
    title: 'Cohete',
    rows: [
      '...XX...',
      '..XXXX..',
      '..XXXX..',
      '.XXXXXX.',
      '.X.XX.X.',
      'XX.XX.XX',
      '...XX...',
      '..X..X..',
    ],
  },
  {
    title: 'Nota musical',
    rows: [
      '...XXXXX',
      '...XXXXX',
      '...X...X',
      '...X...X',
      '.XXX.XXX',
      'XXXX.XXX',
      '.XX...X.',
      '........',
    ],
  },
  {
    title: 'Corona',
    rows: [
      'X..XX..X',
      'XX.XX.XX',
      'XXXXXXXX',
      'XXXXXXXX',
      '.XXXXXX.',
      '.XXXXXX.',
      'XXXXXXXX',
      '........',
    ],
  },
];

const CURATED_10: readonly CuratedPattern[] = [
  {
    title: 'Castillo',
    rows: [
      'XX..XX..XX',
      'XX..XX..XX',
      'XXXXXXXXXX',
      '.XXXXXXXX.',
      '.XX.XX.XX.',
      '.XXXXXXXX.',
      '.XXX..XXX.',
      '.XXX..XXX.',
      'XXXX..XXXX',
      'XXXXXXXXXX',
    ],
  },
  {
    title: 'Escudo',
    rows: [
      '.XXXXXXXX.',
      'XXXXXXXXXX',
      'XX.XXXX.XX',
      'XX.XXXX.XX',
      'XXXXXXXXXX',
      '.XXXXXXXX.',
      '.XXXXXXXX.',
      '..XXXXXX..',
      '...XXXX...',
      '....XX....',
    ],
  },
  {
    title: 'Árbol',
    rows: [
      '....XX....',
      '...XXXX...',
      '..XXXXXX..',
      '.XXXXXXXX.',
      '..XXXXXX..',
      '.XXXXXXXX.',
      'XXXXXXXXXX',
      '....XX....',
      '....XX....',
      '..XXXXXX..',
    ],
  },
];

function parsePattern(rows: readonly string[]): number[][] {
  return rows.map((line) => line.split('').map((ch) => (ch === 'X' ? 1 : 0)));
}

function tryBuildProceduralNonogram(
  size: NonogramSize,
  rng: () => number
): NonogramPuzzle | null {
  const density = size === 5 ? 0.56 : size === 8 ? 0.54 : 0.52;
  const grid: number[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => (rng() < density ? 1 : 0))
  );

  // Asegurar al menos una celda pintada por fila para evitar tableros triviales vacios
  for (let r = 0; r < size; r++) {
    if (grid[r].every((v) => v === 0)) {
      grid[r][Math.floor(rng() * size)] = 1;
    }
  }

  const clues = computeCluesFromGrid(grid);
  const res = solveNonogramLineWise(clues);
  if (!res.solved || !res.solution) return null;

  return {
    size,
    seed: 0,
    title: `Patrón lógico ${size}x${size}`,
    clues,
    solution: res.solution,
  };
}

export function generateNonogramPuzzle(
  size: NonogramSize,
  seed: number
): NonogramPuzzle {
  const rng = mulberry32(seed);

  // En semillas pares o primeras rondas, intentar primero una silueta reconocible verificada
  const bank = size === 5 ? CURATED_5 : size === 8 ? CURATED_8 : CURATED_10;
  if (Math.abs(seed) % 3 === 0 && bank.length > 0) {
    const startIdx = Math.floor(rng() * bank.length);
    for (let off = 0; off < bank.length; off++) {
      const item = bank[(startIdx + off) % bank.length];
      const grid = parsePattern(item.rows);
      const clues = computeCluesFromGrid(grid);
      const solved = solveNonogramLineWise(clues);
      if (solved.solved && solved.solution) {
        return {
          size,
          seed,
          title: `Silueta: ${item.title}`,
          clues,
          solution: solved.solution,
        };
      }
    }
  }

  // Generacion procedural verificada por solver deductivo de lineas
  for (let attempt = 0; attempt < 240; attempt++) {
    const proc = tryBuildProceduralNonogram(size, rng);
    if (proc) {
      return {
        ...proc,
        seed,
      };
    }
  }

  // Respaldo garantizado desde el banco curado verificado
  for (const item of bank) {
    const grid = parsePattern(item.rows);
    const clues = computeCluesFromGrid(grid);
    const solved = solveNonogramLineWise(clues);
    if (solved.solved && solved.solution) {
      return {
        size,
        seed,
        title: `Silueta: ${item.title}`,
        clues,
        solution: solved.solution,
      };
    }
  }

  // Ultimo respaldo determinista escalonado (diagonal unica 100% deducible)
  const fallbackGrid = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (__, c) => (c <= r ? 1 : 0))
  );
  return {
    size,
    seed,
    title: `Escalera ${size}x${size}`,
    clues: computeCluesFromGrid(fallbackGrid),
    solution: fallbackGrid,
  };
}
