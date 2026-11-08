# Sade tasarım içinde gerçek sınav modu

PR #7'nin `9890394` sürümü temel alındı. Mevcut `main` başlangıçta `6876396` idi. Yeni çalışma `codex/sade-sinav-modu` dalında yürütüldü ve GitHub’a kaydedildi. PR #7’nin `codex/sade-arayuz` dalı, önceki iki commit korunarak ve zorlamasız ileri taşınarak güncellendi. Kullanıcının bu görevdeki açık talimatı nedeniyle **otomatik birleştirme ve yayın yapılmaz**.

## Arayüz ve çalışma akışı

Dört ana bölüm korunur: Soru çöz, Konular, Öğretmen, İlerleme. Soru çöz araç çubuğundaki küçük **Sınav Modu** düğmesi ayrı çalışma alanını açar. Normal sayfalarda belge seçme ve görüntüleme kontrolleri bulunmaz; moddan çıkınca bu bileşenler DOM'dan temizlenir. Ana soru kartı ve seçili kaynak sorusu korunur.

Mod içinde TYT, AYT veya KPSS; yıl; kitapçık seçilir. KPSS Lisans, Ön Lisans ve Ortaöğretim ayrımı vardır. 2018–2026 aralığı desteklenir. Doğrulanmış 17 TYT/AYT kitapçık kimliği ve resmî bağlantıları önceki araştırmadan korunur; eksik kimlik veya kullanıcının kendi kitapçığı için alanlar düzenlenebilir. KPSS'nin varsayılan 30 cevap alanı bir öneridir; özgün numaralandırma kitapçığa göre kontrol edilmelidir.

2024 KPSS Ön Lisans'ın kamuya açık %10 kitapçığı ayrıca kısmi kaynak olarak sunulur. Bu kayıtta yalnız yayımlanmış 3 matematik sorusunun 33,39,57 özgün numaraları kullanılır; tam deneme veya tam anahtar iddiası yoktur.

Kullanıcının seçtiği özgün PDF, şekil ve seçenekleriyle yerleşik tarayıcı görüntüleyicisinde açılır. Masaüstünde optik form yanındadır; dar ekranda aynı sayfada alt alta yerleşir. Sayfaya gitme, tam ekran, soru navigasyonu, işaretleme, konu etiketi, kronometre, süre sınırı, duraklat/devam ve bitirme korunur. Sınav modundan çıkış veya uygulamanın ana menüsünde bölüm değişimi süreyi duraklatıp kayıt kuyruğunu korur. Tarayıcı sekmesini doğrudan kapatmak veya çalışırken yenilemek süreyi kendiliğinden duraklatmaz; kaydedilmiş başlangıç zamanı ve cevaplar korunur. Süreyi durdurmak için önce Duraklat kullanılmalıdır. Tekrar girişte yarım çalışma **Devam et** ile açılır. Duraklat/devam işlemi depoya yazılırken “Kaydediliyor…” görünür ve cevaplar kilitlenir; yazma başarısızsa önceki süre durumuna dönülerek uyarı verilir. “Kendi özgün kitapçığım” seçimi yeniden açıldığında korunur.

## Cevap anahtarı ve gizlilik

- 15 iptalsiz tam TYT/AYT anahtarı kaynak kaydına bağlıdır. Dosya kimliği kullanıcı tarafından açıkça teyit edilmeden bu anahtar uygulanmaz. Gerçek yayıncı dosyalarının kayıtlı kriptografik özeti henüz katalogda yoktur; kaynak anahtarı doğrulaması ile kullanıcı dosyası kimliği ayrı gösterilir.
- 2019 TYT7 ve 2026 AYT23 iptalleri nedeniyle bu iki kitapçıkta net kapalıdır. Eski basılı harflerle sonuç üretilmez.
- Bilinmeyen KPSS/tam doğrulanmamış anahtar otomatik puan üretmez. Kullanıcı TXT/JSON anahtarı ancak açık manuel işlemle, doğrulanmamış etiketiyle hesaplanır; `verified:true` iddiası kabul edilmez.
- Hesaplanan değer doğru−yanlış/4 çalışma netidir; ÖSYM yerleştirme veya ölçekli sınav puanı değildir.
- Belge, kullanıcı anahtarı, cevap, süre, sayfa/konu eşleştirmesi ve sonuç yalnız hesap kimliğine ayrılan IndexedDB'de saklanır. Supabase'e, AI'ya veya herkese açık bankaya gönderilmez.
- Aynı cihazdaki yerel hesap ayrımı şifreleme değildir. Tarayıcı verileri silinirse dosyalar kaybolabilir; mevcut dışa aktarma ve yerel indirme seçenekleri korunur.

Bu turda **0 yeni soru** eklendi. Yedi izinli kaynaktan gelen **142 kaynaklı kayıt**, kaynak/lisans bilgileri, altı öğretmen, öğrenme profilleri, Supabase üyeliği, eski deneme geçmişi, yarım çalışmalar ve eski cihaz depoları silinmedi. Üretim veritabanına şema veya seed uygulanmadı. Soru, şekil, seçenek veya yeni problem üretilmedi; telifli kitapçık baytları depoya alınmadı.

