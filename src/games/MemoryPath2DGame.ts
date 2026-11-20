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
  evaluateMemoryRecall,
  generateInterferenceTask,
  generateMemoryRound,
  getSymbolWord,
  mulberry32,
  renderMemorySymbolSvg,
  type InterferenceTask,
  type MemoryLevel,
  type MemoryRecallEvaluation,
  type MemoryRound,
  type MemorySubmission,
  type MemorySymbolId,
} from './intel/memoryPathEngine';

type MemoryStartChoice = 3 | 4 | 5 | 6 | 'progressive';
type SubPhase = 'encode' | 'interference' | 'recall' | 'review';

const CHALLENGE_TOTAL = 8;

export class MemoryPath2DGame implements MiniGame {
  public readonly id = 'memorypath2d' as const;

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
  private subPhase: SubPhase = 'encode';
  private selectedStart: MemoryStartChoice = 'progressive';
  private baseSeed = (Date.now() ^ 0x8d52c3) & 0x7fffffff;

  private roundIdx = 0;
  private round!: MemoryRound;
  private interferenceTask: InterferenceTask | null = null;
  private encodeTimeLeft = 12;
  private totalElapsed = 0;

  // Recall state
  private paletteSymbols: MemorySymbolId[] = [];
  private activeSymbol: MemorySymbolId | null = null;
  private placements = new Map<number, MemorySymbolId>(); // cellIndex -> symbolId
  private evaluation: MemoryRecallEvaluation | null = null;
  private mnemonicShown = false;

  private score = 0;
  private hits = 0;
  private misses = 0;
  private combo = 0;
  private maxCombo = 0;
  private accuracySum = 0;
  private roundsCompleted = 0;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.practiceMode = Boolean(ctx.practiceMode);
    this.infiniteMode = Boolean(ctx.infiniteMode) && !this.practiceMode && !this.isGauntletSlice;

    if (this.infiniteMode || ctx.difficulty === 'progressive' || ctx.difficulty === 'adaptive') {
      this.selectedStart = 'progressive';
    } else if (ctx.difficulty === 'chill') {
      this.selectedStart = 3;
    } else if (ctx.difficulty === 'hyper') {
      this.selectedStart = 5;
    } else {
      this.selectedStart = 4;
    }

    const badge = this.practiceMode
      ? 'PRÁCTICA'
      : this.infiniteMode
        ? renderDifficultyBadge(ctx.difficulty, true)
        : `RETO ${CHALLENGE_TOTAL}`;

