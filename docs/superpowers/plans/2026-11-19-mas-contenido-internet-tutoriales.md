# Plan de Implementación: Dibujo Conectado a Internet, Contenido Masivo y Tutoriales en Todo el Ecosistema

**Diseño base:** [2026-11-19-mas-contenido-internet-dibujo-musica-design.md](file:///C:/Users/Joseph/.gemini/antigravity/scratch/omni-arena/docs/superpowers/specs/2026-11-19-mas-contenido-internet-dibujo-musica-design.md)
**Repositorios:** `omni-life`, `omni-arena` y `directorio` (rama `main`, autor `TpdeaX <personaljosephunu@gmail.com>`).

---

## Global Constraints

1. **Sin emojis visuales en UI ni datos de juegos:** 0 coincidencias de `\p{Extended_Pictographic}` en `src/` de `omni-life` (salvo `SavedVaultBank.ts`), `omni-arena` y `directorio`. Solo SVG monolineal `stroke="currentColor"`.
2. **Estética existente (`inherit-legacy-style`):** reutilizar clases/variables CSS actuales (`.al-panel`, `.al-btn`, `.oa-academy-card`, `.oa-btn`, `.dir-card`), diseño ultra-intuitivo directo al grano, texto en español claro.
3. **Zero-Taint PNG & XSS-Safe:** las referencias de Internet nunca se pintan sobre `<canvas>` exportable; se sanitiza texto de API con parser puro (sin `document`/`innerHTML` para compatibilidad con `node --test`) y se escapa HTML con `esc()`. Solo URLs `https:` en API y lista blanca (`https:|http:|blob:|data:image/`) en entrada manual.
4. **Propiedad disjunta por trabajador en Swarm:** ningún archivo es editado por dos trabajadores en paralelo; los contratos compartidos (`TutorialBanner.ts` en `omni-life` y `AcademyKit.ts` en `omni-arena`) se fijan abajo literalmente y los productores los publican primero.
5. **Verificación obligatoria antes de cerrar:** `npx tsc --noEmit`, `node --test tests/*.test.ts`, `npm run build` en los 3 repos, barrido anti-emoji y prueba real en navegador headless (Playwright) con 0 `console.error` y 0 `pageerror`.

---

## Shared Interfaces (Contratos Exactos)

### A. `omni-life/src/ui/TutorialBanner.ts` (creado por `draw-net` como hito inicial)
```ts
export interface SectionTutorialSpec {
  id: string;        // ej: 'drawing:reference', 'singing:songs'
  moduleName: string;
  sectionName: string;
  summary: string;
  steps: string[];
  tip?: string;
}

export function renderTutorialBanner(spec: SectionTutorialSpec): string;
export function bindTutorialBanners(root: HTMLElement): void;
```
- Renderiza una franja compacta colapsable `.al-tutorial-box` con botón `Tutorial` / `Ocultar tutorial`, pasos numerados (`1..4`) y consejo práctico; guarda estado abierto/cerrado por `spec.id` en `sessionStorage` (cerrado por defecto salvo apertura explícita, o abierto en primera visita de esa clave según `data-tut-open`) para no recargar visualmente y quedar a 1 clic en toda sección.

### B. `omni-arena/src/ui/AcademyKit.ts` (ampliado por `arena-intel-guides` como hito inicial)
```ts
export interface SectionTutorialInfo {
  id: string;        // ej: 'piano:melodies', 'chess:tactics'
  sectionName: string;
  steps: string[];
  tip?: string;
}

export function createSectionTutorialEl(info: SectionTutorialInfo): HTMLElement;
```
- Devuelve una tarjeta/franja `.oa-sec-tutorial` colapsable con botón `Tutorial sección`, resumen breve, pasos numerados y truco pro, lista para montarse encima o al inicio del `sideEl`/`stageEl` en cualquiera de las 15 academias sin romper tests ni estilos.

### C. `omni-life/src/services/OnlineApi.ts` (ampliado por `draw-net`)
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
  pageUrl: string;
}

export interface DrawingReferenceSearchResult {
  items: DrawingReferenceItem[];
  errors: Partial<Record<'wikimedia' | 'cleveland', string>>;
}

