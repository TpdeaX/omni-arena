import type { DrumPieceId } from './drumsBank.ts';

export type BandPlayerInstrumentId = 'marimba' | 'flute' | 'piano' | 'miniDrums' | 'bass';
export type BandTrackId = 'drums' | 'bass' | 'chords' | 'melody';

export const BAND_TRACK_IDS: readonly BandTrackId[] = ['drums', 'bass', 'chords', 'melody'];

export interface BandInstrumentDef {
  id: BandPlayerInstrumentId;
  name: string;
  shortName: string;
  timbre: 'marimba' | 'flute' | 'piano' | 'bass';
  suggestedMute: BandTrackId;
  hint: string;
}

export const BAND_INSTRUMENTS: readonly BandInstrumentDef[] = [
  {
    id: 'marimba',
    name: 'Xilófono / Marimba',
    shortName: 'Xilófono',
    timbre: 'marimba',
    suggestedMute: 'melody',
    hint: 'Láminas de colores (Do4–Do6) con ataque cálido percusivo. Ideal para tocar la melodía principal.',
  },
  {
    id: 'flute',
    name: 'Melódica / Flauta',
    shortName: 'Melódica',
    timbre: 'flute',
    suggestedMute: 'melody',
    hint: 'Digitación visual continua con ligero vibrato al mantener la tecla pulsada.',
  },
  {
    id: 'piano',
    name: 'Piano (2 octavas)',
    shortName: 'Piano',
    timbre: 'piano',
    suggestedMute: 'chords',
    hint: 'Teclado completo Do3–Do5 para doblar melodía o cubrir los acordes de la banda.',
  },
  {
    id: 'miniDrums',
    name: 'Mini-Batería (6 pads)',
    shortName: 'Mini-Batería',
    timbre: 'marimba',
    suggestedMute: 'drums',
    hint: '6 pads esenciales (Bombo, Caja, Hi-Hat cerrado/abierto, Tom, Crash) para llevar el groove.',
  },
  {
    id: 'bass',
    name: 'Bajo (4 cuerdas)',
    shortName: 'Bajo',
    timbre: 'bass',
    suggestedMute: 'bass',
    hint: 'Cuatro carriles simples (Mi1–Sol2) con las notas clave de la base para sostener la armonía.',
  },
];

export interface BandDrumNote {
  beat: number;
  piece: DrumPieceId;
  velocity?: number;
}

export interface BandMidiNote {
  beat: number;
  midi: number;
  dur: number;
}

export interface BandChordNote {
  beat: number;
  label: string;
  midis: readonly number[];
  dur: number;
}

export interface BandSong {
  id: string;
  title: string;
  genre: string;
  keyLabel: string;
  bpm: number;
  bars: number;
  description: string;
  tracks: {
    drums: BandDrumNote[];
    bass: BandMidiNote[];
    chords: BandChordNote[];
    melody: BandMidiNote[];
  };
}

const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function m(name: string): number {
  const res = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!res) throw new Error(`Nota invalida: ${name}`);
  const acc = res[2] === '#' ? 1 : res[2] === 'b' ? -1 : 0;
  return (Number(res[3]) + 1) * 12 + NOTE_PC[res[1]] + acc;
}

