'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Search, UploadCloud } from 'lucide-react';
import { messages } from '../lib/messages';

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.07] bg-panel p-5 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-400">{label}</p>
        <span className="grid size-9 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.035] text-slate-300">
          {icon}
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
    </article>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-violet-200">
        {icon}
      </span>
      <h2 className="mt-5 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  pageSize = 8,
}: {
  columns: Array<{
    key: keyof T;
    label: string;
    render?: (row: T) => ReactNode;
  }>;
  rows: T[];
  pageSize?: number;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<keyof T | null>(null);
  const [ascending, setAscending] = useState(true);
  const filtered = useMemo(() => {
    const matching = rows.filter((row) =>
      columns.some((column) =>
        String(row[column.key] ?? '')
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    );
    if (!sort) return matching;
    return [...matching].sort((left, right) => {
      const a = String(left[sort] ?? '');
      const b = String(right[sort] ?? '');
      return (
        (a.localeCompare(b, 'tr', { numeric: true }) || 0) *
        (ascending ? 1 : -1)
      );
    });
  }, [ascending, columns, query, rows, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-panel">
      <label className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3 text-slate-500">
        <Search size={15} aria-hidden="true" />
        <input
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          placeholder={messages.common.search}
          aria-label={messages.common.search}
        />
      </label>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.025] text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th className="px-4 py-3 font-medium" key={String(column.key)}>
                  <button
                    className="hover:text-white"
                    onClick={() => {
                      setAscending(sort === column.key ? !ascending : true);
                      setSort(column.key);
                    }}
                  >
                    {column.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] text-slate-300">
            {visible.map((row) => (
              <tr key={row.id} className="hover:bg-white/[0.02]">
                {columns.map((column) => (
                  <td className="px-4 py-3.5" key={String(column.key)}>
                    {column.render
                      ? column.render(row)
                      : String(row[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-10 text-center text-slate-500"
                  colSpan={columns.length}
                >
                  {messages.common.noResults}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 text-xs text-slate-500">
        <span>{filtered.length} kayıt</span>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-white/[0.08] px-3 py-1.5 disabled:opacity-40"
            disabled={page === 0}
            onClick={() => setPage((current) => current - 1)}
          >
            {messages.common.previous}
          </button>
          <button
            className="rounded-lg border border-white/[0.08] px-3 py-1.5 disabled:opacity-40"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            {messages.common.next}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-6 shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
      >
        <h2 id="confirm-title" className="text-lg font-semibold text-white">
          {title}
        </h2>
        <p
          id="confirm-description"
          className="mt-2 text-sm leading-6 text-slate-400"
        >
          {description}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
            onClick={onClose}
          >
            {messages.common.cancel}
          </button>
          <button
            className="rounded-xl bg-violet-300 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-violet-200"
            onClick={onConfirm}
          >
            {messages.common.confirm}
          </button>
        </div>
      </section>
    </div>
  );
}

export function Toast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm text-white shadow-2xl"
      role="status"
    >
      <span className="size-2 rounded-full bg-emerald-300" />
      {message}
      <button
        className="ml-2 text-slate-400 hover:text-white"
        onClick={onClose}
        aria-label={messages.common.close}
      >
        ×
      </button>
    </div>
  );
}

export function FileDropzone({
  label,
  onFiles,
}: {
  label: string;
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-sm text-slate-400 hover:border-violet-300/50 hover:bg-violet-300/[0.03]">
      <UploadCloud size={21} className="text-violet-200" />
      <span>{label}</span>
      <input
        className="sr-only"
        type="file"
        multiple
        onChange={(event) => onFiles(event.target.files)}
      />
    </label>
  );
}

export function LoadingSkeleton({ children }: { children?: ReactNode }) {
  return (
    <div
      className="animate-pulse space-y-4"
      aria-label={messages.common.loading}
    >
      {children ?? (
        <>
          <div className="h-8 w-48 rounded-lg bg-white/[0.06]" />
          <div className="h-40 rounded-2xl bg-white/[0.04]" />
        </>
      )}
    </div>
  );
}
