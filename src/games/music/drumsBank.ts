import type { DrumPieceId } from '../../types.ts';

export type { DrumPieceId };

export interface DrumPieceDef {
  id: DrumPieceId;
  name: string;
  shortName: string;
  code: string;
  keyLabel: string;
  color: string;
  laneOrder: number;
}

export const DRUM_PIECES: readonly DrumPieceDef[] = [
  { id: 'crash', name: 'Crash', shortName: 'Crash', code: 'KeyR', keyLabel: 'R', color: '#F59E0B', laneOrder: 0 },
  { id: 'ride', name: 'Ride', shortName: 'Ride', code: 'KeyU', keyLabel: 'U', color: '#FBBF24', laneOrder: 1 },
  { id: 'hihat_open', name: 'Hi-Hat abierto', shortName: 'HH Ab.', code: 'KeyK', keyLabel: 'K', color: '#38BDF8', laneOrder: 2 },
  { id: 'hihat_closed', name: 'Hi-Hat cerrado', shortName: 'HH Cer.', code: 'KeyJ', keyLabel: 'J', color: '#00E5FF', laneOrder: 3 },
  { id: 'tom_high', name: 'Tom agudo', shortName: 'Tom Ag.', code: 'KeyD', keyLabel: 'D', color: '#A855F7', laneOrder: 4 },
  { id: 'tom_low', name: 'Tom grave', shortName: 'Tom Gr.', code: 'KeyS', keyLabel: 'S', color: '#8B5CF6', laneOrder: 5 },
  { id: 'snare', name: 'Caja', shortName: 'Caja', code: 'KeyF', keyLabel: 'F', color: '#F43F5E', laneOrder: 6 },
  { id: 'kick', name: 'Bombo', shortName: 'Bombo', code: 'Space', keyLabel: 'Espacio', color: '#22C55E', laneOrder: 7 },
];

export const DRUM_PIECE_BY_ID = new Map<DrumPieceId, DrumPieceDef>(DRUM_PIECES.map((p) => [p.id, p]));
export const DRUM_PIECE_BY_CODE = new Map<string, DrumPieceDef>(DRUM_PIECES.map((p) => [p.code, p]));

export type DrumLevel = 'Inicial' | 'Intermedio' | 'Avanzado';

/**
 * Patrón de compás por pieza.
 * '-' silencio, 'x' golpe normal (0.85), 'X' acento (1.1).
 * Largo = 16 semicorcheas (4/4) o 12 corcheas/tresillos (6/8 o swing).
 */
export interface DrumGroove {
  id: string;
  title: string;
  genre: string;
  level: DrumLevel;
  bpm: number;
  steps: 12 | 16;
  beatsPerBar: 3 | 4;
  meterLabel: string;
  tip: string;
  lanes: Partial<Record<DrumPieceId, string>>;
}

export interface DrumHitEvent {
  piece: DrumPieceId;
  beat: number;
  stepIndex: number;
  velocity: number;
}

export interface DrumIndependenceExercise {
  id: string;
  title: string;
  bpm: number;
  steps: 12 | 16;
  beatsPerBar: 3 | 4;
  focus: string;
  explanation: string;
  lanes: Partial<Record<DrumPieceId, string>>;
}

