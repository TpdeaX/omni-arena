# Diseño: Ecosistema de Aprendizaje Total (Dibujo, SOS Pánico, Canto, Multi-Instrumento, IQ e Intuitividad)

- **Fecha:** 2026-11-19
- **Repositorios afectados:**
  1. `omni-life` / Atelier Diario (`C:\Users\Joseph\.gemini\antigravity\scratch\omni-life`, puerto `5176`)
  2. `omni-arena` (`C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena`, puerto `5175`)
  3. `directorio` (`C:\Users\Joseph\.gemini\antigravity\scratch\directorio`, puerto `5178`)
- **Identidad Git (proyecto personal):** `TpdeaX <personaljosephunu@gmail.com>`, rama `main`. No hacer `git push` salvo instrucción explícita del usuario.

---

## 1. Intención y porqué

Convertir el ecosistema personal en una plataforma completa de aprendizaje autónomo, desarrollo cognitivo, práctica musical multipista/multi-instrumento, dibujo guiado y contención inmediata para crisis de ansiedad o ataques de pánico, manteniendo la arquitectura de **reparto natural** entre apps:

- **Atelier Diario (`omni-life`)** aloja las experiencias sin presión de reloj ni penalización por errores: **Calma + SOS Pánico**, **Taller de Dibujo Guiado** y **Estudio de Canto Ampliado**.
- **OMNI ARENA (`omni-arena`)** aloja las academias gamificadas e interactivas con retroalimentación inmediata y métricas por eje: **todos los instrumentos musicales posibles con repertorio real** (`piano2d` ampliado, `drums2d`, `strings2d`, `band2d`) y **nuevas academias de IQ y desarrollo mental** (`spatial3d`, `nonogram2d`, `logicseq2d`, `memorypath2d`), además de un sistema transversal de **dificultad cambiable, dinámica, progresiva y modo infinito**.
- **Directorio (`directorio`)** mantiene la puerta única al día: nueva tarjeta del **Taller de Dibujo**, botón de acceso directo a **SOS Pánico**, contadores actualizados de OMNI ARENA (`33 disciplinas · 15 academias`) y compatibilidad total con Supabase y tema día/noche (`umbral-theme`).

---

## 2. Objetivos, No-Objetivos y Anti-Objetivos

### Objetivos
1. **Intuitividad extrema ("directo al grano"):** al entrar a cualquier pantalla, lo primero visible y usable es el área de trabajo principal (el lienzo, el instrumento, el botón SOS o el tablero). Todo botón lleva icono + etiqueta breve con verbo claro ("Trazar guía", "Cambiar dificultad", "Modo infinito", "Escuchar ejemplo"); nunca botones ambiguos solo con icono. Solo se muestran los controles que aplican al submodo activo.
2. **Contención real en ataque de pánico:** un clic en **SOS Pánico** abre una vista despejada sin texto denso ni formularios, con respiración guiada inmediata, aterrizaje 5-4-3-2-1 tocable, relajación muscular progresiva y sonido calmante generativo en Web Audio.
3. **Aprender dibujo paso a paso:** lecciones guiadas progresivas (trazos base, perspectiva 1 y 2 puntos de fuga, luz/achurado, proporciones de rostro/figura/objetos) + modo lienzo libre con simetría espejo, cuadrícula, historial de deshacer/rehacer y descarga PNG.
4. **Canto más completo:** calentamiento guiado continuo de 5 minutos, 15 canciones variadas en karaoke con acompañamiento armónico y velocidad regulable, ejercicios de vocalización/dicción y validación en vivo por micrófono.
5. **Todos los instrumentos posibles con ejemplos musicales reales:** además de ampliar **Piano** (18 piezas y progresiones), sumar **Batería** (kit de 8 piezas y 12 ritmos/géneros), **Guitarra, Bajo y Ukelele** (mástiles reales, diagramas de acordes, arpegios y 12 riffs/canciones), y **Estudio de Ensamble / Xilófono-Marimba / Melódica** (tocar encima de una banda que acompaña y mutea pistas).
6. **Mayor profundidad de IQ y desarrollo mental:** 4 nuevas academias complementarias a las actuales (Rotación Espacial 3D, Nonogramas Deductivos, Series/Analogías/Silogismos y Palacio Mental/Memoria Asociativa), todas con explicaciones en español del porqué.
7. **Dificultad flexible + modo infinito:** poder elegir y cambiar la dificultad (`Cadete`, `Estándar`, `Élite`, `Dinámica IA`, `Progresiva`) directamente desde la ficha previa y dentro de la partida, y activar **Modo Infinito** (sin límite de reloj, escalado progresivo continuo) en los modos compatibles.

### No-Objetivos
- No descargar ni almacenar MP3/WAV ni usar APIs de partituras con derechos de autor: toda música, percusión, cuerdas y sonidos calmantes se sintetizan en Web Audio (`SynthAudio.ts` y `VoiceStudio.ts`) usando repertorio de dominio público y progresiones/ritmos universales por género.
- No modificar el código de `UNUmbral` ni alterar los 18 juegos del Circuito Total / Clasificatoria (`CIRCUIT_IDS` se mantiene en 18 para respetar la duración y el equilibrio del circuito).
- No romper los datos ya guardados en `localStorage` ni en Supabase (`atelier_diario_profile_v1`, `omni_arena_profile_v1`, `atelier_directory_config_v1`).

