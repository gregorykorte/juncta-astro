// public/scripts/modules/weather.js
// Cincinnati conditions via Open-Meteo (no key, CORS ok)
const LAT = 39.1031, LON = -84.5120;
const API = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;

export async function start() {
  const tempEl = document.getElementById("temp");
  const descEl = document.getElementById("wx-desc");
  const extraEl = document.getElementById("wx-extra");
  if (!tempEl || !descEl || !extraEl) return;

  try {
    const res = await fetch(API, { headers: { "accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const c = j.current || j.current_weather || j.current_conditions || j?.current_weather_units && j; // tolerate shapes

    // Pull values robustly
    const t  = pick(j?.current?.temperature, j?.current_weather?.temperature, j?.current?.temperature_2m, c?.temperature);
    const at = pick(j?.current?.apparent_temperature, c?.apparent_temperature);
    const rh = pick(j?.current?.relative_humidity_2m, c?.relative_humidity_2m);
    const ws = pick(j?.current?.wind_speed_10m, c?.wind_speed_10m);
    const wc = pick(j?.current?.weather_code, c?.weather_code);

    // Render
    tempEl.textContent = isNum(t) ? Math.round(t) + "°" : "—";
    descEl.firstChild && (descEl.firstChild.nodeType === 3) // text node before <br>
      ? descEl.firstChild.nodeValue = codeToText(wc)
      : (descEl.textContent = codeToText(wc));

    const bits = [];
    if (isNum(at)) bits.push(`feels ${Math.round(at)}°`);
    if (isNum(rh)) bits.push(`${Math.round(rh)}% RH`);
    if (isNum(ws)) bits.push(`${Math.round(ws)} mph wind`);
    extraEl.textContent = bits.join(" · ");
  } catch (err) {
    console.warn("[JJ] weather failed", err);
    descEl.textContent = "Weather unavailable.";
    extraEl.textContent = "";
  }
}

/* ---------- helpers ---------- */
function pick(...vals) {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return undefined;
}
function isNum(v) { return typeof v === "number" && Number.isFinite(v); }

function codeToText(code) {
  const c = Number(code);
  const map = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    56: "Freezing drizzle (light)", 57: "Freezing drizzle (dense)",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    66: "Freezing rain (light)", 67: "Freezing rain (heavy)",
    71: "Light snow", 73: "Snow", 75: "Heavy snow",
    77: "Snow grains",
    80: "Light rain showers", 81: "Rain showers", 82: "Violent rain showers",
    85: "Snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail", 99: "Severe thunderstorm with hail",
  };
  return map[c] || "Conditions";
}
