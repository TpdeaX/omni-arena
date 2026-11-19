import '../styles/academy-intel.css';
import { synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import { GameContext, MiniGame, RunMetrics } from '../types';
import { createAcademyLayout, renderExplanationBox } from '../ui/AcademyKit';
import {
  findConflicts,
  generateSudokuPuzzle,
  getBoxIndex,
  getReasonedHint,
  isBoardSolved,
  type SudokuCoord,
  type SudokuDifficulty,
  type SudokuPuzzle,
  type SudokuSize,
} from './intel/sudokuEngine';

interface SudokuSnapshot {
  board: number[];
  notes: number[][];
}

const MAX_CHALLENGE_ERRORS = 3;
const MAX_CHALLENGE_HINTS = 2;

export class SudokuGuide2DGame implements MiniGame {
  public readonly id = 'sudoku2d' as const;

  private ctx!: GameContext;
  private isGauntletSlice = false;
  private practiceMode = false;
  private infiniteMode = false;
  private paused = false;
  private destroyed = false;
  private finished = false;

  private stageEl!: HTMLDivElement;
  private sideEl!: HTMLElement;
  private explainEl!: HTMLDivElement;
  private actionBoxEl!: HTMLDivElement;

  private phase: 'prep' | 'playing' | 'done' = 'prep';
  private selectedSize: SudokuSize = 6;
  private selectedDifficulty: SudokuDifficulty = 'medium';

  private puzzle!: SudokuPuzzle;
  private board: number[] = [];
  private notes: Set<number>[] = [];
  private history: SudokuSnapshot[] = [];

  private selectedIdx = 0;
  private notesMode = false;
  private hintHighlights: SudokuCoord[] = [];
  private lastErrorIdx: number | null = null;

  private errors = 0;
  private hintsUsed = 0;
  private boardHintsUsed = 0;
  private boardsSolved = 0;
  private boardStartElapsed = 0;
  private hits = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private elapsed = 0;
  private runSeed = Date.now() & 0x7fffffff;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.practiceMode = Boolean(ctx.practiceMode);
    this.infiniteMode = Boolean(ctx.infiniteMode && !this.isGauntletSlice && !this.practiceMode);

    if (this.infiniteMode || ctx.difficulty === 'progressive' || ctx.difficulty === 'chill') {
      this.selectedSize = 4;
      this.selectedDifficulty = 'easy';
    } else if (ctx.difficulty === 'hyper') {
      this.selectedSize = 9;
      this.selectedDifficulty = 'hard';
    } else {
      this.selectedSize = 6;
      this.selectedDifficulty = 'medium';
    }

    const layout = createAcademyLayout(
      ctx.container,
      'SUDOKU RAZONADO',
      this.practiceMode ? 'PRÁCTICA' : this.infiniteMode ? 'INFINITO' : 'RETO'
    );
    this.stageEl = layout.stageEl;
    this.sideEl = layout.sideEl;

    this.explainEl = document.createElement('div');
    this.actionBoxEl = document.createElement('div');
    this.actionBoxEl.className = 'oa-academy-card';
    this.sideEl.append(this.explainEl, this.actionBoxEl);

    window.addEventListener('keydown', this.onKeyDown);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'SUDOKU RAZONADO',
      accent: '#0369A1',
      timeLeftSec: null,
      subStat: 'PREPARACIÓN',
    });

    this.renderPrep();
  }

  private updateControlsHint(): void {
    if (!this.ctx.setControls) return;
    if (this.phase === 'prep') {
      this.ctx.setControls([
        { keys: ['Clic', 'Enter'], touch: 'Toca Empezar', action: 'Generar tablero único', tone: 'primary' },
      ]);
      return;
    }

    const maxDigit = this.selectedSize;
    const hints = [
      { keys: ['Flechas', 'Clic'], touch: 'Toca una celda', action: 'Seleccionar celda' },
      { keys: [`1–${maxDigit}`], touch: 'Toca un número', action: 'Colocar / Candidato', tone: 'primary' as const },
      { keys: ['N'], touch: 'Botón Candidatos', action: 'Modo notas' },
      { keys: ['P'], touch: 'Botón Pista', action: 'Pista razonada', tone: 'primary' as const },
    ];
    if (this.practiceMode) {
      hints.push({ keys: ['U'], touch: 'Botón Deshacer', action: 'Deshacer jugada' });
    }
    this.ctx.setControls(hints);
  }

  private renderPrep(): void {
    this.phase = 'prep';
    this.updateControlsHint();
    this.stageEl.innerHTML = '';

    const prep = document.createElement('div');
    prep.className = 'oa-intel-prep';

    const h = document.createElement('h3');
    h.className = 'oa-intel-prep-title';
    h.textContent = 'Configura tu tablero de Sudoku';

    const p = document.createElement('p');
    p.className = 'oa-intel-prep-sub';
    p.textContent = this.practiceMode
      ? 'Todos los tableros tienen solución única verificada. Usa Candidatos, Deshacer y Pista Razonada cuando necesites ver el porqué.'
      : this.infiniteMode
      ? 'Modo Infinito: al resolver un tablero se genera automáticamente el siguiente escalando 4×4 → 6×6 → 9×9. Los errores restan escudos del HUD.'
      : `Modo Reto: tablero de solución única. Máximo ${MAX_CHALLENGE_ERRORS} errores y ${MAX_CHALLENGE_HINTS} pistas razonadas.`;

    // Size selector
    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'oa-intel-group';
    const sizeLbl = document.createElement('span');
    sizeLbl.className = 'oa-intel-label';
    sizeLbl.textContent = 'Tamaño del tablero';
    const sizePills = document.createElement('div');
    sizePills.className = 'oa-intel-pills';

    const sizes: { val: SudokuSize; label: string }[] = [
      { val: 4, label: '4x4 (cajas 2x2)' },
      { val: 6, label: '6x6 (cajas 2x3)' },
      { val: 9, label: '9x9 (cajas 3x3)' },
    ];

    const renderSizePills = () => {
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
          renderSizePills();
        });
        sizePills.appendChild(b);
      }
    };
    renderSizePills();
    sizeGroup.append(sizeLbl, sizePills);

    // Difficulty selector
    const diffGroup = document.createElement('div');
    diffGroup.className = 'oa-intel-group';
    const diffLbl = document.createElement('span');
    diffLbl.className = 'oa-intel-label';
    diffLbl.textContent = 'Nivel lógico';
    const diffPills = document.createElement('div');
    diffPills.className = 'oa-intel-pills';

    const diffs: { val: SudokuDifficulty; label: string }[] = [
      { val: 'easy', label: 'Fácil (solo singles)' },
      { val: 'medium', label: 'Media (pares e intersección)' },
      { val: 'hard', label: 'Difícil' },
    ];

    const renderDiffPills = () => {
      diffPills.innerHTML = '';
      for (const d of diffs) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'oa-intel-pill';
        b.textContent = d.label;
        b.setAttribute('aria-pressed', this.selectedDifficulty === d.val ? 'true' : 'false');
        b.addEventListener('click', () => {
          synthAudio.uiClick();
          this.selectedDifficulty = d.val;
          renderDiffPills();
        });
        diffPills.appendChild(b);
      }
    };
    renderDiffPills();
    diffGroup.append(diffLbl, diffPills);

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'oa-intel-primary-btn';
    startBtn.textContent = 'Empezar';
    startBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.startPuzzle();
    });

    prep.append(h, p, sizeGroup, diffGroup, startBtn);
    this.stageEl.appendChild(prep);

    renderExplanationBox(
      this.explainEl,
      'Deducción sin adivinar',
      'Selecciona una celda y usa Candidatos (N) para anotar posibles números. Pulsa Pista Razonada (P) para ver paso a paso qué técnica lógica aplica.',
      'info'
    );
    this.actionBoxEl.innerHTML = '';
  }

  private startPuzzle(resetSession = true): void {
    this.phase = 'playing';
    this.finished = false;
    if (resetSession) {
      this.errors = 0;
      this.hintsUsed = 0;
      this.boardsSolved = 0;
      this.hits = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.score = 0;
      this.elapsed = 0;
      this.runSeed = (Date.now() ^ (this.selectedSize * 997)) >>> 0;
    }
    this.boardHintsUsed = 0;
    this.boardStartElapsed = this.elapsed;
    this.history = [];
    this.hintHighlights = [];
    this.lastErrorIdx = null;
    this.notesMode = false;

    const seed = (this.runSeed + this.boardsSolved * 7919 + this.selectedSize * 131) >>> 0;
    this.puzzle = generateSudokuPuzzle(this.selectedSize, this.selectedDifficulty, seed);
    this.board = [...this.puzzle.givens];
    this.notes = Array.from({ length: this.board.length }, () => new Set<number>());

    const firstEmpty = this.board.findIndex((v) => v === 0);
    this.selectedIdx = firstEmpty !== -1 ? firstEmpty : 0;

    renderExplanationBox(
      this.explainEl,
      `Sudoku ${this.selectedSize}x${this.selectedSize} listo`,
      'Toca una casilla vacía e introduce un número del 1 al ' + this.selectedSize + '.',
      'info'
    );

    this.updateControlsHint();
    this.renderBoard();
    this.updateHud();
  }

  private updateHud(): void {
    const emptyCount = this.board.filter((v) => v === 0).length;
    const errText = this.practiceMode
      ? `FALTAN ${emptyCount}`
      : this.infiniteMode
      ? `TABLEROS ${this.boardsSolved} · ${this.puzzle.size}×${this.puzzle.size} · FALTAN ${emptyCount}`
      : `ERRORES ${this.errors}/${MAX_CHALLENGE_ERRORS} · FALTAN ${emptyCount}`;
    this.ctx.setHud({
      subStat: errText,
    });
  }

  private pushSnapshot(): void {
    if (!this.practiceMode) return;
    this.history.push({
      board: [...this.board],
      notes: this.notes.map((s) => Array.from(s)),
    });
  }

  private undo(): void {
    if (!this.practiceMode || this.history.length === 0 || this.phase !== 'playing') return;
    const snap = this.history.pop()!;
    this.board = snap.board;
    this.notes = snap.notes.map((arr) => new Set(arr));
    this.hintHighlights = [];
    this.lastErrorIdx = null;
    synthAudio.uiClick();
    renderExplanationBox(this.explainEl, 'Jugada deshecha', 'Se restauró el estado anterior.', 'info');
    this.renderBoard();
    this.updateHud();
  }

  private applyNumber(digit: number): void {
    if (this.phase !== 'playing') return;
    const idx = this.selectedIdx;
    if (this.puzzle.givens[idx] !== 0) {
      this.ctx.toast('Esa casilla es una pista fija.', 'warn');
      return;
    }

    this.hintHighlights = [];
    this.lastErrorIdx = null;

    if (this.notesMode) {
      if (this.board[idx] !== 0) {
        this.ctx.toast('Borra primero el número fijo para editar candidatos.', 'warn');
        return;
      }
      this.pushSnapshot();
      if (this.notes[idx].has(digit)) {
        this.notes[idx].delete(digit);
      } else {
        this.notes[idx].add(digit);
      }
      synthAudio.uiClick();
      this.renderBoard();
      return;
    }

    // Placing value
    if (this.board[idx] === digit) return;
    this.pushSnapshot();

    const size = this.puzzle.size;
    const r = Math.floor(idx / size);
    const c = idx % size;

    if (!this.practiceMode && digit !== this.puzzle.solution[idx]) {
      this.errors++;
      this.combo = 0;
      this.lastErrorIdx = idx;
      const shieldsLeft = this.ctx.damage(1);
      this.ctx.breakCombo();
      synthAudio.damage();

      if (this.infiniteMode) {
        renderExplanationBox(
          this.explainEl,
          `Número incorrecto · Escudos: ${shieldsLeft}`,
          `El ${digit} no va en Fila ${r + 1}, Columna ${c + 1}. ${
            shieldsLeft > 0
              ? `Te quedan ${shieldsLeft} escudos en Modo Infinito.`
              : 'Te has quedado sin escudos.'
          }`,
          'bad'
        );
        this.renderBoard();
        this.updateHud();
        if (shieldsLeft <= 0) {
          this.finishRun(false);
        }
        return;
      }

      const remaining = MAX_CHALLENGE_ERRORS - this.errors;
      renderExplanationBox(
        this.explainEl,
        `Número incorrecto (${this.errors}/${MAX_CHALLENGE_ERRORS})`,
        `El ${digit} no va en Fila ${r + 1}, Columna ${c + 1}. ${remaining > 0 ? `Te quedan ${remaining} errores permitidos.` : 'Has alcanzado el límite de 3 errores.'}`,
        'bad'
      );
      this.renderBoard();
      this.updateHud();

      if (this.errors >= MAX_CHALLENGE_ERRORS || shieldsLeft <= 0) {
        this.finishRun(false);
      }
      return;
    }

    this.board[idx] = digit;
    this.notes[idx].clear();

    // Auto-clear digit from peer notes
    const b = getBoxIndex(r, c, size);
    for (let i = 0; i < this.board.length; i++) {
      const ir = Math.floor(i / size);
      const ic = i % size;
      if (ir === r || ic === c || getBoxIndex(ir, ic, size) === b) {
        this.notes[i].delete(digit);
      }
    }

    if (digit === this.puzzle.solution[idx]) {
      this.hits++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const pts = 40 + size * 5;
      this.score += pts;
      this.ctx.addScore(pts, 1);
      synthAudio.pickup();
    } else {
      synthAudio.uiClick();
    }

    if (this.practiceMode) {
      const conflicts = findConflicts(this.board, size);
      if (conflicts.has(idx)) {
        renderExplanationBox(
          this.explainEl,
          `Conflicto en Fila ${r + 1}, Columna ${c + 1}`,
          `El ${digit} ya aparece en esa misma fila, columna o caja. Puedes cambiarlo o usar Deshacer.`,
          'warn'
        );
      }
    }

    this.renderBoard();
    this.updateHud();

    if (isBoardSolved(this.board, this.puzzle.solution)) {
      this.onSolved();
    }
  }

  private clearCell(): void {
    if (this.phase !== 'playing') return;
    const idx = this.selectedIdx;
    if (this.puzzle.givens[idx] !== 0) return;
    if (this.board[idx] === 0 && this.notes[idx].size === 0) return;
    this.pushSnapshot();
    this.board[idx] = 0;
    this.notes[idx].clear();
    this.hintHighlights = [];
    this.lastErrorIdx = null;
    synthAudio.uiClick();
    this.renderBoard();
    this.updateHud();
  }

  private showReasonedHint(): void {
    if (this.phase !== 'playing') return;
    if (!this.practiceMode && this.boardHintsUsed >= MAX_CHALLENGE_HINTS) {
      this.ctx.toast('Sin pistas restantes en este tablero.', 'warn');
      return;
    }

    // If board currently has wrong user entries in practice, warn gently first
    const size = this.puzzle.size;
    if (this.practiceMode) {
      const conflicts = findConflicts(this.board, size);
      if (conflicts.size > 0) {
        const firstBad = [...conflicts][0];
        const r = Math.floor(firstBad / size) + 1;
        const c = (firstBad % size) + 1;
        this.selectedIdx = firstBad;
        renderExplanationBox(
          this.explainEl,
          `Corrige primero el conflicto (Fila ${r}, Col ${c})`,
          'Hay números repetidos marcados en rojo. Corrige o deshaz esos conflictos antes de deducir la siguiente casilla.',
          'warn'
        );
        this.renderBoard();
        return;
      }
    }

    const hint = getReasonedHint(this.board, size, this.puzzle.solution, this.notes);
    if (!hint) return;

    this.hintsUsed++;
    this.boardHintsUsed++;
    this.selectedIdx = hint.row * size + hint.col;
    this.hintHighlights = hint.highlightCells;

    if (hint.kind === 'eliminate' && hint.eliminations) {
      // Populate valid notes on target cells if empty so elimination is visible & step advances next click
      this.pushSnapshot();
      for (const elim of hint.eliminations) {
        const eIdx = elim.row * size + elim.col;
        if (this.notes[eIdx].size === 0) {
          for (let d = 1; d <= size; d++) {
            // Check legal wrt board
            const er = elim.row;
            const ec = elim.col;
            const eb = getBoxIndex(er, ec, size);
            let blocked = false;
            for (let i = 0; i < this.board.length; i++) {
              if (this.board[i] !== d) continue;
              const ir = Math.floor(i / size);
              const ic = i % size;
              if (ir === er || ec === ic || getBoxIndex(ir, ic, size) === eb) {
                blocked = true;
                break;
              }
            }
            if (!blocked) this.notes[eIdx].add(d);
          }
        }
        for (const v of elim.values) {
          this.notes[eIdx].delete(v);
        }
      }
    }

    synthAudio.uiClick();
    renderExplanationBox(this.explainEl, hint.title, hint.explanation, 'info');
    this.renderBoard();
  }

  private onSolved(): void {
    const size = this.puzzle.size;
    this.boardsSolved += 1;
    const sizeMult = size === 4 ? 1 : size === 6 ? 1.5 : 2.3;
    const diffMult =
      this.puzzle.difficulty === 'easy' ? 1 : this.puzzle.difficulty === 'medium' ? 1.3 : 1.7;
    const boardElapsed = Math.max(1, this.elapsed - this.boardStartElapsed);
    const timeBonus = Math.max(0, Math.round(450 - boardElapsed * 1.5));
    const errPenalty = this.infiniteMode ? this.errors * 40 : this.errors * 120;
    const bonus = Math.max(
      200,
      Math.round(700 * sizeMult * diffMult + timeBonus - errPenalty - this.boardHintsUsed * 40)
    );
    this.score += bonus;
    this.ctx.addScore(bonus, 2);
    synthAudio.puzzleSuccess(3);

    if (this.infiniteMode) {
      if (this.selectedSize === 4) {
        this.selectedSize = 6;
        this.selectedDifficulty = 'easy';
      } else if (this.selectedSize === 6) {
        this.selectedSize = 9;
        this.selectedDifficulty = 'medium';
      } else {
        this.selectedDifficulty = this.selectedDifficulty === 'easy' ? 'medium' : 'hard';
      }

      this.ctx.toast(
        `TABLERO #${this.boardsSolved} RESUELTO · SIGUIENTE ${this.selectedSize}×${this.selectedSize}`,
        'good'
      );
      this.startPuzzle(false);
      renderExplanationBox(
        this.explainEl,
        `Tablero #${this.boardsSolved} resuelto · Ahora ${this.selectedSize}x${this.selectedSize}`,
        `Excelente deducción (+${bonus} pts). Nuevo tablero ${this.selectedSize}x${this.selectedSize} generado automáticamente.`,
        'good'
      );
      return;
    }

    renderExplanationBox(
      this.explainEl,
      'Tablero completado',
      `Resolviste el Sudoku ${size}x${size} con ${this.errors} errores y ${this.hintsUsed} pistas.`,
      'good'
    );

    this.finishRun(true);
  }

  private finishRun(survived: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.phase = 'done';
    this.ctx.finish(this.getMetrics(survived));
  }

  private renderBoard(): void {
    this.stageEl.innerHTML = '';
    const size = this.puzzle.size;
    const { boxRows, boxCols } = this.puzzle;

    const wrap = document.createElement('div');
    wrap.className = 'oa-sudoku-wrap';

    // Status row
    const meta = document.createElement('div');
    meta.className = 'oa-intel-meta-row';
    meta.style.width = '100%';
    meta.style.maxWidth = '440px';

    const infoChip = document.createElement('span');
    infoChip.className = 'oa-intel-stat-chip';
    const diffName =
      this.puzzle.difficulty === 'easy'
        ? 'Fácil'
        : this.puzzle.difficulty === 'medium'
          ? 'Media'
          : 'Difícil';
    infoChip.textContent = `${size}x${size} · ${diffName}`;

    const rightChip = document.createElement('span');
    rightChip.className = `oa-intel-stat-chip${
      !this.practiceMode && !this.infiniteMode && this.errors >= 2 ? ' is-danger' : ''
    }`;
    rightChip.textContent = this.practiceMode
      ? `Pistas usadas: ${this.hintsUsed}`
      : this.infiniteMode
      ? `Resueltos: ${this.boardsSolved} · Pistas: ${Math.max(0, MAX_CHALLENGE_HINTS - this.boardHintsUsed)}`
      : `Errores: ${this.errors}/${MAX_CHALLENGE_ERRORS} · Pistas: ${Math.max(0, MAX_CHALLENGE_HINTS - this.boardHintsUsed)}`;

    meta.append(infoChip, rightChip);

    // Grid
    const boardEl = document.createElement('div');
    boardEl.className = `oa-sudoku-board is-size-${size}`;
    boardEl.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;
    boardEl.setAttribute('role', 'grid');
    boardEl.setAttribute('aria-label', `Tablero Sudoku ${size} por ${size}`);

    const selRow = Math.floor(this.selectedIdx / size);
    const selCol = this.selectedIdx % size;
    const selBox = getBoxIndex(selRow, selCol, size);
    const selVal = this.board[this.selectedIdx];
    const conflicts = this.practiceMode ? findConflicts(this.board, size) : new Set<number>();
    const hintSet = new Set(this.hintHighlights.map((c) => c.row * size + c.col));

    for (let idx = 0; idx < this.board.length; idx++) {
      const r = Math.floor(idx / size);
      const c = idx % size;
      const b = getBoxIndex(r, c, size);
      const val = this.board[idx];
      const isGiven = this.puzzle.givens[idx] !== 0;

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'oa-sudoku-cell';
      if (isGiven) cell.classList.add('is-given');
      else if (val !== 0) cell.classList.add('is-user');

      if ((c + 1) % boxCols === 0 && c + 1 < size) cell.classList.add('is-box-right');
      if ((r + 1) % boxRows === 0 && r + 1 < size) cell.classList.add('is-box-bottom');

      if (idx === this.selectedIdx) {
        cell.classList.add('is-selected');
      } else if (selVal !== 0 && val === selVal) {
        cell.classList.add('is-same-digit');
      } else if (r === selRow || c === selCol || b === selBox) {
        cell.classList.add('is-peer');
      }

      if (conflicts.has(idx) || idx === this.lastErrorIdx) {
        cell.classList.add('is-conflict');
      }
      if (hintSet.has(idx)) {
        cell.classList.add('oa-mark-hint');
      }

      cell.setAttribute('aria-label', `Fila ${r + 1}, Columna ${c + 1}${val ? `, valor ${val}` : ', vacía'}`);

      if (val !== 0) {
        cell.textContent = String(val);
      } else if (this.notes[idx].size > 0) {
        const notesGrid = document.createElement('div');
        notesGrid.className = `oa-sudoku-notes ${size === 4 ? 'is-cols-2' : 'is-cols-3'}`;
        for (let d = 1; d <= size; d++) {
          const sp = document.createElement('span');
          sp.className = 'oa-sudoku-note-item';
          sp.textContent = this.notes[idx].has(d) ? String(d) : '';
          notesGrid.appendChild(sp);
        }
        cell.appendChild(notesGrid);
      }

      cell.addEventListener('click', () => {
        this.selectedIdx = idx;
        this.lastErrorIdx = null;
        this.renderBoard();
      });

      boardEl.appendChild(cell);
    }

    // Number pad
    const padEl = document.createElement('div');
    padEl.className = 'oa-sudoku-pad';

    const digitCounts = new Map<number, number>();
    for (const v of this.board) {
      if (v !== 0) digitCounts.set(v, (digitCounts.get(v) ?? 0) + 1);
    }

    for (let d = 1; d <= size; d++) {
      const keyBtn = document.createElement('button');
      keyBtn.type = 'button';
      keyBtn.className = 'oa-sudoku-key';
      if ((digitCounts.get(d) ?? 0) >= size) {
        keyBtn.classList.add('is-complete');
      }
      keyBtn.textContent = String(d);
      keyBtn.setAttribute('aria-label', `Número ${d}`);
      keyBtn.addEventListener('click', () => this.applyNumber(d));
      padEl.appendChild(keyBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'oa-sudoku-key';
    delBtn.textContent = 'Borrar';
    delBtn.style.gridColumn = 'span 2';
    delBtn.addEventListener('click', () => this.clearCell());
    padEl.appendChild(delBtn);

    wrap.append(meta, boardEl, padEl);
    this.stageEl.appendChild(wrap);

    this.renderSideActions();
  }

  private renderSideActions(): void {
    this.actionBoxEl.innerHTML = '';
    const actions = document.createElement('div');
    actions.className = 'oa-academy-actions';

    const notesBtn = document.createElement('button');
    notesBtn.type = 'button';
    notesBtn.setAttribute('aria-pressed', this.notesMode ? 'true' : 'false');
    if (this.notesMode) {
      notesBtn.style.borderColor = 'var(--accent-cyan)';
      notesBtn.style.background = 'rgba(0, 229, 255, 0.14)';
    }
    notesBtn.textContent = `Candidatos (N): ${this.notesMode ? 'Sí' : 'No'}`;
    notesBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.notesMode = !this.notesMode;
      this.renderBoard();
    });

    const hintBtn = document.createElement('button');
    hintBtn.type = 'button';
    hintBtn.disabled = !this.practiceMode && this.boardHintsUsed >= MAX_CHALLENGE_HINTS;
    hintBtn.innerHTML = `${Icons.lightbulb(16)}<span>Pista razonada (P)</span>`;
    hintBtn.addEventListener('click', () => this.showReasonedHint());

    actions.append(notesBtn, hintBtn);

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
        this.renderPrep();
      });

      actions.append(undoBtn, newBtn);
    }

    this.actionBoxEl.appendChild(actions);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'Escape' || e.key === '?') return;

    if (this.phase === 'prep') {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.startPuzzle();
      }
      return;
    }

    if (this.phase !== 'playing') return;

    const size = this.puzzle.size;
    const r = Math.floor(this.selectedIdx / size);
    const c = this.selectedIdx % size;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIdx = ((r - 1 + size) % size) * size + c;
      this.renderBoard();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIdx = ((r + 1) % size) * size + c;
      this.renderBoard();
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.selectedIdx = r * size + ((c - 1 + size) % size);
      this.renderBoard();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.selectedIdx = r * size + ((c + 1) % size);
      this.renderBoard();
      return;
    }

    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      this.notesMode = !this.notesMode;
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
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      e.preventDefault();
      this.clearCell();
      return;
    }

    const num = Number(e.key);
    if (Number.isInteger(num) && num >= 1 && num <= size) {
      e.preventDefault();
      this.applyNumber(num);
    }
  };

  public update(dt: number, _elapsed: number): void {
    if (this.paused || this.destroyed || this.phase !== 'playing') return;
    this.elapsed += dt;
    if (this.isGauntletSlice && this.elapsed >= 15 && !this.finished) {
      this.finishRun(true);
    }
  }

  public onResize(): void {}

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getMetrics(survived = true): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const filled = this.board.filter((v, i) => v !== 0 && v === this.puzzle?.solution[i] && this.puzzle.givens[i] === 0).length;
    const totalToFill = this.puzzle ? this.puzzle.givens.filter((v) => v === 0).length : 1;
    const progressRatio = Math.min(1, filled / Math.max(1, totalToFill));
    const sizeBonus = this.selectedSize === 4 ? 0 : this.selectedSize === 6 ? 120 : 250;
    const totalAttempts = this.hits + this.errors;
    const accuracy = totalAttempts > 0 ? Math.round((this.hits / totalAttempts) * 100) : 0;

    let logicScore: number;
    if (this.boardsSolved >= 1) {
      const extraBoards = (this.boardsSolved - 1) * 140 + (this.infiniteMode ? progressRatio * 100 : 0);
      logicScore = Math.min(
        1000,
        Math.round(520 + sizeBonus + 200 + extraBoards - this.errors * 40 - this.hintsUsed * 25)
      );
    } else if (totalAttempts === 0) {
      logicScore = 140;
    } else {
      logicScore = Math.min(
        620,
        Math.round(160 + progressRatio * 360 + this.hits * 4 - this.errors * 35)
      );
    }

    return {
      score: this.score,
      maxCombo: this.maxCombo,
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
  }
}
