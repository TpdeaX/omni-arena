import { CIRCUIT_IDS, GAME_CATALOG } from '../catalog.ts';
import type { StandaloneGameId } from '../types.ts';
import { shuffleWithRng } from './neuro/neuroEngines.ts';
import type { Rng } from './neuro/neuroEngines.ts';

// Alternating 3D / 2D sequence across the 18 fast circuit disciplines
const ALTERNATING_CIRCUIT: StandaloneGameId[] = [
  'aim3d',
  'schulte2d',
  'flight3d',
  'track2d',
  'parkour3d',
  'pulse2d',
  'cube3d',
  'nback2d',
  'runner3d',
  'parry2d',
  'rhythm2d',
  'sniper2d',
  'memory2d',
  'bullet2d',
  'snake2d',
  'tetris2d',
  'twinstick2d',
  'puzzle2d',
];

/** Fixed order: used by the ranked circuit so calibrations stay comparable. */
export const FIXED_CIRCUIT_ORDER: StandaloneGameId[] =
  ALTERNATING_CIRCUIT.length === CIRCUIT_IDS.length ? ALTERNATING_CIRCUIT : [...CIRCUIT_IDS];

/** Shuffled order per run: same 3D/2D slot pattern as the fixed order, different games in each slot. */
export function buildCircuitOrder(rng: Rng = Math.random): StandaloneGameId[] {
  const is3D = (id: StandaloneGameId): boolean => GAME_CATALOG[id].dimension === '3D';
  const pool3D = shuffleWithRng(FIXED_CIRCUIT_ORDER.filter(is3D), rng);
  const pool2D = shuffleWithRng(FIXED_CIRCUIT_ORDER.filter((id) => !is3D(id)), rng);
  return FIXED_CIRCUIT_ORDER.map((id) => (is3D(id) ? pool3D : pool2D).pop()!);
}
