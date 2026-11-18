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

const DIFFICULTY_ORDER: DifficultyId[] = ['chill', 'standard', 'hyper', 'adaptive'];

const TAB_ORDER: { id: HubTabId; label: string }[] = [
  { id: 'academy', label: 'Academias Guiadas' },
  { id: 'dexterity2d', label: 'Destreza 2D' },
  { id: 'action3d', label: 'Acción 3D' },
  { id: 'all', label: 'Todo' },
];

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

function matchesTab(id: StandaloneGameId, tab: HubTabId): boolean {
  if (tab === 'all') return true;
  return GAME_CATALOG[id].category === tab;
}

export class HubView {
  private root: HTMLElement;
  private onLaunch: (modeId: GameModeId, practiceMode?: boolean) => void;
  private activeModal: 'none' | 'settings' | 'cloud' = 'none';
  private activeGuide: GuideOverlay | null = null;
  private searchQuery = '';
  private cloudFeedback = '';
  private pulseData: EcoPulseSummary = readEcoPulse();
  private destroyed = false;

  constructor(root: HTMLElement, onLaunch: (modeId: GameModeId, practiceMode?: boolean) => void) {
    this.root = root;
    this.onLaunch = onLaunch;
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

  public render(): void {
    this.destroyed = false;
    window.removeEventListener('keydown', this.onKeyDown);

    const profile = profileStore.get();
    document.documentElement.setAttribute('data-theme', profile.settings.theme ?? 'night');
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
    const diffInfo = DIFFICULTY_META[activeDiff];
    const cloudCfg = arenaCloudSync.reloadConfig();
    const cloudReady = arenaCloudSync.isConfigured();
    const activeTab = this.getActiveTab(profile);

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

    const circuitCount = CIRCUIT_IDS.length;
    const totalSecRanked = circuitCount * 15;
    const rankedDurationLabel = `${Math.floor(totalSecRanked / 60)}m ${String(totalSecRanked % 60).padStart(2, '0')}s`;

    const difficultyPills = DIFFICULTY_ORDER.map((dId) => {
      const meta = DIFFICULTY_META[dId];
      const active = dId === activeDiff;
      return `
        <button type="button" class="oa-diff-pill ${active ? 'is-active' : ''}" data-diff="${dId}" style="--diff-accent: ${meta.accent}">
          <span>${meta.label}</span>
          <em>${meta.short}</em>
        </button>
      `;
    }).join('');

    const historyRows = profile.history
      .slice(0, 5)
      .map((rec) => {
        const desc = GAME_CATALOG[rec.modeId];
        const diffTag = rec.difficulty ? DIFFICULTY_META[rec.difficulty]?.label : '';
        return `
        <div class="oa-hist-row">
          <span class="oa-hist-dot" style="background:${desc.accent}"></span>
          <span class="oa-hist-name">${desc.title}${diffTag ? ` <small>${diffTag}</small>` : ''}</span>
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

    this.root.innerHTML = `
      ${renderEcoSwitchBar('arena')}
      <div class="oa-hub">
        <header class="oa-topbar">
          <div class="oa-brand">
            <span class="oa-brand-mark">${Icons.omni(22)}</span>
            <span class="oa-brand-name">OMNI ARENA</span>
            <span class="oa-brand-tag">${countAll} DISCIPLINAS · 2D + 3D</span>
          </div>
          <div class="oa-topbar-right">
            <button type="button" class="oa-top-btn ${cloudReady ? 'is-live' : ''}" id="oa-hub-cloud" title="Sincronización Supabase y respaldos">
              ${Icons.cloud(16)}<span>${cloudReady ? `Nube · ${cloudCfg.spaceCode}` : 'Nube'}</span>
            </button>
            <button type="button" class="oa-top-btn" id="oa-hub-theme" title="Cambiar modo día/noche">
              ${profile.settings.theme === 'day' ? Icons.sun(16) : Icons.moon(16)}<span>Tema: ${
                profile.settings.theme === 'day' ? 'Día' : 'Noche'
              }</span>
            </button>
            <button type="button" class="oa-top-btn" id="oa-hub-mute" aria-pressed="${
              profile.settings.muted ? 'true' : 'false'
            }" title="Activar o silenciar sonido">
              ${profile.settings.muted ? Icons.volumeOff(16) : Icons.volumeOn(16)}<span>Sonido: ${
                profile.settings.muted ? 'No' : 'Sí'
              }</span>
            </button>
            <button type="button" class="oa-top-btn" id="oa-hub-settings" title="Ajustes de juego">
              ${Icons.sliders(16)}<span>Ajustes</span>
            </button>
            <div class="oa-streak-pill" title="Racha diaria">${Icons.flame(16)}<span>${profile.dailyStreak} DÍAS</span></div>
            <div class="oa-lvl-pill">NV ${profile.level} · ${xpPct}%</div>
          </div>
        </header>

        <section class="oa-command-grid">
          <div class="oa-hero-deck">
            <div class="oa-hero-copy">
              <h1>ENTRENA Y DOMINA TODAS LAS DIMENSIONES</h1>
              <p>${countAll} disciplinas entre Academias Guiadas de estrategia, música e inteligencia (${countAcademy}) y pruebas rápidas 2D/3D (${circuitCount}).</p>
            </div>

            <div class="oa-diff-block">
              <div class="oa-diff-head">
                <span>DIFICULTAD DE ENTRENAMIENTO</span>
                <span class="oa-diff-desc">${diffInfo.desc}</span>
              </div>
              <div class="oa-diff-pills">${difficultyPills}</div>
            </div>

            <div class="oa-hero-actions">
              <button type="button" class="oa-launch-primary" data-open-guide="gauntlet">
                <div class="oa-launch-meta">
                  <span class="oa-launch-dim">2D + 3D · ${circuitCount} PRUEBAS</span>
                  <strong>CIRCUITO TOTAL</strong>
                  <span>Rotación cada 15s sin perder tu racha</span>
                </div>
                <span class="oa-launch-go">${Icons.play(20)}</span>
              </button>

              <button type="button" class="oa-launch-secondary" data-open-guide="ranked">
                <div class="oa-launch-meta">
                  <span class="oa-launch-dim">${circuitCount} PRUEBAS · ${rankedDurationLabel}</span>
                  <strong>PRUEBA CLASIFICATORIA</strong>
                  <span>Calibra tus 5 ejes de habilidad</span>
                </div>
                <span class="oa-launch-go">${Icons.trophy(18)}</span>
              </button>
            </div>
          </div>

          <aside class="oa-radar-panel">
            <div class="oa-radar-head">
              <div>
                <span class="oa-radar-label">ÍNDICE GLOBAL</span>
                <div class="oa-radar-score">${overall} <span style="color:${rank.color}">${rank.grade}</span></div>
              </div>
              <span class="oa-rank-caption">${rank.label}</span>
            </div>
            <div class="oa-radar-wrap">
              ${renderRadarSvg(profile.ratings, 250)}
            </div>
            <div class="oa-daily-bar">
              <span>CIRCUITO DIARIO (${profile.dailyCompletedIds.length}/3)</span>
              <div class="oa-daily-pills">
                ${triad
                  .map((id) => {
                    const done = profile.dailyCompletedIds.includes(id);
                    return `<button type="button" class="oa-triad-chip ${done ? 'is-done' : ''}" data-open-guide="${id}">${GAME_CATALOG[id].title}</button>`;
                  })
                  .join('')}
              </div>
            </div>
          </aside>
        </section>

        <section class="oa-pulse-sec" aria-label="Pulso del Ecosistema">
          <div class="oa-sec-head">
            <h2>PULSO DEL ECOSISTEMA</h2>
          </div>
          <div class="oa-pulse-grid" id="oa-pulse-grid">
            ${this.renderPulseCards(this.pulseData, profile, overall, rank, cloudReady)}
          </div>
        </section>

        <section class="oa-disciplines-sec">
          <div class="oa-sec-head oa-sec-head-wrap">
            <h2>DISCIPLINAS DE ENTRENAMIENTO (${countAll} MODOS)</h2>
            <div class="oa-catalog-controls">
              <div class="oa-filter-tabs" role="tablist" aria-label="Categorías de disciplinas">
                ${tabsHtml}
              </div>
              <label class="oa-search-field">
                <span class="oa-search-label">${Icons.search(15)}<span>Buscar juego</span></span>
                <input type="search" id="oa-hub-search" value="${this.escapeAttr(this.searchQuery)}" placeholder="Ajedrez, piano, puntería... (/)" autocomplete="off" />
              </label>
            </div>
          </div>
          <div class="oa-modes-grid" id="oa-modes-grid">
            ${this.renderGridCards(profile, activeTab, triad)}
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
    triad: StandaloneGameId[]
  ): string {
    const queryNorm = normalizeSearch(this.searchQuery.trim());
    const filteredIds = STANDALONE_IDS.filter(
      (id) => matchesTab(id, activeTab) && matchesSearch(id, queryNorm)
    );

    if (filteredIds.length === 0) {
      const allCount = STANDALONE_IDS.filter((id) => matchesSearch(id, queryNorm)).length;
      return `
        <div class="oa-empty-search">
          <p>Sin resultados aquí${queryNorm ? ` para «${this.escapeAttr(this.searchQuery.trim())}»` : ''}.</p>
          ${
            allCount > 0 && activeTab !== 'all'
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
        const axis = desc.axis as SkillAxis;
        const axisRating = profile.ratings[axis];
        const isDaily = triad.includes(id);
        const dailyDone = profile.dailyCompletedIds.includes(id);
        const isDirect = Boolean(profile.settings.skipGuideFor?.[id]);

        return `
        <article class="oa-mode-tile" style="--tile-accent: ${desc.accent}; --tile-soft: ${desc.accentSoft}">
          <button type="button" class="oa-mode-main" data-launch-mode="${id}">
            <div class="oa-mode-top">
              <div class="oa-diamond-badge" style="--em-accent: ${desc.accent}">
                <span class="oa-diamond-ring"></span>
                <span class="oa-diamond-core">${getModeIconSvg(id, 22)}</span>
              </div>
              <span class="oa-mode-dim">${desc.dimension}</span>
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
      onStart: (chosenId, practiceMode) => {
        this.activeGuide = null;
        this.onLaunch(chosenId, practiceMode);
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
        const skip = Boolean(profileStore.get().settings.skipGuideFor?.[mode]);
        if (skip) {
          this.onLaunch(mode, false);
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
      profileStore.updateSettings({ hubTab: 'all' });
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

    const searchInput = this.root.querySelector<HTMLInputElement>('#oa-hub-search');
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      const profile = profileStore.get();
      const activeTab = this.getActiveTab(profile);
      const triad = getDailyTriad();
      const grid = this.root.querySelector('#oa-modes-grid');
      if (grid) {
        grid.innerHTML = this.renderGridCards(profile, activeTab, triad);
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

    const closeModals = () => {
      this.activeModal = 'none';
      settingsModal.classList.add('is-hidden');
      cloudModal.classList.add('is-hidden');
      this.render();
    };
    this.root.querySelector('#oa-close-settings')?.addEventListener('click', closeModals);
    this.root.querySelector('#oa-close-cloud')?.addEventListener('click', closeModals);
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeModals();
    });
    cloudModal.addEventListener('click', (e) => {
      if (e.target === cloudModal) closeModals();
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
