function App() {
  const [licKey, setLicKey]     = useState(() => loadLicense());
  const [tier, setTier]         = useState(() => validateKey(loadLicense()));
  const [showSettings, setShowSettings] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [fbUser, setFbUser]     = useState(null);   // { uid, email } for Elite
  const [fbReady, setFbReady]   = useState(false);  // true once Firebase data loaded
  const [showFbAuth, setShowFbAuth] = useState(false);
  const [tab, setTab] = useState("games");
  const [data, setData] = useState(() => loadData());
  const [activeId, setActiveId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [chartState, setChartState] = useState(CHART_DEFAULTS);

  const fbUnsubRef   = React.useRef(null);
  const activeIdRef  = React.useRef(null);  // mirror of activeId readable in closures

  // Keep ref in sync with state
  React.useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const doSave = (d) => {
    setData(d);
    saveData(d);
  };

  // Save, edit or delete a scouting note for a team
  const saveNote = (team, text, id = null, del = false) => {
    const notes = { ...(data.scoutingNotes || {}) };
    const teamNotes = [...(notes[team] || [])];
    if (del && id) {
      notes[team] = teamNotes.filter(n => n.id !== id);
    } else if (id) {
      // Edit existing
      notes[team] = teamNotes.map(n => n.id === id ? { ...n, text, ts: new Date().toISOString() } : n);
    } else {
      // Add new
      notes[team] = [...teamNotes, { id: Date.now(), text, ts: new Date().toISOString() }];
    }
    const nd = { ...data, scoutingNotes: notes, metaUpdatedAt: Date.now() };
    doSave(nd);
    if (tier === "elite" && fbUser) fbSaveMeta(fbUser.uid, nd);
  };

  const doSaveGame = (game) => {
    game = { ...game, updatedAt: Date.now() };
    const newData = { ...data, games: data.games.map(g => g.id === game.id ? game : g) };
    setData(newData);
    saveData(newData);
    if (tier === "elite" && fbUser) fbSaveGame(fbUser.uid, game);
  };

  // Start real-time Firestore listener — replaces one-time load
  const startRealtimeSync = (uid) => {
    if (fbUnsubRef.current) { fbUnsubRef.current(); fbUnsubRef.current = null; }

    try {
      const { db } = getFB();
      if (!db || !uid) return;

      const unsub = db.collection("users").doc(uid).collection("games")
        .onSnapshot(snap => {
          const cloudGames = snap.docs.map(d => d.data());
          const removedIds = snap.docChanges().filter(c => c.type === "removed").map(c => (c.doc.data() || {}).id).filter(Boolean);

          // ── SYNC CHART STATE — must run OUTSIDE setData to avoid setState-in-setState ──
          const curActiveId = activeIdRef.current;
          if (curActiveId) {
            const cloudGame = cloudGames.find(cg => cg.id === curActiveId);
            if (cloudGame) {
              const cloudCount = (cloudGame.pitches || []).length;
              // Read the local copy from a DOM-independent source
              const localG = (() => { try { const d = JSON.parse(localStorage.getItem("armsight_v1") || "{}"); return (d.games || []).find(g => g.id === curActiveId) || null; } catch(e) { return null; } })();
              const localCount = ((localG || {}).pitches || []).length;
              const cloudWins = cloudGame.updatedAt ? (!(localG && localG.updatedAt) || cloudGame.updatedAt >= localG.updatedAt) : cloudCount > localCount;
              if (cloudWins && cloudCount !== localCount) {
                setChartState(deriveStateFromGame(cloudGame));
              }
            }
          }

          setData(prev => {
            let merged = [...prev.games];
            let changed = false;
            if (removedIds.length) {
              const before = merged.length;
              merged = merged.filter(g => !removedIds.includes(g.id));
              if (merged.length !== before) changed = true;
            }
            cloudGames.forEach(cg => {
              const idx = merged.findIndex(lg => lg.id === cg.id);
              if (idx >= 0) {
                const lg = merged[idx];
                if (!lg || (cg.updatedAt ? (!lg.updatedAt || cg.updatedAt >= lg.updatedAt) : (cg.pitches && cg.pitches.length >= (lg.pitches || []).length))) {
                  merged[idx] = cg;
                  changed = true;
                }
              } else {
                merged.push(cg);
                changed = true;
              }
            });
            if (!changed) return prev;
            merged.sort((a, b) => b.id - a.id);
            const newData = { ...prev, games: merged };
            saveData(newData);
            return newData;
          });

          setFbReady(true);
        }, err => {
          console.warn("[ArmSight] Firestore sync error:", err);
          setFbReady(true);
        });

      // Meta doc (notes + prefs) listener \u2014 newer cloud timestamp wins for notes/prefs.
      // Roster is reconciled separately (cloud-wins) so it isn't blocked by the timestamp gate.
      const unsubMeta = db.collection("users").doc(uid).onSnapshot(docSnap => {
        const m = docSnap.data();
        if (!m) return;
        setData(prev => {
          // Roster: cloud always wins when the cloud has one and it differs from local.
          const cloudRoster = Array.isArray(m.roster) ? m.roster : null;
          const rosterChanged = cloudRoster && cloudRoster.length && JSON.stringify(cloudRoster) !== JSON.stringify(prev.roster || []);
          // Notes/prefs: keep the newer-timestamp-wins behavior.
          const metaNewer = m.metaUpdatedAt && m.metaUpdatedAt > (prev.metaUpdatedAt || 0);
          if (!rosterChanged && !metaNewer) return prev;
          const nd = {
            ...prev,
            scoutingNotes: metaNewer ? (m.scoutingNotes || prev.scoutingNotes || {}) : (prev.scoutingNotes || {}),
            prefs:         metaNewer ? (m.prefs || prev.prefs || {})               : (prev.prefs || {}),
            roster:        rosterChanged ? cloudRoster : (prev.roster || []),
            metaUpdatedAt: metaNewer ? m.metaUpdatedAt : (prev.metaUpdatedAt || 0),
          };
          saveData(nd);
          return nd;
        });
      }, err => console.warn("[ArmSight] Meta sync error:", err));

      fbUnsubRef.current = () => { unsub(); unsubMeta(); };
    } catch(e) {
      console.warn("[ArmSight] Firestore listener failed:", e);
      setFbReady(true);
    }
  };

  // When Elite user signs in, start real-time sync
  const handleFbSignIn = (uid, email) => {
    setFbUser({ uid, email });
    setShowFbAuth(false);
    startRealtimeSync(uid);
  };

  const handleFbSignOut = () => {
    // Clean up listener before signing out
    if (fbUnsubRef.current) { fbUnsubRef.current(); fbUnsubRef.current = null; }
    try { const { auth } = getFB(); if (auth) auth.signOut(); } catch(e) {}
    setFbUser(null);
    setFbReady(false);
  };

  // Revalidate the license against the server at most every 12h. Only an affirmative
  // "invalid" locks; offline / server trouble keeps the coach working (grace).
  useEffect(() => {
    if (!licKey || !tier) return;
    try {
      const last = JSON.parse(localStorage.getItem(LIC_CHECK_KEY) || "null");
      if (last && last.key === licKey && Date.now() - last.ts < 12 * 60 * 60 * 1000) return;
    } catch (e) {}
    serverValidateKey(licKey).then(r => {
      if (r.status === "valid") {
        try { localStorage.setItem(LIC_CHECK_KEY, JSON.stringify({ key: licKey, tier: r.tier, ts: Date.now() })); } catch (e) {}
        if (r.tier !== tier) setTier(r.tier);
      } else if (r.status === "invalid") {
        try { localStorage.removeItem(LIC_CHECK_KEY); } catch (e) {}
        clearLicense(); setLicKey(null); setTier(null);
        try { alert("This license key is not recognized. Please re-enter your key or contact coach@armsight.app."); } catch (e) {}
      }
    });
  }, [licKey, tier]);

  // Auto sign-in if Firebase auth session persists
  useEffect(() => {
    if (tier !== "elite") return;
    const { auth } = getFB();
    if (!auth) return;
    const unsub = auth.onAuthStateChanged(user => {
      if (user) handleFbSignIn(user.uid, user.email);
      else setFbReady(true);
    });
    return () => unsub();
  }, [tier]);

  // Clean up Firestore listener on unmount
  useEffect(() => {
    return () => {
      if (fbUnsubRef.current) { fbUnsubRef.current(); fbUnsubRef.current = null; }
    };
  }, []);
  const create = ({ opp, pit, pitHand, date, lineup, team = "", primerPitches = [], pregame = false, faced = "" }) => {
    const g = { id: Date.now(), updatedAt: Date.now(), team, opponent: opp, pitcher: pit, pitcherHand: pitHand || "R", date, pitches: [], relievers: [], pitchTypes: [...DEFAULT_PT], lineup: lineup || [], primerPitches, pregame, faced };
    doSave({ ...data, games: [g, ...data.games] });
    if (tier === "elite" && fbUser) fbSaveGame(fbUser.uid, g);
    setActiveId(g.id);
    setChartState({ ...CHART_DEFAULTS, curP: pit });
    setShowNew(false); setTab("chart");
  };
  const update = (g) => { doSaveGame(g); };
  const importCSV = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { pitches, pitcher, skipped, meta } = parsePitchCSV(String(reader.result));
        if (!pitches.length) { alert("No valid pitch rows found." + (skipped ? " " + skipped + " row(s) had unrecognized results." : "") + " Expected a header row with at least: type, location, result (optional: game, date, pitcher, batOrder, balls, strikes, outs, batSide, inning, runners, tags, bunt)."); return; }
        // Build pitchTypes from the keys actually present, falling back to defaults for known ones
        const seenTypes = [...new Set(pitches.map(p => p.type).filter(Boolean))];
        const ptList = seenTypes.length ? seenTypes.map(k => { const d = DEFAULT_PT.find(x => x.key === k); return d || { key: k, label: k, family: "offspeed" }; }) : [...DEFAULT_PT];
        // Reconstruct a lineup from any batOrder+batSide seen
        const lineupMap = {};
        pitches.forEach(p => { if (p.batOrder >= 1 && p.batOrder <= 9 && !lineupMap[p.batOrder]) lineupMap[p.batOrder] = { slot: p.batOrder, name: "", hand: p.batSide || "R" }; });
        const lineup = Object.values(lineupMap).sort((a, b) => a.slot - b.slot);
        const g = { id: Date.now(), updatedAt: Date.now(), team: "", opponent: meta.opponent || "CSV Import", pitcher: pitcher || "Imported", pitcherHand: (pitches.find(p => p.batSide) ? "R" : "R"), date: meta.date || new Date().toISOString().slice(0, 10), pitches, relievers: [], pitchTypes: ptList, lineup, primerPitches: [], pregame: false, faced: "" };
        doSave({ ...data, games: [g, ...data.games] });
        if (tier === "elite" && fbUser) fbSaveGame(fbUser.uid, g);
        alert("Imported " + pitches.length + " pitches into \"" + g.opponent + "\" (" + g.pitcher + ")." + (skipped ? " Skipped " + skipped + " unrecognized row(s)." : "") + " Open it from the Games list.");
        setTab("games");
      } catch (err) { alert("Could not parse that CSV: " + err.message); }
    };
    reader.readAsText(file);
  };
  const del = (id) => { const nd = { ...data, games: data.games.filter(x => x.id !== id) }; doSave(nd); if (tier === "elite" && fbUser) fbDeleteGame(fbUser.uid, id); if (activeId === id) { setActiveId(null); setTab("games"); } };
  const restoreBackup = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed.format === "armsight-backup" && parsed.data && Array.isArray(parsed.data.games)) {
          const incoming = parsed.data.games;
          const byId = {}; data.games.forEach(g => byId[g.id] = g); incoming.forEach(g => byId[g.id] = g);
          const merged = Object.values(byId);
          const nd = { ...data, ...parsed.data, games: merged, metaUpdatedAt: Date.now() };
          doSave(nd);
          if (tier === "elite" && fbUser) { merged.forEach(g => fbSaveGame(fbUser.uid, g)); fbSaveMeta(fbUser.uid, nd); }
          alert("Restored " + incoming.length + " game(s) from backup. Existing games with the same date were kept up to date; nothing was deleted.");
          setTab("games");
        } else if (parsed.format === "armsight-game" && parsed.game) {
          const g = parsed.game; const exists = data.games.some(x => x.id === g.id);
          const nd = { ...data, games: exists ? data.games.map(x => x.id === g.id ? g : x) : [g, ...data.games] };
          doSave(nd);
          if (tier === "elite" && fbUser) fbSaveGame(fbUser.uid, g);
          alert((exists ? "Updated" : "Imported") + " game vs " + (g.opponent || "?") + " (" + (g.pitches || []).length + " pitches).");
          setTab("games");
        } else { alert("That doesn't look like an ArmSight export file."); }
      } catch (err) { alert("Could not read that backup: " + err.message); }
    };
    reader.readAsText(file);
  };
  const active = data.games.find(g => g.id === activeId);
  const total = data.games.reduce((a, g) => a + g.pitches.length, 0);

  // If no valid license, show gate screen
  if (!tier) {
    return <LicenseGate onUnlock={(k, t) => { setLicKey(k); setTier(t); }} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: G.bg, color: G.tx, fontFamily: "'Anybody',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Anybody:wght@400;500;600;700;800&family=Azeret+Mono:wght@400;500;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:${G.bd2};border-radius:3px}select option{background:#000;color:#fff}button{-webkit-tap-highlight-color:transparent}@media(hover:hover){button:hover{filter:brightness(1.15)}}`}</style>
      {showRoster && <RosterManager roster={data.roster || []} onClose={() => setShowRoster(false)} onSave={(r) => { const nd = { ...data, roster: r, metaUpdatedAt: Date.now() }; doSave(nd); if (tier === "elite" && fbUser) fbSaveMeta(fbUser.uid, nd); }} />}
      {showSettings && <SettingsPanel licKey={licKey} tier={tier} onClose={() => setShowSettings(false)} onManageRoster={() => { setShowSettings(false); setShowRoster(true); }}
        onClearKey={() => { clearLicense(); setLicKey(null); setTier(null); setShowSettings(false); handleFbSignOut(); }}
        fbUser={fbUser} onFbSignOut={handleFbSignOut} onShowFbAuth={() => { setShowSettings(false); setShowFbAuth(true); }}
        prefs={data.prefs || {}} onSavePrefs={(p) => { const nd = { ...data, prefs: { ...(data.prefs || {}), ...p }, metaUpdatedAt: Date.now() }; doSave(nd); if (tier === "elite" && fbUser) fbSaveMeta(fbUser.uid, nd); }} data={data} onRestore={restoreBackup} />}
      {showFbAuth && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 400 }}>
            <FirebaseAuth onSignedIn={handleFbSignIn} />
            <button onClick={() => setShowFbAuth(false)} style={{ ...btn("g"), width: "100%", marginTop: 10, color: G.tx3 }}>Cancel</button>
          </div>
        </div>
      )}
      <header style={{ padding: "12px 20px", borderBottom: "2px solid " + G.bd, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#000", position: "sticky", top: 0, zIndex: 100, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="36" height="44" viewBox="0 0 112 124" style={{ flexShrink: 0 }}>
            <path d="M4,4 L108,4 L108,76 L56,120 L4,76 Z" fill="#FFD700"/>
            <polygon points="12,108 30,108 56,16 40,16" fill="#000"/>
            <polygon points="100,108 82,108 56,16 72,16" fill="#000"/>
            <rect x="34" y="72" width="44" height="16" fill="#FFD700"/>
            <polygon points="34,88 42,88 36,72 34,72" fill="#000"/>
            <polygon points="78,88 70,88 76,72 78,72" fill="#000"/>
            <rect x="8" y="100" width="28" height="12" rx="1" fill="#000"/>
            <rect x="76" y="100" width="28" height="12" rx="1" fill="#000"/>
          </svg>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: 0.5 }}>
              <span style={{ color: G.tx }}>Arm</span><span style={{ color: G.gold }}>Sight</span>
            </div>
            <div style={{ fontSize: 9, color: G.tx3, letterSpacing: 3, textTransform: "uppercase", fontWeight: 700 }}>Pitcher Intelligence</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <nav style={{ display: "flex", gap: 2, background: G.sf, borderRadius: 8, padding: 3, border: "2px solid " + G.bd }}>
            {[
              { id: "games", l: "Games" },
              { id: "chart", l: "Chart", d: !active },
              { id: "tendencies", l: "Pitching Tendencies" },
              { id: "baserunning", l: "Baserunning" },
              { id: "hitting", l: "Hitting" },
              { id: "library", l: "Library" },
            ].map(t => (
              <button key={t.id} disabled={t.d} onClick={() => setTab(t.id)} style={{ padding: "7px 12px", borderRadius: 6, border: "none", background: tab === t.id ? G.gold : "transparent", color: tab === t.id ? "#000" : t.d ? G.tx3 + "44" : G.tx2, fontSize: 11, fontWeight: 800, cursor: t.d ? "default" : "pointer", fontFamily: "'Anybody',sans-serif" }}>
                {t.l}
                {t.d && t.id !== "chart" && <span style={{ marginLeft: 3, fontSize: 8, opacity: 0.6 }}>🔒</span>}
              </button>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: TIER_COLOR[tier] || G.tx3, color: "#000", borderRadius: 3, padding: "2px 7px", fontSize: 9, fontWeight: 800 }}>{getTierLabel(tier)}</span>
            {tier === "elite" && <span style={{ fontSize: 9, fontWeight: 800, color: fbUser ? G.grn : G.tx3 }} title={fbUser ? "Cloud synced: " + fbUser.email : "Not synced"}>{fbUser ? "●" : "○"}</span>}
            <button onClick={() => setShowSettings(true)} style={{ background: "transparent", border: "1px solid " + G.bd2, borderRadius: 6, color: G.tx3, fontSize: 16, cursor: "pointer", padding: "4px 8px", lineHeight: 1 }} title="Settings">⚙</button>
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 920, margin: "0 auto", padding: 16 }}>
        {tab === "games" && !showNew && <GList games={data.games.filter(g => g.status !== "complete")} onSelect={id => { if (id !== activeId) { const g = data.games.find(x => x.id === id); setChartState(g ? deriveStateFromGame(g) : { ...CHART_DEFAULTS }); } setActiveId(id); setTab("chart"); }} onCreate={() => setShowNew(true)} onDelete={del} onExport={exportGame} onExportCSV={exportGameCSV} onImport={importCSV} warnNoBackup={!(tier === "elite" && fbUser)} />}
        {tab === "games" && showNew && <NewG onSave={create} onCancel={() => setShowNew(false)} allGames={data.games} roster={data.roster || []} />}
        {tab === "chart" && active && <ChartGame game={active} onUpdate={update} onBack={() => setTab("games")} chartState={chartState} onChartState={setChartState} tier={tier} allGames={data.games} scoutingNotes={data.scoutingNotes || {}} onSaveNote={saveNote} prefs={data.prefs || {}} roster={data.roster || []} />}
        {tab === "tendencies" && <PitchingTendencies games={data.games} tier={tier} activeGame={active} activePitcher={chartState.curP || (active && active.pitcher) || null} scoutingNotes={data.scoutingNotes || {}} onSaveNote={saveNote} roster={data.roster || []} />}
        {tab === "baserunning" && <CountBD games={data.games} allGames={data.games} tier={tier} activeGame={active} activePitcher={chartState.curP || (active && active.pitcher) || null} section="baserunning" roster={data.roster || []} />}
        {tab === "hitting" && <Hitting games={data.games} activeGame={active} />}
        {tab === "library" && <GList games={data.games.filter(g => g.status === "complete")} title="Completed Games" onSelect={id => { if (id !== activeId) { const g = data.games.find(x => x.id === id); setChartState(g ? deriveStateFromGame(g) : { ...CHART_DEFAULTS }); } setActiveId(id); setTab("chart"); }} onDelete={del} onExport={exportGame} onExportCSV={exportGameCSV} />}
      </main>
    </div>
  );
}
