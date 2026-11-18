export type Suit = 's' | 'h' | 'd' | 'c';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type HandCategory = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface EvaluatedHand {
  category: HandCategory;
  name: string;
  score: number;
  tiebreakers: number[];
  bestFive: Card[];
}

export interface HandGuideEntry {
  category: HandCategory;
  id: string;
  name: string;
  description: string;
  exampleCards: Card[];
}

export type BotPersonality = 'prudente' | 'equilibrado' | 'agresiva';
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface PokerPlayer {
  seat: number;
  id: string;
  name: string;
  personality: BotPersonality | 'human';
  isHuman: boolean;
  chips: number;
  holeCards: Card[];
  betThisStreet: number;
  totalInPot: number;
  folded: boolean;
  allIn: boolean;
  actedThisStreet: boolean;
  lastAction: string;
}

export interface PokerAction {
  type: 'fold' | 'check' | 'call' | 'raise';
  raiseTo?: number; // total bet on current street
}

export interface PotWinner {
  seat: number;
  name: string;
  amount: number;
  handName: string;
}

export interface PokerHandState {
  handNumber: number;
  dealerSeat: number;
  street: Street;
  deck: Card[];
  community: Card[];
  pot: number;
  currentBet: number;
  minRaiseIncrement: number;
  actingSeat: number | null;
  players: PokerPlayer[];
  winners: PotWinner[];
  log: string[];
  smallBlind: number;
  bigBlind: number;
}

export interface OutsAnalysis {
  totalOuts: number;
  cards: Card[];
  summary: string;
  rule24Pct: number;
}