### Anti-Objetivos
- Prohibido mostrar formularios, listas largas o texto pequeño dentro de la pantalla de emergencia **SOS Pánico**.
- Prohibido usar emojis o glifos pictográficos en UI; únicamente iconos SVG de un trazo (`stroke="currentColor"`, `stroke-width="2"`, `fill="none"`).
- Prohibido romper la identidad visual propia de cada repositorio (`inherit-legacy-style`: verde institucional + rombos en `omni-life`/`directorio`; tokens propios day/night y `AcademyKit` en `omni-arena`).
- Prohibido acoplar código fuente entre repositorios mediante imports relativos; cada app conserva su propio `SynthAudio`/`VoiceStudio` y se comunica únicamente por el contrato compartido de `localStorage`, URL hash/query y Supabase.

---

## 3. Enfoque elegido y alternativas descartadas

- **Enfoque elegido — Reparto natural entre apps:**
  - *Atelier Diario (`omni-life`)* recibe Calma/SOS Pánico, Taller de Dibujo y Canto ampliado (entornos de práctica serena sin reloj punitivo).
  - *OMNI ARENA (`omni-arena`)* recibe las academias instrumentales (`drums2d`, `strings2d`, `band2d`, ampliación de `piano2d`), las nuevas academias de IQ (`spatial3d`, `nonogram2d`, `logicseq2d`, `memorypath2d`) y el control transversal de dificultad e infinito.
  - *Directorio (`directorio`)* enlaza los nuevos módulos y el acceso rápido SOS Pánico, y actualiza los contadores de Arena vía `omni_arena_catalog_meta_v1`.
- **Alternativa descartada — Meter todo en OMNI ARENA:** evitaría cambiar de puerto/pestaña en desarrollo, pero mezclaría el tono competitivo de escudos/combos con un ataque de pánico o un taller pausado de dibujo, y duplicaría el afinador/micrófono de `SingingView` y el canvas de `CalligraphyView`.

---

## 4. Diseño detallado por Bloques

El proyecto se organiza en **6 bloques independientes y paralelizable por subagentes**, con contratos compartidos congelados antes de implementar.

### Bloque A — Intuitividad, Dificultad e Infinito + Audio base (`omni-arena`)

#### A.1 Principio visual "Directo al grano"
- En `HubView.ts`, dentro de la pestaña **Academias Guiadas (15)**, agregar sub-filtros en píldora sin complejidad: `Todas (15) · Música e Instrumentos (4) · IQ y Lógica (7) · Estrategia y 3D (4)`. Así el usuario encuentra Piano/Batería/Guitarra o juegos de IQ en un clic.
- En `GuideOverlay.ts` y `AcademyKit.ts`, todos los botones llevan texto claro de acción (`Empezar práctica`, `Empezar reto`, `Ver pista razonada`, `Cambiar dificultad`) y los controles secundarios no activos permanecen ocultos hasta que el usuario entra al modo correspondiente.
- En `HubView.ts`, mostrar una fila compacta de contexto en cada tarjeta de academia (`Instrumento / Habilidad` + etiqueta clara del modo).

#### A.2 Dificultad cambiable, Progresiva y Modo Infinito
Extensión de `src/types.ts`, `src/catalog.ts` y `src/state/ProfileStore.ts`:
- `DifficultyId = 'chill' | 'standard' | 'hyper' | 'adaptive' | 'progressive'`.
  - `adaptive` (**Dinámica IA**): sube al encadenar aciertos y baja si fallas o pierdes escudo (ya existente, manteniendo su comportamiento).
  - `progressive` (**Progresiva**): entrada en `DIFFICULTY_META` con `label: 'PROGRESIVA'`, `short: '↑ ESCALA'`, `baseScale: 0.85`, `scoreMult: 1.2`, `accent: '#7C3AED'`. Arranca en `0.85×` y **solo sube** de nivel/velocidad con cada ronda, oleada o cada 12 s activos (`+0.03×`, tope `2.20×`), sin bajar al fallar.
  - En `GameShell.addScore`, tanto `adaptive` como `progressive` usan `Math.max(0.9, this.liveIntensity)` como multiplicador dinámico de puntuación.
- `GameDescriptor` agrega `supportsInfinite?: boolean`:
  - **Activo (`true`)** en:
    - Los **7 juegos de acción/destreza que ya corren sin reloj límite** (`runner3d`, `cube3d`, `parkour3d`, `flight3d`, `bullet2d`, `tetris2d`, `twinstick2d`). En ellos el Reto estándar ya sobrevive hasta `0` escudos; habilitar `infiniteMode` agrega además el botón **`Finalizar y puntuar`** en el HUD y acepta dificultad `progressive`.
    - Los **11 juegos de destreza cronometrados** (`aim3d`, `rhythm2d`, `pulse2d`, `parry2d`, `puzzle2d`, `schulte2d`, `nback2d`, `track2d`, `memory2d`, `snake2d`, `sniper2d`), donde `infiniteMode` anula el límite `standaloneDuration` (`timeLeftSec: null`).
    - Las **6 academias de IQ/lógica escalables** (`raven2d`, `sudoku2d`, `spatial3d`, `nonogram2d`, `logicseq2d`, `memorypath2d`).
    - Las **4 academias musicales** (`piano2d`, `drums2d`, `strings2d`, `band2d`) exclusivamente para sus submodos de **Jam / Resistencia Rítmica continua**.
  - **Inactivo (`false`)** en duelos/rompecabezas finitos por objetivo (`chess2d`, `checkers2d`, `poker2d`, `rubik3d`, `hanoi2d`).
