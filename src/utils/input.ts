export function detectTouchPrimary(setting: 'auto' | 'always' | 'off' = 'auto'): boolean {
  if (setting === 'always') return true;
  if (setting === 'off') return false;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const anyFine = window.matchMedia('(any-pointer: fine)').matches;
  const hoverNone = window.matchMedia('(hover: none)').matches;
  return coarse && (hoverNone || !anyFine);
}
