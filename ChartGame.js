function ChartGame({ game, onUpdate, onBack, chartState, onChartState, tier, allGames = [], scoutingNotes = {}, onSaveNote, prefs = {}, roster = [] }) {
  // Volatile game state lives in App so tab switches don't reset it
  const cs = chartState;
  const balls         = cs.balls;
  const strikes       = cs.strikes;
  const outs          = cs.outs;
  const inning        = cs.inning;
  const batOrder      = cs.batOrder;
  const batSide       = cs.batSide;
  const timesThrough  = cs.timesThrough;
  const runners       = cs.runners;
  const curP          = cs.curP || game.pitcher;

  const set = (key) => (val) => onChartState(prev => ({ ...prev, [key]: typeof val === "function" ? val(prev[key]) : val }));
  const setBalls        = set("balls");
  const setStrikes      = set("strikes");
  const setOuts         = set("outs");
  const setInning       = set("inning");
  const setBatOrder     = set("batOrder");
  const setBatSide      = set("batSide");
  const setTimesThrough = set("timesThrough");
  const setRunners      = set("runners");
  const [showHeat, setShowHeat] = useState(false);
  const [predOpen, setPredOpen] = useState(false);
  const [isWide, setIsWide] = useState(typeof window !== "undefined" && window.innerWidth >= 880);
  const [showMore, setShowMore] = useState(false);
  const [forceWide, setForceWide] = useState(false);
  const [popup, setPopup] = useState(null);
  const wide = isWide || forceWide;
  useEffect(() => { const h = () => setIsWide(window.innerWidth >= 880); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  const setCurP         = set("curP");

  // UI-only state stays local — these don't need to survive tab switches
  const [location, setLocation] = useState(null);
  const [selType, setSelType] = useState(null);
  const [showPC, setShowPC] = useState(false);
  const [newPN, setNewPN] = useState("");
  const [newPHand, setNewPHand] = useState("R");
  const [showAP, setShowAP] = useState(false);
  const [npKey, setNpKey] = useState("");
  const [showEvent, setShowEvent] = useState(null);
  const [showHitMenu, setShowHitMenu] = useState(null);
  const [showOutMenu, setShowOutMenu] = useState(null); // { type: pitchType } for out sub-types
  const [npFamily, setNpFamily] = useState("fastball");
  const [showPH, setShowPH] = useState(false);
  const [showEditNames, setShowEditNames] = useState(false);
  const [phName, setPhName] = useState("");
  const [phHand, setPhHand] = useState("R");
  const [pendingWPPB, setPendingWPPB] = useState(null); // { type, pitchType } waiting for ball/strike answer
  const [pendingDropK, setPendingDropK] = useState(null); // { res, pitchType } dropped-3rd-strike: out or reached?
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [quickNoteText, setQuickNoteText] = useState("");
  // QAB / Hard Hit tag panel — fires after contact results, auto-closes in 4s
  const [qabPanel, setQabPanel] = useState(null); // { pitchId } or null
  const [buntArmed, setBuntArmed] = useState(false); // next result logs as a bunt
  const [showHittingLog, setShowHittingLog] = useState(false);
  const [qabTags, setQabTags] = useState({});     // { hardHit, sacFly, sacBunt, advRunner, rbi }
  const qabTimerRef = React.useRef(null);
  const enableQAB = prefs.enableQAB !== false;

  // ── BASERUNNING READ — pitcher observation panel ──────────────────────────
  // Resets after each pitch. Fields only set if coach taps them.
  const BRRESET = { looks2B: null, move2B: null, move1B: null, handPos1B: null, step1B: null, showBRRead: false };
  const [brRead, setBRRead] = useState(BRRESET);
  const setBR = (key, val) => setBRRead(prev => ({ ...prev, [key]: prev[key] === val ? null : val }));
  // Expand/collapse panel
  const showBRPanel = brRead.showBRRead;
  // Auto-expand when runner arrives on relevant base, auto-collapse when cleared
  useEffect(() => {
    if (!runners.first && !runners.second) {
      setBRRead(prev => ({ ...prev, showBRRead: false }));
    }
  }, [runners.first, runners.second]);

  const pts = game.pitchTypes || DEFAULT_PT;
  const cP = game.pitches.filter(p => p.pitcher === curP);
  // Times-through-order for the CURRENT pitcher only (derived, never inherited from a prior pitcher).
  // Count distinct batters faced by this pitcher; every 9 completed = one full time through.
  const curPitcherTTO = (() => {
    const seen = new Set();
    cP.forEach(p => { if (!EVENTS.has(p.type)) seen.add(p.inning + "-" + p.batOrder); });
    return Math.floor(seen.size / 9) + 1;
  })();

  // Current pitcher's throwing hand (reliever entry overrides the starter)
  const curPHand = (() => {
    const rel = (game.relievers || []).find(r => r.name === curP);
    return (rel ? rel.hand : game.pitcherHand) || "R";
  })();
  // Auto-handedness from lineup card. A switch hitter (bats: "B") resolves to the side
  // opposite the CURRENT pitcher, so he flips automatically when a reliever of the other hand enters.
  const lineup = game.lineup || [];
  const getLineupHand = (order) => {
    const slot = lineup.find(s => s.slot === order);
    if (!slot) return null;
    const bats = slot.bats || slot.hand; // bats = roster value (R/L/B); fall back to legacy hand
    if (!bats) return null;
    return effectiveSide(bats, curPHand);
  };
  // Apply lineup handedness whenever the batter OR the current pitcher changes
  useEffect(() => {
    const h = getLineupHand(batOrder);
    if (h) setBatSide(h);
  }, [batOrder, curPHand]);

  // Get current batter display name from lineup
  const curBatterSlot = lineup.find(s => s.slot === batOrder) || null;
  const curBatterName = curBatterSlot?.name || null;
  const curBatterNum = (() => {
    if (!curBatterSlot) return null;
    if (curBatterSlot.num) return curBatterSlot.num;
    const rp = (roster || []).find(p => (curBatterSlot.rosterId && String(p.id) === String(curBatterSlot.rosterId)) || (p.name && p.name === curBatterSlot.name));
    return rp?.num || null;
  })();
  const pred = useMemo(() => predict(cP, { balls, strikes, outs, runners, batOrder, timesThrough: curPitcherTTO, batSide, inning, scoreMargin: (game.scoreOpp || 0) - (game.scoreUs || 0) }, pts, game.primerPitches || []), [cP.length, curP, balls, strikes, outs, runners, batOrder, curPitcherTTO, batSide, inning, game.scoreOpp, game.scoreUs]);

  const advB = () => {
    const nx = batOrder >= 9 ? 1 : batOrder + 1;
    setBatOrder(nx);
    if (nx === 1) setTimesThrough(p => p + 1);
  };

  const advanceForced = (r, batterOn) => {
    const nr = { first: false, second: false, third: false };
    if (r.first && r.second && r.third) { nr.first = batterOn; nr.second = true; nr.third = true; }
    else if (r.first && r.second) { nr.first = batterOn; nr.second = true; nr.third = true; }
    else if (r.first) { nr.first = batterOn; nr.second = true; nr.third = r.third; }
    else { nr.first = batterOn; nr.second = r.second; nr.third = r.third; }
    return nr;
  };

  const advanceHit = (r, bases = 1) => {
    if (bases >= 4) return { first: false, second: false, third: false }; // HR: everyone scores, bases empty
    if (bases === 3) return { first: false, second: false, third: true }; // 3B: all runners score, batter stands on 3rd
    if (bases === 2) {
      // Double: batter to 2nd, runners advance 2
      return { first: false, second: true, third: r.first };
    }
    // Single: batter to 1st, runners advance 1
    const nr = { first: true, second: false, third: false };
    if (r.second) nr.third = true;
    if (r.first) nr.second = true;
    return nr;
  };

  const advanceFC = (r) => {
    const nr = { first: true, second: false, third: false };
    if (r.third) { nr.second = r.second || r.first; nr.third = r.second && r.first; }
    else if (r.second) { nr.second = r.first; }
    return nr;
  };

  const logPitch = useCallback((ty, res, hitBases = 1, isBall = null, tags = null, dropReached = false) => {
    const bunted = buntArmed;
    if (bunted) setBuntArmed(false);
    if (bunted && res === "foul" && strikes === 2) res = "K"; // two-strike foul bunt = strikeout
    const p = { id: Date.now(), type: ty, result: res, balls, strikes, outs, inning, location, batOrder, batSide, timesThrough: curPitcherTTO, runners: { ...runners }, pitcher: curP, ts: new Date().toISOString() };
    if (bunted) p.bunt = true;
    // Successful sac bunt: bunted out with runner(s) on -> auto-tag (drives QAB + HH exclusion)
    // QAB gate: a sacrifice only counts with 0 outs \u2014 a bunted out at 1\u20132 outs is a failed bunt for a hit
    const sacB = bunted && outs === 0 && (res === "out" || res === "go") && (runners.first || runners.second || runners.third);
    // ...but runners still physically advance on ANY bunted out that moves them (e.g. a 1-out bunt-over)
    const buntAdv = bunted && (res === "out" || res === "go") && (runners.first || runners.second || runners.third);
    if (sacB) tags = { ...(tags || {}), sacBunt: true, ...(runners.third ? { rbi: true } : {}) }; // squeeze: RBI is automatic
    if (res === "hit") p.hitBases = hitBases;
    if (isBall !== null) p.isBall = isBall;
    // Attach baserunning read data if any was logged
    const br = mkBR(); if (br) p.brRead = br;
    let nO = outs;
    let newRunners = { ...runners };

    if (res === "ball") {
      if (balls >= 3) { newRunners = advanceForced(runners, true); setBalls(0); setStrikes(0); advB(); }
      else setBalls(balls + 1);
    }
    else if (res === "K" || res === "Kc") {
      if (strikes >= 2) {
        if (dropReached) {
          // Dropped 3rd strike, batter reached 1st: NO out recorded; batter to 1st,
          // runners advance only if forced (1st was occupied -> push). Coach taps extra bases manually.
          p.dropReached = true;
          newRunners = advanceForced(runners, true);
          setBalls(0); setStrikes(0); advB();
        } else {
          nO = outs + 1; setBalls(0); setStrikes(0); advB();
        }
      } else setStrikes(strikes + 1);
    }
    else if (res === "foul") { if (strikes < 2) setStrikes(strikes + 1); }
    else if (res === "go") {
      // Groundout = productive out: each runner moves up one base, batter is out
      const gr = runners;
      newRunners = { first: false, second: gr.first || false, third: gr.second || false };
      if (gr.third) p.runScored = true; // run came home from 3rd
      // QAB rule: a productive groundout that moves a runner up is a quality at-bat.
      //  - 0 outs + any runner advanced (e.g. R1->2B, R2->3B) -> QAB (advRunner)
      //  - 1 out + a run scored (R3 home) -> QAB (rbi)
      //  - 2 outs -> never a QAB
      const anyAdv = gr.first || gr.second || gr.third;
      if (!bunted) {
        if (outs === 0 && anyAdv) tags = { ...(tags || {}), advRunner: true };
        else if (outs === 1 && gr.third) tags = { ...(tags || {}), rbi: true };
      }
      nO = outs + 1; setBalls(0); setStrikes(0); advB();
    }
    else if (res === "out" || res === "fo" || res === "po" || res === "lo") {
      nO = outs + 1; setBalls(0); setStrikes(0); advB();
    }
    else if (res === "fc") { newRunners = advanceFC(runners); nO = outs + 1; setBalls(0); setStrikes(0); advB(); }
    else if (res === "hit") {
      if (hitBases >= 4) { newRunners = { first: false, second: false, third: false }; } // HR: bases clear
      else { newRunners = advanceHit(runners, hitBases); }
      setBalls(0); setStrikes(0); advB();
    }
    else if (res === "hbp") { newRunners = advanceForced(runners, true); setBalls(0); setStrikes(0); advB(); }
    else if (res === "roe") { newRunners = advanceHit(runners, 1); setBalls(0); setStrikes(0); advB(); }
    else if (res === "ibb") {
      // Intentional walk — advance runners forced, no pitch data logged to model
      newRunners = advanceForced(runners, true); setBalls(0); setStrikes(0); advB();
    }
    else if (res === "gdp") {
      // Ground into double play — batter out plus the runner forced at 2nd (the
      // classic 6-4-3 / 4-6-3). If 1st is empty (rare DP), fall back to the lead runner.
      // Other runners hold — adjust bases manually if one scored/advanced on the play.
      const nr = { ...runners };
      if (nr.first) nr.first = false;
      else if (nr.third) nr.third = false;
      else if (nr.second) nr.second = false;
      newRunners = nr;
      nO = outs + 2; // two outs
      setBalls(0); setStrikes(0); advB();
    }
    else if (res === "wp" || res === "pb") {
      // Advance all runners one base
      const nr2 = { ...runners };
      if (runners.third) { nr2.third = false; }
      if (runners.second) { nr2.third = true; nr2.second = false; }
      if (runners.first) { nr2.second = true; nr2.first = false; }
      newRunners = nr2;
      // Advance count based on ball/strike answer stored on pitch
      if (p.isBall) {
        if (balls >= 3) { newRunners = advanceForced(newRunners, true); setBalls(0); setStrikes(0); advB(); }
        else setBalls(balls + 1);
      } else {
        // It was a strike in the dirt — foul rule: only advance if < 2 strikes
        if (strikes < 2) setStrikes(strikes + 1);
      }
    }

    // Bunted out with runners on: every runner moves up one (R3 scores); sac fly: R3 scores
    if (buntAdv) {
      const nr = { ...newRunners };
      if (nr.third) nr.third = false;
      if (nr.second) { nr.third = true; nr.second = false; }
      if (nr.first) { nr.second = true; nr.first = false; }
      newRunners = nr;
    }
    if (tags && tags.sacFly && newRunners.third) newRunners = { ...newRunners, third: false };

    // NOW attach tags (GO/sac branches above have set them) and save the pitch
    if (tags) p.atBatTags = tags;
    onUpdate({ ...game, pitches: [...game.pitches, p] });
    setLocation(null); setSelType(null); setShowHitMenu(null);
    setBRRead(prev => ({ ...BRRESET, showBRRead: prev.showBRRead }));
    // Fire QAB panel for contact results (bunts: only the successful-sac case)
    if (QAB_CONTACT.has(res) && (!bunted || sacB)) showQABPanel(p.id, res); else setQabPanel(null);

    if (nO >= 3) { setInning(p => p + 1); setOuts(0); setBalls(0); setStrikes(0); setRunners({ first: false, second: false, third: false }); }
    else { if (nO !== outs) setOuts(nO); setRunners(newRunners); }
  }, [balls, strikes, outs, inning, location, batOrder, batSide, timesThrough, runners, curP, game, onUpdate, brRead, buntArmed]);

  const mkBR = () => {
    const br = {};
    if (brRead.looks2B !== null) br.looks2B = brRead.looks2B;
    if (brRead.move2B !== null) br.move2B = brRead.move2B;
    if (brRead.move1B !== null) br.move1B = brRead.move1B;
    if (brRead.handPos1B !== null) br.handPos1B = brRead.handPos1B;
    if (brRead.step1B !== null) br.step1B = brRead.step1B;
    return Object.keys(br).length > 0 ? br : null;
  };

  // QAB contact results — panel fires for these
  const QAB_CONTACT = new Set(["out", "go", "fo", "po", "lo", "hit", "fc", "gdp", "roe"]);

  const showQABPanel = (pitchId, result) => {
    if (!enableQAB) return;
    if (qabTimerRef.current) clearTimeout(qabTimerRef.current);
    setQabPanel({ pitchId, result });
  };

  const commitQABTags = () => {
    if (qabTimerRef.current) clearTimeout(qabTimerRef.current);
    if (!qabPanel) return;
    const tags = { ...qabTags };
    if (Object.keys(tags).filter(k => tags[k]).length > 0) {
      // Attach tags to the pitch that was just logged
      const updatedPitches = game.pitches.map(p =>
        p.id === qabPanel.pitchId ? { ...p, atBatTags: tags } : p
      );
      onUpdate({ ...game, pitches: updatedPitches });
    }
    setQabPanel(null);
    setQabTags({});
  };

  const toggleQabTag = (key) => {
    if (!qabPanel) return;
    onUpdate({ ...game, pitches: game.pitches.map(p => p.id === qabPanel.pitchId ? { ...p, atBatTags: { ...(p.atBatTags || {}), [key]: !((p.atBatTags || {})[key]) } } : p) });
  };

  const logPKO = () => {
    const p = { id: Date.now(), type: "PKO", result: "pko", balls, strikes, outs, inning, location: null, batOrder, batSide, timesThrough: curPitcherTTO, runners: { ...runners }, pitcher: curP, ts: new Date().toISOString() };
    const br = mkBR(); if (br) p.brRead = br;
    onUpdate({ ...game, pitches: [...game.pitches, p] });
    setBRRead(prev => ({ ...BRRESET, showBRRead: prev.showBRRead }));
  };

  const logPK = (base, outcome) => {
    const nr = { ...runners };
    if (outcome === "out") {
      if (base === "first") nr.first = false;
      else if (base === "second") nr.second = false;
      else if (base === "third") nr.third = false;
    }
    const p = { id: Date.now(), type: "PK", result: outcome === "out" ? "pk-out" : "pk-safe", pkoBase: base, pkoOut: outcome === "out", balls, strikes, outs, inning, location: null, batOrder, batSide, timesThrough: curPitcherTTO, runners: { ...runners }, pitcher: curP, ts: new Date().toISOString() };
    const br = mkBR(); if (br) p.brRead = br;
    onUpdate({ ...game, pitches: [...game.pitches, p] });
    setBRRead(prev => ({ ...BRRESET, showBRRead: prev.showBRRead }));
    setRunners(nr);
    if (outcome === "out") {
      setOuts(o => {
        const nO = o + 1;
        if (nO >= 3) { setInning(i => i + 1); setTimeout(() => { setOuts(0); setBalls(0); setStrikes(0); setRunners({ first: false, second: false, third: false }); }, 0); return 0; }
        return nO;
      });
    }
    setShowEvent(null);
  };

  const logPKE = (base, runnersAdv) => {
    const present = ["first", "second", "third"].filter(b => runners[b]);
    const destMap = { first: "2B", second: "3B", third: "Home" };
    const bases = runnersAdv ? present.map(b => destMap[b]) : [];
    const nr = { ...runners };
    if (runnersAdv) {
      if (runners.third) nr.third = false;
      if (runners.second) { nr.third = true; nr.second = false; }
      if (runners.first) { nr.second = true; nr.first = false; }
    }
    const p = { id: Date.now(), type: "PK-E", result: "pk-e", pkoBase: base, bases, balls, strikes, outs, inning, location: null, batOrder, batSide, timesThrough: curPitcherTTO, runners: { ...runners }, pitcher: curP, ts: new Date().toISOString() };
    const br = mkBR(); if (br) p.brRead = br;
    onUpdate({ ...game, pitches: [...game.pitches, p] });
    setBRRead(prev => ({ ...BRRESET, showBRRead: prev.showBRRead }));
    setRunners(nr);
    setShowEvent(null);
  };

  const logEvent = (type, fromBase) => {
    const present = ["first", "second", "third"].filter(b => runners[b]);
    let froms;
    if (fromBase === "all") froms = present;
    else if (fromBase === "both") froms = ["first", "second"];
    else if (fromBase) froms = [fromBase];
    else froms = present;
    const destMap = { first: "2B", second: "3B", third: "Home" };
    const bases = froms.map(b => destMap[b]);
    const ev = { id: Date.now(), type, result: type.toLowerCase(), balls, strikes, outs, inning, location: null, batOrder, batSide, timesThrough: curPitcherTTO, runners: { ...runners }, bases, pitcher: curP, ts: new Date().toISOString() };
    const br = mkBR(); if (br) ev.brRead = br;
    onUpdate({ ...game, pitches: [...game.pitches, ev] });
    setBRRead(prev => ({ ...BRRESET, showBRRead: prev.showBRRead }));
    if (type === "IBB") {
      setRunners(advanceForced(runners, true));
      setBalls(0); setStrikes(0); advB();
      setShowEvent(null);
      return;
    }
    if (type === "CS") {
      const nr = { ...runners };
      froms.forEach(b => { nr[b] = false; });
      const newOuts = outs + froms.length;
      if (newOuts >= 3) { setBalls(0); setStrikes(0); setRunners({ first: false, second: false, third: false }); advB(); }
      else { setOuts(newOuts); setRunners(nr); }
    } else {
      const had = { ...runners };
      const nr = { first: false, second: false, third: false };
      ["first", "second", "third"].forEach(b => {
        if (!had[b]) return;
        if (froms.includes(b)) {
          if (b === "first") nr.second = true;
          else if (b === "second") nr.third = true;
        } else {
          nr[b] = true;
        }
      });
      setRunners(nr);
    }
    setShowEvent(null);
  };

  const endGame = () => {
    // Mark game as complete with final timestamp
    onUpdate({ ...game, status: "complete", endedAt: new Date().toISOString() });
    setShowEndConfirm(false);
    onBack();
  };

  const chgP = () => {
    if (!newPN.trim()) return;
    const newName = newPN.trim();
    // Reset pitch types to default when a new pitcher enters
    onUpdate({
      ...game,
      relievers: [...(game.relievers || []), { name: newName, hand: newPHand, enteredInning: inning }],
      pitchTypes: DEFAULT_PT, // reset to default — new pitcher starts fresh
    });
    setCurP(newName);
    setNewPN("");
    setNewPHand("R");
    setShowPC(false);
    setTimesThrough(1);
  };
  // ── NAME / KEY EDITING ── update the stored value AND every reference on logged pitches
  const renamePitcher = (oldName, newName, hand) => {
    const nn = (newName || "").trim();
    if (!nn || nn === oldName) return;
    const isStarter = oldName === game.pitcher;
    const g2 = { ...game };
    if (isStarter) { g2.pitcher = nn; if (hand) g2.pitcherHand = hand; }
    g2.relievers = (game.relievers || []).map(r => r.name === oldName ? { ...r, name: nn, ...(hand ? { hand } : {}) } : r);
    g2.pitches = (game.pitches || []).map(p => p.pitcher === oldName ? { ...p, pitcher: nn } : p);
    onUpdate(g2);
    if (curP === oldName) setCurP(nn);
  };
  const renameLineup = (slot, newName, hand) => {
    const nn = (newName || "").trim();
    const base = (game.lineup && game.lineup.length === 9) ? game.lineup : Array.from({ length: 9 }, (_, i) => (game.lineup || []).find(s => s.slot === i + 1) || { slot: i + 1, name: "", hand: "R" });
    const newLineup = base.map(s => s.slot === slot ? { ...s, name: nn, ...(hand ? { hand } : {}) } : s);
    onUpdate({ ...game, lineup: newLineup });
  };
  const renamePitchKey = (oldKey, newKeyRaw) => {
    const nk = (newKeyRaw || "").trim().toUpperCase().slice(0, 3);
    if (!nk || nk === oldKey) return;
    if (pts.find(p => p.key === nk)) { try { alert("A pitch with key " + nk + " already exists."); } catch(e){} return; }
    const g2 = { ...game };
    g2.pitchTypes = pts.map(p => p.key === oldKey ? { ...p, key: nk, label: p.label === oldKey ? nk : p.label } : p);
    g2.pitches = (game.pitches || []).map(p => p.type === oldKey ? { ...p, type: nk } : p);
    onUpdate(g2);
    if (selType === oldKey) setSelType(nk);
  };

  const logPH = () => {
    if (!phName.trim() && phHand === "R") { setShowPH(false); return; }
    // Update the lineup slot with the pinch hitter
    const newLineup = lineup.map(s =>
      s.slot === batOrder ? { ...s, name: phName.trim() || "PH", hand: phHand, isPH: true } : s
    );
    // If game has no lineup array yet initialise it
    const updatedLineup = newLineup.length === 9 ? newLineup :
      Array.from({ length: 9 }, (_, i) => newLineup.find(s => s.slot === i + 1) || { slot: i + 1, name: "", hand: "R" });
    onUpdate({ ...game, lineup: updatedLineup });
    setBatSide(phHand);
    setPhName(""); setPhHand("R"); setShowPH(false);
  };

  const undo = () => { if (!game.pitches.length) return; const pv = game.pitches[game.pitches.length - 1]; onUpdate({ ...game, pitches: game.pitches.slice(0, -1) }); setBalls(pv.balls); setStrikes(pv.strikes); setOuts(pv.outs); setInning(pv.inning); if (pv.batOrder) setBatOrder(pv.batOrder); if (pv.runners) setRunners(pv.runners); if (pv.batSide) setBatSide(pv.batSide); };
  const addPt = () => { if (!npKey.trim()) return; const k = npKey.trim().toUpperCase().slice(0, 3); if (pts.find(p => p.key === k)) return; onUpdate({ ...game, pitchTypes: [...pts, { key: k, label: k, family: npFamily }] }); setNpKey(""); setNpFamily("fastball"); setShowAP(false); };

  const recent = game.pitches.slice(-10);
  const thisHitter = game.pitches.filter(p => p.batOrder === batOrder && !EVENTS.has(p.type)).slice(-8);
  const t = analyze(game.pitches.filter(p => p.pitcher === curP));

  const heatBody = (() => {
    const FAM = { fastball: "#E24B4A", breaking: "#3F7CC0", offspeed: "#E0A53B", unknown: "#7a7a7a" };
    const pool = []; const seen = {};
    const add = (p) => { if (p.location && !seen[p.id]) { seen[p.id] = 1; pool.push(p); } };
    (game.pitches || []).forEach(add);
    (allGames || []).forEach(g => { if (g.pitcher === game.pitcher) (g.pitches || []).forEach(add); });
    const byZone = {};
    pool.forEach(p => { const k = p.location; const fam = getPitchFamily(p.type, game.pitchTypes || []); const z = byZone[k] || (byZone[k] = { f: 0, b: 0, o: 0, u: 0, t: 0 }); z.t++; z[fam === "fastball" ? "f" : fam === "breaking" ? "b" : fam === "offspeed" ? "o" : "u"]++; });
    const cell = (z, strike) => { const fc = byZone[z.k] || { f: 0, b: 0, o: 0, u: 0, t: 0 }; const t = fc.t; const seg = [["f", FAM.fastball], ["b", FAM.breaking], ["o", FAM.offspeed], ["u", FAM.unknown]]; return (
      <div key={z.k} title={t ? (fc.f + " FB / " + fc.b + " brk / " + fc.o + " off" + (fc.u ? " / " + fc.u + " ?" : "")) : ""} style={{ gridRow: strike ? z.r + 1 : (z.r + 1) + " / span " + z.rowSpan, gridColumn: strike ? z.c + 1 : (z.c + 1) + " / span " + z.colSpan, background: strike ? G.sf2 : "#0d0d0d", border: strike ? "1.5px solid " + G.bd : "1px dashed " + G.bd2, borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: t ? G.tx : G.tx3 }}>{t || ""}</span>
        {t > 0 && <div style={{ display: "flex", width: "78%", height: 4, borderRadius: 2, overflow: "hidden" }}>{seg.map(([k, col]) => fc[k] > 0 ? <div key={k} style={{ flex: fc[k], background: col }} /> : null)}</div>}
      </div> ); };
    return (
      <div style={{ ...cd, marginTop: 0, textAlign: "center" }}>
        <div style={{ fontSize: 10, color: G.tx3, fontWeight: 700, marginBottom: 6 }}>{game.pitcher || "Pitcher"} {"\u00b7"} location & pitch mix {"\u00b7"} {pool.length} pitch{pool.length === 1 ? "" : "es"}</div>
        {pool.length === 0 ? <div style={{ fontSize: 11, color: G.tx3, fontStyle: "italic" }}>No located pitches logged for this pitcher yet.</div> : (
          <div style={{ display: "inline-grid", gridTemplateColumns: "26px repeat(3,34px) 26px", gridTemplateRows: "20px repeat(3,34px) 20px 20px", gap: 2 }}>
            {STRIKE_ZONES.map(z => cell(z, true))}
            {BALL_ZONES.map(z => cell(z, false))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {[["Fastball", "#E24B4A"], ["Breaking", "#3F7CC0"], ["Offspeed", "#E0A53B"]].map(([lbl, col]) => (<span key={lbl} style={{ fontSize: 9, color: G.tx3, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: col, display: "inline-block" }} />{lbl}</span>))}
        </div>
        <div style={{ fontSize: 9, color: G.tx3, marginTop: 4 }}>Number = pitches in that zone; bar = pitch-type mix. All of this pitcher's pitches, no situation filter.</div>
      </div> );
  })();
  const recentBody = (thisHitter.length > 0 || recent.length > 0) ? (
        <div style={cd}>
          {thisHitter.length > 0 && (
            <div style={{ marginBottom: recent.length > 0 ? 12 : 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: G.gold, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
                This Hitter {"\u2014"} #{batOrder}{curBatterName ? " " + curBatterName : ""} ({thisHitter.length})
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {thisHitter.map(p => (
                  <div key={p.id} style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 4, background: gPC(p.type) + "35", color: gPC(p.type), fontSize: 11, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", border: "2px solid " + gPC(p.type) + "66" }}>
                    {`${p.type} ${p.balls}-${p.strikes} ${RES.find(r => r.key === p.result)?.s || ""}`}
                  </div>
                ))}
              </div>
            </div>
          )}
          {recent.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: G.tx3, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
                Recent {"\u2014"} Game ({game.pitches.filter(p => !EVENTS.has(p.type)).length})
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {recent.map(p => (
                  <div key={p.id} style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 4, background: gPC(p.type) + "20", color: gPC(p.type), fontSize: 11, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", border: "1px solid " + gPC(p.type) + "44" }}>
                    {EVENTS.has(p.type) ? p.type : `${p.type === "UNK" ? "?" : p.type} ${p.balls}-${p.strikes} ${RES.find(r => r.key === p.result)?.s || ""}`}
                    {" "}{p.batSide} #{p.batOrder}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
  ) : null;
  const mixBody = (t && t.total >= 3) ? <div style={cd}><div style={cT}>Live Mix</div><Bar data={t.mix} /></div> : null;
  const scoutBody = (t && t.total >= 5) ? (
        <div style={{ ...cd, border: "2px solid " + G.gold + "44" }}>
          <div style={cT}>Scouting - {curP}</div>
          <ScoutNotes t={t} pitches={game.pitches.filter(p => p.pitcher === curP)} name={curP} />
        </div>
  ) : null;
  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={() => setShowEndConfirm(true)} style={btn("g")}>Back</button>
          <button onClick={() => setShowEndConfirm(true)} style={{ ...btn("g"), color: G.red, border: "1px solid " + G.red + "55", fontSize: 12, padding: "8px 12px" }}>End Game</button>
          <button onClick={() => setShowQuickNote(true)} style={{ ...btn("g"), fontSize: 12, padding: "8px 12px", color: G.gold }} title="Add scout note">📝</button>
          <button onClick={() => setShowHittingLog(true)} style={{ ...btn("g"), fontSize: 12, padding: "8px 12px", color: G.gold }} title="Log hitting (QAB / hard-hit) after the game">⚾ Hitting</button>
        </div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>
          <span style={{ color: G.gold }}>vs {game.opponent}</span>
          <span style={{ color: G.tx2, fontSize: 12, marginLeft: 6 }}>P: {curP}</span>
          <span style={{ color: G.tx3, fontSize: 10, marginLeft: 4 }}>({(() => { const rel = (game.relievers || []).find(r => r.name === curP); const h = rel ? rel.hand : game.pitcherHand; return h === "L" ? "LHP" : "RHP"; })()})</span>
          <span style={{ color: G.tx3, fontSize: 11, fontWeight: 700, marginLeft: 8, padding: "1px 7px", background: G.sf2, borderRadius: 10 }}>{cP.filter(p => !EVENTS.has(p.type)).length} pitches</span>
          {game.pregame && <span style={{ color: "#b794ff", fontSize: 10, marginLeft: 6, background: "#9b59ff22", borderRadius: 3, padding: "1px 6px", fontWeight: 800 }}>PREGAME{game.faced ? " · vs " + game.faced : ""}</span>}
        </div>
        <div style={{ fontSize: 12, color: G.tx3, fontWeight: 700 }}>{curBatterName ? <span style={{ color: G.gold }}>{curBatterNum ? "#" + curBatterNum + " " : ""}{curBatterName}</span> : null}</div>
      </div>

      {/* v89 - scoreboard header: away team first / home second (flip via MINE toggle); my team highlighted; scores, half, home/away persist on the game; inning & outs mirror live state */}
      {(() => {
        const ourHome = game.homeAway !== "away";
        const teams = [
          { side: "AWAY", lbl: ourHome ? (game.opponent || "OPP") : (game.team || "MY TEAM"), key: ourHome ? "scoreOpp" : "scoreUs", ours: !ourHome },
          { side: "HOME", lbl: ourHome ? (game.team || "MY TEAM") : (game.opponent || "OPP"), key: ourHome ? "scoreUs" : "scoreOpp", ours: ourHome },
        ];
        return (
          <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            {teams.map(t => (
              <div key={t.side} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: t.ours ? G.gold + "14" : G.sf2, border: "1.5px solid " + (t.ours ? G.gold : G.bd2), borderRadius: 10, padding: "6px 14px", minWidth: 120 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: t.ours ? G.gold : G.tx3 }}>{t.side}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: t.ours ? G.gold : G.tx, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.lbl}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => onUpdate({ ...game, [t.key]: Math.max(0, (game[t.key] || 0) - 1) })} style={{ ...btn("g"), fontSize: 13, padding: "1px 9px" }}>-</button>
                  <span style={{ fontSize: 24, fontWeight: 900, fontFamily: "'Azeret Mono',monospace", color: t.ours ? G.gold : G.tx, minWidth: 24, textAlign: "center" }}>{game[t.key] || 0}</span>
                  <button onClick={() => onUpdate({ ...game, [t.key]: (game[t.key] || 0) + 1 })} style={{ ...btn("g"), fontSize: 13, padding: "1px 9px" }}>+</button>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <button onClick={() => { if (game.half === "B") { if (inning < 25) { setInning(inning + 1); onUpdate({ ...game, half: "T" }); } } else { onUpdate({ ...game, half: "B" }); } }} title="Tap to step through half-innings (Top to Bottom to next inning), capped at 25" style={{ ...btn("g"), fontSize: 11, padding: "3px 10px", color: G.gold, fontWeight: 800 }}>{game.half === "B" ? "BOT" : "TOP"} {inning}</button>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 9, color: G.tx3, fontWeight: 800 }}>OUT</span>
                {[0, 1, 2].map(i => (<div key={i} style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid " + G.bd2, background: i < outs ? G.red : "transparent" }} />))}
              </div>
              <button onClick={() => onUpdate({ ...game, homeAway: ourHome ? "away" : "home" })} title="Flip whether my team is home or away" style={{ ...btn("g"), fontSize: 9, padding: "2px 7px", color: G.gold, fontWeight: 800 }}>{ourHome ? "HOME" : "AWAY"}</button>
            </div>
          </div>
        );
      })()}

      {showHittingLog && <HittingLog game={game} onUpdate={onUpdate} onClose={() => setShowHittingLog(false)} />}

      {showEditNames && (() => {
        const starter = { name: game.pitcher, hand: game.pitcherHand || "R", kind: "starter" };
        const rels = (game.relievers || []).map(r => ({ name: r.name, hand: r.hand || "R", kind: "reliever" }));
        const allP = [starter, ...rels].filter(p => p.name);
        const lu = (game.lineup && game.lineup.length) ? game.lineup : [];
        return (
        <div onClick={() => setShowEditNames(false)} style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: G.bg, border: "1px solid " + G.bd2, borderRadius: 14, padding: 18, maxWidth: 460, width: "100%", marginTop: 30 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: G.tx }}>✎ Edit Names</div>
              <button onClick={() => setShowEditNames(false)} style={{ ...btn("g"), fontSize: 12, padding: "6px 10px" }}>Done</button>
            </div>

            <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>PITCHERS</div>
            {allP.map((p, i) => (
              <div key={"p" + i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                <input defaultValue={p.name} onBlur={e => renamePitcher(p.name, e.target.value, undefined)}
                  style={{ flex: 1, background: G.sf2, border: "1px solid " + G.bd2, borderRadius: 6, padding: "8px 10px", color: G.tx, fontSize: 13, outline: "none" }} />
                <select defaultValue={p.hand} onChange={e => renamePitcher(p.name, p.name, e.target.value)}
                  style={{ background: G.sf2, border: "1px solid " + G.bd2, borderRadius: 6, padding: "8px", color: G.tx, fontSize: 12 }}>
                  <option value="R">RHP</option><option value="L">LHP</option>
                </select>
                <span style={{ fontSize: 9, color: G.tx3, width: 48 }}>{p.kind === "starter" ? "Starter" : "Relief"}</span>
              </div>
            ))}

            <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 1, margin: "14px 0 6px" }}>PITCH KEYS</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              {pts.map((pt, i) => (
                <input key={"k" + i} defaultValue={pt.key} maxLength={3} onBlur={e => renamePitchKey(pt.key, e.target.value)}
                  style={{ width: 60, textAlign: "center", background: "#1a1a1a", border: "2px solid " + gPC(pt.key), borderRadius: 6, padding: "8px", color: "#fff", fontSize: 13, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", outline: "none" }} />
              ))}
            </div>

            {lu.length > 0 && (<>
              <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 1, margin: "14px 0 6px" }}>LINEUP / HITTERS</div>
              {lu.map((s, i) => (
                <div key={"l" + i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: G.tx3, width: 22, fontFamily: "'Azeret Mono',monospace" }}>#{s.slot}</span>
                  <input defaultValue={s.name} placeholder={"Order " + s.slot} onBlur={e => renameLineup(s.slot, e.target.value, undefined)}
                    style={{ flex: 1, background: G.sf2, border: "1px solid " + G.bd2, borderRadius: 6, padding: "8px 10px", color: G.tx, fontSize: 13, outline: "none" }} />
                  <select defaultValue={s.hand || "R"} onChange={e => renameLineup(s.slot, s.name, e.target.value)}
                    style={{ background: G.sf2, border: "1px solid " + G.bd2, borderRadius: 6, padding: "8px", color: G.tx, fontSize: 12 }}>
                    <option value="R">R</option><option value="L">L</option><option value="S">S</option>
                  </select>
                  {s.isPH && <span style={{ fontSize: 9, color: G.gold, width: 20 }}>PH</span>}
                </div>
              ))}
            </>)}

            <div style={{ fontSize: 10, color: G.tx3, marginTop: 12, lineHeight: 1.5 }}>Renaming a pitcher or pitch key updates every pitch already logged for them, so stats stay together. Scouting notes are edited in the Notes tab.</div>
          </div>
        </div>
        );
      })()}

      {/* ── QUICK NOTE MODAL ── */}
      {showQuickNote && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.75)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: G.sf, border: "1px solid " + G.bd, borderRadius: 12, padding: 24, width: "100%", maxWidth: 420 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: G.gold, marginBottom: 4 }}>📝 Scout Note</div>
            <div style={{ fontSize: 11, color: G.tx3, marginBottom: 14 }}>vs {game.opponent} — saved to Scouting Report</div>
            <textarea
              autoFocus
              value={quickNoteText}
              onChange={e => setQuickNoteText(e.target.value)}
              placeholder="e.g. Pitcher tips changeup by dropping glove..."
              style={{ width: "100%", minHeight: 90, background: G.sf2, border: "1px solid " + G.bd2, borderRadius: 8, padding: 12, color: G.tx, fontSize: 13, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowQuickNote(false); setQuickNoteText(""); }} style={{ ...btn("g"), fontSize: 12 }}>Cancel</button>
              <button onClick={() => {
                if (!quickNoteText.trim()) return;
                if (onSaveNote) onSaveNote(game.opponent, quickNoteText.trim());
                setQuickNoteText("");
                setShowQuickNote(false);
              }} style={{ ...btn("p"), fontSize: 12 }}>Save Note</button>
            </div>
          </div>
        </div>
      )}

      {showEndConfirm && (
        <div style={{ ...cd, border: "2px solid " + G.red + "66", background: "#0a0000", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: G.tx, marginBottom: 10 }}>
            End this game?
            <span style={{ fontSize: 11, color: G.tx3, fontWeight: 400, marginLeft: 8 }}>
              {game.pitches.filter(p => !EVENTS.has(p.type)).length} pitches · vs {game.opponent}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={endGame} style={{ ...btn("d"), fontSize: 13, padding: "9px 20px" }}>Yes, End Game</button>
            <button onClick={() => { setShowEndConfirm(false); onBack(); }} style={{ ...btn("g"), fontSize: 13, padding: "9px 20px" }}>Save & Go Back</button>
            <button onClick={() => setShowEndConfirm(false)} style={{ ...btn("g"), fontSize: 13, padding: "9px 20px", color: G.tx3 }}>Keep Charting</button>
          </div>
        </div>
      )}

      {showPC && (
        <div style={{ ...cd, border: "2px solid " + G.gold + "66" }}>
          <div style={cT}>Pitcher Change</div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 180px" }}>
              <div style={{ fontSize: 11, color: G.tx2, fontWeight: 700, marginBottom: 4 }}>Name</div>
              <input style={{ background: G.sf2, border: "2px solid " + G.bd2, borderRadius: 6, padding: "8px", color: G.tx, fontSize: 14, fontWeight: 700, outline: "none", width: "100%", boxSizing: "border-box" }} value={newPN} onChange={e => setNewPN(e.target.value)} placeholder="Name" autoFocus onKeyDown={e => { if (e.key === "Enter") chgP(); }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: G.tx2, fontWeight: 700, marginBottom: 4 }}>Hand</div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setNewPHand("R")} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: newPHand === "R" ? G.gold : G.sf2, color: newPHand === "R" ? "#000" : G.tx2, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>RHP</button>
                <button onClick={() => setNewPHand("L")} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: newPHand === "L" ? G.gold : G.sf2, color: newPHand === "L" ? "#000" : G.tx2, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>LHP</button>
              </div>
            </div>
            <button onClick={chgP} style={btn("p", !newPN.trim())} disabled={!newPN.trim()}>OK</button>
            <button onClick={() => setShowPC(false)} style={btn("g")}>Cancel</button>
          </div>
        </div>
      )}

      {pred && canAccess("prediction", tier) && (
        <div style={{ ...cd, border: "2px solid " + G.gold + "66", background: "#0a0a00", position: "sticky", top: 0, zIndex: 20, marginBottom: 10, padding: "8px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: predOpen ? 10 : 0, gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={cT}>Prediction — {balls}-{strikes}</div>
              {!predOpen && pred.hasRecommendation && pred.predictions[0] && (
                <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: gPC(pred.predictions[0].type) }}>{pred.predictions[0].type} {pred.predictions[0].pct}%{pred.predictions[1] ? <span style={{ color: G.tx3, fontWeight: 700 }}>{"  ·  "}{pred.predictions[1].type} {pred.predictions[1].pct}%</span> : null}</span>
              )}
              {!predOpen && !pred.hasRecommendation && <span style={{ fontSize: 11, color: G.tx3, fontStyle: "italic" }}>building tendency…</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {pred.confidenceLabel && (
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", padding: "3px 8px", borderRadius: 4,
                  background: pred.phase === 4 ? G.gold + "25" : pred.phase === 3 ? G.blu + "25" : G.bd2,
                  color: pred.phase === 4 ? G.gold : pred.phase === 3 ? G.blu : G.tx3,
                  border: "1px solid " + (pred.phase === 4 ? G.gold + "44" : pred.phase === 3 ? G.blu + "44" : G.bd)
                }}>{pred.confidenceLabel}</div>
              )}
              <button onClick={() => setPredOpen(o => !o)} style={{ ...btn("g"), fontSize: 10, padding: "3px 9px", color: predOpen ? G.gold : G.tx3 }}>{predOpen ? "Hide" : "Details"}</button>
            </div>
          </div>
          {predOpen && (<>
          {pred.hasRecommendation ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {pred.predictions.map((p, i) => (
                <div key={p.type} style={{ background: i === 0 ? gPC(p.type) + "35" : G.sf2, border: "2px solid " + (i === 0 ? gPC(p.type) + "88" : G.bd), borderRadius: 8, padding: "10px 16px", textAlign: "center", minWidth: 74 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: gPC(p.type) }}>{p.type}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: "#fff" }}>{p.pct}%</div>
                  {i === 0 && <div style={{ fontSize: 9, color: G.gold, letterSpacing: 1, textTransform: "uppercase", fontWeight: 800 }}>Most Likely</div>}
                </div>
              ))}
            </div>
          ) : (
            <div>
              {pred.distribution.length > 0 ? (
                <div>
                  <div style={{ fontSize: 10, color: G.tx3, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
                    BUILDING TENDENCY — {pred.countTotal} of {PRED_MIN} pitches logged on {balls}-{strikes}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {pred.distribution.map(p => (
                      <div key={p.type} style={{ background: gPC(p.type) + "20", border: "1px solid " + gPC(p.type) + "44", borderRadius: 6, padding: "8px 14px", textAlign: "center", minWidth: 64, opacity: 0.75 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: gPC(p.type) }}>{p.type}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: G.tx2 }}>{p.pct}%</div>
                        <div style={{ fontSize: 8, color: G.tx3, fontWeight: 700 }}>{p.count} seen</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: G.tx3, fontStyle: "italic" }}>No pitches logged on {balls}-{strikes} yet</div>
              )}
            </div>
          )}
          {pred.tip && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: G.gold + "12", borderRadius: 6, border: "1px solid " + G.gold + "33", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: G.gold, fontWeight: 800, letterSpacing: 0.5 }}>💡 {pred.tip}</span>
            </div>
          )}
          </>)}
        </div>
      )}
      {!isWide && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {[["heat", "Heat Map"], ["recent", "Recent Pitches"], ["mix", "Live Mix"], ["scout", "Scouting"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setPopup(k)} style={{ ...btn("g"), flex: "1 1 0", minWidth: 80, fontSize: 11, padding: "8px 6px", fontWeight: 800 }}>{lbl}</button>
          ))}
        </div>
      )}
      {popup && (
        <div onClick={() => setPopup(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.78)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: G.sf, border: "1px solid " + G.bd, borderRadius: 12, padding: 14, width: "100%", maxWidth: 460, margin: "16px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: G.gold }}>{({ heat: "Heat Map", recent: "Recent Pitches", mix: "Live Mix", scout: "Scouting" })[popup]}</span>
              <button onClick={() => setPopup(null)} style={{ ...btn("g"), fontSize: 13, padding: "4px 11px" }}>✕</button>
            </div>
            {popup === "heat" && heatBody}
            {popup === "recent" && (recentBody || <div style={{ fontSize: 12, color: G.tx3, fontStyle: "italic", padding: 8 }}>No pitches logged yet.</div>)}
            {popup === "mix" && (mixBody || <div style={{ fontSize: 12, color: G.tx3, fontStyle: "italic", padding: 8 }}>Not enough pitches for a mix yet.</div>)}
            {popup === "scout" && (scoutBody || <div style={{ fontSize: 12, color: G.tx3, fontStyle: "italic", padding: 8 }}>Scouting builds after ~5 pitches.</div>)}
          </div>
        </div>
      )}
      <div style={{ display: wide ? "grid" : "block", gridTemplateColumns: wide ? "minmax(0,1fr) minmax(0,1fr)" : undefined, gap: wide ? 10 : 0, alignItems: "start" }}>
      <div>
      <div style={{ ...cd, padding: "12px 14px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: G.tx3, fontWeight: 800 }}>INN</span>
            <button onClick={() => setInning(Math.max(1, inning - 1))} style={btn("g")}>-</button>
            <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: G.gold, minWidth: 22, textAlign: "center" }}>{inning}</span>
            <button onClick={() => setInning(inning + 1)} style={btn("g")}>+</button>
          </div>
          <span style={{ color: G.bd }}>|</span>
          <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{balls}-{strikes}</span>
          <span style={{ color: G.bd }}>|</span>
          <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: G.tx3, fontWeight: 800 }}>OUT</span>
            {[0, 1, 2].map(i => (<div key={i} onClick={() => setOuts(i < outs ? i : i + 1 > 2 ? 0 : i + 1)} style={{ width: 14, height: 14, borderRadius: "50%", border: "3px solid " + G.bd2, background: i < outs ? G.gold : "transparent", cursor: "pointer" }} />))}
          </div>
          <span style={{ color: G.bd }}>|</span>
          <div style={{ display: "flex", gap: 3 }}>
            <button onClick={() => setBatSide("L")} style={{ padding: "4px 10px", borderRadius: 5, border: "none", background: batSide === "L" ? G.gold : G.sf2, color: batSide === "L" ? "#000" : G.tx2, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>L</button>
            <button onClick={() => setBatSide("R")} style={{ padding: "4px 10px", borderRadius: 5, border: "none", background: batSide === "R" ? G.gold : G.sf2, color: batSide === "R" ? "#000" : G.tx2, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>R</button>
          </div>
          <span style={{ color: G.bd }}>|</span>
          <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: G.tx3, fontWeight: 800 }}>#</span>
            <select value={batOrder} onChange={e => setBatOrder(parseInt(e.target.value))} style={{ background: G.sf2, border: "2px solid " + G.bd2, borderRadius: 6, padding: "4px", color: G.tx, fontSize: 15, fontWeight: 700, outline: "none", width: 46 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <span style={{ color: G.bd }}>|</span>
          <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: G.tx3, fontWeight: 800 }}>TTO</span>
            <select value={curPitcherTTO > 4 ? 4 : curPitcherTTO} disabled title="Auto-tracked per pitcher (resets when a new pitcher enters)" style={{ background: G.sf2, border: "2px solid " + G.bd2, borderRadius: 6, padding: "4px", color: G.tx2, fontSize: 14, fontWeight: 700, outline: "none", width: 42, opacity: 0.7 }}>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
          <div><div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, marginBottom: 4 }}>BASES</div><BaseW runners={runners} onChange={setRunners} /></div>
          <div><div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, marginBottom: 4 }}>ZONE</div><BatterZone batSide={batSide} selected={location} onSelect={setLocation} /></div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 5, flexWrap: "wrap" }}>
            <button onClick={() => { setBalls(0); setStrikes(0); }} style={{ ...btn("g"), fontSize: 12, padding: "8px 10px" }}>New AB</button>
            <button onClick={() => { setInning(p => p + 1); setOuts(0); setBalls(0); setStrikes(0); setRunners({ first: false, second: false, third: false }); }} style={{ ...btn("g"), fontSize: 12, padding: "8px 10px" }}>Next Inn</button>
            <button onClick={() => setShowPH(true)} style={{ ...btn("g"), color: G.gold, fontSize: 12, padding: "8px 10px" }}>PH</button>
            <button onClick={() => setShowPC(true)} style={{ ...btn("g"), color: G.blu, fontSize: 12, padding: "8px 10px" }}>New P</button>
            <button onClick={() => setShowEditNames(true)} title="Edit pitcher / hitter names and pitch keys" style={{ ...btn("g"), fontSize: 12, padding: "8px 10px" }}>✎ Edit</button>
            <button onClick={undo} style={{ ...btn("g"), color: G.red, fontSize: 12, padding: "8px 10px" }}>Undo</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 1 }}>BASE RUNNING</span>
          <button onClick={() => setShowEvent(showEvent === "PK" ? null : "PK")} style={{ ...btn("g"), color: "#ffd700", fontSize: 12, padding: "7px 10px", background: showEvent === "PK" ? "#ffd70030" : "transparent" }}>PK</button>
          <button onClick={() => setShowEvent(showEvent === "PK-E" ? null : "PK-E")} style={{ ...btn("g"), color: "#ff6600", fontSize: 12, padding: "7px 10px", background: showEvent === "PK-E" ? "#ff660030" : "transparent" }}>PK-E</button>
          <button onClick={() => setShowEvent(showEvent === "SB" ? null : "SB")} style={{ ...btn("g"), color: G.grn, fontSize: 12, padding: "7px 10px", background: showEvent === "SB" ? G.grn + "30" : "transparent" }}>SB</button>
          <button onClick={() => setShowEvent(showEvent === "CS" ? null : "CS")} style={{ ...btn("g"), color: "#ff4444", fontSize: 12, padding: "7px 10px", background: showEvent === "CS" ? "#ff444430" : "transparent" }}>CS</button>
          <button onClick={() => setShowEvent(showEvent === "WP" ? null : "WP")} style={{ ...btn("g"), color: "#ff9933", fontSize: 12, padding: "7px 10px", background: showEvent === "WP" ? "#ff993330" : "transparent" }}>WP</button>
          <button onClick={() => setShowEvent(showEvent === "PB" ? null : "PB")} style={{ ...btn("g"), color: "#ff9933", fontSize: 12, padding: "7px 10px", background: showEvent === "PB" ? "#ff993330" : "transparent" }}>PB</button>
          <button onClick={() => logEvent("IBB")} title="Intentional walk \u2014 no pitch thrown; batter to 1st, forced runners advance" style={{ ...btn("g"), color: "#66aaff", fontSize: 12, padding: "7px 10px" }}>IBB</button>
          {(runners.first || runners.second) && (
            <button onClick={() => setBRRead(prev => ({ ...prev, showBRRead: !prev.showBRRead }))}
              style={{ ...btn("g"), color: showBRPanel ? G.gold : G.tx3, fontSize: 12, padding: "7px 10px", background: showBRPanel ? G.gold + "20" : "transparent", border: "1px solid " + (showBRPanel ? G.gold + "66" : G.bd2), marginLeft: 4 }}>
              👁 Read
            </button>
          )}
        </div>

        {/* ── PITCHER READ PANEL ── */}
        {showBRPanel && (runners.first || runners.second) && (
          <div style={{ marginTop: 8, padding: "12px 14px", background: G.sf2, borderRadius: 8, border: "1px solid " + G.gold + "33" }}>
            <div style={{ fontSize: 10, color: G.gold, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Pitcher Read</div>

            {/* 2B — Look Count */}
            {runners.second && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>2B — Looks</div>
                <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                  {[0, 1, 2, 3].map(n => (
                    <button key={n} onClick={() => setBR("looks2B", n)}
                      style={{ ...btn("g"), fontSize: 13, fontWeight: 900, padding: "7px 14px", fontFamily: "'Azeret Mono',monospace", background: brRead.looks2B === n ? G.gold + "30" : "transparent", color: brRead.looks2B === n ? G.gold : G.tx3, border: "1px solid " + (brRead.looks2B === n ? G.gold : G.bd2), borderRadius: 6 }}>
                      {n === 3 ? "3+" : n}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>2B — Move Type <span style={{ color: G.tx3, fontWeight: 400, textTransform: "none", fontSize: 9 }}>(optional)</span></div>
                <div style={{ display: "flex", gap: 5 }}>
                  {[{ k: "inside", l: "Inside" }, { k: "spin", l: "Spin" }].map(m => (
                    <button key={m.k} onClick={() => setBR("move2B", m.k)}
                      style={{ ...btn("g"), fontSize: 12, fontWeight: 800, padding: "7px 14px", background: brRead.move2B === m.k ? G.gold + "30" : "transparent", color: brRead.move2B === m.k ? G.gold : G.tx3, border: "1px solid " + (brRead.move2B === m.k ? G.gold : G.bd2), borderRadius: 6 }}>
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 1B — Move Type, Step, Hand Position */}
            {runners.first && (
              <div>
                <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>1B — Move Type</div>
                <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
                  {[{ k: "quick", l: "Quick" }, { k: "best", l: "Best" }, { k: "show", l: "Show" }].map(m => (
                    <button key={m.k} onClick={() => setBR("move1B", m.k)}
                      style={{ ...btn("g"), fontSize: 12, fontWeight: 800, padding: "7px 14px", background: brRead.move1B === m.k ? G.gold + "30" : "transparent", color: brRead.move1B === m.k ? G.gold : G.tx3, border: "1px solid " + (brRead.move1B === m.k ? G.gold : G.bd2), borderRadius: 6 }}>
                      {m.l}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>1B — Step (1-2-3-4-5+)</div>
                <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setBR("step1B", n)}
                      style={{ ...btn("g"), fontSize: 13, fontWeight: 900, padding: "7px 14px", fontFamily: "'Azeret Mono',monospace", background: brRead.step1B === n ? G.gold + "30" : "transparent", color: brRead.step1B === n ? G.gold : G.tx3, border: "1px solid " + (brRead.step1B === n ? G.gold : G.bd2), borderRadius: 6 }}>
                      {n === 5 ? "5+" : n}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>1B — Hand Position <span style={{ color: G.tx3, fontWeight: 400, textTransform: "none", fontSize: 9 }}>(optional)</span></div>
                <div style={{ display: "flex", gap: 5 }}>
                  {[{ k: "high", l: "High" }, { k: "mid", l: "Mid" }, { k: "low", l: "Low" }].map(h => (
                    <button key={h.k} onClick={() => setBR("handPos1B", h.k)}
                      style={{ ...btn("g"), fontSize: 12, fontWeight: 800, padding: "7px 14px", background: brRead.handPos1B === h.k ? G.gold + "30" : "transparent", color: brRead.handPos1B === h.k ? G.gold : G.tx3, border: "1px solid " + (brRead.handPos1B === h.k ? G.gold : G.bd2), borderRadius: 6 }}>
                      {h.l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* QAB / Hard Hit panel is rendered below the result entry */}

        {showEvent === "SB" && (runners.first || runners.second || runners.third) && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, padding: "8px 12px", background: G.grn + "15", borderRadius: 6, border: "1px solid " + G.grn + "44" }}>
            <span style={{ fontSize: 11, color: G.grn, fontWeight: 800 }}>WHO STOLE?</span>
            {runners.first && <button onClick={() => logEvent("SB", "first")} style={{ ...btn("g"), color: G.grn, fontSize: 12, padding: "6px 12px" }}>1st-2nd</button>}
            {runners.second && <button onClick={() => logEvent("SB", "second")} style={{ ...btn("g"), color: G.grn, fontSize: 12, padding: "6px 12px" }}>2nd-3rd</button>}
            {runners.third && <button onClick={() => logEvent("SB", "third")} style={{ ...btn("g"), color: G.grn, fontSize: 12, padding: "6px 12px" }}>3rd-Home</button>}
            {(Number(runners.first) + Number(runners.second) + Number(runners.third)) >= 2 && <button onClick={() => logEvent("SB", "all")} style={{ ...btn("g"), color: G.grn, fontSize: 12, padding: "6px 12px", border: "2px solid " + G.grn + "88" }}>All</button>}
            <button onClick={() => setShowEvent(null)} style={{ ...btn("g"), fontSize: 11, padding: "6px 8px", color: G.tx3 }}>Cancel</button>
          </div>
        )}

        {showEvent === "CS" && (runners.first || runners.second || runners.third) && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, padding: "8px 12px", background: "#ff444415", borderRadius: 6, border: "1px solid #ff444444", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#ff4444", fontWeight: 800 }}>CS — WHO WAS THROWN OUT?</span>
            {runners.first && <button onClick={() => logEvent("CS", "first")} style={{ ...btn("g"), color: "#ff4444", fontSize: 12, padding: "6px 12px" }}>Runner on 1st</button>}
            {runners.second && <button onClick={() => logEvent("CS", "second")} style={{ ...btn("g"), color: "#ff4444", fontSize: 12, padding: "6px 12px" }}>Runner on 2nd</button>}
            {runners.third && <button onClick={() => logEvent("CS", "third")} style={{ ...btn("g"), color: "#ff4444", fontSize: 12, padding: "6px 12px" }}>Runner on 3rd</button>}
            {(Number(runners.first) + Number(runners.second) + Number(runners.third)) >= 2 && <button onClick={() => logEvent("CS", "all")} style={{ ...btn("g"), color: "#ff4444", fontSize: 12, padding: "6px 12px", border: "2px solid #ff444488" }}>All</button>}
            <button onClick={() => setShowEvent(null)} style={{ ...btn("g"), fontSize: 11, padding: "6px 8px", color: G.tx3 }}>Cancel</button>
          </div>
        )}

        {showEvent === "PK" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, padding: "8px 12px", background: "#ffd70015", borderRadius: 6, border: "1px solid #ffd70044", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#ffd700", fontWeight: 800 }}>PK — WHICH BASE?</span>
            {runners.first && (
              <>
                <button onClick={() => logPK("first", "safe")} style={{ ...btn("g"), color: G.tx2, fontSize: 12, padding: "6px 12px" }}>1B — Safe</button>
                <button onClick={() => logPK("first", "out")} style={{ ...btn("g"), color: "#ffd700", fontSize: 12, padding: "6px 12px" }}>1B — Out</button>
              </>
            )}
            {runners.second && (
              <>
                <button onClick={() => logPK("second", "safe")} style={{ ...btn("g"), color: G.tx2, fontSize: 12, padding: "6px 12px" }}>2B — Safe</button>
                <button onClick={() => logPK("second", "out")} style={{ ...btn("g"), color: "#ffd700", fontSize: 12, padding: "6px 12px" }}>2B — Out</button>
              </>
            )}
            {runners.third && (
              <>
                <button onClick={() => logPK("third", "safe")} style={{ ...btn("g"), color: G.tx2, fontSize: 12, padding: "6px 12px" }}>3B — Safe</button>
                <button onClick={() => logPK("third", "out")} style={{ ...btn("g"), color: "#ffd700", fontSize: 12, padding: "6px 12px" }}>3B — Out</button>
              </>
            )}
            {!runners.first && !runners.second && !runners.third && <span style={{ fontSize: 11, color: G.tx3, fontStyle: "italic" }}>No runners on base</span>}
            <button onClick={() => setShowEvent(null)} style={{ ...btn("g"), fontSize: 11, padding: "6px 8px", color: G.tx3 }}>Cancel</button>
          </div>
        )}

        {showEvent === "PK-E" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, padding: "8px 12px", background: "#ff660015", borderRadius: 6, border: "1px solid #ff660044", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#ff6600", fontWeight: 800 }}>PK-E — WHICH BASE? DID RUNNERS ADVANCE?</span>
            {runners.first && <button onClick={() => logPKE("first", true)} style={{ ...btn("g"), color: "#ff6600", fontSize: 12, padding: "6px 12px" }}>1B → Runners advance</button>}
            {runners.first && <button onClick={() => logPKE("first", false)} style={{ ...btn("g"), color: "#ff6600", fontSize: 12, padding: "6px 12px" }}>1B → No advance</button>}
            {runners.second && <button onClick={() => logPKE("second", true)} style={{ ...btn("g"), color: "#ff6600", fontSize: 12, padding: "6px 12px" }}>2B → Runners advance</button>}
            {runners.second && <button onClick={() => logPKE("second", false)} style={{ ...btn("g"), color: "#ff6600", fontSize: 12, padding: "6px 12px" }}>2B → No advance</button>}
            {runners.third && <button onClick={() => logPKE("third", true)} style={{ ...btn("g"), color: "#ff6600", fontSize: 12, padding: "6px 12px" }}>3B → Runner scores</button>}
            {runners.third && <button onClick={() => logPKE("third", false)} style={{ ...btn("g"), color: "#ff6600", fontSize: 12, padding: "6px 12px" }}>3B → No advance</button>}
            {(Number(runners.first) + Number(runners.second) + Number(runners.third)) >= 2 && <button onClick={() => logPKE("all", true)} style={{ ...btn("g"), color: "#ff6600", fontSize: 12, padding: "6px 12px", border: "2px solid #ff660088" }}>All runners advance</button>}
            {!runners.first && !runners.second && !runners.third && <button onClick={() => logPKE("none", false)} style={{ ...btn("g"), color: "#ff6600", fontSize: 12, padding: "6px 12px" }}>No runners</button>}
            <button onClick={() => setShowEvent(null)} style={{ ...btn("g"), fontSize: 11, padding: "6px 8px", color: G.tx3 }}>Cancel</button>
          </div>
        )}

        {showEvent === "WP" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, padding: "8px 12px", background: "#ff993315", borderRadius: 6, border: "1px solid #ff993344", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#ff9933", fontWeight: 800 }}>WP — WHO ADVANCED?</span>
            {runners.first && <button onClick={() => logEvent("WP", "first")} style={{ ...btn("g"), color: "#ff9933", fontSize: 12, padding: "6px 12px" }}>Runner on 1st</button>}
            {runners.second && <button onClick={() => logEvent("WP", "second")} style={{ ...btn("g"), color: "#ff9933", fontSize: 12, padding: "6px 12px" }}>Runner on 2nd</button>}
            {runners.third && <button onClick={() => logEvent("WP", "third")} style={{ ...btn("g"), color: "#ff9933", fontSize: 12, padding: "6px 12px" }}>Runner on 3rd (scores)</button>}
            {(Number(runners.first) + Number(runners.second) + Number(runners.third)) >= 2 && <button onClick={() => logEvent("WP", "all")} style={{ ...btn("g"), color: "#ff9933", fontSize: 12, padding: "6px 12px", border: "2px solid #ff993388" }}>All runners advance</button>}
            {!runners.first && !runners.second && !runners.third && <button onClick={() => logEvent("WP")} style={{ ...btn("g"), color: "#ff9933", fontSize: 12, padding: "6px 12px" }}>No runners</button>}
            <button onClick={() => setShowEvent(null)} style={{ ...btn("g"), fontSize: 11, padding: "6px 8px", color: G.tx3 }}>Cancel</button>
          </div>
        )}

        {showEvent === "PB" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, padding: "8px 12px", background: "#ff993315", borderRadius: 6, border: "1px solid #ff993344", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#ff9933", fontWeight: 800 }}>PB — WHO ADVANCED?</span>
            {runners.first && <button onClick={() => logEvent("PB", "first")} style={{ ...btn("g"), color: "#ff9933", fontSize: 12, padding: "6px 12px" }}>Runner on 1st</button>}
            {runners.second && <button onClick={() => logEvent("PB", "second")} style={{ ...btn("g"), color: "#ff9933", fontSize: 12, padding: "6px 12px" }}>Runner on 2nd</button>}
            {runners.third && <button onClick={() => logEvent("PB", "third")} style={{ ...btn("g"), color: "#ff9933", fontSize: 12, padding: "6px 12px" }}>Runner on 3rd (scores)</button>}
            {(Number(runners.first) + Number(runners.second) + Number(runners.third)) >= 2 && <button onClick={() => logEvent("PB", "all")} style={{ ...btn("g"), color: "#ff9933", fontSize: 12, padding: "6px 12px", border: "2px solid #ff993388" }}>All runners advance</button>}
            {!runners.first && !runners.second && !runners.third && <button onClick={() => logEvent("PB")} style={{ ...btn("g"), color: "#ff9933", fontSize: 12, padding: "6px 12px" }}>No runners</button>}
            <button onClick={() => setShowEvent(null)} style={{ ...btn("g"), fontSize: 11, padding: "6px 8px", color: G.tx3 }}>Cancel</button>
          </div>
        )}

        {showPH && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, padding: "8px 12px", background: G.gold + "12", borderRadius: 6, border: "1px solid " + G.gold + "44", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: G.gold, fontWeight: 800 }}>PINCH HITTER — #{batOrder}{curBatterName ? " for " + curBatterName : ""}:</span>
            <input value={phName} onChange={e => setPhName(e.target.value)} placeholder="Name (optional)"
              style={{ background: G.sf2, border: "1px solid " + G.bd2, borderRadius: 5, padding: "5px 8px", color: G.tx, fontSize: 12, outline: "none", width: 130 }} />
            <button onClick={() => setPhHand("R")} style={{ padding: "5px 10px", borderRadius: 5, border: "none", background: phHand === "R" ? G.gold : G.sf2, color: phHand === "R" ? "#000" : G.tx2, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>R</button>
            <button onClick={() => setPhHand("L")} style={{ padding: "5px 10px", borderRadius: 5, border: "none", background: phHand === "L" ? G.gold : G.sf2, color: phHand === "L" ? "#000" : G.tx2, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>L</button>
            <button onClick={logPH} style={{ ...btn("p"), padding: "5px 12px", fontSize: 12 }}>Confirm</button>
            <button onClick={() => setShowPH(false)} style={{ ...btn("g"), padding: "5px 8px", fontSize: 11, color: G.tx3 }}>Cancel</button>
          </div>
        )}
      </div>


      <div style={cd}>
        <div style={cT}>Pitch Type</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: selType ? 10 : 0 }}>
          {pts.map((p, i) => (
            <button key={p.key} onClick={() => setSelType(selType === p.key ? null : p.key)} style={{
              padding: "10px 16px", borderRadius: 7, fontSize: 14, fontWeight: 800, cursor: "pointer",
              background: selType === p.key ? gPC(p.key) : gPC(p.key) + "20",
              color: selType === p.key ? gPCtext(p.key) : gPC(p.key),
              border: "2px solid " + (selType === p.key ? gPC(p.key) : gPC(p.key) + "55"), minWidth: 68,
            }}><span style={{ fontSize: 10, opacity: 0.5, marginRight: 3 }}>{i + 1}</span>{p.key}</button>
          ))}
          {!showAP ? (
            <button onClick={() => setShowAP(true)} style={{ padding: "10px 14px", borderRadius: 7, fontSize: 18, fontWeight: 800, cursor: "pointer", background: G.sf2, color: G.tx3, border: "2px dashed " + G.bd2, minWidth: 50 }}>+</button>
          ) : (
            <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", marginTop: 6, padding: "8px 10px", background: G.sf2, borderRadius: 8, border: "1px solid " + G.bd2 }}>
              <input value={npKey} onChange={e => setNpKey(e.target.value.toUpperCase().slice(0, 3))} placeholder="KEY" maxLength={3}
                style={{ background: G.bg, border: "2px solid " + G.bd2, borderRadius: 6, padding: "6px", color: G.tx, fontSize: 13, outline: "none", width: 52, textAlign: "center" }}
                onKeyDown={e => { if (e.key === "Enter") addPt(); }} />
              <span style={{ fontSize: 10, color: G.tx3, fontWeight: 800 }}>FAMILY:</span>
              {FAMILIES.map(f => (
                <button key={f.key} onClick={() => setNpFamily(f.key)} style={{ padding: "5px 10px", borderRadius: 5, border: "none", background: npFamily === f.key ? G.gold : G.bd2, color: npFamily === f.key ? "#000" : G.tx2, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{f.label}</button>
              ))}
              <button onClick={addPt} style={{ ...btn("p"), padding: "6px 10px", fontSize: 11 }}>Add</button>
              <button onClick={() => setShowAP(false)} style={{ ...btn("g"), padding: "6px 8px", fontSize: 11 }}>X</button>
            </div>
          )}
          {/* Unknown pitch type — coach missed what was thrown */}
          <button onClick={() => setSelType(selType === "UNK" ? null : "UNK")} style={{
            padding: "10px 14px", borderRadius: 7, fontSize: 14, fontWeight: 800, cursor: "pointer",
            background: selType === "UNK" ? G.tx3 : G.sf2,
            color: selType === "UNK" ? "#000" : G.tx3,
            border: "2px solid " + (selType === "UNK" ? G.tx3 : G.bd),
            minWidth: 50, opacity: 0.7,
          }}>?</button>
        </div>
        {selType && (
          <div>
            <div style={{ fontSize: 10, color: G.tx2, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
              Result for <span style={{ color: selType === "UNK" ? G.tx3 : gPC(selType), fontWeight: 800 }}>{selType === "UNK" ? "Unknown Pitch" : selType}</span>:
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {RES.map(r => (
                <button key={r.key} onClick={() => {
                  if (r.key === "hit") { setShowHitMenu({ type: selType }); }
                  else if (r.key === "out") { setShowOutMenu({ type: selType }); }
                  else if (r.key === "wp" || r.key === "pb") { setPendingWPPB({ res: r.key, pitchType: selType }); }
                  else if ((r.key === "K" || r.key === "Kc") && strikes === 2 && location === "dirt" && (outs === 2 || !runners.first)) { setPendingDropK({ res: r.key, pitchType: selType }); }
                  else { logPitch(selType, r.key); }
                }} style={{
                  padding: "9px 14px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  background: G.sf2,
                  color: "#fff",
                  border: "2px solid " + G.bd2
                }}>{r.s}</button>
              ))}
              <button onClick={() => setBuntArmed(b => !b)} title="Arm, then tap the real result (hit / ROE / out / GO / FC / PO / foul / K). 2-strike foul becomes a K; a bunted out with runners on auto-tags a sac bunt + moves runners." style={{ padding: "9px 14px", borderRadius: 6, fontSize: 13, fontWeight: 800, cursor: "pointer", background: buntArmed ? G.gold + "30" : G.sf2, color: buntArmed ? G.gold : G.tx2, border: "2px solid " + (buntArmed ? G.gold : G.bd2) }}>{buntArmed ? "BUNT \u25CF" : "Bunt"}</button>
              <button onClick={() => logPitch(selType, "fo", 1, null, { sacFly: true, rbi: true })} disabled={!runners.third} title={runners.third ? "Flyout, R3 scores \u2014 logs FO + sac fly + RBI (QAB)" : "Needs a runner on 3rd"} style={{ padding: "9px 14px", borderRadius: 6, fontSize: 13, fontWeight: 800, cursor: runners.third ? "pointer" : "not-allowed", opacity: runners.third ? 1 : 0.35, background: G.sf2, color: G.blu, border: "2px solid " + G.blu + "44" }}>Sac Fly</button>
              <button onClick={() => setSelType(null)} style={{ padding: "9px 12px", borderRadius: 6, fontSize: 13, cursor: "pointer", background: "transparent", color: G.tx3, border: "1px solid " + G.bd }}>Cancel</button>
            </div>
            {showHitMenu && showHitMenu.type === selType && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, padding: "8px 12px", background: G.grn + "12", borderRadius: 6, border: "1px solid " + G.grn + "44", flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: G.grn, fontWeight: 800, marginRight: 2 }}>HIT TYPE:</span>
                {[{ label: "1B", bases: 1 }, { label: "2B", bases: 2 }, { label: "3B", bases: 3 }, { label: "HR", bases: 4 }].map(h => (
                  <button key={h.label} onClick={() => logPitch(selType, "hit", h.bases)} style={{ padding: "8px 18px", borderRadius: 6, fontSize: 14, fontWeight: 800, cursor: "pointer", background: G.grn + "25", color: G.grn, border: "2px solid " + G.grn + "66" }}>{h.label}</button>
                ))}
                <button onClick={() => setShowHitMenu(null)} style={{ padding: "8px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: G.tx3, border: "1px solid " + G.bd }}>Cancel</button>
              </div>
            )}
            {showOutMenu && showOutMenu.type === selType && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, padding: "8px 12px", background: G.sf2, borderRadius: 6, border: "1px solid " + G.bd2, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: G.tx2, fontWeight: 800, marginRight: 2 }}>OUT TYPE:</span>
                {[
                  { label: "GO", key: "go", desc: "Groundout" },
                  { label: "FO", key: "fo", desc: "Flyout" },
                  { label: "PO", key: "po", desc: "Popup" },
                  { label: "LO", key: "lo", desc: "Lineout" },
                ].map(o => (
                  <button key={o.key} onClick={() => { logPitch(selType, o.key); setShowOutMenu(null); }}
                    style={{ padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 800, cursor: "pointer", background: G.bd2, color: G.tx, border: "2px solid " + G.bd2, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span>{o.label}</span>
                    <span style={{ fontSize: 9, color: G.tx3, fontWeight: 600 }}>{o.desc}</span>
                  </button>
                ))}
                <button onClick={() => { logPitch(selType, "out"); setShowOutMenu(null); }}
                  style={{ padding: "8px 14px", borderRadius: 6, fontSize: 13, fontWeight: 800, cursor: "pointer", background: "transparent", color: G.tx3, border: "1px solid " + G.bd }}>Generic Out</button>
                <button onClick={() => setShowOutMenu(null)} style={{ padding: "8px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: G.tx3, border: "1px solid " + G.bd }}>Cancel</button>
              </div>
            )}
            {pendingWPPB && pendingWPPB.pitchType === selType && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, padding: "8px 12px", background: "#ff993315", borderRadius: 6, border: "1px solid #ff993344", flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#ff9933", fontWeight: 800 }}>{pendingWPPB.res.toUpperCase()} — WAS IT A:</span>
                <button onClick={() => { logPitch(pendingWPPB.pitchType, pendingWPPB.res, 1, false); setPendingWPPB(null); }}
                  style={{ padding: "7px 18px", borderRadius: 6, border: "2px solid " + G.gold, background: G.gold + "20", color: G.gold, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Strike</button>
                <button onClick={() => { logPitch(pendingWPPB.pitchType, pendingWPPB.res, 1, true); setPendingWPPB(null); }}
                  style={{ padding: "7px 18px", borderRadius: 6, border: "2px solid " + G.blu, background: G.blu + "20", color: G.blu, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Ball</button>
                <button onClick={() => setPendingWPPB(null)} style={{ padding: "7px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: G.tx3, border: "1px solid " + G.bd }}>Cancel</button>
              </div>
            )}
            {pendingDropK && pendingDropK.pitchType === selType && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, padding: "8px 12px", background: G.blu + "15", borderRadius: 6, border: "1px solid " + G.blu + "44", flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: G.blu, fontWeight: 800 }}>DROPPED 3RD STRIKE — BATTER:</span>
                <button onClick={() => { logPitch(pendingDropK.pitchType, pendingDropK.res, 1, null, null, false); setPendingDropK(null); }}
                  style={{ padding: "7px 18px", borderRadius: 6, border: "2px solid " + G.gold, background: G.gold + "20", color: G.gold, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Out</button>
                <button onClick={() => { logPitch(pendingDropK.pitchType, pendingDropK.res, 1, null, null, true); setPendingDropK(null); }}
                  style={{ padding: "7px 18px", borderRadius: 6, border: "2px solid " + G.grn, background: G.grn + "20", color: G.grn, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Reached 1st</button>
                <button onClick={() => setPendingDropK(null)} style={{ padding: "7px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: G.tx3, border: "1px solid " + G.bd }}>Cancel</button>
                <span style={{ fontSize: 9, color: G.tx3, width: "100%" }}>Strikeout is still recorded for the pitcher. “Reached” adds no out — tap bases to adjust any runners who advanced.</span>
              </div>
            )}
          </div>
        )}

        {/* ── QAB / HARD HIT TAG PANEL (under result entry) ── */}
        {qabPanel && enableQAB && (() => {
          const pitch = game.pitches.find(p => p.id === qabPanel.pitchId);
          const cur = (pitch && pitch.atBatTags) || {};
          const isAutoQAB = qabPanel.result === "hit" || qabPanel.result === "roe";
          const isBunt = !!(pitch && pitch.bunt);
          // GO: QAB is auto-decided (v118 rule); never offer a manual QAB toggle, only Hard Hit.
          const isGO = qabPanel.result === "go" && !isBunt;
          const goIsQAB = isGO && pitch ? isQAB(pitch, (buildAtBats([game], { includeUnnamed: true }).find(ab => ab.pitches.some(pp => pp.id === pitch.id)) || { pitches: [pitch] }).pitches) : false;
          const panelTags = isBunt
            ? [{ k: "sacBunt", l: "Sac \u2713" }].concat(cur.rbi ? [{ k: "rbi", l: "RBI \u2713" }] : [])
            : cur.sacFly
            ? [{ k: "hardHit", l: "Hard Hit" }, { k: "advRunner", l: "Moved 2nd runner" }]
            : isGO
            ? [{ k: "hardHit", l: "Hard Hit" }]
            : isAutoQAB
            ? [{ k: "hardHit", l: "Hard Hit" }]
            : [{ k: "hardHit", l: "Hard Hit" }, { k: "qab", l: "QAB" }];
          return (
          <div style={{ marginTop: 10, padding: "10px 14px", background: G.gold + "12", borderRadius: 8, border: "1px solid " + G.gold + "44" }}>
            <div style={{ fontSize: 9, color: G.gold, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{isBunt ? (cur.sacBunt ? "Sac bunt \u2014 QAB \u2713 (tap Sac to undo)" : "Bunt out \u2014 not a QAB") : cur.sacFly ? "Sac fly logged \u2014 QAB + RBI \u2713" : isGO ? (goIsQAB ? "Groundout \u2014 QAB \u2713 \u00b7 mark hard hit?" : "Groundout \u2014 not a QAB \u00b7 hard hit?") : isAutoQAB ? "Already a QAB \u2014 mark hard hit?" : "Tag this at-bat"}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {panelTags.map(t => (
                <button key={t.k} onClick={() => toggleQabTag(t.k)}
                  style={{ ...btn("g"), fontSize: 12, fontWeight: 800, padding: "7px 14px",
                    background: cur[t.k] ? G.gold + "30" : "transparent",
                    color: cur[t.k] ? G.gold : G.tx3,
                    border: "1px solid " + (cur[t.k] ? G.gold : G.bd2), borderRadius: 6 }}>
                  {t.l}
                </button>
              ))}
              <button onClick={() => setQabPanel(null)} style={{ ...btn("g"), fontSize: 12, padding: "7px 14px", color: G.grn, border: "1px solid " + G.grn + "44", marginLeft: 4 }}>Done</button>
            </div>
          </div>
          ); })()}
      </div>

      </div>
      <div>
      {!wide && <button onClick={() => setShowMore(m => !m)} style={{ ...btn("g"), width: "100%", fontSize: 12, padding: "8px", color: showMore ? G.gold : G.tx3, marginBottom: showMore ? 10 : 0 }}>{showMore ? "Hide extras" : "More — recent pitches, live mix, scouting"}</button>}
      {(wide || showMore) && (<>
      {recentBody}
      {mixBody}
      {scoutBody}
      {heatBody}

      {!canAccess("prediction", tier) && game.pitches.filter(p => !EVENTS.has(p.type)).length >= 5 && (
        <div style={{ ...cd, border: "1px solid " + G.gold + "22", background: G.gold + "05", textAlign: "center", padding: "12px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: G.gold, marginBottom: 3 }}>🔒 Pro Features Available</div>
          <div style={{ fontSize: 11, color: G.tx3, marginBottom: 6 }}>Unlock prediction engine, TTO shifts, sequencing, zone heat maps, and scouting reports.</div>
          <a href="mailto:coach@armsight.app" style={{ color: G.gold, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>Contact us to upgrade →</a>
        </div>
      )}
      </>)}
      </div>
      </div>
    </div>
  );
}