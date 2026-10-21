import { describe, expect, it } from 'vitest';
import { GenerationError } from './errors';
import { HiggsfieldProvider } from './higgsfield-provider';
import { MockProvider } from './mock-provider';
import type { GenerationProvider } from './provider';
import { canTransition, isTerminal } from './status';
import { createFakeHiggsfieldFetch } from './test-utils';
import type { GenerationJob } from './types';

type Harness = {
  name: string;
  create: () => { provider: GenerationProvider; advance: () => void };
};

const harnesses: Harness[] = [
  {
    name: 'MockProvider',
    create: () => {
      let now = 0;
      const provider = new MockProvider({ stepMs: 100, now: () => now });
      return { provider, advance: () => (now += 100) };
    },
  },
  {
    name: 'HiggsfieldProvider (sahte API)',
    create: () => {
      const fake = createFakeHiggsfieldFetch();
      const provider = new HiggsfieldProvider({
        keyId: 'id',
        keySecret: 'secret',
        models: {
          image: 'higgsfield-ai/soul/v2/standard',
          videoToVideo: 'higgsfield/genjutsu/motion-transfer/v1.0',
        },
        fetch: fake.fetch,
      });
      // Sahte API her status okumasında bir adım ilerler
      return { provider, advance: () => {} };
    },
  },
];

async function runToEnd(
  provider: GenerationProvider,
  advance: () => void,
  job: GenerationJob,
) {
  const seen = [job.status];
  let current = job;
  for (let i = 0; i < 10 && !isTerminal(current.status); i++) {
    advance();
    const next = await provider.getStatus(current.providerJobId);
    expect(canTransition(current.status, next.status)).toBe(true);
    seen.push(next.status);
    current = next;
  }
  return { final: current, seen };
}

describe.each(harnesses)('GenerationProvider sözleşmesi: $name', (h) => {
  it('görsel işi queued başlar, running üzerinden succeeded biter', async () => {
    const { provider, advance } = h.create();
    const job = await provider.generateImage({ prompt: 'portre, gün ışığı' });
    expect(job.status).toBe('queued');
    expect(job.outputs).toEqual([]);

    const { final, seen } = await runToEnd(provider, advance, job);
    expect(seen).toContain('running');
    expect(final.status).toBe('succeeded');
    expect(final.outputs).toHaveLength(1);
    expect(final.outputs[0]!.kind).toBe('image');
    expect(final.outputs[0]!.url).toMatch(/^https:\/\//);
    expect(final.error).toBeNull();
  });

  it('video-to-video işi video çıktısıyla biter', async () => {
    const { provider, advance } = h.create();
    const job = await provider.videoToVideo({
      videoUrl: 'https://cdn.example/source.mp4',
      imageUrls: ['https://cdn.example/ref.png'],
    });
    const { final } = await runToEnd(provider, advance, job);
    expect(final.status).toBe('succeeded');
    expect(final.outputs[0]!.kind).toBe('video');
  });

  it('başlamamış iş iptal edilebilir', async () => {
    const { provider } = h.create();
    const job = await provider.generateImage({ prompt: 'iptal edilecek' });
    const cancelled = await provider.cancel(job.providerJobId);
    expect(cancelled.status).toBe('cancelled');
  });

  it('başlamış iş iptal edilemez', async () => {
    const { provider, advance } = h.create();
    const job = await provider.generateImage({ prompt: 'başladı' });
    advance();
    const running = await provider.getStatus(job.providerJobId);
    expect(running.status).toBe('running');
    await expect(provider.cancel(job.providerJobId)).rejects.toMatchObject({
      code: 'not_cancelable',
    });
  });

  it('geçersiz istek sağlayıcıya gitmeden reddedilir', async () => {
    const { provider } = h.create();
    await expect(
      provider.generateImage({ prompt: '  ' }),
    ).rejects.toBeInstanceOf(GenerationError);
    await expect(
      provider.videoToVideo({
        videoUrl: 'http://insecure.example/v.mp4',
        imageUrls: ['https://cdn.example/a.png'],
      }),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    await expect(
      provider.videoToVideo({
        videoUrl: 'https://cdn.example/v.mp4',
        imageUrls: Array.from(
          { length: 9 },
          (_, i) => `https://cdn.example/${i}.png`,
        ),
      }),
    ).rejects.toMatchObject({ code: 'invalid_request' });
  });

  it('bilinmeyen iş not_found döner', async () => {
    const { provider } = h.create();
    await expect(
      provider.getStatus('00000000-0000-4000-8000-999999999999'),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
