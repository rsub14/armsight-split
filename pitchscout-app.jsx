import { useState, useEffect, useCallback, useMemo } from "react";

const { useState, useEffect, useCallback, useMemo } = React;

/* --- DATA --- */
const DEFAULT_PT = [
  { key: "FB", label: "Fastball",  family: "fastball" },
  { key: "CB", label: "Curveball", family: "breaking" },
  { key: "SL", label: "Slider",    family: "breaking" },
  { key: "CH", label: "Changeup",  family: "offspeed"  },
  // SI and SP removed from defaults — add via + button as needed
];

// Family labels for the picker UI
const FAMILIES = [
  { key: "fastball", label: "Fastball" },
  { key: "breaking", label: "Breaking" },
  { key: "offspeed",  label: "Off-Speed" },
];

// Hardcoded family map as the ultimate fallback — covers all default pitches
// even when stored game data predates the family field being added
const FAMILY_FALLBACK = {
  FB: "fastball", SI: "fastball",
  CB: "breaking", SL: "breaking",
  CH: "offspeed",  SP: "offspeed",
};

const getPitchFamily = (pitchKey, pitchTypes) => {
  // First try the stored pitchTypes (covers custom pitches with family set)
  const pt = pitchTypes.find(p => p.key === pitchKey);
  if (pt?.family) return pt.family;
  // Fall back to hardcoded map for default pitches without stored family
  return FAMILY_FALLBACK[pitchKey] || "unknown";
};

const RES = [
  { key: "K", s: "K" },
  { key: "Kc", s: "\u{A4D8}" },
  { key: "foul", s: "Foul" },
  { key: "ball", s: "Ball" },
  { key: "out", s: "Out" },
  { key: "hit", s: "Hit" },
  { key: "hbp", s: "HBP" },
  { key: "fc", s: "FC" },
  { key: "roe", s: "ROE" },
  { key: "gdp", s: "GDP" },
];

const STRIKE_ZONES = [
  { k: "z1", r: 1, c: 1, rL: "Up Away", lL: "Up In" },
  { k: "z2", r: 1, c: 2, rL: "Up", lL: "Up" },
  { k: "z3", r: 1, c: 3, rL: "Up In", lL: "Up Away" },
  { k: "z4", r: 2, c: 1, rL: "Away", lL: "In" },
  { k: "z5", r: 2, c: 2, rL: "Mid", lL: "Mid" },
  { k: "z6", r: 2, c: 3, rL: "In", lL: "Away" },
  { k: "z7", r: 3, c: 1, rL: "Low Away", lL: "Low In" },
  { k: "z8", r: 3, c: 2, rL: "Low", lL: "Low" },
  { k: "z9", r: 3, c: 3, rL: "Low In", lL: "Low Away" },
];
const BALL_ZONES = [
  { k: "b_high", r: 0, c: 1, colSpan: 3, rowSpan: 1, rL: "High", lL: "High" },
  { k: "b_left", r: 1, c: 0, colSpan: 1, rowSpan: 3, rL: "Off Away", lL: "Off In" },
  { k: "b_right", r: 1, c: 4, colSpan: 1, rowSpan: 3, rL: "Off In", lL: "Off Away" },
  { k: "b_low", r: 4, c: 1, colSpan: 3, rowSpan: 1, rL: "Low", lL: "Low" },
  { k: "dirt", r: 5, c: 1, colSpan: 3, rowSpan: 1, rL: "Dirt", lL: "Dirt" },
];

const LOC_TIER = { z1: "up", z2: "up", z3: "up", z4: "mid", z5: "mid", z6: "mid", z7: "down", z8: "down", z9: "down", b_high: "up", b_left: "mid", b_right: "mid", b_low: "down", dirt: "down" };
const ZONE_BY_K = {};
[...STRIKE_ZONES, ...BALL_ZONES].forEach(z => { ZONE_BY_K[z.k] = z; });
// Batter-relative location bucket: up / down win first, else in / away from the zone label, else mid.
const locBucket = (loc, side) => {
  if (!loc) return null;
  // In/away is the stronger sequencing axis, so it wins first; height (up/down) is the fallback.
  const z = ZONE_BY_K[loc];
  if (z) { const lbl = side === "L" ? z.lL : z.rL; if (lbl.indexOf("In") !== -1) return "in"; if (lbl.indexOf("Away") !== -1) return "away"; }
  const v = LOC_TIER[loc];
  if (v === "up") return "up";
  if (v === "down") return "down";
  return "mid";
};
// ── PLATE-DISCIPLINE CLASSIFIERS (shared by hitter and pitcher views) ──
const SWING_RESULTS = new Set(["K", "foul", "hit", "out", "fc", "roe", "gdp", "go", "fo", "po", "lo"]);
const STRIKE_ZONE_KEYS = new Set(STRIKE_ZONES.map(z => z.k));
const BALL_ZONE_KEYS = new Set(BALL_ZONES.map(z => z.k));
const pdSeen = (p) => !EVENTS.has(p.type) && p.type !== "UNK" && p.result !== "ibb" && p.result !== "wp" && p.result !== "pb" && !p.bunt;
const pdSwing = (p) => SWING_RESULTS.has(p.result);
const pdWhiff = (p) => p.result === "K";
const pdOutZone = (p) => !!p.location && BALL_ZONE_KEYS.has(p.location);
const pdInZone = (p) => !!p.location && STRIKE_ZONE_KEYS.has(p.location);
const pdRates = (pitches) => {
  const seen = pitches.filter(pdSeen);
  const swings = seen.filter(pdSwing).length;
  const oz = seen.filter(pdOutZone);
  return {
    whiff: swings ? seen.filter(pdWhiff).length / swings : -1,
    chase: oz.length ? oz.filter(pdSwing).length / oz.length : -1,
    take:  seen.length ? seen.filter(p => !pdSwing(p)).length / seen.length : -1,
    seen: seen.length,
  };
};
const DPC = {
  FB: "#ff4d4d", CB: "#4da6ff", SL: "#b366ff",
  CH: "#33ff99", SI: "#ff8c1a", SP: "#33ccff",
  CT: "#ffe14d", FC: "#ffe14d", FS: "#1ad6c0", KN: "#9e9e9e", EP: "#c0c0c0", FF: "#ff4d4d", FT: "#ff8c1a", ST: "#cc99ff", SV: "#8c66ff",
  PKO: "#ffd700", PK: "#ffd700", "PK-E": "#ff6600", SB: "#00ff88", WP: "#ff9933", PB: "#ff9933", IBB: "#66aaff"
};
const gPC = (k) => DPC[k] || `hsl(${(k.charCodeAt(0) * 47 + (k.length > 1 ? k.charCodeAt(1) : 0) * 31) % 360},70%,58%)`;
// Readable text color (black/white) for a solid pitch-color background. Handles hex (#rgb/#rrggbb) and hsl().
const gPCtext = (k) => {
  const c = gPC(k);
  let lum = 0.6;
  const hsl = c.match(/hsl\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*([\d.]+)%/);
  if (hsl) { lum = parseFloat(hsl[1]) / 100; }
  else {
    let h = c.replace("#", "");
    if (h.length === 3) h = h.split("").map(x => x + x).join("");
    if (h.length >= 6) {
      const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
      lum = 0.2126 * r + 0.7152 * g + 0.587 * b; // perceived luminance (approx)
    }
  }
  return lum > 0.6 ? "#000" : "#fff";
};

const G = {
  bg: "#000", sf: "#0a0a0a", sf2: "#141414", bd: "#2a2a2a", bd2: "#3d3d3d",
  gold: "#ffd700", goldDim: "#e6c200", tx: "#fff", tx2: "#ccc", tx3: "#888",
  grn: "#00ff88", red: "#ff3333", blu: "#4da6ff"
};

const STK = "armsight_v1";
const FB_UID_KEY = "armsight_fb_uid";

// ── Firebase config (loaded from CDN scripts in HTML) ────────
const FB_CONFIG = {
  apiKey: "AIzaSyCQMwZe9eXt1vnEFpa6mQNuZ2pHrRfFwCE",
  authDomain: "armsight-50813.firebaseapp.com",
  projectId: "armsight-50813",
  storageBucket: "armsight-50813.firebasestorage.app",
  messagingSenderId: "341730039385",
  appId: "1:341730039385:web:4bae0142a918efe5094348"
};

// ── Firebase helpers (only active for Elite tier) ────────────
let _fbApp = null, _fbDb = null, _fbAuth = null;

const getFB = () => {
  if (_fbApp) return { db: _fbDb, auth: _fbAuth };
  // Guard: firebase SDK may not be loaded yet
  if (typeof firebase === "undefined") {
    console.warn("[ArmSight] Firebase SDK not loaded yet — sync unavailable this call");
    return { db: null, auth: null };
  }
  try {
    _fbApp  = firebase.initializeApp(FB_CONFIG);
    _fbAuth = firebase.auth();
    _fbDb   = firebase.firestore();
    _fbDb.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    return { db: _fbDb, auth: _fbAuth };
  } catch(e) {
    // App may already be initialized — try to get existing instance
    try {
      _fbApp  = firebase.app();
      _fbAuth = firebase.auth();
      _fbDb   = firebase.firestore();
      return { db: _fbDb, auth: _fbAuth };
    } catch(e2) {
      console.warn("[ArmSight] Firebase init failed:", e2);
      return { db: null, auth: null };
    }
  }
};

// Save a game to Firestore (Elite only)
const fbSaveGame = async (uid, game) => {
  try {
    const { db } = getFB();
    if (!db || !uid) return;
    await db.collection("users").doc(uid).collection("games").doc(String(game.id)).set(game);
  } catch(e) { console.warn("[ArmSight] Firestore save failed:", e); }
};

// Load all games from Firestore (Elite only)
const fbLoadGames = async (uid) => {
  try {
    const { db } = getFB();
    if (!db || !uid) return null;
    const snap = await db.collection("users").doc(uid).collection("games").get();
    return snap.docs.map(d => d.data());
  } catch(e) { console.warn("[ArmSight] Firestore load failed:", e); return null; }
};

// Delete a game from Firestore
const fbSaveMeta = async (uid, meta) => {
  try {
    const { db } = getFB();
    if (!db || !uid) return;
    await db.collection("users").doc(uid).set({ scoutingNotes: meta.scoutingNotes || {}, prefs: meta.prefs || {}, metaUpdatedAt: meta.metaUpdatedAt || Date.now() }, { merge: true });
  } catch(e) { console.warn("[ArmSight] Firestore meta save failed:", e); }
};

// Delete a game from Firestore
const fbDeleteGame = async (uid, gameId) => {
  try {
    const { db } = getFB();
    if (!db || !uid) return;
    await db.collection("users").doc(uid).collection("games").doc(String(gameId)).delete();
  } catch(e) { console.warn("[ArmSight] Firestore delete failed:", e); }
};
const LIC_KEY = "armsight_license";

