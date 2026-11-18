'use client';

import { useEffect, useState } from 'react';
import {
  TRACE_DB_LABELS,
  isProductionEnv,
  type PublicTraceEnv,
  type TraceDbKind,
  type TraceEnvKey,
} from '@/lib/trace-env-key';
import type { DataRegion } from '@/lib/types';

/**
 * Environment — which traceability environment the console talks to while traceability moves
 * from Fly.io + SQLite to the Orcanos AWS environment (Postgres). One environment is active for
 * every user of this console; switching re-points every traceability read and write (accounts
 * list, licences, usage, presentations). No fallback between them. Storage: lib/trace-env.ts.
 */

const REGIONS: DataRegion[] = ['us', 'eu'];

type RegionForm = { api_url: string; app_url: string; admin_password: string; clear_password: boolean };
type EnvForm = { label: string; db: TraceDbKind; note: string; regions: Record<DataRegion, RegionForm> };
type TestState = { busy: boolean; ok?: boolean; text?: string };

const toForm = (e: PublicTraceEnv): EnvForm => ({
  label: e.label,
  db: e.db,
  note: e.note,
  regions: {
    us: { api_url: e.regions.us.api_url, app_url: e.regions.us.app_url, admin_password: '', clear_password: false },
    eu: { api_url: e.regions.eu.api_url, app_url: e.regions.eu.app_url, admin_password: '', clear_password: false },
  },
});

