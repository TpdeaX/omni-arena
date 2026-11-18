import { PlayerProfile } from '../types';

const CONFIG_KEY = 'atelier_cloud_sync_v1';

export interface CloudSyncConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  spaceCode: string;
  autoSync: boolean;
}

export function normalizeSupabaseUrl(input: string): string {
  const raw = input.trim().replace(/\/+$/, '');
  const dash = raw.match(/supabase\.com\/dashboard\/project\/([a-z0-9]{15,})/i);
  if (dash) return `https://${dash[1].toLowerCase()}.supabase.co`;
  if (/^[a-z0-9]{15,}$/i.test(raw)) return `https://${raw.toLowerCase()}.supabase.co`;
  const api = raw.match(/^(https:\/\/[a-z0-9-]+\.supabase\.co)/i);
  if (api) return api[1].toLowerCase();
  return raw;
}

class ArenaCloudSyncService {
  private config: CloudSyncConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): CloudSyncConfig {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CloudSyncConfig>;
        return {
          supabaseUrl: normalizeSupabaseUrl(parsed.supabaseUrl ?? ''),
          supabaseAnonKey: (parsed.supabaseAnonKey ?? '').trim(),
          spaceCode: (parsed.spaceCode || 'mi-espacio').trim().toLowerCase(),
          autoSync: parsed.autoSync ?? true,
        };
      }
    } catch {
      // Ignore storage error
    }
    return {
      supabaseUrl: '',
      supabaseAnonKey: '',
      spaceCode: 'mi-espacio',
      autoSync: true,
    };
  }

  public reloadConfig(): CloudSyncConfig {
    this.config = this.loadConfig();
    return this.getConfig();
  }

  public getConfig(): CloudSyncConfig {
    return { ...this.config };
  }

  public isConfigured(): boolean {
    return Boolean(
      this.config.supabaseUrl.startsWith('https://') &&
        this.config.supabaseAnonKey.length > 20 &&
        this.config.spaceCode.length >= 3
    );
  }

  public saveConfig(next: CloudSyncConfig): void {
    this.config = {
      supabaseUrl: normalizeSupabaseUrl(next.supabaseUrl),
      supabaseAnonKey: next.supabaseAnonKey.trim(),
      spaceCode: next.spaceCode.trim().toLowerCase() || 'mi-espacio',
      autoSync: next.autoSync,
    };
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
    } catch {
      // Ignore storage error
    }
  }

  public importToken(raw: string): boolean {
    try {
      const parsed = JSON.parse(raw.trim()) as Partial<CloudSyncConfig>;
      if (!parsed.supabaseUrl || !parsed.supabaseAnonKey) return false;
      this.saveConfig({
        supabaseUrl: parsed.supabaseUrl,
        supabaseAnonKey: parsed.supabaseAnonKey,
        spaceCode: parsed.spaceCode || 'mi-espacio',
        autoSync: parsed.autoSync ?? true,
      });
      return true;
    } catch {
      return false;
    }
  }

  public async pushProfile(profile: PlayerProfile): Promise<{ ok: boolean; message: string }> {
    this.reloadConfig();
    if (!this.isConfigured()) {
      return { ok: false, message: 'Completa URL, Anon Key y código de espacio.' };
    }
    const ts = profile.updatedAt || Date.now();
    try {
      const res = await fetch(
        `${this.config.supabaseUrl}/rest/v1/ecosystem_state?on_conflict=space_code,scope`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.config.supabaseAnonKey,
            Authorization: `Bearer ${this.config.supabaseAnonKey}`,
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify({
            space_code: this.config.spaceCode,
            scope: 'arena_profile',
            payload: profile,
            updated_at: ts,
          }),
        }
      );
      if (!res.ok) {
        return { ok: false, message: `Error Supabase (${res.status})` };
      }
      return { ok: true, message: `Sincronizado en «${this.config.spaceCode}».` };
    } catch {
      return { ok: false, message: 'Sin conexión con Supabase.' };
    }
  }

  public async pullScope<T = unknown>(scope: string): Promise<{
    ok: boolean;
    payload: T | null;
    updatedAt: number;
    message: string;
  }> {
    this.reloadConfig();
    if (!this.isConfigured()) {
      return { ok: false, payload: null, updatedAt: 0, message: 'Configura Supabase primero.' };
    }
    try {
      const res = await fetch(
        `${this.config.supabaseUrl}/rest/v1/ecosystem_state?space_code=eq.${encodeURIComponent(
          this.config.spaceCode
        )}&scope=eq.${encodeURIComponent(scope)}&select=payload,updated_at&limit=1`,
        {
          method: 'GET',
          headers: {
            apikey: this.config.supabaseAnonKey,
            Authorization: `Bearer ${this.config.supabaseAnonKey}`,
          },
        }
      );
      if (!res.ok) {
        return { ok: false, payload: null, updatedAt: 0, message: `Error Supabase (${res.status})` };
      }
      const rows = (await res.json()) as Array<{ payload?: T; updated_at?: number }>;
      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      return {
        ok: true,
        payload: row?.payload ?? null,
        updatedAt: Number(row?.updated_at) || 0,
        message: row ? 'Datos descargados desde Supabase.' : 'Sin datos previos en este espacio.',
      };
    } catch {
      return { ok: false, payload: null, updatedAt: 0, message: 'Error de red con Supabase.' };
    }
  }

  public async pullProfile(): Promise<{
    ok: boolean;
    profile: Partial<PlayerProfile> | null;
    updatedAt: number;
    message: string;
  }> {
    const res = await this.pullScope<Partial<PlayerProfile>>('arena_profile');
    return {
      ok: res.ok,
      profile: res.payload,
      updatedAt: res.updatedAt,
      message: res.ok
        ? res.payload
          ? 'Progreso descargado desde Supabase.'
          : 'Sin progreso previo en este espacio.'
        : res.message,
    };
  }
}

export const arenaCloudSync = new ArenaCloudSyncService();
