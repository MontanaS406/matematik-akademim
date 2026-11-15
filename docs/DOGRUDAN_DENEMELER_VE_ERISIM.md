# Doğrudan denemeler ve yönetici onayı — 15 Kasım 2026

Onaylı öğrenci, **Soru Çöz → TYT / AYT Denemeler** üzerinden numaralı seti
seçer. Ayrı arşiv açma, erişim anahtarı girme, kişisel bağlantı veya dosya
yükleme adımı kaldırıldı. Dört gece mavisi menü ve altı öğretmen korundu.

## Hazır içerik

| Kapsam | Sayı / durum |
| --- | --- |
| Özgün yayınevi TYT denemesi | 12 × 40 soru; mevcut sıra ve kimlikler korunur |
| Kaynaklardan derlenen AYT çalışma denemesi | 12 × 40 soru; 31 matematik + 9 geometri |
| AYT'de kullanılan farklı kaynak soru kimliği | 159 |
| AYT için soru/şekil/şık/anahtarı incelenen aday | 161 |
| TYT ve AYT listelerinde kullanılan farklı orijinal kimlik | 638 |
| Korunan kaynak / fiziksel sayfa | 220 / 3.022 |
| Korunan gezilebilir soru/bölge kaydı | 12.716 |
| Bağımsız matematik kontrolü geçmiş orijinal kayıt | 201 |
| Genel kaynak havuzunda inceleme bekleyen kayıt | 12.515 |
| Korunan kullanılabilir AI alıştırması | 1.998; bu değişiklikte yeni üretim yok |

AYT setleri, gönderilen gerçek kaynakların sorularını değiştirmeden bir araya
getirir; özgün bir yayınevi denemesi veya ÖSYM çıkmış sınavı değildir.
Paylaşılan 2025 konu tablosunun 31+9 kotası her sette tamdır. Kaynağın özgün
TYT/AYT/ortak etiketi korunur; ortak ön bilgiler ve geometri için AYT uyumluluk
incelemesi ayrı kaydedilir. Bazı konuların havuzu küçüktür; sorular farklı
denemelerde tekrar edebilir. Aynı sette 40 farklı kimlik bulunur.

Gerçek kaynaklar sayfalarıyla okundu. Örnekler: Orijinal Geometri 320–335
dosyasında fiziksel 1/basılı 320/Test 1/soru 1 noktanın analitiği;
336–359 dosyasında fiziksel 1/basılı 336/Test 1 doğrular; 376–394 dosyasında
fiziksel 1/basılı 376/soru 1 çemberin analitiği. Özgün şekiller ve A–E seçenekleri
görüntüde korunur. Yayıncı anahtarı, doğru test başlığı/soru numarası ve fiziksel
sayfa ile eşleştirilir; numarası sıfırlanan başka testin satırı kullanılmaz.

Kırpımlar soruyu, şekli ve beş şıkkı içerir. MEB örneklerinde basılı Çözüm/Cevap
bölümü denemede gösterilmez; geometri sayfalarının cevap altbilgisi kesilir.
Derlenmiş deneme sırasında tam kaynak/anahtar sayfası açılmaz; bitirdikten sonra
her sorunun kaynak anahtarı ve kayıtlı çözümü incelenebilir.

## İşleyiş ve kayıtlar

40 soruluk optik, A–E işaretleme, süre, duraklatma/devam, yenilemeden sonra
devam, bitirme, net, tamamlanma tiki, sonuç inceleme ve tekrar çözme çalışır.
Tekrar yeni deneme kimliği oluşturur; önceki sonuç korunur. AYT/TYT geçmişi
İlerleme'de doğru sınav ailesiyle açılır. Kaynak anahtarına göre net
`doğru − yanlış/4` olarak hesaplanır; resmî ÖSYM sonucu denmez. Anahtarın soru
eşleşmesi geçersizse puanlama yapılmaz. Bütün havuzun matematik onayı olduğu
iddia edilmez; 201 kontrol edilmiş kayıt ile 12.515 inceleme kaydı ayrıdır.

AI dosyaları, 1.408 eski AI kaydının bütünlüğü, toplam 1.998 kullanılabilir
alıştırma, Supabase kullanıcıları, öğrenme profilleri ve eski geçmişler korunur.
Yeni orijinal cevap/deneme kayıtları hesap kapsamlı ayrı yerel anahtarlardadır.
Cihazlar arası yeni deneme eşitlemesi bu değişikliğin kapsamında tamamlanmadı.

## Hesap erişimi