export function stripHtmlSafe(raw: string): string;
export function sanitizeApiImageUrl(url: string): string;
export function sanitizeManualImageUrl(url: string): string;
export function parseWikimediaSearchPayload(json: unknown): DrawingReferenceItem[];
export function parseClevelandSearchPayload(json: unknown): DrawingReferenceItem[];
export async function searchDrawingReferences(
  query: string,
  source?: DrawingRefSourceFilter
): Promise<DrawingReferenceSearchResult>;
```

---

## Mapa de Ejecución y Archivos por Worker

### Worker 1: `draw-net` (`omni-life` — Dibujo Internet + Calco + `DrawingBank` 56 láminas + CSS compartido)
**Archivos propios exclusivos:**
- `omni-life/src/ui/TutorialBanner.ts` (CREAR PRIMERO + avisar `@all [contract-ready: TutorialBanner]`)
- `omni-life/src/style.css` (agregar `.al-tutorial-*`, `.al-drawing-stage-grid`, `.al-drawing-ref-*`, `.al-drawing-ref-bg`, media query `<960px` — hacer junto al contrato inicial o antes de terminar)
- `omni-life/src/services/OnlineApi.ts`
- `omni-life/src/data/DrawingBank.ts` (`20 -> 56` láminas: `trazos` 12, `perspectiva` 11, `luz` 11, `proporcion` 12, `composicion` 10; conservar las 4 originales al inicio de cada bloque; exportar `DRAWING_TOPIC_CHIPS` de 12 temas)
- `omni-life/src/views/DrawingView.ts` (buscador Internet, chips, upload, pegar URL, `Lado a lado` / `Calco traslúcido` / `Ocultar` / `Quitar`, `Opacidad`, `B/N alto contraste`, `Espejo ref.`, `refImgStatus`, `searchSeq`, `resizeCanvas(this.strokes.length > 0)`, blur de inputs al `pointerdown`, PNG limpio, conteos dinámicos `${DRAWING_LESSONS.length}`, `renderTutorialBanner` por sección)
- `omni-life/tests/online-drawing-api.test.ts` (NUEVO, TDD)
- `omni-life/tests/drawing-bank.test.ts` (actualizar a 56 láminas `[12, 11, 11, 12, 10]` + `DRAWING_TOPIC_CHIPS`)

**Pasos TDD:**
1. Crear `TutorialBanner.ts` + CSS `.al-tutorial-*` / `.al-drawing-ref-*` y anunciar `@all`.
2. Escribir `omni-life/tests/online-drawing-api.test.ts` (verificando filtrado PDF/djvu, `image/tiff` sin `thumburl`, orden por `page.index`, `stripHtmlSafe`, URLs `https:` vs `javascript:/file:`) y actualizar `drawing-bank.test.ts` (`56` láminas). Confirmar fallo rojo inicial (`FAIL`).
3. Implementar parsers + `searchDrawingReferences` en `OnlineApi.ts` y ampliar `DrawingBank.ts` a 56 láminas + 12 chips.
4. Implementar barra de Referencias Internet / Calco y `TutorialBanner` en `DrawingView.ts`.
5. Correr `node --test tests/online-drawing-api.test.ts tests/drawing-bank.test.ts` y `npx tsc --noEmit`.

---

### Worker 2: `atelier-content` (`omni-life` — Bancos Masivos + Tutoriales en todos los módulos)
**Archivos propios exclusivos:**
- `omni-life/src/data/SingingBank.ts` (`15 -> 34` canciones con IDs/títulos inéditos, `15 -> 28` drills vocales)
- `omni-life/src/data/FocusLabBank.ts` (`5 -> 16` oratoria, `3 -> 10` dicción, `12 -> 44` flashcards reutilizando y ampliando decks claros)
- `omni-life/src/data/KnowledgeBank.ts` (`52 -> 80` ortografía con `'___'`, `10 -> 36` vocabulario, `46 -> 72` frases, `16 -> 28` clásicos Wikisource)
- `omni-life/src/data/CalmBank.ts` (`10 -> 20` tarjetas anti-pánico `PANIC_TRUTH_CARDS`)
- `omni-life/src/views/CalligraphyView.ts` (`12 -> 24` plantillas por modo = 96 total + `TutorialBanner`)
- `omni-life/src/views/TypingView.ts` (`PC_TEXTS` `20/20/14`, `MOBILE_PHRASES` `24/24`, `SPRINT_WORDS` `180+` + `TutorialBanner`)
- `omni-life/src/views/HomeView.ts`, `ReaderView.ts`, `StudioView.ts`, `LanguageView.ts`, `MindsetView.ts`, `VaultView.ts`, `FocusLabView.ts`, `SingingView.ts`, `CalmView.ts` (integrar `renderTutorialBanner` + `bindTutorialBanners` adaptado a cada módulo y sub-sección/tab activo, y actualizar textos fijos si citan números viejos)
- `omni-life/public/sw.js` (`atelier-diario-v7` → `atelier-diario-v8`)
- `omni-life/tests/singing-bank.test.ts`, `omni-life/tests/calm-sos.test.ts`, `omni-life/tests/knowledge-focus-banks.test.ts` (NUEVO)

**Pasos TDD:**
1. Esperar aviso `[contract-ready: TutorialBanner]` (mientras tanto ampliar `SingingBank.ts`, `FocusLabBank.ts`, `KnowledgeBank.ts`, `CalmBank.ts`).
2. Escribir `omni-life/tests/knowledge-focus-banks.test.ts` y actualizar `singing-bank.test.ts` (`34` canciones, `28` drills) + `calm-sos.test.ts` (`>= 20` tarjetas).
3. Integrar `TutorialBanner` por módulo y sección en las 11 vistas (`CalligraphyView`, `TypingView`, `HomeView`, `ReaderView`, `StudioView`, `LanguageView`, `MindsetView`, `VaultView`, `FocusLabView`, `SingingView`, `CalmView`).
4. Correr `npx tsc --noEmit`, `node --test tests/*.test.ts` y `npm run build` en `omni-life` (cuando `draw-net` también haya terminado).

---

### Worker 3: `arena-music` (`omni-arena` — Bancos Musicales Masivos + Tutoriales de Sección Musical)
**Archivos propios exclusivos:**
- `omni-arena/src/games/piano/pianoBank.ts` (`18 -> 42` melodías `14/14/14`, notas `48..72`, cues beat `0` + sufijos `''|'m'|'7'`; `5 -> 20` progresiones)
- `omni-arena/src/games/music/drumsBank.ts` (`12 -> 28` grooves con IDs/títulos inéditos avoiding `cumbia_classic`/`jazz_swing`/`blues_shuffle`; `4 -> 12` independencia)
- `omni-arena/src/games/music/stringsBank.ts` (`26 -> 40` acordes validando `fingers/frets/pcs`; `12 -> 32` canciones/riffs Guitarra `14`, Bajo `11`, Ukelele `7`, manteniendo `STRING_SONGS[1]` como `chords` y `chordPalette <= 4`; `6 -> 10` cajas de mástil)
- `omni-arena/src/games/music/bandBank.ts` (`8 -> 18` arreglos 4-pistas dentro de rangos UI estrictos: `melody: 60..79`, `chords[0]: 48..72`, `bass: 28..50`, `bars * 4` beats exactos)
- `omni-arena/src/games/PianoEar2DGame.ts`, `DrumsAcademyGame.ts`, `StringsAcademyGame.ts`, `BandEnsembleGame.ts` (reemplazar textos fijos `18`/`12`/`8`/`5` por longitudes reales dinámicas e integrar `createSectionTutorialEl` en cada sub-pestaña/sección de los 4 instrumentos)
- `omni-arena/tests/music-academies.test.ts`, `omni-arena/tests/rubik-piano.test.ts`

**Pasos TDD:**
1. Esperar aviso `[contract-ready: AcademyKit]` de `arena-intel-guides` mientras se expanden los 4 bancos musicales.
2. Actualizar `music-academies.test.ts` y `rubik-piano.test.ts` con los nuevos conteos (`42` melodías `14/14/14`, `20` progresiones, `28` grooves, `12` independencia, `40+` acordes, `32` canciones cuerdas `14/11/7`, `18` banda con validación estricta de rangos MIDI UI `melody 60..79`, `chords[0] 48..72`, `bass 28..50`).
3. Cablear conteos dinámicos y `createSectionTutorialEl` en los 4 juegos musicales.

---

### Worker 4: `arena-intel-guides` (`omni-arena` + `directorio` — IQ/Tablero Masivo + Tutoriales por Juego, Hub, Sección y Directorio)
**Archivos propios exclusivos:**
- `omni-arena/src/ui/AcademyKit.ts` (PRIMERO: añadir `SectionTutorialInfo` y `createSectionTutorialEl` + CSS en `omni-arena/src/style.css` y anunciar `@all [contract-ready: AcademyKit]`)
- `omni-arena/src/style.css` (`.oa-sec-tutorial*`, `.oa-hub-tutorial*`, `.oa-guide-sections*`)
- `omni-arena/src/games/intel/logicSeqEngine.ts` (`ANALOGY_BANK` `18 -> 72+`, `BIAS_BANK` `16 -> 48+`, `DOMAIN_TRIPLES` `8 -> 20+`, + nuevas plantillas de silogismo: `150+` ítems curados)
- `omni-arena/src/games/chess/chessEngine.ts` (`5 -> 10` lecciones tácticas guiadas)
- `omni-arena/src/games/checkers/checkersEngine.ts` (`4 -> 8` lecciones tácticas guiadas)
- Las 11 academias de tablero/IQ (`ChessAcademyGame.ts`, `CheckersAcademyGame.ts`, `PokerAcademyGame.ts`, `RubikCube3DGame.ts`, `RavenMatrix2DGame.ts`, `SudokuGuide2DGame.ts`, `HanoiLogic2DGame.ts`, `SpatialRotation3DGame.ts`, `NonogramLogic2DGame.ts`, `LogicSeq2DGame.ts`, `MemoryPath2DGame.ts`) → integrar `createSectionTutorialEl` por pestaña/sección activa
- `omni-arena/src/types.ts`, `omni-arena/src/catalog.ts`, `omni-arena/src/ui/GuideOverlay.ts`, `omni-arena/src/ui/HubView.ts`:
  - Sincronizar todos los textos del catálogo con las nuevas cifras (`42 piezas`, `28 ritmos`, `32 canciones`, `18 bases`, `10 tácticas`, etc.).
  - Añadir `sectionTutorials?: { name: string; tip: string }[]` en `GameGuideSpec` y mostrarlo dentro de `GuideOverlay.ts` en todas las academias/juegos multisector + ampliar pasos en `howToPlay`.
  - Añadir botón **"Tutorial del Hub"** y modal explicativo en `HubView.ts` (Circuitos vs 15 Academias vs 5 Ejes vs 5 Dificultades vs Modo Infinito).
- `omni-arena/public/sw.js` (`omni-arena-v6` → `omni-arena-v7`)
- `omni-arena/tests/intel-games.test.ts`, `omni-arena/tests/board-games.test.ts`, `omni-arena/tests/catalog-guides.test.ts` (NUEVO: verifica los 35 items del catálogo, `howToPlay >= 3`, controles, frames, 0 emojis)
- `directorio/src/main.ts`, `directorio/src/style.css`, `directorio/public/sw.js` (`v5` → `v6`):
  - Añadir tarjeta colapsable **"Tutorial del Ecosistema (Cómo usar todo)"** en 4 pasos y actualizar subtítulos numéricos de tiles (`56+ láminas y refs de Internet`, `96 plantillas guiadas`, `80+ reglas y glosario`, `34+ canciones, piano y oído`).

---

### Worker 5: `qa-verifier` (QA Cruzado Final + Playwright End-to-End en Vivo)
- Ejecutado una vez que `draw-net`, `atelier-content`, `arena-music`, `arena-intel-guides` posteen `[done]`.
- Corre en los 3 repositorios:
  1. `npx tsc --noEmit`
  2. `node --test tests/*.test.ts`
  3. `npm run build`
  4. Escaneo Node `\p{Extended_Pictographic}` en `src/` de los 3 proyectos (`0` coincidencias salvo `SavedVaultBank.ts`).
  5. Servidores `vite preview` + **Playwright headless**:
     - Abrir `omni-life`, navegar por Módulos principales + abrir `Tutorial`, abrir `Dibujo`, probar chips de Internet (`Wikimedia`/`Cleveland`), activar `Lado a lado` / `Calco traslúcido` / `Alto contraste B/N` / `Espejo ref.`, hacer trazos y verificar descarga PNG limpia y `Ctrl+Z` tras usar input.
     - Abrir `omni-arena`, probar **"Tutorial del Hub"**, abrir `Guía` de un juego arcade y de una academia, abrir una academia musical (`piano2d`/`strings2d`/`band2d`) e IQ (`logicseq2d`/`spatial3d`) y comprobar `createSectionTutorialEl`, selectores de canciones ampliadas y cambio de dificultad.
     - Abrir `directorio`, verificar métricas actualizadas y **Tutorial del Ecosistema**.
     - Confirmar **0 `console.error`**, **0 `pageerror`**, **0 `status >= 500`**.

---

## Execution Handoff

Plan listo y validado contra las reglas de no solapamiento de archivos. Siguiente paso inmediato: inicializar Swarm, limpiar el `monitor` anterior, lanzar los 4 trabajadores en paralelo (`draw-net`, `atelier-content`, `arena-music`, `arena-intel-guides`) + `monitor`, supervisar hitos de contratos y cerrar con `qa-verifier`.
