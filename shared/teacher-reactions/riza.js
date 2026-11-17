// Added offline lines; grade-specific reactions never certify unseen solution steps.
export const REACTIONS = Object.freeze({
 greeting:Object.freeze([
  'Hoş geldin usta; lokma takımı düzenli, koşullar servis fişinin başında. Önce neyi kontrol ettiğimizi netleştirelim, sonra matematiğin kaputunu açarız.',
  'Usta, bugün tebeşir kompresörün sesini bastıracak. Seçtiğin kavramı açık tanımıyla masaya alıp bağlantılarını birlikte inceleyelim.',
  'Atölye hazır usta; bu tezgâhta gerekçesiz somun sıkılmıyor. Kuralı, koşulu ve kontrolü sırayla yerleştireceğiz.',
  'Buyur usta, matematik liftini hazırladım. Konunun altına bakmadan yalnız kaporta parlatıp çözüm diye teslim etmiyoruz.',
  'Usta, kontak anahtarı sende; ben kuralların servis kılavuzunu açıyorum. Anlatımı bir bağlantıdan başlayarak anlaşılır tutalım.'
 ]),
 correct:Object.freeze([
  'Doğru yanıt usta; lokma takımı alkıştan birbirine karışmadan gerekçeyi de yazalım.',
  'Cevap anahtarla eşleşti usta. Sonucun yanına kullanılan kuralı ekleyelim; servis fişi yalnız rakamdan ibaret kalmasın.',
  'Doğru buldun! Bu cevap yerine oturdu; bütün çözümün bağlantılarını ayrıca görünür tutalım.',
  'Yanıt doğru usta; kaputu bir anda kapatmayalım, matematik gerekçesi içeride unutulmasın.',
  'Doğru cevap! Tebeşir bu sonucu servis fişine geçirdi; koşulların kaydını da koruyalım.',
  'Bu yanıt doğru usta; somunlar konfeti atmaya kalksa önce yerleri süpürürüz. Biz gerekçeyi düzenli tutalım.',
  'Cevabın doğru; tork anahtarı kısa bir alkış molası verebilir. Sonucun neden tuttuğunu da açıklayalım.',
  'Doğru yanıt usta; parça numarası tuttu. Şimdi çözümün hangi kuralla kurulduğunu not edelim.'
 ]),
 incorrect:Object.freeze([
  'Bu yanıt tutmadı usta; tornavidayı rastgele çevirmeden çözümün dayanaklarını yeniden kontrol edelim.',
  'Anahtarla bir uyuşmazlık var. Kaputun üstünden tahmin kesmeyelim usta; verilenlere ve adımlara bakalım.',
  'Bu cevap yeniden inceleme istiyor usta; motoru komple değiştirmeden koşulları sırayla kontrol edebiliriz.',
  'Yanıt eşleşmedi; hangi bağlantıda ayrıldığımızı çözümün üzerinde arayalım. Suçu peşinen eksi işaretine atmıyoruz usta.',
  'Bu cevap henüz tutmuyor usta. Son anlaşılan adımı masaya alalım; lokma anahtarı gerekçenin yerini tutmasın.',
  'Yanıtta uyuşmazlık var; servis fişini yeniden açıyoruz usta. Belirli bir hata söylemeden önce çözümü inceleyelim.',
  'Bu yanıt doğru değil usta; sağlam görünen parçaları da koşullarıyla kontrol edelim. Parlak kaporta matematik kanıtı sayılmıyor.',
  'Cevap tutmadı; atölyenin kapısına kilit vurmuyoruz usta. Kuralı ve özgün koşulları yeniden karşılaştıralım.'
 ]),
 waiting:Object.freeze([
  'Lokma takımına kısa bir düşünme molası usta; açıklamanın bağlantılarını düzenliyorum.',
  'Kaputun altında gerekçeye yer açıyorum usta; yanıtı anlaşılır biçimde toparlayacağım.',
  'Tebeşir servis fişinin başında; koşulları açıklamanın önüne yerleştiriyorum.',
  'İnce ayar molası usta; anlatımın gereksiz kablolarını ayırıp ana kuralı görünür tutuyorum.',
  'Atölyede kısa bir sessizlik; matematik açıklamasını sıraya koyuyorum usta.'
 ])
});
