# Diseño: Más Contenido — Dibujo Conectado a Internet + Studio de Calco + Expansión Música e Intelecto

**Fecha:** 2026-11-19
**Repositorios afectados:** `omni-life` (`Atelier Diario`) y `omni-arena` (`Omni-Arena`)
**Rama / Identidad Git:** `main` · `TpdeaX <personaljosephunu@gmail.com>` (sin push automático hasta que el usuario lo pida)

---

## 1. Objetivo

Multiplicar de forma masiva el contenido práctico y creativo del ecosistema, atacando dos frentes clave:
1. **Estudio de Dibujo conectado a Internet (`omni-life`):** permitir buscar cualquier referencia real de internet en segundos (anatomía, rostros, animales, paisajes, arquitectura, obras de museo clásicas), subir fotos propias o pegar una URL, y trabajar con ella **lado a lado** o como **fondo traslúcido para calcar** sin contaminar ni romper la descarga PNG.
2. **Expansión masiva de bancos curados (`omni-life` y `omni-arena`):** más del doble de lecciones guiadas de dibujo, canciones de canto, melodías y progresiones de piano, ritmos de batería, acordes/riffs de cuerdas, temas de banda multi-pista, oratoria/dicción, flashcards/léxico y bancos de lógica/sesgos en IQ.

---

## 2. Arquitectura — Dibujo Conectado a Internet y Calco (`omni-life`)

### 2.1. Fuentes de Internet Verificadas (`src/services/OnlineApi.ts`)

Tras pruebas en vivo con navegador/CORS, se integran dos APIs abiertas sin API key ni CAPTCHA:
- **Wikimedia Commons API (`commons.wikimedia.org/w/api.php`)** con `origin=*`:
  - `action=query&generator=search&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=960&format=json&origin=*`
  - Ordenar `Object.values(query.pages)` por `page.index` para conservar el ranking de relevancia.
  - Filtrar MIME estrictamente: aceptar `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml` e `image/tiff` **solo si existe `info.thumburl`** para `image/tiff` (los navegadores no renderizan `.tiff` nativo en `<img>`; si falta `thumburl` se descarta el ítem). Rechazar PDFs, audio, video y `.djvu`.
- **Cleveland Museum of Art Open Access CC0 (`openaccess-api.clevelandart.org/api/artworks/?q=...&has_image=1&cc0=1&limit=12`)**:
  - Devueltas obras en dominio público `CC0` con `images.web.url` (descartando ítems sin URL válida), título, creador(es) (o `'Artista anónimo'` si `creators` viene vacío), técnica y ficha del museo (`share_license_status ?? 'CC0'`).
- **Fuentes descartadas explícitamente:** `api.artic.edu` (Cloudflare anti-bot) y Met Museum `v1` (retirada).

**Contratos e invariantes de red/sanitización:**
```ts
export type DrawingRefSourceFilter = 'all' | 'wikimedia' | 'cleveland';

export interface DrawingReferenceItem {
  id: string;
  source: 'wikimedia' | 'cleveland';
  title: string;
  artist: string;
  license: string;
  thumbUrl: string;
  fullUrl: string;
  pageUrl: string; // '' si no hay enlace https seguro
}

export interface DrawingReferenceSearchResult {
  items: DrawingReferenceItem[];
  errors: Partial<Record<'wikimedia' | 'cleveland', string>>;
}

export async function searchDrawingReferences(
  query: string,
  source?: DrawingRefSourceFilter
): Promise<DrawingReferenceSearchResult>;
```
- **Parsers puros sin DOM (`node --test` seguro + XSS seguro):** añadir un sanitizador de HTML por cadenas/entidades puras (sin `document.createElement` ni `innerHTML`, para no disparar precargas en navegador y correr directo en Node). Escapar todo texto/URL al renderizar mediante un helper `esc()` en `DrawingView.ts`.
- **Validación estricta de URLs:**
  - Desde API: aceptar solo protocolo `https:`.
  - Desde entrada manual `Pegar URL`: permitir únicamente `https:`, `http:`, `blob:`, o `^data:image\/(png|jpeg|jpg|webp|gif|bmp|avif|svg\+xml)(?:;charset=[^;,]+)?(?:;base64)?,/i`.
  - Desde `Subir foto`: validar `file.type.startsWith('image/')` (cuando exista) y usar `URL.createObjectURL(file)`, revocando URLs anteriores al reemplazar, quitar referencia o desmontar la vista.
  - Todas las `<img>` externas llevarán `referrerpolicy="no-referrer"` y **nunca** `crossOrigin="anonymous"` (para evitar bloqueos de visualización en URLs sin cabecera CORS).
