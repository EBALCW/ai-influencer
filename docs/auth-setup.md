# Panel kimlik doğrulama kurulumu

Panel, Supabase Auth ile e-posta bağlantısı ve Google OAuth kullanır. Kullanıcı kendi hesabını oluşturamaz; ekip sahibi `Ayarlar > Ekip kullanıcıları` sayfasından davet gönderir. Girişten sonra uygulama `team_members` üyeliğini doğrular. Veritabanındaki RLS politikaları da erişimi ayrıca sınırlar.

## Gerekli ortam değişkenleri

`.env.example` dosyasını `.env.local` olarak kopyalayın ve Supabase proje değerlerini doldurun:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (tercih edilen) veya `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (yerel geliştirmede `http://localhost:3000`)
- `SUPABASE_SERVICE_ROLE_KEY` (yalnızca sunucu tarafında; ekip davetleri için gerekli)
- `SUPABASE_INITIAL_OWNER_EMAIL` (ilk owner kurulumu için izin verilen tek adres)

`SUPABASE_SERVICE_ROLE_KEY` değişkenini `NEXT_PUBLIC_` önekiyle tanımlamayın veya istemci koduna aktarmayın.

## Supabase Auth ayarları

1. Supabase Dashboard > Authentication > URL Configuration içinde Site URL'yi `NEXT_PUBLIC_SITE_URL` ile eşleyin ve `http://localhost:3000/auth/callback` adresini ek yönlendirme adreslerine ekleyin. Üretim URL'sini de aynı şekilde ekleyin.
2. Authentication > Providers bölümünde Email ve Google sağlayıcılarını etkinleştirin. Google OAuth istemci bilgilerini sağlayıcı ekranına girin ve Supabase'in gösterdiği callback URL'sini Google Cloud Console'daki izinli yönlendirme URI'larına ekleyin.
3. Authentication > Settings bölümünde yeni kullanıcı kaydını kapalı tutun. Ekip davetleri Supabase Admin API ile gönderilir; e-posta girişinde `shouldCreateUser: false` kullanılır.
4. E-posta şablonunun doğrulama/davet bağlantısı Supabase'in `{ .ConfirmationURL }` değişkenini kullansın. Bağlantı, uygulamanın `/auth/callback` rotasına dönmelidir.

`SUPABASE_INITIAL_OWNER_EMAIL` değerini ilk owner olacak adresle doldurun. Bu kullanıcıyı Supabase Dashboard > Authentication > Users bölümünden oluşturun ve `/login` üzerinden e-posta bağlantısıyla ilk kez giriş yaptırın. Callback yalnızca bu adresi, yalnızca `team_members` tablosu boşken owner olarak ekleyebilir; sonrasında diğer kullanıcılar owner kaydı oluşturamaz. Daha sonra davet edilen üyelere seçilen rol, davet sırasında kaydedilir. Son owner'ın silinmesi veya rolünün düşürülmesi veritabanı korumasıyla engellenir.
