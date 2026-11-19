import { synthAudio } from '../audio/SynthAudio';
import { DIFFICULTY_META, GAME_CATALOG } from '../catalog';
import { Icons } from '../icons';
import { profileStore } from '../state/ProfileStore';
import { ControlHint, DifficultyId, GameModeId } from '../types';
import { detectTouchPrimary } from '../utils/input';

const GUIDE_DIFFICULTIES: DifficultyId[] = [
  'chill',
  'standard',
  'hyper',
  'adaptive',
  'progressive',
];

export function getModeIconSvg(id: GameModeId, size = 22): string {
  switch (id) {
    case 'aim3d':
      return Icons.crosshair(size);
    case 'runner3d':
      return Icons.cube3d(size);
    case 'cube3d':
      return Icons.paddle3d(size);
    case 'parkour3d':
      return Icons.parkour(size);
    case 'rhythm2d':
      return Icons.music(size);
    case 'parry2d':
      return Icons.parry(size);
    case 'bullet2d':
      return Icons.bolt(size);
    case 'puzzle2d':
      return Icons.puzzle(size);
    case 'tetris2d':
      return Icons.blocks(size);
    case 'twinstick2d':
      return Icons.twinStick(size);
    case 'flight3d':
      return Icons.plane3d(size);
    case 'memory2d':
      return Icons.gridMem(size);
    case 'snake2d':
      return Icons.snake(size);
    case 'sniper2d':
      return Icons.target2d(size);
    case 'track2d':
      return Icons.laserTrack(size);
    case 'schulte2d':
      return Icons.schulte(size);
    case 'nback2d':
      return Icons.brainNBack(size);
    case 'pulse2d':
      return Icons.sonicRing(size);
    case 'chess2d':
      return Icons.chess(size);
    case 'checkers2d':
      return Icons.checkers(size);
    case 'poker2d':
      return Icons.cards(size);
    case 'rubik3d':
      return Icons.rubik(size);
    case 'piano2d':
      return Icons.piano(size);
    case 'drums2d':
      return Icons.drums(size);
    case 'strings2d':
      return Icons.guitar(size);
    case 'band2d':
      return Icons.band(size);
    case 'raven2d':
      return Icons.matrix(size);
    case 'sudoku2d':
      return Icons.sudoku(size);
    case 'hanoi2d':
      return Icons.hanoi(size);
    case 'spatial3d':
      return Icons.spatial3d(size);
    case 'nonogram2d':
      return Icons.nonogram(size);
    case 'logicseq2d':
      return Icons.logicseq(size);
    case 'memorypath2d':
      return Icons.memorypath(size);
    default:
      return Icons.omni(size);
  }
}

export function renderControlHintRow(hint: ControlHint, isTouch: boolean): string {
  const toneClass =
    hint.tone === 'primary'
      ? 'oa-hint-primary'
      : hint.tone === 'danger'
      ? 'oa-hint-danger'
      : 'oa-hint-default';

  const keysMarkup = isTouch
    ? `<span class="oa-hint-touch">${hint.touch}</span>`
    : `<span class="oa-hint-keys">${hint.keys.map((k) => `<kbd>${k}</kbd>`).join(' ')}</span>`;

  return `<div class="oa-hint-row ${toneClass}">${keysMarkup}<span class="oa-hint-action">${hint.action}</span></div>`;
}

export interface GuideOverlayLaunchCallbacks {
  context: 'hub';
  onStart: (modeId: GameModeId, practiceMode: boolean, infiniteMode?: boolean) => void;
  onClose?: () => void;
}

export interface GuideOverlayInGameCallbacks {
  context: 'ingame';
  practiceMode: boolean;
  infiniteMode?: boolean;
  onResume: () => void;
  onRestart: (practiceMode: boolean, infiniteMode?: boolean) => void;
}

export type GuideOverlayOptions = GuideOverlayLaunchCallbacks | GuideOverlayInGameCallbacks;

export class GuideOverlay {
  private host: HTMLElement;
  private modeId: GameModeId;
  private options: GuideOverlayOptions;
  private overlayEl: HTMLDivElement | null = null;
  private frameIdx = 0;
  private autoTimer = 0;
  private userInteracted = false;
  private prevFocus: HTMLElement | null = null;
  private selectedInfinite = false;

  constructor(host: HTMLElement, modeId: GameModeId, options: GuideOverlayOptions) {
    this.host = host;
    this.modeId = modeId;
    this.options = options;
  }

