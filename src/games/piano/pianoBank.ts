export type PianoClef = 'treble' | 'bass';
export type ChordQuality = 'major' | 'minor' | 'seventh';

export interface PianoKeyDef {
  midi: number;
  noteName: string;   // 'Do3', 'Do#3', ...
  shortName: string;  // 'Do', 'Do#', ...
  octave: number;     // 3, 4, 5
  isBlack: boolean;
  code: string;       // KeyboardEvent.code ('KeyZ'..'KeyI')
  keyLabel: string;   // 'Z', 'S', '2', ...
  whiteIndex: number; // 0..14 for white keys; preceding white index for black keys
}

export interface ChordQualityDef {
  id: ChordQuality;
  label: string;
  intervals: number[];
  description: string;
}

export interface MelodyNote {
  midi: number;
  beats: number;
  lyric?: string;
}

export type MelodyLevel = 'Inicial' | 'Intermedio' | 'Avanzado';
export const MELODY_LEVELS: readonly MelodyLevel[] = ['Inicial', 'Intermedio', 'Avanzado'];

export interface ChordCue {
  beat: number;
  root: number;
  quality: ChordQuality;
  label: string;
}

export interface GuidedMelody {
  id: string;
  title: string;
  composer: string;
  level: MelodyLevel;
  genre: string;
  bpm: number;
  notes: MelodyNote[];
  chords?: ChordCue[];
}

export interface IntervalDef {
  semitones: number;
  name: string;
  shortName: string;
  example: string;
  explanation: string;
}

export interface StaffNotePosition {
  midi: number;
  clef: PianoClef;
  stepFromBottomLine: number; // 0 = bottom staff line, 2 = 2nd line, ..., 8 = top line; -2 = C4 ledger line
  accidental: '#' | '';
  ledgerSteps: number[]; // step indices needing ledger lines (even numbers outside 0..8)
}

const KEY_SPEC_ROWS: readonly [number, string, string, boolean, string, string][] = [
  [48, 'Do3', 'Do', false, 'KeyZ', 'Z'],
  [49, 'Do#3', 'Do#', true, 'KeyS', 'S'],
  [50, 'Re3', 'Re', false, 'KeyX', 'X'],
  [51, 'Re#3', 'Re#', true, 'KeyD', 'D'],
  [52, 'Mi3', 'Mi', false, 'KeyC', 'C'],
  [53, 'Fa3', 'Fa', false, 'KeyV', 'V'],
  [54, 'Fa#3', 'Fa#', true, 'KeyG', 'G'],
  [55, 'Sol3', 'Sol', false, 'KeyB', 'B'],
  [56, 'Sol#3', 'Sol#', true, 'KeyH', 'H'],
  [57, 'La3', 'La', false, 'KeyN', 'N'],
  [58, 'La#3', 'La#', true, 'KeyJ', 'J'],
  [59, 'Si3', 'Si', false, 'KeyM', 'M'],
  [60, 'Do4', 'Do', false, 'KeyQ', 'Q'],
  [61, 'Do#4', 'Do#', true, 'Digit2', '2'],
  [62, 'Re4', 'Re', false, 'KeyW', 'W'],
  [63, 'Re#4', 'Re#', true, 'Digit3', '3'],
  [64, 'Mi4', 'Mi', false, 'KeyE', 'E'],
  [65, 'Fa4', 'Fa', false, 'KeyR', 'R'],
  [66, 'Fa#4', 'Fa#', true, 'Digit5', '5'],
  [67, 'Sol4', 'Sol', false, 'KeyT', 'T'],
  [68, 'Sol#4', 'Sol#', true, 'Digit6', '6'],
  [69, 'La4', 'La', false, 'KeyY', 'Y'],
  [70, 'La#4', 'La#', true, 'Digit7', '7'],
  [71, 'Si4', 'Si', false, 'KeyU', 'U'],
  [72, 'Do5', 'Do', false, 'KeyI', 'I'],
];

export const PIANO_KEYS: readonly PianoKeyDef[] = (() => {
  let whiteIdx = -1;
  return KEY_SPEC_ROWS.map(([midi, noteName, shortName, isBlack, code, keyLabel]) => {
    if (!isBlack) whiteIdx += 1;
    return {
      midi,
      noteName,
      shortName,
      octave: Math.floor(midi / 12) - 1,
      isBlack,
      code,
      keyLabel,
      whiteIndex: whiteIdx,
    };
  });
})();

