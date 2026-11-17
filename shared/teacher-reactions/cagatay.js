// Additional default-clean reactions; adult tone is applied by the existing gate.
export const REACTIONS = Object.freeze({
  greeting:Object.freeze([
    "Tahta burada, tebeşir burada; işlem kalabalığına sıra numarası veriyoruz! Önce tek bir kavramı kuralıyla yerine oturtalım.",
    "Matematik mahkemesi açılıyor; gerekçesiz eşitlikler koridorda beklesin! Seçtiğin konunun koşullarını netleştirerek başlayalım.",
    "Yahu şu parantezlerin toplantı tutanağı ne kadar uzamış! Biz açıklamayı kısa, tanımı açık ve işlemi gerekçeli tutacağız.",
    "Tebeşirin gösteri hevesini kontrol altına aldım; başrol matematikte! Takıldığın kavramı seçili bağlamdan kopmadan açıklayalım.",
    "Tahtaya karmaşa değil düzen getiriyoruz! Kuralı, koşulu ve çıkarımı ayırınca işlem tantanasına daha az mikrofon kalır."
  ]),
  correct:Object.freeze([
    "Cevap doğru! Tebeşir imza dağıtmaya kalkmadan bu sonucun hangi gerekçeyle geldiğini de görünür tutalım.",
    "Yanıt anahtarla uyuşuyor; matematik mahkemesinde alkış kısa, gerekçe uzun ömürlü olsun!",
    "Doğru cevap geldi; parantezlerin basın toplantısını erteledim. İşlemin nedenini de dosyaya ekleyelim.",
    "Bu yanıt doğru! Formülün havalı girişine kapılmadan hangi koşulla kullanıldığını da hatırlayalım.",
    "Cevap tuttu yahu! Tebeşiri şampiyon ilan etmeden çözüm gerekçesini kendi cümlemizle açıklayalım.",
    "Yanıt doğru; işaret çetesi bu açıklamaya yorum yetiştiremedi! Gerekçeyi ayrı kontrol etme hakkımız saklı.",
    "Doğru seçenek; matematik mahkemesi sonucu kayda aldı! Çözüm yolundaki koşulları da görünür tutalım.",
    "Cevap doğru! Sonuç geldi diye tanım koşullarını koridorda unutmayalım; onlar da bu işlemin kadrosunda."
  ]),
  incorrect:Object.freeze([
    "Bu yanıt uyuşmadı; tebeşirle bütün tahtayı silmek yok! Son gerekçeli adımdan başlayıp ilk uyuşmazlığı arayalım.",
    "Cevap tutmadı yahu; henüz hangi kuralın karıştığını bilmiyoruz. İşleme bakmadan suçlu parantez ilan etmeyelim.",
    "Yanıt yanlış; matematik mahkemesi öğrenciyi değil çözüm satırlarını inceleyecek! Koşulları yeniden ayıralım.",
    "Bu cevapta kontrol molası gerekiyor. İşaret mi, tanım mı, hesap mı; görmeden rastgele düğmeye basmayacağız.",
    "Yanıt anahtarla eşleşmedi; denkleme cenaze töreni yok! Son sağlam gerekçeye dönüp sıradaki işlemi denetleyelim.",
    "Cevap olmadı; tebeşirin artistliği burada işe yaramaz! Önce verilenlerle kullandığımız kuralın koşullarını karşılaştıralım.",
    "Bu yanıtı düzelteceğiz; bütün konuyu suçlamak için delil yok! İlk geçersiz geçişi bulmaya odaklanalım.",
    "Yanıt tutmadı; işaretler masum da olabilir! Hatanın yerini çözüm adımlarını görerek ayıralım."
  ]),
  waiting:Object.freeze([
    "Tebeşir kısa bir dramatik duraklama yapıyor; açıklama hazırlanıyor.",
    "Parantezler söz istedi; açıklamada sırayı gerekçeye veriyoruz.",
    "Matematik mahkemesinde kısa ara; yanıt henüz hazır değil.",
    "Tahtanın mikrofonu açık; işlemin tantanasını açıklamaya taşımadan bekleyelim.",
    "Tebeşir kuliste nefesleniyor; yanıt gelirken koşullar sahnede kalsın."
  ])
});
