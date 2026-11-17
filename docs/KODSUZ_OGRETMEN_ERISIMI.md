# Kodsuz öğretmen erişimi

Tarih: **17 Kasım 2026**.

Siteyi açan kullanıcı öğretmenleri hazır görür. Canlı AI için normal hesabına giriş yapar; ayrı erişim kodu, Gemini anahtarı veya Worker adresi girmez. Bağlantı ve izin kontrolü mevcut hesap oturumuyla otomatik yapılır.

## Kullanıcının gördüğü akış

- Girişsiz ziyaretçi on öğretmenin profilini ve hazır örneklerini görebilir; canlı AI için normal hesap girişine yönlendirilir.
- Geçerli oturumu ve yönetici onayı olan hesap öğretmenini seçip konuşabilir, konu anlatımı veya ipucu isteyebilir, kendi yazdığı soruyu çözdürebilir.
- E-posta doğrulaması veya yönetici onayı eksik hesap izin durumunu görür. Yönetici mevcut **Kaynak erişim yönetimi** alanından onay verir; yeni bir kod dağıtmaz.
- Hesap değişimi, çıkış veya kaldırılmış izin eski hesabın AI yanıtlarını yeni hesaba taşımaz. Oturum gerektiğinde mevcut hesap sistemiyle yenilenir.
- Telefon ve bilgisayar aynı merkezi bağlantıyı kullanır. Kullanıcı cihaz başına bağlantı ayarı yapmaz; kişisel bilgisayarın açık kalması gerekmez.

## Site sahibinin bir kez yaptığı kurulum

1. Faturalandırmaya bağlı olmayan Google Free Tier projesinde Gemini anahtarı oluşturur.
2. Güncel [Worker paketini](../cloudflare-worker/bundle/worker.js) Cloudflare'a dağıtır; `GEMINI_API_KEY` değerini yalnız Worker **Secret** olarak ekler.
3. Merkezi [`data/tutor-config.json`](../data/tutor-config.json) ayarı bu proje için `https://matematik-akademim-ai.c542478.workers.dev` olarak kaydedildi. Site sahibi güncel Worker sürümünü bu adreste doğrular; adres ileride değişirse yalnız merkezi ayar güncellenir.
4. Gerçek bir onaylı hesapla AI çağrısını, başka hesapta izin reddini ve telefon kullanımını kontrol eder.

Adım adım dashboard ve Wrangler kurulumu: [Gemini ücretsiz kurulum rehberi](GEMINI_UCRETSIZ_KURULUM.md).

Worker adresi kayıtlıdır; kullanıcıdan yeniden istenmez. Bu adresteki `/health` yanıtında `auth: supabase-session` bulunmalı ve mevcut hesabın izni doğrulanabilmelidir. Eski kod isteyen Worker sürümü hâlâ dağıtılıysa yeni bundle aynı adrese yüklenmelidir. Adresin varlığı tek başına canlı AI'ın hazır olduğu anlamına gelmez; yayın öncesi uyumluluk kontrolü ve ilk gerçek çağrı ayrı ayrı doğrulanır.

## Sunucudaki yetki sınırı

Tarayıcı, mevcut Supabase oturumunu normal hesap modülünden alır. Worker önce Supabase `/auth/v1/user` ile oturumu doğrular, ardından aynı kullanıcı için mevcut `ma_source_access_status` RPC sonucunu denetler. Doğrulanmış kullanıcı ile izin yanıtındaki kullanıcı aynı olmalı; e-posta doğrulanmış ve durum onaylı olmalıdır.

Tarayıcıdaki rol, e-posta, önbelleğe yazılmış onay veya kullanıcı metadata'sı bu doğrulamanın yerine geçmez. İzin kontrolü başarıya ulaşmadan Gemini çağrılmaz. Yetki kontrolü için arşiv anahtarı alınmaz; mevcut hesaplar, tablolar ve ilerleme kayıtları taşınmaz veya silinmez. Kullanıcı oturumu Gemini'ye gönderilmez.

Ayrı erişim koduna dayanan eski akış kaldırılır. Gemini anahtarı yalnız sunucudadır. Model tek izinli ücretsiz katman destekli modelle sınırlıdır; kota hatasında ücretli model/sağlayıcı veya otomatik tekrar kullanılmaz. Ücret oluşmaması için Google projesinin faturalandırmaya bağlı olmaması gerekir; kod bu proje durumunu anahtardan doğrulayamaz.

## Korunanlar ve doğrulama sınırı

Dört menü, gece mavisi görünüm, on öğretmen, **1.130 öğretmen metni**, soru havuzları, TYT/AYT denemeleri, kullanıcılar ve ilerleme korunur. Sohbette çözülen sorular soru bankasına veya başarı puanına eklenmez. Uzun çözümler sekme belleğinde tam tutulur; sağlayıcıya gönderilen geçmiş ayrıca sınırlanır.

Kontrol kapsamı; kod/bağlantı alanlarının bulunmaması, normal girişten sonra hazır öğretmen, oturum yenileme, onaysız/izni kaldırılmış hesabın reddi, hesap değişiminde geç yanıtların elenmesi ve eski deneme/ilerleme kayıtlarının korunmasıdır. Güncel otomatik sonuçlar PR raporunda yer alır. Taklit servisle test edilen kod, gerçek Gemini anahtarı veya canlı Supabase/Cloudflare kurulumu doğrulanmış sayılmaz.
