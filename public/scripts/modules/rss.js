// public/scripts/modules/rss.js
// Robust news loader: never crashes on weird/missing dates.

const NEWS_URL = "/api/news";

export async function start() {
  try {
    const res = await fetch(NEWS_URL, { headers: { "accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Render left-rail list
    renderRail(data?.rail || []);

    // Broadcast hero for hero.js (if present)
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

  const normalized = items.map((it) => {
    const title = it?.title || it?.headline || it?.t || "(untitled)";
    const url   = it?.link  || it?.url || "#";
    const src   = it?.source || it?.label || it?.site || "";
    // Try a bunch of common keys from feeds/services
    const raw   = it?.isoDate || it?.pubDate || it?.published || it?.date || it?.time || it?.ts;
    const d     = parseDateMaybe(raw); // -> Date | null
    return { title, url, src, d };
  });

  list.innerHTML = normalized.map((n) => {
    const metaBits = [];
    if (n.src) metaBits.push(escapeHtml(n.src));
    const rel = fmtRelative(n.d);
    if (rel) metaBits.push(rel);
    const meta = metaBits.length ? `<div class="meta">${metaBits.join(" · ")}</div>` : "";

    return `
      <li>
        <a href="${attr(n.url)}" target="_blank" rel="noopener">${escapeHtml(n.title)}</a>
        ${meta}
      </li>
    `;
  }).join("");
}

/* ---------- helpers ---------- */

function parseDateMaybe(v) {
  if (!v) return null;
  // number (seconds or ms)
  if (typeof v === "number") {
    const ms = v < 2e10 ? v * 1000 : v; // treat < ~year 2600 as seconds
    const d = new Date(ms);
    return isFinite(d) && !isNaN(d) ? d : null;
  }
  // string (ISO, RFC822-ish, etc.)
  if (typeof v === "string") {
    const s = v.trim();
    // common bad patterns from RSS; Date.parse handles many, but be defensive
    const parsed = Date.parse(s);
    if (!Number.isNaN(parsed)) {
      const d = new Date(parsed);
      return isFinite(d) && !isNaN(d) ? d : null;
    }
    return null;
  }
  // Date instance
  if (v instanceof Date) return isNaN(v) ? null : v;
  return null;
}

function fmtRelative(d) {
  if (!d) return "";
  const now = Date.now();
  const diffSec = Math.round((now - d.getTime()) / 1000);
  if (diffSec < 0) return ""; // future? skip
  if (diffSec < 60) return "just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  // fallback: short date
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function attr(s) {
  // minimal attribute escaper
  return String(s).replaceAll('"', "&quot;");
}
