// "MCP oturumu insan oturumu değildir" güvencesi.
//
// Veritabanı onayı yalnız insan oturumuna verir: `approve_episode_script()` ve
// `approve_job_stage()` (ve altlarındaki trigger'lar) oturum kimliği (`session_id` claim'i)
// otomasyon oturumu olarak kayıtlı olan oturumu reddeder (#201, #216). MCP sunucusu oturumunu
// `register_mcp_session()` ile "MCP oturumu" olarak işaretler (#241): işaret kalıcıdır, yenilemede
// korunur (aynı session_id) ve yalnız yetki DÜŞÜRÜR. İşaretli oturum tablolarda ve genel
// RPC'lerde viewer sayılır; yalnız taslak RPC'lerinde üyenin gerçek rolüyle çalışır. Makine
// kaydı açılmaz: MCP oturumu üretim makineleri listesinde görünmez.
//
// Bu modül iki şey yapar:
//   1. `markAutomationSession`: oturumu işaretler (girişte, token kasaya yazılmadan ÖNCE).
//   2. `probeApprovalRefused`: iki onay RPC'sini rastgele kimliklerle çağırıp veritabanının bu
//      oturumu yetki hatasıyla (42501) reddettiğini doğrular. Reddetmiyorsa sunucu hiçbir araç
//      çalıştırmaz. Yoklama hiçbir satıra dokunmaz: reddedilmese bile "kayıt bulunamadı" döner.
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import type { DbErrorLike } from '../lib/errors.ts';

/** Ham RPC çağrısı (gateway izin listesinin DIŞINDA; yalnız bu modül kullanır). */
export type RawRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: DbErrorLike | null }>;

export type MarkResult =
  /** Oturum otomasyon oturumu olarak kayıtlı. */
  | { readonly state: 'marked'; readonly name: string }
  /** Üye viewer: işaretlenemedi, ama viewer zaten onay veremez ve yazamaz. */
  | { readonly state: 'viewer' }
  /** Oturumun yetkisi kaldırılmış ya da oturum eski türde (makine) kayıtlı: kullanılmamalı. */
  | { readonly state: 'revoked' };

export class AutomationGuardError extends Error {}

export function automationSessionName(host: string = hostname()): string {
  const clean =
    host
      .replace(/\.local$/i, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .slice(0, 50) || 'bilgisayar';
  return `MCP istemcisi (${clean})`;
}

export async function markAutomationSession(
  rpc: RawRpc,
  host?: string,
): Promise<MarkResult> {
  const name = automationSessionName(host);
  const { error } = await rpc('register_mcp_session', { p_client_name: name });
  if (!error) return { state: 'marked', name };
  // Kodsuz hata veritabanından gelmemiştir (ağ, zaman aşımı): olduğu gibi yukarı verilir.
  if (!error.code) throw error;
  if (error.code === '42501') {
    // `session_revoked`: yetki panelden kaldırıldı. `worker_session`: oturum #241 öncesinde
    // makine olarak işaretlenmiş (eski MCP girişi); yeni giriş gerekir.
    if (error.hint === 'session_revoked' || error.hint === 'worker_session')
      return { state: 'revoked' };
    if (!error.hint) return { state: 'viewer' };
  }
  throw new AutomationGuardError(
    `Oturum otomasyon oturumu olarak kaydedilemedi (kod ${error.code}).`,
  );
}

/**
 * Veritabanı bu oturumun onayını reddediyor mu? İki onay RPC'si de 42501 dönmelidir. Başka her
 * sonuç (özellikle "kayıt bulunamadı": oturum denetimi GEÇİLMİŞ demektir) güvencenin
 * sağlanmadığını gösterir ve hata fırlatır.
 */
export async function probeApprovalRefused(rpc: RawRpc): Promise<void> {
  const probes: readonly [string, Record<string, unknown>][] = [
    [
      'approve_episode_script',
      { p_episode_id: randomUUID(), p_script_version: 0 },
    ],
    ['approve_job_stage', { p_job_id: randomUUID(), p_stage_key: 'probe' }],
  ];
  for (const [name, args] of probes) {
    const { error } = await rpc(name, args);
    // Kodsuz hata veritabanından gelmemiştir (ağ, zaman aşımı): olduğu gibi yukarı verilir.
    if (error && !error.code) throw error;
    if (error?.code !== '42501') {
      throw new AutomationGuardError(
        `Güvenlik denetimi başarısız: veritabanı bu oturumun ${name} çağrısını yetki hatasıyla reddetmedi ` +
          `(kod ${error?.code ?? 'yok'}). MCP oturumu onay verebilecek durumda olmamalı; araçlar kapalı.`,
      );
    }
  }
}
