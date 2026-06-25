
function Hitting({ games = [], activeGame = null }) {
  // ── SCOPE (shared cascade: Hand → Teams → Games → Pitchers) ──
  // Pregame-scouted games are excluded: a pregame pitcher faced a different lineup.
  const scope = useScope(games, activeGame, { lockSource: "live" });
  const [fPitch, setFPitch] = useState("All");
  const [fCount, setFCount] = useState("All");
  const [fOuts, setFOuts] = useState("All");
  const [fRun, setFRun] = useState("All");
  const [sortKey, setSortKey] = useState("qab");
  const [sortDir, setSortDir] = useState(-1);
  const [popName, setPopName] = useState(null);
  const [popF, setPopF] = useState({ pitch: "All", count: "All", outs: "All", run: "All" });
  const [popMetric, setPopMetric] = useState("hh");
  const [showKey, setShowKey] = useState(false);

  const allABs = useMemo(() => {
    const abs = buildAtBats(scope.scopedGames);
    return abs.filter(ab => {
      const g = scope.gameById[ab.gameId];
      const lp = ab.lastPitch;
      return scope.matchHand(lp, g) && scope.matchPitcher(lp, g);
    });
  }, [scope.scopedGames, scope.hand, scope.pitchers, scope.gameById]);

  const hitterNames = useMemo(() => [...new Set(allABs.map(ab => ab.name))].sort(), [allABs]);

  // ── classifiers ──
  const tagsOf = (ab) => ab.lastPitch.atBatTags || {};
  // HH at-bats: exclude walks, HBP, intentional walks, and sac bunts; sac flies DO count.
  const isHHab = (ab) => { const p = ab.lastPitch, t = tagsOf(ab); if (p.result === "hbp" || p.result === "ibb") return false; if (p.result === "ball" && p.balls === 3) return false; if (t.sacBunt) return false; return true; };
  const onBaseQAB = (ab) => { const p = ab.lastPitch; return p.result === "roe" || p.result === "hbp" || (p.result === "ball" && p.balls === 3); };
  const is6 = (ab) => ab.pitches.length >= 6;
  const is2k = (ab) => { const i = ab.pitches.findIndex(x => x.strikes === 2); return i >= 0 && ab.pitches.length - i >= 4; };
  const isMoveRbi = (ab) => { const t = tagsOf(ab); return !!(t.advRunner || t.rbi); };
  const isSac = (ab) => { const t = tagsOf(ab); return !!(t.sacFly || t.sacBunt); };
  const isUnspec = (ab) => { const t = tagsOf(ab); return !!t.qab && !t.advRunner && !t.rbi && !t.sacFly && !t.sacBunt; };
  const famOf = (ab) => getPitchFamily(ab.lastPitch.type, (scope.gameById[ab.gameId] || {}).pitchTypes || []);
  const famLabel = (ab) => ({ fastball: "Fastball", breaking: "Breaking", offspeed: "Offspeed" })[famOf(ab)] || "Other";
  const countBucket = (ab) => { const p = ab.lastPitch; return p.balls > p.strikes ? "Ahead" : p.balls < p.strikes ? "Behind" : "Even"; };
  const runnerBucket = (ab) => { const r = ab.lastPitch.runners || {}; if (r.second || r.third) return "RISP"; if (r.first) return "Men on"; return "Empty"; };

  const cnt = (abs, fn) => abs.filter(fn).length;
  const rate = (n, d) => d > 0 ? n / d : -1;
  const fmtAvg = (v) => v < 0 ? "—" : v.toFixed(3).replace(/^0/, "");
  const qabRate = (abs) => rate(cnt(abs, a => a.isQAB), abs.length);

  // ── situational filters (Pitch / Count / Outs / Runners) — HH only; never QAB/PA ──
  const matchF = (ab, f) => {
    if (f.pitch !== "All" && famLabel(ab) !== f.pitch) return false;
    if (f.count !== "All" && countBucket(ab) !== f.count) return false;
    if (f.outs !== "All" && String(ab.lastPitch.outs) !== f.outs) return false;
    if (f.run !== "All" && runnerBucket(ab) !== f.run) return false;
    return true;
  };
  const gf = { pitch: fPitch, count: fCount, outs: fOuts, run: fRun };
  const passFilters = (ab) => matchF(ab, gf);
  const anyFilter = fPitch !== "All" || fCount !== "All" || fOuts !== "All" || fRun !== "All";
  const clearFilters = () => { setFPitch("All"); setFCount("All"); setFOuts("All"); setFRun("All"); };

  // ── columns: PA/QAB overall; HH reflects filters ──
  const hhVal = (abs) => { const f = abs.filter(passFilters); return rate(cnt(f, a => a.isHardHit && isHHab(a)), cnt(f, isHHab)); };
  // plate-discipline columns (per-pitch; reflect the situational filters)
  const fmtPct = (v) => v < 0 ? "\u2014" : Math.round(v * 100) + "%";
  const pitchPool = (abs) => { const out = []; abs.forEach(ab => { const pts = (scope.gameById[ab.gameId] || {}).pitchTypes || []; ab.pitches.forEach(p => out.push({ p, pts })); }); return out; };
  const matchFP = ({ p, pts }, f) => {
    if (!pdSeen(p)) return false;
    if (f.pitch !== "All") { const fam = ({ fastball: "Fastball", breaking: "Breaking", offspeed: "Offspeed" })[getPitchFamily(p.type, pts)] || "Other"; if (fam !== f.pitch) return false; }
    if (f.count !== "All") { const cb = p.balls > p.strikes ? "Ahead" : p.balls < p.strikes ? "Behind" : "Even"; if (cb !== f.count) return false; }
    if (f.outs !== "All" && String(p.outs) !== f.outs) return false;
    if (f.run !== "All") { const r = p.runners || {}; const rb = (r.second || r.third) ? "RISP" : r.first ? "Men on" : "Empty"; if (rb !== f.run) return false; }
    return true;
  };
  const discVal = (abs, key, f) => pdRates(pitchPool(abs).filter(x => matchFP(x, f || gf)).map(x => x.p))[key];
  const cols = [
    { key: "name", label: "Hitter", nm: true },
    { key: "qab", label: "QAB", tip: "Quality at-bat rate, QAB ÷ PA (overall; filters don't apply)", val: abs => qabRate(abs), fmt: fmtAvg },
    { key: "hh",  label: "HH",  tip: "Hard-hit rate over at-bats — no walks/HBP/sac bunts, sac flies count (reflects filters)", val: hhVal, fmt: fmtAvg },
    { key: "whiff", label: "Whiff", tip: "Whiffs ÷ swings — swinging strikes over total swings (reflects filters)", val: abs => discVal(abs, "whiff"), fmt: fmtPct },
    { key: "chase", label: "Chase", tip: "Swings at out-of-zone pitches ÷ out-of-zone pitches seen — needs pitch locations (reflects filters)", val: abs => discVal(abs, "chase"), fmt: fmtPct },
    { key: "take",  label: "Take",  tip: "Pitches taken ÷ pitches seen (reflects filters)", val: abs => discVal(abs, "take"), fmt: fmtPct },
  ];

  // QAB-type breakdown (overall) — shown in the per-hitter popup
  const qabTypes = [
    { l: "On base", fn: a => a.isQAB && onBaseQAB(a) },
    { l: "6+", fn: a => a.isQAB && is6(a) },
    { l: "4P-2K", fn: a => a.isQAB && is2k(a) },
    { l: "Move/RBI", fn: a => a.isQAB && isMoveRbi(a) },
    { l: "Sac", fn: a => a.isQAB && isSac(a) },
    { l: "QAB?", fn: a => a.isQAB && isUnspec(a) },
  ];

  // ── rows ──
  const rows = useMemo(() => {
    const byName = {};
    allABs.forEach(ab => { (byName[ab.name] = byName[ab.name] || []).push(ab); });
    return Object.keys(byName).map(name => ({ name, abs: byName[name] }));
  }, [allABs]);
  const sortCol = cols.find(c => c.key === sortKey) || cols[2];
  const sortedRows = [...rows].sort((a, b) =>
    sortKey === "name" ? sortDir * a.name.localeCompare(b.name) : sortDir * (sortCol.val(a.abs) - sortCol.val(b.abs)));
  const clickSort = (key) => {
    if (key === sortKey) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(key === "name" ? 1 : -1); }
  };
  const openPop = (name) => { setPopF({ pitch: fPitch, count: fCount, outs: fOuts, run: fRun }); setPopName(name); };

  // ── HARD-HIT AVG BY ZONE heat map (attack / lay-off) ──
  // Each zone = hard hits ÷ at-bats ending there. Samples < 2 are muted. abs = pre-filtered at-bats.
  const cellViz = (den, num) => {
    const avg = den > 0 ? num / den : -1;
    if (den === 0) return { bg: G.sf2, col: G.tx3, txt: null };
    if (den < 2) return { bg: "rgba(130,130,130,0.22)", col: G.tx3, txt: fmtAvg(avg) };
    if (avg >= 0.40) return { bg: "#E24B4A", col: "#fff", txt: fmtAvg(avg) };
    if (avg >= 0.25) return { bg: "#E0A53B", col: "#1a1200", txt: fmtAvg(avg) };
    return { bg: "#3F7CC0", col: "#fff", txt: fmtAvg(avg) };
  };
  const discCell = (den, num) => {
    const v = den > 0 ? num / den : -1;
    if (den === 0) return { bg: G.sf2, col: G.tx3, txt: null };
    const pct = Math.round(v * 100) + "%";
    if (den < 3) return { bg: "rgba(130,130,130,0.22)", col: G.tx3, txt: pct };
    const a = (0.18 + Math.min(v, 1) * 0.72).toFixed(2);
    return { bg: "rgba(212,175,55," + a + ")", col: v >= 0.55 ? "#1a1200" : G.tx, txt: pct };
  };
  const discZK = [...STRIKE_ZONES.map(z => z.k), ...BALL_ZONES.map(z => z.k)];
  const renderDiscHeat = (abs, key, f) => {
    const pool = pitchPool(abs).filter(x => matchFP(x, f) && x.p.location && (STRIKE_ZONE_KEYS.has(x.p.location) || BALL_ZONE_KEYS.has(x.p.location))).map(x => x.p);
    if (pool.length === 0) return <div style={{ fontSize: 12, color: G.tx3, fontStyle: "italic" }}>No located pitches here.</div>;
    const lbl = { whiff: "Whiff% = swing-and-miss / swings", chase: "Chase% = swings / pitches seen (out-of-zone only)", take: "Take% = takes / pitches seen" }[key];
    return (
      <div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
          {["R", "L"].map(side => {
            const sp = pool.filter(p => (p.batSide || "R") === side);
            if (sp.length === 0) return null;
            const den = {}, num = {};
            discZK.forEach(k => { den[k] = 0; num[k] = 0; });
            sp.forEach(p => {
              const k = p.location; if (den[k] === undefined) return;
              if (key === "whiff") { if (pdSwing(p)) { den[k]++; if (pdWhiff(p)) num[k]++; } }
              else if (key === "chase") { if (BALL_ZONE_KEYS.has(k)) { den[k]++; if (pdSwing(p)) num[k]++; } }
              else { den[k]++; if (!pdSwing(p)) num[k]++; }
            });
            return (
              <div key={side} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, marginBottom: 6, letterSpacing: 1 }}>{side === "R" ? "RHB" : "LHB"} ({sp.length})</div>
                <div style={{ display: "inline-grid", gridTemplateColumns: "24px repeat(3,42px) 24px", gridTemplateRows: "24px repeat(3,42px) 24px 24px", gap: 2 }}>
                  {STRIKE_ZONES.map(z => { const v = discCell(den[z.k], num[z.k]); return (
                    <div key={z.k} style={{ gridRow: z.r + 1, gridColumn: z.c + 1, background: v.bg, color: v.col, borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "2px solid " + G.bd }}>
                      {den[z.k] > 0 ? (<><div style={{ fontSize: 11, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{v.txt}</div><div style={{ fontSize: 7, opacity: 0.8 }}>n={den[z.k]}</div></>) : <div style={{ fontSize: 9, color: G.tx3 }}>·</div>}
                    </div> ); })}
                  {BALL_ZONES.map(z => { const v = discCell(den[z.k], num[z.k]); return (
                    <div key={z.k} style={{ gridRow: (z.r + 1) + " / span " + z.rowSpan, gridColumn: (z.c + 1) + " / span " + z.colSpan, background: den[z.k] > 0 ? v.bg : "#0d0d0d", color: v.col, borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px dashed " + G.bd2 }}>
                      {den[z.k] > 0 ? (<><div style={{ fontSize: 10, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{v.txt}</div><div style={{ fontSize: 7, opacity: 0.8 }}>n={den[z.k]}</div></>) : <div style={{ fontSize: 7, color: G.tx3 }}>{z.k === "dirt" ? "DIRT" : (side === "R" ? z.rL : z.lL)}</div>}
                    </div> ); })}
                </div>
              </div> );
          })}
        </div>
        <div style={{ fontSize: 9, color: G.tx3, marginTop: 8, textAlign: "center" }}>{lbl} · brighter = higher · n shown · &lt;3 muted{key === "chase" ? " · out-of-zone cells only" : ""}</div>
      </div> );
  };
  const renderHeat = (abs) => {
    const pool = abs.filter(a => isHHab(a) && a.lastPitch && a.lastPitch.location);
    if (pool.length === 0) return <div style={{ fontSize: 12, color: G.tx3, fontStyle: "italic" }}>No at-bats with a logged zone here.</div>;
    return (
      <div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
          {["R", "L"].map(side => {
            const sp = pool.filter(a => (a.lastPitch.batSide || "R") === side);
            if (sp.length === 0) return null;
            const den = {}, num = {};
            [...STRIKE_ZONES.map(z => z.k), ...BALL_ZONES.map(z => z.k)].forEach(k => { den[k] = 0; num[k] = 0; });
            sp.forEach(a => { const k = a.lastPitch.location; if (den[k] !== undefined) { den[k]++; if (a.isHardHit) num[k]++; } });
            return (
              <div key={side} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, marginBottom: 6, letterSpacing: 1 }}>{side === "R" ? "RHB" : "LHB"} ({sp.length})</div>
                <div style={{ display: "inline-grid", gridTemplateColumns: "24px repeat(3,42px) 24px", gridTemplateRows: "24px repeat(3,42px) 24px 24px", gap: 2 }}>
                  {STRIKE_ZONES.map(z => { const v = cellViz(den[z.k], num[z.k]); return (
                    <div key={z.k} style={{ gridRow: z.r + 1, gridColumn: z.c + 1, background: v.bg, color: v.col, borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "2px solid " + G.bd }}>
                      {den[z.k] > 0 ? (<><div style={{ fontSize: 12, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{v.txt}</div><div style={{ fontSize: 7, opacity: 0.8 }}>n={den[z.k]}</div></>) : <div style={{ fontSize: 9, color: G.tx3 }}>·</div>}
                    </div> ); })}
                  {BALL_ZONES.map(z => { const v = cellViz(den[z.k], num[z.k]); return (
                    <div key={z.k} style={{ gridRow: (z.r + 1) + " / span " + z.rowSpan, gridColumn: (z.c + 1) + " / span " + z.colSpan, background: den[z.k] > 0 ? v.bg : "#0d0d0d", color: v.col, borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px dashed " + G.bd2 }}>
                      {den[z.k] > 0 ? (<><div style={{ fontSize: 10, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{v.txt}</div><div style={{ fontSize: 7, opacity: 0.8 }}>n={den[z.k]}</div></>) : <div style={{ fontSize: 7, color: G.tx3 }}>{z.k === "dirt" ? "DIRT" : (side === "R" ? z.rL : z.lL)}</div>}
                    </div> ); })}
                </div>
              </div> );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 2, background: "#E24B4A" }} /><span style={{ fontSize: 10, color: G.tx3, fontWeight: 700 }}>Attack .400+</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 2, background: "#E0A53B" }} /><span style={{ fontSize: 10, color: G.tx3, fontWeight: 700 }}>Mixed</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 2, background: "#3F7CC0" }} /><span style={{ fontSize: 10, color: G.tx3, fontWeight: 700 }}>Lay off &lt;.250</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(130,130,130,0.22)", border: "0.5px solid " + G.bd2 }} /><span style={{ fontSize: 10, color: G.tx3, fontWeight: 700 }}>Small sample</span></div>
        </div>
      </div> );
  };

  if (hitterNames.length === 0) {
    return (
      <div>
        <ScopeBar scope={scope} />
        <div style={{ ...cd, textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: G.tx, marginBottom: 8 }}>Hitting</div>
          <div style={{ fontSize: 12, color: G.tx3, lineHeight: 1.7, maxWidth: 380, margin: "0 auto" }}>
            No hitter data in this scope yet. Enter player names on the lineup card when creating a game; QAB and Hard Hit build as you chart, and can be added after the game from the Chart tab.
          </div>
        </div>
      </div>
    );
  }

  const cellStyle = (c, isTeam) => ({
    padding: isTeam ? "9px 6px" : "8px 6px",
    textAlign: c.nm ? "left" : "center",
    fontSize: 13,
    fontFamily: c.nm ? "'Anybody',sans-serif" : "'Azeret Mono',monospace",
    color: c.key === "qab" ? G.gold : (c.nm ? (isTeam ? G.tx : G.blu) : G.tx),
    fontWeight: (c.key === "qab" || c.nm) ? 800 : 600,
    whiteSpace: "nowrap",
    cursor: c.nm && !isTeam ? "pointer" : "default",
    borderBottom: isTeam ? "none" : "1px solid " + G.bd,
    borderTop: isTeam ? "2px solid " + G.bd2 : "none",
    textDecoration: c.nm && !isTeam ? "underline" : "none",
    textDecorationColor: G.bd2,
  });
  const selStyle = { background: G.sf2, color: G.tx, border: "1px solid " + G.bd2, borderRadius: 6, padding: "6px 8px", fontSize: 12, fontFamily: "'Anybody',sans-serif" };
  const filterRow = (f, set) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 10, color: G.tx3, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2 }}>Filters</span>
      <select value={f.pitch} onChange={e => set("pitch", e.target.value)} style={selStyle}><option value="All">All pitches</option><option value="Fastball">Fastball</option><option value="Breaking">Breaking</option><option value="Offspeed">Offspeed</option></select>
      <select value={f.count} onChange={e => set("count", e.target.value)} style={selStyle}><option value="All">Any count</option><option value="Ahead">Ahead</option><option value="Even">Even</option><option value="Behind">Behind</option></select>
      <select value={f.outs} onChange={e => set("outs", e.target.value)} style={selStyle}><option value="All">Any outs</option><option value="0">0 out</option><option value="1">1 out</option><option value="2">2 out</option></select>
      <select value={f.run} onChange={e => set("run", e.target.value)} style={selStyle}><option value="All">Any runners</option><option value="Empty">Empty</option><option value="RISP">RISP</option></select>
    </div>
  );

  return (
    <div>
      <ScopeBar scope={scope} />

      <div style={cd}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={cT}>Hitters — {hitterNames.length} batters</div>
          <button onClick={() => setShowKey(k => !k)} title="What the columns mean" style={{ ...btn("g"), fontSize: 11, padding: "5px 9px", color: G.tx3 }}>{showKey ? "Hide key" : "Key"}</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {filterRow(gf, (k, v) => ({ pitch: setFPitch, count: setFCount, outs: setFOuts, run: setFRun }[k](v)))}
          {anyFilter && <button onClick={clearFilters} style={{ ...btn("g"), fontSize: 11, padding: "5px 9px", color: G.gold }}>Clear</button>}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{cols.map(c => (
              <th key={c.key} title={c.tip || c.label} onClick={() => clickSort(c.key)} style={{ padding: "8px 6px", textAlign: c.nm ? "left" : "center", cursor: "pointer", fontSize: 10, fontWeight: 800, color: sortKey === c.key ? G.gold : G.tx3, whiteSpace: "nowrap", borderBottom: "1px solid " + G.bd2, letterSpacing: 1, textTransform: "uppercase" }}>
                {c.label}{sortKey === c.key ? (sortDir < 0 ? " ▾" : " ▴") : ""}
              </th>
            ))}</tr>
          </thead>
          <tbody>
            {sortedRows.map(row => (
              <tr key={row.name}>
                {cols.map(c => (
                  <td key={c.key} onClick={c.nm ? () => openPop(row.name) : undefined} style={cellStyle(c, false)}>
                    {c.nm ? row.name : c.fmt(c.val(row.abs))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>{cols.map(c => (
              <td key={c.key} style={cellStyle(c, true)}>{c.nm ? "Team" : c.fmt(c.val(allABs))}</td>
            ))}</tr>
          </tfoot>
        </table>

        <div style={{ fontSize: 10, color: G.tx3, marginTop: 10, lineHeight: 1.5 }}>
          QAB is overall. HH, Whiff, Chase, and Take reflect the filters above. Tap a column header to sort, or a hitter's name for their by-zone heat maps and QAB-type breakdown.
        </div>
        {showKey && (
          <div style={{ marginTop: 8, padding: "10px 12px", background: G.sf2, borderRadius: 8, fontSize: 11, color: G.tx2, lineHeight: 1.8 }}>
            <div><span style={{ color: G.tx, fontWeight: 800 }}>QAB</span> — quality at-bat rate (QAB ÷ PA), overall</div>
            <div><span style={{ color: G.tx, fontWeight: 800 }}>HH</span> — hard-hit rate over at-bats (no walks/HBP/sac bunts; sac flies count), reflects filters</div>
            <div style={{ marginTop: 4, color: G.tx3 }}>Tap a hitter for their hard-hit avg by zone (attack / lay off) with its own filters, plus their QAB-type breakdown.</div>
          </div>
        )}
      </div>

      <div style={cd}>
        <div style={cT}>Team Hard-Hit avg by zone{anyFilter ? " · filtered" : ""}</div>
        {renderHeat(allABs.filter(passFilters))}
        <div style={{ fontSize: 10, color: G.tx3, marginTop: 8, textAlign: "center" }}>Hard hits ÷ at-bats ending in each zone. Tap a hitter's name above for their own map.</div>
      </div>

      {popName && (() => {
        const row = rows.find(r => r.name === popName);
        const abs = row ? row.abs : [];
        const oQab = qabRate(abs);
        const oHH = rate(cnt(abs, a => a.isHardHit && isHHab(a)), cnt(abs, isHHab));
        const popAbs = abs.filter(a => matchF(a, popF));
        const popActive = popF.pitch !== "All" || popF.count !== "All" || popF.outs !== "All" || popF.run !== "All";
        return (
          <div onClick={() => setPopName(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: G.sf, border: "1px solid " + G.bd, borderRadius: 12, padding: 20, width: "100%", maxWidth: 560, margin: "12px 0", boxShadow: "0 4px 24px rgba(0,0,0,0.7)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: G.tx }}>{popName}</div>
                <button onClick={() => setPopName(null)} style={{ ...btn("g"), fontSize: 12, padding: "6px 10px" }}>Close</button>
              </div>
              <div style={{ fontSize: 12, color: G.tx3, marginBottom: 12 }}>QAB <span style={{ color: G.gold, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{fmtAvg(oQab)}</span> · HH <span style={{ color: G.tx, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{fmtAvg(oHH)}</span> <span style={{ opacity: 0.7 }}>(all situations)</span></div>
              <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>QAB types (all situations)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {qabTypes.map(t => (
                  <div key={t.l} style={{ background: G.sf2, borderRadius: 6, padding: "5px 10px", fontSize: 11, color: G.tx2 }}>{t.l} <span style={{ color: G.gold, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{cnt(abs, t.fn)}</span></div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {[["hh", "Hard-hit"], ["whiff", "Whiff"], ["chase", "Chase"], ["take", "Take"]].map(([k, lbl]) => (
                  <button key={k} onClick={() => setPopMetric(k)} style={{ ...btn(popMetric === k ? "p" : "g"), fontSize: 11, padding: "5px 11px", fontWeight: 800 }}>{lbl}</button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>{({ hh: "Hard-hit avg", whiff: "Whiff %", chase: "Chase %", take: "Take %" })[popMetric]} by zone{popActive ? " (filtered)" : ""}</div>
              <div style={{ marginBottom: 12 }}>{filterRow(popF, (k, v) => setPopF(f => ({ ...f, [k]: v })))}</div>
              {popMetric === "hh" ? renderHeat(popAbs) : renderDiscHeat(abs, popMetric, popF)}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
