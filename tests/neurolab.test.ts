import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSeededRng,
  generateChainMathRound,
  generateColorCrazeTrial,
  generatePathfinderRound,
  generateSymbolSpeedRound,
  generateVerbalRound,
  renderSymbolSvg,
  SPANISH_WORD_BANK,
  stepMackworthTick,
} from '../src/games/neuro/neuroEngines.ts';
import {
  applyDiagnosticBaseline,
  applyRunToNeuroProfile,
  BUILTIN_TRANSFER_CARDS,
  computePercentile,
  computeVitalityCorrelation,
  defaultNeuroProfile,
  DIAGNOSTIC_STAGES,
  generateDailyPlan,
  getMicroLevel,
  markCourseDayCompleted,
  NEURO_COURSES,
  NEURO_MODE_PILLAR,
  NEUROLAB_CORE_IDS,
  parseAtelierVitalityLogs,
} from '../src/state/NeuroStore.ts';
import { normalizeProfile, ProfileStore } from '../src/state/ProfileStore.ts';

const EMOJI_RE = /\p{Extended_Pictographic}/u;

test('neuroEngines: Mackworth, ChainMath, ColorCraze, Pathfinder, SymbolSpeed y VerbalFluency', () => {
  const rng = createSeededRng(20261124);

  // 1. Mackworth Clock: spaces out jumps and wraps modulo totalNodes
  let idx = 0;
  let since = 0;
  let jumps = 0;
  for (let i = 0; i < 40; i++) {
    const res = stepMackworthTick(idx, 20, 0.25, since, rng);
    if (res.isDoubleJump) {
      assert.equal(res.nextIndex, (idx + 2) % 20);
      assert.equal(res.skippedIndex, (idx + 1) % 20);
      assert.ok(since >= 2, 'No debe haber dos dobles saltos consecutivos sin pausa');
      jumps += 1;
    } else {
      assert.equal(res.nextIndex, (idx + 1) % 20);
      assert.equal(res.skippedIndex, null);
    }
    idx = res.nextIndex;
    since = res.stepsSinceLastJump;
  }
  assert.ok(jumps >= 4, 'Debe generar varios dobles saltos en 40 pulsos');

  // 2. ChainMath: arithmetic matches runningTotal and result is in 4 unique options
  for (let lvl = 1; lvl <= 8; lvl++) {
    const r = generateChainMathRound(lvl, rng);
    assert.ok(r.steps.length >= 3 && r.steps.length <= 7);
    let calc = r.start;
    for (const st of r.steps) {
      if (st.op === '+') calc += st.value;
      else if (st.op === '-') calc -= st.value;
      else calc *= st.value;
      assert.equal(calc, st.runningTotal);
    }
    assert.equal(calc, r.result);
    assert.equal(r.options.length, 4);
    assert.equal(new Set(r.options).size, 4);
    assert.ok(r.options.includes(r.result));
  }

  // 3. ColorCraze: Stroop + rule switch + Go/No-Go inhibition
  const tSwitch = generateColorCrazeTrial('word', 'ink', rng);
  assert.equal(tSwitch.isSwitch, true);
  assert.equal(tSwitch.expectedAnswer, tSwitch.wordId);

  let sawNoGo = false;
  for (let i = 0; i < 20; i++) {
    const t = generateColorCrazeTrial('nogo_red', 'nogo_red', rng);
    if (t.inkId === 'rojo') {
      assert.equal(t.isNoGo, true);
      assert.equal(t.expectedAnswer, 'inhibit');
      sawNoGo = true;
    } else {
      assert.equal(t.isNoGo, false);
      assert.equal(t.expectedAnswer, t.inkId);
    }
  }
  assert.equal(sawNoGo, true);

  // 4. Pathfinder: connected path + forward/reverse expected order + non-overlapping distractors
  const pf = generatePathfinderRound(5, 6, true, 2, rng);
  assert.equal(pf.path.length, 6);
  assert.deepEqual(pf.expected, [...pf.path].reverse());
  for (const d of pf.distractors) {
    assert.equal(pf.path.includes(d), false);
  }

  // 5. SymbolSpeed: WAIS match and Shape Fusion + valid SVG
  const symMatch = generateSymbolSpeedRound('match', 5, rng);
  assert.equal(symMatch.targets.length, 2);
  assert.equal(symMatch.candidates.length, 5);
  assert.ok(symMatch.matchIndex >= -1 && symMatch.matchIndex < 5);

  const symFusion = generateSymbolSpeedRound('fusion', 5, rng);
  assert.equal(symFusion.targets.length, 1);
  assert.ok(symFusion.matchIndex >= 0 && symFusion.matchIndex < 5);
  const svg = renderSymbolSvg(symFusion.targets[0], 56, 'full');
  assert.ok(svg.startsWith('<svg') && svg.includes('</svg>'));

  // 6. VerbalFluency: 160+ curated Spanish words, zero emojis, all 3 rotating mechanics valid
  assert.ok(SPANISH_WORD_BANK.length >= 160, `Debe haber >= 160 palabras, hay ${SPANISH_WORD_BANK.length}`);
  for (const kind of ['classify', 'semantic', 'chain'] as const) {
    for (let i = 0; i < 10; i++) {
      const vr = generateVerbalRound(kind, rng);
      assert.ok(vr.options.some((o) => o.id === vr.correctId));
      assert.equal(EMOJI_RE.test(`${vr.prompt} ${vr.stimulus} ${vr.explanation}`), false);
    }
  }
});

