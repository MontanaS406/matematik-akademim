# Sade arayüz yenilemesi

Uygulama ilk ekranda ders notlarını, kaynak açıklamalarını, çalışma ayarlarını ve belge aktarma seçeneklerini birlikte gösteriyordu. Kullanıcının yeni isteği üzerine ana akış doğrudan soru çözmeye ayrıldı; aktarım ve haricî belge çalışma ekranları kullanıcı arayüzünden çıkarıldı.

## Yeni düzen

- **Soru çöz:** tek soru kartı, cevap alanı, kontrol düğmesi ve önceki/sonraki gezinmesi. Konu seçimi tek düğmede. Uzun açıklamalar bu ekranda bulunmaz.
- **Konular:** arama, konu grupları ve kısa kartlar. Anlatım yalnız konu seçildiğinde açılır.
- **Öğretmen:** seçili öğretmen ve sohbet. Altı kişilik ayrı bir seçim penceresinde korunur.
- **İlerleme:** kısa istatistikler ve geçmiş çalışmalar. Hesap işlemleri ayrı, kapalı paneldedir; üstteki Hesabım düğmesi doğrudan açar.

Görsel tasarım sıfırdan düzenlendi: sade gece mavisi, az sayıda metin, geniş boşluklar, tutarlı kartlar ve düğmeler. Masaüstünde yan menü, telefonda dört bölümlü alt menü kullanılır. İlk telefon görünümü yaklaşık 40 kelimedir; cevap eylemi kaydırma gerektirmez. Küçük ekran ve hareket azaltma tercihleri desteklenir.

## Korunanlar

- 142 gerçek kaynak kaydı: 132 numaralı soru ve 10 yayımlanmış çözümlü örnek. İçerik ve cevaplar bu tasarım çalışmasında değiştirilmedi; yeni soru üretilmedi.
- Altı öğretmen, yetişkin argo seçiminin açık rızası, sohbet bağlamı ve hesap tercihi.
- Supabase hesap arayüzü, kullanıcıya göre veri süzme, token yenileme, geciken isteklerde hesap/oturum denetimi.
- Eski öğrenme ve deneme kayıtları, yarım çalışmalar ve cihaz depoları. Kayıtlar veya tablolar silinmedi. Tanınmayan eski geçmiş satırları da saklanır.
- Kaynağın gerekli atfı ve lisansı küçük bilgi penceresinde korunur.

Eski aktarım modülleri ve saf veri modelleri uyumluluk için depoda kalır; uygulama başlangıcında yüklenmez ve menüden açılmaz. Yeni görünümde dosya seçici veya gömülü görüntüleyici yoktur. Kaynakta bulunmayan bir konu seçilirse anlatım açılır; ana soru alanı kaynaklı sorularla kullanılabilir kalır.

## Doğrulama yaklaşımı

Soru bankası, matematik cevapları, yayın kapısı, RLS, öğretmen/Worker ve eski cihaz deposu model testleri korunur. Artık arayüzde bulunmayan boş cevap kâğıdı, sayaç ve belge aktarım eylemlerini tıklayan eski tarayıcı senaryoları açıkça emekliye ayrıldı. Yerlerine gerçek soru çözme, metin yoğunluğu, mobil boyutlar, sade gezinme, öğretmenler, kaynak açıklamasının ikincil kalması ve hesap güvenliği senaryoları yazıldı.

Özellikle aynı kişiyle yeniden giriş dahil geciken eski oturum yanıtları, yabancı kullanıcı satırlarının reddi, tek token yenileme, öğrenme kaydı boyut/kimlik sınırı ve eski kayıtların değişmeden kalması denetlenir. Tüm erişilebilir ekranlar ve pencerelerde aktarım arayüzü veya istenmeyen terim bulunmadığı ayrıca kontrol edilir.

Yerel ekranlar390px ve1440px genişliklerde incelendi: JavaScript hatası ve yatay taşma görülmedi. Canlı Supabase/model işlemi için sahte servis testleri kullanılır; gerçek servis doğrulaması yapılmış gibi sunulmaz. Son otomatik sonuçlar PR üzerinde kaydedilir. Yayın mevcut GitHub Pages adresinde, kullanıcının verdiği yayın yetkisiyle sürdürülür.

Son yerel sonuçlar: **77/77 birim/model/veritabanı testi**, **46/46 masaüstü/mobil tarayıcı senaryosu** ve ilerleme sayacı ek kontrolü **2/2** geçti. Katalog denetimi 7 kaynak / 142 kayıt / 6 konu, bağımlılık denetimi 0 açık raporladı. `git diff --check` temizdir.
