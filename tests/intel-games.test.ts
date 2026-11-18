import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateRavenPuzzle,
  doesOptionMatchRules,
  cellVisualKey,
  renderRavenCellSvg,
  type RavenLevel,
} from '../src/games/intel/ravenEngine.ts';

import {
  generateSudokuPuzzle,
  countSolutions,
  solveAndCount,
  getReasonedHint,
  findConflicts,
  isBoardSolved,
  mulberry32,
  type SudokuSize,
  type SudokuDifficulty,
} from '../src/games/intel/sudokuEngine.ts';

import {
  createHanoiState,
  optimalMovesCount,
  validateMove,
  applyMove,
  isSolved,
  buildRecursiveTrace,
  getOptimalNextMove,
  remainingOptimalSteps,
} from '../src/games/intel/hanoiEngine.ts';

test('ravenEngine: niveles 1-4 tienen exactamente 1 opción válida, distractores distintos y explicación en español', () => {
  const levels: RavenLevel[] = [1, 2, 3, 4];
  const seeds = [101, 202, 303, 404, 505];
  const emojiRe = /\p{Extended_Pictographic}/u;

  for (const level of levels) {
    for (const seed of seeds) {
      const p1 = generateRavenPuzzle(level, seed);
      const p2 = generateRavenPuzzle(level, seed);
      assert.deepEqual(p1, p2, `determinismo falló en nivel ${level}, seed ${seed}`);

      const expectedOpts = level === 1 ? 6 : 8;
      assert.equal(p1.options.length, expectedOpts, `nivel ${level} debe tener ${expectedOpts} opciones`);
      assert.equal(p1.matrix[2][2], null, 'la celda [2][2] debe estar vacía');

      const matches = p1.options.map((opt) => doesOptionMatchRules(p1, opt));
      const matchCount = matches.filter(Boolean).length;
      assert.equal(matchCount, 1, `nivel ${level} seed ${seed} debe tener exactamente 1 opción válida`);
      assert.equal(matches[p1.correctIndex], true, 'correctIndex debe apuntar a la opción válida');

      const keys = new Set(p1.options.map(cellVisualKey));
      assert.equal(keys.size, p1.options.length, `todas las opciones en nivel ${level} seed ${seed} deben ser visualmente distintas`);

      assert.ok(p1.explanation.trim().length > 20, 'debe incluir explicación en español');
      assert.ok(p1.hint.trim().length > 15, 'debe incluir pista en español');
      assert.equal(emojiRe.test(p1.explanation), false);
      assert.equal(emojiRe.test(p1.hint), false);

      const svg = renderRavenCellSvg(p1.solution, `test_${level}_${seed}`);
      assert.ok(svg.startsWith('<svg') && svg.includes('</svg>'));
      assert.equal(emojiRe.test(svg), false);
    }
  }
});

test('sudokuEngine: tableros 4x4, 6x6 y 9x9 tienen solución única verificada y pistas razonadas válidas', () => {
  const cases: { size: SudokuSize; diff: SudokuDifficulty; seed: number }[] = [
    { size: 4, diff: 'easy', seed: 11 },
    { size: 4, diff: 'hard', seed: 22 },
    { size: 6, diff: 'easy', seed: 33 },
    { size: 6, diff: 'medium', seed: 44 },
    { size: 9, diff: 'easy', seed: 55 },
    { size: 9, diff: 'medium', seed: 66 },
    { size: 9, diff: 'hard', seed: 77 },
  ];

  for (const { size, diff, seed } of cases) {
    const puzzle = generateSudokuPuzzle(size, diff, seed);
    assert.equal(puzzle.givens.length, size * size);
    assert.equal(puzzle.solution.length, size * size);

    const sols = countSolutions(puzzle.givens, size, 2);
    assert.equal(sols, 1, `Sudoku ${size}x${size} (${diff}) debe tener solución única`);

    const solvedCheck = solveAndCount(puzzle.givens, size, 2);
    assert.deepEqual(solvedCheck.solution, puzzle.solution);

    const hint = getReasonedHint(puzzle.givens, size, puzzle.solution);
    assert.ok(hint !== null, `Debe devolver pista razonada para ${size}x${size} (${diff})`);
    assert.ok(hint.explanation.length > 15);
    assert.ok(hint.explanation.includes('Fila') || hint.explanation.includes('fila'));
    if (hint.kind === 'place') {
      assert.equal(
        hint.value,
        puzzle.solution[hint.row * size + hint.col],
        'La pista de colocación debe coincidir con la solución única'
      );
    }
  }
});

