# Matematik Akademim

Türkçe ders anlatımları, altı AI öğretmen, kaynaklı matematik soru bankası ve kullanıcıya özel deneme geçmişi.

## Kullanım

Dört bölüm: **Soru çöz**, **Konular**, **Öğretmen**, **İlerleme**. Ana ekran doğrudan gerçek bir soru açar. Konu anlatımları, öğretmen seçimi ve hesap işlemleri kendi alanlarındadır. Küçük **Sınav Modu** seçeneği TYT/AYT/KPSS kitapçıklarını, uygulama içi görüntüleyiciyi, optik formu ve kronometreyi açar; bu kontroller yalnız mod içinde görünür.

- [Sade arayüz yenilemesi](docs/SADE_ARAYUZ_RAPORU.md)
- [Sınav Modu hazırlık raporu](docs/SINAV_MODU_HAZIRLIK_RAPORU.md)

## Güncel soru kuralı

Uygulama soru üretmez. Geliştirici alıştırmaları, eski rastgele üretici ve hazır örnek sorular kaldırıldı. Soru bankası yalnızca **kaynağı, yeniden kullanım izni ve cevap anahtarı doğrulanmış** içerikleri kabul eder. Uygun içerik olmayan konuda boş durum mesajı gösterilir.

Güncel katalog: **132 gerçek numaralı soru + 10 yayımlanmış çözümlü örnek**, toplam **142 kayıt**. Altı Tyler Wallace PDF’sindeki CC BY 3.0 sorularının yalnız yönergeleri Türkçeleştirildi; matematik ifadeleri/sayıları ve özgün numaraları korundu. TÜBA Açık Ders’ten 10 Türkçe çözümlü örnek CC BY-NC-SA 4.0 şartlarıyla alındı. Bunlar TYT/AYT çıkmış sorusu olarak sunulmaz.

