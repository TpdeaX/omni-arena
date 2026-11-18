export type CheckersColor = 'w' | 'b';

export interface CheckersPiece {
  color: CheckersColor;
  king: boolean;
}

export interface CheckersMove {
  from: number;
  to: number;
  path: number[]; // [from, step1, step2, ...]
  captures: number[]; // squares of captured opponent pieces
  promotes: boolean;
}

export interface CheckersState {
  board: (CheckersPiece | null)[];
  turn: CheckersColor;
  noProgressMoves: number;
  activeChain: {
    from: number;
    path: number[];
    captures: number[];
  } | null;
  lastMove?: CheckersMove;
}

export interface CheckersHint {
  move: CheckersMove;
  explanation: string;
}

export interface CheckersLessonStep {
  id: string;
  title: string;
  instruction: string;
  board: (CheckersPiece | null)[];
  turn: CheckersColor;
  expectedMoves?: string[]; // "from-to" or "c3-d4"
  successFeedback: string;
  wrongHint: string;
}

export interface CheckersLesson {
  id: string;
  title: string;
  summary: string;
  steps: CheckersLessonStep[];
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

export function sqToRowCol(sq: number): { row: number; col: number } {
  return { row: Math.floor(sq / 8), col: sq % 8 };
}

export function rowColToSq(row: number, col: number): number {
  return row * 8 + col;
}

export function isDarkSquare(sq: number): boolean {
  const { row, col } = sqToRowCol(sq);
  return (row + col) % 2 === 1;
}

export function sqToAlgebraic(sq: number): string {
  const { row, col } = sqToRowCol(sq);
  return `${String.fromCharCode(97 + col)}${8 - row}`;
}

export function algebraicToSq(alg: string): number {
  const col = alg.charCodeAt(0) - 97;
  const row = 8 - Number(alg[1]);
  return rowColToSq(row, col);
}

export function oppositeCheckersColor(c: CheckersColor): CheckersColor {
  return c === 'w' ? 'b' : 'w';
}

export function createInitialCheckersState(): CheckersState {
  const board: (CheckersPiece | null)[] = new Array(64).fill(null);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 !== 1) continue;
      if (r <= 2) {
        board[r * 8 + c] = { color: 'b', king: false };
      } else if (r >= 5) {
        board[r * 8 + c] = { color: 'w', king: false };
      }
    }
  }
  return {
    board,
    turn: 'w',
    noProgressMoves: 0,
    activeChain: null,
  };
}

export function createCheckersStateFromPlacements(
  placements: { sq: number | string; color: CheckersColor; king?: boolean }[],
  turn: CheckersColor = 'w'
): CheckersState {
  const board: (CheckersPiece | null)[] = new Array(64).fill(null);
  for (const item of placements) {
    const sq = typeof item.sq === 'string' ? algebraicToSq(item.sq) : item.sq;
    board[sq] = { color: item.color, king: Boolean(item.king) };
  }
  return { board, turn, noProgressMoves: 0, activeChain: null };
}

const ALL_DIAG_DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

