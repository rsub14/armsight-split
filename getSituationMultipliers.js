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

// ── SITUATION MULTIPLIERS ──────────────────────────────────────────────────