# Kişisel orijinal soru arşivi — 15 Kasım 2026

Önceki uygulama, gönderilen kaynaklardan çıkarılmış bütün orijinalleri göstermiyor; denemeleri 1.998 soruluk AI havuzundan oluşturuyordu. Bu değişiklik, kullanıcıya ait gönderilmiş arşivi doğrudan uygulamada açar. Yeniden dosya seçme/yükleme akışı yoktur. AI bankası ve özgün içerikler ayrı kalır; yeni AI sorusu üretilmedi.

## Uygulamaya alınan kapsam

| Kapsam | Sayı |
| --- | ---: |
| Gerçek kaynak dosyası | 220 |
| Kaynakların tüm fiziksel sayfaları | 3.022 |
| Başlangıç soru/bölge kaydı | 12.725 |
| Kesin tekrar olarak ayrı tutulan | 9 |
| Gezilebilir soru/bölge kaydı | 12.716 |
| Bağımsız matematik kontrolü geçmiş orijinal | 92 |
| İnceleme durumunda kalan kayıt | 12.624 |
| Cevap değeri bulunan kayıt | 3.060 |
| Özgün 40 soruluk TYT denemesi | 12 |

Bu sayılar kaynak envanterinden ve gerçekten işlenmiş özel bankadan gelir. 12.716, kusursuz ayrılmış ve tamamı matematiksel olarak doğrulanmış benzersiz soru iddiası değildir. OCR, ön konu etiketleri, açık uçlu örnekler ve belirsiz soru numaraları inceleme durumlarını korur. Cevap değeri bulunması bağımsız doğrulama sayılmaz. Kayıtlar bu durumlar nedeniyle silinmez veya görünmez yapılmaz.

220 kaynağın **bütün sayfaları** korunur. Her soru kaydında özgün şekil/seçenek yerleşimi görüntüden gösterilir. Çok parçalı kayıtta parçalar sırayla birleştirilir. Kırpımın sınırı belirsiz veya yetersizse asıl sayfa aynı uygulamada açılır; Kaynaklar bölümünden bütün sayfalar gezilebilir. Bu nedenle otomatik soru bölütlemesinin kaçırdığı içerik, kaynak görünümünde erişilebilir kalır. Şık veya şekil uydurulmaz. Özgün dosyalar çalışma alanında ayrıca korunur; sitedeki görüntüler bunların sayfa render'larıdır, orijinal dosyanın bayt özdeş kopyası olduğu iddia edilmez.

## Gerçek TYT denemeleri

`Orijinal_TYT_Deneme_01_40_Soru` ile `12` arasındaki 12 kaynakta ayrı ayrı 1–40 soru sırası doğrulandı. Hepsinin kaydedilmiş cevabı, sağlanan ayrı yayınevi anahtarındaki aynı deneme/soru satırıyla eşleşti. Bu **480 kaynak sorusudur**; AI ile oluşturulmuş deneme değildir. Kaynaklar Orijinal Yayınları hazırlık denemeleridir; ÖSYM çıkmış sınavı olarak etiketlenmez.

Örnek: birinci denemede fiziksel sayfa 13/soru 34 dikdörtgen, sayfa 14/soru 37 yamuk, sayfa 15/soru 39–40 katı cisimler içerir. Önceki AI dağılımındaki eksik bu kaynaklarda soru olmadığı anlamına gelmiyordu.

Denemede soru ve şekil, A–E işaretleme, 40 soruluk optik, süre, duraklatma/devam, ara kayıt, bitirme ve geçmiş vardır. Yeniden çözme yeni kayıt oluşturur; eski sonuç silinmez. Anahtarın özgün sayfası sonuç ekranından açılır. Net `doğru − yanlış/4` ile **yayınevi anahtarına göre alıştırma sonucu** olarak gösterilir. Bütün 480 sorunun bağımsız matematik kontrolü tamamlanmış değildir; uygulama bu ayrımı bildirir. Anahtarın kaynağı/soru sırası eşleşmezse puan üretilmez. Tekli, kontrol edilmemiş kayıtta cevabın bağımsız doğrulanmadığı belirtilir; doğru/yanlış onayı verilmez.

## Kişisel erişim ve veri koruma