export interface PokerAdvice {
  equityPct: number;
  potOddsPct: number;
  recommendedAction: 'Pasar' | 'Igualar' | 'Subir' | 'Retirarse';
  explanation: string;
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

export const SUITS: readonly Suit[] = ['s', 'h', 'd', 'c'];
export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const HAND_NAMES_ES: Record<HandCategory, string> = {
  9: 'Escalera Real',
  8: 'Escalera de Color',
  7: 'Póker',
  6: 'Full',
  5: 'Color',
  4: 'Escalera',
  3: 'Trío',
  2: 'Doble Pareja',
  1: 'Pareja',
  0: 'Carta Alta',
};

export function rankShortLabel(rank: Rank): string {
  switch (rank) {
    case 14:
      return 'A';
    case 13:
      return 'K';
    case 12:
      return 'Q';
    case 11:
      return 'J';
    default:
      return String(rank);
  }
}

export function suitNameEs(suit: Suit): string {
  switch (suit) {
    case 's':
      return 'Picas';
    case 'h':
      return 'Corazones';
    case 'd':
      return 'Diamantes';
    case 'c':
      return 'Tréboles';
  }
}

export function cardKey(c: Card): string {
  return `${c.rank}${c.suit}`;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[], rng: () => number = Math.random): Card[] {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function packScore(category: HandCategory, tiebreakers: number[]): number {
  let s = category;
  for (let i = 0; i < 5; i++) {
    s = s * 15 + (tiebreakers[i] ?? 0);
  }
  return s;
}

export function evaluateFiveCards(cards: Card[]): EvaluatedHand {
  if (cards.length !== 5) {
    throw new Error('evaluateFiveCards requires exactly 5 cards');
  }
  const sorted = cards.slice().sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank);
  const isFlush = sorted.every((c) => c.suit === sorted[0].suit);

  // Straight check (normal & wheel A-2-3-4-5)
  let straightHigh = 0;
  if (
    ranks[0] - 1 === ranks[1] &&
    ranks[1] - 1 === ranks[2] &&
    ranks[2] - 1 === ranks[3] &&
    ranks[3] - 1 === ranks[4]
  ) {
    straightHigh = ranks[0];
  } else if (
    ranks[0] === 14 &&
    ranks[1] === 5 &&
    ranks[2] === 4 &&
    ranks[3] === 3 &&
    ranks[4] === 2
  ) {
    straightHigh = 5;
  }

  if (isFlush && straightHigh > 0) {
    const category: HandCategory = straightHigh === 14 ? 9 : 8;
    const tb = [straightHigh, 0, 0, 0, 0];
    return {
      category,
      name: HAND_NAMES_ES[category],
      score: packScore(category, tb),
      tiebreakers: tb,
      bestFive: sorted,
    };
  }

  const countsMap = new Map<number, number>();
  for (const r of ranks) {
    countsMap.set(r, (countsMap.get(r) ?? 0) + 1);
  }
  const groups = Array.from(countsMap.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  if (groups[0][1] === 4) {
    const tb = [groups[0][0], groups[1][0], 0, 0, 0];
    return {
      category: 7,
      name: HAND_NAMES_ES[7],
      score: packScore(7, tb),
      tiebreakers: tb,
      bestFive: sorted,
    };
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    const tb = [groups[0][0], groups[1][0], 0, 0, 0];
    return {
      category: 6,
      name: HAND_NAMES_ES[6],
      score: packScore(6, tb),
      tiebreakers: tb,
      bestFive: sorted,
    };
  }

  if (isFlush) {
    return {
      category: 5,
      name: HAND_NAMES_ES[5],
      score: packScore(5, ranks),
      tiebreakers: ranks,
      bestFive: sorted,
    };
  }

  if (straightHigh > 0) {
    const tb = [straightHigh, 0, 0, 0, 0];
    return {
      category: 4,
      name: HAND_NAMES_ES[4],
      score: packScore(4, tb),
      tiebreakers: tb,
      bestFive: sorted,
    };
  }

  if (groups[0][1] === 3) {
    const tb = [groups[0][0], groups[1][0], groups[2][0], 0, 0];
    return {
      category: 3,
      name: HAND_NAMES_ES[3],
      score: packScore(3, tb),
      tiebreakers: tb,
      bestFive: sorted,
    };
  }

  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const tb = [groups[0][0], groups[1][0], groups[2][0], 0, 0];
    return {
      category: 2,
      name: HAND_NAMES_ES[2],
      score: packScore(2, tb),
      tiebreakers: tb,
      bestFive: sorted,
    };
  }

  if (groups[0][1] === 2) {
    const tb = [groups[0][0], groups[1][0], groups[2][0], groups[3][0], 0];
    return {
      category: 1,
      name: HAND_NAMES_ES[1],
      score: packScore(1, tb),
      tiebreakers: tb,
      bestFive: sorted,
    };
  }

  return {
    category: 0,
    name: HAND_NAMES_ES[0],
    score: packScore(0, ranks),
    tiebreakers: ranks,
    bestFive: sorted,
  };
}

export function evaluateHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    // Partial hand (e.g. preflop 2 hole cards) for live guide highlighting
    const sorted = cards.slice().sort((a, b) => b.rank - a.rank);
    if (sorted.length === 2 && sorted[0].rank === sorted[1].rank) {
      const tb = [sorted[0].rank, 0, 0, 0, 0];
      return {
        category: 1,
        name: HAND_NAMES_ES[1],
        score: packScore(1, tb),
        tiebreakers: tb,
        bestFive: sorted,
      };
    }
    const tb: number[] = sorted.map((c) => c.rank);
    while (tb.length < 5) tb.push(0);
    return {
      category: 0,
      name: HAND_NAMES_ES[0],
      score: packScore(0, tb),
      tiebreakers: tb,
      bestFive: sorted,
    };
  }

  if (cards.length === 5) {
    return evaluateFiveCards(cards);
  }

  let best: EvaluatedHand | null = null;
  const n = cards.length;
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const ev = evaluateFiveCards([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || ev.score > best.score) {
              best = ev;
            }
          }
        }
      }
    }
  }
  return best!;
}

export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.score > b.score) return 1;
  if (a.score < b.score) return -1;
  return 0;
}

