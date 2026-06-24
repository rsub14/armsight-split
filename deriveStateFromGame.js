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