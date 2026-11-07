// Concept explanations only. Questions must come from the verified source registry.
export const COURSES = [
  {
    "id": "numbers",
    "title": "Sayılar ve dört işlem",
    "group": "Temel",
    "prerequisites": [],
    "lessonSteps": [
      "Doğal sayılar sayma ve miktar belirtir. Negatif sayılarla birlikte tam sayıları elde ederiz. Sayı doğrusunda sağdaki sayı daha büyüktür.",
      "Toplama ve çıkarma birbirinin tersidir; çarpma eşit grupları toplar, bölme eşit gruplara ayırır. Sıfıra bölme tanımsızdır.",
      "Önce parantezleri, sonra üsleri, sonra çarpma ve bölmeyi soldan sağa, en son toplama ve çıkarmayı soldan sağa yap. Aynı öncelikteki işlemlerin sırası korunur."
    ]
  },
  {
    "id": "fractions",
    "title": "Kesirler, ondalık sayılar ve yüzdeler",
    "group": "Temel",
    "prerequisites": [
      "numbers"
    ],
    "lessonSteps": [
      "a/b kesrinde b sıfır olamaz. Payda eş parçaların sayısı, pay kaç parça alındığıdır. Pay ve paydayı aynı sıfır olmayan sayıya bölmek değeri değiştirmez.",
      "Kesirleri toplarken paydaları eşitle; çarparken payları ve paydaları çarp. Kesre bölmek, sıfır olmayan kesrin çarpma tersiyle çarpmaktır.",
      "Ondalık gösterim basamak değerlerini kullanır. %p, p/100 demektir; bir miktarın %p’si miktar × p/100 olarak hesaplanır."
    ]
  },
  {
    "id": "powers",
    "title": "Üslü ve köklü ifadeler",
    "group": "Temel",
    "prerequisites": [
      "fractions"
    ],
    "lessonSteps": [
      "aⁿ, n pozitif tam sayı iken n tane a’nın çarpımıdır. Aynı tabanlı üsler çarpılırken üsler toplanır. a ≠ 0 için a⁰ = 1 ve a⁻ⁿ = 1/aⁿ.",
      "√a, a ≥ 0 için karesi a olan negatif olmayan sayıdır. Bu nedenle √(x²) = |x|; x olabilir diye işareti atlama.",
      "Pozitif ifadelerde (aᵐ)ⁿ = aᵐⁿ. Köklü bir ifadeyi sadeleştirirken içindeki tam kare çarpanı dışarı çıkar: √(k²b) = |k|√b."
    ]
  },
  {
    "id": "divisibility",
    "title": "Bölünebilme, EBOB ve EKOK",
    "group": "Temel",
    "prerequisites": [
      "numbers"
    ],
    "lessonSteps": [
      "Bir tam sayı başka bir pozitif tam sayıya kalansız bölünüyorsa o sayı onun bölenidir. Asal sayıların yalnızca 1 ve kendisi olmak üzere iki pozitif böleni vardır.",
      "EBOB ortak bölenlerin en büyüğüdür; asal çarpanlarda ortak asalların küçük üsleri seçilir. EKOK ortak katların en küçüğüdür; bütün asalların büyük üsleri seçilir.",
      "Pozitif a ve b için EBOB(a,b) × EKOK(a,b) = a × b. Eşit parçalara ayırmada EBOB, tekrarların aynı anda oluşmasında EKOK sık kullanılır."
    ]
  },
  {
    "id": "ratio",
    "title": "Oran ve orantı",
    "group": "Temel",
    "prerequisites": [
      "fractions"
    ],
    "lessonSteps": [
      "Oran iki miktarı bölerek karşılaştırır. Karşılaştırılan birimlerin uyumlu olmasına dikkat et.",
      "Doğru orantıda y/x sabittir; biri iki katına çıkınca diğeri de iki katına çıkar. Ters orantıda x × y sabittir.",
      "Bir bütünü a:b oranında paylaştırmak için a+b eş pay düşün; her pay bütün/(a+b) olur. İşçi problemlerinde hızların ve çalışma koşullarının sabit olduğu varsayımını açık tut."
    ]
  },
  {
    "id": "equations",
    "title": "Denklemler ve eşitsizlikler",
    "group": "Cebir",
    "prerequisites": [
      "ratio",
      "powers"
    ],
    "lessonSteps": [
      "Denklemde amaç eşitliği sağlayan değerleri bulmaktır. Eşitliğin iki tarafına aynı işlemi uygularsan denge korunur; sıfırla çarpma çözüm bilgisini kaybettirebilir.",
      "Bilinmeyenli terimleri toplarken yalnızca benzer terimler birleştirilir. Bulduğun değeri başlangıç denkleminde yerine koyarak kontrol et.",
      "Eşitsizliğin iki tarafını negatif sayıyla çarpar veya bölersen yön değişir. Bir ifadeye bölerken sıfır olup olmadığını ve işaretini belirle."
    ]
  },
  {
    "id": "absolute",
    "title": "Mutlak değer",
    "group": "Cebir",
    "prerequisites": [
      "equations"
    ],
    "lessonSteps": [
      "|x| sayının sıfıra uzaklığıdır, bu nedenle negatif olamaz. x ≥ 0 ise |x| = x; x < 0 ise |x| = −x.",
      "|x−a|, x ile a arasındaki uzaklıktır. c ≥ 0 için |x−a| = c denklemi x = a+c veya x = a−c verir.",
      "c > 0 için |x−a| < c, a−c < x < a+c demektir. |x−a| > c ise aralığın dışı alınır."
    ]
  },
  {
    "id": "problems",
    "title": "Matematiksel problemler",
    "group": "Cebir",
    "prerequisites": [
      "equations",
      "ratio"
    ],
    "lessonSteps": [
      "Sözel bilgiyi bir değişkene çevir; değişkenin neyi ölçtüğünü ve birimini yaz. Yaş ve kişi sayısı gibi niceliklerin uygun aralığını belirle.",
      "Hareket sorularında yol = hız × zaman kullanılır. Birimleri eşitle: 30 dakika 0,5 saattir.",
      "Denklem çözümünü bağlama geri taşı. Negatif yaş veya yarım kişi gibi bağlama aykırı sonuçları kabul etme."
    ]
  },
  {
    "id": "sets",
    "title": "Kümeler ve mantık",
    "group": "Cebir",
    "prerequisites": [
      "numbers"
    ],
    "lessonSteps": [
      "Küme belirli elemanların topluluğudur. Birleşim en az bir kümede, kesişim iki kümede de bulunan elemanları içerir.",
      "Sonlu kümeler için |A ∪ B| = |A| + |B| − |A ∩ B|. Kesişim iki kez sayıldığı için bir kez çıkarılır.",
      "Önerme doğru veya yanlış değeri alır. p ve q ancak ikisi de doğruyken doğrudur; p veya q en az biri doğruysa doğrudur. p ⇒ q yalnızca p doğru, q yanlışken yanlıştır."
    ]
  },
  {
    "id": "functions",
    "title": "Fonksiyonlar",
    "group": "Cebir",
    "prerequisites": [
      "equations",
      "sets"
    ],
    "lessonSteps": [
      "Fonksiyon, tanım kümesindeki her elemana değer kümesinde tam bir eleman atar. Görüntü kümesi, gerçekten elde edilen değerlerden oluşur.",
      "f(a) bulmak için formüldeki x yerine a yaz. Bileşkede (f∘g)(x) = f(g(x)); önce içerideki fonksiyon uygulanır.",
      "Ters fonksiyon ancak uygun kümelerde bire bir ve örten bir eşleme için vardır. Tersi ararken y=f(x) yazıp x’i y cinsinden çöz ve tanım aralıklarını kontrol et."
    ]
  },
  {
    "id": "polynomials",
    "title": "Polinomlar",
    "group": "Cebir",
    "prerequisites": [
      "functions",
      "powers"
    ],
    "lessonSteps": [
      "Polinom, değişkenin negatif olmayan tam sayı kuvvetlerinin sabit katsayılarla sonlu toplamıdır. En büyük sıfır olmayan kuvvet derecedir.",
      "Polinomları toplarken aynı dereceli terimleri birleştir. Çarpmada her terimi diğer polinomun her terimiyle çarp.",
      "P(x)’in x−a ile bölümünden kalan P(a)’dır. P(a)=0 ise x−a bir çarpandır; bu, çarpan teoremi olarak bilinir."
    ]
  },
  {
    "id": "quadratics",
    "title": "İkinci dereceden denklemler",
    "group": "Cebir",
    "prerequisites": [
      "polynomials"
    ],
    "lessonSteps": [
      "ax²+bx+c=0 denkleminde a sıfır değildir. Çarpanlara ayırma mümkünse her çarpanın sıfır olabileceğini kullan.",
      "Diskriminant Δ=b²−4ac. Reel sayılarda Δ>0 ise iki farklı kök, Δ=0 ise bir çift katlı kök, Δ<0 ise reel kök yoktur.",
      "Kökler (−b ± √Δ)/(2a) ile bulunur. Kökler toplamı −b/a, çarpımı c/a’dır."
    ]
  },
  {
    "id": "parabola",
    "title": "Parabol",
    "group": "Cebir",
    "prerequisites": [
      "quadratics",
      "functions"
    ],
    "lessonSteps": [
      "y=ax²+bx+c, a≠0 grafiği paraboldür. a pozitifse yukarı, negatifse aşağı açılır.",
      "Simetri ekseni x=−b/(2a), tepe noktası bu x değerinin fonksiyondaki görüntüsüdür. Kareye tamamlama tepeyi doğrudan gösterir.",
      "Yukarı açılan parabolün tepe değeri minimumdur; aşağı açılanınki maksimumdur. x ekseni kesişimleri denklemin reel kökleridir."
    ]
  },
  {
    "id": "probability",
    "title": "Permütasyon, kombinasyon ve olasılık",
    "group": "İleri lise",
    "prerequisites": [
      "fractions",
      "sets"
    ],
    "lessonSteps": [
      "Ardışık seçimlerde çarpma kuralını kullan. n farklı nesnenin sıralanışı n!; 0!=1 olarak tanımlanır.",
      "Sıra önemliyse permütasyon P(n,r)=n!/(n−r)!; sıra önemsizse kombinasyon C(n,r)=n!/[r!(n−r)!].",
      "Eş olasılıklı sonlu örnek uzayda P(A)=istenen durum/tüm durum. Bağımsız olaylarda ortak olasılık çarpılır; bağımlı seçimlerde ikinci olasılık değişir."
    ]
  },
  {
    "id": "statistics",
    "title": "İstatistik",
    "group": "İleri lise",
    "prerequisites": [
      "fractions",
      "powers"
    ],
    "lessonSteps": [
      "Aritmetik ortalama verilerin toplamının veri sayısına bölümüdür. Medyan, sıralanmış verinin ortancası; çift sayıda veri varsa ortadaki iki değerin ortalamasıdır.",
      "Açıklık en büyük eksi en küçük değerdir. Ortalama tek başına dağılımın yayılımını söylemez.",
      "Anakütle varyansı, ortalamadan farkların karelerinin ortalamasıdır. Örneklem varyansında yaygın yansız tahmin için n−1’e bölünür; sorunun hangisini istediğini belirle."
    ]
  },
  {
    "id": "geometry",
    "title": "Geometri ve analitik geometri",
    "group": "İleri lise",
    "prerequisites": [
      "equations",
      "powers"
    ],
    "lessonSteps": [
      "Üçgenin iç açıları toplamı 180°; alanı taban × yükseklik / 2’dir. Dik üçgende dik kenar kareleri toplamı hipotenüs karesine eşittir.",
      "Koordinat düzleminde iki noktanın uzaklığı √[(x₂−x₁)²+(y₂−y₁)²] ile bulunur; bu Pisagor’un koordinat biçimidir.",
      "Düşey olmayan doğrunun eğimi (y₂−y₁)/(x₂−x₁); nokta-eğim biçimi y−y₁=m(x−x₁). Düşey doğrunun eğimi tanımsızdır."
    ]
  },
  {
    "id": "trigonometry",
    "title": "Trigonometri",
    "group": "İleri lise",
    "prerequisites": [
      "geometry",
      "functions"
    ],
    "lessonSteps": [
      "Dik üçgende sinüs karşı/hipotenüs, kosinüs komşu/hipotenüs, tanjant karşı/komşudur. Tanjant için payda sıfır olamaz.",
      "Birim çemberde açıya karşılık gelen nokta (cos θ,sin θ)’dır; sin²θ+cos²θ=1. π radyan 180°’dir.",
      "Trigonometrik denklemlerde periyodu ve istenen aralığı dikkate al. Örneğin sin x=0 için radyan cinsinden x=kπ, k tam sayı."
    ]
  },
  {
    "id": "logarithms",
    "title": "Logaritma",
    "group": "İleri lise",
    "prerequisites": [
      "powers",
      "functions"
    ],
    "lessonSteps": [
      "logₐx=y ifadesi aʸ=x demektir. Reel logaritmada a>0, a≠1 ve x>0 gerekir.",
      "Pozitif x,y için logₐ(xy)=logₐx+logₐy ve logₐ(x/y)=logₐx−logₐy. Genel olarak log(x+y) toplamına ayrılmaz.",
      "Taban değiştirme logₐx=ln x/ln a. Denklem çözerken bulunan adayların bütün logaritma içlerini pozitif yaptığını kontrol et."
    ]
  },
  {
    "id": "sequences",
    "title": "Diziler",
    "group": "İleri lise",
    "prerequisites": [
      "functions",
      "powers"
    ],
    "lessonSteps": [
      "Dizi pozitif tam sayılarla indekslenen bir fonksiyon gibi düşünülebilir. Genel terim aₙ, her sıradaki değeri belirtir.",
      "Aritmetik dizide ardışık fark d sabittir: aₙ=a₁+(n−1)d. İlk n terim toplamı n(a₁+aₙ)/2.",
      "Geometrik dizide ardışık oran r sabittir: aₙ=a₁rⁿ⁻¹. r≠1 için ilk n terim toplamı a₁(1−rⁿ)/(1−r)."
    ]
  },
  {
    "id": "complex",
    "title": "Karmaşık sayılar",
    "group": "İleri lise",
    "prerequisites": [
      "quadratics"
    ],
    "lessonSteps": [
      "i²=−1 kabulüyle a+bi sayıları tanımlanır. Reel kısmı a, sanal kısmın katsayısı b’dir.",
      "Toplamada reel ve sanal terimleri ayrı birleştir; çarpmada dağıt ve i² yerine −1 yaz.",
      "a+bi’nin eşleniği a−bi, modülü √(a²+b²). Sıfır olmayan karmaşık sayıyla bölmede pay ve paydayı paydanın eşleniğiyle çarp."
    ]
  },
  {
    "id": "limits",
    "title": "Limit ve süreklilik",
    "group": "Analiz",
    "prerequisites": [
      "functions",
      "polynomials"
    ],
    "lessonSteps": [
      "Limit, x bir noktaya yaklaşırken fonksiyon değerlerinin yaklaştığı değerdir; fonksiyonun o noktada tanımlı olması şart değildir.",
      "İki taraflı limit için sağ ve sol limitler aynı olmalıdır. Rasyonel ifadede 0/0 belirsizliği çıkarsa çarpanlara ayırıp sadeleştirme uygulanabilir; 0/0 bir sayı değildir.",
      "f, a’da sürekli ise f(a) tanımlıdır, limit vardır ve lim f(x)=f(a). Süreklilik, limit değeriyle nokta değerini eşleştirir."
    ]
  },
  {
    "id": "derivative",
    "title": "Türev",
    "group": "Analiz",
    "prerequisites": [
      "limits"
    ],
    "lessonSteps": [
      "Türev, lim[h→0] (f(x+h)−f(x))/h ile tanımlanan anlık değişim oranıdır. Grafikte teğetin eğimini verir.",
      "(xⁿ)′=nxⁿ⁻¹; sabitin türevi 0. Toplamda türevler toplanır. Çarpımda (uv)′=u′v+uv′; bileşkede zincir kuralı kullanılır.",
      "Türevin sıfır olduğu yerler ekstremum adayıdır; hepsi ekstremum değildir. İşaret değişimi veya ikinci türev ile incele; tanım aralığı uçlarını unutma."
    ]
  },
  {
    "id": "integral",
    "title": "İntegral",
    "group": "Analiz",
    "prerequisites": [
      "derivative"
    ],
    "lessonSteps": [
      "Belirsiz integral türev alma işleminin tersidir; bütün ilkel fonksiyonlar +C sabitiyle ifade edilir.",
      "n≠−1 için ∫xⁿ dx=xⁿ⁺¹/(n+1)+C. ∫1/x dx=ln|x|+C, sıfırı içermeyen aralıklarda geçerlidir.",
      "Belirli integral için uygun bir ilkel fonksiyon F ile ∫ₐᵇf(x)dx=F(b)−F(a). Bu işaretli alandır; geometrik toplam alan için negatif bölümleri ayır."
    ]
  },
  {
    "id": "matrices",
    "title": "Matrisler",
    "group": "Üniversite",
    "prerequisites": [
      "equations"
    ],
    "lessonSteps": [
      "Matris sayıların satır ve sütun düzenidir. m×n boyutunda m satır, n sütun vardır; aynı boyuttakiler eleman eleman toplanır.",
      "A m×n ve B n×p ise AB m×p boyutundadır. Her eleman A’nın bir satırıyla B’nin bir sütununun iç çarpımıdır; genelde AB≠BA.",
      "2×2 matrisin determinantı ad−bc. Determinant sıfır değilse tersi (1/(ad−bc))[[d,−b],[−c,a]] biçimindedir."
    ]
  },
  {
    "id": "linear-algebra",
    "title": "Lineer cebir",
    "group": "Üniversite",
    "prerequisites": [
      "matrices"
    ],
    "lessonSteps": [
      "Vektörler toplanabilir ve sayıyla çarpılabilir. Vektörlerin lineer birleşimi a₁v₁+…+aₖvₖ biçimindedir.",
      "Yalnızca bütün katsayılar sıfırken toplam sıfır oluyorsa vektörler lineer bağımsızdır. Bir baz, uzayı geren bağımsız vektörler kümesidir.",
      "Av=λv, v≠0 eşitliğinde v özvektör, λ özdeğerdir. Özdeğerleri bulmak için det(A−λI)=0 çözülür."
    ]
  },
  {
    "id": "differential-equations",
    "title": "Diferansiyel denklemler",
    "group": "Üniversite",
    "prerequisites": [
      "integral"
    ],
    "lessonSteps": [
      "Diferansiyel denklem bilinmeyen fonksiyon ile türevleri arasında ilişki kurar. Çözüm fonksiyon olmalıdır; türevini hesaplayıp denklemde yerine koyarak doğrula.",
      "y′=ky denkleminin genel çözümü y=Ceᵏˣ. Başlangıç koşulu y(x₀)=y₀ sabiti belirler.",
      "Ayrılabilir y′=g(x)h(y) denklemlerinde h(y)≠0 bölgelerinde dy/h(y)=g(x)dx yazıp integral al. h(y)=0 olan sabit çözümleri ayrıca incele; bölerek kaybetme."
    ]
  },
  {
    "id": "advanced",
    "title": "İleri matematiğe giriş: yakınsama ve ispat",
    "group": "Üniversite",
    "prerequisites": [
      "limits",
      "sequences",
      "linear-algebra"
    ],
    "lessonSteps": [
      "İleri matematikte örnekler sezgi sağlar; bütün durumlar için iddia ispat ister. Bir evrensel iddiayı çürütmek için tek karşı örnek yeterlidir.",
      "aₙ dizisinin L’ye yakınsaması: her ε>0 için öyle N vardır ki n>N olduğunda |aₙ−L|<ε. N, ε’ye bağlı olabilir.",
      "Seri, kısmi toplamlar dizisinin limitidir. aₙ→0, Σaₙ’nin yakınsaması için gerekli ama yeterli değildir; harmonik seri karşı örnektir. Bu bir giriş ünitesidir; ileri analiz, soyut cebir ve topolojinin tamamını kapsamaz."
    ]
  }
];
const byId=new Map(COURSES.map(c=>[c.id,c]));
export const getCourse=id=>byId.get(id)||null;
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
