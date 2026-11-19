// Motor puro de Rotacion Espacial 3D (tipo Shepard-Metzler, sin DOM ni Three.js)

export interface Voxel3D {
  x: number;
  y: number;
  z: number;
}

export type Mat3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

export type SpatialLevel = 1 | 2 | 3 | 4;

export interface SpatialOption {
  voxels: Voxel3D[];
  kind: 'rotated' | 'mirror' | 'perturbed';
  rotIndex: number;
  differenceNote: string;
}

export interface SpatialPuzzle {
  level: SpatialLevel;
  seed: number;
  cubeCount: number;
  base: Voxel3D[];
  options: SpatialOption[];
  correctIndex: number;
  correctRotMatrix: Mat3;
  hint: string;
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

function buildAll24Rotations(): Mat3[] {
  const perms: { p: [number, number, number]; parity: 1 | -1 }[] = [
    { p: [0, 1, 2], parity: 1 },
    { p: [1, 2, 0], parity: 1 },
    { p: [2, 0, 1], parity: 1 },
    { p: [0, 2, 1], parity: -1 },
    { p: [2, 1, 0], parity: -1 },
    { p: [1, 0, 2], parity: -1 },
  ];

  const mats: Mat3[] = [];
  for (const { p, parity } of perms) {
    for (const s0 of [1, -1] as const) {
      for (const s1 of [1, -1] as const) {
        for (const s2 of [1, -1] as const) {
          if (parity * s0 * s1 * s2 !== 1) continue;
          const signs = [s0, s1, s2];
          const rows: [number, number, number][] = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
          ];
          for (let r = 0; r < 3; r++) {
            rows[r][p[r]] = signs[r];
          }
          mats.push([
            [rows[0][0], rows[0][1], rows[0][2]],
            [rows[1][0], rows[1][1], rows[1][2]],
            [rows[2][0], rows[2][1], rows[2][2]],
          ]);
        }
      }
    }
  }
  return mats;
}

// Indice 0 es la identidad
export const ROTATIONS_24: readonly Mat3[] = buildAll24Rotations();

export function normalizeVoxels(voxels: readonly Voxel3D[]): Voxel3D[] {
  if (voxels.length === 0) return [];
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  for (const v of voxels) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.z < minZ) minZ = v.z;
  }
  return voxels
    .map((v) => ({ x: v.x - minX, y: v.y - minY, z: v.z - minZ }))
    .sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z);
}

export function shapeKey(voxels: readonly Voxel3D[]): string {
  return normalizeVoxels(voxels)
    .map((v) => `${v.x},${v.y},${v.z}`)
    .join('|');
}

function applyMat3(v: Voxel3D, mat: Mat3): Voxel3D {
  return {
    x: mat[0][0] * v.x + mat[0][1] * v.y + mat[0][2] * v.z,
    y: mat[1][0] * v.x + mat[1][1] * v.y + mat[1][2] * v.z,
    z: mat[2][0] * v.x + mat[2][1] * v.y + mat[2][2] * v.z,
  };
}

export function rotateVoxels(voxels: readonly Voxel3D[], rotIndex: number): Voxel3D[] {
  const idx = ((rotIndex % 24) + 24) % 24;
  const mat = ROTATIONS_24[idx];
  return normalizeVoxels(voxels.map((v) => applyMat3(v, mat)));
}

export function mirrorVoxels(voxels: readonly Voxel3D[]): Voxel3D[] {
  return normalizeVoxels(voxels.map((v) => ({ x: -v.x, y: v.y, z: v.z })));
}

export function areShapesCongruentByRotation(
  a: readonly Voxel3D[],
  b: readonly Voxel3D[]
): boolean {
  if (a.length !== b.length) return false;
  const keyB = shapeKey(b);
  for (let r = 0; r < 24; r++) {
    if (shapeKey(rotateVoxels(a, r)) === keyB) return true;
  }
  return false;
}

export function isShapeChiral(voxels: readonly Voxel3D[]): boolean {
  if (voxels.length < 4) return false;
  return !areShapesCongruentByRotation(voxels, mirrorVoxels(voxels));
}

