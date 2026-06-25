function ScopeBar({ scope }) {
  const { hand, setHand, teams, setTeams, gameIds, setGameIds, pitchers, setPitchers,
          allTeams, teamGames, multiGame, availablePitchers,
          source, setSource, lockSource, liveCount, pregameCount, hasPregame } = scope;

  const tog = (setter, key) => setter(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });
  const chip = (label, active, onClick) => (
    <button key={label} onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 5,
      border: "1px solid " + (active ? G.gold : G.bd2),
      cursor: "pointer",
      background: active ? G.gold : "transparent",
      color: active ? "#000" : G.tx2,
      fontSize: 11, fontWeight: active ? 800 : 600, fontFamily: "'Anybody',sans-serif",
    }}>{label}</button>
  );
  const srow = (label, count, onClear, children) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase" }}>{label}</div>
        {count > 0 && <span style={{ fontSize: 10, color: G.gold, cursor: "pointer", fontWeight: 700 }} onClick={onClear}>Clear ({count})</span>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
  const fmtDate = (d) => {
    if (!d) return "No date";
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? String(d) : (dt.getMonth() + 1) + "/" + dt.getDate();
  };
  const showOpp = teams.size !== 1;

  return (
    <div style={cd}>
      <div style={cT}>Scope</div>

      {srow("Pitcher Hand", 0, null, ["all", "R", "L"].map(h =>
        chip(h === "all" ? "All" : h === "R" ? "vs RHP" : "vs LHP", hand === h, () => setHand(h))
      ))}

      {hasPregame && !lockSource && srow("Data Source", 0, null, [
        chip("All (" + (liveCount + pregameCount) + ")", source === "all", () => setSource("all")),
        chip("Live (" + liveCount + ")", source === "live", () => setSource("live")),
        chip("Pregame (" + pregameCount + ")", source === "pregame", () => setSource("pregame")),
      ])}

      {allTeams.length > 0 && srow("Teams", teams.size, () => setTeams(new Set()),
        allTeams.map(t => chip(t, teams.has(t), () => tog(setTeams, t)))
      )}

      {multiGame && srow("Games", gameIds.size, () => setGameIds(new Set()),
        [...teamGames].sort((a, b) => new Date(b.date) - new Date(a.date)).map(g =>
          chip((showOpp ? (g.opponent || "?") + " " : "") + fmtDate(g.date), gameIds.has(g.id), () => tog(setGameIds, g.id))
        )
      )}

      {availablePitchers.length > 0 && srow("Pitchers", pitchers.size, () => setPitchers(new Set()),
        availablePitchers.map(p => chip(p.label + (p.hand ? " (" + p.hand + ")" : ""), pitchers.has(p.key), () => tog(setPitchers, p.key)))
      )}
    </div>
  );
}
