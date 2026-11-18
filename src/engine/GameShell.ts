import { AXIS_META, DIFFICULTY_META, GAME_CATALOG } from '../catalog';
import { synthAudio } from '../audio/SynthAudio';
import { createMiniGame, GauntletOrchestrator } from '../games/GauntletOrchestrator';
import { Icons } from '../icons';
import { computeOverallRating, profileStore } from '../state/ProfileStore';
import {
  ControlHint,
  DifficultyId,
  GameContext,
  GameModeId,
  HudState,
  MiniGame,
  RunMetrics,
  SkillAxis,
  StandaloneGameId,
} from '../types';
import { GuideOverlay, renderControlHintRow } from '../ui/GuideOverlay';
import { detectTouchPrimary } from '../utils/input';

export interface GameShellCallbacks {
  onExitToHub: () => void;
  onReplay: (modeId: GameModeId, practiceMode?: boolean) => void;
}

export interface GameShellStartOptions {
  practiceMode?: boolean;
}

export class GameShell {
  private root: HTMLElement;
  private modeId: GameModeId;
  private callbacks: GameShellCallbacks;

  private shellEl!: HTMLDivElement;
  private stageHostEl!: HTMLDivElement;
  private controlsBarEl!: HTMLElement;
  private hudEls!: {
    bar: HTMLDivElement;
    dim: HTMLSpanElement;
    phase: HTMLSpanElement;
    sub: HTMLSpanElement;
    score: HTMLSpanElement;
    combo: HTMLSpanElement;
    comboWrap: HTMLDivElement;
    timer: HTMLSpanElement;
    intensity: HTMLSpanElement;
    shields: HTMLDivElement;
    muteBtn: HTMLButtonElement;
  };
  private toastHostEl!: HTMLDivElement;
  private pauseOverlayEl!: HTMLDivElement;
  private debriefEl!: HTMLDivElement;

  private runner: MiniGame | GauntletOrchestrator | null = null;
  private guideOverlay: GuideOverlay | null = null;
  private rafId = 0;
  private lastFrameMs = 0;
  private runStartedAt = 0;
  private totalActiveTime = 0;

  private difficulty: DifficultyId = 'adaptive';
  private liveIntensity = 1.0;
  private peakIntensity = 1.0;
  private isTouch = false;
  private practiceMode = false;
  private isAcademy = false;

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

  public start(options?: GameShellStartOptions): void {
    const desc = GAME_CATALOG[this.modeId];
    const profile = profileStore.get();
    this.isAcademy = desc.category === 'academy';
    this.practiceMode = desc.category === 'circuit' ? false : Boolean(options?.practiceMode);
    this.difficulty = profile.settings.difficulty ?? 'adaptive';
    this.liveIntensity = this.computeStartIntensity(this.difficulty);
    this.peakIntensity = this.liveIntensity;

    document.documentElement.setAttribute(
      'data-motion',
      profile.settings.reduceMotion ? 'reduced' : 'normal'
    );

    this.isTouch = detectTouchPrimary(profile.settings.touchControls);

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
      subStat: this.isTouch ? desc.controlsTouch : desc.controlsPC,
      intensity: this.liveIntensity,
    };

    const hideArcadeStats = this.isAcademy;

