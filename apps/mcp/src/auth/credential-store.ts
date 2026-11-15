// Oturumun (yenileme token'ı) saklandığı yer: işletim sisteminin kimlik kasası.
//   macOS   → Keychain (`/usr/bin/security`)
//   Windows → Credential Manager (advapi32 CredWrite/CredRead, PowerShell üzerinden)
//   Linux   → Secret Service (`secret-tool`, libsecret)
// Kasa yoksa ya da erişilemiyorsa program DURUR; token düz dosyaya, ortam değişkenine ya da
// repoya yazılmaz (ADR 0004 → Karar 3).
//
// Arayüz bilerek küçüktür. Üretim makinesi programı (apps/worker, #211) aynı ihtiyaca sahiptir;
// oradaki giriş yazıldığında bu modül `packages/shared` ya da ortak bir pakete taşınıp iki
// program tarafından kullanılacak (docs/mcp-panel.md → "Planlanan birleştirme").
//
// Sır hiçbir zaman komut satırı argümanı olarak verilmez (süreç listesinde görünür); alt sürece
// standart girdiden yazılır.
import { spawn } from 'node:child_process';
import { ToolError } from '../lib/errors.ts';

export interface CredentialStore {
  /** Kasanın adı (durum çıktısı için). */
  readonly label: string;
  get(account: string): Promise<string | null>;
  set(account: string, secret: string): Promise<void>;
  delete(account: string): Promise<void>;
}

export class CredentialStoreError extends ToolError {
  constructor(message: string) {
    super('kasa_hatasi', message, {
      advice:
        'Kullanıcıya bildir: işletim sistemi kimlik kasasına erişilemiyor. Token düz dosyaya yazılmaz.',
    });
    this.name = 'CredentialStoreError';
  }
}

export const SERVICE_NAME = 'ai-influencer-mcp';
/** Windows Credential Manager blob sınırı 2560 bayttır; her kasada aynı sınırı uygularız. */
export const MAX_SECRET_BYTES = 2000;

const ACCOUNT = /^[A-Za-z0-9._:-]{1,120}$/;
const SERVICE = /^[A-Za-z0-9._-]{1,80}$/;

function assertNames(service: string, account: string): void {
  if (!SERVICE.test(service) || !ACCOUNT.test(account)) {
    throw new CredentialStoreError('Kasa kaydı adı geçersiz.');
  }
}

function encode(secret: string): string {
  const encoded = Buffer.from(secret, 'utf8').toString('base64');
  if (Buffer.byteLength(encoded) > MAX_SECRET_BYTES) {
    throw new CredentialStoreError('Saklanacak değer kasa sınırını aşıyor.');
  }
  return encoded;
}

function decode(encoded: string): string | null {
  const trimmed = encoded.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) return null;
  return Buffer.from(trimmed, 'base64').toString('utf8');
}

type RunResult = { code: number | null; stdout: string; stderr: string };

function run(
  command: string,
  args: readonly string[],
  stdin?: string,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));
    child.on('error', () =>
      reject(
        new CredentialStoreError(
          'İşletim sistemi kimlik kasası aracı çalıştırılamadı. Token düz dosyaya yazılmaz.',
        ),
      ),
    );
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.on('error', () => {});
    child.stdin.end(stdin ?? '');
  });
}

/** Kasa aracının hata çıktısı sır içerebilir; dışarı yalnız çıkış kodu verilir. */
function failure(action: string, result: RunResult): CredentialStoreError {
  return new CredentialStoreError(
    `İşletim sistemi kasası ${action} (çıkış kodu ${result.code ?? '?'}).`,
  );
}

// ── macOS ────────────────────────────────────────────────────────────────────
const SECURITY = '/usr/bin/security';
const KEYCHAIN_NOT_FOUND = 44;

export function createKeychainStore(
  service: string = SERVICE_NAME,
): CredentialStore {
  return {
    label: 'macOS Keychain',
    async get(account) {
      assertNames(service, account);
      const result = await run(SECURITY, [
        'find-generic-password',
        '-a',
        account,
        '-s',
        service,
        '-w',
      ]);
      if (result.code === KEYCHAIN_NOT_FOUND) return null;
      if (result.code !== 0) throw failure('okunamadı', result);
      return decode(result.stdout);
    },
    async set(account, secret) {
      assertNames(service, account);
      // `security -i` komutu standart girdiden okur: sır argüman listesine girmez. Değer
      // base64'tür, adlar yukarıda doğrulanmıştır; satırda kaçış gerektiren karakter olamaz.
      const result = await run(
        SECURITY,
        ['-i'],
        `add-generic-password -U -a ${account} -s ${service} -l ${service} -w ${encode(secret)}\n`,
      );
      if (result.code !== 0) throw failure('yazılamadı', result);
      // `-i` kipinde alt komutun hatası çıkış koduna yansımayabilir: geri okuyup doğrula.
      if ((await this.get(account)) !== secret) {
        throw new CredentialStoreError('İşletim sistemi kasası yazılamadı.');
      }
    },
    async delete(account) {
      assertNames(service, account);
      const result = await run(SECURITY, [
        'delete-generic-password',
        '-a',
        account,
        '-s',
        service,
      ]);
      if (result.code !== 0 && result.code !== KEYCHAIN_NOT_FOUND) {
        throw failure('silinemedi', result);
      }
    },
  };
}

