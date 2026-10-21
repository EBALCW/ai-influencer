# Olay ve yedekleme doğrulama kayıtları

Bu dosya olayların ve geri yükleme testlerinin kaydıdır; parola, doğrulama kodu, kurtarma kodu, token, özel paylaşım bağlantısı, tam e-posta/telefon veya hassas mesaj içeriği yazılmaz. Kanıt dosyaları yalnızca ekip erişimi kısıtlı depoda tutulur; bu dosyaya depo yolu veya gizli olmayan kısa bir referans yazılabilir.

## Hesap olayı kaydı şablonu

Yeni olay için aşağıdaki şablonu kopyalayın. Kişisel verileri en aza indirin; gerçek ad yerine ekip rolü, hesap kullanıcı adı yerine proje içi slug kullanın.

```markdown
## INC-YYYY-NNN — <kısa olay adı>

- Durum: Açık / İzleniyor / Kapalı
- Önem: Düşük / Orta / Yüksek / Kritik
- Tespit zamanı (UTC): YYYY-MM-DD HH:MM
- Kapanış zamanı (UTC): YYYY-MM-DD HH:MM / Henüz kapanmadı
- Platform: Instagram/Meta / TikTok / YouTube-Google / E-posta / Diğer
- Hesap slug’ı: `<slug>`
- Olay sorumlusu: `<ekip rolü>`
- Olay türü: Şüpheli giriş / Hesap erişim kaybı / Kısıtlama bildirimi / Veri kaybı / Yedek hatası / Diğer

### Gözlem

Sadece doğrulanmış belirtiyi ve etkilenen içeriklerin kimliklerini yazın. Parola, kod, token, özel e-posta/telefon ve tam mesajı eklemeyin.

### Kanıt konumu

`<erişimi kısıtlı depodaki göreli klasör veya güvenli kayıt kimliği>`

### Alınan aksiyonlar

- [ ] E-posta hesabı ve kurtarma yöntemleri kontrol edildi
- [ ] Tanınmayan oturum/cihazlar kapatıldı
- [ ] Gereksiz üçüncü taraf uygulama/ekip erişimleri kaldırıldı
- [ ] Parola/2FA yenilemesi gerekiyorsa parola kasasında yapıldı
- [ ] Platformun resmi destek/kurtarma akışı gerekiyorsa başlatıldı
- [ ] İçerik ve yedek bütünlüğü kontrol edildi

### Sonuç ve takip

- Sonuç: `<doğrulanan sonuç>`
- Tekrarı önleyici iş: `<issue veya tarihli aksiyon>`
- Son kontrol eden: `<ekip rolü>`
```

## Yedekleme doğrulama kaydı

Her tam yedek ve geri yükleme testinde bir kayıt oluşturun. Bulut sağlayıcısını/proje alanını yazabilirsiniz; gizli bağlantı veya erişim anahtarı yazmayın.

```markdown
### BKP-YYYY-MM — `<slug>`

- Yedek tarihi (UTC): YYYY-MM-DD
- Yedek kapsamı: reference / finals / raw / docs / hesap veri dışa aktarımı
- Yedek konumu: `<ekipçe belirlenen erişim kontrollü depolama alanı>`
- Dosya sayısı veya toplam boyut (isteğe bağlı): `<sayı>` / `<boyut>`
- Geri yüklenen örnek dosya türü: `<ör. final video>`
- Geri yükleme sonucu: Geçti / Başarısız / Bekliyor
- Kontrol eden (ekip rolü): `<rol>`
- Eksik veya takip işi: `<yok veya issue bağlantısı>`
```

## Olay kayıtları

Henüz kayıt yok.
