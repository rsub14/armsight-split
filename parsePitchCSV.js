function parsePitchCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (lines.length < 2) return { pitches: [], pitcher: "", skipped: 0 };
  const head = lines[0].split(",").map(h => h.trim().toLowerCase());
  const idx = (names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const iType = idx(["type", "pitch", "pitchtype", "pitch_type"]);
  const iLoc = idx(["location", "zone", "loc"]);
  const iRes = idx(["result", "outcome", "res"]);
  const iB = idx(["balls", "ball", "b"]);
  const iS = idx(["strikes", "strike", "s"]);
  const iO = idx(["outs", "out", "o"]);
  const iSide = idx(["batside", "side", "bats", "hand"]);
  const iInn = idx(["inning", "inn"]);
  const iPit = idx(["pitcher", "pit"]);
  const iBunt = idx(["bunt"]);
  const iBatOrder = idx(["batorder", "order", "spot"]);
  const iTTO = idx(["timesthrough", "tto"]);
  const iRunners = idx(["runners", "baserunners"]);
  const iTags = idx(["tags", "attags", "atbattags"]);
  const iHB = idx(["hitbases", "bases"]);
  const iDrop = idx(["dropreached", "droppedk"]);
  const iGame = idx(["game", "opponent", "opp"]);
  const iDate = idx(["date"]);
  const decRunners = (s) => { s = (s || "").trim(); const r = {}; if (s.includes("1")) r.first = true; if (s.includes("2")) r.second = true; if (s.includes("3")) r.third = true; return r; };
  const TAG_KEYS = new Set(["qab", "hardHit", "sacFly", "sacBunt", "advRunner", "rbi"]);
  const decTags = (s) => { const o = {}; (s || "").split(/[|;]/).forEach(k => { const kk = k.trim(); const match = [...TAG_KEYS].find(t => t.toLowerCase() === kk.toLowerCase()); if (match) o[match] = true; }); return Object.keys(o).length ? o : null; };
  const num = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };
  const pitches = []; let pitcher = ""; let skipped = 0; const meta = {};
  const RES_ALIAS = { k: "K", swstr: "K", kc: "Kc", foul: "foul", ball: "ball", out: "out", hit: "hit", single: "hit", "1b": "hit", double: "hit", "2b": "hit", triple: "hit", "3b": "hit", hr: "hit", homerun: "hit", "home run": "hit", hbp: "hbp", ibb: "ibb", fc: "fc", roe: "roe", error: "roe", gdp: "gdp", go: "go", groundout: "go", fo: "fo", flyout: "fo", po: "po", popout: "po", lo: "lo", lineout: "lo" };
  const HIT_BASES = { double: 2, "2b": 2, triple: 3, "3b": 3, hr: 4, homerun: 4, "home run": 4 };
  const VALID_LOC = new Set([...STRIKE_ZONE_KEYS, ...BALL_ZONE_KEYS]);
  for (let r = 1; r < lines.length; r++) {
    const c = lines[r].split(",").map(x => x.trim());
    if (c.length === 1 && !c[0]) continue;
    if (iPit >= 0 && !pitcher && c[iPit]) pitcher = c[iPit];
    if (iGame >= 0 && !meta.opponent && c[iGame]) meta.opponent = c[iGame];
    if (iDate >= 0 && !meta.date && c[iDate]) meta.date = c[iDate];
    const rawRes = iRes >= 0 ? (c[iRes] || "").toLowerCase() : "";
    const res = RES_ALIAS[rawRes];
    if (!res) { skipped++; continue; }
    let loc = iLoc >= 0 ? (c[iLoc] || "").toLowerCase() : "";
    if (!VALID_LOC.has(loc)) loc = null;
    pitches.push({
      id: Date.now() + r,
      type: iType >= 0 ? (c[iType] || "").toUpperCase() : "",
      result: res,
      ...(res === "hit" ? { hitBases: HIT_BASES[rawRes] || 1 } : {}),
      location: loc,
      ...(iBunt >= 0 && /^(1|y|yes|true|x)$/i.test(c[iBunt] || "") ? { bunt: true } : {}),
      balls: iB >= 0 ? num(c[iB]) : 0,
      strikes: iS >= 0 ? num(c[iS]) : 0,
      outs: iO >= 0 ? num(c[iO]) : 0,
      batSide: iSide >= 0 ? ((c[iSide] || "R").toUpperCase().charAt(0) === "L" ? "L" : "R") : "R",
      inning: iInn >= 0 ? num(c[iInn]) : 1,
      batOrder: iBatOrder >= 0 ? num(c[iBatOrder]) : 0,
      timesThrough: iTTO >= 0 ? (num(c[iTTO]) || 1) : 1,
      runners: iRunners >= 0 ? decRunners(c[iRunners]) : {},
      ...(iTags >= 0 && decTags(c[iTags]) ? { atBatTags: decTags(c[iTags]) } : {}),
      ...(iHB >= 0 && num(c[iHB]) ? { hitBases: num(c[iHB]) } : {}),
      ...(iDrop >= 0 && /^(1|y|yes|true|x)$/i.test(c[iDrop] || "") ? { dropReached: true } : {}),
    });
  }
  return { pitches, pitcher, skipped, meta };
}