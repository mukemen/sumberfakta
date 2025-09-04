import fs from "fs";
const Parser = (await import("rss-parser")).default;
const parser = new Parser({ timeout: 15000 });
const FEEDS = [
  { name: "ANTARA – Terkini",  url: "https://www.antaranews.com/rss/terkini",  category: "dunia" },
  { name: "ANTARA – Politik",  url: "https://www.antaranews.com/rss/politik",  category: "politik" },
  { name: "ANTARA – Olahraga", url: "https://www.antaranews.com/rss/olahraga", category: "sport" },
  { name: "BBC – World",       url: "http://feeds.bbci.co.uk/news/world/rss.xml",   category: "dunia" },
  { name: "BBC – Business",    url: "http://feeds.bbci.co.uk/news/business/rss.xml",category: "bisnis" },
  { name: "The Verge – Tech",  url: "https://www.theverge.com/rss/index.xml",      category: "tekno" }
];
function toItem(feed,e,i){
  const d=e.isoDate||e.pubDate||new Date().toISOString();
  const img=e.enclosure?.url||e["media:content"]?.url||null;
  const summary=(e.contentSnippet||e.content||"").toString().trim();
  return { id:`${feed.name}-${i}-${d}`, title:(e.title||"").toString().trim(), link:(e.link||"#").toString(),
    publishedAt:new Date(d).toISOString(), source:feed.name, category:feed.category, image:img||null, summary:summary||null };
}
async function fetchFeed(feed){ try{ const r=await parser.parseURL(feed.url); return (r.items||[]).map((e,i)=>toItem(feed,e,i)); } catch(e){ console.error("ERR feed",feed.url,e?.message||e); return []; } }
function readCustom(){ try{ const raw=fs.readFileSync("data/custom.json","utf8"); const arr=JSON.parse(raw); return Array.isArray(arr)?arr:[]; } catch { return []; } }
function dedupSort(v){ const s=new Set(),o=[]; for(const it of v){ const k=String(it.link||it.title).toLowerCase(); if(!s.has(k)){ s.add(k); o.push(it); } } o.sort((a,b)=>+new Date(b.publishedAt)-+new Date(a.publishedAt)); return o.slice(0,200); }
const chunks=await Promise.allSettled(FEEDS.map(fetchFeed));
const feeds=chunks.flatMap(c=>c.status==="fulfilled"?c.value:[]);
const custom=readCustom();
const items=dedupSort([...feeds,...custom]);
fs.writeFileSync("news.json", JSON.stringify({generatedAt:new Date().toISOString(), items}, null, 2), "utf8");
console.log("Generated news.json with", items.length, "items");
