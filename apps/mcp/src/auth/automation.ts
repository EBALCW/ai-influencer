// "MCP oturumu insan oturumu değildir" güvencesi.
//
// Veritabanı onayı yalnız insan oturumuna verir: `approve_episode_script()` ve
// `approve_job_stage()` (ve altlarındaki trigger'lar) oturum kimliği (`session_id` claim'i)
// `private.worker_sessions`'a kayıtlı olan oturumu reddeder (#201, #216). Bugün bir oturumu bu
// şekilde kalıcı olarak "insan değil" diye işaretlemenin tek yolu `register_worker()`'dır:
// çağıran oturumu yeteneksiz bir makine kaydına bağlar. İşaret kalıcıdır, yenilemede korunur
// (aynı session_id) ve yalnız yetki DÜŞÜRÜR.
//
// Bu modül iki şey yapar:
//   1. `markAutomationSession`: oturumu işaretler (girişte, token kasaya yazılmadan ÖNCE).
//   2. `probeApprovalRefused`: iki onay RPC'sini rastgele kimliklerle çağırıp veritabanının bu
//      oturumu yetki hatasıyla (42501) reddettiğini doğrular. Reddetmiyorsa sunucu hiçbir araç
//      çalıştırmaz. Yoklama hiçbir satıra dokunmaz: reddedilmese bile "kayıt bulunamadı" döner.
//
// Planlanan değişiklik (docs/mcp-panel.md → "Takip migration'ı"): makine kaydı yerine ayrı bir
// "otomasyon oturumu" türü. O gelince yalnız bu dosya değişir.
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import type { DbErrorLike } from '../lib/errors.ts';

/** Ham RPC çağrısı (gateway izin listesinin DIŞINDA; yalnız bu modül kullanır). */
export type RawRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: DbErrorLike | null }>;

export const MCP_SESSION_VERSION = 'mcp-0.1.0';

export type MarkResult =
  /** Oturum otomasyon oturumu olarak kayıtlı. */
  | { readonly state: 'marked'; readonly name: string }
  /** Üye viewer: işaretlenemedi, ama viewer zaten onay veremez ve yazamaz. */
  | { readonly state: 'viewer' }
  /** Kayıt panelden kaldırılmış: oturum kullanılmamalı. */
  | { readonly state: 'revoked' };

export class AutomationGuardError extends Error {}

export function automationSessionName(
  host: string = hostname(),
  suffix = '',
): string {
  const clean =
    host
      .replace(/\.local$/i, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .slice(0, 50) || 'bilgisayar';
  return `MCP istemcisi (${clean})${suffix ? ` ${suffix}` : ''}`;
}

function platformName(): 'darwin' | 'win32' | 'linux' {
  return process.platform === 'darwin' || process.platform === 'win32'
    ? process.platform
    : 'linux';
}

export async function markAutomationSession(
  rpc: RawRpc,
  host?: string,
): Promise<MarkResult> {
  const attempt = async (name: string) =>
    rpc('register_worker', {
      p_name: name,
      p_platform: platformName(),
      p_version: MCP_SESSION_VERSION,
      p_capabilities: [],
    });

  const name = automationSessionName(host);
  let result = await attempt(name);
  if (result.error?.hint === 'worker_revoked') {
    // Aynı adlı eski kayıt kaldırılmış olabilir (yeni giriş): yeni adla bir kez daha dene.
    // Oturumun KENDİSİ kaldırılmışsa bu da reddedilir.
    const fresh = automationSessionName(host, randomUUID().slice(0, 4));
    result = await attempt(fresh);
    if (!result.error) return { state: 'marked', name: fresh };
    if (result.error.hint === 'worker_revoked') return { state: 'revoked' };
  }
  if (!result.error) return { state: 'marked', name };
  if (result.error.code === '42501' && !result.error.hint) {
    return { state: 'viewer' };
  }
  throw new AutomationGuardError(
    `Oturum otomasyon oturumu olarak kaydedilemedi (kod ${result.error.code ?? '?'}).`,
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
