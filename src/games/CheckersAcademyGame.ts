import '../styles/academy-board.css';
import { synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import { ControlHint, GameContext, MiniGame, RunMetrics } from '../types';
import {
  createAcademyLayout,
  renderExplanationBox,
  renderLessonStepper,
} from '../ui/AcademyKit';
import {
  applyCheckersStep,
  CHECKERS_LESSONS,
  CheckersColor,
  CheckersLesson,
  CheckersLessonStep,
  CheckersMove,
  CheckersPiece,
  CheckersState,
  chooseCheckersBotMove,
  countCheckersPieces,
  createInitialCheckersState,
  getCheckersGameStatus,
  getCheckersHint,
  getForcedCaptureSquares,
  getValidNextStepSquares,
  sqToAlgebraic,
  sqToRowCol,
  applyCheckersMove,
} from './checkers/checkersEngine';

type Phase = 'prep' | 'lesson' | 'duel';

function renderCheckerPieceSvg(piece: CheckersPiece): string {
  const isW = piece.color === 'w';
  const fill = isW ? '#f8fafc' : '#1e293b';
  const ring = isW ? '#cbd5e1' : '#475569';
  const stroke = isW ? '#334155' : '#e2e8f0';
  const crown = piece.king
    ? `<path d="M13 28h19l2-11-5.5 4.5L22.5 14l-6 7.5L11 17z" fill="${isW ? '#d97706' : '#fbbf24'}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/>`
    : '';

  return `
    <svg class="oa-piece-svg" viewBox="0 0 45 45" aria-hidden="true">
      <circle cx="22.5" cy="24.5" r="16" fill="rgba(0,0,0,0.28)"/>
      <circle cx="22.5" cy="22.5" r="16" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <circle cx="22.5" cy="22.5" r="11.5" fill="none" stroke="${ring}" stroke-width="1.8"/>
      ${crown}
    </svg>
  `;
}

export class CheckersAcademyGame implements MiniGame {
  public readonly id = 'checkers2d' as const;

  private ctx!: GameContext;
  private isGauntletSlice: boolean;

  private stageEl!: HTMLDivElement;
  private sideEl!: HTMLElement;
  private stepperEl!: HTMLDivElement;
  private sideContentEl!: HTMLDivElement;
  private explainEl!: HTMLDivElement;

  private phase: Phase = 'prep';
  private prepActivity: 'lesson' | 'duel' = 'duel';
  private botLevel: 0 | 1 | 2 = 1;
  private readonly humanColor: CheckersColor = 'w';

  private state: CheckersState = createInitialCheckersState();
  private undoStack: { state: CheckersState; log: string[] }[] = [];
  private moveLog: string[] = [];

  private selectedSq: number | null = null;
  private cursorSq = 41;
  private stepOptions: { to: number; isCapture: boolean; matchingMoves: CheckersMove[] }[] = [];
  private hintMove: CheckersMove | null = null;

  private botThinking = false;
  private botTimeout: number | null = null;
  private duelFinished = false;
  private duelHintsUsed = 0;
  private movesCount = 0;

  private activeLessonIndex = 0;
  private activeStepIndex = 0;
  private lessonStepSolved = false;
  private lessonsCompleted = 0;

  private paused = false;
  private destroyed = false;
  private elapsed = 0;
  private score = 0;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    if (ctx.difficulty === 'chill') this.botLevel = 0;
    else if (ctx.difficulty === 'hyper') this.botLevel = 2;
    else this.botLevel = 1;

    this.prepActivity = ctx.practiceMode ? 'lesson' : 'duel';

    const layout = createAcademyLayout(
      ctx.container,
      'DAMAS TÁCTICAS 8×8',
      ctx.practiceMode ? 'PRÁCTICA' : 'RETO OFICIAL'
    );
    this.stageEl = layout.stageEl;
    this.sideEl = layout.sideEl;

    this.stepperEl = document.createElement('div');
    this.sideContentEl = document.createElement('div');
    this.sideContentEl.className = 'oa-academy-card';
    this.explainEl = document.createElement('div');
    this.sideEl.append(this.stepperEl, this.sideContentEl, this.explainEl);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'DAMAS TÁCTICAS',
      accent: '#B45309',
      timeLeftSec: null,
      subStat: 'PREPARA TU SESIÓN',
    });

    this.updateControlsBar();
    window.addEventListener('keydown', this.onKeyDown);
    this.renderPrep();
  }

  private updateControlsBar(): void {
    const hints: ControlHint[] = [
      { keys: ['Clic'], touch: 'Toca pieza y destino', action: 'Mover / saltar', tone: 'primary' },
      { keys: ['Flechas', 'Enter'], touch: 'Toca casillas', action: 'Navegar tablero' },
      { keys: ['P'], touch: 'Botón Pista', action: 'Pista táctica' },
    ];
    if (this.ctx.practiceMode) {
      hints.push({ keys: ['U'], touch: 'Botón Deshacer', action: 'Deshacer jugada' });
    }
    this.ctx.setControls?.(hints);
  }

  private clearBotTimeout(): void {
    if (this.botTimeout !== null) {
      window.clearTimeout(this.botTimeout);
      this.botTimeout = null;
    }
  }

  private renderPrep(): void {
    this.phase = 'prep';
    this.stepperEl.innerHTML = '';
    this.sideContentEl.innerHTML = '';

    const levelNames = ['Novato', 'Club', 'Maestro'];
    const isPractice = Boolean(this.ctx.practiceMode);

    this.stageEl.innerHTML = '';
    const prep = document.createElement('div');
    prep.className = 'oa-board-prep';
    prep.innerHTML = `
      <h3 class="oa-board-prep-title">Damas Latinas 8×8</h3>
      <p class="oa-board-prep-desc">Los peones capturan hacia adelante y atrás, la captura es obligatoria y la dama vuela por toda la diagonal. Si hay varias rutas de captura puedes elegir cualquiera (sin ley de mayoría).</p>

      <div class="oa-board-field">
        <span class="oa-board-field-label">Actividad</span>
        <div class="oa-board-seg">
          <button type="button" class="oa-board-seg-btn" data-act="lesson" aria-pressed="${this.prepActivity === 'lesson'}">Lecciones tácticas (3)</button>
          <button type="button" class="oa-board-seg-btn" data-act="duel" aria-pressed="${this.prepActivity === 'duel'}">Duelo vs Bot</button>
        </div>
      </div>

      <div class="oa-board-field" id="oa-chk-lvl-wrap">
        <span class="oa-board-field-label">Nivel del Bot</span>
        <div class="oa-board-seg">
          ${[0, 1, 2]
            .map(
              (lvl) =>
                `<button type="button" class="oa-board-seg-btn" data-lvl="${lvl}" aria-pressed="${this.botLevel === lvl}">${levelNames[lvl]}</button>`
            )
            .join('')}
        </div>
      </div>

      <button type="button" class="oa-board-primary-btn" id="oa-chk-start-btn">${Icons.play(18)}<span>Empezar</span></button>
    `;

    this.stageEl.appendChild(prep);

    const lvlWrap = prep.querySelector<HTMLDivElement>('#oa-chk-lvl-wrap')!;
    const syncLvl = () => lvlWrap.classList.toggle('is-hidden', this.prepActivity !== 'duel');
    syncLvl();

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
        syncLvl();
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

    prep.querySelector('#oa-chk-start-btn')!.addEventListener('click', () => {
      synthAudio.uiClick();
      if (this.prepActivity === 'lesson') this.startLessons(0, 0);
      else this.startDuel();
    });

    renderExplanationBox(
      this.explainEl,
      'Reglas clave',
      'Cuando veas un borde dorado pulsante en una pieza, estás obligado a capturar con ella antes de poder hacer otro movimiento.',
      'info'
    );
  }

  // ==================== LESSONS ====================

  private startLessons(lessonIdx: number, stepIdx: number): void {
    this.clearBotTimeout();
    this.phase = 'lesson';
    this.activeLessonIndex = lessonIdx;
    this.activeStepIndex = stepIdx;
    this.loadLessonStep();
  }

  private getCurrentLesson(): CheckersLesson {
    return CHECKERS_LESSONS[this.activeLessonIndex];
  }

  private getCurrentStep(): CheckersLessonStep {
    return this.getCurrentLesson().steps[this.activeStepIndex];
  }

  private loadLessonStep(): void {
    this.clearBotTimeout();
    this.botThinking = false;
    this.selectedSq = null;
    this.stepOptions = [];
    this.hintMove = null;
    this.lessonStepSolved = false;

    const lesson = this.getCurrentLesson();
    const step = this.getCurrentStep();
    this.state = {
      board: step.board.map((p) => (p ? { ...p } : null)),
      turn: step.turn,
      noProgressMoves: 0,
      activeChain: null,
    };

    this.ctx.setHud({
      subStat: `LECCIÓN ${this.activeLessonIndex + 1}/3 · PASO ${this.activeStepIndex + 1}/${lesson.steps.length}`,
    });

    renderLessonStepper(
      this.stepperEl,
      CHECKERS_LESSONS.map((l) => ({ id: l.id, title: l.title })),
      lesson.id,
      (id) => {
        synthAudio.uiClick();
        const idx = CHECKERS_LESSONS.findIndex((l) => l.id === id);
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
    const hasNextLesson = this.activeLessonIndex + 1 < CHECKERS_LESSONS.length;

    this.sideContentEl.innerHTML = `
      <div class="oa-board-meta-row">
        <span><strong>${lesson.title}</strong> (${this.activeStepIndex + 1}/${lesson.steps.length})</span>
        <span>${this.lessonStepSolved ? 'Completado' : 'En curso'}</span>
      </div>
      <p style="margin:0;font-size:0.86rem;color:var(--ink-secondary);">${lesson.summary}</p>
      <div class="oa-academy-actions">
        <button type="button" class="oa-academy-btn" id="oa-chk-hint-btn">${Icons.lightbulb(16)}<span>Pista (P)</span></button>
        <button type="button" class="oa-academy-btn" id="oa-chk-reset-step">${Icons.refresh(16)}<span>Reintentar</span></button>
        ${
          this.lessonStepSolved && (hasNextStep || hasNextLesson)
            ? `<button type="button" class="oa-board-primary-btn" id="oa-chk-next-step">${Icons.arrowRight(16)}<span>${hasNextStep ? 'Siguiente paso' : 'Siguiente lección'}</span></button>`
            : ''
        }
        <button type="button" class="oa-academy-btn" id="oa-chk-to-duel">Duelo vs Bot</button>
      </div>
    `;

    this.sideContentEl.querySelector('#oa-chk-hint-btn')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.triggerHint();
    });
    this.sideContentEl.querySelector('#oa-chk-reset-step')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.loadLessonStep();
    });
    this.sideContentEl.querySelector('#oa-chk-next-step')?.addEventListener('click', () => {
      synthAudio.uiClick();
      if (hasNextStep) this.startLessons(this.activeLessonIndex, this.activeStepIndex + 1);
      else if (hasNextLesson) this.startLessons(this.activeLessonIndex + 1, 0);
    });
    this.sideContentEl.querySelector('#oa-chk-to-duel')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.startDuel();
    });
  }

  // ==================== DUEL ====================

  private startDuel(): void {
    this.clearBotTimeout();
    this.phase = 'duel';
    this.stepperEl.innerHTML = '';
    this.state = createInitialCheckersState();
    this.undoStack = [];
    this.moveLog = [];
    this.selectedSq = null;
    this.stepOptions = [];
    this.hintMove = null;
    this.botThinking = false;
    this.duelFinished = false;
    this.duelHintsUsed = 0;
    this.movesCount = 0;

    const lvlLabel = ['Novato', 'Club', 'Maestro'][this.botLevel];
    this.ctx.setHud({
      subStat: `DUELO · NIVEL ${lvlLabel.toUpperCase()}`,
    });

    renderExplanationBox(
      this.explainEl,
      'Inicio de partida',
      'Juegas con Blancas (abajo). Las piezas con captura obligatoria se iluminan en dorado.',
      'info'
    );

    this.renderBoardView();
    this.renderDuelSide();
  }

  private renderDuelSide(): void {
    const isPractice = Boolean(this.ctx.practiceMode);
    const lvlLabel = ['Novato', 'Club', 'Maestro'][this.botLevel];
    const wCount = countCheckersPieces(this.state.board, 'w');
    const bCount = countCheckersPieces(this.state.board, 'b');
    const forced = getForcedCaptureSquares(this.state);
    const canUndo =
      isPractice &&
      this.undoStack.length > 0 &&
      !this.botThinking &&
      !this.duelFinished &&
      !this.state.activeChain;
    const hintsLeft = isPractice ? 'Ilimitadas' : `${Math.max(0, 2 - this.duelHintsUsed)}/2`;

    this.sideContentEl.innerHTML = `
      <div class="oa-board-meta-row">
        <span class="oa-turn-pill">
          <span class="oa-turn-dot ${this.state.turn === 'w' ? 'is-white' : 'is-black'}"></span>
          <span>${this.botThinking ? 'Bot pensando…' : this.state.turn === 'w' ? 'Turno: Blancas (Tú)' : 'Turno: Negras'}</span>
        </span>
        <span>Bot: <strong>${lvlLabel}</strong></span>
      </div>
      <div class="oa-board-meta-row">
        <span>Blancas: <strong>${wCount.total}</strong> (${wCount.kings} dama)</span>
        <span>Negras: <strong>${bCount.total}</strong> (${bCount.kings} dama)</span>
      </div>
      ${
        forced.length > 0 && this.state.turn === 'w'
          ? `<div style="font-size:0.8rem;color:var(--accent-gold);font-weight:700;">Captura obligatoria activa (${forced.map(sqToAlgebraic).join(', ')})</div>`
          : ''
      }
      <div class="oa-moves-log" aria-label="Últimas jugadas">
        ${this.moveLog.length > 0 ? this.moveLog.slice(-10).join(' · ') : 'Aún no hay jugadas.'}
      </div>
      <div class="oa-academy-actions">
        <button type="button" class="oa-academy-btn" id="oa-chk-hint-btn" ${this.botThinking || this.duelFinished || (!isPractice && this.duelHintsUsed >= 2) ? 'disabled' : ''}>
          ${Icons.lightbulb(16)}<span>Pista (${hintsLeft})</span>
        </button>
        <button type="button" class="oa-academy-btn" id="oa-chk-undo-btn" ${canUndo ? '' : 'disabled'} title="${isPractice ? 'Deshacer última jugada (U)' : 'Deshacer solo en Práctica Guiada'}">
          ${Icons.undo(16)}<span>Deshacer</span>
        </button>
        ${
          isPractice
            ? `<button type="button" class="oa-academy-btn" id="oa-chk-back-prep">${Icons.bookOpen(16)}<span>Lecciones / Config</span></button>`
            : `<button type="button" class="oa-academy-btn" id="oa-chk-resign-btn" ${this.duelFinished ? 'disabled' : ''}>Rendirse</button>`
        }
      </div>
    `;

    this.sideContentEl.querySelector('#oa-chk-hint-btn')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.triggerHint();
    });
    this.sideContentEl.querySelector('#oa-chk-undo-btn')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.triggerUndo();
    });
    this.sideContentEl.querySelector('#oa-chk-back-prep')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.clearBotTimeout();
      this.renderPrep();
    });
    this.sideContentEl.querySelector('#oa-chk-resign-btn')?.addEventListener('click', () => {
      if (this.duelFinished) return;
      synthAudio.uiClick();
      this.finishDuel('loss', 'Te rendiste en la partida.');
    });
  }

  // ==================== BOARD RENDER ====================

  private renderBoardView(): void {
    this.stageEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'oa-board-stage-wrap';

    const frame = document.createElement('div');
    frame.className = 'oa-grid8-frame';

    const grid = document.createElement('div');
    grid.className = 'oa-grid8';
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', 'Tablero de damas 8 por 8');

    const forcedSquares =
      this.state.turn === this.humanColor && !this.botThinking && !this.duelFinished
        ? new Set(getForcedCaptureSquares(this.state))
        : new Set<number>();

    const optionMap = new Map<number, { isCapture: boolean }>();
    for (const o of this.stepOptions) {
      optionMap.set(o.to, { isCapture: o.isCapture });
    }

    // Active jump chain or multi-step hint route for SVG line + 1-2-3 badges
    let routePath: number[] = [];
    if (this.state.activeChain && this.state.activeChain.path.length > 1) {
      routePath = this.state.activeChain.path;
    } else if (this.hintMove && this.hintMove.path.length >= 2) {
      routePath = this.hintMove.path;
    }

    const stepBadgeMap = new Map<number, number>();
    for (let i = 1; i < routePath.length; i++) {
      stepBadgeMap.set(routePath[i], i);
    }

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
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
            ? `Casilla ${alg}, ${piece.color === 'w' ? 'ficha blanca' : 'ficha negra'}${piece.king ? ' dama' : ''}`
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
        if (forcedSquares.has(sq)) {
          btn.classList.add('oa-mark-forced');
        }
        if (this.hintMove && (this.hintMove.from === sq || this.hintMove.to === sq)) {
          btn.classList.add('oa-mark-hint');
        }

        const opt = optionMap.get(sq);
        if (opt) {
          btn.classList.add(opt.isCapture ? 'oa-mark-capture' : 'oa-mark-legal');
        }

        if (col === 0) {
          const rankLbl = document.createElement('span');
          rankLbl.className = 'oa-sq-coord-rank';
          rankLbl.textContent = String(8 - row);
          btn.appendChild(rankLbl);
        }
        if (row === 7) {
          const fileLbl = document.createElement('span');
          fileLbl.className = 'oa-sq-coord-file';
          fileLbl.textContent = String.fromCharCode(97 + col);
          btn.appendChild(fileLbl);
        }

        if (piece) {
          btn.insertAdjacentHTML('beforeend', renderCheckerPieceSvg(piece));
        }

        const badgeNum = stepBadgeMap.get(sq);
        if (badgeNum !== undefined) {
          const badge = document.createElement('span');
          badge.className = 'oa-step-num-badge';
          badge.textContent = String(badgeNum);
          btn.appendChild(badge);
        }

        btn.addEventListener('click', () => this.onSquareClick(sq));
        grid.appendChild(btn);
      }
    }

    if (routePath.length >= 2) {
      const points = routePath
        .map((s) => {
          const { row, col } = sqToRowCol(s);
          return `${col * 12.5 + 6.25},${row * 12.5 + 6.25}`;
        })
        .join(' ');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'oa-checkers-route-svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = `
        <polyline points="${points}" fill="none" stroke="#00e5ff" stroke-width="1.6" stroke-dasharray="2.5 1.8" stroke-linecap="round" stroke-linejoin="round"/>
      `;
      grid.appendChild(svg);
    }

    frame.appendChild(grid);
    wrap.appendChild(frame);
    this.stageEl.appendChild(wrap);
  }

  // ==================== INTERACTION ====================

  private onSquareClick(sq: number): void {
    if (this.paused || this.destroyed || this.botThinking) return;
    if (this.phase === 'prep') return;
    if (this.phase === 'duel' && (this.duelFinished || this.state.turn !== this.humanColor)) return;
    if (this.phase === 'lesson' && this.lessonStepSolved) return;

    this.cursorSq = sq;

    // 1. Execute step if sq is a valid target
    if (this.selectedSq !== null) {
      const targetOpt = this.stepOptions.find((o) => o.to === sq);
      if (targetOpt) {
        this.executeHumanStep(this.selectedSq, sq);
        return;
      }
    }

    // 2. If a multi-jump chain is already active, user cannot switch pieces
    if (this.state.activeChain) {
      this.selectedSq = this.state.activeChain.from;
      this.stepOptions = getValidNextStepSquares(this.state, this.selectedSq);
      renderExplanationBox(
        this.explainEl,
        'Captura múltiple en curso',
        'Debes continuar saltando con la misma pieza hasta completar toda la cadena.',
        'warn'
      );
      this.renderBoardView();
      return;
    }

    // 3. Select own piece
    const piece = this.state.board[sq];
    if (piece && piece.color === this.humanColor) {
      const forced = getForcedCaptureSquares(this.state);
      if (forced.length > 0 && !forced.includes(sq)) {
        synthAudio.damage();
        renderExplanationBox(
          this.explainEl,
          'Captura obligatoria',
          `Tienes captura disponible en ${forced.map(sqToAlgebraic).join(' o ')}. Las piezas obligadas brillan en dorado.`,
          'warn'
        );
        return;
      }

      const nextSteps = getValidNextStepSquares(this.state, sq);
      if (nextSteps.length === 0) {
        this.selectedSq = null;
        this.stepOptions = [];
        this.renderBoardView();
        return;
      }

      this.selectedSq = sq;
      this.stepOptions = nextSteps;
      synthAudio.uiClick();
      this.renderBoardView();
      return;
    }

    this.selectedSq = null;
    this.stepOptions = [];
    this.renderBoardView();
  }

  private executeHumanStep(fromSq: number, toSq: number): void {
    const prevSnapshot = !this.state.activeChain ? this.state : null;
    const prevLog = this.moveLog.slice();

    const res = applyCheckersStep(this.state, fromSq, toSq);
    this.state = res.state;
    this.hintMove = null;

    if (res.chainContinues && this.state.activeChain) {
      synthAudio.hitmarker(this.state.activeChain.captures.length);
      this.selectedSq = this.state.activeChain.from;
      this.stepOptions = getValidNextStepSquares(this.state, this.selectedSq);
      renderExplanationBox(
        this.explainEl,
        'Continúa la cadena',
        `Llevas ${this.state.activeChain.captures.length} captura(s). Elige el siguiente salto marcado en rojo.`,
        'info'
      );
      this.renderBoardView();
      if (this.phase === 'duel') this.renderDuelSide();
      return;
    }

    // Full move completed
    this.selectedSq = null;
    this.stepOptions = [];
    const completed = res.completedMove!;
    const moveText = completed.path.map(sqToAlgebraic).join(completed.captures.length > 0 ? '×' : '→');

    if (this.phase === 'lesson') {
      const step = this.getCurrentStep();
      const key = `${completed.from}-${completed.to}`;
      if (!step.expectedMoves || step.expectedMoves.includes(key)) {
        this.lessonStepSolved = true;
        this.lessonsCompleted++;
        this.score += 150;
        this.ctx.addScore(150, 1);
        synthAudio.puzzleSuccess(this.lessonsCompleted);
        renderExplanationBox(this.explainEl, `Correcto (${moveText})`, step.successFeedback, 'good');
      } else {
        // Restore state on wrong lesson move
        if (prevSnapshot) this.state = prevSnapshot;
        synthAudio.damage();
        renderExplanationBox(this.explainEl, `No es la táctica buscada`, step.wrongHint, 'warn');
      }
      this.renderBoardView();
      this.renderLessonSide();
      return;
    }

    // Duel mode
    if (prevSnapshot) {
      this.undoStack.push({ state: prevSnapshot, log: prevLog });
    }
    this.moveLog.push(moveText);
    this.movesCount++;

    if (completed.captures.length > 0) synthAudio.hitmarker(completed.captures.length);
    else synthAudio.uiClick();

    if (completed.promotes) {
      renderExplanationBox(
        this.explainEl,
        'Dama coronada',
        `Tu pieza coronó en ${sqToAlgebraic(completed.to)} y ahora puede volar por cualquier diagonal.`,
        'good'
      );
    }

    this.renderBoardView();
    this.renderDuelSide();

    if (!this.checkAndHandleDuelEnd()) {
      this.scheduleBotTurn();
    }
  }

  private scheduleBotTurn(): void {
    this.clearBotTimeout();
    this.botThinking = true;
    this.renderDuelSide();
    this.ctx.setHud({ subStat: 'PENSANDO…' });

    this.botTimeout = window.setTimeout(() => {
      if (this.destroyed || this.phase !== 'duel' || this.duelFinished) return;
      const botMove = chooseCheckersBotMove(this.state, { level: this.botLevel });
      this.state = applyCheckersMove(this.state, botMove);
      this.botThinking = false;
      this.moveLog.push(
        botMove.path.map(sqToAlgebraic).join(botMove.captures.length > 0 ? '×' : '→')
      );

      if (botMove.captures.length > 0) synthAudio.hitmarker(botMove.captures.length);
      else synthAudio.uiClick();

      const lvlLabel = ['Novato', 'Club', 'Maestro'][this.botLevel];
      this.ctx.setHud({ subStat: `DUELO · NIVEL ${lvlLabel.toUpperCase()}` });

      this.renderBoardView();
      this.renderDuelSide();
      this.checkAndHandleDuelEnd();
    }, 20);
  }

  private checkAndHandleDuelEnd(): boolean {
    const status = getCheckersGameStatus(this.state);
    if (status.status === 'playing') return false;
    if (status.status === 'draw') {
      this.finishDuel('draw', status.reason);
    } else {
      this.finishDuel(status.winner === this.humanColor ? 'win' : 'loss', status.reason);
    }
    return true;
  }

  private finishDuel(outcome: 'win' | 'draw' | 'loss', reason: string): void {
    this.duelFinished = true;
    this.clearBotTimeout();
    this.botThinking = false;

    const wPieces = countCheckersPieces(this.state.board, 'w');
    const bPieces = countCheckersPieces(this.state.board, 'b');

    let pts = 0;
    let logicPerf = 400;
    if (outcome === 'win') {
      pts = 900 + 250 * this.botLevel + wPieces.total * 45 + wPieces.kings * 35;
      logicPerf = Math.min(980, 620 + this.botLevel * 120 + wPieces.total * 12);
      synthAudio.puzzleSuccess(3);
    } else if (outcome === 'draw') {
      pts = 450 + wPieces.total * 20;
      logicPerf = 500 + this.botLevel * 40;
      synthAudio.pickup();
    } else {
      const capturedEnemy = 12 - bPieces.total;
      pts = 120 + capturedEnemy * 25;
      logicPerf = Math.min(540, 260 + capturedEnemy * 18);
      synthAudio.damage();
    }

    this.score = pts;
    this.ctx.addScore(pts, outcome === 'win' ? 1 : 0);

    renderExplanationBox(
      this.explainEl,
      outcome === 'win' ? 'Victoria' : outcome === 'draw' ? 'Tablas' : 'Derrota',
      `${reason} Puntuación: ${pts}.`,
      outcome === 'win' ? 'good' : outcome === 'draw' ? 'info' : 'bad'
    );
    this.renderDuelSide();

    if (!this.isGauntletSlice) {
      const metrics: Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> = {
        score: this.score,
        maxCombo: outcome === 'win' ? 1 : 0,
        accuracy: outcome === 'win' ? 90 : outcome === 'draw' ? 75 : 55,
        hits: this.movesCount,
        misses: 0,
        puzzlesSolved: this.lessonsCompleted + (outcome === 'win' ? 1 : 0),
        survived: outcome !== 'loss',
        axisPerformances: { logic: logicPerf },
      };
      this.ctx.finish(metrics);
    }
  }

  private triggerHint(): void {
    if (this.botThinking || this.phase === 'prep') return;

    if (this.phase === 'lesson') {
      const step = this.getCurrentStep();
      if (step.expectedMoves && step.expectedMoves.length > 0) {
        const [fStr, tStr] = step.expectedMoves[0].split('-');
        const from = Number(fStr);
        const to = Number(tStr);
        this.hintMove = { from, to, path: [from, to], captures: [], promotes: false };
        renderExplanationBox(this.explainEl, 'Pista táctica', step.wrongHint, 'info');
        this.renderBoardView();
        return;
      }
    }

    if (this.duelFinished) return;
    if (!this.ctx.practiceMode && this.duelHintsUsed >= 2) {
      this.ctx.toast('Límite de pistas alcanzado en Reto', 'warn');
      return;
    }

    const hint = getCheckersHint(this.state);
    this.duelHintsUsed++;
    this.hintMove = hint.move;
    renderExplanationBox(this.explainEl, 'Pista explicada', hint.explanation, 'info');
    this.renderBoardView();
    if (this.phase === 'duel') this.renderDuelSide();
  }

  private triggerUndo(): void {
    if (!this.ctx.practiceMode || this.phase !== 'duel' || this.botThinking) return;
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.state = prev.state;
    this.moveLog = prev.log;
    this.selectedSq = null;
    this.stepOptions = [];
    this.hintMove = null;
    this.duelFinished = false;

    renderExplanationBox(
      this.explainEl,
      'Jugada deshecha',
      'Regresaste al turno anterior.',
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
    if (e.code === 'ArrowUp') {
      e.preventDefault();
      this.cursorSq = Math.max(0, row - 1) * 8 + col;
      this.renderBoardView();
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      this.cursorSq = Math.min(7, row + 1) * 8 + col;
      this.renderBoardView();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      this.cursorSq = row * 8 + Math.max(0, col - 1);
      this.renderBoardView();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      this.cursorSq = row * 8 + Math.min(7, col + 1);
      this.renderBoardView();
    } else if (e.code === 'Enter' || e.code === 'Space') {
      if (document.activeElement?.closest('.oa-grid8')) return;
      e.preventDefault();
      this.onSquareClick(this.cursorSq);
    } else if (e.code === 'KeyP') {
      e.preventDefault();
      this.triggerHint();
    } else if (e.code === 'KeyU') {
      e.preventDefault();
      this.triggerUndo();
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
      hits: this.movesCount,
      misses: 0,
      puzzlesSolved: this.lessonsCompleted,
      survived: true,
      axisPerformances: {
        logic: Math.min(950, 380 + this.lessonsCompleted * 60 + Math.round(this.score * 0.25)),
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
