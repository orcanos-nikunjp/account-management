/**
 * POST /api/settings/trace-environment/test — log in to one region of one traceability
 * environment and count its accounts. Works for any environment, active or not, so AWS can be
 * checked before switching to it.
 *
 * Body: { env, region, api_url?, admin_password? } — the typed values from the form, if any.
 *
 * ⚠️ A STORED password is only ever sent to the STORED URL. Without a typed password, a typed URL
 * that differs from the stored one is refused — otherwise this route would hand a saved admin
 * password to any host a caller types (same rule as POST /api/orcanos/test-login).
 *
 * Audited as `trace_environment_tested` (no secrets). Staff only.
 */

import { requirePlatformStaff } from '@/lib/session';
import { logSecurityEvent } from '@/lib/audit';
import { loadStoredTraceEnvs, resolveEnv } from '@/lib/trace-env';
import { isTraceEnvKey, normaliseUrl } from '@/lib/trace-env-key';
import { parseRegion } from '@/lib/regions';
import { testTraceInstance } from '@/lib/trace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { user, error } = await requirePlatformStaff();
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as {
    env?: unknown;
    region?: unknown;
    api_url?: unknown;
    admin_password?: unknown;
  };
  if (!isTraceEnvKey(body.env)) return Response.json({ detail: 'Unknown environment.' }, { status: 400 });
  const region = parseRegion(body.region);
  if (!region) return Response.json({ detail: "region must be 'us' or 'eu'." }, { status: 400 });

  const typedUrl = normaliseUrl(body.api_url);
  if (typedUrl === null) return Response.json({ detail: 'The admin API URL is not a valid http(s) URL.' }, { status: 400 });
  const typedPassword = typeof body.admin_password === 'string' ? body.admin_password : '';

  const { stored } = await loadStoredTraceEnvs();
  const resolved = resolveEnv(stored, body.env).regions[region];
  const url = typedUrl || resolved.api_url;
  if (!url) return Response.json({ detail: 'No admin API URL to test.' }, { status: 400 });

  let password = typedPassword;
  if (!password) {
    if (url !== resolved.api_url) {
      return Response.json(
        { detail: 'Type the admin password to test a URL that is not saved yet — a saved password is only sent to its saved URL.' },
        { status: 400 },
      );
    }
    password = resolved.password ?? '';
  }
  if (!password) return Response.json({ detail: 'No admin password to test with.' }, { status: 400 });

  const result = await testTraceInstance(region, url, password);
  await logSecurityEvent('trace_environment_tested', {
    user,
    detail: { env: body.env, region, url, ok: result.ok, ...(result.ok ? { accounts: result.accounts } : { error: result.error }) },
  });
  return Response.json({ url, ...result });
}
