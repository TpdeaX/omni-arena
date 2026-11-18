# Plan de Implementación: Ecosistema Unificado + Intuitividad Anti-Mareo + Academias de Inteligencia y Música

- **Fecha:** 2026-11-18
- **Autor:** architect (`gemini-4-argon-high` / Opción A)
- **Especificación de diseño:** `docs/superpowers/specs/2026-11-18-ecosistema-unificado-academia-design.md`
- **Repositorios:**
  1. `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena` (puerto `5175`)
  2. `C:\Users\Joseph\.gemini\antigravity\scratch\omni-life` — Atelier Diario (puerto `5176`)
  3. `C:\Users\Joseph\.gemini\antigravity\scratch\UNUmbral` (puerto `5177`)
  4. `C:\Users\Joseph\.gemini\antigravity\scratch\directorio` (puerto `5178`)
- **Identidad Git obligatoria (proyecto personal):**
  - `git config user.name "TpdeaX"`
  - `git config user.email "personaljosephunu@gmail.com"`
  - Rama: `main` (NO hacer `git push` a menos que el coordinador o el usuario lo ordenen explícitamente).

---

## 1. Contratos Exactos de TypeScript (Congelados para los 5 Coders)

Todos los Coders de `omni-arena` (`coder-shell`, `coder-board`, `coder-rubik-piano`, `coder-intel`) deben programar contra estas interfaces exactas. **Ningún coder de juegos (`coder-board`, `coder-rubik-piano`, `coder-intel`) puede modificar `src/types.ts`, `src/catalog.ts`, `src/icons.ts`, `src/style.css`, `src/audio/SynthAudio.ts` ni `src/games/GauntletOrchestrator.ts`.**

### 1.1 `omni-arena/src/types.ts`

```ts
export type SkillAxis = 'aim' | 'rhythm' | 'logic' | 'reflex' | 'agility';

export type DifficultyId = 'chill' | 'standard' | 'hyper' | 'adaptive';

export type ThemeMode = 'day' | 'night';

export type GameCategory = 'academy' | 'dexterity2d' | 'action3d' | 'circuit';

export type HubTabId = 'academy' | 'dexterity2d' | 'action3d' | 'all';

export type GameModeId =
  | 'aim3d'
  | 'runner3d'
  | 'cube3d'
  | 'parkour3d'
  | 'flight3d'
  | 'rhythm2d'
  | 'bullet2d'
  | 'puzzle2d'
  | 'twinstick2d'
  | 'parry2d'
  | 'tetris2d'
  | 'memory2d'
  | 'snake2d'
  | 'sniper2d'
  | 'track2d'
  | 'schulte2d'
  | 'nback2d'
  | 'pulse2d'
  // Nuevas Academias (8)
  | 'chess2d'
  | 'checkers2d'
  | 'poker2d'
  | 'rubik3d'
  | 'piano2d'
  | 'raven2d'
  | 'sudoku2d'
  | 'hanoi2d'
  // Circuitos
  | 'gauntlet'
  | 'ranked';

export type StandaloneGameId = Exclude<GameModeId, 'gauntlet' | 'ranked'>;

export interface ControlHint {
  keys: string[];           // Etiquetas en PC, ej. ['Clic'] o ['U', 'D', 'L', 'R', 'F', 'B']
  touch: string;            // Etiqueta en móvil, ej. 'Toca pieza y casilla destino'
  action: string;           // Qué hace, ej. 'Mover pieza / capturar'
  tone?: 'default' | 'primary' | 'danger';
}

export interface GuideExampleFrame {
  svg: string;              // SVG inline (viewBox="0 0 320 180", sin emojis, usa variables CSS)
  caption: string;          // Explicación breve en español (1-2 líneas)
}

export interface GuideExampleSpec {
  frames: GuideExampleFrame[];
}

export interface GameGuideSpec {
  objective: string;        // 1-2 líneas (<= 140 caracteres)
  howToPlay: string[];      // 3 pasos cortos numerados
  controls: ControlHint[];  // Mapa de botones/teclas marcados
  example: GuideExampleSpec;// Ejemplo visual paso a paso
  practice: string;         // Qué ofrece Práctica Guiada en este modo
  challenge: string;        // Qué exige Modo Reto (Oficial) en este modo
}

export interface GameDescriptor {
  id: GameModeId;
  title: string;
  subtitle: string;
  dimension: '3D' | '2D' | '2D + 3D';
  category: GameCategory;
  axis: SkillAxis | 'all';
  accent: string;
  accentSoft: string;
  controlsPC: string;
  controlsTouch: string;
  description: string;
  keywords?: string[];
  guide: GameGuideSpec;
}

export interface UserSettings {
  volume: number; // 0..1
  muted: boolean;
  aimSensitivity: number; // 0.3..2.5
  touchControls: 'auto' | 'always' | 'off';
  screenShake: boolean;
  reduceMotion?: boolean;
  difficulty: DifficultyId;
  theme: ThemeMode;
  hubTab?: HubTabId;
  skipGuideFor?: Partial<Record<GameModeId, boolean>>;
}

export interface GameContext {
  container: HTMLElement;
  isTouch: boolean;
  practiceMode?: boolean;   // true = Práctica Guiada (sin perder vidas, pistas/deshacer activos)
  settings: UserSettings;
  difficulty: DifficultyId;
  getIntensity: () => number;
  setHud: (hud: Partial<HudState>) => void;
  setControls?: (controls: ControlHint[]) => void; // Actualiza la barra inferior fija de controles
  onOpenGuide?: () => void; // Abre la Ficha Previa Guiada en pausa
  damage: (amount?: number) => number;
  heal: (amount?: number) => void;
  addScore: (points: number, comboIncrement?: number) => void;
  breakCombo: () => void;
  finish: (metrics: Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'>) => void;
  toast: (text: string, tone?: 'good' | 'warn' | 'bad' | 'accent') => void;
}
```
*(El resto de interfaces `RunMetrics`, `RunRecord`, `PlayerProfile`, `HudState` y `MiniGame` mantienen todos sus campos actuales sin cambios).*