## Değişen parçalar

- `js/app.js`: küçük giriş düğmesi, dört görünümle modun koordinasyonu.
- `js/exam-mode.js`: yıl/tür/kitapçık seçimi, geç yükleme, güvenli çıkış ve bileşen ömrü.
- `shared/exam-mode-catalog.js`: seçim doğrulaması ve yalnız kaynak kimliği/kapsam bilgileri.
- `js/private-exams.js`: filtreli mod seçenekleri, kişisel kitapçık kurulumu, duraklatıp güvenli kapatma, devam listesi.
- `shared/private-exam.js` / `shared/private-library.js`: KPSS Lisans desteği ve tek ortak tür listesi.
- `styles/platform.css`: yalnız sınav modu içinde uygulanan, tasarımla uyumlu yerleşim.
- İlgili model ve tarayıcı testleri; gerçek kitapçık için ayrı CI kontrolü ve betiği.

## Doğrulama

Yerel `npm test` ve [Validate app CI](https://github.com/MontanaS406/matematik-akademim/actions/runs/42489910249): **83/83** birim/model/veritabanı testi ve **70/70** masaüstü/mobil Chromium senaryosu geçti. Kod sürümü `8f9d788` üzerinde CI sonuçları doğrulandı. `npm run audit:questions`: 7 kaynak / 142 kayıt / 6 konu. `npm audit`: geliştirme bağımlılıkları dâhil 0 açık. `git diff --check` temiz.

Yerleşik PDF görüntüleyicinin `success` durumu, 40 optik alan, cevap/9 saniyelik süre kaydı, 60 saniyelik duraklamanın dışlanması, yeniden yüklemede devam ve 12 saniyeye ilerleme denetlendi. Kaynakla açık eşleştirmede 1,00 net; bilinmeyen KPSS’de puanlanmama; iki iptal; hesap ayrımı; HTTP ile dosya/anahtar gönderilmemesi; HTML/MIME sınırı ve sade ekrana temiz dönüş test edildi. Yeni testler, depoya yazma sürerken ters duraklat/devam işleminin engellenmesini, başarısız yazmada önceki süre/cevapların korunmasını ve kitapçık tercihinin yeniden açılınca korunmasını kapsar.

Bir önceki test turunda tarayıcının yerleşik belge çerçevesiyle onay penceresi otomasyonunda aralıklı hata görüldü. Bitirme testi artık gerçek görüntüleyici hazır durumunu ve beklenen onayın kabulünü açıkça bekler; hata yutulmaz. Anahtar/KPSS senaryoları ayrıca 40 tekrarda geçti; ardından tam 70 senaryo yerelde ve CI’da başarılı oldu.

Ana otomasyon belgeleri **boş sentetik test dosyalarıdır**; soru bankasında yer almaz. Gerçek ÖSYM belgelerinin kontrolü bunlardan ayrıdır.

Yerel ortamdan `dokuman.osym.gov.tr` bağlantısı ağ politikası nedeniyle 403 ile engellidir. Gerçek dosya kontrolü ayrıca [Official booklet integration CI](https://github.com/MontanaS406/matematik-akademim/actions/runs/42489910252) işinde **4/4 geçti**: iki resmî 2024 TYT/AYT belgesi doğrudan test koşucusuna alındı; her biri masaüstü ve 390 piksel mobil Chromium görünümünde açıldı. Her kontrolde 40 cevap alanı, bir doğru cevap, 60 saniye duraklamanın dışlanması, yeniden açmada cevap ve 12 saniyenin korunması, açık dosya kimliği teyidi sonrası 1,00 çalışma neti doğrulandı. Dış servise veri gövdeli gönderim sayısı 0 oldu. Bu test mevcut anahtarın 40 harfinin yeniden insan eliyle incelenmesi değildir; önceki kaynak doğrulamasını ve uygulamanın hesaplama/kayıt akışını kullanır.

| Gerçek kitapçık | Yayıncıdan gelen boyut | Masaüstü / mobil |
| --- | ---: | --- |
| 2024 TYT | 5.439.411 bayt | Geçti / geçti |
| 2024 AYT | 4.390.291 bayt | Geçti / geçti |

Korunan kitapçık baytları Git deposuna veya CI eklerine alınmaz. Soru metni, ekran görüntüsü, video veya iz yayımlanmaz; geçici tarayıcı bağlamları test sonunda kapatılır. Kaynak dosyalarına ait kontrol özetleri CI günlüğünde bulunur; kataloğun dosya kimliği politikası hâlâ açık kullanıcı teyididir.

## Sınırlar

2019 AYT tam anahtarı ve KPSS'nin tam nihai anahtarları hâlâ eksiktir. KPSS kısmi kaynak tam deneme gibi gösterilmez. İptal sonrası puanlama politikası desteklenmediği için iptalli iki sınav kapalıdır. Gerçek iOS/Safari/Android donanım testi yapılmadı; mobil Chrome görünümü emülasyonla denetlendi. Canlı Supabase hesabı ve gerçek AI model çağrısı test edilmedi. Özel kitapçık başına tek devam/sonuç kaydı vardır; çoklu girişim arşivi henüz yoktur.
