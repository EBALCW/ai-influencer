/**
 * Higgsfield REST API'sini bellek içinde taklit eden fetch (sadece testler).
 * Belgelenmiş davranış: gönderim queued döner, her status okuması işi bir
 * adım ilerletir (in_progress → completed/failed/nsfw), cancel sadece hiç
 * okunmamış (queued) işte 202, aksi halde 400.
 */
export function createFakeHiggsfieldFetch(
  options: { finalStatus?: 'completed' | 'failed' | 'nsfw' } = {},
) {
  type Job = { id: string; reads: number; canceled: boolean; video: boolean };
  const jobs = new Map<string, Job>();
  const calls: {
    method: string;
    url: string;
    headers: Headers;
    body: unknown;
  }[] = [];
  let counter = 0;

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const view = (job: Job) => {
    const steps = ['queued', 'in_progress', options.finalStatus ?? 'completed'];
    const status = job.canceled
      ? 'canceled'
      : steps[Math.min(job.reads, steps.length - 1)];
    const base = {
      request_id: job.id,
      status,
      status_url: `https://api.higgsfield.ai/requests/${job.id}/status`,
      cancel_url: `https://api.higgsfield.ai/requests/${job.id}/cancel`,
    };
    if (status !== 'completed') return base;
    return job.video
      ? { ...base, video: { url: `https://cdn.example/${job.id}.mp4` } }
      : {
          ...base,
          images: [
            {
              url: `https://cdn.example/${job.id}.png`,
              content_type: 'image/png',
            },
          ],
        };
  };

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url: url.toString(), headers, body });

    if (!headers.get('Authorization')?.startsWith('Key ')) {
      return json(401, { detail: 'Invalid credentials' });
    }

    const status = url.pathname.match(/^\/requests\/([^/]+)\/status$/);
    if (status && method === 'GET') {
      const job = jobs.get(status[1]!);
      if (!job) return json(404, { detail: 'Not found' });
      job.reads += 1;
      return json(200, view(job));
    }

    const cancel = url.pathname.match(/^\/requests\/([^/]+)\/cancel$/);
    if (cancel && method === 'POST') {
      const job = jobs.get(cancel[1]!);
      if (!job) return json(404, { detail: 'Not found' });
      if (job.reads > 0 && !job.canceled) {
        return json(400, { detail: 'Already started' });
      }
      job.canceled = true;
      return new Response(null, { status: 202 });
    }

    if (method === 'POST') {
      counter += 1;
      const job: Job = {
        id: `00000000-0000-4000-8000-${counter.toString().padStart(12, '0')}`,
        reads: 0,
        canceled: false,
        video: url.pathname.includes('motion-transfer'),
      };
      jobs.set(job.id, job);
      return json(200, view(job));
    }

    return json(404, { detail: 'Not found' });
  };

  return { fetch: fetchImpl, calls };
}
