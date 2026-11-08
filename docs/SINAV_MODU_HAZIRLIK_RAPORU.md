# Matematik Akademim — güncel hazırlık raporu

PR #7’nin sade gece mavisi tasarımı temel alındı; dört ana bölüm korunur: Soru Çöz, Konular, Öğretmen, İlerleme. Yeni çalışma `codex/sade-sinav-modu` dalında kaydedilir ve PR #7’nin `codex/sade-arayuz` dalına zorlamasız ileri taşıma ile gönderilir. Önceki commit’ler korunur. `main` başlangıç ve son kontrolünde `6876396` idi; otomatik birleştirme veya yayın yapılmadı.

Bu devam turu `5fade4f` üzerinden yürütüldü. Uygulama/kaynak/test değişiklikleri `1fcbb8a`, `d5db1e1`, `235ec3c`, `e4ab0e2` commit’lerindedir.

## Bu tur tamamlananlar

- Eksik **2019 AYT** temel kitapçığının matematik 1–40 cevapları ÖSYM PDF’sinden sırayla doğrulandı. Fiziksel matematik sayfaları 26–36, anahtar sayfası 49. Daha sonraki resmî sonuç/iptal duyuruları kontrol edildi; AYT edebiyat/sosyal iptali matematiğe uygulanmadı. Ayrıntı: [birincil kaynak kanıtları](2019_AYT_DOGRULAMA.md).
- **2024 KPSS Lisans** kamuya açık %10 kitapçığı, yalnız yayımlanan matematik konumları **31, 41, 46** ve fiziksel başlangıç sayfası 12 ile seçilebilir. Tam 30 soruluk deneme veya tam anahtar değildir. Özgün matematik 42 iptali resmî duyuruyla ayrıca kaydedildi. Bu üç yayımlanmış sorudan biri değildir; yıl/tür düzeyindeki muhafazakâr iptal politikası nedeniyle net kapalı kalır.
- Aynı kişisel kitapçık **Yeniden çöz** ile tekrar çalışılabilir. Önceki bitmiş deneme, cevaplar, süre, metadata ve o denemenin kullanıcı anahtarı anlık görüntüsü aynı IndexedDB işlemi içinde arşivlenir; boş yeni deneme başlar. Depolama hatasında eski bitmiş çalışma aynen kalır.
- **Önceki çalışmalar** alanı yalnız Sınav Modu’nda, kapalı ayrıntı panelinde görünür. Geçmiş salt okunur; geçmişi incelerken güncel çalışmanın cevapları/süresi/PDF eşleştirmeleri değişmez. Tarihsel net, güncel resmî kaynak ve iptal denetiminden veya o denemeyle saklanan manuel anahtardan yeniden denetlenir. Geçmiş, JSON dışa aktarmaya dahildir.
- Aynı milisaniyede başlayan çalışmalar dâhil, eski sekmenin önceki deneme kaydını yeni denemenin üzerine yazması deneme kimliğiyle engellenir. Yeniden başlatma sırasında moddan çıkış yeni çalışmayı duraklatıp korur. Bekleyen kitapçık açma isteğiyle çakışan hata, arayüzü kilitli bırakmaz.
- Hesaptan çıkış yerel oturumu hemen kapatır; yakalanan eski Supabase oturumu için **scope=local** sunucu çıkışı gönderir. Geç yanıt yeni kullanıcı oturumunu etkilemez. Sunucu çıkışı doğrulanamazsa yerel çıkış korunur ve açık uyarı gösterilir. Auth isteklerindeki gereksiz PostgREST `Prefer` başlığı kaldırıldı.

## Gerçek kaynak ve puanlama sınırı

2018–2026 TYT/AYT için **18 temel kitapçık kimliği**, **16 iptalsiz tam matematik anahtarı** bulunur. 2019 TYT 7 ve 2026 AYT 23 iptalleri nedeniyle bu iki sınavda net kapalıdır. 2024 KPSS Lisans 42 için de doğrulanmış iptal puanlama politikası olmadan net üretilmez.

