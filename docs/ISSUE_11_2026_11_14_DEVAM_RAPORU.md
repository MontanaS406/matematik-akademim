# Issue #11 / PR #12 — 14 Kasım 2026 ilerleme kaydı

Dal: `codex/issue-11-gercek-pdfler`. PR #12 güncellenir; **main'e merge,
canlı yayın ve üretim Supabase değişikliği yapılmaz**. Önceki 1.408 soru ile
PR #12'nin tamamlanmış 149 ek sorusu tam kayıt hash'leriyle korunur.

## Kaynak çıkarımı ve doğrulama aynı sayı değildir

Erişilen 13 ZIP'teki 95 PDF / 1.256 sayfa korunmuştur. Eksik dosyalar işlenmiş
sayılmamıştır. Soru içeren PDF'lerin 1.244 sayfası için sayfa düzeyinde çıkarım
kontrol noktası vardır; diğer 12 sayfa üç ayrı cevap anahtarı PDF'sidir.

| Özel işleme grubu | PDF | Soru bölgesi adayı | Beş seçenek etiketi tespiti | Yayıncı cevap eşlemesi |
|---|---:|---:|---:|---:|
| MEB soru kaynakları | 18 | 1.360 | 1.343 | 1.111 |
| Orijinal TYT denemeleri | 12 | 480 | 478 | 480 |
| Orijinal geometri | 25 | 1.665 | 833 | 0 |
| Diğer yayıncı soru kaynakları | 37 | 963 | 552 | 304 |
| Toplam soru kaynakları | 92 | **4.468** | **3.206** | **1.895** |

Üç cevap PDF'si bu 92 kaynak PDF'ye eklenince gerçek toplam 95'tir. Metin
çıkarımı, XML ve Türkçe OCR farklı aşamalar olarak kaydedilir. Özgün şekil,
formül ve seçenek dizilimi özel soru kırpımlarında ve kaynak PDF'de korunur.
MEB'de sütun/sayfa aşan üç soru çok parçalı kırpımla birleştirildi; dört sayfa
gerçekten not sayfasıdır. Denemelerde 12 ayrı 1–40 düzeni ve 480 yayıncı anahtarı
gerçek sayfalardan okundu. Bunlar ÖSYM sınavı değil, ticari TYT denemeleridir.

**4.468, kusursuz transkripsiyonu ve doğruluğu onaylanmış soru sayısı değildir.**
OCR'de eksik şık etiketleri, kaçırılmış/tekrarlanan soru numaraları, birleşmiş
soru bölgeleri ve soru çapası bulunamayan sayfalar inceleme gerektirir. Kaynak
görseli korunması tek başına doğru bölütleme garantisi vermez. Yayıncı anahtarı
eşlemesi de bağımsız matematik onayı sayılmaz.

82 özel orijinal ayrıntılı incelendi: önceki 36 korundu, **46 yeni** kayıt
çıkarılıp iki hesap yöntemiyle kontrol edildi. 70 uygun/doğrulanmış kayıt
(54 TYT, 16 AYT hazırlık düzeyi), 12 inceleme kaydı vardır. 82 kayıt 4.468
adayın içinde tekil kaynak SHA/sayfa/soru konumuyla eşleştirildi; ikinci kez
sayılmadı. Kalan **4.398 aday** bağımsız doğrulama gerektirir. Konu etiketlerinin
çoğu hâlâ klasör/anahtar sözcük adayıdır; yalnız ayrıntılı incelenen kayıtların
soru düzeyi sınıflandırması onaylanmıştır. Ayrı bir gerçek AYT sınav kitapçığı
bu pakette yoktur; AYT hazırlık etiketi resmî AYT sorusu iddiası taşımaz.

## Gerçek sayfa okuma örnekleri

Soru gövdeleri telif nedeniyle burada aktarılmaz. Kaynak konumu ile özel
kanıt kırpımları eşleşir; dosya SHA'ları public envanterdedir.

