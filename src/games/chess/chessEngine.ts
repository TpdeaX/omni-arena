export type ChessColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export interface ChessPiece {
  color: ChessColor;
  type: PieceType;
}

export interface CastlingRights {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

export interface ChessMove {
  from: number;
  to: number;
  piece: PieceType;
  color: ChessColor;
  captured?: PieceType;
  promotion?: PromotionPiece;
  isCastle?: 'K' | 'Q';
  isEnPassant?: boolean;
  isDoublePush?: boolean;
}

export interface ChessState {
  board: (ChessPiece | null)[];
  turn: ChessColor;
  castling: CastlingRights;
  epSquare: number | null;
  halfmoveClock: number;
  fullmoveNumber: number;
  positionCounts: Record<string, number>;
  lastMove?: ChessMove;
}

export type ChessGameStatus =
  | 'playing'
  | 'checkmate'
  | 'stalemate'
  | 'fifty_moves'
  | 'threefold'
  | 'insufficient';

export interface ChessBotOptions {
  level: 0 | 1 | 2;
  rng?: () => number;
  timeBudgetMs?: number;
}

export interface ChessHint {
  move: ChessMove;
  san: string;
  explanation: string;
  reasonTag: string;
  evalCp: number;
}

export interface ChessLessonStep {
  id: string;
  title: string;
  instruction: string;
  fen: string;
  mode: 'stars' | 'find_best' | 'mate_endgame';
  stars?: number[];
  acceptedUci?: string[];
  successFeedback: string;
  wrongHint: string;
}

export interface ChessLesson {
  id: string;
  title: string;
  summary: string;
  steps: ChessLessonStep[];
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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

export function sqToAlgebraic(sq: number): string {
  const { row, col } = sqToRowCol(sq);
  return `${String.fromCharCode(97 + col)}${8 - row}`;
}

export function algebraicToSq(alg: string): number {
  const col = alg.charCodeAt(0) - 97;
  const row = 8 - Number(alg[1]);
  return rowColToSq(row, col);
}

export function moveToUci(m: ChessMove): string {
  return `${sqToAlgebraic(m.from)}${sqToAlgebraic(m.to)}${m.promotion ?? ''}`;
}

export function oppositeColor(c: ChessColor): ChessColor {
  return c === 'w' ? 'b' : 'w';
}

const PIECE_NAMES_ES: Record<PieceType, string> = {
  p: 'peón',
  n: 'caballo',
  b: 'alfil',
  r: 'torre',
  q: 'dama',
  k: 'rey',
};

const PIECE_SAN_ES: Record<PieceType, string> = {
  p: '',
  n: 'C',
  b: 'A',
  r: 'T',
  q: 'D',
  k: 'R',
};

const PIECE_VALUES: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const PIECE_POINTS: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

// Piece-square tables from White's perspective (row 0 = rank 8, row 7 = rank 1)
const PST_PAWN = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 27, 27, 10, 5, 5,
  0, 0, 0, 24, 24, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -22, -22, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];

const PST_KNIGHT = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 12, 16, 16, 12, 0, -30,
  -30, 5, 16, 22, 22, 16, 5, -30,
  -30, 0, 16, 22, 22, 16, 0, -30,
  -30, 5, 12, 16, 16, 12, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];

const PST_BISHOP = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 8, 12, 12, 8, 0, -10,
  -10, 6, 6, 12, 12, 6, 6, -10,
  -10, 0, 12, 12, 12, 12, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 6, 0, 0, 0, 0, 6, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];

const PST_ROOK = [
  0, 0, 0, 0, 0, 0, 0, 0,
  8, 14, 14, 14, 14, 14, 14, 8,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  0, 0, 4, 8, 8, 4, 0, 0,
];

const PST_QUEEN = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 6, 6, 6, 6, 0, -10,
  -5, 0, 6, 6, 6, 6, 0, -5,
  0, 0, 6, 6, 6, 6, 0, -5,
  -10, 5, 6, 6, 6, 6, 0, -10,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
];

const PST_KING = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20,
];

function getPstBonus(type: PieceType, color: ChessColor, sq: number): number {
  const { row, col } = sqToRowCol(sq);
  const idx = color === 'w' ? row * 8 + col : (7 - row) * 8 + col;
  switch (type) {
    case 'p':
      return PST_PAWN[idx];
    case 'n':
      return PST_KNIGHT[idx];
    case 'b':
      return PST_BISHOP[idx];
    case 'r':
      return PST_ROOK[idx];
    case 'q':
      return PST_QUEEN[idx];
    case 'k':
      return PST_KING[idx];
  }
}

export function boardPlacementString(board: (ChessPiece | null)[]): string {
  let out = '';
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = board[r * 8 + c];
      if (!p) {
        empty++;
      } else {
        if (empty > 0) {
          out += String(empty);
          empty = 0;
        }
        const ch = p.color === 'w' ? p.type.toUpperCase() : p.type;
        out += ch;
      }
    }
    if (empty > 0) out += String(empty);
    if (r < 7) out += '/';
  }
  return out;
}

export function castlingString(c: CastlingRights): string {
  let s = '';
  if (c.wK) s += 'K';
  if (c.wQ) s += 'Q';
  if (c.bK) s += 'k';
  if (c.bQ) s += 'q';
  return s || '-';
}

