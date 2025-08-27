// public/scripts/modules/hero.js
// Listens for "jj:newsHero" and renders the hero card safely.

export function start() {
  document.addEventListener(
    "jj:newsHero",
    (e) => {
      try {
        renderHero(e.detail);
      } catch (err) {
        console.warn("[JJ] hero render failed", err);
      }
    },
    { once: false }
  );
}

function renderHero(item) {
  if (!item) return;

  const linkEl   = document.getElementById("hero-link");
  const sourceEl = document.getElementById("hero-source");
  const timeEl   = document.getElementById("hero-time");
  const bylineEl = document.getElementById("hero-byline");
  const descEl   = document.getElementById("hero-desc");
  const imgEl    = document.querySelector(".hero-media img");

  const title  = item.title || item.headline || item.t || "(untitled)";
  const url    = item.link  || item.url || "#";
  const source = item.source || item.label || item.site || "";
  const byline = item.byline || item.author || "";
  const raw    = item.isoDate || item.pubDate || item.published || item.date || item.time || item.ts;

  if (linkEl) {
    linkEl.textContent = title;
    linkEl.href = url;
  }
  if (sourceEl) sourceEl.textContent = source;

  if (timeEl) {
    const d = parseDateMaybe(raw);
    timeEl.textContent = d ? fmtRelative(d) : "";
  }

  // Markup has: "... <span id='hero-time'></span><span id='hero-byline'></span>"
  // So we include a leading separator here.
  if (bylineEl) bylineEl.textContent = byline ? ` · ${byline}` : "";

  if (descEl) descEl.textContent = stripHtml(item.description || item.summary || item.desc || "");

  if (imgEl) {
    const img =
      item.image ||
      item.img ||
      item.thumbnail ||
      (item.enclosure && item.enclosure.url) ||
      null;
    if (img) imgEl.src = img;
  }
}

/* ---------- helpers ---------- */

function parseDateMaybe(v) {
  if (!v) return null;
  if (typeof v === "number") {
    const ms = v < 2e10 ? v * 1000 : v; // treat small as seconds
    const d = new Date(ms);
    return isFinite(d) && !isNaN(d) ? d : null;
  }
  if (typeof v === "string") {
    const t = Date.parse(v.trim());
    if (!Number.isNaN(t)) {
      const d = new Date(t);
      return isFinite(d) && !isNaN(d) ? d : null;
    }
    return null;
  }
  if (v instanceof Date) return isNaN(v) ? null : v;
  return null;
}

function fmtRelative(d) {
  const now = Date.now();
  const diff = Math.round((now - d.getTime()) / 1000);
  if (diff < 0) return "";
  if (diff < 60) return "just now";
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function stripHtml(s) {
  return String(s).replace(/<[^>]+>/g, "").trim();
}
