-- Extend the existing service-only lease/CAS protocol; public signatures and grants stay unchanged.
CREATE OR REPLACE FUNCTION private.oauth_refresh_claim(p_platforms public.social_platform[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.social_accounts; t jsonb; lid uuid; result jsonb := '[]';
BEGIN
 DELETE FROM private.oauth_refresh_leases WHERE expires_at<=clock_timestamp();
 FOR a IN SELECT s.* FROM public.social_accounts s WHERE s.platform=ANY(p_platforms)
   AND s.platform IN ('youtube','tiktok','instagram') AND s.status IN ('active','expired')
   -- Instagram only refreshes unexpired long-lived credentials. Refresh a week
   -- early instead of waiting until the generic 15-minute window.
   AND (s.platform <> 'instagram' OR (s.token_expires_at > clock_timestamp()
     AND EXISTS (SELECT 1 FROM vault.secrets v WHERE v.id::text=s.token_ref
       AND v.updated_at < clock_timestamp()-interval '24 hours')))
   AND s.token_ref IS NOT NULL AND s.token_expires_at<clock_timestamp()+CASE WHEN s.platform='instagram' THEN interval '7 days' ELSE interval '15 minutes' END
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