export const DRUM_GROOVES: readonly DrumGroove[] = [
  {
    id: 'rock_basic',
    title: 'Rock Básico 4/4',
    genre: 'Rock',
    level: 'Inicial',
    bpm: 100,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Corcheas',
    tip: 'Mantén constante el Hi-Hat en corcheas (1, y, 2, y...) mientras el Bombo marca tiempos 1-3 y la Caja responde en 2-4.',
    lanes: {
      hihat_closed: 'X-x-x-x-x-x-x-x-',
      snare:        '----X-------X---',
      kick:         'X-------X-------',
    },
  },
  {
    id: 'pop_modern',
    title: 'Pop Moderno',
    genre: 'Pop',
    level: 'Inicial',
    bpm: 106,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Síncopa suave',
    tip: 'El segundo bombo se anticipa medio pulso antes del tiempo 3 (semicorchea 11), dando impulso pop sin recargar.',
    lanes: {
      hihat_closed: 'X-x-x-x-x-x-x-x-',
      snare:        '----X-------X---',
      kick:         'X-------x-x-----',
    },
  },
  {
    id: 'ballad_6_8',
    title: 'Balada 6/8',
    genre: 'Balada',
    level: 'Inicial',
    bpm: 72,
    steps: 12,
    beatsPerBar: 4,
    meterLabel: '6/8 · Dos pulsos ternarios',
    tip: 'Cuenta "1-2-3, 4-5-6": bombo abre en el 1, la caja cae firme en el 4 y el ride sostiene los 6 octavos.',
    lanes: {
      ride:  'X-x-x-x-x-x-',
      snare: '------X-----',
      kick:  'X--x--------',
    },
  },
  {
    id: 'disco_four',
    title: 'Disco Four-on-the-floor',
    genre: 'Disco',
    level: 'Inicial',
    bpm: 118,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Bombo a negras',
    tip: 'El bombo golpea los 4 pulsos fijos (1-2-3-4) y el Hi-Hat abierto respira en cada contratiempo ("y").',
    lanes: {
      hihat_open:   '--x---x---x---x-',
      hihat_closed: 'x---x---x---x---',
      snare:        '----X-------X---',
      kick:         'X---X---X---X---',
    },
  },
  {
    id: 'cumbia_classic',
    title: 'Cumbia Clásica',
    genre: 'Cumbia',
    level: 'Intermedio',
    bpm: 96,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Güiro y tumbadora',
    tip: 'El Hi-Hat dibuja el pulso de güiro ("taca-ta"), el bombo marca 1 y 3 y el tom grave remata el contratiempo.',
    lanes: {
      hihat_closed: 'X-xxX-xxX-xxX-xx',
      snare:        '----x-------x---',
      tom_low:      '--x---x---x---x-',
      kick:         'X-------X-------',
    },
  },
  {
    id: 'reggaeton_dembow',
    title: 'Reggaetón / Dembow',
    genre: 'Reggaetón',
    level: 'Intermedio',
    bpm: 94,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Tresillo 3+3+2',
    tip: 'Bombo constante en negras 1-2-3-4 mientras la caja golpea la síncopa 3+3+2 (pasos 4, 7, 12, 15).',
    lanes: {
      hihat_closed: 'x-x-x-x-x-x-x-x-',
      snare:        '---X--x----X--x-',
      kick:         'X---X---X---X---',
    },
  },
  {
    id: 'funk_sync',
    title: 'Funk Sincopado',
    genre: 'Funk',
    level: 'Intermedio',
    bpm: 98,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Semicorcheas y notas fantasma',
    tip: 'Destaca los acentos de caja en 2 y 4 pero intercala golpes suaves ("x") entre medias y bombo sincopado en el 16.',
    lanes: {
      hihat_closed: 'XxxxXxxxXxxxXx--',
      hihat_open:   '--------------X-',
      snare:        '----X--x-x--X--x',
      kick:         'X--x--x---X-----',
    },
  },
  {
    id: 'bossa_nova',
    title: 'Bossa Nova',
    genre: 'Bossa Nova',
    level: 'Intermedio',
    bpm: 112,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Clave brasileña',
    tip: 'La clave de aro (caja suave) dibuja el patrón 3-3-4-3-3 sobre un bombo balanceado en negra con puntillo + corchea.',
    lanes: {
      hihat_closed: 'x-x-x-x-x-x-x-x-',
      snare:        'X--x--x---x--x--',
      kick:         'X--xX--xX--xX--x',
    },
  },
  {
    id: 'salsa_cascara',
    title: 'Salsa Cáscara / Campana',
    genre: 'Salsa',
    level: 'Avanzado',
    bpm: 116,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Clave 2-3 + cáscara',
    tip: 'El Ride simula la campana de bongo marcando las negras y el contratiempo del 2 y 4; los toms imitan el tumbao.',
    lanes: {
      ride:     'X---X-x-X---X-x-',
      snare:    '--x--x----x-x---',
      tom_high: '------x-------x-',
      tom_low:  '-------x-------x',
      kick:     '---x--x----x--x-',
    },
  },
  {
    id: 'jazz_swing',
    title: 'Jazz Swing',
    genre: 'Jazz',
    level: 'Avanzado',
    bpm: 126,
    steps: 12,
    beatsPerBar: 4,
    meterLabel: '4/4 · Tresillos (spang-a-lang)',
    tip: 'El Ride canta "ding, ding-a-ding" en tresillos mientras el Hi-Hat cerrado pisa firme los tiempos 2 y 4.',
    lanes: {
      ride:         'X--X-xX--X-x',
      hihat_closed: '---X-----X--',
      snare:        '-----x----x-',
      kick:         'x-----x-----',
    },
  },
  {
    id: 'blues_shuffle',
    title: 'Blues Shuffle',
    genre: 'Blues',
    level: 'Avanzado',
    bpm: 108,
    steps: 12,
    beatsPerBar: 4,
    meterLabel: '12/8 · Shuffle ternario',
    tip: 'El Ride salta en cada primera y tercera subdivisión del tresillo (long-short), con caja pesada en 2 y 4.',
    lanes: {
      ride:  'X-xX-xX-xX-x',
      snare: '---X-----X--',
      kick:  'X-x---X-x---',
    },
  },
  {
    id: 'metal_double',
    title: 'Metal Doble Bombo / Fill',
    genre: 'Metal',
    level: 'Avanzado',
    bpm: 132,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Semicorcheas + redoble',
    tip: 'Alterna pies firmes en el bombo y cierra el cuarto tiempo con bajada de toms (tom agudo -> tom grave -> crash).',
    lanes: {
      crash:        'X---------------',
      hihat_closed: '--x-x-x-x-x-----',
      snare:        '----X-------x---',
      tom_high:     '------------Xx--',
      tom_low:      '--------------Xx',
      kick:         'XxXxXxXxXxXx----',
    },
  },
  {
    id: 'festejo_peru',
    title: 'Festejo Afroperuano',
    genre: 'Afroperuano',
    level: 'Intermedio',
    bpm: 114,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Cajón y quijada',
    tip: 'El bombo y los toms imitan los graves y agudos del cajón peruano con acentos sincopados cada 3 semicorcheas.',
    lanes: {
      ride:     'X--x--x-X--x--x-',
      tom_high: '---x--x----x--x-',
      tom_low:  'x-------x---x---',
      snare:    '--X---x---X---x-',
      kick:     'X--x--X-x--x--X-',
    },
  },
  {
    id: 'cumbia_rebajada',
    title: 'Cumbia Rebajada (Lenta)',
    genre: 'Cumbia',
    level: 'Inicial',
    bpm: 78,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Pulso cadencioso',
    tip: 'Tempo reposado ideal para sentir el rebote del güiro en Hi-Hat y el golpe grave del bombo doblado.',
    lanes: {
      hihat_closed: 'X-xxX-xxX-xxX-xx',
      snare:        '----X-------X---',
      tom_low:      '--x---x---x---x-',
      kick:         'X-----x-X-----x-',
    },
  },
  {
    id: 'samba_batucada',
    title: 'Samba Batucada',
    genre: 'Samba',
    level: 'Avanzado',
    bpm: 126,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Surdo y tamborim',
    tip: 'El bombo dibuja el patrón de surdo acentuado en el 2 y 4 mientras la caja imita el tamborim.',
    lanes: {
      hihat_closed: 'XxXxXxXxXxXxXxXx',
      snare:        'x-x-X-x-x-X-x-x-',
      tom_low:      '----X-------X---',
      kick:         'X--xX--xX--xX--x',
    },
  },
  {
    id: 'bebop_ride',
    title: 'Bebop Ride Rápido',
    genre: 'Jazz',
    level: 'Avanzado',
    bpm: 146,
    steps: 12,
    beatsPerBar: 4,
    meterLabel: '4/4 · Tresillos ágiles',
    tip: 'Mantén el Ride ligero en la muñeca y suelta respuestas breves de caja ("comping") sin tensar el pulso.',
    lanes: {
      ride:         'X--X-xX--X-x',
      hihat_closed: '---X-----X--',
      snare:        '--x----x--x-',
      kick:         'x----x-----x',
    },
  },
  {
    id: 'texas_shuffle',
    title: 'Texas Shuffle',
    genre: 'Blues',
    level: 'Intermedio',
    bpm: 116,
    steps: 12,
    beatsPerBar: 4,
    meterLabel: '12/8 · Driving shuffle',
    tip: 'Tanto el Ride como el Bombo doblan el salto ternario para impulsar la guitarra blues con peso constante.',
    lanes: {
      ride:  'X-xX-xX-xX-x',
      snare: '---X-----X--',
      kick:  'X-xX-xX-xX-x',
    },
  },
  {
    id: 'boom_bap_90s',
    title: 'Boom Bap 90s',
    genre: 'Hip-Hop',
    level: 'Inicial',
    bpm: 90,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Groove urbano',
    tip: 'Bombo pesado con anticipación en la cuarta semicorchea y caja seca en tiempos 2 y 4.',
    lanes: {
      hihat_closed: 'X-x-x-x-X-x-x-x-',
      snare:        '----X-------X---',
      kick:         'X--x---xX-x-----',
    },
  },
  {
    id: 'trap_rolls',
    title: 'Trap Hi-Hat Rolls',
    genre: 'Trap',
    level: 'Intermedio',
    bpm: 74,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Medio tiempo con redobles',
    tip: 'La caja cae una sola vez por compás en el tiempo 3 (half-time) mientras el Hi-Hat acelera con ráfagas rápidas.',
    lanes: {
      hihat_closed: 'X-x-xxxxX-xxX-xx',
      snare:        '--------X-------',
      kick:         'X-----x---x--x--',
    },
  },
  {
    id: 'motown_pocket',
    title: 'Motown Pocket',
    genre: 'Soul',
    level: 'Inicial',
    bpm: 108,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Pulso Soul clásico',
    tip: 'Bombo firme en los cuatro pulsos con doblaje en la corchea del 2 y del 4: pura escuela Detroit.',
    lanes: {
      hihat_closed: 'x-x-x-x-x-x-x-x-',
      snare:        '----X-------X---',
      kick:         'X---X-x-X---X-x-',
    },
  },
  {
    id: 'thrash_kick',
    title: 'Thrash Double-Kick',
    genre: 'Metal',
    level: 'Avanzado',
    bpm: 148,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Semicorcheas continuas',
    tip: 'Sostén el flujo parejo en el bombo sin perder el acento firme de caja en el 2 y 4.',
    lanes: {
      crash:        'X---------------',
      hihat_closed: '--x-x-x-x-x-x-x-',
      snare:        '----X-------X---',
      kick:         'XxXxXxXxXxXxXxXx',
    },
  },
  {
    id: 'afrobeat_pulse',
    title: 'Afrobeat Polirrítmico',
    genre: 'Afrobeat',
    level: 'Avanzado',
    bpm: 112,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Tony Allen groove',
    tip: 'El Hi-Hat abierto respira antes del 2 y del 4 mientras la caja teje respuestas suaves alrededor de los acentos.',
    lanes: {
      ride:       'X-x-X-x-X-x-X-x-',
      hihat_open: '--x-------x-----',
      snare:      '----X--x--x-X--x',
      kick:       'X-----x---X---x-',
    },
  },
  {
    id: 'halftime_purdie',
    title: 'Half-Time Purdie Shuffle',
    genre: 'Fusión',
    level: 'Avanzado',
    bpm: 96,
    steps: 12,
    beatsPerBar: 4,
    meterLabel: '12/8 · Notas fantasma',
    tip: 'Mantén las notas fantasma muy suaves en la caja entre el tresillo del Hi-Hat y el backbeat del tiempo 3.',
    lanes: {
      hihat_closed: 'X-xX-xX-xX-x',
      snare:        '-x--x-X--x-x',
      kick:         'X----x----x-',
    },
  },
  {
    id: 'vals_criollo',
    title: 'Vals Criollo 3/4',
    genre: 'Vals',
    level: 'Inicial',
    bpm: 110,
    steps: 12,
    beatsPerBar: 3,
    meterLabel: '3/4 · Tres tiempos',
    tip: 'Cuenta 1-2-3 claro: bombo abre fuerte en el tiempo 1 y la caja con el tom responden en el 2 y el 3.',
    lanes: {
      ride:    'X-x-X-x-X-x-',
      snare:   '----x---x---',
      tom_low: '------x---x-',
      kick:    'X-----------',
    },
  },
  {
    id: 'funk_ghost',
    title: 'Funk Notas Fantasma',
    genre: 'Funk',
    level: 'Avanzado',
    bpm: 94,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Dinámica de caja',
    tip: 'Diferencia con claridad los golpes suaves "x" de los acentos "X" en la caja para conseguir un pocket elástico.',
    lanes: {
      hihat_closed: 'X-x-X-x-X-x-X-x-',
      snare:        '-x--X-x--x-xX-x-',
      kick:         'X--x------X---x-',
    },
  },
  {
    id: 'ska_upstroke',
    title: 'Ska Upstroke',
    genre: 'Ska',
    level: 'Intermedio',
    bpm: 138,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Contratiempo rápido',
    tip: 'Abre el Hi-Hat en cada "y" del compás al ritmo de las guitarras cortadas del ska clásico.',
    lanes: {
      hihat_open:   '--X---X---X---X-',
      hihat_closed: 'x---x---x---x---',
      snare:        '----X-------X---',
      kick:         'X-------X-------',
    },
  },
  {
    id: 'reggae_onedrop',
    title: 'Reggae One Drop',
    genre: 'Reggae',
    level: 'Intermedio',
    bpm: 80,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Silencio en el 1',
    tip: 'Deja vacío el bombo en el pulso 1 y suelta bombo + aro juntos únicamente en el tiempo 3.',
    lanes: {
      hihat_closed: 'x-x-X-x-x-x-X-x-',
      snare:        '--------X-------',
      kick:         '--------X-------',
    },
  },
  {
    id: 'punk_dbeat',
    title: 'Punk D-Beat',
    genre: 'Punk',
    level: 'Avanzado',
    bpm: 152,
    steps: 16,
    beatsPerBar: 4,
    meterLabel: '4/4 · Motor D-Beat',
    tip: 'El bombo galopa en 3+3+2 contra un Hi-Hat abierto continuo a gran velocidad.',
    lanes: {
      crash:      'X---------------',
      hihat_open: '--x-x-x-x-x-x-x-',
      snare:      '----X-------X---',
      kick:       'X--x--X---x---X-',
    },
  },
];

