import { Icons } from '../../icons';
import { GameContext } from '../../types';

/**
 * Evita que los atajos de instrumento disparen notas cuando hay un modal abierto
 * (Guía, Pausa) o el foco está dentro de un input/select/textarea.
 */
export function shouldIgnoreGameHotkey(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return true;
  if (e.key === 'Escape' || e.key === '?') return true;
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
    return true;
  }
  const activeTag = document.activeElement?.tagName;
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
    return true;
  }
  if (document.querySelector('.oa-overlay, [role="dialog"][aria-modal="true"]')) {
    return true;
  }
  return false;
}

export interface ActionBtnOpts {
  label: string;
  iconHtml?: string;
  className?: string;
  pressed?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}

export function createActionButton(opts: ActionBtnOpts): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = opts.className ?? 'oa-rp-pill-btn';
  if (opts.pressed !== undefined) {
    btn.setAttribute('aria-pressed', opts.pressed ? 'true' : 'false');
    if (opts.pressed) btn.classList.add('is-active');
  }
  if (opts.disabled) btn.disabled = true;
  if (opts.title) btn.title = opts.title;

  if (opts.iconHtml) {
    const iconWrap = document.createElement('span');
    iconWrap.className = 'oa-mus-btn-icon';
    iconWrap.innerHTML = opts.iconHtml;
    const textSpan = document.createElement('span');
    textSpan.textContent = opts.label;
    btn.append(iconWrap, textSpan);
  } else {
    btn.textContent = opts.label;
  }

  btn.addEventListener('click', opts.onClick);
  return btn;
}

export function createBpmControl(opts: {
  bpm: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (nextBpm: number) => void;
}): HTMLElement {
  const min = opts.min ?? 60;
  const max = opts.max ?? 160;
  const step = opts.step ?? 5;
  let current = Math.max(min, Math.min(max, Math.round(opts.bpm)));

  const wrap = document.createElement('div');
  wrap.className = 'oa-mus-bpm-group';
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', 'Control de tempo en BPM');

  const minusBtn = createActionButton({
    label: `-${step}`,
    className: 'oa-rp-pill-btn oa-mus-bpm-step',
    disabled: opts.disabled,
    title: 'Bajar tempo',
    onClick: () => {
      current = Math.max(min, current - step);
      readout.textContent = `${current} BPM`;
      opts.onChange(current);
    },
  });

  const readout = document.createElement('span');
  readout.className = 'oa-mus-bpm-readout';
  readout.textContent = `${current} BPM`;

  const plusBtn = createActionButton({
    label: `+${step}`,
    className: 'oa-rp-pill-btn oa-mus-bpm-step',
    disabled: opts.disabled,
    title: 'Subir tempo',
    onClick: () => {
      current = Math.min(max, current + step);
      readout.textContent = `${current} BPM`;
      opts.onChange(current);
    },
  });

  wrap.append(minusBtn, readout, plusBtn);
  return wrap;
}

export interface MetronomeWidget {
  root: HTMLButtonElement;
  setActive: (enabled: boolean) => void;
  flashBeat: (accent: boolean) => void;
  clearPulse: () => void;
}

export function createMetronomeControl(opts: {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}): MetronomeWidget {
  let active = opts.enabled;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'oa-rp-pill-btn oa-mus-metro-btn';
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');

  const dot = document.createElement('span');
  dot.className = 'oa-mus-metro-dot';
  dot.setAttribute('aria-hidden', 'true');

  const icon = document.createElement('span');
  icon.className = 'oa-mus-btn-icon';
  icon.innerHTML = Icons.music(15);

  const label = document.createElement('span');
  label.textContent = 'Metrónomo';

  btn.append(dot, icon, label);
  btn.addEventListener('click', () => {
    active = !active;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (!active) dot.classList.remove('is-beat', 'is-accent');
    opts.onToggle(active);
  });

  let clearTimer: number | null = null;
  return {
    root: btn,
    setActive(enabled: boolean) {
      active = enabled;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (!active) dot.classList.remove('is-beat', 'is-accent');
    },
    flashBeat(accent: boolean) {
      if (clearTimer !== null) {
        window.clearTimeout(clearTimer);
        clearTimer = null;
      }
      dot.classList.remove('is-beat', 'is-accent');
      // Force reflow so rapid beats pulse cleanly
      void dot.offsetWidth;
      dot.classList.add(accent ? 'is-accent' : 'is-beat');
      clearTimer = window.setTimeout(() => {
        dot.classList.remove('is-beat', 'is-accent');
        clearTimer = null;
      }, 140);
    },
    clearPulse() {
      if (clearTimer !== null) {
        window.clearTimeout(clearTimer);
        clearTimer = null;
      }
      dot.classList.remove('is-beat', 'is-accent');
    },
  };
}

export function renderMusicStatsCard(
  target: HTMLElement,
  ctx: GameContext,
  stats: { hits: number; misses: number; maxCombo: number; extraLine?: string; subStatPrefix?: string }
): void {
  const total = stats.hits + stats.misses;
  const acc = total > 0 ? Math.round((stats.hits / total) * 100) : 100;
  target.innerHTML = `
    <div class="oa-explain-heading">Registro de sesión</div>
    <p class="oa-explain-body">Aciertos: <strong>${stats.hits}</strong> · Fallos: <strong>${stats.misses}</strong> · Precisión: <strong>${acc}%</strong></p>
    <p class="oa-explain-body">Racha máxima: <strong>${stats.maxCombo}</strong>${stats.extraLine ? ` · ${stats.extraLine}` : ''}</p>
  `;
  const prefix = stats.subStatPrefix ? `${stats.subStatPrefix} · ` : '';
  ctx.setHud({
    subStat: `${prefix}${acc}% precisión · ${stats.hits} aciertos`,
  });
}
