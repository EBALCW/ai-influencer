'use client';

import { useState, type FormEvent } from 'react';
import { safeNextPath } from '@/lib/safe-redirect';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type LoginFormProps = { nextPath?: string };

export function LoginForm({ nextPath }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');

    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = new URL('/auth/callback', window.location.origin);
      redirectTo.searchParams.set('next', safeNextPath(nextPath));
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: redirectTo.toString(),
          shouldCreateUser: false,
        },
      });
      // Davetli ve davetsiz e-postalar için aynı yanıt: kimin ekipte olduğu sızmasın
      if (error) console.warn('[login] magic link:', error.status);
      setMessage(
        'Bu e-posta ekipte kayıtlıysa giriş bağlantısı gönderildi. Gelen kutunu kontrol et.',
      );
    } catch {
      setMessage(
        'Giriş şu anda kullanılamıyor. Supabase ayarlarını kontrol et.',
      );
    } finally {
      setPending(false);
    }
  }

  async function signInWithGoogle() {
    setPending(true);
    setMessage('');
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = new URL('/auth/callback', window.location.origin);
      redirectTo.searchParams.set('next', safeNextPath(nextPath));
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo.toString() },
      });
      if (error) setMessage('Google girişi başlatılamadı.');
    } catch {
      setMessage('Google girişi şu anda kullanılamıyor.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-8 space-y-5">
      <form onSubmit={sendMagicLink} className="space-y-3">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-slate-200"
        >
          E-posta adresi
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-mint/60 focus:ring-2 focus:ring-mint/20"
          placeholder="ad@ekip.com"
        />
        <button
          className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-wait disabled:opacity-60"
          type="submit"
          disabled={pending}
        >
          {pending ? 'Gönderiliyor…' : 'E-posta bağlantısı gönder'}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-slate-600">
        <span className="h-px flex-1 bg-white/10" />
        veya
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <button
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-60"
        type="button"
        disabled={pending}
        onClick={signInWithGoogle}
      >
        Google ile devam et
      </button>
      {message && (
        <p role="status" className="text-sm leading-6 text-mint">
          {message}
        </p>
      )}
    </div>
  );
}
