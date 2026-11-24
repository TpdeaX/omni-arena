import '../styles/neurolab.css';
import {
  ACADEMY_IDS,
  AXIS_META,
  CIRCUIT_IDS,
  DIFFICULTY_META,
  GAME_CATALOG,
  STANDALONE_IDS,
} from '../catalog';
import { synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import { arenaCloudSync } from '../services/CloudSync';
import {
  computeOverallRating,
  getDailyTriad,
  profileStore,
  ratingToRank,
  xpForLevel,
} from '../state/ProfileStore';
import {
  AcademySubFilter,
  DifficultyId,
  GameModeId,
  HubTabId,
  PlayerProfile,
  SkillAxis,
  StandaloneGameId,
} from '../types';
import {
  EcoPulseSummary,
  readEcoPulse,
  readEcoPulseWithCloud,
  renderEcoSwitchBar,
  resolveCompanionUrl,
} from '../utils/ecosystem';
import { getModeIconSvg, GuideOverlay } from './GuideOverlay';
import { renderRadarSvg } from './RadarChart';

const DIFFICULTY_ORDER: DifficultyId[] = [
  'chill',
  'standard',
  'hyper',
  'adaptive',
  'progressive',
];

const TAB_ORDER: { id: HubTabId; label: string }[] = [
  { id: 'academy', label: 'Academias Guiadas' },
  { id: 'dexterity2d', label: 'Destreza 2D' },
  { id: 'action3d', label: 'Acción 3D' },
  { id: 'all', label: 'Todo' },
];

const ACADEMY_SUB_ORDER: { id: AcademySubFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'neuro', label: 'NeuroLab' },
  { id: 'music', label: 'Música e Instrumentos' },
  { id: 'iq', label: 'IQ y Lógica' },
  { id: 'strategy', label: 'Estrategia y 3D' },
];

const ACADEMY_GROUP_LABELS: Record<Exclude<AcademySubFilter, 'all'>, string> = {
  neuro: 'NeuroLab · Cognición',
  music: 'Instrumento · Música Real',
  iq: 'IQ · Razonamiento',
  strategy: 'Estrategia · Tablero / 3D',
};

function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function matchesSearch(id: StandaloneGameId, queryNorm: string): boolean {
  if (!queryNorm) return true;
  const d = GAME_CATALOG[id];
  const haystack = normalizeSearch(
    [d.title, d.subtitle, d.description, ...(d.keywords ?? [])].join(' ')
  );
  return haystack.includes(queryNorm);
}

function matchesTab(
  id: StandaloneGameId,
  tab: HubTabId,
  academySub: AcademySubFilter
): boolean {
  const desc = GAME_CATALOG[id];
  if (tab === 'all') return true;
  if (desc.category !== tab) return false;
  if (tab === 'academy' && academySub !== 'all') {
    return desc.academyGroup === academySub;
  }
  return true;
}

export class HubView {
  private root: HTMLElement;
  private onLaunch: (modeId: GameModeId, practiceMode?: boolean, infiniteMode?: boolean) => void;
  private onOpenNeuroLab?: () => void;
  private activeModal: 'none' | 'settings' | 'cloud' | 'tutorial' = 'none';
  private activeGuide: GuideOverlay | null = null;
  private searchQuery = '';
  private cloudFeedback = '';
  private pulseData: EcoPulseSummary = readEcoPulse();
  private destroyed = false;

  constructor(
    root: HTMLElement,
    onLaunch: (modeId: GameModeId, practiceMode?: boolean, infiniteMode?: boolean) => void,
    onOpenNeuroLab?: () => void
  ) {
    this.root = root;
    this.onLaunch = onLaunch;
    this.onOpenNeuroLab = onOpenNeuroLab;
  }

  public destroy(): void {
    this.destroyed = true;
    this.activeGuide?.close(true);
    this.activeGuide = null;
    window.removeEventListener('keydown', this.onKeyDown);
  }

  private getActiveTab(profile: PlayerProfile): HubTabId {
    if (profile.settings.hubTab) return profile.settings.hubTab;
    return profile.history.length === 0 ? 'academy' : 'all';
  }

  private getAcademySubFilter(profile: PlayerProfile): AcademySubFilter {
    return profile.settings.academySubFilter ?? 'all';
  }

  public render(): void {
    this.destroyed = false;
    window.removeEventListener('keydown', this.onKeyDown);

    const profile = profileStore.get();
    const theme = profile.settings.theme ?? 'night';
    document.documentElement.setAttribute('data-theme', theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'day' ? '#FAFBF8' : '#0F1311');
    }
    document.documentElement.setAttribute(
      'data-motion',
      profile.settings.reduceMotion ? 'reduced' : 'normal'
    );

    const overall = computeOverallRating(profile.ratings);
    const rank = ratingToRank(overall);
    const nextXp = xpForLevel(profile.level);
    const xpPct = Math.min(100, Math.round((profile.xp / nextXp) * 100));
    const triad = getDailyTriad();
    const activeDiff = profile.settings.difficulty ?? 'adaptive';
    const diffInfo = DIFFICULTY_META[activeDiff] ?? DIFFICULTY_META.adaptive;
    const cloudCfg = arenaCloudSync.reloadConfig();
    const cloudReady = arenaCloudSync.isConfigured();
    const activeTab = this.getActiveTab(profile);
    const activeAcademySub = this.getAcademySubFilter(profile);

