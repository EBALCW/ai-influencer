import { providerConfig } from '@/lib/oauth/providers';
export function AccountsTab({
  influencerId,
  canEdit,
  accounts,
}: {
  influencerId: string;
  canEdit: boolean;
  accounts: Array<{
    id: string;
    platform: string;
    handle: string;
    status: string;
  }>;
}) {
  const labels = { youtube: 'YouTube', tiktok: 'TikTok' } as const;
  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap gap-3">
          {(['youtube', 'tiktok'] as const).map((platform) => {
            let enabled = true;
            try {
              providerConfig(platform);
            } catch {
              enabled = false;
            }
            return (
              <form
                key={platform}
                method="post"
                action={`/api/oauth/${platform}/start`}
              >
                <input type="hidden" name="influencerId" value={influencerId} />
                <button
                  className="rounded-lg border border-line bg-surface px-4 py-2 text-primary disabled:opacity-50"
                  disabled={!enabled}
                  type="submit"
                >
                  {labels[platform]} hesabı bağla
                </button>
                {!enabled && (
                  <p className="text-sm text-muted">Bağlantı ayarı gerekli.</p>
                )}
              </form>
            );
          })}
        </div>
      )}
      <p className="text-sm text-muted">
        Instagram bağlantısı henüz kullanılamıyor.
      </p>
      {accounts.length ? (
        <ul className="space-y-2">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="rounded-lg border border-line bg-surface p-4 text-primary"
            >
              {account.platform} · {account.handle}{' '}
              <span className="text-muted">· {account.status}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Henüz bağlı hesap yok.</p>
      )}
    </div>
  );
}