export const PIANO_KEY_BY_MIDI = new Map<number, PianoKeyDef>(
  PIANO_KEYS.map((k) => [k.midi, k])
);

export const PIANO_KEY_BY_CODE = new Map<string, PianoKeyDef>(
  PIANO_KEYS.map((k) => [k.code, k])
);

export const WHITE_KEY_COUNT = PIANO_KEYS.filter((k) => !k.isBlack).length; // 15

const CHROMATIC_NAMES_ES = [
  'Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si',
] as const;

export function formatMidiNameEs(midi: number, withOctave = true): string {
  const name = CHROMATIC_NAMES_ES[((midi % 12) + 12) % 12];
  if (!withOctave) return name;
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export const CHORD_QUALITIES: Record<ChordQuality, ChordQualityDef> = {
  major: {
    id: 'major',
    label: 'Mayor',
    intervals: [0, 4, 7],
    description: 'Sonoridad brillante y estable: fundamental + 3ª mayor (+4) + 5ª justa (+7).',
  },
  minor: {
    id: 'minor',
    label: 'menor',
    intervals: [0, 3, 7],
    description: 'Sonoridad cálida o melancólica: fundamental + 3ª menor (+3) + 5ª justa (+7).',
  },
  seventh: {
    id: 'seventh',
    label: 'Séptima',
    intervals: [0, 4, 7, 10],
    description: 'Acorde de dominante con tensión que pide resolver: mayor + 7ª menor (+10).',
  },
};

export function buildChordMidis(rootMidi: number, quality: ChordQuality): number[] {
  return CHORD_QUALITIES[quality].intervals.map((step) => rootMidi + step);
}

export function describeChordEs(rootMidi: number, quality: ChordQuality): {
  title: string;
  midis: number[];
  noteNames: string[];
  explanation: string;
} {
  const midis = buildChordMidis(rootMidi, quality);
  const noteNames = midis.map((m) => formatMidiNameEs(m, false));
  const rootName = formatMidiNameEs(rootMidi, false);
  const qDef = CHORD_QUALITIES[quality];
  return {
    title: `${rootName} ${qDef.label}: ${noteNames.join(' - ')}`,
    midis,
    noteNames,
    explanation: `${qDef.description} Notas: ${noteNames.join(', ')}.`,
  };
}


const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Convierte 'E4' / 'F#3' / 'Bb3' (cifrado inglés) a MIDI (C4 = 60). */
export function noteNameToMidi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Nota invalida: ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + NOTE_PC[m[1]] + acc;
}

/** 'E4 E4:1.5 D4:.5' -> MelodyNote[] (duración por defecto: 1 pulso). */
function melody(spec: string): MelodyNote[] {
  return spec
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const [name, dur] = tok.split(':');
      return { midi: noteNameToMidi(name), beats: dur ? Number(dur) : 1 };
    });
}

/** 'C@0 G@4' -> ChordCue[]; calidad por sufijo: nada = mayor, m = menor, 7 = séptima. */
function cues(spec: string): ChordCue[] {
  return spec
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const [chord, beat] = tok.split('@');
      const m = /^([A-G][#b]?)(m|7)?$/.exec(chord);
      if (!m) throw new Error(`Acorde invalido: ${chord}`);
      const quality: ChordQuality = m[2] === 'm' ? 'minor' : m[2] === '7' ? 'seventh' : 'major';
      const rootPc = noteNameToMidi(`${m[1]}3`) % 12;
      return { beat: Number(beat), root: 48 + rootPc, quality, label: chord };
    });
}

function repeatSpec(spec: string, times: number): string {
  return Array(times).fill(spec.trim()).join(' ');
}

