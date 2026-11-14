// Denetim raporu: argümanlar, sistem özeti ayrıştırıcıları, Türkçe tablo ve `--json` çıktısı.
// Saf fonksiyonlar; süreç çalıştırmaz, dosya okumaz.
import {
  CAPABILITY_REQUIREMENTS,
  CHECK_LABELS,
  WORKER_CAPABILITIES,
  deriveCapabilities,
  deriveRoutes,
  exitCode,
  type CheckResult,
  type MissingCapability,
  type RouteStatus,
  type WorkerCapability,
} from './capabilities.ts';
import { PLATFORM_LABELS } from './hints.ts';
import { redactHome, type Platform } from './locations.ts';

export const SCHEMA_VERSION = 1;

/** Boş disk bunun altındaysa uyarı verilir (render kareleri ve indirilen yayınlar yer tutar). */
export const LOW_DISK_GB = 10;

export interface SystemInfo {
  platform: Platform;
  arch: string;
  osRelease: string;
  cpu: string | null;
  cores: number;
  memoryGb: number;
  gpu: string[];
  diskFreeGb: number | null;
  diskLow: boolean;
}

/** `--json` çıktısının şeması (schemaVersion 1). Alan eklenebilir; var olan alan değişirse sürüm artar. */
export interface DoctorReport {
  schemaVersion: typeof SCHEMA_VERSION;
  /** En az bir üretim yolu tam mı? */
  ok: boolean;
  system: SystemInfo;
  checks: CheckResult[];
  /** Makinenin sahip olduğu yetenek anahtarları; iş kuyruğu bunlarla eşleşir. */
  capabilities: WorkerCapability[];
  missingCapabilities: MissingCapability[];
  routes: RouteStatus[];
}

export interface CliOptions {
  json: boolean;
  help: boolean;
  require: WorkerCapability[];
}

export class UsageError extends Error {}

export function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = { json: false, help: false, require: [] };
  const args = [...argv];
  while (args.length > 0) {
    const arg = args.shift() ?? '';
    if (arg === '--') continue;
    if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--require' || arg.startsWith('--require=')) {
      const value = arg.includes('=')
        ? arg.slice(arg.indexOf('=') + 1)
        : args.shift();
      if (!value || value.startsWith('--'))
        throw new UsageError(
          '--require bir yetenek listesi ister (ör. --require clip.cut,fetch.youtube).',
        );
      for (const key of value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)) {
        if (!(WORKER_CAPABILITIES as readonly string[]).includes(key))
          throw new UsageError(
            `Bilinmeyen yetenek: ${key}. Geçerli olanlar: ${WORKER_CAPABILITIES.join(', ')}`,
          );
        if (!options.require.includes(key as WorkerCapability))
          options.require.push(key as WorkerCapability);
      }
    } else throw new UsageError(`Bilinmeyen argüman: ${arg}`);
  }
  return options;
}

export const HELP = `Kullanım: pnpm worker:doctor [--json] [--require <yetenek,...>]

Bu makinenin hangi üretim yollarını çalıştırabildiğini denetler. Hiçbir şey kurmaz.

  --json                 Makine tarafından okunur çıktı (şema: docs/SETUP.md → Üretim makinesi)
  --require <a,b,...>    Listelenen yeteneklerden biri eksikse 3 ile çıkar
  --help                 Bu metin

Çıkış kodu: 0 en az bir üretim yolu tam · 2 hiçbir yol tam değil · 3 --require eksik · 1 hata
Yetenekler: ${WORKER_CAPABILITIES.join(', ')}`;

// --- Sistem özeti ayrıştırıcıları ---

/** macOS: `system_profiler SPDisplaysDataType -json` */
export function parseMacGpu(json: string): string[] {
  try {
    const data = JSON.parse(json) as {
      SPDisplaysDataType?: { sppci_model?: unknown; _name?: unknown }[];
    };
    return (data.SPDisplaysDataType ?? [])
      .map((gpu) => gpu.sppci_model ?? gpu._name)
      .filter(
        (name): name is string => typeof name === 'string' && name !== '',
      );
  } catch {
    return [];
  }
}

/** Satır başına bir ad veren çıktılar (PowerShell `Win32_VideoController`, `nvidia-smi`). */
export function parseGpuLines(output: string): string[] {
  return [
    ...new Set(
      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== '' && !/^(name|-+)$/i.test(line)),
    ),
  ];
}

/** Linux: `lspci` çıktısından ekran kartı satırları. */
export function parseLspciGpu(output: string): string[] {
  return parseGpuLines(
    output
      .split(/\r?\n/)
      .filter((line) => /(VGA compatible controller|3D controller)/i.test(line))
      .map((line) => line.replace(/^.*?controller:\s*/i, ''))
      .join('\n'),
  );
}

// --- Rapor ---

export function buildReport(
  checks: CheckResult[],
  system: SystemInfo,
): DoctorReport {
  const { available, unavailable } = deriveCapabilities(checks);
  const routes = deriveRoutes(available);
  return {
    schemaVersion: SCHEMA_VERSION,
    ok: routes.some((route) => route.ready),
    system,
    checks,
    capabilities: available,
    missingCapabilities: unavailable,
    routes,
  };
}

export function reportExitCode(
  report: DoctorReport,
  required: readonly WorkerCapability[],
): number {
  return exitCode(report.routes, report.capabilities, required);
}

/** Rapordaki her metinde ev klasörünü `~` yapar (yol, ayrıntı, yönerge). */
export function redactReport<T>(value: T, home: string, platform: Platform): T {
  if (typeof value === 'string') return redactHome(value, home, platform) as T;
  if (Array.isArray(value))
    return value.map((item) => redactReport(item, home, platform)) as T;
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        redactReport(item, home, platform),
      ]),
    ) as T;
  return value;
}