function findCaptureChainsFrom(
  board: (CheckersPiece | null)[],
  originSq: number,
  currentSq: number,
  piece: CheckersPiece,
  capturedSoFar: number[],
  pathSoFar: number[],
  results: CheckersMove[]
): void {
  const { row, col } = sqToRowCol(currentSq);
  const enemy = oppositeCheckersColor(piece.color);
  let foundNextJump = false;

  if (!piece.king) {
    // Pawn captures forward AND backward (1 step over enemy to empty square)
    for (const [dr, dc] of ALL_DIAG_DIRS) {
      const mr = row + dr;
      const mc = col + dc;
      const lr = row + 2 * dr;
      const lc = col + 2 * dc;
      if (lr < 0 || lr >= 8 || lc < 0 || lc >= 8) continue;

      const midSq = mr * 8 + mc;
      const landSq = lr * 8 + lc;
      const midPiece = board[midSq];
      // Original origin square is considered empty during chain if piece left it
      const landOccupied = landSq !== originSq && board[landSq] !== null;

      if (
        midPiece &&
        midPiece.color === enemy &&
        !capturedSoFar.includes(midSq) &&
        !landOccupied
      ) {
        foundNextJump = true;
        findCaptureChainsFrom(
          board,
          originSq,
          landSq,
          piece,
          [...capturedSoFar, midSq],
          [...pathSoFar, landSq],
          results
        );
      }
    }
  } else {
    // Flying king: slides any empty distance, jumps single enemy, lands on any empty square beyond
    for (const [dr, dc] of ALL_DIAG_DIRS) {
      let nr = row + dr;
      let nc = col + dc;
      let jumpedSq: number | null = null;

      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const sq = nr * 8 + nc;
        const occupant = sq === originSq ? null : board[sq];

        if (jumpedSq === null) {
          if (occupant === null) {
            // Note: cannot pass through an already-captured piece as if empty
            if (capturedSoFar.includes(sq)) break;
            nr += dr;
            nc += dc;
            continue;
          }
          if (occupant.color === enemy && !capturedSoFar.includes(sq)) {
            jumpedSq = sq;
            nr += dr;
            nc += dc;
            continue;
          }
          break;
        } else {
          // Already jumped an enemy piece; any empty square before next piece/captured piece is valid
          if (occupant !== null || capturedSoFar.includes(sq)) break;
          foundNextJump = true;
          findCaptureChainsFrom(
            board,
            originSq,
            sq,
            piece,
            [...capturedSoFar, jumpedSq],
            [...pathSoFar, sq],
            results
          );
          nr += dr;
          nc += dc;
        }
      }
    }
  }

  if (!foundNextJump && capturedSoFar.length > 0) {
    const endRow = Math.floor(currentSq / 8);
    const promoRow = piece.color === 'w' ? 0 : 7;
    const promotes = !piece.king && endRow === promoRow;
    results.push({
      from: originSq,
      to: currentSq,
      path: pathSoFar,
      captures: capturedSoFar,
      promotes,
    });
  }
}

export function generateLegalCheckersMoves(state: CheckersState): CheckersMove[] {
  const captures: CheckersMove[] = [];
  const simples: CheckersMove[] = [];
  const { board, turn } = state;

  for (let sq = 0; sq < 64; sq++) {
    const piece = board[sq];
    if (!piece || piece.color !== turn) continue;

    // 1. Capture sequences
    findCaptureChainsFrom(board, sq, sq, piece, [], [sq], captures);
  }

  if (captures.length > 0) {
    return captures;
  }

  // 2. Simple non-capture moves (only when NO captures exist anywhere on the board)
  for (let sq = 0; sq < 64; sq++) {
    const piece = board[sq];
    if (!piece || piece.color !== turn) continue;
    const { row, col } = sqToRowCol(sq);

    if (!piece.king) {
      const dr = turn === 'w' ? -1 : 1;
      const promoRow = turn === 'w' ? 0 : 7;
      for (const dc of [-1, 1]) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
        const to = nr * 8 + nc;
        if (!board[to]) {
          simples.push({
            from: sq,
            to,
            path: [sq, to],
            captures: [],
            promotes: nr === promoRow,
          });
        }
      }
    } else {
      for (const [dr, dc] of ALL_DIAG_DIRS) {
        let nr = row + dr;
        let nc = col + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const to = nr * 8 + nc;
          if (board[to]) break;
          simples.push({
            from: sq,
            to,
            path: [sq, to],
            captures: [],
            promotes: false,
          });
          nr += dr;
          nc += dc;
        }
      }
    }
  }

  return simples;
}

export function getForcedCaptureSquares(state: CheckersState): number[] {
  if (state.activeChain) {
    return [state.activeChain.from];
  }
  const moves = generateLegalCheckersMoves(state);
  const captureMoves = moves.filter((m) => m.captures.length > 0);
  if (captureMoves.length === 0) return [];
  return Array.from(new Set(captureMoves.map((m) => m.from)));
}

export function applyCheckersMove(state: CheckersState, move: CheckersMove): CheckersState {
  const board = state.board.slice();
  const piece = board[move.from]!;
  board[move.from] = null;
  for (const capSq of move.captures) {
    board[capSq] = null;
  }
  board[move.to] = {
    color: piece.color,
    king: piece.king || move.promotes,
  };

  const progress = !piece.king || move.captures.length > 0;
  return {
    board,
    turn: oppositeCheckersColor(state.turn),
    noProgressMoves: progress ? 0 : state.noProgressMoves + 1,
    activeChain: null,
    lastMove: move,
  };
}

/**
 * Interactive step-by-step support for multi-jump chains in the UI.
 * Returns valid next destination squares from `sq` in the current state (considering activeChain if any).
 */
