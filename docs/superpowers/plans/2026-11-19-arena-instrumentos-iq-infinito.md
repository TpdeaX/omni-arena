# OMNI ARENA — Instrumentos, Nuevas Academias IQ, Dificultad Dinámica/Progresiva e Infinito Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar `omni-arena` con 3 nuevas academias musicales + expansión de `piano2d` (todos los instrumentos: piano, batería, guitarra, bajo, ukelele, xilófono/marimba, melódica/flauta y ensamble), 4 nuevas academias de IQ (`spatial3d`, `nonogram2d`, `logicseq2d`, `memorypath2d`), sistema transversal de dificultad cambiable/dinámica/progresiva + Modo Infinito en todos los juegos compatibles, e interfaz ultra-intuitiva directa al grano.

**Architecture:** Contrato estricto en `src/types.ts`, `src/audio/SynthAudio.ts`, `src/icons.ts` y `src/ui/AcademyKit.ts` primero (Paso A1) para habilitar trabajo paralelo limpio en 4 frentes sin solapamiento de archivos: Core/Shell (`A`), Música (`B`), Nuevas Academias IQ (`C1`) y Modo Infinito en juegos existentes (`C2`). Toda lógica pura (bancos musicales, motores IQ, RNG sembrado `mulberry32`) vive sin DOM ni Three.js para validarse con `node --test`.

**Tech Stack:** TypeScript 7, Vite 8, Three.js 0.187, Web Audio API (`SynthAudio.ts`), Node 22 native test runner (`node --test`).

**Spec:** `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\docs\superpowers\specs\2026-11-19-aprendizaje-total-ecosistema-design.md` (Secciones 1, 2, 3, 4 Bloques A, B, C, F)

## Global Constraints

- Identidad Git personal obligatoria: `TpdeaX <personaljosephunu@gmail.com>` en rama `main` (sin `git push` salvo instrucción explícita).
- Cero emojis y cero glifos pictográficos en UI (`\p{Extended_Pictographic}` vacío en `src/`); usar únicamente SVG de un trazo (`stroke="currentColor"`, `stroke-width="2"`, `fill="none"`).
- Conservar los tokens CSS day/night de `omni-arena` (`--bg-void`, `--bg-panel`, `--ink-primary`, `--accent-cyan`, `oa-diamond-badge`) y las 18 disciplinas de `CIRCUIT_IDS` sin romper Circuito Total ni Clasificatoria.
- Regla de diseño directo al grano: todos los botones tienen etiqueta textual clara con verbo/acción (nunca solo icono); controles secundarios ocultos cuando no aplican al submodo actual.
- `ACADEMY_IDS` pasa de `8` a `15`; `STANDALONE_IDS` pasa de `26` a `33`; `publishArenaCatalogMeta()` reporta `{ total: 33, academies: 15, dexterity2d: 13, action3d: 5 }`.
- Puerto dev estricto `5175`; incrementar `CACHE_NAME` en `public/sw.js` de `omni-arena-v5` a `omni-arena-v6`.

## Review Focus

- **Salida temprana en Modo Infinito (`Finalizar y puntuar`):** pulsar `Finalizar y puntuar` antes de `20` segundos activos Y con menos de `3` aciertos/rondas resueltas (`hits + puzzlesSolved < 3`) NO debe alterar `ratings` del radar ni marcar `dailyCompletedIds` / `dailyStreak`; debe avisar al usuario.
- **Perfiles antiguos en localStorage/Supabase sin `bestInfiniteScores`:** `ProfileStore.normalizeProfile()` debe hidratar `bestInfiniteScores` con ceros para los `33` modos + circuitos y aceptar `settings.difficulty === 'progressive'` sin perder datos previos.
- **Audio polifónico y pausas limpias en instrumentos (`drums2d`, `strings2d`, `band2d`, `piano2d`):** pausar, abrir guía o salir al Hub debe detener inmediatamente cualquier loop de metrónomo, secuencia de banda/ritmo o nota sostenida (`stopAllNotes()` + timers en `setPaused(true)` y `destroy()`), sin notas colgadas.
- **Simetría en Rotación Espacial 3D (`spatial3d`):** el generador debe rechazar cualquier poliedro quiralmente simétrico (cuya reflexión especular coincida con alguna de las 24 rotaciones del grupo octaédrico) para que jamás haya dos respuestas válidas ni ambigüedad.
- **Atajos de teclado en juegos mientras un modal o input está abierto:** `GuideOverlay`, modal de Pausa, o `<input>`/`<select>` nunca deben disparar notas del instrumento ni seleccionar respuestas del tablero en segundo plano.