test('NeuroStore: 4 pilares, plan diario enfocado al pilar más débil, micro-niveles 1..300 y cursos', () => {
  // All 7 core NeuroLab modes + 12 existing cognitive modes mapped to 4 pillars
  for (const id of NEUROLAB_CORE_IDS) {
    assert.ok(NEURO_MODE_PILLAR[id], `Falta mapear ${id} en NEURO_MODE_PILLAR`);
  }
  assert.equal(DIAGNOSTIC_STAGES.length, 4);

  // Daily plan assigns 2 exercises to the weakest pillar + 2 reinforcement exercises
  const plan = generateDailyPlan(
    { memory: 210, attention: 520, speed: 480, reasoning: 600 },
    '2026-11-24'
  );
  assert.equal(plan.steps.length, 4);
  const memorySteps = plan.steps.filter((s) => s.pillar === 'memory');
  assert.equal(memorySteps.length, 2);

  // Adaptive micro-level increases on high accuracy run and updates history & daily plan
  let neuro = defaultNeuroProfile('2026-11-24');
  const firstStepMode = neuro.dailyPlan.steps[0].modeId;
  const runRes = applyRunToNeuroProfile(
    neuro,
    {
      modeId: firstStepMode,
      difficulty: 'adaptive',
      peakIntensity: 1.2,
      score: 3600,
      maxCombo: 9,
      accuracy: 92,
      avgReactionMs: 380,
      hits: 18,
      misses: 1,
      durationSec: 60,
      survived: true,
      axisPerformances: { logic: 780 },
    },
    '2026-11-24'
  );
  neuro = runRes.next;
  assert.ok(getMicroLevel(neuro, firstStepMode) > 1);
  assert.equal(neuro.dailyPlan.steps[0].completed, true);
  assert.equal(neuro.history.length, 1);
  assert.equal(neuro.history[0].avgReactionMs, 380);

  // Diagnostic baseline marks baselineCompleted and recomputes neuroScore
  neuro = applyDiagnosticBaseline(
    neuro,
    {
      memory: { score: 800, accuracy: 85, avgReactionMs: 520 },
      attention: { score: 950, accuracy: 92, avgReactionMs: 340 },
      speed: { score: 700, accuracy: 78, avgReactionMs: 620 },
      reasoning: { score: 850, accuracy: 88, avgReactionMs: 490 },
    },
    '2026-11-24'
  );
  assert.equal(neuro.baselineCompleted, true);
  assert.ok(neuro.neuroScore > 400);

  // Courses (3 x 14 days, 1 x 28 days)
  assert.equal(NEURO_COURSES.length, 4);
  assert.deepEqual(
    NEURO_COURSES.map((c) => c.days),
    [14, 14, 14, 28]
  );
  neuro = markCourseDayCompleted(neuro, 'memowork', 1, '2026-11-24');
  assert.deepEqual(neuro.courses.memowork.completedDays, [1]);

  // Percentiles & Vitality correlation with Atelier Diario
  assert.equal(computePercentile([250, 300, 350, 400, 900], 50), 350);
  assert.equal(computePercentile([250, 300, 350, 400, 900], 90), 900);

  const logs = parseAtelierVitalityLogs({
    progress: {
      vitality: {
        dayLogs: [
          { day: '2026-11-20', sleepHours: 8, energyLevel: 4, externalWorkout: true },
          { day: '2026-11-21', sleepHours: 5.5, energyLevel: 2, externalWorkout: false },
        ],
      },
    },
  });
  assert.equal(logs.length, 2);

  const corr = computeVitalityCorrelation(
    [
      {
        day: '2026-11-20',
        neuroScore: 620,
        pillars: { memory: 600, attention: 640, speed: 620, reasoning: 620 },
        avgReactionMs: 360,
        p90ReactionMs: 440,
        sessions: 2,
      },
      {
        day: '2026-11-21',
        neuroScore: 540,
        pillars: { memory: 520, attention: 550, speed: 540, reasoning: 550 },
        avgReactionMs: 450,
        p90ReactionMs: 560,
        sessions: 1,
      },
    ],
    logs
  );
  assert.equal(corr.matchedDays, 2);
  assert.equal(corr.sleepDeltaMs, 90);
  assert.ok(corr.insights.some((line) => line.includes('90 ms')));
  assert.ok(BUILTIN_TRANSFER_CARDS.length >= 16);
});

test('ProfileStore integra y persiste neuro automáticamente en normalizeProfile y recordRun', () => {
  const hydrated = normalizeProfile({ xp: 50, level: 1 });
  assert.ok(hydrated.neuro);
  assert.equal(hydrated.neuro?.dailyPlan.steps.length, 4);

  const store = new ProfileStore();
  store.resetAll();
  const beforeScore = store.getNeuro().neuroScore;

  store.recordRun({
    modeId: 'mackworth2d',
    difficulty: 'standard',
    peakIntensity: 1.15,
    score: 2900,
    maxCombo: 7,
    accuracy: 90,
    avgReactionMs: 360,
    hits: 10,
    misses: 1,
    durationSec: 65,
    survived: true,
    axisPerformances: { reflex: 760, logic: 640 },
  });

  const afterNeuro = store.getNeuro();
  assert.ok(afterNeuro.neuroScore > beforeScore);
  assert.ok(getMicroLevel(afterNeuro, 'mackworth2d') > 1);
  store.markNeuroActivePauseDone();
  assert.equal(store.getNeuro().dailyPlan.activePauseDone, true);
  store.completeNeuroCourseDay('foco', 1);
  assert.deepEqual(store.getNeuro().courses.foco.completedDays, [1]);
});
