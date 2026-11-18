/* DEMİRBAŞ SOCIAL V2.0 — Snapshot Geçmişi, ZIP/JSON/Canlı Köprü, Whitelist ve 2 Güvenli Unfollow Modu */

const STORAGE_KEY = "demirbas_social_v2_store";
const $ = (id) => document.getElementById(id);
const norm = (s) => String(s || "").trim().replace(/^@/, "").toLowerCase();

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

const DEFAULT_BRIDGE = window.location.hostname.endsWith("github.io")
  ? "http://127.0.0.1:8090"
  : window.location.origin;

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        snapshots: Array.isArray(p.snapshots) ? p.snapshots : [],
        followers: Array.isArray(p.followers) ? p.followers : [],
        following: Array.isArray(p.following) ? p.following : [],
        unfollowers: Array.isArray(p.unfollowers) ? p.unfollowers : [],
        collabs: Array.isArray(p.collabs) ? p.collabs : [],
        whitelist: p.whitelist && typeof p.whitelist === "object" ? p.whitelist : {},
        bridgeUrl: p.bridgeUrl || DEFAULT_BRIDGE,
        accountUsername: p.accountUsername || ""
      };
    }
  } catch {}
  return {
    snapshots: [],
    followers: [],
    following: [],
    unfollowers: [],
    collabs: [],
    whitelist: {},
    bridgeUrl: DEFAULT_BRIDGE,
    accountUsername: ""
  };
}

const store = loadStore();
const ui = {
  tab: "notback",
  selected: new Set(),
  semiQueue: [],
  semiIdx: 0,
  pendingScriptUsers: [],
  bridgeConnected: false,
  pollTimer: null
};

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn("Depolama uyarısı:", e);
  }
}

function notify(msg, isError = false) {
  const b = $("statusBanner");
  const t = $("statusBannerText");
  b.className = "status-banner" + (isError ? " error" : "");
  t.textContent = msg;
  b.style.display = "flex";
}

function toUserObj(u) {
  if (typeof u === "string") {
    const un = norm(u);
    return un ? { user_id: un, username: un, full_name: "", avatar_url: "" } : null;
  }
  if (!u || typeof u !== "object") return null;
  const un = norm(u.username || u.value || u.title || "");
  if (!un) return null;
  return {
    user_id: String(u.user_id || u.pk || u.id || un),
    username: un,
    full_name: String(u.full_name || ""),
    avatar_url: String(u.avatar_url || u.profile_pic_url || "")
  };
}

function dedupeUsers(arr) {
  const map = new Map();
  for (const raw of arr || []) {
    const u = toUserObj(raw);
    if (!u) continue;
    const prev = map.get(u.username);
    if (prev) {
      if (!prev.full_name && u.full_name) prev.full_name = u.full_name;
      if (!prev.avatar_url && u.avatar_url) prev.avatar_url = u.avatar_url;
      if (prev.user_id === prev.username && u.user_id !== u.username) prev.user_id = u.user_id;
    } else {
      map.set(u.username, u);
    }
  }
  return [...map.values()];
}

/* Yeni taramayı önceki snapshot ile karşılaştır ve Bizi Takipten Çıkanları kaydet */
function applyNewSnapshot({ followers, following, collabs = [], accountUsername = "" }) {
  const cleanFollowers = dedupeUsers(followers);
  const cleanFollowing = dedupeUsers(following);
  const nowIso = new Date().toISOString();

  let newDroppedCount = 0;
  if (store.followers.length > 0) {
    const currentSet = new Set(cleanFollowers.map((u) => u.username));
    const existingUnfSet = new Set(store.unfollowers.map((u) => u.username + "|" + u.prev_snap_at));
    const prevSnapAt = store.snapshots[0]?.created_at || nowIso;

    for (const prevFollower of store.followers) {
      if (!currentSet.has(prevFollower.username)) {
        const key = prevFollower.username + "|" + prevSnapAt;
        if (!existingUnfSet.has(key)) {
          store.unfollowers.unshift({
            ...prevFollower,
            detected_at: nowIso,
            prev_snap_at: prevSnapAt
          });
          newDroppedCount++;
        }
      }
    }
  }

  store.followers = cleanFollowers;
  store.following = cleanFollowing;
  if (Array.isArray(collabs) && collabs.length > 0) {
    const cMap = new Map();
    for (const c of collabs) {
      const u = toUserObj(c);
      if (!u) continue;
      cMap.set(u.username, {
        ...u,
        collab_post_count: Number(c.collab_post_count || 1),
        last_post_url: String(c.last_post_url || "")
      });
    }
    store.collabs = [...cMap.values()].sort((a, b) => b.collab_post_count - a.collab_post_count);
  }
  if (accountUsername) store.accountUsername = norm(accountUsername);

  store.snapshots.unshift({
    id: Date.now(),
    created_at: nowIso,
    followers_count: cleanFollowers.length,
    following_count: cleanFollowing.length
  });
  if (store.snapshots.length > 25) store.snapshots.length = 25;

  ui.selected.clear();
  saveStore();
  renderAll();

  notify(
    `Analiz tamamlandı: ${cleanFollowers.length.toLocaleString("tr-TR")} takipçi, ${cleanFollowing.length.toLocaleString("tr-TR")} takip edilen` +
    (newDroppedCount > 0 ? ` · ${newDroppedCount} yeni takipten çıkan tespit edildi!` : ".")
  );
}

