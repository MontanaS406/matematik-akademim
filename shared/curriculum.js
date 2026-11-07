// All exercises and lessons in this catalog are original teaching material.
// A unit is an introduction to its subject, not a claim of a complete degree course.
const exercise = (id, prompt, answer, distractors, explanation) => ({
  id, prompt, choices: [answer, ...distractors], answer, explanation, origin: 'Özgün alıştırma'
});
const unit = (id, title, group, prerequisites, lessonSteps, example, tasks) => ({
  id, title, group, prerequisites, lessonSteps,
  example: {problem: example[0], steps: example[1], answer: example[2]},
  exercises: Object.fromEntries(['easy', 'medium', 'hard'].map((level, i) => [level,
    exercise(`${id}-${level}`, tasks[i][0], tasks[i][1], tasks[i][2], tasks[i][3])]))
});

export const COURSES = [
  unit('numbers', 'Sayılar ve dört işlem', 'Temel', [], [
    'Doğal sayılar sayma ve miktar belirtir. Negatif sayılarla birlikte tam sayıları elde ederiz. Sayı doğrusunda sağdaki sayı daha büyüktür.',
    'Toplama ve çıkarma birbirinin tersidir; çarpma eşit grupları toplar, bölme eşit gruplara ayırır. Sıfıra bölme tanımsızdır.',
    'Önce parantezleri, sonra üsleri, sonra çarpma ve bölmeyi soldan sağa, en son toplama ve çıkarmayı soldan sağa yap. Aynı öncelikteki işlemlerin sırası korunur.'
  ], ['18 − 3 × (2 + 1)', ['Parantez: 2 + 1 = 3.', 'Çarpma: 3 × 3 = 9.', 'Çıkarma: 18 − 9 = 9.'], '9'], [
    ['7 + 5 kaçtır?', '12', ['10', '13', '35'], '7 üzerine 5 ekle: 8, 9, 10, 11, 12.'],
    ['20 − 4 × 3 kaçtır?', '8', ['48', '16', '12'], 'Çarpma önce yapılır: 4 × 3 = 12; 20 − 12 = 8.'],
    ['−6 + 2 × (8 − 3) kaçtır?', '4', ['−20', '10', '16'], 'Parantez 5, çarpım 10, toplam −6 + 10 = 4 olur.']
  ]),
  unit('fractions', 'Kesirler, ondalık sayılar ve yüzdeler', 'Temel', ['numbers'], [
    'a/b kesrinde b sıfır olamaz. Payda eş parçaların sayısı, pay kaç parça alındığıdır. Pay ve paydayı aynı sıfır olmayan sayıya bölmek değeri değiştirmez.',
    'Kesirleri toplarken paydaları eşitle; çarparken payları ve paydaları çarp. Kesre bölmek, sıfır olmayan kesrin çarpma tersiyle çarpmaktır.',
    'Ondalık gösterim basamak değerlerini kullanır. %p, p/100 demektir; bir miktarın %p’si miktar × p/100 olarak hesaplanır.'
  ], ['3/4 + 1/8', ['3/4 = 6/8.', '6/8 + 1/8 = 7/8.', '7 ÷ 8 = 0,875.'], '7/8'], [
    ['1/2 + 1/4 kaçtır?', '3/4', ['2/6', '1/4', '1'], '1/2 = 2/4 olduğundan toplam 3/4 olur.'],
    ['240 sayısının %15’i kaçtır?', '36', ['24', '15', '48'], '240 × 15/100 = 36.'],
    ['(3/5) ÷ (9/10) kaçtır?', '2/3', ['27/50', '3/2', '1/6'], '3/5 × 10/9 = 30/45 = 2/3.']
  ]),
  unit('powers', 'Üslü ve köklü ifadeler', 'Temel', ['fractions'], [
    'aⁿ, n pozitif tam sayı iken n tane a’nın çarpımıdır. Aynı tabanlı üsler çarpılırken üsler toplanır. a ≠ 0 için a⁰ = 1 ve a⁻ⁿ = 1/aⁿ.',
    '√a, a ≥ 0 için karesi a olan negatif olmayan sayıdır. Bu nedenle √(x²) = |x|; x olabilir diye işareti atlama.',
    'Pozitif ifadelerde (aᵐ)ⁿ = aᵐⁿ. Köklü bir ifadeyi sadeleştirirken içindeki tam kare çarpanı dışarı çıkar: √(k²b) = |k|√b.'
  ], ['√72 ifadesini sadeleştir.', ['72 = 36 × 2.', '√36 = 6.', '√72 = 6√2.'], '6√2'], [
    ['2³ kaçtır?', '8', ['6', '9', '4'], '2 × 2 × 2 = 8.'],
    ['3² × 3⁴ kaçtır?', '3⁶', ['3⁸', '9⁶', '6⁶'], 'Tabanlar aynı olduğundan üsler toplanır: 2 + 4 = 6.'],
    ['x = −5 için √(x²) + 2⁻¹ kaçtır?', '11/2', ['−9/2', '9/2', '25/2'], '√25 = 5 ve 2⁻¹ = 1/2; toplam 11/2 olur.']
  ]),
  unit('divisibility', 'Bölünebilme, EBOB ve EKOK', 'Temel', ['numbers'], [
    'Bir tam sayı başka bir pozitif tam sayıya kalansız bölünüyorsa o sayı onun bölenidir. Asal sayıların yalnızca 1 ve kendisi olmak üzere iki pozitif böleni vardır.',
    'EBOB ortak bölenlerin en büyüğüdür; asal çarpanlarda ortak asalların küçük üsleri seçilir. EKOK ortak katların en küçüğüdür; bütün asalların büyük üsleri seçilir.',
    'Pozitif a ve b için EBOB(a,b) × EKOK(a,b) = a × b. Eşit parçalara ayırmada EBOB, tekrarların aynı anda oluşmasında EKOK sık kullanılır.'
  ], ['18 ve 24’ün EBOB ve EKOK’unu bul.', ['18 = 2 × 3²; 24 = 2³ × 3.', 'EBOB = 2 × 3 = 6.', 'EKOK = 2³ × 3² = 72.'], 'EBOB 6, EKOK 72'], [
    ['Aşağıdakilerden hangisi asal sayıdır?', '13', ['1', '9', '21'], '13’ün pozitif bölenleri yalnızca 1 ve 13’tür. 1 asal değildir.'],
    ['EBOB(24, 36) kaçtır?', '12', ['6', '72', '18'], '24 = 2³ × 3 ve 36 = 2² × 3²; ortak küçük üslerle 2² × 3 = 12.'],
    ['12 ve 18 dakikada bir çalan iki zil birlikte çaldı. En az kaç dakika sonra yeniden birlikte çalar?', '36', ['6', '30', '72'], 'EKOK(12,18) = 2² × 3² = 36 dakika.']
  ]),
  unit('ratio', 'Oran ve orantı', 'Temel', ['fractions'], [
    'Oran iki miktarı bölerek karşılaştırır. Karşılaştırılan birimlerin uyumlu olmasına dikkat et.',
    'Doğru orantıda y/x sabittir; biri iki katına çıkınca diğeri de iki katına çıkar. Ters orantıda x × y sabittir.',
    'Bir bütünü a:b oranında paylaştırmak için a+b eş pay düşün; her pay bütün/(a+b) olur. İşçi problemlerinde hızların ve çalışma koşullarının sabit olduğu varsayımını açık tut.'
  ], ['120 TL’yi 2:3 oranında paylaş.', ['Toplam pay sayısı 2 + 3 = 5.', 'Bir pay 120/5 = 24 TL.', 'Paylar 2 × 24 = 48 ve 3 × 24 = 72 TL.'], '48 TL ve 72 TL'], [
    ['2 kalem 10 TL ise aynı kalemlerden 5 tanesi kaç TL?', '25', ['20', '15', '50'], 'Bir kalem 5 TL; 5 × 5 = 25 TL.'],
    ['150 sayısı 2:3 oranında paylaştırılırsa küçük pay kaçtır?', '60', ['50', '75', '90'], '150/(2+3) = 30; küçük pay 2 × 30 = 60.'],
    ['Aynı hızda 4 işçi bir işi 9 günde bitiriyor. Aynı koşullarda 6 işçi kaç günde bitirir?', '6', ['13,5', '4', '8'], 'İş miktarı 4 × 9 = 36 işçi-gün; 36/6 = 6 gün.']
  ]),
  unit('equations', 'Denklemler ve eşitsizlikler', 'Cebir', ['ratio', 'powers'], [
    'Denklemde amaç eşitliği sağlayan değerleri bulmaktır. Eşitliğin iki tarafına aynı işlemi uygularsan denge korunur; sıfırla çarpma çözüm bilgisini kaybettirebilir.',
    'Bilinmeyenli terimleri toplarken yalnızca benzer terimler birleştirilir. Bulduğun değeri başlangıç denkleminde yerine koyarak kontrol et.',
    'Eşitsizliğin iki tarafını negatif sayıyla çarpar veya bölersen yön değişir. Bir ifadeye bölerken sıfır olup olmadığını ve işaretini belirle.'
  ], ['3x + 5 = 20', ['İki taraftan 5 çıkar: 3x = 15.', 'İki tarafı 3’e böl: x = 5.', 'Kontrol: 3 × 5 + 5 = 20.'], 'x = 5'], [
    ['x + 7 = 12 ise x kaçtır?', '5', ['19', '7', '4'], 'Her iki taraftan 7 çıkar: x = 5.'],
    ['−2x > 6 eşitsizliğinin çözümü nedir?', 'x < −3', ['x > −3', 'x < 3', 'x > 3'], '−2’ye bölerken yön değişir: x < −3.'],
    ['2(x − 3) + 5 = 3x − 4 ise x kaçtır?', '3', ['−3', '1', '7'], '2x − 1 = 3x − 4; 3 = x. Yerine koyunca iki taraf da 5 olur.']
  ]),
  unit('absolute', 'Mutlak değer', 'Cebir', ['equations'], [
    '|x| sayının sıfıra uzaklığıdır, bu nedenle negatif olamaz. x ≥ 0 ise |x| = x; x < 0 ise |x| = −x.',
    '|x−a|, x ile a arasındaki uzaklıktır. c ≥ 0 için |x−a| = c denklemi x = a+c veya x = a−c verir.',
    'c > 0 için |x−a| < c, a−c < x < a+c demektir. |x−a| > c ise aralığın dışı alınır.'
  ], ['|x − 2| = 5', ['x − 2 = 5 veya x − 2 = −5.', 'İlkinden x = 7, ikinciden x = −3.', 'İki sayı da 2’ye 5 birim uzaktır.'], 'x = −3 veya x = 7'], [
    ['|−8| kaçtır?', '8', ['−8', '0', '−1'], '−8’in sıfıra uzaklığı 8’dir.'],
    ['|x − 1| = 3 denkleminin çözüm kümesi nedir?', '{−2, 4}', ['{−3, 3}', '{2, 4}', '{−4, 2}'], 'x − 1 = ±3; x = 4 veya −2.'],
    ['|2x − 4| < 6 eşitsizliğinin çözümü nedir?', '−1 < x < 5', ['−5 < x < 1', 'x < −1 veya x > 5', '−2 < x < 4'], '−6 < 2x − 4 < 6; 4 ekleyip 2’ye böl: −1 < x < 5.']
  ]),
  unit('problems', 'Matematiksel problemler', 'Cebir', ['equations', 'ratio'], [
    'Sözel bilgiyi bir değişkene çevir; değişkenin neyi ölçtüğünü ve birimini yaz. Yaş ve kişi sayısı gibi niceliklerin uygun aralığını belirle.',
    'Hareket sorularında yol = hız × zaman kullanılır. Birimleri eşitle: 30 dakika 0,5 saattir.',
    'Denklem çözümünü bağlama geri taşı. Negatif yaş veya yarım kişi gibi bağlama aykırı sonuçları kabul etme.'
  ], ['Bir sayının 3 katının 4 eksiği 20. Sayı kaçtır?', ['Sayıya x de: 3x − 4 = 20.', '3x = 24 olduğundan x = 8.', 'Kontrol: 3 × 8 − 4 = 20.'], '8'], [
    ['Bir kutuda 4 sıra, her sırada 6 kalem var. Toplam kaç kalem?', '24', ['10', '20', '28'], '4 × 6 = 24 kalem.'],
    ['Saatte 60 km giden araç 30 dakikada kaç km yol alır?', '30', ['120', '1800', '60'], '30 dakika = 0,5 saat; 60 × 0,5 = 30 km.'],
    ['Bir baba 40, çocuğu 10 yaşında. Kaç yıl sonra babanın yaşı çocuğunkinin iki katı olur?', '20', ['10', '15', '30'], '40+t = 2(10+t); 20=t. Sonra yaşlar 60 ve 30 olur.']
  ]),
  unit('sets', 'Kümeler ve mantık', 'Cebir', ['numbers'], [
    'Küme belirli elemanların topluluğudur. Birleşim en az bir kümede, kesişim iki kümede de bulunan elemanları içerir.',
    'Sonlu kümeler için |A ∪ B| = |A| + |B| − |A ∩ B|. Kesişim iki kez sayıldığı için bir kez çıkarılır.',
    'Önerme doğru veya yanlış değeri alır. p ve q ancak ikisi de doğruyken doğrudur; p veya q en az biri doğruysa doğrudur. p ⇒ q yalnızca p doğru, q yanlışken yanlıştır.'
  ], ['A={1,2,3}, B={3,4}. A ∪ B ve A ∩ B nedir?', ['Ortak eleman 3: A ∩ B = {3}.', 'Tekrarları saymadan bütün elemanlar: {1,2,3,4}.'], 'Birleşim {1,2,3,4}, kesişim {3}'], [
    ['{1,2} ∩ {2,3} nedir?', '{2}', ['{1,2,3}', '{1,3}', '∅'], 'Kesişim iki kümede de bulunan 2’yi içerir.'],
    ['|A|=12, |B|=9, |A ∩ B|=4 ise |A ∪ B| kaçtır?', '17', ['25', '21', '13'], '12 + 9 − 4 = 17.'],
    ['p yanlış, q doğru ise p ⇒ q önermesinin değeri nedir?', 'Doğru', ['Yanlış', 'Belirsiz', 'Hem doğru hem yanlış'], 'Koşullu önerme yalnızca öncül doğru ve sonuç yanlışken yanlıştır.']
  ]),
  unit('functions', 'Fonksiyonlar', 'Cebir', ['equations', 'sets'], [
    'Fonksiyon, tanım kümesindeki her elemana değer kümesinde tam bir eleman atar. Görüntü kümesi, gerçekten elde edilen değerlerden oluşur.',
    'f(a) bulmak için formüldeki x yerine a yaz. Bileşkede (f∘g)(x) = f(g(x)); önce içerideki fonksiyon uygulanır.',
    'Ters fonksiyon ancak uygun kümelerde bire bir ve örten bir eşleme için vardır. Tersi ararken y=f(x) yazıp x’i y cinsinden çöz ve tanım aralıklarını kontrol et.'
  ], ['f(x)=2x+1 ve g(x)=x² ise (f∘g)(3) kaçtır?', ['Önce g(3)=9.', 'Sonra f(9)=2×9+1=19.'], '19'], [
    ['f(x)=3x−2 ise f(4) kaçtır?', '10', ['12', '14', '6'], '3×4−2 = 10.'],
    ['f(x)=x+2, g(x)=3x ise (g∘f)(2) kaçtır?', '12', ['8', '10', '6'], 'f(2)=4; g(4)=12.'],
    ['f: ℝ→ℝ, f(x)=2x−5 ise f⁻¹(7) kaçtır?', '6', ['9', '1', '−1'], '2x−5=7 denklemini çöz: x=6.']
  ]),
  unit('polynomials', 'Polinomlar', 'Cebir', ['functions', 'powers'], [
    'Polinom, değişkenin negatif olmayan tam sayı kuvvetlerinin sabit katsayılarla sonlu toplamıdır. En büyük sıfır olmayan kuvvet derecedir.',
    'Polinomları toplarken aynı dereceli terimleri birleştir. Çarpmada her terimi diğer polinomun her terimiyle çarp.',
    'P(x)’in x−a ile bölümünden kalan P(a)’dır. P(a)=0 ise x−a bir çarpandır; bu, çarpan teoremi olarak bilinir.'
  ], ['P(x)=x³−2x+1 polinomunun x−2 ile bölümünden kalan nedir?', ['Kalan teoremine göre P(2)’yi hesapla.', 'P(2)=8−4+1=5.'], '5'], [
    ['P(x)=2x²+3x−1 ise P(1) kaçtır?', '4', ['6', '3', '2'], '2+3−1=4.'],
    ['(x+2)(x−2) çarpımı nedir?', 'x²−4', ['x²+4', 'x²−2', 'x²+4x−4'], 'İki kare farkı: x²−2²=x²−4.'],
    ['P(x)=x³+ax+2 ve P(−1)=0 ise a kaçtır?', '1', ['−1', '3', '−3'], '−1−a+2=0; 1−a=0; a=1.']
  ]),
  unit('quadratics', 'İkinci dereceden denklemler', 'Cebir', ['polynomials'], [
    'ax²+bx+c=0 denkleminde a sıfır değildir. Çarpanlara ayırma mümkünse her çarpanın sıfır olabileceğini kullan.',
    'Diskriminant Δ=b²−4ac. Reel sayılarda Δ>0 ise iki farklı kök, Δ=0 ise bir çift katlı kök, Δ<0 ise reel kök yoktur.',
    'Kökler (−b ± √Δ)/(2a) ile bulunur. Kökler toplamı −b/a, çarpımı c/a’dır.'
  ], ['x²−5x+6=0', ['Çarpımları 6 ve toplamları −5 olan sayılar −2 ve −3.', '(x−2)(x−3)=0.', 'x=2 veya x=3.'], '2 ve 3'], [
    ['x²=9 denkleminin reel çözümleri nedir?', '−3 ve 3', ['Yalnızca 3', 'Yalnızca −3', '9 ve −9'], 'Hem 3² hem (−3)² 9’dur.'],
    ['x²−4x+4=0 denkleminin kökü nedir?', '2 (çift katlı)', ['−2 (çift katlı)', '0 ve 4', 'Reel kök yok'], '(x−2)²=0; x=2.'],
    ['2x²−3x−2=0 denkleminin kökleri nedir?', '2 ve −1/2', ['−2 ve 1/2', '1 ve −2', '−1 ve 2'], '(2x+1)(x−2)=0. Toplam 3/2, çarpım −1 olarak da doğrulanır.']
  ]),
  unit('parabola', 'Parabol', 'Cebir', ['quadratics', 'functions'], [
    'y=ax²+bx+c, a≠0 grafiği paraboldür. a pozitifse yukarı, negatifse aşağı açılır.',
    'Simetri ekseni x=−b/(2a), tepe noktası bu x değerinin fonksiyondaki görüntüsüdür. Kareye tamamlama tepeyi doğrudan gösterir.',
    'Yukarı açılan parabolün tepe değeri minimumdur; aşağı açılanınki maksimumdur. x ekseni kesişimleri denklemin reel kökleridir.'
  ], ['y=x²−6x+5 parabolünün tepe noktası nedir?', ['Kareye tamamla: y=(x−3)²−4.', 'Kare en küçük 0’dır ve x=3’te olur.', 'Tepe (3,−4).'], '(3, −4)'], [
    ['y=x² parabolü hangi yöne açılır?', 'Yukarı', ['Aşağı', 'Sağa', 'Sola'], 'x² katsayısı 1>0 olduğu için yukarı açılır.'],
    ['y=(x+2)²−3 parabolünün tepe noktası nedir?', '(−2, −3)', ['(2, −3)', '(−2, 3)', '(2, 3)'], 'Kare x=−2’de sıfırdır; y=−3.'],
    ['y=−x²+4x+1 fonksiyonunun en büyük değeri kaçtır?', '5', ['4', '1', '−3'], 'y=−(x−2)²+5; negatif kare en çok 0’dır, maksimum 5.']
  ]),
  unit('probability', 'Permütasyon, kombinasyon ve olasılık', 'İleri lise', ['fractions', 'sets'], [
    'Ardışık seçimlerde çarpma kuralını kullan. n farklı nesnenin sıralanışı n!; 0!=1 olarak tanımlanır.',
    'Sıra önemliyse permütasyon P(n,r)=n!/(n−r)!; sıra önemsizse kombinasyon C(n,r)=n!/[r!(n−r)!].',
    'Eş olasılıklı sonlu örnek uzayda P(A)=istenen durum/tüm durum. Bağımsız olaylarda ortak olasılık çarpılır; bağımlı seçimlerde ikinci olasılık değişir.'
  ], ['5 kişiden 2 kişilik ekip kaç şekilde seçilir?', ['Ekipte sıra önemli değildir.', 'C(5,2)=5×4/(2×1).', 'Sonuç 10.'], '10'], [
    ['Adil bir zarın çift gelme olasılığı nedir?', '1/2', ['1/3', '2/3', '1/6'], 'Çift yüzler 2,4,6; 3/6=1/2.'],
    ['4 farklı kitap rafa kaç farklı sırayla dizilir?', '24', ['16', '12', '4'], '4!=4×3×2×1=24.'],
    ['3 kırmızı, 2 mavi top içinden geri koymadan 2 top seçiliyor. İkisinin kırmızı olma olasılığı nedir?', '3/10', ['9/25', '2/5', '1/5'], '(3/5)×(2/4)=6/20=3/10.']
  ]),
  unit('statistics', 'İstatistik', 'İleri lise', ['fractions', 'powers'], [
    'Aritmetik ortalama verilerin toplamının veri sayısına bölümüdür. Medyan, sıralanmış verinin ortancası; çift sayıda veri varsa ortadaki iki değerin ortalamasıdır.',
    'Açıklık en büyük eksi en küçük değerdir. Ortalama tek başına dağılımın yayılımını söylemez.',
    'Anakütle varyansı, ortalamadan farkların karelerinin ortalamasıdır. Örneklem varyansında yaygın yansız tahmin için n−1’e bölünür; sorunun hangisini istediğini belirle.'
  ], ['2, 4, 6 verilerinin anakütle varyansı nedir?', ['Ortalama (2+4+6)/3=4.', 'Kare farklar 4,0,4; toplam 8.', 'Anakütle varyansı 8/3.'], '8/3'], [
    ['2, 5, 8 sayılarının ortalaması kaçtır?', '5', ['4', '6', '15'], '(2+5+8)/3=15/3=5.'],
    ['1, 3, 7, 9 verilerinin medyanı kaçtır?', '5', ['3', '7', '4'], 'Ortadaki 3 ve 7’nin ortalaması (3+7)/2=5.'],
    ['1 ve 5 verilerinin anakütle standart sapması kaçtır?', '2', ['4', '√8', '1'], 'Ortalama 3; varyans (4+4)/2=4; standart sapma √4=2.']
  ]),
  unit('geometry', 'Geometri ve analitik geometri', 'İleri lise', ['equations', 'powers'], [
    'Üçgenin iç açıları toplamı 180°; alanı taban × yükseklik / 2’dir. Dik üçgende dik kenar kareleri toplamı hipotenüs karesine eşittir.',
    'Koordinat düzleminde iki noktanın uzaklığı √[(x₂−x₁)²+(y₂−y₁)²] ile bulunur; bu Pisagor’un koordinat biçimidir.',
    'Düşey olmayan doğrunun eğimi (y₂−y₁)/(x₂−x₁); nokta-eğim biçimi y−y₁=m(x−x₁). Düşey doğrunun eğimi tanımsızdır.'
  ], ['(1,2) ve (4,6) arası uzaklık nedir?', ['Yatay fark 3, düşey fark 4.', 'Uzaklık √(3²+4²)=√25.', 'Uzaklık 5 birim.'], '5'], [
    ['Dik kenarları 3 ve 4 olan dik üçgenin hipotenüsü kaçtır?', '5', ['7', '√7', '6'], '√(3²+4²)=√25=5.'],
    ['(1,2) ve (3,8) noktalarından geçen doğrunun eğimi kaçtır?', '3', ['1/3', '2', '6'], '(8−2)/(3−1)=6/2=3.'],
    ['(2,1) noktasından geçen, eğimi −2 olan doğrunun denklemi nedir?', 'y=−2x+5', ['y=−2x−3', 'y=2x−3', 'y=−x+3'], 'y−1=−2(x−2); y=−2x+5.']
  ]),
  unit('trigonometry', 'Trigonometri', 'İleri lise', ['geometry', 'functions'], [
    'Dik üçgende sinüs karşı/hipotenüs, kosinüs komşu/hipotenüs, tanjant karşı/komşudur. Tanjant için payda sıfır olamaz.',
    'Birim çemberde açıya karşılık gelen nokta (cos θ,sin θ)’dır; sin²θ+cos²θ=1. π radyan 180°’dir.',
    'Trigonometrik denklemlerde periyodu ve istenen aralığı dikkate al. Örneğin sin x=0 için radyan cinsinden x=kπ, k tam sayı.'
  ], ['Dar açı θ için sin θ=3/5. cos θ nedir?', ['cos²θ=1−9/25=16/25.', 'Dar açıda kosinüs pozitiftir.', 'cos θ=4/5.'], '4/5'], [
    ['sin 30° kaçtır?', '1/2', ['√3/2', '1', '0'], '30°–60°–90° üçgeninde 30° karşısı hipotenüsün yarısıdır.'],
    ['0 ≤ x < 2π aralığında sin x=0 çözümleri nedir?', '0 ve π', ['0 ve 2π', 'π/2 ve 3π/2', 'Yalnızca π'], 'x=kπ; aralıkta 0 ve π var, 2π dahil değil.'],
    ['sin 2θ için doğru özdeşlik hangisidir?', '2 sin θ cos θ', ['sin²θ', '2 sin θ', 'sin²θ−cos²θ'], 'Sinüs toplam formülü sin(θ+θ)=sinθ cosθ+cosθ sinθ verir.']
  ]),
  unit('logarithms', 'Logaritma', 'İleri lise', ['powers', 'functions'], [
    'logₐx=y ifadesi aʸ=x demektir. Reel logaritmada a>0, a≠1 ve x>0 gerekir.',
    'Pozitif x,y için logₐ(xy)=logₐx+logₐy ve logₐ(x/y)=logₐx−logₐy. Genel olarak log(x+y) toplamına ayrılmaz.',
    'Taban değiştirme logₐx=ln x/ln a. Denklem çözerken bulunan adayların bütün logaritma içlerini pozitif yaptığını kontrol et.'
  ], ['log₂(x−1)=3 denklemini çöz.', ['Tanım: x−1>0, yani x>1.', 'x−1=2³=8.', 'x=9 tanım koşulunu sağlar.'], '9'], [
    ['log₂8 kaçtır?', '3', ['4', '2', '1/3'], '2³=8 olduğundan log₂8=3.'],
    ['log₁₀2 + log₁₀5 kaçtır?', '1', ['7', '10', '0'], 'log₁₀(2×5)=log₁₀10=1.'],
    ['log₂(x−1)+log₂(x+1)=3 denkleminin reel çözümü nedir?', '3', ['−3 ve 3', '−3', '√7'], 'Tanım x>1; log₂(x²−1)=3, x²=9; yalnızca 3 uygundur.']
  ]),
  unit('sequences', 'Diziler', 'İleri lise', ['functions', 'powers'], [
    'Dizi pozitif tam sayılarla indekslenen bir fonksiyon gibi düşünülebilir. Genel terim aₙ, her sıradaki değeri belirtir.',
    'Aritmetik dizide ardışık fark d sabittir: aₙ=a₁+(n−1)d. İlk n terim toplamı n(a₁+aₙ)/2.',
    'Geometrik dizide ardışık oran r sabittir: aₙ=a₁rⁿ⁻¹. r≠1 için ilk n terim toplamı a₁(1−rⁿ)/(1−r).'
  ], ['3,7,11,… aritmetik dizisinin 10. terimi nedir?', ['İlk terim 3, ortak fark 4.', 'a₁₀=3+(10−1)×4.', 'a₁₀=39.'], '39'], [
    ['2, 5, 8, … aritmetik dizisinin sonraki terimi kaçtır?', '11', ['10', '12', '13'], 'Ortak fark 3’tür; 8+3=11.'],
    ['İlk terimi 2, oranı 3 olan geometrik dizinin 4. terimi kaçtır?', '54', ['18', '81', '24'], 'a₄=2×3³=54.'],
    ['1+2+4+8+16 toplamı kaçtır?', '31', ['30', '32', '16'], 'Beş terimli geometrik toplam (2⁵−1)/(2−1)=31.']
  ]),
  unit('complex', 'Karmaşık sayılar', 'İleri lise', ['quadratics'], [
    'i²=−1 kabulüyle a+bi sayıları tanımlanır. Reel kısmı a, sanal kısmın katsayısı b’dir.',
    'Toplamada reel ve sanal terimleri ayrı birleştir; çarpmada dağıt ve i² yerine −1 yaz.',
    'a+bi’nin eşleniği a−bi, modülü √(a²+b²). Sıfır olmayan karmaşık sayıyla bölmede pay ve paydayı paydanın eşleniğiyle çarp.'
  ], ['(2+i)(3−i) çarpımını bul.', ['Dağıt: 6−2i+3i−i².', 'i²=−1 olduğundan −i²=1.', 'Sonuç 7+i.'], '7+i'], [
    ['i² kaçtır?', '−1', ['1', 'i', '0'], 'i’nin tanımı i²=−1’dir.'],
    ['3−4i sayısının modülü kaçtır?', '5', ['7', '1', '25'], '√(3²+(−4)²)=√25=5.'],
    ['1/(1+i) ifadesi nedir?', '(1−i)/2', ['1−i', '(1+i)/2', '−i'], 'Pay ve paydayı 1−i ile çarp: (1−i)/(1−i²)=(1−i)/2.']
  ]),
  unit('limits', 'Limit ve süreklilik', 'Analiz', ['functions', 'polynomials'], [
    'Limit, x bir noktaya yaklaşırken fonksiyon değerlerinin yaklaştığı değerdir; fonksiyonun o noktada tanımlı olması şart değildir.',
    'İki taraflı limit için sağ ve sol limitler aynı olmalıdır. Rasyonel ifadede 0/0 belirsizliği çıkarsa çarpanlara ayırıp sadeleştirme uygulanabilir; 0/0 bir sayı değildir.',
    'f, a’da sürekli ise f(a) tanımlıdır, limit vardır ve lim f(x)=f(a). Süreklilik, limit değeriyle nokta değerini eşleştirir.'
  ], ['x→2 iken (x²−4)/(x−2) limiti nedir?', ['x²−4=(x−2)(x+2).', 'x≠2 için ifade x+2’ye eşittir.', 'x→2 iken x+2→4; noktanın silinmesi limiti değiştirmez.'], '4'], [
    ['x→3 iken (2x+1) limiti kaçtır?', '7', ['6', '3', 'Tanımsız'], 'Polinom sürekli olduğundan x=3 yaz: 2×3+1=7.'],
    ['x→1 iken (x²−1)/(x−1) limiti kaçtır?', '2', ['0', '1', 'Limit yok'], 'x≠1 için ifade x+1’dir; limit 2.'],
    ['f(x)=1 (x<0), f(x)=2 (x≥0). x→0 iki taraflı limiti nedir?', 'Yoktur', ['1', '2', '3/2'], 'Sol limit 1, sağ limit 2; eşit olmadıklarından iki taraflı limit yoktur.']
  ]),
  unit('derivative', 'Türev', 'Analiz', ['limits'], [
    'Türev, lim[h→0] (f(x+h)−f(x))/h ile tanımlanan anlık değişim oranıdır. Grafikte teğetin eğimini verir.',
    '(xⁿ)′=nxⁿ⁻¹; sabitin türevi 0. Toplamda türevler toplanır. Çarpımda (uv)′=u′v+uv′; bileşkede zincir kuralı kullanılır.',
    'Türevin sıfır olduğu yerler ekstremum adayıdır; hepsi ekstremum değildir. İşaret değişimi veya ikinci türev ile incele; tanım aralığı uçlarını unutma.'
  ], ['f(x)=(x²+1)³ için f′(x) nedir?', ['Dış fonksiyonun türevi: 3(x²+1)².', 'İç fonksiyonun türevi: 2x.', 'Çarp: f′(x)=6x(x²+1)².'], '6x(x²+1)²'], [
    ['f(x)=x³ ise f′(x) nedir?', '3x²', ['x²', '3x', 'x⁴/4'], 'Kuvvet kuralı: üs öne gelir, üs 1 azalır.'],
    ['f(x)=x²−4x ise x=3’te teğetin eğimi kaçtır?', '2', ['−2', '3', '6'], 'f′(x)=2x−4; f′(3)=2.'],
    ['f(x)=x·eˣ fonksiyonunun türevi nedir?', 'eˣ(1+x)', ['eˣ', 'xeˣ', 'eˣ(1−x)'], 'Çarpım kuralıyla 1·eˣ+x·eˣ=eˣ(1+x).']
  ]),
  unit('integral', 'İntegral', 'Analiz', ['derivative'], [
    'Belirsiz integral türev alma işleminin tersidir; bütün ilkel fonksiyonlar +C sabitiyle ifade edilir.',
    'n≠−1 için ∫xⁿ dx=xⁿ⁺¹/(n+1)+C. ∫1/x dx=ln|x|+C, sıfırı içermeyen aralıklarda geçerlidir.',
    'Belirli integral için uygun bir ilkel fonksiyon F ile ∫ₐᵇf(x)dx=F(b)−F(a). Bu işaretli alandır; geometrik toplam alan için negatif bölümleri ayır.'
  ], ['∫₀² 3x² dx değerini bul.', ['3x²’nin bir ilkel fonksiyonu x³.', 'Üst sınırda 2³=8, alt sınırda 0³=0.', 'F(2)−F(0)=8.'], '8'], [
    ['∫2x dx nedir?', 'x²+C', ['2x²+C', '2+C', 'x+C'], '(x²)′=2x olduğundan cevap x²+C.'],
    ['∫₀¹ 2x dx kaçtır?', '1', ['2', '0', '1/2'], 'İlkel fonksiyon x²; 1²−0²=1.'],
    ['∫₋₁¹ x dx kaçtır?', '0', ['1', '−1', '2'], 'İlkel fonksiyon x²/2; iki uç değeri de 1/2. İşaretli alanlar birbirini götürür.']
  ]),
  unit('matrices', 'Matrisler', 'Üniversite', ['equations'], [
    'Matris sayıların satır ve sütun düzenidir. m×n boyutunda m satır, n sütun vardır; aynı boyuttakiler eleman eleman toplanır.',
    'A m×n ve B n×p ise AB m×p boyutundadır. Her eleman A’nın bir satırıyla B’nin bir sütununun iç çarpımıdır; genelde AB≠BA.',
    '2×2 matrisin determinantı ad−bc. Determinant sıfır değilse tersi (1/(ad−bc))[[d,−b],[−c,a]] biçimindedir.'
  ], ['A=[[1,2],[3,4]] için det(A) nedir?', ['Ana köşegen çarpımı 1×4=4.', 'Diğer köşegen çarpımı 2×3=6.', 'det(A)=4−6=−2.'], '−2'], [
    ['2×3 matrisin kaç elemanı vardır?', '6', ['5', '9', '8'], '2 satır × 3 sütun = 6 eleman.'],
    ['[[2,1],[0,3]] matrisinin determinantı kaçtır?', '6', ['5', '3', '0'], '2×3−1×0=6.'],
    ['A=[[1,2],[0,1]], B=[[1,0],[3,1]]. AB’nin ilk satırı nedir?', '[7, 2]', ['[1, 2]', '[1, 0]', '[3, 7]'], 'İlk satır: [1×1+2×3, 1×0+2×1]=[7,2].']
  ]),
  unit('linear-algebra', 'Lineer cebir', 'Üniversite', ['matrices'], [
    'Vektörler toplanabilir ve sayıyla çarpılabilir. Vektörlerin lineer birleşimi a₁v₁+…+aₖvₖ biçimindedir.',
    'Yalnızca bütün katsayılar sıfırken toplam sıfır oluyorsa vektörler lineer bağımsızdır. Bir baz, uzayı geren bağımsız vektörler kümesidir.',
    'Av=λv, v≠0 eşitliğinde v özvektör, λ özdeğerdir. Özdeğerleri bulmak için det(A−λI)=0 çözülür.'
  ], ['A=[[2,0],[0,3]] matrisinin özdeğerleri nedir?', ['det(A−λI)=(2−λ)(3−λ).', 'Çarpımın sıfır olması için λ=2 veya λ=3.'], '2 ve 3'], [
    ['(1,2)+(3,−1) vektör toplamı nedir?', '(4,1)', ['(3,−2)', '(2,3)', '(4,3)'], 'Bileşen bileşen topla: (1+3,2−1)=(4,1).'],
    ['ℝ² içinde (1,0) ve (0,1) vektörleri için hangisi doğrudur?', 'Bir baz oluştururlar', ['Lineer bağımlıdırlar', 'Yalnızca bir doğruyu gererler', 'Toplamları sıfırdır'], 'Bağımsızdırlar ve her (a,b)=a(1,0)+b(0,1) yazılabilir.'],
    ['A=[[4,0],[0,−1]] ve v=(0,2) için Av=λv eşitliğinde λ kaçtır?', '−1', ['4', '2', '0'], 'Av=(0,−2)=−1·(0,2); λ=−1.']
  ]),
  unit('differential-equations', 'Diferansiyel denklemler', 'Üniversite', ['integral'], [
    'Diferansiyel denklem bilinmeyen fonksiyon ile türevleri arasında ilişki kurar. Çözüm fonksiyon olmalıdır; türevini hesaplayıp denklemde yerine koyarak doğrula.',
    'y′=ky denkleminin genel çözümü y=Ceᵏˣ. Başlangıç koşulu y(x₀)=y₀ sabiti belirler.',
    'Ayrılabilir y′=g(x)h(y) denklemlerinde h(y)≠0 bölgelerinde dy/h(y)=g(x)dx yazıp integral al. h(y)=0 olan sabit çözümleri ayrıca incele; bölerek kaybetme.'
  ], ['y′=2y, y(0)=3 başlangıç değer problemini çöz.', ['Genel çözüm y=Ce²ˣ.', 'y(0)=C=3.', 'Kontrol: y′=6e²ˣ=2y.'], 'y=3e²ˣ'], [
    ['y′=3 ve y(0)=2 ise y(x) nedir?', '3x+2', ['3x', '2x+3', '3e²ˣ'], 'İntegralle y=3x+C; x=0 için C=2.'],
    ['y′=y ve y(0)=4 ise y(x) nedir?', '4eˣ', ['e⁴ˣ', '4x', 'eˣ+4'], 'y=Ceˣ ve başlangıç koşulundan C=4.'],
    ['y′=y(1−y) denkleminin sabit çözümleri nedir?', 'y=0 ve y=1', ['Yalnızca y=0', 'Yalnızca y=1', 'y=−1 ve y=1'], 'Sabit çözümde y′=0; y(1−y)=0, yani y=0 veya 1.']
  ]),
  unit('advanced', 'İleri matematiğe giriş: yakınsama ve ispat', 'Üniversite', ['limits', 'sequences', 'linear-algebra'], [
    'İleri matematikte örnekler sezgi sağlar; bütün durumlar için iddia ispat ister. Bir evrensel iddiayı çürütmek için tek karşı örnek yeterlidir.',
    'aₙ dizisinin L’ye yakınsaması: her ε>0 için öyle N vardır ki n>N olduğunda |aₙ−L|<ε. N, ε’ye bağlı olabilir.',
    'Seri, kısmi toplamlar dizisinin limitidir. aₙ→0, Σaₙ’nin yakınsaması için gerekli ama yeterli değildir; harmonik seri karşı örnektir. Bu bir giriş ünitesidir; ileri analiz, soyut cebir ve topolojinin tamamını kapsamaz.'
  ], ['aₙ=1/n için ε=0,01 alındığında hangi n’lerde |aₙ−0|<ε?', ['1/n<0,01=1/100.', 'n pozitif olduğundan eşitsizlik n>100 olur.', 'n=100 eşitlik verir; kesin küçüklük için n≥101 gerekir.'], 'n > 100'], [
    ['aₙ=1/n dizisinin limiti nedir?', '0', ['1', 'Sonsuz', 'Limit yok'], 'Her pozitif ε için n>1/ε seçilirse 1/n<ε olur.'],
    ['“Her asal sayı tektir” iddiasına karşı örnek hangisidir?', '2', ['3', '9', '1'], '2 asaldır ve çifttir; tek bir karşı örnek evrensel iddiayı çürütür.'],
    ['Σₙ₌₁∞ 1/n harmonik serisi için hangisi doğrudur?', 'Terimler 0’a gider ama seri ıraksar', ['Terimler 0’a gitmez', 'Serinin toplamı 1’dir', 'Her sıfıra giden terimli seri yakınsar'], 'Terimlerin sıfıra gitmesi yeterli değildir. 1/2 + (1/3+1/4) + (1/5+…+1/8) gruplarının her biri en az 1/2 ekler.']
  ])
];

