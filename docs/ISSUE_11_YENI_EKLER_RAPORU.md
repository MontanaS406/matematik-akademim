# Issue #11 / PR #12 — yeni 25 ekin işlenmesi

Bu parti `codex/issue-11-gercek-pdfler` dalındadır. Main, canlı site ve üretim
Supabase değiştirilmedi. Önceki 1.408, 1.557 ve 1.778 kullanılabilir kayıt
ayrı koruma manifestleriyle denetlenir; tamamlanmış 221 soruluk modül de
byte düzeyinde korunur.

## Dosya erişimi tamamlandı

Yeni 25 ek (22 ZIP ve 3 doğrudan PDF) açıldı. 125 yeni benzersiz PDF'nin
1.766 sayfası gerçekten okundu ve render edildi; erişilemeyen, şifreli veya
bozuk PDF yok. Önceki 95 PDF ile birlikte **220 PDF / 3.022 fiziksel sayfa**
vardır. Metin katmanı bulunan sayfa da gömülü raster resim içerebildiğinden
text/sparse/image ölçüleri toplanarak fiziksel sayfa sayısı hesaplanmaz.

Eski katalog artık 185/185 PDF kesiti ve 2.108/2.108 sayfa olarak tamamdır.
Yeni `09_TYT.zip` içeride 12. parça, `10_KATALOG.zip` ise 23. parçadır;
ZIP adındaki sayı kitap sırası veya eski parça kimliği sayılmadı.
Aynı `09_TYT` etiketini taşıyan iki farklı ZIP, ayrı SHA/containerId ile korunur.

| Önceki eksik kaynak kimliği | Gerçekten erişilen kapsam |
|---|---|
| Üçgen Akademi TYT Matematik | 25 PDF parçası, 416/416 sayfa |
| ÜçDörtBeş TYT Matematik | 7 PDF parçası, 416/416 sayfa |
| ULTI TYT Matematik kaynağı | sağlanan 54 sayfa |
| Tudem TYT Matematik örneği | 16 sayfa |
| Özdebir TYT Matematik örneği | 12 sayfa |

İki parçalanmış 416 sayfalık dosyada sayfa boşluğu/örtüşmesi yok. Kimlik;
dosya parçaları, gerçek kapak/künye, sayfa sayısı ve sayfa konumlarıyla
karşılaştırıldı. ÜçDörtBeş künyesinde ISBN 978-605-81368-0-9 görüldü.
Bağımsız kanonik tam-dosya SHA'sı verilmediği için yayıncıdaki tek dosyayla
bayt özdeşliği iddia edilmez. **Yeniden istenecek eksik dosya yoktur.**
`docs/MISSING_SOURCE_FILES.txt` bu nedenle boştur. Eski 95 dosyalık envanter
ve eski eksik listeleri tarihsel snapshot olarak korunur; güncel kayıt
`data/source-pdf-inventory-all.json` ve `data/source-supply-status.json` içindedir.

## Gerçek çıkarım ve kontrol sayıları

| Aşama | Kayıt |
|---|---:|
| Önceki özel bölge adayları | 4.468 |
| Yeni 90 katalog PDF'sinden otomatik bölge adayları | 3.585 |
| Yeni 35 v2 PDF'sinden otomatik bölge adayları | 4.648 |
| Görsel incelemeyle kurtarılan ek bölgeler | 24 |
| Toplam özel bölge kaydı | **12,725** |
| Kesinleşmiş baskılar arası aynı sorular | **9** |
| Bu kesin tekrarlar çıkarıldıktan sonra kalan bölge adayları | **12,716** |
| Beş seçenek etiketinin metin/OCR ile görüldüğü adaylar | 8,954 |
| Yayıncı cevabı kaydı (matematik onayı değildir) | 3,058 |
| Ayrıntılı kürate edilen orijinaller | **104** |
| Bağımsız matematik kontrolü uygun orijinaller | **92** |
| Kürate bankada inceleme bekleyen | **12** |

Virgüllü sayılar tabloda binlik ayırıcıdır. Bölge/etiket tespiti; doğru
bölütleme, tam matematiksel transkripsiyon veya insan editör onayı değildir.
Kayıtlardaki belirsiz soru numaraları null kalır. Çok soruya ait ortak
koşullar ayrı kaynak kırpımıyla korunur; ilişkilendirme ayrıca incelenmelidir.
Özgün PDF yetkili kaynaktır; OCR veya yeniden yazılmış seçenek onun yerine geçmez.

