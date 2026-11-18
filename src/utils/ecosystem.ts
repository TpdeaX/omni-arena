import { arenaCloudSync } from '../services/CloudSync';
import { ThemeMode } from '../types';

export type EcoAppId = 'directorio' | 'atelier' | 'unumbral' | 'arena';

export interface ArenaCatalogMeta {
  version: 1;
  total: number;
  academies: number;
  dexterity2d: number;
  action3d: number;
  updatedAt: number;
}

export interface EcoPulseSummary {
  sameOriginAvailable: boolean;
  atelier: {
    hasData: boolean;
    streak: number;
    todayDone: number;
    totalHabits: number;
  };
  unumbral: {
    hasData: boolean;
    pendingTasks: number;
    todayClasses: number;
    coursesCount: number;
  };
}

const ECO_THEME_KEY = 'umbral-theme';
const CATALOG_META_KEY = 'omni_arena_catalog_meta_v1';

const APP_CONFIG: Record<
  EcoAppId,
  { port: number; route: string; label: string; shortPrefix?: string; shortSuffix?: string }
> = {
  directorio: { port: 5178, route: 'directorio', label: 'Directorio' },
  atelier: { port: 5176, route: 'atelier-diario', label: 'Atelier Diario', shortSuffix: ' Diario' },
  unumbral: { port: 5177, route: 'UNUmbral', label: 'UNUmbral' },
  arena: { port: 5175, route: 'omni-arena', label: 'OMNI ARENA', shortPrefix: 'OMNI ' },
};

const ECO_SVGS: Record<EcoAppId, string> = {
  directorio:
    '<svg class="oa-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  atelier:
    '<svg class="oa-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  unumbral:
    '<svg class="oa-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="22 10 12 5 2 10 12 15 22 10"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
  arena:
    '<svg class="oa-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 19 6 22 12 19 18 12 22 5 18 2 12 5 6 12 2"/><circle cx="12" cy="12" r="4"/></svg>',
};

function isLocalOrPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) return true;
  const m172 = hostname.match(/^172\.(\d{1,3})\./);
  if (m172) {
    const second = Number(m172[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

export function normalizeEcoTheme(raw: string | null | undefined): 'light' | 'dark' | null {
  if (!raw) return null;
  const clean = raw.trim().toLowerCase();
  if (clean === 'light' || clean === 'day') return 'light';
  if (clean === 'dark' || clean === 'night') return 'dark';
  return null;
}

export function ecoToArenaTheme(eco: 'light' | 'dark'): ThemeMode {
  return eco === 'light' ? 'day' : 'night';
}

export function arenaToEcoTheme(theme: ThemeMode): 'light' | 'dark' {
  return theme === 'day' ? 'light' : 'dark';
}

export function consumeIncomingEcoTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const param = normalizeEcoTheme(url.searchParams.get('eco_theme'));
    if (param) {
      localStorage.setItem(ECO_THEME_KEY, param);
      url.searchParams.delete('eco_theme');
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(null, '', nextUrl);
      return ecoToArenaTheme(param);
    }
  } catch {
    // Ignore URL errors
  }
  return null;
}

export function readStoredEcoTheme(): ThemeMode | null {
  try {
    const raw = localStorage.getItem(ECO_THEME_KEY);
    const norm = normalizeEcoTheme(raw);
    return norm ? ecoToArenaTheme(norm) : null;
  } catch {
    return null;
  }
}

export function writeStoredEcoTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(ECO_THEME_KEY, arenaToEcoTheme(theme));
  } catch {
    // Ignore storage errors
  }
}

