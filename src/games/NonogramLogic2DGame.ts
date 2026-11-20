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
  generateNonogramPuzzle,
  getNonogramHint,
  isLineSatisfied,
  type NonogramCellMark,
  type NonogramHint,
  type NonogramPuzzle,
  type NonogramSize,
} from './intel/nonogramEngine';

const MAX_CHALLENGE_HINTS = 2;

export class NonogramLogic2DGame implements MiniGame {
  public readonly id = 'nonogram2d' as const;

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

  private phase: 'prep' | 'playing' | 'done' = 'prep';
  private selectedSize: NonogramSize = 5;
  private activeTool: 1 | -1 = 1; // 1 = Pintar, -1 = Marcar X
  private dragPaintValue: NonogramCellMark | null = null;
  private isPointerDragging = false;

  private puzzle!: NonogramPuzzle;
  private board: NonogramCellMark[][] = [];
  private history: NonogramCellMark[][][] = [];
  private activeHint: NonogramHint | null = null;
  private lastErrorKey: string | null = null;

  private boardIdx = 0;
  private boardsSolved = 0;
  private hintsUsed = 0;
  private errors = 0;
  private hits = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private elapsed = 0;
  private pendingNextTimer = 0;
  private baseSeed = (Date.now() ^ 0x2c91b5) & 0x7fffffff;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.practiceMode = Boolean(ctx.practiceMode);
    this.infiniteMode = Boolean(ctx.infiniteMode) && !this.practiceMode && !this.isGauntletSlice;

    if (this.infiniteMode || ctx.difficulty === 'progressive' || ctx.difficulty === 'chill') {
      this.selectedSize = 5;
    } else if (ctx.difficulty === 'hyper') {
      this.selectedSize = 10;
    } else {
      this.selectedSize = 8;
    }

    const badge = this.practiceMode
      ? 'PRÁCTICA'
      : this.infiniteMode
        ? renderDifficultyBadge(ctx.difficulty, true)
        : 'RETO';

    const layout = createAcademyLayout(ctx.container, 'NONOGRAMAS DEDUCTIVOS', badge);
    this.stageEl = layout.stageEl;
    this.sideEl = layout.sideEl;

