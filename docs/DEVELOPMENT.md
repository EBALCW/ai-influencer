# Geliştirme Kuralları

Bu dosya, kod yazan herkesin (insan ya da agent) uyması gereken kuralları toplar. Issue'lardaki "Uygulama rehberi" bölümleri buraya referans verir. Kurallar, önceki PR incelemelerinde gerçekten yaşanan hatalardan çıkarıldı. Her başlığın altında "neden" kısa notu var.

İlgili dosyalar: kurulum `docs/SETUP.md` · branch/PR akışı `docs/WORKFLOW.md` · veri modeli `docs/data-model.md` · auth `docs/AUTH.md` · panel arayüz kuralları `apps/panel/AGENTS.md`.

## 1. Bitti tanımı (Definition of Done)

Bir issue ancak şunların hepsi sağlandığında kapanır:

- [ ] Issue'daki **her kabul kriteri** en az bir otomatik testle doğrulanıyor: arayüz davranışı için Playwright E2E, saf mantık için Vitest, yetki için pgTAP. PR açıklamasında kriter → test eşlemesi yazılı.
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
- Operasyonel kayıtlar ekibin erişimi kısıtlı alanında tutulur.

> Neden: `docs/incidents.md` başlangıçta gerçek olay kaydı için tasarlanmıştı (#79).

## 8. PR

- Bir PR tek bir issue'yu kapatır. Büyük işler alt PR'lara bölünür (ideal: 400 satır altı, lockfile hariç).
- PR açmadan önce `test`'e rebase edilir. Çakışmalı PR'da CI çalışmaz ve otomatik merge olmaz.
- İnceleme isteniyorsa PR draft açılır veya `bekle` label'ı eklenir. Aksi halde CI geçince otomatik merge olur.
