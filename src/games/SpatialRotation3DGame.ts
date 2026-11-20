import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import '../styles/academy-intel.css';
import { synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import { GameContext, MiniGame, RunMetrics } from '../types';
import {
  createAcademyLayout,
  createSectionTutorialEl,
  renderDifficultyBadge,
  renderExplanationBox,
  SectionTutorialInfo,
} from '../ui/AcademyKit';
import {
  ROTATIONS_24,
  generateSpatialPuzzle,
  type Mat3,
  type SpatialLevel,
  type SpatialPuzzle,
  type Voxel3D,
} from './intel/spatial3dEngine';

type SpatialChoiceMode = SpatialLevel | 'progressive';

const CHALLENGE_TOTAL = 10;
const DEFAULT_CAM_POS = new THREE.Vector3(4.6, 3.8, 5.4);

function buildPolycubeGroup(
  voxels: readonly Voxel3D[],
  colorHex: string,
  disposables: { geoms: THREE.BufferGeometry[]; mats: THREE.Material[] },
  opacity = 1
): THREE.Group {
  const group = new THREE.Group();
  if (voxels.length === 0) return group;

  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const v of voxels) {
    cx += v.x;
    cy += v.y;
    cz += v.z;
  }
  cx /= voxels.length;
  cy /= voxels.length;
  cz /= voxels.length;

  const boxGeom = new THREE.BoxGeometry(0.94, 0.94, 0.94);
  const edgesGeom = new THREE.EdgesGeometry(boxGeom);
  disposables.geoms.push(boxGeom, edgesGeom);

  const isGhost = opacity < 1;
  const fillMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.32,
    metalness: 0.1,
    transparent: isGhost,
    opacity,
    depthWrite: !isGhost,
  });
  const edgeMat = new THREE.LineBasicMaterial({
    color: isGhost ? '#00e5ff' : '#0b1220',
    transparent: isGhost,
    opacity: isGhost ? 0.55 : 0.72,
  });
  disposables.mats.push(fillMat, edgeMat);

  for (const v of voxels) {
    const holder = new THREE.Group();
    holder.position.set(v.x - cx, v.y - cy, v.z - cz);
    const mesh = new THREE.Mesh(boxGeom, fillMat);
    const edges = new THREE.LineSegments(edgesGeom, edgeMat);
    holder.add(mesh, edges);
    group.add(holder);
  }

  return group;
}

function mat3ToQuaternion(m: Mat3): THREE.Quaternion {
  const m4 = new THREE.Matrix4().set(
    m[0][0], m[0][1], m[0][2], 0,
    m[1][0], m[1][1], m[1][2], 0,
    m[2][0], m[2][1], m[2][2], 0,
    0, 0, 0, 1
  );
  return new THREE.Quaternion().setFromRotationMatrix(m4);
}

export class SpatialRotation3DGame implements MiniGame {
  public readonly id = 'spatial3d' as const;

  private ctx!: GameContext;
  private readonly isGauntletSlice: boolean;
  private practiceMode = false;
  private infiniteMode = false;
  private paused = false;
  private destroyed = false;
  private finished = false;

  private stageEl!: HTMLDivElement;
  private sideEl!: HTMLElement;
  private tutorialSlotEl!: HTMLDivElement;
  private explainEl!: HTMLDivElement;
  private actionBoxEl!: HTMLDivElement;
  private viewportEl: HTMLElement | null = null;

  private phase: 'prep' | 'playing' | 'done' = 'prep';
  private selectedMode: SpatialChoiceMode = 2;
  private baseSeed = (Date.now() ^ 0x4f3a91) & 0x7fffffff;

  private roundIdx = 0;
  private puzzle!: SpatialPuzzle;
  private answered = false;
  private chosenIndex: number | null = null;
  private hintShown = false;

  private roundTimeLimit = 45;
  private roundTimeLeft = 45;
  private totalElapsed = 0;

  private score = 0;
  private hits = 0;
  private misses = 0;
  private combo = 0;
  private maxCombo = 0;
  private reactionTimesMs: number[] = [];

  // Three.js resources
  private webglSupported = true;
  private mainRenderer: THREE.WebGLRenderer | null = null;
  private mainScene: THREE.Scene | null = null;
  private mainCamera: THREE.PerspectiveCamera | null = null;
  private mainControls: OrbitControls | null = null;
  private mainRootGroup: THREE.Group | null = null;
  private mainDisposables: { geoms: THREE.BufferGeometry[]; mats: THREE.Material[] } = {
    geoms: [],
    mats: [],
  };

  private thumbRenderer: THREE.WebGLRenderer | null = null;
  private thumbScene: THREE.Scene | null = null;
  private thumbCamera: THREE.PerspectiveCamera | null = null;
  private thumbRootGroup: THREE.Group | null = null;

  // Practice 3D inspector state
  private inspectedOptionIdx: number | null = null;
  private showGhostModel = false;
  private inspectCandGroup: THREE.Group | null = null;
  private alignAnim: {
    active: boolean;
    elapsed: number;
    duration: number;
    from: THREE.Quaternion;
    to: THREE.Quaternion;
  } | null = null;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.practiceMode = Boolean(ctx.practiceMode);
    this.infiniteMode = Boolean(ctx.infiniteMode) && !this.practiceMode && !this.isGauntletSlice;