    this.tutorialSlotEl = document.createElement('div');
    this.explainEl = document.createElement('div');
    this.actionBoxEl = document.createElement('div');
    this.actionBoxEl.className = 'oa-academy-card';
    this.sideEl.append(this.tutorialSlotEl, this.explainEl, this.actionBoxEl);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('blur', this.onPointerUp);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'NONOGRAMAS DEDUCTIVOS',
      accent: '#0284C7',
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
        { keys: ['Clic', 'Enter'], touch: 'Toca Empezar', action: 'Generar nonograma único', tone: 'primary' },
      ]);
      return;
    }
    const hints = [
      { keys: ['Clic'], touch: 'Toca o arrastra', action: 'Pintar / Marcar X', tone: 'primary' as const },
      { keys: ['Clic Der', 'X'], touch: 'Botón Marcar X', action: 'Descartar casilla vacía' },
      { keys: ['P'], touch: 'Botón Pista', action: 'Pista razonada', tone: 'primary' as const },
    ];
    if (this.practiceMode) {
      hints.push({ keys: ['U'], touch: 'Botón Deshacer', action: 'Deshacer jugada' });
    }
    this.ctx.setControls(hints);
  }

  private updateSectionTutorial(): void {
    let info: SectionTutorialInfo;
    if (this.phase === 'prep') {
      info = {
        id: 'nonogram:prep',
        sectionName: 'Preparar Nonograma Deductivo',
        steps: [
          'Selecciona tamaño de cuadrícula: 5×5 (rápido), 8×8 (intermedio) o 10×10 (experto).',
          'Las pistas numéricas indican cuántos bloques consecutivos van pintados en esa fila o columna.',
          'Entre dos bloques de la misma línea siempre debe existir al menos una casilla vacía (X).',
        ],
        tip: 'Todos los nonogramas están verificados por solver de líneas: jamás necesitas adivinar.',
      };
    } else if (this.activeTool === -1) {
      info = {
        id: 'nonogram:tool-x',
        sectionName: 'Herramienta Marcar X (Descarte)',
        steps: [
          'Marca con X todas las casillas que tengas certeza de que deben quedar vacías.',
          'Al completar todos los bloques de una fila o columna, cierra el resto de esa línea con X para despejar cruces.',
          'Pulsa X o el botón Pintar para volver a rellenar bloques.',
        ],
        tip: 'Marcar las X es tan importante como pintar: acota el espacio disponible de las líneas perpendiculares.',
      };
    } else {
      info = {
        id: `nonogram:play:${this.puzzle.size}`,
        sectionName: `Nonograma ${this.puzzle.size}×${this.puzzle.size} · Solapamiento`,
        steps: [
          'Empieza por líneas cuya pista sume el ancho total (ej. "5" en 5×5 o "3 1" que suma 3+1+1 = 5).',
          'Aplica solapamiento: si un bloque mide más de la mitad de la línea, las celdas centrales siempre van pintadas.',
          'Pulsa Pista Razonada (P) si te atascas para ver qué fila o columna tiene deducción directa.',
        ],
        tip: 'Puedes arrastrar el puntero para pintar o marcar X en varias celdas seguidas de un solo trazo.',
      };
    }
    this.tutorialSlotEl.replaceChildren(createSectionTutorialEl(info));
  }

  private renderPrep(): void {
    this.phase = 'prep';
    this.updateSectionTutorial();
    this.updateControlsHint();
    this.stageEl.innerHTML = '';

    const prep = document.createElement('div');
    prep.className = 'oa-intel-prep';

    const h = document.createElement('h3');
    h.className = 'oa-intel-prep-title';
    h.textContent = 'Configura tu Nonograma Deductivo';

    const p = document.createElement('p');
    p.className = 'oa-intel-prep-sub';
    if (this.practiceMode) {
      p.textContent =
        'Todos los tableros tienen solución única deducible sin adivinar. Usa Pintar, Marcar X, Deshacer y Pista Razonada.';
    } else if (this.infiniteMode) {
      p.textContent =
        'Modo Infinito Progresivo: resuelve tableros encadenados escalando 5×5 → 8×8 → 10×10. Cada bloque erróneo cuesta 1 escudo.';
    } else {
      p.textContent =
        `Modo Reto: resuelve el tablero por deducción pura (${MAX_CHALLENGE_HINTS} pistas disponibles). Cada error al pintar cuesta 1 escudo.`;
    }

    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'oa-intel-group';
    const sizeLbl = document.createElement('span');
    sizeLbl.className = 'oa-intel-label';
    sizeLbl.textContent = this.infiniteMode ? 'Tamaño inicial (luego escala a 10×10)' : 'Tamaño del tablero';
    const sizePills = document.createElement('div');
    sizePills.className = 'oa-intel-pills';

    const sizes: { val: NonogramSize; label: string }[] = [
      { val: 5, label: '5×5 (Inicial)' },
      { val: 8, label: '8×8 (Medio)' },
      { val: 10, label: '10×10 (Experto)' },
    ];

    const renderPills = () => {
      sizePills.innerHTML = '';
      for (const s of sizes) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'oa-intel-pill';
        b.textContent = s.label;
        b.setAttribute('aria-pressed', this.selectedSize === s.val ? 'true' : 'false');
        b.addEventListener('click', () => {
          synthAudio.uiClick();
          this.selectedSize = s.val;
          renderPills();
        });
        sizePills.appendChild(b);
      }
    };
    renderPills();
    sizeGroup.append(sizeLbl, sizePills);

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'oa-intel-primary-btn';
    startBtn.innerHTML = `${Icons.play(17)}<span>Empezar Nonograma</span>`;
    startBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.startSession();
    });

    prep.append(h, p, sizeGroup, startBtn);
    this.stageEl.appendChild(prep);

    renderExplanationBox(
      this.explainEl,
      'Deducción sin adivinar',
      'Los números indican bloques seguidos de casillas pintadas en esa fila o columna, separados por al menos 1 casilla vacía (X).',
      'info'
    );
    this.actionBoxEl.innerHTML = '';
  }

  private sizeForBoard(idx: number): NonogramSize {
    if (!this.infiniteMode && this.ctx.difficulty !== 'progressive') {
      return this.selectedSize;
    }
    if (this.selectedSize === 5) {
      if (idx === 0) return 5;
      if (idx === 1) return 8;
      return 10;
    }
    if (this.selectedSize === 8) {
      return idx === 0 ? 8 : 10;
    }
    return 10;
  }

  private startSession(): void {
    this.phase = 'playing';
    this.finished = false;
    this.boardIdx = 0;
    this.boardsSolved = 0;
    this.errors = 0;
    this.hits = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.elapsed = 0;
    this.pendingNextTimer = 0;
    this.loadBoard();
  }

  private loadBoard(): void {
    const size = this.sizeForBoard(this.boardIdx);
    const seed = (this.baseSeed + this.boardIdx * 3571 + size * 97) >>> 0;
    this.puzzle = generateNonogramPuzzle(size, seed);
    this.board = Array.from({ length: size }, () => Array<NonogramCellMark>(size).fill(0));
    this.history = [];
    this.activeHint = null;
    this.lastErrorKey = null;
    this.hintsUsed = 0;
    this.activeTool = 1;
    this.pendingNextTimer = 0;

    renderExplanationBox(
      this.explainEl,
      `${this.puzzle.title} (${size}×${size})`,
      'Empieza por las pistas más grandes o con suma exacta. Las pistas de fila y columna se tacharán solas al completarlas.',
      'info'
    );

    this.updateSectionTutorial();
    this.updateControlsHint();
    this.renderBoard();
    this.updateHud();
  }

  private updateHud(): void {
    const remaining = this.countRemainingPainted();
    const prefix = this.infiniteMode
      ? `RESUELTOS ${this.boardsSolved} · `
      : '';
    this.ctx.setHud({
      subStat: `${prefix}${this.puzzle.size}×${this.puzzle.size} · FALTAN ${remaining}`,
    });
  }

  private countRemainingPainted(): number {
    let rem = 0;
    const size = this.puzzle.size;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (this.puzzle.solution[r][c] === 1 && this.board[r][c] !== 1) rem++;
      }
    }
    return rem;
  }

  private pushSnapshot(): void {
    if (!this.practiceMode) return;
    this.history.push(this.board.map((row) => [...row]));
    if (this.history.length > 40) this.history.shift();
  }

  private undo(): void {
    if (!this.practiceMode || this.history.length === 0 || this.phase !== 'playing') return;
    this.board = this.history.pop()!;
    this.activeHint = null;
    this.lastErrorKey = null;
    synthAudio.uiClick();
    renderExplanationBox(this.explainEl, 'Jugada deshecha', 'Se restauró el tablero anterior.', 'info');
    this.renderBoard();
    this.updateHud();
  }

  private isBoardSolved(): boolean {
    const size = this.puzzle.size;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const expected = this.puzzle.solution[r][c] === 1;
        const actual = this.board[r][c] === 1;
        if (expected !== actual) return false;
      }
    }
    return true;
  }

  private applyCellAction(r: number, c: number, desiredTool: 1 | -1, isDrag = false): void {
    if (this.phase !== 'playing' || this.pendingNextTimer > 0) return;

    const current = this.board[r][c];
    let nextVal: NonogramCellMark;
    if (isDrag && this.dragPaintValue !== null) {
      nextVal = this.dragPaintValue;
    } else {
      nextVal = current === desiredTool ? 0 : desiredTool;
      if (!isDrag) {
        this.dragPaintValue = nextVal;
      }
    }
    if (current === nextVal) return;

    this.activeHint = null;
    this.lastErrorKey = null;

    // En Reto / Infinito, validar si intenta pintar una casilla vacia de la solucion
    if (!this.practiceMode && nextVal === 1 && this.puzzle.solution[r][c] === 0) {
      this.errors++;
      this.combo = 0;
      this.lastErrorKey = `${r}_${c}`;
      this.isPointerDragging = false;
      this.dragPaintValue = null;
      this.ctx.breakCombo();
      synthAudio.damage();

      const remShields = this.ctx.damage(1);
      renderExplanationBox(
        this.explainEl,
        `Casilla incorrecta (Fila ${r + 1}, Columna ${c + 1})`,
        `Según el cruce de pistas de Fila ${r + 1} y Columna ${c + 1}, esa casilla debe quedar vacía (X).`,
        'bad'
      );
      this.renderBoard();
      this.updateHud();

      if (remShields <= 0) {
        this.finishRun(false);
      }
      return;
    }

    this.pushSnapshot();
    const wasTargetUnfilled = current !== 1 && nextVal === 1 && this.puzzle.solution[r][c] === 1;
    this.board[r][c] = nextVal;

    if (wasTargetUnfilled) {
      this.hits++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const pts = 35 + this.puzzle.size * 4;
      this.score += pts;
      this.ctx.addScore(pts, 1);
      synthAudio.pickup();
    } else {
      synthAudio.uiClick();
    }

    this.renderBoard();
    this.updateHud();

    if (this.isBoardSolved()) {
      this.onBoardSolved();
    }
  }

  private onBoardSolved(): void {
    this.boardsSolved++;
    const size = this.puzzle.size;
    const sizeMult = size === 5 ? 1 : size === 8 ? 1.8 : 2.8;
    const bonus = Math.max(200, Math.round(450 * sizeMult - this.errors * 80 - this.hintsUsed * 40));
    this.score += bonus;
    this.ctx.addScore(bonus, 2);
    synthAudio.puzzleSuccess(3);

    if (this.infiniteMode && !this.practiceMode) {
      this.pendingNextTimer = 1.05;
      renderExplanationBox(
        this.explainEl,
        `${this.puzzle.title} completado`,
        `Resuelto (+${bonus} pts). Preparando el siguiente nonograma...`,
        'good'
      );
      this.renderBoard();
      this.updateHud();
      return;
    }

    renderExplanationBox(
      this.explainEl,
      `${this.puzzle.title} completado`,
      `Resolviste el nonograma ${size}×${size} con ${this.errors} errores y ${this.hintsUsed} pistas.`,
      'good'
    );
    this.finishRun(true);
  }

  private showReasonedHint(): void {
    if (this.phase !== 'playing' || this.pendingNextTimer > 0) return;
    if (!this.practiceMode && this.hintsUsed >= MAX_CHALLENGE_HINTS) {
      this.ctx.toast('Sin pistas restantes en este tablero.', 'warn');
      return;
    }

    const size = this.puzzle.size;

    // Detectar errores previos del usuario en practica o X equivocadas
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (this.board[r][c] === 1 && this.puzzle.solution[r][c] === 0) {
          this.lastErrorKey = `${r}_${c}`;
          renderExplanationBox(
            this.explainEl,
            `Corrige primero Fila ${r + 1}, Columna ${c + 1}`,
            'Hay una casilla pintada que no corresponde a las pistas. Bórrala o usa Deshacer antes de pedir la siguiente deducción.',
            'warn'
          );
          this.renderBoard();
          return;
        }
        if (this.board[r][c] === -1 && this.puzzle.solution[r][c] === 1) {
          this.lastErrorKey = `${r}_${c}`;
          renderExplanationBox(
            this.explainEl,
            `Revisa la X en Fila ${r + 1}, Columna ${c + 1}`,
            'Marcaste con X una casilla que en realidad sí va pintada. Quita esa X para poder continuar la deducción.',
            'warn'
          );
          this.renderBoard();
          return;
        }
      }
    }

    const hint = getNonogramHint(this.board, this.puzzle.clues);
    if (!hint) return;

    this.hintsUsed++;
    this.activeHint = hint;
    synthAudio.uiClick();
    renderExplanationBox(this.explainEl, hint.title, hint.explanation, 'info');
    this.renderBoard();
  }

  private renderBoard(): void {
    this.updateSectionTutorial();
    this.stageEl.innerHTML = '';
    const size = this.puzzle.size;

    const wrap = document.createElement('div');
    wrap.className = 'oa-nono-wrap';

    // Top meta row
    const meta = document.createElement('div');
    meta.className = 'oa-intel-meta-row';
    meta.style.width = '100%';

    const leftChip = document.createElement('span');
    leftChip.className = 'oa-intel-stat-chip';
    leftChip.textContent = `${this.puzzle.title} · ${size}×${size}`;

    const rightChip = document.createElement('span');
    rightChip.className = 'oa-intel-stat-chip';
    rightChip.textContent = this.practiceMode
      ? `Pistas usadas: ${this.hintsUsed}`
      : this.infiniteMode
        ? `Tableros: ${this.boardsSolved} · Pistas: ${MAX_CHALLENGE_HINTS - this.hintsUsed}`
        : `Pistas restantes: ${MAX_CHALLENGE_HINTS - this.hintsUsed} · Errores: ${this.errors}`;

    meta.append(leftChip, rightChip);

    // Toolbar Pintar / Marcar X
    const toolbar = document.createElement('div');
    toolbar.className = 'oa-nono-toolbar';

    const paintBtn = document.createElement('button');
    paintBtn.type = 'button';
    paintBtn.className = 'oa-nono-tool-btn';
    paintBtn.setAttribute('aria-pressed', this.activeTool === 1 ? 'true' : 'false');
    paintBtn.innerHTML = `${Icons.nonogram(16)}<span>Pintar (1)</span>`;
    paintBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.activeTool = 1;
      this.renderBoard();
    });

    const markBtn = document.createElement('button');
    markBtn.type = 'button';
    markBtn.className = 'oa-nono-tool-btn';
    markBtn.setAttribute('aria-pressed', this.activeTool === -1 ? 'true' : 'false');
    markBtn.innerHTML = `${Icons.close(16)}<span>Marcar X (2)</span>`;
    markBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.activeTool = -1;
      this.renderBoard();
    });

    toolbar.append(paintBtn, markBtn);

    // Grid wrapper
    const scroll = document.createElement('div');
    scroll.className = 'oa-nono-board-scroll';

    const matrix = document.createElement('div');
    matrix.className = 'oa-nono-matrix';
    const cellSize = size === 5 ? 46 : size === 8 ? 36 : 30;
    matrix.style.setProperty('--nono-cell-size', `${cellSize}px`);
    matrix.style.gridTemplateColumns = `auto repeat(${size}, ${cellSize}px)`;
    matrix.setAttribute('role', 'grid');
    matrix.setAttribute('aria-label', `Tablero Nonograma ${size} por ${size}`);

    // Corner
    const corner = document.createElement('div');
    corner.className = 'oa-nono-corner';
    corner.textContent = `${size}×${size}`;
    matrix.appendChild(corner);

    // Col clues
    for (let c = 0; c < size; c++) {
      const colMarks = this.board.map((row) => row[c]);
      const satisfied = isLineSatisfied(colMarks, this.puzzle.clues.cols[c]);
      const colEl = document.createElement('div');
      colEl.className = 'oa-nono-col-clue';
      if (satisfied) colEl.classList.add('is-satisfied');
      if (this.activeHint && this.activeHint.axis === 'col' && this.activeHint.lineIndex === c) {
        colEl.classList.add('is-line-focus');
      }
      for (const n of this.puzzle.clues.cols[c]) {
        const sp = document.createElement('span');
        sp.textContent = String(n);
        colEl.appendChild(sp);
      }
      matrix.appendChild(colEl);
    }

    const hintHighlightSet = new Set(
      (this.activeHint?.highlightCells ?? []).map((pt) => `${pt.row}_${pt.col}`)
    );

    // Rows (clue + cells)
    for (let r = 0; r < size; r++) {
      const satisfied = isLineSatisfied(this.board[r], this.puzzle.clues.rows[r]);
      const rowClueEl = document.createElement('div');
      rowClueEl.className = 'oa-nono-row-clue';
      if (satisfied) rowClueEl.classList.add('is-satisfied');
      if (this.activeHint && this.activeHint.axis === 'row' && this.activeHint.lineIndex === r) {
        rowClueEl.classList.add('is-line-focus');
      }
      for (const n of this.puzzle.clues.rows[r]) {
        const sp = document.createElement('span');
        sp.textContent = String(n);
        rowClueEl.appendChild(sp);
      }
      matrix.appendChild(rowClueEl);

      for (let c = 0; c < size; c++) {
        const val = this.board[r][c];
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'oa-nono-cell';
        if (val === 1) cell.classList.add('is-filled');
        else if (val === -1) cell.classList.add('is-crossed');

        if (size === 10 && c === 4) cell.classList.add('is-major-right');
        if (size === 10 && r === 4) cell.classList.add('is-major-bottom');

        const key = `${r}_${c}`;
        if (this.lastErrorKey === key) cell.classList.add('is-error');
        if (
          hintHighlightSet.has(key) ||
          (this.activeHint && this.activeHint.row === r && this.activeHint.col === c)
        ) {
          cell.classList.add('oa-mark-hint');
        }

        cell.setAttribute(
          'aria-label',
          `Fila ${r + 1}, Columna ${c + 1}: ${val === 1 ? 'pintada' : val === -1 ? 'descartada' : 'vacía'}`
        );

        if (val === -1) {
          cell.innerHTML = Icons.close(Math.max(12, Math.floor(cellSize * 0.45)));
        }

        cell.addEventListener('pointerdown', (ev) => {
          if (ev.button === 2) {
            ev.preventDefault();
            this.applyCellAction(r, c, -1, false);
            return;
          }
          if (ev.button === 0) {
            this.isPointerDragging = true;
            this.applyCellAction(r, c, this.activeTool, false);
          }
        });
        cell.addEventListener('pointerenter', () => {
          if (this.isPointerDragging) {
            this.applyCellAction(r, c, this.activeTool, true);
          }
        });
        cell.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
        });

        matrix.appendChild(cell);
      }
    }

    scroll.appendChild(matrix);
    wrap.append(meta, toolbar, scroll);
    this.stageEl.appendChild(wrap);

    this.renderSideActions();
  }

  private renderSideActions(): void {
    this.actionBoxEl.innerHTML = '';
    const actions = document.createElement('div');
    actions.className = 'oa-academy-actions';

    const hintBtn = document.createElement('button');
    hintBtn.type = 'button';
    hintBtn.disabled =
      this.pendingNextTimer > 0 || (!this.practiceMode && this.hintsUsed >= MAX_CHALLENGE_HINTS);
    hintBtn.innerHTML = `${Icons.lightbulb(16)}<span>Pista razonada (P)</span>`;
    hintBtn.addEventListener('click', () => this.showReasonedHint());
    actions.appendChild(hintBtn);

    if (this.practiceMode) {
      const undoBtn = document.createElement('button');
      undoBtn.type = 'button';
      undoBtn.disabled = this.history.length === 0;
      undoBtn.innerHTML = `${Icons.undo(16)}<span>Deshacer (U)</span>`;
      undoBtn.addEventListener('click', () => this.undo());

      const newBtn = document.createElement('button');
      newBtn.type = 'button';
      newBtn.innerHTML = `${Icons.refresh(16)}<span>Nuevo tablero</span>`;
      newBtn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.boardIdx++;
        this.loadBoard();
      });

      const cfgBtn = document.createElement('button');
      cfgBtn.type = 'button';
      cfgBtn.innerHTML = `${Icons.sliders(16)}<span>Cambiar tamaño</span>`;
      cfgBtn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.renderPrep();
      });

      actions.append(undoBtn, newBtn, cfgBtn);
    }

    this.actionBoxEl.appendChild(actions);
  }

  private finishRun(survived: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.phase = 'done';
    this.ctx.finish(this.getMetrics(survived));
  }

  private onPointerUp = (): void => {
    this.isPointerDragging = false;
    this.dragPaintValue = null;
  };

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

    if (e.key === '1' || e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      this.activeTool = 1;
      synthAudio.uiClick();
      this.renderBoard();
      return;
    }
    if (e.key === '2' || e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      this.activeTool = -1;
      synthAudio.uiClick();
      this.renderBoard();
      return;
    }
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      this.showReasonedHint();
      return;
    }
    if ((e.key === 'u' || e.key === 'U') && this.practiceMode) {
      e.preventDefault();
      this.undo();
    }
  };

  public update(dt: number, _elapsed: number): void {
    if (this.paused || this.destroyed || this.phase !== 'playing') return;
    this.elapsed += dt;

    if (this.pendingNextTimer > 0) {
      this.pendingNextTimer -= dt;
      if (this.pendingNextTimer <= 0) {
        this.pendingNextTimer = 0;
        this.boardIdx++;
        this.loadBoard();
      }
    }

    if (this.isGauntletSlice && this.elapsed >= 15 && !this.finished) {
      this.finishRun(true);
    }
  }

  public onResize(): void {}

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.isPointerDragging = false;
      this.dragPaintValue = null;
    }
  }

  public getMetrics(
    survived = this.boardsSolved > 0 || this.hits > 0 || this.practiceMode
  ): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const total = Math.max(1, this.hits + this.errors);
    const accuracy = Math.round((this.hits / total) * 100);
    const sizeBonus = this.puzzle ? (this.puzzle.size === 5 ? 0 : this.puzzle.size === 8 ? 120 : 240) : 0;
    const progress = this.puzzle
      ? Math.min(1, this.hits / Math.max(1, this.puzzle.size * this.puzzle.size * 0.5))
      : 0;
    const logicScore = survived
      ? Math.min(1000, Math.round(420 + sizeBonus + this.boardsSolved * 160 + progress * 160 - this.errors * 45))
      : Math.min(600, Math.round(200 + progress * 250 + this.boardsSolved * 140));

    return {
      score: this.score,
      maxCombo: Math.max(1, this.maxCombo),
      accuracy,
      hits: this.hits,
      misses: this.errors,
      puzzlesSolved: this.boardsSolved,
      survived,
      axisPerformances: {
        logic: Math.max(100, logicScore),
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('blur', this.onPointerUp);
  }
}
