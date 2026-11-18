/**
 * Traceability environments — the shapes, defaults and validation. CLIENT-SAFE: no secrets,
 * no imports from server code. Storage and resolution: `lib/trace-env.ts`.
 *
 * During the move from Fly.io to the Orcanos AWS environment the console must be pointed at
 * exactly ONE traceability environment at a time. Each environment is a set of per-region
 * instances (admin API URL + its own admin password) plus the URL users open:
 *
 *   fly          Fly.io + SQLite        the current production (traceability.orcanos.ai)
 *   aws_staging  AWS Staging + Postgres stage.orcanos.com (EU only)
 *   aws_prod     AWS Production + Postgres ushub.orcanos.com (US), hub.orcanos.com (EU)
 *
 * All tenants move at once (one database per environment), so there is no per-account
 * environment — switching the active one re-points every read and write. There is NO fallback
 * between environments: an unreachable AWS instance is an error, never a silent read of Fly
 * (that would show every account as missing or write it into the wrong database).
 */

import type { DataRegion } from './types';

export type TraceEnvKey = 'fly' | 'aws_staging' | 'aws_prod';
export const TRACE_ENV_KEYS: readonly TraceEnvKey[] = ['fly', 'aws_staging', 'aws_prod'] as const;

export type TraceDbKind = 'sqlite' | 'postgres';

/** One region of one environment, as stored. The password is stored encrypted, never returned. */
export interface StoredTraceInstance {
  /** Base URL of the traceability admin API (the app serves `/api/admin/*` under it). '' = none. */
  api_url: string;
  /** What users open (the accounts list's "Traceability ↗" link). '' = no deployment there. */
  app_url: string;
  /** AES-GCM ciphertext of that instance's ADMIN_PASSWORD (lib/crypto.ts). '' = not set. */
  admin_password_enc: string;
}

export interface StoredTraceEnv {
  label: string;
  db: TraceDbKind;
  /** Free text — e.g. "data copied 2026-11-20". */
  note: string;
  regions: Record<DataRegion, StoredTraceInstance>;
}

export interface StoredTraceEnvs {
  active: TraceEnvKey;
  envs: Record<TraceEnvKey, StoredTraceEnv>;
}

/** What the browser sees for one region: no password, only whether one is set. */
export interface PublicTraceInstance {
  api_url: string;
  app_url: string;
  has_password: boolean;
  /** Where the effective value comes from — the Fly environment falls back to the old env vars. */
  api_url_source: 'setting' | 'env' | 'none';
  password_source: 'setting' | 'env' | 'none';
}

export interface PublicTraceEnv {
  key: TraceEnvKey;
  label: string;
  db: TraceDbKind;
  note: string;
  regions: Record<DataRegion, PublicTraceInstance>;
}

/** The small summary every page's banner shows. */
export interface TraceEnvSummary {
  active: TraceEnvKey;
  label: string;
  db: TraceDbKind;
  production: boolean;
}

export const TRACE_DB_LABELS: Record<TraceDbKind, string> = { sqlite: 'SQLite', postgres: 'PostgreSQL' };

/** Production environments get the quiet banner; anything else is shown in amber. */
export const isProductionEnv = (key: TraceEnvKey) => key === 'fly' || key === 'aws_prod';

const inst = (api_url: string, app_url: string): StoredTraceInstance => ({ api_url, app_url, admin_password_enc: '' });

/**
 * The defaults before anyone has saved anything. Fly's API URLs and passwords are blank on
 * purpose: blank on Fly means "use TRACE_API_URL(_EU) / TRACE_ADMIN_PASSWORD(_EU)", so every
 * existing deployment keeps working unchanged. AWS hosts are the agreed ones; edit them on the
 * Environment screen if the admin API sits under a path.
 */
export const TRACE_ENV_DEFAULTS: StoredTraceEnvs = {
  active: 'fly',
  envs: {
    fly: {
      label: 'Fly.io + SQLite',
      db: 'sqlite',
      note: '',
      regions: {
        us: inst('', 'https://traceability.orcanos.ai'),
        eu: inst('', 'https://eu.traceability.orcanos.ai'),
      },
    },
    aws_staging: {
      label: 'AWS Staging + PostgreSQL',
      db: 'postgres',
      note: '',
      regions: {
        // Staging is EU-only (stage.orcanos.com, 2026-11-18): no US instance, so US accounts
        // are absent while staging is active and creating a US account there is refused.
        us: inst('', ''),
        eu: inst('https://stage.orcanos.com', 'https://stage.orcanos.com'),
      },
    },
    aws_prod: {
      label: 'AWS Production + PostgreSQL',
      db: 'postgres',
      note: '',
      regions: {
        us: inst('https://ushub.orcanos.com', 'https://ushub.orcanos.com'),
        eu: inst('https://hub.orcanos.com', 'https://hub.orcanos.com'),
      },
    },
  },
};

/** An http(s) URL with no trailing slash, or '' — anything else is refused. */
export function normaliseUrl(value: unknown): string | null {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  const v = value.trim().replace(/\/+$/, '');
  if (!v) return '';
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.search || u.hash) return null;
    return v;
  } catch {
    return null;
  }
}

export const isTraceEnvKey = (v: unknown): v is TraceEnvKey =>
  typeof v === 'string' && (TRACE_ENV_KEYS as readonly string[]).includes(v);

/** Read a stored value defensively: anything missing or malformed takes the default. */
export function parseStoredTraceEnvs(value: unknown): StoredTraceEnvs {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<StoredTraceEnvs>;
  const out: StoredTraceEnvs = JSON.parse(JSON.stringify(TRACE_ENV_DEFAULTS));
  if (isTraceEnvKey(v.active)) out.active = v.active;
  for (const key of TRACE_ENV_KEYS) {
    const e = (v.envs as Record<string, Partial<StoredTraceEnv>> | undefined)?.[key];
    if (!e || typeof e !== 'object') continue;
    const d = out.envs[key];
    if (typeof e.label === 'string' && e.label.trim()) d.label = e.label.trim().slice(0, 80);
    if (e.db === 'sqlite' || e.db === 'postgres') d.db = e.db;
    if (typeof e.note === 'string') d.note = e.note.slice(0, 500);
    for (const r of ['us', 'eu'] as DataRegion[]) {
      const ri = (e.regions as Record<string, Partial<StoredTraceInstance>> | undefined)?.[r];
      if (!ri || typeof ri !== 'object') continue;
      const api = normaliseUrl(ri.api_url);
      const app = normaliseUrl(ri.app_url);
      if (api !== null) d.regions[r].api_url = api;
      if (app !== null) d.regions[r].app_url = app;
      if (typeof ri.admin_password_enc === 'string') d.regions[r].admin_password_enc = ri.admin_password_enc;
    }
  }
  return out;
}
