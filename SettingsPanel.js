function SettingsPanel({ licKey, tier, onClose, onClearKey, fbUser, onFbSignOut, onShowFbAuth, prefs = {}, onSavePrefs, data, onRestore, onManageRoster }) {
  const [newKey, setNewKey] = useState("");
  const [msg, setMsg]       = useState("");
  const [err, setErr]       = useState("");
  const enableQAB = prefs.enableQAB !== false;

  const upgradeKey = () => {
    const t = validateKey(newKey);
    if (!t) { setErr("Invalid key — check and try again."); return; }
    saveLicense(newKey);
    setMsg("Key updated! Reloading...");
    setTimeout(() => window.location.reload(), 1000);
  };

  const is = { background: G.sf2, border: "1px solid " + G.bd2, borderRadius: 6, padding: "10px 12px", color: G.tx, fontSize: 14, fontWeight: 700, outline: "none", width: "100%", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Azeret Mono',monospace" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ ...cd, border: "2px solid " + G.bd2, position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: "transparent", border: "none", color: G.tx3, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>✕</button>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>⚙ Settings</div>

          <div style={{ marginBottom: 16, padding: "12px 14px", background: G.sf2, borderRadius: 8, border: "1px solid " + G.bd }}>
            <div style={{ fontSize: 10, color: G.tx3, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Current License</div>
            <div style={{ fontFamily: "'Azeret Mono',monospace", fontSize: 15, fontWeight: 700, color: G.gold, letterSpacing: 2, marginBottom: 4 }}>{licKey}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ background: TIER_COLOR[tier] || G.tx3, color: "#000", borderRadius: 3, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>{getTierLabel(tier)}</span>
              <span style={{ fontSize: 11, color: G.tx3 }}>tier active</span>
            </div>
          </div>

          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: G.tx3, fontWeight: 800, marginBottom: 6 }}>UPGRADE / CHANGE KEY</div>
            <input style={is} value={newKey} onChange={e => { setNewKey(e.target.value.toUpperCase()); setErr(""); setMsg(""); }}
              placeholder="AS-XXX-0000" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
            {err && <div style={{ fontSize: 11, color: G.red, marginTop: 4 }}>{err}</div>}
            {msg && <div style={{ fontSize: 11, color: G.grn, marginTop: 4 }}>{msg}</div>}
            <button onClick={upgradeKey} disabled={!newKey.trim()}
              style={{ ...btn("p", !newKey.trim()), width: "100%", marginTop: 8, padding: 11, fontSize: 13 }}>
              Apply New Key
            </button>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: G.tx3, fontWeight: 800, marginBottom: 6 }}>TEAM</div>
            <button onClick={onManageRoster} style={{ ...btn("g"), width: "100%", padding: 10, fontSize: 13, marginBottom: 14, color: G.gold }}>Manage Team Roster</button>
            <div style={{ fontSize: 11, color: G.tx3, fontWeight: 800, marginBottom: 6 }}>DATA & BACKUP</div>
            <div style={{ fontSize: 11, color: G.tx3, marginBottom: 8, lineHeight: 1.5 }}>
              {tier === "elite" && fbUser ? "Your games are synced to the cloud. A local backup file is still a good idea." : "Your data lives only on this device. Download a backup regularly \u2014 clearing your browser data erases everything otherwise."}
            </div>
            <button onClick={() => exportAll(data)} style={{ ...btn("g"), width: "100%", padding: 10, fontSize: 13, marginBottom: 8 }}>↓ Export all data (backup)</button>
            <button onClick={() => exportAllCSV(data)} style={{ ...btn("g"), width: "100%", padding: 10, fontSize: 13, marginBottom: 8, color: G.grn }}>↓ Export all games as CSV (spreadsheet)</button>
            <input id="bkprestore" type="file" accept=".json,application/json" style={{ display: "none" }} onChange={e => { const f = e.target.files[0]; if (f) onRestore(f); e.target.value = ""; }} />
            <button onClick={() => { const el = document.getElementById("bkprestore"); if (el) el.click(); }} style={{ ...btn("g"), width: "100%", padding: 10, fontSize: 13 }}>↑ Restore from backup</button>
          </div>

          {tier === "elite" && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: G.tx3, fontWeight: 800, marginBottom: 6 }}>CLOUD SYNC</div>
              {fbUser ? (
                <div style={{ background: G.sf2, borderRadius: 6, padding: "10px 12px", border: "1px solid " + G.bd }}>
                  <div style={{ fontSize: 11, color: G.grn, fontWeight: 800, marginBottom: 2 }}>● Synced</div>
                  <div style={{ fontSize: 11, color: G.tx3, marginBottom: 8 }}>{fbUser.email}</div>
                  <button onClick={onFbSignOut} style={{ ...btn("g"), fontSize: 11, padding: "6px 10px", color: G.red }}>Sign Out of Cloud</button>
                </div>
              ) : (
                <div style={{ background: G.sf2, borderRadius: 6, padding: "10px 12px", border: "1px solid " + G.bd }}>
                  <div style={{ fontSize: 11, color: G.tx3, marginBottom: 8 }}>Sign in to sync games across devices.</div>
                  <button onClick={onShowFbAuth} style={{ ...btn("p"), fontSize: 11, padding: "6px 10px", width: "100%" }}>Sign In / Create Account</button>
                </div>
              )}
            </div>
          )}
          <div style={{ borderTop: "1px solid " + G.bd, paddingTop: 14, marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: G.tx }}>QAB &amp; Hard Hit Tracking</div>
                <div style={{ fontSize: 10, color: G.tx3, marginTop: 2 }}>Show tagging panel after contact results</div>
              </div>
              <button onClick={() => onSavePrefs && onSavePrefs({ enableQAB: !enableQAB })}
                style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                  background: enableQAB ? G.gold : G.bd2, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute",
                  top: 3, left: enableQAB ? 23 : 3, transition: "left 0.2s" }} />
              </button>
            </div>
            <button onClick={onClearKey}
              style={{ ...btn("g"), width: "100%", color: G.red, border: "1px solid " + G.red + "44", fontSize: 12, padding: 10 }}>
              Sign Out / Clear License
            </button>
            <div style={{ fontSize: 10, color: G.tx3, marginTop: 6, textAlign: "center" }}>
              Questions? <a href="mailto:coach@armsight.app" style={{ color: G.gold, textDecoration: "none" }}>coach@armsight.app</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}