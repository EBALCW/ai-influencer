# Hesap güvenliği, yedekleme ve hesap durumu runbook’u

> **Kapsam:** AI Influencer Studio için kullanılan Instagram/Meta, TikTok, YouTube/Google ve karaktere özel e-posta hesapları. Bu dosya operasyonel kontrol listesidir; platformların resmi kurtarma akışlarının yerine geçmez. Menü adları ve güvenlik özellikleri değişebileceği için işlem öncesinde resmi yardım bağlantılarını kontrol edin.
>
> **Güvenlik kuralı:** Parola, 2FA tohumu, tek kullanımlık kod, kurtarma kodu, özel kurtarma bağlantısı veya tam telefon/e-posta adresini bu repoya, issue’ya, sohbete ya da ekran görüntüsü eki olarak koymayın. Bu bilgiler yalnızca ekip parola yöneticisinin paylaşılan kasasında tutulur.

## Sorumluluklar ve erişim

- Her platformda kişisel parolayı ekip arkadaşları arasında paylaşmak yerine platformun ekip/rol özelliğini kullanın. Meta Business Suite/Business Portfolio erişimini kişi bazında verin; gerekli en düşük rolü seçin.
- En az iki yetkili ekip üyesinin hesap kurtarma sürecini ve paylaşılan kasanın kullanımını bildiğini doğrulayın. Bu kişiler parolayı mesajlaşma kanallarına kopyalamaz.
- Hesaba bağlı e-posta hesabını önce güvenceye alın. E-posta hesabı ele geçirilirse sosyal hesapların parola sıfırlaması da risk altına girer.
- İşten ayrılan veya erişimi gerekmeyen kişinin platform rolünü, parola kasası erişimini ve bağlı üçüncü taraf uygulamalarını aynı gün kaldırın.

## İlk kurulum kontrol listesi

Hesap envanterinde yalnızca kullanıcı adı, platform, hesap türü, sorumlu rol ve kurulum tarihini tutun. Gizli giriş bilgileri parola kasasında kalır.

1. Hesaba özel e-posta oluşturun; uzun ve benzersiz parolayı parola yöneticisinde saklayın.
2. E-posta hesabında 2 adımlı doğrulamayı etkinleştirin. Kurtarma e-postası/telefonu erişilebilir ve güncel olsun.
3. Sosyal hesapta platformun sunduğu 2FA/2SV seçeneklerinden authenticator uygulaması, passkey veya güvenlik anahtarıyla çalışabilen yöntemi tercih edin. Platform birden fazla doğrulama yöntemi sunuyorsa yedek yöntemi de kurun. SMS’i tek kurtarma yolu olarak bırakmayın.
4. Kurtarma kodları veriliyorsa kasada ilgili hesap kaydında saklayın. Tek kullanımlık kod kullanıldığında kasadaki kopyayı güncelleyin; yeni kod kümesi çıkarıldığında eski kodları geçersiz kabul edin.
5. Giriş yapılan cihazları, güvenlik bildirimlerini ve bağlı uygulamaları gözden geçirin; tanımadığınız veya gereksiz erişimleri kaldırın.
6. Ekip rolü, 2FA, kurtarma yöntemleri ve hesap erişiminin ikinci ekip üyesi tarafından kontrol edilmesini sağlayın. Kodları veya parolayı bu kişiye göndermeyin.
7. Kontrolü aşağıdaki aylık kayda ekleyin. “Yapıldı” olarak işaretlemek için ilgili hesabın ayarlarında sonucu doğrulayın.

### Platform kontrol noktaları

Platform arayüzü değişebileceğinden aşağıdaki adımları başlangıç noktası olarak kullanın ve güncel resmi yönergeyi izleyin.

