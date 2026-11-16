import { NextResponse, type NextRequest } from 'next/server';
import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import { isSameOrigin } from '@/lib/same-origin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createToolLoginLimiter } from '@/lib/tool-login/rate-limit';

const limiter = createToolLoginLimiter();

/**
 * Araç girişi kodu (docs/AUTH.md → "Araç girişi"): panelde oturumu açık owner/editor, kendi
 * hesabı için tek kullanımlık bir giriş kodu üretir ve `pnpm mcp:login --code` /
 * `pnpm worker:login --code` komutuna yapıştırır. Kullanıcının kendine giriş e-postası
 * istemesiyle aynı güçtedir; fark, kodun e-postayla değil ekranda verilmesidir (Supabase'in
 * e-posta gönderim sınırına takılmaz).
 *
 * Kurallar:
 * - İstek gövdesi OKUNMAZ: kod her zaman çağıranın kendi hesabı içindir (e-posta oturumdan gelir).
 * - Yalnız insan (panel) oturumu üretebilir; makine ve MCP oturumları reddedilir.
 * - Service role burada bilerek kullanılır: giriş kodunu yalnız yönetici API'si üretebilir.
 *   Çağrı çağıranın kendi e-postasıyla sınırlıdır; dönen kullanıcı kimliği ayrıca doğrulanır.
 * - Yanıt yalnız kodu taşır (oturum ya da yenileme token'ı değil). Kod sunucuda saklanmaz,
 *   loglanmaz; Auth tarafında tek kullanımlık ve süreli olarak tutulur.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    if (!isSameOrigin(request))
      return jsonError('Geçersiz istek kaynağı.', 403);

    // Otomasyon oturumu zaten üye sayılmaz (team_members'ı okuyamaz → yukarıda 403). Bu denetim
    // o kurala güvenmeden ayrıca sorar; yanıt kesin "hayır" değilse kod üretilmez.
    const supabase = await createSupabaseServerClient();
    const session = await supabase.rpc('is_worker_session');
    if (session.error || session.data !== false)
      return jsonError(
        'Giriş kodu yalnız paneldeki kendi oturumundan üretilebilir.',
        403,
      );

    const email = auth.user.email;
    if (!email)
      return jsonError('Hesabında e-posta adresi yok; kod üretilemiyor.', 409);
    if (!limiter.take(auth.user.id))
      return jsonError(
        'Çok fazla giriş kodu üretildi. Birkaç dakika sonra yeniden dene.',
        429,
      );

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    const code = data?.properties?.hashed_token;
    if (
      error ||
      !code ||
      data.user?.id !== auth.user.id ||
      data.properties.verification_type !== 'magiclink'
    ) {
      // Auth yanıtı (içinde kod olabilir) loglanmaz; yalnız sabit ileti.
      throw new Error('Giriş kodu üretilemedi.');
    }
    return NextResponse.json(
      { code },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
