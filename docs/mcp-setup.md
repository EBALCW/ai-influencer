# Claude + Higgsfield MCP kurulumu

- **İlgili issue:** [#11](https://github.com/EBALCW/ai-influencer/issues/11) · panel tarafı: [ADR 0002](adr/0002-generation-provider.md), #47
- **Araştırma tarihi:** 2026-10-24. Aşağıdaki her bilgi, sonundaki **Kaynaklar** listesindeki sayfalardan bu tarihte okundu. Resmi kaynakta bulunamayan bilgiler **doğrulanamadı** olarak işaretli.
- **Durum:** Kurulum adımları yazıldı. Ücretli test üretimleri henüz yapılmadı, bkz. [Test check-list'i](#test-check-listi-elle-ücretli).

## Karar

**Higgsfield'in resmi, barındırılan (hosted) bir MCP sunucusu var. Onu kullanıyoruz.** Alternatif sağlayıcıya veya topluluk sunucusuna gerek yok.

| Kullanım                          | Ne kullanılır                                             | Kimlik doğrulama                                           | Faturalandırma                                           |
| --------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| Sohbetten üretim (Claude, bu doc) | Resmi MCP: `https://mcp.higgsfield.ai/mcp`                | OAuth (tarayıcıda Higgsfield girişi). **API anahtarı yok** | higgsfield.ai aboneliğinin kredileri (ücretli plan şart) |
| Claude Code'da alternatif         | Resmi CLI `@higgsfield/cli` + `higgsfield-ai/skills`      | `higgsfield auth login` (tarayıcı)                         | Aynı abonelik kredileri                                  |
| Panelden üretim (#47, kuyruk)     | Higgsfield Cloud REST API (`api.higgsfield.ai`), ADR 0002 | `HIGGSFIELD_API_KEY_ID` / `_SECRET` (Edge Function secret) | Ayrı Cloud bakiyesi, **USD** (console.higgsfield.ai)     |

Neden:

1. Sunucu Higgsfield'in kendi alan adında ve help center'da resmi olarak belgelenmiş. Claude Code dahil istemciler OAuth meta verisinde açıkça listeleniyor (aşağıda "Doğrulama kanıtı").
2. Anahtar yok: kimlik OAuth ile alınıyor, token'ı istemci saklıyor. Repoya, config dosyasına veya sohbete sızabilecek bir sır oluşmuyor. Repo public olduğu için bu en önemli avantaj.
3. İhtiyacımız olan işlemlerin hepsi var: görsel, image-to-video, Kling 3.0 Motion Control (video-to-video), Soul karakterleri, kredi bakiyesi.

> MCP ile panel API'si **ayrı ürünler, ayrı bakiyeler.** MCP'de harcanan kredi Cloud API bakiyesinden düşmez, tersi de geçerli. Maliyet kaydı (#13 / #59) yazarken hangisinden harcandığını belirt.

## Higgsfield bulguları

### Resmi MCP sunucusu

| Konu               | Bulgu                                                                                                                                                                                                                                                                    | Kaynak   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Adres / transport  | `https://mcp.higgsfield.ai/mcp`, Streamable HTTP                                                                                                                                                                                                                         | [1], [2] |
| Auth               | OAuth 2.1 authorization code + PKCE (S256), dinamik istemci kaydı. Yetkilendirme sunucusu Clerk (`clerk.higgsfield.ai`), kapsamlar `openid email offline_access`. Help center: "No API key"                                                                              | [1], [3] |
| Plan şartı         | "An active paid subscription is required." Ücretsiz üretim ve "unlimited" model erişimi MCP'de **yok**, sadece higgsfield.ai web arayüzünde                                                                                                                              | [1]      |
| Kredi              | Her üretim plan fark etmeksizin standart fiyatla kredi düşer. **Yerleşik kredi sınırı yok**; sınır sadece prompt talimatıyla konabilir (help center: "a prompt-level instruction, not a hard limit")                                                                     | [1]      |
| İşlemler           | Görsel ve video üretimi (tüm modeller), upscale, arka plan silme, outpaint / reframe, **Kling 3.0 Motion Control**, **Soul karakterleri** ve referans Elements, ses (seslendirme, ses klonlama, dublaj), Personal Clipper, **kredi bakiyesi**, üretim ve yükleme listesi | [1]      |
| Referans dosyaları | Ajan sohbete eklenen dosyayı **okuyamaz**. Referans görsel, ajanın açtığı Higgsfield yükleme penceresinden verilir                                                                                                                                                       | [1]      |
| Çıktılar           | Higgsfield hesabında Assets'e düşer (MCP etiketiyle, genelde 60 sn içinde)                                                                                                                                                                                               | [1]      |
| Araç adları        | Resmi listede araç adları yok. İkincil kaynaklar `generate_image`, `generate_video`, `create_character` vb. diyor. **Doğrulanamadı**; bağlandıktan sonra `/mcp` ekranında gerçek listeye bak                                                                             | [4]      |
| Rate limit         | MCP için ayrıca belgelenmemiş (**doğrulanamadı**). API tarafında sınır hesap ve modele göre değişir, eşzamanlılık üstü işler kuyruğa girer, kuyruk dolarsa `429` + `Retry-After`                                                                                         | [5]      |
| Kredi fiyatları    | Model başına kredi tablosu herkese açık sayfalarda bulunamadı (**doğrulanamadı**; pricing sayfası JS ile yükleniyor). Fiyat, MCP'den bakiye sorgulanarak veya CLI'da `higgsfield generate cost ...` ile görülür                                                          | [1], [6] |

### Resmi CLI ve skill paketi

- `@higgsfield/cli` (npm, MIT, sürüm 1.2.2, 2026-10-16). npm bakımcıları `@higgsfield.ai` adresli. Kaynak: [higgsfield-ai/cli](https://github.com/higgsfield-ai/cli) (679 yıldız, son push 2026-10-22). Komutlar: `auth login/logout`, `account` (kredi bakiyesi, işlemler), `generate create/cost/wait/get/list`. [6]
- [higgsfield-ai/skills](https://github.com/higgsfield-ai/skills) (organization, MIT, 1375 yıldız, son push 2026-09-26): Claude Code / Codex / Cursor plugin'leri, `higgsfield-generate`, `higgsfield-soul-id` vb. skill'ler. [1]
- Help center, Claude Code için bu yolu öneriyor. MCP de Claude Code'da çalışıyor; aşağıda ikisi de var.

### Topluluk MCP sunucuları (kullanmıyoruz)

Resmi sunucu varken bunlara gerek yok. Kayıt için güvenilirlik notları (GitHub verisi 2026-10-24):

| Repo                                                                                    | Bakımcı            | Yıldız | Son commit | Lisans | Kimlik bilgisi                                                                                                                     | Değerlendirme                                                                                                       |
| --------------------------------------------------------------------------------------- | ------------------ | -----: | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [Hikhakk/higgsfield-mcp-unified](https://github.com/Hikhakk/higgsfield-mcp-unified)     | Bireysel kullanıcı |     98 | 2026-10-17 | MIT    | Config'in `env` bloğuna API key + secret yapıştırılıyor. Opsiyonel "web backend" tarayıcı çerezi (`__client`, `__session`) istiyor | Bakımlı ama resmi değil. Çerez modu hesap ele geçirme riski ve büyük olasılıkla kullanım şartı ihlali. **Kullanma** |
| [jfikrat/higgsfield-mcp](https://github.com/jfikrat/higgsfield-mcp)                     | Bireysel kullanıcı |      3 | 2026-04-15 | MIT    | Clerk oturum çerezi / JWT, tarayıcıdan token çeken yardımcı                                                                        | Çok az kullanıcı, oturum çerezi istiyor. **Kullanma**                                                               |
| [nukIeer/higgsfield-unlimited-mcp](https://github.com/nukIeer/higgsfield-unlimited-mcp) | Bireysel kullanıcı |     14 | 2026-07-22 | MIT    | Tarayıcı oturumu (Clerk session id/JWT), web uygulamasının "unlimited" bayrağını taklit ediyor                                     | Kullanım şartı ve hesap kapatma riski. **Kullanma**                                                                 |
| [geopopos/higgsfield_ai_mcp](https://github.com/geopopos/higgsfield_ai_mcp)             | Bireysel kullanıcı |     42 | 2025-11-03 | MIT    | API anahtarı                                                                                                                       | Bir yıldır güncellenmiyor. **Kullanma**                                                                             |

Genel kural: topluluk sunucusuna anahtar veya çerez vermeden önce kaynak kodunu oku. Tarayıcı çerezi isteyen sunucu hiçbir koşulda kullanılmaz.

### Alternatifler (yedek plan)

Higgsfield erişilemez olursa aynı akış şunlarla kurulabilir. Hepsinin resmi MCP'si var:

| Sağlayıcı     | Resmi MCP                                                                                       | Auth                                                                                | Not                                                                                    | Kaynak |
| ------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| **fal.ai**    | `https://mcp.fal.ai/mcp` (HTTP)                                                                 | `Authorization: Bearer <FAL_KEY>` başlığı. Sunucu anahtarı saklamıyor               | 1000+ model (Kling, Seedance, Flux…); model arama, fiyat, kuyruk, iptal, dosya yükleme | [7]    |
| **Replicate** | `mcp.replicate.com` (hosted)                                                                    | Web akışında Replicate API token'ı girilir; yerel sürüm `REPLICATE_API_TOKEN` okur  | Replicate HTTP API'sinin tamamı                                                        | [8]    |
| **Runway**    | İkincil kaynaklar resmi hosted sunucu ve `runwayml/runway-api-mcp-server` reposundan bahsediyor | **Doğrulanamadı** (resmi doküman sayfası açılmadı, kaynaklarda farklı adresler var) | —                                                                                      | —      |
| **Kling**     | Resmi MCP bulunamadı                                                                            | —                                                                                   | Kling modelleri Higgsfield MCP ve fal.ai üzerinden zaten var                           | —      |

## Kurulum

Önce şunları kontrol et:

- [ ] Higgsfield'de **ücretli** bir abonelik ve yeterli kredi (ekip hesabı; giriş bilgisi ekip parola yöneticisinde).
- [ ] Claude Code güncel (`claude --version`) veya Claude Desktop güncel. Claude'da custom connector Free dahil tüm planlarda var, Free'de sadece 1 tane eklenebilir. [9]

### A. Claude Code (macOS ve Windows aynı)

**Önerilen: user scope.** Sunucu sadece senin makinende, tüm projelerinde görünür. Repo'ya hiçbir dosya yazılmaz.

```bash
claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp
```

Sonra Claude Code içinde:

```
/mcp
```

`higgsfield` → **Authenticate** seç, açılan tarayıcıda Higgsfield hesabıyla giriş yap ve onayla. Terminalden yapmak istersen: `claude mcp login higgsfield`. Token'ı Claude Code saklar ve yeniler; dosyaya veya env'e bir şey yazman gerekmez. [10]

**Neden repo'ya `.mcp.json` koymuyoruz:** Bu repoda Claude Code ve Codex agent'ları panel kodu üzerinde çalışıyor. Proje scope'lu bir Higgsfield sunucusu her oturumda yüklenir ve agent'ın yanlışlıkla kredi harcamasına yol açabilir. `claude -p` ve Agent SDK oturumları proje sunucularını onay sormadan yükler. [10] Kendi bilgisayarında proje bazlı istersen `--scope local` kullan (`~/.claude.json` içine yazılır, repoya girmez).

Referans için, proje scope'lu bir kayıt böyle görünür (anahtar yok, OAuth ile çalışır). **Commit'leme:**

```json
{
  "mcpServers": {
    "higgsfield": {
      "type": "http",
      "url": "https://mcp.higgsfield.ai/mcp"
    }
  }
}
```

**Alternatif: resmi CLI + skill'ler** (help center'ın Claude Code önerisi):

```bash
npm i -g @higgsfield/cli
higgsfield auth login
npx skills add higgsfield-ai/skills
```

Bu repo `pnpm` kullanıyor ama global CLI için `npm i -g` resmi kurulum komutu; repo bağımlılığı eklemediği için sorun yok. `higgsfield account` ile bakiye, `higgsfield generate cost ...` ile tahmini maliyet görülür. [6]

### B. Claude Desktop ve claude.ai (macOS ve Windows aynı)

Config dosyası gerekmez:

1. **Settings → Connectors → Add custom connector** (Pro/Max'te sohbetteki "+" menüsünden de açılır).
2. Ad: `Higgsfield`, URL: `https://mcp.higgsfield.ai/mcp`.
3. **Connect** → açılan pencerede Higgsfield'e giriş yap ve izin ver.
4. Higgsfield'in aktif connector listesinde göründüğünü kontrol et. Sohbette "Search and tools" menüsünden açık olduğundan emin ol. [1], [9]

Team/Enterprise hesabında connector'ü önce Owner organizasyona ekler, sonra her üye kendisi bağlanır. [9]

**Yedek yol, sadece connector ekranı çalışmazsa:** Claude Desktop'ın config dosyası stdio sunucularını çalıştırır. Uzak sunucuya `mcp-remote` köprüsüyle bağlanılır. Bu topluluk paketi ([punkpeye/mcp-remote](https://github.com/punkpeye/mcp-remote), MIT, 1600+ yıldız, sürüm 0.15.2). OAuth'u kendisi yapar, anahtar istemez.

| İşletim sistemi | Config dosyası                                                    |
| --------------- | ----------------------------------------------------------------- |
| macOS           | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows         | `%APPDATA%\Claude\claude_desktop_config.json`                     |

Dosyayı Claude Desktop → Settings → Developer → **Edit Config** ile açabilirsin.

macOS:

```json
{
  "mcpServers": {
    "higgsfield": {
      "command": "npx",
      "args": ["-y", "mcp-remote@0.15.2", "https://mcp.higgsfield.ai/mcp"]
    }
  }
}
```

Windows (`npx` bir `.cmd` dosyası olduğu için `cmd /c` ile sarılır):

```json
{
  "mcpServers": {
    "higgsfield": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "mcp-remote@0.15.2",
        "https://mcp.higgsfield.ai/mcp"
      ]
    }
  }
}
```

Kaydettikten sonra Claude Desktop'tan tamamen çık (macOS: Cmd+Q, Windows: sistem tepsisinden Quit) ve yeniden aç.

### C. Yedek sağlayıcı örneği: fal.ai (sadece Higgsfield kullanılamazsa)

fal.ai MCP OAuth değil, başlıkta anahtar istiyor. Anahtarı **komut satırına veya JSON'a yazma**. Kendi shell profilinde veya keychain'den okunan bir env değişkeninde tut:

```bash
# macOS: anahtarı bir kez keychain'e koy (değer sorulunca yapıştır, ekranda görünmez)
security add-generic-password -a "$USER" -s FAL_KEY -w
# ~/.zshrc içine:
export FAL_KEY="$(security find-generic-password -a "$USER" -s FAL_KEY -w 2>/dev/null)"
```

Sonra user scope'ta, değişkene referansla ekle. `~/.claude.json` dosyasını aç ve `mcpServers` altına şunu koy (Claude Code `${FAL_KEY}` değerini başlangıçta env'den doldurur): [10]

```json
{
  "mcpServers": {
    "fal": {
      "type": "http",
      "url": "https://mcp.fal.ai/mcp",
      "headers": { "Authorization": "Bearer ${FAL_KEY}" }
    }
  }
}
```

`claude mcp add ... --header "Authorization: Bearer <anahtar>"` biçimini kullanma: anahtar shell geçmişine ve config'e açık metin olarak düşer. Windows'ta `FAL_KEY` değerini kullanıcı ortam değişkeni olarak tanımla (Ayarlar → Sistem → Hakkında → Gelişmiş sistem ayarları → Ortam Değişkenleri), sonra terminali yeniden aç.

## Doğrulama

1. **Claude Code:** `claude mcp list` çıktısında `higgsfield: https://mcp.higgsfield.ai/mcp (HTTP) - ✔ Connected` görünmeli. `! Needs authentication` görüyorsan `/mcp` → Authenticate. `/mcp` → `higgsfield` → araç listesine bak.
2. **Claude Desktop:** Sohbette "Search and tools" altında Higgsfield ve araçları görünmeli.
3. **Ücretsiz duman testi:** Sohbette şunu yaz: _"Higgsfield'de kredi bakiyemi göster. Hiçbir üretim başlatma."_ Bakiye dönerse bağlantı ve yetki çalışıyor. Bu adım kredi harcamaz.
4. **Repo temizliği:** Kurulumdan sonra repoda yeni dosya olmamalı ve anahtar bulunmamalı:

   ```bash
   git status --short
   git grep -n -I -E "(Authorization: (Key|Bearer) [A-Za-z0-9]|whsec_[A-Za-z0-9]{8}|FAL_KEY=[A-Za-z0-9]|HIGGSFIELD_API_KEY_(ID|SECRET)=[A-Za-z0-9])"
   ```

   İkinci komut boş dönmeli (`.env.example`'daki boş `HIGGSFIELD_API_KEY_ID=` satırları eşleşmez).

### Doğrulama kanıtı (2026-10-24)

Anahtarsız bir `initialize` isteği `401` ve `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/mcp"` döndü. Korunan kaynak meta verisi yetkilendirme sunucusu olarak `https://clerk.higgsfield.ai`'ı ve PKCE akışı için olası istemcileri listeliyor: `anthropic`, `claude`, `claude-ai`, `claude-code`, `openclaw`, `hermes`. Yetkilendirme sunucusu meta verisinde `authorization_code`, `refresh_token`, `device_code`, PKCE `S256` ve `registration_endpoint` var. [2], [3]

## Test check-list'i (elle, ücretli)

Agent'lar bu adımları **çalıştırmaz**. Kredi harcar, bu yüzden ekipten biri yapar. Her testten sonra harcanan krediyi #13 tablosuna yaz (kaynak: "MCP / abonelik").

**Hazırlık**

- [ ] Referans set hazır (#2). Referans görseli Higgsfield yükleme penceresinden ver; sohbete eklenen dosyayı ajan okuyamaz.
- [ ] Oturumun başında Claude'a sınır koy, örneğin: _"Her üretimden önce model, ayarlar ve tahmini krediyi yaz ve onayımı bekle. Bu oturumda toplam X krediyi geçme. Başarısız üretimi kendiliğinden tekrar deneme."_ Bu sadece prompt talimatı, sert sınır değil. Bakiyeyi testten önce ve sonra kontrol et.
- [ ] Başlangıç bakiyesini not et.

**Test 1: referanslı görsel**

- [ ] Prompt: _"Referans görseldeki kadını kafede, pencere kenarında, doğal gün ışığında, telefon kamerası estetiğiyle üret"_. Soul karakteri varsa onu kullan, yoksa referans görselle.
- [ ] Kullanılan model, ayarlar, harcanan kredi ve süre not edildi.
- [ ] Çıktı `assets/generated/mcp-test/` veya Drive'a indirildi. Repo public: görsel repoya girecekse önce ekiple karar verin.

**Test 2: 5 sn image-to-video**

- [ ] Test 1 çıktısından 5 saniyelik video. Model, süre, çözünürlük ve kredi not edildi.

**Test 3 (opsiyonel): video-to-video**

- [ ] Kısa bir kaynak videoyla Kling 3.0 Motion Control. Kaynak videonun kullanım hakkı bizde olmalı.

**Kapanış**

- [ ] Karakter tutarlılığı #3 QC check-list'iyle kontrol edildi.
- [ ] Bitiş bakiyesi ve toplam harcama #13'e yazıldı.
- [ ] Bu dokümanın **Test sonuçları** tablosu dolduruldu.
- [ ] İkinci bir bilgisayarda (tercihen Windows) kurulum bu dokümanla tekrarlandı.
- [ ] `git grep` kontrolü yapıldı (Doğrulama 4. adım).

### Test sonuçları

| Test          | Tarih | Kim | Model / ayar | Kredi | Süre | Sonuç / not |
| ------------- | ----- | --- | ------------ | ----- | ---- | ----------- |
| 1 Görsel      |       |     |              |       |      |             |
| 2 Image→video |       |     |              |       |      |             |
| 3 Video→video |       |     |              |       |      |             |

## Bilinen sorunlar

| Belirti                                                 | Çözüm                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Authorization with the MCP server failed"              | Token süresi doldu. Connector'ü kaldırıp yeniden bağla. Claude Code'da `claude mcp logout higgsfield` ve `claude mcp login higgsfield` [1], [10] |
| Claude Higgsfield araçlarını çağırmıyor                 | Yeni sohbet aç, Higgsfield'i adıyla iste, connector'ün o sohbette açık olduğunu kontrol et [1]                                                   |
| "MCP HTTP exchange failed"                              | Genelde geçici. Tekrar dene, sürerse yeniden bağlan [1]                                                                                          |
| Ajan referans görseli görmüyor                          | Beklenen davranış. Dosyayı Higgsfield yükleme penceresinden ver [1]                                                                              |
| Ücretsiz plan / "unlimited" model MCP'de kredi harcıyor | Beklenen davranış. Unlimited ve ücretsiz üretim sadece web arayüzünde [1]                                                                        |
| Kredi kontrolsüz harcanıyor                             | Yerleşik sınır yok. Oturum başı talimatı ver, bakiyeyi kontrol et, gerekirse connector'ü kapat [1]                                               |
| Uzun yanıtlar kesiliyor (Claude Code)                   | `MAX_MCP_OUTPUT_TOKENS` değerini yükselt [10]                                                                                                    |
| Windows + Desktop config yolunda sunucu başlamıyor      | `command: "cmd"`, `args: ["/c", "npx", ...]` biçimini kullan. Node 18+ kurulu olmalı                                                             |
| Araç adları bu dokümandakiyle uyuşmuyor                 | Araç adları resmi olarak yayımlanmadı. Gerçek liste `/mcp` ekranındadır; dokümanı güncelle                                                       |

## Güvenlik notları

- **Repo public.** API anahtarı, OAuth token'ı, `whsec_` webhook secret'ı, çerez veya bunların ekran görüntüsü koda, commit'e, issue'ya, PR'a veya sohbete girmez.
- Higgsfield MCP OAuth kullanıyor: yapıştırılacak anahtar yok. Biri anahtar veya tarayıcı çerezi istiyorsa yanlış sunucudasın.
- Panelin Cloud API anahtarları (`HIGGSFIELD_API_KEY_ID` / `_SECRET`) sadece Edge Function secret'ı olarak durur. MCP kurulumunda bunlara **ihtiyaç yok**, Claude config'ine konmaz.
- `.mcp.json` repoya eklenmez (bkz. Kurulum A). `~/.claude.json` ve `claude_desktop_config.json` kişisel dosyalardır, paylaşılmaz.
- Anahtar gereken yedek sağlayıcılarda (fal.ai) anahtar keychain'den veya kullanıcı ortam değişkeninden okunur, komut satırına yazılmaz.
- Connector'ü kullanmadığında kapat. Ekip üyesi ayrılırsa Higgsfield hesabından oturumlarını kapat ve şifreyi değiştir.
- Claude bağlı servislerde senin yetkinle işlem yapabilir. Sadece güvendiğin MCP sunucularını bağla. [9]

## Panel (#47) için çıkarımlar

Araştırma sırasında Cloud API dokümanında ADR 0002'deki adaptör varsayımlarıyla çelişen noktalar bulundu. Ayrıntı ve gereken kod değişiklikleri (takip: #150): [ADR 0002 → "Doğrulama notları (2026-10-24)"](adr/0002-generation-provider.md#doğrulama-notları-2026-10-24).

## Kaynaklar

Hepsine erişim tarihi: 2026-10-24.

1. Higgsfield Help Center, "How do I connect Higgsfield to an AI agent": <https://higgsfield.ai/creator-hub/help-center/integrations/how-do-i-connect-higgsfield-to-ai-agent>
2. Higgsfield MCP tanıtım sayfası: <https://higgsfield.ai/mcp>
3. Higgsfield MCP OAuth meta verisi: <https://mcp.higgsfield.ai/.well-known/oauth-protected-resource>, <https://mcp.higgsfield.ai/.well-known/oauth-authorization-server>
4. İkincil kaynak (araç adları, resmi değil): <https://techsy.io/en/blog/higgsfield-mcp-claude-code>
5. Higgsfield API, Rate limits: <https://docs.higgsfield.ai/docs/concepts/rate-limits.md>
6. Higgsfield CLI: <https://github.com/higgsfield-ai/cli>, <https://www.npmjs.com/package/@higgsfield/cli>; skill'ler: <https://github.com/higgsfield-ai/skills>
7. fal.ai MCP: <https://fal.ai/docs/documentation/setting-up/mcp.md>
8. Replicate MCP: <https://replicate.com/docs/reference/mcp>, <https://replicate.com/blog/remote-mcp-server>
9. Anthropic, custom connectors (remote MCP): <https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp>
10. Claude Code MCP dokümanı: <https://code.claude.com/docs/en/mcp>
11. Higgsfield API dokümanı (indeks): <https://docs.higgsfield.ai/docs/llms.txt>
