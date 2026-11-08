# Sade tasarım içinde gerçek sınav modu

PR #7'nin `9890394` sürümü temel alındı. Mevcut `main` başlangıçta `6876396` idi. Yeni çalışma `codex/sade-sinav-modu` dalında yürütüldü ve GitHub’a kaydedildi. PR #7’nin `codex/sade-arayuz` dalı, önceki iki commit korunarak ve zorlamasız ileri taşınarak güncellendi. Devam turu `8a48a99` sürümünden ilerletildi; uygulama değişiklikleri `8700bd0` commit’inde kaydedildi. Kullanıcının bu görevdeki açık talimatı nedeniyle **otomatik birleştirme ve yayın yapılmaz**.

## Arayüz ve çalışma akışı

Dört ana bölüm korunur: Soru çöz, Konular, Öğretmen, İlerleme. Soru çöz araç çubuğundaki küçük **Sınav Modu** düğmesi ayrı çalışma alanını açar. Normal sayfalarda belge seçme ve görüntüleme kontrolleri bulunmaz; moddan çıkınca bu bileşenler DOM'dan temizlenir. Ana soru kartı ve seçili kaynak sorusu korunur.

Mod içinde TYT, AYT veya KPSS; yıl; kitapçık seçilir. KPSS Lisans, Ön Lisans ve Ortaöğretim ayrımı vardır. 2018–2026 aralığı desteklenir. Doğrulanmış 17 TYT/AYT kitapçık kimliği ve resmî bağlantıları önceki araştırmadan korunur; eksik kimlik veya kullanıcının kendi kitapçığı için alanlar düzenlenebilir. KPSS'nin varsayılan 30 cevap alanı bir öneridir; özgün numaralandırma kitapçığa göre kontrol edilmelidir.

2024 KPSS Ön Lisans'ın kamuya açık %10 kitapçığı ayrıca kısmi kaynak olarak sunulur. Bu kayıtta yalnız yayımlanmış 3 matematik sorusunun 33,39,57 özgün numaraları kullanılır; tam deneme veya tam anahtar iddiası yoktur.

Kullanıcının seçtiği özgün PDF, şekil ve seçenekleriyle yerleşik tarayıcı görüntüleyicisinde açılır. Masaüstünde optik form yanındadır; dar ekranda aynı sayfada alt alta yerleşir. Sayfaya gitme, tam ekran, soru navigasyonu, işaretleme, konu etiketi, kronometre, süre sınırı, duraklat/devam ve bitirme korunur. Sınav modundan çıkış veya uygulamanın ana menüsünde bölüm değişimi süreyi duraklatıp kayıt kuyruğunu korur. Tarayıcı sekmesini doğrudan kapatmak veya çalışırken yenilemek süreyi kendiliğinden duraklatmaz; kaydedilmiş başlangıç zamanı ve cevaplar korunur. Süreyi durdurmak için önce Duraklat kullanılmalıdır. Tekrar girişte yarım çalışma **Devam et** ile açılır. Duraklat/devam işlemi depoya yazılırken “Kaydediliyor…” görünür ve cevaplar kilitlenir; yazma başarısızsa önceki süre durumuna dönülerek uyarı verilir. “Kendi özgün kitapçığım” seçimi yeniden açıldığında korunur. Başlatma, bitirme, kaynak anahtarı eşleştirme ve manuel sonuç yazımı da depoya kaydedilmeden başarılı gösterilmez. Yazma hatasında önceki çalışma ve seçilmiş süre sınırı korunur; yinelenen geçişler engellenir.

## Cevap anahtarı ve gizlilik

