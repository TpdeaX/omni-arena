import { AXIS_META, DIFFICULTY_META, GAME_CATALOG } from '../catalog';
import { synthAudio } from '../audio/SynthAudio';
import { createMiniGame, GauntletOrchestrator } from '../games/GauntletOrchestrator';
import { Icons } from '../icons';
import { computeOverallRating, profileStore } from '../state/ProfileStore';
import {
  DifficultyId,
  GameContext,
  GameModeId,
  HudState,
  MiniGame,
  RunMetrics,
  SkillAxis,
  StandaloneGameId,
} from '../types';

export interface GameShellCallbacks {
  onExitToHub: () => void;
  onReplay: (modeId: GameModeId) => void;
}

export class GameShell {
  private root: HTMLElement;
  private modeId: GameModeId;
  private callbacks: GameShellCallbacks;

  private shellEl!: HTMLDivElement;
  private stageHostEl!: HTMLDivElement;
  private hudEls!: {
    bar: HTMLDivElement;
    dim: HTMLSpanElement;
    phase: HTMLSpanElement;
    sub: HTMLSpanElement;
    score: HTMLSpanElement;
    combo: HTMLSpanElement;
    timer: HTMLSpanElement;
    intensity: HTMLSpanElement;
    shields: HTMLDivElement;
    muteBtn: HTMLButtonElement;
  };
  private toastHostEl!: HTMLDivElement;
  private pauseOverlayEl!: HTMLDivElement;
  private debriefEl!: HTMLDivElement;

  private runner: MiniGame | GauntletOrchestrator | null = null;
  private rafId = 0;
  private lastFrameMs = 0;
  private runStartedAt = 0;
  private totalActiveTime = 0;

  private difficulty: DifficultyId = 'adaptive';
  private liveIntensity = 1.0;
  private peakIntensity = 1.0;

  private hudState: HudState = {
    score: 0,
    combo: 0,
    shields: 5,
    maxShields: 5,
    timeLeftSec: null,
    phaseLabel: '',
    dimension: '2D',
    accent: '#00E5FF',
    subStat: '',
    intensity: 1.0,
  };

  private paused = false;
  private finished = false;
  private destroyed = false;

  constructor(root: HTMLElement, modeId: GameModeId, callbacks: GameShellCallbacks) {
    this.root = root;
    this.modeId = modeId;
    this.callbacks = callbacks;
  }

  private computeStartIntensity(difficulty: DifficultyId): number {
    if (difficulty !== 'adaptive') {
      return DIFFICULTY_META[difficulty].baseScale;
    }
    const profile = profileStore.get();
    const desc = GAME_CATALOG[this.modeId];
    const baseRating =
      desc.axis === 'all'
        ? computeOverallRating(profile.ratings)
        : profile.ratings[desc.axis as SkillAxis];
    const scaled = 0.86 + ((baseRating - 260) / 740) * 0.48;
    return Math.max(0.84, Math.min(1.36, Number(scaled.toFixed(2))));
  }