- **Resiliencia y carrera de búsquedas:** consulta paralela con `Promise.allSettled` + `AbortController` (`8000ms` timeout). En `DrawingView`, mantener contador `searchSeq` y comprobar `this.container && seq === this.searchSeq` antes de pintar resultados.

### 2.2. UI Directa al Grano y Decisiones de Estado (`DrawingView.ts` + `style.css`)

Siguiendo la estética de `Atelier Diario` (`inherit-legacy-style`, SVG monolineal `stroke="currentColor"`, cero emojis):
- **Integración con Lecciones Guiadas (`[DECIDIDO]`):**
  - El panel colapsable **"Referencias de Internet / Calco"** convive con ambos modos (`Lecciones Guiadas` y `Lienzo Libre`) sin borrar `this.strokes` al buscar ni cambiar foto.
  - Cuando hay una referencia cargada en modo `Calco traslúcido` (imagen lista), la plantilla fantasma de la lección (`drawLessonGuide`) se suprime automáticamente para no encimar líneas sobre la foto; y al pulsar `Evaluar y guardar` con referencia activa, se guarda como lámina de estudio libre (`recordDrawingSheet`) sin penalizar contra los checkpoints ocultos de la lección.
- **Estado transitorio en `DrawingView` (`[DECIDIDO]`):**
  - El estado de referencia (`activeRef`, `refViewMode`, `refOpacity`, `refHighContrast`, `refMirror`, `refImgStatus`, resultados y búsqueda) vive en memoria sobre el singleton `DrawingView` — igual que `ReaderView` y `StudioView` — conservándose al navegar entre módulos sin inflar `localStorage` ni `CloudSync` con imágenes `data:`/`blob:`, y manteniendo intactos los 8 campos de `ModulePreferences['drawing']` en `LifeStore.ts` / `atelier-core.test.ts`.
- **Controles rápidos (directo al grano):**
  1. **Buscador libre** + botón `Buscar` (`Enter` también busca) + selector de fuente (`Todas`, `Wikimedia`, `Museo CC0`).
  2. **8 Chips de estudio inmediato:** `Manos y gestos` (`hand anatomy drawing sketch`), `Rostros y retratos` (`portrait drawing sketch`), `Cuerpo y poses` (`figure drawing anatomy`), `Animales` (`animal study drawing`), `Arquitectura` (`architectural perspective drawing`), `Cráneo y luces` (`human skull chiaroscuro`), `Botánica y flores` (`botanical illustration drawing`), `Escultura clásica` (`marble bust sculpture`).
  3. **Carga directa:** `Subir foto` (`input[type=file]`) y `Pegar URL`.
  4. **Controles sobre referencia activa:**
     - Vista: `Lado a lado` · `Calco traslúcido` · `Ocultar` · `Quitar`.
     - `Opacidad ref.` (`10%` – `90%`, habilitado en `Calco traslúcido`).
     - `Alto contraste B/N` (`filter: grayscale(1) contrast(1.45)`) y `Espejo ref.` (`scaleX(-1)`) — etiqueta distinta al control de pincel `Espejo`.
- **Corrección crítica de atajos (`Ctrl+Z` / `Ctrl+Y`):**
  - Al pulsar sobre `#al-drawing-canvas` (`pointerdown`), hacer `.blur()` en cualquier input activo dentro de `this.container`, y en `keyHandler` ignorar solo entradas de texto (`INPUT` distinto de `range`, `TEXTAREA`, `SELECT`), restaurando `Ctrl+Z` / `Ctrl+Y` tras usar búsqueda o sliders.

### 2.3. Capas, Aspect Ratio y Zero-Taint PNG (`DrawingView.ts` + `style.css`)

