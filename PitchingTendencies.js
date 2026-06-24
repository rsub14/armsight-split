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
            {/* Team profiles at the top */}
            <Library games={games} tier={tier} />

            {/* Scout Notes below */}
            {activeTeam && (
              <div style={{ ...cd, marginTop: 8, borderLeft: "3px solid " + G.gold }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={cT}>Scout Notes — {activeTeam}</div>
                  {teamNotes.length > 0 && (
                    <div style={{ fontSize: 10, color: G.tx3, fontFamily: "'Azeret Mono',monospace", fontWeight: 700 }}>
                      {teamNotes.length} note{teamNotes.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>

                {/* New note input */}
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder={teamNotes.length === 0 ? "Add a note about " + activeTeam + " or their pitchers..." : "Add another note..."}
                  style={{ width: "100%", minHeight: 60, background: G.sf2, border: "1px solid " + G.bd2, borderRadius: 6, padding: "10px 12px", color: G.tx, fontSize: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8, outline: "none" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: teamNotes.length > 0 ? 12 : 0 }}>
                  <button
                    onClick={() => {
                      if (!noteText.trim() || !onSaveNote) return;
                      onSaveNote(activeTeam, noteText.trim());
                      setNoteText("");
                    }}
                    style={{ ...btn("p"), fontSize: 11, padding: "7px 18px" }}>
                    + Add Note
                  </button>
                  {teamNotes.length === 0 && (
                    <div style={{ fontSize: 11, color: G.tx3, fontStyle: "italic" }}>
                      or tap 📝 during a game to capture notes live
                    </div>
                  )}
                </div>

                {/* Existing notes list */}
                {teamNotes.length > 0 && (
                  <div>
                    {[...teamNotes].reverse().map(n => (
                      <div key={n.id} style={{ background: G.sf2, border: "1px solid " + G.bd, borderRadius: 7, padding: "10px 12px", marginBottom: 6 }}>
                        {editId === n.id ? (
                          <div>
                            <textarea
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              style={{ width: "100%", minHeight: 60, background: G.sf, border: "1px solid " + G.gold + "55", borderRadius: 6, padding: "8px 10px", color: G.tx, fontSize: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
                            />
                            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                              <button onClick={() => {
                                if (editText.trim() && onSaveNote) onSaveNote(activeTeam, editText.trim(), n.id);
                                setEditId(null); setEditText("");
                              }} style={{ ...btn("p"), fontSize: 11, padding: "5px 14px" }}>Save</button>
                              <button onClick={() => { setEditId(null); setEditText(""); }} style={{ ...btn("g"), fontSize: 11, padding: "5px 14px" }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                              <div style={{ fontSize: 13, color: G.tx, lineHeight: 1.6, flex: 1 }}>{n.text}</div>
                              <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                                <button onClick={() => { setEditId(n.id); setEditText(n.text); }}
                                  style={{ padding: "4px 9px", borderRadius: 5, border: "none", background: G.sf, color: G.tx3, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'Anybody',sans-serif" }}>Edit</button>
                                <button onClick={() => { if (onSaveNote) onSaveNote(activeTeam, null, n.id, true); }}
                                  style={{ padding: "4px 9px", borderRadius: 5, border: "none", background: G.sf, color: G.red, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'Anybody',sans-serif" }}>Delete</button>
                              </div>
                            </div>
                            <div style={{ fontSize: 10, color: G.tx3, marginTop: 6, fontFamily: "'Azeret Mono',monospace" }}>
                              {new Date(n.ts).toLocaleDateString()} {new Date(n.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>)
        : <CountBD games={games} allGames={games} tier={tier} activeGame={activeGame} activePitcher={activePitcher} section="pitching" roster={roster} />}
    </div>
  );
}
