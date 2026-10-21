'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import type { AssetKind, Row } from '@ai-influencer/shared';
import { ConfirmDialog, EmptyState, Toast } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type AssetItem = { asset: Row<'assets'>; url: string | null };
const kindLabels: Record<AssetKind, string> = {
  reference: 'Referans',
  generated: 'Üretilen',
  final_video: 'Final video',
  thumbnail: 'Küçük resim',
};
const qcItems = [
  ['hand_finger_count', 'El ve parmak sayısı doğru'],
  ['hand_finger_length', 'Parmak uzunlukları doğal'],
  ['hand_arm_connection', 'El-kol bağlantısı doğal'],
  ['body_proportions', 'Boyun, omuz ve uzuv oranları doğal'],
  ['body_symmetry', 'Vücut simetrisi uygun'],
  ['face_eye_symmetry', 'Göz simetrisi doğal'],
  ['face_gaze', 'Göz bebeklerinin yönü tutarlı'],
  ['face_teeth_ears', 'Diş ve kulaklarda bozulma yok'],
  ['face_identity', 'Yüz referansla aynı kişi'],
  ['hair_consistency', 'Saç rengi ve stili tutarlı'],
  ['hair_background', 'Saç-arka plan birleşimi temiz'],
  ['skin_texture', 'Cilt dokusu doğal'],
  ['skin_plastic', 'Cilt plastik görünmüyor'],
  ['clothing_melt', 'Kıyafet ve aksesuarlarda erime yok'],
  ['clothing_symmetry', 'Kıyafet simetrisi uygun'],
  ['clothing_text', 'Yazı ve logolar bozulmamış'],
  ['background_objects', 'Arka plandaki nesneler tutarlı'],
  ['background_text', 'Anlamsız arka plan yazısı yok'],
  ['background_perspective', 'Perspektif hatası yok'],
  ['video_face_flicker', 'Videoda yüz titremesi yok'],
  ['video_hands', 'Hareket sırasında el bozulması yok'],
  ['video_objects', 'Nesneler kareler arasında kaybolmuyor'],
  ['video_lip_sync', 'Dudak senkronu uygun'],
] as const;

