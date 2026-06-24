function RosterManager({ roster = [], onSave, onClose }) {
  const [list, setList] = useState(roster.length ? roster : []);
  const [num, setNum] = useState("");
  const [name, setName] = useState("");
  const [bats, setBats] = useState("R");
  const add = () => {
    if (!name.trim()) return;
    setList(prev => [...prev, { id: Date.now() + Math.random(), num: num.trim(), name: name.trim(), bats }]);
    setNum(""); setName(""); setBats("R");
  };
  const upd = (id, field, val) => setList(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  const del = (id) => setList(prev => prev.filter(p => p.id !== id));
  const save = () => { onSave(list); onClose(); };
  const is = { background: G.sf2, border: "2px solid " + G.bd2, borderRadius: 6, padding: "8px 10px", color: G.tx, fontSize: 13, outline: "none" };
  const batBtn = (val, cur, set) => (
    <button onClick={() => set(val)} style={{ padding: "7px 11px", borderRadius: 5, border: "none", background: cur === val ? G.gold : G.sf2, color: cur === val ? "#000" : G.tx2, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{val}</button>
  );
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, paddingTop: 70, overflowY: "auto" }}>
      <div style={{ background: G.bg, border: "1px solid " + G.bd2, borderRadius: 14, padding: 18, maxWidth: 460, width: "100%", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, position: "sticky", top: 0, background: G.bg, paddingBottom: 8, zIndex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: G.tx }}>Team Roster</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={save} style={{ ...btn("g"), fontSize: 12, padding: "6px 14px", color: G.gold, fontWeight: 800 }}>Save</button>
            <button onClick={onClose} style={{ ...btn("g"), fontSize: 12, padding: "6px 10px", color: G.tx3 }}>Close</button>
          </div>
        </div>
        <div style={{ fontSize: 10, color: G.tx3, marginBottom: 12, lineHeight: 1.5 }}>Add your players once — number, name, and bat side (R / L / B for switch). Pick them into each game’s lineup instead of retyping. A switch hitter auto-bats opposite the pitcher you’re facing.</div>

        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
          <input value={num} onChange={e => setNum(e.target.value)} placeholder="#" style={{ ...is, width: 42, textAlign: "center" }} />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Player name" style={{ ...is, flex: 1 }} onKeyDown={e => { if (e.key === "Enter") add(); }} />
          <div style={{ display: "flex", gap: 3 }}>{batBtn("R", bats, setBats)}{batBtn("L", bats, setBats)}{batBtn("B", bats, setBats)}</div>
          <button onClick={add} style={{ ...btn("g"), padding: "8px 12px", color: G.grn, fontWeight: 800 }}>+</button>
        </div>

        {list.length === 0 ? (
          <div style={{ fontSize: 12, color: G.tx3, textAlign: "center", padding: "16px 0" }}>No players yet. Add your roster above.</div>
        ) : [...list].sort((a, b) => (parseInt(a.num) || 99) - (parseInt(b.num) || 99)).map(p => (
          <div key={p.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
            <input value={p.num} onChange={e => upd(p.id, "num", e.target.value)} style={{ ...is, width: 42, textAlign: "center", fontFamily: "'Azeret Mono',monospace" }} />
            <input value={p.name} onChange={e => upd(p.id, "name", e.target.value)} style={{ ...is, flex: 1 }} />
            <div style={{ display: "flex", gap: 3 }}>{batBtn("R", p.bats, v => upd(p.id, "bats", v))}{batBtn("L", p.bats, v => upd(p.id, "bats", v))}{batBtn("B", p.bats, v => upd(p.id, "bats", v))}</div>
            <button onClick={() => del(p.id)} style={{ ...btn("g"), padding: "7px 9px", color: G.red }}>×</button>
          </div>
        ))}
        <button onClick={save} style={{ ...btn("g"), width: "100%", marginTop: 14, padding: 11, fontSize: 14, fontWeight: 800, color: G.gold, border: "2px solid " + G.gold + "55" }}>Save Roster</button>
      </div>
    </div>
  );
}
