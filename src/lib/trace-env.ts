/**
 * Which traceability environment this console talks to — storage and resolution. SERVER ONLY
 * (decrypts admin passwords). Shapes, defaults and the reasoning: `lib/trace-env-key.ts`.
 *
 * Stored in master `platform_settings` under key `trace_environments` (sql/008, already applied —
 * no migration). No row = the defaults = the Fly environment driven by the old env vars, so a
 * deployment that never opens the Environment screen behaves exactly as before.
 *
 * Read on every trace call through a short in-memory cache. A switch made on one Vercel instance
 * reaches the others within CACHE_MS; the instance that saved it sees it at once.
 */

import { pgGet, pgUpsert } from './supabase';
import { decryptSecret } from './crypto';
import {
  TRACE_ENV_DEFAULTS,
  TRACE_ENV_KEYS,
  isProductionEnv,
  parseStoredTraceEnvs,
  type PublicTraceEnv,
  type PublicTraceInstance,
  type StoredTraceEnvs,
  type TraceDbKind,
  type TraceEnvKey,
  type TraceEnvSummary,
} from './trace-env-key';
import type { DataRegion } from './types';

export const TRACE_ENV_SETTING = 'trace_environments';
const CACHE_MS = 15_000;

/** One region of the ACTIVE environment, ready to call. */
export interface ResolvedTraceInstance {
  api_url: string | null;
  password: string | null;
  app_url: string | null;
  /** Names what to fix when a value is missing — a setting or an env var. */
  missing_hint: string;
}

export interface ResolvedTraceEnv {
  key: TraceEnvKey;
  label: string;
  db: TraceDbKind;
  regions: Record<DataRegion, ResolvedTraceInstance>;
}

type SettingRow = { value?: unknown; updated_at?: string; updated_by?: string };

let cache: { at: number; stored: StoredTraceEnvs; updated_at: string | null; updated_by: string | null } | null = null;

export function clearTraceEnvCache() {
  cache = null;
}

/** The stored document (or the defaults). A read failure throws — never guess an environment. */
export async function loadStoredTraceEnvs(): Promise<{
  stored: StoredTraceEnvs;
  updated_at: string | null;
  updated_by: string | null;
  migrated: boolean;
}> {
  if (cache && Date.now() - cache.at < CACHE_MS) return { ...cache, migrated: true };
  let rows: SettingRow[];
  try {
    rows = await pgGet<SettingRow[]>(
      `platform_settings?key=eq.${TRACE_ENV_SETTING}&select=value,updated_at,updated_by`,
    );
  } catch (e) {
    // No platform_settings table at all: behave as before (Fly + env vars).
    if (/platform_settings|42P01|PGRST205/i.test(e instanceof Error ? e.message : String(e))) {
      return { stored: parseStoredTraceEnvs(null), updated_at: null, updated_by: null, migrated: false };
    }
    throw e;
  }
  const r = rows[0];
  cache = {
    at: Date.now(),
    stored: parseStoredTraceEnvs(r?.value),
    updated_at: r?.updated_at ?? null,
    updated_by: r?.updated_by ?? null,
  };
  return { ...cache, migrated: true };
}

export async function saveStoredTraceEnvs(stored: StoredTraceEnvs, by: string): Promise<void> {
  await pgUpsert('platform_settings', 'key', {
    key: TRACE_ENV_SETTING,
    value: stored,
    updated_at: new Date().toISOString(),
    updated_by: by,
  });
  clearTraceEnvCache();
}

const envUrl = (r: DataRegion) =>
  (r === 'eu' ? process.env.TRACE_API_URL_EU : process.env.TRACE_API_URL)?.trim().replace(/\/+$/, '') || '';
const envPassword = (r: DataRegion) =>
  (r === 'eu' ? process.env.TRACE_ADMIN_PASSWORD_EU : process.env.TRACE_ADMIN_PASSWORD) || '';
const envName = (r: DataRegion, what: 'url' | 'password') =>
  what === 'url'
    ? r === 'eu' ? 'TRACE_API_URL_EU' : 'TRACE_API_URL'
    : r === 'eu' ? 'TRACE_ADMIN_PASSWORD_EU' : 'TRACE_ADMIN_PASSWORD';

function decryptOrNull(enc: string): string | null {
  if (!enc) return null;
  try {
    return decryptSecret(enc);
  } catch {
    return null;
  }
}

/**
 * One environment's region, with the Fly fallback applied: on `fly` a blank URL or password
 * means the old env var. AWS environments have no env fallback — they exist only as settings,
 * so a half-configured AWS region is absent rather than quietly calling Fly.
 */
function resolveInstance(stored: StoredTraceEnvs, key: TraceEnvKey, r: DataRegion): ResolvedTraceInstance & {
  api_url_source: PublicTraceInstance['api_url_source'];
  password_source: PublicTraceInstance['password_source'];
} {
  const s = stored.envs[key].regions[r];
  const fly = key === 'fly';
  const pw = decryptOrNull(s.admin_password_enc);
  const api_url = s.api_url || (fly ? envUrl(r) : '') || null;
  const password = pw || (fly ? envPassword(r) : '') || null;
  const label = stored.envs[key].label;
  return {
    api_url,
    password,
    app_url: s.app_url || null,
    api_url_source: s.api_url ? 'setting' : fly && envUrl(r) ? 'env' : 'none',
    password_source: pw ? 'setting' : fly && envPassword(r) ? 'env' : 'none',
    missing_hint: fly
      ? `set it on the Environment screen (${label}, ${r.toUpperCase()}) or ${envName(r, api_url ? 'password' : 'url')}`
      : `set it on the Environment screen (${label}, ${r.toUpperCase()})`,
  };
}

/** The environment every trace call goes to right now. */
export async function activeTraceEnv(): Promise<ResolvedTraceEnv> {
  const { stored } = await loadStoredTraceEnvs();
  return resolveEnv(stored, stored.active);
}

export function resolveEnv(stored: StoredTraceEnvs, key: TraceEnvKey): ResolvedTraceEnv {
  const e = stored.envs[key];
  const strip = (x: ReturnType<typeof resolveInstance>): ResolvedTraceInstance => ({
    api_url: x.api_url,
    password: x.password,
    app_url: x.app_url,
    missing_hint: x.missing_hint,
  });
  return {
    key,
    label: e.label,
    db: e.db,
    regions: { us: strip(resolveInstance(stored, key, 'us')), eu: strip(resolveInstance(stored, key, 'eu')) },
  };
}

/** Everything the Environment screen shows. Never contains a password. */
export function publicEnvs(stored: StoredTraceEnvs): PublicTraceEnv[] {
  return TRACE_ENV_KEYS.map((key) => {
    const e = stored.envs[key];
    const region = (r: DataRegion): PublicTraceInstance => {
      const x = resolveInstance(stored, key, r);
      return {
        api_url: e.regions[r].api_url,
        app_url: e.regions[r].app_url,
        has_password: x.password_source !== 'none',
        api_url_source: x.api_url_source,
        password_source: x.password_source,
      };
    };
    return { key, label: e.label, db: e.db, note: e.note, regions: { us: region('us'), eu: region('eu') } };
  });
}

export async function traceEnvSummary(): Promise<TraceEnvSummary> {
  const { stored } = await loadStoredTraceEnvs();
  const e = stored.envs[stored.active];
  return { active: stored.active, label: e.label, db: e.db, production: isProductionEnv(stored.active) };
}

export { TRACE_ENV_DEFAULTS };
