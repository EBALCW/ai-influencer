#!/usr/bin/env node
// Üretim makinesi yetenek denetimi (#212). Kullanım: pnpm worker:doctor [--json] [--require a,b]
// Makinedeki araçları yoklar, hangi üretim yollarının çalışabileceğini söyler ve eksikler için
// işletim sistemine göre kurulum yönergesi verir. Hiçbir şey kurmaz.
import os from 'node:os';
import { collectChecks, collectSystem, hostContext } from './checks.ts';
import { EXIT } from './lib/capabilities.ts';
import {
  HELP,
  UsageError,
  buildReport,
  formatReport,
  parseArgs,
  redactReport,
  reportExitCode,
} from './lib/report.ts';

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return EXIT.ok;
  }
  const ctx = hostContext();
  const [checks, system] = await Promise.all([
    collectChecks(ctx),
    collectSystem(ctx),
  ]);
  // Repo herkese açık ve çıktı issue'ya yapıştırılıyor: ev klasörü her yerde `~` olur
  // (HOME ortam değişkeni değiştirilmişse hesabın asıl ev klasörü de gizlenir)
  let report = redactReport(
    buildReport(checks, system),
    ctx.home,
    ctx.platform,
  );
  try {
    report = redactReport(report, os.userInfo().homedir, ctx.platform);
  } catch {
    // bazı kapsayıcılarda kullanıcı kaydı yok
  }
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else
    console.log(
      formatReport(report, {
        color: Boolean(process.stdout.isTTY) && !process.env.NO_COLOR,
        required: options.require,
      }),
    );
  return reportExitCode(report, options.require);
}

let code: number;
try {
  code = await main();
} catch (error) {
  if (error instanceof UsageError) console.error(`${error.message}\n\n${HELP}`);
  else console.error('Denetim beklenmeyen bir hatayla durdu:', error);
  code = EXIT.error;
}
// Süresi dolup bırakılan süreçler çıkışı bekletmesin
process.exitCode = code;
process.stdout.write('', () => process.exit(code));
