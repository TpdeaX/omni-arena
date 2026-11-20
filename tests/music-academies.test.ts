import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChordMidis,
  chordCueAtBeat,
  GUIDED_MELODIES,
  melodyTotalBeats,
  PIANO_KEYS,
  PIANO_PROGRESSIONS,
  PIANO_TEMPO_SCALES,
} from '../src/games/piano/pianoBank.ts';
import {
  buildGrooveTimeline,
  DRUM_GROOVES,
  DRUM_INDEPENDENCE,
  DRUM_PIECES,
  grooveStepBeats,
} from '../src/games/music/drumsBank.ts';
import {
  bassShapeFor,
  CHORD_SHAPES,
  chordShapeMidis,
  fretMidi,
  scaleBoxPositions,
  songTotalBeats,
  STRING_INSTRUMENTS,
  STRING_SCALE_BOXES,
  STRING_SONGS,
} from '../src/games/music/stringsBank.ts';
import {
  BAND_INSTRUMENTS,
  BAND_SONGS,
  bandSongTotalBeats,
  BAND_TRACK_IDS,
} from '../src/games/music/bandBank.ts';
import { gradeTiming, summarizeMusicRun } from '../src/games/music/musicScore.ts';

const DRUM_IDS = ['kick', 'snare', 'hihat_closed', 'hihat_open', 'tom_high', 'tom_low', 'crash', 'ride'];

test('Piano: 42 piezas (14/14/14) con nivel, genero, rango Do3-Do5 y acordes validos', () => {
  assert.equal(GUIDED_MELODIES.length, 42);
  const originalIds = [
    'ode', 'twinkle', 'frere', 'arroz', 'happy', 'silent',
    'minuet', 'elise', 'cielito', 'cucaracha', 'scarborough', 'canon',
    'moonlight', 'prelude', 'danube', 'blues', 'etude', 'pop4',
  ];
  const ids = new Set<string>();
  const levelCount: Record<string, number> = { Inicial: 0, Intermedio: 0, Avanzado: 0 };
  for (const mel of GUIDED_MELODIES) {
    assert.equal(ids.has(mel.id), false, `id duplicado ${mel.id}`);
    ids.add(mel.id);
    assert.ok(mel.title.length > 2 && mel.composer.length > 1 && mel.genre.length > 1);
    assert.ok(mel.level in levelCount, `nivel invalido en ${mel.title}`);
    levelCount[mel.level] += 1;
    assert.ok(mel.bpm >= 50 && mel.bpm <= 160);
    assert.ok(mel.notes.length >= 10, `${mel.title} muy corta (${mel.notes.length})`);
    const total = melodyTotalBeats(mel);
    for (const n of mel.notes) {
      assert.ok(n.midi >= 48 && n.midi <= 72, `${mel.title} fuera de rango: ${n.midi}`);
      assert.ok(n.beats > 0);
    }
    assert.ok(mel.chords && mel.chords.length >= 2, `${mel.title} sin acordes`);
    for (const c of mel.chords!) {
      assert.ok(c.beat >= 0 && c.beat < total, `${mel.title} acorde fuera de la pieza`);
      assert.ok(c.root >= 48 && c.root <= 59, `${mel.title} raiz de acorde fuera de rango`);
      for (const m of buildChordMidis(c.root, c.quality)) assert.ok(m >= 48 && m <= 72);
      assert.ok(c.label.length > 0);
    }
    assert.equal(chordCueAtBeat(mel, 0)?.beat, 0);
  }
  for (const oldId of originalIds) {
    assert.ok(ids.has(oldId), `falta id original ${oldId}`);
  }
  assert.deepEqual(levelCount, { Inicial: 14, Intermedio: 14, Avanzado: 14 });
});

