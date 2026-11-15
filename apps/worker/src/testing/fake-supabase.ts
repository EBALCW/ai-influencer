// Testler için sahte Supabase sunucusu (Auth yenileme, makine RPC'leri, Storage yükleme).
// Windows CI'da Docker/Supabase yoktur: programın başlat-durdur duman testi buna karşı çalışır.
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ApiError } from '../lib/errors.ts';
import { createFakeApi } from './fake-api.ts';

function fakeJwt(claims: Record<string, unknown>): string {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'none' })}.${part(claims)}.sahte-imza`;
}

async function readBody(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  try {
    const parsed: unknown = JSON.parse(
      Buffer.concat(chunks).toString('utf8') || '{}',
    );
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function startFakeSupabase(initialRefreshToken: string) {
  const queue = createFakeApi();
  const state = {
    refreshToken: initialRefreshToken,
    rotations: 0,
    sessionAlive: true,
    uploads: [] as string[],
    logouts: 0,
    /** Giriş: bu e-posta + parola ya da e-postadaki bu özet/kod kabul edilir. */
    login: {
      email: 'uye@ornek.com',
      password: 'dogru-parola',
      tokenHash: '',
      code: '',
    },
    emailsSent: [] as string[],
    requests: [] as string[],
  };
  const access = () =>
    fakeJwt({
      sub: '22222222-2222-4222-8222-222222222222',
      session_id: '33333333-3333-4333-8333-333333333333',
      role: 'authenticated',
      n: state.rotations,
    });

  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      state.requests.push(`${request.method} ${url.pathname}`);
      const send = (status: number, body: unknown) => {
        response.writeHead(status, { 'Content-Type': 'application/json' });
        response.end(body === undefined ? '' : JSON.stringify(body));
      };
      try {
        const issue = () => {
          state.rotations += 1;
          state.sessionAlive = true;
          state.refreshToken = `yenileme-${state.rotations}`;
          return send(200, {
            access_token: access(),
            refresh_token: state.refreshToken,
            expires_in: 3600,
            token_type: 'bearer',
          });
        };
        if (url.pathname === '/auth/v1/otp') {
          const body = await readBody(request);
          if (body.email !== state.login.email || body.create_user !== false)
            return send(422, { error_code: 'otp_disabled' });
          state.emailsSent.push(String(body.email));
          state.login.tokenHash = `pkce_${'ab'.repeat(20)}${state.emailsSent.length}`;
          state.login.code = String(100000 + state.emailsSent.length);
          return send(200, {});
        }
        if (url.pathname === '/auth/v1/verify') {
          const body = await readBody(request);
          const ok =
            (state.login.tokenHash !== '' &&
              body.token_hash === state.login.tokenHash) ||
            (state.login.code !== '' &&
              body.token === state.login.code &&
              body.email === state.login.email);
          if (!ok) return send(403, { error_code: 'otp_expired' });
          // Tek kullanımlık
          state.login.tokenHash = '';
          state.login.code = '';
          return issue();
        }
        if (
          url.pathname === '/auth/v1/token' &&
          url.searchParams.get('grant_type') === 'password'
        ) {
          const body = await readBody(request);
          if (
            body.email !== state.login.email ||
            body.password !== state.login.password
          )
            return send(400, { error_code: 'invalid_credentials' });
          return issue();
        }
        if (url.pathname === '/auth/v1/token') {
          const body = await readBody(request);
          if (!state.sessionAlive || body.refresh_token !== state.refreshToken)
            return send(400, { error_code: 'refresh_token_not_found' });
          state.rotations += 1;
          state.refreshToken = `yenileme-${state.rotations}`;
          return send(200, {
            access_token: access(),
            refresh_token: state.refreshToken,
            expires_in: 3600,
            token_type: 'bearer',
          });
        }
        if (url.pathname === '/auth/v1/logout') {
          state.logouts += 1;
          state.sessionAlive = false;
          return send(204, undefined);
        }
        if (url.pathname.startsWith('/storage/v1/object/productions/')) {
          for await (const chunk of request) void chunk;
          state.uploads.push(
            url.pathname.slice('/storage/v1/object/productions/'.length),
          );
          return send(200, { Key: 'ok' });
        }
        if (url.pathname === '/rest/v1/production_workers')
          return send(200, queue.state.worker ? [queue.state.worker] : []);
        if (url.pathname.startsWith('/rest/v1/rpc/')) {
          const name = url.pathname.slice('/rest/v1/rpc/'.length);
          const args = await readBody(request);
          const text = (key: string) => String(args[key] ?? '');
          const api = queue.api;
          switch (name) {
            case 'register_worker':
              return send(
                200,
                await api.registerWorker({
                  name: text('p_name'),
                  platform: text('p_platform'),
                  version: text('p_version'),
                  capabilities: (args.p_capabilities as string[]) ?? [],
                }),
              );
            case 'worker_heartbeat':
              return send(200, await api.heartbeat(text('p_worker_id')));
            case 'claim_job': {
              const job = await api.claimJob(
                text('p_worker_id'),
                Number(args.p_lease_seconds),
              );
              return send(200, job ? [job] : []);
            }
            case 'start_stage':
              return send(
                200,
                await api.startStage(
                  text('p_worker_id'),
                  text('p_job_id'),
                  text('p_stage_key'),
                  Number(args.p_lease_seconds),
                ),
              );
            case 'report_progress':
              return send(
                200,
                await api.reportProgress(
                  text('p_worker_id'),
                  text('p_job_id'),
                  (args.p_progress as number | null) ?? null,
                  (args.p_detail as string | null) ?? null,
                  Number(args.p_lease_seconds),
                ),
              );
            case 'complete_stage':
              return send(
                200,
                await api.completeStage(
                  text('p_worker_id'),
                  text('p_job_id'),
                  text('p_stage_key'),
                  (args.p_output as Record<string, unknown>) ?? {},
                ),
              );
            case 'fail_stage':
              return send(
                200,
                await api.failStage(
                  text('p_worker_id'),
                  text('p_job_id'),
                  text('p_stage_key'),
                  text('p_error'),
                  args.p_retryable === true,
                ),
              );
            case 'acknowledge_cancel':
              return send(
                200,
                await api.acknowledgeCancel(
                  text('p_worker_id'),
                  text('p_job_id'),
                ),
              );
            case 'attach_job_output':
              return send(200, {});
            default:
              return send(404, { code: 'PGRST202', message: 'bilinmeyen RPC' });
          }
        }
        return send(404, { message: 'yok' });
      } catch (error) {
        if (error instanceof ApiError)
          return send(error.status, {
            code: error.code,
            hint: error.hint,
            message: error.message,
          });
        return send(500, { message: 'sahte sunucu hatası' });
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    account: `127.0.0.1:${port}`,
    queue,
    state,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
