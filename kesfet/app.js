/* DEMİRBAŞ KEŞFET — Bağımsız Algoritma, Otorite Oranı, ER% ve Prime-Time Reels Motoru */

const STORE_KEY = "demirbas_kesfet_v1";
const $ = (id) => document.getElementById(id);

const SCHEDULES = {
  lifestyle: {
    label: "Yaşam / Vlog / Müzik",
    hashtags: "#keşfet #reelsinstagram #günlükvlog #müzik #istanbul #lifestyle #keşfetteyiz #viralreels #trend #öneri",
    hooks: [
      "Kimsenin sana söylemediği ama hayat kurtaran o detay…",
      "Bunu öğrendikten sonra bir daha eskisi gibi yapmayacaksın:",
      "Sonuna kadar izle, 3. saniyede ne demek istediğimi anlayacaksın.",
      "Bugün denediğim en iyi şey buydu (kaydet lazım olur):"
    ],
    days: [
      { d: "Paz", idx: 0, p1: "19:30", p2: "13:00", note: "Pazar akşam dinlenme akışı" },
      { d: "Pzt", idx: 1, p1: "20:00", p2: "12:30", note: "Hafta başı akşam zirvesi" },
      { d: "Sal", idx: 2, p1: "20:30", p2: "18:15", note: "Yüksek kaydetme oranı" },
      { d: "Çar", idx: 3, p1: "21:00", p2: "12:45", note: "Hafta ortası Reels pik saati" },
      { d: "Per", idx: 4, p1: "20:30", p2: "19:00", note: "DM paylaşım hızı yüksek" },
      { d: "Cum", idx: 5, p1: "18:30", p2: "13:15", note: "Cuma dışarı çıkmadan önce" },
      { d: "Cmt", idx: 6, p1: "19:00", p2: "14:00", note: "Hafta sonu keşfet kuşağı" }
    ]
  },
  creator: {
    label: "İçerik Üretici / Mizah",
    hashtags: "#reels #keşfet #mizah #komedi #türkiye #içeriküretici #fyp #keşfetbeniöneçıkar #eğlence #viral",
    hooks: [
      "Şunu yaşayan bir tek ben olamam değil mi?",
      "Arkadaşına göndermelik o an:",
      "Bekle… son sahneye dikkat et!",
      "3 saniyede özetliyorum, hazır mısın?"
    ],
    days: [
      { d: "Paz", idx: 0, p1: "20:00", p2: "15:00", note: "Yüksek DM paylaşım saati" },
      { d: "Pzt", idx: 1, p1: "20:30", p2: "13:00", note: "Akşam koltuk kuşağı" },
      { d: "Sal", idx: 2, p1: "21:00", p2: "18:30", note: "Uzun izlenme süresi" },
      { d: "Çar", idx: 3, p1: "21:15", p2: "13:00", note: "Haftanın en aktif gecesi" },
      { d: "Per", idx: 4, p1: "20:45", p2: "18:00", note: "Yorum etkileşimi yüksek" },
      { d: "Cum", idx: 5, p1: "18:00", p2: "22:30", note: "Gece geç kuşak bonusu" },
      { d: "Cmt", idx: 6, p1: "19:30", p2: "14:30", note: "Genel Keşfet trafiği" }
    ]
  },
  tech: {
    label: "Teknoloji / Eğitim",
    hashtags: "#teknoloji #yapayzeka #ipucu #yazılım #üretkenlik #keşfet #dijital #eğitim #rehber #pratikbilgiler",
    hooks: [
      "Bu ücretsiz aracı bilmiyorsan çok vakit kaybediyorsun:",
      "Telefonundaki bu gizli ayarı hemen kapat / aç:",
      "10 saatlik işi 2 dakikaya indiren yöntem (Kaydet):",
      "99 kişinin yanlış bildiği o teknik detay:"
    ],
    days: [
      { d: "Paz", idx: 0, p1: "19:00", p2: "11:30", note: "Yeni haftaya hazırlık kaydı" },
      { d: "Pzt", idx: 1, p1: "19:30", p2: "12:15", note: "Öğle molası + akşam kaydı" },
      { d: "Sal", idx: 2, p1: "20:00", p2: "09:30", note: "En yüksek Save (Kaydetme)" },
      { d: "Çar", idx: 3, p1: "20:00", p2: "12:30", note: "Algoritma eğitim kuşağı" },
      { d: "Per", idx: 4, p1: "19:45", p2: "17:45", note: "Mesai çıkışı toplu taşıma" },
      { d: "Cum", idx: 5, p1: "17:30", p2: "12:15", note: "Hafta sonu denemelik kayıt" },
      { d: "Cmt", idx: 6, p1: "13:30", p2: "19:30", note: "Öğlen araştırma kuşağı" }
    ]
  },
  business: {
    label: "İş / Girişim / Marka",
    hashtags: "#girişimcilik #eticaret #pazarlama #sosyalmedya #marka #işdünyası #motivasyon #strateji #keşfet #başarı",
    hooks: [
      "Satışlarını / erişimini anında ikiye katlayan tek değişiklik:",
      "Sıfırdan başlasaydım ilk 30 gün sadece şunu yapardım:",
      "Müşterilerin / takipçilerin aslında şuna bakıyor:",
      "Bu hatayı yapmayı bıraktığım gün her şey değişti:"
    ],
    days: [
      { d: "Paz", idx: 0, p1: "20:15", p2: "11:00", note: "Pazar vizyon & planlama" },
      { d: "Pzt", idx: 1, p1: "08:45", p2: "19:30", note: "Sabah iş başlangıcı zirvesi" },
      { d: "Sal", idx: 2, p1: "12:30", p2: "20:00", note: "B2B + profil ziyareti yüksek" },
      { d: "Çar", idx: 3, p1: "19:30", p2: "12:30", note: "Otorite içerik saati" },
      { d: "Per", idx: 4, p1: "20:00", p2: "09:00", note: "Takipçi dönüşüm oranı yüksek" },
      { d: "Cum", idx: 5, p1: "17:00", p2: "12:00", note: "Hafta özeti & vaka analizi" },
      { d: "Cmt", idx: 6, p1: "11:30", p2: "19:00", note: "Hafta sonu hikaye anlatımı" }
    ]
  }
};

function loadConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return {
      followers: raw.followers ?? 334,
      following: raw.following ?? 312,
      nonBack: raw.nonBack ?? 86,
      plays: raw.plays ?? 850,
      likes: raw.likes ?? 42,
      comments: raw.comments ?? 7,
      saves: raw.saves ?? 10,
      shares: raw.shares ?? 6,
      niche: raw.niche || "lifestyle"
    };
  } catch {
    return { followers: 334, following: 312, nonBack: 86, plays: 850, likes: 42, comments: 7, saves: 10, shares: 6, niche: "lifestyle" };
  }
}

const cfg = loadConfig();

function saveConfig() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); } catch {}
}

function tierName(r) {
  if (r >= 2.0) return "🔥 Yüksek Otorite (Creator)";
  if (r >= 1.4) return "✨ Güçlü Üretici Dengesi";
  if (r >= 1.0) return "⚖️ Dengeli Profil";
  return "⚠️ Takip Fazlası (Temizlik Önerilir)";
}

function renderRatioModule() {
  const f = Math.max(1, Number($("inpFollowers").value || 1));
  const g = Math.max(1, Number($("inpFollowing").value || 1));
  const nb = Math.min(g - 1, Math.max(0, Number($("inpNonBack").value || 0)));

  cfg.followers = f;
  cfg.following = g;
  cfg.nonBack = nb;
  saveConfig();

  const slider = $("unfollowSlider");
  slider.max = String(Math.max(0, g - 1));
  if (Number(slider.value) > g - 1) slider.value = String(nb);
  const removeCount = Number(slider.value);
  $("sliderValLabel").textContent = `${removeCount} kişi çıkarılırsa`;

  const curRatio = f / g;
  const afterFollowing = Math.max(1, g - removeCount);
  const targetRatio = f / afterFollowing;
  const gainPct = Math.round(((targetRatio - curRatio) / curRatio) * 100);

  $("curRatioText").textContent = curRatio.toFixed(2) + "x";
  $("curTierText").textContent = tierName(curRatio);
  $("targetRatioText").textContent = targetRatio.toFixed(2) + "x";
  $("targetTierText").textContent = tierName(targetRatio);
  $("gainPctText").textContent = (gainPct >= 0 ? "+%" : "%") + gainPct;
  $("cleanRemainText").textContent = `${afterFollowing} takip kalır`;

  const pct = Math.min(100, Math.max(8, Math.round((targetRatio / 2.0) * 100)));
  $("ratioMeterFill").style.width = pct + "%";

  const neededFor15 = Math.max(0, Math.ceil(g - f / 1.5));
  const neededFor20 = Math.max(0, Math.ceil(g - f / 2.0));

  $("ratioAdvice").innerHTML =
    `<strong>Algoritma Analizi:</strong> Mevcut <strong>${f} / ${g} (${curRatio.toFixed(2)}x)</strong> oranından <strong>${removeCount}</strong> kişi temizlendiğinde oranın <strong>${targetRatio.toFixed(2)}x</strong> seviyesine çıkıyor. ` +
    (neededFor15 > 0
      ? `<strong>1.50x Üretici Eşiğine</strong> geçmek için toplam <strong>${neededFor15}</strong> kişi, <strong>2.00x Otorite Eşiğine</strong> geçmek için <strong>${neededFor20}</strong> kişi azaltman yeterli (günde 15–20 kişiyi geçmeden kademeli ilerle).`
      : `Tebrikler! Profilin halihazırda <strong>1.50x Üretici Eşiğinin</strong> üzerinde görünüyor.`);
}

