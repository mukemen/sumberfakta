// tools/rss-build.mjs
// Build news.json dari feeds.json (fallback ke DEFAULT_FEEDS jika tidak ada)
// + gabungkan artikel buatan sendiri dari data/mynews.json
// Node >= 18 (ESM OK)

import fs from "fs";
import Parser from "rss-parser";

const LIMIT_OUTPUT       = 400;
const MIN_ITEMS          = 20;
const MAX_HTML_IMG_SNIFF = 1;
const USER_AGENT         = "SumberFaktaBot/1.0 (+https://mukemen.github.io/sumberfakta/)";

// Dipakai kalau feeds.json tidak ada
const DEFAULT_FEEDS = [
  { name:"ANTARA – Terkini", url:"https://www.antaranews.com/rss/terkini", category:"nasional" },
  { name:"Detik – Berita",   url:"https://news.detik.com/berita/rss",      category:"nasional" },
  { name:"Liputan6 – News",  url:"https://feed.liputan6.com/rss/news",     category:"nasional" }
];

const parser = new Parser({ headers: { "User-Agent": USER_AGENT } });

// Utils JSON
function readJSON(path, fallback=null){ try { return JSON.parse(fs.readFileSync(path,"utf8")); } catch { return fallback; } }
function writeJSON(path, data){ fs.writeFileSync(path, JSON.stringify(data, null, 2), "utf8"); }

// Load daftar feed
function loadFeeds(){
  const cand = ["feeds.json", "data/feeds.json"];
  for (const p of cand){
    const j = readJSON(p, null);
    if (Array.isArray(j)) { console.log(`→ Memakai daftar feed dari: ${p} (${j.length})`); return j; }
    if (j && Array.isArray(j.feeds)) { console.log(`→ Memakai daftar feed dari: ${p} (${j.feeds.length})`); return j.feeds; }
  }
  console.warn("⚠️  feeds.json tidak ditemukan. Memakai DEFAULT_FEEDS.");
  return DEFAULT_FEEDS;
}

// Normalisasi kategori
function normCat(x=""){
  const map = {
    nasional:"nasional", politik:"politik",
    dunia:"dunia", world:"dunia", internasional:"dunia",
    sport:"sport", olahraga:"sport", bola:"sport",
    bisnis:"bisnis", ekonomi:"bisnis", finance:"bisnis", market:"bisnis",
    tekno:"tekno", teknologi:"tekno", technology:"tekno", tech:"tekno",
    hiburan:"hiburan", entertainment:"hiburan", showbiz:"hiburan",
    music:"music", musik:"music",
    movie:"movie", film:"movie",
    hobi:"hobi", lifestyle:"hobi"
  };
  const k = (x||"").toLowerCase().trim();
  return map[k] || (k || "nasional");
}

// Ekstraksi gambar
function firstImgFromHTML(html=""){ if(!MAX_HTML_IMG_SNIFF) return null; const m=/<img[^>]+src=["']([^"']+)["']/i.exec(html); return m?m[1]:null; }
function pickImage(e={}){
  return e.enclosure?.url || e.enclosure?.link ||
         e["media:content"]?.url || e["media:thumbnail"]?.url ||
         e.thumbnail || firstImgFromHTML(e["content:encoded"]||e.content||e.description) || null;
}
function cleanUrl(u=""){ try{ const url=new URL(u); url.hash=""; return url.toString(); } catch { return u; } }

// Bentuk item standar RSS
function toItem(feed, entry, i){
  const d = entry.isoDate || entry.pubDate || entry.pubdate || entry.date || new Date().toISOString();
  const title = (entry.title||"").toString().trim();
  const link  = cleanUrl((entry.link||"").toString().trim());
  const image = pickImage(entry);
  const summary = (entry.contentSnippet || entry.content || entry.description || "")
                    .toString().replace(/\s+/g," ").trim();
  return {
    id:`${feed.name}-${i}-${Date.parse(d)||Date.now()}`,
    title, link,
    publishedAt:new Date(d).toISOString(),
    source:feed.name,
    category:normCat(feed.category),
    image:image||null,
    summary:summary||null
  };
}

// Ambil satu feed
async function fetchFeed(feed){
  try{
    const res = await parser.parseURL(feed.url);
    const items = (res.items||[]).map((e,i)=>toItem(feed,e,i));
    console.log(`✔ ${feed.name} — ${items.length} item`);
    return items;
  }catch(err){
    console.error(`✖ ${feed.name} (${feed.url}) — ${err?.message||err}`);
    return [];
  }
}

// Dedup + sort terbaru
function dedupSort(items){
  const seen=new Set(), out=[];
  for (const it of items){
    const k=(it.link||it.title||"").toLowerCase();
    if(!k) continue;
    if(!seen.has(k)){ seen.add(k); out.push(it); }
  }
  out.sort((a,b)=>+new Date(b.publishedAt||0)-+new Date(a.publishedAt||0));
  return out.slice(0, LIMIT_OUTPUT);
}

// ====== Muat berita custom buatan sendiri ======
function loadMyNews() {
  const paths = ["mynews.json", "data/mynews.json"];
  for (const p of paths) {
    const arr = readJSON(p, null);
    if (Array.isArray(arr)) {
      const normed = arr.map((e, i) => ({
        id: e.id || `MY-${i}-${Date.now()}`,
        title: (e.title || "").toString().trim(),
        link: (e.link || "").toString().trim(),
        publishedAt: new Date(e.publishedAt || Date.now()).toISOString(),
        source: e.source || "FABARO NEWS",
        category: normCat(e.category || "nasional"),
        image: e.image || null,
        summary: e.summary || null,
        contentHtml: e.contentHtml || null
      }));
      console.log(`+ Muat mynews dari ${p}: ${normed.length} item`);
      return normed;
    }
  }
  console.log("+ Tidak ada mynews.json (lewati)");
  return [];
}

// ===================== MAIN =====================
const FEEDS = loadFeeds();
console.log(`Memuat ${FEEDS.length} feed ...`);
console.log("Contoh 5 feed pertama:", FEEDS.slice(0,5).map(f=>`${f.name} -> ${f.url}`));

const results = await Promise.allSettled(FEEDS.map(fetchFeed));
let items = results.flatMap(r => (r.status==="fulfilled" ? r.value : []));

// gabung artikel buatan sendiri
const mine = loadMyNews();
items = [...items, ...mine];

items = dedupSort(items);

// Fallback kalau kependekan
if (items.length < MIN_ITEMS){
  console.warn(`Hasil baru hanya ${items.length} (< ${MIN_ITEMS}). Tambah dari news.json lama.`);
  const prev = readJSON("news.json", null);
  if (prev && Array.isArray(prev.items)) items = dedupSort([...items, ...prev.items]);
}

// Backup & tulis
try{
  const prevRaw = fs.readFileSync("news.json");
  fs.mkdirSync("data", { recursive:true });
  fs.writeFileSync("data/news_prev.json", prevRaw);
}catch{}

const out = { generatedAt:new Date().toISOString(), items };
writeJSON("news.json", out);

console.log(`✔ Generated news.json dengan ${items.length} artikel dari ${FEEDS.length} feed (+ mynews: ${mine.length})`);
