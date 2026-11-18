# Diseño: Ecosistema unificado + intuitividad anti-mareo + academias de inteligencia y música

- **Fecha:** 2026-11-18
- **Autor:** architect (swarm "Opción A")
- **Repos afectados:** `omni-arena` (5175), `omni-life` / Atelier Diario (5176), `UNUmbral` (5177), `directorio` (5178), todos en `C:\Users\Joseph\.gemini\antigravity\scratch\`
- **Plan de implementación (contratos y reparto de archivos):** `docs/superpowers/plans/2026-11-18-ecosistema-unificado-academia-plan.md`
- **Git:** proyecto personal → autor/committer `TpdeaX <personaljosephunu@gmail.com>`, rama `main`. No hacer push hasta que el coordinador/usuario lo pida.

---

## 0. Diagnóstico (lo que hay hoy y por qué falla)

Lo que se ve en el código actual y que este diseño corrige:

| # | Hallazgo | Dónde | Efecto |
|---|----------|-------|--------|
| D1 | `umbral-theme` se guarda con **dos vocabularios**: `light/dark` (UNUmbral `app.js:1063`, omni-life `LifeStore.ts:193`, omni-arena `ProfileStore.ts:180`) vs `day/night` (directorio `DirectoryStore.ts:132-140`). | directorio | El Directorio nunca lee bien el tema de los demás y les escribe un valor que ellos no entienden. |
| D2 | omni-arena solo lee `umbral-theme` al **crear** el perfil por primera vez (`initialThemeFromEcosystem`); después manda su propio `settings.theme`. Nadie escucha el evento `storage`. | omni-arena, omni-life | "Sincronización" de tema que solo funciona una vez. |
| D3 | `localStorage` es **por origen**. En localhost cada app vive en su puerto (5175-5178) = 4 orígenes distintos ⇒ no comparten nada. En `tpdeax.github.io` sí comparten (mismo origen). | todos | En desarrollo el ecosistema parece "roto" aunque el código sea correcto. |
| D4 | Directorio lee claves que **nadie escribe**: `atelier_profile_v2` (real: `atelier_diario_profile_v1`), `unumbral_last_snapshot_v1` (UNUmbral no la escribe; omni-life escribe `atelier_umbral_snapshot_v1`), y del perfil de Arena lee `rankTier/totalSessions/highScores`, campos que no existen (real: `level/ratings/bestScores/playCounts`). | `directorio/src/state/DirectoryStore.ts:306-400` | Las tarjetas del Directorio muestran ceros o "BRONZE II" para siempre. |
| D5 | `mod-focuslab` existe como tarjeta pero no está en `DEFAULT_DIRECTORY_ORDER`. | directorio | Aparece al final, fuera del orden y no se puede fijar bien. |
| D6 | Enlaces del ecosistema inconsistentes: UNUmbral tiene `../directorio/` fijo en `index.html` (roto en localhost y en el APK Capacitor, que corre en `https://localhost`), los demás usan `http://localhost:PUERTO` fijo (roto si abres desde `127.0.0.1` o desde el móvil por IP de la LAN). | UNUmbral, todos | Saltos entre apps que fallan según cómo abras. |
| D7 | Contadores desactualizados: Directorio "18 disciplinas", omni-life "14 disciplinas / 14 Juegos / 12 rutinas", README de Arena "10 disciplinas". | varios | Información falsa en la portada. |
| D8 | `isTouch = 'ontouchstart' in window \|\| maxTouchPoints > 0` (`GameShell.ts:99-102`) ⇒ laptops con pantalla táctil o Windows con controlador táctil reciben UI móvil. | omni-arena | Botones táctiles encima del juego en un PC con ratón. |
| D9 | No hay explicación previa: el clic en una tarjeta lanza la partida directo; los controles solo aparecen como texto chico en el HUD. Cambios de fase del Circuito duran 0.85-1.15 s. | omni-arena | Mareo y frustración: el usuario no sabe qué hacer antes de perder escudos. |
| D10 | Fricciones puntuales en juegos (detalle en §3.5). | omni-arena | — |
| D11 | Glifos pictográficos en UI (`◀ ▶` en BlitzStacker, `↔` en `dimension: '2D ↔ 3D'`, `✕` previsto). Algunos se renderizan como emoji según la plataforma. | omni-arena | Viola la regla "cero emojis, solo SVG". |

---

## 1. Principios visuales (aplican a los 4 repos)

1. **Heredar el estilo de cada repo** (`inherit-legacy-style`): no se unifica la paleta. Cada app conserva sus tokens:
   - omni-arena: `--bg-void/--bg-panel/--ink-primary/--accent-cyan…`, fuentes Chakra Petch / Barlow / JetBrains Mono, emblemas en rombo `oa-diamond-badge`, `data-theme="day|night"`.
   - omni-life y directorio: tokens de `omni-life/DESIGN.md` (verde `#166534`/`#34d399`, Bricolage Grotesque / Figtree), rombos `al-diamond-emblem` / `dir-brand-emblem`, `data-theme="day|night"`.
   - UNUmbral: `--primary/--accent/--text-*` con `data-theme="light|dark"`.
   Lo único compartido es el **contrato de DOM** de la barra del ecosistema (§2.2); cada repo lo pinta con sus propios tokens.
2. **`impeccable`**: cero emojis y cero glifos pictográficos en UI (se verifica con regex `\p{Extended_Pictographic}`); iconos SVG en línea de un solo trazo (`stroke="currentColor"`, `stroke-width="2"`, `fill="none"`); sin kickers/eyebrows encima de títulos; texto con contraste ≥ 4.5:1 (≥ 3:1 en texto ≥ 24 px y bordes de controles); todo control con estados visibles: reposo, hover, foco (`:focus-visible` con anillo de 2 px), presionado (`aria-pressed`), deshabilitado (opacidad + `cursor:not-allowed` + `disabled`).
3. **Botones con texto**: ningún botón de cabecera queda solo con icono. Icono + etiqueta corta visible (en móvil < 420 px la etiqueta se puede abreviar, nunca ocultar).
4. **Movimiento**: se respeta `prefers-reduced-motion` y el ajuste nuevo `Reducir movimiento` (§3.6).

---

## 2. Arquitectura de unificación del ecosistema

### 2.1 Mapa de apps y URLs

| App (`EcoAppId`) | Etiqueta | Etiqueta corta | Puerto local | Ruta en github.io |
|---|---|---|---|---|
| `directorio` | Directorio | Directorio | 5178 | `/directorio/` |
| `atelier` | Atelier Diario | Atelier | 5176 | `/atelier-diario/` |
| `unumbral` | UNUmbral | UNUmbral | 5177 | `/UNUmbral/` |
| `arena` | OMNI ARENA | Arena | 5175 | `/omni-arena/` |

