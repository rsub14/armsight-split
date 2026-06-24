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