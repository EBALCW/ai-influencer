-- #49 / 1: sağlayıcıdan bağımsız token kasası. Gerçek OAuth bağlantısı kurmaz.
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- API rolleri Vault'a doğrudan erişemez; yalnız dar RPC'ler service_role'e açıktır.
REVOKE ALL ON SCHEMA vault FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA vault FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA vault FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.guard_social_token_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.token_ref IS NOT NULL OR NEW.token_expires_at IS NOT NULL OR NEW.status <> 'pending' THEN
        RAISE EXCEPTION 'Bağlantı alanları yalnız sunucu tarafından değiştirilebilir.' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.token_ref IS DISTINCT FROM OLD.token_ref
      OR NEW.token_expires_at IS DISTINCT FROM OLD.token_expires_at
      OR NEW.status IS DISTINCT FROM OLD.status
      OR (OLD.token_ref IS NOT NULL AND (NEW.influencer_id IS DISTINCT FROM OLD.influencer_id OR NEW.platform IS DISTINCT FROM OLD.platform)) THEN
      RAISE EXCEPTION 'Bağlantı alanları yalnız sunucu tarafından değiştirilebilir.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER social_accounts_guard_token_fields
  BEFORE INSERT OR UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.guard_social_token_fields();

CREATE FUNCTION public.store_social_token(p_account_id uuid, p_token jsonb, p_expires_at timestamptz DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  secret_id uuid;
  secret_name text := 'social-token:' || p_account_id::text;
BEGIN
  -- Alan değerleri hata mesajına dahil edilmez. Sağlayıcı yanıtının tamamı saklanmaz.
  IF p_token IS NULL OR jsonb_typeof(p_token) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_token->'access_token') IS DISTINCT FROM 'string'
    OR length(btrim(p_token->>'access_token')) = 0
    OR octet_length(p_token::text) > 65536
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_token) AS key
      WHERE key NOT IN ('access_token', 'refresh_token', 'token_type', 'scope')) THEN
    RAISE EXCEPTION 'Token paketi geçersiz.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(p_token) AS field
    WHERE field.key <> 'access_token' AND (jsonb_typeof(field.value) <> 'string' OR length(btrim(field.value #>> '{}')) = 0)) THEN
    RAISE EXCEPTION 'Token paketi geçersiz.' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NOT NULL AND (NOT isfinite(p_expires_at) OR p_expires_at <= now()) THEN
    RAISE EXCEPTION 'Token son kullanma tarihi geçersiz.' USING ERRCODE = '22023';
  END IF;
  -- Aynı hesap için oluşturma/yenileme/silme seri çalışır; Vault ve referans tek transaction'dır.
  PERFORM 1 FROM public.social_accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sosyal hesap bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  BEGIN
    SELECT id INTO secret_id FROM vault.secrets WHERE name = secret_name;
    IF secret_id IS NULL THEN
      secret_id := vault.create_secret(p_token::text, secret_name, 'Social account OAuth token');
    ELSE
      PERFORM vault.update_secret(secret_id, p_token::text, secret_name, 'Social account OAuth token');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Sosyal hesap sırrı saklanamadı.' USING ERRCODE = 'XX000';
  END;
  UPDATE public.social_accounts SET token_ref = secret_id::text,
    token_expires_at = p_expires_at, status = 'active' WHERE id = p_account_id;
  RETURN secret_id;
END;
$$;

CREATE FUNCTION public.read_social_token(p_account_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  -- İstemcinin/eskiden yazılmış bir kaydın rastgele Vault referansı sır okuyamaz.
  SELECT s.decrypted_secret::jsonb INTO result
    FROM public.social_accounts a JOIN vault.decrypted_secrets s
      ON s.id::text = a.token_ref AND s.name = 'social-token:' || a.id::text
    WHERE a.id = p_account_id AND a.status <> 'revoked';
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Sosyal hesap sırrı okunamadı.' USING ERRCODE = 'XX000';
END;
$$;

-- Sağlayıcıdaki revoke isteği başarılı olduktan sonra çağrılacak yerel son adım.
CREATE FUNCTION public.delete_social_token(p_account_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.social_accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sosyal hesap bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM vault.secrets WHERE name = 'social-token:' || p_account_id::text;
  UPDATE public.social_accounts SET token_ref = NULL, token_expires_at = NULL,
    status = 'revoked' WHERE id = p_account_id;
END;
$$;

CREATE FUNCTION public.cleanup_social_token()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM vault.secrets WHERE name = 'social-token:' || OLD.id::text;
  RETURN OLD;
END;
$$;
CREATE TRIGGER social_accounts_cleanup_token AFTER DELETE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_social_token();

REVOKE ALL ON FUNCTION public.store_social_token(uuid,jsonb,timestamptz),
  public.read_social_token(uuid), public.delete_social_token(uuid),
  public.guard_social_token_fields(), public.cleanup_social_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_social_token(uuid,jsonb,timestamptz),
  public.read_social_token(uuid), public.delete_social_token(uuid) TO service_role;