export function positionKey(state: ChessState): string {
  const ep = state.epSquare !== null ? sqToAlgebraic(state.epSquare) : '-';
  return `${boardPlacementString(state.board)} ${state.turn} ${castlingString(state.castling)} ${ep}`;
}

export function toFEN(state: ChessState): string {
  return `${positionKey(state)} ${state.halfmoveClock} ${state.fullmoveNumber}`;
}

export function parseFEN(fen: string): ChessState {
  const parts = fen.trim().split(/\s+/);
  const placement = parts[0];
  const turn = (parts[1] === 'b' ? 'b' : 'w') as ChessColor;
  const castleStr = parts[2] ?? '-';
  const epStr = parts[3] ?? '-';
  const halfmoveClock = Number(parts[4] ?? 0) || 0;
  const fullmoveNumber = Number(parts[5] ?? 1) || 1;

  const board: (ChessPiece | null)[] = new Array(64).fill(null);
  const rows = placement.split('/');
  for (let r = 0; r < 8 && r < rows.length; r++) {
    let c = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        c += Number(ch);
      } else {
        const lower = ch.toLowerCase() as PieceType;
        const color: ChessColor = ch === ch.toUpperCase() ? 'w' : 'b';
        board[r * 8 + c] = { color, type: lower };
        c++;
      }
    }
  }

  const castling: CastlingRights = {
    wK: castleStr.includes('K'),
    wQ: castleStr.includes('Q'),
    bK: castleStr.includes('k'),
    bQ: castleStr.includes('q'),
  };

  const epSquare = epStr !== '-' && epStr.length === 2 ? algebraicToSq(epStr) : null;

  const state: ChessState = {
    board,
    turn,
    castling,
    epSquare,
    halfmoveClock,
    fullmoveNumber,
    positionCounts: {},
  };
  const key = positionKey(state);
  state.positionCounts[key] = 1;
  return state;
}

export function createInitialChessState(): ChessState {
  return parseFEN(START_FEN);
}

export function findKingSquare(board: (ChessPiece | null)[], color: ChessColor): number {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.color === color && p.type === 'k') return i;
  }
  return -1;
}

const KNIGHT_OFFSETS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
] as const;

const BISHOP_DIRS = [
  [-1, -1], [-1, 1], [1, -1], [1, 1],
] as const;

const ROOK_DIRS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
] as const;

const KING_OFFSETS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
] as const;

