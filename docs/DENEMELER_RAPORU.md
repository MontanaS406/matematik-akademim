# Konu dağılımına göre denemeler — 15 Kasım 2026

Soru Çöz ekranındaki **Denemeler** düğmesi numaralı çalışma listesini açar. Dört ana menü, gece mavisi görünüm, altı öğretmen ve önceki kullanıcı kayıtları korunur. Yeni soru üretilmedi; mevcut 1.998 kullanılabilir AI sorusunun metinleri, seçenekleri ve cevapları değiştirilmedi.

## Dağılım ve kapsam

Kullanıcının paylaştığı görsellerin **2025 sütunu** esas alındı. Bu görseller bir konu planıdır; listelenen denemeler gerçek ÖSYM sınavı olarak sunulmaz.

| Liste | Deneme sayısı | Deneme başına | Kullanılan farklı soru |
| --- | ---: | ---: | ---: |
| TYT matematik + geometri | 140 | 36 / 40 hedef | 969 |
| AYT kısmi çalışma | 81 | 24 / 40 hedef | 989 |
| Toplam | 221 | — | 1.958 |

Son paylaşılan TYT geometri görseliyle hedef **30 matematik + 10 geometri** olarak güncellendi. Mevcut 20 geometri sorusunun metin ve çözümleri tek tek incelendi. 2025 kotasına göre her denemeye **4 açılar/üçgenler, 1 çokgen ve 1 kare** sorusu eklenir. **2 katı cisim, 1 yamuk ve 1 dikdörtgen** sorusu eksik olduğundan yeni TYT listesi **36/40 soruluk kısmi deneme** olarak gösterilir.

| TYT geometri konusu | 2025 hedefi | Mevcut uygun soru | Denemeye giren |
| --- | ---: | ---: | ---: |
| Açılar ve Üçgenler | 4 | 10 | 4 |
| Çokgenler | 1 | 4 | 1 |
| Kare | 1 | 1 | 1 |
| Katı Cisimler | 2 | 0 | 0 |
| Yamuk | 1 | 0 | 0 |
| Dikdörtgen | 1 | 0 | 0 |
| Analitik Geometri | 0 | 5 | 0 |

Grafik okuma, çember/daire ve eşkenar dörtgenin 2025 kotası da 0. Koordinat, öteleme ve kafes noktası becerisi ölçen 5 soru analitik olarak sınıflandı; kotayı doldurmak için üçgen diye etiketlenmedi. Bir kare sorusu ayrıca dikdörtgen sorusu olarak ikinci kez sayılmadı. Tam kimlik eşlemesi `shared/practice-exams.js` içindeki `TYT_GEOMETRY_TOPIC_BY_QUESTION` alanında kayıtlıdır.

AYT tablosunda 31 matematik ve 9 geometri sorusu var. Logaritma kotası **2**. Mevcut AYT havuzunda temel kavramlar, sayı basamakları, rasyonel sayılar, mantık, kümeler, basit eşitsizlikler ve mutlak değer için birer soru; ayrıca 9 geometri sorusu eksik. Bu 16 eksik, TYT sorularıyla veya başka konularla doldurulmadı. AYT listesi ve sonuç ekranı **24 soruluk kısmi deneme** bilgisini gösteriyor.

2025 dağılımına girmeyen 40 soru (22 TYT EBOB/EKOK, 5 TYT analitik geometri, 13 AYT karmaşık sayılar) tekli Soru Çöz bölümünde kullanılabilir durumda.

Konu havuzlarının büyüklükleri farklı. Bütün uygun soruları kullanmak için az bulunan konular farklı denemelerde dengeli olarak yeniden kullanılır. Aynı denemede yinelenen soru yoktur. Listede bu tekrar olasılığı açıkça yazılıdır. 221 deneme, birbirinden tamamen bağımsız 6.984 soru anlamına gelmez.

## Çözme ve kayıt

