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

function abbrevSource(src = "", url = "") {
  const s = String(src).trim();
  const u = String(url).trim();
  const host = hostname(u);

  // TV/Radio: prefer call letters or familiar brand
  if (/local\s*12/i.test(s) || /wkrc/i.test(s) || /wkrc/i.test(host)) return "WKRC";
  if (/fox\s*19/i.test(s) || /wxix/i.test(s) || /fox19/i.test(host) || /wxix/i.test(host)) return "FOX19";
  if (/wcpo/i.test(s) || /wcpo/i.test(host)) return "WCPO";
  if (/wlwt/i.test(s) || /wlwt/i.test(host)) return "WLWT";
  if (/wvxu/i.test(s) || /wvxu/i.test(host)) return "WVXU";
  if (/wnku/i.test(s) || /wnku/i.test(host)) return "WNKU";

  // Newspapers / mags / digital
  const M = [
    [/business\s*courier|biz\s*cour/i,  "BIZCOUR"],
    [/cincinnati\s*herald/i,            "HERALD"],
    [/catholic\s*telegraph/i,           "CATHTEL"],
    [/american\s*israelite|israelite/i, "ISRAEL"],
    [/signal/i,                         "SIGNAL"],
    [/city\s*beat|citybeat/i,           "CITYBT"],
    [/cincinnati\s*magazine/i,          "CINMAG"],
    [/enquirer|cincinnati\.com/i,       "ENQ"],
    [/nky\s*trib|northern\s*kentucky\s*tribune/i, "NKYTRIB"],
  ];
  for (const [re, code] of M) if (re.test(s) || re.test(host)) return code;

  // Generic call letters from text if present (W/ K + 3-4 letters + optional digits)
  const call = (s.match(/\b([WK][A-Z]{2,3}\d?)\b/i) || [])[1];
  if (call) return call.toUpperCase();

  // Fallback: compress name
  return compressName(s || host);
}

function hostname(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function compressName(name) {
  if (!name) return "";
  // Remove common fillers, uppercase, keep consonants, cap length
  const cleaned = name
    .replace(/\b(the|cincinnati|cincy|of|and|news|media|online)\b/ig, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  if (!cleaned) return "";
  const letters = cleaned.replace(/[AEIOU\s]/g, "");
  return (letters || cleaned).slice(0, 8);
}
