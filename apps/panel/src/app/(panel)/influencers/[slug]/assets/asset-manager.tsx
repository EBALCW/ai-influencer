'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { AssetKind, Row } from '@ai-influencer/shared';
import { ConfirmDialog, EmptyState, Toast } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type AssetItem = {
  asset: Row<'assets'>;
  url: string | null;
  thumbnailUrl: string | null;
};
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

async function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Küçük resim üretilemedi.')),
      'image/webp',
      0.78,
    ),
  );
}

async function readMetadata(file: File) {
  if (file.type.startsWith('image/')) {
    const image = await createImageBitmap(file);
    const scale = Math.min(1, 640 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas
      .getContext('2d')
      ?.drawImage(image, 0, 0, canvas.width, canvas.height);
    const thumbnail = await canvasBlob(canvas);
    const metadata = {
      width: image.width,
      height: image.height,
      duration_ms: null,
    };
    image.close();
    return { ...metadata, thumbnail };
  }
  const url = URL.createObjectURL(file);
  try {
    const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
      const element = document.createElement('video');
      element.preload = 'auto';
      element.muted = true;
      element.onloadeddata = () => resolve(element);
      element.onerror = () => reject(new Error('Video bilgisi okunamadı.'));
      element.src = url;
    });
    const scale = Math.min(
      1,
      640 / Math.max(video.videoWidth, video.videoHeight),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas
      .getContext('2d')
      ?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const thumbnail = await canvasBlob(canvas);
    return {
      width: video.videoWidth,
      height: video.videoHeight,
      duration_ms: Math.round(video.duration * 1000),
      thumbnail,
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
  returnTo,
}: {
  assets: AssetItem[];
  avatarAssetId: string | null;
  canEdit: boolean;
  hasMore: boolean;
  influencerId: string;
  returnTo?: string;
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [currentAvatarId, setCurrentAvatarId] = useState(avatarAssetId);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [filterNow, setFilterNow] = useState(0);
  const [search, setSearch] = useState('');
  const [leftVersion, setLeftVersion] = useState('');
  const [rightVersion, setRightVersion] = useState('');
  const [lightbox, setLightbox] = useState<AssetItem | null>(null);
  const versionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          assets
            .filter(
              ({ asset }) => asset.kind === 'reference' && asset.version_tag,
            )
            .map(({ asset }) => asset.version_tag as string),
        ),
      ).sort((a, b) => a.localeCompare(b, 'tr')),
    [assets],
  );
  const tagOptions = useMemo(
    () =>
      Array.from(new Set(assets.flatMap(({ asset }) => asset.tags))).sort(
        (a, b) => a.localeCompare(b, 'tr'),
      ),
    [assets],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTags, setBulkTags] = useState('');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [removing, setRemoving] = useState<AssetItem | null>(null);
  const visible = useMemo(() => {
    const cutoff =
      dateFilter === 'all' || !filterNow
        ? 0
        : filterNow - Number(dateFilter) * 24 * 60 * 60 * 1000;
    return assets.filter(({ asset }) => {
      const kindMatches =
        filter === 'all' || asset.kind === filter || asset.qc_status === filter;
      const tagMatches = tagFilter === 'all' || asset.tags.includes(tagFilter);
      const dateMatches = !cutoff || Date.parse(asset.created_at) >= cutoff;
      return kindMatches && tagMatches && dateMatches;
    });
  }, [assets, dateFilter, filter, filterNow, tagFilter]);
  const searched = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('tr');
    return visible.filter(
      ({ asset }) =>
        !needle ||
        asset.storage_path.toLocaleLowerCase('tr').includes(needle) ||
        asset.tags.some((tag) => tag.toLocaleLowerCase('tr').includes(needle)),
    );
  }, [visible, search]);

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
        const thumbnailPath = `${influencerId}/${id}-thumb.webp`;
        const { error: thumbnailError } = await supabase.storage
          .from('assets')
          .upload(thumbnailPath, metadata.thumbnail, {
            contentType: 'image/webp',
            upsert: false,
          });
        if (thumbnailError) {
          await supabase.storage.from('assets').remove([storagePath]);
          throw thumbnailError;
        }
        const { data: row, error: rowError } = await supabase
          .from('assets')
          .insert({
            id,
            influencer_id: influencerId,
            kind,
            storage_path: storagePath,
            thumbnail_path: thumbnailPath,
            mime_type: file.type,
            file_size_bytes: file.size,
            width: metadata.width,
            height: metadata.height,
            duration_ms: metadata.duration_ms,
            version_tag: kind === 'reference' ? 'v1' : null,
          })
          .select('*')
          .single();
        if (rowError) {
          await supabase.storage
            .from('assets')
            .remove([storagePath, thumbnailPath]);
          throw rowError;
        }
        const { data: signed } = await supabase.storage
          .from('assets')
          .createSignedUrl(storagePath, 600);
        const { data: thumbnailSigned } = await supabase.storage
          .from('assets')
          .createSignedUrl(thumbnailPath, 600);
        setAssets((current) =>
          [
            {
              asset: row,
              url: signed?.signedUrl ?? null,
              thumbnailUrl: thumbnailSigned?.signedUrl ?? null,
            },
            ...current,
          ].slice(0, 100),
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
        const { data: thumbnail } = asset.thumbnail_path
          ? await supabase.storage
              .from('assets')
              .createSignedUrl(asset.thumbnail_path, 600)
          : { data: null };
        return {
          asset,
          url: signed?.signedUrl ?? null,
          thumbnailUrl: thumbnail?.signedUrl ?? null,
        };
      }),
    );
    setAssets((current) => [...current, ...nextItems]);
    setHasMore(data.length === 100);
    setLoadingMore(false);
  }

  async function applyBulkTags() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const tags = [
      ...new Set(
        bulkTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ];
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    for (const id of ids) {
      const { error } = await supabase
        .from('assets')
        .update({ tags })
        .eq('id', id);
      if (error) {
        setMessage({
          text: 'Etiketler uygulanırken hata oluştu; bazı dosyalar güncellenmiş olabilir.',
          error: true,
        });
        setBusy(false);
        return;
      }
    }
    setAssets((current) =>
      current.map((item) =>
        selectedIds.has(item.asset.id)
          ? { ...item, asset: { ...item.asset, tags } }
          : item,
      ),
    );
    setMessage({ text: `${ids.length} dosyanın etiketleri güncellendi.` });
    setBusy(false);
  }

  async function deleteSelected() {
    const supabase = createSupabaseBrowserClient();
    setBusy(true);
    for (const id of selectedIds) {
      const item = assets.find((entry) => entry.asset.id === id);
      if (!item) continue;
      if (currentAvatarId === id) {
        const { error: avatarError } = await supabase
          .from('influencers')
          .update({ avatar_asset_id: null })
          .eq('id', influencerId);
        if (avatarError) {
          setMessage({
            text: 'Avatar bağlantısı kaldırılamadı; varlıklar korundu.',
            error: true,
          });
          setBusy(false);
          setConfirmBulkDelete(false);
          return;
        }
        setCurrentAvatarId(null);
      }
      const { error: storageError } = await supabase.storage
        .from('assets')
        .remove(
          [item.asset.storage_path, item.asset.thumbnail_path].filter(
            (path): path is string => Boolean(path),
          ),
        );
      if (storageError) {
        setMessage({
          text: 'Toplu silme durdu; bu dosya ve kalanlar korunuyor.',
          error: true,
        });
        setBusy(false);
        setConfirmBulkDelete(false);
        return;
      }
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) {
        setMessage({
          text: 'Dosya depodan silindi ancak metadata silinemedi; sayfayı yenileyin.',
          error: true,
        });
        setBusy(false);
        setConfirmBulkDelete(false);
        return;
      }
    }
    setAssets((current) =>
      current.filter(({ asset }) => !selectedIds.has(asset.id)),
    );
    setSelectedIds(new Set());
    setMessage({ text: 'Seçilen dosyalar silindi.' });
    setBusy(false);
    setConfirmBulkDelete(false);
  }

  async function updateAsset(
    item: AssetItem,
    values: {
      qc_status?: string;
      tags?: string[];
      qc_checklist?: Row<'assets'>['qc_checklist'];
      version_tag?: string | null;
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
    if (currentAvatarId === removing.asset.id) {
      const { error: avatarError } = await supabase
        .from('influencers')
        .update({ avatar_asset_id: null })
        .eq('id', influencerId);
      if (avatarError) {
        setMessage({
          text: 'Avatar bağlantısı kaldırılamadı; varlık korundu.',
          error: true,
        });
        setRemoving(null);
        return;
      }
      setCurrentAvatarId(null);
    }
    const { error: storageError } = await supabase.storage
      .from('assets')
      .remove(
        [removing.asset.storage_path, removing.asset.thumbnail_path].filter(
          (path): path is string => Boolean(path),
        ),
      );
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
        {returnTo && (
          <Link className="button button-quiet" href={returnTo}>
            Kuruluma dön
          </Link>
        )}
        {canEdit && (
          <label
            className={`file-dropzone ${dragging ? 'ring-2 ring-accent' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
              setDragging(true);
            }}
            onDragLeave={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              )
                setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void upload(event.dataTransfer.files);
            }}
          >
            <input
              aria-label="Görsel veya video yükle"
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
            <strong>
              {busy
                ? 'Yükleniyor…'
                : dragging
                  ? 'Dosyaları buraya bırakın'
                  : 'Dosya yükle'}
            </strong>
            <small>Sürükleyip bırakın veya seçin · en fazla 100 MB/dosya</small>
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
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            Etiket
            <select
              aria-label="Etikete göre filtrele"
              className="rounded-lg border border-line bg-surface px-3 py-2"
              onChange={(event) => setTagFilter(event.target.value)}
              value={tagFilter}
            >
              <option value="all">Tüm etiketler</option>
              {tagOptions.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            Tarih
            <select
              aria-label="Tarihe göre filtrele"
              className="rounded-lg border border-line bg-surface px-3 py-2"
              onChange={(event) => {
                setDateFilter(event.target.value);
                setFilterNow(Date.now());
              }}
              value={dateFilter}
            >
              <option value="all">Tüm tarihler</option>
              <option value="7">Son 7 gün</option>
              <option value="30">Son 30 gün</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          Ara
          <input
            aria-label="Medya etiketlerinde ve adlarında ara"
            className="rounded-lg border border-line bg-surface px-3 py-2"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Dosya adı veya etiket"
            value={search}
          />
        </label>
        <section className="rounded-xl border border-line p-4">
          <h3 className="font-semibold">Referans setlerini karşılaştır</h3>
          <p className="mt-1 text-sm text-muted">
            İki referans versiyonunu yan yana inceleyin.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Sol set
              <select
                aria-label="Sol referans seti"
                className="rounded-lg border border-line bg-surface px-3 py-2"
                onChange={(event) => setLeftVersion(event.target.value)}
                value={leftVersion}
              >
                <option value="">Versiyon seçin</option>
                {versionOptions.map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Sağ set
              <select
                aria-label="Sağ referans seti"
                className="rounded-lg border border-line bg-surface px-3 py-2"
                onChange={(event) => setRightVersion(event.target.value)}
                value={rightVersion}
              >
                <option value="">Versiyon seçin</option>
                {versionOptions.map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {leftVersion && rightVersion && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {[leftVersion, rightVersion].map((version, index) => {
                const versionAssets = assets.filter(
                  ({ asset }) =>
                    asset.kind === 'reference' && asset.version_tag === version,
                );
                return (
                  <section
                    aria-label={`Referans seti ${index === 0 ? 'sol' : 'sağ'} ${version}`}
                    className="rounded-lg border border-line p-3"
                    key={`${index}-${version}`}
                  >
                    <h4 className="mb-3 font-medium">{version}</h4>
                    {versionAssets.length ? (
                      <div className="grid grid-cols-2 gap-2">
                        {versionAssets.map(({ asset, url, thumbnailUrl }) => (
                          <div
                            className="relative aspect-square overflow-hidden rounded-lg bg-surface"
                            key={asset.id}
                          >
                            {thumbnailUrl || url ? (
                              <Image
                                alt={
                                  asset.storage_path.split('/').at(-1) ??
                                  'Referans görseli'
                                }
                                className="h-full w-full object-contain"
                                fill
                                src={thumbnailUrl ?? url!}
                                unoptimized
                              />
                            ) : (
                              <span className="grid h-full place-items-center text-xs text-muted">
                                Önizleme alınamadı
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted">
                        Bu sette referans yok.
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </section>
        {canEdit && selectedIds.size > 0 && (
          <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
            <label className="grid gap-1 text-sm">
              Seçilenlere etiket uygula
              <input
                className="rounded-lg border border-line bg-surface px-3 py-2"
                onChange={(event) => setBulkTags(event.target.value)}
                placeholder="etiket1, etiket2"
                value={bulkTags}
              />
            </label>
            <button
              className="button button-quiet"
              disabled={busy}
              onClick={() => void applyBulkTags()}
              type="button"
            >
              Etiketleri kaydet ({selectedIds.size})
            </button>
            <button
              className="button button-quiet"
              disabled={busy}
              onClick={() => setConfirmBulkDelete(true)}
              type="button"
            >
              Seçilenleri sil ({selectedIds.size})
            </button>
            <button
              className="button button-quiet"
              onClick={() => setSelectedIds(new Set())}
              type="button"
            >
              Seçimi temizle
            </button>
          </div>
        )}
      </section>
      {searched.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {searched.map((item) => (
            <article className="section-card space-y-3" key={item.asset.id}>
              {canEdit && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    checked={selectedIds.has(item.asset.id)}
                    onChange={(event) =>
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(item.asset.id);
                        else next.delete(item.asset.id);
                        return next;
                      })
                    }
                    type="checkbox"
                  />
                  Toplu işlem için seç
                </label>
              )}
              <div className="relative aspect-square overflow-hidden rounded-lg bg-surface">
                {item.url && item.asset.mime_type?.startsWith('video/') ? (
                  <video
                    className="h-full w-full object-contain"
                    controls
                    preload="metadata"
                    poster={item.thumbnailUrl ?? undefined}
                    src={item.url}
                  />
                ) : item.url ? (
                  <button
                    aria-label="Görseli büyüt"
                    className="absolute inset-0 h-full w-full"
                    onClick={() => setLightbox(item)}
                    type="button"
                  >
                    <Image
                      alt={
                        item.asset.storage_path.split('/').at(-1) ??
                        'Medya dosyası'
                      }
                      className="h-full w-full object-contain"
                      fill
                      src={item.thumbnailUrl ?? item.url}
                      unoptimized
                    />
                  </button>
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
              {item.asset.kind === 'reference' && canEdit && (
                <label className="grid gap-1 text-sm">
                  Referans versiyonu
                  <select
                    aria-label="Referans versiyonu"
                    className="rounded-lg border border-line bg-surface px-3 py-2"
                    onChange={(event) =>
                      void updateAsset(item, {
                        version_tag: event.target.value || null,
                      })
                    }
                    value={item.asset.version_tag ?? ''}
                  >
                    <option value="">Versiyonsuz</option>
                    {Array.from(
                      new Set([
                        'v1',
                        'v2',
                        'v3',
                        'v4',
                        ...(item.asset.version_tag
                          ? [item.asset.version_tag]
                          : []),
                      ]),
                    ).map((version) => (
                      <option key={version} value={version}>
                        {version}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {item.asset.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.asset.tags.map((tag) => (
                    <span className="soft-badge" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
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
                    {item.asset.kind === 'reference' && (
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
      {lightbox && lightbox.url && (
        <div
          aria-label="Görsel önizleme"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          role="dialog"
        >
          <div className="w-full max-w-5xl rounded-xl bg-surface p-4">
            <div className="mb-3 flex justify-end">
              <button
                aria-label="Önizlemeyi kapat"
                className="button button-quiet"
                onClick={() => setLightbox(null)}
                type="button"
              >
                Kapat
              </button>
            </div>
            <div className="relative max-h-[80vh] min-h-72 overflow-hidden">
              <Image
                alt={lightbox.asset.storage_path.split('/').at(-1) ?? 'Görsel'}
                className="h-full w-full object-contain"
                fill
                src={lightbox.url}
                unoptimized
              />
            </div>
          </div>
        </div>
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
      <ConfirmDialog
        open={confirmBulkDelete}
        title="Seçilen dosyalar silinsin mi?"
        description={`${selectedIds.size} dosya ve metadata kayıtları silinecek. Bu işlem geri alınamaz.`}
        confirmLabel="Seçilenleri sil"
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={() => void deleteSelected()}
      />
    </div>
  );
}