/* JSON / HTML / CSV içerisinden kullanıcıları çıkar */
function extractUsersFromJson(data) {
  const out = [];
  const walk = (v) => {
    if (!v) return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === "object") {
      if (Array.isArray(v.string_list_data)) {
        const titleName = typeof v.title === "string" ? v.title : "";
        for (const x of v.string_list_data) {
          const n = x.value || (x.href ? x.href.split("/").filter(Boolean).pop() : "") || titleName;
          if (n) out.push({ username: n, full_name: titleName && norm(titleName) !== norm(n) ? titleName : "" });
        }
        return;
      }
      if (v.username) {
        out.push({
          user_id: v.pk || v.id || v.user_id || v.username,
          username: v.username,
          full_name: v.full_name || "",
          avatar_url: v.profile_pic_url || v.avatar_url || ""
        });
      } else if (v.value && typeof v.value === "string" && (v.href || v.timestamp)) {
        out.push({ username: v.value });
      }
      Object.values(v).forEach(walk);
    }
  };
  walk(data);
  return dedupeUsers(out);
}

/* Gönderi arşivinden ortak paylaşım / etiketleri çıkar */
function extractCollabsFromPostJson(data, selfUsername = "") {
  const counts = new Map();
  const addMention = (uname, fullName = "") => {
    const n = norm(uname);
    if (!n || n === norm(selfUsername)) return;
    const cur = counts.get(n);
    if (cur) cur.collab_post_count += 1;
    else counts.set(n, { user_id: n, username: n, full_name: fullName, avatar_url: "", collab_post_count: 1 });
  };

  const walk = (v) => {
    if (!v) return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === "object") {
      if (Array.isArray(v.coauthor_producers)) {
        v.coauthor_producers.forEach((c) => addMention(c.username, c.full_name || ""));
      }
      if (v.usertags && Array.isArray(v.usertags.in)) {
        v.usertags.in.forEach((t) => t?.user && addMention(t.user.username, t.user.full_name || ""));
      }
      if (typeof v.title === "string") {
        for (const m of v.title.matchAll(/@([a-zA-Z0-9._]{2,30})/g)) addMention(m[1]);
      }
      Object.values(v).forEach(walk);
    }
  };
  walk(data);
  return [...counts.values()];
}

/* Saf Tarayıcı ZIP Açıcı (iPhone'da indirilen instagram-*.zip arşivini doğrudan okur) */
async function extractTextFilesFromZip(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Geçerli bir ZIP arşivi bulunamadı.");

  const totalEntries = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder("utf-8");
  const extracted = [];
  let ptr = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    ptr += 46 + nameLen + extraLen + commentLen;

    const lower = name.toLowerCase();
    if (
      lower.endsWith("/") ||
      !(lower.endsWith(".json") || lower.endsWith(".html") || lower.endsWith(".htm")) ||
      !(lower.includes("follower") || lower.includes("following") || lower.includes("post") || lower.includes("reel") || lower.includes("tag"))
    ) {
      continue;
    }

    const lNameLen = view.getUint16(localHeaderOffset + 26, true);
    const lExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
    const slice = bytes.subarray(dataStart, dataStart + compSize);

    let text = "";
    if (method === 0) {
      text = decoder.decode(slice);
    } else if (method === 8 && typeof DecompressionStream !== "undefined") {
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      writer.write(slice);
      writer.close();
      const buf = await new Response(ds.readable).arrayBuffer();
      text = decoder.decode(buf);
    }
    if (text) extracted.push({ name, text });
  }
  return extracted;
}

function classifyFileName(name) {
  const n = name.toLowerCase();
  if (n.includes("following")) return "following";
  if (n.includes("follower")) return "followers";
  if (n.includes("post") || n.includes("reel") || n.includes("tag")) return "posts";
  return "unknown";
}

function parseUsersFromRawText(text) {
  try {
    return extractUsersFromJson(JSON.parse(text));
  } catch {
    const matches = [...text.matchAll(/instagram\.com\/(?:_u\/)?([a-zA-Z0-9._]{2,30})/gi)]
      .map((m) => m[1])
      .filter((x) => !["p", "reel", "explore", "accounts", "stories"].includes(x.toLowerCase()));
    return dedupeUsers(matches);
  }
}