### 1.2 `omni-arena/src/audio/SynthAudio.ts` (Extensión Polifónica MIDI)

`coder-shell` añadirá estos métodos y tipos a `SynthAudio.ts` (conservando todos los métodos actuales):

```ts
export type InstrumentTimbre = 'piano' | 'organ' | 'soft' | 'bell';

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Métodos públicos nuevos en SynthAudioEngine (instancia exportada `synthAudio`):
public playMidiNote(midi: number, durationSec = 0.65, timbre: InstrumentTimbre = 'piano', whenOffset = 0): void;
public playChord(midis: number[], durationSec = 0.85, timbre: InstrumentTimbre = 'piano', arpeggioStepSec = 0): void;
public noteOn(id: string | number, midi: number, timbre: InstrumentTimbre = 'piano'): void;
public noteOff(id: string | number): void;
public stopAllNotes(): void;
```

- Límite de 12 voces simultáneas en `activeVoices: Map<string, { stop: () => void; startedAt: number }>` (si supera 12, libera la más antigua).
- `stopAllNotes()` se invoca automáticamente desde `GameShell` al pausar, abrir guía o destruir partida.

### 1.3 `omni-arena/src/icons.ts` (Iconos nuevos de un solo trazo, cero emojis)

`coder-shell` añadirá a `Icons` (todos `(s = 20) => string`):
- `chess`, `checkers`, `cards`, `rubik`, `piano`, `matrix`, `sudoku`, `hanoi` (para los 8 modos en `HubView.ts` y `catalog.ts`)
- `help`, `search`, `lightbulb`, `undo`, `eye`, `rotateCw`, `rotateCcw`, `arrowUp`, `arrowDown`, `arrowRight`, `closeX`, `bookOpen`, `graduation`

### 1.4 `omni-arena/src/ui/AcademyKit.ts` (Helper compartido para Academias)

`coder-shell` creará `src/ui/AcademyKit.ts` como primer paso para que `coder-board`, `coder-rubik-piano` y `coder-intel` puedan importarlo (o construir DOM con sus clases CSS):

```ts
export interface AcademyLayoutRefs {
  root: HTMLDivElement;       // .oa-academy-layout
  stageEl: HTMLDivElement;    // .oa-academy-stage (tablero / canvas)
  sideEl: HTMLAsideElement;   // .oa-academy-side (lecciones, explicación, acciones)
}

export function createAcademyLayout(container: HTMLElement, title: string, badgeText: string): AcademyLayoutRefs;
export function renderExplanationBox(target: HTMLElement, heading: string, bodyText: string, tone?: 'info' | 'good' | 'warn' | 'bad'): void;
export function renderLessonStepper(
  target: HTMLElement,
  lessons: { id: string; title: string }[],
  activeId: string,
  onSelect: (id: string) => void
): void;
```

Clases CSS garantizadas por `coder-shell` en `src/style.css`:
- `.oa-academy-layout` (grid 2 columnas en `>= 900px`, 1 columna en móvil, cabe dentro de `oa-stage-host`)
- `.oa-academy-stage`, `.oa-academy-side`, `.oa-academy-card`, `.oa-academy-actions`
- `.oa-explain-box`, `.oa-explain-info`, `.oa-explain-good`, `.oa-explain-warn`, `.oa-explain-bad`
- Marcadores de casillas/jugadas:
  - `.oa-mark-legal` (punto verde central / borde verde claro)
  - `.oa-mark-capture` (anillo rojo de captura)
  - `.oa-mark-forced` (borde/pulso dorado para captura obligatoria)
  - `.oa-mark-hint` (resaltado cian/azul de pista)
  - `.oa-mark-illegal` (borde rojo discontinuo)

### 1.5 Nombres exactos de Clases, Archivos y `id` de las 8 Academias

Para que `coder-shell` los registre en `src/catalog.ts` y `src/games/GauntletOrchestrator.ts` (`createMiniGame`) sin colisiones:

| `id` (`StandaloneGameId`) | Archivo en `src/games/` | Clase exportada (named export) | Constructor | Coder responsable |
|---|---|---|---|---|
| `'chess2d'` | `./ChessAcademyGame` | `export class ChessAcademyGame implements MiniGame` | `constructor(isGauntletSlice = false)` | `coder-board` |
| `'checkers2d'` | `./CheckersAcademyGame` | `export class CheckersAcademyGame implements MiniGame` | `constructor(isGauntletSlice = false)` | `coder-board` |
| `'poker2d'` | `./PokerAcademyGame` | `export class PokerAcademyGame implements MiniGame` | `constructor(isGauntletSlice = false)` | `coder-board` |
| `'rubik3d'` | `./RubikCube3DGame` | `export class RubikCube3DGame implements MiniGame` | `constructor(isGauntletSlice = false)` | `coder-rubik-piano` |
| `'piano2d'` | `./PianoEar2DGame` | `export class PianoEar2DGame implements MiniGame` | `constructor(isGauntletSlice = false)` | `coder-rubik-piano` |
| `'raven2d'` | `./RavenMatrix2DGame` | `export class RavenMatrix2DGame implements MiniGame` | `constructor(isGauntletSlice = false)` | `coder-intel` |
| `'sudoku2d'` | `./SudokuGuide2DGame` | `export class SudokuGuide2DGame implements MiniGame` | `constructor(isGauntletSlice = false)` | `coder-intel` |
| `'hanoi2d'` | `./HanoiLogic2DGame` | `export class HanoiLogic2DGame implements MiniGame` | `constructor(isGauntletSlice = false)` | `coder-intel` |