function makeDrums(bars: number, kind: 'pop' | 'funk' | 'cumbia' | 'bossa' | 'jazz' | 'rock' | 'reggae' | 'latin'): BandDrumNote[] {
  const out: BandDrumNote[] = [];
  for (let b = 0; b < bars; b++) {
    const off = b * 4;
    if (kind === 'pop' || kind === 'rock') {
      for (let i = 0; i < 8; i++) out.push({ beat: off + i * 0.5, piece: 'hihat_closed', velocity: i % 2 === 0 ? 0.9 : 0.65 });
      out.push({ beat: off + 0, piece: 'kick', velocity: 1 }, { beat: off + 2, piece: 'kick', velocity: 0.95 });
      if (kind === 'pop') out.push({ beat: off + 2.5, piece: 'kick', velocity: 0.8 });
      out.push({ beat: off + 1, piece: 'snare', velocity: 0.95 }, { beat: off + 3, piece: 'snare', velocity: 0.95 });
    } else if (kind === 'funk') {
      for (let i = 0; i < 8; i++) out.push({ beat: off + i * 0.5, piece: i === 7 ? 'hihat_open' : 'hihat_closed', velocity: i % 2 === 0 ? 0.9 : 0.6 });
      out.push({ beat: off + 0, piece: 'kick', velocity: 1 }, { beat: off + 1.5, piece: 'kick', velocity: 0.85 }, { beat: off + 2.5, piece: 'kick', velocity: 0.9 });
      out.push({ beat: off + 1, piece: 'snare', velocity: 0.95 }, { beat: off + 3, piece: 'snare', velocity: 0.95 });
    } else if (kind === 'cumbia') {
      for (let i = 0; i < 4; i++) {
        out.push({ beat: off + i, piece: 'hihat_closed', velocity: 0.9 });
        out.push({ beat: off + i + 0.5, piece: 'hihat_closed', velocity: 0.55 });
        out.push({ beat: off + i + 0.75, piece: 'hihat_closed', velocity: 0.7 });
      }
      out.push({ beat: off + 0, piece: 'kick', velocity: 1 }, { beat: off + 2, piece: 'kick', velocity: 1 });
      out.push({ beat: off + 0.5, piece: 'tom_low', velocity: 0.7 }, { beat: off + 2.5, piece: 'tom_low', velocity: 0.7 });
      out.push({ beat: off + 1, piece: 'snare', velocity: 0.8 }, { beat: off + 3, piece: 'snare', velocity: 0.8 });
    } else if (kind === 'bossa') {
      for (let i = 0; i < 8; i++) out.push({ beat: off + i * 0.5, piece: 'hihat_closed', velocity: 0.65 });
      out.push({ beat: off + 0, piece: 'kick', velocity: 0.95 }, { beat: off + 1.5, piece: 'kick', velocity: 0.85 }, { beat: off + 2, piece: 'kick', velocity: 0.95 }, { beat: off + 3.5, piece: 'kick', velocity: 0.85 });
      out.push({ beat: off + 0.75, piece: 'snare', velocity: 0.75 }, { beat: off + 1.5, piece: 'snare', velocity: 0.7 }, { beat: off + 2.75, piece: 'snare', velocity: 0.75 });
    } else if (kind === 'jazz') {
      out.push({ beat: off + 0, piece: 'ride', velocity: 0.95 }, { beat: off + 1, piece: 'ride', velocity: 0.9 }, { beat: off + 1.66, piece: 'ride', velocity: 0.65 });
      out.push({ beat: off + 2, piece: 'ride', velocity: 0.95 }, { beat: off + 3, piece: 'ride', velocity: 0.9 }, { beat: off + 3.66, piece: 'ride', velocity: 0.65 });
      out.push({ beat: off + 1, piece: 'hihat_closed', velocity: 0.85 }, { beat: off + 3, piece: 'hihat_closed', velocity: 0.85 });
      out.push({ beat: off + 0, piece: 'kick', velocity: 0.7 }, { beat: off + 2, piece: 'kick', velocity: 0.7 });
    } else if (kind === 'reggae') {
      for (let i = 0; i < 8; i++) out.push({ beat: off + i * 0.5, piece: 'hihat_closed', velocity: i % 2 === 1 ? 0.8 : 0.55 });
      out.push({ beat: off + 2, piece: 'kick', velocity: 1 }, { beat: off + 2, piece: 'snare', velocity: 0.85 });
    } else {
      // latin
      for (let i = 0; i < 4; i++) out.push({ beat: off + i, piece: 'ride', velocity: 0.85 });
      out.push({ beat: off + 1.5, piece: 'ride', velocity: 0.7 }, { beat: off + 3.5, piece: 'ride', velocity: 0.7 });
      out.push({ beat: off + 0.75, piece: 'kick', velocity: 0.9 }, { beat: off + 2, piece: 'kick', velocity: 0.9 }, { beat: off + 3, piece: 'tom_high', velocity: 0.8 });
    }
  }
  return out;
}

