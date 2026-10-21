import { AiSettingsForm } from './settings-form';
export default function AiSettingsPage() {
  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ÇALIŞMA ALANI</p>
          <h1>AI ayarları</h1>
          <p>
            Modeli ve milyon token başına USD fiyatlarını yalnız owner
            değiştirebilir.
          </p>
        </div>
      </header>
      <AiSettingsForm />
    </div>
  );
}
