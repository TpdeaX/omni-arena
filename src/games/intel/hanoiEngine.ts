// Motor puro de Torres de Hanói (3 a 6 discos, sin DOM)

export type TowerIndex = 0 | 1 | 2;
export const TOWER_NAMES = ['A', 'B', 'C'] as const;

export interface HanoiState {
  numDisks: number;
  towers: [number[], number[], number[]]; // bottom -> top (top is last element)
  moves: number;
}

export interface HanoiMoveValidation {
  valid: boolean;
  disk?: number;
  reason?: string;
}

export interface HanoiMove {
  from: TowerIndex;
  to: TowerIndex;
  disk: number;
}

export interface HanoiCallFrame {
  depth: number;
  n: number;
  from: TowerIndex;
  to: TowerIndex;
  aux: TowerIndex;
  phase: 'base' | 'left' | 'move' | 'right';
  label: string;
}

export interface HanoiTraceStep {
  stepIndex: number;
  move: HanoiMove;
  stateAfter: HanoiState;
  callStack: HanoiCallFrame[];
  explanation: string;
}

export interface HanoiOptimalHint {
  from: TowerIndex;
  to: TowerIndex;
  disk: number;
  remainingOptimal: number;
  explanation: string;
}

export function optimalMovesCount(numDisks: number): number {
  return (1 << numDisks) - 1;
}

export function createHanoiState(numDisks: number): HanoiState {
  const n = Math.max(3, Math.min(6, Math.round(numDisks)));
  const firstTower: number[] = [];
  for (let d = n; d >= 1; d--) {
    firstTower.push(d);
  }
  return {
    numDisks: n,
    towers: [firstTower, [], []],
    moves: 0,
  };
}

export function cloneHanoiState(state: HanoiState): HanoiState {
  return {
    numDisks: state.numDisks,
    towers: [
      [...state.towers[0]],
      [...state.towers[1]],
      [...state.towers[2]],
    ],
    moves: state.moves,
  };
}

export function validateMove(state: HanoiState, from: TowerIndex, to: TowerIndex): HanoiMoveValidation {
  if (from === to) {
    return {
      valid: false,
      reason: `La torre de origen y destino son la misma (${TOWER_NAMES[from]}).`,
    };
  }
  const src = state.towers[from];
  const dst = state.towers[to];
  if (src.length === 0) {
    return {
      valid: false,
      reason: `La torre ${TOWER_NAMES[from]} está vacía; no hay disco para mover.`,
    };
  }
  const movingDisk = src[src.length - 1];
  const topDest = dst.length > 0 ? dst[dst.length - 1] : null;
  if (topDest !== null && movingDisk > topDest) {
    return {
      valid: false,
      disk: movingDisk,
      reason: `No puedes poner un disco grande (${movingDisk}) sobre uno más pequeño (${topDest}).`,
    };
  }
  return { valid: true, disk: movingDisk };
}

export function applyMove(state: HanoiState, from: TowerIndex, to: TowerIndex): HanoiState {
  const check = validateMove(state, from, to);
  if (!check.valid) {
    throw new Error(check.reason ?? 'Movimiento ilegal en Hanói');
  }
  const next = cloneHanoiState(state);
  const disk = next.towers[from].pop()!;
  next.towers[to].push(disk);
  next.moves += 1;
  return next;
}

export function isSolved(state: HanoiState): boolean {
  return (
    state.towers[2].length === state.numDisks &&
    state.towers[0].length === 0 &&
    state.towers[1].length === 0
  );
}

