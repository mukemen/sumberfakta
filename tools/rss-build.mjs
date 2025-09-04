// tools/rss-build.mjs
// Build news.json from feeds.json
// Node >=18 (top-level await OK)

import fs from "fs";
import Parser from "rss-parser";

// ====== Konfigurasi umum ======
const LIMIT_OUTPUT = 200;     // simpan maksimal item
const MIN_ITEMS    = 10;      // kalau kurang dari ini → tambahkan dari news.json lama
const MAX_HTML_IMG_SNIFF = 1; // cari <img> pertama di konten (0 = matikan)
const USER_AGENT = "SumberFaktaBot/1.0 (+https://mukemen.github.io/sumberfakta/)";

// rss-parser instance (tambahkan UA supaya beberapa situs tidak blok)
const parser = new Parser({
  headers: { "User-Agent": USER_AGENT }
});

// ====== Util JSON aman ======
function readJSON(path, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}
function writeJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

// ====== Memuat daftar feed dari feeds.json (log sumbernya) ======
function loadFeeds() {
  const candidates = ["feeds.json", "data/feeds.json"];
  for (const p of candidates) {
    const j = readJSON(p, null);
    if (Array.isArray(j)) {
      console.log(`→ Memakai daftar feed dari: ${p} (${j.length} entri)`);
      return j;
    }
    if (j && Array.isArray(j.feeds)) {
      console.log(`→ Memakai daftar feed dari: ${p} (${j.feeds.length} entri)`);
      return j.feeds;
    }
  }
  return [];
}

// ====== Normalisasi kategori (pakai label Indonesia yang konsisten) ======
function normCat(x = "") {
  const map = {
    nasional: "nasional",
    politik: "politik",

    dunia: "dunia",
    world: "dunia",
    internasional: "dunia",
    international: "dunia",
    global: "dunia",

    sport: "sport",
    olahraga: "sport",
    sports: "sport",

    bisnis: "bisnis",
    ekonomi: "bisnis",
    business: "bisnis",
    finance: "bisnis",

    tekno: "tekno",
    teknologi: "tekno",
    technology: "tekno",
    tech: "tekno",

    hiburan: "hiburan",
    entertainment: "hiburan",
    showbiz: "hiburan",

    musik: "musik",
    music: "musik",

    film: "film",
    movie: "film",

    hobi: "hobi"
  };
  const k = (x || "").toString().toLowerCase().trim();
  return map[k] || (k || "nasional");
}

// ====== Ekstraksi gambar ======
function firstImgFromHTML(html = "") {
  if (!MAX_HTML_IMG_SNIFF) return null;
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html || "");
  return m ? m[1] : null;
}
function pickImage(e) {
  return (
    e?.enclosure?.url ||
    e?.enclosure?.link ||
    e?.["media:content"]?.url ||
    e?.["media:thumbnail"]?.url ||
    e?.thumbnail ||
    firstImgFromHTML(e?.["content:encoded"] || e?.content || e?.description) ||
    null
  );
}
function cleanUrl(u = "") {
  try {
    const url = new URL(u);
    url.hash = "";
    return url.toString();
  } catch {
    return u;
  }
}

// ====== Format item standar ======
function toItem(feed, entry, i) {
  const d =
    entry.isoDate ||
    entry.pubDate ||
    entry.pubdate ||
    entry.date ||
    new Date().toISOString();

  const title = (entry.title || "").toString().trim();
  const link = cleanUrl((entry.link || "").toString().trim());
  const image = pickImage(entry);
  const summary = (entry.contentSnippet || entry.content || entry.description || "")
    .toString()
    .replace(/\s+/g, " ")
    .trim();

  return {
    id: `${feed.name}-${i}-${Date.parse(d) || Date.now()}`,
    title,
    link,
    publishedAt: new Date(d).toISOString(),
    source: feed.name,
    category: normCat(feed.category),
    image: image || null,
    summary: summary || null
  };
}

// ====== (Opsional) Handler sederhana untuk sitemap (mis. Tirto) ======
async function parseSitemap(url, limit = 40) {
  const res = await fetch(url);
  const xml = await res.text();
  const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi))
    .map((m) => m[1])
    .slice(0, limit);
  return { title: "sitemap", items: locs.map((link) => ({ title: link, link })) };
}

// ====== Ambil satu feed ======
async function fetchFeed(feed) {
  try {
    const res = feed.type === "sitemap"
      ? await parseSitemap(feed.url)
      : await parser.parseURL(feed.url);
    const items = (res.items || []).map((e, i) => toItem(feed, e, i));
    console.log(`✔ ${feed.name} — ${items.length} item`);
    return items;
  } catch (err) {
    console.error(`✖ ${feed.name} (${feed.url}) — ${err?.message || err}`);
    return [];
  }
}

// ====== De-dupe by link/title + sort terbaru ======
function dedupSort(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = (it.link || it.title || "").toLowerCase();
    if (!k) continue;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  out.sort(
    (a, b) => +new Date(b.publishedAt || 0) - +new Date(a.publishedAt || 0)
  );
  return out.slice(0, LIMIT_OUTPUT);
}

// ====== Main ======
const FEEDS = loadFeeds();
if (!FEEDS.length) {
  console.error(
    "feeds.json kosong / tidak ditemukan. Taruh di root repo atau data/feeds.json"
  );
  process.exit(3);
}
console.log(`Memuat ${FEEDS.length} feed dari feeds.json ...`);
console.log("Contoh (5 feed pertama):", FEEDS.slice(0,5).map(f => `${f.name} -> ${f.url}`));

const results = await Promise.allSettled(FEEDS.map(fetchFeed));
let items = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
items = dedupSort(items);

// Fallback: kalau terlalu sedikit, gabungkan dengan news.json lama
if (items.length < MIN_ITEMS) {
  console.warn(
    `Hasil baru hanya ${items.length} (< ${MIN_ITEMS}). Tambah dari news.json lama.`
  );
  const prev = readJSON("news.json", null);
  if (prev && Array.isArray(prev.items)) {
    items = dedupSort([...items, ...prev.items]);
  }
}

// Simpan backup & tulis news.json
try {
  const prevRaw = fs.readFileSync("news.json");
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/news_prev.json", prevRaw);
} catch {
  // abaikan jika belum ada
}

const out = { generatedAt: new Date().toISOString(), items };
writeJSON("news.json", out);

console.log(
  `✔ Generated news.json dengan ${items.length} artikel dari ${FEEDS.length} feed`
);
