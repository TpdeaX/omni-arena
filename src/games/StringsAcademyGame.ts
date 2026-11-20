import { synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import { GameContext, MiniGame, RunMetrics } from '../types';
import { createAcademyLayout, createSectionTutorialEl, renderExplanationBox, SectionTutorialInfo } from '../ui/AcademyKit';
import {
  bassShapeFor,
  CHORD_SHAPES,
  ChordShape,
  chordShapeMidis,
  formatStringNoteEs,
  fretMidi,
  getChordsForInstrument,
  SCALE_LABELS,
  scaleBoxPositions,
  ScaleType,
  songTotalBeats,
  STRING_INSTRUMENTS,
  STRING_SCALE_BOXES,
  STRING_SONGS,
  StringInstrumentId,
} from './music/stringsBank';
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

type StringsTab = 'chords' | 'songs' | 'changes' | 'scales';

const SCALE_ROOTS: { pc: number; name: string }[] = [
  { pc: 9, name: 'La' },
  { pc: 0, name: 'Do' },
  { pc: 2, name: 'Re' },
  { pc: 4, name: 'Mi' },
  { pc: 7, name: 'Sol' },
];

export class StringsAcademyGame implements MiniGame {
  public readonly id = 'strings2d' as const;

  private ctx!: GameContext;
  private readonly isGauntletSlice: boolean;
  private isPractice = false;
  private isInfinite = false;
  private paused = false;
  private destroyed = false;
  private finishedEmitted = false;

  // Instrument & submode
  private instrument: StringInstrumentId = 'guitar';
  private activeTab: StringsTab = 'chords';
  private selectedChordId = 'C';
  private songIdx = 0;
  private bpm = 96;
  private metronomeEnabled = false;
  private metroTimerSec = 0;
  private metroBeatCount = 0;
  private metroWidget: MetronomeWidget | null = null;

  // Songs & Changes state
  private songStep = 0;
  private songStepHit = false;
  private songWaitMode = true;
  private songRunning = false;
  private songBeatTimer = 0;
  private songBeatDuration = 1.0;

  // Preview playback
  private previewActive = false;
  private previewIdx = 0;
  private previewElapsedSec = 0;

  // Chord changes drill state
  private changePalette: ChordShape[] = [];
  private changeIdx = 0;
  private changeBeatTimer = 0;
  private changeBeatDuration = 2.0;
  private changeRunning = false;
  private changeHitDone = false;
  private changeRounds = 0;

  // Scale box state
  private scaleRootPc = 9; // La
  private scaleType: ScaleType = 'minorPentatonic';
  private scaleBoxIdx: number | null = 0;
  private scaleOnlyBox = true;

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
  private songsCompleted = 0;

  // Flash feedback on fretboard
  private flashCell: { string: number; fret: number } | null = null;
  private flashTimer = 0;

  // DOM refs
  private stageEl!: HTMLDivElement;
  private sideEl!: HTMLElement;
  private instBarEl: HTMLDivElement | null = null;
  private tabsHostEl: HTMLDivElement | null = null;
  private modeToolbarEl: HTMLDivElement | null = null;
  private actionPanelEl: HTMLDivElement | null = null;
  private fretboardHostEl: HTMLDivElement | null = null;
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
      ctx.difficulty === 'chill' ? 78 : ctx.difficulty === 'hyper' ? 116 : ctx.difficulty === 'progressive' ? 82 : 96;

    const layout = createAcademyLayout(
      ctx.container,
      'GUITARRA, BAJO Y UKELELE',
      this.isPractice ? 'PRÁCTICA GUIADA' : this.isInfinite ? 'JAM INFINITO' : 'MODO RETO'
    );
    this.stageEl = layout.stageEl;
    this.sideEl = layout.sideEl;

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: this.isPractice
        ? 'CUERDAS · PRÁCTICA'
        : this.isInfinite
          ? 'CUERDAS · INFINITO'
          : 'CUERDAS · RETO',
      accent: '#D97706',
      timeLeftSec: null,
      subStat: `${STRING_INSTRUMENTS[this.instrument].name} · ${STRING_SONGS.length} temas`,
    });

    this.resetChangePalette();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('blur', this.onWindowBlur);

    if (this.isPractice) {
      this.activeTab = 'chords';
      this.buildWorkspace();
      this.syncControlsBar();
      this.renderAllSections();
    } else if (this.isInfinite) {
      this.activeTab = 'songs';
      this.songIdx = 1; // Pop chords song
      this.syncInstrumentWithSong();
      this.songWaitMode = false;
      this.buildWorkspace();
      this.startSongRun(true);
      this.syncControlsBar();
    } else {
      this.renderChallengePrep();
    }
  }

  private renderChallengePrep(): void {
    this.stageEl.innerHTML = '';
    this.sideEl.querySelectorAll('.oa-strings-dyn-card').forEach((n) => n.remove());

    const prep = document.createElement('div');
    prep.className = 'oa-rp-prep-card';
    prep.innerHTML = `
      <h3 class="oa-rp-prep-title">Elige Canción o Riff de Cuerdas</h3>
      <p class="oa-rp-prep-desc">
        En canciones de acordes usa <strong>1–4</strong> para colocar la postura y <strong>Espacio</strong> para rasguear. Los errores no cortan la pieza.
      </p>
      <div id="oa-strings-prep-controls"></div>
      <button type="button" class="oa-rp-primary-btn" id="oa-strings-start-challenge">
        ${Icons.play(18)}<span>Empezar Reto de Cuerdas</span>
      </button>
    `;

    const ctrlHost = prep.querySelector('#oa-strings-prep-controls')!;
    const sel = document.createElement('select');
    sel.className = 'oa-mus-select';
    sel.setAttribute('aria-label', 'Elegir canción o riff');
    STRING_SONGS.forEach((s, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      const instName = STRING_INSTRUMENTS[s.instrument].name.split(' ')[0];
      opt.textContent = `[${instName}] ${s.title} (${s.bpm} BPM)`;
      if (idx === this.songIdx) opt.selected = true;
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
      this.songIdx = Number(sel.value);
      this.bpm = STRING_SONGS[this.songIdx].bpm;
      renderBpm();
    });

    this.bpm = STRING_SONGS[this.songIdx].bpm;
    renderBpm();
    ctrlHost.append(sel, bpmRow);

    prep.querySelector('#oa-strings-start-challenge')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.activeTab = 'songs';
      this.songWaitMode = false;
      this.syncInstrumentWithSong();
      this.buildWorkspace();
      this.startSongRun(true);
      this.syncControlsBar();
    });

    this.stageEl.appendChild(prep);

    const card = document.createElement('div');
    card.className = 'oa-academy-card oa-strings-dyn-card';
    const ex = document.createElement('div');
    renderExplanationBox(
      ex,
      'Controles directos',
      'Acordes: teclas 1–4 eligen postura y Espacio rasguea. Riffs/Bajo: toca directo cada traste iluminado en el mástil.',
      'info'
    );
    card.appendChild(ex);

    const tutWrap = document.createElement('div');
    tutWrap.className = 'oa-strings-dyn-card';
    tutWrap.appendChild(
      createSectionTutorialEl({
        id: 'strings:prep',
        sectionName: 'Tutorial: Reto de Cuerdas',
        steps: [
          `Elige entre ${STRING_SONGS.length} canciones y riffs para Guitarra (6c), Bajo (4c) o Ukelele (4c).`,
          'En canciones de acordes, usa 1–4 para preparar la postura y Espacio para rasguear.',
          'En riffs y líneas de bajo, pulsa directamente los trastes iluminados en dorado.',
        ],
        tip: 'Ajusta el BPM abajo antes de empezar si quieres dominar primero los cambios de acorde.',
      })
    );
    this.sideEl.append(tutWrap, card);

    this.syncControlsBar();
  }

  private syncInstrumentWithSong(): void {
    const song = STRING_SONGS[this.songIdx];
    this.instrument = song.instrument;
    if (song.kind === 'chords' && song.chordPalette && song.chordPalette.length > 0) {
      this.selectedChordId = song.chordPalette[0];
    }
    this.resetChangePalette();
  }

  private resetChangePalette(): void {
    const shapes = getChordsForInstrument(this.instrument);
    const preferred = ['C', 'G', 'Am', 'F'];
    const picked = preferred
      .map((id) => shapes.find((s) => s.id === id))
      .filter((x): x is ChordShape => Boolean(x));
    this.changePalette = picked.length >= 2 ? picked : shapes.slice(0, 4);
    this.changeIdx = 0;
    if (!shapes.some((s) => s.id === this.selectedChordId) && shapes.length > 0) {
      this.selectedChordId = shapes[0].id;
    }
  }

  private getSelectedChord(): ChordShape | undefined {
    const shapes = getChordsForInstrument(this.instrument);
    return shapes.find((s) => s.id === this.selectedChordId) ?? shapes[0];
  }

  private buildWorkspace(): void {
    this.stageEl.innerHTML = '';
    this.sideEl.querySelectorAll('.oa-strings-dyn-card').forEach((n) => n.remove());

    const stageCard = document.createElement('div');
    stageCard.className = 'oa-rp-stage-card';

    const topRow = document.createElement('div');
    topRow.className = 'oa-mus-toolbar-row';

    const instBar = document.createElement('div');
    instBar.className = 'oa-piano-tabs';
    this.instBarEl = instBar;

    const rightBar = document.createElement('div');
    rightBar.className = 'oa-mus-toolbar-group';

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

    rightBar.append(
      createBpmControl({
        bpm: this.bpm,
        onChange: (next) => {
          this.bpm = next;
          this.refreshSongBeatDuration();
          this.changeBeatDuration = (4 * 60) / this.bpm;
        },
      }),
      this.metroWidget.root
    );

    topRow.append(instBar, rightBar);

    const tabsHost = document.createElement('div');
    tabsHost.className = 'oa-piano-tabs';
    tabsHost.setAttribute('role', 'tablist');
    this.tabsHostEl = tabsHost;

    const modeToolbar = document.createElement('div');
    modeToolbar.className = 'oa-mus-toolbar-row';
    this.modeToolbarEl = modeToolbar;

    const actionPanel = document.createElement('div');
    actionPanel.className = 'oa-piano-display-panel';
    this.actionPanelEl = actionPanel;

    const fretboardHost = document.createElement('div');
    fretboardHost.className = 'oa-fretboard-scroll';
    this.fretboardHostEl = fretboardHost;

    stageCard.append(topRow, tabsHost, modeToolbar, actionPanel, fretboardHost);
    this.stageEl.appendChild(stageCard);

    const tutorialHost = document.createElement('div');
    tutorialHost.className = 'oa-strings-dyn-card';
    this.tutorialHostEl = tutorialHost;

    const explainCard = document.createElement('div');
    explainCard.className = 'oa-academy-card oa-strings-dyn-card';
    const explainHost = document.createElement('div');
    this.explainHostEl = explainHost;
    explainCard.appendChild(explainHost);

    const statsCard = document.createElement('div');
    statsCard.className = 'oa-academy-card oa-strings-dyn-card';
    this.statsCardEl = statsCard;

    this.sideEl.append(tutorialHost, explainCard, statsCard);
    this.updateStatsCard();
  }

  private renderAllSections(): void {
    this.renderInstrumentBar();
    this.renderTabs();
    this.renderModeContent();
    this.renderFretboard();
  }

  private renderInstrumentBar(): void {
    if (!this.instBarEl) return;
    this.instBarEl.innerHTML = '';

    (['guitar', 'bass', 'ukulele'] as StringInstrumentId[]).forEach((instId) => {
      const def = STRING_INSTRUMENTS[instId];
      this.instBarEl!.appendChild(
        createActionButton({
          label: def.name,
          pressed: this.instrument === instId,
          disabled: !this.isPractice && this.activeTab === 'songs',
          onClick: () => {
            if (!this.isPractice && this.activeTab === 'songs') return;
            synthAudio.uiClick();
            this.stopSongPlayback();
            this.instrument = instId;
            this.resetChangePalette();
            const firstMatch = STRING_SONGS.findIndex((s) => s.instrument === instId);
            if (firstMatch >= 0 && STRING_SONGS[this.songIdx].instrument !== instId) {
              this.songIdx = firstMatch;
              this.songStep = 0;
            }
            this.renderAllSections();
          },
        })
      );
    });
  }

  private renderTabs(): void {
    if (!this.tabsHostEl) return;
    this.tabsHostEl.innerHTML = '';

    const tabs: { id: StringsTab; label: string }[] = [
      { id: 'chords', label: '1. Mástil y Acordes' },
      { id: 'songs', label: `2. ${STRING_SONGS.length} Canciones y Riffs` },
      { id: 'changes', label: '3. Cambios de Acorde' },
      { id: 'scales', label: `4. ${STRING_SCALE_BOXES.length} Escalas en Mástil` },
    ];

    tabs.forEach((t) => {
      const btn = createActionButton({
        label: t.label,
        pressed: this.activeTab === t.id,
        disabled: !this.isPractice && t.id !== 'songs',
        onClick: () => {
          if (!this.isPractice) return;
          synthAudio.uiClick();
          this.stopSongPlayback();
          this.changeRunning = false;
          this.activeTab = t.id;
          if (t.id === 'songs') {
            this.syncInstrumentWithSong();
          }
          this.syncControlsBar();
          this.renderAllSections();
        },
      });
      btn.setAttribute('role', 'tab');
      this.tabsHostEl!.appendChild(btn);
    });
  }

  private syncControlsBar(): void {
    const song = STRING_SONGS[this.songIdx];
    if (this.activeTab === 'changes' || (this.activeTab === 'songs' && song.kind === 'chords')) {
      this.ctx.setControls?.([
        { keys: ['1–4'], touch: 'Barra de posturas', action: 'Elegir acorde en el mástil', tone: 'primary' },
        { keys: ['Espacio'], touch: 'Botón Rasguear', action: 'Rasguear el acorde a tempo', tone: 'primary' },
      ]);
      return;
    }
    this.ctx.setControls?.([
      { keys: ['Clic en traste'], touch: 'Toca cualquier traste', action: 'Pulsar nota en cuerda y traste', tone: 'primary' },
      { keys: ['1–6', 'Espacio'], touch: 'Botón Rasguear', action: 'Cuerda suelta o acorde completo' },
    ]);
  }

  private renderModeContent(): void {
    if (!this.modeToolbarEl || !this.actionPanelEl) return;
    this.modeToolbarEl.innerHTML = '';
    this.actionPanelEl.innerHTML = '';

    if (this.activeTab === 'chords') {
      this.renderChordsTab();
    } else if (this.activeTab === 'songs') {
      this.renderSongsTab();
    } else if (this.activeTab === 'changes') {
      this.renderChangesTab();
    } else {
      this.renderScalesTab();
    }
    this.renderSectionTutorial();
  }

  private renderSectionTutorial(): void {
    if (!this.tutorialHostEl) return;
    const map: Record<StringsTab, SectionTutorialInfo> = {
      chords: {
        id: 'strings:chords',
        sectionName: 'Tutorial: Mástil y Acordes',
        steps: [
          'Elige instrumento arriba: Guitarra (6c), Bajo Eléctrico (4c) o Ukelele (4c).',
          `Explora los ${getChordsForInstrument(this.instrument).length} diagramas para ver dedos (1–4), cuerdas al aire (0) y muteadas (X).`,
          'Pulsa Espacio o Rasguear acorde para escucharlo, o haz clic directo en cualquier traste.',
        ],
        tip: 'Los puntos dorados muestran la tónica (nota fundamental) dentro de cada postura.',
      },
      songs: {
        id: 'strings:songs',
        sectionName: `Tutorial: ${STRING_SONGS.length} Canciones y Riffs`,
        steps: [
          'Selecciona una canción de acordes o un riff/línea de bajo en el selector superior.',
          'En canciones de acordes, usa 1–4 para elegir la postura y Espacio para rasguear.',
          'En riffs y líneas de bajo, pulsa el traste dorado iluminado en el mástil.',
        ],
        tip: 'Pulsa Escuchar ejemplo antes de tocar para oír la cadencia exacta.',
      },
      changes: {
        id: 'strings:changes',
        sectionName: 'Tutorial: Cambios de Acorde',
        steps: [
          'Mira el acorde objetivo y anticipa la siguiente postura anunciada al lado.',
          'Cambia con teclas 1–4 y rasguea con Espacio antes de que avance el compás.',
          'Activa Iniciar entrenador a tempo para ganar fluidez al ritmo del metrónomo.',
        ],
        tip: 'Mueve primero el dedo que cae en las cuerdas más graves para marcar la armonía a tiempo.',
      },
      scales: {
        id: 'strings:scales',
        sectionName: `Tutorial: ${STRING_SCALE_BOXES.length} Cajas y Escalas`,
        steps: [
          `Elige una de las ${STRING_SCALE_BOXES.length} cajas curadas o combina tónica y tipo de escala libremente.`,
          'Los círculos dorados señalan la Tónica y los cian completan la escala sobre el mástil.',
          'Alterna Solo caja / Todo el mástil y pulsa las notas iluminadas para improvisar.',
        ],
        tip: 'Aprende primero una caja cerrada de 4 trastes antes de conectar todo el diapasón.',
      },
    };
    this.tutorialHostEl.innerHTML = '';
    this.tutorialHostEl.appendChild(createSectionTutorialEl(map[this.activeTab]));
  }

  private renderChordsTab(): void {
    const inst = STRING_INSTRUMENTS[this.instrument];
    const shapes = getChordsForInstrument(this.instrument);
    const active = this.getSelectedChord();

    const row = document.createElement('div');
    row.className = 'oa-mus-toolbar-group';
    row.append(
      createActionButton({
        label: 'Rasguear acorde (Espacio)',
        iconHtml: Icons.play(15),
        className: 'oa-rp-pill-btn is-active',
        onClick: () => this.strumActiveChord(),
      }),
      createActionButton({
        label: 'Arpegiar cuerda a cuerda',
        iconHtml: Icons.volumeOn(15),
        onClick: () => {
          if (!active) return;
          synthAudio.playChord(chordShapeMidis(active), 1.0, inst.timbre, 0.14);
        },
      })
    );
    this.modeToolbarEl!.appendChild(row);

    const head = document.createElement('div');
    head.className = 'oa-explain-heading';
    head.textContent = `${inst.name} · Afinación: ${inst.tuningLabel}`;

    const lib = document.createElement('div');
    lib.className = 'oa-chord-library';
    shapes.forEach((sh) => {
      lib.appendChild(
        createActionButton({
          label: sh.shortLabel,
          pressed: active?.id === sh.id,
          onClick: () => {
            this.selectedChordId = sh.id;
            synthAudio.playChord(chordShapeMidis(sh), 0.9, inst.timbre, 0.036);
            this.renderModeContent();
            this.renderFretboard();
          },
        })
      );
    });

    this.actionPanelEl!.append(head, lib);

    if (active && this.explainHostEl) {
      renderExplanationBox(this.explainHostEl, active.name, active.tip, 'info');
    }
  }

  private renderSongsTab(): void {
    const song = STRING_SONGS[this.songIdx];
    const inst = STRING_INSTRUMENTS[this.instrument];

    const row = document.createElement('div');
    row.className = 'oa-mus-toolbar-group';

    const sel = document.createElement('select');
    sel.className = 'oa-mus-select';
    sel.setAttribute('aria-label', 'Elegir canción o riff de cuerdas');
    sel.disabled = !this.isPractice;
    STRING_SONGS.forEach((s, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      const tag = STRING_INSTRUMENTS[s.instrument].name.split(' ')[0];
      opt.textContent = `[${tag}] ${s.title} · ${s.genre}`;
      if (idx === this.songIdx) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      this.songIdx = Number(sel.value);
      this.bpm = STRING_SONGS[this.songIdx].bpm;
      this.syncInstrumentWithSong();
      this.startSongRun(this.isPractice ? !this.songWaitMode : true);
      this.syncControlsBar();
      this.renderAllSections();
    });

    const previewBtn = createActionButton({
      label: this.previewActive ? 'Detener ejemplo' : 'Escuchar ejemplo',
      iconHtml: Icons.volumeOn(15),
      pressed: this.previewActive,
      onClick: () => {
        if (this.previewActive) {
          this.stopSongPlayback();
        } else {
          this.previewActive = true;
          this.songRunning = false;
          this.previewIdx = 0;
          this.previewElapsedSec = 0;
        }
        this.renderModeContent();
      },
    });

    const restartBtn = createActionButton({
      label: 'Reiniciar',
      iconHtml: Icons.refresh(15),
      onClick: () => {
        synthAudio.uiClick();
        this.startSongRun(this.isPractice ? !this.songWaitMode : true);
        this.renderAllSections();
      },
    });

    row.append(sel, previewBtn, restartBtn);

    if (this.isPractice) {
      row.appendChild(
        createActionButton({
          label: this.songWaitMode ? 'Práctica: espera tu toque' : 'Práctica: a tempo',
          pressed: !this.songWaitMode,
          onClick: () => {
            synthAudio.uiClick();
            this.songWaitMode = !this.songWaitMode;
            this.startSongRun(!this.songWaitMode);
            this.renderAllSections();
          },
        })
      );
    }
    this.modeToolbarEl!.appendChild(row);

    const currentEv = song.events[this.songStep];
    const head = document.createElement('div');
    head.className = 'oa-explain-heading';
    head.textContent = currentEv
      ? `${song.title} · Paso ${this.songStep + 1}/${song.events.length}: ${currentEv.label}`
      : `${song.title} · Completada`;
    this.actionPanelEl!.appendChild(head);

    if (song.kind === 'chords') {
      this.renderChordPostureBar(
        song.chordPalette ?? ['C', 'G', 'Am', 'F'],
        currentEv?.chordId
      );
    } else {
      const strip = document.createElement('div');
      strip.className = 'oa-piano-melody-strip';
      song.events.forEach((ev, idx) => {
        const chip = document.createElement('span');
        chip.className = 'oa-piano-note-chip';
        if (idx < this.songStep) chip.classList.add('is-done');
        else if (idx === this.songStep) chip.classList.add('is-current');
        chip.textContent = ev.label;
        strip.appendChild(chip);
      });
      this.actionPanelEl!.appendChild(strip);
    }

    if (this.songRunning) {
      const track = document.createElement('div');
      track.className = 'oa-piano-tempo-track';
      const fill = document.createElement('div');
      fill.className = 'oa-piano-tempo-fill';
      const pct = Math.min(100, (this.songBeatTimer / Math.max(0.15, this.songBeatDuration)) * 100);
      fill.style.width = `${pct.toFixed(1)}%`;
      fill.id = 'oa-strings-tempo-fill';
      track.appendChild(fill);
      this.actionPanelEl!.appendChild(track);
    }

    if (this.explainHostEl) {
      renderExplanationBox(
        this.explainHostEl,
        `${song.title} (${inst.name.split(' ')[0]})`,
        song.description,
        'info'
      );
    }
  }

  private renderChordPostureBar(paletteIds: readonly string[], targetChordId?: string): void {
    const shapes = getChordsForInstrument(this.instrument);
    const bar = document.createElement('div');
    bar.className = 'oa-strings-posture-bar';

    const left = document.createElement('div');
    left.className = 'oa-mus-toolbar-group';

    paletteIds.slice(0, 4).forEach((cid, idx) => {
      const shape = shapes.find((s) => s.id === cid);
      if (!shape) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-strings-posture-btn';
      if (this.selectedChordId === shape.id) btn.classList.add('is-selected');
      if (targetChordId === shape.id) btn.classList.add('is-target');
      btn.innerHTML = `<kbd class="oa-drum-pad-key">${idx + 1}</kbd><span>${shape.shortLabel}</span>`;
      btn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.selectedChordId = shape.id;
        this.renderModeContent();
        this.renderFretboard();
      });
      left.appendChild(btn);
    });

    const strumBtn = createActionButton({
      label: 'Rasguear acorde (Espacio)',
      iconHtml: Icons.play(15),
      className: 'oa-rp-primary-btn oa-strings-strum-btn',
      onClick: () => this.strumActiveChord(),
    });

    bar.append(left, strumBtn);
    this.actionPanelEl!.appendChild(bar);
  }

  private renderChangesTab(): void {
    const target = this.changePalette[this.changeIdx];
    const next = this.changePalette[(this.changeIdx + 1) % this.changePalette.length];

    const grp = document.createElement('div');
    grp.className = 'oa-mus-toolbar-group';
    grp.append(
      createActionButton({
        label: this.changeRunning ? 'Detener metrónomo de cambios' : 'Iniciar entrenador a tempo',
        iconHtml: this.changeRunning ? Icons.pause(15) : Icons.play(15),
        pressed: this.changeRunning,
        onClick: () => {
          synthAudio.uiClick();
          this.changeRunning = !this.changeRunning;
          this.changeBeatTimer = 0;
          this.changeHitDone = false;
          this.changeBeatDuration = (4 * 60) / this.bpm;
          this.renderModeContent();
        },
      })
    );
    this.modeToolbarEl!.appendChild(grp);

    const banner = document.createElement('div');
    banner.className = 'oa-mus-banner';
    banner.innerHTML = `
      <div>
        <div class="oa-explain-heading">Acorde objetivo: ${target?.name ?? '-'}</div>
        <div class="oa-explain-body">Siguiente por adelantado: <strong>${next?.shortLabel ?? '-'}</strong></div>
      </div>
      <span class="oa-mus-chord-badge">Cambios: ${this.changeRounds}</span>
    `;
    this.actionPanelEl!.appendChild(banner);

    this.renderChordPostureBar(
      this.changePalette.map((c) => c.id),
      target?.id
    );

    if (this.explainHostEl && target) {
      renderExplanationBox(
        this.explainHostEl,
        `Cambio hacia ${target.shortLabel}`,
        `Pulsa 1–4 para preparar la postura en el mástil y Espacio para rasguear. ${target.tip}`,
        'info'
      );
    }
  }

  private renderScalesTab(): void {
    const grp = document.createElement('div');
    grp.className = 'oa-mus-toolbar-group';

    const boxSel = document.createElement('select');
    boxSel.className = 'oa-mus-select';
    boxSel.setAttribute('aria-label', 'Elegir caja de escala');
    STRING_SCALE_BOXES.forEach((box, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = box.title;
      if (this.scaleBoxIdx === idx) opt.selected = true;
      boxSel.appendChild(opt);
    });
    if (this.scaleBoxIdx === null) {
      const customOpt = document.createElement('option');
      customOpt.value = 'custom';
      customOpt.textContent = 'Personalizada (mástil completo)';
      customOpt.selected = true;
      boxSel.appendChild(customOpt);
    }
    boxSel.addEventListener('change', () => {
      if (boxSel.value === 'custom') return;
      const idx = Number(boxSel.value);
      const box = STRING_SCALE_BOXES[idx];
      if (!box) return;
      this.scaleBoxIdx = idx;
      this.scaleRootPc = box.rootPc;
      this.scaleType = box.scale;
      this.scaleOnlyBox = true;
      this.renderModeContent();
      this.renderFretboard();
    });

    const boxToggleBtn = createActionButton({
      label: this.scaleOnlyBox && this.scaleBoxIdx !== null ? 'Solo caja' : 'Mástil 0–12',
      pressed: this.scaleOnlyBox && this.scaleBoxIdx !== null,
      disabled: this.scaleBoxIdx === null,
      onClick: () => {
        synthAudio.uiClick();
        this.scaleOnlyBox = !this.scaleOnlyBox;
        this.renderModeContent();
        this.renderFretboard();
      },
    });

    const scaleSel = document.createElement('select');
    scaleSel.className = 'oa-mus-select';
    scaleSel.setAttribute('aria-label', 'Tipo de escala');
    (Object.keys(SCALE_LABELS) as ScaleType[]).forEach((st) => {
      const opt = document.createElement('option');
      opt.value = st;
      opt.textContent = SCALE_LABELS[st];
      if (this.scaleType === st) opt.selected = true;
      scaleSel.appendChild(opt);
    });
    scaleSel.addEventListener('change', () => {
      this.scaleBoxIdx = null;
      this.scaleOnlyBox = false;
      this.scaleType = scaleSel.value as ScaleType;
      this.renderModeContent();
      this.renderFretboard();
    });

    grp.append(boxSel, boxToggleBtn, scaleSel);

    SCALE_ROOTS.forEach((r) => {
      grp.appendChild(
        createActionButton({
          label: `Tónica ${r.name}`,
          pressed: this.scaleRootPc === r.pc,
          onClick: () => {
            synthAudio.uiClick();
            this.scaleBoxIdx = null;
            this.scaleOnlyBox = false;
            this.scaleRootPc = r.pc;
            this.renderModeContent();
            this.renderFretboard();
          },
        })
      );
    });

    this.modeToolbarEl!.appendChild(grp);

    const activeBox = this.scaleBoxIdx !== null ? STRING_SCALE_BOXES[this.scaleBoxIdx] : undefined;
    const rootName = SCALE_ROOTS.find((r) => r.pc === this.scaleRootPc)?.name ?? activeBox?.rootName ?? 'La';
    const scaleLabel = SCALE_LABELS[this.scaleType] ?? 'Escala';
    const head = document.createElement('div');
    head.className = 'oa-explain-heading';
    head.textContent = activeBox ? activeBox.title : `${scaleLabel} de ${rootName}`;
    const desc = document.createElement('p');
    desc.className = 'oa-explain-body';
    desc.textContent = 'Los círculos dorados son la Tónica (nota base) y los cian completan la escala. Toca cualquier traste iluminado.';
    this.actionPanelEl!.append(head, desc);

    if (this.explainHostEl) {
      renderExplanationBox(
        this.explainHostEl,
        activeBox ? activeBox.title : `Escala en ${rootName}`,
        activeBox ? activeBox.tip : 'Improvisa tocando de nota dorada a nota dorada en distintas cuerdas.',
        'info'
      );
    }
  }

  private renderFretboard(): void {
    if (!this.fretboardHostEl) return;
    this.fretboardHostEl.innerHTML = '';

    const inst = STRING_INSTRUMENTS[this.instrument];
    const board = document.createElement('div');
    board.className = 'oa-fretboard';
    board.setAttribute('role', 'group');
    board.setAttribute('aria-label', `Mástil de ${inst.name}`);

    const markerFrets = new Set([3, 5, 7, 9, 12]);
    const nums = document.createElement('div');
    nums.className = 'oa-fret-numbers';
    const spacer = document.createElement('span');
    spacer.className = 'oa-string-label';
    spacer.textContent = 'Cuerda';
    nums.appendChild(spacer);

    for (let f = 0; f <= 12; f++) {
      const n = document.createElement('span');
      n.className = `oa-fret-num${markerFrets.has(f) ? ' is-marker' : ''}`;
      n.textContent = f === 0 ? 'Aire' : String(f);
      nums.appendChild(n);
    }
    board.appendChild(nums);

    const activeChord = this.getSelectedChord();
    const song = STRING_SONGS[this.songIdx];
    const currentEv = this.activeTab === 'songs' ? song.events[this.songStep] : undefined;
    const activeBox = this.scaleBoxIdx !== null ? STRING_SCALE_BOXES[this.scaleBoxIdx] : undefined;
    const scaleMinFret = this.scaleOnlyBox && activeBox ? activeBox.minFret : 0;
    const scaleMaxFret = this.scaleOnlyBox && activeBox ? activeBox.maxFret : 12;
    const scaleSet =
      this.activeTab === 'scales'
        ? new Map(
            scaleBoxPositions(this.instrument, this.scaleRootPc, this.scaleType, scaleMinFret, scaleMaxFret).map((p) => [
              `${p.string}:${p.fret}`,
              p,
            ])
          )
        : null;

    const showChordOverlay =
      this.activeTab === 'chords' ||
      this.activeTab === 'changes' ||
      (this.activeTab === 'songs' && song.kind === 'chords');

    for (let s = 0; s < inst.strings.length; s++) {
      const row = document.createElement('div');
      row.className = 'oa-fret-row';
      row.style.setProperty('--string-thick', `${(1.4 + s * 0.42).toFixed(2)}px`);

      const lbl = document.createElement('span');
      lbl.className = 'oa-string-label';
      lbl.textContent = inst.stringLabels[s];
      row.appendChild(lbl);

      for (let f = 0; f <= 12; f++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = `oa-fret-cell${f === 0 ? ' is-nut' : ''}`;
        const midi = fretMidi(this.instrument, s, f);
        const noteName = formatStringNoteEs(midi);
        cell.setAttribute('aria-label', `${inst.stringLabels[s]} traste ${f}: ${noteName}`);

        const isFlash = this.flashCell?.string === s && this.flashCell?.fret === f;
        const isRiffTarget =
          this.activeTab === 'songs' &&
          song.kind === 'riff' &&
          currentEv?.string === s &&
          currentEv?.fret === f;

        let dotHtml = '';
        if (isFlash) {
          dotHtml = `<span class="oa-fret-dot is-flash">${noteName.replace(/\d/, '')}</span>`;
        } else if (isRiffTarget) {
          dotHtml = `<span class="oa-fret-dot is-target">${f === 0 ? '0' : f}</span>`;
        } else if (showChordOverlay && activeChord) {
          const cf = activeChord.frets[s];
          const finger = activeChord.fingers[s];
          if (cf === -1 && f === 0) {
            dotHtml = `<span class="oa-fret-dot is-muted">X</span>`;
          } else if (cf === f) {
            const isRoot = midi % 12 === activeChord.rootPc;
            dotHtml = `<span class="oa-fret-dot${isRoot ? ' is-root' : ''}">${
              f === 0 ? '0' : finger > 0 ? String(finger) : noteName.replace(/\d/, '')
            }</span>`;
          }
        } else if (scaleSet) {
          const sp = scaleSet.get(`${s}:${f}`);
          if (sp) {
            dotHtml = `<span class="oa-fret-dot${sp.isRoot ? ' is-root' : ''}">${sp.noteName}</span>`;
          }
        }

        cell.innerHTML = dotHtml;
        cell.addEventListener('click', () => {
          this.handleFretClick(s, f);
        });
        row.appendChild(cell);
      }

      board.appendChild(row);
    }

    this.fretboardHostEl.appendChild(board);
  }

  private handleFretClick(stringIdx: number, fret: number): void {
    const inst = STRING_INSTRUMENTS[this.instrument];
    const midi = fretMidi(this.instrument, stringIdx, fret);
    synthAudio.playMidiNote(midi, 0.85, inst.timbre);
    this.flashCell = { string: stringIdx, fret };
    this.flashTimer = 0.35;

    if (this.activeTab === 'songs') {
      const song = STRING_SONGS[this.songIdx];
      if (song.kind === 'riff') {
        const target = song.events[this.songStep];
        if (target && target.string === stringIdx && target.fret === fret) {
          this.recordSongStepHit();
        } else if (target) {
          this.recordMiss(
            `Tocaste cuerda ${stringIdx + 1} traste ${fret}; la guía marca cuerda ${(target.string ?? 0) + 1} traste ${target.fret ?? 0}.`
          );
        }
        this.renderFretboard();
        return;
      }
    }

    if (this.explainHostEl && (this.activeTab === 'chords' || this.activeTab === 'scales')) {
      renderExplanationBox(
        this.explainHostEl,
        `Nota: ${formatStringNoteEs(midi)}`,
        `${inst.stringLabels[stringIdx]} · Traste ${fret}`,
        'info'
      );
    }
    this.renderFretboard();
  }

  private strumActiveChord(): void {
    const inst = STRING_INSTRUMENTS[this.instrument];
    const chord = this.getSelectedChord();
    if (!chord) return;
    synthAudio.playChord(chordShapeMidis(chord), 0.95, inst.timbre, 0.036);

    if (this.activeTab === 'songs') {
      const song = STRING_SONGS[this.songIdx];
      if (song.kind === 'chords') {
        const target = song.events[this.songStep];
        if (target && target.chordId === chord.id) {
          this.recordSongStepHit();
        } else if (target) {
          this.recordMiss(`Elegiste ${chord.shortLabel}; el compás pide ${target.chordId}.`);
        }
      }
      return;
    }

    if (this.activeTab === 'changes') {
      const target = this.changePalette[this.changeIdx];
      if (target && target.id === chord.id) {
        if (!this.changeHitDone) {
          this.changeHitDone = true;
          this.changeRounds += 1;
          const deltaMs = this.changeRunning
            ? Math.round((this.changeBeatTimer / Math.max(0.2, this.changeBeatDuration)) * 120)
            : 25;
          this.recordGrade(this.changeRunning ? gradeTiming(deltaMs) : 'perfect', deltaMs);
          if (!this.changeRunning) {
            this.changeIdx = (this.changeIdx + 1) % this.changePalette.length;
            this.changeHitDone = false;
            this.renderModeContent();
          }
        }
      } else if (target) {
        this.recordMiss(`Postura ${chord.shortLabel}; cambia a ${target.shortLabel}.`);
      }
    }
  }

  private startSongRun(autoTempo: boolean): void {
    this.stopSongPlayback();
    this.songStep = 0;
    this.songStepHit = false;
    this.songBeatTimer = 0;
    this.songRunning = autoTempo;
    this.refreshSongBeatDuration();
  }

  private refreshSongBeatDuration(): void {
    const song = STRING_SONGS[this.songIdx];
    const ev = song.events[this.songStep];
    if (!ev) return;
    this.songBeatDuration = ev.durBeats * (60 / this.bpm);
  }

  private recordSongStepHit(): void {
    if (this.songStepHit) return;
    this.songStepHit = true;
    const deltaMs = this.songRunning
      ? Math.round((this.songBeatTimer / Math.max(0.15, this.songBeatDuration)) * 120)
      : 20;
    this.recordGrade(this.songRunning ? gradeTiming(deltaMs) : 'perfect', deltaMs);
    if (!this.songRunning) {
      this.advanceSongStep();
    }
  }

  private advanceSongStep(): void {
    const song = STRING_SONGS[this.songIdx];
    this.songStep += 1;
    this.songBeatTimer = 0;
    this.songStepHit = false;

    if (this.songStep >= song.events.length) {
      this.songRunning = false;
      this.songsCompleted += 1;
      synthAudio.puzzleSuccess(3);

      if (this.isInfinite) {
        this.songIdx = (this.songIdx + 1) % STRING_SONGS.length;
        this.bpm = Math.min(155, this.bpm + 4);
        this.syncInstrumentWithSong();
        this.ctx.toast(`Pieza completada · Siguiente: ${STRING_SONGS[this.songIdx].title}`, 'good');
        this.startSongRun(true);
        this.renderAllSections();
        return;
      }

      if (!this.isPractice) {
        this.finishChallengeRun();
        return;
      }

      if (this.explainHostEl) {
        renderExplanationBox(
          this.explainHostEl,
          `${song.title} completada`,
          `Puedes cambiar de instrumento o elegir cualquiera de las ${STRING_SONGS.length} canciones/riffs.`,
          'good'
        );
      }
      this.songStep = 0;
    }

    this.refreshSongBeatDuration();
    this.renderModeContent();
    this.renderFretboard();
  }

  private recordGrade(grade: HitGrade, deltaMs: number): void {
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
    this.updateStatsCard();
  }

  private recordMiss(msg: string): void {
    this.misses += 1;
    this.combo = 0;
    this.ctx.breakCombo();
    if (this.explainHostEl) {
      renderExplanationBox(this.explainHostEl, 'Ajusta la posición', msg, 'warn');
    }
    this.updateStatsCard();
  }

  private stopSongPlayback(): void {
    this.previewActive = false;
    this.songRunning = false;
    synthAudio.stopAllNotes();
  }

  private updateStatsCard(): void {
    if (!this.statsCardEl) return;
    renderMusicStatsCard(this.statsCardEl, this.ctx, {
      hits: this.hits,
      misses: this.misses,
      maxCombo: this.maxCombo,
      extraLine: this.songsCompleted > 0 ? `Piezas: <strong>${this.songsCompleted}</strong>` : undefined,
      subStatPrefix: STRING_INSTRUMENTS[this.instrument].name.split(' ')[0],
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed || shouldIgnoreGameHotkey(e)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) this.strumActiveChord();
      return;
    }

    const digitMatch = /^(?:Digit|Numpad)([1-6])$/.exec(e.code);
    if (digitMatch && !e.repeat) {
      e.preventDefault();
      const idx = Number(digitMatch[1]) - 1;
      const song = STRING_SONGS[this.songIdx];
      const inChordPostureMode =
        this.activeTab === 'changes' || (this.activeTab === 'songs' && song.kind === 'chords');

      if (inChordPostureMode && idx < 4) {
        const paletteIds =
          this.activeTab === 'changes'
            ? this.changePalette.map((c) => c.id)
            : song.chordPalette ?? ['C', 'G', 'Am', 'F'];
        const chosenId = paletteIds[idx];
        const shapes = getChordsForInstrument(this.instrument);
        const found = shapes.find((s) => s.id === chosenId);
        if (found) {
          this.selectedChordId = found.id;
          synthAudio.uiClick();
          this.renderModeContent();
          this.renderFretboard();
        }
        return;
      }

      // Direct string pluck (1-6)
      const inst = STRING_INSTRUMENTS[this.instrument];
      if (idx < inst.strings.length) {
        const activeChord = this.getSelectedChord();
        const fret = activeChord && activeChord.frets[idx] >= 0 ? activeChord.frets[idx] : 0;
        this.handleFretClick(idx, fret);
      }
    }
  };

  private onWindowBlur = (): void => {
    this.metroWidget?.clearPulse();
    synthAudio.stopAllNotes();
  };

  public update(dt: number, _elapsed: number): void {
    if (this.paused || this.destroyed) return;

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flashCell = null;
        this.renderFretboard();
      }
    }

    if (this.metronomeEnabled) {
      const beatDur = 60 / this.bpm;
      this.metroTimerSec += dt;
      if (this.metroTimerSec >= beatDur) {
        this.metroTimerSec -= beatDur;
        this.metroBeatCount = (this.metroBeatCount + 1) % 4;
        const accent = this.metroBeatCount === 0;
        synthAudio.playMetronomeClick(accent);
        this.metroWidget?.flashBeat(accent);
      }
    }

    // Preview song playback
    if (this.previewActive) {
      const song = STRING_SONGS[this.songIdx];
      const inst = STRING_INSTRUMENTS[song.instrument];
      const secPerBeat = 60 / this.bpm;
      this.previewElapsedSec += dt;

      while (
        this.previewIdx < song.events.length &&
        this.previewElapsedSec >= song.events[this.previewIdx].beat * secPerBeat
      ) {
        const ev = song.events[this.previewIdx];
        if (song.kind === 'chords' && ev.chordId) {
          const shape = CHORD_SHAPES.find((c) => c.instrument === song.instrument && c.id === ev.chordId)
            ?? bassShapeFor(0);
          this.selectedChordId = shape.id;
          synthAudio.playChord(chordShapeMidis(shape), Math.max(0.4, ev.durBeats * secPerBeat * 0.9), inst.timbre, 0.036);
          this.renderFretboard();
        } else if (ev.string !== undefined && ev.fret !== undefined) {
          const midi = fretMidi(song.instrument, ev.string, ev.fret);
          synthAudio.playMidiNote(midi, Math.max(0.2, ev.durBeats * secPerBeat * 0.9), inst.timbre);
          this.flashCell = { string: ev.string, fret: ev.fret };
          this.flashTimer = 0.25;
          this.renderFretboard();
        }
        this.previewIdx += 1;
      }

      if (this.previewElapsedSec >= songTotalBeats(song) * secPerBeat) {
        this.previewActive = false;
        this.renderModeContent();
      }
    }

    // Song challenge/practice tempo advance
    if (this.activeTab === 'songs' && this.songRunning) {
      this.songBeatTimer += dt;
      const fill = this.actionPanelEl?.querySelector('#oa-strings-tempo-fill') as HTMLDivElement | null;
      if (fill) {
        const pct = Math.min(100, (this.songBeatTimer / Math.max(0.15, this.songBeatDuration)) * 100);
        fill.style.width = `${pct.toFixed(1)}%`;
      }
      if (this.songBeatTimer >= this.songBeatDuration) {
        if (!this.songStepHit) {
          this.misses += 1;
          this.combo = 0;
          this.ctx.breakCombo();
          this.updateStatsCard();
        }
        this.advanceSongStep();
      }
    }

    // Chord changes metronome drill
    if (this.activeTab === 'changes' && this.changeRunning) {
      this.changeBeatTimer += dt;
      if (this.changeBeatTimer >= this.changeBeatDuration) {
        this.changeBeatTimer -= this.changeBeatDuration;
        if (!this.changeHitDone) {
          this.misses += 1;
          this.combo = 0;
          this.ctx.breakCombo();
          this.updateStatsCard();
        }
        this.changeHitDone = false;
        this.changeIdx = (this.changeIdx + 1) % this.changePalette.length;
        this.renderModeContent();
        this.renderFretboard();
      }
    }
  }

  private finishChallengeRun(): void {
    if (this.finishedEmitted) return;
    this.finishedEmitted = true;
    this.stopSongPlayback();
    synthAudio.puzzleSuccess(4);

    const summary = summarizeMusicRun({
      hits: this.hits,
      misses: this.misses,
      perfect: this.perfectHits,
      good: this.goodHits,
      ok: this.okHits,
      totalTargets: Math.max(1, STRING_SONGS[this.songIdx].events.length),
      timingDeviationsMs: this.timingDeviationsMs,
      maxCombo: this.maxCombo,
    });

    this.ctx.finish({
      score: Math.max(this.score, summary.score),
      maxCombo: this.maxCombo,
      accuracy: summary.accuracy,
      hits: this.hits,
      misses: this.misses,
      puzzlesSolved: this.songsCompleted,
      survived: true,
      infiniteMode: this.isInfinite,
      axisPerformances: {
        rhythm: summary.rhythmPerf,
      },
    });
  }

  public onResize(): void {
    // Fretboard uses horizontal scroll container cleanly
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
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
      puzzlesSolved: this.songsCompleted + this.changeRounds,
      survived: true,
      infiniteMode: this.isInfinite,
      axisPerformances: {
        rhythm: summary.rhythmPerf,
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    this.stopSongPlayback();
    this.changeRunning = false;
    this.metronomeEnabled = false;
    this.metroWidget?.clearPulse();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('blur', this.onWindowBlur);
    synthAudio.stopAllNotes();
  }
}
