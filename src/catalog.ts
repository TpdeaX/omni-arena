import { DifficultyId, GameDescriptor, GameModeId, SkillAxis, StandaloneGameId } from './types';

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
    tip: 'Memoria de trabajo, cálculo rápido, bloques y control cognitivo.',
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
    tip: 'Orientación 3D, salto aéreo y cambios de carril.',
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
};

export const GAME_CATALOG: Record<GameModeId, GameDescriptor> = {
  gauntlet: {
    id: 'gauntlet',
    title: 'CIRCUITO TOTAL',
    subtitle: '2D ↔ 3D · 14 Disciplinas',
    dimension: '2D ↔ 3D',
    axis: 'all',
    accent: '#2563EB',
    accentSoft: 'rgba(37, 99, 235, 0.14)',
    controlsPC: 'Dinámicos según fase (Ratón + WASD / DFJK)',
    controlsTouch: 'Controles adaptativos táctiles',
    description:
      'La prueba total: rota cada 15s entre las 14 disciplinas 2D y 3D sin perder racha ni escudos. Velocidad creciente.',
  },
  ranked: {
    id: 'ranked',
    title: 'PRUEBA CLASIFICATORIA',
    subtitle: '14 Pruebas · 3m 30s',
    dimension: '2D ↔ 3D',
    axis: 'all',
    accent: '#0284C7',
    accentSoft: 'rgba(2, 132, 199, 0.14)',
    controlsPC: 'Ratón + Teclado completo',
    controlsTouch: 'Controles adaptativos táctiles',
    description:
      'Recorre los 14 desafíos en bloques de 15s para calibrar los 5 ejes de tu radar y subir tu rango oficial.',
  },
  aim3d: {
    id: 'aim3d',
    title: 'PUNTERÍA TÁCTICA 3D',
    subtitle: 'Disparo en Primera Persona 3D',
    dimension: '3D',
    axis: 'aim',
    accent: '#E11D48',
    accentSoft: 'rgba(225, 29, 72, 0.14)',
    controlsPC: 'Clic para fijar mira + Ratón para apuntar y disparar',
    controlsTouch: 'Arrastra para mirar · Toca para disparar',
    description:
      'Cámara 3D en primera persona con drones móviles y orbes de reacción rápida. Entrena giros, seguimiento y precisión.',
  },
  runner3d: {
    id: 'runner3d',
    title: 'TÚNEL HIPER 3D',
    subtitle: 'Corredor Espacial de Agilidad',
    dimension: '3D',
    axis: 'agility',
    accent: '#6D28D9',
    accentSoft: 'rgba(109, 40, 217, 0.15)',
    controlsPC: 'A / D o Flechas para carril · Espacio / W para saltar',
    controlsTouch: 'Desliza Izq/Der/Arriba o usa botones',
    description:
      'Atraviesa un túnel 3D a toda velocidad esquivando barreras láser, saltando muros y recogiendo núcleos.',
  },
  cube3d: {
    id: 'cube3d',
    title: 'ROMPEÓRBITA 3D',
    subtitle: 'Deflector de Bloques 3D',
    dimension: '3D',
    axis: 'reflex',
    accent: '#0284C7',
    accentSoft: 'rgba(2, 132, 199, 0.15)',
    controlsPC: 'Ratón o A / D (Flechas) para mover deflector',
    controlsTouch: 'Arrastra lateralmente para mover el escudo',
    description:
      'Rompe matrices de bloques 3D en profundidad con un escudo deflector curvo y cápsulas de energía.',
  },
  parkour3d: {
    id: 'parkour3d',
    title: 'SALTO CELESTE 3D',
    subtitle: 'Plataformas y Doble Salto 3D',
    dimension: '3D',
    axis: 'agility',
    accent: '#15803D',
    accentSoft: 'rgba(21, 128, 61, 0.14)',
    controlsPC: 'WASD mover · Espacio saltar (x2 Doble Salto)',
    controlsTouch: 'Control táctil + Botón Doble Salto',
    description:
      'Salta por islas flotantes 3D, plataformas móviles, bloques frágiles y propulsores recogiendo gemas en el vacío.',
  },
  rhythm2d: {
    id: 'rhythm2d',
    title: 'RITMO SOBRECARGA',
    subtitle: '4 Carriles · Sintetizador en Vivo',
    dimension: '2D',
    axis: 'rhythm',
    accent: '#0891B2',
    accentSoft: 'rgba(8, 145, 178, 0.15)',
    controlsPC: 'Teclas D · F · J · K (o Flechas)',
    controlsTouch: 'Toca directamente cada uno de los 4 carriles',
    description:
      'Notas sincronizadas al milisegundo con música electrónica generada en vivo. Clava PERFECTOS para multiplicar puntos.',
  },
  parry2d: {
    id: 'parry2d',
    title: 'DUELO DE REFLEJO',
    subtitle: 'Bloqueo de Precisión y Fintas',
    dimension: '2D',
    axis: 'reflex',
    accent: '#D97706',
    accentSoft: 'rgba(217, 119, 6, 0.15)',
    controlsPC: 'A / ◀ (Izq) · W / ▲ / Espacio (Centro) · D / ▶ (Der)',
    controlsTouch: 'Toca la zona Izquierda, Centro o Derecha al destello',
    description:
      'Bloquea justo en el destello blanco para contraatacar y evita caer en fintas naranjas. Reacción pura en ms.',
  },
  bullet2d: {
    id: 'bullet2d',
    title: 'LLUVIA Y ROCE',
    subtitle: 'Esquiva Extrema 2D',
    dimension: '2D',
    axis: 'reflex',
    accent: '#65A30D',
    accentSoft: 'rgba(101, 163, 13, 0.14)',
    controlsPC: 'WASD / Flechas · Shift para modo precisión lenta',
    controlsTouch: 'Palanca táctil en pantalla',
    description:
      'Sobrevive a espirales, rayos anunciados y ráfagas radiales. Rozar proyectiles sin recibir golpe suma puntos extra.',
  },
  puzzle2d: {
    id: 'puzzle2d',
    title: 'MATRIZ MENTAL',
    subtitle: 'Memoria, Stroop y Cálculo Ágil',
    dimension: '2D',
    axis: 'logic',
    accent: '#B45309',
    accentSoft: 'rgba(180, 83, 9, 0.15)',
    controlsPC: 'Ratón o teclas 1-4 para respuestas rápidas',
    controlsTouch: 'Toca fichas y respuestas',
    description:
      'Alterna contrarreloj entre memoria numérica, reto de color y palabra, secuencia visual y cálculo mental.',
  },
  tetris2d: {
    id: 'tetris2d',
    title: 'BLOQUES RELÁMPAGO',
    subtitle: 'Rompecabezas de Piezas',
    dimension: '2D',
    axis: 'logic',
    accent: '#4F46E5',
    accentSoft: 'rgba(79, 70, 229, 0.15)',
    controlsPC: 'A/D mover · W rotar · S bajar · Espacio Caída · C Reserva',
    controlsTouch: 'Botones táctiles en pantalla',
    description:
      'Encaja piezas a toda velocidad con guía fantasma, reserva y limpieza múltiple de líneas bajo gravedad dinámica.',
  },
  twinstick2d: {
    id: 'twinstick2d',
    title: 'ARENA DOBLE MANDO',
    subtitle: 'Combate Cenital 2D + Impulso',
    dimension: '2D',
    axis: 'aim',
    accent: '#EA580C',
    accentSoft: 'rgba(234, 88, 12, 0.15)',
    controlsPC: 'WASD mover · Ratón apuntar/disparar · Espacio Impulso',
    controlsTouch: 'Palanca izq. mover · Auto-apuntado / botón Impulso',
    description:
      'Combate táctico contra oleadas de enemigos que persiguen, cargan y se dividen. Usa el impulso con invulnerabilidad.',
  },
  flight3d: {
    id: 'flight3d',
    title: 'VUELO DE PORTALES 3D',
    subtitle: 'Navegación Espacial 3D',
    dimension: '3D',
    axis: 'agility',
    accent: '#06B6D4',
    accentSoft: 'rgba(6, 182, 212, 0.15)',
    controlsPC: 'WASD / Flechas o Ratón para pilotar',
    controlsTouch: 'Arrastra en pantalla para dirigir la nave',
    description:
      'Pilota una nave a través de anillos energéticos en profundidad 3D mientras esquivas meteoros veloces.',
  },
  memory2d: {
    id: 'memory2d',
    title: 'MEMORIA RELÁMPAGO',
    subtitle: 'Matriz Visual y Trampas 2D',
    dimension: '2D',
    axis: 'logic',
    accent: '#8B5CF6',
    accentSoft: 'rgba(139, 92, 246, 0.15)',
    controlsPC: 'Clic en los nodos recordados',
    controlsTouch: 'Toca las celdas del patrón sin tocar trampas rojas',
    description:
      'Retén patrones crecientes de 3×3 hasta 5×5 en un destello y reprodúcelos evitando nodos trampa.',
  },
  snake2d: {
    id: 'snake2d',
    title: 'SERPIENTE NEÓN',
    subtitle: 'Control Espacial Dinámico 2D',
    dimension: '2D',
    axis: 'reflex',
    accent: '#10B981',
    accentSoft: 'rgba(16, 185, 129, 0.15)',
    controlsPC: 'WASD o Flechas para girar',
    controlsTouch: 'Desliza arriba, abajo, izquierda o derecha',
    description:
      'Recoge orbes cian y bonus dorados a velocidad progresiva sin chocar con muros ni tu propia cola.',
  },
  sniper2d: {
    id: 'sniper2d',
    title: 'CAZADOR DE REFLEJOS',
    subtitle: 'Puntería Instantánea 2D',
    dimension: '2D',
    axis: 'aim',
    accent: '#F43F5E',
    accentSoft: 'rgba(244, 63, 94, 0.15)',
    controlsPC: 'Clic rápido en blancos cian y dorados',
    controlsTouch: 'Toca los blancos antes de que cierre el anillo (evita rojos)',
    description:
      'Entrena velocidad de reacción en milisegundos y discriminación visual evitando señuelos rojos.',
  },
};

export const STANDALONE_IDS: StandaloneGameId[] = [
  'aim3d',
  'runner3d',
  'cube3d',
  'parkour3d',
  'flight3d',
  'rhythm2d',
  'parry2d',
  'bullet2d',
  'puzzle2d',
  'tetris2d',
  'twinstick2d',
  'memory2d',
  'snake2d',
  'sniper2d',
];