// ── Windows ──────────────────────────────────────────────────────────────────
const POWERSHELL_PRELUDE = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -Namespace AiInfluencer -Name Vault -MemberDefinition @'
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct CREDENTIAL {
  public uint Flags;
  public uint Type;
  public string TargetName;
  public string Comment;
  public long LastWritten;
  public uint CredentialBlobSize;
  public IntPtr CredentialBlob;
  public uint Persist;
  public uint AttributeCount;
  public IntPtr Attributes;
  public string TargetAlias;
  public string UserName;
}
[DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool CredWrite(ref CREDENTIAL credential, uint flags);
[DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
[DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool CredDelete(string target, uint type, uint flags);
[DllImport("advapi32.dll")]
public static extern void CredFree(IntPtr credential);
'@
$notFound = 1168
`;

function powershellScript(
  action: 'get' | 'set' | 'delete',
  target: string,
): string {
  // target yalnız [A-Za-z0-9._:-] içerir (doğrulanmış): tek tırnak içinde güvenlidir. Betik sır
  // içermez; saklanacak değer betiğe standart girdiden gelir.
  const head = `${POWERSHELL_PRELUDE}\n$target = '${target}'\n`;
  if (action === 'get') {
    return `${head}
$ptr = [IntPtr]::Zero
if (-not [AiInfluencer.Vault]::CredRead($target, 1, 0, [ref]$ptr)) {
  $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  if ($code -eq $notFound) { [Console]::Out.Write('NOTFOUND'); exit 0 }
  exit 3
}
try {
  $cred = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][AiInfluencer.Vault+CREDENTIAL])
  $bytes = New-Object byte[] $cred.CredentialBlobSize
  [Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $bytes, 0, $bytes.Length)
  [Console]::Out.Write('VALUE:' + [Text.Encoding]::ASCII.GetString($bytes))
} finally { [AiInfluencer.Vault]::CredFree($ptr) }
`;
  }
  if (action === 'set') {
    return `${head}
$bytes = [Text.Encoding]::ASCII.GetBytes([Console]::In.ReadToEnd().Trim())
if ($bytes.Length -eq 0) { exit 4 }
$cred = New-Object 'AiInfluencer.Vault+CREDENTIAL'
$cred.Type = 1
$cred.TargetName = $target
$cred.UserName = '${SERVICE_NAME}'
$cred.Persist = 2
$cred.CredentialBlobSize = $bytes.Length
$cred.CredentialBlob = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
try {
  [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $cred.CredentialBlob, $bytes.Length)
  if (-not [AiInfluencer.Vault]::CredWrite([ref]$cred, 0)) { exit 3 }
} finally { [Runtime.InteropServices.Marshal]::FreeHGlobal($cred.CredentialBlob) }
`;
  }
  return `${head}
if (-not [AiInfluencer.Vault]::CredDelete($target, 1, 0)) {
  $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  if ($code -ne $notFound) { exit 3 }
}
`;
}

export function createWindowsCredentialStore(
  service: string = SERVICE_NAME,
): CredentialStore {
  // Betik `-EncodedCommand` ile verilir (çok satırlı betik stdin'den güvenilir okunmaz); sır
  // betikte değildir, standart girdiden yazılır: süreç argümanlarında görünmez.
  const exec = async (script: string, stdin?: string) =>
    run(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(script, 'utf16le').toString('base64'),
      ],
      stdin,
    );
  const targetOf = (account: string) => {
    assertNames(service, account);
    return `${service}:${account}`;
  };
  return {
    label: 'Windows Credential Manager',
    async get(account) {
      const result = await exec(powershellScript('get', targetOf(account)));
      if (result.code !== 0) throw failure('okunamadı', result);
      const out = result.stdout.trim();
      if (out === 'NOTFOUND') return null;
      if (!out.startsWith('VALUE:')) throw failure('okunamadı', result);
      return decode(out.slice('VALUE:'.length));
    },
    async set(account, secret) {
      const result = await exec(
        powershellScript('set', targetOf(account)),
        encode(secret),
      );
      if (result.code !== 0) throw failure('yazılamadı', result);
    },
    async delete(account) {
      const result = await exec(powershellScript('delete', targetOf(account)));
      if (result.code !== 0) throw failure('silinemedi', result);
    },
  };
}

// ── Linux ────────────────────────────────────────────────────────────────────
export function createSecretToolStore(
  service: string = SERVICE_NAME,
): CredentialStore {
  const attrs = (account: string) => {
    assertNames(service, account);
    return ['service', service, 'account', account];
  };
  const exec = (args: readonly string[], stdin?: string) =>
    run('secret-tool', args, stdin);
  return {
    label: 'Secret Service (libsecret)',
    async get(account) {
      const result = await exec(['lookup', ...attrs(account)]);
      // secret-tool kayıt yoksa 1 döndürür ve bir şey yazmaz.
      if (result.code !== 0) return null;
      return result.stdout ? decode(result.stdout) : null;
    },
    async set(account, secret) {
      const result = await exec(
        ['store', `--label=${service}`, ...attrs(account)],
        encode(secret),
      );
      if (result.code !== 0) throw failure('yazılamadı', result);
    },
    async delete(account) {
      await exec(['clear', ...attrs(account)]);
    },
  };
}

/** Testler için: bellekte tutar, hiçbir yere yazmaz. */
export function createMemoryStore(): CredentialStore & {
  readonly entries: Map<string, string>;
} {
  const entries = new Map<string, string>();
  return {
    label: 'bellek (test)',
    entries,
    async get(account) {
      return entries.get(account) ?? null;
    },
    async set(account, secret) {
      encode(secret);
      entries.set(account, secret);
    },
    async delete(account) {
      entries.delete(account);
    },
  };
}

export function createPlatformStore(
  platform: NodeJS.Platform = process.platform,
): CredentialStore {
  if (platform === 'darwin') return createKeychainStore();
  if (platform === 'win32') return createWindowsCredentialStore();
  if (platform === 'linux') return createSecretToolStore();
  throw new CredentialStoreError(
    `Bu işletim sisteminde (${platform}) desteklenen bir kimlik kasası yok.`,
  );
}
