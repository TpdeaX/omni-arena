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

export interface GuidedMelody {
  id: string;
  title: string;
  composer: string;
  bpm: number;
  notes: MelodyNote[];
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

export const GUIDED_MELODIES: readonly GuidedMelody[] = [
  {
    id: 'ode',
    title: 'Himno de la Alegría',
    composer: 'L. v. Beethoven',
    bpm: 108,
    notes: [
      { midi: 64, beats: 1 }, { midi: 64, beats: 1 }, { midi: 65, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 67, beats: 1 }, { midi: 65, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 60, beats: 1 }, { midi: 60, beats: 1 }, { midi: 62, beats: 1 }, { midi: 64, beats: 1 },
      { midi: 64, beats: 1.5 }, { midi: 62, beats: 0.5 }, { midi: 62, beats: 2 },
    ],
  },
  {
    id: 'twinkle',
    title: 'Estrellita',
    composer: 'Tradicional',
    bpm: 100,
    notes: [
      { midi: 60, beats: 1 }, { midi: 60, beats: 1 }, { midi: 67, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 69, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 2 },
      { midi: 65, beats: 1 }, { midi: 65, beats: 1 }, { midi: 64, beats: 1 }, { midi: 64, beats: 1 },
      { midi: 62, beats: 1 }, { midi: 62, beats: 1 }, { midi: 60, beats: 2 },
    ],
  },
  {
    id: 'frere',
    title: 'Martinillo',
    composer: 'Tradicional',
    bpm: 112,
    notes: [
      { midi: 60, beats: 1 }, { midi: 62, beats: 1 }, { midi: 64, beats: 1 }, { midi: 60, beats: 1 },
      { midi: 60, beats: 1 }, { midi: 62, beats: 1 }, { midi: 64, beats: 1 }, { midi: 60, beats: 1 },
      { midi: 64, beats: 1 }, { midi: 65, beats: 1 }, { midi: 67, beats: 2 },
      { midi: 64, beats: 1 }, { midi: 65, beats: 1 }, { midi: 67, beats: 2 },
    ],
  },
  {
    id: 'arroz',
    title: 'Arroz con leche',
    composer: 'Tradicional',
    bpm: 108,
    notes: [
      { midi: 55, beats: 1 }, { midi: 60, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 60, beats: 1 }, { midi: 59, beats: 1 }, { midi: 60, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 59, beats: 1 }, { midi: 55, beats: 2 },
      { midi: 55, beats: 1 }, { midi: 60, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 60, beats: 2 },
    ],
  },
  {
    id: 'happy',
    title: 'Cumpleaños feliz',
    composer: 'Tradicional',
    bpm: 104,
    notes: [
      { midi: 60, beats: 0.75 }, { midi: 60, beats: 0.25 }, { midi: 62, beats: 1 }, { midi: 60, beats: 1 },
      { midi: 65, beats: 1 }, { midi: 64, beats: 2 },
      { midi: 60, beats: 0.75 }, { midi: 60, beats: 0.25 }, { midi: 62, beats: 1 }, { midi: 60, beats: 1 },
      { midi: 67, beats: 1 }, { midi: 65, beats: 2 },
    ],
  },
  {
    id: 'elise',
    title: 'Para Elisa (tema)',
    composer: 'L. v. Beethoven',
    bpm: 120,
    notes: [
      { midi: 64, beats: 0.5 }, { midi: 63, beats: 0.5 }, { midi: 64, beats: 0.5 }, { midi: 63, beats: 0.5 },
      { midi: 64, beats: 0.5 }, { midi: 59, beats: 0.5 }, { midi: 62, beats: 0.5 }, { midi: 60, beats: 0.5 },
      { midi: 57, beats: 1.5 }, { midi: 48, beats: 0.5 }, { midi: 52, beats: 0.5 }, { midi: 57, beats: 0.5 },
      { midi: 59, beats: 1.5 }, { midi: 52, beats: 0.5 }, { midi: 56, beats: 0.5 }, { midi: 59, beats: 0.5 },
      { midi: 60, beats: 2 },
    ],
  },
];

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
