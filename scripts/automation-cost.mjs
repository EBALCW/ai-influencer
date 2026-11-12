import { readFile } from 'node:fs/promises';
import { compareAutomation } from './lib/automation-cost.mjs';

try {
  if (process.argv.length !== 3)
    throw new Error('Kullanım: pnpm automation:report <özel-denemeler.json>');
  const input = await readFile(process.argv[2], 'utf8');
  if (Buffer.byteLength(input) > 2_000_000)
    throw new Error('Girdi en çok 2 MB olmalı.');
  const report = compareAutomation(JSON.parse(input));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  // JSON ayrıştırma hatası veya dosya yolu özel veri içerebilir.
  console.error(
    error instanceof SyntaxError || error.code
      ? 'Ölçüm dosyası okunamadı veya geçerli JSON değil.'
      : error.message,
  );
  process.exitCode = 1;
}