---

### Partición de Archivos para Swarm Paralelo (Cero Solapamiento)

| Worker | Archivos exclusivos |
|---|---|
| `arena-shell` (Paso A1 primero, luego A2) | `vite.config.mts`, `public/sw.js`, `README.md`, `src/types.ts`, `src/audio/SynthAudio.ts`, `src/icons.ts`, `src/ui/AcademyKit.ts`, `src/catalog.ts`, `src/state/ProfileStore.ts`, `src/main.ts`, `src/engine/GameShell.ts`, `src/ui/GuideOverlay.ts`, `src/ui/HubView.ts`, `src/style.css`, `src/games/GauntletOrchestrator.ts`, `tests/shell-infinite.test.ts` |
| `arena-music` (Bloque B) | `src/games/piano/pianoBank.ts`, `src/games/PianoEar2DGame.ts`, `src/games/music/drumsBank.ts`, `src/games/DrumsAcademyGame.ts`, `src/games/music/stringsBank.ts`, `src/games/StringsAcademyGame.ts`, `src/games/music/bandBank.ts`, `src/games/BandEnsembleGame.ts`, `src/styles/academy-music.css`, `tests/music-academies.test.ts` |
| `arena-iq` (Bloque C1) | `src/games/intel/spatial3dEngine.ts`, `src/games/SpatialRotation3DGame.ts`, `src/games/intel/nonogramEngine.ts`, `src/games/NonogramLogic2DGame.ts`, `src/games/intel/logicSeqEngine.ts`, `src/games/LogicSeq2DGame.ts`, `src/games/intel/memoryPathEngine.ts`, `src/games/MemoryPath2DGame.ts`, `src/styles/academy-intel.css`, `tests/iq-new.test.ts` |
| `arena-infinite` (Bloque C2) | `src/games/Aim3DGame.ts`, `src/games/Runner3DGame.ts`, `src/games/OrbitBreaker3DGame.ts`, `src/games/SkyVault3DGame.ts`, `src/games/FlightPortals3DGame.ts`, `src/games/Rhythm2DGame.ts`, `src/games/SonicRing2DGame.ts`, `src/games/FlashParry2DGame.ts`, `src/games/BulletHell2DGame.ts`, `src/games/PuzzleMatrix2DGame.ts`, `src/games/SchulteGrid2DGame.ts`, `src/games/DualNBack2DGame.ts`, `src/games/BlitzStacker2DGame.ts`, `src/games/TwinStick2DGame.ts`, `src/games/LaserTrack2DGame.ts`, `src/games/MemoryGrid2DGame.ts`, `src/games/NeonSnake2DGame.ts`, `src/games/PrecisionTarget2DGame.ts`, `src/games/RavenMatrix2DGame.ts`, `src/games/SudokuGuide2DGame.ts` |

---

### Task 1 (Paso A1 — `arena-shell`): Contratos Base, `SynthAudio.ts` Multi-Instrumento, Iconos y `AcademyKit.ts`

**Files:**
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\types.ts`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\audio\SynthAudio.ts`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\icons.ts`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\ui\AcademyKit.ts`

**Interfaces:**
- Produces:
  - `DifficultyId = 'chill' | 'standard' | 'hyper' | 'adaptive' | 'progressive'`
  - `GameModeId` añade `'drums2d' | 'strings2d' | 'band2d' | 'spatial3d' | 'nonogram2d' | 'logicseq2d' | 'memorypath2d'`
  - `AcademySubFilter = 'all' | 'music' | 'iq' | 'strategy'`
  - `GameDescriptor` añade `supportsInfinite?: boolean` y `academyGroup?: Exclude<AcademySubFilter, 'all'>`
  - `GameContext` añade `infiniteMode?: boolean`
  - `RunMetrics` añade `infiniteMode?: boolean`
  - `PlayerProfile` añade `bestInfiniteScores: Record<GameModeId, number>` y `UserSettings.infiniteModeDefault?: boolean`
  - `InstrumentTimbre = 'piano' | 'organ' | 'soft' | 'bell' | 'guitar' | 'bass' | 'ukulele' | 'marimba' | 'flute'`
  - `DrumPieceId = 'kick' | 'snare' | 'hihat_closed' | 'hihat_open' | 'tom_high' | 'tom_low' | 'crash' | 'ride'`
  - `synthAudio.playDrum(piece: DrumPieceId, velocity?: number, whenOffset?: number): void`
  - `synthAudio.playMetronomeClick(accent: boolean, whenOffset?: number): void`
  - `Icons.drums`, `Icons.guitar`, `Icons.band`, `Icons.spatial3d`, `Icons.nonogram`, `Icons.logicseq`, `Icons.memorypath`, `Icons.infinity`

