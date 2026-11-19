export type StringInstrumentId = 'guitar' | 'bass' | 'ukulele';

export interface StringInstrumentDef {
  id: StringInstrumentId;
  name: string;
  timbre: 'guitar' | 'bass' | 'ukulele';
  /** Afinación estándar de cuerda 1 (arriba/aguda) a última (abajo/grave) en MIDI. */
  strings: readonly number[];
  stringLabels: readonly string[];
  tuningLabel: string;
}

export const STRING_INSTRUMENTS: Record<StringInstrumentId, StringInstrumentDef> = {
  guitar: {
    id: 'guitar',
    name: 'Guitarra (6 cuerdas)',
    timbre: 'guitar',
    strings: [64, 59, 55, 50, 45, 40], // E4 B3 G3 D3 A2 E2
    stringLabels: ['Mi4 (1ª)', 'Si3 (2ª)', 'Sol3 (3ª)', 'Re3 (4ª)', 'La2 (5ª)', 'Mi2 (6ª)'],
    tuningLabel: 'Mi2 – La2 – Re3 – Sol3 – Si3 – Mi4',
  },
  bass: {
    id: 'bass',
    name: 'Bajo Eléctrico (4 cuerdas)',
    timbre: 'bass',
    strings: [43, 38, 33, 28], // G2 D2 A1 E1
    stringLabels: ['Sol2 (1ª)', 'Re2 (2ª)', 'La1 (3ª)', 'Mi1 (4ª)'],
    tuningLabel: 'Mi1 – La1 – Re2 – Sol2',
  },
  ukulele: {
    id: 'ukulele',
    name: 'Ukelele (4 cuerdas)',
    timbre: 'ukulele',
    strings: [69, 64, 60, 67], // A4 E4 C4 G4 (reentrante estándar)
    stringLabels: ['La4 (1ª)', 'Mi4 (2ª)', 'Do4 (3ª)', 'Sol4 (4ª)'],
    tuningLabel: 'Sol4 – Do4 – Mi4 – La4',
  },
};

export interface ChordShape {
  id: string;
  instrument: StringInstrumentId;
  name: string;
  shortLabel: string;
  rootPc: number;
  pcs: readonly number[];
  /** Traste por cuerda (mismo orden que STRING_INSTRUMENTS[instrument].strings); -1 = muteada, 0 = al aire. */
  frets: readonly number[];
  /** Dedo por cuerda: 0 = libre/muteada, 1 índice, 2 medio, 3 anular, 4 meñique. */
  fingers: readonly number[];
  tip: string;
}

const NOTE_NAMES_ES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'] as const;

export function formatStringNoteEs(midi: number): string {
  const name = NOTE_NAMES_ES[((midi % 12) + 12) % 12];
  return `${name}${Math.floor(midi / 12) - 1}`;
}

export function fretMidi(instrument: StringInstrumentId, stringIndex: number, fret: number): number {
  return STRING_INSTRUMENTS[instrument].strings[stringIndex] + fret;
}

export function chordShapeMidis(shape: ChordShape): number[] {
  const open = STRING_INSTRUMENTS[shape.instrument].strings;
  const midis: number[] = [];
  // Orden de grave a agudo para rasgueo realista (cuerda más grave a más aguda)
  for (let s = open.length - 1; s >= 0; s--) {
    const f = shape.frets[s];
    if (f >= 0) midis.push(open[s] + f);
  }
  return midis;
}

/**
 * Biblioteca de acordes reales: 16 esenciales de Guitarra (Mayores, menores, 7ª) + 9 de Ukelele.
 * En Bajo eléctrico usamos intervalos fundamentales (tónica, 5ª y octava) vía `bassShapeFor(pc)`.
 */
