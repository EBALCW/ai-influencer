'use client';

import { useEffect } from 'react';
import { CircleAlert, RotateCcw } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Panel route error:', error);
  }, [error]);
  return (
    <main className="section-card section-empty-card" role="alert">
      <div className="empty-state">
        <span className="section-hero-icon">
          <CircleAlert size={23} />
        </span>
        <h3>Sayfa yüklenemedi</h3>
        <p>
          Beklenmeyen bir hata oluştu. Tekrar deneyebilir veya daha sonra
          yeniden açabilirsiniz.
        </p>
        <button
          className="button button-primary"
          onClick={() => reset()}
          type="button"
        >
          <RotateCcw size={14} /> Tekrar dene
        </button>
      </div>
    </main>
  );
}