  public open(): void {
    this.close(true);
    this.prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const desc = GAME_CATALOG[this.modeId];
    const profile = profileStore.get();
    const isTouch = detectTouchPrimary(profile.settings.touchControls);
    const reduceMotion = Boolean(profile.settings.reduceMotion);
    const isCircuit = desc.category === 'circuit';
    const supportsInfinite = Boolean(desc.supportsInfinite) && !isCircuit;
    const frames = desc.guide.example.frames;
    const skipChecked = Boolean(profile.settings.skipGuideFor?.[this.modeId]);
    const currentDiff = profile.settings.difficulty ?? 'adaptive';
    const diffMeta = DIFFICULTY_META[currentDiff];

    if (this.options.context === 'ingame') {
      this.selectedInfinite = Boolean(this.options.infiniteMode && supportsInfinite);
    } else {
      this.selectedInfinite = Boolean(profile.settings.infiniteModeDefault && supportsInfinite);
    }

    const diffButtonsHtml = GUIDE_DIFFICULTIES.map((dId) => {
      const m = DIFFICULTY_META[dId];
      const active = dId === currentDiff;
      return `<button type="button" class="oa-guide-diff-btn ${active ? 'is-active' : ''}" data-guide-diff="${dId}" style="--diff-accent:${m.accent}">
        <span>${m.label}</span>
        <em>${m.short}</em>
      </button>`;
    }).join('');

    const el = document.createElement('div');
    el.className = 'oa-overlay oa-guide-overlay';
    el.innerHTML = `
      <div class="oa-modal oa-guide-modal" role="dialog" aria-modal="true" aria-labelledby="oa-guide-title" style="--guide-accent:${desc.accent}; --guide-soft:${desc.accentSoft}">
        <div class="oa-guide-head">
          <div class="oa-guide-title-wrap">
            <div class="oa-diamond-badge" style="--em-accent:${desc.accent}">
              <span class="oa-diamond-ring"></span>
              <span class="oa-diamond-core">${getModeIconSvg(this.modeId, 20)}</span>
            </div>
            <div>
              <h2 id="oa-guide-title">${desc.title}</h2>
              <p class="oa-guide-subtitle">${desc.subtitle} · ${desc.dimension}</p>
            </div>
          </div>
          <button type="button" class="oa-btn oa-btn-ghost oa-guide-close" id="oa-guide-close">
            ${Icons.closeX(16)}<span>Cerrar</span>
          </button>
        </div>

        <p class="oa-guide-objective"><strong>Objetivo:</strong> ${desc.guide.objective}</p>

        <div class="oa-guide-columns">
          <section class="oa-guide-box" aria-label="Ejemplo visual">
            <div class="oa-guide-box-head">
              <h3>Ejemplo</h3>
              <span class="oa-guide-counter" id="oa-guide-counter">1/${frames.length}</span>
            </div>
            <div class="oa-guide-frame-stage" id="oa-guide-frame-stage"></div>
            <p class="oa-guide-caption" id="oa-guide-caption"></p>
            ${
              frames.length > 1
                ? `<div class="oa-guide-frame-nav">
                    <button type="button" class="oa-btn oa-btn-sm" id="oa-guide-prev">${Icons.arrowLeft(14)}<span>Anterior</span></button>
                    <button type="button" class="oa-btn oa-btn-sm" id="oa-guide-next"><span>Siguiente</span>${Icons.arrowRight(14)}</button>
                  </div>`
                : ''
            }
          </section>

          <section class="oa-guide-box" aria-label="Botones y teclas">
            <div class="oa-guide-box-head">
              <h3>Botones y teclas</h3>
            </div>
            <div class="oa-guide-hints">
              ${desc.guide.controls.map((c) => renderControlHintRow(c, isTouch)).join('')}
            </div>
          </section>
        </div>

        <section class="oa-guide-steps" aria-label="Cómo se juega">
          <h3>Cómo se juega</h3>
          <ol>
            ${desc.guide.howToPlay.map((step) => `<li>${step}</li>`).join('')}
          </ol>
        </section>

        ${
          !isCircuit
            ? `<section class="oa-guide-config" aria-label="Dificultad y modo de sesión">
                <div class="oa-guide-diff-row">
                  <div class="oa-guide-diff-head">
                    <span class="oa-guide-config-title">${Icons.sliders(15)}<span>Cambiar dificultad</span></span>
                    <span class="oa-guide-diff-desc" id="oa-guide-diff-desc">${diffMeta.desc}</span>
                  </div>
                  <div class="oa-guide-diff-pills" id="oa-guide-diff-pills">
                    ${diffButtonsHtml}
                  </div>
                </div>
                ${
                  supportsInfinite
                    ? `<label class="oa-guide-infinite-toggle" id="oa-guide-inf-wrap">
                        <div class="oa-guide-inf-left">
                          <input type="checkbox" id="oa-guide-infinite-check" ${this.selectedInfinite ? 'checked' : ''} />
                          <span class="oa-guide-inf-title">${Icons.infinity(16)}<span>Modo Infinito (sin límite de tiempo)</span></span>
                        </div>
                        <span class="oa-guide-inf-desc">Juega rondas continuas cada vez más exigentes hasta agotar escudos o pulsar Finalizar y puntuar.</span>
                      </label>`
                    : ''
                }
              </section>`
            : ''
        }

        ${
          this.options.context === 'hub'
            ? `<div class="oa-guide-actions">
                ${
                  isCircuit
                    ? `<button type="button" class="oa-btn oa-btn-primary oa-guide-cta" id="oa-guide-challenge">
                        ${Icons.play(16)}<span>${this.modeId === 'ranked' ? 'EMPEZAR CLASIFICATORIA' : 'EMPEZAR CIRCUITO'}</span>
                      </button>`
                    : `<button type="button" class="oa-btn oa-guide-cta oa-guide-practice-btn" id="oa-guide-practice">
                        ${Icons.bookOpen(16)}<span>Empezar práctica (sin perder vidas)</span>
                      </button>
                      <button type="button" class="oa-btn oa-btn-primary oa-guide-cta" id="oa-guide-challenge">
                        ${Icons.play(16)}<span id="oa-guide-challenge-label">${
                          this.selectedInfinite ? 'Empezar reto infinito' : 'Empezar reto (Oficial)'
                        }</span>
                      </button>`
                }
              </div>
              ${
                !isCircuit
                  ? `<p class="oa-guide-compare"><strong>Práctica:</strong> ${desc.guide.practice} · <strong>Reto:</strong> ${desc.guide.challenge}</p>
                     <label class="oa-guide-skip">
                       <input type="checkbox" id="oa-guide-skip-check" ${skipChecked ? 'checked' : ''} />
                       <span>Entrar directo la próxima vez (en Modo Reto)</span>
                     </label>`
                  : ''
              }`
            : `<div class="oa-guide-actions">
                <button type="button" class="oa-btn oa-btn-primary oa-guide-cta" id="oa-guide-resume">
                  ${Icons.play(16)}<span>Volver a la partida</span>
                </button>
                ${
                  isCircuit
                    ? `<button type="button" class="oa-btn oa-guide-cta" id="oa-guide-restart-challenge">
                        ${Icons.refresh(16)}<span>Reiniciar circuito</span>
                      </button>`
                    : `<button type="button" class="oa-btn oa-guide-cta" id="oa-guide-restart-practice">
                        ${Icons.bookOpen(16)}<span>Reiniciar en Práctica</span>
                      </button>
                      <button type="button" class="oa-btn oa-guide-cta" id="oa-guide-restart-challenge">
                        ${Icons.refresh(16)}<span id="oa-guide-restart-label">${
                          this.selectedInfinite ? 'Reiniciar en Reto Infinito' : 'Reiniciar en Reto'
                        }</span>
                      </button>`
                }
              </div>`
        }
      </div>
    `;

    this.overlayEl = el;
    this.host.appendChild(el);
    this.renderFrame();

    if (!reduceMotion && frames.length > 1) {
      this.autoTimer = window.setInterval(() => {
        if (this.userInteracted) return;
        this.frameIdx = (this.frameIdx + 1) % frames.length;
        this.renderFrame();
      }, 3500);
    }

    this.bindEvents();

    const firstFocus =
      el.querySelector<HTMLElement>('#oa-guide-practice') ??
      el.querySelector<HTMLElement>('#oa-guide-resume') ??
      el.querySelector<HTMLElement>('#oa-guide-challenge');
    firstFocus?.focus();
  }