- **CSS de capas:** `.al-drawing-stage-wrap` tendrá `position: relative`; `.al-drawing-ref-bg` irá en `position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; z-index: 1`; `#al-drawing-canvas` en `position: relative; z-index: 2; background: transparent`. En móvil (`<960px`), `.al-drawing-stage-grid` pasa a 1 columna con altura acotada de la referencia lateral.
- **Fallback sólido ante carga/error:** `DrawingView` rastrea `refImgStatus: 'idle' | 'loading' | 'ready' | 'error'` mediante eventos `load` / `error` de la `<img>`. `redraw()` ejecuta `g.clearRect(0, 0, w, h)` **únicamente** cuando `refViewMode === 'trace' && activeRef && refImgStatus === 'ready'`; en cualquier otro caso (cargando, error de red, oculto, lado a lado) pinta el papel sólido habitual (`g.fillRect(...)`) y muestra estado legible.
- **Consistencia de trazos al alternar `Lado a lado` ↔ `Calco traslúcido`:**
  - `render()` llamará a `this.resizeCanvas(this.strokes.length > 0)` (no `false`) para reescalar trazos si cambia el ancho del contenedor.
  - Al ajustar slider de opacidad, B/N o `Espejo ref.`, actualizar atributos/estilos DOM de `.al-drawing-ref-bg` directamente sin re-montar la `<img>` ni perder trazos.
- **`downloadPng()` Zero-Taint:** compone papel sólido + `this.strokeLayer` (nunca dibuja la `<img>` externa sobre canvas exportable), eliminando cualquier riesgo de `SecurityError` y confirmando al usuario que se exportaron sus trazos limpios.

---

## 3. Expansión Masiva de Bancos Curados

### 3.1. `omni-life` (`Atelier Diario`)

| Archivo | Antes | Objetivo | Detalle clave / Invariante |
|---|---|---|---|
| `src/data/DrawingBank.ts` | 20 láminas (4 × 5 bloques) | **48 láminas** (`trazos` 10, `perspectiva` 10, `luz` 9, `proporcion` 10, `composicion` 9) | Dentro de **cada bloque**, las 4 láminas originales permanecen al inicio en el mismo orden (`DRAWING_LESSONS[0].id === 'stroke-lines'` intacto). Nuevas láminas con `guideSvgPaths` válidos (`800×500`), `>= 4` `targetCheckpoints` y `tip` accionable. |
| `src/views/DrawingView.ts` | "20" fijo en líneas 78, 86, 120 | **Dinámico (`${DRAWING_LESSONS.length}`)** | Subtítulo, tab y contador de lámina reflejan el total real (`48`). |
| `src/data/SingingBank.ts` | 15 canciones, 15 drills | **30 canciones, 24 drills** | +15 canciones nuevas con `id` y título no repetidos (`>= 8` notas MIDI, `>= 2` acordes, sílabas en `lyric`) + 9 drills (cromático, saltos de 8ª, tríadas, staccato, legato, voz mixta, pentatónico, arpegio amplio, vibración labial). |
| `src/data/FocusLabBank.ts` | 5 oratoria, 3 dicción, 12 flashcards | **12 oratoria, 8 dicción, 32 flashcards** | Reusar decks existentes y agregar mazos claros y concisos (`FocusLabView` genera tabs por deck). |
| `src/data/KnowledgeBank.ts` | 52 ortografía, 10 vocabulario, 46 frases | **75 ortografía, 30 vocabulario, 64 frases** | Toda nueva `OrthographyQuestion.sentence` incluirá `'___'` y evitará `<`/`>` sin escapar en cadenas renderizadas en `LanguageView`. |

### 3.2. `omni-arena` (`Omni-Arena`)