    this.roundTimeLimit = ctx.difficulty === 'chill' ? 60 : ctx.difficulty === 'hyper' ? 35 : 45;

    if (this.infiniteMode || ctx.difficulty === 'progressive' || ctx.difficulty === 'adaptive') {
      this.selectedMode = 'progressive';
    } else if (ctx.difficulty === 'chill') {
      this.selectedMode = 1;
    } else if (ctx.difficulty === 'hyper') {
      this.selectedMode = 3;
    } else {
      this.selectedMode = 2;
    }

    const badge = this.practiceMode
      ? 'PRÁCTICA'
      : this.infiniteMode
        ? renderDifficultyBadge(ctx.difficulty, true)
        : `RETO ${CHALLENGE_TOTAL}`;

    const layout = createAcademyLayout(ctx.container, 'ROTACIÓN ESPACIAL 3D', badge);
    this.stageEl = layout.stageEl;
    this.sideEl = layout.sideEl;

    this.tutorialSlotEl = document.createElement('div');
    this.explainEl = document.createElement('div');
    this.actionBoxEl = document.createElement('div');
    this.actionBoxEl.className = 'oa-academy-card';
    this.sideEl.append(this.tutorialSlotEl, this.explainEl, this.actionBoxEl);

    window.addEventListener('keydown', this.onKeyDown);

    this.ctx.setHud({
      dimension: '3D',
      phaseLabel: 'ROTACIÓN ESPACIAL 3D',
      accent: '#2563EB',
      timeLeftSec: null,
      subStat: 'PREPARACIÓN',
    });

