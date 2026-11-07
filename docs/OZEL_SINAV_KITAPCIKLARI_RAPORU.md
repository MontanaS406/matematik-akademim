# Özel Türkiye sınav kitapçıkları — geliştirme raporu

Tarih: **7 Kasım 2026**. PR #5'in `60dbf14` başlığı temel alındı. Önceki `07401ca`, `ffa22f4`, `60dbf14` commit'leri ve içerikleri korundu; tamamlanan 12 soruluk lisanslı katalog yeniden oluşturulmadı. Yeni çalışma ayrı `codex/ozel-sinav-kitapciklari` dalında yapıldı. Ana dala birleştirme, canlı yayın ve üretim veritabanı değişikliği yapılmadı.

## Gerçek soru ve kaynak sayımı

| Ölçü | Bu aşamadaki sonuç |
|---|---|
| Fiilen okunan tekil birincil belge | **66**: 44 HTML, 22 PDF |
| Önceki 42 belgeli rapora göre yeni belge | **53**; diğer 13 belge kitapçık/düzeltme kontrolü için tekrar açıldı |
| Yeni kamuya açık Türkçe soru metni/şekli/seçenekleri | **0**; yeniden yayım izni doğrulanamadı |
| Yeni gerçek kitapçık kimliği ve anahtar durumu kaydı | **15** TYT/AYT kitapçığı; soru metni değildir |
| İptalsiz tam matematik anahtarı | **13 × 40 cevap konumu**; dosya kimliği kullanıcı teyidi gerektirir |
| İptal nedeniyle neti kapalı kitapçık | **2**: 2019 TYT ve 2026 AYT |
| Önceki açık lisanslı katalog | 6 PDF kaynak kaydı, **12 İngilizce soru**, 5 konu; değişmedi |

Kaynak başına URL, belge bulguları, fiziksel PDF sayfaları ve doğrulama sınırları [Türkiye sınav araştırmasında](TURKIYE_SINAV_KAYNAKLARI.md) bulunur. 15 kayıt, uygulamaya 600 soru yayımlandığı anlamına gelmez. Soru kökleri, şekiller veya seçenekler kopyalanmadı. Telifli PDF dosyaları depoya eklenmedi. Soru sayısını artırmak için üretilmiş, yeniden yazılmış veya sayıları değiştirilmiş içerik kullanılmadı.

**Tam ve iptalsiz anahtarlar:** 2018 TYT/AYT, 2020 TYT/AYT, 2021 TYT/AYT, 2022 TYT, 2023 TYT, 2024 TYT/AYT, 2025 TYT/AYT, 2026 TYT. Kaynak kayıtlarında sınav, yıl, temel kitapçık kimliği, özgün matematik soru numaraları, cevaplar, kaynak/anahtar URL'leri ve düzeltme denetimi tutulur.

**İptaller:** 2019 TYT matematik 7'nin iptal konumu `null` olarak korunur; kalan 39 harf sıra kaydırılmadan kaydedilir. 2026 AYT matematik 23 için basılı C ve önceki A düzeltmesi son karar değildir; sonraki resmî iptal kanıtı saklanır. Desteklenen, doğrulanmış iptal puanlama politikası olmadan bu iki kitapçıkta otomatik veya manuel net üretilmez.

**Eksik TYT/AYT:** 2019 AYT, 2022 AYT ve 2023 AYT tam anahtarı/sayfa bilgileri resmî PDF erişimi başarısız olduğundan doğrulanmadı; başka sitenin dizisiyle veya tahminle tamamlanmadı.

**KPSS, ALES, DGS:** 2026 KPSS Ön Lisans, ALES/2 ve DGS'nin gerçek %10 PDF'leri incelendi. Kısmi kapsam, belirsiz numara/cevap eşleşmeleri ve tamamlanmamış düzeltme kontrolü nedeniyle tam sınav anahtarı açılmadı. KPSS Ön Lisans/Ortaöğretim, ALES, DGS, MEB ve diğer gerçek kaynak türleri özel PDF olarak kullanılabilir; bu destek, tam resmî anahtar doğrulaması iddiası değildir. KPSS Lisans ayrı bir tür olarak henüz eklenmedi.

