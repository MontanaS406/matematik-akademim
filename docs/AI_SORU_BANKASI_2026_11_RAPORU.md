# AI soru bankası entegrasyonu — 13 Kasım 2026

Kullanıcının ZIP arşivi içe aktarıldı; erişilebilir AI metinlerinden yeni TYT/AYT
alıştırmaları oluşturuldu. AI, özgün kaynak indeksi ve ÖSYM havuzları ayrı tutuldu.
Yayın, ilk PR aşamasından sonra kullanıcının son mesajındaki açık isteğine göre
hazırlanır. Üretim Supabase verisi veya şeması üzerinde işlem yapılmadı.

## Son sayılar

| Ölçüm | Kayıt |
|---|---:|
| Mevcut AI arşivi — tamamı korundu | 1.165 |
| Yeni üretilen TYT | 630 |
| Yeni üretilen AYT | 676 |
| Toplam inceleme kataloğu | 2.471 |
| Matematik kontrolünden geçen — tekrarlar dahil | 2.461 |
| Matematik kontrolü geçmeyen | 10 |
| İnceleme bekleyen benzersiz kayıt — tekrarlar hariç | 47 |
| Tekrar/çok benzer kalıp nedeniyle dışlanan | 1.016 |
| **Kullanılabilir benzersiz soru** | **1.408** |

Kullanılabilir havuz: **216 içe aktarılan + 627 yeni TYT + 565 yeni AYT**.
Sınav dağılımı **736 TYT / 672 AYT**; seviye dağılımı **379 kolay / 681 orta /
348 zor**. 22 müfredat konu kimliğinde içerik vardır. Kesin makine raporu:
[bank-summary.json](../data/ai/bank-summary.json).

İçe aktarılan 1.165 soruda iki bağımsız çözüm yöntemiyle 1.155 matematik sonucu
doğrulandı. 10 sorudaki aralık uçlarının dahil olup olmadığı belirsizdir.
249 kaydın sınav düzeyi sınıflandırması ayrıca bekletildi; bunların 10'u AYT
etiketi taşıyan temel üçgen açı toplamı sorularıdır. Tekrarlarla örtüşen kayıtlar
ikinci kez “benzersiz inceleme” sayılmadığından bu sayılar 47'ye doğrudan eklenmez.

Yeni 1.306 sorunun tamamı bağımsız matematik denetiminden geçti. Önce 87 benzer
metin kalıbı, ardından kaynaklar arası ve sembolik görev benzerlikleri denetlendi.
1.016 dışlamanın 985'i aynı metin/sayısal kalıp, 5'i bağımsız tekrar raporu,
26'sı aynı sembolik görev için temkinli inceleme karantinasıdır. Benzerlik
algoritması farklı temsilleri de dışlayabilir; bütün semantik tekrarların
kesin olarak bulunduğu iddia edilmez. Hiçbir arşiv kaydı silinmedi.

## Üretim kapsamı ve sınırları

TYT'de 67 kaynak kalıbının becerileri 61 yeni aileyle kapsandı: 57 ailede 10'ar,
4 sayma/olasılık ailesinde 15'er farklı kurgu. AYT'de uygun 52 kaynak kalıbı için
13'er kurgu yazıldı; TYT düzeyindeki üçgen ailesi AYT olarak çoğaltılmadı.
Sayıların otomatik döndürülmesiyle 11.650 satıra ulaşılmadı. **Her 1.165 kayıttan
10 yeni soru üretme hedefinin tamamı karşılanmadı**; aynı kalıbın sayısal
varyantları tek beceri grubu olarak işlendi. Sonraki çalışmada yeni kurgu ve
bağımsız doğrulama eklenebilir; bu teslimin sayıları yukarıdaki kadardır.

Kitaplık klasörüne doğrudan erişim yoktu; ekli ZIP kullanıldı. Asıl yayıncı
kitapçıkları ZIP'te bulunmuyordu. 8 kaynak, 185 sayfa aralığı ve 480 sınav soru
konumu yalnızca indekstir; özgün soru gövdesi veya doğrulanmış cevap anahtarı
değildir. **Eklenen özgün/ÖSYM soru sayısı 0**. Telifli kitapçık ve görseller
depoya kopyalanmadı; görülmeyen sayfalardan soru türetildiği söylenmedi.