export const GUIDED_MELODIES: readonly GuidedMelody[] = [
  // ---------- Inicial ----------
  {
    id: 'ode',
    title: 'Himno de la Alegría',
    composer: 'L. v. Beethoven',
    level: 'Inicial',
    genre: 'Clásica',
    bpm: 108,
    notes: melody('E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:.5 D4:2'),
    chords: cues('C@0 G@4 C@8 G@12'),
  },
  {
    id: 'twinkle',
    title: 'Estrellita',
    composer: 'Tradicional',
    level: 'Inicial',
    genre: 'Infantil',
    bpm: 100,
    notes: melody('C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2'),
    chords: cues('C@0 F@4 C@8 G@12 C@14'),
  },
  {
    id: 'frere',
    title: 'Martinillo',
    composer: 'Tradicional',
    level: 'Inicial',
    genre: 'Infantil',
    bpm: 112,
    notes: melody('C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4:2 E4 F4 G4:2'),
    chords: cues('C@0 C@4 C@8 G@12'),
  },
  {
    id: 'arroz',
    title: 'Arroz con leche',
    composer: 'Tradicional',
    level: 'Inicial',
    genre: 'Infantil',
    bpm: 108,
    notes: melody('G3 C4 E4 D4 C4 B3 C4 D4 B3 G3:2 G3 C4 E4 D4 C4:2'),
    chords: cues('C@0 G@7 C@11'),
  },
  {
    id: 'happy',
    title: 'Cumpleaños feliz',
    composer: 'Tradicional',
    level: 'Inicial',
    genre: 'Celebración',
    bpm: 104,
    notes: melody('C4:.75 C4:.25 D4 C4 F4 E4:2 C4:.75 C4:.25 D4 C4 G4 F4:2'),
    chords: cues('C@0 F@3 C@4 G7@7 F@10'),
  },
  {
    id: 'silent',
    title: 'Noche de paz',
    composer: 'F. X. Gruber',
    level: 'Inicial',
    genre: 'Villancico',
    bpm: 84,
    notes: melody('D4:1.5 E4:.5 D4 B3:3 D4:1.5 E4:.5 D4 B3:3 A4:2 A4 F#4:3 G4:2 G4 D4:3'),
    chords: cues('G@0 G@6 D7@12 G@18'),
  },
  // ---------- Intermedio ----------
  {
    id: 'minuet',
    title: 'Minueto en Sol (tema)',
    composer: 'Bach (atrib.) / Petzold',
    level: 'Intermedio',
    genre: 'Barroco',
    bpm: 112,
    notes: melody('D4 G3:.5 A3:.5 B3:.5 C4:.5 D4 G3 G3 E4 C4:.5 D4:.5 E4:.5 F#4:.5 G4 G3 G3'),
    chords: cues('G@0 G@3 C@6 D7@8 G@11'),
  },
  {
    id: 'elise',
    title: 'Para Elisa (temas A y B)',
    composer: 'L. v. Beethoven',
    level: 'Intermedio',
    genre: 'Clásica',
    bpm: 120,
    notes: melody(
      'E4:.5 D#4:.5 E4:.5 D#4:.5 E4:.5 B3:.5 D4:.5 C4:.5 A3:1.5 C3:.5 E3:.5 A3:.5 B3:1.5 E3:.5 G#3:.5 B3:.5 C4:2 ' +
        'E4:.5 D#4:.5 E4:.5 D#4:.5 E4:.5 B3:.5 D4:.5 C4:.5 A3:1.5 C3:.5 E3:.5 A3:.5 B3:1.5 E3:.5 C4:.5 B3:.5 A3:2 ' +
        'E4:1.5 G3:.5 F4:.5 E4:.5 D4:1.5 F3:.5 E4:.5 D4:.5 C4:1.5 E3:.5 D4:.5 C4:.5 B3:2'
    ),
    chords: cues('Am@0 E7@7 Am@10 Am@12 E7@19 Am@22 C@24 G7@27 C@30 E7@33'),
  },
  {
    id: 'cielito',
    title: 'Cielito Lindo (adaptación)',
    composer: 'Tradicional mexicana',
    level: 'Intermedio',
    genre: 'Folclore',
    bpm: 96,
    notes: melody('E4:.5 E4:.5 G4 E4:.5 E4:.5 C4:2 E4:.5 E4:.5 G4 E4:.5 E4:.5 C4:2 C5 B4 A4 G4 F4:2 E4:2 D4 E4 F4:1 E4 D4:3 C4:3'),
    chords: cues('C@0 C@5 C@10 F@14 C@18 G7@22 C@25'),
  },
  {
    id: 'cucaracha',
    title: 'La Cucaracha',
    composer: 'Tradicional',
    level: 'Intermedio',
    genre: 'Folclore',
    bpm: 116,
    notes: melody('C4:.5 C4:.5 C4:.5 F4 A4 C4:.5 C4:.5 C4:.5 F4 A4 F4:.5 F4:.5 E4:.5 E4:.5 D4:.5 D4:.5 C4:2'),
    chords: cues('C@0 F@1.5 C@5 F@8.5 G7@10 C@10.5'),
  },
  {
    id: 'scarborough',
    title: 'Scarborough Fair (adaptación)',
    composer: 'Tradicional inglesa',
    level: 'Intermedio',
    genre: 'Folk',
    bpm: 84,
    notes: melody('D4 D4 A4 A4 E4:1.5 F4:.5 E4 D4 A4:3 D4 D4 A4 A4 E4:1.5 F4:.5 E4 D4:3'),
    chords: cues('Dm@0 Am@4 Dm@8 Dm@11 Am@15 Dm@18'),
  },
  {
    id: 'canon',
    title: 'Canon en Re (tema principal)',
    composer: 'J. Pachelbel',
    level: 'Intermedio',
    genre: 'Barroco',
    bpm: 80,
    notes: melody('F#4 E4 D4 C#4 B3 A3 B3 C#4 D4 C#4 B3 A3 G3 F#3 G3 E3'),
    chords: cues('D@0 A@2 Bm@4 F#m@6 G@8 D@10 G@12 A7@14'),
  },
  // ---------- Avanzado ----------
  {
    id: 'moonlight',
    title: 'Claro de Luna (motivo)',
    composer: 'L. v. Beethoven',
    level: 'Avanzado',
    genre: 'Clásica',
    bpm: 54,
    notes: melody(
      repeatSpec('G#3:.333 C#4:.333 E4:.333', 4) +
        ' ' +
        repeatSpec('A3:.333 C#4:.333 E4:.333', 2) +
        ' ' +
        repeatSpec('A3:.333 D#4:.333 F#4:.333', 2) +
        ' G#3:.333 B#3:.333 D#4:.333 G#3:.333 C#4:.333 E4:.333 G#3:.333 C#4:.333 E4:.333'
    ),
    chords: cues('C#m@0 C#m@4 A@6 F#m@8 G#7@10'),
  },
  {
    id: 'prelude',
    title: 'Preludio en Do (BWV 846)',
    composer: 'J. S. Bach',
    level: 'Avanzado',
    genre: 'Barroco',
    bpm: 76,
    notes: melody(
      'C3:.5 E3:.5 G3:.5 C4:.5 E4:.5 G3:.5 C4:.5 E4:.5 ' +
        'C3:.5 D3:.5 A3:.5 D4:.5 F4:.5 A3:.5 D4:.5 F4:.5 ' +
        'D3:.5 G3:.5 B3:.5 D4:.5 F4:.5 B3:.5 D4:.5 F4:.5 ' +
        'C3:.5 E3:.5 G3:.5 C4:.5 E4:.5 G3:.5 C4:.5 E4:.5'
    ),
    chords: cues('C@0 Dm@4 G7@8 C@12'),
  },
  {
    id: 'danube',
    title: 'Danubio Azul (motivo de vals)',
    composer: 'J. Strauss II',
    level: 'Avanzado',
    genre: 'Vals',
    bpm: 132,
    notes: melody('D4 F#4 A4 A4:2 F#4 D4 F#4 A4 A4:2 G4 F#4 E4 D4:2 D4 F#4 A4 B4 A4 G4 F#4 E4 D4:3'),
    chords: cues('D@0 D@3 A7@6 A7@9 D@12 G@15 A7@18 D@21'),
  },
  {
    id: 'blues',
    title: 'Blues en Do (melodía + walking bass)',
    composer: 'Tradicional (12 compases)',
    level: 'Avanzado',
    genre: 'Blues',
    bpm: 100,
    notes: melody(
      'C3 E3 G3 A3 C3 E3 G3 A3 C3 E3 G3 A3 C3 E3 G3 A3 ' +
        'F3 A3 C4 D4 F3 A3 C4 D4 C3 E3 G3 A3 C3 E3 G3 A3 ' +
        'G3 B3 D4 E4 F3 A3 C4 D4 C3 E3 G3 A3 G3 B3 D4 E4'
    ),
    chords: cues('C7@0 C7@4 C7@8 C7@12 F7@16 F7@20 C7@24 C7@28 G7@32 F7@36 C7@40 G7@44'),
  },
  {
    id: 'etude',
    title: 'Estudio en Mi menor (arpegios)',
    composer: 'Estudio tradicional',
    level: 'Avanzado',
    genre: 'Estudio',
    bpm: 92,
    notes: melody(
      'E3:.5 G3:.5 B3:.5 E4:.5 G4:.5 E4:.5 B3:.5 G3:.5 ' +
        'A3:.5 C4:.5 E4:.5 A4:.5 C5:.5 A4:.5 E4:.5 C4:.5 ' +
        'B3:.5 D#4:.5 F#4:.5 A4:.5 B4:.5 A4:.5 F#4:.5 D#4:.5 ' +
        'E3:.5 G3:.5 B3:.5 E4:.5 G4:.5 B4:.5 G4:.5 E4:.5 E4:2'
    ),
    chords: cues('Em@0 Am@4 B7@8 Em@12'),
  },
  {
    id: 'pop4',
    title: 'Progresión Pop I-V-vi-IV (melodía)',
    composer: 'Progresión universal',
    level: 'Avanzado',
    genre: 'Pop',
    bpm: 110,
    notes: melody(
      'E4 G4 C5 G4 D4 G4 B4 G4 E4 A4 C5 A4 F4 A4 C5 A4 ' +
        'C5 G4 E4 G4 B4 G4 D4 G4 C5 A4 E4 A4 C5 A4 F4 A4 E4:4'
    ),
    chords: cues('C@0 G@4 Am@8 F@12 C@16 G@20 Am@24 F@28 C@32'),
  },
];

