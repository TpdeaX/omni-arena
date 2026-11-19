import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROTATIONS_24,
  areShapesCongruentByRotation,
  generateSpatialPuzzle,
  isShapeChiral,
  mirrorVoxels,
  rotateVoxels,
  type Voxel3D,
} from '../src/games/intel/spatial3dEngine.ts';

import {
  computeLineClues,
  generateNonogramPuzzle,
  getNonogramHint,
  isLineSatisfied,
  solveNonogramLineWise,
  type NonogramCellMark,
  type NonogramSize,
} from '../src/games/intel/nonogramEngine.ts';

import {
  generateLogicRound,
  type LogicCategory,
  type LogicLevel,
} from '../src/games/intel/logicSeqEngine.ts';

import {
  buildMnemonicTip,
  evaluateMemoryRecall,
  generateInterferenceTask,
  generateMemoryRound,
  renderMemorySymbolSvg,
} from '../src/games/intel/memoryPathEngine.ts';

const EMOJI_RE = /\p{Extended_Pictographic}/u;

test('spatial3dEngine: verifica las 24 rotaciones y rechaza figuras aquirales / especulares', () => {
  assert.equal(ROTATIONS_24.length, 24, 'Deben existir exactamente 24 rotaciones propias del cubo');

  // Una L plana en XY es aquiral (su espejo coincide tras rotar 180 grados)
  const planarL: Voxel3D[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ];
  assert.equal(isShapeChiral(planarL), false, 'Una L plana debe detectarse como aquiral');
  assert.equal(
    areShapesCongruentByRotation(planarL, mirrorVoxels(planarL)),
    true,
    'Una figura plana coincide con su espejo tras rotar en 3D'
  );

  // Poliedro 3D quiral clasico (mano derecha vs izquierda)
  const chiral5: Voxel3D[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 1, y: 1, z: 1 },
    { x: 2, y: 1, z: 1 },
  ];
  assert.equal(isShapeChiral(chiral5), true, 'Un tornillo 3D asimetrico debe ser quiral');
  assert.equal(areShapesCongruentByRotation(chiral5, rotateVoxels(chiral5, 7)), true);
  assert.equal(areShapesCongruentByRotation(chiral5, mirrorVoxels(chiral5)), false);
});

test('spatial3dEngine: genera poliedros quirales de 6..13 cubos con exactamente 1 opcion congruente', () => {
  const levels: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
  const seeds = [101, 202, 303, 404, 505];

  for (const level of levels) {
    for (const seed of seeds) {
      const p1 = generateSpatialPuzzle(level, seed);
      const p2 = generateSpatialPuzzle(level, seed);
      assert.deepEqual(p1, p2, `determinismo espacial fallo en nivel ${level}, seed ${seed}`);

      assert.ok(p1.base.length >= 6 && p1.base.length <= 12, `cubos nivel ${level}: ${p1.base.length}`);
      assert.equal(isShapeChiral(p1.base), true, 'ninguna figura simetrica debe pasar el filtro');

      const expectedOpts = level === 1 ? 3 : 4;
      assert.equal(p1.options.length, expectedOpts);

      const congruences = p1.options.map((opt) => areShapesCongruentByRotation(p1.base, opt.voxels));
      assert.equal(congruences.filter(Boolean).length, 1, 'exactamente 1 opcion debe ser rotacion valida');
      assert.equal(congruences[p1.correctIndex], true, 'correctIndex debe apuntar a la congruente');

      for (let i = 0; i < p1.options.length; i++) {
        assert.equal(
          p1.options[i].voxels.length,
          p1.base.length,
          'todos los distractores deben conservar el numero de cubos'
        );
      }

      assert.ok(p1.hint.trim().length > 15);
      assert.ok(p1.explanation.trim().length > 20);
      assert.equal(EMOJI_RE.test(p1.hint), false);
      assert.equal(EMOJI_RE.test(p1.explanation), false);
    }
  }

  // Modo infinito progresivo hasta 13 cubos
  const p13 = generateSpatialPuzzle(4, 777, 13);
  assert.equal(p13.base.length, 13);
  assert.equal(isShapeChiral(p13.base), true);
  assert.equal(areShapesCongruentByRotation(p13.base, p13.options[p13.correctIndex].voxels), true);
});

