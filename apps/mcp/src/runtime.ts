// Gerçek oturum: kasadaki giriş + Supabase istemcisi + güvenlik denetimi.
//
// Her araç çağrısından önce (süreç başına bir kez, başarıya kadar) şu denetim yapılır:
//   1. Oturum "otomasyon oturumu" olarak işaretli mi? Değilse işaretle (auth/automation.ts).
//   2. Veritabanı bu oturumun onay RPC'lerini reddediyor mu? Reddetmiyorsa HİÇBİR araç çalışmaz.
// İşaretlenemeyen oturum KULLANILMAZ ve saklanmaz: kayıt editor yetkisi ister, yani viewer hesabı
// v1'de desteklenmez. (İşaretsiz bir viewer oturumu saklansaydı, üye sonradan editor yapıldığında
// insan oturumu gibi görünürdü.) Girişte token kasaya yazılmaz; açılışta kasadaki kayıt silinir.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  AutomationGuardError,
  markAutomationSession,
  probeApprovalRefused,
  type RawRpc,
} from './auth/automation.ts';
import type { CredentialStore } from './auth/credential-store.ts';
import { SessionManager } from './auth/session.ts';
import type { PanelConfig } from './config.ts';
import { ToolError, toToolError } from './lib/errors.ts';
import { createSupabaseGateway, type PanelGateway } from './lib/gateway.ts';
import type { PanelSession } from './server.ts';
import type { ToolKind } from './tools/types.ts';

export type GuardState = 'marked';

export const VIEWER_NOT_SUPPORTED =
  'MCP sunucusu editor ya da owner hesabı ister; viewer hesapları v1’de desteklenmez. ' +
  'Bu oturum otomasyon oturumu olarak işaretlenemediği için kullanılmadı ve saklanmadı.';

export function createDataClient(
  config: PanelConfig,
  accessToken: () => Promise<string>,
): SupabaseClient {
  return createClient(config.supabaseUrl, config.anonKey, {
    // Kullanıcının erişim token'ı her istekte buradan alınır; istemci oturum saklamaz.
    accessToken,
    global: { headers: { 'X-Client-Info': 'ai-influencer-mcp' } },
  });
}

export function rawRpcOf(client: SupabaseClient): RawRpc {
  return async (name, args) => {
    const { data, error } = await client.rpc(name, args);
    return { data, error };
  };
}

/** İşaretle + yokla. Giriş akışı da aynı fonksiyonu kullanır. */
export async function establishGuard(rpc: RawRpc): Promise<GuardState> {
  const mark = await markAutomationSession(rpc);
  if (mark.state === 'revoked') {
    throw new ToolError(
      'oturum_gecersiz',
      'Bu MCP oturumu artık geçerli değil: yetkisi kaldırılmış ya da eski türde (makine olarak) kayıtlı.',
      {
        advice:
          'Kullanıcı `pnpm mcp:logout`, sonra `pnpm mcp:login` çalıştırmalı.',
      },
    );
  }
  if (mark.state !== 'marked') {
    throw new ToolError('yetki_yok', VIEWER_NOT_SUPPORTED, {
      advice:
        'Kullanıcıya bildir: bir owner rolünü editor yapmalı, sonra `pnpm mcp:login` ile yeniden giriş yapılmalı.',
    });
  }
  await probeApprovalRefused(rpc);
  return mark.state;
}

const READ_ONLY_SESSION =
  'Bu MCP oturumu şu an salt okur: veritabanı bu oturuma taslak yazma yetkisi vermiyor ' +
  '(üyenin rolü editor ya da owner olmalı; docs/mcp-panel.md → "Yazma araçlarının durumu").';