**Algoritmo único `resolveEcoUrl(app, { hash?, carryTheme? })`** (mismo comportamiento en los 4 repos; función pura con `location` inyectable para poder testearla):

1. Si existe URL personalizada (`companionUrls` del Directorio, solo en directorio y omni-life) → úsala.
2. Si `hostname` termina en `github.io` → ruta relativa `../<ruta>/` (mismo origen: todo se comparte).
3. Si es entorno Capacitor (`window.Capacitor` definido) **o** `hostname === 'localhost'` con `port === ''` → URL absoluta `https://tpdeax.github.io/<ruta>/`.
4. Si `hostname` es `localhost`, `127.0.0.1` o una IP privada (`10.*`, `192.168.*`, `172.16-31.*`) con puerto → `${protocol}//${hostname}:${puerto}/` (se conserva el host para que funcione desde el móvil por LAN).
5. Cualquier otro caso → absoluta `https://tpdeax.github.io/<ruta>/`.
6. Si el destino es de **otro origen** (casos 3-5) y `carryTheme !== false` → se añade `?eco_theme=light|dark` **antes** del `#hash`.
7. `hash` se agrega al final (`#studio`, `#singing`, …).

### 2.2 Barra switcher compartida (contrato de DOM)

Se monta arriba de todo, en las 4 apps (en OMNI ARENA solo en el Hub; dentro de una partida se oculta para no distraer).

```html
<nav class="eco-switch" aria-label="Aplicaciones del ecosistema">
  <a class="eco-switch-link" data-eco-app="directorio" href="…">[svg]<span>Directorio</span></a>
  <a class="eco-switch-link" data-eco-app="atelier"    href="…">[svg]<span>Atelier Diario</span></a>
  <a class="eco-switch-link" data-eco-app="unumbral"   href="…">[svg]<span>UNUmbral</span></a>
  <a class="eco-switch-link is-current" data-eco-app="arena" aria-current="page" href="…">[svg]<span>OMNI ARENA</span></a>
</nav>
```

- Orden fijo: Directorio · Atelier Diario · UNUmbral · OMNI ARENA.
- Iconos SVG de un trazo: cuadrícula (Directorio), libro abierto (Atelier), birrete (UNUmbral), hexágono con círculo (`Icons.omni` de Arena).
- App actual: `aria-current="page"` + `.is-current` (fondo con el acento de esa app, texto con contraste ≥ 4.5:1). No es clicable de forma útil (href a sí misma está bien).
- Alto 40 px; enlaces con área táctil ≥ 40×40; en < 420 px se usa la etiqueta corta y la barra hace scroll horizontal sin barra visible.
- Variables CSS por app: `--eco-bg`, `--eco-ink`, `--eco-ink-muted`, `--eco-accent`, `--eco-accent-ink`, `--eco-border` mapeadas a los tokens de cada repo (no colores nuevos).
- Reemplaza los enlaces sueltos actuales: `oa-dir-back` y `oa-eco-link` (Arena), `al-back-dir-btn` del header (omni-life; el de "Directorio interno" `data-route="home"` se mantiene porque es navegación interna), `eco-dir-btn` y los `eco-link-chip` (UNUmbral; los chips pasan a usar `data-eco-app` y se reescriben con el mismo resolutor).

### 2.3 Tema compartido real (`umbral-theme`)

**Fuente de verdad:** `localStorage['umbral-theme']` con valores canónicos **`light` | `dark`**. Lectores aceptan también los heredados `day`→`light` y `night`→`dark` (`normalizeEcoTheme`).

Cada app mantiene su vocabulario interno (`day/night` en Arena, omni-life y Directorio; `light/dark` en UNUmbral) pero:

1. **Al arrancar**, en este orden: `?eco_theme=` (si viene, se guarda en `umbral-theme` y se elimina de la URL con `history.replaceState`) → `umbral-theme` → tema propio guardado → `prefers-color-scheme`.
2. **Al cambiar el tema** en la app → escribe `umbral-theme` (canónico) + su estado interno.
3. **En vivo (mismo origen):** listener `window.addEventListener('storage', e => e.key === 'umbral-theme')` y re-lectura en `visibilitychange` → aplica sin recargar.
4. **Entre orígenes (localhost por puertos):** la barra switcher lleva `?eco_theme=` (§2.1 paso 6), así el salto entre puertos llega con el tema correcto.
5. Tras aplicar un perfil remoto de Supabase (Arena `settings.theme`, Atelier `theme`) se **reaplica** `umbral-theme`: la preferencia del dispositivo gana sobre la nube.

Directorio corrige `getTheme/setTheme` para leer/escribir `light/dark` (D1).

### 2.4 Datos compartidos y "honestidad de origen"

- En **github.io** (mismo origen) cada app puede leer las claves de las otras (§2.5).
- En **localhost por puertos** no hay `localStorage` compartido (D3). Fuentes alternativas en orden: Supabase (`ecosystem_state`, si la Nube está configurada) → nada. La UI lo dice claro, sin ceros falsos: *"Sin datos de esta app en este origen. Abre el ecosistema publicado o activa la Nube para verlos aquí."* (texto exacto, una línea, con botón `Configurar Nube` donde exista).
- Se descarta un proxy/gateway de desarrollo de un solo origen (choca con `base: './'` y los `/src/main.ts` de Vite); queda anotado como mejora futura.

### 2.5 Claves de `localStorage` (contrato entre apps)

| Clave | Escribe | Leen | Forma |
|---|---|---|---|
| `umbral-theme` | las 4 | las 4 | `'light' \| 'dark'` (aceptar `day/night` al leer) |
| `omni_arena_profile_v1` | Arena (`ProfileStore`) | Directorio, omni-life | `PlayerProfile` de Arena (`level`, `xp`, `ratings{aim,rhythm,logic,reflex,agility}`, `bestScores`, `playCounts`, `history`, `dailyStreak`) |
| `omni_arena_catalog_meta_v1` **(nueva)** | Arena al arrancar | Directorio, omni-life | `{ version: 1, total: number, academies: number, dexterity2d: number, action3d: number, updatedAt: number }` |
| `atelier_diario_profile_v1` | omni-life (`LifeStore`) | Directorio, Arena (Pulso) | `LifeProfile` (`dailyStreak`, `lastActiveDay`, `todayHabits: Record<HabitKey, boolean>`, `theme`, `stats…`) |
| `atelier_umbral_snapshot_v1` | omni-life (`UmbralBridge`) | Directorio, Arena (Pulso) | `{ clases?, tareas?, cursos?, _source?, _updatedAt? }` |
| `unumbral_last_snapshot_v1` **(nueva forma)** | UNUmbral | Directorio, Arena (Pulso) | `{ version: 1, updatedAt: number, coursesCount: number, pendingTasks: number, todayClasses: number, cyclesCount: number }` (solo conteos, sin datos personales) |
| `atelier_cloud_sync_v1` | todas (ya existe) | todas | config Supabase compartida (no cambia) |

