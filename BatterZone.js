function BatterZone({ batSide, selected, onSelect }) {
  const isR = batSide === "R";
  const sz = 38;
  const bz = 24;
  return (
    <div>
      <div style={{ display: "inline-grid", gridTemplateColumns: `${bz}px repeat(3,${sz}px) ${bz}px`, gridTemplateRows: `${bz}px repeat(3,${sz}px) ${bz}px ${bz}px`, gap: 2 }}>
        {STRIKE_ZONES.map(z => {
          const lb = isR ? z.rL : z.lL;
          const sel = selected === z.k;
          return (
            <div key={z.k} onClick={() => onSelect(sel ? null : z.k)} style={{
              gridRow: z.r + 1, gridColumn: z.c + 1,
              background: sel ? G.gold : G.sf2, color: sel ? "#000" : G.tx2,
              borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 7, fontWeight: 800, cursor: "pointer", textTransform: "uppercase",
              border: `2px solid ${sel ? G.gold : G.bd}`,
              textAlign: "center", lineHeight: 1.2, padding: 2,
            }}>{lb}</div>
          );
        })}
        {BALL_ZONES.map(z => {
          const lb = isR ? z.rL : z.lL;
          const sel = selected === z.k;
          return (
            <div key={z.k} onClick={() => onSelect(sel ? null : z.k)} style={{
              gridRow: `${z.r + 1} / span ${z.rowSpan}`, gridColumn: `${z.c + 1} / span ${z.colSpan}`,
              background: sel ? G.gold : "#0d0d0d", color: sel ? "#000" : G.tx3,
              borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: z.k === "dirt" ? 9 : 7, fontWeight: 800, cursor: "pointer", textTransform: "uppercase",
              border: `1px dashed ${sel ? G.gold : G.bd2}`,
              textAlign: "center", lineHeight: 1.2, padding: 1,
            }}>{z.k === "dirt" ? "DIRT" : lb}</div>
          );
        })}
      </div>
      <div style={{ textAlign: "center", marginTop: 4, fontSize: 10, color: G.tx3, fontWeight: 700 }}>{isR ? "RHB" : "LHB"}</div>
    </div>
  );
}