// \u2500\u2500 SERVER-SIDE KEY VALIDATION \u2500\u2500
// Set LIC_API to the deployed license worker origin (e.g. "https://armsight-worker.YOURACCT.workers.dev")
// to verify keys against the issued-key sheet via POST /validate. Blank = local format check only,
// exactly the pre-v110 behavior \u2014 safe to ship before the worker is deployed.
const LIC_API = "https://armsight-license.coach-f4f.workers.dev"; // license worker — enforcement LIVE as of v115
const LIC_CHECK_KEY = "armsight_license_check"; // { key, tier, ts }
// Resolves to { status: "valid", tier } | { status: "invalid" } | { status: "unknown" }.
// "unknown" (offline / 5xx / LIC_API unset) must NEVER lock a coach out \u2014 grace applies.
const serverValidateKey = async (key) => {
  if (!LIC_API || !key) return { status: "unknown" };
  try {
    const res = await fetch(LIC_API + "/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: key.trim().toUpperCase() }) });
    if (res.status === 200) {
      const d = await res.json();
      if (d.valid && d.tier) return { status: "valid", tier: d.tier };
      if (d.valid === false) return { status: "invalid" };
    }
    return { status: "unknown" };
  } catch (e) { return { status: "unknown" }; }
};

// Validate a license key and return tier or null
const validateKey = (key) => {
  if (!key) return null;
  const k = key.trim().toUpperCase();
  if (/^AS-BETA-\d{4}$/.test(k))  return "pro";   // beta = full pro access
  if (/^AS-BASIC-\d{4}$/.test(k)) return "basic";
  if (/^AS-PRO-\d{4}$/.test(k))   return "pro";
  if (/^AS-ELITE-\d{4}$/.test(k)) return "elite";
  return null;
};

const getTierLabel = (tier) => {
  if (tier === "basic") return "Basic";
  if (tier === "pro")   return "Pro";
  if (tier === "elite") return "Elite";
  return "Unknown";
};

const TIER_COLOR = { basic: "#888", pro: "#ffd700", elite: "#00ccff" };

// Feature access by tier
const canAccess = (feature, tier) => {
  if (!tier) return false;
  const access = {
    chart:      ["basic", "pro", "elite"],
    prediction: ["pro", "elite"],
    zones:      ["pro", "elite"],
    scout:      ["pro", "elite"],
    lineup:     ["pro", "elite"],
    tto:        ["pro", "elite"],
    pickoffs:   ["pro", "elite"],
    cloud:      ["elite"],
  };
  return (access[feature] || []).includes(tier);
};

const loadLicense = () => {
  try { return localStorage.getItem(LIC_KEY) || null; } catch(e) { return null; }
};
const saveLicense = (key) => {
  try { localStorage.setItem(LIC_KEY, key.trim().toUpperCase()); } catch(e) {}
};
const clearLicense = () => {
  try { localStorage.removeItem(LIC_KEY); } catch(e) {}
};
const EVENTS = new Set(["PKO", "PK", "PK-E", "SB", "CS", "WP", "PB", "IBB"]);

// Infer whether a pitch result was a ball or strike
// wp/pb stored with isBall field set at log time
const inferBallStrike = (p) => {
  if (["K", "Kc", "foul", "out", "hit", "fc", "roe", "go", "fo", "po", "lo", "gdp"].includes(p.result)) return "strike";
  if (["ball", "hbp", "ibb"].includes(p.result)) return "ball";
  if (p.result === "wp" || p.result === "pb") return p.isBall ? "ball" : "strike";
  return null;
};
// Reconstruct the productive-out QAB tag for a groundout from its stored count/runners.
// Backfills games charted before GO auto-tagging existed. Idempotent, non-destructive.
const backfillGOTags = (p) => {
  if (!p || p.result !== "go" || p.bunt) return p;
  if (p.atBatTags && Object.keys(p.atBatTags).length) return p;
  const r = p.runners || {};
  const anyAdv = r.first || r.second || r.third;
  let t = null;
  if (p.outs === 0 && anyAdv) t = { advRunner: true };
  else if (p.outs === 1 && r.third) t = { rbi: true };
  return t ? { ...p, atBatTags: t } : p;
};
const loadData = () => {
  try {
    const d = JSON.parse(localStorage.getItem(STK)) || { games: [], scoutingNotes: {}, prefs: {} };
    if (!d.scoutingNotes) d.scoutingNotes = {};
    if (!d.prefs) d.prefs = {};
    if (!Array.isArray(d.roster)) d.roster = []; // team roster: { id, num, name, bats: "R"|"L"|"B" }
    if (Array.isArray(d.games)) d.games = d.games.map(g => g && Array.isArray(g.pitches) ? { ...g, pitches: g.pitches.map(backfillGOTags) } : g);
    return d;
  }
  catch (e) { return { games: [], scoutingNotes: {}, prefs: {}, roster: [] }; }
};
// Resolve the side a hitter actually bats from THIS pitch, given the current pitcher's throwing hand.
// Switch hitters ("B") bat opposite the pitcher: RHP -> bats L, LHP -> bats R. R/L hitters are fixed.
// Returns "R" or "L" (never "B") so every pitch records a concrete side and analytics split cleanly.
const effectiveSide = (bats, pitcherHand) => {
  if (bats === "B") return (pitcherHand === "L") ? "R" : "L";
  return (bats === "L") ? "L" : "R";
};
// \u2500\u2500 EXPORT / BACKUP HELPERS \u2500\u2500 (all tiers \u2014 the safety net for local-only data)
const triggerDownload = (filename, text) => {
  try {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    return true;
  } catch (e) { try { alert("Export failed: " + e.message); } catch (e2) {} return false; }
};
const safeName = (s) => (s || "").toString().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "game";
const exportGame = (game) => {
  if (!game) return;
  const payload = { format: "armsight-game", version: 1, exportedAt: new Date().toISOString(), app: "v116", game };
  triggerDownload("armsight-" + safeName(game.opponent) + "-" + safeName(game.date || game.id) + ".json", JSON.stringify(payload, null, 2));
};
const exportAll = (data) => {
  const payload = { format: "armsight-backup", version: 1, exportedAt: new Date().toISOString(), app: "v116", data };
  triggerDownload("armsight-backup-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(payload, null, 2));
};

// ── CSV EXPORT (lossless round-trip via parsePitchCSV) ──
// Nested fields are encoded into flat columns: runners -> "123" (bases occupied),
// tags -> "advRunner|hardHit", plus batOrder/timesThrough/hitBases/bunt/dropReached.
const CSV_COLS = ["game", "date", "pitcher", "inning", "batOrder", "batSide", "timesThrough", "balls", "strikes", "outs", "type", "location", "result", "hitBases", "runners", "tags", "bunt", "dropReached"];
const csvCell = (v) => {
  const s = (v === null || v === undefined) ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const encRunners = (r) => { if (!r) return ""; let s = ""; if (r.first) s += "1"; if (r.second) s += "2"; if (r.third) s += "3"; return s; };
const encTags = (t) => t ? Object.keys(t).filter(k => t[k]).join("|") : "";
const gameToCSVRows = (game) => (game.pitches || []).map(p => CSV_COLS.map(col => {
  switch (col) {
    case "game": return game.opponent || "";
    case "date": return game.date || "";
    case "pitcher": return p.pitcher || game.pitcher || "";
    case "runners": return encRunners(p.runners);
    case "tags": return encTags(p.atBatTags);
    case "bunt": return p.bunt ? "1" : "";
    case "dropReached": return p.dropReached ? "1" : "";
    case "hitBases": return p.hitBases || "";
    default: return p[col] === undefined ? "" : p[col];
  }
}).map(csvCell).join(","));
const exportGameCSV = (game) => {
  if (!game) return;
  const rows = [CSV_COLS.join(","), ...gameToCSVRows(game)];
  triggerDownload("armsight-" + safeName(game.opponent) + "-" + safeName(game.date || game.id) + ".csv", rows.join("\n"));
};
const exportAllCSV = (data) => {
  const rows = [CSV_COLS.join(",")];
  (data.games || []).forEach(g => rows.push(...gameToCSVRows(g)));
  triggerDownload("armsight-all-games-" + new Date().toISOString().slice(0, 10) + ".csv", rows.join("\n"));
};

let _saveWarned = false;
const saveData = (d) => {
  try { localStorage.setItem(STK, JSON.stringify(d)); _saveWarned = false; }
  catch (e) { if (!_saveWarned) { _saveWarned = true; try { alert("Storage is full \u2014 your latest change was NOT saved. Delete old games to free space."); } catch (e2) {} } }
};
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

const cd = { background: G.sf, border: "1px solid " + G.bd, borderRadius: 10, padding: 18, marginBottom: 12 };
const cT = { fontSize: 11, fontWeight: 800, color: G.gold, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 };
const btn = (v, d) => ({
  padding: "10px 18px", borderRadius: 7,
  border: v === "g" ? "2px solid " + G.bd2 : "none",
  background: v === "p" ? G.gold : v === "d" ? G.red : "transparent",
  color: v === "p" ? "#000" : v === "d" ? "#fff" : G.tx2,
  fontSize: 13, fontWeight: 800, cursor: d ? "not-allowed" : "pointer",
  opacity: d ? 0.4 : 1, fontFamily: "'Anybody',sans-serif",
  display: "inline-flex", alignItems: "center", gap: 6
});

/* ─── PREDICTION MODEL v3 — Phase-Based with Pitcher Profile ─────────────── */
// Phase 1 (1-5 pitches):  Baseball priors + early pitcher profile signals
// Phase 2 (6-15 pitches): Profile + emerging count patterns
// Phase 3 (16-30 pitches): Profile + solid count data
// Phase 4 (30+ pitches):  Full count isolation (observed data dominates)
const PRED_MIN = 4; // minimum pitches in a count for count-specific prediction

// Count category helpers
const HITTER_COUNTS  = new Set(["2-0","3-0","3-1","2-1"]);
const PITCHER_COUNTS = new Set(["0-2","1-2","0-1"]);
const TWO_STRIKE     = new Set(["0-2","1-2","2-2","3-2"]);

// Pitch family helpers
const FASTBALL_FAMILIES = new Set(["fastball"]);
const isFastball  = (key, pts) => getPitchFamily(key, pts) === "fastball";
const isBreaking  = (key, pts) => getPitchFamily(key, pts) === "breaking";
const isOffspeed  = (key, pts) => getPitchFamily(key, pts) === "offspeed";

// ── PITCHER PROFILE ────────────────────────────────────────────────────────
// Build a real-time profile of this pitcher based on observed data so far
function buildPitcherProfile(real, pitchTypes) {
  if (real.length === 0) return null;

  const allTypes = [...new Set(real.map(p => p.type))];
  const profile = {};

  allTypes.forEach(type => {
    const thrown = real.filter(p => p.type === type);
    const total  = thrown.length;
    if (total === 0) return;

    // Strike rate
    const strikes = thrown.filter(p => inferBallStrike(p) === "strike").length;
    const strikeRate = strikes / total;

    // Whiff rate (K or foul on swings)
    const whiffs = thrown.filter(p => p.result === "K" || p.result === "foul").length;
    const whiffRate = whiffs / total;

    // Ball rate
    const balls = thrown.filter(p => inferBallStrike(p) === "ball").length;
    const ballRate = balls / total;

    // Weak contact rate (GO, PO, GDP)
    const weakContact = thrown.filter(p => ["go","po","gdp"].includes(p.result)).length;
    const weakContactRate = weakContact / total;

    // Groundball rate (GO, GDP)
    const gbCount = thrown.filter(p => ["go","gdp"].includes(p.result)).length;
    const gbRate = gbCount / total;

    // First pitch of game
    const firstPitch = real[0];
    const isOpener = firstPitch && firstPitch.type === type;

    // Emerging pitch — not thrown in first 2 innings, appears after
    const earlyInnings = real.filter(p => p.inning <= 2);
    const lateInnings  = real.filter(p => p.inning > 2);
    const thrownEarly  = earlyInnings.filter(p => p.type === type).length;
    const thrownLate   = lateInnings.filter(p => p.type === type).length;
    const isEmerging   = thrownEarly === 0 && thrownLate >= 2 && real.length >= 10;

    // Shelved — ball rate 65%+ on 3+ attempts (faster suppression than before)
    const isShelved = total >= 3 && ballRate >= 0.65;

    // Consistent opener — first pitch of last 3 ABs
    // Find first pitch of each at-bat by detecting count resets
    const firstPitches = real.filter((p, i) => {
      if (i === 0) return true;
      const prev = real[i - 1];
      return prev.batOrder !== p.batOrder ||
             (p.balls === 0 && p.strikes === 0 && prev.balls !== 0 || prev.strikes !== 0);
    });
    const recentOpeners = firstPitches.slice(-3);
    const isConsistentOpener = recentOpeners.length >= 3 &&
      recentOpeners.filter(p => p.type === type).length >= 3;

    // Attack pitch — pitcher throws this in fastball counts (0-0, 1-0, 2-0, 3-0, 3-1)
    // meaning they fully trust it, not just using it as a survival pitch
    // 2+ times in fastball counts = confident enough to attack with it
    const FASTBALL_COUNTS = new Set(["0-0","1-0","2-0","3-0","3-1"]);
    const inFastballCounts = thrown.filter(p => FASTBALL_COUNTS.has(`${p.balls}-${p.strikes}`)).length;
    const isAttackPitch = inFastballCounts >= 2 && !isFastball(type, pitchTypes);

    profile[type] = {
      total, strikeRate, whiffRate, ballRate, weakContactRate, gbRate,
      isOpener, isEmerging, isShelved, isConsistentOpener,
      isAttackPitch,
      // Role flags
      isGoToStrike:   strikeRate >= 0.65 && total >= 4,
      isPutAway:      whiffRate  >= 0.40 && total >= 4,
      isGroundBaller: gbRate     >= 0.40 && total >= 4,
    };
  });

  return profile;
}

// ── GB/FB PROFILE ──────────────────────────────────────────────────────────
// ── QAB DETECTION ────────────────────────────────────────────────────────────
// Returns true if a pitch sequence (the AB ending on this pitch) counts as a QAB
// Auto-detected criteria:
//   Hit, ROE, Walk (balls===3 + result ball), HBP
//   6+ pitch AB
//   4+ pitches after 2 strikes
// Coach-tagged criteria (stored on pitch.atBatTags):
//   hardHit, sacFly, sacBunt, advRunner, rbi
function isQAB(pitch, abPitches) {
  const res = pitch.result;
  const tags = pitch.atBatTags || {};
  // Auto: hit, roe, hbp
  if (res === "hit" || res === "roe" || res === "hbp") return true;
  // Auto: walk
  if (res === "ball" && pitch.balls === 3) return true;
  // Auto: 6+ pitch AB
  if (abPitches.length >= 6) return true;
  // Auto: 4 pitches after reaching 2 strikes
  const twoStrikeIdx = abPitches.findIndex(p => p.strikes === 2);
  if (twoStrikeIdx >= 0 && abPitches.length - twoStrikeIdx >= 4) return true;
  // Coach-tagged
  if (tags.qab || tags.hardHit || tags.sacFly || tags.sacBunt || tags.advRunner || tags.rbi) return true;
  return false;
}

// Group pitches into at-bats by batOrder slot and game
// Returns array of { name, slot, gameId, pitches, lastPitch, isQAB, isHardHit }
function buildAtBats(games, opts = {}) {
  const includeUnnamed = opts.includeUnnamed || false;
  const abs = [];
  games.forEach(g => {
    if (!g.pitches || !g.pitches.length) return;
    const lineup = g.lineup || [];
    const nameMap = {};
    lineup.forEach(s => { if (s.name && s.name.trim()) nameMap[s.slot] = s.name.trim(); });
    let curAB = null;
    const FINAL = new Set(["hit","roe","hbp","K","Kc","go","fo","po","lo","gdp","out","ball","fc"]);
    const isFinalResult = (p) => FINAL.has(p.result) && !(p.result === "ball" && p.balls < 3) && !((p.result === "K" || p.result === "Kc") && p.strikes < 2);

    g.pitches.forEach(p => {
      if (EVENTS.has(p.type)) return;
      const name = p.hitter || nameMap[p.batOrder] || null;
      if (!name && !includeUnnamed) return;
      // Start new AB if: no current AB, batter changed, inning changed, OR previous AB already ended
      const abEnded = curAB && curAB.lastPitch;
      if (!curAB || curAB.slot !== p.batOrder || curAB.gameId !== g.id || curAB.inning !== p.inning || abEnded) {
        if (curAB && curAB.pitches.length > 0) abs.push(curAB);
        curAB = { name, slot: p.batOrder, gameId: g.id, gameDate: g.date, opponent: g.opponent, pitcherHand: null, pitches: [], inning: p.inning };
      }
      curAB.pitches.push(p);
      curAB.pitcherHand = p.pitcherHand || g.pitcherHand || "R";
      curAB.batSide = p.batSide || "R";
      if (isFinalResult(p)) curAB.lastPitch = p;
    });
    if (curAB && curAB.pitches.length > 0) abs.push(curAB);
  });
  return abs.filter(ab => ab.lastPitch).map(ab => ({
    ...ab,
    isQAB: isQAB(ab.lastPitch, ab.pitches),
    isHardHit: !!(ab.lastPitch.atBatTags && ab.lastPitch.atBatTags.hardHit),
  }));
}

function buildGBFBProfile(real) {
  // Lineouts excluded — hard contact that could go either way
  // Only groundouts/GDP vs flyouts/popouts count
  const gbOuts = real.filter(p => ["go", "gdp"].includes(p.result)).length;
  const fbOuts = real.filter(p => ["fo", "po"].includes(p.result)).length;
  const total  = gbOuts + fbOuts;
  if (total < 5) return "neutral"; // need 5+ contact outs for meaningful label
  const gbRate = gbOuts / total;
  if (gbRate >= 0.70) return "groundball";
  if (gbRate <= 0.30) return "flyball";
  return "neutral";
}

// ── RECENCY CHECK — graduated curve, split by batter ──────────────────────
// After 2 same pitch to same batter: slight reduction
// After 3 same pitch to same batter: larger reduction
// After 4+ same pitch to same batter: bounces back (he's very confident)
// Across different batters: not a streak, no penalty
function getRecencyMultiplier(real, type, currentBatOrder) {
  // Get recent pitches to this specific batter only — consecutive rule is per batter
  const toBatter = real.filter(p => p.batOrder === currentBatOrder).slice(-6);
  if (toBatter.length < 2) return 1.0;

  // Count consecutive same pitch at end of this batter's sequence
  let streak = 0;
  for (let i = toBatter.length - 1; i >= 0; i--) {
    if (toBatter[i].type === type) streak++;
    else break;
  }

  let mult = 1.0;
  if (streak === 1) mult = 0.90;        // 1 in a row — light nudge away
  else if (streak === 2) mult = 0.50;   // 2 in a row — strong push away from this pitch
  else if (streak === 3) mult = 0.35;   // 3 in a row — very strong push away
  else if (streak >= 4) mult = 1.10;    // 4+ in a row — pitcher is leaning on it hard

  // Foul ball recency — consecutive fouls on same pitch nudge model away
  const recentAll = real.slice(-8);
  let consecutiveFouls = 0;
  for (let i = recentAll.length - 1; i >= 0; i--) {
    if (recentAll[i].type === type && recentAll[i].result === "foul") consecutiveFouls++;
    else break;
  }
  if (consecutiveFouls === 2) mult *= 0.85;
  if (consecutiveFouls >= 3) mult *= 0.70;

  return mult;
}

// ── SITUATION MULTIPLIERS ──────────────────────────────────────────────────
function getSituationMultipliers(state, pitchTypes) {
  const { balls, strikes, outs, runners, batOrder, inning, pitchCount } = state;
  const ck = balls + "-" + strikes;
  const hasR = runners && (runners.first || runners.second || runners.third);
  const r = runners || {};

  // Default multipliers by family
  const mult = { fastball: 1.0, breaking: 1.0, offspeed: 1.0 };

  // ── BASES LOADED ──
  if (r.first && r.second && r.third) {
    mult.fastball += 0.30; mult.breaking -= 0.20; mult.offspeed -= 0.20;
  }
  // ── RUNNER ON 3B < 2 OUTS ──
  else if (r.third && outs < 2) {
    mult.fastball += 0.20; mult.breaking -= 0.10; mult.offspeed -= 0.10;
  }
  // ── RUNNER ON 2B — AVOID DIRT ──
  else if (r.second && !r.third) {
    mult.fastball += 0.15; mult.breaking -= 0.10;
  }
  // ── RUNNER ON 1B — POSSIBLE DP ──
  else if (r.first && !r.second && !r.third) {
    mult.fastball += 0.05;
  }

  // ── 1B + 2B, 1 OUT — DP SITUATION ──
  if (r.first && r.second && outs === 1) {
    mult.fastball += 0.15; mult.breaking += 0.05;
  }

  // ── 2 OUTS — ATTACK ──
  if (outs === 2) {
    mult.fastball += 0.10;
  }

  // ── HITTER'S COUNT — NEED A STRIKE ──
  if (HITTER_COUNTS.has(ck)) {
    mult.fastball += 0.20; mult.breaking -= 0.10; mult.offspeed -= 0.10;
  }

  // ── 3-0 — ALMOST ALWAYS FB BELOW THE MAJORS ──
  if (ck === "3-0") {
    mult.fastball += 0.40; mult.breaking -= 0.25; mult.offspeed -= 0.25;
  }

  // ── PITCHER'S COUNT / TWO STRIKE — PUT-AWAY ──
  if (TWO_STRIKE.has(ck)) {
    mult.breaking += 0.15; mult.offspeed += 0.15; mult.fastball -= 0.10;
  }

  // ── 0-2 — TRUE WASTE / EXPAND (on top of two-strike lean) ──
  if (ck === "0-2") {
    mult.breaking += 0.10; mult.offspeed += 0.10; mult.fastball -= 0.10;
  }

  // ── 3-2 FULL COUNT — cancels the generic two-strike breaking lean and
  //    reverts toward the fastball / competing in the zone; runners going
  //    (forced to move) pushes fastball further up ──
  if (ck === "3-2") {
    mult.fastball += 0.20; mult.breaking -= 0.15; mult.offspeed -= 0.15;
    if (hasR) mult.fastball += 0.10;
  }

  // ── FIRST INNING — ESTABLISH FASTBALL ──
  if (inning === 1) {
    mult.fastball += 0.10;
  }

  // ── ORDER POSITION — challenge the bottom (8-9 / pitcher),
  //    nibble the heart of the order (3-5) ──
  if (batOrder >= 8) {
    mult.fastball += 0.12;
  } else if (batOrder >= 3 && batOrder <= 5) {
    mult.fastball -= 0.05; mult.breaking += 0.05; mult.offspeed += 0.05;
  }

  // ── BUNT ANTICIPATION — sac-bunt look: runner on (not 3B-only), under two
  //    outs, likely bunter at the bottom of the order. Expect a bunt, throw a
  //    strike they cannot drop. Conservative without a score field. ──
  const buntLikely = r.first && !r.third && outs < 2 && batOrder >= 8;
  if (buntLikely) {
    mult.fastball += 0.15;
  }

  // ── HIGH PITCH COUNT FATIGUE (velocity intentionally not used) ──
  if (pitchCount >= 100) {
    mult.fastball += 0.15; mult.breaking -= 0.10; mult.offspeed -= 0.10;
  } else if (pitchCount >= 80) {
    mult.breaking -= 0.05; mult.offspeed -= 0.05;
  }

  return mult;
}

// ── MAIN PREDICT FUNCTION ─────────────────────────────────────────────────
// ── SEQUENCE MATRIX (within at-bat) ────────────────────────────────────────
// Walks the RAW pitch list and tallies pitch-to-pitch transitions WITHIN an
// at-bat: "after pitch X (with result R), what came next?". Unknown ("?")
// pitches and events (pickoffs, SB/CS/WP/PB, IBB) BREAK the chain, so a
// transition is never recorded across a pitch we could not read. A change of
// batter also breaks the chain — transitions are within a single at-bat only.
function buildSequenceMatrix(pitches) {
  const byType = {};        // prevType -> { curType: n, _total }
  const byTypeResult = {};  // prevType -> prevResult -> { curType: n, _total }
  const byTypeLocResult = {}; // prevType -> prevLocBucket -> prevResult -> { curType: n, _total }
  let prev = null;
  for (let i = 0; i < pitches.length; i++) {
    const p = pitches[i];
    if (EVENTS.has(p.type) || p.type === "UNK" || p.result === "ibb") { prev = null; continue; }
    if (prev && prev.batOrder !== p.batOrder) prev = null;
    if (prev) {
      const pt = prev.type, ct = p.type, pr = prev.result;
      if (!byType[pt]) byType[pt] = { _total: 0 };
      byType[pt][ct] = (byType[pt][ct] || 0) + 1;
      byType[pt]._total += 1;
      if (!byTypeResult[pt]) byTypeResult[pt] = {};
      if (!byTypeResult[pt][pr]) byTypeResult[pt][pr] = { _total: 0 };
      byTypeResult[pt][pr][ct] = (byTypeResult[pt][pr][ct] || 0) + 1;
      byTypeResult[pt][pr]._total += 1;
      const pb = locBucket(prev.location, prev.batSide);
      if (pb) {
        if (!byTypeLocResult[pt]) byTypeLocResult[pt] = {};
        if (!byTypeLocResult[pt][pb]) byTypeLocResult[pt][pb] = {};
        if (!byTypeLocResult[pt][pb][pr]) byTypeLocResult[pt][pb][pr] = { _total: 0 };
        byTypeLocResult[pt][pb][pr][ct] = (byTypeLocResult[pt][pb][pr][ct] || 0) + 1;
        byTypeLocResult[pt][pb][pr]._total += 1;
      }
    }
    prev = p;
  }
  return { byType, byTypeResult, byTypeLocResult };
}

// ── CURRENT AT-BAT PITCHES ─────────────────────────────────────────────────
// Known pitches thrown so far in the current at-bat (trailing run of the same
// batter). Events / unknowns are skipped but do not end the at-bat.
function currentABPitches(pitches, batOrder) {
  const out = [];
  for (let i = pitches.length - 1; i >= 0; i--) {
    const p = pitches[i];
    if (p.batOrder !== batOrder) break;
    if (EVENTS.has(p.type) || p.type === "UNK") continue;
    out.unshift(p);
  }
  return out;
}

function predict(pitches, state, pitchTypes, primerPitches = []) {
  const { balls, strikes, outs, runners, batOrder, timesThrough, batSide, inning } = state;
  const ck = balls + "-" + strikes;
  const hasR = runners && (runners.first || runners.second || runners.third);

  // Filter to real pitches only — exclude events, IBB, and unknown ("?") types
  const real = pitches.filter(p => !EVENTS.has(p.type) && p.result !== "ibb" && p.type !== "UNK");
  if (real.length < 1) return null;

  const pitchCount = real.length;

  const profile = buildPitcherProfile(real, pitchTypes);
  const gbfbProfile = buildGBFBProfile(real);

  // All pitches in this exact count
  const inCount    = real.filter(p => (p.balls + "-" + p.strikes) === ck);
  const countTotal = inCount.length;

  const countFreq = {};
  inCount.forEach(p => { countFreq[p.type] = (countFreq[p.type] || 0) + 1; });

  const overallFreq = {};
  real.forEach(p => { overallFreq[p.type] = (overallFreq[p.type] || 0) + 1; });

  // ── BATTER HANDEDNESS SPLIT ─────────────────────────────────────────────
  const MIN_HAND_SAMPLE = 4;
  const sideReal   = batSide ? real.filter(p => p.batSide === batSide) : [];
  const sideCount  = batSide ? sideReal.filter(p => (p.balls + "-" + p.strikes) === ck) : [];
  const sideTotal  = sideReal.length;
  const sideCountTotal = sideCount.length;
  const hasSideSample  = sideTotal >= MIN_HAND_SAMPLE;

  const sideCountFreq = {};
  sideCount.forEach(p => { sideCountFreq[p.type] = (sideCountFreq[p.type] || 0) + 1; });

  const getBlendedCountObs = (type) => {
    if (!hasSideSample || sideCountTotal < 2) {
      return { obs: countFreq[type] || 0, total: countTotal };
    }
    const sideObs    = sideCountFreq[type] || 0;
    const overallObs = countFreq[type]     || 0;
    const blended = (sideTotal >= MIN_HAND_SAMPLE * 2)
      ? (sideObs / Math.max(sideCountTotal, 1)) * 0.60 + (overallObs / Math.max(countTotal, 1)) * 0.40
      : (sideObs / Math.max(sideCountTotal, 1)) * 0.40 + (overallObs / Math.max(countTotal, 1)) * 0.60;
    return { obs: blended * 100, total: 100 };
  };

  // ── SEQUENCING (within at-bat) ──────────────────────────────────────────
  // "After the pitch he just threw (and what happened to it), what comes next?"
  // Built from the RAW pitch list so unknown pitches and events break the chain.
  const SEQ_MIN = 4;
  const seqMatrix = buildSequenceMatrix(pitches);
  // Previous pitch THIS at-bat: the most recent pitch, same batter, known type,
  // and only if we are not on the first pitch of the at-bat (0-0).
  const lastPitch = pitches.length ? pitches[pitches.length - 1] : null;
  const seqHasPrev = !!(lastPitch && !EVENTS.has(lastPitch.type) && lastPitch.type !== "UNK"
    && lastPitch.result !== "ibb" && lastPitch.batOrder === batOrder && !(balls === 0 && strikes === 0));
  const prevType   = seqHasPrev ? lastPitch.type   : null;
  const prevResult = seqHasPrev ? lastPitch.result : null;
  // Use the richest distribution that clears the sample gate: prev type+result, then prev type.
  const prevLoc = seqHasPrev ? locBucket(lastPitch.location, lastPitch.batSide) : null;
  let seqDist = null, seqTotal = 0, locSeqActive = false;
  if (prevType) {
    const lr = prevLoc && seqMatrix.byTypeLocResult[prevType] && seqMatrix.byTypeLocResult[prevType][prevLoc] && seqMatrix.byTypeLocResult[prevType][prevLoc][prevResult];
    if (lr && lr._total >= SEQ_MIN) { seqDist = lr; seqTotal = lr._total; locSeqActive = true; }
    else {
      const tr = seqMatrix.byTypeResult[prevType] && seqMatrix.byTypeResult[prevType][prevResult];
      if (tr && tr._total >= SEQ_MIN) { seqDist = tr; seqTotal = tr._total; }
      else {
        const t = seqMatrix.byType[prevType];
        if (t && t._total >= SEQ_MIN) { seqDist = t; seqTotal = t._total; }
      }
    }
  }
  const seqActive = seqDist !== null;
  // Eye-level read: prior pitch an UP fastball taken for a ball -> lean to something down. Gated on the prior pitch having a location, so a skipped zone just turns this off.
  const eyeLevelUp = !!(seqHasPrev && !locSeqActive && lastPitch.location && LOC_TIER[lastPitch.location] === "up" && isFastball(prevType, pitchTypes) && prevResult === "ball");
  // Tier 2 effectiveness: this pitcher's average whiff rate across well-sampled pitch types
  const effTypes = Object.keys(profile).filter(t => profile[t].total >= 4);
  const avgWhiff = effTypes.length ? effTypes.reduce((s, t) => s + profile[t].whiffRate, 0) / effTypes.length : 0;

  // ── WITHIN-AB COMMAND READ ──────────────────────────────────────────────
  const currentAB = currentABPitches(pitches, batOrder);

  // ── CROSS-AB BATTER MEMORY ──────────────────────────────────────────────
  // What happened the last time(s) this pitcher faced this hitter (earlier ABs).
  const currentABIds = new Set(currentAB.map(p => p.id));
  const priorVsBatter = real.filter(p => p.batOrder === batOrder && !currentABIds.has(p.id));
  const burnedTypes = {};   // type -> worst damage (2 = extra-base hit, 4 = HR)
  const dominantTypes = {}; // type -> got this hitter out with it
  priorVsBatter.forEach(p => {
    if (p.result === "hit") {
      const bases = p.hitBases || 1;
      if (bases >= 2) burnedTypes[p.type] = Math.max(burnedTypes[p.type] || 0, bases);
    }
    if (p.result === "K" || p.result === "Kc" || ["go", "po", "fo", "gdp"].indexOf(p.result) !== -1) {
      dominantTypes[p.type] = true;
    }
  });

  // Determine phase — primer boosts starting phase
  const hasPrimer = primerPitches && primerPitches.length > 0;
  const phase = hasPrimer
    ? (pitchCount <= 5 ? 2 : pitchCount <= 15 ? 3 : 4)
    : (pitchCount <= 5 ? 1 : pitchCount <= 15 ? 2 : pitchCount <= 30 ? 3 : 4);
  const confidenceLabel = phase === 1 ? "Early Read" : phase === 2 ? "Building" : phase === 3 ? "Established" : "Confirmed";
  const primerLabel = hasPrimer ? " · " + primerPitches.length + "p history" : "";

  const seenTypes = [...new Set([...pitchTypes.map(p => p.key), ...real.map(p => p.type)])];

  const scores = {};
  seenTypes.forEach(type => {
    const blended      = getBlendedCountObs(type);
    const countObs     = blended.obs;
    const blendTotal   = blended.total;
    const overallObs   = overallFreq[type] || 0;
    const overallTotal = real.length;

    // Sequence share for this candidate (same previous-pitch distribution for all candidates)
    const seqShare = (seqActive && seqTotal > 0) ? ((seqDist[type] || 0) / seqTotal) : 0;

    let score = 0;

    if (phase === 1) {
      if (profile && profile[type] && profile[type].isOpener) score += 30;
      if (overallTotal > 0) score += (overallObs / overallTotal) * 50;
      if (hasPrimer && primerPitches.length > 0) {
        const primerObs = primerPitches.filter(p => p.type === type).length;
        score += (primerObs / primerPitches.length) * 40;
      }
    } else if (phase === 2) {
      const countWeight   = hasPrimer ? 0.35 : 0.40;
      const overallWeight = hasPrimer ? 0.25 : 0.35;
      const profileWeight = 0.20;
      const primerWeight  = hasPrimer ? 0.20 : 0;
      if (blendTotal > 0) score += (countObs / blendTotal) * 100 * countWeight;
      if (overallTotal > 0) score += (overallObs / overallTotal) * 100 * (overallWeight + (hasPrimer ? 0 : 0.15));
      if (profile && profile[type]) {
        const p = profile[type];
        if (TWO_STRIKE.has(ck) && p.isPutAway) score += 25 * profileWeight;
        if (HITTER_COUNTS.has(ck) && p.isGoToStrike) score += 25 * profileWeight;
        if (p.isConsistentOpener && ck === "0-0") score += 20 * profileWeight;
        if (p.isAttackPitch) score += 20 * profileWeight;
        if (p.isAttackPitch && TWO_STRIKE.has(ck)) score += 20 * profileWeight;
      }
      if (hasPrimer && primerPitches.length > 0) {
        const primerObs = primerPitches.filter(p => p.type === type).length;
        score += (primerObs / primerPitches.length) * 100 * primerWeight;
        const liveFirstPitches = real.filter(p => (p.balls + "-" + p.strikes) === "0-0").length;
        const skipPrimerCount = ck === "0-0" && liveFirstPitches >= 3;
        const primerInCount = primerPitches.filter(p => (p.balls + "-" + p.strikes) === ck);
        if (!skipPrimerCount && primerInCount.length >= 3) {
          const primerCountObs = primerInCount.filter(p => p.type === type).length;
          score += (primerCountObs / primerInCount.length) * 25;
        }
      }
    } else if (phase === 3) {
      // Count leads; sequencing joins as a weighted term once it clears its gate.
      // When sequencing is inactive its weight folds back into count (graceful).
      const countWeight   = seqActive ? 0.50 : 0.65;
      const overallWeight = seqActive ? 0.10 : 0.15;
      const profileWeight = 0.20;
      const seqWeight     = seqActive ? 0.20 : 0;
      if (blendTotal > 0) score += (countObs / blendTotal) * 100 * countWeight;
      if (overallTotal > 0) score += (overallObs / overallTotal) * 100 * overallWeight;
      if (seqActive) score += seqShare * 100 * seqWeight;
      if (profile && profile[type]) {
        const p = profile[type];
        if (TWO_STRIKE.has(ck) && p.isPutAway) score += 20 * profileWeight;
        if (HITTER_COUNTS.has(ck) && p.isGoToStrike) score += 20 * profileWeight;
        if (p.isAttackPitch) score += 20 * profileWeight;
        if (p.isAttackPitch && TWO_STRIKE.has(ck)) score += 25 * profileWeight;
      }
      if (hasPrimer && primerPitches.length > 0) {
        const primerInCount = primerPitches.filter(p => (p.balls + "-" + p.strikes) === ck);
        if (primerInCount.length >= 4) {
          const primerCountObs = primerInCount.filter(p => p.type === type).length;
          score += (primerCountObs / primerInCount.length) * 10;
        }
      }
    } else {
      // Phase 4 — most informed. Count leads, sequencing + all profile intelligence active.
      const countWeight   = seqActive ? 0.55 : 0.70;
      const overallWeight = seqActive ? 0.05 : 0.10;
      const profileWeight = 0.20;
      const seqWeight     = seqActive ? 0.20 : 0;
      if (blendTotal > 0) score += (countObs / blendTotal) * 100 * countWeight;
      if (overallTotal > 0) score += (overallObs / overallTotal) * 100 * overallWeight;
      if (seqActive) score += seqShare * 100 * seqWeight;
      if (profile && profile[type]) {
        const p = profile[type];
        if (TWO_STRIKE.has(ck) && p.isPutAway) score += 20 * profileWeight;
        if (HITTER_COUNTS.has(ck) && p.isGoToStrike) score += 20 * profileWeight;
        if (p.isAttackPitch) score += 20 * profileWeight;
        if (p.isAttackPitch && TWO_STRIKE.has(ck)) score += 25 * profileWeight;
        if (p.isConsistentOpener && ck === "0-0") score += 15 * profileWeight;
      }
      if (hasSideSample && sideCountTotal >= 2) {
        const sideObs = sideCountFreq[type] || 0;
        score += (sideObs / sideCountTotal) * 15;
      }
    }

    // ── WITHIN-AB COMMAND DECAY ──
    // He has shown this pitch THIS at-bat but is missing with it (balls): fade
    // it now. A trusted curve thrown two straight for balls is unlikely next.
    const abOfType = currentAB.filter(p => p.type === type);
    if (abOfType.length >= 2) {
      const abBalls = abOfType.filter(p => inferBallStrike(p) === "ball").length;
      const abBallRate = abBalls / abOfType.length;
      if (abBallRate >= 0.66) score *= 0.45;
      else if (abBallRate >= 0.50) score *= 0.65;
    }

    // ── CROSS-AB BATTER MEMORY ──
    // Burned by this type last time (extra bases / HR) -> fade it.
    // Got this hitter out with this type -> lean back on it.
    if (burnedTypes[type]) score *= (burnedTypes[type] >= 4 ? 0.50 : 0.65);
    if (dominantTypes[type]) score *= 1.25;

    // Shelving suppression — graduated by ball-rate severity (game-level)
    if (profile && profile[type] && profile[type].isShelved) {
      const br = profile[type].ballRate;
      const m = br >= 0.85 ? 0.10 : br >= 0.75 ? 0.15 : 0.25;
      score *= m;
    }

    // Emerging pitch boost
    if (profile && profile[type] && profile[type].isEmerging) score *= 1.40;

    // Recency — softened once sequencing is live, to avoid double-counting the
    // hard-coded "don't repeat" prior that the sequence data now models.
    let recency = getRecencyMultiplier(real, type, batOrder);
    if (phase >= 3 && seqActive) recency = 1 + (recency - 1) * 0.5;
    score *= recency;

    // Eye-level: after an up fastball for a ball, favor something down
    if (eyeLevelUp) {
      const efam = getPitchFamily(type, pitchTypes);
      if (efam === "breaking" || efam === "offspeed") score *= 1.25;
      else if (efam === "fastball") score *= 0.90;
    }

    // Tier 2: lean toward pitches missing bats above this pitcher's norm
    if (profile && profile[type] && profile[type].total >= 4 && avgWhiff > 0) {
      const dw = profile[type].whiffRate - avgWhiff;
      if (dw > 0) score *= 1 + Math.min(dw * 0.8, 0.20);
    }

    // GB/FB profile modifier
    if (gbfbProfile === "groundball") {
      if (isFastball(type, pitchTypes)) score *= 1.10;
      if (isBreaking(type, pitchTypes)) score *= 1.05;
    } else if (gbfbProfile === "flyball") {
      if (isFastball(type, pitchTypes)) score *= 1.05;
      if (isBreaking(type, pitchTypes)) score *= 1.10;
    }

    scores[type] = Math.max(score, 0);
  });

  // Score leverage — neutral at a 0 margin, so an untouched scoreboard has no effect.
  // margin = pitcher's team lead (scoreOpp - scoreUs), passed in via state.
  const margin = state.scoreMargin || 0;
  const scoreMult = { fastball: 1, breaking: 1, offspeed: 1, unknown: 1 };
  if (margin >= 4) { const k = Math.min((margin - 3) * 0.03, 0.15); scoreMult.fastball = 1 + k; scoreMult.breaking = 1 - k * 0.6; scoreMult.offspeed = 1 - k * 0.6; }
  else if (margin <= -3) { const k = Math.min((Math.abs(margin) - 2) * 0.03, 0.12); scoreMult.fastball = 1 - k * 0.5; scoreMult.breaking = 1 + k; scoreMult.offspeed = 1 + k; }

  // Situation multipliers (base/out, count splits, order position, bunt, fatigue)
  const sitMult = getSituationMultipliers({ ...state, pitchCount }, pitchTypes);
  Object.keys(scores).forEach(type => {
    const family = getPitchFamily(type, pitchTypes);
    const m = sitMult[family] || 1.0;
    scores[type] = scores[type] * m * (scoreMult[family] || 1);
  });

  // ── 3-0 HARD OVERRIDE — must throw a strike; below the majors that is a FB ──
  if (ck === "3-0") {
    const fbTypes = Object.keys(scores).filter(t => isFastball(t, pitchTypes));
    if (fbTypes.length > 0) {
      const maxNonFB = Math.max(...Object.entries(scores)
        .filter(([t]) => !isFastball(t, pitchTypes))
        .map(([, v]) => v), 0);
      fbTypes.forEach(t => { scores[t] = Math.max(scores[t], maxNonFB * 2.5, 80); });
      Object.keys(scores).forEach(t => { if (!isFastball(t, pitchTypes)) scores[t] *= 0.15; });
    }
  }

  // Normalize to percentages
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const predictions = Object.entries(scores)
    .filter(([, v]) => v > 0)
    .map(([type, v]) => ({ type, pct: Math.min(Math.round((v / total) * 100), 90), count: countFreq[type] || 0 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  const distribution = countTotal > 0
    ? Object.entries(countFreq)
        .map(([type, count]) => ({ type, count, pct: Math.round((count / countTotal) * 100) }))
        .sort((a, b) => b.pct - a.pct)
    : [];

  const hasRecommendation = predictions.length > 0 && (phase >= 2 || pitchCount >= 3);

  // Build contextual tip
  const tip = buildTip(real, state, pitchTypes, profile, gbfbProfile);

  return {
    predictions,
    distribution,
    countTotal,
    hasRecommendation,
    phase,
    confidenceLabel: confidenceLabel + primerLabel,
    primerActive: hasPrimer,
    tip,
    seqContext: (phase >= 3 && seqActive) ? { prevType, prevResult, n: seqTotal } : null,
  };
}

// ── CONTEXTUAL TIP ─────────────────────────────────────────────────────────
function buildTip(real, state, pitchTypes, profile, gbfbProfile) {
  const { balls, strikes, outs, runners, batOrder, timesThrough, inning } = state;
  const ck = `${balls}-${strikes}`;
  const tips = [];

  const tipsEstablished = real.length >= 20;
  const tipsDataReady   = real.length >= 25;

  // P1 — Two-strike tips — only when strikes === 2
  if (strikes === 2 && tipsEstablished) {
    const twoStrike = real.filter(p => p.strikes === 2);

    // Dirt ball — 70%+ of 2-strike pitches in the dirt
    if (twoStrike.length >= 4) {
      const dirtPct = Math.round((twoStrike.filter(p => p.location === "dirt").length / twoStrike.length) * 100);
      if (dirtPct >= 70) tips.push(`${dirtPct}% of his 2-strike pitches are in the dirt`);
    }

    // Two-strike cover — one pitch 80%+ with 5+ observations
    if (tips.length === 0 && twoStrike.length >= 5) {
      const freq = {};
      twoStrike.forEach(p => { freq[p.type] = (freq[p.type] || 0) + 1; });
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
      const pct = Math.round((top[1] / twoStrike.length) * 100);
      if (pct >= 80) tips.push(`${top[0]} ${pct}% with 2 strikes`);
    }

    // Put-away pitch — 60%+ whiff rate with 3+ Ks on that pitch
    if (tips.length === 0 && profile && tipsDataReady) {
      const putAway = Object.entries(profile)
        .map(([type, v]) => {
          const kCount = real.filter(p => p.type === type && ["K","Kc"].includes(p.result) && p.strikes === 2).length;
          return { type, v, kCount };
        })
        .filter(({ v, kCount }) => v.whiffRate >= 0.60 && kCount >= 3)
        .sort((a, b) => b.v.whiffRate - a.v.whiffRate)[0];
      if (putAway) tips.push(`${putAway.type} is his put-away pitch today`);
    }
  }

  // P2 — Command quality — count-specific only
  if (tips.length === 0 && profile && tipsDataReady) {
    const MIN_OBS = 4;
    const POOR_COMMAND = 0.60;
    const inThisCount = real.filter(p => `${p.balls}-${p.strikes}` === ck);
    if (inThisCount.length >= MIN_OBS) {
      const countFreq = {};
      inThisCount.forEach(p => { countFreq[p.type] = (countFreq[p.type] || 0) + 1; });
      Object.entries(countFreq).forEach(([type, cnt]) => {
        const usagePct = Math.round((cnt / inThisCount.length) * 100);
        const ballsWithType = inThisCount.filter(p => p.type === type && inferBallStrike(p) === "ball").length;
        const ballPct = cnt >= MIN_OBS ? ballsWithType / cnt : 0;
        if (usagePct >= 40 && ballPct >= POOR_COMMAND) {
          tips.push(`${type} ${usagePct}% on ${ck} — ${ballsWithType} of ${cnt} are balls`);
        }
      });
    }

    // Emerging pitch — introduced to 3+ distinct hitters
    if (tips.length === 0) {
      const emerging = Object.entries(profile).filter(([type, v]) => {
        if (!v.isEmerging) return false;
        const distinctHitters = new Set(real.filter(p => p.type === type).map(p => p.batOrder)).size;
        return distinctHitters >= 3;
      });
      if (emerging.length > 0) tips.push(`Watch for ${emerging[0][0]} — new pitch he's introduced today`);
    }
  }

  // P3 — HIGH LEVERAGE TIPS REMOVED

  // P4 — Count tip — 2-1 removed, 75% threshold, 6 observations
  if (tips.length === 0 && tipsEstablished) {
    const TIGHT_HITTER_COUNTS = new Set(["2-0", "3-0", "3-1"]);
    if (TIGHT_HITTER_COUNTS.has(ck)) {
      const behind = real.filter(p => TIGHT_HITTER_COUNTS.has(`${p.balls}-${p.strikes}`));
      if (behind.length >= 6) {
        const freq = {};
        behind.forEach(p => { freq[p.type] = (freq[p.type] || 0) + 1; });
        const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
        const pct = Math.round((top[1] / behind.length) * 100);
        if (pct >= 75) tips.push(`${top[0]} ${pct}% in hitter's counts`);
      }
    }
    if (tips.length === 0 && ck === "0-0") {
      const fp = real.filter(p => p.balls === 0 && p.strikes === 0);
      if (fp.length >= 4) {
        const freq = {};
        fp.forEach(p => { freq[p.type] = (freq[p.type] || 0) + 1; });
        const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
        const pct = Math.round((top[1] / fp.length) * 100);
        if (pct >= 60) tips.push(`First pitch ${top[0]} ${pct}%`);
      }
    }
  }

  // P5 — Batter history — K or Kc at strikes === 2 only
  if (tips.length === 0 && tipsEstablished) {
    const toThisHitter = real.filter(p => p.batOrder === batOrder);
    if (toThisHitter.length >= 3 && timesThrough >= 2) {
      const WALK_RESULTS = new Set(["ball", "hbp"]);
      let lastKpitch = null;
      for (let i = toThisHitter.length - 1; i >= 0; i--) {
        const p = toThisHitter[i];
        if (["K", "Kc"].includes(p.result) && p.strikes === 2) { lastKpitch = p; break; }
        if (WALK_RESULTS.has(p.result) && p.balls === 3) break;
      }
      if (lastKpitch) tips.push(`Got him on ${lastKpitch.type} last time`);
    }
  }

  // P6 — TTO shift — 3.0x with 5+ late observations
  if (tips.length === 0 && tipsDataReady) {
    const ordName = (c) => c === 2 ? "2nd" : c === 3 ? "3rd" : c + "th";
    // Per-cycle pitch-type rates for the current pitcher
    const cycles = [...new Set(real.map(p => p.timesThrough || 1))].sort((a, b) => a - b);
    const cycleFreq = {}, cycleN = {};
    cycles.forEach(c => {
      const grp = real.filter(p => (p.timesThrough || 1) === c);
      cycleN[c] = grp.length;
      const f = {}; grp.forEach(p => { f[p.type] = (f[p.type] || 0) + 1; });
      cycleFreq[c] = f;
    });
    const rate = (c, type) => (cycleN[c] ? (cycleFreq[c][type] || 0) / cycleN[c] : 0);
    const ttoTips = [];

    // (A) USAGE UP vs 1st time through — a pitch he leans on more in a later cycle
    if ((cycleN[1] || 0) >= 5) {
      let best = null, bestRatio = 0;
      cycles.filter(c => c >= 2 && cycleN[c] >= 5).forEach(c => {
        Object.keys(cycleFreq[c]).forEach(type => {
          const t1 = rate(1, type), cr = rate(c, type);
          const ratio = cr / Math.max(t1, 0.03);
          if (ratio >= 3.0 && cycleFreq[c][type] >= 5 && ratio > bestRatio) {
            bestRatio = ratio; best = { type, c, t1Pct: Math.round(t1 * 100), cPct: Math.round(cr * 100) };
          }
        });
      });
      if (best) ttoTips.push(`${best.type} up ${ordName(best.c)} time through (${best.t1Pct}% → ${best.cPct}%)`);
    }

    // (B) SHELVED THEN BACK — a pitch he used early, dropped to ~none one cycle, then re-introduced.
    // Compares consecutive cycles so a returning pitch is caught even at low early volume.
    const allTypes = [...new Set(real.map(p => p.type).filter(t => !EVENTS.has(t) && t !== "UNK"))];
    let backTip = null;
    allTypes.forEach(type => {
      // find a cycle where it was an established pitch (>=15%), a later cycle where it nearly vanished (<5%),
      // then an even later cycle where it returned (>=12%).
      for (let i = 0; i < cycles.length - 1; i++) {
        const used = cycles[i];
        if (cycleN[used] < 4 || rate(used, type) < 0.15) continue;
        for (let j = i + 1; j < cycles.length; j++) {
          const gone = cycles[j];
          if (cycleN[gone] < 3 || rate(gone, type) >= 0.05) continue;
          for (let k = j + 1; k < cycles.length; k++) {
            const back = cycles[k];
            if (cycleN[back] < 3 || rate(back, type) < 0.12) continue;
            backTip = { type, gone, back };
            break;
          }
          if (backTip) break;
        }
        if (backTip) break;
      }
    });
    if (backTip) ttoTips.push(`${backTip.type} back ${ordName(backTip.back)} time through (shelved ${ordName(backTip.gone)})`);

    // Surface up to two TTO tips (usage-up + shelved-then-back can both be real and distinct)
    ttoTips.slice(0, 2).forEach(t => tips.push(t));
  }

  // P7 — GB/FB profile — lineouts excluded, 5+ contact outs, 70%+ threshold
  // P6b — Dirt spike by pitch type
  if (tips.length === 0 && tipsEstablished) {
    const dirtByType = {};
    real.forEach(p => { if (p.location === "dirt") dirtByType[p.type] = (dirtByType[p.type] || 0) + 1; });
    const spiked = Object.entries(dirtByType).sort((a, b) => b[1] - a[1])[0];
    if (spiked && spiked[1] >= 3) tips.push(`Look for the ${spiked[0]} in the dirt — he's spiked it ${spiked[1]}x`);
  }

  if (tips.length === 0 && tipsDataReady) {
    if (gbfbProfile === "groundball") tips.push("Groundball pitcher");
    else if (gbfbProfile === "flyball") tips.push("Flyball pitcher");
  }

  // P8 — Hard contact — pitch getting hit (4+ hits or lineouts)
  if (tips.length === 0 && tipsDataReady) {
    const hardContact = {};
    real.forEach(p => {
      if (p.result === "hit" || p.result === "lo") {
        hardContact[p.type] = (hardContact[p.type] || 0) + 1;
      }
    });
    const hardHit = Object.entries(hardContact)
      .filter(([, count]) => count >= 4)
      .sort((a, b) => b[1] - a[1])[0];
    if (hardHit) tips.push(`${hardHit[0]} is getting hit hard (${hardHit[1]})`);
  }

  return tips.length > 0 ? tips[0] : null;
}


/* --- ANALYSIS --- */
function analyze(pitches) {
  const real = pitches.filter(p => !EVENTS.has(p.type) && p.type !== "UNK");
  if (!real.length) return null;
  const total = real.length;
  const byType = {};
  real.forEach(p => { byType[p.type] = (byType[p.type] || 0) + 1; });
  const mix = Object.entries(byType)
    .map(([t, c]) => ({ type: t, count: c, pct: +((c / total) * 100).toFixed(1) }))
    .sort((a, b) => b.count - a.count);

  const grp = (fn) => {
    const f = real.filter(fn);
    const t = {};
    f.forEach(p => { t[p.type] = (t[p.type] || 0) + 1; });
    return { t, n: f.length };
  };

  const fp = grp(p => p.balls === 0 && p.strikes === 0);
  const ts = grp(p => p.strikes === 2);
  const bh = grp(p => (p.balls >= 2 && p.strikes === 0) || (p.balls === 3 && p.strikes <= 1));
  const vL = grp(p => p.batSide === "L");
  const vR = grp(p => p.batSide === "R");
  const ron = grp(p => p.runners && (p.runners.first || p.runners.second || p.runners.third));

  const tto = {};
  real.forEach(p => {
    if (p.timesThrough) {
      if (!tto[p.timesThrough]) tto[p.timesThrough] = {};
      tto[p.timesThrough][p.type] = (tto[p.timesThrough][p.type] || 0) + 1;
    }
  });

  const dirt = real.filter(p => p.location === "dirt");
  const velos = real.filter(p => p.velo).map(p => p.velo);
  const avgVelo = velos.length ? (velos.reduce((a, b) => a + b, 0) / velos.length).toFixed(1) : null;

  return { total, mix, fpT: fp.t, fpN: fp.n, tsT: ts.t, tsN: ts.n, bhT: bh.t, bhN: bh.n, vLT: vL.t, vLN: vL.n, vRT: vR.t, vRN: vR.n, ronT: ron.t, ronN: ron.n, tto, dirt, avgVelo };
}

/* --- BAR CHART --- */
function Bar({ data }) {
  const m = Math.max(...data.map(d => d.pct), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map(d => (
        <div key={d.type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 44, fontSize: 13, fontFamily: "'Azeret Mono',monospace", fontWeight: 800, color: gPC(d.type), textAlign: "right" }}>{d.type}</div>
          <div style={{ flex: 1, height: 24, background: G.sf2, borderRadius: 4, position: "relative", overflow: "hidden" }}>
            <div style={{ width: `${(d.pct / m) * 100}%`, height: "100%", background: `linear-gradient(90deg,${gPC(d.type)}cc,${gPC(d.type)}55)`, borderRadius: 4, transition: "width 0.5s" }} />
            <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: "#fff" }}>{d.pct}%</span>
          </div>
          <div style={{ width: 26, fontSize: 12, fontFamily: "'Azeret Mono',monospace", color: G.tx3, textAlign: "right", fontWeight: 700 }}>{d.count}</div>
        </div>
      ))}
    </div>
  );
}

/* --- ZONE WIDGET --- */
function BatterZone({ batSide, selected, onSelect }) {
  const isR = batSide === "R";
  const sz = 38;
  const bz = 24;
  return (
    <div>
      <div style={{ display: "inline-grid", gridTemplateColumns: `${bz}px repeat(3,${sz}px) ${bz}px`, gridTemplateRows: `${bz}px repeat(3,${sz}px) ${bz}px ${bz}px`, gap: 2 }}>
        {STRIKE_ZONES.map(z => {
          const lb = isR ? z.rL : z.lL;
          const sel = selected === z.k;
          return (
            <div key={z.k} onClick={() => onSelect(sel ? null : z.k)} style={{
              gridRow: z.r + 1, gridColumn: z.c + 1,
              background: sel ? G.gold : G.sf2, color: sel ? "#000" : G.tx2,
              borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 7, fontWeight: 800, cursor: "pointer", textTransform: "uppercase",
              border: `2px solid ${sel ? G.gold : G.bd}`,
              textAlign: "center", lineHeight: 1.2, padding: 2,
            }}>{lb}</div>
          );
        })}
        {BALL_ZONES.map(z => {
          const lb = isR ? z.rL : z.lL;
          const sel = selected === z.k;
          return (
            <div key={z.k} onClick={() => onSelect(sel ? null : z.k)} style={{
              gridRow: `${z.r + 1} / span ${z.rowSpan}`, gridColumn: `${z.c + 1} / span ${z.colSpan}`,
              background: sel ? G.gold : "#0d0d0d", color: sel ? "#000" : G.tx3,
              borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: z.k === "dirt" ? 9 : 7, fontWeight: 800, cursor: "pointer", textTransform: "uppercase",
              border: `1px dashed ${sel ? G.gold : G.bd2}`,
              textAlign: "center", lineHeight: 1.2, padding: 1,
            }}>{z.k === "dirt" ? "DIRT" : lb}</div>
          );
        })}
      </div>
      <div style={{ textAlign: "center", marginTop: 4, fontSize: 10, color: G.tx3, fontWeight: 700 }}>{isR ? "RHB" : "LHB"}</div>
    </div>
  );
}

/* --- BASE WIDGET --- */
function BaseW({ runners, onChange }) {
  const size = 52;
  const pos = { second: [0.5, 0.05], third: [0.05, 0.5], first: [0.95, 0.5] };
  const ds = size * 0.24;
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute" }}>
        <polygon points="50,8 92,50 50,92 8,50" fill="none" stroke={G.bd2} strokeWidth={3} />
      </svg>
      {["second", "third", "first"].map(b => {
        const [fx, fy] = pos[b];
        const on = runners && runners[b];
        return (
          <div key={b} onClick={() => onChange({ ...runners, [b]: !on })}
            style={{
              position: "absolute", left: `${fx * 100}%`, top: `${fy * 100}%`,
              transform: "translate(-50%,-50%) rotate(45deg)",
              width: ds, height: ds, borderRadius: 2, cursor: "pointer",
              background: on ? G.gold : "transparent",
              border: `3px solid ${on ? G.gold : G.bd2}`,
            }} />
        );
      })}
    </div>
  );
}

/* --- SCOUT NOTES --- */
function ScoutNotes({ t, pitches, name }) {
  const notes = [];
  const mk = (ty, tot) => {
    if (!tot) return null;
    const top = Object.entries(ty).sort((a, b) => b[1] - a[1])[0];
    return top ? { type: top[0], pct: ((top[1] / tot) * 100).toFixed(0) } : null;
  };
  if (t.mix[0]) notes.push(`Primary: ${t.mix[0].type} (${t.mix[0].pct}%).`);
  const fp = mk(t.fpT, t.fpN);
  if (fp && t.fpN >= 2) notes.push(`1st pitch: ${fp.type} ${fp.pct}%.`);
  const ts = mk(t.tsT, t.tsN);
  if (ts && t.tsN >= 2) notes.push(`2 strikes: ${ts.type} ${ts.pct}%.`);
  const bh = mk(t.bhT, t.bhN);
  if (bh && t.bhN >= 2) notes.push(`Behind: ${bh.type} ${bh.pct}%.`);
  if (t.vLN >= 3) { const l = mk(t.vLT, t.vLN); if (l) notes.push(`vs L: ${l.type} ${l.pct}%.`); }
  if (t.vRN >= 3) { const r = mk(t.vRT, t.vRN); if (r) notes.push(`vs R: ${r.type} ${r.pct}%.`); }
  const pk = pitches.filter(p => p.type === "PKO");
  if (pk.length) notes.push(`Pickoffs: ${pk.length}x.`);
  const wp = pitches.filter(p => p.type === "WP");
  if (wp.length) notes.push(`Wild pitches: ${wp.length}x. Run on dirt.`);
  const pb = pitches.filter(p => p.type === "PB");
  if (pb.length) notes.push(`Passed balls: ${pb.length}x.`);
  const sb = pitches.filter(p => p.type === "SB");
  if (sb.length) notes.push(`Stolen bases: ${sb.length}x. Vulnerable to run game.`);
  if (t.dirt.length >= 2) notes.push(`Dirt: ${t.dirt.length}x.`);

  // TTO shift notes — compare each cycle (1st, 2nd, 3rd...) SEPARATELY rather than lumping
  // "2+" together, which hid pitches that swung cycle-to-cycle (e.g. CB 55% -> 0% -> 100%).
  const ttoShifts = [];
  const ordName = (c) => c === 1 ? "1st" : c === 2 ? "2nd" : c === 3 ? "3rd" : c + "th";
  if (t.tto && t.tto[1]) {
    const cyc = [1, 2, 3, 4, 5].filter(n => t.tto[n] && Object.values(t.tto[n]).reduce((a, b) => a + b, 0) > 0);
    const tot = {}; cyc.forEach(c => { tot[c] = Object.values(t.tto[c]).reduce((a, b) => a + b, 0); });
    const rate = (c, type) => (tot[c] ? (t.tto[c][type] || 0) / tot[c] : 0);
    if (cyc.length >= 2 && tot[cyc[0]] >= 4) {
      const types = [...new Set(cyc.flatMap(c => Object.keys(t.tto[c])))];
      types.forEach(type => {
        // Build the per-cycle % path for this pitch across cycles with enough data (>=3 pitches)
        const path = cyc.filter(c => tot[c] >= 3).map(c => ({ c, pct: Math.round(rate(c, type) * 100), r: rate(c, type) }));
        if (path.length < 2) return;
        const first = path[0], last = path[path.length - 1];
        const maxR = Math.max(...path.map(p => p.r)), minR = Math.min(...path.map(p => p.r));
        // SHELVED-THEN-BACK: established (>=15%) somewhere, dropped to ~none (<5%) in a middle cycle, back (>=12%) after
        let shelved = null;
        for (let i = 0; i < path.length - 2; i++) {
          if (path[i].r >= 0.15) {
            for (let j = i + 1; j < path.length - 1; j++) {
              if (path[j].r < 0.05) {
                for (let k = j + 1; k < path.length; k++) {
                  if (path[k].r >= 0.12) { shelved = { gone: path[j].c, back: path[k].c }; break; }
                }
              }
              if (shelved) break;
            }
          }
          if (shelved) break;
        }
        if (shelved) {
          ttoShifts.push({ type, kind: "back", text: `back ${ordName(shelved.back)} time (shelved ${ordName(shelved.gone)})`, swing: maxR - minR });
        } else if (last.r - first.r >= 0.20) {
          ttoShifts.push({ type, kind: "up", text: `up ${first.pct}% → ${last.pct}% by ${ordName(last.c)} time`, swing: last.r - first.r });
        } else if (first.r - last.r >= 0.20) {
          ttoShifts.push({ type, kind: "down", text: `down ${first.pct}% → ${last.pct}% \u2014 shelving it late`, swing: first.r - last.r });
        }
      });
      ttoShifts.sort((a, b) => b.swing - a.swing);
    }
  }

  if (!notes.length && !ttoShifts.length) return <div style={{ fontSize: 12, color: G.tx3 }}>Charting more...</div>;
  return (
    <>
      {notes.map((n, i) => (
        <div key={i} style={{ fontSize: 13, color: G.tx2, lineHeight: 1.8, marginBottom: 4, paddingLeft: 10, borderLeft: "3px solid " + G.gold + "55" }}>{n}</div>
      ))}
      {ttoShifts.length > 0 && (
        <div style={{ marginTop: 10, padding: "8px 10px", background: "#0a0a00", borderRadius: 6, border: "1px solid " + G.gold + "44" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: G.gold, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>TTO Pattern Shift</div>
          {ttoShifts.slice(0, 3).map((sh, i) => {
            const col = sh.kind === "down" ? G.tx3 : G.gold;
            const arrow = sh.kind === "up" ? "↑" : sh.kind === "down" ? "↓" : "↻";
            return (
            <div key={i} style={{ fontSize: 12, color: col, marginBottom: 4, paddingLeft: 8, borderLeft: "3px solid " + (sh.kind === "down" ? G.bd2 : G.gold) }}>
              <span style={{ fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{sh.type}</span>
              {" " + arrow + " " + sh.text}
            </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* --- PRINT REPORT --- */
function PrintReport({ type, data, onClose }) {
  const printDate = new Date().toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });

  const CSS = "* { box-sizing: border-box; margin: 0; padding: 0; }"
    + "body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; padding: 28px 32px; font-size: 13px; }"
    + ".hdr { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 18px; }"
    + ".logo { font-size: 22px; font-weight: 900; letter-spacing: 2px; }"
    + ".logo span { color: #D4A800; }"
    + ".hdr-r { text-align: right; font-size: 11px; color: #555; line-height: 1.7; }"
    + ".rpt-title { font-size: 17px; font-weight: 900; margin-bottom: 3px; color: #111; }"
    + "h2 { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #888; margin: 16px 0 6px; border-bottom: 1px solid #eee; padding-bottom: 4px; }"
    + ".grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }"
    + ".stat-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; }"
    + ".stat { background: #f5f5f5; border-radius: 5px; padding: 8px 12px; text-align: center; min-width: 70px; }"
    + ".stat-n { font-size: 20px; font-weight: 900; color: #D4A800; font-family: monospace; }"
    + ".stat-l { font-size: 8px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #888; margin-top: 2px; }"
    + ".br { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }"
    + ".bl { width: 32px; font-size: 11px; font-weight: 800; text-align: right; }"
    + ".bt { flex: 1; height: 14px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }"
    + ".bf { height: 100%; border-radius: 3px; }"
    + ".bp { width: 36px; font-size: 10px; font-weight: 700; color: #555; text-align: right; }"
    + ".note { font-size: 12px; color: #333; line-height: 1.8; padding-left: 10px; border-left: 3px solid #D4A800; margin-bottom: 4px; }"
    + ".zg { display: inline-grid; grid-template-columns: 24px 38px 38px 38px 24px; grid-template-rows: 24px 38px 38px 38px 24px 24px; gap: 2px; }"
    + ".zc { border-radius: 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; font-family: monospace; border: 1.5px solid #ccc; }"
    + ".zs { background: #f8f8f8; } .zb { background: #efefef; border-style: dashed; font-size: 8px; color: #aaa; }"
    + ".zh { background: rgba(220,50,50,0.35); } .zw { background: rgba(255,165,0,0.35); } .zco { background: rgba(50,100,220,0.25); }"
    + ".ct { width: 100%; border-collapse: collapse; font-size: 11px; }"
    + ".ct th { background: #111; color: #fff; padding: 5px 8px; text-align: center; font-size: 9px; letter-spacing: 1px; }"
    + ".ct td { padding: 4px 8px; border: 1px solid #e0e0e0; text-align: center; }"
    + ".risp { margin-bottom: 10px; } .risp-l { font-size: 10px; font-weight: 700; color: #555; margin-bottom: 3px; }"
    + ".ftag { display: inline-block; background: #D4A800; color: #000; border-radius: 3px; padding: 2px 7px; font-size: 9px; font-weight: 700; margin: 2px 3px 2px 0; }"
    + ".ftr { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e0e0e0; font-size: 9px; color: #aaa; display: flex; justify-content: space-between; }"
    + "@media print { body { padding: 16px 20px; } }";

  const barHTML = (mix) => {
    if (!mix || !mix.length) return "<em style='color:#aaa;font-size:11px'>No data</em>";
    const max = mix[0].pct;
    return mix.map(d => {
      const color = DPC[d.type] || ("hsl(" + ((d.type.charCodeAt(0)*47)%360) + ",60%,50%)");
      return '<div class="br"><div class="bl" style="color:' + color + '">' + d.type + '</div><div class="bt"><div class="bf" style="width:' + ((d.pct/max)*100) + '%;background:' + color + '"></div></div><div class="bp">' + d.pct + '%</div></div>';
    }).join("");
  };

  const zoneHTML = (zoneCounts, total) => {
    if (!total) return "<em style='color:#aaa;font-size:11px'>No location data</em>";
    const maxPct = Math.max.apply(null, Object.values(zoneCounts).map(function(c) { return total > 0 ? (c/total)*100 : 0; }).concat([1]));
    let out = '<div class="zg">';
    STRIKE_ZONES.forEach(function(z) {
      const c = zoneCounts[z.k] || 0;
      const pct = total > 0 ? Math.round((c/total)*100) : 0;
      const ratio = pct / maxPct;
      const cls = ratio > 0.65 ? "zc zh" : ratio > 0.35 ? "zc zw" : ratio > 0 ? "zc zco" : "zc zs";
      out += '<div class="' + cls + '" style="grid-row:' + (z.r+1) + ';grid-column:' + (z.c+1) + '">' + (c > 0 ? pct + "%" : "-") + '</div>';
    });
    BALL_ZONES.forEach(function(z) {
      const c = zoneCounts[z.k] || 0;
      const pct = total > 0 ? Math.round((c/total)*100) : 0;
      out += '<div class="zc zb" style="grid-row:' + (z.r+1) + '/span ' + z.rowSpan + ';grid-column:' + (z.c+1) + '/span ' + z.colSpan + '">' + (c > 0 ? pct + "%" : (z.k === "dirt" ? "DIRT" : "")) + '</div>';
    });
    return out + '</div>';
  };

  const mkTop = function(ty, tot) {
    if (!tot) return null;
    var top = Object.entries(ty).sort(function(a,b){return b[1]-a[1];})[0];
    return top ? { type: top[0], pct: ((top[1]/tot)*100).toFixed(0) } : null;
  };

  const buildLibraryHTML = () => {
    const d = data;
    if (!d.t) return "<p>No data available.</p>";
    const t = d.t;
    const notes = [];
    if (t.mix[0]) notes.push("Primary pitch: <strong>" + t.mix[0].type + "</strong> (" + t.mix[0].pct + "%)");
    var fp = mkTop(t.fpT, t.fpN); if (fp && t.fpN >= 2) notes.push("First pitch: <strong>" + fp.type + "</strong> " + fp.pct + "%");
    var ts = mkTop(t.tsT, t.tsN); if (ts && t.tsN >= 2) notes.push("Two strikes: <strong>" + ts.type + "</strong> " + ts.pct + "%");
    var bh = mkTop(t.bhT, t.bhN); if (bh && t.bhN >= 2) notes.push("Behind in count: <strong>" + bh.type + "</strong> " + bh.pct + "%");
    if (t.vLN >= 3) { var l = mkTop(t.vLT, t.vLN); if (l) notes.push("vs LHB: <strong>" + l.type + "</strong> " + l.pct + "%"); }
    if (t.vRN >= 3) { var r = mkTop(t.vRT, t.vRN); if (r) notes.push("vs RHB: <strong>" + r.type + "</strong> " + r.pct + "%"); }
    var wps = d.viewPitches.filter(function(p){return p.type==="WP";}); if (wps.length) notes.push("Wild pitches: " + wps.length + " — run on dirt");
    var sbs = d.viewPitches.filter(function(p){return p.type==="SB";}); if (sbs.length) notes.push("Stolen bases allowed: " + sbs.length);
    const zc = {};
    STRIKE_ZONES.concat(BALL_ZONES).forEach(function(z){zc[z.k]=0;});
    d.viewPitches.forEach(function(p){if(p.location && zc[p.location]!==undefined) zc[p.location]++;});
    var rispHTML = "";
    if (d.rispData && d.rispData.length) {
      rispHTML = d.rispData.map(function(s) {
        var mix = Object.entries(s.freq).map(function(e){return{type:e[0],count:e[1],pct:+((e[1]/s.total)*100).toFixed(1)};}).sort(function(a,b){return b.count-a.count;});
        return '<div class="risp"><div class="risp-l">' + s.label + ' (' + s.total + ' pitches)</div>' + barHTML(mix) + '</div>';
      }).join("");
    }
    var ttoHTML = "";
    if (t.tto && Object.keys(t.tto).length > 1) {
      ttoHTML = Object.entries(t.tto).sort(function(a,b){return parseInt(a[0])-parseInt(b[0]);}).map(function(e) {
        var tot = Object.values(e[1]).reduce(function(a,b){return a+b;},0);
        var mix = Object.entries(e[1]).map(function(f){return{type:f[0],count:f[1],pct:+((f[1]/tot)*100).toFixed(1)};}).sort(function(a,b){return b.count-a.count;});
        var lbl = e[0]==="1"?"1st TTO":e[0]==="2"?"2nd TTO":e[0]==="3"?"3rd TTO":e[0]+"th TTO";
        return '<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:#888;margin-bottom:3px">' + lbl + ' (' + tot + ')</div>' + barHTML(mix) + '</div>';
      }).join("");
    }
    return '<div class="stat-row">'
      + '<div class="stat"><div class="stat-n">' + t.total + '</div><div class="stat-l">Pitches</div></div>'
      + (t.mix[0] ? '<div class="stat"><div class="stat-n">' + t.mix[0].type + '</div><div class="stat-l">Primary</div></div><div class="stat"><div class="stat-n">' + t.mix[0].pct + '%</div><div class="stat-l">Primary %</div></div>' : "")
      + (t.avgVelo ? '<div class="stat"><div class="stat-n">' + t.avgVelo + '</div><div class="stat-l">Avg Velo</div></div>' : "")
      + '</div>'
      + '<div class="grid2">'
      + '<div>'
      + '<h2>Pitch Mix</h2>' + barHTML(t.mix)
      + (t.fpN >= 2 ? '<h2>First Pitch (' + t.fpN + ')</h2>' + barHTML(Object.entries(t.fpT).map(function(e){return{type:e[0],count:e[1],pct:+((e[1]/t.fpN)*100).toFixed(1)};}).sort(function(a,b){return b.count-a.count;})) : "")
      + (t.tsN >= 2 ? '<h2>Two Strikes (' + t.tsN + ')</h2>' + barHTML(Object.entries(t.tsT).map(function(e){return{type:e[0],count:e[1],pct:+((e[1]/t.tsN)*100).toFixed(1)};}).sort(function(a,b){return b.count-a.count;})) : "")
      + (t.bhN >= 2 ? '<h2>Behind (' + t.bhN + ')</h2>' + barHTML(Object.entries(t.bhT).map(function(e){return{type:e[0],count:e[1],pct:+((e[1]/t.bhN)*100).toFixed(1)};}).sort(function(a,b){return b.count-a.count;})) : "")
      + (t.vLN >= 3 ? '<h2>vs LHB (' + t.vLN + ')</h2>' + barHTML(Object.entries(t.vLT).map(function(e){return{type:e[0],count:e[1],pct:+((e[1]/t.vLN)*100).toFixed(1)};}).sort(function(a,b){return b.count-a.count;})) : "")
      + (t.vRN >= 3 ? '<h2>vs RHB (' + t.vRN + ')</h2>' + barHTML(Object.entries(t.vRT).map(function(e){return{type:e[0],count:e[1],pct:+((e[1]/t.vRN)*100).toFixed(1)};}).sort(function(a,b){return b.count-a.count;})) : "")
      + '</div>'
      + '<div>'
      + '<h2>Zone Heat Map</h2>' + zoneHTML(zc, d.viewPitches.length)
      + '<h2>Scout Notes</h2>' + (notes.map(function(n){return '<div class="note">'+n+'</div>';}).join("") || "<em style='color:#aaa;font-size:11px'>Chart more pitches</em>")
      + (ttoHTML ? '<h2>Times Through Order</h2>' + ttoHTML : "")
      + '</div></div>'
      + (rispHTML ? '<h2>Runners in Scoring Position</h2><div class="grid2">' + rispHTML + '</div>' : "");
  };

  const buildSituationsHTML = () => {
    const d = data;
    if (!d.total) return "<p>No pitches match current filters.</p>";
    var filterTags = Object.entries(d.filters).filter(function(e){return e[1]&&e[1].size>0;}).map(function(e){return '<span class="ftag">'+e[0]+': '+Array.from(e[1]).join("+")+'</span>';}).join("");
    var filterBanner = filterTags
      ? '<div style="background:#fffbe6;border:2px solid #D4A800;border-radius:6px;padding:10px 14px;margin-bottom:16px">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92700a;margin-bottom:6px">ACTIVE FILTERS</div>'
        + filterTags
        + '</div>'
      : '<div style="background:#f9f9f9;border:1px solid #ddd;border-radius:6px;padding:8px 14px;margin-bottom:16px;font-size:10px;color:#888">No filters applied — showing all pitches for this team/pitcher</div>';
    var counts = []; for (var b=0;b<=3;b++) for (var s=0;s<=2;s++) counts.push(b+"-"+s);
    var allTypes = Array.from(new Set(d.filtered.map(function(p){return p.type;}))).sort();
    var countTableHTML = allTypes.length ? '<table class="ct"><thead><tr><th>Count</th>' + allTypes.map(function(t){return '<th>'+t+'</th>';}).join("") + '<th>Total</th></tr></thead><tbody>' + counts.map(function(ck){
      var cb = d.countBreakdown[ck]; if (!cb) return "";
      var rt = Object.values(cb).reduce(function(a,b){return a+b;},0);
      return '<tr><td style="font-weight:700">'+ck+'</td>' + allTypes.map(function(t){var c=cb[t]||0;return '<td>'+(c>0?c+' ('+Math.round(c/rt*100)+'%)':'-')+'</td>';}).join("") + '<td style="font-weight:700">'+rt+'</td></tr>';
    }).filter(Boolean).join("") + '</tbody></table>' : "";
    return '<div class="stat-row">'
      + '<div class="stat"><div class="stat-n">' + d.total + '</div><div class="stat-l">Pitches</div></div>'
      + d.typeBD.slice(0,4).map(function(x){var col=DPC[x.type]||'#D4A800';return '<div class="stat"><div class="stat-n" style="color:'+col+'">'+x.pct+'%</div><div class="stat-l">'+x.type+'</div></div>';}).join("")
      + '</div>'
      + filterBanner
      + '<div class="grid2">'
      + '<div><h2>Pitch Mix</h2>' + barHTML(d.typeBD) + '<h2>Count Breakdown</h2>' + countTableHTML + '</div>'
      + '<div><h2>Zone Heat Map</h2>' + zoneHTML(d.zoneCounts, d.total) + '</div>'
      + '</div>';
  };

  const reportTitle = type === "library"
    ? (data.name + " \u2014 " + data.selTeam)
    : (data.team + (data.pitcher !== "all" ? " \u2014 " + data.pitcher : " \u2014 All Pitchers"));

  const reportSubtitle = type === "library"
    ? ("Library Report \u00B7 " + (data.isStaff ? "Staff Overview" : "Pitcher Profile"))
    : "Game Situations Report";

  const handlePrint = () => {
    const bodyHTML = type === "library" ? buildLibraryHTML() : buildSituationsHTML();
    const fullHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ArmSight Report</title><style>' + CSS + '</style></head><body>'
      + '<div class="hdr"><div><div class="logo"><span>ARM</span>SIGHT</div><div style="font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-top:2px">armsight.app</div></div>'
      + '<div class="hdr-r"><div class="rpt-title">' + reportTitle + '</div><div>' + reportSubtitle + '</div><div>' + printDate + '</div></div></div>'
      + bodyHTML
      + '<div class="ftr"><div>Generated by ArmSight \u00B7 armsight.app</div><div>' + printDate + '</div></div>'
      + '</body></html>';
    const w = window.open("", "_blank", "width=920,height=700");
    if (!w) { alert("Please allow popups for armsight.app to print reports."); return; }
    w.document.write(fullHTML);
    w.document.close();
    w.focus();
    setTimeout(function() { w.print(); }, 500);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: G.sf, border: "1px solid " + G.bd, borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: G.gold, marginBottom: 3 }}>{reportTitle}</div>
            <div style={{ fontSize: 11, color: G.tx3, fontFamily: "'Azeret Mono',monospace", letterSpacing: 1 }}>{reportSubtitle}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: G.tx3, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: G.tx2, marginBottom: 18, lineHeight: 1.7 }}>
          Opens a print-ready page in a new tab. Use your browser's <strong style={{ color: G.tx }}>Print</strong> or <strong style={{ color: G.tx }}>Save as PDF</strong> option.
        </div>
        <button onClick={handlePrint}
          style={{ width: "100%", padding: "14px", background: G.gold, color: "#000", border: "none", borderRadius: 8, fontFamily: "'Anybody',sans-serif", fontSize: 15, fontWeight: 900, cursor: "pointer", letterSpacing: 1, marginBottom: 10 }}>
          🖨 Open Print Page
        </button>
        <button onClick={onClose}
          style={{ width: "100%", padding: "10px", background: "transparent", color: G.tx3, border: "1px solid " + G.bd, borderRadius: 8, fontFamily: "'Anybody',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

  const handlePrint = () => {
    const printEl = document.getElementById("as-print-report");
    if (!printEl) return;
    const w = window.open("", "_blank", "width=900,height=700");
    w.document.write(`<!DOCTYPE html><html><head>
      <title>ArmSight Report</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; padding: 28px 32px; font-size: 13px; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 18px; }
        .logo { font-size: 22px; font-weight: 900; letter-spacing: 2px; }
        .logo span { color: #D4A800; }
        .header-right { text-align: right; font-size: 11px; color: #555; line-height: 1.7; }
        .report-title { font-size: 17px; font-weight: 900; margin-bottom: 3px; color: #111; }
        h2 { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #888; margin: 16px 0 6px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 0; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .stat-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
        .stat { background: #f5f5f5; border-radius: 5px; padding: 8px 12px; text-align: center; min-width: 70px; }
        .stat-num { font-size: 20px; font-weight: 900; color: #D4A800; font-family: monospace; }
        .stat-lbl { font-size: 8px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #888; margin-top: 2px; }
        .bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
        .bar-label { width: 32px; font-size: 11px; font-weight: 800; text-align: right; }
        .bar-track { flex: 1; height: 14px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 3px; }
        .bar-pct { width: 36px; font-size: 10px; font-weight: 700; color: #555; text-align: right; }
        .note-row { font-size: 12px; color: #333; line-height: 1.8; padding-left: 10px; border-left: 3px solid #D4A800; margin-bottom: 4px; }
        .zone-grid { display: inline-grid; grid-template-columns: 24px repeat(3,38px) 24px; grid-template-rows: 24px repeat(3,38px) 24px; gap: 2px; }
        .zone-cell { border-radius: 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; font-family: monospace; border: 1.5px solid #ccc; }
        .zone-strike { background: #f8f8f8; }
        .zone-ball { background: #efefef; border-style: dashed; font-size: 8px; color: #aaa; }
        .zone-hot { background: rgba(220,50,50,0.35); }
        .zone-warm { background: rgba(255,165,0,0.35); }
        .zone-cool { background: rgba(50,100,220,0.25); }
        .count-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .count-table th { background: #111; color: #fff; padding: 5px 8px; text-align: center; font-size: 9px; letter-spacing: 1px; }
        .count-table td { padding: 4px 8px; border: 1px solid #e0e0e0; text-align: center; }
        .count-table tr:nth-child(even) td { background: #f9f9f9; }
        .risp-row { margin-bottom: 10px; }
        .risp-label { font-size: 10px; font-weight: 700; color: #555; margin-bottom: 3px; }
        .filter-tag { display: inline-block; background: #f0f0f0; border-radius: 3px; padding: 2px 7px; font-size: 9px; font-weight: 700; margin: 2px 3px 2px 0; color: #555; }
        .filter-tag.active { background: #D4A800; color: #000; }
        .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e0e0e0; font-size: 9px; color: #aaa; display: flex; justify-content: space-between; }
        @media print { body { padding: 16px 20px; } }
      </style>
    </head><body>${printEl.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  // Build bar chart HTML
  const barHTML = (mix) => {
    if (!mix || !mix.length) return "<em style='color:#aaa;font-size:11px'>No data</em>";
    const max = mix[0].pct;
    return mix.map(d => {
      const color = DPC[d.type] || `hsl(${(d.type.charCodeAt(0)*47)%360},60%,50%)`;
      return `<div class="bar-row">
        <div class="bar-label" style="color:${color}">${d.type}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(d.pct/max)*100}%;background:${color}"></div></div>
        <div class="bar-pct">${d.pct}%</div>
      </div>`;
    }).join("");
  };

  // Build zone grid HTML
  const zoneHTML = (zoneCounts, total) => {
    if (!total) return "<em style='color:#aaa;font-size:11px'>No location data</em>";
    const maxPct = Math.max(...Object.values(zoneCounts).map(c => total > 0 ? (c/total)*100 : 0), 1);
    let cells = {};

    STRIKE_ZONES.forEach(z => {
      const c = zoneCounts[z.k] || 0;
      const pct = total > 0 ? ((c/total)*100) : 0;
      const ratio = pct / maxPct;
      const cls = ratio > 0.65 ? "zone-cell zone-hot" : ratio > 0.35 ? "zone-cell zone-warm" : ratio > 0 ? "zone-cell zone-cool" : "zone-cell zone-strike";
      cells[`${z.r+1}-${z.c+1}`] = `<div class="${cls}" style="grid-row:${z.r+1};grid-column:${z.c+1}">${c > 0 ? Math.round(pct)+"%" : "-"}</div>`;
    });
    BALL_ZONES.forEach(z => {
      const c = zoneCounts[z.k] || 0;
      const pct = total > 0 ? ((c/total)*100) : 0;
      cells[z.k] = `<div class="zone-cell zone-ball" style="grid-row:${z.r+1}/span ${z.rowSpan};grid-column:${z.c+1}/span ${z.colSpan}">${c > 0 ? Math.round(pct)+"%" : z.k==="dirt"?"DIRT":""}</div>`;
    });
    return `<div class="zone-grid">${Object.values(cells).join("")}</div>`;
  };

  // ── BUILD LIBRARY REPORT HTML ─────────────────────────────────────────────
  const buildLibraryHTML = () => {
    const { name, t, pitches, viewPitches, selTeam, isStaff, rispData } = data;
    if (!t) return "<p>No data available.</p>";

    const mk = (ty, tot) => {
      if (!tot) return null;
      const top = Object.entries(ty).sort((a,b) => b[1]-a[1])[0];
      return top ? { type: top[0], pct: ((top[1]/tot)*100).toFixed(0) } : null;
    };

    // Scout notes
    const notes = [];
    if (t.mix[0]) notes.push(`Primary pitch: <strong>${t.mix[0].type}</strong> (${t.mix[0].pct}%)`);
    const fp = mk(t.fpT, t.fpN); if (fp && t.fpN >= 2) notes.push(`First pitch: <strong>${fp.type}</strong> ${fp.pct}%`);
    const ts = mk(t.tsT, t.tsN); if (ts && t.tsN >= 2) notes.push(`Two strikes: <strong>${ts.type}</strong> ${ts.pct}%`);
    const bh = mk(t.bhT, t.bhN); if (bh && t.bhN >= 2) notes.push(`Behind in count: <strong>${bh.type}</strong> ${bh.pct}%`);
    if (t.vLN >= 3) { const l = mk(t.vLT, t.vLN); if (l) notes.push(`vs LHB: <strong>${l.type}</strong> ${l.pct}%`); }
    if (t.vRN >= 3) { const r = mk(t.vRT, t.vRN); if (r) notes.push(`vs RHB: <strong>${r.type}</strong> ${r.pct}%`); }
    const wps = pitches.filter(p => p.type === "WP");
    if (wps.length) notes.push(`Wild pitches: ${wps.length} — run on dirt`);
    const sbs = pitches.filter(p => p.type === "SB");
    if (sbs.length) notes.push(`Stolen bases allowed: ${sbs.length} — vulnerable to run game`);

    // Zone counts from viewPitches
    const zc = {};
    [...STRIKE_ZONES, ...BALL_ZONES].forEach(z => { zc[z.k] = 0; });
    viewPitches.forEach(p => { if (p.location && zc[p.location] !== undefined) zc[p.location]++; });

    // RISP
    let rispHTML = "";
    if (rispData && rispData.length > 0) {
      rispHTML = rispData.map(({ label, freq, total: rt }) => {
        const mix = Object.entries(freq).map(([tp, c]) => ({ type: tp, count: c, pct: +((c/rt)*100).toFixed(1) })).sort((a,b)=>b.count-a.count);
        return `<div class="risp-row"><div class="risp-label">${label} (${rt} pitches)</div>${barHTML(mix)}</div>`;
      }).join("");
    }

    // TTO
    let ttoHTML = "";
    if (t.tto && Object.keys(t.tto).length > 1) {
      ttoHTML = Object.entries(t.tto).sort((a,b)=>parseInt(a[0])-parseInt(b[0])).map(([k, ty]) => {
        const tot = Object.values(ty).reduce((a,b)=>a+b,0);
        const mix = Object.entries(ty).map(([tp,c])=>({type:tp,count:c,pct:+((c/tot)*100).toFixed(1)})).sort((a,b)=>b.count-a.count);
        const lbl = k==="1"?"1st TTO":k==="2"?"2nd TTO":k==="3"?"3rd TTO":k+"th TTO";
        return `<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:#888;margin-bottom:3px">${lbl} (${tot})</div>${barHTML(mix)}</div>`;
      }).join("");
    }

    return `
      <div class="stat-row">
        <div class="stat"><div class="stat-num">${t.total}</div><div class="stat-lbl">Pitches</div></div>
        <div class="stat"><div class="stat-num">${t.mix[0]?.type || "—"}</div><div class="stat-lbl">Primary</div></div>
        <div class="stat"><div class="stat-num">${t.mix[0]?.pct || "—"}%</div><div class="stat-lbl">Primary %</div></div>
        ${t.avgVelo ? `<div class="stat"><div class="stat-num">${t.avgVelo}</div><div class="stat-lbl">Avg Velo</div></div>` : ""}
      </div>
      <div class="grid-2">
        <div>
          <h2>Pitch Mix</h2>
          ${barHTML(t.mix)}
          ${t.fpN >= 2 ? `<h2>First Pitch (${t.fpN})</h2>${barHTML(Object.entries(t.fpT).map(([tp,c])=>({type:tp,count:c,pct:+((c/t.fpN)*100).toFixed(1)})).sort((a,b)=>b.count-a.count))}` : ""}
          ${t.tsN >= 2 ? `<h2>Two Strikes (${t.tsN})</h2>${barHTML(Object.entries(t.tsT).map(([tp,c])=>({type:tp,count:c,pct:+((c/t.tsN)*100).toFixed(1)})).sort((a,b)=>b.count-a.count))}` : ""}
          ${t.bhN >= 2 ? `<h2>Behind in Count (${t.bhN})</h2>${barHTML(Object.entries(t.bhT).map(([tp,c])=>({type:tp,count:c,pct:+((c/t.bhN)*100).toFixed(1)})).sort((a,b)=>b.count-a.count))}` : ""}
          ${t.vLN >= 3 ? `<h2>vs LHB (${t.vLN})</h2>${barHTML(Object.entries(t.vLT).map(([tp,c])=>({type:tp,count:c,pct:+((c/t.vLN)*100).toFixed(1)})).sort((a,b)=>b.count-a.count))}` : ""}
          ${t.vRN >= 3 ? `<h2>vs RHB (${t.vRN})</h2>${barHTML(Object.entries(t.vRT).map(([tp,c])=>({type:tp,count:c,pct:+((c/t.vRN)*100).toFixed(1)})).sort((a,b)=>b.count-a.count))}` : ""}
        </div>
        <div>
          <h2>Zone Heat Map</h2>
          ${zoneHTML(zc, viewPitches.length)}
          <h2>Scout Notes</h2>
          ${notes.map(n => `<div class="note-row">${n}</div>`).join("") || "<em style='color:#aaa;font-size:11px'>Chart more pitches for notes</em>"}
          ${ttoHTML ? `<h2>Times Through Order</h2>${ttoHTML}` : ""}
        </div>
      </div>
      ${rispHTML ? `<h2>Runners in Scoring Position</h2><div class="grid-2">${rispHTML}</div>` : ""}
    `;
  };

  // ── BUILD GAME SITUATIONS REPORT HTML ────────────────────────────────────
  const buildSituationsHTML = () => {
    const { team, pitcher, filters, filtered, total, zoneCounts, typeBD, countBreakdown } = data;
    if (!total) return "<p>No pitches match the current filters.</p>";

    // Active filter tags
    const filterTags = Object.entries(filters).filter(([,v]) => v && v.size > 0).map(([k, v]) =>
      `<span class="filter-tag active">${k}: ${Array.from(v).join("+")}</span>`
    ).join("");

    // Count breakdown table
    const counts = [];
    for (let b = 0; b <= 3; b++) for (let s = 0; s <= 2; s++) counts.push(`${b}-${s}`);
    const allTypes = [...new Set(filtered.map(p => p.type))].sort();
    const countTableHTML = allTypes.length > 0 ? `
      <table class="count-table">
        <thead><tr><th>Count</th>${allTypes.map(t => `<th>${t}</th>`).join("")}<th>Total</th></tr></thead>
        <tbody>${counts.map(ck => {
          const cb = countBreakdown[ck];
          if (!cb) return "";
          const rowTotal = Object.values(cb).reduce((a,b)=>a+b,0);
          return `<tr><td style="font-weight:700">${ck}</td>${allTypes.map(t => {
            const c = cb[t] || 0;
            return `<td>${c > 0 ? `${c} (${Math.round(c/rowTotal*100)}%)` : "-"}</td>`;
          }).join("")}<td style="font-weight:700">${rowTotal}</td></tr>`;
        }).filter(Boolean).join("")}</tbody>
      </table>` : "";

    return `
      <div class="stat-row">
        <div class="stat"><div class="stat-num">${total}</div><div class="stat-lbl">Pitches</div></div>
        ${typeBD.slice(0,4).map(d => `<div class="stat"><div class="stat-num" style="color:${DPC[d.type]||'#D4A800'}">${d.pct}%</div><div class="stat-lbl">${d.type}</div></div>`).join("")}
      </div>
      ${filterTags ? `<div style="margin-bottom:12px"><span style="font-size:9px;font-weight:700;color:#888;letter-spacing:1px;text-transform:uppercase;margin-right:6px">FILTERS</span>${filterTags}</div>` : ""}
      <div class="grid-2">
        <div>
          <h2>Pitch Mix</h2>
          ${barHTML(typeBD)}
          <h2>Count Breakdown</h2>
          ${countTableHTML}
        </div>
        <div>
          <h2>Zone Heat Map</h2>
          ${zoneHTML(zoneCounts, total)}
        </div>
      </div>
    `;
  };

  const reportTitle = type === "library"
    ? `${data.name} — ${data.selTeam}`
    : `${data.team}${data.pitcher !== "all" ? " — " + data.pitcher : " — All Pitchers"}`;

  const reportSubtitle = type === "library"
    ? `Library Report · ${data.isStaff ? "Staff Overview" : "Pitcher Profile"}`
    : "Game Situations Report";

  const bodyHTML = type === "library" ? buildLibraryHTML() : buildSituationsHTML();

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: G.sf, border: "1px solid " + G.bd, borderRadius: 12, padding: 24, maxWidth: 520, width: "100%", maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: G.gold, marginBottom: 3 }}>{reportTitle}</div>
            <div style={{ fontSize: 11, color: G.tx3, fontFamily: "'Azeret Mono',monospace", letterSpacing: 1 }}>{reportSubtitle}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: G.tx3, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: G.tx2, marginBottom: 20, lineHeight: 1.7 }}>
          Clicking <strong style={{ color: G.tx }}>Print / Save PDF</strong> opens a print-ready version in a new tab. Use your browser's print dialog to print or save as PDF.
        </div>

        <button onClick={handlePrint}
          style={{ width: "100%", padding: "14px", background: G.gold, color: "#000", border: "none", borderRadius: 8, fontFamily: "'Anybody',sans-serif", fontSize: 15, fontWeight: 900, cursor: "pointer", letterSpacing: 1, marginBottom: 10 }}>
          🖨 Print / Save PDF
        </button>
        <button onClick={onClose}
          style={{ width: "100%", padding: "10px", background: "transparent", color: G.tx3, border: "1px solid " + G.bd, borderRadius: 8, fontFamily: "'Anybody',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Cancel
        </button>

        {/* Hidden print content */}
        <div id="as-print-report" style={{ display: "none" }}>
          <div class="header">
            <div>
              <div class="logo"><span>ARM</span>SIGHT</div>
              <div style="font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-top:2px">armsight.app</div>
            </div>
            <div class="header-right">
              <div class="report-title">${reportTitle}</div>
              <div>${reportSubtitle}</div>
              <div>${printDate}</div>
            </div>
          </div>
          ${bodyHTML}
          <div class="footer">
            <div>Generated by ArmSight · armsight.app</div>
            <div>${printDate}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- CHART GAME --- */
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
    // Attach brRead to events too (especially pickoffs)
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

/* --- ZONES TAB --- */
// ════════ SHARED SCOPE (used by all analyzer tabs) ════════
// Consistent cascade everywhere:
//   Pitcher Hand → Teams (multi) → Games (multi, by date) → Pitchers (multi) → sub-filters
const scopePKey   = (p, g) => (p.pitcher || (g && g.pitcher) || "Unknown").trim().toLowerCase();
const scopePLabel = (p, g) => (p.pitcher || (g && g.pitcher) || "Unknown").trim();
const scopeHandOf = (p, g) => {
  if (p.pitcherHand) return p.pitcherHand;
  if (!g) return "R";
  const nm = (p.pitcher || g.pitcher || "").trim();
  if (nm && Array.isArray(g.relievers)) {
    const rel = g.relievers.find(r => (r.name || "").trim() === nm);
    if (rel && rel.hand) return rel.hand;
  }
  return g.pitcherHand || "R";
};

function useScope(games = [], activeGame = null, opts = {}) {
  const [hand,     setHand]     = useState("all");          // "all" | "L" | "R"
  const [teams,    setTeams]    = useState(() => new Set(activeGame && activeGame.opponent ? [(activeGame.opponent || "").trim()] : []));
  const [gameIds,  setGameIds]  = useState(() => new Set()); // empty = all games of the selected team(s)
  const [pitchers, setPitchers] = useState(() => new Set()); // empty = all pitchers
  const lockSource = opts.lockSource || null;                // "live" forces live-only (Hitting) and hides the chip
  const [sourceRaw, setSourceRaw] = useState("all");         // "all" | "live" | "pregame"
  const source = lockSource || sourceRaw;
  const setSource = setSourceRaw;

  const allTeams = useMemo(
    () => [...new Set(games.map(g => (g.opponent || "").trim()).filter(Boolean))].sort(),
    [games]
  );

  // games for the selected team(s); none selected = every game
  const teamGames = useMemo(
    () => (teams.size === 0 ? games : games.filter(g => teams.has((g.opponent || "").trim()))),
    [games, teams]
  );
  const multiGame = teamGames.length > 1;

  // Source counts over the team's games (pre-source) so the Data Source chip can show totals
  const liveCount    = useMemo(() => teamGames.filter(g => !g.pregame).length, [teamGames]);
  const pregameCount = useMemo(() => teamGames.filter(g => g.pregame).length, [teamGames]);
  const hasPregame   = pregameCount > 0;

  // after the optional specific-game selection
  const scopedGames = useMemo(
    () => {
      const byGame = gameIds.size === 0 ? teamGames : teamGames.filter(g => gameIds.has(g.id));
      if (source === "live")    return byGame.filter(g => !g.pregame);
      if (source === "pregame") return byGame.filter(g => g.pregame);
      return byGame;
    },
    [teamGames, gameIds, source]
  );

  const gameById = useMemo(() => {
    const m = {};
    games.forEach(g => { m[g.id] = g; });
    return m;
  }, [games]);

  // pitchers who actually threw in the scoped games, respecting the hand filter
  const availablePitchers = useMemo(() => {
    const m = {};
    scopedGames.forEach(g => (g.pitches || []).forEach(p => {
      if (EVENTS.has(p.type)) return;
      const h = scopeHandOf(p, g);
      if (hand !== "all" && h !== hand) return;
      const key = scopePKey(p, g);
      if (!m[key]) m[key] = { key, label: scopePLabel(p, g), hand: h };
    }));
    return Object.values(m).sort((a, b) => a.label.localeCompare(b.label));
  }, [scopedGames, hand]);

  // keep child selections valid as their parents change
  useEffect(() => {
    setGameIds(prev => {
      if (prev.size === 0) return prev;
      const valid = new Set(teamGames.map(g => g.id));
      const next = new Set([...prev].filter(id => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [teamGames]);
  useEffect(() => {
    setPitchers(prev => {
      if (prev.size === 0) return prev;
      const valid = new Set(availablePitchers.map(p => p.key));
      const next = new Set([...prev].filter(k => valid.has(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [availablePitchers]);

  const matchHand    = (p, g) => hand === "all" || scopeHandOf(p, g) === hand;
  const matchPitcher = (p, g) => pitchers.size === 0 || pitchers.has(scopePKey(p, g));
  const inScope      = (p, g) => matchHand(p, g) && matchPitcher(p, g);

  return {
    hand, setHand, teams, setTeams, gameIds, setGameIds, pitchers, setPitchers,
    allTeams, teamGames, multiGame, scopedGames, gameById, availablePitchers,
    matchHand, matchPitcher, inScope,
    source, setSource, lockSource, liveCount, pregameCount, hasPregame,
  };
}

function ScopeBar({ scope }) {
  const { hand, setHand, teams, setTeams, gameIds, setGameIds, pitchers, setPitchers,
          allTeams, teamGames, multiGame, availablePitchers,
          source, setSource, lockSource, liveCount, pregameCount, hasPregame } = scope;

  const tog = (setter, key) => setter(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });
  const chip = (label, active, onClick) => (
    <button key={label} onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 5, border: "none", cursor: "pointer",
      background: active ? G.gold : G.sf2, color: active ? "#000" : G.tx2,
      fontSize: 11, fontWeight: active ? 800 : 600, fontFamily: "'Anybody',sans-serif",
      outline: active ? "2px solid " + G.gold : "none", outlineOffset: 1,
    }}>{label}</button>
  );
  const srow = (label, count, onClear, children) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
        {count > 0 && <span style={{ fontSize: 9, color: G.gold, cursor: "pointer", fontWeight: 700 }} onClick={onClear}>Clear ({count})</span>}
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{children}</div>
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

function discCellM(den, num) {
  const v = den > 0 ? num / den : -1;
  if (den === 0) return { bg: G.sf2, col: G.tx3, txt: null };
  const pct = Math.round(v * 100) + "%";
  if (den < 3) return { bg: "rgba(130,130,130,0.22)", col: G.tx3, txt: pct };
  const a = (0.18 + Math.min(v, 1) * 0.72).toFixed(2);
  return { bg: "rgba(212,175,55," + a + ")", col: v >= 0.55 ? "#1a1200" : G.tx, txt: pct };
}
function pdMatch(p, pts, f) {
  if (!pdSeen(p)) return false;
  if (f.pitch !== "All") { const fam = ({ fastball: "Fastball", breaking: "Breaking", offspeed: "Offspeed" })[getPitchFamily(p.type, pts || [])] || "Other"; if (fam !== f.pitch) return false; }
  if (f.count !== "All") { const cb = p.balls > p.strikes ? "Ahead" : p.balls < p.strikes ? "Behind" : "Even"; if (cb !== f.count) return false; }
  if (f.outs !== "All" && String(p.outs) !== f.outs) return false;
  if (f.run !== "All") { const r = p.runners || {}; const rb = (r.second || r.third) ? "RISP" : r.first ? "Men on" : "Empty"; if (rb !== f.run) return false; }
  return true;
}
function DiscBoard({ pool }) {
  const [metric, setMetric] = useState("whiff");
  const [f, setF] = useState({ pitch: "All", count: "All", outs: "All", run: "All" });
  const pitches = pool.filter(x => pdMatch(x.p, x.pts, f)).map(x => x.p);
  const rates = pdRates(pitches);
  const pct = v => v < 0 ? "—" : Math.round(v * 100) + "%";
  const seenLoc = pitches.filter(p => p.location && (STRIKE_ZONE_KEYS.has(p.location) || BALL_ZONE_KEYS.has(p.location)));
  const dd = (key, opts) => (
    <select value={f[key]} onChange={e => setF(s => ({ ...s, [key]: e.target.value }))} style={{ background: G.sf2, color: G.tx, border: "1px solid " + G.bd2, borderRadius: 6, padding: "5px 8px", fontSize: 11, fontFamily: "inherit" }}>
      {opts.map(o => <option key={o} value={o}>{o === "All" ? key[0].toUpperCase() + key.slice(1) + ": All" : (key === "count" && (o === "Ahead" || o === "Behind") ? "Hitter " + o : o)}</option>)}
    </select>
  );
  const stat = (key, lbl) => (
    <div onClick={() => setMetric(key)} style={{ flex: 1, textAlign: "center", cursor: "pointer", padding: "8px 4px", borderRadius: 8, background: metric === key ? G.gold + "22" : G.sf2, border: "2px solid " + (metric === key ? G.gold : "transparent") }}>
      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: metric === key ? G.gold : G.tx }}>{pct(rates[key])}</div>
      <div style={{ fontSize: 9, color: G.tx3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{lbl}</div>
    </div>
  );
  const lblTxt = { whiff: "Whiff% = swing-and-miss / swings", chase: "Chase% = swings / pitches seen (out-of-zone only)", take: "Take% = takes / pitches seen" }[metric];
  return (
    <div style={cd}>
      <div style={cT}>Plate Discipline — induced</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>{stat("whiff", "Whiff")}{stat("chase", "Chase")}{stat("take", "Take")}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {dd("pitch", ["All", "Fastball", "Breaking", "Offspeed"])}
        {dd("count", ["All", "Ahead", "Even", "Behind"])}
        {dd("outs", ["All", "0", "1", "2"])}
        {dd("run", ["All", "Empty", "Men on", "RISP"])}
      </div>
      {seenLoc.length === 0 ? <div style={{ fontSize: 12, color: G.tx3, fontStyle: "italic" }}>No located pitches for this selection.</div> : (
        <div>
          <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{({ whiff: "Whiff %", chase: "Chase %", take: "Take %" })[metric]} by zone</div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
            {["R", "L"].map(side => {
              const sp = seenLoc.filter(p => (p.batSide || "R") === side);
              if (sp.length === 0) return null;
              const den = {}, num = {};
              [...STRIKE_ZONES.map(z => z.k), ...BALL_ZONES.map(z => z.k)].forEach(k => { den[k] = 0; num[k] = 0; });
              sp.forEach(p => {
                const k = p.location; if (den[k] === undefined) return;
                if (metric === "whiff") { if (pdSwing(p)) { den[k]++; if (pdWhiff(p)) num[k]++; } }
                else if (metric === "chase") { if (BALL_ZONE_KEYS.has(k)) { den[k]++; if (pdSwing(p)) num[k]++; } }
                else { den[k]++; if (!pdSwing(p)) num[k]++; }
              });
              return (
                <div key={side} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, marginBottom: 6, letterSpacing: 1 }}>{side === "R" ? "vs RHB" : "vs LHB"} ({sp.length})</div>
                  <div style={{ display: "inline-grid", gridTemplateColumns: "24px repeat(3,42px) 24px", gridTemplateRows: "24px repeat(3,42px) 24px 24px", gap: 2 }}>
                    {STRIKE_ZONES.map(z => { const v = discCellM(den[z.k], num[z.k]); return (
                      <div key={z.k} style={{ gridRow: z.r + 1, gridColumn: z.c + 1, background: v.bg, color: v.col, borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "2px solid " + G.bd }}>
                        {den[z.k] > 0 ? (<><div style={{ fontSize: 11, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{v.txt}</div><div style={{ fontSize: 7, opacity: 0.8 }}>n={den[z.k]}</div></>) : <div style={{ fontSize: 9, color: G.tx3 }}>·</div>}
                      </div> ); })}
                    {BALL_ZONES.map(z => { const v = discCellM(den[z.k], num[z.k]); return (
                      <div key={z.k} style={{ gridRow: (z.r + 1) + " / span " + z.rowSpan, gridColumn: (z.c + 1) + " / span " + z.colSpan, background: den[z.k] > 0 ? v.bg : "#0d0d0d", color: v.col, borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px dashed " + G.bd2 }}>
                        {den[z.k] > 0 ? (<><div style={{ fontSize: 10, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{v.txt}</div><div style={{ fontSize: 7, opacity: 0.8 }}>n={den[z.k]}</div></>) : <div style={{ fontSize: 7, color: G.tx3 }}>{z.k === "dirt" ? "DIRT" : (side === "R" ? z.rL : z.lL)}</div>}
                      </div> ); })}
                  </div>
                </div> );
            })}
          </div>
          <div style={{ fontSize: 9, color: G.tx3, marginTop: 8, textAlign: "center" }}>{lblTxt} · brighter = higher · n shown · &lt;3 muted{metric === "chase" ? " · out-of-zone cells only" : ""}</div>
        </div>
      )}
    </div>
  );
}
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

/* --- DASHBOARD --- */
function Dash({ games }) {
  const [sel, setSel] = useState(null);
  const pm = {};
  games.forEach(g => { g.pitches.forEach(p => { const k = p.pitcher || g.pitcher; if (!pm[k]) pm[k] = { name: k, gS: new Set(), pitches: [], events: [] }; pm[k].gS.add(g.id); if (EVENTS.has(p.type)) pm[k].events.push(p); else pm[k].pitches.push(p); }); });
  const ps = Object.values(pm).map(p => ({ ...p, games: p.gS.size })).sort((a, b) => b.pitches.length - a.pitches.length);
  useEffect(() => { if (ps.length && !sel) setSel(ps[0].name); }, [ps.length]);
  if (!ps.length) return <div style={{ ...cd, textAlign: "center", padding: 50 }}>No Data</div>;
  const d = pm[sel];
  const t = d ? analyze(d.pitches) : null;
  const mkB = (ty, tot) => tot ? Object.entries(ty).map(([t, c]) => ({ type: t, count: c, pct: +((c / tot) * 100).toFixed(1) })).sort((a, b) => b.count - a.count) : [];

  return (
    <div>
      <div style={{ ...cd, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: G.tx3, fontWeight: 800 }}>PITCHER</span>
        {ps.map(p => <button key={p.name} onClick={() => setSel(p.name)} style={btn(sel === p.name ? "p" : "g")}>{p.name} ({p.pitches.length})</button>)}
      </div>
      {t && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 8, marginBottom: 12 }}>
            {[{ v: t.total, l: "Pitches" }, { v: t.mix[0]?.type || "-", l: "Primary" }, { v: t.mix[0] ? t.mix[0].pct + "%" : "-", l: "Primary %" }, { v: d.games, l: "Games" }, { v: d.events.filter(e => e.type === "PKO" || e.type === "PK" || e.type === "PK-E").length || "0", l: "Pickoffs" }].map((s, i) => (
              <div key={i} style={{ ...cd, textAlign: "center", marginBottom: 0, padding: 12 }}>
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: G.gold }}>{s.v}</div>
                <div style={{ fontSize: 9, color: G.tx3, letterSpacing: 1, textTransform: "uppercase", marginTop: 4, fontWeight: 700 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={cd}><div style={cT}>Pitch Mix</div><Bar data={t.mix} /></div>
          {t.fpN > 0 && <div style={cd}><div style={cT}>First Pitch ({t.fpN})</div><Bar data={mkB(t.fpT, t.fpN)} /></div>}
          {t.tsN > 0 && <div style={cd}><div style={cT}>Two-Strike ({t.tsN})</div><Bar data={mkB(t.tsT, t.tsN)} /></div>}
          {t.bhN > 0 && <div style={cd}><div style={cT}>Behind ({t.bhN})</div><Bar data={mkB(t.bhT, t.bhN)} /></div>}
          {t.vLN > 0 && <div style={cd}><div style={cT}>vs LHB ({t.vLN})</div><Bar data={mkB(t.vLT, t.vLN)} /></div>}
          {t.vRN > 0 && <div style={cd}><div style={cT}>vs RHB ({t.vRN})</div><Bar data={mkB(t.vRT, t.vRN)} /></div>}
          {Object.keys(t.tto).length > 0 && <div style={cd}><div style={cT}>Times Through</div>{Object.entries(t.tto).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([k, ty]) => { const tot = Object.values(ty).reduce((a, b) => a + b, 0); return <div key={k} style={{ marginBottom: 8 }}><div style={{ fontSize: 11, color: G.tx3, fontWeight: 800, marginBottom: 4 }}>{k === "1" ? "1st" : k === "2" ? "2nd" : k === "3" ? "3rd" : k + "th"} ({tot})</div><Bar data={mkB(ty, tot)} /></div>; })}</div>}
          <div style={{ ...cd, border: "2px solid " + G.gold + "44" }}><div style={cT}>Report</div><ScoutNotes t={t} pitches={[...d.pitches, ...d.events]} name={sel} /></div>
        </>
      )}
    </div>
  );
}

/* ─── LIBRARY — Team & Pitcher Profiles ─────────────────────────────────── */
function Library({ games, tier }) {
  const [selTeam, setSelTeam] = useState(null);
  const [selPitcher, setSelPitcher] = useState("all");
  const [showPrint, setShowPrint] = useState(false);
  const isElite = tier === "elite";

  // Helper: canonical pitcher key — lowercase+trimmed so "Gausman" and "gausman" merge
  const pitcherKey = (name) => (name || "Unknown").trim().toLowerCase();

  // Build team map — for Pro only show most recent game per opponent
  // For Elite show all games aggregated
  // pitchers stored as { [canonicalKey]: { displayName, pitches[] } }
  const teamMap = {};
  games.forEach(g => {
    if (!g.pitches || g.pitches.length === 0) return;
    const opp = (g.opponent || "Unknown").trim();
    if (!teamMap[opp]) teamMap[opp] = { games: [], pitchers: {} };
    teamMap[opp].games.push(g);
    g.pitches.forEach(p => {
      const rawName = (p.pitcher || g.pitcher || "Unknown").trim();
      const key = pitcherKey(rawName);
      if (!teamMap[opp].pitchers[key]) teamMap[opp].pitchers[key] = { displayName: rawName, pitches: [] };
      if (!EVENTS.has(p.type) && p.result !== "ibb" && p.type !== "UNK") {
        teamMap[opp].pitchers[key].pitches.push(p);
      }
    });
  });

  // For Pro — only use most recent game per opponent
  const proTeamMap = {};
  Object.entries(teamMap).forEach(([opp, data]) => {
    const latestGame = [...data.games].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (!latestGame) return;
    const pitchers = {};
    latestGame.pitches.forEach(p => {
      const rawName = (p.pitcher || latestGame.pitcher || "Unknown").trim();
      const key = pitcherKey(rawName);
      if (!pitchers[key]) pitchers[key] = { displayName: rawName, pitches: [] };
      if (!EVENTS.has(p.type) && p.result !== "ibb") pitchers[key].pitches.push(p);
    });
    proTeamMap[opp] = { games: [latestGame], pitchers };
  });

  // Build global pitcher map across ALL opponents (Elite only)
  // Key: canonical name → { displayName, pitches[], games[] }
  const globalPitcherMap = {};
  if (isElite) {
    games.forEach(g => {
      if (!g.pitches || g.pitches.length === 0) return;
      g.pitches.forEach(p => {
        const rawName = (p.pitcher || g.pitcher || "Unknown").trim();
        const key = pitcherKey(rawName);
        if (!globalPitcherMap[key]) globalPitcherMap[key] = { displayName: rawName, pitches: [], gameIds: new Set() };
        globalPitcherMap[key].gameIds.add(g.id);
        if (!EVENTS.has(p.type) && p.result !== "ibb" && p.type !== "UNK") {
          globalPitcherMap[key].pitches.push(p);
        }
      });
    });
  }

  const activeMap = isElite ? teamMap : proTeamMap;
  const teams = Object.keys(activeMap).sort();

  useEffect(() => {
    if (teams.length && !selTeam) setSelTeam(teams[0]);
  }, [teams.length]);

  useEffect(() => { setSelPitcher("all"); }, [selTeam]);

  if (!teams.length) return (
    <div style={{ ...cd, textAlign: "center", padding: 50 }}>
      <div style={{ fontSize: 14, color: G.tx3 }}>No opponent data yet.</div>
      <div style={{ fontSize: 12, color: G.tx3, marginTop: 8 }}>Chart games to build team profiles.</div>
    </div>
  );

  const team = selTeam ? activeMap[selTeam] : null;

  // For Elite, when a specific pitcher is selected, use cross-team global data
  const viewPitches = team ? (
    selPitcher === "all"
      ? Object.values(team.pitchers).flatMap(v => v.pitches)
      : isElite && globalPitcherMap[selPitcher]
        ? globalPitcherMap[selPitcher].pitches
        : (team.pitchers[selPitcher]?.pitches || [])
  ) : [];

  // pitcherNames: array of canonical keys, sorted by pitch count descending
  const pitcherNames = team ? Object.keys(team.pitchers).sort((a, b) =>
    (team.pitchers[b].pitches.length) - (team.pitchers[a].pitches.length)
  ) : [];

  // Helper: display name for a pitcher key
  const getPitcherDisplay = (key) =>
    team?.pitchers[key]?.displayName || globalPitcherMap[key]?.displayName || key;

  // Compute RISP data before render
  const rispSituations = [
    { label: "Bases Loaded", filter: p => p.runners && p.runners.first && p.runners.second && p.runners.third },
    { label: "1B & 2B",      filter: p => p.runners && p.runners.first && p.runners.second && !p.runners.third },
    { label: "1B & 3B",      filter: p => p.runners && p.runners.first && !p.runners.second && p.runners.third },
    { label: "2B & 3B",      filter: p => p.runners && !p.runners.first && p.runners.second && p.runners.third },
    { label: "2B only",      filter: p => p.runners && !p.runners.first && p.runners.second && !p.runners.third },
    { label: "3B only",      filter: p => p.runners && !p.runners.first && !p.runners.second && p.runners.third },
  ];
  const rispData = viewPitches.length > 0 ? rispSituations.map(s => {
    const pitches = viewPitches.filter(s.filter);
    if (pitches.length < 2) return null;
    const freq = {};
    pitches.forEach(p => { freq[p.type] = (freq[p.type] || 0) + 1; });
    return { label: s.label, freq, total: pitches.length };
  }).filter(Boolean) : [];
    { label: "Bases Loaded", filter: p => p.runners && p.runners.first && p.runners.second && p.runners.third },
    { label: "1B & 2B",      filter: p => p.runners && p.runners.first && p.runners.second && !p.runners.third },
    { label: "1B & 3B",      filter: p => p.runners && p.runners.first && !p.runners.second && p.runners.third },
    { label: "2B & 3B",      filter: p => p.runners && !p.runners.first && p.runners.second && p.runners.third },
    { label: "2B only",      filter: p => p.runners && !p.runners.first && p.runners.second && !p.runners.third },
    { label: "3B only",      filter: p => p.runners && !p.runners.first && !p.runners.second && p.runners.third },
  ];
  const rispData = viewPitches.length > 0 ? rispSituations.map(s => {
    const pitches = viewPitches.filter(s.filter);
    if (pitches.length < 2) return null;
    const freq = {};
    pitches.forEach(p => { freq[p.type] = (freq[p.type] || 0) + 1; });
    return { label: s.label, freq, total: pitches.length };
  }).filter(Boolean) : [];

  const t = viewPitches.length > 0 ? analyze(viewPitches) : null;
  const mkB = (ty, tot) => tot ? Object.entries(ty).map(([t, c]) => ({ type: t, count: c, pct: +((c / tot) * 100).toFixed(1) })).sort((a, b) => b.count - a.count) : [];

  // Check if this opponent has multiple games (for upgrade nudge)
  const totalGamesForTeam = teamMap[selTeam]?.games.length || 0;

  return (
    <div>
      {/* Pro upgrade nudge — shown when opponent has multiple games */}
      {!isElite && totalGamesForTeam > 1 && (
        <div style={{ marginBottom: 10, padding: "10px 14px", background: G.gold + "12", borderRadius: 8, border: "1px solid " + G.gold + "33", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: G.gold, letterSpacing: 0.5 }}>
              🔒 {totalGamesForTeam} games charted against {selTeam}
            </div>
            <div style={{ fontSize: 10, color: G.tx3, marginTop: 2 }}>
              Upgrade to Elite to see combined tendencies across all {totalGamesForTeam} appearances
            </div>
          </div>
          <div style={{ fontSize: 10, color: G.gold, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>Elite →</div>
        </div>
      )}

      {/* Pro single-game notice */}
      {!isElite && (
        <div style={{ marginBottom: 8, padding: "6px 12px", background: G.sf2, borderRadius: 6, border: "1px solid " + G.bd }}>
          <span style={{ fontSize: 10, color: G.tx3, fontWeight: 700 }}>
            SHOWING: Most recent game only — Elite aggregates across all appearances
          </span>
        </div>
      )}
      {/* Team selector */}
      <div style={{ ...cd, marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 2 }}>OPPONENT</div>
          {selTeam && viewPitches.length > 0 && <button onClick={() => setShowPrint(true)}
            style={{ padding: "5px 12px", background: "transparent", border: "1px solid " + G.bd2, borderRadius: 6, color: G.tx3, fontSize: 10, fontWeight: 800, cursor: "pointer", fontFamily: "'Azeret Mono',monospace", letterSpacing: 1 }}>
            🖨 Print Report
          </button>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {teams.map(t => (
            <button key={t} onClick={() => setSelTeam(t)}
              style={{ ...btn(selTeam === t ? "p" : "g"), display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span>{t}</span>
              <span style={{ fontSize: 9, color: selTeam === t ? "#000" : G.tx3, fontWeight: 700 }}>
                {isElite ? `${teamMap[t].games.length}G` : "1G"} · {Object.keys(activeMap[t].pitchers).length}P
                {!isElite && teamMap[t].games.length > 1 ? ` (${teamMap[t].games.length} total 🔒)` : ""}
              </span>
            </button>
          ))}
        </div>
      </div>

      {team && (
        <>
          {/* Pitcher filter */}
          <div style={{ ...cd, marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>VIEW</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => setSelPitcher("all")}
                style={{ ...btn(selPitcher === "all" ? "p" : "g"), display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <span>Staff Overview</span>
                <span style={{ fontSize: 9, color: selPitcher === "all" ? "#000" : G.tx3, fontWeight: 700 }}>
                  {Object.values(team.pitchers).reduce((s, v) => s + v.pitches.length, 0)} pitches
                </span>
              </button>
              {pitcherNames.map(key => {
                const dispName = getPitcherDisplay(key);
                const totalPitches = isElite && globalPitcherMap[key]
                  ? globalPitcherMap[key].pitches.length
                  : team.pitchers[key].pitches.length;
                const totalGames = isElite && globalPitcherMap[key]
                  ? globalPitcherMap[key].gameIds.size
                  : new Set(games.filter(g => g.opponent === selTeam && g.pitches.some(p => pitcherKey(p.pitcher || g.pitcher) === key)).map(g => g.id)).size;
                const crossTeam = isElite && globalPitcherMap[key] && globalPitcherMap[key].gameIds.size > (team.pitchers[key]?.pitches.length > 0 ? new Set(games.filter(g => g.opponent === selTeam && g.pitches.some(p => pitcherKey(p.pitcher || g.pitcher) === key)).map(g => g.id)).size : 0);
                return (
                  <button key={key} onClick={() => setSelPitcher(key)}
                    style={{ ...btn(selPitcher === key ? "p" : "g"), display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span>{dispName}</span>
                    <span style={{ fontSize: 9, color: selPitcher === key ? "#000" : G.tx3, fontWeight: 700 }}>
                      {totalPitches}p · {totalGames}G{isElite && globalPitcherMap[key]?.gameIds.size > 1 && team.pitchers[key] ? " · all teams" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats header */}
          {t && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8, marginBottom: 12 }}>
                {[
                  { v: selPitcher === "all" ? team.games.length : (isElite && globalPitcherMap[selPitcher] ? globalPitcherMap[selPitcher].gameIds.size : new Set(games.filter(g => g.pitches.some(p => pitcherKey(p.pitcher || g.pitcher) === selPitcher)).map(g => g.id)).size), l: "Games" },
                  { v: pitcherNames.length, l: "Pitchers" },
                  { v: viewPitches.length, l: selPitcher === "all" ? "Staff Pitches" : "Pitches" },
                  { v: t.mix[0]?.type || "-", l: "Primary Pitch" },
                  { v: t.mix[0] ? t.mix[0].pct + "%" : "-", l: "Primary %" },
                ].map((s, i) => (
                  <div key={i} style={{ ...cd, textAlign: "center", marginBottom: 0, padding: 12 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: G.gold }}>{s.v}</div>
                    <div style={{ fontSize: 9, color: G.tx3, letterSpacing: 1, textTransform: "uppercase", marginTop: 4, fontWeight: 700 }}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Games breakdown for this pitcher — Elite shows across all teams */}
              {selPitcher !== "all" && (
                <div style={{ ...cd, marginBottom: 8 }}>
                  <div style={cT}>Appearances{isElite && globalPitcherMap[selPitcher]?.gameIds.size > 1 ? " — All Teams" : ""}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(isElite
                      ? games.filter(g => g.pitches.some(p => pitcherKey(p.pitcher || g.pitcher) === selPitcher))
                      : games.filter(g => g.opponent === selTeam && g.pitches.some(p => pitcherKey(p.pitcher || g.pitcher) === selPitcher))
                    ).sort((a, b) => new Date(b.date) - new Date(a.date))
                      .map(g => {
                        const gPitches = g.pitches.filter(p => pitcherKey(p.pitcher || g.pitcher) === selPitcher && !EVENTS.has(p.type));
                        return (
                          <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: G.sf2, borderRadius: 6, border: "1px solid " + G.bd }}>
                            <div style={{ fontSize: 12, color: G.tx, fontWeight: 700 }}>
                              {g.date || "No date"}
                              {isElite && <span style={{ marginLeft: 6, fontSize: 10, color: G.tx3 }}>vs {g.opponent}</span>}
                            </div>
                            <div style={{ fontSize: 11, color: G.tx3 }}>{gPitches.length} pitches</div>
                            <div style={{ fontSize: 11, color: G.gold, fontFamily: "'Azeret Mono',monospace", fontWeight: 700 }}>
                              {gPitches.length > 0 ? (
                                Object.entries(
                                  gPitches.reduce((acc, p) => { acc[p.type] = (acc[p.type] || 0) + 1; return acc; }, {})
                                ).sort((a, b) => b[1] - a[1]).slice(0, 2)
                                  .map(([type, count]) => `${type} ${Math.round(count / gPitches.length * 100)}%`)
                                  .join(" · ")
                              ) : "—"}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div style={cd}><div style={cT}>Pitch Mix {selPitcher !== "all" ? `— ${getPitcherDisplay(selPitcher)}` : "— Staff"}</div><Bar data={t.mix} /></div>
              {t.fpN > 0 && <div style={cd}><div style={cT}>First Pitch ({t.fpN})</div><Bar data={mkB(t.fpT, t.fpN)} /></div>}
              {t.tsN > 0 && <div style={cd}><div style={cT}>Two-Strike ({t.tsN})</div><Bar data={mkB(t.tsT, t.tsN)} /></div>}
              {t.bhN > 0 && <div style={cd}><div style={cT}>Behind ({t.bhN})</div><Bar data={mkB(t.bhT, t.bhN)} /></div>}
              {t.vLN > 0 && <div style={cd}><div style={cT}>vs LHB ({t.vLN})</div><Bar data={mkB(t.vLT, t.vLN)} /></div>}
              {t.vRN > 0 && <div style={cd}><div style={cT}>vs RHB ({t.vRN})</div><Bar data={mkB(t.vRT, t.vRN)} /></div>}

              {/* ── RUNNERS IN SCORING POSITION ── */}
              {rispData.length > 0 && (
                <div style={cd}>
                  <div style={cT}>Runners in Scoring Position</div>
                  {rispData.map(({ label, freq, total }) => (
                    <div key={label} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: G.tx3, fontWeight: 800, marginBottom: 4 }}>
                        {label} <span style={{ color: G.tx3, fontWeight: 400 }}>({total} pitch{total !== 1 ? "es" : ""})</span>
                      </div>
                      <Bar data={mkB(freq, total)} />
                    </div>
                  ))}
                </div>
              )}
              {Object.keys(t.tto).length > 0 && (
                <div style={cd}>
                  <div style={cT}>Times Through Order</div>
                  {Object.entries(t.tto).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([k, ty]) => {
                    const tot = Object.values(ty).reduce((a, b) => a + b, 0);
                    return (
                      <div key={k} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: G.tx3, fontWeight: 800, marginBottom: 4 }}>
                          {k === "1" ? "1st" : k === "2" ? "2nd" : k === "3" ? "3rd" : k + "th"} ({tot})
                        </div>
                        <Bar data={mkB(ty, tot)} />
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ ...cd, border: "2px solid " + G.gold + "44" }}>
                <div style={cT}>Report — {selPitcher === "all" ? selTeam + " Staff" : getPitcherDisplay(selPitcher)}</div>
                <ScoutNotes t={t} pitches={viewPitches} name={selPitcher === "all" ? selTeam + " Staff" : getPitcherDisplay(selPitcher)} />
              </div>

              {showPrint && (
                <PrintReport
                  type="library"
                  data={{ name: selPitcher === "all" ? selTeam + " Staff" : getPitcherDisplay(selPitcher), t, pitches: viewPitches, viewPitches, selTeam, isStaff: selPitcher === "all", rispData }}
                  onClose={() => setShowPrint(false)}
                />
              )}
            </>
          )}
          {!t && (
            <div style={{ ...cd, textAlign: "center", padding: 30 }}>
              <div style={{ fontSize: 13, color: G.tx3 }}>No pitch data for this selection.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* --- GAME LIST --- */
function PitchingTendencies({ games, tier, activeGame, activePitcher, scoutingNotes = {}, onSaveNote }) {
  const [sub, setSub] = useState("analyzer");
  const [noteText, setNoteText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  const tb = (id, label) => (
    <button onClick={() => setSub(id)}
      style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none",
        background: sub === id ? G.gold : G.sf2, color: sub === id ? "#000" : G.tx2,
        fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "'Anybody',sans-serif" }}>
      {label}
    </button>
  );

  const activeTeam = activeGame ? activeGame.opponent : (games.length > 0 ? games[0].opponent : null);
  const teamNotes = activeTeam ? (scoutingNotes[activeTeam] || []) : [];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {tb("analyzer", "Analyzer")}
        {tb("report", "Scouting Report")}
      </div>
      {sub === "report"
        ? (<>
            <Library games={games} tier={tier} />
            {activeTeam && (
              <div style={cd}>
                <div style={cT}>📝 Scout Notes — {activeTeam}</div>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder={"Add a note about " + activeTeam + " or their pitchers..."}
                  style={{ width: "100%", minHeight: 70, background: G.sf2, border: "1px solid " + G.bd2, borderRadius: 8, padding: 10, color: G.tx, fontSize: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }}
                />
                <button
                  onClick={() => {
                    if (!noteText.trim() || !onSaveNote) return;
                    onSaveNote(activeTeam, noteText.trim());
                    setNoteText("");
                  }}
                  style={{ ...btn("p"), fontSize: 12, padding: "8px 18px", marginBottom: 14 }}>
                  + Add Note
                </button>
                {teamNotes.length === 0 && (
                  <div style={{ fontSize: 12, color: G.tx3, fontStyle: "italic" }}>No notes yet for {activeTeam}. Add observations above or tap 📝 during a game.</div>
                )}
                {[...teamNotes].reverse().map(n => (
                  <div key={n.id} style={{ background: G.sf2, border: "1px solid " + G.bd2, borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                    {editId === n.id ? (
                      <div>
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          style={{ width: "100%", minHeight: 60, background: G.sf, border: "1px solid " + G.gold + "55", borderRadius: 6, padding: 8, color: G.tx, fontSize: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button onClick={() => {
                            if (editText.trim() && onSaveNote) onSaveNote(activeTeam, editText.trim(), n.id);
                            setEditId(null); setEditText("");
                          }} style={{ ...btn("p"), fontSize: 11, padding: "5px 12px" }}>Save</button>
                          <button onClick={() => { setEditId(null); setEditText(""); }} style={{ ...btn("g"), fontSize: 11, padding: "5px 12px" }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ fontSize: 13, color: G.tx, lineHeight: 1.5, flex: 1 }}>{n.text}</div>
                        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                          <button onClick={() => { setEditId(n.id); setEditText(n.text); }} style={{ ...btn("g"), fontSize: 10, padding: "4px 8px", color: G.tx3 }}>Edit</button>
                          <button onClick={() => { if (onSaveNote) onSaveNote(activeTeam, null, n.id, true); }} style={{ ...btn("g"), fontSize: 10, padding: "4px 8px", color: G.red }}>Delete</button>
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: G.tx3, marginTop: 6 }}>{new Date(n.ts).toLocaleDateString()} {new Date(n.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                ))}
              </div>
            )}
          </>)
        : <CountBD games={games} allGames={games} tier={tier} activeGame={activeGame} activePitcher={activePitcher} section="pitching" />}
    </div>
  );
}


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
          <div style={{ fontSize: 14, fontWeight: 800, color: G.tx, marginBottom: 8 }}>⚾ Hitting</div>
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
      <span style={{ fontSize: 10, color: G.tx3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Filter HH</span>
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
              <th key={c.key} title={c.tip || c.label} onClick={() => clickSort(c.key)} style={{ padding: "7px 6px", textAlign: c.nm ? "left" : "center", cursor: "pointer", fontSize: 10, fontWeight: 800, color: sortKey === c.key ? G.gold : G.tx3, whiteSpace: "nowrap", borderBottom: "1px solid " + G.bd2, letterSpacing: 0.5, textTransform: "uppercase" }}>
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
            <div onClick={e => e.stopPropagation()} style={{ background: G.sf, border: "1px solid " + G.bd, borderRadius: 12, padding: 20, width: "100%", maxWidth: 560, margin: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: G.tx }}>{popName}</div>
                <button onClick={() => setPopName(null)} style={{ ...btn("g"), fontSize: 12, padding: "6px 10px" }}>Close</button>
              </div>
              <div style={{ fontSize: 12, color: G.tx3, marginBottom: 12 }}>QAB <span style={{ color: G.gold, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{fmtAvg(oQab)}</span> · HH <span style={{ color: G.tx, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{fmtAvg(oHH)}</span> <span style={{ opacity: 0.7 }}>(all situations)</span></div>
              <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>QAB types (all situations)</div>
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
              <div style={{ fontSize: 9, color: G.tx3, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{({ hh: "Hard-hit avg", whiff: "Whiff %", chase: "Chase %", take: "Take %" })[popMetric]} by zone{popActive ? " (filtered)" : ""}</div>
              <div style={{ marginBottom: 12 }}>{filterRow(popF, (k, v) => setPopF(f => ({ ...f, [k]: v })))}</div>
              {popMetric === "hh" ? renderHeat(popAbs) : renderDiscHeat(abs, popMetric, popF)}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

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

function GList({ games, onSelect, onCreate, onDelete, onImport, onExport, onExportCSV, warnNoBackup, title = "Games" }) {
  const [delId, setDelId] = useState(null);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: G.tx3, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800 }}>{title} ({games.length})</div>
        {onCreate && <button onClick={onCreate} style={btn("p")}>+ New Game</button>}
        {onImport && <><input id="csvimp" type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => { const f = e.target.files[0]; if (f) onImport(f); e.target.value = ""; }} /><button onClick={() => { const el = document.getElementById("csvimp"); if (el) el.click(); }} style={{ ...btn("g"), marginLeft: 8 }} title="Import a pitch-level CSV (headers: type, location, result; optional balls, strikes, outs, batSide, inning, pitcher)">Import CSV</button></>}
      </div>
      {warnNoBackup && games.length > 0 && (
        <div style={{ ...cd, padding: "10px 14px", marginBottom: 12, background: "#ff993315", border: "1px solid #ff993355", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚠</span>
          <div style={{ fontSize: 12, color: G.tx2, lineHeight: 1.5 }}>Your data is only on this device. Export a backup from <b>Settings → Data & Backup</b>, or the <b>↑</b> button on a game, so you don't lose it if your browser data is cleared.</div>
        </div>
      )}
      {!games.length && (
        <div style={{ ...cd, textAlign: "center", padding: "40px 20px", borderStyle: "dashed" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <svg width="64" height="78" viewBox="0 0 112 124">
              <path d="M4,4 L108,4 L108,76 L56,120 L4,76 Z" fill="#FFD700"/>
              <polygon points="12,108 30,108 56,16 40,16" fill="#000"/>
              <polygon points="100,108 82,108 56,16 72,16" fill="#000"/>
              <rect x="34" y="72" width="44" height="16" fill="#FFD700"/>
              <polygon points="34,88 42,88 36,72 34,72" fill="#000"/>
              <polygon points="78,88 70,88 76,72 78,72" fill="#000"/>
              <rect x="8" y="100" width="28" height="12" rx="1" fill="#000"/>
              <rect x="76" y="100" width="28" height="12" rx="1" fill="#000"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            <span style={{ color: "#fff" }}>Arm</span><span style={{ color: "#ffd700" }}>Sight</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#888" }}>No games yet</div>
        </div>
      )}
      {games.map(g => (
        <div key={g.id} style={{ ...cd, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "14px 16px" }} onClick={() => onSelect(g.id)}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>
              <span style={{ color: G.gold }}>vs {g.opponent}</span>
              <span style={{ color: G.tx2, fontSize: 12, marginLeft: 6 }}>{g.pitcher}</span>
              {g.status === "complete" && <span style={{ marginLeft: 6, background: G.grn + "22", color: G.grn, borderRadius: 3, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>FINAL</span>}
              {g.pregame && <span style={{ marginLeft: 6, background: "#9b59ff22", color: "#b794ff", borderRadius: 3, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>PREGAME</span>}
            </div>
            <div style={{ fontSize: 11, color: G.tx3, marginTop: 2 }}>{g.pitches.length} pitches - {g.date}{g.pregame && g.faced ? " · vs " + g.faced : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={e => { e.stopPropagation(); onSelect(g.id); }} style={{ ...btn("g"), padding: "6px 12px", fontSize: 11 }}>Chart</button>
            {onExport && <button onClick={e => { e.stopPropagation(); onExport(g); }} title="Export this game as a .json backup file" style={{ ...btn("g"), padding: "6px 10px", fontSize: 11, color: G.blu }}>↑</button>}
            {onExportCSV && <button onClick={e => { e.stopPropagation(); onExportCSV(g); }} title="Export this game as a .csv (opens in Excel, re-importable)" style={{ ...btn("g"), padding: "6px 10px", fontSize: 11, color: G.grn }}>CSV</button>}
            {delId === g.id ? (
              <>
                <button onClick={e => { e.stopPropagation(); onDelete(g.id); setDelId(null); }} style={{ ...btn("d"), padding: "6px 12px", fontSize: 11 }}>Delete</button>
                <button onClick={e => { e.stopPropagation(); setDelId(null); }} style={{ ...btn("g"), padding: "6px 12px", fontSize: 11 }}>Keep</button>
              </>
            ) : (
              <button onClick={e => { e.stopPropagation(); setDelId(g.id); }} style={{ ...btn("g"), padding: "6px 10px", fontSize: 11, color: G.red }}>X</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* --- FIREBASE AUTH SCREEN (Elite only) --- */
function FirebaseAuth({ onSignedIn }) {
  const [mode, setMode]       = useState("login"); // login | signup | reset
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [err, setErr]         = useState("");
  const [msg, setMsg]         = useState("");
  const [loading, setLoading] = useState(false);

  const is = { background: G.sf2, border: "2px solid " + G.bd2, borderRadius: 6, padding: "12px 14px", color: G.tx, fontSize: 15, outline: "none", width: "100%", marginBottom: 10 };

  const handleAuth = async () => {
    setErr(""); setMsg(""); setLoading(true);
    const { auth } = getFB();
    if (!auth) { setErr("Connection error. Check your internet."); setLoading(false); return; }
    try {
      if (mode === "login") {
        const cred = await auth.signInWithEmailAndPassword(email, pass);
        onSignedIn(cred.user.uid, cred.user.email);
      } else if (mode === "signup") {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        onSignedIn(cred.user.uid, cred.user.email);
      } else if (mode === "reset") {
        await auth.sendPasswordResetEmail(email);
        setMsg("Reset email sent — check your inbox.");
      }
    } catch(e) {
      const msgs = {
        "auth/user-not-found": "No account found with that email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/email-already-in-use": "An account already exists with that email.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/invalid-email": "Please enter a valid email address.",
      };
      setErr(msgs[e.code] || e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ ...cd, border: "2px solid " + G.bd2, maxWidth: 380, margin: "0 auto" }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: G.gold, marginBottom: 4 }}>
        {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Reset Password"}
        <span style={{ marginLeft: 8, background: "#00ccff22", color: "#00ccff", borderRadius: 3, padding: "2px 7px", fontSize: 9, fontWeight: 800 }}>ELITE</span>
      </div>
      <div style={{ fontSize: 11, color: G.tx3, marginBottom: 16 }}>
        {mode === "login" ? "Sign in to sync your games across devices." : mode === "signup" ? "Create your ArmSight Elite account." : "Enter your email to receive a reset link."}
      </div>
      <input style={is} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
      {mode !== "reset" && <input style={is} type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />}
      {err && <div style={{ fontSize: 12, color: G.red, marginBottom: 8 }}>{err}</div>}
      {msg && <div style={{ fontSize: 12, color: G.grn, marginBottom: 8 }}>{msg}</div>}
      <button onClick={handleAuth} disabled={loading || !email}
        style={{ ...btn("p", loading || !email), width: "100%", padding: 12, fontSize: 14, marginBottom: 10 }}>
        {loading ? "Please wait..." : mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Email"}
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
        {mode === "login" && <button onClick={() => { setMode("signup"); setErr(""); }} style={{ background: "transparent", border: "none", color: G.gold, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Create account</button>}
        {mode === "signup" && <button onClick={() => { setMode("login"); setErr(""); }} style={{ background: "transparent", border: "none", color: G.gold, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Back to sign in</button>}
        {mode !== "reset" && <button onClick={() => { setMode("reset"); setErr(""); }} style={{ background: "transparent", border: "none", color: G.tx3, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Forgot password?</button>}
        {mode === "reset" && <button onClick={() => { setMode("login"); setErr(""); setMsg(""); }} style={{ background: "transparent", border: "none", color: G.gold, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Back to sign in</button>}
      </div>
    </div>
  );
}

/* --- LICENSE GATE --- */
function LicenseGate({ onUnlock }) {
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(false);

  const tryKey = async () => {
    setErr("");
    setChecking(true);
    const localTier = validateKey(key);
    if (!localTier) {
      setTimeout(() => { setChecking(false); setErr("Invalid license key. Check your key and try again, or contact coach@armsight.app"); }, 400);
      return;
    }
    // Format is plausible \u2014 ask the license server. Offline/unreachable falls back to
    // the local tier (grace); the App-level recheck verifies once a connection exists.
    const sv = await serverValidateKey(key);
    setChecking(false);
    if (sv.status === "invalid") {
      setErr("That key isn't in our records. Double-check it, or contact coach@armsight.app");
      return;
    }
    const tier = sv.status === "valid" ? sv.tier : localTier;
    if (sv.status === "valid") { try { localStorage.setItem(LIC_CHECK_KEY, JSON.stringify({ key: key.trim().toUpperCase(), tier, ts: Date.now() })); } catch (e) {} }
    saveLicense(key);
    onUnlock(key.trim().toUpperCase(), tier);
  };

  const is = { background: G.sf2, border: "2px solid " + G.bd2, borderRadius: 6, padding: "12px 14px", color: G.tx, fontSize: 16, fontWeight: 700, outline: "none", width: "100%", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Azeret Mono',monospace" };

  return (
    <div style={{ minHeight: "100vh", background: G.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <svg width="72" height="88" viewBox="0 0 112 124">
            <path d="M4,4 L108,4 L108,76 L56,120 L4,76 Z" fill="#FFD700"/>
            <polygon points="12,108 30,108 56,16 40,16" fill="#000"/>
            <polygon points="100,108 82,108 56,16 72,16" fill="#000"/>
            <rect x="34" y="72" width="44" height="16" fill="#FFD700"/>
            <polygon points="34,88 42,88 36,72 34,72" fill="#000"/>
            <polygon points="78,88 70,88 76,72 78,72" fill="#000"/>
            <rect x="8" y="100" width="28" height="12" rx="1" fill="#000"/>
            <rect x="76" y="100" width="28" height="12" rx="1" fill="#000"/>
          </svg>
        </div>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 0.5, marginBottom: 4 }}>
            <span style={{ color: G.tx }}>Arm</span><span style={{ color: G.gold }}>Sight</span>
          </div>
          <div style={{ fontSize: 10, color: G.tx3, letterSpacing: 3, textTransform: "uppercase", fontWeight: 700 }}>Pitcher Intelligence</div>
        </div>
        <div style={{ ...cd, border: "2px solid " + G.bd2 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: G.tx, marginBottom: 4 }}>Enter Your License Key</div>
          <div style={{ fontSize: 12, color: G.tx3, marginBottom: 16 }}>Your key was emailed when you purchased. Format: AS-PRO-0001</div>
          <input
            style={is}
            value={key}
            onChange={e => { setKey(e.target.value.toUpperCase()); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && tryKey()}
            placeholder="AS-XXX-0000"
            autoFocus
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          {err && <div style={{ fontSize: 12, color: G.red, marginTop: 8, fontWeight: 600 }}>{err}</div>}
          <button onClick={tryKey} disabled={!key.trim() || checking}
            style={{ ...btn("p", !key.trim() || checking), width: "100%", marginTop: 12, padding: 14, fontSize: 15 }}>
            {checking ? "Checking..." : "Unlock App →"}
          </button>
          <div style={{ marginTop: 16, fontSize: 11, color: G.tx3, textAlign: "center" }}>
            Don't have a key? <a href="mailto:coach@armsight.app" style={{ color: G.gold, textDecoration: "none" }}>Contact us →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- SETTINGS PANEL --- */
function RosterManager({ roster = [], onSave, onClose }) {
  const [list, setList] = useState(roster.length ? roster : []);
  const [num, setNum] = useState("");
  const [name, setName] = useState("");
  const [bats, setBats] = useState("R");
  const add = () => {
    if (!name.trim()) return;
    setList(prev => [...prev, { id: Date.now() + Math.random(), num: num.trim(), name: name.trim(), bats }]);
    setNum(""); setName(""); setBats("R");
  };
  const upd = (id, field, val) => setList(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  const del = (id) => setList(prev => prev.filter(p => p.id !== id));
  const save = () => { onSave(list); onClose(); };
  const is = { background: G.sf2, border: "2px solid " + G.bd2, borderRadius: 6, padding: "8px 10px", color: G.tx, fontSize: 13, outline: "none" };
  const batBtn = (val, cur, set) => (
    <button onClick={() => set(val)} style={{ padding: "7px 11px", borderRadius: 5, border: "none", background: cur === val ? G.gold : G.sf2, color: cur === val ? "#000" : G.tx2, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{val}</button>
  );
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, paddingTop: 70, overflowY: "auto" }}>
      <div style={{ background: G.bg, border: "1px solid " + G.bd2, borderRadius: 14, padding: 18, maxWidth: 460, width: "100%", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, position: "sticky", top: 0, background: G.bg, paddingBottom: 8, zIndex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: G.tx }}>Team Roster</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={save} style={{ ...btn("g"), fontSize: 12, padding: "6px 14px", color: G.gold, fontWeight: 800 }}>Save</button>
            <button onClick={onClose} style={{ ...btn("g"), fontSize: 12, padding: "6px 10px", color: G.tx3 }}>Close</button>
          </div>
        </div>
        <div style={{ fontSize: 10, color: G.tx3, marginBottom: 12, lineHeight: 1.5 }}>Add your players once — number, name, and bat side (R / L / B for switch). Pick them into each game’s lineup instead of retyping. A switch hitter auto-bats opposite the pitcher you’re facing.</div>

        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
          <input value={num} onChange={e => setNum(e.target.value)} placeholder="#" style={{ ...is, width: 42, textAlign: "center" }} />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Player name" style={{ ...is, flex: 1 }} onKeyDown={e => { if (e.key === "Enter") add(); }} />
          <div style={{ display: "flex", gap: 3 }}>{batBtn("R", bats, setBats)}{batBtn("L", bats, setBats)}{batBtn("B", bats, setBats)}</div>
          <button onClick={add} style={{ ...btn("g"), padding: "8px 12px", color: G.grn, fontWeight: 800 }}>+</button>
        </div>

        {list.length === 0 ? (
          <div style={{ fontSize: 12, color: G.tx3, textAlign: "center", padding: "16px 0" }}>No players yet. Add your roster above.</div>
        ) : list.sort((a, b) => (parseInt(a.num) || 99) - (parseInt(b.num) || 99)).map(p => (
          <div key={p.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
            <input value={p.num} onChange={e => upd(p.id, "num", e.target.value)} style={{ ...is, width: 42, textAlign: "center", fontFamily: "'Azeret Mono',monospace" }} />
            <input value={p.name} onChange={e => upd(p.id, "name", e.target.value)} style={{ ...is, flex: 1 }} />
            <div style={{ display: "flex", gap: 3 }}>{batBtn("R", p.bats, v => upd(p.id, "bats", v))}{batBtn("L", p.bats, v => upd(p.id, "bats", v))}{batBtn("B", p.bats, v => upd(p.id, "bats", v))}</div>
            <button onClick={() => del(p.id)} style={{ ...btn("g"), padding: "7px 9px", color: G.red }}>×</button>
          </div>
        ))}
        <button onClick={save} style={{ ...btn("g"), width: "100%", marginTop: 14, padding: 11, fontSize: 14, fontWeight: 800, color: G.gold, border: "2px solid " + G.gold + "55" }}>Save Roster</button>
      </div>
    </div>
  );
}

function SettingsPanel({ licKey, tier, onClose, onClearKey, fbUser, onFbSignOut, onShowFbAuth, prefs = {}, onSavePrefs, data, onRestore, onManageRoster }) {
  const [newKey, setNewKey] = useState("");
  const [msg, setMsg]       = useState("");
  const [err, setErr]       = useState("");
  const enableQAB = prefs.enableQAB !== false;

  const upgradeKey = () => {
    const t = validateKey(newKey);
    if (!t) { setErr("Invalid key — check and try again."); return; }
    saveLicense(newKey);
    setMsg("Key updated! Reloading...");
    setTimeout(() => window.location.reload(), 1000);
  };

  const is = { background: G.sf2, border: "1px solid " + G.bd2, borderRadius: 6, padding: "10px 12px", color: G.tx, fontSize: 14, fontWeight: 700, outline: "none", width: "100%", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Azeret Mono',monospace" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ ...cd, border: "2px solid " + G.bd2, position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: "transparent", border: "none", color: G.tx3, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>✕</button>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>⚙ Settings</div>

          <div style={{ marginBottom: 16, padding: "12px 14px", background: G.sf2, borderRadius: 8, border: "1px solid " + G.bd }}>
            <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Current License</div>
            <div style={{ fontFamily: "'Azeret Mono',monospace", fontSize: 15, fontWeight: 700, color: G.gold, letterSpacing: 2, marginBottom: 4 }}>{licKey}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ background: TIER_COLOR[tier] || G.tx3, color: "#000", borderRadius: 3, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>{getTierLabel(tier)}</span>
              <span style={{ fontSize: 11, color: G.tx3 }}>tier active</span>
            </div>
          </div>

          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: G.tx3, fontWeight: 800, marginBottom: 6 }}>UPGRADE / CHANGE KEY</div>
            <input style={is} value={newKey} onChange={e => { setNewKey(e.target.value.toUpperCase()); setErr(""); setMsg(""); }}
              placeholder="AS-XXX-0000" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
            {err && <div style={{ fontSize: 11, color: G.red, marginTop: 4 }}>{err}</div>}
            {msg && <div style={{ fontSize: 11, color: G.grn, marginTop: 4 }}>{msg}</div>}
            <button onClick={upgradeKey} disabled={!newKey.trim()}
              style={{ ...btn("p", !newKey.trim()), width: "100%", marginTop: 8, padding: 11, fontSize: 13 }}>
              Apply New Key
            </button>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: G.tx3, fontWeight: 800, marginBottom: 6 }}>TEAM</div>
            <button onClick={onManageRoster} style={{ ...btn("g"), width: "100%", padding: 10, fontSize: 13, marginBottom: 14, color: G.gold }}>Manage Team Roster</button>
            <div style={{ fontSize: 11, color: G.tx3, fontWeight: 800, marginBottom: 6 }}>DATA & BACKUP</div>
            <div style={{ fontSize: 11, color: G.tx3, marginBottom: 8, lineHeight: 1.5 }}>
              {tier === "elite" && fbUser ? "Your games are synced to the cloud. A local backup file is still a good idea." : "Your data lives only on this device. Download a backup regularly \u2014 clearing your browser data erases everything otherwise."}
            </div>
            <button onClick={() => exportAll(data)} style={{ ...btn("g"), width: "100%", padding: 10, fontSize: 13, marginBottom: 8 }}>↓ Export all data (backup)</button>
            <button onClick={() => exportAllCSV(data)} style={{ ...btn("g"), width: "100%", padding: 10, fontSize: 13, marginBottom: 8, color: G.grn }}>↓ Export all games as CSV (spreadsheet)</button>
            <input id="bkprestore" type="file" accept=".json,application/json" style={{ display: "none" }} onChange={e => { const f = e.target.files[0]; if (f) onRestore(f); e.target.value = ""; }} />
            <button onClick={() => { const el = document.getElementById("bkprestore"); if (el) el.click(); }} style={{ ...btn("g"), width: "100%", padding: 10, fontSize: 13 }}>↑ Restore from backup</button>
          </div>

          {tier === "elite" && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: G.tx3, fontWeight: 800, marginBottom: 6 }}>CLOUD SYNC</div>
              {fbUser ? (
                <div style={{ background: G.sf2, borderRadius: 6, padding: "10px 12px", border: "1px solid " + G.bd }}>
                  <div style={{ fontSize: 11, color: G.grn, fontWeight: 800, marginBottom: 2 }}>● Synced</div>
                  <div style={{ fontSize: 11, color: G.tx3, marginBottom: 8 }}>{fbUser.email}</div>
                  <button onClick={onFbSignOut} style={{ ...btn("g"), fontSize: 11, padding: "6px 10px", color: G.red }}>Sign Out of Cloud</button>
                </div>
              ) : (
                <div style={{ background: G.sf2, borderRadius: 6, padding: "10px 12px", border: "1px solid " + G.bd }}>
                  <div style={{ fontSize: 11, color: G.tx3, marginBottom: 8 }}>Sign in to sync games across devices.</div>
                  <button onClick={onShowFbAuth} style={{ ...btn("p"), fontSize: 11, padding: "6px 10px", width: "100%" }}>Sign In / Create Account</button>
                </div>
              )}
            </div>
          )}
          <div style={{ borderTop: "1px solid " + G.bd, paddingTop: 14, marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: G.tx }}>QAB &amp; Hard Hit Tracking</div>
                <div style={{ fontSize: 10, color: G.tx3, marginTop: 2 }}>Show tagging panel after contact results</div>
              </div>
              <button onClick={() => onSavePrefs && onSavePrefs({ enableQAB: !enableQAB })}
                style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                  background: enableQAB ? G.gold : G.bd2, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute",
                  top: 3, left: enableQAB ? 23 : 3, transition: "left 0.2s" }} />
              </button>
            </div>
            <button onClick={onClearKey}
              style={{ ...btn("g"), width: "100%", color: G.red, border: "1px solid " + G.red + "44", fontSize: 12, padding: 10 }}>
              Sign Out / Clear License
            </button>
            <div style={{ fontSize: 10, color: G.tx3, marginTop: 6, textAlign: "center" }}>
              Questions? <a href="mailto:coach@armsight.app" style={{ color: G.gold, textDecoration: "none" }}>coach@armsight.app</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- NEW GAME --- */
function NewG({ onSave, onCancel, allGames = [], roster = [] }) {
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
          <input style={{ ...is, marginBottom: 14 }} value={team} onChange={e => setTeam(e.target.value)} placeholder="e.g. Lincoln Lions" />
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
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ width: 20, fontSize: 13, fontWeight: 800, color: G.gold, fontFamily: "'Azeret Mono',monospace", textAlign: "right", flexShrink: 0 }}>{slot.slot}</div>
                  {roster.length > 0 ? (
                    <select value={slot.rosterId || ""} onChange={e => { const pl = roster.find(p => String(p.id) === e.target.value); assignPlayer(i, pl || null); }}
                      style={{ ...is, fontSize: 13, padding: "6px 8px", flex: 1 }}>
                      <option value="">— select —</option>
                      {[...roster].sort((a, b) => (parseInt(a.num) || 99) - (parseInt(b.num) || 99)).map(p => (
                        <option key={p.id} value={p.id}>{(p.num ? "#" + p.num + " " : "") + p.name + " (" + p.bats + ")"}</option>
                      ))}
                    </select>
                  ) : (
                    <input value={slot.name} onChange={e => updLineup(i, "name", e.target.value)} placeholder={`Batter ${slot.slot}`} style={{ ...is, fontSize: 13, padding: "6px 8px", flex: 1 }} />
                  )}
                  {["R", "L", "B"].map(h => (
                    <button key={h} onClick={() => updLineup(i, "bats", h)} title={h === "B" ? "Switch hitter \u2014 bats opposite the pitcher automatically" : ""} style={{ padding: "6px 10px", borderRadius: 5, border: "none", background: (slot.bats || slot.hand) === h ? G.gold : G.sf2, color: (slot.bats || slot.hand) === h ? "#000" : G.tx2, fontSize: 12, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>{h}</button>
                  ))}
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

/* --- APP --- */
// Reconstruct live game state from the last pitch in history
// so resuming a game restores inning, count, outs, runners etc.
function deriveStateFromGame(g) {
  const pitches = g.pitches || [];
  const defaults = { balls: 0, strikes: 0, outs: 0, inning: 1, batOrder: 1,
    batSide: "R", timesThrough: 1, runners: { first: false, second: false, third: false },
    curP: g.pitcher };

  if (!pitches.length) return defaults;

  // Find the most recent pitcher
  const lastPitch = pitches[pitches.length - 1];
  const curP = lastPitch.pitcher || g.pitcher;

  // Start from the state stored ON the last pitch (pre-result state)
  // then advance it through the result to get the post-pitch state
  let { balls, strikes, outs, inning, batOrder, batSide, timesThrough, runners } = lastPitch;
  balls = balls ?? 0; strikes = strikes ?? 0; outs = outs ?? 0;
  inning = inning ?? 1; batOrder = batOrder ?? 1; batSide = batSide ?? "R";
  timesThrough = timesThrough ?? 1;
  runners = runners ? { ...runners } : { first: false, second: false, third: false };

  const res = lastPitch.result;
  const advB = () => {
    const nx = batOrder >= 9 ? 1 : batOrder + 1;
    batOrder = nx;
    if (nx === 1) timesThrough = timesThrough + 1;
  };
  const advForced = (r, bOn) => {
    const nr = { first: false, second: false, third: false };
    if (r.first && r.second && r.third) { nr.first = bOn; nr.second = true; nr.third = true; }
    else if (r.first && r.second) { nr.first = bOn; nr.second = true; nr.third = true; }
    else if (r.first) { nr.first = bOn; nr.second = true; nr.third = r.third; }
    else { nr.first = bOn; nr.second = r.second; nr.third = r.third; }
    return nr;
  };

  if (res === "ball") {
    if (balls >= 3) { runners = advForced(runners, true); balls = 0; strikes = 0; advB(); }
    else balls = balls + 1;
  } else if (res === "K" || res === "Kc") {
    if (strikes >= 2) {
      if (lastPitch.dropReached) { runners = advForced(runners, true); balls = 0; strikes = 0; advB(); } // dropped 3rd strike reached: no out
      else { outs = outs + 1; balls = 0; strikes = 0; advB(); }
    }
    else strikes = strikes + 1;
  } else if (res === "foul") {
    if (strikes < 2) strikes = strikes + 1;
  } else if (res === "go") {
    // Mirror live GO: productive out, each runner up one base
    const gr = runners;
    runners = { first: false, second: gr.first || false, third: gr.second || false };
    outs = outs + 1; balls = 0; strikes = 0; advB();
  } else if (res === "out" || res === "fo" || res === "po" || res === "lo") {
    outs = outs + 1; balls = 0; strikes = 0; advB();
  } else if (res === "fc") {
    outs = outs + 1; balls = 0; strikes = 0; advB();
    // Mirror live advanceFC: LEAD runner out, batter to 1st, trailing runners move up on a force
    const fr = runners;
    const fn = { first: true, second: false, third: false };
    if (fr.third) { fn.second = fr.second || fr.first; fn.third = fr.second && fr.first; }
    else if (fr.second) { fn.second = fr.first; }
    runners = fn;
  } else if (res === "hit" || res === "roe") {
    balls = 0; strikes = 0; advB();
    const bases = lastPitch.hitBases || 1;
    if (bases >= 4) runners = { first: false, second: false, third: false };
    else if (bases === 3) runners = { first: false, second: false, third: true };
    else if (bases === 2) runners = { first: false, second: true, third: lastPitch.runners?.first || false };
    else { runners = { first: true, second: lastPitch.runners?.first || false, third: lastPitch.runners?.second || false }; }
  } else if (res === "hbp") {
    runners = advForced(runners, true); balls = 0; strikes = 0; advB();
  } else if (res === "ibb") {
    runners = advForced(runners, true); balls = 0; strikes = 0; advB();
  } else if (res === "gdp") {
    if (runners.first) runners = { ...runners, first: false };
    else if (runners.third) runners = { ...runners, third: false };
    else if (runners.second) runners = { ...runners, second: false };
    outs = outs + 2; balls = 0; strikes = 0; advB();
  } else if (res === "wp" || res === "pb") {
    const nr = { ...runners };
    if (runners.third) nr.third = false;
    if (runners.second) { nr.third = true; nr.second = false; }
    if (runners.first) { nr.second = true; nr.first = false; }
    runners = nr;
    if (lastPitch.isBall) {
      if (balls >= 3) { runners = advForced(runners, true); balls = 0; strikes = 0; advB(); }
      else balls = balls + 1;
    } else if (strikes < 2) strikes = strikes + 1;
  }

  // Mirror live sac handling \u2014 these tags mean the runner(s) really advanced
  const lt = lastPitch.atBatTags || {};
  if ((lt.sacBunt || lastPitch.bunt) && (res === "out" || res === "go") && (runners.first || runners.second || runners.third)) {
    const nr = { ...runners };
    if (nr.third) nr.third = false;
    if (nr.second) { nr.third = true; nr.second = false; }
    if (nr.first) { nr.second = true; nr.first = false; }
    runners = nr;
  }
  if (lt.sacFly && runners.third) runners = { ...runners, third: false };

  // If 3 outs, advance inning and clear
  if (outs >= 3) {
    inning = inning + 1; outs = 0; balls = 0; strikes = 0;
    runners = { first: false, second: false, third: false };
  }

  return { balls, strikes, outs, inning, batOrder, batSide, timesThrough, runners, curP };
}

const CHART_DEFAULTS = { balls: 0, strikes: 0, outs: 0, inning: 1, batOrder: 1, batSide: "R", timesThrough: 1, runners: { first: false, second: false, third: false }, curP: null };

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

      // Meta doc (notes + prefs) listener \u2014 newer cloud timestamp wins
      const unsubMeta = db.collection("users").doc(uid).onSnapshot(docSnap => {
        const m = docSnap.data();
        if (!m || !m.metaUpdatedAt) return;
        setData(prev => {
          if (m.metaUpdatedAt <= (prev.metaUpdatedAt || 0)) return prev;
          const nd = { ...prev, scoutingNotes: m.scoutingNotes || prev.scoutingNotes || {}, prefs: m.prefs || prev.prefs || {}, metaUpdatedAt: m.metaUpdatedAt };
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
        {tab === "tendencies" && <PitchingTendencies games={data.games} tier={tier} activeGame={active} activePitcher={chartState.curP || (active && active.pitcher) || null} scoutingNotes={data.scoutingNotes || {}} onSaveNote={saveNote} />}
        {tab === "baserunning" && <CountBD games={data.games} allGames={data.games} tier={tier} activeGame={active} activePitcher={chartState.curP || (active && active.pitcher) || null} section="baserunning" />}
        {tab === "hitting" && <Hitting games={data.games} activeGame={active} />}
        {tab === "library" && <GList games={data.games.filter(g => g.status === "complete")} title="Completed Games" onSelect={id => { if (id !== activeId) { const g = data.games.find(x => x.id === id); setChartState(g ? deriveStateFromGame(g) : { ...CHART_DEFAULTS }); } setActiveId(id); setTab("chart"); }} onDelete={del} onExport={exportGame} onExportCSV={exportGameCSV} />}
      </main>
    </div>
  );
}
export default App;