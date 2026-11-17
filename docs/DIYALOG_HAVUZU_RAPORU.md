# Diyalog havuzu genişletme raporu

Tarih: 16 Kasım 2026. Metin sürümleri: `dialogue-v1` ve `reaction-v1`.

On öğretmenin karakteri korunarak **1.010 yeni metin** yazıldı. Önceki **120 metin** korunur; toplam **1.130 benzersiz öğretmen metni** vardır. Bunlar konu açıklaması, öğrenme desteği ve karakter tepkileridir; soru bankasına eklenmiş yeni matematik soruları değildir.

## Kesin sayım

| İçerik | Yeni | Korunan | Toplam |
| --- | ---: | ---: | ---: |
| 60 ortak duruma temel diyalog yanıtı | 600 | 0 | 600 |
| Sık kullanılan 15 duruma alternatif yanıt | 150 | 0 | 150 |
| Karşılama, doğru, yanlış ve bekleme tepkisi | 260 | 90 | 350 |
| Önceki üç hazır konuşma örneği | 0 | 30 | 30 |
| **Bütün öğretmen metinleri** | **1.010** | **120** | **1.130** |

Her öğretmene **60 temel + 15 alternatif + 26 yeni tepki = 101 yeni metin** eklendi. Eski 9 tepki ve 3 hazır örnekle öğretmen başına toplam **113 metin** vardır. Öğretmenlerin kimlikleri aynı kalır: Çağatay, Beyza, Zeynep, Kemal, Mert, Elif, Rıza, Nermin, Bora ve Derya.

Yeni 26 tepkinin dağılımı her öğretmende aynıdır: 5 karşılama, 8 doğru cevap, 8 yanlış cevap, 5 bekleme. Eski satırlar kendi listelerinin başında aynı sırayla tutulur. Çözülen sorunun notunu tepki metni belirlemez; uygulamanın gerçek cevap değerlendirmesi belirler.

750 diyalog yanıtının konu başlıkları:

| Başlık | Yanıt |
| --- | ---: |
| Başlangıç ve destek | 170 |
| Çözüm stratejisi | 140 |
| Anlatım ve sınırlar | 100 |
| Matematik kavramları | 340 |

## İçerik ve karakter farkları

Altmış ortak öğrenci mesajı, öğretmenlerin aynı duruma verdiği farklı cevapları karşılaştırmayı sağlar. Başlama, takılma, yanlış cevap, gerekçe isteme, yorgunluk, kaygı, moladan dönme, ipucu, süre yönetimi, kaynak eksikliği ve şakayı azaltma gibi durumlar vardır. Kavram bölümünde temel işlemlerden türev ve integrale kadar 34 konu durumu bulunur; etiketler gerçek müfredat kimliklerini kullanır.

Beyza'nın her açıklama cümlesinde mimarlık terimi denetlenir. Yeni doğru cevap tepkilerinden biri: “Doğru cevap; cevabı ev gibi diktik, gerekçeyi de temel planına ekleyelim.” Rıza atölye, Nermin mutfak, Bora denizcilik, Derya delil diliyle konuşur. Kemal kuru akademik mizahı, Mert spiker enerjisini, Elif sakin çay/teneffüs dilini, Zeynep hafif romantik komediyi, Çağatay teatral sertliğini korur.

Varsayılan havuz küfürsüzdür. Çağatay'ın mevcut yetişkin ve argo tercihleri ayrıca uygulanır; onaylar kalıcı hesap kaydına eklenmez. Tepkiler hayalî doğru serisi, seviye atlama, kayıt işlemi veya dış kaynak doğrulaması bildirmez. Yanlış cevap, görülmeyen belirli bir işlem hatasının kanıtı gibi ele alınmaz.

## Uygulamadaki kullanım

- Dört ana menü ve gece mavisi düzen korunur. **Öğretmen → Karakteri tanı → Diyalog havuzu** başlangıçta kapalıdır.
- Başlık ve durum seçilerek seçili öğretmenin hazır yanıtı okunur. Alternatifi olan durumlarda **Başka örnek** yerel olarak diğer metne geçer. Bu işlem AI isteği göndermez; sohbeti, soru seçimini, sonucu veya ilerleme kaydını değiştirmez.
- Aynı durum farklı öğretmenlerle karşılaştırılabilir. Hazır örnekler canlı model yanıtı olarak etiketlenmez.
- Model talimatına bütün havuz dökülmez. En fazla **iki ilgili hazır örnek** seçilir; seçili ders/kaynak bağlamı ve yardım türü korunur. Örnekler gerçek sorunun veya öğrencinin durumu hakkında yeni kanıt sayılmaz. Konuşma turu, uygun alternatifin değişmesini sağlar.
- Doğru ve yanlış tepkileri birbirine karıştırılmadan döner. Selamlama aynı sohbet içinde sabit kalır; yeni sohbetlerde çeşitlenir. Sohbet ve karşılama belleği hesap değişiminde temizlenir.
- Soru havuzları, denemeler, cevap anahtarları, Supabase kullanıcıları ve eski sonuçlar bu metin genişletmesi için değiştirilmedi.
- Gemini entegrasyonunda kullanıcının gönderdiği matematik sorusunun sohbet içinde çözülmesi ayrı bir akıştır; bu soru veya yanıt otomatik olarak soru bankasına eklenmez. Yeni soru üretmeme kuralı, mevcut havuzları geliştirici sorularıyla doldurmama ayrımını korur.