const NEIGHBORS_6: readonly Voxel3D[] = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

function vKey(v: Voxel3D): string {
  return `${v.x},${v.y},${v.z}`;
}

function isConnected(voxels: readonly Voxel3D[]): boolean {
  if (voxels.length <= 1) return true;
  const set = new Set(voxels.map(vKey));
  const visited = new Set<string>();
  const queue: Voxel3D[] = [voxels[0]];
  visited.add(vKey(voxels[0]));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const d of NEIGHBORS_6) {
      const nxt = { x: cur.x + d.x, y: cur.y + d.y, z: cur.z + d.z };
      const k = vKey(nxt);
      if (set.has(k) && !visited.has(k)) {
        visited.add(k);
        queue.push(nxt);
      }
    }
  }
  return visited.size === voxels.length;
}

function hasFull3DSpan(voxels: readonly Voxel3D[]): boolean {
  let maxX = 0;
  let maxY = 0;
  let maxZ = 0;
  for (const v of normalizeVoxels(voxels)) {
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
    if (v.z > maxZ) maxZ = v.z;
  }
  return maxX >= 1 && maxY >= 1 && maxZ >= 1;
}

interface GeneratedPoly {
  voxels: Voxel3D[];
  armLengths: number[];
}

function tryBuildArmChain(targetCount: number, rng: () => number): GeneratedPoly | null {
  const cubes: Voxel3D[] = [{ x: 0, y: 0, z: 0 }];
  const occupied = new Set<string>(['0,0,0']);
  const armLengths: number[] = [];

  let cur: Voxel3D = { x: 0, y: 0, z: 0 };
  let prevAxis = -1;

  // Primeros 3 ejes cubren X, Y, Z para asegurar volumen 3D inmediato
  const firstAxes = [0, 1, 2];
  for (let i = firstAxes.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [firstAxes[i], firstAxes[j]] = [firstAxes[j], firstAxes[i]];
  }

  let stepIdx = 0;
  while (cubes.length < targetCount && stepIdx < 16) {
    const rem = targetCount - cubes.length;
    let axis: number;
    if (stepIdx < 3) {
      axis = firstAxes[stepIdx];
    } else {
      const candidates = [0, 1, 2].filter((a) => a !== prevAxis);
      axis = candidates[Math.floor(rng() * candidates.length)];
    }

    const dir = rng() < 0.5 ? 1 : -1;
    const maxSeg = stepIdx === 0 ? Math.min(3, rem) : Math.min(3, rem);
    const minSeg = rem >= 2 && stepIdx < 2 ? 1 : 1;
    const segLen = Math.min(rem, minSeg + Math.floor(rng() * maxSeg));

    let added = 0;
    let testPos = { ...cur };
    for (let s = 0; s < segLen; s++) {
      testPos = {
        x: testPos.x + (axis === 0 ? dir : 0),
        y: testPos.y + (axis === 1 ? dir : 0),
        z: testPos.z + (axis === 2 ? dir : 0),
      };
      const k = vKey(testPos);
      if (occupied.has(k)) break;
      occupied.add(k);
      cubes.push(testPos);
      cur = testPos;
      added++;
    }

    if (added > 0) {
      armLengths.push(added);
      prevAxis = axis;
    }
    stepIdx++;
  }

  // Si falto algun cubo por auto-colision, anexar a un vecino libre evitando simetria
  let safety = 0;
  while (cubes.length < targetCount && safety < 40) {
    safety++;
    const anchor = cubes[Math.floor(rng() * cubes.length)];
    const d = NEIGHBORS_6[Math.floor(rng() * NEIGHBORS_6.length)];
    const cand = { x: anchor.x + d.x, y: anchor.y + d.y, z: anchor.z + d.z };
    const k = vKey(cand);
    if (!occupied.has(k)) {
      occupied.add(k);
      cubes.push(cand);
      armLengths.push(1);
    }
  }

  if (cubes.length !== targetCount) return null;
  if (!hasFull3DSpan(cubes)) return null;
  if (!isShapeChiral(cubes)) return null;

  return {
    voxels: normalizeVoxels(cubes),
    armLengths,
  };
}

