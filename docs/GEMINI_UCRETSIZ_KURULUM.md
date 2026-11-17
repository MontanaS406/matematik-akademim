# Gemini ücretsiz katman ve Cloudflare kurulumu

Resmî belgelerin araştırma tarihi: **16 Kasım 2026**. Kod ve teslim kontrolü: **17 Kasım 2026**.

Öğretmenin sunucusu Cloudflare Worker üzerinde çalışır. Siteyi telefondan veya
başka bir bilgisayardan açtığında kendi bilgisayarının açık kalması gerekmez.
İnternet bağlantısı, Google'ın kullanılabilir kotası ve Cloudflare hizmeti gerekir.
Bu kurulum soru havuzlarını, denemeleri, Supabase hesaplarını ve ilerleme
tablolarını değiştirmez.

## 1. Ücretsiz Google projesini oluştur

1. [Google AI Studio API anahtarları](https://aistudio.google.com/apikey)
   sayfasını aç ve Google hesabınla giriş yap.
2. Yeni bir proje oluştur veya yalnız bu uygulama için ayrılmış bir proje seç.
   Önceden ücretli kullanılan bir projeyi kontrol etmeden kullanma.
3. [AI Studio Projects](https://aistudio.google.com/projects) sayfasında projenin
   **Billing Tier** alanının **Free Tier** olduğunu kontrol et. Google bir
   proje doğrulaması istiyorsa ücretsiz katman için bu doğrulamayı tamamla.
4. **Set up billing**, **Upgrade**, kredi yükleme veya otomatik bakiye yükleme
   adımlarına geçme. Projeye bir Cloud Billing hesabı bağlama.
5. API anahtarları sayfasında bu proje için **Create API key** ile anahtar oluştur.
   Yeni anahtarın değerini yalnız aşağıdaki Cloudflare Secret alanına yapıştır.

Bu uygulama `gemini-3.5-flash-lite` modelini kullanır. Resmî fiyat sayfasında bu
modelin ücretsiz katmanda metin giriş ve çıkışı ücretsizdir. Kota, hesap/proje
durumuna göre değişebilir; sabit günlük soru sayısı sözü verilmez.

**Ücret oluşmaması için gereken asıl koşul, Google projesinin faturalandırmaya
bağlı olmamasıdır.** Uygulama kota dolduğunda başka modele veya sağlayıcıya
otomatik geçmez. Ancak bir API anahtarının ücretli projeye ait olup olmadığını
anahtar metninden anlayamaz; ücretli projede kullanılan anahtarı kodla ücretsiz
anahtara dönüştüremez. İleride bu projede faturalandırmayı açarsan aynı modelin
çağrıları ücretli olabilir. Google hesabındaki bütçe bildirimi de bu koşulun
yerine geçmez.

## 2. İki farklı gizli değeri ayır

| Ad | Ne işe yarar | Nereye yazılır |
| --- | --- | --- |
| `GEMINI_API_KEY` | Worker'ın Google Gemini'ye bağlanması | Yalnız Cloudflare **Secret** |
| `APP_ACCESS_TOKEN` | Senin tarayıcının kendi Worker'ına erişmesi | Cloudflare **Secret** ve uygulamadaki **Erişim kodu** |

`APP_ACCESS_TOKEN` için parola yöneticisiyle uzun, rastgele, ayrı bir erişim kodu
oluştur. Google anahtarını veya hesap parolanı bu kod yerine kullanma. Mevcut
Worker'ında zaten bir erişim kodu varsa aynı kodu koruyabilirsin.

**Gemini anahtarı siteye, GitHub'a, sohbet mesajına veya ekran görüntüsüne
yazılmaz.** Uygulamadaki bağlantı alanı Gemini anahtarı istemez.

## 3. Worker kodunu dağıt

Bu adımlar bir kez yapılır. Dağıtımdan sonra bilgisayarını kapatabilirsin.
Cloudflare hesabında **Workers Free** planı yeterlidir; ücretli plana geçme.
Ücretsiz planın da kullanım sınırları vardır.

### A. Terminal kullanmadan: hazır tek dosyayı dashboard'a koy

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) hesabına giriş yap.
2. **Workers & Pages** → **Create application / Create Worker** yolunu aç.
   **Start with Hello World** seçeneğiyle `matematik-akademim-ai` adlı Worker'ı
   oluştur ve **Deploy** düğmesine bas. Bu isimde Worker'ın zaten varsa onu aç.
3. Worker ekranında **Edit code** bölümüne gir.
4. [Hazır tek dosyalı Worker'ı](../cloudflare-worker/bundle/worker.js) aç.
   GitHub'da **Raw** veya **Download raw file** ile dosyanın tamamını al.
   [Geliştirme dalındaki doğrudan Raw bağlantısı](https://raw.githubusercontent.com/MontanaS406/matematik-akademim/codex/ten-comic-teachers/cloudflare-worker/bundle/worker.js)
   da kullanılabilir. Bu bağlantı PR dalını gösterir; `main` henüz yeni kodu
   içermiyor olabilir.
5. Raw dosyada **Ctrl+A → Ctrl+C** yap. Cloudflare editöründeki mevcut Hello World
   kodunu **Ctrl+A** ile seçip bu dosyanın **tamamını** yapıştır; **Deploy**'a bas.
   GitHub'ın kısaltılmış önizlemesinden yalnız görünen bölümü kopyalama.
6. Worker'ın **Settings → Variables and Secrets → Add** bölümünü aç. Aşağıdaki
   dört ayarı ayrı ayrı ekle; iki gizli değerin türü mutlaka **Secret** olsun:

   | Tür | Ad | Değer |
   | --- | --- | --- |
   | **Secret** | `GEMINI_API_KEY` | Google AI Studio'da oluşturduğun anahtar |
   | **Secret** | `APP_ACCESS_TOKEN` | Kendin oluşturduğun ayrı erişim kodu |
   | **Text** | `GEMINI_MODEL` | `gemini-3.5-flash-lite` |
   | **Text** | `ALLOWED_ORIGINS` | `https://montanas406.github.io` |

7. **Deploy** ile ayarları uygula. Secret alanları kaydedildikten sonra gizli
   görünür; anahtarın sayfada okunmaması normaldir. Mevcut `APP_ACCESS_TOKEN`
   değerini koruyorsan yeni bir kodla değiştirme.
8. Worker'ın `https://...workers.dev` adresini not et. Adresin sonuna `/health`
   ekleyerek aşağıdaki kontrolü yap.

**Kullanılacak dosya `cloudflare-worker/bundle/worker.js` dosyasıdır.**
`cloudflare-worker/worker.js` tek başına yapıştırılmaz; öğretmen ve müfredat
modülleri başka dosyalardadır. Hazır bundle bunları içine alır, API anahtarı
almaz. Hello World ilk oluşturulduğunda veya Secret'lar henüz eklenmediğinde
AI'ın çalışmaması beklenir.

`ALLOWED_ORIGINS` değerine `/matematik-akademim/` ekleme. Bu alan sitenin
**origin** bilgisidir. İleride özel alan adı kullanırsan onun HTTPS origin'ini
ayrıca ekle; tüm sitelere izin veren `*` kullanma.

### B. Alternatif: terminal ve Wrangler ile dağıt

Hazır dosya yolunu kullandıysan bu bölümü yapman gerekmez. Kaynak kodla çalışmak
isteyenler için Wrangler modülleri kendisi paketler.

Windows kullanıyorsan [Node.js'in](https://nodejs.org/) 22 veya daha yeni bir
sürümünü ve [Git'i](https://git-scm.com/downloads) kur. PowerShell'i yeniden aç.
Aşağıdaki komutları sırayla çalıştır:

```sh
git clone https://github.com/MontanaS406/matematik-akademim.git
cd matematik-akademim
git switch codex/ten-comic-teachers
npm ci
npx wrangler login
```

Tarayıcıda Cloudflare oturumunu açıp Wrangler'ın kendi hesabına erişimini onayla.
Depo zaten bilgisayarındaysa ikinci kez klonlamak yerine mevcut klasöre gir;
yerel değişikliklerini silmeden PR'daki güncel geliştirme dalını kullan.

Worker'ı paketleyip dağıt:

```sh
npx wrangler deploy --config cloudflare-worker/wrangler.jsonc
```

Bu komut Worker'ı oluşturur veya aynı adlı mevcut Worker'ı günceller. Dağıtım
bilerek yaptığın canlı değişikliktir; önce PR'daki kodu ve test raporunu incele.
Anahtarlar henüz yoksa AI isteklerinin yapılandırma hatası vermesi beklenir.
Terminalin verdiği `https://...workers.dev` adresini not et.

Şimdi gizli değerleri ekle:

```sh
npx wrangler secret put GEMINI_API_KEY --config cloudflare-worker/wrangler.jsonc
```

Komut değer istediğinde Google AI Studio'daki anahtarı yapıştırıp Enter'a bas.
Anahtarı komut satırının sonuna ekleme. İlk kurulum için erişim kodunu da ekle:

```sh
npx wrangler secret put APP_ACCESS_TOKEN --config cloudflare-worker/wrangler.jsonc
```

Buraya oluşturduğun ayrı erişim kodunu yapıştır. Mevcut Worker'ın erişim kodunu
koruyorsan bu ikinci gizli değeri değiştirmek gerekmez. İstersen bu iki komut
yerine A bölümündeki dashboard **Secret** alanlarını kullanabilirsin.
`GEMINI_MODEL` ve `ALLOWED_ORIGINS` normal değişkenleri depodaki
`cloudflare-worker/wrangler.jsonc` dosyasında zaten bulunur.

### Kaynak kod değişince hazır dosyayı yenile

`bundle/worker.js` üretilmiş bir dosyadır; düzenlemeyi asıl modüllerde yapıp
bundle'ı yeniden oluştur:

```sh
npm run build:worker
```

Bu komut projede sabitlenmiş esbuild sürümüyle tek dosyayı yeniden üretir;
Cloudflare'a kendiliğinden dağıtım yapmaz ve sır eklemez. Yeni bundle'ı dashboard'a
tekrar koyabilir veya Wrangler ile kaynak kodu dağıtabilirsin.

Worker dağıtımı, GitHub Pages'teki uygulamayı güncellemez. Yeni sohbet ve düzey
kontrollerinin canlı sitede görünmesi için frontend PR sürümünün de ayrıca
incelenip yayımlanması gerekir. Bu görevde otomatik merge/yayın yapılmadı.

## 4. Uygulamayı bağla

1. Güncel Matematik Akademim sürümünde **Öğretmen** bölümünü aç.
2. **Bağlantı ayarları** alanını aç.
3. Worker adresine Cloudflare'dan aldığın `https://...workers.dev` adresini yaz.
   Sonuna `/api/tutor` ekleme.
4. **Erişim kodu** alanına `APP_ACCESS_TOKEN` için belirlediğin ayrı kodu yaz.
   Buraya `GEMINI_API_KEY` yazma.
5. **Kaydet** düğmesine bas.
6. Öğretmenini seç; **Sohbet / Sorumu çöz** ile kendi matematik sorunu metin
   olarak yazabilir veya doğal sohbet edebilirsin. **Seçili konu** ile müfredat
   anlatımına geçebilirsin. İpucu/tam çözüm ve anlatım düzeyi kontrollerini kullan.

Telefonunda da aynı siteyi açıp Worker adresi ve erişim kodunu gir. Bağlantı
ayarları her cihaz/tarayıcı için ayrıdır; erişim kodunu oturum yeniden açıldığında
tekrar girmen gerekebilir. Google anahtarını telefona taşıman gerekmez.

## 5. İlk gerçek bağlantıyı doğrula

1. Worker adresinin sonuna `/health` ekleyip tarayıcıda aç.
2. Şu alanları kontrol et; bu uç nokta anahtarı göstermez:

   | Alan | Beklenen |
   | --- | --- |
   | `configured` | `true` |
   | `provider` | `gemini` |
   | `model` | `gemini-3.5-flash-lite` |
   | `billingPolicy` | `no-automatic-fallback` |
   | `teacherIds` | 10 öğretmen kimliği |
   | `dialogueResponseCount` | `750` |

   `configured: true`, yalnız gerekli ayarların bulunduğunu gösterir; Google'ın
   anahtarı kabul ettiğini veya projenin ücretsiz olduğunu kanıtlamaz.
   `billingPolicy`, uygulamanın otomatik sağlayıcı/model geçişi yapmadığını
   belirtir; Google projesinin faturalandırma durumunu okuyamaz.
3. Uygulamada Elif'i seçip kısa bir kavram açıklaması iste. Sonra Beyza'yı seçip
   aynı kavramı sor; mimarlık diliyle anlatması gerekir.
4. Kendi yazdığın matematik sorusunda önce ipucu, sonra adım adım çözümü dene.
   Yanıtı matematiksel olarak kontrol et; AI yanıtı resmî cevap anahtarı değildir.
5. Telefonundan aynı denemeyi yap. Bilgisayar kapalıyken telefonun interneti
   üzerinden de yanıt gelebilmelidir.
6. Kota hatası görülürse bekle; uygulama ücretli modele geçmez. Kota durumunu
   [AI Studio Usage](https://aistudio.google.com/usage) sayfasından kontrol et.
   Çözüm olarak faturalandırma açman gerekmez.

Google yanıtı gelmezse önce doğru Worker sürümünün dağıtıldığını, iki Secret'ın
eklendiğini ve origin değerini kontrol et. Anahtar/proje izni, ülke erişimi,
kota veya model hatası olduğunda başka sağlayıcıya otomatik geçiş yapılmaz.
Yeni Gemini bağlantısını doğruladıktan sonra eski `OPENAI_API_KEY` Secret'ını
Cloudflare'dan kaldırabilirsin; Gemini sürümü onu kullanmaz.

## Veri ve teslim sınırı

Gönderdiğin mesajlar ve yanıt için gereken sınırlı sohbet geçmişi Gemini'ye
iletilir. Google'ın ücretsiz katman koşullarında bu içerikler ürünlerini
iyileştirmek için kullanılabilir; kişisel veya gizli bilgilerini öğretmen
sohbetine yazma. Uygulama Supabase parolasını, oturum anahtarını ve üretim servis
anahtarlarını kendiliğinden Gemini isteğine eklemez.

On öğretmen ve genişletilen **750 diyalog yanıtı + 260 yeni kısa tepki** korunur.
Bu metinler canlı modelin her yanıtının birebir garantisi değildir. Otomatik
testlerde sağlayıcı yanıtları taklit edilir; gerçek Google anahtarıyla ilk çağrı
ve Cloudflare dağıtımı yukarıdaki hesap kurulumundan sonra doğrulanmalıdır.

Bu geliştirme sırasında anahtar üretilmedi, ücretli hesap açılmadı ve canlı
Supabase verilerine kurulum uygulanmadı. Kod hazırlığı canlı yayın yerine geçmez.

Teslim kontrollerinde **195/195 birim** ve **184 masaüstü/mobil tarayıcı**
testi geçti. Hazır dashboard Worker dosyası da modüler sunucuyla aynı sağlık
yanıtı ve taklit Gemini çağrısıyla denetlendi. Diyalog/AI soru bankası denetimleri
temizdir. Bu sonuçlar gerçek anahtarın çalıştığı veya faturalandırmanın kapalı
olduğu anlamına gelmez; bunlar yukarıdaki hesap kurulumu sırasında kontrol edilir.

## Resmî kaynaklar

- [Gemini model fiyatları](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite)
- [Gemini faturalandırma ve ücretsiz katman](https://aistudio.google.com/docs/billing)
- [Gemini API anahtarları](https://aistudio.google.com/docs/api-key)
- [Gemini kota ve istek sınırları](https://aistudio.google.com/docs/rate-limits)
- [Cloudflare Worker Secret ekleme](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare Workers plan sınırları](https://developers.cloudflare.com/workers/platform/pricing/)
