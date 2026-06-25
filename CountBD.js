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
  const [readsTab,      setReadsTab]      = useState("pickoffs");
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
      // EXACT situation: the pitch's occupied bases must equal the tapped set precisely.
      const want1 = filterSits.has("b1"), want2 = filterSits.has("b2"), want3 = filterSits.has("b3");
      return f === want1 && s === want2 && t === want3;
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
    // Per-base filter keys: "on1" / "on2" / "on3" mean "any pitch with a runner on that base".
    const baseFilterKey = { first: "b1", second: "b2", third: "b3" };
    const toggleBaseFilter = (baseKey) => {
      const key = baseFilterKey[baseKey];
      if (!key) return;
      setFilterSits(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
    };
    const isOn = (baseKey) => filterSits.has(baseFilterKey[baseKey]);
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
                const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
                return (<div key={z.k} style={{ gridRow: `${z.r + 1} / span ${z.rowSpan}`, gridColumn: `${z.c + 1} / span ${z.colSpan}`, background: count > 0 ? zoneColor(count) : "#0a0a0a", color: count > 0 ? "#fff" : G.tx3, borderRadius: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px dashed " + G.bd2, gap: 1 }}>
                  <span style={{ fontSize: 6, color: G.tx3, lineHeight: 1, textTransform: "uppercase", letterSpacing: 0.3 }}>{z.k === "dirt" ? "DIRT" : z.rL}</span>
                  {count > 0 && <span style={{ fontSize: 10, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", lineHeight: 1 }}>{pct}%</span>}
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
              ...(filterSits.size > 0 ? { "Runners": new Set([(() => {
                const b1 = filterSits.has("b1"), b2 = filterSits.has("b2"), b3 = filterSits.has("b3");
                const on = [b1 && "1B", b2 && "2B", b3 && "3B"].filter(Boolean);
                return on.length === 3 ? "Loaded" : on.length ? on.join(" + ") : "Bases empty";
              })()]) } : {}),
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
          const outMeta = [{ k: "0", label: "0 outs" }, { k: "1", label: "1 out" }, { k: "2", label: "2 outs" }];
          const active = filterEvents.size > 0 || filterBases.size > 0 || filterCounts.size > 0 || filterOuts.size > 0;
          const chip = (key, on, onClick, label) => (
            <button key={key} onClick={onClick} style={{ ...chipStyle(on), fontSize: 10, padding: "4px 9px" }}>{label}</button>
          );
          // Base-reached diamond: 2B=top, 3B=left, Home=bottom, 1B=right (dimmed origin)
          const bPos = [["2B", 0.50, 0.06], ["3B", 0.06, 0.50], ["Home", 0.50, 0.91]];
          const ds = 68;

          // Events data (preceding pitch breakdown)
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

          const selStyle = { background: G.sf2, border: "1px solid " + G.bd2, borderRadius: 6, color: G.tx, fontSize: 11, padding: "5px 8px", cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none", minWidth: 90 };
          const selActive = (hasVal) => hasVal ? { ...selStyle, border: "1px solid " + G.gold, color: G.gold } : selStyle;

          return (
            <div style={{ ...cd, marginBottom: 8 }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>Filters</div>
                {active && <button onClick={() => { setFilterEvents(new Set()); setFilterBases(new Set()); setFilterCounts(new Set()); setFilterOuts(new Set()); }} style={{ background: "transparent", border: "none", color: G.gold, fontSize: 9, fontWeight: 800, cursor: "pointer", letterSpacing: 0.5 }}>Clear all</button>}
              </div>
              {/* Dropdowns row: Event · Count · Outs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {[
                  {
                    label: "Event",
                    value: filterEvents.size === 1 ? [...filterEvents][0] : "",
                    options: [{ v: "", l: "All events" }, ...evMeta.map(e => ({ v: e, l: e }))],
                    onChange: (v) => setFilterEvents(v ? new Set([v]) : new Set()),
                    active: filterEvents.size > 0,
                  },
                  {
                    label: "Count",
                    value: filterCounts.size === 1 ? [...filterCounts][0] : "",
                    options: [{ v: "", l: "All counts" }, ...counts.map(c => ({ v: c, l: c }))],
                    onChange: (v) => setFilterCounts(v ? new Set([v]) : new Set()),
                    active: filterCounts.size > 0,
                  },
                  {
                    label: "Outs",
                    value: filterOuts.size === 1 ? [...filterOuts][0] : "",
                    options: [{ v: "", l: "All outs" }, ...outMeta.map(o => ({ v: o.k, l: o.label }))],
                    onChange: (v) => setFilterOuts(v ? new Set([v]) : new Set()),
                    active: filterOuts.size > 0,
                  },
                ].map(({ label, value, options, onChange, active: isActive }) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
                    <div style={{ position: "relative" }}>
                      <select value={value} onChange={e => onChange(e.target.value)} style={selActive(isActive)}>
                        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                      <div style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 9, color: isActive ? G.gold : G.tx3 }}>▾</div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Base reached + Events side by side */}
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                {/* Base reached — tappable diamond + chip labels */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>Base Reached</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ position: "relative", width: ds, height: ds, flexShrink: 0 }}>
                      <svg width={ds} height={ds} viewBox="0 0 100 100" style={{ position: "absolute" }}>
                        <polygon points="50,12 88,50 50,88 12,50" fill="none" stroke={G.bd2} strokeWidth={2.5} />
                      </svg>
                      {/* 1B: dimmed origin, not tappable */}
                      <div style={{ position: "absolute", left: "88%", top: "50%", transform: "translate(-50%,-50%) rotate(45deg)", width: 12, height: 12, borderRadius: 2, background: G.sf2, border: "1.5px solid " + G.bd, opacity: 0.35 }} />
                      {bPos.map(([b, fx, fy]) => {
                        const on = filterBases.has(b);
                        return (
                          <div key={b} onClick={() => toggleBase(b)}
                            style={{ position: "absolute", left: (fx * 100) + "%", top: (fy * 100) + "%", transform: "translate(-50%,-50%) rotate(45deg)", width: 14, height: 14, borderRadius: 2, cursor: "pointer", background: on ? G.gold : "transparent", border: "2px solid " + (on ? G.gold : G.bd2), transition: "background 0.12s" }} />
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {["2B", "3B", "Home"].map(b => {
                        const on = filterBases.has(b);
                        return <button key={b} onClick={() => toggleBase(b)} style={{ ...chipStyle(on), fontSize: 10, padding: "4px 9px" }}>{b}</button>;
                      })}
                    </div>
                  </div>
                </div>
                {/* Events — preceding pitch breakdown */}
                {eventData.length > 0 && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>
                      Events <span style={{ fontWeight: 400, opacity: 0.7 }}>— preceding pitch</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                      {eventData.map(({ evType, label, color, total: evTotal, typeMix }) => (
                        <div key={evType} style={{ background: G.sf2, borderRadius: 7, padding: 8, border: "1px solid " + color + "33" }}>
                          <div style={{ fontSize: 9, fontWeight: 800, color, marginBottom: 6, letterSpacing: 0.8, textTransform: "uppercase" }}>
                            {label} <span style={{ color: G.tx3, fontWeight: 400 }}>({evTotal})</span>
                          </div>
                          {typeMix.length === 0 ? <div style={{ fontSize: 10, color: G.tx3, fontStyle: "italic" }}>no pitch logged</div> : typeMix.map(({ type, count, pct }) => (
                            <div key={type} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                              <div style={{ width: 26, fontSize: 10, fontWeight: 800, color: gPC(type), textAlign: "right", flexShrink: 0 }}>{type}</div>
                              <div style={{ flex: 1, height: 9, background: G.bd, borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: pct + "%", height: "100%", background: gPC(type), borderRadius: 3 }} />
                              </div>
                              <div style={{ fontSize: 9, color: G.tx3, width: 34, textAlign: "right", flexShrink: 0 }}>{pct}%</div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {/* Pitcher Reads & Pickoffs — unified tabbed card */}
      {(() => {
        // ── PICKOFFS DATA ──────────────────────────────────────────────────
        const PK_TYPES = { "PKO": true, "PK": true, "PK-E": true };
        const pks = rawPool.filter(p => PK_TYPES[p.type] && !p._pg);
        const outcomeOf = (p) => p.type === "PK-E" ? "error" : (p.type === "PKO" || p.pkoOut || p.result === "pk-out") ? "out" : "safe";
        const baseLabel = { first: "1B", second: "2B", third: "3B", none: "—" };
        let tOut = 0, tSafe = 0, tErr = 0;
        pks.forEach(p => { const o = outcomeOf(p); if (o === "out") tOut++; else if (o === "safe") tSafe++; else tErr++; });
        const byCount = {};
        pks.forEach(p => { const k = p.balls + "-" + p.strikes; if (!byCount[k]) byCount[k] = { key: k, total: 0, out: 0, safe: 0, error: 0 }; byCount[k].total++; byCount[k][outcomeOf(p)]++; });
        const countRows = Object.keys(byCount).map(k => byCount[k]).sort((a, b) => b.total - a.total);
        const byBase = {};
        pks.forEach(p => { const b = p.pkoBase || "none"; if (!byBase[b]) byBase[b] = { key: b, total: 0, out: 0, safe: 0, error: 0 }; byBase[b].total++; byBase[b][outcomeOf(p)]++; });
        const baseRows = ["first", "second", "third", "none"].filter(b => byBase[b]).map(b => byBase[b]);

        // ── 2B READS DATA ──────────────────────────────────────────────────
        const brPool = scopedGames.flatMap(g => g.pitches.filter(p => p.brRead && scope.inScope(p, g)));
        const pitchesWithLooks = brPool.filter(p => p.brRead.looks2B !== null && p.brRead.looks2B !== undefined);
        const pitchesWithMove2B = brPool.filter(p => p.brRead.move2B);
        let looksRows = pitchesWithLooks;
        if (filterCounts.size > 0) looksRows = looksRows.filter(p => filterCounts.has(p.balls + "-" + p.strikes));
        if (filterOuts.size > 0) looksRows = looksRows.filter(p => filterOuts.has(String(p.outs)));
        let move2BRows = pitchesWithMove2B;
        if (filterCounts.size > 0) move2BRows = move2BRows.filter(p => filterCounts.has(p.balls + "-" + p.strikes));
        if (filterOuts.size > 0) move2BRows = move2BRows.filter(p => filterOuts.has(String(p.outs)));
        const freq2B = { 0: 0, 1: 0, 2: 0, 3: 0 };
        looksRows.forEach(p => { const l = Math.min(p.brRead.looks2B, 3); freq2B[l]++; });
        const looksTotal = looksRows.length;
        const lookLabels = { 0: "0 Looks", 1: "1 Look", 2: "2 Looks", 3: "3+" };
        const move2BFreq = { inside: 0, spin: 0 };
        move2BRows.forEach(p => { if (move2BFreq[p.brRead.move2B] !== undefined) move2BFreq[p.brRead.move2B]++; });

        // ── 1B TENDENCIES DATA ─────────────────────────────────────────────
        const brPool1B = scopedGames.flatMap(g => g.pitches.filter(p => scope.inScope(p, g) && p.brRead && (p.brRead.move1B || p.brRead.step1B || p.brRead.handPos1B)));
        let rows1B = brPool1B;
        if (filterCounts.size > 0) rows1B = rows1B.filter(p => filterCounts.has(p.balls + "-" + p.strikes));
        if (filterOuts.size > 0) rows1B = rows1B.filter(p => filterOuts.has(String(p.outs)));
        const pksWith1B = scopedGames.flatMap(g => g.pitches.filter(p => scope.inScope(p, g) && (p.type === "PK" || p.type === "PKO" || p.type === "PK-E") && p.brRead && (p.brRead.move1B || p.brRead.step1B)));
        const moveFreq = { quick: 0, best: 0, show: 0 };
        const moveTotal = rows1B.filter(p => p.brRead.move1B).length;
        rows1B.forEach(p => { if (p.brRead.move1B) moveFreq[p.brRead.move1B]++; });
        const stepFreq = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const stepTotal = rows1B.filter(p => p.brRead.step1B).length;
        rows1B.forEach(p => { if (p.brRead.step1B) stepFreq[p.brRead.step1B]++; });
        const handFreq = { high: 0, mid: 0, low: 0 };
        const handTotal = rows1B.filter(p => p.brRead.handPos1B).length;
        rows1B.forEach(p => { if (p.brRead.handPos1B) handFreq[p.brRead.handPos1B]++; });
        const pkMoveFreq = {}; pksWith1B.forEach(p => { if (p.brRead.move1B) pkMoveFreq[p.brRead.move1B] = (pkMoveFreq[p.brRead.move1B] || 0) + 1; });
        const pkStepFreq = {}; pksWith1B.forEach(p => { if (p.brRead.step1B) pkStepFreq[p.brRead.step1B] = (pkStepFreq[p.brRead.step1B] || 0) + 1; });

        // ── VISIBILITY ─────────────────────────────────────────────────────
        const hasPickoffs = pks.length > 0;
        const has2B = pitchesWithLooks.length > 0 || pitchesWithMove2B.length > 0;
        const has1B = brPool1B.length > 0;
        if (!hasPickoffs && !has2B && !has1B) return null;

        const availTabs = [
          hasPickoffs && { key: "pickoffs", label: "Pickoffs" },
          has1B       && { key: "1b",       label: "1B Read" },
          has2B       && { key: "2b",       label: "2B Read" },
        ].filter(Boolean);
        const activeTab = availTabs.some(t => t.key === readsTab) ? readsTab : availTabs[0]?.key;

        // ── SHARED RENDER HELPERS ──────────────────────────────────────────
        const subHead = (label) => (
          <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
        );
        const sumCell = (val, label, color, bg, bd) => (
          <div style={{ background: bg, border: "1px solid " + bd, borderRadius: 7, padding: "10px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 9, color: G.tx3, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginTop: 4 }}>{label}</div>
          </div>
        );
        const mkTable = (label, rows, firstColLabel, labelOf) => (
          <div style={{ marginBottom: 12 }}>
            {subHead(label)}
            <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(4, 50px)", gap: 2, padding: "3px 8px", marginBottom: 3 }}>
              <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>{firstColLabel}</div>
              {["Total", "Out", "Safe", "Error"].map(h => (
                <div key={h} style={{ fontSize: 9, color: G.tx3, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, textAlign: "center" }}>{h}</div>
              ))}
            </div>
            {rows.map(r => (
              <div key={r.key} style={{ display: "grid", gridTemplateColumns: "1fr repeat(4, 50px)", gap: 2, padding: "7px 8px", background: G.sf2, borderRadius: 6, border: "1px solid " + G.bd, marginBottom: 3 }}>
                <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: G.gold }}>{labelOf(r)}</div>
                <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: G.tx, textAlign: "center" }}>{r.total}</div>
                <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: r.out ? "#ffd700" : G.tx3, textAlign: "center" }}>{r.out}</div>
                <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: r.safe ? G.tx2 : G.tx3, textAlign: "center" }}>{r.safe}</div>
                <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: r.error ? "#ff6600" : G.tx3, textAlign: "center" }}>{r.error}</div>
              </div>
            ))}
          </div>
        );
        const barRow = (label, count, total, color) => total === 0 ? null : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <div style={{ width: 48, fontSize: 11, fontWeight: 800, color, textAlign: "right", flexShrink: 0 }}>{label}</div>
            <div style={{ flex: 1, height: 12, background: G.bd, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: Math.round((count / total) * 100) + "%", height: "100%", background: color, borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 10, color: G.tx3, width: 52, textAlign: "right", flexShrink: 0 }}>{Math.round((count / total) * 100)}% ({count})</div>
          </div>
        );
        const statTile = (label, pct, cnt) => (
          <div style={{ background: G.sf2, border: "1px solid " + G.bd, borderRadius: 7, padding: "10px 12px", textAlign: "center", minWidth: 64 }}>
            <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: G.gold, fontFamily: "'Azeret Mono',monospace", marginTop: 4 }}>{pct}%</div>
            <div style={{ fontSize: 9, color: G.tx3, marginTop: 2 }}>{cnt}x</div>
          </div>
        );

        return (
          <div style={cd}>
            {/* Card header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={cT}>Pitcher Reads & Pickoffs</div>
              <button onClick={() => setShowReads(s => !s)}
                style={{ background: "transparent", border: "none", color: G.tx3, fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>
                {showReads ? "▲ Hide" : "▼ Show"}
              </button>
            </div>
            {showReads && (<>
              {/* Tab bar */}
              <div style={{ display: "flex", gap: 3, borderBottom: "1px solid " + G.bd, paddingBottom: 10, marginBottom: 14 }}>
                {availTabs.map(t => (
                  <button key={t.key} onClick={() => setReadsTab(t.key)}
                    style={{ ...chipStyle(activeTab === t.key), fontSize: 10, padding: "4px 11px" }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── PICKOFFS TAB ── */}
              {activeTab === "pickoffs" && (
                !canAccess("pickoffs", tier) ? (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div style={{ fontSize: 11, color: G.tx3, marginBottom: 6 }}>Upgrade to Pro to unlock pickoff tendencies.</div>
                    <a href="mailto:coach@armsight.app" style={{ color: G.gold, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>Contact us to upgrade</a>
                  </div>
                ) : (
                  <div>
                    {/* Compact totals strip */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                      {[
                        { val: tOut,  label: "Out",   color: "#ffd700" },
                        { val: tSafe, label: "Safe",  color: G.tx2 },
                        { val: tErr,  label: "Err",   color: "#ff6600" },
                      ].map(({ val, label, color }) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, background: G.sf2, border: "1px solid " + G.bd, borderRadius: 6, padding: "5px 10px" }}>
                          <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color }}>{val}</span>
                          <span style={{ fontSize: 9, color: G.tx3, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</span>
                        </div>
                      ))}
                    </div>
                    {/* Side-by-side breakdown grids */}
                    <div style={{ display: "grid", gridTemplateColumns: countRows.length > 0 && baseRows.length > 0 ? "1fr 1fr" : "1fr", gap: 10 }}>
                      {[
                        { label: "By Count", rows: countRows, labelOf: r => r.key },
                        { label: "By Base",  rows: baseRows,  labelOf: r => baseLabel[r.key] || r.key },
                      ].map(({ label, rows, labelOf }) => rows.length > 0 && (
                        <div key={label}>
                          {subHead(label)}
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            {rows.map(r => {
                              const tot = r.total || 1;
                              const outW  = Math.round((r.out   / tot) * 100);
                              const safeW = Math.round((r.safe  / tot) * 100);
                              const errW  = Math.round((r.error / tot) * 100);
                              return (
                                <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{ width: 28, fontSize: 10, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: G.gold, flexShrink: 0, textAlign: "right" }}>{labelOf(r)}</div>
                                  <div style={{ flex: 1, height: 10, borderRadius: 3, overflow: "hidden", display: "flex", background: G.bd }}>
                                    {outW  > 0 && <div style={{ width: outW  + "%", background: "#ffd700", height: "100%" }} />}
                                    {safeW > 0 && <div style={{ width: safeW + "%", background: G.tx3,    height: "100%", opacity: 0.5 }} />}
                                    {errW  > 0 && <div style={{ width: errW  + "%", background: "#ff6600", height: "100%" }} />}
                                  </div>
                                  <div style={{ fontSize: 9, color: G.tx3, width: 16, textAlign: "right", flexShrink: 0 }}>{r.total}</div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Legend — only once, under first section */}
                          {label === "By Count" && (
                            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                              {[["#ffd700","Out"],[G.tx3,"Safe"],["#ff6600","Err"]].map(([c,l]) => (
                                <div key={l} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c, opacity: l === "Safe" ? 0.5 : 1 }} />
                                  <span style={{ fontSize: 8, color: G.tx3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{l}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {/* ── 2B READ TAB ── */}
              {activeTab === "2b" && (
                <div>
                  {looksTotal > 0 && (<>
                    {subHead("Look Count (" + looksTotal + ")")}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                      {[0, 1, 2, 3].map(n => statTile(lookLabels[n], looksTotal > 0 ? Math.round((freq2B[n] / looksTotal) * 100) : 0, freq2B[n]))}
                    </div>
                  </>)}
                  {move2BRows.length > 0 && (<>
                    {subHead("Move Type (" + move2BRows.length + ")")}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[{ k: "inside", l: "Inside" }, { k: "spin", l: "Spin" }].map(m => {
                        const cnt = move2BFreq[m.k];
                        const pct = move2BRows.length > 0 ? Math.round((cnt / move2BRows.length) * 100) : 0;
                        return (
                          <div key={m.k} style={{ background: G.sf2, border: "1px solid " + G.bd, borderRadius: 7, padding: "10px 14px", textAlign: "center", minWidth: 80 }}>
                            <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" }}>{m.l}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: G.gold, fontFamily: "'Azeret Mono',monospace", marginTop: 4 }}>{pct}%</div>
                            <div style={{ fontSize: 9, color: G.tx3, marginTop: 2 }}>{cnt}x</div>
                          </div>
                        );
                      })}
                    </div>
                  </>)}
                </div>
              )}

              {/* ── 1B TENDENCIES TAB ── */}
              {activeTab === "1b" && (
                rows1B.length === 0 ? (
                  <div style={{ fontSize: 11, color: G.tx3, textAlign: "center", padding: "16px 0" }}>No data for active filters.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {/* Left column: Hand Position + Move Type */}
                    <div>
                      {handTotal > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          {subHead("Hand Position (" + handTotal + ")")}
                          {barRow("High", handFreq.high, handTotal, "#ff9933")}
                          {barRow("Mid",  handFreq.mid,  handTotal, G.gold)}
                          {barRow("Low",  handFreq.low,  handTotal, G.blu)}
                        </div>
                      )}
                      {moveTotal > 0 && (
                        <div>
                          {subHead("Move Type (" + moveTotal + ")")}
                          {barRow("Quick", moveFreq.quick, moveTotal, "#ff4444")}
                          {barRow("Best",  moveFreq.best,  moveTotal, G.gold)}
                          {barRow("Show",  moveFreq.show,  moveTotal, G.tx3)}
                        </div>
                      )}
                    </div>
                    {/* Right column: Step Reached */}
                    {stepTotal > 0 && (
                      <div>
                        {subHead("Step Reached (" + stepTotal + ")")}
                        {[1, 2, 3, 4].map(n => barRow(String(n), stepFreq[n], stepTotal, G.gold))}
                      </div>
                    )}
                  </div>
                )
              )}
            </>)}
          </div>
        );
      })()}

      </>)}
    </div>
  );
}