- 15 iptalsiz tam TYT/AYT anahtarı kaynak kaydına bağlıdır. Özgün 2024 TYT/AYT dosyalarının SHA-256 özetleri ve doğrulama kanıtı katalogda kayıtlıdır. Yalnız tam dosya eşleşmesinde anahtar otomatik uygulanır; bilinen özetle çelişen dosya kullanıcı teyidiyle açılamaz. Diğer 13 anahtar için dosya kimliğinin açık kullanıcı teyidi gerekir; bu durumda dosya bağımsız doğrulanmış gibi gösterilmez.
- 2019 TYT7 ve 2026 AYT23 iptalleri nedeniyle bu iki kitapçıkta net kapalıdır. Eski basılı harflerle sonuç üretilmez.
- Bilinmeyen KPSS/tam doğrulanmamış anahtar otomatik puan üretmez. Kullanıcı TXT/JSON anahtarı ancak açık manuel işlemle, doğrulanmamış etiketiyle hesaplanır; `verified:true` iddiası kabul edilmez.
- Eski kaydın kaynak eşleştirmesi artık geçersizse, dosya özeti çelişiyorsa veya sınavda iptal varsa eski kaynak neti gizlenir; cevaplar ve saklanan sonuç değiştirilmez. Mevcut güvenilir anahtarla uyuşmayan eski manuel sonuç için açık yeniden hesaplama düğmesi vardır. Güvenilir kaynak anahtarı varken manuel anahtarla sonucu geçersiz kılma kapalıdır.
- Hesaplanan değer doğru−yanlış/4 çalışma netidir; ÖSYM yerleştirme veya ölçekli sınav puanı değildir.
- Belge, kullanıcı anahtarı, cevap, süre, sayfa/konu eşleştirmesi ve sonuç yalnız hesap kimliğine ayrılan IndexedDB'de saklanır. Supabase'e, AI'ya veya herkese açık bankaya gönderilmez.
- Aynı cihazdaki yerel hesap ayrımı şifreleme değildir. Tarayıcı verileri silinirse dosyalar kaybolabilir; mevcut dışa aktarma ve yerel indirme seçenekleri korunur.

