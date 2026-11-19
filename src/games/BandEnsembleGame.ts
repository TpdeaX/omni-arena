import { synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import { DrumPieceId, GameContext, MiniGame, RunMetrics } from '../types';
import { createAcademyLayout, renderExplanationBox } from '../ui/AcademyKit';
import {
  BAND_INSTRUMENTS,
  BAND_SONGS,
  BAND_TRACK_IDS,
  bandSongTotalBeats,
  BandPlayerInstrumentId,
  BandTrackId,
} from './music/bandBank';
import { DRUM_PIECE_BY_ID } from './music/drumsBank';
import { fretMidi, STRING_INSTRUMENTS } from './music/stringsBank';
import { formatMidiNameEs, PIANO_KEY_BY_CODE, PIANO_KEYS, WHITE_KEY_COUNT } from './piano/pianoBank';
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

const TRACK_LABELS: Record<BandTrackId, string> = {
  drums: 'Batería',
  bass: 'Bajo',
  chords: 'Acordes',
  melody: 'Melodía',
};

const MARIMBA_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#10B981',
  '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#F43F5E',
];

// 15 natural bars from C4 (60) to C6 (84)
const MARIMBA_NATURALS: { midi: number; label: string; kbd: string; code: string }[] = [
  { midi: 60, label: 'Do4', kbd: 'Z', code: 'KeyZ' },
  { midi: 62, label: 'Re4', kbd: 'X', code: 'KeyX' },
  { midi: 64, label: 'Mi4', kbd: 'C', code: 'KeyC' },
  { midi: 65, label: 'Fa4', kbd: 'V', code: 'KeyV' },
  { midi: 67, label: 'Sol4', kbd: 'B', code: 'KeyB' },
  { midi: 69, label: 'La4', kbd: 'N', code: 'KeyN' },
  { midi: 71, label: 'Si4', kbd: 'M', code: 'KeyM' },
  { midi: 72, label: 'Do5', kbd: 'Q', code: 'KeyQ' },
  { midi: 74, label: 'Re5', kbd: 'W', code: 'KeyW' },
  { midi: 76, label: 'Mi5', kbd: 'E', code: 'KeyE' },
  { midi: 77, label: 'Fa5', kbd: 'R', code: 'KeyR' },
  { midi: 79, label: 'Sol5', kbd: 'T', code: 'KeyT' },
  { midi: 81, label: 'La5', kbd: 'Y', code: 'KeyY' },
  { midi: 83, label: 'Si5', kbd: 'U', code: 'KeyU' },
  { midi: 84, label: 'Do6', kbd: 'I', code: 'KeyI' },
];

// Upper chromatic accidentals aligned between natural columns (0..13)
const MARIMBA_SHARPS: { midi: number; label: string; col: number; code: string; kbd: string }[] = [
  { midi: 61, label: 'Do#4', col: 0, code: 'KeyS', kbd: 'S' },
  { midi: 63, label: 'Re#4', col: 1, code: 'KeyD', kbd: 'D' },
  { midi: 66, label: 'Fa#4', col: 3, code: 'KeyG', kbd: 'G' },
  { midi: 68, label: 'Sol#4', col: 4, code: 'KeyH', kbd: 'H' },
  { midi: 70, label: 'Sib4', col: 5, code: 'KeyJ', kbd: 'J' },
  { midi: 73, label: 'Do#5', col: 7, code: 'Digit2', kbd: '2' },
  { midi: 75, label: 'Re#5', col: 8, code: 'Digit3', kbd: '3' },
  { midi: 78, label: 'Fa#5', col: 10, code: 'Digit5', kbd: '5' },
  { midi: 80, label: 'Sol#5', col: 11, code: 'Digit6', kbd: '6' },
  { midi: 82, label: 'Sib5', col: 12, code: 'Digit7', kbd: '7' },
];

const MINI_DRUM_PADS: { id: DrumPieceId; label: string; code: string; keyLabel: string; color: string }[] = [
  { id: 'crash', label: 'Crash / Ride', code: 'KeyR', keyLabel: 'R', color: '#F59E0B' },
  { id: 'tom_high', label: 'Tom', code: 'KeyD', keyLabel: 'D', color: '#A855F7' },
  { id: 'hihat_open', label: 'HH Abierto', code: 'KeyK', keyLabel: 'K', color: '#38BDF8' },
  { id: 'hihat_closed', label: 'HH Cerrado', code: 'KeyJ', keyLabel: 'J', color: '#00E5FF' },
  { id: 'snare', label: 'Caja', code: 'KeyF', keyLabel: 'F', color: '#F43F5E' },
  { id: 'kick', label: 'Bombo', code: 'Space', keyLabel: 'Espacio', color: '#22C55E' },
];

const FLUTE_RANGE_MIDIS = Array.from({ length: 20 }, (_, i) => 60 + i); // C4..G5

interface BandTargetEvent {
  beatAbs: number;
  timeSec: number;
  midi?: number;
  piece?: DrumPieceId;
  matched: boolean;
  missed: boolean;
}

export class BandEnsembleGame implements MiniGame {
  public readonly id = 'band2d' as const;

  private ctx!: GameContext;
  private readonly isGauntletSlice: boolean;
  private isPractice = false;
  private isInfinite = false;
  private paused = false;
  private destroyed = false;
  private finishedEmitted = false;

  // Ensemble setup
  private activeInstrument: BandPlayerInstrumentId = 'marimba';
  private songIdx = 0;
  private bpm = 104;
  private metronomeEnabled = false;
  private mutedTracks = new Set<BandTrackId>(['melody']);
  private playing = false;
  private elapsedSongSec = 0;
  private beatCursor = 0;
  private lastPlayedBar = -1;
  private lastPlayedBeatPip = -1;
  private barsPlayedTotal = 0;
  private totalChallengeBars = 8; // 2 passes of 4 bars

