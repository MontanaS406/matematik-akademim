# Kaynaklı soru bankasına geçiş — 7 Kasım 2026

Çalışma, `main` dalının `87da58e` sürümünden açılan `codex/dogrulanmis-soru-bankasi` dalındadır. PR #2, #3 ve #4 incelendi; bu PR’ların main’e alınmış olduğu görüldü. Bu görevde ana dala yazılmadı ve yayın yapılmadı.

## Gerçek kaynak ve soru sayıları

| Ölçüt | Sonuç |
| --- | --- |
| Fiilen incelenen tekil kaynak belgesi | **42**: 26 resmî, 16 eğitim kaynağı belgesi |
| Ayrıca incelenen lisans metni | CC BY 3.0; soru kaynağı sayısına eklenmedi |
| Yeniden kullanımı doğrulanan içerik | Tyler Wallace’ın 2010 kitabından **6 bölüm PDF’si**; tek yazar/tek kitap |
| Kullanım hakkı ve yazar anahtarı doğrulanan soru | **12** |
| Uygulamaya eklenen gerçek soru | **12**, tamamı açık uçlu ders kitabı sorusu |
| Eklenen TYT/AYT/KPSS/ALES/DGS/MEB sorusu | **0** |
| İzin nedeniyle kabul edilmeyen ÖSYM grubu | **17** sınav/yıl/oturum kaynak grubu |
| Reddedilen tekil resmî soru sayısı | Bu gruplardaki her soru tek tek incelenmedi; sayısal toplam uydurulmadı |

[Ayrıntılı kaynak araştırması](SORU_KAYNAK_ARASTIRMASI.md), tekil belge listesini, izin kararlarını, soru numaralarını ve yazarın cevap sayfalarını içerir. Arama sonuçları, yinelenen URL okumaları ve açılamayan hedefler belge sayısına dahil değildir. Doğrulanan 12 adayın tamamı yayıma alındı; izin belirsizliği olan resmî ve diğer kaynaklar soru verisi olarak içeri aktarılmadı.

## Neler kaldırıldı?

- Eski `js/legacy.js` bütünüyle silindi. `gen`, `rand`, rastgele sayı ve seçenek üretimi ile eski alıştırma paneli artık yüklenemez.
- Müfredattaki **81 geliştirici alıştırması ve 27 hazır çözümlü örnek sorusu** kaldırıldı. 27 konunun tanımsal ders anlatımları korundu; artık soru verisi taşımıyor.
- Bu alıştırmalardan türeyen kısa seviye taraması, üç soruluk konu testi ve eski soru metinlerini yeniden açan tekrar yolu kaldırıldı. Yerine otomatik içerik konmadı.
- Tahmini ÖSYM PDF adresleri ve sayfa numaraları kaldırıldı. Sabit cevap anahtarı tablosu yok.
- Altı öğretmende yeni/benzer/rastgele soru, örnek alıştırma ve kontrol sorusu oluşturma talimatları kaldırıldı. Öğretmenler yalnızca sunucunun onaylı bankasındaki seçili `questionId` için açıklama yapabilir.

## Uygulamada ne gösteriliyor?

Denklem çözme, mutlak değer, polinom/çarpanlara ayırma, ikinci dereceden denklem ve üslü ifadeler konularında gerçek kaynak soruları gösterilir. Kartlarda özgün İngilizce soru, yazar, kitap, yıl, bölüm, kısa PDF’nin sayfa ve soru numarası, orijinal bağlantı, cevap doğrulama bağlantısı ve CC BY 3.0 atfı bulunur. Matematiksel değerler ve özgün soru sırası/kimliği değiştirilmedi; yalnız dizgi Unicode/metin olarak aktarıldı. Sorulara yeni A–E seçenekleri eklenmedi ve bunlar çıkmış Türk sınav soruları gibi etiketlenmedi.

Zorluk dereceleri ölçülmediği için `null` tutuldu. Soru bulunmayan konuda tam olarak “Bu konu için doğrulanmış ve kullanım izni bulunan soru henüz eklenmedi.” mesajı gösterilir. Kaynak metinlerine çeviri veya yeni soru eklenmez.

Açık uçlu yanıt karşılaştırması yalnız biçimsel eşleşmeyi denetler. Farklı ama eşdeğer ifade eşleşmeyebilir; böyle bir durumda yanlış matematik cevabı diye kaydedilmez, kaynak cevabı öz denetim için gösterilir. Çoktan seçmeli kaynak eklenirse yalnız özgün seçenekler kullanılır.

## Denemeler ve PDF kapısı

2018–2026 TYT/AYT yıl seçimi, kronometre, duraklatma, cevap alanları ve kişisel geçmiş korunur. Ancak doğrulanmış ve izinli tam sınav bulunmadığında arayüz “40 cevap alanı” der; “40 gerçek soruluk deneme” demez ve kaynaksız soru göstermez.

Resmî otomatik puanlama için aynı kaynaktan 1–40 özgün soru, beş özgün seçenek, resmî doğrulanmış cevaplar, tamlık kaydı ve düzeltme denetimi gereklidir. İptal edilmiş sorusu olan sınavlar için puanlama politikası uygulanana kadar otomatik puanlama kapalı kalır. Araştırmada **2026 AYT Matematik 23’ün sonradan iptal edildiği** görüldü; yalnız önceki C→A değişikliğine dayanılmaz. 2019 TYT Matematik 7 iptal bilgisi de kaynak raporundadır. Bütün yılların tam nihai anahtarlarının doğrulandığı iddia edilmez.

