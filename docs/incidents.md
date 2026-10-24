# Olay ve yedekleme doğrulama şablonları

> ⚠️ **Bu repo public.** Gerçek olay ve yedek kayıtları bu dosyaya veya repodaki herhangi bir dosyaya, issue'ya ya da PR'a **yazılmaz**. Bir hesabın ele geçirildiği, kısıtlandığı veya yedeğinin eksik olduğu bilgisi herkese açık olursa saldırganlara hedef verir. Aşağıdaki şablonları kopyalayıp ekibin erişimi kısıtlı alanında (ör. paylaşılan parola kasasının notları veya ekip içi private doküman) doldurun.

Bu dosya, olay ve geri yükleme testi kayıtları için şablon sağlar. Kayıtlarda parola, doğrulama kodu, kurtarma kodu, token, özel paylaşım bağlantısı, tam e-posta/telefon veya hassas mesaj içeriği yazılmaz. Kanıt dosyaları yalnızca ekip erişimi kısıtlı depoda tutulur; bu dosyaya depo yolu veya gizli olmayan kısa bir referans yazılabilir.

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

## Telif / içerik şikâyeti kaydı

Telif ihtarı (strike), Content ID talebi, kişilik hakkı, marka veya “gerçek kişi taklidi” şikâyeti için kullanılır (#33). Prosedür: [`docs/compliance.md`](compliance.md) → “İhtar ve şikâyet prosedürü”. Şikâyet edenin kişisel bilgilerini (ad, e-posta, telefon) yazmayın; platformun bildirim kimliği ve hak sahibinin herkese açık hesap/kurum adı yeterlidir.

```markdown
## CPY-YYYY-NNN — <kısa başlık>

- Durum: Açık / İtiraz edildi / Kapalı
- Bildirim tarihi (UTC): YYYY-MM-DD HH:MM
- Platform: Instagram / TikTok / YouTube / Diğer
- Hesap slug’ı: `<slug>`
- Bildirim türü: Telif ihtarı / Content ID talebi / Kişilik hakkı / Marka / Diğer
- Platform bildirim kimliği: `<varsa>`
- Şikâyet eden: `<herkese açık hesap veya kurum adı>`
- Gerekçe (platformun bildirdiği): `<kısa özet>`
- İlgili içerik kartı: `<panel içerik başlığı veya kimliği>`
- Kaynak türü (içerik kartındaki [Kaynak] bloğu): kendi / stok / acik-lisans / ucuncu-kisi
- Olay sorumlusu: `<ekip rolü>`

### Alınan aksiyonlar

- [ ] İçerik tüm platformlardan kaldırıldı veya gizlendi (tarih: YYYY-MM-DD)
- [ ] Aynı kaynaktan üretilmiş diğer içerikler kontrol edildi
- [ ] Bildirim ekran görüntüsü + metni kısıtlı depoda saklandı
- [ ] Kaynak dosyası ve lisans/izin belgesi kısıtlı depoda bulundu / bulunamadı
- [ ] Hesap durumu (Account Status / YouTube Studio telif ihtarları / TikTok ihlaller) kontrol edildi
- [ ] İtiraz kararı: Yapılmadı / Yapıldı (yalnız kaynak bize aitse veya lisans belgesi varsa)

### Kanıt konumu

`<erişimi kısıtlı depodaki göreli klasör veya güvenli kayıt kimliği>`

### Sonuç ve takip

- Sonuç: `<geri çekildi / ihtar kaldı / içerik geri yüklendi / hesap etkisi yok>`
- Kök neden: `<kaynak uygunluğu adımında neden yakalanmadı>`
- Tekrarı önleyici iş: `<check-list veya compliance.md güncellemesi, issue>`
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

## Kayıtlar nerede tutulur?

Kayıtlar repoda tutulmaz, ekibin erişimi kısıtlı alanında durur. Repoda sadece tekrarı önleyici işler, hassas ayrıntı içermeyen issue'lar olarak açılır (ör. "Aylık 2FA kontrolü hatırlatıcısı ekle").