  // Track cursors within the 4-bar loop
  private prevLoopBeat = -0.01;
  private metroLastBeat = -1;
  private metroWidget: MetronomeWidget | null = null;

  // Player evaluation targets
  private playerTargets: BandTargetEvent[] = [];
  private currentTargetHintMidi: number | null = null;
  private currentTargetHintDrum: DrumPieceId | null = null;
  private lastFluteNoteMidi: number | null = null;

  // Active inputs
  private activeKeyCodes = new Map<string, number>();
  private activePointerNotes = new Map<number, number>();
  private padFlashTimers = new Map<string, number>();

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

  // DOM refs
  private stageEl!: HTMLDivElement;
  private sideEl!: HTMLElement;
  private instSelectorEl: HTMLDivElement | null = null;
  private mixerEl: HTMLDivElement | null = null;
  private songToolbarEl: HTMLDivElement | null = null;
  private timelineEl: HTMLDivElement | null = null;
  private chordBannerEl: HTMLDivElement | null = null;
  private instrumentHostEl: HTMLDivElement | null = null;
  private explainHostEl: HTMLDivElement | null = null;
  private statsCardEl: HTMLDivElement | null = null;
  private noteBtnMap = new Map<number, HTMLElement>();
  private drumBtnMap = new Map<DrumPieceId, HTMLButtonElement>();

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
        ? 88
        : ctx.difficulty === 'hyper'
          ? 118
          : ctx.difficulty === 'progressive'
            ? 92
            : BAND_SONGS[0].bpm;

    const layout = createAcademyLayout(
      ctx.container,
      'ENSAMBLE Y XILÓFONO',
      this.isPractice ? 'ESTUDIO DE BANDA' : this.isInfinite ? 'JAM INFINITO' : 'RETO DE ENSAMBLE'
    );
    this.stageEl = layout.stageEl;
    this.sideEl = layout.sideEl;