export function getValidNextStepSquares(
  state: CheckersState,
  sq: number
): { to: number; isCapture: boolean; matchingMoves: CheckersMove[] }[] {
  const allLegal = generateLegalCheckersMoves(state);

  if (state.activeChain) {
    if (sq !== state.activeChain.from) return [];
    const curPiece = state.board[sq];
    if (!curPiece) return [];
    // Compute possible immediate jumps from current sq given already-captured pieces
    const nextJumps: CheckersMove[] = [];
    findCaptureChainsFrom(
      state.board,
      sq,
      sq,
      curPiece,
      state.activeChain.captures,
      state.activeChain.path,
      nextJumps
    );
    const stepIndex = state.activeChain.path.length; // next square index in path
    const map = new Map<number, CheckersMove[]>();
    for (const m of nextJumps) {
      const nextSq = m.path[stepIndex];
      if (nextSq === undefined) continue;
      const arr = map.get(nextSq) ?? [];
      arr.push(m);
      map.set(nextSq, arr);
    }
    return Array.from(map.entries()).map(([to, matchingMoves]) => ({
      to,
      isCapture: true,
      matchingMoves,
    }));
  }

  const fromMoves = allLegal.filter((m) => m.from === sq);
  const map = new Map<number, CheckersMove[]>();
  for (const m of fromMoves) {
    const nextSq = m.path[1];
    const arr = map.get(nextSq) ?? [];
    arr.push(m);
    map.set(nextSq, arr);
  }
  return Array.from(map.entries()).map(([to, matchingMoves]) => ({
    to,
    isCapture: matchingMoves[0].captures.length > 0,
    matchingMoves,
  }));
}

/**
 * Applies a single click-to-click step (fromSq -> toSq).
 * If a capture chain continues, keeps the same player's turn with `activeChain` populated
 * and does NOT crown prematurely mid-chain.
 */
export function applyCheckersStep(
  state: CheckersState,
  fromSq: number,
  toSq: number
): { state: CheckersState; completedMove: CheckersMove | null; chainContinues: boolean } {
  const options = getValidNextStepSquares(state, fromSq);
  const chosen = options.find((o) => o.to === toSq);
  if (!chosen) {
    throw new Error(`Invalid checkers step from ${fromSq} to ${toSq}`);
  }

  if (!chosen.isCapture) {
    const fullMove = chosen.matchingMoves[0];
    return {
      state: applyCheckersMove(state, fullMove),
      completedMove: fullMove,
      chainContinues: false,
    };
  }

  // Find which enemy piece was jumped in this single segment
  const { row: fr, col: fc } = sqToRowCol(fromSq);
  const { row: tr, col: tc } = sqToRowCol(toSq);
  const dr = Math.sign(tr - fr);
  const dc = Math.sign(tc - fc);
  let jumpedSq = -1;
  let r = fr + dr;
  let c = fc + dc;
  while (r !== tr || c !== tc) {
    const s = r * 8 + c;
    if (state.board[s] !== null) {
      jumpedSq = s;
      break;
    }
    r += dr;
    c += dc;
  }

  const prevPath = state.activeChain ? state.activeChain.path : [fromSq];
  const prevCaps = state.activeChain ? state.activeChain.captures : [];
  const nextPath = [...prevPath, toSq];
  const nextCaps = jumpedSq !== -1 ? [...prevCaps, jumpedSq] : prevCaps;

  const movingPiece = state.board[fromSq]!;
  // Check if any matching full move has MORE steps beyond `nextPath.length`
  const hasFurtherSteps = chosen.matchingMoves.some((m) => m.path.length > nextPath.length);

  if (hasFurtherSteps) {
    // Move piece temporarily without crowning and without removing captured pieces until end of chain
    const board = state.board.slice();
    board[fromSq] = null;
    board[toSq] = { ...movingPiece }; // stays pawn if pawn!
    return {
      state: {
        board,
        turn: state.turn,
        noProgressMoves: state.noProgressMoves,
        activeChain: {
          from: toSq,
          path: nextPath,
          captures: nextCaps,
        },
      },
      completedMove: null,
      chainContinues: true,
    };
  }

  // Chain finished! Remove all captured pieces and promote if landing on last row
  const board = state.board.slice();
  board[fromSq] = null;
  for (const cap of nextCaps) {
    board[cap] = null;
  }
  const promoRow = movingPiece.color === 'w' ? 0 : 7;
  const promotes = !movingPiece.king && Math.floor(toSq / 8) === promoRow;
  board[toSq] = {
    color: movingPiece.color,
    king: movingPiece.king || promotes,
  };

  const completedMove: CheckersMove = {
    from: nextPath[0],
    to: toSq,
    path: nextPath,
    captures: nextCaps,
    promotes,
  };

  return {
    state: {
      board,
      turn: oppositeCheckersColor(state.turn),
      noProgressMoves: !movingPiece.king || nextCaps.length > 0 ? 0 : state.noProgressMoves + 1,
      activeChain: null,
      lastMove: completedMove,
    },
    completedMove,
    chainContinues: false,
  };
}