export interface ProgressionChord {
  label: string;
  midis: number[];
  beats: number;
  degree: string;
}

export interface PianoProgression {
  id: string;
  title: string;
  genre: string;
  bpm: number;
  description: string;
  chords: ProgressionChord[];
}

const CHORD_INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
};

function progression(spec: string, beats: number): ProgressionChord[] {
  return spec
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const [chord, degree] = tok.split(':');
      const m = /^([A-G][#b]?)(maj7|m7|m|7)?$/.exec(chord);
      if (!m) throw new Error(`Acorde invalido: ${chord}`);
      const root = 48 + (noteNameToMidi(`${m[1]}3`) % 12);
      return {
        label: chord,
        degree,
        beats,
        midis: CHORD_INTERVALS[m[2] ?? ''].map((i) => root + i),
      };
    });
}

export const PIANO_PROGRESSIONS: readonly PianoProgression[] = [
  {
    id: 'pop',
    title: 'Pop I-V-vi-IV',
    genre: 'Pop',
    bpm: 100,
    description: 'La progresión más usada del pop: Do - Sol - La menor - Fa. Suena a miles de canciones.',
    chords: progression('C:I G:V Am:vi F:IV', 4),
  },
  {
    id: 'blues12',
    title: 'Blues de 12 compases',
    genre: 'Blues',
    bpm: 92,
    description: 'Cuatro compases en I7, dos en IV7, dos en I7 y cierre V7 - IV7 - I7 - V7.',
    chords: progression('C7:I7 C7:I7 C7:I7 C7:I7 F7:IV7 F7:IV7 C7:I7 C7:I7 G7:V7 F7:IV7 C7:I7 G7:V7', 4),
  },
  {
    id: 'jazz251',
    title: 'Jazz II-V-I',
    genre: 'Jazz',
    bpm: 84,
    description: 'La cadencia del jazz: Re menor 7 - Sol 7 - Do mayor 7. Cada acorde empuja al siguiente.',
    chords: progression('Dm7:ii7 G7:V7 Cmaj7:Imaj7 Cmaj7:Imaj7', 4),
  },
  {
    id: 'cumbia',
    title: 'Cumbia / Andina vi-IV-I-V',
    genre: 'Cumbia',
    bpm: 96,
    description: 'La menor - Fa - Do - Sol: color melancólico muy usado en cumbia y música andina.',
    chords: progression('Am:vi F:IV C:I G:V', 4),
  },
  {
    id: 'canon',
    title: 'Canon I-V-vi-iii-IV-I-IV-V',
    genre: 'Barroco',
    bpm: 80,
    description: 'La cadena de Pachelbel: ocho acordes que descienden y se repiten.',
    chords: progression('C:I G:V Am:vi Em:iii F:IV C:I F:IV G:V', 4),
  },
];