function buildChiralShape(targetCount: number, rng: () => number): GeneratedPoly {
  for (let attempt = 0; attempt < 250; attempt++) {
    const poly = tryBuildArmChain(targetCount, rng);
    if (poly) return poly;
  }

  // Respaldo determinista garantizado quiral construido desde nucleo de 5 cubos + extension
  const base5: Voxel3D[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 1, y: 1, z: 1 },
    { x: 2, y: 1, z: 1 },
  ];
  const cubes = [...base5];
  const occupied = new Set(cubes.map(vKey));
  let cur = { x: 2, y: 1, z: 1 };
  let dirStep = 0;
  const fallbackDirs: Voxel3D[] = [
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ];
  while (cubes.length < targetCount) {
    const d = fallbackDirs[dirStep % fallbackDirs.length];
    dirStep++;
    const cand = { x: cur.x + d.x, y: cur.y + d.y, z: cur.z + d.z };
    const k = vKey(cand);
    if (!occupied.has(k)) {
      occupied.add(k);
      cubes.push(cand);
      cur = cand;
    } else {
      cur = { x: cur.x + 1, y: cur.y, z: cur.z };
    }
  }
  return { voxels: normalizeVoxels(cubes), armLengths: [2, 1, 1, targetCount - 4] };
}

function buildPerturbedDistractor(
  base: readonly Voxel3D[],
  existingOptions: readonly Voxel3D[][],
  rng: () => number
): { voxels: Voxel3D[]; rotIndex: number } | null {
  const baseKeys = new Set(base.map(vKey));

  // Identificar hojas o cubos removibles sin desconectar la figura
  const removableIndices: number[] = [];
  for (let i = 0; i < base.length; i++) {
    const without = base.filter((_, idx) => idx !== i);
    if (isConnected(without)) {
      removableIndices.push(i);
    }
  }

  for (let attempt = 0; attempt < 120; attempt++) {
    if (removableIndices.length === 0) break;
    const remIdx = removableIndices[Math.floor(rng() * removableIndices.length)];
    const without = base.filter((_, idx) => idx !== remIdx);
    const withoutSet = new Set(without.map(vKey));

    // Buscar una nueva posicion adyacente distinta a la original
    const candidates: Voxel3D[] = [];
    for (const anchor of without) {
      for (const d of NEIGHBORS_6) {
        const pos = { x: anchor.x + d.x, y: anchor.y + d.y, z: anchor.z + d.z };
        const pk = vKey(pos);
        if (!withoutSet.has(pk) && !baseKeys.has(pk)) {
          candidates.push(pos);
        }
      }
    }
    if (candidates.length === 0) continue;

    const chosenPos = candidates[Math.floor(rng() * candidates.length)];
    const perturbed = normalizeVoxels([...without, chosenPos]);

    if (areShapesCongruentByRotation(base, perturbed)) continue;
    if (existingOptions.some((opt) => areShapesCongruentByRotation(opt, perturbed))) continue;

    const rotIdx = 1 + Math.floor(rng() * 23);
    return { voxels: rotateVoxels(perturbed, rotIdx), rotIndex: rotIdx };
  }
  return null;
}

function chooseNonTrivialRotation(level: SpatialLevel, rng: () => number): number {
  const nontrivial: number[] = [];
  for (let i = 1; i < 24; i++) {
    const m = ROTATIONS_24[i];
    const trace = m[0][0] + m[1][1] + m[2][2];
    // Nivel 1 admite giros de 90 grados alrededor de un eje (trace === 1); niveles 2+ prefieren giros compuestos (trace <= 0)
    if (level === 1 || trace <= 0) {
      nontrivial.push(i);
    }
  }
  const pool = nontrivial.length > 0 ? nontrivial : [1, 2, 3, 4, 5];
  return pool[Math.floor(rng() * pool.length)];
}

export function cubeCountForLevel(level: SpatialLevel, rng: () => number): number {
  if (level === 1) return 6 + Math.floor(rng() * 2); // 6..7
  if (level === 2) return 7 + Math.floor(rng() * 2); // 7..8
  if (level === 3) return 9 + Math.floor(rng() * 2); // 9..10
  return 10 + Math.floor(rng() * 3); // 10..12
}