Orden de lectura de cada dato en el Directorio y el Pulso: **remoto Supabase (si más nuevo) → clave local nueva → clave local heredada**. Ejemplo UNUmbral: `unumbral_backup` remoto → `unumbral_last_snapshot_v1` → `atelier_umbral_snapshot_v1`.

**Fallback de contadores:** si `omni_arena_catalog_meta_v1` no está (otro origen), usar la constante `{ total: 26, academies: 8, dexterity2d: 13, action3d: 5 }`.

### 2.6 Fix de `directorio/src/state/DirectoryStore.ts`

1. `DEFAULT_DIRECTORY_ORDER`: insertar `'mod-focuslab'` después de `'mod-vault'`. `normalizeConfig` ya fusiona órdenes antiguos, así que no hace falta migración.
2. `getTheme/setTheme`: canónico `light/dark` (§2.3), devolviendo `ThemeMode` interno `day/night`.
3. `buildCompanionSummary` reescrito:
   - **Atelier:** `atelier_diario_profile_v1` (fallback `atelier_profile_v2`). `atelierStreak = dailyStreak`; `atelierTodayDone` = nº de `todayHabits` en `true` **solo si** `lastActiveDay === hoy (YYYY-MM-DD local)`; `atelierTotalModules = Object.keys(todayHabits).length || 9`. Se elimina `atelierLevel` (el perfil no tiene XP); la tarjeta muestra "Racha N días · X/9 hábitos hoy".
   - **UNUmbral:** orden del §2.5; con snapshot nuevo usa los conteos; con `atelier_umbral_snapshot_v1` cuenta arrays (`cursos.length`, tareas con `completada !== true`).
   - **Arena:** `omni_arena_profile_v1` o `arena_profile` remoto. `overall = promedio(ratings)`; `arenaRank` = grado con la misma tabla de `ratingToRank` de Arena (OMNI ≥900, SS ≥800, S ≥700, A ≥580, B ≥460, C ≥340, D); `arenaSessions = Σ playCounts`; `arenaScore = max(bestScores)`. Se elimina el texto fijo `'BRONZE II'`.
4. Tarjetas: `app-arena` → `"<total> disciplinas · <academies> academias"` desde `omni_arena_catalog_meta_v1`; `mod-singing` → `"Canto, piano de 2 octavas y oído"`.

### 2.7 Widget "Pulso del Ecosistema" (OMNI ARENA, Hub)

Ubicación: debajo del bloque héroe/radar, antes de las pestañas de disciplinas. Una fila de 3 tarjetas compactas (en móvil, columna):

| Tarjeta | Contenido | Botón |
|---|---|---|
| Atelier Diario | "Racha N días" + barra X/9 hábitos hoy | `Abrir Atelier` → `resolveEcoUrl('atelier')` |
| UNUmbral | "N tareas pendientes" + "N clases hoy" | `Abrir UNUmbral` |
| Directorio | "Tu índice OMNI: 512 · B" (dato propio de Arena, siempre disponible) | `Abrir Directorio` |

- Datos: `readEcoPulse()` (local) y, si la Nube está configurada, `readEcoPulseWithCloud()` (usa `arenaCloudSync.pullScope('atelier_profile' | 'unumbral_backup')`, caché en memoria 60 s, nunca bloquea el render: primero pinta lo local y luego actualiza).
- Estado vacío por tarjeta con el texto honesto del §2.4. Sin animaciones de conteo.

### 2.8 Puertos y arranque local

- omni-arena `vite.config.mts`: `server: { port: 5175, strictPort: true }`, `preview: { port: 5175, strictPort: true }`.
- omni-life `vite.config.mts`: igual con 5176.
- directorio: ya usa 5178 en `package.json`.
- UNUmbral (sin bundler): nuevo `scripts/dev-server.mjs` (servidor estático con `node:http`, sin dependencias, sirve la raíz del repo en 5177, tipos MIME básicos, `index.html` por defecto) + script `"dev": "node scripts/dev-server.mjs"`.

### 2.9 Service workers

Cada app que cambia sube la versión de caché: `omni-arena-v4 → v5`, omni-life `v5 → v6`, directorio `+1`, UNUmbral `v4 → v5` (y UNUmbral añade `lib/ecosistema.js` a la lista precacheada). UNUmbral ejecuta `npm run build:web` para reflejar los cambios en `www/`.

### 2.10 Contadores a actualizar (D7)

| Archivo | Hoy | Después |
|---|---|---|
| `directorio/src/main.ts:183` | `18 disciplinas cognitivas` | desde meta (`26 disciplinas · 8 academias`) |
| `directorio/src/main.ts:147` | `12 ejercicios y afinador` | `Canto, piano de 2 octavas y oído` |
| `omni-life/src/views/HomeView.ts:116,122` | `14 disciplinas…`, `14 Juegos` | desde meta |
| `omni-life/src/views/HomeView.ts:229` | `12 rutinas` | número real de rutinas de `SingingBank` |
| `omni-arena/README.md:3` | `10 disciplinas` | 26 (18 de circuito + 8 academias) |
| `omni-arena` catálogo `gauntlet`/`ranked` | `18 Disciplinas` fijo | derivado de `CIRCUIT_IDS.length` |

---

## 3. Sistema anti-mareo e intuitividad en OMNI ARENA

### 3.1 Categorías del catálogo

Se agrega `category` al descriptor (no se crea un 6.º eje del radar, así no hay migración de `ratings`):

| `GameCategory` | Pestaña | Juegos |
|---|---|---|
| `academy` | Academias Guiadas | chess2d, checkers2d, poker2d, rubik3d, piano2d, raven2d, sudoku2d, hanoi2d (8) |
| `dexterity2d` | Destreza 2D | los 13 juegos 2D actuales |
| `action3d` | Acción 3D | aim3d, runner3d, cube3d, parkour3d, flight3d (5) |
| `circuit` | (botones héroe) | gauntlet, ranked |

- **El Circuito Total y la Clasificatoria siguen usando solo los 18 juegos de destreza/acción** (`CIRCUIT_IDS`). Las academias no entran en rebanadas de 15 s (no tiene sentido una partida de ajedrez de 15 s).
- El reto diario (`getDailyTriad`) se elige de `CIRCUIT_IDS`.
- Las academias puntúan en los ejes existentes: ajedrez, damas, póker, matrices, sudoku y Hanói → `logic`; rubik → `agility` + `logic`; piano → `rhythm`.
- `dimension` pasa de `'2D ↔ 3D'` a `'2D + 3D'` (sin glifo pictográfico).

### 3.2 Hub