async function importUploadedFiles(fileList) {
  const virtualFiles = [];
  for (const f of fileList) {
    if (f.name.toLowerCase().endsWith(".zip")) {
      notify("ZIP arşivi cihaz üzerinde açılıyor…");
      const entries = await extractTextFilesFromZip(await f.arrayBuffer());
      virtualFiles.push(...entries);
    } else {
      virtualFiles.push({ name: f.name, text: await f.text() });
    }
  }

  let followers = [...store.followers];
  let following = [...store.following];
  let collabs = [...store.collabs];
  let gotFollowers = false;
  let gotFollowing = false;
  const unknowns = [];

  for (const vf of virtualFiles) {
    const kind = classifyFileName(vf.name);
    if (kind === "followers") {
      if (!gotFollowers) { followers = []; gotFollowers = true; }
      followers.push(...parseUsersFromRawText(vf.text));
    } else if (kind === "following") {
      if (!gotFollowing) { following = []; gotFollowing = true; }
      following.push(...parseUsersFromRawText(vf.text));
    } else if (kind === "posts") {
      try {
        collabs.push(...extractCollabsFromPostJson(JSON.parse(vf.text), store.accountUsername));
      } catch {}
    } else {
      try {
        const parsed = JSON.parse(vf.text);
        if (parsed && Array.isArray(parsed.followers) && Array.isArray(parsed.following)) {
          applyNewSnapshot(parsed);
          return;
        }
        if (parsed && parsed.relationships_following) {
          if (!gotFollowing) { following = []; gotFollowing = true; }
          following.push(...extractUsersFromJson(parsed));
          continue;
        }
      } catch {}
      const u = parseUsersFromRawText(vf.text);
      if (u.length) unknowns.push({ file: vf.name, users: u });
    }
  }

  if (unknowns.length) {
    const pick = prompt(
      "Dosya türü seçin:\n1 = Takipçiler (Followers)\n2 = Takip Edilenler (Following)\nDosya: " +
      unknowns.map((x) => x.file).join(", ")
    );
    if (pick === "1") {
      if (!gotFollowers) followers = [];
      unknowns.forEach((x) => followers.push(...x.users));
      gotFollowers = true;
    } else if (pick === "2") {
      if (!gotFollowing) following = [];
      unknowns.forEach((x) => following.push(...x.users));
      gotFollowing = true;
    }
  }

  if (!gotFollowers && !gotFollowing) {
    notify("Dosyalarda takipçi veya takip edilen listesi bulunamadı.", true);
    return;
  }

  applyNewSnapshot({ followers, following, collabs });
}

/* Sekme Verilerini Hesapla */
function computeTabs() {
  const followerSet = new Set(store.followers.map((u) => u.username));
  const followingSet = new Set(store.following.map((u) => u.username));
  const collabMap = {};
  for (const c of store.collabs) collabMap[c.username] = c.collab_post_count;

  const enrich = (u, subtitle) => ({
    ...u,
    collabCount: collabMap[u.username] || 0,
    subtitle
  });

  const notback = store.following
    .filter((u) => !followerSet.has(u.username))
    .map((u) => enrich(u, "Seni geri takip etmiyor"));

  const unfollowers = store.unfollowers.map((u) =>
    enrich(u, "Takipten çıkış: " + fmtDate(u.detected_at))
  );

  const fans = store.followers
    .filter((u) => !followingSet.has(u.username))
    .map((u) => enrich(u, "Seni takip ediyor · Sen takip etmiyorsun"));

  const mutual = store.following
    .filter((u) => followerSet.has(u.username))
    .map((u) => enrich(u, "Karşılıklı takipleşme"));

  const collabs = store.collabs.map((u) => ({
    ...u,
    collabCount: u.collab_post_count,
    subtitle: `${u.collab_post_count} ortak gönderi / etiket`
  }));

  const whitelist = Object.values(store.whitelist).map((u) =>
    enrich(u, "Korumaya alındı: " + fmtDate(u.added_at))
  );

  return { notback, unfollowers, fans, mutual, collabs, whitelist };
}

function getVisibleRows() {
  const all = computeTabs();
  const q = norm($("searchInput").value);
  const list = all[ui.tab] || [];
  if (!q) return list;
  return list.filter(
    (u) => u.username.includes(q) || (u.full_name || "").toLowerCase().includes(q)
  );
}