- `PlayerProfile` agrega:
  - `bestInfiniteScores: Record<GameModeId, number>` (separado de `bestScores`, inicializado en `normalizeProfile` con `createZeroModeMap()` y sincronizado en `arena_profile` de Supabase), para no mezclar marcas de partidas de 45–60 s con sesiones infinitas. En `HubView.ts`, si `bestInfiniteScores[id] > 0`, se muestra junto a `RÉCORD` la etiqueta `INF <marca>`.
  - `settings.infiniteModeDefault?: boolean`.
- `GameContext` agrega:
  - `infiniteMode?: boolean` — cuando es `true`, el minijuego desactiva su reloj de fin (`timeLeftSec: null`), escala dificultad de forma continua por ronda/oleada y solo termina si agota escudos (en Reto) o cuando el jugador pulsa el botón **`Finalizar y puntuar`** en el HUD.
- **Regla mínima anti-abuso al pulsar `Finalizar y puntuar`:** requiere al menos **`20` segundos activos O `3` rondas/aciertos resueltos** para actualizar `ratings` del radar y marcar la tríada diaria (`dailyCompletedIds`/`dailyStreak`). Si el usuario finaliza antes de ese umbral, `GameShell` cierra la sesión mostrando aviso claro (registra solo XP mínima sin modificar `ratings` ni racha).
- `GuideOverlay.ts` muestra, debajo de los pasos y antes del botón de inicio (solo en juegos standalone, no en `gauntlet`/`ranked`):
  1. Selector directo de **Dificultad** (`Cadete`, `Estándar`, `Élite`, `Dinámica IA`, `Progresiva`) sincronizado con `profileStore` y con descripción de 1 línea de lo que hace la opción elegida.
  2. Interruptor claro **`Modo Infinito (sin límite de tiempo)`** cuando `desc.supportsInfinite === true`, explicando en una línea: *"Juega rondas continuas cada vez más exigentes hasta agotar escudos o pulsar Finalizar"*.
- `GameShell.ts`:
  - Muestra en el HUD la dificultad activa en un botón compacto clickable (`Dif: Progresiva` / `Dif: Dinámica IA`) y también dentro del modal de Pausa un selector rápido de dificultad + botón `Aplicar y reiniciar` (o cambio inmediato sin reiniciar cuando alternas entre `Dinámica IA` y `Progresiva`).
  - **Visibilidad de escudos/intensidad en Academias:** `hideArcadeStats` se aplica **solo** a academias finitas estratégicas o musicales (`chess2d`, `checkers2d`, `poker2d`, `rubik3d`, `hanoi2d`, `piano2d`, `drums2d`, `strings2d`, `band2d`). En las **6 academias de IQ con vidas** (`raven2d`, `sudoku2d`, `spatial3d`, `nonogram2d`, `logicseq2d`, `memorypath2d`) en modo Reto o Infinito (`!this.practiceMode`), el HUD **sí muestra escudos, combo e intensidad**, y los fallos restan escudos mediante `ctx.damage(1)` terminando en `0`.
  - Si `infiniteMode === true` (y no es `practiceMode`), muestra en el HUD el botón **`Finalizar y puntuar`** para cerrar la sesión infinita voluntariamente.

#### A.3 Extensión del motor de audio (`src/audio/SynthAudio.ts`)
Conservar todos los métodos actuales (`playMidiNote`, `playChord`, `noteOn`, `noteOff`, `scheduleKick`, `scheduleSnare`, `scheduleHat`, etc.) y añadir:
- Nuevos timbres en `InstrumentTimbre`: `'piano' | 'organ' | 'soft' | 'bell' | 'guitar' | 'bass' | 'ukulele' | 'marimba' | 'flute'`.
  - `'guitar'` / `'ukulele'`: mezcla de diente de sierra suavizado con filtro `lowpass` de envolvente rápida (decay de brillo tipo cuerda pulsada) + armónico 2º sutil.
  - `'bass'`: fundamental `triangle` + `sine` sub-grave con filtro `lowpass` cálido en 420 Hz.
  - `'marimba'`: ataque percusivo corto de `sine` + sobretono a 4× frecuencia con decaimiento rápido (0.28 s).
  - `'flute'`: `sine` con ligero vibrato LFO (5 Hz) y ataque suave (`0.05 s`) + leve componente de aire filtrado.
- Nuevo kit de batería completo `playDrum(piece: DrumPieceId, velocity = 0.9, whenOffset = 0)` con 8 piezas:
  - `'kick'` (bombo 130→42 Hz), `'snare'` (caja tono + ruido pasa-banda), `'hihat_closed'` (ruido pasa-alto 7 kHz corto 45 ms), `'hihat_open'` (ruido pasa-alto 6 kHz largo 260 ms), `'tom_high'` (190→110 Hz), `'tom_low'` (125→68 Hz), `'crash'` (ruido metálico 3.8 kHz + decaimiento 0.85 s), `'ride'` (campana FM + ruido 5 kHz 0.5 s).
- Metrónomo preciso `playMetronomeClick(accent: boolean, whenOffset = 0)`.

---

### Bloque B — Todos los Instrumentos y Repertorio Real (`omni-arena`)

Todas las academias musicales comparten UX consistente, directa al grano: barra superior de submodos claros (*Libre*, *Canciones reales*, *Ritmos / Progresiones*, *Oído / Lectura*), selector de tempo (`60–160 BPM` + botones `- / +`), interruptor `Metrónomo` y selector de modo `Práctica (espera tu nota)` vs `Reto (a tempo)`.