    this.shellEl = document.createElement('div');
    this.shellEl.className = 'oa-arena-shell';
    this.shellEl.innerHTML = `
      <header class="oa-hud">
        <div class="oa-hud-left">
          <button type="button" class="oa-hud-btn" id="oa-btn-back" title="Salir o pausar">${Icons.arrowLeft(16)}<span>Salir</span></button>
          <span class="oa-dim-pill" id="oa-hud-dim">2D</span>
          <div class="oa-hud-titles">
            <span class="oa-hud-phase" id="oa-hud-phase">${desc.title}</span>
            <span class="oa-hud-sub" id="oa-hud-sub"></span>
          </div>
          ${this.practiceMode ? '<span class="oa-practice-badge">PRÁCTICA</span>' : ''}
        </div>
        <div class="oa-hud-center">
          <div class="oa-hud-shields ${hideArcadeStats ? 'is-hidden' : ''}" id="oa-hud-shields"></div>
          <span class="oa-hud-timer" id="oa-hud-timer">--:--</span>
          <span class="oa-intensity-pill ${hideArcadeStats ? 'is-hidden' : ''}" id="oa-hud-intensity" title="Intensidad / Dificultad en vivo">1.00×</span>
        </div>
        <div class="oa-hud-right">
          <div class="oa-hud-stat ${hideArcadeStats ? 'is-hidden' : ''}" id="oa-hud-combo-wrap">
            <span class="oa-stat-label">COMBO</span>
            <span class="oa-hud-combo" id="oa-hud-combo">x1</span>
          </div>
          <div class="oa-hud-stat">
            <span class="oa-stat-label">PUNTOS</span>
            <span class="oa-hud-score" id="oa-hud-score">0</span>
          </div>
          ${
            this.practiceMode
              ? `<button type="button" class="oa-hud-btn oa-hud-btn-accent" id="oa-btn-end-practice" title="Terminar práctica y ver resumen">${Icons.check(15)}<span>Terminar práctica</span></button>`
              : ''
          }
          <button type="button" class="oa-hud-btn" id="oa-btn-guide" title="Abrir guía (?)">${Icons.help(16)}<span>Guía</span></button>
          <button type="button" class="oa-hud-btn" id="oa-btn-mute" aria-pressed="${
            profile.settings.muted ? 'true' : 'false'
          }" title="Audio">${profile.settings.muted ? Icons.volumeOff(16) : Icons.volumeOn(16)}<span>${
            profile.settings.muted ? 'Audio: No' : 'Audio: Sí'
          }</span></button>
          <button type="button" class="oa-hud-btn" id="oa-btn-pause" title="Pausa (ESC)">${Icons.pause(16)}<span>Pausa</span></button>
        </div>
      </header>
      <main class="oa-stage-host" id="oa-stage-host"></main>
      <footer class="oa-controls-bar" id="oa-controls-bar" aria-label="Controles activos"></footer>
      <div class="oa-toast-host" id="oa-toast-host"></div>
      <div class="oa-overlay is-hidden" id="oa-pause-overlay">
        <div class="oa-modal" role="dialog" aria-modal="true" aria-label="Partida en pausa">
          <h2>${this.practiceMode ? 'PRÁCTICA EN PAUSA' : 'PARTIDA EN PAUSA'}</h2>
          <p class="oa-modal-ctrl">${this.isTouch ? desc.controlsTouch : desc.controlsPC}</p>
          <div class="oa-modal-actions">
            <button type="button" class="oa-btn oa-btn-primary" id="oa-resume-btn">${Icons.play(16)}<span>CONTINUAR</span></button>
            <button type="button" class="oa-btn" id="oa-pause-guide-btn">${Icons.help(16)}<span>VER GUÍA</span></button>
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
    this.controlsBarEl = this.shellEl.querySelector('#oa-controls-bar')!;
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
      comboWrap: this.shellEl.querySelector('#oa-hud-combo-wrap')!,
      timer: this.shellEl.querySelector('#oa-hud-timer')!,
      intensity: this.shellEl.querySelector('#oa-hud-intensity')!,
      shields: this.shellEl.querySelector('#oa-hud-shields')!,
      muteBtn: this.shellEl.querySelector('#oa-btn-mute')!,
    };

    this.renderControlsBar(desc.guide.controls);
    this.bindShellEvents();
    this.renderHud();

    const ctx: GameContext = {
      container: this.stageHostEl,
      isTouch: this.isTouch,
      practiceMode: this.practiceMode,
      settings: profile.settings,
      difficulty: this.difficulty,
      getIntensity: () => this.liveIntensity,
      setHud: (patch) => {
        Object.assign(this.hudState, patch);
        this.renderHud();
      },
      setControls: (controls) => {
        this.renderControlsBar(controls);
      },
      onOpenGuide: () => {
        this.openInGameGuide();
      },
      damage: (amount = 1) => {
        if (this.practiceMode) {
          this.showToast('Error · en práctica no pierdes escudos', 'warn');
          return this.hudState.shields;
        }
        this.hudState.shields = Math.max(0, this.hudState.shields - amount);
        if (this.difficulty === 'adaptive') {
          this.liveIntensity = Math.max(0.72, Number((this.liveIntensity - 0.14).toFixed(2)));
          this.hudState.intensity = this.liveIntensity;
        }
        this.renderHud();
        const currSettings = profileStore.get().settings;
        if (currSettings.screenShake && !currSettings.reduceMotion) {
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

  private renderControlsBar(controls: ControlHint[]): void {
    const items = controls.map((c) => renderControlHintRow(c, this.isTouch)).join('');
    this.controlsBarEl.innerHTML = `<div class="oa-controls-track">${items}</div>`;
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
    this.shellEl.querySelector('#oa-btn-guide')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.openInGameGuide();
    });
    this.shellEl.querySelector('#oa-pause-guide-btn')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.pauseOverlayEl.classList.add('is-hidden');
      this.openInGameGuide();
    });
    this.shellEl.querySelector('#oa-btn-end-practice')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.showPracticeSummary();
    });

    this.hudEls.muteBtn.addEventListener('click', () => {
      const s = profileStore.get().settings;
      const next = !s.muted;
      profileStore.updateSettings({ muted: next });
      synthAudio.setConfig(s.volume, next);
      this.hudEls.muteBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
      this.hudEls.muteBtn.innerHTML = `${next ? Icons.volumeOff(16) : Icons.volumeOn(16)}<span>${
        next ? 'Audio: No' : 'Audio: Sí'
      }</span>`;
    });

    this.shellEl.querySelector('#oa-resume-btn')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.togglePause(false);
    });
    this.shellEl.querySelector('#oa-retry-btn')!.addEventListener('click', () => {
      synthAudio.uiClick();
      const m = this.modeId;
      const p = this.practiceMode;
      this.destroy();
      this.callbacks.onReplay(m, p);
    });
    this.shellEl.querySelector('#oa-quit-btn')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.destroy();
      this.callbacks.onExitToHub();
    });

    window.addEventListener('keydown', this.onGlobalKey);
    window.addEventListener('resize', this.onResize);
  }

  private openInGameGuide(): void {
    if (this.finished || this.destroyed) return;
    if (!this.paused) {
      this.paused = true;
      this.runner?.setPaused(true);
    }
    synthAudio.stopAllNotes();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.pauseOverlayEl.classList.add('is-hidden');

    this.guideOverlay?.close(true);
    this.guideOverlay = new GuideOverlay(this.shellEl, this.modeId, {
      context: 'ingame',
      practiceMode: this.practiceMode,
      onResume: () => {
        this.guideOverlay = null;
        this.paused = false;
        this.runner?.setPaused(false);
        this.lastFrameMs = performance.now();
      },
      onRestart: (nextPractice) => {
        this.guideOverlay = null;
        const m = this.modeId;
        this.destroy();
        this.callbacks.onReplay(m, nextPractice);
      },
    });
    this.guideOverlay.open();
  }

  private onGlobalKey = (e: KeyboardEvent): void => {
    if (this.guideOverlay || this.finished) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.togglePause();
      return;
    }
    if (e.key === '?') {
      e.preventDefault();
      e.stopPropagation();
      this.openInGameGuide();
    }
  };

  private onResize = (): void => {
    this.runner?.onResize();
  };

  private togglePause(force?: boolean): void {
    if (this.finished) return;
    this.paused = force !== undefined ? force : !this.paused;
    this.runner?.setPaused(this.paused);
    if (this.paused) {
      synthAudio.stopAllNotes();
    }
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

  private showPracticeCompletedPrompt(): void {
    this.paused = true;
    this.runner?.setPaused(true);
    synthAudio.stopAllNotes();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    const desc = GAME_CATALOG[this.modeId];
    this.debriefEl.innerHTML = `
      <div class="oa-modal oa-debrief-modal" role="dialog" aria-modal="true" aria-label="Práctica completada">
        <div class="oa-debrief-head">
          <div>
            <h2 class="oa-debrief-title">PRÁCTICA COMPLETADA</h2>
            <p class="oa-debrief-sub">${desc.title} · Puntuación de práctica: ${this.hudState.score.toLocaleString('es-ES')}</p>
          </div>
          <div class="oa-rank-stamp">PRÁCTICA</div>
        </div>
        <p class="oa-modal-ctrl">En Práctica Guiada puedes repetir sin riesgo o pasar al Modo Reto para puntuar en tu radar.</p>
        <div class="oa-modal-actions">
          <button type="button" class="oa-btn oa-btn-primary" id="oa-prac-continue">${Icons.refresh(16)}<span>Seguir practicando</span></button>
          <button type="button" class="oa-btn" id="oa-prac-summary">${Icons.check(16)}<span>Terminar y ver resumen</span></button>
        </div>
      </div>
    `;
    this.debriefEl.classList.remove('is-hidden');

    this.debriefEl.querySelector('#oa-prac-continue')!.addEventListener('click', () => {
      synthAudio.uiClick();
      const m = this.modeId;
      this.destroy();
      this.callbacks.onReplay(m, true);
    });
    this.debriefEl.querySelector('#oa-prac-summary')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.showPracticeSummary();
    });
  }

  private showPracticeSummary(): void {
    if (this.finished || this.destroyed) return;
    this.finished = true;
    this.paused = true;
    this.runner?.setPaused(true);
    synthAudio.stopAllNotes();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    const durationSec = Math.max(1, Math.round(this.totalActiveTime));
    const { xpEarned, leveledUp } = profileStore.recordPracticeRun(durationSec);
    const desc = GAME_CATALOG[this.modeId];

    this.debriefEl.innerHTML = `
      <div class="oa-modal oa-debrief-modal" role="dialog" aria-modal="true" aria-label="Resumen de práctica">
        <div class="oa-debrief-head">
          <div>
            <h2 class="oa-debrief-title">${desc.title}</h2>
            <p class="oa-debrief-sub">RESUMEN DE PRÁCTICA GUIADA · ${durationSec}s</p>
          </div>
          <div class="oa-rank-stamp">PRÁCTICA</div>
        </div>

