// Motor puro de Series, Analogias, Silogismos y Sesgos Cognitivos (sin DOM)

export type LogicCategory = 'sequence' | 'analogy' | 'syllogism' | 'bias';
export type LogicLevel = 1 | 2 | 3 | 4;

export interface LogicQuestion {
  id: string;
  category: LogicCategory;
  level: LogicLevel;
  categoryLabel: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
  hint: string;
  explanation: string;
  vennSvg?: string;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithCorrect<T>(
  correct: T,
  distractors: readonly T[],
  rng: () => number
): { options: [T, T, T, T]; correctIndex: number } {
  const pool = [
    { val: correct, ok: true },
    { val: distractors[0], ok: false },
    { val: distractors[1], ok: false },
    { val: distractors[2], ok: false },
  ];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return {
    options: [pool[0].val, pool[1].val, pool[2].val, pool[3].val],
    correctIndex: pool.findIndex((p) => p.ok),
  };
}

function buildDistinctIntDistractors(
  answer: number,
  candidates: readonly number[],
  rng: () => number
): [number, number, number] {
  const out: number[] = [];
  const used = new Set<number>([answer]);
  for (const c of candidates) {
    if (Number.isFinite(c) && !used.has(c)) {
      used.add(c);
      out.push(c);
      if (out.length === 3) break;
    }
  }
  let delta = 1;
  while (out.length < 3) {
    const sign = rng() < 0.5 ? 1 : -1;
    const cand = answer + sign * delta;
    if (!used.has(cand)) {
      used.add(cand);
      out.push(cand);
    }
    delta++;
  }
  return [out[0], out[1], out[2]];
}

// ==================== 1. SUCESIONES NUMERICAS ====================

function generateSequenceQuestion(level: LogicLevel, seed: number): LogicQuestion {
  const rng = mulberry32(seed);
  let terms: number[] = [];
  let answer = 0;
  let distractorsRaw: number[] = [];
  let hint = '';
  let explanation = '';

  if (level === 1) {
    const mode = Math.floor(rng() * 3);
    if (mode === 0) {
      // Aritmetica constante
      const start = 3 + Math.floor(rng() * 15);
      const step = 3 + Math.floor(rng() * 9);
      terms = Array.from({ length: 5 }, (_, i) => start + i * step);
      answer = start + 5 * step;
      distractorsRaw = [answer - step, answer + step, answer + 2];
      hint = 'Calcula cuánto aumenta de un término al siguiente: la diferencia es constante.';
      explanation = `Es una progresión aritmética que suma +${step} en cada paso: ${terms[4]} + ${step} = ${answer}.`;
    } else if (mode === 1) {
      // Geometrica simple
      const start = 2 + Math.floor(rng() * 4);
      const mult = rng() < 0.65 ? 2 : 3;
      terms = [start];
      for (let i = 1; i < 5; i++) terms.push(terms[i - 1] * mult);
      answer = terms[4] * mult;
      distractorsRaw = [terms[4] + (terms[4] - terms[3]), answer - mult, answer + start];
      hint = 'Divide cada número entre el anterior para descubrir el factor multiplicativo.';
      explanation = `Cada término se multiplica por ${mult}: ${terms[4]} × ${mult} = ${answer}.`;
    } else {
      // Alternancia de dos sumas (+a, +b, +a, +b...)
      const start = 4 + Math.floor(rng() * 10);
      const a = 2 + Math.floor(rng() * 5);
      const b = a + 3 + Math.floor(rng() * 4);
      terms = [start];
      for (let i = 1; i < 6; i++) {
        terms.push(terms[i - 1] + (i % 2 === 1 ? a : b));
      }
      // i=6 -> par -> +b? Revisar: 0->1 (+a), 1->2 (+b), 2->3 (+a), 3->4 (+b), 4->5 (+a), 5->6 (+b)
      answer = terms[5] + b;
      distractorsRaw = [terms[5] + a, answer + a, answer - 2];
      hint = 'Observa las diferencias entre pares seguidos: alternan dos cantidades distintas.';
      explanation = `Las diferencias alternan +${a} y +${b}. Como el último salto fue +${a}, toca sumar +${b}: ${terms[5]} + ${b} = ${answer}.`;
    }
  } else if (level === 2) {
    const mode = Math.floor(rng() * 2);
    if (mode === 0) {
      // Progresion de segundo orden (diferencia crece en +d)
      const start = 2 + Math.floor(rng() * 8);
      let diff = 2 + Math.floor(rng() * 4);
      const accel = 2 + Math.floor(rng() * 3);
      const diffs: number[] = [];
      terms = [start];
      for (let i = 0; i < 4; i++) {
        diffs.push(diff);
        terms.push(terms[terms.length - 1] + diff);
        diff += accel;
      }
      answer = terms[terms.length - 1] + diff;
      distractorsRaw = [
        terms[terms.length - 1] + diffs[diffs.length - 1],
        answer + accel,
        answer - 2,
      ];
      hint = 'Anota la diferencia entre cada par de números y fíjate cuánto crece esa diferencia.';
      explanation = `Las diferencias son +${diffs.join(', +')} (aumentan de +${accel} en +${accel}). El siguiente salto es +${diff}: ${terms[4]} + ${diff} = ${answer}.`;
    } else {
      // x_n = 2 * x_{n-1} + offset
      const start = 2 + Math.floor(rng() * 4);
      const offsetOptions = [-1, 1, 2, 3];
      const offset = offsetOptions[Math.floor(rng() * offsetOptions.length)];
      terms = [start];
      for (let i = 1; i < 5; i++) {
        terms.push(terms[i - 1] * 2 + offset);
      }
      answer = terms[4] * 2 + offset;
      distractorsRaw = [terms[4] * 2, terms[4] * 2 - offset, answer + 2];
      const opText = offset > 0 ? `+ ${offset}` : `- ${Math.abs(offset)}`;
      hint = 'Prueba duplicar cada término y compara qué pequeño ajuste falta para llegar al siguiente.';
      explanation = `La regla es (término anterior × 2) ${opText}. Así, ${terms[4]} × 2 ${opText} = ${answer}.`;
    }
  } else if (level === 3) {
    const mode = Math.floor(rng() * 2);
    if (mode === 0) {
      // Fibonacci generalizado con desplazamiento constante c
      const a0 = 1 + Math.floor(rng() * 4);
      const a1 = a0 + 1 + Math.floor(rng() * 4);
      const c = Math.floor(rng() * 3); // 0, 1 o 2
      terms = [a0, a1];
      for (let i = 2; i < 6; i++) {
        terms.push(terms[i - 1] + terms[i - 2] + c);
      }
      answer = terms[5] + terms[4] + c;
      distractorsRaw = [terms[5] + terms[4] + (c === 0 ? 1 : 0), answer + 2, answer - 3];
      hint = 'Suma los dos términos inmediatamente anteriores y verifica si hay un ajuste fijo.';
      explanation =
        c === 0
          ? `Cada término suma los dos anteriores (tipo Fibonacci): ${terms[4]} + ${terms[5]} = ${answer}.`
          : `Cada término suma los dos anteriores más ${c}: ${terms[4]} + ${terms[5]} + ${c} = ${answer}.`;
    } else {
      // Dos secuencias intercaladas
      const p0 = 3 + Math.floor(rng() * 5);
      const stepP = 4 + Math.floor(rng() * 4);
      const q0 = 20 + Math.floor(rng() * 10);
      const stepQ = -(2 + Math.floor(rng() * 3));
      terms = [p0, q0, p0 + stepP, q0 + stepQ, p0 + 2 * stepP, q0 + 2 * stepQ];
      // Posicion 6 (indice par) sigue la pista P
      answer = p0 + 3 * stepP;
      distractorsRaw = [q0 + 3 * stepQ, p0 + 3 * stepP + 2, terms[5] + stepP];
      hint = 'Separa las posiciones impares (1ª, 3ª, 5ª...) de las pares (2ª, 4ª, 6ª...). Son dos pistas distintas.';
      explanation = `Hay dos series intercaladas: posiciones impares suben +${stepP} (${p0}, ${p0 + stepP}, ${p0 + 2 * stepP}, ${answer}) y las pares cambian en ${stepQ}.`;
    }
  } else {
    const mode = Math.floor(rng() * 2);
    if (mode === 0) {
      // Cuadrados + k (n^2 + k para n = 1..6)
      const k = 1 + Math.floor(rng() * 7);
      terms = Array.from({ length: 5 }, (_, i) => (i + 1) * (i + 1) + k);
      answer = 36 + k;
      distractorsRaw = [25 + k + 9, 36 + k + 2, 36];
      hint = 'Compara cada número con los cuadrados perfectos 1, 4, 9, 16, 25...';
      explanation = `Cada término sigue la fórmula n² + ${k} (para n = 1, 2, 3, 4, 5). Con n = 6: 6² + ${k} = 36 + ${k} = ${answer}.`;
    } else {
      // Regla alternada de operadores (+a, *2, +a, *2...)
      const start = 2 + Math.floor(rng() * 5);
      const add = 3 + Math.floor(rng() * 5);
      terms = [start];
      for (let i = 1; i < 6; i++) {
        terms.push(i % 2 === 1 ? terms[i - 1] + add : terms[i - 1] * 2);
      }
      // i=1(+add), i=2(*2), i=3(+add), i=4(*2), i=5(+add), i=6(*2)
      answer = terms[5] * 2;
      distractorsRaw = [terms[5] + add, answer - add, answer + 2];
      hint = 'No solo se suma: revisa si alternan una suma fija y una multiplicación.';
      explanation = `Alterna dos operaciones: (+${add}) y (×2). Tras sumar +${add} para llegar a ${terms[5]}, toca multiplicar por 2: ${terms[5]} × 2 = ${answer}.`;
    }
  }

  const dInts = buildDistinctIntDistractors(answer, distractorsRaw, rng);
  const { options, correctIndex } = shuffleWithCorrect(
    String(answer),
    dInts.map((n) => String(n)),
    rng
  );

  return {
    id: `seq_${level}_${seed}`,
    category: 'sequence',
    level,
    categoryLabel: 'Sucesión numérica',
    prompt: `¿Qué número completa la sucesión?\n${terms.join('  ·  ')}  ·  ?`,
    options,
    correctIndex,
    hint,
    explanation,
  };
}

// ==================== 2. ANALOGIAS ESTRUCTURALES ====================

interface AnalogyTemplate {
  level: LogicLevel;
  a: string;
  b: string;
  c: string;
  correct: string;
  distractors: [string, string, string];
  relation: string;
  explanation: string;
}

const ANALOGY_BANK: readonly AnalogyTemplate[] = [
  {
    level: 1,
    a: 'Bisturí',
    b: 'Cirujano',
    c: 'Pincel',
    correct: 'Pintor',
    distractors: ['Lienzo', 'Marco', 'Escultura'],
    relation: 'instrumento → profesional que lo usa',
    explanation: 'El bisturí es la herramienta principal del cirujano, igual que el pincel lo es del pintor.',
  },
  {
    level: 1,
    a: 'Capítulo',
    b: 'Libro',
    c: 'Escena',
    correct: 'Obra teatral',
    distractors: ['Telón', 'Aplauso', 'Butaca'],
    relation: 'parte estructural → todo completo',
    explanation: 'Un libro se divide en capítulos, así como una obra teatral se divide en escenas.',
  },
  {
    level: 1,
    a: 'Chispa',
    b: 'Incendio',
    c: 'Semilla',
    correct: 'Árbol',
    distractors: ['Tierra', 'Hoja seca', 'Lluvia'],
    relation: 'origen mínimo → resultado desarrollado',
    explanation: 'De una chispa puede nacer un incendio; de una semilla se desarrolla un árbol.',
  },
  {
    level: 1,
    a: 'Brújula',
    b: 'Orientación',
    c: 'Termómetro',
    correct: 'Temperatura',
    distractors: ['Fiebre', 'Mercurio', 'Invierno'],
    relation: 'instrumento → magnitud o función',
    explanation: 'La brújula mide/guía la orientación y el termómetro mide la temperatura.',
  },
  {
    level: 1,
    a: 'Hambre',
    b: 'Alimento',
    c: 'Sed',
    correct: 'Agua',
    distractors: ['Vaso', 'Calor', 'Arena'],
    relation: 'necesidad → recurso que la satisface',
    explanation: 'El alimento satisface el hambre en la misma relación directa que el agua satisface la sed.',
  },
  {
    level: 2,
    a: 'Partitura',
    b: 'Músico',
    c: 'Plano',
    correct: 'Arquitecto',
    distractors: ['Ladrillo', 'Brújula', 'Edificio'],
    relation: 'código de diseño → ejecutor',
    explanation: 'El músico interpreta la partitura para tocar la obra; el arquitecto interpreta el plano para construir.',
  },
  {
    level: 2,
    a: 'Prólogo',
    b: 'Epílogo',
    c: 'Alba',
    correct: 'Ocaso',
    distractors: ['Mediodía', 'Sombra', 'Estrella'],
    relation: 'inicio → cierre (opuestos temporales)',
    explanation: 'El prólogo abre una obra y el epílogo la cierra; el alba abre el día y el ocaso lo cierra.',
  },
  {
    level: 2,
    a: 'Globo',
    b: 'Aire',
    c: 'Represa',
    correct: 'Agua',
    distractors: ['Concreto', 'Turbina', 'Puente'],
    relation: 'estructura contenedora → fluido contenido',
    explanation: 'Un globo contiene aire en su interior; una represa contiene y acumula agua.',
  },
  {
    level: 2,
    a: 'Átomo',
    b: 'Molécula',
    c: 'Letra',
    correct: 'Palabra',
    distractors: ['Página', 'Tinta', 'Sonido'],
    relation: 'unidad elemental → combinación directa',
    explanation: 'Los átomos se combinan para formar moléculas del mismo modo que las letras forman palabras.',
  },
  {
    level: 2,
    a: 'Ancla',
    b: 'Barco',
    c: 'Freno',
    correct: 'Vehículo',
    distractors: ['Carretera', 'Gasolina', 'Volante'],
    relation: 'mecanismo de detención → transporte',
    explanation: 'El ancla detiene o fija al barco, igual que el freno detiene al vehículo.',
  },
  {
    level: 3,
    a: 'Hipótesis',
    b: 'Experimento',
    c: 'Sospecha',
    correct: 'Investigación',
    distractors: ['Culpable', 'Juicio', 'Sentencia'],
    relation: 'suposición inicial → método de verificación',
    explanation: 'Una hipótesis se pone a prueba mediante un experimento; una sospecha se verifica con una investigación.',
  },
  {
    level: 3,
    a: 'Antídoto',
    b: 'Veneno',
    c: 'Parche',
    correct: 'Vulnerabilidad',
    distractors: ['Servidor', 'Código', 'Teclado'],
    relation: 'contramedida → amenaza o falla',
    explanation: 'Un antídoto neutraliza el efecto de un veneno; un parche de software corrige una vulnerabilidad.',
  },
  {
    level: 3,
    a: 'Mapa',
    b: 'Territorio',
    c: 'Modelo',
    correct: 'Realidad',
    distractors: ['Maqueta', 'Error', 'Fórmula'],
    relation: 'representación simplificada → objeto representado',
    explanation: 'El mapa representa de forma abstracta al territorio; un modelo científico representa simplificadamente la realidad.',
  },
  {
    level: 3,
    a: 'Cimiento',
    b: 'Edificio',
    c: 'Axioma',
    correct: 'Teoría',
    distractors: ['Duda', 'Número', 'Pregunta'],
    relation: 'base indispensable → sistema construido encima',
    explanation: 'Un edificio se sostiene sobre sus cimientos; una teoría formal se sostiene sobre sus axiomas.',
  },
  {
    level: 4,
    a: 'Catalizador',
    b: 'Reacción',
    c: 'Enzima',
    correct: 'Metabolismo',
    distractors: ['Célula', 'Oxígeno', 'Núcleo'],
    relation: 'agente acelerador → proceso que acelera',
    explanation: 'Un catalizador acelera una reacción química sin consumirse; una enzima cumple esa función en el metabolismo.',
  },
  {
    level: 4,
    a: 'Entropía',
    b: 'Desorden',
    c: 'Inercia',
    correct: 'Resistencia al cambio',
    distractors: ['Velocidad alta', 'Gravedad', 'Fricción'],
    relation: 'magnitud física → tendencia estructural',
    explanation: 'La entropía mide la tendencia al desorden de un sistema; la inercia expresa la resistencia a cambiar de estado de movimiento.',
  },
  {
    level: 4,
    a: 'Metáfora',
    b: 'Literalidad',
    c: 'Simulación',
    correct: 'Ensayo real',
    distractors: ['Algoritmo', 'Pantalla', 'Hipótesis'],
    relation: 'plano figurado/virtual → plano directo',
    explanation: 'La metáfora sustituye el sentido literal por uno figurado; la simulación sustituye la prueba física directa por una virtual.',
  },
  {
    level: 4,
    a: 'Premisa',
    b: 'Conclusión',
    c: 'Causa',
    correct: 'Efecto',
    distractors: ['Azar', 'Origen', 'Condición'],
    relation: 'antecedente lógico → consecuente necesario',
    explanation: 'De las premisas se sigue la conclusión en lógica, análogo a como de la causa se sigue el efecto en física.',
  },
];

function generateAnalogyQuestion(level: LogicLevel, seed: number): LogicQuestion {
  const rng = mulberry32(seed);
  const matching = ANALOGY_BANK.filter((a) => a.level === level);
  const pool = matching.length > 0 ? matching : ANALOGY_BANK;
  const item = pool[Math.abs(seed) % pool.length];

  const { options, correctIndex } = shuffleWithCorrect(item.correct, item.distractors, rng);
  return {
    id: `ana_${level}_${seed}`,
    category: 'analogy',
    level,
    categoryLabel: 'Analogía estructural',
    prompt: `${item.a} es a ${item.b} como ${item.c} es a ...`,
    options,
    correctIndex,
    hint: `Identifica el vínculo exacto entre los dos primeros conceptos (${item.relation}).`,
    explanation: item.explanation,
  };
}

// ==================== 3. SILOGISMOS Y VENN SVG ====================

type SyllogismForm =
  | 'barbara'
  | 'celarent'
  | 'undistributed_middle'
  | 'darii'
  | 'ferio'
  | 'modus_tollens_set';

interface DomainTriple {
  x: string;
  y: string;
  z: string;
}

const DOMAIN_TRIPLES: readonly DomainTriple[] = [
  { x: 'Alfas', y: 'Betas', z: 'Gammas' },
  { x: 'Sensores', y: 'Módulos', z: 'Circuitos' },
  { x: 'Rombos', y: 'Polígonos', z: 'Figuras' },
  { x: 'Halcones', y: 'Aves', z: 'Vertebrados' },
  { x: 'Pianistas', y: 'Músicos', z: 'Artistas' },
  { x: 'Cometas', y: 'Astros', z: 'Cuerpos' },
  { x: 'Cronómetros', y: 'Relojes', z: 'Instrumentos' },
  { x: 'Átomos', y: 'Partículas', z: 'Sistemas' },
];

export function renderSyllogismVennSvg(
  form: SyllogismForm,
  xLabel: string,
  yLabel: string,
  zLabel: string
): string {
  const xShort = xLabel.slice(0, 7);
  const yShort = yLabel.slice(0, 7);
  const zShort = zLabel.slice(0, 7);

  let shapes = '';
  if (form === 'barbara') {
    // X dentro de Y dentro de Z
    shapes = `
      <ellipse cx="130" cy="70" rx="108" ry="56" stroke="currentColor" stroke-width="2" fill="none"/>
      <text x="210" y="34" fill="currentColor" font-size="11" font-family="monospace">${zShort}</text>
      <ellipse cx="122" cy="72" rx="72" ry="38" stroke="currentColor" stroke-width="2" fill="none"/>
      <text x="166" y="54" fill="currentColor" font-size="11" font-family="monospace">${yShort}</text>
      <ellipse cx="112" cy="75" rx="38" ry="22" stroke="currentColor" stroke-width="2.2" fill="currentColor" fill-opacity="0.14"/>
      <text x="112" y="79" text-anchor="middle" fill="currentColor" font-size="11" font-weight="bold" font-family="monospace">${xShort}</text>
    `;
  } else if (form === 'celarent' || form === 'modus_tollens_set') {
    // X dentro de Y, Z completamente separado de Y (o Z dentro de X y X separado de Y)
    const inner = form === 'celarent' ? xShort : zShort;
    const mid = form === 'celarent' ? yShort : xShort;
    const outer = form === 'celarent' ? zShort : yShort;
    shapes = `
      <circle cx="84" cy="72" r="52" stroke="currentColor" stroke-width="2" fill="none"/>
      <text x="84" y="32" text-anchor="middle" fill="currentColor" font-size="11" font-family="monospace">${mid}</text>
      <circle cx="84" cy="78" r="26" stroke="currentColor" stroke-width="2.2" fill="currentColor" fill-opacity="0.14"/>
      <text x="84" y="82" text-anchor="middle" fill="currentColor" font-size="11" font-weight="bold" font-family="monospace">${inner}</text>
      <circle cx="204" cy="72" r="38" stroke="currentColor" stroke-width="2" fill="none"/>
      <text x="204" y="76" text-anchor="middle" fill="currentColor" font-size="11" font-weight="bold" font-family="monospace">${outer}</text>
    `;
  } else if (form === 'undistributed_middle') {
    // X y Z ambos dentro de Y, con relacion punteada indeterminada entre si
    shapes = `
      <ellipse cx="130" cy="70" rx="112" ry="56" stroke="currentColor" stroke-width="2" fill="none"/>
      <text x="130" y="28" text-anchor="middle" fill="currentColor" font-size="11" font-family="monospace">${yShort}</text>
      <circle cx="96" cy="78" r="34" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3" fill="none"/>
      <text x="86" y="82" text-anchor="middle" fill="currentColor" font-size="11" font-weight="bold" font-family="monospace">${xShort}</text>
      <circle cx="164" cy="78" r="34" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3" fill="none"/>
      <text x="174" y="82" text-anchor="middle" fill="currentColor" font-size="11" font-weight="bold" font-family="monospace">${zShort}</text>
      <text x="130" y="82" text-anchor="middle" fill="currentColor" font-size="12" font-weight="bold">?</text>
    `;
  } else if (form === 'darii') {
    // Y dentro de Z, X solapa a Y (punto en interseccion X∩Y dentro de Z)
    shapes = `
      <ellipse cx="164" cy="70" rx="82" ry="52" stroke="currentColor" stroke-width="2" fill="none"/>
      <text x="218" y="36" fill="currentColor" font-size="11" font-family="monospace">${zShort}</text>
      <circle cx="152" cy="74" r="34" stroke="currentColor" stroke-width="2" fill="none"/>
      <text x="166" y="54" fill="currentColor" font-size="11" font-family="monospace">${yShort}</text>
      <circle cx="88" cy="74" r="44" stroke="currentColor" stroke-width="2" fill="none"/>
      <text x="64" y="78" text-anchor="middle" fill="currentColor" font-size="11" font-weight="bold" font-family="monospace">${xShort}</text>
      <circle cx="124" cy="74" r="4.5" fill="currentColor"/>
    `;
  } else {
    // ferio: Y separado de Z; X solapa con Y (punto en X∩Y fuera de Z)
    shapes = `
      <circle cx="126" cy="72" r="42" stroke="currentColor" stroke-width="2" fill="none"/>
      <text x="126" y="42" text-anchor="middle" fill="currentColor" font-size="11" font-family="monospace">${yShort}</text>
      <circle cx="64" cy="72" r="38" stroke="currentColor" stroke-width="2" fill="none"/>
      <text x="50" y="76" text-anchor="middle" fill="currentColor" font-size="11" font-weight="bold" font-family="monospace">${xShort}</text>
      <circle cx="94" cy="72" r="4.5" fill="currentColor"/>
      <circle cx="212" cy="72" r="34" stroke="currentColor" stroke-width="2" fill="none"/>
      <text x="212" y="76" text-anchor="middle" fill="currentColor" font-size="11" font-weight="bold" font-family="monospace">${zShort}</text>
    `;
  }

  return `<svg viewBox="0 0 260 140" width="260" height="140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagrama lógico de conjuntos">${shapes}</svg>`;
}

function generateSyllogismQuestion(level: LogicLevel, seed: number): LogicQuestion {
  const rng = mulberry32(seed);
  const formsByLevel: Record<LogicLevel, SyllogismForm[]> = {
    1: ['barbara', 'celarent'],
    2: ['barbara', 'celarent', 'darii'],
    3: ['darii', 'ferio', 'undistributed_middle'],
    4: ['undistributed_middle', 'ferio', 'modus_tollens_set'],
  };
  const available = formsByLevel[level];
  const form = available[Math.floor(rng() * available.length)];
  const triple = DOMAIN_TRIPLES[Math.abs(seed) % DOMAIN_TRIPLES.length];
  const { x, y, z } = triple;

  let prompt = '';
  let correct = '';
  let distractors: [string, string, string] = ['', '', ''];
  let hint = '';
  let explanation = '';

  if (form === 'barbara') {
    prompt = `Asume las premisas:\n1) Todos los ${x} son ${y}.\n2) Todos los ${y} son ${z}.\n¿Qué conclusión se deduce necesariamente?`;
    correct = `Todos los ${x} son ${z}.`;
    distractors = [
      `Todos los ${z} son ${x}.`,
      `Ningún ${x} es ${z}.`,
      `Solo algunos ${x} son ${z}.`,
    ];
    hint = 'Dibuja círculos concéntricos: si A está dentro de B y B está dentro de C, ¿dónde queda A?';
    explanation = `Por transitividad de inclusión (${x} ⊂ ${y} ⊂ ${z}), todo elemento de ${x} pertenece necesariamente a ${z}. Invertirla ("Todos los ${z} son ${x}") sería falso.`;
  } else if (form === 'celarent') {
    prompt = `Asume las premisas:\n1) Todos los ${x} son ${y}.\n2) Ningún ${y} es ${z}.\n¿Qué conclusión es necesariamente verdadera?`;
    correct = `Ningún ${x} es ${z}.`;
    distractors = [
      `Algunos ${x} son ${z}.`,
      `Todos los ${y} son ${x}.`,
      `Todos los ${z} son ${x}.`,
    ];
    hint = `Si ${x} está totalmente contenido dentro de ${y}, y ${y} no toca a ${z}, ¿pueden tocarse ${x} y ${z}?`;
    explanation = `Como todo ${x} está dentro de ${y} y ${y} es completamente disjunto de ${z}, ningún ${x} puede ser ${z}.`;
  } else if (form === 'undistributed_middle') {
    prompt = `Asume únicamente las premisas:\n1) Todos los ${x} son ${y}.\n2) Todos los ${z} son ${y}.\n¿Qué se deduce necesariamente?`;
    correct = `La relación entre ${x} y ${z} es indeterminada.`;
    distractors = [
      `Todos los ${x} son ${z}.`,
      `Algunos ${x} son necesariamente ${z}.`,
      `Ningún ${x} puede ser ${z}.`,
    ];
    hint = 'Cuidado con la falacia del término medio no distribuido: estar ambos dentro de un conjunto grande no obliga a que se toquen.';
    explanation = `Tanto ${x} como ${z} están dentro de ${y}, pero podrían estar separados o solaparse. Ninguna relación fija entre ${x} y ${z} es obligatoria.`;
  } else if (form === 'darii') {
    prompt = `Asume las premisas:\n1) Todos los ${y} son ${z}.\n2) Algunos ${x} son ${y}.\n¿Qué conclusión se deduce necesariamente?`;
    correct = `Algunos ${x} son ${z}.`;
    distractors = [
      `Todos los ${x} son ${z}.`,
      `Ningún ${x} es ${z}.`,
      `Todos los ${z} son ${x}.`,
    ];
    hint = `El grupo de ${x} que sí pertenece a ${y} hereda las propiedades de ${y}.`;
    explanation = `Existe al menos un elemento en ${x} ∩ ${y}. Como todo ${y} está en ${z}, ese elemento también pertenece a ${z}; por tanto, algunos ${x} son ${z}.`;
  } else if (form === 'ferio') {
    prompt = `Asume las premisas:\n1) Ningún ${y} es ${z}.\n2) Algunos ${x} son ${y}.\n¿Qué conclusión es necesariamente verdadera?`;
    correct = `Algunos ${x} no son ${z}.`;
    distractors = [
      `Todos los ${x} son ${z}.`,
      `Ningún ${x} es ${y}.`,
      `Todos los ${z} son ${x}.`,
    ];
    hint = `Fíjate en los ${x} que caen dentro de ${y}: ¿pueden entrar en ${z}?`;
    explanation = `Los elementos de ${x} que están dentro de ${y} quedan excluidos de ${z} (porque ${y} ∩ ${z} = ∅). No sabemos si todos los ${x} son ${y}, así que solo aseguramos que algunos ${x} no son ${z}.`;
  } else {
    prompt = `Asume las premisas:\n1) Ningún ${x} es ${y}.\n2) Todos los ${z} son ${x}.\n¿Qué conclusión se deduce necesariamente?`;
    correct = `Ningún ${z} es ${y}.`;
    distractors = [
      `Todos los ${y} son ${z}.`,
      `Algunos ${z} son ${y}.`,
      `Todos los ${x} son ${z}.`,
    ];
    hint = `Si ${z} está dentro de ${x}, y ${x} no comparte nada con ${y}, ¿puede ${z} compartir algo con ${y}?`;
    explanation = `Como ${z} ⊂ ${x} y ${x} ∩ ${y} = ∅, ningún elemento de ${z} puede estar en ${y}.`;
  }

  const { options, correctIndex } = shuffleWithCorrect(correct, distractors, rng);
  return {
    id: `syl_${form}_${level}_${seed}`,
    category: 'syllogism',
    level,
    categoryLabel: 'Silogismo formal',
    prompt,
    options,
    correctIndex,
    hint,
    explanation,
    vennSvg: renderSyllogismVennSvg(form, x, y, z),
  };
}

// ==================== 4. SESGOS COGNITIVOS Y PENSAMIENTO CRITICO ====================

interface BiasTemplate {
  level: LogicLevel;
  prompt: string;
  correct: string;
  distractors: [string, string, string];
  hint: string;
  explanation: string;
}

const BIAS_BANK: readonly BiasTemplate[] = [
  {
    level: 1,
    prompt: 'Una moneda justa salió cara 6 veces seguidas. Al lanzarla por 7ª vez, alguien afirma: "Seguro sale cruz porque toca compensar". ¿Qué error comete?',
    correct: 'Falacia del jugador: cada lanzamiento sigue teniendo 50% de probabilidad.',
    distractors: [
      'Efecto anclaje: sobreestima el primer lanzamiento.',
      'Sesgo de supervivencia: ignora lanzamientos perdidos.',
      'Tiene razón: la ley de los grandes números compensa al instante.',
    ],
    hint: 'La moneda no tiene memoria de los tiros pasados.',
    explanation: 'En eventos independientes la probabilidad no se "compensa" a corto plazo; la 7ª tirada mantiene exactamente 50% para cara y 50% para cruz.',
  },
  {
    level: 1,
    prompt: 'En verano suben a la vez las ventas de helados y los casos de quemaduras solares. Un informe concluye que comer helado provoca quemaduras. ¿Qué falla?',
    correct: 'Confundir correlación con causalidad ignorando una tercera variable (calor/sol).',
    distractors: [
      'Falacia del costo hundido por usar datos de verano.',
      'Falsa dicotomía entre helados y protector solar.',
      'Negligencia de la muestra porque no preguntó sabores.',
    ],
    hint: 'Busca una variable oculta que explique ambos fenómenos al mismo tiempo.',
    explanation: 'Dos variables que suben juntas no implican que una cause la otra: la radiación solar alta en verano explica tanto el consumo de helados como las quemaduras.',
  },
  {
    level: 1,
    prompt: 'Pagaste $15 por una entrada de cine. A los 25 minutos la película te aburre muchísimo, pero decides quedarte hasta el final "para no perder los $15". ¿Qué sesgo actúa?',
    correct: 'Falacia del costo hundido: el dinero ya gastado no se recupera quedándote.',
    distractors: [
      'Sesgo de confirmación por buscar escenas buenas.',
      'Regresión a la media del guion.',
      'Sesgo de disponibilidad por recordar otras películas.',
    ],
    hint: 'Pregúntate si el dinero ya pagado cambiará según tu decisión futura.',
    explanation: 'Los $15 ya se gastaron hagas lo que hagas; la decisión racional solo debe evaluar el beneficio futuro de tu tiempo restante.',
  },
  {
    level: 1,
    prompt: 'Para probar que una dieta funciona, alguien busca en redes solo testimonios de gente a la que le fue bien e ignora a quienes abandonaron o no bajaron de peso. ¿Qué sesgo es?',
    correct: 'Sesgo de confirmación (selección de evidencia favorable).',
    distractors: [
      'Falacia del jugador por contar casos repetidos.',
      'Efecto halo por admirar a los testigos.',
      'Error de tasa base por usar porcentajes.',
    ],
    hint: 'Nota qué tipo de casos está buscando y cuáles está descartando a propósito.',
    explanation: 'El sesgo de confirmación consiste en buscar, interpretar y recordar únicamente la información que respalda una creencia previa.',
  },
  {
    level: 2,
    prompt: 'Un examen analiza los aviones que regresaron de combate y ve más agujeros en las alas que en el motor. Alguien propone blindar solo las alas. ¿Por qué es erróneo?',
    correct: 'Sesgo de supervivencia: los aviones con impactos en el motor no volvieron.',
    distractors: [
      'Efecto anclaje en la cantidad de agujeros.',
      'Correlación inversa entre blindaje y peso.',
      'Falacia ad hominem contra los pilotos.',
    ],
    hint: 'Piensa en la muestra invisible que falta en el hangar.',
    explanation: 'Es el caso clásico de Abraham Wald: solo observamos a los supervivientes. Si ningún avión regresó con daños en el motor, el motor es precisamente la zona crítica.',
  },
  {
    level: 2,
    prompt: 'Un abrigo marca "Antes $200, Hoy $80" aunque nunca se vendió realmente a $200 y su valor de mercado es $80. ¿Qué sesgo explota la etiqueta?',
    correct: 'Efecto anclaje: usar un número inicial alto para que $80 parezca ganga.',
    distractors: [
      'Costo hundido por el precio de fábrica.',
      'Paradoja de Simpson entre invierno y verano.',
      'Sesgo de atribución fundamental.',
    ],
    hint: 'El primer número que ves condiciona tu referencia de valor.',
    explanation: 'El anclaje hace que las personas ajusten su juicio tomando como referencia la primera cifra presentada ($200), aunque sea arbitraria.',
  },
  {
    level: 2,
    prompt: 'Un entrenador nota que cuando grita a un jugador tras un partido pésimo, el siguiente suele ser mejor; cuando elogia un partido récord, el siguiente empeora. Concluye que gritar funciona mejor. ¿Qué pasa?',
    correct: 'Regresión a la media: tras un extremo, el siguiente resultado tiende al promedio.',
    distractors: [
      'Falacia del apostador por cambiar de táctica.',
      'Sesgo de confirmación del propio jugador.',
      'Falsa dicotomía entre grito y silencio.',
    ],
    hint: 'Un rendimiento excepcional o pésimo incluye azar; ¿qué suele ocurrir en la siguiente medición?',
    explanation: 'Por regresión a la media, los extremos excepcionales suelen ir seguidos de desempeños más cercanos al promedio sin necesidad de atribuirlos al castigo o elogio.',
  },
  {
    level: 2,
    prompt: 'Un portal pregunta a sus lectores en una encuesta voluntaria si usan internet a diario; el 99% responde que sí y concluyen que casi todo el país tiene acceso diario. ¿Cuál es el fallo?',
    correct: 'Sesgo de muestreo: solo responden personas que ya tienen internet.',
    distractors: [
      'Efecto placebo por leer la pregunta.',
      'Regresión a la media nacional.',
      'Falacia de apelación a la novedad.',
    ],
    hint: 'Observa dónde y cómo se recogió la muestra frente a la población total.',
    explanation: 'Una encuesta web excluye automáticamente a quien no tiene conexión, produciendo una muestra no representativa del país.',
  },
  {
    level: 3,
    prompt: 'Una prueba médica detecta una enfermedad rara (1 de cada 1,000 personas) con 99% de precisión (1% falsos positivos). Si das positivo, ¿por qué tu probabilidad real NO es 99%?',
    correct: 'Negligencia de la tasa base: entre 1,000 personas habrá ~10 falsos positivos frente a 1 enfermo real.',
    distractors: [
      'Porque el test pierde precisión en laboratorios pequeños.',
      'Por efecto anclaje en el 1% de error.',
      'Porque 99% y 1% se anulan estadísticamente.',
    ],
    hint: 'Calcula cuántos positivos reales vs falsos positivos salen en una muestra de 1,000 personas.',
    explanation: 'De 1,000 personas, ~1 está enferma (1 positivo real) y 999 están sanas (1% = ~10 falsos positivos). Con un positivo, la probabilidad real ronda 1/11 (~9%), no 99%.',
  },
  {
    level: 3,
    prompt: 'Después de ver dos noticias seguidas de robos en un barrio, alguien afirma que ese barrio es el más peligroso de la ciudad sin mirar estadísticas. ¿Qué heurística domina?',
    correct: 'Sesgo de disponibilidad: juzgar frecuencia por la facilidad con que vienen ejemplos a la mente.',
    distractors: [
      'Costo hundido por vivir cerca del barrio.',
      'Negligencia del tamaño del denominador inverso.',
      'Falacia del hombre de paja.',
    ],
    hint: 'Las noticias recientes e impactantes se recuerdan con más facilidad.',
    explanation: 'La heurística de disponibilidad hace que estimemos la probabilidad de un evento según qué tan vívido o reciente sea el recuerdo en nuestra memoria.',
  },
  {
    level: 3,
    prompt: '"Si no apoyas subir el presupuesto de esta única área, entonces quieres que la empresa quiebre." ¿Qué falacia argumentativa aparece?',
    correct: 'Falsa dicotomía: reduce múltiples alternativas a solo dos extremos.',
    distractors: [
      'Regresión a la media financiera.',
      'Sesgo de supervivencia presupuestal.',
      'Paradoja de Simpson contable.',
    ],
    hint: '¿Existen opciones intermedias o formas distintas de asignar recursos?',
    explanation: 'La falsa dicotomía presenta dos opciones extremas como si fueran las únicas posibles, ocultando soluciones intermedias o alternativas.',
  },
  {
    level: 3,
    prompt: 'En un análisis de datos: el equipo A tiene mejor tasa de éxito que el B tanto en casos fáciles como en difíciles por separado, pero al juntar todos los casos el equipo B gana en total. ¿Qué fenómeno ocurre?',
    correct: 'Paradoja de Simpson: el peso desigual de los subgrupos invierte la tendencia agregada.',
    distractors: [
      'Sesgo de confirmación del analista.',
      'Falacia del jugador aplicada a grupos.',
      'Error de redondeo aritmético.',
    ],
    hint: 'Piensa qué pasa si el equipo A atendió muchos más casos difíciles que el equipo B.',
    explanation: 'En la paradoja de Simpson, una tendencia presente en cada subgrupo se invierte al combinar los datos porque los tamaños de los grupos difieren en dificultad.',
  },
  {
    level: 4,
    prompt: 'Al evaluar un estudio científico con n = 6 participantes que da un resultado extremo, un lector concluye que el efecto está demostrado. ¿Qué sesgo estadístico comete?',
    correct: 'Ley de los números pequeños: confiar en muestras diminutas con altísima variabilidad.',
    distractors: [
      'Efecto anclaje por el número 6.',
      'Falacia del costo hundido experimental.',
      'Sesgo de atribución de grupo.',
    ],
    hint: 'Compara cuánto fluctúa un promedio cuando hay 6 datos frente a 600.',
    explanation: 'Las muestras muy pequeñas producen resultados extremos con mucha frecuencia por puro azar; extrapolar desde ellas es la ley de los números pequeños.',
  },
  {
    level: 4,
    prompt: 'Un gerente atribuye sus propios éxitos a su talento y sus fracasos a "mala suerte del mercado", pero cuando un colega falla dice que "es incapaz". ¿Qué sesgo muestra?',
    correct: 'Sesgo de autoservicio combinado con error fundamental de atribución.',
    distractors: [
      'Heurística de disponibilidad numérica.',
      'Paradoja de Simpson organizacional.',
      'Negligencia de la tasa base de mercado.',
    ],
    hint: 'Observa la asimetría entre cómo explica sus propios resultados y los de otros.',
    explanation: 'El sesgo de autoservicio atribuye éxitos propios a causas internas y fallos a externas; el error fundamental de atribución sobreestima rasgos internos al juzgar a otros.',
  },
  {
    level: 4,
    prompt: '"No escuches el cálculo de emisiones de ese ingeniero porque ayer llegó tarde a la reunión." ¿Qué error lógico hay en el argumento?',
    correct: 'Falacia ad hominem: ataca a la persona en lugar de evaluar la validez del cálculo.',
    distractors: [
      'Falsa dicotomía entre puntualidad y cálculo.',
      'Sesgo de confirmación sobre el clima.',
      'Correlación espuria temporal.',
    ],
    hint: '¿Llegar tarde altera la verdad matemática de una ecuación?',
    explanation: 'La falacia ad hominem descalifica un argumento atacando características personales irrelevantes del emisor en vez de refutar sus datos o premisas.',
  },
  {
    level: 4,
    prompt: 'Cada jugador del equipo es el mejor individualmente en su puesto, por lo que un comentarista asegura que el equipo necesariamente jugará mejor que cualquier otro conjunto. ¿Qué falacia es?',
    correct: 'Falacia de composición: asumir que lo cierto para cada parte vale automáticamente para el todo.',
    distractors: [
      'Falacia del jugador por racha de victorias.',
      'Sesgo de anclaje estadístico.',
      'Regresión a la media deportiva.',
    ],
    hint: 'La coordinación entre piezas puede fallar aunque cada pieza brille por separado.',
    explanation: 'La falacia de composición infiere erróneamente que las propiedades de las partes individuales garantizan la misma propiedad en el sistema completo.',
  },
];

function generateBiasQuestion(level: LogicLevel, seed: number): LogicQuestion {
  const rng = mulberry32(seed);
  const matching = BIAS_BANK.filter((b) => b.level === level);
  const pool = matching.length > 0 ? matching : BIAS_BANK;
  const item = pool[Math.abs(seed) % pool.length];

  const { options, correctIndex } = shuffleWithCorrect(item.correct, item.distractors, rng);
  return {
    id: `bias_${level}_${seed}`,
    category: 'bias',
    level,
    categoryLabel: 'Sesgo y pensamiento crítico',
    prompt: item.prompt,
    options,
    correctIndex,
    hint: item.hint,
    explanation: item.explanation,
  };
}

// ==================== API PUBLICA ====================

const ALL_CATEGORIES: readonly LogicCategory[] = ['sequence', 'analogy', 'syllogism', 'bias'];

export function generateLogicRound(
  categoryOrMix: LogicCategory | 'mixed',
  level: LogicLevel,
  seed: number
): LogicQuestion {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const category: LogicCategory =
    categoryOrMix === 'mixed'
      ? ALL_CATEGORIES[Math.abs(seed + Math.floor(rng() * 4)) % ALL_CATEGORIES.length]
      : categoryOrMix;

  if (category === 'sequence') return generateSequenceQuestion(level, seed);
  if (category === 'analogy') return generateAnalogyQuestion(level, seed);
  if (category === 'syllogism') return generateSyllogismQuestion(level, seed);
  return generateBiasQuestion(level, seed);
}