Bu işin kullanıcı talimatı kişisel kullanım içindir. Açık depoya özgün metinler veya okunabilir sayfa görüntüleri eklenmez. Sayfalar ve indeks ayrı kaynak kimliğine bağlı AES-256-GCM ile korunur. Her dosyada farklı rastgele nonce, kaynakla ilişkili doğrulama verisi ve SHA-256 bütünlük kontrolü vardır. Anahtar üretim Supabase anahtarı veya servis sırrı değildir; yalnız bu kişisel arşivin erişim anahtarıdır ve **depoya eklenmez**.

Kişisel bağlantının adres parçası sunucuya gönderilmez; uygulama anahtarı aldıktan sonra adresi temizler. Kaynak istekleri aynı uygulamadan gelir ve anahtarı içermez. Anahtar yalnız sekmenin hesap kapsamlı `sessionStorage` alanındadır. Kilitleme ve hesap değişimi anahtarı, görüntüleri ve bellekte açılan kataloğu temizler. Yanlış anahtar, farklı dosya veya değiştirilmiş içerik açılmaz. Varsayılan genel ziyaretçi kişisel soruları göremez.

Yeni yerel kayıtlar `ma_original_exams_v1_<hesap>` ve `ma_original_practice_v1_<hesap>` alanlarında tutulur. Var olan `ma_learning_v1_*`, AI denemesi, eski deneme geçmişi ve cihaz belgesi depoları değişmez. Supabase üretim şeması/verisi değiştirilmez. Kayıt başarısızlığında kaydedilmiş gibi ilerlenmez; bozuk eski kayıtların üzerine yazılmaz. Diğer sekmenin daha yeni cevap kâğıdı korunur.

## Paketleme ve devam kaydı

`scripts/build-personal-archive.py`, gerçek kaynak SHA'larını ve sayfa sayılarını denetler; tüm sayfaları en fazla 2× ölçek ve 2.200 piksel uzun kenarda render eder. Render piksel verisi kayıpsız WebP olarak saklanır; formül/şekil OCR ile yeniden çizilmez. Görüntü büyütme ve uygulama içi kaydırma vardır. Kaynakların tamamı açılışta indirilmez; yalnız indeks ve seçilen sayfalar alınır.

Tamamlanan kaynaklar `work/personal-…-progress.json` içinde dosya hash'leriyle kaydedilir. Girdi değişmediyse sayfalar yeniden oluşturulmaz. Aynı indeksin mevcut şifreli çıktısı da korunur. Anahtar, teslim bağlantısı ve özel düz metin indeks `private/` altında kalır. Açık config yalnız kapsam ve şifreli dosya adresini içerir. Eski özel arşivler silinmedi.

## Doğrulama

- Gerçek 220 kaynak ve 3.022 sayfa için çıktı mevcut; otomatik test her sayfa dosyasının bulunduğunu ve şifreli biçimde olduğunu denetler.
- Gerçek özel indeksin 12.716 kaydı ve 12 denemesi şema kontrolünden geçti.
- Gerçek kişisel arşiv Chromium'da açıldı; birinci TYT'nin 40. sorusu özgün şekil ve seçenekleriyle 390 piksel görünümde görüntülendi. Yatay taşma veya tarayıcı hatası görülmedi.
- Kripto testleri doğru/yanlış anahtar, içerik değişikliği, farklı kaynak, yol kaçışı, kayıt kimliği/anahtar eşleşmesi ve onaylanmamış cevap durumlarını sınar.
- Tarayıcı testleri anahtarın adres/isteklerden temizlenmesi, kaynak görünümü, büyütme, 40 optik, süre, yenileme, bitirme, tekrar, ilerleme, hesap değiştirme ve havuzlar arasında duraklamayı sınar.
- Yerel `npm test`: 147/147 geçti. Toplam 126 tarayıcı senaryosu doğrulandı: 112 mevcut kontrol ve 14 kişisel arşiv kontrolü. Son GitHub kontrolü aynı kapsamın tamamını yeniden çalıştırır.

## Tamamlanmamış incelemeler

12.624 kaydın soru düzeyinde transkripsiyon, konu/alt konu, beş seçenek ve bağımsız matematik incelemesi tamamlanmadı. Bu içerikler özgün sayfalarıyla erişilebilir; tamamlanmış/doğrulanmış diye gösterilmez. Bu paket ayrı bir 40 soruluk AYT kitapçığını yoktan oluşturmaz; sağlanan AYT/ortak kaynak soruları arşivde gezilebilir. Önceki 1.998 AI sorusu ve 30/36 soruluk deneme kayıtları aynen korunur.