test('Piano: 20 progresiones reales, tempos y teclado intacto', () => {
  assert.equal(PIANO_PROGRESSIONS.length, 20);
  const progIds = new Set<string>();
  for (const p of PIANO_PROGRESSIONS) {
    assert.equal(progIds.has(p.id), false, `progresion duplicada ${p.id}`);
    progIds.add(p.id);
    assert.ok(p.chords.length >= 4);
    for (const c of p.chords) {
      assert.ok(c.beats > 0 && c.label.length > 0);
      for (const m of c.midis) assert.ok(m >= 48 && m <= 72, `${p.title}: ${m}`);
    }
  }
  for (const oldId of ['pop', 'blues12', 'jazz251', 'cumbia', 'canon']) {
    assert.ok(progIds.has(oldId), `falta progresion original ${oldId}`);
  }
  assert.ok(PIANO_PROGRESSIONS.some((p) => p.chords.length === 12));
  assert.deepEqual([...PIANO_TEMPO_SCALES], [0.65, 0.85, 1.0, 1.2]);
  assert.equal(PIANO_KEYS.length, 25);
});

test('Bateria: 8 piezas con teclas unicas, 28 ritmos y 12 ejercicios de independencia', () => {
  assert.equal(DRUM_PIECES.length, 8);
  assert.deepEqual(DRUM_PIECES.map((p) => p.id).sort(), [...DRUM_IDS].sort());
  assert.equal(new Set(DRUM_PIECES.map((p) => p.code)).size, 8);
  assert.equal(DRUM_PIECES.find((p) => p.id === 'kick')!.code, 'Space');
  assert.equal(DRUM_PIECES.find((p) => p.id === 'snare')!.code, 'KeyF');

  assert.equal(DRUM_GROOVES.length, 28);
  const grooveIds = new Set<string>();
  const genres = DRUM_GROOVES.map((g) => g.genre).join('|');
  for (const word of ['Rock', 'Pop', 'Funk', 'Bossa', 'Cumbia', 'Reggaet', 'Jazz', 'Blues', 'Metal', 'Disco', 'Salsa', 'Balada']) {
    assert.ok(genres.includes(word), `falta genero ${word}`);
  }
  for (const g of DRUM_GROOVES) {
    assert.equal(grooveIds.has(g.id), false, `groove duplicado ${g.id}`);
    grooveIds.add(g.id);
    assert.ok(g.steps === 16 || g.steps === 12, `${g.title}: pasos invalidos`);
    let hits = 0;
    for (const [piece, lane] of Object.entries(g.lanes)) {
      assert.ok(DRUM_IDS.includes(piece), `${g.title}: pieza ${piece}`);
      assert.equal(lane!.length, g.steps, `${g.title}/${piece}: largo ${lane!.length}`);
      assert.match(lane!, /^[-xX]+$/);
      hits += [...lane!].filter((c) => c !== '-').length;
    }
    assert.ok(hits >= 4);
    assert.ok(g.bpm >= 60 && g.bpm <= 160);
    assert.ok(g.tip.length > 20);
    const tl = buildGrooveTimeline(g, 2);
    assert.equal(tl.length, hits * 2);
    const lastBeat = tl[tl.length - 1].beat;
    assert.ok(lastBeat < g.beatsPerBar * 2);
    assert.ok(Math.abs(grooveStepBeats(g) * g.steps - g.beatsPerBar) < 1e-9);
  }
  assert.equal(DRUM_INDEPENDENCE.length, 12);
  const indepIds = new Set<string>();
  for (const ex of DRUM_INDEPENDENCE) {
    assert.equal(indepIds.has(ex.id), false, `ejercicio duplicado ${ex.id}`);
    indepIds.add(ex.id);
    assert.ok(ex.steps === 16 || ex.steps === 12);
    for (const [piece, lane] of Object.entries(ex.lanes)) {
      assert.ok(DRUM_IDS.includes(piece));
      assert.equal(lane!.length, ex.steps);
    }
    assert.ok(ex.explanation.length > 30);
  }
});