const STATUS_TEXT = {
  ok: 'var',
  missing: 'eksik',
  outdated: 'eski sürüm',
} as const;

export interface FormatOptions {
  color: boolean;
  required: readonly WorkerCapability[];
}

function table(rows: string[][]): string[] {
  const widths = rows[0]?.map((_, column) =>
    Math.max(...rows.map((row) => [...(row[column] ?? '')].length)),
  );
  return rows.map((row) =>
    row
      .map((cell, column) =>
        column === row.length - 1
          ? cell
          : cell + ' '.repeat((widths?.[column] ?? 0) - [...cell].length),
      )
      .join('  ')
      .trimEnd(),
  );
}

/** İnsan için Türkçe rapor. Girdi `redactReport`'tan geçmiş olmalıdır. */
export function formatReport(
  report: DoctorReport,
  options: FormatOptions,
): string {
  const paint = (code: number, text: string) =>
    options.color ? `\x1b[${code}m${text}\x1b[0m` : text;
  const { system } = report;
  const lines: string[] = [];

  lines.push(
    `Üretim makinesi denetimi: ${PLATFORM_LABELS[system.platform]} ${system.osRelease} (${system.arch})`,
  );
  lines.push(
    [
      `Sistem: ${system.cpu ?? 'işlemci bilinmiyor'}`,
      `${system.cores} çekirdek`,
      `${system.memoryGb} GB RAM`,
      `GPU: ${system.gpu.length > 0 ? system.gpu.join(', ') : 'bilinmiyor'}`,
      `boş disk: ${system.diskFreeGb === null ? 'bilinmiyor' : `${system.diskFreeGb} GB`}`,
    ].join(' · '),
  );
  if (system.diskLow)
    lines.push(
      paint(
        33,
        `Uyarı: boş disk ${LOW_DISK_GB} GB'ın altında; render kareleri ve indirilen yayınlar sığmayabilir.`,
      ),
    );
  lines.push('');

  const rows = [['Araç', 'Durum', 'Sürüm', 'Konum / not']];
  for (const check of report.checks) {
    const status =
      STATUS_TEXT[check.status] +
      (check.optional && check.status !== 'ok' ? ' (isteğe bağlı)' : '');
    const version =
      (check.version ?? '-') +
      (check.status === 'outdated' && check.required
        ? ` (gereken ${check.required})`
        : '');
    const note = [check.path, check.detail].filter(Boolean).join(' · ');
    rows.push([check.label, status, version, note || '-']);
  }
  const rendered = table(rows);
  lines.push(rendered[0] ?? '');
  lines.push('-'.repeat(Math.min(100, [...(rendered[0] ?? '')].length + 20)));
  report.checks.forEach((check, index) => {
    const line = rendered[index + 1] ?? '';
    lines.push(
      check.status === 'ok' ? line : paint(check.optional ? 33 : 31, line),
    );
  });

  const withHints = report.checks.filter(
    (check) => check.status !== 'ok' && check.hint,
  );
  if (withHints.length > 0) {
    lines.push('');
    lines.push(
      `Eksikler için kurulum (${PLATFORM_LABELS[system.platform]}; bu komut hiçbir şey kurmaz):`,
    );
    // Aynı yönerge birden çok denetimde geçebilir (ffmpeg, pip paketleri): bir kez yazılır
    const byHint = new Map<string, string[]>();
    for (const check of withHints) {
      const labels = byHint.get(check.hint ?? '') ?? [];
      labels.push(check.label);
      byHint.set(check.hint ?? '', labels);
    }
    for (const [hint, labels] of byHint)
      lines.push(`  ${labels.join(', ')}:`, `    ${hint}`);
  }

  lines.push('');
  lines.push(
    report.capabilities.length > 0
      ? `Bu makine şunları üretebilir: ${paint(32, report.capabilities.join(', '))}`
      : 'Bu makine şu an hiçbir yeteneğe sahip değil.',
  );
  if (report.missingCapabilities.length > 0)
    lines.push(
      `Üretemez: ${report.missingCapabilities
        .map(
          (item) =>
            `${item.key} (eksik: ${item.missing.map((id) => CHECK_LABELS[id]).join(', ')})`,
        )
        .join('; ')}`,
    );

  lines.push('');
  lines.push('Üretim yolları:');
  for (const route of report.routes)
    lines.push(
      route.ready
        ? `  ${paint(32, 'hazır')}        ${route.label}`
        : `  ${paint(31, 'hazır değil')}  ${route.label} (eksik yetenek: ${route.missing.join(', ')})`,
    );

  const missingRequired = options.required.filter(
    (key) => !report.capabilities.includes(key),
  );
  if (options.required.length > 0) {
    lines.push('');
    lines.push(
      missingRequired.length > 0
        ? paint(
            31,
            `İstenen yetenekler eksik: ${missingRequired
              .map(
                (key) =>
                  `${key} (${CAPABILITY_REQUIREMENTS[key]
                    .filter(
                      (id) =>
                        report.checks.find((check) => check.id === id)
                          ?.status !== 'ok',
                    )
                    .map((id) => CHECK_LABELS[id])
                    .join(', ')})`,
              )
              .join('; ')}`,
          )
        : `İstenen yeteneklerin hepsi var: ${options.required.join(', ')}`,
    );
  } else if (!report.ok) {
    lines.push('');
    lines.push(
      paint(
        31,
        'Hiçbir üretim yolu tam değil. Yukarıdaki yönergelerle eksikleri kur, sonra yeni bir terminalde tekrar çalıştır.',
      ),
    );
  }
  return lines.join('\n');
}
