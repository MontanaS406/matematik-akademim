# Issue #11 — gerçek PDF kaynakları ve köken ayrımı

**Güncel kapsam ve kalan iş:** [14 Kasım devam raporu](ISSUE_11_2026_11_14_DEVAM_RAPORU.md).
Aşağıdaki sayılar 13 Kasım'da tamamlanan ilk partinin tarihsel kaydıdır.

13 Kasım 2026. Bu geliştirme ayrı dalda PR olarak hazırlanmıştır; mevcut canlı
site, üretim Supabase verileri ve main dalı değiştirilmez.

## Gerçekten erişilen içerik

Kullanıcının gönderdiği **13 ZIP** açıldı; alt klasörlerde **95 PDF, 1.256 sayfa,
8 kaynak grubu** bulundu. Bütün PDF baytları ZIP üyeleriyle karşılaştırıldı;
SHA-256, dosya büyüklüğü ve sayfa sayısı kaydedildi. 1.078 sayfada metin katmanı
vardı; 178 sayfada metin seyrek veya yoktu (kapak/boş/görüntü sayfaları dahil).
Görsel sayfalar da örneklenerek açıldı; geometri çizimleri görüldü. Bu, bütün
sayfalardaki bütün soruların tek tek çözüldüğü anlamına gelmez.

Dosya klasör etiketleri: **63 TYT / 17 ORTAK / 12 TYT denemesi / 3 cevap
anahtarı**. Klasör etiketi tek başına soru düzeyi sınıflandırması sayılmadı.
AYT hazırlık soruları ORTAK MEB bölümünden ayrıldı; sağlanan dosyalarda ayrı
bir AYT sınav kitapçığı yoktur. Resmî ÖSYM soru eklendiği söylenmez.

## Somut okuma ve cevap kanıtları

| Gerçek dosya | Dosyadaki sayfa | Görülen basılı sayfa | Soru | Kontrol |
|---|---:|---:|---:|---|
| `MEB_Dort_Dortluk_PDF_275-288.pdf` | 1 | 273 | 1 | İstatistik; aynı sayfadaki C cevabı bağımsız hesapla eşleşti. |
| `MEB_Dort_Dortluk_PDF_365-390.pdf` | 3 | 365 | 12 | Ters fonksiyon; E seçeneği bağımsız cebirle eşleşti. AYT hazırlık düzeyi, resmî AYT sorusu değildir. |
| `Orijinal_TYT_Deneme_01_40_Soru.pdf` | 3 | 3 | 1 | Bağımsız uzaklık hesabı B ile eşleşti; ayrı `Orijinal_TYT_12_Deneme_PDF_193-193.pdf` dosyasının 1. sayfasındaki Deneme 1 / Soru 1 anahtarı okundu. |

Geometri erişim örneği: `Orijinal_TYT_AYT_Geometri_PDF_081-096.pdf`, dosyada
sayfa 1 / basılı 81 / soru 4'ün şekli ve boyalı bölgesi görüntüden okundu.
Bu erişim örneği, soru çözülmüş/özel bankaya tam aktarılmış sayısına eklenmedi.

Her seçili soruda fiziksel PDF sayfası, basılı sayfa, soru numarası, belge SHA-256,
özel transkripsiyon özeti, metin katmanı özeti ve sayfa piksel özeti var. Dosya
adındaki aralıktan hesaplanan tam kitap PDF sayfası ayrıca işaretlidir; tam
kitap dosyasıyla doğrulanmış gibi sunulmaz. Örneklerin özgün metin ve sayfa
görselleri özel inceleme paketindedir; bu raporda çoğaltılmaz.

## Özgün banka ve mevcut AI kayıtları

| Köken | Tam kayıt | Uygun/doğrulanmış | Herkese açık çözüm havuzu |
|---|---:|---:|---:|
| Gerçek özgün kaynak sorusu | 36 özel | 29 | 0 |
| Önceki AI arşivi | 1.165 | 216 kullanılabilir | 216 |
| Önceki AI → AI türetmesi | 1.306 | 1.192 kullanılabilir | 1.192 |
| Yeni Orijinal → AI türetmesi | 150 | 149 kullanılabilir | 149 |

Eski **1.408 kullanılabilir AI sorusu** kimlik, soru, şık, cevap, çözüm ve tüm
ham kayıt özetleriyle aynen korunur. Yeni uygun sorularla bu dalın AI havuzu
**1.557** olur: **816 TYT / 741 AYT**. Yeni üretim **80 TYT + 70 AYT** taslaktır;
150'si de bağımsız matematik kontrolünden geçti. Bir AYT rol değiştirme/yakın
tekrar adayı karantinaya alındı; yeni kullanılabilir dağılım **80 TYT / 69 AYT**.

