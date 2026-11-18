// Motor puro de Sudoku 4x4, 6x6 y 9x9 con solución única verificada y pistas razonadas (sin DOM)

export type SudokuSize = 4 | 6 | 9;
export type SudokuDifficulty = 'easy' | 'medium' | 'hard';

export type SudokuHintTechnique =
  | 'naked_single'
  | 'hidden_single'
  | 'naked_pair'
  | 'intersection'
  | 'advanced';

export interface SudokuCoord {
  row: number;
  col: number;
}

export interface SudokuElimination {
  row: number;
  col: number;
  values: number[];
}

export interface SudokuHint {
  kind: 'place' | 'eliminate';
  technique: SudokuHintTechnique;
  row: number;
  col: number;
  value?: number;
  eliminations?: SudokuElimination[];
  highlightCells: SudokuCoord[];
  title: string;
  explanation: string;
}

export interface SudokuPuzzle {
  size: SudokuSize;
  boxRows: number;
  boxCols: number;
  difficulty: SudokuDifficulty;
  seed: number;
  givens: number[];   // 0 = empty, 1..size = fixed clue
  solution: number[]; // complete valid board
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

export function getBoxDims(size: SudokuSize): { boxRows: number; boxCols: number } {
  if (size === 4) return { boxRows: 2, boxCols: 2 };
  if (size === 6) return { boxRows: 2, boxCols: 3 };
  return { boxRows: 3, boxCols: 3 };
}

export function getBoxIndex(row: number, col: number, size: SudokuSize): number {
  const { boxRows, boxCols } = getBoxDims(size);
  const boxesPerRow = size / boxCols;
  return Math.floor(row / boxRows) * boxesPerRow + Math.floor(col / boxCols);
}

function popcount(mask: number): number {
  let m = mask;
  let c = 0;
  while (m !== 0) {
    m &= m - 1;
    c++;
  }
  return c;
}

function lowestBitValue(mask: number): number {
  // mask has bit (v - 1) set for digit v
  let idx = 0;
  let m = mask;
  while ((m & 1) === 0) {
    m >>= 1;
    idx++;
  }
  return idx + 1;
}

function maskToDigits(mask: number, size: SudokuSize): number[] {
  const res: number[] = [];
  for (let v = 1; v <= size; v++) {
    if ((mask & (1 << (v - 1))) !== 0) res.push(v);
  }
  return res;
}

export function countSolutions(board: readonly number[], size: SudokuSize, limit = 2): number {
  return solveAndCount(board, size, limit).count;
}

export function solveAndCount(
  board: readonly number[],
  size: SudokuSize,
  limit = 2
): { count: number; solution: number[] | null } {
  const total = size * size;
  const allMask = (1 << size) - 1;
  const work = [...board];
  const rowMask = new Int32Array(size);
  const colMask = new Int32Array(size);
  const boxMask = new Int32Array(size);

  for (let idx = 0; idx < total; idx++) {
    const v = work[idx];
    if (v === 0) continue;
    if (v < 1 || v > size) return { count: 0, solution: null };
    const r = Math.floor(idx / size);
    const c = idx % size;
    const b = getBoxIndex(r, c, size);
    const bit = 1 << (v - 1);
    if ((rowMask[r] & bit) !== 0 || (colMask[c] & bit) !== 0 || (boxMask[b] & bit) !== 0) {
      return { count: 0, solution: null };
    }
    rowMask[r] |= bit;
    colMask[c] |= bit;
    boxMask[b] |= bit;
  }

  let count = 0;
  let firstSolution: number[] | null = null;

  const search = (): void => {
    if (count >= limit) return;

    let bestIdx = -1;
    let bestCandidates = 0;
    let bestCount = size + 1;

    for (let idx = 0; idx < total; idx++) {
      if (work[idx] !== 0) continue;
      const r = Math.floor(idx / size);
      const c = idx % size;
      const b = getBoxIndex(r, c, size);
      const used = rowMask[r] | colMask[c] | boxMask[b];
      const cand = allMask & ~used;
      const cnt = popcount(cand);
      if (cnt === 0) return;
      if (cnt < bestCount) {
        bestCount = cnt;
        bestIdx = idx;
        bestCandidates = cand;
        if (cnt === 1) break;
      }
    }

    if (bestIdx === -1) {
      count++;
      if (count === 1) {
        firstSolution = [...work];
      }
      return;
    }

    const r = Math.floor(bestIdx / size);
    const c = bestIdx % size;
    const b = getBoxIndex(r, c, size);
    let m = bestCandidates;
    while (m !== 0 && count < limit) {
      const bit = m & -m;
      m &= m - 1;
      const v = lowestBitValue(bit);
      work[bestIdx] = v;
      rowMask[r] |= bit;
      colMask[c] |= bit;
      boxMask[b] |= bit;

      search();

      work[bestIdx] = 0;
      rowMask[r] &= ~bit;
      colMask[c] &= ~bit;
      boxMask[b] &= ~bit;
    }
  };

  search();
  return { count, solution: firstSolution };
}

export function generateFullBoard(size: SudokuSize, rng: () => number): number[] {
  const total = size * size;
  const allMask = (1 << size) - 1;
  const work = new Array<number>(total).fill(0);
  const rowMask = new Int32Array(size);
  const colMask = new Int32Array(size);
  const boxMask = new Int32Array(size);

  const digits = Array.from({ length: size }, (_, i) => i + 1);

  const fill = (): boolean => {
    let bestIdx = -1;
    let bestCand = 0;
    let bestCount = size + 1;

    for (let idx = 0; idx < total; idx++) {
      if (work[idx] !== 0) continue;
      const r = Math.floor(idx / size);
      const c = idx % size;
      const b = getBoxIndex(r, c, size);
      const cand = allMask & ~(rowMask[r] | colMask[c] | boxMask[b]);
      const cnt = popcount(cand);
      if (cnt === 0) return false;
      if (cnt < bestCount) {
        bestCount = cnt;
        bestIdx = idx;
        bestCand = cand;
        if (cnt === 1) break;
      }
    }

    if (bestIdx === -1) return true;

    const r = Math.floor(bestIdx / size);
    const c = bestIdx % size;
    const b = getBoxIndex(r, c, size);
    const order = shuffle(digits, rng);

    for (const v of order) {
      const bit = 1 << (v - 1);
      if ((bestCand & bit) === 0) continue;
      work[bestIdx] = v;
      rowMask[r] |= bit;
      colMask[c] |= bit;
      boxMask[b] |= bit;
      if (fill()) return true;
      work[bestIdx] = 0;
      rowMask[r] &= ~bit;
      colMask[c] &= ~bit;
      boxMask[b] &= ~bit;
    }
    return false;
  };

  fill();
  return work;
}

function getAllUnits(size: SudokuSize): { kind: 'row' | 'col' | 'box'; index: number; cells: number[] }[] {
  const units: { kind: 'row' | 'col' | 'box'; index: number; cells: number[] }[] = [];
  const { boxRows, boxCols } = getBoxDims(size);
  for (let r = 0; r < size; r++) {
    units.push({
      kind: 'row',
      index: r,
      cells: Array.from({ length: size }, (_, c) => r * size + c),
    });
  }
  for (let c = 0; c < size; c++) {
    units.push({
      kind: 'col',
      index: c,
      cells: Array.from({ length: size }, (_, r) => r * size + c),
    });
  }
  const boxesPerRow = size / boxCols;
  for (let b = 0; b < size; b++) {
    const br = Math.floor(b / boxesPerRow) * boxRows;
    const bc = (b % boxesPerRow) * boxCols;
    const cells: number[] = [];
    for (let dr = 0; dr < boxRows; dr++) {
      for (let dc = 0; dc < boxCols; dc++) {
        cells.push((br + dr) * size + (bc + dc));
      }
    }
    units.push({ kind: 'box', index: b, cells });
  }
  return units;
}

function computeInitialCandidateMasks(board: readonly number[], size: SudokuSize): Int32Array {
  const total = size * size;
  const allMask = (1 << size) - 1;
  const rowMask = new Int32Array(size);
  const colMask = new Int32Array(size);
  const boxMask = new Int32Array(size);

  for (let idx = 0; idx < total; idx++) {
    const v = board[idx];
    if (v === 0) continue;
    const r = Math.floor(idx / size);
    const c = idx % size;
    const b = getBoxIndex(r, c, size);
    const bit = 1 << (v - 1);
    rowMask[r] |= bit;
    colMask[c] |= bit;
    boxMask[b] |= bit;
  }

  const cands = new Int32Array(total);
  for (let idx = 0; idx < total; idx++) {
    if (board[idx] !== 0) continue;
    const r = Math.floor(idx / size);
    const c = idx % size;
    const b = getBoxIndex(r, c, size);
    cands[idx] = allMask & ~(rowMask[r] | colMask[c] | boxMask[b]);
  }
  return cands;
}

function canSolveLogically(board: readonly number[], size: SudokuSize, allowTier2: boolean): boolean {
  const total = size * size;
  const work = [...board];
  const units = getAllUnits(size);
  let cands = computeInitialCandidateMasks(work, size);

  const placeValue = (idx: number, v: number): void => {
    work[idx] = v;
    cands[idx] = 0;
    const r = Math.floor(idx / size);
    const c = idx % size;
    const b = getBoxIndex(r, c, size);
    const inv = ~(1 << (v - 1));
    for (let i = 0; i < total; i++) {
      if (work[i] !== 0) continue;
      const ir = Math.floor(i / size);
      const ic = i % size;
      if (ir === r || ic === c || getBoxIndex(ir, ic, size) === b) {
        cands[i] &= inv;
      }
    }
  };

  let progress = true;
  while (progress) {
    progress = false;

    // 1. Naked singles
    for (let idx = 0; idx < total; idx++) {
      if (work[idx] === 0 && popcount(cands[idx]) === 1) {
        placeValue(idx, lowestBitValue(cands[idx]));
        progress = true;
      }
    }
    if (progress) continue;

    // 2. Hidden singles
    for (const unit of units) {
      for (let v = 1; v <= size; v++) {
        const bit = 1 << (v - 1);
        let matchIdx = -1;
        let matchCount = 0;
        let alreadyPlaced = false;
        for (const idx of unit.cells) {
          if (work[idx] === v) {
            alreadyPlaced = true;
            break;
          }
          if (work[idx] === 0 && (cands[idx] & bit) !== 0) {
            matchIdx = idx;
            matchCount++;
          }
        }
        if (!alreadyPlaced && matchCount === 1 && matchIdx !== -1) {
          placeValue(matchIdx, v);
          progress = true;
          break;
        }
      }
      if (progress) break;
    }
    if (progress || !allowTier2) continue;

    // 3. Naked pairs
    for (const unit of units) {
      const pairCells = unit.cells.filter((i) => work[i] === 0 && popcount(cands[i]) === 2);
      for (let a = 0; a < pairCells.length; a++) {
        for (let b = a + 1; b < pairCells.length; b++) {
          const i1 = pairCells[a];
          const i2 = pairCells[b];
          if (cands[i1] === cands[i2]) {
            const pairMask = cands[i1];
            for (const other of unit.cells) {
              if (other !== i1 && other !== i2 && work[other] === 0 && (cands[other] & pairMask) !== 0) {
                cands[other] &= ~pairMask;
                progress = true;
              }
            }
          }
        }
      }
    }
  }

  return work.every((v) => v !== 0);
}

export function generateSudokuPuzzle(
  size: SudokuSize,
  difficulty: SudokuDifficulty,
  seed: number
): SudokuPuzzle {
  const rng = mulberry32(seed);
  const { boxRows, boxCols } = getBoxDims(size);
  const solution = generateFullBoard(size, rng);
  const givens = [...solution];
  const total = size * size;

  const targetCluesMap: Record<SudokuSize, Record<SudokuDifficulty, number>> = {
    4: { easy: 7, medium: 5, hard: 4 },
    6: { easy: 16, medium: 12, hard: 10 },
    9: { easy: 38, medium: 31, hard: 25 },
  };
  const minClues = targetCluesMap[size][difficulty];

  const order = shuffle(
    Array.from({ length: total }, (_, i) => i),
    rng
  );
  let remainingClues = total;

  for (const idx of order) {
    if (remainingClues <= minClues) break;
    const backup = givens[idx];
    givens[idx] = 0;

    if (countSolutions(givens, size, 2) !== 1) {
      givens[idx] = backup;
      continue;
    }

    if (difficulty === 'easy' && !canSolveLogically(givens, size, false)) {
      givens[idx] = backup;
      continue;
    }

    if (difficulty === 'medium' && !canSolveLogically(givens, size, true)) {
      givens[idx] = backup;
      continue;
    }

    remainingClues--;
  }

  return {
    size,
    boxRows,
    boxCols,
    difficulty,
    seed,
    givens,
    solution,
  };
}

export function findConflicts(board: readonly number[], size: SudokuSize): Set<number> {
  const conflicts = new Set<number>();
  const units = getAllUnits(size);
  for (const unit of units) {
    const byVal = new Map<number, number[]>();
    for (const idx of unit.cells) {
      const v = board[idx];
      if (v === 0) continue;
      const list = byVal.get(v) ?? [];
      list.push(idx);
      byVal.set(v, list);
    }
    for (const idxs of byVal.values()) {
      if (idxs.length > 1) {
        for (const i of idxs) conflicts.add(i);
      }
    }
  }
  return conflicts;
}

export function isBoardSolved(board: readonly number[], solution: readonly number[]): boolean {
  if (board.length !== solution.length) return false;
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== solution[i]) return false;
  }
  return true;
}