export const HAND_GUIDE: HandGuideEntry[] = [
  {
    category: 9,
    id: 'royal-flush',
    name: 'Escalera Real',
    description: 'A-K-Q-J-10 del mismo palo. La mano invencible.',
    exampleCards: [
      { rank: 14, suit: 's' },
      { rank: 13, suit: 's' },
      { rank: 12, suit: 's' },
      { rank: 11, suit: 's' },
      { rank: 10, suit: 's' },
    ],
  },
  {
    category: 8,
    id: 'straight-flush',
    name: 'Escalera de Color',
    description: 'Cinco cartas seguidas del mismo palo.',
    exampleCards: [
      { rank: 9, suit: 'h' },
      { rank: 8, suit: 'h' },
      { rank: 7, suit: 'h' },
      { rank: 6, suit: 'h' },
      { rank: 5, suit: 'h' },
    ],
  },
  {
    category: 7,
    id: 'four-kind',
    name: 'Póker',
    description: 'Cuatro cartas del mismo valor y una acompañante.',
    exampleCards: [
      { rank: 13, suit: 's' },
      { rank: 13, suit: 'h' },
      { rank: 13, suit: 'd' },
      { rank: 13, suit: 'c' },
      { rank: 9, suit: 's' },
    ],
  },
  {
    category: 6,
    id: 'full-house',
    name: 'Full',
    description: 'Un trío combinado con una pareja.',
    exampleCards: [
      { rank: 12, suit: 's' },
      { rank: 12, suit: 'h' },
      { rank: 12, suit: 'd' },
      { rank: 7, suit: 'c' },
      { rank: 7, suit: 's' },
    ],
  },
  {
    category: 5,
    id: 'flush',
    name: 'Color',
    description: 'Cinco cartas del mismo palo sin ser consecutivas.',
    exampleCards: [
      { rank: 14, suit: 'd' },
      { rank: 11, suit: 'd' },
      { rank: 8, suit: 'd' },
      { rank: 4, suit: 'd' },
      { rank: 2, suit: 'd' },
    ],
  },
  {
    category: 4,
    id: 'straight',
    name: 'Escalera',
    description: 'Cinco valores seguidos (incluye A-2-3-4-5).',
    exampleCards: [
      { rank: 10, suit: 'c' },
      { rank: 9, suit: 's' },
      { rank: 8, suit: 'h' },
      { rank: 7, suit: 'd' },
      { rank: 6, suit: 'c' },
    ],
  },
  {
    category: 3,
    id: 'three-kind',
    name: 'Trío',
    description: 'Tres cartas del mismo valor más dos desempates.',
    exampleCards: [
      { rank: 11, suit: 's' },
      { rank: 11, suit: 'h' },
      { rank: 11, suit: 'c' },
      { rank: 14, suit: 'd' },
      { rank: 5, suit: 's' },
    ],
  },
  {
    category: 2,
    id: 'two-pair',
    name: 'Doble Pareja',
    description: 'Dos parejas diferentes y una carta de desempate.',
    exampleCards: [
      { rank: 10, suit: 's' },
      { rank: 10, suit: 'd' },
      { rank: 6, suit: 'h' },
      { rank: 6, suit: 'c' },
      { rank: 14, suit: 's' },
    ],
  },
  {
    category: 1,
    id: 'one-pair',
    name: 'Pareja',
    description: 'Dos cartas del mismo valor y tres desempates.',
    exampleCards: [
      { rank: 14, suit: 'h' },
      { rank: 14, suit: 'c' },
      { rank: 12, suit: 's' },
      { rank: 9, suit: 'd' },
      { rank: 4, suit: 'h' },
    ],
  },
  {
    category: 0,
    id: 'high-card',
    name: 'Carta Alta',
    description: 'Si nadie liga jugada, gana la carta más alta.',
    exampleCards: [
      { rank: 14, suit: 's' },
      { rank: 12, suit: 'd' },
      { rank: 9, suit: 'c' },
      { rank: 6, suit: 'h' },
      { rank: 3, suit: 's' },
    ],
  },
];

