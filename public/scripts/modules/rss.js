// public/scripts/modules/rss.js
// Robust news loader with TOP-style 3-column rail + smart title tightening.

const NEWS_URL = "/api/news";

export async function start() {
  try {
    const res = await fetch(NEWS_URL, { headers: { "accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    renderRail((data?.rail || []).slice(0, 8));

    if (data?.hero) {
      document.dispatchEvent(new CustomEvent("jj:newsHero", { detail: data.hero }));
    }
  } catch (err) {
    console.warn("[JJ] news fetch failed", err);
    const list = document.getElementById("news-list");
    if (list) list.innerHTML = `<li class="muted">Couldn’t load headlines right now.</li>`;
  }
}

function renderRail(items) {
  const list = document.getElementById("news-list");
  if (!list) return;

  const rows = items.map((it) => {
    const fullTitle = it?.title || it?.headline || it?.t || "(untitled)";
    const url   = it?.link  || it?.url || "#";
    const src   = it?.source || it?.label || it?.site || "";
    const raw   = it?.isoDate || it?.pubDate || it?.published || it?.date || it?.time || it?.ts;

    const d = parseDateMaybe(raw);
    const when  = fmtRelative(d);
    const code  = enforce8(abbrevSource(src, url));         // 8-char cap
    const home  = sourceHomepage(code, url, src);           // NEW
    const tight = shortenTitle(fullTitle, src, url);

    return `
      <li class="news-row">
        <a class="col-headline" href="${attr(url)}" target="_blank" rel="noopener" title="${escapeHtml(fullTitle)}">
          ${escapeHtml(tight)}
        </a>
        <a class="col-source" href="${attr(home)}" target="_blank" rel="noopener" title="${escapeHtml(src)}">${escapeHtml(code)}</a>
        <time class="col-time" ${d ? `datetime="${d.toISOString()}"` : ""}>${when || ""}</time>
      </li>
    `;
  });

  list.innerHTML = rows.join("");
}

/* Map mnemonic → homepage; fallback to URL host root if we don’t know it */
function sourceHomepage(code, url, src) {
  const map = {
    WKRC:      "https://local12.com",
    FOX19:     "https://www.fox19.com",
    WCPO:      "https://www.wcpo.com",
    WLWT:      "https://www.wlwt.com",
    WVXU:      "https://www.wvxu.org",

    BIZCOUR:   "https://www.bizjournals.com/cincinnati",
    CINMAG:    "https://www.cincinnatimagazine.com",
    HERALD:    "https://thecincinnatiherald.com",
    SIGNAL:    "https://signalcincinnati.org",
    SOAPBOX:   "https://www.soapboxmedia.com",
    CATHTEL:   "https://www.thecatholictelegraph.com",
    ISRAEL:    "https://americanisraelite.com",
    NEWSREC:   "https://www.newsrecord.org",
    ENQ:       "https://www.cincinnati.com",
    NKYTRIB:   "https://www.nkytribune.com",

    OCJ:       "https://ohiocapitaljournal.com",
    STATEHB:   "https://www.statenews.org",
    SPECTRUM:  "https://spectrumlocalnews.com/oh/cincinnati",

    CITYBEAT:  "https://www.citybeat.com",
  };

  if (map[code]) return map[code];
  // fallback: use the article’s hostname root
  try { const u = new URL(url); return `${u.protocol}//${u.hostname}`; } catch {}
  // last resort: try parsing any URL found in source text
  const m = String(src).match(/https?:\/\/[^\s)]+/i);
  if (m) return m[0];
  return "#";
}


/* ---------- headline tightening (no truncation) ---------- */
function shortenTitle(title, src = "", url = "") {
  let t = String(title);

  // 1) Drop trailing site/brand suffixes like " — WCPO" or " | CityBeat"
  t = stripBrandSuffix(t, src, url);

  // 2) Remove boilerplate bracketed tags
  t = t
    .replace(/\s*\((?:photos?|video|gallery|opinion|update[sd]?)\)\s*$/i, "")
    .replace(/\s*-\s*(?:photos?|video|gallery|opinion|update[sd]?)\s*$/i, "");

  // 3) Collapse verbose local phrases to tight mnemonics
  const repl = [
    [/^Cincinnati[,—:\s]+/i, ""],
    [/^Cincy[,—:\s]+/i, ""],

    [/University of Cincinnati/gi, "UC"],
    [/Cincinnati Public Schools/gi, "CPS"],
    [/Cincinnati Police Department/gi, "CPD"],
    [/Cincinnati Fire Department/gi, "CFD"],
    [/Cincinnati City Council/gi, "Council"],
    [/Hamilton County/gi, "Ham. Co."],
    [/Northern Kentucky/gi, "NKY"],
    [/Cincinnati Children'?s(?: Hospital(?: Medical Center)?)?/gi, "Children’s"],
    [/(Cincinnati\s*)?Zoo( & Botanical Garden)?/gi, "Zoo"],
    [/Cincinnati\/Northern Kentucky International Airport/gi, "CVG"],
    [/Cincinnati City Hall/gi, "City Hall"],
    [/Ohio Department of Transportation/gi, "ODOT"],
    [/Cincinnati Department of Transportation and Engineering/gi, "DOTE"],

    [/Cincinnati Bengals/gi, "Bengals"],
    [/Cincinnati Reds/gi, "Reds"],

    [/\bInterstate\s+(\d+)\b/gi, "I-$1"],
    [/\bU\.S\.\s*Route\s*(\d+)\b/gi, "US-$1"],
    [/\bState\s*Route\s*(\d+)\b/gi, "SR-$1"],

    // boilerplate tails
    [/\s*[—–-]\s*What to know.*$/i, ""],
    [/\s*:\s*What to know.*$/i, ""],
    [/\s*[—–-]\s*What we know.*$/i, ""],
  ];
  for (const [re, to] of repl) t = t.replace(re, to);

  // 4) Normalize whitespace/dashes
  t = t.replace(/\s{2,}/g, " ").replace(/\s*—\s*/g, " — ").trim();

  // Avoid over-shortening to nothing
  return t.length ? t : String(title);
}

function stripBrandSuffix(t, src, url) {
  const host = hostname(url);
  const brands = [
    "wcpo", "wlwt", "fox19", "wkrc", "local 12", "wvxu", "w nku",
    "cincinnati.com", "enquirer", "cincinnati magazine", "citybeat",
    "signal cincinnati", "soapbox", "business courier", "bizjournals",
    "catholic telegraph", "american israelite", "news record", "nky tribune",
    "spectrum"
  ].join("|");
  const tailRe = new RegExp(`\\s*[\\-|\\||—–]\\s*(?:${brands})\\b.*$`, "i");
  const hostRe = /(\s*[|\-—–]\s*)?([A-Za-z0-9.-]+\.com|[A-Za-z0-9.-]+\.org)\b.*$/i;

  // If suffix looks like a brand or a host, drop it.
  t = t.replace(tailRe, "");
  t = t.replace(hostRe, "");
  return t.trim();
}

/* ---------- helpers ---------- */

function parseDateMaybe(v) {
  if (!v) return null;
  if (typeof v === "number") {
    const ms = v < 2e10 ? v * 1000 : v;
    const d = new Date(ms);
    return isFinite(d) && !isNaN(d) ? d : null;
  }
  if (typeof v === "string") {
    const parsed = Date.parse(v.trim());
    if (!Number.isNaN(parsed)) {
      const d = new Date(parsed);
      return isFinite(d) && !isNaN(d) ? d : null;
    }
    return null;
  }
  if (v instanceof Date) return isNaN(v) ? null : v;
  return null;
}

function fmtRelative(d) {
  if (!d) return "";
  const diff = Math.round((Date.now() - d.getTime()) / 1000);
  if (diff < 0) return "";
  if (diff < 60) return "now";
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function attr(s) { return String(s).replaceAll('"', "&quot;"); }

function enforce8(s) { return String(s || "").toUpperCase().slice(0, 8); }

/* ---------- source mnemonics (Bloomberg-style) ---------- */

function abbrevSource(src = "", url = "") {
  const s = String(src).trim();
  const u = String(url).trim();
  const host = hostname(u);

  // TV/Radio
  if (/\bWKRC\b/i.test(s) || /wkrc|local12/i.test(host)) return "WKRC";
  if (/\bFOX19\b/i.test(s) || /wxix|fox19/i.test(s) || /wxix|fox19/i.test(host)) return "WXIX";
  if (/\bWCPO\b/i.test(s) || /wcpo/i.test(s) || /wcpo/i.test(host)) return "WCPO";
  if (/\bWLWT\b/i.test(s) || /wlwt/i.test(s) || /wlwt/i.test(host)) return "WLWT";
  if (/\bWVXU\b/i.test(s) || /wvxu/i.test(s) || /wvxu/i.test(host)) return "WVXU";

  // Print/digital
  const MAP = [
    [/business\s*courier|biz\s*cour/i,               "BIZCOUR"],
    [/cincinnati\s*magazine|cincinnatimagazine\.com/i, "CINMAG"],
    [/cincinnati\s*herald|thecincinnatiherald\.com/i, "HERALD"],
    [/signal\s*cincinnati|signalcincinnati\.org/i,    "SIGNAL"],
    [/soapbox\s*cincinnati|soapboxmedia\.com|feeds\.feedburner\.com\/soapboxmedia/i, "SOAPBOX"],
    [/catholic\s*telegraph|thecatholictelegraph\.com/i, "CATHTEL"],
    [/american\s*israelite|americanisraelite\.com/i,  "ISRAEL"],
    [/news\s*record|newsrecord\.org/i,                "NEWSREC"],
    [/city\s*beat|citybeat\.com/i,                    "CITYBEAT"],
    [/enquirer|cincinnati\.com/i,                     "ENQUIRER"],
    [/nky\s*trib|northern\s*kentucky\s*tribune|nkytribune\.com/i, "NKYTRIB"],
    // Statewide/public media
    [/ohio\s*capital\s*journal|ohiocapitaljournal\.com/i, "OHIOCAPJ"],
    [/statehouse\s*news\s*bureau|statenews\.org/i,    "SHNB"],
    [/spectrum\s*news.*cincinnati|spectrumlocalnews\.com/i, "SPECTRUM"],
  ];
  for (const [re, code] of MAP) if (re.test(s) || re.test(host)) return code;

  // Fallback: call letters in text
  const call = (s.match(/\b([WK][A-Z]{2,3}\d?)\b/i) || [])[1];
  if (call) return call.toUpperCase();

  // Final fallback
  return compressName(s || host);
}

function hostname(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function compressName(name) {
  if (!name) return "";
  const cleaned = name
    .replace(/\b(the|cincinnati|cincy|of|and|news|media|online)\b/ig, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  if (!cleaned) return "";
  const letters = cleaned.replace(/[AEIOU\s]/g, "");
  return (letters || cleaned).slice(0, 8);
}
