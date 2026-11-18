# DEMİRBAŞ SOCIAL — PWA MVP

iPhone, iPad ve Mac'te Safari/modern tarayıcı üzerinden çalışan ilk prototip.

## İlk sürümde
- Instagram veri arşivinden JSON/HTML/CSV dosyası yükleme denemesi
- Takipçi / takip edilen karşılaştırması
- Seni takip etmeyenler, senin takip etmediklerin, karşılıklı takip
- Kullanıcı adı arama
- CSV dışa aktarma
- PWA ve temel çevrimdışı önbellek

## Önemli
Bu bir MVP prototipidir. Instagram'ın dışa aktarma arşivindeki gerçek dosya yapısı örnek dosyalarla doğrulanmadan içe aktarıcının tüm formatları desteklediği varsayılmamalıdır. Gerçek hesap şifresi, oturum çerezi veya erişim tokenı istemez. Veriler bu sürümde tarayıcı içinde işlenir; kalıcı bulut senkronizasyonu henüz eklenmemiştir.

## GitHub üzerinden yayınlama
1. GitHub'da yeni, public repository oluştur: `demirbas-social`.
2. Bu klasördeki dosyaları repository'nin kök dizinine yükle.
3. Settings → Pages → Deploy from a branch → `main` / `/(root)` seç.
4. GitHub Pages HTTPS adresini oluşturunca iPhone Safari'de aç.
5. Paylaş → Ana Ekrana Ekle.

Not: GitHub Pages yayınlaması için repository public olmalıdır (ücretsiz hesapta). Gerçek kullanıcı verisi veya gizli anahtarlar bu depoya konmamalıdır.

## Geliştirme notu
Sonraki aşama: Instagram JSON/HTML arşiv formatını gerçek örneklerle doğrulamak; ardından Supabase Auth/Postgres ve Meta'nın resmî API izinleriyle çoklu cihaz senkronizasyonu.