export function estimateEquity(
  holeCards: Card[],
  communityCards: Card[],
  activeOpponents: number,
  simulations = 600,
  rng: () => number = Math.random
): number {
  if (holeCards.length !== 2) return 0.5;
  if (activeOpponents <= 0) return 1;

  const usedKeys = new Set([...holeCards, ...communityCards].map(cardKey));
  const unseen = createDeck().filter((c) => !usedKeys.has(cardKey(c)));
  const needBoard = 5 - communityCards.length;
  const needTotal = needBoard + activeOpponents * 2;

  let wins = 0;
  const pool = unseen.slice();

  for (let sim = 0; sim < simulations; sim++) {
    // Partial Fisher-Yates for only `needTotal` slots
    for (let i = 0; i < needTotal; i++) {
      const j = i + Math.floor(rng() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const board = communityCards.concat(pool.slice(0, needBoard));
    const heroEval = evaluateHand(holeCards.concat(board));

    let heroBest = true;
    let tieCount = 1;

    for (let opp = 0; opp < activeOpponents; opp++) {
      const idx = needBoard + opp * 2;
      const oppEval = evaluateHand([pool[idx], pool[idx + 1], ...board]);
      if (oppEval.score > heroEval.score) {
        heroBest = false;
        break;
      } else if (oppEval.score === heroEval.score) {
        tieCount++;
      }
    }

    if (heroBest) {
      wins += 1 / tieCount;
    }
  }

  return wins / simulations;
}

export function calculateOuts(holeCards: Card[], communityCards: Card[]): OutsAnalysis {
  if (holeCards.length !== 2 || communityCards.length < 3 || communityCards.length >= 5) {
    return { totalOuts: 0, cards: [], summary: 'Los outs se calculan en Flop o Turn.', rule24Pct: 0 };
  }

  const allKnown = holeCards.concat(communityCards);
  const current = evaluateHand(allKnown);
  const usedKeys = new Set(allKnown.map(cardKey));
  const unseen = createDeck().filter((c) => !usedKeys.has(cardKey(c)));

  const outCards: Card[] = [];
  let flushImprove = 0;
  let straightImprove = 0;
  let pairOrSetImprove = 0;

  for (const c of unseen) {
    const next = evaluateHand(allKnown.concat(c));
    if (next.category > current.category) {
      outCards.push(c);
      if (next.category === 5 || next.category === 8 || next.category === 9) {
        flushImprove++;
      } else if (next.category === 4) {
        straightImprove++;
      } else {
        pairOrSetImprove++;
      }
    } else if (
      current.category === 0 &&
      next.category === 1 &&
      (c.rank === holeCards[0].rank || c.rank === holeCards[1].rank)
    ) {
      outCards.push(c);
      pairOrSetImprove++;
    }
  }

  const mult = communityCards.length === 3 ? 4 : 2;
  const rule24Pct = Math.min(99, outCards.length * mult);
  const parts: string[] = [];
  if (flushImprove > 0) parts.push(`Color (${flushImprove})`);
  if (straightImprove > 0) parts.push(`Escalera (${straightImprove})`);
  if (pairOrSetImprove > 0) parts.push(`Pareja/Doble/Trío (${pairOrSetImprove})`);

  const summary =
    outCards.length > 0
      ? `${outCards.length} cartas mejoran tu jugada: ${parts.join(', ')}. Regla del ${mult}: ~${rule24Pct}% de ligar.`
      : 'No hay cartas evidentes que suban de categoría; confías en el valor actual o en farol.';

  return {
    totalOuts: outCards.length,
    cards: outCards,
    summary,
    rule24Pct,
  };
}

export function createInitialPokerPlayers(): PokerPlayer[] {
  return [
    {
      seat: 0,
      id: 'human',
      name: 'Tú',
      personality: 'human',
      isHuman: true,
      chips: 1000,
      holeCards: [],
      betThisStreet: 0,
      totalInPot: 0,
      folded: false,
      allIn: false,
      actedThisStreet: false,
      lastAction: '',
    },
    {
      seat: 1,
      id: 'lucia',
      name: 'Lucía (Prudente)',
      personality: 'prudente',
      isHuman: false,
      chips: 1000,
      holeCards: [],
      betThisStreet: 0,
      totalInPot: 0,
      folded: false,
      allIn: false,
      actedThisStreet: false,
      lastAction: '',
    },
    {
      seat: 2,
      id: 'mateo',
      name: 'Mateo (Equilibrado)',
      personality: 'equilibrado',
      isHuman: false,
      chips: 1000,
      holeCards: [],
      betThisStreet: 0,
      totalInPot: 0,
      folded: false,
      allIn: false,
      actedThisStreet: false,
      lastAction: '',
    },
    {
      seat: 3,
      id: 'sofia',
      name: 'Sofía (Agresiva)',
      personality: 'agresiva',
      isHuman: false,
      chips: 1000,
      holeCards: [],
      betThisStreet: 0,
      totalInPot: 0,
      folded: false,
      allIn: false,
      actedThisStreet: false,
      lastAction: '',
    },
  ];
}

function nextActiveSeat(players: PokerPlayer[], fromSeat: number): number | null {
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromSeat + offset) % n;
    const p = players[idx];
    if (p.chips > 0 || p.totalInPot > 0) {
      if (!p.folded && !p.allIn && p.chips > 0) return idx;
    }
  }
  return null;
}

function nextSeatWithChips(players: PokerPlayer[], fromSeat: number): number {
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromSeat + offset) % n;
    if (players[idx].chips > 0) return idx;
  }
  return 0;
}

