import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import { GameContext, MiniGame, RunMetrics } from '../types';
import {
  createAcademyLayout,
  createSectionTutorialEl,
  renderExplanationBox,
  renderLessonStepper,
  SectionTutorialInfo,
} from '../ui/AcademyKit';
import {
  applyMove,
  applyMoves,
  BASE_MOVES,
  BaseMove,
  BEGINNER_PHASE_LESSONS,
  cloneCube,
  createLessonExampleCube,
  createSolvedCube,
  CubeState,
  detectBeginnerPhase,
  FACE_COLORS,
  FACE_ORDER,
  FaceKey,
  generateScramble,
  geomToStickerIndex,
  invertMove,
  isSolved,
  Move,
  STICKER_COLOR_HEX,
  StickerColor,
} from './rubik/rubikEngine';
import '../styles/academy-rubik-piano.css';

interface StickerUserData {
  localNormal: THREE.Vector3;
  color: StickerColor;
}

interface CubieEntry {
  group: THREE.Group;
  stickers: THREE.Mesh[];
}

interface QueuedTurn {
  move: Move;
  recordHistory: boolean;
  isExampleStep: boolean;
  stepIndex?: number;
}

interface SavedUserSnapshot {
  cube: CubeState;
  history: Move[];
  solveElapsed: number;
  movesCount: number;
}

type ChallengePhase = 'prep' | 'inspection' | 'solving' | 'done';

const FACE_SHORT_LABEL: Record<BaseMove, string> = {
  U: 'Arriba',
  D: 'Abajo',
  L: 'Izq.',
  R: 'Der.',
  F: 'Frente',
  B: 'Atrás',
};

const FACE_NORMAL_VEC: Record<FaceKey, THREE.Vector3> = {
  U: new THREE.Vector3(0, 1, 0),
  R: new THREE.Vector3(1, 0, 0),
  F: new THREE.Vector3(0, 0, 1),
  D: new THREE.Vector3(0, -1, 0),
  L: new THREE.Vector3(-1, 0, 0),
  B: new THREE.Vector3(0, 0, -1),
};

const DEFAULT_CAM_POS = new THREE.Vector3(4.35, 3.45, 4.75);

export class RubikCube3DGame implements MiniGame {
  public readonly id = 'rubik3d' as const;

  private ctx!: GameContext;
  private readonly isGauntletSlice: boolean;
  private isPractice = false;
  private paused = false;
  private destroyed = false;

  // Logical state
  private cube: CubeState = createSolvedCube();
  private moveHistory: Move[] = [];
  private movesCount = 0;
  private ccwMode = false;
  private showFaceLabels = false;
  private activeLessonId = BEGINNER_PHASE_LESSONS[0].id;
  private savedSnapshot: SavedUserSnapshot | null = null;
  private exampleActive = false;
  private exampleStepIndex = -1;
  private exampleWaitTimer = 0;
  private exampleQueue: Move[] = [];

  // Challenge / timer state
  private selectedChallengeLevel = 1; // 0: 8, 1: 14, 2: 20
  private challengePhase: ChallengePhase = 'prep';
  private inspectionLeft = 15;
  private solveElapsed = 0;
  private practiceElapsed = 0;
  private practiceStarted = false;
  private finishedEmitted = false;

  // Three.js scene
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private cubeRoot!: THREE.Group;
  private pivotGroup!: THREE.Group;
  private cubies: CubieEntry[] = [];
  private faceLabelSprites: THREE.Sprite[] = [];
  private hoverArrowGroup!: THREE.Group;
  private hoveredFace: BaseMove | null = null;
  private sharedGeometries: THREE.BufferGeometry[] = [];
  private sharedMaterials: THREE.Material[] = [];
  private sharedTextures: THREE.Texture[] = [];
  private stickerMaterials!: Record<StickerColor, THREE.MeshStandardMaterial>;

  // Turn animation state
  private turnQueue: QueuedTurn[] = [];
  private activeTurn: {
    move: Move;
    face: FaceKey;
    axis: THREE.Vector3;
    targetAngle: number;
    elapsed: number;
    duration: number;
    cubiesInLayer: CubieEntry[];
    recordHistory: boolean;
    isExampleStep: boolean;
  } | null = null;

  // DOM refs
  private stageEl!: HTMLDivElement;
  private sideEl!: HTMLElement;
  private tutorialSlotEl!: HTMLDivElement;
  private canvasWrapEl: HTMLDivElement | null = null;
  private statusPillEl: HTMLSpanElement | null = null;
  private movesPillEl: HTMLSpanElement | null = null;
  private ccwBtnEl: HTMLButtonElement | null = null;
  private undoBtnEl: HTMLButtonElement | null = null;
  private moveButtons = new Map<BaseMove, HTMLButtonElement>();
  private stepperHostEl: HTMLDivElement | null = null;
  private lessonBodyEl: HTMLDivElement | null = null;
  private progressBarEl: HTMLDivElement | null = null;
  private explainHostEl: HTMLDivElement | null = null;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.isPractice = ctx.practiceMode === true;
    this.destroyed = false;
    this.finishedEmitted = false;
    this.ccwMode = false;
    this.showFaceLabels = false;
    this.turnQueue = [];
    this.activeTurn = null;
    this.savedSnapshot = null;
    this.exampleActive = false;

    const layout = createAcademyLayout(
      ctx.container,
      'CUBO RUBIK 3D',
      this.isPractice ? 'PRÁCTICA GUIADA' : 'MODO RETO'
    );
    this.stageEl = layout.stageEl;
    this.sideEl = layout.sideEl;
    this.tutorialSlotEl = document.createElement('div');
    this.sideEl.appendChild(this.tutorialSlotEl);

    this.selectedChallengeLevel =
      ctx.difficulty === 'chill'
        ? 0
        : ctx.difficulty === 'hyper'
          ? 2
          : ctx.difficulty === 'adaptive'
            ? ctx.getIntensity() >= 1.18
              ? 2
              : ctx.getIntensity() <= 0.92
                ? 0
                : 1
            : 1;

    this.ctx.setHud({
      dimension: '3D',
      phaseLabel: this.isPractice
        ? 'RUBIK 3D · PRÁCTICA'
        : this.isGauntletSlice
          ? 'RUBIK 3D · CIRCUITO'
          : 'RUBIK 3D · RETO',
      accent: '#C2410C',
      timeLeftSec: null,
      subStat: 'Fase 1/5 · 0 giros',
    });

