-- Callback doğrulaması ile Vault yazımı arasındaki hesap taşıma yarışını kapatır.
CREATE FUNCTION private.oauth_connect_token(p_user_id uuid,p_account_id uuid,p_influencer_id uuid,
 p_platform public.social_platform,p_external_id text,p_token jsonb,p_expires_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.social_accounts;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE user_id=p_user_id AND role IN ('owner','editor')) THEN
  RAISE EXCEPTION 'OAuth yetkisi gerekli.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO a FROM public.social_accounts WHERE id=p_account_id FOR UPDATE;
 IF NOT FOUND OR a.influencer_id IS DISTINCT FROM p_influencer_id OR a.platform IS DISTINCT FROM p_platform
  OR a.external_id IS DISTINCT FROM p_external_id THEN
  RAISE EXCEPTION 'OAuth hesap eşleşmesi geçersiz.' USING ERRCODE='42501';
 END IF;
 IF a.status='revoked' AND a.token_ref IS NOT NULL THEN
  RAISE EXCEPTION 'Bağlantı kaldırma işlemi tamamlanmalı.' USING ERRCODE='55000';
 END IF;
 PERFORM public.store_social_token(p_account_id,p_token,p_expires_at);
END;
$$;
CREATE FUNCTION public.oauth_connect_token(p_user_id uuid,p_account_id uuid,p_influencer_id uuid,
 p_platform public.social_platform,p_external_id text,p_token jsonb,p_expires_at timestamptz)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
 SELECT private.oauth_connect_token(p_user_id,p_account_id,p_influencer_id,p_platform,p_external_id,p_token,p_expires_at);
$$;
REVOKE ALL ON FUNCTION private.oauth_connect_token(uuid,uuid,uuid,public.social_platform,text,jsonb,timestamptz),
 public.oauth_connect_token(uuid,uuid,uuid,public.social_platform,text,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.oauth_connect_token(uuid,uuid,uuid,public.social_platform,text,jsonb,timestamptz),
 public.oauth_connect_token(uuid,uuid,uuid,public.social_platform,text,jsonb,timestamptz) TO service_role;
