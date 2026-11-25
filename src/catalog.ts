import type {
  DifficultyId,
  GameDescriptor,
  GameModeId,
  GuideExampleFrame,
  SkillAxis,
  StandaloneGameId,
} from './types.ts';

export const AXIS_META: Record<
  SkillAxis,
  { label: string; short: string; accent: string; tip: string }
> = {
  aim: {
    label: 'Puntería',
    short: 'PUNTERÍA',
    accent: '#FF4D38',
    tip: 'Precisión bajo presión y velocidad de desplazamiento 2D/3D.',
  },
  rhythm: {
    label: 'Ritmo',
    short: 'RITMO',
    accent: '#00B4D8',
    tip: 'Lectura de compás, pulso en milisegundos y coordinación.',
  },
  logic: {
    label: 'Lógica',
    short: 'LÓGICA',
    accent: '#D97706',
    tip: 'Memoria de trabajo, cálculo rápido, estrategia y razonamiento.',
  },
  reflex: {
    label: 'Reflejos',
    short: 'REFLEJOS',
    accent: '#65A30D',
    tip: 'Micro-esquiva, bloqueo en milisegundos y defensa espacial.',
  },
  agility: {
    label: 'Agilidad 3D',
    short: 'AGILIDAD',
    accent: '#7B61FF',
    tip: 'Orientación 3D, salto aéreo, rotación espacial y cambios de carril.',
  },
};

// Para qué sirve cada eje, en una frase (sin cifras de mejora: es entrenamiento, no una promesa).
export const AXIS_BENEFIT: Record<SkillAxis, string> = {
  aim: 'afina la precisión de tu pulso y tu mirada cuando hay prisa.',
  rhythm: 'entrena el sentido del pulso y la coordinación entre lo que oyes y lo que haces.',
  logic: 'ejercita la memoria de trabajo y el razonamiento: retener datos y decidir con claridad.',
  reflex: 'acorta el tiempo entre ver algo y reaccionar, para esquivar y bloquear a tiempo.',
  agility: 'mejora la orientación en el espacio y los cambios de dirección rápidos en 3D.',
};

export function axisTrainLine(axis: GameDescriptor['axis']): string {
  return axis === 'all'
    ? 'Entrena: los cinco ejes del perfil, una prueba tras otra.'
    : `Entrena: ${AXIS_META[axis].label} — ${AXIS_BENEFIT[axis]}`;
}

export const DIFFICULTY_META: Record<
  DifficultyId,
  {
    label: string;
    short: string;
    baseScale: number;
    scoreMult: number;
    accent: string;
    desc: string;
  }
> = {
  chill: {
    label: 'CADETE',
    short: '0.78×',
    baseScale: 0.78,
    scoreMult: 0.85,
    accent: '#65A30D',
    desc: 'Velocidad contenida y ventanas amplias para aprender patrones.',
  },
  standard: {
    label: 'ESTÁNDAR',
    short: '1.00×',
    baseScale: 1.0,
    scoreMult: 1.0,
    accent: '#0284C7',
    desc: 'Balance oficial para entrenar todas las áreas.',
  },
  hyper: {
    label: 'ÉLITE',
    short: '1.34×',
    baseScale: 1.34,
    scoreMult: 1.35,
    accent: '#DC2626',
    desc: 'Alta velocidad, blancos exigentes y +35% de puntuación.',
  },
  adaptive: {
    label: 'DINÁMICA (IA)',
    short: 'AUTO',
    baseScale: 1.0,
    scoreMult: 1.15,
    accent: '#D97706',
    desc: 'Se calibra según tu radar y escala en vivo con tu racha o fallos.',
  },
  progressive: {
    label: 'PROGRESIVA',
    short: '↑ ESCALA',
    baseScale: 0.85,
    scoreMult: 1.2,
    accent: '#7C3AED',
    desc: 'Arranca en 0.85× y sube de nivel o velocidad continuamente cada ronda o cada 12s sin bajar al fallar.',
  },
};

function makeFrame(accent: string, inner: string, caption: string): GuideExampleFrame {
  const svg = `<svg viewBox="0 0 320 180" width="320" height="180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${caption.replace(/"/g, '&quot;')}"><rect x="1" y="1" width="318" height="178" rx="10" fill="var(--bg-elevated)" stroke="var(--border-strong)" stroke-width="1.5"/><g style="--frame-accent:${accent}">${inner}</g></svg>`;
  return { svg, caption };
}

export const CIRCUIT_IDS: StandaloneGameId[] = [
  'aim3d',
  'runner3d',
  'cube3d',
  'parkour3d',
  'flight3d',
  'rhythm2d',
  'pulse2d',
  'parry2d',
  'bullet2d',
  'puzzle2d',
  'schulte2d',
  'nback2d',
  'tetris2d',
  'twinstick2d',
  'track2d',
  'memory2d',
  'snake2d',
  'sniper2d',
];

export const ACADEMY_IDS: StandaloneGameId[] = [
  'chess2d',
  'checkers2d',
  'poker2d',
  'rubik3d',
  'piano2d',
  'drums2d',
  'strings2d',
  'band2d',
  'raven2d',
  'sudoku2d',
  'hanoi2d',
  'spatial3d',
  'nonogram2d',
  'logicseq2d',
  'memorypath2d',
  // NeuroLab (7 disciplinas científicas)
  'mackworth2d',
  'chainmath2d',
  'colorcraze2d',
  'mot2d',
  'pathfinder2d',
  'symbolspeed2d',
  'verbal2d',
];

export const STANDALONE_IDS: StandaloneGameId[] = [...ACADEMY_IDS, ...CIRCUIT_IDS];

const CIRCUIT_COUNT = CIRCUIT_IDS.length;
const RANKED_SEC = CIRCUIT_COUNT * 15;
const RANKED_TIME_LABEL = `${Math.floor(RANKED_SEC / 60)}m ${String(RANKED_SEC % 60).padStart(2, '0')}s`;

