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
