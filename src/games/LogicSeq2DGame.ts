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
  generateLogicRound,
  type LogicCategory,
  type LogicLevel,
  type LogicQuestion,
} from './intel/logicSeqEngine';

type LogicChoiceMode = LogicLevel | 'progressive';
type LogicFilter = LogicCategory | 'mixed';

const CHALLENGE_TOTAL = 12;

export class LogicSeq2DGame implements MiniGame {
  public readonly id = 'logicseq2d' as const;

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
  private selectedMode: LogicChoiceMode = 'progressive';
  private selectedCategory: LogicFilter = 'mixed';
  private baseSeed = (Date.now() ^ 0x6b14e9) & 0x7fffffff;

  private roundIdx = 0;
  private question!: LogicQuestion;
  private answered = false;
  private chosenIndex: number | null = null;
  private hintShown = false;

  private roundTimeLimit = 40;
  private roundTimeLeft = 40;
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
    this.infiniteMode = Boolean(ctx.infiniteMode) && !this.practiceMode && !this.isGauntletSlice;

    this.roundTimeLimit = ctx.difficulty === 'chill' ? 55 : ctx.difficulty === 'hyper' ? 30 : 40;

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

    const layout = createAcademyLayout(ctx.container, 'SERIES Y SILOGISMOS', badge);
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
      phaseLabel: 'SERIES Y SILOGISMOS',
      accent: '#7C3AED',
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
        { keys: ['Clic', 'Enter'], touch: 'Toca Empezar', action: 'Comenzar serie lógica', tone: 'primary' },
      ]);
      return;
    }
    if (this.answered) {
      this.ctx.setControls([
        { keys: ['Enter', 'Espacio'], touch: 'Toca Siguiente', action: 'Siguiente problema', tone: 'primary' },
      ]);
      return;
    }
    const hints = [
      { keys: ['1–4', 'Clic'], touch: 'Toca una opción', action: 'Confirmar deducción', tone: 'primary' as const },
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
        id: 'logicseq:prep',
        sectionName: 'Preparar Series y Silogismos',
        steps: [
          'En Práctica puedes filtrar una sola área (Sucesiones, Analogías, Silogismos o Sesgos) o jugar en Mixto.',
          'Elige el nivel de profundidad (1 a 4) o Progresivo para subir automáticamente la dificultad.',
          'Responde con clic o las teclas 1–4; cada respuesta muestra la explicación formal completa.',
        ],
        tip: 'El banco incluye más de 150 ítems curados entre analogías, sesgos cognitivos y plantillas de silogismos con diagrama de Venn.',
      };
    } else if (this.question.category === 'sequence') {
      info = {
        id: 'logicseq:sequence',
        sectionName: 'Modo Sucesiones Numéricas',
        steps: [
          'Calcula primero las diferencias entre cada término consecutivo (1er orden).',
          'Si la diferencia no es constante, revisa diferencias de 2º orden, multiplicadores o dos pistas intercaladas.',
          'Confirma tu número con clic o teclas 1–4 y revisa la regla exacta al responder.',
        ],
        tip: 'En niveles 3 y 4 separa mentalmente las posiciones impares (1ª, 3ª, 5ª) de las pares (2ª, 4ª, 6ª) o compara con cuadrados n².',
      };
    } else if (this.question.category === 'analogy') {
      info = {
        id: 'logicseq:analogy',
        sectionName: 'Modo Analogías Estructurales',
        steps: [
          'Formula una frase breve que conecte el primer par (A → B) en el orden exacto en que aparece.',
          'Aplica esa misma relación al tercer concepto (C) y descarta distractores del mismo tema pero distinta función.',
          'Usa Pista (P) en Práctica si necesitas ver la categoría de relación estructural.',
        ],
        tip: 'No elijas una palabra solo porque suene asociada a C: verifica que la dirección lógica sea idéntica a A → B.',
      };
    } else if (this.question.category === 'syllogism') {
      info = {
        id: 'logicseq:syllogism',
        sectionName: 'Modo Silogismos y Conjuntos',
        steps: [
          'Acepta únicamente las dos premisas como verdades absolutas sin añadir suposiciones externas.',
          'Imagina los conjuntos como círculos (inclusión total, exclusión total o solapamiento parcial).',
          'Comprueba el diagrama de Venn que aparece al responder o pedir pista para consolidar la forma válida.',
        ],
        tip: 'Que dos grupos estén dentro de un tercero no obliga a que se toquen (falacia del término medio no distribuido).',
      };
    } else {
      info = {
        id: 'logicseq:bias',
        sectionName: 'Modo Sesgos y Pensamiento Crítico',
        steps: [
          'Identifica qué evidencia se está omitiendo o qué salto injustificado hace el argumento.',
          'Distingue entre errores estadísticos (tasa base, muestreo, regresión) y falacias retóricas (ad hominem, falsa dicotomía).',
          'Lee la explicación tras responder para reconocer estos atajos en noticias y decisiones reales.',
        ],
        tip: 'Pregúntate siempre: "¿qué datos faltan en el denominador o en el grupo que no se observa?".',
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
    h.textContent = 'Configura tu sesión de Lógica y Pensamiento Crítico';

    const p = document.createElement('p');
    p.className = 'oa-intel-prep-sub';
    if (this.practiceMode) {
      p.textContent =
        'En Práctica puedes filtrar por tipo de reto (Sucesiones, Analogías, Silogismos o Sesgos), pedir pistas y analizar el diagrama de Venn en cada respuesta.';
    } else if (this.infiniteMode) {
      p.textContent =
        'Modo Infinito Progresivo: alterna las 4 áreas sin límite de reloj subiendo reglas hasta nivel 4. Cada error resta 1 escudo.';
    } else {
      p.textContent =
        `Modo Reto: ${CHALLENGE_TOTAL} problemas variados (${this.roundTimeLimit} s por pregunta). Cada error o tiempo agotado cuesta 1 escudo.`;
    }

    // Category filter (only in Practice or optional Mixto)
    if (this.practiceMode) {
      const catGroup = document.createElement('div');
      catGroup.className = 'oa-intel-group';
      const catLbl = document.createElement('span');
      catLbl.className = 'oa-intel-label';
      catLbl.textContent = 'Tipo de reto';
      const catPills = document.createElement('div');
      catPills.className = 'oa-intel-pills';

      const cats: { id: LogicFilter; label: string }[] = [
        { id: 'mixed', label: 'Mixto (4 áreas)' },
        { id: 'sequence', label: 'Sucesiones' },
        { id: 'analogy', label: 'Analogías' },
        { id: 'syllogism', label: 'Silogismos' },
        { id: 'bias', label: 'Sesgos críticos' },
      ];

      const renderCatPills = () => {
        catPills.innerHTML = '';
        for (const c of cats) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'oa-intel-pill';
          b.textContent = c.label;
          b.setAttribute('aria-pressed', this.selectedCategory === c.id ? 'true' : 'false');
          b.addEventListener('click', () => {
            synthAudio.uiClick();
            this.selectedCategory = c.id;
            renderCatPills();
          });
          catPills.appendChild(b);
        }
      };
      renderCatPills();
      catGroup.append(catLbl, catPills);
      prep.append(h, p, catGroup);
    } else {
      this.selectedCategory = 'mixed';
      prep.append(h, p);
    }

    const levelGroup = document.createElement('div');
    levelGroup.className = 'oa-intel-group';
    const levelLbl = document.createElement('span');
    levelLbl.className = 'oa-intel-label';
    levelLbl.textContent = 'Nivel de profundidad';
    const levelPills = document.createElement('div');
    levelPills.className = 'oa-intel-pills';

    const modes: { id: LogicChoiceMode; label: string }[] = [
      { id: 1, label: 'Nivel 1 · Base' },
      { id: 2, label: 'Nivel 2 · 2º orden' },
      { id: 3, label: 'Nivel 3 · Formal' },
      { id: 4, label: 'Nivel 4 · Experto' },
      { id: 'progressive', label: 'Progresivo (1 a 4)' },
    ];

    const renderLevelPills = () => {
      levelPills.innerHTML = '';
      for (const m of modes) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'oa-intel-pill';
        b.textContent = m.label;
        b.setAttribute('aria-pressed', this.selectedMode === m.id ? 'true' : 'false');
        b.addEventListener('click', () => {
          synthAudio.uiClick();
          this.selectedMode = m.id;
          renderLevelPills();
        });
        levelPills.appendChild(b);
      }
    };
    renderLevelPills();
    levelGroup.append(levelLbl, levelPills);

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'oa-intel-primary-btn';
    startBtn.innerHTML = `${Icons.play(17)}<span>Empezar serie</span>`;
    startBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.startSession();
    });

    prep.append(levelGroup, startBtn);
    this.stageEl.appendChild(prep);

    renderExplanationBox(
      this.explainEl,
      '4 pilares del razonamiento',
      '1) Sucesiones: calcula diferencias de 1º y 2º orden. 2) Analogías: iguala la relación estructural. 3) Silogismos: asume solo las premisas sin dejarte llevar por creencias previas. 4) Sesgos: identifica fallos estadísticos.',
      'info'
    );
    this.actionBoxEl.innerHTML = '';
  }

  private levelForRound(roundIdx: number): LogicLevel {
    if (this.selectedMode !== 'progressive') {
      if (this.infiniteMode) {
        return Math.min(4, this.selectedMode + Math.floor(roundIdx / 5)) as LogicLevel;
      }
      return this.selectedMode;
    }
    const boost = this.ctx.getIntensity() >= 1.32 ? 1 : 0;
    const eff = roundIdx + boost;
    if (eff < 3) return 1;
    if (eff < 6) return 2;
    if (eff < 9) return 3;
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
    this.loadNextQuestion();
  }

  private loadNextQuestion(): void {
    const level = this.levelForRound(this.roundIdx);
    const seed = (this.baseSeed + this.roundIdx * 4099 + level * 211) >>> 0;
    const categoryArg: LogicFilter =
      this.selectedCategory === 'mixed'
        ? (['sequence', 'analogy', 'syllogism', 'bias'][this.roundIdx % 4] as LogicCategory)
        : this.selectedCategory;

    this.question = generateLogicRound(categoryArg, level, seed);
    this.answered = false;
    this.chosenIndex = null;
    this.hintShown = false;
    this.roundTimeLeft = this.roundTimeLimit;

    this.updateSectionTutorial();
    this.updateControlsHint();
    this.renderBoard();
    this.updateHud();
  }

  private updateHud(): void {
    const progressLabel = this.practiceMode
      ? `PRÁCTICA · RETO ${this.roundIdx + 1}`
      : this.infiniteMode
        ? `INFINITO · RETO ${this.roundIdx + 1}`
        : `RETO ${this.roundIdx + 1}/${CHALLENGE_TOTAL}`;
    const showTimer = !this.practiceMode && !this.infiniteMode && this.phase === 'playing' && !this.answered;
    this.ctx.setHud({
      timeLeftSec: showTimer ? Math.ceil(this.roundTimeLeft) : null,
      subStat: `${progressLabel} · ACIERTOS ${this.hits}`,
    });
  }

  private renderBoard(): void {
    this.stageEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'oa-logic-wrap';

    // Top meta row
    const meta = document.createElement('div');
    meta.className = 'oa-intel-meta-row';

    const chipLevel = document.createElement('span');
    chipLevel.className = 'oa-intel-stat-chip';
    chipLevel.textContent = `Nivel ${this.question.level} · ${this.question.categoryLabel}`;

    const chipProg = document.createElement('span');
    chipProg.className = 'oa-intel-stat-chip';
    chipProg.textContent = this.practiceMode
      ? `Problema ${this.roundIdx + 1} · Aciertos ${this.hits}`
      : this.infiniteMode
        ? `Infinito · Problema ${this.roundIdx + 1} · Aciertos ${this.hits}`
        : `Problema ${this.roundIdx + 1} / ${CHALLENGE_TOTAL} · Aciertos ${this.hits}`;

    meta.append(chipLevel, chipProg);

    // Main question card
    const card = document.createElement('div');
    card.className = 'oa-logic-card';

    const catPill = document.createElement('span');
    catPill.className = 'oa-logic-cat-pill';
    catPill.textContent = this.question.categoryLabel;

    const promptEl = document.createElement('p');
    promptEl.className = 'oa-logic-prompt';
    promptEl.textContent = this.question.prompt;

    card.append(catPill, promptEl);

    if (this.question.vennSvg && (this.answered || (this.practiceMode && this.hintShown))) {
      const vennBox = document.createElement('div');
      vennBox.className = 'oa-logic-venn';
      vennBox.innerHTML = this.question.vennSvg;
      card.appendChild(vennBox);
    }

    // Options
    const optsEl = document.createElement('div');
    optsEl.className = 'oa-logic-options';
    optsEl.setAttribute('role', 'group');
    optsEl.setAttribute('aria-label', 'Opciones de respuesta');

    this.question.options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-logic-opt';
      btn.disabled = this.answered;

      if (this.answered) {
        if (idx === this.question.correctIndex) btn.classList.add('is-correct');
        else if (idx === this.chosenIndex) btn.classList.add('is-wrong');
      }

      const numSpan = document.createElement('span');
      numSpan.className = 'oa-logic-opt-num';
      numSpan.textContent = String(idx + 1);

      const textSpan = document.createElement('span');
      textSpan.textContent = optText;

      btn.append(numSpan, textSpan);
      btn.addEventListener('click', () => this.selectOption(idx));
      optsEl.appendChild(btn);
    });

    wrap.append(meta, card, optsEl);
    this.stageEl.appendChild(wrap);

    this.renderSidePanel();
  }

  private renderSidePanel(): void {
    if (!this.answered) {
      if (this.hintShown) {
        renderExplanationBox(this.explainEl, 'Pista razonada', this.question.hint, 'info');
      } else {
        renderExplanationBox(
          this.explainEl,
          this.question.categoryLabel,
          'Lee con calma todas las premisas o términos antes de descartar opciones.',
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
      nextBtn.innerHTML = `<span>${isLastChallenge ? 'Ver resultado final' : 'Siguiente problema'}</span>${Icons.arrowRight(16)}`;
      nextBtn.addEventListener('click', () => this.advanceRound());
      actions.appendChild(nextBtn);
    }

    if (this.practiceMode) {
      const catWrap = document.createElement('div');
      catWrap.className = 'oa-intel-group';
      const catLbl = document.createElement('span');
      catLbl.className = 'oa-intel-label';
      catLbl.textContent = 'Cambiar tipo en práctica';
      const catPills = document.createElement('div');
      catPills.className = 'oa-intel-pills';
      const cats: { id: LogicFilter; label: string }[] = [
        { id: 'mixed', label: 'Mixto' },
        { id: 'sequence', label: 'Series' },
        { id: 'analogy', label: 'Analogías' },
        { id: 'syllogism', label: 'Silogismos' },
        { id: 'bias', label: 'Sesgos' },
      ];
      cats.forEach((c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'oa-intel-pill';
        b.textContent = c.label;
        b.setAttribute('aria-pressed', this.selectedCategory === c.id ? 'true' : 'false');
        b.addEventListener('click', () => {
          synthAudio.uiClick();
          this.selectedCategory = c.id;
          this.roundIdx++;
          this.loadNextQuestion();
        });
        catPills.appendChild(b);
      });
      catWrap.append(catLbl, catPills);
      this.actionBoxEl.appendChild(catWrap);

      const levelWrap = document.createElement('div');
      levelWrap.className = 'oa-intel-group';
      const lvlLbl = document.createElement('span');
      lvlLbl.className = 'oa-intel-label';
      lvlLbl.textContent = 'Nivel en práctica';
      const lvlPills = document.createElement('div');
      lvlPills.className = 'oa-intel-pills';
      ([1, 2, 3, 4] as LogicLevel[]).forEach((lv) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'oa-intel-pill';
        b.textContent = `N${lv}`;
        b.setAttribute('aria-pressed', this.selectedMode === lv ? 'true' : 'false');
        b.addEventListener('click', () => {
          synthAudio.uiClick();
          this.selectedMode = lv;
          this.roundIdx++;
          this.loadNextQuestion();
        });
        lvlPills.appendChild(b);
      });
      levelWrap.append(lvlLbl, lvlPills);
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

    const usedMs = Math.max(250, Math.round((this.roundTimeLimit - this.roundTimeLeft) * 1000));
    this.reactionTimesMs.push(usedMs);

    const correct = idx === this.question.correctIndex;
    if (correct) {
      this.hits++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const timeBonus =
        this.practiceMode || this.infiniteMode ? 0 : Math.round(this.roundTimeLeft * 4);
      const pts = 140 + this.question.level * 45 + timeBonus;
      this.score += pts;
      this.ctx.addScore(pts, 1);
      synthAudio.puzzleSuccess(this.combo);
      renderExplanationBox(
        this.explainEl,
        `Correcto (Opción ${idx + 1})`,
        this.question.explanation,
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
        `Incorrecto · Respuesta correcta: Opción ${this.question.correctIndex + 1}`,
        this.question.explanation,
        'bad'
      );
      if (!this.practiceMode && remShields <= 0) {
        this.updateHud();
        this.finishRun(false);
        return;
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
    this.reactionTimesMs.push(this.roundTimeLimit * 1000);
    synthAudio.damage();

    const remShields = this.ctx.damage(1);
    renderExplanationBox(
      this.explainEl,
      `Tiempo agotado · Respuesta: Opción ${this.question.correctIndex + 1}`,
      this.question.explanation,
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
    this.loadNextQuestion();
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
    if (Number.isInteger(num) && num >= 1 && num <= this.question.options.length) {
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
    const total = Math.max(1, this.hits + this.misses);
    const accuracy = Math.round((this.hits / total) * 100);
    const avgReactionMs =
      this.reactionTimesMs.length > 0
        ? Math.round(this.reactionTimesMs.reduce((a, b) => a + b, 0) / this.reactionTimesMs.length)
        : undefined;
    const ratio = this.infiniteMode
      ? Math.min(1, this.hits / 14)
      : Math.min(1, this.hits / CHALLENGE_TOTAL);
    const logicScore = Math.min(1000, Math.round(240 + ratio * 720 * (accuracy / 100)));

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
