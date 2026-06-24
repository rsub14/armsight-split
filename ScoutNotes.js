function ScoutNotes({ t, pitches, name, compact = false }) {
  const notes = [];
  const mk = (ty, tot) => {
    if (!tot) return null;
    const top = Object.entries(ty).sort((a, b) => b[1] - a[1])[0];
    return top ? { type: top[0], pct: ((top[1] / tot) * 100).toFixed(0) } : null;
  };
  if (t.mix[0]) notes.push(`Primary: ${t.mix[0].type} (${t.mix[0].pct}%).`);
  const fp = mk(t.fpT, t.fpN);
  if (fp && t.fpN >= 2) notes.push(`1st pitch: ${fp.type} ${fp.pct}%.`);
  const ts = mk(t.tsT, t.tsN);
  if (ts && t.tsN >= 2) notes.push(`2 strikes: ${ts.type} ${ts.pct}%.`);
  const bh = mk(t.bhT, t.bhN);
  if (bh && t.bhN >= 2) notes.push(`Behind: ${bh.type} ${bh.pct}%.`);
  if (t.vLN >= 3) { const l = mk(t.vLT, t.vLN); if (l) notes.push(`vs L: ${l.type} ${l.pct}%.`); }
  if (t.vRN >= 3) { const r = mk(t.vRT, t.vRN); if (r) notes.push(`vs R: ${r.type} ${r.pct}%.`); }
  const pk = pitches.filter(p => p.type === "PKO");
  if (pk.length) notes.push(`Pickoffs: ${pk.length}x.`);
  const wp = pitches.filter(p => p.type === "WP");
  if (wp.length) notes.push(`Wild pitches: ${wp.length}x. Run on dirt.`);
  const pb = pitches.filter(p => p.type === "PB");
  if (pb.length) notes.push(`Passed balls: ${pb.length}x.`);
  const sb = pitches.filter(p => p.type === "SB");
  if (sb.length) notes.push(`Stolen bases: ${sb.length}x. Vulnerable to run game.`);
  if (t.dirt.length >= 2) notes.push(`Dirt: ${t.dirt.length}x.`);

  // TTO shift notes — compare each cycle (1st, 2nd, 3rd...) SEPARATELY rather than lumping
  // "2+" together, which hid pitches that swung cycle-to-cycle (e.g. CB 55% -> 0% -> 100%).
  const ttoShifts = [];
  const ordName = (c) => c === 1 ? "1st" : c === 2 ? "2nd" : c === 3 ? "3rd" : c + "th";
  if (t.tto && t.tto[1]) {
    const cyc = [1, 2, 3, 4, 5].filter(n => t.tto[n] && Object.values(t.tto[n]).reduce((a, b) => a + b, 0) > 0);
    const tot = {}; cyc.forEach(c => { tot[c] = Object.values(t.tto[c]).reduce((a, b) => a + b, 0); });
    const rate = (c, type) => (tot[c] ? (t.tto[c][type] || 0) / tot[c] : 0);
    if (cyc.length >= 2 && tot[cyc[0]] >= 4) {
      const types = [...new Set(cyc.flatMap(c => Object.keys(t.tto[c])))];
      types.forEach(type => {
        // Build the per-cycle % path for this pitch across cycles with enough data (>=3 pitches)
        const path = cyc.filter(c => tot[c] >= 3).map(c => ({ c, pct: Math.round(rate(c, type) * 100), r: rate(c, type) }));
        if (path.length < 2) return;
        const first = path[0], last = path[path.length - 1];
        const maxR = Math.max(...path.map(p => p.r)), minR = Math.min(...path.map(p => p.r));
        // SHELVED-THEN-BACK: established (>=15%) somewhere, dropped to ~none (<5%) in a middle cycle, back (>=12%) after
        let shelved = null;
        for (let i = 0; i < path.length - 2; i++) {
          if (path[i].r >= 0.15) {
            for (let j = i + 1; j < path.length - 1; j++) {
              if (path[j].r < 0.05) {
                for (let k = j + 1; k < path.length; k++) {
                  if (path[k].r >= 0.12) { shelved = { gone: path[j].c, back: path[k].c }; break; }
                }
              }
              if (shelved) break;
            }
          }
          if (shelved) break;
        }
        if (shelved) {
          ttoShifts.push({ type, kind: "back", text: `back ${ordName(shelved.back)} time (shelved ${ordName(shelved.gone)})`, swing: maxR - minR });
        } else if (last.r - first.r >= 0.20) {
          ttoShifts.push({ type, kind: "up", text: `up ${first.pct}% → ${last.pct}% by ${ordName(last.c)} time`, swing: last.r - first.r });
        } else if (first.r - last.r >= 0.20) {
          ttoShifts.push({ type, kind: "down", text: `down ${first.pct}% → ${last.pct}% \u2014 shelving it late`, swing: first.r - last.r });
        }
      });
      ttoShifts.sort((a, b) => b.swing - a.swing);
    }
  }

  if (!notes.length && !ttoShifts.length) return <div style={{ fontSize: 12, color: G.tx3 }}>Charting more...</div>;

  if (compact) {
    // Parse "Label: value." into { label, value } for grid cells
    const cells = notes.map(n => {
      const colon = n.indexOf(":");
      if (colon === -1) return { label: null, value: n.replace(/\.$/, "") };
      return { label: n.slice(0, colon).trim(), value: n.slice(colon + 1).replace(/\.$/, "").trim() };
    });
    return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px" }}>
          {cells.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 5, padding: "5px 8px", background: G.sf, borderRadius: 5, minWidth: 0 }}>
              {c.label && (
                <span style={{ fontSize: 9, fontWeight: 800, color: G.tx3, letterSpacing: 0.8, textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {c.label}
                </span>
              )}
              <span style={{ fontSize: 12, fontWeight: 800, color: G.gold, fontFamily: "'Azeret Mono',monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.value}
              </span>
            </div>
          ))}
        </div>
        {ttoShifts.length > 0 && (
          <div style={{ marginTop: 8, padding: "7px 10px", background: "#0a0a00", borderRadius: 6, border: "1px solid " + G.gold + "44" }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: G.gold, letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>TTO Shift</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px" }}>
              {ttoShifts.slice(0, 4).map((sh, i) => {
                const col = sh.kind === "down" ? G.tx3 : G.gold;
                const arrow = sh.kind === "up" ? "↑" : sh.kind === "down" ? "↓" : "↻";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 5, padding: "4px 7px", background: G.sf, borderRadius: 5 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: col, whiteSpace: "nowrap" }}>{sh.type} {arrow}</span>
                    <span style={{ fontSize: 10, color: G.tx3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sh.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {notes.map((n, i) => (
        <div key={i} style={{ fontSize: 13, color: G.tx2, lineHeight: 1.8, marginBottom: 4, paddingLeft: 10, borderLeft: "3px solid " + G.gold + "55" }}>{n}</div>
      ))}
      {ttoShifts.length > 0 && (
        <div style={{ marginTop: 10, padding: "8px 10px", background: "#0a0a00", borderRadius: 6, border: "1px solid " + G.gold + "44" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: G.gold, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>TTO Pattern Shift</div>
          {ttoShifts.slice(0, 3).map((sh, i) => {
            const col = sh.kind === "down" ? G.tx3 : G.gold;
            const arrow = sh.kind === "up" ? "↑" : sh.kind === "down" ? "↓" : "↻";
            return (
            <div key={i} style={{ fontSize: 12, color: col, marginBottom: 4, paddingLeft: 8, borderLeft: "3px solid " + (sh.kind === "down" ? G.bd2 : G.gold) }}>
              <span style={{ fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{sh.type}</span>
              {" " + arrow + " " + sh.text}
            </div>
            );
          })}
        </div>
      )}
    </>
  );
}
