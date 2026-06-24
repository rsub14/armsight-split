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

// ── CURRENT AT-BAT PITCHES ─────────────────────────────────────────────────
// Known pitches thrown so far in the current at-bat (trailing run of the same
// batter). Events / unknowns are skipped but do not end the at-bat.