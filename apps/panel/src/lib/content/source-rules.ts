/**
 * #145 v2v kaynak bilgisi ve #22 "puanlayan ≠ üreten" kuralları.
 * Veritabanı aynı kuralları uygular (migration 20261024100000_content_source_fields.sql):
 * CHECK `content_items_source_details_required`, HINT `source_missing` ve `scorer_is_producer`.
 */
export const sourceTypes = [
  'own',
  'stock',
  'open_license',
  'third_party',
] as const;
export type SourceType = (typeof sourceTypes)[number];

/** docs/compliance.md → "Kaynak tercih sırası" (kayıt kodu parantez içinde). */
export const sourceTypeLabels: Record<SourceType, string> = {
  own: 'Kendi hareket referansımız (kendi)',
  stock: 'Lisanslı/stok video (stok)',
  open_license: 'Açık izinli içerik (acik-lisans)',
  third_party: 'Üçüncü kişi videosu, yazılı izinle (ucuncu-kisi)',
};

export const SOURCE_MISSING_MESSAGE =
  'Video-to-video içerikte kaynak bilgisi (tür, sahip, lisans/izin) kaydedilmeden planlama veya yayın yapılamaz.';
export const SCORER_IS_PRODUCER_MESSAGE =
  'Puanlayan kişi üreten kişiden farklı olmalı; puanları ve yayın kararını başka bir ekip üyesi kaydetmeli.';
export const SOURCE_DETAILS_MESSAGE =
  'Kendi referansımız dışındaki kaynaklarda sahip ve lisans/izin referansı zorunlu.';

/** Kendi referansı dışındaki türlerde sahip ve lisans/izin zorunlu. */
export function sourceDetailsError(values: {
  source_type: SourceType | null;
  source_owner: string;
  source_license: string;
}): string | null {
  if (!values.source_type || values.source_type === 'own') return null;
  return values.source_owner.trim() && values.source_license.trim()
    ? null
    : SOURCE_DETAILS_MESSAGE;
}

/** Üreten: sorumlu (assignee), atanmamışsa kartı oluşturan. */
export function producerOf(item: {
  assignee_id: string | null;
  created_by: string | null;
}): string | null {
  return item.assignee_id ?? item.created_by;
}

/** Puanlayan biliniyorsa ve üretenle aynıysa true (planlama/yayın engellenir). */
export function scorerIsProducer(item: {
  checklist_scored_by: string | null;
  assignee_id: string | null;
  created_by: string | null;
}): boolean {
  return (
    item.checklist_scored_by !== null &&
    item.checklist_scored_by === producerOf(item)
  );
}