Yeni soruların ebeveyn kimliği, metni gerçekten erişilebilir olan AI kaydına
bağlanır. Kaynak indeksindeki yayıncı adı, AI sorusunu o yayının veya ÖSYM'nin
gerçek sorusu yapmaz. İnsan editör onayı verilmedi; bütün AI sorularında bu
inceleme durumu korunur. Zorluk seviyeleri gerekçeli otomatik önerilerdir.

## Uygulama ve veri koruması

- Dört gece mavisi menü ve altı öğretmen korundu. Dosya yükleme ekranı eklenmedi.
- Konu, alt konu, TYT/AYT, seviye ve içe aktarılan/yeni AI filtreleri çalışır.
  Teknik şablon adları Türkçe alt konu adlarına dönüştürüldü.
- Ekranda tek soru ve A–E seçenekleri gösterilir. Açık cevap kontrolünden sonra
  doğru cevap ve açıklamalı çözüm açılır. Doğru/yanlış öğretmen tepkileri korunur.
- AI alıştırmaları resmî sınav, resmî çözüm veya net sonucu olarak gösterilmez.
  Öğretmen yardımı konunun ders bağlamını kullanır; AI kimliği gerçek kaynak
  sorusu gibi sunucuya gönderilmez.
- Hesap kapsamlı ilerleme kaydı, eski deneme geçmişi, eski soru kimlikli
  denemeler ve cihazdaki özel kayıtlar korunur. Konuk ve hesap cevapları ayrıdır.
- 26 parti manifesti, 647 TYT + 518 AYT kaynak kaydı, sabit kimlikler ve
  içerik özetleri yeniden üretimi izlenebilir kılar. Değişmeyen aşamalar yeniden
  kullanılabilir; temiz ortamda aynı katalog yeniden kurulabilir.
- Denetim raporları hem girdi dosyasının hem doğrulayıcı kodunun SHA-256
  özetlerine bağlandı. Soru veya anahtar aynı kimlikle değiştirilirse eski
  denetim raporuyla onaylanamaz.

## Kontroller

- Başlangıç: 90 mevcut birim testi geçti.
- Son uygulama: **103 birim testi, 70 masaüstü/telefon E2E testi** geçti.
- GitHub Pages `/matematik-akademim/` alt yolunda **2 ek tarayıcı kontrolü**
  geçti: soru, AYT/zor/yeni filtreleri, cevap, çözüm, dosya yolları ve taşma.
- Soru denetleyicilerinin hatalı anahtar, eşdeğer iki şık, eksik koşul,
  desteklenmeyen işlem, zararlı ifade ve eski rapor negatif kontrolleri geçti.
- Önbellek atlanarak tüm üretim/denetim tekrar çalıştırılır; statik çıktıların
  birebir eşleşmesi `--check --force` ile doğrulanır. CI aynı denetimi uygular.
- Supabase hesap/RLS ve AI servis testleri yerel veya taklit servislerle yapıldı.
  Gerçek kullanıcı hesabıyla üretim Supabase/ücretli öğretmen API testi yapılmış
  gibi raporlanmaz.

## Değişiklik grupları

`data/ai/` arşiv, statik sorular, Türkçe etiketler ve denetim kayıtları;
`data/ai-bank.js` ayrı AI kataloğu; `shared/ai-bank.js` uygunluk kapısı;
`scripts/generation/` üretim; `scripts/*audit*`, `verify-generated-bank.py`,
`build-ai-bank.py`, `ai-bank-pipeline.py` bağımsız kontrol ve yeniden derleme;
`js/app.js`, `js/exams.js`, `styles/platform.css` soru ve ilerleme arayüzü;
`tests/` ve GitHub Actions iş akışı doğrulama kapsamıdır.

İnsan editör incelemesi, kalan belirsiz/sınıflandırma kayıtları, bütün müfredatın
yeni soru kapsamı ve erişilmeyen özgün kitapçık içerikleri tamamlanmış değildir.
Yayın SHA'sı, PR ve GitHub Pages çalışmasının sonucu teslim mesajında ayrıca
belirtilir; matematik manifestine değişken yayın durumu yazılmaz.
