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

export interface AnalogyTemplate {
  level: LogicLevel;
  a: string;
  b: string;
  c: string;
  correct: string;
  distractors: [string, string, string];
  relation: string;
  explanation: string;
}

export const ANALOGY_BANK: readonly AnalogyTemplate[] = [
  // ---- NIVEL 1 (19) ----
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
    level: 1,
    a: 'Martillo',
    b: 'Carpintero',
    c: 'Estetoscopio',
    correct: 'Médico',
    distractors: ['Hospital', 'Receta', 'Farmacia'],
    relation: 'herramienta → profesional que la emplea',
    explanation: 'El carpintero trabaja con el martillo y el médico diagnostica con el estetoscopio.',
  },
  {
    level: 1,
    a: 'Estrofa',
    b: 'Poema',
    c: 'Compás',
    correct: 'Partitura',
    distractors: ['Silencio', 'Batuta', 'Escenario'],
    relation: 'unidad estructural → composición completa',
    explanation: 'Un poema se organiza en estrofas y una partitura musical se organiza en compases.',
  },
  {
    level: 1,
    a: 'Llave',
    b: 'Cerradura',
    c: 'Contraseña',
    correct: 'Cuenta digital',
    distractors: ['Monitor', 'Teclado', 'Cable'],
    relation: 'elemento de acceso → sistema protegido',
    explanation: 'La llave abre una cerradura física del mismo modo que la contraseña da acceso a una cuenta digital.',
  },
  {
    level: 1,
    a: 'Aleta',
    b: 'Pez',
    c: 'Ala',
    correct: 'Ave',
    distractors: ['Nido', 'Pluma', 'Pico'],
    relation: 'órgano de desplazamiento → animal',
    explanation: 'El pez se desplaza en el agua con aletas y el ave se desplaza en el aire con alas.',
  },
  {
    level: 1,
    a: 'Balanza',
    b: 'Masa',
    c: 'Cronómetro',
    correct: 'Tiempo',
    distractors: ['Carrera', 'Aguja', 'Distancia'],
    relation: 'instrumento de medición → magnitud física',
    explanation: 'La balanza mide masa y el cronómetro mide intervalos de tiempo.',
  },
  {
    level: 1,
    a: 'Raíz',
    b: 'Planta',
    c: 'Base',
    correct: 'Columna',
    distractors: ['Techo', 'Ventana', 'Pared'],
    relation: 'soporte inferior → estructura sostenida',
    explanation: 'La raíz sostiene y fija la planta al suelo igual que la base sostiene la columna.',
  },
  {
    level: 1,
    a: 'Guante',
    b: 'Mano',
    c: 'Casco',
    correct: 'Cabeza',
    distractors: ['Moto', 'Espalda', 'Hombro'],
    relation: 'prenda protectora → parte del cuerpo',
    explanation: 'El guante protege la mano del mismo modo que el casco protege la cabeza.',
  },
  {
    level: 1,
    a: 'Nube',
    b: 'Lluvia',
    c: 'Volcán',
    correct: 'Lava',
    distractors: ['Cráter', 'Montaña', 'Ceniza fría'],
    relation: 'fuente natural → emisión característica',
    explanation: 'De la nube cae la lluvia y del volcán en erupción brota la lava.',
  },
  {
    level: 1,
    a: 'Telescopio',
    b: 'Astrónomo',
    c: 'Microscopio',
    correct: 'Biólogo',
    distractors: ['Bacteria', 'Vidrio', 'Muestra'],
    relation: 'instrumento óptico → especialista',
    explanation: 'El astrónomo observa astros con el telescopio y el biólogo observa células con el microscopio.',
  },
  {
    level: 1,
    a: 'Frío',
    b: 'Abrigo',
    c: 'Oscuridad',
    correct: 'Linterna',
    distractors: ['Noche', 'Sombra', 'Ventana'],
    relation: 'condición adversa → objeto que la remedia',
    explanation: 'El abrigo contrarresta el frío, igual que la linterna resuelve la oscuridad.',
  },
  {
    level: 1,
    a: 'Pétalo',
    b: 'Flor',
    c: 'Tecla',
    correct: 'Piano',
    distractors: ['Melodía', 'Pedal', 'Banqueta'],
    relation: 'componente repetido → objeto completo',
    explanation: 'Los pétalos componen la flor y las teclas componen el teclado del piano.',
  },
  {
    level: 1,
    a: 'Panadero',
    b: 'Harina',
    c: 'Alfarero',
    correct: 'Arcilla',
    distractors: ['Horno', 'Jarrón', 'Torno'],
    relation: 'oficio → materia prima principal',
    explanation: 'El panadero transforma la harina en pan; el alfarero moldea la arcilla en cerámica.',
  },
  {
    level: 1,
    a: 'Remo',
    b: 'Bote',
    c: 'Pedal',
    correct: 'Bicicleta',
    distractors: ['Casco', 'Asfalto', 'Timbre'],
    relation: 'mecanismo de impulso manual → vehículo',
    explanation: 'El remo impulsa el bote en el agua y el pedal impulsa la bicicleta en tierra.',
  },
  {
    level: 1,
    a: 'Índice',
    b: 'Libro',
    c: 'Menú',
    correct: 'Restaurante',
    distractors: ['Mesero', 'Plato', 'Mantel'],
    relation: 'guía de contenidos → conjunto ofrecido',
    explanation: 'El índice resume qué contiene un libro y el menú detalla qué ofrece un restaurante.',
  },

  // ---- NIVEL 2 (19) ----
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
    level: 2,
    a: 'Timón',
    b: 'Rumbo',
    c: 'Volante',
    correct: 'Dirección',
    distractors: ['Motor', 'Velocímetro', 'Rueda'],
    relation: 'control físico → parámetro dirigido',
    explanation: 'El timón controla el rumbo de una nave igual que el volante controla la dirección de un automóvil.',
  },
  {
    level: 2,
    a: 'Receta',
    b: 'Cocinero',
    c: 'Algoritmo',
    correct: 'Programador',
    distractors: ['Servidor', 'Pantalla', 'Teclado'],
    relation: 'secuencia de instrucciones → ejecutor/autor',
    explanation: 'La receta guía paso a paso al cocinero, como el algoritmo guía la solución que implementa el programador.',
  },
  {
    level: 2,
    a: 'Faro',
    b: 'Navegante',
    c: 'Semáforo',
    correct: 'Conductor',
    distractors: ['Avenida', 'Peatón distraído', 'Motor'],
    relation: 'señal luminosa de seguridad → usuario guiado',
    explanation: 'El faro advierte y guía al navegante en el mar, igual que el semáforo ordena el paso del conductor.',
  },
  {
    level: 2,
    a: 'Erosión',
    b: 'Roca',
    c: 'Oxidación',
    correct: 'Hierro',
    distractors: ['Pintura', 'Imán', 'Mina'],
    relation: 'proceso de desgaste → material afectado',
    explanation: 'La erosión desgasta progresivamente la roca y la oxidación degrada el hierro.',
  },
  {
    level: 2,
    a: 'Sinónimo',
    b: 'Equivalencia',
    c: 'Antónimo',
    correct: 'Oposición',
    distractors: ['Pronunciación', 'Rima', 'Silaba'],
    relation: 'categoría léxica → relación semántica',
    explanation: 'Los sinónimos expresan equivalencia de significado y los antónimos expresan oposición.',
  },
  {
    level: 2,
    a: 'Vacuna',
    b: 'Prevención',
    c: 'Antibiótico',
    correct: 'Tratamiento',
    distractors: ['Contagio', 'Síntoma', 'Análisis'],
    relation: 'intervención médica → propósito principal',
    explanation: 'La vacuna busca prevenir una infección antes de que ocurra; el antibiótico trata una infección ya activa.',
  },
  {
    level: 2,
    a: 'Péndulo',
    b: 'Oscilación',
    c: 'Hélice',
    correct: 'Rotación',
    distractors: ['Gravedad', 'Viento', 'Fricción'],
    relation: 'mecanismo → tipo de movimiento característico',
    explanation: 'El péndulo realiza un movimiento de oscilación y la hélice realiza un movimiento de rotación.',
  },
  {
    level: 2,
    a: 'Borrador',
    b: 'Manuscrito',
    c: 'Prototipo',
    correct: 'Producto final',
    distractors: ['Fábrica', 'Cliente', 'Patente'],
    relation: 'versión preliminar → versión definitiva',
    explanation: 'El borrador precede y refina al manuscrito final, como el prototipo precede al producto final.',
  },
  {
    level: 2,
    a: 'Arteria',
    b: 'Sangre',
    c: 'Acueducto',
    correct: 'Agua',
    distractors: ['Puente', 'Piedra', 'Valle'],
    relation: 'conducto de distribución → fluido transportado',
    explanation: 'Las arterias conducen sangre por el cuerpo igual que un acueducto transporta agua hacia la ciudad.',
  },
  {
    level: 2,
    a: 'Célula',
    b: 'Tejido',
    c: 'Ladrillo',
    correct: 'Muro',
    distractors: ['Cemento', 'Plano', 'Martillo'],
    relation: 'unidad repetida → estructura resultante',
    explanation: 'Las células agrupadas forman tejidos, de la misma forma en que los ladrillos unidos forman un muro.',
  },
  {
    level: 2,
    a: 'Dique',
    b: 'Inundación',
    c: 'Pararrayos',
    correct: 'Descarga eléctrica',
    distractors: ['Trueno', 'Nube', 'Llovizna'],
    relation: 'defensa de ingeniería → peligro mitigado',
    explanation: 'El dique protege frente a inundaciones y el pararrayos desvía de forma segura las descargas eléctricas.',
  },
  {
    level: 2,
    a: 'Diccionario',
    b: 'Definición',
    c: 'Atlas',
    correct: 'Mapa',
    distractors: ['Brújula', 'Frontera', 'Relieve'],
    relation: 'obra de consulta → unidad de información',
    explanation: 'Un diccionario compila definiciones y un atlas compila mapas.',
  },
  {
    level: 2,
    a: 'Sismógrafo',
    b: 'Terremoto',
    c: 'Barómetro',
    correct: 'Presión atmosférica',
    distractors: ['Relámpago', 'Altitud fija', 'Nube'],
    relation: 'sensor científico → fenómeno registrado',
    explanation: 'El sismógrafo registra terremotos y el barómetro registra cambios de presión atmosférica.',
  },
  {
    level: 2,
    a: 'Embudo',
    b: 'Filtrar y concentrar',
    c: 'Prisma',
    correct: 'Descomponer luz',
    distractors: ['Reflejar eco', 'Aumentar peso', 'Bloquear aire'],
    relation: 'dispositivo geométrico → transformación que produce',
    explanation: 'El embudo concentra un flujo hacia una salida estrecha; el prisma descompone un haz de luz en su espectro.',
  },

  // ---- NIVEL 3 (19) ----
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
    level: 3,
    a: 'Síntoma',
    b: 'Enfermedad',
    c: 'Humo',
    correct: 'Combustión',
    distractors: ['Oxígeno', 'Ceniza húmeda', 'Viento'],
    relation: 'indicio observable → proceso subyacente',
    explanation: 'El síntoma manifiesta una enfermedad subyacente, como el humo delata una combustión activa.',
  },
  {
    level: 3,
    a: 'Compilador',
    b: 'Código fuente',
    c: 'Traductor',
    correct: 'Texto original',
    distractors: ['Diccionario', 'Imprenta', 'Autor'],
    relation: 'agente transformador de lenguaje → entrada',
    explanation: 'El compilador traduce código fuente a lenguaje máquina, análogo a como el traductor vierte un texto original a otro idioma.',
  },
  {
    level: 3,
    a: 'Amortiguador',
    b: 'Impacto',
    c: 'Reserva financiera',
    correct: 'Crisis de liquidez',
    distractors: ['Impuesto', 'Factura', 'Ganancia'],
    relation: 'colchón de absorción → choque imprevisto',
    explanation: 'El amortiguador absorbe golpes mecánicos y una reserva financiera absorbe caídas bruscas de ingresos.',
  },
  {
    level: 3,
    a: 'Veto',
    b: 'Aprobación',
    c: 'Embargo',
    correct: 'Comercio',
    distractors: ['Aduana', 'Contrato', 'Precio'],
    relation: 'acción bloqueadora → proceso detenido',
    explanation: 'El veto detiene la aprobación de una norma, de modo análogo a como un embargo bloquea el comercio.',
  },
  {
    level: 3,
    a: 'Calibración',
    b: 'Precisión',
    c: 'Ensayo',
    correct: 'Fluidez escénica',
    distractors: ['Escenografía', 'Taquilla', 'Público'],
    relation: 'ajuste previo → cualidad optimizada',
    explanation: 'Calibrar un instrumento eleva su precisión y ensayar una obra eleva la fluidez de su ejecución.',
  },
  {
    level: 3,
    a: 'Cuarentena',
    b: 'Contagio',
    c: 'Cortafuegos',
    correct: 'Intrusión en red',
    distractors: ['Velocidad Wi-Fi', 'Pantalla', 'Memoria RAM'],
    relation: 'barrera de contención → propagación no deseada',
    explanation: 'La cuarentena aísla para frenar contagios y el cortafuegos filtra tráfico para frenar intrusiones.',
  },
  {
    level: 3,
    a: 'Muestra',
    b: 'Población',
    c: 'Biopsia',
    correct: 'Órgano',
    distractors: ['Quirófano', 'Diagnóstico', 'Cicatriz'],
    relation: 'porción extraída para análisis → totalidad estudiada',
    explanation: 'En estadística se analiza una muestra para inferir propiedades de la población, como la biopsia analiza un fragmento del órgano.',
  },
  {
    level: 3,
    a: 'Jurisprudencia',
    b: 'Juez',
    c: 'Protocolo clínico',
    correct: 'Médico',
    distractors: ['Paciente', 'Quirófano', 'Ambulancia'],
    relation: 'marco de referencia acumulado → decisor profesional',
    explanation: 'El juez consulta la jurisprudencia para decidir casos y el médico consulta protocolos clínicos para actuar.',
  },
  {
    level: 3,
    a: 'Cuello de botella',
    b: 'Flujo',
    c: 'Sesgo cognitivo',
    correct: 'Juicio racional',
    distractors: ['Memoria rápida', 'Vocabulario', 'Lectura'],
    relation: 'restricción o distorsión → capacidad limitada',
    explanation: 'Un cuello de botella limita el caudal de un flujo; un sesgo cognitivo distorsiona el juicio racional.',
  },
  {
    level: 3,
    a: 'Censura',
    b: 'Información',
    c: 'Arancel',
    correct: 'Importación',
    distractors: ['Moneda', 'Puerto', 'Barco'],
    relation: 'barrera restrictiva → flujo restringido',
    explanation: 'La censura restringe la circulación de información y el arancel restringe o encarece la importación de bienes.',
  },
  {
    level: 3,
    a: 'Metrónomo',
    b: 'Pulso musical',
    c: 'Reloj de CPU',
    correct: 'Ciclo de instrucciones',
    distractors: ['Teclado', 'Disco duro', 'Monitor'],
    relation: 'marcapasos temporal → eventos sincronizados',
    explanation: 'El metrónomo sincroniza el pulso musical y el reloj de la CPU sincroniza los ciclos de procesamiento.',
  },
  {
    level: 3,
    a: 'Sinopsis',
    b: 'Película',
    c: 'Resumen ejecutivo',
    correct: 'Informe técnico',
    distractors: ['Gráfico', 'Portada', 'Bibliografía'],
    relation: 'síntesis breve → obra extensa',
    explanation: 'La sinopsis condensa la trama de una película y el resumen ejecutivo condensa las conclusiones de un informe.',
  },
  {
    level: 3,
    a: 'Cifrado',
    b: 'Confidencialidad',
    c: 'Firma digital',
    correct: 'Autenticidad',
    distractors: ['Compresión', 'Velocidad', 'Almacenamiento'],
    relation: 'técnica criptográfica → propiedad garantizada',
    explanation: 'El cifrado protege la confidencialidad del mensaje; la firma digital certifica la autenticidad e integridad del emisor.',
  },
  {
    level: 3,
    a: 'Contrapeso',
    b: 'Equilibrio',
    c: 'Auditoría',
    correct: 'Transparencia',
    distractors: ['Publicidad', 'Monopolio', 'Factura'],
    relation: 'mecanismo corrector → estado preservado',
    explanation: 'El contrapeso mantiene el equilibrio mecánico y la auditoría sostiene la transparencia de una organización.',
  },
  {
    level: 3,
    a: 'Fósil',
    b: 'Paleontólogo',
    c: 'Papiro',
    correct: 'Historiador',
    distractors: ['Imprenta', 'Físico', 'Astrónomo'],
    relation: 'vestigio material → investigador que lo interpreta',
    explanation: 'El paleontólogo reconstruye el pasado biológico mediante fósiles y el historiador reconstruye el pasado humano mediante documentos antiguos.',
  },

  // ---- NIVEL 4 (19) ----
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
  {
    level: 4,
    a: 'Homeostasis',
    b: 'Organismo',
    c: 'Termostato',
    correct: 'Sistema térmico',
    distractors: ['Combustible', 'Aislante pasivo', 'Ventilación abierta'],
    relation: 'autorregulación por retroalimentación → sistema regulado',
    explanation: 'La homeostasis estabiliza variables internas del organismo igual que un termostato estabiliza la temperatura de un sistema.',
  },
  {
    level: 4,
    a: 'Teorema',
    b: 'Demostración',
    c: 'Ley empírica',
    correct: 'Replicación experimental',
    distractors: ['Opinión consensuada', 'Analogía poética', 'Adivinanza'],
    relation: 'enunciado válido → criterio de validación en su disciplina',
    explanation: 'Un teorema matemático se valida por demostración deductiva; una ley empírica se consolida por replicación experimental.',
  },
  {
    level: 4,
    a: 'Redundancia',
    b: 'Tolerancia a fallos',
    c: 'Diversificación',
    correct: 'Reducción de riesgo',
    distractors: ['Aumento de deuda', 'Concentración', 'Especulación'],
    relation: 'principio de diseño → resiliencia obtenida',
    explanation: 'Duplicar componentes críticos otorga tolerancia a fallos en ingeniería; diversificar activos reduce el riesgo en finanzas.',
  },
  {
    level: 4,
    a: 'Falsabilidad',
    b: 'Ciencia empírica',
    c: 'Consistencia interna',
    correct: 'Sistema axiomático',
    distractors: ['Retórica', 'Encuesta', 'Tradición'],
    relation: 'criterio fundamental de rigor → dominio del conocimiento',
    explanation: 'Popper señaló la falsabilidad como criterio de la ciencia empírica; la consistencia interna es el requisito esencial de un sistema axiomático.',
  },
  {
    level: 4,
    a: 'Ruido',
    b: 'Señal',
    c: 'Variable confusora',
    correct: 'Relación causal',
    distractors: ['Promedio', 'Gráfico', 'Cuestionario'],
    relation: 'interferencia → información genuina ocultada',
    explanation: 'El ruido enmascara la señal en comunicaciones, igual que una variable confusora enmascara la verdadera relación causal.',
  },
  {
    level: 4,
    a: 'Contraejemplo',
    b: 'Conjetura universal',
    c: 'Anomalía reproducible',
    correct: 'Paradigma vigente',
    distractors: ['Laboratorio', 'Manual escolar', 'Instrumento'],
    relation: 'evidencia mínima refutadora → afirmación o marco cuestionado',
    explanation: 'Un solo contraejemplo refuta una afirmación universal en matemáticas; una anomalía reproducible pone en crisis un paradigma científico.',
  },
  {
    level: 4,
    a: 'Isomorfismo',
    b: 'Estructura equivalente',
    c: 'Sinergia',
    correct: 'Efecto superior a las partes',
    distractors: ['Suma lineal', 'Aislamiento', 'Duplicado exacto'],
    relation: 'concepto sistémico → propiedad definitoria',
    explanation: 'Un isomorfismo establece equivalencia estructural entre dos sistemas; la sinergia produce un efecto conjunto mayor que la suma aislada.',
  },
  {
    level: 4,
    a: 'Heurística',
    b: 'Atajo cognitivo',
    c: 'Algoritmo exacto',
    correct: 'Solución garantizada',
    distractors: ['Intuición rápida', 'Azar puro', 'Aproximación vaga'],
    relation: 'estrategia de resolución → naturaleza de su resultado',
    explanation: 'Una heurística prioriza rapidez mediante un atajo aproximado; un algoritmo exacto garantiza encontrar la solución correcta.',
  },
  {
    level: 4,
    a: 'Histéresis',
    b: 'Dependencia del historial',
    c: 'Markovianidad',
    correct: 'Dependencia solo del estado actual',
    distractors: ['Memoria infinita', 'Oscilación periódica', 'Caos total'],
    relation: 'propiedad dinámica → relación con el pasado',
    explanation: 'La histéresis implica que el sistema depende de su trayectoria previa; un proceso de Markov solo depende de su estado presente.',
  },
  {
    level: 4,
    a: 'Latencia',
    b: 'Tiempo de respuesta',
    c: 'Ancho de banda',
    correct: 'Capacidad de caudal',
    distractors: ['Distancia fija', 'Voltaje', 'Temperatura'],
    relation: 'métrica de red → dimensión física medida',
    explanation: 'La latencia mide cuánto tarda en llegar el primer dato y el ancho de banda mide cuántos datos fluyen por segundo.',
  },
  {
    level: 4,
    a: 'Sobreajuste',
    b: 'Memorizar ruido de entrenamiento',
    c: 'Subajuste',
    correct: 'Ignorar el patrón real',
    distractors: ['Duplicar datos', 'Acelerar cómputo', 'Validar en prueba'],
    relation: 'fallo de modelado → error estructural cometido',
    explanation: 'El sobreajuste aprende el ruido particular de la muestra; el subajuste es demasiado rígido y ni siquiera captura la tendencia real.',
  },
  {
    level: 4,
    a: 'Condición necesaria',
    b: 'Sin ella no ocurre',
    c: 'Condición suficiente',
    correct: 'Con ella basta para ocurrir',
    distractors: ['Impide el evento', 'Es puramente aleatoria', 'Solo ocurre al final'],
    relation: 'categoría lógica → regla de implicación',
    explanation: 'Una condición necesaria debe cumplirse siempre para el resultado; una suficiente garantiza el resultado por sí sola.',
  },
  {
    level: 4,
    a: 'Externalidad',
    b: 'Impacto sobre terceros',
    c: 'Incentivo perverso',
    correct: 'Efecto opuesto al buscado',
    distractors: ['Ganancia esperada', 'Regulación neutra', 'Ahorro directo'],
    relation: 'concepto económico → consecuencia no prevista',
    explanation: 'Una externalidad traslada costos o beneficios a terceros; un incentivo perverso provoca justamente la conducta contraria a la deseada.',
  },
  {
    level: 4,
    a: 'Axioma de parsimonia',
    b: 'Preferir la explicación más simple',
    c: 'Principio de precaución',
    correct: 'Actuar ante riesgo grave incierto',
    distractors: ['Ignorar evidencias', 'Multiplicar supuestos', 'Postergar toda medida'],
    relation: 'principio metodológico → regla de decisión',
    explanation: 'La navaja de Ockham favorece la hipótesis más simple compatible con los datos; el principio de precaución previene daños graves ante incertidumbre.',
  },
  {
    level: 4,
    a: 'Corolario',
    b: 'Consecuencia inmediata de un teorema',
    c: 'Lema',
    correct: 'Resultado auxiliar previo',
    distractors: ['Hipótesis refutada', 'Definición ambigua', 'Error de cálculo'],
    relation: 'elemento deductivo → función en la prueba',
    explanation: 'Un corolario se deduce directamente tras probar un teorema; un lema se demuestra antes como peldaño auxiliar.',
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

export type SyllogismForm =
  | 'barbara'
  | 'celarent'
  | 'undistributed_middle'
  | 'darii'
  | 'ferio'
  | 'modus_tollens_set'
  | 'camestres'
  | 'disamis';

export const SYLLOGISM_FORMS: readonly SyllogismForm[] = [
  'barbara',
  'celarent',
  'undistributed_middle',
  'darii',
  'ferio',
  'modus_tollens_set',
  'camestres',
  'disamis',
];

export interface DomainTriple {
  x: string;
  y: string;
  z: string;
}

export const DOMAIN_TRIPLES: readonly DomainTriple[] = [
  { x: 'Alfas', y: 'Betas', z: 'Gammas' },
  { x: 'Sensores', y: 'Módulos', z: 'Circuitos' },
  { x: 'Rombos', y: 'Polígonos', z: 'Figuras' },
  { x: 'Halcones', y: 'Aves', z: 'Vertebrados' },
  { x: 'Pianistas', y: 'Músicos', z: 'Artistas' },
  { x: 'Cometas', y: 'Astros', z: 'Cuerpos' },
  { x: 'Cronómetros', y: 'Relojes', z: 'Instrumentos' },
  { x: 'Átomos', y: 'Partículas', z: 'Sistemas' },
  { x: 'Delfines', y: 'Cetáceos', z: 'Mamíferos' },
  { x: 'Sonetos', y: 'Poemas', z: 'Textos' },
  { x: 'Triángulos', y: 'Formas', z: 'Objetos' },
  { x: 'Satélites', y: 'Sondas', z: 'Vehículos' },
  { x: 'Cipreses', y: 'Coníferas', z: 'Árboles' },
  { x: 'Violinistas', y: 'Intérpretes', z: 'Creadores' },
  { x: 'Servidores', y: 'Nodos', z: 'Equipos' },
  { x: 'Glaciares', y: 'Reservas', z: 'Masas' },
  { x: 'Pinceles', y: 'Útiles', z: 'Herramientas' },
  { x: 'Enzimas', y: 'Proteínas', z: 'Moléculas' },
  { x: 'Cuarzos', y: 'Cristales', z: 'Minerales' },
  { x: 'Ajedrecistas', y: 'Estrategas', z: 'Jugadores' },
  { x: 'Puentes', y: 'Estructuras', z: 'Obras' },
  { x: 'Volcanes', y: 'Relieves', z: 'Formaciones' },
  { x: 'Baterías', y: 'Celdas', z: 'Componentes' },
  { x: 'Algoritmos', y: 'Métodos', z: 'Procesos' },
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
  } else if (form === 'celarent' || form === 'modus_tollens_set' || form === 'camestres') {
    // Dos conjuntos anidados y un tercero disjunto
    const inner = form === 'modus_tollens_set' ? zShort : xShort;
    const mid = form === 'modus_tollens_set' ? xShort : yShort;
    const outer = form === 'modus_tollens_set' ? yShort : zShort;
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
  } else if (form === 'darii' || form === 'disamis') {
    // Un conjunto dentro del grande, y el tercero solapa al interior (punto en la interseccion)
    const outerLbl = form === 'darii' ? zShort : xShort;
    const innerLbl = yShort;
    const crossLbl = form === 'darii' ? xShort : zShort;
    shapes = `
      <ellipse cx="164" cy="70" rx="82" ry="52" stroke="currentColor" stroke-width="2" fill="none"/>
      <text x="218" y="36" fill="currentColor" font-size="11" font-family="monospace">${outerLbl}</text>
      <circle cx="152" cy="74" r="34" stroke="currentColor" stroke-width="2" fill="none"/>
      <text x="166" y="54" fill="currentColor" font-size="11" font-family="monospace">${innerLbl}</text>
      <circle cx="88" cy="74" r="44" stroke="currentColor" stroke-width="2" fill="none"/>
      <text x="64" y="78" text-anchor="middle" fill="currentColor" font-size="11" font-weight="bold" font-family="monospace">${crossLbl}</text>
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
    2: ['barbara', 'celarent', 'darii', 'camestres'],
    3: ['darii', 'ferio', 'disamis', 'undistributed_middle'],
    4: ['undistributed_middle', 'ferio', 'modus_tollens_set', 'camestres', 'disamis'],
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
  } else if (form === 'camestres') {
    prompt = `Asume las premisas:\n1) Todos los ${x} son ${y}.\n2) Ningún ${z} es ${y}.\n¿Qué conclusión se deduce necesariamente?`;
    correct = `Ningún ${z} es ${x}.`;
    distractors = [
      `Todos los ${z} son ${x}.`,
      `Algunos ${z} son ${x}.`,
      `Todos los ${y} son ${x}.`,
    ];
    hint = `Si ningún ${z} entra en ${y}, y todo ${x} vive dentro de ${y}, ¿puede algún ${z} ser ${x}?`;
    explanation = `Es un silogismo Camestres: ${x} está contenido en ${y}, pero ${z} está completamente fuera de ${y}. Por tanto, ningún ${z} puede pertenecer a ${x}.`;
  } else if (form === 'disamis') {
    prompt = `Asume las premisas:\n1) Algunos ${y} son ${z}.\n2) Todos los ${y} son ${x}.\n¿Qué conclusión es necesariamente verdadera?`;
    correct = `Algunos ${x} son ${z}.`;
    distractors = [
      `Todos los ${x} son ${z}.`,
      `Ningún ${x} es ${z}.`,
      `Todos los ${z} son ${y}.`,
    ];
    hint = `Toma el elemento de ${y} que sí pertenece a ${z}; como todo ${y} está en ${x}, ¿a qué dos grupos pertenece?`;
    explanation = `Es un silogismo Disamis: existe al menos un miembro en ${y} ∩ ${z}. Como todo ${y} está dentro de ${x}, ese mismo miembro pertenece a ${x} y a ${z}.`;
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

export interface BiasTemplate {
  level: LogicLevel;
  prompt: string;
  correct: string;
  distractors: [string, string, string];
  hint: string;
  explanation: string;
}

export const BIAS_BANK: readonly BiasTemplate[] = [
  // ---- NIVEL 1 (13) ----
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
    level: 1,
    prompt: 'Un candidato viste elegante y habla con seguridad, por lo que el jurado asume sin revisar su historial que también es excelente en análisis financiero. ¿Qué sesgo actúa?',
    correct: 'Efecto halo: generalizar una cualidad positiva a áreas no evaluadas.',
    distractors: [
      'Falacia del costo hundido por la entrevista.',
      'Sesgo de muestreo por elegir solo a un candidato.',
      'Paradoja de Simpson en la puntuación.',
    ],
    hint: 'Un rasgo llamativo está iluminando toda la evaluación restante.',
    explanation: 'El efecto halo ocurre cuando una impresión favorable en un rasgo (presencia, carisma) sesga el juicio sobre competencias independientes.',
  },
  {
    level: 1,
    prompt: '"Millones de personas compran este amuleto cada año, así que definitivamente da buena suerte." ¿Qué falacia aparece en el argumento?',
    correct: 'Apelación a la popularidad (ad populum): que muchos crean algo no lo vuelve verdadero.',
    distractors: [
      'Falsa dicotomía sobre amuletos.',
      'Regresión a la media estadística.',
      'Sesgo de supervivencia del comprador.',
    ],
    hint: 'El argumento sustituye pruebas reales por cantidad de seguidores.',
    explanation: 'La falacia ad populum asume que una idea es cierta o eficaz únicamente porque muchas personas la aceptan o la compran.',
  },
  {
    level: 1,
    prompt: 'Un anuncio dice: "Este remedio se usa desde hace 400 años, por lo tanto es mejor que cualquier medicina moderna". ¿Qué falacia comete?',
    correct: 'Apelación a la tradición (ad antiquitatem): la antigüedad no prueba eficacia.',
    distractors: [
      'Falacia del jugador por contar siglos.',
      'Efecto anclaje en el número 400.',
      'Sesgo de disponibilidad médica.',
    ],
    hint: 'Que algo sea antiguo garantiza historia, no eficacia comprobada.',
    explanation: 'La apelación a la tradición concluye que una práctica es superior solo por llevar mucho tiempo existiendo, sin compararla con evidencia actual.',
  },
  {
    level: 1,
    prompt: 'Al comprar un celular, el vendedor pregunta primero: "¿Lo prefieres con seguro de $120 o el seguro básico de $40?" para que olvides la opción de no contratar ninguno. ¿Qué sesgo usa?',
    correct: 'Efecto encuadre (framing) y falsa limitación de opciones.',
    distractors: [
      'Regresión a la media comercial.',
      'Sesgo de supervivencia de clientes.',
      'Falacia de composición tecnológica.',
    ],
    hint: 'Observa cómo formula la pregunta dando por hecho que comprarás un seguro.',
    explanation: 'El encuadre condiciona la decisión al presentar solo un subconjunto de alternativas que benefician al emisor.',
  },
  {
    level: 1,
    prompt: 'Cada vez que llevas tu camiseta azul tu equipo gana tres partidos, así que concluyes que la camiseta causa las victorias. ¿Qué falacia es?',
    correct: 'Post hoc ergo propter hoc: confundir coincidencia previa con causa.',
    distractors: [
      'Falacia ad hominem contra el equipo rival.',
      'Sesgo de tasa base deportiva.',
      'Efecto halo sobre el color azul.',
    ],
    hint: 'Que A ocurra antes que B no significa que A provoque B.',
    explanation: 'La falacia post hoc asume causalidad únicamente porque un suceso precedió a otro en el tiempo.',
  },
  {
    level: 1,
    prompt: 'Una tienda vende el mismo yogur con la etiqueta "90% libre de grasa" en lugar de "Contiene 10% de grasa" y vende el doble. ¿Qué efecto psicológico actúa?',
    correct: 'Efecto encuadre: dos datos equivalentes generan reacciones distintas según cómo se presenten.',
    distractors: [
      'Sesgo de confirmación nutricional.',
      'Falacia del apostador en compras.',
      'Error de muestreo del supermercado.',
    ],
    hint: 'Compara el contenido real de grasa en ambas etiquetas: es idéntico.',
    explanation: 'Aunque "90% libre de grasa" y "10% de grasa" expresan el mismo hecho, el encuadre positivo resulta mucho más atractivo.',
  },
  {
    level: 1,
    prompt: 'Tras un choque en una esquina, alguien que no vio el accidente comenta: "Yo ya sabía que hoy iba a pasar algo ahí, era obvio". ¿Qué sesgo muestra?',
    correct: 'Sesgo retrospectivo: creer tras conocer el resultado que siempre fue predecible.',
    distractors: [
      'Efecto anclaje temporal.',
      'Falacia de apelación a la autoridad.',
      'Ley de los números pequeños.',
    ],
    hint: 'Piensa si esa persona había advertido el accidente antes de que ocurriera.',
    explanation: 'El sesgo retrospectivo ("ya lo sabía") hace que, una vez conocido un evento, sobrestimemos lo predecible que era antes de suceder.',
  },
  {
    level: 1,
    prompt: '"Si un actor famoso recomienda este banco en televisión, debe ser la opción más segura para mis ahorros." ¿Qué error de razonamiento ocurre?',
    correct: 'Apelación a una autoridad irrelevante: fama artística no implica pericia financiera.',
    distractors: [
      'Paradoja de Simpson bancaria.',
      'Regresión a la media publicitaria.',
      'Costo hundido televisivo.',
    ],
    hint: 'Evalúa si la especialidad del portavoz coincide con el tema del consejo.',
    explanation: 'Citar a una celebridad fuera de su campo de competencia es una apelación a falsa autoridad.',
  },
  {
    level: 1,
    prompt: 'Una persona conserva una suscripción que ya no utiliza durante meses simplemente porque cancelar implica llenar un formulario de dos minutos. ¿Qué sesgo predomina?',
    correct: 'Sesgo de statu quo: preferencia pasiva por mantener la situación actual aunque perjudique.',
    distractors: [
      'Sesgo de disponibilidad contractual.',
      'Falacia del hombre de paja.',
      'Negligencia de la tasa base.',
    ],
    hint: 'La inercia de no cambiar supera a una acción pequeña pero beneficiosa.',
    explanation: 'El sesgo de statu quo lleva a mantener la opción por defecto incluso cuando cambiar aporta un beneficio claro.',
  },

  // ---- NIVEL 2 (13) ----
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
    level: 2,
    prompt: 'Te regalan una taza de $10 y de inmediato te niegas a venderla por menos de $20, aunque jamás habrías pagado $20 por comprarla tú mismo. ¿Qué sesgo aparece?',
    correct: 'Efecto dotación: sobrevalorar un objeto simplemente por ser de nuestra propiedad.',
    distractors: [
      'Sesgo de disponibilidad comercial.',
      'Falacia de composición de precios.',
      'Negligencia de tasa base.',
    ],
    hint: 'Tu valoración saltó en el instante en que la taza pasó a ser tuya.',
    explanation: 'El efecto dotación describe la tendencia a pedir mucho más por renunciar a algo que ya poseemos de lo que pagaríamos por adquirirlo.',
  },
  {
    level: 2,
    prompt: 'Alguien dice: "Quiero reducir el tráfico mejorando el transporte público" y otro responde: "O sea que quieres prohibir todos los autos privados y dejarnos incomunicados". ¿Qué falacia usa?',
    correct: 'Falacia del hombre de paja: distorsiona la postura rival para atacarla con facilidad.',
    distractors: [
      'Falacia del costo hundido urbano.',
      'Sesgo de supervivencia vehicular.',
      'Regresión a la media vial.',
    ],
    hint: 'Compara lo que realmente dijo la primera persona con la caricatura que ataca la segunda.',
    explanation: 'El hombre de paja sustituye el argumento original por una versión exagerada o falsa que nadie defendió.',
  },
  {
    level: 2,
    prompt: 'Una cafetería ofrece tamaño Pequeño a $3, Mediano a $5.80 y Grande a $6. Casi nadie compra el Mediano, pero su presencia dispara las ventas del Grande. ¿Qué efecto actúa?',
    correct: 'Efecto señuelo (dominancia asimétrica): una opción intermedia poco atractiva empuja hacia la cara.',
    distractors: [
      'Falacia del jugador en consumo.',
      'Sesgo retrospectivo del cliente.',
      'Error fundamental de atribución.',
    ],
    hint: 'Fíjate en la diferencia mínima entre Mediano ($5.80) y Grande ($6).',
    explanation: 'El efecto señuelo introduce una alternativa deliberadamente inferior para hacer que la opción objetivo parezca una oportunidad irresistible.',
  },
  {
    level: 2,
    prompt: 'Un equipo estima que entregará una app en 2 semanas, ignorando que sus últimos cinco proyectos similares tardaron entre 6 y 8 semanas. ¿Qué sesgo domina?',
    correct: 'Falacia de la planificación: subestimar plazos mirando solo el escenario ideal.',
    distractors: [
      'Sesgo de supervivencia de software.',
      'Efecto dotación del proyecto.',
      'Falacia ad populum técnica.',
    ],
    hint: 'Contrastan una proyección optimista interna contra el historial real externo.',
    explanation: 'La falacia de la planificación consiste en calcular tiempos suponiendo que no surgirá ningún imprevisto y descartando estadísticas propias pasadas.',
  },
  {
    level: 2,
    prompt: 'Un artículo cita solo a tres multimillonarios que abandonaron la universidad para concluir que estudiar una carrera es inútil para el éxito económico. ¿Qué sesgo principal opera?',
    correct: 'Sesgo de supervivencia y evidencia anecdótica: omite a millones que abandonaron sin éxito.',
    distractors: [
      'Efecto anclaje académico.',
      'Falacia de la pendiente resbaladiza.',
      'Sesgo de statu quo educativo.',
    ],
    hint: '¿Qué pasó con la gran mayoría de casos que no salen en portadas de revistas?',
    explanation: 'Fijarse solo en los casos extraordinarios visibles ignora el enorme denominador de personas con la misma decisión que no alcanzaron ese resultado.',
  },
  {
    level: 2,
    prompt: 'Al debatir una norma de seguridad en bicicletas, alguien responde: "¿Por qué discutimos esto si los hospitales todavía tienen listas de espera?". ¿Qué recurso falaz emplea?',
    correct: 'Falacia de la pista falsa (o privación relativa): desviar el debate hacia otro problema distinto.',
    distractors: [
      'Regresión a la media sanitaria.',
      'Efecto halo hospitalario.',
      'Ley de los números pequeños.',
    ],
    hint: 'Resolver un problema no impide atender otro independiente.',
    explanation: 'La pista falsa y la falacia de privación relativa desvían la atención señalando otro tema más grave para evitar responder al asunto planteado.',
  },
  {
    level: 2,
    prompt: 'Quienes recién aprenden los fundamentos de un tema se califican a sí mismos como expertos con 95% de confianza, mientras los verdaderos especialistas son más cautos. ¿Qué fenómeno es?',
    correct: 'Efecto Dunning-Kruger: falta de dominio que impide reconocer las propias lagunas.',
    distractors: [
      'Sesgo de aversión a la pérdida.',
      'Paradoja de Simpson educativa.',
      'Falacia del costo hundido.',
    ],
    hint: 'Se necesita cierto nivel de conocimiento para percibir cuánto falta por saber.',
    explanation: 'El efecto Dunning-Kruger muestra que con poca pericia se suele sobreestimar la propia competencia porque faltan criterios para autoevaluarse.',
  },
  {
    level: 2,
    prompt: 'Un inversionista mantiene acciones que caen sin fundamento porque el dolor de asumir una pérdida segura le pesa el doble que la alegría de una ganancia equivalente. ¿Qué principio actúa?',
    correct: 'Aversión a la pérdida: las pérdidas psicológicamente pesan más que ganancias equivalentes.',
    distractors: [
      'Efecto halo bursátil.',
      'Falacia ad hominem financiera.',
      'Sesgo de muestreo temporal.',
    ],
    hint: 'Compara el impacto emocional de perder $100 frente a ganar $100.',
    explanation: 'Según la teoría prospectiva, las personas sienten una pérdida aproximadamente el doble de intensa que una ganancia del mismo monto.',
  },
  {
    level: 2,
    prompt: 'Un horóscopo dice: "A veces dudas de tus decisiones, pero valoras la honestidad y tienes potencial aún sin explotar", y el lector se asombra de "qué exacto es". ¿Qué efecto ocurre?',
    correct: 'Efecto Barnum (o Forer): aceptar descripciones vagas y universales como si fueran personales.',
    distractors: [
      'Regresión a la media astral.',
      'Efecto señuelo verbal.',
      'Falacia de composición psicológica.',
    ],
    hint: 'Pregúntate a qué porcentaje de la humanidad le aplicaría exactamente la misma frase.',
    explanation: 'El efecto Barnum hace que percibamos enunciados genéricos y halagadores como retratos precisos de nuestra personalidad única.',
  },

  // ---- NIVEL 3 (13) ----
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
    level: 3,
    prompt: 'Al describir a Linda como activista universitaria de filosofía, la gente juzga más probable que sea "cajera de banco Y activista" que simplemente "cajera de banco". ¿Qué falacia cometen?',
    correct: 'Falacia de la conjunción: P(A y B) nunca puede superar a P(A).',
    distractors: [
      'Sesgo de supervivencia laboral.',
      'Falacia del costo hundido narrativo.',
      'Regresión a la media biográfica.',
    ],
    hint: 'Todo miembro del grupo "cajera y activista" también pertenece al grupo más amplio "cajera".',
    explanation: 'Por reglas de probabilidad, la intersección de dos condiciones nunca puede ser más probable que cualquiera de ellas por separado.',
  },
  {
    level: 3,
    prompt: '"Si permitimos que los estudiantes entreguen esta tarea un día tarde, pronto nadie estudiará y colapsará todo el sistema educativo." ¿Qué falacia aparece?',
    correct: 'Pendiente resbaladiza: encadenar consecuencias extremas sin probar que sean inevitables.',
    distractors: [
      'Sesgo de tasa base escolar.',
      'Efecto dotación académica.',
      'Apelación a la ignorancia.',
    ],
    hint: 'Observa el salto injustificado de un hecho pequeño a una catástrofe total.',
    explanation: 'La falacia de la pendiente resbaladiza asume que una concesión menor desencadenará inevitablemente una cadena de desastres sin demostrar los vínculos intermedios.',
  },
  {
    level: 3,
    prompt: '"Nadie ha demostrado de forma definitiva que no exista un cofre enterrado bajo esa colina, por lo tanto el cofre existe." ¿Qué falacia es?',
    correct: 'Apelación a la ignorancia (ad ignorantiam): la ausencia de refutación no equivale a prueba.',
    distractors: [
      'Falacia de composición geográfica.',
      'Sesgo de disponibilidad histórica.',
      'Efecto señuelo argumental.',
    ],
    hint: '¿A quién corresponde aportar evidencia de una afirmación extraordinaria?',
    explanation: 'Afirmar que algo es verdadero solo porque no se ha demostrado falso invierte indebidamente la carga de la prueba.',
  },
  {
    level: 3,
    prompt: 'Una clínica anuncia que "redujo las complicaciones en un 50%", pero omite que pasaron de 2 casos a 1 caso entre 10,000 pacientes. ¿Qué distorsión estadística usa?',
    correct: 'Riesgo relativo sin riesgo absoluto: magnificar una variación diminuta en porcentaje.',
    distractors: [
      'Falacia del jugador hospitalaria.',
      'Efecto Barnum clínico.',
      'Sesgo de statu quo médico.',
    ],
    hint: 'Compara el cambio relativo (50%) con el cambio absoluto (0.01%).',
    explanation: 'Presentar reducciones relativas sin mostrar la tasa absoluta hace que diferencias minúsculas parezcan enormes.',
  },
  {
    level: 3,
    prompt: 'Un investigador mide 20 variables nutricionales en un grupo pequeño y publica únicamente la única que dio p < 0.05 por azar, ocultando las otras 19. ¿Qué fallo metodológico es?',
    correct: 'Efecto del francotirador de Texas (p-hacking / pesca de significancia).',
    distractors: [
      'Falsa dicotomía experimental.',
      'Efecto halo estadístico.',
      'Sesgo de statu quo científico.',
    ],
    hint: 'Si disparas 20 flechas y luego pintas la diana alrededor de la que acertó, parece puntería.',
    explanation: 'Al hacer múltiples pruebas sin corrección y reportar solo las significativas, los falsos positivos aparecen como hallazgos reales.',
  },
  {
    level: 3,
    prompt: 'Una empresa evalúa únicamente el resultado final de una apuesta arriesgadísima: como salió bien por suerte, premia la decisión y repite el mismo riesgo imprudente. ¿Qué sesgo es?',
    correct: 'Sesgo de resultado (resulting): juzgar la calidad de una decisión solo por su desenlace.',
    distractors: [
      'Efecto dotación corporativo.',
      'Falacia ad populum empresarial.',
      'Paradoja de Simpson contable.',
    ],
    hint: 'Una mala decisión puede salir bien por azar y una buena decisión puede salir mal.',
    explanation: 'El sesgo de resultado confunde la calidad del proceso decisorio con la fortuna del desenlace obtenido.',
  },
  {
    level: 3,
    prompt: 'Al debatir sobre un medicamento, alguien dice: "Ningún verdadero médico dudaría de este tratamiento"; cuando le muestran a un médico que sí duda, responde "entonces no es un verdadero médico". ¿Qué falacia es?',
    correct: 'Falacia del ningún escocés verdadero: redefinir una categoría sobre la marcha para esquivar contraejemplos.',
    distractors: [
      'Falacia de la conjunción clínica.',
      'Sesgo de disponibilidad médica.',
      'Regresión a la media terapéutica.',
    ],
    hint: 'Nota cómo cambia la definición de "verdadero médico" cada vez que aparece una excepción.',
    explanation: 'Esta falacia protege una generalización universal excluyendo arbitrariamente a cualquier contraejemplo.',
  },
  {
    level: 3,
    prompt: 'Un gestor exige primero que se pruebe una tecnología en un piloto; al superar el piloto exige 5 años de historial y luego cambia otra vez el requisito para rechazarla. ¿Qué táctica falaz usa?',
    correct: 'Mover los postes de la portería: cambiar los criterios de prueba cada vez que se cumplen.',
    distractors: [
      'Sesgo retrospectivo de gestión.',
      'Efecto anclaje tecnológico.',
      'Falacia post hoc empresarial.',
    ],
    hint: 'El estándar de aceptación se desplaza cada vez que la evidencia alcanza la meta anterior.',
    explanation: 'Mover los postes invalida el debate racional porque impide de antemano que cualquier evidencia sea suficiente.',
  },
  {
    level: 3,
    prompt: 'Cuando un paciente pide dos opiniones distintas, le impresiona más "el 10% de 100 pacientes sufre efectos" que "el 10% de 10", aunque la probabilidad es la misma, o elige "9 de 100" antes que "1 de 10" para evitar riesgo. ¿Qué sesgo actúa?',
    correct: 'Sesgo de la relación (negligencia del denominador): fijarse en el numerador ignorando la proporción.',
    distractors: [
      'Falacia del hombre de paja estadística.',
      'Efecto Dunning-Kruger médico.',
      'Sesgo de confirmación numérico.',
    ],
    hint: 'Compara 9/100 (9%) frente a 1/10 (10%): el número 9 impresiona más que el 1 aunque la tasa sea menor.',
    explanation: 'La negligencia del denominador lleva a comparar frecuencias brutas (numeradores) en lugar de proporciones reales.',
  },

  // ---- NIVEL 4 (13) ----
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
  {
    level: 4,
    prompt: 'Un hospital adopta como meta premiar la "rapidez de atención" y los médicos empiezan a dar altas prematuras para bajar el promedio de minutos. ¿Qué principio sistémico describe esto?',
    correct: 'Ley de Goodhart: cuando una métrica se vuelve objetivo, deja de ser una buena medida.',
    distractors: [
      'Paradoja de Simpson hospitalaria.',
      'Efecto Barnum institucional.',
      'Falacia de la conjunción clínica.',
    ],
    hint: 'Al incentivar el indicador en lugar del valor real, el sistema optimiza el número a costa de la calidad.',
    explanation: 'La ley de Goodhart advierte que convertir un indicador proxy en meta directa induce comportamientos que distorsionan lo que se quería medir.',
  },
  {
    level: 4,
    prompt: 'En un estudio de pacientes hospitalizados, se observa que quienes tienen enfermedad A parecen tener menos enfermedad B, pero solo porque tener cualquiera de las dos eleva la probabilidad de ser hospitalizado. ¿Qué sesgo es?',
    correct: 'Sesgo de colisionador (paradoja de Berkson): condicionar en un efecto común crea correlaciones falsas.',
    distractors: [
      'Falacia del costo hundido hospitalario.',
      'Efecto anclaje diagnóstico.',
      'Apelación a la tradición médica.',
    ],
    hint: 'Ambas variables influyen en entrar al hospital; al mirar solo dentro del hospital aparece una correlación artificial.',
    explanation: 'La paradoja de Berkson ocurre cuando se filtra la muestra por una variable causada por dos factores independientes, generando una asociación negativa espuria entre ellos.',
  },
  {
    level: 4,
    prompt: '"La universidad tiene 200 años de historia y prestigio, así que este recién graduado concreto necesariamente es un gran experto." ¿Qué falacia comete?',
    correct: 'Falacia de división: atribuir a una parte individual una propiedad que pertenece al todo.',
    distractors: [
      'Falacia de composición institucional.',
      'Sesgo de disponibilidad universitaria.',
      'Regresión a la media académica.',
    ],
    hint: 'Es la imagen espejo de la falacia de composición: va del conjunto hacia el individuo.',
    explanation: 'La falacia de división asume que lo verdadero para una institución completa se cumple automáticamente para cada miembro aislado.',
  },
  {
    level: 4,
    prompt: 'Se descubre que el promedio de ingresos de un departamento subió, así que concluyen que cada trabajador ahora gana mejor, aunque solo se contrató a un director con salario gigante. ¿Qué error ocurre?',
    correct: 'Falacia ecológica / distorsión por valores atípicos en la media aritmética.',
    distractors: [
      'Falacia del apostador salarial.',
      'Efecto señuelo económico.',
      'Apelación a la ignorancia contable.',
    ],
    hint: 'Compara cómo reacciona la media frente a la mediana cuando entra un único dato extremo.',
    explanation: 'La media aritmética es muy sensible a valores extremos; inferir mejoras individuales desde un promedio agregado distorsionado induce a error.',
  },
  {
    level: 4,
    prompt: 'Un comité aprueba un proyecto solo porque nadie quiere romper la armonía del grupo y los escépticos guardan silencio para no parecer conflictivos. ¿Qué fenómeno colectivo actúa?',
    correct: 'Pensamiento de grupo (groupthink): la presión por el consenso suprime el análisis crítico.',
    distractors: [
      'Sesgo de tasa base grupal.',
      'Efecto dotación colectivo.',
      'Falacia de la conjunción organizacional.',
    ],
    hint: 'La búsqueda de cohesión reemplaza la verificación independiente de riesgos.',
    explanation: 'En el pensamiento de grupo, el deseo de conformidad inhibe objeciones válidas y empobrece la calidad de las decisiones.',
  },
  {
    level: 4,
    prompt: '"Este libro dice la verdad absoluta porque en su primer capítulo declara que cada una de sus palabras es infalible." ¿Qué falacia lógica contiene?',
    correct: 'Petición de principio (razonamiento circular): usa como prueba la misma conclusión que intenta demostrar.',
    distractors: [
      'Falsa dicotomía literaria.',
      'Pendiente resbaladiza editorial.',
      'Error fundamental de atribución.',
    ],
    hint: 'La premisa ya presupone aquello que se supone que debe justificar.',
    explanation: 'El razonamiento circular no aporta evidencia externa: da vueltas sobre su propia afirmación inicial.',
  },
  {
    level: 4,
    prompt: 'Una ciudad ofrece recompensas por cada cobra muerta para reducir la plaga; la gente empieza a criar cobras para cobrar la recompensa y al cancelar el pago las suelta, empeorando el problema. ¿Qué fenómeno es?',
    correct: 'Efecto cobra (incentivo perverso): una medida mal diseñada agrava el problema que buscaba resolver.',
    distractors: [
      'Regresión a la media ecológica.',
      'Sesgo retrospectivo urbano.',
      'Falacia ad populum ambiental.',
    ],
    hint: 'El premio económico creó un motivo racional para multiplicar el daño original.',
    explanation: 'El efecto cobra ilustra cómo un incentivo desalineado genera consecuencias no deseadas opuestas al objetivo inicial.',
  },
  {
    level: 4,
    prompt: 'Un experimento médico mide la mejora solo en pacientes que completaron las 12 semanas y borra de la tabla a quienes abandonaron por efectos secundarios graves. ¿Qué sesgo invalida el resultado?',
    correct: 'Sesgo de desgaste (atrición diferencial): eliminar abandonos distorsiona la eficacia real.',
    distractors: [
      'Efecto anclaje temporal.',
      'Falacia de composición clínica.',
      'Heurística de disponibilidad.',
    ],
    hint: '¿Por qué abandonaron esos pacientes? Precisamente por no tolerar el tratamiento.',
    explanation: 'Cuando los abandonos están relacionados con el tratamiento, excluirlos infla artificialmente los beneficios (por eso se usa análisis por intención de tratar).',
  },
  {
    level: 4,
    prompt: 'Un algoritmo de crédito aprende de historiales humanos pasados y replica sus discriminaciones, pero los directivos confían ciegamente diciendo "la máquina es matemática e imparcial". ¿Qué sesgo exhiben?',
    correct: 'Sesgo de automatización: atribuir infalibilidad u objetividad absoluta a sistemas automáticos.',
    distractors: [
      'Falacia del jugador algorítmica.',
      'Efecto Barnum tecnológico.',
      'Aversión a la pérdida digital.',
    ],
    hint: 'Un modelo entrenado con datos sesgados hereda y amplifica esos mismos sesgos.',
    explanation: 'El sesgo de automatización lleva a sobreconfiar en recomendaciones automáticas y omitir auditorías sobre los datos que entrenaron el sistema.',
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