export const PIANO_TEMPO_SCALES: readonly number[] = [0.65, 0.85, 1.0, 1.2];

export function melodyTotalBeats(mel: GuidedMelody): number {
  return mel.notes.reduce((acc, n) => acc + n.beats, 0);
}

export function chordCueAtBeat(mel: GuidedMelody, beat: number): ChordCue | undefined {
  if (!mel.chords || mel.chords.length === 0) return undefined;
  let current: ChordCue | undefined;
  for (const c of mel.chords) {
    if (c.beat <= beat + 1e-9) current = c;
  }
  return current;
}

export function melodyNoteStarts(mel: GuidedMelody): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const n of mel.notes) {
    starts.push(acc);
    acc += n.beats;
  }
  return starts;
}

export const INTERVAL_DEFINITIONS: readonly IntervalDef[] = [
  {
    semitones: 1,
    name: '2ª menor',
    shortName: '2m',
    example: 'Mi → Fa',
    explanation: '1 semitono de distancia: paso cromático muy tenso y cercano.',
  },
  {
    semitones: 2,
    name: '2ª mayor',
    shortName: '2M',
    example: 'Do → Re',
    explanation: '2 semitonos (un tono entero): paso natural consecutivo en una escala.',
  },
  {
    semitones: 3,
    name: '3ª menor',
    shortName: '3m',
    example: 'La → Do',
    explanation: '3 semitonos: define el carácter melancólico de los acordes menores.',
  },
  {
    semitones: 4,
    name: '3ª mayor',
    shortName: '3M',
    example: 'Do → Mi',
    explanation: '4 semitonos: intervalo luminoso base de los acordes mayores.',
  },
  {
    semitones: 5,
    name: '4ª justa',
    shortName: '4J',
    example: 'Do → Fa',
    explanation: '5 semitonos: salto firme y abierto, frecuente en inicios de fanfarria.',
  },
  {
    semitones: 6,
    name: 'Tritono (4ª aum.)',
    shortName: 'TT',
    example: 'Fa → Si',
    explanation: '6 semitonos (justo media octava): máxima tensión que pide resolver.',
  },
  {
    semitones: 7,
    name: '5ª justa',
    shortName: '5J',
    example: 'Do → Sol',
    explanation: '7 semitonos: intervalo estable y resonante que da cuerpo a casi todo acorde.',
  },
  {
    semitones: 8,
    name: '6ª menor',
    shortName: '6m',
    example: 'Mi → Do',
    explanation: '8 semitonos: salto amplio de carácter dulce y expresivo.',
  },
  {
    semitones: 9,
    name: '6ª mayor',
    shortName: '6M',
    example: 'Do → La',
    explanation: '9 semitonos: salto cálido y luminoso muy usado en melodías.',
  },
  {
    semitones: 10,
    name: '7ª menor',
    shortName: '7m',
    example: 'Sol → Fa',
    explanation: '10 semitonos: sonoridad característica de los acordes de séptima dominante.',
  },
  {
    semitones: 11,
    name: '7ª mayor',
    shortName: '7M',
    example: 'Do → Si',
    explanation: '11 semitonos: a un solo semitono de la octava, genera atracción hacia arriba.',
  },
  {
    semitones: 12,
    name: '8ª justa',
    shortName: '8J',
    example: 'Do → Do',
    explanation: '12 semitonos: exactamente el doble de frecuencia, la misma nota en registro agudo.',
  },
];

