# İkinci aşama raporu — 7 Kasım 2026

PR #2 korunarak onun dalından `codex/ogrenme-platformu-ikinci-asama` oluşturuldu. Ana dal değiştirilmedi, site/Worker yayımlanmadı, canlı veritabanına SQL uygulanmadı.

## Geliştirilenler

- **Deneme:** 2018–2026 seçimi, 40 cevap, kalıcı duraklat/devam, duraklama süresini dışlayan kronometre, kalan süre, soru işaretleme, yenilemeyle devam. Matematik çalışma modu ile tam oturum süre ön ayarı ayrı gösterilir; uygulama diğer dersleri içeren tam oturum denemesi değildir. 2018–2022 için kitapçık URL’si uydurulmadı; yerel PDF yüklenir.
- **Sonuç analizi:** manuel anahtar geçmişte saklanır; yanlış/boş sorular tekrar görülebilir. Kullanıcının kendi konu etiketlerinden analiz ve aynı tür/moddaki sonuçlar arasında karşılaştırma yapılır. Doğrulanmış soru-konu haritası varmış gibi davranılmaz.
- **Müfredat:** 27 alanda ilk ünite, anlatım, çözümlü örnek ve kolay/orta/zor toplam 81 sabit özgün alıştırma. Sayılardan kesirlere, cebir ve geometriye, türev/integrale, matris/lineer cebir/diferansiyel denklemlere ve yakınsama/ispat girişine uzanır. Her alanın kapsamlı kursu veya geniş soru bankası tamamlanmış değildir. Alıştırmalar çıkmış sınav sorusu olarak sunulmaz; seçenek sırası karıştırılır.
- **Öğrenme yolu:** sekiz soruluk başlangıç seviye taraması, ön koşullara göre plan, üç soruluk konu testi, yanlışları tekrar ve kullanıcıya özel ilerleme. Eski hızlı işlem alıştırmaları silinmedi; ayrı, kapalı panelde duruyor.
- **Öğretmenler:** Çağatay, Beyza, Zeynep, Profesör Kemal, Mert ve Elif için farklı avatar, karşılama, doğru/yanlış tepkisi ve sunucu tarafından belirlenen öğretim yaklaşımı. Tek tıklamayla geçiş ve öğretmene özel geçici sohbet akışı. İpucu/tam çözüm seçimi. Mert günlük üç yanıt hedefini ve gerçek yerel doğru serisini kullanır; başarı sayısı uydurulmaz.
- **Yetişkin argo seçimi:** Çağatay için kapalı/hafif/ağır/çok ağır. İki açık onay olmadan istemci ve Worker küfürlü modu açmaz; onay kaldırılınca bekleyen istek iptal edilir. Yetişkin/onay işaretleri hesap profilinde saklanmaz. Bu bir yaş doğrulama hizmeti değil, kullanıcı beyanıdır. Diğer öğretmenlere argo seçimi taşınmaz.
- **Hesap ve güvenlik:** öğretmen tercihi, konu/düzey ve öğrenme ilerlemesi için kullanıcıya özel yerel kayıt ve Supabase profil API’si. Tekrarsız ilerleme birleştirme, boyut sınırı, sahiplik ve geç yanıt denetimi. Sohbet, erişim kodu ve yetişkin onayları profil verisine alınmaz. Yeni `learning_profiles` RLS SQL’i sadece öneri/staging içindir.
- **Bakım ve mobil:** büyük HTML içindeki uygulama kodu ayrı modüllere çıkarıldı. Gece mavisi tema ve dört öğeli alt menü korundu. Müfredat ve plan ayrıntıları kapalı panellerde, ders seçimi arama destekli pencere içinde. 390 px ekran görüntüleriyle ders, öğretmen ve deneme ekranları incelendi.

## Test kapsamı

Node testleri; matematik içerik hesapları, ön koşullar, profil normalleştirme/birleştirme, gerçek yerel PostgreSQL/PGlite RLS, Worker/persona doğrulaması ve sözdizimini kapsar. Tarayıcı testleri masaüstü ve 390 px Chromium görünümünde yeni öğrenme akışı ile PR #2 regresyonlarını kapsar. Son sayılar ve GitHub Actions sonucu PR açıklamasında tutulur.

Yerelde kullanılan komutlar:

```sh
npm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
npm audit --audit-level=high
git diff --check
```

## Doğrulanamayanlar

1. ÖSYM belge alanına bu oturumda tekrar erişim denendi: proxy CONNECT HTTP 403. 2018–2026 için 18 kitapçığın içeriği, nihai anahtarları, düzeltme/iptal duyuruları doğrulanamadı. `ANSWER_KEYS` boş kalır; resmî otomatik puanlama kapalıdır. Eski aday adreslerin varlığı doğrulama kanıtı değildir.
2. Canlı Supabase Auth/PostgREST ve mevcut üretim RLS politikaları doğrulanmadı. Yeni profil tablosu staging ortamında gözden geçirilip kurulmadan hesapta bulut tercihi/ilerleme eşitlemesi çalışmayabilir; arayüz hatayı bildirip yerel kaydı korur. PGlite testi yalnızca depodaki SQL’i doğrular.
3. Gerçek AI modeli/Worker çağrısı yapılmadı. Kişilik talimatları ve istek doğrulaması sahte üst servisle test edildi; gerçek öğretim yanıtlarının kalitesi/model erişimi ayrıca kabul testi gerektirir. Ortak Worker erişim kodu çok kullanıcılı sunucu kimlik doğrulamasının yerini almaz.
4. Gerçek iOS/Android PDF motorları test edilmedi. Yerel PDF’nin doğru yıl/oturum içeriği olduğu otomatik doğrulanmaz. Eski aday matematik sayfa numaraları doğrulanmayı bekliyor.
5. İlerleme profili en yeni en fazla 1000 yanıtı ve boyut sınırına sığan kısmını tutar. Sınırsız geçmiş, tam çevrimdışı kurulum ve gelişmiş çok cihazlı çatışma çözümü bu aşamada yoktur.
6. Bir alıştırmanın tekrar çözülmesi yeni çalışma yanıtı sayılır; kısa testler resmî yeterlilik veya kapsamlı seviye belgesi değildir. Konu bankaları her düzeyde birer örnektir; daha fazla içerik sonraki geliştirme alanıdır.

Ayrı bir gece boyunca çalışacak otomasyon oluşturulmadı. Bu rapor bu oturumda gerçekten yapılan işleri kapsar.

## Ek incelemede düzeltilenler

- PDF adı/istemci MIME türüne güvenmek yerine dosyanın `%PDF-` imzası kontrol edilir ve görüntülenecek Blob her durumda `application/pdf` olarak yeniden oluşturulur. Kontrol hem yeni yüklemeye hem IndexedDB’den gelen eski dosyaya uygulanır. Sahte HTML dosyası, önbellekteki zararlı içerik ve PDF başlıklı HTML içeriği sentetik verilerle test edildi. Bu, sınav kitapçığının resmîliğini doğrulayan bir içerik incelemesi değildir.
- İlk profil yüklemesiyle otomatik kayıt aynı kuyrukta yürür; her yazma öncesi uzaktaki yanıt kimlikleriyle birleştirilir. Geciken bulut okuması sırasında verilen yeni cevap için regresyon testi eklendi. Sunucuda karşılaştırmalı sürüm kilidi olmadığından iki ayrı cihazın tam eşzamanlı yazmaları için mutlak çatışma çözümü iddia edilmez.
- Hesap değişiminde yazılmamış AI mesaj taslağı temizlenir. Öğretmen veya argo onayı değişince eski istek yanıtı yeni konuşmaya taşınmaz.
- Deneme senkronizasyon kilidi ve yanıt kabulü oturum nesline bağlandı. Aynı kullanıcıyla yeniden girişte eski yanıt kabul edilmez; başka hesaba geçişte eski isteğin yeni hesabı kilitlemesi önlenir.

## Son yerel sonuç

- `npm test`: **39/39 geçti**.
- Chromium masaüstü + 390 px mobil E2E: **60/60 geçti**; gerçek PDF'nin yerel görüntüleyicide başarılı render durumuna ulaşması dahil.
- `npm audit --audit-level=high`: **0 açık**.
- `git diff --check`: geçti.

CI sonucu PR üzerinde ayrıca izlenir. Yeni PR, PR #2 dalını taban alır; önceki PR’ın değişikliklerini yinelenen fark olarak sunmaz ve onu değiştirmez.
