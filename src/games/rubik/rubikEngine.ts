export type FaceKey = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export type StickerColor = 'Y' | 'R' | 'G' | 'W' | 'O' | 'B';

export type BaseMove = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';
export type Move =
  | BaseMove
  | "U'"
  | "D'"
  | "L'"
  | "R'"
  | "F'"
  | "B'"
  | 'U2'
  | 'D2'
  | 'L2'
  | 'R2'
  | 'F2'
  | 'B2';

export type CubeState = StickerColor[];

export const FACE_ORDER: readonly FaceKey[] = ['U', 'R', 'F', 'D', 'L', 'B'];

export const FACE_COLORS: Record<FaceKey, StickerColor> = {
  U: 'Y',
  R: 'R',
  F: 'G',
  D: 'W',
  L: 'O',
  B: 'B',
};

export const STICKER_COLOR_HEX: Record<StickerColor, string> = {
  Y: '#facc15',
  R: '#ef4444',
  G: '#22c55e',
  W: '#f8fafc',
  O: '#f97316',
  B: '#2563eb',
};

export const STICKER_COLOR_NAMES: Record<StickerColor, string> = {
  Y: 'Amarillo',
  R: 'Rojo',
  G: 'Verde',
  W: 'Blanco',
  O: 'Naranja',
  B: 'Azul',
};

export const FACE_NAMES_ES: Record<FaceKey, string> = {
  U: 'Arriba (Amarillo)',
  R: 'Derecha (Rojo)',
  F: 'Frente (Verde)',
  D: 'Abajo (Blanco)',
  L: 'Izquierda (Naranja)',
  B: 'Atrás (Azul)',
};

export const BASE_MOVES: readonly BaseMove[] = ['U', 'D', 'L', 'R', 'F', 'B'];

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const FACE_NORMALS: Record<FaceKey, Vec3> = {
  U: { x: 0, y: 1, z: 0 },
  R: { x: 1, y: 0, z: 0 },
  F: { x: 0, y: 0, z: 1 },
  D: { x: 0, y: -1, z: 0 },
  L: { x: -1, y: 0, z: 0 },
  B: { x: 0, y: 0, z: -1 },
};

/**
 * Maps a sticker index (0..53, order U R F D L B) to its 3D cubie position and outward normal.
 */
export function stickerIndexToGeom(index: number): { pos: Vec3; normal: Vec3; face: FaceKey } {
  const faceIdx = Math.floor(index / 9);
  const local = index % 9;
  const row = Math.floor(local / 3);
  const col = local % 3;
  const face = FACE_ORDER[faceIdx];

  switch (face) {
    case 'U':
      return { face, pos: { x: col - 1, y: 1, z: row - 1 }, normal: { x: 0, y: 1, z: 0 } };
    case 'D':
      return { face, pos: { x: col - 1, y: -1, z: 1 - row }, normal: { x: 0, y: -1, z: 0 } };
    case 'F':
      return { face, pos: { x: col - 1, y: 1 - row, z: 1 }, normal: { x: 0, y: 0, z: 1 } };
    case 'B':
      return { face, pos: { x: 1 - col, y: 1 - row, z: -1 }, normal: { x: 0, y: 0, z: -1 } };
    case 'R':
      return { face, pos: { x: 1, y: 1 - row, z: 1 - col }, normal: { x: 1, y: 0, z: 0 } };
    case 'L':
      return { face, pos: { x: -1, y: 1 - row, z: col - 1 }, normal: { x: -1, y: 0, z: 0 } };
  }
}

/**
 * Maps a 3D cubie position and outward normal back to its sticker index (0..53).
 */
export function geomToStickerIndex(pos: Vec3, normal: Vec3): number {
  let face: FaceKey;
  if (normal.y === 1) face = 'U';
  else if (normal.y === -1) face = 'D';
  else if (normal.z === 1) face = 'F';
  else if (normal.z === -1) face = 'B';
  else if (normal.x === 1) face = 'R';
  else face = 'L';

  const base = FACE_ORDER.indexOf(face) * 9;
  let row = 0;
  let col = 0;

  switch (face) {
    case 'U':
      row = pos.z + 1;
      col = pos.x + 1;
      break;
    case 'D':
      row = 1 - pos.z;
      col = pos.x + 1;
      break;
    case 'F':
      row = 1 - pos.y;
      col = pos.x + 1;
      break;
    case 'B':
      row = 1 - pos.y;
      col = 1 - pos.x;
      break;
    case 'R':
      row = 1 - pos.y;
      col = 1 - pos.z;
      break;
    case 'L':
      row = 1 - pos.y;
      col = pos.z + 1;
      break;
  }

  return base + row * 3 + col;
}

