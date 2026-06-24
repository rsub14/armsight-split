function CountBD({ games, allGames, tier, activeGame, activePitcher, section = "pitching" }) {
  const lockedTeam = activeGame ? (activeGame.opponent || "Unknown").trim() : null;

  const scope = useScope(games, activeGame);
  const scopedGames = scope.scopedGames;
  const [filterTypes,   setFilterTypes]   = useState(() => new Set());
  const [filterCounts,  setFilterCounts]  = useState(() => new Set());
  const [filterSides,   setFilterSides]   = useState(() => new Set());
  const [filterHitters, setFilterHitters] = useState(() => new Set());
  const [filterSits,    setFilterSits]    = useState(() => new Set());
  const [filterOuts,    setFilterOuts]    = useState(() => new Set());
  const [filterEvents,  setFilterEvents]  = useState(() => new Set());
  const [filterBases,   setFilterBases]   = useState(() => new Set());
  const [showReads,     setShowReads]     = useState(true);
  const [filterTTOs,    setFilterTTOs]    = useState(() => new Set());
  const [filterResults, setFilterResults] = useState(() => new Set());
  const [showEvents,    setShowEvents]    = useState(false);
  const [showPickoffs,  setShowPickoffs]  = useState(false);
  const [showPrint,     setShowPrint]     = useState(false);


  // Generic multi-select toggle/clear helpers
  const tog = (setter) => (val) => setter(prev => {
    const next = new Set(prev); if (next.has(val)) next.delete(val); else next.add(val); return next;
  });
  const clr = (setter) => () => setter(new Set());
  const toggleType   = tog(setFilterTypes);
  const toggleCount  = tog(setFilterCounts);
  const toggleSide   = tog(setFilterSides);
  const toggleHitter = tog(setFilterHitters);
  const toggleSit    = tog(setFilterSits);
  const toggleOut    = tog(setFilterOuts);
  const toggleEvent  = tog(setFilterEvents);
  const toggleBase   = tog(setFilterBases);
  const toggleTTO    = tog(setFilterTTOs);
  const toggleResult = tog(setFilterResults);

  // Scope (Hand → Teams → Games → Pitchers) is owned by the shared <ScopeBar>.
  const pitcherSelected = (p, g) => scope.inScope(p, g);

  const clearAllFilters = () => {
    setFilterTypes(new Set());
    setFilterCounts(new Set());
    setFilterSides(new Set());
    setFilterHitters(new Set());
    setFilterSits(new Set());
    setFilterOuts(new Set());
    setFilterTTOs(new Set());
    setFilterResults(new Set());
  };

  const anyFilterActive = filterTypes.size > 0 || filterCounts.size > 0 || filterSides.size > 0 || filterHitters.size > 0 || filterSits.size > 0 || filterOuts.size > 0 || filterTTOs.size > 0 || filterResults.size > 0;

  const pitchPool = (() => {
    const all = [];
    scopedGames.forEach(g => g.pitches.forEach(p => {
      if (EVENTS.has(p.type)) return;
      if (pitcherSelected(p, g)) all.push(g.pregame ? { ...p, _pg: 1 } : p);
    }));
    return all;
  })();

  // rawPool includes events (SB, CS, WP, PB) — needed for preceding pitch lookup
  // Ordered chronologically matching the original game pitch log
  const rawPool = (() => {
    const all = [];
    scopedGames.forEach(g => g.pitches.forEach(p => {
      if (pitcherSelected(p, g)) all.push(g.pregame ? { ...p, _pg: 1 } : p);
    }));
    return all;
  })();

  // Pitcher list for all-games view (for backward compat with existing behavior)
  const pm = {};
  pitchPool.forEach(p => {
    const k = (p.pitcher || "Unknown").trim();
    if (!pm[k]) pm[k] = { name: k, pitches: [] };
    pm[k].pitches.push(p);
  });
  const ps = Object.values(pm).sort((a, b) => b.pitches.length - a.pitches.length);

  // Build hitter name map from lineups across all games
  const hitterNameMap = {};
  (allGames || games).forEach(g => {
    if (!g.lineup) return;
    g.lineup.forEach(slot => {
      if (slot.name && !hitterNameMap[slot.slot]) hitterNameMap[slot.slot] = { name: slot.name, hand: slot.hand || "R" };
      else if (slot.name && hitterNameMap[slot.slot] && !hitterNameMap[slot.slot].name) hitterNameMap[slot.slot].name = slot.name;
    });
  });

  // Build hitter list from batOrder values seen in pitch pool
  const seenOrders = [...new Set(pitchPool.filter(p => p.batOrder).map(p => p.batOrder))].sort((a, b) => a - b);
  const hitterList = seenOrders.map(slot => ({
    slot,
    name: hitterNameMap[slot]?.name || null,
    hand: hitterNameMap[slot]?.hand || "R",
    label: hitterNameMap[slot]?.name || `#${slot}`,
  }));
  const hasLineup = hitterList.length > 0;

  const allPitches    = pitchPool;
  const pitchTypesList = [...new Set(allPitches.map(p => p.type))].sort();

  // ── APPLY FILTERS ───────────────────────────────────────────────────────
  let filtered = allPitches;
  if (filterTypes.size > 0)   filtered = filtered.filter(p => filterTypes.has(p.type));
  if (filterCounts.size > 0)  filtered = filtered.filter(p => filterCounts.has(`${p.balls}-${p.strikes}`));
  if (filterSides.size > 0)   filtered = filtered.filter(p => filterSides.has(p.batSide));
  if (filterHitters.size > 0) filtered = filtered.filter(p => filterHitters.has(p.batOrder));
  if (filterSits.size > 0) {
    filtered = filtered.filter(p => {
      const r = p.runners || {};
      const f = !!r.first, s = !!r.second, t = !!r.third;
      const sitKey = !f && !s && !t ? "empty" : f && !s && !t ? "1" : !f && s && !t ? "2" : !f && !s && t ? "3" : f && s && !t ? "12" : f && !s && t ? "13" : !f && s && t ? "23" : "123";
      return filterSits.has(sitKey);
    });
  }
  if (filterOuts.size > 0)    filtered = filtered.filter(p => filterOuts.has(String(p.outs)));
  if (filterTTOs.size > 0)    filtered = filtered.filter(p => filterTTOs.has(String(p.timesThrough)));
  if (filterResults.size > 0) {
    filtered = filtered.filter(p => {
      if (p._pg) return false; // pregame results reflect a different lineup — never match a result filter
      if (filterResults.has("K")   && p.result === "K"   && p.strikes === 2) return true;
      if (filterResults.has("Kc")  && p.result === "Kc"  && p.strikes === 2) return true;
      if (filterResults.has("go")  && p.result === "go")  return true;
      if (filterResults.has("fo")  && p.result === "fo")  return true;
      if (filterResults.has("po")  && p.result === "po")  return true;
      if (filterResults.has("lo")  && p.result === "lo")  return true;
      if (filterResults.has("gdp") && p.result === "gdp") return true;
      if (filterResults.has("1b")  && p.result === "hit" && p.hitBases === 1) return true;
      if (filterResults.has("2b")  && p.result === "hit" && p.hitBases === 2) return true;
      if (filterResults.has("3b")  && p.result === "hit" && p.hitBases === 3) return true;
      if (filterResults.has("hr")  && p.result === "hit" && p.hitBases === 4) return true;
      if (filterResults.has("hbp") && p.result === "hbp") return true;
      return false;
    });
  }

  const total = filtered.length;
  const allZoneKeys = [...STRIKE_ZONES.map(z => z.k), ...BALL_ZONES.map(z => z.k)];
  const zoneCounts = {};
  allZoneKeys.forEach(k => { zoneCounts[k] = 0; });
  filtered.forEach(p => { if (p.location && zoneCounts[p.location] !== undefined) zoneCounts[p.location]++; });
  const maxZonePct = Math.max(...Object.values(zoneCounts).map(c => total > 0 ? (c / total) * 100 : 0), 1);

  const zoneColor = (count) => {
    if (count === 0 || total === 0) return "transparent";
    const pct = (count / total) * 100;
    const ratio = pct / maxZonePct;
    if (ratio > 0.65) return "rgba(255,50,50,0.5)";
    if (ratio > 0.35) return "rgba(255,180,0,0.45)";
    if (ratio > 0) return "rgba(50,130,255,0.35)";
    return "transparent";
  };

  const typeBreakdown = {};
  filtered.forEach(p => { typeBreakdown[p.type] = (typeBreakdown[p.type] || 0) + 1; });
  const typeBD = Object.entries(typeBreakdown).map(([t, c]) => ({ type: t, count: c, pct: +((c / total) * 100).toFixed(1) })).sort((a, b) => b.count - a.count);

  const countBreakdown = {};
  filtered.forEach(p => { const k = `${p.balls}-${p.strikes}`; if (!countBreakdown[k]) countBreakdown[k] = {}; countBreakdown[k][p.type] = (countBreakdown[k][p.type] || 0) + 1; });
  const counts = [];
  for (let b = 0; b <= 3; b++) for (let s = 0; s <= 2; s++) counts.push(`${b}-${s}`);

  const chipStyle = (active) => ({ padding: "6px 12px", borderRadius: 5, border: "none", background: active ? G.gold : G.sf2, color: active ? "#000" : G.tx2, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "'Anybody',sans-serif" });

  if (!games.length) return <div style={{ ...cd, textAlign: "center", padding: 50 }}><div style={{ fontSize: 16, fontWeight: 800, color: G.gold }}>No Data</div></div>;

  return (
    <div>
      {/* SCOPE (shared cascade) */}
      <div style={{ ...cd, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800 }}>TEAM</div>
          {lockedTeam && (
            <div style={{ fontSize: 10, color: G.gold, fontFamily: "'Azeret Mono',monospace", fontWeight: 700, background: G.gold + "18", padding: "2px 8px", borderRadius: 4, border: "1px solid " + G.gold + "44" }}>
              {lockedTeam} · Live Game
            </div>
          )}
        </div>
        {total > 0 && <button onClick={() => setShowPrint(true)}
          style={{ padding: "5px 12px", background: "transparent", border: "1px solid " + G.bd2, borderRadius: 6, color: G.tx3, fontSize: 10, fontWeight: 800, cursor: "pointer", fontFamily: "'Azeret Mono',monospace", letterSpacing: 1 }}>
          🖨 Print Report
        </button>}
      </div>
      <ScopeBar scope={scope} />

      {section !== "baserunning" && (<>
      {canAccess("zones", tier) && <div style={cd}>
        <div style={cT}>Filters</div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, marginBottom: 4 }}>
            PITCH TYPE
            {filterTypes.size > 0 && <span style={{ marginLeft: 8, fontSize: 9, color: G.gold, cursor: "pointer", fontWeight: 700 }} onClick={clr(setFilterTypes)}>Clear ({filterTypes.size})</span>}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button onClick={clr(setFilterTypes)} style={chipStyle(filterTypes.size === 0)}>All</button>
            {pitchTypesList.map(t => (
              <button key={t} onClick={() => toggleType(t)}
                style={{ ...chipStyle(filterTypes.has(t)), background: filterTypes.has(t) ? gPC(t) : G.sf2, color: filterTypes.has(t) ? "#000" : gPC(t), outline: filterTypes.has(t) ? "2px solid " + gPC(t) : "none", outlineOffset: 1 }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, marginBottom: 4 }}>
            COUNT
            {filterCounts.size > 0 && <span style={{ marginLeft: 8, fontSize: 9, color: G.gold, cursor: "pointer", fontWeight: 700 }} onClick={clr(setFilterCounts)}>Clear ({filterCounts.size})</span>}
            {filterCounts.size === 0 && <span style={{ marginLeft: 8, fontSize: 9, color: G.tx3, fontWeight: 400 }}>tap multiple to combine</span>}
          </div>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <button onClick={clr(setFilterCounts)} style={chipStyle(filterCounts.size === 0)}>All</button>
            {counts.map(c => (
              <button key={c} onClick={() => toggleCount(c)}
                style={{ ...chipStyle(filterCounts.has(c)), outline: filterCounts.has(c) ? "2px solid " + G.gold : "none", outlineOffset: 1 }}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, marginBottom: 4 }}>
            BATTER SIDE
            {filterSides.size > 0 && <span style={{ marginLeft: 8, fontSize: 9, color: G.gold, cursor: "pointer", fontWeight: 700 }} onClick={clr(setFilterSides)}>Clear</span>}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={clr(setFilterSides)} style={chipStyle(filterSides.size === 0)}>All</button>
            <button onClick={() => toggleSide("L")} style={{ ...chipStyle(filterSides.has("L")), outline: filterSides.has("L") ? "2px solid " + G.gold : "none", outlineOffset: 1 }}>vs LHB</button>
            <button onClick={() => toggleSide("R")} style={{ ...chipStyle(filterSides.has("R")), outline: filterSides.has("R") ? "2px solid " + G.gold : "none", outlineOffset: 1 }}>vs RHB</button>
          </div>
        </div>
        {hasLineup && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, marginBottom: 4 }}>
              HITTER
              {filterHitters.size > 0 && <span style={{ marginLeft: 8, fontSize: 9, color: G.gold, cursor: "pointer", fontWeight: 700 }} onClick={clr(setFilterHitters)}>Clear ({filterHitters.size})</span>}
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button onClick={clr(setFilterHitters)} style={chipStyle(filterHitters.size === 0)}>All</button>
              {hitterList.map(h => {
                const active = filterHitters.has(h.slot);
                return (
                  <button key={h.slot} onClick={() => toggleHitter(h.slot)}
                    style={{ ...chipStyle(active), outline: active ? "2px solid " + G.gold : "none", outlineOffset: 1 }}>
                    <span style={{ fontSize: 9, opacity: 0.6, marginRight: 3 }}>#{h.slot}</span>
                    {h.name || ""}
                    <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 3 }}>({h.hand})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, marginBottom: 4 }}>
            RUNNERS
            {filterSits.size > 0 && <span style={{ marginLeft: 8, fontSize: 9, color: G.gold, cursor: "pointer", fontWeight: 700 }} onClick={clr(setFilterSits)}>Clear ({filterSits.size})</span>}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button onClick={clr(setFilterSits)} style={{ ...chipStyle(filterSits.size === 0), fontSize: 11, padding: "5px 10px" }}>All</button>
            {[
              { key: "empty", label: "Empty" }, { key: "1", label: "1B" },
              { key: "2", label: "2B" }, { key: "3", label: "3B" },
              { key: "12", label: "1B+2B" }, { key: "13", label: "1B+3B" },
              { key: "23", label: "2B+3B" }, { key: "123", label: "Loaded" },
            ].map(sit => (
              <button key={sit.key} onClick={() => toggleSit(sit.key)}
                style={{ ...chipStyle(filterSits.has(sit.key)), fontSize: 11, padding: "5px 10px", outline: filterSits.has(sit.key) ? "2px solid " + G.gold : "none", outlineOffset: 1 }}>
                {sit.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, marginBottom: 4 }}>
            OUTS
            {filterOuts.size > 0 && <span style={{ marginLeft: 8, fontSize: 9, color: G.gold, cursor: "pointer", fontWeight: 700 }} onClick={clr(setFilterOuts)}>Clear ({filterOuts.size})</span>}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button onClick={clr(setFilterOuts)} style={{ ...chipStyle(filterOuts.size === 0), fontSize: 11, padding: "5px 10px" }}>All</button>
            {[{ key: "0", label: "0 Outs" }, { key: "1", label: "1 Out" }, { key: "2", label: "2 Outs" }].map(o => (
              <button key={o.key} onClick={() => toggleOut(o.key)}
                style={{ ...chipStyle(filterOuts.has(o.key)), fontSize: 11, padding: "5px 10px", outline: filterOuts.has(o.key) ? "2px solid " + G.gold : "none", outlineOffset: 1 }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, marginBottom: 4 }}>
            TIMES THROUGH ORDER
            {filterTTOs.size > 0 && <span style={{ marginLeft: 8, fontSize: 9, color: G.gold, cursor: "pointer", fontWeight: 700 }} onClick={clr(setFilterTTOs)}>Clear ({filterTTOs.size})</span>}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button onClick={clr(setFilterTTOs)} style={{ ...chipStyle(filterTTOs.size === 0), fontSize: 11, padding: "5px 10px" }}>All</button>
            {[{ key: "1", label: "1st Time" }, { key: "2", label: "2nd Time" }, { key: "3", label: "3rd Time" }, { key: "4", label: "4th Time" }].map(t => (
              <button key={t.key} onClick={() => toggleTTO(t.key)}
                style={{ ...chipStyle(filterTTOs.has(t.key)), fontSize: 11, padding: "5px 10px", outline: filterTTOs.has(t.key) ? "2px solid " + G.gold : "none", outlineOffset: 1 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, marginBottom: 6 }}>
            RESULT
            {filterResults.size > 0 && <span style={{ marginLeft: 8, fontSize: 9, color: G.gold, cursor: "pointer", fontWeight: 700 }} onClick={clr(setFilterResults)}>Clear ({filterResults.size})</span>}
            {filterResults.size === 0 && <span style={{ marginLeft: 8, fontSize: 9, color: G.tx3, fontWeight: 400 }}>tap multiple to combine</span>}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, width: "100%", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Strikeouts</div>
            {[{ key: "K", label: "K (Swinging)" }, { key: "Kc", label: "Kc (Looking)" }].map(r => (
              <button key={r.key} onClick={() => toggleResult(r.key)}
                style={{ ...chipStyle(filterResults.has(r.key)), fontSize: 11, padding: "5px 12px", outline: filterResults.has(r.key) ? "2px solid " + G.gold : "none", outlineOffset: 1 }}>
                {r.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, width: "100%", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Contact Outs</div>
            {[{ key: "go", label: "Groundout" }, { key: "fo", label: "Flyout" }, { key: "po", label: "Popup" }, { key: "lo", label: "Lineout" }, { key: "gdp", label: "GDP" }].map(r => (
              <button key={r.key} onClick={() => toggleResult(r.key)}
                style={{ ...chipStyle(filterResults.has(r.key)), fontSize: 11, padding: "5px 12px", outline: filterResults.has(r.key) ? "2px solid " + G.gold : "none", outlineOffset: 1 }}>
                {r.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, width: "100%", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Hits</div>
            {[{ key: "1b", label: "Single (1B)" }, { key: "2b", label: "Double (2B)" }, { key: "3b", label: "Triple (3B)" }, { key: "hr", label: "Home Run" }].map(r => (
              <button key={r.key} onClick={() => toggleResult(r.key)}
                style={{ ...chipStyle(filterResults.has(r.key)), fontSize: 11, padding: "5px 12px", outline: filterResults.has(r.key) ? "2px solid " + G.gold : "none", outlineOffset: 1 }}>
                {r.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, width: "100%", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Other</div>
            {[{ key: "hbp", label: "Hit By Pitch" }].map(r => (
              <button key={r.key} onClick={() => toggleResult(r.key)}
                style={{ ...chipStyle(filterResults.has(r.key)), fontSize: 11, padding: "5px 12px", outline: filterResults.has(r.key) ? "2px solid " + G.gold : "none", outlineOffset: 1 }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {anyFilterActive && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid " + G.bd }}>
            <button onClick={clearAllFilters}
              style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid " + G.gold + "66", background: "transparent", color: G.gold, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "'Anybody',sans-serif", letterSpacing: 1 }}>
              ✕ Clear All Filters
            </button>
          </div>
        )}
      </div>}

      <div style={{ ...cd, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: G.gold }}>{total}</div>
          <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Pitches</div>
        </div>
        {typeBD.length > 0 && (<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {typeBD.map(d => (<div key={d.type} style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: gPC(d.type) }}>{d.pct}%</div><div style={{ fontSize: 10, color: G.tx3, fontWeight: 700 }}>{d.type} ({d.count})</div></div>))}
        </div>)}
      </div>

      {showPrint && (
        <PrintReport
          type="situations"
          data={{
            team: scope.teams.size === 0 ? "All Teams" : Array.from(scope.teams).join(", "),
            pitcher: scope.pitchers.size === 0 ? "all" : (scope.pitchers.size === 1 ? ((scope.availablePitchers.find(tp => scope.pitchers.has(tp.key)) || {}).label || Array.from(scope.pitchers)[0]) : (scope.pitchers.size + " pitchers")),
            filters: {
              ...(filterTypes.size > 0 ? { "Pitch Type": filterTypes } : {}),
              ...(filterCounts.size > 0 ? { "Count": filterCounts } : {}),
              ...(filterSides.size > 0 ? { "Batter Side": new Set(Array.from(filterSides).map(s => s === "L" ? "LHB" : "RHB")) } : {}),
              ...(filterHitters.size > 0 ? { "Hitter": new Set(Array.from(filterHitters).map(slot => {
                const h = hitterList.find(h => h.slot === slot);
                return h ? h.label : ("#" + slot);
              })) } : {}),
              ...(filterSits.size > 0 ? { "Runners": new Set(Array.from(filterSits).map(s => ({ empty: "Empty", "1": "1B", "2": "2B", "3": "3B", "12": "1B+2B", "13": "1B+3B", "23": "2B+3B", "123": "Loaded" })[s] || s)) } : {}),
              ...(filterOuts.size > 0 ? { "Outs": new Set(Array.from(filterOuts).map(o => o + (o === "1" ? " out" : " outs"))) } : {}),
              ...(filterTTOs.size > 0 ? { "Times Through": new Set(Array.from(filterTTOs).map(t => t + (t==="1"?"st":t==="2"?"nd":t==="3"?"rd":"th") + " TTO")) } : {}),
              ...(filterResults.size > 0 ? { "Result": new Set(Array.from(filterResults).map(r => ({ K:"K (Swinging)", Kc:"Kc (Looking)", go:"Groundout", fo:"Flyout", po:"Popup", lo:"Lineout", gdp:"GDP", "1b":"Single", "2b":"Double", "3b":"Triple", hr:"Home Run", hbp:"HBP", sb:"Stolen Base", cs:"Caught Stealing", wp:"Wild Pitch", pb:"Passed Ball" })[r] || r)) } : {}),
            },
            filtered,
            total,
            zoneCounts,
            typeBD,
            countBreakdown,
          }}
          onClose={() => setShowPrint(false)}
        />
      )}

      {canAccess("zones", tier) ? <div style={cd}>
        <div style={cT}>Zone Heat Map {filterTypes.size > 0 ? "— " + Array.from(filterTypes).join("+") : ""}{filterCounts.size > 0 ? " @ " + Array.from(filterCounts).join("+") : ""}{filterSits.size > 0 ? " — " + Array.from(filterSits).join("+") : ""}</div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ display: "inline-grid", gridTemplateColumns: "28px repeat(3,44px) 28px", gridTemplateRows: "28px repeat(3,44px) 28px 28px", gap: 2 }}>
            {STRIKE_ZONES.map(z => {
              const count = zoneCounts[z.k] || 0;
              const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
              return (<div key={z.k} style={{ gridRow: z.r + 1, gridColumn: z.c + 1, background: zoneColor(count) !== "transparent" ? zoneColor(count) : G.sf2, color: count > 0 ? "#fff" : G.tx3, borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "2px solid " + G.bd, textAlign: "center" }}>
                <div style={{ fontSize: count > 0 ? 16 : 10, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{count > 0 ? pct + "%" : "-"}</div>
                {count > 0 && <div style={{ fontSize: 7, opacity: 0.7 }}>{count}</div>}
              </div>);
            })}
            {BALL_ZONES.map(z => {
              const count = zoneCounts[z.k] || 0;
              const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
              return (<div key={z.k} style={{ gridRow: `${z.r + 1} / span ${z.rowSpan}`, gridColumn: `${z.c + 1} / span ${z.colSpan}`, background: zoneColor(count) !== "transparent" ? zoneColor(count) : "#0d0d0d", color: count > 0 ? "#fff" : G.tx3, borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px dashed " + G.bd2, textAlign: "center" }}>
                {count > 0 ? (<><div style={{ fontSize: 13, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{pct}%</div><div style={{ fontSize: 7, opacity: 0.7 }}>{count}</div></>) : <div style={{ fontSize: 7 }}>{z.k === "dirt" ? "DIRT" : z.rL}</div>}
              </div>);
            })}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(255,50,50,0.5)" }} /><span style={{ fontSize: 10, color: G.tx3, fontWeight: 700 }}>Hot</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(255,180,0,0.45)" }} /><span style={{ fontSize: 10, color: G.tx3, fontWeight: 700 }}>Medium</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(50,130,255,0.35)" }} /><span style={{ fontSize: 10, color: G.tx3, fontWeight: 700 }}>Cold</span></div>
        </div>
      </div> : (
        <div style={{ ...cd, textAlign: "center", padding: "20px 12px", border: "1px solid " + G.bd }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: G.gold, marginBottom: 3 }}>🔒 Zone Heat Map</div>
          <div style={{ fontSize: 11, color: G.tx3, marginBottom: 6 }}>Upgrade to Pro to see pitch location heat maps and advanced filters.</div>
          <a href="mailto:coach@armsight.app" style={{ color: G.gold, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>Contact us to upgrade →</a>
        </div>
      )}

      {canAccess("zones", tier) && (() => {
        const dp = [];
        scopedGames.forEach(g => g.pitches.forEach(p => { if (!EVENTS.has(p.type) && pitcherSelected(p, g)) dp.push({ p, pts: g.pitchTypes || [] }); }));
        return dp.length ? <DiscBoard pool={dp} /> : null;
      })()}
      <div style={cd}>
        <div style={cT}>Count Breakdown</div>
        {counts.map(c => {
          const data = countBreakdown[c];
          if (!data) return null;
          const tot = Object.values(data).reduce((a, b) => a + b, 0);
          const bd = Object.entries(data).map(([t, n]) => ({ type: t, count: n, pct: +((n / tot) * 100).toFixed(0) })).sort((a, b) => b.pct - a.pct);
          return (<div key={c} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: G.gold }}>{c}</span>
              <span style={{ fontSize: 10, color: G.tx3, fontWeight: 700 }}>{tot} pitches</span>
            </div>
            <Bar data={bd} />
          </div>);
        })}
      </div>

      {(() => {
        // Ball / Strike totals — respects all active filters
        let strikes = 0, balls = 0, unknown = 0;
        filtered.forEach(p => {
          const r = inferBallStrike(p);
          if (r === "strike") strikes++;
          else if (r === "ball") balls++;
          else unknown++;
        });
        const bsTotal = strikes + balls;
        if (bsTotal === 0) return null;
        const sPct = Math.round((strikes / bsTotal) * 100);
        const bPct = Math.round((balls / bsTotal) * 100);
        return (
          <div style={cd}>
            <div style={cT}>Ball / Strike Totals{filterTypes.size > 0 ? " — " + Array.from(filterTypes).join("+") : ""}{filterSits.size > 0 ? " — " + Array.from(filterSits).join("+") : ""}{filterHitters.size > 0 ? " — #" + Array.from(filterHitters).join("+#") : ""}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Strikes", count: strikes, pct: sPct, color: G.gold },
                { label: "Balls",   count: balls,   pct: bPct, color: G.blu },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 62, fontSize: 12, fontWeight: 800, color: row.color, textAlign: "right", fontFamily: "'Azeret Mono',monospace" }}>{row.label}</div>
                  <div style={{ flex: 1, height: 28, background: G.sf2, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                    <div style={{ width: row.pct + "%", height: "100%", background: row.color + "99", borderRadius: 4, transition: "width 0.4s" }} />
                    <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: "#fff" }}>{row.pct}%</span>
                  </div>
                  <div style={{ width: 28, fontSize: 12, fontFamily: "'Azeret Mono',monospace", color: G.tx3, fontWeight: 700, textAlign: "right" }}>{row.count}</div>
                </div>
              ))}
              {unknown > 0 && <div style={{ fontSize: 10, color: G.tx3, fontStyle: "italic" }}>{unknown} pitch{unknown !== 1 ? "es" : ""} with no result recorded not included.</div>}
            </div>
          </div>
        );
      })()}

      {canAccess("zones", tier) ? (() => {
        // Sequence section — filtered by active hitter or shows aggregate
        const seqSource = filterHitters.size === 1
          ? allPitches.filter(p => filterHitters.has(p.batOrder))
          : allPitches;
        if (seqSource.length < 3) return null;

        const seqMap = {};
        for (let i = 1; i < seqSource.length; i++) {
          const prev = seqSource[i - 1];
          const curr = seqSource[i];
          if (!seqMap[prev.type]) seqMap[prev.type] = {};
          seqMap[prev.type][curr.type] = (seqMap[prev.type][curr.type] || 0) + 1;
        }

        const entries = Object.entries(seqMap).filter(([, nexts]) => Object.values(nexts).reduce((a,b)=>a+b,0) >= 2);
        if (!entries.length) return null;

        const hitterLabel = filterHitters.size > 0
          ? (hitterList.find(h => filterHitters.has(h.slot))?.label || "Selected Hitter")
          : "All Hitters";

        const confidence = seqSource.length >= 20 ? "Strong Pattern" : seqSource.length >= 10 ? "Pattern" : "Early Look";
        const confColor = seqSource.length >= 20 ? G.gold : seqSource.length >= 10 ? G.grn : G.tx3;

        return (
          <div style={cd}>
            <div style={cT}>Pitch Sequences — {hitterLabel}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: confColor, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>{confidence}</span>
              <span style={{ fontSize: 10, color: G.tx3 }}>— {seqSource.length} pitches</span>
            </div>
            {entries.sort((a, b) => Object.values(b[1]).reduce((x,y)=>x+y,0) - Object.values(a[1]).reduce((x,y)=>x+y,0)).map(([prevType, nexts]) => {
              const total = Object.values(nexts).reduce((a,b)=>a+b,0);
              const sorted = Object.entries(nexts).sort((a,b)=>b[1]-a[1]);
              return (
                <div key={prevType} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: G.tx3, fontWeight: 800, marginBottom: 6 }}>
                    After <span style={{ color: gPC(prevType), fontFamily: "'Azeret Mono',monospace" }}>{prevType}</span>
                    <span style={{ color: G.tx3, fontWeight: 400, marginLeft: 6 }}>({total} obs)</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {sorted.map(([nextType, count]) => {
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={nextType} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 36, fontSize: 12, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: gPC(nextType), textAlign: "right" }}>{nextType}</div>
                          <div style={{ flex: 1, height: 22, background: G.sf2, borderRadius: 3, overflow: "hidden", position: "relative" }}>
                            <div style={{ width: pct + "%", height: "100%", background: gPC(nextType) + "88", borderRadius: 3 }} />
                            <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: "#fff" }}>{pct}%</span>
                          </div>
                          <div style={{ width: 20, fontSize: 11, fontFamily: "'Azeret Mono',monospace", color: G.tx3, textAlign: "right" }}>{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })() : (
        <div style={{ ...cd, textAlign: "center", padding: "20px 12px", border: "1px solid " + G.bd }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: G.gold, marginBottom: 3 }}>🔒 Pitch Sequences</div>
          <div style={{ fontSize: 11, color: G.tx3, marginBottom: 6 }}>Upgrade to Pro to unlock pitch sequencing analysis.</div>
          <a href="mailto:coach@armsight.app" style={{ color: G.gold, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>Contact us to upgrade →</a>
        </div>
      )}
      {/* ── EVENTS SECTION — SB, CS, WP, PB preceded by which pitch ── */}
      </>)}
      {section !== "pitching" && (<>
        {/* Pitcher-read guidance — shows only when no read data exists yet */}
        {(() => {
          const allBR = scopedGames.flatMap(g => g.pitches.filter(p => p.brRead && scope.inScope(p, g)));
          if (allBR.length === 0) {
            return (
              <div style={{ ...cd, textAlign: "center", padding: 24 }}>
                <div style={{ fontSize: 13, color: G.tx3, marginBottom: 8 }}>No pitcher read data yet.</div>
                <div style={{ fontSize: 11, color: G.tx3, lineHeight: 1.7 }}>
                  During a game with a runner on 1B or 2B, tap <span style={{ color: G.gold, fontWeight: 800 }}>👁 Read</span> on the Chart tab to log pitcher tendencies. Data will appear here automatically.
                </div>
              </div>
            );
          }
          return null;
        })()}
        {rawPool.some(p => ["SB", "CS", "WP", "PB"].includes(p.type) && !p._pg) && (() => {
          const evMeta = ["SB", "CS", "WP", "PB"];
          const baseMeta = ["2B", "3B", "Home"];
          const outMeta = [{ k: "0", label: "0 Outs" }, { k: "1", label: "1 Out" }, { k: "2", label: "2 Outs" }];
          const active = filterEvents.size > 0 || filterBases.size > 0 || filterCounts.size > 0 || filterOuts.size > 0;
          const row = (label, kids) => (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{kids}</div>
            </div>
          );
          const chip = (key, on, onClick, label) => (
            <button key={key} onClick={onClick} style={{ ...chipStyle(on), fontSize: 11, padding: "5px 10px", outline: on ? "2px solid " + G.gold : "none", outlineOffset: 1 }}>{label}</button>
          );
          return (
            <div style={{ ...cd, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 1 }}>FILTER <span style={{ color: G.tx3, fontWeight: 400, fontSize: 9 }}>· tap multiple to narrow</span></div>
                {active && <span onClick={() => { setFilterEvents(new Set()); setFilterBases(new Set()); setFilterCounts(new Set()); setFilterOuts(new Set()); }} style={{ fontSize: 9, color: G.gold, cursor: "pointer", fontWeight: 700 }}>Clear all</span>}
              </div>
              {row("Event", <>
                <button onClick={() => setFilterEvents(new Set())} style={{ ...chipStyle(filterEvents.size === 0), fontSize: 11, padding: "5px 10px" }}>All</button>
                {evMeta.map(e => chip(e, filterEvents.has(e), () => toggleEvent(e), e))}
              </>)}
              {row("Base reached", <>
                <button onClick={() => setFilterBases(new Set())} style={{ ...chipStyle(filterBases.size === 0), fontSize: 11, padding: "5px 10px" }}>All</button>
                {baseMeta.map(b => chip(b, filterBases.has(b), () => toggleBase(b), b))}
              </>)}
              {row("Count", <>
                <button onClick={() => setFilterCounts(new Set())} style={{ ...chipStyle(filterCounts.size === 0), fontSize: 11, padding: "5px 10px" }}>All</button>
                {counts.map(c => chip(c, filterCounts.has(c), () => toggleCount(c), c))}
              </>)}
              {row("Outs", <>
                <button onClick={() => setFilterOuts(new Set())} style={{ ...chipStyle(filterOuts.size === 0), fontSize: 11, padding: "5px 10px" }}>All</button>
                {outMeta.map(o => chip(o.k, filterOuts.has(o.k), () => toggleOut(o.k), o.label))}
              </>)}
            </div>
          );
        })()}
      {(() => {
        const eventTypes = ["SB", "CS", "WP", "PB"];
        const eventLabels = { SB: "Stolen Bases", CS: "Caught Stealing", WP: "Wild Pitches", PB: "Passed Balls" };
        const eventColors = { SB: G.grn, CS: "#ff4444", WP: "#ff9933", PB: "#ff9933" };
        const destMap = { first: "2B", second: "3B", third: "Home" };
        const basesOf = (ev) => {
          if (ev.bases && ev.bases.length) return ev.bases;
          const on = ev.runners ? ["first", "second", "third"].filter(b => ev.runners[b]) : [];
          return on.length === 1 ? [destMap[on[0]]] : [];
        };
        const precedingOf = (ev) => {
          const idx = rawPool.findIndex(p => p.id === ev.id);
          for (let i = idx - 1; i >= 0; i--) { if (!EVENTS.has(rawPool[i].type)) return rawPool[i]; }
          return null;
        };
        const shownTypes = eventTypes.filter(t => filterEvents.size === 0 || filterEvents.has(t));
        const eventData = shownTypes.map(evType => {
          let rows = rawPool.filter(p => p.type === evType && !p._pg).map(ev => ({ ev, pp: precedingOf(ev), bases: basesOf(ev) }));
          if (filterBases.size > 0) rows = rows.filter(r => r.bases.some(b => filterBases.has(b)));
          if (filterCounts.size > 0) rows = rows.filter(r => r.pp && filterCounts.has(r.pp.balls + "-" + r.pp.strikes));
          if (filterOuts.size > 0) rows = rows.filter(r => r.pp && filterOuts.has(String(r.pp.outs)));
          if (rows.length === 0) return null;
          const typeFreq = {};
          let matched = 0;
          rows.forEach(r => { if (r.pp) { typeFreq[r.pp.type] = (typeFreq[r.pp.type] || 0) + 1; matched++; } });
          const typeMix = Object.entries(typeFreq).map(([type, count]) => ({ type, count, pct: Math.round((count / (matched || 1)) * 100) })).sort((a, b) => b.count - a.count);
          return { evType, label: eventLabels[evType], color: eventColors[evType], total: rows.length, typeMix };
        }).filter(Boolean);

        return eventData.length === 0 ? null : (
          <div style={cd}>
            <div style={cT}>Events <span style={{ color: G.tx3, fontWeight: 400, fontSize: 11 }}>· on the preceding pitch</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
              {eventData.map(({ evType, label, color, total: evTotal, typeMix }) => (
                <div key={evType} style={{ background: G.sf2, borderRadius: 8, padding: 12, border: "1px solid " + color + "33" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color, marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>
                    {label} <span style={{ color: G.tx3, fontWeight: 400, fontSize: 10 }}>({evTotal})</span>
                  </div>
                  {typeMix.length === 0 ? <div style={{ fontSize: 10, color: G.tx3, fontStyle: "italic" }}>no pitch logged</div> : typeMix.map(({ type, count, pct }) => (
                    <div key={type} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 28, fontSize: 10, fontWeight: 800, color: gPC(type), textAlign: "right", flexShrink: 0 }}>{type}</div>
                      <div style={{ flex: 1, height: 10, background: G.bd, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: pct + "%", height: "100%", background: gPC(type), borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 10, color: G.tx3, width: 36, textAlign: "right", flexShrink: 0 }}>{pct}% ({count})</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── PICKOFFS SECTION — attempts by count and base, with safe/out/error ── */}
      {(() => {
        const PK_TYPES = { "PKO": true, "PK": true, "PK-E": true };
        const pks = rawPool.filter(p => PK_TYPES[p.type] && !p._pg);
        const outcomeOf = (p) => p.type === "PK-E" ? "error" : (p.type === "PKO" || p.pkoOut || p.result === "pk-out") ? "out" : "safe";
        const baseLabel = { first: "1B", second: "2B", third: "3B", none: "—" };

        let tOut = 0, tSafe = 0, tErr = 0;
        pks.forEach(p => { const o = outcomeOf(p); if (o === "out") tOut++; else if (o === "safe") tSafe++; else tErr++; });

        const byCount = {};
        pks.forEach(p => {
          const k = p.balls + "-" + p.strikes;
          if (!byCount[k]) byCount[k] = { key: k, total: 0, out: 0, safe: 0, error: 0 };
          byCount[k].total++; byCount[k][outcomeOf(p)]++;
        });
        const countRows = Object.keys(byCount).map(k => byCount[k]).sort((a, b) => b.total - a.total);

        const byBase = {};
        pks.forEach(p => {
          const b = p.pkoBase || "none";
          if (!byBase[b]) byBase[b] = { key: b, total: 0, out: 0, safe: 0, error: 0 };
          byBase[b].total++; byBase[b][outcomeOf(p)]++;
        });
        const baseRows = ["first", "second", "third", "none"].filter(b => byBase[b]).map(b => byBase[b]);

        const thS = { fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", padding: "6px 8px", textAlign: "center" };
        const tdS = { fontSize: 13, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: "#fff", padding: "6px 8px", textAlign: "center" };
        const sumCell = (val, label, color, bg, bd) => (
          <div style={{ background: bg, border: "1px solid " + bd, borderRadius: 6, padding: "6px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: color }}>{val}</div>
            <div style={{ fontSize: 9, color: G.tx3, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
          </div>
        );
        const mkTable = (label, rows, firstColLabel, labelOf) => (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid " + G.bd }}>
                    <th style={{ ...thS, textAlign: "left" }}>{firstColLabel}</th>
                    <th style={thS}>Pickoffs</th>
                    <th style={thS}>Out</th>
                    <th style={thS}>Safe</th>
                    <th style={thS}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.key} style={{ borderBottom: "1px solid " + G.bd2 }}>
                      <td style={{ ...tdS, textAlign: "left", color: G.gold }}>{labelOf(r)}</td>
                      <td style={tdS}>{r.total}</td>
                      <td style={{ ...tdS, color: r.out ? "#ffd700" : G.tx3 }}>{r.out}</td>
                      <td style={{ ...tdS, color: r.safe ? G.tx2 : G.tx3 }}>{r.safe}</td>
                      <td style={{ ...tdS, color: r.error ? "#ff6600" : G.tx3 }}>{r.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

        return pks.length === 0 ? null : !canAccess("pickoffs", tier) ? (
          <div style={{ ...cd, textAlign: "center", padding: "20px 12px", border: "1px solid " + G.bd }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: G.gold, marginBottom: 3 }}>🔒 Pickoffs</div>
            <div style={{ fontSize: 11, color: G.tx3, marginBottom: 6 }}>Upgrade to Pro to unlock pickoff tendencies.</div>
            <a href="mailto:coach@armsight.app" style={{ color: G.gold, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>Contact us to upgrade →</a>
          </div>
        ) : (
          <div style={cd}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={cT}>Pickoffs <span style={{ color: G.tx3, fontWeight: 400, fontSize: 11 }}>({pks.length})</span></div>
            </div>
            {(
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  {sumCell(tOut, "Out", "#ffd700", "#ffd70020", "#ffd70044")}
                  {sumCell(tSafe, "Safe", G.tx2, G.sf2, G.bd)}
                  {sumCell(tErr, "Error", "#ff6600", "#ff660020", "#ff660044")}
                </div>
                {mkTable("By Count", countRows, "Count", r => r.key)}
                {mkTable("By Base", baseRows, "Base", r => baseLabel[r.key] || r.key)}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── PITCHER READS — collapsible group (2B + 1B) ── */}
      {scopedGames.some(g => g.pitches.some(p => scope.inScope(p, g) && p.brRead && (p.brRead.looks2B != null || p.brRead.move2B || p.brRead.move1B || p.brRead.step1B || p.brRead.handPos1B))) && (
        <div onClick={() => setShowReads(s => !s)} style={{ ...cd, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: 8, borderLeft: "3px solid " + G.gold }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: G.gold, letterSpacing: 0.5 }}>👁 Pitcher Reads</div>
          <span style={{ fontSize: 11, color: G.tx3, fontFamily: "'Azeret Mono',monospace" }}>{showReads ? "▲ hide" : "▼ show"}</span>
        </div>
      )}
      {/* ── 2B LOOK COUNT CARD ── */}
      {(() => {
        if (!showReads) return null;
        const brPool = scopedGames.flatMap(g => g.pitches.filter(p => p.brRead && scope.inScope(p, g)));
        const pitchesWithLooks = brPool.filter(p => p.brRead.looks2B !== null && p.brRead.looks2B !== undefined);
        const pitchesWithMove2B = brPool.filter(p => p.brRead.move2B);
        if (pitchesWithLooks.length === 0 && pitchesWithMove2B.length === 0) return null;
        let rows = pitchesWithLooks;
        if (filterCounts.size > 0) rows = rows.filter(p => filterCounts.has(p.balls + "-" + p.strikes));
        if (filterOuts.size > 0) rows = rows.filter(p => filterOuts.has(String(p.outs)));
        let move2BRows = pitchesWithMove2B;
        if (filterCounts.size > 0) move2BRows = move2BRows.filter(p => filterCounts.has(p.balls + "-" + p.strikes));
        if (filterOuts.size > 0) move2BRows = move2BRows.filter(p => filterOuts.has(String(p.outs)));
        const freq = { 0: 0, 1: 0, 2: 0, 3: 0 };
        rows.forEach(p => { const l = Math.min(p.brRead.looks2B, 3); freq[l]++; });
        const total = rows.length;
        const labels = { 0: "0 Looks", 1: "1 Look", 2: "2 Looks", 3: "3+" };
        const move2BFreq = { inside: 0, spin: 0 };
        move2BRows.forEach(p => { if (move2BFreq[p.brRead.move2B] !== undefined) move2BFreq[p.brRead.move2B]++; });
        return (
          <div style={cd}>
            <div style={cT}>2B — Pitcher Read</div>
            {total > 0 && (<>
              <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, marginTop: 10 }}>Look Count ({total})</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {[0, 1, 2, 3].map(n => {
                  const cnt = freq[n];
                  const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
                  return (
                    <div key={n} style={{ background: G.sf2, border: "1px solid " + G.gold + "33", borderRadius: 8, padding: "10px 16px", textAlign: "center", minWidth: 70 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: G.tx3 }}>{labels[n]}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: G.gold, fontFamily: "'Azeret Mono',monospace", marginTop: 4 }}>{pct}%</div>
                      <div style={{ fontSize: 10, color: G.tx3, marginTop: 2 }}>{cnt}x</div>
                    </div>
                  );
                })}
              </div>
            </>)}
            {move2BRows.length > 0 && (<>
              <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Move Type ({move2BRows.length})</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[{ k: "inside", l: "Inside" }, { k: "spin", l: "Spin" }].map(m => {
                  const cnt = move2BFreq[m.k];
                  const pct = move2BRows.length > 0 ? Math.round((cnt / move2BRows.length) * 100) : 0;
                  return (
                    <div key={m.k} style={{ background: G.sf2, border: "1px solid " + G.gold + "33", borderRadius: 8, padding: "10px 16px", textAlign: "center", minWidth: 90 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: G.tx3 }}>{m.l}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: G.gold, fontFamily: "'Azeret Mono',monospace", marginTop: 4 }}>{pct}%</div>
                      <div style={{ fontSize: 10, color: G.tx3, marginTop: 2 }}>{cnt}x</div>
                    </div>
                  );
                })}
              </div>
            </>)}
          </div>
        );
      })()}

      {/* ── 1B PITCHER TENDENCIES CARD ── */}
      {(() => {
        if (!showReads) return null;
        const brPool1B = scopedGames.flatMap(g => g.pitches.filter(p => scope.inScope(p, g) && p.brRead && (p.brRead.move1B || p.brRead.step1B || p.brRead.handPos1B)));
        if (brPool1B.length === 0) return null;
        let rows = brPool1B;
        if (filterCounts.size > 0) rows = rows.filter(p => filterCounts.has(p.balls + "-" + p.strikes));
        if (filterOuts.size > 0) rows = rows.filter(p => filterOuts.has(String(p.outs)));
        if (rows.length === 0) return null;
        // Pickoff cross-reference uses all scoped games
        const pks = scopedGames.flatMap(g => g.pitches.filter(p => scope.inScope(p, g) && (p.type === "PK" || p.type === "PKO" || p.type === "PK-E") && p.brRead && (p.brRead.move1B || p.brRead.step1B)));

        // Move type distribution
        const moveFreq = { quick: 0, best: 0, show: 0 };
        const moveTotal = rows.filter(p => p.brRead.move1B).length;
        rows.forEach(p => { if (p.brRead.move1B) moveFreq[p.brRead.move1B]++; });

        // Step distribution
        const stepFreq = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const stepTotal = rows.filter(p => p.brRead.step1B).length;
        rows.forEach(p => { if (p.brRead.step1B) stepFreq[p.brRead.step1B]++; });

        // Hand position distribution
        const handFreq = { high: 0, mid: 0, low: 0 };
        const handTotal = rows.filter(p => p.brRead.handPos1B).length;
        rows.forEach(p => { if (p.brRead.handPos1B) handFreq[p.brRead.handPos1B]++; });
        const pkMoveFreq = {}; pks.forEach(p => { if (p.brRead.move1B) pkMoveFreq[p.brRead.move1B] = (pkMoveFreq[p.brRead.move1B] || 0) + 1; });
        const pkStepFreq = {}; pks.forEach(p => { if (p.brRead.step1B) pkStepFreq[p.brRead.step1B] = (pkStepFreq[p.brRead.step1B] || 0) + 1; });

        const barRow = (label, count, total, color) => total === 0 ? null : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <div style={{ width: 48, fontSize: 11, fontWeight: 800, color, textAlign: "right", flexShrink: 0 }}>{label}</div>
            <div style={{ flex: 1, height: 12, background: G.bd, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: Math.round((count / total) * 100) + "%", height: "100%", background: color, borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 10, color: G.tx3, width: 52, textAlign: "right", flexShrink: 0 }}>{Math.round((count / total) * 100)}% ({count})</div>
          </div>
        );

        return (
          <div style={cd}>
            <div style={cT}>1B — Pitcher Tendencies</div>
            {moveTotal > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Move Type ({moveTotal})</div>
                {barRow("Quick", moveFreq.quick, moveTotal, "#ff4444")}
                {barRow("Best", moveFreq.best, moveTotal, G.gold)}
                {barRow("Show", moveFreq.show, moveTotal, G.tx3)}
              </div>
            )}
            {stepTotal > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Step Reached ({stepTotal})</div>
                {[1, 2, 3, 4].map(n => barRow(String(n), stepFreq[n], stepTotal, G.gold))}
              </div>
            )}
            {handTotal > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Hand Position ({handTotal})</div>
                {barRow("High", handFreq.high, handTotal, "#ff9933")}
                {barRow("Mid", handFreq.mid, handTotal, G.gold)}
                {barRow("Low", handFreq.low, handTotal, G.blu)}
              </div>
            )}
            {pks.length > 0 && (
              <div>
                <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>On Pickoff Attempts ({pks.length})</div>
                {Object.entries(pkMoveFreq).length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                    {Object.entries(pkMoveFreq).sort((a,b) => b[1]-a[1]).map(([m, c]) => (
                      <div key={m} style={{ background: G.sf2, border: "1px solid " + G.gold + "33", borderRadius: 6, padding: "5px 10px", textAlign: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: G.gold, textTransform: "capitalize" }}>{m}</div>
                        <div style={{ fontSize: 10, color: G.tx3 }}>{c}x</div>
                      </div>
                    ))}
                  </div>
                )}
                {Object.entries(pkStepFreq).length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {Object.entries(pkStepFreq).sort((a,b) => parseInt(a[0])-parseInt(b[0])).map(([s, c]) => (
                      <div key={s} style={{ background: G.sf2, border: "1px solid " + G.gold + "33", borderRadius: 6, padding: "5px 10px", textAlign: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: G.gold }}>Step {s}</div>
                        <div style={{ fontSize: 10, color: G.tx3 }}>{c}x</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      </>)}
    </div>
  );
}
