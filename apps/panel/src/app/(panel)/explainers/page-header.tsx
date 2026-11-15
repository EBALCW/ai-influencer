import Link from 'next/link';

/** Alt sayfa başlığı: geri bağlantısı (kırıntı), başlık, açıklama ve eylemler. */
export function SubHeader({
  crumbs,
  title,
  description,
  children,
}: {
  crumbs: Array<{ href: string; label: string }>;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div className="min-w-0">
        <nav aria-label="Konum" className="eyebrow">
          {crumbs.map((crumb, index) => (
            <span key={crumb.href}>
              {index > 0 && <span aria-hidden="true"> / </span>}
              <Link className="hover:underline" href={crumb.href}>
                {crumb.label}
              </Link>
            </span>
          ))}
        </nav>
        <h1 className="break-words">{title}</h1>
        <p>{description}</p>
      </div>
      {children && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {children}
        </div>
      )}
    </header>
  );
}

export function ReadOnlyNote() {
  return (
    <p
      className="m-0 rounded-xl border border-line bg-surface-raised p-3 text-sm text-text"
      role="note"
    >
      İzleyici rolündesiniz: bu sayfayı okuyabilir, değişiklik yapamazsınız.
    </p>
  );
}