export function getCheckersGameStatus(state: CheckersState): {
  status: 'playing' | 'win' | 'draw';
  winner: CheckersColor | null;
  reason: string;
} {
  if (state.noProgressMoves >= 40) {
    return {
      status: 'draw',
      winner: null,
      reason: 'Tablas tras 40 jugadas de damas sin capturas ni avances de peón.',
    };
  }
  const moves = generateLegalCheckersMoves(state);
  if (moves.length === 0) {
    const winner = oppositeCheckersColor(state.turn);
    return {
      status: 'win',
      winner,
      reason: `${winner === 'w' ? 'Blancas' : 'Negras'} ganan: el rival no tiene piezas o jugadas legales.`,
    };
  }
  return { status: 'playing', winner: null, reason: '' };
}

export function countCheckersPieces(board: (CheckersPiece | null)[], color: CheckersColor): {
  men: number;
  kings: number;
  total: number;
} {
  let men = 0;
  let kings = 0;
  for (const p of board) {
    if (p && p.color === color) {
      if (p.king) kings++;
      else men++;
    }
  }
  return { men, kings, total: men + kings };
}

export function evaluateCheckersBoard(state: CheckersState): number {
  let score = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = state.board[sq];
    if (!p) continue;
    const { row, col } = sqToRowCol(sq);
    let val = p.king ? 330 : 100;
    if (!p.king) {
      const adv = p.color === 'w' ? 7 - row : row;
      val += adv * 7;
      if ((p.color === 'w' && row === 7) || (p.color === 'b' && row === 0)) {
        val += 12; // back-rank defense
      }
    }
    if (col >= 2 && col <= 5 && row >= 2 && row <= 5) {
      val += 10;
    }
    score += p.color === 'w' ? val : -val;
  }
  return state.turn === 'w' ? score : -score;
}

function checkersAlphaBeta(
  state: CheckersState,
  depth: number,
  alpha: number,
  beta: number,
  deadlineMs: number | null
): { score: number; bestMove: CheckersMove | null; timedOut: boolean } {
  if (deadlineMs !== null && Date.now() >= deadlineMs) {
    return { score: 0, bestMove: null, timedOut: true };
  }

  const moves = generateLegalCheckersMoves(state);
  if (moves.length === 0) {
    return { score: -50000 - depth * 10, bestMove: null, timedOut: false };
  }
  if (depth <= 0) {
    return { score: evaluateCheckersBoard(state), bestMove: null, timedOut: false };
  }

  // Order captures and promotions first
  const ordered = moves.slice().sort((a, b) => {
    const sa = a.captures.length * 100 + (a.promotes ? 60 : 0);
    const sb = b.captures.length * 100 + (b.promotes ? 60 : 0);
    return sb - sa;
  });

  let bestMove = ordered[0];
  let bestScore = -Infinity;

  for (const m of ordered) {
    const next = applyCheckersMove(state, m);
    const res = checkersAlphaBeta(next, depth - 1, -beta, -alpha, deadlineMs);
    if (res.timedOut) {
      return { score: bestScore === -Infinity ? 0 : bestScore, bestMove, timedOut: true };
    }
    const val = -res.score;
    if (val > bestScore) {
      bestScore = val;
      bestMove = m;
    }
    if (val > alpha) alpha = val;
    if (alpha >= beta) break;
  }

  return { score: bestScore, bestMove, timedOut: false };
}