```
[eco-switch: Directorio · Atelier Diario · UNUmbral · OMNI ARENA]
[OMNI ARENA  26 disciplinas]      [Nube] [Tema: Noche] [Sonido: Sí] [Ajustes]  [racha] [NV]
[Héroe: título + dificultad + CIRCUITO TOTAL / CLASIFICATORIA]      [Radar + reto diario]
[Pulso del Ecosistema: Atelier | UNUmbral | Directorio]
[Pestañas: Academias Guiadas (8) | Destreza 2D (13) | Acción 3D (5) | Todo (26)]   [Buscar juego…]
[Cuadrícula de tarjetas]
[Últimas sesiones]
```

- **Pestañas** con `role="tablist"`/`role="tab"`/`aria-selected`, contador entre paréntesis, flechas izquierda/derecha cambian de pestaña. Primera visita (sin historial) → `Academias Guiadas`; luego se recuerda la última (`settings.hubTab`).
- **Buscador** `<input type="search">` con etiqueta visible "Buscar juego", filtra en vivo por título, subtítulo, descripción y `keywords` del descriptor, ignorando tildes y mayúsculas, dentro de la pestaña activa; si no hay resultados en la pestaña pero sí en `Todo`, muestra "Sin resultados aquí. Ver N en Todo" (botón). Atajo `/` enfoca el buscador.
- **Cabecera**: cada botón con icono + texto visible: `Nube` (o `Nube · <espacio>`), `Tema: Día|Noche`, `Sonido: Sí|No`, `Ajustes`. Los enlaces "Directorio" y "UNUmbral" sueltos desaparecen (los cubre la barra del ecosistema).
- **Tarjeta de juego** = `<article>` con dos controles hermanos (no anidados): botón principal (toda el área superior: rombo, título, descripción) que abre la Ficha Previa (o entra directo si el usuario lo eligió) y un botón secundario `Guía` en el pie. Si el juego está en "entrar directo", el pie muestra la etiqueta `Entrada directa`.
- Ajustes nuevos en el modal: `Reducir movimiento` (checkbox), `Restablecer guías` (vuelve a mostrar todas las fichas previas).

### 3.3 Ficha Previa Guiada (`GuideOverlay`)

Modal accesible (`role="dialog"`, `aria-modal`, foco atrapado, `Esc` = volver) que aparece al elegir un modo:

```
┌───────────────────────────────────────────────────────────┐
│ [rombo] AJEDREZ ACADEMIA                          [Cerrar] │
│ Objetivo: Da jaque mate al rey rival… (1-2 líneas)         │
│ ┌──────── Ejemplo ────────┐  ┌──── Botones y teclas ────┐ │
│ │ [SVG cuadro 1 de 3]     │  │ [Clic] Elegir pieza       │ │
│ │ "Las casillas verdes…"  │  │ [Clic] Mover a casilla    │ │
│ │ [Anterior] 1/3 [Siguiente]│ │ [P] Pista  [U] Deshacer   │ │
│ └─────────────────────────┘  └───────────────────────────┘ │
│ Cómo se juega: 1. … 2. … 3. …                              │
│ [ PRÁCTICA GUIADA (sin perder vidas) ]  [ MODO RETO (Oficial) ] │
│  Práctica: pistas y deshacer ilimitados.  Reto: cuenta para tu radar. │
│ [ ] Entrar directo la próxima vez                          │
└───────────────────────────────────────────────────────────┘
```

- **Objetivo**: `guide.objective` (≤ 140 caracteres).
- **Ejemplo**: `guide.example` = 2-4 cuadros SVG (viewBox `0 0 320 180`, colores por variables CSS para respetar tema) con pie de texto; botones `Anterior`/`Siguiente`, indicador `1/3`, avance automático cada 3.5 s que se detiene al interactuar y no existe con movimiento reducido.
- **Mapa de botones/teclas**: `guide.controls` (pistas `ControlHint`). En PC se muestran `<kbd>`; en táctil, el texto `touch`. Se marca con color de tono (`primary` = acento, `danger` = rojo) para que coincida con los botones reales del juego.
- **Botones**: `PRÁCTICA GUIADA (sin perder vidas)` (secundario, con borde) y `MODO RETO (Oficial)` (primario, relleno). Debajo, una línea con `guide.practice` y `guide.challenge`. `Enter` activa Práctica (la opción segura).
- Para `gauntlet` y `ranked` solo hay un botón: `EMPEZAR CIRCUITO` / `EMPEZAR CLASIFICATORIA`.
- **`Entrar directo la próxima vez`**: si se marca y se elige un modo, la próxima vez el clic en la tarjeta entra directo en **Modo Reto**. Se guarda en `settings.skipGuideFor`. Se revierte desde el botón `Guía` de la tarjeta (que siempre abre la ficha) o con `Restablecer guías`.

### 3.4 Dentro de la partida

- **Barra inferior fija de Controles Activos** (`<footer class="oa-controls-bar">`, 44 px + `env(safe-area-inset-bottom)`): pistas del modo (`guide.controls` o lo que el juego publique con `ctx.setControls`). Visible también en móvil (una línea con scroll horizontal). El escenario (`oa-stage-host`) se achica para que la barra **nunca tape** el juego ni sus botones táctiles.
- **Botón `? Guía`** en el HUD (icono de ayuda + texto `Guía`), también con la tecla `?`: pausa y abre la ficha en modo "en partida" con `Volver a la partida` (primario) y `Reiniciar en Práctica` / `Reiniciar en Reto`.
- **Distintivo `PRÁCTICA`** en el HUD durante la práctica.
- **Práctica Guiada (comportamiento central en el shell, sin tocar cada juego):**
  - `ctx.damage()` no resta escudos: devuelve los escudos actuales y muestra el aviso breve "Error · en práctica no pierdes escudos".
  - Si el juego llama `ctx.finish()` (fin de tiempo, por ejemplo), el shell no cierra: muestra "Práctica completada" con `Seguir practicando` (recrea el juego) y `Terminar y ver resumen`.
  - Botón `Terminar práctica` en el HUD.
  - El resumen de práctica no cambia `ratings`, récords ni reto diario; da XP reducida (`min(60, round(duracionSeg × 0.8))`) y muestra el botón `Probar MODO RETO`.
- **Academias en el HUD**: se ocultan escudos, combo e intensidad (no aplican); quedan título, estado (`subStat`), cronómetro y botones.
- **Teclas reservadas por el shell**: `Escape` (pausa) y `?` (guía). Ningún juego puede usarlas.

### 3.5 Corrección de fricciones en los 18 juegos existentes

