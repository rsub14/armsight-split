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

// ── QAB DETECTION ────────────────────────────────────────────────────────────
// Returns true if a pitch sequence (the AB ending on this pitch) counts as a QAB
// Auto-detected criteria:
//   Hit, ROE, Walk (balls===3 + result ball), HBP
//   6+ pitch AB
//   4+ pitches after 2 strikes
// Coach-tagged criteria (stored on pitch.atBatTags):
//   hardHit, sacFly, sacBunt, advRunner, rbi