export function startPokerHand(
  prevPlayers: PokerPlayer[],
  handNumber: number,
  dealerSeat: number,
  rng: () => number = Math.random
): PokerHandState {
  const deck = shuffleDeck(createDeck(), rng);
  let cursor = 0;
  const smallBlind = 10;
  const bigBlind = 20;

  const players: PokerPlayer[] = prevPlayers.map((p) => {
    const bust = p.chips <= 0;
    return {
      ...p,
      holeCards: bust ? [] : [deck[cursor++], deck[cursor++]],
      betThisStreet: 0,
      totalInPot: 0,
      folded: bust,
      allIn: false,
      actedThisStreet: false,
      lastAction: bust ? 'Eliminado' : '',
    };
  });

  const aliveCount = players.filter((p) => !p.folded).length;
  if (aliveCount < 2) {
    return {
      handNumber,
      dealerSeat,
      street: 'showdown',
      deck: deck.slice(cursor),
      community: [],
      pot: 0,
      currentBet: 0,
      minRaiseIncrement: bigBlind,
      actingSeat: null,
      players,
      winners: [],
      log: ['Mesa finalizada.'],
      smallBlind,
      bigBlind,
    };
  }

  const sbSeat = aliveCount === 2 ? dealerSeat : nextSeatWithChips(players, dealerSeat);
  const bbSeat = nextSeatWithChips(players, sbSeat);

  const postBlind = (seat: number, amount: number, label: string): number => {
    const p = players[seat];
    const paid = Math.min(p.chips, amount);
    p.chips -= paid;
    p.betThisStreet = paid;
    p.totalInPot = paid;
    if (p.chips === 0) p.allIn = true;
    p.lastAction = `${label} ${paid}`;
    return paid;
  };

  const sbPaid = postBlind(sbSeat, smallBlind, 'Ciega pequeña');
  const bbPaid = postBlind(bbSeat, bigBlind, 'Ciega grande');
  const pot = sbPaid + bbPaid;
  const currentBet = Math.max(sbPaid, bbPaid);
  const actingSeat = nextActiveSeat(players, bbSeat);

  return {
    handNumber,
    dealerSeat,
    street: 'preflop',
    deck: deck.slice(cursor),
    community: [],
    pot,
    currentBet,
    minRaiseIncrement: bigBlind,
    actingSeat,
    players,
    winners: [],
    log: [
      `Mano #${handNumber}: ${players[sbSeat].name} pone ciega ${sbPaid}, ${players[bbSeat].name} pone ${bbPaid}.`,
    ],
    smallBlind,
    bigBlind,
  };
}

function settleShowdown(state: PokerHandState): PokerHandState {
  const players = state.players.map((p) => ({ ...p }));
  let community = state.community.slice();
  const deck = state.deck.slice();

  const contenders = players.filter((p) => !p.folded);
  if (contenders.length === 1) {
    const solo = contenders[0];
    solo.chips += state.pot;
    return {
      ...state,
      street: 'showdown',
      actingSeat: null,
      players,
      winners: [
        {
          seat: solo.seat,
          name: solo.name,
          amount: state.pot,
          handName: 'Todos se retiraron',
        },
      ],
      log: [...state.log, `${solo.name} gana ${state.pot} fichas porque nadie igualó.`],
    };
  }

  // Deal remaining community cards if all-in early
  while (community.length < 5 && deck.length > 0) {
    community.push(deck.shift()!);
  }

  // Evaluate all non-folded hands
  const evals = new Map<number, EvaluatedHand>();
  for (const p of contenders) {
    evals.set(p.seat, evaluateHand(p.holeCards.concat(community)));
  }

  // Side-pot distribution by contribution levels
  const levels = Array.from(new Set(players.map((p) => p.totalInPot).filter((v) => v > 0))).sort(
    (a, b) => a - b
  );

  const wonAmounts = new Map<number, number>();
  let prevLevel = 0;

  for (const lvl of levels) {
    const slicePerPlayer = lvl - prevLevel;
    let slicePot = 0;
    for (const p of players) {
      if (p.totalInPot > prevLevel) {
        slicePot += Math.min(slicePerPlayer, p.totalInPot - prevLevel);
      }
    }
    prevLevel = lvl;
    if (slicePot <= 0) continue;

    const eligible = contenders.filter((p) => p.totalInPot >= lvl);
    if (eligible.length === 0) continue;

    let bestScore = -1;
    let bestSeats: number[] = [];
    for (const p of eligible) {
      const sc = evals.get(p.seat)!.score;
      if (sc > bestScore) {
        bestScore = sc;
        bestSeats = [p.seat];
      } else if (sc === bestScore) {
        bestSeats.push(p.seat);
      }
    }

    const share = Math.floor(slicePot / bestSeats.length);
    let rem = slicePot - share * bestSeats.length;
    for (const s of bestSeats) {
      const bonus = rem > 0 ? 1 : 0;
      if (rem > 0) rem--;
      wonAmounts.set(s, (wonAmounts.get(s) ?? 0) + share + bonus);
    }
  }

  const winners: PotWinner[] = [];
  const winLogs: string[] = [];
  for (const [seat, amount] of wonAmounts.entries()) {
    const p = players[seat];
    p.chips += amount;
    const handName = evals.get(seat)!.name;
    winners.push({ seat, name: p.name, amount, handName });
    winLogs.push(`${p.name} gana ${amount} fichas con ${handName}.`);
  }

  return {
    ...state,
    street: 'showdown',
    deck,
    community,
    actingSeat: null,
    players,
    winners,
    log: [...state.log, ...winLogs],
  };
}