  public start(): void {
    const desc = GAME_CATALOG[this.modeId];
    const profile = profileStore.get();
    this.difficulty = profile.settings.difficulty ?? 'adaptive';
    this.liveIntensity = this.computeStartIntensity(this.difficulty);
    this.peakIntensity = this.liveIntensity;

    const isTouch =
      profile.settings.touchControls === 'always' ||
      (profile.settings.touchControls === 'auto' &&
        ('ontouchstart' in window || navigator.maxTouchPoints > 0));

    const maxShields =
      this.difficulty === 'chill'
        ? 6
        : this.modeId === 'gauntlet' || this.modeId === 'ranked'
        ? 5
        : 4;

    this.hudState = {
      score: 0,
      combo: 0,
      shields: maxShields,
      maxShields,
      timeLeftSec: null,
      phaseLabel: desc.title,
      dimension: desc.dimension === '3D' ? '3D' : '2D',
      accent: desc.accent,
      subStat: isTouch ? desc.controlsTouch : desc.controlsPC,
      intensity: this.liveIntensity,
    };

    this.shellEl = document.createElement('div');
    this.shellEl.className = 'oa-arena-shell';
    this.shellEl.innerHTML = `
      <header class="oa-hud">
        <div class="oa-hud-left">
          <button type="button" class="oa-icon-btn" id="oa-btn-back" title="Volver al Hub">${Icons.arrowLeft(18)}</button>
          <span class="oa-dim-pill" id="oa-hud-dim">2D</span>
          <div class="oa-hud-titles">
            <span class="oa-hud-phase" id="oa-hud-phase">${desc.title}</span>
            <span class="oa-hud-sub" id="oa-hud-sub"></span>
          </div>
        </div>
        <div class="oa-hud-center">
          <div class="oa-hud-shields" id="oa-hud-shields"></div>
          <span class="oa-hud-timer" id="oa-hud-timer">--:--</span>
          <span class="oa-intensity-pill" id="oa-hud-intensity" title="Intensidad / Dificultad en vivo">1.00×</span>
        </div>
        <div class="oa-hud-right">
          <div class="oa-hud-stat">
            <span class="oa-stat-label">COMBO</span>
            <span class="oa-hud-combo" id="oa-hud-combo">x1</span>
          </div>
          <div class="oa-hud-stat">
            <span class="oa-stat-label">SCORE</span>
            <span class="oa-hud-score" id="oa-hud-score">0</span>
          </div>
          <button type="button" class="oa-icon-btn" id="oa-btn-mute" title="Audio">${profile.settings.muted ? Icons.volumeOff(18) : Icons.volumeOn(18)}</button>
          <button type="button" class="oa-icon-btn" id="oa-btn-pause" title="Pausa (ESC)">${Icons.pause(18)}</button>
        </div>
      </header>
      <main class="oa-stage-host" id="oa-stage-host"></main>
      <div class="oa-toast-host" id="oa-toast-host"></div>
      <div class="oa-overlay is-hidden" id="oa-pause-overlay">
        <div class="oa-modal">
          <h2>PARTIDA EN PAUSA</h2>
          <p class="oa-modal-ctrl">${isTouch ? desc.controlsTouch : desc.controlsPC}</p>
          <div class="oa-modal-actions">
            <button type="button" class="oa-btn oa-btn-primary" id="oa-resume-btn">${Icons.play(16)}<span>CONTINUAR</span></button>
            <button type="button" class="oa-btn" id="oa-retry-btn">${Icons.refresh(16)}<span>REINICIAR</span></button>
            <button type="button" class="oa-btn oa-btn-ghost" id="oa-quit-btn">${Icons.arrowLeft(16)}<span>SALIR AL HUB</span></button>
          </div>
        </div>
      </div>
      <div class="oa-overlay is-hidden" id="oa-debrief-overlay"></div>
    `;

    this.root.innerHTML = '';
    this.root.appendChild(this.shellEl);

    this.stageHostEl = this.shellEl.querySelector('#oa-stage-host')!;
    this.toastHostEl = this.shellEl.querySelector('#oa-toast-host')!;
    this.pauseOverlayEl = this.shellEl.querySelector('#oa-pause-overlay')!;
    this.debriefEl = this.shellEl.querySelector('#oa-debrief-overlay')!;

    this.hudEls = {
      bar: this.shellEl.querySelector('.oa-hud')!,
      dim: this.shellEl.querySelector('#oa-hud-dim')!,
      phase: this.shellEl.querySelector('#oa-hud-phase')!,
      sub: this.shellEl.querySelector('#oa-hud-sub')!,
      score: this.shellEl.querySelector('#oa-hud-score')!,
      combo: this.shellEl.querySelector('#oa-hud-combo')!,
      timer: this.shellEl.querySelector('#oa-hud-timer')!,
      intensity: this.shellEl.querySelector('#oa-hud-intensity')!,
      shields: this.shellEl.querySelector('#oa-hud-shields')!,
      muteBtn: this.shellEl.querySelector('#oa-btn-mute')!,
    };

    this.bindShellEvents();
    this.renderHud();

    const ctx: GameContext = {
      container: this.stageHostEl,
      isTouch,
      settings: profile.settings,
      difficulty: this.difficulty,
      getIntensity: () => this.liveIntensity,
      setHud: (patch) => {
        Object.assign(this.hudState, patch);
        this.renderHud();
      },
      damage: (amount = 1) => {
        this.hudState.shields = Math.max(0, this.hudState.shields - amount);
        if (this.difficulty === 'adaptive') {
          this.liveIntensity = Math.max(0.72, Number((this.liveIntensity - 0.14).toFixed(2)));
          this.hudState.intensity = this.liveIntensity;
        }
        this.renderHud();
        if (profileStore.get().settings.screenShake) {
          this.stageHostEl.classList.remove('is-shaking');
          void this.stageHostEl.offsetWidth;
          this.stageHostEl.classList.add('is-shaking');
        }
        return this.hudState.shields;
      },
      heal: (amount = 1) => {
        this.hudState.shields = Math.min(this.hudState.maxShields, this.hudState.shields + amount);
        this.renderHud();
      },
      addScore: (points, comboInc = 0) => {
        if (comboInc > 0) {
          this.hudState.combo += comboInc;
          if (this.difficulty === 'adaptive') {
            const step = Math.min(0.032, 0.014 * comboInc);
            this.liveIntensity = Math.min(1.8, Number((this.liveIntensity + step).toFixed(2)));
            this.peakIntensity = Math.max(this.peakIntensity, this.liveIntensity);
            this.hudState.intensity = this.liveIntensity;
          }
        }
        const comboMult = 1 + Math.min(2.5, Math.floor(this.hudState.combo / 5) * 0.25);
        const diffScoreMult =
          this.difficulty === 'adaptive'
            ? Math.max(0.9, this.liveIntensity)
            : DIFFICULTY_META[this.difficulty].scoreMult;
        this.hudState.score += Math.round(points * comboMult * diffScoreMult);
        this.renderHud();
      },
      breakCombo: () => {
        this.hudState.combo = 0;
        if (this.difficulty === 'adaptive') {
          this.liveIntensity = Math.max(0.74, Number((this.liveIntensity - 0.04).toFixed(2)));
          this.hudState.intensity = this.liveIntensity;
        }
        this.renderHud();
      },
      finish: (partial) => this.handleFinish(partial),
      toast: (text, tone = 'accent') => this.showToast(text, tone),
    };

    if (this.modeId === 'gauntlet') {
      this.runner = new GauntletOrchestrator(false);
    } else if (this.modeId === 'ranked') {
      this.runner = new GauntletOrchestrator(true);
    } else {
      this.runner = createMiniGame(this.modeId as StandaloneGameId, false);
    }

    this.runner.mount(ctx);
    this.runStartedAt = performance.now();
    this.lastFrameMs = this.runStartedAt;
    this.rafId = requestAnimationFrame(this.loop);
  }