| Platform                     | Güvenlik kontrolü                                                                                                                                         | Resmî kaynak                                                                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Instagram / Meta             | Accounts Center’da Instagram hesabı için iki faktörlü doğrulama; bağlı oturumları ve resmi hesap güvenliği bildirimlerini kontrol edin.                   | [Instagram 2FA Yardımı](https://help.instagram.com/566810106808145) · [Meta hesap güvenliği](https://www.meta.com/safety/topics/safety-basics/tools/security/)                       |
| TikTok                       | Security & permissions / Security checkup bölümünde 2-step verification, doğrulanmış iletişim bilgileri, cihazlar ve güvenlik etkinliğini inceleyin.      | [TikTok hesap güvenliği](https://support.tiktok.com/en/safety-hc/account-and-user-safety/account-safety)                                                                             |
| YouTube / Google             | Google hesabında 2-Step Verification, kurtarma yöntemleri ve yedek kodları kontrol edin. Kanal erişimini parola paylaşımı yerine kanal izinleriyle verin. | [Google 2-Step Verification kurtarma seçenekleri](https://support.google.com/accounts/answer/7684753) · [Yedek kodları kullanma](https://support.google.com/accounts/answer/1187538) |
| Instagram veri dışa aktarımı | Aylık hesap verisi dışa aktarımını Accounts Center içinden başlatın; arşivi erişimi kısıtlı yedek alanında saklayın.                                      | [Meta Accounts Center bilgi indirme](https://about.fb.com/news/2023/10/manage-your-information-across-apps/)                                                                         |

## İçerik ve hesap yedekleri

İçerik dosyaları ve hesap giriş bilgileri ayrı tutulur. Yedek klasörlerini takımın seçtiği erişim kontrollü bulut alanında oluşturun; bu repo sadece gizli olmayan metin ve şablonları taşır.

```text
influencer/<slug>/
├── reference/     # Seçilmiş karakter referansları
├── finals/        # Yayına hazır özgün video ve görseller
├── raw/           # Kaynak proje ve düzenlenebilir dosyalar
└── docs/          # Persona, prompt ve lisans/kaynak notları
```

- Panel dosyaları için `pnpm backup:storage` ve ardından `pnpm backup:storage:verify <klasör>` kullanın (`docs/SETUP.md`). Bu yerel export, bulut kopyasının ve gerçek dosya açma testinin yerine geçmez. DB ve Storage yedeğini aynı bakım aralığında alın.
- Haftalık kontrol: yeni final dosyaları, düzenlenebilir proje dosyaları, prompt ve persona güncellemeleri yedeğe gitti mi?
- Aylık kontrol: Instagram/Meta bilgi dışa aktarımı talep edildi mi; arşivin erişimi kısıtlandı mı?
- İlk tam yedek ve geri yükleme testi için tarih, klasör ve sonucu `docs/incidents.md` içindeki **Yedekleme doğrulama kaydı** şablonuyla ekibin erişimi kısıtlı alanına yazın (repo public; kayıt repoya girmez). Buraya dış bulut bağlantısı, hesap adı veya gizli dosya paylaşım linki eklemeyin.
- En az bir örnek dosyayı yedek konumundan ayrı bir çalışma klasörüne geri alın ve açılabildiğini doğrulayın. Test kopyasını doğrulama sonrası kaldırın.

## Hesap durumu ve ani erişim düşüşü

Ani erişim/izlenme düşüşü tek başına “shadowban” kanıtı değildir. Önce platformun resmi bildirimini ve hesap durumu ekranını kontrol edin; aynı dönemdeki içerik formatı, yayın saati ve olağan metrik dalgalanmasını da karşılaştırın.

1. Tarih/saat, etkilenen içerikler ve gözlenen değişikliği kaydedin; ekran görüntülerini yalnızca erişimi kısıtlı olay klasöründe saklayın.
2. Platform içi Account Status / hesap durumu ve güvenlik bildirimlerini kontrol edin. Uyarı yoksa yaptırım varmış gibi varsayım yapmayın.
3. Bilinmeyen oturum, bağlı uygulama veya hesap değişikliği görürseniz önce e-posta hesabını ve sosyal hesabı güvene alın; bilinmeyen erişimi kaldırın ve oturumları sonlandırın.
4. Resmi ihlal bildirimi varsa içeriği, kaynak dosyaları ve bildirimi koruyun. Politika ihlalini doğruladıktan sonra gerekli düzeltmeyi yapın; itirazı yalnızca gerçek kayıtlarla destekleyebiliyorsanız platformun resmi kanalından gönderin.
5. Hesap ele geçirilmişse yayınlama ve otomasyon erişimlerini durdurun, ekip üyelerini güvenli kanaldan bilgilendirin ve aşağıdaki olay akışını uygulayın.

Erişim performansına dayanarak sabit süreli paylaşım arası verme kuralı yoktur; platformun gerçek bir güvenlik/hesap kısıtı yoksa yayın sıklığını ani ve kanıtsız şekilde değiştirmeyin.

## Ele geçirilme veya erişim kaybı müdahalesi

1. **Koordinasyon:** Olayı `docs/incidents.md` şablonuyla ekibin erişimi kısıtlı alanına kaydedin (repoya veya issue'ya değil); bir olay sorumlusu belirleyin. Kod, parola veya 2FA kodu paylaşmadan ekip üyelerine haber verin.
2. **E-posta ve kurtarma:** Hesaba bağlı e-posta/Google hesabını güvenli cihazdan açın. Bilinmeyen oturumları kapatın, benzersiz parolayı değiştirin, 2FA ve kurtarma yöntemlerini doğrulayın.
3. **Sosyal hesap:** Resmi uygulamayı/adresi doğrudan açın; güvenlik bildirimi ve cihaz listesini kontrol edin. Parolayı değiştirin, tanınmayan oturum ve üçüncü taraf uygulamalarını kaldırın, 2FA yöntemini ve iletişim bilgisini kontrol edin.
4. **İzinler:** Meta Business, kanal yöneticileri, TikTok bağlantıları ve yayınlama araçlarında bilinmeyen kişi/uygulama erişimini kaldırın. Gerekirse API tokenlarını iptal edip yenileyin; tokenı issue veya loga yazmayın.
5. **Kurtarma:** Oturum açamıyorsanız yalnızca platformun resmi hesap kurtarma akışını kullanın. Tek kullanımlık kodu kimseye vermeyin; “destek” olduğunu söyleyerek DM’den yazan kişiye yanıt vermeyin.
6. **Doğrulama:** Hesaba yeniden erişince e-posta, 2FA, cihazlar, ekip rolleri, içerik değişiklikleri ve bağlı uygulamaları yeniden kontrol edin. Gerekli resmi itirazı/şikâyeti gönderin.
7. **Kapanış:** Kanıtı, alınan önlemleri, etkilenen içerikleri ve yedekten geri dönüş sonucunu olay kaydına yazın. Aylık gözden geçirme listesine tekrar eden nedeni ekleyin.

## Aylık güvenlik ve yedek kontrolü

Her ayın ilk haftasında her platform hesabı için bir satır doldurun. Tabloyu repoda değil ekibin erişimi kısıtlı alanında tutun, bu tablo yalnızca şablondur. Gerçek e-posta/telefon, 2FA kodu veya kurtarma kodu eklemeyin.

| Tarih (UTC) | Hesap slug’ı | 2FA kontrolü      | Oturum/cihaz kontrolü | Bağlı uygulama kontrolü | İçerik yedeği | Geri yükleme testi | Kontrol eden  |
| ----------- | ------------ | ----------------- | --------------------- | ----------------------- | ------------- | ------------------ | ------------- |
| YYYY-MM-DD  | `<slug>`     | Yapıldı / Aksiyon | Temiz / Aksiyon       | Temiz / Aksiyon         | Tam / Eksik   | Geçti / Bekliyor   | `<ekip rolü>` |

## Kaynak kontrolü

Resmî platform yardım bağlantıları son kez **21 Ekim 2026** tarihinde kontrol edildi. Platform ekranları, yöntemleri ve kurtarma akışları değişebilir; her aylık kontrolde bağlantıların güncel sürümünü kullanın.
