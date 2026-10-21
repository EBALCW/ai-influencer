'use client';

import {
  useMemo,
  useState,
  type ChangeEvent,
  type ComponentType,
  type SVGProps,
} from 'react';
import { Search } from 'lucide-react';

type IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }
>;

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'violet',
}: {
  label: string;
  value: string;
  detail: string;
  icon: IconComponent;
  tone?: 'violet' | 'blue' | 'mint';
}) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span>{label}</span>
        <span className={`stat-icon stat-icon-${tone}`}>
          <Icon size={18} />
        </span>
      </div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-detail">{detail}</span>
    </article>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-mark">✦</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Toast({
  message,
  tone = 'success',
  onDismiss,
}: {
  message: string;
  tone?: 'success' | 'error';
  onDismiss?: () => void;
}) {
  return (
    <div className={`toast toast-${tone}`} role="status" aria-live="polite">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" aria-label="Bildirimi kapat" onClick={onDismiss}>
          ×
        </button>
      )}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="dialog-backdrop"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        aria-labelledby="confirm-title"
        aria-modal="true"
        className="confirm-dialog"
        role="dialog"
      >
        <h2 id="confirm-title">{title}</h2>
        <p>{description}</p>
        <div className="dialog-actions">
          <button
            autoFocus
            className="button button-quiet"
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className="button button-primary"
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function FileDropzone({
  label = 'Dosya seçin',
  accept,
  onFiles,
}: {
  label?: string;
  accept?: string;
  onFiles?: (files: FileList) => void;
}) {
  const [fileName, setFileName] = useState('');
  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length) return;
    setFileName(
      files.length === 1
        ? (files.item(0)?.name ?? label)
        : `${files.length} dosya seçildi`,
    );
    onFiles?.(files);
  }
  return (
    <label className="file-dropzone">
      <input accept={accept} onChange={onChange} type="file" multiple />
      <span className="file-dropzone-mark">＋</span>
      <strong>{fileName || label}</strong>
      <small>Dosyaları buraya bırakın veya göz atın</small>
    </label>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
  pageSize = 6,
  emptyMessage = 'Gösterilecek kayıt yok',
}: {
  rows: T[];
  columns: Array<{
    key: keyof T;
    label: string;
    render?: (value: T[keyof T], row: T) => React.ReactNode;
  }>;
  pageSize?: number;
  emptyMessage?: string;
}) {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase('tr');
    const matches = rows.filter(
      (row) =>
        !needle ||
        columns.some(({ key }) =>
          String(row[key] ?? '')
            .toLocaleLowerCase('tr')
            .includes(needle),
        ),
    );
    if (sortKey)
      matches.sort(
        (a, b) =>
          String(a[sortKey] ?? '').localeCompare(
            String(b[sortKey] ?? ''),
            'tr',
            { numeric: true },
          ) * (descending ? -1 : 1),
      );
    return matches;
  }, [rows, columns, filter, sortKey, descending]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="data-table-wrap">
      <label className="table-search">
        <Search size={16} />
        <input
          aria-label="Tabloda ara"
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(0);
          }}
          placeholder="Tabloda ara…"
          value={filter}
        />
      </label>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(({ key, label }) => (
                <th key={String(key)}>
                  <button
                    type="button"
                    onClick={() => {
                      setDescending((value) =>
                        sortKey === key ? !value : false,
                      );
                      setSortKey(key);
                    }}
                  >
                    {label}
                    {sortKey === key ? (descending ? ' ↓' : ' ↑') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <tr key={index}>
                {columns.map(({ key, render }) => (
                  <td key={String(key)}>
                    {render ? render(row[key], row) : String(row[key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length === 0 ? (
        <p className="table-empty">{emptyMessage}</p>
      ) : (
        <div className="table-footer">
          <span>{filtered.length} kayıt</span>
          <div>
            <button
              className="button button-quiet"
              disabled={page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              type="button"
            >
              Önceki
            </button>
            <span>
              {page + 1} / {pageCount}
            </span>
            <button
              className="button button-quiet"
              disabled={page >= pageCount - 1}
              onClick={() =>
                setPage((value) => Math.min(pageCount - 1, value + 1))
              }
              type="button"
            >
              Sonraki
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
