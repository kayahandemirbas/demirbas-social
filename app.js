/* DEMİRBAŞ SOCIAL V2.6 — GraphQL Motoru (usePolarisUnfollowMutation), Hız Ayarları, Filtre Çipleri, Snapshot Geçmişi & Yüzen Panel */

const STORAGE_KEY = "demirbas_social_v2_store";
const $ = (id) => document.getElementById(id);
const norm = (s) => String(s || "").trim().replace(/^@/, "").toLowerCase();

const DEFAULT_TIMINGS = {
  scanDelayMin: 1000,
  scanDelayMax: 1300,
  scanPauseEveryPages: 7,
  scanPauseMs: 10000,
  usersPerRequest: 200,
  unfollowDelayMin: 4000,
  unfollowDelayMax: 4800,
  unfollowPauseEvery: 5,
  unfollowPauseMs: 300000
};

const DEFAULT_AVATAR_RE = /44884218_345707102882519|464760996_1254146839119862/;

function isDefaultAvatarUrl(url) {
  if (!url) return true;
  return DEFAULT_AVATAR_RE.test(String(url));
}

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

function sanitizeTimings(raw) {
  const out = { ...DEFAULT_TIMINGS };
  if (raw && typeof raw === "object") {
    for (const k of Object.keys(out)) {
      const n = Number(raw[k]);
      if (Number.isFinite(n) && n >= 0) out[k] = Math.round(n);
    }
  }
  out.usersPerRequest = Math.min(200, Math.max(12, out.usersPerRequest));
  if (out.scanDelayMax < out.scanDelayMin) out.scanDelayMax = out.scanDelayMin;
  if (out.unfollowDelayMax < out.unfollowDelayMin) out.unfollowDelayMax = out.unfollowDelayMin;
  return out;
}

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
        hidden: p.hidden && typeof p.hidden === "object" ? p.hidden : {},
        filters: p.filters && typeof p.filters === "object"
          ? {
              verified: p.filters.verified !== false,
              private: p.filters.private !== false,
              noAvatar: p.filters.noAvatar !== false,
              showHidden: Boolean(p.filters.showHidden)
            }
          : { verified: true, private: true, noAvatar: true, showHidden: false },
        timings: sanitizeTimings(p.timings),
        bridgeUrl: p.bridgeUrl || DEFAULT_BRIDGE,
        accountUsername: p.accountUsername || "",
        _lastSyncedRemoteSnap: p._lastSyncedRemoteSnap || ""
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
    hidden: {},
    filters: { verified: true, private: true, noAvatar: true, showHidden: false },
    timings: { ...DEFAULT_TIMINGS },
    bridgeUrl: DEFAULT_BRIDGE,
    accountUsername: "",
    _lastSyncedRemoteSnap: ""
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
  pollTimer: null,
  dismissedDoneStamp: ""
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

async function copyTextSafe(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch {}
    ta.remove();
    return ok;
  }
}

function toUserObj(u) {
  if (typeof u === "string") {
    const un = norm(u);
    return un ? { user_id: un, username: un, full_name: "", avatar_url: "", is_verified: false, is_private: false, default_avatar: true } : null;
  }
  if (!u || typeof u !== "object") return null;
  const un = norm(u.username || u.value || u.title || "");
  if (!un) return null;
  const av = String(u.avatar_url || u.profile_pic_url || "");
  return {
    user_id: String(u.user_id || u.pk || u.id || un),
    username: un,
    full_name: String(u.full_name || ""),
    avatar_url: av,
    is_verified: Boolean(u.is_verified),
    is_private: Boolean(u.is_private),
    default_avatar: u.default_avatar !== undefined ? Boolean(u.default_avatar) : isDefaultAvatarUrl(av)
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
      if (!prev.avatar_url && u.avatar_url) {
        prev.avatar_url = u.avatar_url;
        prev.default_avatar = u.default_avatar;
      }
      if (u.is_verified) prev.is_verified = true;
      if (u.is_private) prev.is_private = true;
      if (prev.user_id === prev.username && u.user_id !== u.username) prev.user_id = u.user_id;
    } else {
      map.set(u.username, u);
    }
  }
  return [...map.values()];
}

