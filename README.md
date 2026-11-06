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