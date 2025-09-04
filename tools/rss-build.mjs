// tools/rss-build.mjs
import fs from "fs";
const Parser = (await import("rss-parser")).default;

// ====== Konfigurasi ======
const MIN_ITEMS = 10;                 // kalau hasil < ini → fallback ke news.json lama
const LIMIT_OUTPUT = 200;             // batasi maksimal item
const TIMEOUT_MS = 15000;             // timeout per feed

// ====== Helper ======
const parser = new Parser({ timeout: TIMEOUT_MS });

function safeReadJSON(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}
function normCat(x = "") {
  const m = {
    nasional: "nasional", politik: "politik", sport: "sport", olahraga: "sport",
    entertainment: "entertainment", hiburan: "entertainment",
    hobi: "hobi", movie: "movie", film: "movie", music: "music", musik: "music",
    bisnis: "bisnis", ekonomi: "bisnis", tekno: "tekno", teknologi: "tekno", dunia: "dunia"
  };
  const k = (x || "").toString().toLowerCase();
  return m[k] || "dunia";
}
function toItem(feed, e, i) {
  const d = e.isoDate || e.pubDate || new Date().toISOString();
  const img = e.enclosure?.url || e["media:content"]?.url || null;
  const title = (e.title || "").toString().trim();
  const link = (e.link || "#").toString().trim();
  const summary = (e.contentSnippet || e.content || "").toString().replace(/\s+/g, " ").trim();

  return {
    id: `${feed.name}-${i}-${Date.parse(d) || Date.now()}`,
    title,
    link,
    publishedAt: new Date(d).toISOString(),
    source: feed.name,
    category: normCat(feed.category),
    image: img || null,
    summary: summary || null
  };
}

async function fetchFeed(feed) {
  try {
    const res = await parser.parseURL(feed.url);
    return (res.items || []).map((e, i) => toItem(feed, e, i));
  } catch (err) {
    console.error("ERR feed", feed.url, err?.message || err);
    return [];
  }
}

function dedupSort(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = String(it.link || it.title).toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(it); }
  }
  out.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  return out.slice(0, LIMIT_OUTPUT);
}

// ====== Mulai ======
const FEEDS = safeReadJSON("feeds.json", []);
if (!FEEDS.length) {
  console.error("feeds.json kosong! Tambahkan daftar feed.");
  process.exit(3);
}

// Ambil feed paralel
const results = await Promise.allSettled(FEEDS.map(fetchFeed));
const fetched = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
const custom = safeReadJSON("data/custom.json", []);
let items = dedupSort([...fetched, ...custom]);

// Fallback jika terlalu sedikit
if (items.length < MIN_ITEMS) {
  console.warn(`Hasil baru hanya ${items.length} item (< ${MIN_ITEMS}). Fallback ke news.json lama.`);
  const prev = safeReadJSON("news.json", null);
  if (prev && Array.isArray(prev.items) && prev.items.length) {
    items = dedupSort([...items, ...prev.items]);
  }
}

// Tulis backup & file utama
try { fs.writeFileSync("data/news_prev.json", fs.readFileSync("news.json")); } catch {}
fs.writeFileSync("news.json", JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2), "utf8");

console.log("Generated news.json with", items.length, "items from", FEEDS.length, "feeds");
