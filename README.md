# Matematik Akademim

Türkçe konu anlatımları, altı öğretmen, kullanıcı hesabı ve gece mavisi dört menü:
**Soru Çöz**, **Konular**, **Öğretmen**, **İlerleme**.

## Soru havuzları

- **AI alıştırmaları:** Önceki arşiv, AI → AI ve gerçekten okunan özgün kaynaktan
  bağımsız hazırlanan Orijinal → AI kayıtları ayrı köken alanları taşır. Önceden
  kullanılabilir olan **1.408 kayıt aynen korunur**; önceki sürümlerde eklenen
  **590 uygun soru** ile toplam **1.998** kullanılabilir alıştırma vardır. Konu,
  sınav, alt konu, seviye ve içe aktarılan/yeni havuz filtreleri bulunur. Beş
  seçenekten biri işaretlenip kontrol edildiğinde açıklamalı çözüm açılır.
- **Orijinal sorular / kişisel arşiv:** Gönderilen **220 kaynak / 3.022 sayfanın
  tamamı** uygulama içinden görüntülenir. **12.716 soru/bölge kaydı**, özgün
  şekil ve seçenek görüntüleriyle açılır; 9 kesin tekrar ayrıca kayıtlıdır.
  Kırpım belirsizse asıl sayfa ve kaynağın bütün sayfaları içeride açılabilir.
  **12 özgün TYT denemesi 40'ar soru ve yayınevi cevap anahtarıyla** çözülür.
  İçerik kişisel erişim bağlantısıyla açılır; uygulama yeniden dosya istemez.
  Özgün içerikler depoda açık metin/görüntü olarak tutulmaz; anahtar yalnız
  kişisel teslim dosyasındadır. Matematik kontrolü geçen orijinal sayısı **92**;
  diğer **12.624 kayıt** inceleme durumunda tutulur. Kayıt sayısı, bütün
  soruların transkripsiyonunun ve matematiğinin onaylandığı anlamına gelmez.
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
ayrı dal ve PR üzerinden yürütülür. PR #12'deki soru entegrasyonu ve önceki
deneme geliştirmeleri korunur. Yayın öncesinde otomatik kontroller doğrulanır.

## Kişisel orijinal arşiv

Kişisel erişim bağlantısı **Soru Çöz → Orijinal sorular** havuzunu açar.
Altında **Sorular**, **Denemeler** ve **Kaynaklar** bulunur. Kaynak, sınav ve
konu filtreleri, arama, görüntüyü büyütme ve özgün sayfaya geçiş vardır.
Kontrol edilmemiş konu etiketleri ve cevaplar onaylı gösterilmez.

Özgün denemeler yayınevinin değişmemiş 1–40 sırası ve aynı kaynakta okunan
anahtarlarıyla çalışır. Kronometre, duraklatma/devam, ara kayıt, tamamlanma
tiki, tekrar çözme ve İlerleme geçmişi bulunur. Puan yayınevi anahtarına göre
alıştırma sonucudur; ÖSYM sonucu veya bütün sorular için bağımsız matematik
onayı değildir. Anahtarsız tekli kayıtta doğrulanmış doğru/yanlış üretilmez.

Sayfa görüntüleri AES-256-GCM ile korunur ve gerektiğinde indirilir. Kişisel
anahtar adresin sunucuya gönderilmeyen bölümünden alınır, adres hemen
temizlenir; anahtar yalnız bu sekmenin hesap kapsamındaki oturum alanında
saklanır. Kilitleme/hesap değişimi görüntüleri ve anahtarı temizler.
Özgün deneme/yanıt geçmişi ayrı yerel anahtarlardadır; eski AI öğrenme,
deneme veya cihaz belgesi depoları ve üretim Supabase verileri değiştirilmez.

Ayrıntılar: [Kişisel arşiv raporu](docs/KISISEL_ORIJINAL_ARSIV_RAPORU.md).

## Konu dağılımına göre denemeler

**Soru Çöz → Denemeler** ekranında 2025 konu tablosuna göre numaralı AI
alıştırma denemeleri seçilir: **140 TYT (36/40 soruluk kısmi çalışma)** ve
**81 AYT (24/40 soruluk kısmi çalışma)**. TYT hedefi 30 matematik + 10 geometri;
mevcut havuzdan 4 üçgen, 1 çokgen ve 1 kare sorusu eklenir. Eksik 2 katı cisim,
1 yamuk ve 1 dikdörtgen sorusu başka konularla doldurulmaz. AYT'deki
7 matematik ve 9 geometri eksiği de ayrıca gösterilir. Bunlar resmî ÖSYM sınavı değildir.

Tamamlanan denemede ✓ görünür. **Bir daha çöz** yeni cevap kâğıdı açar,
eski sonucu korur. Optik işaretleme, kronometre, duraklatma/devam, ara kayıt,
çözümler ve İlerleme bölümünde sonuç geçmişi bulunur. Yeni kayıtlar bu
tarayıcıda misafir ve hesap alanlarında ayrı tutulur; cihazlar arasında eşitlenmez.

1.958 farklı soru dağılıma göre kullanılır; az bulunan konular farklı
denemelerde tekrar edebilir. Kalan 40 soru tekli çözümde korunur. Yeni soru
üretilmez. Eski 30 soruluk TYT kayıtları ve sonuçları **Önceki denemelerim**
altında aynı sorularla açılır; yeni denemelere dönüştürülmez.
Ayrıntılar ve sınırlar: [Deneme raporu](docs/DENEMELER_RAPORU.md).

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