| Juego / archivo | Problema | Corrección exacta |
|---|---|---|
| Shell (`GameShell.ts`) | `isTouch` con falsos positivos (D8) | Nuevo `detectTouchPrimary()` en `src/utils/input.ts`: `coarse = matchMedia('(pointer: coarse)')`, `anyFine = matchMedia('(any-pointer: fine)')`, `hoverNone = matchMedia('(hover: none)')`; táctil = `coarse && (hoverNone \|\| !anyFine)`. `touchControls: 'always' \| 'off'` siguen forzando. |
| `Aim3DGame.ts` | El clic que activa `pointerLock` también dispara | En `onMouseDown`: si no hay lock, pedirlo y `return` sin disparar; al pasar a "bloqueado" ignorar disparos 150 ms. El aviso dice "Haz clic para fijar la mira (este clic no dispara)". |
| `NeonSnake2DGame.ts` | Solo detecta un deslizamiento al soltar el dedo | Deslizamiento continuo: en `pointermove`, si el desplazamiento desde el ancla supera 24 px, aplicar dirección (ignorando la opuesta) y mover el ancla al punto actual (varios giros por arrastre). Además D-pad táctil de 4 botones SVG (56 px) abajo al centro cuando `isTouch`. |
| `MemoryGrid2DGame.ts` | Al fallar salta a otra ronda sin mostrar la respuesta | Fase `reveal` de 1.1 s: celdas objetivo con borde verde, la celda pulsada en rojo, entrada bloqueada; recién después `startRound()`. El tiempo de `reveal` respeta la pausa (se descuenta en `update`). |
| `DualNBack2DGame.ts` | Sin noción del tiempo restante; no hay forma de responder "no coincide" | Barra de tiempo horizontal por paso (ancho = `stepTimer / stepDuration`). Tercer botón `No coincide` (tecla `Espacio`): cuenta como rechazo correcto si no había coincidencia, o como fallo si sí la había, y adelanta el paso. Las celdas activas pierden el glifo `◆` y usan un cuadrado CSS. |
| `PrecisionTarget2DGame.ts` | Los señuelos rojos solo se distinguen por color | Dibujar en canvas una X (dos líneas, grosor 3) + texto `NO` debajo en cada señuelo (no glifo `✕`). Apto daltonismo. |
| `PuzzleMatrix2DGame.ts` | Chimp oculta los números sin aviso; Simon usa `setTimeout` y no se pausa | Chimp: texto previo "Recuerda las posiciones: al pulsar el 1 se ocultan los demás" visible hasta el primer toque. Simon: la reproducción pasa a una línea de tiempo dentro de `update(dt)` (sin `setTimeout`), así `setPaused` la detiene de verdad; los tiempos pendientes se limpian en `destroy`. |
| `BlitzStacker2DGame.ts` | Sin "bajar" en móvil; previews de Siguiente/Reserva desaparecen en pantallas estrechas; glifos `◀ ▶` | Botón táctil `BAJAR` (caída suave mantenida). En anchos < 520 px las previews pasan a una franja superior compacta (no se ocultan). Botones con iconos SVG y texto (`Izquierda`, `Rotar`, `Derecha`, `Bajar`, `Caída`, `Reserva`). |
| `SonicRing2DGame.ts` | `subStat` dice "ESPACIO / CLIC" también en móvil | Texto según `isTouch`: táctil "Toca la pantalla cuando la aguja cruce el arco"; PC "Espacio, clic, J o K cuando la aguja cruce el arco". |
| `GauntletOrchestrator.ts` | Cambio de fase de 0.85-1.15 s | El cartel de transición espera: botón `Listo (Espacio)`, toque en pantalla o `Espacio`/`Enter`. Muestra dimensión, título, objetivo de la guía y las 2-3 pistas principales. Si no hay respuesta en 8 s, continúa solo (con anillo de cuenta atrás; sin anillo con movimiento reducido). El reloj de la Clasificatoria no corre mientras espera. |
| Varios (`Runner3DGame`, `FlightPortals3DGame`, `SkyVault3DGame`, `OrbitBreaker3DGame`, `Aim3DGame`) | Movimientos de cámara que marean | Con `reduceMotion`: sin balanceo/roll de cámara, sin sacudida, FOV fijo; lo demás igual. |

### 3.6 Reducir movimiento

- `settings.reduceMotion` (por defecto = `prefers-reduced-motion: reduce`).
- El shell pone `data-motion="reduced"` en `<html>`; el CSS lo usa para quitar animaciones decorativas (pulsos, deslizamientos de cartel, conteos).
- Desactiva `screenShake` (aunque esté activado) y el avance automático de ejemplos en la guía.
- Rubik: giros de capa en 90 ms en vez de 220 ms y sin inercia de cámara.

---

## 4. Nuevas academias (OMNI ARENA)

Patrón común para las 8 academias:

- Implementan la interfaz `MiniGame` sin cambios de firma (`constructor(isGauntletSlice = false)`), montan su DOM dentro de `ctx.container` y usan los primitivos de `AcademyKit` (layout tablero + panel, pantalla de preparación, cuadro de explicación, selector de opciones, stepper de lecciones) y las clases de marcadores compartidas:
  - `.oa-mark-legal` punto verde (casilla/destino válido), `.oa-mark-capture` anillo rojo (captura), `.oa-mark-forced` pulso dorado (obligatorio), `.oa-mark-hint` borde azul (pista), `.oa-mark-illegal` borde rojo discontinuo con motivo en texto.
- **Pantalla de preparación** dentro del escenario: nivel (Novato/Club/Maestro o tamaño), preseleccionado desde `ctx.difficulty` (`chill`→0, `standard`→1, `hyper`→2, `adaptive`→según rating del eje), y botón `Empezar`.
- **Práctica** (`ctx.practiceMode === true`): pistas ilimitadas, deshacer, explicaciones después de cada error, sin límite de tiempo. **Reto**: sin deshacer, pistas limitadas o ninguna, resultado que llama `ctx.finish()` una sola vez.
- Toda explicación está en español, en frases cortas y con el **porqué**.
- Teclado opcional (nunca `Escape` ni `?`); todo se puede hacer con clic/toque.
- Escritorio ≥ 900 px: tablero a la izquierda, panel a la derecha. Móvil: tablero arriba, panel debajo, botones de acción de ancho completo y ≥ 44 px de alto.
- Lógica pura (reglas, generadores, bots, evaluadores) en módulos sin DOM ni Three.js para poder probarlos con Vitest; RNG inyectable (`mulberry32(seed)`).

### 4.1 `chess2d` — Ajedrez Academia y Duelo

