import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMove,
  applyMoves,
  BASE_MOVES,
  BEGINNER_PHASE_LESSONS,
  createLessonExampleCube,
  createSolvedCube,
  detectBeginnerPhase,
  generateScramble,
  invertSequence,
  isSolved,
  parseMoves,
  type Move,
} from '../src/games/rubik/rubikEngine.ts';
import {
  describeChordEs,
  getStaffPosition,
  GUIDED_MELODIES,
  INTERVAL_DEFINITIONS,
  PIANO_KEYS,
  WHITE_KEY_COUNT,
} from '../src/games/piano/pianoBank.ts';

test('Rubik: cubo resuelto inicial tiene 54 pegatinas válidas', () => {
  const solved = createSolvedCube();
  assert.equal(solved.length, 54);
  assert.equal(isSolved(solved), true);
  const phase = detectBeginnerPhase(solved);
  assert.equal(phase.solved, true);
  assert.equal(phase.completedCount, 5);
  assert.deepEqual(phase.completedPhases, [true, true, true, true, true]);
});

test('Rubik: cada giro M seguido de M prima devuelve la identidad y M^4 = identidad', () => {
  const solved = createSolvedCube();
  for (const face of BASE_MOVES) {
    const cw = face as Move;
    const ccw = `${face}'` as Move;
    const dbl = `${face}2` as Move;

    const afterPair = applyMove(applyMove(solved, cw), ccw);
    assert.deepEqual(afterPair, solved, `${face} + ${face}' debe devolver identidad`);

    let cur = solved;
    for (let i = 0; i < 4; i++) {
      cur = applyMove(cur, cw);
    }
    assert.deepEqual(cur, solved, `${face}^4 debe devolver identidad`);

    const afterDoubleTwice = applyMove(applyMove(solved, dbl), dbl);
    assert.deepEqual(afterDoubleTwice, solved, `${face}2 x 2 debe devolver identidad`);
  }
});

test("Rubik: el conmutador (R U R' U') aplicado 6 veces devuelve el cubo resuelto", () => {
  const solved = createSolvedCube();
  const sexy = parseMoves("R U R' U'");
  let state = solved;
  for (let i = 0; i < 6; i++) {
    state = applyMoves(state, sexy);
    if (i < 5) {
      assert.equal(isSolved(state), false);
    }
  }
  assert.deepEqual(state, solved);
});

test('Rubik: mezclador sembrado es determinista, sin caras repetidas seguidas y reversible', () => {
  const s1 = generateScramble(20, 12345);
  const s2 = generateScramble(20, 12345);
  assert.deepEqual(s1, s2);
  assert.equal(s1.length, 20);

  for (let i = 1; i < s1.length; i++) {
    assert.notEqual(s1[i][0], s1[i - 1][0], 'No debe repetir misma cara seguida');
  }

  const scrambled = applyMoves(createSolvedCube(), s1);
  assert.equal(isSolved(scrambled), false);
  const restored = applyMoves(scrambled, invertSequence(s1));
  assert.deepEqual(restored, createSolvedCube());
});

test('Rubik: detección automática y ejemplos de las 5 fases del método principiantes', () => {
  assert.equal(BEGINNER_PHASE_LESSONS.length, 5);

  for (const lesson of BEGINNER_PHASE_LESSONS) {
    const setup = createLessonExampleCube(lesson);
    const before = detectBeginnerPhase(setup);
    assert.equal(
      before.phase,
      lesson.phase,
      `El ejemplo de ${lesson.title} debe arrancar en fase ${lesson.phase}, obtuvo ${before.phase}`
    );
    assert.equal(before.completedPhases[lesson.phase - 1], false);

    const after = applyMoves(setup, lesson.demoMoves);
    const afterPhase = detectBeginnerPhase(after);
    assert.equal(
      afterPhase.completedPhases[lesson.phase - 1],
      true,
      `Al aplicar demoMoves de ${lesson.title} la fase ${lesson.phase} debe quedar completa`
    );
  }
});

test('Piano: 25 teclas consecutivas MIDI 48 (Do3) a MIDI 72 (Do5) con códigos únicos', () => {
  assert.equal(PIANO_KEYS.length, 25);
  assert.equal(WHITE_KEY_COUNT, 15);
  assert.equal(PIANO_KEYS.filter((k) => k.isBlack).length, 10);

  assert.equal(PIANO_KEYS[0].midi, 48);
  assert.equal(PIANO_KEYS[0].noteName, 'Do3');
  assert.equal(PIANO_KEYS[0].code, 'KeyZ');

  assert.equal(PIANO_KEYS[12].midi, 60);
  assert.equal(PIANO_KEYS[12].noteName, 'Do4');
  assert.equal(PIANO_KEYS[12].code, 'KeyQ');

  assert.equal(PIANO_KEYS[13].midi, 61);
  assert.equal(PIANO_KEYS[13].code, 'Digit2');

  assert.equal(PIANO_KEYS[24].midi, 72);
  assert.equal(PIANO_KEYS[24].noteName, 'Do5');
  assert.equal(PIANO_KEYS[24].code, 'KeyI');

  const codes = new Set<string>();
  const labels = new Set<string>();
  for (let i = 0; i < PIANO_KEYS.length; i++) {
    assert.equal(PIANO_KEYS[i].midi, 48 + i);
    assert.ok(PIANO_KEYS[i].shortName.length > 0);
    assert.equal(codes.has(PIANO_KEYS[i].code), false);
    assert.equal(labels.has(PIANO_KEYS[i].keyLabel), false);
    codes.add(PIANO_KEYS[i].code);
    labels.add(PIANO_KEYS[i].keyLabel);
  }
});

test('Piano: acordes, 6 melodías dentro de Do3-Do5, 12 intervalos y pentagrama Sol/Fa', () => {
  const cMaj = describeChordEs(60, 'major');
  assert.deepEqual(cMaj.midis, [60, 64, 67]);
  assert.deepEqual(cMaj.noteNames, ['Do', 'Mi', 'Sol']);

  assert.equal(GUIDED_MELODIES.length, 6);
  for (const mel of GUIDED_MELODIES) {
    assert.ok(mel.notes.length >= 10);
    for (const n of mel.notes) {
      assert.ok(n.midi >= 48 && n.midi <= 72, `${mel.title} fuera de rango: ${n.midi}`);
    }
  }

  assert.equal(INTERVAL_DEFINITIONS.length, 12);
  for (let i = 0; i < 12; i++) {
    assert.equal(INTERVAL_DEFINITIONS[i].semitones, i + 1);
    assert.ok(INTERVAL_DEFINITIONS[i].explanation.length > 10);
  }

  const c4Treble = getStaffPosition(60, 'treble');
  assert.equal(c4Treble.stepFromBottomLine, -2);
  assert.deepEqual(c4Treble.ledgerSteps, [-2]);

  const g4Treble = getStaffPosition(67, 'treble');
  assert.equal(g4Treble.stepFromBottomLine, 2);

  const f3Bass = getStaffPosition(53, 'bass');
  assert.equal(f3Bass.stepFromBottomLine, 6);
});