Özgün 2024 TYT/AYT dosyaları önceki turda kaydedilmiş yayıncı SHA-256 özetleriyle bağımsız tanınır. Diğer 14 kullanılabilir anahtarda dosya kimliği için açık kullanıcı teyidi gerekir; anahtar doğrulaması, dosya bağımsız doğrulanmış gibi gösterilmez. Bilinen hash ile uyuşmayan dosya, teyit kutusuyla kaynak anahtarına bağlanamaz.

Eski sonuç güncel kaynakla uyuşmuyorsa, dosya kimliği çelişiyorsa veya iptal varsa eski kaynak neti gösterilmez; saklanan cevap ve sonuç silinmez. Güvenilir anahtar varken manuel sonuçla üzerine yazılamaz. Gösterilen değer doğru−yanlış/4 **çalışma netidir**, ÖSYM yerleştirme puanı değildir.

Bu tur **0 yeni herkese açık soru** eklendi; mevcut **7 izinli kaynaktan 142 kayıt**, lisans bilgileri, altı öğretmen ve dersler korundu. Eklenenler bir tam sınavın kimliği/40 cevap anahtarı ve bir kısmi kaynak kaydıdır. Kaynak kontrolünde **9 tekil birincil belge** açıldı (7 HTML, 2 PDF); önceki araştırmadaki bazı kaynaklar yeniden kontrol edildiği için önceki toplamın üzerine doğrudan eklenmez. Soru kökü, şekil, seçenek veya telifli PDF baytı depoya kopyalanmadı; yeni matematik sorusu üretilmedi.

## Gizlilik ve eski veriler

Kişisel PDF, cevap, süre, anahtar ve deneme geçmişi yalnız hesap kimliğine ayrılan yerel IndexedDB’de kalır; Supabase veya AI’ya gönderilmez. Eski veritabanının sürümü değişmedi, silme veya yıkıcı migration yapılmadı. Eski kayıtlarda geçmiş alanı yoksa boş geçmiş olarak okunur. Yazımlar arşivi korur; geçmiş varken sınav kimliği/soru sırası değiştirilemez. 1000 arşiv sınırında eski denemeler silinmez; yeni tekrar isteği reddedilir.

Aynı cihazdaki hesap ayrımı şifreleme değildir. Tarayıcı verileri silinirse özel belgeler kaybolabilir; dosya indirme ve JSON dışa aktarma seçenekleri korunur. JSON dışa aktarma otomatik geri yükleme değildir. Uygulama içi bölüm/mod değişimi süreyi duraklatır; tarayıcı sekmesini doğrudan kapatmak veya çalışırken yenilemek kendiliğinden duraklatma garantisi vermez. Önce Duraklat kullanılmalıdır.

## Testler