Bu turda **0 yeni soru**, **2 doğrulanmış resmî dosya özeti** eklendi. Özetler önceki başarılı [resmî dosya CI kaydından](https://github.com/MontanaS406/matematik-akademim/actions/runs/42490087023) alındı; güncel entegrasyon işi aynı yayıncı dosyalarının değişmediğini ayrıca denetler. Yedi izinli kaynaktan gelen **142 kaynaklı kayıt**, kaynak/lisans bilgileri, altı öğretmen, öğrenme profilleri, Supabase üyeliği, eski deneme geçmişi, yarım çalışmalar ve eski cihaz depoları silinmedi. Üretim veritabanına şema veya seed uygulanmadı. Soru, şekil, seçenek veya yeni problem üretilmedi; telifli kitapçık baytları depoya alınmadı.

## Değişen parçalar

- `js/app.js`: küçük giriş düğmesi, dört görünümle modun koordinasyonu.
- `js/exam-mode.js`: yıl/tür/kitapçık seçimi, geç yükleme, güvenli çıkış ve bileşen ömrü.
- `shared/exam-mode-catalog.js`: seçim doğrulaması ve yalnız kaynak kimliği/kapsam bilgileri.
- `js/private-exams.js`: filtreli mod seçenekleri, kişisel kitapçık kurulumu, duraklatıp güvenli kapatma, devam listesi.
- `shared/private-exam.js` / `shared/private-library.js`: KPSS Lisans desteği ve tek ortak tür listesi.
- `styles/platform.css`: yalnız sınav modu içinde uygulanan, tasarımla uyumlu yerleşim.
- `data/turkish-exams.js`: iki gerçek yayıncı dosyasının SHA-256, boyut ve kanıt bilgisi.
- `scripts/official-booklet-smoke.mjs` / `.github/workflows/official-booklets.yml`: gerçek kitapçık kontrolü; özet eşleştirmesi ve eski manuel sonucun güvenli yeniden hesaplanması.
- `tests/private-exam.test.mjs`, `tests/turkish-exams.test.mjs`: dosya/anahtar güven sınırları.
- `tests/e2e/exam-save-failures.spec.mjs`, `tests/e2e/exam-source-migration.spec.mjs`: başarısız kayıt ve eski sonuç regresyonları. Önceki tasarım, mod, duraklatma ve hesap testleri korunur.
- `README.md` / bu rapor: güncel akış, doğrulama ve sınırlar.

## Doğrulama

Yerel `npm test`: **85/85** birim/model/veritabanı testi; tam masaüstü/mobil Chromium paketi **82/82** geçti. [Validate app CI](https://github.com/MontanaS406/matematik-akademim/actions/runs/42519603663) üzerinde de `8700bd0` sürümü için **85/85 ve 82/82** geçti. `npm audit`: geliştirme bağımlılıkları dâhil 0 açık; diff kontrolü temiz. `npm run audit:questions`: 7 kaynak / 142 kayıt / 6 konu. Yeni soru üretilmedi; eski veri tabanları ve 142 kayıt değiştirilmedi.

Yeni testler başlangıç, bitirme ve kaynak eşleştirme yazma hatalarını; tekrar denemede düzelmeyi; süre sınırı tercihinin korunmasını; yanlış dosyaya bağlı eski netlerin ve iptalli sınav netlerinin gizlenmesini denetler. Eski cevap, anahtar eşleştirmesi ve sonuç verisi testlerde birebir korunur. Önceki PDF görüntüleme, optik, duraklatma, devam, hesap ayrımı ve sade tasarım kontrolleri de geçti.

Ana otomasyon belgeleri **boş sentetik test dosyalarıdır**; soru bankasında yer almaz. Gerçek ÖSYM belgelerinin kontrolü bunlardan ayrıdır. Yerel ortamdan `dokuman.osym.gov.tr` bağlantısı ağ politikası nedeniyle engellidir; bu sınır yerelde aşılmaya çalışılmadı.

[Official booklet integration CI](https://github.com/MontanaS406/matematik-akademim/actions/runs/42519603728) **4/4 geçti**: resmî 2024 TYT ve AYT belgeleri masaüstü ve 390 piksel mobil Chromium görünümünde açıldı. Yayıncıdan gelen dosya hem kayıtlı SHA-256 hem boyutla eşleştirildi. Kullanıcı teyidi gerektirmeden kaynak anahtarı uygulandı; dosya eşleşmesi bağımsız doğrulanmış olarak gösterildi.

Her gerçek dosya kontrolünde 40 cevap alanı, bir doğru cevap, 60 saniye duraklamanın dışlanması, yeniden açmada cevap ve 12 saniyenin korunması, 1,00 çalışma neti doğrulandı. Ayrıca eski bir manuel sonuç saklanarak yeniden açıldı: yanlış eski net kaynak doğrulanmış gibi gösterilmedi, kayıt kendiliğinden değiştirilmedi ve yalnız açık yeniden hesaplama ile doğru kaynak neti kaydedildi. Dış servise veri gövdeli gönderim sayısı 0 oldu. Bu test anahtarın 40 harfinin yeniden insan eliyle incelenmesi değildir; önceki kaynak doğrulamasını kullanır.

| Gerçek kitapçık | Yayıncı boyutu | SHA-256 | Masaüstü / mobil |
| --- | ---: | --- | --- |
| 2024 TYT | 5.439.411 bayt | `5b517eba3f596ed1e9d2073e84023696c40a1f6a2347d7db0aa8c20ece63b64e` | Geçti / geçti |
| 2024 AYT | 4.390.291 bayt | `6c6d14a245c13fd28f9461845e0d9d375709ed6dcbc9dfb10a2db3219742393b` | Geçti / geçti |

Korunan kitapçık baytları Git deposuna veya CI eklerine alınmaz. Soru metni, ekran görüntüsü, video veya iz yayımlanmaz; geçici tarayıcı bağlamları test sonunda kapatılır. Yayıncı dosyası sonradan değişirse CI sessizce yeni özet kabul etmez; yeniden inceleme gerekir.

## Sınırlar

2019 AYT tam anahtarı ve KPSS'nin tam nihai anahtarları hâlâ eksiktir. 2024 TYT/AYT dışındaki dosyaların yayıncı SHA-256 özetleri henüz katalogda yoktur. KPSS kısmi kaynak tam deneme gibi gösterilmez. İptal sonrası puanlama politikası desteklenmediği için iptalli iki sınav kapalıdır. Gerçek iOS/Safari/Android donanım testi yapılmadı; mobil Chrome görünümü emülasyonla denetlendi. Canlı Supabase hesabı ve gerçek AI model çağrısı test edilmedi. Özel kitapçık başına tek devam/sonuç kaydı vardır; çoklu girişim arşivi henüz yoktur.