function renderAll() {
  const tabs = computeTabs();
  const hasData = store.snapshots.length > 0 || store.followers.length > 0 || store.following.length > 0;
  const lastSnap = store.snapshots[0];

  $("followersCount").textContent = hasData ? store.followers.length.toLocaleString("tr-TR") : "—";
  $("followingCount").textContent = hasData ? store.following.length.toLocaleString("tr-TR") : "—";
  $("notFollowingBack").textContent = hasData ? tabs.notback.length.toLocaleString("tr-TR") : "—";
  $("unfollowersCount").textContent = hasData ? tabs.unfollowers.length.toLocaleString("tr-TR") : "—";

  $("followersHint").textContent = lastSnap ? `Son: ${fmtDate(lastSnap.created_at)}` : "Henüz tarama yok";
  $("followingHint").textContent = store.accountUsername ? `@${store.accountUsername}` : (hasData ? "Kaydedilen snapshot" : "Henüz tarama yok");
  $("unfollowersHint").textContent = `${store.snapshots.length} snapshot kayıtlı`;
  $("snapshotTag").textContent = `V2.0 · ${store.snapshots.length} SNAPSHOT`;
  updateExploreMetrics(tabs);

  $("notbackTabCount").textContent = tabs.notback.length;
  $("unfollowersTabCount").textContent = tabs.unfollowers.length;
  $("fansTabCount").textContent = tabs.fans.length;
  $("mutualTabCount").textContent = tabs.mutual.length;
  $("collabsTabCount").textContent = tabs.collabs.length;
  $("whitelistTabCount").textContent = tabs.whitelist.length;

  document.querySelectorAll(".tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === ui.tab)
  );

  $("protectCollabsBtn").style.display = ui.tab === "collabs" && tabs.collabs.length > 0 ? "inline-block" : "none";
  $("protectSelectedBtn").style.display = ui.selected.size > 0 ? "inline-block" : "none";
  $("clearSelectBtn").style.display = ui.selected.size > 0 ? "inline-block" : "none";
  $("unfollowBar").style.display = ui.selected.size > 0 ? "block" : "none";
  $("selectedCountLabel").textContent = `${ui.selected.size} hesap seçildi`;

  const rows = getVisibleRows();
  if (!rows.length) {
    $("resultList").innerHTML = `
      <div class="empty">
        <span>◎</span>
        <strong>${hasData ? "Bu sekmede sonuç bulunamadı" : "Henüz analiz yapılmadı"}</strong>
        <p>${hasData ? "Arama filtresini temizleyebilir veya diğer sekmelere geçebilirsin." : "Instagram ZIP/JSON arşivini yükle, Yöntem 2 (sessionid) ile canlı tara veya Demo veriyi dene."}</p>
      </div>`;
    return;
  }

  $("resultList").innerHTML = rows.map((u) => {
    const uname = escapeHtml(u.username);
    const isSel = ui.selected.has(u.username);
    const isProt = Boolean(store.whitelist[u.username]);
    const initial = (u.username[0] || "?").toUpperCase();
    return `
      <div class="user-row ${isSel ? "selected" : ""} ${isProt ? "protected" : ""}" data-uname="${uname}">
        <div class="chk">${isSel ? "✓" : ""}</div>
        <div class="avatar">${u.avatar_url ? `<img src="${escapeHtml(u.avatar_url)}" alt="">` : initial}</div>
        <div class="user-meta">
          <div class="user-line">
            <span class="user-name">@${uname}</span>
            ${u.collabCount ? `<span class="badge-collab">🤝 ${u.collabCount} ortak</span>` : ""}
          </div>
          ${u.full_name ? `<div class="user-full">${escapeHtml(u.full_name)}</div>` : ""}
          ${u.subtitle ? `<div class="user-sub">${escapeHtml(u.subtitle)}</div>` : ""}
        </div>
        <div class="row-actions">
          <button class="shield-btn ${isProt ? "on" : ""}" data-shield="${uname}" type="button">
            ${isProt ? "🛡 Korumalı" : "+ Koru"}
          </button>
          <a class="ext-link" href="https://www.instagram.com/${encodeURIComponent(u.username)}/" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗</a>
        </div>
      </div>`;
  }).join("");
}

/* Liste Tıklama ve Kalkan Yönetimi */
$("resultList").addEventListener("click", (e) => {
  const shieldBtn = e.target.closest("[data-shield]");
  if (shieldBtn) {
    e.stopPropagation();
    const uname = shieldBtn.dataset.shield;
    if (store.whitelist[uname]) {
      delete store.whitelist[uname];
    } else {
      const found = getVisibleRows().find((r) => r.username === uname) || { user_id: uname, username: uname, full_name: "", avatar_url: "" };
      store.whitelist[uname] = { ...found, added_at: new Date().toISOString() };
      ui.selected.delete(uname);
    }
    saveStore();
    renderAll();
    return;
  }

  const row = e.target.closest(".user-row");
  if (!row) return;
  const uname = row.dataset.uname;
  if (ui.selected.has(uname)) ui.selected.delete(uname);
  else ui.selected.add(uname);
  renderAll();
});

function getSelectedUserObjects() {
  const allMap = new Map();
  for (const list of Object.values(computeTabs())) {
    for (const u of list) allMap.set(u.username, u);
  }
  const out = [];
  for (const uname of ui.selected) {
    if (store.whitelist[uname]) continue;
    out.push(allMap.get(uname) || { user_id: uname, username: uname, full_name: "", avatar_url: "" });
  }
  return out;
}

function removeUnfollowedLocally(usernames) {
  const drop = new Set(usernames.map(norm));
  store.following = store.following.filter((u) => !drop.has(u.username));
  for (const un of drop) ui.selected.delete(un);
  saveStore();
  renderAll();
}

