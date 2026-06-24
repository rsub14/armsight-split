function BaseW({ runners, onChange }) {
  const size = 52;
  const pos = { second: [0.5, 0.05], third: [0.05, 0.5], first: [0.95, 0.5] };
  const ds = size * 0.24;
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute" }}>
        <polygon points="50,8 92,50 50,92 8,50" fill="none" stroke={G.bd2} strokeWidth={3} />
      </svg>
      {["second", "third", "first"].map(b => {
        const [fx, fy] = pos[b];
        const on = runners && runners[b];
        return (
          <div key={b} onClick={() => onChange({ ...runners, [b]: !on })}
            style={{
              position: "absolute", left: `${fx * 100}%`, top: `${fy * 100}%`,
              transform: "translate(-50%,-50%) rotate(45deg)",
              width: ds, height: ds, borderRadius: 2, cursor: "pointer",
              background: on ? G.gold : "transparent",
              border: `3px solid ${on ? G.gold : G.bd2}`,
            }} />
        );
      })}
    </div>
  );
}