- Deneme numarasıyla arama, TYT/AYT seçimi ve kademeli listeleme.
- Soruyla birlikte optik cevap kâğıdı; önceki/sonraki soruya geçiş ve işareti kaldırma.
- Kronometre, duraklatma, devam etme ve yaklaşık beş saniyede bir ara kayıt.
- Yarım kalan denemeye dönüş; uygulama dışında geçen süre sayılmaz.
- Bitirmeden önce onay ve boş soru sayısı; sonuçta doğru, yanlış, boş, alıştırma neti ve açıklamalı çözümler.
- Tamamlananlarda ✓; **Bir daha çöz** yeni cevap kâğıdı açar, önceki sonucu silmez.
- İlerleme bölümünde deneme geçmişi ve sonuç ekranına dönüş.
- Eski 30 soruluk TYT denemeleri **Önceki denemelerim** bölümünde aynı soru sırası, cevap, süre ve sonuçla açılır; kaldığı yerden devam edilebilir ve tekrar çözülebilir. Eski kayıt, yeni 36 soruluk denemeye dönüştürülmez veya onun tamamlanma tikini oluşturmaz.
- Kayıt başarısızsa cevap, sonuç veya tamamlanma tiki kaydedilmiş gibi ilerlemez. Bozuk/eski kayıtlar silinmez. İki sekmede aynı denemenin eski kopyası yeni kaydın üzerine yazamaz.

Yeni kayıt anahtarı `ma_practice_exams_v1_<kullanıcı-kimliği>`; misafir alanı ayrıdır. Kayıtlar **bu tarayıcıda** kalır, başka cihaza eşitlenmez. Öğrenme profili, önceki deneme geçmişi, özel belge depoları ve Supabase üretim verileri değiştirilmez.

## Teknik korumalar

`shared/practice-exams.js` yalnızca mevcut uygunluk denetiminden geçen AI sorularını planlar. Konu eşleştirmesi soru verisini değiştirmez. Sıralama deterministiktir; her denemenin kimliği ve soru sırası doğrulanır. Puanlama geçersiz veya değişmiş cevap kâğıdında sonuç üretmez. Net, yalnızca bu alıştırmalar için `doğru − yanlış / 4` hesabıdır.

`data/practice-exams-v1.json` değiştirilmedi: önceki 221 denemenin kimliklerini ve soru sıralarını sabitler. Geometri eklenen TYT denemelerinin yeni kimlikleri `data/practice-exams-v2.json` ile sabitlenir. AYT kimlikleri ve soruları değişmez. Katalog, aktif 221 denemeye ek olarak eski 140 TYT tanımını kayıtları açmak için korur. Böylece eski cevaplar farklı sorulara bağlanmaz. Gelecekte havuz büyürken bu kontrol dosyalarını yeniden sıralayarak testi geçirmek yerine mevcut tanımlar korunmalı, yeni denemeler açık bir sürüm geçişiyle eklenmelidir.

## Doğrulama

- Önceki sürümün başlangıç kontrolü: `npm test`, 140/140.
- Güncel `npm test`: 144/144 geçti; eski denemelerin uyumluluğu, yeni geometri kotası ve v1/v2 kimlikleri doğrulandı.
- `npm run audit:ai-bank`: geçti; 1.998 kullanılabilir soruluk havuz ve önceki partiler korundu.
- Chromium masaüstü/mobil: 112/112 senaryo geçti. Konu/soru seçimi, optik, duraklatma/devam, sayfa yenileme, tamamlanma tiki, yeniden çözme, çözümler, hesap ayrımı, eski verinin korunması, depolama hataları ve sekme çakışmaları kapsanır. Geometri dağılımı ve v1 → v2 geçmiş uyumluluğu ayrıca sınandı.
- 320 piksel görünüm ayrıca incelendi; yatay taşma görülmedi.

## Kalanlar

Tam 40 soruluk TYT için 2 katı cisim, 1 yamuk ve 1 dikdörtgen sorusu; tam AYT için yukarıdaki 16 konu yuvasını karşılayan ayrı AYT düzeyinde doğrulanmış sorular gerekir. Bu değişiklikte yeni soru üretilmedi. Yeni deneme kayıtları için cihazlar arası bulut eşitlemesi bu değişikliğin kapsamında değildir.

Değişiklikler ayrı geliştirme dalında inceleme içindir; bu görevde main birleştirmesi veya canlı yayın yapılmadı.