- **Reglas completas legales**: movimiento de todas las piezas, jaque (no se permite dejar el rey en jaque), jaque mate, ahogado, enroque corto y largo (derechos, sin pasar por casillas atacadas ni estar en jaque), promoción con elección (`Dama`, `Torre`, `Alfil`, `Caballo`) mediante `showChoice`, captura al paso, regla de 50 movimientos, triple repetición, material insuficiente. Verificado con *perft* (ver plan).
- **Interacción**: clic/toque en pieza propia → se resalta; destinos con `.oa-mark-legal` (verde) y capturas con `.oa-mark-capture` (rojo). Último movimiento marcado; rey en jaque con halo rojo. Teclado: flechas mueven el cursor, `Enter`/`Espacio` seleccionan, `P` pista, `U` deshacer (solo práctica), `F` girar tablero.
- **Notación** en panel (SAN en español: R, D, T, A, C, p. ej. `Cf3`, `O-O`, `exd6 a.p.`).
- **4 lecciones jugables** (stepper):
  1. *Cómo se mueve cada pieza*: 6 mini retos (una pieza por tablero vacío) recogiendo estrellas-objetivo con el mínimo de jugadas.
  2. *Jaque: tres formas de salir*: posiciones donde hay que salir moviendo el rey, bloqueando o capturando (la lección explica cuál funciona y por qué las otras no).
  3. *Jugadas especiales*: enroque corto y largo, promoción, captura al paso (cada una con su posición de ejemplo).
  4. *Mates básicos*: 4 mates en 1 (pasillo, dama apoyada, dos torres, caballo + dama) y final guiado Rey + Dama contra Rey.
- **Pista que explica por qué**: busca la mejor jugada (bot nivel Club) y la explica con plantillas por motivo, en orden: mate ("Df7# es jaque mate: el rey no tiene casillas y nadie puede capturar la dama"), captura ganadora ("Cxe5 gana un peón sin defensa (+1)"), salvar pieza atacada, jaque con ventaja, enroque para seguridad del rey, desarrollo de pieza menor, control del centro. En práctica, tras una jugada del usuario que pierde ≥ 2 peones de valor: "Cuidado: tu alfil en c4 queda sin defensa" + botón `Deshacer`.
- **Bot de 3 niveles**: Novato (profundidad 1, prefiere capturas, 25% de jugadas aleatorias legales), Club (alfa-beta profundidad 2 con material + tablas de posición), Maestro (profundización iterativa hasta 4 con presupuesto de 700 ms, ordenación de jugadas). Antes de pensar se pinta "Pensando…" (ceder el hilo con `setTimeout(0)`).
- **Reto**: partida contra el bot (blancas o negras a elección). Puntuación: victoria 1000 + 300×nivel − 5×jugadas (mín. 400), tablas 400, derrota 100 + 10×material capturado. `axisPerformances.logic` según resultado y nivel.

### 4.2 `rubik3d` — Cubo Rubik 3×3 en Three.js

- **Modelo lógico** de 54 pegatinas (orden U R F D L B, 9 por cara) con permutaciones por giro; colores: U amarillo, D blanco, F verde, B azul, R rojo, L naranja (blanco abajo, como en el método enseñado). Sin giros de cubo completo: la orientación la cambia solo la cámara.
- **Vista**: 26 cubitos (27 menos el núcleo) con pegatinas; giro de capa animado (agrupar cubitos de la capa en un pivote, rotar π/2 en 220 ms con easing, fijar transformaciones redondeando posiciones a enteros). Tras cada giro, verificación en desarrollo: colores renderizados = modelo.
- **Cámara orbital** (`OrbitControls`): arrastrar el fondo orbita, rueda/pellizco hace zoom limitado, amortiguación, ángulo polar limitado a [0.15π, 0.85π], sin autorrotación. Botón `Vista estándar`. Flechas del teclado orbitan en pasos de 15°.
- **Botones de giro claros**: `U` `D` `L` `R` `F` `B` (texto grande) + interruptor `'` (`aria-pressed`, rótulo "Antihorario activo" cuando está encendido). Cada botón lleva una mini flecha SVG que cambia de sentido según el interruptor. **Indicador visual**: al pasar el ratón o enfocar un botón aparece una flecha curva sobre esa cara del cubo mostrando el sentido (horario visto de frente a esa cara). Teclado: letra = horario, `Shift`+letra = antihorario. Etiquetas opcionales de cara (`Mostrar letras de caras`).
- **Guía de 5 fases (método principiante)** con detección automática de la fase alcanzada y barra de progreso:
  1. Cruz blanca (aristas blancas abajo, alineadas con los centros).
  2. Primera capa (esquinas blancas).
  3. Segunda capa: `U R U' R' U' F' U F` (derecha) / `U' L' U L U F U' F'` (izquierda).
  4. Cruz amarilla: `F R U R' U' F'`.
  5. Última capa: 5a aristas amarillas `R U R' U R U2 R' U`, 5b colocar esquinas `U R U' L' U R' U' L`, 5c orientar esquinas `R' D' R D` (repetir).
  Cada fase tiene `Ver ejemplo`: guarda el estado del usuario, prepara un estado de ejemplo, anima el algoritmo resaltando cada movimiento en la notación y ofrece `Volver a mi cubo`.
- **Cronómetro**: práctica sin presión (mezcla suave de 5-8 giros u oficial de 20). Reto: mezcla de 20 giros (sin repetir cara seguida) + 15 s de inspección + cronómetro hasta resolver. Puntuación por tiempo y número de giros. `axisPerformances.agility` y `logic`.

### 4.3 `checkers2d` — Damas Tácticas 8×8

- **Reglamento único ("damas latinas")**: peones avanzan en diagonal; **capturan hacia adelante y hacia atrás**; captura **obligatoria**; las capturas en cadena deben completarse; dama voladora (se mueve y captura a cualquier distancia en diagonal); un peón que llega a la última fila al terminar su jugada se corona; si llega en mitad de una cadena y la cadena sigue, no se corona. Si hay varias secuencias de captura, el jugador elige cualquiera (sin ley de la mayoría; se explica en la guía).
- **Marcadores**: piezas obligadas a capturar con **pulso dorado** (`.oa-mark-forced`), destinos válidos en verde, ruta de captura en cadena dibujada con línea y numeración 1-2-3.
- **Ejemplos tácticos**: lección "Golpe 2×1" (entregar una pieza para capturar dos), "Tenaza", "Coronar a tiempo", cada uno jugable.
- **Bot**: Novato (profundidad 1 + aleatoriedad), Club (alfa-beta 4), Maestro (alfa-beta 6). Pista con porqué ("Si mueves a e5 el rival captura dos piezas: d4 y f4").
- **Reto**: partida contra el bot; puntuación por resultado, nivel y piezas restantes.

### 4.4 `poker2d` — Póker Texas Hold'em educativo (sin dinero real)

