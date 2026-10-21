<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Panel kuralları

- **Stil:** Yeni bileşenlerde Tailwind utility kullan (`bg-surface`, `text-muted`, `border-line` …). Renkler `src/app/globals.css` içindeki CSS değişkenlerinden gelir ve açık/koyu temaya uyar. Hex renk yazma, `globals.css`'e yeni bileşen sınıfı ekleme. Metin renkleri WCAG AA (4.5:1) kontrastını sağlamalı.
- **Erişilebilirlik:** Sayfada tek `<main>` vardır (`PanelShell` içinde). `loading.tsx` / `error.tsx` ve sayfalar `<main>` açmaz. Etkileşimli öğeler gerçek `<button>`/`<a>` olsun; ne yaptığını söylemeyen buton koyma.
- **Influencer seçimi:** Seçim URL'de `?inf=<slug>` ile taşınır. İç linklerde bu parametreyi koru (`panel-shell.tsx` → `withInfluencer`).
- **Sahte veri yok:** Gerçek kişi adı veya uydurma metrik sabit kodlama. Henüz veri yoksa boş durum (`EmptyState`) göster. Demo içerik gerekiyorsa `supabase/seed.sql`'deki kayıtlarla aynı olsun.
- **Veritabanı tipleri:** `@ai-influencer/shared` üzerinden import et (`Row<'influencers'>`, `TeamRole`). `packages/shared/src/database.types.ts` üretilmiş dosyadır, elle düzenleme.
