import '../styles/academy-intel.css';
import { synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import { GameContext, MiniGame, RunMetrics } from '../types';
import { createAcademyLayout, renderExplanationBox } from '../ui/AcademyKit';
import {
  applyMove,
  buildRecursiveTrace,
  cloneHanoiState,
  createHanoiState,
  getOptimalNextMove,
  isSolved,
  optimalMovesCount,
  TOWER_NAMES,
  validateMove,
  type HanoiState,
  type HanoiTraceStep,
  type TowerIndex,
} from './intel/hanoiEngine';

export class HanoiLogic2DGame implements MiniGame {
  public readonly id = 'hanoi2d' as const;

  private ctx!: GameContext;
  private isGauntletSlice = false;
  private practiceMode = false;
  private paused = false;
  private destroyed = false;
  private finished = false;

  private stageEl!: HTMLDivElement;
  private sideEl!: HTMLElement;
  private explainEl!: HTMLDivElement;
  private actionBoxEl!: HTMLDivElement;
  private traceBoxEl!: HTMLDivElement;

  private phase: 'prep' | 'playing' | 'done' = 'prep';
  private numDisks = 4;
  private state!: HanoiState;
  private history: HanoiState[] = [];

  private selectedTower: TowerIndex | null = null;
  private hintPair: { from: TowerIndex; to: TowerIndex } | null = null;
  private illegalTower: TowerIndex | null = null;

  // Recursive example viewer (Practice mode)
  private traceActive = false;
  private traceSteps: HanoiTraceStep[] = [];
  private traceStepIdx = -1; // -1 = initial state before step 0
  private tracePlaying = false;
  private traceAccumSec = 0;

  private errors = 0;
  private hits = 0;
  private score = 0;
  private elapsed = 0;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.practiceMode = Boolean(ctx.practiceMode);

    if (ctx.difficulty === 'chill') this.numDisks = 3;
    else if (ctx.difficulty === 'hyper') this.numDisks = 5;
    else this.numDisks = 4;

    const layout = createAcademyLayout(
      ctx.container,
      'TORRES DE HANÓI',
      this.practiceMode ? 'PRÁCTICA' : 'RETO'
    );
    this.stageEl = layout.stageEl;
    this.sideEl = layout.sideEl;

    this.explainEl = document.createElement('div');
    this.actionBoxEl = document.createElement('div');
    this.actionBoxEl.className = 'oa-academy-card';
    this.traceBoxEl = document.createElement('div');
    this.traceBoxEl.className = 'oa-academy-card';
    this.sideEl.append(this.explainEl, this.actionBoxEl, this.traceBoxEl);

    window.addEventListener('keydown', this.onKeyDown);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'TORRES DE HANÓI',
      accent: '#15803D',
      timeLeftSec: null,
      subStat: 'PREPARACIÓN',
    });

    this.renderPrep();
  }

  private updateControlsHint(): void {
    if (!this.ctx.setControls) return;
    if (this.phase === 'prep') {
      this.ctx.setControls([
        { keys: ['Clic', 'Enter'], touch: 'Toca Empezar', action: 'Iniciar torres', tone: 'primary' },
      ]);
      return;
    }
    if (this.traceActive) {
      this.ctx.setControls([
        { keys: ['Flechas'], touch: 'Anterior / Siguiente', action: 'Recorrer recursión', tone: 'primary' },
        { keys: ['Espacio'], touch: 'Reproducir / Pausar', action: 'Autoavance' },
      ]);
      return;
    }
    const hints = [
      { keys: ['1', '2', '3'], touch: 'Toca una torre', action: 'Elegir origen y destino', tone: 'primary' as const },
    ];
    if (this.practiceMode) {
      hints.push(
        { keys: ['P'], touch: 'Botón Siguiente paso', action: 'Paso óptimo explicado', tone: 'primary' },
        { keys: ['U'], touch: 'Botón Deshacer', action: 'Deshacer jugada', tone: 'primary' }
      );
    }
    this.ctx.setControls(hints);
  }

  private renderPrep(): void {
    this.phase = 'prep';
    this.traceActive = false;
    this.tracePlaying = false;
    this.updateControlsHint();
    this.stageEl.innerHTML = '';

    const prep = document.createElement('div');
    prep.className = 'oa-intel-prep';

    const h = document.createElement('h3');
    h.className = 'oa-intel-prep-title';
    h.textContent = 'Configura las Torres de Hanói';

    const p = document.createElement('p');
    p.className = 'oa-intel-prep-sub';
    p.textContent = this.practiceMode
      ? 'Mueve toda la torre desde A hasta C sin colocar nunca un disco grande sobre uno más pequeño. Incluye reproductor de la pila recursiva hanoi(n, A→C).'
      : 'Modo Reto: lleva todos los discos de A a C en el menor número de movimientos y tiempo posible. Los intentos ilegales cuentan como error.';

    const group = document.createElement('div');
    group.className = 'oa-intel-group';
    const lbl = document.createElement('span');
    lbl.className = 'oa-intel-label';
    lbl.textContent = 'Número de discos';
    const pills = document.createElement('div');
    pills.className = 'oa-intel-pills';

    const renderPills = () => {
      pills.innerHTML = '';
      for (const n of [3, 4, 5, 6]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'oa-intel-pill';
        btn.textContent = `${n} discos (óptimo ${optimalMovesCount(n)})`;
        btn.setAttribute('aria-pressed', this.numDisks === n ? 'true' : 'false');
        btn.addEventListener('click', () => {
          synthAudio.uiClick();
          this.numDisks = n;
          renderPills();
        });
        pills.appendChild(btn);
      }
    };
    renderPills();
    group.append(lbl, pills);

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'oa-intel-primary-btn';
    startBtn.textContent = 'Empezar';
    startBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.startBoard();
    });

    prep.append(h, p, group, startBtn);
    this.stageEl.appendChild(prep);

    renderExplanationBox(
      this.explainEl,
      'Regla de oro recursiva',
      'Para mover N discos de A a C: primero mueve N-1 discos de A a B (auxiliar), luego el disco mayor de A a C, y finalmente los N-1 de B a C.',
      'info'
    );
    this.actionBoxEl.innerHTML = '';
    this.traceBoxEl.innerHTML = '';
    this.traceBoxEl.style.display = 'none';
  }

  private startBoard(): void {
    this.phase = 'playing';
    this.finished = false;
    this.state = createHanoiState(this.numDisks);
    this.history = [];
    this.selectedTower = null;
    this.hintPair = null;
    this.illegalTower = null;
    this.traceActive = false;
    this.tracePlaying = false;
    this.traceSteps = buildRecursiveTrace(this.numDisks);
    this.traceStepIdx = -1;
    this.errors = 0;
    this.hits = 0;
    this.score = 0;
    this.elapsed = 0;

    renderExplanationBox(
      this.explainEl,
      `Objetivo: Torre A → Torre C (${optimalMovesCount(this.numDisks)} óptimos)`,
      'Elige una torre de origen (clic o teclas 1/2/3). Las torres donde cabe el disco se marcan en verde; las bloqueadas en rojo.',
      'info'
    );

    this.updateControlsHint();
    this.renderBoard();
    this.updateHud();
  }

  private updateHud(): void {
    const opt = optimalMovesCount(this.numDisks);
    this.ctx.setHud({
      subStat: `MOVIMIENTOS ${this.state.moves}/${opt} · ERRORES ${this.errors}`,
    });
  }

  private handleTowerClick(towerIdx: TowerIndex): void {
    if (this.phase !== 'playing' || this.traceActive) return;

    this.hintPair = null;
    this.illegalTower = null;

    if (this.selectedTower === null) {
      if (this.state.towers[towerIdx].length === 0) {
        this.illegalTower = towerIdx;
        synthAudio.damage();
        renderExplanationBox(
          this.explainEl,
          `Torre ${TOWER_NAMES[towerIdx]} vacía`,
          `No hay ningún disco en la torre ${TOWER_NAMES[towerIdx]}. Selecciona una torre que tenga al menos un disco.`,
          'warn'
        );
        this.renderBoard();
        return;
      }
      this.selectedTower = towerIdx;
      synthAudio.uiClick();
      const topDisk = this.state.towers[towerIdx][this.state.towers[towerIdx].length - 1];
      renderExplanationBox(
        this.explainEl,
        `Disco ${topDisk} seleccionado (Torre ${TOWER_NAMES[towerIdx]})`,
        'Toca una torre marcada en verde para moverlo allí, o vuelve a tocar la misma torre para cancelar.',
        'info'
      );
      this.renderBoard();
      return;
    }

    if (this.selectedTower === towerIdx) {
      this.selectedTower = null;
      synthAudio.uiClick();
      this.renderBoard();
      return;
    }

    const check = validateMove(this.state, this.selectedTower, towerIdx);
    if (!check.valid) {
      this.illegalTower = towerIdx;
      this.errors++;
      synthAudio.damage();
      if (!this.practiceMode) {
        this.ctx.damage(1);
        this.ctx.breakCombo();
      }
      renderExplanationBox(
        this.explainEl,
        'Movimiento ilegal',
        check.reason ?? 'No puedes colocar un disco grande sobre uno más pequeño.',
        'bad'
      );
      this.selectedTower = null;
      this.renderBoard();
      this.updateHud();
      return;
    }

    // Valid move
    if (this.practiceMode) {
      this.history.push(cloneHanoiState(this.state));
    }
    this.state = applyMove(this.state, this.selectedTower, towerIdx);
    this.selectedTower = null;
    this.hits++;
    this.ctx.addScore(40, 1);
    synthAudio.pickup();

    renderExplanationBox(
      this.explainEl,
      `Disco ${check.disk} movido a Torre ${TOWER_NAMES[towerIdx]}`,
      `Llevas ${this.state.moves} movimiento${this.state.moves === 1 ? '' : 's'} de un óptimo de ${optimalMovesCount(this.numDisks)}.`,
      'info'
    );

    this.renderBoard();
    this.updateHud();

    if (isSolved(this.state)) {
      this.onSolved();
    }
  }

  private undo(): void {
    if (!this.practiceMode || this.history.length === 0 || this.traceActive || this.phase !== 'playing') return;
    this.state = this.history.pop()!;
    this.selectedTower = null;
    this.hintPair = null;
    this.illegalTower = null;
    synthAudio.uiClick();
    renderExplanationBox(this.explainEl, 'Movimiento deshecho', 'Se restauró el paso anterior.', 'info');
    this.renderBoard();
    this.updateHud();
  }

  private showOptimalHint(): void {
    if (!this.practiceMode || this.traceActive || this.phase !== 'playing') return;
    const hint = getOptimalNextMove(this.state);
    if (!hint) return;
    this.selectedTower = hint.from;
    this.hintPair = { from: hint.from, to: hint.to };
    this.illegalTower = null;
    synthAudio.uiClick();
    renderExplanationBox(
      this.explainEl,
      `Siguiente paso óptimo (${hint.remainingOptimal} restantes)`,
      hint.explanation,
      'info'
    );
    this.renderBoard();
  }

  private toggleTraceMode(enable: boolean): void {
    if (!this.practiceMode || this.phase !== 'playing') return;
    this.traceActive = enable;
    this.tracePlaying = false;
    this.traceAccumSec = 0;
    this.selectedTower = null;
    this.hintPair = null;
    this.illegalTower = null;
    if (enable) {
      this.traceSteps = buildRecursiveTrace(this.numDisks);
      this.traceStepIdx = 0;
      synthAudio.uiClick();
    } else {
      renderExplanationBox(
        this.explainEl,
        'De vuelta a tu tablero',
        `Continúa desde tus ${this.state.moves} movimientos.`,
        'info'
      );
    }
    this.updateControlsHint();
    this.renderBoard();
  }

  private stepTrace(delta: number): void {
    if (!this.traceActive) return;
    const next = Math.max(-1, Math.min(this.traceSteps.length - 1, this.traceStepIdx + delta));
    if (next === this.traceStepIdx) {
      this.tracePlaying = false;
      return;
    }
    this.traceStepIdx = next;
    synthAudio.uiClick();
    this.renderBoard();
  }

  private onSolved(): void {
    const opt = optimalMovesCount(this.numDisks);
    const base = 600 + this.numDisks * 200;
    const efficiency = Math.min(1, opt / Math.max(1, this.state.moves));
    const timeBonus = Math.max(0, Math.round((opt * 4 - this.elapsed) * 5));
    this.score = Math.max(200, Math.round(base * efficiency + timeBonus - this.errors * 80));

    synthAudio.puzzleSuccess(4);
    renderExplanationBox(
      this.explainEl,
      'Torre completada en C',
      `Completaste ${this.numDisks} discos en ${this.state.moves} movimientos (óptimo ${opt}).`,
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

    const activeStep =
      this.traceActive && this.traceStepIdx >= 0 ? this.traceSteps[this.traceStepIdx] : null;
    const shownState = this.traceActive
      ? activeStep
        ? activeStep.stateAfter
        : createHanoiState(this.numDisks)
      : this.state;

    const opt = optimalMovesCount(this.numDisks);

    const wrap = document.createElement('div');
    wrap.className = 'oa-hanoi-wrap';

    // Top counters
    const meta = document.createElement('div');
    meta.className = 'oa-intel-meta-row';
    meta.style.width = '100%';

    const movesChip = document.createElement('span');
    movesChip.className = `oa-intel-stat-chip${!this.traceActive && shownState.moves === opt && isSolved(shownState) ? ' is-good' : ''}`;
    movesChip.textContent = this.traceActive
      ? `Ejemplo recursivo · Paso ${this.traceStepIdx + 1} / ${this.traceSteps.length}`
      : `Movimientos: ${shownState.moves} / Óptimo: ${opt} (2^${this.numDisks}-1)`;

    const errChip = document.createElement('span');
    errChip.className = `oa-intel-stat-chip${this.errors > 0 ? ' is-danger' : ''}`;
    errChip.textContent = `Discos: ${this.numDisks} · Errores: ${this.errors}`;

    meta.append(movesChip, errChip);

    // 3 Towers
    const stage = document.createElement('div');
    stage.className = 'oa-hanoi-stage';
    stage.setAttribute('role', 'group');
    stage.setAttribute('aria-label', 'Tres torres de Hanói');

    for (let t = 0 as TowerIndex; t <= 2; t = (t + 1) as TowerIndex) {
      const towerBtn = document.createElement('button');
      towerBtn.type = 'button';
      towerBtn.className = 'oa-hanoi-tower';
      towerBtn.disabled = this.traceActive;

      let statusText = `Tecla ${t + 1}`;
      let statusCls = '';

      if (!this.traceActive) {
        if (this.selectedTower === t) {
          towerBtn.classList.add('is-selected');
          statusText = 'Origen seleccionado';
        } else if (this.selectedTower !== null) {
          const v = validateMove(this.state, this.selectedTower, t);
          if (v.valid) {
            towerBtn.classList.add('oa-mark-legal');
            statusText = 'Destino legal';
            statusCls = 'is-legal';
          } else {
            towerBtn.classList.add('oa-mark-illegal');
            const top = this.state.towers[t][this.state.towers[t].length - 1];
            const mv = this.state.towers[this.selectedTower][this.state.towers[this.selectedTower].length - 1];
            statusText = `Ilegal (${mv} > ${top})`;
            statusCls = 'is-illegal';
          }
        } else if (this.illegalTower === t) {
          towerBtn.classList.add('oa-mark-illegal');
          statusText = 'Vacía';
          statusCls = 'is-illegal';
        }

        if (this.hintPair && (this.hintPair.from === t || this.hintPair.to === t)) {
          towerBtn.classList.add('oa-mark-hint');
          statusText = this.hintPair.from === t ? 'Pista: origen' : 'Pista: destino';
        }
      } else if (activeStep) {
        if (activeStep.move.from === t || activeStep.move.to === t) {
          towerBtn.classList.add('oa-mark-hint');
          statusText = activeStep.move.from === t ? 'Salió de aquí' : 'Entró aquí';
        }
      }

      towerBtn.setAttribute(
        'aria-label',
        `Torre ${TOWER_NAMES[t]}, ${shownState.towers[t].length} discos. ${statusText}`
      );

      const poleArea = document.createElement('div');
      poleArea.className = 'oa-hanoi-pole-area';
      const pole = document.createElement('div');
      pole.className = 'oa-hanoi-pole';
      poleArea.appendChild(pole);

      const disks = shownState.towers[t];
      disks.forEach((d, idx) => {
        const diskEl = document.createElement('div');
        diskEl.className = 'oa-hanoi-disk';
        diskEl.dataset.disk = String(d);
        diskEl.textContent = String(d);
        const isTop = idx === disks.length - 1;
        if (!this.traceActive && isTop && this.selectedTower === t) {
          diskEl.classList.add('is-top-selected');
        }
        if (this.traceActive && activeStep && isTop && activeStep.move.to === t && activeStep.move.disk === d) {
          diskEl.classList.add('is-trace-moved');
        }
        poleArea.appendChild(diskEl);
      });

      const base = document.createElement('div');
      base.className = 'oa-hanoi-base';

      const foot = document.createElement('div');
      foot.className = 'oa-hanoi-tower-foot';
      const tName = document.createElement('span');
      tName.className = 'oa-hanoi-tower-name';
      tName.textContent = `Torre ${TOWER_NAMES[t]}${t === 2 ? ' (Meta)' : ''}`;
      const tStatus = document.createElement('span');
      tStatus.className = `oa-hanoi-tower-status ${statusCls}`;
      tStatus.textContent = statusText;
      foot.append(tName, tStatus);

      towerBtn.append(poleArea, base, foot);
      towerBtn.addEventListener('click', () => this.handleTowerClick(t));
      stage.appendChild(towerBtn);
    }

    wrap.append(meta, stage);
    this.stageEl.appendChild(wrap);

    this.renderSidePanels(activeStep);
  }

  private renderSidePanels(activeStep: HanoiTraceStep | null): void {
    this.actionBoxEl.innerHTML = '';
    this.traceBoxEl.innerHTML = '';

    if (this.traceActive) {
      const msg = activeStep
        ? activeStep.explanation
        : `Estado inicial con ${this.numDisks} discos en A. Avanza para ver cómo se despliega hanoi(${this.numDisks}, A→C).`;
      renderExplanationBox(
        this.explainEl,
        activeStep
          ? `Paso ${this.traceStepIdx + 1}: Disco ${activeStep.move.disk} (${TOWER_NAMES[activeStep.move.from]} → ${TOWER_NAMES[activeStep.move.to]})`
          : 'Inicio del ejemplo recursivo',
        msg,
        'info'
      );

      const ctrlRow = document.createElement('div');
      ctrlRow.className = 'oa-academy-actions';

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.disabled = this.traceStepIdx < 0;
      prevBtn.innerHTML = `${Icons.arrowLeft(16)}<span>Anterior</span>`;
      prevBtn.addEventListener('click', () => {
        this.tracePlaying = false;
        this.stepTrace(-1);
      });

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.innerHTML = `${this.tracePlaying ? Icons.pause(16) : Icons.play(16)}<span>${this.tracePlaying ? 'Pausar' : 'Reproducir'}</span>`;
      playBtn.addEventListener('click', () => {
        synthAudio.uiClick();
        if (this.traceStepIdx >= this.traceSteps.length - 1) {
          this.traceStepIdx = -1;
        }
        this.tracePlaying = !this.tracePlaying;
        this.traceAccumSec = 0;
        this.renderBoard();
      });

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.disabled = this.traceStepIdx >= this.traceSteps.length - 1;
      nextBtn.innerHTML = `<span>Siguiente</span>${Icons.arrowRight(16)}`;
      nextBtn.addEventListener('click', () => {
        this.tracePlaying = false;
        this.stepTrace(1);
      });

      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'oa-intel-primary-btn';
      backBtn.textContent = 'Volver a mi tablero';
      backBtn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.toggleTraceMode(false);
      });

      ctrlRow.append(prevBtn, playBtn, nextBtn, backBtn);
      this.actionBoxEl.appendChild(ctrlRow);

      // Call stack card
      this.traceBoxEl.style.display = 'flex';
      const stackTitle = document.createElement('span');
      stackTitle.className = 'oa-intel-label';
      stackTitle.textContent = 'Pila de llamadas recursivas';

      const stackList = document.createElement('div');
      stackList.className = 'oa-hanoi-stack-list';

      const frames = activeStep ? activeStep.callStack : [];
      if (frames.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'oa-hanoi-stack-frame';
        empty.textContent = `Listo para llamar hanoi(${this.numDisks}, A→C)`;
        stackList.appendChild(empty);
      } else {
        frames.forEach((fr, idx) => {
          const item = document.createElement('div');
          item.className = `oa-hanoi-stack-frame${idx === frames.length - 1 ? ' is-top' : ''}`;
          item.style.paddingLeft = `${8 + fr.depth * 10}px`;
          const phaseDesc =
            fr.phase === 'base'
              ? 'caso base'
              : fr.phase === 'left'
                ? `apartar ${fr.n - 1} a ${TOWER_NAMES[fr.aux]}`
                : fr.phase === 'move'
                  ? `mover disco ${fr.n}`
                  : `traer ${fr.n - 1} desde ${TOWER_NAMES[fr.aux]}`;
          item.textContent = `${fr.label} · ${phaseDesc}`;
          stackList.appendChild(item);
        });
      }

      this.traceBoxEl.append(stackTitle, stackList);
      return;
    }

    // Normal playing side actions
    const actions = document.createElement('div');
    actions.className = 'oa-academy-actions';

    if (this.practiceMode) {
      const hintBtn = document.createElement('button');
      hintBtn.type = 'button';
      hintBtn.innerHTML = `${Icons.lightbulb(16)}<span>Siguiente paso óptimo (P)</span>`;
      hintBtn.addEventListener('click', () => this.showOptimalHint());

      const undoBtn = document.createElement('button');
      undoBtn.type = 'button';
      undoBtn.disabled = this.history.length === 0;
      undoBtn.innerHTML = `${Icons.undo(16)}<span>Deshacer (U)</span>`;
      undoBtn.addEventListener('click', () => this.undo());

      const traceBtn = document.createElement('button');
      traceBtn.type = 'button';
      traceBtn.innerHTML = `${Icons.bookOpen(16)}<span>Ejemplo recursivo</span>`;
      traceBtn.addEventListener('click', () => this.toggleTraceMode(true));

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.innerHTML = `${Icons.refresh(16)}<span>Cambiar discos</span>`;
      resetBtn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.renderPrep();
      });

      actions.append(hintBtn, undoBtn, traceBtn, resetBtn);
      this.traceBoxEl.style.display = 'none';
    } else {
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.innerHTML = `${Icons.refresh(16)}<span>Reiniciar torre</span>`;
      resetBtn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.startBoard();
      });
      actions.append(resetBtn);

      this.traceBoxEl.style.display = 'flex';
      const note = document.createElement('p');
      note.className = 'oa-explain-body';
      note.textContent = 'El reproductor recursivo paso a paso y las pistas están disponibles en Práctica Guiada.';
      this.traceBoxEl.appendChild(note);
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
        this.startBoard();
      }
      return;
    }

    if (this.phase !== 'playing') return;

    if (this.traceActive) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.tracePlaying = false;
        this.stepTrace(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.tracePlaying = false;
        this.stepTrace(1);
      } else if (e.code === 'Space') {
        e.preventDefault();
        this.tracePlaying = !this.tracePlaying;
        this.traceAccumSec = 0;
        this.renderBoard();
      }
      return;
    }

    if (e.key === '1' || e.key === '2' || e.key === '3') {
      e.preventDefault();
      this.handleTowerClick((Number(e.key) - 1) as TowerIndex);
      return;
    }

    if ((e.key === 'p' || e.key === 'P') && this.practiceMode) {
      e.preventDefault();
      this.showOptimalHint();
      return;
    }

    if ((e.key === 'u' || e.key === 'U') && this.practiceMode) {
      e.preventDefault();
      this.undo();
    }
  };

  public update(dt: number, _elapsed: number): void {
    if (this.paused || this.destroyed || this.phase !== 'playing') return;

    if (this.traceActive && this.tracePlaying) {
      this.traceAccumSec += dt;
      if (this.traceAccumSec >= 1.05) {
        this.traceAccumSec = 0;
        if (this.traceStepIdx < this.traceSteps.length - 1) {
          this.stepTrace(1);
        } else {
          this.tracePlaying = false;
          this.renderBoard();
        }
      }
      return;
    }

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
    const opt = optimalMovesCount(this.numDisks);
    const moves = Math.max(1, this.state?.moves ?? opt);
    const efficiency = Math.min(1, opt / moves);
    const logicScore = survived
      ? Math.min(1000, Math.round(450 + efficiency * 430 + (this.numDisks - 3) * 40 - this.errors * 35))
      : 200;
    return {
      score: this.score,
      maxCombo: Math.max(1, this.hits),
      accuracy: Math.round((this.hits / Math.max(1, this.hits + this.errors)) * 100),
      hits: this.hits,
      misses: this.errors,
      puzzlesSolved: survived ? 1 : 0,
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