test('Cuerdas: afinaciones, 40+ acordes, 32 canciones (14/11/7) y 10 cajas de mastil', () => {
  assert.deepEqual(STRING_INSTRUMENTS.guitar.strings, [64, 59, 55, 50, 45, 40]);
  assert.deepEqual(STRING_INSTRUMENTS.bass.strings, [43, 38, 33, 28]);
  assert.deepEqual(STRING_INSTRUMENTS.ukulele.strings, [69, 64, 60, 67]);
  assert.equal(fretMidi('guitar', 5, 0), 40);
  assert.equal(fretMidi('guitar', 0, 12), 76);

  assert.ok(CHORD_SHAPES.length >= 40, `se esperan >= 40 acordes, hay ${CHORD_SHAPES.length}`);
  assert.ok(CHORD_SHAPES.filter((c) => c.instrument === 'guitar').length >= 16);
  assert.ok(CHORD_SHAPES.filter((c) => c.instrument === 'ukulele').length >= 8);
  assert.ok(CHORD_SHAPES.filter((c) => c.instrument === 'bass').length >= 3);
  const keys = new Set<string>();
  for (const shape of CHORD_SHAPES) {
    const key = `${shape.instrument}:${shape.id}`;
    assert.equal(keys.has(key), false, `acorde duplicado ${key}`);
    keys.add(key);
    const count = STRING_INSTRUMENTS[shape.instrument].strings.length;
    assert.equal(shape.frets.length, count, `${key}: cuerdas`);
    assert.equal(shape.fingers.length, count, `${key}: dedos`);
    shape.frets.forEach((f, i) => {
      assert.ok(f >= -1 && f <= 12);
      assert.ok(shape.fingers[i] >= 0 && shape.fingers[i] <= 4);
      if (f <= 0) assert.equal(shape.fingers[i], 0, `${key}: dedo en cuerda libre`);
    });
    const midis = chordShapeMidis(shape);
    assert.ok(midis.length >= 3, `${key}: muy pocas notas`);
    for (const m of midis) {
      assert.ok(shape.pcs.includes(m % 12), `${key}: nota ${m} no pertenece al acorde`);
    }
    assert.ok(shape.pcs.includes(shape.rootPc));
  }
  const bassC = bassShapeFor(0);
  assert.equal(bassC.instrument, 'bass');
  assert.deepEqual(chordShapeMidis(bassC).map((m) => m % 12), [0, 7, 0]);

  assert.equal(STRING_SONGS.length, 32);
  assert.equal(STRING_SONGS[1].kind, 'chords', 'STRING_SONGS[1] debe permanecer kind: chords');
  const songIds = new Set<string>();
  const byInst: Record<string, number> = { guitar: 0, bass: 0, ukulele: 0 };
  for (const s of STRING_SONGS) {
    assert.equal(songIds.has(s.id), false, `cancion duplicada ${s.id}`);
    songIds.add(s.id);
    byInst[s.instrument] += 1;
    assert.ok(s.bpm >= 50 && s.bpm <= 160);
    assert.ok(s.events.length >= 8);
    assert.ok(s.description.length > 15);
    const total = songTotalBeats(s);
    const strCount = STRING_INSTRUMENTS[s.instrument].strings.length;
    if (s.kind === 'chords') {
      assert.ok(
        s.chordPalette && s.chordPalette.length >= 2 && s.chordPalette.length <= 4,
        `${s.title}: chordPalette debe tener 2..4 acordes`
      );
    }
    for (const ev of s.events) {
      assert.ok(ev.beat >= 0 && ev.beat < total);
      if (s.kind === 'chords') {
        assert.ok(ev.chordId, `${s.title}: evento sin acorde`);
        assert.ok(
          CHORD_SHAPES.some((c) => c.instrument === s.instrument && c.id === ev.chordId),
          `${s.title}: acorde ${ev.chordId} inexistente`
        );
      } else {
        assert.ok(ev.string !== undefined && ev.string >= 0 && ev.string < strCount, `${s.title}: cuerda`);
        assert.ok(ev.fret !== undefined && ev.fret >= 0 && ev.fret <= 12, `${s.title}: traste`);
      }
    }
  }
  assert.deepEqual(byInst, { guitar: 14, bass: 11, ukulele: 7 });

  assert.equal(STRING_SCALE_BOXES.length, 10);
  const box = scaleBoxPositions('guitar', 9, 'minorPentatonic', 5, 8);
  assert.ok(box.length >= 10);
  for (const p of box) {
    assert.ok(p.fret >= 5 && p.fret <= 8);
    assert.ok([9, 0, 2, 4, 7].includes(fretMidi('guitar', p.string, p.fret) % 12));
  }
  for (const sb of STRING_SCALE_BOXES) {
    const pos = scaleBoxPositions('guitar', sb.rootPc, sb.scale, sb.minFret, sb.maxFret);
    assert.ok(pos.length >= 8, `caja ${sb.title} con pocas notas`);
  }
});

