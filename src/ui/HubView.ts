import { AXIS_META, DIFFICULTY_META, GAME_CATALOG, STANDALONE_IDS } from '../catalog';
import { synthAudio } from '../audio/SynthAudio';
import { Icons } from '../icons';
import {
  computeOverallRating,
  getDailyTriad,
  profileStore,
  ratingToRank,
  xpForLevel,
} from '../state/ProfileStore';
import { DifficultyId, GameModeId, SkillAxis, StandaloneGameId } from '../types';
import { resolveCompanionUrl } from '../utils/ecosystem';
import { renderRadarSvg } from './RadarChart';

function modeIcon(id: GameModeId): string {
  switch (id) {
    case 'aim3d':
      return Icons.crosshair(20);
    case 'runner3d':
      return Icons.cube3d(20);
    case 'cube3d':
      return Icons.paddle3d(20);
    case 'parkour3d':
      return Icons.parkour(20);
    case 'rhythm2d':
      return Icons.music(20);
    case 'parry2d':
      return Icons.parry(20);
    case 'bullet2d':
      return Icons.bolt(20);
    case 'puzzle2d':
      return Icons.puzzle(20);
    case 'tetris2d':
      return Icons.blocks(20);
    case 'twinstick2d':
      return Icons.twinStick(20);
    default:
      return Icons.omni(22);
  }
}

const DIFFICULTY_ORDER: DifficultyId[] = ['chill', 'standard', 'hyper', 'adaptive'];

export class HubView {
  private root: HTMLElement;
  private onLaunch: (modeId: GameModeId) => void;
  private settingsOpen = false;
  private dimFilter: 'all' | '3D' | '2D' = 'all';

  constructor(root: HTMLElement, onLaunch: (modeId: GameModeId) => void) {
    this.root = root;
    this.onLaunch = onLaunch;
  }

  public render(): void {
    const profile = profileStore.get();
    const overall = computeOverallRating(profile.ratings);
    const rank = ratingToRank(overall);
    const nextXp = xpForLevel(profile.level);
    const xpPct = Math.min(100, Math.round((profile.xp / nextXp) * 100));
    const triad = getDailyTriad();
    const activeDiff = profile.settings.difficulty ?? 'adaptive';
    const diffInfo = DIFFICULTY_META[activeDiff];

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
            <span class="oa-mode-icon">${modeIcon(id)}</span>
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
            <span class="oa-brand-mark">${Icons.omni(24)}</span>
            <span class="oa-brand-name">OMNI ARENA</span>
            <span class="oa-brand-tag">10 MODOS · 2D + 3D</span>
          </div>
          <div class="oa-topbar-right">
            <a class="oa-eco-link" href="${resolveCompanionUrl('atelier')}">Atelier Diario</a>
            <a class="oa-eco-link" href="${resolveCompanionUrl('unumbral')}">UNUmbral</a>
            <div class="oa-streak-pill" title="Racha diaria">${Icons.flame(16)}<span>${profile.dailyStreak} DÍAS</span></div>
            <div class="oa-lvl-pill">NV ${profile.level} · ${xpPct}%</div>
            <button type="button" class="oa-icon-btn" id="oa-hub-mute" title="Silenciar">${profile.settings.muted ? Icons.volumeOff(18) : Icons.volumeOn(18)}</button>
            <button type="button" class="oa-icon-btn" id="oa-hub-settings" title="Ajustes">${Icons.sliders(18)}</button>
          </div>
        </header>

        <section class="oa-command-grid">
          <div class="oa-hero-deck">
            <div class="oa-hero-copy">
              <h1>ENTRENA Y DOMINA TODAS LAS DIMENSIONES</h1>
              <p>10 disciplinas entre shooters 3D, parkour aéreo, arkanoid, ritmo, parry en milisegundos, tetris blitz y bullet hell. Escoge dificultad fija o activa el modo IA dinámico.</p>
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
                  <span class="oa-launch-dim">2D ↔ 3D · 10 JUEGOS</span>
                  <strong>OMNI GAUNTLET</strong>
                  <span>Rotación cada 15s sin perder tu combo</span>
                </div>
                <span class="oa-launch-go">${Icons.play(20)}</span>
              </button>

              <button type="button" class="oa-launch-secondary" data-mode="ranked">
                <div class="oa-launch-meta">
                  <span class="oa-launch-dim">10 PRUEBAS · 2m 30s</span>
                  <strong>TEST RANKED GLOBAL</strong>
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
            <h2>DISCIPLINAS DE ENTRENAMIENTO (10 MODOS)</h2>
            <div class="oa-filter-tabs" role="tablist">
              <button type="button" class="oa-filter-btn ${this.dimFilter === 'all' ? 'is-active' : ''}" data-filter="all">TODOS (10)</button>
              <button type="button" class="oa-filter-btn ${this.dimFilter === '3D' ? 'is-active' : ''}" data-filter="3D">3D (4)</button>
              <button type="button" class="oa-filter-btn ${this.dimFilter === '2D' ? 'is-active' : ''}" data-filter="2D">2D (6)</button>
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

        <div class="oa-overlay ${this.settingsOpen ? '' : 'is-hidden'}" id="oa-settings-overlay">
          <div class="oa-modal oa-settings-modal">
            <div class="oa-settings-head">
              <h2>AJUSTES DE HARDWARE</h2>
              <button type="button" class="oa-icon-btn" id="oa-close-settings">${Icons.check(18)}</button>
            </div>

            <label class="oa-setting-row">
              <span>Volumen general (${Math.round(profile.settings.volume * 100)}%)</span>
              <input type="range" id="oa-set-vol" min="0" max="1" step="0.05" value="${profile.settings.volume}" />
            </label>

            <label class="oa-setting-row">
              <span>Sensibilidad 3D Aim (${profile.settings.aimSensitivity.toFixed(1)}x)</span>
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
              <span>Vibración de cámara (Screen Shake)</span>
              <input type="checkbox" id="oa-set-shake" ${profile.settings.screenShake ? 'checked' : ''} />
            </label>

            <div class="oa-modal-actions">
              <button type="button" class="oa-btn oa-btn-danger" id="oa-reset-data">BORRAR PROGRESO</button>
              <button type="button" class="oa-btn oa-btn-primary" id="oa-save-settings">LISTO</button>
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

    this.root.querySelector('#oa-hub-mute')!.addEventListener('click', () => {
      const s = profileStore.get().settings;
      const next = !s.muted;
      profileStore.updateSettings({ muted: next });
      synthAudio.setConfig(s.volume, next);
      this.render();
    });

    const settingsModal = this.root.querySelector('#oa-settings-overlay')!;
    this.root.querySelector('#oa-hub-settings')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.settingsOpen = true;
      settingsModal.classList.remove('is-hidden');
    });

    const closeSettings = () => {
      this.settingsOpen = false;
      settingsModal.classList.add('is-hidden');
      this.render();
    };
    this.root.querySelector('#oa-close-settings')!.addEventListener('click', closeSettings);
    this.root.querySelector('#oa-save-settings')!.addEventListener('click', closeSettings);

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

    this.root.querySelector('#oa-reset-data')!.addEventListener('click', () => {
      profileStore.resetAll();
      this.settingsOpen = false;
      this.render();
    });
  }
}