**Contrato común de `Modo Reto (Oficial)` musical (`piano2d`, `drums2d`, `strings2d`, `band2d`):**
- El jugador **elige libremente qué canción, ritmo o progresión tocar** del catálogo (y su tempo/nivel) antes de pulsar `Empezar Reto`.
- Durante la ejecución, **los errores de nota o tiempo no cortan la canción a mitad** (rompen combo y reducen precisión, sin quitar escudos). Al finalizar todos los compases de la pieza —o al pulsar `Finalizar y puntuar` en *Jam Infinito*—, el módulo llama a `ctx.finish()` calculando `axisPerformances.rhythm` por porcentaje de precisión, consistencia rítmica y combo máximo.

#### B.1 Expansión de `piano2d` — Piano Maestro (`pianoBank.ts` + `PianoEar2DGame.ts`)
- Mantener el teclado de 2 octavas `Do3–Do5` y el mapa `Z–M / Q–I` existente.
- En **Modo Reto**, el jugador puede elegir directamente cualquiera de las **18 piezas** o **progresiones** para evaluarse tocándola, o elegir la tarjeta **`Examen Completo (Melodía + Oído + Pentagrama)`** que conserva la evaluación combinada de 3 etapas actual.
- Ampliar `GUIDED_MELODIES` de 6 a **18 piezas reales de dominio público** clasificadas por nivel (`Inicial`, `Intermedio`, `Avanzado`), cada una con `level`, `genre`, `bpm`, `notes` (melodía) y `chords` opcionales (acorde de acompañamiento por compás/pulso para que el alumno vea qué acorde suena y pueda activar `Acompañamiento auto` o tocar los acordes):
  - *Inicial:* Himno de la Alegría, Estrellita, Martinillo, Arroz con Leche, Cumpleaños Feliz, Noche de Paz.
  - *Intermedio:* Minueto en Sol (Bach - tema), Para Elisa (tema completo A+B), Cielito Lindo (melodía tradicional), La Cucaracha, Scarborough Fair, Canon en Re (tema principal).
  - *Avanzado:* Claro de Luna (motivo clásico), Preludio en Do (arpegio Bach BWV 846), Vals de las Flores / Danubio Azul (motivo), Blues en Do (melodía + walking), Estudio en Mi menor (arpegio), Progresión Pop I-V-vi-IV melódica.
- Nuevo submodo **`Progresiones de Acordes`**: muestra en grande el cifrado y las teclas iluminadas en el piano de progresiones reales (`Pop I-V-vi-IV`, `Blues 12 compases`, `Jazz II-V-I`, `Cumbia/Andina vi-IV-I-V`, `Canon I-V-vi-iii-IV-I-IV-V`), permitiendo tocarlas con 1 clic/tecla o tecla a tecla.
- Selector de tempo (`0.65×`, `0.85×`, `1.0×`, `1.2×`) y metrónomo visible con pulso luminoso.

#### B.2 `drums2d` — Batería Academia (`src/games/music/drumsBank.ts` + `src/games/DrumsAcademyGame.ts`)
- **Escenario visual intuitivo:** vista cenital limpia de batería de **8 piezas interactivas** en SVG/botones grandes + diagrama con nombre de pieza y tecla PC visible en cada pad (`Espacio` Bombo, `F` Caja, `J` Hi-Hat cerrado, `K` Hi-Hat abierto, `D` Tom agudo, `S` Tom grave, `R` Crash, `U` Ride).
- **4 submodos directos:**
  1. *Kit Libre:* toca cualquier pieza con latencia cero, grabación/bucle de 2 compases o metrónomo.
  2. *Ritmos por Género (12 patrones reales):* parrilla visual de 16 semicorcheas (o 12 en tresillos) donde ves qué piezas golpear en cada paso y una barra móvil recorre el compás. Incluye: **Rock Básico 4/4**, **Pop Moderno**, **Balada 6/8**, **Funk Sincopado**, **Bossa Nova**, **Cumbia Clásica**, **Reggaetón / Dembow**, **Salsa Cáscara/Campana**, **Jazz Swing**, **Blues Shuffle**, **Disco Four-on-the-floor**, **Metal Doble Bombo / Fill**.
  3. *Tocar Guiado (Sigue el golpe):* carriles/pads iluminados que caen o pulsan al compás de la canción/ritmo elegido; en Práctica puedes bajar velocidad a `0.6×` o activar *Esperar golpe* paso a paso; en Reto evalúa precisión en ms y combo.
  4. *Independencia y Coordinación:* ejercicios progresivos (mantener negras en Hi-Hat mientras alternas Bombo y Caja en corcheas) con explicación de técnica.
- Eje del radar: `rhythm`. Acepta `infiniteMode` en modo *Resistencia Rítmica* (los compases se encadenan subiendo BPM gradualmente).

#### B.3 `strings2d` — Estudio de Guitarra, Bajo y Ukelele (`src/games/music/stringsBank.ts` + `src/games/StringsAcademyGame.ts`)
- Selector superior de 3 instrumentos reales, cambiando afinación y número de cuerdas al instante:
  - **Guitarra (6 cuerdas: Mi2–La2–Re3–Sol3–Si3–Mi4)**
  - **Bajo Eléctrico (4 cuerdas: Mi1–La1–Re2–Sol2)**
  - **Ukelele (4 cuerdas: Sol4–Do4–Mi4–La4)**
