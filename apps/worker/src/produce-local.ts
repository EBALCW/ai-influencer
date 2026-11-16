// Anlatım işleyicilerini kuyruk ve oturum olmadan bu bilgisayarda çalıştırır (#219, #220):
//   pnpm worker:produce-local <girdi.json> [--out <klasör>] [--keep]
// Girdi, panelin işe dondurduğu verinin aynısıdır:
//   { "params": <jobs.params / EpisodeJobParams>, "script_version": <episode_script_versions satırı> }
// Dört aşama (voice → captions → visuals → render) gerçek araçlarla sırayla çalışır; çıktılar
// yüklenmez, `--out` klasörüne yazılır. Supabase'e bağlanmaz, oturum ya da anahtar okumaz.
// edge-tts için internet gerekir.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JOB_KINDS } from '@ai-influencer/shared/jobs';
import { createExplainerRenderJob } from './handlers/explainer/index.ts';
import { defaultWorkDir } from './lib/config.ts';
import { createLogger } from './lib/log.ts';
import { safeErrorMessage } from './lib/redact.ts';
import { isSafeFileName, type StageContext } from './lib/registry.ts';
import { MAX_UPLOAD_BYTES } from './lib/runner.ts';
import { runProcess } from './lib/spawn.ts';

const USAGE =
  'Kullanım: pnpm worker:produce-local <girdi.json> [--out <klasör>] [--keep]\n' +
  '  girdi.json   { "params": …, "script_version": … } (örnek: apps/worker/examples/planor.json)\n' +
  '  --out        çıktı klasörü (varsayılan: ~/ai-influencer-films/panel-ornek/out)\n' +
  '  --keep       çalışma klasörünü silme (hata ayıklama)';

export async function produceLocal(
  argv: readonly string[],
  out: (line: string) => void,
): Promise<number> {
  const args = [...argv];
  const keep = args.includes('--keep');
  const outIndex = args.indexOf('--out');
  const outArg = outIndex >= 0 ? args[outIndex + 1] : undefined;
  const input = args.find(
    (arg, index) =>
      !arg.startsWith('--') && (outIndex < 0 || index !== outIndex + 1),
  );
  if (!input || (outIndex >= 0 && !outArg)) {
    out(USAGE);
    return 1;
  }
  const outDir = path.resolve(
    outArg ??
      path.join(os.homedir(), 'ai-influencer-films', 'panel-ornek', 'out'),
  );
  let payload: { params?: unknown; script_version?: unknown };
  try {
    payload = JSON.parse(
      await readFile(path.resolve(input), 'utf8'),
    ) as typeof payload;
  } catch {
    out('Girdi dosyası okunamadı ya da JSON değil.');
    return 1;
  }
  const job = createExplainerRenderJob();
  const parsed = job.params.safeParse(payload.params);
  if (!parsed.success) {
    out(
      `"params" şemaya uymuyor: ${parsed.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join('.') || '(kök)'}: ${issue.code}`)
        .join('; ')}`,
    );
    return 1;
  }
  const log = createLogger({ json: false, home: os.homedir(), write: out });
  const workDir = path.join(
    defaultWorkDir({
      platform:
        process.platform === 'win32'
          ? 'win32'
          : process.platform === 'darwin'
            ? 'darwin'
            : 'linux',
      home: os.homedir(),
      hostname: os.hostname(),
      tmpdir: os.tmpdir(),
      env: process.env,
    }),
    `yerel-${process.pid}`,
  );
  const abort = new AbortController();
  const onSignal = () => abort.abort();
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  await mkdir(workDir, { recursive: true });
  await mkdir(outDir, { recursive: true });
  let ok = false;
  try {
    for (const { key: stage } of JOB_KINDS['explainer.render'].stages) {
      const handler = job.stages[stage];
      if (!handler) throw new Error(`İşleyici yok: ${stage}`);
      const stageLog = log.child({ asama: stage });
      let last = -1;
      const context: StageContext<unknown> = {
        jobId: '00000000-0000-4000-8000-000000000000',
        kind: 'explainer.render',
        stage,
        params: parsed.data,
        workDir,
        signal: abort.signal,
        log: stageLog,
        maxUploadBytes: MAX_UPLOAD_BYTES,
        progress: (percent, detail) => {
          const rounded = Math.round(percent);
          if (rounded === last) return;
          last = rounded;
          stageLog.info('İlerleme', { yuzde: rounded, not: detail });
        },
        run: (file, runArgs, options) =>
          runProcess(file, runArgs, {
            ...options,
            cwd: options.cwd ?? workDir,
            signal: abort.signal,
          }),
        loadScript: async () => payload.script_version,
        attach: async (output) => {
          if (!isSafeFileName(output.fileName))
            throw new Error('Dosya adı geçersiz.');
          if (output.body.byteLength > MAX_UPLOAD_BYTES)
            throw new Error('Çıktı yükleme sınırını aşıyor.');
          await writeFile(path.join(outDir, output.fileName), output.body);
          stageLog.info('Çıktı yazıldı (çevrimdışı: yüklenmedi).', {
            dosya: output.fileName,
            rol: output.role,
            bayt: output.body.byteLength,
          });
        },
      };
      stageLog.info('Aşama başladı.');
      const result = await handler(context);
      stageLog.info('Aşama bitti.', { cikti: result ?? {} });
    }
    ok = true;
    out(
      `\nTamam. Çıktılar: ${outDir}\nPanelde bu noktada iş "onay bekliyor" olur: videoyu izleyip onaylarsınız.`,
    );
    return 0;
  } catch (error) {
    out(`Üretim durdu: ${safeErrorMessage(error, { home: os.homedir() })}`);
    return 1;
  } finally {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    if (ok && !keep)
      await rm(workDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    else out(`Çalışma klasörü yerinde: ${workDir}`);
  }
}

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invoked) {
  const code = await produceLocal(process.argv.slice(2), (line) =>
    console.log(line),
  );
  process.stdout.write('', () => process.exit(code));
}
