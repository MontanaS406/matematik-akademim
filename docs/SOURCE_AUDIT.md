# Resmî kaynak denetimi — 7 Kasım 2026

Başlangıç kodundaki 2023–2026 TYT/AYT cevap dizilerinin hiçbirinde duyuru adresi, nihai anahtar sürümü, belge özeti veya doğrulama kanıtı yoktu. Alan adının ÖSYM olması dosyanın gerçekten var olduğunu ve anahtarın doğru olduğunu kanıtlamaz.

| Yıl | TYT PDF / anahtar | AYT PDF / anahtar |
| --- | --- | --- |
| 2023 | Doğrulanamadı / puanlama kapalı | Doğrulanamadı / puanlama kapalı |
| 2024 | Doğrulanamadı / puanlama kapalı | Doğrulanamadı / puanlama kapalı |
| 2025 | Doğrulanamadı / puanlama kapalı | Doğrulanamadı / puanlama kapalı |
| 2026 | Doğrulanamadı / puanlama kapalı | Doğrulanamadı / puanlama kapalı |

`curl -I --max-time 15 https://dokuman.osym.gov.tr/` proxy CONNECT aşamasında HTTP 403 döndürdü. Ortam izinli alanları arasında ÖSYM yok. Tek tek belgeler indirilemedi; resmî duyuru ve sonradan yayımlanan düzeltmeler incelenemedi. Başlangıçtaki “2026 AYT 23. cevap A” iddiası doğrulanamadığı için hem metinden hem manuel anahtarı zorlayan kontrolden çıkarıldı. Eski diziler Git geçmişinde bulunabilir, uygulama artık bunlarla otomatik puanlama yapmaz. Önceki kayıtların hesaplanmış netleri korunur ancak doğrulanmış etiketi verilmez.

Başlangıçtaki URL ve matematik sayfası eşlemesi aday veri olarak korunuyor; otomatik PDF yükleme kapalı. Kullanıcı ÖSYM’den edindiği PDF’yi yerel yükleyebilir; dosyanın içeriği uygulama tarafından doğrulanmış sayılmaz. Matematik başlangıç sayfası da adaydır, PDF içinde gerekirse elle gidilmelidir. Telifli kitapçıklar depoya eklenmedi.

Resmî puanlamayı açmadan önce her yıl ve oturum için:

1. ÖSYM duyurusundan tam kitapçığı ve nihai cevap anahtarını bulun; yayımlanan kısmın 40 soruyu kapsadığını denetleyin.
2. Sonraki iptal/düzeltme duyurularını kontrol edin; iptal sorusu varsa puanlama modelini ayrıca uyarlayın.
3. Duyuru adresi, PDF adresi, kitapçık türü, sayfa, doğrulama tarihi ve SHA-256 özetini kaydedin.
4. Matematiğin 40 cevabını iki bağımsız okuma ile karşılaştırın; örnek net ve düzeltme regresyon testi ekleyin.
5. Ancak bu kanıtları içeren incelemeden sonra `ANSWER_KEYS` kaydını açın.

Kullanıcı anahtarıyla hesaplanan sonuç açıkça manuel değerlendirmedir. Anahtarsız sonuç `net: null` olarak saklanabilir; doğru/yanlış sayıları bilinmiyorsa arayüz bunları puan olarak sunmaz.
