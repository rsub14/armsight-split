function PitchingTendencies({ games, tier, activeGame, activePitcher, scoutingNotes = {}, onSaveNote, roster = [] }) {
  const [sub, setSub] = useState("analyzer");
  const [noteText, setNoteText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  const tb = (id, label) => (
    <button onClick={() => setSub(id)}
      style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none",
        background: sub === id ? G.gold : G.sf2, color: sub === id ? "#000" : G.tx2,
        fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "'Anybody',sans-serif" }}>
      {label}
    </button>
  );

  const activeTeam = activeGame ? activeGame.opponent : (games.length > 0 ? games[0].opponent : null);
  const teamNotes = activeTeam ? (scoutingNotes[activeTeam] || []) : [];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {tb("analyzer", "Analyzer")}
        {tb("report", "Scouting Report")}
      </div>
      {sub === "report"
        ? (<>
            <Library games={games} tier={tier} />
            {activeTeam && (
              <div style={cd}>
                <div style={cT}>📝 Scout Notes — {activeTeam}</div>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder={"Add a note about " + activeTeam + " or their pitchers..."}
                  style={{ width: "100%", minHeight: 70, background: G.sf2, border: "1px solid " + G.bd2, borderRadius: 8, padding: 10, color: G.tx, fontSize: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }}
                />
                <button
                  onClick={() => {
                    if (!noteText.trim() || !onSaveNote) return;
                    onSaveNote(activeTeam, noteText.trim());
                    setNoteText("");
                  }}
                  style={{ ...btn("p"), fontSize: 12, padding: "8px 18px", marginBottom: 14 }}>
                  + Add Note
                </button>
                {teamNotes.length === 0 && (
                  <div style={{ fontSize: 12, color: G.tx3, fontStyle: "italic" }}>No notes yet for {activeTeam}. Add observations above or tap 📝 during a game.</div>
                )}
                {[...teamNotes].reverse().map(n => (
                  <div key={n.id} style={{ background: G.sf2, border: "1px solid " + G.bd2, borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                    {editId === n.id ? (
                      <div>
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          style={{ width: "100%", minHeight: 60, background: G.sf, border: "1px solid " + G.gold + "55", borderRadius: 6, padding: 8, color: G.tx, fontSize: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button onClick={() => {
                            if (editText.trim() && onSaveNote) onSaveNote(activeTeam, editText.trim(), n.id);
                            setEditId(null); setEditText("");
                          }} style={{ ...btn("p"), fontSize: 11, padding: "5px 12px" }}>Save</button>
                          <button onClick={() => { setEditId(null); setEditText(""); }} style={{ ...btn("g"), fontSize: 11, padding: "5px 12px" }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ fontSize: 13, color: G.tx, lineHeight: 1.5, flex: 1 }}>{n.text}</div>
                        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                          <button onClick={() => { setEditId(n.id); setEditText(n.text); }} style={{ ...btn("g"), fontSize: 10, padding: "4px 8px", color: G.tx3 }}>Edit</button>
                          <button onClick={() => { if (onSaveNote) onSaveNote(activeTeam, null, n.id, true); }} style={{ ...btn("g"), fontSize: 10, padding: "4px 8px", color: G.red }}>Delete</button>
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: G.tx3, marginTop: 6 }}>{new Date(n.ts).toLocaleDateString()} {new Date(n.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                ))}
              </div>
            )}
          </>)
        : <CountBD games={games} allGames={games} tier={tier} activeGame={activeGame} activePitcher={activePitcher} section="pitching" roster={roster} />}
    </div>
  );
}