test('nonogramEngine: tableros 5x5, 8x8 y 10x10 tienen solucion unica deducible por lineas y pistas validas', () => {
  const sizes: NonogramSize[] = [5, 8, 10];
  const seeds = [11, 22, 33, 44];

  for (const size of sizes) {
    for (const seed of seeds) {
      const puzzle = generateNonogramPuzzle(size, seed);
      assert.equal(puzzle.size, size);
      assert.equal(puzzle.solution.length, size);
      assert.equal(puzzle.clues.rows.length, size);
      assert.equal(puzzle.clues.cols.length, size);

      for (let r = 0; r < size; r++) {
        assert.deepEqual(computeLineClues(puzzle.solution[r]), puzzle.clues.rows[r]);
      }

      const solved = solveNonogramLineWise(puzzle.clues);
      assert.equal(solved.solved, true, `Nonograma ${size}x${size} seed ${seed} debe resolverse sin adivinar`);
      assert.equal(solved.contradicted, false);
      assert.deepEqual(solved.solution, puzzle.solution);

      // Pista razonada desde tablero vacio y luego resolucion paso a paso
      const board: NonogramCellMark[][] = Array.from({ length: size }, () =>
        Array<NonogramCellMark>(size).fill(0)
      );
      const firstHint = getNonogramHint(board, puzzle.clues);
      assert.ok(firstHint !== null, `Debe dar pista inicial en ${size}x${size}`);
      assert.ok(firstHint.explanation.length > 15);
      assert.ok(firstHint.explanation.includes('Fila') || firstHint.explanation.includes('Columna'));
      assert.equal(EMOJI_RE.test(firstHint.explanation), false);
      const expectedMark: NonogramCellMark = puzzle.solution[firstHint.row][firstHint.col] === 1 ? 1 : -1;
      assert.equal(firstHint.value, expectedMark);

      // Completar fila 0 y verificar isLineSatisfied
      const row0 = puzzle.solution[0].map((v): NonogramCellMark => (v === 1 ? 1 : -1));
      assert.equal(isLineSatisfied(row0, puzzle.clues.rows[0]), true);

      // Resolver completamente paso a paso con getNonogramHint
      let guard = 0;
      while (guard < size * size + 5) {
        const hint = getNonogramHint(board, puzzle.clues);
        if (!hint) break;
        board[hint.row][hint.col] = hint.value;
        guard++;
      }
      assert.equal(guard, size * size, `Debe resolver las ${size * size} casillas en ${size}x${size}`);
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          assert.equal(board[r][c] === 1 ? 1 : 0, puzzle.solution[r][c]);
        }
      }
    }
  }
});

test('logicSeqEngine: genera sucesiones, analogias, silogismos con SVG y sesgos en espanol', () => {
  const categories: (LogicCategory | 'mixed')[] = ['sequence', 'analogy', 'syllogism', 'bias', 'mixed'];
  const levels: LogicLevel[] = [1, 2, 3, 4];

  for (const cat of categories) {
    for (const lv of levels) {
      const q1 = generateLogicRound(cat, lv, 300 + lv * 17);
      const q2 = generateLogicRound(cat, lv, 300 + lv * 17);
      assert.deepEqual(q1, q2);

      if (cat !== 'mixed') {
        assert.equal(q1.category, cat);
      }
      assert.equal(q1.options.length, 4);
      assert.equal(new Set(q1.options).size, 4, `opciones duplicadas en ${cat} nivel ${lv}`);
      assert.ok(q1.correctIndex >= 0 && q1.correctIndex <= 3);
      assert.ok(q1.prompt.trim().length > 10);
      assert.ok(q1.hint.trim().length > 10);
      assert.ok(q1.explanation.trim().length > 15);
      assert.equal(EMOJI_RE.test(q1.prompt), false);
      assert.equal(EMOJI_RE.test(q1.explanation), false);

      if (q1.category === 'syllogism') {
        assert.ok(q1.vennSvg && q1.vennSvg.startsWith('<svg') && q1.vennSvg.includes('</svg>'));
        assert.equal(EMOJI_RE.test(q1.vennSvg), false);
      }
    }
  }
});

test('memoryPathEngine: genera 3..10 asociaciones sin colisiones, interferencia y evalua recuerdo', () => {
  for (let count = 3; count <= 10; count++) {
    const round = generateMemoryRound(count, Math.min(4, Math.ceil(count / 2)) as 1 | 2 | 3 | 4, 500 + count);
    assert.equal(round.items.length, count);

    const coords = new Set(round.items.map((it) => it.cellIndex));
    assert.equal(coords.size, count, `no debe haber colisiones de coordenadas para count=${count}`);

    const symbols = new Set(round.items.map((it) => it.symbolId));
    assert.equal(symbols.size, count, `no debe haber simbolos repetidos para count=${count}`);

    for (const it of round.items) {
      assert.ok(it.cellIndex >= 0 && it.cellIndex < round.cols * round.rows);
      const svg = renderMemorySymbolSvg(it.symbolId);
      assert.ok(svg.startsWith('<svg') && svg.includes('</svg>'));
      assert.equal(EMOJI_RE.test(svg), false);
      assert.equal(EMOJI_RE.test(it.word), false);
    }

    const perfectSubs = round.items.map((it) => ({ cellIndex: it.cellIndex, symbolId: it.symbolId }));
    const perfectEval = evaluateMemoryRecall(round.items, perfectSubs);
    assert.equal(perfectEval.exactMatches, count);
    assert.equal(perfectEval.accuracy, 100);
    assert.equal(perfectEval.allCorrect, true);

    const partialSubs = perfectSubs.slice(0, 2);
    const partialEval = evaluateMemoryRecall(round.items, partialSubs);
    assert.equal(partialEval.exactMatches, 2);
    assert.equal(partialEval.allCorrect, false);
    assert.ok(partialEval.accuracy > 0 && partialEval.accuracy < 100);

    const tip = buildMnemonicTip(round.items);
    assert.ok(tip.length > 20);
    assert.equal(EMOJI_RE.test(tip), false);
  }

  for (const lv of [2, 3, 4] as const) {
    const task = generateInterferenceTask(lv, 900 + lv);
    assert.ok(task.kind === 'math' || task.kind === 'stroop');
    assert.equal(task.options.length, 4);
    assert.equal(new Set(task.options).size, 4);
    assert.ok(task.correctIndex >= 0 && task.correctIndex <= 3);
    assert.equal(EMOJI_RE.test(task.prompt), false);
  }
});
