// Veritabanı (PostgREST) ve oturum hatalarını modelin ve kullanıcının anlayacağı Türkçe iletilere
// çevirir. RPC çekirdekleri hatayı SQLSTATE + HINT ile verir (supabase/migrations/2026111510*,
// 2026111512*); ileti metinleri bizim yazdığımız Türkçe cümlelerdir ve kullanıcı içeriği taşımaz.
// Tanımadığımız bir hatanın ham metni dışarı verilmez (şema ayrıntısı sızdırabilir).
import { redactText } from './redact.ts';

export type ToolErrorCode =
  | 'giris_gerekli'
  | 'oturum_gecersiz'
  | 'yetki_yok'
  | 'insan_onayi_gerekli'
  | 'bulunamadi'
  | 'surum_cakismasi'
  | 'durum_uygun_degil'
  | 'gecersiz_girdi'
  | 'zaten_var'
  | 'sinir_asildi'
  | 'hiz_siniri'
  | 'sonuc_cok_buyuk'
  | 'kasa_hatasi'
  | 'baglanti'
  | 'beklenmeyen';

export class ToolError extends Error {
  readonly code: ToolErrorCode;
  /** Modelin bir sonraki adımı için kısa yönlendirme. */
  readonly advice: string | undefined;
  /** Veritabanının verdiği ipucu anahtarı (ör. version_conflict). */
  readonly hint: string | undefined;

  constructor(
    code: ToolErrorCode,
    message: string,
    options: { advice?: string; hint?: string } = {},
  ) {
    super(message);
    this.name = 'ToolError';
    this.code = code;
    this.advice = options.advice;
    this.hint = options.hint;
  }
}

/** PostgREST / supabase-js hata nesnesinin kullandığımız alanları. */
export type DbErrorLike = {
  readonly code?: string | null;
  readonly message?: string | null;
  readonly hint?: string | null;
  readonly details?: string | null;
};

const HINT_MESSAGES: Readonly<
  Record<string, { code: ToolErrorCode; message: string; advice?: string }>
> = {
  worker_session: {
    code: 'insan_onayi_gerekli',
    message:
      'Bu oturum onay veremez. Onay yalnız panelde, insan tarafından verilir.',
    advice:
      'Kullanıcıya panelde onay vermesi gerektiğini söyle; başka bir yol deneme.',
  },
  automation_session: {
    code: 'insan_onayi_gerekli',
    message:
      'Bu işlem otomasyon oturumuna kapalı. Üretimi başlatma, arşivleme ve taşıma panelde, insan tarafından yapılır.',
    advice:
      'Kullanıcıya bu adımı panelden yapması gerektiğini söyle; başka bir yol deneme.',
  },
  session_required: {
    code: 'oturum_gecersiz',
    message: 'Oturum kimliği okunamadı.',
    advice: 'Kullanıcı `pnpm mcp:logout` ve `pnpm mcp:login` çalıştırmalı.',
  },
  worker_revoked: {
    code: 'oturum_gecersiz',
    message: 'Bu oturumun yetkisi panelden kaldırılmış.',
    advice: 'Kullanıcı `pnpm mcp:login` ile yeniden giriş yapmalı.',
  },
  version_conflict: {
    code: 'surum_cakismasi',
    message: 'Senaryo bu arada değişti; elindeki sürüm güncel değil.',
    advice:
      '`get_episode` ile güncel sürümü oku, değişikliği onun üstüne uygula ve `expected_version` değerini güncelle.',
  },
  already_picked: {
    code: 'durum_uygun_degil',
    message: 'Bu öneri zaten seçilmiş (bölüme dönüşmüş).',
  },
  already_decided: {
    code: 'durum_uygun_degil',
    message: 'Yalnız karar verilmemiş öneri elenebilir.',
  },
  already_approved: {
    code: 'durum_uygun_degil',
    message: 'Senaryo zaten onaylı.',
  },
  series_archived: {
    code: 'durum_uygun_degil',
    message: 'Seri arşivlenmiş; yeni istek ya da bölüm açılamaz.',
  },
  episode_locked: {
    code: 'durum_uygun_degil',
    message:
      'Bölüm kilitli: üretim sürerken, yayından sonra ya da arşivdeyken değiştirilemez.',
  },
  episode_in_production: {
    code: 'durum_uygun_degil',
    message: 'Bölümün üretimi sürüyor.',
  },
  script_approval_required: {
    code: 'insan_onayi_gerekli',
    message:
      'Üretim işi için senaryonun panelde bir insan tarafından onaylanmış olması gerekir.',
    advice: 'Kullanıcıya senaryoyu panelde onaylaması gerektiğini söyle.',
  },
  approval_required: {
    code: 'insan_onayi_gerekli',
    message: 'Aşama panelde bir insan tarafından onaylanmadan iş ilerleyemez.',
    advice: 'Kullanıcıya panelde onay vermesi gerektiğini söyle.',
  },
  approval_not_writable: {
    code: 'insan_onayi_gerekli',
    message: 'Onay alanları yalnız panelde, insan onayıyla yazılır.',
  },
  script_changed: {
    code: 'durum_uygun_degil',
    message: 'Senaryo bu işten sonra değişti; bölüm için yeni iş açılmalı.',
  },
  production_capability_not_allowed: {
    code: 'gecersiz_girdi',
    message:
      'Ön hazırlık işi üretim yeteneği (ses, altyazı, render, klip, yayın) isteyemez.',
  },
  episode_required: {
    code: 'gecersiz_girdi',
    message: 'Anlatım işi bir bölüme bağlı olmalı.',
  },
  not_awaiting_approval: {
    code: 'durum_uygun_degil',
    message: 'Bu aşama onay beklemiyor.',
  },
  kind_required: {
    code: 'gecersiz_girdi',
    message: 'Bölümün türü gerekli: event ya da how_it_works.',
  },
  unknown_field: {
    code: 'gecersiz_girdi',
    message: 'Bilinmeyen alan gönderildi.',
  },
  unknown_explainer_kind: {
    code: 'gecersiz_girdi',
    message: 'Bilinmeyen iş türü.',
  },
  too_many_suggestions: {
    code: 'sinir_asildi',
    message: 'Bir isteğe en çok 20 öneri yazılabilir.',
    advice: 'Yeni bir konu isteği aç ya da daha az öneri gönder.',
  },
  sources_invalid: {
    code: 'gecersiz_girdi',
    message:
      'Kaynaklar {"title": metin, "url": "http(s)://…"} biçiminde olmalı (en az biri dolu).',
  },
  fact_notes_invalid: {
    code: 'gecersiz_girdi',
    message:
      'Kaynak notları biçimi geçersiz (iddia 1-1000 karakter, iddia başına en çok 10 kaynak).',
  },
};