Bilinmeyen yerel PDF artık gösterilmez. Gömme için doğrulanmış tam sınav, açık gömme izni, kaynak SHA-256 özeti ve dosyanın aynı özetle eşleşmesi gerekir. Eski PDF önbelleği silinmez fakat kaynak kapısını geçmeden açılmaz. Bu, önceki genel PDF yükleme fallback’ini son “sıfır kaynaksız soru” talimatına göre daraltır.

## Hesaplar ve veri geçişi

- Mevcut deneme geçmişi, taslaklar, kullanıcı hesapları, öğretmen tercihleri ve eski ilerleme kimlikleri korunur. Eski soru metinleri bu kayıtlardan tekrar üretilmez.
- Öğrenme profili ilk kez üzerine yazılmadan önce yerelde tam ve değiştirilmeyen bir yedek alınır: `ma_source_bank_backup_v1_<hesap>_local`. İlk bulut profili de ayrı `_remote` anahtarında yedeklenir. Yedekleme başarısızsa sessizce güvenli geçiş yapılmış sayılmaz.
- `supabase/question-bank.sql` sadece yeni içerik tablolarını, yayın denetimini ve okuma RLS kurallarını tanımlar; kullanıcı tablolarına dokunmaz. Anonim/üye rollerine içerik yazma yetkisi verilmez.
- `supabase/question-bank-seed.sql` doğrulanmış 6 kaynak ve 12 soru için tekrar çalıştırılabilir inceleme/staging aktarımıdır. Kimlik çakışmasında var olan kaydı sessizce değiştirmez.
- **Üretim Supabase’e SQL uygulanmadı.** Uygulama ve Worker aynı denetlenmiş statik kataloğu kullanır; SQL, gelecekteki sunucu kataloğu için hazır ve PGlite ile test edilmiştir.

## AI öğretmen sınırı

Çağatay, Beyza, Zeynep, Profesör Kemal, Mert ve Elif’in kişilikleri, avatarları ve hesap tercihi korunur. İstek kaynağı istemcinin yazdığı bir metin veya URL olamaz; Worker seçili kimliği kendi kataloğundan çözer. Kaynak/lisans/cevap denetimi geçmezse model çağrılmaz. Yeni soru talepleri modelden önce reddedilir. Yanıt şeması seçili soru kimliğine bağlıdır; farklı kimlik ve yeni alıştırma göstergeleri reddedilir. Açıklama açıkça “AI açıklaması — resmî çözüm değildir” etiketi taşır.

Gerçek model çağrısı yapılmadı. Şema ve ek metin denetimleri tüm anlamsal model hatalarının matematiksel garantisi değildir; gerçek model kabul testi ve sürekli içerik denetimi gerekir. Kaynaklı soru seçilmeden gönderme düğmesi kapalıdır.

## Kalan işler

- Türk sınav soruları için açık yeniden yayımlama/gömme izni elde etmek ve bütün nihai anahtarları, iptal/düzeltmeleri soru bazında doğrulamak.
- Kapsanan beş konu dışındaki alanlar için izinli gerçek soru havuzunu genişletmek. Mevcut 12 soru tüm müfredatı veya bir TYT/AYT denemesini kapsamaz.
- Canlı Supabase üyelik/RLS ve gerçek AI/Worker bağlantısının izole kabul testi. Canlı kullanıcı kayıtları bu görevde değiştirilmedi.
- Gerçek telefon/Safari kontrolü, ileri matematik yanıtları için güvenilir cebirsel eşdeğerlik denetimi ve kaynak denetimlerinin dönemsel yenilenmesi.

Son test sayıları ve GitHub Actions sonucu PR açıklamasına eklenir. Kod kontrol noktası ilk olarak `07401ca` commit’iyle GitHub’a gönderildi; sonraki test/güvenli geçiş düzeltmeleri aynı dalda takip edilir.

## Son yerel doğrulama

- `npm test`: **54/54 geçti**. Kaynak/lisans/cevap kapısı, gerçek katalog özetleri ve cevapların cebirsel kontrolü, RLS/yayın tetikleyicileri, seed tekrar çalıştırma, eski kayıtları koruma ve öğretmen sınırları dahil.
- Chromium masaüstü + 390 px mobil: **70/70 E2E geçti**. Kaynak kartları, boş konu davranışı, öğretmen bağlamı, geçmiş/oturum regresyonları ve bilinmeyen PDF’nin engellenmesi dahil.
- `npm run audit:questions`: **6 kaynak kaydı / 12 soru**; 5 konu kimliği.
- `npm audit --audit-level=high`: **0 açık**.
- `git diff --check`: geçti. Mobil gerçek kaynak kartı görsel olarak da incelendi.

Testlerdeki sentetik veriler yalnız test klasöründedir. Tarayıcı testleri açıkça taklit edilmeyen dış HTTP isteklerini engeller. Bu sonuçlar canlı Supabase veya gerçek model bağlantısının test edildiği anlamına gelmez.