### 1.6 `omni-arena/src/utils/ecosystem.ts` (`EcosystemBridge`)

```ts
export type EcoAppId = 'directorio' | 'atelier' | 'unumbral' | 'arena';

export interface ArenaCatalogMeta {
  version: 1;
  total: number;
  academies: number;
  dexterity2d: number;
  action3d: number;
  updatedAt: number;
}

export interface EcoPulseSummary {
  sameOriginAvailable: boolean;
  atelier: {
    hasData: boolean;
    streak: number;
    todayDone: number;
    totalHabits: number;
  };
  unumbral: {
    hasData: boolean;
    pendingTasks: number;
    todayClasses: number;
    coursesCount: number;
  };
}

export function normalizeEcoTheme(raw: string | null | undefined): 'light' | 'dark' | null;
export function resolveCompanionUrl(app: EcoAppId, hash?: string): string;
export function renderEcoSwitchBar(currentApp: EcoAppId): string;
export function bindEcoThemeSync(onThemeExternalChange: (theme: 'day' | 'night') => void): () => void;
export function publishArenaCatalogMeta(meta: Omit<ArenaCatalogMeta, 'version' | 'updatedAt'>): void;
export function readEcoPulse(): EcoPulseSummary;
export function readEcoPulseWithCloud(): Promise<EcoPulseSummary>;
```

---

## 2. Partición Estricta de Archivos entre los 5 Coders (CERO SOLAPAMIENTO)

> **REGLA DE ORO DE AISLAMIENTO:** Ningún archivo aparece en más de un Coder. Si un Coder necesita estilos o utilidades adicionales, debe ponerlos únicamente dentro de los archivos asignados a su tabla.

### Orden de Arranque para Evitar Errores de Compilación Cruzados (`omni-arena`)

1. **`coder-shell` ejecuta primero su Paso S1 (primeros 2 minutos):** actualiza `src/types.ts`, `src/audio/SynthAudio.ts`, `src/icons.ts` y crea `src/ui/AcademyKit.ts`.
2. **`coder-board`, `coder-rubik-piano` y `coder-intel`** desarrollan en paralelo sus archivos de juegos, motores puros, hojas CSS propias (`src/styles/academy-*.css`) y tests unitarios. Cada archivo `*Game.ts` importa su propio CSS (`import '../styles/academy-board.css';`, etc.).
3. **`coder-shell`** completa en paralelo los fixes de los 18 juegos, `HubView.ts`, `GuideOverlay.ts`, `GameShell.ts`, `catalog.ts`, `ProfileStore.ts`, `ecosystem.ts`, `style.css` y, como último paso (`S6`), conecta los 8 imports en `src/games/GauntletOrchestrator.ts` (`createMiniGame`).
   - *Nota de seguridad para `coder-shell`:* si `coder-shell` termina antes de que alguno de los 3 coders de juegos haya escrito su `*Game.ts`, `coder-shell` NO debe crear ni sobrescribir esos archivos; espera o verifica que existan antes de correr el `npm run build` final.

---

### 2.1 `coder-eco` — Unificación en `directorio`, `UNUmbral` y `omni-life`

**Repositorios:** `directorio`, `UNUmbral`, `omni-life` (NO toca nada en `omni-arena`).

| Repo | Archivos exclusivos de `coder-eco` |
|---|---|
| `directorio` | `src/types.ts`, `src/state/DirectoryStore.ts`, `src/main.ts`, `src/style.css`, `src/icons.ts`, `public/sw.js` |
| `UNUmbral` | `lib/ecosistema.js` *(nuevo)*, `scripts/dev-server.mjs` *(nuevo)*, `index.html`, `app.js`, `estilos.css`, `sw.js`, `package.json`, `tests/ecosistema.test.js` *(nuevo)* + archivos espejo en `www/` generados con `npm run build:web` |
| `omni-life` | `vite.config.mts`, `public/sw.js`, `src/types.ts`, `src/state/LifeStore.ts`, `src/services/UmbralBridge.ts`, `src/main.ts`, `src/views/HomeView.ts`, `src/views/SingingView.ts`, `src/audio/VoiceStudio.ts`, `src/data/SingingBank.ts` *(nuevo)*, `src/style.css` |

**Tareas detalladas de `coder-eco`:**
1. **`directorio`**:
   - En `DirectoryStore.ts`:
     - Incluir `'mod-focuslab'` en `DEFAULT_DIRECTORY_ORDER` justo después de `'mod-vault'`.
     - Corregir `getTheme()` y `setTheme(theme)`: leer de `localStorage.getItem('umbral-theme')` aceptando `'dark' | 'night'` como `'night'` y `'light' | 'day'` como `'day'`; al guardar, escribir `'dark'` o `'light'` en `umbral-theme` (y aplicar `?eco_theme=` al iniciar si viene en `window.location.search`, limpiándolo con `history.replaceState`). Escuchar `window.addEventListener('storage', ...)` para `umbral-theme`.
     - Reescribir `buildCompanionSummary()` para leer las claves reales:
       * Atelier: `atelier_diario_profile_v1` (fallback `atelier_profile_v2`), calculando `atelierStreak = dailyStreak`, `atelierTodayDone = Object.values(todayHabits).filter(Boolean).length` cuando `lastActiveDay === todayStamp()`, `atelierTotalModules = 9`.
       * UNUmbral: `unumbral_backup` remoto → `unumbral_last_snapshot_v1` → `atelier_umbral_snapshot_v1`.
       * OMNI ARENA: `omni_arena_profile_v1` (y remoto `arena_profile`), calculando `overall = promedio(ratings)`, `arenaRank = ratingToRank(overall).grade` (`OMNI`, `SS`, `S`, `A`, `B`, `C`, `D`), `arenaSessions = suma(playCounts)`, `arenaScore = max(bestScores)`.
     - Actualizar `resolveEcosystemAppUrl` para conservar `hostname` local (`localhost`, `127.0.0.1`, LAN) con puertos `5175-5178`, soportar `github.io` y anexar `?eco_theme=light|dark` cuando cambia de origen.
   - En `src/main.ts` y `src/style.css`:
     - Añadir arriba la barra switcher compartida `<nav class="eco-switch" aria-label="Aplicaciones del ecosistema">` con los 4 destinos (`Directorio` activo con `aria-current="page"`, `Atelier Diario`, `UNUmbral`, `OMNI ARENA`).
     - Actualizar métricas de tarjetas: `app-arena` lee `omni_arena_catalog_meta_v1` (fallback `26 disciplinas · 8 academias`); `mod-singing` muestra `'Canto, piano de 2 octavas y oído'`.
     - Subir versión de caché en `public/sw.js`.