export const GAME_CATALOG: Record<GameModeId, GameDescriptor> = {
  gauntlet: {
    id: 'gauntlet',
    title: 'CIRCUITO TOTAL',
    subtitle: `2D + 3D · ${CIRCUIT_COUNT} Disciplinas`,
    dimension: '2D + 3D',
    category: 'circuit',
    axis: 'all',
    accent: '#2563EB',
    accentSoft: 'rgba(37, 99, 235, 0.14)',
    controlsPC: 'Dinámicos según fase (Ratón + WASD / DFJK)',
    controlsTouch: 'Controles adaptativos táctiles',
    description: `La prueba total: rota cada 15s entre las ${CIRCUIT_COUNT} disciplinas de acción y destreza sin perder racha ni escudos.`,
    keywords: ['circuito', 'gauntlet', 'maraton', 'rotacion'],
    guide: {
      objective: `Supera tramos de 15 s rotando entre las ${CIRCUIT_COUNT} pruebas rápidas sin agotar tus escudos.`,
      howToPlay: [
        'Al cambiar de prueba aparece un cartel claro con el objetivo y controles; pulsa Listo o espera.',
        'Mantén el combo vivo para multiplicar puntos entre fases 2D y 3D.',
        'Cada cambio exitoso conserva tu racha y aumenta la intensidad.',
      ],
      sectionTutorials: [
        { name: 'Tramos 2D de Destreza', tip: 'Incluye Ritmo, Anillo Sónico, Duelo de Reflejo, Lluvia y Roce, Matriz Mental, Schulte, N-Back, Bloques, Arena 2D, Rastreo, Memoria, Serpiente y Cazador.' },
        { name: 'Tramos 3D de Acción', tip: 'Incluye Puntería Táctica 3D, Túnel Hiper 3D, Rompeórbita 3D, Salto Celeste 3D y Vuelo de Portales 3D.' },
        { name: 'Transición sin estrés', tip: 'El cartel de cambio muestra los controles de la siguiente disciplina y espera hasta que pulses Listo (Espacio) o pasen 8 s.' },
      ],
      controls: [
        { keys: ['Espacio', 'Enter'], touch: 'Toca Listo', action: 'Comenzar siguiente fase', tone: 'primary' },
        { keys: ['Esc'], touch: 'Pausa', action: 'Pausar circuito' },
        { keys: ['?'], touch: 'Botón Guía', action: 'Ver ficha de ayuda' },
      ],
      example: {
        frames: [
          makeFrame(
            '#2563EB',
            '<rect x="28" y="34" width="110" height="112" rx="8" fill="var(--bg-panel)" stroke="var(--accent-cyan)" stroke-width="2"/><text x="83" y="84" text-anchor="middle" fill="var(--ink-primary)" font-size="14" font-weight="700">FASE 2D</text><text x="83" y="106" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">15s</text><path d="M148 90h26m-8-7l8 7-8 7" stroke="var(--accent-cyan)" stroke-width="2.5" fill="none"/><rect x="184" y="34" width="110" height="112" rx="8" fill="var(--bg-panel)" stroke="#7B61FF" stroke-width="2"/><text x="239" y="84" text-anchor="middle" fill="var(--ink-primary)" font-size="14" font-weight="700">FASE 3D</text><text x="239" y="106" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">15s</text>',
            'Alterna entre pruebas 2D y 3D cada 15 segundos.'
          ),
          makeFrame(
            '#2563EB',
            '<rect x="40" y="42" width="240" height="96" rx="10" fill="var(--bg-panel)" stroke="#2563EB" stroke-width="2"/><text x="160" y="76" text-anchor="middle" fill="var(--ink-primary)" font-size="14" font-weight="700">SIGUIENTE FASE</text><rect x="96" y="92" width="128" height="30" rx="6" fill="#2563EB"/><text x="160" y="111" text-anchor="middle" fill="#fff" font-size="12" font-weight="700">LISTO (ESPACIO)</text>',
            'El cartel de transición espera a que pulses Listo (o avanza a los 8s).'
          ),
        ],
      },
      practice: 'El Circuito Total corre directo en modo oficial.',
      challenge: 'Cuenta para tu radar global, récords y racha.',
    },
  },
  ranked: {
    id: 'ranked',
    title: 'PRUEBA CLASIFICATORIA',
    subtitle: `${CIRCUIT_COUNT} Pruebas · ${RANKED_TIME_LABEL}`,
    dimension: '2D + 3D',
    category: 'circuit',
    axis: 'all',
    accent: '#0284C7',
    accentSoft: 'rgba(2, 132, 199, 0.14)',
    controlsPC: 'Ratón + Teclado completo',
    controlsTouch: 'Controles adaptativos táctiles',
    description: `Recorre los ${CIRCUIT_COUNT} desafíos en bloques de 15s para calibrar los 5 ejes de tu radar y subir tu rango oficial.`,
    keywords: ['clasificatoria', 'ranked', 'rango', 'radar'],
    guide: {
      objective: `Completa las ${CIRCUIT_COUNT} pruebas de 15 s para calibrar los 5 ejes de tu radar.`,
      howToPlay: [
        'Juega un bloque de 15 s de cada una de las 18 disciplinas rápidas.',
        'Durante el cartel de transición el reloj clasificatorio se detiene.',
        'Al finalizar obtienes tu calificación por eje y rango oficial.',
      ],
      sectionTutorials: [
        { name: 'Evaluación en 5 Ejes', tip: 'Pondera tu desempeño en Puntería, Ritmo, Lógica, Reflejos y Agilidad 3D para asignar tu rango oficial.' },
        { name: 'Ritmo de Prueba', tip: 'Cada bloque dura 15 s y el reloj general se pausa en los carteles de transición para leer controles.' },
      ],
      controls: [
        { keys: ['Espacio', 'Enter'], touch: 'Toca Listo', action: 'Iniciar cada prueba', tone: 'primary' },
        { keys: ['Esc'], touch: 'Pausa', action: 'Pausar sesión' },
      ],
      example: {
        frames: [
          makeFrame(
            '#0284C7',
            '<polygon points="160,30 220,68 198,136 122,136 100,68" fill="rgba(2,132,199,0.18)" stroke="#0284C7" stroke-width="2.5"/><circle cx="160" cy="88" r="3" fill="#0284C7"/><text x="160" y="160" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">Calibración de los 5 ejes del radar</text>',
            'Evalúa Puntería, Ritmo, Lógica, Reflejos y Agilidad 3D.'
          ),
          makeFrame(
            '#0284C7',
            '<rect x="46" y="46" width="228" height="88" rx="8" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="160" y="82" text-anchor="middle" fill="var(--ink-primary)" font-size="14" font-weight="700">RANGO OFICIAL: S / SS / OMNI</text><text x="160" y="108" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">El reloj se pausa entre transiciones</text>',
            'Al completar los 18 tramos recibes tu rango global.'
          ),
        ],
      },
      practice: 'Modo clasificatorio oficial de evaluación completa.',
      challenge: 'Calibra los 5 ejes de tu perfil con marca oficial.',
    },
  },

  // ==================== 15 ACADEMIAS GUIADAS ====================
  chess2d: {
    id: 'chess2d',
    title: 'AJEDREZ ACADEMIA',
    subtitle: '10 lecciones guiadas y Duelo vs Bot',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'strategy',
    supportsInfinite: false,
    axis: 'logic',
    accent: '#A16207',
    accentSoft: 'rgba(161, 98, 7, 0.14)',
    controlsPC: 'Clic en pieza y destino · P Pista · U Deshacer',
    controlsTouch: 'Toca la pieza y luego la casilla',
    description:
      'Aprende movimientos, jaques, mates, clavada, tenedor doble, enfilada y jaque a la descubierta en 10 lecciones guiadas, o reta al bot de 3 niveles.',
    keywords: ['ajedrez', 'chess', 'jaque', 'mate', 'tablero', 'clavada', 'tenedor', 'enfilada'],
    guide: {
      objective: 'Da jaque mate al rey rival o completa las 10 lecciones guiadas de fundamentos y táctica.',
      howToPlay: [
        'Selecciona una pieza propia para ver sus destinos legales en verde y capturas en rojo.',
        'En Lecciones (10) practica piezas, salidas de jaque, enroque, mates y tácticas (clavada, tenedor, enfilada, descubierta y pasillo).',
        'Usa Pista (P) para ver la mejor jugada explicada con su motivo táctico.',
      ],
      sectionTutorials: [
        { name: '4 Lecciones Base', tip: 'Movimiento de las 6 piezas, 3 formas de salir de jaque, jugadas especiales (enroque, al paso, coronación) y mates básicos.' },
        { name: '6 Lecciones Tácticas', tip: 'Tenedor doble, Clavada absoluta, Enfilada en rayos X, Jaque a la descubierta, Mate del pasillo y Desviación del defensor.' },
        { name: 'Duelo vs Bot (3 niveles)', tip: 'En Práctica tienes aviso de errores graves y deshacer (U); en Reto juegas partida FIDE oficial.' },
      ],
      controls: [
        { keys: ['Clic'], touch: 'Toca pieza y casilla', action: 'Mover o capturar', tone: 'primary' },
        { keys: ['P'], touch: 'Botón Pista', action: 'Sugerencia explicada' },
        { keys: ['U'], touch: 'Botón Deshacer', action: 'Retroceder jugada (práctica)' },
        { keys: ['F'], touch: 'Botón Girar', action: 'Invertir perspectiva del tablero' },
      ],
      example: {
        frames: [
          makeFrame(
            '#A16207',
            '<rect x="70" y="24" width="180" height="132" rx="4" fill="var(--bg-panel)" stroke="var(--border-strong)"/><rect x="115" y="68" width="45" height="44" fill="rgba(161,98,7,0.28)"/><circle cx="137" cy="90" r="12" fill="var(--ink-primary)"/><circle cx="182" cy="90" r="7" fill="#22C55E"/><circle cx="182" cy="46" r="11" fill="none" stroke="#EF4444" stroke-width="3"/>',
            'Puntos verdes marcan casillas legales; anillos rojos indican captura.'
          ),
          makeFrame(
            '#A16207',
            '<rect x="44" y="34" width="232" height="112" rx="8" fill="var(--bg-panel)" stroke="#00E5FF" stroke-width="2"/><text x="160" y="68" text-anchor="middle" fill="#00E5FF" font-size="13" font-weight="700">PISTA RAZONADA: Df7#</text><text x="160" y="96" text-anchor="middle" fill="var(--ink-primary)" font-size="11">Jaque mate: el rey no tiene escape</text><text x="160" y="116" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">y nadie puede capturar la dama.</text>',
            'Cada pista y error explica el porqué en español.'
          ),
        ],
      },
      practice: '10 lecciones jugables, pistas ilimitadas, deshacer y aviso ante errores.',
      challenge: 'Duelo oficial contra el bot (Novato, Club o Maestro) sin deshacer.',
    },
  },

  checkers2d: {
    id: 'checkers2d',
    title: 'DAMAS TÁCTICAS',
    subtitle: '8 lecciones, capturas en cadena y coronación',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'strategy',
    supportsInfinite: false,
    axis: 'logic',
    accent: '#BE123C',
    accentSoft: 'rgba(190, 18, 60, 0.14)',
    controlsPC: 'Clic en pieza y destino · P Pista',
    controlsTouch: 'Toca la pieza y luego la casilla',
    description:
      'Damas 8×8 con 8 lecciones tácticas guiadas, captura obligatoria, saltos múltiples encadenados y dama voladora.',
    keywords: ['damas', 'checkers', 'captura', 'tactica', 'dama voladora'],
    guide: {
      objective: 'Domina las 8 lecciones tácticas o derrota al bot capturando todas sus piezas y controlando las diagonales.',
      howToPlay: [
        'Las piezas con pulso dorado tienen captura obligatoria (hacia adelante o atrás).',
        'Completa las capturas en cadena siguiendo los saltos marcados en el tablero.',
        'En Lecciones (8) practica golpe 2×1, tenaza, sacrificio puente, acceso a dama y oposición final.',
      ],
      sectionTutorials: [
        { name: '8 Lecciones Tácticas', tip: 'Golpe 2×1, Tenaza, Coronar a tiempo, Doble golpe diagonal, Sacrificio puente, Acceso a dama, Oposición final y Gran diagonal.' },
        { name: 'Reglas de Dama Voladora', tip: 'Los peones capturan hacia adelante y atrás; al terminar en la fila 8 coronan en dama de largo alcance sin ley de mayoría.' },
        { name: 'Duelo vs Bot', tip: 'El pulso dorado señala tus piezas obligadas a saltar y Pista (P) advierte trampas múltiples rivales.' },
      ],
      controls: [
        { keys: ['Clic'], touch: 'Toca pieza y destino', action: 'Mover o encadenar captura', tone: 'primary' },
        { keys: ['P'], touch: 'Botón Pista', action: 'Ver jugada táctica explicada' },
        { keys: ['U'], touch: 'Botón Deshacer', action: 'Retroceder jugada (práctica)' },
      ],
      example: {
        frames: [
          makeFrame(
            '#BE123C',
            '<rect x="85" y="25" width="150" height="130" rx="4" fill="var(--bg-panel)" stroke="var(--border-strong)"/><circle cx="122" cy="122" r="14" fill="#F8FAFC" stroke="#FFB800" stroke-width="3"/><circle cx="160" cy="90" r="12" fill="#BE123C"/><circle cx="198" cy="58" r="7" fill="#22C55E"/><path d="M122 122L198 58" stroke="#22C55E" stroke-width="2" stroke-dasharray="4 3"/>',
            'Pulso dorado señala captura obligatoria; destino verde marca el salto.'
          ),
          makeFrame(
            '#BE123C',
            '<circle cx="96" cy="126" r="13" fill="#F8FAFC" stroke="#22C55E" stroke-width="2"/><path d="M96 126L156 76L216 126" stroke="#00E5FF" stroke-width="2.5" fill="none"/><circle cx="156" cy="76" r="11" fill="var(--bg-panel)" stroke="#00E5FF" stroke-width="2"/><text x="156" y="80" text-anchor="middle" fill="#00E5FF" font-size="11" font-weight="700">1</text><circle cx="216" cy="126" r="11" fill="var(--bg-panel)" stroke="#00E5FF" stroke-width="2"/><text x="216" y="130" text-anchor="middle" fill="#00E5FF" font-size="11" font-weight="700">2</text>',
            'Las capturas en cadena muestran la secuencia numerada 1 - 2 - 3.'
          ),
        ],
      },
      practice: '8 lecciones tácticas guiadas con pistas y deshacer ilimitado.',
      challenge: 'Partida completa contra el bot puntuando por margen de piezas.',
    },
  },

  poker2d: {
    id: 'poker2d',
    title: 'PÓKER EDUCATIVO',
    subtitle: "Texas Hold'em con fichas de práctica",
    dimension: '2D',
    category: 'academy',
    academyGroup: 'strategy',
    supportsInfinite: false,
    axis: 'logic',
    accent: '#047857',
    accentSoft: 'rgba(4, 120, 87, 0.14)',
    controlsPC: 'Botones Pasar · Igualar · Subir · Retirarse',
    controlsTouch: 'Toca los botones de acción',
    description:
      'Aprende la jerarquía de las 10 manos, probabilidades en vivo, outs y pot odds en mesa de práctica sin dinero real.',
    keywords: ['poker', 'cartas', 'holdem', 'probabilidad'],
    guide: {
      objective: 'Gana fichas leyendo tu mano, tus outs y la relación riesgo/recompensa (sin dinero real).',
      howToPlay: [
        'Consulta en el panel lateral las 10 manos de póker con tu jugada actual resaltada.',
        'En cada ronda elige Pasar, Igualar, Subir o Retirarse según la fuerza de tu mano.',
        'En práctica consulta tu probabilidad aproximada y el consejo explicado del entrenador.',
      ],
      sectionTutorials: [
        { name: 'Pre-Flop (2 cartas)', tip: 'Valora parejas iniciales, cartas altas conectadas o del mismo palo antes de pagar subidas.' },
        { name: 'Flop, Turn y River', tip: 'Usa la regla del 2 y 4 sobre tus outs para comparar tu equity frente a las pot odds del bote.' },
        { name: 'Guía de 10 Manos (G)', tip: 'Destaca en vivo tu jugada actual desde Carta Alta hasta Escalera Real.' },
      ],
      controls: [
        { keys: ['Clic'], touch: 'Toca acción', action: 'Pasar / Igualar / Subir', tone: 'primary' },
        { keys: ['Clic'], touch: 'Retirarse', action: 'Abandonar mano actual', tone: 'danger' },
      ],
      example: {
        frames: [
          makeFrame(
            '#047857',
            '<rect x="40" y="34" width="240" height="112" rx="46" fill="rgba(4,120,87,0.22)" stroke="#047857" stroke-width="2.5"/><rect x="108" y="68" width="28" height="40" rx="4" fill="#fff" stroke="#334155"/><rect x="142" y="68" width="28" height="40" rx="4" fill="#fff" stroke="#334155"/><rect x="176" y="68" width="28" height="40" rx="4" fill="#fff" stroke="#334155"/><text x="160" y="132" text-anchor="middle" fill="var(--ink-primary)" font-size="11" font-weight="700">Fichas de práctica · Sin dinero real</text>',
            'Mesa educativa contra 3 perfiles: Lucía, Mateo y Sofía.'
          ),
          makeFrame(
            '#047857',
            '<rect x="36" y="30" width="248" height="120" rx="8" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="52" y="56" fill="#047857" font-size="12" font-weight="700">TU MANO ACTUAL: DOBLE PAREJA</text><text x="52" y="82" fill="var(--ink-primary)" font-size="11">Probabilidad estimada: 64%</text><text x="52" y="106" fill="var(--ink-secondary)" font-size="11">Outs: 4 cartas para Full</text><text x="52" y="130" fill="#00E5FF" font-size="11">Consejo: Subir por valor</text>',
            'Guía visual de las 10 manos y cálculo de outs en práctica.'
          ),
        ],
      },
      practice: 'Muestra fuerza Monte Carlo, outs, pot odds y cartas rivales al cierre.',
      challenge: 'Torneo de 20 manos con fichas iniciales iguales y puntuación oficial.',
    },
  },

  rubik3d: {
    id: 'rubik3d',
    title: 'CUBO RUBIK 3D',
    subtitle: 'Método principiante en 5 fases',
    dimension: '3D',
    category: 'academy',
    academyGroup: 'strategy',
    supportsInfinite: false,
    axis: 'agility',
    accent: '#C2410C',
    accentSoft: 'rgba(194, 65, 12, 0.14)',
    controlsPC: 'U D L R F B (Shift = antihorario) · Arrastra para girar la vista',
    controlsTouch: 'Botones de giro · Arrastra para girar la vista',
    description:
      'Resuelve el cubo 3×3 en 3D con cámara orbital libre, flechas visuales de giro y guía animada de las 5 fases.',
    keywords: ['rubik', 'cubo', '3d', 'algoritmos'],
    guide: {
      objective: 'Resuelve las 6 caras del cubo siguiendo las 5 fases del método principiante o mejora tu tiempo.',
      howToPlay: [
        'Arrastra el fondo para rotar la cámara sin perder orientación (blanco abajo, amarillo arriba).',
        'Usa los botones U, D, L, R, F, B (y el interruptor antihorario) para girar capas.',
        'Sigue la barra de 5 fases o pulsa Ver ejemplo para ver cada algoritmo animado.',
      ],
      sectionTutorials: [
        { name: 'Inspección de 15 s (Reto)', tip: 'Orbita el cubo antes de tu primer giro para ubicar el centro blanco y las 4 aristas iniciales.' },
        { name: 'Método Principiante (5 fases)', tip: '1) Cruz blanca · 2) Esquinas blancas · 3) Capa media · 4) Cruz amarilla · 5) Orientar y permutar última capa.' },
        { name: 'Ejemplos Animados', tip: 'En Práctica puedes pausar y reproducir paso a paso el algoritmo de cada fase sobre el cubo 3D.' },
      ],
      controls: [
        { keys: ['U', 'D', 'L', 'R', 'F', 'B'], touch: 'Botones de cara', action: 'Girar capa (Shift = inverso)', tone: 'primary' },
        { keys: ['Arrastrar'], touch: 'Arrastrar fondo', action: 'Orbitar cámara 3D' },
        { keys: ['Flechas'], touch: 'Vista estándar', action: 'Ajustar ángulo de cámara' },
      ],
      example: {
        frames: [
          makeFrame(
            '#C2410C',
            '<g transform="translate(115,32)"><rect x="0" y="0" width="90" height="90" rx="6" fill="var(--bg-panel)" stroke="#C2410C" stroke-width="2"/><line x1="30" y1="0" x2="30" y2="90" stroke="var(--border-strong)"/><line x1="60" y1="0" x2="60" y2="90" stroke="var(--border-strong)"/><line x1="0" y1="30" x2="90" y2="30" stroke="var(--border-strong)"/><line x1="0" y1="60" x2="90" y2="60" stroke="var(--border-strong)"/><path d="M98 16c12 18 12 40 0 58" stroke="#00E5FF" stroke-width="2.5" fill="none"/><polyline points="94,64 98,74 108,68" stroke="#00E5FF" stroke-width="2.5" fill="none"/></g><text x="160" y="152" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">Al enfocar un botón ves la flecha del sentido real</text>',
            'Cada botón muestra la dirección exacta del giro sobre la cara.'
          ),
          makeFrame(
            '#C2410C',
            '<rect x="30" y="34" width="260" height="112" rx="8" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="160" y="64" text-anchor="middle" fill="#C2410C" font-size="12" font-weight="700">FASE 1 A 5 · PROGRESO EN VIVO</text><rect x="52" y="80" width="40" height="12" rx="3" fill="#22C55E"/><rect x="96" y="80" width="40" height="12" rx="3" fill="#22C55E"/><rect x="140" y="80" width="40" height="12" rx="3" fill="#C2410C"/><rect x="184" y="80" width="40" height="12" rx="3" fill="var(--border-strong)"/><rect x="228" y="80" width="40" height="12" rx="3" fill="var(--border-strong)"/><text x="160" y="122" text-anchor="middle" fill="var(--ink-primary)" font-size="11">Algoritmo: U R U\' R\' U\' F\' U F</text>',
            'Detecta automáticamente en qué fase vas y anima los ejemplos.'
          ),
        ],
      },
      practice: 'Mezcla suave o estándar, deshacer y ejemplos animados de las 5 fases.',
      challenge: 'Mezcla oficial de 20 giros, 15s de inspección y cronómetro.',
    },
  },

  piano2d: {
    id: 'piano2d',
    title: 'PIANO MAESTRO',
    subtitle: '42 piezas, 20 progresiones, oído y pentagrama',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'music',
    supportsInfinite: true,
    axis: 'rhythm',
    accent: '#9333EA',
    accentSoft: 'rgba(147, 51, 234, 0.14)',
    controlsPC: 'Teclas Z–M y Q–I (ver teclas pintadas)',
    controlsTouch: 'Toca las teclas del piano',
    description:
      'Teclado de 2 octavas (Do3–Do5) con 42 piezas reales, 20 progresiones de acordes, acompañamiento, oído musical y pentagrama.',
    keywords: ['piano', 'musica', 'oido', 'acordes', 'pentagrama', 'canciones'],
    guide: {
      objective: 'Domina 42 piezas reales, 20 progresiones de acordes, intervalos de oído y lectura en clave de Sol y Fa.',
      howToPlay: [
        'Toca las 2 octavas (Do3–Do5) con clic, toque o con las teclas Z–M y Q–I pintadas.',
        'Elige entre Piano Libre, 42 piezas reales, 20 progresiones de acordes, Oído y Pentagrama.',
        'En Reto elige cualquier pieza/progresión a tempo o el Examen Completo de 3 etapas.',
      ],
      sectionTutorials: [
        { name: 'Piano Libre y Acordes', tip: 'Alterna entre notas sueltas o postura de acorde automático (Mayor, Menor, Séptima) y cambia el timbre.' },
        { name: '42 Piezas (Inicial/Int./Avanz.)', tip: '14 piezas por nivel con acompañamiento armónico en tiempo real y modo Espera en Práctica.' },
        { name: '20 Progresiones, Oído y Pentagrama', tip: 'Entrena enlaces I-V-vi-IV, Blues 12 compases, reconocimiento de intervalos y lectura en claves de Sol y Fa.' },
      ],
      controls: [
        { keys: ['Z..M', 'Q..I'], touch: 'Toca teclas', action: 'Tocar notas Do3 a Do5', tone: 'primary' },
        { keys: ['2,3,5,6,7'], touch: 'Teclas negras', action: 'Sostenidos (#)' },
      ],
      example: {
        frames: [
          makeFrame(
            '#9333EA',
            '<g transform="translate(46,42)"><rect x="0" y="0" width="32" height="92" rx="3" fill="#fff" stroke="#334155"/><rect x="32" y="0" width="32" height="92" rx="3" fill="#fff" stroke="#334155"/><rect x="64" y="0" width="32" height="92" rx="3" fill="rgba(147,51,234,0.28)" stroke="#9333EA" stroke-width="2"/><rect x="96" y="0" width="32" height="92" rx="3" fill="#fff" stroke="#334155"/><rect x="128" y="0" width="32" height="92" rx="3" fill="#fff" stroke="#334155"/><rect x="160" y="0" width="32" height="92" rx="3" fill="#fff" stroke="#334155"/><rect x="192" y="0" width="32" height="92" rx="3" fill="#fff" stroke="#334155"/><rect x="22" y="0" width="20" height="54" rx="2" fill="#1E293B"/><rect x="54" y="0" width="20" height="54" rx="2" fill="#1E293B"/><rect x="118" y="0" width="20" height="54" rx="2" fill="#1E293B"/><text x="80" y="78" text-anchor="middle" fill="#9333EA" font-size="11" font-weight="700">Mi</text></g>',
            'Cada tecla muestra su nombre musical y su tecla del ordenador.'
          ),
          makeFrame(
            '#9333EA',
            '<g stroke="var(--ink-secondary)" stroke-width="1.5"><line x1="56" y1="54" x2="264" y2="54"/><line x1="56" y1="68" x2="264" y2="68"/><line x1="56" y1="82" x2="264" y2="82"/><line x1="56" y1="96" x2="264" y2="96"/><line x1="56" y1="110" x2="264" y2="110"/></g><ellipse cx="160" cy="82" rx="10" ry="7" fill="#9333EA"/><text x="160" y="142" text-anchor="middle" fill="var(--ink-primary)" font-size="11">Lee la nota en el pentagrama y tócala en el teclado</text>',
            'Incluye 42 piezas reales, 20 progresiones de acordes y pentagrama.'
          ),
        ],
      },
      practice: 'Las 42 melodías esperan tu nota sin prisa; metrónomo y velocidad regulable.',
      challenge: 'Toca la pieza o progresión elegida a tempo o completa el Examen Completo.',
    },
  },

  drums2d: {
    id: 'drums2d',
    title: 'BATERÍA ACADEMIA',
    subtitle: 'Kit de 8 piezas, 28 ritmos y 12 retos de independencia',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'music',
    supportsInfinite: true,
    axis: 'rhythm',
    accent: '#E11D48',
    accentSoft: 'rgba(225, 29, 72, 0.14)',
    controlsPC: 'Espacio Bombo · F Caja · J/K Hi-Hat · D/S Toms · R/U Platos',
    controlsTouch: 'Toca directamente cada pieza de la batería',
    description:
      'Batería interactiva de 8 piezas con 28 ritmos reales (Rock, Pop, Funk, Bossa, Cumbia, Festejo, Jazz, Samba, Metal) y 12 ejercicios de independencia.',
    keywords: ['bateria', 'drums', 'percusion', 'ritmo', 'compas', 'cumbia', 'rock', 'jazz'],
    guide: {
      objective: 'Domina los 28 ritmos por género y los 12 ejercicios de independencia coordinando bombo, caja y platos.',
      howToPlay: [
        'Toca cada una de las 8 piezas con clic/toque o con las teclas indicadas en cada tambor y plato.',
        'En Ritmos por Género explora los 28 patrones en parrilla de 12 o 16 pasos mientras la barra marca el pulso.',
        'En Tocar Guiado y los 12 retos de Independencia activa Esperar golpe en práctica o toca a tempo en Reto.',
      ],
      sectionTutorials: [
        { name: 'Kit Libre y Grabador de Loop', tip: 'Graba tu propio bucle de 2 compases con metrónomo visual y edita la parrilla de pasos.' },
        { name: '28 Ritmos por Género', tip: 'Incluye Rock, Pop, Funk, Bossa, Cumbia, Festejo Afroperuano, Samba, Bebop, Trap, Vals 3/4 y Metal.' },
        { name: '12 Independencia y Guiado', tip: 'Disocia pie derecho (bombo), mano izquierda (caja) y mano derecha (charles/ride) con conteo preciso.' },
      ],
      controls: [
        { keys: ['Espacio', 'F'], touch: 'Pads Bombo / Caja', action: 'Golpear Bombo y Caja', tone: 'primary' },
        { keys: ['J', 'K'], touch: 'Hi-Hat Cerrado / Abierto', action: 'Marcar pulso en charles' },
        { keys: ['D', 'S', 'R', 'U'], touch: 'Toms y Platos', action: 'Toms agudo/grave, Crash y Ride' },
      ],
      example: {
        frames: [
          makeFrame(
            '#E11D48',
            '<circle cx="160" cy="112" r="28" fill="var(--bg-panel)" stroke="#E11D48" stroke-width="2.5"/><text x="160" y="116" text-anchor="middle" fill="var(--ink-primary)" font-size="11" font-weight="700">BOMBO</text><circle cx="104" cy="96" r="22" fill="var(--bg-panel)" stroke="#00E5FF" stroke-width="2"/><text x="104" y="100" text-anchor="middle" fill="var(--ink-primary)" font-size="10">CAJA (F)</text><circle cx="216" cy="82" r="22" fill="var(--bg-panel)" stroke="#F59E0B" stroke-width="2"/><text x="216" y="86" text-anchor="middle" fill="var(--ink-primary)" font-size="10">HI-HAT (J)</text>',
            'Vista cenital clara con el nombre y la tecla en cada pieza.'
          ),
          makeFrame(
            '#E11D48',
            '<rect x="36" y="42" width="248" height="96" rx="8" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="52" y="68" fill="#E11D48" font-size="11" font-weight="700">PARRILLA 16 PASOS · ROCK / FUNK / CUMBIA</text><rect x="52" y="82" width="18" height="18" rx="3" fill="#E11D48"/><rect x="104" y="82" width="18" height="18" rx="3" fill="#00E5FF"/><rect x="156" y="82" width="18" height="18" rx="3" fill="#E11D48"/><rect x="208" y="82" width="18" height="18" rx="3" fill="#00E5FF"/>',
            'Observa qué piezas suenan en cada tiempo y síguelas en vivo.'
          ),
        ],
      },
      practice: 'Modo espera paso a paso, metrónomo visual y velocidad desde 0.6×.',
      challenge: 'Elige cualquiera de los 28 ritmos, 12 independencia o Resistencia Infinita.',
    },
  },

  strings2d: {
    id: 'strings2d',
    title: 'GUITARRA, BAJO Y UKELELE',
    subtitle: 'Mástil interactivo, 40+ acordes y 32 canciones/riffs',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'music',
    supportsInfinite: true,
    axis: 'rhythm',
    accent: '#D97706',
    accentSoft: 'rgba(217, 119, 6, 0.14)',
    controlsPC: '1–4 Postura de acorde · Espacio Rasguear · Clic en trastes',
    controlsTouch: 'Toca acordes o trastes · Botón Rasguear',
    description:
      'Cambia al instante entre Guitarra (6 cuerdas), Bajo (4 cuerdas) y Ukelele (4 cuerdas) con 40 acordes esenciales (44 formas), 32 canciones/riffs y 10 cajas de escala.',
    keywords: ['guitarra', 'bajo', 'ukelele', 'cuerdas', 'acordes', 'riffs', 'mastil'],
    guide: {
      objective: 'Domina 40+ acordes reales, cambios a tempo, líneas de bajo, 10 escalas de mástil y 32 canciones/riffs.',
      howToPlay: [
        'Elige arriba tu instrumento activo: Guitarra (6 cuerdas), Bajo Eléctrico (4) o Ukelele (4).',
        'En Canciones de acordes y Cambios, pulsa 1–4 para colocar la postura y Espacio para rasguear a tempo.',
        'En Riffs, Bajo, Escalas (10 cajas) y Mástil Libre toca directamente cualquier cuerda y traste del 0 al 12.',
      ],
      sectionTutorials: [
        { name: 'Acordes y Mástil Libre (40+ formas)', tip: 'Inspecciona digitación 1–4, cejillas y notas reales en Guitarra, Ukelele o Bajo.' },
        { name: '32 Canciones y Riffs (14/11/7)', tip: '14 piezas de Guitarra, 11 líneas de Bajo y 7 temas de Ukelele sin cortar la canción por un error.' },
        { name: 'Cambios y 10 Cajas de Escala', tip: 'Entrena cambios de acorde con metrónomo y recorre 10 patrones de escala (pentatónica, blues, dórico, mayor).' },
      ],
      controls: [
        { keys: ['1..4'], touch: 'Barra de acordes', action: 'Colocar postura de acorde', tone: 'primary' },
        { keys: ['Espacio'], touch: 'Botón Rasguear', action: 'Rasguear acorde activo', tone: 'primary' },
        { keys: ['Clic', '1..6'], touch: 'Toca cuerda y traste', action: 'Pulsar nota en el mástil' },
      ],
      example: {
        frames: [
          makeFrame(
            '#D97706',
            '<rect x="34" y="44" width="252" height="88" rx="6" fill="var(--bg-panel)" stroke="#D97706" stroke-width="2"/><line x1="34" y1="64" x2="286" y2="64" stroke="var(--ink-secondary)"/><line x1="34" y1="88" x2="286" y2="88" stroke="var(--ink-secondary)"/><line x1="34" y1="112" x2="286" y2="112" stroke="var(--ink-secondary)"/><line x1="96" y1="44" x2="96" y2="132" stroke="var(--border-strong)"/><line x1="160" y1="44" x2="160" y2="132" stroke="var(--border-strong)"/><circle cx="128" cy="64" r="9" fill="#D97706"/><text x="128" y="68" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">1</text><circle cx="192" cy="88" r="9" fill="#00E5FF"/><text x="192" y="92" text-anchor="middle" fill="#000" font-size="10" font-weight="700">2</text>',
            'El mástil muestra qué dedo (1-4) y qué nota pisar en cada cuerda.'
          ),
          makeFrame(
            '#D97706',
            '<rect x="38" y="42" width="244" height="96" rx="8" fill="var(--bg-panel)" stroke="#22C55E" stroke-width="2"/><text x="160" y="72" text-anchor="middle" fill="#22C55E" font-size="12" font-weight="700">GUITARRA · BAJO · UKELELE</text><text x="160" y="98" text-anchor="middle" fill="var(--ink-primary)" font-size="11">40+ acordes esenciales y 32 piezas reales</text><text x="160" y="118" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">(Romance, Pop, Blues, Walking Bass, Funk, Cumbia)</text>',
            'Practica cambios de acorde con metrónomo o toca riffs nota por nota.'
          ),
        ],
      },
      practice: 'Espera tu acorde o nota en el mástil y muestra diagramas de dedos.',
      challenge: 'Toca cualquiera de las 32 canciones/riffs a tempo sin cortar por un fallo.',
    },
  },

  band2d: {
    id: 'band2d',
    title: 'ENSAMBLE Y XILÓFONO',
    subtitle: 'Xilófono, Melódica, Piano, Batería y Bajo · 18 bases',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'music',
    supportsInfinite: true,
    axis: 'rhythm',
    accent: '#0D9488',
    accentSoft: 'rgba(13, 148, 136, 0.14)',
    controlsPC: 'Teclas Z–M / 1–8 según instrumento · Mutea pistas con 1 clic',
    controlsTouch: 'Toca láminas o pads · Silencia la pista que quieras cubrir',
    description:
      'Elige Xilófono/Marimba, Melódica/Flauta, Piano, Mini-Batería o Bajo y toca encima de 18 bases completas silenciando cualquier pista.',
    keywords: ['ensamble', 'banda', 'xilofono', 'marimba', 'melodica', 'flauta', 'jam'],
    guide: {
      objective: 'Toca tu instrumento favorito acompañado por una banda completa de 4 pistas sincronizadas en 18 bases.',
      howToPlay: [
        'Selecciona arriba qué instrumento quieres tocar: Xilófono/Marimba, Melódica/Flauta, Piano, Batería o Bajo.',
        'Elige una de las 18 bases multipista y silencia con un clic el canal que tú vas a interpretar.',
        'Sigue las notas iluminadas junto al resto del grupo o improvisa en Jam Infinito.',
      ],
      sectionTutorials: [
        { name: '5 Instrumentos Activos', tip: 'Cambia al instante entre Xilófono/Marimba, Melódica/Flauta, Piano, Mini-Batería y Bajo.' },
        { name: 'Mezclador de 4 Pistas y 18 Bases', tip: 'Silencia la pista que vas a cubrir (Batería, Bajo, Acordes o Melodía) y deja que la banda te acompañe.' },
        { name: 'Jam Infinito', tip: 'Enlaza vueltas de las 18 bases acelerando suavemente el tempo para entrenar tu oído e improvisación.' },
      ],
      controls: [
        { keys: ['Z..M', '1..8'], touch: 'Toca láminas / teclas', action: 'Interpretar instrumento activo', tone: 'primary' },
        { keys: ['Clic en pista'], touch: 'Botones de canal', action: 'Silenciar o activar Batería/Bajo/Acordes/Melodía' },
      ],
      example: {
        frames: [
          makeFrame(
            '#0D9488',
            '<g transform="translate(48,40)"><rect x="0" y="6" width="24" height="84" rx="4" fill="#EF4444"/><rect x="28" y="10" width="24" height="76" rx="4" fill="#F59E0B"/><rect x="56" y="14" width="24" height="68" rx="4" fill="#EAB308"/><rect x="84" y="18" width="24" height="60" rx="4" fill="#22C55E"/><rect x="112" y="22" width="24" height="52" rx="4" fill="#06B6D4"/><rect x="140" y="26" width="24" height="44" rx="4" fill="#3B82F6"/><rect x="168" y="30" width="24" height="36" rx="4" fill="#8B5CF6"/><rect x="196" y="34" width="24" height="28" rx="4" fill="#EC4899"/></g><text x="160" y="152" text-anchor="middle" fill="var(--ink-primary)" font-size="11">Xilófono / Marimba, Melódica, Piano, Batería y Bajo</text>',
            'Cambia de instrumento en un clic y toca junto a la banda.'
          ),
          makeFrame(
            '#0D9488',
            '<rect x="36" y="36" width="248" height="108" rx="8" fill="var(--bg-panel)" stroke="#0D9488" stroke-width="2"/><text x="54" y="64" fill="#0D9488" font-size="11" font-weight="700">MEZCLADOR DE BANDA (4 CANALES)</text><text x="54" y="88" fill="var(--ink-primary)" font-size="11">[ON] Batería   [ON] Bajo   [ON] Acordes</text><text x="54" y="112" fill="#00E5FF" font-size="11" font-weight="700">[TÚ TOCAS] Melodía en Xilófono / Flauta</text>',
            'Quita la pista que quieras cubrir y la banda te acompaña a tempo.'
          ),
        ],
      },
      practice: 'Silencia o escucha cualquier pista y practica la guía nota por nota.',
      challenge: 'Interpreta tu parte con la banda a tempo o en Jam Infinito progresivo.',
    },
  },

  raven2d: {
    id: 'raven2d',
    title: 'MATRICES LÓGICAS',
    subtitle: 'Razonamiento abstracto tipo Raven',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'iq',
    supportsInfinite: true,
    axis: 'logic',
    accent: '#4338CA',
    accentSoft: 'rgba(67, 56, 202, 0.14)',
    controlsPC: 'Clic en la opción · 1–8',
    controlsTouch: 'Toca la opción correcta',
    description:
      'Deduce la figura que completa la matriz 3×3 identificando reglas de forma, cantidad, relleno, giro o XOR.',
    keywords: ['raven', 'matrices', 'iq', 'logica', 'patrones'],
    guide: {
      objective: 'Descubre las reglas por fila y columna para elegir la pieza exacta que completa la matriz 3×3.',
      howToPlay: [
        'Observa la matriz 3×3: la esquina inferior derecha está vacía.',
        'Analiza cada atributo por separado: forma, cantidad, tamaño, relleno y rotación.',
        'Elige la opción correcta (1–8); tras responder verás la explicación exacta de las reglas.',
      ],
      sectionTutorials: [
        { name: 'Niveles 1–3 (Reglas Aditivas)', tip: 'Aísla un atributo cada vez (cantidad, rotación, tamaño o relleno) primero por fila y luego por columna.' },
        { name: 'Nivel 4 (Superposición XOR)', tip: 'Superpone celda 1 y celda 2 de cada fila: los elementos repetidos se cancelan y los únicos permanecen en la tercera.' },
      ],
      controls: [
        { keys: ['1..8', 'Clic'], touch: 'Toca opción', action: 'Elegir respuesta', tone: 'primary' },
        { keys: ['P'], touch: 'Botón Pista', action: 'Ver regla en práctica' },
      ],
      example: {
        frames: [
          makeFrame(
            '#4338CA',
            '<g transform="translate(96,24)" stroke="var(--border-strong)" fill="var(--bg-panel)"><rect x="0" y="0" width="38" height="38"/><rect x="44" y="0" width="38" height="38"/><rect x="88" y="0" width="38" height="38"/><rect x="0" y="44" width="38" height="38"/><rect x="44" y="44" width="38" height="38"/><rect x="88" y="44" width="38" height="38"/><rect x="0" y="88" width="38" height="38"/><rect x="44" y="88" width="38" height="38"/><rect x="88" y="88" width="38" height="38" stroke="#4338CA" stroke-width="2" stroke-dasharray="4 3"/></g><text x="203" y="136" text-anchor="middle" fill="#4338CA" font-size="16" font-weight="700">?</text>',
            'Analiza fila por fila para deducir la novena celda.'
          ),
          makeFrame(
            '#4338CA',
            '<rect x="34" y="34" width="252" height="112" rx="8" fill="var(--bg-panel)" stroke="#22C55E" stroke-width="2"/><text x="160" y="66" text-anchor="middle" fill="#22C55E" font-size="12" font-weight="700">REGLA DETECTADA</text><text x="160" y="92" text-anchor="middle" fill="var(--ink-primary)" font-size="11">Cantidad sube 1 - 2 - 3 por fila.</text><text x="160" y="114" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">Relleno alterna vacío, rayado y lleno.</text>',
            'Cada respuesta explica con claridad qué reglas gobiernan la matriz.'
          ),
        ],
      },
      practice: 'Sin límite de tiempo por matriz y Pista Razonada paso a paso.',
      challenge: '12 matrices progresivas con tiempo límite por problema.',
    },
  },

  sudoku2d: {
    id: 'sudoku2d',
    title: 'SUDOKU RAZONADO',
    subtitle: '4×4 · 6×6 · 9×9 con pistas explicadas',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'iq',
    supportsInfinite: true,
    axis: 'logic',
    accent: '#0369A1',
    accentSoft: 'rgba(3, 105, 161, 0.14)',
    controlsPC: 'Flechas + 1–9 · N Candidatos · P Pista',
    controlsTouch: 'Toca la celda y el número',
    description:
      'Tableros de solución única en 4×4, 6×6 y 9×9 con modo candidatos y pistas que explican la deducción lógica.',
    keywords: ['sudoku', 'logica', 'numeros', 'deduccion'],
    guide: {
      objective: 'Completa cada fila, columna y región sin repetir números usando deducción pura (solución única).',
      howToPlay: [
        'Elige tamaño 4×4, 6×6 o 9×9 y selecciona una celda vacía.',
        'Activa Candidatos (N) para anotar posibles números antes de decidir.',
        'Si te atascas en práctica, pulsa Pista (P) para ver qué técnica lógica deduce la celda.',
      ],
      sectionTutorials: [
        { name: 'Modo Candidatos (N)', tip: 'Anota posibilidades pequeñas en cada celda para detectar Pares Desnudos e intersecciones sin adivinar.' },
        { name: 'Pista Razonada (P)', tip: 'Explica la deducción exacta (Single Desnudo, Single Oculto o Par Desnudo) resaltando fila, columna y caja.' },
        { name: 'Modo Infinito', tip: 'Encadena tableros de solución única escalando automáticamente 4×4 → 6×6 → 9×9.' },
      ],
      controls: [
        { keys: ['1..9'], touch: 'Teclado numérico', action: 'Colocar número o candidato', tone: 'primary' },
        { keys: ['N'], touch: 'Candidatos', action: 'Alternar notas pequeñas' },
        { keys: ['P'], touch: 'Pista Razonada', action: 'Explicar siguiente celda' },
        { keys: ['U'], touch: 'Deshacer', action: 'Deshacer paso (práctica)' },
      ],
      example: {
        frames: [
          makeFrame(
            '#0369A1',
            '<rect x="94" y="24" width="132" height="132" rx="4" fill="var(--bg-panel)" stroke="var(--border-strong)" stroke-width="2"/><line x1="138" y1="24" x2="138" y2="156" stroke="var(--border-strong)"/><line x1="182" y1="24" x2="182" y2="156" stroke="var(--border-strong)"/><line x1="94" y1="68" x2="226" y2="68" stroke="var(--border-strong)"/><line x1="94" y1="112" x2="226" y2="112" stroke="var(--border-strong)"/><rect x="138" y="68" width="44" height="44" fill="rgba(3,105,161,0.22)" stroke="#0369A1" stroke-width="2"/><text x="160" y="96" text-anchor="middle" fill="#0369A1" font-size="16" font-weight="700">7</text>',
            'Resalta fila, columna y región de la celda seleccionada.'
          ),
          makeFrame(
            '#0369A1',
            '<rect x="34" y="34" width="252" height="112" rx="8" fill="var(--bg-panel)" stroke="#00E5FF" stroke-width="2"/><text x="160" y="64" text-anchor="middle" fill="#00E5FF" font-size="12" font-weight="700">SINGLE DESNUDO · FILA 3 COL 7</text><text x="160" y="90" text-anchor="middle" fill="var(--ink-primary)" font-size="11">En la fila ya están 1, 4, 6 y en la</text><text x="160" y="110" text-anchor="middle" fill="var(--ink-primary)" font-size="11">columna 2, 5, 8, 9: solo cabe el 7.</text>',
            'Las pistas razonadas explican el descarte paso a paso.'
          ),
        ],
      },
      practice: 'Conflictos señalados en vivo, pistas razonadas y deshacer ilimitado.',
      challenge: 'Cronómetro oficial con límite de 3 errores.',
    },
  },

  hanoi2d: {
    id: 'hanoi2d',
    title: 'TORRES DE HANÓI',
    subtitle: 'Recursión visual y movimientos óptimos',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'iq',
    supportsInfinite: false,
    axis: 'logic',
    accent: '#15803D',
    accentSoft: 'rgba(21, 128, 61, 0.14)',
    controlsPC: 'Teclas 1 · 2 · 3 o clic en torres',
    controlsTouch: 'Toca origen y destino',
    description:
      'Mueve la torre completa a la última vara en el óptimo de 2^n − 1 pasos, con simulador de pila recursiva paso a paso.',
    keywords: ['hanoi', 'torres', 'recursion', 'optimo'],
    guide: {
      objective: 'Traslada todos los discos de la torre A a la torre C sin colocar jamás un disco grande sobre uno pequeño.',
      howToPlay: [
        'Toca una torre (o pulsa 1, 2, 3) para tomar su disco superior.',
        'Los destinos legales se marcan en verde; los ilegales indican por qué no caben.',
        'Explora el Ejemplo Recursivo para ver cómo hanoi(n) se divide en subproblemas.',
      ],
      sectionTutorials: [
        { name: 'Resolución Directa (3 a 6 discos)', tip: 'Mueve el disco menor en cada turno impar hacia C (si N es impar) o hacia B (si N es par).' },
        { name: 'Inspector de Pila Recursiva', tip: 'En Práctica reproduce paso a paso la pila de llamadas hanoi(n, A→C) para entender el algoritmo óptimo.' },
      ],
      controls: [
        { keys: ['1', '2', '3'], touch: 'Toca torre A, B o C', action: 'Seleccionar origen / destino', tone: 'primary' },
        { keys: ['P'], touch: 'Paso óptimo', action: 'Sugerir movimiento óptimo' },
        { keys: ['U'], touch: 'Deshacer', action: 'Retroceder movimiento (práctica)' },
      ],
      example: {
        frames: [
          makeFrame(
            '#15803D',
            '<line x1="36" y1="142" x2="284" y2="142" stroke="var(--border-strong)" stroke-width="3"/><line x1="82" y1="54" x2="82" y2="142" stroke="var(--ink-secondary)" stroke-width="3"/><line x1="160" y1="54" x2="160" y2="142" stroke="var(--ink-secondary)" stroke-width="3"/><line x1="238" y1="54" x2="238" y2="142" stroke="var(--ink-secondary)" stroke-width="3"/><rect x="48" y="126" width="68" height="14" rx="4" fill="#15803D"/><rect x="58" y="110" width="48" height="14" rx="4" fill="#0284C7"/><rect x="68" y="94" width="28" height="14" rx="4" fill="#D97706"/>',
            'Solo puedes mover el disco superior de cada torre.'
          ),
          makeFrame(
            '#15803D',
            '<rect x="34" y="34" width="252" height="112" rx="8" fill="var(--bg-panel)" stroke="#15803D" stroke-width="2"/><text x="160" y="64" text-anchor="middle" fill="#15803D" font-size="12" font-weight="700">PILA RECURSIVA · ÓPTIMO 2^n - 1</text><text x="160" y="90" text-anchor="middle" fill="var(--ink-primary)" font-size="11">1. Mueve n-1 discos de A hacia B</text><text x="160" y="110" text-anchor="middle" fill="var(--ink-primary)" font-size="11">2. Mueve el disco mayor de A a C</text><text x="160" y="130" text-anchor="middle" fill="var(--ink-primary)" font-size="11">3. Mueve n-1 discos de B hacia C</text>',
            'El reproductor paso a paso visualiza cada llamada recursiva.'
          ),
        ],
      },
      practice: 'Ejemplo recursivo interactivo, paso óptimo explicado y deshacer.',
      challenge: 'Completa la torre en el mínimo número de movimientos y tiempo.',
    },
  },

  spatial3d: {
    id: 'spatial3d',
    title: 'ROTACIÓN ESPACIAL 3D',
    subtitle: 'Poliedros Shepard-Metzler y quiralidad 3D',
    dimension: '3D',
    category: 'academy',
    academyGroup: 'iq',
    supportsInfinite: true,
    axis: 'agility',
    accent: '#2563EB',
    accentSoft: 'rgba(37, 99, 235, 0.14)',
    controlsPC: 'Teclas 1–4 o clic en candidata · Arrastra para inspeccionar en 3D',
    controlsTouch: 'Toca la figura rotada correcta · Arrastra en práctica',
    description:
      'Identifica cuál de las 4 figuras 3D es exactamente el modelo rotado en el espacio y descarta imágenes especulares (espejo).',
    keywords: ['rotacion', 'espacial', '3d', 'shepard', 'iq', 'geometria', 'espejo'],
    guide: {
      objective: 'Descubre qué figura candidata coincide exactamente con el modelo 3D tras rotarlo sin reflejarlo en espejo.',
      howToPlay: [
        'Observa el brazo principal y los giros en L del modelo 3D a la izquierda.',
        'Mentalmente rota la estructura y compárala con las 4 opciones candidatas.',
        'En práctica puedes orbitar la figura y ver la explicación de por qué las demás son espejo.',
      ],
      sectionTutorials: [
        { name: 'Deducción de Quiralidad (6 a 13 cubos)', tip: 'Traza la columna vertebral más larga y verifica el giro de la mano derecha en cada codo.' },
        { name: 'Inspector 3D en Práctica', tip: 'Tras responder, alinea la figura candidata con el modelo o superpón el fantasma para verificar reflejos.' },
      ],
      controls: [
        { keys: ['1..4', 'Clic'], touch: 'Toca candidata', action: 'Seleccionar figura rotada', tone: 'primary' },
        { keys: ['P'], touch: 'Botón Pista', action: 'Ver orientación de los brazos' },
      ],
      example: {
        frames: [
          makeFrame(
            '#2563EB',
            '<rect x="36" y="34" width="96" height="112" rx="8" fill="var(--bg-panel)" stroke="#2563EB" stroke-width="2"/><text x="84" y="56" text-anchor="middle" fill="#2563EB" font-size="11" font-weight="700">MODELO 3D</text><path d="M68 112V74h26v18h16" fill="none" stroke="#00E5FF" stroke-width="8" stroke-linecap="square"/><rect x="152" y="34" width="132" height="52" rx="6" fill="var(--bg-panel)" stroke="#22C55E" stroke-width="2"/><text x="218" y="64" text-anchor="middle" fill="#22C55E" font-size="11" font-weight="700">A: ROTACIÓN REAL</text><rect x="152" y="94" width="132" height="52" rx="6" fill="var(--bg-panel)" stroke="#EF4444" stroke-width="1.5"/><text x="218" y="124" text-anchor="middle" fill="#EF4444" font-size="11">B: ESPEJO QUIRAL</text>',
            'Distingue una rotación 3D real de una reflexión en espejo.'
          ),
        ],
      },
      practice: 'Inspección 3D interactiva, pista de eje de giro y explicación detallada.',
      challenge: '10 rondas progresivas o Modo Infinito de 6 a 13 cubos.',
    },
  },

  nonogram2d: {
    id: 'nonogram2d',
    title: 'NONOGRAMAS DEDUCTIVOS',
    subtitle: 'Matrices lógicas 5×5 · 8×8 · 10×10 sin adivinar',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'iq',
    supportsInfinite: true,
    axis: 'logic',
    accent: '#0284C7',
    accentSoft: 'rgba(2, 132, 199, 0.14)',
    controlsPC: 'Clic Pintar · Clic der / X Descartar · P Pista razonada',
    controlsTouch: 'Alterna Pintar / Marcar X y toca celdas',
    description:
      'Descubre la figura oculta cruzando las pistas numéricas de filas y columnas mediante solapamiento y deducción pura.',
    keywords: ['nonograma', 'picross', 'griddlers', 'logica', 'deduccion', 'iq'],
    guide: {
      objective: 'Pinta los bloques exactos indicados en cada fila y columna sin adivinar ninguna celda.',
      howToPlay: [
        'Los números indican bloques consecutivos de celdas pintadas separados por al menos 1 casilla vacía.',
        'Marca con una X las celdas que deduzcas que deben ir vacías para acotar el resto.',
        'Usa Pista Razonada para aprender técnicas de solapamiento central y bordes.',
      ],
      sectionTutorials: [
        { name: 'Herramienta Pintar vs Marcar X', tip: 'Usa X (clic derecho o tecla X) para descartar casillas imposibles y acotar los bloques de líneas cruzadas.' },
        { name: 'Solapamiento y Modo Infinito', tip: 'Empieza por sumas exactas y bloques mayores que la mitad de la línea; encadena tableros 5×5 → 8×8 → 10×10.' },
      ],
      controls: [
        { keys: ['Clic'], touch: 'Toca celda (Modo Pintar)', action: 'Pintar bloque', tone: 'primary' },
        { keys: ['X', 'Clic Der'], touch: 'Modo Marcar X', action: 'Marcar casilla vacía segura' },
        { keys: ['P'], touch: 'Pista Razonada', action: 'Ver fila o columna deducible' },
      ],
      example: {
        frames: [
          makeFrame(
            '#0284C7',
            '<g transform="translate(88,28)"><text x="-16" y="24" text-anchor="end" fill="#0284C7" font-size="12" font-weight="700">4</text><rect x="0" y="6" width="26" height="26" fill="var(--bg-panel)" stroke="var(--border-strong)"/><rect x="28" y="6" width="26" height="26" fill="#0284C7"/><rect x="56" y="6" width="26" height="26" fill="#0284C7"/><rect x="84" y="6" width="26" height="26" fill="#0284C7"/><rect x="112" y="6" width="26" height="26" fill="var(--bg-panel)" stroke="var(--border-strong)"/></g><text x="160" y="118" text-anchor="middle" fill="var(--ink-primary)" font-size="11">Pista [4] en ancho 5: las 3 celdas centrales son seguras</text>',
            'Técnica de solapamiento: deduce celdas seguras sin adivinar.'
          ),
        ],
      },
      practice: 'Pistas deductivas explicadas en español y verificación de líneas.',
      challenge: 'Resuelve tableros 5×5, 8×8 o encadénalos en Modo Infinito.',
    },
  },

  logicseq2d: {
    id: 'logicseq2d',
    title: 'SERIES Y SILOGISMOS',
    subtitle: '150+ retos: sucesiones, analogías, lógica formal y sesgos',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'iq',
    supportsInfinite: true,
    axis: 'logic',
    accent: '#7C3AED',
    accentSoft: 'rgba(124, 58, 237, 0.14)',
    controlsPC: 'Teclas 1–4 o clic en opción · P Pista',
    controlsTouch: 'Toca la respuesta deducida',
    description:
      '150+ retos de inteligencia verbal-numérica y pensamiento crítico: series de 2º orden, 72+ analogías, silogismos con Venn y 48+ sesgos.',
    keywords: ['series', 'sucesiones', 'analogias', 'silogismos', 'sesgos', 'iq', 'razonamiento'],
    guide: {
      objective: 'Supera 150+ retos curados deduciendo la regla matemática, analogía verbal, silogismo formal o sesgo cognitivo.',
      howToPlay: [
        'Alterna o filtra entre 4 áreas: Sucesiones Numéricas, Analogías (72+), Silogismos (24+ dominios) y Sesgos (48+).',
        'Analiza diferencias entre términos o dibuja mentalmente los conjuntos del silogismo.',
        'Tras cada respuesta revisa la explicación formal y el diagrama de conjuntos en SVG.',
      ],
      sectionTutorials: [
        { name: 'Sucesiones Numéricas', tip: 'Comprueba diferencias de 1er y 2º orden, potencias n²+k o dos subseries intercaladas.' },
        { name: 'Analogías Estructurales (72+)', tip: 'Formula la relación exacta entre A y B en su mismo orden y aplícala a C.' },
        { name: 'Silogismos y Sesgos (48+)', tip: 'En silogismos apóyate en el diagrama de Venn; en sesgos detecta tasas base, muestreo o falacias.' },
      ],
      controls: [
        { keys: ['1..4', 'Clic'], touch: 'Toca opción A–D', action: 'Confirmar deducción', tone: 'primary' },
        { keys: ['P'], touch: 'Botón Pista', action: 'Ver estructura de la regla' },
      ],
      example: {
        frames: [
          makeFrame(
            '#7C3AED',
            '<circle cx="132" cy="86" r="36" fill="rgba(124,58,237,0.18)" stroke="#7C3AED" stroke-width="2"/><circle cx="184" cy="86" r="36" fill="rgba(0,229,255,0.18)" stroke="#00E5FF" stroke-width="2"/><text x="114" y="90" text-anchor="middle" fill="var(--ink-primary)" font-size="11" font-weight="700">A</text><text x="158" y="90" text-anchor="middle" fill="var(--ink-primary)" font-size="11" font-weight="700">A∩B</text><text x="202" y="90" text-anchor="middle" fill="var(--ink-primary)" font-size="11" font-weight="700">B</text><text x="160" y="152" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">150+ retos con diagramas de Venn y reglas explicadas</text>',
            'Cada problema explica la regla exacta o el diagrama de conjuntos.'
          ),
        ],
      },
      practice: 'Filtra por cualquiera de las 4 áreas y consulta pistas sin límite de tiempo.',
      challenge: 'Serie oficial evaluada o Modo Infinito sobre 150+ retos y reglas crecientes.',
    },
  },

  memorypath2d: {
    id: 'memorypath2d',
    title: 'PALACIO MENTAL',
    subtitle: 'Memoria asociativa espacial y resistencia a interferencia',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'iq',
    supportsInfinite: true,
    axis: 'logic',
    accent: '#059669',
    accentSoft: 'rgba(5, 150, 105, 0.14)',
    controlsPC: 'Espacio Ya lo memoricé · Clic en casillas y símbolos',
    controlsTouch: 'Toca Ya lo memoricé y reconstruye las ubicaciones',
    description:
      'Codifica símbolos y conceptos en estancias espaciales, supera una breve interferencia cognitiva y reconstruye el mapa de memoria.',
    keywords: ['palacio', 'memoria', 'loci', 'asociativa', 'mnemotecnia', 'iq'],
    guide: {
      objective: 'Memoriza qué símbolo y concepto ocupa cada estancia del mapa y recupéralos tras la fase de interferencia.',
      howToPlay: [
        'Fase 1 (Codificar): asocia cada icono y palabra clave con su sala del tablero y pulsa Ya lo memoricé.',
        'Fase 2 (Interferencia): resuelve una pregunta breve para limpiar la memoria ecoica.',
        'Fase 3 (Evocar): coloca cada símbolo en su ubicación u orden exacto.',
      ],
      sectionTutorials: [
        { name: 'Fase 1 · Codificación Loci', tip: 'Une cada símbolo con un rasgo visual exagerado de su habitación formando una ruta.' },
        { name: 'Fase 2 · Interferencia Activa', tip: 'El cálculo rápido o reto Stroop limpia la memoria inmediata antes de evocar.' },
        { name: 'Fase 3 · Evocación y Revisión', tip: 'Coloca cada icono en su estancia exacta; en Práctica consulta la historia Loci sugerida.' },
      ],
      controls: [
        { keys: ['Espacio'], touch: 'Botón Ya lo memoricé', action: 'Pasar a evocación', tone: 'primary' },
        { keys: ['Clic', '1..9'], touch: 'Toca sala y símbolo', action: 'Reconstruir asociación' },
      ],
      example: {
        frames: [
          makeFrame(
            '#059669',
            '<rect x="44" y="36" width="68" height="68" rx="8" fill="var(--bg-panel)" stroke="#059669" stroke-width="2"/><text x="78" y="74" text-anchor="middle" fill="#059669" font-size="11" font-weight="700">1 · FARO</text><rect x="126" y="36" width="68" height="68" rx="8" fill="var(--bg-panel)" stroke="#00E5FF" stroke-width="2"/><text x="160" y="74" text-anchor="middle" fill="#00E5FF" font-size="11" font-weight="700">2 · LLAVE</text><rect x="208" y="36" width="68" height="68" rx="8" fill="var(--bg-panel)" stroke="#F59E0B" stroke-width="2"/><text x="242" y="74" text-anchor="middle" fill="#F59E0B" font-size="11" font-weight="700">3 · RELOJ</text><text x="160" y="138" text-anchor="middle" fill="var(--ink-primary)" font-size="11">Método de Loci: conecta lugar + imagen + orden</text>',
            'Aprende técnicas de palacio mental y agrupación espacial.'
          ),
        ],
      },
      practice: 'Consejos mnemotécnicos en cada ronda y tiempo libre de codificación.',
      challenge: 'Rondas progresivas de 3 a 10 estancias con interferencia activa.',
    },
  },

  // ==================== 7 DISCIPLINAS NEUROLAB (NEURONATION++) ====================
  mackworth2d: {
    id: 'mackworth2d',
    title: 'RELOJ DE MACKWORTH',
    subtitle: 'Vigilancia sostenida y detección de doble salto',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'neuro',
    supportsInfinite: true,
    axis: 'reflex',
    accent: '#0EA5E9',
    accentSoft: 'rgba(14, 165, 233, 0.14)',
    controlsPC: 'Espacio / Enter o Clic en el botón Detectar',
    controlsTouch: 'Toca la esfera o el botón Detectar doble salto',
    description:
      'Prueba clásica de vigilancia sostenida: sigue la aguja luminosa alrededor de 18 a 24 nodos y reacciona al instante cuando ejecute un doble salto.',
    keywords: ['mackworth', 'reloj', 'vigilancia', 'atencion', 'neurolab', 'neuronation', 'clockwise'],
    guide: {
      objective: 'Detecta cada doble salto de la aguja luminosa con la menor latencia posible sin cometer falsas alarmas.',
      howToPlay: [
        'Observa el reloj circular: la aguja avanza un nodo por pulso en sentido horario.',
        'Cuando la aguja salte dos espacios de golpe, pulsa Espacio o toca la pantalla de inmediato.',
        'Evita pulsar en pasos normales: cada falsa alarma rompe tu racha y descuenta un escudo.',
      ],
      sectionTutorials: [
        { name: 'Vigilancia Sostenida', tip: 'Mantén la mirada relajada en el centro del reloj para captar el ritmo constante con visión periférica.' },
        { name: 'Ritmo Progresivo', tip: 'A mayor intensidad aumentan los nodos (de 18 a 24) y se reduce el intervalo entre pulsos.' },
      ],
      controls: [
        { keys: ['Espacio', 'Clic'], touch: 'Tocar esfera / botón', action: 'Reportar doble salto', tone: 'primary' },
        { keys: ['Esc'], touch: 'Pausa', action: 'Pausar sesión' },
      ],
      example: {
        frames: [
          makeFrame(
            '#0EA5E9',
            '<circle cx="160" cy="90" r="56" fill="none" stroke="var(--border-strong)" stroke-width="2"/><circle cx="160" cy="34" r="5" fill="var(--ink-muted)"/><circle cx="198" cy="48" r="5" fill="var(--ink-muted)"/><circle cx="216" cy="90" r="7" fill="#0EA5E9"/><line x1="160" y1="90" x2="210" y2="90" stroke="#0EA5E9" stroke-width="3"/><text x="160" y="164" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">Paso normal: avanza 1 nodo (no pulsar)</text>',
            'En pasos normales de 1 nodo debes mantener la calma y esperar.'
          ),
          makeFrame(
            '#0EA5E9',
            '<circle cx="160" cy="90" r="56" fill="none" stroke="var(--border-strong)" stroke-width="2"/><circle cx="198" cy="48" r="5" fill="var(--ink-muted)" stroke="#F59E0B" stroke-dasharray="2 2"/><circle cx="216" cy="90" r="5" fill="none" stroke="#EF4444" stroke-width="2"/><circle cx="198" cy="132" r="8" fill="#22C55E"/><path d="M198 48 A56 56 0 0 1 198 132" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-dasharray="5 3"/><text x="160" y="164" text-anchor="middle" fill="#22C55E" font-size="11" font-weight="700">DOBLE SALTO: PULSA ESPACIO YA</text>',
            'Cuando omite un nodo y avanza 2 espacios, responde en milisegundos.'
          ),
        ],
      },
      practice: 'Resalta suavemente el nodo omitido tras cada evento sin perder escudos.',
      challenge: '65s oficiales (o Infinito) midiendo latencia en ms y precisión sostenida.',
    },
  },

  chainmath2d: {
    id: 'chainmath2d',
    title: 'REACCIÓN EN CADENA',
    subtitle: 'Cálculo mental encadenado en memoria de trabajo',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'neuro',
    supportsInfinite: true,
    axis: 'logic',
    accent: '#F59E0B',
    accentSoft: 'rgba(245, 158, 11, 0.14)',
    controlsPC: 'Teclas 1–4 o Clic para elegir resultado · Espacio siguiente paso (práctica)',
    controlsTouch: 'Toca la opción correcta al final de la cadena',
    description:
      'Retén el número inicial y actualiza tu total mentalmente a través de cadenas de sumas, restas y multiplicaciones a velocidad creciente.',
    keywords: ['calculo', 'cadena', 'matematicas', 'aritmetica', 'memoria', 'neurolab', 'chain'],
    guide: {
      objective: 'Mantén el acumulado mental durante toda la secuencia de operaciones y selecciona el resultado final sin dudar.',
      howToPlay: [
        'Observa el número semilla al principio de cada cadena.',
        'Aplica cada operación secuencial (+, -, ×) manteniendo únicamente el resultado parcial en tu cabeza.',
        'Cuando termine la cadena, elige la respuesta exacta entre las 4 opciones (teclas 1 a 4 o clic).',
      ],
      sectionTutorials: [
        { name: 'Actualización Mental', tip: 'Reemplaza el número anterior en cuanto calcules el nuevo parcial para no saturar tu memoria.' },
        { name: 'Escala de Cadena', tip: 'Con cada ronda crecen los pasos (de 3 hasta 7 operaciones) y la cadencia de aparición.' },
      ],
      controls: [
        { keys: ['1..4', 'Clic'], touch: 'Tocar opción', action: 'Confirmar resultado final', tone: 'primary' },
        { keys: ['Espacio'], touch: 'Botón Siguiente', action: 'Avanzar paso manual en práctica' },
      ],
      example: {
        frames: [
          makeFrame(
            '#F59E0B',
            '<rect x="34" y="54" width="56" height="56" rx="8" fill="var(--bg-panel)" stroke="#F59E0B" stroke-width="2"/><text x="62" y="88" text-anchor="middle" fill="var(--ink-primary)" font-size="18" font-weight="700">14</text><text x="114" y="88" text-anchor="middle" fill="#00E5FF" font-size="16" font-weight="700">+7</text><text x="166" y="88" text-anchor="middle" fill="#EF4444" font-size="16" font-weight="700">-5</text><text x="220" y="88" text-anchor="middle" fill="#22C55E" font-size="16" font-weight="700">×2</text><text x="274" y="88" text-anchor="middle" fill="#F59E0B" font-size="18" font-weight="700">= ?</text>',
            'Actualiza paso a paso: 14 -> 21 -> 16 -> 32.'
          ),
          makeFrame(
            '#F59E0B',
            '<rect x="44" y="42" width="106" height="40" rx="8" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="97" y="67" text-anchor="middle" fill="var(--ink-primary)" font-size="14" font-weight="700">1 · 30</text><rect x="170" y="42" width="106" height="40" rx="8" fill="rgba(34,197,94,0.18)" stroke="#22C55E" stroke-width="2"/><text x="223" y="67" text-anchor="middle" fill="#22C55E" font-size="14" font-weight="700">2 · 32</text><rect x="44" y="94" width="106" height="40" rx="8" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="97" y="119" text-anchor="middle" fill="var(--ink-primary)" font-size="14" font-weight="700">3 · 34</text><rect x="170" y="94" width="106" height="40" rx="8" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="223" y="119" text-anchor="middle" fill="var(--ink-primary)" font-size="14" font-weight="700">4 · 28</text>',
            'Al cerrar la cadena responde rápido con las teclas 1 a 4.'
          ),
        ],
      },
      practice: 'Avance pausado con botón paso a paso y repaso de cada operación si fallas.',
      challenge: '65s oficiales o Modo Infinito escalando longitud de cadena y velocidad.',
    },
  },

  colorcraze2d: {
    id: 'colorcraze2d',
    title: 'LOCURA DE COLOR',
    subtitle: 'Efecto Stroop, cambio de reglas e inhibición Go/No-Go',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'neuro',
    supportsInfinite: true,
    axis: 'logic',
    accent: '#EC4899',
    accentSoft: 'rgba(236, 72, 153, 0.14)',
    controlsPC: 'Teclas 1–4 para responder · Espacio para inhibir (No-Go)',
    controlsTouch: 'Toca la opción según la regla o el botón Inhibir',
    description:
      'Entrena flexibilidad cognitiva e inhibición de impulsos: alterna al vuelo entre Color de Tinta, Palabra, Forma y bloqueos Go/No-Go.',
    keywords: ['stroop', 'color', 'inhibicion', 'reglas', 'flexibilidad', 'gonogo', 'neurolab'],
    guide: {
      objective: 'Obedece la regla activa del cartel superior al milisegundo y frena el impulso cuando aparezca la alerta No-Go.',
      howToPlay: [
        'Mira siempre el cartel de regla arriba: puede pedir COLOR DE TINTA, PALABRA, FORMA o NO TOQUES SI ES ROJO.',
        'La regla cambia en medio de la ronda con un aviso sonoro y visual: adapta tu respuesta al instante.',
        'Cuando aplique Go/No-Go y el estímulo sea rojo, pulsa Espacio (Inhibir) en lugar de elegir un color.',
      ],
      sectionTutorials: [
        { name: 'Costo de Cambio (Switch Cost)', tip: 'Cada cambio de regla exige desconectar el criterio anterior; medimos tu latencia extra en cambios.' },
        { name: 'Inhibición Go/No-Go', tip: 'Si el cartel indica NO TOQUES SI ES ROJO y el estímulo tiene tinta o borde rojo, frena y pulsa Inhibir.' },
      ],
      controls: [
        { keys: ['1..4', 'Clic'], touch: 'Botones de respuesta', action: 'Responder según la regla activa', tone: 'primary' },
        { keys: ['Espacio'], touch: 'Botón Inhibir', action: 'Frenar respuesta en estímulo No-Go', tone: 'danger' },
      ],
      example: {
        frames: [
          makeFrame(
            '#EC4899',
            '<rect x="64" y="22" width="192" height="28" rx="6" fill="#EC4899"/><text x="160" y="40" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">REGLA: COLOR DE TINTA</text><rect x="96" y="64" width="128" height="62" rx="10" fill="var(--bg-panel)" stroke="#0EA5E9" stroke-width="2.5"/><text x="160" y="102" text-anchor="middle" fill="#0EA5E9" font-size="22" font-weight="700">ROJO</text><text x="160" y="156" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">Respuesta correcta: AZUL (la tinta, no la palabra)</text>',
            'En modo Color de Tinta ignora lo que lees y elige el color visible.'
          ),
          makeFrame(
            '#EC4899',
            '<rect x="44" y="22" width="232" height="28" rx="6" fill="#DC2626"/><text x="160" y="40" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">REGLA: NO TOQUES SI ES ROJO</text><polygon points="160,62 196,122 124,122" fill="rgba(239,68,68,0.22)" stroke="#EF4444" stroke-width="2.5"/><text x="160" y="110" text-anchor="middle" fill="#EF4444" font-size="12" font-weight="700">VERDE</text><text x="160" y="156" text-anchor="middle" fill="#EF4444" font-size="11" font-weight="700">Es rojo: pulsa ESPACIO (Inhibir)</text>',
            'En bloqueos Go/No-Go frena el reflejo automático al ver el estímulo prohibido.'
          ),
        ],
      },
      practice: 'Feedback inmediato explicando cada cambio de regla sin descontar escudos.',
      challenge: '65s oficiales (o Infinito) midiendo precisión, latencia y costo de cambio.',
    },
  },

  mot2d: {
    id: 'mot2d',
    title: 'RASTREO MÚLTIPLE',
    subtitle: 'Seguimiento visual simultáneo (MOT / Shuffler)',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'neuro',
    supportsInfinite: true,
    axis: 'aim',
    accent: '#10B981',
    accentSoft: 'rgba(16, 185, 129, 0.14)',
    controlsPC: 'Clic sobre las esferas objetivo al detenerse',
    controlsTouch: 'Toca las esferas que seguiste cuando se detengan',
    description:
      'Sigue simultáneamente de 3 a 6 esferas marcadas entre 8 y 14 discos en movimiento elástico y señálalas todas cuando se detengan.',
    keywords: ['mot', 'rastreo', 'shuffler', 'atencion', 'dividida', 'tracking', 'neurolab'],
    guide: {
      objective: 'No pierdas de vista las esferas objetivo mientras rebotan mezcladas con distractores idénticos y márcalas al final.',
      howToPlay: [
        'Fase 1 (2.5s): entre 3 y 6 esferas se iluminan en dorado con anillo objetivo.',
        'Fase 2 (5–7s): todas adoptan el mismo aspecto y rebotan por la arena a velocidad creciente.',
        'Fase 3: al frenar, haz clic o toca únicamente las esferas originales.',
      ],
      sectionTutorials: [
        { name: 'Centroide Visual', tip: 'En lugar de saltar ojo por ojo, agrupa los objetivos como los vértices de un polígono imaginario y mira su centro.' },
        { name: 'Escalado MOT', tip: 'Cada ronda acertada incrementa el número de objetivos (hasta 6) y la velocidad de rebote.' },
      ],
      controls: [
        { keys: ['Clic'], touch: 'Tocar esferas', action: 'Seleccionar objetivos originales', tone: 'primary' },
        { keys: ['Esc'], touch: 'Pausa', action: 'Pausar rastreo' },
      ],
      example: {
        frames: [
          makeFrame(
            '#10B981',
            '<circle cx="96" cy="70" r="14" fill="#10B981" stroke="#F59E0B" stroke-width="3"/><circle cx="192" cy="60" r="14" fill="#10B981" stroke="#F59E0B" stroke-width="3"/><circle cx="152" cy="122" r="14" fill="#10B981" stroke="#F59E0B" stroke-width="3"/><circle cx="230" cy="112" r="13" fill="var(--bg-panel)" stroke="var(--border-strong)" stroke-width="2"/><circle cx="78" cy="124" r="13" fill="var(--bg-panel)" stroke="var(--border-strong)" stroke-width="2"/><text x="160" y="162" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">1. Memoriza las esferas iluminadas (2.5s)</text>',
            'Al inicio se iluminan las esferas que debes rastrear.'
          ),
          makeFrame(
            '#10B981',
            '<circle cx="114" cy="86" r="13" fill="var(--bg-panel)" stroke="#00E5FF" stroke-width="2"/><circle cx="176" cy="74" r="13" fill="var(--bg-panel)" stroke="#00E5FF" stroke-width="2"/><circle cx="164" cy="126" r="13" fill="var(--bg-panel)" stroke="#00E5FF" stroke-width="2"/><circle cx="222" cy="108" r="13" fill="var(--bg-panel)" stroke="#00E5FF" stroke-width="2"/><path d="M96 70 Q130 50 114 86 M192 60 Q210 90 176 74" fill="none" stroke="#10B981" stroke-width="1.5" stroke-dasharray="4 3"/><text x="160" y="162" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">2. Síguelas en movimiento y señálalas al frenar</text>',
            'Todas se vuelven iguales durante el movimiento; márcalas al parar.'
          ),
        ],
      },
      practice: 'Velocidad moderada y revelación visual clara sin perder escudos.',
      challenge: 'Rondas oficiales de 70s o Modo Infinito subiendo esferas y rapidez.',
    },
  },

  pathfinder2d: {
    id: 'pathfinder2d',
    title: 'BUSCADOR DE RUTAS',
    subtitle: 'Secuencia visoespacial Corsi directa e inversa',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'neuro',
    supportsInfinite: true,
    axis: 'logic',
    accent: '#6366F1',
    accentSoft: 'rgba(99, 102, 241, 0.14)',
    controlsPC: 'Clic en los nodos en orden directo o inverso',
    controlsTouch: 'Toca los nodos siguiendo el sentido indicado',
    description:
      'Versión avanzada de los bloques de Corsi: memoriza rutas conectadas sobre cuadrículas 4×4 y 5×5 alternando orden directo e inverso.',
    keywords: ['corsi', 'rutas', 'pathfinder', 'memoria', 'espacial', 'inverso', 'neurolab'],
    guide: {
      objective: 'Reproduce la ruta iluminada en el orden exacto (directo o inverso) ignorando los destellos distractores.',
      howToPlay: [
        'Comprueba el indicador superior: ORDEN DIRECTO (del primero al último) u ORDEN INVERSO (del último al primero).',
        'Observa cómo se enciende la ruta nodo a nodo sobre la cuadrícula 4×4 o 5×5.',
        'Ignora los destellos rojos distractores de niveles altos y toca los nodos de la ruta real en el orden pedido.',
      ],
      sectionTutorials: [
        { name: 'Orden Directo vs Inverso', tip: 'En orden inverso visualiza el trazado como una figura geométrica y recórrela desde el punto final hacia atrás.' },
        { name: 'Filtro de Distractores', tip: 'A partir de niveles intermedios aparecen nodos rojos breves: no pertenecen a la ruta conectada.' },
      ],
      controls: [
        { keys: ['Clic'], touch: 'Tocar nodos', action: 'Trazar secuencia en orden', tone: 'primary' },
        { keys: ['R'], touch: 'Botón Repetir (práctica)', action: 'Volver a ver la ruta en práctica' },
      ],
      example: {
        frames: [
          makeFrame(
            '#6366F1',
            '<g stroke="#6366F1" stroke-width="2.5" fill="none"><path d="M96 56 L160 56 L160 108 L224 108"/></g><circle cx="96" cy="56" r="14" fill="#6366F1"/><text x="96" y="60" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">1</text><circle cx="160" cy="56" r="14" fill="#6366F1"/><text x="160" y="60" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">2</text><circle cx="160" cy="108" r="14" fill="#6366F1"/><text x="160" y="112" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">3</text><circle cx="224" cy="108" r="14" fill="#00E5FF"/><text x="224" y="112" text-anchor="middle" fill="#081018" font-size="11" font-weight="700">4</text><text x="160" y="156" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">Directo: 1-2-3-4 · Inverso: 4-3-2-1</text>',
            'Observa el recorrido conectado y respeta el sentido de la ronda.'
          ),
          makeFrame(
            '#6366F1',
            '<rect x="44" y="28" width="232" height="30" rx="6" fill="rgba(245,158,11,0.18)" stroke="#F59E0B"/><text x="160" y="48" text-anchor="middle" fill="#F59E0B" font-size="12" font-weight="700">MODO: ORDEN INVERSO</text><circle cx="110" cy="104" r="14" fill="var(--bg-panel)" stroke="#EF4444" stroke-width="2"/><text x="110" y="108" text-anchor="middle" fill="#EF4444" font-size="11" font-weight="700">X</text><text x="194" y="108" text-anchor="middle" fill="var(--ink-primary)" font-size="11">Ignora destellos rojos</text>',
            'En niveles superiores aparecen destellos rojos para entrenar tu foco.'
          ),
        ],
      },
      practice: 'Permite repetir la secuencia con la tecla R y no descuenta escudos.',
      challenge: 'Rondas crecientes de 4 a 9 nodos con alternancia directo/inverso.',
    },
  },

  symbolspeed2d: {
    id: 'symbolspeed2d',
    title: 'VELOCIDAD DE SÍMBOLOS',
    subtitle: 'Búsqueda de símbolos WAIS y fusión de formas',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'neuro',
    supportsInfinite: true,
    axis: 'reflex',
    accent: '#06B6D4',
    accentSoft: 'rgba(6, 182, 212, 0.14)',
    controlsPC: 'Teclas 1–6 para elegir símbolo · 0 / Espacio para Ninguno',
    controlsTouch: 'Toca el símbolo idéntico o el botón Ninguno',
    description:
      'Entrena velocidad de procesamiento visual: compara 2 símbolos geométricos objetivo contra 5 o 6 candidatos o fusiona dos mitades en milisegundos.',
    keywords: ['simbolos', 'wais', 'velocidad', 'procesamiento', 'formas', 'fusion', 'neurolab'],
    guide: {
      objective: 'Identifica en milisegundos qué candidato coincide exactamente con un objetivo o con la fusión de las dos piezas superiores.',
      howToPlay: [
        'En Emparejamiento WAIS: compara los 2 símbolos objetivo de arriba con la fila inferior y elige el idéntico (o pulsa Ninguno si ninguno coincide).',
        'En Fusión de Formas: combina mentalmente las dos capas superiores (exterior + interior) y marca el resultado exacto abajo.',
        'Responde con teclado (1–6 y 0/Espacio) o clic/toque para maximizar tu velocidad en milisegundos.',
      ],
      sectionTutorials: [
        { name: 'Emparejamiento WAIS', tip: 'Escanea primero el rasgo más distintivo (forma externa o muesca) para descartar rápido los distractores.' },
        { name: 'Fusión de Formas', tip: 'Comprueba la silueta exterior y luego verifica la orientación y relleno del núcleo interior.' },
      ],
      controls: [
        { keys: ['1..6', 'Clic'], touch: 'Tocar candidato', action: 'Seleccionar símbolo coincidente', tone: 'primary' },
        { keys: ['0', 'Espacio'], touch: 'Botón Ninguno', action: 'Indicar que no hay coincidencia' },
      ],
      example: {
        frames: [
          makeFrame(
            '#06B6D4',
            '<rect x="92" y="26" width="52" height="44" rx="8" fill="var(--bg-panel)" stroke="#06B6D4" stroke-width="2"/><polygon points="118,34 132,62 104,62" fill="none" stroke="#06B6D4" stroke-width="2.5"/><rect x="176" y="26" width="52" height="44" rx="8" fill="var(--bg-panel)" stroke="#06B6D4" stroke-width="2"/><circle cx="202" cy="48" r="12" fill="none" stroke="#06B6D4" stroke-width="2.5"/><line x1="36" y1="86" x2="284" y2="86" stroke="var(--border-subtle)"/><rect x="52" y="100" width="44" height="44" rx="8" fill="var(--bg-panel)" stroke="var(--border-strong)"/><rect x="108" y="100" width="44" height="44" rx="8" fill="rgba(34,197,94,0.18)" stroke="#22C55E" stroke-width="2"/><polygon points="130,108 144,136 116,136" fill="none" stroke="#22C55E" stroke-width="2.5"/><rect x="164" y="100" width="44" height="44" rx="8" fill="var(--bg-panel)" stroke="var(--border-strong)"/><rect x="220" y="100" width="44" height="44" rx="8" fill="var(--bg-panel)" stroke="var(--border-strong)"/>',
            'Compara los 2 objetivos superiores con la fila inferior.'
          ),
          makeFrame(
            '#06B6D4',
            '<rect x="76" y="30" width="52" height="46" rx="8" fill="var(--bg-panel)" stroke="#06B6D4" stroke-width="2"/><rect x="90" y="42" width="24" height="22" fill="none" stroke="#06B6D4" stroke-width="2.5"/><text x="160" y="58" text-anchor="middle" fill="var(--ink-primary)" font-size="18" font-weight="700">+</text><rect x="192" y="30" width="52" height="46" rx="8" fill="var(--bg-panel)" stroke="#06B6D4" stroke-width="2"/><circle cx="218" cy="53" r="6" fill="#06B6D4"/><text x="160" y="114" text-anchor="middle" fill="#22C55E" font-size="12" font-weight="700">FUSIÓN EXACTA</text><rect x="134" y="122" width="52" height="40" rx="8" fill="rgba(34,197,94,0.16)" stroke="#22C55E" stroke-width="2"/><rect x="148" y="131" width="24" height="22" fill="none" stroke="#22C55E" stroke-width="2"/><circle cx="160" cy="142" r="5" fill="#22C55E"/>',
            'En rondas de Fusión une mentalmente las dos figuras en una sola.'
          ),
        ],
      },
      practice: 'Entrena discriminación visual y fusión sin penalización de vidas.',
      challenge: '60s oficiales o Infinito midiendo velocidad de procesamiento en ms.',
    },
  },

  verbal2d: {
    id: 'verbal2d',
    title: 'FLUIDEZ VERBAL',
    subtitle: 'Clasificación rápida, semántica y cadenas léxicas en español',
    dimension: '2D',
    category: 'academy',
    academyGroup: 'neuro',
    supportsInfinite: true,
    axis: 'logic',
    accent: '#8B5CF6',
    accentSoft: 'rgba(139, 92, 246, 0.14)',
    controlsPC: 'Teclas 1–4 o Flechas Izq/Der (Sí/No) · Clic en tarjetas',
    controlsTouch: 'Toca la opción o desliza / pulsa Sí y No',
    description:
      'Agilidad léxica en español con más de 160 palabras curadas en 3 mecánicas rotativas: clasificación por regla, intruso/sinónimo/antónimo y cadenas de palabras.',
    keywords: ['verbal', 'fluidez', 'palabras', 'sinonimos', 'antonimos', 'lexico', 'espanol', 'neurolab'],
    guide: {
      objective: 'Activa tu acceso léxico respondiendo rápido a reglas fonéticas, relaciones semánticas y cadenas verbales en español.',
      howToPlay: [
        'Clasificación rápida: decide si la palabra cumple la regla (letra inicial, final, categoría semántica o número de sílabas).',
        'Semántica relámpago: elige entre 4 tarjetas el sinónimo, antónimo o intruso de la serie.',
        'Cadena léxica: selecciona la palabra que enlaza con la última letra o sílaba de la palabra anterior.',
      ],
      sectionTutorials: [
        { name: 'Reglas Fonéticas y Silábicas', tip: 'Lee en bloque sin subvocalizar en exceso para ganar 100–200 ms por decisión.' },
        { name: 'Semántica y Cadenas', tip: 'En Intruso identifica primero el rasgo común de 3 palabras; en Cadenas fija tu vista en el final de la palabra guía.' },
      ],
      controls: [
        { keys: ['1..4', 'Clic'], touch: 'Tocar tarjeta', action: 'Elegir palabra correcta', tone: 'primary' },
        { keys: ['Izq / Der', 'S / N'], touch: 'Botones Sí / No', action: 'Clasificar en rondas binarias' },
      ],
      example: {
        frames: [
          makeFrame(
            '#8B5CF6',
            '<rect x="44" y="24" width="232" height="28" rx="6" fill="#8B5CF6"/><text x="160" y="42" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">REGLA: TIENE 3 SÍLABAS</text><text x="160" y="96" text-anchor="middle" fill="var(--ink-primary)" font-size="22" font-weight="700">BRÚJULA</text><rect x="66" y="122" width="84" height="32" rx="6" fill="rgba(34,197,94,0.18)" stroke="#22C55E"/><text x="108" y="142" text-anchor="middle" fill="#22C55E" font-size="12" font-weight="700">SÍ (Izq)</text><rect x="170" y="122" width="84" height="32" rx="6" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="212" y="142" text-anchor="middle" fill="var(--ink-secondary)" font-size="12" font-weight="700">NO (Der)</text>',
            'Clasifica cada palabra según la regla activa en milisegundos.'
          ),
          makeFrame(
            '#8B5CF6',
            '<rect x="44" y="24" width="232" height="28" rx="6" fill="var(--bg-panel)" stroke="#8B5CF6"/><text x="160" y="42" text-anchor="middle" fill="#8B5CF6" font-size="11" font-weight="700">CADENA LÉXICA: LÁMPARA -> ...</text><rect x="44" y="72" width="108" height="36" rx="6" fill="rgba(34,197,94,0.18)" stroke="#22C55E"/><text x="98" y="95" text-anchor="middle" fill="#22C55E" font-size="12" font-weight="700">1 · RADAR</text><rect x="168" y="72" width="108" height="36" rx="6" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="222" y="95" text-anchor="middle" fill="var(--ink-primary)" font-size="12">2 · BOSQUE</text><rect x="44" y="118" width="108" height="36" rx="6" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="98" y="141" text-anchor="middle" fill="var(--ink-primary)" font-size="12">3 · NUBE</text><rect x="168" y="118" width="108" height="36" rx="6" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="222" y="141" text-anchor="middle" fill="var(--ink-primary)" font-size="12">4 · TORRE</text>',
            'Alterna entre clasificación, sinónimos/intrusos y cadenas léxicas.'
          ),
        ],
      },
      practice: 'Explica el criterio al responder sin descontar escudos.',
      challenge: '65s oficiales o Infinito midiendo fluidez verbal y velocidad en ms.',
    },
  },

  // ==================== 5 JUEGOS DE ACCIÓN 3D ====================
  aim3d: {
    id: 'aim3d',
    title: 'PUNTERÍA TÁCTICA 3D',
    subtitle: 'Disparo en Primera Persona 3D',
    dimension: '3D',
    category: 'action3d',
    supportsInfinite: true,
    axis: 'aim',
    accent: '#E11D48',
    accentSoft: 'rgba(225, 29, 72, 0.14)',
    controlsPC: 'Clic para fijar mira + Ratón para apuntar y disparar',
    controlsTouch: 'Arrastra para mirar · Toca para disparar',
    description:
      'Cámara 3D en primera persona con drones móviles y orbes de reacción rápida. Entrena giros, seguimiento y precisión.',
    keywords: ['punteria', 'fps', 'aim', '3d', 'disparo'],
    guide: {
      objective: 'Destruye los orbes rojos y drones móviles en 3D con máxima precisión antes de que desaparezcan.',
      howToPlay: [
        'Haz clic en el visor para fijar el ratón (ese primer clic no dispara).',
        'Alinea la mira central sobre los objetivos y dispara con el clic izquierdo.',
        'Encadena aciertos seguidos para subir el multiplicador de combo.',
      ],
      controls: [
        { keys: ['Clic'], touch: 'Tocar visor', action: 'Fijar mira / Disparar', tone: 'primary' },
        { keys: ['Ratón'], touch: 'Arrastrar', action: 'Apuntar cámara 3D' },
      ],
      example: {
        frames: [
          makeFrame(
            '#E11D48',
            '<circle cx="160" cy="90" r="34" fill="none" stroke="#E11D48" stroke-width="2" stroke-dasharray="6 4"/><circle cx="160" cy="90" r="10" fill="#E11D48"/><line x1="140" y1="90" x2="180" y2="90" stroke="var(--ink-primary)" stroke-width="1.5"/><line x1="160" y1="70" x2="160" y2="110" stroke="var(--ink-primary)" stroke-width="1.5"/>',
            'Centra la retícula sobre el orbe y dispara para mantener tu racha.'
          ),
          makeFrame(
            '#E11D48',
            '<rect x="36" y="42" width="248" height="96" rx="8" fill="var(--bg-panel)" stroke="#E11D48" stroke-width="2"/><text x="160" y="82" text-anchor="middle" fill="var(--ink-primary)" font-size="13" font-weight="700">EL PRIMER CLIC FIJA LA MIRA</text><text x="160" y="106" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">No cuenta como disparo fallido.</text>',
            'Asegura primero el bloqueo de puntero sin perder precisión.'
          ),
        ],
      },
      practice: 'Entrena giros y seguimiento 3D sin perder escudos.',
      challenge: 'Puntuación oficial para tu eje de Puntería.',
    },
  },

  runner3d: {
    id: 'runner3d',
    title: 'TÚNEL HIPER 3D',
    subtitle: 'Corredor Espacial de Agilidad',
    dimension: '3D',
    category: 'action3d',
    supportsInfinite: true,
    axis: 'agility',
    accent: '#6D28D9',
    accentSoft: 'rgba(109, 40, 217, 0.15)',
    controlsPC: 'A / D o Flechas para carril · Espacio / W para saltar',
    controlsTouch: 'Desliza Izq/Der/Arriba o usa botones',
    description:
      'Atraviesa un túnel 3D a toda velocidad esquivando barreras láser, saltando muros y recogiendo núcleos.',
    keywords: ['runner', 'tunel', '3d', 'esquivar', 'agilidad'],
    guide: {
      objective: 'Cambia entre 3 carriles y salta obstáculos a gran velocidad recogiendo núcleos de energía.',
      howToPlay: [
        'Muévete a izquierda o derecha entre los carriles para evitar barreras altas.',
        'Salta sobre los muros bajos con Espacio o W.',
        'Recoge núcleos brillantes para sumar puntos y combo.',
      ],
      controls: [
        { keys: ['A', 'D'], touch: 'Desliza Izq / Der', action: 'Cambiar de carril', tone: 'primary' },
        { keys: ['Espacio', 'W'], touch: 'Desliza Arriba', action: 'Saltar obstáculo' },
      ],
      example: {
        frames: [
          makeFrame(
            '#6D28D9',
            '<line x1="115" y1="30" x2="60" y2="155" stroke="var(--border-strong)" stroke-width="2"/><line x1="205" y1="30" x2="260" y2="155" stroke="var(--border-strong)" stroke-width="2"/><rect x="135" y="114" width="50" height="24" rx="4" fill="#6D28D9"/><circle cx="220" cy="126" r="10" fill="#00E5FF"/>',
            'Cambia al carril libre o salta las barreras bajas.'
          ),
          makeFrame(
            '#6D28D9',
            '<rect x="70" y="96" width="180" height="18" rx="4" fill="#EF4444"/><path d="M160 132c0-38 0-58 0-68" stroke="#22C55E" stroke-width="3" stroke-dasharray="4 3"/><circle cx="160" cy="58" r="11" fill="#6D28D9"/>',
            'Salta sobre los muros láser horizontales para conservar tus escudos.'
          ),
        ],
      },
      practice: 'Practica cambios de carril y saltos sin perder escudos.',
      challenge: 'Velocidad progresiva con registro oficial en Agilidad 3D.',
    },
  },

  cube3d: {
    id: 'cube3d',
    title: 'ROMPEÓRBITA 3D',
    subtitle: 'Deflector de Bloques 3D',
    dimension: '3D',
    category: 'action3d',
    supportsInfinite: true,
    axis: 'reflex',
    accent: '#0284C7',
    accentSoft: 'rgba(2, 132, 199, 0.15)',
    controlsPC: 'Ratón o A / D (Flechas) para mover deflector',
    controlsTouch: 'Arrastra lateralmente para mover el escudo',
    description:
      'Rompe matrices de bloques 3D en profundidad con un escudo deflector curvo y cápsulas de energía.',
    keywords: ['arkanoid', 'breakout', '3d', 'bloques', 'reflejos'],
    guide: {
      objective: 'Rebota la esfera energética en profundidad 3D para destruir todos los bloques sin dejarla caer.',
      howToPlay: [
        'Desliza el deflector curvo de lado a lado con ratón o teclado.',
        'Golpear con los bordes del deflector da mayor ángulo a la esfera.',
        'Recoge cápsulas de energía para ganar puntos extra y regenerar escudo.',
      ],
      controls: [
        { keys: ['Ratón', 'A / D'], touch: 'Arrastrar lateral', action: 'Mover deflector', tone: 'primary' },
      ],
      example: {
        frames: [
          makeFrame(
            '#0284C7',
            '<rect x="70" y="34" width="40" height="18" rx="3" fill="#0284C7"/><rect x="120" y="34" width="40" height="18" rx="3" fill="#00E5FF"/><rect x="170" y="34" width="40" height="18" rx="3" fill="#0284C7"/><rect x="220" y="34" width="40" height="18" rx="3" fill="#00E5FF"/><circle cx="160" cy="96" r="8" fill="var(--ink-primary)"/><rect x="115" y="138" width="90" height="12" rx="6" fill="#0284C7"/>',
            'Intercepta la esfera en la parte inferior para rebotarla al fondo.'
          ),
          makeFrame(
            '#0284C7',
            '<rect x="115" y="134" width="90" height="14" rx="7" fill="#0284C7"/><path d="M160 132L210 56" stroke="#22C55E" stroke-width="2.5"/><path d="M160 132L115 56" stroke="#00E5FF" stroke-width="2.5"/>',
            'Usa el punto de impacto en la paleta para dirigir el rebote.'
          ),
        ],
      },
      practice: 'Domina los ángulos de rebote sin perder escudos.',
      challenge: 'Supera oleadas cada vez más rápidas para tu eje de Reflejos.',
    },
  },

  parkour3d: {
    id: 'parkour3d',
    title: 'SALTO CELESTE 3D',
    subtitle: 'Plataformas y Doble Salto 3D',
    dimension: '3D',
    category: 'action3d',
    supportsInfinite: true,
    axis: 'agility',
    accent: '#15803D',
    accentSoft: 'rgba(21, 128, 61, 0.14)',
    controlsPC: 'WASD mover · Espacio saltar (x2 Doble Salto)',
    controlsTouch: 'Control táctil + Botón Doble Salto',
    description:
      'Salta por islas flotantes 3D, plataformas móviles, bloques frágiles y propulsores recogiendo gemas en el vacío.',
    keywords: ['parkour', 'plataformas', 'salto', '3d'],
    guide: {
      objective: 'Avanza por islas flotantes encadenando saltos y dobles saltos sin caer al vacío.',
      howToPlay: [
        'Impúlsate con WASD o la palanca táctil hacia la siguiente plataforma.',
        'Pulsa Espacio (o el botón Saltar) una segunda vez en el aire para Doble Salto.',
        'Cuidado con las plataformas frágiles que caen tras pisarlas.',
      ],
      controls: [
        { keys: ['W', 'A', 'S', 'D'], touch: 'Palanca táctil', action: 'Mover en 3D', tone: 'primary' },
        { keys: ['Espacio'], touch: 'Botón Saltar', action: 'Salto / Doble Salto' },
      ],
      example: {
        frames: [
          makeFrame(
            '#15803D',
            '<rect x="44" y="114" width="64" height="18" rx="4" fill="#15803D"/><rect x="196" y="88" width="64" height="18" rx="4" fill="#15803D"/><path d="M76 112Q136 32 228 84" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-dasharray="5 4"/><polygon points="228,62 236,72 228,82 220,72" fill="#00E5FF"/>',
            'Calcula la distancia y usa el doble salto en el aire para alcanzar gemas.'
          ),
          makeFrame(
            '#15803D',
            '<rect x="108" y="102" width="104" height="22" rx="4" fill="rgba(245,158,11,0.28)" stroke="#F59E0B" stroke-width="2" stroke-dasharray="4 3"/><text x="160" y="72" text-anchor="middle" fill="#F59E0B" font-size="12" font-weight="700">PLATAFORMA FRÁGIL</text><text x="160" y="144" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">Salta rápido antes de que se hunda</text>',
            'No te detengas demasiado tiempo sobre bloques frágiles.'
          ),
        ],
      },
      practice: 'Explora distancias de salto sin perder escudos al caer.',
      challenge: 'Recorrido continuo con multiplicador por gemas y plataformas.',
    },
  },

  flight3d: {
    id: 'flight3d',
    title: 'VUELO DE PORTALES 3D',
    subtitle: 'Navegación Espacial 3D',
    dimension: '3D',
    category: 'action3d',
    supportsInfinite: true,
    axis: 'agility',
    accent: '#06B6D4',
    accentSoft: 'rgba(6, 182, 212, 0.15)',
    controlsPC: 'WASD / Flechas o Ratón para pilotar',
    controlsTouch: 'Arrastra en pantalla para dirigir la nave',
    description:
      'Pilota una nave a través de anillos energéticos en profundidad 3D mientras esquivas meteoros veloces.',
    keywords: ['vuelo', 'nave', 'portales', '3d'],
    guide: {
      objective: 'Atraviesa el centro de los portales energéticos mientras esquivas asteroides en vuelo 3D.',
      howToPlay: [
        'Dirige la nave suavemente con teclado, ratón o arrastrando el dedo.',
        'Pasar por el centro de un anillo otorga bonificación perfecta.',
        'Evita los meteoros sólidos que cruzan la ruta.',
      ],
      controls: [
        { keys: ['WASD', 'Ratón'], touch: 'Arrastrar', action: 'Pilotar nave en 3D', tone: 'primary' },
      ],
      example: {
        frames: [
          makeFrame(
            '#06B6D4',
            '<ellipse cx="160" cy="90" rx="52" ry="44" fill="none" stroke="#06B6D4" stroke-width="3.5"/><ellipse cx="160" cy="90" rx="22" ry="18" fill="none" stroke="#22C55E" stroke-width="2" stroke-dasharray="4 3"/><polygon points="160,82 172,98 160,94 148,98" fill="var(--ink-primary)"/>',
            'Alinea la nave con el anillo cian para cruzar el portal.'
          ),
          makeFrame(
            '#06B6D4',
            '<circle cx="96" cy="78" r="18" fill="#EF4444" opacity="0.8"/><ellipse cx="212" cy="94" rx="34" ry="30" fill="none" stroke="#06B6D4" stroke-width="3"/><text x="160" y="152" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">Evita asteroides rojos y encadena portales</text>',
            'Anticipa el trayecto entre portales consecutivos.'
          ),
        ],
      },
      practice: 'Practica el vuelo y alineación de anillos sin perder escudos.',
      challenge: 'Aumenta la velocidad y califica tu eje de Agilidad 3D.',
    },
  },

  // ==================== 13 JUEGOS DE DESTREZA 2D ====================
  rhythm2d: {
    id: 'rhythm2d',
    title: 'RITMO SOBRECARGA',
    subtitle: '4 Carriles · Sintetizador en Vivo',
    dimension: '2D',
    category: 'dexterity2d',
    supportsInfinite: true,
    axis: 'rhythm',
    accent: '#0891B2',
    accentSoft: 'rgba(8, 145, 178, 0.15)',
    controlsPC: 'Teclas D · F · J · K (o Flechas)',
    controlsTouch: 'Toca directamente cada uno de los 4 carriles',
    description:
      'Notas sincronizadas al milisegundo con música electrónica generada en vivo. Clava PERFECTOS para multiplicar puntos.',
    keywords: ['ritmo', 'musica', 'carriles', 'teclas'],
    guide: {
      objective: 'Pulsa cada carril justo cuando la nota cruce la línea luminosa inferior.',
      howToPlay: [
        'Observa caer las notas en los 4 carriles al compás de la música.',
        'Pulsa D, F, J, K (o toca el carril en móvil) en el instante exacto del cruce.',
        'Los golpes PERFECTOS multiplican tu puntuación y combo.',
      ],
      controls: [
        { keys: ['D', 'F', 'J', 'K'], touch: 'Toca los 4 carriles', action: 'Golpear nota en carril', tone: 'primary' },
      ],
      example: {
        frames: [
          makeFrame(
            '#0891B2',
            '<g stroke="var(--border-strong)"><line x1="76" y1="22" x2="76" y2="152"/><line x1="132" y1="22" x2="132" y2="152"/><line x1="188" y1="22" x2="188" y2="152"/><line x1="244" y1="22" x2="244" y2="152"/></g><line x1="56" y1="128" x2="264" y2="128" stroke="#0891B2" stroke-width="3"/><rect x="142" y="114" width="36" height="16" rx="4" fill="#00E5FF"/><text x="104" y="148" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">D</text><text x="160" y="148" text-anchor="middle" fill="var(--ink-primary)" font-size="11" font-weight="700">F</text><text x="216" y="148" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">J</text>',
            'Pulsa la tecla correspondiente cuando la barra llegue a la línea.'
          ),
          makeFrame(
            '#0891B2',
            '<rect x="44" y="42" width="232" height="96" rx="8" fill="var(--bg-panel)" stroke="#22C55E" stroke-width="2"/><text x="160" y="84" text-anchor="middle" fill="#22C55E" font-size="16" font-weight="700">PERFECTO +300</text><text x="160" y="112" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">Precisión al milisegundo = mayor combo</text>',
            'Escucha el pulso de batería para mantener el tempo.'
          ),
        ],
      },
      practice: 'Sigue el compás y entrena lectura de 4 carriles sin perder escudos.',
      challenge: 'Tempo dinámico y precisión registrada en tu eje de Ritmo.',
    },
  },

  pulse2d: {
    id: 'pulse2d',
    title: 'ANILLO SÓNICO',
    subtitle: 'Sincronización Orbital y Pulso 2D',
    dimension: '2D',
    category: 'dexterity2d',
    supportsInfinite: true,
    axis: 'rhythm',
    accent: '#14B8A6',
    accentSoft: 'rgba(20, 184, 166, 0.15)',
    controlsPC: 'Espacio / Clic / J / K cuando la aguja cruce el arco',
    controlsTouch: 'Toca la pantalla exactamente dentro del arco brillante',
    description:
      'Golpea arcos giratorios cada vez más estrechos al compás de la percusión electrónica y los cambios de giro.',
    keywords: ['anillo', 'pulso', 'ritmo', 'timing'],
    guide: {
      objective: 'Golpea justo cuando la aguja orbital atraviese el arco brillante del anillo.',
      howToPlay: [
        'Sigue con la vista la aguja que gira alrededor del anillo.',
        'Pulsa Espacio, clic (o toca la pantalla) cuando pase sobre la zona iluminada.',
        'Tras varios aciertos la aguja puede invertir el sentido de giro.',
      ],
      controls: [
        { keys: ['Espacio', 'Clic', 'J', 'K'], touch: 'Toca la pantalla', action: 'Golpear dentro del arco', tone: 'primary' },
      ],
      example: {
        frames: [
          makeFrame(
            '#14B8A6',
            '<circle cx="160" cy="90" r="52" fill="none" stroke="var(--border-strong)" stroke-width="8"/><path d="M160 38A52 52 0 0 1 210 78" fill="none" stroke="#14B8A6" stroke-width="10" stroke-linecap="round"/><line x1="160" y1="90" x2="196" y2="52" stroke="var(--ink-primary)" stroke-width="3"/><circle cx="160" cy="90" r="5" fill="#14B8A6"/>',
            'Pulsa exactamente cuando la aguja cruce el segmento iluminado.'
          ),
          makeFrame(
            '#14B8A6',
            '<circle cx="160" cy="90" r="46" fill="none" stroke="#14B8A6" stroke-width="4" stroke-dasharray="6 4"/><text x="160" y="94" text-anchor="middle" fill="var(--ink-primary)" font-size="12" font-weight="700">CAMBIO DE GIRO</text><text x="160" y="156" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">El arco se estrecha al subir tu combo</text>',
            'Prepárate para cambios de dirección en rachas altas.'
          ),
        ],
      },
      practice: 'Practica el timing orbital sin penalización en escudos.',
      challenge: 'Arcos más estrechos y puntuación oficial en Ritmo.',
    },
  },

  parry2d: {
    id: 'parry2d',
    title: 'DUELO DE REFLEJO',
    subtitle: 'Bloqueo de Precisión y Fintas',
    dimension: '2D',
    category: 'dexterity2d',
    supportsInfinite: true,
    axis: 'reflex',
    accent: '#D97706',
    accentSoft: 'rgba(217, 119, 6, 0.15)',
    controlsPC: 'A / Izq · W / Espacio (Centro) · D / Der',
    controlsTouch: 'Toca la zona Izquierda, Centro o Derecha al destello',
    description:
      'Bloquea justo en el destello blanco para contraatacar y evita caer en fintas naranjas. Reacción pura en ms.',
    keywords: ['parry', 'bloqueo', 'reflejos', 'fintas'],
    guide: {
      objective: 'Bloquea en el carril correcto justo en el destello blanco e ignora las fintas naranjas.',
      howToPlay: [
        'Observa el aviso en el carril Izquierdo, Centro o Derecho.',
        'Bloquea únicamente cuando aparezca el destello blanco de impacto.',
        'Si el destello se vuelve naranja es una finta: no pulses nada.',
      ],
      controls: [
        { keys: ['A', 'Flecha Izq'], touch: 'Zona Izquierda', action: 'Bloquear izquierda', tone: 'primary' },
        { keys: ['W', 'Espacio'], touch: 'Zona Centro', action: 'Bloquear centro', tone: 'primary' },
        { keys: ['D', 'Flecha Der'], touch: 'Zona Derecha', action: 'Bloquear derecha', tone: 'primary' },
      ],
      example: {
        frames: [
          makeFrame(
            '#D97706',
            '<rect x="44" y="42" width="68" height="96" rx="8" fill="var(--bg-panel)" stroke="var(--border-strong)"/><rect x="126" y="42" width="68" height="96" rx="8" fill="rgba(255,255,255,0.22)" stroke="#FFFFFF" stroke-width="2.5"/><rect x="208" y="42" width="68" height="96" rx="8" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="160" y="95" text-anchor="middle" fill="#FFFFFF" font-size="12" font-weight="700">DESTELLO</text>',
            'Destello blanco = bloquea ese carril de inmediato.'
          ),
          makeFrame(
            '#D97706',
            '<rect x="126" y="42" width="68" height="96" rx="8" fill="rgba(245,158,11,0.18)" stroke="#F59E0B" stroke-width="2" stroke-dasharray="4 3"/><text x="160" y="94" text-anchor="middle" fill="#F59E0B" font-size="12" font-weight="700">FINTA</text><text x="160" y="156" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">Si es naranja, mantén la calma y no pulses</text>',
            'Evitar fintas suma puntos y protege tu racha.'
          ),
        ],
      },
      practice: 'Entrena lectura de destellos y fintas sin perder escudos.',
      challenge: 'Mide tu tiempo de reacción en ms para tu eje de Reflejos.',
    },
  },

  bullet2d: {
    id: 'bullet2d',
    title: 'LLUVIA Y ROCE',
    subtitle: 'Esquiva Extrema 2D',
    dimension: '2D',
    category: 'dexterity2d',
    supportsInfinite: true,
    axis: 'reflex',
    accent: '#65A30D',
    accentSoft: 'rgba(101, 163, 13, 0.14)',
    controlsPC: 'WASD / Flechas · Shift para modo precisión lenta',
    controlsTouch: 'Palanca táctil en pantalla',
    description:
      'Sobrevive a espirales, rayos anunciados y ráfagas radiales. Rozar proyectiles sin recibir golpe suma puntos extra.',
    keywords: ['bullet', 'esquiva', 'roce', 'reflejos'],
    guide: {
      objective: 'Esquiva espirales de proyectiles y rayos anunciados pasando cerca sin tocar el núcleo.',
      howToPlay: [
        'Mueve tu nave con WASD / Flechas o la palanca táctil.',
        'Mantén Shift en PC para moverte con precisión milimétrica entre balas.',
        'Rozar proyectiles con tu halo exterior suma puntos extra.',
      ],
      controls: [
        { keys: ['WASD', 'Flechas'], touch: 'Palanca táctil', action: 'Esquivar proyectiles', tone: 'primary' },
        { keys: ['Shift'], touch: 'Toque corto', action: 'Movimiento lento de precisión' },
      ],
      example: {
        frames: [
          makeFrame(
            '#65A30D',
            '<circle cx="160" cy="90" r="24" fill="none" stroke="#65A30D" stroke-width="1.5" stroke-dasharray="3 3"/><circle cx="160" cy="90" r="6" fill="#00E5FF"/><circle cx="136" cy="82" r="5" fill="#EF4444"/><circle cx="186" cy="98" r="5" fill="#EF4444"/><text x="160" y="148" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">Tu hitbox real es solo el núcleo central</text>',
            'Rozar balas con el halo suma puntos sin hacerte daño.'
          ),
          makeFrame(
            '#65A30D',
            '<line x1="36" y1="68" x2="284" y2="68" stroke="#F59E0B" stroke-width="2" stroke-dasharray="6 4"/><text x="160" y="54" text-anchor="middle" fill="#F59E0B" font-size="11" font-weight="700">RAYO ANUNCIADO</text><circle cx="160" cy="116" r="8" fill="#00E5FF"/>',
            'Sal de las líneas de aviso antes de que se active el rayo.'
          ),
        ],
      },
      practice: 'Practica micro-esquiva y rozamientos sin perder escudos.',
      challenge: 'Resiste patrones intensos y suma puntos en Reflejos.',
    },
  },

  puzzle2d: {
    id: 'puzzle2d',
    title: 'MATRIZ MENTAL',
    subtitle: 'Memoria, Stroop y Cálculo Ágil',
    dimension: '2D',
    category: 'dexterity2d',
    supportsInfinite: true,
    axis: 'logic',
    accent: '#B45309',
    accentSoft: 'rgba(180, 83, 9, 0.15)',
    controlsPC: 'Ratón o teclas 1–4 para respuestas rápidas',
    controlsTouch: 'Toca fichas y respuestas',
    description:
      'Alterna contrarreloj entre memoria numérica (Chimp), reto de color y palabra (Stroop), secuencia Simon y cálculo mental.',
    keywords: ['matriz', 'stroop', 'simon', 'chimp', 'calculo'],
    guide: {
      objective: 'Resuelve micro-retos cambiantes de memoria, secuencia, color-palabra y cálculo rápido.',
      howToPlay: [
        'Lee el enunciado superior antes de pulsar: alterna entre Stroop, Simon, Chimp y Cálculo.',
        'En Chimp memoriza la posición de todos los números antes de pulsar el 1.',
        'Responde con clic/toque o con las teclas 1–4 en retos de opción múltiple.',
      ],
      sectionTutorials: [
        { name: 'Modo Stroop y Cálculo', tip: 'En Stroop responde al color de la tinta (no a la palabra); en cálculo estima primero las unidades.' },
        { name: 'Modo Chimp y Simon', tip: 'Memoriza el recorrido visual completo antes de pulsar el número 1 porque el resto se ocultará.' },
      ],
      controls: [
        { keys: ['Clic', '1..4'], touch: 'Toca ficha / opción', action: 'Responder micro-reto', tone: 'primary' },
      ],
      example: {
        frames: [
          makeFrame(
            '#B45309',
            '<rect x="64" y="34" width="192" height="50" rx="8" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="160" y="65" text-anchor="middle" fill="#EF4444" font-size="18" font-weight="700">AZUL</text><text x="160" y="118" text-anchor="middle" fill="var(--ink-primary)" font-size="12">Pulsa el COLOR de la tinta (Rojo)</text>',
            'En Stroop elige el color de la tinta, no lo que dice la palabra.'
          ),
          makeFrame(
            '#B45309',
            '<rect x="78" y="34" width="44" height="44" rx="6" fill="#B45309"/><text x="100" y="62" text-anchor="middle" fill="#fff" font-size="16" font-weight="700">1</text><rect x="198" y="34" width="44" height="44" rx="6" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="220" y="62" text-anchor="middle" fill="var(--ink-primary)" font-size="16" font-weight="700">2</text><rect x="138" y="92" width="44" height="44" rx="6" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="160" y="120" text-anchor="middle" fill="var(--ink-primary)" font-size="16" font-weight="700">3</text>',
            'En Chimp memoriza las casillas antes de pulsar el 1.'
          ),
        ],
      },
      practice: 'Practica los 4 micro-retos cognitivos sin perder escudos.',
      challenge: 'Velocidad mental y agilidad cognitiva para tu eje de Lógica.',
    },
  },

  schulte2d: {
    id: 'schulte2d',
    title: 'TABLA SCHULTE PRO',
    subtitle: 'Lectura Periférica y Enfoque 2D',
    dimension: '2D',
    category: 'dexterity2d',
    supportsInfinite: true,
    axis: 'logic',
    accent: '#0EA5E9',
    accentSoft: 'rgba(14, 165, 233, 0.15)',
    controlsPC: 'Clic secuencial 1 a N fijando la vista en el centro',
    controlsTouch: 'Toca los números en orden ascendente',
    description:
      'Expande tu campo visual y velocidad mental buscando secuencias numéricas de 4×4 y 5×5 sin perder precisión.',
    keywords: ['schulte', 'periferica', 'enfoque', 'numeros'],
    guide: {
      objective: 'Encuentra y pulsa todos los números en orden ascendente (1, 2, 3...) mirando al centro.',
      howToPlay: [
        'Fija la vista en la casilla central y localiza el siguiente número con visión periférica.',
        'Pulsa en orden estricto desde el 1 hasta completar la tabla.',
        'Evita clics erróneos para mantener intacto el combo de velocidad.',
      ],
      controls: [
        { keys: ['Clic'], touch: 'Toca número', action: 'Avanzar secuencia 1, 2, 3...', tone: 'primary' },
      ],
      example: {
        frames: [
          makeFrame(
            '#0EA5E9',
            '<g transform="translate(94,24)" fill="var(--bg-panel)" stroke="var(--border-strong)"><rect x="0" y="0" width="42" height="42"/><rect x="45" y="0" width="42" height="42"/><rect x="90" y="0" width="42" height="42"/><rect x="0" y="45" width="42" height="42"/><rect x="45" y="45" width="42" height="42" stroke="#0EA5E9" stroke-width="2"/><rect x="90" y="45" width="42" height="42"/><rect x="0" y="90" width="42" height="42"/><rect x="45" y="90" width="42" height="42"/><rect x="90" y="90" width="42" height="42"/></g><text x="115" y="51" text-anchor="middle" fill="var(--ink-secondary)" font-size="14">7</text><text x="160" y="51" text-anchor="middle" fill="#22C55E" font-size="14" font-weight="700">1</text><text x="205" y="51" text-anchor="middle" fill="var(--ink-secondary)" font-size="14">4</text><text x="160" y="96" text-anchor="middle" fill="#0EA5E9" font-size="14" font-weight="700">2</text>',
            'Pulsa los números en orden ascendente sin perder el enfoque.'
          ),
        ],
      },
      practice: 'Entrena lectura periférica en tablas 4×4 y 5×5 sin penalización.',
      challenge: 'Cronómetro de precisión que evalúa tu eje de Lógica.',
    },
  },

  nback2d: {
    id: 'nback2d',
    title: 'N-BACK CUÁNTICO',
    subtitle: 'Memoria de Trabajo Dual N-Back',
    dimension: '2D',
    category: 'dexterity2d',
    supportsInfinite: true,
    axis: 'logic',
    accent: '#7C3AED',
    accentSoft: 'rgba(124, 58, 237, 0.15)',
    controlsPC: 'A (Posición) · L (Sonido) · Espacio (No coincide)',
    controlsTouch: 'Botones Posición, Sonido o No coincide',
    description:
      'El estándar científico para inteligencia fluida: compara posición y tono musical simultáneamente de 1-Back a 3-Back.',
    keywords: ['nback', 'memoria', 'trabajo', 'cognitivo'],
    guide: {
      objective: 'Indica antes de que acabe la barra si la posición o el tono coinciden con los de hace N pasos.',
      howToPlay: [
        'Cada paso ilumina una celda en la cuadrícula 3×3 y reproduce una nota.',
        'Pulsa Posición (A) o Sonido (L) si coinciden con el estímulo de N pasos atrás.',
        'Si ninguno coincide, pulsa No coincide (Espacio) para confirmar rechazo correcto.',
      ],
      controls: [
        { keys: ['A', 'Izq'], touch: 'Botón Posición', action: 'Misma celda N pasos atrás', tone: 'primary' },
        { keys: ['L', 'Der'], touch: 'Botón Sonido', action: 'Mismo tono N pasos atrás', tone: 'primary' },
        { keys: ['Espacio'], touch: 'No coincide', action: 'Confirmar sin coincidencia' },
      ],
      example: {
        frames: [
          makeFrame(
            '#7C3AED',
            '<g transform="translate(106,24)" fill="var(--bg-panel)" stroke="var(--border-strong)"><rect x="0" y="0" width="34" height="34"/><rect x="37" y="0" width="34" height="34" fill="#7C3AED"/><rect x="74" y="0" width="34" height="34"/><rect x="0" y="37" width="34" height="34"/><rect x="37" y="37" width="34" height="34"/><rect x="74" y="37" width="34" height="34"/><rect x="0" y="74" width="34" height="34"/><rect x="37" y="74" width="34" height="34"/><rect x="74" y="74" width="34" height="34"/></g><rect x="70" y="146" width="180" height="8" rx="4" fill="#7C3AED"/>',
            'La barra inferior indica el tiempo restante para responder en el paso actual.'
          ),
          makeFrame(
            '#7C3AED',
            '<rect x="34" y="42" width="76" height="44" rx="8" fill="var(--bg-panel)" stroke="#7C3AED" stroke-width="2"/><text x="72" y="69" text-anchor="middle" fill="var(--ink-primary)" font-size="11" font-weight="700">POSICIÓN (A)</text><rect x="122" y="42" width="76" height="44" rx="8" fill="var(--bg-panel)" stroke="var(--border-strong)"/><text x="160" y="69" text-anchor="middle" fill="var(--ink-primary)" font-size="11">NO COINCIDE</text><rect x="210" y="42" width="76" height="44" rx="8" fill="var(--bg-panel)" stroke="#0EA5E9" stroke-width="2"/><text x="248" y="69" text-anchor="middle" fill="var(--ink-primary)" font-size="11" font-weight="700">SONIDO (L)</text><text x="160" y="126" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">Si no coincide nada, confirma con Espacio</text>',
            'Puedes marcar Posición, Sonido, ambos o No coincide.'
          ),
        ],
      },
      practice: 'Entrena memoria de trabajo Dual N-Back sin perder escudos.',
      challenge: 'Escala de 1-Back a 3-Back y calibra tu eje de Lógica.',
    },
  },

  tetris2d: {
    id: 'tetris2d',
    title: 'BLOQUES RELÁMPAGO',
    subtitle: 'Rompecabezas de Piezas',
    dimension: '2D',
    category: 'dexterity2d',
    supportsInfinite: true,
    axis: 'logic',
    accent: '#4F46E5',
    accentSoft: 'rgba(79, 70, 229, 0.15)',
    controlsPC: 'A/D mover · W rotar · S bajar · Espacio Caída · C Reserva',
    controlsTouch: 'Botones Izquierda, Rotar, Derecha, Bajar, Caída y Reserva',
    description:
      'Encaja piezas a toda velocidad con guía fantasma, reserva y limpieza múltiple de líneas bajo gravedad dinámica.',
    keywords: ['tetris', 'bloques', 'lineas', 'piezas'],
    guide: {
      objective: 'Encaja tetrominós formando filas completas para limpiar líneas antes de que la torre llegue arriba.',
      howToPlay: [
        'Mueve y rota las piezas guiándote por la sombra fantasma en el fondo.',
        'Usa Reserva (C) para guardar una pieza útil para después.',
        'Limpia varias líneas a la vez para multiplicar la puntuación.',
      ],
      controls: [
        { keys: ['A', 'D'], touch: 'Izquierda / Derecha', action: 'Mover pieza', tone: 'primary' },
        { keys: ['W', 'Arr'], touch: 'Rotar', action: 'Girar pieza' },
        { keys: ['S', 'Abajo'], touch: 'Bajar', action: 'Caída suave' },
        { keys: ['Espacio'], touch: 'Caída', action: 'Fijar al instante' },
        { keys: ['C'], touch: 'Reserva', action: 'Intercambiar pieza guardada' },
      ],
      example: {
        frames: [
          makeFrame(
            '#4F46E5',
            '<rect x="106" y="22" width="108" height="136" rx="4" fill="var(--bg-panel)" stroke="var(--border-strong)"/><rect x="142" y="42" width="36" height="18" fill="#4F46E5"/><rect x="142" y="132" width="36" height="18" fill="none" stroke="#4F46E5" stroke-dasharray="3 2"/><rect x="108" y="132" width="34" height="18" fill="#00E5FF"/><rect x="178" y="132" width="34" height="18" fill="#00E5FF"/>',
            'Alinea la pieza con su silueta fantasma para completar la línea.'
          ),
        ],
      },
      practice: 'Practica rotaciones y reserva sin riesgo de terminar la partida.',
      challenge: 'Gravedad dinámica creciente evaluada en tu eje de Lógica.',
    },
  },

  twinstick2d: {
    id: 'twinstick2d',
    title: 'ARENA DOBLE MANDO',
    subtitle: 'Combate Cenital 2D + Impulso',
    dimension: '2D',
    category: 'dexterity2d',
    supportsInfinite: true,
    axis: 'aim',
    accent: '#EA580C',
    accentSoft: 'rgba(234, 88, 12, 0.15)',
    controlsPC: 'WASD mover · Ratón apuntar/disparar · Espacio Impulso',
    controlsTouch: 'Palanca izq. mover · Auto-apuntado + botón Impulso',
    description:
      'Combate táctico contra oleadas de enemigos que persiguen, cargan y se dividen. Usa el impulso con invulnerabilidad.',
    keywords: ['twinstick', 'arena', 'disparo', 'impulso'],
    guide: {
      objective: 'Elimina oleadas de enemigos desde vista cenital usando movimiento continuo e impulso evasivo.',
      howToPlay: [
        'Desplázate por la arena sin dejarte acorralar en las esquinas.',
        'Apunta con el ratón (auto-apuntado en móvil) mientras disparas.',
        'Usa Espacio (Impulso) para atravesar ataques con breve invulnerabilidad.',
      ],
      controls: [
        { keys: ['WASD'], touch: 'Palanca izquierda', action: 'Mover nave', tone: 'primary' },
        { keys: ['Ratón', 'Clic'], touch: 'Auto-apuntado', action: 'Apuntar y disparar' },
        { keys: ['Espacio'], touch: 'Botón Impulso', action: 'Dash evasivo' },
      ],
      example: {
        frames: [
          makeFrame(
            '#EA580C',
            '<circle cx="120" cy="94" r="12" fill="#00E5FF"/><line x1="132" y1="94" x2="210" y2="74" stroke="#EA580C" stroke-width="2" stroke-dasharray="5 3"/><polygon points="222,70 236,84 214,88" fill="#EF4444"/><path d="M84 104l22-6" stroke="#22C55E" stroke-width="2"/>',
            'Dispara en movimiento y usa el impulso para esquivar cargas.'
          ),
        ],
      },
      practice: 'Domina el kiteo y el dash sin perder escudos.',
      challenge: 'Oleadas progresivas registradas en tu eje de Puntería.',
    },
  },

  track2d: {
    id: 'track2d',
    title: 'RASTREO QUIRÚRGICO',
    subtitle: 'Seguimiento Motor Continuo 2D',
    dimension: '2D',
    category: 'dexterity2d',
    supportsInfinite: true,
    axis: 'aim',
    accent: '#EC4899',
    accentSoft: 'rgba(236, 72, 153, 0.15)',
    controlsPC: 'Sigue el núcleo móvil con el ratón sin tocar los señuelos rojos',
    controlsTouch: 'Arrastra manteniendo el dedo sobre el núcleo móvil',
    description:
      'Entrena destreza fina manteniendo el puntero fijado sobre un núcleo errático a velocidad progresiva.',
    keywords: ['tracking', 'rastreo', 'puntero', 'seguimiento'],
    guide: {
      objective: 'Mantén el puntero o dedo dentro del núcleo móvil cian el mayor porcentaje de tiempo posible.',
      howToPlay: [
        'Sigue la trayectoria curva del núcleo brillante sin salirte de su radio.',
        'Evita cruzar sobre los señuelos rojos que orbitan cerca.',
        'Cuanto más tiempo continuo lo sigas, más sube tu multiplicador.',
      ],
      controls: [
        { keys: ['Ratón'], touch: 'Arrastrar dedo', action: 'Seguir núcleo móvil', tone: 'primary' },
      ],
      example: {
        frames: [
          makeFrame(
            '#EC4899',
            '<path d="M56 116Q128 34 192 98T264 68" fill="none" stroke="var(--border-strong)" stroke-width="2" stroke-dasharray="4 4"/><circle cx="192" cy="98" r="22" fill="rgba(236,72,153,0.22)" stroke="#EC4899" stroke-width="2.5"/><circle cx="192" cy="98" r="6" fill="#00E5FF"/><circle cx="122" cy="64" r="10" fill="#EF4444"/>',
            'Permanece sobre el anillo rosa evitando los discos rojos.'
          ),
        ],
      },
      practice: 'Entrena suavidad de seguimiento sin penalizar escudos.',
      challenge: 'Mide tu precisión continua para el eje de Puntería.',
    },
  },

  memory2d: {
    id: 'memory2d',
    title: 'MEMORIA RELÁMPAGO',
    subtitle: 'Matriz Visual y Trampas 2D',
    dimension: '2D',
    category: 'dexterity2d',
    supportsInfinite: true,
    axis: 'logic',
    accent: '#8B5CF6',
    accentSoft: 'rgba(139, 92, 246, 0.15)',
    controlsPC: 'Clic en los nodos recordados',
    controlsTouch: 'Toca las celdas del patrón sin tocar trampas rojas',
    description:
      'Retén patrones crecientes de 3×3 hasta 5×5 en un destello y reprodúcelos evitando nodos trampa.',
    keywords: ['memoria', 'patron', 'cuadricula', 'visual'],
    guide: {
      objective: 'Memoriza el patrón de celdas cian en pocos segundos y reprodúcelo sin tocar trampas rojas.',
      howToPlay: [
        'Observa atentamente qué celdas se iluminan en cian (evita recordar las rojas).',
        'Cuando se oculten, pulsa exactamente las celdas objetivo.',
        'Si fallas, verás la solución resaltada en verde durante un instante para aprender.',
      ],
      controls: [
        { keys: ['Clic'], touch: 'Toca celda', action: 'Marcar celda recordada', tone: 'primary' },
      ],
      example: {
        frames: [
          makeFrame(
            '#8B5CF6',
            '<g transform="translate(94,24)" fill="var(--bg-panel)" stroke="var(--border-strong)"><rect x="0" y="0" width="40" height="40" fill="#00E5FF"/><rect x="44" y="0" width="40" height="40"/><rect x="88" y="0" width="40" height="40" fill="#EF4444"/><rect x="0" y="44" width="40" height="40"/><rect x="44" y="44" width="40" height="40" fill="#00E5FF"/><rect x="88" y="44" width="40" height="40"/><rect x="0" y="88" width="40" height="40"/><rect x="44" y="88" width="40" height="40" fill="#00E5FF"/><rect x="88" y="88" width="40" height="40"/></g>',
            'Recuerda las celdas cian y evita pulsar las celdas trampa.'
          ),
          makeFrame(
            '#8B5CF6',
            '<g transform="translate(94,24)" fill="var(--bg-panel)" stroke="var(--border-strong)"><rect x="0" y="0" width="40" height="40" stroke="#22C55E" stroke-width="3"/><rect x="44" y="0" width="40" height="40" stroke="#EF4444" stroke-width="3"/><rect x="88" y="0" width="40" height="40"/><rect x="0" y="44" width="40" height="40"/><rect x="44" y="44" width="40" height="40" stroke="#22C55E" stroke-width="3"/><rect x="88" y="44" width="40" height="40"/></g><text x="160" y="156" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">Al fallar verás en verde las celdas correctas</text>',
            'Cada error muestra la respuesta antes de pasar a la siguiente ronda.'
          ),
        ],
      },
      practice: 'Entrena memoria espacial creciente sin perder escudos.',
      challenge: 'Rondas progresivas de 3×3 a 5×5 para tu eje de Lógica.',
    },
  },

  snake2d: {
    id: 'snake2d',
    title: 'SERPIENTE NEÓN',
    subtitle: 'Control Espacial Dinámico 2D',
    dimension: '2D',
    category: 'dexterity2d',
    supportsInfinite: true,
    axis: 'reflex',
    accent: '#10B981',
    accentSoft: 'rgba(16, 185, 129, 0.15)',
    controlsPC: 'WASD o Flechas para girar',
    controlsTouch: 'Desliza continuo o usa la cruceta táctil',
    description:
      'Recoge orbes cian y bonus dorados a velocidad progresiva sin chocar con muros ni tu propia cola.',
    keywords: ['snake', 'serpiente', 'reflejos', 'arcade'],
    guide: {
      objective: 'Recoge orbes de energía para crecer y sumar combos sin chocar contra muros ni tu propia cola.',
      howToPlay: [
        'Gira en ángulos de 90° con WASD / Flechas o deslizando continuamente el dedo.',
        'En móvil también dispones de una cruceta direccional en la parte inferior.',
        'Los orbes dorados aparecen por tiempo limitado y dan puntuación extra.',
      ],
      controls: [
        { keys: ['WASD', 'Flechas'], touch: 'Deslizar / Cruceta', action: 'Cambiar dirección', tone: 'primary' },
      ],
      example: {
        frames: [
          makeFrame(
            '#10B981',
            '<path d="M56 116h64v-40h52" fill="none" stroke="#10B981" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><circle cx="228" cy="76" r="10" fill="#00E5FF"/><circle cx="228" cy="126" r="8" fill="#FFB800"/>',
            'Enlaza giros rápidos para atrapar orbes cian y bonus dorados.'
          ),
        ],
      },
      practice: 'Practica giros continuos y rutas seguras sin perder escudos.',
      challenge: 'Velocidad progresiva evaluada en tu eje de Reflejos.',
    },
  },

  sniper2d: {
    id: 'sniper2d',
    title: 'CAZADOR DE REFLEJOS',
    subtitle: 'Puntería Instantánea 2D',
    dimension: '2D',
    category: 'dexterity2d',
    supportsInfinite: true,
    axis: 'aim',
    accent: '#F43F5E',
    accentSoft: 'rgba(244, 63, 94, 0.15)',
    controlsPC: 'Clic rápido en blancos cian y dorados',
    controlsTouch: 'Toca los blancos antes de que cierre el anillo (evita rojos)',
    description:
      'Entrena velocidad de reacción en milisegundos y discriminación visual evitando señuelos rojos marcados con X.',
    keywords: ['sniper', 'reflejos', 'punteria', 'blancos'],
    guide: {
      objective: 'Pulsa los blancos cian y dorados antes de que se cierre el anillo evitando los señuelos rojos (NO).',
      howToPlay: [
        'Haz clic o toca rápido los blancos cian y dorados mientras el anillo exterior se encoge.',
        'No pulses los discos rojos con una X y etiqueta NO: quitan escudo y rompen combo.',
        'Golpear justo en el centro suma bonificación extra.',
      ],
      controls: [
        { keys: ['Clic'], touch: 'Toca blanco cian/oro', action: 'Impactar objetivo', tone: 'primary' },
        { keys: ['Evitar'], touch: 'No tocar rojo X/NO', action: 'Evitar señuelo', tone: 'danger' },
      ],
      example: {
        frames: [
          makeFrame(
            '#F43F5E',
            '<circle cx="102" cy="90" r="24" fill="rgba(0,229,255,0.2)" stroke="#00E5FF" stroke-width="2.5"/><circle cx="102" cy="90" r="7" fill="#00E5FF"/><circle cx="218" cy="90" r="22" fill="rgba(239,68,68,0.22)" stroke="#EF4444" stroke-width="2.5"/><line x1="208" y1="80" x2="228" y2="100" stroke="#fff" stroke-width="3"/><line x1="228" y1="80" x2="208" y2="100" stroke="#fff" stroke-width="3"/><text x="218" y="130" text-anchor="middle" fill="#EF4444" font-size="11" font-weight="700">NO</text>',
            'Dispara a los cian/dorados; evita siempre los señuelos rojos con X.'
          ),
        ],
      },
      practice: 'Entrena velocidad de clic y discriminación visual sin perder escudos.',
      challenge: 'Mide reacción en ms y precisión para tu eje de Puntería.',
    },
  },
};
