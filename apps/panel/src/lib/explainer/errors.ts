/**
 * Anlatım RPC hatalarını (kod + HINT; sözleşme `20261115120000_explainer_series.sql`) kullanıcıya
 * gösterilecek Türkçe mesaja ve HTTP durumuna çevirir. Ham SQL hatası (kısıt adı, tablo adı)
 * istemciye hiçbir zaman gitmez: tanınmayan hata genel mesaja düşer.
 * Saf modül: hem API (`api.ts`) hem testler kullanır.
 */
export type DbError = {
  code?: string | null;
  message?: string | null;
  hint?: string | null;
};

export type MappedError = {
  status: number;
  message: string;
  /** İstemcinin özel davranış gösterdiği durumlar (ör. `version_conflict`, `fact_gaps`). */
  code?: string;
};

export const GENERIC_ERROR =
  'İşlem tamamlanamadı. Sayfayı yenileyip yeniden deneyin.';

const BY_HINT: Record<string, { status: number; message: string }> = {
  version_conflict: {
    status: 409,
    message:
      'Senaryoyu bu arada başka biri değiştirdi. Yazdıklarınız duruyor: güncel sürümle karşılaştırıp karar verin.',
  },
  fact_gaps: {
    status: 422,
    message:
      'Kaynak eksiği var (iki kaynaktan azı olan iddia ya da boş kaynak notu). Onaylamak için eksiği bildiğinizi işaretleyin.',
  },
  already_approved: { status: 409, message: 'Senaryo zaten onaylı.' },
  script_not_ready: {
    status: 422,
    message: 'Yalnız senaryosu yazılmış, arşivlenmemiş bölüm onaylanabilir.',
  },
  worker_session: {
    status: 403,
    message:
      'Üretim makinesi oturumu onay veremez; panelden bir ekip üyesi onaylamalı.',
  },
  approval_not_writable: {
    status: 403,
    message: 'Onay yalnız onay adımından verilebilir.',
  },
  episode_locked: {
    status: 409,
    message:
      'Bu bölüm kilitli (üretimi başlamış, yayınlanmış ya da arşivlenmiş); bu işlem yapılamaz.',
  },
  episode_in_production: {
    status: 409,
    message:
      'Üretim sürerken bu işlem yapılamaz. Önce üretim işini iptal edin.',
  },
  series_archived: {
    status: 409,
    message: 'Seri arşivde. Önce arşivden çıkarın.',
  },
  already_picked: { status: 409, message: 'Bu öneri zaten seçildi.' },
  already_decided: {
    status: 409,
    message: 'Bu öneri için zaten karar verilmiş.',
  },
  too_many_suggestions: {
    status: 422,
    message: 'Bir isteğe en çok 20 öneri yazılabilir.',
  },
  kind_required: {
    status: 422,
    message: 'Tür seçin: olay ya da nasıl çalışır.',
  },
  sources_invalid: {
    status: 422,
    message: 'Kaynak adaylarında ad ya da http(s) ile başlayan adres olmalı.',
  },
  fact_notes_invalid: {
    status: 422,
    message:
      'Kaynak notları geçersiz: her iddia 1-1000 karakter, iddia başına en çok 10 kaynak, adresler http(s) olmalı.',
  },
  unknown_field: { status: 400, message: 'İstek doğrulanamadı.' },
  script_approval_required: {
    status: 409,
    message: 'Senaryo onaylanmadan üretim başlatılamaz.',
  },
  script_changed: {
    status: 409,
    message: 'Senaryo bu işten sonra değişti; bölüm için yeni iş açın.',
  },
  unknown_explainer_kind: { status: 400, message: 'Geçersiz iş türü.' },
  production_capability_not_allowed: {
    status: 400,
    message: 'Bu iş türü üretim yeteneği isteyemez.',
  },
  episode_required: {
    status: 400,
    message: 'Üretim işi bir bölüme bağlı olmalı.',
  },
  illegal_transition: {
    status: 409,
    message: 'İş bu durumdayken bu işlem yapılamaz.',
  },
};

/** Kısıt adı → mesaj (RPC'nin kendi denetiminden kaçıp CHECK / UNIQUE'e takılan durumlar). */
const BY_CONSTRAINT: Array<[string, number, string]> = [
  ['series_workspace_name_key', 409, 'Bu adda bir seri zaten var.'],
  ['episodes_suggestion_key', 409, 'Bu öneri zaten seçildi.'],
  [
    'episodes_series_number_key',
    409,
    'Bölüm numarası çakıştı; yeniden deneyin.',
  ],
  [
    'topic_suggestions_request_position_key',
    409,
    'Öneriler aynı anda eklendi; yeniden deneyin.',
  ],
  [
    'topic_suggestions_kind_known',
    422,
    'Önerinin türünü seçin: olay ya da nasıl çalışır.',
  ],
  ['topic_suggestions_evidence_level_known', 422, 'Geçersiz kanıt düzeyi.'],
];

/** Ham Postgres mesajı mı? (Kendi RAISE mesajlarımız Türkçedir ve bu kalıplara uymaz.) */
function looksRaw(message: string): boolean {
  return /violates|constraint|relation|column|syntax|function |operator|invalid input|null value|duplicate key|permission denied|schema /i.test(
    message,
  );
}

export function mapExplainerError(error: DbError): MappedError {
  const hint = error.hint ?? '';
  const known = BY_HINT[hint];
  if (known) return { ...known, code: hint };

  const message = error.message ?? '';
  for (const [constraint, status, text] of BY_CONSTRAINT)
    if (message.includes(constraint)) return { status, message: text };

  switch (error.code) {
    case '42501':
      return {
        status: 403,
        message: 'Bu işlem için düzenleme yetkisi gerekir.',
      };
    case 'P0002':
      return { status: 404, message: 'Kayıt bulunamadı.' };
    case '23505':
      return { status: 409, message: 'Bu kayıt zaten var.' };
    case '23502':
    case '23503':
      return { status: 422, message: 'Eksik ya da geçersiz alan var.' };
    case '22023':
    case '23514':
    case '54000':
    case '55000':
      // Veritabanının kendi Türkçe mesajı (RAISE) kullanıcıya uygundur; ham kısıt mesajı değil.
      return {
        status: error.code === '55000' ? 409 : 422,
        message:
          message && !looksRaw(message) ? message : 'Kayıt kurallara uymuyor.',
      };
    default:
      return { status: 500, message: GENERIC_ERROR };
  }
}