async function readMetadata(file: File) {
  if (file.type.startsWith('image/')) {
    const image = await createImageBitmap(file);
    const metadata = {
      width: image.width,
      height: image.height,
      duration_ms: null,
    };
    image.close();
    return metadata;
  }
  const url = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => reject(new Error('Video bilgisi okunamadı.'));
      video.src = url;
    });
    return {
      width: null,
      height: null,
      duration_ms: Math.round(duration * 1000),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AssetManager({
  assets: initialAssets,
  avatarAssetId,
  canEdit,
  hasMore: initialHasMore,
  influencerId,
}: {
  assets: AssetItem[];
  avatarAssetId: string | null;
  canEdit: boolean;
  hasMore: boolean;
  influencerId: string;
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [currentAvatarId, setCurrentAvatarId] = useState(avatarAssetId);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [removing, setRemoving] = useState<AssetItem | null>(null);
  const visible = useMemo(
    () =>
      assets.filter(
        ({ asset }) =>
          filter === 'all' ||
          asset.kind === filter ||
          asset.qc_status === filter,
      ),
    [assets, filter],
  );

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    try {
      for (const file of Array.from(files)) {
        if (
          ![
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/avif',
            'video/mp4',
            'video/webm',
          ].includes(file.type)
        )
          throw new Error(`${file.name}: desteklenmeyen dosya türü.`);
        if (file.size > 100 * 1024 * 1024)
          throw new Error(`${file.name}: dosya 100 MB sınırını aşıyor.`);
        const id = crypto.randomUUID();
        const extension =
          file.name
            .split('.')
            .at(-1)
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, '') ||
          (file.type.startsWith('image/') ? 'img' : 'video');
        const storagePath = `${influencerId}/${id}.${extension}`;
        const metadata = await readMetadata(file);
        const kind: AssetKind = file.type.startsWith('video/')
          ? 'final_video'
          : 'reference';
        const { error: uploadError } = await supabase.storage
          .from('assets')
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const { data: row, error: rowError } = await supabase
          .from('assets')
          .insert({
            id,
            influencer_id: influencerId,
            kind,
            storage_path: storagePath,
            mime_type: file.type,
            file_size_bytes: file.size,
            ...metadata,
          })
          .select('*')
          .single();
        if (rowError) {
          await supabase.storage.from('assets').remove([storagePath]);
          throw rowError;
        }
        const { data: signed } = await supabase.storage
          .from('assets')
          .createSignedUrl(storagePath, 600);
        setAssets((current) =>
          [{ asset: row, url: signed?.signedUrl ?? null }, ...current].slice(
            0,
            100,
          ),
        );
      }
      setMessage({ text: 'Dosyalar yüklendi.' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Dosyalar yüklenemedi.',
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('influencer_id', influencerId)
      .order('created_at', { ascending: false })
      .range(assets.length, assets.length + 99);
    if (error) {
      setMessage({ text: 'Sonraki dosyalar alınamadı.', error: true });
      setLoadingMore(false);
      return;
    }
    const nextItems = await Promise.all(
      data.map(async (asset) => {
        const { data: signed } = await supabase.storage
          .from('assets')
          .createSignedUrl(asset.storage_path, 600);
        return { asset, url: signed?.signedUrl ?? null };
      }),
    );
    setAssets((current) => [...current, ...nextItems]);
    setHasMore(data.length === 100);
    setLoadingMore(false);
  }

  async function updateAsset(
    item: AssetItem,
    values: {
      qc_status?: string;
      tags?: string[];
      qc_checklist?: Row<'assets'>['qc_checklist'];
    },
  ) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('assets')
      .update(values)
      .eq('id', item.asset.id);
    if (error)
      return setMessage({ text: 'Varlık güncellenemedi.', error: true });
    setAssets((current) =>
      current.map((entry) =>
        entry.asset.id === item.asset.id
          ? { ...entry, asset: { ...entry.asset, ...values } }
          : entry,
      ),
    );
  }

  async function setAvatar(item: AssetItem) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('influencers')
      .update({ avatar_asset_id: item.asset.id })
      .eq('id', influencerId);
    setMessage(
      error
        ? { text: 'Avatar güncellenemedi.', error: true }
        : { text: 'Avatar güncellendi.' },
    );
    if (!error) setCurrentAvatarId(item.asset.id);
  }

  async function removeAsset() {
    if (!removing) return;
    const supabase = createSupabaseBrowserClient();
    const { error: storageError } = await supabase.storage
      .from('assets')
      .remove([removing.asset.storage_path]);
    if (storageError) {
      setMessage({ text: 'Dosya silinemedi; kayıt korundu.', error: true });
      setRemoving(null);
      return;
    }
    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', removing.asset.id);
    if (error) {
      setMessage({
        text: 'Dosya depodan silindi fakat kayıt kaldı. Sayfayı yenileyerek eşitleyin.',
        error: true,
      });
    } else {
      setAssets((current) =>
        current.filter(({ asset }) => asset.id !== removing.asset.id),
      );
      setMessage({ text: 'Dosya silindi.' });
    }
    setRemoving(null);
  }

  return (
    <div className="page-stack">
      <section className="section-card space-y-4">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MEDYA KÜTÜPHANESİ</p>
            <h2>Görsel ve videolar</h2>
          </div>
          <span className="soft-badge">{assets.length} dosya yüklendi</span>
        </div>
        {canEdit && (
          <label className="file-dropzone">
            <input
              accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
              disabled={busy}
              multiple
              onChange={(event) => {
                void upload(event.target.files);
                event.currentTarget.value = '';
              }}
              type="file"
            />
            <span className="file-dropzone-mark">＋</span>
            <strong>{busy ? 'Yükleniyor…' : 'Dosya yükle'}</strong>
            <small>Görsel veya video seçin · en fazla 100 MB/dosya</small>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          Filtre
          <select
            className="rounded-lg border border-line bg-surface px-3 py-2"
            onChange={(event) => setFilter(event.target.value)}
            value={filter}
          >
            <option value="all">Tümü</option>
            <option value="reference">Referans</option>
            <option value="generated">Üretilen</option>
            <option value="final_video">Final video</option>
            <option value="thumbnail">Küçük resim</option>
            <option value="pending">QC bekliyor</option>
            <option value="passed">QC geçti</option>
            <option value="failed">QC kaldı</option>
          </select>
        </label>
      </section>
      {visible.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <article className="section-card space-y-3" key={item.asset.id}>
              <div className="relative aspect-square overflow-hidden rounded-lg bg-surface">
                {item.url && item.asset.mime_type?.startsWith('video/') ? (
                  <video
                    className="h-full w-full object-contain"
                    controls
                    preload="metadata"
                    src={item.url}
                  />
                ) : item.url ? (
                  <a
                    aria-label="Görseli büyük görüntüle"
                    href={item.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Image
                      alt={
                        item.asset.storage_path.split('/').at(-1) ??
                        'Medya dosyası'
                      }
                      className="h-full w-full object-contain"
                      fill
                      src={item.url}
                      unoptimized
                    />
                  </a>
                ) : (
                  <div className="grid h-full place-items-center text-muted">
                    Önizleme alınamadı
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{kindLabels[item.asset.kind]}</strong>
                <span className="soft-badge">QC: {item.asset.qc_status}</span>
              </div>
              <p className="truncate text-sm text-muted">
                {item.asset.storage_path.split('/').at(-1)}
              </p>
              <p className="text-xs text-muted">
                {item.asset.width && item.asset.height
                  ? `${item.asset.width} × ${item.asset.height}`
                  : ''}
                {item.asset.duration_ms
                  ? ` · ${(item.asset.duration_ms / 1000).toFixed(1)} sn`
                  : ''}
                {item.asset.file_size_bytes
                  ? ` · ${(item.asset.file_size_bytes / 1024 / 1024).toFixed(1)} MB`
                  : ''}
              </p>
              <details className="rounded-lg border border-line p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  QC kontrol listesi
                </summary>
                <div className="mt-3 grid gap-2">
                  {qcItems.map(([key, label]) => (
                    <label className="flex items-start gap-2 text-sm" key={key}>
                      <input
                        checked={Boolean(
                          (item.asset.qc_checklist as Record<string, boolean>)[
                            key
                          ],
                        )}
                        disabled={!canEdit}
                        onChange={(event) => {
                          const checklist = item.asset.qc_checklist as Record<
                            string,
                            boolean
                          >;
                          void updateAsset(item, {
                            qc_checklist: {
                              ...checklist,
                              [key]: event.target.checked,
                            },
                          });
                        }}
                        type="checkbox"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </details>
              <div className="flex flex-wrap gap-2">
                {canEdit && (
                  <>
                    <button
                      className="button button-quiet"
                      onClick={() =>
                        item.asset.qc_status === 'passed'
                          ? void updateAsset(item, { qc_status: 'pending' })
                          : qcItems.every(
                                ([key]) =>
                                  (
                                    item.asset.qc_checklist as Record<
                                      string,
                                      boolean
                                    >
                                  )[key],
                              )
                            ? void updateAsset(item, { qc_status: 'passed' })
                            : setMessage({
                                text: 'QC geçişi için listedeki tüm maddeleri kontrol edin.',
                                error: true,
                              })
                      }
                      type="button"
                    >
                      QC{' '}
                      {item.asset.qc_status === 'passed' ? 'beklet' : 'geçir'}
                    </button>
                    {item.asset.kind !== 'final_video' && (
                      <button
                        className="button button-quiet"
                        onClick={() => void setAvatar(item)}
                        type="button"
                      >
                        {currentAvatarId === item.asset.id
                          ? 'Mevcut avatar'
                          : 'Avatar yap'}
                      </button>
                    )}
                    <button
                      className="button button-quiet"
                      onClick={() => setRemoving(item)}
                      type="button"
                    >
                      Sil
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Medya bulunamadı"
          description={
            filter === 'all'
              ? 'Bu influencer için henüz dosya yüklenmedi.'
              : 'Bu filtreyle eşleşen dosya yok.'
          }
        />
      )}
      {hasMore && (
        <button
          className="button button-quiet justify-self-center"
          disabled={loadingMore}
          onClick={() => void loadMore()}
          type="button"
        >
          {loadingMore ? 'Yükleniyor…' : 'Daha fazla yükle'}
        </button>
      )}
      {message && (
        <Toast
          message={message.text}
          onDismiss={() => setMessage(null)}
          tone={message.error ? 'error' : 'success'}
        />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title="Dosya silinsin mi?"
        description="Dosya önce private Storage alanından, ardından metadata tablosundan silinir."
        confirmLabel="Dosyayı sil"
        onCancel={() => setRemoving(null)}
        onConfirm={() => void removeAsset()}
      />
    </div>
  );
}