export const DRUM_INDEPENDENCE: readonly DrumIndependenceExercise[] = [
  {
    id: 'ind_hh_kick_snare',
    title: '1. Mano derecha estable + Bombo/Caja alternos',
    bpm: 84,
    steps: 16,
    beatsPerBar: 4,
    focus: 'Hi-Hat a negras + Bombo en corcheas',
    explanation: 'Mantén el Hi-Hat cerrado únicamente en los 4 pulsos principales (pasos 1, 5, 9, 13) mientras el bombo toca en corcheas antes de la caja.',
    lanes: {
      hihat_closed: 'X---X---X---X---',
      snare:        '----X-------X---',
      kick:         'x-x-----x-x-----',
    },
  },
  {
    id: 'ind_offbeat_hh',
    title: '2. Hi-Hat en contratiempos ("y")',
    bpm: 90,
    steps: 16,
    beatsPerBar: 4,
    focus: 'Disociar mano izquierda/pie en el medio pulso',
    explanation: 'El bombo marca los tiempos 1 y 3, la caja marca 2 y 4, pero el Hi-Hat suena SOLO entre pulsos (pasos 3, 7, 11, 15).',
    lanes: {
      hihat_closed: '--X---X---X---X-',
      snare:        '----X-------X---',
      kick:         'X-------X-------',
    },
  },
  {
    id: 'ind_tom_shift',
    title: '3. Desplazamiento entre Caja y Toms',
    bpm: 92,
    steps: 16,
    beatsPerBar: 4,
    focus: 'Precisión espacial de manos sin perder el bombo',
    explanation: 'El bombo sostiene los cuatro pulsos mientras las manos recorren Caja -> Tom agudo -> Tom grave manteniendo el pulso constante.',
    lanes: {
      kick:     'X---X---X---X---',
      snare:    '--x---x---------',
      tom_high: '----------x-----',
      tom_low:  '--------------x-',
    },
  },
  {
    id: 'ind_swing_comp',
    title: '4. Ride Swing + Caja en tresillos',
    bpm: 100,
    steps: 12,
    beatsPerBar: 4,
    focus: 'Independencia ternaria (jazz / blues)',
    explanation: 'Mantén el patrón de Ride ternario con una mano y coloca respuestas breves de caja y bombo sin acelerar los tresillos.',
    lanes: {
      ride:         'X--X-xX--X-x',
      hihat_closed: '---X-----X--',
      snare:        '--x-----x---',
      kick:         'x-----x-----',
    },
  },
  {
    id: 'ind_paradiddle',
    title: '5. Paradiddle repartido (Ride y Caja)',
    bpm: 88,
    steps: 16,
    beatsPerBar: 4,
    focus: 'Alternancia D-I-D-D / I-D-I-I entre plato y caja',
    explanation: 'Aplica el sticking de paradiddle moviendo la mano derecha al Ride y dejando los golpes de mano izquierda suaves en la Caja.',
    lanes: {
      ride:  'X-xx-xXX-xx-xXX-',
      snare: '-x--x----x--x--x',
      kick:  'X-------X-------',
    },
  },
  {
    id: 'ind_bossa_foot',
    title: '6. Pie de Bombo Bossa vs Aro fijo',
    bpm: 96,
    steps: 16,
    beatsPerBar: 4,
    focus: 'Patrón ostinato de pie independiente de la clave',
    explanation: 'Sostén la célula de clave en la caja mientras el pie derecho marca la síncopa brasileña de negra con puntillo y corchea.',
    lanes: {
      hihat_closed: 'x-x-x-x-x-x-x-x-',
      snare:        'X--x--x---x--x--',
      kick:         'X--xX--xX--xX--x',
    },
  },
  {
    id: 'ind_open_hh_4',
    title: '7. Apertura de Hi-Hat en el pulso 4',
    bpm: 94,
    steps: 16,
    beatsPerBar: 4,
    focus: 'Control del Hi-Hat abierto y cierre limpio en el 1',
    explanation: 'Mantén un rock limpio y abre el Hi-Hat únicamente en la última corchea del compás para volver a cerrarlo en el siguiente tiempo 1.',
    lanes: {
      hihat_closed: 'X-x-x-x-x-x-x---',
      hihat_open:   '--------------X-',
      snare:        '----X-------X---',
      kick:         'X-------X-------',
    },
  },
  {
    id: 'ind_tom_cascade',
    title: '8. Cascada de Toms sobre pulso firme',
    bpm: 96,
    steps: 16,
    beatsPerBar: 4,
    focus: 'Fluidez de recorrido por todo el kit sin frenar',
    explanation: 'Ejecuta el fill descendente Caja -> Tom agudo -> Tom grave en los pulsos 3 y 4 sin mover la regularidad del bombo.',
    lanes: {
      hihat_closed: 'X-x-x-x---------',
      snare:        '----X---xx------',
      tom_high:     '----------xx----',
      tom_low:      '------------xxxx',
      kick:         'X-------X---X---',
    },
  },
  {
    id: 'ind_triplet_kick',
    title: '9. Bombo en tresillos contra Ride',
    bpm: 92,
    steps: 12,
    beatsPerBar: 4,
    focus: 'Coordinación pie-mano en subdivisión de 3',
    explanation: 'Lleva el pulso en el Ride por cada grupo de tres y coloca el bombo en la tercera subdivisión antes de cada pulso fuerte.',
    lanes: {
      ride:  'X--X--X--X--',
      snare: '---X-----X--',
      kick:  'X-x---X-x---',
    },
  },
  {
    id: 'ind_vals_criollo',
    title: '10. Independencia ternaria 3/4 (Vals)',
    bpm: 102,
    steps: 12,
    beatsPerBar: 3,
    focus: 'Equilibrio en compás de 3 pulsos por compás',
    explanation: 'Acentúa con claridad el primer pulso con Bombo + Ride y reparte suavemente las respuestas de Caja y Tom en los pulsos 2 y 3.',
    lanes: {
      ride:    'X---X---X---',
      snare:   '----x-------',
      tom_low: '--------x---',
      kick:    'X-----------',
    },
  },
  {
    id: 'ind_ghost_accent',
    title: '11. Notas fantasma vs Acentos en 2 y 4',
    bpm: 88,
    steps: 16,
    beatsPerBar: 4,
    focus: 'Control de dinámica (suave vs fuerte) en la caja',
    explanation: 'Alterna golpes casi inaudibles ("x") con golpes firmes ("X") en la caja manteniendo constante el patrón de Hi-Hat.',
    lanes: {
      hihat_closed: 'X-x-X-x-X-x-X-x-',
      snare:        '-x-xX-x--x-xX-x-',
      kick:         'X-------X-x-----',
    },
  },
  {
    id: 'ind_linear_groove',
    title: '12. Patrón lineal (sin golpes juntos)',
    bpm: 86,
    steps: 16,
    beatsPerBar: 4,
    focus: 'Orquestación lineal donde cada extremidad tiene su turno',
    explanation: 'Ninguna pieza coincide con otra en el mismo paso: Bombo, Hi-Hat y Caja forman una melodía rítmica limpia de 16 pasos.',
    lanes: {
      hihat_closed: '--x---x---x---x-',
      snare:        '----X--x----X--x',
      kick:         'X-------X-x-----',
    },
  },
];

export function grooveStepBeats(groove: Pick<DrumGroove, 'steps' | 'beatsPerBar'>): number {
  return groove.beatsPerBar / groove.steps;
}

/** Convierte una parrilla en eventos cronológicos repetidos `bars` compases. */
export function buildGrooveTimeline(
  groove: Pick<DrumGroove, 'steps' | 'beatsPerBar' | 'lanes'>,
  bars = 1
): DrumHitEvent[] {
  const stepBeat = grooveStepBeats(groove);
  const events: DrumHitEvent[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const barBeatOffset = bar * groove.beatsPerBar;
    for (let step = 0; step < groove.steps; step++) {
      for (const pieceDef of DRUM_PIECES) {
        const lane = groove.lanes[pieceDef.id];
        if (!lane) continue;
        const ch = lane[step];
        if (ch === 'x' || ch === 'X') {
          events.push({
            piece: pieceDef.id,
            beat: barBeatOffset + step * stepBeat,
            stepIndex: step,
            velocity: ch === 'X' ? 1.05 : 0.8,
          });
        }
      }
    }
  }
  return events;
}