2. **`UNUmbral`**:
   - Crear `lib/ecosistema.js` (UMD compatible con navegador y `node --test`) con:
     - `resolveEcoUrl(app, opts)` para `directorio` (5178), `atelier` (5176), `unumbral` (5177), `arena` (5175), detectando `github.io`, `Capacitor` (`https://tpdeax.github.io/...`), y `localhost`/`127.0.0.1` con puerto, añadiendo `?eco_theme=`.
     - `applyIncomingEcoTheme()` que lee `?eco_theme=light|dark`, actualiza `localStorage['umbral-theme']` y `document.documentElement.setAttribute('data-theme', ...)`, y limpia la query string.
     - `writeUmbralSnapshot({ coursesCount, pendingTasks, todayClasses, cyclesCount })` que guarda en `localStorage['unumbral_last_snapshot_v1']` y también actualiza `atelier_umbral_snapshot_v1` si existe.
   - En `index.html`, `app.js` y `estilos.css`:
     - Renderizar la barra `.eco-switch` superior con los 4 enlaces dinámicos e inicializar los chips `#eco-link-directorio`, `#eco-link-atelier`, `#eco-link-calm`, `#eco-link-arena` usando `resolveEcoUrl`.
     - Llamar `writeUmbralSnapshot` tras cargar o modificar cursos/tareas/clases.
     - Escuchar `storage` sobre `umbral-theme` para cambiar entre `light` y `dark` en vivo.
   - Crear `scripts/dev-server.mjs` (servidor estático Node en puerto `5177`) y añadir `"dev": "node scripts/dev-server.mjs"` en `package.json`.
   - Subir versión de caché en `sw.js`, ejecutar `npm run build:web` para sincronizar `www/`, y añadir test en `tests/ecosistema.test.js`.
3. **`omni-life` (Atelier Diario)**:
   - Configurar `vite.config.mts` con puerto `5176` (`server: { port: 5176, strictPort: true }`).
   - En `main.ts`, `LifeStore.ts`, `UmbralBridge.ts`, `HomeView.ts`:
     - Barra `.eco-switch` en la cabecera con los 4 enlaces del ecosistema y `?eco_theme=`.
     - Sincronización viva de `umbral-theme` (`?eco_theme=` al entrar + listener `storage` + reaplicar preferencia local si llega sync remoto).
     - Actualizar contadores desactualizados en `HomeView.ts` (de `14 disciplinas` / `14 Juegos` a los valores de `omni_arena_catalog_meta_v1` o `26 disciplinas · 8 academias`; y el contador de rutinas de canto al total real).
   - **Ampliación de Canto y Piano (`VoiceStudio.ts`, `SingingBank.ts`, `SingingView.ts`, `style.css`)**:
     - `VoiceStudio.ts`: síntesis polifónica con 3 timbres (`piano`, `organ`, `soft`), `noteOn(midi, timbre)` / `noteOff(midi)`, `playChord(midis, dur, timbre)`, y detector de vibrato en vivo (`sampleVibrato()` que estima frecuencia de oscilación 4.5–7 Hz y amplitud en cents sobre la ventana reciente).
     - `SingingBank.ts`: 25 teclas de piano **Do3 a Do5 (MIDI 48 a 72)** con el mapa exacto de teclas PC (`KeyZ`..`KeyM` para Do3..Si3 y `KeyQ`..`KeyI` para Do4..Do5), rutinas clasificadas en 3 niveles (Inicial, Intermedio, Avanzado: respiración 4-4-6, vibrato, descubridor de rango vocal grave/agudo, afinación e intervalos) y 5 canciones guiadas nota a nota de dominio público (Himno de la Alegría, Estrellita, Martinillo, Cumpleaños Feliz, Arroz con Leche) con transporte `-12 / 0 / +12`.
     - `SingingView.ts`:
       * Piano interactivo de 2 octavas (Do3–Do5) con etiquetas `Do Re Mi` + tecla PC (`Z`, `X`, `Q`, `W`…) pintadas en cada tecla, soporte de clic/toque y teclado físico, y selector de timbre.
       * Pestañas/secciones claras: **1) Afinador y Karaoke en Vivo** (barra horizontal tipo karaoke donde las notas objetivo avanzan hacia la línea de tiempo y la voz del usuario dibuja su trazo en vivo con porcentaje de acierto), **2) Rutinas por Nivel y Respiración/Rango**, **3) Mini Entrenamiento de Oído y Acordes** (distinguir Mayor vs Menor e intervalos de 3ª, 5ª y 8ª con explicación).

---

### 2.2 `coder-shell` — Core de `omni-arena`, Hub Anti-Mareo, `GuideOverlay`, `GameShell`, `SynthAudio` y Fixes de los 18 Juegos

**Repositorio:** `omni-arena`.

