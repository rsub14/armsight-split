function DiscBoard({ pool }) {
  const [metric, setMetric] = useState("whiff");
  const [f, setF] = useState({ pitch: "All", count: "All", outs: "All", run: "All" });
  const pitches = pool.filter(x => pdMatch(x.p, x.pts, f)).map(x => x.p);
  const rates = pdRates(pitches);
  const pct = v => v < 0 ? "—" : Math.round(v * 100) + "%";
  const seenLoc = pitches.filter(p => p.location && (STRIKE_ZONE_KEYS.has(p.location) || BALL_ZONE_KEYS.has(p.location)));
  const dd = (key, opts) => (
    <select value={f[key]} onChange={e => setF(s => ({ ...s, [key]: e.target.value }))} style={{ background: G.sf2, color: G.tx, border: "1px solid " + G.bd2, borderRadius: 6, padding: "5px 8px", fontSize: 11, fontFamily: "inherit" }}>
      {opts.map(o => <option key={o} value={o}>{o === "All" ? key[0].toUpperCase() + key.slice(1) + ": All" : (key === "count" && (o === "Ahead" || o === "Behind") ? "Hitter " + o : o)}</option>)}
    </select>
  );
  const stat = (key, lbl) => (
    <div onClick={() => setMetric(key)} style={{ flex: 1, textAlign: "center", cursor: "pointer", padding: "10px 4px", borderRadius: 8, background: metric === key ? G.gold + "22" : "transparent", border: "1px solid " + (metric === key ? G.gold : G.bd2) }}>
      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: metric === key ? G.gold : G.tx }}>{pct(rates[key])}</div>
      <div style={{ fontSize: 9, color: metric === key ? G.gold : G.tx3, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, marginTop: 3 }}>{lbl}</div>
    </div>
  );
  const lblTxt = { whiff: "Whiff% = swing-and-miss / swings", chase: "Chase% = swings / pitches seen (out-of-zone only)", take: "Take% = takes / pitches seen" }[metric];
  return (
    <div style={cd}>
      <div style={cT}>Plate Discipline — induced</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>{stat("whiff", "Whiff")}{stat("chase", "Chase")}{stat("take", "Take")}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {dd("pitch", ["All", "Fastball", "Breaking", "Offspeed"])}
        {dd("count", ["All", "Ahead", "Even", "Behind"])}
        {dd("outs", ["All", "0", "1", "2"])}
        {dd("run", ["All", "Empty", "Men on", "RISP"])}
      </div>
      {seenLoc.length === 0 ? <div style={{ fontSize: 12, color: G.tx3, fontStyle: "italic" }}>No located pitches for this selection.</div> : (
        <div>
          <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>{({ whiff: "Whiff %", chase: "Chase %", take: "Take %" })[metric]} by zone</div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
            {["R", "L"].map(side => {
              const sp = seenLoc.filter(p => (p.batSide || "R") === side);
              if (sp.length === 0) return null;
              const den = {}, num = {};
              [...STRIKE_ZONES.map(z => z.k), ...BALL_ZONES.map(z => z.k)].forEach(k => { den[k] = 0; num[k] = 0; });
              sp.forEach(p => {
                const k = p.location; if (den[k] === undefined) return;
                if (metric === "whiff") { if (pdSwing(p)) { den[k]++; if (pdWhiff(p)) num[k]++; } }
                else if (metric === "chase") { if (BALL_ZONE_KEYS.has(k)) { den[k]++; if (pdSwing(p)) num[k]++; } }
                else { den[k]++; if (!pdSwing(p)) num[k]++; }
              });
              return (
                <div key={side} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, marginBottom: 6, letterSpacing: 1 }}>{side === "R" ? "vs RHB" : "vs LHB"} ({sp.length})</div>
                  <div style={{ display: "inline-grid", gridTemplateColumns: "24px repeat(3,42px) 24px", gridTemplateRows: "24px repeat(3,42px) 24px 24px", gap: 2 }}>
                    {STRIKE_ZONES.map(z => { const v = discCellM(den[z.k], num[z.k]); return (
                      <div key={z.k} style={{ gridRow: z.r + 1, gridColumn: z.c + 1, background: v.bg, color: v.col, borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "2px solid " + G.bd }}>
                        {den[z.k] > 0 ? (<><div style={{ fontSize: 11, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{v.txt}</div><div style={{ fontSize: 7, opacity: 0.8 }}>n={den[z.k]}</div></>) : <div style={{ fontSize: 9, color: G.tx3 }}>·</div>}
                      </div> ); })}
                    {BALL_ZONES.map(z => { const v = discCellM(den[z.k], num[z.k]); return (
                      <div key={z.k} style={{ gridRow: (z.r + 1) + " / span " + z.rowSpan, gridColumn: (z.c + 1) + " / span " + z.colSpan, background: den[z.k] > 0 ? v.bg : "#0d0d0d", color: v.col, borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px dashed " + G.bd2 }}>
                        {den[z.k] > 0 ? (<><div style={{ fontSize: 10, fontWeight: 800, fontFamily: "'Azeret Mono',monospace" }}>{v.txt}</div><div style={{ fontSize: 7, opacity: 0.8 }}>n={den[z.k]}</div></>) : <div style={{ fontSize: 7, color: G.tx3 }}>{z.k === "dirt" ? "DIRT" : (side === "R" ? z.rL : z.lL)}</div>}
                      </div> ); })}
                  </div>
                </div> );
            })}
          </div>
          <div style={{ fontSize: 9, color: G.tx3, marginTop: 8, textAlign: "center" }}>{lblTxt} · brighter = higher · n shown · &lt;3 muted{metric === "chase" ? " · out-of-zone cells only" : ""}</div>
        </div>
      )}
    </div>
  );
}