export function buildRecursiveTrace(
  numDisks: number,
  from: TowerIndex = 0,
  to: TowerIndex = 2,
  aux: TowerIndex = 1
): HanoiTraceStep[] {
  const steps: HanoiTraceStep[] = [];
  let current = createHanoiState(numDisks);
  const stack: HanoiCallFrame[] = [];

  const solve = (k: number, f: TowerIndex, t: TowerIndex, a: TowerIndex): void => {
    const label = `hanoi(${k}, ${TOWER_NAMES[f]}→${TOWER_NAMES[t]})`;
    if (k === 1) {
      stack.push({
        depth: stack.length,
        n: k,
        from: f,
        to: t,
        aux: a,
        phase: 'base',
        label,
      });
      current = applyMove(current, f, t);
      steps.push({
        stepIndex: steps.length,
        move: { from: f, to: t, disk: 1 },
        stateAfter: cloneHanoiState(current),
        callStack: stack.map((fr) => ({ ...fr })),
        explanation: `Caso base (n=1): mueve el disco 1 directo de ${TOWER_NAMES[f]} a ${TOWER_NAMES[t]}.`,
      });
      stack.pop();
      return;
    }

    const frame: HanoiCallFrame = {
      depth: stack.length,
      n: k,
      from: f,
      to: t,
      aux: a,
      phase: 'left',
      label,
    };
    stack.push(frame);

    // 1. Move k-1 disks from f to a
    frame.phase = 'left';
    solve(k - 1, f, a, t);

    // 2. Move largest disk k from f to t
    frame.phase = 'move';
    current = applyMove(current, f, t);
    steps.push({
      stepIndex: steps.length,
      move: { from: f, to: t, disk: k },
      stateAfter: cloneHanoiState(current),
      callStack: stack.map((fr) => ({ ...fr })),
      explanation: `Tras apartar los ${k - 1} discos superiores a ${TOWER_NAMES[a]}, queda libre el disco ${k}: muévelo de ${TOWER_NAMES[f]} a ${TOWER_NAMES[t]}.`,
    });

    // 3. Move k-1 disks from a to t
    frame.phase = 'right';
    solve(k - 1, a, t, f);

    stack.pop();
  };

  solve(current.numDisks, from, to, aux);
  return steps;
}

function findDiskTower(state: HanoiState, disk: number): TowerIndex {
  for (let t = 0 as TowerIndex; t <= 2; t = (t + 1) as TowerIndex) {
    if (state.towers[t].includes(disk)) return t;
  }
  throw new Error(`Disco ${disk} no encontrado en las torres`);
}

export function remainingOptimalSteps(state: HanoiState, target: TowerIndex = 2): number {
  let goal = target;
  let steps = 0;
  for (let d = state.numDisks; d >= 1; d--) {
    const loc = findDiskTower(state, d);
    if (loc !== goal) {
      steps += 1 << (d - 1);
      goal = (3 - loc - goal) as TowerIndex;
    }
  }
  return steps;
}

export function getOptimalNextMove(
  state: HanoiState,
  target: TowerIndex = 2
): HanoiOptimalHint | null {
  if (isSolved(state) && target === 2) return null;

  const remainingOptimal = remainingOptimalSteps(state, target);
  if (remainingOptimal === 0) return null;

  let goal: TowerIndex = target;
  let blockedDisk: number | null = null;
  let blockedGoal: TowerIndex | null = null;
  let blockedAux: TowerIndex | null = null;

  for (let d = state.numDisks; d >= 1; d--) {
    const loc = findDiskTower(state, d);
    if (loc === goal) continue;

    const aux = (3 - loc - goal) as TowerIndex;
    const srcTower = state.towers[loc];
    const dstTower = state.towers[goal];
    const isTopSrc = srcTower[srcTower.length - 1] === d;
    const hasSmallerOnDst = dstTower.some((x) => x < d);

    if (isTopSrc && !hasSmallerOnDst) {
      const explanation =
        blockedDisk !== null && blockedGoal !== null && blockedAux !== null
          ? `Primero hay que liberar el disco ${blockedDisk} hacia la torre ${TOWER_NAMES[blockedGoal]} apartando los menores a ${TOWER_NAMES[blockedAux]}: mueve el disco ${d} de ${TOWER_NAMES[loc]} a ${TOWER_NAMES[goal]}.`
          : `Camino despejado: mueve el disco ${d} de la torre ${TOWER_NAMES[loc]} a la torre ${TOWER_NAMES[goal]}.`;

      return {
        from: loc,
        to: goal,
        disk: d,
        remainingOptimal,
        explanation,
      };
    }

    if (blockedDisk === null) {
      blockedDisk = d;
      blockedGoal = goal;
      blockedAux = aux;
    }
    goal = aux;
  }

  return null;
}