  private bindShellEvents(): void {
    this.shellEl.querySelector('#oa-btn-back')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.togglePause(true);
    });
    this.shellEl.querySelector('#oa-btn-pause')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.togglePause();
    });
    this.hudEls.muteBtn.addEventListener('click', () => {
      const s = profileStore.get().settings;
      const next = !s.muted;
      profileStore.updateSettings({ muted: next });
      synthAudio.setConfig(s.volume, next);
      this.hudEls.muteBtn.innerHTML = next ? Icons.volumeOff(18) : Icons.volumeOn(18);
    });

    this.shellEl.querySelector('#oa-resume-btn')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.togglePause(false);
    });
    this.shellEl.querySelector('#oa-retry-btn')!.addEventListener('click', () => {
      synthAudio.uiClick();
      const m = this.modeId;
      this.destroy();
      this.callbacks.onReplay(m);
    });
    this.shellEl.querySelector('#oa-quit-btn')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.destroy();
      this.callbacks.onExitToHub();
    });

    window.addEventListener('keydown', this.onGlobalKey);
    window.addEventListener('resize', this.onResize);
  }

  private onGlobalKey = (e: KeyboardEvent): void => {
    if (e.code === 'Escape' && !this.finished) {
      e.preventDefault();
      this.togglePause();
    }
  };

  private onResize = (): void => {
    this.runner?.onResize();
  };

  private togglePause(force?: boolean): void {
    if (this.finished) return;
    this.paused = force !== undefined ? force : !this.paused;
    this.runner?.setPaused(this.paused);
    this.pauseOverlayEl.classList.toggle('is-hidden', !this.paused);
    if (!this.paused) {
      this.lastFrameMs = performance.now();
    }
  }

  private loop = (now: number): void => {
    if (this.destroyed || this.finished) return;
    const rawDt = (now - this.lastFrameMs) / 1000;
    this.lastFrameMs = now;
    const dt = Math.min(0.05, Math.max(0, rawDt));

    if (!this.paused) {
      this.totalActiveTime += dt;
      this.runner?.update(dt, this.totalActiveTime);
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private renderHud(): void {
    const h = this.hudState;
    this.hudEls.bar.style.setProperty('--hud-accent', h.accent);
    this.hudEls.dim.textContent = h.dimension;
    this.hudEls.phase.textContent = h.phaseLabel;
    this.hudEls.sub.textContent = h.subStat;
    this.hudEls.score.textContent = h.score.toLocaleString('es-ES');

    const mult = 1 + Math.min(2.5, Math.floor(h.combo / 5) * 0.25);
    this.hudEls.combo.textContent = `${h.combo} (x${mult.toFixed(2).replace(/\.00$/, '')})`;

    // Intensity badge
    const intPrefix = this.difficulty === 'adaptive' ? 'IA ' : '';
    this.hudEls.intensity.textContent = `${intPrefix}${this.liveIntensity.toFixed(2)}×`;
    this.hudEls.intensity.classList.toggle('is-hot', this.liveIntensity >= 1.28);
    this.hudEls.intensity.classList.toggle('is-overdrive', this.liveIntensity >= 1.52);

    if (h.timeLeftSec === null) {
      const mins = Math.floor(this.totalActiveTime / 60);
      const secs = Math.floor(this.totalActiveTime % 60);
      this.hudEls.timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } else {
      const s = Math.max(0, Math.ceil(h.timeLeftSec));
      const mins = Math.floor(s / 60);
      const rem = s % 60;
      this.hudEls.timer.textContent = `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    }

    let pips = '';
    for (let i = 0; i < h.maxShields; i++) {
      pips += `<span class="oa-shield-pip ${i < h.shields ? 'is-full' : 'is-empty'}">${Icons.shield(14)}</span>`;
    }
    this.hudEls.shields.innerHTML = pips;
  }

  private showToast(text: string, tone: 'good' | 'warn' | 'bad' | 'accent'): void {
    const el = document.createElement('div');
    el.className = `oa-toast oa-toast-${tone}`;
    el.textContent = text;
    this.toastHostEl.appendChild(el);
    window.setTimeout(() => {
      el.classList.add('is-out');
      window.setTimeout(() => el.remove(), 220);
    }, 1150);
  }

  private handleFinish(
    partial: Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'>
  ): void {
    if (this.finished || this.destroyed) return;
    this.finished = true;
    this.runner?.setPaused(true);
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    const fullMetrics: RunMetrics = {
      ...partial,
      score: Math.max(partial.score, this.hudState.score),
      modeId: this.modeId,
      difficulty: this.difficulty,
      peakIntensity: this.peakIntensity,
      durationSec: Math.max(1, Math.round(this.totalActiveTime)),
    };

    const summary = profileStore.recordRun(fullMetrics);
    const desc = GAME_CATALOG[this.modeId];
    const diffMeta = DIFFICULTY_META[this.difficulty];

    const deltaHtml = (Object.entries(summary.ratingDeltas) as [SkillAxis, number][])
      .map(([axis, delta]) => {
        const meta = AXIS_META[axis];
        const sign = delta >= 0 ? `+${delta}` : String(delta);
        const cls = delta >= 0 ? 'is-up' : 'is-down';
        return `
          <div class="oa-delta-pill">
            <span class="oa-delta-axis" style="color:${meta.accent}">${meta.short}</span>
            <span class="oa-delta-val">${profileStore.get().ratings[axis]}</span>
            <span class="oa-delta-diff ${cls}">${sign}</span>
          </div>
        `;
      })
      .join('');

    const tipsHtml = summary.coachingTips.map((t) => `<li>${t}</li>`).join('');

    this.debriefEl.innerHTML = `
      <div class="oa-modal oa-debrief-modal">
        <div class="oa-debrief-head">
          <div>
            <h2 class="oa-debrief-title">${desc.title}</h2>
            <p class="oa-debrief-sub">${fullMetrics.survived ? 'SESIÓN COMPLETADA' : 'ESCUDOS AGOTADOS'} · ${fullMetrics.durationSec}s · ${diffMeta.label} (${this.peakIntensity.toFixed(2)}×)</p>
          </div>
          <div class="oa-rank-stamp">${summary.runRank}</div>
        </div>

        <div class="oa-debrief-stats">
          <div class="oa-stat-box">
            <span>PUNTUACIÓN</span>
            <strong>${fullMetrics.score.toLocaleString('es-ES')}${summary.isNewBest ? ' <em>RÉCORD</em>' : ''}</strong>
          </div>
          <div class="oa-stat-box">
            <span>COMBO MÁX</span>
            <strong>${fullMetrics.maxCombo}</strong>
          </div>
          <div class="oa-stat-box">
            <span>XP GANADA</span>
            <strong>+${summary.xpEarned}${summary.leveledUp ? ' · NIVEL SUBIDO' : ''}</strong>
          </div>
          ${
            typeof fullMetrics.accuracy === 'number'
              ? `<div class="oa-stat-box"><span>PRECISIÓN</span><strong>${Math.round(fullMetrics.accuracy)}%</strong></div>`
              : ''
          }
        </div>

        <div class="oa-debrief-deltas">${deltaHtml}</div>

        <div class="oa-coaching-box">
          <h3>ANÁLISIS DE ENTRENAMIENTO</h3>
          <ul>${tipsHtml}</ul>
        </div>

        <div class="oa-modal-actions">
          <button type="button" class="oa-btn oa-btn-primary" id="oa-debrief-retry">${Icons.refresh(16)}<span>JUGAR DE NUEVO</span></button>
          <button type="button" class="oa-btn" id="oa-debrief-hub">${Icons.arrowLeft(16)}<span>VOLVER AL HUB</span></button>
        </div>
      </div>
    `;

    this.debriefEl.classList.remove('is-hidden');

    this.debriefEl.querySelector('#oa-debrief-retry')!.addEventListener('click', () => {
      synthAudio.uiClick();
      const m = this.modeId;
      this.destroy();
      this.callbacks.onReplay(m);
    });
    this.debriefEl.querySelector('#oa-debrief-hub')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.destroy();
      this.callbacks.onExitToHub();
    });
  }

  public destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.onGlobalKey);
    window.removeEventListener('resize', this.onResize);
    this.runner?.destroy();
    this.runner = null;
    this.shellEl.remove();
  }
}
