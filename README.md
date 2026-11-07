# Matematik Akademim — Codex çalışma deposu

Bu klasör **v14** Matematik Akademim uygulamasının Codex üzerinde geliştirilmesi için hazırlanmıştır. Ana uygulama `index.html` dosyasıdır. Soru kitapçıkları **harici ÖSYM PDF'leri** olarak uygulama içinde görüntülenir; PDF dosyaları depoya kopyalanmaz.

## İçerik
- `index.html` — mavi temalı uygulamanın mevcut başlangıç kodu
- `cloudflare-worker/` — AI öğretmeni için örnek Worker (üretimde henüz devreye alınmış değildir)
- `tests/` ve `.github/workflows/` — otomatik temel testler
- `AGENTS.md` — Codex geliştirme ve güvenlik talimatları
- `GECE_GOREVI.txt` — Codex Cloud'a yapıştırılacak tam görev

## Yerel test
`npm test` — paket yüklemeden Node.js 20+ ile çalışır. Gerçek servis entegrasyonlarını doğrulamaz.

## Codex Cloud kurulumu
1. GitHub hesabında **matematik-akademim** isimli **private** (özel) depo oluştur. Hiçbir README veya .gitignore başlatma; bu paket zaten içeriyor.
2. Bu ZIP'i çıkar; klasörün **içindekileri** deponun köküne yükle (GitHub `Add file` > `Upload files`). ZIP'i tek dosya olarak yükleme, kod görünmez.
3. ChatGPT web veya masaüstünde **Work in > Cloud > Select environment > Create environment** yolunu izle.
4. GitHub'da oluşturduğun özel depoyu seç; Get started; test adımlarını incele ve Publish.
5. Start a new task: `GECE_GOREVI.txt` içeriğini yapıştır, gönder. İşi ayrı dalda yürütmesini ve PR hazırlamasını iste.
6. Sabah görev sonuçlarını, testleri ve PR değişikliklerini kontrol et; kendiliğinden üretime gönderilmez.

## Güvenlik
Gerçek şifre, Supabase secret key, service_role key, OpenAI API key veya Cloudflare Worker erişim kodu GitHub'a yüklenmez. Supabase RLS yalnızca SQL politika tanımıyla değil, farklı iki kullanıcıyla test edilmelidir. Bu paket bu testin yapıldığını iddia etmez. Codex görevleri kullanım kotaları ve izinlere bağlıdır.

## Bilinen sınırlar
- PDF kaynağının tarayıcıda gömülü gösterilmesi bazı cihazlarda engellenebilir. Dosya yükleme fallback vardır.
- Supabase auth ve senkronizasyon canlı hesaplarla burada uçtan uca test edilmedi.
- ÖSYM sorularını HTML'e izinsiz gömmek yerine resmî PDF gösterimi kullanılıyor.
- Daha ayrıntılı tarayıcı testleri ve kaynak doğrulaması Codex görevinde yapılmalıdır.
## Geliştirilmiş testler ve kaynak durumu

Önce `npm ci`, ardından `npm test` çalıştırın. Node testleri Worker hata yollarını ve PGlite PostgreSQL motorunda iki kullanıcılı RLS izolasyonunu da çalıştırır. Tarayıcı için `npx playwright install --with-deps chromium` ve `npm run test:e2e` kullanın. Kurulu Chromium kullanmak için `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` çalıştırılabilir. CI aynı kontrolleri çalıştırır.

Resmî PDF ve cevap anahtarları doğrulanamadığı için otomatik resmî puanlama kapalıdır. PDF yükleme, 40 cevap, ara kayıt, durdurulmuş sonuç, manuel değerlendirme, puanlamadan kayıt ve CSV dışa aktarma kullanılabilir. Önceden kayıtlı netler doğrulanmış sayılmaz.

- [Kaynak denetimi](docs/SOURCE_AUDIT.md)
- [Supabase test kapsamı ve canlı kabul adımları](docs/SUPABASE_TESTING.md)

Worker bir kişisel erişim kodu kullanır; tarayıcıya OpenAI anahtarı verilmez. Bu kod çok kullanıcılı kimlik doğrulamasının yerine geçmez. Üretime çıkmadan önce gerçek model erişimi, `ALLOWED_ORIGINS`, rate-limit binding ve kullanıcı bazlı erişim modeli ayrıca doğrulanmalıdır. Bu çalışma Worker’ı veya siteyi yayımlamaz.
