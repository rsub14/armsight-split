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