- [ ] **Step 1: Update `src/types.ts` with exact frozen contracts**

Add `'progressive'` to `DifficultyId`, the 7 new `GameModeId` entries, `AcademySubFilter`, `supportsInfinite`, `academyGroup`, `infiniteMode` on `GameContext` and `RunMetrics`, `bestInfiniteScores` on `PlayerProfile`, and `infiniteModeDefault` on `UserSettings`.

- [ ] **Step 2: Expand `src/audio/SynthAudio.ts` with 5 new timbres, 8-piece drum kit, and metronome**

Add `'guitar'`, `'bass'`, `'ukulele'`, `'marimba'`, `'flute'` synthesis inside `createTimbreVoice()`, plus `DrumPieceId`, `playDrum()`, and `playMetronomeClick()`. Keep `MAX_ACTIVE_VOICES` eviction and zero breaking changes to existing callers.

- [ ] **Step 3: Add new SVG icons to `src/icons.ts` and optional helper `renderDifficultyBadge()` in `src/ui/AcademyKit.ts`**

All SVG icons strictly single-weight `stroke="currentColor"`, `stroke-width="2"`, `fill="none"`.

- [ ] **Step 4: Run `npx tsc --noEmit` checkpoint (expected clean on existing code)**

Wait to wire `catalog.ts` / `GauntletOrchestrator.ts` until `arena-music` and `arena-iq` create their files (or wire `catalog.ts` right away since `catalog.ts` has no imports from game classes!).

---

### Task 2 (Paso A2 — `arena-shell`): `catalog.ts`, `ProfileStore.ts`, `GuideOverlay.ts`, `GameShell.ts`, `HubView.ts` y Reglas de Modo Infinito