Yeni 90 PDF / 852 sayfada 333 sayfaya birer tam-sayfa OCR uygulandı; hata yok.
932 kaynak numarası hâlâ belirsizdir. Çıpasız 63 sayfa ile şıksız örneklerin
bulunduğu 29 sayfa ayrıca gerçek görsellerden incelendi. Yedi sayfada 20 adet
A–E seçenekli yayınevi örneği bulundu; bunlar `publisher_worked_multiple_choice_example`
olarak özel kırpımlarla kurtarıldı. Şıksız örnekler için şık üretilmedi.
29 sayfanın açık uçlu örneklerinin tek tek ayrı çıkarımı hâlâ bekliyor.

V2'de 35 PDF / 914 sayfa kaydedildi. Yanlış iki alt madde ana soru sayılmaktan
çıkarıldı; mavi/siyah numaralı 345 sayfaları ve farklı kenar tasarımlı ULTI
sayfaları mevcut OCR'den yeniden bölütlendi. Üçgen'in 124 ve 205 numaralı
iki raster parçası gerçekten açıldı; 205'te numaraları otomatik okunmayan
5–8 soruları, özgün şekil ve beş seçenekle görsel konum kaydından kurtarıldı.
Bunlara matematik onayı verilmedi. Kapak/not/içindekiler/çözüm sayfaları soru
sayısını artırmak için kullanılmaz.

Özdebir'in eski iki sayfalık örneği ile yeni 12 sayfalık baskıda **9 aynı
soru** farklı numaralarla bulundu. Tam sayfa hash'leri bu yeniden dizimi
bulamıyordu; iki gerçek görüntü karşılaştırıldı ve kanonik eski kimliklere
bağlandı. Dokuz yeni kayıt tekrar olarak işaretlenir, ikinci kez benzersiz
soru sayılmaz. Eski cevap anahtarı yeni numaralara otomatik taşınmaz.
Ayrıca 17 aynı raster sayfanın Paraf logo/ara sayfası olduğu görüldü;
bunlar soru tekrarı diye etiketlenmedi.

## Okunan orijinal soru kanıtları

Yeni 20 AYT orijinali beş gerçek OFB konu testi PDF'sinin ilk fiziksel
sayfalarından, bütün beş seçenek ve özgün kırpımlarla çıkarıldı:

| Dosya aralığı | Fiziksel sayfa | Görülen basılı sayfa | Soru |
|---|---:|---:|---|
| OFB Özel Fen Bilimleri 269–280 | 1 | 269 | 1–4, limit |
| OFB Özel Fen Bilimleri 281–304 | 1 | 281 | 1–4, türev |
| OFB Özel Fen Bilimleri 305–325 | 1 | 305 | 1–4, integral |
| OFB Özel Fen Bilimleri 261–268 | 1 | 261 | 1–4, diziler |
| OFB Özel Fen Bilimleri 249–254 | 1 | 249 | 1–4, logaritma |

20/20 bağımsız iki yöntemle çözüldü; ayrı OFB 326–330 cevap PDF'sinin gerçek
4–5. fiziksel sayfalarındaki doğru konu/test anahtarıyla eşleştirildi.
Logaritma 249/soru4'te OCR'nin yanlış yorumladığı eşittir işareti büyütülmüş
özgün kırpımdan tekrar okunup düzeltildi; son kayıt uygundur.
İki yeni geometri orijinali de Orijinal 081–096 PDF fiziksel1/basılı81/soru1
ve fiziksel2/basılı82/soru7 konumlarından alan/Heron/koordinat yöntemleriyle
kontrol edildi ve basılı82 alt şeridindeki D/D cevaplarıyla eşleşti.
Bunlar yayınevi hazırlık sorularıdır; ÖSYM çıkmış sorusu diye sunulmaz.

## Yeni AI alıştırmaları ve uygulama