export const CHORD_SHAPES: readonly ChordShape[] = [
  // ---------- Guitarra (6 cuerdas: E4, B3, G3, D3, A2, E2) ----------
  {
    id: 'C', instrument: 'guitar', name: 'Do Mayor (C)', shortLabel: 'C',
    rootPc: 0, pcs: [0, 4, 7],
    frets: [0, 1, 0, 2, 3, -1], fingers: [0, 1, 0, 2, 3, 0],
    tip: 'Coloca los dedos en escalera; evita rozar la 1ª y 3ª cuerda para que suenen al aire.',
  },
  {
    id: 'D', instrument: 'guitar', name: 'Re Mayor (D)', shortLabel: 'D',
    rootPc: 2, pcs: [2, 6, 9],
    frets: [2, 3, 2, 0, -1, -1], fingers: [2, 3, 1, 0, 0, 0],
    tip: 'Rasguea desde la 4ª cuerda (Re al aire); forma un triángulo en trastes 2 y 3.',
  },
  {
    id: 'E', instrument: 'guitar', name: 'Mi Mayor (E)', shortLabel: 'E',
    rootPc: 4, pcs: [4, 8, 11],
    frets: [0, 0, 1, 2, 2, 0], fingers: [0, 0, 1, 3, 2, 0],
    tip: 'Suenan las 6 cuerdas; el dedo 1 pulsa Sol# en la 3ª cuerda traste 1.',
  },
  {
    id: 'F', instrument: 'guitar', name: 'Fa Mayor (F)', shortLabel: 'F',
    rootPc: 5, pcs: [5, 9, 0],
    frets: [1, 1, 2, 3, -1, -1], fingers: [1, 1, 2, 3, 0, 0],
    tip: 'Versión compacta sin cejilla completa: el índice pisa a la vez 1ª y 2ª cuerda en el traste 1.',
  },
  {
    id: 'G', instrument: 'guitar', name: 'Sol Mayor (G)', shortLabel: 'G',
    rootPc: 7, pcs: [7, 11, 2],
    frets: [3, 0, 0, 0, 2, 3], fingers: [3, 0, 0, 0, 1, 2],
    tip: 'Dedo 2 en traste 3 de 6ª cuerda, dedo 1 en traste 2 de 5ª y anular en la 1ª.',
  },
  {
    id: 'A', instrument: 'guitar', name: 'La Mayor (A)', shortLabel: 'A',
    rootPc: 9, pcs: [9, 1, 4],
    frets: [0, 2, 2, 2, 0, -1], fingers: [0, 3, 2, 1, 0, 0],
    tip: 'Los tres dedos se alinean en el traste 2 en las cuerdas 4ª, 3ª y 2ª; rasguea desde la 5ª.',
  },
  {
    id: 'Am', instrument: 'guitar', name: 'La menor (Am)', shortLabel: 'Am',
    rootPc: 9, pcs: [9, 0, 4],
    frets: [0, 1, 2, 2, 0, -1], fingers: [0, 1, 3, 2, 0, 0],
    tip: 'Misma forma que Mi Mayor pero bajada una cuerda cada dedo, sin tocar la 6ª.',
  },
  {
    id: 'Em', instrument: 'guitar', name: 'Mi menor (Em)', shortLabel: 'Em',
    rootPc: 4, pcs: [4, 7, 11],
    frets: [0, 0, 0, 2, 2, 0], fingers: [0, 0, 0, 3, 2, 0],
    tip: 'Solo dos dedos en el traste 2 (cuerdas 5ª y 4ª) y suenan todas las cuerdas.',
  },
  {
    id: 'Dm', instrument: 'guitar', name: 'Re menor (Dm)', shortLabel: 'Dm',
    rootPc: 2, pcs: [2, 5, 9],
    frets: [1, 3, 2, 0, -1, -1], fingers: [1, 3, 2, 0, 0, 0],
    tip: 'Cambia la 1ª cuerda de traste 2 (Fa#) a traste 1 (Fa natural) respecto a Re Mayor.',
  },
  {
    id: 'Bm', instrument: 'guitar', name: 'Si menor (Bm)', shortLabel: 'Bm',
    rootPc: 11, pcs: [11, 2, 6],
    frets: [2, 3, 4, 4, 2, -1], fingers: [1, 2, 4, 3, 1, 0],
    tip: 'Cejilla con el índice en traste 2 (cuerdas 5ª a 1ª) y postura de La menor delante.',
  },
  {
    id: 'F#m', instrument: 'guitar', name: 'Fa# menor (F#m)', shortLabel: 'F#m',
    rootPc: 6, pcs: [6, 9, 1],
    frets: [2, 2, 2, 4, 4, 2], fingers: [1, 1, 1, 4, 3, 1],
    tip: 'Cejilla completa en traste 2 con anular y meñique en el traste 4 de 5ª y 4ª cuerda.',
  },
  {
    id: 'C7', instrument: 'guitar', name: 'Do Séptima (C7)', shortLabel: 'C7',
    rootPc: 0, pcs: [0, 4, 7, 10],
    frets: [0, 1, 3, 2, 3, -1], fingers: [0, 1, 4, 2, 3, 0],
    tip: 'Parte de Do Mayor y apoya el meñique en el traste 3 de la 3ª cuerda (Sib).',
  },
  {
    id: 'D7', instrument: 'guitar', name: 'Re Séptima (D7)', shortLabel: 'D7',
    rootPc: 2, pcs: [2, 6, 9, 0],
    frets: [2, 1, 2, 0, -1, -1], fingers: [3, 1, 2, 0, 0, 0],
    tip: 'Triángulo invertido respecto a Re Mayor: el índice queda atrás en el traste 1 de la 2ª.',
  },
  {
    id: 'E7', instrument: 'guitar', name: 'Mi Séptima (E7)', shortLabel: 'E7',
    rootPc: 4, pcs: [4, 8, 11, 2],
    frets: [0, 0, 1, 0, 2, 0], fingers: [0, 0, 1, 0, 2, 0],
    tip: 'Levanta el anular de Mi Mayor para liberar Re4 en la 4ª cuerda al aire.',
  },
  {
    id: 'G7', instrument: 'guitar', name: 'Sol Séptima (G7)', shortLabel: 'G7',
    rootPc: 7, pcs: [7, 11, 2, 5],
    frets: [1, 0, 0, 0, 2, 3], fingers: [1, 0, 0, 0, 2, 3],
    tip: 'La séptima (Fa) se pisa con el índice en el traste 1 de la 1ª cuerda.',
  },
  {
    id: 'A7', instrument: 'guitar', name: 'La Séptima (A7)', shortLabel: 'A7',
    rootPc: 9, pcs: [9, 1, 4, 7],
    frets: [0, 2, 0, 2, 0, -1], fingers: [0, 2, 0, 1, 0, 0],
    tip: 'Solo dos dedos en el traste 2 (cuerdas 4ª y 2ª); la 3ª suena al aire dando Sol.',
  },

  // ---------- Ukelele (4 cuerdas: A4, E4, C4, G4) ----------
  {
    id: 'C', instrument: 'ukulele', name: 'Do Mayor (C)', shortLabel: 'C',
    rootPc: 0, pcs: [0, 4, 7],
    frets: [3, 0, 0, 0], fingers: [3, 0, 0, 0],
    tip: 'Un solo dedo (anular) en el traste 3 de la 1ª cuerda.',
  },
  {
    id: 'G', instrument: 'ukulele', name: 'Sol Mayor (G)', shortLabel: 'G',
    rootPc: 7, pcs: [7, 11, 2],
    frets: [2, 3, 2, 0], fingers: [2, 3, 1, 0],
    tip: 'Igual que Re Mayor en guitarra, adaptado a las 4 cuerdas del ukelele.',
  },
  {
    id: 'Am', instrument: 'ukulele', name: 'La menor (Am)', shortLabel: 'Am',
    rootPc: 9, pcs: [9, 0, 4],
    frets: [0, 0, 0, 2], fingers: [0, 0, 0, 2],
    tip: 'Solo dedo medio en el traste 2 de la 4ª cuerda (Sol4 -> La4).',
  },
  {
    id: 'F', instrument: 'ukulele', name: 'Fa Mayor (F)', shortLabel: 'F',
    rootPc: 5, pcs: [5, 9, 0],
    frets: [0, 1, 0, 2], fingers: [0, 1, 0, 2],
    tip: 'Añade el índice en el traste 1 de la 2ª cuerda sobre la postura de La menor.',
  },
  {
    id: 'D', instrument: 'ukulele', name: 'Re Mayor (D)', shortLabel: 'D',
    rootPc: 2, pcs: [2, 6, 9],
    frets: [0, 2, 2, 2], fingers: [0, 3, 2, 1],
    tip: 'Tres dedos en línea en el traste 2 (cuerdas 4ª, 3ª y 2ª), 1ª cuerda al aire.',
  },
  {
    id: 'Dm', instrument: 'ukulele', name: 'Re menor (Dm)', shortLabel: 'Dm',
    rootPc: 2, pcs: [2, 5, 9],
    frets: [0, 1, 2, 2], fingers: [0, 1, 3, 2],
    tip: 'Como Fa Mayor pero añadiendo el anular en el traste 2 de la 3ª cuerda.',
  },
  {
    id: 'Em', instrument: 'ukulele', name: 'Mi menor (Em)', shortLabel: 'Em',
    rootPc: 4, pcs: [4, 7, 11],
    frets: [2, 3, 4, 0], fingers: [1, 2, 3, 0],
    tip: 'Escalera diagonal ascendente en trastes 2, 3 y 4 desde la 1ª a la 3ª cuerda.',
  },
  {
    id: 'G7', instrument: 'ukulele', name: 'Sol Séptima (G7)', shortLabel: 'G7',
    rootPc: 7, pcs: [7, 11, 2, 5],
    frets: [2, 1, 2, 0], fingers: [3, 1, 2, 0],
    tip: 'Triángulo hacia atrás respecto a Sol Mayor: el índice queda en traste 1 de la 2ª.',
  },
  {
    id: 'C7', instrument: 'ukulele', name: 'Do Séptima (C7)', shortLabel: 'C7',
    rootPc: 0, pcs: [0, 4, 7, 10],
    frets: [1, 0, 0, 0], fingers: [1, 0, 0, 0],
    tip: 'Solo el índice en traste 1 de la 1ª cuerda (Sib).',
  },
];

