# Kullanıcı arşivi — inceleme girdileri

Bu klasördeki `archive-input.json`, kullanıcının eklediği
`Matematik_Akademim_Codex_Aktarim_1165_AI_Orijinal_Indeks.zip`
dosyasındaki **tek ana listenin** (`ai_questions_review_queue.json`) kopyasıdır.
647 TYT ve 518 AYT alt listesi aynı kayıtları tekrar içerdiğinden ayrıca içe
aktarılmaz. Girdideki 1.165 kimlik, cevap, çözüm, etiket ve eski inceleme durumu
korunur. Girdi dosyası tek başına çözülebilir uygulama kataloğu değildir.

`original-index.json` yalnızca 8 dosyaya ilişkin 185 sayfa aralığı referansıdır.
`original-exam-index.csv` 480 sınav soru konumunu listeler; soru metni ve
doğrulanmış cevap içermez. ZIP'te bu dosyaların asıl kitapçıkları, sayfa görselleri
veya özgün soru gövdeleri yoktur. Bunlar görülmüş, matematiksel olarak çözülmüş,
lisanslanmış veya uygulamaya aktarılmış gerçek sorular olarak sayılmaz.

Kitaplık klasörüne doğrudan erişim sağlanamadı; ekli ZIP kullanıldı. ZIP içindeki
görev/audit dosyaları veri olarak okundu; beraberinde gelen JavaScript
çalıştırılmadı. Herkese açık depoya üçüncü taraf kitapçığı eklenmedi.

Yeni AI sorularının ebeveyni, bu arşivde **metni erişilebilir** olan bir AI
kaydının kimliğidir. Arşivdeki yayıncı/sayfa referansı, asıl yayının görüldüğü
veya sorunun çıkmış ÖSYM sorusu olduğu anlamına gelmez.

Bağımsız matematik denetimi, tekrar karantinası ve insan editör incelemesi ayrı
alanlardır. Yalnızca matematik denetimi geçen uygun satırlar uygulamanın AI
havuzuna alınır; insan editör onayı verilmez. Üretim, denetim ve yeniden derleme
komutları ana README ve geliştirme raporunda açıklanır.