- **Interfaz ultra clara:** mástil interactivo horizontal (trastes 0 al 12, marcadores en trastes 3, 5, 7, 9, 12, nombre de nota dentro de cada posición pulsada) + botones de cuerdas al aire + botón **`Rasguear acorde`** (`Espacio`).
- **Regla de interacción (rápida y natural según el tipo de ejercicio):**
  - **Acordes a tempo (Canciones de acordes y Entrenador de Cambios de Acorde):** se muestra una barra directa de **posturas de acorde (`1–4` / clic)** con el diagrama de dedos iluminado en el mástil; elegir el acorde coloca la postura completa en el mástil y pulsar **`Espacio` / `Rasguear`** ejecuta el rasgueo al compás.
  - **Punteos/Riffs, Bajo (4 cuerdas) y Mástil Libre:** interacción directa cuerda-por-traste mediante clic/toque en el mástil o teclas rápidas por cuerda (`1–6`).
- **4 submodos:**
  1. *Mástil Libre y Acordes:* biblioteca visual de **16 acordes esenciales** (Mayores, menores y 7ª en Guitarra y Ukelele, con diagrama de dónde va cada dedo: 1 índice, 2 medio, 3 anular, 4 meñique; en Bajo, intervalos fundamentales: tónica, 5ª y octava). Al elegir un acorde, se ilumina en el mástil y suena con rasgueo o cuerda a cuerda.
  2. *Ejemplos de Canciones y Riffs Reales (12 piezas):*
     - Guitarra: *Arpegio Clásico (tipo Romance)*, *Progresión Pop (Do-Sol-Lam-Fa)*, *Blues en La (12 compases)*, *Ritmo Folk / Campfire*, *Riff Rock Pentatónico*.
     - Bajo: *Walking Bass Jazz*, *Groove Funk en Mi*, *Línea Cumbia (tónica-3ª-5ª)*, *Rock Octavas*, *Reggae One-Drop*.
     - Ukelele: *Isla / Pop (Do-Sol-Lam-Fa)*, *Vals Cálido 3/4*.
  3. *Entrenador de Cambios de Acorde:* te pide cambiar entre dos o cuatro acordes al ritmo de un metrónomo, mostrando el diagrama siguiente por adelantado.
  4. *Escala Pentatónica / Mayor en el Mástil:* ilumina la caja de escala para improvisar encima.
- Eje del radar: `rhythm`.

#### B.4 `band2d` — Ensamble, Xilófono/Marimba y Melódica (`src/games/music/bandBank.ts` + `src/games/BandEnsembleGame.ts`)
- Reúne el estudio multi-instrumento completo + el modo **Banda / Jam**:
  - **Selector rápido de Instrumento Activo del Jugador:** permite elegir en vivo qué instrumento tocas sobre la banda entre **Xilófono / Marimba** (láminas de colores `Do4–Do6`), **Melódica / Flauta** (digitación visual + notas largas), **Piano (2 octavas)**, **Mini-Batería (6 pads)** y **Bajo (4 cuerdas simplificado)**.
  - **Estudio de Ensamble (8 canciones / bases completas):** reproduce simultáneamente **Batería + Bajo + Acordes de Piano + Melodía**. Con un clic en cada pista el usuario decide cuál **silenciar para cubrirla él mismo** (*"Quitar Melodía para tocar Xilófono/Flauta"*, *"Quitar Bajo"*, *"Quitar Batería"*, *"Quitar Acordes"*) mientras el resto de la banda mantiene el compás.
- Eje del radar: `rhythm`. Soporta `infiniteMode` (Jam continuo subiendo tempo o cambiando tonalidad cada 8 compases).

---

### Bloque C — Nuevos Juegos de IQ, Desarrollo Mental e Infinito (`omni-arena`)

Cada nueva academia sigue el contrato `MiniGame` + `AcademyKit` (`src/games/intel/*Engine.ts` puro sin DOM para testear con `node --test` usando RNG sembrado `mulberry32`, y vista TS con explicación clara del **porqué**).

#### C.1 `spatial3d` — Rotación Espacial 3D (`src/games/intel/spatial3dEngine.ts` + `src/games/SpatialRotation3DGame.ts`)
- Basado en la prueba clásica de **Shepard-Metzler** para inteligencia visoespacial:
  - Se genera una figura 3D asimétrica de cubos conectados (de 6 a 12 cubos según nivel/dificultad, verificando matemáticamente que **no sea simétrica** respecto a ningún espejo para evitar respuestas ambiguas!).
  - Se muestran a la izquierda la **Figura Modelo** (renderizada en Three.js) y a la derecha 3 o 4 **Candidatas rotadas** en ángulos 3D distintos: exactamente una (o las indicadas en modo comparar par) es la misma figura rotada; las demás son **imágenes especulares (espejo)** o tienen un bloque desplazado.
  - **En Práctica:** puedes arrastrar la figura candidata en 3D con el ratón/dedo después de elegir (o en vista ayuda) para comprobar visualmente cómo coincide o por qué es espejo, con explicación escrita del brazo clave ("El brazo final gira hacia la derecha mirando desde el eje Z, en la opción B apunta al lado opuesto").
  - **Modos:** 10 rondas en Reto estándar, o **Modo Infinito Progresivo** (de 6 cubos hasta 13 cubos y ángulos compuestos).
  - Ejes del radar: `agility` y `logic`.