/** Genera diagrama didáctico de Bajo eléctrico (Tónica + 5ª justa + Octava) para cualquier raíz (0..11). */
export function bassShapeFor(rootPc: number): ChordShape {
  const normPc = ((rootPc % 12) + 12) % 12;
  // Tónica en cuerda 3ª (La1 = 33) o 4ª (Mi1 = 28) para mantener trastes 0..7 cómodos.
  // Orden de cuerdas en STRING_INSTRUMENTS.bass: [Sol2 (0), Re2 (1), La1 (2), Mi1 (3)].
  const useString3 = normPc >= 9 || normPc <= 1; // La, La#, Si, Do, Do#
  const rootFret = useString3 ? (normPc + 12 - 9) % 12 : (normPc + 12 - 4) % 12;
  const frets: [number, number, number, number] = useString3
    ? [rootFret + 2, rootFret + 2, rootFret, -1]
    : [-1, rootFret + 2, rootFret + 2, rootFret];
  const fingers = frets.map((f) => (f <= 0 ? 0 : f === rootFret ? 1 : 3));
  const name = NOTE_NAMES_ES[normPc];
  return {
    id: `bass_${normPc}`,
    instrument: 'bass',
    name: `Tríada / Quinta de ${name}`,
    shortLabel: `${name} (1-5-8)`,
    rootPc: normPc,
    pcs: [normPc, (normPc + 7) % 12],
    frets,
    fingers,
    tip: `En el bajo, la 5ª justa está siempre 1 cuerda más aguda y 2 trastes adelante, y la octava 2 cuerdas y 2 trastes adelante.`,
  };
}

