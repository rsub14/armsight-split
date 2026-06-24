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

// ── SEQUENCE MATRIX (within at-bat) ────────────────────────────────────────
// Walks the RAW pitch list and tallies pitch-to-pitch transitions WITHIN an
// at-bat: "after pitch X (with result R), what came next?". Unknown ("?")
// pitches and events (pickoffs, SB/CS/WP/PB, IBB) BREAK the chain, so a
// transition is never recorded across a pitch we could not read. A change of
// batter also breaks the chain — transitions are within a single at-bat only.