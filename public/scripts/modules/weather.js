// public/scripts/modules/weather.js
// Cincinnati conditions via Open-Meteo + colorful SVG icons.

const LAT = 39.1031, LON = -84.5120;
const API = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;

export async function start() {
  const tempEl  = document.getElementById("temp");
  const descEl  = document.getElementById("wx-desc");
  const extraEl = document.getElementById("wx-extra");
  if (!tempEl || !descEl || !extraEl) return;

  // Ensure an icon container exists (before temp)
  let iconEl = document.getElementById("wx-icon");
  if (!iconEl) {
    iconEl = document.createElement("span");
    iconEl.id = "wx-icon";
    iconEl.className = "wx-icon";
    iconEl.setAttribute("aria-hidden", "true");
    const line = tempEl.closest(".stat-line") || tempEl.parentElement;
    if (line) line.insertBefore(iconEl, tempEl);
  }

  try {
    const res = await fetch(API, { headers: { "accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const c = j.current || j.current_weather || j.current_conditions || (j?.current_weather_units && j) || {};

    // Pull values robustly
    const t  = pick(j?.current?.temperature, j?.current_weather?.temperature, j?.current?.temperature_2m, c?.temperature);
    const at = pick(j?.current?.apparent_temperature, c?.apparent_temperature);
    const rh = pick(j?.current?.relative_humidity_2m, c?.relative_humidity_2m);
    const ws = pick(j?.current?.wind_speed_10m, c?.wind_speed_10m);
    const wc = pick(j?.current?.weather_code, c?.weather_code);

    // Icon
    const kind = codeToKind(wc);
    iconEl.dataset.kind = kind;
    iconEl.innerHTML = svgFor(kind);

    // Render text bits
    tempEl.textContent = isNum(t) ? Math.round(t) + "°" : "—";
    setDesc(descEl, textForKind(kind));

    const bits = [];
    if (isNum(at)) bits.push(`feels ${Math.round(at)}°`);
    if (isNum(rh)) bits.push(`${Math.round(rh)}% RH`);
    if (isNum(ws)) bits.push(`${Math.round(ws)} mph wind`);
    extraEl.textContent = bits.join(" · ");
  } catch (err) {
    console.warn("[JJ] weather failed", err);
    iconEl.dataset.kind = "na";
    iconEl.innerHTML = svgFor("na");
    setDesc(descEl, "Weather unavailable");
    extraEl.textContent = "";
  }
}

/* ---------- helpers ---------- */
function pick(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null) return v; // preserves 0, "", false as valid values
  }
  return undefined;
}
function isNum(v) { return typeof v === "number" && Number.isFinite(v); }

function setDesc(descEl, text) {
  // Keep the existing <br><small id="wx-extra"> structure
  let node = descEl.firstChild;
  if (node && node.nodeType === 3) node.nodeValue = text;
  else descEl.innerHTML = `${text}<br><small id="wx-extra"></small>`;
}

function codeToKind(code) {
  const c = Number(code);
  if (c === 0) return "sun";                // Clear
  if (c === 1) return "partly";             // Mainly clear
  if (c === 2) return "partly";             // Partly cloudy
  if (c === 3) return "cloud";              // Overcast
  if (c === 45 || c === 48) return "fog";
  if ([51,53,55,56,57].includes(c)) return "rain";   // drizzle / freezing drizzle
  if ([61,63,65,66,67,80,81,82].includes(c)) return "rain";
  if ([71,73,75,77,85,86].includes(c)) return "snow";
  if (c === 95) return "storm";
  if (c === 96 || c === 99) return "hail";
  return "na";
}
function textForKind(kind) {
  switch (kind) {
    case "sun": return "Sunny";
    case "partly": return "Partly cloudy";
    case "cloud": return "Overcast";
    case "fog": return "Fog";
    case "rain": return "Rain";
    case "snow": return "Snow";
    case "storm": return "Thunderstorm";
    case "hail": return "Thunderstorm w/ hail";
    default: return "Conditions";
  }
}

function svgFor(kind) {
  // Simple, colorful 24x24 icons (no external deps)
  switch (kind) {
    case "sun":
      return `<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="5"/></svg>`;
    case "partly":
      return `<svg viewBox="0 0 24 24" width="24" height="24">
        <circle cx="8" cy="10" r="4"/><path d="M6 16h10a4 4 0 0 0 0-8 5 5 0 0 0-9 2" />
      </svg>`;
    case "cloud":
      return `<svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M6 18h10a4 4 0 0 0 0-8 5 5 0 0 0-9 2 3 3 0 0 0-1 6z"/>
      </svg>`;
    case "fog":
      return `<svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M5 9h14M3 13h18M4 17h16" stroke-width="2" stroke-linecap="round" fill="none"/>
      </svg>`;
    case "rain":
      return `<svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M6 14h10a4 4 0 0 0 0-8 5 5 0 0 0-9 2" />
        <path d="M8 16l-1 3M12 16l-1 3M16 16l-1 3" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    case "snow":
      return `<svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M12 3v18M4.5 7.5l15 9M4.5 16.5l15-9" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    case "storm":
      return `<svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M6 14h10a4 4 0 0 0 0-8 5 5 0 0 0-9 2" />
        <path d="M11 14l-2 4h2l-1 4 4-6h-2l1-2z"/>
      </svg>`;
    case "hail":
      return `<svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M6 14h10a4 4 0 0 0 0-8 5 5 0 0 0-9 2" />
        <circle cx="8" cy="18" r="1.5"/><circle cx="12" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="3"/></svg>`;
  }
}
