import { AXIS_META, DIFFICULTY_META, GAME_CATALOG, STANDALONE_IDS } from '../catalog';
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
import { DifficultyId, GameModeId, PlayerProfile, SkillAxis, StandaloneGameId } from '../types';
import { resolveCompanionUrl } from '../utils/ecosystem';
import { renderRadarSvg } from './RadarChart';

function modeIcon(id: GameModeId): string {
  switch (id) {
    case 'aim3d':
      return Icons.crosshair(22);
    case 'runner3d':
      return Icons.cube3d(22);
    case 'cube3d':
      return Icons.paddle3d(22);
    case 'parkour3d':
      return Icons.parkour(22);
    case 'rhythm2d':
      return Icons.music(22);
    case 'parry2d':
      return Icons.parry(22);
    case 'bullet2d':
      return Icons.bolt(22);
    case 'puzzle2d':
      return Icons.puzzle(22);
    case 'tetris2d':
      return Icons.blocks(22);
    case 'twinstick2d':
      return Icons.twinStick(22);
    case 'flight3d':
      return Icons.plane3d(22);
    case 'memory2d':
      return Icons.gridMem(22);
    case 'snake2d':
      return Icons.snake(22);
    case 'sniper2d':
      return Icons.target2d(22);
    case 'track2d':
      return Icons.laserTrack(22);
    case 'schulte2d':
      return Icons.schulte(22);
    case 'nback2d':
      return Icons.brainNBack(22);
    case 'pulse2d':
      return Icons.sonicRing(22);
    default:
      return Icons.omni(22);
  }
}

const DIFFICULTY_ORDER: DifficultyId[] = ['chill', 'standard', 'hyper', 'adaptive'];

export class HubView {
  private root: HTMLElement;
  private onLaunch: (modeId: GameModeId) => void;
  private activeModal: 'none' | 'settings' | 'cloud' = 'none';
  private dimFilter: 'all' | '3D' | '2D' = 'all';
  private cloudFeedback = '';

  constructor(root: HTMLElement, onLaunch: (modeId: GameModeId) => void) {
    this.root = root;
    this.onLaunch = onLaunch;
  }

