// public/scripts/main.js

import {
  setDatelineWithAD,
  setYearRoman,
  setCopyrightBrand,
} from "./modules/date.js";

import { start as startWeather } from "./modules/weather.js";
import { start as startNews }    from "./modules/rss.js";
import { start as startScores }  from "./modules/scores.js";
import { start as startHero }    from "./modules/hero.js";

function boot() {
  try { setDatelineWithAD(); } catch (e) { console.warn("[JJ] date dateline failed", e); }
  try { setYearRoman(); }      catch (e) { console.warn("[JJ] date year failed", e); }
  try { setCopyrightBrand(); } catch (e) { console.warn("[JJ] date copyright failed", e); }

  try { startWeather?.(); } catch (e) { console.warn("[JJ] weather failed", e); }
  try { startNews?.(); }    catch (e) { console.warn("[JJ] news failed", e); }
  try { startScores?.(); }  catch (e) { console.warn("[JJ] scores failed", e); }
  try { startHero?.(); }    catch (e) { console.warn("[JJ] hero failed", e); }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