function renderErModule() {
  const f = Math.max(1, Number($("inpFollowers").value || 334));
  const plays = Math.max(0, Number($("inpPlays").value || 0));
  const likes = Math.max(0, Number($("inpLikes").value || 0));
  const comments = Math.max(0, Number($("inpComments").value || 0));
  const saves = Math.max(0, Number($("inpSaves").value || 0));
  const shares = Math.max(0, Number($("inpShares").value || 0));

  cfg.plays = plays; cfg.likes = likes; cfg.comments = comments; cfg.saves = saves; cfg.shares = shares;
  saveConfig();

  const rawActions = likes + comments + saves + shares;
  const erByFollowers = (rawActions / f) * 100;
  const erByPlays = plays > 0 ? (rawActions / plays) * 100 : 0;

  // Instagram Reels Algoritma Ağırlıklı Puan (Kaydetme 4x, DM Paylaşım 5x, Yorum 2.5x, Beğeni 1x)
  const weightedPoints = likes * 1 + comments * 2.5 + saves * 4 + shares * 5;
  const weightedRatio = (weightedPoints / f) * 100;
  const viralScore = Math.min(100, Math.round(weightedRatio * 1.9));

  $("viralScoreNum").textContent = String(viralScore);
  const color = viralScore >= 75 ? "#34d399" : (viralScore >= 45 ? "#ff7a1a" : "#f43f5e");
  $("scoreCircle").style.background = `conic-gradient(${color} ${viralScore}%, #262a33 ${viralScore}%)`;

  let label = "⚡ Geliştirilebilir";
  if (viralScore >= 80) label = "🚀 Yüksek Viral Potansiyel";
  else if (viralScore >= 60) label = "🔥 Keşfet Adayı";
  else if (viralScore >= 40) label = "✓ Sağlıklı Organik";

  $("erBadge").textContent = label;
  $("erHeadline").textContent = `ER: %${erByFollowers.toFixed(1)} · ${label}`;
  $("weightedBreakdown").textContent =
    `Ağırlıklı Puan: ${weightedPoints.toFixed(0)} · İzlenme Başına ER: %${erByPlays.toFixed(1)}`;

  const saveSharePct = rawActions > 0 ? Math.round(((saves + shares) / rawActions) * 100) : 0;
  let diagnosis = "";
  if (saves + shares < likes * 0.2) {
    diagnosis = `Beğeni sayın güzel ancak <strong>Kaydetme + DM Paylaşım oranın (%${saveSharePct})</strong> düşük kalıyor. Keşfet motoru beğeniden çok <em>"arkadaşa gönderme"</em> ve <em>"kaydetme"</em> sinyaline bakar: videonun sonuna hap bilgi özeti veya arkadaş etiketleme kancası ekle.`;
  } else if (plays < f * 1.5) {
    diagnosis = `Kaydetme/Paylaşım sinyalin çok güçlü (%${saveSharePct}), ancak izlenme açılışın düşük. Videonun <strong>ilk 1.5 saniyesindeki kanca (hook)</strong> metnini büyüterek kaydırma oranını azaltırsan Keşfet havuzuna hızla açılır.`;
  } else {
    diagnosis = `Harika denge! Etkileşimlerinin <strong>%${saveSharePct}</strong> kadarı yüksek katsayılı (Kaydetme + DM Paylaşım) sinyallerden geliyor ve izlenmen takipçi sayının <strong>${(plays / f).toFixed(1)} katına</strong> ulaşmış. Aynı formatta haftada 3–4 Reels ile devam et.`;
  }
  $("erAdvice").innerHTML = `<strong>Teşhis &amp; Aksiyon:</strong> ${diagnosis}`;
}

