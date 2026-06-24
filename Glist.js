function GList({ games, onSelect, onCreate, onDelete, onImport, onExport, onExportCSV, warnNoBackup, title = "Games" }) {
  const [delId, setDelId] = useState(null);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: G.tx3, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800 }}>{title} ({games.length})</div>
        {onCreate && <button onClick={onCreate} style={btn("p")}>+ New Game</button>}
        {onImport && <><input id="csvimp" type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => { const f = e.target.files[0]; if (f) onImport(f); e.target.value = ""; }} /><button onClick={() => { const el = document.getElementById("csvimp"); if (el) el.click(); }} style={{ ...btn("g"), marginLeft: 8 }} title="Import a pitch-level CSV (headers: type, location, result; optional balls, strikes, outs, batSide, inning, pitcher)">Import CSV</button></>}
      </div>
      {warnNoBackup && games.length > 0 && (
        <div style={{ ...cd, padding: "10px 14px", marginBottom: 12, background: "#ff993315", border: "1px solid #ff993355", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚠</span>
          <div style={{ fontSize: 12, color: G.tx2, lineHeight: 1.5 }}>Your data is only on this device. Export a backup from <b>Settings → Data & Backup</b>, or the <b>↑</b> button on a game, so you don't lose it if your browser data is cleared.</div>
        </div>
      )}
      {!games.length && (
        <div style={{ ...cd, textAlign: "center", padding: "40px 20px", borderStyle: "dashed" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <svg width="64" height="78" viewBox="0 0 112 124">
              <path d="M4,4 L108,4 L108,76 L56,120 L4,76 Z" fill="#FFD700"/>
              <polygon points="12,108 30,108 56,16 40,16" fill="#000"/>
              <polygon points="100,108 82,108 56,16 72,16" fill="#000"/>
              <rect x="34" y="72" width="44" height="16" fill="#FFD700"/>
              <polygon points="34,88 42,88 36,72 34,72" fill="#000"/>
              <polygon points="78,88 70,88 76,72 78,72" fill="#000"/>
              <rect x="8" y="100" width="28" height="12" rx="1" fill="#000"/>
              <rect x="76" y="100" width="28" height="12" rx="1" fill="#000"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            <span style={{ color: "#fff" }}>Arm</span><span style={{ color: "#ffd700" }}>Sight</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#888" }}>No games yet</div>
        </div>
      )}
      {games.map(g => (
        <div key={g.id} style={{ ...cd, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "14px 16px" }} onClick={() => onSelect(g.id)}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>
              <span style={{ color: G.gold }}>vs {g.opponent}</span>
              <span style={{ color: G.tx2, fontSize: 12, marginLeft: 6 }}>{g.pitcher}</span>
              {g.status === "complete" && <span style={{ marginLeft: 6, background: G.grn + "22", color: G.grn, borderRadius: 3, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>FINAL</span>}
              {g.pregame && <span style={{ marginLeft: 6, background: "#9b59ff22", color: "#b794ff", borderRadius: 3, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>PREGAME</span>}
            </div>
            <div style={{ fontSize: 11, color: G.tx3, marginTop: 2 }}>{g.pitches.length} pitches - {g.date}{g.pregame && g.faced ? " · vs " + g.faced : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={e => { e.stopPropagation(); onSelect(g.id); }} style={{ ...btn("g"), padding: "6px 12px", fontSize: 11 }}>Chart</button>
            {onExport && <button onClick={e => { e.stopPropagation(); onExport(g); }} title="Export this game as a .json backup file" style={{ ...btn("g"), padding: "6px 10px", fontSize: 11, color: G.blu }}>↑</button>}
            {onExportCSV && <button onClick={e => { e.stopPropagation(); onExportCSV(g); }} title="Export this game as a .csv (opens in Excel, re-importable)" style={{ ...btn("g"), padding: "6px 10px", fontSize: 11, color: G.grn }}>CSV</button>}
            {delId === g.id ? (
              <>
                <button onClick={e => { e.stopPropagation(); onDelete(g.id); setDelId(null); }} style={{ ...btn("d"), padding: "6px 12px", fontSize: 11 }}>Delete</button>
                <button onClick={e => { e.stopPropagation(); setDelId(null); }} style={{ ...btn("g"), padding: "6px 12px", fontSize: 11 }}>Keep</button>
              </>
            ) : (
              <button onClick={e => { e.stopPropagation(); setDelId(g.id); }} style={{ ...btn("g"), padding: "6px 10px", fontSize: 11, color: G.red }}>X</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}