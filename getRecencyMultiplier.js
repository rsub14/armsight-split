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
// ── RECENCY CHECK — graduated curve, split by batter ──────────────────────
// After 2 same pitch to same batter: slight reduction
// After 3 same pitch to same batter: larger reduction
// After 4+ same pitch to same batter: bounces back (he's very confident)
// Across different batters: not a streak, no penalty