export default function EnvironmentClient() {
  const [active, setActive] = useState<TraceEnvKey | null>(null);
  const [envs, setEnvs] = useState<PublicTraceEnv[]>([]);
  const [forms, setForms] = useState<Partial<Record<TraceEnvKey, EnvForm>>>({});
  const [meta, setMeta] = useState<{ updated_at: string | null; updated_by: string | null; migrated: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});

  function apply(data: { active: TraceEnvKey; envs: PublicTraceEnv[] }) {
    setActive(data.active);
    setEnvs(data.envs);
    setForms(Object.fromEntries(data.envs.map((e) => [e.key, toForm(e)])));
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/trace-environment', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      apply(data);
      setMeta({ updated_at: data.updated_at, updated_by: data.updated_by, migrated: data.migrated });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function put(body: unknown, doneText: string, key: string) {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch('/api/settings/trace-environment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setMsg({ ok: true, text: data.unchanged ? 'Nothing changed.' : doneText });
      await load();
      // The banner in the sidebar reads the same setting.
      window.dispatchEvent(new Event('trace-env-changed'));
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setBusy(null);
  }

  function switchTo(e: PublicTraceEnv) {
    const prod = isProductionEnv(e.key);
    const ok = window.confirm(
      `Switch the console to "${e.label}"?\n\n` +
        'Every traceability read and write — the accounts list, module licences, usage and presentations — ' +
        'will go to this environment for every user of the console, within about 15 seconds.' +
        (prod ? '' : '\n\nThis is NOT a production environment.'),
    );
    if (ok) void put({ active: e.key }, `Switched to "${e.label}".`, `switch:${e.key}`);
  }

  function save(key: TraceEnvKey) {
    const f = forms[key];
    if (!f) return;
    const regions = Object.fromEntries(
      REGIONS.map((r) => {
        const x = f.regions[r];
        return [
          r,
          {
            api_url: x.api_url,
            app_url: x.app_url,
            ...(x.admin_password ? { admin_password: x.admin_password } : {}),
            ...(x.clear_password ? { clear_password: true } : {}),
          },
        ];
      }),
    );
    void put({ envs: { [key]: { label: f.label, db: f.db, note: f.note, regions } } }, `Saved "${f.label}".`, `save:${key}`);
  }

  async function test(key: TraceEnvKey, r: DataRegion) {
    const f = forms[key]?.regions[r];
    const id = `${key}:${r}`;
    setTests((t) => ({ ...t, [id]: { busy: true } }));
    try {
      const res = await fetch('/api/settings/trace-environment/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ env: key, region: r, api_url: f?.api_url ?? '', admin_password: f?.admin_password ?? '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setTests((t) => ({
        ...t,
        [id]: data.ok
          ? { busy: false, ok: true, text: `Connected to ${data.url} — ${data.accounts} accounts (${data.ms} ms).` }
          : { busy: false, ok: false, text: `${data.url}: ${data.error}` },
      }));
    } catch (e) {
      setTests((t) => ({ ...t, [id]: { busy: false, ok: false, text: e instanceof Error ? e.message : String(e) } }));
    }
  }

  const setRegion = (key: TraceEnvKey, r: DataRegion, patch: Partial<RegionForm>) =>
    setForms((all) => {
      const f = all[key]!;
      return { ...all, [key]: { ...f, regions: { ...f.regions, [r]: { ...f.regions[r], ...patch } } } };
    });
  const setEnv = (key: TraceEnvKey, patch: Partial<EnvForm>) =>
    setForms((all) => ({ ...all, [key]: { ...all[key]!, ...patch } }));

  return (
    <>
      <div className="app-page-header">
        <div>
          <h1>Environment</h1>
          <p className="app-page-sub">
            Which traceability environment this console works with during the move from Fly.io to the
            Orcanos AWS environment. One is active for everyone; all accounts move with it.
          </p>
        </div>
      </div>

      {msg && <div className={msg.ok ? 'acl-notice' : 'acl-error'} style={{ marginBottom: 14 }}>{msg.text}</div>}
      {meta && !meta.migrated && (
        <div className="acl-error" style={{ marginBottom: 14 }}>
          The master database has no <code>platform_settings</code> table yet — run <code>sql/008_platform_settings.sql</code>{' '}
          first. Until then the console uses Fly.io from the <code>TRACE_*</code> environment variables and saving is refused.
        </div>
      )}

      {loading && !envs.length ? (
        <div className="app-card" style={{ padding: 24 }}><p className="acl-empty">Loading…</p></div>
      ) : (
        <>
          <div className="env-choices">
            {envs.map((e) => {
              const on = e.key === active;
              const ready = REGIONS.filter((r) => (e.regions[r].api_url || e.regions[r].api_url_source === 'env') && e.regions[r].has_password);
              return (
                <div key={e.key} className={`app-card env-choice ${on ? 'env-choice--on' : ''}`}>
                  <div className="env-choice-head">
                    <strong>{e.label}</strong>
                    {on && <span className="env-pill env-pill--on">Active</span>}
                    {!isProductionEnv(e.key) && <span className="env-pill env-pill--warn">Not production</span>}
                  </div>
                  <div className="acl-muted">Database: {TRACE_DB_LABELS[e.db]}</div>
                  <div className="acl-muted">
                    Regions ready: {ready.length ? ready.map((r) => r.toUpperCase()).join(', ') : 'none'}
                  </div>
                  {e.note && <div className="acl-muted">{e.note}</div>}
                  <div style={{ marginTop: 10 }}>
                    {on ? (
                      <span className="acl-muted">In use</span>
                    ) : (
                      <button className="btn-primary" disabled={!!busy || !ready.length || !meta?.migrated} onClick={() => switchTo(e)}
                        title={ready.length ? '' : 'Set an admin API URL and password for at least one region first.'}>
                        {busy === `switch:${e.key}` ? 'Switching…' : 'Switch to this'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {meta?.updated_at && (
            <p className="acl-muted" style={{ margin: '8px 0 20px' }}>
              Last changed {new Date(meta.updated_at).toLocaleString()} by {meta.updated_by || '—'}
            </p>
          )}

          {envs.map((e) => {
            const f = forms[e.key];
            if (!f) return null;
            return (
              <div key={e.key} className="app-card" style={{ padding: 24, marginBottom: 20 }}>
                <h3 className="acl-section-title" style={{ marginTop: 0 }}>
                  {e.label} {e.key === active && <span className="env-pill env-pill--on">Active</span>}
                </h3>
                <div className="acl-field-row">
                  <label className="acl-label" htmlFor={`${e.key}-label`}>Name</label>
                  <input id={`${e.key}-label`} className="acl-input" value={f.label} onChange={(x) => setEnv(e.key, { label: x.target.value })} />
                </div>
                <div className="acl-field-row">
                  <label className="acl-label" htmlFor={`${e.key}-db`}>Database</label>
                  <select id={`${e.key}-db`} className="acl-input" value={f.db} onChange={(x) => setEnv(e.key, { db: x.target.value as TraceDbKind })}>
                    <option value="sqlite">SQLite</option>
                    <option value="postgres">PostgreSQL</option>
                  </select>
                </div>
                <div className="acl-field-row">
                  <label className="acl-label" htmlFor={`${e.key}-note`}>Note</label>
                  <input id={`${e.key}-note`} className="acl-input" value={f.note} placeholder="e.g. data copied from Fly on …" onChange={(x) => setEnv(e.key, { note: x.target.value })} />
                </div>

                {REGIONS.map((r) => {
                  const pub = e.regions[r];
                  const x = f.regions[r];
                  const t = tests[`${e.key}:${r}`];
                  const fly = e.key === 'fly';
                  return (
                    <div key={r} className="env-region">
                      <h4 className="env-region-title">{r === 'us' ? 'United States (US)' : 'European Union (EU)'}</h4>
                      <div className="acl-field-row">
                        <label className="acl-label" htmlFor={`${e.key}-${r}-api`}>Admin API URL</label>
                        <div style={{ flex: 1 }}>
                          <input id={`${e.key}-${r}-api`} className="acl-input" value={x.api_url}
                            placeholder={fly ? `blank = ${r === 'eu' ? 'TRACE_API_URL_EU' : 'TRACE_API_URL'}` : 'blank = no instance in this region'}
                            onChange={(v) => setRegion(e.key, r, { api_url: v.target.value })} />
                          {!x.api_url && pub.api_url_source === 'env' && <div className="acl-hint">Using the environment variable.</div>}
                        </div>
                      </div>
                      <div className="acl-field-row">
                        <label className="acl-label" htmlFor={`${e.key}-${r}-pw`}>Admin password</label>
                        <div style={{ flex: 1 }}>
                          <input id={`${e.key}-${r}-pw`} className="acl-input" type="password" autoComplete="new-password" value={x.admin_password}
                            disabled={x.clear_password}
                            placeholder={pub.password_source === 'setting' ? '•••••••• saved — blank keeps it' : pub.password_source === 'env' ? 'from the environment variable — blank keeps it' : 'not set'}
                            onChange={(v) => setRegion(e.key, r, { admin_password: v.target.value })} />
                          {pub.password_source === 'setting' && (
                            <label className="acl-hint" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input type="checkbox" checked={x.clear_password} onChange={(v) => setRegion(e.key, r, { clear_password: v.target.checked, admin_password: '' })} />
                              Remove the saved password{fly ? ' (falls back to the environment variable)' : ''}
                            </label>
                          )}
                        </div>
                      </div>
                      <div className="acl-field-row">
                        <label className="acl-label" htmlFor={`${e.key}-${r}-app`}>App URL (users)</label>
                        <input id={`${e.key}-${r}-app`} className="acl-input" value={x.app_url} placeholder="blank = no link in this region"
                          onChange={(v) => setRegion(e.key, r, { app_url: v.target.value })} />
                      </div>
                      <div className="acl-field-row">
                        <span className="acl-label" />
                        <div style={{ flex: 1 }}>
                          <button className="btn-sm" disabled={t?.busy} onClick={() => void test(e.key, r)}>
                            {t?.busy ? 'Testing…' : 'Test connection'}
                          </button>
                          {t?.text && <div className={`acl-hint ${t.ok ? 'acl-hint--ok' : 'acl-hint--bad'}`}>{t.text}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div style={{ marginTop: 12 }}>
                  <button className="btn-primary" disabled={!!busy || !meta?.migrated} onClick={() => save(e.key)}>
                    {busy === `save:${e.key}` ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            );
          })}

          <p className="acl-hint">
            The admin API URL is where this console reads and writes accounts and licences (<code>/api/admin/*</code>);
            the app URL is the Traceability link on the Accounts list. Passwords are stored encrypted and never shown.
            There is no fallback between environments: if the active one does not answer, the Accounts list says so
            instead of reading another one.
          </p>
        </>
      )}
    </>
  );
}