    const countAll = STANDALONE_IDS.length;
    const countAcademy = ACADEMY_IDS.length;
    const countDexterity = STANDALONE_IDS.filter(
      (id) => GAME_CATALOG[id].category === 'dexterity2d'
    ).length;
    const countAction3d = STANDALONE_IDS.filter(
      (id) => GAME_CATALOG[id].category === 'action3d'
    ).length;

    const tabCounts: Record<HubTabId, number> = {
      academy: countAcademy,
      dexterity2d: countDexterity,
      action3d: countAction3d,
      all: countAll,
    };

    const academySubCounts: Record<AcademySubFilter, number> = {
      all: countAcademy,
      neuro: ACADEMY_IDS.filter((id) => GAME_CATALOG[id].academyGroup === 'neuro').length,
      music: ACADEMY_IDS.filter((id) => GAME_CATALOG[id].academyGroup === 'music').length,
      iq: ACADEMY_IDS.filter((id) => GAME_CATALOG[id].academyGroup === 'iq').length,
      strategy: ACADEMY_IDS.filter((id) => GAME_CATALOG[id].academyGroup === 'strategy').length,
    };

    const neuro = profileStore.getNeuro();
    const neuroDailyDone = neuro.dailyPlan.steps.filter((s) => s.completed).length;

    const circuitCount = CIRCUIT_IDS.length;
    const totalSecRanked = circuitCount * 15;
    const rankedDurationLabel = `${Math.floor(totalSecRanked / 60)}m ${String(totalSecRanked % 60).padStart(2, '0')}s`;

    const formatLabel = (raw: string): string => {
      const cleaned = raw.trim();
      if (!cleaned) return '';
      if (cleaned !== cleaned.toUpperCase()) return cleaned;
      const lower = cleaned.toLowerCase();
      return lower
        .replace(/^(\S)/, (m) => m.toUpperCase())
        .replace(/\(ia\)/gi, '(IA)')
        .replace(/\b(2d|3d|iq|ai)\b/gi, (m) => m.toUpperCase());
    };

    const difficultyPills = DIFFICULTY_ORDER.map((dId) => {
      const meta = DIFFICULTY_META[dId];
      const active = dId === activeDiff;
      return `
        <button type="button" class="oa-diff-pill ${active ? 'is-active' : ''}" data-diff="${dId}" style="--diff-accent: ${meta.accent}">
          <span>${formatLabel(meta.label)}</span>
          <em>${formatLabel(meta.short)}</em>
        </button>
      `;
    }).join('');

    const historyRows = profile.history
      .slice(0, 5)
      .map((rec) => {
        const desc = GAME_CATALOG[rec.modeId];
        if (!desc) return '';
        const diffTag = rec.difficulty ? DIFFICULTY_META[rec.difficulty]?.label : '';
        const infTag = rec.infiniteMode ? ' · INF' : '';
        return `
        <div class="oa-hist-row">
          <span class="oa-hist-dot" style="background:${desc.accent}"></span>
          <span class="oa-hist-name">${desc.title}${diffTag ? ` <small>${diffTag}${infTag}</small>` : ''}</span>
          <span class="oa-hist-rank">${rec.rank}</span>
          <span class="oa-hist-score">${rec.score.toLocaleString('es-ES')}</span>
        </div>
      `;
      })
      .join('');

    const tabsHtml = TAB_ORDER.map((t) => {
      const isActive = t.id === activeTab;
      return `<button type="button" class="oa-filter-btn ${isActive ? 'is-active' : ''}" role="tab" aria-selected="${
        isActive ? 'true' : 'false'
      }" data-tab="${t.id}" tabindex="${isActive ? '0' : '-1'}">${t.label} (${tabCounts[t.id]})</button>`;
    }).join('');