**MEB/yayınevleri:** MEB ÖDSGM, OGM materyalleri, Rehber Matematik, ÖZDEBİR, 3D, TÖDER, Tudem ve Üç Dört Beş belgeleri incelendi. Kişisel indirme, ücretsiz erişim veya cevap anahtarı yayını üçüncü tarafın soru çoğaltma izni sayılmadı. Hak sahiplerine mesaj gönderilmedi veya izin sözleşmesi yapılmadı.

## Çalışan özel kitapçık akışı

Ana ekrandaki **Türkiye sınav kitapçığımı cihazımda çöz** düğmesi özel kitaplığı açar. Kullanıcı, kendi edindiği gerçek kaynak PDF'sini seçer; bilinen kitapçık kaydını seçebilir veya sınav/yıl/kaynak adresi/soru sayısı bilgisini kendisi belirtir. Kaynağı kullanıcı tarafından yazılan bir dosya bağımsız doğrulanmış olarak sunulmaz.

- PDF'nin soru, şekil ve seçenekleri özgün sayfada görüntülenir; optik cevap alanları aynı uygulama ekranındadır. Masaüstünde yan yana, telefonda alt alta görünür. Yeni seçenek metni üretilmez.
- Özgün soru numaraları korunur. Örneğin kısmi kitapçık `1,5,11,15,43` olarak işaretlenebilir; tam 1–50 sınavı gibi gösterilmez. Her sayı için A–E cevap alanı vardır.
- Fiziksel PDF sayfasına gitme, tam ekran, kullanıcı tarafından soru–sayfa eşleştirmesi, önceki/sonraki soru, sonra çöz işareti ve konu etiketi bulunur. Eşleştirilmemiş soruya tahmini PDF sayfası atanmaz.
- Kronometre, isteğe bağlı süre sınırı, duraklat/devam et, otomatik ara kayıt ve kaldığı yerden açma çalışır. Standart deneme ile özel çalışma birbirini duraklatır; iki özel PDF arasında geçiş de önceki çalışmayı duraklatır.
- Bitirme sonrasında doğru/yanlış/boş, çalışma neti, yanlış/boş cevap incelemesi ve kullanıcının etiketlediği konuların analizi gösterilir. Kaynaktan doğrulanmış konu sınıflandırması yapıldığı iddia edilmez.
- PDF en fazla 50 MB, anahtar dosyası en fazla 16 KB'dir. PDF imzası ve alan sınırları denetlenir; içerik PDF MIME türüyle açılır. Aynı dosya aynı hesapta SHA-256 ile yinelenmez.

## Anahtar güvenilirliği

İncelenen resmî anahtar **dosya adına bakılarak otomatik uygulanmaz**. Kullanıcı sınav, yıl, temel kitapçık ve sıra eşleşmesini ayrıca işaretleyip anahtarı bağlamalıdır. Adaya özel kitapçığın soru/seçenek sırası temel kitapçıktan farklı olabilir. Hesaplanan değer `doğru − yanlış/4` çalışma netidir; ÖSYM sınav, yerleştirme veya iptal sonrası ölçekli puanı değildir.

Kaynak PDF'lerinin ham baytları alınamadığından gerçek yayıncı dosyaları için SHA-256 özeti henüz yoktur. Yerelde hesaplanan dosya özeti yalnız dosyayı tanımlar; doğrulanmış yayıncı özetiyle eşleşmiş sayılmaz. Arayüz **anahtar kaynağı doğrulandı / PDF kimliği kullanıcı teyidine dayanıyor** ayrımını açıkça gösterir. Gelecekte bilinen bir yayıncı özeti varsa uyuşmazlık kullanıcı onayıyla geçilemez.

Bilinmeyen veya eksik anahtarla bitirilen çalışma **Puanlanmadı** kalır. Kullanıcının yazdığı ya da TXT/JSON'dan aktardığı anahtar ancak ayrı **Kendi anahtarımla manuel hesapla** işlemiyle net üretir; resmî sayılmaz. JSON içindeki `verified:true` veya `provenance` iddiası kabul edilmez. İptalli iki bilinen sınavda manuel anahtar da kapalıdır.