## Doğrulama ve kapsamı

**1.010 yeni metnin tamamı ayrı bir AI inceleme turunda okundu.** Matematik koşulları, görünmeyen bilgiye dayanma, ipucu sınırını aşma ve hayalî başarı iddiaları incelendi. Tespit edilen ifadeler düzeltildi; örneğin sıfır polinomun derecesi, sıfırın basamak katkısı, negatif üste işaret, bilinmeyen çarpanın sıfır durumu, `k=1` benzerliği ve sıfır paylı kesirde yapılan değişikliklerin etkisi daha doğru anlatıldı. Sonuç kontrolü ile bütün çözümlerin kapsanması ayrımı korundu.

Bu okuma **insan editör onayı, matematiksel makine ispatı veya canlı modelin üslup garantisi değildir**. Sabit metinlerin ve modelin bu metinleri kullanarak ürettiği yeni yanıtların doğrulanması farklı işlemlerdir. Gemini'nin gerçek anahtarla konuşması ve karakter sadakati, canlı servis kurulduktan sonra ayrıca denenmelidir.

Otomatik denetim sonucu:

- **1.130/1.130** kayıt yapısı ve kimliği incelendi.
- **0** birebir veya yalnız noktalaması farklı tekrar bulundu.
- Beş kelimelik parçalar için 0,45 Jaccard eşiğinde **0** yakın tekrar inceleme sinyali bulundu. Bu ölçü semantik tekrarın imkânsız olduğunu kanıtlamaz.
- **0** geçersiz müfredat/kategori etiketi, eksik senaryo, varsayılan küfür veya Beyza cümlesi üslup ihlali bulundu.
- Önceki **30 hazır örnek ve 90 tepki** yeni üretim sayımına katılmadan korundu.

Diyalog özelliğinin odaklı kontrolleri **13/13 birim** ve **12/12 masaüstü/mobil tarayıcı** testiyle geçti. Gemini geçişi, yeni sohbet akışı, uzun yanıt koruması ve hazır Worker paketiyle birlikte teslim kapsamında **195/195 birim** ve **184 masaüstü/mobil tarayıcı senaryosu** doğrulandı. Dış servisler taklit edildi; gerçek Gemini anahtarı veya canlı Supabase bağlantısına ilişkin test iddiası yoktur. Son teslim kontrolü: 17 Kasım 2026.

## Yeniden denetleme ve devam etme

- [Makine özeti](teacher-dialogue-audit.json): tür ve öğretmen bazında sayılar, tekrar sinyalleri ve içerik özeti.
- [Kayıt defteri](teacher-dialogue-ledger.json): 1.130 sabit kimlik, kayıt başına SHA-256 ve metinlerin geldiği 31 dosyanın SHA-256 özeti. Kullanıcı mesajı, hesap, parola veya API anahtarı içermez.
- `npm run audit:dialogues`: mevcut metinlerde yapı, dil ve tekrar denetimini çalıştırır.
- `node scripts/audit-teacher-dialogues.mjs --check`: yayımlanan özet ve kayıt defterinin mevcut içerikle eşleştiğini denetler.
- Metinler gözden geçirilip değiştirildikten sonra `node scripts/audit-teacher-dialogues.mjs --write` iki JSON dosyasını deterministik biçimde yeniler. Salt yeniden çalıştırmak tarih veya rastgele kimlik üretmez.

İşlenen metinlerin kimlikleri `dialogue:<öğretmen>:<durum>:<varyant>`, `reaction:<öğretmen>:<tür>:<sıra>` ve `preview:<öğretmen>:<sıra>` biçimindedir. Bu kimlikler ve özetler, önceki metni tekrar üretmeden değişen içeriği bulmaya yarar. Yayın/merge kararı ve gerçek Gemini/Cloudflare kurulumu bu metin denetiminin dışında kalır.