function renderScheduleAndHooks() {
  const pack = SCHEDULES[cfg.niche] || SCHEDULES.lifestyle;
  const now = new Date();
  const todayIdx = now.getDay();

  document.querySelectorAll(".niche-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.niche === cfg.niche)
  );

  // Sırayı Pazartesi -> Pazar göster
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((idx) => pack.days.find((x) => x.idx === idx));
  const todaySlot = pack.days.find((x) => x.idx === todayIdx);
  $("todayPrimeBadge").textContent = `BUGÜN ALTIN SAAT: ${todaySlot.p1} & ${todaySlot.p2}`;

  $("weekGrid").innerHTML = ordered.map((item) => {
    const isToday = item.idx === todayIdx;
    return `
      <div class="day-card ${isToday ? "today" : ""}">
        <div class="day-name">${item.d} ${isToday ? "• BUGÜN" : ""}</div>
        <div class="slot-prime">🔥 ${item.p1}</div>
        <div class="slot-sec">⚡ ${item.p2}</div>
        <span class="slot-note">${item.note}</span>
      </div>`;
  }).join("");

  $("timingAdvice").innerHTML =
    `<strong>${pack.label} Stratejisi:</strong> Bugün birincil altın pencere <strong>${todaySlot.p1}</strong> (${todaySlot.note}), alternatif pencere <strong>${todaySlot.p2}</strong>. Paylaşımdan <strong>10 dakika önce</strong> 1 adet etkileşimli Story (anket/emoji çubuğu) atmak ilk 30 dakika izlenme hızını %20–35 artırır.`;

  $("hookList").innerHTML = pack.hooks.map((h, i) => `
    <div class="hook-item">
      <span>"${h}"</span>
      <button class="copy-btn" data-copy="${encodeURIComponent(h)}" type="button">Kopyala</button>
    </div>
  `).join("");

  updateCountdown(todaySlot, pack);
}

