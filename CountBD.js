function CountBD({ games, allGames, tier, activeGame, activePitcher, section = "pitching", roster = [] }) {
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
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [selectedHitter, setSelectedHitter] = useState("");


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
      if (pitcherSelected(p, g)) all.push(g.pregame ? { ...p, _pg: 1, _gid: g.id } : { ...p, _gid: g.id });
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

  // ── HITTER LIST BY PLAYER IDENTITY (roster players + anyone seen in games) ──
  // Each entry is keyed by a stable player key: rosterId when known, else the name.
  // The filter matches a pitch to a player by the rosterId/batterName stamped at log time
  // (new pitches), falling back to the game-lineup slot->name lookup for older named games.
  const playerKeyOf = (rid, nm) => rid != null ? "rid:" + rid : (nm ? "nm:" + nm.trim().toLowerCase() : null);

  // Resolve a name for a pitch's batter: prefer stamped batterName, else look up the
  // pitch's game lineup by batOrder. (Used both to build the list and to filter.)
  const gameById = {};
  (allGames || games).forEach(g => { gameById[g.id] = g; });
  const pitchPlayer = (p) => {
    if (p.rosterId != null || p.batterName) {
      const nm = p.batterName || ((roster || []).find(rp => String(rp.id) === String(p.rosterId)) || {}).name || null;
      return { key: playerKeyOf(p.rosterId, nm), name: nm, rosterId: p.rosterId != null ? p.rosterId : null };
    }
    // Fallback: older pitch with only batOrder — resolve via that game's lineup
    const g = p._gid != null ? gameById[p._gid] : null;
    return { key: null, name: null, rosterId: null, slot: p.batOrder || null };
  };

  // Build the dropdown options: start from the team roster, then add anyone seen in scoped games.
  const playerMap = {};
  (roster || []).forEach(rp => {
    const key = playerKeyOf(rp.id, rp.name);
    if (key) playerMap[key] = { key, name: rp.name || ("#" + (rp.num || "?")), rosterId: rp.id, num: rp.num || null };
  });
  // Names seen in games — from stamped pitches first, then from lineups (named slots)
  pitchPool.forEach(p => {
    if (p.rosterId != null || p.batterName) {
      const nm = p.batterName || ((roster || []).find(rp => String(rp.id) === String(p.rosterId)) || {}).name || null;
      const key = playerKeyOf(p.rosterId, nm);
      if (key && !playerMap[key]) playerMap[key] = { key, name: nm || "(unknown)", rosterId: p.rosterId != null ? p.rosterId : null };
    }
  });
  scopedGames.forEach(g => {
    if (!g.lineup) return;
    g.lineup.forEach(slot => {
      if (!slot.name) return;
      const key = playerKeyOf(slot.rosterId != null ? slot.rosterId : null, slot.name);
      if (key && !playerMap[key]) playerMap[key] = { key, name: slot.name, rosterId: slot.rosterId != null ? slot.rosterId : null, num: slot.num || null };
    });
  });
  const hitterList = Object.values(playerMap).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const hasLineup = hitterList.length > 0;

  // Set of player keys a pitch can be matched against (for the filter)
  const pitchPlayerKeys = (p) => {
    const keys = new Set();
    if (p.rosterId != null) keys.add("rid:" + p.rosterId);
    if (p.batterName) keys.add("nm:" + p.batterName.trim().toLowerCase());
    // Fallback for older pitches: resolve name via this game's lineup slot
    if (p.rosterId == null && !p.batterName && p.batOrder != null && p._gid != null) {
      const g = gameById[p._gid];
      const slot = g && g.lineup ? g.lineup.find(s => s.slot === p.batOrder) : null;
      if (slot) {
        if (slot.rosterId != null) keys.add("rid:" + slot.rosterId);
        if (slot.name) keys.add("nm:" + slot.name.trim().toLowerCase());
      }
    }
    return keys;
  };

  const allPitches    = pitchPool;
  const pitchTypesList = [...new Set(allPitches.map(p => p.type))].sort();

  // ── APPLY FILTERS ───────────────────────────────────────────────────────
  let filtered = allPitches;
  if (filterTypes.size > 0)   filtered = filtered.filter(p => filterTypes.has(p.type));
  if (filterCounts.size > 0)  filtered = filtered.filter(p => filterCounts.has(`${p.balls}-${p.strikes}`));
  if (filterSides.size > 0)   filtered = filtered.filter(p => filterSides.has(p.batSide));
  if (filterHitters.size > 0) filtered = filtered.filter(p => { const keys = pitchPlayerKeys(p); for (const k of keys) if (filterHitters.has(k)) return true; return false; });
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

  const chipStyle = (active) => ({ padding: "5px 10px", borderRadius: 5, border: "none", background: active ? G.gold : G.sf2, color: active ? "#000" : G.tx2, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "'Anybody',sans-serif" });
  const selStyle = { background: G.sf2, color: G.tx, border: "1px solid " + G.bd2, borderRadius: 5, padding: "5px 8px", fontSize: 11, fontFamily: "'Anybody',sans-serif", fontWeight: 700 };

  // Count grid helper — clickable count cells
  const countGrid = () => {
    const rows = [
      ["0-0", "0-1", "0-2"],
      ["1-0", "1-1", "1-2"],
      ["2-0", "2-1", "2-2"],
      ["3-0", "3-1", "3-2"],
    ];
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
        {rows.flat().map(c => {
          const active = filterCounts.has(c);
          const totalInCount = filtered.filter(p => `${p.balls}-${p.strikes}` === c).length;
          const countData = countBreakdown[c];
          const topPitch = countData ? Object.entries(countData).sort((a,b) => b[1]-a[1])[0] : null;
          return (
            <button key={c} onClick={() => toggleCount(c)}
              style={{ padding: "6px 4px", borderRadius: 4, border: "none", background: active ? G.gold : G.sf2, color: active ? "#000" : G.tx2, cursor: "pointer", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{c}</div>
              {topPitch && <div style={{ fontSize: 9, opacity: 0.8 }}>{topPitch[0]} {Math.round(topPitch[1]/totalInCount*100)}%</div>}
            </button>
          );
        })}
      </div>
    );
  };

  // Clickable base diamond for runners filter
  const baseDiamond = () => {
    const pos = { second: [0.5, 0.08], third: [0.08, 0.5], first: [0.92, 0.5] };
    const ds = 44;
    const toggleBaseFilter = (baseKey) => {
      const sitMap = { first: ["1", "12", "13", "123"], second: ["2", "12", "23", "123"], third: ["3", "13", "23", "123"] };
      const keys = sitMap[baseKey];
      if (!keys) return;
      const hasAny = keys.some(k => filterSits.has(k));
      if (hasAny) {
        setFilterSits(prev => { const n = new Set(prev); keys.forEach(k => n.delete(k)); return n; });
      } else {
        setFilterSits(prev => { const n = new Set(prev); keys.forEach(k => n.add(k)); return n; });
      }
    };
    const isOn = (baseKey) => {
      const sitMap = { first: ["1", "12", "13", "123"], second: ["2", "12", "23", "123"], third: ["3", "13", "23", "123"] };
      return sitMap[baseKey].some(k => filterSits.has(k));
    };
    return (
      <div style={{ width: ds, height: ds, position: "relative", marginBottom: 8 }}>
        <svg width={ds} height={ds} viewBox="0 0 100 100" style={{ position: "absolute" }}>
          <polygon points="50,15 85,50 50,85 15,50" fill="none" stroke={G.bd2} strokeWidth={3} />
        </svg>
        {["second", "third", "first"].map(b => {
          const [fx, fy] = pos[b];
          const on = isOn(b);
          return (
            <div key={b} onClick={() => toggleBaseFilter(b)}
              style={{
                position: "absolute", left: `${fx * 100}%`, top: `${fy * 100}%`,
                transform: "translate(-50%,-50%) rotate(45deg)",
                width: 14, height: 14, borderRadius: 2, cursor: "pointer",
                background: on ? G.gold : "transparent",
                border: `2px solid ${on ? G.gold : G.bd2}`,
              }} />
          );
        })}
      </div>
    );
  };

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
          Print Report
        </button>}
      </div>
      <ScopeBar scope={scope} />

      {section !== "baserunning" && (<>
      {/* ── UNIFIED CARD: Heat Map + Stats + Quick Filters ── */}
      {canAccess("zones", tier) && <div style={{ ...cd, marginBottom: 8 }}>
        {/* Top row: Quick filters inline */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {/* Pitch Type buttons */}
            {pitchTypesList.slice(0, 5).map(t => (
              <button key={t} onClick={() => toggleType(t)}
                style={{ ...chipStyle(filterTypes.has(t)), background: filterTypes.has(t) ? gPC(t) : G.sf2, color: filterTypes.has(t) ? "#000" : gPC(t), padding: "4px 8px", fontSize: 10 }}>
                {t}
              </button>
            ))}
            {pitchTypesList.length > 5 && (
              <select value={filterTypes.size === 1 && !pitchTypesList.slice(0,5).includes([...filterTypes][0]) ? [...filterTypes][0] : ""}
                onChange={e => { if (e.target.value) toggleType(e.target.value); }}
                style={{ ...selStyle, padding: "4px 6px", fontSize: 10 }}>
                <option value="">+</option>
                {pitchTypesList.slice(5).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Batter side toggle */}
            <button onClick={() => toggleSide("L")} style={{ ...chipStyle(filterSides.has("L")), padding: "4px 8px", fontSize: 10 }}>LHB</button>
            <button onClick={() => toggleSide("R")} style={{ ...chipStyle(filterSides.has("R")), padding: "4px 8px", fontSize: 10 }}>RHB</button>
            {/* Hitter dropdown */}
            {hasLineup && (
              <select value={selectedHitter} onChange={e => { const v = e.target.value; setSelectedHitter(v); if (v) setFilterHitters(new Set([v])); else setFilterHitters(new Set()); }}
                style={{ ...selStyle, padding: "4px 6px", fontSize: 10, minWidth: 90 }}>
                <option value="">All hitters</option>
                {hitterList.map(h => <option key={h.key} value={h.key}>{h.name}</option>)}
              </select>
            )}
            {anyFilterActive && <button onClick={clearAllFilters} style={{ background: "transparent", border: "none", color: G.tx3, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Clear</button>}
          </div>
        </div>

        {/* Main grid: Zone map | Count grid | Pitch mix */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 16, alignItems: "start" }}>
          {/* Zone heat map */}
          <div>
            <div style={{ display: "inline-grid", gridTemplateColumns: "20px repeat(3, 36px) 20px", gridTemplateRows: "20px repeat(3, 36px) 20px 20px", gap: 2 }}>
              {STRIKE_ZONES.map(z => {
                const count = zoneCounts[z.k] || 0;
                const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
                return (<div key={z.k} style={{ gridRow: z.r + 1, gridColumn: z.c + 1, background: zoneColor(count) !== "transparent" ? zoneColor(count) : G.sf2, color: count > 0 ? "#fff" : G.tx3, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid " + G.bd }}>
                  {count > 0 ? <span style={{ fontSize: 11, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{pct}%</span> : <span style={{ fontSize: 8, color: G.tx3 }}>-</span>}
                </div>);
              })}
              {BALL_ZONES.map(z => {
                const count = zoneCounts[z.k] || 0;
                return (<div key={z.k} style={{ gridRow: `${z.r + 1} / span ${z.rowSpan}`, gridColumn: `${z.c + 1} / span ${z.colSpan}`, background: count > 0 ? zoneColor(count) : "#0a0a0a", color: G.tx3, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed " + G.bd2, fontSize: 7 }}>
                  {z.k === "dirt" ? "DIRT" : z.rL}
                </div>);
              })}
            </div>
          </div>

          {/* Count grid (clickable) */}
          <div>
            <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Count — tap to filter</div>
            {countGrid()}
          </div>

          {/* Pitch mix summary */}
          <div>
            <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Pitch Mix</div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: G.gold, marginBottom: 6 }}>{total}<span style={{ fontSize: 12, color: G.tx3, marginLeft: 6 }}>pitches</span></div>
            {typeBD.slice(0, 4).map(d => (
              <div key={d.type} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <div style={{ width: 24, fontSize: 11, fontWeight: 800, color: gPC(d.type), fontFamily: "'Azeret Mono',monospace" }}>{d.type}</div>
                <div style={{ flex: 1, height: 8, background: G.bd, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: d.pct + "%", height: "100%", background: gPC(d.type), borderRadius: 2 }} />
                </div>
                <div style={{ width: 30, fontSize: 10, color: G.tx3, textAlign: "right" }}>{d.pct}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* More filters row */}
        <div style={{ marginTop: 12, borderTop: "1px solid " + G.bd, paddingTop: 10 }}>
          <button onClick={() => setShowMoreFilters(s => !s)} style={{ background: "transparent", border: "none", color: G.tx3, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            {showMoreFilters ? "Less filters" : "More filters (runners, outs, TTO, results)"}
          </button>
          {showMoreFilters && (
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
              <div>
                <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, marginBottom: 4 }}>Runners</div>
                {baseDiamond()}
              </div>
              <div>
                <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, marginBottom: 4 }}>Outs</div>
                <div style={{ display: "flex", gap: 3 }}>
                  {["0", "1", "2"].map(o => (
                    <button key={o} onClick={() => toggleOut(o)} style={{ ...chipStyle(filterOuts.has(o)), padding: "4px 10px", fontSize: 10 }}>{o} out{o !== "1" ? "s" : ""}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, marginBottom: 4 }}>TTO</div>
                <div style={{ display: "flex", gap: 3 }}>
                  {["1", "2", "3"].map(t => (
                    <button key={t} onClick={() => toggleTTO(t)} style={{ ...chipStyle(filterTTOs.has(t)), padding: "4px 10px", fontSize: 10 }}>{t}x</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, marginBottom: 4 }}>Result</div>
                <select value="" onChange={e => { if (e.target.value) toggleResult(e.target.value); }} style={{ ...selStyle, padding: "4px 6px", fontSize: 10 }}>
                  <option value="">Filter by result</option>
                  <option value="K">Strikeout (swinging)</option>
                  <option value="Kc">Strikeout (looking)</option>
                  <option value="go">Groundout</option>
                  <option value="fo">Flyout</option>
                  <option value="hr">Home run</option>
                  <option value="1b">Single</option>
                  <option value="hbp">HBP</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>}

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
                const h = hitterList.find(h => h.key === slot);
                return h ? h.name : String(slot);
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

      {/* Ball/Strike totals */}
      {(() => {
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
          <div style={{ ...cd, display: "flex", gap: 20, alignItems: "center", padding: 12 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: G.gold }}>{sPct}%</span>
              <span style={{ fontSize: 11, color: G.tx3 }}>Strikes ({strikes})</span>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: G.blu }}>{bPct}%</span>
              <span style={{ fontSize: 11, color: G.tx3 }}>Balls ({balls})</span>
            </div>
          </div>
        );
      })()}

      {/* Plate Discipline */}
      {canAccess("zones", tier) && (() => {
        const dp = [];
        scopedGames.forEach(g => g.pitches.forEach(p => { if (!EVENTS.has(p.type) && pitcherSelected(p, g)) dp.push({ p, pts: g.pitchTypes || [] }); }));
        return dp.length ? <DiscBoard pool={dp} /> : null;
      })()}

      {/* Pitch Sequences */}
      {canAccess("zones", tier) ? (() => {
        const seqSource = filterHitters.size === 1 ? allPitches.filter(p => { const keys = pitchPlayerKeys(p); for (const k of keys) if (filterHitters.has(k)) return true; return false; }) : allPitches;
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

        const hitterLabel = filterHitters.size > 0 ? (hitterList.find(h => filterHitters.has(h.key))?.name || "Selected Hitter") : "All";

        return (
          <div style={cd}>
            <div style={cT}>After Pitch... — {hitterLabel}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {entries.sort((a, b) => Object.values(b[1]).reduce((x,y)=>x+y,0) - Object.values(a[1]).reduce((x,y)=>x+y,0)).slice(0, 4).map(([prevType, nexts]) => {
                const tot = Object.values(nexts).reduce((a,b)=>a+b,0);
                const sorted = Object.entries(nexts).sort((a,b)=>b[1]-a[1]).slice(0, 3);
                return (
                  <div key={prevType} style={{ background: G.sf2, borderRadius: 6, padding: 8 }}>
                    <div style={{ fontSize: 10, color: gPC(prevType), fontWeight: 800, marginBottom: 4, fontFamily: "'Azeret Mono',monospace" }}>{prevType} ({tot})</div>
                    {sorted.map(([nt, nc]) => {
                      const pct = Math.round((nc/tot)*100);
                      return <div key={nt} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: gPC(nt), fontFamily: "'Azeret Mono',monospace", width: 20 }}>{nt}</span>
                        <div style={{ flex: 1, height: 4, background: G.bd, borderRadius: 2, overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", background: gPC(nt) }} /></div>
                        <span style={{ fontSize: 9, color: G.tx3 }}>{pct}%</span>
                      </div>;
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })() : null}
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
                  During a game with a runner on 1B or 2B, tap <span style={{ color: G.gold, fontWeight: 800 }}>Read</span> on the Chart tab to log pitcher tendencies. Data will appear here automatically.
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
                <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 1 }}>FILTER <span style={{ color: G.tx3, fontWeight: 400, fontSize: 9 }}>tap multiple to narrow</span></div>
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
            <div style={cT}>Events <span style={{ color: G.tx3, fontWeight: 400, fontSize: 11 }}>on the preceding pitch</span></div>
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

      {/* Pickoffs */}
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
            <div style={{ fontSize: 12, fontWeight: 800, color: G.gold, marginBottom: 3 }}>Pickoffs</div>
            <div style={{ fontSize: 11, color: G.tx3, marginBottom: 6 }}>Upgrade to Pro to unlock pickoff tendencies.</div>
            <a href="mailto:coach@armsight.app" style={{ color: G.gold, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>Contact us to upgrade</a>
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

      {/* Pitcher Reads */}
      {scopedGames.some(g => g.pitches.some(p => scope.inScope(p, g) && p.brRead && (p.brRead.looks2B != null || p.brRead.move2B || p.brRead.move1B || p.brRead.step1B || p.brRead.handPos1B))) && (
        <div onClick={() => setShowReads(s => !s)} style={{ ...cd, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: 8, borderLeft: "3px solid " + G.gold }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: G.gold, letterSpacing: 0.5 }}>Pitcher Reads</div>
          <span style={{ fontSize: 11, color: G.tx3, fontFamily: "'Azeret Mono',monospace" }}>{showReads ? "hide" : "show"}</span>
        </div>
      )}
      {/* 2B Look Count */}
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
        const t = rows.length;
        const labels = { 0: "0 Looks", 1: "1 Look", 2: "2 Looks", 3: "3+" };
        const move2BFreq = { inside: 0, spin: 0 };
        move2BRows.forEach(p => { if (move2BFreq[p.brRead.move2B] !== undefined) move2BFreq[p.brRead.move2B]++; });
        return (
          <div style={cd}>
            <div style={cT}>2B — Pitcher Read</div>
            {t > 0 && (<>
              <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, marginTop: 10 }}>Look Count ({t})</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {[0, 1, 2, 3].map(n => {
                  const cnt = freq[n];
                  const pct = t > 0 ? Math.round((cnt / t) * 100) : 0;
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

      {/* 1B Pitcher Tendencies */}
      {(() => {
        if (!showReads) return null;
        const brPool1B = scopedGames.flatMap(g => g.pitches.filter(p => scope.inScope(p, g) && p.brRead && (p.brRead.move1B || p.brRead.step1B || p.brRead.handPos1B)));
        if (brPool1B.length === 0) return null;
        let rows = brPool1B;
        if (filterCounts.size > 0) rows = rows.filter(p => filterCounts.has(p.balls + "-" + p.strikes));
        if (filterOuts.size > 0) rows = rows.filter(p => filterOuts.has(String(p.outs)));
        if (rows.length === 0) return null;
        const pks = scopedGames.flatMap(g => g.pitches.filter(p => scope.inScope(p, g) && (p.type === "PK" || p.type === "PKO" || p.type === "PK-E") && p.brRead && (p.brRead.move1B || p.brRead.step1B)));

        const moveFreq = { quick: 0, best: 0, show: 0 };
        const moveTotal = rows.filter(p => p.brRead.move1B).length;
        rows.forEach(p => { if (p.brRead.move1B) moveFreq[p.brRead.move1B]++; });

        const stepFreq = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const stepTotal = rows.filter(p => p.brRead.step1B).length;
        rows.forEach(p => { if (p.brRead.step1B) stepFreq[p.brRead.step1B]++; });

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
