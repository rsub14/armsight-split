/* --- NEW GAME --- */
function NewG({ onSave, onCancel, allGames = [], roster = [], onSaveRoster }) {
  const [opp, setOpp] = useState("");
  const [team, setTeam] = useState(() => { const prev = [...allGames].reverse().find(g => g.team); return prev ? prev.team : ""; });
  const [pit, setPit] = useState("");
  const [pitHand, setPitHand] = useState("R");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [showLineup, setShowLineup] = useState(false);
  const [lineup, setLineup] = useState(
    Array.from({ length: 9 }, (_, i) => ({ slot: i + 1, name: "", hand: "R", bats: "R" }))
  );
  // Assign a roster player into a slot (fills name + bats), or clear it
  const assignPlayer = (slotIdx, player) => setLineup(prev => prev.map((s, idx) => idx === slotIdx ? (player ? { slot: idx + 1, name: player.name, num: player.num || "", bats: player.bats, hand: player.bats === "L" ? "L" : "R", rosterId: player.id } : { slot: idx + 1, name: "", hand: "R", bats: "R" }) : s));

  // Inline "add a brand-new hitter" while building the lineup. The player is saved into
  // the team roster (same path as RosterManager) AND dropped into the current slot with a
  // stable rosterId so their pitches stamp + aggregate under the per-player filter.
  const [addSlot, setAddSlot] = useState(null);
  const [npNum, setNpNum] = useState("");
  const [npName, setNpName] = useState("");
  const [npBats, setNpBats] = useState("R");
  const resetAdd = () => { setAddSlot(null); setNpNum(""); setNpName(""); setNpBats("R"); };
  const addNewPlayer = () => {
    if (!npName.trim() || addSlot === null) return;
    const newPlayer = { id: Date.now() + Math.random(), num: npNum.trim(), name: npName.trim(), bats: npBats };
    if (onSaveRoster) onSaveRoster([...roster, newPlayer]);
    assignPlayer(addSlot, newPlayer);
    resetAdd();
  };
  const is = { background: G.sf2, border: "2px solid " + G.bd2, borderRadius: 6, padding: "8px 10px", color: G.tx, fontSize: 14, fontWeight: 700, outline: "none", width: "100%", boxSizing: "border-box" };
  const updLineup = (i, field, val) => setLineup(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val, ...(field === "bats" ? { hand: val === "L" ? "L" : "R" } : {}) } : s));

  // Known opponents from previous games
  const knownOpponents = [...new Set(allGames.map(g => g.opponent).filter(Boolean))].sort();
  const [usePrimer, setUsePrimer] = useState(true);
  const [pregame, setPregame] = useState(false);   // pregame = scouted vs a different opponent (video/scouting)
  const [faced, setFaced] = useState("");           // optional: team faced in that footage (display-only metadata)

  // Known pitchers for this opponent
  const knownPitchers = useMemo(() => {
    if (!opp.trim()) return [];
    const matchingGames = allGames.filter(g =>
      g.opponent?.toLowerCase().trim() === opp.toLowerCase().trim()
    );
    const pitchers = new Set();
    matchingGames.forEach(g => {
      if (g.pitcher) pitchers.add(g.pitcher.trim());
      g.pitches?.forEach(p => { if (p.pitcher) pitchers.add(p.pitcher.trim()); });
    });
    return [...pitchers].sort();
  }, [opp, allGames.length]);

  // Historical pitches for selected pitcher across all previous games
  const historicalPitches = useMemo(() => {
    if (!pit.trim() || !opp.trim()) return [];
    return allGames
      .filter(g => g.opponent?.toLowerCase().trim() === opp.toLowerCase().trim())
      .flatMap(g => (g.pitches || []).filter(p =>
        (p.pitcher || g.pitcher || "").trim().toLowerCase() === pit.trim().toLowerCase()
        && !EVENTS.has(p.type) && p.result !== "ibb"
      ));
  }, [pit, opp, allGames.length]);

  const primerGamesCount = useMemo(() => {
    if (!pit.trim() || !opp.trim()) return 0;
    return allGames.filter(g =>
      g.opponent?.toLowerCase().trim() === opp.toLowerCase().trim() &&
      (g.pitches || []).some(p => (p.pitcher || g.pitcher || "").trim().toLowerCase() === pit.trim().toLowerCase())
    ).length;
  }, [pit, opp, allGames.length]);

  // Split the primer pool into live vs pregame so the coach knows where their priors came from
  const primerSplit = useMemo(() => {
    if (!pit.trim() || !opp.trim()) return { live: 0, pregame: 0 };
    let live = 0, pre = 0;
    allGames
      .filter(g => g.opponent?.toLowerCase().trim() === opp.toLowerCase().trim())
      .forEach(g => (g.pitches || []).forEach(p => {
        if ((p.pitcher || g.pitcher || "").trim().toLowerCase() !== pit.trim().toLowerCase()) return;
        if (EVENTS.has(p.type) || p.result === "ibb") return;
        if (g.pregame) pre++; else live++;
      }));
    return { live, pregame: pre };
  }, [pit, opp, allGames.length]);

  return (
    <div style={cd}>
      <div style={cT}>New Game</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: G.gold, fontWeight: 700, marginBottom: 4 }}>Your team{!team ? " (saved for next time)" : ""}</div>
          <input style={{ ...is, marginBottom: 14 }} value={team} onChange={e => setTeam(e.target.value)} placeholder="e.g. ArmSight University" />
          <div style={{ fontSize: 11, color: G.tx2, fontWeight: 700, marginBottom: 4 }}>Opponent</div>
          <input style={is} value={opp} onChange={e => setOpp(e.target.value)} placeholder="e.g. State College" autoFocus list="opp-list" />
          {knownOpponents.length > 0 && (
            <datalist id="opp-list">
              {knownOpponents.map(o => <option key={o} value={o} />)}
            </datalist>
          )}
          {knownOpponents.includes(opp.trim()) && (
            <div style={{ fontSize: 10, color: G.gold, marginTop: 4, fontWeight: 700 }}>
              ✓ Returning opponent — pitcher suggestions available
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, color: G.tx2, fontWeight: 700, marginBottom: 4 }}>Starting Pitcher</div>
          <input style={is} value={pit} onChange={e => setPit(e.target.value)} placeholder="e.g. RHP Smith" list="pit-list" />
          {knownPitchers.length > 0 && (
            <datalist id="pit-list">
              {knownPitchers.map(p => <option key={p} value={p} />)}
            </datalist>
          )}
          {knownPitchers.length > 0 && (
            <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: G.tx3, fontWeight: 700, alignSelf: "center" }}>SEEN BEFORE:</span>
              {knownPitchers.map(p => (
                <button key={p} onClick={() => setPit(p)}
                  style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid " + G.gold + "44", background: pit === p ? G.gold + "25" : "transparent", color: pit === p ? G.gold : G.tx3, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {p}
                </button>
              ))}
            </div>
          )}
          {historicalPitches.length > 0 && (
            <div style={{ marginTop: 10, padding: "10px 14px", background: G.gold + "12", borderRadius: 8, border: "1px solid " + G.gold + "33" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: G.gold }}>
                    📊 Historical data available — {historicalPitches.length} pitches from {primerGamesCount} previous {primerGamesCount === 1 ? "appearance" : "appearances"}
                    {primerSplit.pregame > 0 ? <span style={{ color: G.tx3, fontWeight: 600 }}> ({primerSplit.live} live · {primerSplit.pregame} pregame)</span> : null}
                  </div>
                  <div style={{ fontSize: 10, color: G.tx3, marginTop: 3 }}>
                    Load as starting priors so prediction model begins at Phase 2
                  </div>
                </div>
                <button onClick={() => setUsePrimer(v => !v)}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: usePrimer ? G.gold : G.sf2, color: usePrimer ? "#000" : G.tx2, fontSize: 12, fontWeight: 800, cursor: "pointer", flexShrink: 0, marginLeft: 12 }}>
                  {usePrimer ? "✓ Primer ON" : "Primer OFF"}
                </button>
              </div>
              {usePrimer && (
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(() => {
                    const freq = {};
                    historicalPitches.forEach(p => { freq[p.type] = (freq[p.type] || 0) + 1; });
                    return Object.entries(freq).sort((a,b) => b[1]-a[1]).map(([type, count]) => (
                      <div key={type} style={{ padding: "3px 10px", borderRadius: 4, background: G.sf2, border: "1px solid " + G.bd, fontSize: 10, color: G.tx2, fontWeight: 700, fontFamily: "'Azeret Mono',monospace" }}>
                        {type} {Math.round(count/historicalPitches.length*100)}%
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, color: G.tx2, fontWeight: 700, marginBottom: 4 }}>Pitcher Hand</div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setPitHand("R")} style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: pitHand === "R" ? G.gold : G.sf2, color: pitHand === "R" ? "#000" : G.tx2, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>RHP</button>
            <button onClick={() => setPitHand("L")} style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: pitHand === "L" ? G.gold : G.sf2, color: pitHand === "L" ? "#000" : G.tx2, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>LHP</button>
          </div>
        </div>
        <div><div style={{ fontSize: 11, color: G.tx2, fontWeight: 700, marginBottom: 4 }}>Date</div><input type="date" style={is} value={date} onChange={e => setDate(e.target.value)} /></div>

        {/* Optional lineup card */}
        <div>
          <button onClick={() => setShowLineup(v => !v)} style={{ ...btn("g"), fontSize: 12, padding: "8px 14px", color: G.gold }}>
            {showLineup ? "▲ Hide Lineup" : "▼ Enter Lineup (Optional)"}
          </button>
          {showLineup && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, color: G.tx3, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>
                Your Batting Order {roster.length > 0 ? "\u2014 pick from your roster, or type a name" : "\u2014 set bat side (B = switch, auto-flips vs the pitcher)"}
              </div>
              {roster.length === 0 && (
                <div style={{ fontSize: 10, color: G.tx3, marginBottom: 2 }}>Tip: add your players once in Settings → Manage Team Roster, then just pick them here each game.</div>
              )}
              {lineup.map((slot, i) => (
                <div key={i}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div style={{ width: 20, fontSize: 13, fontWeight: 800, color: G.gold, fontFamily: "'Azeret Mono',monospace", textAlign: "right", flexShrink: 0 }}>{slot.slot}</div>
                    {roster.length > 0 ? (
                      <select value={slot.rosterId || ""} onChange={e => { if (e.target.value === "__add__") { setNpNum(""); setNpName(""); setNpBats(slot.bats || "R"); setAddSlot(i); return; } const pl = roster.find(p => String(p.id) === e.target.value); assignPlayer(i, pl || null); }}
                        style={{ ...is, fontSize: 13, padding: "6px 8px", flex: 1 }}>
                        <option value="">— select —</option>
                        {[...roster].sort((a, b) => (parseInt(a.num) || 99) - (parseInt(b.num) || 99)).map(p => (
                          <option key={p.id} value={p.id}>{(p.num ? "#" + p.num + " " : "") + p.name + " (" + p.bats + ")"}</option>
                        ))}
                        <option value="__add__">+ Add new hitter…</option>
                      </select>
                    ) : (
                      <input value={slot.name} onChange={e => updLineup(i, "name", e.target.value)} placeholder={`Batter ${slot.slot}`} style={{ ...is, fontSize: 13, padding: "6px 8px", flex: 1 }} />
                    )}
                    {["R", "L", "B"].map(h => (
                      <button key={h} onClick={() => updLineup(i, "bats", h)} title={h === "B" ? "Switch hitter \u2014 bats opposite the pitcher automatically" : ""} style={{ padding: "6px 10px", borderRadius: 5, border: "none", background: (slot.bats || slot.hand) === h ? G.gold : G.sf2, color: (slot.bats || slot.hand) === h ? "#000" : G.tx2, fontSize: 12, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>{h}</button>
                    ))}
                  </div>
                  {addSlot === i && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6, marginLeft: 26, padding: "8px 10px", background: G.sf2, border: "1px solid " + G.gold + "55", borderRadius: 8 }}>
                      <input value={npNum} onChange={e => setNpNum(e.target.value)} placeholder="#" style={{ ...is, width: 42, textAlign: "center", fontSize: 13, padding: "6px 8px", flex: "0 0 auto" }} />
                      <input value={npName} onChange={e => setNpName(e.target.value)} autoFocus placeholder="New hitter name" onKeyDown={e => { if (e.key === "Enter") addNewPlayer(); }} style={{ ...is, fontSize: 13, padding: "6px 8px", flex: 1, minWidth: 110 }} />
                      {["R", "L", "B"].map(h => (
                        <button key={h} onClick={() => setNpBats(h)} title={h === "B" ? "Switch hitter" : ""} style={{ padding: "6px 10px", borderRadius: 5, border: "none", background: npBats === h ? G.gold : G.sf, color: npBats === h ? "#000" : G.tx2, fontSize: 12, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>{h}</button>
                      ))}
                      <button onClick={addNewPlayer} style={{ ...btn("g"), padding: "6px 12px", color: G.grn, fontWeight: 800, fontSize: 12 }}>Add</button>
                      <button onClick={resetAdd} style={{ ...btn("g"), padding: "6px 10px", color: G.tx3, fontSize: 12 }}>Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: pregame ? "#9b59ff14" : G.sf2, border: "1px solid " + (pregame ? "#9b59ff55" : G.bd), borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: pregame ? "#b794ff" : G.tx2, marginBottom: 2 }}>Game type</div>
          <div style={{ fontSize: 10, color: G.tx3, marginBottom: 8, lineHeight: 1.5 }}>Pregame scout = charted from video/scouting of another matchup. Feeds tendencies, reads &amp; primer — excluded from outcome stats &amp; the Hitting tab.</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setPregame(false)}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: !pregame ? G.gold : G.sf2, color: !pregame ? "#000" : G.tx2, fontSize: 12, fontWeight: 800, cursor: "pointer", outline: !pregame ? "2px solid " + G.gold : "none", outlineOffset: 1 }}>
              {!pregame ? "✓ " : ""}Live game
            </button>
            <button onClick={() => setPregame(true)}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: pregame ? "#9b59ff" : G.sf2, color: pregame ? "#fff" : G.tx2, fontSize: 12, fontWeight: 800, cursor: "pointer", outline: pregame ? "2px solid #9b59ff" : "none", outlineOffset: 1 }}>
              {pregame ? "✓ " : ""}Pregame scout
            </button>
          </div>
          {pregame && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: G.tx3, fontWeight: 700, marginBottom: 4 }}>Opponent faced in footage (optional)</div>
              <input style={is} value={faced} onChange={e => setFaced(e.target.value)} placeholder="e.g. Central HS" />
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { if (opp && pit) onSave({ opp, pit, pitHand, date, lineup, team: team.trim(), pregame, faced: pregame ? faced.trim() : "", primerPitches: (usePrimer && historicalPitches.length > 0) ? historicalPitches : [] }); }} style={btn("p", !(opp && pit))} disabled={!(opp && pit)}>Start Charting</button>
          <button onClick={onCancel} style={btn("g")}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
