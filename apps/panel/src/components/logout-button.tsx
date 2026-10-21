import { LogOut } from 'lucide-react';

/** POST formu: sunucu route'u cookie'leri temizler, JS gerekmez ve prefetch ile tetiklenmez. */
export function LogoutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        aria-label="Çıkış yap"
        className="icon-button"
        title="Çıkış yap"
        type="submit"
      >
        <LogOut size={16} />
      </button>
    </form>
  );
}