function updateCountdown(todaySlot, pack) {
  const now = new Date();
  const [h, m] = todaySlot.p1.split(":").map(Number);
  let target = new Date(now);
  target.setHours(h, m, 0, 0);

  if (target <= now) {
    const tomorrowIdx = (now.getDay() + 1) % 7;
    const tomSlot = pack.days.find((x) => x.idx === tomorrowIdx);
    const [th, tm] = tomSlot.p1.split(":").map(Number);
    target = new Date(now.getTime() + 86400000);
    target.setHours(th, tm, 0, 0);
  }

  const diffMin = Math.max(1, Math.round((target - now) / 60000));
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  $("nextSlotPill").textContent = `⏱ Sonraki Prime-Time: ${hrs} sa ${mins} dk`;
}

/* Başlangıç Değerlerini Yükle */
$("inpFollowers").value = cfg.followers;
$("inpFollowing").value = cfg.following;
$("inpNonBack").value = cfg.nonBack;
$("unfollowSlider").value = cfg.nonBack;
$("inpPlays").value = cfg.plays;
$("inpLikes").value = cfg.likes;
$("inpComments").value = cfg.comments;
$("inpSaves").value = cfg.saves;
$("inpShares").value = cfg.shares;

["inpFollowers", "inpFollowing", "inpNonBack"].forEach((id) => {
  $(id).addEventListener("input", () => {
    if (id === "inpNonBack") $("unfollowSlider").value = $("inpNonBack").value;
    renderRatioModule();
    renderErModule();
  });
});

$("unfollowSlider").addEventListener("input", renderRatioModule);

["inpPlays", "inpLikes", "inpComments", "inpSaves", "inpShares"].forEach((id) => {
  $(id).addEventListener("input", renderErModule);
});

$("nicheTabs").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-niche]");
  if (!btn) return;
  cfg.niche = btn.dataset.niche;
  saveConfig();
  renderScheduleAndHooks();
});

$("hookList").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-copy]");
  if (!btn) return;
  const txt = decodeURIComponent(btn.dataset.copy);
  await navigator.clipboard.writeText(txt).catch(() => {});
  const prev = btn.textContent;
  btn.textContent = "✓ Kopyalandı";
  setTimeout(() => { btn.textContent = prev; }, 1200);
});

$("copyHashtagsBtn").addEventListener("click", async (e) => {
  const pack = SCHEDULES[cfg.niche] || SCHEDULES.lifestyle;
  await navigator.clipboard.writeText(pack.hashtags).catch(() => {});
  const btn = e.currentTarget;
  const prev = btn.textContent;
  btn.textContent = "✓ Hashtag Seti Kopyalandı";
  setTimeout(() => { btn.textContent = prev; }, 1400);
});

/* Yerel demirbas-social köprüsü açıksa 334/312/86 verisini tek tıkla çek */
$("syncBridgeBtn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  try {
    const res = await fetch("http://127.0.0.1:8090/api/state");
    const st = await res.json();
    if (st?.latest_snapshot) {
      $("inpFollowers").value = st.latest_snapshot.followers_count || 334;
      $("inpFollowing").value = st.latest_snapshot.following_count || 312;
      $("inpNonBack").value = (st.dont_follow_back || []).length;
      $("unfollowSlider").value = (st.dont_follow_back || []).length;
      renderRatioModule();
      renderErModule();
      btn.textContent = "✓ Güncellendi";
      setTimeout(() => { btn.textContent = "↻ Canlıdan Çek"; }, 1500);
      return;
    }
  } catch {}
  alert("Yerel demirbas-social köprüsü (port 8090) şu an açık değil; kutulardaki sayıları elle değiştirebilirsin.");
});

renderRatioModule();
renderErModule();
renderScheduleAndHooks();
setInterval(() => {
  const pack = SCHEDULES[cfg.niche] || SCHEDULES.lifestyle;
  const todaySlot = pack.days.find((x) => x.idx === new Date().getDay());
  updateCountdown(todaySlot, pack);
}, 30000);
