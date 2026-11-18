import { InstrumentTimbre, synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import { GameContext, MiniGame, RunMetrics } from '../types';
import { createAcademyLayout, renderExplanationBox } from '../ui/AcademyKit';
import {
  BASS_NATURAL_MIDIS,
  ChordQuality,
  describeChordEs,
  formatMidiNameEs,
  getStaffPosition,
  GUIDED_MELODIES,
  INTERVAL_DEFINITIONS,
  PIANO_KEY_BY_CODE,
  PIANO_KEY_BY_MIDI,
  PIANO_KEYS,
  PianoClef,
  TREBLE_NATURAL_MIDIS,
  WHITE_KEY_COUNT,
} from './piano/pianoBank';
import '../styles/academy-rubik-piano.css';

type PianoModeTab = 'free' | 'melody' | 'ear' | 'staff';
type LabelDisplayMode = 'names' | 'keys' | 'both';
type FreeSubMode = 'single' | 'chord';
type EarSubMode = 'intervals' | 'singleNote';

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

  // Challenge flow (1 melody + 10 intervals + 10 staff)
  private challengeLevel = 1; // 0: Novato, 1: Estándar, 2: Maestro
  private challengeStage: 'prep' | 'melody' | 'ear' | 'staff' | 'done' = 'prep';
  private challengeEarDone = 0;
  private challengeStaffDone = 0;
  private readonly challengeEarTotal = 10;
  private readonly challengeStaffTotal = 10;

  // Scoring / accuracy tracking
  private hits = 0;
  private misses = 0;
  private rhythmHits = 0;
  private rhythmTotal = 0;
  private earHits = 0;
  private earTotal = 0;
  private staffHits = 0;
  private staffTotal = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;

  // Melody mode state
  private melodyIdx = 0;
  private melodyStep = 0;
  private melodyRunning = false;
  private melodyBeatTimer = 0;
  private melodyBeatDuration = 0.55;
  private melodyStepHit = false;

  // Ear & Staff state
  private currentEarQ: EarQuestion | null = null;
  private currentStaffQ: StaffQuestion | null = null;
  private wrongFlashMidi: number | null = null;
  private wrongFlashTimer = 0;
  private nextQuestionTimer: number | null = null;

  // Polyphonic active input maps
  private activePointerNotes = new Map<number, number>(); // pointerId -> midi
  private activeKeyCodes = new Map<string, number>(); // KeyboardEvent.code -> midi
  private chordHighlightMidis = new Set<number>();

  // DOM refs
  private stageEl!: HTMLDivElement;
  private sideEl!: HTMLElement;
  private tabsHostEl: HTMLDivElement | null = null;
  private modeToolbarEl: HTMLDivElement | null = null;
  private displayPanelEl: HTMLDivElement | null = null;
  private keyButtons = new Map<number, HTMLButtonElement>();
  private explainHostEl: HTMLDivElement | null = null;
  private statsCardEl: HTMLDivElement | null = null;
  private tempoFillEl: HTMLDivElement | null = null;

  constructor(isGauntletSlice = false) {
    this.isGauntletSlice = isGauntletSlice;
  }

  public mount(ctx: GameContext): void {
    this.ctx = ctx;
    this.isPractice = ctx.practiceMode === true;
    this.destroyed = false;
    this.finishedEmitted = false;
    this.activePointerNotes.clear();
    this.activeKeyCodes.clear();
    this.chordHighlightMidis.clear();

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
      this.isPractice ? 'PRÁCTICA GUIADA' : 'MODO RETO'
    );
    this.stageEl = layout.stageEl;
    this.sideEl = layout.sideEl;

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: this.isPractice
        ? 'PIANO MAESTRO · PRÁCTICA'
        : this.isGauntletSlice
          ? 'PIANO MAESTRO · CIRCUITO'
          : 'PIANO MAESTRO · RETO',
      accent: '#9333EA',
      timeLeftSec: null,
      subStat: '2 octavas Do3–Do5',
    });

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);

    if (this.isPractice) {
      this.activeTab = 'free';
      this.buildWorkspace();
      this.syncControlsBar();
      this.renderModeContent();
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
      <h3 class="oa-rp-prep-title">Reto Combinado: Piano, Oído y Pentagrama</h3>
      <p class="oa-rp-prep-desc">
        Supera 3 etapas seguidas: <strong>1) Melodía a tempo</strong>, <strong>2) 10 intervalos de oído</strong> y <strong>3) 10 lecturas en pentagrama</strong>.
      </p>
      <div class="oa-rp-choice-row" role="group" aria-label="Nivel del reto"></div>
      <button type="button" class="oa-rp-primary-btn" id="oa-piano-start-challenge">
        ${Icons.play(18)}<span>Empezar Reto Musical</span>
      </button>
    `;

    const levels = [
      { idx: 0, label: 'Novato (Clave de Sol · Tempo 0.85x)' },
      { idx: 1, label: 'Estándar (Sol y Fa · Tempo 1.0x)' },
      { idx: 2, label: 'Maestro (Sol y Fa · Tempo 1.2x)' },
    ];
    const row = prep.querySelector('.oa-rp-choice-row')!;
    levels.forEach((lvl) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-rp-pill-btn';
      btn.textContent = lvl.label;
      btn.setAttribute('aria-pressed', lvl.idx === this.challengeLevel ? 'true' : 'false');
      btn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.challengeLevel = lvl.idx;
        row.querySelectorAll('button').forEach((b, i) => {
          b.setAttribute('aria-pressed', i === lvl.idx ? 'true' : 'false');
        });
      });
      row.appendChild(btn);
    });

    prep.querySelector('#oa-piano-start-challenge')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.challengeStage = 'melody';
      this.challengeEarDone = 0;
      this.challengeStaffDone = 0;
      this.activeTab = 'melody';
      this.melodyIdx = this.challengeLevel % GUIDED_MELODIES.length;
      this.buildWorkspace();
      this.startMelody(true);
      this.syncControlsBar();
    });

    this.stageEl.appendChild(prep);

    const card = document.createElement('div');
    card.className = 'oa-academy-card oa-piano-dyn-card';
    const ex = document.createElement('div');
    renderExplanationBox(
      ex,
      'Controles rápidos',
      'Puedes usar tu teclado (filas Z–M para Do3–Si3 y Q–I para Do4–Do5) o pulsar las teclas en pantalla.',
      'info'
    );
    card.appendChild(ex);
    this.sideEl.appendChild(card);

    this.syncControlsBar();
  }

  private buildWorkspace(): void {
    this.stageEl.innerHTML = '';
    this.sideEl.querySelectorAll('.oa-piano-dyn-card').forEach((n) => n.remove());
    this.keyButtons.clear();

    const stageCard = document.createElement('div');
    stageCard.className = 'oa-rp-stage-card';

    // Top row: mode tabs + global timbre / labels
    const topToolbar = document.createElement('div');
    topToolbar.className = 'oa-piano-toolbar';

    const tabsHost = document.createElement('div');
    tabsHost.className = 'oa-piano-tabs';
    tabsHost.setAttribute('role', 'tablist');
    this.tabsHostEl = tabsHost;

    const globalControls = document.createElement('div');
    globalControls.className = 'oa-piano-tabs';

    // Label mode selector
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

    // Timbre selector
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

    // Side cards
    const explainCard = document.createElement('div');
    explainCard.className = 'oa-academy-card oa-piano-dyn-card';
    const explainHost = document.createElement('div');
    this.explainHostEl = explainHost;
    explainCard.appendChild(explainHost);

    const statsCard = document.createElement('div');
    statsCard.className = 'oa-academy-card oa-piano-dyn-card';
    this.statsCardEl = statsCard;

    this.sideEl.append(explainCard, statsCard);

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
      if (noteEl) {
        noteEl.classList.toggle('is-hidden', this.labelMode === 'keys');
      }
      if (kbdEl) {
        kbdEl.classList.toggle('is-hidden', this.labelMode === 'names');
      }
    }
  }

  private renderTabs(): void {
    if (!this.tabsHostEl) return;
    this.tabsHostEl.innerHTML = '';

    const tabs: { id: PianoModeTab; label: string }[] = [
      { id: 'free', label: '1. Piano Libre y Acordes' },
      { id: 'melody', label: '2. Melodías Guiadas' },
      { id: 'ear', label: '3. Oído Musical' },
      { id: 'staff', label: '4. Pentagrama' },
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
          (this.challengeStage === 'ear' && t.id === 'ear') ||
          (this.challengeStage === 'staff' && t.id === 'staff');
        btn.disabled = !allowed;
        btn.title = allowed ? t.label : 'En Modo Reto las etapas avanzan en orden';
      }

      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        if (!this.isPractice) return;
        synthAudio.uiClick();
        synthAudio.stopAllNotes();
        this.clearNextQuestionTimer();
        this.activeTab = t.id;
        this.melodyRunning = false;
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
        { keys: ['1–9'], touch: 'Botones de intervalo', action: 'Elegir respuesta' },
        { keys: ['Z–M', 'Q–I'], touch: 'Teclas del piano', action: 'Comprobar notas en el teclado' },
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
    } else if (this.activeTab === 'ear') {
      this.renderEarUI();
    } else {
      this.renderStaffUI();
    }
    this.refreshPianoHighlights();
  }

  // ==================== 1. PIANO LIBRE & ACORDES ====================
  private renderFreeAndChordsUI(): void {
    const left = document.createElement('div');
    left.className = 'oa-piano-tabs';

    const singleBtn = document.createElement('button');
    singleBtn.type = 'button';
    singleBtn.className = 'oa-rp-pill-btn';
    singleBtn.textContent = 'Nota suelta';
    singleBtn.setAttribute('aria-pressed', this.freeSubMode === 'single' ? 'true' : 'false');
    singleBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.freeSubMode = 'single';
      this.chordHighlightMidis.clear();
      this.renderModeContent();
    });

    const chordBtn = document.createElement('button');
    chordBtn.type = 'button';
    chordBtn.className = 'oa-rp-pill-btn';
    chordBtn.textContent = 'Modo Acordes';
    chordBtn.setAttribute('aria-pressed', this.freeSubMode === 'chord' ? 'true' : 'false');
    chordBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.freeSubMode = 'chord';
      this.renderModeContent();
    });

    left.append(singleBtn, chordBtn);
    this.modeToolbarEl!.appendChild(left);

    if (this.freeSubMode === 'chord') {
      const qualWrap = document.createElement('div');
      qualWrap.className = 'oa-piano-tabs';
      (['major', 'minor', 'seventh'] as ChordQuality[]).forEach((q) => {
        const qb = document.createElement('button');
        qb.type = 'button';
        qb.className = 'oa-rp-pill-btn';
        qb.textContent = q === 'major' ? 'Mayor' : q === 'minor' ? 'menor' : 'Séptima';
        qb.setAttribute('aria-pressed', this.chordQuality === q ? 'true' : 'false');
        qb.addEventListener('click', () => {
          synthAudio.uiClick();
          this.chordQuality = q;
          this.renderModeContent();
        });
        qualWrap.appendChild(qb);
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
        : 'Toca cualquier nota fundamental: el piano sonará el acorde completo, iluminará sus teclas y mostrará sus notas.';

    this.displayPanelEl!.append(heading, desc);

    if (this.explainHostEl) {
      renderExplanationBox(
        this.explainHostEl,
        this.freeSubMode === 'single' ? 'Toca libremente' : 'Modo Acordes activo',
        this.freeSubMode === 'single'
          ? 'Explora las 2 octavas (Do3 a Do5). Cambia entre Nombres, Teclas o Ambos arriba.'
          : 'Elige Mayor, menor o Séptima y pulsa una tecla raíz (ej. Do4 = tecla Q).',
        'info'
      );
    }
  }

  // ==================== 2. MELODÍAS GUIADAS ====================
  private startMelody(autoTempo: boolean): void {
    this.melodyStep = 0;
    this.melodyBeatTimer = 0;
    this.melodyStepHit = false;
    this.melodyRunning = autoTempo;
    const mel = GUIDED_MELODIES[this.melodyIdx];
    const tempoScale = this.isPractice
      ? 1
      : this.challengeLevel === 0
        ? 0.85
        : this.challengeLevel === 2
          ? 1.2
          : 1.0;
    const secPerBeat = 60 / (mel.bpm * tempoScale);
    this.melodyBeatDuration = mel.notes[0].beats * secPerBeat;
    this.renderModeContent();
  }

  private renderMelodyUI(): void {
    const mel = GUIDED_MELODIES[this.melodyIdx];

    const selector = document.createElement('select');
    selector.className = 'oa-rp-pill-btn';
    selector.setAttribute('aria-label', 'Elegir melodía guiada');
    selector.disabled = !this.isPractice;
    GUIDED_MELODIES.forEach((m, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = `${m.title} (${m.composer})`;
      if (idx === this.melodyIdx) opt.selected = true;
      selector.appendChild(opt);
    });
    selector.addEventListener('change', () => {
      this.melodyIdx = Number(selector.value);
      this.startMelody(!this.isPractice);
    });

    const restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = 'oa-rp-pill-btn';
    restartBtn.innerHTML = `${Icons.refresh(15)}<span>Reiniciar melodía</span>`;
    restartBtn.addEventListener('click', () => {
      synthAudio.uiClick();
      this.startMelody(!this.isPractice);
    });

    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'oa-rp-pill-btn';
    previewBtn.innerHTML = `${Icons.volumeOn(15)}<span>Escuchar ejemplo</span>`;
    previewBtn.addEventListener('click', () => {
      this.playMelodyPreview(mel);
    });

    this.modeToolbarEl!.append(selector, restartBtn, previewBtn);

    const head = document.createElement('div');
    head.className = 'oa-explain-heading';
    const currentNote = mel.notes[this.melodyStep];
    const keyInfo = currentNote ? PIANO_KEY_BY_MIDI.get(currentNote.midi) : undefined;
    head.textContent = currentNote
      ? `${mel.title} · Nota ${this.melodyStep + 1}/${mel.notes.length}: ${keyInfo?.noteName ?? formatMidiNameEs(currentNote.midi)} (tecla ${keyInfo?.keyLabel ?? '?'})`
      : `${mel.title} · Completada`;

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

    this.displayPanelEl!.append(head, strip);

    if (!this.isPractice) {
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
        this.isPractice ? 'Sigue la luz (sin prisa)' : 'Etapa 1/3 · Sigue el tempo',
        this.isPractice
          ? 'La tecla dorada espera hasta que la toques correctamente.'
          : 'Toca cada tecla dorada antes de que la barra de tempo pase a la siguiente nota.',
        'info'
      );
    }
  }

  private playMelodyPreview(mel: (typeof GUIDED_MELODIES)[number]): void {
    let offset = 0;
    const secPerBeat = 60 / mel.bpm;
    for (const note of mel.notes) {
      const dur = note.beats * secPerBeat;
      synthAudio.playMidiNote(note.midi, Math.max(0.2, dur * 0.88), this.timbre, offset);
      offset += dur;
    }
  }

  // ==================== 3. OÍDO MUSICAL ====================
  private nextEarQuestion(): void {
    if (this.earSubMode === 'singleNote' && this.isPractice) {
      const pool = TREBLE_NATURAL_MIDIS;
      const targetMidi = pool[Math.floor(Math.random() * pool.length)];
      this.currentEarQ = {
        kind: 'single',
        baseMidi: targetMidi,
        targetMidi,
        semitones: 0,
        answered: false,
      };
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
      synthAudio.playChord(
        [this.currentEarQ.baseMidi, this.currentEarQ.targetMidi],
        0.95,
        this.timbre,
        0
      );
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
      const intBtn = document.createElement('button');
      intBtn.type = 'button';
      intBtn.className = 'oa-rp-pill-btn';
      intBtn.textContent = 'Intervalos';
      intBtn.setAttribute('aria-pressed', this.earSubMode === 'intervals' ? 'true' : 'false');
      intBtn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.earSubMode = 'intervals';
        this.nextEarQuestion();
      });

      const noteBtn = document.createElement('button');
      noteBtn.type = 'button';
      noteBtn.className = 'oa-rp-pill-btn';
      noteBtn.textContent = 'Notas sueltas';
      noteBtn.setAttribute('aria-pressed', this.earSubMode === 'singleNote' ? 'true' : 'false');
      noteBtn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.earSubMode = 'singleNote';
        this.nextEarQuestion();
      });
      subWrap.append(intBtn, noteBtn);
      this.modeToolbarEl!.appendChild(subWrap);
    }

    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'oa-piano-tabs';

    const repeatBtn = document.createElement('button');
    repeatBtn.type = 'button';
    repeatBtn.className = 'oa-rp-pill-btn';
    repeatBtn.innerHTML = `${Icons.volumeOn(15)}<span>Repetir (R)</span>`;
    repeatBtn.addEventListener('click', () => this.playCurrentEarPrompt(false));
    actionsWrap.appendChild(repeatBtn);

    if (this.currentEarQ.kind === 'interval') {
      const harmBtn = document.createElement('button');
      harmBtn.type = 'button';
      harmBtn.className = 'oa-rp-pill-btn';
      harmBtn.textContent = 'Oír juntas';
      harmBtn.addEventListener('click', () => this.playCurrentEarPrompt(true));
      actionsWrap.appendChild(harmBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'oa-rp-pill-btn';
    nextBtn.textContent = !this.isPractice
      ? `Intervalo ${this.challengeEarDone + 1}/${this.challengeEarTotal}`
      : 'Nuevo reto';
    nextBtn.disabled = !this.isPractice && !this.currentEarQ.answered;
    nextBtn.addEventListener('click', () => this.nextEarQuestion());
    actionsWrap.appendChild(nextBtn);
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
      this.hits += 1;
      this.earHits += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += 120 + Math.min(80, this.combo * 10);
      this.ctx.addScore(120, 1);
      synthAudio.puzzleSuccess(this.combo);
    } else {
      clickedBtn.classList.add('is-wrong');
      this.misses += 1;
      this.combo = 0;
      this.ctx.breakCombo();
      this.ctx.damage(1);
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

  // ==================== 4. LECTURA EN PENTAGRAMA ====================
  private nextStaffQuestion(): void {
    let clef: PianoClef = this.staffClefChoice;
    if (!this.isPractice) {
      clef =
        this.challengeLevel === 0
          ? 'treble'
          : this.challengeStaffDone % 2 === 0
            ? 'treble'
            : 'bass';
    }
    const pool = clef === 'treble' ? TREBLE_NATURAL_MIDIS : BASS_NATURAL_MIDIS;
    const prevMidi = this.currentStaffQ?.midi;
    let midi = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && midi === prevMidi) {
      midi = pool[(pool.indexOf(midi) + 1) % pool.length];
    }

    this.currentStaffQ = {
      clef,
      midi,
      elapsedSec: 0,
      hintShown: false,
      answered: false,
    };
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
      const trebleBtn = document.createElement('button');
      trebleBtn.type = 'button';
      trebleBtn.className = 'oa-rp-pill-btn';
      trebleBtn.textContent = 'Clave de Sol (Do4–Do5)';
      trebleBtn.setAttribute('aria-pressed', this.staffClefChoice === 'treble' ? 'true' : 'false');
      trebleBtn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.staffClefChoice = 'treble';
        this.nextStaffQuestion();
      });

      const bassBtn = document.createElement('button');
      bassBtn.type = 'button';
      bassBtn.className = 'oa-rp-pill-btn';
      bassBtn.textContent = 'Clave de Fa (Do3–Si3)';
      bassBtn.setAttribute('aria-pressed', this.staffClefChoice === 'bass' ? 'true' : 'false');
      bassBtn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.staffClefChoice = 'bass';
        this.nextStaffQuestion();
      });

      clefWrap.append(trebleBtn, bassBtn);
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
    // 5 lines: steps 0, 2, 4, 6, 8; stepY = 7px per diatonic step
    const bottomLineY = 92;
    const stepPx = 7;
    const yForStep = (step: number) => bottomLineY - step * stepPx;

    const linesSvg = [0, 2, 4, 6, 8]
      .map((s) => {
        const y = yForStep(s);
        return `<line x1="28" y1="${y}" x2="332" y2="${y}" stroke="currentColor" stroke-opacity="0.48" stroke-width="1.5"/>`;
      })
      .join('');

    const ledgerSvg = ledgerSteps
      .map((s) => {
        const y = yForStep(s);
        return `<line x1="176" y1="${y}" x2="216" y2="${y}" stroke="currentColor" stroke-width="2"/>`;
      })
      .join('');

    // Single-weight vector clef symbols
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
    // Keep visual pressed state if still held by another input source
    const stillHeldPtr = Array.from(this.activePointerNotes.values()).includes(midi);
    const stillHeldKey = Array.from(this.activeKeyCodes.values()).includes(midi);
    if (!stillHeldPtr && !stillHeldKey) {
      this.keyButtons.get(midi)?.classList.remove('is-pressed');
    }
  }

  private evaluateMelodyNote(midi: number): void {
    const mel = GUIDED_MELODIES[this.melodyIdx];
    const target = mel.notes[this.melodyStep];
    if (!target) return;

    if (midi === target.midi) {
      if (!this.melodyStepHit) {
        this.melodyStepHit = true;
        this.hits += 1;
        this.rhythmHits += 1;
        this.rhythmTotal += 1;
        this.combo += 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.score += 75 + Math.min(50, this.combo * 5);
        this.ctx.addScore(75, 1);

        if (this.isPractice) {
          this.advanceMelodyStep();
        }
      }
      this.updateStatsCard();
    } else {
      this.misses += 1;
      this.combo = 0;
      this.ctx.breakCombo();
      this.flashWrongKey(midi);
      if (this.isPractice && this.explainHostEl) {
        renderExplanationBox(
          this.explainHostEl,
          'Nota distinta a la guía',
          `Tocaste ${formatMidiNameEs(midi)}, la tecla iluminada es ${formatMidiNameEs(target.midi)}.`,
          'warn'
        );
      } else {
        this.ctx.damage(1);
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
      synthAudio.puzzleSuccess(2);
      if (!this.isPractice && this.challengeStage === 'melody') {
        this.ctx.toast('Melodía completada · Etapa 2: Oído musical', 'good');
        this.challengeStage = 'ear';
        this.activeTab = 'ear';
        this.challengeEarDone = 0;
        this.renderTabs();
        this.syncControlsBar();
        this.nextEarQuestion();
        return;
      }
      if (this.explainHostEl) {
        renderExplanationBox(
          this.explainHostEl,
          `${mel.title} completada`,
          'Excelente lectura y pulso. Puedes elegir otra melodía arriba.',
          'good'
        );
      }
      this.melodyStep = 0;
    } else {
      const tempoScale = this.isPractice
        ? 1
        : this.challengeLevel === 0
          ? 0.85
          : this.challengeLevel === 2
            ? 1.2
            : 1.0;
      const secPerBeat = 60 / (mel.bpm * tempoScale);
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
      this.hits += 1;
      this.earHits += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.ctx.addScore(110, 1);
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
      this.hits += 1;
      this.staffHits += 1;
      this.staffTotal += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += 110 + Math.min(60, this.combo * 8);
      this.ctx.addScore(110, 1);
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
          this.finishChallengeRun();
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
      this.ctx.damage(1);

      if (this.explainHostEl) {
        renderExplanationBox(
          this.explainHostEl,
          'Nota incorrecta en pentagrama',
          `Tocaste ${formatMidiNameEs(midi)}. Recuerda: en clave de Sol la 2ª línea es Sol4; en clave de Fa la 4ª línea es Fa3.`,
          'warn'
        );
      }
      this.updateStatsCard();
    }
  }

  private finishChallengeRun(): void {
    if (this.finishedEmitted) return;
    this.finishedEmitted = true;
    this.challengeStage = 'done';
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
    const total = this.hits + this.misses;
    const acc = total > 0 ? Math.round((this.hits / total) * 100) : 100;
    this.statsCardEl.innerHTML = `
      <div class="oa-explain-heading">Registro de sesión</div>
      <p class="oa-explain-body">Aciertos: <strong>${this.hits}</strong> · Fallos: <strong>${this.misses}</strong> · Precisión: <strong>${acc}%</strong></p>
      <p class="oa-explain-body">Racha máxima: <strong>${this.maxCombo}</strong></p>
    `;
    this.ctx.setHud({
      subStat: `${acc}% precisión · ${this.hits} aciertos`,
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed) return;
    if (e.key === 'Escape' || e.key === '?') return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (this.activeTab === 'ear' && e.code === 'KeyR' && !e.repeat) {
      e.preventDefault();
      this.playCurrentEarPrompt(false);
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

    // Challenge melody tempo progression
    if (!this.isPractice && this.activeTab === 'melody' && this.melodyRunning) {
      this.melodyBeatTimer += dt;
      const pct = Math.min(100, (this.melodyBeatTimer / Math.max(0.15, this.melodyBeatDuration)) * 100);
      if (this.tempoFillEl) {
        this.tempoFillEl.style.width = `${pct.toFixed(1)}%`;
      }
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

    // Practice staff 3s hint reveal
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
    // CSS grid/flex handles resizing smoothly
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.onWindowBlur();
    }
  }

  public getMetrics(): Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'> {
    const total = Math.max(1, this.hits + this.misses);
    const acc = Math.round((this.hits / total) * 100);
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy: acc,
      hits: this.hits,
      misses: this.misses,
      puzzlesSolved: this.earHits + this.staffHits,
      survived: true,
      axisPerformances: {
        rhythm: Math.max(30, acc),
        logic: Math.max(30, acc),
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
    this.clearNextQuestionTimer();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    synthAudio.stopAllNotes();
  }
}
