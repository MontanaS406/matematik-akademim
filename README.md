# Matematik Akademim

Türkçe ders anlatımları, altı AI öğretmen, kaynaklı matematik soru bankası ve kullanıcıya özel deneme geçmişi.

## Güncel soru kuralı

Uygulama soru üretmez. Geliştirici alıştırmaları, eski rastgele üretici ve hazır örnek sorular kaldırıldı. Soru bankası yalnızca **kaynağı, yeniden kullanım izni ve cevap anahtarı doğrulanmış** içerikleri kabul eder. Uygun içerik olmayan konuda boş durum mesajı gösterilir.

İlk katalog: Tyler Wallace’ın *Beginning and Intermediate Algebra* (2010) kitabının altı bölüm PDF’sinden **12 açık uçlu gerçek soru**, **CC BY 3.0 Unported**. Özgün dil, sayılar ve soru numaraları korunur; A–E seçenekleri uydurulmaz. Bunlar TYT/AYT çıkmış soruları değildir.

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
- `js/exams.js`: doğrulanmış sınav kapısı, cevap alanı, süre ve geçmiş.
- `js/private-exams.js`: cihazdaki özel PDF, optik form, kronometre, konu etiketleri ve sonuç inceleme.
- `shared/private-library.js`: hesap kimliğiyle ayrılan yerel IndexedDB deposu; PDF/anahtar için sunucu isteği yapmaz.
- `data/turkish-exams.js` / `shared/private-exam.js`: 17 kaynak kitapçık kimliği, anahtar kanıtları, iptal denetimi ve dosya eşleştirmesi. Soru metni içermez.
- `cloudflare-worker/worker.js`: yalnız seçili kaynak sorusuna bağlı AI açıklaması.
- `supabase/question-bank.sql` / `question-bank-seed.sql`: yeni içerik tabloları ve incelenebilir 12 soruluk staging aktarımı. Üretime uygulanmadı.

## Yerel doğrulama

```sh
npm ci
npm test
node scripts/question-bank-tools.mjs
npx playwright install --with-deps chromium
npm run test:e2e
```

Kurulu Chromium için `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` kullanılabilir. Tarayıcı testleri gerçek dış servisleri çağırmaz; açıkça tanımlı sahte servisler kullanır. Soru metni özeti veya SQL seed kaynağıyla uyuşmazsa test başarısız olur.

## Kayıtlar ve sınırlar

Kişisel geçmiş, eski ilerleme kimlikleri ve hesaplar silinmez. İlk profil yazmasından önce hesap başına yerel yedek alınır. Kaldırılmış soru metinleri eski kayıtlardan tekrar üretilmez.

Herkese açık bankada 2018–2026 TYT/AYT seçimi bulunur; izinli ve nihai anahtarı doğrulanmış tam 40 soru olmadan kamuya açık tam deneme açılmaz. Eski PDF önbelleği korunur; bu eski genel akışta kaynak/izin/tamlık ve dosya SHA-256 doğrulaması gerekir.

Yeni **Türkiye sınav kitapçığımı cihazımda çöz** alanı, kullanıcının kendi edindiği gerçek PDF'yi yalnız kendi tarayıcısında açar. Soru, şekil ve seçenekler özgün PDF'de; cevap alanları aynı ekranda görünür. Dosya, kullanıcı anahtarı, konu etiketleri ve sonuçlar hesap kimliğine göre ayrılan yerel IndexedDB'de tutulur; Supabase'e, AI'ya veya herkese açık bankaya gönderilmez. Bu ayrım cihazda şifreleme değildir; tarayıcı verileri silinirse yerel kopyalar kaybolabilir. Cevap yedeği dışa aktarılabilir; PDF ayrıca saklanmalıdır.

17 TYT/AYT kitapçık kimliği ve anahtar durumu incelendi. İptalsiz 15 tam anahtar, kullanıcı sınav/yıl/temel kitapçık ve soru sırasını açıkça teyit ettikten sonra **çalışma neti** hesaplar. Bu teyit PDF'nin bağımsız dosya doğrulaması değildir; gerçek kaynak dosyalarının SHA-256 özeti henüz yoktur. 2019 TYT 7 ve 2026 AYT 23 iptalleri nedeniyle bu iki sınavın neti kapalıdır. Bilinmeyen anahtar puan üretmez; kullanıcı anahtarıyla hesaplama yalnız açık manuel işlemle ve doğrulanmamış etiketiyle yapılır. Bu sonuç ÖSYM sınav/yerleştirme puanı değildir.

KPSS, ALES, DGS, MEB ve diğer gerçek kaynaklar özel PDF olarak açılabilir; bunlar için tam resmî anahtar doğrulaması tamamlanmadı. Özgün soru numaraları ve kullanıcıya ait sayfa eşleştirmeleri korunur; konu sınıflandırması kullanıcı etiketidir. Yeniden yayım izni bulunan yeni Türkçe soru metni bulunamadı: bu aşamada kamuya açık bankaya eklenen Türkçe soru **0**.

Canlı Supabase ve gerçek AI/model bağlantısı doğrulanmadı. Worker erişim kodu kişisel kullanım içindir; çok kullanıcılı sunucu kimliğinin yerine geçmez. Sırlar istemciye veya GitHub’a konmaz. Bu görev siteyi yayımlamaz ve ana dala birleştirme yapmaz.

Önceki aşamaların raporları `docs/` altında tarihsel kayıt olarak korunur; eski soru üretimi hakkındaki açıklamaları güncel davranış değildir.
