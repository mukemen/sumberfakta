// tools/rss-build.mjs
import fs from "fs";
const Parser = (await import("rss-parser")).default;

// === Konfigurasi ===
const MIN_ITEMS = 10;          // kalau < ini → gabung dengan news.json lama
const LIMIT_OUTPUT = 200;      // maksimal item disimpan
const TIMEOUT_MS = 15000;      // timeout fetch RSS
const MAX_OG_FETCH = 20;       // maksimal artikel yang dicari og:image

const parser = new Parser({ timeout: TIMEOUT_MS });

function safeJSON(path, fallback) {
  try { return JSON.parse(fs.readFileSync(path, "utf8")); }
  catch { return fallback; }
}
function normCat(x="") {
  const m = { nasional:"nasional", politik:"politik", sport:"sport", olahraga:"sport",
    entertainment:"entertainment", hiburan:"entertainment", hobi:"hobi",
    movie:"movie", film:"movie", music:"music", musik:"music",
    bisnis:"bisnis", ekonomi:"bisnis", tekno:"tekno", teknologi:"tekno", dunia:"dunia" };
  const k = (x||"").toLowerCase(); return m[k] || "dunia";
}
function firstImgFromHTML(html="") {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}
function cleanUrl(u="") {
  try { const url = new URL(u); url.hash = ""; return url.toString(); }
  catch { return u; }
}
function pickImage(e) {
  return (
    e.enclosure?.url ||
    e["media:content"]?.url ||
    e["media:thumbnail"]?.url ||
    e.thumbnail ||
    firstImgFromHTML(e["content:encoded"] || e.content) ||
    null
  );
}

function toItem(feed, e, i) {
  const d = e.isoDate || e.pubDate || new Date().toISOString();
  const title = (e.title || "").toString().trim();
  const link = cleanUrl((e.link || "#").toString().trim());
  const img  = pickImage(e);
  const summary = (e.contentSnippet || e.content || "").toString().replace(/\s+/g, " ").trim();

  return {
    id: `${feed.name}-${i}-${Date.parse(d) || Date.now()}`,
    title, link,
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
    return (res.items || []).map((e,i)=>toItem(feed,e,i));
  } catch (err) {
    console.error("ERR feed", feed.url, err?.message || err);
    return [];
  }
}

function dedupSort(items) {
  const seen = new Set(), out = [];
  for (const it of items) {
    const k = String(it.link || it.title).toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(it); }
  }
  out.sort((a,b)=>+new Date(b.publishedAt)-+new Date(a.publishedAt));
  return out.slice(0, LIMIT_OUTPUT);
}

// Ambil og:image untuk beberapa item yang belum punya gambar
async function enrichOgImages(items) {
  let count = 0;
  const controller = ms => {
    const c = new AbortController(); setTimeout(()=>c.abort(), ms); return c;
  };
  for (const it of items) {
    if (count >= MAX_OG_FETCH) break;
    if (it.image) continue;
    try {
      const res = await fetch(it.link, {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (NewsBot/1.0)" },
        signal: controller(8000).signal
      });
      const html = await res.text();
      const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
      if (m?.[1]) { it.image = m[1]; count++; }
    } catch {}
  }
}

const FEEDS = safeJSON("feeds.json", []);
if (!FEEDS.length) { console.error("feeds.json kosong!"); process.exit(3); }

const results = await Promise.allSettled(FEEDS.map(fetchFeed));
let items = results.flatMap(r => r.status==="fulfilled" ? r.value : []);
const custom = safeJSON("data/custom.json", []);
items = dedupSort([...items, ...custom]);

// perkaya dengan og:image jika belum ada
await enrichOgImages(items);

// fallback bila terlalu sedikit
if (items.length < MIN_ITEMS) {
  console.warn(`Hasil baru hanya ${items.length} (<${MIN_ITEMS}). Tambah dari news.json lama.`);
  const prev = safeJSON("news.json", null);
  if (prev?.items?.length) items = dedupSort([...items, ...prev.items]);
}

// backup & tulis
try { fs.writeFileSync("data/news_prev.json", fs.readFileSync("news.json")); } catch {}
fs.writeFileSync("news.json", JSON.stringify({ generatedAt:new Date().toISOString(), items }, null, 2), "utf8");
console.log("Generated news.json with", items.length, "items from", FEEDS.length, "feeds");