export function chooseCheckersBotMove(
  state: CheckersState,
  options: { level: 0 | 1 | 2; rng?: () => number; timeBudgetMs?: number }
): CheckersMove {
  const moves = generateLegalCheckersMoves(state);
  if (moves.length === 0) {
    throw new Error('No legal checkers moves available');
  }
  const rng = options.rng ?? Math.random;

  if (options.level === 0) {
    if (rng() < 0.35) {
      return moves[Math.floor(rng() * moves.length)];
    }
    const res = checkersAlphaBeta(state, 1, -Infinity, Infinity, null);
    return res.bestMove ?? moves[0];
  }

  if (options.level === 1) {
    const res = checkersAlphaBeta(state, 4, -Infinity, Infinity, null);
    return res.bestMove ?? moves[0];
  }

  const deadline = Date.now() + (options.timeBudgetMs ?? 600);
  let best = moves[0];
  for (const d of [2, 4, 6]) {
    const res = checkersAlphaBeta(state, d, -Infinity, Infinity, d >= 4 ? deadline : null);
    if (res.timedOut) break;
    if (res.bestMove) best = res.bestMove;
  }
  return best;
}

export function getCheckersHint(state: CheckersState): CheckersHint {
  const moves = generateLegalCheckersMoves(state);
  if (moves.length === 0) {
    throw new Error('No legal moves for hint');
  }

  // If currently inside a multi-jump chain, recommend completing the longest/best chain
  if (state.activeChain) {
    const options = getValidNextStepSquares(state, state.activeChain.from);
    const bestOpt = options.slice().sort((a, b) => b.matchingMoves[0].captures.length - a.matchingMoves[0].captures.length)[0];
    const move = bestOpt.matchingMoves[0];
    return {
      move,
      explanation: `Completa la captura encadenada hasta ${sqToAlgebraic(move.to)} para retirar ${move.captures.length} piezas rivales.`,
    };
  }

  const bestMove = chooseCheckersBotMove(state, { level: 1 });
  const fromAlg = sqToAlgebraic(bestMove.from);
  const toAlg = sqToAlgebraic(bestMove.to);

  // Check if any alternative move walks into a multi-capture trap
  let trapWarning = '';
  for (const m of moves) {
    if (m.from === bestMove.from && m.to === bestMove.to) continue;
    const afterAlt = applyCheckersMove(state, m);
    const oppMoves = generateLegalCheckersMoves(afterAlt);
    const multiCap = oppMoves.find((om) => om.captures.length >= 2);
    if (multiCap) {
      const capNames = multiCap.captures.map(sqToAlgebraic).join(' y ');
      trapWarning = ` Evita ${sqToAlgebraic(m.to)}: si mueves allí el rival captura ${multiCap.captures.length} piezas (${capNames}).`;
      break;
    }
  }

  let explanation = `Mueve de ${fromAlg} a ${toAlg} para ganar control del centro.${trapWarning}`;
  if (bestMove.captures.length >= 2) {
    const capNames = bestMove.captures.map(sqToAlgebraic).join(', ');
    explanation = `Captura obligatoria múltiple desde ${fromAlg} hasta ${toAlg}: eliminas ${bestMove.captures.length} piezas (${capNames}).`;
  } else if (bestMove.captures.length === 1) {
    explanation = `Captura obligatoria: salta de ${fromAlg} a ${toAlg} eliminando la pieza de ${sqToAlgebraic(bestMove.captures[0])}.${trapWarning}`;
  } else if (bestMove.promotes) {
    explanation = `Corona tu peón moviendo de ${fromAlg} a ${toAlg} para obtener una dama voladora.${trapWarning}`;
  } else if (trapWarning) {
    explanation = `Juega ${fromAlg} → ${toAlg}.${trapWarning}`;
  }

  return { move: bestMove, explanation };
}

