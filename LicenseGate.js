/* --- LICENSE GATE --- */
function LicenseGate({ onUnlock }) {
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(false);

  const tryKey = async () => {
    setErr("");
    setChecking(true);
    const localTier = validateKey(key);
    if (!localTier) {
      setTimeout(() => { setChecking(false); setErr("Invalid license key. Check your key and try again, or contact coach@armsight.app"); }, 400);
      return;
    }
    // Format is plausible \u2014 ask the license server. Offline/unreachable falls back to
    // the local tier (grace); the App-level recheck verifies once a connection exists.
    const sv = await serverValidateKey(key);
    setChecking(false);
    if (sv.status === "invalid") {
      setErr("That key isn't in our records. Double-check it, or contact coach@armsight.app");
      return;
    }
    const tier = sv.status === "valid" ? sv.tier : localTier;
    if (sv.status === "valid") { try { localStorage.setItem(LIC_CHECK_KEY, JSON.stringify({ key: key.trim().toUpperCase(), tier, ts: Date.now() })); } catch (e) {} }
    saveLicense(key);
    onUnlock(key.trim().toUpperCase(), tier);
  };

  const is = { background: G.sf2, border: "2px solid " + G.bd2, borderRadius: 6, padding: "12px 14px", color: G.tx, fontSize: 16, fontWeight: 700, outline: "none", width: "100%", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Azeret Mono',monospace" };

  return (
    <div style={{ minHeight: "100vh", background: G.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <svg width="72" height="88" viewBox="0 0 112 124">
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
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 0.5, marginBottom: 4 }}>
            <span style={{ color: G.tx }}>Arm</span><span style={{ color: G.gold }}>Sight</span>
          </div>
          <div style={{ fontSize: 10, color: G.tx3, letterSpacing: 3, textTransform: "uppercase", fontWeight: 700 }}>Pitcher Intelligence</div>
        </div>
        <div style={{ ...cd, border: "2px solid " + G.bd2 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: G.tx, marginBottom: 4 }}>Enter Your License Key</div>
          <div style={{ fontSize: 12, color: G.tx3, marginBottom: 16 }}>Your key was emailed when you purchased. Format: AS-PRO-0001</div>
          <input
            style={is}
            value={key}
            onChange={e => { setKey(e.target.value.toUpperCase()); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && tryKey()}
            placeholder="AS-XXX-0000"
            autoFocus
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          {err && <div style={{ fontSize: 12, color: G.red, marginTop: 8, fontWeight: 600 }}>{err}</div>}
          <button onClick={tryKey} disabled={!key.trim() || checking}
            style={{ ...btn("p", !key.trim() || checking), width: "100%", marginTop: 12, padding: 14, fontSize: 15 }}>
            {checking ? "Checking..." : "Unlock App →"}
          </button>
          <div style={{ marginTop: 16, fontSize: 11, color: G.tx3, textAlign: "center" }}>
            Don't have a key? <a href="mailto:coach@armsight.app" style={{ color: G.gold, textDecoration: "none" }}>Contact us →</a>
          </div>
        </div>
      </div>
    </div>
  );
}