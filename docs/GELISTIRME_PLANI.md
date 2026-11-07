# İkinci aşama geliştirme planı

Önce AGENTS.md, GECE_GOREVI.txt, PR #2 ve kullanıcı ekleri incelendi. PR #2'nin doğrulanmamış anahtarları puanlamama ve güvenli kayıt davranışı korunuyor. Bu çalışma onun dalından ayrılan `codex/ogrenme-platformu-ikinci-asama` dalındadır.

Öncelikler ve mevcut durum:

1. **Deneme süre ve kayıt bütünlüğü:** duraklat/devam, kalan süre, soru işareti ve yenileme testleri tamamlandı. 2018–2026 yıl seçimi eklendi; kaynak doğrulaması dış erişime bağlı.
2. **Öğretmenlerin gerçek davranış farkları:** altı tanım, avatar, karşılama, doğru/yanlış tepkisi, sunucu tarafı üslup seçimi ve ipucu/tam çözüm modu tamamlandı. Çağatay'ın argo seçimi açık yetişkin ve kullanım onayı gerektiriyor; onaylar profilde saklanmıyor.
3. **Eğitim içeriği:** 27 alanın her birinde giriş ünitesi, çözümlü örnek ve üç düzeyde toplam 81 özgün alıştırma tamamlandı. Kapsamlı üniversite programı veya sonsuz soru bankası olduğu iddia edilmiyor.
4. **Ölçme ve tekrar:** kısa seviye taraması, ön koşula göre plan, üç soruluk konu testi, yanlışları tekrar, kullanıcı etiketlerinden deneme konu analizi ve karşılaştırma tamamlandı.
5. **Hesap tercihleri ve öğrenme ilerlemesi:** yerelde kullanıcı ayrımı, güvenli profil birleştirme ve yeni RLS şema önerisi tamamlandı. Canlı veritabanına uygulanmadı; sunucu bağlantısı doğrulanmadı.
6. **Bütünleşik doğrulama:** Node/PGlite testleri, masaüstü/mobil E2E, görsel kontrol, CI ve kod incelemesi her değişiklik grubundan sonra yürütülür. Canlı servis ve gerçek cihaz kapsamı ayrıca raporlanır.

Sonraki öncelikler: izinli ÖSYM erişimiyle nihai kaynak denetimi; izole Supabase staging kurulumu; gerçek Worker/model kabul testi; daha geniş soru havuzu ve kapsamlı konu üniteleri. Kaynak kanıtı olmadan otomatik puanlama açılmaz.