**Files:**
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\catalog.ts`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\state\ProfileStore.ts`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\ui\GuideOverlay.ts`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\engine\GameShell.ts`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\ui\HubView.ts`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\main.ts`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\style.css`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\public\sw.js`
- Test: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\tests\shell-infinite.test.ts` *(create)*

**Interfaces:**
- Consumes: `types.ts`, `SynthAudio.ts`, `icons.ts`
- Produces:
  - `DIFFICULTY_META.progressive` (`PROGRESIVA`, `baseScale: 0.85`, `scoreMult: 1.2`, `accent: '#7C3AED'`)
  - `ACADEMY_IDS` (15 items), `STANDALONE_IDS` (33 items), full `GameDescriptor` + `guide` entries for all 7 new modes + updated `supportsInfinite` and `academyGroup` on all 33 modes
  - `meetsInfiniteMinimum(durationSec: number, hits: number, puzzlesSolved: number): boolean` exported in `ProfileStore.ts` (`durationSec >= 20 || hits + puzzlesSolved >= 3`)
  - `GameShell.start({ practiceMode?, infiniteMode? })` and `onReplay(modeId, practiceMode?, infiniteMode?)`
  - `ACADEMY_SHIELD_IDS` visibility rule in `GameShell.ts`

- [ ] **Step 1: Write the failing test `tests/shell-infinite.test.ts`**

Test:
1. `meetsInfiniteMinimum(10, 1, 0) === false`, `meetsInfiniteMinimum(20, 0, 0) === true`, `meetsInfiniteMinimum(5, 2, 1) === true`.
2. `DIFFICULTY_META.progressive` exists with `baseScale: 0.85` and `ACADEMY_IDS.length === 15`, `STANDALONE_IDS.length === 33`, `CIRCUIT_IDS.length === 18`.
3. `normalizeProfile` (export from `ProfileStore.ts`) hydrates `bestInfiniteScores` to `0` for all `GAME_CATALOG` keys when loading a legacy profile.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena && node --test tests/shell-infinite.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `catalog.ts`, `ProfileStore.ts`, `GuideOverlay.ts`, `GameShell.ts`, `HubView.ts`, `main.ts`, `style.css`, `sw.js`**

1. `catalog.ts`: add `DIFFICULTY_META.progressive`, populate `ACADEMY_IDS` (15), `academyGroup` (`music` / `iq` / `strategy`), `supportsInfinite` flags, and full `guide` specs with inline SVG examples for `drums2d`, `strings2d`, `band2d`, `spatial3d`, `nonogram2d`, `logicseq2d`, `memorypath2d`.
2. `ProfileStore.ts`: export `normalizeProfile` & `meetsInfiniteMinimum`; handle `bestInfiniteScores` vs `bestScores` in `recordRun()` (skipping `ratings` and `dailyCompletedIds` update when `metrics.infiniteMode && !meetsInfiniteMinimum(...)`, returning `qualifiedForRank: boolean`); add `'progressive'` difficulty option.
3. `GuideOverlay.ts`: render direct **Dificultad** selector pills (`Cadete`, `Estándar`, `Élite`, `Dinámica IA`, `Progresiva`) and **`Modo Infinito (sin reloj)`** toggle when `desc.supportsInfinite`, passing `(chosenId, practiceMode, infiniteMode)` to `onStart` / `onRestart`. Also map icons in `getModeIconSvg()` for all 7 new IDs.
4. `GameShell.ts`: accept `infiniteMode` in `GameShellStartOptions`, pass `infiniteMode` in `GameContext`, show shields/combo/intensity on `ACADEMY_SHIELD_IDS` when `!practiceMode`, show clickable Difficulty pill + `Finalizar y puntuar` button in HUD when `infiniteMode && !practiceMode`, allow switching difficulty in Pause modal (live switch between `adaptive` and `progressive`, or restart confirmation for static speeds), and scale `liveIntensity` continuously every 12 s (`+0.03×`, max `2.20×`) when `difficulty === 'progressive'`.
5. `HubView.ts` + `main.ts` + `style.css`: add sub-filter pills inside `Academias Guiadas` (`Todas (15) · Música e Instrumentos (4) · IQ y Lógica (7) · Estrategia y 3D (4)`), show `INF <score>` on cards when `bestInfiniteScores[id] > 0`, add `PROGRESIVA` pill to hero difficulty bar, wire `onLaunch(modeId, practiceMode, infiniteMode)`, and bump `public/sw.js` to `omni-arena-v6`.

- [ ] **Step 4: Run `tests/shell-infinite.test.ts` to verify it passes**

Run: `cd C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena && node --test tests/shell-infinite.test.ts`
Expected: PASS.

---

### Task 3 (Bloque B — `arena-music`): Expansión de `piano2d` + 3 Nuevas Academias Musicales (`drums2d`, `strings2d`, `band2d`)

**Files:**
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\piano\pianoBank.ts`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\PianoEar2DGame.ts`
- Create: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\music\drumsBank.ts`
- Create: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\DrumsAcademyGame.ts`
- Create: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\music\stringsBank.ts`
- Create: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\StringsAcademyGame.ts`
- Create: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\music\bandBank.ts`
- Create: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\BandEnsembleGame.ts`
- Create: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\styles\academy-music.css`
- Test: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\tests\music-academies.test.ts` *(create)*

**Interfaces:**
- Consumes: `MiniGame`, `GameContext`, `synthAudio`, `createAcademyLayout`, `renderExplanationBox`, `Icons`
- Produces:
  - `export class PianoEar2DGame implements MiniGame` (`id = 'piano2d'`, 18 melodías con `chords`, modo `Progresiones`, tempo/metrónomo, Reto con elección libre de pieza o Examen Completo)
  - `export class DrumsAcademyGame implements MiniGame` (`id = 'drums2d'`, 8 piezas, 12 ritmos/géneros, Libre, Práctica/Reto a tempo, Resistencia Infinita)
  - `export class StringsAcademyGame implements MiniGame` (`id = 'strings2d'`, Guitarra 6 cuerdas / Bajo 4 cuerdas / Ukelele 4 cuerdas, 16 acordes, 12 canciones/riffs, barra de postura de acorde + rasgueo en acordes a tempo y traste directo en riffs/bajo/libre)
  - `export class BandEnsembleGame implements MiniGame` (`id = 'band2d'`, selector de instrumento activo Xilófono/Marimba, Melódica/Flauta, Piano, Mini-Batería 6 pads, Bajo 4 cuerdas; 8 pistas de banda mutables por canal + Jam infinito)

- [ ] **Step 1: Write the failing test `tests/music-academies.test.ts`**

Assert:
1. `GUIDED_MELODIES.length === 18` and `PIANO_PROGRESSIONS.length >= 5`, all notes within MIDI `48..72`, valid chords.
2. `DRUM_PIECES.length === 8` with unique PC key codes, and `DRUM_GROOVES.length === 12` covering Rock, Pop, Funk, Bossa Nova, Cumbia, Reggaeton, Jazz Swing, Blues Shuffle, Metal, etc., each with valid 16-step or 12-step grid.
3. `STRING_INSTRUMENTS` defines `'guitar'` (6 strings `[64, 59, 55, 50, 45, 40]`), `'bass'` (4 strings `[43, 38, 33, 28]`), `'ukulele'` (4 strings `[69, 64, 60, 67]`); `CHORD_SHAPES.length >= 16` with valid fret arrays matching string counts; `STRING_SONGS.length === 12`.
4. `BAND_SONGS.length === 8`, each having `bpm`, `drums`, `bass`, `chords`, and `melody` tracks with valid MIDI ranges.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena && node --test tests/music-academies.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `pianoBank` + `PianoEar2DGame` upgrades, `drumsBank` + `DrumsAcademyGame`, `stringsBank` + `StringsAcademyGame`, `bandBank` + `BandEnsembleGame`, and `academy-music.css`**

Follow exact specs in `docs/superpowers/specs/2026-11-19-aprendizaje-total-ecosistema-design.md` §4 Bloque B. Ensure all `setPaused(true)` and `destroy()` clean up timers/listeners/audio via `synthAudio.stopAllNotes()`. Ensure Challenge mode lets the user pick any piece/rhythm/song and evaluates accuracy + timing at completion without abruptly cutting the song on a wrong note.

- [ ] **Step 4: Run tests to verify `rubik-piano.test.ts` and `music-academies.test.ts` pass**

Run: `cd C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena && node --test tests/rubik-piano.test.ts tests/music-academies.test.ts`
Expected: PASS.

---

### Task 4 (Bloque C1 — `arena-iq`): 4 Nuevas Academias IQ (`spatial3d`, `nonogram2d`, `logicseq2d`, `memorypath2d`)

**Files:**
- Create: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\intel\spatial3dEngine.ts`
- Create: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\SpatialRotation3DGame.ts`
- Create: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\intel\nonogramEngine.ts`
- Create: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\NonogramLogic2DGame.ts`
- Create: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\intel\logicSeqEngine.ts`
- Create: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\LogicSeq2DGame.ts`
- Create: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\intel\memoryPathEngine.ts`
- Create: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\MemoryPath2DGame.ts`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\styles\academy-intel.css`
- Test: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\tests\iq-new.test.ts` *(create)*

**Interfaces:**
- Consumes: `MiniGame`, `GameContext`, `synthAudio`, `createAcademyLayout`, `renderExplanationBox`, `Icons`, `THREE`
- Produces:
  - `export class SpatialRotation3DGame implements MiniGame` (`id = 'spatial3d'`)
  - `export class NonogramLogic2DGame implements MiniGame` (`id = 'nonogram2d'`)
  - `export class LogicSeq2DGame implements MiniGame` (`id = 'logicseq2d'`)
  - `export class MemoryPath2DGame implements MiniGame` (`id = 'memorypath2d'`)

- [ ] **Step 1: Write the failing test `tests/iq-new.test.ts`**

Test pure engines with seeded RNG:
1. `spatial3dEngine`: generates chiral polycubes (6..12 cubes); `areShapesCongruentByRotation(base, rotated)` is `true` for the correct option and `false` for all mirror/perturbed distractors across all 24 3D cube rotations; zero symmetric shapes pass filter.
2. `nonogramEngine`: `5x5`, `8x8`, `10x10` puzzles are uniquely solvable by the line-deduction solver (`solveNonogramLineWise(clues).solved === true`); `getNonogramHint(board, clues)` returns a valid deducible cell + Spanish explanation.
3. `logicSeqEngine`: generates items across `'sequence'`, `'analogy'`, `'syllogism'`, `'bias'` with 4 options, 1 unique `correctIndex`, and Spanish `explanation`.
4. `memoryPathEngine`: generates 3..10 spatial associations without coordinate collisions, generates brief interference math/Stroop check, and evaluates recall accuracy accurately.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena && node --test tests/iq-new.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the 4 engines, 4 `MiniGame` views, and CSS in `academy-intel.css`**

Each game honors `ctx.practiceMode`, `ctx.infiniteMode`, `ctx.difficulty` (`chill`, `standard`, `hyper`, `adaptive`, `progressive`), calls `ctx.damage(1)` in Challenge/Infinite mode on errors (terminating when `shields <= 0`), and provides clear Spanish explanations of *why*. `SpatialRotation3DGame` disposes Three.js geometries/materials/renderers cleanly on `destroy()` and respects `ctx.settings.reduceMotion`.

- [ ] **Step 4: Run `tests/iq-new.test.ts` to verify it passes**

Run: `cd C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena && node --test tests/iq-new.test.ts`
Expected: PASS.

---

### Task 5 (Bloque C2 — `arena-infinite`): `infiniteMode` y `progressive` en los Juegos Existentes

**Files:**
- Modify the 18 circuit games + `RavenMatrix2DGame.ts` + `SudokuGuide2DGame.ts` (all listed in File Partition table for `arena-infinite`).

**Interfaces:**
- Consumes: `ctx.infiniteMode`, `ctx.difficulty === 'progressive'`, `ctx.getIntensity()`

- [ ] **Step 1: Update the 11 timed dexterity games (`Aim3DGame`, `Rhythm2DGame`, `SonicRing2DGame`, `FlashParry2DGame`, `PuzzleMatrix2DGame`, `SchulteGrid2DGame`, `DualNBack2DGame`, `LaserTrack2DGame`, `MemoryGrid2DGame`, `NeonSnake2DGame`, `PrecisionTarget2DGame`)**

When `ctx.infiniteMode === true && !isGauntletSlice`: skip countdown end-of-run (`timeLeftSec: null`), continuously spawn next round/wave/pattern scaling with `ctx.getIntensity()` (and escalating `nLevel` up to 4-Back in `DualNBack2DGame`, grid up to 6×6 in `MemoryGrid2DGame` / `SchulteGrid2DGame`), so run ends only when `ctx.damage()` returns `0` or user clicks `Finalizar y puntuar`.

- [ ] **Step 2: Update the 7 naturally endless games (`Runner3DGame`, `OrbitBreaker3DGame`, `SkyVault3DGame`, `FlightPortals3DGame`, `BulletHell2DGame`, `BlitzStacker2DGame`, `TwinStick2DGame`)**

Ensure `progressive` scales speed/spawn rate cleanly alongside `ctx.getIntensity()` and `getMetrics()` computes honest `hits`/`puzzlesSolved`/`axisPerformances` when ended early via `Finalizar y puntuar`.

- [ ] **Step 3: Update `RavenMatrix2DGame.ts` and `SudokuGuide2DGame.ts`**

1. `RavenMatrix2DGame.ts`: when `ctx.infiniteMode === true`, remove `CHALLENGE_TOTAL = 12` cap and per-matrix countdown (`timeLeftSec: null`), cycle/escalate levels 1→4 infinitely, call `ctx.damage(1)` on error and finish on `shields <= 0` or `Finalizar y puntuar`.
2. `SudokuGuide2DGame.ts`: when `ctx.infiniteMode === true`, on solving a board increment `boardsSolved`, add score bonus, and automatically generate the next board escalating `4 → 6 → 9`; call `ctx.damage(1)` on mistake ending at `0` shields instead of `MAX_CHALLENGE_ERRORS = 3` (which stays intact for standard 1-board Challenge).

---

### Task 6 (Paso F — `arena-shell` + QA Cruzado): Conectar `GauntletOrchestrator.ts` y Verificación Completa

**Files:**
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\src\games\GauntletOrchestrator.ts`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\README.md`

- [ ] **Step 1: Wire all 7 new `MiniGame` classes into `createMiniGame()` in `src/games/GauntletOrchestrator.ts`**

Keep `SEQUENCE` and `CIRCUIT_IDS` unchanged at the 18 rapid games.

- [ ] **Step 2: Run full typecheck, all unit tests, emoji check, and production build**

```powershell
cd C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena
npx tsc --noEmit
node --test tests/*.test.ts
npm run build
```
Expected: 0 TypeScript errors, all tests pass, `vite build` succeeds, zero `\p{Extended_Pictographic}` in `src/`.

- [ ] **Step 3: Cross-model verification & Commit `omni-arena`**

Verify in headless/live browser: Hub shows `33 DISCIPLINAS`, sub-filters inside `Academias Guiadas (15)`, `GuideOverlay` shows difficulty + `Modo Infinito`, music academies play audio cleanly, IQ academies display shields/hints/explanations, and `omni_arena_catalog_meta_v1` publishes `33 / 15`.
Commit with `TpdeaX <personaljosephunu@gmail.com>` on `main` (do not push).
