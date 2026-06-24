function discCellM(den, num) {
  const v = den > 0 ? num / den : -1;
  if (den === 0) return { bg: G.sf2, col: G.tx3, txt: null };
  const pct = Math.round(v * 100) + "%";
  if (den < 3) return { bg: "rgba(130,130,130,0.22)", col: G.tx3, txt: pct };
  const a = (0.18 + Math.min(v, 1) * 0.72).toFixed(2);
  return { bg: "rgba(212,175,55," + a + ")", col: v >= 0.55 ? "#1a1200" : G.tx, txt: pct };
}