    this.ctx.setHud({
      dimension: '2D',
      phaseLabel: this.isPractice
        ? 'ENSAMBLE · PRÁCTICA'
        : this.isInfinite
          ? 'ENSAMBLE · JAM INFINITO'
          : 'ENSAMBLE · RETO',
      accent: '#0D9488',
      timeLeftSec: null,
      subStat: '5 instrumentos · 8 bases',
    });

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);

    if (this.isPractice) {
      this.buildWorkspace();
      this.renderAll();
      this.syncControlsBar();
    } else if (this.isInfinite) {
      this.buildWorkspace();
      this.startEnsemblePlayback(true);
      this.syncControlsBar();
    } else {
      this.renderChallengePrep();
    }
  }

  private renderChallengePrep(): void {
    this.stageEl.innerHTML = '';
    this.sideEl.querySelectorAll('.oa-band-dyn-card').forEach((n) => n.remove());

    const prep = document.createElement('div');
    prep.className = 'oa-rp-prep-card';
    prep.innerHTML = `
      <h3 class="oa-rp-prep-title">Elige tu Instrumento y Base de Banda</h3>
      <p class="oa-rp-prep-desc">
        La banda acompaña 8 compases silenciando tu pista para que tú la cubras. Los errores rompen combo pero <strong>nunca cortan la canción</strong>.
      </p>
      <div class="oa-rp-choice-row" id="oa-band-prep-inst"></div>
      <div id="oa-band-prep-song" style="margin-top:6px;"></div>
      <button type="button" class="oa-rp-primary-btn" id="oa-band-start-challenge">
        ${Icons.play(18)}<span>Empezar Reto de Ensamble</span>
      </button>
    `;

    const instRow = prep.querySelector('#oa-band-prep-inst')!;
    const renderInsts = () => {
      instRow.innerHTML = '';
      BAND_INSTRUMENTS.forEach((inst) => {
        instRow.appendChild(
          createActionButton({
            label: inst.shortName,
            pressed: this.activeInstrument === inst.id,
            onClick: () => {
              synthAudio.uiClick();
              this.selectActiveInstrument(inst.id);
              renderInsts();
            },
          })
        );
      });
    };
    renderInsts();

    const songHost = prep.querySelector('#oa-band-prep-song')!;
    const sel = document.createElement('select');
    sel.className = 'oa-mus-select';
    sel.setAttribute('aria-label', 'Elegir base multipista');
    BAND_SONGS.forEach((s, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = `${s.title} · ${s.genre} (${s.bpm} BPM)`;
      if (idx === this.songIdx) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      this.songIdx = Number(sel.value);
      this.bpm = BAND_SONGS[this.songIdx].bpm;
    });
    songHost.appendChild(sel);

    prep.querySelector('#oa-band-start-challenge')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.bpm = BAND_SONGS[this.songIdx].bpm;
      this.buildWorkspace();
      this.startEnsemblePlayback(true);
      this.syncControlsBar();
    });

    this.stageEl.appendChild(prep);

    const card = document.createElement('div');
    card.className = 'oa-academy-card oa-band-dyn-card';
    const ex = document.createElement('div');
    renderExplanationBox(
      ex,
      'Cómo funciona el Ensamble',
      'Selecciona Xilófono, Melódica, Piano, Mini-Batería o Bajo y sigue las notas/pads dorados al ritmo de la banda.',
      'info'
    );
    card.appendChild(ex);
    this.sideEl.appendChild(card);

    this.syncControlsBar();
  }

  private selectActiveInstrument(instId: BandPlayerInstrumentId): void {
    this.activeInstrument = instId;
    const def = BAND_INSTRUMENTS.find((i) => i.id === instId)!;
    this.mutedTracks = new Set([def.suggestedMute]);
  }

  private buildWorkspace(): void {
    this.stageEl.innerHTML = '';
    this.sideEl.querySelectorAll('.oa-band-dyn-card').forEach((n) => n.remove());

    const stageCard = document.createElement('div');
    stageCard.className = 'oa-rp-stage-card';

    // 1. Instrument switcher
    const instBar = document.createElement('div');
    instBar.className = 'oa-piano-tabs';
    this.instSelectorEl = instBar;

    // 2. Song & tempo toolbar
    const songBar = document.createElement('div');
    songBar.className = 'oa-mus-toolbar-row';
    this.songToolbarEl = songBar;

    // 3. 4-track Mixer
    const mixer = document.createElement('div');
    mixer.className = 'oa-band-mixer';
    this.mixerEl = mixer;

    // 4. Chord banner + 16-beat timeline
    const banner = document.createElement('div');
    banner.className = 'oa-mus-banner';
    this.chordBannerEl = banner;

    const timeline = document.createElement('div');
    timeline.className = 'oa-band-timeline';
    this.timelineEl = timeline;

    // 5. Playable instrument area
    const instHost = document.createElement('div');
    this.instrumentHostEl = instHost;

    stageCard.append(instBar, songBar, mixer, banner, timeline, instHost);
    this.stageEl.appendChild(stageCard);

    const explainCard = document.createElement('div');
    explainCard.className = 'oa-academy-card oa-band-dyn-card';
    const explainHost = document.createElement('div');
    this.explainHostEl = explainHost;
    explainCard.appendChild(explainHost);

    const statsCard = document.createElement('div');
    statsCard.className = 'oa-academy-card oa-band-dyn-card';
    this.statsCardEl = statsCard;

    this.sideEl.append(explainCard, statsCard);
    this.updateStatsCard();
  }

  private renderAll(): void {
    this.renderInstrumentSelector();
    this.renderSongToolbar();
    this.renderMixer();
    this.renderBannerAndTimeline();
    this.renderPlayableInstrument();
    this.updateTargetHighlight();
  }

  private renderInstrumentSelector(): void {
    if (!this.instSelectorEl) return;
    this.instSelectorEl.innerHTML = '';
    BAND_INSTRUMENTS.forEach((inst) => {
      this.instSelectorEl!.appendChild(
        createActionButton({
          label: inst.name,
          pressed: this.activeInstrument === inst.id,
          disabled: !this.isPractice && !this.isInfinite,
          onClick: () => {
            synthAudio.uiClick();
            this.stopAllAudioKeepPlayback();
            this.selectActiveInstrument(inst.id);
            if (this.playing) {
              this.playerTargets = this.playerTargets.filter(
                (t) => t.matched || t.missed || t.timeSec <= this.elapsedSongSec
              );
              const song = BAND_SONGS[this.songIdx];
              const passIdx = Math.floor(this.beatCursor / bandSongTotalBeats(song)) + 1;
              this.rebuildPlayerTargets(passIdx, 1);
            }
            this.syncControlsBar();
            this.renderAll();
          },
        })
      );
    });
  }

  private renderSongToolbar(): void {
    if (!this.songToolbarEl) return;
    this.songToolbarEl.innerHTML = '';

    const left = document.createElement('div');
    left.className = 'oa-mus-toolbar-group';

    const sel = document.createElement('select');
    sel.className = 'oa-mus-select';
    sel.setAttribute('aria-label', 'Elegir base de banda');
    sel.disabled = !this.isPractice;
    BAND_SONGS.forEach((s, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = `${s.title} · ${s.genre} (${s.bpm} BPM)`;
      if (idx === this.songIdx) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      this.songIdx = Number(sel.value);
      this.bpm = BAND_SONGS[this.songIdx].bpm;
      if (this.playing) this.startEnsemblePlayback(true);
      else this.renderAll();
    });

    const playBtn = createActionButton({
      label: this.playing ? 'Detener banda' : 'Reproducir banda',
      iconHtml: this.playing ? Icons.pause(15) : Icons.play(15),
      pressed: this.playing,
      className: this.playing ? 'oa-rp-pill-btn is-active' : 'oa-rp-primary-btn',
      onClick: () => {
        if (this.playing) {
          this.stopEnsemblePlayback();
        } else {
          this.startEnsemblePlayback(true);
        }
        this.renderAll();
      },
    });

    left.append(sel, playBtn);

    const right = document.createElement('div');
    right.className = 'oa-mus-toolbar-group';

    this.metroWidget = createMetronomeControl({
      enabled: this.metronomeEnabled,
      onToggle: (enabled) => {
        this.metronomeEnabled = enabled;
      },
    });

    right.append(
      createBpmControl({
        bpm: this.bpm,
        onChange: (next) => {
          this.bpm = next;
          this.rescheduleRemainingTargets();
        },
      }),
      this.metroWidget.root
    );

    this.songToolbarEl.append(left, right);
  }

  private renderMixer(): void {
    if (!this.mixerEl) return;
    this.mixerEl.innerHTML = '';

    BAND_TRACK_IDS.forEach((trackId) => {
      const isMuted = this.mutedTracks.has(trackId);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `oa-band-track-btn ${isMuted ? 'is-muted-for-player' : 'is-playing'}`;
      btn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
      btn.innerHTML = `
        <strong>${isMuted ? `Quitar ${TRACK_LABELS[trackId]} (Tú tocas)` : `${TRACK_LABELS[trackId]} activa`}</strong>
        <span class="oa-band-track-state">${isMuted ? 'SILENCIADA PARA TI' : 'SONANDO EN BANDA'}</span>
      `;
      btn.addEventListener('click', () => {
        synthAudio.uiClick();
        if (this.mutedTracks.has(trackId)) {
          this.mutedTracks.delete(trackId);
        } else {
          this.mutedTracks.add(trackId);
        }
        this.renderMixer();
      });
      this.mixerEl!.appendChild(btn);
    });
  }

  private renderBannerAndTimeline(): void {
    const song = BAND_SONGS[this.songIdx];
    const loopBeat = this.playing ? this.beatCursor % bandSongTotalBeats(song) : 0;
    const barInSong = Math.floor(loopBeat / 4);
    const activeChord =
      song.tracks.chords.find((c) => c.beat <= loopBeat && loopBeat < c.beat + c.dur) ??
      song.tracks.chords[barInSong * 2] ??
      song.tracks.chords[0];

    if (this.chordBannerEl) {
      const barInfo = this.isInfinite
        ? `Compás ${this.barsPlayedTotal + 1} · ${Math.round(this.bpm)} BPM`
        : !this.isPractice
          ? `Compás ${Math.min(this.barsPlayedTotal + 1, this.totalChallengeBars)}/${this.totalChallengeBars}`
          : `Compás ${barInSong + 1}/${song.bars}`;
      this.chordBannerEl.innerHTML = `
        <div>
          <div class="oa-explain-heading">${song.title} · ${song.keyLabel}</div>
          <div class="oa-explain-body">${barInfo}</div>
        </div>
        <span class="oa-mus-chord-badge">Acorde: ${activeChord?.label ?? '-'}</span>
      `;
    }

    if (this.timelineEl) {
      this.timelineEl.innerHTML = '';
      const activePip = Math.floor(loopBeat) % 16;
      for (let i = 0; i < 16; i++) {
        const pip = document.createElement('div');
        pip.className = 'oa-band-beat-pip';
        if (i % 4 === 0) pip.classList.add('is-bar-start');
        if (this.playing && i === activePip) pip.classList.add('is-active');
        this.timelineEl.appendChild(pip);
      }
    }

    if (this.explainHostEl) {
      const instDef = BAND_INSTRUMENTS.find((i) => i.id === this.activeInstrument)!;
      renderExplanationBox(
        this.explainHostEl,
        `${instDef.name} sobre ${song.title}`,
        `${instDef.hint} ${song.description}`,
        'info'
      );
    }
  }

  private renderPlayableInstrument(): void {
    if (!this.instrumentHostEl) return;
    this.instrumentHostEl.innerHTML = '';
    this.noteBtnMap.clear();
    this.drumBtnMap.clear();

    if (this.activeInstrument === 'marimba') {
      this.renderMarimbaUI(this.instrumentHostEl);
    } else if (this.activeInstrument === 'flute') {
      this.renderFluteUI(this.instrumentHostEl);
    } else if (this.activeInstrument === 'piano') {
      this.renderPianoUI(this.instrumentHostEl);
    } else if (this.activeInstrument === 'miniDrums') {
      this.renderMiniDrumsUI(this.instrumentHostEl);
    } else {
      this.renderBassUI(this.instrumentHostEl);
    }
  }

  private renderMarimbaUI(host: HTMLElement): void {
    const scroll = document.createElement('div');
    scroll.className = 'oa-marimba-scroll';
    const rack = document.createElement('div');
    rack.className = 'oa-marimba-rack';

    const sharpsRow = document.createElement('div');
    sharpsRow.className = 'oa-marimba-sharps';
    const sharpByCol = new Map(MARIMBA_SHARPS.map((s) => [s.col, s]));
    for (let col = 0; col < 15; col++) {
      const s = sharpByCol.get(col);
      if (!s) {
        const sp = document.createElement('div');
        sp.className = 'oa-marimba-spacer';
        sharpsRow.appendChild(sp);
        continue;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-marimba-bar is-sharp';
      btn.innerHTML = `<span class="oa-piano-note-lbl">${s.label}</span><kbd class="oa-piano-kbd-lbl">${s.kbd}</kbd>`;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.handlePlayerMidiPress(`ptr_${e.pointerId}`, s.midi, 'marimba');
      });
      this.noteBtnMap.set(s.midi, btn);
      sharpsRow.appendChild(btn);
    }

    const naturalsRow = document.createElement('div');
    naturalsRow.className = 'oa-marimba-naturals';
    MARIMBA_NATURALS.forEach((bar, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-marimba-bar';
      const heightPct = 100 - idx * 2.2;
      btn.style.height = `${heightPct.toFixed(1)}%`;
      btn.style.background = MARIMBA_COLORS[idx % MARIMBA_COLORS.length];
      btn.innerHTML = `<span class="oa-piano-note-lbl">${bar.label}</span><kbd class="oa-piano-kbd-lbl">${bar.kbd}</kbd>`;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.handlePlayerMidiPress(`ptr_${e.pointerId}`, bar.midi, 'marimba');
      });
      this.noteBtnMap.set(bar.midi, btn);
      naturalsRow.appendChild(btn);
    });

    rack.append(sharpsRow, naturalsRow);
    scroll.appendChild(rack);
    host.appendChild(scroll);
  }

  private renderFluteUI(host: HTMLElement): void {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '8px';

    const holesBar = document.createElement('div');
    holesBar.className = 'oa-flute-holes';
    holesBar.id = 'oa-band-flute-holes';
    const noteToShow = this.lastFluteNoteMidi ?? this.currentTargetHintMidi ?? 60;
    this.fillFluteHoles(holesBar, noteToShow);

    const grid = document.createElement('div');
    grid.className = 'oa-chord-library';
    FLUTE_RANGE_MIDIS.forEach((midi) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-rp-pill-btn';
      btn.textContent = formatMidiNameEs(midi);
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this.paused || this.destroyed) return;
        this.activePointerNotes.set(e.pointerId, midi);
        this.lastFluteNoteMidi = midi;
        this.fillFluteHoles(holesBar, midi);
        this.handlePlayerMidiHoldStart(`ptr_${e.pointerId}`, midi, 'flute');
      });
      const rel = (e: PointerEvent) => {
        const active = this.activePointerNotes.get(e.pointerId);
        if (active !== undefined) {
          this.activePointerNotes.delete(e.pointerId);
          this.handlePlayerMidiHoldEnd(`ptr_${e.pointerId}`, active);
        }
      };
      btn.addEventListener('pointerup', rel);
      btn.addEventListener('pointercancel', rel);
      this.noteBtnMap.set(midi, btn);
      grid.appendChild(btn);
    });

    wrap.append(holesBar, grid);
    host.appendChild(wrap);
  }

  private fillFluteHoles(holesBar: HTMLElement, midi: number): void {
    const semitone = ((midi % 12) + 12) % 12;
    const closedCount = Math.max(0, 6 - Math.floor(semitone / 2));
    holesBar.innerHTML = `<span class="oa-explain-heading">Digitación (${formatMidiNameEs(midi)}):</span>`;
    for (let i = 0; i < 6; i++) {
      const h = document.createElement('span');
      h.className = `oa-flute-hole${i < closedCount ? ' is-closed' : ''}`;
      holesBar.appendChild(h);
    }
  }

  private renderPianoUI(host: HTMLElement): void {
    const scroll = document.createElement('div');
    scroll.className = 'oa-piano-scroll';
    const keyboard = document.createElement('div');
    keyboard.className = 'oa-piano-keyboard';
    const whitesWrap = document.createElement('div');
    whitesWrap.className = 'oa-piano-whites';
    const whiteW = 100 / WHITE_KEY_COUNT;

    for (const k of PIANO_KEYS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `oa-piano-key ${k.isBlack ? 'oa-piano-key-black' : 'oa-piano-key-white'}`;
      if (k.isBlack) {
        const bw = whiteW * 0.62;
        const left = (k.whiteIndex + 1) * whiteW - bw / 2;
        btn.style.left = `calc(${left.toFixed(3)}% + 3px)`;
        btn.style.width = `calc(${bw.toFixed(3)}% - 2px)`;
      }
      btn.innerHTML = `<span class="oa-piano-note-lbl">${k.midi % 12 === 0 ? k.noteName : k.shortName}</span><kbd class="oa-piano-kbd-lbl">${k.keyLabel}</kbd>`;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this.paused || this.destroyed) return;
        this.activePointerNotes.set(e.pointerId, k.midi);
        this.handlePlayerMidiHoldStart(`ptr_${e.pointerId}`, k.midi, 'piano');
      });
      const rel = (e: PointerEvent) => {
        const m = this.activePointerNotes.get(e.pointerId);
        if (m !== undefined) {
          this.activePointerNotes.delete(e.pointerId);
          this.handlePlayerMidiHoldEnd(`ptr_${e.pointerId}`, m);
        }
      };
      btn.addEventListener('pointerup', rel);
      btn.addEventListener('pointercancel', rel);
      this.noteBtnMap.set(k.midi, btn);
      if (k.isBlack) keyboard.appendChild(btn);
      else whitesWrap.appendChild(btn);
    }

    keyboard.insertBefore(whitesWrap, keyboard.firstChild);
    scroll.appendChild(keyboard);
    host.appendChild(scroll);
  }

  private renderMiniDrumsUI(host: HTMLElement): void {
    const grid = document.createElement('div');
    grid.className = 'oa-drums-kit';
    MINI_DRUM_PADS.forEach((pad) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oa-drum-pad';
      btn.style.setProperty('--drum-color', pad.color);
      btn.innerHTML = `<span class="oa-drum-pad-name">${pad.label}</span><kbd class="oa-drum-pad-key">${pad.keyLabel}</kbd>`;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this.paused || this.destroyed) return;
        this.handlePlayerDrumHit(pad.id);
      });
      this.drumBtnMap.set(pad.id, btn);
      grid.appendChild(btn);
    });
    host.appendChild(grid);
  }

  private renderBassUI(host: HTMLElement): void {
    const inst = STRING_INSTRUMENTS.bass;
    const scroll = document.createElement('div');
    scroll.className = 'oa-fretboard-scroll';
    const board = document.createElement('div');
    board.className = 'oa-fretboard';

    const nums = document.createElement('div');
    nums.className = 'oa-fret-numbers';
    nums.style.gridTemplateColumns = '90px repeat(8, minmax(0, 1fr))';
    const sp = document.createElement('span');
    sp.className = 'oa-string-label';
    sp.textContent = 'Bajo (4c)';
    nums.appendChild(sp);
    for (let f = 0; f <= 7; f++) {
      const n = document.createElement('span');
      n.className = `oa-fret-num${f === 3 || f === 5 || f === 7 ? ' is-marker' : ''}`;
      n.textContent = f === 0 ? 'Aire' : String(f);
      nums.appendChild(n);
    }
    board.appendChild(nums);

    for (let s = 0; s < inst.strings.length; s++) {
      const row = document.createElement('div');
      row.className = 'oa-fret-row';
      row.style.gridTemplateColumns = '90px repeat(8, minmax(0, 1fr))';
      row.style.setProperty('--string-thick', `${(2.0 + s * 0.6).toFixed(2)}px`);

      const lbl = document.createElement('span');
      lbl.className = 'oa-string-label';
      lbl.textContent = `${inst.stringLabels[s]} [${s + 1}]`;
      row.appendChild(lbl);

      for (let f = 0; f <= 7; f++) {
        const midi = fretMidi('bass', s, f);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = `oa-fret-cell${f === 0 ? ' is-nut' : ''}`;
        cell.setAttribute('aria-label', `${inst.stringLabels[s]} traste ${f}: ${formatMidiNameEs(midi)}`);
        cell.addEventListener('click', () => {
          this.handlePlayerMidiPress(`bass_${s}_${f}`, midi, 'bass');
        });
        if (!this.noteBtnMap.has(midi)) {
          this.noteBtnMap.set(midi, cell);
        }
        row.appendChild(cell);
      }
      board.appendChild(row);
    }

    scroll.appendChild(board);
    host.appendChild(scroll);
  }

  private handlePlayerMidiPress(id: string, midi: number, timbre: 'marimba' | 'flute' | 'piano' | 'bass'): void {
    synthAudio.playMidiNote(midi, 0.65, timbre);
    this.flashElement(this.noteBtnMap.get(midi), id);
    this.evaluateMidiHit(midi);
  }

  private handlePlayerMidiHoldStart(id: string, midi: number, timbre: 'flute' | 'piano'): void {
    synthAudio.noteOn(id, midi, timbre);
    this.noteBtnMap.get(midi)?.classList.add('is-pressed');
    this.evaluateMidiHit(midi);
  }

  private handlePlayerMidiHoldEnd(id: string, midi: number): void {
    synthAudio.noteOff(id);
    this.noteBtnMap.get(midi)?.classList.remove('is-pressed');
  }

  private handlePlayerDrumHit(piece: DrumPieceId): void {
    synthAudio.playDrum(piece, 0.95);
    const btn = this.drumBtnMap.get(piece);
    if (btn) {
      btn.classList.remove('is-hit');
      void btn.offsetWidth;
      btn.classList.add('is-hit');
      const prev = this.padFlashTimers.get(piece);
      if (prev !== undefined) window.clearTimeout(prev);
      this.padFlashTimers.set(
        piece,
        window.setTimeout(() => btn.classList.remove('is-hit'), 120)
      );
    }
    this.evaluateDrumHit(piece);
  }

  private flashElement(el: HTMLElement | undefined, key: string): void {
    if (!el) return;
    el.classList.add('is-pressed');
    const prev = this.padFlashTimers.get(key);
    if (prev !== undefined) window.clearTimeout(prev);
    this.padFlashTimers.set(
      key,
      window.setTimeout(() => el.classList.remove('is-pressed'), 140)
    );
  }

  private startEnsemblePlayback(resetPosition: boolean): void {
    synthAudio.stopAllNotes();
    if (resetPosition) {
      this.elapsedSongSec = 0;
      this.beatCursor = 0;
      this.prevLoopBeat = -0.01;
      this.lastPlayedBar = -1;
      this.lastPlayedBeatPip = -1;
      this.barsPlayedTotal = 0;
      this.metroLastBeat = -1;
      this.playerTargets = [];
      this.rebuildPlayerTargets(0, this.isInfinite ? 1 : 2);
    }
    this.playing = true;
    this.renderAll();
  }

  private stopEnsemblePlayback(): void {
    this.playing = false;
    synthAudio.stopAllNotes();
  }

  private stopAllAudioKeepPlayback(): void {
    this.activeKeyCodes.clear();
    this.activePointerNotes.clear();
    synthAudio.stopAllNotes();
  }

  private rebuildPlayerTargets(startPassIndex: number, passCount: number): void {
    const song = BAND_SONGS[this.songIdx];
    const totalBeats = bandSongTotalBeats(song);
    const secPerBeat = 60 / this.bpm;
    const def = BAND_INSTRUMENTS.find((i) => i.id === this.activeInstrument)!;
    const track = def.suggestedMute;

    for (let p = 0; p < passCount; p++) {
      const beatBase = (startPassIndex + p) * totalBeats;
      if (track === 'drums') {
        for (const d of song.tracks.drums) {
          if (!DRUM_PIECE_BY_ID.has(d.piece)) continue;
          const mappedPiece: DrumPieceId = d.piece === 'ride' ? 'crash' : d.piece === 'tom_low' ? 'tom_high' : d.piece;
          const bAbs = beatBase + d.beat;
          this.playerTargets.push({ beatAbs: bAbs, timeSec: bAbs * secPerBeat, piece: mappedPiece, matched: false, missed: false });
        }
      } else if (track === 'bass') {
        for (const b of song.tracks.bass) {
          const bAbs = beatBase + b.beat;
          this.playerTargets.push({ beatAbs: bAbs, timeSec: bAbs * secPerBeat, midi: b.midi, matched: false, missed: false });
        }
      } else if (track === 'chords') {
        for (const c of song.tracks.chords) {
          const bAbs = beatBase + c.beat;
          this.playerTargets.push({ beatAbs: bAbs, timeSec: bAbs * secPerBeat, midi: c.midis[0], matched: false, missed: false });
        }
      } else {
        for (const n of song.tracks.melody) {
          const bAbs = beatBase + n.beat;
          this.playerTargets.push({ beatAbs: bAbs, timeSec: bAbs * secPerBeat, midi: n.midi, matched: false, missed: false });
        }
      }
    }
  }

  private rescheduleRemainingTargets(): void {
    const secPerBeat = 60 / this.bpm;
    for (const t of this.playerTargets) {
      if (!t.matched && !t.missed) {
        t.timeSec = t.beatAbs * secPerBeat;
      }
    }
  }

  private evaluateMidiHit(midi: number): void {
    if (!this.playing) return;
    let best: BandTargetEvent | null = null;
    let bestAbsMs = Infinity;
    let bestDeltaMs = 0;

    for (const t of this.playerTargets) {
      if (t.matched || t.missed || t.midi === undefined) continue;
      // Match same note or pitch class if instrument octave differs slightly (e.g. Piano Do3-Do5)
      const samePitch = t.midi === midi || (this.activeInstrument === 'piano' && t.midi % 12 === midi % 12);
      if (!samePitch) continue;
      const deltaMs = (this.elapsedSongSec - t.timeSec) * 1000;
      const absMs = Math.abs(deltaMs);
      if (absMs < bestAbsMs) {
        bestAbsMs = absMs;
        bestDeltaMs = deltaMs;
        best = t;
      }
    }

    if (best && bestAbsMs <= 210) {
      best.matched = true;
      this.recordBandGrade(gradeTiming(bestDeltaMs), bestDeltaMs);
    } else if (!this.isPractice) {
      this.misses += 1;
      this.combo = 0;
      this.ctx.breakCombo();
      this.updateStatsCard();
    }
  }

  private evaluateDrumHit(piece: DrumPieceId): void {
    if (!this.playing) return;
    let best: BandTargetEvent | null = null;
    let bestAbsMs = Infinity;
    let bestDeltaMs = 0;

    for (const t of this.playerTargets) {
      if (t.matched || t.missed || t.piece !== piece) continue;
      const deltaMs = (this.elapsedSongSec - t.timeSec) * 1000;
      const absMs = Math.abs(deltaMs);
      if (absMs < bestAbsMs) {
        bestAbsMs = absMs;
        bestDeltaMs = deltaMs;
        best = t;
      }
    }

    if (best && bestAbsMs <= 210) {
      best.matched = true;
      this.recordBandGrade(gradeTiming(bestDeltaMs), bestDeltaMs);
    } else if (!this.isPractice) {
      this.misses += 1;
      this.combo = 0;
      this.ctx.breakCombo();
      this.updateStatsCard();
    }
  }

  private recordBandGrade(grade: HitGrade, deltaMs: number): void {
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

  private updateTargetHighlight(): void {
    for (const el of this.noteBtnMap.values()) {
      el.classList.remove('is-target');
    }
    for (const btn of this.drumBtnMap.values()) {
      btn.classList.remove('is-target');
    }

    const next = this.playerTargets.find((t) => !t.matched && !t.missed && t.timeSec >= this.elapsedSongSec - 0.15);
    this.currentTargetHintMidi = next?.midi ?? null;
    this.currentTargetHintDrum = next?.piece ?? null;

    if (this.currentTargetHintMidi !== null) {
      let btn = this.noteBtnMap.get(this.currentTargetHintMidi);
      if (!btn && this.activeInstrument === 'piano') {
        // Bring into C3..C5 range for piano
        let m = this.currentTargetHintMidi;
        while (m > 72) m -= 12;
        while (m < 48) m += 12;
        btn = this.noteBtnMap.get(m);
      }
      btn?.classList.add('is-target');
    }
    if (this.currentTargetHintDrum) {
      this.drumBtnMap.get(this.currentTargetHintDrum)?.classList.add('is-target');
    }
  }

  private updateStatsCard(): void {
    if (!this.statsCardEl) return;
    renderMusicStatsCard(this.statsCardEl, this.ctx, {
      hits: this.hits,
      misses: this.misses,
      maxCombo: this.maxCombo,
      extraLine: `Compases: <strong>${this.barsPlayedTotal}</strong>`,
      subStatPrefix: BAND_INSTRUMENTS.find((i) => i.id === this.activeInstrument)?.shortName,
    });
  }

  private syncControlsBar(): void {
    if (this.activeInstrument === 'miniDrums') {
      this.ctx.setControls?.([
        { keys: ['Espacio', 'F', 'J', 'K', 'D', 'R'], touch: 'Toca los pads', action: 'Tocar Mini-Batería', tone: 'primary' },
      ]);
      return;
    }
    if (this.activeInstrument === 'bass') {
      this.ctx.setControls?.([
        { keys: ['1–4'], touch: 'Toca trastes 0–7', action: 'Pulsar notas de bajo', tone: 'primary' },
      ]);
      return;
    }
    this.ctx.setControls?.([
      { keys: ['Z–M', 'Q–I', '2 3 5 6 7'], touch: 'Láminas / teclas', action: 'Tocar sobre la banda', tone: 'primary' },
    ]);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.destroyed || shouldIgnoreGameHotkey(e) || e.repeat) return;

    if (this.activeInstrument === 'miniDrums') {
      const pad = MINI_DRUM_PADS.find((p) => p.code === e.code);
      if (pad) {
        e.preventDefault();
        this.handlePlayerDrumHit(pad.id);
      }
      return;
    }

    if (this.activeInstrument === 'bass') {
      const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
      if (m) {
        e.preventDefault();
        const sIdx = Number(m[1]) - 1;
        this.handlePlayerMidiPress(`kbd_b_${sIdx}`, fretMidi('bass', sIdx, 0), 'bass');
      }
      return;
    }

    if (this.activeInstrument === 'marimba') {
      const nat = MARIMBA_NATURALS.find((n) => n.code === e.code);
      const shp = MARIMBA_SHARPS.find((s) => s.code === e.code);
      const digit = /^(?:Digit|Numpad)([1-8])$/.exec(e.code);
      const midi = nat?.midi ?? shp?.midi ?? (digit ? MARIMBA_NATURALS[Number(digit[1]) - 1]?.midi : undefined);
      if (midi !== undefined) {
        e.preventDefault();
        this.handlePlayerMidiPress(`kbd_${e.code}`, midi, 'marimba');
      }
      return;
    }

    const kDef = PIANO_KEY_BY_CODE.get(e.code);
    if (kDef) {
      e.preventDefault();
      if (this.activeKeyCodes.has(e.code)) return;
      const targetMidi = this.activeInstrument === 'flute' ? kDef.midi + 12 : kDef.midi;
      const clamped = this.activeInstrument === 'flute' ? Math.max(60, Math.min(79, targetMidi)) : kDef.midi;
      this.activeKeyCodes.set(e.code, clamped);
      if (this.activeInstrument === 'flute') {
        this.lastFluteNoteMidi = clamped;
        const holes = this.instrumentHostEl?.querySelector('#oa-band-flute-holes') as HTMLElement | null;
        if (holes) this.fillFluteHoles(holes, clamped);
      }
      this.handlePlayerMidiHoldStart(`kbd_${e.code}`, clamped, this.activeInstrument === 'flute' ? 'flute' : 'piano');
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const midi = this.activeKeyCodes.get(e.code);
    if (midi !== undefined) {
      this.activeKeyCodes.delete(e.code);
      this.handlePlayerMidiHoldEnd(`kbd_${e.code}`, midi);
    }
  };

  private onWindowBlur = (): void => {
    this.activeKeyCodes.clear();
    this.activePointerNotes.clear();
    for (const el of this.noteBtnMap.values()) el.classList.remove('is-pressed');
    for (const el of this.drumBtnMap.values()) el.classList.remove('is-hit');
    this.metroWidget?.clearPulse();
    synthAudio.stopAllNotes();
  };

  public update(dt: number, _elapsed: number): void {
    if (this.paused || this.destroyed || !this.playing) return;

    const song = BAND_SONGS[this.songIdx];
    const totalSongBeats = bandSongTotalBeats(song);
    const secPerBeat = 60 / this.bpm;

    this.elapsedSongSec += dt;
    this.beatCursor = this.elapsedSongSec / secPerBeat;
    const loopBeat = this.beatCursor % totalSongBeats;

    // Metronome
    if (this.metronomeEnabled) {
      const beatInt = Math.floor(this.beatCursor);
      if (beatInt !== this.metroLastBeat) {
        this.metroLastBeat = beatInt;
        const accent = beatInt % 4 === 0;
        synthAudio.playMetronomeClick(accent);
        this.metroWidget?.flashBeat(accent);
      }
    }

    // Trigger backing tracks when crossing loopBeat window (handles wrap cleanly)
    const triggerInRange = (beat: number) => {
      if (this.prevLoopBeat <= loopBeat) {
        return beat > this.prevLoopBeat && beat <= loopBeat;
      }
      return beat > this.prevLoopBeat || beat <= loopBeat;
    };

    if (!this.mutedTracks.has('drums')) {
      for (const d of song.tracks.drums) {
        if (triggerInRange(d.beat)) synthAudio.playDrum(d.piece, d.velocity ?? 0.85);
      }
    }
    if (!this.mutedTracks.has('bass')) {
      for (const b of song.tracks.bass) {
        if (triggerInRange(b.beat)) synthAudio.playMidiNote(b.midi, Math.max(0.15, b.dur * secPerBeat), 'bass');
      }
    }
    if (!this.mutedTracks.has('chords')) {
      for (const c of song.tracks.chords) {
        if (triggerInRange(c.beat)) synthAudio.playChord([...c.midis], Math.max(0.25, c.dur * secPerBeat), 'piano', 0.01);
      }
    }
    if (!this.mutedTracks.has('melody')) {
      for (const n of song.tracks.melody) {
        if (triggerInRange(n.beat)) synthAudio.playMidiNote(n.midi, Math.max(0.18, n.dur * secPerBeat), 'marimba');
      }
    }

    this.prevLoopBeat = loopBeat;

    // Miss overdue player targets
    for (const t of this.playerTargets) {
      if (!t.matched && !t.missed && this.elapsedSongSec - t.timeSec > 0.215) {
        t.missed = true;
        if (!this.isPractice) {
          this.misses += 1;
          this.combo = 0;
          this.ctx.breakCombo();
          this.updateStatsCard();
        }
      }
    }

    const absBar = Math.floor(this.beatCursor / 4);
    const beatPip = Math.floor(this.beatCursor);
    if (absBar !== this.lastPlayedBar || beatPip !== this.lastPlayedBeatPip) {
      if (absBar > this.lastPlayedBar && this.lastPlayedBar >= 0) {
        this.barsPlayedTotal += 1;
        // Infinite mode: every 8 bars bump BPM & rotate song
        if (this.isInfinite && this.barsPlayedTotal % 8 === 0) {
          this.bpm = Math.min(155, this.bpm + 4);
          this.songIdx = (this.songIdx + 1) % BAND_SONGS.length;
          this.ctx.toast(`¡Jam Infinito! ${BAND_SONGS[this.songIdx].title} · ${Math.round(this.bpm)} BPM`, 'good');
        }
        if (this.isInfinite || this.isPractice) {
          const passIdx = Math.floor(this.barsPlayedTotal / song.bars);
          const havePass = this.playerTargets.some((t) => Math.floor(t.beatAbs / totalSongBeats) >= passIdx + 1);
          if (!havePass) this.rebuildPlayerTargets(passIdx + 1, 1);
        }
      }
      this.lastPlayedBar = absBar;
      this.lastPlayedBeatPip = beatPip;
      this.renderBannerAndTimeline();
    }

    this.updateTargetHighlight();

    if (!this.isPractice && !this.isInfinite && this.barsPlayedTotal >= this.totalChallengeBars) {
      this.finishChallengeRun();
    }
  }

  private finishChallengeRun(): void {
    if (this.finishedEmitted) return;
    this.finishedEmitted = true;
    this.stopEnsemblePlayback();
    synthAudio.puzzleSuccess(4);

    const summary = summarizeMusicRun({
      hits: this.hits,
      misses: this.misses,
      perfect: this.perfectHits,
      good: this.goodHits,
      ok: this.okHits,
      totalTargets: Math.max(1, this.playerTargets.length),
      timingDeviationsMs: this.timingDeviationsMs,
      maxCombo: this.maxCombo,
    });

    this.ctx.finish({
      score: Math.max(this.score, summary.score),
      maxCombo: this.maxCombo,
      accuracy: summary.accuracy,
      hits: this.hits,
      misses: this.misses,
      puzzlesSolved: this.barsPlayedTotal,
      survived: true,
      infiniteMode: this.isInfinite,
      axisPerformances: {
        rhythm: summary.rhythmPerf,
      },
    });
  }

  public onResize(): void {
    // Scrollable horizontal layouts adapt automatically
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
      puzzlesSolved: this.barsPlayedTotal,
      survived: true,
      infiniteMode: this.isInfinite,
      axisPerformances: {
        rhythm: summary.rhythmPerf,
      },
    };
  }

  public destroy(): void {
    this.destroyed = true;
    this.playing = false;
    this.metronomeEnabled = false;
    this.metroWidget?.clearPulse();
    for (const timer of this.padFlashTimers.values()) window.clearTimeout(timer);
    this.padFlashTimers.clear();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    synthAudio.stopAllNotes();
  }
}