function advanceStreet(state: PokerHandState): PokerHandState {
  if (state.street === 'river') {
    return settleShowdown(state);
  }

  const deck = state.deck.slice();
  const community = state.community.slice();
  let nextStreet: Street = 'flop';

  if (state.street === 'preflop') {
    nextStreet = 'flop';
    community.push(deck.shift()!, deck.shift()!, deck.shift()!);
  } else if (state.street === 'flop') {
    nextStreet = 'turn';
    community.push(deck.shift()!);
  } else if (state.street === 'turn') {
    nextStreet = 'river';
    community.push(deck.shift()!);
  }

  const players = state.players.map((p) => ({
    ...p,
    betThisStreet: 0,
    actedThisStreet: false,
    lastAction: p.folded ? 'Retirado' : p.allIn ? 'All-in' : '',
  }));

  const canActCount = players.filter((p) => !p.folded && !p.allIn && p.chips > 0).length;
  if (canActCount <= 1) {
    // Run out remaining community cards to showdown
    return settleShowdown({
      ...state,
      street: nextStreet,
      deck,
      community,
      currentBet: 0,
      minRaiseIncrement: state.bigBlind,
      players,
    });
  }

  const actingSeat = nextActiveSeat(players, state.dealerSeat);
  const streetTitle = nextStreet === 'flop' ? 'Flop' : nextStreet === 'turn' ? 'Turn' : 'River';

  return {
    ...state,
    street: nextStreet,
    deck,
    community,
    currentBet: 0,
    minRaiseIncrement: state.bigBlind,
    actingSeat,
    players,
    log: [...state.log, `Se abre el ${streetTitle}.`],
  };
}

export function getLegalPokerOptions(state: PokerHandState): {
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
  canFold: boolean;
} {
  if (state.actingSeat === null || state.street === 'showdown') {
    return {
      canCheck: false,
      canCall: false,
      callAmount: 0,
      canRaise: false,
      minRaiseTo: 0,
      maxRaiseTo: 0,
      canFold: false,
    };
  }
  const p = state.players[state.actingSeat];
  const toCall = Math.max(0, state.currentBet - p.betThisStreet);
  const canCheck = toCall === 0;
  const canCall = toCall > 0 && p.chips > 0;
  const callAmount = Math.min(toCall, p.chips);
  const maxRaiseTo = p.betThisStreet + p.chips;
  const minRaiseTo = Math.min(
    maxRaiseTo,
    state.currentBet === 0 ? state.bigBlind : state.currentBet + state.minRaiseIncrement
  );
  const canRaise = p.chips > toCall && maxRaiseTo > state.currentBet;

  return {
    canCheck,
    canCall,
    callAmount,
    canRaise,
    minRaiseTo,
    maxRaiseTo,
    canFold: true,
  };
}

