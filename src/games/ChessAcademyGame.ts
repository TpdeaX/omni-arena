import '../styles/academy-board.css';
import { synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import { ControlHint, GameContext, MiniGame, RunMetrics } from '../types';
import {
  createAcademyLayout,
  createSectionTutorialEl,
  renderExplanationBox,
  renderLessonStepper,
  SectionTutorialInfo,
} from '../ui/AcademyKit';
import {
  applyMove,
  capturedMaterialByColor,
  CHESS_LESSONS,
  ChessColor,
  ChessLesson,
  ChessLessonStep,
  ChessMove,
  ChessPiece,
  ChessState,
  chooseChessBotMove,
  createInitialChessState,
  evaluateMoveBlunder,
  findKingSquare,
  generateLegalMoves,
  getCoachingHint,
  getGameStatus,
  getLegalMovesFrom,
  isInCheck,
  moveToSpanishSAN,
  moveToUci,
  parseFEN,
  PromotionPiece,
  sqToAlgebraic,
  sqToRowCol,
} from './chess/chessEngine';

type Phase = 'prep' | 'lesson' | 'duel';

function renderChessPieceSvg(piece: ChessPiece): string {
  const isW = piece.color === 'w';
  const fill = isW ? '#f8fafc' : '#1e293b';
  const stroke = isW ? '#1e293b' : '#e2e8f0';
  const detail = isW ? '#334155' : '#94a3b8';

  let body = '';
  switch (piece.type) {
    case 'p':
      body = `
        <circle cx="22.5" cy="13" r="5" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <path d="M17 19c1.5 2 1.5 4.5 0 7l-3 5h17l-3-5c-1.5-2.5-1.5-5 0-7z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
        <rect x="12" y="32" width="21" height="4.5" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      `;
      break;
    case 'r':
      body = `
        <path d="M12 9h4v3h4V9h5v3h4V9h4v6l-3 3v12l3 3H12l3-3V18l-3-3z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
        <line x1="16" y1="18" x2="29" y2="18" stroke="${detail}" stroke-width="1.6"/>
        <rect x="11" y="33" width="23" height="4" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      `;
      break;
    case 'n':
      body = `
        <path d="M14 33l2-9c-3-1-5-4-4-8l3-5 4-3 3 2c5 0 9 4 10 10 1 5 0 9-2 13H14z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="20" cy="14" r="1.5" fill="${stroke}"/>
        <rect x="11" y="33" width="23" height="4" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      `;
      break;
    case 'b':
      body = `
        <circle cx="22.5" cy="8" r="2.5" fill="${fill}" stroke="${stroke}" stroke-width="1.8"/>
        <path d="M22.5 11c-5 3-7 8-5 14l-3 7h16l-3-7c2-6 0-11-5-14z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M19 19l7-4" stroke="${detail}" stroke-width="1.8" stroke-linecap="round"/>
        <rect x="11" y="32.5" width="23" height="4.5" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      `;
      break;
    case 'q':
      body = `
        <circle cx="10" cy="13" r="2.2" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>
        <circle cx="16.5" cy="9.5" r="2.2" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>
        <circle cx="22.5" cy="8" r="2.3" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>
        <circle cx="28.5" cy="9.5" r="2.2" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>
        <circle cx="35" cy="13" r="2.2" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>
        <path d="M11 15l4 13h15l4-13-6 7-5.5-11-5.5 11z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
        <rect x="12" y="29" width="21" height="4" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <rect x="10.5" y="33.5" width="24" height="4" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      `;
      break;
    case 'k':
      body = `
        <line x1="22.5" y1="5" x2="22.5" y2="12" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="19" y1="8.5" x2="26" y2="8.5" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M14 29l-3-9c0-5 4-8 8-7l3.5 2 3.5-2c4-1 8 2 8 7l-3 9H14z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
        <rect x="12" y="29" width="21" height="4" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <rect x="10.5" y="33.5" width="24" height="4" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      `;
      break;
  }

  return `<svg class="oa-piece-svg" viewBox="0 0 45 45" aria-hidden="true">${body}</svg>`;
}

const STAR_SVG = `<svg class="oa-star-marker" viewBox="0 0 24 24" fill="currentColor" stroke="#78350f" stroke-width="1.4" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

export class ChessAcademyGame implements MiniGame {
  public readonly id = 'chess2d' as const;

  private ctx!: GameContext;
  private isGauntletSlice: boolean;

  private stageEl!: HTMLDivElement;
  private sideEl!: HTMLElement;

  private phase: Phase = 'prep';
  private prepActivity: 'lesson' | 'duel' = 'duel';
  private botLevel: 0 | 1 | 2 = 1;
  private humanColor: ChessColor = 'w';
  private flipped = false;

  // Duel / board state
  private state: ChessState = createInitialChessState();
  private undoStack: { state: ChessState; sanLog: string[] }[] = [];
  private sanLog: string[] = [];
  private selectedSq: number | null = null;
  private cursorSq = 52; // e2
  private legalFromSelected: ChessMove[] = [];
  private hintSquares: { from: number; to: number } | null = null;
  private pendingPromotion: { from: number; to: number; moves: ChessMove[] } | null = null;

  private botThinking = false;
  private botTimeout: number | null = null;
  private duelFinished = false;
  private duelHintsUsed = 0;
  private movesPlayedCount = 0;

  // Lesson state
  private activeLessonIndex = 0;
  private activeStepIndex = 0;
  private lessonStarsRemaining = new Set<number>();
  private lessonStepSolved = false;
  private lessonsCompleted = 0;

  // Explanation & UI refs
  private tutorialSlotEl!: HTMLDivElement;
  private explainEl!: HTMLDivElement;
  private stepperEl!: HTMLDivElement;
  private boardContainerEl!: HTMLDivElement;
  private sideContentEl!: HTMLDivElement;

  private paused = false;
  private destroyed = false;
  private elapsed = 0;
  private score = 0;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;

    // Preselect bot level from ctx.difficulty
    if (ctx.difficulty === 'chill') this.botLevel = 0;
    else if (ctx.difficulty === 'hyper') this.botLevel = 2;
    else this.botLevel = 1;

    this.prepActivity = ctx.practiceMode ? 'lesson' : 'duel';

    const layout = createAcademyLayout(
      ctx.container,
      'AJEDREZ ACADEMIA',
      ctx.practiceMode ? 'PRÁCTICA' : 'RETO OFICIAL'
    );
    this.stageEl = layout.stageEl;
    this.sideEl = layout.sideEl;

    this.tutorialSlotEl = document.createElement('div');
    this.stepperEl = document.createElement('div');
    this.sideContentEl = document.createElement('div');
    this.sideContentEl.className = 'oa-academy-card';
    this.explainEl = document.createElement('div');

    this.sideEl.append(this.tutorialSlotEl, this.stepperEl, this.sideContentEl, this.explainEl);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'AJEDREZ ACADEMIA',
      accent: '#A16207',
      timeLeftSec: null,
      subStat: 'PREPARA TU SESIÓN',
    });

    this.updateControlsBar();
    window.addEventListener('keydown', this.onKeyDown);
    this.renderPrep();
  }

  private updateControlsBar(): void {
    const hints: ControlHint[] = [
      { keys: ['Clic'], touch: 'Toca pieza y destino', action: 'Mover / capturar', tone: 'primary' },
      { keys: ['Flechas', 'Enter'], touch: 'Toca casilla', action: 'Navegar tablero' },
      { keys: ['P'], touch: 'Botón Pista', action: 'Pista explicada' },
      { keys: ['F'], touch: 'Botón Girar', action: 'Girar tablero' },
    ];
    if (this.ctx.practiceMode) {
      hints.push({ keys: ['U'], touch: 'Botón Deshacer', action: 'Deshacer jugada' });
    }
    this.ctx.setControls?.(hints);
  }

  private updateSectionTutorial(): void {
    let info: SectionTutorialInfo;
    if (this.phase === 'lesson') {
      const lesson = this.getCurrentLesson();
      info = {
        id: `chess:lesson:${lesson.id}`,
        sectionName: `Lección: ${lesson.title}`,
        steps: [
          'Lee el objetivo del paso en la caja inferior y localiza tus piezas activas en el tablero.',
          'Haz clic en tu pieza para ver los puntos verdes (jugadas legales) y anillos rojos (capturas).',
          'Ejecuta la jugada táctica exacta o pulsa Pista (P) para resaltar casilla de origen y destino.',
        ],
        tip: 'Puedes saltar libremente entre las 10 lecciones guiadas usando los botones numerados de arriba.',
      };
    } else if (this.phase === 'duel') {
      info = {
        id: 'chess:duel',
        sectionName: 'Duelo contra el Bot',
        steps: [
          'Desarrolla caballos y alfiles hacia el centro en las primeras jugadas y pon a salvo tu rey con el enroque.',
          'Antes de soltar una pieza, revisa si queda indefensa o si abres una clavada o tenedor.',
          'Usa Pista (P) para recibir una explicación táctica en español y Girar (F) si prefieres cambiar la perspectiva.',
        ],
        tip: 'En Práctica Guiada el motor te avisa en tiempo real si cometes un error grave y te deja deshacer (U).',
      };
    } else {
      info = {
        id: 'chess:prep',
        sectionName: 'Configurar sesión de Ajedrez',
        steps: [
          `Elige Lecciones (${CHESS_LESSONS.length}) en Práctica Guiada para dominar piezas, mates, clavadas, tenedores y enfiladas.`,
          'Elige Duelo vs Bot para jugar partida completa con reglas FIDE (enroque, al paso y coronación).',
          'Selecciona nivel del bot (Novato, Club o Maestro) y tu color antes de pulsar Empezar.',
        ],
        tip: 'Si eres nuevo, completa primero las 4 bases y pasa luego a los 6 módulos de táctica.',
      };
    }
    this.tutorialSlotEl.replaceChildren(createSectionTutorialEl(info));
  }

  private renderPrep(): void {
    this.phase = 'prep';
    this.updateSectionTutorial();
    this.stepperEl.innerHTML = '';
    this.sideContentEl.innerHTML = '';

    const levelNames = ['Novato', 'Club', 'Maestro'];
    const isPractice = Boolean(this.ctx.practiceMode);

    this.stageEl.innerHTML = '';
    const prep = document.createElement('div');
    prep.className = 'oa-board-prep';
    prep.innerHTML = `
      <h3 class="oa-board-prep-title">Configurar entrenamiento</h3>
      <p class="oa-board-prep-desc">${
        isPractice
          ? `En Práctica Guiada puedes recorrer las ${CHESS_LESSONS.length} lecciones interactivas (movimiento, mates y táctica) o jugar contra el bot con deshacer ilimitado y aviso de errores.`
          : 'En Modo Reto juegas una partida oficial sin deshacer. Tu resultado y precisión actualizan tu eje de Lógica.'
      }</p>

      <div class="oa-board-field">
        <span class="oa-board-field-label">Actividad</span>
        <div class="oa-board-seg" id="oa-chess-act-seg">
          <button type="button" class="oa-board-seg-btn" data-act="lesson" aria-pressed="${this.prepActivity === 'lesson'}">Lecciones (${CHESS_LESSONS.length})</button>
          <button type="button" class="oa-board-seg-btn" data-act="duel" aria-pressed="${this.prepActivity === 'duel'}">Duelo vs Bot</button>
        </div>
      </div>

      <div class="oa-board-field" id="oa-chess-duel-opts">
        <span class="oa-board-field-label">Nivel del Bot</span>
        <div class="oa-board-seg" id="oa-chess-lvl-seg">
          ${[0, 1, 2]
            .map(
              (lvl) =>
                `<button type="button" class="oa-board-seg-btn" data-lvl="${lvl}" aria-pressed="${this.botLevel === lvl}">${levelNames[lvl]}</button>`
            )
            .join('')}
        </div>
      </div>

      <div class="oa-board-field" id="oa-chess-color-opts">
        <span class="oa-board-field-label">Tu color</span>
        <div class="oa-board-seg" id="oa-chess-color-seg">
          <button type="button" class="oa-board-seg-btn" data-color="w" aria-pressed="${this.humanColor === 'w'}">Blancas (salen)</button>
          <button type="button" class="oa-board-seg-btn" data-color="b" aria-pressed="${this.humanColor === 'b'}">Negras</button>
        </div>
      </div>

      <button type="button" class="oa-board-primary-btn" id="oa-chess-start-btn">${Icons.play(18)}<span>Empezar</span></button>
    `;

    this.stageEl.appendChild(prep);

    const duelOptsEl = prep.querySelector<HTMLDivElement>('#oa-chess-duel-opts')!;
    const colorOptsEl = prep.querySelector<HTMLDivElement>('#oa-chess-color-opts')!;
    const syncVisibility = () => {
      const showDuel = this.prepActivity === 'duel';
      duelOptsEl.classList.toggle('is-hidden', !showDuel);
      colorOptsEl.classList.toggle('is-hidden', !showDuel);
    };
    syncVisibility();

    prep.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((btn) => {
      if (!isPractice && btn.dataset.act === 'lesson') {
        btn.disabled = true;
        btn.title = 'Las lecciones están disponibles en Práctica Guiada';
      }
      btn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.prepActivity = btn.dataset.act === 'lesson' ? 'lesson' : 'duel';
        prep.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
          b.setAttribute('aria-pressed', String(b.dataset.act === this.prepActivity))
        );
        syncVisibility();
      });
    });

    prep.querySelectorAll<HTMLButtonElement>('[data-lvl]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.botLevel = Number(btn.dataset.lvl) as 0 | 1 | 2;
        prep.querySelectorAll<HTMLButtonElement>('[data-lvl]').forEach((b) =>
          b.setAttribute('aria-pressed', String(Number(b.dataset.lvl) === this.botLevel))
        );
      });
    });

    prep.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.humanColor = btn.dataset.color === 'b' ? 'b' : 'w';
        prep.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((b) =>
          b.setAttribute('aria-pressed', String(b.dataset.color === this.humanColor))
        );
      });
    });

    prep.querySelector('#oa-chess-start-btn')!.addEventListener('click', () => {
      synthAudio.uiClick();
      if (this.prepActivity === 'lesson') {
        this.startLessons(0, 0);
      } else {
        this.startDuel();
      }
    });

    renderExplanationBox(
      this.explainEl,
      'Listo para empezar',
      isPractice
        ? 'Elige Lecciones para practicar piezas y mates, o Duelo vs Bot para jugar una partida guiada.'
        : 'Elige nivel y color para comenzar tu partida oficial contra el bot.',
      'info'
    );
  }

  private clearBotTimeout(): void {
    if (this.botTimeout !== null) {
      window.clearTimeout(this.botTimeout);
      this.botTimeout = null;
    }
  }

  // ==================== LESSONS ====================

  private startLessons(lessonIdx: number, stepIdx: number): void {
    this.clearBotTimeout();
    this.phase = 'lesson';
    this.activeLessonIndex = lessonIdx;
    this.activeStepIndex = stepIdx;
    this.loadLessonStep();
  }

  private getCurrentLesson(): ChessLesson {
    return CHESS_LESSONS[this.activeLessonIndex];
  }

  private getCurrentStep(): ChessLessonStep {
    return this.getCurrentLesson().steps[this.activeStepIndex];
  }

  private loadLessonStep(): void {
    this.clearBotTimeout();
    this.botThinking = false;
    this.selectedSq = null;
    this.legalFromSelected = [];
    this.hintSquares = null;
    this.pendingPromotion = null;
    this.lessonStepSolved = false;
    this.flipped = false;

    const lesson = this.getCurrentLesson();
    const step = this.getCurrentStep();
    this.state = parseFEN(step.fen);
    this.sanLog = [];
    this.lessonStarsRemaining = new Set(step.stars ?? []);

    this.ctx.setHud({
      subStat: `LECCIÓN ${this.activeLessonIndex + 1}/${CHESS_LESSONS.length} · PASO ${this.activeStepIndex + 1}/${lesson.steps.length}`,
    });

    this.updateSectionTutorial();

    renderLessonStepper(
      this.stepperEl,
      CHESS_LESSONS.map((l) => ({ id: l.id, title: l.title })),
      lesson.id,
      (id) => {
        synthAudio.uiClick();
        const idx = CHESS_LESSONS.findIndex((l) => l.id === id);
        if (idx >= 0) this.startLessons(idx, 0);
      }
    );

    renderExplanationBox(this.explainEl, step.title, step.instruction, 'info');
    this.renderBoardView();
    this.renderLessonSide();
  }

  private renderLessonSide(): void {
    const lesson = this.getCurrentLesson();
    const hasNextStep = this.activeStepIndex + 1 < lesson.steps.length;
    const hasNextLesson = this.activeLessonIndex + 1 < CHESS_LESSONS.length;

    this.sideContentEl.innerHTML = `
      <div class="oa-board-meta-row">
        <span><strong>${lesson.title}</strong> (${this.activeStepIndex + 1}/${lesson.steps.length})</span>
        <span>${this.lessonStepSolved ? 'Completado' : 'En curso'}</span>
      </div>
      <p style="margin:0;font-size:0.86rem;color:var(--ink-secondary);">${lesson.summary}</p>
      <div class="oa-academy-actions">
        <button type="button" class="oa-academy-btn" id="oa-chess-hint-btn">${Icons.lightbulb(16)}<span>Pista (P)</span></button>
        <button type="button" class="oa-academy-btn" id="oa-chess-reset-step">${Icons.refresh(16)}<span>Reintentar</span></button>
        ${
          this.lessonStepSolved && (hasNextStep || hasNextLesson)
            ? `<button type="button" class="oa-board-primary-btn" id="oa-chess-next-step">${Icons.arrowRight(16)}<span>${hasNextStep ? 'Siguiente paso' : 'Siguiente lección'}</span></button>`
            : ''
        }
        <button type="button" class="oa-academy-btn" id="oa-chess-to-duel">Duelo vs Bot</button>
      </div>
    `;

    this.sideContentEl.querySelector('#oa-chess-hint-btn')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.triggerHint();
    });
    this.sideContentEl.querySelector('#oa-chess-reset-step')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.loadLessonStep();
    });
    this.sideContentEl.querySelector('#oa-chess-next-step')?.addEventListener('click', () => {
      synthAudio.uiClick();
      if (hasNextStep) {
        this.startLessons(this.activeLessonIndex, this.activeStepIndex + 1);
      } else if (hasNextLesson) {
        this.startLessons(this.activeLessonIndex + 1, 0);
      }
    });
    this.sideContentEl.querySelector('#oa-chess-to-duel')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.startDuel();
    });
  }

  // ==================== DUEL ====================

  private startDuel(): void {
    this.clearBotTimeout();
    this.phase = 'duel';
    this.stepperEl.innerHTML = '';
    this.state = createInitialChessState();
    this.undoStack = [];
    this.sanLog = [];
    this.selectedSq = null;
    this.legalFromSelected = [];
    this.hintSquares = null;
    this.pendingPromotion = null;
    this.duelFinished = false;
    this.duelHintsUsed = 0;
    this.movesPlayedCount = 0;
    this.botThinking = false;
    this.flipped = this.humanColor === 'b';
    this.cursorSq = this.humanColor === 'w' ? 52 : 12;

    const lvlLabel = ['Novato', 'Club', 'Maestro'][this.botLevel];
    this.ctx.setHud({
      subStat: `DUELO · NIVEL ${lvlLabel.toUpperCase()}`,
    });

    this.updateSectionTutorial();

    renderExplanationBox(
      this.explainEl,
      'Inicio de partida',
      this.humanColor === 'w'
        ? 'Juegas con Blancas y realizas la primera jugada. Controla el centro y desarrolla tus piezas.'
        : 'Juegas con Negras. El bot realiza la apertura inicial.',
      'info'
    );

    this.renderBoardView();
    this.renderDuelSide();

    if (this.state.turn !== this.humanColor) {
      this.scheduleBotTurn();
    }
  }

  private renderDuelSide(): void {
    const isPractice = Boolean(this.ctx.practiceMode);
    const lvlLabel = ['Novato', 'Club', 'Maestro'][this.botLevel];
    const turnLabel = this.state.turn === 'w' ? 'Turno: Blancas' : 'Turno: Negras';
    const canUndo = isPractice && this.undoStack.length > 0 && !this.botThinking && !this.duelFinished;
    const hintsLeft = isPractice ? 'Ilimitadas' : `${Math.max(0, 2 - this.duelHintsUsed)}/2`;

    const formattedLog: string[] = [];
    for (let i = 0; i < this.sanLog.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const w = this.sanLog[i] ?? '';
      const b = this.sanLog[i + 1] ?? '';
      formattedLog.push(`${moveNum}. ${w}${b ? `  ${b}` : ''}`);
    }

    this.sideContentEl.innerHTML = `
      <div class="oa-board-meta-row">
        <span class="oa-turn-pill">
          <span class="oa-turn-dot ${this.state.turn === 'w' ? 'is-white' : 'is-black'}"></span>
          <span>${this.botThinking ? 'Bot pensando…' : turnLabel}</span>
        </span>
        <span>Bot: <strong>${lvlLabel}</strong></span>
      </div>
      <div class="oa-moves-log" aria-label="Historial de jugadas">
        ${formattedLog.length > 0 ? formattedLog.join(' · ') : 'Aún no hay jugadas registradas.'}
      </div>
      <div class="oa-academy-actions">
        <button type="button" class="oa-academy-btn" id="oa-chess-hint-btn" ${this.botThinking || this.duelFinished || (!isPractice && this.duelHintsUsed >= 2) ? 'disabled' : ''} title="Pista explicada (Pista: ${hintsLeft})">
          ${Icons.lightbulb(16)}<span>Pista (${hintsLeft})</span>
        </button>
        <button type="button" class="oa-academy-btn" id="oa-chess-undo-btn" ${canUndo ? '' : 'disabled'} title="${isPractice ? 'Deshacer última jugada (U)' : 'Deshacer solo disponible en Práctica Guiada'}">
          ${Icons.undo(16)}<span>Deshacer</span>
        </button>
        <button type="button" class="oa-academy-btn" id="oa-chess-flip-btn" title="Girar tablero (F)">
          ${Icons.rotateCw(16)}<span>Girar</span>
        </button>
        ${
          isPractice
            ? `<button type="button" class="oa-academy-btn" id="oa-chess-back-prep">${Icons.bookOpen(16)}<span>Lecciones / Config</span></button>`
            : `<button type="button" class="oa-academy-btn" id="oa-chess-resign-btn" ${this.duelFinished ? 'disabled' : ''}>Rendirse</button>`
        }
      </div>
    `;

    this.sideContentEl.querySelector('#oa-chess-hint-btn')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.triggerHint();
    });
    this.sideContentEl.querySelector('#oa-chess-undo-btn')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.triggerUndo();
    });
    this.sideContentEl.querySelector('#oa-chess-flip-btn')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.flipped = !this.flipped;
      this.renderBoardView();
    });
    this.sideContentEl.querySelector('#oa-chess-back-prep')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.clearBotTimeout();
      this.renderPrep();
    });
    this.sideContentEl.querySelector('#oa-chess-resign-btn')?.addEventListener('click', () => {
      if (this.duelFinished) return;
      synthAudio.uiClick();
      this.finishDuel('loss', 'Te rendiste en el duelo.');
    });
  }

  // ==================== BOARD RENDERING ====================

  private renderBoardView(): void {
    this.stageEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'oa-board-stage-wrap';

    const frame = document.createElement('div');
    frame.className = 'oa-grid8-frame';

    const grid = document.createElement('div');
    grid.className = 'oa-grid8';
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', 'Tablero de ajedrez 8 por 8');

    const checkSq = isInCheck(this.state, this.state.turn)
      ? findKingSquare(this.state.board, this.state.turn)
      : -1;

    const legalTargets = new Map<number, ChessMove[]>();
    for (const m of this.legalFromSelected) {
      const arr = legalTargets.get(m.to) ?? [];
      arr.push(m);
      legalTargets.set(m.to, arr);
    }

    for (let vr = 0; vr < 8; vr++) {
      for (let vc = 0; vc < 8; vc++) {
        const row = this.flipped ? 7 - vr : vr;
        const col = this.flipped ? 7 - vc : vc;
        const sq = row * 8 + col;
        const isLight = (row + col) % 2 === 0;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `oa-sq ${isLight ? 'oa-sq-light' : 'oa-sq-dark'}`;
        btn.dataset.sq = String(sq);

        const alg = sqToAlgebraic(sq);
        const piece = this.state.board[sq];
        btn.setAttribute(
          'aria-label',
          piece
            ? `Casilla ${alg}, ${piece.color === 'w' ? 'pieza blanca' : 'pieza negra'}`
            : `Casilla ${alg}`
        );

        if (this.selectedSq === sq) btn.classList.add('is-selected');
        if (this.cursorSq === sq) btn.classList.add('is-cursor');
        if (
          this.state.lastMove &&
          (this.state.lastMove.from === sq || this.state.lastMove.to === sq)
        ) {
          btn.classList.add('is-last-move');
        }
        if (checkSq === sq) btn.classList.add('is-in-check');
        if (
          this.hintSquares &&
          (this.hintSquares.from === sq || this.hintSquares.to === sq)
        ) {
          btn.classList.add('oa-mark-hint');
        }

        const targetMoves = legalTargets.get(sq);
        if (targetMoves && targetMoves.length > 0) {
          const isCapture = targetMoves.some((m) => m.captured !== undefined || m.isEnPassant);
          btn.classList.add(isCapture ? 'oa-mark-capture' : 'oa-mark-legal');
        }

        if (vc === 0) {
          const rankLbl = document.createElement('span');
          rankLbl.className = 'oa-sq-coord-rank';
          rankLbl.textContent = String(8 - row);
          btn.appendChild(rankLbl);
        }
        if (vr === 7) {
          const fileLbl = document.createElement('span');
          fileLbl.className = 'oa-sq-coord-file';
          fileLbl.textContent = String.fromCharCode(97 + col);
          btn.appendChild(fileLbl);
        }

        if (piece) {
          btn.insertAdjacentHTML('beforeend', renderChessPieceSvg(piece));
        } else if (this.phase === 'lesson' && this.lessonStarsRemaining.has(sq)) {
          btn.insertAdjacentHTML('beforeend', STAR_SVG);
        }

        btn.addEventListener('click', () => this.onSquareClick(sq));
        grid.appendChild(btn);
      }
    }

    frame.appendChild(grid);

    if (this.pendingPromotion) {
      const promoOverlay = document.createElement('div');
      promoOverlay.className = 'oa-promo-overlay';
      const promoPieces: { type: PromotionPiece; label: string }[] = [
        { type: 'q', label: 'Dama' },
        { type: 'r', label: 'Torre' },
        { type: 'b', label: 'Alfil' },
        { type: 'n', label: 'Caballo' },
      ];

      const card = document.createElement('div');
      card.className = 'oa-promo-card';
      card.innerHTML = `<h4 class="oa-promo-title">Elige pieza de coronación</h4>`;
      const pGrid = document.createElement('div');
      pGrid.className = 'oa-promo-grid';

      for (const item of promoPieces) {
        const pBtn = document.createElement('button');
        pBtn.type = 'button';
        pBtn.className = 'oa-promo-btn';
        pBtn.innerHTML = `${renderChessPieceSvg({ color: this.state.turn, type: item.type })}<span>${item.label}</span>`;
        pBtn.addEventListener('click', () => {
          const chosen = this.pendingPromotion?.moves.find((m) => m.promotion === item.type);
          this.pendingPromotion = null;
          if (chosen) {
            this.commitHumanMove(chosen);
          } else {
            this.renderBoardView();
          }
        });
        pGrid.appendChild(pBtn);
      }

      card.appendChild(pGrid);
      promoOverlay.appendChild(card);
      frame.appendChild(promoOverlay);
    }

    wrap.appendChild(frame);
    this.stageEl.appendChild(wrap);
    this.boardContainerEl = frame;
  }

  // ==================== INTERACTION ====================

  private onSquareClick(sq: number): void {
    if (this.paused || this.destroyed || this.botThinking || this.pendingPromotion) return;
    if (this.phase === 'prep') return;
    if (this.phase === 'duel' && (this.duelFinished || this.state.turn !== this.humanColor)) return;
    if (this.phase === 'lesson' && this.lessonStepSolved) return;

    this.cursorSq = sq;

    // 1. Check if clicked square is a legal destination for selected piece
    if (this.selectedSq !== null) {
      const matching = this.legalFromSelected.filter((m) => m.to === sq);
      if (matching.length > 0) {
        if (matching.length > 1 && matching[0].promotion) {
          this.pendingPromotion = {
            from: this.selectedSq,
            to: sq,
            moves: matching,
          };
          this.renderBoardView();
          return;
        }
        this.commitHumanMove(matching[0]);
        return;
      }
    }

    // 2. Otherwise select piece of active turn
    const piece = this.state.board[sq];
    const allowedColor = this.phase === 'duel' ? this.humanColor : this.state.turn;
    if (piece && piece.color === allowedColor) {
      if (this.selectedSq === sq) {
        this.selectedSq = null;
        this.legalFromSelected = [];
      } else {
        this.selectedSq = sq;
        this.legalFromSelected = getLegalMovesFrom(this.state, sq);
        synthAudio.uiClick();
      }
      this.renderBoardView();
      return;
    }

    this.selectedSq = null;
    this.legalFromSelected = [];
    this.renderBoardView();
  }

  private commitHumanMove(move: ChessMove): void {
    const prevState = this.state;
    const san = moveToSpanishSAN(prevState, move);
    this.hintSquares = null;
    this.selectedSq = null;
    this.legalFromSelected = [];

    if (this.phase === 'lesson') {
      this.handleLessonMove(prevState, move, san);
      return;
    }

    // Duel mode
    this.undoStack.push({ state: prevState, sanLog: this.sanLog.slice() });
    this.state = applyMove(prevState, move);
    this.sanLog.push(san);
    this.movesPlayedCount++;

    if (move.captured) synthAudio.hitmarker(1);
    else synthAudio.uiClick();

    // Practice blunder check
    if (this.ctx.practiceMode) {
      const statusNow = getGameStatus(this.state);
      if (statusNow.status === 'playing') {
        const blunder = evaluateMoveBlunder(prevState, move);
        if (blunder.isBlunder) {
          renderExplanationBox(this.explainEl, 'Aviso táctico', blunder.message, 'warn');
        } else {
          renderExplanationBox(
            this.explainEl,
            `Jugaste ${san}`,
            'Jugada sólida. El bot analiza su respuesta.',
            'info'
          );
        }
      }
    }

    this.renderBoardView();
    this.renderDuelSide();

    const endCheck = this.checkAndHandleDuelEnd();
    if (!endCheck) {
      this.scheduleBotTurn();
    }
  }

  private handleLessonMove(prevState: ChessState, move: ChessMove, san: string): void {
    const step = this.getCurrentStep();

    if (step.mode === 'stars') {
      this.state = applyMove(prevState, move);
      // Keep turn as 'w' in star-collection drills so player moves their piece continuously
      this.state = { ...this.state, turn: 'w' };
      this.lessonStarsRemaining.delete(move.to);

      if (this.lessonStarsRemaining.size === 0) {
        this.lessonStepSolved = true;
        this.lessonsCompleted++;
        this.score += 120;
        this.ctx.addScore(120, 1);
        synthAudio.puzzleSuccess(this.lessonsCompleted);
        renderExplanationBox(this.explainEl, 'Paso completado', step.successFeedback, 'good');
      } else {
        synthAudio.pickup();
        renderExplanationBox(
          this.explainEl,
          `Estrella recogida (${san})`,
          `Quedan ${this.lessonStarsRemaining.size} estrella(s) en el tablero.`,
          'info'
        );
      }
      this.renderBoardView();
      this.renderLessonSide();
      return;
    }

    if (step.mode === 'find_best') {
      const uci = moveToUci(move);
      const accepted = step.acceptedUci ?? [];
      if (accepted.includes(uci)) {
        this.state = applyMove(prevState, move);
        this.lessonStepSolved = true;
        this.lessonsCompleted++;
        this.score += 150;
        this.ctx.addScore(150, 1);
        synthAudio.puzzleSuccess(this.lessonsCompleted);
        renderExplanationBox(
          this.explainEl,
          `Correcto: ${san}`,
          step.successFeedback,
          'good'
        );
      } else {
        synthAudio.damage();
        renderExplanationBox(
          this.explainEl,
          `${san} no es la idea principal`,
          step.wrongHint,
          'warn'
        );
      }
      this.renderBoardView();
      this.renderLessonSide();
      return;
    }

    // mate_endgame (K+Q vs K)
    this.state = applyMove(prevState, move);
    const status = getGameStatus(this.state);
    if (status.status === 'checkmate') {
      this.lessonStepSolved = true;
      this.lessonsCompleted++;
      this.score += 250;
      this.ctx.addScore(250, 1);
      synthAudio.puzzleSuccess(this.lessonsCompleted);
      renderExplanationBox(this.explainEl, `Jaque mate (${san})`, step.successFeedback, 'good');
      this.renderBoardView();
      this.renderLessonSide();
      return;
    }

    if (status.status !== 'playing') {
      synthAudio.damage();
      renderExplanationBox(
        this.explainEl,
        'Tablas por ahogado',
        'El rey negro quedó sin casillas sin estar en jaque. Pulsa Reintentar para practicar el mate.',
        'warn'
      );
      this.renderBoardView();
      this.renderLessonSide();
      return;
    }

    synthAudio.uiClick();
    this.renderBoardView();
    this.renderLessonSide();

    this.botThinking = true;
    renderExplanationBox(this.explainEl, 'Turno del rey rival', 'Pensando…', 'info');
    this.botTimeout = window.setTimeout(() => {
      if (this.destroyed || this.phase !== 'lesson') return;
      this.botThinking = false;
      const { move: reply } = chooseChessBotMove(this.state, { level: 1 });
      this.state = applyMove(this.state, reply);
      const afterStatus = getGameStatus(this.state);
      if (afterStatus.status !== 'playing') {
        renderExplanationBox(this.explainEl, 'Fin del ejercicio', afterStatus.reason, 'warn');
      } else {
        renderExplanationBox(this.explainEl, step.title, step.instruction, 'info');
      }
      this.renderBoardView();
      this.renderLessonSide();
    }, 25);
  }

  private scheduleBotTurn(): void {
    this.clearBotTimeout();
    this.botThinking = true;
    this.renderDuelSide();
    this.ctx.setHud({ subStat: 'PENSANDO…' });

    this.botTimeout = window.setTimeout(() => {
      if (this.destroyed || this.phase !== 'duel' || this.duelFinished) return;
      const { move } = chooseChessBotMove(this.state, { level: this.botLevel });
      const san = moveToSpanishSAN(this.state, move);
      this.state = applyMove(this.state, move);
      this.sanLog.push(san);
      this.botThinking = false;

      if (move.captured) synthAudio.hitmarker(1);
      else synthAudio.uiClick();

      const lvlLabel = ['Novato', 'Club', 'Maestro'][this.botLevel];
      this.ctx.setHud({ subStat: `DUELO · NIVEL ${lvlLabel.toUpperCase()}` });

      this.renderBoardView();
      this.renderDuelSide();
      this.checkAndHandleDuelEnd();
    }, 20);
  }

  private checkAndHandleDuelEnd(): boolean {
    const res = getGameStatus(this.state);
    if (res.status === 'playing') {
      if (isInCheck(this.state, this.state.turn)) {
        renderExplanationBox(
          this.explainEl,
          'Jaque al rey',
          `${this.state.turn === 'w' ? 'Blancas' : 'Negras'} están en jaque y deben responder al ataque.`,
          'warn'
        );
      }
      return false;
    }

    if (res.status === 'checkmate') {
      const humanWon = res.winner === this.humanColor;
      this.finishDuel(humanWon ? 'win' : 'loss', res.reason);
    } else {
      this.finishDuel('draw', res.reason);
    }
    return true;
  }

  private finishDuel(outcome: 'win' | 'draw' | 'loss', reason: string): void {
    this.duelFinished = true;
    this.clearBotTimeout();
    this.botThinking = false;

    const fullMoves = Math.max(1, this.state.fullmoveNumber);
    const capturedMat = capturedMaterialByColor(this.state.board, this.humanColor);

    let pts = 0;
    let logicPerf = 420;
    if (outcome === 'win') {
      pts = Math.max(400, 1000 + 300 * this.botLevel - 5 * fullMoves);
      logicPerf = Math.min(980, 640 + this.botLevel * 120);
      synthAudio.puzzleSuccess(3);
    } else if (outcome === 'draw') {
      pts = 400;
      logicPerf = 500 + this.botLevel * 40;
      synthAudio.pickup();
    } else {
      pts = 100 + 10 * capturedMat;
      logicPerf = Math.min(540, 260 + capturedMat * 8 + this.botLevel * 30);
      synthAudio.damage();
    }

    this.score = pts;
    this.ctx.addScore(pts, outcome === 'win' ? 1 : 0);

    renderExplanationBox(
      this.explainEl,
      outcome === 'win' ? 'Victoria' : outcome === 'draw' ? 'Tablas' : 'Derrota',
      `${reason} Puntuación de la partida: ${pts}.`,
      outcome === 'win' ? 'good' : outcome === 'draw' ? 'info' : 'bad'
    );
    this.renderDuelSide();

    if (!this.isGauntletSlice) {
      const metrics: Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> = {
        score: this.score,
        maxCombo: outcome === 'win' ? 1 : 0,
        accuracy: outcome === 'win' ? 92 : outcome === 'draw' ? 75 : 55,
        hits: this.movesPlayedCount,
        misses: 0,
        puzzlesSolved: this.lessonsCompleted + (outcome === 'win' ? 1 : 0),
        survived: outcome !== 'loss',
        axisPerformances: {
          logic: logicPerf,
        },
      };
      this.ctx.finish(metrics);
    }
  }

  private triggerHint(): void {
    if (this.botThinking || this.phase === 'prep') return;
    if (this.phase === 'lesson') {
      const step = this.getCurrentStep();
      if (step.mode === 'find_best' && step.acceptedUci && step.acceptedUci.length > 0) {
        const legal = generateLegalMoves(this.state);
        const match = legal.find((m) => step.acceptedUci!.includes(moveToUci(m)));
        if (match) {
          this.hintSquares = { from: match.from, to: match.to };
          renderExplanationBox(
            this.explainEl,
            `Pista: ${moveToSpanishSAN(this.state, match)}`,
            step.wrongHint,
            'info'
          );
          this.renderBoardView();
          return;
        }
      }
      if (step.mode === 'stars' && this.lessonStarsRemaining.size > 0) {
        const firstStar = Array.from(this.lessonStarsRemaining)[0];
        const pieceSq = this.state.board.findIndex((p) => p && p.color === 'w' && p.type !== 'k');
        const from = pieceSq >= 0 ? pieceSq : findKingSquare(this.state.board, 'w');
        this.hintSquares = { from, to: firstStar };
        renderExplanationBox(this.explainEl, 'Pista de recorrido', step.wrongHint, 'info');
        this.renderBoardView();
        return;
      }
    }

    if (this.duelFinished) return;
    if (!this.ctx.practiceMode && this.duelHintsUsed >= 2) {
      this.ctx.toast('Límite de pistas alcanzado en Reto', 'warn');
      return;
    }

    const hint = getCoachingHint(this.state);
    this.duelHintsUsed++;
    this.hintSquares = { from: hint.move.from, to: hint.move.to };
    renderExplanationBox(
      this.explainEl,
      `Pista: ${hint.san}`,
      hint.explanation,
      'info'
    );
    this.renderBoardView();
    if (this.phase === 'duel') this.renderDuelSide();
  }

  private triggerUndo(): void {
    if (!this.ctx.practiceMode || this.phase !== 'duel' || this.botThinking) return;
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.state = prev.state;
    this.sanLog = prev.sanLog;
    this.selectedSq = null;
    this.legalFromSelected = [];
    this.hintSquares = null;
    this.duelFinished = false;

    renderExplanationBox(
      this.explainEl,
      'Jugada deshecha',
      'Volviste al turno anterior para elegir otra línea.',
      'info'
    );
    this.renderBoardView();
    this.renderDuelSide();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed || this.phase === 'prep') return;
    if (e.code === 'Escape' || e.key === '?') return;

    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    const { row, col } = sqToRowCol(this.cursorSq);
    const stepDir = this.flipped ? -1 : 1;

    if (e.code === 'ArrowUp') {
      e.preventDefault();
      const nr = Math.max(0, Math.min(7, row - stepDir));
      this.cursorSq = nr * 8 + col;
      this.renderBoardView();
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      const nr = Math.max(0, Math.min(7, row + stepDir));
      this.cursorSq = nr * 8 + col;
      this.renderBoardView();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      const nc = Math.max(0, Math.min(7, col - stepDir));
      this.cursorSq = row * 8 + nc;
      this.renderBoardView();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      const nc = Math.max(0, Math.min(7, col + stepDir));
      this.cursorSq = row * 8 + nc;
      this.renderBoardView();
    } else if (e.code === 'Enter' || e.code === 'Space') {
      if (this.boardContainerEl && document.activeElement?.closest('.oa-grid8')) {
        // Native button click already fires on Enter/Space if focused inside grid; avoid double fire
        return;
      }
      e.preventDefault();
      this.onSquareClick(this.cursorSq);
    } else if (e.code === 'KeyP') {
      e.preventDefault();
      this.triggerHint();
    } else if (e.code === 'KeyU') {
      e.preventDefault();
      this.triggerUndo();
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      this.flipped = !this.flipped;
      this.renderBoardView();
    }
  };

  public update(dt: number): void {
    if (this.paused || this.destroyed) return;
    this.elapsed += dt;
  }

  public onResize(): void {}

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.clearBotTimeout();
    } else if (
      !this.destroyed &&
      this.phase === 'duel' &&
      !this.duelFinished &&
      this.botThinking &&
      this.state.turn !== this.humanColor
    ) {
      this.scheduleBotTurn();
    }
  }

  public getMetrics(): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    return {
      score: this.score,
      maxCombo: this.lessonsCompleted,
      accuracy: 80,
      hits: this.movesPlayedCount,
      misses: 0,
      puzzlesSolved: this.lessonsCompleted,
      survived: true,
      axisPerformances: {
        logic: Math.min(950, 380 + this.lessonsCompleted * 55 + Math.round(this.score * 0.25)),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    this.clearBotTimeout();
    window.removeEventListener('keydown', this.onKeyDown);
    this.stageEl?.closest('.oa-academy-layout')?.remove();
  }
}
