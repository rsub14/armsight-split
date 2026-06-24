function Library({ games, tier }) {
  const [selTeam, setSelTeam] = useState(null);
  const [selPitcher, setSelPitcher] = useState("all");
  const [showPrint, setShowPrint] = useState(false);
  const isElite = tier === "elite";

  // Helper: canonical pitcher key — lowercase+trimmed so "Gausman" and "gausman" merge
  const pitcherKey = (name) => (name || "Unknown").trim().toLowerCase();

  // Build team map — for Pro only show most recent game per opponent
  // For Elite show all games aggregated
  // pitchers stored as { [canonicalKey]: { displayName, pitches[] } }
  const teamMap = {};
  games.forEach(g => {
    if (!g.pitches || g.pitches.length === 0) return;
    const opp = (g.opponent || "Unknown").trim();
    if (!teamMap[opp]) teamMap[opp] = { games: [], pitchers: {} };
    teamMap[opp].games.push(g);
    g.pitches.forEach(p => {
      const rawName = (p.pitcher || g.pitcher || "Unknown").trim();
      const key = pitcherKey(rawName);
      if (!teamMap[opp].pitchers[key]) teamMap[opp].pitchers[key] = { displayName: rawName, pitches: [] };
      if (!EVENTS.has(p.type) && p.result !== "ibb" && p.type !== "UNK") {
        teamMap[opp].pitchers[key].pitches.push(p);
      }
    });
  });

  // For Pro — only use most recent game per opponent
  const proTeamMap = {};
  Object.entries(teamMap).forEach(([opp, data]) => {
    const latestGame = [...data.games].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (!latestGame) return;
    const pitchers = {};
    latestGame.pitches.forEach(p => {
      const rawName = (p.pitcher || latestGame.pitcher || "Unknown").trim();
      const key = pitcherKey(rawName);
      if (!pitchers[key]) pitchers[key] = { displayName: rawName, pitches: [] };
      if (!EVENTS.has(p.type) && p.result !== "ibb") pitchers[key].pitches.push(p);
    });
    proTeamMap[opp] = { games: [latestGame], pitchers };
  });

  // Build global pitcher map across ALL opponents (Elite only)
  // Key: canonical name → { displayName, pitches[], gameIds Set }
  const globalPitcherMap = {};
  if (isElite) {
    games.forEach(g => {
      if (!g.pitches || g.pitches.length === 0) return;
      g.pitches.forEach(p => {
        const rawName = (p.pitcher || g.pitcher || "Unknown").trim();
        const key = pitcherKey(rawName);
        if (!globalPitcherMap[key]) globalPitcherMap[key] = { displayName: rawName, pitches: [], gameIds: new Set() };
        globalPitcherMap[key].gameIds.add(g.id);
        if (!EVENTS.has(p.type) && p.result !== "ibb" && p.type !== "UNK") {
          globalPitcherMap[key].pitches.push(p);
        }
      });
    });
  }

  const activeMap = isElite ? teamMap : proTeamMap;
  const teams = Object.keys(activeMap).sort();

  useEffect(() => {
    if (teams.length && !selTeam) setSelTeam(teams[0]);
  }, [teams.length]);

  useEffect(() => { setSelPitcher("all"); }, [selTeam]);

  if (!teams.length) return (
    <div style={{ ...cd, textAlign: "center", padding: 50 }}>
      <div style={{ fontSize: 14, color: G.tx3 }}>No opponent data yet.</div>
      <div style={{ fontSize: 12, color: G.tx3, marginTop: 8 }}>Chart games to build team profiles.</div>
    </div>
  );

  const team = selTeam ? activeMap[selTeam] : null;

  // For Elite, when a specific pitcher is selected, use cross-team global data
  const viewPitches = team ? (
    selPitcher === "all"
      ? Object.values(team.pitchers).flatMap(v => v.pitches)
      : isElite && globalPitcherMap[selPitcher]
        ? globalPitcherMap[selPitcher].pitches
        : (team.pitchers[selPitcher]?.pitches || [])
  ) : [];

  // pitcherNames: array of canonical keys, sorted by pitch count descending
  const pitcherNames = team ? Object.keys(team.pitchers).sort((a, b) =>
    (team.pitchers[b].pitches.length) - (team.pitchers[a].pitches.length)
  ) : [];

  // Helper: display name for a pitcher key
  const getPitcherDisplay = (key) =>
    team?.pitchers[key]?.displayName || globalPitcherMap[key]?.displayName || key;

  // Compute RISP data before render
  const rispSituationsLib = [
    { label: "Bases Loaded", filter: p => p.runners && p.runners.first && p.runners.second && p.runners.third },
    { label: "1B & 2B",      filter: p => p.runners && p.runners.first && p.runners.second && !p.runners.third },
    { label: "1B & 3B",      filter: p => p.runners && p.runners.first && !p.runners.second && p.runners.third },
    { label: "2B & 3B",      filter: p => p.runners && !p.runners.first && p.runners.second && p.runners.third },
    { label: "2B only",      filter: p => p.runners && !p.runners.first && p.runners.second && !p.runners.third },
    { label: "3B only",      filter: p => p.runners && !p.runners.first && !p.runners.second && p.runners.third },
  ];
  const rispDataLib = viewPitches.length > 0 ? rispSituationsLib.map(s => {
    const pitches = viewPitches.filter(s.filter);
    if (pitches.length < 2) return null;
    const freq = {};
    pitches.forEach(p => { freq[p.type] = (freq[p.type] || 0) + 1; });
    return { label: s.label, freq, total: pitches.length };
  }).filter(Boolean) : [];

  const t = viewPitches.length > 0 ? analyze(viewPitches) : null;
  const mkB = (ty, tot) => tot ? Object.entries(ty).map(([t, c]) => ({ type: t, count: c, pct: +((c / tot) * 100).toFixed(1) })).sort((a, b) => b.count - a.count) : [];

  // Check if this opponent has multiple games (for upgrade nudge)
  const totalGamesForTeam = teamMap[selTeam]?.games.length || 0;

  return (
    <div>
      {/* Pro upgrade nudge — shown when opponent has multiple games */}
      {!isElite && totalGamesForTeam > 1 && (
        <div style={{ marginBottom: 10, padding: "10px 14px", background: G.gold + "12", borderRadius: 8, border: "1px solid " + G.gold + "33", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: G.gold, letterSpacing: 0.5 }}>
              🔒 {totalGamesForTeam} games charted against {selTeam}
            </div>
            <div style={{ fontSize: 10, color: G.tx3, marginTop: 2 }}>
              Upgrade to Elite to see combined tendencies across all {totalGamesForTeam} appearances
            </div>
          </div>
          <div style={{ fontSize: 10, color: G.gold, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>Elite →</div>
        </div>
      )}

      {/* Pro single-game notice */}
      {!isElite && (
        <div style={{ marginBottom: 8, padding: "6px 12px", background: G.sf2, borderRadius: 6, border: "1px solid " + G.bd }}>
          <span style={{ fontSize: 10, color: G.tx3, fontWeight: 700 }}>
            SHOWING: Most recent game only — Elite aggregates across all appearances
          </span>
        </div>
      )}
      {/* Team selector */}
      <div style={{ ...cd, marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 2 }}>OPPONENT</div>
          {selTeam && viewPitches && viewPitches.length > 0 && <button onClick={() => setShowPrint(true)}
            style={{ padding: "5px 12px", background: "transparent", border: "1px solid " + G.bd2, borderRadius: 6, color: G.tx3, fontSize: 10, fontWeight: 800, cursor: "pointer", fontFamily: "'Azeret Mono',monospace", letterSpacing: 1 }}>
            🖨 Print Report
          </button>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {teams.map(t => (
            <button key={t} onClick={() => setSelTeam(t)}
              style={{ ...btn(selTeam === t ? "p" : "g"), display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span>{t}</span>
              <span style={{ fontSize: 9, color: selTeam === t ? "#000" : G.tx3, fontWeight: 700 }}>
                {isElite ? `${teamMap[t].games.length}G` : "1G"} · {Object.keys(activeMap[t].pitchers).length}P
                {!isElite && teamMap[t].games.length > 1 ? ` (${teamMap[t].games.length} total 🔒)` : ""}
              </span>
            </button>
          ))}
        </div>
      </div>

      {team && (
        <>
          {/* Pitcher filter */}
          <div style={{ ...cd, marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>VIEW</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => setSelPitcher("all")}
                style={{ ...btn(selPitcher === "all" ? "p" : "g"), display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <span>Staff Overview</span>
                <span style={{ fontSize: 9, color: selPitcher === "all" ? "#000" : G.tx3, fontWeight: 700 }}>
                  {Object.values(team.pitchers).reduce((s, v) => s + v.pitches.length, 0)} pitches
                </span>
              </button>
              {pitcherNames.map(key => {
                const dispName = getPitcherDisplay(key);
                const totalPitches = isElite && globalPitcherMap[key]
                  ? globalPitcherMap[key].pitches.length
                  : team.pitchers[key].pitches.length;
                const totalGames = isElite && globalPitcherMap[key]
                  ? globalPitcherMap[key].gameIds.size
                  : new Set(games.filter(g => g.opponent === selTeam && g.pitches.some(p => pitcherKey(p.pitcher || g.pitcher) === key)).map(g => g.id)).size;
                return (
                  <button key={key} onClick={() => setSelPitcher(key)}
                    style={{ ...btn(selPitcher === key ? "p" : "g"), display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span>{dispName}</span>
                    <span style={{ fontSize: 9, color: selPitcher === key ? "#000" : G.tx3, fontWeight: 700 }}>
                      {totalPitches}p · {totalGames}G{isElite && globalPitcherMap[key]?.gameIds.size > 1 && team.pitchers[key] ? " · all teams" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats header */}
          {t && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8, marginBottom: 12 }}>
                {[
                  { v: selPitcher === "all" ? team.games.length : (isElite && globalPitcherMap[selPitcher] ? globalPitcherMap[selPitcher].gameIds.size : new Set(games.filter(g => g.pitches.some(p => pitcherKey(p.pitcher || g.pitcher) === selPitcher)).map(g => g.id)).size), l: "Games" },
                  { v: pitcherNames.length, l: "Pitchers" },
                  { v: viewPitches.length, l: selPitcher === "all" ? "Staff Pitches" : "Pitches" },
                  { v: t.mix[0]?.type || "-", l: "Primary Pitch" },
                  { v: t.mix[0] ? t.mix[0].pct + "%" : "-", l: "Primary %" },
                ].map((s, i) => (
                  <div key={i} style={{ ...cd, textAlign: "center", marginBottom: 0, padding: 12 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: G.gold }}>{s.v}</div>
                    <div style={{ fontSize: 9, color: G.tx3, letterSpacing: 1, textTransform: "uppercase", marginTop: 4, fontWeight: 700 }}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Games breakdown for this pitcher — Elite shows across all teams */}
              {selPitcher !== "all" && (
                <div style={{ ...cd, marginBottom: 8 }}>
                  <div style={cT}>Appearances{isElite && globalPitcherMap[selPitcher]?.gameIds.size > 1 ? " — All Teams" : ""}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(isElite
                      ? games.filter(g => g.pitches.some(p => pitcherKey(p.pitcher || g.pitcher) === selPitcher))
                      : games.filter(g => g.opponent === selTeam && g.pitches.some(p => pitcherKey(p.pitcher || g.pitcher) === selPitcher))
                    ).sort((a, b) => new Date(b.date) - new Date(a.date))
                      .map(g => {
                        const gPitches = g.pitches.filter(p => pitcherKey(p.pitcher || g.pitcher) === selPitcher && !EVENTS.has(p.type));
                        return (
                          <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: G.sf2, borderRadius: 6, border: "1px solid " + G.bd }}>
                            <div style={{ fontSize: 12, color: G.tx, fontWeight: 700 }}>
                              {g.date || "No date"}
                              {isElite && <span style={{ marginLeft: 6, fontSize: 10, color: G.tx3 }}>vs {g.opponent}</span>}
                            </div>
                            <div style={{ fontSize: 11, color: G.tx3 }}>{gPitches.length} pitches</div>
                            <div style={{ fontSize: 11, color: G.gold, fontFamily: "'Azeret Mono',monospace", fontWeight: 700 }}>
                              {gPitches.length > 0 ? (
                                Object.entries(
                                  gPitches.reduce((acc, p) => { acc[p.type] = (acc[p.type] || 0) + 1; return acc; }, {})
                                ).sort((a, b) => b[1] - a[1]).slice(0, 2)
                                  .map(([type, count]) => `${type} ${Math.round(count / gPitches.length * 100)}%`)
                                  .join(" · ")
                              ) : "—"}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div style={cd}><div style={cT}>Pitch Mix {selPitcher !== "all" ? `— ${getPitcherDisplay(selPitcher)}` : "— Staff"}</div><Bar data={t.mix} /></div>
              {t.fpN > 0 && <div style={cd}><div style={cT}>First Pitch ({t.fpN})</div><Bar data={mkB(t.fpT, t.fpN)} /></div>}
              {t.tsN > 0 && <div style={cd}><div style={cT}>Two-Strike ({t.tsN})</div><Bar data={mkB(t.tsT, t.tsN)} /></div>}
              {t.bhN > 0 && <div style={cd}><div style={cT}>Behind ({t.bhN})</div><Bar data={mkB(t.bhT, t.bhN)} /></div>}
              {t.vLN > 0 && <div style={cd}><div style={cT}>vs LHB ({t.vLN})</div><Bar data={mkB(t.vLT, t.vLN)} /></div>}
              {t.vRN > 0 && <div style={cd}><div style={cT}>vs RHB ({t.vRN})</div><Bar data={mkB(t.vRT, t.vRN)} /></div>}

              {/* ── RUNNERS IN SCORING POSITION ── */}
              {rispDataLib.length > 0 && (
                <div style={cd}>
                  <div style={cT}>Runners in Scoring Position</div>
                  {rispDataLib.map(({ label, freq, total }) => (
                    <div key={label} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: G.tx3, fontWeight: 800, marginBottom: 4 }}>
                        {label} <span style={{ color: G.tx3, fontWeight: 400 }}>({total} pitch{total !== 1 ? "es" : ""})</span>
                      </div>
                      <Bar data={mkB(freq, total)} />
                    </div>
                  ))}
                </div>
              )}
                <div style={cd}>
                  <div style={cT}>Times Through Order</div>
                  {Object.entries(t.tto).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([k, ty]) => {
                    const tot = Object.values(ty).reduce((a, b) => a + b, 0);
                    return (
                      <div key={k} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: G.tx3, fontWeight: 800, marginBottom: 4 }}>
                          {k === "1" ? "1st" : k === "2" ? "2nd" : k === "3" ? "3rd" : k + "th"} ({tot})
                        </div>
                        <Bar data={mkB(ty, tot)} />
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ ...cd, border: "2px solid " + G.gold + "44" }}>
                <div style={cT}>Report — {selPitcher === "all" ? selTeam + " Staff" : getPitcherDisplay(selPitcher)}</div>
                <ScoutNotes t={t} pitches={viewPitches} name={selPitcher === "all" ? selTeam + " Staff" : getPitcherDisplay(selPitcher)} />
              </div>

              {showPrint && (
                <PrintReport
                  type="library"
                  data={{ name: selPitcher === "all" ? selTeam + " Staff" : getPitcherDisplay(selPitcher), t, pitches: viewPitches, viewPitches, selTeam, isStaff: selPitcher === "all", rispData: rispDataLib }}
                  onClose={() => setShowPrint(false)}
                />
              )}
            </>
          )}
          {!t && (
            <div style={{ ...cd, textAlign: "center", padding: 30 }}>
              <div style={{ fontSize: 13, color: G.tx3 }}>No pitch data for this selection.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}