function formatDigitList(digits: number[]): string {
  if (digits.length === 0) return 'ninguno';
  if (digits.length === 1) return String(digits[0]);
  return `${digits.slice(0, -1).join(', ')} y ${digits[digits.length - 1]}`;
}

export function getReasonedHint(
  board: readonly number[],
  size: SudokuSize,
  solution?: readonly number[],
  notes?: ReadonlyArray<ReadonlySet<number>>
): SudokuHint | null {
  const total = size * size;
  if (board.every((v) => v !== 0)) return null;

  const { boxRows, boxCols } = getBoxDims(size);
  const units = getAllUnits(size);
  const cands = computeInitialCandidateMasks(board, size);

  // Also allow user-filtered notes if they form a subset of valid legal candidates and are non-empty
  const effectiveCands = new Int32Array(cands);
  if (notes && notes.length === total) {
    for (let i = 0; i < total; i++) {
      if (board[i] === 0 && notes[i].size > 0) {
        let m = 0;
        for (const v of notes[i]) {
          if (v >= 1 && v <= size) m |= 1 << (v - 1);
        }
        const intersection = cands[i] & m;
        if (intersection !== 0) {
          effectiveCands[i] = intersection;
        }
      }
    }
  }

  // 1. Naked Single
  for (let idx = 0; idx < total; idx++) {
    if (board[idx] !== 0) continue;
    const mask = effectiveCands[idx];
    if (popcount(mask) === 1) {
      const value = lowestBitValue(mask);
      const r = Math.floor(idx / size);
      const c = idx % size;
      const b = getBoxIndex(r, c, size);

      const rowVals: number[] = [];
      const colVals: number[] = [];
      const boxVals: number[] = [];
      for (let i = 0; i < size; i++) {
        const rv = board[r * size + i];
        if (rv !== 0) rowVals.push(rv);
        const cv = board[i * size + c];
        if (cv !== 0) colVals.push(cv);
      }
      const boxUnit = units.find((u) => u.kind === 'box' && u.index === b);
      if (boxUnit) {
        for (const bi of boxUnit.cells) {
          if (board[bi] !== 0) boxVals.push(board[bi]);
        }
      }
      rowVals.sort((x, y) => x - y);
      colVals.sort((x, y) => x - y);
      boxVals.sort((x, y) => x - y);

      return {
        kind: 'place',
        technique: 'naked_single',
        row: r,
        col: c,
        value,
        highlightCells: [{ row: r, col: c }],
        title: `Single Desnudo · Fila ${r + 1}, Columna ${c + 1}`,
        explanation: `En la fila ${r + 1} ya están ${formatDigitList(rowVals)}; en la columna ${c + 1} ya están ${formatDigitList(colVals)}; en la caja ${b + 1} ya están ${formatDigitList(boxVals)}. Solo cabe el ${value}.`,
      };
    }
  }

  // 2. Hidden Single (row, col, box)
  for (const unit of units) {
    for (let v = 1; v <= size; v++) {
      const bit = 1 << (v - 1);
      let foundIdx = -1;
      let count = 0;
      let present = false;
      for (const idx of unit.cells) {
        if (board[idx] === v) {
          present = true;
          break;
        }
        if (board[idx] === 0 && (effectiveCands[idx] & bit) !== 0) {
          foundIdx = idx;
          count++;
        }
      }
      if (!present && count === 1 && foundIdx !== -1) {
        const r = Math.floor(foundIdx / size);
        const c = foundIdx % size;
        const unitLabel =
          unit.kind === 'row'
            ? `la fila ${unit.index + 1}`
            : unit.kind === 'col'
              ? `la columna ${unit.index + 1}`
              : `la caja ${unit.index + 1}`;
        return {
          kind: 'place',
          technique: 'hidden_single',
          row: r,
          col: c,
          value: v,
          highlightCells: unit.cells.map((ci) => ({
            row: Math.floor(ci / size),
            col: ci % size,
          })),
          title: `Single Oculto · Fila ${r + 1}, Columna ${c + 1}`,
          explanation: `En ${unitLabel}, el ${v} solo puede colocarse en Fila ${r + 1}, Columna ${c + 1}, porque las demás casillas vacías de esa unidad ya tienen al ${v} bloqueado por su fila, columna o caja.`,
        };
      }
    }
  }

  // 3. Naked Pair
  for (const unit of units) {
    const pairCells = unit.cells.filter((i) => board[i] === 0 && popcount(effectiveCands[i]) === 2);
    for (let a = 0; a < pairCells.length; a++) {
      for (let b = a + 1; b < pairCells.length; b++) {
        const i1 = pairCells[a];
        const i2 = pairCells[b];
        if (effectiveCands[i1] !== effectiveCands[i2]) continue;
        const pairMask = effectiveCands[i1];
        const pairDigits = maskToDigits(pairMask, size);
        const eliminations: SudokuElimination[] = [];

        for (const other of unit.cells) {
          if (other === i1 || other === i2 || board[other] !== 0) continue;
          const overlap = effectiveCands[other] & pairMask;
          if (overlap !== 0) {
            eliminations.push({
              row: Math.floor(other / size),
              col: other % size,
              values: maskToDigits(overlap, size),
            });
          }
        }

        if (eliminations.length > 0) {
          const r1 = Math.floor(i1 / size) + 1;
          const c1 = (i1 % size) + 1;
          const r2 = Math.floor(i2 / size) + 1;
          const c2 = (i2 % size) + 1;
          const unitLabel =
            unit.kind === 'row'
              ? `la fila ${unit.index + 1}`
              : unit.kind === 'col'
                ? `la columna ${unit.index + 1}`
                : `la caja ${unit.index + 1}`;
          const targetDesc = eliminations
            .map((e) => `Fila ${e.row + 1}, Col ${e.col + 1}`)
            .join('; ');
          return {
            kind: 'eliminate',
            technique: 'naked_pair',
            row: r1 - 1,
            col: c1 - 1,
            eliminations,
            highlightCells: [
              { row: r1 - 1, col: c1 - 1 },
              { row: r2 - 1, col: c2 - 1 },
              ...eliminations.map((e) => ({ row: e.row, col: e.col })),
            ],
            title: `Par Desnudo {${pairDigits.join(', ')}}`,
            explanation: `En ${unitLabel}, las celdas (Fila ${r1}, Col ${c1}) y (Fila ${r2}, Col ${c2}) solo admiten {${pairDigits.join(', ')}}. Ninguna otra celda de ${unitLabel} puede llevar esos números; elimínalos de: ${targetDesc}.`,
          };
        }
      }
    }
  }

  // 4. Box-Line Intersection (Pointing & Claiming)
  const boxUnits = units.filter((u) => u.kind === 'box');
  for (const boxU of boxUnits) {
    for (let v = 1; v <= size; v++) {
      const bit = 1 << (v - 1);
      const positions = boxU.cells.filter((i) => board[i] === 0 && (effectiveCands[i] & bit) !== 0);
      if (positions.length < 2) continue;
      const rows = new Set(positions.map((i) => Math.floor(i / size)));
      const cols = new Set(positions.map((i) => i % size));

      if (rows.size === 1) {
        const targetRow = [...rows][0];
        const eliminations: SudokuElimination[] = [];
        for (let c = 0; c < size; c++) {
          const idx = targetRow * size + c;
          if (getBoxIndex(targetRow, c, size) !== boxU.index && board[idx] === 0 && (effectiveCands[idx] & bit) !== 0) {
            eliminations.push({ row: targetRow, col: c, values: [v] });
          }
        }
        if (eliminations.length > 0) {
          return {
            kind: 'eliminate',
            technique: 'intersection',
            row: targetRow,
            col: positions[0] % size,
            eliminations,
            highlightCells: [
              ...positions.map((i) => ({ row: Math.floor(i / size), col: i % size })),
              ...eliminations.map((e) => ({ row: e.row, col: e.col })),
            ],
            title: `Intersección Caja-Fila · Número ${v}`,
            explanation: `En la caja ${boxU.index + 1} (${boxRows}x${boxCols}), el ${v} solo cabe en la fila ${targetRow + 1}. Por tanto, puedes descartar el ${v} del resto de la fila ${targetRow + 1}.`,
          };
        }
      }

      if (cols.size === 1) {
        const targetCol = [...cols][0];
        const eliminations: SudokuElimination[] = [];
        for (let r = 0; r < size; r++) {
          const idx = r * size + targetCol;
          if (getBoxIndex(r, targetCol, size) !== boxU.index && board[idx] === 0 && (effectiveCands[idx] & bit) !== 0) {
            eliminations.push({ row: r, col: targetCol, values: [v] });
          }
        }
        if (eliminations.length > 0) {
          return {
            kind: 'eliminate',
            technique: 'intersection',
            row: Math.floor(positions[0] / size),
            col: targetCol,
            eliminations,
            highlightCells: [
              ...positions.map((i) => ({ row: Math.floor(i / size), col: i % size })),
              ...eliminations.map((e) => ({ row: e.row, col: e.col })),
            ],
            title: `Intersección Caja-Columna · Número ${v}`,
            explanation: `En la caja ${boxU.index + 1}, el ${v} solo cabe en la columna ${targetCol + 1}. Por tanto, puedes descartar el ${v} del resto de la columna ${targetCol + 1}.`,
          };
        }
      }
    }
  }

  // 5. Fallback (honest message + value)
  let fallbackIdx = -1;
  let minCands = size + 1;
  for (let idx = 0; idx < total; idx++) {
    if (board[idx] !== 0) continue;
    const cnt = popcount(effectiveCands[idx]);
    if (cnt > 0 && cnt < minCands) {
      minCands = cnt;
      fallbackIdx = idx;
    }
  }
  if (fallbackIdx === -1) {
    fallbackIdx = board.findIndex((v) => v === 0);
  }
  if (fallbackIdx === -1) return null;

  const solved = solution && solution.length === total ? solution : solveAndCount(board, size, 1).solution;
  if (!solved) return null;

  const r = Math.floor(fallbackIdx / size);
  const c = fallbackIdx % size;
  const val = solved[fallbackIdx];

  return {
    kind: 'place',
    technique: 'advanced',
    row: r,
    col: c,
    value: val,
    highlightCells: [{ row: r, col: c }],
    title: `Técnica Avanzada · Fila ${r + 1}, Columna ${c + 1}`,
    explanation: `Esta celda (Fila ${r + 1}, Columna ${c + 1}) necesita una técnica avanzada; te mostramos el valor ${val}.`,
  };
}
