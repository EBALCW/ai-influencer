// Yenileme token'ının işletim sistemi kasasında saklanması (ADR 0004 → Karar 3).
//   macOS    Keychain            /usr/bin/security
//   Windows  Credential Manager  PowerShell + advapi32 (CredWrite / CredRead / CredDelete)
//   Linux    Secret Service      secret-tool (libsecret)
// Ek paket yok: yalnız işletim sisteminin kendi araçları, tam yolla ve kabuksuz çalıştırılır.
// Sır hiçbir zaman komut satırı argümanı olmaz (süreç listesinde görünmesin): stdin'den verilir.
// Kasa yoksa program token'ı SAKLAMAZ; düz dosyaya düşme yolu yoktur.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const CREDENTIAL_SERVICE = 'ai-influencer-worker';

export type StorePlatform = 'darwin' | 'win32' | 'linux';

export class CredentialStoreError extends Error {
  override name = 'CredentialStoreError';
}

export interface CredentialStore {
  /** Kullanıcıya gösterilecek ad (ör. "macOS Keychain"). */
  readonly label: string;
  available(): Promise<{ ok: true } | { ok: false; reason: string }>;
  get(account: string): Promise<string | null>;
  set(account: string, secret: string): Promise<void>;
  delete(account: string): Promise<void>;
}

/** Hesap adı: Supabase sunucu adı (ör. `abc.supabase.co`, `127.0.0.1:54321`). */
const ACCOUNT = /^[A-Za-z0-9._:-]{1,200}$/;
/**
 * Saklanabilir sır: Supabase yenileme token'ının alfabesi. Tırnak, boşluk ve satır sonu
 * içeremediği için hiçbir aracın satır/argüman ayrıştırıcısını şaşırtamaz.
 */
const SECRET = /^[A-Za-z0-9._~+/=-]{1,2048}$/;

export function assertAccount(account: string): void {
  if (!ACCOUNT.test(account))
    throw new CredentialStoreError('Kasa hesap adı geçersiz.');
}

export function assertStorableSecret(secret: string): void {
  if (!SECRET.test(secret))
    throw new CredentialStoreError(
      'Token beklenmeyen karakter içeriyor; kasaya yazılmadı.',
    );
}

export interface StoreCommand {
  file: string;
  args: string[];
  /** stdin'e yazılacak metin (sır burada taşınır). */
  stdin?: string;
  env?: Record<string, string>;
  /** "Kayıt yok" anlamına gelen çıkış kodları. */
  notFoundCodes?: number[];
}

// ── macOS ────────────────────────────────────────────────────────────────────
const SECURITY = '/usr/bin/security';

export function macCommands(account: string) {
  assertAccount(account);
  return {
    get: (): StoreCommand => ({
      file: SECURITY,
      args: [
        'find-generic-password',
        '-a',
        account,
        '-s',
        CREDENTIAL_SERVICE,
        '-w',
      ],
      notFoundCodes: [44],
    }),
    // `security -i` komutu stdin'den okur: sır argüman listesine girmez.
    set: (secret: string): StoreCommand => {
      assertStorableSecret(secret);
      return {
        file: SECURITY,
        args: ['-i'],
        stdin: `add-generic-password -U -a "${account}" -s "${CREDENTIAL_SERVICE}" -l "AI Influencer üretim makinesi" -w "${secret}"\n`,
      };
    },
    delete: (): StoreCommand => ({
      file: SECURITY,
      args: [
        'delete-generic-password',
        '-a',
        account,
        '-s',
        CREDENTIAL_SERVICE,
      ],
      notFoundCodes: [44],
    }),
  };
}

// ── Windows ──────────────────────────────────────────────────────────────────
/**
 * Credential Manager'a erişen PowerShell betiği. Sabittir (girdi içermez): hedef adı ve işlem
 * ortam değişkeniyle, sır stdin ile verilir. Çıkış: 0 tamam, 3 kayıt yok, 1 hata.
 */