export function applyPokerAction(state: PokerHandState, action: PokerAction): PokerHandState {
  if (state.actingSeat === null || state.street === 'showdown') {
    return state;
  }

  const players = state.players.map((p) => ({ ...p }));
  const actor = players[state.actingSeat];
  let pot = state.pot;
  let currentBet = state.currentBet;
  let minRaiseIncrement = state.minRaiseIncrement;
  const log = state.log.slice();

  const toCall = Math.max(0, currentBet - actor.betThisStreet);

  if (action.type === 'fold') {
    actor.folded = true;
    actor.actedThisStreet = true;
    actor.lastAction = 'Retirado';
    log.push(`${actor.name} se retira.`);
  } else if (action.type === 'check') {
    if (toCall > 0) {
      throw new Error('Cannot check when facing a bet');
    }
    actor.actedThisStreet = true;
    actor.lastAction = 'Pasó';
    log.push(`${actor.name} pasa.`);
  } else if (action.type === 'call') {
    const paid = Math.min(toCall, actor.chips);
    actor.chips -= paid;
    actor.betThisStreet += paid;
    actor.totalInPot += paid;
    pot += paid;
    if (actor.chips === 0) actor.allIn = true;
    actor.actedThisStreet = true;
    actor.lastAction = actor.allIn ? `All-in ${actor.betThisStreet}` : `Igualó ${paid}`;
    log.push(`${actor.name} iguala ${paid}.`);
  } else if (action.type === 'raise') {
    const maxTo = actor.betThisStreet + actor.chips;
    const minTo = Math.min(
      maxTo,
      currentBet === 0 ? state.bigBlind : currentBet + minRaiseIncrement
    );
    const targetTo = Math.max(minTo, Math.min(maxTo, Math.round(action.raiseTo ?? minTo)));
    const added = targetTo - actor.betThisStreet;
    actor.chips -= added;
    actor.betThisStreet = targetTo;
    actor.totalInPot += added;
    pot += added;
    if (actor.chips === 0) actor.allIn = true;

    const raiseDiff = targetTo - currentBet;
    if (raiseDiff > minRaiseIncrement) {
      minRaiseIncrement = raiseDiff;
    }
    if (targetTo > currentBet) {
      currentBet = targetTo;
      for (const other of players) {
        if (other.seat !== actor.seat && !other.folded && !other.allIn) {
          other.actedThisStreet = false;
        }
      }
    }
    actor.actedThisStreet = true;
    actor.lastAction = actor.allIn
      ? `Todo (${targetTo})`
      : currentBet === targetTo && toCall === 0
        ? `Apostó ${targetTo}`
        : `Subió a ${targetTo}`;
    log.push(`${actor.name} ${actor.lastAction.toLowerCase()}.`);
  }

  const nonFolded = players.filter((p) => !p.folded);
  if (nonFolded.length <= 1) {
    return settleShowdown({
      ...state,
      pot,
      currentBet,
      minRaiseIncrement,
      players,
      log,
    });
  }

  const someoneStillNeedsToAct = players.some(
    (p) => !p.folded && !p.allIn && p.chips > 0 && (!p.actedThisStreet || p.betThisStreet < currentBet)
  );

  if (!someoneStillNeedsToAct) {
    return advanceStreet({
      ...state,
      pot,
      currentBet,
      minRaiseIncrement,
      players,
      log,
    });
  }

  const nextSeat = nextActiveSeat(players, actor.seat);
  if (nextSeat === null) {
    return advanceStreet({
      ...state,
      pot,
      currentBet,
      minRaiseIncrement,
      players,
      log,
    });
  }

  return {
    ...state,
    pot,
    currentBet,
    minRaiseIncrement,
    actingSeat: nextSeat,
    players,
    log,
  };
}

function preflopStrengthScore(hole: Card[]): number {
  const [a, b] = hole[0].rank >= hole[1].rank ? [hole[0], hole[1]] : [hole[1], hole[0]];
  const suited = a.suit === b.suit;
  const gap = a.rank - b.rank;
  if (a.rank === b.rank) {
    return 0.52 + (a.rank / 14) * 0.36;
  }
  let s = (a.rank + b.rank) / 36;
  if (a.rank >= 12) s += 0.08;
  if (suited) s += 0.06;
  if (gap <= 2) s += 0.05;
  return Math.max(0.15, Math.min(0.84, s));
}