`supabase/source-access.sql` yalnız yeni özel şema, iki tablo ve beş RPC ekler.
Eski tablo/politika/veriyi silmez veya değiştirmez; bir kurulum çakışmasında
işlemi geri alır. Kurulmamış hizmet kaynakları açmaz.

- Yönetici adresi ve gerçek arşiv anahtarı **özel kurulumda** sağlanır; açık
  GitHub kodunda bulunmaz. Doğrulanmış yönetici hesabı bir kez UUID'ye bağlanır.
- Kimlik ve e-posta doğrulaması sunucudaki `auth.users` kaydından gelir.
  İstemcideki e-posta/rol, kullanıcı metadata'sı veya eski adres anahtarı yetki
  vermez. Yeniden kaydolmuş farklı UUID eski izni devralmaz.
- Yeni öğrenci erişim isteyebilir; yönetici kayıtlı hesabı onaylar veya iznini
  kaldırır. Yönetici kendi erişimini kaldıramaz. Başvurmak onay anlamına gelmez.
- Özel tablolarda zorunlu RLS ve istemci tablo erişimi yasağı vardır. Sınırları
  belirli `SECURITY DEFINER` RPC'lerinin arama yolu sabittir; anon çalıştıramaz.
- Arşiv anahtarı yalnız sunucunun onayladığı oturuma döner. Tarayıcıda URL,
  DOM, event, localStorage veya sessionStorage'a kaydedilmez. Çıkış/hesap
  değişimi ve kaldırılmış izin kontrolü açılmış içeriği temizler. Odak ve
  periyodik izin kontrolü yapılır; indirilen bir içeriğin geçmiş kopyası
  uzaktan geri alınabileceği iddia edilmez.

## Yeniden çalıştırma

`scripts/compile-source-exams.py` gerçek soru üretmez. Özel inceleme kayıtlarını,
cevap kanıtlarını, kaynak görüntü kırpımlarını ve konu kotalarını doğrulayıp
kararlı manifestlerle AYT setlerini derler. Aynı sette tekrar, eksik kota,
kanıtsız cevap veya sınırı geçersiz kırpım olursa durur. `--check` aynı sonuçla
karşılaştırır. Mevcut 3.022 sayfa yeniden oluşturulmaz; yalnız şifreli indeks
ve içeriksiz sayım özeti değişir. Okuma kanıtları/incelemeler `work/ayt-*.json`,
okunabilir indeks ve özel kurulum `private/` altında kalır; depoya eklenmez.

## Test ve canlıya geçiş sınırı

- `npm test`: **153/153** geçti.
- Chromium masaüstü/mobil: **144/144** senaryo geçti.
- `npm run audit:ai-bank`: geçti; AI veri dosyaları önceki sürümle aynı.
- Gerçek kaynak derlemesi `--check`: aynı 12 AYT manifestiyle geçti.

Kripto/şema testleri; gerçek 3.022 şifreli sayfanın varlığı; 31+9 kota, 40
farklı soru ve cevap eşleştirme; PostgreSQL RLS/RPC yetkileri; yönetici onayı,
iznin kaldırılması, metadata taklidi, doğrulanmamış e-posta, eski kişisel
bağlantı ve geç gelen önceki hesap yanıtı sınanır. Masaüstü/mobilde TYT ve
AYT çözme, kaydetme, yenileme, süre, net, tik ve tekrar senaryoları vardır.

Gerçek şifreli kaynak paketi ayrıca 1280 ve 390 piksel Chromium'da açıldı:
12 TYT/12 AYT kartı, birinci AYT'nin 40 özgün soru görüntüsü, 40 optik alanı
ve yenilemeden sonra devam doğrulandı; sayfa hatası veya yatay taşma görülmedi.
Bu kontrolde yalnız Supabase hesap/izin yanıtları taklit edildi; görüntüler
gerçek kaynak dosyalarıydı.

**Canlı kurulum henüz uygulanmadı:** Bu oturumda Supabase veritabanı yönetim
bağlantısı yoktur. Özel `private/Hesap_Yetkisi_Kurulum.sql`, yeni şemayı ve
kullanıcının belirttiği yönetici/anahtar ayarını tek işlemde hazırlar. Supabase
SQL Editor'de bir kez çalıştırılmalı; ardından gerçek yönetici girişi, başvuru,
onay ve yetkisiz erişim canlıda doğrulanmalıdır. Bu adım olmadan özellik
etkinleştirilmiş veya gerçek yönetici hesabı atanmış sayılmaz. Mevcut canlı
site ve Supabase üretim verileri bu geliştirmede değiştirilmez.