| Grupo | Archivos exclusivos de `coder-shell` |
|---|---|
| Contratos y Core | `vite.config.mts`, `public/sw.js`, `README.md`, `src/types.ts`, `src/catalog.ts`, `src/icons.ts`, `src/main.ts`, `src/style.css` |
| Audio, Estado y Utilidades | `src/audio/SynthAudio.ts`, `src/state/ProfileStore.ts`, `src/services/CloudSync.ts`, `src/utils/ecosystem.ts`, `src/utils/input.ts` *(nuevo)* |
| UI y Shell | `src/engine/GameShell.ts`, `src/ui/HubView.ts`, `src/ui/GuideOverlay.ts` *(nuevo)*, `src/ui/AcademyKit.ts` *(nuevo)*, `src/games/GauntletOrchestrator.ts` |
| Fixes en los 18 juegos actuales | `src/games/Aim3DGame.ts`, `src/games/BlitzStacker2DGame.ts`, `src/games/BulletHell2DGame.ts`, `src/games/DualNBack2DGame.ts`, `src/games/FlashParry2DGame.ts`, `src/games/FlightPortals3DGame.ts`, `src/games/LaserTrack2DGame.ts`, `src/games/MemoryGrid2DGame.ts`, `src/games/NeonSnake2DGame.ts`, `src/games/OrbitBreaker3DGame.ts`, `src/games/PrecisionTarget2DGame.ts`, `src/games/PuzzleMatrix2DGame.ts`, `src/games/Rhythm2DGame.ts`, `src/games/Runner3DGame.ts`, `src/games/SchulteGrid2DGame.ts`, `src/games/SkyVault3DGame.ts`, `src/games/SonicRing2DGame.ts`, `src/games/TwinStick2DGame.ts` |

**Pasos de `coder-shell` (en este orden):**
- **Paso S1 (Inmediato — desbloquea a los demás coders):**
  1. Actualizar `src/types.ts` con el contrato exacto de §1.1.
  2. Extender `src/audio/SynthAudio.ts` con `midiToFreq`, `playMidiNote`, `playChord`, `noteOn`, `noteOff`, `stopAllNotes` y `InstrumentTimbre` (§1.2).
  3. Añadir los iconos SVG de un trazo en `src/icons.ts` (§1.3).
  4. Crear `src/ui/AcademyKit.ts` (§1.4).
- **Paso S2 (`ecosystem.ts`, `input.ts`, `ProfileStore.ts`, `CloudSync.ts`, `vite.config.mts`):**
  1. Configurar puerto `5175` en `vite.config.mts` y subir caché en `public/sw.js` a `omni-arena-v5`.
  2. Crear `src/utils/input.ts` con `detectTouchPrimary(setting: 'auto' | 'always' | 'off'): boolean` usando `matchMedia('(pointer: coarse)')`, `matchMedia('(any-pointer: fine)')` y `matchMedia('(hover: none)')` sin falsos positivos en laptops.
  3. Ampliar `src/utils/ecosystem.ts` con `renderEcoSwitchBar`, `bindEcoThemeSync`, `publishArenaCatalogMeta`, `readEcoPulse`, `readEcoPulseWithCloud`.
  4. Actualizar `src/state/ProfileStore.ts` para inicializar `bestScores` y `playCounts` de los 26 modos + circuitos, publicar `publishArenaCatalogMeta({ total: 26, academies: 8, dexterity2d: 13, action3d: 5 })`, elegir `getDailyTriad()` sobre `CIRCUIT_IDS` (18 modos de acción/destreza) y sincronizar `umbral-theme` en vivo.
- **Paso S3 (`catalog.ts` y `GuideOverlay.ts`):**
  1. Actualizar `src/catalog.ts` añadiendo `category` y `guide: GameGuideSpec` completo (objetivo en 1-2 líneas, 3 pasos `howToPlay`, `controls` marcados, `example` con 2-3 frames SVG inline ilustrativos, textos `practice` y `challenge`) para los **26 modos + `gauntlet` + `ranked`**. Exportar `CIRCUIT_IDS` (18 modos) y `STANDALONE_IDS` (26 modos). Reemplazar `'2D ↔ 3D'` por `'2D + 3D'`.
  2. Crear `src/ui/GuideOverlay.ts`: modal accesible que muestra el objetivo, el carrusel/ejemplo visual SVG interactivo (`Anterior`/`Siguiente`), el mapa de botones/teclas con `<kbd>` y colores de tono, el checkbox opcional `Entrar directo la próxima vez`, y los dos botones grandes:
     - `PRÁCTICA GUIADA (sin perder vidas)`
     - `MODO RETO (Oficial)`
- **Paso S4 (`HubView.ts` y `GameShell.ts` y `style.css`):**
  1. En `HubView.ts`:
     - Barra superior `.eco-switch` (Directorio · Atelier Diario · UNUmbral · OMNI ARENA).
     - Botones de cabecera con icono + etiqueta de texto visible (`Nube`, `Tema: Día/Noche`, `Sonido: Sí/No`, `Ajustes`).
     - Widget **Pulso del Ecosistema** (3 tarjetas: Atelier Diario, UNUmbral, Directorio).
     - Pestañas claras con contadores: `Academias Guiadas (8)` | `Destreza 2D (13)` | `Acción 3D (5)` | `Todo (26)` + buscador instantáneo `<input type="search">` con atajo `/`.
     - Cada tarjeta tiene botón principal (abre `GuideOverlay`, o entra directo si tiene `skipGuideFor[id]`) y botón `Guía` en el pie (siempre abre `GuideOverlay`).
  2. En `GameShell.ts` y `main.ts`:
     - `start(options?: { practiceMode?: boolean })`: si `practiceMode === true`, muestra insignia `PRÁCTICA GUIADA` en HUD, `ctx.damage()` nunca resta escudos (muestra aviso educativo), y al terminar no penaliza ratings.
     - Para modos `category === 'academy'`, ocultar escudos/combo/intensidad en el HUD para dejar una cabecera limpia con botón `? Guía` (`id="oa-btn-guide"`), cronómetro, puntos y pausa.
     - Añadir **Barra inferior fija de Controles Activos** (`<footer class="oa-controls-bar">`) poblada desde `desc.guide.controls` o `ctx.setControls(...)`, visible en PC y móvil, reservando su altura en el layout flex para no tapar el juego.