    this.ctx.setControls?.([
      {
        keys: ['U', 'D', 'L', 'R', 'F', 'B'],
        touch: 'Botones U D L R F B',
        action: 'Girar capa (Shift = antihorario)',
        tone: 'primary',
      },
      {
        keys: ["'"],
        touch: "Botón '",
        action: 'Alternar sentido antihorario',
      },
      {
        keys: ['Arrastrar', 'Flechas'],
        touch: 'Arrastrar fondo',
        action: 'Orbitar cámara 3D',
      },
      {
        keys: ['V'],
        touch: 'Vista estándar',
        action: 'Restablecer cámara',
      },
    ]);

    window.addEventListener('keydown', this.onKeyDown);

    if (this.isPractice) {
      this.challengePhase = 'solving';
      this.cube = applyMoves(createSolvedCube(), generateScramble(6, Date.now()));
      this.practiceStarted = true;
      this.buildMainWorkspace();
      this.updateAllUI();
      renderExplanationBox(
        this.explainHostEl!,
        'Mezcla suave lista (6 giros)',
        'Usa los botones U D L R F B para girar capas o abre las 5 fases a la derecha para ver ejemplos animados.',
        'info'
      );
    } else {
      this.challengePhase = 'prep';
      this.cube = createSolvedCube();
      this.renderPrepScreen();
    }
  }

  private lastTutorialKey = '';

  private updateSectionTutorial(): void {
    const key =
      this.challengePhase === 'prep'
        ? 'prep'
        : this.challengePhase === 'inspection'
          ? 'inspection'
          : this.exampleActive
            ? `example:${this.activeLessonId}`
            : `phase:${this.activeLessonId}`;
    if (key === this.lastTutorialKey) return;
    this.lastTutorialKey = key;

    let info: SectionTutorialInfo;
    if (this.challengePhase === 'prep') {
      info = {
        id: 'rubik:prep',
        sectionName: 'Preparar Reto de Rubik 3D',
        steps: [
          'Elige la longitud de mezcla (8, 14 o 20 giros) según tu experiencia.',
          'Al empezar dispones de 15 segundos de inspección para orbitar el cubo y planear la Cruz Blanca.',
          'El cronómetro arranca en cuanto hagas tu primer giro o al concluir la inspección.',
        ],
        tip: 'Activa "Mostrar letras de caras" si estás aprendiendo la notación oficial U D L R F B.',
      };
    } else if (this.challengePhase === 'inspection') {
      info = {
        id: 'rubik:inspection',
        sectionName: 'Fase de Inspección (15 s)',
        steps: [
          'Arrastra el fondo del visor 3D (o usa las flechas) para inspeccionar todas las caras sin girar piezas.',
          'Localiza el centro blanco y las 4 aristas blancas para planificar tus primeros giros.',
          'Pulsa una tecla de cara (U/D/L/R/F/B) o "Empezar cronómetro ya" cuando estés listo.',
        ],
        tip: 'Pulsa V en cualquier momento para regresar a la vista isométrica estándar.',
      };
    } else {
      const lesson =
        BEGINNER_PHASE_LESSONS.find((l) => l.id === this.activeLessonId) ?? BEGINNER_PHASE_LESSONS[0];
      info = {
        id: `rubik:${lesson.id}`,
        sectionName: this.exampleActive
          ? `Demostración: ${lesson.title}`
          : `Guía Rubik: ${lesson.title}`,
        steps: [
          'Usa las teclas U, D, L, R, F, B (o los botones inferiores) para girar cada cara 90° en sentido horario.',
          'Mantén Shift o pulsa el botón apóstrofe (\') para invertir el giro en sentido antihorario.',
          'Sigue los tokens del algoritmo de esta fase o reproduce el ejemplo animado para verlo en cámara lenta.',
        ],
        tip: lesson.tip,
      };
    }
    this.tutorialSlotEl.replaceChildren(createSectionTutorialEl(info));
  }

  private renderPrepScreen(): void {
    this.stageEl.innerHTML = '';
    this.sideEl.querySelectorAll('.oa-rubik-dyn-card').forEach((n) => n.remove());
    this.updateSectionTutorial();

    const prep = document.createElement('div');
    prep.className = 'oa-rp-prep-card';
    prep.innerHTML = `
      <h3 class="oa-rp-prep-title">Preparar Reto de Cubo Rubik 3D</h3>
      <p class="oa-rp-prep-desc">
        Recibirás una mezcla determinista y <strong>15 segundos de inspección</strong> para observar el cubo antes de que arranque el cronómetro.
      </p>
      <div class="oa-rp-choice-row" role="group" aria-label="Longitud de mezcla"></div>
      <button type="button" class="oa-rp-primary-btn" id="oa-rubik-start-challenge">
        ${Icons.play(18)}<span>Empezar Reto (15s inspección)</span>
      </button>
    `;

    const levels = [
      { idx: 0, label: 'Novato (8 giros)' },
      { idx: 1, label: 'Estándar (14 giros)' },
      { idx: 2, label: 'Oficial (20 giros)' },
    ];
    const row = prep.querySelector('.oa-rp-choice-row')!;
    levels.forEach((lvl) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-rp-pill-btn';
      btn.textContent = lvl.label;
      btn.setAttribute('aria-pressed', lvl.idx === this.selectedChallengeLevel ? 'true' : 'false');
      btn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.selectedChallengeLevel = lvl.idx;
        row.querySelectorAll('button').forEach((b, i) => {
          b.setAttribute('aria-pressed', i === lvl.idx ? 'true' : 'false');
        });
      });
      row.appendChild(btn);
    });

    prep.querySelector('#oa-rubik-start-challenge')!.addEventListener('click', () => {
      synthAudio.uiClick();
      const lengths = [8, 14, 20];
      const len = lengths[this.selectedChallengeLevel] ?? 20;
      this.cube = applyMoves(createSolvedCube(), generateScramble(len, Date.now()));
      this.moveHistory = [];
      this.movesCount = 0;
      this.inspectionLeft = 15;
      this.solveElapsed = 0;
      this.challengePhase = 'inspection';
      this.buildMainWorkspace();
      this.updateAllUI();
      renderExplanationBox(
        this.explainHostEl!,
        'Inspección activa (15 s)',
        'Orbita el cubo para planificar tu cruz blanca. El cronómetro inicia al hacer el primer giro o al acabar los 15 s.',
        'warn'
      );
    });

    this.stageEl.appendChild(prep);

    const infoCard = document.createElement('div');
    infoCard.className = 'oa-academy-card oa-rubik-dyn-card';
    const explain = document.createElement('div');
    renderExplanationBox(
      explain,
      'Reglas del Modo Reto',
      'Sin deshacer durante la resolución. La puntuación premia el menor tiempo y menor número de giros.',
      'info'
    );
    infoCard.appendChild(explain);
    this.sideEl.appendChild(infoCard);
  }

  private buildMainWorkspace(): void {
    this.disposeThree();
    this.stageEl.innerHTML = '';
    this.sideEl.querySelectorAll('.oa-rubik-dyn-card').forEach((n) => n.remove());
    this.moveButtons.clear();

    // --- Stage Card ---
    const stageCard = document.createElement('div');
    stageCard.className = 'oa-rp-stage-card';

    // Top toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'oa-rubik-toolbar';

    const leftGroup = document.createElement('div');
    leftGroup.className = 'oa-rubik-toolbar-group';

    const stdViewBtn = document.createElement('button');
    stdViewBtn.type = 'button';
    stdViewBtn.className = 'oa-rp-pill-btn';
    stdViewBtn.innerHTML = `${Icons.eye(16)}<span>Vista estándar</span>`;
    stdViewBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.resetCameraView();
    });

    const labelsBtn = document.createElement('button');
    labelsBtn.type = 'button';
    labelsBtn.className = 'oa-rp-pill-btn';
    labelsBtn.setAttribute('aria-pressed', 'false');
    labelsBtn.textContent = 'Mostrar letras de caras';
    labelsBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.showFaceLabels = !this.showFaceLabels;
      labelsBtn.setAttribute('aria-pressed', this.showFaceLabels ? 'true' : 'false');
      this.faceLabelSprites.forEach((sp) => {
        sp.visible = this.showFaceLabels;
      });
    });
    leftGroup.append(stdViewBtn, labelsBtn);

    const rightGroup = document.createElement('div');
    rightGroup.className = 'oa-rubik-toolbar-group';

    const statusPill = document.createElement('span');
    statusPill.className = 'oa-rubik-status-pill';
    this.statusPillEl = statusPill;

    const movesPill = document.createElement('span');
    movesPill.className = 'oa-rubik-status-pill';
    this.movesPillEl = movesPill;

    rightGroup.append(statusPill, movesPill);
    toolbar.append(leftGroup, rightGroup);

    // 3D Canvas wrapper
    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'oa-rubik-canvas-wrap';
    const hintChip = document.createElement('div');
    hintChip.className = 'oa-rubik-hint-chip';
    hintChip.textContent = 'Arrastra el fondo para rotar la vista · Rueda para zoom';
    canvasWrap.appendChild(hintChip);
    this.canvasWrapEl = canvasWrap;

    // Controls Panel
    const ctrlPanel = document.createElement('div');
    ctrlPanel.className = 'oa-rubik-controls-panel';

    const moveRow = document.createElement('div');
    moveRow.className = 'oa-rubik-move-row';

    for (const face of BASE_MOVES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-rubik-turn-btn';
      btn.dataset.face = face;
      const colorHex = STICKER_COLOR_HEX[FACE_COLORS[face]];
      btn.innerHTML = `
        <span class="oa-rubik-turn-top">
          <span class="oa-rubik-face-dot" style="background:${colorHex}"></span>
          <span class="oa-rubik-turn-letter">${face}</span>
          <span class="oa-rubik-turn-arrow">${Icons.rotateCw(14)}</span>
        </span>
        <span class="oa-rubik-turn-sub">${FACE_SHORT_LABEL[face]}</span>
      `;
      btn.addEventListener('click', () => {
        const move: Move = this.ccwMode ? (`${face}'` as Move) : face;
        this.handleUserMove(move);
      });
      btn.addEventListener('mouseenter', () => this.showHoverArrow(face));
      btn.addEventListener('focus', () => this.showHoverArrow(face));
      btn.addEventListener('mouseleave', () => this.hideHoverArrow(face));
      btn.addEventListener('blur', () => this.hideHoverArrow(face));
      this.moveButtons.set(face, btn);
      moveRow.appendChild(btn);
    }

    const ccwBtn = document.createElement('button');
    ccwBtn.type = 'button';
    ccwBtn.className = 'oa-rubik-ccw-btn';
    ccwBtn.setAttribute('aria-pressed', 'false');
    ccwBtn.innerHTML = `
      <span class="oa-rubik-turn-top">${Icons.rotateCcw(15)}<span>'</span></span>
      <span class="oa-rubik-turn-sub">Horario</span>
    `;
    ccwBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.ccwMode = !this.ccwMode;
      this.syncMoveButtonsAppearance();
      if (this.hoveredFace) {
        this.showHoverArrow(this.hoveredFace);
      }
    });
    this.ccwBtnEl = ccwBtn;
    moveRow.appendChild(ccwBtn);

    const utilityActions = document.createElement('div');
    utilityActions.className = 'oa-academy-actions';

    if (this.isPractice) {
      const undoBtn = document.createElement('button');
      undoBtn.type = 'button';
      undoBtn.innerHTML = `${Icons.undo(16)}<span>Deshacer</span>`;
      undoBtn.addEventListener('click', () => this.handleUndo());
      this.undoBtnEl = undoBtn;

      const softScrambleBtn = document.createElement('button');
      softScrambleBtn.type = 'button';
      softScrambleBtn.innerHTML = `${Icons.refresh(16)}<span>Mezcla suave (6)</span>`;
      softScrambleBtn.addEventListener('click', () => this.startPracticeScramble(6));

      const fullScrambleBtn = document.createElement('button');
      fullScrambleBtn.type = 'button';
      fullScrambleBtn.textContent = 'Mezcla oficial (20)';
      fullScrambleBtn.addEventListener('click', () => this.startPracticeScramble(20));

      const resetSolvedBtn = document.createElement('button');
      resetSolvedBtn.type = 'button';
      resetSolvedBtn.textContent = 'Cubo resuelto';
      resetSolvedBtn.addEventListener('click', () => this.resetToSolvedPractice());

      utilityActions.append(undoBtn, softScrambleBtn, fullScrambleBtn, resetSolvedBtn);
    } else {
      const startNowBtn = document.createElement('button');
      startNowBtn.type = 'button';
      startNowBtn.id = 'oa-rubik-skip-inspect';
      startNowBtn.innerHTML = `${Icons.play(16)}<span>Empezar cronómetro ya</span>`;
      startNowBtn.addEventListener('click', () => {
        if (this.challengePhase === 'inspection') {
          synthAudio.uiClick();
          this.challengePhase = 'solving';
          this.updateAllUI();
        }
      });
      utilityActions.append(startNowBtn);
    }

    ctrlPanel.append(moveRow, utilityActions);
    stageCard.append(toolbar, canvasWrap, ctrlPanel);
    this.stageEl.appendChild(stageCard);

    // --- Side Cards ---
    const progressCard = document.createElement('div');
    progressCard.className = 'oa-academy-card oa-rubik-dyn-card';

    const progressTitle = document.createElement('div');
    progressTitle.className = 'oa-explain-heading';
    progressTitle.textContent = 'Progreso: Método Principiantes (5 fases)';
    const progressBar = document.createElement('div');
    progressBar.className = 'oa-rubik-progress-bar';
    for (let i = 0; i < 5; i++) {
      const seg = document.createElement('div');
      seg.className = 'oa-rubik-progress-seg';
      progressBar.appendChild(seg);
    }
    this.progressBarEl = progressBar;

    const explainHost = document.createElement('div');
    this.explainHostEl = explainHost;
    progressCard.append(progressTitle, progressBar, explainHost);

    const guideCard = document.createElement('div');
    guideCard.className = 'oa-academy-card oa-rubik-dyn-card';
    const guideHeading = document.createElement('div');
    guideHeading.className = 'oa-explain-heading';
    guideHeading.textContent = 'Guía de las 5 fases y ejemplos';

    const stepperHost = document.createElement('div');
    this.stepperHostEl = stepperHost;
    const lessonBody = document.createElement('div');
    this.lessonBodyEl = lessonBody;

    guideCard.append(guideHeading, stepperHost, lessonBody);
    this.sideEl.append(progressCard, guideCard);

    this.initThreeScene(canvasWrap);
    this.syncCubeVisualsFromModel();
    this.syncMoveButtonsAppearance();
    this.renderLessonSection();
  }

  private initThreeScene(container: HTMLElement): void {
    const w = Math.max(280, container.clientWidth || 520);
    const h = Math.max(240, container.clientHeight || 360);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 60);
    this.camera.position.copy(DEFAULT_CAM_POS);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    container.insertBefore(this.renderer.domElement, container.firstChild);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.ctx.settings.reduceMotion;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = false;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = Math.PI * 0.15;
    this.controls.maxPolarAngle = Math.PI * 0.85;
    this.controls.minDistance = 4.2;
    this.controls.maxDistance = 10.5;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    const ambient = new THREE.AmbientLight('#ffffff', 0.95);
    const keyLight = new THREE.DirectionalLight('#ffffff', 0.72);
    keyLight.position.set(5, 8, 6);
    const fillLight = new THREE.DirectionalLight('#b6d4ff', 0.35);
    fillLight.position.set(-6, -4, -5);
    this.scene.add(ambient, keyLight, fillLight);

    this.cubeRoot = new THREE.Group();
    this.pivotGroup = new THREE.Group();
    this.cubeRoot.add(this.pivotGroup);
    this.scene.add(this.cubeRoot);

    this.buildCubies();
    this.buildFaceLabels();
    this.buildHoverArrow();
    this.renderer.render(this.scene, this.camera);
  }

  private createRoundedSquareGeometry(size: number, radius: number): THREE.Shape {
    const half = size / 2;
    const r = Math.min(radius, half * 0.45);
    const s = new THREE.Shape();
    s.moveTo(-half + r, -half);
    s.lineTo(half - r, -half);
    s.quadraticCurveTo(half, -half, half, -half + r);
    s.lineTo(half, half - r);
    s.quadraticCurveTo(half, half, half - r, half);
    s.lineTo(-half + r, half);
    s.quadraticCurveTo(-half, half, -half, half - r);
    s.lineTo(-half, -half + r);
    s.quadraticCurveTo(-half, -half, -half + r, -half);
    return s;
  }

  private buildCubies(): void {
    const bodyShape = this.createRoundedSquareGeometry(0.84, 0.09);
    const bodyGeom = new THREE.ExtrudeGeometry(bodyShape, {
      depth: 0.84,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
    bodyGeom.center();
    this.sharedGeometries.push(bodyGeom);

    const stickerShape = this.createRoundedSquareGeometry(0.76, 0.08);
    const stickerGeom = new THREE.ShapeGeometry(stickerShape);
    this.sharedGeometries.push(stickerGeom);

    const plasticMat = new THREE.MeshStandardMaterial({
      color: '#12161f',
      roughness: 0.42,
      metalness: 0.08,
    });
    this.sharedMaterials.push(plasticMat);

    this.stickerMaterials = {
      Y: new THREE.MeshStandardMaterial({ color: STICKER_COLOR_HEX.Y, roughness: 0.25, metalness: 0.04 }),
      R: new THREE.MeshStandardMaterial({ color: STICKER_COLOR_HEX.R, roughness: 0.25, metalness: 0.04 }),
      G: new THREE.MeshStandardMaterial({ color: STICKER_COLOR_HEX.G, roughness: 0.25, metalness: 0.04 }),
      W: new THREE.MeshStandardMaterial({ color: STICKER_COLOR_HEX.W, roughness: 0.25, metalness: 0.04 }),
      O: new THREE.MeshStandardMaterial({ color: STICKER_COLOR_HEX.O, roughness: 0.25, metalness: 0.04 }),
      B: new THREE.MeshStandardMaterial({ color: STICKER_COLOR_HEX.B, roughness: 0.25, metalness: 0.04 }),
    };
    Object.values(this.stickerMaterials).forEach((m) => this.sharedMaterials.push(m));

    const offset = 0.474;
    const faceConfigs: {
      cond: (x: number, y: number, z: number) => boolean;
      pos: [number, number, number];
      rot: [number, number, number];
      normal: [number, number, number];
      color: StickerColor;
    }[] = [
      { cond: (_x, y) => y === 1, pos: [0, offset, 0], rot: [-Math.PI / 2, 0, 0], normal: [0, 1, 0], color: 'Y' },
      { cond: (_x, y) => y === -1, pos: [0, -offset, 0], rot: [Math.PI / 2, 0, 0], normal: [0, -1, 0], color: 'W' },
      { cond: (_x, _y, z) => z === 1, pos: [0, 0, offset], rot: [0, 0, 0], normal: [0, 0, 1], color: 'G' },
      { cond: (_x, _y, z) => z === -1, pos: [0, 0, -offset], rot: [0, Math.PI, 0], normal: [0, 0, -1], color: 'B' },
      { cond: (x) => x === 1, pos: [offset, 0, 0], rot: [0, Math.PI / 2, 0], normal: [1, 0, 0], color: 'R' },
      { cond: (x) => x === -1, pos: [-offset, 0, 0], rot: [0, -Math.PI / 2, 0], normal: [-1, 0, 0], color: 'O' },
    ];

    this.cubies = [];
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const group = new THREE.Group();
          group.position.set(x, y, z);
          const bodyMesh = new THREE.Mesh(bodyGeom, plasticMat);
          group.add(bodyMesh);

          const stickers: THREE.Mesh[] = [];
          for (const cfg of faceConfigs) {
            if (!cfg.cond(x, y, z)) continue;
            const sticker = new THREE.Mesh(stickerGeom, this.stickerMaterials[cfg.color]);
            sticker.position.set(...cfg.pos);
            sticker.rotation.set(...cfg.rot);
            const ud: StickerUserData = {
              localNormal: new THREE.Vector3(...cfg.normal),
              color: cfg.color,
            };
            sticker.userData = ud;
            group.add(sticker);
            stickers.push(sticker);
          }

          this.cubeRoot.add(group);
          this.cubies.push({ group, stickers });
        }
      }
    }
  }

  private buildFaceLabels(): void {
    this.faceLabelSprites = [];
    for (const face of FACE_ORDER) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const c = canvas.getContext('2d');
      if (c) {
        c.fillStyle = 'rgba(11, 14, 20, 0.85)';
        c.beginPath();
        c.arc(64, 64, 48, 0, Math.PI * 2);
        c.fill();
        c.lineWidth = 6;
        c.strokeStyle = STICKER_COLOR_HEX[FACE_COLORS[face]];
        c.stroke();
        c.fillStyle = '#ffffff';
        c.font = 'bold 60px system-ui, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(face, 64, 66);
      }
      const tex = new THREE.CanvasTexture(canvas);
      this.sharedTextures.push(tex);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
      this.sharedMaterials.push(mat);
      const sprite = new THREE.Sprite(mat);
      const n = FACE_NORMAL_VEC[face];
      sprite.position.copy(n).multiplyScalar(1.88);
      sprite.scale.set(0.62, 0.62, 0.62);
      sprite.visible = this.showFaceLabels;
      this.scene.add(sprite);
      this.faceLabelSprites.push(sprite);
    }
  }

  private buildHoverArrow(): void {
    this.hoverArrowGroup = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: '#00e5ff' });
    this.sharedMaterials.push(mat);

    const arcRadius = 0.78;
    const arcSpan = Math.PI * 1.35;
    const torusGeom = new THREE.TorusGeometry(arcRadius, 0.055, 10, 28, arcSpan);
    this.sharedGeometries.push(torusGeom);
    const torusMesh = new THREE.Mesh(torusGeom, mat);

    const coneGeom = new THREE.ConeGeometry(0.13, 0.3, 12);
    this.sharedGeometries.push(coneGeom);
    const coneMesh = new THREE.Mesh(coneGeom, mat);
    // Arc ends at angle = arcSpan; tangent in XY plane for CCW torus is (-sin, cos)
    const endX = Math.cos(arcSpan) * arcRadius;
    const endY = Math.sin(arcSpan) * arcRadius;
    coneMesh.position.set(endX, endY, 0);
    coneMesh.rotation.z = arcSpan;

    this.hoverArrowGroup.add(torusMesh, coneMesh);
    this.hoverArrowGroup.visible = false;
    this.scene.add(this.hoverArrowGroup);
  }

  private showHoverArrow(face: BaseMove): void {
    this.hoveredFace = face;
    if (!this.hoverArrowGroup) return;
    const normal = FACE_NORMAL_VEC[face];
    this.hoverArrowGroup.position.copy(normal).multiplyScalar(1.66);
    this.hoverArrowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    // Default torus + cone goes CCW in +Z; flip X to show CW when not ccwMode
    this.hoverArrowGroup.scale.set(this.ccwMode ? 1 : -1, 1, 1);
    this.hoverArrowGroup.visible = true;
  }

  private hideHoverArrow(face: BaseMove): void {
    if (this.hoveredFace === face) {
      this.hoveredFace = null;
      if (this.hoverArrowGroup) {
        this.hoverArrowGroup.visible = false;
      }
    }
  }

  private resetCameraView(): void {
    if (!this.camera || !this.controls) return;
    this.camera.position.copy(DEFAULT_CAM_POS);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private orbitBySteps(dTheta: number, dPhi: number): void {
    if (!this.camera || !this.controls) return;
    const offset = this.camera.position.clone().sub(this.controls.target);
    const sph = new THREE.Spherical().setFromVector3(offset);
    sph.theta += dTheta;
    sph.phi = Math.max(Math.PI * 0.15, Math.min(Math.PI * 0.85, sph.phi + dPhi));
    offset.setFromSpherical(sph);
    this.camera.position.copy(this.controls.target).add(offset);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  private syncCubeVisualsFromModel(): void {
    if (!this.cubeRoot || this.cubies.length === 0) return;

    // Reset all cubies back to canonical grid positions
    let idx = 0;
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const entry = this.cubies[idx++];
          if (entry.group.parent !== this.cubeRoot) {
            this.cubeRoot.add(entry.group);
          }
          entry.group.position.set(x, y, z);
          entry.group.quaternion.identity();

          // Reassign each sticker's local normal/color based on its placement in canonical cubie
          for (const sticker of entry.stickers) {
            const ud = sticker.userData as StickerUserData;
            const n = ud.localNormal;
            const sIdx = geomToStickerIndex(
              { x, y, z },
              { x: Math.round(n.x), y: Math.round(n.y), z: Math.round(n.z) }
            );
            const color = this.cube[sIdx];
            ud.color = color;
            sticker.material = this.stickerMaterials[color];
          }
        }
      }
    }
  }

  private verifyRenderedMatchesModel(): void {
    const tmpNormal = new THREE.Vector3();
    for (const entry of this.cubies) {
      const px = Math.round(entry.group.position.x);
      const py = Math.round(entry.group.position.y);
      const pz = Math.round(entry.group.position.z);
      for (const sticker of entry.stickers) {
        const ud = sticker.userData as StickerUserData;
        tmpNormal.copy(ud.localNormal).applyQuaternion(entry.group.quaternion);
        const nx = Math.round(tmpNormal.x);
        const ny = Math.round(tmpNormal.y);
        const nz = Math.round(tmpNormal.z);
        const sIdx = geomToStickerIndex({ x: px, y: py, z: pz }, { x: nx, y: ny, z: nz });
        if (this.cube[sIdx] !== ud.color) {
          this.syncCubeVisualsFromModel();
          return;
        }
      }
    }
  }

  private enqueueTurn(item: QueuedTurn): void {
    this.turnQueue.push(item);
    if (!this.activeTurn) {
      this.startNextTurn();
    }
  }

  private startNextTurn(): void {
    if (this.activeTurn || this.turnQueue.length === 0) return;
    const next = this.turnQueue.shift()!;
    const face = next.move[0] as FaceKey;
    const suffix = next.move.slice(1);
    const axis = FACE_NORMAL_VEC[face];

    // CW looking from outside = -PI/2 around outward normal
    let targetAngle = -Math.PI / 2;
    if (suffix === "'") targetAngle = Math.PI / 2;
    else if (suffix === '2') targetAngle = -Math.PI;

    const cubiesInLayer = this.cubies.filter((c) => {
      const p = c.group.position;
      if (axis.x !== 0) return Math.round(p.x) === axis.x;
      if (axis.y !== 0) return Math.round(p.y) === axis.y;
      return Math.round(p.z) === axis.z;
    });

    this.pivotGroup.position.set(0, 0, 0);
    this.pivotGroup.quaternion.identity();
    for (const c of cubiesInLayer) {
      this.pivotGroup.attach(c.group);
    }

    const baseDur = this.ctx.settings.reduceMotion ? 0.09 : 0.22;
    const duration = suffix === '2' ? baseDur * 1.35 : baseDur;

    this.activeTurn = {
      move: next.move,
      face,
      axis,
      targetAngle,
      elapsed: 0,
      duration,
      cubiesInLayer,
      recordHistory: next.recordHistory,
      isExampleStep: next.isExampleStep,
    };

    if (next.isExampleStep && next.stepIndex !== undefined) {
      this.exampleStepIndex = next.stepIndex;
      this.renderLessonSection();
    }
    synthAudio.uiClick();
  }

  private finishActiveTurn(): void {
    const turn = this.activeTurn;
    if (!turn) return;
    this.pivotGroup.quaternion.setFromAxisAngle(turn.axis, turn.targetAngle);
    this.pivotGroup.updateMatrixWorld(true);

    const rotMat = new THREE.Matrix4();
    const xAxis = new THREE.Vector3();
    const yAxis = new THREE.Vector3();
    const zAxis = new THREE.Vector3();

    for (const c of turn.cubiesInLayer) {
      this.cubeRoot.attach(c.group);
      c.group.position.set(
        Math.round(c.group.position.x),
        Math.round(c.group.position.y),
        Math.round(c.group.position.z)
      );
      rotMat.makeRotationFromQuaternion(c.group.quaternion);
      rotMat.extractBasis(xAxis, yAxis, zAxis);
      xAxis.set(Math.round(xAxis.x), Math.round(xAxis.y), Math.round(xAxis.z));
      yAxis.set(Math.round(yAxis.x), Math.round(yAxis.y), Math.round(yAxis.z));
      zAxis.set(Math.round(zAxis.x), Math.round(zAxis.y), Math.round(zAxis.z));
      rotMat.makeBasis(xAxis, yAxis, zAxis);
      c.group.quaternion.setFromRotationMatrix(rotMat);
    }

    this.pivotGroup.quaternion.identity();
    this.cube = applyMove(this.cube, turn.move);
    if (turn.recordHistory) {
      this.moveHistory.push(turn.move);
      this.movesCount += 1;
    }

    this.verifyRenderedMatchesModel();
    this.activeTurn = null;

    if (!this.exampleActive) {
      this.checkPostMoveState();
    }
    this.updateAllUI();

    if (this.turnQueue.length > 0) {
      this.startNextTurn();
    } else if (this.exampleActive && this.exampleQueue.length > 0) {
      this.exampleWaitTimer = this.ctx.settings.reduceMotion ? 0.14 : 0.28;
    } else if (this.exampleActive && this.exampleQueue.length === 0) {
      this.renderLessonSection();
    }
  }

  private checkPostMoveState(): void {
    const solved = isSolved(this.cube);
    if (!solved) return;

    if (this.isPractice) {
      if (this.movesCount > 0) {
        synthAudio.puzzleSuccess(2);
        this.ctx.addScore(150, 1);
        this.ctx.toast('Cubo resuelto en práctica', 'good');
        renderExplanationBox(
          this.explainHostEl!,
          'Cubo resuelto',
          `Completado en ${this.movesCount} giros (${this.formatClock(this.practiceElapsed)}). Puedes generar otra mezcla cuando quieras.`,
          'good'
        );
      }
      return;
    }

    if (this.challengePhase === 'solving' && !this.finishedEmitted) {
      this.finishedEmitted = true;
      this.challengePhase = 'done';
      synthAudio.puzzleSuccess(3);
      const lenBonus = this.selectedChallengeLevel === 2 ? 300 : this.selectedChallengeLevel === 1 ? 150 : 0;
      const timeScore = Math.max(150, Math.round(1400 - this.solveElapsed * 7));
      const moveEfficiency = Math.max(0.45, Math.min(1, 35 / Math.max(12, this.movesCount)));
      const finalScore = Math.round((timeScore + lenBonus) * moveEfficiency + 400);
      const agilityPerf = Math.max(40, Math.min(100, Math.round(98 - this.solveElapsed * 0.45)));
      const logicPerf = Math.max(45, Math.min(100, Math.round(moveEfficiency * 100)));

      this.ctx.addScore(finalScore, 2);
      this.ctx.finish({
        score: finalScore,
        maxCombo: 1,
        accuracy: Math.round(moveEfficiency * 100),
        puzzlesSolved: 1,
        survived: true,
        axisPerformances: {
          agility: agilityPerf,
          logic: logicPerf,
        },
      });
    }
  }

  private handleUserMove(move: Move): void {
    if (this.paused || this.exampleActive) return;
    if (!this.isPractice && this.challengePhase === 'prep') return;
    if (!this.isPractice && this.challengePhase === 'done') return;

    if (!this.isPractice && this.challengePhase === 'inspection') {
      this.challengePhase = 'solving';
    }
    this.enqueueTurn({
      move,
      recordHistory: true,
      isExampleStep: false,
    });
    this.updateAllUI();
  }

  private handleUndo(): void {
    if (!this.isPractice || this.paused || this.exampleActive) return;
    if (this.activeTurn || this.turnQueue.length > 0) return;
    const last = this.moveHistory.pop();
    if (!last) return;
    this.movesCount = Math.max(0, this.movesCount - 1);
    this.enqueueTurn({
      move: invertMove(last),
      recordHistory: false,
      isExampleStep: false,
    });
    this.updateAllUI();
  }

  private startPracticeScramble(length: number): void {
    if (!this.isPractice) return;
    if (this.exampleActive) this.exitExampleMode(false);
    this.turnQueue = [];
    this.activeTurn = null;
    this.cube = applyMoves(createSolvedCube(), generateScramble(length, Date.now()));
    this.moveHistory = [];
    this.movesCount = 0;
    this.practiceElapsed = 0;
    this.practiceStarted = true;
    this.syncCubeVisualsFromModel();
    this.updateAllUI();
    renderExplanationBox(
      this.explainHostEl!,
      `Mezcla de ${length} giros lista`,
      'Observa las 5 fases a la derecha y resuelve paso a paso sin límite de tiempo.',
      'info'
    );
  }

  private resetToSolvedPractice(): void {
    if (!this.isPractice) return;
    if (this.exampleActive) this.exitExampleMode(false);
    this.turnQueue = [];
    this.activeTurn = null;
    this.cube = createSolvedCube();
    this.moveHistory = [];
    this.movesCount = 0;
    this.practiceElapsed = 0;
    this.syncCubeVisualsFromModel();
    this.updateAllUI();
  }

  private startExampleMode(lessonId: string): void {
    if (!this.isPractice && (this.challengePhase === 'inspection' || this.challengePhase === 'solving')) {
      this.ctx.toast('En Modo Reto termina o pausa la partida para animar ejemplos', 'warn');
      return;
    }
    const lesson = BEGINNER_PHASE_LESSONS.find((l) => l.id === lessonId) ?? BEGINNER_PHASE_LESSONS[0];
    if (!this.savedSnapshot) {
      this.savedSnapshot = {
        cube: cloneCube(this.cube),
        history: this.moveHistory.slice(),
        solveElapsed: this.solveElapsed,
        movesCount: this.movesCount,
      };
    }

    this.turnQueue = [];
    this.activeTurn = null;
    this.exampleActive = true;
    this.exampleStepIndex = -1;
    this.cube = createLessonExampleCube(lesson);
    this.syncCubeVisualsFromModel();
    this.exampleQueue = lesson.demoMoves.slice();
    this.exampleWaitTimer = 0.25;
    this.updateAllUI();
    this.renderLessonSection();

    if (this.explainHostEl) {
      renderExplanationBox(
        this.explainHostEl,
        `Ejemplo: ${lesson.title}`,
        `${lesson.objective} Observa el algoritmo animado paso a paso.`,
        'info'
      );
    }
  }

  private exitExampleMode(restoreCube = true): void {
    this.turnQueue = [];
    this.activeTurn = null;
    this.exampleQueue = [];
    this.exampleActive = false;
    this.exampleStepIndex = -1;
    if (restoreCube && this.savedSnapshot) {
      this.cube = this.savedSnapshot.cube;
      this.moveHistory = this.savedSnapshot.history;
      this.solveElapsed = this.savedSnapshot.solveElapsed;
      this.movesCount = this.savedSnapshot.movesCount;
      this.syncCubeVisualsFromModel();
    }
    this.savedSnapshot = null;
    this.updateAllUI();
    this.renderLessonSection();
  }

  private syncMoveButtonsAppearance(): void {
    for (const [face, btn] of this.moveButtons.entries()) {
      const letterEl = btn.querySelector('.oa-rubik-turn-letter');
      const arrowEl = btn.querySelector('.oa-rubik-turn-arrow');
      if (letterEl) letterEl.textContent = this.ccwMode ? `${face}'` : face;
      if (arrowEl) arrowEl.innerHTML = this.ccwMode ? Icons.rotateCcw(14) : Icons.rotateCw(14);
      btn.disabled = this.exampleActive;
    }
    if (this.ccwBtnEl) {
      this.ccwBtnEl.setAttribute('aria-pressed', this.ccwMode ? 'true' : 'false');
      const sub = this.ccwBtnEl.querySelector('.oa-rubik-turn-sub');
      if (sub) sub.textContent = this.ccwMode ? 'Antihorario activo' : 'Horario';
    }
    if (this.undoBtnEl) {
      this.undoBtnEl.disabled = this.exampleActive || this.moveHistory.length === 0;
    }
  }

  private renderLessonSection(): void {
    this.updateSectionTutorial();
    if (!this.stepperHostEl || !this.lessonBodyEl) return;

    renderLessonStepper(
      this.stepperHostEl,
      BEGINNER_PHASE_LESSONS.map((l) => ({ id: l.id, title: l.shortTitle })),
      this.activeLessonId,
      (id) => {
        synthAudio.uiClick();
        this.activeLessonId = id;
        if (this.exampleActive) {
          this.startExampleMode(id);
        } else {
          this.renderLessonSection();
        }
      }
    );

    const lesson =
      BEGINNER_PHASE_LESSONS.find((l) => l.id === this.activeLessonId) ?? BEGINNER_PHASE_LESSONS[0];

    this.lessonBodyEl.innerHTML = '';

    const objP = document.createElement('p');
    objP.className = 'oa-explain-body';
    objP.textContent = lesson.objective;

    const tipP = document.createElement('p');
    tipP.className = 'oa-explain-body';
    tipP.textContent = `Consejo: ${lesson.tip}`;

    const algList = document.createElement('div');
    algList.className = 'oa-rubik-alg-list';

    lesson.algorithms.forEach((alg, algIdx) => {
      const item = document.createElement('div');
      item.className = 'oa-rubik-alg-item';

      const lbl = document.createElement('span');
      lbl.className = 'oa-rubik-alg-label';
      lbl.textContent = alg.label;

      const tokens = document.createElement('div');
      tokens.className = 'oa-rubik-alg-tokens';
      alg.moves.forEach((m, mIdx) => {
        const tok = document.createElement('span');
        tok.className = 'oa-rubik-token';
        if (this.exampleActive && algIdx === 0) {
          if (mIdx < this.exampleStepIndex) tok.classList.add('is-done');
          else if (mIdx === this.exampleStepIndex) tok.classList.add('is-active');
        }
        tok.textContent = m;
        tokens.appendChild(tok);
      });

      item.append(lbl, tokens);
      algList.appendChild(item);
    });

    const actions = document.createElement('div');
    actions.className = 'oa-academy-actions';

    const canDemo =
      this.isPractice || (this.challengePhase !== 'inspection' && this.challengePhase !== 'solving');

    const demoBtn = document.createElement('button');
    demoBtn.type = 'button';
    demoBtn.disabled = !canDemo;
    demoBtn.innerHTML = `${Icons.play(15)}<span>${this.exampleActive ? 'Repetir ejemplo' : 'Ver ejemplo animado'}</span>`;
    demoBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.startExampleMode(lesson.id);
    });
    actions.appendChild(demoBtn);

    if (this.exampleActive) {
      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'oa-rp-primary-btn';
      backBtn.innerHTML = `${Icons.undo(15)}<span>Volver a mi cubo</span>`;
      backBtn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.exitExampleMode(true);
      });
      actions.appendChild(backBtn);
    }

    this.lessonBodyEl.append(objP, tipP, algList, actions);
  }

  private updateAllUI(): void {
    const phaseInfo = detectBeginnerPhase(this.cube);

    if (this.progressBarEl) {
      const segs = Array.from(this.progressBarEl.children);
      segs.forEach((seg, idx) => {
        seg.classList.toggle('is-done', phaseInfo.completedPhases[idx]);
        seg.classList.toggle(
          'is-current',
          !phaseInfo.solved && !phaseInfo.completedPhases[idx] && idx + 1 === phaseInfo.phase
        );
      });
    }

    if (this.explainHostEl && !this.exampleActive && !isSolved(this.cube)) {
      renderExplanationBox(this.explainHostEl, phaseInfo.title, phaseInfo.summary, 'info');
    }

    if (this.statusPillEl) {
      if (this.isPractice) {
        this.statusPillEl.className = 'oa-rubik-status-pill is-running';
        this.statusPillEl.textContent = `Tiempo ${this.formatClock(this.practiceElapsed)}`;
      } else if (this.challengePhase === 'inspection') {
        this.statusPillEl.className = 'oa-rubik-status-pill is-inspection';
        this.statusPillEl.textContent = `Inspección: ${Math.ceil(this.inspectionLeft)}s`;
      } else {
        this.statusPillEl.className = 'oa-rubik-status-pill is-running';
        this.statusPillEl.textContent = `Cronómetro ${this.formatClock(this.solveElapsed)}`;
      }
    }

    if (this.movesPillEl) {
      this.movesPillEl.textContent = `Giros: ${this.movesCount}`;
    }

    const skipInspectBtn = this.stageEl.querySelector('#oa-rubik-skip-inspect') as HTMLButtonElement | null;
    if (skipInspectBtn) {
      skipInspectBtn.classList.toggle('is-hidden', this.challengePhase !== 'inspection');
    }

    this.syncMoveButtonsAppearance();

    this.ctx.setHud({
      subStat: `Fase ${phaseInfo.completedCount}/5 · ${this.movesCount} giros`,
      timeLeftSec:
        !this.isPractice && this.challengePhase === 'inspection' ? Math.ceil(this.inspectionLeft) : null,
    });
  }

  private formatClock(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed) return;
    if (e.key === 'Escape' || e.key === '?') return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const code = e.code;
    const keyMap: Record<string, BaseMove> = {
      KeyU: 'U',
      KeyD: 'D',
      KeyL: 'L',
      KeyR: 'R',
      KeyF: 'F',
      KeyB: 'B',
    };

    if (code in keyMap) {
      e.preventDefault();
      const face = keyMap[code];
      const useCcw = e.shiftKey !== this.ccwMode;
      const move: Move = useCcw ? (`${face}'` as Move) : face;
      this.handleUserMove(move);
      return;
    }

    if (code === 'Quote' || e.key === "'") {
      e.preventDefault();
      this.ccwMode = !this.ccwMode;
      this.syncMoveButtonsAppearance();
      return;
    }

    if (code === 'KeyV') {
      e.preventDefault();
      this.resetCameraView();
      return;
    }

    if (code === 'KeyZ' && (e.ctrlKey || this.isPractice)) {
      e.preventDefault();
      this.handleUndo();
      return;
    }

    const step = Math.PI / 12; // 15 deg
    if (code === 'ArrowLeft') {
      e.preventDefault();
      this.orbitBySteps(step, 0);
    } else if (code === 'ArrowRight') {
      e.preventDefault();
      this.orbitBySteps(-step, 0);
    } else if (code === 'ArrowUp') {
      e.preventDefault();
      this.orbitBySteps(0, -step);
    } else if (code === 'ArrowDown') {
      e.preventDefault();
      this.orbitBySteps(0, step);
    }
  };

  public update(dt: number, _elapsed: number): void {
    if (this.paused || this.destroyed) return;

    // Timers
    if (this.isPractice && this.practiceStarted && !isSolved(this.cube) && !this.exampleActive) {
      this.practiceElapsed += dt;
      if (this.statusPillEl) {
        this.statusPillEl.textContent = `Tiempo ${this.formatClock(this.practiceElapsed)}`;
      }
    } else if (!this.isPractice) {
      if (this.challengePhase === 'inspection') {
        this.inspectionLeft = Math.max(0, this.inspectionLeft - dt);
        if (this.statusPillEl) {
          this.statusPillEl.textContent = `Inspección: ${Math.ceil(this.inspectionLeft)}s`;
        }
        this.ctx.setHud({ timeLeftSec: Math.ceil(this.inspectionLeft) });
        if (this.inspectionLeft <= 0) {
          this.challengePhase = 'solving';
          this.updateAllUI();
        }
      } else if (this.challengePhase === 'solving') {
        this.solveElapsed += dt;
        if (this.statusPillEl) {
          this.statusPillEl.textContent = `Cronómetro ${this.formatClock(this.solveElapsed)}`;
        }
      }
    }

    // Example animation step spacing
    if (this.exampleActive && !this.activeTurn && this.exampleQueue.length > 0) {
      this.exampleWaitTimer -= dt;
      if (this.exampleWaitTimer <= 0) {
        const nextMove = this.exampleQueue.shift()!;
        const nextStepIdx = this.exampleStepIndex + 1;
        this.enqueueTurn({
          move: nextMove,
          recordHistory: false,
          isExampleStep: true,
          stepIndex: nextStepIdx,
        });
      }
    }

    // Active layer turn animation
    if (this.activeTurn) {
      this.activeTurn.elapsed += dt;
      const t = Math.min(1, this.activeTurn.elapsed / this.activeTurn.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.pivotGroup.quaternion.setFromAxisAngle(
        this.activeTurn.axis,
        this.activeTurn.targetAngle * eased
      );
      if (t >= 1) {
        this.finishActiveTurn();
      }
    }

    if (this.controls) {
      this.controls.update();
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public onResize(): void {
    if (!this.canvasWrapEl || !this.renderer || !this.camera) return;
    const w = Math.max(240, this.canvasWrapEl.clientWidth);
    const h = Math.max(220, this.canvasWrapEl.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getMetrics(): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const phaseInfo = detectBeginnerPhase(this.cube);
    const solved = phaseInfo.solved;
    return {
      score: solved ? 900 : phaseInfo.completedCount * 120,
      maxCombo: 1,
      accuracy: Math.round((phaseInfo.completedCount / 5) * 100),
      puzzlesSolved: solved ? 1 : 0,
      survived: true,
      axisPerformances: {
        agility: solved ? 85 : 35 + phaseInfo.completedCount * 8,
        logic: solved ? 88 : 40 + phaseInfo.completedCount * 9,
      },
    };
  }

  private disposeThree(): void {
    if (this.controls) {
      this.controls.dispose();
    }
    this.sharedGeometries.forEach((g) => g.dispose());
    this.sharedGeometries = [];
    this.sharedMaterials.forEach((m) => m.dispose());
    this.sharedMaterials = [];
    this.sharedTextures.forEach((t) => t.dispose());
    this.sharedTextures = [];
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
    this.cubies = [];
    this.faceLabelSprites = [];
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    this.disposeThree();
  }
}
