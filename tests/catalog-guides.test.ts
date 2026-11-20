import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACADEMY_IDS,
  CIRCUIT_IDS,
  DIFFICULTY_META,
  GAME_CATALOG,
  STANDALONE_IDS,
} from '../src/catalog.ts';
import type { GameModeId } from '../src/types.ts';

test('GAME_CATALOG: exactamente 35 entradas con howToPlay >= 3, controles, frames, sin emojis', () => {
  const emojiRe = /\p{Extended_Pictographic}/u;
  const entries = Object.entries(GAME_CATALOG) as [GameModeId, (typeof GAME_CATALOG)[GameModeId]][];

  assert.equal(ACADEMY_IDS.length, 15, 'Debe haber 15 academias guiadas');
  assert.equal(CIRCUIT_IDS.length, 18, 'Debe haber 18 pruebas rápidas en circuito');
  assert.equal(STANDALONE_IDS.length, 33, 'Debe haber 33 modos individuales');
  assert.equal(entries.length, 35, `GAME_CATALOG debe tener 35 entradas (33 modos + 2 circuitos), hay ${entries.length}`);

  for (const [id, desc] of entries) {
    assert.equal(desc.id, id);
    assert.ok(desc.title.trim().length > 2, `${id}: falta title`);
    assert.ok(desc.subtitle.trim().length > 2, `${id}: falta subtitle`);
    assert.ok(desc.description.trim().length > 15, `${id}: falta description`);
    assert.ok(desc.guide.objective.trim().length > 15, `${id}: falta guide.objective`);
    assert.ok(
      desc.guide.howToPlay.length >= 3,
      `${id}: guide.howToPlay debe tener >= 3 pasos, tiene ${desc.guide.howToPlay.length}`
    );
    assert.ok(desc.guide.controls.length >= 1, `${id}: debe definir al menos 1 control`);
    assert.ok(desc.guide.example.frames.length >= 1, `${id}: debe incluir al menos 1 frame SVG`);

    for (const frame of desc.guide.example.frames) {
      assert.ok(frame.svg.startsWith('<svg') && frame.svg.includes('</svg>'), `${id}: frame SVG inválido`);
      assert.ok(frame.caption.trim().length > 5, `${id}: caption vacío`);
      assert.equal(emojiRe.test(frame.caption), false, `${id}: emoji en caption`);
      assert.equal(emojiRe.test(frame.svg), false, `${id}: emoji en SVG`);
    }

    const textBlob = [
      desc.title,
      desc.subtitle,
      desc.controlsPC,
      desc.controlsTouch,
      desc.description,
      desc.guide.objective,
      desc.guide.practice,
      desc.guide.challenge,
      ...desc.guide.howToPlay,
      ...(desc.guide.sectionTutorials ?? []).flatMap((s) => [s.name, s.tip]),
      ...desc.guide.controls.flatMap((c) => [...c.keys, c.touch, c.action]),
    ].join(' ');
    assert.equal(emojiRe.test(textBlob), false, `${id}: contiene emoji prohibido`);
  }
});

test('GAME_CATALOG: todas las 15 academias y circuitos clave tienen sectionTutorials y cifras actualizadas', () => {
  for (const academyId of ACADEMY_IDS) {
    const desc = GAME_CATALOG[academyId];
    assert.ok(
      desc.guide.sectionTutorials && desc.guide.sectionTutorials.length >= 2,
      `Academia ${academyId} debe incluir sectionTutorials (>= 2)`
    );
  }
  assert.ok((GAME_CATALOG.gauntlet.guide.sectionTutorials?.length ?? 0) >= 2);
  assert.ok((GAME_CATALOG.ranked.guide.sectionTutorials?.length ?? 0) >= 2);

  // Cifras actualizadas exactas en música, tablero e IQ
  const pianoText = `${GAME_CATALOG.piano2d.subtitle} ${GAME_CATALOG.piano2d.description} ${GAME_CATALOG.piano2d.guide.objective}`;
  assert.match(pianoText, /42 piezas/);
  assert.match(pianoText, /20 progresiones/);

  const drumsText = `${GAME_CATALOG.drums2d.subtitle} ${GAME_CATALOG.drums2d.description} ${GAME_CATALOG.drums2d.guide.objective}`;
  assert.match(drumsText, /28 ritmos/);
  assert.match(drumsText, /12 .*independencia/i);

  const stringsText = `${GAME_CATALOG.strings2d.subtitle} ${GAME_CATALOG.strings2d.description} ${GAME_CATALOG.strings2d.guide.objective}`;
  assert.match(stringsText, /40\+? acordes/);
  assert.match(stringsText, /32 canciones\/riffs/);

  const bandText = `${GAME_CATALOG.band2d.subtitle} ${GAME_CATALOG.band2d.description} ${GAME_CATALOG.band2d.guide.objective}`;
  assert.match(bandText, /18 bases/);

  const chessText = `${GAME_CATALOG.chess2d.subtitle} ${GAME_CATALOG.chess2d.description} ${GAME_CATALOG.chess2d.guide.objective}`;
  assert.match(chessText, /10 lecciones/);

  const checkersText = `${GAME_CATALOG.checkers2d.subtitle} ${GAME_CATALOG.checkers2d.description} ${GAME_CATALOG.checkers2d.guide.objective}`;
  assert.match(checkersText, /8 lecciones/);

  const logicText = `${GAME_CATALOG.logicseq2d.subtitle} ${GAME_CATALOG.logicseq2d.description} ${GAME_CATALOG.logicseq2d.guide.objective}`;
  assert.match(logicText, /150\+ retos/);

  // 5 dificultades definidas sin emojis
  const diffs = Object.keys(DIFFICULTY_META);
  assert.deepEqual(diffs.sort(), ['adaptive', 'chill', 'hyper', 'progressive', 'standard']);
});