Bu partide **220 yeni soru: 200 AYT ve 20 TYT**. Yeni 20 uygun AYT kaynağının
her birinden 10; iki uygun geometri kaynağının her birinden 10 farklı yapı
hazırlandı. Beş AYT alanında (limit/türev/integral/dizi/logaritma) ve TYT
geometride koşul, temsil ve çözüm yöntemi çeşitleri kullanıldı. Kaynakların
özgün metin veya görselleri kopyalanmadı. Yeni sorular tek başına anlaşılır;
AI öğretmen çalışma anında yeni soru üretmez.

220/220 bağımsız otomatik denetimden geçti. Toplam kullanılabilir banka
**1,998**: önceki 1.778 + 220. Eski 1.408 ve PR'da daha önce
tamamlanan 370 ek soru kaybolmadı. Köken sayıları 216 arşiv + 1.192 AI→AI +
590 Orijinal→AI'dır. Eski 47 inceleme ve 1.017 tekrar karantinası korunur;
yeni 220 partide bekleyen/karantinaya düşen kayıt yoktur. Taslak düzeyinde
benzer bulunan sorular farklı yapılarla değiştirildi. Anlamsal tekrar taraması
ve otomatik matematik kontrolü insan editör onayı veya mutlak özgünlük ispatı değildir.

Denetleyici ham türev/integral ve polinom operatöründen parametre koşullarını
kendisi çıkarır; kapalı aralıkta tekil integralleri onaylamaz. Gerçek bir
SymPy parçalı limit hatası görüldüğünden sol/sağ dallar ayrı hesaplanır;
fonksiyonun noktadaki değeri limit yerine kullanılmaz. Ham çift logaritma
sistemlerinde alan varsayımını zorlayan `force=True` açılım kullanılmaz.

92 uygun kaynak ebeveynin 59'unda on kullanılabilir çocuk tamamdır.
Daha önceki 33 uygun kaynak için **330 yeni alıştırma** hedefi hâlâ bekler.
Diğer binlerce adayın matematik/transkripsiyon/konu incelemesi tamamlanınca
uygun ebeveyn ve üretim hedefi artacaktır; hepsi tamamlanmış sayılmaz.

Dört gece mavisi menü, altı öğretmen, hesaplar ve ilerleme korundu. Yeni veri
TYT/AYT, konu/alt konu ve zorluk filtresiyle çalışır; cevap ve açıklama akışı
eski kayıtlarla birlikte test edilir. Dosya yükleme arayüzü eklenmedi.

## Test, gizlilik ve devam

123/123 birim testi, 90/90 masaüstü/telefon E2E senaryosu ve bağımsız
üretim/denetim hattı kontrolü yerelde geçti; son GitHub CI sonucu PR'da
bağlantısıyla kaydedilir. Yeni altı tarayıcı akışı beş AYT konusunu ve TYT
geometriyi hem telefon hem masaüstünde çözüp ilerlemeyi yeniden yükler.

Kaynak PDF, özgün metin/şık/çözüm/şekil ve OCR dosyaları GitHub'a eklenmez.
ÜçDörtBeş künyesindeki elektronik yayım yasağı ayrıca görülmüştür; hiçbir
kaynak için herkese açık yeniden yayım izni doğrulanmadı. Public orijinal
havuz **0** kalır. Private alan öğrenci/üretim Supabase'ine yüklenmez.

Devam kayıtları: `data/source-extraction-progress.json`,
`data/source-generation-progress.json`, `data/source-supply-status.json`,
`data/ai/batch-manifest.json`. Özel birleşik banka çalışma alanındaki
`pdf-access-check-20261114-new/assembled/original-questions.json` dosyasıdır.
Önceki özel kaynaklar ve bu yeni delta birlikte korunur. OCR önbellekleri
PDF/sayfa/render/dil/model SHA ve dosya bütünlüğüyle ilişkilidir; okunamayan
veya ayarı değişmiş kontrol noktası sessizce eski onayı devralmaz.

Değişiklik grupları: yeni ZIP/PDF envanter ve birleşim araçları; özel katalog/v2
çıkarıcıları; görsel bölge kurtarma; üç yeni AI üreticisi; ham model matematik
denetimi; ek kaynak metadatası ve kayıt koruma manifestleri; filtre/çözüm E2E
testleri. Uygulama değişikliği veri entegrasyonu ve önbellek kimliğiyle sınırlıdır.
