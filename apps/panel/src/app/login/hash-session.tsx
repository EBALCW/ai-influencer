'use client';

import { useEffect, useState } from 'react';
import { authHashErrorMessage, parseAuthHash } from '@/lib/auth-hash';
import { safeNextPath } from '@/lib/safe-redirect';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type HashSessionProps = {
  nextPath?: string;
  /** /auth/callback kodsuz geldi: bir e-posta bağlantısından dönülmüş olabilir. */
  fromLink: boolean;
};

/**
 * Davet e-postasındaki bağlantı oturumu adresin `#…` kısmında getirir; sunucu bunu göremez.
 * Burada okunur, oturum kurulur ve panele geçilir. Üyelik denetimi yine sunucuda yapılır
 * (requireTeamMember): ekip üyesi olmayan biri girişte geri çevrilir.
 */
export function HashSession({ nextPath, fromLink }: HashSessionProps) {
  const [state, setState] = useState<
    { kind: 'idle' } | { kind: 'working' } | { kind: 'error'; text: string }
  >({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    // Yalnız /auth/callback'ten dönülmüşse işlenir: başka bir sayfadan gelen `#access_token=…`
    // ile oturum kurulmaz.
    const parsed = fromLink ? parseAuthHash(window.location.hash) : null;
    // Token adres çubuğunda ve geçmişte kalmasın
    if (parsed)
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      );
    const fail = (code: string) =>
      setState({ kind: 'error', text: authHashErrorMessage(code) });

    void (async () => {
      // Durum güncellemeleri effect gövdesinde eşzamanlı yapılmaz
      await Promise.resolve();
      if (cancelled) return;
      if (!parsed) {
        if (fromLink) fail('used');
        return;
      }
      if (parsed.kind === 'error') {
        fail(parsed.code);
        return;
      }
      setState({ kind: 'working' });
      try {
        const supabase = createSupabaseBrowserClient();
        // Açık bir oturum varken bağlantıdaki oturuma sessizce geçilmez (başkasının hesabına
        // sokma girişimi olabilir): mevcut oturum korunur, kullanıcı panele döner.
        const { data: existing } = await supabase.auth.getSession();
        if (cancelled) return;
        if (existing.session) {
          window.location.replace(safeNextPath(nextPath));
          return;
        }
        const { error } = await supabase.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
        if (cancelled) return;
        if (error) fail('invalid');
        else window.location.replace(safeNextPath(nextPath));
      } catch {
        if (!cancelled) fail('invalid');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromLink, nextPath]);

  if (state.kind === 'working')
    return (
      <p role="status" className="mt-5 text-sm leading-6 text-mint">
        Bağlantı doğrulanıyor, panele yönlendiriliyorsun…
      </p>
    );
  if (state.kind === 'error')
    return (
      <p
        role="alert"
        className="mt-5 rounded-xl bg-amber-300/10 p-4 text-sm text-amber-100"
      >
        {state.text}
      </p>
    );
  return null;
}