  private renderFrame(): void {
    if (!this.overlayEl) return;
    const frames = GAME_CATALOG[this.modeId].guide.example.frames;
    const frame = frames[this.frameIdx] ?? frames[0];
    const stage = this.overlayEl.querySelector('#oa-guide-frame-stage');
    const caption = this.overlayEl.querySelector('#oa-guide-caption');
    const counter = this.overlayEl.querySelector('#oa-guide-counter');
    if (stage && frame) stage.innerHTML = frame.svg;
    if (caption && frame) caption.textContent = frame.caption;
    if (counter) counter.textContent = `${this.frameIdx + 1}/${frames.length}`;
  }

  private stopAuto(): void {
    this.userInteracted = true;
    if (this.autoTimer) {
      window.clearInterval(this.autoTimer);
      this.autoTimer = 0;
    }
  }

  private saveSkipPreference(): void {
    if (!this.overlayEl) return;
    const cb = this.overlayEl.querySelector<HTMLInputElement>('#oa-guide-skip-check');
    if (cb) {
      profileStore.setSkipGuide(this.modeId, cb.checked);
    }
  }

  private bindEvents(): void {
    if (!this.overlayEl) return;
    const el = this.overlayEl;
    const frames = GAME_CATALOG[this.modeId].guide.example.frames;

    el.querySelector('#oa-guide-close')?.addEventListener('click', () => {
      synthAudio.uiClick();
      this.handleCancel();
    });

    el.addEventListener('click', (e) => {
      if (e.target === el) {
        this.handleCancel();
      }
    });

    el.querySelector('#oa-guide-prev')?.addEventListener('click', () => {
      this.stopAuto();
      synthAudio.uiClick();
      this.frameIdx = (this.frameIdx - 1 + frames.length) % frames.length;
      this.renderFrame();
    });

    el.querySelector('#oa-guide-next')?.addEventListener('click', () => {
      this.stopAuto();
      synthAudio.uiClick();
      this.frameIdx = (this.frameIdx + 1) % frames.length;
      this.renderFrame();
    });

    el.querySelectorAll<HTMLButtonElement>('[data-guide-diff]').forEach((btn) => {
      btn.addEventListener('click', () => {
        synthAudio.uiClick();
        const nextDiff = btn.dataset.guideDiff as DifficultyId;
        profileStore.updateSettings({ difficulty: nextDiff });
        el.querySelectorAll<HTMLButtonElement>('[data-guide-diff]').forEach((b) => {
          b.classList.toggle('is-active', b.dataset.guideDiff === nextDiff);
        });
        const descEl = el.querySelector('#oa-guide-diff-desc');
        if (descEl) {
          descEl.textContent = DIFFICULTY_META[nextDiff].desc;
        }
      });
    });

    const infCheck = el.querySelector<HTMLInputElement>('#oa-guide-infinite-check');
    infCheck?.addEventListener('change', () => {
      synthAudio.uiClick();
      this.selectedInfinite = infCheck.checked;
      profileStore.updateSettings({ infiniteModeDefault: this.selectedInfinite });
      const challengeLbl = el.querySelector('#oa-guide-challenge-label');
      if (challengeLbl) {
        challengeLbl.textContent = this.selectedInfinite
          ? 'Empezar reto infinito'
          : 'Empezar reto (Oficial)';
      }
      const restartLbl = el.querySelector('#oa-guide-restart-label');
      if (restartLbl) {
        restartLbl.textContent = this.selectedInfinite
          ? 'Reiniciar en Reto Infinito'
          : 'Reiniciar en Reto';
      }
    });

    if (this.options.context === 'hub') {
      const opts = this.options;
      el.querySelector('#oa-guide-practice')?.addEventListener('click', () => {
        synthAudio.ensure();
        synthAudio.uiClick();
        this.saveSkipPreference();
        this.close(true);
        opts.onStart(this.modeId, true, false);
      });
      el.querySelector('#oa-guide-challenge')?.addEventListener('click', () => {
        synthAudio.ensure();
        synthAudio.uiClick();
        this.saveSkipPreference();
        const inf = this.selectedInfinite;
        this.close(true);
        opts.onStart(this.modeId, false, inf);
      });
    } else {
      const opts = this.options;
      el.querySelector('#oa-guide-resume')?.addEventListener('click', () => {
        synthAudio.uiClick();
        this.close(true);
        opts.onResume();
      });
      el.querySelector('#oa-guide-restart-practice')?.addEventListener('click', () => {
        synthAudio.uiClick();
        this.close(true);
        opts.onRestart(true, false);
      });
      el.querySelector('#oa-guide-restart-challenge')?.addEventListener('click', () => {
        synthAudio.uiClick();
        const inf = this.selectedInfinite;
        this.close(true);
        opts.onRestart(false, inf);
      });
    }

    window.addEventListener('keydown', this.onKeyDown, true);
  }

