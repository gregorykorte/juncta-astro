// public/scripts/modules/rss.js
// Robust news loader with TOP-style 3-column rail.

const NEWS_URL = "/api/news";

export async function start() {
  try {
    const res = await fetch(NEWS_URL, { headers: { "accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    renderRail((data?.rail || []).slice(0, 8)); // TOP-style: show 8

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
    const title = it?.title || it?.headline || it?.t || "(untitled)";
    const url   = it?.link  || it?.url || "#";
    const src   = it?.source || it?.label || it?.site || "";
    const raw   = it?.isoDate || it?.pubDate || it?.published || it?.date || it?.time || it?.ts;
    const d     = parseDateMaybe(raw);
    const when  = fmtRelative(d);
    const code  = abbrevSource(src, url);

    return `
      <li class="news-row">
        <a class="col-headline" href="${attr(url)}" target="_blank" rel="noopener">${escapeHtml(title)}</a>
        <span class="col-source" title="${escapeHtml(src)}">${escapeHtml(code)}</span>
        <time class="col-time" ${d ? `datetime="${d.toISOString()}"` : ""}>${when || ""}</time>
      </li>
    `;
  });

  list.innerHTML = rows.join("");
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

/* ---------- source mnemonics ---------- */

/* ---------- source mnemonics (Bloomberg-style) ---------- */

function abbrevSource(src = "", url = "") {
  const s = String(src).trim();
  const u = String(url).trim();
  const host = hostname(u);

  // TV/Radio call letters (prefer explicit brands)
  if (/\bWKRC\b/i.test(s) || /wkrc|local12|local12\.com/i.test(host)) return "WKRC";
  if (/\bFOX19\b/i.test(s) || /wxix|fox19/i.test(s) || /wxix|fox19/i.test(host)) return "FOX19";
  if (/\bWCPO\b/i.test(s) || /wcpo/i.test(s) || /wcpo/i.test(host)) return "WCPO";
  if (/\bWLWT\b/i.test(s) || /wlwt/i.test(s) || /wlwt/i.test(host)) return "WLWT";
  if (/\bWVXU\b/i.test(s) || /wvxu/i.test(s) || /wvxu/i.test(host)) return "WVXU";

  // Newspapers / mags / digital (Cincinnati-focused)
  const MAP = [
    // label regexes (either source text or hostname)
    [/business\s*courier|biz\s*cour/i,               "BIZCOUR"],  // Cincinnati Business Courier
    [/cincinnati\s*magazine|cincinnatimagazine\.com/i, "CINMAG"],
    [/cincinnati\s*herald|thecincinnatiherald\.com/i, "HERALD"],
    [/signal\s*cincinnati|signalcincinnati\.org/i,    "SIGNAL"],
    [/soapbox\s*cincinnati|soapboxmedia\.com|feeds\.feedburner\.com\/soapboxmedia/i, "SOAPBOX"],
    [/catholic\s*telegraph|thecatholictelegraph\.com/i, "CATHTEL"],
    [/american\s*israelite|americanisraelite\.com/i,  "ISRAEL"],
    [/news\s*record|newsrecord\.org/i,                "NEWSREC"],

    // Others you might pull sometimes
    [/city\s*beat|citybeat\.com/i,                    "CITYBEAT"],
    [/enquirer|cincinnati\.com/i,                     "ENQUIRER"],
    [/nky\s*trib|northern\s*kentucky\s*tribune|nkytribune\.com/i, "NKYTRIB"],

    // Statewide/public media (softly downweighted by your worker, but label anyway)
    [/ohio\s*capital\s*journal|ohiocapitaljournal\.com/i, "OHIOCAPJ"],
    [/statehouse\s*news\s*bureau|statenews\.org/i,    "SHNB"],
    [/spectrum\s*news.*cincinnati|spectrumlocalnews\.com/i, "SPECTRUM"],
  ];
  for (const [re, code] of MAP) {
    if (re.test(s) || re.test(host)) return code;
  }

  // Generic fallback: try call letters in text
  const call = (s.match(/\b([WK][A-Z]{2,3}\d?)\b/i) || [])[1];
  if (call) return call.toUpperCase();

  // Last-resort compression of name/host
  return compressName(s || host);
}

function hostname(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); }
  catch { return ""; }
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

