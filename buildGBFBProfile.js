function buildGBFBProfile(real) {
  const gbOuts = real.filter(p => ["go", "gdp"].includes(p.result)).length;
  const fbOuts = real.filter(p => ["fo", "po"].includes(p.result)).length;
  const total  = gbOuts + fbOuts;
  if (total < 5) return "neutral";
  const gbRate = gbOuts / total;
  if (gbRate >= 0.70) return "groundball";
  if (gbRate <= 0.30) return "flyball";
  return "neutral";
}
