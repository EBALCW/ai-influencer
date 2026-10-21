import { LoginForm } from './login-form';
import { authMessages } from '@/lib/auth-messages';
import { getSupabasePublicConfig } from '@/lib/supabase/config';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string; setup?: string }>;
}) {
  const params = await searchParams;
  const initialError =
    params.reason === 'session' ? authMessages.sessionError : '';

  return (
    <LoginForm
      isConfigured={Boolean(getSupabasePublicConfig())}
      nextPath={params.next}
      initialError={initialError}
    />
  );
}
