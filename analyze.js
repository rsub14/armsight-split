function analyze(pitches) {
  const real = pitches.filter(p => !EVENTS.has(p.type) && p.type !== "UNK");
  if (!real.length) return null;
  const total = real.length;
  const byType = {};
  real.forEach(p => { byType[p.type] = (byType[p.type] || 0) + 1; });
  const mix = Object.entries(byType)
    .map(([t, c]) => ({ type: t, count: c, pct: +((c / total) * 100).toFixed(1) }))
    .sort((a, b) => b.count - a.count);

  const grp = (fn) => {
    const f = real.filter(fn);
    const t = {};
    f.forEach(p => { t[p.type] = (t[p.type] || 0) + 1; });
    return { t, n: f.length };
  };

  const fp = grp(p => p.balls === 0 && p.strikes === 0);
  const ts = grp(p => p.strikes === 2);
  const bh = grp(p => (p.balls >= 2 && p.strikes === 0) || (p.balls === 3 && p.strikes <= 1));
  const vL = grp(p => p.batSide === "L");
  const vR = grp(p => p.batSide === "R");
  const ron = grp(p => p.runners && (p.runners.first || p.runners.second || p.runners.third));

  const tto = {};
  real.forEach(p => {
    if (p.timesThrough) {
      if (!tto[p.timesThrough]) tto[p.timesThrough] = {};
      tto[p.timesThrough][p.type] = (tto[p.timesThrough][p.type] || 0) + 1;
    }
  });

  const dirt = real.filter(p => p.location === "dirt");
  const velos = real.filter(p => p.velo).map(p => p.velo);
  const avgVelo = velos.length ? (velos.reduce((a, b) => a + b, 0) / velos.length).toFixed(1) : null;

  return { total, mix, fpT: fp.t, fpN: fp.n, tsT: ts.t, tsN: ts.n, bhT: bh.t, bhN: bh.n, vLT: vL.t, vLN: vL.n, vRT: vR.t, vRN: vR.n, ronT: ron.t, ronN: ron.n, tto, dirt, avgVelo };
}