    const academySubPillsHtml =
      activeTab === 'academy'
        ? `<div class="oa-academy-subfilters" role="tablist" aria-label="Subfiltros de Academias Guiadas">
            ${ACADEMY_SUB_ORDER.map((sub) => {
              const isAct = sub.id === activeAcademySub;
              return `<button type="button" class="oa-subfilter-pill ${isAct ? 'is-active' : ''}" role="tab" aria-selected="${
                isAct ? 'true' : 'false'
              }" data-academy-sub="${sub.id}">${sub.label} (${academySubCounts[sub.id]})</button>`;
            }).join('')}
          </div>`
        : '';

    this.root.innerHTML = `
      ${renderEcoSwitchBar('arena')}
      <header class="oa-topbar oa-topbar-flush">
        <div class="oa-topbar-inner">
          <div class="oa-brand">
            <span class="oa-brand-mark">${Icons.omni(20)}</span>
            <span class="oa-brand-name">OMNI ARENA</span>
            <span class="oa-brand-tag">${countAll} disciplinas · 2D + 3D</span>
          </div>
          <div class="oa-topbar-right">
            <button type="button" class="oa-top-btn" id="oa-hub-tutorial" title="Tutorial del Hub, zonas, dificultades y modo infinito">
              ${Icons.bookOpen(15)}<span>Guía</span>
            </button>
            <button type="button" class="oa-top-btn ${cloudReady ? 'is-live' : ''}" id="oa-hub-cloud" title="Sincronización Supabase y respaldos">
              ${Icons.cloud(15)}<span>${cloudReady ? `Supabase · ${cloudCfg.spaceCode}` : 'Supabase'}</span>
            </button>
            <button type="button" class="oa-top-btn" id="oa-hub-theme" title="Cambiar modo día/noche">
              ${profile.settings.theme === 'day' ? Icons.moon(15) : Icons.sun(15)}<span>${
                profile.settings.theme === 'day' ? 'Día' : 'Noche'
              }</span>
            </button>
            <button type="button" class="oa-top-btn" id="oa-hub-mute" aria-pressed="${
              profile.settings.muted ? 'true' : 'false'
            }" title="Activar o silenciar sonido">
              ${profile.settings.muted ? Icons.volumeOff(15) : Icons.volumeOn(15)}<span>${
                profile.settings.muted ? 'Silencio' : 'Audio'
              }</span>
            </button>
            <button type="button" class="oa-top-btn" id="oa-hub-settings" title="Ajustes de juego">
              ${Icons.sliders(15)}<span>Ajustes</span>
            </button>
            <div class="oa-streak-pill" title="Racha diaria">${Icons.flame(14)}<span>${profile.dailyStreak}d</span></div>
            <div class="oa-lvl-pill">Nv ${profile.level} · ${xpPct}%</div>
            <a class="oa-sos-btn" href="${resolveCompanionUrl('atelier', 'calm?sos=1')}" title="Abrir contención inmediata SOS Calma">SOS Calma</a>
          </div>
        </div>
      </header>

      <div class="oa-hub">
        <section class="oa-command-grid">
          <div class="oa-hero-deck">
            <div class="oa-hero-copy">
              <h1>Entrena y domina todas las dimensiones</h1>
              <p>${countAll} disciplinas entre Academias Guiadas de instrumentos reales, IQ, lógica y estrategia (${countAcademy}) y pruebas rápidas 2D/3D (${circuitCount}).</p>
            </div>

            <div class="oa-diff-block">
              <div class="oa-diff-head">
                <span class="oa-diff-title">Dificultad de entrenamiento</span>
                <span class="oa-diff-desc">${diffInfo.desc}</span>
              </div>
              <div class="oa-diff-pills oa-diff-pills-5">${difficultyPills}</div>
            </div>

            <div class="oa-hero-actions">
              <button type="button" class="oa-launch-primary" data-open-guide="gauntlet">
                <div class="oa-launch-meta">
                  <strong>Circuito Total</strong>
                  <span>Rotación cada 15s · ${circuitCount} pruebas 2D/3D</span>
                </div>
                <span class="oa-launch-go">${Icons.play(20)}</span>
              </button>

              <button type="button" class="oa-launch-secondary" data-open-guide="ranked">
                <div class="oa-launch-meta">
                  <strong>Prueba Clasificatoria</strong>
                  <span>Calibra tus 5 ejes · ${circuitCount} pruebas (${rankedDurationLabel})</span>
                </div>
                <span class="oa-launch-go">${Icons.trophy(18)}</span>
              </button>

              <button type="button" class="oa-launch-neurolab" id="oa-open-neurolab">
                <div class="oa-launch-neurolab-left">
                  <span class="oa-launch-neurolab-icon">${Icons.neuroLab(20)}</span>
                  <div class="oa-launch-neurolab-meta">
                    <strong>Laboratorio NeuroLab</strong>
                    <small>Sesión diaria (${neuroDailyDone}/4) · 4 pilares cognitivos · cursos 14/28 días</small>
                  </div>
                </div>
                <div class="oa-launch-neurolab-right">
                  <span class="oa-nl-score-chip">Neuro ${neuro.neuroScore}</span>
                  <span class="oa-launch-go">${Icons.arrowRight(18)}</span>
                </div>
              </button>
            </div>
          </div>

          <aside class="oa-radar-panel">
            <div class="oa-radar-head">
              <div class="oa-radar-title-row">
                <h2 class="oa-radar-heading">Radar de 5 ejes</h2>
                <div class="oa-radar-score">${overall} <span style="color:${rank.color}">${rank.grade}</span></div>
              </div>
              <span class="oa-rank-caption">${rank.label}</span>
            </div>
            <div class="oa-radar-wrap">
              ${renderRadarSvg(profile.ratings, 250)}
            </div>
            <div class="oa-daily-bar">
              <span>Circuito diario (${profile.dailyCompletedIds.length}/3)</span>
              <div class="oa-daily-pills">
                ${triad
                  .map((id) => {
                    const done = profile.dailyCompletedIds.includes(id);
                    return `<button type="button" class="oa-triad-chip ${done ? 'is-done' : ''}" data-open-guide="${id}">${formatLabel(GAME_CATALOG[id].title)}</button>`;
                  })
                  .join('')}
              </div>
            </div>
          </aside>
        </section>

        <section class="oa-pulse-sec" aria-label="Pulso del Ecosistema">
          <div class="oa-sec-head">
            <h2>Pulso del Ecosistema</h2>
          </div>
          <div class="oa-pulse-grid" id="oa-pulse-grid">
            ${this.renderPulseCards(this.pulseData, profile, overall, rank, cloudReady)}
          </div>
        </section>

        <section class="oa-disciplines-sec">
          <div class="oa-sec-head oa-sec-head-wrap">
            <h2>Disciplinas de entrenamiento (${countAll} modos)</h2>
            <div class="oa-catalog-controls">
              <div class="oa-filter-tabs" role="tablist" aria-label="Categorías de disciplinas">
                ${tabsHtml}
              </div>
              <label class="oa-search-field">
                <span class="oa-search-label">${Icons.search(15)}<span>Buscar juego</span></span>
                <input type="search" id="oa-hub-search" value="${this.escapeAttr(this.searchQuery)}" placeholder="Piano, batería, guitarra, IQ, ajedrez... (/)" autocomplete="off" />
              </label>
            </div>
          </div>
          ${academySubPillsHtml}
          <div class="oa-modes-grid" id="oa-modes-grid">
            ${this.renderGridCards(profile, activeTab, activeAcademySub, triad)}
          </div>
        </section>

        ${
          historyRows
            ? `
        <section class="oa-history-sec">
          <div class="oa-sec-head">
            <h2>ÚLTIMAS SESIONES</h2>
          </div>
          <div class="oa-hist-list">${historyRows}</div>
        </section>`
            : ''
        }

        <div class="oa-overlay ${this.activeModal === 'settings' ? '' : 'is-hidden'}" id="oa-settings-overlay">
          <div class="oa-modal oa-settings-modal" role="dialog" aria-modal="true" aria-label="Ajustes de juego">
            <div class="oa-settings-head">
              <h2>AJUSTES DE JUEGO</h2>
              <button type="button" class="oa-btn oa-btn-ghost oa-btn-sm" id="oa-close-settings" aria-label="Cerrar ajustes">${Icons.closeX(16)}<span>Cerrar</span></button>
            </div>

            <label class="oa-setting-row">
              <span>Volumen general (${Math.round(profile.settings.volume * 100)}%)</span>
              <input type="range" id="oa-set-vol" min="0" max="1" step="0.05" value="${profile.settings.volume}" />
            </label>

            <label class="oa-setting-row">
              <span>Sensibilidad 3D (${profile.settings.aimSensitivity.toFixed(1)}x)</span>
              <input type="range" id="oa-set-sens" min="0.4" max="2.2" step="0.1" value="${profile.settings.aimSensitivity}" />
            </label>

            <label class="oa-setting-row">
              <span>Controles táctiles en pantalla</span>
              <select id="oa-set-touch">
                <option value="auto" ${profile.settings.touchControls === 'auto' ? 'selected' : ''}>Automático</option>
                <option value="always" ${profile.settings.touchControls === 'always' ? 'selected' : ''}>Siempre visibles</option>
                <option value="off" ${profile.settings.touchControls === 'off' ? 'selected' : ''}>Desactivados (Solo PC)</option>
              </select>
            </label>

            <label class="oa-setting-row oa-setting-check">
              <span>Vibración de cámara al recibir impacto</span>
              <input type="checkbox" id="oa-set-shake" ${profile.settings.screenShake ? 'checked' : ''} />
            </label>

            <label class="oa-setting-row oa-setting-check">
              <span>Reducir movimiento (quita balanceos, sacudidas y transiciones)</span>
              <input type="checkbox" id="oa-set-reduce-motion" ${profile.settings.reduceMotion ? 'checked' : ''} />
            </label>

            <div class="oa-modal-actions">
              <button type="button" class="oa-btn" id="oa-reset-guides">${Icons.help(15)}<span>Restablecer guías</span></button>
              <button type="button" class="oa-btn oa-btn-danger" id="oa-reset-data">BORRAR PROGRESO</button>
            </div>
          </div>
        </div>

        <div class="oa-overlay ${this.activeModal === 'cloud' ? '' : 'is-hidden'}" id="oa-cloud-overlay">
          <div class="oa-modal oa-settings-modal" role="dialog" aria-modal="true" aria-label="Nube Supabase y Respaldos">
            <div class="oa-settings-head">
              <h2>NUBE SUPABASE Y RESPALDOS</h2>
              <button type="button" class="oa-btn oa-btn-ghost oa-btn-sm" id="oa-close-cloud" aria-label="Cerrar nube">${Icons.closeX(16)}<span>Cerrar</span></button>
            </div>

            <div class="oa-cloud-section">
              <label class="oa-setting-row">
                <span>Supabase Project URL</span>
                <input type="url" id="oa-sb-url" value="${this.escapeAttr(cloudCfg.supabaseUrl)}" placeholder="https://tuproyecto.supabase.co" />
              </label>
              <label class="oa-setting-row">
                <span>Supabase Anon Key</span>
                <input type="text" id="oa-sb-key" value="${this.escapeAttr(cloudCfg.supabaseAnonKey)}" placeholder="eyJhbGciOi..." />
              </label>
              <label class="oa-setting-row">
                <span>Código de espacio</span>
                <input type="text" id="oa-sb-space" value="${this.escapeAttr(cloudCfg.spaceCode)}" placeholder="mi-espacio" />
              </label>
              ${this.cloudFeedback ? `<p class="oa-cloud-fb">${this.cloudFeedback}</p>` : ''}
              <div class="oa-modal-actions">
                <button type="button" class="oa-btn oa-btn-primary" id="oa-sb-save">${Icons.cloud(15)}<span>Guardar y subir</span></button>
                <button type="button" class="oa-btn" id="oa-sb-pull">${Icons.download(15)}<span>Traer nube</span></button>
                <button type="button" class="oa-btn" id="oa-sb-paste">Pegar llave</button>
              </div>
              <div class="oa-modal-actions">
                <button type="button" class="oa-btn" id="oa-export-json">${Icons.download(14)}<span>Exportar .json</span></button>
                <label class="oa-btn" style="cursor:pointer;">
                  ${Icons.upload(14)}<span>Importar .json</span>
                  <input type="file" id="oa-import-json" accept=".json,application/json" style="display:none" />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="oa-overlay ${this.activeModal === 'tutorial' ? '' : 'is-hidden'}" id="oa-tutorial-overlay">
          <div class="oa-modal oa-hub-tutorial-modal" role="dialog" aria-modal="true" aria-labelledby="oa-hub-tutorial-title">
            <div class="oa-settings-head">
              <h2 id="oa-hub-tutorial-title">TUTORIAL DEL HUB · OMNI ARENA</h2>
              <button type="button" class="oa-btn oa-btn-ghost oa-btn-sm" id="oa-close-tutorial" aria-label="Cerrar tutorial">${Icons.closeX(16)}<span>Cerrar</span></button>
            </div>
            <p class="oa-hub-tutorial-lead">
              Domina las 4 zonas de entrenamiento, elige entre las 5 dificultades dinámicas y alterna entre Práctica Guiada, Reto Oficial y Modo Infinito.
            </p>

            <div class="oa-hub-tutorial-grid">
              <div class="oa-hub-tutorial-card">
                <div class="oa-hub-tutorial-card-head">${Icons.trophy(18)}<span>1. Circuito Diario y Clasificatoria</span></div>
                <p>El Circuito Total y la Prueba Clasificatoria rotan cada 15 s entre 18 pruebas rápidas 2D/3D. Completa las 3 disciplinas del Circuito Diario para mantener tu racha.</p>
              </div>
              <div class="oa-hub-tutorial-card">
                <div class="oa-hub-tutorial-card-head">${Icons.graduation(18)}<span>2. ${countAcademy} Academias Guiadas + NeuroLab</span></div>
                <p>Aprende paso a paso en NeuroLab (7 disciplinas científicas), Música (Piano, Batería, Cuerdas, Ensamble), Estrategia/3D (Ajedrez, Damas, Póker, Rubik) e IQ/Lógica (Raven, Sudoku, Hanói, Rotación 3D, Nonogramas, Series y Palacio Mental).</p>
              </div>
              <div class="oa-hub-tutorial-card">
                <div class="oa-hub-tutorial-card-head">${Icons.bolt(18)}<span>3. Destreza 2D y Acción 3D</span></div>
                <p>18 modos arcade directos al grano para entrenar puntería en primera persona, reflejos al milisegundo, lectura periférica, N-Back y agilidad espacial.</p>
              </div>
              <div class="oa-hub-tutorial-card">
                <div class="oa-hub-tutorial-card-head">${Icons.omni(18)}<span>4. Radar de 5 Ejes y Ecosistema</span></div>
                <p>Cada partida calibra tu índice (0–1000) en Puntería, Ritmo, Lógica, Reflejos y Agilidad 3D, sincronizado con Atelier Diario, UNUmbral y el Directorio.</p>
              </div>
            </div>

            <div class="oa-hub-tutorial-section">
              <h3>Las 5 Dificultades de Entrenamiento</h3>
              <ul class="oa-hub-tutorial-list">
                <li><strong>Cadete (Chill · 0.78×):</strong> velocidad contenida y margen amplio para asimilar mecánicas y patrones.</li>
                <li><strong>Estándar (1.00×):</strong> ritmo oficial equilibrado para todas las disciplinas del catálogo.</li>
                <li><strong>Élite (Hiper · 1.34×):</strong> máxima velocidad y exigencia con +35% de multiplicador de puntuación.</li>
                <li><strong>Dinámica IA (Adaptativa):</strong> se calibra con tu radar y sube o suaviza la intensidad en vivo según tu racha.</li>
                <li><strong>Progresiva (↑ Escala):</strong> arranca en 0.85× y escala continuamente cada ronda o cada 12 s sin bajar al fallar.</li>
              </ul>
            </div>

            <div class="oa-hub-tutorial-section">
              <h3>Práctica Guiada vs Reto Oficial vs Modo Infinito</h3>
              <ul class="oa-hub-tutorial-list">
                <li><strong>Práctica Guiada:</strong> sin perder vidas, con pistas razonadas, deshacer y botón "Tutorial sección" dentro de cada pestaña.</li>
                <li><strong>Modo Infinito (INF):</strong> actívalo en la Guía de cualquier disciplina compatible para jugar sin reloj global hasta agotar escudos o pulsar "Finalizar y puntuar", registrando tu récord INF propio.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.refreshCloudPulse();
  }

  private escapeAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  private renderPulseCards(
    pulse: EcoPulseSummary,
    profile: PlayerProfile,
    overall: number,
    rank: { grade: string; label: string; color: string },
    cloudReady: boolean
  ): string {
    const emptyMsg =
      'Sin datos de esta app en este origen. Abre el ecosistema publicado o activa la Nube para verlos aquí.';

    const totalSessions = Object.values(profile.playCounts).reduce((a, b) => a + (b || 0), 0);

    const atelierBody = pulse.atelier.hasData
      ? `<p class="oa-pulse-main">Racha ${pulse.atelier.streak} días</p>
         <div class="oa-pulse-bar-wrap" aria-label="${pulse.atelier.todayDone} de ${pulse.atelier.totalHabits} hábitos hoy">
           <div class="oa-pulse-bar"><span style="width:${Math.min(
             100,
             Math.round((pulse.atelier.todayDone / Math.max(1, pulse.atelier.totalHabits)) * 100)
           )}%"></span></div>
           <span class="oa-pulse-meta">${pulse.atelier.todayDone}/${pulse.atelier.totalHabits} hábitos hoy</span>
         </div>`
      : `<p class="oa-pulse-empty">${emptyMsg}</p>`;

    const unumbralBody = pulse.unumbral.hasData
      ? `<p class="oa-pulse-main">${pulse.unumbral.pendingTasks} tareas pendientes</p>
         <p class="oa-pulse-meta">${pulse.unumbral.todayClasses} clases hoy · ${pulse.unumbral.coursesCount} cursos</p>`
      : `<p class="oa-pulse-empty">${emptyMsg}</p>`;

    const cloudCta = !cloudReady
      ? `<button type="button" class="oa-btn oa-btn-sm oa-pulse-cloud-btn" data-open-cloud="1">${Icons.cloud(14)}<span>Configurar Nube</span></button>`
      : '';

    return `
      <article class="oa-pulse-card">
        <div class="oa-pulse-head">
          <span class="oa-pulse-title">${Icons.bookOpen(16)}<span>Atelier Diario</span></span>
          <a class="oa-btn oa-btn-sm" href="${resolveCompanionUrl('atelier')}">Abrir Atelier</a>
        </div>
        ${atelierBody}
        ${!pulse.atelier.hasData ? cloudCta : ''}
      </article>
      <article class="oa-pulse-card">
        <div class="oa-pulse-head">
          <span class="oa-pulse-title">${Icons.graduation(16)}<span>UNUmbral</span></span>
          <a class="oa-btn oa-btn-sm" href="${resolveCompanionUrl('unumbral')}">Abrir UNUmbral</a>
        </div>
        ${unumbralBody}
        ${!pulse.unumbral.hasData ? cloudCta : ''}
      </article>
      <article class="oa-pulse-card">
        <div class="oa-pulse-head">
          <span class="oa-pulse-title">${Icons.omni(16)}<span>Directorio</span></span>
          <a class="oa-btn oa-btn-sm" href="${resolveCompanionUrl('directorio')}">Abrir Directorio</a>
        </div>
        <p class="oa-pulse-main">Tu índice OMNI: ${overall} · <span style="color:${rank.color}">${rank.grade}</span></p>
        <p class="oa-pulse-meta">${rank.label} · ${totalSessions} sesiones</p>
      </article>
    `;
  }

  private renderGridCards(
    profile: PlayerProfile,
    activeTab: HubTabId,
    activeAcademySub: AcademySubFilter,
    triad: StandaloneGameId[]
  ): string {
    const queryNorm = normalizeSearch(this.searchQuery.trim());
    const filteredIds = STANDALONE_IDS.filter(
      (id) => matchesTab(id, activeTab, activeAcademySub) && matchesSearch(id, queryNorm)
    );

    if (filteredIds.length === 0) {
      const allCount = STANDALONE_IDS.filter((id) => matchesSearch(id, queryNorm)).length;
      return `
        <div class="oa-empty-search">
          <p>Sin resultados aquí${queryNorm ? ` para «${this.escapeAttr(this.searchQuery.trim())}»` : ''}.</p>
          ${
            allCount > 0 && (activeTab !== 'all' || activeAcademySub !== 'all')
              ? `<button type="button" class="oa-btn oa-btn-primary" id="oa-switch-all-tab">Ver ${allCount} en Todo</button>`
              : `<button type="button" class="oa-btn" id="oa-clear-search">Limpiar búsqueda</button>`
          }
        </div>
      `;
    }

    return filteredIds
      .map((id: StandaloneGameId) => {
        const desc = GAME_CATALOG[id];
        const best = profile.bestScores[id] ?? 0;
        const bestInf = profile.bestInfiniteScores?.[id] ?? 0;
        const axis = desc.axis as SkillAxis;
        const axisRating = profile.ratings[axis];
        const isDaily = triad.includes(id);
        const dailyDone = profile.dailyCompletedIds.includes(id);
        const isDirect = Boolean(profile.settings.skipGuideFor?.[id]);
        const contextLabel = desc.academyGroup
          ? ACADEMY_GROUP_LABELS[desc.academyGroup]
          : desc.subtitle;

        return `
        <article class="oa-mode-tile" style="--tile-accent: ${desc.accent}; --tile-soft: ${desc.accentSoft}">
          <button type="button" class="oa-mode-main" data-launch-mode="${id}">
            <div class="oa-mode-top">
              <div class="oa-diamond-badge" style="--em-accent: ${desc.accent}">
                <span class="oa-diamond-ring"></span>
                <span class="oa-diamond-core">${getModeIconSvg(id, 22)}</span>
              </div>
              <span class="oa-mode-dim">${desc.dimension}</span>
              <span class="oa-mode-context-tag">${contextLabel}</span>
              ${
                isDaily
                  ? `<span class="oa-daily-tag ${dailyDone ? 'is-done' : ''}">${
                      dailyDone ? Icons.check(12) + ' RETO' : 'RETO HOY'
                    }</span>`
                  : ''
              }
            </div>
            <div class="oa-mode-body">
              <h3>${desc.title}</h3>
              <p>${desc.description}</p>
            </div>
          </button>
          <div class="oa-mode-foot">
            <div class="oa-mode-stats">
              <span>${AXIS_META[axis].short} ${axisRating}</span>
              <span>RÉCORD ${best.toLocaleString('es-ES')}</span>
              ${
                bestInf > 0
                  ? `<span class="oa-inf-record-tag" title="Mejor puntuación en Modo Infinito">INF ${bestInf.toLocaleString('es-ES')}</span>`
                  : ''
              }
            </div>
            <div class="oa-mode-foot-actions">
              ${isDirect ? '<span class="oa-direct-tag">Entrada directa</span>' : ''}
              <button type="button" class="oa-mode-guide-btn" data-guide-mode="${id}" aria-label="Guía de ${desc.title}">
                ${Icons.help(14)}<span>Guía</span>
              </button>
            </div>
          </div>
        </article>
      `;
      })
      .join('');
  }

  private refreshCloudPulse(): void {
    if (!arenaCloudSync.isConfigured()) return;
    void readEcoPulseWithCloud().then((nextPulse) => {
      if (this.destroyed) return;
      this.pulseData = nextPulse;
      const grid = this.root.querySelector('#oa-pulse-grid');
      if (!grid) return;
      const profile = profileStore.get();
      const overall = computeOverallRating(profile.ratings);
      const rank = ratingToRank(overall);
      grid.innerHTML = this.renderPulseCards(
        nextPulse,
        profile,
        overall,
        rank,
        arenaCloudSync.isConfigured()
      );
      this.bindPulseCloudButtons();
    });
  }

  private bindPulseCloudButtons(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-open-cloud]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.activeModal = 'cloud';
        this.root.querySelector('#oa-cloud-overlay')?.classList.remove('is-hidden');
      });
    });
  }

  private openGuideFor(modeId: GameModeId): void {
    this.activeGuide?.close(true);
    this.activeGuide = new GuideOverlay(this.root, modeId, {
      context: 'hub',
      onStart: (chosenId, practiceMode, infiniteMode) => {
        this.activeGuide = null;
        this.onLaunch(chosenId, practiceMode, infiniteMode);
      },
      onClose: () => {
        this.activeGuide = null;
      },
    });
    this.activeGuide.open();
  }

  private bindGridEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-launch-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.ensure();
        synthAudio.uiClick();
        const mode = btn.dataset.launchMode as GameModeId;
        const s = profileStore.get().settings;
        const skip = Boolean(s.skipGuideFor?.[mode]);
        if (skip) {
          const inf = Boolean(s.infiniteModeDefault && GAME_CATALOG[mode].supportsInfinite);
          this.onLaunch(mode, false, inf);
        } else {
          this.openGuideFor(mode);
        }
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-guide-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.ensure();
        synthAudio.uiClick();
        const mode = btn.dataset.guideMode as GameModeId;
        this.openGuideFor(mode);
      });
    });

    this.root.querySelector('#oa-switch-all-tab')?.addEventListener('click', () => {
      synthAudio.uiClick();
      profileStore.updateSettings({ hubTab: 'all', academySubFilter: 'all' });
      this.render();
    });

    this.root.querySelector('#oa-clear-search')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.searchQuery = '';
      this.render();
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.activeGuide) return;
    if (this.activeModal !== 'none') {
      if (e.code === 'Escape') {
        e.preventDefault();
        this.activeModal = 'none';
        this.render();
      }
      return;
    }
    const target = e.target as HTMLElement | null;
    const isInput =
      target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
    if (e.key === '/' && !isInput) {
      e.preventDefault();
      const searchEl = this.root.querySelector<HTMLInputElement>('#oa-hub-search');
      searchEl?.focus();
      searchEl?.select();
    }
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    this.bindPulseCloudButtons();
    this.bindGridEvents();

    this.root.querySelector('#oa-open-neurolab')?.addEventListener('click', () => {
      synthAudio.ensure();
      synthAudio.uiClick();
      this.onOpenNeuroLab?.();
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-open-guide]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.ensure();
        synthAudio.uiClick();
        const mode = btn.dataset.openGuide as GameModeId;
        this.openGuideFor(mode);
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-diff]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.ensure();
        synthAudio.uiClick();
        const diff = btn.dataset.diff as DifficultyId;
        profileStore.updateSettings({ difficulty: diff });
        this.render();
      });
    });

    const tabBtns = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-tab]'));
    tabBtns.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        synthAudio.uiClick();
        const tab = btn.dataset.tab as HubTabId;
        profileStore.updateSettings({ hubTab: tab });
        this.render();
      });
      btn.addEventListener('keydown', (e) => {
        if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
          e.preventDefault();
          const dir = e.code === 'ArrowRight' ? 1 : -1;
          const nextIdx = (idx + dir + tabBtns.length) % tabBtns.length;
          const nextTab = tabBtns[nextIdx].dataset.tab as HubTabId;
          profileStore.updateSettings({ hubTab: nextTab });
          this.render();
          this.root.querySelector<HTMLButtonElement>(`[data-tab="${nextTab}"]`)?.focus();
        }
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-academy-sub]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.uiClick();
        const sub = btn.dataset.academySub as AcademySubFilter;
        profileStore.updateSettings({ academySubFilter: sub });
        this.render();
      });
    });

    const searchInput = this.root.querySelector<HTMLInputElement>('#oa-hub-search');
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      const profile = profileStore.get();
      const activeTab = this.getActiveTab(profile);
      const activeAcademySub = this.getAcademySubFilter(profile);
      const triad = getDailyTriad();
      const grid = this.root.querySelector('#oa-modes-grid');
      if (grid) {
        grid.innerHTML = this.renderGridCards(profile, activeTab, activeAcademySub, triad);
        this.bindGridEvents();
      }
    });

    this.root.querySelector('#oa-hub-theme')?.addEventListener('click', () => {
      const next = profileStore.get().settings.theme === 'day' ? 'night' : 'day';
      profileStore.updateSettings({ theme: next });
      this.render();
    });

    this.root.querySelector('#oa-hub-mute')?.addEventListener('click', () => {
      const s = profileStore.get().settings;
      const next = !s.muted;
      profileStore.updateSettings({ muted: next });
      synthAudio.setConfig(s.volume, next);
      this.render();
    });

    const settingsModal = this.root.querySelector('#oa-settings-overlay')!;
    const cloudModal = this.root.querySelector('#oa-cloud-overlay')!;
    const tutorialModal = this.root.querySelector('#oa-tutorial-overlay')!;
    this.root.querySelector('#oa-hub-settings')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.activeModal = 'settings';
      settingsModal.classList.remove('is-hidden');
    });
    this.root.querySelector('#oa-hub-cloud')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.activeModal = 'cloud';
      cloudModal.classList.remove('is-hidden');
    });
    this.root.querySelector('#oa-hub-tutorial')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.activeModal = 'tutorial';
      tutorialModal.classList.remove('is-hidden');
    });

    const closeModals = () => {
      this.activeModal = 'none';
      settingsModal.classList.add('is-hidden');
      cloudModal.classList.add('is-hidden');
      tutorialModal.classList.add('is-hidden');
      this.render();
    };
    this.root.querySelector('#oa-close-settings')?.addEventListener('click', closeModals);
    this.root.querySelector('#oa-close-cloud')?.addEventListener('click', closeModals);
    this.root.querySelector('#oa-close-tutorial')?.addEventListener('click', closeModals);
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeModals();
    });
    cloudModal.addEventListener('click', (e) => {
      if (e.target === cloudModal) closeModals();
    });
    tutorialModal.addEventListener('click', (e) => {
      if (e.target === tutorialModal) closeModals();
    });

    this.root.querySelector<HTMLInputElement>('#oa-set-vol')?.addEventListener('input', (e) => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      profileStore.updateSettings({ volume: v, muted: v === 0 });
      synthAudio.setConfig(v, v === 0);
    });

    this.root.querySelector<HTMLInputElement>('#oa-set-sens')?.addEventListener('input', (e) => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      profileStore.updateSettings({ aimSensitivity: v });
    });

    this.root.querySelector<HTMLSelectElement>('#oa-set-touch')?.addEventListener('change', (e) => {
      const v = (e.target as HTMLSelectElement).value as 'auto' | 'always' | 'off';
      profileStore.updateSettings({ touchControls: v });
    });

    this.root.querySelector<HTMLInputElement>('#oa-set-shake')?.addEventListener('change', (e) => {
      const v = (e.target as HTMLInputElement).checked;
      profileStore.updateSettings({ screenShake: v });
    });

    this.root
      .querySelector<HTMLInputElement>('#oa-set-reduce-motion')
      ?.addEventListener('change', (e) => {
        const v = (e.target as HTMLInputElement).checked;
        profileStore.updateSettings({ reduceMotion: v });
        document.documentElement.setAttribute('data-motion', v ? 'reduced' : 'normal');
      });

    this.root.querySelector('#oa-reset-guides')?.addEventListener('click', () => {
      synthAudio.uiClick();
      profileStore.resetAllGuides();
      this.activeModal = 'none';
      this.render();
    });

    this.root.querySelector('#oa-sb-save')?.addEventListener('click', async () => {
      const url = this.root.querySelector<HTMLInputElement>('#oa-sb-url')!.value;
      const key = this.root.querySelector<HTMLInputElement>('#oa-sb-key')!.value;
      const space = this.root.querySelector<HTMLInputElement>('#oa-sb-space')!.value;
      arenaCloudSync.saveConfig({ supabaseUrl: url, supabaseAnonKey: key, spaceCode: space, autoSync: true });
      const res = await profileStore.pushNow();
      this.cloudFeedback = res.message;
      this.render();
    });

    this.root.querySelector('#oa-sb-pull')?.addEventListener('click', async () => {
      const res = await profileStore.syncFromCloud(true);
      this.cloudFeedback = res.message;
      this.render();
    });

    this.root.querySelector('#oa-sb-paste')?.addEventListener('click', async () => {
      const raw = window.prompt('Pega la llave rápida JSON copiada desde el Directorio:');
      if (!raw) return;
      if (arenaCloudSync.importToken(raw)) {
        const res = await profileStore.syncFromCloud(true);
        if (!res.updated) await profileStore.pushNow();
        this.cloudFeedback = 'Configuración de Supabase aplicada y sincronizada.';
      } else {
        this.cloudFeedback = 'La llave rápida no es válida.';
      }
      this.render();
    });

    this.root.querySelector('#oa-export-json')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(profileStore.get(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OMNI_ARENA_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    this.root.querySelector<HTMLInputElement>('#oa-import-json')?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text()) as Partial<PlayerProfile>;
        if (!parsed.ratings) throw new Error('invalid');
        profileStore.replaceAll(parsed);
        this.cloudFeedback = 'Respaldo restaurado y sincronizado.';
      } catch {
        this.cloudFeedback = 'Archivo JSON no válido.';
      }
      this.render();
    });

    this.root.querySelector('#oa-reset-data')?.addEventListener('click', () => {
      profileStore.resetAll();
      this.activeModal = 'none';
      this.render();
    });
  }
}
