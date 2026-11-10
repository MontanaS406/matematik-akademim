# Matematik Akademim

Türkçe konu anlatımları, altı öğretmen, kullanıcı hesabı ve deneme geçmişi.

## Güncel durum

Kullanıcının talebiyle herkese açık soru bankası tamamen boşaltıldı: **0 kaynak / 0 soru**. Önceki 142 kaydın soru metinleri hem uygulama kataloğundan hem SQL aktarım dosyasından çıkarıldı. Yeni içerik, kullanıcının göndereceği ZIP incelendikten sonra eklenecek; bu aşamada yeni soru üretilmez veya yedek soruyla doldurulmaz.

Dört ana menü ve gece mavisi tasarım korunur: **Soru Çöz**, **Konular**, **Öğretmen**, **İlerleme**. Soru Çöz ekranında yalnız **Henüz soru yok** boş durumu görünür; cevap formu veya örnek soru açılmaz. Konu anlatımları, öğretmen seçimi, hesap sistemi ve Sınav Modu altyapısı yerindedir.

Kişisel PDF’ler, hesaplar, ilerleme kayıtları ve deneme geçmişi silinmedi. Kullanıcıya özel dosyalar herkese açık banka değildir. Eski soru kimliklerini içeren ilerleme kayıtları, kaldırılmış metinleri yeniden oluşturmaz. Sunucuya veri silme, şema veya seed işlemi uygulanmadı.

## Kod ve veri

- `data/question-bank.js`: uygulama ve Worker için boş ortak katalog.
- `supabase/question-bank-seed.sql`: yalnız `begin`/`commit` içeren, soru eklemeyen aktarım.
- `shared/question-bank.js`: gelecekteki içerik için kaynak/izin/cevap doğrulaması.
- `js/app.js`: aynı menüler ve açık boş durum.
- `js/exams.js`, `js/private-exams.js`, `shared/private-library.js`: hesap, özel kitapçık ve geçmiş altyapısı.
- `shared/curriculum.js`, `shared/teachers.js`: konu anlatımları ve altı öğretmen.

Uygulama modülleri ve soru bankası URL’sinin sürümü birlikte yenilendi; eski katalog tarayıcı önbelleğinden yeni arayüze taşınmaz.

## Yerel doğrulama

```sh
npm ci
npm test
npm run audit:questions
npx playwright install --with-deps chromium
npm run test:e2e
```

Kurulu Chromium için `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` kullanılabilir. Testler üretime soru eklemez; dış servisler gerektiğinde sahte servislerle sınanır. Özel sınav dosyaları ve kullanıcı kayıtları korunur.

`docs/` altındaki önceki raporlar tarihsel kayıtlardır; eski 142 soru sayısı güncel bankayı anlatmaz.
