import { InstrumentTimbre, synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import { GameContext, MiniGame, RunMetrics } from '../types';
import { createAcademyLayout, createSectionTutorialEl, renderExplanationBox, SectionTutorialInfo } from '../ui/AcademyKit';
import {
  BASS_NATURAL_MIDIS,
  chordCueAtBeat,
  ChordQuality,
  describeChordEs,
  formatMidiNameEs,
  getStaffPosition,
  GUIDED_MELODIES,
  INTERVAL_DEFINITIONS,
  MELODY_LEVELS,
  MelodyLevel,
  melodyNoteStarts,
  PIANO_KEY_BY_CODE,
  PIANO_KEY_BY_MIDI,
  PIANO_KEYS,
  PIANO_PROGRESSIONS,
  PIANO_TEMPO_SCALES,
  PianoClef,
  TREBLE_NATURAL_MIDIS,
  WHITE_KEY_COUNT,
} from './piano/pianoBank';
import { gradePoints, gradeTiming, HitGrade, summarizeMusicRun } from './music/musicScore';
import {
  createActionButton,
  createMetronomeControl,
  MetronomeWidget,
  renderMusicStatsCard,
  shouldIgnoreGameHotkey,
} from './music/musicUi';
import '../styles/academy-rubik-piano.css';
import '../styles/academy-music.css';

type PianoModeTab = 'free' | 'melody' | 'progressions' | 'ear' | 'staff';
type LabelDisplayMode = 'names' | 'keys' | 'both';
type FreeSubMode = 'single' | 'chord';
type EarSubMode = 'intervals' | 'singleNote';
type ChallengeKind = 'piece' | 'progression' | 'exam';

interface EarQuestion {
  kind: 'interval' | 'single';
  baseMidi: number;
  targetMidi: number;
  semitones: number;
  answered: boolean;
}

interface StaffQuestion {
  clef: PianoClef;
  midi: number;
  elapsedSec: number;
  hintShown: boolean;
  answered: boolean;
}

const TIMBRE_OPTIONS: { id: InstrumentTimbre; label: string }[] = [
  { id: 'piano', label: 'Piano' },
  { id: 'organ', label: 'Órgano' },
  { id: 'soft', label: 'Suave' },
  { id: 'bell', label: 'Campana' },
];

export class PianoEar2DGame implements MiniGame {
  public readonly id = 'piano2d' as const;

  private ctx!: GameContext;
  private readonly isGauntletSlice: boolean;
  private isPractice = false;
  private isInfinite = false;
  private paused = false;
  private destroyed = false;
  private finishedEmitted = false;

  // Settings / UI state
  private activeTab: PianoModeTab = 'free';
  private timbre: InstrumentTimbre = 'piano';
  private labelMode: LabelDisplayMode = 'both';
  private freeSubMode: FreeSubMode = 'single';
  private chordQuality: ChordQuality = 'major';
  private earSubMode: EarSubMode = 'intervals';
  private staffClefChoice: PianoClef = 'treble';

  // Tempo & Metronome
  private tempoScale = 1.0;
  private metronomeEnabled = false;
  private metroTimerSec = 0;
  private metroBeatCount = 0;
  private metroWidget: MetronomeWidget | null = null;

  // Challenge flow
  private challengeKind: ChallengeKind = 'piece';
  private challengeLevel = 1; // 0: Novato, 1: Estándar, 2: Maestro
  private challengeStage: 'prep' | 'melody' | 'progression' | 'ear' | 'staff' | 'done' = 'prep';
  private challengeEarDone = 0;
  private challengeStaffDone = 0;
  private readonly challengeEarTotal = 10;
  private readonly challengeStaffTotal = 10;

  // Scoring / accuracy tracking
  private hits = 0;
  private misses = 0;
  private perfectHits = 0;
  private goodHits = 0;
  private okHits = 0;
  private timingDeviationsMs: number[] = [];
  private rhythmHits = 0;
  private rhythmTotal = 0;
  private earHits = 0;
  private earTotal = 0;
  private staffHits = 0;
  private staffTotal = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private piecesCompleted = 0;

  // Melody mode state
  private levelFilter: 'Todas' | MelodyLevel = 'Todas';
  private melodyIdx = 0;
  private melodyStep = 0;
  private melodyRunning = false;
  private melodyAutoAccomp = true;
  private melodyPracticeWait = true;
  private melodyBeatTimer = 0;
  private melodyBeatDuration = 0.55;
  private melodyStepHit = false;
  private melodyNoteStartsCache: number[] = [];
  private lastAccompCueBeat = -1;

  // Preview playback (driven by update(dt) for instant pause/stop)
  private previewActive = false;
  private previewKind: 'melody' | 'progression' = 'melody';
  private previewIndex = 0;
  private previewElapsedSec = 0;
  private previewStartsSec: number[] = [];
  private previewLastChordBeat = -1;

  // Progressions mode state
  private progIdx = 0;
  private progStep = 0;
  private progMatchedPcs = new Set<number>();
  private progRunning = false;
  private progBeatTimer = 0;
  private progBeatDuration = 2.0;
  private progStepHit = false;

  // Ear & Staff state
  private currentEarQ: EarQuestion | null = null;
  private currentStaffQ: StaffQuestion | null = null;
  private wrongFlashMidi: number | null = null;
  private wrongFlashTimer = 0;
  private nextQuestionTimer: number | null = null;

  // Polyphonic active input maps
  private activePointerNotes = new Map<number, number>();
  private activeKeyCodes = new Map<string, number>();
  private chordHighlightMidis = new Set<number>();

  // DOM refs
  private stageEl!: HTMLDivElement;
  private sideEl!: HTMLElement;
  private tabsHostEl: HTMLDivElement | null = null;
  private modeToolbarEl: HTMLDivElement | null = null;
  private displayPanelEl: HTMLDivElement | null = null;
  private keyButtons = new Map<number, HTMLButtonElement>();
  private tutorialHostEl: HTMLDivElement | null = null;
  private explainHostEl: HTMLDivElement | null = null;
  private statsCardEl: HTMLDivElement | null = null;
  private tempoFillEl: HTMLDivElement | null = null;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.isPractice = ctx.practiceMode === true;
    this.isInfinite = ctx.infiniteMode === true && !this.isPractice && !this.isGauntletSlice;
    this.destroyed = false;
    this.finishedEmitted = false;
    this.activePointerNotes.clear();
    this.activeKeyCodes.clear();
    this.chordHighlightMidis.clear();

    this.tempoScale =
      ctx.difficulty === 'chill'
        ? 0.85
        : ctx.difficulty === 'hyper'
          ? 1.2
          : ctx.difficulty === 'progressive'
            ? 0.85
            : 1.0;

    this.challengeLevel =
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

    const layout = createAcademyLayout(
      ctx.container,
      'PIANO MAESTRO Y OÍDO',
      this.isPractice ? 'PRÁCTICA GUIADA' : this.isInfinite ? 'JAM INFINITO' : 'MODO RETO'
    );
    this.stageEl = layout.stageEl;
    this.sideEl = layout.sideEl;

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: this.isPractice
        ? 'PIANO MAESTRO · PRÁCTICA'
        : this.isInfinite
          ? 'PIANO MAESTRO · JAM INFINITO'
          : this.isGauntletSlice
            ? 'PIANO MAESTRO · CIRCUITO'
            : 'PIANO MAESTRO · RETO',
      accent: '#9333EA',
      timeLeftSec: null,
      subStat: `${GUIDED_MELODIES.length} piezas · Do3–Do5`,
    });

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);

    if (this.isPractice) {
      this.activeTab = 'free';
      this.buildWorkspace();
      this.syncControlsBar();
      this.renderModeContent();
    } else if (this.isInfinite) {
      this.challengeKind = 'piece';
      this.challengeStage = 'melody';
      this.activeTab = 'melody';
      this.melodyIdx = 0;
      this.buildWorkspace();
      this.startMelody(true);
      this.syncControlsBar();
    } else {
      this.challengeStage = 'prep';
      this.renderChallengePrep();
    }
  }

  private renderChallengePrep(): void {
    this.stageEl.innerHTML = '';
    this.sideEl.querySelectorAll('.oa-piano-dyn-card').forEach((n) => n.remove());

    const prep = document.createElement('div');
    prep.className = 'oa-rp-prep-card';
    prep.innerHTML = `
      <h3 class="oa-rp-prep-title">Elige tu Reto de Piano</h3>
      <p class="oa-rp-prep-desc">
        Los fallos rompen el combo y bajan precisión, pero <strong>nunca te cortan la canción</strong> a mitad.
      </p>
      <div class="oa-rp-choice-row" id="oa-piano-kind-row" role="group" aria-label="Tipo de reto"></div>
      <div id="oa-piano-prep-config"></div>
      <button type="button" class="oa-rp-primary-btn" id="oa-piano-start-challenge">
        ${Icons.play(18)}<span>Empezar Reto Musical</span>
      </button>
    `;

    const kindRow = prep.querySelector('#oa-piano-kind-row')!;
    const configHost = prep.querySelector('#oa-piano-prep-config')!;

    const kinds: { id: ChallengeKind; label: string }[] = [
      { id: 'piece', label: `1. Elegir Pieza (${GUIDED_MELODIES.length})` },
      { id: 'progression', label: `2. Progresiones (${PIANO_PROGRESSIONS.length})` },
      { id: 'exam', label: '3. Examen Completo' },
    ];

    const renderConfig = () => {
      configHost.innerHTML = '';
      if (this.challengeKind === 'piece') {
        const sel = document.createElement('select');
        sel.className = 'oa-mus-select';
        sel.setAttribute('aria-label', 'Elegir pieza del catálogo');
        GUIDED_MELODIES.forEach((m, idx) => {
          const opt = document.createElement('option');
          opt.value = String(idx);
          opt.textContent = `[${m.level}] ${m.title} · ${m.genre} (${m.bpm} BPM)`;
          if (idx === this.melodyIdx) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', () => {
          this.melodyIdx = Number(sel.value);
        });

        const tempoRow = document.createElement('div');
        tempoRow.className = 'oa-rp-choice-row';
        tempoRow.style.marginTop = '8px';
        PIANO_TEMPO_SCALES.forEach((sc) => {
          tempoRow.appendChild(
            createActionButton({
              label: `${sc}x`,
              pressed: Math.abs(this.tempoScale - sc) < 0.01,
              onClick: () => {
                synthAudio.uiClick();
                this.tempoScale = sc;
                renderConfig();
              },
            })
          );
        });
        configHost.append(sel, tempoRow);
      } else if (this.challengeKind === 'progression') {
        const sel = document.createElement('select');
        sel.className = 'oa-mus-select';
        sel.setAttribute('aria-label', 'Elegir progresión');
        PIANO_PROGRESSIONS.forEach((p, idx) => {
          const opt = document.createElement('option');
          opt.value = String(idx);
          opt.textContent = `${p.title} (${p.genre} · ${p.bpm} BPM)`;
          if (idx === this.progIdx) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', () => {
          this.progIdx = Number(sel.value);
        });
        configHost.appendChild(sel);
      } else {
        const info = document.createElement('p');
        info.className = 'oa-rp-prep-desc';
        info.textContent =
          'Examen Completo de 3 etapas: 1) Melodía a tempo, 2) 10 intervalos de oído y 3) 10 lecturas en pentagrama.';
        const row = document.createElement('div');
        row.className = 'oa-rp-choice-row';
        row.style.marginTop = '8px';
        const levels = [
          { idx: 0, label: 'Novato (Sol · 0.85x)' },
          { idx: 1, label: 'Estándar (Sol y Fa · 1.0x)' },
          { idx: 2, label: 'Maestro (Sol y Fa · 1.2x)' },
        ];
        levels.forEach((lvl) => {
          row.appendChild(
            createActionButton({
              label: lvl.label,
              pressed: lvl.idx === this.challengeLevel,
              onClick: () => {
                synthAudio.uiClick();
                this.challengeLevel = lvl.idx;
                renderConfig();
              },
            })
          );
        });
        configHost.append(info, row);
      }
    };

    kinds.forEach((k) => {
      const btn = createActionButton({
        label: k.label,
        pressed: k.id === this.challengeKind,
        onClick: () => {
          synthAudio.uiClick();
          this.challengeKind = k.id;
          kindRow.querySelectorAll('button').forEach((b, idx) => {
            b.setAttribute('aria-pressed', kinds[idx].id === this.challengeKind ? 'true' : 'false');
          });
          renderConfig();
        },
      });
      kindRow.appendChild(btn);
    });

    renderConfig();

    prep.querySelector('#oa-piano-start-challenge')!.addEventListener('click', () => {
      synthAudio.uiClick();
      if (this.challengeKind === 'progression') {
        this.challengeStage = 'progression';
        this.activeTab = 'progressions';
        this.buildWorkspace();
        this.startProgression(true);
      } else if (this.challengeKind === 'piece') {
        this.challengeStage = 'melody';
        this.activeTab = 'melody';
        this.buildWorkspace();
        this.startMelody(true);
      } else {
        this.challengeStage = 'melody';
        this.challengeEarDone = 0;
        this.challengeStaffDone = 0;
        this.activeTab = 'melody';
        this.melodyIdx = this.challengeLevel % GUIDED_MELODIES.length;
        this.tempoScale = this.challengeLevel === 0 ? 0.85 : this.challengeLevel === 2 ? 1.2 : 1.0;
        this.buildWorkspace();
        this.startMelody(true);
      }
      this.syncControlsBar();
    });

    this.stageEl.appendChild(prep);

    const card = document.createElement('div');
    card.className = 'oa-academy-card oa-piano-dyn-card';
    const ex = document.createElement('div');
    renderExplanationBox(
      ex,
      'Controles rápidos',
      'Usa tu teclado (Z–M para Do3–Si3 y Q–I para Do4–Do5) o toca las teclas en pantalla.',
      'info'
    );
    card.appendChild(ex);

    const tutWrap = document.createElement('div');
    tutWrap.className = 'oa-piano-dyn-card';
    tutWrap.appendChild(
      createSectionTutorialEl({
        id: 'piano:prep',
        sectionName: 'Tutorial: Reto de Piano',
        steps: [
          `Elige entre ${GUIDED_MELODIES.length} melodías guiadas, ${PIANO_PROGRESSIONS.length} progresiones de acordes o el Examen Completo de 3 etapas.`,
          'Ajusta la escala de tempo (0.65x a 1.2x) antes de arrancar si deseas estudiar una pieza compleja más lento.',
          'Pulsa Empezar Reto Musical: los fallos rompen el combo pero nunca cortan tu canción.',
        ],
        tip: 'Puedes practicar primero cualquier canción en Práctica Guiada con Espera tu nota.',
      })
    );
    this.sideEl.append(tutWrap, card);

    this.syncControlsBar();
  }

  private buildWorkspace(): void {
    this.stageEl.innerHTML = '';
    this.sideEl.querySelectorAll('.oa-piano-dyn-card').forEach((n) => n.remove());
    this.keyButtons.clear();

    const stageCard = document.createElement('div');
    stageCard.className = 'oa-rp-stage-card';

    const topToolbar = document.createElement('div');
    topToolbar.className = 'oa-piano-toolbar';

    const tabsHost = document.createElement('div');
    tabsHost.className = 'oa-piano-tabs';
    tabsHost.setAttribute('role', 'tablist');
    this.tabsHostEl = tabsHost;

    const globalControls = document.createElement('div');
    globalControls.className = 'oa-piano-tabs';

    const labelModes: { id: LabelDisplayMode; label: string }[] = [
      { id: 'names', label: 'Nombres' },
      { id: 'keys', label: 'Teclas' },
      { id: 'both', label: 'Ambos' },
    ];
    labelModes.forEach((lm) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-rp-pill-btn';
      btn.dataset.labelMode = lm.id;
      btn.textContent = lm.label;
      btn.setAttribute('aria-pressed', lm.id === this.labelMode ? 'true' : 'false');
      btn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.labelMode = lm.id;
        this.refreshKeyLabels();
        globalControls.querySelectorAll('[data-label-mode]').forEach((el) => {
          el.setAttribute(
            'aria-pressed',
            (el as HTMLElement).dataset.labelMode === this.labelMode ? 'true' : 'false'
          );
        });
      });
      globalControls.appendChild(btn);
    });

    const timbreSelect = document.createElement('select');
    timbreSelect.className = 'oa-rp-pill-btn';
    timbreSelect.setAttribute('aria-label', 'Timbre de instrumento');
    TIMBRE_OPTIONS.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.id;
      o.textContent = `Timbre: ${opt.label}`;
      if (opt.id === this.timbre) o.selected = true;
      timbreSelect.appendChild(o);
    });
    timbreSelect.addEventListener('change', () => {
      this.timbre = timbreSelect.value as InstrumentTimbre;
      synthAudio.playMidiNote(60, 0.35, this.timbre);
    });
    globalControls.appendChild(timbreSelect);

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
    globalControls.appendChild(this.metroWidget.root);

    topToolbar.append(tabsHost, globalControls);

    const modeToolbar = document.createElement('div');
    modeToolbar.className = 'oa-piano-toolbar';
    this.modeToolbarEl = modeToolbar;

    const displayPanel = document.createElement('div');
    displayPanel.className = 'oa-piano-display-panel';
    this.displayPanelEl = displayPanel;

    const pianoScroll = this.buildKeyboardElement();

    stageCard.append(topToolbar, modeToolbar, displayPanel, pianoScroll);
    this.stageEl.appendChild(stageCard);

    const tutorialHost = document.createElement('div');
    tutorialHost.className = 'oa-piano-dyn-card';
    this.tutorialHostEl = tutorialHost;

    const explainCard = document.createElement('div');
    explainCard.className = 'oa-academy-card oa-piano-dyn-card';
    const explainHost = document.createElement('div');
    this.explainHostEl = explainHost;
    explainCard.appendChild(explainHost);

    const statsCard = document.createElement('div');
    statsCard.className = 'oa-academy-card oa-piano-dyn-card';
    this.statsCardEl = statsCard;

    this.sideEl.append(tutorialHost, explainCard, statsCard);

    this.renderTabs();
    this.refreshKeyLabels();
    this.updateStatsCard();
  }

  private buildKeyboardElement(): HTMLDivElement {
    const scroll = document.createElement('div');
    scroll.className = 'oa-piano-scroll';

    const keyboard = document.createElement('div');
    keyboard.className = 'oa-piano-keyboard';
    keyboard.setAttribute('role', 'group');
    keyboard.setAttribute('aria-label', 'Teclado de piano de dos octavas Do3 a Do5');

    const whitesWrap = document.createElement('div');
    whitesWrap.className = 'oa-piano-whites';

    const whiteW = 100 / WHITE_KEY_COUNT;

    for (const k of PIANO_KEYS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `oa-piano-key ${k.isBlack ? 'oa-piano-key-black' : 'oa-piano-key-white'}`;
      btn.dataset.midi = String(k.midi);
      btn.setAttribute('aria-label', `${k.noteName} (tecla ${k.keyLabel})`);

      if (k.isBlack) {
        const blackWidthPct = whiteW * 0.62;
        const leftPct = (k.whiteIndex + 1) * whiteW - blackWidthPct / 2;
        btn.style.left = `calc(${leftPct.toFixed(3)}% + 3px)`;
        btn.style.width = `calc(${blackWidthPct.toFixed(3)}% - 2px)`;
      }

      const noteLbl = document.createElement('span');
      noteLbl.className = 'oa-piano-note-lbl';
      noteLbl.textContent = k.midi % 12 === 0 ? k.noteName : k.shortName;

      const kbdLbl = document.createElement('kbd');
      kbdLbl.className = 'oa-piano-kbd-lbl';
      kbdLbl.textContent = k.keyLabel;

      btn.append(noteLbl, kbdLbl);

      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this.paused || this.destroyed) return;
        this.activePointerNotes.set(e.pointerId, k.midi);
        this.handleNotePress(`ptr_${e.pointerId}`, k.midi);
      });

      const releasePointer = (e: PointerEvent) => {
        const activeMidi = this.activePointerNotes.get(e.pointerId);
        if (activeMidi !== undefined) {
          this.activePointerNotes.delete(e.pointerId);
          this.handleNoteRelease(`ptr_${e.pointerId}`, activeMidi);
        }
      };

      btn.addEventListener('pointerup', releasePointer);
      btn.addEventListener('pointercancel', releasePointer);
      btn.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'mouse') {
          releasePointer(e);
        }
      });

      this.keyButtons.set(k.midi, btn);
      if (k.isBlack) {
        keyboard.appendChild(btn);
      } else {
        whitesWrap.appendChild(btn);
      }
    }

    keyboard.insertBefore(whitesWrap, keyboard.firstChild);
    scroll.appendChild(keyboard);
    return scroll;
  }

  private refreshKeyLabels(): void {
    for (const k of PIANO_KEYS) {
      const btn = this.keyButtons.get(k.midi);
      if (!btn) continue;
      const noteEl = btn.querySelector('.oa-piano-note-lbl') as HTMLElement | null;
      const kbdEl = btn.querySelector('.oa-piano-kbd-lbl') as HTMLElement | null;
      if (noteEl) noteEl.classList.toggle('is-hidden', this.labelMode === 'keys');
      if (kbdEl) kbdEl.classList.toggle('is-hidden', this.labelMode === 'names');
    }
  }

  private renderTabs(): void {
    if (!this.tabsHostEl) return;
    this.tabsHostEl.innerHTML = '';

    const tabs: { id: PianoModeTab; label: string }[] = [
      { id: 'free', label: '1. Piano Libre' },
      { id: 'melody', label: `2. ${GUIDED_MELODIES.length} Canciones` },
      { id: 'progressions', label: `3. ${PIANO_PROGRESSIONS.length} Progresiones` },
      { id: 'ear', label: '4. Oído Musical' },
      { id: 'staff', label: '5. Pentagrama' },
    ];

    tabs.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-rp-pill-btn';
      btn.setAttribute('role', 'tab');
      const isSelected = this.activeTab === t.id;
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      btn.classList.toggle('is-active', isSelected);

      if (!this.isPractice) {
        const allowed =
          (this.challengeStage === 'melody' && t.id === 'melody') ||
          (this.challengeStage === 'progression' && t.id === 'progressions') ||
          (this.challengeStage === 'ear' && t.id === 'ear') ||
          (this.challengeStage === 'staff' && t.id === 'staff');
        btn.disabled = !allowed;
        btn.title = allowed ? t.label : 'En Modo Reto sigue la etapa activa';
      }

      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        if (!this.isPractice) return;
        synthAudio.uiClick();
        this.stopPlayback();
        this.clearNextQuestionTimer();
        this.activeTab = t.id;
        this.melodyRunning = false;
        this.progRunning = false;
        this.chordHighlightMidis.clear();
        this.renderTabs();
        this.syncControlsBar();
        this.renderModeContent();
      });
      this.tabsHostEl!.appendChild(btn);
    });
  }

  private syncControlsBar(): void {
    if (this.activeTab === 'ear') {
      this.ctx.setControls?.([
        { keys: ['R'], touch: 'Botón Repetir', action: 'Volver a escuchar el intervalo', tone: 'primary' },
        { keys: ['Z–M', 'Q–I'], touch: 'Teclas del piano', action: 'Comprobar notas en el teclado' },
      ]);
      return;
    }
    if (this.activeTab === 'progressions') {
      this.ctx.setControls?.([
        { keys: ['Espacio'], touch: 'Clic en acorde', action: 'Tocar acorde completo (1 clic)', tone: 'primary' },
        { keys: ['Z–M', 'Q–I'], touch: 'Teclas iluminadas', action: 'Armar acorde tecla a tecla' },
      ]);
      return;
    }
    this.ctx.setControls?.([
      { keys: ['Z–M'], touch: 'Octava grave (Do3–Si3)', action: 'Tocar notas graves', tone: 'primary' },
      { keys: ['Q–I', '2 3 5 6 7'], touch: 'Octava aguda (Do4–Do5)', action: 'Tocar notas agudas', tone: 'primary' },
    ]);
  }

  private renderModeContent(): void {
    if (!this.modeToolbarEl || !this.displayPanelEl) return;
    this.modeToolbarEl.innerHTML = '';
    this.displayPanelEl.innerHTML = '';
    this.tempoFillEl = null;
    this.clearTargetHighlights();

    if (this.activeTab === 'free') {
      this.renderFreeAndChordsUI();
    } else if (this.activeTab === 'melody') {
      this.renderMelodyUI();
    } else if (this.activeTab === 'progressions') {
      this.renderProgressionsUI();
    } else if (this.activeTab === 'ear') {
      this.renderEarUI();
    } else {
      this.renderStaffUI();
    }
    this.renderSectionTutorial();
    this.refreshPianoHighlights();
  }

  private renderSectionTutorial(): void {
    if (!this.tutorialHostEl) return;
    const map: Record<PianoModeTab, SectionTutorialInfo> = {
      free: {
        id: 'piano:free',
        sectionName: 'Tutorial: Piano Libre y Acordes',
        steps: [
          'Toca libremente con teclas PC (Z–M para Do3–Si3 y Q–I para Do4–Do5) o haciendo clic en el teclado.',
          'Alterna entre Nota suelta (polifónico) y Modo Acordes para escuchar tríadas Mayor, menor o Séptima.',
          'Cambia el Timbre (Piano, Órgano, Suave, Campana) o activa el Metrónomo arriba cuando desees pulso fijo.',
        ],
        tip: 'En Modo Acordes, pulsa una tecla raíz (ej. Q = Do4) para iluminar y sonar el acorde completo.',
      },
      melody: {
        id: 'piano:melodies',
        sectionName: `Tutorial: ${GUIDED_MELODIES.length} Canciones Guiadas`,
        steps: [
          'Filtra por nivel (Inicial, Intermedio, Avanzado) y elige una obra del selector.',
          'Pulsa Escuchar ejemplo para oír la melodía completa junto con el acompañamiento armónico.',
          'Sigue la tecla dorada iluminada en Modo Espera tu nota o A tempo ajustando la escala (0.65x–1.2x).',
        ],
        tip: 'Empieza a 0.65x o 0.85x con Espera tu nota para memorizar digitaciones antes de ir a 1.0x.',
      },
      progressions: {
        id: 'piano:progressions',
        sectionName: `Tutorial: ${PIANO_PROGRESSIONS.length} Progresiones Armónicas`,
        steps: [
          'Selecciona una rueda real (Pop, Blues 12 compases, Bossa Nova, Cadencia Andaluza, Jazz).',
          'Pulsa Espacio o haz clic en la tarjeta del acorde actual para disparar el acorde completo.',
          'También puedes construir cada acorde pulsando una a una todas las teclas doradas iluminadas.',
        ],
        tip: 'Activa Practicar a tempo para entrenar cambios armónicos fluidos al compás.',
      },
      ear: {
        id: 'piano:ear',
        sectionName: 'Tutorial: Oído Musical',
        steps: [
          'Escucha el intervalo o la nota suelta que suena automáticamente al empezar cada pregunta.',
          'Pulsa Repetir (tecla R) u Oír juntas para comparar las dos alturas antes de decidir.',
          'Elige el intervalo correcto en la parrilla o pulsa la tecla exacta en el piano.',
        ],
        tip: 'Asocia cada intervalo a una melodía conocida: 4ª justa = marcha nupcial; 5ª justa = fanfarria.',
      },
      staff: {
        id: 'piano:staff',
        sectionName: 'Tutorial: Lectura en Pentagrama',
        steps: [
          'Alterna entre Clave de Sol (Do4–Do5) y Clave de Fa (Do3–Si3) en la barra superior.',
          'Identifica la línea o espacio de la nota azul y pulsa la tecla correspondiente en el piano.',
          'En práctica guiada, tras 3 segundos aparece una pista con el nombre y tecla de la nota.',
        ],
        tip: 'Usa dos notas ancla: 2ª línea en Clave de Sol = Sol4; 4ª línea en Clave de Fa = Fa3.',
      },
    };
    this.tutorialHostEl.innerHTML = '';
    this.tutorialHostEl.appendChild(createSectionTutorialEl(map[this.activeTab]));
  }

  // ==================== 1. PIANO LIBRE & ACORDES ====================
  private renderFreeAndChordsUI(): void {
    const left = document.createElement('div');
    left.className = 'oa-piano-tabs';

    left.append(
      createActionButton({
        label: 'Nota suelta',
        pressed: this.freeSubMode === 'single',
        onClick: () => {
          synthAudio.uiClick();
          this.freeSubMode = 'single';
          this.chordHighlightMidis.clear();
          this.renderModeContent();
        },
      }),
      createActionButton({
        label: 'Modo Acordes',
        pressed: this.freeSubMode === 'chord',
        onClick: () => {
          synthAudio.uiClick();
          this.freeSubMode = 'chord';
          this.renderModeContent();
        },
      })
    );
    this.modeToolbarEl!.appendChild(left);

    if (this.freeSubMode === 'chord') {
      const qualWrap = document.createElement('div');
      qualWrap.className = 'oa-piano-tabs';
      (['major', 'minor', 'seventh'] as ChordQuality[]).forEach((q) => {
        qualWrap.appendChild(
          createActionButton({
            label: q === 'major' ? 'Mayor' : q === 'minor' ? 'menor' : 'Séptima',
            pressed: this.chordQuality === q,
            onClick: () => {
              synthAudio.uiClick();
              this.chordQuality = q;
              this.renderModeContent();
            },
          })
        );
      });
      this.modeToolbarEl!.appendChild(qualWrap);
    }

    const heading = document.createElement('div');
    heading.className = 'oa-explain-heading';
    heading.textContent =
      this.freeSubMode === 'single'
        ? 'Piano Libre Polifónico (Do3–Do5)'
        : `Explorador de Acordes (${this.chordQuality === 'major' ? 'Mayor' : this.chordQuality === 'minor' ? 'menor' : 'Séptima'})`;

    const desc = document.createElement('p');
    desc.className = 'oa-explain-body';
    desc.textContent =
      this.freeSubMode === 'single'
        ? 'Pulsa varias teclas a la vez con el teclado del PC o pantalla táctil para escuchar armonías.'
        : 'Toca cualquier nota raíz: el piano sonará el acorde completo, iluminará sus teclas y mostrará sus notas.';

    this.displayPanelEl!.append(heading, desc);

    if (this.explainHostEl) {
      renderExplanationBox(
        this.explainHostEl,
        this.freeSubMode === 'single' ? 'Toca libremente' : 'Modo Acordes activo',
        this.freeSubMode === 'single'
          ? 'Explora las 2 octavas (Do3–Do5) o activa el Metrónomo arriba.'
          : 'Elige Mayor, menor o Séptima y pulsa una tecla raíz (ej. Do4 = tecla Q).',
        'info'
      );
    }
  }

  // ==================== 2. CANCIONES GUIADAS ====================
  private startMelody(autoTempo: boolean): void {
    this.stopPlayback();
    this.melodyStep = 0;
    this.melodyBeatTimer = 0;
    this.melodyStepHit = false;
    this.melodyRunning = autoTempo;
    const mel = GUIDED_MELODIES[this.melodyIdx];
    this.melodyNoteStartsCache = melodyNoteStarts(mel);
    this.lastAccompCueBeat = -1;
    const secPerBeat = 60 / (mel.bpm * this.tempoScale);
    this.melodyBeatDuration = mel.notes[0].beats * secPerBeat;
    if (autoTempo && this.melodyAutoAccomp) {
      this.triggerAccompCueIfNeeded(0);
    }
    this.renderModeContent();
  }

  private triggerAccompCueIfNeeded(beatPos: number): void {
    if (!this.melodyAutoAccomp) return;
    const mel = GUIDED_MELODIES[this.melodyIdx];
    const cue = chordCueAtBeat(mel, beatPos);
    if (cue && cue.beat !== this.lastAccompCueBeat) {
      this.lastAccompCueBeat = cue.beat;
      const midis = [
        cue.root,
        cue.root + (cue.quality === 'minor' ? 3 : 4),
        cue.root + 7,
      ];
      synthAudio.playChord(midis, 1.1, 'soft', 0.015);
    }
  }

  private renderMelodyUI(): void {
    const mel = GUIDED_MELODIES[this.melodyIdx];

    if (this.isPractice) {
      const levelWrap = document.createElement('div');
      levelWrap.className = 'oa-piano-tabs';
      const levels: ('Todas' | MelodyLevel)[] = ['Todas', ...MELODY_LEVELS];
      levels.forEach((lvl) => {
        levelWrap.appendChild(
          createActionButton({
            label: lvl === 'Todas' ? `Todas (${GUIDED_MELODIES.length})` : lvl,
            pressed: this.levelFilter === lvl,
            onClick: () => {
              synthAudio.uiClick();
              this.levelFilter = lvl;
              const filtered = GUIDED_MELODIES.map((m, i) => ({ m, i })).filter(
                (x) => lvl === 'Todas' || x.m.level === lvl
              );
              if (filtered.length > 0 && !filtered.some((x) => x.i === this.melodyIdx)) {
                this.melodyIdx = filtered[0].i;
              }
              this.startMelody(!this.melodyPracticeWait);
            },
          })
        );
      });
      this.modeToolbarEl!.appendChild(levelWrap);
    }

    const row = document.createElement('div');
    row.className = 'oa-mus-toolbar-group';

    const selector = document.createElement('select');
    selector.className = 'oa-mus-select';
    selector.setAttribute('aria-label', 'Elegir melodía guiada');
    selector.disabled = !this.isPractice;
    GUIDED_MELODIES.forEach((m, idx) => {
      if (this.isPractice && this.levelFilter !== 'Todas' && m.level !== this.levelFilter) return;
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = `[${m.level}] ${m.title} · ${m.genre} (${m.bpm} BPM)`;
      if (idx === this.melodyIdx) opt.selected = true;
      selector.appendChild(opt);
    });
    selector.addEventListener('change', () => {
      this.melodyIdx = Number(selector.value);
      this.startMelody(this.isPractice ? !this.melodyPracticeWait : true);
    });

    const restartBtn = createActionButton({
      label: 'Reiniciar',
      iconHtml: Icons.refresh(15),
      onClick: () => {
        synthAudio.uiClick();
        this.startMelody(this.isPractice ? !this.melodyPracticeWait : true);
      },
    });

    const previewBtn = createActionButton({
      label: this.previewActive && this.previewKind === 'melody' ? 'Detener ejemplo' : 'Escuchar ejemplo',
      iconHtml: Icons.volumeOn(15),
      pressed: this.previewActive && this.previewKind === 'melody',
      onClick: () => {
        if (this.previewActive && this.previewKind === 'melody') {
          this.stopPlayback();
        } else {
          this.startMelodyPreview();
        }
        this.renderModeContent();
      },
    });

    const accompBtn = createActionButton({
      label: 'Acompañamiento auto',
      pressed: this.melodyAutoAccomp,
      onClick: () => {
        synthAudio.uiClick();
        this.melodyAutoAccomp = !this.melodyAutoAccomp;
        this.renderModeContent();
      },
    });

    row.append(selector, restartBtn, previewBtn, accompBtn);

    if (this.isPractice) {
      row.appendChild(
        createActionButton({
          label: this.melodyPracticeWait ? 'Práctica: espera tu nota' : 'Práctica: a tempo',
          pressed: !this.melodyPracticeWait,
          onClick: () => {
            synthAudio.uiClick();
            this.melodyPracticeWait = !this.melodyPracticeWait;
            this.startMelody(!this.melodyPracticeWait);
          },
        })
      );
    }

    const tempoWrap = document.createElement('div');
    tempoWrap.className = 'oa-piano-tabs';
    PIANO_TEMPO_SCALES.forEach((sc) => {
      tempoWrap.appendChild(
        createActionButton({
          label: `${sc}x`,
          pressed: Math.abs(this.tempoScale - sc) < 0.01,
          onClick: () => {
            synthAudio.uiClick();
            this.tempoScale = sc;
            const curNote = GUIDED_MELODIES[this.melodyIdx].notes[this.melodyStep];
            if (curNote) {
              this.melodyBeatDuration =
                curNote.beats * (60 / (GUIDED_MELODIES[this.melodyIdx].bpm * this.tempoScale));
            }
            this.renderModeContent();
          },
        })
      );
    });

    this.modeToolbarEl!.append(row, tempoWrap);

    const headRow = document.createElement('div');
    headRow.className = 'oa-mus-toolbar-row';

    const head = document.createElement('div');
    head.className = 'oa-explain-heading';
    const currentNote = mel.notes[this.melodyStep];
    const keyInfo = currentNote ? PIANO_KEY_BY_MIDI.get(currentNote.midi) : undefined;
    head.textContent = currentNote
      ? `${mel.title} (${mel.level}) · Nota ${this.melodyStep + 1}/${mel.notes.length}: ${keyInfo?.noteName ?? formatMidiNameEs(currentNote.midi)} (tecla ${keyInfo?.keyLabel ?? '?'})`
      : `${mel.title} · Completada`;

    const currentBeat = this.melodyNoteStartsCache[this.melodyStep] ?? 0;
    const activeCue = chordCueAtBeat(mel, currentBeat);
    headRow.appendChild(head);
    if (activeCue) {
      const chordBadge = document.createElement('span');
      chordBadge.className = 'oa-mus-chord-badge';
      chordBadge.textContent = `Acorde: ${activeCue.label}`;
      headRow.appendChild(chordBadge);
    }

    const strip = document.createElement('div');
    strip.className = 'oa-piano-melody-strip';
    mel.notes.forEach((n, idx) => {
      const chip = document.createElement('span');
      chip.className = 'oa-piano-note-chip';
      if (idx < this.melodyStep) chip.classList.add('is-done');
      else if (idx === this.melodyStep) chip.classList.add('is-current');
      chip.textContent = formatMidiNameEs(n.midi, false);
      strip.appendChild(chip);
    });

    this.displayPanelEl!.append(headRow, strip);

    if (!this.isPractice || !this.melodyPracticeWait) {
      const track = document.createElement('div');
      track.className = 'oa-piano-tempo-track';
      const fill = document.createElement('div');
      fill.className = 'oa-piano-tempo-fill';
      this.tempoFillEl = fill;
      track.appendChild(fill);
      this.displayPanelEl!.appendChild(track);
    }

    if (this.explainHostEl) {
      renderExplanationBox(
        this.explainHostEl,
        this.isPractice && this.melodyPracticeWait
          ? 'Sigue la luz (espera tu nota)'
          : this.isInfinite
            ? `Jam Infinito · Piezas completadas: ${this.piecesCompleted}`
            : 'Toca al compás del metrónomo',
        this.isPractice && this.melodyPracticeWait
          ? `${mel.composer} (${mel.genre}). Toca la tecla dorada; activa Acompañamiento auto para oír la armonía.`
          : 'Sigue la tecla dorada antes de que avance la barra de pulso. Los errores no cortan la canción.',
        'info'
      );
    }
  }

  private startMelodyPreview(): void {
    this.stopPlayback();
    const mel = GUIDED_MELODIES[this.melodyIdx];
    const secPerBeat = 60 / (mel.bpm * this.tempoScale);
    const starts: number[] = [];
    let acc = 0;
    for (const n of mel.notes) {
      starts.push(acc);
      acc += n.beats * secPerBeat;
    }
    this.previewActive = true;
    this.previewKind = 'melody';
    this.previewIndex = 0;
    this.previewElapsedSec = 0;
    this.previewStartsSec = starts;
    this.previewLastChordBeat = -1;
  }

  // ==================== 3. PROGRESIONES DE ACORDES ====================
  private startProgression(autoTempo: boolean): void {
    this.stopPlayback();
    this.progStep = 0;
    this.progMatchedPcs.clear();
    this.progBeatTimer = 0;
    this.progStepHit = false;
    this.progRunning = autoTempo;
    const prog = PIANO_PROGRESSIONS[this.progIdx];
    const secPerBeat = 60 / (prog.bpm * this.tempoScale);
    this.progBeatDuration = prog.chords[0].beats * secPerBeat;
    this.renderModeContent();
  }

  private renderProgressionsUI(): void {
    const prog = PIANO_PROGRESSIONS[this.progIdx];

    const row = document.createElement('div');
    row.className = 'oa-mus-toolbar-group';

    const sel = document.createElement('select');
    sel.className = 'oa-mus-select';
    sel.setAttribute('aria-label', 'Elegir progresión armónica');
    sel.disabled = !this.isPractice;
    PIANO_PROGRESSIONS.forEach((p, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = `${p.title} (${p.genre} · ${p.bpm} BPM)`;
      if (idx === this.progIdx) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      this.progIdx = Number(sel.value);
      this.startProgression(!this.isPractice);
    });

    const playChordBtn = createActionButton({
      label: 'Tocar acorde actual (Espacio)',
      iconHtml: Icons.play(15),
      className: 'oa-rp-pill-btn is-active',
      onClick: () => this.triggerProgressionChordClick(),
    });

    const previewBtn = createActionButton({
      label: this.previewActive && this.previewKind === 'progression' ? 'Detener demo' : 'Escuchar progresión',
      iconHtml: Icons.volumeOn(15),
      pressed: this.previewActive && this.previewKind === 'progression',
      onClick: () => {
        if (this.previewActive && this.previewKind === 'progression') {
          this.stopPlayback();
        } else {
          this.startProgressionPreview();
        }
        this.renderModeContent();
      },
    });

    row.append(sel, playChordBtn, previewBtn);
    if (this.isPractice) {
      row.appendChild(
        createActionButton({
          label: this.progRunning ? 'Detener a tempo' : 'Practicar a tempo',
          pressed: this.progRunning,
          onClick: () => {
            synthAudio.uiClick();
            this.startProgression(!this.progRunning);
          },
        })
      );
    }
    this.modeToolbarEl!.appendChild(row);

    const activeChord = prog.chords[this.progStep];
    const head = document.createElement('div');
    head.className = 'oa-explain-heading';
    head.textContent = activeChord
      ? `${prog.title} · Acorde ${this.progStep + 1}/${prog.chords.length}: ${activeChord.label} (${activeChord.degree}) — ${activeChord.midis.map((m) => formatMidiNameEs(m, false)).join(' - ')}`
      : `${prog.title} · Completada`;

    const grid = document.createElement('div');
    grid.className = 'oa-mus-prog-grid';
    prog.chords.forEach((ch, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'oa-mus-prog-card';
      if (idx === this.progStep) card.classList.add('is-current');
      else if (idx < this.progStep) card.classList.add('is-done');
      card.innerHTML = `
        <span class="oa-mus-prog-deg">${ch.degree} · ${ch.beats} pulsos</span>
        <span class="oa-mus-prog-name">${ch.label}</span>
        <span class="oa-explain-body">${ch.midis.map((m) => formatMidiNameEs(m, false)).join(' ')}</span>
      `;
      card.addEventListener('click', () => {
        if (idx === this.progStep) {
          this.triggerProgressionChordClick();
        } else {
          synthAudio.playChord(ch.midis, 0.9, this.timbre, 0.02);
        }
      });
      grid.appendChild(card);
    });

    this.displayPanelEl!.append(head, grid);

    if (!this.isPractice || this.progRunning) {
      const track = document.createElement('div');
      track.className = 'oa-piano-tempo-track';
      const fill = document.createElement('div');
      fill.className = 'oa-piano-tempo-fill';
      this.tempoFillEl = fill;
      track.appendChild(fill);
      this.displayPanelEl!.appendChild(track);
    }

    if (this.explainHostEl) {
      renderExplanationBox(
        this.explainHostEl,
        prog.title,
        `${prog.description} Toca Espacio/clic para disparar el acorde entero o pulsa sus teclas iluminadas una a una.`,
        'info'
      );
    }
  }

  private triggerProgressionChordClick(): void {
    const prog = PIANO_PROGRESSIONS[this.progIdx];
    const ch = prog.chords[this.progStep];
    if (!ch) return;
    synthAudio.playChord(ch.midis, 1.0, this.timbre, 0.02);
    this.completeProgressionStep();
  }

  private evaluateProgressionKey(midi: number): void {
    const prog = PIANO_PROGRESSIONS[this.progIdx];
    const ch = prog.chords[this.progStep];
    if (!ch) return;
    const pc = ((midi % 12) + 12) % 12;
    const neededPcs = new Set(ch.midis.map((m) => ((m % 12) + 12) % 12));
    if (neededPcs.has(pc)) {
      this.progMatchedPcs.add(pc);
      if (this.progMatchedPcs.size >= neededPcs.size) {
        this.completeProgressionStep();
      } else {
        this.refreshPianoHighlights();
      }
    } else {
      this.misses += 1;
      this.combo = 0;
      this.ctx.breakCombo();
      this.flashWrongKey(midi);
      this.updateStatsCard();
    }
  }

  private completeProgressionStep(): void {
    if (this.progStepHit) return;
    this.progStepHit = true;
    const deltaMs = this.progRunning
      ? Math.round((this.progBeatTimer / Math.max(0.2, this.progBeatDuration)) * 120)
      : 20;
    const grade: HitGrade = this.progRunning ? gradeTiming(deltaMs) : 'perfect';
    this.recordMusicHit(grade, deltaMs);

    if (!this.progRunning) {
      this.advanceProgressionStep();
    } else {
      this.updateStatsCard();
    }
  }

  private advanceProgressionStep(): void {
    const prog = PIANO_PROGRESSIONS[this.progIdx];
    this.progStep += 1;
    this.progMatchedPcs.clear();
    this.progBeatTimer = 0;
    this.progStepHit = false;

    if (this.progStep >= prog.chords.length) {
      this.progRunning = false;
      this.piecesCompleted += 1;
      synthAudio.puzzleSuccess(3);
      if (!this.isPractice && !this.isInfinite && this.challengeKind === 'progression') {
        this.finishMusicalPieceChallenge();
        return;
      }
      if (this.explainHostEl) {
        renderExplanationBox(
          this.explainHostEl,
          `${prog.title} completada`,
          'Dominaste todos los cambios armónicos de la progresión.',
          'good'
        );
      }
      this.progStep = 0;
    } else {
      const secPerBeat = 60 / (prog.bpm * this.tempoScale);
      this.progBeatDuration = prog.chords[this.progStep].beats * secPerBeat;
    }
    this.renderModeContent();
  }

  private startProgressionPreview(): void {
    this.stopPlayback();
    const prog = PIANO_PROGRESSIONS[this.progIdx];
    const secPerBeat = 60 / (prog.bpm * this.tempoScale);
    const starts: number[] = [];
    let acc = 0;
    for (const c of prog.chords) {
      starts.push(acc);
      acc += c.beats * secPerBeat;
    }
    this.previewActive = true;
    this.previewKind = 'progression';
    this.previewIndex = 0;
    this.previewElapsedSec = 0;
    this.previewStartsSec = starts;
  }

  // ==================== 4. OÍDO MUSICAL ====================
  private nextEarQuestion(): void {
    if (this.earSubMode === 'singleNote' && this.isPractice) {
      const pool = TREBLE_NATURAL_MIDIS;
      const targetMidi = pool[Math.floor(Math.random() * pool.length)];
      this.currentEarQ = { kind: 'single', baseMidi: targetMidi, targetMidi, semitones: 0, answered: false };
    } else {
      const maxSemitones = !this.isPractice && this.challengeLevel === 0 ? 7 : 12;
      const pool = INTERVAL_DEFINITIONS.filter((i) => i.semitones <= maxSemitones);
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      const minBase = 48;
      const maxBase = 72 - chosen.semitones;
      const baseMidi = minBase + Math.floor(Math.random() * (maxBase - minBase + 1));
      this.currentEarQ = {
        kind: 'interval',
        baseMidi,
        targetMidi: baseMidi + chosen.semitones,
        semitones: chosen.semitones,
        answered: false,
      };
    }
    this.renderModeContent();
    this.playCurrentEarPrompt(false);
  }

  private playCurrentEarPrompt(harmonic = false): void {
    if (!this.currentEarQ) return;
    if (this.currentEarQ.kind === 'single') {
      synthAudio.playMidiNote(this.currentEarQ.targetMidi, 0.85, this.timbre, 0);
      return;
    }
    if (harmonic) {
      synthAudio.playChord([this.currentEarQ.baseMidi, this.currentEarQ.targetMidi], 0.95, this.timbre, 0);
    } else {
      synthAudio.playMidiNote(this.currentEarQ.baseMidi, 0.55, this.timbre, 0);
      synthAudio.playMidiNote(this.currentEarQ.targetMidi, 0.75, this.timbre, 0.48);
    }
  }

  private renderEarUI(): void {
    if (!this.currentEarQ) {
      this.nextEarQuestion();
      return;
    }

    if (this.isPractice) {
      const subWrap = document.createElement('div');
      subWrap.className = 'oa-piano-tabs';
      subWrap.append(
        createActionButton({
          label: 'Intervalos',
          pressed: this.earSubMode === 'intervals',
          onClick: () => {
            synthAudio.uiClick();
            this.earSubMode = 'intervals';
            this.nextEarQuestion();
          },
        }),
        createActionButton({
          label: 'Notas sueltas',
          pressed: this.earSubMode === 'singleNote',
          onClick: () => {
            synthAudio.uiClick();
            this.earSubMode = 'singleNote';
            this.nextEarQuestion();
          },
        })
      );
      this.modeToolbarEl!.appendChild(subWrap);
    }

    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'oa-piano-tabs';
    actionsWrap.append(
      createActionButton({
        label: 'Repetir (R)',
        iconHtml: Icons.volumeOn(15),
        onClick: () => this.playCurrentEarPrompt(false),
      })
    );
    if (this.currentEarQ.kind === 'interval') {
      actionsWrap.appendChild(
        createActionButton({
          label: 'Oír juntas',
          onClick: () => this.playCurrentEarPrompt(true),
        })
      );
    }
    actionsWrap.appendChild(
      createActionButton({
        label: !this.isPractice ? `Intervalo ${this.challengeEarDone + 1}/${this.challengeEarTotal}` : 'Nuevo reto',
        disabled: !this.isPractice && !this.currentEarQ.answered,
        onClick: () => this.nextEarQuestion(),
      })
    );
    this.modeToolbarEl!.appendChild(actionsWrap);

    if (this.currentEarQ.kind === 'single') {
      const heading = document.createElement('div');
      heading.className = 'oa-explain-heading';
      heading.textContent = 'Reconoce la nota suelta en el piano (Do4–Do5)';
      const body = document.createElement('p');
      body.className = 'oa-explain-body';
      body.textContent = 'Escucha el sonido y toca la tecla exacta en el piano de abajo (puedes pulsar Repetir).';
      this.displayPanelEl!.append(heading, body);
      return;
    }

    const heading = document.createElement('div');
    heading.className = 'oa-explain-heading';
    heading.textContent = `¿Qué intervalo sonó? (Base: ${formatMidiNameEs(this.currentEarQ.baseMidi)})`;

    const grid = document.createElement('div');
    grid.className = 'oa-piano-interval-grid';
    INTERVAL_DEFINITIONS.forEach((def) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-piano-interval-btn';
      btn.disabled = this.currentEarQ!.answered;
      btn.innerHTML = `<span>${def.name}</span><span class="oa-explain-body">${def.semitones} st</span>`;
      btn.addEventListener('click', () => this.handleIntervalAnswer(def.semitones, btn));
      grid.appendChild(btn);
    });

    this.displayPanelEl!.append(heading, grid);
  }

  private handleIntervalAnswer(semitones: number, clickedBtn: HTMLButtonElement): void {
    const q = this.currentEarQ;
    if (!q || q.kind !== 'interval' || q.answered) return;
    q.answered = true;
    this.earTotal += 1;

    const correctDef = INTERVAL_DEFINITIONS.find((d) => d.semitones === q.semitones)!;
    const baseName = formatMidiNameEs(q.baseMidi);
    const targetName = formatMidiNameEs(q.targetMidi);
    const ok = semitones === q.semitones;

    if (ok) {
      clickedBtn.classList.add('is-correct');
      this.earHits += 1;
      this.recordMusicHit('perfect', 0, 120);
      synthAudio.puzzleSuccess(this.combo);
    } else {
      clickedBtn.classList.add('is-wrong');
      this.misses += 1;
      this.combo = 0;
      this.ctx.breakCombo();
    }

    if (this.explainHostEl) {
      renderExplanationBox(
        this.explainHostEl,
        ok ? `Correcto: ${correctDef.name}` : `Era una ${correctDef.name}`,
        `${correctDef.semitones} semitonos (${baseName} → ${targetName}). ${correctDef.explanation}`,
        ok ? 'good' : 'bad'
      );
    }
    this.updateStatsCard();

    if (!this.isPractice) {
      this.challengeEarDone += 1;
      this.scheduleNextQuestion(950, () => {
        if (this.destroyed || this.challengeStage !== 'ear') return;
        if (this.challengeEarDone >= this.challengeEarTotal) {
          this.challengeStage = 'staff';
          this.activeTab = 'staff';
          this.challengeStaffDone = 0;
          this.renderTabs();
          this.syncControlsBar();
          this.nextStaffQuestion();
        } else {
          this.nextEarQuestion();
        }
      });
    } else {
      this.displayPanelEl?.querySelectorAll('.oa-piano-interval-btn').forEach((b) => {
        (b as HTMLButtonElement).disabled = true;
      });
    }
  }

  // ==================== 5. LECTURA EN PENTAGRAMA ====================
  private nextStaffQuestion(): void {
    let clef: PianoClef = this.staffClefChoice;
    if (!this.isPractice) {
      clef = this.challengeLevel === 0 ? 'treble' : this.challengeStaffDone % 2 === 0 ? 'treble' : 'bass';
    }
    const pool = clef === 'treble' ? TREBLE_NATURAL_MIDIS : BASS_NATURAL_MIDIS;
    const prevMidi = this.currentStaffQ?.midi;
    let midi = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && midi === prevMidi) {
      midi = pool[(pool.indexOf(midi) + 1) % pool.length];
    }

    this.currentStaffQ = { clef, midi, elapsedSec: 0, hintShown: false, answered: false };
    this.renderModeContent();
  }

  private renderStaffUI(): void {
    if (!this.currentStaffQ) {
      this.nextStaffQuestion();
      return;
    }

    if (this.isPractice) {
      const clefWrap = document.createElement('div');
      clefWrap.className = 'oa-piano-tabs';
      clefWrap.append(
        createActionButton({
          label: 'Clave de Sol (Do4–Do5)',
          pressed: this.staffClefChoice === 'treble',
          onClick: () => {
            synthAudio.uiClick();
            this.staffClefChoice = 'treble';
            this.nextStaffQuestion();
          },
        }),
        createActionButton({
          label: 'Clave de Fa (Do3–Si3)',
          pressed: this.staffClefChoice === 'bass',
          onClick: () => {
            synthAudio.uiClick();
            this.staffClefChoice = 'bass';
            this.nextStaffQuestion();
          },
        })
      );
      this.modeToolbarEl!.appendChild(clefWrap);
    } else {
      const stageBadge = document.createElement('span');
      stageBadge.className = 'oa-rubik-status-pill';
      stageBadge.textContent = `Lectura ${this.challengeStaffDone + 1}/${this.challengeStaffTotal}`;
      this.modeToolbarEl!.appendChild(stageBadge);
    }

    const q = this.currentStaffQ;
    const pos = getStaffPosition(q.midi, q.clef);
    const wrap = document.createElement('div');
    wrap.className = 'oa-piano-staff-wrap';
    wrap.innerHTML = this.buildStaffSvg(pos.clef, pos.stepFromBottomLine, pos.accidental, pos.ledgerSteps);

    const promptText = document.createElement('p');
    promptText.className = 'oa-explain-body';
    const clefLabel = q.clef === 'treble' ? 'Clave de Sol' : 'Clave de Fa';
    promptText.textContent = q.hintShown
      ? `${clefLabel} · Pista: la nota es ${formatMidiNameEs(q.midi)} (tecla ${PIANO_KEY_BY_MIDI.get(q.midi)?.keyLabel ?? ''})`
      : `${clefLabel} · Toca la nota indicada en el teclado del piano.`;

    wrap.appendChild(promptText);
    this.displayPanelEl!.appendChild(wrap);
  }

  private buildStaffSvg(
    clef: PianoClef,
    stepFromBottomLine: number,
    accidental: '#' | '',
    ledgerSteps: number[]
  ): string {
    const bottomLineY = 92;
    const stepPx = 7;
    const yForStep = (step: number) => bottomLineY - step * stepPx;

    const linesSvg = [0, 2, 4, 6, 8]
      .map((s) => `<line x1="28" y1="${yForStep(s)}" x2="332" y2="${yForStep(s)}" stroke="currentColor" stroke-opacity="0.48" stroke-width="1.5"/>`)
      .join('');

    const ledgerSvg = ledgerSteps
      .map((s) => `<line x1="176" y1="${yForStep(s)}" x2="216" y2="${yForStep(s)}" stroke="currentColor" stroke-width="2"/>`)
      .join('');

    const clefSvg =
      clef === 'treble'
        ? `<g stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M62 104 C54 104 52 96 58 93 C63 91 66 98 63 102 C60 105 56 100 58 90 L63 40 C64 31 58 27 54 33 C50 40 60 50 67 60 C73 68 74 79 65 84 C55 88 47 79 50 69 C53 60 64 59 68 67"/>
           </g>`
        : `<g stroke="currentColor" fill="none" stroke-width="2.4" stroke-linecap="round">
             <circle cx="53" cy="52" r="3" fill="currentColor"/>
             <path d="M51 52 C65 44 74 56 69 70 C65 81 55 87 46 91"/>
             <circle cx="77" cy="45" r="2" fill="currentColor"/>
             <circle cx="77" cy="58" r="2" fill="currentColor"/>
           </g>`;

    const noteX = 196;
    const noteY = yForStep(stepFromBottomLine);
    const stemUp = stepFromBottomLine < 4;
    const stemX = stemUp ? noteX + 8.5 : noteX - 8.5;
    const stemY2 = stemUp ? noteY - 32 : noteY + 32;
    const sharpSvg =
      accidental === '#'
        ? `<g stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
             <line x1="${noteX - 24}" y1="${noteY - 9}" x2="${noteX - 24}" y2="${noteY + 9}"/>
             <line x1="${noteX - 18}" y1="${noteY - 11}" x2="${noteX - 18}" y2="${noteY + 7}"/>
             <line x1="${noteX - 28}" y1="${noteY - 3}" x2="${noteX - 14}" y2="${noteY - 6}"/>
             <line x1="${noteX - 28}" y1="${noteY + 5}" x2="${noteX - 14}" y2="${noteY + 2}"/>
           </g>`
        : '';

    return `
      <svg class="oa-piano-staff-svg" viewBox="0 0 360 130" aria-hidden="true">
        ${linesSvg}
        ${clefSvg}
        ${ledgerSvg}
        ${sharpSvg}
        <ellipse cx="${noteX}" cy="${noteY}" rx="9.5" ry="6.8" transform="rotate(-16 ${noteX} ${noteY})" fill="var(--accent-cyan)"/>
        <line x1="${stemX}" y1="${noteY}" x2="${stemX}" y2="${stemY2}" stroke="var(--accent-cyan)" stroke-width="2.2" stroke-linecap="round"/>
      </svg>
    `;
  }

  // ==================== INPUT & EVALUATION ====================
  private handleNotePress(voiceId: string, midi: number): void {
    const btn = this.keyButtons.get(midi);
    btn?.classList.add('is-pressed');

    if (this.activeTab === 'free' && this.freeSubMode === 'chord') {
      const info = describeChordEs(midi, this.chordQuality);
      synthAudio.playChord(info.midis, 0.9, this.timbre, 0.02);
      this.chordHighlightMidis = new Set(info.midis);
      this.refreshPianoHighlights();
      if (this.explainHostEl) {
        renderExplanationBox(this.explainHostEl, info.title, info.explanation, 'good');
      }
      return;
    }

    synthAudio.noteOn(voiceId, midi, this.timbre);

    if (this.activeTab === 'free') {
      const name = formatMidiNameEs(midi);
      if (this.explainHostEl) {
        renderExplanationBox(
          this.explainHostEl,
          `Nota: ${name}`,
          `MIDI ${midi} · Tecla PC: ${PIANO_KEY_BY_MIDI.get(midi)?.keyLabel ?? '-'}`,
          'info'
        );
      }
      return;
    }

    if (this.activeTab === 'melody') {
      this.evaluateMelodyNote(midi);
      return;
    }

    if (this.activeTab === 'progressions') {
      this.evaluateProgressionKey(midi);
      return;
    }

    if (this.activeTab === 'ear' && this.currentEarQ?.kind === 'single' && !this.currentEarQ.answered) {
      this.evaluateSingleEarNote(midi);
      return;
    }

    if (this.activeTab === 'staff' && this.currentStaffQ && !this.currentStaffQ.answered) {
      this.evaluateStaffNote(midi);
    }
  }

  private handleNoteRelease(voiceId: string, midi: number): void {
    synthAudio.noteOff(voiceId);
    const stillHeldPtr = Array.from(this.activePointerNotes.values()).includes(midi);
    const stillHeldKey = Array.from(this.activeKeyCodes.values()).includes(midi);
    if (!stillHeldPtr && !stillHeldKey) {
      this.keyButtons.get(midi)?.classList.remove('is-pressed');
    }
  }

  private recordMusicHit(grade: HitGrade, deltaMs: number, customPts?: number): void {
    this.hits += 1;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (grade === 'perfect') this.perfectHits += 1;
    else if (grade === 'good') this.goodHits += 1;
    else if (grade === 'ok') this.okHits += 1;
    this.timingDeviationsMs.push(deltaMs);
    const pts = customPts ?? gradePoints(grade, this.combo);
    this.score += pts;
    this.ctx.addScore(pts, 1);
  }

  private evaluateMelodyNote(midi: number): void {
    const mel = GUIDED_MELODIES[this.melodyIdx];
    const target = mel.notes[this.melodyStep];
    if (!target) return;

    if (midi === target.midi) {
      if (!this.melodyStepHit) {
        this.melodyStepHit = true;
        this.rhythmHits += 1;
        this.rhythmTotal += 1;
        const deltaMs = this.melodyRunning
          ? Math.round((this.melodyBeatTimer / Math.max(0.15, this.melodyBeatDuration)) * 120)
          : 25;
        this.recordMusicHit(this.melodyRunning ? gradeTiming(deltaMs) : 'perfect', deltaMs);
        if (!this.melodyRunning) {
          this.advanceMelodyStep();
        }
      }
      this.updateStatsCard();
    } else {
      this.misses += 1;
      this.combo = 0;
      this.ctx.breakCombo();
      this.flashWrongKey(midi);
      if (this.explainHostEl) {
        renderExplanationBox(
          this.explainHostEl,
          'Nota distinta a la guía',
          `Tocaste ${formatMidiNameEs(midi)}, la tecla iluminada es ${formatMidiNameEs(target.midi)}.`,
          'warn'
        );
      }
      this.updateStatsCard();
    }
  }

  private advanceMelodyStep(): void {
    const mel = GUIDED_MELODIES[this.melodyIdx];
    this.melodyStep += 1;
    this.melodyBeatTimer = 0;
    this.melodyStepHit = false;

    if (this.melodyStep >= mel.notes.length) {
      this.melodyRunning = false;
      this.piecesCompleted += 1;
      synthAudio.puzzleSuccess(2);

      if (this.isInfinite) {
        this.melodyIdx = (this.melodyIdx + 1) % GUIDED_MELODIES.length;
        this.tempoScale = Math.min(1.3, Number((this.tempoScale + 0.05).toFixed(2)));
        this.ctx.toast(`Pieza completada · Siguiente: ${GUIDED_MELODIES[this.melodyIdx].title}`, 'good');
        this.startMelody(true);
        return;
      }

      if (!this.isPractice && this.challengeKind === 'exam' && this.challengeStage === 'melody') {
        this.ctx.toast('Melodía completada · Etapa 2: Oído musical', 'good');
        this.challengeStage = 'ear';
        this.activeTab = 'ear';
        this.challengeEarDone = 0;
        this.renderTabs();
        this.syncControlsBar();
        this.nextEarQuestion();
        return;
      }

      if (!this.isPractice && this.challengeKind === 'piece') {
        this.finishMusicalPieceChallenge();
        return;
      }

      if (this.explainHostEl) {
        renderExplanationBox(
          this.explainHostEl,
          `${mel.title} completada`,
          `Excelente lectura y pulso. Puedes elegir otra de las ${GUIDED_MELODIES.length} piezas arriba.`,
          'good'
        );
      }
      this.melodyStep = 0;
    } else {
      const beatStart = this.melodyNoteStartsCache[this.melodyStep] ?? 0;
      if (this.melodyRunning) {
        this.triggerAccompCueIfNeeded(beatStart);
      }
      const secPerBeat = 60 / (mel.bpm * this.tempoScale);
      this.melodyBeatDuration = mel.notes[this.melodyStep].beats * secPerBeat;
    }
    this.renderModeContent();
  }

  private evaluateSingleEarNote(midi: number): void {
    const q = this.currentEarQ;
    if (!q || q.answered) return;
    q.answered = true;
    this.earTotal += 1;
    const ok = midi === q.targetMidi;
    if (ok) {
      this.earHits += 1;
      this.recordMusicHit('perfect', 0, 110);
      synthAudio.puzzleSuccess(this.combo);
    } else {
      this.misses += 1;
      this.combo = 0;
      this.ctx.breakCombo();
      this.flashWrongKey(midi);
    }
    if (this.explainHostEl) {
      renderExplanationBox(
        this.explainHostEl,
        ok ? `Correcto: ${formatMidiNameEs(q.targetMidi)}` : `Era ${formatMidiNameEs(q.targetMidi)}`,
        ok
          ? 'Reconociste la altura exacta al primer intento.'
          : `Tocaste ${formatMidiNameEs(midi)}; la nota que sonó era ${formatMidiNameEs(q.targetMidi)}.`,
        ok ? 'good' : 'bad'
      );
    }
    this.updateStatsCard();
  }

  private evaluateStaffNote(midi: number): void {
    const q = this.currentStaffQ;
    if (!q || q.answered) return;
    const ok = midi === q.midi;

    if (ok) {
      q.answered = true;
      this.staffHits += 1;
      this.staffTotal += 1;
      this.recordMusicHit('perfect', 0, 110);
      synthAudio.puzzleSuccess(this.combo);

      if (this.explainHostEl) {
        renderExplanationBox(
          this.explainHostEl,
          `Lectura correcta: ${formatMidiNameEs(q.midi)}`,
          `En ${q.clef === 'treble' ? 'clave de Sol' : 'clave de Fa'} esa posición corresponde a ${formatMidiNameEs(q.midi)}.`,
          'good'
        );
      }
      this.updateStatsCard();

      if (!this.isPractice) {
        this.challengeStaffDone += 1;
        if (this.challengeStaffDone >= this.challengeStaffTotal) {
          this.finishExamChallengeRun();
        } else {
          this.scheduleNextQuestion(420, () => {
            if (!this.destroyed && this.challengeStage === 'staff') {
              this.nextStaffQuestion();
            }
          });
        }
      } else {
        this.scheduleNextQuestion(420, () => {
          if (!this.destroyed && this.activeTab === 'staff') {
            this.nextStaffQuestion();
          }
        });
      }
    } else {
      this.misses += 1;
      this.staffTotal += 1;
      this.combo = 0;
      this.ctx.breakCombo();
      this.flashWrongKey(midi);

      if (this.explainHostEl) {
        renderExplanationBox(
          this.explainHostEl,
          'Nota incorrecta en pentagrama',
          `Tocaste ${formatMidiNameEs(midi)}. En clave de Sol la 2ª línea es Sol4; en clave de Fa la 4ª línea es Fa3.`,
          'warn'
        );
      }
      this.updateStatsCard();
    }
  }

  private finishMusicalPieceChallenge(): void {
    if (this.finishedEmitted) return;
    this.finishedEmitted = true;
    this.challengeStage = 'done';
    this.stopPlayback();
    synthAudio.puzzleSuccess(4);

    const totalTargets = Math.max(1, this.hits + this.misses);
    const summary = summarizeMusicRun({
      hits: this.hits,
      misses: this.misses,
      perfect: this.perfectHits,
      good: this.goodHits,
      ok: this.okHits,
      totalTargets,
      timingDeviationsMs: this.timingDeviationsMs,
      maxCombo: this.maxCombo,
    });

    this.ctx.finish({
      score: Math.max(summary.score, this.score),
      maxCombo: this.maxCombo,
      accuracy: summary.accuracy,
      hits: this.hits,
      misses: this.misses,
      puzzlesSolved: this.piecesCompleted,
      survived: true,
      infiniteMode: this.isInfinite,
      axisPerformances: {
        rhythm: summary.rhythmPerf,
      },
    });
  }

  private finishExamChallengeRun(): void {
    if (this.finishedEmitted) return;
    this.finishedEmitted = true;
    this.challengeStage = 'done';
    this.stopPlayback();
    synthAudio.puzzleSuccess(4);

    const totalAttempts = Math.max(1, this.hits + this.misses);
    const accuracy = Math.round((this.hits / totalAttempts) * 100);
    const rhythmRatio = this.rhythmTotal > 0 ? this.rhythmHits / this.rhythmTotal : 0.7;
    const earRatio = this.earTotal > 0 ? this.earHits / this.earTotal : 0.7;
    const staffRatio = this.staffTotal > 0 ? this.staffHits / this.staffTotal : 0.7;

    const rhythmPerf = Math.max(20, Math.min(100, Math.round((rhythmRatio * 0.55 + earRatio * 0.45) * 100)));
    const logicPerf = Math.max(20, Math.min(100, Math.round(staffRatio * 100)));

    this.ctx.finish({
      score: Math.max(200, this.score),
      maxCombo: this.maxCombo,
      accuracy,
      hits: this.hits,
      misses: this.misses,
      puzzlesSolved: this.earHits + this.staffHits,
      survived: true,
      axisPerformances: {
        rhythm: rhythmPerf,
        logic: logicPerf,
      },
    });
  }

  private flashWrongKey(midi: number): void {
    this.wrongFlashMidi = midi;
    this.wrongFlashTimer = 0.35;
    this.refreshPianoHighlights();
  }

  private clearTargetHighlights(): void {
    for (const btn of this.keyButtons.values()) {
      btn.classList.remove('is-target', 'is-chord', 'is-feedback-bad');
    }
  }

  private refreshPianoHighlights(): void {
    this.clearTargetHighlights();
    if (this.activeTab === 'melody') {
      const target = GUIDED_MELODIES[this.melodyIdx].notes[this.melodyStep];
      if (target) {
        this.keyButtons.get(target.midi)?.classList.add('is-target');
      }
    }
    if (this.activeTab === 'progressions') {
      const ch = PIANO_PROGRESSIONS[this.progIdx].chords[this.progStep];
      if (ch) {
        for (const m of ch.midis) {
          this.keyButtons.get(m)?.classList.add('is-target');
        }
      }
    }
    if (this.activeTab === 'free' && this.freeSubMode === 'chord') {
      for (const m of this.chordHighlightMidis) {
        this.keyButtons.get(m)?.classList.add('is-chord');
      }
    }
    if (this.wrongFlashMidi !== null) {
      this.keyButtons.get(this.wrongFlashMidi)?.classList.add('is-feedback-bad');
    }
  }

  private updateStatsCard(): void {
    if (!this.statsCardEl) return;
    renderMusicStatsCard(this.statsCardEl, this.ctx, {
      hits: this.hits,
      misses: this.misses,
      maxCombo: this.maxCombo,
      extraLine: this.piecesCompleted > 0 ? `Piezas: <strong>${this.piecesCompleted}</strong>` : undefined,
    });
  }

  private stopPlayback(): void {
    this.previewActive = false;
    synthAudio.stopAllNotes();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed || shouldIgnoreGameHotkey(e)) return;

    if (this.activeTab === 'ear' && e.code === 'KeyR' && !e.repeat) {
      e.preventDefault();
      this.playCurrentEarPrompt(false);
      return;
    }

    if (this.activeTab === 'progressions' && e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      this.triggerProgressionChordClick();
      return;
    }

    const keyDef = PIANO_KEY_BY_CODE.get(e.code);
    if (keyDef) {
      e.preventDefault();
      if (e.repeat || this.activeKeyCodes.has(e.code)) return;
      this.activeKeyCodes.set(e.code, keyDef.midi);
      this.handleNotePress(`kbd_${e.code}`, keyDef.midi);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const midi = this.activeKeyCodes.get(e.code);
    if (midi !== undefined) {
      this.activeKeyCodes.delete(e.code);
      this.handleNoteRelease(`kbd_${e.code}`, midi);
    }
  };

  private onWindowBlur = (): void => {
    this.activePointerNotes.clear();
    this.activeKeyCodes.clear();
    for (const btn of this.keyButtons.values()) {
      btn.classList.remove('is-pressed');
    }
    this.metroWidget?.clearPulse();
    synthAudio.stopAllNotes();
  };

  public update(dt: number, _elapsed: number): void {
    if (this.paused || this.destroyed) return;

    if (this.wrongFlashTimer > 0) {
      this.wrongFlashTimer -= dt;
      if (this.wrongFlashTimer <= 0) {
        this.wrongFlashMidi = null;
        this.refreshPianoHighlights();
      }
    }

    if (this.metronomeEnabled) {
      const baseBpm =
        this.activeTab === 'melody'
          ? GUIDED_MELODIES[this.melodyIdx].bpm
          : this.activeTab === 'progressions'
            ? PIANO_PROGRESSIONS[this.progIdx].bpm
            : 100;
      const beatDur = 60 / (baseBpm * this.tempoScale);
      this.metroTimerSec += dt;
      if (this.metroTimerSec >= beatDur) {
        this.metroTimerSec -= beatDur;
        this.metroBeatCount = (this.metroBeatCount + 1) % 4;
        const accent = this.metroBeatCount === 0;
        synthAudio.playMetronomeClick(accent);
        this.metroWidget?.flashBeat(accent);
      }
    }

    if (this.previewActive) {
      this.previewElapsedSec += dt;
      if (this.previewKind === 'melody') {
        const mel = GUIDED_MELODIES[this.melodyIdx];
        const secPerBeat = 60 / (mel.bpm * this.tempoScale);
        while (
          this.previewIndex < mel.notes.length &&
          this.previewElapsedSec >= this.previewStartsSec[this.previewIndex]
        ) {
          const n = mel.notes[this.previewIndex];
          synthAudio.playMidiNote(n.midi, Math.max(0.18, n.beats * secPerBeat * 0.88), this.timbre);
          if (this.melodyAutoAccomp && mel.chords) {
            const cue = chordCueAtBeat(mel, this.previewStartsSec[this.previewIndex] / secPerBeat);
            if (cue && cue.beat !== this.previewLastChordBeat) {
              this.previewLastChordBeat = cue.beat;
              synthAudio.playChord(
                [cue.root, cue.root + (cue.quality === 'minor' ? 3 : 4), cue.root + 7],
                1.0,
                'soft',
                0.015
              );
            }
          }
          this.previewIndex += 1;
        }
        const endAt =
          (this.previewStartsSec[mel.notes.length - 1] ?? 0) +
          (mel.notes[mel.notes.length - 1]?.beats ?? 1) * secPerBeat;
        if (this.previewElapsedSec >= endAt) {
          this.previewActive = false;
          this.renderModeContent();
        }
      } else {
        const prog = PIANO_PROGRESSIONS[this.progIdx];
        const secPerBeat = 60 / (prog.bpm * this.tempoScale);
        while (
          this.previewIndex < prog.chords.length &&
          this.previewElapsedSec >= this.previewStartsSec[this.previewIndex]
        ) {
          const c = prog.chords[this.previewIndex];
          synthAudio.playChord(c.midis, Math.max(0.4, c.beats * secPerBeat * 0.9), this.timbre, 0.02);
          this.previewIndex += 1;
        }
        const endAt =
          (this.previewStartsSec[prog.chords.length - 1] ?? 0) +
          (prog.chords[prog.chords.length - 1]?.beats ?? 4) * secPerBeat;
        if (this.previewElapsedSec >= endAt) {
          this.previewActive = false;
          this.renderModeContent();
        }
      }
    }

    if (this.activeTab === 'melody' && this.melodyRunning) {
      this.melodyBeatTimer += dt;
      const pct = Math.min(100, (this.melodyBeatTimer / Math.max(0.15, this.melodyBeatDuration)) * 100);
      if (this.tempoFillEl) this.tempoFillEl.style.width = `${pct.toFixed(1)}%`;
      if (this.melodyBeatTimer >= this.melodyBeatDuration) {
        if (!this.melodyStepHit) {
          this.rhythmTotal += 1;
          this.misses += 1;
          this.combo = 0;
          this.ctx.breakCombo();
          this.updateStatsCard();
        }
        this.advanceMelodyStep();
      }
    }

    if (this.activeTab === 'progressions' && this.progRunning) {
      this.progBeatTimer += dt;
      const pct = Math.min(100, (this.progBeatTimer / Math.max(0.2, this.progBeatDuration)) * 100);
      if (this.tempoFillEl) this.tempoFillEl.style.width = `${pct.toFixed(1)}%`;
      if (this.progBeatTimer >= this.progBeatDuration) {
        if (!this.progStepHit) {
          this.misses += 1;
          this.combo = 0;
          this.ctx.breakCombo();
          this.updateStatsCard();
        }
        this.advanceProgressionStep();
      }
    }

    if (
      this.isPractice &&
      this.activeTab === 'staff' &&
      this.currentStaffQ &&
      !this.currentStaffQ.answered &&
      !this.currentStaffQ.hintShown
    ) {
      this.currentStaffQ.elapsedSec += dt;
      if (this.currentStaffQ.elapsedSec >= 3.0) {
        this.currentStaffQ.hintShown = true;
        this.renderStaffUI();
      }
    }
  }

  public onResize(): void {
    // Responsive CSS grid/flex handles layout
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.clearNextQuestionTimer();
      this.previewActive = false;
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
      puzzlesSolved: this.piecesCompleted + this.earHits + this.staffHits,
      survived: true,
      infiniteMode: this.isInfinite,
      axisPerformances: {
        rhythm: summary.rhythmPerf,
        logic: this.staffTotal > 0 ? Math.max(25, Math.round((this.staffHits / this.staffTotal) * 100)) : undefined,
      },
    };
  }

  private clearNextQuestionTimer(): void {
    if (this.nextQuestionTimer !== null) {
      window.clearTimeout(this.nextQuestionTimer);
      this.nextQuestionTimer = null;
    }
  }

  private scheduleNextQuestion(delayMs: number, fn: () => void): void {
    this.clearNextQuestionTimer();
    this.nextQuestionTimer = window.setTimeout(() => {
      this.nextQuestionTimer = null;
      fn();
    }, delayMs);
  }

  public destroy(): void {
    this.destroyed = true;
    this.previewActive = false;
    this.metronomeEnabled = false;
    this.clearNextQuestionTimer();
    this.metroWidget?.clearPulse();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    synthAudio.stopAllNotes();
  }
}