#### C.2 `nonogram2d` — Nonogramas Deductivos (`src/games/intel/nonogramEngine.ts` + `src/games/NonogramLogic2DGame.ts`)
- Tableros `5×5`, `8×8` y `10×10` con siluetas reconocibles o patrones estructurales cuya **solución única está verificada por un solver deductivo de líneas**.
- **Controles intuitivos:** clic izquierdo (o modo `Pintar` / `Marcar X` en móvil) alterna celda llena y `X` de descarte. Las pistas numéricas de fila/columna se tachan en gris automáticamente cuando esa línea queda completa y válida.
- **Pista Razonada (sin adivinar):** detecta una fila o columna deducible por solapamiento o suma exacta y la explica en español: *"Fila 2 tiene pista [4] en ancho 5: las 3 casillas centrales deben ir pintadas sin importar desde qué borde empiece"*.
- Soporta **Modo Infinito Progresivo** (resuelves un `5×5`, luego `8×8`, luego `10×10` encadenados). Eje: `logic`.

#### C.3 `logicseq2d` — Series, Analogías y Silogismos (`src/games/intel/logicSeqEngine.ts` + `src/games/LogicSeq2DGame.ts`)
- Generador parametrizado + banco curado de desarrollo de pensamiento lógico y crítico con 4 tipos de reto alternados (o filtrables en Práctica):
  1. **Sucesiones Numéricas y Operadores:** progresiones de 2º orden, Fibonacci generalizado, alternancias dobles y multiplicativas (con regla generada algorítmicamente y verificada).
  2. **Analogías Estructurales / Verbales:** relación `A es a B como C es a ?` (relación causa-efecto, parte-todo, opuesto, jerarquía, función).
  3. **Silogismos y Lógica Formal:** premisas tipo *"Todos los X son Y; ningún Y es Z; luego..."* evaluando qué conclusión es necesariamente verdadera vs falsa o indeterminada (con diagrama lógico de Venn en SVG al explicar!).
  4. **Sesgos Cognitivos y Pensamiento Crítico:** escenarios breves cotidianos para identificar falacias o errores de probabilidad (falacia del jugador, sesgo de confirmación, correlación vs causalidad, tasa base).
- Cada respuesta muestra explicación concisa de la regla o diagrama SVG. Soporta **Modo Infinito Progresivo** (sube complejidad de las reglas). Eje: `logic`.

#### C.4 `memorypath2d` — Palacio Mental y Memoria Asociativa (`src/games/intel/memoryPathEngine.ts` + `src/games/MemoryPath2DGame.ts`)
- Entrena memoria episódica, asociación concepto-posición y resistencia a la interferencia:
  - Fase 1 (**Codificar**): aparecen $N$ tarjetas (de 3 a 9 pares) en ubicaciones de un tablero/mapa con un icono SVG + número/palabra clave; tienes botón **`Ya lo memoricé`** (o cuenta atrás en Reto).
  - Fase 2 (**Interferencia breve**, niveles medios/altos): 1 pregunta rápida de cálculo o Stroop para evitar la repetición mecánica de memoria ecoica y entrenar retención real.
  - Fase 3 (**Evocar**): reconstruye qué símbolo iba en qué casilla o en qué orden exacto. En Práctica enseña trucos mnemotécnicos (agrupación espacial o historia breve).
- Soporta **Modo Infinito Progresivo** (sube de 3 a 10 elementos y agrega interferencia). Eje: `logic`.

#### C.5 Soporte de Infinito y Progresivo en juegos existentes (`omni-arena`)
Actualizar `catalog.ts` (`supportsInfinite: true`) y soportar `ctx.infiniteMode` + `ctx.difficulty === 'progressive'` en los **18 juegos de `CIRCUIT_IDS`** + las academias IQ escalables:
- **7 juegos ya naturalmente sin reloj (`Runner3DGame`, `OrbitBreaker3DGame`, `SkyVault3DGame`, `FlightPortals3DGame`, `BulletHell2DGame`, `BlitzStacker2DGame`, `TwinStick2DGame`):** en Reto estándar ya corren sin reloj hasta `0` escudos; con `infiniteMode` agregan el botón **`Finalizar y puntuar`** (con umbral mínimo 20 s / 3 eventos) y con `progressive` aceleran su intensidad progresivamente.
- **11 juegos cronometrados (`Aim3DGame`, `Rhythm2DGame`, `SonicRing2DGame`, `FlashParry2DGame`, `PuzzleMatrix2DGame`, `SchulteGrid2DGame`, `DualNBack2DGame`, `LaserTrack2DGame`, `MemoryGrid2DGame`, `NeonSnake2DGame`, `PrecisionTarget2DGame`):** cuando `ctx.infiniteMode === true`, anulan el tope `standaloneDuration` (`timeLeftSec: null`) y continúan generando rondas/oleadas escalando en dificultad hasta agotar escudos o pulsar `Finalizar y puntuar`.
- **`SudokuGuide2DGame` (`sudoku2d`) en `infiniteMode`:** al completar un tablero encadena automáticamente el siguiente escalando `4×4 → 6×6 → 9×9` con nuevo seed; además usa `ctx.damage(1)` contra los escudos del `GameShell` en lugar del límite fijo de 3 errores (que se mantiene en Reto estándar de 1 tablero).
- **`RavenMatrix2DGame` (`raven2d`) en `infiniteMode`:** elimina el límite de 12 matrices y el cronómetro por matriz (`timeLeftSec: null`), escala reglas del nivel 1 al 4 y los errores llaman a `ctx.damage(1)` hasta quedar en 0 escudos o pulsar `Finalizar y puntuar`.

---

### Bloque D — Calma y SOS Ataque de Pánico (`omni-life`)