const byId = new Map(COURSES.map(course => [course.id, course]));
export function getCourse(id) { return byId.get(id) || null; }

// A short placement sample is a recommendation, not a certificate of proficiency.
const diagnosticIds = ['numbers', 'fractions', 'equations', 'functions', 'geometry', 'trigonometry', 'limits', 'derivative'];
export function diagnosticQuestions() {
  return diagnosticIds.map(courseId => ({courseId, ...byId.get(courseId).exercises.medium}));
}
export function assessDiagnostic(responses = []) {
  const unique = new Map();
  if (Array.isArray(responses)) for (const response of responses) {
    if (response && diagnosticIds.includes(response.courseId) && typeof response.correct === 'boolean') unique.set(response.courseId, response.correct);
  }
  const strengths = diagnosticIds.filter(id => unique.get(id) === true);
  const focus = diagnosticIds.filter(id => unique.get(id) === false);
  const answered = unique.size;
  const score = strengths.length;
  const level = answered < diagnosticIds.length ? 'Eksik değerlendirme' : score < 3 ? 'Temelden başla' : score < 6 ? 'Temeli güçlendir' : 'İleri konulara hazırlan';
  // Recommend failed foundation prerequisites before their dependent course.
  const recommendations = [];
  const add = id => {
    const course = byId.get(id);
    for (const prerequisite of course.prerequisites) if (!strengths.includes(prerequisite)) add(prerequisite);
    if (!recommendations.includes(id) && !strengths.includes(id)) recommendations.push(id);
  };
  for (const id of focus) add(id);
  if (!recommendations.length) for (const id of answered < diagnosticIds.length ? diagnosticIds.filter(id => !unique.has(id)) : ['integral', 'matrices']) add(id);
  return {level, answered, total: diagnosticIds.length, score, strengths, focus, recommendations: recommendations.slice(0, 6)};
}