- **Paso S5 (Fixes de fricciones en los 18 juegos existentes):**
  1. `Aim3DGame.ts`: el primer clic que solicita `requestPointerLock()` NO dispara (`return` antes de disparar + ventana de 150 ms tras adquirir lock); mensaje claro `"Haz clic para fijar la mira (este clic no dispara)"`.
  2. `NeonSnake2DGame.ts`: swipe continuo en `pointermove`/`touchmove` (re-anclar el punto inicial cada 24 px para permitir giros seguidos sin levantar el dedo) + D-pad táctil de 4 botones SVG en pantalla cuando `ctx.isTouch`.
  3. `MemoryGrid2DGame.ts`: al fallar una celda en `recall`, entrar en fase `'reveal'` durante `1.1s` mostrando todas las celdas objetivo con borde verde y el error en rojo antes de pasar a la siguiente ronda.
  4. `DualNBack2DGame.ts`: barra visual de progreso de tiempo del estímulo actual + tercer botón explícito `NO COINCIDE (Espacio)` + quitar glifo `◆`.
  5. `PrecisionTarget2DGame.ts`: dibujar cruz `X` vectorial + etiqueta `"NO"` dentro de los objetivos señuelo rojos (accesible para daltonismo, cero glifos emoji).
  6. `PuzzleMatrix2DGame.ts`: en `chimp`, mostrar aviso `"Recuerda las posiciones: al pulsar el 1 se ocultan los demás"` antes del primer clic; en `simon`, reemplazar `setTimeout` por temporizador acumulado en `update(dt)` para que `setPaused(true)` pause de verdad la secuencia.
  7. `BlitzStacker2DGame.ts`: añadir botón táctil `BAJAR` en móvil, mostrar las vistas previas de `SIGUIENTE` y `RESERVA` en una franja superior cuando el ancho sea `< 520px`, y reemplazar `◀ ▶` por iconos SVG + texto.
  8. `SonicRing2DGame.ts`: texto honesto según dispositivo (`ctx.isTouch ? 'TOCA LA PANTALLA EN EL ARCO' : 'ESPACIO / CLIC / J / K EN EL ARCO'`).
  9. `GauntletOrchestrator.ts`: reemplazar el cambio fugaz de `0.85s` por un banner de transición con objetivo + controles y botón claro `LISTO (ESPACIO / TOCAR)` (con auto-avance de seguridad a los 8s si no hay input). Mantener `SEQUENCE = CIRCUIT_IDS` (las 18 disciplinas rápidas).
- **Paso S6 (Registro final en `GauntletOrchestrator.ts`):**
  - Importar las 8 clases de la tabla §1.5 en `src/games/GauntletOrchestrator.ts` y añadir sus `case` en `createMiniGame`.

---

### 2.3 `coder-board` — Academias de Tablero y Cartas (`chess2d`, `checkers2d`, `poker2d`)

**Repositorio:** `omni-arena`.

| Archivos exclusivos de `coder-board` | Rol |
|---|---|
| `src/games/chess/chessEngine.ts` *(nuevo)* | Motor puro de ajedrez (generación legal completa, jaque, mate, ahogado, enroque corto/largo, captura al paso, promoción, 50 jugadas, triple repetición, material insuficiente, FEN, SAN en español, bot de 3 niveles y generador de pistas razonadas en español + 4 lecciones interactivas). |
| `src/games/ChessAcademyGame.ts` *(nuevo)* | `MiniGame` (`id = 'chess2d'`): tablero 8×8 SVG/DOM interactivo, marcadores `.oa-mark-legal` / `.oa-mark-capture` / `.oa-mark-hint`, selector de coronación, 4 lecciones jugables + duelo vs Bot (Novato, Club, Maestro), botón `Pista (P)` que explica por qué en español y `Deshacer (U)` en práctica. |
| `src/games/checkers/checkersEngine.ts` *(nuevo)* | Motor puro de Damas 8×8: peones capturan hacia adelante y atrás, captura obligatoria, capturas múltiples encadenadas obligatorias, coronación al terminar salto en última fila, dama diagonal, bot minimax de 3 niveles y 3 lecciones tácticas (Golpe 2×1, Tenaza, Coronación). |
| `src/games/CheckersAcademyGame.ts` *(nuevo)* | `MiniGame` (`id = 'checkers2d'`): tablero 8×8, pulso dorado `.oa-mark-forced` en piezas con captura obligatoria, trazado de saltos múltiples 1→2→3, lecciones tácticas, pista explicada y duelo vs Bot. |
| `src/games/poker/pokerEngine.ts` *(nuevo)* | Motor puro Texas Hold'em sin dinero real: evaluador determinista de 5–7 cartas (las 10 manos con desempate/kickers y escalera A-2-3-4-5), calculadora de outs y equidad rápida en Práctica, 3 perfiles de bots y recomendador educativo con pot odds en español. |
| `src/games/PokerAcademyGame.ts` *(nuevo)* | `MiniGame` (`id = 'poker2d'`): mesa educativa ("Fichas de práctica · Sin dinero real"), guía visual siempre accesible de las **10 manos con mini cartas SVG** que resalta en vivo la mano actual del jugador, botones grandes `Pasar`, `Igualar`, `Subir` (`Mínimo`, `1/2 Bote`, `Bote`, `Todo`) y `Retirarse` con subtítulo explicativo, medidor de fuerza/outs en Práctica. |
| `src/styles/academy-board.css` *(nuevo)* | Estilos exclusivos para ajedrez, damas y póker (importado en los 3 `*Game.ts`). |
| `tests/board-games.test.ts` *(nuevo)* | Pruebas automatizadas de `chessEngine`, `checkersEngine` y `pokerEngine` (`node --test` / `tsx`). |