    const layout = createAcademyLayout(ctx.container, 'PALACIO MENTAL', badge);
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
      phaseLabel: 'PALACIO MENTAL',
      accent: '#059669',
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
        { keys: ['Clic', 'Enter'], touch: 'Toca Empezar', action: 'Abrir palacio mental', tone: 'primary' },
      ]);
      return;
    }
    if (this.subPhase === 'encode') {
      this.ctx.setControls([
        { keys: ['Espacio', 'Enter'], touch: 'Toca Ya lo memoricé', action: 'Pasar a evocación', tone: 'primary' },
      ]);
      return;
    }
    if (this.subPhase === 'interference') {
      this.ctx.setControls([
        { keys: ['1–4', 'Clic'], touch: 'Toca respuesta', action: 'Superar interferencia', tone: 'primary' },
      ]);
      return;
    }
    if (this.subPhase === 'recall') {
      this.ctx.setControls([
        { keys: ['Clic'], touch: 'Toca símbolo y casilla', action: 'Colocar asociación', tone: 'primary' },
        { keys: ['Enter'], touch: 'Comprobar recuerdo', action: 'Validar palacio' },
      ]);
      return;
    }
    this.ctx.setControls([
      { keys: ['Enter', 'Espacio'], touch: 'Toca Siguiente', action: 'Siguiente palacio', tone: 'primary' },
    ]);
  }

  private updateSectionTutorial(): void {
    let info: SectionTutorialInfo;
    if (this.phase === 'prep') {
      info = {
        id: 'memorypath:prep',
        sectionName: 'Preparar Palacio Mental (Loci)',
        steps: [
          'Elige cuántos símbolos codificar al inicio (3 a 6) o modo Progresivo (escala hasta 10 estancias).',
          'Cada ronda consta de 3 fases: Codificación espacial, Interferencia activa y Evocación en mapa vacío.',
          'En Práctica puedes desplegar la historia mnemotécnica sugerida para entrenar el Método de Loci.',
        ],
        tip: 'Imagina cada símbolo interactuando de forma exagerada con el mobiliario de su sala para fijarlo en memoria episódica.',
      };
    } else if (this.subPhase === 'encode') {
      info = {
        id: 'memorypath:encode',
        sectionName: 'Fase 1 · Codificación Espacial',
        steps: [
          'Recorre las salas iluminadas en orden y asocia cada símbolo con el nombre y posición de su estancia.',
          'Crea una micro-historia visual que conecte los objetos entre sí siguiendo una ruta por el plano.',
          'Pulsa "Ya lo memoricé" (Espacio o Enter) cuando estés listo para pasar a la fase siguiente.',
        ],
        tip: 'En Práctica pulsa "Ver historia Loci" en el panel derecho para leer una asociación mnemotécnica lista.',
      };
    } else if (this.subPhase === 'interference') {
      info = {
        id: 'memorypath:interference',
        sectionName: 'Fase 2 · Interferencia Cognitiva',
        steps: [
          'Resuelve el reto rápido (aritmética o color Stroop) con clic o teclas 1–4.',
          'Esta tarea limpia el bucle fonológico de corto plazo y obliga a recuperar la huella espacial real.',
          'Responde con precisión antes de pasar a reconstruir el palacio.',
        ],
        tip: 'En retos Stroop, fíjate en lo que pide la pregunta (color de la tinta vs palabra escrita).',
      };
    } else if (this.subPhase === 'recall') {
      info = {
        id: 'memorypath:recall',
        sectionName: 'Fase 3 · Evocación en el Palacio',
        steps: [
          'Selecciona un símbolo de la paleta inferior y haz clic en la sala del plano donde estaba.',
          'Al colocar un símbolo, el selector avanza automáticamente al siguiente libre para que reconstruyas rápido.',
          'Cuando ubiques todos los símbolos, pulsa "Comprobar recuerdo" (Enter).',
        ],
        tip: 'Si dudas de una sala, haz clic sobre una sala ya ocupada para reemplazar o corregir su símbolo.',
      };
    } else {
      info = {
        id: 'memorypath:review',
        sectionName: 'Fase 4 · Revisión del Recuerdo',
        steps: [
          'Revisa en verde los aciertos exactos y en ámbar/rojo las estancias intercambiadas.',
          'Observa la ruta Loci completa en la explicación lateral para reforzar los vínculos que fallaron.',
          'Pulsa Siguiente (Enter o Espacio) para avanzar al próximo palacio.',
        ],
        tip: 'Los errores por intercambio de sala cercana se corrigen anclando cada objeto a un rasgo único de la habitación.',
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
    h.textContent = 'Configura tu Palacio Mental';

    const p = document.createElement('p');
    p.className = 'oa-intel-prep-sub';
    if (this.practiceMode) {
      p.textContent =
        'Codifica símbolos en ubicaciones espaciales sin prisa, consulta rutas mnemotécnicas (Método de Loci) y reconstruye el mapa tras la interferencia.';
    } else if (this.infiniteMode) {
      p.textContent =
        'Modo Infinito Progresivo: escala de 3 hasta 10 estancias con prueba de interferencia cognitiva (cálculo o Stroop). Cada ronda fallida cuesta 1 escudo.';
    } else {
      p.textContent =
        `Modo Reto: ${CHALLENGE_TOTAL} rondas escalando complejidad e interferencia. Fallar la interferencia o el recuerdo cuesta 1 escudo.`;
    }

    const group = document.createElement('div');
    group.className = 'oa-intel-group';
    const lbl = document.createElement('span');
    lbl.className = 'oa-intel-label';
    lbl.textContent = 'Carga inicial de símbolos';
    const pills = document.createElement('div');
    pills.className = 'oa-intel-pills';

    const opts: { id: MemoryStartChoice; label: string }[] = [
      { id: 3, label: '3 símbolos (3×3)' },
      { id: 4, label: '4 símbolos (3×3)' },
      { id: 5, label: '5 símbolos (4×4)' },
      { id: 6, label: '6 símbolos (4×4)' },
      { id: 'progressive', label: 'Progresivo (3 a 10)' },
    ];

    const renderPills = () => {
      pills.innerHTML = '';
      for (const o of opts) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'oa-intel-pill';
        b.textContent = o.label;
        b.setAttribute('aria-pressed', this.selectedStart === o.id ? 'true' : 'false');
        b.addEventListener('click', () => {
          synthAudio.uiClick();
          this.selectedStart = o.id;
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
    startBtn.innerHTML = `${Icons.play(17)}<span>Iniciar palacio mental</span>`;
    startBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.startSession();
    });

    prep.append(h, p, group, startBtn);
    this.stageEl.appendChild(prep);

    renderExplanationBox(
      this.explainEl,
      'Método de Loci e interferencia',
      '1) Codifica cada objeto en su sala creando una historia visual. 2) Supera una breve tarea de interferencia para evitar el eco mecánico. 3) Reconstruye el mapa.',
      'info'
    );
    this.actionBoxEl.innerHTML = '';
  }

  private paramsForRound(roundIdx: number): { count: number; level: MemoryLevel } {
    if (this.selectedStart !== 'progressive') {
      const count = this.infiniteMode
        ? Math.min(10, this.selectedStart + Math.floor(roundIdx / 2))
        : Math.min(9, this.selectedStart + Math.floor(roundIdx / 3));
      const level = Math.min(4, Math.max(1, Math.ceil((count - 1) / 2))) as MemoryLevel;
      return { count, level };
    }
    const boost = this.ctx.getIntensity() >= 1.32 ? 1 : 0;
    const maxCap = this.infiniteMode ? 10 : 8;
    const count = Math.min(maxCap, 3 + roundIdx + boost);
    const level = Math.min(4, Math.max(1, Math.ceil((count - 1) / 2))) as MemoryLevel;
    return { count, level };
  }

  private startSession(): void {
    this.phase = 'playing';
    this.roundIdx = 0;
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.accuracySum = 0;
    this.roundsCompleted = 0;
    this.finished = false;
    this.loadNextRound();
  }

  private loadNextRound(): void {
    const { count, level } = this.paramsForRound(this.roundIdx);
    const seed = (this.baseSeed + this.roundIdx * 5113 + count * 137) >>> 0;
    this.round = generateMemoryRound(count, level, seed);
    this.subPhase = 'encode';
    this.encodeTimeLeft = this.round.encodeTimeSec;
    this.interferenceTask = this.round.needsInterference
      ? generateInterferenceTask(level, seed)
      : null;
    this.placements.clear();
    this.evaluation = null;
    this.mnemonicShown = false;

    // Barajar paleta para que el orden visual no revele el orden de codificacion
    const rng = mulberry32(seed ^ 0x12345);
    const syms = this.round.items.map((it) => it.symbolId);
    for (let i = syms.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [syms[i], syms[j]] = [syms[j], syms[i]];
    }
    this.paletteSymbols = syms;
    this.activeSymbol = this.paletteSymbols[0] ?? null;

    renderExplanationBox(
      this.explainEl,
      `Fase 1: Codifica ${this.round.count} estancias`,
      'Asocia cada símbolo con su posición espacial. Cuando los tengas claros, pulsa Ya lo memoricé (Espacio).',
      'info'
    );

    this.updateControlsHint();
    this.renderBoard();
    this.updateHud();
  }

  private updateHud(): void {
    const phaseName =
      this.subPhase === 'encode'
        ? 'CODIFICAR'
        : this.subPhase === 'interference'
          ? 'INTERFERENCIA'
          : this.subPhase === 'recall'
            ? 'EVOCAR'
            : 'REVISIÓN';
    const progress = this.practiceMode
      ? `PRÁCTICA · RONDA ${this.roundIdx + 1}`
      : this.infiniteMode
        ? `INFINITO · RONDA ${this.roundIdx + 1}`
        : `RONDA ${this.roundIdx + 1}/${CHALLENGE_TOTAL}`;
    const showTimer =
      !this.practiceMode && !this.infiniteMode && this.phase === 'playing' && this.subPhase === 'encode';

    this.ctx.setHud({
      timeLeftSec: showTimer ? Math.ceil(this.encodeTimeLeft) : null,
      subStat: `${progress} · ${phaseName} · ${this.round.count} PARES`,
    });
  }

  private finishEncodingPhase(): void {
    if (this.phase !== 'playing' || this.subPhase !== 'encode') return;
    synthAudio.uiClick();

    if (this.round.needsInterference && this.interferenceTask) {
      this.subPhase = 'interference';
      renderExplanationBox(
        this.explainEl,
        'Fase 2: Control de interferencia',
        'Resuelve esta pregunta rápida para entrenar retención real sin repetición mecánica.',
        'info'
      );
    } else {
      this.subPhase = 'recall';
      renderExplanationBox(
        this.explainEl,
        'Fase 3: Evoca las posiciones',
        'Elige un símbolo de la paleta inferior y toca la estancia del mapa donde estaba guardado.',
        'info'
      );
    }
    this.updateControlsHint();
    this.renderBoard();
    this.updateHud();
  }

  private answerInterference(idx: number): void {
    if (this.phase !== 'playing' || this.subPhase !== 'interference' || !this.interferenceTask) return;
    const correct = idx === this.interferenceTask.correctIndex;
    if (correct) {
      this.score += 50;
      this.ctx.addScore(50, 0);
      synthAudio.pickup();
      renderExplanationBox(
        this.explainEl,
        'Interferencia superada · Fase 3: Evoca',
        'Ahora reconstruye en el mapa dónde iba cada símbolo.',
        'good'
      );
    } else {
      this.combo = 0;
      this.ctx.breakCombo();
      synthAudio.damage();
      if (!this.practiceMode) {
        const remShields = this.ctx.damage(1);
        if (remShields <= 0) {
          renderExplanationBox(
            this.explainEl,
            'Interferencia fallida · Sin escudos',
            this.interferenceTask.explanation,
            'bad'
          );
          this.updateHud();
          this.finishRun(false);
          return;
        }
      }
      renderExplanationBox(
        this.explainEl,
        'Interferencia fallida · Continúa a evocación',
        `${this.interferenceTask.explanation} Ahora reconstruye el palacio mental.`,
        'warn'
      );
    }

    this.subPhase = 'recall';
    this.updateControlsHint();
    this.renderBoard();
    this.updateHud();
  }

  private selectNextUnplacedSymbol(): void {
    const used = new Set(this.placements.values());
    const next = this.paletteSymbols.find((s) => !used.has(s)) ?? null;
    this.activeSymbol = next;
  }

  private handleCellClick(cellIndex: number): void {
    if (this.phase !== 'playing' || this.subPhase !== 'recall') return;

    const existing = this.placements.get(cellIndex);
    if (existing) {
      // Devolver a la paleta y dejarlo seleccionado para reubicar rapido
      this.placements.delete(cellIndex);
      this.activeSymbol = existing;
      synthAudio.uiClick();
      this.renderBoard();
      return;
    }

    if (!this.activeSymbol) {
      this.selectNextUnplacedSymbol();
      if (!this.activeSymbol) return;
    }

    // Si ese simbolo estaba en otra celda, moverlo a la nueva
    for (const [k, v] of this.placements.entries()) {
      if (v === this.activeSymbol) {
        this.placements.delete(k);
        break;
      }
    }

    this.placements.set(cellIndex, this.activeSymbol);
    synthAudio.uiClick();
    this.selectNextUnplacedSymbol();
    this.renderBoard();
  }

  private submitRecall(): void {
    if (this.phase !== 'playing' || this.subPhase !== 'recall') return;

    const submissions: MemorySubmission[] = Array.from(this.placements.entries()).map(
      ([cellIndex, symbolId]) => ({ cellIndex, symbolId })
    );
    const evalResult = evaluateMemoryRecall(this.round.items, submissions);
    this.evaluation = evalResult;
    this.subPhase = 'review';
    this.roundsCompleted++;
    this.accuracySum += evalResult.accuracy;

    if (evalResult.allCorrect) {
      this.hits++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const pts = 180 + this.round.count * 45;
      this.score += pts;
      this.ctx.addScore(pts, 1);
      synthAudio.puzzleSuccess(this.combo);
      renderExplanationBox(this.explainEl, 'Palacio perfecto', evalResult.summary, 'good');
    } else {
      this.misses++;
      this.combo = 0;
      this.ctx.breakCombo();
      synthAudio.damage();

      const partialPts = evalResult.exactMatches * 25;
      if (partialPts > 0) {
        this.score += partialPts;
        this.ctx.addScore(partialPts, 0);
      }

      const detailNote = evalResult.details
        .filter((d) => d.status !== 'correct')
        .slice(0, 2)
        .map((d) => d.detail)
        .join(' ');
      const msg = `${evalResult.summary} ${detailNote}`.trim();

      if (!this.practiceMode) {
        const remShields = this.ctx.damage(1);
        renderExplanationBox(this.explainEl, 'Recuerdo incompleto', msg, 'bad');
        if (remShields <= 0) {
          this.updateControlsHint();
          this.renderBoard();
          this.updateHud();
          this.finishRun(false);
          return;
        }
      } else {
        renderExplanationBox(this.explainEl, 'Revisión del recuerdo', msg, 'warn');
      }
    }

    this.updateControlsHint();
    this.renderBoard();
    this.updateHud();
  }

  private advanceRound(): void {
    if (this.phase !== 'playing' || this.subPhase !== 'review') return;
    synthAudio.uiClick();
    if (!this.practiceMode && !this.infiniteMode && this.roundIdx + 1 >= CHALLENGE_TOTAL) {
      this.finishRun(true);
      return;
    }
    this.roundIdx++;
    this.loadNextRound();
  }

  private renderBoard(): void {
    this.updateSectionTutorial();
    this.stageEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'oa-mem-wrap';

    // Meta row
    const meta = document.createElement('div');
    meta.className = 'oa-intel-meta-row';
    meta.style.width = '100%';

    const chipInfo = document.createElement('span');
    chipInfo.className = 'oa-intel-stat-chip';
    chipInfo.textContent = `${this.round.cols}×${this.round.rows} estancias · ${this.round.count} símbolos`;

    const chipProg = document.createElement('span');
    chipProg.className = 'oa-intel-stat-chip';
    if (this.subPhase === 'review' && this.evaluation) {
      chipProg.classList.add(this.evaluation.allCorrect ? 'is-good' : 'is-danger');
      chipProg.textContent = `Precisión ${this.evaluation.exactMatches}/${this.evaluation.total} (${this.evaluation.accuracy}%)`;
    } else {
      chipProg.textContent = this.practiceMode
        ? `Ronda ${this.roundIdx + 1} · Perfectas ${this.hits}`
        : this.infiniteMode
          ? `Infinito · Ronda ${this.roundIdx + 1} · Aciertos ${this.hits}`
          : `Ronda ${this.roundIdx + 1} / ${CHALLENGE_TOTAL} · Aciertos ${this.hits}`;
    }

    meta.append(chipInfo, chipProg);
    wrap.appendChild(meta);

    if (this.subPhase === 'interference' && this.interferenceTask) {
      const card = document.createElement('div');
      card.className = 'oa-logic-card';
      card.style.width = '100%';

      const pill = document.createElement('span');
      pill.className = 'oa-logic-cat-pill';
      pill.textContent =
        this.interferenceTask.kind === 'stroop' ? 'Interferencia Stroop' : 'Interferencia aritmética';

      const prompt = document.createElement('p');
      prompt.className = 'oa-logic-prompt';
      prompt.textContent = this.interferenceTask.prompt;
      card.append(pill, prompt);

      if (this.interferenceTask.kind === 'stroop' && this.interferenceTask.stroopWord) {
        const wordEl = document.createElement('div');
        wordEl.className = 'oa-mem-stroop-word';
        wordEl.textContent = this.interferenceTask.stroopWord;
        wordEl.style.color = this.interferenceTask.stroopHex ?? 'var(--ink-primary)';
        card.appendChild(wordEl);
      }

      const optsEl = document.createElement('div');
      optsEl.className = 'oa-logic-options';
      this.interferenceTask.options.forEach((optText, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'oa-logic-opt';

        const num = document.createElement('span');
        num.className = 'oa-logic-opt-num';
        num.textContent = String(idx + 1);

        const lbl = document.createElement('span');
        lbl.textContent = optText;

        btn.append(num, lbl);
        btn.addEventListener('click', () => this.answerInterference(idx));
        optsEl.appendChild(btn);
      });

      card.appendChild(optsEl);
      wrap.appendChild(card);
      this.stageEl.appendChild(wrap);
      this.renderSideActions();
      return;
    }

    // Palace grid (encode / recall / review)
    const grid = document.createElement('div');
    grid.className = 'oa-mem-grid';
    grid.style.gridTemplateColumns = `repeat(${this.round.cols}, minmax(0, 1fr))`;
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', 'Mapa del Palacio Mental');

    const totalCells = this.round.cols * this.round.rows;
    const itemByCell = new Map(this.round.items.map((it) => [it.cellIndex, it]));

    for (let idx = 0; idx < totalCells; idx++) {
      const r = Math.floor(idx / this.round.cols);
      const c = idx % this.round.cols;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'oa-mem-cell';

      const targetItem = itemByCell.get(idx);
      const placedSym = this.placements.get(idx);

      if (this.subPhase === 'encode') {
        cell.disabled = true;
        if (targetItem) {
          cell.classList.add('is-target');
          cell.innerHTML =
            `<span class="oa-mem-order">${targetItem.order}</span>` +
            renderMemorySymbolSvg(targetItem.symbolId, 26) +
            `<span class="oa-mem-word">${targetItem.word}</span>`;
        } else {
          cell.innerHTML = `<span class="oa-mem-coord">F${r + 1}·C${c + 1}</span>`;
        }
      } else if (this.subPhase === 'recall') {
        cell.setAttribute('aria-label', `Estancia Fila ${r + 1}, Columna ${c + 1}`);
        if (placedSym) {
          cell.classList.add('is-placed');
          cell.innerHTML =
            renderMemorySymbolSvg(placedSym, 26) +
            `<span class="oa-mem-word">${getSymbolWord(placedSym)}</span>`;
        } else {
          cell.innerHTML = `<span class="oa-mem-coord">F${r + 1}·C${c + 1}</span>`;
        }
        cell.addEventListener('click', () => this.handleCellClick(idx));
      } else {
        // review
        cell.disabled = true;
        if (targetItem) {
          const isExact = placedSym === targetItem.symbolId;
          cell.classList.add(isExact ? 'is-correct' : 'is-wrong');
          cell.innerHTML =
            `<span class="oa-mem-order">${targetItem.order}</span>` +
            renderMemorySymbolSvg(targetItem.symbolId, 24) +
            `<span class="oa-mem-word">${targetItem.word}</span>`;
        } else if (placedSym) {
          cell.classList.add('is-wrong');
          cell.innerHTML =
            renderMemorySymbolSvg(placedSym, 22) +
            `<span class="oa-mem-word">Sobró</span>`;
        } else {
          cell.innerHTML = `<span class="oa-mem-coord">F${r + 1}·C${c + 1}</span>`;
        }
      }

      grid.appendChild(cell);
    }

    wrap.appendChild(grid);

    if (this.subPhase === 'encode') {
      const readyBtn = document.createElement('button');
      readyBtn.type = 'button';
      readyBtn.className = 'oa-intel-primary-btn';
      readyBtn.innerHTML = `${Icons.check(17)}<span>Ya lo memoricé (Espacio)</span>`;
      readyBtn.addEventListener('click', () => this.finishEncodingPhase());
      wrap.appendChild(readyBtn);
    } else if (this.subPhase === 'recall') {
      const usedSet = new Set(this.placements.values());
      const palette = document.createElement('div');
      palette.className = 'oa-mem-palette';
      palette.setAttribute('role', 'group');
      palette.setAttribute('aria-label', 'Símbolos para colocar');

      for (const symId of this.paletteSymbols) {
        const symBtn = document.createElement('button');
        symBtn.type = 'button';
        symBtn.className = 'oa-mem-sym-btn';
        const isUsed = usedSet.has(symId);
        if (isUsed) symBtn.classList.add('is-used');
        symBtn.setAttribute('aria-pressed', this.activeSymbol === symId ? 'true' : 'false');
        symBtn.innerHTML = `${renderMemorySymbolSvg(symId, 18)}<span>${getSymbolWord(symId)}</span>`;
        symBtn.addEventListener('click', () => {
          synthAudio.uiClick();
          this.activeSymbol = symId;
          this.renderBoard();
        });
        palette.appendChild(symBtn);
      }

      const checkBtn = document.createElement('button');
      checkBtn.type = 'button';
      checkBtn.className = 'oa-intel-primary-btn';
      checkBtn.disabled = this.placements.size === 0;
      checkBtn.innerHTML = `${Icons.check(17)}<span>Comprobar recuerdo (${this.placements.size}/${this.round.count})</span>`;
      checkBtn.addEventListener('click', () => this.submitRecall());

      wrap.append(palette, checkBtn);
    }

    this.stageEl.appendChild(wrap);
    this.renderSideActions();
  }

  private renderSideActions(): void {
    this.actionBoxEl.innerHTML = '';
    const actions = document.createElement('div');
    actions.className = 'oa-academy-actions';

    if (this.practiceMode && this.subPhase === 'encode') {
      const tipBtn = document.createElement('button');
      tipBtn.type = 'button';
      tipBtn.innerHTML = `${Icons.lightbulb(16)}<span>${this.mnemonicShown ? 'Ocultar truco' : 'Ver ruta mnemotécnica'}</span>`;
      tipBtn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.mnemonicShown = !this.mnemonicShown;
        renderExplanationBox(
          this.explainEl,
          this.mnemonicShown ? 'Ruta mnemotécnica (Método de Loci)' : `Fase 1: Codifica ${this.round.count} estancias`,
          this.mnemonicShown
            ? this.round.mnemonicTip
            : 'Asocia cada símbolo con su posición espacial. Cuando los tengas claros, pulsa Ya lo memoricé.',
          'info'
        );
        this.renderSideActions();
      });
      actions.appendChild(tipBtn);
    }

    if (this.subPhase === 'review') {
      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'oa-intel-primary-btn';
      const isLastChallenge =
        !this.practiceMode && !this.infiniteMode && this.roundIdx + 1 >= CHALLENGE_TOTAL;
      nextBtn.innerHTML = `<span>${isLastChallenge ? 'Ver resultado final' : 'Siguiente palacio'}</span>${Icons.arrowRight(16)}`;
      nextBtn.addEventListener('click', () => this.advanceRound());
      actions.appendChild(nextBtn);
    }

    if (this.practiceMode) {
      const cfgBtn = document.createElement('button');
      cfgBtn.type = 'button';
      cfgBtn.innerHTML = `${Icons.sliders(16)}<span>Cambiar carga</span>`;
      cfgBtn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.renderPrep();
      });
      actions.appendChild(cfgBtn);
    }

    if (actions.children.length > 0) {
      this.actionBoxEl.appendChild(actions);
    }
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

    if (this.subPhase === 'encode') {
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        this.finishEncodingPhase();
      }
      return;
    }

    if (this.subPhase === 'interference' && this.interferenceTask) {
      const num = Number(e.key);
      if (Number.isInteger(num) && num >= 1 && num <= 4) {
        e.preventDefault();
        this.answerInterference(num - 1);
      }
      return;
    }

    if (this.subPhase === 'recall') {
      if (e.key === 'Enter' && this.placements.size > 0) {
        e.preventDefault();
        this.submitRecall();
      }
      return;
    }

    if (this.subPhase === 'review') {
      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.advanceRound();
      }
    }
  };

  public update(dt: number, _elapsed: number): void {
    if (this.paused || this.destroyed || this.phase !== 'playing') return;
    this.totalElapsed += dt;

    if (!this.practiceMode && !this.infiniteMode && this.subPhase === 'encode') {
      const prevSec = Math.ceil(this.encodeTimeLeft);
      this.encodeTimeLeft = Math.max(0, this.encodeTimeLeft - dt);
      const nextSec = Math.ceil(this.encodeTimeLeft);
      if (nextSec !== prevSec) {
        this.ctx.setHud({ timeLeftSec: nextSec });
      }
      if (this.encodeTimeLeft <= 0) {
        this.finishEncodingPhase();
      }
    }

    if (this.isGauntletSlice && this.totalElapsed >= 15 && !this.finished) {
      this.finishRun(true);
    }
  }

  public onResize(): void {}

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public getMetrics(
    survived = this.hits > 0 || this.practiceMode
  ): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const avgAcc =
      this.roundsCompleted > 0
        ? Math.round(this.accuracySum / this.roundsCompleted)
        : 100;
    const ratio = this.infiniteMode
      ? Math.min(1, this.hits / 10)
      : Math.min(1, this.hits / CHALLENGE_TOTAL);
    const logicScore = Math.min(1000, Math.round(240 + ratio * 720 * (avgAcc / 100)));

    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy: avgAcc,
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