export const WINDOWS_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$target = $env:AIW_CRED_TARGET
$action = $env:AIW_CRED_ACTION
if (-not $target -or -not $action) { exit 1 }
Add-Type -Namespace AIW -Name Cred -MemberDefinition @'
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
private struct CREDENTIAL {
  public uint Flags; public uint Type; public string TargetName; public string Comment;
  public long LastWritten; public uint CredentialBlobSize; public IntPtr CredentialBlob;
  public uint Persist; public uint AttributeCount; public IntPtr Attributes;
  public string TargetAlias; public string UserName;
}
[DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
private static extern bool CredWrite(ref CREDENTIAL credential, uint flags);
[DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
[DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
private static extern bool CredDelete(string target, uint type, uint flags);
[DllImport("advapi32.dll")]
private static extern void CredFree(IntPtr buffer);
private const int NotFound = 1168;

public static int Write(string target, string secret) {
  byte[] blob = System.Text.Encoding.Unicode.GetBytes(secret);
  IntPtr memory = Marshal.AllocHGlobal(blob.Length);
  try {
    Marshal.Copy(blob, 0, memory, blob.Length);
    CREDENTIAL credential = new CREDENTIAL();
    credential.Type = 1;
    credential.TargetName = target;
    credential.Comment = "AI Influencer uretim makinesi";
    credential.CredentialBlobSize = (uint)blob.Length;
    credential.CredentialBlob = memory;
    credential.Persist = 2;
    credential.UserName = "ai-influencer-worker";
    return CredWrite(ref credential, 0) ? 0 : 1;
  } finally {
    Marshal.FreeHGlobal(memory);
  }
}
public static int Read(string target, out string secret) {
  secret = null;
  IntPtr pointer;
  if (!CredRead(target, 1, 0, out pointer))
    return Marshal.GetLastWin32Error() == NotFound ? 3 : 1;
  try {
    CREDENTIAL credential = (CREDENTIAL)Marshal.PtrToStructure(pointer, typeof(CREDENTIAL));
    secret = Marshal.PtrToStringUni(credential.CredentialBlob, (int)credential.CredentialBlobSize / 2);
    return 0;
  } finally {
    CredFree(pointer);
  }
}
public static int Delete(string target) {
  if (CredDelete(target, 1, 0)) return 0;
  return Marshal.GetLastWin32Error() == NotFound ? 3 : 1;
}
'@
if ($action -eq 'set') {
  $secret = [Console]::In.ReadLine()
  if (-not $secret) { exit 1 }
  $code = [AIW.Cred]::Write($target, $secret)
  exit $code
}
if ($action -eq 'get') {
  $secret = $null
  $code = [AIW.Cred]::Read($target, [ref]$secret)
  if ($code -eq 0) { [Console]::Out.Write($secret) }
  exit $code
}
if ($action -eq 'delete') {
  $code = [AIW.Cred]::Delete($target)
  exit $code
}
exit 1
`;

export function windowsPowerShellPath(
  env: Record<string, string | undefined>,
): string {
  const root = env.SystemRoot || env.SYSTEMROOT || env.windir || 'C:\\Windows';
  return path.win32.join(
    root,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
}

export function windowsCommands(
  account: string,
  env: Record<string, string | undefined>,
) {
  assertAccount(account);
  const base = (action: 'get' | 'set' | 'delete'): StoreCommand => ({
    file: windowsPowerShellPath(env),
    args: [
      '-NoProfile',
      '-NonInteractive',
      '-NoLogo',
      '-ExecutionPolicy',
      'Bypass',
      '-EncodedCommand',
      Buffer.from(WINDOWS_SCRIPT, 'utf16le').toString('base64'),
    ],
    env: {
      AIW_CRED_TARGET: `${CREDENTIAL_SERVICE}:${account}`,
      AIW_CRED_ACTION: action,
    },
    notFoundCodes: [3],
  });
  return {
    get: (): StoreCommand => base('get'),
    set: (secret: string): StoreCommand => {
      assertStorableSecret(secret);
      return { ...base('set'), stdin: `${secret}\n` };
    },
    delete: (): StoreCommand => base('delete'),
  };
}

// ── Linux ────────────────────────────────────────────────────────────────────
export function linuxCommands(account: string, secretTool: string) {
  assertAccount(account);
  const attributes = ['service', CREDENTIAL_SERVICE, 'account', account];
  return {
    get: (): StoreCommand => ({
      file: secretTool,
      args: ['lookup', ...attributes],
      notFoundCodes: [1],
    }),
    set: (secret: string): StoreCommand => {
      assertStorableSecret(secret);
      return {
        file: secretTool,
        args: ['store', '--label=AI Influencer üretim makinesi', ...attributes],
        stdin: secret,
      };
    },
    delete: (): StoreCommand => ({
      file: secretTool,
      args: ['clear', ...attributes],
      notFoundCodes: [1],
    }),
  };
}

/** `secret-tool`'u yalnız bilinen sistem klasörlerinde arar (PATH'e güvenilmez). */
export function findSecretTool(
  exists: (file: string) => boolean = existsSync,
): string | null {
  for (const dir of ['/usr/bin', '/usr/local/bin', '/bin']) {
    const file = path.posix.join(dir, 'secret-tool');
    if (exists(file)) return file;
  }
  return null;
}

// ── Çalıştırma ───────────────────────────────────────────────────────────────
export interface StoreRunResult {
  code: number | null;
  stdout: string;
  timedOut: boolean;
}

export type StoreRunner = (command: StoreCommand) => Promise<StoreRunResult>;

/** Kabuksuz çalıştırır; çıktı ve hata metni loglanmaz (sır içerebilir). */
export const runStoreCommand: StoreRunner = (command) =>
  new Promise((resolve) => {
    let stdout = '';
    let settled = false;
    const finish = (result: Omit<StoreRunResult, 'stdout'>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, stdout });
    };
    let child;
    try {
      child = spawn(command.file, command.args, {
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
        shell: false,
        env: { ...process.env, ...command.env },
      });
    } catch {
      resolve({ code: null, stdout: '', timedOut: false });
      return;
    }
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // süreç zaten bitmiş olabilir
      }
      finish({ code: null, timedOut: true });
    }, 30_000);
    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdout.length < 16_384) stdout += chunk.toString('utf8');
    });
    child.on('error', () => finish({ code: null, timedOut: false }));
    child.on('close', (code) => finish({ code, timedOut: false }));
    child.stdin?.on('error', () => undefined);
    child.stdin?.end(command.stdin ?? '');
  });

interface Commands {
  get(): StoreCommand;
  set(secret: string): StoreCommand;
  delete(): StoreCommand;
}

function commandStore(
  label: string,
  commandsFor: (account: string) => Commands,
  available: CredentialStore['available'],
  run: StoreRunner,
): CredentialStore {
  const fail = (action: string): never => {
    throw new CredentialStoreError(`${label}: ${action} başarısız.`);
  };
  return {
    label,
    available,
    async get(account) {
      const command = commandsFor(account).get();
      const result = await run(command);
      if (result.code !== null && command.notFoundCodes?.includes(result.code))
        return null;
      if (result.code !== 0) fail('okuma');
      const secret = result.stdout.replace(/\r?\n$/, '');
      if (secret === '') return null;
      // Kasadaki değer bizim yazdığımız biçimde değilse kullanılmaz
      return SECRET.test(secret) ? secret : fail('okuma');
    },
    async set(account, secret) {
      const result = await run(commandsFor(account).set(secret));
      if (result.code !== 0) fail('yazma');
    },
    async delete(account) {
      const command = commandsFor(account).delete();
      const result = await run(command);
      if (result.code !== null && command.notFoundCodes?.includes(result.code))
        return;
      if (result.code !== 0) fail('silme');
    },
  };
}

export interface StoreHost {
  platform: StorePlatform;
  env: Record<string, string | undefined>;
  exists?: (file: string) => boolean;
  run?: StoreRunner;
}

/** Bu işletim sisteminin kasası. Kasa kullanılamıyorsa `available()` nedenini söyler. */
export function createCredentialStore(host: StoreHost): CredentialStore {
  const exists = host.exists ?? existsSync;
  const run = host.run ?? runStoreCommand;
  if (host.platform === 'darwin')
    return commandStore(
      'macOS Keychain',
      macCommands,
      async () =>
        exists(SECURITY)
          ? { ok: true }
          : { ok: false, reason: `${SECURITY} bulunamadı.` },
      run,
    );
  if (host.platform === 'win32') {
    const powershell = windowsPowerShellPath(host.env);
    return commandStore(
      'Windows Credential Manager',
      (account) => windowsCommands(account, host.env),
      async () =>
        exists(powershell)
          ? { ok: true }
          : { ok: false, reason: 'Windows PowerShell bulunamadı.' },
      run,
    );
  }
  const secretTool = findSecretTool(exists);
  return commandStore(
    'Secret Service (secret-tool)',
    (account) => linuxCommands(account, secretTool ?? '/usr/bin/secret-tool'),
    async () => {
      if (!secretTool)
        return {
          ok: false,
          reason:
            'secret-tool bulunamadı. libsecret araçlarını kur (Debian/Ubuntu: sudo apt install libsecret-tools) ve bir anahtarlık servisi (GNOME Keyring, KWallet) çalıştır.',
        };
      if (!host.env.DBUS_SESSION_BUS_ADDRESS)
        return {
          ok: false,
          reason:
            'Masaüstü oturumu (D-Bus) yok: anahtarlık servisine ulaşılamıyor. Programı masaüstü oturumunda çalıştır.',
        };
      return { ok: true };
    },
    run,
  );
}

/**
 * Kasa gerçekten çalışıyor mu? Deneme kaydı yazıp okur ve siler. Kasa kilitliyse, PowerShell
 * kısıtlıysa ya da anahtarlık servisi yoksa burada anlaşılır; token'a dokunulmaz.
 */
export async function probeCredentialStore(
  store: CredentialStore,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const available = await store.available();
  if (!available.ok) return available;
  const account = `deneme-${process.pid}`;
  const value = `deneme-${Date.now().toString(36)}`;
  try {
    await store.set(account, value);
    const read = await store.get(account);
    await store.delete(account);
    if (read !== value)
      return {
        ok: false,
        reason: `${store.label} yazılan değeri geri vermedi.`,
      };
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: `${store.label} kullanılamıyor (kilitli ya da erişim engelli olabilir).`,
    };
  }
}
