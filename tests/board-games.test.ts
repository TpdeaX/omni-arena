import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  algebraicToSq,
  applyMove,
  CHESS_LESSONS,
  chooseChessBotMove,
  createInitialChessState,
  generateLegalMoves,
  getCoachingHint,
  getGameStatus,
  moveToSpanishSAN,
  moveToUci,
  mulberry32,
  parseFEN,
  perft,
  START_FEN,
} from '../src/games/chess/chessEngine.ts';

import {
  applyCheckersMove,
  applyCheckersStep,
  CHECKERS_LESSONS,
  chooseCheckersBotMove,
  createCheckersStateFromPlacements,
  createInitialCheckersState,
  generateLegalCheckersMoves,
  getCheckersHint,
  getForcedCaptureSquares,
} from '../src/games/checkers/checkersEngine.ts';

import {
  applyPokerAction,
  calculateOuts,
  choosePokerBotAction,
  compareHands,
  createInitialPokerPlayers,
  estimateEquity,
  evaluateHand,
  HAND_GUIDE,
  mulberry32 as pokerRng,
  startPokerHand,
  type Card,
} from '../src/games/poker/pokerEngine.ts';

describe('chessEngine', () => {
  it('computes perft(1) = 20, perft(2) = 400 and perft(3) = 8902 from initial position', () => {
    const state = createInitialChessState();
    assert.equal(perft(state, 1), 20);
    assert.equal(perft(state, 2), 400);
    assert.equal(perft(state, 3), 8902);
  });

  it('blocks castling when in check or crossing an attacked square, but allows O-O-O when b1 is attacked', () => {
    // f1 attacked by black rook on f8 -> O-O blocked
    const blockedThroughCheck = parseFEN('5r2/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    const ucisBlocked = generateLegalMoves(blockedThroughCheck).map(moveToUci);
    assert.equal(ucisBlocked.includes('e1g1'), false);
    assert.equal(ucisBlocked.includes('e1c1'), true);

    // King in check on e1 -> both castles blocked
    const inCheck = parseFEN('4r3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    const ucisCheck = generateLegalMoves(inCheck).map(moveToUci);
    assert.equal(ucisCheck.includes('e1g1'), false);
    assert.equal(ucisCheck.includes('e1c1'), false);

    // b1 attacked by rook on b8 -> O-O-O still legal (only e1, d1, c1 matter)
    const b1Attacked = parseFEN('1r6/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    const ucisB1 = generateLegalMoves(b1Attacked).map(moveToUci);
    assert.equal(ucisB1.includes('e1c1'), true);
  });

  it('supports legal en passant capture and removes the jumped pawn', () => {
    let state = parseFEN('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1');
    const doublePush = generateLegalMoves(state).find((m) => moveToUci(m) === 'd7d5')!;
    assert.ok(doublePush);
    state = applyMove(state, doublePush);

    const epMove = generateLegalMoves(state).find((m) => moveToUci(m) === 'e5d6');
    assert.ok(epMove);
    assert.equal(epMove.isEnPassant, true);
    assert.equal(moveToSpanishSAN(state, epMove), 'exd6 a.p.');

    const afterEp = applyMove(state, epMove);
    assert.equal(afterEp.board[algebraicToSq('d5')], null);
    assert.equal(afterEp.board[algebraicToSq('d6')]?.type, 'p');
    assert.equal(afterEp.board[algebraicToSq('d6')]?.color, 'w');
  });

  it('generates all 4 promotion choices on rank 8 and rank 1', () => {
    const whitePromo = parseFEN('6k1/4P3/8/8/8/8/8/4K3 w - - 0 1');
    const whiteUcis = generateLegalMoves(whitePromo)
      .filter((m) => m.from === algebraicToSq('e7'))
      .map(moveToUci)
      .sort();
    assert.deepEqual(whiteUcis, ['e7e8b', 'e7e8n', 'e7e8q', 'e7e8r']);

    const blackPromo = parseFEN('4k3/8/8/8/8/8/3p4/6K1 b - - 0 1');
    const blackUcis = generateLegalMoves(blackPromo)
      .filter((m) => m.from === algebraicToSq('d2'))
      .map(moveToUci)
      .sort();
    assert.deepEqual(blackUcis, ['d2d1b', 'd2d1n', 'd2d1q', 'd2d1r']);
  });

  it("detects Scholar's Mate, stalemate, 50-move rule, threefold repetition and insufficient material", () => {
    // Scholar's Mate
    let s = parseFEN(START_FEN);
    for (const uci of ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7']) {
      const m = generateLegalMoves(s).find((x) => moveToUci(x) === uci)!;
      assert.ok(m, `Expected legal move ${uci}`);
      s = applyMove(s, m);
    }
    const mateStatus = getGameStatus(s);
    assert.equal(mateStatus.status, 'checkmate');
    assert.equal(mateStatus.winner, 'w');

    // Stalemate
    const stalemate = parseFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    assert.equal(getGameStatus(stalemate).status, 'stalemate');

    // 50-move rule
    const fifty = parseFEN('4k3/8/8/8/8/8/8/4K2R w - - 100 60');
    assert.equal(getGameStatus(fifty).status, 'fifty_moves');

    // Insufficient material
    const insuff = parseFEN('4k3/8/8/8/8/8/4B3/4K3 w - - 0 1');
    assert.equal(getGameStatus(insuff).status, 'insufficient');

    // Threefold repetition
    let rep = parseFEN('4k3/8/8/8/8/8/8/R3K2R w - - 0 1');
    const cycle = ['a1a2', 'e8d8', 'a2a1', 'd8e8', 'a1a2', 'e8d8', 'a2a1', 'd8e8'];
    for (const uci of cycle) {
      const m = generateLegalMoves(rep).find((x) => moveToUci(x) === uci)!;
      rep = applyMove(rep, m);
    }
    assert.equal(getGameStatus(rep).status, 'threefold');
  });

  it('returns legal coaching hints in Spanish and validates all 10 chess lessons', () => {
    const emojiRe = /\p{Extended_Pictographic}/u;
    const start = createInitialChessState();
    const hint = getCoachingHint(start);
    const legalUcis = generateLegalMoves(start).map(moveToUci);
    assert.equal(legalUcis.includes(moveToUci(hint.move)), true);
    assert.ok(hint.explanation.length > 10);
    assert.ok(hint.san.length >= 2);

    const bot0 = chooseChessBotMove(start, { level: 0, rng: mulberry32(42) });
    assert.equal(legalUcis.includes(moveToUci(bot0.move)), true);

    assert.equal(CHESS_LESSONS.length, 10, `Deben existir 10 lecciones de ajedrez, hay ${CHESS_LESSONS.length}`);
    const lessonIds = new Set<string>();
    for (const lesson of CHESS_LESSONS) {
      assert.equal(lessonIds.has(lesson.id), false, `ID de lección duplicado: ${lesson.id}`);
      lessonIds.add(lesson.id);
      assert.ok(lesson.steps.length >= 1, `Lección ${lesson.id} debe tener pasos`);
      assert.equal(emojiRe.test(`${lesson.title} ${lesson.summary}`), false);
      for (const step of lesson.steps) {
        const st = parseFEN(step.fen);
        const legals = generateLegalMoves(st).map(moveToUci);
        assert.ok(legals.length > 0, `Lesson ${lesson.id}/${step.id} must have legal moves`);
        assert.equal(emojiRe.test(`${step.title} ${step.instruction} ${step.successFeedback} ${step.wrongHint}`), false);
        if (step.acceptedUci) {
          assert.ok(step.acceptedUci.length >= 1);
          for (const uci of step.acceptedUci) {
            assert.equal(legals.includes(uci), true, `Expected ${uci} legal in ${lesson.id}/${step.id}`);
          }
        }
      }
    }
  });
});

describe('checkersEngine', () => {
  it('generates 7 opening moves and enforces mandatory captures over simple moves', () => {
    const init = createInitialCheckersState();
    assert.equal(generateLegalCheckersMoves(init).length, 7);

    // Mandatory capture: white c3 can jump b4 -> a5; white g3 simple move must be forbidden
    const forcedState = createCheckersStateFromPlacements([
      { sq: 'c3', color: 'w' },
      { sq: 'g3', color: 'w' },
      { sq: 'b4', color: 'b' },
    ]);
    const forced = getForcedCaptureSquares(forcedState);
    assert.deepEqual(forced, [algebraicToSq('c3')]);
    const moves = generateLegalCheckersMoves(forcedState);
    assert.equal(moves.length, 1);
    assert.equal(moves[0].captures.length, 1);
    assert.equal(moves[0].to, algebraicToSq('a5'));
  });

  it('allows pawns to capture backward and enforces full multi-jump chains without premature crowning', () => {
    // White pawn on d6 jumps forward over c7 to b8 (rank 8!), then MUST jump backward over c7? No, c7 was captured!
    // Jump d6 -> c7 -> b8 (captures c7), then from b8 jumps backward over c5? Wait: b8 to d6 is 2 steps over c7; instead test b6 -> c7 -> d8 (cap c7), then d8 -> e7 -> f6 (cap e7)!
    const chainState = createCheckersStateFromPlacements([
      { sq: 'b6', color: 'w' },
      { sq: 'c7', color: 'b' },
      { sq: 'e7', color: 'b' },
      { sq: 'a3', color: 'b' },
    ]);

    const moves = generateLegalCheckersMoves(chainState);
    assert.equal(moves.length, 1);
    assert.deepEqual(moves[0].path, [
      algebraicToSq('b6'),
      algebraicToSq('d8'),
      algebraicToSq('f6'),
    ]);
    assert.equal(moves[0].captures.length, 2);
    // Ended on f6 (not last rank), so pawn does NOT promote!
    assert.equal(moves[0].promotes, false);

    // Step-by-step execution verifies mid-chain at d8 stays non-king and continues
    const step1 = applyCheckersStep(chainState, algebraicToSq('b6'), algebraicToSq('d8'));
    assert.equal(step1.chainContinues, true);
    assert.equal(step1.state.board[algebraicToSq('d8')]?.king, false);

    const step2 = applyCheckersStep(step1.state, algebraicToSq('d8'), algebraicToSq('f6'));
    assert.equal(step2.chainContinues, false);
    assert.equal(step2.state.board[algebraicToSq('f6')]?.king, false);
    assert.equal(step2.state.board[algebraicToSq('c7')], null);
    assert.equal(step2.state.board[algebraicToSq('e7')], null);
  });

  it('supports crowning on last rank and flying king long captures', () => {
    const promoState = createCheckersStateFromPlacements([
      { sq: 'c7', color: 'w' },
      { sq: 'a3', color: 'b' },
    ]);
    const promoMove = generateLegalCheckersMoves(promoState).find(
      (m) => m.to === algebraicToSq('b8')
    )!;
    assert.ok(promoMove);
    assert.equal(promoMove.promotes, true);
    const afterPromo = applyCheckersMove(promoState, promoMove);
    assert.equal(afterPromo.board[algebraicToSq('b8')]?.king, true);

    // Flying king on b8 captures e5 and can land on f4, g3, or h2
    const kingState = createCheckersStateFromPlacements([
      { sq: 'b8', color: 'w', king: true },
      { sq: 'e5', color: 'b' },
    ]);
    const kingMoves = generateLegalCheckersMoves(kingState).map((m) => m.to);
    assert.equal(kingMoves.includes(algebraicToSq('f4')), true);
    assert.equal(kingMoves.includes(algebraicToSq('g3')), true);
    assert.equal(kingMoves.includes(algebraicToSq('h2')), true);
  });

  it('verifies tactical 2x1 lesson and all 8 checkers lessons + bot + hints', () => {
    const emojiRe = /\p{Extended_Pictographic}/u;
    assert.equal(CHECKERS_LESSONS.length, 8, `Deben existir 8 lecciones de damas, hay ${CHECKERS_LESSONS.length}`);
    const seenIds = new Set<string>();
    for (const lesson of CHECKERS_LESSONS) {
      assert.equal(seenIds.has(lesson.id), false, `ID duplicado en damas: ${lesson.id}`);
      seenIds.add(lesson.id);
      assert.ok(lesson.steps.length >= 1);
      assert.equal(emojiRe.test(`${lesson.title} ${lesson.summary}`), false);
      for (const step of lesson.steps) {
        assert.equal(emojiRe.test(`${step.title} ${step.instruction} ${step.successFeedback} ${step.wrongHint}`), false);
        const stepState = {
          board: step.board.map((p) => (p ? { ...p } : null)),
          turn: step.turn,
          noProgressMoves: 0,
          activeChain: null,
        };
        const legals = generateLegalCheckersMoves(stepState);
        assert.ok(legals.length > 0, `Paso ${lesson.id}/${step.id} debe tener jugadas legales`);
        if (step.expectedMoves) {
          const legalKeys = new Set(legals.map((m) => `${m.from}-${m.to}`));
          for (const exp of step.expectedMoves) {
            assert.equal(
              legalKeys.has(exp),
              true,
              `Movimiento esperado ${exp} no es legal en ${lesson.id}/${step.id}. Legales: ${[...legalKeys].join(', ')}`
            );
          }
        }
      }
    }

    // Golpe 2x1 step 1 -> forced reply -> step 2 captures 2
    const step1 = CHECKERS_LESSONS[0].steps[0];
    let st = {
      board: step1.board.map((p) => (p ? { ...p } : null)),
      turn: step1.turn,
      noProgressMoves: 0,
      activeChain: null,
    };
    const m1 = generateLegalCheckersMoves(st).find(
      (m) => `${m.from}-${m.to}` === step1.expectedMoves![0]
    )!;
    assert.ok(m1);
    st = applyCheckersMove(st, m1);
    // Black has only 1 forced capture e5->c3
    const blackForced = generateLegalCheckersMoves(st);
    assert.equal(blackForced.length, 1);
    st = applyCheckersMove(st, blackForced[0]);
    // White now has a 2-piece capture b2->d4->b6
    const white2x1 = generateLegalCheckersMoves(st);
    assert.equal(white2x1.length, 1);
    assert.equal(white2x1[0].captures.length, 2);
    assert.equal(white2x1[0].to, algebraicToSq('b6'));

    const hint = getCheckersHint(st);
    assert.ok(hint.explanation.length > 10);

    const botMove = chooseCheckersBotMove(createInitialCheckersState(), { level: 1 });
    assert.ok(botMove);
  });
});

describe('pokerEngine', () => {
  it('ranks all 10 hand categories strictly in order including wheel straight A-2-3-4-5', () => {
    const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

    const royal = evaluateHand([c(14, 's'), c(13, 's'), c(12, 's'), c(11, 's'), c(10, 's')]);
    const sf = evaluateHand([c(9, 'h'), c(8, 'h'), c(7, 'h'), c(6, 'h'), c(5, 'h')]);
    const quads = evaluateHand([c(13, 's'), c(13, 'h'), c(13, 'd'), c(13, 'c'), c(2, 's')]);
    const full = evaluateHand([c(12, 's'), c(12, 'h'), c(12, 'd'), c(7, 'c'), c(7, 's')]);
    const flush = evaluateHand([c(14, 'd'), c(11, 'd'), c(8, 'd'), c(4, 'd'), c(2, 'd')]);
    const straight6 = evaluateHand([c(6, 'c'), c(5, 's'), c(4, 'h'), c(3, 'd'), c(2, 'c')]);
    const wheel = evaluateHand([c(14, 'c'), c(2, 's'), c(3, 'h'), c(4, 'd'), c(5, 'c')]);
    const trips = evaluateHand([c(11, 's'), c(11, 'h'), c(11, 'c'), c(14, 'd'), c(5, 's')]);
    const twoPair = evaluateHand([c(10, 's'), c(10, 'd'), c(6, 'h'), c(6, 'c'), c(14, 's')]);
    const onePair = evaluateHand([c(14, 'h'), c(14, 'c'), c(12, 's'), c(9, 'd'), c(4, 'h')]);
    const highCard = evaluateHand([c(14, 's'), c(12, 'd'), c(9, 'c'), c(6, 'h'), c(3, 's')]);

    assert.equal(wheel.category, 4);
    assert.equal(compareHands(straight6, wheel), 1);

    const ordered = [royal, sf, quads, full, flush, straight6, wheel, trips, twoPair, onePair, highCard];
    for (let i = 0; i < ordered.length - 1; i++) {
      assert.equal(
        compareHands(ordered[i], ordered[i + 1]),
        1,
        `Expected ${ordered[i].name} > ${ordered[i + 1].name}`
      );
    }

    assert.equal(HAND_GUIDE.length, 10);
  });

  it('breaks ties by kickers accurately across 7 cards', () => {
    const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });
    const board = [c(14, 's'), c(9, 'd'), c(7, 'c'), c(4, 'h'), c(2, 's')];
    const handAK = evaluateHand([c(14, 'h'), c(13, 'd'), ...board]);
    const handAQ = evaluateHand([c(14, 'c'), c(12, 'h'), ...board]);
    assert.equal(compareHands(handAK, handAQ), 1);
  });

  it('computes outs, seeded Monte Carlo equity and conserves chips through a complete hand', () => {
    const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

    // Flush draw on flop -> 9 flush outs (+ any pair outs if hole cards pair)
    const outs = calculateOuts(
      [c(14, 'h'), c(10, 'h')],
      [c(2, 'h'), c(7, 'h'), c(13, 'c')]
    );
    assert.ok(outs.totalOuts >= 9);

    const eq = estimateEquity([c(14, 's'), c(14, 'h')], [], 1, 400, pokerRng(123));
    assert.ok(eq > 0.75);

    // Complete hand chip conservation
    const rng = pokerRng(99);
    let hand = startPokerHand(createInitialPokerPlayers(), 1, 0, rng);
    let safety = 0;
    while (hand.street !== 'showdown' && hand.actingSeat !== null && safety++ < 40) {
      const act = choosePokerBotAction(hand, 0, rng);
      hand = applyPokerAction(hand, act);
    }
    assert.equal(hand.street, 'showdown');
    const totalChips = hand.players.reduce((sum, p) => sum + p.chips, 0);
    assert.equal(totalChips, 4000);
  });
});