#### D.1 Acceso universal inmediato a SOS Pánico
- En `omni-life/src/main.ts` (cabecera superior junto al tema) y en `directorio/src/main.ts` (tarjeta destacada / botón rápido de cabecera): añadir botón **`SOS Calma`** (`#calm?sos=1` o `#calm` abriendo directamente en modo SOS). Un clic lleva directo a la respiración sin pasar por menús.
- Al abrir `#calm?sos=1` o pulsar **`SOS Pánico Ahora`** dentro de `CalmView.ts`:
  - Se activa un modo limpio a pantalla enfocada (`al-sos-stage`), con tipografía grande, contraste suave anti-deslumbramiento y **cero formularios**.
  - Mensaje fijo amable en la parte superior: *"Estás a salvo. Es una descarga temporal de adrenalina: va a bajar sola en pocos minutos. No tienes que hacer nada rápido."*

#### D.2 Herramientas interactivas dentro de `CalmView.ts` + `VoiceStudio.ts`
Mantener los 3 patrones actuales (`4-7-8`, `Caja 4-4-4-4`, `Suspiro fisiológico`) y el diario de reencuadre (en una pestaña/sección aparte *Reencuadre tranquilo* para después de la crisis), agregando 4 recursos clave para pánico agudo:
1. **Respiración de Emergencia Anti-Hiperventilación:** modo nuevo **`Exhalar Largo (3-6)`** y **`Coherencia (5.5-5.5)`**, con círculo visual grande, vibración suave opcional en móvil (`navigator.vibrate?.(...)` si existe) y guía de audio opcional.
2. **Paisaje Sonoro Generativo en `VoiceStudio.ts`:** sin archivos externos:
   - Interruptores claros de sonido ambiente mezclable: **`Lluvia suave (ruido marrón filtrado)`**, **`Pulso cardíaco calmante (84 → 60 BPM)`** (baja el ritmo gradualmente durante 3 minutos para arrastrar el ritmo fisiológico), y **`Nota cálida continua`**.
3. **Aterrizaje Sensorial 5-4-3-2-1 Interactivo (tocable):** en vez de un solo párrafo estático, muestra 5 bloques con casillas tocables: *5 cosas que ves* `[1][2][3][4][5]`, *4 que tocas*, *3 que oyes*, *2 que hueles*, *1 que saboreas o trago de agua*. Tocar cada círculo da una confirmación suave y avanza sin obligar a teclear.
4. **Relajación Muscular Progresiva (PMR) + Tarjetas Breves de Realidad:** guía automática por grupo muscular (*Manos y puños → Hombros → Mandíbula → Frente → Abdomen → Piernas*, "Tensa 4 s" → "Suelta por completo 8 s") + botón `Siguiente frase de anclaje` con verdades cortas para cortar pensamientos catastróficos.

---

### Bloque E — Taller de Dibujo Guiado y Canto Ampliado (`omni-life`)

#### E.1 Nuevo módulo `DrawingView.ts` (`#drawing`) + `src/data/DrawingBank.ts`
- Registrado en `types.ts` (`ModuleId` incluye `'drawing'`, `HabitKey` incluye `'drawing'`), `LifeStore.ts` (`stats.drawingSheets`, `modulePrefs.drawing`), `main.ts` (botón `Dibujo` en navegación), `HomeView.ts` (tarjeta `mod-drawing` en Atelier) y `Icons.ts`.
- **Interfaz directa al grano:** barra superior compacta con 2 modos principales claros: **`Lecciones Guiadas`** y **`Lienzo Libre`**.
- **5 bloques de lecciones guiadas progresivas (20 láminas prácticas en total):**
  1. *Control de trazo y pulso:* líneas rectas entre 2 puntos (superposición fantasma para medir rectitud/precisión), círculos y elipses continuas en 1 trazo, curvas en S y paralelas.
  2. *Formas 3D y Perspectiva:* cubo en 1 punto de fuga (con líneas de fuga hacia el horizonte activables), edificio/caja en 2 puntos de fuga, cilindro y cono con elipses de corte.
  3. *Luz, Volumen y Achurado:* degradado tonal con achurado paralelo y cruzado, esfera iluminada (luz, medio tono, sombra propia, reflejo y sombra proyectada).
  4. *Proporciones y Figura:* canon simple de rostro frontal y perfil (ejes oculares y tercios), figura humana en bloque de muñeco articulado, mano simplificada en bloques y bodegón básico (taza/botella).
  5. *Composición y Simetría:* patrones geométricos y boceto rápido.
- **Herramientas claras del lienzo:**
  - Pincel con variación suave por velocidad/presión (`PointerEvent.pressure` si hay lápiz/stylus!), Goma de borrar, Regla/Línea recta asistida, **Simetría Espejo (vertical / radial 4×)**, **Cuadrícula / Guías de perspectiva (1 o 2 puntos de fuga arrastrables)**, Mostrar/Ocultar plantilla fantasma, Selector de color (8 tonos incluyendo lápiz grafito, sepia, azul boceto y tinta), Grosor y Opacidad, **Deshacer / Rehacer (pila de 30 trazos)**, **Evaluar lámina** (mide cobertura y cercanía a guía o guarda hoja completada en `LifeStore`) y **Descargar PNG**.