export function resolveCompanionUrl(
  app: EcoAppId,
  hash?: string,
  loc?: { hostname: string; port: string; protocol: string }
): string {
  const locationObj =
    loc ??
    (typeof window !== 'undefined'
      ? window.location
      : { hostname: 'localhost', port: '5175', protocol: 'http:' });
  const { hostname, port, protocol } = locationObj;
  const cfg = APP_CONFIG[app];

  let baseUrl = '';
  let crossOrigin = false;
  const isCapacitor =
    typeof window !== 'undefined' && Boolean((window as unknown as { Capacitor?: unknown }).Capacitor);

  if (hostname.endsWith('github.io')) {
    baseUrl = `../${cfg.route}/`;
    crossOrigin = false;
  } else if (isCapacitor || (hostname === 'localhost' && port === '')) {
    baseUrl = `https://tpdeax.github.io/${cfg.route}/`;
    crossOrigin = true;
  } else if (isLocalOrPrivateHost(hostname) && port !== '') {
    baseUrl = `${protocol}//${hostname}:${cfg.port}/`;
    crossOrigin = String(cfg.port) !== port;
  } else {
    baseUrl = `https://tpdeax.github.io/${cfg.route}/`;
    crossOrigin = true;
  }

  let query = '';
  if (crossOrigin) {
    let ecoTheme: 'light' | 'dark' = 'dark';
    try {
      const stored = normalizeEcoTheme(localStorage.getItem(ECO_THEME_KEY));
      if (stored) ecoTheme = stored;
    } catch {
      // Ignore
    }
    query = `?eco_theme=${ecoTheme}`;
  }

  const hashPart = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';
  return `${baseUrl}${query}${hashPart}`;
}

export function renderEcoSwitchBar(currentApp: EcoAppId): string {
  const order: EcoAppId[] = ['directorio', 'atelier', 'unumbral', 'arena'];
  const links = order
    .map((app) => {
      const cfg = APP_CONFIG[app];
      const isCurrent = app === currentApp;
      const href = resolveCompanionUrl(app);
      let labelHtml = cfg.label;
      if (cfg.shortPrefix) {
        const rest = cfg.label.slice(cfg.shortPrefix.length);
        labelHtml = `<span class="eco-label-ext">${cfg.shortPrefix}</span>${rest}`;
      } else if (cfg.shortSuffix) {
        const base = cfg.label.slice(0, cfg.label.length - cfg.shortSuffix.length);
        labelHtml = `${base}<span class="eco-label-ext">${cfg.shortSuffix}</span>`;
      }
      return `<a class="eco-switch-link${isCurrent ? ' is-current' : ''}" data-eco-app="${app}"${
        isCurrent ? ' aria-current="page"' : ''
      } href="${href}">${ECO_SVGS[app]}<span>${labelHtml}</span></a>`;
    })
    .join('');
  return `<nav class="eco-switch" aria-label="Aplicaciones del ecosistema">${links}</nav>`;
}

export function bindEcoThemeSync(onThemeExternalChange: (theme: ThemeMode) => void): () => void {
  let lastApplied: ThemeMode | null = readStoredEcoTheme();

  const notifyIfValid = () => {
    const next = readStoredEcoTheme();
    if (next && next !== lastApplied) {
      lastApplied = next;
      onThemeExternalChange(next);
    }
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key === ECO_THEME_KEY) {
      const norm = normalizeEcoTheme(e.newValue);
      if (norm) {
        const next = ecoToArenaTheme(norm);
        lastApplied = next;
        onThemeExternalChange(next);
      }
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      notifyIfValid();
    }
  };

  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