function chordsFromProg(bars: readonly [label: string, midis: number[]][]): BandChordNote[] {
  return bars.flatMap(([label, midis], bar) => [
    { beat: bar * 4, label, midis, dur: 1.8 },
    { beat: bar * 4 + 2, label, midis, dur: 1.8 },
  ]);
}

function bassFromRoots(roots: readonly [note: string, fifth: string][]): BandMidiNote[] {
  return roots.flatMap(([r, f], bar) => [
    { beat: bar * 4, midi: m(r), dur: 0.9 },
    { beat: bar * 4 + 1.5, midi: m(f), dur: 0.45 },
    { beat: bar * 4 + 2, midi: m(r), dur: 0.9 },
    { beat: bar * 4 + 3, midi: m(f), dur: 0.85 },
  ]);
}

function melodyBars(notesPerBar: readonly [name: string, beatInBar: number, dur: number][][]): BandMidiNote[] {
  return notesPerBar.flatMap((barList, bar) =>
    barList.map(([name, offset, dur]) => ({ beat: bar * 4 + offset, midi: m(name), dur }))
  );
}

export const BAND_SONGS: readonly BandSong[] = [
  {
    id: 'pop_sunshine',
    title: 'Pop Solar (I - V - vi - IV en Do)',
    genre: 'Pop',
    keyLabel: 'Do Mayor',
    bpm: 104,
    bars: 4,
    description: 'Base brillante en Do mayor. Silencia la melodía para improvisar con Xilófono o Melódica.',
    tracks: {
      drums: makeDrums(4, 'pop'),
      bass: bassFromRoots([['C2', 'G2'], ['G1', 'D2'], ['A1', 'E2'], ['F1', 'C2']]),
      chords: chordsFromProg([
        ['C', [60, 64, 67]],
        ['G', [55, 59, 62]],
        ['Am', [57, 60, 64]],
        ['F', [53, 57, 60]],
      ]),
      melody: melodyBars([
        [['E4', 0, 0.9], ['G4', 1, 0.9], ['C5', 2, 1.5]],
        [['D4', 0, 0.9], ['G4', 1, 0.9], ['B4', 2, 1.5]],
        [['E4', 0, 0.9], ['A4', 1, 0.9], ['C5', 2, 1.5]],
        [['F4', 0, 0.9], ['A4', 1, 0.9], ['G4', 2, 1.5]],
      ]),
    },
  },
  {
    id: 'funk_groove',
    title: 'Funk en Mi menor',
    genre: 'Funk',
    keyLabel: 'Mi menor',
    bpm: 98,
    bars: 4,
    description: 'Groove sincopado con séptimas menores; ideal para practicar Bajo o Mini-Batería.',
    tracks: {
      drums: makeDrums(4, 'funk'),
      bass: bassFromRoots([['E1', 'B1'], ['E1', 'D2'], ['A1', 'E2'], ['B1', 'F#2']]),
      chords: chordsFromProg([
        ['Em7', [52, 55, 59, 62]],
        ['Em7', [52, 55, 59, 62]],
        ['Am7', [57, 60, 64, 67]],
        ['B7', [59, 63, 66, 69]],
      ]),
      melody: melodyBars([
        [['E4', 0, 0.5], ['G4', 0.5, 0.5], ['B4', 1.5, 1.0], ['D5', 3, 0.8]],
        [['E5', 0, 0.8], ['D5', 1, 0.8], ['B4', 2, 0.8], ['G4', 3, 0.8]],
        [['A4', 0, 0.5], ['C5', 1, 0.8], ['E5', 2, 1.5]],
        [['D#5', 0, 0.8], ['B4', 1, 0.8], ['A4', 2, 0.8], ['G4', 3, 0.8]],
      ]),
    },
  },
  {
    id: 'cumbia_norte',
    title: 'Cumbia Andina (Am - F - C - G)',
    genre: 'Cumbia',
    keyLabel: 'La menor',
    bpm: 96,
    bars: 4,
    description: 'Pulso bailable con tumbadora y güiro sintéticos en progresión andina.',
    tracks: {
      drums: makeDrums(4, 'cumbia'),
      bass: bassFromRoots([['A1', 'E2'], ['F1', 'C2'], ['C2', 'G2'], ['G1', 'D2']]),
      chords: chordsFromProg([
        ['Am', [57, 60, 64]],
        ['F', [53, 57, 60]],
        ['C', [60, 64, 67]],
        ['G', [55, 59, 62]],
      ]),
      melody: melodyBars([
        [['A4', 0, 0.9], ['C5', 1, 0.9], ['E5', 2, 1.4]],
        [['F5', 0, 0.9], ['E5', 1, 0.9], ['C5', 2, 1.4]],
        [['E5', 0, 0.9], ['D5', 1, 0.9], ['C5', 2, 1.4]],
        [['D5', 0, 0.9], ['B4', 1, 0.9], ['G4', 2, 1.4]],
      ]),
    },
  },
  {
    id: 'bossa_rio',
    title: 'Bossa Suave (Dm7 - G7 - Cmaj7)',
    genre: 'Bossa Nova',
    keyLabel: 'Do Mayor',
    bpm: 108,
    bars: 4,
    description: 'Cadencia II-V-I relajada para cantar o puntear con Xilófono / Melódica.',
    tracks: {
      drums: makeDrums(4, 'bossa'),
      bass: bassFromRoots([['D2', 'A2'], ['G1', 'D2'], ['C2', 'G2'], ['A1', 'E2']]),
      chords: chordsFromProg([
        ['Dm7', [50, 53, 57, 60]],
        ['G7', [55, 59, 62, 65]],
        ['Cmaj7', [60, 64, 67, 71]],
        ['A7', [57, 61, 64, 67]],
      ]),
      melody: melodyBars([
        [['F4', 0, 1.2], ['A4', 1.5, 0.9], ['C5', 2.5, 1.2]],
        [['B4', 0, 1.2], ['G4', 1.5, 0.9], ['F4', 2.5, 1.2]],
        [['E4', 0, 1.5], ['G4', 2, 1.5]],
        [['E4', 0, 0.9], ['G4', 1, 0.9], ['A4', 2, 1.5]],
      ]),
    },
  },
  {
    id: 'jazz_swing_club',
    title: 'Club Jazz Swing (F - Bb - Gm7 - C7)',
    genre: 'Jazz',
    keyLabel: 'Fa Mayor',
    bpm: 120,
    bars: 4,
    description: 'Ride swing clásico con bajo caminante; prueba silenciar Batería o Melodía.',
    tracks: {
      drums: makeDrums(4, 'jazz'),
      bass: bassFromRoots([['F1', 'C2'], ['Bb1', 'F2'], ['G1', 'D2'], ['C2', 'G2']]),
      chords: chordsFromProg([
        ['Fmaj7', [53, 57, 60, 64]],
        ['Bb7', [58, 62, 65, 68]],
        ['Gm7', [55, 58, 62, 65]],
        ['C7', [60, 64, 67, 70]],
      ]),
      melody: melodyBars([
        [['A4', 0, 0.9], ['C5', 1, 0.9], ['E5', 2, 1.5]],
        [['D5', 0, 0.9], ['Bb4', 1, 0.9], ['A4', 2, 1.5]],
        [['Bb4', 0, 0.9], ['D5', 1, 0.9], ['F5', 2, 1.5]],
        [['E5', 0, 0.9], ['C5', 1, 0.9], ['G4', 2, 1.5]],
      ]),
    },
  },
  {
    id: 'rock_arena',
    title: 'Rock Estadio (C - G - F - G)',
    genre: 'Rock',
    keyLabel: 'Do Mayor',
    bpm: 122,
    bars: 4,
    description: 'Energía directa de batería firme y acordes abiertos.',
    tracks: {
      drums: makeDrums(4, 'rock'),
      bass: bassFromRoots([['C2', 'G2'], ['G1', 'D2'], ['F1', 'C2'], ['G1', 'D2']]),
      chords: chordsFromProg([
        ['C', [48, 52, 55]],
        ['G', [55, 59, 62]],
        ['F', [53, 57, 60]],
        ['G', [55, 59, 62]],
      ]),
      melody: melodyBars([
        [['C5', 0, 0.9], ['C5', 1, 0.9], ['G4', 2, 1.4]],
        [['B4', 0, 0.9], ['D5', 1, 0.9], ['G4', 2, 1.4]],
        [['A4', 0, 0.9], ['C5', 1, 0.9], ['F4', 2, 1.4]],
        [['G4', 0, 0.9], ['B4', 1, 0.9], ['D5', 2, 1.4]],
      ]),
    },
  },
  {
    id: 'reggae_coast',
    title: 'Reggae Costa (G - D - Em - C)',
    genre: 'Reggae',
    keyLabel: 'Sol Mayor',
    bpm: 84,
    bars: 4,
    description: 'One-drop tranquilo con espacio entre pulsos para escuchar cada acorde.',
    tracks: {
      drums: makeDrums(4, 'reggae'),
      bass: bassFromRoots([['G1', 'D2'], ['D2', 'A2'], ['E1', 'B1'], ['C2', 'G2']]),
      chords: chordsFromProg([
        ['G', [55, 59, 62]],
        ['D', [50, 54, 57]],
        ['Em', [52, 55, 59]],
        ['C', [48, 52, 55]],
      ]),
      melody: melodyBars([
        [['B4', 0.5, 0.9], ['D5', 1.5, 0.9], ['G4', 2.5, 1.2]],
        [['A4', 0.5, 0.9], ['F#4', 1.5, 0.9], ['D4', 2.5, 1.2]],
        [['G4', 0.5, 0.9], ['B4', 1.5, 0.9], ['E4', 2.5, 1.2]],
        [['E4', 0.5, 0.9], ['G4', 1.5, 0.9], ['C5', 2.5, 1.2]],
      ]),
    },
  },
  {
    id: 'latin_tumbao',
    title: 'Latin Tumbao (Am - Dm - G7 - C)',
    genre: 'Latino',
    keyLabel: 'La menor',
    bpm: 112,
    bars: 4,
    description: 'Cadencia latina cálida con campana y toms.',
    tracks: {
      drums: makeDrums(4, 'latin'),
      bass: bassFromRoots([['A1', 'E2'], ['D2', 'A2'], ['G1', 'D2'], ['C2', 'G2']]),
      chords: chordsFromProg([
        ['Am', [57, 60, 64]],
        ['Dm', [50, 53, 57]],
        ['G7', [55, 59, 62, 65]],
        ['C', [60, 64, 67]],
      ]),
      melody: melodyBars([
        [['E5', 0, 0.8], ['C5', 1, 0.8], ['A4', 2, 1.4]],
        [['F5', 0, 0.8], ['D5', 1, 0.8], ['A4', 2, 1.4]],
        [['D5', 0, 0.8], ['B4', 1, 0.8], ['G4', 2, 1.4]],
        [['C5', 0, 0.8], ['E5', 1, 0.8], ['G5', 2, 1.4]],
      ]),
    },
  },
];

export function bandSongTotalBeats(song: BandSong): number {
  return song.bars * 4;
}
