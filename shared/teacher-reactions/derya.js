// Additional clean reactions; they never invent evidence or student history.
export const REACTIONS = Object.freeze({
  greeting:Object.freeze([
    'İnceleme masası hazır dedektifim; bugün hangi matematik iddiasının dayanağını açığa çıkaracağımızı seçelim.',
    'Büyütecin kapağı açıldı; önce tanımı okuyacak, sonra gerekçesiz çıkarımları yakın plana alacağız.',
    'Yeni oturumun tutanağına hoş geldin; matematikte söylentiyi değil kuralı esas alıyoruz.',
    'Delil panosunda yer var dedektifim; seçili konunun tanımını ve koşullarını sırayla asabiliriz.',
    'Sorgu lambasını öğrenciye değil işlemlere çevirdim; şimdi konuyu sakin ve açık biçimde inceleyelim.'
  ]),
  correct:Object.freeze([
    'Yanıt doğru dedektifim; sonuç dosyaya girdi, dayanaklarını da görünür kılalım.',
    'Cevap anahtarla uyuşuyor; büyüteç alkışlamıyor ama gerekçeyi incelemeyi seviyor.',
    'Doğru cevap; sonuç hanesi net, çıkarımların tutanağını da düzenli tutalım.',
    'Yanıtı doğru buldun; dosyanın kapağına yıldız çizmeden önce yöntemi açıklayabiliriz.',
    'Bu cevap doğru dedektifim; hükmümüz yalnız yanıta, görmediğimiz her adıma otomatik onay vermiyoruz.',
    'Sonuç eşleşti; matematik dosyasında gerekçenin parmak izini de koruyalım.',
    'Doğru yanıt kayda geçti; sorgu lambası şimdi kullanılan kuralın koşullarına dönüyor.',
    'Cevap doğru; final sayfası hazır, çözümün delil zincirini de anlatmak iyi olur.'
  ]),
  incorrect:Object.freeze([
    'Bu yanıt uyuşmuyor dedektifim; ilk kontrol edilecek çıkarımı bulmak için kayda dönelim.',
    'Cevap yanlış; dosyayı kişisel bir hükme çevirmeden işlemleri tek tek inceleyelim.',
    'Sonuç anahtarla eşleşmedi; hangi adımda kuralın koşulunu denetlememiz gerektiğine bakalım.',
    'Bu yanıta onay veremiyoruz; büyüteci son dayanaklı satıra taşıyalım.',
    'Yanlış cevap kayda geçti dedektifim; şimdi hatanın türünü görerek belirleyelim, tahminle değil.',
    'Dosyada bir uyuşmazlık var; bütün çözümü mahkûm etmeden gerekçeleri yeniden okuyalım.',
    'Bu sonuç doğru değil; sorgu masasına önce işlemleri ve koşulları çağırıyoruz.',
    'Yanıt tutmadı; delil panosundaki bağlantıları kontrol edelim, eksik olanı görmeden isim koymayalım.'
  ]),
  waiting:Object.freeze([
    'İnceleme notlarını toparlıyorum; kuralın hangi koşulla kullanılacağını açık yazacağım.',
    'Büyüteç masada dedektifim; açıklamanın delil sırasını hazırlıyorum.',
    'Tutanakta tanımla çıkarımı ayrı başlıklara yerleştiriyorum.',
    'Sorgu lambası altında ifadeleri düzenliyorum; matematik gerekçesi gölgede kalmasın.',
    'Dosyanın anlatımını sadeleştiriyorum; gerekli koşulları görünür tutacağım.'
  ])
});
