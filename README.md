# DEMİRBAŞ SOCIAL — V2.0 (PWA + Yöntem 2 Canlı Köprü)

iPhone, iPad ve Mac'te Safari / modern tarayıcı üzerinden çalışan, **Ana Ekrana Ekle (PWA)** destekli kişisel takipçi analizi ve güvenli takipten çıkarma merkezi.

## V2.0 Özellikleri
- **Bizi Takipten Çıkanlar (Snapshot Geçmişi):** Her tarama cihazda bir snapshot olarak saklanır; önceki taramaya göre takipten çıkanlar tarih/saat damgasıyla yakalanır.
- **Doğrudan ZIP & JSON Desteği (Yöntem 1):** Instagram'dan indirilen `.zip` arşivini açmadan doğrudan seçebilir veya `followers_1.json` / `following.json` yükleyebilirsin.
- **Yöntem 2 — `sessionid` Oturumu & Canlı Çekim:**
  - **Seçenek A:** `yerel-kopru/Baslat.command` ile `sessionid` ve `csrftoken` bağlayarak 1.5–3.5 sn hız korumalı canlı takipçi/ortak gönderi taraması ve Mod 1 otomatik unfollow kuyruğu.
  - **Seçenek B:** Sunucusuz tek tıkla tarayıcıdan canlı veri çekme betiği ve panodan aktarım.
- **Ortak Paylaşım & Whitelist Koruması (🛡):** Ortak içerik (`coauthor_producers` / etiket) yapılan hesapları listeler; korumaya alınanları toplu seçimden ve kuyruktan otomatik hariç tutar.
- **2 Güvenli Takipten Çıkarma Modu:**
  1. **Mod 1 — Korumalı Otomatik Kuyruk:** İşlemler arası rastgele **25–55 sn** bekleme, **saatlik maksimum 20 işlem** sınırı ve olası uyarıda anında duraklatma.
  2. **Mod 2 — Yarı Otomatik Hızlı Geçiş:** Seçilen profilleri sırayla iPhone'daki **Instagram** uygulamasında (`instagram://user?username=...`) açar; tek dokunuşla çıkıp **Sonraki** butonuna geçersin (sıfır bot riski).

## GitHub Pages Üzerinden Yayınlama
Kök dizindeki `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest` ve `icon.svg` dosyalarını `kayahandemirbas/demirbas-social` deposunun `main` dalına yüklemen yeterlidir (`yerel-kopru/` klasörü yalnızca kendi bilgisayarında çalıştırmak içindir).
