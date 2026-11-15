# Konu dağılımına göre denemeler — 15 Kasım 2026

Soru Çöz ekranındaki **Denemeler** düğmesi numaralı çalışma listesini açar. Dört ana menü, gece mavisi görünüm, altı öğretmen ve önceki kullanıcı kayıtları korunur. Yeni soru üretilmedi; mevcut 1.998 kullanılabilir AI sorusunun metinleri, seçenekleri ve cevapları değiştirilmedi.

## Dağılım ve kapsam

Kullanıcının paylaştığı görsellerin **2025 sütunu** esas alındı. Bu görseller bir konu planıdır; listelenen denemeler gerçek ÖSYM sınavı olarak sunulmaz.

| Liste | Deneme sayısı | Deneme başına | Kullanılan farklı soru |
| --- | ---: | ---: | ---: |
| TYT matematik | 140 | 30 | 954 |
| AYT kısmi çalışma | 81 | 24 / 40 hedef | 989 |
| Toplam | 221 | — | 1.943 |

TYT görseli geometri içermiyor. Bu nedenle TYT listesi 30 matematik sorusudur; 40 soruluk tam sınav diye gösterilmez.

AYT tablosunda 31 matematik ve 9 geometri sorusu var. Logaritma kotası **2**. Mevcut AYT havuzunda temel kavramlar, sayı basamakları, rasyonel sayılar, mantık, kümeler, basit eşitsizlikler ve mutlak değer için birer soru; ayrıca 9 geometri sorusu eksik. Bu 16 eksik, TYT sorularıyla veya başka konularla doldurulmadı. AYT listesi ve sonuç ekranı **24 soruluk kısmi deneme** bilgisini gösteriyor.

2025 dağılımına girmeyen 55 soru (22 TYT EBOB/EKOK, 20 TYT geometri, 13 AYT karmaşık sayılar) tekli Soru Çöz bölümünde kullanılabilir durumda.

Konu havuzlarının büyüklükleri farklı. Bütün uygun soruları kullanmak için az bulunan konular farklı denemelerde dengeli olarak yeniden kullanılır. Aynı denemede yinelenen soru yoktur. Listede bu tekrar olasılığı açıkça yazılıdır. 221 deneme, birbirinden tamamen bağımsız 6.144 soru anlamına gelmez.

## Çözme ve kayıt

- Deneme numarasıyla arama, TYT/AYT seçimi ve kademeli listeleme.
- Soruyla birlikte optik cevap kâğıdı; önceki/sonraki soruya geçiş ve işareti kaldırma.
- Kronometre, duraklatma, devam etme ve yaklaşık beş saniyede bir ara kayıt.
- Yarım kalan denemeye dönüş; uygulama dışında geçen süre sayılmaz.
- Bitirmeden önce onay ve boş soru sayısı; sonuçta doğru, yanlış, boş, alıştırma neti ve açıklamalı çözümler.
- Tamamlananlarda ✓; **Bir daha çöz** yeni cevap kâğıdı açar, önceki sonucu silmez.
- İlerleme bölümünde deneme geçmişi ve sonuç ekranına dönüş.
- Kayıt başarısızsa cevap, sonuç veya tamamlanma tiki kaydedilmiş gibi ilerlemez. Bozuk/eski kayıtlar silinmez. İki sekmede aynı denemenin eski kopyası yeni kaydın üzerine yazamaz.

Yeni kayıt anahtarı `ma_practice_exams_v1_<kullanıcı-kimliği>`; misafir alanı ayrıdır. Kayıtlar **bu tarayıcıda** kalır, başka cihaza eşitlenmez. Öğrenme profili, önceki deneme geçmişi, özel belge depoları ve Supabase üretim verileri değiştirilmez.

## Teknik korumalar

`shared/practice-exams.js` yalnızca mevcut uygunluk denetiminden geçen AI sorularını planlar. Konu eşleştirmesi soru verisini değiştirmez. Sıralama deterministiktir; her denemenin kimliği ve soru sırası doğrulanır. Puanlama geçersiz veya değişmiş cevap kâğıdında sonuç üretmez. Net, yalnızca bu alıştırmalar için `doğru − yanlış / 4` hesabıdır.

`data/practice-exams-v1.json` 221 denemenin kimliklerini ve soru sıralarını sabitler. Gelecekte havuza soru eklenirken mevcut numaralar yeniden üretilmemeli; eski manifestler korunup yeni denemeler sona eklenmelidir. Kontrol dosyasını yeni sıralamayla değiştirerek testin kabul edilmesi bir geçiş yöntemi değildir. Kullanımdan çekilen soru varsa eski cevaplar başka soruya bağlanmamalı; ilgili kayıt saklanmalıdır.

## Doğrulama

- `npm test`: 140 test geçti.
- `npm run audit:ai-bank`: geçti; 1.998 kullanılabilir soruluk havuz ve önceki partiler korundu.
- Chromium'da 108 tarayıcı senaryosu doğrulandı: 90 mevcut ve 18 yeni masaüstü/mobil kontrol. Yeni deneme senaryoları konu/soru seçimi, optik, duraklatma/devam, sayfa yenileme, tamamlanma tiki, yeniden çözme, çözümler, hesap ayrımı, eski verinin korunması, depolama hataları ve sekme çakışmalarını kapsar. Tam çalıştırmada geçen 106 senaryoya ek olarak, yeni ilerleme sayacına uyarlanan iki test yeniden çalıştırılıp geçti.
- 320 piksel görünüm ayrıca incelendi; yatay taşma görülmedi.

## Kalanlar

Tam 40 soruluk AYT için yukarıdaki 16 konu yuvasını karşılayan, ayrı AYT düzeyinde doğrulanmış sorular gerekir. TYT geometri dağılımı paylaşılmadığı için bu listede geometri eklenmedi. Yeni deneme kayıtları için cihazlar arası bulut eşitlemesi bu değişikliğin kapsamında değildir.

Değişiklikler ayrı geliştirme dalında inceleme içindir; bu görevde main birleştirmesi veya canlı yayın yapılmadı.