  public render(): void {
    const profile = profileStore.get();
    document.documentElement.setAttribute('data-theme', profile.settings.theme ?? 'night');
    const overall = computeOverallRating(profile.ratings);
    const rank = ratingToRank(overall);
    const nextXp = xpForLevel(profile.level);
    const xpPct = Math.min(100, Math.round((profile.xp / nextXp) * 100));
    const triad = getDailyTriad();
    const activeDiff = profile.settings.difficulty ?? 'adaptive';
    const diffInfo = DIFFICULTY_META[activeDiff];
    const cloudCfg = arenaCloudSync.reloadConfig();
    const cloudReady = arenaCloudSync.isConfigured();

    const countTotal = STANDALONE_IDS.length;
    const count3D = STANDALONE_IDS.filter((id) => GAME_CATALOG[id].dimension === '3D').length;
    const count2D = STANDALONE_IDS.filter((id) => GAME_CATALOG[id].dimension === '2D').length;
    const totalSecRanked = countTotal * 15;
    const rankedDurationLabel = `${Math.floor(totalSecRanked / 60)}m ${String(totalSecRanked % 60).padStart(2, '0')}s`;

    const filteredIds = STANDALONE_IDS.filter((id) => {
      if (this.dimFilter === 'all') return true;
      return GAME_CATALOG[id].dimension === this.dimFilter;
    });

    const disciplineRows = filteredIds
      .map((id: StandaloneGameId) => {
        const desc = GAME_CATALOG[id];
        const best = profile.bestScores[id] ?? 0;
        const axis = desc.axis as SkillAxis;
        const axisRating = profile.ratings[axis];
        const isDaily = triad.includes(id);
        const dailyDone = profile.dailyCompletedIds.includes(id);

        return `
        <button type="button" class="oa-mode-tile" data-mode="${id}" style="--tile-accent: ${desc.accent}; --tile-soft: ${desc.accentSoft}">
          <div class="oa-mode-top">
            <div class="oa-diamond-badge" style="--em-accent: ${desc.accent}">
              <span class="oa-diamond-ring"></span>
              <span class="oa-diamond-core">${modeIcon(id)}</span>
            </div>
            <span class="oa-mode-dim">${desc.dimension}</span>
            ${
              isDaily
                ? `<span class="oa-daily-tag ${dailyDone ? 'is-done' : ''}">${dailyDone ? Icons.check(12) + ' RETO' : 'RETO HOY'}</span>`
                : ''
            }
          </div>
          <div class="oa-mode-body">
            <h3>${desc.title}</h3>
            <p>${desc.description}</p>
          </div>
          <div class="oa-mode-foot">
            <span>${AXIS_META[axis].short} ${axisRating}</span>
            <span>RÉCORD ${best.toLocaleString('es-ES')}</span>
          </div>
        </button>
      `;
      })
      .join('');

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

    this.root.innerHTML = `
      <div class="oa-hub">
        <header class="oa-topbar">
          <div class="oa-brand">
            <a class="oa-dir-back" href="${resolveCompanionUrl('directorio')}" title="Volver al Directorio del Ecosistema">
              ${Icons.arrowLeft(15)}<span>Directorio</span>
            </a>
            <span class="oa-brand-mark">${Icons.omni(22)}</span>
            <span class="oa-brand-name">OMNI ARENA</span>
            <span class="oa-brand-tag">${countTotal} DISCIPLINAS · 2D + 3D</span>
          </div>
          <div class="oa-topbar-right">
            <a class="oa-eco-link" href="${resolveCompanionUrl('unumbral')}">UNUmbral</a>
            <button type="button" class="oa-cloud-btn ${cloudReady ? 'is-live' : ''}" id="oa-hub-cloud" title="Sincronización Supabase y respaldos">
              ${Icons.cloud(15)}<span>${cloudReady ? `Nube · ${cloudCfg.spaceCode}` : 'Nube'}</span>
            </button>
            <div class="oa-streak-pill" title="Racha diaria">${Icons.flame(16)}<span>${profile.dailyStreak} DÍAS</span></div>
            <div class="oa-lvl-pill">NV ${profile.level} · ${xpPct}%</div>
            <button type="button" class="oa-icon-btn" id="oa-hub-theme" title="Cambiar modo día/noche">
              ${profile.settings.theme === 'day' ? Icons.moon(17) : Icons.sun(17)}
            </button>
            <button type="button" class="oa-icon-btn" id="oa-hub-mute" title="Silenciar">${profile.settings.muted ? Icons.volumeOff(18) : Icons.volumeOn(18)}</button>
            <button type="button" class="oa-icon-btn" id="oa-hub-settings" title="Ajustes de juego">${Icons.sliders(18)}</button>
          </div>
        </header>

        <section class="oa-command-grid">
          <div class="oa-hero-deck">
            <div class="oa-hero-copy">
              <h1>ENTRENA Y DOMINA TODAS LAS DIMENSIONES</h1>
              <p>${countTotal} disciplinas de destreza e inteligencia: puntería 3D, rastreo continuo, N-Back, tabla Schulte, ritmo orbital, memoria visual, lógica y esquiva.</p>
            </div>

            <div class="oa-diff-block">
              <div class="oa-diff-head">
                <span>DIFICULTAD DE ENTRENAMIENTO</span>
                <span class="oa-diff-desc">${diffInfo.desc}</span>
              </div>
              <div class="oa-diff-pills">${difficultyPills}</div>
            </div>

            <div class="oa-hero-actions">
              <button type="button" class="oa-launch-primary" data-mode="gauntlet">
                <div class="oa-launch-meta">
                  <span class="oa-launch-dim">2D ↔ 3D · ${countTotal} PRUEBAS</span>
                  <strong>CIRCUITO TOTAL</strong>
                  <span>Rotación cada 15s sin perder tu racha</span>
                </div>
                <span class="oa-launch-go">${Icons.play(20)}</span>
              </button>

              <button type="button" class="oa-launch-secondary" data-mode="ranked">
                <div class="oa-launch-meta">
                  <span class="oa-launch-dim">${countTotal} PRUEBAS · ${rankedDurationLabel}</span>
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
                    return `<button type="button" class="oa-triad-chip ${done ? 'is-done' : ''}" data-mode="${id}">${GAME_CATALOG[id].title}</button>`;
                  })
                  .join('')}
              </div>
            </div>
          </aside>
        </section>

        <section class="oa-disciplines-sec">
          <div class="oa-sec-head">
            <h2>DISCIPLINAS DE ENTRENAMIENTO (${countTotal} MODOS)</h2>
            <div class="oa-filter-tabs" role="tablist">
              <button type="button" class="oa-filter-btn ${this.dimFilter === 'all' ? 'is-active' : ''}" data-filter="all">TODOS (${countTotal})</button>
              <button type="button" class="oa-filter-btn ${this.dimFilter === '3D' ? 'is-active' : ''}" data-filter="3D">3D (${count3D})</button>
              <button type="button" class="oa-filter-btn ${this.dimFilter === '2D' ? 'is-active' : ''}" data-filter="2D">2D (${count2D})</button>
            </div>
          </div>
          <div class="oa-modes-grid">
            ${disciplineRows}
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
              <button type="button" class="oa-icon-btn" id="oa-close-settings" aria-label="Cerrar ajustes">${Icons.close(16)}</button>
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

            <div class="oa-modal-actions">
              <button type="button" class="oa-btn oa-btn-danger" id="oa-reset-data">BORRAR PROGRESO</button>
            </div>
          </div>
        </div>

        <div class="oa-overlay ${this.activeModal === 'cloud' ? '' : 'is-hidden'}" id="oa-cloud-overlay">
          <div class="oa-modal oa-settings-modal" role="dialog" aria-modal="true" aria-label="Nube Supabase y Respaldos">
            <div class="oa-settings-head">
              <h2>NUBE SUPABASE Y RESPALDOS</h2>
              <button type="button" class="oa-icon-btn" id="oa-close-cloud" aria-label="Cerrar nube">${Icons.close(16)}</button>
            </div>

            <div class="oa-cloud-section">
              <label class="oa-setting-row">
                <span>Supabase Project URL</span>
                <input type="url" id="oa-sb-url" value="${cloudCfg.supabaseUrl}" placeholder="https://tuproyecto.supabase.co" />
              </label>
              <label class="oa-setting-row">
                <span>Supabase Anon Key</span>
                <input type="text" id="oa-sb-key" value="${cloudCfg.supabaseAnonKey}" placeholder="eyJhbGciOi..." />
              </label>
              <label class="oa-setting-row">
                <span>Código de espacio</span>
                <input type="text" id="oa-sb-space" value="${cloudCfg.spaceCode}" placeholder="mi-espacio" />
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
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLElement>('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.ensure();
        synthAudio.uiClick();
        const mode = btn.dataset.mode as GameModeId;
        this.onLaunch(mode);
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

    this.root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.uiClick();
        this.dimFilter = btn.dataset.filter as 'all' | '3D' | '2D';
        this.render();
      });
    });

    this.root.querySelector('#oa-hub-theme')!.addEventListener('click', () => {
      const next = profileStore.get().settings.theme === 'day' ? 'night' : 'day';
      profileStore.updateSettings({ theme: next });
      this.render();
    });

    this.root.querySelector('#oa-hub-mute')!.addEventListener('click', () => {
      const s = profileStore.get().settings;
      const next = !s.muted;
      profileStore.updateSettings({ muted: next });
      synthAudio.setConfig(s.volume, next);
      this.render();
    });

    const settingsModal = this.root.querySelector('#oa-settings-overlay')!;
    const cloudModal = this.root.querySelector('#oa-cloud-overlay')!;
    this.root.querySelector('#oa-hub-settings')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.activeModal = 'settings';
      settingsModal.classList.remove('is-hidden');
    });
    this.root.querySelector('#oa-hub-cloud')!.addEventListener('click', () => {
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
    this.root.querySelector('#oa-close-settings')!.addEventListener('click', closeModals);
    this.root.querySelector('#oa-close-cloud')!.addEventListener('click', closeModals);
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeModals();
    });
    cloudModal.addEventListener('click', (e) => {
      if (e.target === cloudModal) closeModals();
    });

    this.root.querySelector<HTMLInputElement>('#oa-set-vol')!.addEventListener('input', (e) => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      profileStore.updateSettings({ volume: v, muted: v === 0 });
      synthAudio.setConfig(v, v === 0);
    });

    this.root.querySelector<HTMLInputElement>('#oa-set-sens')!.addEventListener('input', (e) => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      profileStore.updateSettings({ aimSensitivity: v });
    });

    this.root.querySelector<HTMLSelectElement>('#oa-set-touch')!.addEventListener('change', (e) => {
      const v = (e.target as HTMLSelectElement).value as 'auto' | 'always' | 'off';
      profileStore.updateSettings({ touchControls: v });
    });

    this.root.querySelector<HTMLInputElement>('#oa-set-shake')!.addEventListener('change', (e) => {
      const v = (e.target as HTMLInputElement).checked;
      profileStore.updateSettings({ screenShake: v });
    });

    this.root.querySelector('#oa-sb-save')!.addEventListener('click', async () => {
      const url = this.root.querySelector<HTMLInputElement>('#oa-sb-url')!.value;
      const key = this.root.querySelector<HTMLInputElement>('#oa-sb-key')!.value;
      const space = this.root.querySelector<HTMLInputElement>('#oa-sb-space')!.value;
      arenaCloudSync.saveConfig({ supabaseUrl: url, supabaseAnonKey: key, spaceCode: space, autoSync: true });
      const res = await profileStore.pushNow();
      this.cloudFeedback = res.message;
      this.render();
    });

    this.root.querySelector('#oa-sb-pull')!.addEventListener('click', async () => {
      const res = await profileStore.syncFromCloud(true);
      this.cloudFeedback = res.message;
      this.render();
    });

    this.root.querySelector('#oa-sb-paste')!.addEventListener('click', async () => {
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

    this.root.querySelector('#oa-export-json')!.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(profileStore.get(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OMNI_ARENA_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    this.root.querySelector<HTMLInputElement>('#oa-import-json')!.addEventListener('change', async (e) => {
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

    this.root.querySelector('#oa-reset-data')!.addEventListener('click', () => {
      profileStore.resetAll();
      this.activeModal = 'none';
      this.render();
    });
  }
}
