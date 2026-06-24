function pdMatch(p, pts, f) {
  if (!pdSeen(p)) return false;
  if (f.pitch !== "All") { const fam = ({ fastball: "Fastball", breaking: "Breaking", offspeed: "Offspeed" })[getPitchFamily(p.type, pts || [])] || "Other"; if (fam !== f.pitch) return false; }
  if (f.count !== "All") { const cb = p.balls > p.strikes ? "Ahead" : p.balls < p.strikes ? "Behind" : "Even"; if (cb !== f.count) return false; }
  if (f.outs !== "All" && String(p.outs) !== f.outs) return false;
  if (f.run !== "All") { const r = p.runners || {}; const rb = (r.second || r.third) ? "RISP" : r.first ? "Men on" : "Empty"; if (rb !== f.run) return false; }
  return true;
}