test('Banda: 18 bases multipista con rangos UI estrictos (melody 60..79, chords[0] 48..72, bass 28..50)', () => {
  assert.equal(BAND_SONGS.length, 18);
  assert.deepEqual([...BAND_TRACK_IDS], ['drums', 'bass', 'chords', 'melody']);
  assert.equal(BAND_INSTRUMENTS.length, 5);
  const bandIds = new Set<string>();
  for (const s of BAND_SONGS) {
    assert.equal(bandIds.has(s.id), false, `banda id duplicado ${s.id}`);
    bandIds.add(s.id);
    assert.ok(s.bpm >= 60 && s.bpm <= 160);
    const total = bandSongTotalBeats(s);
    assert.equal(total, s.bars * 4);
    assert.ok(s.tracks.drums.length > 8 && s.tracks.bass.length >= 4);
    assert.ok(s.tracks.chords.length >= s.bars && s.tracks.melody.length >= 8);
    for (const d of s.tracks.drums) {
      assert.ok(DRUM_IDS.includes(d.piece));
      assert.ok(d.beat >= 0 && d.beat < total);
    }
    for (const n of s.tracks.bass) {
      assert.ok(n.midi >= 28 && n.midi <= 50, `${s.title} bajo UI fuera de 28..50: ${n.midi}`);
      assert.ok(n.beat >= 0 && n.beat < total);
      assert.ok(n.beat + n.dur <= total + 1e-9, `${s.title} bajo excede total`);
    }
    for (const c of s.tracks.chords) {
      assert.ok(c.midis[0] >= 48 && c.midis[0] <= 72, `${s.title} acorde[0] UI fuera de 48..72: ${c.midis[0]}`);
      for (const m of c.midis) assert.ok(m >= 36 && m <= 84, `${s.title} acorde ${m}`);
      assert.ok(c.beat >= 0 && c.beat < total);
      assert.ok(c.beat + c.dur <= total + 1e-9, `${s.title} acorde excede total`);
    }
    let melodyBeats = 0;
    for (const n of s.tracks.melody) {
      assert.ok(n.midi >= 60 && n.midi <= 79, `${s.title} melodia UI fuera de 60..79: ${n.midi}`);
      melodyBeats = Math.max(melodyBeats, n.beat + n.dur);
    }
    assert.ok(melodyBeats <= total + 1e-9, `${s.title}: melodia excede ${melodyBeats}/${total}`);
  }
});

test('Puntuacion musical: ventanas de tiempo y resumen de precision/consistencia', () => {
  assert.equal(gradeTiming(30), 'perfect');
  assert.equal(gradeTiming(-90), 'good');
  assert.equal(gradeTiming(150), 'ok');
  assert.equal(gradeTiming(400), 'miss');

  const clean = summarizeMusicRun({
    hits: 20, misses: 0, perfect: 20, good: 0, ok: 0, totalTargets: 20,
    timingDeviationsMs: Array(20).fill(10), maxCombo: 20,
  });
  const sloppy = summarizeMusicRun({
    hits: 10, misses: 10, perfect: 2, good: 4, ok: 4, totalTargets: 20,
    timingDeviationsMs: [-150, 140, -120, 160, -90, 100, -140, 150, 20, -30], maxCombo: 3,
  });
  assert.equal(clean.accuracy, 100);
  assert.ok(clean.rhythmPerf >= 95);
  assert.ok(sloppy.accuracy <= 50);
  assert.ok(sloppy.rhythmPerf < clean.rhythmPerf);
  assert.ok(sloppy.rhythmPerf >= 20);
  assert.ok(clean.score > sloppy.score);
  const empty = summarizeMusicRun({
    hits: 0, misses: 0, perfect: 0, good: 0, ok: 0, totalTargets: 0, timingDeviationsMs: [], maxCombo: 0,
  });
  assert.equal(empty.accuracy, 0);
  assert.equal(empty.rhythmPerf, 20);
});
