import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACADEMY_IDS,
  CIRCUIT_IDS,
  DIFFICULTY_META,
  GAME_CATALOG,
  STANDALONE_IDS,
} from '../src/catalog.ts';
import {
  meetsInfiniteMinimum,
  normalizeProfile,
  ProfileStore,
} from '../src/state/ProfileStore.ts';
import type { GameModeId } from '../src/types.ts';

test('catalog counts: 33 standalone, 15 academies (4 music, 7 iq, 4 strategy), 18 circuit', () => {
  assert.equal(ACADEMY_IDS.length, 15);
  assert.equal(CIRCUIT_IDS.length, 18);
  assert.equal(STANDALONE_IDS.length, 33);

  const musicIds = ACADEMY_IDS.filter((id) => GAME_CATALOG[id].academyGroup === 'music');
  const iqIds = ACADEMY_IDS.filter((id) => GAME_CATALOG[id].academyGroup === 'iq');
  const strategyIds = ACADEMY_IDS.filter((id) => GAME_CATALOG[id].academyGroup === 'strategy');

  assert.equal(musicIds.length, 4);
  assert.equal(iqIds.length, 7);
  assert.equal(strategyIds.length, 4);

  // Supports infinite checks
  for (const id of CIRCUIT_IDS) {
    assert.equal(GAME_CATALOG[id].supportsInfinite, true, `${id} should support infinite`);
  }
  for (const id of ['piano2d', 'drums2d', 'strings2d', 'band2d', 'raven2d', 'sudoku2d', 'spatial3d', 'nonogram2d', 'logicseq2d', 'memorypath2d'] as GameModeId[]) {
    assert.equal(GAME_CATALOG[id].supportsInfinite, true, `${id} should support infinite`);
  }
  for (const id of ['chess2d', 'checkers2d', 'poker2d', 'rubik3d', 'hanoi2d'] as GameModeId[]) {
    assert.equal(Boolean(GAME_CATALOG[id].supportsInfinite), false, `${id} should not support infinite`);
  }
});

test('DIFFICULTY_META includes progressive with baseScale 0.85 and scoreMult 1.2', () => {
  assert.ok(DIFFICULTY_META.progressive);
  assert.equal(DIFFICULTY_META.progressive.baseScale, 0.85);
  assert.equal(DIFFICULTY_META.progressive.scoreMult, 1.2);
  assert.equal(DIFFICULTY_META.progressive.label, 'PROGRESIVA');
});

test('meetsInfiniteMinimum enforces >= 20s or >= 3 hits+puzzlesSolved', () => {
  assert.equal(meetsInfiniteMinimum(10, 1, 0), false);
  assert.equal(meetsInfiniteMinimum(19.9, 1, 1), false);
  assert.equal(meetsInfiniteMinimum(20, 0, 0), true);
  assert.equal(meetsInfiniteMinimum(5, 2, 1), true);
  assert.equal(meetsInfiniteMinimum(8, 0, 3), true);
});

test('normalizeProfile hydrates bestInfiniteScores for all catalog keys and preserves progressive difficulty', () => {
  const legacy = {
    xp: 120,
    level: 2,
    bestScores: { aim3d: 900 } as Record<GameModeId, number>,
    settings: {
      volume: 0.5,
      muted: false,
      aimSensitivity: 1.0,
      touchControls: 'auto' as const,
      screenShake: true,
      difficulty: 'progressive' as const,
      theme: 'night' as const,
    },
  };

  const normalized = normalizeProfile(legacy);
  assert.equal(normalized.settings.difficulty, 'progressive');
  assert.equal(normalized.bestScores.aim3d, 900);
  for (const key of Object.keys(GAME_CATALOG) as GameModeId[]) {
    assert.equal(typeof normalized.bestInfiniteScores[key], 'number', `missing bestInfiniteScores.${key}`);
    assert.equal(normalized.bestInfiniteScores[key], 0);
  }
});

test('ProfileStore.recordRun separates bestInfiniteScores and guards early infinite exit', () => {
  const store = new ProfileStore();
  store.resetAll();

  const beforeLogic = store.get().ratings.logic;

  // Early infinite exit (<20s and <3 events) -> does not alter ratings or bestInfiniteScores
  const earlyRes = store.recordRun({
    modeId: 'raven2d',
    difficulty: 'progressive',
    peakIntensity: 0.91,
    infiniteMode: true,
    score: 1500,
    maxCombo: 1,
    hits: 1,
    puzzlesSolved: 1,
    durationSec: 12,
    survived: true,
    axisPerformances: { logic: 850 },
  });

  assert.equal(earlyRes.qualifiedForRank, false);
  assert.equal(store.get().ratings.logic, beforeLogic);
  assert.equal(store.get().bestInfiniteScores.raven2d, 0);

  // Valid infinite run (>= 3 events) -> updates bestInfiniteScores and ratings, leaving bestScores untouched
  const validRes = store.recordRun({
    modeId: 'raven2d',
    difficulty: 'progressive',
    peakIntensity: 1.25,
    infiniteMode: true,
    score: 4200,
    maxCombo: 6,
    hits: 4,
    puzzlesSolved: 4,
    durationSec: 15,
    survived: true,
    axisPerformances: { logic: 820 },
  });

  assert.equal(validRes.qualifiedForRank, true);
  assert.equal(validRes.isNewBest, true);
  assert.equal(store.get().bestInfiniteScores.raven2d, 4200);
  assert.equal(store.get().bestScores.raven2d, 0);
  assert.ok(store.get().ratings.logic > beforeLogic);
});