function rotateVecQuarterCW(v: Vec3, axisNormal: Vec3): Vec3 {
  // Clockwise looking from outside (-axisNormal) is -90deg around axisNormal.
  if (axisNormal.x === 1) return { x: v.x, y: v.z, z: -v.y };
  if (axisNormal.x === -1) return { x: v.x, y: -v.z, z: v.y };
  if (axisNormal.y === 1) return { x: -v.z, y: v.y, z: v.x };
  if (axisNormal.y === -1) return { x: v.z, y: v.y, z: -v.x };
  if (axisNormal.z === 1) return { x: v.y, y: -v.x, z: v.z };
  return { x: -v.y, y: v.x, z: v.z };
}

function belongsToFaceLayer(pos: Vec3, face: FaceKey): boolean {
  const n = FACE_NORMALS[face];
  if (n.x !== 0) return pos.x === n.x;
  if (n.y !== 0) return pos.y === n.y;
  return pos.z === n.z;
}

function buildQuarterCWPermutation(face: FaceKey): number[] {
  const normal = FACE_NORMALS[face];
  const perm = new Array<number>(54);
  for (let i = 0; i < 54; i++) {
    const { pos, normal: sNorm } = stickerIndexToGeom(i);
    if (!belongsToFaceLayer(pos, face)) {
      perm[i] = i;
      continue;
    }
    const nextPos = rotateVecQuarterCW(pos, normal);
    const nextNorm = rotateVecQuarterCW(sNorm, normal);
    const dest = geomToStickerIndex(nextPos, nextNorm);
    // perm[dest] = source index
    perm[dest] = i;
  }
  return perm;
}

const CW_PERMS: Record<FaceKey, number[]> = {
  U: buildQuarterCWPermutation('U'),
  R: buildQuarterCWPermutation('R'),
  F: buildQuarterCWPermutation('F'),
  D: buildQuarterCWPermutation('D'),
  L: buildQuarterCWPermutation('L'),
  B: buildQuarterCWPermutation('B'),
};

export function createSolvedCube(): CubeState {
  const state: StickerColor[] = [];
  for (const face of FACE_ORDER) {
    const color = FACE_COLORS[face];
    for (let i = 0; i < 9; i++) {
      state.push(color);
    }
  }
  return state;
}

export function cloneCube(cube: CubeState): CubeState {
  return cube.slice();
}

export function isSolved(cube: CubeState): boolean {
  for (let f = 0; f < 6; f++) {
    const start = f * 9;
    const center = cube[start + 4];
    for (let i = 0; i < 9; i++) {
      if (cube[start + i] !== center) return false;
    }
  }
  return true;
}

function applyQuarterCW(cube: CubeState, face: FaceKey): CubeState {
  const perm = CW_PERMS[face];
  const next = new Array<StickerColor>(54);
  for (let i = 0; i < 54; i++) {
    next[i] = cube[perm[i]];
  }
  return next;
}

export function applyMove(cube: CubeState, move: Move): CubeState {
  const face = move[0] as FaceKey;
  const suffix = move.slice(1);
  if (suffix === "'") {
    // 3 quarter turns CW = 1 quarter turn CCW
    return applyQuarterCW(applyQuarterCW(applyQuarterCW(cube, face), face), face);
  }
  if (suffix === '2') {
    return applyQuarterCW(applyQuarterCW(cube, face), face);
  }
  return applyQuarterCW(cube, face);
}

export function parseMoves(sequence: string): Move[] {
  const tokens = sequence.trim().split(/\s+/).filter(Boolean);
  const valid = new Set<string>([
    'U', "U'", 'U2',
    'D', "D'", 'D2',
    'L', "L'", 'L2',
    'R', "R'", 'R2',
    'F', "F'", 'F2',
    'B', "B'", 'B2',
  ]);
  const moves: Move[] = [];
  for (const token of tokens) {
    if (!valid.has(token)) {
      throw new Error(`Movimiento Rubik inválido: ${token}`);
    }
    moves.push(token as Move);
  }
  return moves;
}

export function applyMoves(cube: CubeState, moves: string | readonly Move[]): CubeState {
  const list = typeof moves === 'string' ? parseMoves(moves) : moves;
  let current = cloneCube(cube);
  for (const m of list) {
    current = applyMove(current, m);
  }
  return current;
}

export function invertMove(move: Move): Move {
  const face = move[0] as BaseMove;
  const suffix = move.slice(1);
  if (suffix === "'") return face;
  if (suffix === '2') return `${face}2` as Move;
  return `${face}'` as Move;
}

