# Codex çalışma talimatları — Matematik Akademim

## Kullanıcı hedefi
Sıfırdan ileri matematiğe Türkçe eğitim; **sade koyu mavi** tasarım; gerçek, kaynağı doğrulanmış TYT/AYT deneme sistemi; Supabase ile kişi başına bağımsız geçmiş; güvenli Cloudflare Worker üzerinden AI öğretmen.

## Öncelikler
1. Mevcut `index.html` uygulamasını incele, regresyonları ve gerçek tarayıcı hatalarını gider. Başlangıçta `npm test` çalıştır.
2. E-posta+şifreli Supabase Auth akışını ve kullanıcı başına RLS erişimini güvenli biçimde doğrula. Sunucu sırlarını veya servis rolü anahtarlarını istemciye koyma. Gerçek servis bağlantısı mümkün değilse test etmediğin şeyleri açıkça raporla.
3. TYT/AYT denemelerinde yalnızca **doğrulanmış gerçek sınav kitapçıklarını ve resmî cevap anahtarlarını** kullan. Üretilmiş matematik alıştırmalarını **asla** çıkmış soru olarak etiketleme. 2026 AYT ve diğer anahtarların sonradan yapılan düzeltmelerini resmî kaynaktan kontrol et. Doğrulanmayan cevap anahtarıyla otomatik puanlama yapma.
4. 40 matematik sorusu, kronometre, ara kayıt, sonlandırma, cevap anahtarı, net ve deneme geçmişi tam çalışsın. PDF'nin tarayıcıda gömülmesi engellenirse içeride PDF yükleme fallback korunsun. Kullanım hakkı olmayan telifli soruları proje içine kopyalama.
5. Telefon ekranını ve erişilebilirliği iyileştir. Ana menüyü sade bırak; tasarım **gece mavisi** olsun; kullanıcı istemedikçe ana ekranı yeniden kalabalıklaştırma.
6. Test ekle: JavaScript sözdizimi, temel UI, devam eden deneme ve bitirme, kronometre, 40 soru, cevap anahtarı, Supabase veri şeması. Hataları düzelt, regresyon kontrolü yap.

## Çalışma biçimi
- Kodları mümkünse küçük ve anlaşılır parçalara ayır; mevcut özellikleri silme.
- `npm test` çalıştır. Tarayıcı testine erişimin varsa ekle ve çalıştır.
- Her aşamada yapılan, test edilen ve yapılamayan işleri not et.
- Var olan Supabase tablolarını yıkıp yeniden oluşturma, üretim verisini silme.
- Gerçek e-posta, şifre, oturum tokenı, service_role, OPENAI_API_KEY veya APP_ACCESS_TOKEN değerlerini kod, test veya commit içinde saklama.
- Publishable Supabase anahtarı istemci içindir; yine de gerçek güvenlik RLS ile sağlanır.
- Yalnızca yeni bir dalda çalış; `main` dalını doğrudan değiştirme, otomatik yayına alma. İncelenebilir PR hazırla.
- Bir dış servis erişimi veya onay eksikse, tahmin ederek işlem yapma; blokajı ve sonraki adımı yaz.