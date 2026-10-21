-- Claude vb. AI API kullanım maliyeti için ayrı kategori (#59, #48).
-- `tool` + description ile ayırmak raporlarda filtrelemeyi kırılgan yapardı.
-- ALTER TYPE ... ADD VALUE aynı transaction'da kullanılamadığı için ayrı migration.
ALTER TYPE public.cost_category ADD VALUE IF NOT EXISTS 'ai_api';
