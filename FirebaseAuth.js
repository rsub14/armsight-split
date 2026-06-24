/* --- FIREBASE AUTH SCREEN (Elite only) --- */
function FirebaseAuth({ onSignedIn }) {
  const [mode, setMode]       = useState("login"); // login | signup | reset
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [err, setErr]         = useState("");
  const [msg, setMsg]         = useState("");
  const [loading, setLoading] = useState(false);

  const is = { background: G.sf2, border: "2px solid " + G.bd2, borderRadius: 6, padding: "12px 14px", color: G.tx, fontSize: 15, outline: "none", width: "100%", marginBottom: 10 };

  const handleAuth = async () => {
    setErr(""); setMsg(""); setLoading(true);
    const { auth } = getFB();
    if (!auth) { setErr("Connection error. Check your internet."); setLoading(false); return; }
    try {
      if (mode === "login") {
        const cred = await auth.signInWithEmailAndPassword(email, pass);
        onSignedIn(cred.user.uid, cred.user.email);
      } else if (mode === "signup") {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        onSignedIn(cred.user.uid, cred.user.email);
      } else if (mode === "reset") {
        await auth.sendPasswordResetEmail(email);
        setMsg("Reset email sent — check your inbox.");
      }
    } catch(e) {
      const msgs = {
        "auth/user-not-found": "No account found with that email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/email-already-in-use": "An account already exists with that email.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/invalid-email": "Please enter a valid email address.",
      };
      setErr(msgs[e.code] || e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ ...cd, border: "2px solid " + G.bd2, maxWidth: 380, margin: "0 auto" }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: G.gold, marginBottom: 4 }}>
        {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Reset Password"}
        <span style={{ marginLeft: 8, background: "#00ccff22", color: "#00ccff", borderRadius: 3, padding: "2px 7px", fontSize: 9, fontWeight: 800 }}>ELITE</span>
      </div>
      <div style={{ fontSize: 11, color: G.tx3, marginBottom: 16 }}>
        {mode === "login" ? "Sign in to sync your games across devices." : mode === "signup" ? "Create your ArmSight Elite account." : "Enter your email to receive a reset link."}
      </div>
      <input style={is} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
      {mode !== "reset" && <input style={is} type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />}
      {err && <div style={{ fontSize: 12, color: G.red, marginBottom: 8 }}>{err}</div>}
      {msg && <div style={{ fontSize: 12, color: G.grn, marginBottom: 8 }}>{msg}</div>}
      <button onClick={handleAuth} disabled={loading || !email}
        style={{ ...btn("p", loading || !email), width: "100%", padding: 12, fontSize: 14, marginBottom: 10 }}>
        {loading ? "Please wait..." : mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Email"}
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
        {mode === "login" && <button onClick={() => { setMode("signup"); setErr(""); }} style={{ background: "transparent", border: "none", color: G.gold, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Create account</button>}
        {mode === "signup" && <button onClick={() => { setMode("login"); setErr(""); }} style={{ background: "transparent", border: "none", color: G.gold, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Back to sign in</button>}
        {mode !== "reset" && <button onClick={() => { setMode("reset"); setErr(""); }} style={{ background: "transparent", border: "none", color: G.tx3, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Forgot password?</button>}
        {mode === "reset" && <button onClick={() => { setMode("login"); setErr(""); setMsg(""); }} style={{ background: "transparent", border: "none", color: G.gold, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Back to sign in</button>}
      </div>
    </div>
  );
}