export function choosePokerBotAction(
  state: PokerHandState,
  difficultyBias = 0, // -0.05 novice, 0 standard, +0.05 strict
  rng: () => number = Math.random
): PokerAction {
  if (state.actingSeat === null) return { type: 'check' };
  const bot = state.players[state.actingSeat];
  const opts = getLegalPokerOptions(state);
  const activeOpps = state.players.filter((p) => !p.folded && p.seat !== bot.seat).length;

  const strength =
    state.street === 'preflop'
      ? preflopStrengthScore(bot.holeCards)
      : estimateEquity(bot.holeCards, state.community, activeOpps, 180, rng);

  const potOdds = opts.callAmount > 0 ? opts.callAmount / (state.pot + opts.callAmount) : 0;

  let tightShift = 0;
  let aggression = 0.25;
  if (bot.personality === 'prudente') {
    tightShift = 0.08;
    aggression = 0.14;
  } else if (bot.personality === 'equilibrado') {
    tightShift = 0.0;
    aggression = 0.28;
  } else if (bot.personality === 'agresiva') {
    tightShift = -0.09;
    aggression = 0.45;
  }

  const effectiveStrength = strength - tightShift + difficultyBias * 0.4;
  const bluffRoll = rng();

  if (opts.canCheck) {
    if (opts.canRaise && (effectiveStrength > 0.56 || bluffRoll < aggression * 0.35)) {
      const target = Math.min(
        opts.maxRaiseTo,
        Math.max(opts.minRaiseTo, Math.round(state.pot * 0.55))
      );
      return { type: 'raise', raiseTo: target };
    }
    return { type: 'check' };
  }

  // Facing a bet
  if (effectiveStrength > potOdds + 0.24 && opts.canRaise && rng() < aggression + 0.25) {
    const target = Math.min(
      opts.maxRaiseTo,
      Math.max(opts.minRaiseTo, state.currentBet + Math.round(state.pot * 0.5))
    );
    return { type: 'raise', raiseTo: target };
  }

  if (effectiveStrength >= potOdds - 0.03 || (opts.callAmount <= state.bigBlind && effectiveStrength > 0.26)) {
    return { type: 'call' };
  }

  return { type: 'fold' };
}

export function getPokerAdvice(
  state: PokerHandState,
  simulations = 600,
  rng: () => number = Math.random
): PokerAdvice {
  const hero = state.players[0];
  const activeOpps = Math.max(1, state.players.filter((p) => !p.folded && p.seat !== 0).length);
  const equity = estimateEquity(hero.holeCards, state.community, activeOpps, simulations, rng);
  const equityPct = Math.round(equity * 100);
  const opts = getLegalPokerOptions(state);
  const toCall = opts.callAmount;
  const potOddsPct = toCall > 0 ? Math.round((toCall / (state.pot + toCall)) * 100) : 0;

  if (toCall === 0) {
    if (equityPct >= 52 && opts.canRaise) {
      return {
        equityPct,
        potOddsPct: 0,
        recommendedAction: 'Subir',
        explanation: `Tienes ~${equityPct}% de probabilidad estimada frente a ${activeOpps} rival(es): conviene apostar para construir bote y proteger tu mano.`,
      };
    }
    return {
      equityPct,
      potOddsPct: 0,
      recommendedAction: 'Pasar',
      explanation: `No te cuesta fichas ver la siguiente carta (probabilidad ~${equityPct}%). Pasar te mantiene en la mano sin riesgo extra.`,
    };
  }

  const potentialWin = state.pot + toCall;
  if (equityPct >= potOddsPct + 18 && opts.canRaise) {
    return {
      equityPct,
      potOddsPct,
      recommendedAction: 'Subir',
      explanation: `Igualar cuesta ${toCall} para optar a ${potentialWin}: necesitas ${potOddsPct}% y tienes ~${equityPct}%. Tu ventaja permite subir.`,
    };
  }
  if (equityPct >= potOddsPct) {
    return {
      equityPct,
      potOddsPct,
      recommendedAction: 'Igualar',
      explanation: `Igualar cuesta ${toCall} para ganar ${potentialWin}: necesitas ${potOddsPct}% y tienes ~${equityPct}%. Las probabilidades del bote justifican igualar.`,
    };
  }

  return {
    equityPct,
    potOddsPct,
    recommendedAction: 'Retirarse',
    explanation: `Igualar cuesta ${toCall} para ganar ${potentialWin}: necesitas ${potOddsPct}%, pero solo tienes ~${equityPct}%. Retirarse ahorra fichas a largo plazo.`,
  };
}
