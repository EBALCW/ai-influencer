import { getSupabasePublicEnv } from '@/lib/supabase/env';
import { LoginForm } from './login-form';

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, next } = await searchParams;
  const configured = Boolean(getSupabasePublicEnv());

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-surface/90 p-8 shadow-2xl shadow-black/30">
        <p className="text-xs font-semibold tracking-[0.2em] text-mint">
          INFLUENCER STUDIO
        </p>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">
          Ekip alanına giriş
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Devam etmek için ekip davetinde kullandığın e-posta adresini yaz.
        </p>

        {!configured ? (
          <p className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
            Giriş için Supabase URL ve anon key değerlerini .env.local dosyasına
            ekle.
          </p>
        ) : (
          <LoginForm nextPath={next} />
        )}

        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          Yeni hesap oluşturma kapalıdır. Sadece davet edilen ekip üyeleri giriş
          yapabilir.
        </p>

        {error === 'not_allowed' && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-red-400/10 p-4 text-sm text-red-200"
          >
            Bu e-posta ekip üyesi değil. Ekip sahibinden davet iste.
          </p>
        )}
        {error === 'not_configured' && configured && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-amber-300/10 p-4 text-sm text-amber-100"
          >
            Supabase oturumu başlatılamadı. Ayarları kontrol edip tekrar dene.
          </p>
        )}
      </section>
    </main>
  );
}
