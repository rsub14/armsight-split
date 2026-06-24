function Bar({ data }) {
  const m = Math.max(...data.map(d => d.pct), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map(d => (
        <div key={d.type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 44, fontSize: 13, fontFamily: "'Azeret Mono',monospace", fontWeight: 800, color: gPC(d.type), textAlign: "right" }}>{d.type}</div>
          <div style={{ flex: 1, height: 24, background: G.sf2, borderRadius: 4, position: "relative", overflow: "hidden" }}>
            <div style={{ width: `${(d.pct / m) * 100}%`, height: "100%", background: `linear-gradient(90deg,${gPC(d.type)}cc,${gPC(d.type)}55)`, borderRadius: 4, transition: "width 0.5s" }} />
            <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", color: "#fff" }}>{d.pct}%</span>
          </div>
          <div style={{ width: 26, fontSize: 12, fontFamily: "'Azeret Mono',monospace", color: G.tx3, textAlign: "right", fontWeight: 700 }}>{d.count}</div>
        </div>
      ))}
    </div>
  );
}