---

### 2.4 `coder-rubik-piano` — Cubo Rubik 3D y Academia de Piano & Oído (`rubik3d`, `piano2d`)

**Repositorio:** `omni-arena`.

| Archivos exclusivos de `coder-rubik-piano` | Rol |
|---|---|
| `src/games/rubik/rubikEngine.ts` *(nuevo)* | Modelo puro de 54 stickers (`U R F D L B`), giros exactos (`U, U', D, D', L, L', R, R', F, F', B, B'`), inversor de secuencias, mezclador con RNG sembrado, detector de las **5 fases del método principiante** y estados/algoritmos de ejemplo para cada fase. |
| `src/games/RubikCube3DGame.ts` *(nuevo)* | `MiniGame` (`id = 'rubik3d'`): escena Three.js con los 26 cubitos biselados, giro animado por capa mediante grupo pivote (`220ms`, `90ms` en `reduceMotion`), cámara orbital arrastrando el exterior + botón `Vista estándar`, botonera clara `U D L R F B` + conmutador `' Antihorario` + flecha 3D/SVG en vivo que muestra el sentido del giro sobre la cara al enfocar/pasar el ratón, guía interactiva de las 5 fases con botón `Ver ejemplo animado` y cronómetro. |
| `src/games/piano/pianoBank.ts` *(nuevo)* | Definición de las 25 teclas **Do3–Do5 (MIDI 48–72)** con mapeo de teclado PC (`KeyZ`..`KeyI`), acordes (`Mayor`, `Menor`, `Séptima`), intervalos (2ª menor a 8ª justa con explicación en español), posiciones en pentagrama en clave de Sol y Fa, y 6 melodías guiadas de dominio público. |
| `src/games/PianoEar2DGame.ts` *(nuevo)* | `MiniGame` (`id = 'piano2d'`): teclado de 2 octavas Do3–Do5 con etiquetas `Do Re Mi` y tecla PC pintadas en cada tecla, selector de timbre (`Piano`, `Órgano`, `Suave`, `Campana`), y 4 modos en pestañas: **1) Piano Libre y Acordes**, **2) Melodías Guiadas ("Sigue la luz")**, **3) Oído Musical e Intervalos**, **4) Lectura en Pentagrama SVG**. |
| `src/styles/academy-rubik-piano.css` *(nuevo)* | Estilos exclusivos para Rubik 3D y Piano 2D (importado en ambos `*Game.ts`). |
| `tests/rubik-piano.test.ts` *(nuevo)* | Pruebas automatizadas de `rubikEngine` (identidad `M + M'`, orden 4, orden 6 de `R U R' U'`, detección de las 5 fases) y `pianoBank`. |

---

### 2.5 `coder-intel` — Inteligencia Pura (`raven2d`, `sudoku2d`, `hanoi2d`)

**Repositorio:** `omni-arena`.

| Archivos exclusivos de `coder-intel` | Rol |
|---|---|
| `src/games/intel/ravenEngine.ts` *(nuevo)* | Generador determinista de Matrices Lógicas 3×3 tipo Raven (4 niveles de dificultad: progresión, distribución permutada, doble regla y superposición XOR; 6–8 opciones donde los distractores fallan al menos una regla; explicación escrita en español de la regla exacta). |
| `src/games/RavenMatrix2DGame.ts` *(nuevo)* | `MiniGame` (`id = 'raven2d'`): cuadrícula 3×3 SVG de alto contraste, opciones numeradas `1–8`, botón `Pista Razonada` en Práctica y cuadro de explicación detallada tras cada respuesta. |
| `src/games/intel/sudokuEngine.ts` *(nuevo)* | Generador y solucionador de Sudoku **4×4 (cajas 2×2), 6×6 (cajas 2×3) y 9×9 (cajas 3×3)** con verificación de **solución única** (`countSolutions === 1`) y motor de **Pista Razonada** (Single Desnudo, Single Oculto en fila/columna/caja, Par Desnudo) que devuelve la celda, el valor y la explicación paso a paso en español. |
| `src/games/SudokuGuide2DGame.ts` *(nuevo)* | `MiniGame` (`id = 'sudoku2d'`): selector de tamaño `4×4 | 6×6 | 9×9`, tablero interactivo con resaltado de fila/columna/caja e iguales, teclado numérico + modo `Candidatos (Notas)` + botón `Pista Razonada (P)` que explica por qué va ese número sin adivinar. |
| `src/games/intel/hanoiEngine.ts` *(nuevo)* | Motor puro de Torres de Hanói (3 a 6 discos), validación de movimientos con motivo de error, cálculo del óptimo `2^n - 1`, siguiente movimiento óptimo desde cualquier estado válido, y generador del árbol/pila de llamadas recursivas `hanoi(n, origen, destino, auxiliar)`. |
| `src/games/HanoiLogic2DGame.ts` *(nuevo)* | `MiniGame` (`id = 'hanoi2d'`): 3 torres interactivas (`1`, `2`, `3`), marcadores verdes en torres donde el disco seleccionado cabe y rojo con explicación donde no cabe, contador `Movimientos / Óptimo (2^n - 1)`, reproductor paso a paso del ejemplo recursivo con pila visual de llamadas, y botón `Siguiente paso óptimo` en Práctica. |
| `src/styles/academy-intel.css` *(nuevo)* | Estilos exclusivos para Matrices Raven, Sudoku y Hanói (importado en los 3 `*Game.ts`). |
| `tests/intel-games.test.ts` *(nuevo)* | Pruebas automatizadas de `ravenEngine`, `sudokuEngine` (solución única y pistas razonadas en 4×4, 6×6 y 9×9) y `hanoiEngine` (`2^n - 1` pasos). |

