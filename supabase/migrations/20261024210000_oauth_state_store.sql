-- #49: kısa ömürlü PKCE verifier. Public API rollerine tablo erişimi yok.
CREATE TABLE private.oauth_states (
  state_hash text PRIMARY KEY CHECK (state_hash ~ '^[A-Za-z0-9_-]{43}$'),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  platform public.social_platform NOT NULL,
  verifier text NOT NULL CHECK (verifier ~ '^[A-Za-z0-9._~-]{43,128}$'),
  expires_at timestamptz NOT NULL
);
ALTER TABLE private.oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.oauth_states FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX oauth_states_expiry_idx ON private.oauth_states(expires_at);

CREATE FUNCTION private.oauth_state_save(p_hash text, p_user_id uuid, p_influencer_id uuid,
 p_platform public.social_platform, p_verifier text, p_expires_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_expires_at IS NULL OR NOT isfinite(p_expires_at) OR p_expires_at <= clock_timestamp()
    OR p_expires_at > clock_timestamp() + interval '11 minutes' THEN
    RAISE EXCEPTION 'OAuth süresi geçersiz.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE user_id=p_user_id AND role IN ('owner','editor')) THEN
    RAISE EXCEPTION 'OAuth yetkisi gerekli.' USING ERRCODE = '42501';
  END IF;
  -- Aynı kullanıcıdan gelen başlangıçları seri çalıştır, sınırsız verifier birikmesin.
  PERFORM 1 FROM auth.users WHERE id=p_user_id FOR UPDATE;
  DELETE FROM private.oauth_states WHERE expires_at <= clock_timestamp();
  IF (SELECT count(*) FROM private.oauth_states WHERE user_id=p_user_id) >= 20 THEN
    RAISE EXCEPTION 'OAuth deneme sınırı.' USING ERRCODE = '54000';
  END IF;
  INSERT INTO private.oauth_states VALUES(p_hash,p_user_id,p_influencer_id,p_platform,p_verifier,least(p_expires_at,clock_timestamp()+interval '10 minutes'));
END;
$$;

CREATE FUNCTION private.oauth_state_consume(p_hash text, p_user_id uuid, p_influencer_id uuid,
 p_platform public.social_platform)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v private.oauth_states;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE user_id=p_user_id AND role IN ('owner','editor')) THEN
    RETURN NULL;
  END IF;
  -- DELETE ... RETURNING, aynı state için eşzamanlı callback'lerden yalnız birine veri verir.
  DELETE FROM private.oauth_states WHERE state_hash=p_hash AND user_id=p_user_id
    AND influencer_id=p_influencer_id AND platform=p_platform AND expires_at>clock_timestamp()
    RETURNING * INTO v;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('userId',v.user_id,'influencerId',v.influencer_id,
    'platform',v.platform,'verifier',v.verifier,'expiresAt',extract(epoch FROM v.expires_at)*1000);
END;
$$;

-- PostgREST yalnız public şemasını kullanır. Definer yetkileri private içinde kalır.
CREATE FUNCTION public.oauth_state_save(p_hash text, p_user_id uuid, p_influencer_id uuid,
 p_platform public.social_platform, p_verifier text, p_expires_at timestamptz)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
 SELECT private.oauth_state_save(p_hash,p_user_id,p_influencer_id,p_platform,p_verifier,p_expires_at);
$$;
CREATE FUNCTION public.oauth_state_consume(p_hash text, p_user_id uuid, p_influencer_id uuid,
 p_platform public.social_platform)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
 SELECT private.oauth_state_consume(p_hash,p_user_id,p_influencer_id,p_platform);
$$;
REVOKE ALL ON FUNCTION private.oauth_state_save(text,uuid,uuid,public.social_platform,text,timestamptz),
 private.oauth_state_consume(text,uuid,uuid,public.social_platform),
 public.oauth_state_save(text,uuid,uuid,public.social_platform,text,timestamptz),
 public.oauth_state_consume(text,uuid,uuid,public.social_platform) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.oauth_state_save(text,uuid,uuid,public.social_platform,text,timestamptz),
 private.oauth_state_consume(text,uuid,uuid,public.social_platform),
 public.oauth_state_save(text,uuid,uuid,public.social_platform,text,timestamptz),
 public.oauth_state_consume(text,uuid,uuid,public.social_platform) TO service_role;
SELECT cron.schedule('oauth-state-cleanup','*/10 * * * *',
 $$DELETE FROM private.oauth_states WHERE expires_at <= clock_timestamp()$$);
