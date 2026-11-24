import '../styles/neurolab.css';
import { synthAudio } from '../audio/SynthAudio';
import { GAME_CATALOG } from '../catalog';
import { Icons } from '../icons';
import {
  computePercentile,
  computeVitalityCorrelation,
  getMicroLevel,
  loadTransferCardsFromStorage,
  NEURO_COURSES,
  NEURO_PILLAR_META,
  NEURO_PILLARS,
  NEUROLAB_CORE_IDS,
  readAtelierVitalityFromStorage,
  TransferCard,
} from '../state/NeuroStore';
import { profileStore } from '../state/ProfileStore';
import { GameModeId, NeuroHistoryEntry, NeuroProfile, StandaloneGameId } from '../types';
import { renderEcoSwitchBar } from '../utils/ecosystem';
import { getModeIconSvg, GuideOverlay } from './GuideOverlay';

export type NeuroLabTab = 'overview' | 'courses' | 'telemetry' | 'transfer';

export interface NeuroLabCallbacks {
  onBackToHub: () => void;
  onLaunchMode: (modeId: GameModeId, practiceMode?: boolean, infiniteMode?: boolean) => void;
  onStartDiagnostic: () => void;
  onStartDailySession: () => void;
  onStartCourseDay: (courseId: string, dayNumber: number, modeId: StandaloneGameId) => void;
}

