export function resolveCompanionUrl(app: 'atelier' | 'unumbral' | 'arena'): string {
  const host = window.location.hostname;
  if (host.endsWith('github.io')) {
    if (app === 'atelier') return '../atelier-diario/';
    if (app === 'unumbral') return '../UNUmbral/';
    return '../omni-arena/';
  }
  if (app === 'atelier') return 'http://localhost:5176/';
  if (app === 'unumbral') return 'http://localhost:5177/';
  return 'http://localhost:5175/';
}