export function getChordsForInstrument(instrument: StringInstrumentId): ChordShape[] {
  if (instrument === 'bass') {
    return [0, 2, 4, 5, 7, 9, 11].map((pc) => bassShapeFor(pc));
  }
  return CHORD_SHAPES.filter((c) => c.instrument === instrument);
}

export interface StringSongEvent {
  beat: number;
  chordId?: string;
  string?: number;
  fret?: number;
  durBeats: number;
  label: string;
}

export interface StringSong {
  id: string;
  instrument: StringInstrumentId;
  kind: 'chords' | 'riff';
  title: string;
  genre: string;
  bpm: number;
  description: string;
  chordPalette?: readonly string[];
  events: StringSongEvent[];
}

function riffEvents(
  rows: readonly [stringIndex: number, fret: number, durBeats: number][],
  inst: StringInstrumentId
): StringSongEvent[] {
  let beat = 0;
  return rows.map(([string, fret, durBeats]) => {
    const label = `${formatStringNoteEs(fretMidi(inst, string, fret))} (c${string + 1}:t${fret})`;
    const ev: StringSongEvent = { beat, string, fret, durBeats, label };
    beat += durBeats;
    return ev;
  });
}

function chordEvents(rows: readonly [chordId: string, durBeats: number][]): StringSongEvent[] {
  let beat = 0;
  return rows.map(([chordId, durBeats]) => {
    const ev: StringSongEvent = { beat, chordId, durBeats, label: chordId };
    beat += durBeats;
    return ev;
  });
}