const NETWORK =
  /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|network|socket hang up/i;

/** Bilinmeyen bir hatayı (DB, ağ, kendi `ToolError`'ımız) tek biçime indirger. */
export function toToolError(error: unknown): ToolError {
  if (error instanceof ToolError) return error;
  const db = (error ?? {}) as DbErrorLike;
  const code = typeof db.code === 'string' ? db.code : '';
  const hint = typeof db.hint === 'string' ? db.hint.trim() : '';
  const raw = typeof db.message === 'string' ? db.message : String(error ?? '');

  if (hint && Object.hasOwn(HINT_MESSAGES, hint)) {
    const mapped = HINT_MESSAGES[hint]!;
    return new ToolError(mapped.code, mapped.message, {
      advice: mapped.advice,
      hint,
    });
  }

  switch (code) {
    case '42501':
      return new ToolError(
        'yetki_yok',
        'Bu oturumun bu işlem için yetkisi yok. (Yazma için editor/owner rolü gerekir; ' +
          'onay, yayın, ekip ve anahtar işlemleri bu oturuma kapalıdır.)',
        {
          advice: '`whoami` ile oturumun rolünü ve yazma durumunu kontrol et.',
        },
      );
    case 'P0002':
    case 'PGRST116':
      return new ToolError(
        'bulunamadi',
        'Kayıt bulunamadı (kimlik yanlış ya da kayıt bu çalışma alanında değil).',
      );
    case '55000':
      return new ToolError(
        'durum_uygun_degil',
        'Kaydın şu anki durumu bu işleme izin vermiyor.',
        { advice: 'Kaydı yeniden oku ve durumuna göre karar ver.' },
      );
    case '22023':
    case '22001':
    case '22P02':
    case '23502':
    case '23514':
      return new ToolError(
        'gecersiz_girdi',
        'Girdi veritabanı kurallarına uymuyor (uzunluk, biçim ya da izin verilen değerler).',
      );
    case '23505':
      return new ToolError(
        'zaten_var',
        'Aynı kayıt zaten var (ör. çalışma alanında aynı adlı seri).',
      );
    case '23503':
      return new ToolError(
        'bulunamadi',
        'Bağlı kayıt bulunamadı (kimlik yanlış ya da bu çalışma alanında değil).',
      );
    case '54000':
      return new ToolError('sinir_asildi', 'Çalışma alanı sınırına ulaşıldı.');
    case 'PGRST301':
    case 'PGRST302':
    case 'PGRST303':
      return new ToolError(
        'oturum_gecersiz',
        'Oturum geçersiz ya da süresi dolmuş.',
        { advice: 'Kullanıcı `pnpm mcp:login` ile yeniden giriş yapmalı.' },
      );
    default:
      break;
  }
  if (NETWORK.test(raw)) {
    return new ToolError('baglanti', 'Panele (Supabase) ulaşılamadı.', {
      advice: 'Bir süre sonra yeniden dene.',
    });
  }
  return new ToolError(
    'beklenmeyen',
    code
      ? `Beklenmeyen hata (kod ${redactText(code).slice(0, 20)}).`
      : 'Beklenmeyen hata.',
  );
}

/** Hatanın araç sonucunda görünen metni. */
export function formatToolError(error: ToolError): string {
  const lines = [`Hata [${error.code}]: ${error.message}`];
  if (error.advice) lines.push(`Öneri: ${error.advice}`);
  return lines.join('\n');
}