/* Demo Verisi (2 ardışık Snapshot simüle eder -> Bizi Takipten Çıkanlar + Ortak Paylaşım görünür) */
function runDemo() {
  store.followers = [
    { user_id: "101", username: "ayse.foto", full_name: "Ayşe Yılmaz", avatar_url: "" },
    { user_id: "102", username: "mehmet_34", full_name: "Mehmet Demir", avatar_url: "" },
    { user_id: "103", username: "selin.art", full_name: "Selin Kaya", avatar_url: "" },
    { user_id: "104", username: "burak.music", full_name: "Burak Şahin", avatar_url: "" },
    { user_id: "105", username: "deniz.design", full_name: "Deniz Arslan", avatar_url: "" },
    { user_id: "106", username: "studio_example", full_name: "Studio Creative", avatar_url: "" }
  ];
  store.following = [
    { user_id: "101", username: "ayse.foto", full_name: "Ayşe Yılmaz", avatar_url: "" },
    { user_id: "102", username: "mehmet_34", full_name: "Mehmet Demir", avatar_url: "" },
    { user_id: "201", username: "kaya_video", full_name: "Kaya Prodüksiyon", avatar_url: "" },
    { user_id: "202", username: "mert.fx", full_name: "Mert Efekt", avatar_url: "" },
    { user_id: "203", username: "marka.vitrin", full_name: "Marka Vitrin Official", avatar_url: "" },
    { user_id: "106", username: "studio_example", full_name: "Studio Creative", avatar_url: "" }
  ];
  store.snapshots = [{ id: Date.now() - 86400000, created_at: new Date(Date.now() - 86400000).toISOString(), followers_count: 6, following_count: 6 }];
  store.whitelist["studio_example"] = { user_id: "106", username: "studio_example", full_name: "Studio Creative", avatar_url: "", added_at: new Date().toISOString() };

  // 2. Tarama: selin.art ve burak.music takipten çıkmış olsun
  applyNewSnapshot({
    accountUsername: "demirbas.demo",
    followers: store.followers.filter((u) => u.username !== "selin.art" && u.username !== "burak.music"),
    following: store.following,
    collabs: [
      { user_id: "106", username: "studio_example", full_name: "Studio Creative", collab_post_count: 4 },
      { user_id: "201", username: "kaya_video", full_name: "Kaya Prodüksiyon", collab_post_count: 2 }
    ]
  });
}

/* YÖNTEM 2: Yerel Köprü Sunucusu ve Canlı Tarama Betiği */
async function bridgeFetch(path, body) {
  const base = ($("bridgeUrlInput").value || store.bridgeUrl || "http://127.0.0.1:8090").trim().replace(/\/+$/, "");
  store.bridgeUrl = base;
  saveStore();
  const opts = body !== undefined
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : { method: "GET" };
  const res = await fetch(base + path, opts);
  if (!res.ok) throw new Error("Köprü yanıt vermedi (HTTP " + res.status + ")");
  return res.json();
}

function startBridgePolling() {
  if (ui.pollTimer) return;
  ui.pollTimer = setInterval(async () => {
    try {
      const st = await bridgeFetch("/api/state");
      ui.bridgeConnected = true;
      $("sessionPillText").textContent = st.session?.logged_in ? "Köprü Aktif · Canlı" : "Köprü Bağlı";

      if (st.scan?.active) {
        notify("⏳ " + st.scan.message);
      } else if (st.scan?.phase === "done" && st.latest_snapshot) {
        const remoteStamp = st.latest_snapshot.created_at;
        if (store._lastSyncedRemoteSnap !== remoteStamp) {
          store._lastSyncedRemoteSnap = remoteStamp;
          const followers = st.all_followers || [];
          const notBack = st.dont_follow_back || [];
          const mutuals = st.mutuals || [];
          applyNewSnapshot({
            accountUsername: st.latest_snapshot.username || "",
            followers,
            following: [...mutuals, ...notBack],
            collabs: st.collabs || []
          });
        }
      }

      const rn = st.runner;
      if (rn && (rn.pending_count > 0 || rn.is_running || rn.is_paused_warning)) {
        $("queueCard").style.display = "block";
        $("queueTitle").textContent = `⏱ Korumalı Kuyruk (${rn.pending_count} bekliyor · Saatlik: ${rn.completed_last_hour}/20)`;
        $("queueSubText").textContent = rn.status_message;
        $("qPauseBtn").style.display = rn.is_running ? "inline-block" : "none";
        $("qResumeBtn").style.display = !rn.is_running && rn.pending_count > 0 ? "inline-block" : "none";
      } else {
        $("queueCard").style.display = "none";
      }
    } catch {
      ui.bridgeConnected = false;
    }
  }, 2500);
}

function buildBrowserLiveScannerScript() {
  return `(async () => {
  const sleep = () => new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
  const csrf = (document.cookie.match(/(^| )csrftoken=([^;]+)/)||[])[2] || "";
  const headers = { "X-IG-App-ID": "936619743392459", "X-Requested-With": "XMLHttpRequest", "X-CSRFToken": csrf };
  console.log("🔍 DEMİRBAŞ SOCIAL: Oturum doğrulanıyor...");
  const meRes = await fetch("/api/v1/accounts/current_user/?edit=true", { credentials: "include", headers });
  const me = await meRes.json();
  const uid = String(me?.user?.pk || (document.cookie.match(/(^| )ds_user_id=([^;]+)/)||[])[2] || "");
  if (!uid) return alert("Aktif Instagram oturumu bulunamadı!");
  async function grab(ep, label) {
    const map = new Map(); let maxId = "";
    while (true) {
      const url = maxId ? ep + "&max_id=" + encodeURIComponent(maxId) : ep;
      const r = await fetch(url, { credentials: "include", headers });
      if (r.status === 429) throw new Error("429 Hız Sınırı! Güvenlik için durduruldu.");
      const d = await r.json();
      for (const u of (d.users || [])) map.set(String(u.pk), { user_id: String(u.pk), username: u.username, full_name: u.full_name || "" });
      console.log(label + ": " + map.size);
      if (!d.next_max_id || !d.users?.length) break;
      maxId = d.next_max_id; await sleep();
    }
    return [...map.values()];
  }
  const followers = await grab("/api/v1/friendships/" + uid + "/followers/?count=50", "Takipçi");
  await sleep();
  const following = await grab("/api/v1/friendships/" + uid + "/following/?count=50", "Takip Edilen");
  const payload = JSON.stringify({ accountUsername: me?.user?.username || "", followers, following, collabs: [] });
  await navigator.clipboard.writeText(payload).catch(() => {});
  window.prompt("Tarama tamamlandı! Aşağıdaki JSON kopyalandı; DEMİRBAŞ SOCIAL'a yapıştırın:", payload);
})();`;
}