function applyNewSnapshot({ followers, following, collabs = [], accountUsername = "" }) {
  const cleanFollowers = dedupeUsers(followers);
  const cleanFollowing = dedupeUsers(following);
  const nowIso = new Date().toISOString();

  let newDroppedCount = 0;
  if (store.followers.length > 0 && cleanFollowers.length > 0) {
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

/* Yüzen Panelden Aktarılan Sadece Takip Etmeyenler veya Düz Metin Listesi Desteği */
function importImportedPayloadOrText(rawText) {
  const trimmed = String(rawText || "").trim();
  if (!trimmed) return false;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed.followers) && Array.isArray(parsed.following)) {
      applyNewSnapshot(parsed);
      return true;
    }
    if (Array.isArray(parsed.nonFollowers)) {
      const nf = dedupeUsers(parsed.nonFollowers);
      const followerSet = new Set(store.followers.map((u) => u.username));
      const mergedFollowing = dedupeUsers([
        ...store.following.filter((u) => followerSet.has(u.username)),
        ...nf
      ]);
      applyNewSnapshot({
        accountUsername: store.accountUsername,
        followers: store.followers,
        following: mergedFollowing.length ? mergedFollowing : nf,
        collabs: store.collabs
      });
      return true;
    }
  } catch {}

  // Satır satır kullanıcı adı listesi (@kullanici veya düz metin)
  const lines = trimmed
    .split(/\r?\n/)
    .flatMap((l) => l.trim().split(/[\s,;]+/))
    .map((x) => {
      const m = /instagram\.com\/([^/?#]+)/i.exec(x);
      return norm(m ? m[1] : x);
    })
    .filter((n) => /^[a-z0-9._]{1,30}$/.test(n));

  if (lines.length > 0) {
    const nf = dedupeUsers(lines);
    const followerSet = new Set(store.followers.map((u) => u.username));
    applyNewSnapshot({
      accountUsername: store.accountUsername,
      followers: store.followers,
      following: dedupeUsers([...store.following.filter((u) => followerSet.has(u.username)), ...nf]),
      collabs: store.collabs
    });
    return true;
  }
  return false;
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
          avatar_url: v.profile_pic_url || v.avatar_url || "",
          is_verified: Boolean(v.is_verified),
          is_private: Boolean(v.is_private),
          default_avatar: v.default_avatar
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
      if (importImportedPayloadOrText(vf.text)) return;
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
    .map((u) => enrich(u, ""));

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
  const f = store.filters;
  let list = all[ui.tab] || [];

  list = list.filter((u) => {
    const isHid = Boolean(store.hidden[u.username]);
    if (f.showHidden) {
      if (!isHid) return false;
    } else if (isHid) {
      return false;
    }
    if (!f.verified && u.is_verified) return false;
    if (!f.private && u.is_private) return false;
    const noAv = u.default_avatar !== undefined ? Boolean(u.default_avatar) : isDefaultAvatarUrl(u.avatar_url);
    if (!f.noAvatar && noAv) return false;
    if (q && !(u.username.includes(q) || (u.full_name || "").toLowerCase().includes(q))) {
      return false;
    }
    return true;
  });

  return list;
}

function resolveAvatarSrc(rawUrl) {
  if (!rawUrl) return "";
  if (ui.bridgeConnected) {
    const base = (store.bridgeUrl || DEFAULT_BRIDGE).replace(/\/+$/, "");
    return `${base}/api/avatar?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}

function updateTimingHintUI() {
  const t = store.timings;
  const minS = (t.unfollowDelayMin / 1000).toFixed(1).replace(/\.0$/, "");
  const maxS = (t.unfollowDelayMax / 1000).toFixed(1).replace(/\.0$/, "");
  const molaMin = Math.round(t.unfollowPauseMs / 60000);
  const molaStr = t.unfollowPauseEvery > 0 && t.unfollowPauseMs > 0
    ? ` · Her ${t.unfollowPauseEvery} işlemde ${molaMin || Math.round(t.unfollowPauseMs / 1000) + " sn"}${molaMin ? " dk" : ""} mola`
    : "";
  if ($("mode1TimingHint")) {
    $("mode1TimingHint").textContent = `${minS}–${maxS} sn gecikme${molaStr}`;
  }
}

function renderAll() {
  const tabs = computeTabs();
  const hasData = store.snapshots.length > 0 || store.followers.length > 0 || store.following.length > 0;
  const lastSnap = store.snapshots[0];
  const hiddenTotal = Object.keys(store.hidden).length;

  $("followersCount").textContent = hasData ? store.followers.length.toLocaleString("tr-TR") : "—";
  $("followingCount").textContent = hasData ? store.following.length.toLocaleString("tr-TR") : "—";
  $("notFollowingBack").textContent = hasData ? tabs.notback.length.toLocaleString("tr-TR") : "—";
  $("unfollowersCount").textContent = hasData ? tabs.unfollowers.length.toLocaleString("tr-TR") : "—";

  $("followersHint").textContent = lastSnap ? `Son: ${fmtDate(lastSnap.created_at)}` : "Henüz tarama yok";
  $("followingHint").textContent = store.accountUsername ? `@${store.accountUsername}` : (hasData ? "Kaydedilen snapshot" : "Henüz tarama yok");
  $("unfollowersHint").textContent = `${store.snapshots.length} snapshot kayıtlı`;
  $("snapshotTag").textContent = `V2.6 · ${store.snapshots.length} SNAPSHOT`;

  $("notbackTabCount").textContent = tabs.notback.length;
  $("unfollowersTabCount").textContent = tabs.unfollowers.length;
  $("fansTabCount").textContent = tabs.fans.length;
  $("mutualTabCount").textContent = tabs.mutual.length;
  $("collabsTabCount").textContent = tabs.collabs.length;
  $("whitelistTabCount").textContent = tabs.whitelist.length;

  document.querySelectorAll(".tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === ui.tab)
  );

  // Filter chips state
  document.querySelectorAll("[data-chip]").forEach((ch) => {
    const k = ch.dataset.chip;
    const on = Boolean(store.filters[k]);
    ch.classList.toggle("active", on);
    if (k === "verified") ch.textContent = `${on ? "✓ " : ""}Onaylı`;
    if (k === "private") ch.textContent = `${on ? "✓ " : ""}Gizli`;
    if (k === "noAvatar") ch.textContent = `${on ? "✓ " : ""}Profil resmi yok`;
    if (k === "showHidden") ch.textContent = `${on ? "✓ " : ""}Gizlenenler (${hiddenTotal})`;
  });

  updateTimingHintUI();

  $("protectCollabsBtn").style.display = ui.tab === "collabs" && tabs.collabs.length > 0 ? "inline-block" : "none";
  $("protectSelectedBtn").style.display = ui.selected.size > 0 ? "inline-block" : "none";
  $("clearSelectBtn").style.display = ui.selected.size > 0 ? "inline-block" : "none";
  $("unfollowBar").style.display = ui.selected.size > 0 ? "block" : "none";
  $("selectedCountLabel").textContent = `${ui.selected.size} seçili`;

  const rows = getVisibleRows();
  if ($("notBackFilteredHint") && ui.tab === "notback" && hasData) {
    $("notBackFilteredHint").textContent = `${rows.length} gösteriliyor · Takip ettiklerin`;
  }

  if (!rows.length) {
    $("resultList").innerHTML = `
      <div class="empty">
        <span>◎</span>
        <strong>${hasData ? "Bu filtrede sonuç bulunamadı" : "Henüz analiz yapılmadı"}</strong>
        <p>${hasData ? "Üstteki Onaylı / Gizli / Profil resmi yok çiplerini veya arama kutusunu kontrol edebilirsin." : "Instagram ZIP/JSON arşivini yükle, Yöntem 2 (sessionid) ile canlı tara veya Demo veriyi dene."}</p>
      </div>`;
    return;
  }

  $("resultList").innerHTML = rows.map((u) => {
    const uname = escapeHtml(u.username);
    const isSel = ui.selected.has(u.username);
    const isProt = Boolean(store.whitelist[u.username]);
    const isHid = Boolean(store.hidden[u.username]);
    const initial = escapeHtml((u.username[0] || "?").toUpperCase());
    const avSrc = resolveAvatarSrc(u.avatar_url);
    return `
      <div class="user-row ${isSel ? "selected" : ""} ${isProt ? "protected" : ""}" data-uname="${uname}">
        <div class="chk">${isSel ? "✓" : ""}</div>
        <div class="avatar">${avSrc ? `<img src="${escapeHtml(avSrc)}" referrerpolicy="no-referrer" loading="lazy" alt="" onerror="this.parentElement.textContent='${initial}'">` : initial}</div>
        <div class="user-meta">
          <div class="user-line">
            <span class="user-name">@${uname}</span>
            ${u.is_verified ? `<span class="badge-verified">ONAYLI</span>` : ""}
            ${u.is_private ? `<span class="badge-private">GİZLİ</span>` : ""}
            ${u.collabCount ? `<span class="badge-collab">🤝 ${u.collabCount} ortak</span>` : ""}
          </div>
          ${u.full_name ? `<div class="user-full">${escapeHtml(u.full_name)}</div>` : ""}
          ${u.subtitle ? `<div class="user-sub">${escapeHtml(u.subtitle)}</div>` : ""}
        </div>
        <div class="row-actions">
          <button class="shield-btn ${isProt ? "on" : ""}" data-shield="${uname}" type="button">
            ${isProt ? "🛡 Korumalı" : "+ Koru"}
          </button>
          <a class="ext-link" href="https://www.instagram.com/${encodeURIComponent(u.username)}/" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Profili aç">↗</a>
          <button class="hide-btn" data-hide="${uname}" type="button">${isHid ? "Göster" : "Gizle"}</button>
        </div>
      </div>`;
  }).join("");
}

/* Liste Tıklama, Gizle ve Kalkan Yönetimi */
$("resultList").addEventListener("click", (e) => {
  const hideBtn = e.target.closest("[data-hide]");
  if (hideBtn) {
    e.stopPropagation();
    const uname = hideBtn.dataset.hide;
    if (store.hidden[uname]) {
      delete store.hidden[uname];
    } else {
      store.hidden[uname] = true;
      ui.selected.delete(uname);
    }
    saveStore();
    renderAll();
    return;
  }

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

/* Filtre Çipleri Tıklama */
$("filterChips").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-chip]");
  if (!chip) return;
  const k = chip.dataset.chip;
  store.filters[k] = !store.filters[k];
  saveStore();
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

/* Demo Verisi */
function runDemo() {
  store.followers = [
    { user_id: "101", username: "ayse.foto", full_name: "Ayşe Yılmaz", avatar_url: "", is_verified: false, is_private: false, default_avatar: false },
    { user_id: "102", username: "mehmet_34", full_name: "Mehmet Demir", avatar_url: "", is_verified: false, is_private: true, default_avatar: false },
    { user_id: "103", username: "selin.art", full_name: "Selin Kaya", avatar_url: "", is_verified: false, is_private: false, default_avatar: false },
    { user_id: "104", username: "burak.music", full_name: "Burak Şahin", avatar_url: "", is_verified: true, is_private: false, default_avatar: false },
    { user_id: "105", username: "deniz.design", full_name: "Deniz Arslan", avatar_url: "", is_verified: false, is_private: false, default_avatar: false },
    { user_id: "106", username: "studio_example", full_name: "Studio Creative", avatar_url: "", is_verified: true, is_private: false, default_avatar: false }
  ];
  store.following = [
    { user_id: "101", username: "ayse.foto", full_name: "Ayşe Yılmaz", avatar_url: "", is_verified: false, is_private: false, default_avatar: false },
    { user_id: "102", username: "mehmet_34", full_name: "Mehmet Demir", avatar_url: "", is_verified: false, is_private: true, default_avatar: false },
    { user_id: "201", username: "kaya_video", full_name: "Kaya Prodüksiyon", avatar_url: "", is_verified: true, is_private: false, default_avatar: false },
    { user_id: "202", username: "mert.fx", full_name: "Mert Efekt", avatar_url: "", is_verified: false, is_private: true, default_avatar: false },
    { user_id: "203", username: "anonim_profil", full_name: "Anonim Hesap", avatar_url: "", is_verified: false, is_private: false, default_avatar: true },
    { user_id: "106", username: "studio_example", full_name: "Studio Creative", avatar_url: "", is_verified: true, is_private: false, default_avatar: false }
  ];
  store.snapshots = [{ id: Date.now() - 86400000, created_at: new Date(Date.now() - 86400000).toISOString(), followers_count: 6, following_count: 6 }];
  store.whitelist["studio_example"] = { user_id: "106", username: "studio_example", full_name: "Studio Creative", avatar_url: "", added_at: new Date().toISOString() };

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

/* YÖNTEM 2: Yerel Köprü Sunucusu */
async function bridgeFetch(path, body) {
  const base = ($("bridgeUrlInput")?.value || store.bridgeUrl || "http://127.0.0.1:8090").trim().replace(/\/+$/, "");
  store.bridgeUrl = base;
  saveStore();
  const opts = body !== undefined
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : { method: "GET" };
  const res = await fetch(base + path, opts);
  if (!res.ok) throw new Error("Köprü yanıt vermedi (HTTP " + res.status + ")");
  return res.json();
}

function renderRunnerCard(rn) {
  if (!rn) {
    $("queueCard").style.display = "none";
    return;
  }
  const total = Math.max(0, Number(rn.batch_total || 0));
  const okCnt = Math.max(0, Number(rn.batch_ok || 0));
  const failCnt = Math.max(0, Number(rn.batch_fail || 0));
  const doneCnt = okCnt + failCnt;
  const doneStamp = `${total}:${okCnt}:${failCnt}:${rn.last_username || ""}`;

  const activeOrRecentDone = rn.is_running || rn.is_paused_warning || rn.pending_count > 0 || (total > 0 && doneCnt > 0 && ui.dismissedDoneStamp !== doneStamp);
  if (!activeOrRecentDone) {
    $("queueCard").style.display = "none";
    return;
  }

  $("queueCard").style.display = "block";
  const pct = total > 0 ? Math.min(100, Math.round((doneCnt / total) * 100)) : (rn.is_running ? 35 : 100);
  $("queueProgressBar").style.width = `${pct}%`;

  const isCompleted = !rn.is_running && rn.pending_count === 0 && doneCnt > 0 && !rn.is_paused_warning;
  $("queueTitle").textContent = isCompleted
    ? "Tamamlandı"
    : (rn.is_paused_warning ? "Duraklatıldı" : `Takibi bırakılıyor (${doneCnt}/${total || rn.pending_count})`);

  $("queueMetricsText").textContent = `${okCnt} başarılı, ${failCnt} başarısız`;
  $("queueSubText").textContent = isCompleted
    ? `${rn.elapsed_sec || 1} sn sürdü`
    : (rn.status_message || "");

  const who = rn.last_username || rn.current_username;
  if (who) {
    $("queueCurrentPill").style.display = "inline-flex";
    $("queueCurrentUser").textContent = "@" + who;
    const badge = $("queueCurrentBadge");
    badge.textContent = rn.last_ok === false ? "✕" : "✓";
    badge.className = "ok-badge" + (rn.last_ok === false ? " err" : "");
  } else {
    $("queueCurrentPill").style.display = "none";
  }

  $("qPauseBtn").style.display = rn.is_running ? "inline-block" : "none";
  $("qResumeBtn").style.display = !rn.is_running && rn.pending_count > 0 ? "inline-block" : "none";
  $("qClearBtn").dataset.stamp = doneStamp;
}

function startBridgePolling() {
  if (ui.pollTimer) return;
  const tick = async () => {
    try {
      const st = await bridgeFetch("/api/state");
      const wasConnected = ui.bridgeConnected;
      ui.bridgeConnected = true;
      $("sessionPillText").textContent = st.session?.logged_in
        ? `Köprü Aktif · @${st.session.username || "Canlı"}`
        : "Köprü Bağlı";

      if (st.timings && !wasConnected) {
        store.timings = sanitizeTimings(st.timings);
        saveStore();
        updateTimingHintUI();
      }

      if (st.scan?.active) {
        notify("⏳ " + st.scan.message);
      } else if (st.latest_snapshot) {
        const remoteCountSig = `${st.latest_snapshot.id}:${st.latest_snapshot.following_count}:${st.latest_snapshot.followers_count}`;
        if (store._lastSyncedRemoteSnap !== remoteCountSig) {
          store._lastSyncedRemoteSnap = remoteCountSig;
          const followers = st.all_followers || [];
          const notBack = st.dont_follow_back || [];
          const mutuals = st.mutuals || [];
          applyNewSnapshot({
            accountUsername: st.latest_snapshot.username || st.session?.username || "",
            followers,
            following: [...mutuals, ...notBack],
            collabs: st.collabs || []
          });
        } else if (!wasConnected) {
          renderAll();
        }
      }

      renderRunnerCard(st.runner);
    } catch {
      ui.bridgeConnected = false;
    }
  };
  tick();
  ui.pollTimer = setInterval(tick, 2000);
}

/* DEMİRBAŞ v2.6 Yüzen Panel Kodunu Kopyala */
async function copyFloatingPanelCode() {
  try {
    const res = await fetch("./demirbas-panel.js", { cache: "no-cache" });
    if (!res.ok) throw new Error("Panel dosyası okunamadı");
    const code = await res.text();
    const ok = await copyTextSafe(code);
    if (ok) {
      notify("⚡ DEMİRBAŞ SOCIAL v2.6 Yüzen Panel kodu kopyalandı! instagram.com Console'a (ilk seferde 'allow pasting' yazıp) yapıştırın.");
    } else {
      notify("Pano izni verilemedi; tekrar deneyin.", true);
    }
  } catch (err) {
    notify("Yüzen panel kodu yüklenemedi: " + err.message, true);
  }
}

/* Köprüsüz GraphQL Unfollow Kuyruğu (usePolarisUnfollowMutation + Hız Ayarları) */
function buildProtectedUnfollowScript(users) {
  const slim = users.map((u) => ({ id: String(u.user_id), username: u.username }));
  const t = store.timings;
  return `(async () => {
  if (location.hostname !== "www.instagram.com") return alert("Önce https://www.instagram.com sekmesini açıp Console'da çalıştırın.");
  const targets = ${JSON.stringify(slim)};
  const timings = ${JSON.stringify(t)};
  const csrf = (document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)||[])[1] || "";
  const dsUid = (document.cookie.match(/(?:^|; )ds_user_id=([^;]+)/)||[])[1] || "";
  if (!csrf || !dsUid) return alert("Aktif Instagram oturumu (csrftoken) bulunamadı!");
  const html = document.documentElement.innerHTML;
  const fbDtsg = (/"DTSGInitialData",\\[\\],\\{"token":"([^"]+)"/.exec(html)||[])[1] || (/"dtsg":\\{"token":"([^"]+)"/.exec(html)||[])[1] || "";
  const lsd = (/"LSD",\\[\\],\\{"token":"([^"]+)"/.exec(html)||[])[1] || "";
  if (!fbDtsg || !lsd) return alert("Sayfa tokenları (fb_dtsg/lsd) bulunamadı, sayfayı yenileyip tekrar deneyin.");
  const jazoest = "2" + [...fbDtsg].reduce((s, c) => s + c.charCodeAt(0), 0);
  let ok = 0, fail = 0;
  for (let i = 0; i < targets.length; i++) {
    const u = targets[i];
    let uid = u.id;
    if (!/^\\d+$/.test(uid)) {
      const r = await fetch("/api/v1/friendships/" + dsUid + "/following/?count=12&query=" + encodeURIComponent(u.username) + "&search_surface=follow_list_page", {
        credentials: "include",
        headers: { "x-ig-app-id": "936619743392459", "x-asbd-id": "129477", "x-requested-with": "XMLHttpRequest" }
      }).then(x => x.json()).catch(() => ({}));
      const m = (r.users || []).find(x => String(x.username).toLowerCase() === u.username.toLowerCase());
      if (m) uid = String(m.pk || m.id);
    }
    const body = new URLSearchParams({
      av: dsUid, __d: "www", __user: "0", __a: "1", __comet_req: "7",
      fb_dtsg: fbDtsg, jazoest, lsd,
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "usePolarisUnfollowMutation",
      variables: JSON.stringify({ target_user_id: String(uid), container_module: "profile", nav_chain: "PolarisProfilePostsTabRoot:profilePage:1:via_cold_start" }),
      server_timestamps: "true",
      doc_id: "27789106940691111"
    }).toString();
    const res = await fetch("/api/graphql", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-csrftoken": decodeURIComponent(csrf),
        "x-fb-friendly-name": "usePolarisUnfollowMutation",
        "x-fb-lsd": lsd,
        "x-ig-app-id": "936619743392459",
        "x-asbd-id": "129477"
      },
      body
    });
    const txt = (await res.text()).replace(/^for \\(;;\\);/, "");
    if (res.status === 429 || /feedback_required|checkpoint_required|action_blocked/i.test(txt)) {
      alert("Instagram hız sınırı algılandı, güvenlik için durduruldu!");
      break;
    }
    if (res.ok) { ok++; console.log("✓ Çıkarıldı (" + ok + "/" + targets.length + "): @" + u.username); }
    else { fail++; }
    if (i < targets.length - 1) {
      const waitMs = timings.unfollowDelayMin + Math.floor(Math.random() * Math.max(1, timings.unfollowDelayMax - timings.unfollowDelayMin));
      await new Promise(r => setTimeout(r, waitMs));
      if (timings.unfollowPauseEvery > 0 && (i + 1) % timings.unfollowPauseEvery === 0 && timings.unfollowPauseMs > 0) {
        console.log("⏳ Mola: " + Math.round(timings.unfollowPauseMs / 1000) + " sn...");
        await new Promise(r => setTimeout(r, timings.unfollowPauseMs));
      }
    }
  }
  alert("DEMİRBAŞ GraphQL Tamamlandı: " + ok + " başarılı, " + fail + " başarısız.");
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
      ui.dismissedDoneStamp = "";
      renderAll();
      if (res.state?.runner) renderRunnerCard(res.state.runner);
      startBridgePolling();
      notify(`${targets.length} hesap GraphQL otomatik kuyruğuna alındı.`);
      return;
    }
  } catch {}

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

/* Hız Ayarları Modal Yönetimi */
function fillSettingsInputs(t) {
  for (const k of Object.keys(DEFAULT_TIMINGS)) {
    const el = $("st_" + k);
    if (el) el.value = t[k];
  }
}

function openSettingsModal() {
  fillSettingsInputs(store.timings);
  $("settingsModal").style.display = "flex";
}

async function saveSettingsFromModal() {
  const raw = {};
  for (const k of Object.keys(DEFAULT_TIMINGS)) {
    const el = $("st_" + k);
    if (el) raw[k] = Number(el.value);
  }
  store.timings = sanitizeTimings(raw);
  saveStore();
  updateTimingHintUI();
  $("settingsModal").style.display = "none";

  try {
    await bridgeFetch("/api/settings", { timings: store.timings });
  } catch {}
  notify("⚙ Hız ayarları kaydedildi.");
}

/* Event Bağlantıları */
$("fileInput").addEventListener("change", (e) => {
  if (e.target.files?.length) importUploadedFiles(e.target.files);
  e.target.value = "";
});

$("demoBtn").addEventListener("click", runDemo);

$("openSettingsBtn").addEventListener("click", openSettingsModal);
$("panelSettingsBtn").addEventListener("click", openSettingsModal);
$("closeSettingsTopBtn").addEventListener("click", () => { $("settingsModal").style.display = "none"; });
$("cancelSettingsBtn").addEventListener("click", () => { $("settingsModal").style.display = "none"; });
$("resetSettingsBtn").addEventListener("click", () => { fillSettingsInputs(DEFAULT_TIMINGS); });
$("saveSettingsBtn").addEventListener("click", saveSettingsFromModal);

$("openFloatingPanelModalBtn").addEventListener("click", () => {
  $("floatingPanelModal").style.display = "flex";
});
$("closeFloatingPanelModalBtn").addEventListener("click", () => {
  $("floatingPanelModal").style.display = "none";
});
$("copyFullFloatingPanelBtn").addEventListener("click", copyFloatingPanelCode);

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

$("copyVisibleBtn").addEventListener("click", async () => {
  const rows = getVisibleRows();
  if (!rows.length) return;
  const text = rows.map((r) => r.username).join("\n");
  await copyTextSafe(text);
  notify(`${rows.length} kullanıcı adı panoya kopyalandı.`);
});

$("copySelectedBtn").addEventListener("click", async () => {
  const sel = [...ui.selected];
  if (!sel.length) return;
  await copyTextSafe(sel.join("\n"));
  notify(`${sel.length} seçili kullanıcı adı panoya kopyalandı.`);
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
  const csv = "username,full_name,verified,private,info\r\n" + rows.map((r) =>
    `"${r.username.replace(/"/g, '""')}","${(r.full_name || "").replace(/"/g, '""')}","${r.is_verified ? 1 : 0}","${r.is_private ? 1 : 0}","${(r.subtitle || "").replace(/"/g, '""')}"`
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
  try {
    if (cookie_or_sessionid) {
      await bridgeFetch("/api/session", { cookie_or_sessionid, csrftoken });
    }
    await bridgeFetch("/api/scan", {});
    $("method2Modal").style.display = "none";
    startBridgePolling();
    notify("🚀 Canlı tarama başlatıldı (Sayfa başına 200 hesap · Hız ayarlarıyla)…");
  } catch (err) {
    alert("Yerel köprü sunucusuna ulaşılamadı. Masaüstündeki anti/demirbas-social/Baslat.command dosyasını çalıştırın veya Yüzen Panel (v2.6) seçeneğini kullanın.\n\nDetay: " + err.message);
  }
});

$("copyScannerScriptBtn").addEventListener("click", copyFloatingPanelCode);

$("pasteLiveJsonBtn").addEventListener("click", async () => {
  try {
    const txt = await navigator.clipboard.readText();
    if (importImportedPayloadOrText(txt)) {
      $("method2Modal").style.display = "none";
      return;
    }
    alert("Panoda geçerli bir tarama çıktısı veya kullanıcı listesi bulunamadı.");
  } catch {
    alert("Panoya erişilemedi; veriyi aşağıdaki kutuya yapıştırıp 'Yapıştırılan Veriyi Analiz Et' butonuna basabilirsin.");
  }
});

$("importManualJsonBtn").addEventListener("click", () => {
  if (importImportedPayloadOrText($("manualJsonPaste").value)) {
    $("method2Modal").style.display = "none";
    $("manualJsonPaste").value = "";
  } else {
    alert("Geçerli JSON veya kullanıcı adı listesi bulunamadı.");
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
  await copyTextSafe($("generatedQueueScript").value);
  notify("GraphQL kuyruk kodu panoya kopyalandı!");
});
$("markScriptDoneBtn").addEventListener("click", () => {
  removeUnfollowedLocally(ui.pendingScriptUsers.map((u) => u.username));
  $("scriptQueueModal").style.display = "none";
  notify("Seçilen hesaplar takip edilenler listesinden düşürüldü.");
});

$("qPauseBtn").addEventListener("click", () => bridgeFetch("/api/queue/control", { action: "pause" }).catch(() => {}));
$("qResumeBtn").addEventListener("click", () => bridgeFetch("/api/queue/control", { action: "resume" }).catch(() => {}));
$("qClearBtn").addEventListener("click", () => {
  ui.dismissedDoneStamp = $("qClearBtn").dataset.stamp || "dismissed";
  $("queueCard").style.display = "none";
  bridgeFetch("/api/queue/control", { action: "clear" }).catch(() => {});
});

renderAll();
startBridgePolling();