export function isSquareAttacked(
  board: (ChessPiece | null)[],
  sq: number,
  byColor: ChessColor
): boolean {
  const { row, col } = sqToRowCol(sq);

  // Pawn attacks (byColor pawns attack toward `sq`)
  const pawnFromRow = byColor === 'w' ? row + 1 : row - 1;
  if (pawnFromRow >= 0 && pawnFromRow < 8) {
    for (const dc of [-1, 1]) {
      const nc = col + dc;
      if (nc >= 0 && nc < 8) {
        const p = board[pawnFromRow * 8 + nc];
        if (p && p.color === byColor && p.type === 'p') return true;
      }
    }
  }

  // Knight attacks
  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[nr * 8 + nc];
      if (p && p.color === byColor && p.type === 'n') return true;
    }
  }

  // King attacks
  for (const [dr, dc] of KING_OFFSETS) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[nr * 8 + nc];
      if (p && p.color === byColor && p.type === 'k') return true;
    }
  }

  // Diagonal rays (Bishop / Queen)
  for (const [dr, dc] of BISHOP_DIRS) {
    let nr = row + dr;
    let nc = col + dc;
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[nr * 8 + nc];
      if (p) {
        if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  // Orthogonal rays (Rook / Queen)
  for (const [dr, dc] of ROOK_DIRS) {
    let nr = row + dr;
    let nc = col + dc;
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[nr * 8 + nc];
      if (p) {
        if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  return false;
}

export function isInCheck(state: ChessState, color: ChessColor): boolean {
  const kingSq = findKingSquare(state.board, color);
  if (kingSq === -1) return false;
  return isSquareAttacked(state.board, kingSq, oppositeColor(color));
}

function generatePseudoMoves(state: ChessState): ChessMove[] {
  const moves: ChessMove[] = [];
  const { board, turn, castling, epSquare } = state;
  const enemy = oppositeColor(turn);
  const promos: PromotionPiece[] = ['q', 'r', 'b', 'n'];

  for (let sq = 0; sq < 64; sq++) {
    const piece = board[sq];
    if (!piece || piece.color !== turn) continue;
    const { row, col } = sqToRowCol(sq);

    if (piece.type === 'p') {
      const dir = turn === 'w' ? -1 : 1;
      const startRow = turn === 'w' ? 6 : 1;
      const promoRow = turn === 'w' ? 0 : 7;

      // 1 step forward
      const oneRow = row + dir;
      if (oneRow >= 0 && oneRow < 8) {
        const oneSq = oneRow * 8 + col;
        if (!board[oneSq]) {
          if (oneRow === promoRow) {
            for (const promo of promos) {
              moves.push({ from: sq, to: oneSq, piece: 'p', color: turn, promotion: promo });
            }
          } else {
            moves.push({ from: sq, to: oneSq, piece: 'p', color: turn });
            // 2 steps from start rank
            if (row === startRow) {
              const twoRow = row + 2 * dir;
              const twoSq = twoRow * 8 + col;
              if (!board[twoSq]) {
                moves.push({
                  from: sq,
                  to: twoSq,
                  piece: 'p',
                  color: turn,
                  isDoublePush: true,
                });
              }
            }
          }
        }

        // Diagonal captures & en passant
        for (const dc of [-1, 1]) {
          const nc = col + dc;
          if (nc < 0 || nc >= 8) continue;
          const capSq = oneRow * 8 + nc;
          const target = board[capSq];
          if (target && target.color === enemy) {
            if (oneRow === promoRow) {
              for (const promo of promos) {
                moves.push({
                  from: sq,
                  to: capSq,
                  piece: 'p',
                  color: turn,
                  captured: target.type,
                  promotion: promo,
                });
              }
            } else {
              moves.push({
                from: sq,
                to: capSq,
                piece: 'p',
                color: turn,
                captured: target.type,
              });
            }
          } else if (epSquare !== null && capSq === epSquare) {
            const victimSq = row * 8 + nc;
            const victim = board[victimSq];
            if (victim && victim.color === enemy && victim.type === 'p') {
              moves.push({
                from: sq,
                to: capSq,
                piece: 'p',
                color: turn,
                captured: 'p',
                isEnPassant: true,
              });
            }
          }
        }
      }
    } else if (piece.type === 'n') {
      for (const [dr, dc] of KNIGHT_OFFSETS) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
        const to = nr * 8 + nc;
        const target = board[to];
        if (!target) {
          moves.push({ from: sq, to, piece: 'n', color: turn });
        } else if (target.color === enemy) {
          moves.push({ from: sq, to, piece: 'n', color: turn, captured: target.type });
        }
      }
    } else if (piece.type === 'b' || piece.type === 'r' || piece.type === 'q') {
      const dirs =
        piece.type === 'b'
          ? BISHOP_DIRS
          : piece.type === 'r'
            ? ROOK_DIRS
            : [...BISHOP_DIRS, ...ROOK_DIRS];
      for (const [dr, dc] of dirs) {
        let nr = row + dr;
        let nc = col + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const to = nr * 8 + nc;
          const target = board[to];
          if (!target) {
            moves.push({ from: sq, to, piece: piece.type, color: turn });
          } else {
            if (target.color === enemy) {
              moves.push({
                from: sq,
                to,
                piece: piece.type,
                color: turn,
                captured: target.type,
              });
            }
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
    } else if (piece.type === 'k') {
      for (const [dr, dc] of KING_OFFSETS) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
        const to = nr * 8 + nc;
        const target = board[to];
        if (!target) {
          moves.push({ from: sq, to, piece: 'k', color: turn });
        } else if (target.color === enemy) {
          moves.push({ from: sq, to, piece: 'k', color: turn, captured: target.type });
        }
      }

      // Castling
      if (turn === 'w' && sq === 60) {
        if (
          castling.wK &&
          !board[61] &&
          !board[62] &&
          board[63]?.color === 'w' &&
          board[63]?.type === 'r' &&
          !isSquareAttacked(board, 60, 'b') &&
          !isSquareAttacked(board, 61, 'b') &&
          !isSquareAttacked(board, 62, 'b')
        ) {
          moves.push({ from: 60, to: 62, piece: 'k', color: 'w', isCastle: 'K' });
        }
        if (
          castling.wQ &&
          !board[59] &&
          !board[58] &&
          !board[57] &&
          board[56]?.color === 'w' &&
          board[56]?.type === 'r' &&
          !isSquareAttacked(board, 60, 'b') &&
          !isSquareAttacked(board, 59, 'b') &&
          !isSquareAttacked(board, 58, 'b')
        ) {
          moves.push({ from: 60, to: 58, piece: 'k', color: 'w', isCastle: 'Q' });
        }
      } else if (turn === 'b' && sq === 4) {
        if (
          castling.bK &&
          !board[5] &&
          !board[6] &&
          board[7]?.color === 'b' &&
          board[7]?.type === 'r' &&
          !isSquareAttacked(board, 4, 'w') &&
          !isSquareAttacked(board, 5, 'w') &&
          !isSquareAttacked(board, 6, 'w')
        ) {
          moves.push({ from: 4, to: 6, piece: 'k', color: 'b', isCastle: 'K' });
        }
        if (
          castling.bQ &&
          !board[3] &&
          !board[2] &&
          !board[1] &&
          board[0]?.color === 'b' &&
          board[0]?.type === 'r' &&
          !isSquareAttacked(board, 4, 'w') &&
          !isSquareAttacked(board, 3, 'w') &&
          !isSquareAttacked(board, 2, 'w')
        ) {
          moves.push({ from: 4, to: 2, piece: 'k', color: 'b', isCastle: 'Q' });
        }
      }
    }
  }

  return moves;
}

export function applyMove(state: ChessState, move: ChessMove, trackHistory = true): ChessState {
  const board = state.board.slice();
  const castling = { ...state.castling };
  const moving = board[move.from]!;

  board[move.from] = null;
  board[move.to] = move.promotion
    ? { color: move.color, type: move.promotion }
    : { ...moving };

  if (move.isEnPassant) {
    const { row } = sqToRowCol(move.from);
    const { col } = sqToRowCol(move.to);
    board[row * 8 + col] = null;
  }

  if (move.isCastle === 'K') {
    if (move.color === 'w') {
      board[61] = board[63];
      board[63] = null;
    } else {
      board[5] = board[7];
      board[7] = null;
    }
  } else if (move.isCastle === 'Q') {
    if (move.color === 'w') {
      board[59] = board[56];
      board[56] = null;
    } else {
      board[3] = board[0];
      board[0] = null;
    }
  }

  // Update castling rights
  if (move.from === 60) {
    castling.wK = false;
    castling.wQ = false;
  } else if (move.from === 4) {
    castling.bK = false;
    castling.bQ = false;
  }
  if (move.from === 63 || move.to === 63) castling.wK = false;
  if (move.from === 56 || move.to === 56) castling.wQ = false;
  if (move.from === 7 || move.to === 7) castling.bK = false;
  if (move.from === 0 || move.to === 0) castling.bQ = false;

  let epSquare: number | null = null;
  if (move.isDoublePush) {
    const dir = move.color === 'w' ? -1 : 1;
    epSquare = move.from + dir * 8;
  }

  const halfmoveClock =
    move.piece === 'p' || move.captured !== undefined ? 0 : state.halfmoveClock + 1;
  const fullmoveNumber =
    state.turn === 'b' ? state.fullmoveNumber + 1 : state.fullmoveNumber;

  const nextState: ChessState = {
    board,
    turn: oppositeColor(state.turn),
    castling,
    epSquare,
    halfmoveClock,
    fullmoveNumber,
    positionCounts: trackHistory ? { ...state.positionCounts } : state.positionCounts,
    lastMove: move,
  };

  if (trackHistory) {
    const key = positionKey(nextState);
    nextState.positionCounts[key] = (nextState.positionCounts[key] ?? 0) + 1;
  }

  return nextState;
}

export function generateLegalMoves(state: ChessState): ChessMove[] {
  const pseudo = generatePseudoMoves(state);
  const legal: ChessMove[] = [];
  const mover = state.turn;
  const enemy = oppositeColor(mover);

  for (const m of pseudo) {
    const next = applyMove(state, m, false);
    const kingSq = findKingSquare(next.board, mover);
    if (kingSq !== -1 && !isSquareAttacked(next.board, kingSq, enemy)) {
      legal.push(m);
    }
  }
  return legal;
}

export function getLegalMovesFrom(state: ChessState, fromSq: number): ChessMove[] {
  return generateLegalMoves(state).filter((m) => m.from === fromSq);
}

export function perft(state: ChessState, depth: number): number {
  if (depth <= 0) return 1;
  const moves = generateLegalMoves(state);
  if (depth === 1) return moves.length;
  let total = 0;
  for (const m of moves) {
    total += perft(applyMove(state, m, false), depth - 1);
  }
  return total;
}

export function hasInsufficientMaterial(board: (ChessPiece | null)[]): boolean {
  const pieces: { color: ChessColor; type: PieceType; sq: number }[] = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.type !== 'k') {
      if (p.type === 'p' || p.type === 'r' || p.type === 'q') return false;
      pieces.push({ color: p.color, type: p.type, sq: i });
    }
  }
  if (pieces.length === 0) return true;
  if (pieces.length === 1) return true; // K+B vs K or K+N vs K
  if (pieces.length === 2 && pieces[0].type === 'b' && pieces[1].type === 'b') {
    const c0 = (Math.floor(pieces[0].sq / 8) + (pieces[0].sq % 8)) % 2;
    const c1 = (Math.floor(pieces[1].sq / 8) + (pieces[1].sq % 8)) % 2;
    return c0 === c1;
  }
  return false;
}

export function getGameStatus(state: ChessState): {
  status: ChessGameStatus;
  winner: ChessColor | null;
  reason: string;
} {
  const legal = generateLegalMoves(state);
  const inCheck = isInCheck(state, state.turn);

  if (legal.length === 0) {
    if (inCheck) {
      const winner = oppositeColor(state.turn);
      return {
        status: 'checkmate',
        winner,
        reason: `Jaque mate: ganan las ${winner === 'w' ? 'Blancas' : 'Negras'}.`,
      };
    }
    return {
      status: 'stalemate',
      winner: null,
      reason: 'Tablas por ahogado: el jugador al turno no tiene jugadas legales y no está en jaque.',
    };
  }

  if (state.halfmoveClock >= 100) {
    return {
      status: 'fifty_moves',
      winner: null,
      reason: 'Tablas por regla de los 50 movimientos sin capturas ni avances de peón.',
    };
  }

  const key = positionKey(state);
  if ((state.positionCounts[key] ?? 0) >= 3) {
    return {
      status: 'threefold',
      winner: null,
      reason: 'Tablas por triple repetición de la misma posición.',
    };
  }

  if (hasInsufficientMaterial(state.board)) {
    return {
      status: 'insufficient',
      winner: null,
      reason: 'Tablas por material insuficiente para dar jaque mate.',
    };
  }

  return { status: 'playing', winner: null, reason: '' };
}

export function moveToSpanishSAN(state: ChessState, move: ChessMove): string {
  const next = applyMove(state, move, false);
  const nextMoves = generateLegalMoves(next);
  const enemyInCheck = isInCheck(next, next.turn);
  const suffix = enemyInCheck ? (nextMoves.length === 0 ? '#' : '+') : '';

  if (move.isCastle === 'K') return `O-O${suffix}`;
  if (move.isCastle === 'Q') return `O-O-O${suffix}`;

  const toAlg = sqToAlgebraic(move.to);
  if (move.piece === 'p') {
    const fromFile = String.fromCharCode(97 + (move.from % 8));
    const capPart = move.captured ? `${fromFile}x` : '';
    const promoPart = move.promotion ? `=${PIECE_SAN_ES[move.promotion]}` : '';
    const epPart = move.isEnPassant ? ' a.p.' : '';
    return `${capPart}${toAlg}${promoPart}${suffix}${epPart}`;
  }

  const letter = PIECE_SAN_ES[move.piece];
  const legal = generateLegalMoves(state);
  const sameTarget = legal.filter(
    (m) =>
      m.piece === move.piece &&
      m.to === move.to &&
      m.from !== move.from
  );

  let disambig = '';
  if (sameTarget.length > 0) {
    const fromRC = sqToRowCol(move.from);
    const sameFile = sameTarget.some((m) => m.from % 8 === fromRC.col);
    const sameRank = sameTarget.some((m) => Math.floor(m.from / 8) === fromRC.row);
    if (!sameFile) {
      disambig = String.fromCharCode(97 + fromRC.col);
    } else if (!sameRank) {
      disambig = String(8 - fromRC.row);
    } else {
      disambig = sqToAlgebraic(move.from);
    }
  }

  const capPart = move.captured ? 'x' : '';
  return `${letter}${disambig}${capPart}${toAlg}${suffix}`;
}

export function evaluateStatic(state: ChessState): number {
  let score = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = state.board[sq];
    if (!p) continue;
    const val = PIECE_VALUES[p.type] + getPstBonus(p.type, p.color, sq);
    score += p.color === 'w' ? val : -val;
  }
  return state.turn === 'w' ? score : -score;
}

