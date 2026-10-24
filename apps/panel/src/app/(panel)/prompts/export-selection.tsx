'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

/**
 * Listedeki işaretli prompt'ları (`name="id"` checkbox'ları) `/api/prompts/export`'a
 * GET ile gönderir; tarayıcı dosyayı indirir. Seçim yoksa buton pasif kalır.
 */
export function ExportSelection({
  inf,
  children,
  footer,
}: {
  inf: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const [count, setCount] = useState(0);
  return (
    <form
      action="/api/prompts/export"
      aria-label="Prompt dışa aktarma seçimi"
      method="get"
      onChange={(event) =>
        setCount(
          event.currentTarget.querySelectorAll('input[name="id"]:checked')
            .length,
        )
      }
    >
      {inf && <input name="inf" type="hidden" value={inf} />}
      {children}
      <div className="table-footer">
        {footer}
        <button
          className="button button-quiet"
          disabled={count === 0}
          type="submit"
        >
          <Download size={16} /> Seçilenleri dışa aktar
          {count ? ` (${count})` : ''}
        </button>
      </div>
    </form>
  );
}
