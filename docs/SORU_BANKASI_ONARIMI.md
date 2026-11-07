# Soru bankası ve kullanım akışı onarımı

7 Kasım 2026. Kullanıcı yayından sonra uygulamada soru kalmadığını bildirdi. Önceki kontroller veri bütünlüğünü doğrulasa da ana akışın kullanılabilirliğini korumamıştı: başlangıç konusu boştu, anlatım kapalıydı, soru bulunmayan konularda AI devre dışıydı ve deneme düğmeleri gerçek soru yerine boş cevap kâğıdı açıyordu.

## Eklenen gerçek içerik

Bankada artık **142 kayıt: 132 yayımlanmış numaralı soru ve 10 yayımlanmış çözümlü örnek** var. Önceki 12 soruya **120 gerçek soru + 10 çözümlü örnek** eklendi. Yedi PDF kaynak kaydı, altı konu: dört işlem, denklemler, mutlak değer, çarpanlara ayırma, ikinci derece denklemler ve üslü ifadeler. Sorular AI veya geliştirici tarafından üretilmedi; soru sayısını artırmak için sayı/değişken/seçenek değiştirilmedi.

- Tyler Wallace’ın *Beginning and Intermediate Algebra* kitabının önceki altı bölüm PDF’sinden 20’şer yeni soru alındı: genel doğrusal denklemler, mutlak değer, çarpanlara ayırma, çarpanlara ayırarak denklem çözme, rasyonel denklemler ve üslü denklemler. Toplam **120 yeni numaralı soru**. Özgün soru numarası, matematiksel ifade ve basılı cevap anahtarı karşılaştırıldı; 120 cevap ayrıca bağımsız sembolik hesap ve gerçek çözüm kümeleriyle kontrol edildi. Kaynaklarda CC BY 3.0 lisansı basılıdır.
- Genel yönergeler Türkçeye çevrildi; matematik ifadeleri ve sayılar korunur. Özgün İngilizce metin `originalPrompt` alanında tutulur. Atıf, bu yönerge çevirisini ve Unicode tipografi düzenlemesini açıklar. Bu sorular TYT/AYT çıkmış sorusu olarak gösterilmez.
- Timur Karaçay’ın TÜBA Açık Ders *Doğal Sayılarda Aritmetik* notlarından **10 gerçek çözümlü örnek**: işlem sırası 1, denklem 1, üslü sayılar 8. Fiziksel PDF7/9/10 üzerinde ifadeler ve yayımlanmış sonuçlar okundu, hesaplar bağımsız kontrol edildi. Bunlara sınav soru numarası uydurulmadı. Yayın yılı belirtilmediğinden `null` saklanır.
- TÜBA’nın [kullanım şartları](https://acikders.tuba.gov.tr/kullanim-sartlari) tüm açık ders materyalleri için [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) koşullarını belirtir. Bu içerikler atıf, **ticari olmayan kullanım ve aynı lisansla paylaşım** şartlarıyla kullanılır. Uygulamadaki bu materyaller ticari kullanıma açılmış sayılmaz; ücretli/reklamlı kullanıma geçmeden önce çıkarılmalı veya ayrıca izin alınmalıdır.
- Matematik dışı PDF yazıları bozuk fontla çıkarılan veya ifadesi belirsiz örnekler alınmadı. Görsel karşılaştırma ve ham PDF SHA-256 doğrulaması yapılmış gibi gösterilmedi.

Tüm kalıcı içerik, kaynak adresleri, lisanslar, özgün konumlar, cevap kanıtları, uyarlama notları ve inceleme özetleri `data/question-bank.js` içindedir. SQL staging seed aynı katalogdan üretilir. Özel kullanıcı dosyaları bu bankaya eklenmez.

## Kullanım düzeltmeleri

Ana ekran yeni kullanıcıya doğrudan gerçek bir işlem sorusu gösterir. Konu anlatımı açık gelir; kaynağın uzun araştırma/inceleme ayrıntıları ana soru alanından kaldırıldı. Gerekli atıf ve lisans bilgisi küçük ayrıntı bölümünde korunur. Soru bulunmayan konuda mevcut gerçek sorulara geçiş düğmeleri vardır; içerik otomatik üretilmez.

TYT/AYT yıl seçimi ve gerçek resmî PDF bağlantıları ana ekrana ve Çıkmışlar bölümüne geri geldi. PDF seçilince kitapçık alanları otomatik doldurulur. Denemeler ekranında gerçek PDF alanı varsayılan açıktır; boş optik ve eski geçmiş ayrı bir bölümde korunur. Eski yarım kalan denemeler otomatik görünür.

AI Worker’a açık `mode:lesson` ve sunucuda doğrulanan `courseId` ile kavram anlatımı eklendi. Böylece bankada soru olmayan konularda da öğretmen kullanılabilir. Yeni soru üretimi kapalıdır; mevcut kaynak sorusu modu ve altı kişilik korunur. Worker’ın canlı yayını/API yapılandırması yapılmadı; bu kod düzeltmesi gerçek AI servis bağlantısı testinin yerine geçmez.

## Veri ve test sınırları

Supabase hesabı, öğrenme profili, eski deneme geçmişi ve cihazdaki özel PDF’ler silinmedi. Kaynak materyallerde belirtilmeyen yayın yılı için yalnız sınav dışı kayıtlarda `null` desteği eklendi; sınavın yılı zorunlu kalır. Soru SQL dosyaları staging içindir; üretime uygulanmadı.

Doğrulama sonuçları PR ve son test raporuyla birlikte kaydedilir. Yeni tarayıcı kontrolleri, ilk açılışta gerçekten soru bulunduğunu, cevabın kaydedildiğini, ana ekran kitapçık seçiminin PDF alanını açtığını ve sorusuz bir konuda öğretmene mesaj gönderilebildiğini denetler. Kaynak bütünlüğü testleri yalnız yönergenin çevrildiğini, matematik ifadelerinin korunmasını ve 142 kaydın seed ile tutarlılığını kontrol eder.

Türkiye sınavı sorularını herkese açık bankaya kopyalama izni bu çalışmada bulunmadı. 17 TYT/AYT kitapçık kimliği ve kullanıcı teyidine bağlı15 tam anahtar önceki çalışmadan korunur; gerçek sorular resmî PDF bağlantısından veya kullanıcının cihazındaki PDF’den çözülür. Henüz her27 konuda hazır soru yoktur; kalan konuların anlatımları korunur. Eksik konu bankaları uydurma soruyla doldurulmadı.
