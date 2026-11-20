import '../styles/academy-intel.css';
import { synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import { GameContext, MiniGame, RunMetrics } from '../types';
import {
  createAcademyLayout,
  createSectionTutorialEl,
  renderExplanationBox,
  SectionTutorialInfo,
} from '../ui/AcademyKit';
import {
  generateRavenPuzzle,
  renderRavenCellSvg,
  type RavenLevel,
  type RavenPuzzle,
} from './intel/ravenEngine';

type RavenChoiceMode = RavenLevel | 'progressive';

const CHALLENGE_TOTAL = 12;

export class RavenMatrix2DGame implements MiniGame {
  public readonly id = 'raven2d' as const;

  private ctx!: GameContext;
  private isGauntletSlice = false;
  private practiceMode = false;
  private infiniteMode = false;
  private paused = false;
  private destroyed = false;
  private finished = false;
  private outOfShields = false;

  private stageEl!: HTMLDivElement;
  private sideEl!: HTMLElement;
  private tutorialSlotEl!: HTMLDivElement;
  private explainEl!: HTMLDivElement;
  private actionBoxEl!: HTMLDivElement;

  private phase: 'prep' | 'playing' | 'done' = 'prep';
  private selectedMode: RavenChoiceMode = 2;
  private baseSeed = Date.now() & 0x7fffffff;

  private roundIdx = 0; // 0-based
  private puzzle!: RavenPuzzle;
  private answered = false;
  private chosenIndex: number | null = null;
  private hintShown = false;

  private matrixTimeLimit = 45;
  private matrixTimeLeft = 45;
  private roundElapsedSec = 0;
  private totalElapsed = 0;

  private score = 0;
  private hits = 0;
  private misses = 0;
  private combo = 0;
  private maxCombo = 0;
  private reactionTimesMs: number[] = [];

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.practiceMode = Boolean(ctx.practiceMode);
    this.infiniteMode = Boolean(ctx.infiniteMode && !this.isGauntletSlice && !this.practiceMode);
    this.matrixTimeLimit = ctx.difficulty === 'chill' ? 60 : 45;

    if (this.infiniteMode || ctx.difficulty === 'adaptive' || ctx.difficulty === 'progressive') {
      this.selectedMode = 'progressive';
    } else if (ctx.difficulty === 'chill') {
      this.selectedMode = 1;
    } else if (ctx.difficulty === 'hyper') {
      this.selectedMode = 3;
    } else {
      this.selectedMode = 2;
    }

    const layout = createAcademyLayout(
      ctx.container,
      'MATRICES LÓGICAS',
      this.practiceMode ? 'PRÁCTICA' : this.infiniteMode ? 'INFINITO' : 'RETO 12'
    );
    this.stageEl = layout.stageEl;
    this.sideEl = layout.sideEl;

    this.tutorialSlotEl = document.createElement('div');
    this.explainEl = document.createElement('div');
    this.actionBoxEl = document.createElement('div');
    this.actionBoxEl.className = 'oa-academy-card';
    this.sideEl.append(this.tutorialSlotEl, this.explainEl, this.actionBoxEl);

    window.addEventListener('keydown', this.onKeyDown);

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: 'MATRICES LÓGICAS',
      accent: '#4338CA',
      timeLeftSec: null,
      subStat: 'PREPARACIÓN',
    });

    this.renderPrep();
  }

  private updateControlsHint(): void {
    if (!this.ctx.setControls) return;
    if (this.phase === 'prep') {
      this.ctx.setControls([
        { keys: ['Clic', 'Enter'], touch: 'Toca Empezar', action: 'Comenzar serie', tone: 'primary' },
      ]);
      return;
    }
    if (this.answered) {
      this.ctx.setControls([
        { keys: ['Enter', 'Espacio'], touch: 'Toca Siguiente', action: 'Siguiente matriz', tone: 'primary' },
      ]);
      return;
    }
    const maxOpt = this.puzzle ? this.puzzle.options.length : 8;
    const hints = [
      { keys: [`1–${maxOpt}`, 'Clic'], touch: 'Toca una opción', action: 'Elegir respuesta', tone: 'primary' as const },
    ];
    if (this.practiceMode) {
      hints.push({ keys: ['P'], touch: 'Botón Pista', action: 'Pista razonada', tone: 'primary' as const });
    }
    this.ctx.setControls(hints);
  }

  private updateSectionTutorial(): void {
    let info: SectionTutorialInfo;
    if (this.phase === 'prep') {
      info = {
        id: 'raven:prep',
        sectionName: 'Preparar Matrices Lógicas',
        steps: [
          'Selecciona un nivel fijo (1 a 4) o Progresivo para ir desbloqueando reglas más complejas.',
          'Cada matriz 3×3 tiene exactamente una opción válida entre 6 u 8 candidatas.',
          'Responde con clic o las teclas numéricas y analiza la explicación regla por regla.',
        ],
        tip: 'El Nivel 4 introduce superposición XOR: las figuras presentes en dos celdas de la fila se cancelan en la tercera.',
      };
    } else if (this.puzzle.level === 4) {
      info = {
        id: 'raven:xor',
        sectionName: 'Modo Matriz Nivel 4 (XOR)',
        steps: [
          'Superpone visualmente la celda 1 y la celda 2 de cada fila como si fueran transparencias.',
          'Los trazos o puntos que aparecen en ambas celdas se anulan; los que aparecen solo en una sobreviven en la celda 3.',
          'Confirma tu deducción revisando también las columnas de arriba abajo.',
        ],
        tip: 'Aplica la regla XOR elemento por elemento (por ejemplo esquina por esquina) en vez de intentar verlo todo a la vez.',
      };
    } else {
      info = {
        id: `raven:lvl${this.puzzle.level}`,
        sectionName: `Modo Matriz Nivel ${this.puzzle.level}`,
        steps: [
          'Descompón la figura en atributos independientes: forma, cantidad, rotación, tamaño y relleno.',
          'Comprueba primero la progresión horizontal en filas 1 y 2; luego verifica que coincida en columnas.',
          'Descarta las opciones que incumplan incluso un solo atributo para llegar con certeza a la solución.',
        ],
        tip: 'En niveles 2 y 3 se combinan dos o tres reglas simultáneas: resuelve un atributo a la vez.',
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
    h.textContent = 'Configura tu serie de Matrices';

    const p = document.createElement('p');
    p.className = 'oa-intel-prep-sub';
    p.textContent = this.practiceMode
      ? 'En Práctica Guiada tienes pistas razonadas ilimitadas, explicaciones detalladas y cambio libre de nivel.'
      : this.infiniteMode
      ? 'Modo Infinito: sin límite de matrices ni reloj por matriz. Escala niveles 1→4 de forma continua y cada fallo resta 1 escudo hasta quedar en 0 o pulsar Finalizar y puntuar.'
      : `Modo Reto: ${CHALLENGE_TOTAL} matrices con ${this.matrixTimeLimit} s por matriz. Solo una opción cumple todas las reglas.`;

    const group = document.createElement('div');
    group.className = 'oa-intel-group';
    const lbl = document.createElement('span');
    lbl.className = 'oa-intel-label';
    lbl.textContent = 'Nivel de reglas';
    const pills = document.createElement('div');
    pills.className = 'oa-intel-pills';

    const modes: { id: RavenChoiceMode; label: string }[] = [
      { id: 1, label: 'Nivel 1 · Básico (1 regla)' },
      { id: 2, label: 'Nivel 2 · Medio (2 reglas)' },
      { id: 3, label: 'Nivel 3 · Avanzado (3 reglas)' },
      { id: 4, label: 'Nivel 4 · Experto (XOR)' },
      { id: 'progressive', label: 'Progresivo (1 a 4)' },
    ];

    const renderPills = () => {
      pills.innerHTML = '';
      for (const m of modes) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'oa-intel-pill';
        btn.textContent = m.label;
        btn.setAttribute('aria-pressed', this.selectedMode === m.id ? 'true' : 'false');
        btn.addEventListener('click', () => {
          synthAudio.uiClick();
          this.selectedMode = m.id;
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
      this.startSession();
    });

    prep.append(h, p, group, startBtn);
    this.stageEl.appendChild(prep);

    renderExplanationBox(
      this.explainEl,
      'Cómo leer una matriz 3x3',
      'Analiza primero qué cambia de izquierda a derecha en cada fila (cantidad, forma, tamaño, relleno o rotación). Luego confirma el patrón de arriba abajo en las columnas.',
      'info'
    );
    this.actionBoxEl.innerHTML = '';
  }

  private levelForRound(roundIdx: number): RavenLevel {
    if (this.selectedMode !== 'progressive') {
      if (this.infiniteMode || this.ctx.difficulty === 'progressive') {
        const escalated = Math.min(4, this.selectedMode + Math.floor(roundIdx / 3));
        return escalated as RavenLevel;
      }
      return this.selectedMode;
    }
    if (roundIdx < 3) return 1;
    if (roundIdx < 6) return 2;
    if (roundIdx < 9) return 3;
    if (this.infiniteMode) {
      return (roundIdx - 9) % 4 === 3 ? 3 : 4;
    }
    return 4;
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
    this.outOfShields = false;
    this.loadNextPuzzle();
  }

  private loadNextPuzzle(): void {
    const level = this.levelForRound(this.roundIdx);
    const seed = (this.baseSeed + this.roundIdx * 7919 + level * 131) >>> 0;
    this.puzzle = generateRavenPuzzle(level, seed);
    this.answered = false;
    this.chosenIndex = null;
    this.hintShown = false;
    this.matrixTimeLeft = this.matrixTimeLimit;
    this.roundElapsedSec = 0;

    this.updateSectionTutorial();
    this.updateControlsHint();
    this.renderBoard();
    this.updateHud();
  }

  private updateHud(): void {
    const progressLabel = this.practiceMode
      ? `PRÁCTICA · MATRIZ ${this.roundIdx + 1}`
      : this.infiniteMode
      ? `INFINITO · MATRIZ ${this.roundIdx + 1}`
      : `MATRIZ ${this.roundIdx + 1}/${CHALLENGE_TOTAL}`;
    this.ctx.setHud({
      timeLeftSec:
        this.practiceMode || this.infiniteMode || this.phase !== 'playing'
          ? null
          : Math.ceil(this.matrixTimeLeft),
      subStat: `${progressLabel} · ACIERTOS ${this.hits}`,
    });
  }

  private renderBoard(): void {
    this.stageEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'oa-raven-wrap';

    // Top meta chips
    const meta = document.createElement('div');
    meta.className = 'oa-intel-meta-row';
    meta.style.width = '100%';

    const chipLevel = document.createElement('span');
    chipLevel.className = 'oa-intel-stat-chip';
    chipLevel.textContent =
      this.puzzle.level === 4
        ? 'Nivel 4 · Superposición XOR'
        : `Nivel ${this.puzzle.level} · ${this.puzzle.options.length} opciones`;

    const chipProg = document.createElement('span');
    chipProg.className = 'oa-intel-stat-chip';
    chipProg.textContent =
      this.practiceMode || this.infiniteMode
        ? `Matriz ${this.roundIdx + 1} · Aciertos ${this.hits}`
        : `Matriz ${this.roundIdx + 1} / ${CHALLENGE_TOTAL} · Aciertos ${this.hits}`;

    meta.append(chipLevel, chipProg);

    // 3x3 Matrix
    const matrixEl = document.createElement('div');
    matrixEl.className = 'oa-raven-matrix';
    matrixEl.setAttribute('role', 'grid');
    matrixEl.setAttribute('aria-label', 'Matriz lógica 3 por 3');

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cellEl = document.createElement('div');
        cellEl.className = 'oa-raven-cell';
        if ((this.hintShown || this.answered) && r === 2) {
          cellEl.classList.add('is-row-focus');
        }
        const cellData = this.puzzle.matrix[r][c];
        if (cellData) {
          cellEl.innerHTML = renderRavenCellSvg(cellData, `m_${this.roundIdx}_${r}_${c}`);
        } else if (this.answered) {
          const isGood = this.chosenIndex === this.puzzle.correctIndex;
          cellEl.classList.add(isGood ? 'is-answered-good' : 'is-answered-bad');
          cellEl.innerHTML = renderRavenCellSvg(
            this.puzzle.solution,
            `sol_${this.roundIdx}`
          );
        } else {
          cellEl.classList.add('is-target');
          cellEl.textContent = '?';
          cellEl.setAttribute('aria-label', 'Casilla faltante en fila 3 columna 3');
        }
        matrixEl.appendChild(cellEl);
      }
    }

    // Options grid
    const optsEl = document.createElement('div');
    optsEl.className = `oa-raven-options${this.puzzle.options.length === 6 ? ' is-six' : ''}`;
    optsEl.setAttribute('role', 'group');
    optsEl.setAttribute('aria-label', 'Opciones de respuesta');

    this.puzzle.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-raven-opt';
      btn.disabled = this.answered;
      btn.setAttribute('aria-label', `Opción ${idx + 1}`);

      if (this.answered) {
        if (idx === this.puzzle.correctIndex) {
          btn.classList.add('is-correct');
        } else if (idx === this.chosenIndex) {
          btn.classList.add('is-wrong');
        }
      }

      const numSpan = document.createElement('span');
      numSpan.className = 'oa-raven-opt-num';
      numSpan.textContent = String(idx + 1);

      const svgHolder = document.createElement('div');
      svgHolder.style.width = '100%';
      svgHolder.style.height = '100%';
      svgHolder.innerHTML = renderRavenCellSvg(opt, `opt_${this.roundIdx}_${idx}`);

      btn.append(numSpan, svgHolder);
      btn.addEventListener('click', () => this.selectOption(idx));
      optsEl.appendChild(btn);
    });

    wrap.append(meta, matrixEl, optsEl);
    this.stageEl.appendChild(wrap);

    this.renderSidePanel();
  }

  private renderSidePanel(): void {
    if (!this.answered) {
      if (this.hintShown) {
        renderExplanationBox(this.explainEl, 'Pista razonada', this.puzzle.hint, 'info');
      } else {
        renderExplanationBox(
          this.explainEl,
          'Encuentra la pieza faltante',
          'Observa cómo cambian las figuras en cada fila y columna para deducir la casilla inferior derecha.',
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
      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'oa-intel-primary-btn';
      const isLastChallenge =
        !this.practiceMode && !this.infiniteMode && this.roundIdx + 1 >= CHALLENGE_TOTAL;
      nextBtn.innerHTML = `<span>${isLastChallenge ? 'Ver resultado final' : 'Siguiente matriz'}</span>${Icons.arrowRight(16)}`;
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
      ([1, 2, 3, 4] as RavenLevel[]).forEach((lv) => {
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
    this.renderBoard();
  }

  private selectOption(idx: number): void {
    if (this.answered || this.phase !== 'playing') return;
    this.answered = true;
    this.chosenIndex = idx;

    const usedMs =
      this.practiceMode || this.infiniteMode
        ? Math.max(200, Math.round(this.roundElapsedSec * 1000))
        : Math.max(200, Math.round((this.matrixTimeLimit - this.matrixTimeLeft) * 1000));
    this.reactionTimesMs.push(usedMs);

    const correct = idx === this.puzzle.correctIndex;
    if (correct) {
      this.hits++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const timeBonus = this.practiceMode
        ? 0
        : this.infiniteMode
        ? Math.max(0, Math.round((30 - this.roundElapsedSec) * 4))
        : Math.round(this.matrixTimeLeft * 4);
      const levelBonus = this.puzzle.level * 50;
      const pts = 150 + levelBonus + timeBonus;
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
      renderExplanationBox(
        this.explainEl,
        `Incorrecto · La respuesta era la opción ${this.puzzle.correctIndex + 1}`,
        this.puzzle.explanation,
        'bad'
      );
      if (!this.practiceMode) {
        const left = this.ctx.damage(1);
        if (left <= 0) {
          this.outOfShields = true;
          this.updateControlsHint();
          this.renderBoard();
          this.updateHud();
          this.finishRun(false);
          return;
        }
      }
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
    this.reactionTimesMs.push(this.matrixTimeLimit * 1000);
    synthAudio.damage();

    renderExplanationBox(
      this.explainEl,
      `Tiempo agotado · Opción correcta: ${this.puzzle.correctIndex + 1}`,
      this.puzzle.explanation,
      'warn'
    );
    const left = this.ctx.damage(1);
    this.updateSectionTutorial();
    this.updateControlsHint();
    this.renderBoard();
    this.updateHud();
    if (left <= 0) {
      this.outOfShields = true;
      this.finishRun(false);
    }
  }

  private advanceRound(): void {
    if (this.phase !== 'playing') return;
    synthAudio.uiClick();
    if (!this.practiceMode && !this.infiniteMode && this.roundIdx + 1 >= CHALLENGE_TOTAL) {
      this.finishRun();
      return;
    }
    this.roundIdx++;
    this.loadNextPuzzle();
  }

  private finishRun(survivedOverride?: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.phase = 'done';
    this.ctx.finish(this.getMetrics(survivedOverride));
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
    if (!this.answered) {
      this.roundElapsedSec += dt;
    }

    if (!this.practiceMode && !this.infiniteMode && !this.answered) {
      const prevSec = Math.ceil(this.matrixTimeLeft);
      this.matrixTimeLeft = Math.max(0, this.matrixTimeLeft - dt);
      const nextSec = Math.ceil(this.matrixTimeLeft);
      if (nextSec !== prevSec) {
        this.ctx.setHud({ timeLeftSec: nextSec });
      }
      if (this.matrixTimeLeft <= 0) {
        this.handleTimeout();
      }
    }

    if (this.isGauntletSlice && this.totalElapsed >= 15 && !this.finished) {
      this.finishRun();
    }
  }

  public onResize(): void {
    // Responsive CSS handles resize cleanly
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getMetrics(
    survivedOverride?: boolean
  ): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const answeredCount = this.hits + this.misses;
    const accuracy = answeredCount > 0 ? Math.round((this.hits / answeredCount) * 100) : 0;
    const avgReactionMs =
      this.reactionTimesMs.length > 0
        ? Math.round(this.reactionTimesMs.reduce((a, b) => a + b, 0) / this.reactionTimesMs.length)
        : undefined;
    const logicScore =
      answeredCount === 0
        ? 140
        : this.infiniteMode
        ? Math.max(
            140,
            Math.min(1000, Math.round(180 + this.hits * 48 + accuracy * 2.2 - this.misses * 25))
          )
        : Math.min(1000, Math.round(250 + (this.hits / CHALLENGE_TOTAL) * 700));
    const survived =
      survivedOverride !== undefined
        ? survivedOverride
        : this.infiniteMode
        ? !this.outOfShields
        : !this.outOfShields && (this.hits >= Math.ceil(CHALLENGE_TOTAL / 2) || this.practiceMode);
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
        logic: logicScore,
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
