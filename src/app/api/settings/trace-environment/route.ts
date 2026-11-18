/**
 * GET/PUT /api/settings/trace-environment — which traceability environment this console talks to
 * (Fly.io + SQLite, AWS Staging + Postgres, AWS Production + Postgres) and each one's settings.
 *
 * GET            → { active, envs: PublicTraceEnv[], updated_at, updated_by, migrated }
 * GET ?summary=1 → TraceEnvSummary (the banner every page shows)
 * PUT { active?, envs?: { <key>: { label?, db?, note?, regions?: { us|eu: { api_url?, app_url?,
 *       admin_password?, clear_password? } } } } }
 *     A blank admin_password keeps the stored one (same rule as every secret in this app);
 *     clear_password removes it. Passwords are encrypted (lib/crypto.ts) and never returned.
 *     Switching `active` is refused when the target has no region with both URL and password.
 *     Audited as `platform_setting_changed` (key `trace_environments`), passwords as a flag only.
 *
 * Storage and resolution: lib/trace-env.ts. Staff only.
 */

import { requirePlatformStaff } from '@/lib/session';
import { logSecurityEvent } from '@/lib/audit';
import { encryptSecret } from '@/lib/crypto';
import {
  loadStoredTraceEnvs,
  publicEnvs,
  resolveEnv,
  saveStoredTraceEnvs,
  traceEnvSummary,
} from '@/lib/trace-env';
import { isTraceEnvKey, normaliseUrl, type StoredTraceEnvs } from '@/lib/trace-env-key';
import type { DataRegion } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REGIONS: DataRegion[] = ['us', 'eu'];

export async function GET(req: Request) {
  const { error } = await requirePlatformStaff();
  if (error) return error;
  try {
    if (new URL(req.url).searchParams.get('summary')) return Response.json(await traceEnvSummary());
    const { stored, updated_at, updated_by, migrated } = await loadStoredTraceEnvs();
    return Response.json({ active: stored.active, envs: publicEnvs(stored), updated_at, updated_by, migrated });
  } catch (e) {
    return Response.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

type RegionPatch = { api_url?: unknown; app_url?: unknown; admin_password?: unknown; clear_password?: unknown };
type EnvPatch = { label?: unknown; db?: unknown; note?: unknown; regions?: Partial<Record<DataRegion, RegionPatch>> };

export async function PUT(req: Request) {
  const { user, error } = await requirePlatformStaff();
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { active?: unknown; envs?: Record<string, EnvPatch> };

  let loaded;
  try {
    loaded = await loadStoredTraceEnvs();
  } catch (e) {
    return Response.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
  if (!loaded.migrated) {
    return Response.json(
      { detail: 'The master database has no platform_settings table yet — run sql/008_platform_settings.sql first.' },
      { status: 409 },
    );
  }
  const previous = loaded.stored;
  const next: StoredTraceEnvs = JSON.parse(JSON.stringify(previous));
  const changes: Record<string, string[]> = {};
  const note = (key: string, what: string) => (changes[key] ??= []).push(what);

  for (const [key, patch] of Object.entries(body.envs ?? {})) {
    if (!isTraceEnvKey(key)) return bad(`Unknown environment '${key}'.`);
    const e = next.envs[key];
    if (patch.label !== undefined) {
      if (typeof patch.label !== 'string' || !patch.label.trim()) return bad(`${key}: the name cannot be empty.`);
      if (patch.label.trim() !== e.label) note(key, 'label');
      e.label = patch.label.trim().slice(0, 80);
    }
    if (patch.db !== undefined) {
      if (patch.db !== 'sqlite' && patch.db !== 'postgres') return bad(`${key}: database must be sqlite or postgres.`);
      if (patch.db !== e.db) note(key, 'db');
      e.db = patch.db;
    }
    if (patch.note !== undefined) {
      if (typeof patch.note !== 'string') return bad(`${key}: note must be text.`);
      if (patch.note !== e.note) note(key, 'note');
      e.note = patch.note.slice(0, 500);
    }
    for (const r of REGIONS) {
      const rp = patch.regions?.[r];
      if (!rp) continue;
      const s = e.regions[r];
      for (const field of ['api_url', 'app_url'] as const) {
        if (rp[field] === undefined) continue;
        const v = normaliseUrl(rp[field]);
        if (v === null) return bad(`${key} ${r.toUpperCase()}: ${field} must be an http(s) URL with no query string.`);
        if (v !== s[field]) note(key, `${r}.${field}`);
        s[field] = v;
      }
      if (rp.clear_password === true) {
        if (s.admin_password_enc) note(key, `${r}.password_cleared`);
        s.admin_password_enc = '';
      } else if (typeof rp.admin_password === 'string' && rp.admin_password) {
        s.admin_password_enc = encryptSecret(rp.admin_password);
        note(key, `${r}.password_set`);
      }
    }
  }

  if (body.active !== undefined) {
    if (!isTraceEnvKey(body.active)) return bad(`Unknown environment '${String(body.active)}'.`);
    const target = resolveEnv(next, body.active);
    const usable = REGIONS.filter((r) => target.regions[r].api_url && target.regions[r].password);
    if (!usable.length) {
      return Response.json(
        { detail: `"${target.label}" has no region with both an admin API URL and a password — set them before switching to it.` },
        { status: 409 },
      );
    }
    next.active = body.active;
  }

  if (next.active === previous.active && !Object.keys(changes).length) return Response.json({ ok: true, unchanged: true });

  try {
    await saveStoredTraceEnvs(next, user.email);
  } catch (e) {
    return Response.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }

  await logSecurityEvent('platform_setting_changed', {
    user,
    detail: {
      key: 'trace_environments',
      previous_active: previous.active,
      active: next.active,
      switched: previous.active !== next.active,
      changed: changes,
    },
  });
  return Response.json({ ok: true, active: next.active, envs: publicEnvs(next) });
}

function bad(detail: string) {
  return Response.json({ detail }, { status: 400 });
}
