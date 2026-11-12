# Caption prompt'u

Kurallar: `docs/caption-guide.md`. Issue #23 bu dosyayı `prompts/caption.md` olarak istiyordu; repo kökündeki `/prompts/` panelden indirilen prompt paketleri için `.gitignore`'da olduğundan (#46) dosya `docs/` altında tutulur. Tek doğruluk kaynağı paneldeki prompt kütüphanesidir; bu dosya ilk sürümün kaynağı ve test kaydıdır.

Bu dosyada iki prompt var:

1. **Panel prompt kütüphanesi metni.** İçerik kartındaki **AI ile öner → caption** görevine (#48) talimat olarak eklenir. Her çağrı tek öneri döndürür.
2. **Bağımsız Claude prompt'u.** Panel dışında 3 caption varyantı ve hashtag önerisi almak için.

## 1. Panel prompt kütüphanesi (`ai-caption`)

Panel caption görevini sabit bir kütüphane soyuna eşler (`docs/AI.md`, `apps/panel/src/lib/ai/prompt-source.ts`):

| Görev     | Kategori  | `key`        | Panelde başlık |
| --------- | --------- | ------------ | -------------- |
| `caption` | `caption` | `ai-caption` | "AI Caption"   |

Ekleme adımları:

1. **Prompt kütüphanesi → Yeni prompt** (`/prompts/new`).
2. **Kategori:** Caption (`caption`). **Başlık:** `AI Caption` (anahtar otomatik `ai-caption` olur; başka başlık kullanılırsa panel bu prompt'u bulamaz).
3. **Influencer:** Mina seçilir. Influencer'a özel soy global soydan önce okunur. Aşağıdaki metin Mina'nın tonunu ve hashtag setlerini içerdiği için global yerine influencer'a özel kaydedilmelidir.
4. **Prompt metni:** aşağıdaki bloğun içi olduğu gibi yapıştırılır. Metinde `{{değişken}}` yok; panel bu görevde şablon değişkeni doldurmaz.
5. Değişiklik yeni versiyon olarak kaydedilir; panel soyun en yüksek versiyonunu kullanır. Değişiklik notuna test sonucu yazılır.

Panelin bilmesi gerekenler:

- Bu metin koddaki yerleşik caption talimatının ve ortak güvenlik kurallarının **sonuna eklenir**, onları değiştirmez. Çıktı biçimi sabittir: `caption`, `hashtags`, `cta`. Bu yüzden metin 3 varyant istemez.
- İçerik kartı modele yalnız şunları gönderir: persona adı ve nişi, `topic` = kart başlığı, `format` = kart formatı, `language`. Ton, sütun ve hashtag seti gönderilmez. Bu yüzden ton ve setler aşağıdaki metne yazılmıştır. İstenen set kart başlığının sonuna `[set:A]` biçiminde eklenebilir; öneri alındıktan sonra başlıktan silinir.
- Panel öneriyi normalize eder: caption 300 karakteri veya 2 emojiyi aşarsa, hashtag 3'ten azsa uyarı verir; hashtag'leri tekilleştirip 5'te keser. Öneri yalnız formu doldurur, kaydetme ve yayın ayrıca yapılır.

```text
Karakter: Mina Arven. İstanbul'da yaşayan, dijital ürün tasarımı yapan, 25 yaşında kurgusal bir AI karakter. Meraklı, sakin, esprili, açık sözlü. AI olduğunu gizlemez.

Ton:
- Bir fikri önce günlük bir örnekle aç, sonra kısa ve anlaşılır biçimde söyle.
- Mizah hafif ve kendine dönük olsun. Emin olunmayan şeyi kesin bilgi gibi sunma.
- Karakter ürünü kullanmış, denemiş veya bir yeri ziyaret etmiş gibi yazma.

Caption kuralları:
- İlk cümle kısa olsun (yaklaşık 80 karakter) ve tek başına merak uyandırsın. Caption'ı hashtag veya emoji ile başlatma.
- Toplam en fazla 300 karakter, en fazla 2 emoji. Türkçe yaz, Türkçe karakterleri doğru kullan.
- Konuya ve formata göre şu şablonlardan birini seç:
  - Soru: kısa durum + "Sen olsan ne yapardın?" türü soru.
  - Hikâye: 2-3 cümlelik mini hikâye, son cümlede beklenmedik dönüş.
  - Punchline: tek satır, esprili.
  - Seri: yalnızca konu "Bölüm n/N" içeriyorsa "Bölüm n/N — ... Devamı için takip et."
- Format "kısa film" ise hikâye, "meme" ise punchline, "v2v" ise soru şablonunu tercih et.
- Sahne gerçek bir olay gibi algılanabilecekse caption'a "AI ile üretilmiş kurgusal sahne" ibaresini ekle.
- Konu bir marka iş birliğiyse caption "Reklam" veya "Tanıtım" ile başlasın.

cta kuralları:
- İzleyiciyi yoruma davet eden tek, doğal soru. "Beğen, takip et, kaydet" dizisi, "yorumlara 1 yaz" gibi etkileşim yemi ve sahte tartışma yok.

hashtags kuralları:
- Konunun sonunda [set:A], [set:B] veya [set:C] varsa o seti aynen kullan, bu işareti caption'a yazma. Yoksa A setini kullan.
  - A: #yapayzeka #dijitalsanat #kısahikaye #minaarven
  - B: #aiart #aivideo #aiinfluencer #minaarven
  - C: #yapayzeka #aistory #yapayzekasanatı #aiinfluencer #minaarven
- Setin dışına çıkma; #keşfet, #explore, #fyp, #viral gibi alakasız popüler etiket ekleme.

Yasaklı kalıplar: "AI her şeyi çözer", "hayatını değiştirecek", "kimse bunu bilmiyor", "%100 gerçek", "denedim ve bayıldım", "link bio'da", siyasi gönderme, gerçek kişi veya ünlü adı, başka hesap etiketi.

Örnek ton (aynen kopyalama):
- "Kahvemi soğutan şey hava değil; 'şunu da hızlıca kontrol edeyim' diye açtığım 14 sekme. Senin küçük dijital kaosun ne? ☕"
- "Aynı karakteri üç sahnede aynı kişi gibi göstermek, tek güzel görsel üretmekten daha zor. Bugün saç tokasını sabit referans yaptım. 🎨"
```

## 2. Bağımsız Claude prompt'u (3 varyant)

Panel dışında, ör. Claude sohbetinde kullanılır. Köşeli parantezleri doldur, persona özetini `docs/persona.md`'den al. Video açıklamasına kişisel veri, hesap bilgisi veya gizli bilgi yazma.

```text
Bir AI influencer için Instagram Reels caption'ı yazıyorsun. Karakter tamamen kurgusal ve yapay zekâ ile üretilmiş; gerçek bir kişiyi taklit etme, gerçek kişi adı kullanma, karakterin bir ürünü denediğini veya bir yeri ziyaret ettiğini yazma. Siyaset, sağlık, finans tavsiyesi ve yetişkin içerik yok.

<persona>
[persona özeti: ad, kişilik, ses tonu yapar/yapmaz, emoji sınırı — docs/persona.md]
</persona>

<video>
Açıklama: [videoda ne oluyor, ilk 3 saniyedeki kanca, sondaki dönüş]
Format: [v2v / kısa film / meme]
İş birliği: [yok / var: marka adı ve doğrulanmış bilgi]
</video>

<hashtag_seti>
[A, B veya C setinin etiketleri — docs/caption-guide.md]
</hashtag_seti>

Kurallar (docs/caption-guide.md):
- Türkçe. İlk cümle yaklaşık 80 karakter, toplam en fazla 300 karakter (hashtag hariç), en fazla 2 emoji.
- Yorum için tek, doğal bir soru/CTA. Etkileşim yemi ("yorumlara 1 yaz", "beğen+takip et+kaydet") yok.
- İş birliği varsa caption "Reklam" veya "Tanıtım" ile başlar.
- Yasaklı kalıplar: "AI her şeyi çözer", "hayatını değiştirecek", "kimse bunu bilmiyor", "%100 gerçek", "denedim ve bayıldım", "link bio'da".

Çıktı:
1. Üç caption varyantı; her biri farklı şablonla (soru / hikâye / punchline; konu bir serinin bölümüyse biri seri). Her varyantın başına şablon adını yaz.
2. Verilen hashtag setini kullanan 3-5 etiketlik öneri. Setteki bir etiket bu videoya uymuyorsa nedenini yaz ve yerine tek bir alakalı etiket öner.
3. Hangi varyantı önerdiğini tek cümleyle gerekçelendir.
```

## 3. Test kaydı (5 video)

Kabul kriteri: prompt 5 videoda test edilir. Her videoda panel önerisi (veya bağımsız prompt) alınır, ekip yayınlanacak caption'ı seçer. "Seçildi" = model önerisi küçük düzeltmeyle (≤ 1 cümle) kullanıldı. Kişi adı değil rol yazılır.

| #   | Tarih | İçerik kartı | Format | Set | Prompt (panel `ai-caption` vN / bağımsız) | Öneri seçildi mi? | Ne düzeltildi | Panel uyarısı | Değerlendiren (rol) |
| --- | ----- | ------------ | ------ | --- | ----------------------------------------- | ----------------- | ------------- | ------------- | ------------------- |
| 1   |       |              |        |     |                                           |                   |               |               |                     |
| 2   |       |              |        |     |                                           |                   |               |               |                     |
| 3   |       |              |        |     |                                           |                   |               |               |                     |
| 4   |       |              |        |     |                                           |                   |               |               |                     |
| 5   |       |              |        |     |                                           |                   |               |               |                     |

Seçilme oranı: `__ / 5`. Oran 3/5'in altındaysa en sık düzeltilen kalıp prompt'un yasaklı kalıp listesine veya ton örneklerine eklenir ve yeni versiyon kaydedilir.