function renderEvolutionChartSvg(history: readonly NeuroHistoryEntry[]): string {
  if (history.length === 0) {
    return `<div class="oa-nl-hero-sub">Aún no hay sesiones registradas en NeuroLab. Completa tu Evaluación Inicial o Sesión Diaria para trazar tu curva cognitiva.</div>`;
  }
  const pts = history.slice(-14);
  const w = 640;
  const h = 190;
  const padL = 38;
  const padR = 18;
  const padT = 18;
  const padB = 30;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const coords = pts.map((entry, idx) => {
    const x = pts.length === 1 ? padL + innerW / 2 : padL + (idx / (pts.length - 1)) * innerW;
    const y = padT + (1 - Math.max(0, Math.min(1000, entry.neuroScore)) / 1000) * innerH;
    return { x, y, entry };
  });

  const poly = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = `${padL},${padT + innerH} ${poly} ${coords[coords.length - 1].x.toFixed(1)},${padT + innerH}`;

  const gridLines = [0, 250, 500, 750, 1000]
    .map((val) => {
      const gy = padT + (1 - val / 1000) * innerH;
      return `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${w - padR}" y2="${gy.toFixed(1)}" stroke="var(--border-subtle)" stroke-dasharray="3 4"/>
              <text x="${padL - 6}" y="${(gy + 4).toFixed(1)}" text-anchor="end" fill="var(--ink-muted)" font-size="10" font-family="var(--font-mono)">${val}</text>`;
    })
    .join('');

  const dots = coords
    .map(
      (c) => `
      <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4.5" fill="var(--accent-cyan)" stroke="var(--bg-panel)" stroke-width="2"/>
      <text x="${c.x.toFixed(1)}" y="${h - 10}" text-anchor="middle" fill="var(--ink-muted)" font-size="9.5" font-family="var(--font-mono)">${c.entry.day.slice(5)}</text>
    `
    )
    .join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Evolución del NeuroScore">
      ${gridLines}
      ${pts.length > 1 ? `<polygon points="${area}" fill="rgba(0,229,255,0.12)"/><polyline points="${poly}" fill="none" stroke="var(--accent-cyan)" stroke-width="2.5"/>` : ''}
      ${dots}
    </svg>
  `;
}

export class NeuroLabView {
  private root: HTMLElement;
  private callbacks: NeuroLabCallbacks;
  private activeTab: NeuroLabTab = 'overview';
  private activeGuide: GuideOverlay | null = null;
  private bannerNotice: string | null = null;

  // Transfer Mode (Evocación Relámpago) state
  private transferCards: TransferCard[] = [];
  private transferFromAtelier = false;
  private transferIdx = 0;
  private transferRevealed = false;
  private transferCardStartMs = 0;
  private transferHits = 0;
  private transferMisses = 0;
  private transferRxSamples: number[] = [];
  private transferTimeLeft = 12;
  private transferTimerId = 0;

  constructor(root: HTMLElement, callbacks: NeuroLabCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
    const loaded = loadTransferCardsFromStorage();
    this.transferCards = loaded.cards;
    this.transferFromAtelier = loaded.fromAtelier;
  }

  public setNotice(text: string): void {
    this.bannerNotice = text;
  }

  public setTab(tab: NeuroLabTab): void {
    this.activeTab = tab;
    this.stopTransferTimer();
    this.render();
  }

  public destroy(): void {
    this.stopTransferTimer();
    this.activeGuide?.close(true);
    this.activeGuide = null;
  }

  private stopTransferTimer(): void {
    if (this.transferTimerId) {
      window.clearInterval(this.transferTimerId);
      this.transferTimerId = 0;
    }
  }

  private startTransferCard(): void {
    this.stopTransferTimer();
    this.transferRevealed = false;
    this.transferTimeLeft = 12;
    this.transferCardStartMs = performance.now();
    this.transferTimerId = window.setInterval(() => {
      if (this.activeTab !== 'transfer' || this.transferRevealed) {
        this.stopTransferTimer();
        return;
      }
      this.transferTimeLeft = Math.max(0, this.transferTimeLeft - 0.2);
      const fill = this.root.querySelector<HTMLDivElement>('#oa-tr-timer-fill');
      if (fill) {
        fill.style.width = `${Math.round((this.transferTimeLeft / 12) * 100)}%`;
      }
      if (this.transferTimeLeft <= 0) {
        this.transferRevealed = true;
        this.stopTransferTimer();
        this.render();
      }
    }, 200);
  }

  public render(): void {
    const profile = profileStore.get();
    const neuro = profileStore.getNeuro();
    document.documentElement.setAttribute('data-theme', profile.settings.theme ?? 'night');

    const completedSteps = neuro.dailyPlan.steps.filter((s) => s.completed).length;
    const weakestPillar = [...NEURO_PILLARS].sort((a, b) => neuro.pillars[a] - neuro.pillars[b])[0];

    const pillarBarsHtml = NEURO_PILLARS.map((p) => {
      const meta = NEURO_PILLAR_META[p];
      const val = neuro.pillars[p];
      const pct = Math.min(100, Math.round((val / 1000) * 100));
      return `
        <div class="oa-nl-pillar-row">
          <div class="oa-nl-pillar-head">
            <span style="color:${meta.accent}">${meta.label}</span>
            <strong>${val} / 1000</strong>
          </div>
          <div class="oa-nl-pillar-bar"><span style="width:${pct}%; background:${meta.accent}"></span></div>
        </div>
      `;
    }).join('');

    let tabBodyHtml = '';
    if (this.activeTab === 'overview') {
      tabBodyHtml = this.renderOverviewTab(neuro, completedSteps, weakestPillar);
    } else if (this.activeTab === 'courses') {
      tabBodyHtml = this.renderCoursesTab(neuro);
    } else if (this.activeTab === 'telemetry') {
      tabBodyHtml = this.renderTelemetryTab(neuro);
    } else {
      tabBodyHtml = this.renderTransferTab();
    }

    this.root.innerHTML = `
      ${renderEcoSwitchBar('arena')}
      <div class="oa-nl-wrap">
        <header class="oa-topbar">
          <div class="oa-brand">
            <button type="button" class="oa-top-btn" id="oa-nl-back">${Icons.arrowLeft(16)}<span>Hub Arena</span></button>
            <span class="oa-brand-mark">${Icons.neuroLab(22)}</span>
            <span class="oa-brand-name">NEUROLAB</span>
            <span class="oa-brand-tag">NEURONATION++ · 4 PILARES</span>
          </div>
          <div class="oa-topbar-right">
            <button type="button" class="oa-top-btn" id="oa-nl-theme">
              ${profile.settings.theme === 'day' ? Icons.sun(16) : Icons.moon(16)}<span>Tema: ${
                profile.settings.theme === 'day' ? 'Día' : 'Noche'
              }</span>
            </button>
            <div class="oa-streak-pill">${Icons.flame(16)}<span>${profile.dailyStreak} DÍAS</span></div>
            <div class="oa-lvl-pill">NEUROSCORE ${neuro.neuroScore}</div>
          </div>
        </header>

        ${
          this.bannerNotice
            ? `<div class="oa-nl-card" style="border-color:var(--accent-cyan); padding:14px 18px; flex-direction:row; justify-content:space-between; align-items:center;">
                 <span>${this.bannerNotice}</span>
                 <button type="button" class="oa-btn oa-btn-sm" id="oa-nl-dismiss-notice">Entendido</button>
               </div>`
            : ''
        }

        <section class="oa-nl-hero">
          <div class="oa-nl-card">
            <h1 class="oa-nl-hero-title">LABORATORIO COGNITIVO NEUROLAB</h1>
            <p class="oa-nl-hero-sub">
              Entrenamiento científico adaptativo (niveles 1–300) sobre Memoria de Trabajo, Atención Sostenida, Velocidad de Procesamiento y Flexibilidad Ejecutiva.
              Tu pilar prioritario hoy es <strong>${NEURO_PILLAR_META[weakestPillar].label}</strong> (${neuro.pillars[weakestPillar]} pts).
            </p>
            <div class="oa-nl-cta-row">
              <button type="button" class="oa-btn oa-btn-primary" id="oa-nl-start-daily">
                ${Icons.play(16)}<span>${
                  completedSteps >= 4
                    ? 'Repetir Sesión Diaria (4/4)'
                    : `Sesión Diaria Inteligente (${completedSteps}/4)`
                }</span>
              </button>
              <button type="button" class="oa-btn" id="oa-nl-start-diag">
                ${Icons.heartPulse(16)}<span>${
                  neuro.baselineCompleted ? 'Recalibrar Diagnóstico (4 pilares)' : 'Evaluación Inicial (4 pilares · 100s)'
                }</span>
              </button>
            </div>
          </div>

          <aside class="oa-nl-card">
            <div class="oa-nl-score-box">
              <div>
                <span class="oa-radar-label">ÍNDICE NEUROSCORE</span>
                <div class="oa-nl-score-val">${neuro.neuroScore}</div>
              </div>
              <span class="oa-brand-tag">${neuro.baselineCompleted ? 'CALIBRADO' : 'SIN DIAGNÓSTICO'}</span>
            </div>
            <div class="oa-nl-pillars-list">
              ${pillarBarsHtml}
            </div>
          </aside>
        </section>

        <nav class="oa-nl-tabs" role="tablist" aria-label="Secciones de NeuroLab">
          <button type="button" class="oa-nl-tab ${this.activeTab === 'overview' ? 'is-active' : ''}" data-nl-tab="overview">
            ${Icons.neuroLab(15)}<span>Sesión Diaria y Disciplinas</span>
          </button>
          <button type="button" class="oa-nl-tab ${this.activeTab === 'courses' ? 'is-active' : ''}" data-nl-tab="courses">
            ${Icons.layers(15)}<span>Cursos 14 / 28 Días</span>
          </button>
          <button type="button" class="oa-nl-tab ${this.activeTab === 'telemetry' ? 'is-active' : ''}" data-nl-tab="telemetry">
            ${Icons.heartPulse(15)}<span>Telemetría y Vitalidad</span>
          </button>
          <button type="button" class="oa-nl-tab ${this.activeTab === 'transfer' ? 'is-active' : ''}" data-nl-tab="transfer">
            ${Icons.bolt(15)}<span>Transferencia (Evocación)</span>
          </button>
        </nav>

        <main id="oa-nl-tab-body">
          ${tabBodyHtml}
        </main>
      </div>
    `;

    this.bindEvents();
  }

  private renderOverviewTab(
    neuro: NeuroProfile,
    completedSteps: number,
    weakestPillar: typeof NEURO_PILLARS[number]
  ): string {
    const dailyStepsHtml = neuro.dailyPlan.steps
      .map((step, idx) => {
        const desc = GAME_CATALOG[step.modeId];
        const pMeta = NEURO_PILLAR_META[step.pillar];
        const microLvl = getMicroLevel(neuro, step.modeId);
        return `
          <article class="oa-nl-step-card ${step.completed ? 'is-done' : ''}">
            <div class="oa-nl-step-top">
              <span>PASO ${idx + 1}/4 · ${pMeta.short}</span>
              <span>${step.completed ? Icons.check(14) + ' LISTO' : `NV ${microLvl}`}</span>
            </div>
            <div>
              <h4>${desc.title}</h4>
              <p class="oa-nl-step-meta">${
                step.completed && typeof step.score === 'number'
                  ? `Puntos: ${step.score.toLocaleString('es-ES')}${step.reactionMs ? ` · ${step.reactionMs} ms` : ''}`
                  : idx === 0 || idx === 2
                  ? 'Refuerzo de pilar prioritario'
                  : 'Consolidación cognitiva'
              }</p>
            </div>
            <button type="button" class="oa-btn oa-btn-sm ${step.completed ? '' : 'oa-btn-primary'}" data-nl-launch="${step.modeId}">
              ${Icons.play(14)}<span>${step.completed ? 'Repetir' : 'Entrenar'}</span>
            </button>
          </article>
        `;
      })
      .join('');

    const coreCardsHtml = NEUROLAB_CORE_IDS.map((id) => {
      const desc = GAME_CATALOG[id];
      const microLvl = getMicroLevel(neuro, id);
      return `
        <article class="oa-nl-game-card" style="--tile-accent:${desc.accent}">
          <div>
            <div class="oa-nl-game-head">
              <div class="oa-diamond-badge" style="--em-accent:${desc.accent}">
                <span class="oa-diamond-ring"></span>
                <span class="oa-diamond-core">${getModeIconSvg(id, 20)}</span>
              </div>
              <span class="oa-nl-lvl-tag">MICRO-NV ${microLvl}/300</span>
            </div>
            <h3>${desc.title}</h3>
            <p>${desc.subtitle}</p>
          </div>
          <div class="oa-nl-game-actions">
            <button type="button" class="oa-btn oa-btn-primary oa-btn-sm" data-nl-launch="${id}">${Icons.play(14)}<span>Jugar</span></button>
            <button type="button" class="oa-btn oa-btn-sm" data-nl-guide="${id}">${Icons.help(14)}<span>Guía</span></button>
          </div>
        </article>
      `;
    }).join('');

    return `
      <div style="display:flex; flex-direction:column; gap:20px;">
        <section class="oa-nl-card">
          <div class="oa-sec-head" style="margin:0;">
            <h2>SESIÓN DIARIA INTELIGENTE (${completedSteps}/4 · ENFOQUE: ${NEURO_PILLAR_META[weakestPillar].short})</h2>
            <span class="oa-brand-tag">${
              neuro.dailyPlan.activePauseDone ? 'Micro-pausa completada' : 'Incluye Micro-pausa activa 35s'
            }</span>
          </div>
          <div class="oa-nl-daily-grid">
            ${dailyStepsHtml}
          </div>
        </section>

        <section>
          <div class="oa-sec-head">
            <h2>7 DISCIPLINAS CIENTÍFICAS NEUROLAB</h2>
          </div>
          <div class="oa-nl-games-grid">
            ${coreCardsHtml}
          </div>
        </section>
      </div>
    `;
  }

  private renderCoursesTab(neuro: NeuroProfile): string {
    const cards = NEURO_COURSES.map((course) => {
      const prog = neuro.courses[course.id] ?? {
        startedAt: 0,
        completedDays: [],
        currentLevel: 1,
      };
      const doneSet = new Set(prog.completedDays);
      const nextDay =
        Array.from({ length: course.days }, (_, i) => i + 1).find((d) => !doneSet.has(d)) ?? course.days;
      const nextMode = course.dayModes[(nextDay - 1) % course.dayModes.length];
      const pct = Math.round((doneSet.size / course.days) * 100);

      const dayCells = Array.from({ length: course.days }, (_, idx) => {
        const dNum = idx + 1;
        const isDone = doneSet.has(dNum);
        const isNext = dNum === nextDay && !isDone;
        const mId = course.dayModes[idx % course.dayModes.length];
        return `<button type="button" class="oa-nl-day-cell ${isDone ? 'is-done' : ''} ${isNext ? 'is-next' : ''}" data-course-id="${course.id}" data-course-day="${dNum}" data-course-mode="${mId}" title="Día ${dNum}: ${GAME_CATALOG[mId].title}">${dNum}</button>`;
      }).join('');

      return `
        <article class="oa-nl-course-card" style="--course-accent:${course.accent}">
          <div class="oa-nl-course-head">
            <div>
              <h3>${course.title}</h3>
              <small>${course.subtitle}</small>
            </div>
            <span class="oa-nl-lvl-tag">${doneSet.size}/${course.days} DÍAS (${pct}%)</span>
          </div>
          <p class="oa-nl-course-desc">${course.description}</p>
          <div class="oa-nl-days-grid">${dayCells}</div>
          <div class="oa-nl-cta-row">
            <button type="button" class="oa-btn oa-btn-primary oa-btn-sm" data-course-id="${course.id}" data-course-day="${nextDay}" data-course-mode="${nextMode}">
              ${Icons.play(14)}<span>Entrenar Día ${nextDay}: ${GAME_CATALOG[nextMode].title}</span>
            </button>
          </div>
        </article>
      `;
    }).join('');

    return `<div class="oa-nl-courses-grid">${cards}</div>`;
  }

  private renderTelemetryTab(neuro: NeuroProfile): string {
    const rxAll = neuro.reactionHistoryMs ?? [];
    const p50 = computePercentile(rxAll, 50);
    const p90 = computePercentile(rxAll, 90);
    const totalSessions = neuro.history.reduce((acc, h) => acc + h.sessions, 0);
    const vitalityLogs = readAtelierVitalityFromStorage();
    const corr = computeVitalityCorrelation(neuro.history, vitalityLogs);

    return `
      <div style="display:flex; flex-direction:column; gap:18px;">
        <div class="oa-nl-telemetry-grid">
          <div class="oa-nl-kpi">
            <span>REACCIÓN MEDIANA (p50)</span>
            <strong>${p50 > 0 ? `${p50} ms` : '--'}</strong>
          </div>
          <div class="oa-nl-kpi">
            <span>LATENCIA ESTABLE (p90)</span>
            <strong>${p90 > 0 ? `${p90} ms` : '--'}</strong>
          </div>
          <div class="oa-nl-kpi">
            <span>SESIONES NEUROLAB</span>
            <strong>${totalSessions}</strong>
          </div>
          <div class="oa-nl-kpi">
            <span>DÍAS CRUZADOS ATELIER</span>
            <strong>${corr.matchedDays}</strong>
          </div>
        </div>

        <section class="oa-nl-card">
          <div class="oa-sec-head" style="margin:0;">
            <h2>EVOLUCIÓN DEL NEUROSCORE (ÚLTIMOS 14 DÍAS)</h2>
          </div>
          <div class="oa-nl-chart-wrap">
            ${renderEvolutionChartSvg(neuro.history)}
          </div>
        </section>

        <section class="oa-nl-card">
          <div class="oa-sec-head" style="margin:0;">
            <h2>CORRELACIÓN SUEÑO, EJERCICIO Y RENDIMIENTO (ATELIER DIARIO)</h2>
            <span class="oa-brand-tag">${corr.hasAtelierData ? 'ATELIER CONECTADO' : 'EN ESPERA DE DATOS'}</span>
          </div>
          <ul class="oa-nl-insights">
            ${corr.insights.map((line) => `<li>${line}</li>`).join('')}
          </ul>
        </section>
      </div>
    `;
  }

  private renderTransferTab(): string {
    const card = this.transferCards[this.transferIdx % this.transferCards.length];
    const total = this.transferHits + this.transferMisses;
    const acc = total > 0 ? Math.round((this.transferHits / total) * 100) : 100;
    const avgRx =
      this.transferRxSamples.length > 0
        ? Math.round(
            this.transferRxSamples.reduce((a, b) => a + b, 0) / this.transferRxSamples.length
          )
        : 0;

    return `
      <section class="oa-nl-card">
        <div class="oa-transfer-stage">
          <div class="oa-sec-head" style="margin:0;">
            <h2>RETO DE TRANSFERENCIA · EVOCACIÓN RELÁMPAGO</h2>
            <span class="oa-brand-tag">${
              this.transferFromAtelier ? 'MAZO ATELIER DIARIO' : 'MAZO CS / LÓGICA / MEMORIA'
            }</span>
          </div>
          <p class="oa-nl-hero-sub">
            Transfiere tu entrenamiento a estudio real: evoca mentalmente la respuesta antes de que se agote la barra de carga cognitiva (12s) y califica tu recuperación.
          </p>

          <div class="oa-nback-timer-wrap">
            <div class="oa-nback-timer-fill" id="oa-tr-timer-fill" style="width:${Math.round(
              (this.transferTimeLeft / 12) * 100
            )}%"></div>
          </div>

          <div class="oa-transfer-card">
            <span class="oa-transfer-deck">${card.deck} · TARJETA ${(this.transferIdx % this.transferCards.length) + 1}/${this.transferCards.length}</span>
            <h3 class="oa-transfer-q">${card.front}</h3>
            ${
              this.transferRevealed
                ? `<p class="oa-transfer-a">${card.back}</p>
                   <div class="oa-nl-cta-row">
                     <button type="button" class="oa-btn oa-btn-primary" id="oa-tr-knew">${Icons.check(15)}<span>La recordé rápido</span></button>
                     <button type="button" class="oa-btn" id="oa-tr-missed">${Icons.refresh(15)}<span>Necesito repasarla</span></button>
                   </div>`
                : `<div class="oa-nl-cta-row">
                     <button type="button" class="oa-btn oa-btn-primary" id="oa-tr-reveal">${Icons.eye(15)}<span>Mostrar respuesta</span></button>
                   </div>`
            }
          </div>

          <div class="oa-nl-telemetry-grid">
            <div class="oa-nl-kpi"><span>EVOCADAS</span><strong>${this.transferHits}</strong></div>
            <div class="oa-nl-kpi"><span>A REPASAR</span><strong>${this.transferMisses}</strong></div>
            <div class="oa-nl-kpi"><span>RETENCIÓN</span><strong>${acc}%</strong></div>
            <div class="oa-nl-kpi"><span>VELOCIDAD</span><strong>${avgRx ? `${avgRx} ms` : '--'}</strong></div>
          </div>
        </div>
      </section>
    `;
  }

  private bindEvents(): void {
    this.root.querySelector('#oa-nl-back')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.callbacks.onBackToHub();
    });

    this.root.querySelector('#oa-nl-dismiss-notice')?.addEventListener('click', () => {
      this.bannerNotice = null;
      this.render();
    });

    this.root.querySelector('#oa-nl-theme')?.addEventListener('click', () => {
      synthAudio.uiClick();
      const curr = profileStore.get().settings.theme;
      const next = curr === 'day' ? 'night' : 'day';
      profileStore.updateSettings({ theme: next });
      document.documentElement.setAttribute('data-theme', next);
      this.render();
    });

    this.root.querySelector('#oa-nl-start-daily')?.addEventListener('click', () => {
      synthAudio.ensure();
      synthAudio.uiClick();
      this.callbacks.onStartDailySession();
    });

    this.root.querySelector('#oa-nl-start-diag')?.addEventListener('click', () => {
      synthAudio.ensure();
      synthAudio.uiClick();
      this.callbacks.onStartDiagnostic();
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-nl-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.uiClick();
        const tab = btn.dataset.nlTab as NeuroLabTab;
        this.activeTab = tab;
        this.render();
        if (tab === 'transfer') {
          this.startTransferCard();
        } else {
          this.stopTransferTimer();
        }
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-nl-launch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.ensure();
        synthAudio.uiClick();
        const mode = btn.dataset.nlLaunch as GameModeId;
        this.callbacks.onLaunchMode(mode, false, false);
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-nl-guide]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.ensure();
        synthAudio.uiClick();
        const mode = btn.dataset.nlGuide as GameModeId;
        this.activeGuide?.close(true);
        this.activeGuide = new GuideOverlay(this.root, mode, {
          context: 'hub',
          onStart: (chosenId, practiceMode, infiniteMode) => {
            this.activeGuide = null;
            this.callbacks.onLaunchMode(chosenId, practiceMode, infiniteMode);
          },
          onClose: () => {
            this.activeGuide = null;
          },
        });
        this.activeGuide.open();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-course-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.ensure();
        synthAudio.uiClick();
        const courseId = btn.dataset.courseId!;
        const dayNum = Number(btn.dataset.courseDay);
        const modeId = btn.dataset.courseMode as StandaloneGameId;
        this.callbacks.onStartCourseDay(courseId, dayNum, modeId);
      });
    });

    // Transfer mode buttons
    this.root.querySelector('#oa-tr-reveal')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.stopTransferTimer();
      this.transferRevealed = true;
      this.transferRxSamples.push(Math.max(250, Math.round(performance.now() - this.transferCardStartMs)));
      this.render();
    });

    this.root.querySelector('#oa-tr-knew')?.addEventListener('click', () => {
      synthAudio.puzzleSuccess(this.transferHits + 1);
      this.transferHits += 1;
      this.transferIdx = (this.transferIdx + 1) % this.transferCards.length;
      profileStore.recordPracticeRun(18);
      this.render();
      this.startTransferCard();
    });

    this.root.querySelector('#oa-tr-missed')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.transferMisses += 1;
      this.transferIdx = (this.transferIdx + 1) % this.transferCards.length;
      this.render();
      this.startTransferCard();
    });
  }
}

// ==================== ACTIVE MICRO-PAUSE OVERLAY (35s) ====================

export function showActiveMicroPause(
  root: HTMLElement,
  onDone: () => void
): () => void {
  let mode: 'sigh' | 'eyes' = 'sigh';
  let timeLeft = 35;
  let elapsed = 0;

  const overlay = document.createElement('div');
  overlay.className = 'oa-overlay';

  const render = () => {
    const cyclePos = elapsed % 8; // 8s physiological sigh cycle: 2s inhale 1, 1.5s inhale 2, 4.5s long exhale
    let phaseLabel = 'INHALA NASAL';
    let scale = 1.05;
    if (mode === 'sigh') {
      if (cyclePos < 2.2) {
        phaseLabel = 'INHALA PROFUNDO';
        scale = 1.12;
      } else if (cyclePos < 3.6) {
        phaseLabel = '2ª INHALACIÓN CORTA';
        scale = 1.24;
      } else {
        phaseLabel = 'EXHALA LENTO';
        scale = 0.86;
      }
    } else {
      phaseLabel = 'MIRA A 6 METROS';
      scale = 1.0;
    }

    overlay.innerHTML = `
      <div class="oa-modal oa-pause-breath-modal" role="dialog" aria-modal="true" aria-label="Micro-Pausa Activa">
        <span class="oa-brand-tag">MICRO-PAUSA ACTIVA · CONSOLIDACIÓN SINÁPTICA</span>
        <h2 style="margin:0; font-family:var(--font-display);">${
          mode === 'sigh' ? 'SUSPIRO FISIOLÓGICO (35s)' : 'DESCANSO VISUAL 20-20-20 (35s)'
        }</h2>
        <div class="oa-nl-cta-row" style="justify-content:center;">
          <button type="button" class="oa-btn oa-btn-sm ${mode === 'sigh' ? 'oa-btn-primary' : ''}" id="oa-mp-sigh">Suspiro Fisiológico</button>
          <button type="button" class="oa-btn oa-btn-sm ${mode === 'eyes' ? 'oa-btn-primary' : ''}" id="oa-mp-eyes">Vista 20-20-20</button>
        </div>
        <div class="oa-breath-ring" id="oa-mp-ring" style="transform:scale(${scale})">
          <strong id="oa-mp-sec">${Math.ceil(timeLeft)}s</strong>
          <span id="oa-mp-phase">${phaseLabel}</span>
        </div>
        <p class="oa-nl-hero-sub">
          ${
            mode === 'sigh'
              ? 'Dos inhalaciones seguidas por la nariz seguidas de una exhalación suave y prolongada para reiniciar el foco.'
              : 'Desvía la vista de la pantalla hacia un punto lejano (6 metros) y parpadea lento para relajar el enfoque ocular.'
          }
        </p>
        <div class="oa-nl-cta-row">
          <button type="button" class="oa-btn oa-btn-primary" id="oa-mp-skip">Continuar al bloque 2</button>
        </div>
      </div>
    `;

    overlay.querySelector('#oa-mp-sigh')?.addEventListener('click', () => {
      mode = 'sigh';
      render();
    });
    overlay.querySelector('#oa-mp-eyes')?.addEventListener('click', () => {
      mode = 'eyes';
      render();
    });
    overlay.querySelector('#oa-mp-skip')?.addEventListener('click', () => {
      cleanup();
      profileStore.markNeuroActivePauseDone();
      onDone();
    });
  };

  root.innerHTML = '';
  root.appendChild(overlay);
  render();

  const timer = window.setInterval(() => {
    elapsed += 0.5;
    timeLeft = Math.max(0, timeLeft - 0.5);
    const secEl = overlay.querySelector('#oa-mp-sec');
    const phaseEl = overlay.querySelector('#oa-mp-phase');
    const ringEl = overlay.querySelector<HTMLDivElement>('#oa-mp-ring');
    if (secEl) secEl.textContent = `${Math.ceil(timeLeft)}s`;

    if (mode === 'sigh' && phaseEl && ringEl) {
      const cyclePos = elapsed % 8;
      if (cyclePos < 2.2) {
        phaseEl.textContent = 'INHALA PROFUNDO';
        ringEl.style.transform = 'scale(1.12)';
      } else if (cyclePos < 3.6) {
        phaseEl.textContent = '2ª INHALACIÓN CORTA';
        ringEl.style.transform = 'scale(1.24)';
      } else {
        phaseEl.textContent = 'EXHALA LENTO';
        ringEl.style.transform = 'scale(0.86)';
      }
    }

    if (timeLeft <= 0) {
      cleanup();
      profileStore.markNeuroActivePauseDone();
      synthAudio.puzzleSuccess(2);
      onDone();
    }
  }, 500);

  const cleanup = () => {
    window.clearInterval(timer);
    overlay.remove();
  };

  return cleanup;
}