export function publishArenaCatalogMeta(
  meta: Omit<ArenaCatalogMeta, 'version' | 'updatedAt'>
): void {
  try {
    const payload: ArenaCatalogMeta = {
      version: 1,
      total: meta.total,
      academies: meta.academies,
      dexterity2d: meta.dexterity2d,
      action3d: meta.action3d,
      updatedAt: Date.now(),
    };
    localStorage.setItem(CATALOG_META_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
}

function localTodayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseAtelierPayload(raw: unknown): EcoPulseSummary['atelier'] {
  if (!raw || typeof raw !== 'object') {
    return { hasData: false, streak: 0, todayDone: 0, totalHabits: 9 };
  }
  const obj = raw as {
    dailyStreak?: number;
    lastActiveDay?: string;
    todayHabits?: Record<string, boolean>;
  };
  const streak = Number(obj.dailyStreak) || 0;
  const habitsObj = obj.todayHabits && typeof obj.todayHabits === 'object' ? obj.todayHabits : {};
  const keys = Object.keys(habitsObj);
  const totalHabits = keys.length || 9;
  const isToday = obj.lastActiveDay === localTodayStamp();
  const todayDone = isToday ? Object.values(habitsObj).filter(Boolean).length : 0;
  return {
    hasData: true,
    streak,
    todayDone,
    totalHabits,
  };
}

function parseUnumbralPayload(raw: unknown): EcoPulseSummary['unumbral'] {
  if (!raw || typeof raw !== 'object') {
    return { hasData: false, pendingTasks: 0, todayClasses: 0, coursesCount: 0 };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.coursesCount === 'number' || typeof obj.pendingTasks === 'number') {
    return {
      hasData: true,
      pendingTasks: Number(obj.pendingTasks) || 0,
      todayClasses: Number(obj.todayClasses) || 0,
      coursesCount: Number(obj.coursesCount) || 0,
    };
  }
  const tareas = Array.isArray(obj.tareas) ? obj.tareas : [];
  const clases = Array.isArray(obj.clases) ? obj.clases : [];
  const cursos = Array.isArray(obj.cursos) ? obj.cursos : [];
  const pendingTasks = tareas.filter(
    (t) => t && typeof t === 'object' && (t as { completada?: boolean }).completada !== true
  ).length;
  return {
    hasData: tareas.length > 0 || clases.length > 0 || cursos.length > 0,
    pendingTasks,
    todayClasses: clases.length,
    coursesCount: cursos.length,
  };
}

export function readEcoPulse(): EcoPulseSummary {
  const isGithubIo =
    typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');

  let atelierRaw: unknown = null;
  let unumbralRaw: unknown = null;

  try {
    const aStr =
      localStorage.getItem('atelier_diario_profile_v1') ?? localStorage.getItem('atelier_profile_v2');
    if (aStr) atelierRaw = JSON.parse(aStr);
  } catch {
    // Ignore malformed JSON
  }

  try {
    const uStr =
      localStorage.getItem('unumbral_last_snapshot_v1') ??
      localStorage.getItem('atelier_umbral_snapshot_v1');
    if (uStr) unumbralRaw = JSON.parse(uStr);
  } catch {
    // Ignore malformed JSON
  }

  return {
    sameOriginAvailable: isGithubIo || Boolean(atelierRaw) || Boolean(unumbralRaw),
    atelier: parseAtelierPayload(atelierRaw),
    unumbral: parseUnumbralPayload(unumbralRaw),
  };
}

let cloudPulseCache: { data: EcoPulseSummary; fetchedAt: number } | null = null;

export async function readEcoPulseWithCloud(): Promise<EcoPulseSummary> {
  const local = readEcoPulse();
  if (!arenaCloudSync.isConfigured()) return local;

  const now = Date.now();
  if (cloudPulseCache && now - cloudPulseCache.fetchedAt < 60_000) {
    return cloudPulseCache.data;
  }

  const [atelierRes, unumbralRes] = await Promise.all([
    arenaCloudSync.pullScope<Record<string, unknown>>('atelier_profile'),
    arenaCloudSync.pullScope<Record<string, unknown>>('unumbral_backup'),
  ]);

  let atelier = local.atelier;
  if (atelierRes.ok && atelierRes.payload) {
    const remoteAtelier = parseAtelierPayload(atelierRes.payload);
    if (!atelier.hasData || remoteAtelier.hasData) {
      atelier = remoteAtelier;
    }
  }

  let unumbral = local.unumbral;
  if (unumbralRes.ok && unumbralRes.payload) {
    const remoteUnumbral = parseUnumbralPayload(unumbralRes.payload);
    if (!unumbral.hasData || remoteUnumbral.hasData) {
      unumbral = remoteUnumbral;
    }
  }

  const merged: EcoPulseSummary = {
    sameOriginAvailable: local.sameOriginAvailable || atelier.hasData || unumbral.hasData,
    atelier,
    unumbral,
  };
  cloudPulseCache = { data: merged, fetchedAt: now };
  return merged;
}