- Texto fijo visible: "Fichas de práctica. Sin dinero real." Mesa con el usuario + 3 bots (Lucía *prudente*, Mateo *equilibrado*, Sofía *agresiva*), 1000 fichas cada uno, ciegas 10/20.
- **Guía visual de las 10 manos** (panel plegable, siempre accesible): Escalera Real, Escalera de Color, Póker, Full, Color, Escalera, Trío, Doble Pareja, Pareja, Carta Alta, cada una con 5 mini cartas SVG y una línea de explicación. **La mano actual del usuario se resalta** en esa lista en cada calle.
- **Acciones** con botones grandes y explicación debajo de cada uno: `Pasar` (sin apostar, solo si nadie apostó), `Igualar N` (pagar la apuesta actual), `Subir` (con presets `Mínimo`, `½ bote`, `Bote`, `Todo`) y `Retirarse` (abandonar la mano). Los no disponibles quedan deshabilitados con motivo en `title` y texto.
- **Práctica**: medidor de fuerza (probabilidad aproximada de ganar por Monte Carlo, 600 simulaciones contra los jugadores activos, recalculado por calle), **outs** listados con sus cartas (proyecto de color/escalera) y regla del 2 y 4; consejo del entrenador con porqué ("Igualar cuesta 40 para ganar 200: necesitas 17% y tienes ~32%"). Opción `Mostrar cartas de los bots al final`.
- **Bots**: decisiones por fuerza de mano + pot odds + estilo; sin trampas (no ven cartas ajenas).
- **Reto**: 20 manos o hasta quedar eliminado. Puntuación = fichas finales (+500 si sobrevive). Evaluador de manos determinista con desempates/kickers y escalera baja A-2-3-4-5.

### 4.5 `piano2d` — Piano Maestro y Oído Musical

- **Piano de 2 octavas Do3–Do5** (MIDI 48–72; 15 blancas, 10 negras). En cada tecla se pintan el nombre (`Do`, `Re`, `Mi`, …, `Do#`…) y la **tecla del PC** como `<kbd>`. Selector `Mostrar: Nombres / Teclas / Ambos`. Ratón, toque (multitoque) y teclado físico.
- **Mapa de teclas PC** (por `KeyboardEvent.code`, independiente de la distribución del teclado; idéntico en omni-life):

  | MIDI | Nota | code | Etiqueta | | MIDI | Nota | code | Etiqueta |
  |---|---|---|---|---|---|---|---|---|
  | 48 | Do3 | KeyZ | Z | | 61 | Do#4 | Digit2 | 2 |
  | 49 | Do#3 | KeyS | S | | 62 | Re4 | KeyW | W |
  | 50 | Re3 | KeyX | X | | 63 | Re#4 | Digit3 | 3 |
  | 51 | Re#3 | KeyD | D | | 64 | Mi4 | KeyE | E |
  | 52 | Mi3 | KeyC | C | | 65 | Fa4 | KeyR | R |
  | 53 | Fa3 | KeyV | V | | 66 | Fa#4 | Digit5 | 5 |
  | 54 | Fa#3 | KeyG | G | | 67 | Sol4 | KeyT | T |
  | 55 | Sol3 | KeyB | B | | 68 | Sol#4 | Digit6 | 6 |
  | 56 | Sol#3 | KeyH | H | | 69 | La4 | KeyY | Y |
  | 57 | La3 | KeyN | N | | 70 | La#4 | Digit7 | 7 |
  | 58 | La#3 | KeyJ | J | | 71 | Si4 | KeyU | U |
  | 59 | Si3 | KeyM | M | | 72 | Do5 | KeyI | I |
  | 60 | Do4 | KeyQ | Q | | | | | |

- **Modos** (pestañas dentro del juego): 
  1. *Piano Libre / Acordes*: tocar libremente; en "Acordes" una tecla toca el acorde elegido (`Mayor`, `menor`, `Séptima`) con su nombre ("Do mayor: Do-Mi-Sol"). Selector de timbre (`Piano`, `Órgano`, `Suave`, `Campana`).
  2. *Melodías guiadas "sigue la luz"*: la siguiente tecla se ilumina; en práctica espera a que la toques; en reto avanza a tempo y puntúa precisión y tiempo. 6 melodías de dominio público: Himno de la Alegría, Estrellita, Martinillo, Arroz con leche, Cumpleaños feliz, Para Elisa (tema).
  3. *Oído musical*: identificar intervalos (2ª menor a 8ª justa, nombres en español) y notas sueltas; botón `Repetir`; explicación tras cada respuesta ("Era una 5ª justa: 7 semitonos, como Do→Sol").
  4. *Lectura en pentagrama*: aparece una nota en clave de Sol (Do4–Do5, nivel 1) o de Fa (Do3–Si3, nivel 2) en SVG y hay que tocarla; en práctica se muestra el nombre tras 3 s.
- **Reto**: sesión combinada (melodía + 10 intervalos + 10 lecturas). `axisPerformances.rhythm` (y `logic` por lectura).

### 4.6 Ampliación de Canto y Piano en omni-life (`SingingView.ts` + `VoiceStudio.ts`)

Mantiene el estilo de omni-life (paneles `al-panel`, hero `al-module-hero` con rombo violeta `#6D28D9`).

- **Piano de 2 octavas Do3–Do5** con el mismo mapa de teclas PC (tabla §4.5), etiquetas nombre + tecla, selector de timbre (`Piano`, `Órgano`, `Suave`), notas sostenidas mientras la tecla está pulsada (`noteOn/noteOff`). El teclado físico solo se escucha mientras la vista está montada y nunca si el foco está en un `input`/`textarea`.
- **Rutinas por nivel** (selector `Nivel 1 · Inicial`, `Nivel 2 · Intermedio`, `Nivel 3 · Avanzado`), conservando las 12 rutinas actuales repartidas por nivel y agregando:
  - *Respiración 4-4-6*: animación de círculo (inhalar 4 s, sostener 4 s, exhalar 6 s) con texto; versión estática con movimiento reducido.
  - *Vibrato*: sostener una nota; el afinador mide oscilación (frecuencia 4.5–7 Hz y amplitud 20–60 cents = vibrato saludable) y lo muestra en texto ("Vibrato 5.6 Hz · ±34 cents").
  - *Rango vocal*: encontrar la nota más grave y la más aguda cómodas (sostener 1 s cada una); se guarda `vocalRangeLow/High` y se sugieren transposiciones.
  - *Canciones guiadas nota a nota*: las mismas melodías de dominio público, con transporte `-12 / 0 / +12` semitonos según el rango.
- **Barra tipo karaoke en vivo**: carril horizontal en canvas; las notas objetivo son barras a la altura de su tono que avanzan hacia una línea de "ahora"; la voz del usuario se dibuja como línea; acierto si está dentro de ±50 cents (±35 en nivel 3). Al final: porcentaje de notas acertadas y mejor marca por canción.
- **Mini entrenamiento de acordes y oído**: `Mayor o menor` (acorde tocado, dos botones), intervalos básicos (3ª, 5ª, 8ª), con explicación tras cada respuesta.
- Datos nuevos en `LifeProfile.stats`: `vocalRangeLow: number | null`, `vocalRangeHigh: number | null`, `singingSongBest: Record<string, number>`; en `modulePrefs.singing`: `level: 1 | 2 | 3`, `timbre`. `normalizeProfile` completa los valores por defecto.

