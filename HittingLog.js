function HittingLog({ game, onUpdate, onClose }) {
  const RESULT_LABEL = { hit: "Hit", roe: "Reached on error", hbp: "HBP", K: "Strikeout", Kc: "Strikeout (looking)", go: "Groundout", fo: "Flyout", po: "Popup", lo: "Lineout", gdp: "Double play", out: "Out", ball: "Walk" };
  const TAGS = [
    { k: "qab", l: "QAB" },
    { k: "hardHit", l: "Hard hit" },
    { k: "sacFly", l: "Sac fly" },
    { k: "sacBunt", l: "Sac bunt" },
    { k: "advRunner", l: "Adv runner" },
    { k: "rbi", l: "RBI" },
  ];
  const lineup = game.lineup || [];
  const nameMap = {};
  lineup.forEach(s => { if (s.name && s.name.trim()) nameMap[s.slot] = s.name.trim(); });

  const abs = useMemo(() => buildAtBats([game], { includeUnnamed: true }), [game]);

  const [tags, setTags] = useState(() => {
    const m = {};
    abs.forEach(ab => { m[ab.lastPitch.id] = { ...(ab.lastPitch.atBatTags || {}) }; });
    return m;
  });
  const [hitters, setHitters] = useState(() => {
    const m = {};
    abs.forEach(ab => { m[ab.lastPitch.id] = ab.name || ""; });
    return m;
  });

  const is = { background: G.sf2, border: "1px solid " + G.bd2, borderRadius: 6, padding: "6px 9px", color: G.tx, fontSize: 13, outline: "none", width: 150, fontFamily: "'Azeret Mono',monospace" };

  // Auto QAB = the rule-based part WITHOUT any tags (6+ pitch, walk, hit, etc.)
  const autoQAB = (ab) => isQAB({ ...ab.lastPitch, atBatTags: {} }, ab.pitches);
  // Effective tags = whatever is stored on the pitch (incl. auto advRunner/rbi/sac) merged with live local toggles
  const effTags = (ab) => ({ ...(ab.lastPitch.atBatTags || {}), ...(tags[ab.lastPitch.id] || {}) });
  const abQAB = (ab) => autoQAB(ab) || Object.values(effTags(ab)).some(Boolean);
  const toggleTag = (id, k) => setTags(prev => {
    const ab = abs.find(a => a.lastPitch.id === id);
    const base = (prev[id] !== undefined) ? prev[id] : { ...((ab && ab.lastPitch.atBatTags) || {}) };
    return { ...prev, [id]: { ...base, [k]: !base[k] } };
  });

  const totalAB = abs.length;
  const qabCount = abs.filter(abQAB).length;
  const hhCount = abs.filter(ab => effTags(ab).hardHit).length;
  const fmtAvg = (m, t) => (t ? (m / t).toFixed(3).replace(/^0/, "") : ".000");

  const save = () => {
    const tagFor = {};
    const hitterFor = {};
    abs.forEach(ab => {
      tagFor[ab.lastPitch.id] = tags[ab.lastPitch.id] || {};
      const typed = (hitters[ab.lastPitch.id] || "").trim();
      const lineupName = nameMap[ab.slot] || "";
      const override = (typed && typed !== lineupName) ? typed : "";
      ab.pitches.forEach(p => { hitterFor[p.id] = override; });
    });
    const newPitches = game.pitches.map(p => {
      const np = { ...p };
      if (Object.prototype.hasOwnProperty.call(tagFor, p.id)) {
        const t = tagFor[p.id];
        if (t && Object.values(t).some(Boolean)) np.atBatTags = t; else delete np.atBatTags;
      }
      if (Object.prototype.hasOwnProperty.call(hitterFor, p.id)) {
        if (hitterFor[p.id]) np.hitter = hitterFor[p.id]; else delete np.hitter;
      }
      return np;
    });
    onUpdate({ ...game, pitches: newPitches });
    onClose();
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div style={{ background: G.sf, border: "1px solid " + G.bd, borderRadius: 12, padding: 20, width: "100%", maxWidth: 680, margin: "12px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: G.tx }}>⚾ Log Hitting — vs {game.opponent}</div>
          <button onClick={onClose} style={{ ...btn("g"), fontSize: 12, padding: "6px 10px" }}>Close</button>
        </div>
        <div style={{ fontSize: 11, color: G.tx3, marginBottom: 14 }}>Auto-detected QABs are marked. Tag the rest, and rename any at-bat for a pinch hitter.</div>
        {abs.length === 0 ? (
          <div style={{ fontSize: 12, color: G.tx3, padding: "16px 0", textAlign: "center" }}>No at-bats yet. Chart the game (and add your lineup) first, then come back to tag hitting.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, background: G.sf2, borderRadius: 8, padding: "8px 12px" }}><div style={{ fontSize: 10, color: G.tx3 }}>Team QAB</div><div style={{ fontSize: 18, fontWeight: 800, color: G.gold }}>{qabCount} / {totalAB}</div></div>
              <div style={{ flex: 1, background: G.sf2, borderRadius: 8, padding: "8px 12px" }}><div style={{ fontSize: 10, color: G.tx3 }}>QAB avg</div><div style={{ fontSize: 18, fontWeight: 800, color: G.gold }}>{fmtAvg(qabCount, totalAB)}</div></div>
              <div style={{ flex: 1, background: G.sf2, borderRadius: 8, padding: "8px 12px" }}><div style={{ fontSize: 10, color: G.tx3 }}>Hard hit</div><div style={{ fontSize: 18, fontWeight: 800, color: G.gold }}>{hhCount}</div></div>
            </div>
            {abs.map((ab) => {
              const id = ab.lastPitch.id;
              const q = abQAB(ab);
              const auto = autoQAB(ab);
              const anyTag = Object.values(effTags(ab)).some(Boolean);
              return (
                <div key={id} style={{ background: G.sf2, border: "1px solid " + G.bd, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ color: G.tx3, fontSize: 12, fontFamily: "'Azeret Mono',monospace" }}>#{ab.slot}</span>
                      <input value={hitters[id]} onChange={e => setHitters(prev => ({ ...prev, [id]: e.target.value }))} placeholder={"Order " + ab.slot} style={is} />
                      <span style={{ fontSize: 12, color: G.tx2 }}>{RESULT_LABEL[ab.lastPitch.result] || ab.lastPitch.result} · {ab.pitches.length}p</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 4, background: q ? G.grn + "22" : "transparent", color: q ? G.grn : G.tx3 }}>{q ? (auto && !anyTag ? "QAB \u00b7 auto" : "QAB") : "not QAB"}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {TAGS.map(t => {
                      const on = !!effTags(ab)[t.k];
                      return (
                        <button key={t.k} onClick={() => toggleTag(id, t.k)} style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, cursor: "pointer", background: on ? G.gold + "30" : "transparent", color: on ? G.gold : G.tx3, border: "1px solid " + (on ? G.gold : G.bd2) }}>{t.l}</button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={onClose} style={{ ...btn("g"), fontSize: 12 }}>Cancel</button>
              <button onClick={save} style={{ ...btn("p"), fontSize: 12 }}>Save Hitting</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}