function orderMoves(state: ChessState, moves: ChessMove[], ttBestUci?: string): ChessMove[] {
  const scored = moves.map((m) => {
    let s = 0;
    if (ttBestUci && moveToUci(m) === ttBestUci) s += 100000;
    if (m.promotion) s += 8000 + PIECE_VALUES[m.promotion];
    if (m.captured) s += 5000 + PIECE_VALUES[m.captured] * 10 - PIECE_VALUES[m.piece];
    if (m.isCastle) s += 300;
    const { row, col } = sqToRowCol(m.to);
    if (row >= 2 && row <= 5 && col >= 2 && col <= 5) s += 25;
    if (state.board[m.to]) s += 10;
    return { m, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.m);
}

const MATE_SCORE = 100000;

function alphaBeta(
  state: ChessState,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  deadlineMs: number | null
): { score: number; bestMove: ChessMove | null; timedOut: boolean } {
  if (deadlineMs !== null && Date.now() >= deadlineMs) {
    return { score: 0, bestMove: null, timedOut: true };
  }

  const key = positionKey(state);
  if (ply > 0 && ((state.positionCounts[key] ?? 0) >= 3 || state.halfmoveClock >= 100 || hasInsufficientMaterial(state.board))) {
    return { score: 0, bestMove: null, timedOut: false };
  }

  const moves = generateLegalMoves(state);
  if (moves.length === 0) {
    if (isInCheck(state, state.turn)) {
      return { score: -MATE_SCORE + ply, bestMove: null, timedOut: false };
    }
    return { score: 0, bestMove: null, timedOut: false };
  }

  if (depth <= 0) {
    return { score: evaluateStatic(state), bestMove: null, timedOut: false };
  }

  const ordered = orderMoves(state, moves);
  let bestMove = ordered[0];
  let bestScore = -Infinity;

  for (const m of ordered) {
    const next = applyMove(state, m, ply < 2);
    const res = alphaBeta(next, depth - 1, -beta, -alpha, ply + 1, deadlineMs);
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

export function chooseChessBotMove(
  state: ChessState,
  options: ChessBotOptions
): { move: ChessMove; evalCp: number } {
  const legal = generateLegalMoves(state);
  if (legal.length === 0) {
    throw new Error('No legal chess moves available');
  }
  const rng = options.rng ?? Math.random;

  if (options.level === 0) {
    // Novice: depth 1 preferring captures, 25% random legal move
    if (rng() < 0.25) {
      const idx = Math.floor(rng() * legal.length);
      return { move: legal[idx], evalCp: 0 };
    }
    const res = alphaBeta(state, 1, -Infinity, Infinity, 0, null);
    return { move: res.bestMove ?? legal[0], evalCp: res.score };
  }

  if (options.level === 1) {
    // Club: alpha-beta depth 2
    const res = alphaBeta(state, 2, -Infinity, Infinity, 0, null);
    return { move: res.bestMove ?? legal[0], evalCp: res.score };
  }

  // Master: iterative deepening up to depth 4 within timeBudgetMs (default 700ms)
  const budget = options.timeBudgetMs ?? 700;
  const deadline = Date.now() + budget;
  let bestMove = orderMoves(state, legal)[0];
  let bestScore = 0;

  for (let d = 1; d <= 4; d++) {
    const res = alphaBeta(state, d, -Infinity, Infinity, 0, d >= 2 ? deadline : null);
    if (res.timedOut) break;
    if (res.bestMove) {
      bestMove = res.bestMove;
      bestScore = res.score;
    }
    if (Math.abs(bestScore) >= MATE_SCORE - 50) break;
  }

  return { move: bestMove, evalCp: bestScore };
}

const CENTER_SQUARES = new Set([27, 28, 35, 36]); // d5, e5, d4, e4

export function getCoachingHint(state: ChessState): ChessHint {
  const { move, evalCp } = chooseChessBotMove(state, { level: 1 });
  const san = moveToSpanishSAN(state, move);
  const next = applyMove(state, move, false);
  const nextMoves = generateLegalMoves(next);
  const givesCheck = isInCheck(next, next.turn);
  const isMate = givesCheck && nextMoves.length === 0;
  const enemy = oppositeColor(state.turn);
  const pieceLabel = PIECE_NAMES_ES[move.piece];
  const fromAlg = sqToAlgebraic(move.from);
  const toAlg = sqToAlgebraic(move.to);

  let reasonTag = 'posicion';
  let explanation = `${san} mejora la actividad y coordinación de tus piezas.`;

  if (isMate) {
    reasonTag = 'mate';
    explanation = `${san} es jaque mate: el rey rival no tiene casillas seguras y nadie puede capturar ni cubrir el ataque.`;
  } else if (move.captured) {
    const capVal = PIECE_POINTS[move.captured];
    const myVal = PIECE_POINTS[move.piece];
    const undefended = !isSquareAttacked(state.board, move.to, enemy);
    reasonTag = 'captura';
    if (undefended) {
      explanation = `${san} captura un ${PIECE_NAMES_ES[move.captured]} sin defensa (+${capVal} ${capVal === 1 ? 'peón' : 'puntos'}).`;
    } else if (capVal > myVal) {
      explanation = `${san} gana material cambiando una pieza de ${myVal} por una de ${capVal} puntos.`;
    } else {
      explanation = `${san} elimina un ${PIECE_NAMES_ES[move.captured]} activo en ${toAlg}.`;
    }
  } else if (
    move.piece !== 'k' &&
    move.piece !== 'p' &&
    isSquareAttacked(state.board, move.from, enemy) &&
    !isSquareAttacked(next.board, move.to, enemy)
  ) {
    reasonTag = 'salvar';
    explanation = `${san} pone a salvo tu ${pieceLabel} que estaba amenazado en ${fromAlg}.`;
  } else if (givesCheck) {
    reasonTag = 'jaque';
    explanation = `${san} da jaque al rey rival y obliga a responder perdiendo un tiempo.`;
  } else if (move.isCastle) {
    reasonTag = 'enroque';
    explanation = `${san} resguarda a tu rey en el flanco y conecta la torre hacia el centro.`;
  } else if (
    (move.piece === 'n' || move.piece === 'b') &&
    ((move.color === 'w' && Math.floor(move.from / 8) === 7) ||
      (move.color === 'b' && Math.floor(move.from / 8) === 0))
  ) {
    reasonTag = 'desarrollo';
    explanation = `${san} desarrolla tu ${pieceLabel} desde la fila inicial hacia casillas centrales.`;
  } else if (CENTER_SQUARES.has(move.to)) {
    reasonTag = 'centro';
    explanation = `${san} ocupa o controla una casilla clave del centro (${toAlg}).`;
  } else if (move.promotion) {
    reasonTag = 'promocion';
    explanation = `${san} corona tu peón y gana una pieza mayor en el tablero.`;
  }

  return { move, san, explanation, reasonTag, evalCp };
}

export function evaluateMoveBlunder(
  beforeState: ChessState,
  userMove: ChessMove
): { isBlunder: boolean; message: string } {
  const bestBefore = alphaBeta(beforeState, 2, -Infinity, Infinity, 0, null);
  const afterState = applyMove(beforeState, userMove, false);
  const bestReply = alphaBeta(afterState, 2, -Infinity, Infinity, 0, null);

  const scoreAfterUser = -bestReply.score;
  const dropCp = bestBefore.score - scoreAfterUser;

  if (dropCp >= 200) {
    const pieceName = PIECE_NAMES_ES[userMove.piece];
    const toAlg = sqToAlgebraic(userMove.to);
    const enemy = oppositeColor(userMove.color);
    const hungMoved =
      userMove.piece !== 'k' &&
      isSquareAttacked(afterState.board, userMove.to, enemy);

    if (hungMoved) {
      return {
        isBlunder: true,
        message: `Cuidado: tras ${moveToSpanishSAN(beforeState, userMove)}, tu ${pieceName} en ${toAlg} queda expuesto al ataque rival.`,
      };
    }
    return {
      isBlunder: true,
      message: `Cuidado: ${moveToSpanishSAN(beforeState, userMove)} cede ventaja importante (~${(dropCp / 100).toFixed(1)} peones). Puedes deshacer y buscar una jugada más segura.`,
    };
  }

  return { isBlunder: false, message: '' };
}

export function capturedMaterialByColor(board: (ChessPiece | null)[], capturerColor: ChessColor): number {
  const initialTotal = 8 * 1 + 2 * 3 + 2 * 3 + 2 * 5 + 9; // 39 points
  const victim = oppositeColor(capturerColor);
  let remaining = 0;
  for (const p of board) {
    if (p && p.color === victim && p.type !== 'k') {
      remaining += PIECE_POINTS[p.type];
    }
  }
  return Math.max(0, initialTotal - remaining);
}

export const CHESS_LESSONS: ChessLesson[] = [
  {
    id: 'pieces',
    title: 'Cómo se mueve cada pieza',
    summary: 'Recoge las estrellas objetivo con cada pieza para dominar sus desplazamientos.',
    steps: [
      {
        id: 'rook',
        title: 'La Torre',
        instruction: 'La torre avanza en línea recta horizontal o vertical. Captura ambas estrellas.',
        fen: '8/8/8/8/8/8/8/R3K3 w - - 0 1',
        mode: 'stars',
        stars: [algebraicToSq('a6'), algebraicToSq('f6')],
        successFeedback: 'Exacto: la torre recorre columnas y filas completas sin saltar piezas.',
        wrongHint: 'Mueve la torre en línea recta por la columna a hasta a6 y luego a f6.',
      },
      {
        id: 'bishop',
        title: 'El Alfil',
        instruction: 'El alfil solo se desplaza en diagonal y nunca cambia de color de casilla.',
        fen: '8/8/8/8/8/8/8/2B1K3 w - - 0 1',
        mode: 'stars',
        stars: [algebraicToSq('f4'), algebraicToSq('d6')],
        successFeedback: 'Bien hecho: cada alfil domina las diagonales de su propio color.',
        wrongHint: 'Traza diagonales desde c1 hacia f4 y luego hasta d6.',
      },
      {
        id: 'queen',
        title: 'La Dama',
        instruction: 'La dama combina torre y alfil: recta y diagonal en cualquier dirección.',
        fen: '8/8/8/8/8/8/8/3QK3 w - - 0 1',
        mode: 'stars',
        stars: [algebraicToSq('h5'), algebraicToSq('b5')],
        successFeedback: 'Dominio total: la dama es la pieza más versátil del tablero.',
        wrongHint: 'Avanza en diagonal a h5 y cruza en horizontal hasta b5.',
      },
      {
        id: 'knight',
        title: 'El Caballo',
        instruction: 'El caballo salta en forma de "L" (2×1) y puede pasar por encima de otras piezas.',
        fen: '8/8/8/8/8/8/PPPP4/1N2K3 w - - 0 1',
        mode: 'stars',
        stars: [algebraicToSq('c3'), algebraicToSq('e4')],
        successFeedback: 'Perfecto: el caballo es la única pieza capaz de saltar sobre peones.',
        wrongHint: 'Salta desde b1 hasta c3 y luego a e4 en forma de L.',
      },
      {
        id: 'king',
        title: 'El Rey',
        instruction: 'El rey mueve una sola casilla en cualquier dirección. Llévalo a las estrellas.',
        fen: '8/8/8/8/4K3/8/8/8 w - - 0 1',
        mode: 'stars',
        stars: [algebraicToSq('f5'), algebraicToSq('e6')],
        successFeedback: 'Correcto: el rey es lento, pero en los finales participa activamente.',
        wrongHint: 'Da un paso en diagonal a f5 y luego otro a e6.',
      },
      {
        id: 'pawn',
        title: 'El Peón',
        instruction: 'El peón avanza hacia adelante (2 pasos al inicio) y captura en diagonal.',
        fen: '8/8/8/4p3/8/8/3P4/4K3 w - - 0 1',
        mode: 'stars',
        stars: [algebraicToSq('d4'), algebraicToSq('e5')],
        successFeedback: 'Excelente: avanzaste dos pasos desde la casilla inicial y capturaste en diagonal.',
        wrongHint: 'Desde d2 puedes avanzar directo a d4 y luego capturar en e5.',
      },
    ],
  },
  {
    id: 'check',
    title: 'Jaque: tres formas de salir',
    summary: 'Cuando tu rey está en jaque puedes moverlo, bloquear el rayo o capturar al atacante.',
    steps: [
      {
        id: 'escape-king',
        title: '1. Mover el rey',
        instruction: 'El caballo negro da jaque al rey blanco. Como el caballo salta, no se puede bloquear: mueve el rey a salvo.',
        fen: '4k3/8/8/8/8/5n2/8/4K3 w - - 0 1',
        mode: 'find_best',
        acceptedUci: ['e1d1', 'e1f1', 'e1e2', 'e1f2'],
        successFeedback: 'Correcto: ante un jaque de caballo que no puedes capturar, debes mover el rey.',
        wrongHint: 'Elige una casilla segura alrededor del rey blanco en e1 (cuidado con d2, que está vigilada por el caballo).',
      },
      {
        id: 'block-check',
        title: '2. Bloquear el ataque',
        instruction: 'La torre negra da jaque por la columna e y el rey no tiene casillas. Interpón tu caballo en e4 (apoyado por el peón de d3).',
        fen: '4k3/8/8/4r3/8/2NP4/3P1P2/3RKB2 w - - 0 1',
        mode: 'find_best',
        acceptedUci: ['c3e4'],
        successFeedback: 'Muy bien: Ce4 bloquea el rayo de la torre y queda defendido por tu peón de d3.',
        wrongHint: 'El rey está encerrado: salta con el caballo de c3 a e4 para cortar el jaque.',
      },
      {
        id: 'capture-checker',
        title: '3. Capturar al atacante',
        instruction: 'La dama negra da jaque desde h4 por la diagonal. Elimina la amenaza capturándola con tu caballo.',
        fen: '4k3/8/8/8/7q/5N2/3PP1PP/4K3 w - - 0 1',
        mode: 'find_best',
        acceptedUci: ['f3h4'],
        successFeedback: 'Brillante (Cxh4): cuando puedes capturar con ganancia a la pieza que da jaque, eliminas el peligro de raíz.',
        wrongHint: 'Tu caballo en f3 salta en L hasta h4 y captura la dama rival.',
      },
    ],
  },
  {
    id: 'special',
    title: 'Jugadas especiales',
    summary: 'Practica el enroque, la coronación de peón y la captura al paso.',
    steps: [
      {
        id: 'castle-short',
        title: 'Enroque corto',
        instruction: 'Ni tu rey ni la torre de h1 se han movido y el camino está libre. Mueve el rey dos casillas hacia g1.',
        fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        mode: 'find_best',
        acceptedUci: ['e1g1'],
        successFeedback: 'Enroque completado (O-O): tu rey queda protegido y la torre entra al juego.',
        wrongHint: 'Haz clic en el rey blanco (e1) y luego en g1 para enrocar en corto.',
      },
      {
        id: 'promotion',
        title: 'Coronación',
        instruction: 'Tu peón en e7 alcanza la última fila. Avánzalo a e8 y elige coronar en Dama.',
        fen: '6k1/4P3/8/8/8/8/8/4K3 w - - 0 1',
        mode: 'find_best',
        acceptedUci: ['e7e8q', 'e7e8r', 'e7e8b', 'e7e8n'],
        successFeedback: 'Coronaste tu peón: al llegar a la octava fila puedes transformarlo en Dama, Torre, Alfil o Caballo.',
        wrongHint: 'Empuja el peón de e7 a e8 y selecciona la pieza a coronar (Dama recomendada).',
      },
      {
        id: 'en-passant',
        title: 'Captura al paso',
        instruction: 'El peón negro acaba de avanzar dos casillas de d7 a d5. Captúralo al paso moviendo tu peón de e5 a d6.',
        fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
        mode: 'find_best',
        acceptedUci: ['e5d6'],
        successFeedback: 'Exacto (exd6 a.p.): la captura al paso solo está disponible en el turno inmediatamente posterior al salto doble.',
        wrongHint: 'Selecciona tu peón en e5 y muévelo en diagonal hacia la casilla vacía d6.',
      },
    ],
  },
  {
    id: 'mates',
    title: 'Mates básicos',
    summary: 'Remata 4 mates en una jugada y practica el final guiado de Rey y Dama.',
    steps: [
      {
        id: 'back-rank',
        title: 'Mate del pasillo',
        instruction: 'Los propios peones negros encierran a su rey en la octava fila. Da mate con tu torre en d8.',
        fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
        mode: 'find_best',
        acceptedUci: ['d1d8'],
        successFeedback: 'Jaque mate del pasillo (Td8#): los peones impiden que el rey escape hacia la séptima fila.',
        wrongHint: 'Lleva la torre blanca de d1 hasta la octava fila en d8.',
      },
      {
        id: 'supported-queen',
        title: 'Dama apoyada',
        instruction: 'Tu alfil en c4 apunta a f7. Entra con tu dama en f7 para dar jaque mate sin que el rey pueda capturarla.',
        fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
        mode: 'find_best',
        acceptedUci: ['f3f7'],
        successFeedback: 'Mate del pastor (Dxf7#): el rey no puede capturar la dama porque el alfil de c4 la defiende.',
        wrongHint: 'Mueve la dama de f3 a f7.',
      },
      {
        id: 'two-rooks',
        title: 'Escalera de dos torres',
        instruction: 'La torre de g7 corta la séptima fila. Sube la otra torre a h8 para sellar el mate.',
        fen: '5k2/6R1/8/8/8/8/8/4K2R w - - 0 1',
        mode: 'find_best',
        acceptedUci: ['h1h8'],
        successFeedback: 'Mate de la escalera (Th8#): una torre corta la fila 7 y la otra da mate en la fila 8.',
        wrongHint: 'Sube la torre de h1 hasta h8.',
      },
      {
        id: 'queen-knight',
        title: 'Caballo + Dama',
        instruction: 'Tu caballo en g5 apoya la casilla h7 y f7. Da mate inmediato con la dama en h7.',
        fen: 'r4rk1/pbpn1ppp/1p6/3pP1N1/8/2PQ4/PP3PPP/R3K2R w KQ - 0 1',
        mode: 'find_best',
        acceptedUci: ['d3h7'],
        successFeedback: 'Mate en h7 (Dxh7#): el caballo en g5 sostiene a la dama y cierra las fugas.',
        wrongHint: 'Lleva la dama de d3 en diagonal hasta h7.',
      },
      {
        id: 'kq-vs-k',
        title: 'Final: Rey + Dama vs Rey',
        instruction: 'Empuja al rey negro hacia un borde usando la dama a salto de caballo y acerca tu rey para dar jaque mate.',
        fen: '8/8/8/4k3/8/8/3Q4/4K3 w - - 0 1',
        mode: 'mate_endgame',
        successFeedback: 'Final superado: acorralaste al rey rival y remataste con Rey y Dama.',
        wrongHint: 'Acerca tu rey hacia el centro y corta casillas al rey negro con la dama sin ahogarlo.',
      },
    ],
  },
];
