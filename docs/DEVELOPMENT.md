# Geliştirme Kuralları

Bu dosya, kod yazan herkesin (insan ya da agent) uyması gereken kuralları toplar. Issue'lardaki "Uygulama rehberi" bölümleri buraya referans verir. Kurallar, önceki PR incelemelerinde gerçekten yaşanan hatalardan çıkarıldı. Her başlığın altında "neden" kısa notu var.

İlgili dosyalar: kurulum `docs/SETUP.md` · branch/PR akışı `docs/WORKFLOW.md` · veri modeli `docs/data-model.md` · auth `docs/AUTH.md` · panel arayüz kuralları `apps/panel/AGENTS.md`.

## 0. Veritabanı değişiklikleri SADECE migration ile (en önemli kural)

- Test ve production veritabanlarına **sadece pipeline yazar** (`.github/workflows/_migrate.yml`). `test`'e merge → `Deploy · test`, `main`'e merge → `Deploy · production`.
- **Yasak** (insan ve agent fark etmez):
  - Supabase Studio'nun SQL editöründe veya Table Editor'de şema değiştirmek
  - Supabase MCP ile `execute_sql` / `apply_migration` çalıştırmak
  - Yerelden uzak projeye `supabase link`, `supabase db push` veya `migration repair` çalıştırmak
  - `psql` ile uzak veritabanına bağlanıp değişiklik yapmak
- **Doğru yol:** `supabase/migrations/<YYYYMMDDHHMMSS>_<ad>.sql` dosyası ekle (RLS ve pgTAP testiyle) → PR → CI → merge → pipeline uygular.
- **Uygulama verisi** (influencer, kayıt, bütçe…) panel veya API üzerinden girilir. Elle SQL ile veri değiştirilmez. Sabit referans verisi gerekiyorsa o da migration'dır.
- **Zorlama:**
  - CI'daki `Migration kuralları` işi değiştirilmiş, silinmiş veya sırasız migration'ı reddeder.
  - Deploy sırasında `db push` repoda olmayan uzak migration'ı reddeder.
  - Deploy sonunda `db diff` sapma kontrolü yapar: migration dışı bir şema değişikliği varsa deploy kırmızıya düşer.
  - Claude Code için yasaklı komutlar `.claude/settings.json`'da tanımlı.
- **Acil durumda bile** önce migration yazılır. Uzak veritabanında elle bir şey yapıldıysa hemen ekibe haber verilir ve aynı değişiklik migration'a çevrilir.

## 1. Bitti tanımı (Definition of Done)

Bir issue ancak şunların hepsi sağlandığında kapanır:

- [ ] Issue'daki **her kabul kriteri** en az bir otomatik testle doğrulanıyor: arayüz davranışı için Playwright E2E, saf mantık için Vitest, yetki için pgTAP. PR açıklamasında kriter → test eşlemesi yazılı.
- [ ] Güvenlik içeren işlerde (auth, yetki, redirect, dosya, dış API) **negatif testler** var: yetkisiz kullanıcı, boş tablo, eşzamanlı istek, kötü niyetli girdi (ör. `next=/\\evil.com`).
- [ ] İşin dokunduğu **mevcut özellikler** listelendi ve testleri güncellendi (ör. auth gelince shell E2E'leri ve 404 davranışı etkilendi).
- [ ] `pnpm check` ve `pnpm build` yerelde geçiyor, CI (`ci-ok`) yeşil.
- [ ] Yeni env değişkeni varsa `.env.example`'a boş değer ve açıklamayla eklendi.
- [ ] Şema değiştiyse yeni migration, pgTAP testi ve yeniden üretilmiş tipler aynı PR'da.
- [ ] Gerekiyorsa doküman güncellendi (`docs/data-model.md`, `docs/AUTH.md` …).
- [ ] PR açıklamasında `Closes #<issue>` var.

> Neden: `?inf=` seçimi sadece ana sayfada test edilmişti, sayfalar arasında kaybolduğu fark edilmedi (#77 → #80).

## 2. Veritabanı (Supabase / Postgres)

**Migration'lar**

- Var olan migration dosyası **asla değiştirilmez**. Her değişiklik yeni bir dosyayla yapılır: `supabase/migrations/<YYYYMMDDHHMMSS>_<kisa_ad>.sql`.
- Migration'lar idempotent değildir ve sırayla çalışır. Yerelde `pnpm supabase:db-reset` ile baştan uygulanabildiği doğrulanmalı.

**RLS (her yeni tablo için zorunlu)**

- `alter table ... enable row level security;` komutu ve tablo başına açık politikalar yazılır. Anon rolüne grant verilmez.
- Rol modeli `docs/data-model.md`'deki yetki matrisidir: owner/editor yazar, viewer sadece okur, ekip dışındakiler hiçbir şey göremez.
- `security definer` fonksiyonlarda `set search_path = ''` (veya sabit bir şema) kullanılır ve tablolar şema adıyla yazılır.
- **Test zorunlu:** `supabase/tests/` altına pgTAP testi yazılır. Testler şunları denemeli:
  - ekip dışındaki kullanıcı okuyamıyor
  - viewer yazamıyor
  - kullanıcı kendi rolünü yükseltemiyor
  - editor rol değiştiremiyor
- Yetkisiz `UPDATE`/`DELETE` hata vermez, **0 satır** döner. Bu yüzden `is_empty($$ update ... returning 1 $$)` ile test edilir, `throws_ok` ile değil.

> Neden: İlk RLS testleri sadece `influencers` tablosuna bakıyordu. Yeni bir tabloda RLS unutulsaydı fark edilmeyecekti (#80 tüm tabloları kontrol eden test ekledi).

**İstemciye güvenme**

- `created_by`, `owner_id`, `team_id` gibi sahiplik ve audit alanları istemciden gelen veriden alınmaz. Trigger ile `auth.uid()`'den doldurulur. API ve form kodu bu alanları göndermez.

> Neden: `created_by` istemci tarafından başka bir kullanıcının id'siyle yazılabiliyordu (#80 → `20261021120000_harden_audit_columns.sql`).

**Gizli bilgiler**

- OAuth token'ı, API anahtarı ve şifreler tabloya düz metin olarak yazılmaz. Vault'ta tutulur, tabloda sadece referans durur (`token_ref`).

**Tipler**

- `packages/shared/src/database.types.ts` **üretilmiş dosyadır, elle düzenlenmez**. Şema değişince `pnpm supabase:types` çalıştırılır, CI fark görürse PR'ı düşürür.
- Yardımcı tipler (`Row<'x'>`, `TeamRole` …) `packages/shared/src/database.ts` içinde. Panel kodu her zaman `@ai-influencer/shared` üzerinden import eder.

## 3. Sunucu / API (Next.js 16)

- Bu Next.js sürümü eğitim verilerinden farklı olabilir. Middleware dosyası `proxy.ts` olarak adlandırılır. Emin olmadığın API için `node_modules/next/dist/docs/` altına bak (bkz. `apps/panel/AGENTS.md`).
- **Hazır yardımcıları kullan** (ayrıntı `docs/AUTH.md`). Kendi auth/Supabase istemcini yazma:

  | Nerede                          | Kullan                                                                                                                                |
  | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
  | Korumalı sayfa                  | `src/app/(panel)/` altına koy, layout `requireTeamMember()` ile korur. Owner'a özel sayfa: `requireOwner()`                           |
  | API route                       | İlk satır `const auth = await requireApiRole('editor')` (`if (!auth.ok) return auth.response`), gövde `parseJson(request, zodSchema)` |
  | Veritabanı (kullanıcı adına)    | `createSupabaseServerClient()`, RLS uygulanır                                                                                         |
  | RLS'i bilerek aşmak (davet vb.) | `createSupabaseAdminClient()`, sadece sunucuda, gerekçesi yorumla yazılır                                                             |
  | Redirect parametresi            | `src/lib/safe-redirect.ts`                                                                                                            |

- **Yetki her zaman sunucuda kontrol edilir.** UI'da butonu gizlemek yetki kontrolü değildir. Route handler ve server action'lar oturumu ve rolü kendisi doğrular, RLS de ikinci savunma hattıdır.
- **Girdi doğrulama:** Dışarıdan gelen her veri (body, query, params, form) Zod ile doğrulanır. Hata durumunda 400 ve anlaşılır bir mesaj döner.
- **Service role anahtarı** sadece `import 'server-only'` içeren modüllerde kullanılır. Hiçbir `NEXT_PUBLIC_*` değişkeninde sır olmaz.
- **Redirect'ler:** `next`/`redirect` gibi parametrelerle yönlendirme yapılıyorsa sadece aynı origin'deki göreli yollar kabul edilir (open redirect yasak).
- **Env eksikse:** Uygulama anlamlı bir hata verir, build kırılmaz. CI'da Supabase secret'ı yok, build ve E2E secret olmadan geçmeli.
- **Durum kodları:** `notFound()`, 401/403 gibi davranışlar E2E'de **HTTP status** ile test edilir. Suspense/stream altında sayfa 200 dönebilir.

> Neden: Bilinmeyen panel bölümü, Suspense yüzünden 404 yerine 200 dönüyordu (#80).

- **Yan etkiler sadece Route Handler / Server Action'da.** Server Component render sırasında veritabanına yazmaz, cookie ayarlamaz, `signOut()` çağırmaz. Çıkış `/auth/signout` (POST) üzerinden yapılır.
- **Hata yutma yok.** Her Supabase çağrısında `error` kontrol edilir. Boş `catch {}` yazılmaz. Beklenen hata kullanıcıya anlamlı mesajla, beklenmeyen hata loglanarak döner. Loga token, anahtar veya sağlayıcı yanıtının tamamı yazılmaz.
- **Yardımcı kopyalama yok.** `apiError`, `parseJson`, `safeRedirect` gibi bir yardımcının ikinci versiyonu yazılmaz, `src/lib/`'teki mevcut olan kullanılır veya genişletilir. Issue Zod diyorsa elle regex yazılmaz.
- **Config değişikliği çalıştırılarak doğrulanır.** `supabase/config.toml`, `next.config.ts` veya env yükleme değişikliğinin etkisi yerelde ve E2E ile kanıtlanır.

> Neden (#78): Boş ekipte giriş yapan herkes owner olabiliyordu. `next=/\\evil.com` dış siteye yönlendiriyordu. `enable_signup=false` yerelde magic link'i de kapatmıştı. Kökteki `.env.local` panele hiç ulaşmıyordu. Üye olmayanın oturumu Server Component içinde kapatılmaya çalışılıyor ama sessizce başarısız oluyordu.

## 4. Arayüz

Ayrıntılar `apps/panel/AGENTS.md`'de. Özet:

- Tailwind utility kullanılır. Renkler `globals.css` değişkenlerinden gelir, hex yazılmaz. Metin kontrastı en az 4.5:1 olmalı.
- Sayfada tek `<main>` olur (`PanelShell` içinde).
- Gerçek kişi adı ya da uydurma metrik sabit kodlanmaz. Veri yoksa `EmptyState` gösterilir, demo veri `supabase/seed.sql` ile aynı olur.
- Etkileşimli öğeler gerçek `<button>`/`<a>` olur, etiketi ne yaptığını söyler.
- Influencer seçimi `?inf=<slug>` ile taşınır, iç linklerde korunur.

## 5. Çapraz platform

- Ekipte Windows ve macOS var, CI ikisinde de çalışıyor. `package.json` script'lerinde bash'e özgü komut kullanılmaz (`rm -rf`, `export`, `cp`). Gerekirse `scripts/*.mjs` yazılır.
- Dosya yollarında `path.join` / `fileURLToPath` kullanılır. Child process gerekiyorsa Windows'taki `.cmd` shim'leri düşünülür.

## 6. Bağımlılıklar

- Sadece `pnpm`. Sürümler sabittir (`^` yok). Yeni paket eklemeden önce mevcut bir paketin işi görüp görmediği kontrol edilir.
- postinstall script'i olan paketler `pnpm-workspace.yaml` → `onlyBuiltDependencies` listesine bilinçli olarak eklenir.
- Major sürüm yükseltmesi ayrı bir PR'da yapılır.

## 7. Repo public

- Repo herkese açık. Issue, PR, commit ve dokümanlara şunlar yazılmaz:
  - gerçek hesap olayları (ele geçirilme, kısıtlama)
  - kişisel bilgiler
  - parola, token, kurtarma kodu
  - özel paylaşım linkleri
  - prompt metinleri (işin ticari değeri). Prompt'lar panelde tutulur; panelden indirilen paketler (`ai-influencer-prompts-*.json`) repoya eklenmez
- Operasyonel kayıtlar ekibin erişimi kısıtlı alanında tutulur.

> Neden: `docs/incidents.md` başlangıçta gerçek olay kaydı için tasarlanmıştı (#79).

## 8. PR

- Bir PR tek bir issue'yu kapatır. Büyük işler alt PR'lara bölünür (ideal: 400 satır altı, lockfile hariç).
- PR açmadan önce `test`'e rebase edilir. Çakışmalı PR'da CI çalışmaz ve otomatik merge olmaz.
- İnceleme isteniyorsa PR draft açılır veya `bekle` label'ı eklenir. Aksi halde CI geçince otomatik merge olur.
- **Aynı issue'ya ikinci PR açılmaz.** Issue'da açık bir PR varsa onun üzerinde çalışılır. Başlamadan önce `gh pr list --search "<issue no>"` ile kontrol edilir.
- **İşe başlarken issue'yu kendine ata ve `in progress` label'ı ekle:** `gh issue edit <n> --add-assignee @me --add-label "in progress"`. Atanmış veya `in progress` olan bir issue'ya başkası başlamaz, önce sahibine sorar. Agent'lar da başlamadan önce atanmış kişiyi, label'ı ve açık PR'ları kontrol eder. PR `Closes #n` ile merge olunca label otomatik kalkar. İşi yarıda bırakıyorsan label'ı kaldır ve issue'ya nerede kaldığını yaz.
- Commit'ler anlamlı olur. Dosya başına bir commit (`feat: X (dosya.ts)`) atılmaz. CI'ı hiç çalışmamış bir PR "hazır" sayılmaz.
