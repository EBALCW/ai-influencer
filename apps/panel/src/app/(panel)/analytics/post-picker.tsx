'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { RecentPost } from '@/lib/analytics/queries';
import { analyticsHref, platformLabels } from '@/lib/analytics/links';
import {
  checkpointLabel,
  formatCount,
  formatDateTime,
} from '@/lib/analytics/metrics';

const MAX = 4;

/** Son postlar; 2–4 tanesi seçilip yan yana karşılaştırılabilir. */
export function PostPicker({
  posts,
  inf,
  targetHours,
}: {
  posts: RecentPost[];
  inf: string;
  targetHours: number;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected((value) =>
      value.includes(id)
        ? value.filter((item) => item !== id)
        : value.length >= MAX
          ? value
          : [...value, id],
    );
  const ready = selected.length >= 2;
  const showTarget = targetHours !== 1;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {ready ? (
          <Link
            className="button button-primary"
            href={analyticsHref('/analytics/compare', inf, {
              ids: selected.join(','),
            })}
          >
            Seçilenleri karşılaştır ({selected.length})
          </Link>
        ) : (
          <span className="text-sm text-muted">
            Karşılaştırmak için 2–4 post seçin.
          </span>
        )}
        {selected.length >= MAX && (
          <span className="text-sm text-muted" role="status">
            En fazla {MAX} post seçilebilir.
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th scope="col" className="p-2">
                <span className="sr-only">Seç</span>
              </th>
              <th scope="col" className="p-2">
                Post
              </th>
              <th scope="col" className="p-2">
                Hesap
              </th>
              <th scope="col" className="p-2">
                Yayın
              </th>
              <th scope="col" className="p-2">
                1 sa izlenme
              </th>
              {showTarget && (
                <th scope="col" className="p-2">
                  {checkpointLabel(targetHours)} izlenme
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => {
              const label = post.caption.trim() || 'Açıklamasız post';
              const checked = selected.includes(post.id);
              return (
                <tr className="border-t border-line" key={post.id}>
                  <td className="p-2">
                    <input
                      aria-label={`${label} karşılaştırmaya ekle`}
                      checked={checked}
                      disabled={!checked && selected.length >= MAX}
                      onChange={() => toggle(post.id)}
                      type="checkbox"
                    />
                  </td>
                  <td className="max-w-xs truncate p-2">
                    <Link
                      className="text-accent underline-offset-2 hover:underline"
                      href={analyticsHref(`/analytics/posts/${post.id}`, inf)}
                    >
                      {label}
                    </Link>
                  </td>
                  <td className="p-2">
                    {platformLabels[post.platform]} · {post.handle}
                  </td>
                  <td className="p-2">{formatDateTime(post.publishedAt)}</td>
                  <td className="p-2">{formatCount(post.views[1])}</td>
                  {showTarget && (
                    <td className="p-2">
                      {formatCount(post.views[targetHours])}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