### 4.7 `raven2d` — Matrices Lógicas 3×3

- Generador de matrices con atributos: forma (círculo, cuadrado, triángulo, rombo, hexágono), cantidad (1-3), tamaño (S/M/L), relleno (vacío, rayado, lleno), rotación (0/45/90°). Reglas por atributo: constante, progresión por columna, distribución de tres (cada fila es una permutación), y en nivel 4 superposición XOR de segmentos.
- Niveles: 1 (1 regla, 6 opciones), 2 (2 reglas, 8), 3 (3 reglas con distribución, 8), 4 (XOR, 8). Distractores: cada uno cambia exactamente un atributo de la respuesta y ninguno cumple todas las reglas.
- **Explicación escrita** tras responder (y en `Pista` en práctica): "En cada fila la cantidad aumenta de 1 a 3. La forma es la misma en cada fila. El relleno sigue el orden vacío → rayado → lleno." Se resaltan la fila y el atributo.
- Render SVG con trazo y rellenos de tokens (sin colores como única pista: el rayado es patrón).
- **Reto**: 12 matrices, 45 s cada una (60 s en Cadete). Puntuación por aciertos y tiempo.

### 4.8 `sudoku2d` — Sudoku Razonado

- Tamaños 4×4 (cajas 2×2), 6×6 (cajas 2×3) y 9×9 (3×3). Generador: tablero completo por backtracking aleatorio con RNG sembrado, luego quitar pistas mientras el solucionador (máscaras de bits, cuenta hasta 2 soluciones) confirme **solución única**. Dificultad por cantidad de pistas y por la técnica más difícil necesaria (Fácil: solo singles).
- Entrada: elegir celda (clic/flechas) y número (botones grandes o teclas 1–9); modo `Candidatos` (notas pequeñas); `Borrar`; `Deshacer` (práctica). Resaltado de fila, columna y caja de la celda activa, y de todos los números iguales.
- **Pista Razonada** (orden de técnicas): single desnudo, single oculto (fila/columna/caja), par desnudo (eliminación), intersección caja-línea. Texto con porqué y coordenadas "Fila 3, Columna 7": "En la fila 3 ya están 1, 4 y 6; en la columna 7 ya están 2, 5, 8 y 9; en la caja ya está el 3. Solo cabe el 7." Si ninguna técnica aplica: "Esta celda necesita una técnica avanzada; te mostramos el valor." (honesto).
- Práctica: conflictos marcados en rojo al instante. Reto: 3 errores máximo (`ctx.damage` por error), cronómetro, puntuación por tamaño, tiempo y errores.

### 4.9 `hanoi2d` — Torres de Hanói

- 3 a 6 discos, 3 torres (A, B, C). Seleccionar torre (clic/toque o teclas `1`/`2`/`3`) → destinos legales en verde, ilegales en rojo con motivo ("No puedes poner un disco grande sobre uno más pequeño").
- Contador de movimientos frente al óptimo `2^n − 1`.
- **Ejemplo recursivo paso a paso**: panel con la pila de llamadas (`hanoi(3, A→C)` → `hanoi(2, A→B)` …) que se expande y contrae; controles `Anterior`, `Siguiente`, `Reproducir`/`Pausar`; cada paso resalta el disco que se mueve y la llamada activa.
- Práctica: `Deshacer`, `Siguiente paso óptimo` (pista con porqué: "Primero hay que liberar el disco 3: mueve los 2 de arriba a la torre B"). Reto: n según dificultad (Cadete 3, Estándar 4, Élite 5, Dinámica según rating), cronómetro; un intento ilegal cuenta como error (`ctx.damage`). Puntuación = base × (óptimo / movimientos) + bonus de tiempo.

---

## 5. Descriptores de catálogo de las 8 academias

| id | title | subtitle | dimension | axis | accent | controlsPC | controlsTouch |
|---|---|---|---|---|---|---|---|
| `chess2d` | AJEDREZ ACADEMIA | Lecciones jugables y Duelo vs Bot | 2D | logic | `#A16207` | Clic en pieza y destino · P Pista · U Deshacer | Toca la pieza y luego la casilla |
| `checkers2d` | DAMAS TÁCTICAS | Capturas en cadena y coronación | 2D | logic | `#BE123C` | Clic en pieza y destino · P Pista | Toca la pieza y luego la casilla |
| `poker2d` | PÓKER EDUCATIVO | Texas Hold'em con fichas de práctica | 2D | logic | `#047857` | Botones Pasar · Igualar · Subir · Retirarse | Toca los botones de acción |
| `rubik3d` | CUBO RUBIK 3D | Método principiante en 5 fases | 3D | agility | `#C2410C` | U D L R F B (Shift = antihorario) · Arrastra para girar la vista | Botones de giro · Arrastra para girar la vista |
| `piano2d` | PIANO MAESTRO | Piano, melodías, oído y pentagrama | 2D | rhythm | `#9333EA` | Teclas Z–M y Q–I (ver teclas pintadas) | Toca las teclas del piano |
| `raven2d` | MATRICES LÓGICAS | Razonamiento abstracto tipo Raven | 2D | logic | `#4338CA` | Clic en la opción · 1–8 | Toca la opción correcta |
| `sudoku2d` | SUDOKU RAZONADO | 4×4 · 6×6 · 9×9 con pistas explicadas | 2D | logic | `#0369A1` | Flechas + 1–9 · N Candidatos · P Pista | Toca la celda y el número |
| `hanoi2d` | TORRES DE HANÓI | Recursión visual y movimientos óptimos | 2D | logic | `#15803D` | Teclas 1 · 2 · 3 o clic en torres | Toca origen y destino |

`accentSoft` = mismo color con alfa 0.14. Todas con `category: 'academy'`.

---

## 6. Riesgos y decisiones

| Riesgo | Decisión |
|---|---|
| localStorage no compartido en localhost | Se documenta y se muestra en UI; tema viaja por `?eco_theme=`; datos por Supabase si está configurada. |
| Choques de archivos entre 5 coders | Reparto estricto + Fase 0 del shell que congela contratos y crea archivos-semilla; luego cada coder es dueño exclusivo de sus archivos (ver plan). |
| CSS global de Arena (`style.css`) | Solo `coder-shell`. Cada academia importa su propia hoja (`src/styles/academy-*.css`) desde su archivo de juego. |
| Bots lentos bloqueando la UI | Presupuesto de tiempo + ceder el hilo antes de buscar; Web Worker opcional, no requerido. |
| Regresiones en los 18 juegos | Práctica y Listo del Circuito implementados en el shell/orquestador, no juego por juego; E2E de humo que monta los 26 modos. |
| Glifos que se ven como emoji | Revisión automática con `\p{Extended_Pictographic}` en `src/` de los 4 repos. |
