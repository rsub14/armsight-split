function Library({ games, tier }) {
  const [selTeam, setSelTeam] = useState(null);
  const [selPitcher, setSelPitcher] = useState("all");
  const [showPrint, setShowPrint] = useState(false);
  const [dataTab, setDataTab] = useState("tendencies");
  const isElite = tier === "elite";

  const pitcherKey = (name) => (name || "Unknown").trim().toLowerCase();

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
  useEffect(() => { setDataTab("tendencies"); }, [selTeam, selPitcher]);

  if (!teams.length) return (
    <div style={{ ...cd, textAlign: "center", padding: 50 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: G.gold, marginBottom: 6 }}>No Data</div>
      <div style={{ fontSize: 12, color: G.tx3 }}>Chart games against opponents to build team profiles.</div>
    </div>
  );

  const team = selTeam ? activeMap[selTeam] : null;

  const viewPitches = team ? (
    selPitcher === "all"
      ? Object.values(team.pitchers).flatMap(v => v.pitches)
      : isElite && globalPitcherMap[selPitcher]
        ? globalPitcherMap[selPitcher].pitches
        : (team.pitchers[selPitcher]?.pitches || [])
  ) : [];

  const pitcherNames = team ? Object.keys(team.pitchers).sort((a, b) =>
    (team.pitchers[b].pitches.length) - (team.pitchers[a].pitches.length)
  ) : [];

  const getPitcherDisplay = (key) =>
    team?.pitchers[key]?.displayName || globalPitcherMap[key]?.displayName || key;

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

  const totalGamesForTeam = teamMap[selTeam]?.games.length || 0;

  // Inline chip button style
  const chip = (active) => ({
    padding: "5px 12px", borderRadius: 5, border: "none", cursor: "pointer",
    background: active ? G.gold : G.sf2,
    color: active ? "#000" : G.tx2,
    fontSize: 12, fontWeight: 800, fontFamily: "'Anybody',sans-serif",
    outline: active ? "2px solid " + G.gold : "none", outlineOffset: 1,
    whiteSpace: "nowrap",
  });

  // Section tab strip (Tendencies / Splits / Situations)
  const dtb = (id, label) => (
    <button onClick={() => setDataTab(id)}
      style={{ flex: 1, padding: "7px 8px", borderRadius: 5, border: "none", cursor: "pointer",
        background: dataTab === id ? G.gold + "22" : "transparent",
        color: dataTab === id ? G.gold : G.tx3,
        fontSize: 11, fontWeight: 800, fontFamily: "'Anybody',sans-serif",
        borderBottom: dataTab === id ? "2px solid " + G.gold : "2px solid transparent",
        letterSpacing: 0.3 }}>
      {label}
    </button>
  );

  // Small sub-label used within chart sections
  const subLabel = (text, count) => (
    <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
      {text}{count != null && <span style={{ color: G.tx3, fontWeight: 400, fontSize: 10, textTransform: "none", letterSpacing: 0 }}> ({count})</span>}
    </div>
  );

  return (
    <div>
      {/* Pro upgrade nudge */}
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
          <span style={{ fontSize: 10, color: G.tx3, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
            Showing: Most recent game only — Elite aggregates across all appearances
          </span>
        </div>
      )}

      {/* ── TEAM SELECTOR ── */}
      <div style={{ ...cd, marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>Opponent</div>
          {selTeam && viewPitches.length > 0 && (
            <button onClick={() => setShowPrint(true)}
              style={{ padding: "4px 10px", background: "transparent", border: "1px solid " + G.bd2, borderRadius: 5, color: G.tx3, fontSize: 10, fontWeight: 800, cursor: "pointer", fontFamily: "'Azeret Mono',monospace", letterSpacing: 1 }}>
              Print Report
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {teams.map(t => (
            <button key={t} onClick={() => setSelTeam(t)} style={{ ...chip(selTeam === t), display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <span>{t}</span>
              <span style={{ fontSize: 9, color: selTeam === t ? "#000" : G.tx3, fontWeight: 700 }}>
                {isElite ? `${teamMap[t].games.length}G` : "1G"} · {Object.keys(activeMap[t].pitchers).length}P
                {!isElite && teamMap[t].games.length > 1 ? ` (${teamMap[t].games.length} 🔒)` : ""}
              </span>
            </button>
          ))}
        </div>
      </div>

      {team && (
        <>
          {/* ── PITCHER SELECTOR ── */}
          <div style={{ ...cd, marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Pitcher</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => setSelPitcher("all")} style={{ ...chip(selPitcher === "all"), display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
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
                  <button key={key} onClick={() => setSelPitcher(key)} style={{ ...chip(selPitcher === key), display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                    <span>{dispName}</span>
                    <span style={{ fontSize: 9, color: selPitcher === key ? "#000" : G.tx3, fontWeight: 700 }}>
                      {totalPitches}p · {totalGames}G{isElite && globalPitcherMap[key]?.gameIds.size > 1 && team.pitchers[key] ? " · all teams" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── STATS TILES ── */}
          {t && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 8 }}>
                {[
                  { v: selPitcher === "all" ? team.games.length : (isElite && globalPitcherMap[selPitcher] ? globalPitcherMap[selPitcher].gameIds.size : new Set(games.filter(g => g.pitches.some(p => pitcherKey(p.pitcher || g.pitcher) === selPitcher)).map(g => g.id)).size), l: "Games" },
                  { v: pitcherNames.length, l: "Pitchers" },
                  { v: viewPitches.length, l: selPitcher === "all" ? "Pitches" : "Pitches" },
                  { v: t.mix[0]?.type || "—", l: "Primary" },
                  { v: t.mix[0] ? t.mix[0].pct + "%" : "—", l: "Primary %" },
                ].map((s, i) => (
                  <div key={i} style={{ background: G.sf2, border: "1px solid " + G.bd, borderRadius: 7, padding: "10px 6px", textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: G.gold }}>{s.v}</div>
                    <div style={{ fontSize: 8, color: G.tx3, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 3, fontWeight: 700 }}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* ── REPORT — above tabs, always visible ── */}
              <div style={{ background: G.sf2, border: "1px solid " + G.bd, borderLeft: "3px solid " + G.gold, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: G.gold, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                  Report — {selPitcher === "all" ? selTeam + " Staff" : getPitcherDisplay(selPitcher)}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                  <ScoutNotes t={t} pitches={viewPitches} name={selPitcher === "all" ? selTeam + " Staff" : getPitcherDisplay(selPitcher)} compact={true} />
                </div>
              </div>

              {/* ── SECTION TABS ── */}
              <div style={{ display: "flex", gap: 0, marginBottom: 8, background: G.sf2, borderRadius: 7, border: "1px solid " + G.bd, padding: "2px" }}>
                {dtb("tendencies", "Tendencies")}
                {dtb("splits", "Splits")}
                {dtb("situations", "Situations")}
              </div>

              {/* ── TENDENCIES TAB ── */}
              {dataTab === "tendencies" && (
                <div>
                  <div style={{ ...cd, marginBottom: 8 }}>
                    <div style={cT}>Pitch Mix — {selPitcher !== "all" ? getPitcherDisplay(selPitcher) : "Staff"}</div>
                    <Bar data={t.mix} />
                  </div>

                  {/* Appearances — shown only when pitcher selected */}
                  {selPitcher !== "all" && (
                    <div style={{ ...cd, marginBottom: 8 }}>
                      <div style={cT}>Appearances{isElite && globalPitcherMap[selPitcher]?.gameIds.size > 1 ? " — All Teams" : ""}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {(isElite
                          ? games.filter(g => g.pitches.some(p => pitcherKey(p.pitcher || g.pitcher) === selPitcher))
                          : games.filter(g => g.opponent === selTeam && g.pitches.some(p => pitcherKey(p.pitcher || g.pitcher) === selPitcher))
                        ).sort((a, b) => new Date(b.date) - new Date(a.date))
                          .map(g => {
                            const gPitches = g.pitches.filter(p => pitcherKey(p.pitcher || g.pitcher) === selPitcher && !EVENTS.has(p.type));
                            return (
                              <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: G.sf2, borderRadius: 6, border: "1px solid " + G.bd }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: G.tx }}>
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
                </div>
              )}

              {/* ── SPLITS TAB ── */}
              {dataTab === "splits" && (
                <div>
                  {/* First Pitch + Two-Strike side by side */}
                  {(t.fpN > 0 || t.tsN > 0) && (
                    <div style={{ display: "grid", gridTemplateColumns: t.fpN > 0 && t.tsN > 0 ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 8 }}>
                      {t.fpN > 0 && (
                        <div style={{ ...cd, marginBottom: 0 }}>
                          {subLabel("First Pitch", t.fpN)}
                          <Bar data={mkB(t.fpT, t.fpN)} />
                        </div>
                      )}
                      {t.tsN > 0 && (
                        <div style={{ ...cd, marginBottom: 0 }}>
                          {subLabel("Two-Strike", t.tsN)}
                          <Bar data={mkB(t.tsT, t.tsN)} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Behind + (spacer or LHB) */}
                  {(t.bhN > 0 || t.vLN > 0) && (
                    <div style={{ display: "grid", gridTemplateColumns: t.bhN > 0 && t.vLN > 0 ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 8 }}>
                      {t.bhN > 0 && (
                        <div style={{ ...cd, marginBottom: 0 }}>
                          {subLabel("Behind", t.bhN)}
                          <Bar data={mkB(t.bhT, t.bhN)} />
                        </div>
                      )}
                      {t.vLN > 0 && (
                        <div style={{ ...cd, marginBottom: 0 }}>
                          {subLabel("vs LHB", t.vLN)}
                          <Bar data={mkB(t.vLT, t.vLN)} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* RHB full-width if alone, or paired with whatever's left */}
                  {t.vRN > 0 && (
                    <div style={{ ...cd, marginBottom: 8 }}>
                      {subLabel("vs RHB", t.vRN)}
                      <Bar data={mkB(t.vRT, t.vRN)} />
                    </div>
                  )}

                  {t.fpN === 0 && t.tsN === 0 && t.bhN === 0 && t.vLN === 0 && t.vRN === 0 && (
                    <div style={{ ...cd, textAlign: "center", padding: 24 }}>
                      <div style={{ fontSize: 12, color: G.tx3 }}>Not enough data for split breakdowns.</div>
                    </div>
                  )}
                </div>
              )}

              {/* ── SITUATIONS TAB ── */}
              {dataTab === "situations" && (
                <div>
                  {/* RISP in 2-col grid */}
                  {rispDataLib.length > 0 && (
                    <div style={{ ...cd, marginBottom: 8 }}>
                      <div style={cT}>Runners in Scoring Position</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {rispDataLib.map(({ label, freq, total }) => (
                          <div key={label}>
                            {subLabel(label, total + " pitch" + (total !== 1 ? "es" : ""))}
                            <Bar data={mkB(freq, total)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Times Through Order in 2-col grid */}
                  <div style={{ ...cd, marginBottom: 8 }}>
                    <div style={cT}>Times Through Order</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {Object.entries(t.tto).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([k, ty]) => {
                        const tot = Object.values(ty).reduce((a, b) => a + b, 0);
                        return (
                          <div key={k}>
                            {subLabel(k === "1" ? "1st time" : k === "2" ? "2nd time" : k === "3" ? "3rd time" : k + "th time", tot)}
                            <Bar data={mkB(ty, tot)} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {rispDataLib.length === 0 && Object.keys(t.tto).length === 0 && (
                    <div style={{ ...cd, textAlign: "center", padding: 24 }}>
                      <div style={{ fontSize: 12, color: G.tx3 }}>Not enough situational data yet.</div>
                    </div>
                  )}
                </div>
              )}

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
