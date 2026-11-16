import { DifficultyId, GameDescriptor, GameModeId, SkillAxis, StandaloneGameId } from './types';

export const AXIS_META: Record<
  SkillAxis,
  { label: string; short: string; accent: string; tip: string }
> = {
  aim: {
    label: 'Puntería',
    short: 'AIM',
    accent: '#FF4D38',
    tip: 'Precisión bajo presión y velocidad de flick 2D/3D.',
  },
  rhythm: {
    label: 'Ritmo',
    short: 'RHYTHM',
    accent: '#00E5FF',
    tip: 'Lectura de compás, timing en milisegundos y coordinación.',
  },
  logic: {
    label: 'Lógica',
    short: 'LOGIC',
    accent: '#FFB800',
    tip: 'Memoria de trabajo, cálculo rápido, Tetris y control cognitivo.',
  },
  reflex: {
    label: 'Reflejos',
    short: 'REFLEX',
    accent: '#A6FF00',
    tip: 'Micro-esquiva, parry en milisegundos y defensa espacial.',
  },
  agility: {
    label: 'Agilidad 3D',
    short: 'AGILITY',
    accent: '#7B61FF',
    tip: 'Orientación 3D, parkour aéreo y cambios de carril.',
  },
};

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
    accent: '#A6FF00',
    desc: 'Velocidad contenida y ventanas amplias para aprender patrones.',
  },
  standard: {
    label: 'ESTÁNDAR',
    short: '1.00×',
    baseScale: 1.0,
    scoreMult: 1.0,
    accent: '#00E5FF',
    desc: 'Balance arcade oficial para entrenar todas las áreas.',
  },
  hyper: {
    label: 'ÉLITE',
    short: '1.34×',
    baseScale: 1.34,
    scoreMult: 1.35,
    accent: '#FF4D38',
    desc: 'Alta velocidad, blancos exigentes y +35% de puntuación.',
  },
  adaptive: {
    label: 'DINÁMICA (IA)',
    short: 'AUTO',
    baseScale: 1.0,
    scoreMult: 1.15,
    accent: '#FFB800',
    desc: 'Se calibra según tu radar y escala en vivo con tu racha o fallos.',
  },
};