#### E.2 Ampliación de Canto (`SingingView.ts` + `SingingBank.ts` + `VoiceStudio.ts`)
- **Calentamiento Guiado Automático (5 minutos en cadena):** nuevo botón **`Iniciar calentamiento guiado`** que encadena automáticamente 5 pasos con reloj y progreso visual (*1. Respiración 4-4-6 → 2. Zumbido Mmmm → 3. Trino de labios Brrr → 4. Sirena suave → 5. Escala de 5 notas*), reproduciendo las notas guía antes de cada paso y mostrando el afinador en vivo.
- **Ampliación de repertorio (`SINGING_SONGS` de 5 a 15 canciones reales de dominio público):** sumar piezas de distintos registros y estilos (*Cielito Lindo*, *La Bamba (melodía)*, *Noche de Paz*, *Scarborough Fair*, *Greensleeves*, *Para Elisa (adaptación vocal)*, *Minueto en Sol*, *Ojos Azules / Folk Andino*, *Bella Ciao (tradicional)*, *Auld Lang Syne*).
- **Controles claros en Karaoke:**
  - Selector de **Velocidad (`0.75× Lento`, `1.0× Normal`, `1.15× Ágil`)**.
  - Interruptor **`Acompañamiento de acordes`**: mientras cantas, además de la nota guía opcional, el piano toca suavemente el acorde armónico de fondo para entrenar afinación dentro de una armonía real!
  - Conteo previo visible (`3 · 2 · 1 · ¡Canta!`) antes de la primera nota para evitar entrar tarde.
- **Nuevos ejercicios en Rutinas y Oído:**
  - **Estabilidad de Vocales (A-E-I-O-U)** y **Entrenamiento de Saltos Cantados**: el sistema toca 2 notas (ej. Do4 → Sol4) y verifica en vivo con el micrófono que tu voz alcance y sostenga ambos tonos dentro de la tolerancia.
  - En pestaña *Oído*: añadir selector de dificultad (3 intervalos básicos vs los 12 intervalos cromáticos + acordes Mayor, Menor y Séptima).

---

### Bloque F — Integración en Directorio, Contadores y Service Workers (`directorio`, `omni-life`, `omni-arena`)

1. **Contadores reales de OMNI ARENA:**
   - En `omni-arena/src/catalog.ts`: `ACADEMY_IDS` sube de 8 a **15** (`chess2d`, `checkers2d`, `poker2d`, `rubik3d`, `piano2d`, `drums2d`, `strings2d`, `band2d`, `raven2d`, `sudoku2d`, `hanoi2d`, `spatial3d`, `nonogram2d`, `logicseq2d`, `memorypath2d`). Total = **33 disciplinas** (`15 academias + 13 destreza2d + 5 action3d`).
   - En `omni-arena/src/state/ProfileStore.ts`: `publishCatalogMetadata()` ya calcula y escribe automáticamente `total: 33, academies: 15` en `omni_arena_catalog_meta_v1`.
   - En `directorio/src/state/DirectoryStore.ts` y `omni-life/src/services/UmbralBridge.ts`: actualizar `DEFAULT_ARENA_META` a `{ total: 33, academies: 15, dexterity2d: 13, action3d: 5 }`.
2. **Nuevos accesos en Directorio (`directorio` y `HomeView` de `omni-life`):**
   - Añadir tarjeta `mod-drawing` (**Taller de Dibujo**, categoría `atelier`, ruta `#drawing`, color `#B45309` / `#F59E0B`, icono de paleta/lápiz) en `DEFAULT_DIRECTORY_ORDER` justo después de `mod-calligraphy`.
   - Añadir acceso rápido **`SOS Pánico`** visible en la cabecera de `omni-life` y en la barra superior / tarjeta destacada de `directorio` (enlace directo a `resolveEcoUrl('atelier', { hash: 'calm?sos=1' })` o `#calm?sos=1`).
   - Actualizar subtítulo dinámico de `mod-singing` en `directorio/src/main.ts` y `omni-life/src/views/HomeView.ts` (ej. `"Canto, 15 canciones, piano y oído"`).
3. **Persistencia Supabase y migración segura:**
   - `LifeStore.ts` normaliza nuevos campos (`todayHabits.drawing`, `stats.drawingSheets`, `modulePrefs.drawing`) con defaults seguros para perfiles previos de Supabase o `localStorage`.
   - `ProfileStore.ts` en `omni-arena` normaliza nuevos `GameModeId` en `bestScores`/`playCounts` usando `createZeroModeMap()` (ya lo hace dinámicamente sobre `Object.keys(GAME_CATALOG)`!) y soporta `settings.difficulty === 'progressive'` y `settings.infiniteModeDefault?: boolean`.
4. **Service Workers:** incrementar versiones de caché en los 3 repos (`omni-arena-v5 → v6`, `atelier-diario-v6 → v7`, `directorio-ecosistema-v4 → v5`).

---

## 5. Qué queda al constructor (Planificación y Verificación)

1. Implementar siguiendo el plan por bloques (**A → B + C + D + E → F**), respetando `inherit-legacy-style` y regla de cero emojis en UI.
2. Agregar pruebas unitarias en `omni-arena/tests/` (`node --test`) para todos los nuevos motores puros (`drumsBank`, `stringsBank`, `bandBank`, expansión de `pianoBank`, `spatial3dEngine`, `nonogramEngine`, `logicSeqEngine`, `memoryPathEngine`, y `DifficultyId` `'progressive'` / `infiniteMode`) y en `omni-life` para `DrawingBank`, `SingingBank` y normalización de `LifeStore`.
3. Ejecutar `npm run build` (`tsc && vite build`) y `node --test` en cada repositorio modificado, verificando además en navegador las vistas clave en PC y móvil (modo Día/Noche, Dibujo, SOS Pánico, Canto, Piano/Batería/Guitarra-Bajo/Ensamble, IQ 3D/2D y Directorio).
4. Actualizar la documentación (`omni-arena/README.md`, `omni-life/PRODUCT.md`, `omni-life/README.md`) con los nuevos conteos y módulos reales al cierre.
