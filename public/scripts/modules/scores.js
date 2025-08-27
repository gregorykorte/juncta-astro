// public/scripts/modules/scores.js
// Loads Cincinnati scores from /api/cincy-scores and renders the sidebar.

const ENDPOINT = "/api/cincy-scores";

export async function start() {
  const mount = document.getElementById("sports-content");
  if (!mount) return;
  try {
    const res = await fetch(ENDPOINT, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const games = normalizeGames(data).slice(0, 10);
    if (!games.length) {
      mount.innerHTML = `<div class="muted">No games to show.</div>`;
      return;
    }
    mount.innerHTML = `<ul class="scores-list">${games.map(toLi).join("")}</ul>`;
  } catch (err) {
    console.warn("[JJ] scores failed", err);
    mount.innerHTML = `<div class="muted">Couldn’t load scores right now.</div>`;
  }
}

/* ---------- rendering ---------- */

function toLi(g) {
  const away = escapeHtml(g.away?.abbr || g.away?.name || g.away || "Away");
  const home = escapeHtml(g.home?.abbr || g.home?.name || g.home || "Home");
  const as = numOrNull(g.awayScore);
  const hs = numOrNull(g.homeScore);

  const when = g.start ? fmtTime(g.start) : "";
  const status = (g.status || "").toLowerCase();

  let meta;
  if (as != null && hs != null) {
    // live / final
    const score = `${as}–${hs}`;
    if (status.includes("final")) meta = `Final`;
    else if (status.includes("live") || status.includes("in ") || status.includes("q") || status.includes("inning"))
      meta = g.status;
    else meta = g.status || "";
    return `<li><strong>${away}</strong> @ <strong>${home}</strong> — <strong>${score}</strong>${meta ? ` <span class="meta">(${escapeHtml(meta)})</span>` : ""}</li>`;
  } else {
    // scheduled
    const metaBits = [];
    if (g.league) metaBits.push(escapeHtml(g.league));
    if (when) metaBits.push(when);
    const metaStr = metaBits.length ? ` <span class="meta">(${metaBits.join(" · ")})</span>` : "";
    return `<li><strong>${away}</strong> @ <strong>${home}</strong>${metaStr}</li>`;
  }
}

/* ---------- normalization ---------- */

function normalizeGames(data) {
  // Accept: {games:[...]}, {events:[...]}, array, or other wrappers
  let list = [];
  if (Array.isArray(data)) list = data;
  else if (Array.isArray(data?.games)) list = data.games;
  else if (Array.isArray(data?.events)) list = data.events;
  else if (Array.isArray(data?.data)) list = data.data;
  else if (Array.isArray(data?.list)) list = data.list;

  return list.map((raw) => {
    // Try a bunch of common shapes.
    const away = pickTeam(raw, "away") || pickTeam(raw, "visitor");
    const home = pickTeam(raw, "home");
    const awayScore = firstNum(
      raw.awayScore, raw.away_points, raw.away_score,
      raw.away?.score, get(raw, "teams.away.score")
    );
    const homeScore = firstNum(
      raw.homeScore, raw.home_points, raw.home_score,
      raw.home?.score, get(raw, "teams.home.score")
    );
    const start = parseDateMaybe(
      raw.start, raw.startTime, raw.start_time, raw.date, raw.scheduled, raw.ts, raw.time
    );
    const league = raw.league || raw.sport || raw.comp || get(raw, "league.name");
    const status = raw.statusText || raw.status || raw.state || raw.stage || "";

    return {
      away, home, awayScore, homeScore,
      start, league, status
    };
  }).filter(g => g.away && g.home);
}

function pickTeam(raw, side) {
  // side = 'home' | 'away' | 'visitor'
  const t = raw[side] || raw[side + "Team"] || raw[side + "_team"] || get(raw, `teams.${side}`) || {};
  const name = t.name || t.fullName || t.displayName || t.team || raw[side + "Name"] || raw[side + "_name"] || raw[side];
  const abbr = t.abbr || t.code || t.short || t.nickname || t.shortName || t.displayAbbr || raw[side + "Abbr"];
  return name || abbr ? { name, abbr } : null;
}

/* ---------- helpers ---------- */

function get(obj, path) {
  try { return path.split(".").reduce((o,k)=> (o && o[k] != null ? o[k] : undefined), obj); }
  catch { return undefined; }
}
function firstNum(...vals) {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function fmtTime(d) {
  if (!(d instanceof Date) || isNaN(d)) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function parseDateMaybe(...candidates) {
  for (const v of candidates) {
    if (!v) continue;
    if (v instanceof Date && !isNaN(v)) return v;
    if (typeof v === "number") {
      const ms = v < 2e10 ? v * 1000 : v;
      const d = new Date(ms);
      if (!isNaN(d)) return d;
    }
    if (typeof v === "string") {
      const t = Date.parse(v.trim());
      if (!Number.isNaN(t)) return new Date(t);
    }
  }
  return null;
}
function escapeHtml(s) {
  return String(s)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