export function invertSequence(moves: string | readonly Move[]): Move[] {
  const list = typeof moves === 'string' ? parseMoves(moves) : moves;
  const inverted: Move[] = [];
  for (let i = list.length - 1; i >= 0; i--) {
    inverted.push(invertMove(list[i]));
  }
  return inverted;
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

const OPPOSITE_FACE: Record<BaseMove, BaseMove> = {
  U: 'D',
  D: 'U',
  L: 'R',
  R: 'L',
  F: 'B',
  B: 'F',
};

export function generateScramble(length = 20, seed = Date.now()): Move[] {
  const rng = mulberry32(seed);
  const suffixes = ['', "'", '2'] as const;
  const result: Move[] = [];
  let prevFace: BaseMove | null = null;
  let prevPrevFace: BaseMove | null = null;

  for (let i = 0; i < length; i++) {
    const candidates = BASE_MOVES.filter((f) => {
      if (f === prevFace) return false;
      if (prevFace && prevPrevFace === f && OPPOSITE_FACE[prevFace] === f) return false;
      return true;
    });
    const face = candidates[Math.floor(rng() * candidates.length)];
    const suffix = suffixes[Math.floor(rng() * suffixes.length)];
    result.push(`${face}${suffix}` as Move);
    prevPrevFace = prevFace;
    prevFace = face;
  }
  return result;
}

export interface BeginnerPhaseInfo {
  phase: 1 | 2 | 3 | 4 | 5;
  completedPhases: [boolean, boolean, boolean, boolean, boolean];
  completedCount: number;
  solved: boolean;
  title: string;
  summary: string;
}

export function detectBeginnerPhase(cube: CubeState): BeginnerPhaseInfo {
  // Face offsets: U=0, R=9, F=18, D=27, L=36, B=45
  const uC = cube[4];   // Y
  const rC = cube[13];  // R
  const fC = cube[22];  // G
  const dC = cube[31];  // W
  const lC = cube[40];  // O
  const bC = cube[49];  // B

  // Phase 1: White cross on D aligned with F, R, B, L centers
  const phase1 =
    cube[28] === dC && cube[25] === fC && // D[1], F[7]
    cube[30] === dC && cube[43] === lC && // D[3], L[7]
    cube[32] === dC && cube[16] === rC && // D[5], R[7]
    cube[34] === dC && cube[52] === bC;   // D[7], B[7]

  // Phase 2: First layer (Phase 1 + 4 D corners & bottom row of F/R/B/L)
  const phase2 =
    phase1 &&
    cube[27] === dC && cube[24] === fC && cube[44] === lC && // D[0]=DFL
    cube[29] === dC && cube[26] === fC && cube[15] === rC && // D[2]=DFR
    cube[33] === dC && cube[42] === lC && cube[53] === bC && // D[6]=DBL
    cube[35] === dC && cube[17] === rC && cube[51] === bC;   // D[8]=DBR

  // Phase 3: Second layer (Phase 2 + 4 middle edges)
  const phase3 =
    phase2 &&
    cube[21] === fC && cube[41] === lC && // FL
    cube[23] === fC && cube[12] === rC && // FR
    cube[14] === rC && cube[48] === bC && // RB
    cube[50] === bC && cube[39] === lC;   // BL

  // Phase 4: Yellow cross on U (Phase 3 + U[1], U[3], U[5], U[7])
  const phase4 =
    phase3 &&
    cube[1] === uC &&
    cube[3] === uC &&
    cube[5] === uC &&
    cube[7] === uC;

  // Phase 5: Entire cube solved (all U corners oriented + U edges/corners permuted)
  const phase5 = phase4 && isSolved(cube);

  const completedPhases: [boolean, boolean, boolean, boolean, boolean] = [
    phase1,
    phase2,
    phase3,
    phase4,
    phase5,
  ];
  const completedCount = completedPhases.filter(Boolean).length;

  if (!phase1) {
    return {
      phase: 1,
      completedPhases,
      completedCount,
      solved: false,
      title: 'Fase 1: Cruz blanca',
      summary: 'Coloca las 4 aristas blancas en la cara inferior (D) alineadas con cada centro lateral.',
    };
  }
  if (!phase2) {
    return {
      phase: 2,
      completedPhases,
      completedCount,
      solved: false,
      title: 'Fase 2: Primera capa',
      summary: 'Inserta las 4 esquinas blancas con el gatillo U R U\' R\' sin romper la cruz blanca.',
    };
  }
  if (!phase3) {
    return {
      phase: 3,
      completedPhases,
      completedCount,
      solved: false,
      title: 'Fase 3: Segunda capa',
      summary: 'Baja las aristas de la capa superior hacia la derecha o izquierda del cinturón medio.',
    };
  }
  if (!phase4) {
    return {
      phase: 4,
      completedPhases,
      completedCount,
      solved: false,
      title: 'Fase 4: Cruz amarilla',
      summary: 'Forma la cruz amarilla arriba aplicando F R U R\' U\' F\' desde el punto, la L o la línea.',
    };
  }
  if (!phase5) {
    return {
      phase: 5,
      completedPhases,
      completedCount,
      solved: false,
      title: 'Fase 5: Última capa',
      summary: 'Alinea las aristas amarillas, ubica las 4 esquinas en su sitio y oriéntalas con R\' D\' R D.',
    };
  }
  return {
    phase: 5,
    completedPhases,
    completedCount: 5,
    solved: true,
    title: 'Cubo resuelto',
    summary: 'Las 5 fases del método principiante están completas.',
  };
}

export interface PhaseGuideLesson {
  id: string;
  phase: 1 | 2 | 3 | 4 | 5;
  title: string;
  shortTitle: string;
  objective: string;
  tip: string;
  algorithms: { label: string; moves: Move[] }[];
  setupMoves: Move[];
  demoMoves: Move[];
}

export const BEGINNER_PHASE_LESSONS: readonly PhaseGuideLesson[] = [
  {
    id: 'phase-1',
    phase: 1,
    title: '1. Cruz blanca',
    shortTitle: 'Cruz blanca',
    objective: 'Lleva las 4 aristas blancas abajo (cara D) haciendo coincidir su segundo color con el centro.',
    tip: 'Coloca la arista sobre su centro en la cara superior (U) y gira esa cara frontal 180° (F2).',
    algorithms: [
      { label: 'Bajar arista alineada', moves: parseMoves('U F2') },
      { label: 'Voltear arista girada', moves: parseMoves("F' U L' U'") },
    ],
    setupMoves: invertSequence('U F2'),
    demoMoves: parseMoves('U F2'),
  },
  {
    id: 'phase-2',
    phase: 2,
    title: '2. Primera capa',
    shortTitle: '1ª capa',
    objective: 'Completa la cara blanca colocando sus 4 esquinas entre los centros que les corresponden.',
    tip: 'Sitúa la esquina blanca encima de su hueco en la esquina frontal derecha y repite U R U\' R\'.',
    algorithms: [
      { label: 'Insertar esquina derecha', moves: parseMoves("U R U' R'") },
      { label: 'Insertar esquina izquierda', moves: parseMoves("U' L' U L") },
    ],
    setupMoves: invertSequence("U R U' R'"),
    demoMoves: parseMoves("U R U' R'"),
  },
  {
    id: 'phase-3',
    phase: 3,
    title: '3. Segunda capa',
    shortTitle: '2ª capa',
    objective: 'Coloca las 4 aristas sin amarillo en la fila central alineando primero su color frontal.',
    tip: 'Aléjala primero del lado al que va (U si va a la derecha, U\' si va a la izquierda).',
    algorithms: [
      { label: 'Mover arista a la derecha', moves: parseMoves("U R U' R' U' F' U F") },
      { label: 'Mover arista a la izquierda', moves: parseMoves("U' L' U L U F U' F'") },
    ],
    setupMoves: invertSequence("U R U' R' U' F' U F"),
    demoMoves: parseMoves("U R U' R' U' F' U F"),
  },
  {
    id: 'phase-4',
    phase: 4,
    title: '4. Cruz amarilla',
    shortTitle: 'Cruz amarilla',
    objective: 'Orienta las 4 aristas de la cara superior U hasta ver una cruz amarilla.',
    tip: 'Si ves una línea horizontal, aplícalo 1 vez; si ves una L (arriba-izquierda), aplícalo 2 veces.',
    algorithms: [
      { label: 'Formar cruz amarilla', moves: parseMoves("F R U R' U' F'") },
    ],
    setupMoves: invertSequence("F R U R' U' F'"),
    demoMoves: parseMoves("F R U R' U' F'"),
  },
  {
    id: 'phase-5',
    phase: 5,
    title: '5. Última capa',
    shortTitle: 'Última capa',
    objective: '5a alinea aristas amarillas, 5b coloca esquinas en su lugar, 5c gira cada esquina hasta resolver.',
    tip: 'En 5c mantén el cubo fijo y gira solo U para traer la siguiente esquina sin orientar a UFR.',
    algorithms: [
      { label: '5a Aristas amarillas', moves: parseMoves("R U R' U R U2 R' U") },
      { label: '5b Colocar esquinas', moves: parseMoves("U R U' L' U R' U' L") },
      { label: '5c Orientar esquinas', moves: parseMoves("R' D' R D") },
    ],
    setupMoves: invertSequence("R U R' U R U2 R' U"),
    demoMoves: parseMoves("R U R' U R U2 R' U"),
  },
];

export function createLessonExampleCube(lesson: PhaseGuideLesson): CubeState {
  return applyMoves(createSolvedCube(), lesson.setupMoves);
}
