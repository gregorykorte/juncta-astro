// functions/api/news.js
// Build-time independent, runs on Cloudflare Pages Functions.
// Optional KV cache binding: NEWS_CACHE (configure in Pages → Settings → Env vars & bindings)

const VERSION = "2025-08-26-a";           // bump to invalidate cache safely
const CACHE_TTL_SECONDS = 300;            // 5 minutes
const MAX_ITEMS = 22;                     // total items to return (rail)
const USER_AGENT = "JunctaJuvantBot/1.0 (+https://junctajuvant.com)";

// Curated Cincinnati-ish feeds (adjust freely)
const FEEDS = [
  { url: "https://www.wcpo.com/news/local-news/hamilton-county/cincinnati.rss", label: "WCPO" },
  { url: "https://www.wlwt.com/local-news-rss",                                  label: "WLWT" },
  { url: "https://www.wvxu.org/politics.rss",                                    label: "WVXU" },
  { url: "https://www.citybeat.com/cincinnati/Rss.xml?section=11962257",         label: "CityBeat" },
  { url: "https://www.cincinnatimagazine.com/category/news/feed/",               label: "Cincinnati Magazine" },
  { url: "https://thecincinnatiherald.com/feed/",                                label: "Cincinnati Herald" },
  // Biz Courier RSS link can change; if this one 403s, just remove it:
  { url: "https://rss.bizjournals.com/cincinnati/latest_news",                   label: "Cincy Business Courier" },
];

export async function onRequest(context) {
  try {
    const { env } = context;
    const kv = env?.NEWS_CACHE ?? null;
    const cacheKey = `news:${VERSION}`;

    // 1) Try KV first (optional)
    if (kv) {
      const cached = await kv.get(cacheKey);
      if (cached) {
        return json(cached, { "x-cache": "hit" });
      }
    }

    // 2) Fetch all feeds with a short timeout & parse
    const results = await Promise.allSettled(
      FEEDS.map(({ url, label }) => fetchAndParseFeed(url, label))
    );

    // 3) Merge, dedupe, sort
    const items = dedupeAndSort(
      results
        .flatMap(r => (r.status === "fulfilled" ? r.value : []))
        .filter(Boolean)
    );

    // 4) Build payload: hero + rail (hero first)
    const hero = chooseHero(items);
    const rail = items
      .filter(it => it.link !== hero?.link) // keep hero out of the rail list
      .slice(0, MAX_ITEMS)
      .map(minifyForRail);

    const payload = { hero, rail, count: items.length, version: VERSION, ts: new Date().toISOString() };

    // 5) Cache (optional)
    if (kv) {
      try {
        await kv.put(cacheKey, JSON.stringify(payload), { expirationTtl: CACHE_TTL_SECONDS });
      } catch { /* ignore cache write errors */ }
    }

    return json(payload, { "x-cache": "miss" });
  } catch (err) {
    console.error("NEWS_ERROR", err?.stack || err);
    // Always return JSON so the client UI can render gracefully
    return json({ hero: null, rail: [], error: "temporary_error", version: VERSION }, { "x-cache": "bypass" });
  }
}

/* ----------------------- helpers ----------------------- */

function json(obj, extraHeaders = {}) {
  return new Response(typeof obj === "string" ? obj : JSON.stringify(obj), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

async function fetchAndParseFeed(url, label) {
  const res = await fetchWithTimeout(url, { headers: { "user-agent": USER_AGENT } }, 8000);
  if (!res.ok) throw new Error(`Feed fetch failed: ${url} (${res.status})`);
  const contentType = (res.headers.get("content-type") || "").toLowerCase();

  const text = await res.text();
  const xml = new DOMParser().parseFromString(text, "text/xml");
  // Try RSS 2.0
  const rssItems = Array.from(xml.querySelectorAll("channel > item"));
  if (rssItems.length) return rssItems.map(el => rssItemToObj(el, label));

  // Try Atom
  const atomEntries = Array.from(xml.querySelectorAll("feed > entry"));
  if (atomEntries.length) return atomEntries.map(el => atomEntryToObj(el, label));

  // Fallback: try naive JSON (rare)
  if (contentType.includes("application/json")) {
    const data = JSON.parse(text);
    const entries = data?.items || data?.entries || [];
    return entries.map(obj => ({
      title: str(obj.title),
      link: str(obj.url || obj.link),
      source: label,
      isoDate: toIso(obj.date_published || obj.published || obj.date || obj.updated),
      desc: stripHtml(obj.summary || obj.content_text || obj.content_html || ""),
      image: obj.image || null,
      byline: obj.author?.name || obj.author || null,
    })).filter(it => it.title && it.link);
  }

  return [];
}

function rssItemToObj(el, label) {
  const get = q => (el.querySelector(q)?.textContent || "").trim();
  const title = get("title");
  const link = get("link") || el.querySelector("guid")?.textContent?.trim() || "";
  const descRaw = get("description") || get("content\\:encoded") || "";
  const pub = get("pubDate");
  const byline = get("dc\\:creator") || null;

  // Try standard <enclosure url=""> or <media:content url="">
  const enclosureUrl = el.querySelector("enclosure")?.getAttribute("url")
                     || el.querySelector("media\\:content")?.getAttribute("url")
                     || null;

  return {
    title: title || null,
    link,
    source: label,
    isoDate: toIso(pub),
    desc: stripHtml(descRaw),
    image: enclosureUrl,
    byline,
  };
}

function atomEntryToObj(el, label) {
  const get = q => (el.querySelector(q)?.textContent || "").trim();
  const title = get("title");
  const link = el.querySelector("link[rel='alternate']")?.getAttribute("href")
             || el.querySelector("link")?.getAttribute("href")
             || "";
  const descRaw = get("summary") || get("content") || "";
  const updated = get("updated") || get("published");
  const author = el.querySelector("author > name")?.textContent?.trim() || null;
  const enclosureUrl = el.querySelector("link[rel='enclosure']")?.getAttribute("href") || null;

  return {
    title: title || null,
    link,
    source: label,
    isoDate: toIso(updated),
    desc: stripHtml(descRaw),
    image: enclosureUrl,
    byline: author,
  };
}

function stripHtml(s) {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function toIso(s) {
  try {
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d)) return null;
    return d.toISOString();
  } catch { return null; }
}

function str(x) { return (x ?? "").toString(); }

function dedupeAndSort(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = (it.link || it.title || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  // sort newest first
  out.sort((a,b) => (Date.parse(b.isoDate || 0) || 0) - (Date.parse(a.isoDate || 0) || 0));
  return out;
}

function chooseHero(items) {
  // Prefer items with images; fallback to the first
  const withImg = items.find(it => it.image && it.image.startsWith("http"));
  const base = withImg || items[0] || null;
  if (!base) return null;

  // Ensure hero fields expected by the client
  return {
    title: base.title,
    link: base.link,
    source: base.source,
    desc: base.desc || null,
    image: base.image || null,
    byline: base.byline || null,
    isoDate: base.isoDate || null,
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
