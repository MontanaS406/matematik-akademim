# Matematik Akademim

Türkçe konu anlatımları, altı öğretmen, kullanıcı hesabı ve gece mavisi dört menü:
**Soru Çöz**, **Konular**, **Öğretmen**, **İlerleme**.

## Soru havuzları

- **AI alıştırmaları:** Kullanıcının ZIP'indeki 1.165 kayıt ve erişilebilir AI
  sorularından bağımsız biçimde hazırlanan yeni TYT/AYT alıştırmaları. Konu,
  sınav, alt konu, seviye ve içe aktarılan/yeni havuz filtreleri bulunur. Beş
  seçenekten biri işaretlenip kontrol edildiğinde açıklamalı çözüm açılır.
- **Orijinal sorular:** Ayrı tutulur. ZIP'teki 8 kaynak/185 sayfa aralığı ve 480
  sınav soru konumu yalnızca **indekstir**; asıl soru içerikleri ZIP'te yoktur.
  Görülmemiş kitapçıklar okunmuş gibi sayılmaz. Bu havuzda şu an 0 soru vardır.
- **ÖSYM denemeleri:** AI alıştırmaları bu havuza taşınmaz, çıkmış soru veya
  resmî cevap anahtarı gibi sunulmaz. Mevcut resmî soru kataloğu boştur.

Kesin sayılar [bank-summary.json](data/ai/bank-summary.json) içindedir.
Tüm 1.165 arşiv kaydı korunur; matematik denetimi geçmeyenler, sınav etiketi
incelemesi gerekenler ve tekrarlar çözülebilir listeden dışlanır. Otomatik
matematik denetimi **insan editör onayı değildir**; bu ayrım soru bilgisinde
açıkça gösterilir. Zorluk seviyeleri gerekçeli otomatik önerilerdir, öğrenci
başarı verisiyle kalibre edilmiş ölçümler değildir.

Dosya seçme/yükleme ekranı eklenmedi. Eski cihaz kitapçıkları, hesaplar,
ilerleme ve deneme geçmişi silinmez. AI yanıtları mevcut hesap kapsamlı
öğrenme kayıtlarına eklenir; eski veya inceleme durumundaki kimliklerin
geçmiş kayıtları tutulur. Üretim Supabase şeması/verisi değiştirilmez. Geliştirme
ayrı dal ve PR üzerinden yürütülür; yayın, kullanıcının son isteği doğrultusunda
matematik denetimi, otomatik testler ve CI tamamlandıktan sonra yapılır.

## Veri ve yeniden üretilebilir denetim

- `data/ai/archive-input.json`: tek ana arşiv; TYT/AYT alt listeleri yeniden
  içe alınmadığı için çift kayıt oluşmaz. Kaynak açıklaması: [IMPORT.md](data/ai/IMPORT.md).
- `scripts/imported-math-audit.py`: soru metninden iki bağımsız yöntemle çözüm,
  seçenek eşdeğerliği, cevap anahtarı ve belirsiz koşul denetimi.
- `scripts/generation/`: sürümlenmiş, deterministik, çevrimdışı soru kurguları.
  Yeni soruların ebeveyni gerçekten erişilen bir AI kayıt kimliğidir. Asıl
  yayıncı kitapçıklarına erişildiği iddia edilmez.
- `scripts/verify-generated-bank.py`: üreticinin sonucunu güvenilir kabul
  etmeden sembolik çözüm/sonlu tarama, koşul, seçenek, anahtar ve istem-işlem
  uyumu denetimi. Desteklenmeyen işlemler incelemeye gider.
- `scripts/build-ai-bank.py`: bağımsız raporları birleştiren, tekrarları
  karantinaya alan ve statik kataloğu oluşturan kapalı geçişli derleme.
- `data/ai/batch-manifest.json`, `review-ledger.json`, `similarity-review.json`:
  parti kimlikleri, işlenen kaynaklar, içerik özetleri ve dışlama nedenleri.
  Benzerlik taraması temkinli bir metin/işlem denetimidir; bütün semantik
  tekrarları bulduğu iddia edilmez.
- `data/ai-bank.js`, `shared/ai-bank.js`: tarayıcı için statik AI kataloğu ve
  yalnızca uygun kayıtları açan kayıt katmanı. Tarayıcı yeni soru üretmez.
- `data/question-bank.js`, `shared/question-bank.js`: AI'dan ayrı, kaynak ve
  kullanım hakkı denetimi olan özgün soru katmanı; boş tutulur.

Kısmi çalışma `work/ai-pipeline-state.json` ile giriş ve çıkış SHA-256
özetlerine göre devam eder. Başarılı partiler değişmediyse tekrar üretilmez;
girdisi değişen aşama yeniden çalışır. Temiz bir çalışma alanında tüm katalog
aynı çıktıyla yeniden kurulabilir:

```sh
npm ci
python3 -m pip install -r scripts/requirements-ai.txt
npm run build:ai-bank
npm run audit:ai-bank
npm test
npm run audit:questions
npx playwright install --with-deps chromium
npm run test:e2e
```

`npm run audit:ai-bank` statik çıktıları değiştirmeden yeniden hesaplamayla
karşılaştırır. `python3 scripts/ai-bank-pipeline.py --check --force` önbelleği
atlayarak bütün denetimleri tekrar çalıştırır. CI aynı denetim ve masaüstü/
telefon testlerini uygular. Kurulu Chromium için
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` kullanılabilir.

Tarayıcı testleri dış servisleri taklit eder. Gerçek Supabase hesaplarına veya
ücretli AI servisine bağlanıldığı iddia edilmez. Telifli yayınevi kitapçıkları
bu depoya kopyalanmaz. `docs/` içindeki önceki raporlar tarihsel kayıtlardır.