function buildProtectedUnfollowScript(users) {
  const slim = users.map((u) => ({ user_id: u.user_id, username: u.username }));
  return `(async () => {
  const targets = ${JSON.stringify(slim)};
  const csrf = (document.cookie.match(/(^| )csrftoken=([^;]+)/)||[])[2] || "";
  if (!csrf) return alert("csrftoken bulunamadı! instagram.com sekmesinde çalıştırın.");
  const headers = { "X-IG-App-ID": "936619743392459", "X-Requested-With": "XMLHttpRequest", "X-CSRFToken": csrf, "Content-Type": "application/x-www-form-urlencoded" };
  let count = 0;
  for (const t of targets) {
    if (count >= 20) { alert("Saatlik maksimum 20 güvenli işlem sınırına ulaşıldı, kuyruk durduruldu."); break; }
    let uid = t.user_id;
    if (!/^[0-9]+$/.test(String(uid))) {
      const info = await fetch("/api/v1/users/web_profile_info/?username=" + encodeURIComponent(t.username), { credentials: "include", headers }).then(r => r.json());
      uid = info?.data?.user?.id;
    }
    if (!uid) continue;
    const res = await fetch("/api/v1/friendships/destroy/" + uid + "/", { method: "POST", credentials: "include", headers, body: "container_module=profile&user_id=" + uid });
    const data = await res.json().catch(() => ({}));
    if (res.status === 429 || !res.ok || data.status === "fail" || data.message === "feedback_required") {
      alert("Instagram güvenlik uyarısı algılandı! Kuyruk anında durduruldu."); break;
    }
    count++;
    console.log("✓ Takipten çıkarıldı (" + count + "/" + targets.length + "): @" + t.username);
    if (count < targets.length) {
      const wait = Math.floor(25 + Math.random() * 31);
      console.log("⏳ Sonraki işlem için " + wait + " sn bekleniyor...");
      await new Promise(r => setTimeout(r, wait * 1000));
    }
  }
  alert("Korumalı kuyruk tamamlandı: " + count + " hesap çıkarıldı.");
})();`;
}

/* Mod 1 Başlat */
async function startMode1() {
  const targets = getSelectedUserObjects();
  if (!targets.length) {
    notify("Seçilen hesapların tamamı Koruma Listesinde!", true);
    return;
  }

  try {
    const res = await bridgeFetch("/api/queue/start", { users: targets });
    if (res.ok) {
      ui.selected.clear();
      renderAll();
      startBridgePolling();
      notify(`${targets.length} hesap 25–55 sn korumalı otomatik kuyruğa alındı.`);
      return;
    }
  } catch {}

  // Köprü açık değilse tek tıkla korumalı kuyruk betiği üret
  ui.pendingScriptUsers = targets;
  $("scriptQueueCount").textContent = targets.length;
  $("generatedQueueScript").value = buildProtectedUnfollowScript(targets);
  $("scriptQueueModal").style.display = "flex";
}

/* Mod 2 Yarı Otomatik Hızlı Geçiş */
function startMode2() {
  const targets = getSelectedUserObjects();
  if (!targets.length) {
    notify("Seçilen hesapların tamamı Koruma Listesinde!", true);
    return;
  }
  ui.semiQueue = targets;
  ui.semiIdx = 0;
  ui.selected.clear();
  renderAll();
  updateSemiModal();
  $("semiAutoModal").style.display = "flex";
}

function updateSemiModal() {
  const u = ui.semiQueue[ui.semiIdx];
  $("semiTitle").textContent = `Hızlı Geçiş (${ui.semiIdx + 1} / ${ui.semiQueue.length})`;
  $("semiUsername").textContent = "@" + u.username;
  $("semiFullname").textContent = u.full_name || "";
  $("semiAppLink").href = `instagram://user?username=${encodeURIComponent(u.username)}`;
  $("semiWebLink").href = `https://www.instagram.com/${encodeURIComponent(u.username)}/`;
}

/* Event Bağlantıları */
$("fileInput").addEventListener("change", (e) => {
  if (e.target.files?.length) importUploadedFiles(e.target.files);
  e.target.value = "";
});

$("demoBtn").addEventListener("click", runDemo);