  private handleCancel(): void {
    const opts = this.options;
    this.close(false);
    if (opts.context === 'ingame') {
      opts.onResume();
    } else {
      opts.onClose?.();
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.overlayEl) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.handleCancel();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = Array.from(
        this.overlayEl.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (e.code === 'Enter' && this.options.context === 'hub') {
      const active = document.activeElement;
      const insideButtons =
        active &&
        this.overlayEl.contains(active) &&
        (active.tagName === 'BUTTON' || active.tagName === 'INPUT');
      if (!insideButtons) {
        e.preventDefault();
        e.stopPropagation();
        const isCircuit = GAME_CATALOG[this.modeId].category === 'circuit';
        this.saveSkipPreference();
        const opts = this.options;
        const inf = this.selectedInfinite;
        this.close(true);
        opts.onStart(this.modeId, !isCircuit, isCircuit ? false : inf);
      }
    }
  };

  public close(skipRestoreFocus = false): void {
    if (this.autoTimer) {
      window.clearInterval(this.autoTimer);
      this.autoTimer = 0;
    }
    window.removeEventListener('keydown', this.onKeyDown, true);
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
    if (!skipRestoreFocus && this.prevFocus && document.contains(this.prevFocus)) {
      this.prevFocus.focus();
    }
  }
}
