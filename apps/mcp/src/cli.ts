#!/usr/bin/env node
// Panel MCP sunucusu komutları (docs/mcp-panel.md):
//   start    MCP sunucusunu stdio üzerinden başlatır (istemci bu komutu çalıştırır)
//   login    tarayıcıyla giriş: --email <adres> ya da --google  [--port <n>] [--no-open]
//   logout   bu bilgisayardaki MCP oturumunu kapatır ve kasadan siler
//   status   giriş, rol, çalışma alanı ve güvenlik denetiminin durumu
//
// stdout protokole aittir: bu dosyadaki her insan çıktısı stderr'e yazılır (start dışındaki
// komutlarda da tutarlılık için).
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { AutomationGuardError } from './auth/automation.ts';
import { createPlatformStore } from './auth/credential-store.ts';
import {
  DEFAULT_LOGIN_PORT,
  LoginError,
  loginWithBrowser,
  openBrowser,
  redirectUrl,
  type LoginMethod,
} from './auth/login.ts';
import { SessionManager } from './auth/session.ts';
import { ConfigError, loadConfig } from './config.ts';
import { createFileAuditLog } from './lib/audit.ts';
import { ToolError, toToolError } from './lib/errors.ts';
import { redactText } from './lib/redact.ts';
import {
  createDataClient,
  createPanelSession,
  establishGuard,
  rawRpcOf,
} from './runtime.ts';
import { buildServer, type PanelSession } from './server.ts';

function say(line: string): void {
  process.stderr.write(`${redactText(line)}\n`);
}

export type LoginArgs = {
  readonly method: LoginMethod;
  readonly port: number;
  readonly open: boolean;
};

export function parseLoginArgs(argv: readonly string[]): LoginArgs {
  let email: string | null = null;
  let google = false;
  let port = DEFAULT_LOGIN_PORT;
  let open = true;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--email') {
      email = argv[(i += 1)] ?? '';
    } else if (arg.startsWith('--email=')) {
      email = arg.slice('--email='.length);
    } else if (arg === '--google') {
      google = true;
    } else if (arg === '--port') {
      port = Number(argv[(i += 1)]);
    } else if (arg.startsWith('--port=')) {
      port = Number(arg.slice('--port='.length));
    } else if (arg === '--no-open') {
      open = false;
    } else {
      throw new LoginError(`Bilinmeyen seçenek: ${arg.slice(0, 40)}`);
    }
  }
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new LoginError('--port 1024 ile 65535 arasında bir sayı olmalı.');
  }
  if (google === (email !== null)) {
    throw new LoginError(
      'Giriş yöntemi seçin: `--email <adres>` (e-posta bağlantısı) ya da `--google`.',
    );
  }
  if (email !== null && !/^[^\s@]{1,64}@[^\s@]{1,255}$/.test(email)) {
    throw new LoginError('E-posta adresi geçersiz.');
  }
  return {
    method: email !== null ? { kind: 'email', email } : { kind: 'google' },
    port,
    open,
  };
}

async function login(argv: readonly string[]): Promise<number> {
  const args = parseLoginArgs(argv);
  const config = loadConfig();
  const store = createPlatformStore();
  const manager = new SessionManager({ config, store });
  say(`Panel: ${new URL(config.supabaseUrl).host}`);
  say(`Geri dönüş adresi: ${redirectUrl(args.port)}`);
  // Önceki MCP oturumu varsa kapat: kasada tek oturum durur, eskisi sunucuda açık kalmaz.
  if (await manager.stored()) await manager.logout();
  const token = await loginWithBrowser(
    config,
    args.method,
    { say, open: args.open ? openBrowser : () => {} },
    { port: args.port },
  );
  // Sıra önemli: oturum önce "insan değil" diye işaretlenir ve veritabanının onayı reddettiği
  // doğrulanır; token kasaya ancak ondan sonra yazılır. Denetim geçmezse oturum kapatılır.
  manager.hold(token);
  const client = createDataClient(config, async () => token.access_token);
  try {
    await establishGuard(rawRpcOf(client));
    await manager.adopt(token);
    say(`Giriş yapıldı. Oturum ${store.label} içinde saklandı.`);
    say(
      'Bu oturum otomasyon oturumu olarak kaydedildi: onay veremez (veritabanı doğrulandı).',
    );
    return 0;
  } catch (error) {
    await fetch(`${config.supabaseUrl}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${token.access_token}`,
      },
    }).catch(() => {});
    throw error;
  }
}

async function logout(): Promise<number> {
  const config = loadConfig();
  const manager = new SessionManager({ config, store: createPlatformStore() });
  const result = await manager.logout();
  say(
    !result.hadSession
      ? 'Kayıtlı bir MCP oturumu yoktu.'
      : result.revoked
        ? 'MCP oturumu kapatıldı ve kasadan silindi.'
        : 'Oturum kasadan silindi (sunucudaki oturum zaten geçersizdi ya da kapatılamadı).',
  );
  return 0;
}

async function status(): Promise<number> {
  const config = loadConfig();
  const store = createPlatformStore();
  const session = createPanelSession({ config, store });
  say(`Panel: ${new URL(config.supabaseUrl).host}`);
  say(`Kasa: ${store.label}`);
  const summary = await session.describe();
  for (const [key, value] of Object.entries(summary)) {
    say(
      `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`,
    );
  }
  return summary.giris === 'var' ? 0 : 1;
}

/** Yapılandırma eksikse sunucu yine açılır; her araç nedenini söyler (istemci sessizce kopmasın). */
function unavailableSession(message: string): PanelSession {
  const error = () =>
    new ToolError('giris_gerekli', message, {
      advice: 'Kullanıcıya bildir; kurulum adımları docs/mcp-panel.md içinde.',
    });
  return {
    async gateway() {
      throw error();
    },
    async describe() {
      return { giris: 'yok', durum: message };
    },
    identity: () => null,
  };
}

function start(): void {
  let session: PanelSession;
  try {
    session = createPanelSession({
      config: loadConfig(),
      store: createPlatformStore(),
    });
  } catch (error) {
    if (!(error instanceof ConfigError) && !(error instanceof ToolError)) {
      throw error;
    }
    say(`Hata: ${error.message}`);
    session = unavailableSession(error.message);
  }
  const audit = createFileAuditLog();
  serveStdio(() => buildServer({ session, audit, log: say }), {
    onerror: (error) => say(`mcp: ${error.message}`),
  });
  say('ai-influencer-panel MCP sunucusu hazır (stdio).');
}

export async function main(argv: readonly string[]): Promise<number> {
  const [command = 'start', ...rest] = argv;
  switch (command) {
    case 'start':
      start();
      return -1; // süreç stdin kapanana kadar yaşar
    case 'login':
      return login(rest);
    case 'logout':
      return logout();
    case 'status':
      return status();
    default:
      say(
        'Kullanım: start | login (--email <adres> | --google) [--port <n>] [--no-open] | logout | status',
      );
      return 2;
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    (code) => {
      if (code >= 0) process.exit(code);
    },
    (error: unknown) => {
      const message =
        error instanceof LoginError ||
        error instanceof ConfigError ||
        error instanceof AutomationGuardError ||
        error instanceof ToolError
          ? error.message
          : toToolError(error).message;
      say(`Hata: ${message}`);
      process.exit(1);
    },
  );
}