export const STRING_SONGS: readonly StringSong[] = [
  // ---------- Guitarra (5) ----------
  {
    id: 'gtr_romance',
    instrument: 'guitar',
    kind: 'riff',
    title: 'Arpegio Clásico (tipo Romance)',
    genre: 'Clásica',
    bpm: 84,
    description: 'Punteo ternario descendiendo por 1ª, 2ª y 3ª cuerda mientras el pulgar sostiene el Mi grave.',
    events: riffEvents(
      [
        [5, 0, 0.5], [0, 7, 0.5], [1, 0, 0.5], [2, 0, 0.5], [0, 7, 0.5], [1, 0, 0.5],
        [2, 0, 0.5], [0, 7, 0.5], [1, 0, 0.5], [2, 0, 0.5], [0, 5, 0.5], [0, 3, 0.5],
        [5, 0, 0.5], [0, 3, 0.5], [1, 0, 0.5], [2, 0, 0.5], [0, 2, 0.5], [0, 0, 0.5],
      ],
      'guitar'
    ),
  },
  {
    id: 'gtr_pop',
    instrument: 'guitar',
    kind: 'chords',
    title: 'Progresión Pop (Do - Sol - Lam - Fa)',
    genre: 'Pop',
    bpm: 96,
    description: 'Elige la postura (1-4) antes de cada cambio y pulsa Espacio para rasguear el acorde a tiempo.',
    chordPalette: ['C', 'G', 'Am', 'F'],
    events: chordEvents([
      ['C', 2], ['C', 2], ['G', 2], ['G', 2],
      ['Am', 2], ['Am', 2], ['F', 2], ['F', 2],
      ['C', 2], ['G', 2], ['Am', 2], ['F', 2],
    ]),
  },
  {
    id: 'gtr_blues_a',
    instrument: 'guitar',
    kind: 'chords',
    title: 'Blues en La (12 compases)',
    genre: 'Blues',
    bpm: 92,
    description: 'Estructura clásica de 12 compases con dominantes A7, D7 y E7.',
    chordPalette: ['A7', 'D7', 'E7'],
    events: chordEvents([
      ['A7', 4], ['A7', 4], ['A7', 4], ['A7', 4],
      ['D7', 4], ['D7', 4], ['A7', 4], ['A7', 4],
      ['E7', 4], ['D7', 4], ['A7', 4], ['E7', 4],
    ]),
  },
  {
    id: 'gtr_folk',
    instrument: 'guitar',
    kind: 'chords',
    title: 'Ritmo Folk / Campfire (G - D - Em - C)',
    genre: 'Folk',
    bpm: 102,
    description: 'Rasgueo abierto en tonalidad de Sol mayor alternando pulsos fuertes y débiles.',
    chordPalette: ['G', 'D', 'Em', 'C'],
    events: chordEvents([
      ['G', 2], ['G', 2], ['D', 2], ['D', 2],
      ['Em', 2], ['Em', 2], ['C', 2], ['C', 2],
      ['G', 2], ['D', 2], ['C', 2], ['G', 2],
    ]),
  },
  {
    id: 'gtr_rock_pent',
    instrument: 'guitar',
    kind: 'riff',
    title: 'Riff Rock Pentatónico (La menor)',
    genre: 'Rock',
    bpm: 108,
    description: 'Frase clásica en la caja 5 de la pentatónica menor de La (cuerdas 6ª, 5ª y 4ª).',
    events: riffEvents(
      [
        [5, 5, 1], [5, 8, 0.5], [4, 5, 0.5], [4, 7, 1], [3, 5, 0.5], [3, 7, 0.5],
        [3, 7, 1], [3, 5, 0.5], [4, 7, 0.5], [4, 5, 1], [5, 8, 0.5], [5, 5, 1.5],
      ],
      'guitar'
    ),
  },

  // ---------- Bajo Eléctrico (5) ----------
  {
    id: 'bass_walk',
    instrument: 'bass',
    kind: 'riff',
    title: 'Walking Bass Jazz (II-V-I en Do)',
    genre: 'Jazz',
    bpm: 108,
    description: 'Camina en negras conectando la fundamental de Dm7, G7 y Cmaj7 mediante cromatismos.',
    events: riffEvents(
      [
        [2, 5, 1], [2, 7, 1], [1, 3, 1], [1, 6, 1],
        [1, 5, 1], [1, 3, 1], [2, 5, 1], [2, 2, 1],
        [2, 3, 1], [1, 2, 1], [1, 5, 1], [0, 5, 1],
        [0, 4, 1], [0, 2, 1], [1, 5, 1], [2, 3, 1],
      ],
      'bass'
    ),
  },
  {
    id: 'bass_funk',
    instrument: 'bass',
    kind: 'riff',
    title: 'Groove Funk en Mi',
    genre: 'Funk',
    bpm: 98,
    description: 'Alterna Mi grave al aire con su octava (2ª cuerda traste 2) y la séptima menor (Re).',
    events: riffEvents(
      [
        [3, 0, 0.5], [3, 0, 0.5], [1, 2, 0.5], [3, 0, 0.5],
        [2, 5, 0.5], [2, 7, 0.5], [1, 2, 1],
        [3, 0, 0.5], [3, 0, 0.5], [1, 0, 0.5], [1, 2, 0.5],
        [2, 7, 0.5], [2, 5, 0.5], [3, 3, 0.5], [3, 0, 0.5],
      ],
      'bass'
    ),
  },
  {
    id: 'bass_cumbia',
    instrument: 'bass',
    kind: 'riff',
    title: 'Línea Cumbia (Tónica - 3ª - 5ª)',
    genre: 'Cumbia',
    bpm: 96,
    description: 'Triada bailadora alternando Do - Mi - Sol y Sol - Si - Re en negras con aire sincopado.',
    events: riffEvents(
      [
        [2, 3, 1.5], [1, 2, 0.5], [1, 5, 1], [1, 2, 1],
        [2, 3, 1.5], [1, 2, 0.5], [1, 5, 1], [2, 3, 1],
        [3, 3, 1.5], [2, 2, 0.5], [2, 5, 1], [2, 2, 1],
        [3, 3, 1.5], [2, 5, 0.5], [2, 2, 1], [2, 3, 1],
      ],
      'bass'
    ),
  },
  {
    id: 'bass_rock_oct',
    instrument: 'bass',
    kind: 'riff',
    title: 'Rock Octavas (A - F - C - G)',
    genre: 'Rock',
    bpm: 118,
    description: 'Salto constante entre la cuerda grave y su octava 2 trastes arriba en la cuerda siguiente.',
    events: riffEvents(
      [
        [3, 5, 0.5], [1, 7, 0.5], [3, 5, 0.5], [1, 7, 0.5],
        [3, 1, 0.5], [1, 3, 0.5], [3, 1, 0.5], [1, 3, 0.5],
        [2, 3, 0.5], [0, 5, 0.5], [2, 3, 0.5], [0, 5, 0.5],
        [3, 3, 0.5], [1, 5, 0.5], [3, 3, 0.5], [1, 5, 0.5],
      ],
      'bass'
    ),
  },
  {
    id: 'bass_reggae',
    instrument: 'bass',
    kind: 'riff',
    title: 'Reggae One-Drop (espacio en el 1)',
    genre: 'Reggae',
    bpm: 82,
    description: 'Línea cálida y pesada que deja respirar el primer pulso y cae con fuerza en el 2 y 3.',
    events: riffEvents(
      [
        [2, 5, 1.5], [1, 3, 0.5], [1, 5, 1], [2, 5, 1],
        [2, 3, 1.5], [1, 2, 0.5], [1, 5, 1], [2, 3, 1],
        [2, 5, 1.5], [0, 5, 0.5], [0, 2, 1], [1, 5, 1],
      ],
      'bass'
    ),
  },

  // ---------- Ukelele (2) ----------
  {
    id: 'uke_island',
    instrument: 'ukulele',
    kind: 'chords',
    title: 'Isla / Pop (Do - Sol - Lam - Fa)',
    genre: 'Pop / Isla',
    bpm: 100,
    description: 'Los 4 acordes mágicos del ukelele; cambia la postura (1-4) y rasguea en cada compás.',
    chordPalette: ['C', 'G', 'Am', 'F'],
    events: chordEvents([
      ['C', 2], ['C', 2], ['G', 2], ['G', 2],
      ['Am', 2], ['Am', 2], ['F', 2], ['F', 2],
      ['C', 2], ['G', 2], ['Am', 2], ['F', 2],
    ]),
  },
  {
    id: 'uke_waltz',
    instrument: 'ukulele',
    kind: 'chords',
    title: 'Vals Cálido 3/4 (Do - Fa - Sol7 - Do)',
    genre: 'Vals',
    bpm: 96,
    description: 'Rasgueo ternario dulce alternando tónica, subdominante y dominante en 3 tiempos.',
    chordPalette: ['C', 'F', 'G7', 'Am'],
    events: chordEvents([
      ['C', 3], ['F', 3], ['G7', 3], ['C', 3],
      ['Am', 3], ['F', 3], ['G7', 3], ['C', 3],
    ]),
  },
];

export type ScaleType = 'minorPentatonic' | 'major';

const SCALE_INTERVALS: Record<ScaleType, readonly number[]> = {
  minorPentatonic: [0, 3, 5, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
};

export interface ScalePosition {
  string: number;
  fret: number;
  isRoot: boolean;
  noteName: string;
}

export function scaleBoxPositions(
  instrument: StringInstrumentId,
  rootPc: number,
  scale: ScaleType,
  minFret = 0,
  maxFret = 12
): ScalePosition[] {
  const intervals = SCALE_INTERVALS[scale];
  const open = STRING_INSTRUMENTS[instrument].strings;
  const out: ScalePosition[] = [];
  for (let s = 0; s < open.length; s++) {
    for (let f = minFret; f <= maxFret; f++) {
      const midi = open[s] + f;
      const pc = ((midi % 12) + 12) % 12;
      const rel = (pc - rootPc + 12) % 12;
      if (intervals.includes(rel)) {
        out.push({ string: s, fret: f, isRoot: rel === 0, noteName: NOTE_NAMES_ES[pc] });
      }
    }
  }
  return out;
}

export function songTotalBeats(song: StringSong): number {
  return song.events.reduce((acc, ev) => Math.max(acc, ev.beat + ev.durBeats), 0);
}