| Dosya | Fiziksel PDF sayfası | Basılı sayfa | Soru | Sonuç |
|---|---:|---:|---|---|
| MEB_Dort_Dortluk_PDF_275-288.pdf | 2 | 274 | 4, 5, 6 | Örneklem sapması, mod/medyan ve frekans tablosu bağımsız kontrol edildi. |
| MEB_Dort_Dortluk_PDF_275-288.pdf | 3 | 275 | 7 | İki mümkün seçenek ve çakışan sınıf sınırı: incelemede. |
| MEB_Dort_Dortluk_PDF_027-038.pdf | 2 | 26 | 5 | Eksik farklılık koşulu yüzünden yayınevi anahtarı onaylanmadı. |
| MEB_Dort_Dortluk_PDF_027-038.pdf | 3 | 27 | 9–12 | Alt kümelerin toplamı/çarpımı ve öz alt küme bağıntıları kontrol edildi. |
| MEB_Dort_Dortluk_PDF_305-330.pdf | 3 | 305 | 9 | Kombinasyon eşitliğinin iki dalı ayrı kontrol edildi. |
| MEB_Dort_Dortluk_PDF_305-330.pdf | 4 | 306 | 12, 14 | Pascal satır toplamı doğrulandı; parametre sorusunda iki kök bulunduğu için onay verilmedi. |
| Orijinal_TYT_Deneme_01_40_Soru.pdf | 3 | 3 | 1 | Önceki bağımsız çözüm korundu, gerçek ayrı anahtarla tekrar eşleştirildi. |

Dosya adındaki tam kitap aralığı, tam kitap PDF'si okunmuş gibi sunulmaz.
Fiziksel sayfa, görünen basılı sayfa ve dosya aralığından çıkarılan konum ayrı
alanlardır. Gerçek görselleri açıp okuma kanıtı özel pakettedir.

## Yeni AI partileri

Bu devam çalışmasında **221 yeni bağımsız alıştırma**: **160 TYT / 61 AYT**.
141'i önceki uygun orijinallerin eksik üretimini tamamlar; 80'i yeni okunan
sekiz uygun orijinalden onar farklı kurgu içerir. Sayma, mantık, olasılık,
hareket, ters fonksiyonlar, veri/istatistik, sonlu küme görüntüleri,
kombinasyon bağıntıları ve Pascal özellikleri kapsanır.

221'inin tümü bağımsız otomatik matematik denetiminden geçti; beş şıkkın tamlığı,
tek doğru şık, eşdeğer şık tekrarı, cevap anahtarı, açıklama ve mevcut banka ile
yakın tekrar taraması yapıldı. İki doğrulama ifadesi hatası düzeltildi; yakın
tekrar olan taslak farklı yapıyla değiştirildi; iki hareket sorusunun yön/başlangıç
belirsizliği giderildi. Son yeni partide bekleyen/elenen kayıt yoktur. Otomatik
matematik onayı **insan editör onayı değildir**; anlamsal tekrar taraması mutlak
bir özgünlük kanıtı değildir.

Veri sıralama/frekans/varyans ve sonlu küme görüntülerinde denetleyici yazarın
önceden seçtiği sonucu kullanmaz: ham listeyi sıralar, frekansları sayar,
merkezli momentleri yeniden hesaplar ve görüntü kümesindeki tekrarları kaldırır.
Diğer sorularda kesin rasyonel/cebirsel hesap, sonlu durum taraması ve kısıt
çözümü kullanılır. İncelenen doğal dil çıkarımları ayrı yazım kontrolüdür;
yalnız aritmetik ifadesini çalıştırmak bütün metin anlamının ispatı değildir.

Dalın toplamı **1.778 kullanılabilir benzersiz AI sorusu**:
216 arşiv içe aktarımı + 1.192 AI→AI + 370 Orijinal→AI. Toplam TYT 976, AYT 802.
Önceki 1.557 tam kayıt değişmedi; eski üç veri modülü byte düzeyinde aynı.
Eski 47 inceleme ve 1.017 tekrar karantinası korunur; bunlar yeni 221'in hatası
veya bu oturumda elenen yeni sorular değildir.

70 uygun orijinalden **37'sinde on kullanılabilir çocuk hedefi tamamlandı**.
Diğer **33 ebeveyn için toplam en az 330 yeni soru** henüz yazılmalıdır.
Bu eksik çalışma `data/source-generation-progress.json` içinde soru kimliği
bazında açıktır. 4.398 adayın kontrolü tamamlandıkça uygun ebeveyn sayısı ve
üretim hedefi artacaktır; tüm PDF sorularının tamamen işlendiği iddia edilmez.

