function PrintReport({ type, data, onClose }) {
  const printDate = new Date().toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });

  const CSS = "* { box-sizing: border-box; margin: 0; padding: 0; }"
    + "body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; padding: 28px 32px; font-size: 13px; }"
    + ".hdr { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 18px; }"
    + ".logo { font-size: 22px; font-weight: 900; letter-spacing: 2px; }"
    + ".logo span { color: #D4A800; }"
    + ".hdr-r { text-align: right; font-size: 11px; color: #555; line-height: 1.7; }"
    + ".rpt-title { font-size: 17px; font-weight: 900; margin-bottom: 3px; color: #111; }"
    + "h2 { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #888; margin: 16px 0 6px; border-bottom: 1px solid #eee; padding-bottom: 4px; }"
    + ".grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }"
    + ".stat-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; }"
    + ".stat { background: #f5f5f5; border-radius: 5px; padding: 8px 12px; text-align: center; min-width: 70px; }"
    + ".stat-n { font-size: 20px; font-weight: 900; color: #D4A800; font-family: monospace; }"
    + ".stat-l { font-size: 8px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #888; margin-top: 2px; }"
    + ".br { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }"
    + ".bl { width: 32px; font-size: 11px; font-weight: 800; text-align: right; }"
    + ".bt { flex: 1; height: 14px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }"
    + ".bf { height: 100%; border-radius: 3px; }"
    + ".bp { width: 36px; font-size: 10px; font-weight: 700; color: #555; text-align: right; }"
    + ".note { font-size: 12px; color: #333; line-height: 1.8; padding-left: 10px; border-left: 3px solid #D4A800; margin-bottom: 4px; }"
    + ".zg { display: inline-grid; grid-template-columns: 24px 38px 38px 38px 24px; grid-template-rows: 24px 38px 38px 38px 24px 24px; gap: 2px; }"
    + ".zc { border-radius: 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; font-family: monospace; border: 1.5px solid #ccc; }"
    + ".zs { background: #f8f8f8; } .zb { background: #efefef; border-style: dashed; font-size: 8px; color: #aaa; }"
    + ".zh { background: rgba(220,50,50,0.35); } .zw { background: rgba(255,165,0,0.35); } .zco { background: rgba(50,100,220,0.25); }"
    + ".ct { width: 100%; border-collapse: collapse; font-size: 11px; }"
    + ".ct th { background: #111; color: #fff; padding: 5px 8px; text-align: center; font-size: 9px; letter-spacing: 1px; }"
    + ".ct td { padding: 4px 8px; border: 1px solid #e0e0e0; text-align: center; }"
    + ".risp { margin-bottom: 10px; } .risp-l { font-size: 10px; font-weight: 700; color: #555; margin-bottom: 3px; }"
    + ".ftag { display: inline-block; background: #D4A800; color: #000; border-radius: 3px; padding: 2px 7px; font-size: 9px; font-weight: 700; margin: 2px 3px 2px 0; }"
    + ".ftr { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e0e0e0; font-size: 9px; color: #aaa; display: flex; justify-content: space-between; }"
    + "@media print { body { padding: 16px 20px; } }";

  const barHTML = (mix) => {
    if (!mix || !mix.length) return "<em style='color:#aaa;font-size:11px'>No data</em>";
    const max = mix[0].pct;
    return mix.map(d => {
      const color = DPC[d.type] || ("hsl(" + ((d.type.charCodeAt(0)*47)%360) + ",60%,50%)");
      return '<div class="br"><div class="bl" style="color:' + color + '">' + d.type + '</div><div class="bt"><div class="bf" style="width:' + ((d.pct/max)*100) + '%;background:' + color + '"></div></div><div class="bp">' + d.pct + '%</div></div>';
    }).join("");
  };

  const zoneHTML = (zoneCounts, total) => {
    if (!total) return "<em style='color:#aaa;font-size:11px'>No location data</em>";
    const maxPct = Math.max.apply(null, Object.values(zoneCounts).map(function(c) { return total > 0 ? (c/total)*100 : 0; }).concat([1]));
    let out = '<div class="zg">';
    STRIKE_ZONES.forEach(function(z) {
      const c = zoneCounts[z.k] || 0;
      const pct = total > 0 ? Math.round((c/total)*100) : 0;
      const ratio = pct / maxPct;
      const cls = ratio > 0.65 ? "zc zh" : ratio > 0.35 ? "zc zw" : ratio > 0 ? "zc zco" : "zc zs";
      out += '<div class="' + cls + '" style="grid-row:' + (z.r+1) + ';grid-column:' + (z.c+1) + '">' + (c > 0 ? pct + "%" : "-") + '</div>';
    });
    BALL_ZONES.forEach(function(z) {
      const c = zoneCounts[z.k] || 0;
      const pct = total > 0 ? Math.round((c/total)*100) : 0;
      out += '<div class="zc zb" style="grid-row:' + (z.r+1) + '/span ' + z.rowSpan + ';grid-column:' + (z.c+1) + '/span ' + z.colSpan + '">' + (c > 0 ? pct + "%" : (z.k === "dirt" ? "DIRT" : "")) + '</div>';
    });
    return out + '</div>';
  };

  const mkTop = function(ty, tot) {
    if (!tot) return null;
    var top = Object.entries(ty).sort(function(a,b){return b[1]-a[1];})[0];
    return top ? { type: top[0], pct: ((top[1]/tot)*100).toFixed(0) } : null;
  };

  const buildLibraryHTML = () => {
    const d = data;
    if (!d.t) return "<p>No data available.</p>";
    const t = d.t;
    const notes = [];
    if (t.mix[0]) notes.push("Primary pitch: <strong>" + t.mix[0].type + "</strong> (" + t.mix[0].pct + "%)");
    var fp = mkTop(t.fpT, t.fpN); if (fp && t.fpN >= 2) notes.push("First pitch: <strong>" + fp.type + "</strong> " + fp.pct + "%");
    var ts = mkTop(t.tsT, t.tsN); if (ts && t.tsN >= 2) notes.push("Two strikes: <strong>" + ts.type + "</strong> " + ts.pct + "%");
    var bh = mkTop(t.bhT, t.bhN); if (bh && t.bhN >= 2) notes.push("Behind in count: <strong>" + bh.type + "</strong> " + bh.pct + "%");
    if (t.vLN >= 3) { var l = mkTop(t.vLT, t.vLN); if (l) notes.push("vs LHB: <strong>" + l.type + "</strong> " + l.pct + "%"); }
    if (t.vRN >= 3) { var r = mkTop(t.vRT, t.vRN); if (r) notes.push("vs RHB: <strong>" + r.type + "</strong> " + r.pct + "%"); }
    var wps = d.viewPitches.filter(function(p){return p.type==="WP";}); if (wps.length) notes.push("Wild pitches: " + wps.length + " — run on dirt");
    var sbs = d.viewPitches.filter(function(p){return p.type==="SB";}); if (sbs.length) notes.push("Stolen bases allowed: " + sbs.length);
    const zc = {};
    STRIKE_ZONES.concat(BALL_ZONES).forEach(function(z){zc[z.k]=0;});
    d.viewPitches.forEach(function(p){if(p.location && zc[p.location]!==undefined) zc[p.location]++;});
    var rispHTML = "";
    if (d.rispData && d.rispData.length) {
      rispHTML = d.rispData.map(function(s) {
        var mix = Object.entries(s.freq).map(function(e){return{type:e[0],count:e[1],pct:+((e[1]/s.total)*100).toFixed(1)};}).sort(function(a,b){return b.count-a.count;});
        return '<div class="risp"><div class="risp-l">' + s.label + ' (' + s.total + ' pitches)</div>' + barHTML(mix) + '</div>';
      }).join("");
    }
    var ttoHTML = "";
    if (t.tto && Object.keys(t.tto).length > 1) {
      ttoHTML = Object.entries(t.tto).sort(function(a,b){return parseInt(a[0])-parseInt(b[0]);}).map(function(e) {
        var tot = Object.values(e[1]).reduce(function(a,b){return a+b;},0);
        var mix = Object.entries(e[1]).map(function(f){return{type:f[0],count:f[1],pct:+((f[1]/tot)*100).toFixed(1)};}).sort(function(a,b){return b.count-a.count;});
        var lbl = e[0]==="1"?"1st TTO":e[0]==="2"?"2nd TTO":e[0]==="3"?"3rd TTO":e[0]+"th TTO";
        return '<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:#888;margin-bottom:3px">' + lbl + ' (' + tot + ')</div>' + barHTML(mix) + '</div>';
      }).join("");
    }
    return '<div class="stat-row">'
      + '<div class="stat"><div class="stat-n">' + t.total + '</div><div class="stat-l">Pitches</div></div>'
      + (t.mix[0] ? '<div class="stat"><div class="stat-n">' + t.mix[0].type + '</div><div class="stat-l">Primary</div></div><div class="stat"><div class="stat-n">' + t.mix[0].pct + '%</div><div class="stat-l">Primary %</div></div>' : "")
      + (t.avgVelo ? '<div class="stat"><div class="stat-n">' + t.avgVelo + '</div><div class="stat-l">Avg Velo</div></div>' : "")
      + '</div>'
      + '<div class="grid2">'
      + '<div>'
      + '<h2>Pitch Mix</h2>' + barHTML(t.mix)
      + (t.fpN >= 2 ? '<h2>First Pitch (' + t.fpN + ')</h2>' + barHTML(Object.entries(t.fpT).map(function(e){return{type:e[0],count:e[1],pct:+((e[1]/t.fpN)*100).toFixed(1)};}).sort(function(a,b){return b.count-a.count;})) : "")
      + (t.tsN >= 2 ? '<h2>Two Strikes (' + t.tsN + ')</h2>' + barHTML(Object.entries(t.tsT).map(function(e){return{type:e[0],count:e[1],pct:+((e[1]/t.tsN)*100).toFixed(1)};}).sort(function(a,b){return b.count-a.count;})) : "")
      + (t.bhN >= 2 ? '<h2>Behind (' + t.bhN + ')</h2>' + barHTML(Object.entries(t.bhT).map(function(e){return{type:e[0],count:e[1],pct:+((e[1]/t.bhN)*100).toFixed(1)};}).sort(function(a,b){return b.count-a.count;})) : "")
      + (t.vLN >= 3 ? '<h2>vs LHB (' + t.vLN + ')</h2>' + barHTML(Object.entries(t.vLT).map(function(e){return{type:e[0],count:e[1],pct:+((e[1]/t.vLN)*100).toFixed(1)};}).sort(function(a,b){return b.count-a.count;})) : "")
      + (t.vRN >= 3 ? '<h2>vs RHB (' + t.vRN + ')</h2>' + barHTML(Object.entries(t.vRT).map(function(e){return{type:e[0],count:e[1],pct:+((e[1]/t.vRN)*100).toFixed(1)};}).sort(function(a,b){return b.count-a.count;})) : "")
      + '</div>'
      + '<div>'
      + '<h2>Zone Heat Map</h2>' + zoneHTML(zc, d.viewPitches.length)
      + '<h2>Scout Notes</h2>' + (notes.map(function(n){return '<div class="note">'+n+'</div>';}).join("") || "<em style='color:#aaa;font-size:11px'>Chart more pitches</em>")
      + (ttoHTML ? '<h2>Times Through Order</h2>' + ttoHTML : "")
      + '</div></div>'
      + (rispHTML ? '<h2>Runners in Scoring Position</h2><div class="grid2">' + rispHTML + '</div>' : "");
  };

  const buildSituationsHTML = () => {
    const d = data;
    if (!d.total) return "<p>No pitches match current filters.</p>";
    var filterTags = Object.entries(d.filters).filter(function(e){return e[1]&&e[1].size>0;}).map(function(e){return '<span class="ftag">'+e[0]+': '+Array.from(e[1]).join("+")+'</span>';}).join("");
    var filterBanner = filterTags
      ? '<div style="background:#fffbe6;border:2px solid #D4A800;border-radius:6px;padding:10px 14px;margin-bottom:16px">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92700a;margin-bottom:6px">ACTIVE FILTERS</div>'
        + filterTags + '</div>'
      : '<div style="background:#f9f9f9;border:1px solid #ddd;border-radius:6px;padding:8px 14px;margin-bottom:16px;font-size:10px;color:#888">No filters applied — showing all pitches for this team/pitcher</div>';
    var counts = []; for (var b=0;b<=3;b++) for (var s=0;s<=2;s++) counts.push(b+"-"+s);
    var allTypes = Array.from(new Set(d.filtered.map(function(p){return p.type;}))).sort();
    var countTableHTML = allTypes.length ? '<table class="ct"><thead><tr><th>Count</th>' + allTypes.map(function(t){return '<th>'+t+'</th>';}).join("") + '<th>Total</th></tr></thead><tbody>' + counts.map(function(ck){
      var cb = d.countBreakdown[ck]; if (!cb) return "";
      var rt = Object.values(cb).reduce(function(a,b){return a+b;},0);
      return '<tr><td style="font-weight:700">'+ck+'</td>' + allTypes.map(function(t){var c=cb[t]||0;return '<td>'+(c>0?c+' ('+Math.round(c/rt*100)+'%)':'-')+'</td>';}).join("") + '<td style="font-weight:700">'+rt+'</td></tr>';
    }).filter(Boolean).join("") + '</tbody></table>' : "";
    return '<div class="stat-row">'
      + '<div class="stat"><div class="stat-n">' + d.total + '</div><div class="stat-l">Pitches</div></div>'
      + d.typeBD.slice(0,4).map(function(x){var col=DPC[x.type]||'#D4A800';return '<div class="stat"><div class="stat-n" style="color:'+col+'">'+x.pct+'%</div><div class="stat-l">'+x.type+'</div></div>';}).join("")
      + '</div>'
      + filterBanner
      + '<div class="grid2">'
      + '<div><h2>Pitch Mix</h2>' + barHTML(d.typeBD) + '<h2>Count Breakdown</h2>' + countTableHTML + '</div>'
      + '<div><h2>Zone Heat Map</h2>' + zoneHTML(d.zoneCounts, d.total) + '</div>'
      + '</div>';
  };

  const buildHittingHTML = () => {
    const d = data;
    const rows = d.rows || [];
    if (!rows.length) return "<p>No hitter data in this scope.</p>";
    const rowsHTML = rows.map(function(r) {
      return '<tr><td style="text-align:left;font-weight:700">' + r.name + '</td>'
        + '<td>' + r.qab + '</td><td>' + r.hh + '</td><td>' + r.whiff + '</td><td>' + r.chase + '</td><td>' + r.take + '</td></tr>';
    }).join("");
    return '<div class="stat-row">'
      + '<div class="stat"><div class="stat-n">' + d.batters + '</div><div class="stat-l">Batters</div></div>'
      + '<div class="stat"><div class="stat-n">' + d.teamQAB + '</div><div class="stat-l">Team QAB</div></div>'
      + '<div class="stat"><div class="stat-n">' + d.teamHH + '</div><div class="stat-l">Team HH</div></div>'
      + '</div>'
      + (d.filterNote ? '<div style="background:#f9f9f9;border:1px solid #ddd;border-radius:6px;padding:8px 14px;margin-bottom:16px;font-size:10px;color:#888">' + d.filterNote + '</div>' : "")
      + '<h2>Hitters</h2>'
      + '<table class="ct"><thead><tr><th style="text-align:left">Hitter</th><th>QAB</th><th>HH</th><th>Whiff</th><th>Chase</th><th>Take</th></tr></thead><tbody>'
      + rowsHTML
      + '</tbody></table>';
  };

  const reportTitle = type === "library"
    ? (data.name + " \u2014 " + data.selTeam)
    : type === "hitting"
    ? (data.team + " \u2014 Hitting")
    : (data.team + (data.pitcher !== "all" ? " \u2014 " + data.pitcher : " \u2014 All Pitchers"));

  const reportSubtitle = type === "library"
    ? ("Library Report \u00B7 " + (data.isStaff ? "Staff Overview" : "Pitcher Profile"))
    : type === "hitting"
    ? "Hitting Report"
    : "Game Situations Report";

  const handlePrint = () => {
    const bodyHTML = type === "library" ? buildLibraryHTML() : type === "hitting" ? buildHittingHTML() : buildSituationsHTML();
    const fullHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ArmSight Report</title><style>' + CSS + '</style></head><body>'
      + '<div class="hdr"><div><div class="logo"><span>ARM</span>SIGHT</div><div style="font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-top:2px">armsight.app</div></div>'
      + '<div class="hdr-r"><div class="rpt-title">' + reportTitle + '</div><div>' + reportSubtitle + '</div><div>' + printDate + '</div></div></div>'
      + bodyHTML
      + '<div class="ftr"><div>Generated by ArmSight \u00B7 armsight.app</div><div>' + printDate + '</div></div>'
      + '</body></html>';
    const w = window.open("", "_blank", "width=920,height=700");
    if (!w) { alert("Please allow popups for armsight.app to print reports."); return; }
    w.document.write(fullHTML);
    w.document.close();
    w.focus();
    setTimeout(function() { w.print(); }, 500);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: G.sf, border: "1px solid " + G.bd, borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: G.gold, marginBottom: 3 }}>{reportTitle}</div>
            <div style={{ fontSize: 11, color: G.tx3, fontFamily: "'Azeret Mono',monospace", letterSpacing: 1 }}>{reportSubtitle}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: G.tx3, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: G.tx2, marginBottom: 18, lineHeight: 1.7 }}>
          Opens a print-ready page in a new tab. Use your browser's <strong style={{ color: G.tx }}>Print</strong> or <strong style={{ color: G.tx }}>Save as PDF</strong> option.
        </div>
        <button onClick={handlePrint}
          style={{ width: "100%", padding: "14px", background: G.gold, color: "#000", border: "none", borderRadius: 8, fontFamily: "'Anybody',sans-serif", fontSize: 15, fontWeight: 900, cursor: "pointer", letterSpacing: 1, marginBottom: 10 }}>
          🖨 Open Print Page
        </button>
        <button onClick={onClose}
          style={{ width: "100%", padding: "10px", background: "transparent", color: G.tx3, border: "1px solid " + G.bd, borderRadius: 8, fontFamily: "'Anybody',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
