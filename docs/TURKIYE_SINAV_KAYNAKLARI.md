# Türkiye sınav kaynakları — PR #5 devam araştırması

Denetim tarihi: **7 Kasım 2026**. Bu belge, [önceki 42 belgeli araştırmayı](SORU_KAYNAK_ARASTIRMASI.md) tamamlar. Önceki lisans denetimi ve İngilizce 12 alıştırma yeniden yapılmadı. Bu turun hedefi, Türkiye sınavlarının **kullanıcının kendi cihazında tuttuğu yasal kitapçıklarıyla** çalışılabilecek doğrulanmış anahtarlarını ve yeniden yayım izni yollarını araştırmaktır.

## Somut sonuç ve sayım

- Bu turda **68 tekil birincil belge fiilen okundu: 44 HTML, 24 PDF**. Bunların **55'i önceki rapora göre yeni**, 13'ü doğrudan kitapçık bağlantısını veya sonraki düzeltmeyi denetlemek için tekrar açılmıştır. İlk 66 belgeli araştırmaya ek olarak 2022 ve 2023 AYT PDF'leri son kontrolde açıldı. Arama parçacıkları, aynı URL'ye yapılan find/tekrar open işlemleri ve açılamayan dosyalar sayılmadı.
- **16 kitapçığın 40 harflik matematik anahtarı okundu:** 2018 TYT/AYT, 2020 TYT/AYT, 2021 TYT/AYT, 2022 TYT/AYT, 2023 TYT/AYT, 2024 TYT/AYT, 2025 TYT/AYT, 2026 TYT/AYT. Bunların **15'i iptalsiz tam anahtardır**; doğru temel kitapçık kullanıcı tarafından ayrıca teyit edilirse çalışma neti için kullanılabilir. **2026 AYT, matematik 23 iptali nedeniyle otomatik nete kapalıdır.**
- Ek olarak **2019 TYT’nin 39 cevap harfi ve 7. sorunun İPTAL durumu** birlikte doğrulandı. İptal konumuna harf uydurulmadı (`null`); bu kitapçık da otomatik nete kapalı tutulur. Böylece 17 kitapçığın matematik anahtar/soru konumları okunmuş, bunlardan ikisi iptal nedeniyle puanlamaya kapatılmıştır.
- **Kamuya açık soru bankasına eklenmesine izin bulunan yeni Türkçe soru: 0.** ÖSYM, MEB ve incelenen yayınevlerinden soru metni/şekli yeniden dağıtım lisansı bulunamadı. Anahtar doğrulaması, soru çoğaltma hakkı değildir.
- Kitapçık kimliği, soru numaraları, matematik sayfaları ve anahtarın tamamı denetlendi. **PDF dosyalarının ham baytları elde edilmedi; SHA-256 özeti doğrulanmış değildir.** Bir yerel dosyanın adının kaynak adına benzemesi, dosyanın resmî PDF olduğunu kanıtlamaz.
- Bu rapordaki araştırma kabulü, uygulamadaki entegrasyon/test sonucu veya eklenen soru sayısı yerine geçmez. Gerçek eklenen kayıtlar ve test durumu ana geliştirme raporunda belirtilmelidir.

## Doğrulanan kitapçıklar

Sayfalar bağlantı verilen **tam PDF'nin 1 tabanlı fiziksel sayfalarıdır**; sayfanın üzerinde basılı soru kitapçığı numarası değildir. Matematik kapsamı her kitapçıkta özgün 1–40'tır. TYT'nin diğer testleri ve AYT'nin diğer alanları bu anahtarlara dahil değildir.

