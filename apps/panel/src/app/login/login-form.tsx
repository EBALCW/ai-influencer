'use client';

import { useState, type FormEvent } from 'react';
import { ArrowRight, LoaderCircle, Mail, Sparkles } from 'lucide-react';
import { authMessages } from '@/lib/auth-messages';
import { isSafeNextPath } from '@/lib/auth-redirect';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import styles from './login.module.css';

export function LoginForm({
  isConfigured,
  nextPath,
  initialError = '',
}: {
  isConfigured: boolean;
  nextPath?: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(initialError);
  function getCallbackUrl() {
    const callback = new URL('/auth/callback', window.location.origin);
    if (isSafeNextPath(nextPath)) callback.searchParams.set('next', nextPath);
    return callback.toString();
  }

  async function sendEmailLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError(authMessages.emailRequired);
      return;
    }

    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false, emailRedirectTo: getCallbackUrl() },
      });
      if (signInError) throw signInError;
      setFeedback(authMessages.magicSent);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : authMessages.actionFailed,
      );
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    setFeedback('');
    setError('');
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getCallbackUrl() },
      });
      if (signInError) throw signInError;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : authMessages.actionFailed,
      );
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brandMark}>
          <Sparkles size={21} />
        </div>
        <p className={styles.brandName}>AI INFLUENCER STUDIO</p>
        <h1 id="login-title">{authMessages.loginTitle}</h1>
        <p className={styles.subtitle}>{authMessages.loginSubtitle}</p>

        {isConfigured ? (
          <>
            <button
              className={styles.googleButton}
              type="button"
              onClick={continueWithGoogle}
              disabled={busy}
            >
              <GoogleMark />
              {authMessages.google}
              <ArrowRight size={15} />
            </button>
            <div className={styles.divider}>
              <span />
              {authMessages.divider}
              <span />
            </div>
            <form className={styles.form} onSubmit={sendEmailLink}>
              <label htmlFor="email">{authMessages.emailLabel}</label>
              <span className={styles.inputWrap}>
                <Mail size={16} aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={authMessages.emailPlaceholder}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                  required
                />
              </span>
              <button
                className={styles.submitButton}
                type="submit"
                disabled={busy}
              >
                {busy ? (
                  <LoaderCircle size={16} className={styles.spinner} />
                ) : null}
                {authMessages.emailLink}
              </button>
            </form>
          </>
        ) : (
          <div className={styles.configMessage} role="status">
            {authMessages.setupRequired}
          </div>
        )}

        {feedback ? (
          <p className={styles.feedback} role="status">
            {feedback}
          </p>
        ) : null}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <p className={styles.footerNote}>{authMessages.noPublicSignup}</p>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.75 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.99 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.28-1.93-6.15-4.53H2.16v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.85 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.16a11 11 0 0 0 0 9.9l3.69-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.36c1.62 0 3.08.56 4.22 1.66l3.16-3.16C17.45 1.09 14.97 0 12 0A11 11 0 0 0 2.16 7.05l3.69 2.84C6.72 7.29 9.14 4.36 12 4.36Z"
      />
    </svg>
  );
}