        <div class="oa-debrief-stats">
          <div class="oa-stat-box">
            <span>PUNTOS (PRÁCTICA)</span>
            <strong>${this.hudState.score.toLocaleString('es-ES')}</strong>
          </div>
          <div class="oa-stat-box">
            <span>DURACIÓN</span>
            <strong>${durationSec}s</strong>
          </div>
          <div class="oa-stat-box">
            <span>XP DE PRÁCTICA</span>
            <strong>+${xpEarned}${leveledUp ? ' · NIVEL SUBIDO' : ''}</strong>
          </div>
        </div>

        <div class="oa-coaching-box">
          <h3>SIGUIENTE PASO</h3>
          <ul>
            <li>La práctica no modifica tus récords, radar ni reto diario.</li>
            <li>Cuando domines el patrón, prueba el Modo Reto Oficial.</li>
          </ul>
        </div>

        <div class="oa-modal-actions">
          <button type="button" class="oa-btn oa-btn-primary" id="oa-prac-challenge">${Icons.play(16)}<span>Probar MODO RETO</span></button>
          <button type="button" class="oa-btn" id="oa-prac-again">${Icons.refresh(16)}<span>Seguir practicando</span></button>
          <button type="button" class="oa-btn oa-btn-ghost" id="oa-prac-hub">${Icons.arrowLeft(16)}<span>VOLVER AL HUB</span></button>
        </div>
      </div>
    `;
    this.debriefEl.classList.remove('is-hidden');

    this.debriefEl.querySelector('#oa-prac-challenge')!.addEventListener('click', () => {
      synthAudio.uiClick();
      const m = this.modeId;
      this.destroy();
      this.callbacks.onReplay(m, false);
    });
    this.debriefEl.querySelector('#oa-prac-again')!.addEventListener('click', () => {
      synthAudio.uiClick();
      const m = this.modeId;
      this.destroy();
      this.callbacks.onReplay(m, true);
    });
    this.debriefEl.querySelector('#oa-prac-hub')!.addEventListener('click', () => {
      synthAudio.uiClick();
      this.destroy();
      this.callbacks.onExitToHub();
    });
  }

  private handleFinish(
    partial: Omit<RunMetrics, 'modeId' | 'durationSec' | 'difficulty' | 'peakIntensity'>
  ): void {
    if (this.finished || this.destroyed) return;
    if (this.practiceMode) {
      this.showPracticeCompletedPrompt();
      return;
    }

    this.finished = true;
    this.runner?.setPaused(true);
    synthAudio.stopAllNotes();
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
      <div class="oa-modal oa-debrief-modal" role="dialog" aria-modal="true" aria-label="Resumen de partida">
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
      this.callbacks.onReplay(m, false);
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
    this.guideOverlay?.close(true);
    this.guideOverlay = null;
    synthAudio.stopAllNotes();
    this.runner?.destroy();
    this.runner = null;
    this.shellEl.remove();
  }
}