const DIATONIC_BY_PC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6] as const;
const SHARP_BY_PC = [false, true, false, true, false, false, true, false, true, false, true, false] as const;

export function getStaffPosition(midi: number, clef: PianoClef): StaffNotePosition {
  const octave = Math.floor(midi / 12) - 1;
  const pc = ((midi % 12) + 12) % 12;
  const diatonicIndex = octave * 7 + DIATONIC_BY_PC[pc];
  // Treble bottom line = E4 (4*7 + 2 = 30); Bass bottom line = G2 (2*7 + 4 = 18)
  const baseLineIndex = clef === 'treble' ? 30 : 18;
  const stepFromBottomLine = diatonicIndex - baseLineIndex;

  const ledgerSteps: number[] = [];
  if (stepFromBottomLine <= -2) {
    for (let s = -2; s >= stepFromBottomLine; s -= 2) {
      ledgerSteps.push(s);
    }
  } else if (stepFromBottomLine >= 10) {
    for (let s = 10; s <= stepFromBottomLine; s += 2) {
      ledgerSteps.push(s);
    }
  }

  return {
    midi,
    clef,
    stepFromBottomLine,
    accidental: SHARP_BY_PC[pc] ? '#' : '',
    ledgerSteps,
  };
}

export const TREBLE_NATURAL_MIDIS: readonly number[] = [60, 62, 64, 65, 67, 69, 71, 72];
export const BASS_NATURAL_MIDIS: readonly number[] = [48, 50, 52, 53, 55, 57, 59];
