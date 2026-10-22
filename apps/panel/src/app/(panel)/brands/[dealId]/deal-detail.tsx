'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import type { TeamRole } from '@ai-influencer/shared';
import { EmptyState, Toast } from '@/components/ui';
import {
  CONTRACT_BUCKET,
  CONTRACT_MIME_TYPES,
  CONTRACT_URL_TTL_SECONDS,
  contractStoragePath,
  displayFileName,
  validateContractFile,
} from '@/lib/brands/files';
import type { DealDetail } from '@/lib/brands/queries';
import {
  briefFields,
  dealCurrencies,
  dealStageLabels,
  dealStages,
  type Brief,
  type Deliverable,
} from '@/lib/brands/schemas';
import type { ReplyTemplate } from '@/lib/brands/templates';
import { formatMoney, fromMinor, toMinor } from '@/lib/costs/money';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { brandRequest, fieldClass, labelClass, useMutation } from '../request';

type Mutation = ReturnType<typeof useMutation>;

export function DealDetailView({
  detail,
  role,
  templates,
}: {
  detail: DealDetail;
  role: TeamRole;
  templates: ReplyTemplate[];
}) {
  const { deal, brand } = detail;
  const canEdit = role !== 'viewer';
  const mutation = useMutation();
  const patch = (body: unknown, done: string) =>
    mutation.run(
      () => brandRequest(`/api/brand-deals/${deal.id}`, 'PATCH', body),
      done,
    );
  const back = `/brands${deal.influencerSlug ? `?inf=${encodeURIComponent(deal.influencerSlug)}` : ''}`;

  return (
    <article className="page-stack" aria-labelledby="deal-title">
      <header className="page-heading">
        <div>
          <p className="eyebrow">MARKA İŞ BİRLİĞİ</p>
          <h1 id="deal-title">{brand.name}</h1>
          <p>
            {deal.influencerName} · {dealStageLabels[deal.stage]} ·{' '}
            {deal.fee === null
              ? 'Ücret girilmedi'
              : formatMoney(deal.fee, deal.currency)}
            {deal.paidAt ? ` · Ödeme ${deal.paidAt}` : ''}
          </p>
        </div>
        <Link className="button button-quiet" href={back}>
          ← Markalar
        </Link>
      </header>

      <section className="section-card" aria-labelledby="deal-info-title">
        <h2 id="deal-info-title" className="mb-3 text-base font-semibold">
          Deal bilgileri
        </h2>
        <DealInfoForm
          key={deal.updatedAt}
          canEdit={canEdit}
          detail={detail}
          mutation={mutation}
          patch={patch}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="section-card" aria-labelledby="brief-title">
          <h2 id="brief-title" className="mb-3 text-base font-semibold">
            Brief
          </h2>
          <BriefForm
            brief={deal.brief}
            canEdit={canEdit}
            mutation={mutation}
            patch={patch}
          />
        </section>
        <div className="grid content-start gap-4">
          <section
            className="section-card"
            aria-labelledby="deliverables-title"
          >
            <h2
              id="deliverables-title"
              className="mb-3 text-base font-semibold"
            >
              Teslimatlar
            </h2>
            <Deliverables
              canEdit={canEdit}
              items={deal.deliverables}
              mutation={mutation}
              patch={patch}
            />
          </section>
          <section className="section-card" aria-labelledby="content-title">
            <h2 id="content-title" className="mb-3 text-base font-semibold">
              Bağlı içerik kartları
            </h2>
            <LinkedContent
              canEdit={canEdit}
              detail={detail}
              mutation={mutation}
            />
          </section>
          <section className="section-card" aria-labelledby="files-title">
            <h2 id="files-title" className="mb-3 text-base font-semibold">
              Sözleşme ve dosyalar
            </h2>
            <Files canEdit={canEdit} detail={detail} mutation={mutation} />
          </section>
          <section className="section-card" aria-labelledby="contact-title">
            <h2 id="contact-title" className="mb-3 text-base font-semibold">
              Marka iletişimi
            </h2>
            <dl className="grid gap-1 text-sm">
              <dt className="text-muted">İletişim kişisi</dt>
              <dd className="m-0">{brand.contact_name || '—'}</dd>
              <dt className="text-muted">E-posta</dt>
              <dd className="m-0">{brand.contact_email || '—'}</dd>
              <dt className="text-muted">Web sitesi</dt>
              <dd className="m-0">
                {brand.website && /^https?:\/\//i.test(brand.website) ? (
                  <a
                    className="text-accent underline"
                    href={brand.website}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {brand.website}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
              <dt className="text-muted">Araştırma notları</dt>
              <dd className="m-0 whitespace-pre-wrap">{brand.notes || '—'}</dd>
            </dl>
          </section>
        </div>
      </div>

      <section className="section-card" aria-labelledby="templates-title">
        <h2 id="templates-title" className="mb-3 text-base font-semibold">
          Yanıt şablonları
        </h2>
        <Templates templates={templates} />
      </section>

      {mutation.message && (
        <Toast
          message={mutation.message.text}
          tone={mutation.message.error ? 'error' : 'success'}
          onDismiss={mutation.clearMessage}
        />
      )}
    </article>
  );
}

function DealInfoForm({
  detail,
  canEdit,
  mutation,
  patch,
}: {
  detail: DealDetail;
  canEdit: boolean;
  mutation: Mutation;
  patch: (body: unknown, done: string) => Promise<boolean>;
}) {
  const { deal } = detail;
  const [stage, setStage] = useState(deal.stage);
  const disabled = !canEdit || mutation.pending;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fee = String(data.get('fee') ?? '')
      .trim()
      .replace(',', '.');
    const body: Record<string, unknown> = {
      stage,
      fee: fee || null,
      currency: data.get('currency'),
      dueDate: data.get('dueDate') || null,
      notes: data.get('notes') ?? '',
    };
    // Boş bırakılırsa veritabanı paid'e geçişte bugünü yazar
    if (stage === 'paid') body.paidAt = data.get('paidAt') || null;
    void patch(body, 'Deal kaydedildi.');
  }

  return (
    <form
      aria-label="Deal bilgileri formu"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={onSubmit}
    >
      <label className={labelClass}>
        Aşama
        <select
          className={fieldClass}
          disabled={disabled}
          name="stage"
          onChange={(event) => setStage(event.target.value as typeof stage)}
          value={stage}
        >
          {dealStages.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Ücret
        <input
          className={fieldClass}
          defaultValue={
            deal.fee === null ? '' : fromMinor(toMinor(deal.fee)).slice(0, -2)
          }
          disabled={disabled}
          inputMode="decimal"
          name="fee"
        />
      </label>
      <label className={labelClass}>
        Para birimi
        <select
          className={fieldClass}
          defaultValue={deal.currency}
          disabled={disabled}
          name="currency"
        >
          {dealCurrencies.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Son teslim tarihi
        <input
          className={fieldClass}
          defaultValue={deal.dueDate ?? ''}
          disabled={disabled}
          name="dueDate"
          type="date"
        />
      </label>
      <label className={labelClass}>
        Ödeme tarihi
        <input
          className={fieldClass}
          defaultValue={deal.paidAt ?? ''}
          disabled={disabled || stage !== 'paid'}
          name="paidAt"
          type="date"
        />
      </label>
      <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
        Notlar
        <textarea
          className={fieldClass}
          defaultValue={deal.notes}
          disabled={disabled}
          maxLength={5000}
          name="notes"
          rows={3}
        />
      </label>
      {canEdit && (
        <div>
          <button
            className="button button-primary"
            disabled={disabled}
            type="submit"
          >
            Deal’i kaydet
          </button>
        </div>
      )}
    </form>
  );
}

function BriefForm({
  brief,
  canEdit,
  mutation,
  patch,
}: {
  brief: Brief;
  canEdit: boolean;
  mutation: Mutation;
  patch: (body: unknown, done: string) => Promise<boolean>;
}) {
  const disabled = !canEdit || mutation.pending;
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: Brief = {};
    for (const [key] of briefFields) {
      const value = String(data.get(key) ?? '').trim();
      if (value) next[key] = value;
    }
    void patch({ brief: next }, 'Brief kaydedildi.');
  }
  return (
    <form aria-label="Brief formu" className="grid gap-3" onSubmit={onSubmit}>
      {briefFields.map(([key, label]) => (
        <label className={labelClass} key={key}>
          {label}
          <textarea
            className={fieldClass}
            defaultValue={brief[key] ?? ''}
            disabled={disabled}
            maxLength={4000}
            name={key}
            rows={2}
          />
        </label>
      ))}
      {canEdit && (
        <div>
          <button
            className="button button-primary"
            disabled={disabled}
            type="submit"
          >
            Brief’i kaydet
          </button>
        </div>
      )}
    </form>
  );
}

function Deliverables({
  items,
  canEdit,
  mutation,
  patch,
}: {
  items: Deliverable[];
  canEdit: boolean;
  mutation: Mutation;
  patch: (body: unknown, done: string) => Promise<boolean>;
}) {
  const disabled = !canEdit || mutation.pending;
  const save = (next: Deliverable[], done: string) =>
    patch({ deliverables: next }, done);
  return (
    <>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Henüz teslimat eklenmedi.</p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {items.map((item, index) => (
            <li
              className="flex items-center justify-between gap-2 text-sm"
              key={`${item.title}-${index}`}
            >
              <label className="flex items-center gap-2">
                <input
                  checked={item.done}
                  disabled={disabled}
                  onChange={(event) =>
                    void save(
                      items.map((value, i) =>
                        i === index
                          ? { ...value, done: event.target.checked }
                          : value,
                      ),
                      'Teslimat güncellendi.',
                    )
                  }
                  type="checkbox"
                />
                <span className={item.done ? 'line-through' : undefined}>
                  {item.title}
                </span>
              </label>
              {canEdit && (
                <button
                  aria-label={`${item.title} teslimatını sil`}
                  className="button button-quiet"
                  disabled={disabled}
                  onClick={() =>
                    void save(
                      items.filter((_, i) => i !== index),
                      'Teslimat silindi.',
                    )
                  }
                  type="button"
                >
                  Sil
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const title = String(new FormData(form).get('title') ?? '').trim();
            if (!title) return;
            const ok = await save(
              [...items, { title, done: false }],
              'Teslimat eklendi.',
            );
            if (ok) form.reset();
          }}
        >
          <label className="sr-only" htmlFor="deliverable-title">
            Yeni teslimat
          </label>
          <input
            className={fieldClass}
            disabled={disabled}
            id="deliverable-title"
            maxLength={200}
            name="title"
            placeholder="ör. 1 Reels + 3 Story"
          />
          <button
            className="button button-primary mt-1"
            disabled={disabled}
            type="submit"
          >
            Teslimat ekle
          </button>
        </form>
      )}
    </>
  );
}

function LinkedContent({
  detail,
  canEdit,
  mutation,
}: {
  detail: DealDetail;
  canEdit: boolean;
  mutation: Mutation;
}) {
  const url = `/api/brand-deals/${detail.deal.id}/content-items`;
  const disabled = !canEdit || mutation.pending;
  const contentHref = `/content?inf=${encodeURIComponent(detail.deal.influencerSlug)}`;
  return (
    <>
      {detail.linkedContent.length === 0 ? (
        <p className="text-sm text-muted">Bu deal’e bağlı içerik yok.</p>
      ) : (
        <ul
          className="m-0 grid list-none gap-2 p-0"
          aria-label="Bağlı içerikler"
        >
          {detail.linkedContent.map((item) => (
            <li
              className="flex items-center justify-between gap-2 text-sm"
              key={item.contentItemId}
            >
              <span>
                <Link className="underline" href={contentHref}>
                  {item.title}
                </Link>{' '}
                <span className="text-xs text-muted">({item.stage})</span>
              </span>
              {canEdit && (
                <button
                  aria-label={`${item.title} bağlantısını kaldır`}
                  className="button button-quiet"
                  disabled={disabled}
                  onClick={() =>
                    void mutation.run(
                      () =>
                        brandRequest(url, 'DELETE', {
                          contentItemId: item.contentItemId,
                        }),
                      'Bağlantı kaldırıldı.',
                    )
                  }
                  type="button"
                >
                  Kaldır
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit &&
        (detail.availableContent.length ? (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const contentItemId = new FormData(event.currentTarget).get(
                'contentItemId',
              );
              void mutation.run(
                () => brandRequest(url, 'POST', { contentItemId }),
                'İçerik bağlandı.',
              );
            }}
          >
            <label className="sr-only" htmlFor="link-content">
              Bağlanacak içerik
            </label>
            <select
              className={fieldClass}
              disabled={disabled}
              id="link-content"
              name="contentItemId"
            >
              {detail.availableContent.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <button
              className="button button-primary mt-1"
              disabled={disabled}
              type="submit"
            >
              İçerik bağla
            </button>
          </form>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Bağlanabilecek içerik kartı yok.{' '}
            <Link className="underline" href={contentHref}>
              İçerik oluştur
            </Link>
          </p>
        ))}
    </>
  );
}

function Files({
  detail,
  canEdit,
  mutation,
}: {
  detail: DealDetail;
  canEdit: boolean;
  mutation: Mutation;
}) {
  const [downloadError, setDownloadError] = useState('');
  const disabled = !canEdit || mutation.pending;
  const dealId = detail.deal.id;

  async function upload(file: File) {
    const problem = validateContractFile(file);
    if (problem) throw new Error(problem);
    const supabase = createSupabaseBrowserClient();
    const path = contractStoragePath(dealId, crypto.randomUUID(), file.type);
    const { error: uploadError } = await supabase.storage
      .from(CONTRACT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error('Dosya yüklenemedi.');
    const { error } = await supabase.from('brand_deal_files').insert({
      brand_deal_id: dealId,
      storage_path: path,
      file_name: displayFileName(file.name),
      mime_type: file.type,
      file_size_bytes: file.size,
    });
    if (error) {
      // Kayıt yazılamadıysa yetim nesne bırakma
      await supabase.storage.from(CONTRACT_BUCKET).remove([path]);
      throw new Error('Dosya kaydı oluşturulamadı.');
    }
  }

  async function remove(id: string, path: string) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('brand_deal_files')
      .delete()
      .eq('id', id);
    if (error) throw new Error('Dosya kaydı silinemedi.');
    const { error: storageError } = await supabase.storage
      .from(CONTRACT_BUCKET)
      .remove([path]);
    if (storageError) throw new Error('Kayıt silindi, dosya temizlenemedi.');
  }

  async function download(path: string) {
    setDownloadError('');
    const { data, error } = await createSupabaseBrowserClient()
      .storage.from(CONTRACT_BUCKET)
      .createSignedUrl(path, CONTRACT_URL_TTL_SECONDS, { download: true });
    if (error || !data) {
      setDownloadError('İndirme bağlantısı oluşturulamadı.');
      return;
    }
    window.location.assign(data.signedUrl);
  }

  return (
    <>
      {detail.files.length === 0 ? (
        <EmptyState
          title="Dosya yok"
          description="Sözleşme veya brief dosyasını buraya yükle. Dosyalar gizli tutulur, indirme bağlantısı 60 saniye geçerlidir."
        />
      ) : (
        <ul
          className="m-0 grid list-none gap-2 p-0"
          aria-label="Deal dosyaları"
        >
          {detail.files.map((file) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
              key={file.id}
            >
              <span>{file.file_name}</span>
              <span className="flex gap-2">
                <button
                  aria-label={`${file.file_name} dosyasını indir`}
                  className="button button-quiet"
                  onClick={() => void download(file.storage_path)}
                  type="button"
                >
                  İndir
                </button>
                {canEdit && (
                  <button
                    aria-label={`${file.file_name} dosyasını sil`}
                    className="button button-quiet"
                    disabled={disabled}
                    onClick={() =>
                      void mutation.run(
                        () => remove(file.id, file.storage_path),
                        'Dosya silindi.',
                      )
                    }
                    type="button"
                  >
                    Sil
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {downloadError && (
        <p className="mt-2 text-sm text-text" role="alert">
          {downloadError}
        </p>
      )}
      {canEdit && (
        <label className={`${labelClass} mt-3`}>
          Sözleşme yükle (PDF, DOCX, JPEG, PNG · en fazla 20 MB)
          <input
            accept={CONTRACT_MIME_TYPES.join(',')}
            className={fieldClass}
            disabled={disabled}
            onChange={(event) => {
              const input = event.currentTarget;
              const file = input.files?.item(0);
              if (!file) return;
              void mutation
                .run(() => upload(file), 'Dosya yüklendi.')
                .finally(() => {
                  input.value = '';
                });
            }}
            type="file"
          />
        </label>
      )}
    </>
  );
}

function Templates({ templates }: { templates: ReplyTemplate[] }) {
  const [copied, setCopied] = useState('');
  if (!templates.length)
    return (
      <p className="text-sm text-muted">
        Şablon bulunamadı (templates/brand-replies.md).
      </p>
    );
  return (
    <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
      {templates.map((template) => (
        <li
          className="rounded-xl border border-line bg-surface p-3"
          key={template.title}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{template.title}</h3>
            <button
              aria-label={`${template.title} şablonunu kopyala`}
              className="button button-quiet"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(template.body);
                  setCopied(template.title);
                } catch {
                  setCopied('');
                }
              }}
              type="button"
            >
              {copied === template.title ? 'Kopyalandı' : 'Kopyala'}
            </button>
          </div>
          <pre className="m-0 max-h-56 overflow-auto whitespace-pre-wrap text-xs text-muted">
            {template.body}
          </pre>
        </li>
      ))}
    </ul>
  );
}