| Archivo | Antes | Objetivo | Detalle clave / Invariante |
|---|---|---|---|
| `src/games/piano/pianoBank.ts` | 18 melodías, 5 progresiones | **36 melodías** (12 Inicial, 12 Intermedio, 12 Avanzado) + **16 progresiones** | `midi` dentro de `48..72`, `notes.length >= 10`, `chords.length >= 2` usando sufijos válidos (`''`/`'m'`/`'7'`) y acorde obligatorio en beat `0`. |
| `src/games/music/drumsBank.ts` | 12 grooves, 4 independencia | **24 grooves** + **10 independencia** | Nuevos grooves con IDs/títulos inéditos (evitando chocar con `cumbia_classic`, `jazz_swing`, `blues_shuffle`), carriles de longitud `steps` (`12` o `16`) sobre `DRUM_IDS`. Si algún patrón nuevo usa compás ternario/12 pasos, respetar el paso exacto sin romper el metrónomo de 4 tiempos (usar subdivisiones válidas en `16` pasos o adaptar metrónomo si corresponde). |
| `src/games/music/stringsBank.ts` | 26 acordes, 12 canciones/riffs | **38 acordes** + **28 canciones/riffs** (Guitarra 12, Bajo 10, Ukelele 6) | `fingers[i] === 0` cuando `frets[i] <= 0`; pitch classes en `shape.pcs`; toda canción de acordes con `chordPalette.length <= 4`; conservar `STRING_SONGS[1]` como `kind: 'chords'`. |
| `src/games/music/bandBank.ts` | 8 arreglos 4-pistas | **16 arreglos 4-pistas** | Respetar estrictamente rangos interactivos de `BandEnsembleGame.ts`: **melody `60..79`**, **chords[0] `48..72`**, **bass `28..50`**, **drums `DRUM_IDS`**, y suma exacta `bars * 4` beats por pista. |
| `src/games/intel/logicSeqEngine.ts` | 18 analogías, 16 sesgos, 8 ternas (42 ítems) + generadores | **130+ ítems curados únicos** (`ANALOGY_BANK` 65+, `BIAS_BANK` 40+, `DOMAIN_TRIPLES` 16+ + plantillas de silogismo) | Sin duplicar opciones en las 4 alternativas, sin emojis, con `hint` y `explanation` claros en español. |
| UI / Catálogo dinámico | Textos fijos (`18`, `12`, `8`) | **Dinámico o sincronizado** | Actualizar etiquetas/subtítulos en `PianoEar2DGame.ts`, `DrumsAcademyGame.ts`, `StringsAcademyGame.ts`, `BandEnsembleGame.ts` y `src/catalog.ts` con los nuevos totales reales. |

### 3.3. Caché PWA y Cobertura de Tests

- Bumps de `CACHE_NAME`:
  - `omni-life/public/sw.js`: `'atelier-diario-v7'` → `'atelier-diario-v8'`.
  - `omni-arena/public/sw.js`: `'omni-arena-v6'` → `'omni-arena-v7'`.
- Tests actualizados y nuevos:
  - `omni-life/tests/drawing-bank.test.ts`: validar 48 lecciones `[10, 10, 9, 10, 9]`, invariante de orden original por bloque (`DRAWING_LESSONS[0].id === 'stroke-lines'`), sintaxis SVG y checkpoints.
  - `omni-life/tests/singing-bank.test.ts`: validar 30 canciones y 24 `SINGING_DRILLS`.
  - Nuevos `omni-life/tests/online-drawing-api.test.ts` (parsers/sanitizadores Wikimedia & Cleveland en Node puro) y `omni-life/tests/knowledge-focus-banks.test.ts` (unicidad de IDs, presencia de `'___'` en ortografía, cero emojis, validez de `KnowledgeBank` + `FocusLabBank`).
  - `omni-arena/tests/music-academies.test.ts`, `rubik-piano.test.ts` y `intel-games.test.ts`: actualizar aserciones a 36 melodías (`12/12/12`), 16 progresiones, 24 grooves, 10 independencia, 38+ acordes, 28 canciones de cuerdas (`12/10/6`), 16 temas de banda dentro de rangos UI (`melody 60..79`, `bass 28..50`, `chords[0] 48..72`), más pruebas de expansión en `logicSeqEngine`.
  - Verificación final: `npx tsc --noEmit`, `node --test tests/*.test.ts`, `npm run build` en `omni-life` y `omni-arena`, más comprobación visual en navegador con Playwright (0 `console.error`, 0 `pageerror`).
