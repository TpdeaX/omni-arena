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

import {
  ANALOGY_BANK,
  BIAS_BANK,
  DOMAIN_TRIPLES,
  SYLLOGISM_FORMS,
  generateLogicRound,
  renderSyllogismVennSvg,
  type LogicCategory,
  type LogicLevel,
} from '../src/games/intel/logicSeqEngine.ts';

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

test('logicSeqEngine: bancos curados ampliados (72+ analogías, 48+ sesgos, 20+ ternas, 8+ plantillas silogismo, 150+ ítems) sin duplicados ni emojis', () => {
  const emojiRe = /\p{Extended_Pictographic}/u;

  assert.ok(ANALOGY_BANK.length >= 72, `ANALOGY_BANK debe tener >= 72, tiene ${ANALOGY_BANK.length}`);
  assert.ok(BIAS_BANK.length >= 48, `BIAS_BANK debe tener >= 48, tiene ${BIAS_BANK.length}`);
  assert.ok(DOMAIN_TRIPLES.length >= 20, `DOMAIN_TRIPLES debe tener >= 20, tiene ${DOMAIN_TRIPLES.length}`);
  assert.ok(SYLLOGISM_FORMS.length >= 8, `SYLLOGISM_FORMS debe tener >= 8, tiene ${SYLLOGISM_FORMS.length}`);

  const totalCurated = ANALOGY_BANK.length + BIAS_BANK.length + DOMAIN_TRIPLES.length;
  assert.ok(totalCurated >= 150, `Total curado debe ser >= 150, tiene ${totalCurated}`);

  // Verificar unicidad y opciones distintas en ANALOGY_BANK
  const analogyKeys = new Set<string>();
  const analogyByLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const item of ANALOGY_BANK) {
    const key = `${item.a}|${item.b}|${item.c}`;
    assert.equal(analogyKeys.has(key), false, `Analogía duplicada: ${key}`);
    analogyKeys.add(key);
    analogyByLevel[item.level]++;

    const opts = new Set([item.correct, ...item.distractors]);
    assert.equal(opts.size, 4, `Analogía con opciones repetidas: ${key}`);
    assert.ok(item.explanation.trim().length > 15);
    assert.equal(emojiRe.test(`${item.a} ${item.b} ${item.c} ${item.correct} ${item.distractors.join(' ')} ${item.relation} ${item.explanation}`), false);
  }
  for (const lv of [1, 2, 3, 4]) {
    assert.ok(analogyByLevel[lv] >= 18, `Analogías nivel ${lv} debe tener >= 18, tiene ${analogyByLevel[lv]}`);
  }

  // Verificar unicidad y opciones distintas en BIAS_BANK
  const biasPrompts = new Set<string>();
  const biasByLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const item of BIAS_BANK) {
    assert.equal(biasPrompts.has(item.prompt), false, `Sesgo duplicado: ${item.prompt.slice(0, 40)}`);
    biasPrompts.add(item.prompt);
    biasByLevel[item.level]++;

    const opts = new Set([item.correct, ...item.distractors]);
    assert.equal(opts.size, 4, `Sesgo con opciones repetidas: ${item.prompt.slice(0, 40)}`);
    assert.ok(item.hint.trim().length > 10);
    assert.ok(item.explanation.trim().length > 20);
    assert.equal(emojiRe.test(`${item.prompt} ${item.correct} ${item.distractors.join(' ')} ${item.hint} ${item.explanation}`), false);
  }
  for (const lv of [1, 2, 3, 4]) {
    assert.ok(biasByLevel[lv] >= 12, `Sesgos nivel ${lv} debe tener >= 12, tiene ${biasByLevel[lv]}`);
  }

  // Verificar unicidad de DOMAIN_TRIPLES y SVGs de todas las formas de silogismo
  const tripleKeys = new Set<string>();
  for (const t of DOMAIN_TRIPLES) {
    const k = `${t.x}|${t.y}|${t.z}`;
    assert.equal(tripleKeys.has(k), false, `Terna duplicada: ${k}`);
    tripleKeys.add(k);
    assert.equal(new Set([t.x, t.y, t.z]).size, 3);
    assert.equal(emojiRe.test(k), false);
  }
  for (const form of SYLLOGISM_FORMS) {
    const svg = renderSyllogismVennSvg(form, 'Alfas', 'Betas', 'Gammas');
    assert.ok(svg.startsWith('<svg') && svg.includes('</svg>'));
    assert.equal(emojiRe.test(svg), false);
  }

  // Muestreo de rondas generadas en todas las categorías y niveles
  const categories: LogicCategory[] = ['sequence', 'analogy', 'syllogism', 'bias'];
  const levels: LogicLevel[] = [1, 2, 3, 4];
  for (const cat of categories) {
    for (const lv of levels) {
      for (let seed = 1; seed <= 12; seed++) {
        const q = generateLogicRound(cat, lv, seed * 37);
        assert.equal(q.options.length, 4);
        assert.equal(new Set(q.options).size, 4, `Opciones repetidas en ${cat} L${lv} seed ${seed}`);
        assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
        assert.ok(q.hint.trim().length > 10);
        assert.ok(q.explanation.trim().length > 15);
        assert.equal(emojiRe.test(`${q.prompt} ${q.options.join(' ')} ${q.hint} ${q.explanation}`), false);
        if (cat === 'syllogism') {
          assert.ok(q.vennSvg && q.vennSvg.startsWith('<svg'));
        }
      }
    }
  }
});
