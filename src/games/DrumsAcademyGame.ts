import { synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import { DrumPieceId, GameContext, MiniGame, RunMetrics } from '../types';
import { createAcademyLayout, createSectionTutorialEl, renderExplanationBox, SectionTutorialInfo } from '../ui/AcademyKit';
import {
  buildGrooveTimeline,
  DRUM_GROOVES,
  DRUM_INDEPENDENCE,
  DRUM_PIECE_BY_CODE,
  DRUM_PIECES,
  DrumHitEvent,
  grooveStepBeats,
} from './music/drumsBank';
import { gradePoints, gradeTiming, HitGrade, summarizeMusicRun } from './music/musicScore';
import {
  createActionButton,
  createBpmControl,
  createMetronomeControl,
  MetronomeWidget,
  renderMusicStatsCard,
  shouldIgnoreGameHotkey,
} from './music/musicUi';
import '../styles/academy-rubik-piano.css';
import '../styles/academy-music.css';

type DrumTab = 'free' | 'grooves' | 'guided' | 'independence';

interface ScheduledDrumTarget extends DrumHitEvent {
  timeSec: number;
  barIndex: number;
  matched: boolean;
  missed: boolean;
}

interface RecordedHit {
  piece: DrumPieceId;
  beatOffset: number;
}

export class DrumsAcademyGame implements MiniGame {
  public readonly id = 'drums2d' as const;

  private ctx!: GameContext;
  private readonly isGauntletSlice: boolean;
  private isPractice = false;
  private isInfinite = false;
  private paused = false;
  private destroyed = false;
  private finishedEmitted = false;

  // Submode & Groove state
  private activeTab: DrumTab = 'free';
  private grooveIdx = 0;
  private indepIdx = 0;
  private bpm = 100;
  private tempoScale = 1.0;
  private metronomeEnabled = false;
  private metroTimerSec = 0;
  private metroBeatCount = 0;
  private metroWidget: MetronomeWidget | null = null;

  // Custom editable groove grid + 2-bar loop recorder
  private customLanes: Partial<Record<DrumPieceId, string[]>> = {};
  private groovePlaying = false;
  private groovePlayTimer = 0;
  private groovePlayStep = 0;

  private loopRecording = false;
  private loopPlaying = false;
  private loopElapsedSec = 0;
  private loopRecorded: RecordedHit[] = [];
  private loopPlayCursor = 0;

  // Guided / Challenge play state
  private guidedWaitMode = false;
  private guidedRunning = false;
  private guidedElapsedSec = 0;
  private guidedTargets: ScheduledDrumTarget[] = [];
  private guidedTotalBars = 4;
  private guidedBarCounter = 0;
  private guidedLastStep = -1;
  private guidedEndGraceSec = 0;
  private guidedFinishPending = false;
  private waitStepIndex = 0;
  private waitRemainingPieces = new Set<DrumPieceId>();

  // Scoring
  private hits = 0;
  private misses = 0;
  private perfectHits = 0;
  private goodHits = 0;
  private okHits = 0;
  private timingDeviationsMs: number[] = [];
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private barsCompleted = 0;
  private lastFeedbackText = 'Listo para tocar';
  private lastFeedbackTone: 'neutral' | 'perfect' | 'good' | 'miss' = 'neutral';

  // DOM refs
  private stageEl!: HTMLDivElement;
  private sideEl!: HTMLElement;
  private tabsHostEl: HTMLDivElement | null = null;
  private modeToolbarEl: HTMLDivElement | null = null;
  private seqHostEl: HTMLDivElement | null = null;
  private padButtons = new Map<DrumPieceId, HTMLButtonElement>();
  private padFlashTimers = new Map<DrumPieceId, number>();
  private feedbackEl: HTMLSpanElement | null = null;
  private tutorialHostEl: HTMLDivElement | null = null;
  private explainHostEl: HTMLDivElement | null = null;
  private statsCardEl: HTMLDivElement | null = null;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.isPractice = ctx.practiceMode === true;
    this.isInfinite = ctx.infiniteMode === true && !this.isPractice && !this.isGauntletSlice;
    this.destroyed = false;
    this.finishedEmitted = false;

    this.bpm =
      ctx.difficulty === 'chill'
        ? 85
        : ctx.difficulty === 'hyper'
          ? 120
          : ctx.difficulty === 'progressive'
            ? 88
            : DRUM_GROOVES[0].bpm;

    const layout = createAcademyLayout(
      ctx.container,
      'BATERÍA ACADEMIA',
      this.isPractice ? 'PRÁCTICA GUIADA' : this.isInfinite ? 'RESISTENCIA RÍTMICA' : 'MODO RETO'
    );
    this.stageEl = layout.stageEl;
    this.sideEl = layout.sideEl;

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: this.isPractice
        ? 'BATERÍA · PRÁCTICA'
        : this.isInfinite
          ? 'BATERÍA · RESISTENCIA INFINITA'
          : 'BATERÍA · RETO',
      accent: '#E11D48',
      timeLeftSec: null,
      subStat: `Kit de ${DRUM_PIECES.length} piezas · ${DRUM_GROOVES.length} ritmos`,
    });

    this.loadCustomLanesFromGroove(this.grooveIdx);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('blur', this.onWindowBlur);

    if (this.isPractice) {
      this.activeTab = 'free';
      this.buildWorkspace();
      this.syncControlsBar();
      this.renderModeContent();
    } else if (this.isInfinite) {
      this.activeTab = 'guided';
      this.guidedWaitMode = false;
      this.buildWorkspace();
      this.startGuidedSession();
      this.syncControlsBar();
    } else {
      this.renderChallengePrep();
    }
  }

  private loadCustomLanesFromGroove(idx: number): void {
    const g = DRUM_GROOVES[idx];
    this.customLanes = {};
    for (const p of DRUM_PIECES) {
      const str = g.lanes[p.id];
      if (str) {
        this.customLanes[p.id] = [...str];
      }
    }
  }

  private renderChallengePrep(): void {
    this.stageEl.innerHTML = '';
    this.sideEl.querySelectorAll('.oa-drums-dyn-card').forEach((n) => n.remove());

    const prep = document.createElement('div');
    prep.className = 'oa-rp-prep-card';
    prep.innerHTML = `
      <h3 class="oa-rp-prep-title">Elige tu Ritmo de Batería</h3>
      <p class="oa-rp-prep-desc">
        Toca 4 compases a tempo. Los errores rompen el combo pero <strong>nunca te cortan el ritmo</strong>; al terminar se evalúa tu precisión rítmica.
      </p>
      <div id="oa-drums-prep-controls"></div>
      <button type="button" class="oa-rp-primary-btn" id="oa-drums-start-challenge">
        ${Icons.play(18)}<span>Empezar Reto de Batería</span>
      </button>
    `;

    const ctrlHost = prep.querySelector('#oa-drums-prep-controls')!;
    const sel = document.createElement('select');
    sel.className = 'oa-mus-select';
    sel.setAttribute('aria-label', 'Elegir ritmo por género');
    DRUM_GROOVES.forEach((g, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = `[${g.level}] ${g.title} · ${g.genre} (${g.bpm} BPM)`;
      if (idx === this.grooveIdx) opt.selected = true;
      sel.appendChild(opt);
    });

    const bpmRow = document.createElement('div');
    bpmRow.className = 'oa-rp-choice-row';
    bpmRow.style.marginTop = '8px';
    const renderBpm = () => {
      bpmRow.innerHTML = '';
      bpmRow.appendChild(
        createBpmControl({
          bpm: this.bpm,
          onChange: (next) => {
            this.bpm = next;
          },
        })
      );
    };

    sel.addEventListener('change', () => {
      this.grooveIdx = Number(sel.value);
      this.bpm = DRUM_GROOVES[this.grooveIdx].bpm;
      this.loadCustomLanesFromGroove(this.grooveIdx);
      renderBpm();
    });

    renderBpm();
    ctrlHost.append(sel, bpmRow);

    prep.querySelector('#oa-drums-start-challenge')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.activeTab = 'guided';
      this.guidedWaitMode = false;
      this.buildWorkspace();
      this.startGuidedSession();
      this.syncControlsBar();
    });

    this.stageEl.appendChild(prep);

    const card = document.createElement('div');
    card.className = 'oa-academy-card oa-drums-dyn-card';
    const ex = document.createElement('div');
    renderExplanationBox(
      ex,
      'Atajos de teclado',
      'Espacio Bombo · F Caja · J Hi-Hat cerrado · K Hi-Hat abierto · D/S Toms · R Crash · U Ride.',
      'info'
    );
    card.appendChild(ex);

    const tutWrap = document.createElement('div');
    tutWrap.className = 'oa-drums-dyn-card';
    tutWrap.appendChild(
      createSectionTutorialEl({
        id: 'drums:prep',
        sectionName: 'Tutorial: Reto de Batería',
        steps: [
          `Selecciona uno de los ${DRUM_GROOVES.length} ritmos (Rock, Festejo, Cumbia, Samba, Vals 3/4, Jazz, Punk...) y ajusta los BPM.`,
          'Al iniciar, sigue los pads iluminados en dorado durante 4 compases.',
          'Los golpes fallidos rompen el combo pero nunca detienen el groove.',
        ],
        tip: 'Usa Espacio (Bombo), F (Caja) y J/K (Hi-Hat) como núcleo de casi todos los ritmos.',
      })
    );
    this.sideEl.append(tutWrap, card);

    this.syncControlsBar();
  }

  private buildWorkspace(): void {
    this.stageEl.innerHTML = '';
    this.sideEl.querySelectorAll('.oa-drums-dyn-card').forEach((n) => n.remove());
    this.padButtons.clear();

    const stageCard = document.createElement('div');
    stageCard.className = 'oa-rp-stage-card';

    const topToolbar = document.createElement('div');
    topToolbar.className = 'oa-mus-toolbar-row';

    const tabsHost = document.createElement('div');
    tabsHost.className = 'oa-piano-tabs';
    tabsHost.setAttribute('role', 'tablist');
    this.tabsHostEl = tabsHost;

    const rightControls = document.createElement('div');
    rightControls.className = 'oa-mus-toolbar-group';

    const feedbackPill = document.createElement('span');
    feedbackPill.className = `oa-drums-feedback-pill${this.lastFeedbackTone !== 'neutral' ? ` is-${this.lastFeedbackTone}` : ''}`;
    feedbackPill.textContent = this.lastFeedbackText;
    this.feedbackEl = feedbackPill;

    this.metroWidget = createMetronomeControl({
      enabled: this.metronomeEnabled,
      onToggle: (enabled) => {
        this.metronomeEnabled = enabled;
        this.metroTimerSec = 0;
        this.metroBeatCount = 0;
        if (enabled) {
          synthAudio.playMetronomeClick(true);
          this.metroWidget?.flashBeat(true);
        }
      },
    });

    rightControls.append(
      feedbackPill,
      createBpmControl({
        bpm: this.bpm,
        onChange: (next) => {
          this.bpm = next;
          if (this.guidedRunning && !this.guidedWaitMode) {
            this.rescheduleGuidedTargetsRemaining();
          }
        },
      }),
      this.metroWidget.root
    );

    topToolbar.append(tabsHost, rightControls);

    const modeToolbar = document.createElement('div');
    modeToolbar.className = 'oa-mus-toolbar-row';
    this.modeToolbarEl = modeToolbar;

    const seqHost = document.createElement('div');
    seqHost.className = 'oa-piano-display-panel';
    this.seqHostEl = seqHost;

    const kitGrid = this.buildKitElement();

    stageCard.append(topToolbar, modeToolbar, seqHost, kitGrid);
    this.stageEl.appendChild(stageCard);

    const tutorialHost = document.createElement('div');
    tutorialHost.className = 'oa-drums-dyn-card';
    this.tutorialHostEl = tutorialHost;

    const explainCard = document.createElement('div');
    explainCard.className = 'oa-academy-card oa-drums-dyn-card';
    const explainHost = document.createElement('div');
    this.explainHostEl = explainHost;
    explainCard.appendChild(explainHost);

    const statsCard = document.createElement('div');
    statsCard.className = 'oa-academy-card oa-drums-dyn-card';
    this.statsCardEl = statsCard;

    this.sideEl.append(tutorialHost, explainCard, statsCard);

    this.renderTabs();
    this.updateStatsCard();
  }

  private buildKitElement(): HTMLDivElement {
    const kit = document.createElement('div');
    kit.className = 'oa-drums-kit';
    kit.setAttribute('role', 'group');
    kit.setAttribute('aria-label', `Kit de batería de ${DRUM_PIECES.length} piezas`);

    // Visual order: top row cymbals & toms, bottom row snare, hi-hat, kick
    const orderedIds: DrumPieceId[] = [
      'crash',
      'tom_high',
      'tom_low',
      'ride',
      'hihat_open',
      'hihat_closed',
      'snare',
      'kick',
    ];
    for (const id of orderedIds) {
      const def = DRUM_PIECES.find((p) => p.id === id)!;
      const btn = document.createElement('button');
      btn.type = 'button';
      const isCymbal = id === 'crash' || id === 'ride' || id === 'hihat_open' || id === 'hihat_closed';
      btn.className = `oa-drum-pad${isCymbal ? ' is-cymbal' : ''}`;
      btn.style.setProperty('--drum-color', def.color);
      btn.setAttribute('aria-label', `${def.name} (tecla ${def.keyLabel})`);
      btn.innerHTML = `
        <span class="oa-drum-pad-name">${def.name}</span>
        <kbd class="oa-drum-pad-key">${def.keyLabel}</kbd>
      `;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this.paused || this.destroyed) return;
        this.triggerDrumHit(def.id);
      });
      this.padButtons.set(def.id, btn);
      kit.appendChild(btn);
    }

    return kit;
  }

  private renderTabs(): void {
    if (!this.tabsHostEl) return;
    this.tabsHostEl.innerHTML = '';

    const tabs: { id: DrumTab; label: string }[] = [
      { id: 'free', label: '1. Kit Libre' },
      { id: 'grooves', label: `2. ${DRUM_GROOVES.length} Ritmos` },
      { id: 'guided', label: '3. Tocar Guiado' },
      { id: 'independence', label: `4. Independencia (${DRUM_INDEPENDENCE.length})` },
    ];

    tabs.forEach((t) => {
      const btn = createActionButton({
        label: t.label,
        pressed: this.activeTab === t.id,
        disabled: !this.isPractice && t.id !== 'guided',
        onClick: () => {
          if (!this.isPractice) return;
          synthAudio.uiClick();
          this.stopDrumLoops();
          this.activeTab = t.id;
          this.renderTabs();
          this.renderModeContent();
        },
      });
      btn.setAttribute('role', 'tab');
      this.tabsHostEl!.appendChild(btn);
    });
  }

  private syncControlsBar(): void {
    this.ctx.setControls?.([
      { keys: ['Espacio', 'F'], touch: 'Pads Bombo / Caja', action: 'Golpear Bombo y Caja', tone: 'primary' },
      { keys: ['J', 'K'], touch: 'Hi-Hat Cerrado / Abierto', action: 'Marcar pulso' },
      { keys: ['D', 'S', 'R', 'U'], touch: 'Toms y Platos', action: 'Toms, Crash y Ride' },
    ]);
  }

  private renderModeContent(): void {
    if (!this.modeToolbarEl || !this.seqHostEl) return;
    this.modeToolbarEl.innerHTML = '';
    this.seqHostEl.innerHTML = '';
    this.clearTargetPads();

    if (this.activeTab === 'free') {
      this.renderFreeTab();
    } else if (this.activeTab === 'grooves') {
      this.renderGroovesTab();
    } else if (this.activeTab === 'guided') {
      this.renderGuidedTab();
    } else {
      this.renderIndependenceTab();
    }
    this.renderSectionTutorial();
  }

  private renderSectionTutorial(): void {
    if (!this.tutorialHostEl) return;
    const map: Record<DrumTab, SectionTutorialInfo> = {
      free: {
        id: 'drums:free',
        sectionName: 'Tutorial: Kit Libre y Grabador',
        steps: [
          'Toca con teclado (Espacio Bombo, F Caja, J/K Hi-Hat, D/S Toms, R/U Platos) o pulsa los pads.',
          'Pulsa Grabar bucle (2 comp.) para registrar tu ritmo sobre 8 pulsos con metrónomo automático.',
          'Reproduce o limpia el bucle cuando quieras probar nuevas ideas.',
        ],
        tip: 'Sostén un pulso firme en J (Hi-Hat) antes de añadir bombo y caja.',
      },
      grooves: {
        id: 'drums:grooves',
        sectionName: `Tutorial: ${DRUM_GROOVES.length} Ritmos por Género`,
        steps: [
          `Explora ${DRUM_GROOVES.length} patrones (Rock, Festejo, Cumbia, Samba, Vals 3/4, Jazz, Punk...).`,
          'Pulsa Escuchar ritmo para ver el secuenciador avanzar en compases binarios o ternarios.',
          'Haz clic en las celdas de la parrilla para editar golpes/acentos y luego pulsa Probar este ritmo ahora.',
        ],
        tip: 'Cada clic alterna silencio -> golpe suave -> acento (punto blanco) para dar dinámica real.',
      },
      guided: {
        id: 'drums:guided',
        sectionName: 'Tutorial: Tocar Guiado',
        steps: [
          'Golpea cada pad iluminado en dorado cuando llegue su turno en la parrilla.',
          'Alterna entre Modo: Esperar golpe (paso a paso) y Modo: A tempo.',
          'Ajusta la velocidad (0.6x / 0.8x / 1.0x) o los BPM arriba si necesitas practicar lento.',
        ],
        tip: 'En Modo Esperar golpe, el cursor espera a que completes todas las piezas del paso actual.',
      },
      independence: {
        id: 'drums:independence',
        sectionName: `Tutorial: ${DRUM_INDEPENDENCE.length} Ejercicios de Independencia`,
        steps: [
          `Selecciona uno de los ${DRUM_INDEPENDENCE.length} ejercicios para disociar manos y pie.`,
          'Pulsa Escuchar ejercicio para oír el patrón ostinato y las respuestas.',
          `Imita cada ejercicio sobre los ${DRUM_PIECES.length} pads inferiores cuidando acentos y notas fantasma.`,
        ],
        tip: 'Domina primero la mano del plato (Ride o Hi-Hat) antes de incorporar la caja y el bombo.',
      },
    };
    this.tutorialHostEl.innerHTML = '';
    this.tutorialHostEl.appendChild(createSectionTutorialEl(map[this.activeTab]));
  }

  private renderFreeTab(): void {
    const grp = document.createElement('div');
    grp.className = 'oa-mus-toolbar-group';

    grp.append(
      createActionButton({
        label: this.loopRecording ? 'Grabando bucle (2 comp.)...' : 'Grabar bucle (2 comp.)',
        pressed: this.loopRecording,
        onClick: () => {
          synthAudio.uiClick();
          if (this.loopRecording) {
            this.loopRecording = false;
          } else {
            this.loopPlaying = false;
            this.loopRecorded = [];
            this.loopElapsedSec = 0;
            this.loopRecording = true;
            this.metronomeEnabled = true;
            this.metroWidget?.setActive(true);
          }
          this.renderModeContent();
        },
      }),
      createActionButton({
        label: this.loopPlaying ? 'Detener bucle' : `Reproducir bucle (${this.loopRecorded.length})`,
        iconHtml: Icons.play(15),
        pressed: this.loopPlaying,
        disabled: this.loopRecorded.length === 0 && !this.loopPlaying,
        onClick: () => {
          synthAudio.uiClick();
          this.loopRecording = false;
          this.loopPlaying = !this.loopPlaying;
          this.loopElapsedSec = 0;
          this.loopPlayCursor = 0;
          this.renderModeContent();
        },
      }),
      createActionButton({
        label: 'Limpiar bucle',
        iconHtml: Icons.refresh(15),
        disabled: this.loopRecorded.length === 0,
        onClick: () => {
          synthAudio.uiClick();
          this.loopPlaying = false;
          this.loopRecording = false;
          this.loopRecorded = [];
          this.renderModeContent();
        },
      })
    );

    this.modeToolbarEl!.appendChild(grp);

    const head = document.createElement('div');
    head.className = 'oa-explain-heading';
    head.textContent = `Kit Libre de ${DRUM_PIECES.length} piezas (latencia cero)`;
    const body = document.createElement('p');
    body.className = 'oa-explain-body';
    body.textContent = this.loopRecording
      ? 'Toca cualquier ritmo durante 2 compases (8 pulsos) al compás del metrónomo...'
      : 'Toca los pads o usa Espacio (Bombo), F (Caja), J/K (Hi-Hat), D/S (Toms) y R/U (Platos).';
    this.seqHostEl!.append(head, body);

    if (this.explainHostEl) {
      renderExplanationBox(
        this.explainHostEl,
        'Estudio de Percusión Libre',
        'Combina el metrónomo con el grabador de 2 compases para escuchar tu propio beat en bucle.',
        'info'
      );
    }
  }

  private renderGroovesTab(): void {
    const g = DRUM_GROOVES[this.grooveIdx];
    const grp = document.createElement('div');
    grp.className = 'oa-mus-toolbar-group';

    const sel = document.createElement('select');
    sel.className = 'oa-mus-select';
    sel.setAttribute('aria-label', 'Elegir ritmo por género');
    DRUM_GROOVES.forEach((gr, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = `[${gr.level}] ${gr.title} · ${gr.genre} (${gr.bpm} BPM)`;
      if (idx === this.grooveIdx) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      this.grooveIdx = Number(sel.value);
      this.bpm = DRUM_GROOVES[this.grooveIdx].bpm;
      this.loadCustomLanesFromGroove(this.grooveIdx);
      this.groovePlayStep = 0;
      this.renderModeContent();
    });

    const playBtn = createActionButton({
      label: this.groovePlaying ? 'Detener ritmo' : 'Escuchar ritmo',
      iconHtml: this.groovePlaying ? Icons.pause(15) : Icons.play(15),
      pressed: this.groovePlaying,
      onClick: () => {
        this.groovePlaying = !this.groovePlaying;
        this.groovePlayTimer = 0;
        this.groovePlayStep = 0;
        if (this.groovePlaying) this.playGridStep(0);
        this.renderModeContent();
      },
    });

    const tryBtn = createActionButton({
      label: 'Probar este ritmo ahora',
      className: 'oa-rp-pill-btn is-active',
      onClick: () => {
        synthAudio.uiClick();
        this.groovePlaying = false;
        this.activeTab = 'guided';
        this.renderTabs();
        this.startGuidedSession();
      },
    });

    grp.append(sel, playBtn, tryBtn);
    this.modeToolbarEl!.appendChild(grp);

    const head = document.createElement('div');
    head.className = 'oa-explain-heading';
    head.textContent = `${g.title} · ${g.genre} (${g.meterLabel})`;
    this.seqHostEl!.appendChild(head);
    this.renderStepGrid(this.seqHostEl!, g.steps, this.customLanes, true, this.groovePlayStep, g.beatsPerBar);

    if (this.explainHostEl) {
      renderExplanationBox(this.explainHostEl, `${g.title} (${g.level})`, g.tip, 'info');
    }
  }

  private renderGuidedTab(): void {
    const g = DRUM_GROOVES[this.grooveIdx];
    const grp = document.createElement('div');
    grp.className = 'oa-mus-toolbar-group';

    if (this.isPractice) {
      const sel = document.createElement('select');
      sel.className = 'oa-mus-select';
      sel.setAttribute('aria-label', 'Elegir ritmo guiado');
      DRUM_GROOVES.forEach((gr, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = `${gr.title} (${gr.genre})`;
        if (idx === this.grooveIdx) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        this.grooveIdx = Number(sel.value);
        this.bpm = DRUM_GROOVES[this.grooveIdx].bpm;
        this.loadCustomLanesFromGroove(this.grooveIdx);
        this.startGuidedSession();
      });

      const waitBtn = createActionButton({
        label: this.guidedWaitMode ? 'Modo: Esperar golpe' : 'Modo: A tempo',
        pressed: this.guidedWaitMode,
        onClick: () => {
          synthAudio.uiClick();
          this.guidedWaitMode = !this.guidedWaitMode;
          this.startGuidedSession();
        },
      });

      const restartBtn = createActionButton({
        label: this.guidedRunning ? 'Reiniciar' : 'Iniciar práctica',
        iconHtml: Icons.play(15),
        onClick: () => {
          synthAudio.uiClick();
          this.startGuidedSession();
        },
      });

      grp.append(sel, waitBtn, restartBtn);

      [0.6, 0.8, 1.0].forEach((sc) => {
        grp.appendChild(
          createActionButton({
            label: `${sc}x`,
            pressed: Math.abs(this.tempoScale - sc) < 0.01,
            onClick: () => {
              synthAudio.uiClick();
              this.tempoScale = sc;
              if (this.guidedRunning && !this.guidedWaitMode) {
                this.rescheduleGuidedTargetsRemaining();
              }
              this.renderModeContent();
            },
          })
        );
      });
    } else {
      const badge = document.createElement('span');
      badge.id = 'oa-drums-bar-badge';
      badge.className = 'oa-rubik-status-pill is-running';
      badge.textContent = this.isInfinite
        ? `Compases: ${this.barsCompleted} · ${Math.round(this.bpm)} BPM`
        : `${g.title} · Compás ${Math.min(this.guidedBarCounter + 1, this.guidedTotalBars)}/${this.guidedTotalBars}`;
      grp.appendChild(badge);
    }

    this.modeToolbarEl!.appendChild(grp);

    const head = document.createElement('div');
    head.className = 'oa-explain-heading';
    head.textContent = this.guidedWaitMode
      ? `${g.title} · Paso ${this.waitStepIndex + 1}/${g.steps} (esperando golpe iluminado)`
      : `${g.title} · Sigue los pads dorados al compás`;
    this.seqHostEl!.appendChild(head);

    const activeStep = this.guidedWaitMode ? this.waitStepIndex : Math.max(0, this.guidedLastStep % g.steps);
    this.renderStepGrid(this.seqHostEl!, g.steps, g.lanes, false, activeStep, g.beatsPerBar);
    this.refreshTargetPads();

    if (this.explainHostEl) {
      renderExplanationBox(
        this.explainHostEl,
        this.guidedWaitMode ? 'Paso a paso guiado' : this.isInfinite ? 'Resistencia Rítmica' : 'Reto a tempo',
        this.guidedWaitMode
          ? 'Los pads dorados esperan a que golpees todas las piezas del paso actual.'
          : `${g.tip}`,
        'info'
      );
    }
  }

  private renderIndependenceTab(): void {
    const ex = DRUM_INDEPENDENCE[this.indepIdx];
    const grp = document.createElement('div');
    grp.className = 'oa-mus-toolbar-group';

    const sel = document.createElement('select');
    sel.className = 'oa-mus-select';
    sel.setAttribute('aria-label', 'Elegir ejercicio de independencia');
    DRUM_INDEPENDENCE.forEach((item, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = item.title;
      if (idx === this.indepIdx) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      this.indepIdx = Number(sel.value);
      this.bpm = DRUM_INDEPENDENCE[this.indepIdx].bpm;
      this.groovePlayStep = 0;
      this.renderModeContent();
    });

    const playBtn = createActionButton({
      label: this.groovePlaying ? 'Detener ejemplo' : 'Escuchar ejercicio',
      iconHtml: Icons.volumeOn(15),
      pressed: this.groovePlaying,
      onClick: () => {
        this.groovePlaying = !this.groovePlaying;
        this.groovePlayTimer = 0;
        this.groovePlayStep = 0;
        if (this.groovePlaying) this.playGridStep(0, ex.lanes);
        this.renderModeContent();
      },
    });

    grp.append(sel, playBtn);
    this.modeToolbarEl!.appendChild(grp);

    const head = document.createElement('div');
    head.className = 'oa-explain-heading';
    head.textContent = `${ex.title} · ${ex.focus}`;
    this.seqHostEl!.appendChild(head);
    this.renderStepGrid(this.seqHostEl!, ex.steps, ex.lanes, false, this.groovePlayStep, ex.beatsPerBar);

    if (this.explainHostEl) {
      renderExplanationBox(this.explainHostEl, ex.focus, ex.explanation, 'info');
    }
  }

  private renderStepGrid(
    host: HTMLElement,
    steps: 12 | 16,
    lanes: Partial<Record<DrumPieceId, string | string[]>>,
    editable: boolean,
    playheadStep: number,
    beatsPerBar: 3 | 4 = 4
  ): void {
    const scroll = document.createElement('div');
    scroll.className = 'oa-drums-grid-scroll';
    const table = document.createElement('div');
    table.className = 'oa-drums-seq-table';
    table.style.setProperty('--drum-steps', String(steps));

    const beatEvery = Math.max(1, Math.round(steps / beatsPerBar));

    for (const pieceDef of DRUM_PIECES) {
      const laneData = lanes[pieceDef.id];
      if (!laneData && !editable) continue;
      const arr = laneData ? [...laneData] : Array(steps).fill('-');

      const row = document.createElement('div');
      row.className = 'oa-drums-seq-row';
      row.style.setProperty('--drum-color', pieceDef.color);

      const lbl = document.createElement('span');
      lbl.className = 'oa-drums-seq-label';
      lbl.innerHTML = `<span>${pieceDef.shortName}</span><kbd class="oa-drum-pad-key">${pieceDef.keyLabel}</kbd>`;
      row.appendChild(lbl);

      for (let s = 0; s < steps; s++) {
        const ch = arr[s] ?? '-';
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'oa-drums-seq-cell';
        cell.dataset.step = String(s);
        if (s % beatEvery === 0) cell.classList.add('is-beat-start');
        if (ch === 'x' || ch === 'X') cell.classList.add('is-on');
        if (ch === 'X') cell.classList.add('is-accent');
        if (s === playheadStep) cell.classList.add('is-playhead');
        cell.disabled = !editable;
        cell.setAttribute('aria-label', `${pieceDef.name} paso ${s + 1}`);

        if (editable) {
          cell.addEventListener('click', () => {
            const target = (this.customLanes[pieceDef.id] ??= Array(steps).fill('-'));
            target[s] = target[s] === '-' ? 'x' : target[s] === 'x' ? 'X' : '-';
            if (target[s] !== '-') synthAudio.playDrum(pieceDef.id, target[s] === 'X' ? 1.05 : 0.8);
            this.renderModeContent();
          });
        }

        row.appendChild(cell);
      }
      table.appendChild(row);
    }

    scroll.appendChild(table);
    host.appendChild(scroll);
  }

  private startGuidedSession(): void {
    this.stopDrumLoops();
    if (!this.isPractice) {
      this.metronomeEnabled = true;
      this.metroWidget?.setActive(true);
    }
    this.guidedTotalBars = 4;
    this.guidedBarCounter = 0;
    this.guidedLastStep = -1;
    this.guidedElapsedSec = 0;
    this.guidedFinishPending = false;
    this.guidedEndGraceSec = 0;

    if (this.guidedWaitMode) {
      this.guidedRunning = true;
      this.waitStepIndex = 0;
      this.advanceWaitToNextActiveStep(0);
      this.renderModeContent();
      return;
    }

    const barsToBuild = this.isInfinite ? 2 : this.guidedTotalBars;
    this.buildGuidedTargetsForBars(barsToBuild, 0);
    this.guidedRunning = true;
    this.renderModeContent();
  }

  private buildGuidedTargetsForBars(barCount: number, baseBarOffset: number): void {
    const g = DRUM_GROOVES[this.grooveIdx];
    const events = buildGrooveTimeline(g, barCount);
    const secPerBeat = 60 / (this.bpm * this.tempoScale);
    const startOffsetSec = this.guidedElapsedSec + 0.35;

    this.guidedTargets = events.map((ev) => ({
      ...ev,
      timeSec: startOffsetSec + ev.beat * secPerBeat,
      barIndex: baseBarOffset + Math.floor(ev.beat / g.beatsPerBar),
      matched: false,
      missed: false,
    }));
  }

  private rescheduleGuidedTargetsRemaining(): void {
    const g = DRUM_GROOVES[this.grooveIdx];
    const secPerBeat = 60 / (this.bpm * this.tempoScale);
    const pending = this.guidedTargets.filter((t) => !t.matched && !t.missed && t.timeSec >= this.guidedElapsedSec);
    if (pending.length === 0) return;
    const firstBeat = pending[0].beat;
    const baseTime = Math.max(this.guidedElapsedSec + 0.08, pending[0].timeSec);
    for (const t of pending) {
      t.timeSec = baseTime + (t.beat - firstBeat) * secPerBeat;
      t.barIndex = Math.floor(t.beat / g.beatsPerBar);
    }
  }

  private advanceWaitToNextActiveStep(startFrom: number): void {
    const g = DRUM_GROOVES[this.grooveIdx];
    for (let offset = 0; offset < g.steps; offset++) {
      const idx = (startFrom + offset) % g.steps;
      const needed = new Set<DrumPieceId>();
      for (const p of DRUM_PIECES) {
        const ch = g.lanes[p.id]?.[idx];
        if (ch === 'x' || ch === 'X') needed.add(p.id);
      }
      if (needed.size > 0) {
        this.waitStepIndex = idx;
        this.waitRemainingPieces = needed;
        return;
      }
    }
  }

  private triggerDrumHit(piece: DrumPieceId): void {
    synthAudio.playDrum(piece, 0.95);
    this.flashPad(piece);

    if (this.activeTab === 'free' && this.loopRecording) {
      const secPerBeat = 60 / this.bpm;
      this.loopRecorded.push({ piece, beatOffset: this.loopElapsedSec / secPerBeat });
      return;
    }

    if (this.activeTab !== 'guided' || !this.guidedRunning) return;

    if (this.guidedWaitMode) {
      if (this.waitRemainingPieces.has(piece)) {
        this.waitRemainingPieces.delete(piece);
        this.recordDrumGrade(piece, 'perfect', 15);
        if (this.waitRemainingPieces.size === 0) {
          const g = DRUM_GROOVES[this.grooveIdx];
          if (this.waitStepIndex + 1 >= g.steps) {
            this.barsCompleted += 1;
            synthAudio.puzzleSuccess(2);
          }
          this.advanceWaitToNextActiveStep((this.waitStepIndex + 1) % g.steps);
          this.renderModeContent();
        } else {
          this.refreshTargetPads();
        }
      } else {
        this.recordDrumMiss(piece, 'Pieza distinta');
      }
      return;
    }

    // Real-time tempo grading against nearest unmatched target of the same piece
    let best: ScheduledDrumTarget | null = null;
    let bestAbsMs = Infinity;
    let bestDeltaMs = 0;
    for (const t of this.guidedTargets) {
      if (t.matched || t.missed || t.piece !== piece) continue;
      const deltaMs = (this.guidedElapsedSec - t.timeSec) * 1000;
      const absMs = Math.abs(deltaMs);
      if (absMs < bestAbsMs) {
        bestAbsMs = absMs;
        bestDeltaMs = deltaMs;
        best = t;
      }
    }

    if (best && bestAbsMs <= 190) {
      best.matched = true;
      const grade = gradeTiming(bestDeltaMs);
      this.recordDrumGrade(piece, grade, bestDeltaMs);
      this.refreshTargetPads();
    } else {
      this.recordDrumMiss(piece, bestAbsMs < 400 ? 'Fuera de pulso' : 'Golpe extra');
    }
  }

  private recordDrumGrade(_piece: DrumPieceId, grade: HitGrade, deltaMs: number): void {
    this.hits += 1;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (grade === 'perfect') this.perfectHits += 1;
    else if (grade === 'good') this.goodHits += 1;
    else if (grade === 'ok') this.okHits += 1;
    this.timingDeviationsMs.push(deltaMs);

    const pts = gradePoints(grade, this.combo);
    this.score += pts;
    this.ctx.addScore(pts, 1);

    this.setFeedback(
      grade === 'perfect' ? `Perfecto (${Math.round(deltaMs)} ms)` : grade === 'good' ? 'Bien' : 'A tiempo',
      grade === 'perfect' ? 'perfect' : 'good'
    );
    this.updateStatsCard();
  }

  private recordDrumMiss(_piece: DrumPieceId, reason: string): void {
    this.misses += 1;
    this.combo = 0;
    this.ctx.breakCombo();
    this.setFeedback(reason, 'miss');
    this.updateStatsCard();
  }

  private setFeedback(text: string, tone: 'neutral' | 'perfect' | 'good' | 'miss'): void {
    this.lastFeedbackText = text;
    this.lastFeedbackTone = tone;
    if (!this.feedbackEl) return;
    this.feedbackEl.textContent = text;
    this.feedbackEl.className = `oa-drums-feedback-pill${tone !== 'neutral' ? ` is-${tone}` : ''}`;
  }

  private flashPad(piece: DrumPieceId): void {
    const btn = this.padButtons.get(piece);
    if (!btn) return;
    btn.classList.remove('is-hit');
    void btn.offsetWidth;
    btn.classList.add('is-hit');
    const prev = this.padFlashTimers.get(piece);
    if (prev !== undefined) window.clearTimeout(prev);
    const id = window.setTimeout(() => {
      btn.classList.remove('is-hit');
      this.padFlashTimers.delete(piece);
    }, 120);
    this.padFlashTimers.set(piece, id);
  }

  private clearTargetPads(): void {
    for (const btn of this.padButtons.values()) {
      btn.classList.remove('is-target');
    }
  }

  private refreshTargetPads(): void {
    this.clearTargetPads();
    if (this.activeTab !== 'guided' || !this.guidedRunning) return;
    if (this.guidedWaitMode) {
      for (const p of this.waitRemainingPieces) {
        this.padButtons.get(p)?.classList.add('is-target');
      }
      return;
    }
    for (const t of this.guidedTargets) {
      if (!t.matched && !t.missed && Math.abs(t.timeSec - this.guidedElapsedSec) <= 0.16) {
        this.padButtons.get(t.piece)?.classList.add('is-target');
      }
    }
  }

  private playGridStep(stepIdx: number, lanesOverride?: Partial<Record<DrumPieceId, string>>): void {
    const source = lanesOverride ?? this.customLanes;
    for (const p of DRUM_PIECES) {
      const ch = source[p.id]?.[stepIdx];
      if (ch === 'x' || ch === 'X') {
        synthAudio.playDrum(p.id, ch === 'X' ? 1.05 : 0.8);
        this.flashPad(p.id);
      }
    }
  }

  private highlightSeqPlayhead(step: number): void {
    if (!this.seqHostEl) return;
    this.seqHostEl.querySelectorAll('.oa-drums-seq-cell.is-playhead').forEach((el) => {
      el.classList.remove('is-playhead');
    });
    this.seqHostEl.querySelectorAll(`.oa-drums-seq-cell[data-step="${step}"]`).forEach((el) => {
      el.classList.add('is-playhead');
    });
  }

  private stopDrumLoops(): void {
    this.groovePlaying = false;
    this.loopRecording = false;
    this.loopPlaying = false;
    this.guidedRunning = false;
    synthAudio.stopAllNotes();
  }

  private updateStatsCard(): void {
    if (!this.statsCardEl) return;
    renderMusicStatsCard(this.statsCardEl, this.ctx, {
      hits: this.hits,
      misses: this.misses,
      maxCombo: this.maxCombo,
      extraLine: this.barsCompleted > 0 ? `Compases: <strong>${this.barsCompleted}</strong>` : undefined,
      subStatPrefix: `${Math.round(this.bpm)} BPM`,
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed || shouldIgnoreGameHotkey(e)) return;
    const piece = DRUM_PIECE_BY_CODE.get(e.code);
    if (piece) {
      e.preventDefault();
      if (e.repeat) return;
      this.triggerDrumHit(piece.id);
    }
  };

  private onWindowBlur = (): void => {
    for (const timer of this.padFlashTimers.values()) {
      window.clearTimeout(timer);
    }
    this.padFlashTimers.clear();
    for (const btn of this.padButtons.values()) {
      btn.classList.remove('is-hit');
    }
    this.metroWidget?.clearPulse();
    synthAudio.stopAllNotes();
  };

  public update(dt: number, _elapsed: number): void {
    if (this.paused || this.destroyed) return;

    // Metronome
    if (this.metronomeEnabled) {
      const metroBeats =
        this.activeTab === 'grooves' || this.activeTab === 'guided'
          ? DRUM_GROOVES[this.grooveIdx].beatsPerBar
          : this.activeTab === 'independence'
            ? DRUM_INDEPENDENCE[this.indepIdx].beatsPerBar
            : 4;
      const beatDur = 60 / (this.bpm * this.tempoScale);
      this.metroTimerSec += dt;
      if (this.metroTimerSec >= beatDur) {
        this.metroTimerSec -= beatDur;
        this.metroBeatCount = (this.metroBeatCount + 1) % metroBeats;
        const accent = this.metroBeatCount === 0;
        synthAudio.playMetronomeClick(accent);
        this.metroWidget?.flashBeat(accent);
      }
    }

    // 2-bar loop recorder / playback in Kit Libre
    if (this.activeTab === 'free' && this.loopRecording) {
      this.loopElapsedSec += dt;
      const totalLoopSec = (8 * 60) / this.bpm;
      if (this.loopElapsedSec >= totalLoopSec) {
        this.loopRecording = false;
        this.loopPlaying = this.loopRecorded.length > 0;
        this.loopElapsedSec = 0;
        this.loopPlayCursor = 0;
        this.loopRecorded.sort((a, b) => a.beatOffset - b.beatOffset);
        this.renderModeContent();
      }
    } else if (this.activeTab === 'free' && this.loopPlaying && this.loopRecorded.length > 0) {
      this.loopElapsedSec += dt;
      const secPerBeat = 60 / this.bpm;
      const totalLoopSec = 8 * secPerBeat;
      while (
        this.loopPlayCursor < this.loopRecorded.length &&
        this.loopElapsedSec >= this.loopRecorded[this.loopPlayCursor].beatOffset * secPerBeat
      ) {
        const hit = this.loopRecorded[this.loopPlayCursor];
        synthAudio.playDrum(hit.piece, 0.9);
        this.flashPad(hit.piece);
        this.loopPlayCursor += 1;
      }
      if (this.loopElapsedSec >= totalLoopSec) {
        this.loopElapsedSec -= totalLoopSec;
        this.loopPlayCursor = 0;
      }
    }

    // Sequencer preview in Grooves / Independence
    if ((this.activeTab === 'grooves' || this.activeTab === 'independence') && this.groovePlaying) {
      const item =
        this.activeTab === 'grooves' ? DRUM_GROOVES[this.grooveIdx] : DRUM_INDEPENDENCE[this.indepIdx];
      const stepSec = grooveStepBeats(item) * (60 / (this.bpm * this.tempoScale));
      this.groovePlayTimer += dt;
      if (this.groovePlayTimer >= stepSec) {
        this.groovePlayTimer -= stepSec;
        this.groovePlayStep = (this.groovePlayStep + 1) % item.steps;
        this.playGridStep(
          this.groovePlayStep,
          this.activeTab === 'independence' ? DRUM_INDEPENDENCE[this.indepIdx].lanes : undefined
        );
        this.highlightSeqPlayhead(this.groovePlayStep);
      }
    }

    // Guided tempo execution
    if (this.activeTab === 'guided' && this.guidedRunning && !this.guidedWaitMode) {
      this.guidedElapsedSec += dt;
      const g = DRUM_GROOVES[this.grooveIdx];
      const secPerBeat = 60 / (this.bpm * this.tempoScale);
      const stepSec = grooveStepBeats(g) * secPerBeat;

      // Visual playhead & bar tracking
      const relTime = Math.max(0, this.guidedElapsedSec - 0.35);
      const absStep = Math.floor(relTime / stepSec);
      const stepMod = absStep % g.steps;
      const curBar = Math.floor(absStep / g.steps);
      if (curBar !== this.guidedBarCounter) {
        this.guidedBarCounter = curBar;
        const badge = this.modeToolbarEl?.querySelector('#oa-drums-bar-badge');
        if (badge && !this.isInfinite) {
          badge.textContent = `${g.title} · Compás ${Math.min(this.guidedBarCounter + 1, this.guidedTotalBars)}/${this.guidedTotalBars}`;
        }
      }
      if (stepMod !== this.guidedLastStep) {
        this.guidedLastStep = stepMod;
        this.highlightSeqPlayhead(stepMod);
      }

      // Check missed targets (> 190ms past)
      for (const t of this.guidedTargets) {
        if (!t.matched && !t.missed && this.guidedElapsedSec - t.timeSec > 0.195) {
          t.missed = true;
          this.misses += 1;
          this.combo = 0;
          this.ctx.breakCombo();
          this.setFeedback('Golpe perdido', 'miss');
          this.updateStatsCard();
        }
      }
      this.refreshTargetPads();

      const allDone = this.guidedTargets.every((t) => t.matched || t.missed);
      if (allDone) {
        if (this.isInfinite) {
          this.barsCompleted += 2;
          this.bpm = Math.min(160, this.bpm + 4);
          this.ctx.toast(`¡Resistencia! +4 BPM (${Math.round(this.bpm)} BPM)`, 'accent');
          this.buildGuidedTargetsForBars(2, this.barsCompleted);
          this.renderModeContent();
        } else if (!this.isPractice) {
          if (!this.guidedFinishPending) {
            this.guidedFinishPending = true;
            this.guidedEndGraceSec = 0.25;
          } else {
            this.guidedEndGraceSec -= dt;
            if (this.guidedEndGraceSec <= 0) {
              this.finishChallengeRun();
            }
          }
        } else {
          // Practice loop restarts next cycle smoothly
          this.barsCompleted += this.guidedTotalBars;
          this.buildGuidedTargetsForBars(this.guidedTotalBars, this.barsCompleted);
        }
      }
    }
  }

  private finishChallengeRun(): void {
    if (this.finishedEmitted) return;
    this.finishedEmitted = true;
    this.guidedRunning = false;
    synthAudio.puzzleSuccess(4);

    const summary = summarizeMusicRun({
      hits: this.hits,
      misses: this.misses,
      perfect: this.perfectHits,
      good: this.goodHits,
      ok: this.okHits,
      totalTargets: Math.max(1, this.guidedTargets.length),
      timingDeviationsMs: this.timingDeviationsMs,
      maxCombo: this.maxCombo,
    });

    this.ctx.finish({
      score: Math.max(this.score, summary.score),
      maxCombo: this.maxCombo,
      accuracy: summary.accuracy,
      hits: this.hits,
      misses: this.misses,
      puzzlesSolved: this.guidedTotalBars,
      survived: true,
      infiniteMode: this.isInfinite,
      axisPerformances: {
        rhythm: summary.rhythmPerf,
      },
    });
  }

  public onResize(): void {
    // CSS handles responsive kit & grid
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.onWindowBlur();
    }
  }

  public getMetrics(): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const summary = summarizeMusicRun({
      hits: this.hits,
      misses: this.misses,
      perfect: this.perfectHits,
      good: this.goodHits,
      ok: this.okHits,
      totalTargets: Math.max(1, this.hits + this.misses),
      timingDeviationsMs: this.timingDeviationsMs,
      maxCombo: this.maxCombo,
    });
    return {
      score: Math.max(this.score, summary.score),
      maxCombo: this.maxCombo,
      accuracy: summary.accuracy,
      hits: this.hits,
      misses: this.misses,
      puzzlesSolved: this.barsCompleted,
      survived: true,
      infiniteMode: this.isInfinite,
      axisPerformances: {
        rhythm: summary.rhythmPerf,
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    this.stopDrumLoops();
    this.metronomeEnabled = false;
    this.metroWidget?.clearPulse();
    for (const timer of this.padFlashTimers.values()) {
      window.clearTimeout(timer);
    }
    this.padFlashTimers.clear();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('blur', this.onWindowBlur);
    synthAudio.stopAllNotes();
  }
}