export function createPanelSession(options: {
  config: PanelConfig;
  store: CredentialStore;
  manager?: SessionManager;
  client?: SupabaseClient;
}): PanelSession & { readonly manager: SessionManager } {
  const manager =
    options.manager ??
    new SessionManager({ config: options.config, store: options.store });
  // İstemci ilk kullanımda kurulur: supabase-js kurulurken erişim token'ı ister; giriş yokken
  // bu, sunucu açılışında gereksiz bir hata günlüğü üretir.
  let lazy: { rpc: RawRpc; db: PanelGateway } | null = null;
  const backend = () => {
    if (!lazy) {
      const client =
        options.client ??
        createDataClient(options.config, () => manager.accessToken());
      lazy = { rpc: rawRpcOf(client), db: createSupabaseGateway(client) };
    }
    return lazy;
  };
  const rpc: RawRpc = (name, args) => backend().rpc(name, args);
  const db: PanelGateway = {
    rpc: (name, args) => backend().db.rpc(name, args),
    select: (query) => backend().db.select(query),
  };

  let guard: GuardState | null = null;
  let guardFailure: ToolError | null = null;
  let pending: Promise<GuardState> | null = null;
  let canWrite: { value: boolean; at: number } | null = null;

  const runGuard = async (): Promise<GuardState> => {
    // Giriş yoksa burada `giris_gerekli` fırlar (kalıcı sayılmaz: kullanıcı giriş yapabilir).
    await manager.accessToken();
    try {
      const state = await establishGuard(rpc);
      guard = state;
      return state;
    } catch (caught) {
      if (caught instanceof AutomationGuardError) {
        // Güvence sağlanamadı: süreç boyunca kapalı kal.
        guardFailure = new ToolError('oturum_gecersiz', caught.message, {
          advice:
            'Kullanıcıya bildir. `pnpm mcp:logout` ve `pnpm mcp:login` ile yeni oturum açılmalı.',
        });
        throw guardFailure;
      }
      const error = toToolError(caught);
      if (error.code === 'yetki_yok' || error.code === 'oturum_gecersiz') {
        // İşaretlenemeyen ya da yetkisi kaldırılmış oturum saklanmaz.
        await manager.logout().catch(() => {});
      }
      throw error;
    }
  };

  const ensureGuard = async (): Promise<GuardState> => {
    if (guardFailure) throw guardFailure;
    if (guard) return guard;
    pending ??= runGuard().finally(() => {
      pending = null;
    });
    return pending;
  };

  return {
    manager,
    async gateway(kind: ToolKind): Promise<PanelGateway> {
      await ensureGuard();
      if (kind === 'read') return db;
      if (!canWrite || Date.now() - canWrite.at > 60_000) {
        const { data, error } = await rpc('can_draft', {});
        if (error) throw toToolError(error);
        canWrite = { value: data === true, at: Date.now() };
      }
      if (!canWrite.value) throw new ToolError('yetki_yok', READ_ONLY_SESSION);
      return db;
    },
    async describe() {
      try {
        await ensureGuard();
      } catch (caught) {
        const error = toToolError(caught);
        return {
          giris: error.code !== 'giris_gerekli' ? 'sorunlu' : 'yok',
          durum: error.message,
          oneri: error.advice ?? null,
        };
      }
      // Otomasyon oturumunun tablolardaki etkin rolü her zaman viewer'dır; taslak yetkisi
      // (can_draft) üyenin gerçek rolünden gelir.
      const [role, writable, workspaces] = await Promise.all([
        rpc('current_team_role', {}),
        rpc('can_draft', {}),
        db.select({ table: 'workspaces', columns: 'id,name', limit: 2 }),
      ]);
      const who = manager.identity();
      return {
        giris: 'var',
        kullanici_id: who?.userId ?? null,
        etkin_rol: typeof role.data === 'string' ? role.data : null,
        calisma_alani: workspaces[0] ?? null,
        otomasyon_oturumu: true,
        onay_verebilir: false,
        yazma_araclari_acik: writable.data === true,
        yazma_notu: writable.data === true ? null : READ_ONLY_SESSION,
      };
    },
    identity() {
      const who = manager.identity();
      return who ? { userId: who.userId, sessionId: who.sessionId } : null;
    },
  };
}