## Kayıtlar ve gizlilik

Özel PDF, kullanıcı anahtarı, cevaplar, süre, sonuç ve konu etiketleri yeni bir IndexedDB deposunda hesap kimliği altında tutulur. **Supabase'e, AI Worker'a veya herkese açık bankaya gönderilmez.** Misafir ve her hesap ayrı kitaplık görür. Hesap değişince önceki PDF nesne adresi kaldırılır ve ekran temizlenir; geciken yazmalar doğru eski hesap/kitapçık kimliğine bağlı kalır.

Bu, aynı tarayıcı origin'i içinde mantıksal hesap ayrımıdır; cihaz şifrelemesi veya paylaşılan cihazdaki geliştirici araçlarına karşı koruma değildir. Tarayıcı verileri temizlenirse yerel dosyalar kaybolabilir. Cevap/anahtar/ilerleme JSON yedeği ve PDF indirme düğmeleri kullanıcı eylemiyle çalışır; JSON yedeği PDF içermez. Yedeği geri yükleme arayüzü ve cihazlar arası özel dosya eşitlemesi henüz yoktur.

Eski Supabase kullanıcıları, öğrenme profilleri, deneme geçmişi, yerel PDF önbelleği, altı öğretmen ve 27 konu anlatımı korunur. Var olan tablo veya üretim verisi silinmedi; yeni şema/seed üretime uygulanmadı. Özel PDF sorusunu AI'ya gönderme eklenmedi. Önceki kaynaklı soru seçimine bağlı AI öğretmen akışı devam eder.

## Doğrulama ve kalan işler

Yerel doğrulama: **`npm test` 70/70**, masaüstü/mobil Chromium **98/98** geçti. `npm run audit:questions` 6 kaynak, 12 izinli soru ve 5 konu raporladı. `npm audit --audit-level=high` 0 açık buldu; `git diff --check` geçti. GitHub Actions'ın son durumu PR #5 üzerinde izlenebilir. Testlerde kullanılan yapay PDF yalnız boş düzen/güvenlik belgesidir; ürün soru bankasında bulunmaz ve sınav sorusu olarak sunulmaz.

- Otomatik kontroller: Node modelleri, PGlite üzerinde mevcut RLS/kayıt regresyonları, katalog/iptal denetimi, masaüstü ve mobil Chromium testleri.
- Tarayıcı testleri gerçek yerel PDF görüntüleyicinin başarı durumunu, cihazdan aktarımı, dosya/anahtarın HTTP isteğine taşınmamasını, misafir–hesap ayrımını, yeniden yüklemede devam etmeyi, duraklatmayı, açık kitapçık teyidini, manuel anahtarın otomatik puanlanmamasını, iptalleri, XSS/MIME sınırını ve yanlış/konu incelemesini kapsar.
- Canlı Supabase hesabıyla kayıt/giriş ve gerçek AI/model çağrısı yapılmadı; bu sonuçlar sahte servis ve yerel veritabanı kontrollerinin yerine geçirilmez.
- Safari/iOS/Android üzerinde gerçek cihaz PDF görüntüleyicisi denenmedi. Yerleşik PDF desteği olmayan tarayıcıda PDF'yi cihazına indirme seçeneği vardır; uygulama içinde bağımsız PDF.js görüntüleyicisi henüz eklenmedi.
- Özel kitapçık başına tek devam/sonuç kaydı vardır. Yeniden deneme arşivi, çoklu girişim karşılaştırması ve özel sonuçları Supabase'e eşitleme henüz yoktur; eski standart deneme geçmişi değişmedi.
- Native PDF görüntüleyicisi içinde elle değiştirilen sayfa uygulama tarafından okunamaz; yalnız uygulamanın sayfa alanıyla yapılan eşleştirme kaydedilir.
- İzinli Türkçe soru metni bulma, eksik üç AYT anahtarını okuma, KPSS/ALES/DGS için tam ve nihai anahtar edinme, tüm soruları kaynaktan konuya göre sınıflandırma ve iptal sonrası puanlama politikası açık işlerdir. Eksikler uydurma içerikle kapatılmadı.