export const GAME_CATALOG: Record<GameModeId, GameDescriptor> = {
  gauntlet: {
    id: 'gauntlet',
    title: 'OMNI GAUNTLET',
    subtitle: '2D ↔ 3D · 10 Disciplinas',
    dimension: '2D ↔ 3D',
    axis: 'all',
    accent: '#F2F5F9',
    accentSoft: 'rgba(242, 245, 249, 0.14)',
    controlsPC: 'Dinámicos según fase (Mouse + WASD / DFJK)',
    controlsTouch: 'Controles adaptativos táctiles',
    description:
      'La prueba total: cambia cada 15s entre las 10 disciplinas 2D y 3D sin perder combo ni escudos. Velocidad creciente.',
  },
  ranked: {
    id: 'ranked',
    title: 'TEST RANKED',
    subtitle: '10 Pruebas · 2m 30s',
    dimension: '2D ↔ 3D',
    axis: 'all',
    accent: '#00E5FF',
    accentSoft: 'rgba(0, 229, 255, 0.14)',
    controlsPC: 'Mouse + Teclado completo',
    controlsTouch: 'Controles adaptativos táctiles',
    description:
      'Recorre los 10 juegos en bloques de 15s para calibrar los 5 ejes de tu radar y subir tu rango oficial.',
  },
  aim3d: {
    id: 'aim3d',
    title: '3D AIM LABS',
    subtitle: 'Shooter Primera Persona 3D',
    dimension: '3D',
    axis: 'aim',
    accent: '#FF4D38',
    accentSoft: 'rgba(255, 77, 56, 0.15)',
    controlsPC: 'Clic para fijar mira + Mouse para apuntar y disparar',
    controlsTouch: 'Arrastra para mirar · Toca para disparar',
    description:
      'Cámara 3D en primera persona con drones móviles y orbes de reacción rápida. Entrena flicks, tracking y precisión.',
  },
  runner3d: {
    id: 'runner3d',
    title: 'HYPER TUNNEL 3D',
    subtitle: 'Corredor Espacial de Agilidad',
    dimension: '3D',
    axis: 'agility',
    accent: '#7B61FF',
    accentSoft: 'rgba(123, 97, 255, 0.16)',
    controlsPC: 'A / D o Flechas para carril · Espacio / W para saltar',
    controlsTouch: 'Desliza Izq/Der/Arriba o usa botones',
    description:
      'Atraviesa un túnel 3D a toda velocidad esquivando barreras láser, saltando muros y recogiendo núcleos energéticos.',
  },
  cube3d: {
    id: 'cube3d',
    title: 'ORBIT BREAKER 3D',
    subtitle: 'Deflector Arkanoid 3D',
    dimension: '3D',
    axis: 'reflex',
    accent: '#00E5FF',
    accentSoft: 'rgba(0, 229, 255, 0.15)',
    controlsPC: 'Mouse o A / D (Flechas) para mover deflector',
    controlsTouch: 'Arrastra lateralmente para mover el escudo',
    description:
      'Rompe matrices de bloques 3D en profundidad con un escudo deflector curvo y cápsulas de plasma.',
  },
  parkour3d: {
    id: 'parkour3d',
    title: 'SKY VAULT 3D',
    subtitle: 'Plataformas y Doble Salto 3D',
    dimension: '3D',
    axis: 'agility',
    accent: '#A6FF00',
    accentSoft: 'rgba(166, 255, 0, 0.14)',
    controlsPC: 'WASD mover · Espacio saltar (x2 Doble Salto)',
    controlsTouch: 'Pad táctil + Botón Doble Salto',
    description:
      'Salta por islas flotantes 3D, plataformas móviles, bloques frágiles y propulsores recogiendo gemas en el vacío.',
  },
  rhythm2d: {
    id: 'rhythm2d',
    title: 'RHYTHM OVERDRIVE',
    subtitle: '4 Carriles · Sintetizador Sync',
    dimension: '2D',
    axis: 'rhythm',
    accent: '#00E5FF',
    accentSoft: 'rgba(0, 229, 255, 0.15)',
    controlsPC: 'Teclas D · F · J · K (o Flechas)',
    controlsTouch: 'Toca directamente cada uno de los 4 carriles',
    description:
      'Notas sincronizadas al milisegundo con música electrónica generada en vivo. Clava PERFECTS para activar Overdrive.',
  },
  parry2d: {
    id: 'parry2d',
    title: 'FLASH PARRY DUEL',
    subtitle: 'Duelo de Reflejos y Fintas',
    dimension: '2D',
    axis: 'reflex',
    accent: '#FFB800',
    accentSoft: 'rgba(255, 184, 0, 0.15)',
    controlsPC: 'A / ◀ (Izq) · W / ▲ / Espacio (Centro) · D / ▶ (Der)',
    controlsTouch: 'Toca la zona Izquierda, Centro o Derecha al destello',
    description:
      'Bloquea justo en el destello blanco para contraatacar y evita caer en fintas naranjas. Reacción pura en ms.',
  },
  bullet2d: {
    id: 'bullet2d',
    title: 'BULLET HELL & GRAZE',
    subtitle: 'Esquiva Extrema 2D',
    dimension: '2D',
    axis: 'reflex',
    accent: '#A6FF00',
    accentSoft: 'rgba(166, 255, 0, 0.14)',
    controlsPC: 'WASD / Flechas · Shift para modo precisión lenta',
    controlsTouch: 'Joystick táctil en pantalla',
    description:
      'Sobrevive a espirales, rayos telegrafiados y ráfagas radiales. Rozar proyectiles sin recibir golpe carga puntos Graze.',
  },
  puzzle2d: {
    id: 'puzzle2d',
    title: 'MIND MATRIX',
    subtitle: 'Memoria, Stroop y Cálculo Flash',
    dimension: '2D',
    axis: 'logic',
    accent: '#FFB800',
    accentSoft: 'rgba(255, 184, 0, 0.15)',
    controlsPC: 'Mouse o teclas 1-4 para respuestas rápidas',
    controlsTouch: 'Toca fichas y respuestas',
    description:
      'Alterna contrarreloj entre Chimp Test (memoria numérica), Test Stroop de colores, secuencia Simon y cálculo mental.',
  },
  tetris2d: {
    id: 'tetris2d',
    title: 'BLITZ STACKER',
    subtitle: 'Puzzle Arcade de Bloques',
    dimension: '2D',
    axis: 'logic',
    accent: '#7B61FF',
    accentSoft: 'rgba(123, 97, 255, 0.16)',
    controlsPC: 'A/D mover · W rotar · S bajar · Espacio Drop · C Hold',
    controlsTouch: 'Botones táctiles en pantalla',
    description:
      'Encaja tetrominós a toda velocidad con pieza fantasma, Hold y limpieza múltiple de líneas bajo gravedad dinámica.',
  },
  twinstick2d: {
    id: 'twinstick2d',
    title: 'TWIN-STICK ARENA',
    subtitle: 'Shooter Cenital 2D + Dash',
    dimension: '2D',
    axis: 'aim',
    accent: '#FF6B4A',
    accentSoft: 'rgba(255, 107, 74, 0.15)',
    controlsPC: 'WASD mover · Mouse apuntar/disparar · Espacio Dash',
    controlsTouch: 'Joystick izq mover · Auto-apuntado / botón Dash',
    description:
      'Combate táctico contra oleadas de enemigos que persiguen, cargan y se dividen. Usa el Dash con invulnerabilidad.',
  },
};

export const STANDALONE_IDS: StandaloneGameId[] = [
  'aim3d',
  'runner3d',
  'cube3d',
  'parkour3d',
  'rhythm2d',
  'parry2d',
  'bullet2d',
  'puzzle2d',
  'tetris2d',
  'twinstick2d',
];