## Devam etme ve özel içerik sınırı

- `data/source-extraction-progress.json`: dosya bazında sayfa/aday/doğrulama
  sayıları ve girdi hash'leri; özgün metin/şık/cevap/görsel içermez.
- `data/source-read-evidence.json`: 70 uygun ve 12 inceleme kaydının yalnız
  konum/hash/durum kanıtı.
- `data/source-generation-progress.json`: ebeveyn ve üretilen kimlikler,
  kullanılabilir çocuk sayısı, kalan hedef.
- `data/ai/batch-manifest.json`: üretim ve doğrulama girdilerinin SHA bağları;
  başarılı partiler aynı hash'lerle yeniden kullanılır.
- `data/ai/preserved-pr12-1557.json`: önceki tamamlanmış içerik kaybını ve
  onayının yanlışlıkla kaldırılmasını engelleyen ek koruma.

Özgün PDF'ler, 4.468 soru kırpımı, OCR/XML, özel transkripsiyonlar ve özel
çözümler GitHub'a eklenmez. Çalışma alanındaki
`pdf-access-check-20261113/assembled/original-questions.json` özel birleşik
çıktıdır; aynı dizinin `bulk/`, `private-ingestion/`, `verified-expansion/` ve
`extracted/` klasörleri devam etmek için saklanır. Özel yedek arşivi bunları
taşır; herkese açık depoya veya siteye yüklenmez.

`npm run audit:ai-bank` telifli PDF'lere ihtiyaç duymadan public AI verilerini
baştan üretip yeniden denetler. `npm test` ve `npm run test:e2e` uygulama
regresyonlarını denetler. PDF çıkarımı için ayrı bağımlılık dosyası
`scripts/requirements-source-pdf.txt` ve sistemde Tesseract tur+eng gerekir.
Çıkarıcılar `--help` ile özel girdi/çıktı yolu alır; `--force`/`--restart`
verilmedikçe aynı kaynak hash'i ve sürüm için mevcut kontrol noktaları kullanılır.
OCR modeli/dili, görüntü ölçeği veya çıkarım ayarları değiştirilirse yeni özel
çıktı klasörü veya açık `--force`/`--restart` kullanılmalıdır. Geometri `--force`
seçeneği hem kaynak sayfa render'ını hem OCR'yi yeniler.

## Test sonucu

- Başlangıçtaki 113 birim testi geçti. Eklenen koruma/çıkarım testleriyle
  son durumda **117/117 birim testi** geçti.
- Mevcut **74/74 masaüstü ve telefon E2E** testi ile yeni TYT/AYT partilerine
  özel **4/4 E2E** testi geçti: toplam 78 senaryo.
- `npm run audit:ai-bank` çıktıların tekrar üretildiğinde değişmediğini
  doğruladı. Eski 1.408 ve PR #12'nin 1.557 kayıtlık koruma testleri geçti.
- 4.468 özel kırpımın SHA'sı ve 95 özgün PDF baytı yeniden kontrol edildi.
  MEB'in 18 soru belgesi ile 12 deneme tamamlanan kontrol noktalarından
  yeniden kullanıldı; belgeler ikinci kez yeni soru sayılmadı.
- Gerçek üretim Supabase hesabında/ücretli AI servisinde işlem yapılmadı.
  Hesap ayrımı ve geçmiş koruma testleri yerel/taklit servislerle çalıştı.

## Eksik dosyalar

Tam adı bilinen eksik beş PDF yalnız dosya adlarıyla
`docs/MISSING_SOURCE_FILES.txt` içindedir. İşlenmiş 95 PDF tekrar istenmez.
Parça metadata'sına göre 1–8, 12 ve 23 numaralı ZIP parçaları henüz erişilmedi;
mevcut metadata bunların tam dosya adlarını içermediğinden ad uydurulmaz.
Ana 401 MiB arşivi yeniden istemek yerine bu parça eksiği açık tutulur.
