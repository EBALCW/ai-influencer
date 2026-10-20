import { Activity, ArrowUpRight, Clapperboard, Sparkles } from 'lucide-react';
import { getPanelGreeting } from '@ai-influencer/shared';

const modules = [
  {
    label: 'Karakter stüdyosu',
    icon: Sparkles,
    status: 'Hazır olduğunda burada',
  },
  { label: 'İçerik akışı', icon: Clapperboard, status: 'Kurulum aşamasında' },
  { label: 'Performans', icon: Activity, status: 'Hesap bağlandıktan sonra' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-canvas text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(87,104,204,0.18),transparent_40%),radial-gradient(ellipse_at_90%_80%,rgba(70,180,152,0.10),transparent_35%)]" />
      <div className="relative mx-auto max-w-7xl px-6 py-7 sm:px-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <a
            className="flex items-center gap-3"
            href="#home"
            aria-label="Ana sayfa"
          >
            <span className="grid size-10 place-items-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
              <Sparkles size={19} />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-wide">
                INFLUENCER STUDIO
              </span>
              <span className="text-xs text-slate-400">
                {getPanelGreeting()}
              </span>
            </span>
          </a>
          <span className="rounded-full border border-mint/20 bg-mint/10 px-3 py-1.5 text-xs font-medium text-mint">
            Geliştirme ortamı
          </span>
        </header>

        <section className="grid gap-12 py-16 md:grid-cols-[1.15fr_0.85fr] md:items-end md:py-24">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
              <span className="size-1.5 rounded-full bg-mint" />
              Ortak üretim alanınız hazır
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              Fikirden yayına,
              <span className="block bg-gradient-to-r from-accent to-mint bg-clip-text text-transparent">
                tek bir stüdyoda.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-400">
              Karakterlerinizi, içerik üretimini ve performansı aynı çalışma
              alanında yönetin. Panel temeli kuruldu; modüller sırayla
              eklenecek.
            </p>
            <a
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              href="https://github.com/EBALCW/ai-influencer/issues"
              target="_blank"
              rel="noreferrer"
            >
              Yol haritasını gör <ArrowUpRight size={16} />
            </a>
          </div>

          <div className="rounded-3xl border border-white/10 bg-surface/80 p-5 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-sm font-medium">Çalışma alanı</p>
                <p className="mt-1 text-xs text-slate-400">
                  İlk modüller hazırlanıyor
                </p>
              </div>
              <span className="text-xs text-slate-500">01 / 03</span>
            </div>
            <div className="space-y-3 pt-4">
              {modules.map(({ label, icon: Icon, status }, index) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-slate-300">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {status}
                    </span>
                  </span>
                  <span className="text-xs text-slate-600">0{index + 1}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-xl bg-black/20 px-4 py-3 text-xs leading-5 text-slate-500">
              Veriler Supabase üzerinde ortak tutulacak. Henüz hiçbir sosyal
              hesap bağlı değil.
            </p>
          </div>
        </section>

        <footer className="border-t border-white/10 py-5 text-xs text-slate-600">
          AI Influencer Studio <span className="mx-2 text-slate-700">·</span>{' '}
          Yerel geliştirme iskeleti
        </footer>
      </div>
    </main>
  );
}
