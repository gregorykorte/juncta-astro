// functions/api/news.js
// Worker-safe RSS/Atom parsing (no DOMParser). KV is optional (bind as NEWS_CACHE).
const VERSION = "2025-08-26-b";
const CACHE_TTL_SECONDS = 300; // 5 minutes
const MAX_ITEMS = 22;
const USER_AGENT = "JunctaJuvantBot/1.0 (+https://junctajuvant.com)";

// Curate/adjust as you like
const FEEDS = [
  { url: "https://www.wcpo.com/news/local-news/hamilton-county/cincinnati.rss", label: "WCPO" },
  { url: "https://www.wlwt.com/local-news-rss",                                  label: "WLWT" },
  { url: "https://www.wvxu.org/politics.rss",                                    label: "WVXU" },
  { url: "https://www.citybeat.com/cincinnati/Rss.xml?section=11962257",         label: "CityBeat" },
  { url: "https://www.cincinnatimagazine.com/category/news/feed/",               label: "Cincinnati Magazine" },
  { url: "https://thecincinnatiherald.com/feed/",                                label: "Cincinnati Herald" },
  { url: "https://rss.bizjournals.com/cincinnati/latest_news",                   label: "Cincy Business Courier" },
];

export async function onRequest(context) {
  try {
    const kv = context.env?.NEWS_CACHE || null;
    const key = `news:${VERSION}`;

    // KV cache (optional)
    if (kv) {
      const cached = await kv.get(key);
      if (cached) return json(cached, { "x-cache": "hit" });
    }

    // Fetch feeds in parallel
    const results = await Promise.allSettled(
      FEEDS.map(f => fetchFeed(f.url, f.label))
    );

    const items = dedupeAndSort(
      results.flatMap(r => (r.status === "fulfilled" ? r.value : []))
    );

    const hero = pickHero(items);
    const rail = items
      .filter(i => !hero || i.link !== hero.link)
      .slice(0, MAX_ITEMS)
      .map(minifyForRail);

    const payload = {
      hero,
      rail,
      count: items.length,
      version: VERSION,
      ts: new Date().toISOString()
    };

    if (kv) {
      try {
        await kv.put(key, JSON.stringify(payload), { expirationTtl: CACHE_TTL_SECONDS });
      } catch {}
    }

    return json(payload, { "x-cache": "miss" });
  } catch (err) {
    console.error("NEWS_ERROR", err?.stack || err);
    return json({ hero: null, rail: [], error: "temporary_error", version: VERSION }, { "x-cache": "bypass" });
  }
}

/* ---------------- helpers ---------------- */

function json(obj, extra = {}) {
  return new Response(typeof obj === "string" ? obj : JSON.stringify(obj), {
    headers: { "content-type": "application/json; charset=utf-8", ...extra }
  });
}

async function fetchFeed(url, label) {
  const res = await fetchWithTimeout(url, { headers: { "user-agent": USER_AGENT } }, 8000);
  if (!res.ok) throw new Error(`Feed ${res.status} ${url}`);
  const text = await res.text();
  return parseFeed(text, label);
}

function parseFeed(xml, label) {
  // Decide RSS vs Atom by tags present
  if (/<channel[\s>]/i.test(xml) && /<item[\s>]/i.test(xml)) {
    return parseRss(xml, label);
  }
  if (/<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml)) {
    return parseAtom(xml, label);
  }
  return [];
}

function parseRss(xml, label) {
  const items = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml))) {
    const block = m[0];
    const title = getTag(block, "title");
    const link  = getTag(block, "link") || getTag(block, "guid");
    const desc  = getTag(block, "description") || getTag(block, "content:encoded");
    const pub   = getTag(block, "pubDate");
    const by    = getTag(block, "dc:creator");
    const img   = getAttr(block, "enclosure", "url") || getAttr(block, "media:content", "url");

    if (!title || !link) continue;

    items.push({
      title: title.trim(),
      link: link.trim(),
      source: label,
      isoDate: toIso(pub),
      desc: stripHtml(desc || ""),
      image: img || null,
      byline: by || null
    });
  }
  return items;
}

function parseAtom(xml, label) {
  const items = [];
  const entryRe = /<entry[\s\S]*?<\/entry>/gi;
  let m;
  while ((m = entryRe.exec(xml))) {
    const block = m[0];
    const title = getTag(block, "title");
    const link  = getLinkHref(block) || "";
    const desc  = getTag(block, "summary") || getTag(block, "content");
    const upd   = getTag(block, "updated") || getTag(block, "published");
    const by    = getTag(block, "author") ? getTag(block, "name") : null;
    const enc   = getLinkHref(block, "enclosure");

    if (!title || !link) continue;

    items.push({
      title: title.trim(),
      link: link.trim(),
      source: label,
      isoDate: toIso(upd),
      desc: stripHtml(desc || ""),
      image: enc || null,
      byline: by || null
    });
  }
  return items;
}

function getTag(block, tag) {
  const t = tag.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1"); // escape
  const re = new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, "i");
  const m = re.exec(block);
  if (!m) return "";
  return decodeXml(m[1] || "");
}

function getAttr(block, tag, attr) {
  const t = tag.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1");
  const a = attr.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1");
  const re = new RegExp(`<${t}\\b[^>]*\\s${a}="([^"]+)"[^>]*>`, "i");
  const m = re.exec(block);
  return m ? decodeXml(m[1]) : null;
}

function getLinkHref(block, rel) {
  if (rel) {
    const re = new RegExp(`<link\\b[^>]*rel=["']${rel}["'][^>]*href=["']([^"']+)["'][^>]*>`, "i");
    const m = re.exec(block);
    if (m) return decodeXml(m[1]);
  }
  const m2 = /<link\b[^>]*href=["']([^"']+)["'][^>]*>/.exec(block);
  return m2 ? decodeXml(m2[1]) : null;
}

function decodeXml(s) {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gis, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function toIso(s) {
  try { const d = new Date(s); return isNaN(d) ? null : d.toISOString(); } catch { return null; }
}

function dedupeAndSort(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = (it.link || it.title || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  out.sort((a,b) => (Date.parse(b.isoDate || 0) || 0) - (Date.parse(a.isoDate || 0) || 0));
  return out;
}

function pickHero(items) {
  const withImg = items.find(i => i.image && i.image.startsWith("http"));
  const base = withImg || items[0] || null;
  if (!base) return null;
  return {
    title: base.title,
    link: base.link,
    source: base.source,
    desc: base.desc || null,
    image: base.image || null,
    byline: base.byline || null,
    isoDate: base.isoDate || null
  };
}

function minifyForRail(i) {
  return {
    title: i.title,
    link: i.link,
    source: i.source,
    isoDate: i.isoDate
  };
}

async function fetchWithTimeout(url, init = {}, ms = 8000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}
