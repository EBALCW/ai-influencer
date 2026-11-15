// Sahte iş (#211): gerçek render yapmadan iş döngüsünü uçtan uca dener.
//   prepare  bekler, ilerleme yazar, güvenli alt süreç çalıştırır (node --version)
//   review   küçük bir metin dosyası üretir, yükler ve işe bağlar; ONAY bekler
//   finish   bekler ve işi kapatır
// Parametreler veridir: şemadan geçer, dosya adına ya da komuta katılmaz.
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { AbortedError, PermanentError, TransientError } from '../lib/errors.ts';
import { defineJobKind, type StageContext } from '../lib/registry.ts';

export const selftestParams = z
  .object({
    /** Her aşamadaki adım sayısı. */
    steps: z.number().int().min(1).max(50).default(3),
    /** Adım başına bekleme (ms). */
    stepMs: z.number().int().min(0).max(5000).default(200),
    /** Çıktı dosyasına yazılacak kısa not. */
    note: z.string().max(200).default(''),
    /** Hata yollarını denemek için: bu aşamada bilerek hata ver. */
    failAt: z.enum(['prepare', 'review', 'finish']).optional(),
    failMode: z.enum(['transient', 'permanent']).default('transient'),
  })
  .strict();
export type SelftestParams = z.infer<typeof selftestParams>;

type Context = StageContext<SelftestParams>;

async function work(context: Context, label: string): Promise<void> {
  const { steps, stepMs } = context.params;
  for (let step = 1; step <= steps; step++) {
    try {
      await delay(stepMs, undefined, { signal: context.signal });
    } catch {
      throw new AbortedError('İş durduruldu.');
    }
    context.progress((step / steps) * 100, `${label}: adım ${step}/${steps}`);
  }
}

function maybeFail(context: Context): void {
  if (context.params.failAt !== context.stage) return;
  if (context.params.failMode === 'permanent')
    throw new PermanentError('Deneme işi: istenen kalıcı hata.');
  throw new TransientError('Deneme işi: istenen geçici hata.');
}

export const selftestJob = defineJobKind<SelftestParams>({
  kind: 'clip.selftest',
  params: selftestParams,
  stages: {
    async prepare(context) {
      await work(context, 'hazırlık');
      maybeFail(context);
      const probe = await context.run(process.execPath, ['--version'], {
        timeoutMs: 20_000,
      });
      if (probe.aborted) throw new AbortedError('İş durduruldu.');
      if (probe.code !== 0)
        throw new TransientError('Alt süreç beklenen çıktıyı vermedi.');
      return {
        node: probe.stdout.trim().slice(0, 40),
        steps: context.params.steps,
      };
    },
    async review(context) {
      await work(context, 'çıktı');
      maybeFail(context);
      // Not veridir: yalnız dosyanın içine yazılır. Dosya adı sabittir.
      const text = [
        'AI Influencer üretim makinesi deneme çıktısı',
        `iş: ${context.jobId}`,
        `not: ${context.params.note.replace(/[\u0000-\u001f\u007f]/g, ' ')}`,
        '',
      ].join('\n');
      const body = new TextEncoder().encode(text);
      await context.attach({
        fileName: 'selftest.txt',
        body,
        contentType: 'text/plain',
        role: 'other',
      });
      return { artifact: 'selftest.txt', bytes: body.byteLength };
    },
    async finish(context) {
      await work(context, 'kapanış');
      maybeFail(context);
      return { ok: true };
    },
  },
});