document.querySelectorAll(".tab").forEach((b) =>
  b.addEventListener("click", () => {
    ui.tab = b.dataset.tab;
    ui.selected.clear();
    renderAll();
  })
);

document.querySelectorAll("[data-jump]").forEach((card) =>
  card.addEventListener("click", () => {
    ui.tab = card.dataset.jump;
    ui.selected.clear();
    renderAll();
  })
);

$("searchInput").addEventListener("input", renderAll);

$("selectAllBtn").addEventListener("click", () => {
  ui.selected.clear();
  for (const r of getVisibleRows()) {
    if (!store.whitelist[r.username]) ui.selected.add(r.username);
  }
  renderAll();
});

$("clearSelectBtn").addEventListener("click", () => {
  ui.selected.clear();
  renderAll();
});

$("protectSelectedBtn").addEventListener("click", () => {
  const nowIso = new Date().toISOString();
  for (const u of getSelectedUserObjects()) {
    store.whitelist[u.username] = { ...u, added_at: nowIso };
  }
  ui.selected.clear();
  saveStore();
  renderAll();
  notify("Seçilen hesaplar Koruma Listesine (Whitelist) eklendi.");
});

$("protectCollabsBtn").addEventListener("click", () => {
  const nowIso = new Date().toISOString();
  for (const c of store.collabs) {
    store.whitelist[c.username] = { ...c, added_at: nowIso };
  }
  saveStore();
  renderAll();
  notify("Tüm ortak paylaşım yaptığın hesaplar korumaya alındı.");
});

