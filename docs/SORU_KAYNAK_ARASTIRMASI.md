# Soru kaynakları ve kullanım hakkı araştırması

Denetim tarihi: **7 Kasım 2026**. Bu araştırma, son kullanıcı talimatındaki “sıfır uydurma soru” kuralını esas alır. Kaynağın internette okunabilmesi, uygulamada yeniden yayımlama izni olarak kabul edilmemiştir. Araştırma web bağlayıcısıyla yürütüldü; terminal ağındaki erişim kısıtları aşılmadı.

## Sonuç ve sayım yöntemi

- **42 tekil kaynak belgesi fiilen okundu:** 26 resmî belge (23 HTML, 3 PDF) ve 16 eğitim kaynağı belgesi (9 HTML, 7 PDF). Aynı URL'ye tekrar bakmak, arama sonucu parçacıkları ve açılamayan hedefler bu sayıya dahil değildir.
- Ayrıca [CC BY 3.0 lisans özeti](https://creativecommons.org/licenses/by/3.0/) okundu. Bu hukuk metni bir soru kaynağı olarak sayılmadı.
- **12 mevcut ders kitabı alıştırmasının** özgün soru metni, soru numarası, yazarın cevap anahtarı ve açık kullanım lisansı doğrulandı. Bunlar Tyler Wallace'ın 2010 tarihli kitabının altı bölümünden gelir. Altı ayrı bölüm PDF'si altı kaynak kaydıdır; altı farklı kitap/yayıncı anlamına gelmez.
- **Uygulamaya aktarılmak üzere kabul edilen resmî ÖSYM/MEB sorusu: 0.** Soruların yeniden yayımlanmasına izin veren belge bulunmadı.
- ÖSYM'de **17 sınav/yıl/oturum kaynak grubu** izin nedeniyle kabul edilmedi. Bu gruplardaki her soruyu tek tek incelemediğimiz için “reddedilen soru sayısı” uydurulmadı.
- Bu rapordaki 12 kabul, araştırma ve hak denetimi sonucudur. Uygulamaya gerçekten alınan soru adedi `data/question-bank.js` ve otomatik test sonuçlarıyla birlikte raporlanmalıdır.

Tam metni veya anahtar harflerinin tümü okunmayan sınav “tam doğrulanmış deneme” değildir. Bir hak kaydı reddedildiyse iframe gömme izni de varsayılmamalıdır.

## Kabul edilen açık lisanslı kitap

**Tyler Wallace — Beginning and Intermediate Algebra (2010).**

- [Yazarın bölüm dizini](https://www.wallace.ccfaculty.org/book/book.html), her bölümün ders, alıştırma, cevaplar ve tek sayılı soruların çözümlerine giden bağlantılarını sunar.
- [Tam kitap PDF'si](https://www.wallace.ccfaculty.org/book/Beginning_and_Intermediate_Algebra.pdf), PDF sayfa 2'de 2010 telif tarihini ve **CC BY 3.0 Unported** lisansını açıkça yazar.
- Aşağıdaki altı alıştırma PDF'sinin her birinde de aynı lisans bildirimi bulunur. Yalnızca genel site altlığından izin çıkarılmadı.
- [Lisansın kendi açıklaması](https://creativecommons.org/licenses/by/3.0/) paylaşmayı, yeniden dağıtmayı ve uyarlamayı ticari amaçlar dahil mümkün kılar. Yazar, eser adı, kaynak ve lisans bağlantısı korunmalı; yapılan değişiklik varsa belirtilmeli ve yazarın uygulamayı desteklediği izlenimi verilmemelidir.
- Soru talimatları İngilizce özgün biçimiyle korundu. Matematik dizgisinin Unicode/metin olarak gösterilmesi dışında metin, sayı, değişken ve soru değiştirilmedi. Özgün sorular açık uçludur; A–E seçenekleri eklenmez.
- Bu içerikler **TYT/AYT çıkmış soruları değildir**. Arayüzde yazar ve kitap kaynağıyla sunulmalıdır. Zorluk derecesi bu çalışmada ölçülmedi; `null` kalır.

Önerilen atıf:

> Beginning and Intermediate Algebra © 2010 Tyler Wallace — CC BY 3.0 Unported. Özgün İngilizce metin ve matematiksel değerler korunmuştur; yalnızca matematik dizgisi düzenlenmiştir.

### Doğrulanan 12 alıştırma

Sayfalar, **bağlantı verilen kısa bölüm PDF'sinin 1 tabanlı sayfalarıdır**. Tam kitabın basılı sayfa numarası gibi gösterilmemelidir. Sayısal sonuçlar ayrıca cebir yoluyla yeniden kontrol edildi; bu kontrol, yayınevinin/yazarın resmî çözümü olarak sunulmaz.

| Kaynak ID / bölüm | Özgün soru no. | Soru sayfası | Yazarın anahtarındaki cevap | Anahtar sayfası | Konu |
|---|---:|---:|---|---:|---|
| `wallace-2010-1-3` / 1.3 | 1 | 1 | −3 | 3 | Denklem çözme |
| `wallace-2010-1-3` / 1.3 | 2 | 1 | 6 | 3 | Denklem çözme |
| `wallace-2010-1-6` / 1.6 | 8 | 1 | −3, 9 | 2 | Mutlak değer |
| `wallace-2010-1-6` / 1.6 | 15 | 1 | −2, 0 | 2 | Mutlak değer |
| `wallace-2010-6-3` / 6.3 | 1 | 1 | (p + 9)(p + 8) | 2 | Çarpanlara ayırma |
| `wallace-2010-6-3` / 6.3 | 2 | 1 | (x − 8)(x + 9) | 2 | Çarpanlara ayırma |
| `wallace-2010-6-7` / 6.7 | 7 | 1 | 2, −7 | 2 | İkinci dereceden denklemler |
| `wallace-2010-6-7` / 6.7 | 8 | 1 | −5, 6 | 2 | İkinci dereceden denklemler |
| `wallace-2010-7-7` / 7.7 | 3 | 1 | 3 | 2 | Rasyonel denklemler |
| `wallace-2010-7-7` / 7.7 | 5 | 1 | 2 | 2 | Rasyonel denklemler |
| `wallace-2010-10-4` / 10.4 | 5 | 1 | −3/4 | 2 | Üslü denklemler |
| `wallace-2010-10-4` / 10.4 | 7 | 1 | −3/2 | 2 | Üslü denklemler |

Birincil bölüm PDF'leri:

1. [1.3 General Linear Equations — Practice](https://www.wallace.ccfaculty.org/book/1.3%20General%20Linear%20Equations%20Practice.pdf)
2. [1.6 Absolute Value Equations — Practice](https://www.wallace.ccfaculty.org/book/1.6%20Absolute%20Value%20Practice.pdf)
3. [6.3 Trinomials where a = 1 — Practice](https://www.wallace.ccfaculty.org/book/6.3%20Trinomials%20a=1%20Practice.pdf)
4. [6.7 Solve by Factoring — Practice](https://www.wallace.ccfaculty.org/book/6.7%20Solve%20by%20Factoring%20Practice.pdf)
5. [7.7 Solving Rational Equations — Practice](https://www.wallace.ccfaculty.org/book/7.7%20Rational%20Equations%20Practice.pdf)
6. [10.4 Exponential Functions — Practice](https://www.wallace.ccfaculty.org/book/10.4%20Exponential%20Equations%20Practice.pdf)

PDF metin çıkarımıyla talimat/soru numarası/ifade/cevap/lisans eşleştirildi. PDF görüntü uç noktasına da başvuruldu; araştırma aracı yalnız görüntü işaretçisi döndürdüğünden **görsel dizgi karşılaştırmasının yapıldığı iddia edilmez**. Karmaşık şekil, grafik veya tablosu gereken soru bu ilk partiye alınmadı. Kaynak metinlerinin telifli soru kotasıyla karıştırılmaması için yalnız gerekli kısa alıştırmalar aktarıldı; kabul edilen içeriklerin yeniden dağıtım izni açık CC BY lisansından gelir.

## ÖSYM: TYT/AYT 2018–2026 ve diğer sınavlar

Aşağıdaki **17 duyuru ayrı ayrı açıldı**. Ortak hak bildirimi, soruların ÖSYM'ye ait olduğunu ve yazılı izin olmadan çoğaltılamayacağını/dağıtılamayacağını/yayımlanamayacağını belirtir. Projede ÖSYM'nin yazılı izni bulunmuyor. Duyurudaki bağlantı varlığı ile kitabın tüm sorularının/anahtarlarının okunmuş olması farklı denetim aşamalarıdır.

| Sınav/yıl | Açılan birincil duyuru | Karar |
|---|---|---|
| YKS 2018 TYT/AYT | [ÖSYM](https://www.osym.gov.tr/2018yks-tyt-ve-ayt-oturumlari-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi-1072018) | Yazılı izin yok; soru metni/görseli alınmadı |
| YKS 2019 TYT/AYT | [ÖSYM](https://www.osym.gov.tr/2019yuksekogretim-kurumlari-sinavi-2019yks-oturumlari-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi) | Yazılı izin yok; TYT Matematik 7 iptali duyuruda görülüyor |
| YKS 2020 TYT/AYT | [ÖSYM](https://www.osym.gov.tr/2020yuksekogretim-kurumlari-sinavi-2020yks-oturumlari-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi) | Yazılı izin yok |
| YKS 2021 TYT/AYT | [ÖSYM](https://www.osym.gov.tr/2021yuksekogretim-kurumlari-sinavi-2021yks-oturumlari-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi) | Yazılı izin yok |
| YKS 2022 TYT/AYT | [ÖSYM](https://www.osym.gov.tr/2022yuksekogretim-kurumlari-sinavi-2022yks-oturumlari-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi) | Yazılı izin yok |
| YKS 2023 TYT/AYT | [ÖSYM](https://www.osym.gov.tr/2023-yuksekogretim-kurumlari-sinavi-2023yks-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi) | Yazılı izin yok |
| YKS 2024 TYT/AYT | [ÖSYM](https://www.osym.gov.tr/2024-yuksekogretim-kurumlari-sinavi-2024yks-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi) | Yazılı izin yok |
| YKS 2025 TYT/AYT | [ÖSYM](https://www.osym.gov.tr/2025-yuksekogretim-kurumlari-sinavi-2025yks-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi) | Yazılı izin yok |
| YKS 2026 TYT/AYT | [ÖSYM](https://www.osym.gov.tr/2026-yuksekogretim-kurumlari-sinavi-2026yks-temel-soru-kitapciklari-ve-cevap-anahtarlari-yayimlandi) | Yazılı izin yok; sonraki iptal duyurusu aşağıda |
| KPSS Ön Lisans 2024 | [ÖSYM](https://www.osym.gov.tr/2024kpss-on-lisans-sinavi-temel-soru-kitapcigi-ve-cevap-anahtari-yayimlandi) | Kamuya sunulan kitapçık %10; yazılı izin yok |
| KPSS Ön Lisans 2026 | [ÖSYM](https://osym.gov.tr/2026-kpss-on-lisans-sinavi-temel-soru-kitapcigi-ve-cevap-anahtari-yayimlandi) | %10; yazılı izin yok |
| KPSS Ortaöğretim 2024 | [ÖSYM](https://www.osym.gov.tr/2024kpss-ortaogretim-sinavi-temel-soru-kitapcigi-ve-cevap-anahtari-yayimlandi) | %10; yazılı izin yok |
| KPSS Ortaöğretim 2026 | [ÖSYM](https://osym.gov.tr/2026-kpss-ortaogretim-sinavi-temel-soru-kitapcigi-ve-cevap-anahtari-yayimlandi) | %10; yazılı izin yok |
| ALES 2025/1 | [ÖSYM](https://www.osym.gov.tr/2025ales1-temel-soru-kitapcigi-ve-cevap-anahtari-yayimlandi) | %10; yazılı izin yok |
| ALES 2026/2 | [ÖSYM](https://osym.gov.tr/2026-ales2-temel-soru-kitapcigi-ve-cevap-anahtari-yayimlandi) | %10; yazılı izin yok |
| DGS 2025 | [ÖSYM](https://www.osym.gov.tr/2025dgs-temel-soru-kitapcigi-ve-cevap-anahtari-yayimlandi) | %10; yazılı izin yok |
| DGS 2026 | [ÖSYM](https://www.osym.gov.tr/2026dgs-temel-soru-kitapcigi-ve-cevap-anahtari-yayimlandi) | %10; yazılı izin yok |

### Cevap anahtarı düzeltmeleri ve doğrulamanın sınırı

**2026 AYT Matematik 23:** [1 Temmuz 2026 değerlendirme duyurusu](https://www.osym.gov.tr/2026-yuksekogretim-kurumlari-sinavi-2026yks-degerlendirme-islemleri) önce C cevabını A'ya değiştiriyor. Ancak daha sonraki [21 Temmuz 2026 tarihli resmî değerlendirme PDF'si](https://dokuman.osym.gov.tr/pdfdokuman/2026/YKS/aciklama_ydd21072026.pdf), matematik 23'ün **yargı kararıyla iptal edilerek** değerlendirildiğini açıkça bildiriyor. Yalnız C→A düzeltmesini uygulamak güncel durumu karşılamaz. Sonraki iptal durumu esas alınmalıdır.

Bu PDF'ye bağlanan [sonuç duyurusu](https://www.osym.gov.tr/2026yks-sinav-sonuclari-aciklandi) ve iptali yazan [sonuç haberi](https://www.osym.gov.tr/2026-yks-sonuclari-aciklandi) de açıldı. ÖSYM'nin iptal kuralı sınav puanına ilişkin özel değerlendirme içerebilir; uygulamanın basit çalışma neti ÖSYM yerleştirme puanı gibi sunulmamalıdır.

**2019 TYT Matematik 7:** Yukarıdaki 2019 duyurusu iptali bildiriyor. Önceki anahtarın yalnız harf dizisini korumak yeterli değildir.

Ek olarak:

- [2024 YKS kitapçık dizini](https://www.osym.gov.tr/2024yks-tyt-ayt-ve-ydt-temel-soru-kitapciklari-ve-cevap-anahtarlari) açıldı; TYT/AYT kitapçık bağlantıları görüldü. Bu, PDF'lerin tümünün incelendiği anlamına gelmez.
- [2024 KPSS Ön Lisans kitapçığı](https://dokuman.osym.gov.tr/pdfdokuman/2024/KPSS/ONL/kitapcik01092024.pdf) açıldı; matematik 33, 39, 57 için cevaplar PDF içinde görüldü. Aynı PDF'deki telif bildirimi nedeniyle soru metinleri uygulamaya alınmadı. Bu üç cevabın görülmesi, tam KPSS anahtarı doğrulaması değildir.
- TYT/AYT 2018–2026'daki 18 kitapçığın bütün 40'ar matematik anahtarı bu kaynak araştırmasında karşılaştırılmadı. Dolayısıyla tüm yıl ve oturumlara `verified` işareti verilmemelidir.

## MEB

| Fiilen açılan kaynak | Bulgular | Karar |
|---|---|---|
| [ÖDSGM örnek soru arşivi](https://odsgm.meb.gov.tr/www/ornek-sorular/icerik/1011) | 2018–2025 örnek soru bağlantıları; altlıkta hakların saklı tutulması | Açık yeniden yayımlama izni doğrulanmadı |
| [2024–2025 LGS örnek soru duyurusu](https://odsgm.meb.gov.tr/www/lgs-kapsamindaki-merkezi-sinava-yonelik-ornek-sorular-yayimlandi/icerik/1321) | Matematikte 10 örnek soru, kaynak/video çözümleri | Erişim kolaylığı çoğaltma izni sayılmadı |
| [2025 lise düzeyi örnek soru PDF'si](https://odsgm.meb.gov.tr/meb_iys_dosyalar/2025_10/27154611_lise.pdf) | 23 sayfalık soru ve cevap belgesi | Açık lisans bulunmadığından bankaya alınmadı |

[Lise PISA matematik hedefi](https://ogmmateryal.eba.gov.tr/pisa/matematik.pdf) aramada bulundu; açılışta okunabilir PDF metni yerine sıfır satırlı HTML döndü. İncelenen belge sayısına dahil edilmedi.

## Diğer açık eğitim kaynakları

### OpenStax: çelişkili güncel hak bildirimi nedeniyle aktarılmadı

[College Algebra önsözünün](https://openstax.org/books/college-algebra/pages/preface) gövdesi CC BY 4.0 derken aynı sayfanın güncel altlığı NC-SA ve AI ürünlerine dahil etmeden önce yazılı izin şartları gösteriyor. Kitabın aynı URL'sindeki bu çelişki giderilmeden uygulamaya aktarma izni kesin sayılmadı. Eski CC lisanslarının geri alınamazlığı tek başına hangi sürümün yeniden kullanıldığını belgeleme gereğini ortadan kaldırmaz; açıkça lisanslanmış eski PDF'nin içeriğinin kendisi okunamadı.

Fiilen okunan beş HTML belge:

1. [College Algebra — Preface](https://openstax.org/books/college-algebra/pages/preface)
2. [2.1 The Rectangular Coordinate Systems and Graphs](https://openstax.org/books/college-algebra/pages/2-1-the-rectangular-coordinate-systems-and-graphs)
3. [2.2 Linear Equations in One Variable](https://openstax.org/books/college-algebra/pages/2-2-linear-equations-in-one-variable)
4. [2.5 Quadratic Equations](https://openstax.org/books/college-algebra/pages/2-5-quadratic-equations)
5. [Answer Key Chapter 2](https://openstax.org/books/college-algebra/pages/chapter-2)

[Eski College Algebra PDF'si](https://assets.openstax.org/oscms-prodcms/media/documents/CollegeAlgebra-OP.pdf) aşırı dosya boyutu hatasıyla; [College Algebra 2e PDF'si](https://assets.openstax.org/oscms-prodcms/media/documents/College-Algebra-2e-WEB.pdf) 403 ile açılamadı. Arama parçacıklarındaki CC BY ifadeleri, bu iki PDF'nin fiilen incelendiği şeklinde raporlanmadı. İkisi de 42 belge sayısına dahil değildir.

### Sonraki genişletme için adaylar

- [Business Calculus — yazar/yayıncı web kitabı](https://www.opentextbookstore.com/buscalc/buscalc/) fiilen açıldı. Ana metin CC BY 4.0; videoların lisansı farklıdır (NC-ND). Bu turda sorular ve cevapları tek tek seçilmedi; kitaba ait soru sayısı uygulamada sıfırdır.
- [PCC ORCCA yayıncı dizini](https://www.pcc.edu/math-resources/orcca/) fiilen açıldı. Kitap ve sürüm bağlantıları doğrulandı; soruların kendi lisans/anahtar denetimi bu turda tamamlanmadı. Bankaya aktarılmadı.
- Wallace'ın [eski büyük harfli dizini](https://www.wallace.ccfaculty.org/book/Book.html) ile [güncel ayrıntılı dizini](https://www.wallace.ccfaculty.org/book/book.html) ayrı HTML belgeler olarak okundu. Sonraki sorular için ayrıntılı dizin kullanılabilir.

## Belge sayısının dökümü

| Küme | HTML | PDF | Toplam |
|---|---:|---:|---:|
| 17 ÖSYM sınav/oturum duyurusu | 17 | 0 | 17 |
| ÖSYM 2026 düzeltme, iki sonuç duyurusu, 2024 kitapçık dizini | 4 | 0 | 4 |
| ÖSYM 2026 iptal açıklaması ve KPSS 2024 Ön Lisans kitapçığı | 0 | 2 | 2 |
| MEB iki duyuru/arşiv ve bir lise PDF'si | 2 | 1 | 3 |
| OpenStax beş kitap HTML sayfası | 5 | 0 | 5 |
| Wallace iki dizin, tam kitap ve altı kısa alıştırma PDF'si | 2 | 7 | 9 |
| Business Calculus ve PCC ORCCA dizini | 2 | 0 | 2 |
| **Kaynak belgesi toplamı** | **32** | **10** | **42** |

Ayrıca bir CC lisans açıklaması okundu; soru kaynağı sayılmadı. Web aracının başarısız ilk denemesinden sonra açılabilen Wallace bölüm PDF'leri yalnız bir kez sayıldı.

## Kalan işler

- ÖSYM'den yazılı yeniden yayımlama/gömme izni sağlanmadan resmî sorular uygulama içinde sunulamaz. Resmî dış bağlantı ve adayın kendi yasal dosyasını cihazında açma akışı ayrı değerlendirilmelidir.
- Tüm TYT/AYT anahtarları ve düzeltme geçmişi satır satır doğrulanmalı; eksik veya doğrulanmamış durumda otomatik puanlama kapalı kalmalı.
- Açık uçlu cevaplarda kök sırası, eşdeğer kesirler ve eşdeğer cebirsel çarpanlar gibi gösterimler desteklenmelidir. Güvenilir eşdeğerlik denetimi yoksa kendi değerlendirmesi için yazarın cevabını göstermek mümkündür; eşdeğer bir cevaba kesin yanlış denmemelidir.
- Bu ilk 12 soru şekilsiz ve sınırlı altı konu kapsamındadır. Müfredatın kalan konularında izinli soru yoksa kullanıcı talimatındaki boş durum gösterilmeli; üreticiyle doldurulmamalıdır.
- Kaynak denetimi, canlı Supabase veya tarayıcı entegrasyon testi yerine geçmez. Bunlar ana geliştirme görevinin test raporunda ayrıca belirtilmelidir.