    if (this.isGauntletSlice) {
      this.startSession();
    } else {
      this.renderPrep();
    }
  }

  private updateControlsHint(): void {
    if (!this.ctx.setControls) return;
    if (this.phase === 'prep') {
      this.ctx.setControls([
        { keys: ['Clic', 'Enter'], touch: 'Toca Empezar', action: 'Comenzar serie 3D', tone: 'primary' },
      ]);
      return;
    }
    if (this.answered) {
      const hints = [
        { keys: ['Enter', 'Espacio'], touch: 'Toca Siguiente', action: 'Siguiente figura', tone: 'primary' as const },
        { keys: ['Arrastrar'], touch: 'Arrastra el visor', action: 'Inspeccionar ángulo 3D' },
      ];
      this.ctx.setControls(hints);
      return;
    }
    const maxOpt = this.puzzle ? this.puzzle.options.length : 4;
    const hints = [
      { keys: [`1–${maxOpt}`, 'Clic'], touch: 'Toca una candidata', action: 'Elegir figura rotada', tone: 'primary' as const },
      { keys: ['Arrastrar', 'R'], touch: 'Arrastra modelo 3D', action: 'Orbitar vista' },
    ];
    if (this.practiceMode) {
      hints.push({ keys: ['P'], touch: 'Botón Pista', action: 'Pista espacial', tone: 'primary' as const });
    }
    this.ctx.setControls(hints);
  }

  private updateSectionTutorial(): void {
    let info: SectionTutorialInfo;
    if (this.phase === 'prep') {
      info = {
        id: 'spatial3d:prep',
        sectionName: 'Preparar Rotación Espacial 3D',
        steps: [
          'Elige la complejidad inicial (de 6 a 12 cubos) o Progresivo para escalar durante la sesión.',
          'Todas las figuras son quirales: solo una opción es la misma pieza rotada en 3D; las demás son espejos o mutaciones.',
          'Arrastra el visor principal para orbitar la figura modelo desde cualquier ángulo.',
        ],
        tip: 'Busca primero la columna vertebral (el tramo recto más largo) y sigue hacia qué lado giran sus dos extremos.',
      };
    } else if (this.answered && this.practiceMode) {
      info = {
        id: 'spatial3d:inspect',
        sectionName: 'Inspector 3D y Quiralidad',
        steps: [
          'Toca cualquiera de las candidatas para cargarla en el visor 3D interactivo.',
          'Pulsa "Alinear con modelo" para aplicar la rotación 3D y ver si encaja o si es un reflejo especular.',
          'Activa "Superponer fantasma" para comparar cubo por cubo dónde difiere una figura espejo.',
        ],
        tip: 'Un reflejo en espejo nunca puede superponerse mediante giros rígidos en 3 dimensiones.',
      };
    } else {
      info = {
        id: `spatial3d:play:L${this.puzzle.level}`,
        sectionName: `Deducción 3D · Nivel ${this.puzzle.level} (${this.puzzle.cubeCount} cubos)`,
        steps: [
          'Orbita la figura modelo arrastrando el visor 3D (o pulsa R para restablecer el ángulo base).',
          'Cuenta cuántos bloques tiene cada brazo en L y verifica la regla de la mano derecha en los codos.',
          'Selecciona la candidata correcta con clic o teclas 1–4 (usa P en Práctica para una pista de orientación).',
        ],
        tip: 'Si dos opciones tienen las mismas longitudes de brazos, fíjate en el sentido de giro del último cubo.',
      };
    }
    this.tutorialSlotEl.replaceChildren(createSectionTutorialEl(info));
  }

  private renderPrep(): void {
    this.phase = 'prep';
    this.updateSectionTutorial();
    this.disposeMainViewport();
    this.updateControlsHint();
    this.stageEl.innerHTML = '';

    const prep = document.createElement('div');
    prep.className = 'oa-intel-prep';

    const h = document.createElement('h3');
    h.className = 'oa-intel-prep-title';
    h.textContent = 'Rotación Espacial 3D (Shepard-Metzler)';

    const p = document.createElement('p');
    p.className = 'oa-intel-prep-sub';
    if (this.practiceMode) {
      p.textContent =
        'Práctica guiada: identifica la figura rotada en 3D. Después de elegir puedes arrastrar cada candidata en 3D y alinearla sobre el modelo para comprobar su quiralidad.';
    } else if (this.infiniteMode) {
      p.textContent =
        'Modo Infinito Progresivo: sin reloj por figura. Escala de 6 a 13 cubos y ángulos compuestos hasta agotar escudos o pulsar Finalizar y puntuar.';
    } else {
      p.textContent =
        `Modo Reto: ${CHALLENGE_TOTAL} figuras quirales (${this.roundTimeLimit} s por figura). Cada error o tiempo agotado cuesta 1 escudo.`;
    }

    const group = document.createElement('div');
    group.className = 'oa-intel-group';
    const lbl = document.createElement('span');
    lbl.className = 'oa-intel-label';
    lbl.textContent = 'Complejidad inicial';
    const pills = document.createElement('div');
    pills.className = 'oa-intel-pills';

    const modes: { id: SpatialChoiceMode; label: string }[] = [
      { id: 1, label: 'Nivel 1 · 6–7 cubos (3 opc.)' },
      { id: 2, label: 'Nivel 2 · 7–8 cubos (4 opc.)' },
      { id: 3, label: 'Nivel 3 · 9–10 cubos' },
      { id: 4, label: 'Nivel 4 · 10–12 cubos' },
      { id: 'progressive', label: 'Progresivo (6 a 13)' },
    ];

    const renderPills = () => {
      pills.innerHTML = '';
      for (const m of modes) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'oa-intel-pill';
        b.textContent = m.label;
        b.setAttribute('aria-pressed', this.selectedMode === m.id ? 'true' : 'false');
        b.addEventListener('click', () => {
          synthAudio.uiClick();
          this.selectedMode = m.id;
          renderPills();
        });
        pills.appendChild(b);
      }
    };
    renderPills();
    group.append(lbl, pills);

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'oa-intel-primary-btn';
    startBtn.innerHTML = `${Icons.play(17)}<span>Empezar serie 3D</span>`;
    startBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.startSession();
    });

    prep.append(h, p, group, startBtn);
    this.stageEl.appendChild(prep);

    renderExplanationBox(
      this.explainEl,
      'Quiralidad en 3 dimensiones',
      'Toda figura generada es estrictamente quiral (asimétrica como una mano derecha frente a la izquierda). Solo una candidata es el mismo objeto rotado; las demás son espejos o tienen un bloque movido.',
      'info'
    );
    this.actionBoxEl.innerHTML = '';
  }

  private levelForRound(roundIdx: number): { level: SpatialLevel; cubeOverride?: number } {
    if (this.selectedMode !== 'progressive') {
      if (this.infiniteMode) {
        const extra = Math.min(3, Math.floor(roundIdx / 4));
        const baseLvl = Math.min(4, this.selectedMode + Math.floor(roundIdx / 5)) as SpatialLevel;
        return { level: baseLvl, cubeOverride: Math.min(13, 6 + this.selectedMode + extra) };
      }
      return { level: this.selectedMode };
    }
    const intensityBoost = this.ctx.getIntensity() >= 1.35 ? 1 : 0;
    const eff = roundIdx + intensityBoost;
    if (eff < 3) return { level: 1, cubeOverride: 6 + (roundIdx % 2) };
    if (eff < 6) return { level: 2, cubeOverride: 7 + (roundIdx % 2) };
    if (eff < 9) return { level: 3, cubeOverride: 9 + (roundIdx % 2) };
    if (this.infiniteMode) {
      const cubes = Math.min(13, 10 + Math.floor((eff - 9) / 2));
      return { level: 4, cubeOverride: cubes };
    }
    return { level: 4, cubeOverride: Math.min(12, 10 + (roundIdx % 3)) };
  }

  private startSession(): void {
    this.phase = 'playing';
    this.roundIdx = 0;
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.reactionTimesMs = [];
    this.finished = false;
    this.loadNextPuzzle();
  }

  private loadNextPuzzle(): void {
    const { level, cubeOverride } = this.levelForRound(this.roundIdx);
    const seed = (this.baseSeed + this.roundIdx * 7919 + level * 193) >>> 0;
    this.puzzle = generateSpatialPuzzle(level, seed, cubeOverride);
    this.answered = false;
    this.chosenIndex = null;
    this.hintShown = false;
    this.inspectedOptionIdx = null;
    this.showGhostModel = false;
    this.inspectCandGroup = null;
    this.alignAnim = null;
    this.roundTimeLeft = this.roundTimeLimit;

    this.updateSectionTutorial();
    this.updateControlsHint();
    this.renderBoard();
    this.updateHud();
  }

  private updateHud(): void {
    const progressLabel = this.practiceMode
      ? `PRÁCTICA · FIGURA ${this.roundIdx + 1}`
      : this.infiniteMode
        ? `INFINITO · FIGURA ${this.roundIdx + 1}`
        : `FIGURA ${this.roundIdx + 1}/${CHALLENGE_TOTAL}`;
    const showTimer = !this.practiceMode && !this.infiniteMode && this.phase === 'playing' && !this.answered;
    this.ctx.setHud({
      timeLeftSec: showTimer ? Math.ceil(this.roundTimeLeft) : null,
      subStat: `${progressLabel} · ${this.puzzle.cubeCount} CUBOS · ACIERTOS ${this.hits}`,
    });
  }

  private ensureThumbRenderer(): boolean {
    if (!this.webglSupported) return false;
    if (this.thumbRenderer) return true;
    try {
      this.thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.thumbRenderer.setPixelRatio(1);
      this.thumbRenderer.setSize(280, 220);

      this.thumbScene = new THREE.Scene();
      this.thumbCamera = new THREE.PerspectiveCamera(36, 280 / 220, 0.1, 40);
      this.thumbCamera.position.set(5.4, 4.4, 6.2);
      this.thumbCamera.lookAt(0, 0, 0);

      const amb = new THREE.AmbientLight('#ffffff', 0.92);
      const key = new THREE.DirectionalLight('#ffffff', 0.85);
      key.position.set(5, 8, 6);
      const rim = new THREE.DirectionalLight('#60a5fa', 0.35);
      rim.position.set(-5, -4, -4);
      this.thumbScene.add(amb, key, rim);

      this.thumbRootGroup = new THREE.Group();
      this.thumbScene.add(this.thumbRootGroup);
      return true;
    } catch {
      this.webglSupported = false;
      this.thumbRenderer = null;
      return false;
    }
  }

  private renderOptionCanvas(canvas: HTMLCanvasElement, voxels: readonly Voxel3D[], colorHex: string): void {
    canvas.width = 280;
    canvas.height = 220;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    if (this.ensureThumbRenderer() && this.thumbRenderer && this.thumbScene && this.thumbCamera && this.thumbRootGroup) {
      const tempDisposables: { geoms: THREE.BufferGeometry[]; mats: THREE.Material[] } = {
        geoms: [],
        mats: [],
      };
      this.thumbRootGroup.clear();
      const shapeGroup = buildPolycubeGroup(voxels, colorHex, tempDisposables);
      this.thumbRootGroup.add(shapeGroup);

      // Escalar camara para que figuras de 6..13 cubos entren completas
      const span = this.computeSpan(voxels);
      const dist = Math.max(5.2, span * 1.48);
      this.thumbCamera.position.set(dist * 0.78, dist * 0.64, dist * 0.92);
      this.thumbCamera.lookAt(0, 0, 0);
      this.thumbRenderer.render(this.thumbScene, this.thumbCamera);

      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      ctx2d.drawImage(this.thumbRenderer.domElement, 0, 0, canvas.width, canvas.height);

      this.thumbRootGroup.clear();
      tempDisposables.geoms.forEach((g) => g.dispose());
      tempDisposables.mats.forEach((m) => m.dispose());
      return;
    }

    // Respaldo 2D isometrico si WebGL no estuviera disponible
    this.drawIsometricFallback(ctx2d, canvas.width, canvas.height, voxels, colorHex);
  }

  private drawIsometricFallback(
    ctx2d: CanvasRenderingContext2D,
    w: number,
    h: number,
    voxels: readonly Voxel3D[],
    colorHex: string
  ): void {
    ctx2d.clearRect(0, 0, w, h);
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const v of voxels) {
      cx += v.x;
      cy += v.y;
      cz += v.z;
    }
    cx /= Math.max(1, voxels.length);
    cy /= Math.max(1, voxels.length);
    cz /= Math.max(1, voxels.length);

    const scale = 22;
    const projected = voxels
      .map((v) => {
        const dx = v.x - cx;
        const dy = v.y - cy;
        const dz = v.z - cz;
        const px = w / 2 + (dx - dz) * scale * 0.86;
        const py = h / 2 + (dx + dz) * scale * 0.45 - dy * scale * 0.92;
        const depth = dx + dz - dy * 0.2;
        return { px, py, depth };
      })
      .sort((a, b) => a.depth - b.depth);

    for (const pt of projected) {
      ctx2d.fillStyle = colorHex;
      ctx2d.strokeStyle = '#0f172a';
      ctx2d.lineWidth = 2;
      ctx2d.fillRect(pt.px - 12, pt.py - 12, 24, 24);
      ctx2d.strokeRect(pt.px - 12, pt.py - 12, 24, 24);
    }
  }

  private computeSpan(voxels: readonly Voxel3D[]): number {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const v of voxels) {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
      if (v.z < minZ) minZ = v.z;
      if (v.z > maxZ) maxZ = v.z;
    }
    return Math.max(3, maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1);
  }

  private clearMainDisposables(): void {
    if (this.mainRootGroup) {
      this.mainRootGroup.clear();
    }
    this.mainDisposables.geoms.forEach((g) => g.dispose());
    this.mainDisposables.mats.forEach((m) => m.dispose());
    this.mainDisposables = { geoms: [], mats: [] };
    this.inspectCandGroup = null;
  }

  private disposeMainViewport(): void {
    this.clearMainDisposables();
    if (this.mainControls) {
      this.mainControls.dispose();
      this.mainControls = null;
    }
    if (this.mainRenderer) {
      this.mainRenderer.dispose();
      this.mainRenderer.domElement.remove();
      this.mainRenderer = null;
    }
    this.mainScene = null;
    this.mainCamera = null;
    this.mainRootGroup = null;
  }

  private initOrRefreshMainViewport(container: HTMLElement): void {
    this.viewportEl = container;
    this.clearMainDisposables();

    const w = Math.max(240, container.clientWidth || 340);
    const h = Math.max(200, container.clientHeight || 280);

    if (!this.mainRenderer && this.webglSupported) {
      try {
        this.mainScene = new THREE.Scene();
        this.mainCamera = new THREE.PerspectiveCamera(40, w / h, 0.1, 60);
        this.mainCamera.position.copy(DEFAULT_CAM_POS);

        this.mainRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.mainRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.mainRenderer.setSize(w, h);

        this.mainControls = new OrbitControls(this.mainCamera, this.mainRenderer.domElement);
        this.mainControls.enableDamping = !this.ctx.settings.reduceMotion;
        this.mainControls.dampingFactor = 0.08;
        this.mainControls.enablePan = false;
        this.mainControls.minDistance = 3.5;
        this.mainControls.maxDistance = 12;

        const amb = new THREE.AmbientLight('#ffffff', 0.94);
        const key = new THREE.DirectionalLight('#ffffff', 0.85);
        key.position.set(6, 9, 7);
        const fill = new THREE.DirectionalLight('#93c5fd', 0.36);
        fill.position.set(-5, -4, -6);
        this.mainScene.add(amb, key, fill);

        this.mainRootGroup = new THREE.Group();
        this.mainScene.add(this.mainRootGroup);
      } catch {
        this.webglSupported = false;
        this.disposeMainViewport();
      }
    }

    if (this.mainRenderer && this.mainScene && this.mainCamera && this.mainRootGroup && this.mainControls) {
      if (this.mainRenderer.domElement.parentElement !== container) {
        container.insertBefore(this.mainRenderer.domElement, container.firstChild);
      }
      this.mainCamera.aspect = w / h;
      this.mainCamera.updateProjectionMatrix();
      this.mainRenderer.setSize(w, h);

      const inspecting = this.inspectedOptionIdx !== null;
      const targetVoxels = inspecting
        ? this.puzzle.options[this.inspectedOptionIdx!].voxels
        : this.puzzle.base;
      const targetColor = inspecting
        ? this.inspectedOptionIdx === this.puzzle.correctIndex
          ? '#16a34a'
          : '#d97706'
        : '#0284c7';

      const mainShape = buildPolycubeGroup(targetVoxels, targetColor, this.mainDisposables);
      this.mainRootGroup.add(mainShape);
      this.inspectCandGroup = inspecting ? mainShape : null;

      if (inspecting && this.showGhostModel) {
        const ghost = buildPolycubeGroup(this.puzzle.base, '#00e5ff', this.mainDisposables, 0.28);
        this.mainRootGroup.add(ghost);
      }

      const span = this.computeSpan(targetVoxels);
      const dist = Math.max(4.6, span * 1.38);
      this.mainCamera.position.set(dist * 0.78, dist * 0.62, dist * 0.92);
      this.mainControls.target.set(0, 0, 0);
      this.mainControls.update();
      this.mainRenderer.render(this.mainScene, this.mainCamera);
      return;
    }

    // Fallback 2D canvas if WebGL is missing
    const fallback = document.createElement('canvas');
    fallback.width = w;
    fallback.height = h;
    const c2d = fallback.getContext('2d');
    if (c2d) {
      const vox =
        this.inspectedOptionIdx !== null
          ? this.puzzle.options[this.inspectedOptionIdx].voxels
          : this.puzzle.base;
      this.drawIsometricFallback(c2d, w, h, vox, '#0284c7');
    }
    container.insertBefore(fallback, container.firstChild);
  }

  private resetViewportCamera(): void {
    if (!this.mainCamera || !this.mainControls) return;
    const span = this.computeSpan(this.puzzle.base);
    const dist = Math.max(4.6, span * 1.38);
    this.mainCamera.position.set(dist * 0.78, dist * 0.62, dist * 0.92);
    this.mainControls.target.set(0, 0, 0);
    this.mainControls.update();
  }

  private alignInspectedToModel(): void {
    if (!this.inspectCandGroup || this.inspectedOptionIdx === null) return;
    const opt = this.puzzle.options[this.inspectedOptionIdx];
    const rotMat3 = ROTATIONS_24[opt.rotIndex] ?? this.puzzle.correctRotMatrix;
    const invQuat = mat3ToQuaternion(rotMat3).invert();

    this.showGhostModel = true;
    // Asegurar que exista el fantasma del modelo en la escena
    if (this.mainRootGroup && this.mainRootGroup.children.length === 1) {
      const ghost = buildPolycubeGroup(this.puzzle.base, '#00e5ff', this.mainDisposables, 0.28);
      this.mainRootGroup.add(ghost);
    }

    if (this.ctx.settings.reduceMotion) {
      this.inspectCandGroup.quaternion.copy(invQuat);
      this.alignAnim = null;
    } else {
      this.alignAnim = {
        active: true,
        elapsed: 0,
        duration: 0.55,
        from: this.inspectCandGroup.quaternion.clone(),
        to: invQuat,
      };
    }
    this.renderSidePanel();
  }

  private renderBoard(): void {
    // Desacoplar canvas vivo antes de limpiar stageEl para reusarlo sin perder contexto WebGL
    if (this.mainRenderer && this.mainRenderer.domElement.parentElement) {
      this.mainRenderer.domElement.remove();
    }
    this.stageEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'oa-spatial-wrap';

    // Meta row
    const meta = document.createElement('div');
    meta.className = 'oa-intel-meta-row';
    meta.style.width = '100%';

    const chipLevel = document.createElement('span');
    chipLevel.className = 'oa-intel-stat-chip';
    chipLevel.textContent = `Nivel ${this.puzzle.level} · ${this.puzzle.cubeCount} cubos quirales`;

    const chipProg = document.createElement('span');
    chipProg.className = 'oa-intel-stat-chip';
    chipProg.textContent = this.practiceMode
      ? `Figura ${this.roundIdx + 1} · Aciertos ${this.hits}`
      : this.infiniteMode
        ? `Infinito · Figura ${this.roundIdx + 1} · Aciertos ${this.hits}`
        : `Figura ${this.roundIdx + 1} / ${CHALLENGE_TOTAL} · Aciertos ${this.hits}`;

    meta.append(chipLevel, chipProg);

    // Split 3D grid
    const grid = document.createElement('div');
    grid.className = 'oa-spatial-grid';

    // Left: 3D viewport (Modelo o Comparador en Práctica)
    const modelCard = document.createElement('div');
    modelCard.className = 'oa-spatial-model-card';

    const modelHead = document.createElement('div');
    modelHead.className = 'oa-spatial-card-head';

    const modelTitle = document.createElement('span');
    modelTitle.className = 'oa-spatial-card-title';
    modelTitle.textContent =
      this.inspectedOptionIdx !== null
        ? `Visor 3D: Opción ${this.inspectedOptionIdx + 1}`
        : 'Figura Modelo 3D';

    const headBtns = document.createElement('div');
    headBtns.style.display = 'flex';
    headBtns.style.gap = '6px';

    if (this.inspectedOptionIdx !== null) {
      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'oa-spatial-mini-btn';
      backBtn.innerHTML = `${Icons.cube3d(14)}<span>Ver Modelo</span>`;
      backBtn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.inspectedOptionIdx = null;
        this.showGhostModel = false;
        this.renderBoard();
      });
      headBtns.appendChild(backBtn);
    }

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'oa-spatial-mini-btn';
    resetBtn.innerHTML = `${Icons.refresh(14)}<span>Centrar (R)</span>`;
    resetBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.resetViewportCamera();
    });
    headBtns.appendChild(resetBtn);
    modelHead.append(modelTitle, headBtns);

    const viewport = document.createElement('div');
    viewport.className = 'oa-spatial-viewport';

    const chipHint = document.createElement('span');
    chipHint.className = 'oa-spatial-viewport-chip';
    chipHint.textContent =
      this.inspectedOptionIdx !== null
        ? 'Arrastra para girar esta opción en 3D'
        : 'Arrastra para rotar el modelo 3D';
    viewport.appendChild(chipHint);

    modelCard.append(modelHead, viewport);

    // Right: Options grid
    const optsCard = document.createElement('div');
    optsCard.className = 'oa-spatial-options-card';

    const optsHead = document.createElement('div');
    optsHead.className = 'oa-spatial-card-head';
    const optsTitle = document.createElement('span');
    optsTitle.className = 'oa-spatial-card-title';
    optsTitle.textContent = `Candidatas (${this.puzzle.options.length})`;
    optsHead.appendChild(optsTitle);

    const optsGrid = document.createElement('div');
    optsGrid.className = 'oa-spatial-options-grid';
    optsGrid.setAttribute('role', 'group');
    optsGrid.setAttribute('aria-label', 'Candidatas de rotación 3D');

    this.puzzle.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-spatial-opt';
      const canInspectAfter = this.practiceMode && this.answered;
      btn.disabled = this.answered && !canInspectAfter;
      btn.setAttribute('aria-label', `Opción ${idx + 1}`);

      if (this.answered) {
        if (idx === this.puzzle.correctIndex) btn.classList.add('is-correct');
        else if (idx === this.chosenIndex) btn.classList.add('is-wrong');
      }
      if (this.inspectedOptionIdx === idx) {
        btn.classList.add('is-inspecting');
      }

      const optCanvas = document.createElement('canvas');
      const optColor =
        this.answered && idx === this.puzzle.correctIndex
          ? '#16a34a'
          : this.answered && idx === this.chosenIndex
            ? '#dc2626'
            : '#3b82f6';
      this.renderOptionCanvas(optCanvas, opt.voxels, optColor);

      const tag = document.createElement('span');
      tag.className = 'oa-spatial-opt-tag';
      tag.textContent = canInspectAfter
        ? `Opción ${idx + 1} · Girar 3D`
        : `Opción ${idx + 1}`;

      btn.append(optCanvas, tag);
      btn.addEventListener('click', () => {
        if (!this.answered) {
          this.selectOption(idx);
        } else if (this.practiceMode) {
          synthAudio.uiClick();
          this.inspectedOptionIdx = idx;
          this.renderBoard();
        }
      });
      optsGrid.appendChild(btn);
    });

    optsCard.append(optsHead, optsGrid);
    grid.append(modelCard, optsCard);
    wrap.append(meta, grid);
    this.stageEl.appendChild(wrap);

    this.initOrRefreshMainViewport(viewport);
    this.renderSidePanel();
  }

  private renderSidePanel(): void {
    if (!this.answered) {
      if (this.hintShown) {
        renderExplanationBox(this.explainEl, 'Pista espacial', this.puzzle.hint, 'info');
      } else {
        renderExplanationBox(
          this.explainEl,
          'Encuentra la figura rotada',
          'Compara la estructura de brazos del Modelo 3D con las candidatas. Descarta reflejos en espejo y bloques desplazados.',
          'info'
        );
      }
    }

    this.actionBoxEl.innerHTML = '';
    const actions = document.createElement('div');
    actions.className = 'oa-academy-actions';

    if (!this.answered && this.practiceMode) {
      const hintBtn = document.createElement('button');
      hintBtn.type = 'button';
      hintBtn.innerHTML = `${Icons.lightbulb(16)}<span>Pista razonada (P)</span>`;
      hintBtn.addEventListener('click', () => this.showHint());
      actions.appendChild(hintBtn);
    }

    if (this.answered) {
      if (this.practiceMode && this.inspectedOptionIdx !== null) {
        const alignBtn = document.createElement('button');
        alignBtn.type = 'button';
        alignBtn.innerHTML = `${Icons.rotateCw(16)}<span>Alinear con modelo</span>`;
        alignBtn.addEventListener('click', () => {
          synthAudio.uiClick();
          this.alignInspectedToModel();
        });
        actions.appendChild(alignBtn);
      }

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'oa-intel-primary-btn';
      const isLastChallenge = !this.practiceMode && !this.infiniteMode && this.roundIdx + 1 >= CHALLENGE_TOTAL;
      nextBtn.innerHTML = `<span>${isLastChallenge ? 'Ver resultado final' : 'Siguiente figura'}</span>${Icons.arrowRight(16)}`;
      nextBtn.addEventListener('click', () => this.advanceRound());
      actions.appendChild(nextBtn);
    }

    if (this.practiceMode) {
      const levelWrap = document.createElement('div');
      levelWrap.className = 'oa-intel-group';
      const lbl = document.createElement('span');
      lbl.className = 'oa-intel-label';
      lbl.textContent = 'Cambiar nivel en práctica';
      const pills = document.createElement('div');
      pills.className = 'oa-intel-pills';
      ([1, 2, 3, 4] as SpatialLevel[]).forEach((lv) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'oa-intel-pill';
        b.textContent = `N${lv}`;
        b.setAttribute('aria-pressed', this.selectedMode === lv ? 'true' : 'false');
        b.addEventListener('click', () => {
          synthAudio.uiClick();
          this.selectedMode = lv;
          this.roundIdx++;
          this.loadNextPuzzle();
        });
        pills.appendChild(b);
      });
      levelWrap.append(lbl, pills);
      this.actionBoxEl.appendChild(levelWrap);
    }

    if (actions.children.length > 0) {
      this.actionBoxEl.appendChild(actions);
    }
  }

  private showHint(): void {
    if (this.answered || !this.practiceMode) return;
    synthAudio.uiClick();
    this.hintShown = true;
    this.renderSidePanel();
  }

  private selectOption(idx: number): void {
    if (this.answered || this.phase !== 'playing') return;
    this.answered = true;
    this.chosenIndex = idx;

    const usedMs = Math.max(250, Math.round((this.roundTimeLimit - this.roundTimeLeft) * 1000));
    this.reactionTimesMs.push(usedMs);

    const correct = idx === this.puzzle.correctIndex;
    if (correct) {
      this.hits++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const timeBonus = this.practiceMode || this.infiniteMode ? 0 : Math.round(this.roundTimeLeft * 4);
      const pts = 160 + this.puzzle.cubeCount * 12 + timeBonus;
      this.score += pts;
      this.ctx.addScore(pts, 1);
      synthAudio.puzzleSuccess(this.combo);
      renderExplanationBox(
        this.explainEl,
        `Correcto (Opción ${idx + 1})`,
        this.puzzle.explanation,
        'good'
      );
    } else {
      this.misses++;
      this.combo = 0;
      this.ctx.breakCombo();
      synthAudio.damage();

      const remShields = this.practiceMode ? 1 : this.ctx.damage(1);
      renderExplanationBox(
        this.explainEl,
        `Incorrecto · La correcta era la opción ${this.puzzle.correctIndex + 1}`,
        this.puzzle.explanation,
        'bad'
      );
      if (!this.practiceMode && remShields <= 0) {
        this.updateHud();
        this.finishRun(false);
        return;
      }
    }

    if (this.practiceMode) {
      this.inspectedOptionIdx = idx;
      this.showGhostModel = false;
    }

    this.updateSectionTutorial();
    this.updateControlsHint();
    this.renderBoard();
    this.updateHud();
  }

  private handleTimeout(): void {
    if (this.answered || this.phase !== 'playing' || this.practiceMode || this.infiniteMode) return;
    this.answered = true;
    this.chosenIndex = null;
    this.misses++;
    this.combo = 0;
    this.ctx.breakCombo();
    this.reactionTimesMs.push(this.roundTimeLimit * 1000);
    synthAudio.damage();

    const remShields = this.ctx.damage(1);
    renderExplanationBox(
      this.explainEl,
      `Tiempo agotado · Opción correcta: ${this.puzzle.correctIndex + 1}`,
      this.puzzle.explanation,
      'warn'
    );
    if (remShields <= 0) {
      this.updateHud();
      this.finishRun(false);
      return;
    }

    this.updateSectionTutorial();
    this.updateControlsHint();
    this.renderBoard();
    this.updateHud();
  }

  private advanceRound(): void {
    if (this.phase !== 'playing') return;
    synthAudio.uiClick();
    if (!this.practiceMode && !this.infiniteMode && this.roundIdx + 1 >= CHALLENGE_TOTAL) {
      this.finishRun(true);
      return;
    }
    this.roundIdx++;
    this.loadNextPuzzle();
  }

  private finishRun(survived: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.phase = 'done';
    this.ctx.finish(this.getMetrics(survived));
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'Escape' || e.key === '?') return;

    if (this.phase === 'prep') {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.startSession();
      }
      return;
    }

    if (this.phase !== 'playing') return;

    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      this.resetViewportCamera();
      return;
    }

    if (this.answered) {
      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.advanceRound();
      }
      return;
    }

    if ((e.key === 'p' || e.key === 'P') && this.practiceMode) {
      e.preventDefault();
      this.showHint();
      return;
    }

    const num = Number(e.key);
    if (Number.isInteger(num) && num >= 1 && num <= this.puzzle.options.length) {
      e.preventDefault();
      this.selectOption(num - 1);
    }
  };

  public update(dt: number, _elapsed: number): void {
    if (this.paused || this.destroyed || this.phase !== 'playing') return;
    this.totalElapsed += dt;

    if (!this.practiceMode && !this.infiniteMode && !this.answered) {
      const prevSec = Math.ceil(this.roundTimeLeft);
      this.roundTimeLeft = Math.max(0, this.roundTimeLeft - dt);
      const nextSec = Math.ceil(this.roundTimeLeft);
      if (nextSec !== prevSec) {
        this.ctx.setHud({ timeLeftSec: nextSec });
      }
      if (this.roundTimeLeft <= 0) {
        this.handleTimeout();
      }
    }

    if (this.alignAnim && this.alignAnim.active && this.inspectCandGroup) {
      this.alignAnim.elapsed += dt;
      const t = Math.min(1, this.alignAnim.elapsed / this.alignAnim.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.inspectCandGroup.quaternion.slerpQuaternions(
        this.alignAnim.from,
        this.alignAnim.to,
        eased
      );
      if (t >= 1) {
        this.alignAnim.active = false;
      }
    }

    if (this.mainControls) {
      this.mainControls.update();
    }
    if (this.mainRenderer && this.mainScene && this.mainCamera) {
      this.mainRenderer.render(this.mainScene, this.mainCamera);
    }

    if (this.isGauntletSlice && this.totalElapsed >= 15 && !this.finished) {
      this.finishRun(true);
    }
  }

  public onResize(): void {
    if (!this.viewportEl || !this.mainRenderer || !this.mainCamera) return;
    const w = Math.max(240, this.viewportEl.clientWidth);
    const h = Math.max(200, this.viewportEl.clientHeight);
    this.mainCamera.aspect = w / h;
    this.mainCamera.updateProjectionMatrix();
    this.mainRenderer.setSize(w, h);
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getMetrics(
    survived = this.hits > 0 || this.practiceMode
  ): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const total = Math.max(1, this.hits + this.misses);
    const accuracy = Math.round((this.hits / total) * 100);
    const avgReactionMs =
      this.reactionTimesMs.length > 0
        ? Math.round(this.reactionTimesMs.reduce((a, b) => a + b, 0) / this.reactionTimesMs.length)
        : undefined;
    const ratio = this.infiniteMode
      ? Math.min(1, this.hits / 12)
      : Math.min(1, this.hits / CHALLENGE_TOTAL);
    const axisScore = Math.min(1000, Math.round(240 + ratio * 700 * (accuracy / 100)));

    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy,
      avgReactionMs,
      hits: this.hits,
      misses: this.misses,
      puzzlesSolved: this.hits,
      survived,
      axisPerformances: {
        agility: axisScore,
        logic: axisScore,
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.disposeMainViewport();
    if (this.thumbRootGroup) {
      this.thumbRootGroup.clear();
      this.thumbRootGroup = null;
    }
    if (this.thumbRenderer) {
      this.thumbRenderer.dispose();
      this.thumbRenderer = null;
    }
    this.thumbScene = null;
    this.thumbCamera = null;
  }
}