- [Soru bankası ve kullanım onarımı](docs/SORU_BANKASI_ONARIMI.md)
- [Geçiş ve sonuç raporu](docs/SORU_BANKASI_GECIS_RAPORU.md)
- [Kaynak/izin araştırması ve belge listesi](docs/SORU_KAYNAK_ARASTIRMASI.md)
- [Türkiye sınavları: 68 belgeli devam araştırması](docs/TURKIYE_SINAV_KAYNAKLARI.md)
- [Özel kitapçık geliştirmesi ve sınırlar](docs/OZEL_SINAV_KITAPCIKLARI_RAPORU.md)
- [Yazarın kaynak dizini](https://www.wallace.ccfaculty.org/book/book.html)
- [Lisans](https://creativecommons.org/licenses/by/3.0/)

## Kod ve veri

- `data/question-bank.js`: uygulama ve Worker’ın ortak denetlenmiş kataloğu.
- `shared/question-bank.js`: yayın, kaynak, izin, cevap, yinelenme, yıl ve tam sınav denetimi.
- `shared/curriculum.js`: 27 konunun soru içermeyen tanımsal anlatımları.
- `js/app.js`: kaynak kartları, konu seçimi, öğretmen ve ilerleme arayüzü.
- `js/exams.js`: hesap işlemleri, güvenli eşitleme, ilerleme ve geçmiş.
- `js/exam-mode.js` / `js/private-exams.js`: yalnız Sınav Modu içinde açılan özel kitapçık çalışması.
- `shared/private-library.js`: hesap kimliğiyle ayrılan yerel IndexedDB deposu; PDF/anahtar için sunucu isteği yapmaz.
- `data/turkish-exams.js` / `shared/private-exam.js`: 18 kaynak kitapçık kimliği, anahtar kanıtları, iptal denetimi ve dosya eşleştirmesi. Soru metni içermez.
- `cloudflare-worker/worker.js`: yalnız seçili kaynak sorusuna bağlı AI açıklaması.
- `supabase/question-bank.sql` / `question-bank-seed.sql`: yeni içerik tabloları ve incelenebilir 142 kayıtlık staging aktarımı. Üretime uygulanmadı.

## Yerel doğrulama

```sh
npm ci
npm test
node scripts/question-bank-tools.mjs
npx playwright install --with-deps chromium
npm run test:e2e
```

Kurulu Chromium için `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` kullanılabilir. Ana tarayıcı paketi gerçek dış servisleri çağırmaz; açıkça tanımlı sahte servisler kullanır. Ayrı `Official booklet integration` CI kontrolü, resmî 2024 TYT/AYT dosyalarını test koşucusunun belleğinde açar; belge veya görüntü eki yayımlamaz. Soru metni özeti veya SQL seed kaynağıyla uyuşmazsa test başarısız olur.

## Kayıtlar ve sınırlar

Kişisel geçmiş, eski ilerleme kimlikleri ve hesaplar silinmez. Başlatma, bitirme ve sonuç eşleştirmesi depoya yazılmadan tamamlanmış gösterilmez; yazma hatasında önceki durum korunur. Güncel dosya/anahtar denetimiyle uyuşmayan eski netler silinmeden gizlenir; uygun kaynakta açık yeniden hesaplama yapılabilir. İlk profil yazmasından önce hesap başına yerel yedek alınır. Kaldırılmış soru metinleri eski kayıtlardan tekrar üretilmez.

2018–2026 TYT/AYT yıl ve kitapçık seçimi Sınav Modu’ndadır. Herkese açık 142 kayıt çıkmış TYT/AYT sorusu olarak sunulmaz; yeniden dağıtım izni olmayan kitapçıklar kamuya açık bankaya kopyalanmaz. 2019 AYT’nin 40 matematik cevabı resmî kaynaktan doğrulanarak kataloğa eklendi. Eski PDF önbelleği ve önceki akışın kaynak/izin/tamlık denetimleri korunur.

Belge seçimi, uygulama içi PDF görüntüleme ve optik alan yalnız **Sınav Modu** içinde bulunur. TYT/AYT için 16 iptalsiz tam anahtar korunur. Özgün 2024 TYT/AYT dosyaları kayıtlı SHA-256 özetiyle otomatik tanınır; bilinen özete uymayan dosyada kaynak anahtarı açılamaz. Dosya özeti henüz bulunmayan diğer 14 anahtar açık kitapçık kimliği teyidi gerektirir. KPSS tam anahtarları doğrulanmadığında sonuç otomatik puanlanmaz. Özel dosyalar ve ilerleme hesap kimliğiyle ayrılan güvenli yerel depoda kalır; eski kayıtlar silinmez. 2024 KPSS Lisans ve Ön Lisans kısmi kaynakları tam deneme sayılmaz; Lisans’ın yayımlanan matematik konumları 31, 41, 46’dır ve 42 iptali ayrıca bildirilir. Aynı kitapçık yeniden çözülebilir; bitmiş denemeler salt okunur geçmişte cevap/anahtar anlık görüntüleriyle korunur. Eski sekmenin yeni denemeyi ezmesi engellenir. Geçmiş JSON dışa aktarmaya dahildir. Bu görev otomatik birleştirme veya yayın yapmaz.

Hesaptan çıkış cihazda hemen uygulanır ve yakalanan eski Supabase oturumu için scope=local sunucu çıkışı denenir; geç yanıt yeni hesaba dokunmaz. Sunucu çıkışı doğrulanamazsa açık uyarı gösterilir. Canlı Supabase ve gerçek AI/model bağlantısı doğrulanmadı. Worker erişim kodu kişisel kullanım içindir; çok kullanıcılı sunucu kimliğinin yerine geçmez. Sırlar istemciye veya GitHub’a konmaz. Bu geliştirme PR üzerinde hazırlanır; bu görevde otomatik birleştirme veya yayın yapılmaz.

Önceki aşamaların raporları `docs/` altında tarihsel kayıt olarak korunur; eski soru üretimi hakkındaki açıklamaları güncel davranış değildir.