Yeni 150 taslak gerçekten okunan **15 özgün soru** ebeveynine bağlıdır.
29 uygun okuma kanıtının tamamı işlem günlüğündedir; bu partide türetilmeyen
ebeveynler açıkça işaretlidir. Mevcut AI kayıtlarına sonradan özgün PDF kökeni
yakıştırılmadı. Üç köken arayüzde de ayrı filtrelenir.

Özel bankada **7 soru incelemededir**: kavramsal belirsizlik, kaynak tanımındaki
kusur, olasılık koşullarının çelişmesi, fonksiyon tanım/değer kümesi uyuşmazlığı
ve grafikte ters/ön görüntü belirsizliği. Kaynağın cevap anahtarı bulunduğu
için otomatik onay verilmedi. Bu sorular yeni türetmelerde ebeveyn yapılmadı.
İnsan editör onayı hiçbir kayıt için iddia edilmez.

## Telif ve gizlilik

Hak sahibinden doğrulanmış yeniden yayım izni kurulmadı. Bu nedenle özgün PDF,
sayfa görseli, soru metni, şıklar ve özgün çözümler GitHub/Pages'a eklenmedi.
Herkese açık dosyalarda yalnız ad, kaynak/sayfa bilgisi, hash, durum ve bağımsız
yeni AI içerikleri bulunur. PDF'nin teknik kopyalama izni telif lisansı sayılmaz.

`Orijinal` ekranının 0 göstermesi içerik yokmuş gibi gizlenmez: gerçek okuma,
özel doğrulama ve yayım izni ayrımı açıkça gösterilir. Kaynak sayısı çözülür soru
sayısına eklenmez. Dosya yükleme arayüzü eklenmedi.

Özel çalışma çıktısı, yerel `private-review.html`, özgün soru JSON'u ve değişmeden
görülen 13 kaynak sayfası görseliyle kullanıcıya ayrı inceleme paketi olarak
teslim edilir. Kod deposuna bu paket eklenmez. Kaynakların bütün soruları için
tam çıkarım/cevap doğrulaması tamamlanmış değildir; kalan sayfalar özel hazırlık
alanında inceleme bekler. Otomatik numara adayları doğrulanmış soru sayılmaz.

## Test ve izlenebilirlik

- Başlangıçtaki 103 mevcut birim testi geçti.
- Güncel 113 birim testi; önceki 1.408 kaydın tam içerik korunumu, köken kanıtı,
  telif kapısı, kaynak envanteri ve üyelik/ilerleme kontrollerini içerir.
- Geçen **74 telefon/masaüstü tarayıcı testi** kaynak durumunu, Orijinal → AI filtresini,
  TYT/AYT, cevap kontrolü/çözüm, hesap izolasyonu ve dört menüyü sınar.
- Tüm üretim/denetim temiz biçimde yeniden çalıştırılıp statik çıktılarla
  karşılaştırılır. Eski denetim raporu değiştirilmiş içerikle kullanılamaz.
- Gerçek dosya işleme yerelde yapıldı. CI telifli PDF istemez; metadata
  tutarlılığını ve yeni AI matematiğini yeniden denetler. Üretim hesaplarına
  veya ücretli AI servisine gerçek bağlantı testi yapılmış gibi raporlanmaz.

## Kalan işler ve eksik dosyalar

Arşiv metadata'sına göre **1–8, 12 ve 23** numaralı parçalar sağlanmadı; içerikleri
varsayılmadı. Issue'daki şu beş ek dosya da tam adlarıyla mevcut değil:

- `UcgenAkademi_TYT_Matematik_416sayfa.pdf`
- `UcDortBes_TYT_Matematik_416sayfa.pdf`
- `ULTI_TYT_Matematik_54sayfa.pdf`
- `Tudem_TYT_Matematik_Ornek_16sayfa.pdf`
- `Ozdebir_GIS_TYT_Ornek_12sayfa.pdf`

Aynı yayınevinden başka bir kesit bulunması bu dosyaların okunduğu anlamına
gelmez. Kitaplık klasörüne doğrudan erişim varsayılmadı. Ayrı AYT sınav dosyaları,
bütün soru bankasının tek soru düzeyinde tamamlanması, kalan koşul/cevap
incelemeleri, insan editör kontrolü ve yeniden yayım izinleri açık kalan işlerdir.
Bu nedenle PR, Issue #11'in ilerlemesini ve kısıtlarını belgeler; otomatik olarak
tamamlandı iddiasıyla issue kapatılmaz.
