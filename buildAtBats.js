
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