# Hesap ve RLS doğrulaması

Canlı Supabase hesabı, yönetici erişimi ve test kullanıcıları bu ortamda tanımlı değil. Üretim veritabanında SQL çalıştırılmadı, kullanıcı oluşturulmadı ve veri silinmedi.

## Yerelde doğrulananlar

- Playwright sahte HTTP servisiyle e-posta onaylı kayıt, giriş, sahibi filtrelenmiş sorgu, sonuç gönderme, çıkış, geç dönen yanıtın misafir geçmişine karışmaması.
- `supabase/schema.sql` PGlite içinde gerçek PostgreSQL motorunda çalıştırılır. Auth sağlayıcısı yerine test `auth.users` tablosu ve JWT claim okuyan `auth.uid()` işlevi kullanılır. `authenticated` rolünde iki farklı UUID ile SELECT, INSERT, UPDATE, DELETE ve sahip değiştirme izolasyonu; `anon` erişim reddi; net kısıtı ve null net kontrol edilir.
- Bu test, önerilen SQL politikasını doğrular. Canlı projedeki politikaların aynı olduğunu veya gerçek JWT, e-posta teslimi ve PostgREST yapılandırmasını doğrulamaz.

## SQL uygulama sınırı

`schema.sql` yeni/staging kurulum içindir: mevcut `exam_results` tablosu varsa hata verir; tabloyu değiştirmez veya silmez. Önce canlı şema ve `pg_policies` çıktısı incelenmeli. PostgreSQL permissive politikaları OR ile birleştirir; yeni sahiplik politikası eklemek eski geniş politikayı etkisizleştirmez. Mevcut sütun ve constraint farkları için ayrıca gözden geçirilmiş migration gerekir. `net` alanı puanlanmamış sonuç için null kabul etmelidir.

## Sonraki canlı kabul kontrolü

İzole staging projesinde iki ayrı test hesabıyla e-posta onayı, doğru/yanlış şifre, token yenileme ve çıkış kontrol edilmeli. A hesabının sonuç UUID’sini B oturumunda doğrudan REST ile okuma, değiştirme, silme ve A adına ekleme denenmeli. Kullanıcı filtresi istemcide yardımcı kontroldür; gerçek erişim sınırı RLS’dir. Test hesapları ve verileri yalnızca staging ortamında temizlenmeli. Service role veya gerçek şifreler commit edilmemeli.