export function generateSpatialPuzzle(
  level: SpatialLevel,
  seed: number,
  cubeCountOverride?: number
): SpatialPuzzle {
  const rng = mulberry32(seed);
  const cubeCount = Math.max(
    6,
    Math.min(13, cubeCountOverride ?? cubeCountForLevel(level, rng))
  );

  const generated = buildChiralShape(cubeCount, rng);
  const base = generated.voxels;
  const optionCount = level === 1 ? 3 : 4;

  const correctRotIdx = chooseNonTrivialRotation(level, rng);
  const correctVoxels = rotateVoxels(base, correctRotIdx);

  const optionsPool: SpatialOption[] = [
    {
      voxels: correctVoxels,
      kind: 'rotated',
      rotIndex: correctRotIdx,
      differenceNote: 'Rotación 3D exacta del modelo original: conserva todas las uniones y quiralidad.',
    },
  ];

  // Distractor 1: Imagen especular obligatoria (garantizado no congruente por quiralidad)
  const mirrorRotIdx = chooseNonTrivialRotation(level, rng);
  const mirrored = rotateVoxels(mirrorVoxels(base), mirrorRotIdx);
  optionsPool.push({
    voxels: mirrored,
    kind: 'mirror',
    rotIndex: mirrorRotIdx,
    differenceNote:
      'Imagen especular: al alinear el tramo principal, el brazo extremo gira hacia el lado opuesto.',
  });

  // Distractores adicionales: cubos desplazados (o espejo en otro angulo si fuera imposible)
  let safety = 0;
  while (optionsPool.length < optionCount && safety < 20) {
    safety++;
    const existing = optionsPool.map((o) => o.voxels);
    const perturbed = buildPerturbedDistractor(base, existing, rng);
    if (perturbed) {
      optionsPool.push({
        voxels: perturbed.voxels,
        kind: 'perturbed',
        rotIndex: perturbed.rotIndex,
        differenceNote:
          'Bloque desplazado: uno de los cubos del brazo extremo cambió de cara o distancia.',
      });
    } else {
      const altRot = 1 + ((mirrorRotIdx + safety * 3) % 23);
      const altMirror = rotateVoxels(mirrorVoxels(base), altRot);
      if (
        !areShapesCongruentByRotation(base, altMirror) &&
        !optionsPool.some((o) => shapeKey(o.voxels) === shapeKey(altMirror))
      ) {
        optionsPool.push({
          voxels: altMirror,
          kind: 'mirror',
          rotIndex: altRot,
          differenceNote:
            'Imagen especular rotada: invierte la orientación izquierda-derecha de la figura.',
        });
      }
    }
  }

  // Barajar opciones con RNG sembrado
  const indexed = optionsPool.map((opt, origIdx) => ({ opt, origIdx }));
  for (let i = indexed.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }

  const options = indexed.map((entry) => entry.opt);
  const correctIndex = indexed.findIndex((entry) => entry.origIdx === 0);

  const maxArm = Math.max(2, ...generated.armLengths);
  const hint =
    `Localiza el tramo más largo (${maxArm} cubos) en la figura modelo y comprueba hacia qué lado doblan los brazos extremos respecto a ese eje.`;
  const distractorNotes = options
    .map((opt, idx) => {
      if (idx === correctIndex) return null;
      return opt.kind === 'mirror'
        ? `Opción ${idx + 1}: imagen especular (brazo final apunta al lado opuesto)`
        : `Opción ${idx + 1}: bloque desplazado respecto al brazo original`;
    })
    .filter((v): v is string => v !== null)
    .join('; ');
  const explanation =
    `La opción ${correctIndex + 1} es exactamente la misma figura de ${cubeCount} cubos rotada en el espacio 3D (misma quiralidad). ` +
    `${distractorNotes}.`;

  return {
    level,
    seed,
    cubeCount,
    base,
    options,
    correctIndex,
    correctRotMatrix: ROTATIONS_24[correctRotIdx],
    hint,
    explanation,
  };
}
