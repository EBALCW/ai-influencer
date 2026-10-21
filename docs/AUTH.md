# Panel kimlik doğrulaması

Panel Supabase Auth ile e-posta magic link ve isteğe bağlı Google OAuth kullanır. İki akış da mevcut Supabase Auth kullanıcıları içindir; e-posta girişinde `shouldCreateUser: false` gönderilir ve `supabase/config.toml` içinde kayıt kapalıdır. Hosted Supabase projesinde de Authentication ayarlarından yeni kullanıcı kaydını kapat.

## İlk owner

Henüz owner yokken ilk hesabı Supabase Dashboard → Authentication → Users bölümünden e-posta daveti göndererek oluştur. Kullanıcı magic link ile ilk kez giriş yaptığında, boş `team_members` tablosunda kendi hesabını owner olarak kaydeder. Bundan sonra yeni üyeler panelde **Ekip ayarları** sayfasından davet edilir.

## Ortam değişkenleri

`.env.local` içine `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` ve yalnızca sunucu tarafında kullanılan `SUPABASE_SERVICE_ROLE_KEY` eklenmelidir. Service role key hiçbir `NEXT_PUBLIC_` değişkenine taşınmamalıdır; ekip daveti ve üye listesindeki e-posta eşlemesi bu anahtarı gerektirir.

## Redirect ve Google OAuth

Supabase Authentication → URL Configuration bölümünde yerel panel URL'sini (`http://localhost:3000`) ve yayın adresini ekle. Google ile giriş için Supabase Authentication → Providers → Google altında OAuth client ID ve secret değerlerini yapılandır; Google Cloud OAuth istemcisinde Supabase'in gösterdiği callback URL'yi yetkili redirect URI olarak kaydet. Google sağlayıcısı etkin değilse e-posta magic link ile giriş kullanılabilir.

Üye rolü uygulama tablosunda da doğrulanır. `viewer` için yazma RLS politikası yoktur; ekip yönetimi sayfası ve API'leri yalnızca `owner` rolünü kabul eder.