Yerel tam paket: **91/91** birim/model/veritabanı testi ve **106/106** masaüstü/mobil Chromium senaryosu geçti. [Validate app CI](https://github.com/MontanaS406/matematik-akademim/actions/runs/42523290165) `e4ab0e2` sürümünde de başarılıdır. Yeni testler iki ve daha fazla denemeyi, anahtar anlık görüntülerini, salt okunur geçmişi, kayıt hatasında tek arşivle tekrar denemeyi, eski sekme yazımlarını, hesap ayrımını, geçmişin korunmasını ve sunucu çıkışı yarışlarını kapsar.

[Gerçek kitapçık entegrasyonu](https://github.com/MontanaS406/matematik-akademim/actions/runs/42523290047) **4/4 geçti**: resmî 2024 TYT ve AYT dosyaları masaüstü ve 390 piksel mobil Chromium görünümünde açıldı. Dosya SHA-256/boyutu, görüntüleyici, 40 cevap alanı, bir doğru işaret, 60 saniye duraklamanın dışlanması, yeniden açmada cevap/12 saniyenin korunması ve 1,00 net doğrulandı. Eski manuel sonucun güvenli yeniden hesaplanması da geçti. Aynı gerçek dosya yeniden çözüldü; eski 1,00 net ve cevap geçmişte korunurken yeni deneme boş başladı, yeniden yükleme sonrası salt okunur arşiv açıldı. Günlükte `repeatedAttemptPreserved: true` bulunur. Dış servise veri gövdeli gönderim sayısı 0’dır.

Bu CI işi kitapçık, soru metni, ekran görüntüsü, video veya iz eki yayımlamaz; geçici tarayıcı bağlamları kapanır. Ana E2E paketinin boş otomasyon belgeleri gerçek soru değildir ve soru bankasına girmez. Yeni 2019 AYT anahtarı birincil metin üzerinden kontrol edildi; gerçek 2019 dosyasıyla bu görüntüleme CI’sı yapılmış gibi raporlanmaz. 40 anahtar harfinin tamamının yeniden insan eliyle incelenmesi de 2024 CI kontrolünün iddiası değildir.

`npm run audit:questions`: 7 kaynak / 142 kayıt / 6 konu. Sözdizimi ve `git diff --check` temiz.

## Değişen dosyalar

- `data/turkish-exams.js`, `shared/exam-mode-catalog.js`: yeni gerçek kaynak kimliği/kapsam ve iptal bilgileri.
- `shared/private-library.js`, `js/private-exams.js`: atomik tekrar, geçmiş, salt okunur inceleme ve eski sekme koruması.
- `js/exams.js`: gerçek sunucu çıkışı isteği ve geç yanıt izolasyonu.
- `scripts/official-booklet-smoke.mjs`: gerçek dosyada tekrar ve geçmiş entegrasyonu.
- `tests/private-library.test.mjs`, `tests/turkish-exams.test.mjs`, `tests/exam-mode-catalog.test.mjs`, `tests/kpss-lisans-catalog.test.mjs`: model/katalog sınırları.
- `tests/e2e/exam-attempts.spec.mjs`, `private-attempt-storage.spec.mjs`, `account-logout.spec.mjs`, `kpss-lisans.spec.mjs`: yeni tarayıcı senaryoları.
- `docs/2019_AYT_DOGRULAMA.md`, `README.md`, bu rapor: kanıtlar, güncel akış ve sınırlar.

## Dış erişim gerektiren kalanlar

- KPSS tam nihai matematik anahtarları doğrulanamadı; kamuya açık kısmi kaynaklar tam sınav diye sunulmaz. 2019 AYT dâhil, 2024 TYT/AYT dışındaki yayıncı dosya özetleri henüz katalogda yoktur.
- Canlı Supabase `/auth/v1/settings` salt okunur kontrolü normal ağ yolunda proxy CONNECT **403** ile engellendi. Gerçek hesap/Auth/RLS işlemleri test edilmedi; otomasyon sahte servis ve yerel veritabanı kullanır. Üretim verisine yazılmadı, e-posta veya hesap oluşturulmadı.
- Gerçek AI Worker adresi ve sunucu sırları bu ortamda yoktur. `cloudflare-worker/wrangler.jsonc` içindeki `ALLOWED_ORIGINS` hâlâ şablondur. Canlı AI için gerçek Worker adresi, gerçek site origin’i ve sunucunun güvenli değişken alanında `OPENAI_API_KEY` / `APP_ACCESS_TOKEN` gerekir; bunlar istemciye veya GitHub’a konmaz. Kullanıcının yayın yasağı nedeniyle Worker/site yayını yapılmadı.
- Gerçek iOS/Safari/Android donanım testi yapılmadı; mobil testler Chromium emülasyonudur. Özel dosyalar cihazlar arasında eşitlenmez; JSON yedeğini uygulama içine geri aktarma akışı henüz yoktur.