---

## 3. Criterios de Aceptación y Comandos de Verificación (Testers y Reviewer)

### 3.1 Compilación y Build en los 4 Repositorios (Obligatorio 0 errores)

```powershell
# 1. OMNI ARENA
cd C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena
npx tsc --noEmit
npm run build

# 2. OMNI LIFE (Atelier Diario)
cd C:\Users\Joseph\.gemini\antigravity\scratch\omni-life
npx tsc --noEmit
npm run build

# 3. DIRECTORIO
cd C:\Users\Joseph\.gemini\antigravity\scratch\directorio
npx tsc --noEmit
npm run build

# 4. UNUmbral
cd C:\Users\Joseph\.gemini\antigravity\scratch\UNUmbral
npm run build:web
npm test
```

### 3.2 Pruebas Automatizadas de Lógica Pura (`omni-arena`)

Los Testers ejecutarán los 3 suites de pruebas unitarias de las nuevas academias (usando Node 22 nativo o `npx tsx --test`):

```powershell
cd C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena
node --experimental-strip-types --test tests/board-games.test.ts tests/rubik-piano.test.ts tests/intel-games.test.ts
```

**Invariantes que deben verificar los tests:**
1. **Ajedrez (`chessEngine`):** `perft(1) = 20`, `perft(2) = 400`, enroque bloqueado bajo ataque, captura al paso legal, promoción en fila 8/1, jaque mate del pastor detectado, `getCoachingHint()` devuelve jugada legal y explicación no vacía en español.
2. **Damas (`checkersEngine`):** captura obligatoria impide movimientos simples cuando existe salto, captura múltiple en cadena completada, coronación y golpe táctico 2×1.
3. **Póker (`pokerEngine`):** orden estricto de las 10 manos (`Escalera Real > ... > Carta Alta`), escalera baja `A-2-3-4-5`, desempate por kicker y cálculo de outs.
4. **Rubik 3D (`rubikEngine`):** aplicar cualquier giro `M` seguido de `M'` devuelve el cubo resuelto; `M` 4 veces devuelve identidad; `(R U R' U')` 6 veces devuelve identidad; `detectBeginnerPhase` reconoce las 5 fases en orden.
5. **Piano (`pianoBank`):** 25 teclas consecutivas de MIDI 48 (`Do3`) a MIDI 72 (`Do5`), cada una con etiqueta en español y `keyCode` único.
6. **Matrices (`ravenEngine`):** para niveles 1–4, exactamente 1 opción cumple todas las reglas de fila/columna y `explanation` describe la regla en español.
7. **Sudoku (`sudokuEngine`):** tableros generados de 4×4, 6×6 y 9×9 tienen `countSolutions === 1`; `getReasonedHint` devuelve una pista válida con explicación en español.
8. **Hanói (`hanoiEngine`):** el solucionador recursivo para `n = 3, 4, 5, 6` produce exactamente `2^n - 1` movimientos legales y termina con todos los discos en la torre C.

### 3.3 Auditoría Visual y Reglas `impeccable` + `inherit-legacy-style` (Testers + Reviewer)

1. **Cero emojis en UI:**
   ```powershell
   cd C:\Users\Joseph\.gemini\antigravity\scratch
   node -e "const fs=require('fs'),path=require('path'); const re=/\p{Extended_Pictographic}/u; for(const r of ['omni-arena/src','omni-life/src','directorio/src']){ const walk=d=>fs.readdirSync(d,{withFileTypes:true}).forEach(e=>{const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(/\.(ts|css)$/.test(e.name) && e.name!=='SavedVaultBank.ts'){ const txt=fs.readFileSync(p,'utf8'); if(re.test(txt)) console.log('EMOJI FOUND:',p); }}); walk(r); }"
   ```
   *(Debe devolver vacío).*
2. **Validación E2E / DOM de los 26 modos y Ecosistema:**
   - En `omni-arena`:
     * La barra `.eco-switch` muestra los 4 destinos (`Directorio`, `Atelier Diario`, `UNUmbral`, `OMNI ARENA`).
     * El Hub muestra las 4 pestañas (`Academias Guiadas (8)`, `Destreza 2D (13)`, `Acción 3D (5)`, `Todo (26)`), el buscador funcional y el widget **Pulso del Ecosistema**.
     * Al hacer clic en cualquiera de las 26 disciplinas se abre `GuideOverlay` con Objetivo, Ejemplo SVG, Mapa de controles, `PRÁCTICA GUIADA (sin perder vidas)` y `MODO RETO (Oficial)`.
     * Dentro de la partida aparecen el botón `? Guía` en el HUD y la barra inferior fija `.oa-controls-bar`.
     * En Práctica Guiada, un fallo no reduce los escudos.
   - En `directorio`, `omni-life` y `UNUmbral`:
     * Barra `.eco-switch` visible y funcional.
     * Cambio de tema día/noche actualiza `localStorage['umbral-theme']` (`light`/`dark`) y se propaga al navegar.
     * En `omni-life` (`#singing`), el piano muestra las 2 octavas `Do3–Do5` con teclas de PC pintadas, selector de timbre, rutinas por nivel y barra tipo karaoke.
3. **Auditoría Git (`reviewer`):**
   - Verificar en los 4 repositorios que `git log` (si se hicieron commits) tenga exclusivamente `TpdeaX <personaljosephunu@gmail.com>` y que `git status` no incluya archivos basura ni artefactos fuera de lugar.