function progressSummary(value) {
  if (!value || typeof value !== 'object') return {attempts: 0, mastery: 0};
  const total = Number.isInteger(value.total) && value.total >= 0 ? value.total : 0;
  const correct = Number.isInteger(value.correct) && value.correct >= 0 && value.correct <= total ? value.correct : 0;
  // Explicit mastery remains useful for importing a diagnostic recommendation.
  const mastery = total ? correct / total : Number.isFinite(value.mastery) && value.mastery >= 0 && value.mastery <= 1 ? value.mastery : 0;
  return {attempts: total, mastery};
}
export function buildStudyPlan(progress = {}, limit = 5) {
  const state = progress && typeof progress === 'object' ? progress : {};
  const read = id => progressSummary(Object.hasOwn(state, id) ? state[id] : null);
  const mastered = id => { const p = read(id); return p.mastery >= 0.8 && (p.attempts >= 3 || p.attempts === 0 && Object.hasOwn(state, id) && Number.isFinite(state[id]?.mastery)); };
  const pending = COURSES.filter(course => !mastered(course.id));
  // Weak practiced topics come first only after their prerequisites are ready.
  const ready = pending.filter(course => course.prerequisites.every(mastered));
  ready.sort((a, b) => {
    const pa = read(a.id), pb = read(b.id);
    return Number(pb.attempts > 0) - Number(pa.attempts > 0) || pa.mastery - pb.mastery || COURSES.indexOf(a) - COURSES.indexOf(b);
  });
  const cap = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 10) : 5;
  return ready.slice(0, cap).map(course => {
    const p = read(course.id);
    return {courseId: course.id, title: course.title, reason: p.attempts ? 'Yanlışlarını gözden geçir ve benzer alıştırmalarla pekiştir.' : course.prerequisites.length ? 'Ön koşullar hazır; çözümlü örnekle başla.' : 'Başlangıç becerilerini küçük adımlarla oluştur.', minutes: p.attempts ? 15 : 20, prerequisites: course.prerequisites.slice()};
  });
}
