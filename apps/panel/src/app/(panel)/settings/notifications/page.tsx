import { NotificationSettingsForm } from './settings-form';

export default function NotificationSettingsPage() {
  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ÇALIŞMA ALANI</p>
          <h1>Bildirim ayarları</h1>
          <p>
            Uyarı eşiklerini ve push kanallarını owner veya editör değiştirir.
            İzleyiciler ayarları görür.
          </p>
        </div>
      </header>
      <NotificationSettingsForm />
    </div>
  );
}