test('sudokuEngine: un tablero fácil (4x4 y 9x9) se resuelve completo paso a paso con getReasonedHint sin fallback avanzado', () => {
  for (const size of [4, 6, 9] as SudokuSize[]) {
    const puzzle = generateSudokuPuzzle(size, 'easy', 900 + size);
    const board = [...puzzle.givens];
    let guard = 0;
    while (!isBoardSolved(board, puzzle.solution) && guard < size * size + 5) {
      guard++;
      const hint = getReasonedHint(board, size, puzzle.solution);
      assert.ok(hint !== null);
      assert.notEqual(hint.technique, 'advanced', `Fácil ${size}x${size} no debería requerir fallback avanzado`);
      assert.equal(hint.kind, 'place');
      board[hint.row * size + hint.col] = hint.value!;
    }
    assert.equal(isBoardSolved(board, puzzle.solution), true);
  }
});

test('sudokuEngine: detecta conflictos en fila, columna y caja', () => {
  const board = [
    1, 1, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
  ];
  const conflicts = findConflicts(board, 4);
  assert.equal(conflicts.has(0), true);
  assert.equal(conflicts.has(1), true);
  assert.equal(conflicts.size, 2);

  // RNG check
  const rng = mulberry32(123);
  assert.ok(rng() >= 0 && rng() < 1);
});

test('sudokuEngine: detecta Par Desnudo cuando no hay singles disponibles', () => {
  // Tablero 6x6 sin ningún single desnudo ni oculto, con Par Desnudo {1, 2} en (0,0) y (0,1)
  const board = [
    0, 0, 0, 0, 5, 6,
    0, 0, 0, 0, 0, 0,
    3, 4, 0, 0, 0, 0,
    4, 3, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0,
  ];
  const hint = getReasonedHint(board, 6);
  assert.ok(hint !== null);
  assert.equal(hint.technique, 'naked_pair');
  assert.equal(hint.kind, 'eliminate');
  assert.ok(hint.eliminations && hint.eliminations.length >= 2);
  assert.ok(hint.explanation.includes('Fila 1'));
});

test('hanoiEngine: n=3,4,5,6 produce exactamente 2^n - 1 movimientos legales y termina en torre C', () => {
  for (const n of [3, 4, 5, 6]) {
    const trace = buildRecursiveTrace(n);
    const expected = optimalMovesCount(n);
    assert.equal(expected, (1 << n) - 1);
    assert.equal(trace.length, expected, `Hanói n=${n} debe tener ${expected} pasos`);

    let state = createHanoiState(n);
    for (let i = 0; i < trace.length; i++) {
      const step = trace[i];
      const check = validateMove(state, step.move.from, step.move.to);
      assert.equal(check.valid, true, `Paso ${i} inválido: ${check.reason}`);
      state = applyMove(state, step.move.from, step.move.to);
      assert.deepEqual(state.towers, step.stateAfter.towers);
      assert.ok(step.callStack.length >= 1);
      assert.ok(step.callStack[0].label.startsWith(`hanoi(${n},`));
      assert.ok(step.explanation.length > 10);
    }

    assert.equal(isSolved(state), true);
    assert.equal(state.moves, expected);
    assert.equal(state.towers[2].length, n);
  }
});

test('hanoiEngine: validación de movimientos ilegales y siguiente paso óptimo desde cualquier estado', () => {
  const init = createHanoiState(4);
  const sameTower = validateMove(init, 0, 0);
  assert.equal(sameTower.valid, false);

  const emptySrc = validateMove(init, 1, 2);
  assert.equal(emptySrc.valid, false);

  // Mover disco 1 de A -> C, luego intentar poner disco 2 encima de disco 1 en C
  const after1 = applyMove(init, 0, 2);
  const illegalLargeOnSmall = validateMove(after1, 0, 2);
  assert.equal(illegalLargeOnSmall.valid, false);
  assert.ok(illegalLargeOnSmall.reason?.includes('más pequeño'));

  // Desde un estado intermedio cualquiera (incluso tras jugada subóptima), getOptimalNextMove lleva a la solución en remainingOptimal pasos
  let cur = applyMove(init, 0, 1); // 1 -> B (subóptimo para n=4 cuyo destino final es C, aunque válido)
  const expectedRem = remainingOptimalSteps(cur);
  let stepsTaken = 0;
  while (!isSolved(cur) && stepsTaken < 40) {
    const hint = getOptimalNextMove(cur);
    assert.ok(hint !== null);
    assert.ok(hint.explanation.length > 12);
    cur = applyMove(cur, hint.from, hint.to);
    stepsTaken++;
  }
  assert.equal(isSolved(cur), true);
  assert.equal(stepsTaken, expectedRem);
});
