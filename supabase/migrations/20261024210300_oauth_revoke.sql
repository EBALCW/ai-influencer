CREATE TABLE private.oauth_revoke_leases(account_id uuid PRIMARY KEY REFERENCES public.social_accounts(id) ON DELETE CASCADE,nonce uuid NOT NULL,expires_at timestamptz NOT NULL,expected_ref text NOT NULL);
ALTER TABLE private.oauth_revoke_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.oauth_revoke_leases FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.oauth_revoke_begin(p_user_id uuid,p_account_id uuid,p_influencer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.social_accounts; t jsonb; n uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.team_members WHERE user_id=p_user_id AND role IN ('owner','editor')) THEN RAISE EXCEPTION 'Yetki gerekli.' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.social_accounts WHERE id=p_account_id FOR UPDATE;
 IF NOT FOUND OR a.influencer_id IS DISTINCT FROM p_influencer_id THEN RAISE EXCEPTION 'Hesap eşleşmiyor.' USING ERRCODE='42501'; END IF;
 IF a.token_ref IS NULL THEN UPDATE public.social_accounts SET status='revoked' WHERE id=a.id; RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM private.oauth_refresh_leases WHERE account_id=a.id AND expires_at>clock_timestamp())
 OR EXISTS(SELECT 1 FROM private.oauth_revoke_leases WHERE account_id=a.id AND expires_at>clock_timestamp()) THEN
  RAISE EXCEPTION 'Hesap işlemi sürüyor.' USING ERRCODE='55000';
 END IF;
 SELECT s.decrypted_secret::jsonb INTO t FROM vault.decrypted_secrets s WHERE s.id::text=a.token_ref AND s.name='social-token:'||a.id::text;
 IF t IS NULL THEN RAISE EXCEPTION 'Token okunamadı.' USING ERRCODE='55000'; END IF;
 n:=pg_catalog.gen_random_uuid();
 INSERT INTO private.oauth_revoke_leases VALUES(a.id,n,clock_timestamp()+interval '3 minutes',a.token_ref)
 ON CONFLICT(account_id) DO UPDATE SET nonce=excluded.nonce,expires_at=excluded.expires_at,expected_ref=excluded.expected_ref;
 -- Bulut revoke tamamlanana kadar yeni refresh/bağlantı yazımını durdurur, sır retry için Vault'ta kalır.
 UPDATE public.social_accounts SET status='revoked' WHERE id=a.id;
 RETURN jsonb_build_object('nonce',n,'token',t);
END;
$$;
CREATE FUNCTION private.oauth_revoke_finish(p_account_id uuid,p_nonce uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.social_accounts; l private.oauth_revoke_leases;
BEGIN
 SELECT * INTO a FROM public.social_accounts WHERE id=p_account_id FOR UPDATE;
 SELECT * INTO l FROM private.oauth_revoke_leases WHERE account_id=p_account_id AND nonce=p_nonce FOR UPDATE;
 IF NOT FOUND OR l.expires_at<=clock_timestamp() OR a.status<>'revoked' OR a.token_ref IS DISTINCT FROM l.expected_ref THEN RETURN false; END IF;
 PERFORM public.delete_social_token(a.id);
 DELETE FROM private.oauth_revoke_leases WHERE account_id=a.id AND nonce=p_nonce;
 RETURN true;
END;
$$;
CREATE FUNCTION public.oauth_revoke_begin(p_user_id uuid,p_account_id uuid,p_influencer_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.oauth_revoke_begin(p_user_id,p_account_id,p_influencer_id)$$;
CREATE FUNCTION public.oauth_revoke_finish(p_account_id uuid,p_nonce uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.oauth_revoke_finish(p_account_id,p_nonce)$$;
REVOKE ALL ON FUNCTION private.oauth_revoke_begin(uuid,uuid,uuid),public.oauth_revoke_begin(uuid,uuid,uuid),private.oauth_revoke_finish(uuid,uuid),public.oauth_revoke_finish(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.oauth_revoke_begin(uuid,uuid,uuid),public.oauth_revoke_begin(uuid,uuid,uuid),private.oauth_revoke_finish(uuid,uuid),public.oauth_revoke_finish(uuid,uuid) TO service_role;
