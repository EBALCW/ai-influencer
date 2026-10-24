CREATE TABLE private.oauth_refresh_leases (
 account_id uuid PRIMARY KEY REFERENCES public.social_accounts(id) ON DELETE CASCADE,
 lease_id uuid NOT NULL, expires_at timestamptz NOT NULL,
 expected_expires_at timestamptz, expected_token_ref text, expected_hash text NOT NULL
);
ALTER TABLE private.oauth_refresh_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.oauth_refresh_leases FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.oauth_refresh_claim(p_platforms public.social_platform[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.social_accounts; t jsonb; lid uuid; result jsonb := '[]';
BEGIN
 DELETE FROM private.oauth_refresh_leases WHERE expires_at<=clock_timestamp();
 FOR a IN SELECT s.* FROM public.social_accounts s WHERE s.platform=ANY(p_platforms)
   AND s.platform IN ('youtube','tiktok') AND s.status IN ('active','expired')
   AND s.token_ref IS NOT NULL AND s.token_expires_at<clock_timestamp()+interval '15 minutes'
   AND NOT EXISTS(SELECT 1 FROM private.oauth_refresh_leases l WHERE l.account_id=s.id)
   ORDER BY s.token_expires_at LIMIT 5 FOR UPDATE OF s SKIP LOCKED
 LOOP
   t := public.read_social_token(a.id);
   IF t IS NULL THEN CONTINUE; END IF;
   lid := pg_catalog.gen_random_uuid();
   INSERT INTO private.oauth_refresh_leases VALUES(a.id,lid,clock_timestamp()+interval '3 minutes',
    a.token_expires_at,a.token_ref,encode(sha256(convert_to(t->>'access_token','UTF8')),'hex'));
   result := result || jsonb_build_array(jsonb_build_object('id',a.id,'platform',a.platform,'externalId',a.external_id,'leaseId',lid,'token',t));
 END LOOP;
 RETURN result;
END;
$$;
CREATE FUNCTION private.oauth_refresh_finish(p_account_id uuid,p_lease_id uuid,p_result text,p_token jsonb,p_expires_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.social_accounts; l private.oauth_refresh_leases; t jsonb;
BEGIN
 IF p_result NOT IN ('ok','retry','error') OR p_result IS NULL THEN RAISE EXCEPTION 'Geçersiz yenileme sonucu.' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM public.social_accounts WHERE id=p_account_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO l FROM private.oauth_refresh_leases WHERE account_id=p_account_id AND lease_id=p_lease_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF l.expires_at<=clock_timestamp() OR a.status='revoked' OR a.token_ref IS DISTINCT FROM l.expected_token_ref
  OR a.token_expires_at IS DISTINCT FROM l.expected_expires_at THEN
  DELETE FROM private.oauth_refresh_leases WHERE account_id=p_account_id AND lease_id=p_lease_id;
  RETURN false;
 END IF;
 t:=public.read_social_token(a.id);
 IF t IS NULL OR encode(sha256(convert_to(t->>'access_token','UTF8')),'hex') IS DISTINCT FROM l.expected_hash THEN
  DELETE FROM private.oauth_refresh_leases WHERE account_id=p_account_id AND lease_id=p_lease_id;
  RETURN false;
 END IF;
 IF p_result='ok' THEN PERFORM public.store_social_token(a.id,p_token,p_expires_at);
 ELSIF p_result='error' THEN UPDATE public.social_accounts SET status='error' WHERE id=a.id;
 END IF;
 DELETE FROM private.oauth_refresh_leases WHERE account_id=p_account_id AND lease_id=p_lease_id;
 RETURN true;
END;
$$;
CREATE FUNCTION public.oauth_refresh_claim(p_platforms public.social_platform[])
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.oauth_refresh_claim(p_platforms)$$;
CREATE FUNCTION public.oauth_refresh_finish(p_account_id uuid,p_lease_id uuid,p_result text,p_token jsonb,p_expires_at timestamptz)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.oauth_refresh_finish(p_account_id,p_lease_id,p_result,p_token,p_expires_at)$$;
REVOKE ALL ON FUNCTION private.oauth_refresh_claim(public.social_platform[]),public.oauth_refresh_claim(public.social_platform[]),
 private.oauth_refresh_finish(uuid,uuid,text,jsonb,timestamptz),public.oauth_refresh_finish(uuid,uuid,text,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.oauth_refresh_claim(public.social_platform[]),public.oauth_refresh_claim(public.social_platform[]),
 private.oauth_refresh_finish(uuid,uuid,text,jsonb,timestamptz),public.oauth_refresh_finish(uuid,uuid,text,jsonb,timestamptz) TO service_role;
CREATE FUNCTION private.invoke_oauth_refresh() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u text:=private.notify_secret('project_url'); s text:=private.notify_secret('cron_secret');
BEGIN
 IF u IS NULL OR s IS NULL OR u !~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$' THEN RETURN NULL; END IF;
 RETURN private.http_post(u||'/functions/v1/refresh-tokens',jsonb_build_object('Content-Type','application/json','x-cron-secret',s),'{}');
END;
$$;
REVOKE ALL ON FUNCTION private.invoke_oauth_refresh() FROM PUBLIC,anon,authenticated,service_role;
SELECT cron.schedule('oauth-refresh','*/5 * * * *','SELECT private.invoke_oauth_refresh()');