$("exportBtn").addEventListener("click", () => {
  const rows = getVisibleRows();
  const csv = "username,full_name,info\r\n" + rows.map((r) =>
    `"${r.username.replace(/"/g, '""')}","${(r.full_name || "").replace(/"/g, '""')}","${(r.subtitle || "").replace(/"/g, '""')}"`
  ).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `demirbas-social-${ui.tab}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("mode1Btn").addEventListener("click", startMode1);
$("mode2Btn").addEventListener("click", startMode2);

$("openMethod2Btn").addEventListener("click", () => {
  $("bridgeUrlInput").value = store.bridgeUrl || "http://127.0.0.1:8090";
  $("method2Modal").style.display = "flex";
});
$("sessionPillBtn").addEventListener("click", () => {
  $("bridgeUrlInput").value = store.bridgeUrl || "http://127.0.0.1:8090";
  $("method2Modal").style.display = "flex";
});
$("closeMethod2Btn").addEventListener("click", () => {
  $("method2Modal").style.display = "none";
});

$("saveAndLiveScanBtn").addEventListener("click", async () => {
  const cookie_or_sessionid = $("sessionIdInput").value.trim();
  const csrftoken = $("csrfInput").value.trim();
  if (!cookie_or_sessionid) {
    alert("Lütfen sessionid değerini girin.");
    return;
  }
  try {
    await bridgeFetch("/api/session", { cookie_or_sessionid, csrftoken });
    await bridgeFetch("/api/scan", {});
    $("method2Modal").style.display = "none";
    startBridgePolling();
    notify("Canlı tarama başlatıldı (1.5–3.5 sn hız korumalı)…");
  } catch (err) {
    alert("Yerel köprü sunucusuna ulaşılamadı. Masaüstündeki anti/demirbas-social/yerel-kopru/Baslat.command dosyasını çalıştırın veya B seçeneğindeki Köprüsüz Canlı Çekim'i kullanın.\n\nDetay: " + err.message);
  }
});

$("copyScannerScriptBtn").addEventListener("click", async () => {
  const code = buildBrowserLiveScannerScript();
  await navigator.clipboard.writeText(code).catch(() => {});
  notify("Canlı tarama kodu kopyalandı! instagram.com sekmesinde çalıştırıp veriyi buraya yapıştırın.");
});

$("pasteLiveJsonBtn").addEventListener("click", async () => {
  try {
    const txt = await navigator.clipboard.readText();
    const parsed = JSON.parse(txt);
    if (Array.isArray(parsed.followers) && Array.isArray(parsed.following)) {
      $("method2Modal").style.display = "none";
      applyNewSnapshot(parsed);
      return;
    }
    alert("Panoda geçerli bir tarama çıktısı bulunamadı.");
  } catch {
    alert("Panoya erişilemedi; JSON metnini aşağıdaki kutuya elle yapıştırıp 'Yapıştırılan Veriyi Analiz Et' butonuna basabilirsin.");
  }
});

$("importManualJsonBtn").addEventListener("click", () => {
  try {
    const parsed = JSON.parse($("manualJsonPaste").value.trim());
    if (Array.isArray(parsed.followers) && Array.isArray(parsed.following)) {
      $("method2Modal").style.display = "none";
      $("manualJsonPaste").value = "";
      applyNewSnapshot(parsed);
    } else {
      alert("Geçerli format bulunamadı.");
    }
  } catch {
    alert("Geçersiz JSON metni.");
  }
});

$("closeSemiBtn").addEventListener("click", () => {
  $("semiAutoModal").style.display = "none";
});
$("semiSkipBtn").addEventListener("click", () => {
  if (ui.semiIdx + 1 < ui.semiQueue.length) {
    ui.semiIdx++;
    updateSemiModal();
  } else {
    $("semiAutoModal").style.display = "none";
  }
});
$("semiDoneBtn").addEventListener("click", () => {
  const cur = ui.semiQueue[ui.semiIdx];
  removeUnfollowedLocally([cur.username]);
  if (ui.semiIdx + 1 < ui.semiQueue.length) {
    ui.semiIdx++;
    updateSemiModal();
  } else {
    $("semiAutoModal").style.display = "none";
    notify("Hızlı geçiş listesindeki tüm profiller tamamlandı.");
  }
});

$("copyQueueScriptBtn").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("generatedQueueScript").value).catch(() => {});
  notify("Korumalı kuyruk kodu kopyalandı!");
});
$("markScriptDoneBtn").addEventListener("click", () => {
  removeUnfollowedLocally(ui.pendingScriptUsers.map((u) => u.username));
  $("scriptQueueModal").style.display = "none";
  notify("Seçilen hesaplar takip edilenler listesinden düşürüldü.");
});

function updateExploreMetrics(tabs) {
  const fCnt = store.followers.length;
  const gCnt = store.following.length;
  const nbCnt = tabs.notback.length;
  const day = new Date().getDay();
  const bestSlots = {
    0: ["19:30", "Pazar akşam akışı"],
    1: ["20:00", "Pazartesi prime-time"],
    2: ["20:30", "Salı yüksek kaydetme saati"],
    3: ["21:00", "Çarşamba Reels zirvesi"],
    4: ["20:30", "Perşembe etkileşim saati"],
    5: ["18:30", "Cuma akşamüstü geçişi"],
    6: ["19:00", "Cumartesi keşfet saati"]
  };
  const slot = bestSlots[day] || ["20:30", "Prime-time"];
  if ($("bestHourVal")) $("bestHourVal").textContent = slot[0];
  if ($("bestHourHint")) $("bestHourHint").textContent = slot[1];

  if (fCnt > 0 && gCnt > 0) {
    const curR = (fCnt / gCnt).toFixed(2);
    const afterFollow = Math.max(1, gCnt - nbCnt);
    const targetR = (fCnt / afterFollow).toFixed(2);
    $("curRatioVal").textContent = curR + "x";
    $("targetRatioVal").textContent = targetR + "x";
    $("ratioBadge").textContent = `OTORİTE ORANI: ${curR}x → ${targetR}x`;
  }
}

function calculateExploreScore() {
  const baseFollowers = Math.max(1, store.followers.length || 334);
  const likes = Number($("calcLikes").value || 0);
  const comments = Number($("calcComments").value || 0);
  const saves = Number($("calcSaves").value || 0);
  const weighted = likes + comments * 2 + saves * 3;
  const rawEr = ((likes + comments + saves) / baseFollowers) * 100;
  const saveRatio = ((saves / baseFollowers) * 100).toFixed(1);

  $("erPercentVal").textContent = "%" + rawEr.toFixed(1);
  let grade = "Orta";
  let tip = "";
  if (rawEr >= 12) {
    grade = "🔥 Keşfet Adayı";
    tip = `Harika! %${rawEr.toFixed(1)} etkileşim oranı ve %${saveRatio} kaydetme/paylaşım hızı Keşfet eşiğinin üzerinde. İlk 3 saniyede net kanca (hook) cümlesiyle ${$("bestHourVal").textContent} saatinde Reels paylaşımı önerilir.`;
  } else if (rawEr >= 5) {
    grade = "✓ Sağlam Organik";
    tip = `%${rawEr.toFixed(1)} etkileşim oranı sağlıklı. Keşfet'e sıçramak için açıklama sonunda soru sorup kaydetmeye değer mini liste/ipucu formatı kullan (Ağırlıklı Skor: ${weighted}).`;
  } else {
    grade = "⚡ Yükseltilebilir";
    tip = `Etkileşim oranı %${rawEr.toFixed(1)}. Geri takip etmeyen ve etkileşimsiz hesapları temizleyip ilk 2 saniyede merak uyandıran Reels başlığı kullanmak erişimi hızla artırır.`;
  }
  $("erGradeHint").textContent = grade;
  const box = $("exploreAdviceBox");
  box.style.display = "block";
  box.innerHTML = `<strong style="color:var(--orange2);font-size:12.5px;">${grade} (${baseFollowers} takipçi baz alındı)</strong><p style="font-size:12px;color:#cbd5e1;margin:6px 0 0;line-height:1.55;">${tip}</p>`;
}

if ($("calcExploreBtn")) {
  $("calcExploreBtn").addEventListener("click", calculateExploreScore);
}

$("qPauseBtn").addEventListener("click", () => bridgeFetch("/api/queue/control", { action: "pause" }).catch(() => {}));
$("qResumeBtn").addEventListener("click", () => bridgeFetch("/api/queue/control", { action: "resume" }).catch(() => {}));
$("qClearBtn").addEventListener("click", () => bridgeFetch("/api/queue/control", { action: "clear" }).catch(() => {}));

renderAll();
startBridgePolling();
