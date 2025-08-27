export async function onRequest() {
  try {
    const [nfl, mlb, mls] = await Promise.allSettled([
      espnTeamScoreboard("football", "nfl", "cin"), // Bengals
      espnTeamScoreboard("baseball", "mlb", "cin"), // Reds
      (async () => {
        try { return await espnTeamScoreboard("soccer", "usa.1", "fcc"); }
        catch { return await espnTeamScoreboard("soccer", "usa.1", "cin"); }
      })(),
    ]);

    const games = []
      .concat(nfl.status === "fulfilled" ? nfl.value : [])
      .concat(mlb.status === "fulfilled" ? mlb.value : [])
      .concat(mls.status === "fulfilled" ? mls.value : []);

    return json({ label: "Cincinnati Scores", games });
  } catch (err) {
    console.error("SCORES_ERROR", err?.stack || err);
    return json({ label: "Cincinnati Scores", games: [], error: "temporary_error" });
  }
}

function json(obj) {
  return new Response(JSON.stringify(obj), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function espnTeamScoreboard(sportGroup, league, teamSlug) {
  const url = `https://site.api.espn.com/apis/v2/sports/${sportGroup}/${league}/teams/${teamSlug}/scoreboard`;
  const res = await fetch(url, { headers: { "user-agent": "JunctaJuvantBot/1.0" } });
  if (!res.ok) throw new Error(`ESPN ${league}/${teamSlug} ${res.status}`);
  const data = await res.json();
  const events = data?.events || [];
  return events.map(eventToGame(league));
}

function eventToGame(league) {
  return (ev) => {
    const comp = ev?.competitions?.[0];
    const status = comp?.status?.type?.shortDetail || ev?.status?.type?.description || "";
    const whenIso = ev?.date || comp?.date || null;
    const link = comp?.links?.find(l => l.rel?.includes("desktop"))?.href || ev?.links?.[0]?.href || null;
    const competitors = comp?.competitors || [];
    const home = competitors.find(c => c.homeAway === "home");
    const away = competitors.find(c => c.homeAway === "away");
    const homeName = home?.team?.shortDisplayName || home?.team?.displayName || "Home";
    const awayName = away?.team?.shortDisplayName || away?.team?.displayName || "Away";
    const homeScore = home?.score ? Number(home.score) : null;
    const awayScore = away?.score ? Number(away.score) : null;

    return {
      league: league.toUpperCase(),
      when: whenIso,
      status,
      link,
      home: { name: homeName, score: homeScore },
      away: { name: awayName, score: awayScore },
    };
  };
}
