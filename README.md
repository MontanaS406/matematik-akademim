# Matematik Akademim

Türkçe konu anlatımları, altı öğretmen, kullanıcı hesabı ve gece mavisi dört menü:
**Soru Çöz**, **Konular**, **Öğretmen**, **İlerleme**.

## Soru havuzları

- **AI alıştırmaları:** Önceki arşiv, AI → AI ve gerçekten okunan özgün kaynaktan
  bağımsız hazırlanan Orijinal → AI kayıtları ayrı köken alanları taşır. Önceden
  kullanılabilir olan **1.408 kayıt aynen korunur**; bu dalda **149 yeni uygun
  soru** ile toplam **1.557** kullanılabilir alıştırma vardır. Konu,
  sınav, alt konu, seviye ve içe aktarılan/yeni havuz filtreleri bulunur. Beş
  seçenekten biri işaretlenip kontrol edildiğinde açıklamalı çözüm açılır.
- **Orijinal sorular:** Son gönderilen 13 ZIP'in içindeki **95 gerçek PDF /
  1.256 sayfa** açıldı. Özel çalışma bankasında 36 soru ayrıldı; 29'u kullanım
  için doğrulandı, 7'si incelemede. Yeniden yayım izni doğrulanmadığından bu
  özgün metin/görseller herkese açık kataloğa konulmadı: yayımlanabilir soru
  sayısı **0**. Ekrandaki kaynak durumu bu nedeni ve gerçek okuma kanıtlarını
  gösterir. Önceki 8 kaynak/185 aralık/480 konum indeksi ayrıca korunur.
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
ayrı dal ve PR üzerinden yürütülür. Issue #11 geliştirmesi incelemeye sunulur;
birleştirme ve yayın için bu görevde otomatik işlem yapılmaz.

## Veri ve yeniden üretilebilir denetim

- `data/ai/archive-input.json`: tek ana arşiv; TYT/AYT alt listeleri yeniden
  içe alınmadığı için çift kayıt oluşmaz. Kaynak açıklaması: [IMPORT.md](data/ai/IMPORT.md).
- `scripts/imported-math-audit.py`: soru metninden iki bağımsız yöntemle çözüm,
  seçenek eşdeğerliği, cevap anahtarı ve belirsiz koşul denetimi.
- `scripts/generation/`: sürümlenmiş, deterministik, çevrimdışı soru kurguları.
  Önceki üreticiler AI arşivine bağlıdır. `source_derived_generator.py` ise
  gerçekten okunan özgün soruların ayrı, doğrulanmış okuma kanıtlarına bağlıdır.
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
aynı çıktıyla yeniden kurulabilir. CI için özgün telifli dosyalar gerekmez;
yalnız bağımsız AI kurguları ve içeriksiz okuma kanıtları kullanılır:

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

## Gerçek kaynakların özel işlenmesi — Issue #11

`data/source-pdf-inventory.json` gerçek dosya özetleri/sayfa sayıları;
`data/source-read-evidence.json` seçili soruların fiziksel sayfa, basılı sayfa,
soru numarası, özel içerik özeti ve cevap doğrulama durumudur. Bu dosyalar
özgün soru metni veya görseli içermez. `data/source-ai-review.json` yeni AI
taslaklarının ayrı semantik incelemesini ve bir yakın tekrar karantinasını
kaydeder. `data/ai/preserved-1408.json` önceki kullanılabilir kayıtların tam
içerik özetlerini dondurur.

Özgün dosyalara sahip yerel çalışma alanında:

```sh
python3 -m pip install -r scripts/requirements-sources.txt
python3 scripts/ingest_private_source_pdfs.py --manifest /yerel/files.json --bank /yerel/tyt-originals.json --bank /yerel/ayt-originals.json --output private/issue11
```

Bu komut gerçek PDF baytlarının SHA-256 özetini kontrol eder, sayfaları özel
inceleme alanına okur, soru numarası adaylarını inceleme durumunda tutar ve
seçili özgün kayıtlar için yerel HTML/görsel inceleme paketi çıkarır. Depodaki
`private/` dışındaki herkese açık bir çıktı yolunu reddeder. 1.256 sayfanın tüm
sorularının tek tek cevaplandırıldığı iddia edilmez; 36 tamamlanmış çıkarım ve
geri kalanın özel sayfa hazırlığı ayrı aşamalardır.

Bu görevde yeniden birleştirme veya yayın yapılmaz; değişiklikler Issue #11
için ayrı dal ve PR üzerinden incelemeye sunulur. Kapsam, eksik dosyalar ve
somut sayfa/soru kanıtları [Issue #11 raporunda](docs/ISSUE_11_GERCEK_KAYNAK_RAPORU.md).