| Sınav | Birincil kitapçık | PDF sayfa sayısı | Matematik PDF sayfaları | Matematik anahtar sayfası | Özgün soru no. | Çalışma neti kapsamı |
|---|---|---:|---:|---:|---|---|
| 2018 TYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2018/YKS/TYT_01072018.pdf) | 42 | 22–33 | 42 | 1–40 | 40 puanlanır |
| 2018 AYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2018/YKS/AYT_01072018.pdf) | 50 | 25–36 | 50 | 1–40 | 40 puanlanır |
| 2020 TYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2020/YKS/TSK/tyt_yks_2020.pdf) | 44 | 24–35 | 44 | 1–40 | 40 puanlanır |
| 2020 AYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2020/YKS/TSK/ayt_yks_2020.pdf) | 48 | 25–35 | 48 | 1–40 | 40 puanlanır |
| 2021 TYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2021/YKS/TSK/tyt_yks_2021.pdf) | 45 | 26–37 | 45 | 1–40 | 40 puanlanır |
| 2021 AYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2021/YKS/TSK/ayt_yks_2021.pdf) | 49 | 26–36 | 49 | 1–40 | 40 puanlanır |
| 2022 TYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2022/YKS/TSK/yks_2022_tyt.pdf) | 45 | 25–37 | 45 | 1–40 | 40 puanlanır |
| 2022 AYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2022/YKS/TSK/yks_2022_ayt.pdf) | 50 | 26–37 | 50 | 1–40 | 40 puanlanır |
| 2023 TYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2023/YKS/TSK/yks_tyt_2023_kitapcik_T23ky.pdf) | 42 | 23–34 | 42 | 1–40 | 40 puanlanır |
| 2023 AYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2023/YKS/TSK/yks_ayt_2023_kitapcik_g5A2H.pdf) | 50 | 25–36 | 50 | 1–40 | 40 puanlanır |
| 2024 TYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2024/YKS/TSK/yks_tyt_2024_kitapcik_T24kt.pdf) | 43 | 24–36 | 43 | 1–40 | 40 puanlanır |
| 2024 AYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2024/YKS/TSK/yks_ayt_2024_kitapcik_ts85k.pdf) | 49 | 26–36 | 49 | 1–40 | 40 puanlanır |
| 2025 TYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2025/YKS/TSK/yks_tyt_2025_kitapcik_d250.pdf) | 43 | 24–35 | 43 | 1–40 | 40 puanlanır |
| 2025 AYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2025/YKS/TSK/yks_ayt_2025_kitapcik_st12.pdf) | 50 | 26–36 | 50 | 1–40 | 40 puanlanır |
| 2026 TYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2026/YKS/TSK/yks_tyt_2026_kitapcik_d350.pdf) | 45 | 25–36 | 45 | 1–40 | 40 puanlanır |
| 2026 AYT | [ÖSYM PDF](https://dokuman.osym.gov.tr/pdfdokuman/2026/YKS/TSK/yks_ayt_2026_kitapcik_kt12.pdf) | 50 | 28–38 | 50 | 1–40 | 23 iptal; net kapalı |

Anahtarlar, her PDF'nin matematik başlığından sonra gelen 1–40 satırının tamamı okunarak aktarıldı; genel internetten bulunan harf dizileri veya eski uygulama anahtarları kanıt olarak kullanılmadı. İlk araştırma çıktısı `work/turkey-audit-candidates.json`, ek iki AYT okuması `work/missing-ayt-followup.json` içindedir. 2022/2023 AYT'nin 40 sıralı cevabı ikinci bağımsız okumayla birebir karşılaştırıldı. Üründeki kalıcı kaynak/anahtar kayıtları `data/turkish-exams.js` içindedir; soru kökleri ve seçenekler kopyalanmadı.

### Düzeltme ve iptal denetimi

- **2019 TYT 7:** [Özgün yayın duyurusu](https://www.osym.gov.tr/2019yuksekogretim-kurumlari-sinavi-2019yks-oturumlari-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi) matematik 7'nin iptalini belirtir; [güncel TYT PDF'sinin anahtarı](https://dokuman.osym.gov.tr/pdfdokuman/2019/YKS/TSK/tyt_yks_2019_web.pdf#page=43) da 7'yi İPTAL olarak basar. Diğer 39 harf sıra kaydırmadan ayrı ayrı okundu. 40 harflik bir dizi uydurulmadı; iptal alanı `null` ve net kapalıdır. [17 Temmuz 2019 sonuç duyurusu](https://www.osym.gov.tr/2019yks-yuksekogretim-kurumlari-sinavi-2019yks-sonuclari-aciklandi), ayrıca AYT Türk Dili/Edebiyatı-Sosyal Bilimler-1 soru 33'ü iptal eder; bu matematik iptali olarak kaydedilmedi.
- **2018:** [31 Temmuz 2018 sonuç duyurusu](https://www.osym.gov.tr/2018-yuksekogretim-kurumlari-sinavi-2018yks-sonuclari-aciklandi), YDT İngilizce 41 cevabını C→D yapar; bu matematik anahtarlarına uygulanmaz. Mevcut TYT/AYT matematik anahtarlarının tamamı okundu ve hedefli resmî aramalarda matematik değişikliği bulunmadı.
- **2020:** [27 Temmuz 2020 sonuç duyurusu](https://www.osym.gov.tr/2020yuksekogretim-kurumlari-sinavi-2020yks-sonuclari-aciklandi), [resmî YKS arşivi](https://www.osym.gov.tr/SinavGrubu/Menu/314) ve hedefli matematik iptal/cevap değişikliği aramaları kontrol edildi. Mevcut TYT/AYT matematik anahtarlarıyla çelişen bir değişiklik bulunmadı.
- **2021:** [28 Temmuz 2021 sonuç duyurusu](https://www.osym.gov.tr/2021yuksekogretim-kurumlari-sinavi-2021yks-sonuclari-aciklandi) ve hedefli resmî arama kontrol edildi; incelenen tam TYT/AYT matematik anahtarlarında değişiklik bulunmadı.
- **2022:** [18 Temmuz 2022 sonuç duyurusu](https://www.osym.gov.tr/2022yuksekogretim-kurumlari-sinavi-2022yks-sonuclari-aciklandi) okundu; ÖSYM alanında yıl/sınav/matematik/iptal/cevap değişikliği araştırması yapıldı. Son kontrolde AYT için duyuru tekrar okunup hedefli arama yenilendi. İncelenen mevcut TYT/AYT anahtarlarında matematiğe ilişkin sonraki değişiklik bulunmadı.
- **2023:** [20 Temmuz 2023 sonuç duyurusu](https://www.osym.gov.tr/2023-yuksekogretim-kurumlari-sinavi-2023yks-sonuclari-aciklandi) ve hedefli resmî düzeltme araması kontrol edildi; AYT ek kontrolünde duyuru tekrar okundu. İncelenen TYT/AYT için matematik değişikliği bulunmadı.
- **2024:** [16 Temmuz 2024 sonuç duyurusu](https://www.osym.gov.tr/2024-yuksekogretim-kurumlari-sinavi-2024yks-sonuclari-aciklandi) ve hedefli resmî düzeltme araması kontrol edildi; incelenen TYT/AYT matematik için değişiklik bulunmadı.
- **2025:** [19 Temmuz 2025 sonuç duyurusu](https://www.osym.gov.tr/2025yks-sinav-sonuclari-aciklandi), [aday cevaplarına erişim duyurusu](https://www.osym.gov.tr/2025yks-cevap-kgitlari-ve-aday-cevaplari-erisime-acildi) ve hedefli düzeltme araması kontrol edildi; incelenen TYT/AYT matematik için değişiklik bulunmadı.
- **2026 AYT 23:** [1 Temmuz duyurusu](https://www.osym.gov.tr/2026-yuksekogretim-kurumlari-sinavi-2026yks-degerlendirme-islemleri) C cevabını A yapmıştı. Daha sonraki [21 Temmuz resmî değerlendirme açıklaması](https://dokuman.osym.gov.tr/pdfdokuman/2026/YKS/aciklama_ydd21072026.pdf), sorunun **yargı kararıyla iptal edildiğini** bildirir. İncelenen kitapçık PDF'si hâlâ basılı C'yi gösterdiğinden, yalnız PDF'yi okumak güncel puanlama için yeterli değildir. 23 numara hiçbir harfle doğru/yanlış/boş sayılmamalıdır. 39 geçerli sorunun çalışma neti ve 1 iptal ayrı gösterilmelidir; uygulama bu dışlama kuralını desteklemiyorsa otomatik net kapalı tutulmalıdır. [2026 sonuç duyurusu](https://www.osym.gov.tr/2026yks-sinav-sonuclari-aciklandi) de kontrol edildi.

Bu denetim, 7 Kasım 2026 tarihinde erişilen mevcut resmî PDF'ler ve bulunan resmî duyurular için geçerlidir. Aramada başka değişiklik bulunmaması, hiçbir zaman yeni yargı kararı çıkmayacağının kanıtı değildir. Çalışma neti `doğru − yanlış/4` biçimindedir; **ÖSYM sınav/yerleştirme puanı veya iptal sonrası resmî ölçekli puan değildir**.

## Özel PDF kullanımında doğrulama sınırı

Öğrenci kitapçığı cihazından seçer; dosya ve özel cevap anahtarı herkese açık katalog veya sunucu deposuna aktarılmamalıdır. Kaynaklı hazır anahtar seçildiğinde sınav/yıl/temel kitapçık ve soru dizilimini öğrenci ayrıca onaylamalıdır. Adayın kişisel sınav kitapçığı, resmî **temel soru kitapçığından farklı soru/seçenek dizilimi** taşıyabilir; bu dosyaya temel anahtar otomatik uygulanamaz.

“Resmî anahtar doğrulandı” ile “seçilen dosyanın kaynağı kriptografik olarak doğrulandı” farklı durumlardır. Bu araştırmada ikincisi sağlanmadı. Dosya kimliği kullanıcı beyanıyla seçilmişse arayüz bunu açıkça söylemeli; dosya adına bakarak otomatik resmî eşleşme yapmamalıdır. Kullanıcının kendi girdiği anahtar, doğrulanmış ÖSYM anahtarı gibi işaretlenmemelidir. Eksik anahtar, belirsiz grup, 10% örnek kitapçık veya bilinmeyen iptal durumu tam sınav neti üretmemelidir.

Kullanıcının kendi edindiği dosyayı yerel açma tercihi, uygulamaya üçüncü taraf yayım izni sağlamaz. MEB'in öğrenciye yönelik indirme/çevrim dışı kullanım açıklaması aşağıdadır; bu açıklama bütün yayınevlerine ait her PDF için genel izin değildir.

## TYT/AYT 2018–2026 kapsamı ve eksikler

Önceki rapor 2018–2026'nın dokuz yayın duyurusunu zaten incelemiştir; bu tur onları tamamlanan anahtar/PDF işi için gerektiğinde tekrar açtı. **18 kitapçıktan 17'sinin matematik konumları/anahtar durumu okundu:** 16 kitapçıkta 40 harflik anahtar; 2019 TYT'de 39 harf + 7. sorunun iptali. 2019 TYT ve 2026 AYT otomatik nete kapalıdır. İptalsiz tam anahtar sayısı **15**'tir.

| Kitapçık durumu | Sınavlar | Karar |
|---|---|---|
| 15 iptalsiz tam matematik anahtarı | 2018, 2020, 2021, 2022, 2023, 2024, 2025 TYT/AYT; 2026 TYT | Anahtar kaynağı doğrulandı; yerel dosya kimliği ayrıca kullanıcı teyidi gerektirir |
| 40 basılı harf + sonraki iptal | 2026 AYT | Matematik23 iptal; net kapalı |
| 39 harf + basılı İPTAL | 2019 TYT | 43 PDF sayfası; matematik24–34; anahtar43; 7. konum `null`; net kapalı |
| Resmî PDF erişimi başarısız | 2019 AYT | Tam anahtar/sayfa bilgisi doğrulanmadı; tahminle tamamlanmadı |

2019 AYT resmî PDF'si ilk okumada ve son bir sınırlı ek denemede zaman aşımı verdi. 2022/2023 AYT önceki erişim hatalarından sonra son kontrolde açılabildi; tam matematik anahtarları ve fiziksel sayfaları okunarak eklendi. Tamamlanan 2018/2020/2021 çalışmalarında önceki yayımlama duyurusu incelemesi tekrarlanarak soru sayısı artırılmadı; yeni iş doğrudan gerçek PDF'lerin matematik anahtarlarını ve sayfa eşleştirmesini okumaktır.

## MEB ve Türkiye yayınevlerinde kullanım hakkı

MEB ve yayınevi bölümünde 15 yeni birincil belge incelendi. İzinli Türkçe sorular aranırken, ücretsiz erişimin yeniden yayım hakkına dönüşmediği görüldü. Ayrıntılı belge bulguları aşağıdaki kaynak dökümündedir.

- [MEB ÖDSGM soru kullanım hakkı duyurusu](https://odsgm.meb.gov.tr/www/merkezi-sistem-sinavlari-ile-protokollu-sinavlarin-desifre-olmus-sorularinin-kullanim-hakki-duyurusu/icerik/150) soru kullanımını süreli/sınırlı sözleşmeye bağlar. [İnternet yayım sözleşmesi örneği](https://odsgm.meb.gov.tr/meb_iys_dosyalar/2016_05/25093041_internet_sozlesmesi.pdf), soru/anahtar yayımı, biçim ve seçeneklerin korunması ve yayım türüne özel izin gibi koşullar içerir. Örnek sözleşme, projeye verilmiş imzalı izin değildir; tarihsel ücret bilgileri güncel teklif olarak alınmaz.
- [MEB OGM SSS](https://ogm.meb.gov.tr/www/sss.php?s=09sss463), TYT/AYT üç adım yardımcı materyallerini ve cihazlara indirilip çevrim dışı kullanılabilen etkileşimli kaynakları tanımlar. Bu, öğrenciye gerçek kaynak erişimini destekler; üçüncü taraf bankaya soru kopyalama/gömme lisansı değildir.
- [Rehber Matematik kullanım şartları](https://www.rehbermatematik.com/kullanim-sartlari), indirilen materyalleri kişisel çalışmayla sınırlar; dağıtım için izin ister. Erişim/abonelik koşulları atlanmadı.
- [ÖZDEBİR açıklaması](https://www.ozdebir.org.tr/icerik/ozdebir-deneme-sinavlarina-iliskin-genel-aciklama?cid=934) deneme ve çözümlerinin paylaşımını sınırlar. [3D kurumsal anahtar dizini](https://3dyayinlari.com/kurumsal-deneme-cevap-anahtarlari), TÖDER, Tudem ve Üç Dört Beş kaynaklarında açık üçüncü taraf yeniden yayım lisansı bulunmadı.
- TÖDER 2025–2026 TYT anahtarı PDF'sinde metin çıkarımı A/B gruplarının matematik sütunlarını kesin eşleştirmedi; puanlama anahtarı üretilmedi. Tudem tadımlık PDF'si tam deneme sayılmadı.

Bu turda hak sahiplerine ileti gönderilmedi veya izin sözleşmesi yapılmadı. Kamuya açık banka için sonraki somut yol, ilgili hak sahibinden soru/şekil/seçenek/anahtar ve internet kullanımı kapsamı belli yazılı izin edinmektir.

## KPSS, ALES ve DGS

Önceki raporun 2024/2026 KPSS, 2025/2026 ALES ve DGS duyuruları korunur. Yeni araştırma, duyurularda kalmayıp **2026 KPSS Ön Lisans, ALES/2 ve DGS'nin gerçek %10 PDF'lerini** açtı. Beş yeni belge (iki doğrudan kitapçık dizini + üç PDF) ve üç gerekçeli eski duyuru tekrarıdır. Sınavın tamamının aday sisteminde sınırlı süre görülmesi, herkese açık tam kitapçık veya yeniden yayım lisansı değildir; duyurulardaki aday erişim süreleri denetim tarihinde geçmiştir. AIS hesabına giriş yapılmadı.

| Sınav / resmî PDF | Fiziksel PDF sayfa sayısı | Matematik/sayısal PDF sayfaları | Tam test kapsamı | Kamuya açık matematik/sayısal içerik | Anahtar kararı |
|---|---:|---:|---|---|---|
| [2026 KPSS Ön Lisans](https://dokuman.osym.gov.tr/web/2026/10/2026-kpss-on-lisans-temel-soru-kitapcigi-ve-cevap-anahtari-10-le3c9n-04123429.pdf) | 32 | 12–19 | Genel Yetenek içinde özgün31–60 | 3/30 soru metni | Yalnız57→B açık; diğer iki numara-cevap eşlemesi belirsiz; tam net kapalı |
| [2026 ALES/2](https://dokuman.osym.gov.tr/web/2026/8/2025-ales2-temel-soru-kitapcigi-ve-cevap-anahtari-10-b22o51-02132535.pdf) | 34 | 3–17 | Sayısal1–50 | 5/50 soru metni | 9→C,11→A,13→E açık; iki diğer eşleşme belirsiz; tam net kapalı |
| [2026 DGS](https://dokuman.osym.gov.tr/pdfdokuman/2026/DGS/TSK/intkitapcik_td19072026.pdf) | 33 | 3–16 | Sayısal1–50 | Özgün1,5,11,15,43 | SırasıylaE,A,E,B,C açık; yalnız5/50; tam net kapalı |

ALES resmî URL'sinin dosya adında `2025-ales2` bulunmasına karşın duyuru, kapak ve sınav tarihi **2026-ALES/2, 2 Ağustos 2026**'dır. URL değiştirilmedi veya varsayımsal yeni dosya adı üretilmedi. Kaynak kimliği dosya adına göre tahmin edilmedi.

Bu üç PDF için **kimlik doğrulandı; tam içerik ve tam cevap anahtarı doğrulanmadı**. Düzeltme/iptal taraması bu ek kısmi araştırmada tamamlanmadı (`correctionsChecked=false`). Kısmi harflerle bütün denemenin doğru/yanlış/boş/net sonucu üretilmemelidir. Kullanıcı özel dosya ve kendi anahtarını kullanabilse de bunlar “resmî tam anahtar doğrulandı” olarak gösterilemez.

İki sütunlu ALES/KPSS sayfalarında metin çıkarımı bazı soru numaralarını cevabıyla kesin eşleştiremedi. Görsel uç nokta yalnız görüntü işaretçisi döndürdüğünden görsel kontrol yapılmış sayılmadı; belirsiz eşleşmeler tahminle tamamlanmadı.

## Fiilen okunan kaynak dökümü

“Yeni”, önceki 42 belgeli raporda yer almayan URL'yi; “yeniden”, somut yeni anahtar/düzeltme işi için tekrar açılan belgeyi gösterir. İkinci grubu yeni araştırılmış kaynak gibi çoğaltmıyoruz.

| # | Kaynak | Tür | Önceki rapora göre | Okuma amacı / karar |
|---|---|---|---|---|
| 1 | [ÖSYM 2023 TYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2023/YKS/TSK/yks_tyt_2023_kitapcik_T23ky.pdf) | PDF | yeni | 40 matematik anahtarı ve matematik sayfaları |
| 2 | [ÖSYM 2024 AYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2024/YKS/TSK/yks_ayt_2024_kitapcik_ts85k.pdf) | PDF | yeni | 40 matematik anahtarı ve matematik sayfaları |
| 3 | [ÖSYM 2024 kitapçık dizini](https://www.osym.gov.tr/2024yks-tyt-ayt-ve-ydt-temel-soru-kitapciklari-ve-cevap-anahtarlari) | HTML | yeniden | Doğrudan PDF kaynağına ulaşmak için |
| 4 | [ÖSYM 2025 kitapçık dizini](https://www.osym.gov.tr/2025yks-tyt-ayt-ve-ydt-temel-soru-kitapciklari-ve-cevap-anahtarlari) | HTML | yeni | Doğrudan PDF bağlantıları |
| 5 | [ÖSYM 2023 sonuç duyurusu](https://www.osym.gov.tr/2023-yuksekogretim-kurumlari-sinavi-2023yks-sonuclari-aciklandi) | HTML | yeni | Sonuç ve düzeltme araştırması |
| 6 | [ÖSYM 2024 sonuç duyurusu](https://www.osym.gov.tr/2024-yuksekogretim-kurumlari-sinavi-2024yks-sonuclari-aciklandi) | HTML | yeni | Sonuç ve düzeltme araştırması |
| 7 | [ÖSYM 2024 TYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2024/YKS/TSK/yks_tyt_2024_kitapcik_T24kt.pdf) | PDF | yeni | 40 matematik anahtarı ve matematik sayfaları |
| 8 | [ÖSYM 2025 TYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2025/YKS/TSK/yks_tyt_2025_kitapcik_d250.pdf) | PDF | yeni | 40 matematik anahtarı ve matematik sayfaları |
| 9 | [ÖSYM 2025 AYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2025/YKS/TSK/yks_ayt_2025_kitapcik_st12.pdf) | PDF | yeni | 40 matematik anahtarı ve matematik sayfaları |
| 10 | [ÖSYM 2025 sonuç duyurusu](https://www.osym.gov.tr/2025yks-sinav-sonuclari-aciklandi) | HTML | yeni | Sonuç ve düzeltme araştırması |
| 11 | [ÖSYM 2025 cevap kâğıdı duyurusu](https://www.osym.gov.tr/2025yks-cevap-kgitlari-ve-aday-cevaplari-erisime-acildi) | HTML | yeni | Adaya özel erişim süresi ve dizilim farkı |
| 12 | [ÖSYM 2023 kitapçık dizini](https://www.osym.gov.tr/2023yks-tyt-ayt-ve-ydt-temel-soru-kitapciklari-ve-cevap-anahtarlari) | HTML | yeni | 2023 AYT gerçek PDF bağlantısı |
| 13 | [ÖSYM 2026 yayın duyurusu](https://www.osym.gov.tr/2026-yuksekogretim-kurumlari-sinavi-2026yks-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi) | HTML | yeniden | 2026 doğrudan kitapçık bağlantısı |
| 14 | [ÖSYM 2022 yayın duyurusu](https://www.osym.gov.tr/2022yuksekogretim-kurumlari-sinavi-2022yks-oturumlari-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi) | HTML | yeniden | 2022 doğrudan kitapçık bağlantısı |
| 15 | [ÖSYM 2026 kitapçık dizini](https://www.osym.gov.tr/2026yks-tyt-ayt-ve-ydt-temel-soru-kitapciklari-ve-cevap-anahtarlari) | HTML | yeni | TYT/AYT PDF bağlantıları |
| 16 | [ÖSYM 2022 kitapçık dizini](https://www.osym.gov.tr/2022yks-tyt-ayt-ve-ydt-temel-soru-kitapciklari-ve-cevap-anahtarlari) | HTML | yeni | TYT/AYT PDF bağlantıları |
| 17 | [ÖSYM 2026 TYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2026/YKS/TSK/yks_tyt_2026_kitapcik_d350.pdf) | PDF | yeni | 40 matematik anahtarı ve matematik sayfaları |
| 18 | [ÖSYM 2026 AYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2026/YKS/TSK/yks_ayt_2026_kitapcik_kt12.pdf) | PDF | yeni | Basılı anahtarın 23. sorusu güncel karar değildir |
| 19 | [ÖSYM 2022 TYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2022/YKS/TSK/yks_2022_tyt.pdf) | PDF | yeni | 40 matematik anahtarı ve matematik sayfaları |
| 20 | [ÖSYM 2026 ilk düzeltme](https://www.osym.gov.tr/2026-yuksekogretim-kurumlari-sinavi-2026yks-degerlendirme-islemleri) | HTML | yeniden | 1 Temmuz C→A; sonraki iptal nedeniyle son karar değil |
| 21 | [ÖSYM 2026 sonuç duyurusu](https://www.osym.gov.tr/2026yks-sinav-sonuclari-aciklandi) | HTML | yeniden | 21 Temmuz sonuç duyurusu |
| 22 | [ÖSYM 2026 iptal açıklaması](https://dokuman.osym.gov.tr/pdfdokuman/2026/YKS/aciklama_ydd21072026.pdf) | PDF | yeniden | 21 Temmuz AYT matematik 23 yargı kararıyla iptal |
| 23 | [ÖSYM 2022 sonuç duyurusu](https://www.osym.gov.tr/2022yuksekogretim-kurumlari-sinavi-2022yks-sonuclari-aciklandi) | HTML | yeni | Sonuç ve düzeltme araştırması |
| 24 | [MEB ÖDSGM soru kullanım hakkı duyurusu](https://odsgm.meb.gov.tr/www/merkezi-sistem-sinavlari-ile-protokollu-sinavlarin-desifre-olmus-sorularinin-kullanim-hakki-duyurusu/icerik/150) | HTML | yeni | 25.05.2016 duyurusu, soru kullanımını sözleşme ile sınırlı ve süreli verir; internet dahil yayın araçlarına göre sözleşmeler ve kullanım bedeli bağlantıları vardır. Açık lisans değildir. Gerekli izin için resmî başvuru/sözleşme yolu belirlenmiştir; bu projede sözleşme yoktur. |
| 25 | [MEB Kazanım Kavrama Testleri açıklaması](https://odsgm.meb.gov.tr/www/kazanim-kavrama-testleri-hazirlanmistir/icerik/25) | HTML | yeni | Matematik dahil altı dersin testleri ve cevaplarının ücretsiz PDF olarak indirilebildiği; telifin MEB'e ait olduğu, ticari kullanımın yasak olduğu ve kullanım koşullarının MEB iznine bağlı olduğu açıklanır. Ücretsiz erişim otomatik üçüncü taraf yayın izni değildir; bankaya aktarılmadı. |
| 26 | [ÖZDEBİR deneme sınavları genel açıklaması](https://www.ozdebir.org.tr/icerik/ozdebir-deneme-sinavlarina-iliskin-genel-aciklama?cid=934) | HTML | yeni | 25.10.2021 tarihli açıklama, sınav ve çözümlerin sosyal medyada paylaşılmasını yasaklar; cevap anahtarı/video çözüm yayımlanma zamanını tarif eder. Sorular kopyalanmadı. Adayın yasal kitapçığı kendi cihazında çalışması ayrı bir kişisel kullanım olmalıdır; yayın izni gibi sunulmamalı. |
| 27 | [MEB OGM sık sorulan sorular](https://ogm.meb.gov.tr/www/sss.php?s=09sss463) | HTML | yeni | OGM Materyal'de TYT/AYT/YDT için üç adım soru bankası/denemeler ve dijital yardımcı kaynaklar bulunduğu; etkileşimli ders kitaplarının cihazlara indirilerek çevrim içi/çevrim dışı kullanılabildiği açıklanır. Öğrenciye yönelik gerçek materyal erişimi doğrulandı. Üçüncü taraf yeniden yayım/gömme izni verilmiş sayılmaz. |
| 28 | [3D Yayınları ana sayfa](https://3dyayinlari.com/) | HTML | yeni | TYT/AYT genel ve branş denemeleri, video çözümleri, cevap anahtarları ve sanal optik hizmetleri listelenir. Gerçek kaynak/yayıncı varlığı doğrulandı, açık tekrar yayın lisansı bulunmadı. |
| 29 | [MEB internet yayım sözleşmesi PDF](https://odsgm.meb.gov.tr/meb_iys_dosyalar/2016_05/25093041_internet_sozlesmesi.pdf) | PDF | yeni | 2 sayfalık örnek sözleşme; soru ve anahtarların yayımı, biçim/seçenek sırası korunması, yayım türüne ayrı izin/bedel, kapsamın belirli sınavlarla sınırlı olması, kullanım süresi gibi şartlar açıkça yazılı. İzin alınabilecek somut sözleşme yolu; imzasız örnek sözleşme izin değildir. Fiyat/süre maddeleri tarihsel metindir, güncel ücret teklifiyimiş gibi sunulmamalı. |
| 30 | [3D kurumsal cevap anahtarları](https://3dyayinlari.com/kurumsal-deneme-cevap-anahtarlari) | HTML | yeni | 2025–2026 ve 2026–2027 TYT/AYT deneme anahtarı başlıkları ve İncele bağlantıları; henüz gelecekteki bazı anahtarlar için yayımlanma tarihleri vardır. Sayfa tüm hakların saklı olduğunu bildirir. Kitapçık/anahtar eşleşmesi için özgün kaynak bulunur. Tam matematik harfleri ve soru metinleri bu turda aktarılmadı; üçüncü taraf yeniden kullanım izni yok. |
| 31 | [3D TYT genel deneme ürün sayfası](https://3dyayinlari.com/urunlerimiz/tyt/genel-deneme-23) | HTML | yeni | Yayınevinin gerçek TYT deneme ürün kaydı açıldı. Ürün tanıtımı yayın izni değildir. |
| 32 | [TÖDER sınavlar](https://www.toder.org/s-4-sinavlar/a-14-toder-yayinlari-sinavlar) | HTML | yeni | TÖDER TYT/AYT deneme türleri ve 2026–2027 takvim kayıtları görüldü. Takvim, soru yayın izni değildir; gelecek tarihli sınavlar yapılmış gibi alınmadı. |
| 33 | [TÖDER TYT Türkiye Geneli anahtar duyurusu](https://www.toder.org/haber-52-toder-tyt-turkiye-geneli-deneme-sinavi-cevap-anahtari) | HTML | yeni | Anahtar PDF'si ve BIKOM/SEKONIC formatları için yayınevi bağlantıları bulunuyor. Kaynak bağı kurulabilir; soru metni/yeniden kullanım hakkı doğrulanmadı. |
| 34 | [Tudem TYT 6'lı deneme ürün kaydı](https://www.tudem.com/urun/egitim/1006/tudem_egitim/11051/tyt_6li_deneme_sinavi_seti.aspx) | HTML | yeni | ISBN 9786052854433; altı kitapçıklı gerçek deneme seti ve örnek sayfa bağlantısı mevcut. ISBN/kitapçık kimliğine destek olur. Ürün tanıtımı veya örnek PDF bağlantısı açık lisans değildir. |
| 35 | [Tudem TYT örnek kitapçık PDF](https://www.tudem.com/images/tadimlik/101d5tyt51ds1_tadimlikpdf.pdf) | PDF | yeni | TYT Deneme 1 başlığı, toplam 125 soru (Sosyal Bilimler alternatif sorular dahil), matematikte 40 soru, 135 dakika ve konu analiz tablosu görülüyor. Dosya tadımlık/örnek sürümdür; gösterilen parçalardan tam 40 matematik sorusu ve nihai anahtar doğrulanmadı. Tam TYT denemesi olarak içeri alınmadı. Yeniden yayımlama lisansı bulunmadı. |
| 36 | [Üç Dört Beş önceki kitap çözümleri](https://www.ucdortbes.com/onceki-yillara-ait-kitaplarin-video-cozumleri) | HTML | yeni | AYT/TYT matematik kitapları, denemeler ve bazı PDF/video çözüm başlıkları listelenir. Gerçek yayıncı kaynağı; soru dosyalarının yeniden yayım lisansı bulunmadı. |
| 37 | [Rehber Matematik kullanım şartları](https://www.rehbermatematik.com/kullanim-sartlari) | HTML | yeni | Şubat 2026 metni, ücretsiz PDF materyallerinin bazılarına kanal aboneliğiyle erişildiğini; kopyalama/dağıtmanın izinsiz yapılamayacağını ve indirilen PDF'lerin kişisel çalışma için olduğunu söyler. Kişisel çalışma açıklaması özel yerel dosya akışına uygundur; herkese açık soru bankası için açık izin sağlamaz. Erişim koşulları atlanmamalı. |
| 38 | [TÖDER 2025–2026 TYT anahtar PDF](https://toder.org/doc/TODER_TYT_Genel_Deneme_Sinavi_Cevap_Anahtari_2025_11.pdf) | PDF | yeni | Tek sayfalık belgede A/B grupları ve Türkçe/Sosyal/Matematik/Fen başlıkları, 1–40'a ulaşan sütunlar var. Metin çıkarımı sütun başlıklarını ayrı döndürdüğü için matematik A/B sütun eşlemesi bu turda kesinleştirilmedi. Otomatik puanlama anahtarı oluşturulmadı. Bir PDF'de 40 satır görmek, doğru kitapçık grubunun 40 matematik cevabını doğrulamak değildir. |
| 39 | [2026 KPSS Ön Lisans %10 dizini](https://osym.gov.tr/2026-kpss-on-lisans-temel-soru-kitapcigi-ve-cevap-anahtari-10) | HTML | yeni | Resmî PDF bağlantısının doğrudan dizini |
| 40 | [2026 ALES/2 %10 dizini](https://osym.gov.tr/2026-ales2-temel-soru-kitapcigi-ve-cevap-anahtari-10) | HTML | yeni | Resmî PDF bağlantısının doğrudan dizini |
| 41 | [2026 KPSS Ön Lisans %10 PDF](https://dokuman.osym.gov.tr/web/2026/10/2026-kpss-on-lisans-temel-soru-kitapcigi-ve-cevap-anahtari-10-le3c9n-04123429.pdf) | PDF | yeni | 32 sayfa; matematik fiziksel12–19; 3/30 yayımlı; tam anahtar değil |
| 42 | [2026 ALES/2 %10 PDF](https://dokuman.osym.gov.tr/web/2026/8/2025-ales2-temel-soru-kitapcigi-ve-cevap-anahtari-10-b22o51-02132535.pdf) | PDF | yeni | 34 sayfa; sayısal fiziksel3–17; 5/50 yayımlı; URL2025 derken kapak2026 |
| 43 | [2026 DGS %10 PDF](https://dokuman.osym.gov.tr/pdfdokuman/2026/DGS/TSK/intkitapcik_td19072026.pdf) | PDF | yeni | 33 sayfa; sayısal fiziksel3–16; 5/50 yayımlı; tam anahtar değil |
| 44 | [2026 KPSS Ön Lisans yayın duyurusu](https://osym.gov.tr/2026-kpss-on-lisans-sinavi-temel-soru-kitapcigi-ve-cevap-anahtari-yayimlandi) | HTML | yeniden | Doğrudan %10 PDF bağlantısını izlemek için |
| 45 | [2026 ALES/2 yayın duyurusu](https://osym.gov.tr/2026-ales2-temel-soru-kitapcigi-ve-cevap-anahtari-yayimlandi) | HTML | yeniden | Doğrudan %10 PDF bağlantısını izlemek için |
| 46 | [2026 DGS yayın duyurusu](https://www.osym.gov.tr/2026dgs-temel-soru-kitapcigi-ve-cevap-anahtari-yayimlandi) | HTML | yeniden | Doğrudan %10 PDF bağlantısını izlemek için |
| 47 | [ÖSYM 2021 yayın duyurusu](https://www.osym.gov.tr/2021yuksekogretim-kurumlari-sinavi-2021yks-oturumlari-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi) | HTML | yeniden | Yeni tam TYT/AYT anahtar doğrulaması için dizine ulaşma |
| 48 | [ÖSYM 2021 sonuç duyurusu](https://www.osym.gov.tr/2021yuksekogretim-kurumlari-sinavi-2021yks-sonuclari-aciklandi) | HTML | yeni | 28 Temmuz 2021 sonuç; hedefli matematik düzeltme/iptal araması |
| 49 | [ÖSYM 2021 kitapçık dizini](https://www.osym.gov.tr/2021yks-tyt-ayt-ve-ydt-temel-soru-kitapciklari-ve-cevap-anahtarlari) | HTML | yeni | Gerçek TYT/AYT PDF kaynak bağlantıları |
| 50 | [ÖSYM 2021 TYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2021/YKS/TSK/tyt_yks_2021.pdf) | PDF | yeni | 45 sayfa; matematik 26–37; 40 harfin tamamı anahtar sayfası 45 üzerinde okundu |
| 51 | [ÖSYM 2021 AYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2021/YKS/TSK/ayt_yks_2021.pdf) | PDF | yeni | 49 sayfa; matematik 26–36; 40 harfin tamamı anahtar sayfası 49 üzerinde okundu |
| 52 | [ÖSYM 2020 yayın duyurusu](https://www.osym.gov.tr/2020yuksekogretim-kurumlari-sinavi-2020yks-oturumlari-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi) | HTML | yeniden | Sınav tarihleri ve haklar; tam anahtar/PDF bağlantısını izlemek için yeniden okundu. |
| 53 | [ÖSYM 2020 kitapçık dizini](https://www.osym.gov.tr/2020yks-tyt-ayt-ve-ydt-temel-soru-kitapciklari-ve-cevap-anahtarlari) | HTML | yeni | Tam TYT/AYT PDF bağlantıları resmî dizinde doğrulandı. |
| 54 | [ÖSYM 2020 TYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2020/YKS/TSK/tyt_yks_2020.pdf) | PDF | yeni | 44 fiziksel sayfa; matematik 24–35; 40 harfin tamamı anahtar sayfası 44 üzerinde okundu. |
| 55 | [ÖSYM 2020 AYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2020/YKS/TSK/ayt_yks_2020.pdf) | PDF | yeni | 48 fiziksel sayfa; matematik 25–35; 40 harfin tamamı anahtar sayfası 48 üzerinde okundu. |
| 56 | [ÖSYM 2020 sonuç duyurusu](https://www.osym.gov.tr/2020yuksekogretim-kurumlari-sinavi-2020yks-sonuclari-aciklandi) | HTML | yeni | 27 Temmuz 2020 değerlendirmesi tamamlandı; matematikte değişiklik/iptal belirtmiyor. |
| 57 | [ÖSYM YKS resmî arşivi](https://www.osym.gov.tr/SinavGrubu/Menu/314) | HTML | yeni | 2020 kayıtlarında yayım/sonuç duyuruları görüldü; 2020 matematik iptal/değişiklik duyurusu bulunmadı. |
| 58 | [ÖSYM 2018 yayın duyurusu](https://www.osym.gov.tr/2018yks-tyt-ve-ayt-oturumlari-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi-1072018) | HTML | yeniden | Tam TYT/AYT anahtarları için kaynak bağlantısı; eski bağlantı 404, gerçek kitapçık dizini ayrıca bulundu |
| 59 | [ÖSYM 2018 sonuç duyurusu](https://www.osym.gov.tr/2018-yuksekogretim-kurumlari-sinavi-2018yks-sonuclari-aciklandi) | HTML | yeni | 31 Temmuz sonuç duyurusu YDT İngilizce 41 C→D der; matematik değişikliği belirtmez |
| 60 | [ÖSYM 2018 kitapçık dizini](https://www.osym.gov.tr/2018yks-tyt-ayt-ydt-temel-soru-kitapciklari-ve-cevap-anahtarlari) | HTML | yeni | Gerçek TYT/AYT PDF bağlantıları |
| 61 | [ÖSYM 2018 TYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2018/YKS/TYT_01072018.pdf) | PDF | yeni | 42 fiziksel sayfa; matematik 22–33; tam 40 anahtar sayfa 42 |
| 62 | [ÖSYM 2018 AYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2018/YKS/AYT_01072018.pdf) | PDF | yeni | 50 fiziksel sayfa; matematik 25–36; tam 40 anahtar sayfa 50 |
| 63 | [ÖSYM 2019 yayın duyurusu](https://www.osym.gov.tr/2019yuksekogretim-kurumlari-sinavi-2019yks-oturumlari-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi) | HTML | yeniden | Bilinen TYT matematik 7 iptali ve hak koşulları yeniden doğrulandı. |
| 64 | [ÖSYM 2019 kitapçık dizini](https://www.osym.gov.tr/2019yks-tyt-ayt-ydt-temel-soru-kitapciklari-ve-cevap-anahtarlari) | HTML | yeni | Gerçek TYT/AYT PDF bağlantıları ve sınav tarihleri doğrulandı. |
| 65 | [ÖSYM 2019 TYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2019/YKS/TSK/tyt_yks_2019_web.pdf) | PDF | yeni | 43 fiziksel sayfa; matematik 24–34; anahtar 43 üzerinde 39 harf + 7. soru İPTAL. |
| 66 | [ÖSYM 2019 sonuç duyurusu](https://www.osym.gov.tr/2019yks-yuksekogretim-kurumlari-sinavi-2019yks-sonuclari-aciklandi) | HTML | yeni | 17 Temmuz 2019; AYT Sosyal Bilimler-1 soru 33 iptali matematiğe uygulanmadı; başka matematik değişikliği bulunmadı. |
| 67 | [ÖSYM 2022 AYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2022/YKS/TSK/yks_2022_ayt.pdf) | PDF | yeni | 50 fiziksel sayfa; matematik26–37; tam40 anahtar sayfa50. Son kontrolde erişilebildi; iki okuma aynı harfleri verdi. |
| 68 | [ÖSYM 2023 AYT kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2023/YKS/TSK/yks_ayt_2023_kitapcik_g5A2H.pdf) | PDF | yeni | 50 fiziksel sayfa; matematik25–36; tam40 anahtar sayfa50. Son kontrolde erişilebildi; iki okuma aynı harfleri verdi. |

## Sayıma alınmayan erişimler

- [2019 AYT PDF](https://dokuman.osym.gov.tr/pdfdokuman/2019/YKS/TSK/ayt_yks_2019_web.pdf): gerçek resmî dizin bağlantısı ilk açılışta ve son bir sınırlı ek denemede zaman aşımı döndürdü; tam belge/anahtar okunmuş sayılmadı.
- 2018 yayın duyurusunun eski `dokuman.osym.gov.tr/web/eskidosyalar/15134.pdf` bağlantısı 404 döndürdü; okunmuş belge sayılmadı. Gerçek 2018 kitapçık dizinindeki güncel TYT/AYT bağlantıları ayrıca açılarak doğrulandı.
- 2022/2023 AYT'nin ilk başarısız denemeleri sayılmadı; sonradan başarıyla okunan iki PDF yukarıda67/68 numaralarında birer kez sayılır. Sonuç duyurularının ek AYT kontrolünde yeniden açılması belge sayısını artırmaz.
- 2025 sonuç duyurusunun ilk aranan uzun URL'si açılamadı; sonuçta doğrulanan gerçek `2025yks-sinav-sonuclari-aciklandi` belgesi yalnız bir kez sayıldı.
- OGM Materyal ana sayfası ve 3D anahtarının Flipbook bağlantısı sıfır okunabilir satır döndürdü; bunlar kaynak okumasına dahil edilmedi.
- Arama motorunda görülen başka sayfalar, soru metninin/anahtarın tamamı okundu şeklinde sayılmadı.

## Kalan doğrulama işleri

1. 2019 AYT tam anahtarı, iptalleri ve fiziksel sayfa eşleştirmeleri. 2019 TYT/2026 AYT için iptalli puanlama kuralı uygulanıp ayrıca doğrulanana kadar net kapalı kalmalı.
2. KPSS, ALES ve DGS için tam kitapçık/anahtar erişimi ve hak kapsamı; kısmi anahtarla tam net çıkarılmaması.
3. Yeniden kullanım izni açık Türkçe soru kaynağı veya hak sahibinin yazılı izni. Bulunana kadar soru metni/görseli kamuya açık bankaya eklenmemeli.
4. Soruların konu etiketlerinin tek tek gerçek içerikten insan denetimiyle sınıflandırılması. Bu turdaki metadata, soru bazında konu/zorluk doğrulaması içermez; otomatik uydurma sınıflandırma yapılmadı.
5. Resmî PDF baytlarından güvenilir hash elde edilmesi; o zamana kadar seçilen yerel dosya için resmî kriptografik eşleşme iddia edilmemesi.