export const CHECKERS_LESSONS: CheckersLesson[] = [
  {
    id: 'shot-2x1',
    title: 'Golpe 2×1',
    summary: 'Entrega una pieza de cebo para obligar al rival a capturar y abrir un salto doble.',
    steps: [
      {
        id: '2x1-step1',
        title: 'Prepara el cebo',
        instruction: 'Entrega el peón de c3 moviéndolo a d4. El rival estará obligado a capturar de e5 a c3 y abrirá tu golpe doble.',
        board: createCheckersStateFromPlacements([
          { sq: 'a1', color: 'w' },
          { sq: 'b2', color: 'w' },
          { sq: 'c3', color: 'w' },
          { sq: 'e3', color: 'w' },
          { sq: 'c5', color: 'b' },
          { sq: 'e5', color: 'b' },
          { sq: 'a7', color: 'b' },
        ]).board,
        turn: 'w',
        expectedMoves: [`${algebraicToSq('c3')}-${algebraicToSq('d4')}`],
        successFeedback: 'Cebo colocado en d4. Ahora la captura obligatoria negra abre un camino doble para tu pieza en b2.',
        wrongHint: 'Mueve el peón de c3 a d4: como c5 está bloqueado por tu pieza en e3, solo e5 puede capturar.',
      },
      {
        id: '2x1-step2',
        title: 'Ejecuta el golpe 2×1',
        instruction: 'Las negras acaban de capturar e5→c3. Ahora salta en cadena con b2→d4→b6 para capturar dos piezas.',
        board: createCheckersStateFromPlacements([
          { sq: 'a1', color: 'w' },
          { sq: 'b2', color: 'w' },
          { sq: 'e3', color: 'w' },
          { sq: 'c3', color: 'b' },
          { sq: 'c5', color: 'b' },
          { sq: 'a7', color: 'b' },
        ]).board,
        turn: 'w',
        expectedMoves: [`${algebraicToSq('b2')}-${algebraicToSq('b6')}`],
        successFeedback: 'Golpe 2×1 ejecutado: entregaste una pieza para ganar dos y despejar el flanco.',
        wrongHint: 'Haz clic en tu pieza obligada en b2, salta a d4 y continúa hasta b6.',
      },
    ],
  },
  {
    id: 'pincer',
    title: 'Tenaza',
    summary: 'Cierra las diagonales del rival hasta dejar una pieza sin escape y ganar material.',
    steps: [
      {
        id: 'pincer-step1',
        title: 'Cierra la tenaza',
        instruction: 'Avanza c3→b4 para inmovilizar al peón negro de c5 y obligar a que b6 avance hacia la captura.',
        board: createCheckersStateFromPlacements([
          { sq: 'a3', color: 'w' },
          { sq: 'c3', color: 'w' },
          { sq: 'd4', color: 'w' },
          { sq: 'e3', color: 'w' },
          { sq: 'c5', color: 'b' },
          { sq: 'b6', color: 'b' },
          { sq: 'a7', color: 'b' },
        ]).board,
        turn: 'w',
        expectedMoves: [`${algebraicToSq('c3')}-${algebraicToSq('b4')}`],
        successFeedback: 'Tenaza cerrada: c5 no puede moverse ni capturar y b6 solo puede ir a a5, donde lo capturarás.',
        wrongHint: 'Mueve tu peón de c3 a b4 para formar un muro junto a d4, a3 y e3.',
      },
    ],
  },
  {
    id: 'crowning',
    title: 'Coronar a tiempo',
    summary: 'Alcanza la última fila al terminar tu jugada para activar el alcance largo de la dama voladora.',
    steps: [
      {
        id: 'crown-step1',
        title: 'Corona en b8',
        instruction: 'Avanza tu peón de c7 a b8 para coronar en dama voladora y controlar la gran diagonal.',
        board: createCheckersStateFromPlacements([
          { sq: 'c7', color: 'w' },
          { sq: 'a3', color: 'w' },
          { sq: 'e5', color: 'b' },
          { sq: 'b4', color: 'b' },
        ]).board,
        turn: 'w',
        expectedMoves: [`${algebraicToSq('c7')}-${algebraicToSq('b8')}`],
        successFeedback: 'Coronaste en b8: la dama voladora ahora recorre toda la diagonal b8–h2.',
        wrongHint: 'Mueve el peón de c7 a la casilla b8 de la última fila.',
      },
      {
        id: 'crown-step2',
        title: 'Captura con dama voladora',
        instruction: 'Tu dama en b8 puede volar por la diagonal y capturar al peón en e5 cayendo en g3 o h2.',
        board: createCheckersStateFromPlacements([
          { sq: 'b8', color: 'w', king: true },
          { sq: 'a3', color: 'w' },
          { sq: 'e5', color: 'b' },
          { sq: 'c3', color: 'b' },
        ]).board,
        turn: 'w',
        expectedMoves: [
          `${algebraicToSq('b8')}-${algebraicToSq('f4')}`,
          `${algebraicToSq('b8')}-${algebraicToSq('g3')}`,
          `${algebraicToSq('b8')}-${algebraicToSq('h2')}`,
        ],
        successFeedback: 'Excelente: la dama voladora puede saltar a distancia y elegir cualquier casilla libre detrás de la pieza capturada.',
        wrongHint: 'Selecciona tu dama en b8 y haz clic en f4, g3 o h2 detrás del peón de e5.',
      },
    ],
  },
];
