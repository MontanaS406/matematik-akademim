# Gemini ücretsiz katman ve kodsuz öğretmen kurulumu

Resmî belgelerin araştırma tarihi: **16 Kasım 2026**. Kodsuz hesap erişimi düzenlemesi: **17 Kasım 2026**.

**Ziyaretçi hiçbir API anahtarı, erişim kodu veya Worker adresi girmez.** Siteyi açtığında öğretmenler görünür. Canlı AI ile konuşmak için mevcut hesabına giriş yapması ve hesabının yönetici tarafından onaylı olması yeterlidir. Normal hesap oturumu geçerliyse AI bağlantısı otomatik kullanılır.

Aşağıdaki kurulum yalnız site sahibi tarafından bir kez yapılır. Öğretmen sunucusu Cloudflare Worker üzerinde çalışır; telefon veya başka bir bilgisayardan kullanırken kişisel bilgisayarının açık kalması gerekmez. İnternet, Google'ın kullanılabilir kotası ve Cloudflare hizmeti gerekir. Soru havuzları, denemeler, Supabase kullanıcıları ve ilerleme tabloları değiştirilmez.

## 1. Ücretsiz Google projesini ve anahtarı oluştur

1. [Google AI Studio API anahtarları](https://aistudio.google.com/apikey) sayfasını açıp Google hesabınla giriş yap.
2. Bu uygulama için yeni bir proje oluştur veya yalnız bu iş için ayrılmış bir proje seç.
3. [AI Studio Projects](https://aistudio.google.com/projects) sayfasında **Billing Tier → Free Tier** olduğunu kontrol et. Google ücretsiz katman için proje doğrulaması istiyorsa tamamla.
4. Projeye Cloud Billing hesabı bağlama; **Set up billing**, **Upgrade**, kredi yükleme veya otomatik bakiye yükleme adımlarına geçme.
5. Bu proje için **Create API key** ile anahtar oluştur. Değerini yalnız aşağıdaki Cloudflare **Secret** alanına yaz.

Uygulama tek izinli `gemini-3.5-flash-lite` modelini kullanır. Resmî fiyat sayfasında metin giriş ve çıkışı ücretsiz katmanda ücretsizdir; kullanılabilir kota proje/hesap durumuna göre değişebilir. Sabit günlük soru sayısı sözü verilmez.

**Ücret oluşmaması için Google projesi faturalandırmaya bağlı olmamalıdır.** Kod kota dolunca başka modele veya sağlayıcıya geçmez; otomatik tekrar veya ücretli araç kullanmaz. Ancak anahtarın ücretli bir projeye ait olduğunu anahtar metninden anlayamaz ve ücretli anahtarı ücretsiz hâle getiremez. Bu projede sonradan faturalandırmayı açarsan aynı model çağrıları ücretli olabilir.

## 2. Cloudflare Worker'ı bir kez dağıt

Cloudflare hesabında **Workers Free** planını kullan. Ücretsiz planın da kullanım sınırları vardır.

### A. Terminal kullanmadan: hazır dosyayı dashboard'a koy

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application / Create Worker** yolunu aç.
2. **Start with Hello World** ile `matematik-akademim-ai` adlı Worker'ı oluşturup **Deploy** yap. Bu isimde Worker'ın zaten varsa onu aç.
3. **Edit code** bölümüne gir.
4. [Hazır tek dosyalı Worker'ı](../cloudflare-worker/bundle/worker.js) **Raw / Download raw file** ile aç. [Geliştirme dalındaki doğrudan Raw bağlantısı](https://raw.githubusercontent.com/MontanaS406/matematik-akademim/codex/ten-comic-teachers/cloudflare-worker/bundle/worker.js) da kullanılabilir; PR henüz birleştirilmediyse `main` eski kodu içerebilir.
5. Dosyanın tamamını kopyalayıp Cloudflare editöründeki Hello World kodunun tamamıyla değiştir ve **Deploy** yap. GitHub'ın kısaltılmış önizlemesinden yalnız görünen kısmı kopyalama.
6. Worker'ın **Settings → Variables and Secrets → Add** bölümüne şu üç ayarı ekle:

   | Tür | Ad | Değer |
   | --- | --- | --- |
   | **Secret** | `GEMINI_API_KEY` | Google AI Studio anahtarın |
   | **Text** | `GEMINI_MODEL` | `gemini-3.5-flash-lite` |
   | **Text** | `ALLOWED_ORIGINS` | `https://montanas406.github.io` |

7. Ayarları **Deploy** ile uygula. Secret değerinin kaydedildikten sonra gizli görünmesi normaldir.
8. Bu proje için merkezi adres `https://matematik-akademim-ai.c542478.workers.dev` olarak kaydedildi. Farklı bir Worker oluşturursan yeni adresi site sahibine bir kez bildir.

**Kullanılacak dosya `cloudflare-worker/bundle/worker.js` dosyasıdır.** Modüler `cloudflare-worker/worker.js` tek başına dashboard'a yapıştırılmaz. Hazır paket öğretmenleri ve gerekli modülleri içerir; API anahtarı içermez.

`ALLOWED_ORIGINS` değerine `/matematik-akademim/` ekleme; bu değer sitenin HTTPS origin'idir. Özel alan adı kullanılıyorsa onun origin'i de açıkça eklenir. `*` kullanılmaz.

### B. Alternatif: terminal ve Wrangler ile dağıt

Dashboard yolunu kullandıysan bu bölüm gerekli değildir. Kaynak kodla çalışmak isteyenler için Node.js 22 veya üzeri ve Git gerekir:

```sh
git clone https://github.com/MontanaS406/matematik-akademim.git
cd matematik-akademim
git switch codex/ten-comic-teachers
npm ci
npx wrangler login
npx wrangler deploy --config cloudflare-worker/wrangler.jsonc
npx wrangler secret put GEMINI_API_KEY --config cloudflare-worker/wrangler.jsonc
```

Son komut değer istediğinde Google anahtarını yapıştırıp Enter'a bas; anahtarı komutun sonuna ekleme. Depo zaten bilgisayarındaysa tekrar klonlamak yerine mevcut klasör ve geliştirme dalını kullan; yerel değişiklikleri silme. Wrangler'ın verdiği Worker adresini not et.

Kaynak değişince hazır dosya şu komutla yeniden üretilir:

```sh
npm run build:worker
```

Bu komut sır eklemez ve kendiliğinden dağıtım yapmaz. Worker dağıtımı, GitHub Pages'teki site sürümünü de yayımlamaz; frontend değişiklikleri ayrıca incelenip yayımlanır.

## 3. Merkezi site bağlantısı hazır

Worker adresi, bütün kullanıcılar için tek merkezi ayarda tutulur:

```json
{"workerUrl":"https://matematik-akademim-ai.c542478.workers.dev"}
```

Bu değer [`data/tutor-config.json`](../data/tutor-config.json) dosyasına kaydedildi; tekrar adres girmen gerekmez. Adres herkese açık hizmet adresidir, anahtar içermez. Ziyaretçiler dosya düzenlemez ve tarayıcılarında bağlantı ayarı yapmaz. İleride Worker adresi değişirse merkezi ayar yalnız bir kez güncellenir.

Adresin kayıtlı olması, adresteki Worker kodunun güncel veya Google anahtarının çalışır olduğunu kanıtlamaz. Aynı adrese yukarıdaki güncel bundle dağıtılmalı; `/health` sonucundaki `auth: supabase-session` ve diğer alanlar doğrulanmalıdır. Frontend yayını öncesi uyumluluk denetimi bunu kontrol eder. Eski Worker hâlâ kod bekliyorsa yeni site sürümünün hazır olduğu iddia edilmez.

## 4. Hesap erişimi otomatik çalışır

1. Kullanıcı siteyi açar; on öğretmeni ve hazır konuşma örneklerini görür.
2. AI ile konuşmak için normal e-posta/şifre hesabına giriş yapar. Geçerli hesap oturumunda tekrar bağlantı bilgisi girmez.
3. Worker, Supabase üzerinden oturumun gerçek kullanıcısını doğrular ve mevcut `ma_source_access_status` iznini kontrol eder.
4. E-postası doğrulanmış, yönetici onaylı hesap öğretmeni kullanabilir. Yeni/onaysız hesap normal erişim başvurusunu yapar; yönetici **Hesabım → Kaynak erişim yönetimi** bölümünden onay verir.
5. İzni kaldırılmış veya doğrulanmamış hesap AI isteği gönderemez. Oturum yenilenebiliyorsa mevcut hesap sistemi bunu yapar; yeniden giriş gerekirse yalnız normal hesap girişi istenir.

Bu değişiklik için yeni SQL göçü veya kullanıcı/ilerleme verisi taşıması gerekmez. Daha önce kurulmuş hesap ve izin sistemi kullanılır. Kullanıcının tarayıcısındaki rol/e-posta bilgisi tek başına yetki sağlamaz; Worker izin kararını sunucudan alır. AI yetkisi için arşiv şifreleme anahtarı istenmez.

Gemini anahtarını veya servis rolü anahtarını siteye eklemek gerekmez. Mevcut projenin açık Supabase URL'si ve publishable anahtarı ortak yapılandırmadan kullanılır. Farklı Supabase projesine geçmek, site sahibinin yapacağı ayrı bir yapılandırma değişikliğidir.

## 5. İlk gerçek bağlantıyı doğrula

1. [Worker sağlık adresini](https://matematik-akademim-ai.c542478.workers.dev/health) aç.
2. Beklenen alanları kontrol et:

   | Alan | Beklenen |
   | --- | --- |
   | `configured` | `true` |
   | `provider` | `gemini` |
   | `auth` | `supabase-session` |
   | `model` | `gemini-3.5-flash-lite` |
   | `billingPolicy` | `no-automatic-fallback` |
   | `teacherIds` | 10 öğretmen kimliği |
   | `dialogueResponseCount` | `750` |

   `configured: true` gerekli yapılandırmanın bulunduğunu gösterir; Google'ın anahtarı kabul ettiğini veya projenin ücretsiz olduğunu kanıtlamaz. `billingPolicy`, otomatik model/sağlayıcı geçişi bulunmadığını anlatır; Google projesinin faturalandırma durumunu okuyamaz.
3. Güncel site sürümünü açıp onaylı hesabınla normal giriş yap. **Öğretmen → Sohbet / Sorumu çöz** bölümünde Elif'ten kısa bir kavram açıklaması iste; sonra Beyza'yla aynı kavramı dene.
4. Kendi yazdığın matematik sorusunda önce ipucu, sonra adım adım çözümü dene. Anlatım düzeyini değiştir. AI yanıtını matematiksel olarak kontrol et; resmî cevap anahtarı sayma.
5. Başka bir onaylı hesap ve telefonla aynı akışı dene. Kod veya adres sorulmamalı. Bilgisayar kapalıyken telefonun interneti üzerinden yanıt gelebilmelidir.
6. Kota hatasında bekle; başka modele geçilmez. Kota durumunu [AI Studio Usage](https://aistudio.google.com/usage) sayfasından kontrol et. Çözüm olarak faturalandırma açmak gerekmez.

Yanıt gelmiyorsa Worker sürümünü, Gemini Secret'ını, merkezi Worker adresini, origin'i ve hesabın onay durumunu kontrol et. Supabase veya Gemini hizmeti doğrulanamazsa yetki atlanmaz; hata gösterilir.

Önceki kodlu sürümden geçerken yeni Worker artık `APP_ACCESS_TOKEN` kullanmaz. Yeni sürümü doğruladıktan sonra eski Secret'ı kaldırabilirsin. OpenAI anahtarı da Gemini sürümünde kullanılmaz. Hiçbir ziyaretçiden bu eski değerler istenmez.

## Veri ve teslim sınırı

Gönderilen mesajlar ve gereken sınırlı sohbet geçmişi Gemini'ye iletilir. Google'ın ücretsiz katman koşullarında bu içerikler ürünlerini iyileştirmek için kullanılabilir; kişisel veya gizli bilgileri sohbet mesajına yazma. Uygulama Supabase parolasını, oturum anahtarını veya üretim servis anahtarlarını kendiliğinden Gemini isteğine eklemez. Hesap oturumu yalnız yetki doğrulaması için Supabase'e gönderilir.

On öğretmen, **750 diyalog yanıtı + 350 kısa tepki + önceki 30 örnek = 1.130 öğretmen metni** korunur. Soru havuzları, denemeler ve ilerleme kayıtları değiştirilmez. Sohbet içinde çözülen kullanıcı soruları bankaya veya başarı kaydına eklenmez.

Otomatik testlerde dış servisler taklit edilir. Gerçek Google anahtarıyla ilk çağrı, hesap onayı ve Cloudflare dağıtımı kurulumdan sonra ayrıca doğrulanmalıdır. Yerel test başarısı canlı Gemini davranışı veya faturalandırma kontrolü değildir. Bu düzenleme gerçek anahtar üretmez, ücretli hesap açmaz ve üretim Supabase verilerini değiştirmez. Yayın kararı, Worker uyumluluk denetimi ve gerçek servis doğrulamasının son durumu güncel PR/yayın raporunda bildirilir.

## Resmî kaynaklar

- [Gemini model fiyatları](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite)
- [Gemini faturalandırma ve ücretsiz katman](https://aistudio.google.com/docs/billing)
- [Gemini API anahtarları](https://aistudio.google.com/docs/api-key)
- [Gemini kota ve istek sınırları](https://aistudio.google.com/docs/rate-limits)
- [Cloudflare Worker Secret ekleme](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare Workers plan sınırları](https://developers.cloudflare.com/workers/platform/pricing/)
