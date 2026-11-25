/* Mini interactive price chart: line + 50/200-day averages + levels, touch crosshair, range pills. */
'use strict';
function miniChart(host, bars, opt) {
  const wrap = document.createElement('div'); wrap.className = 'mc';
  const pills = document.createElement('div'); pills.className = 'mc-pills';
  const cv = document.createElement('canvas'); const tip = document.createElement('div'); tip.className = 'mc-tip';
  wrap.append(pills, cv, tip); host.append(wrap);
  const ranges = [['1M', 22], ['3M', 66], ['6M', 130], ['1Y', 260], ['2Y', 9999]];
  let N = opt.crypto ? 365 : 260, hover = null;
  const closes = bars.map(b => b[4]);
  const s50 = TA.sma(closes, 50), s200 = TA.sma(closes, 200);
  ranges.forEach(([lab, n]) => { const b = document.createElement('button'); b.textContent = lab; b.onclick = () => { N = opt.crypto && n === 260 ? 365 : n; pills.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); draw(); }; if ((opt.crypto ? 365 : 260) === (opt.crypto && n === 260 ? 365 : n)) b.classList.add('on'); pills.append(b); });
  function draw() {
    const dpr = window.devicePixelRatio || 1, w = wrap.clientWidth, h = 170; cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
    const c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, w, h);
    const st = Math.max(0, bars.length - N), seg = bars.slice(st);
    const vals = []; seg.forEach((b, i) => { vals.push(b[4]); if (s50[st + i]) vals.push(s50[st + i]); if (s200[st + i] && N > 70) vals.push(s200[st + i]); });
    let mn = Math.min(...vals), mx = Math.max(...vals); const pad = (mx - mn) * 0.08; mn -= pad; mx += pad;
    const X = i => 4 + i / (seg.length - 1 || 1) * (w - 52), Y = v => 8 + (1 - (v - mn) / (mx - mn || 1)) * (h - 26);
    c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 1; c.fillStyle = 'rgba(255,255,255,0.45)'; c.font = '10px ui-monospace,monospace';
    for (let k = 0; k <= 3; k++) { const v = mn + (mx - mn) * k / 3, y = Y(v); c.beginPath(); c.moveTo(0, y); c.lineTo(w - 48, y); c.stroke(); c.fillText(opt.fmt(v), w - 46, y + 3); }
    if (opt.levels) for (const [lv, col] of [[opt.levels.sup, '#22c55e'], [opt.levels.res, '#f43f5e']]) { if (!lv || lv.p < mn || lv.p > mx) continue; c.setLineDash([4, 4]); c.strokeStyle = col; c.globalAlpha = 0.7; c.beginPath(); c.moveTo(0, Y(lv.p)); c.lineTo(w - 48, Y(lv.p)); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
    const up = seg[seg.length - 1][4] >= seg[0][4]; const col = up ? '#34d399' : '#fb7185';
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, up ? 'rgba(52,211,153,0.28)' : 'rgba(251,113,133,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.beginPath(); seg.forEach((b, i) => i ? c.lineTo(X(i), Y(b[4])) : c.moveTo(X(i), Y(b[4]))); c.lineTo(X(seg.length - 1), h - 18); c.lineTo(X(0), h - 18); c.closePath(); c.fillStyle = g; c.fill();
    c.beginPath(); seg.forEach((b, i) => i ? c.lineTo(X(i), Y(b[4])) : c.moveTo(X(i), Y(b[4]))); c.strokeStyle = col; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke();
    const line = (arr, color) => { c.beginPath(); let on = false; seg.forEach((_, i) => { const v = arr[st + i]; if (v == null) { on = false; return; } on ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v)); on = true; }); c.strokeStyle = color; c.lineWidth = 1.3; c.stroke(); };
    line(s50, '#fbbf24'); if (N > 70) line(s200, '#a78bfa');
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillText(new Date(seg[0][0] * 86400000).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), 4, h - 4); const lt = new Date(seg[seg.length - 1][0] * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); c.fillText(lt, w - 52 - c.measureText(lt).width, h - 4);
    if (hover != null) { const i = Math.max(0, Math.min(seg.length - 1, hover)); const b = seg[i]; c.strokeStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(X(i), 4); c.lineTo(X(i), h - 18); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(X(i), Y(b[4]), 4, 0, 7); c.fill(); tip.style.display = 'block'; tip.innerHTML = `<b>${opt.fmt(b[4])}</b> · ${new Date(b[0] * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}${s50[st + i] ? ` · 50d ${opt.fmt(s50[st + i])}` : ''}`; tip.style.left = Math.min(w - 170, Math.max(0, X(i) - 80)) + 'px'; }
    else tip.style.display = 'none';
    cv._seg = seg; cv._X = X;
  }
  const mv = e => { const r = cv.getBoundingClientRect(); const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left; const seg = cv._seg; hover = Math.round((x - 4) / (r.width - 52) * (seg.length - 1)); draw(); };
  cv.addEventListener('pointermove', mv); cv.addEventListener('touchmove', e => { mv(e); }, { passive: true }); cv.addEventListener('pointerleave', () => { hover = null; draw(); });
  const legend = document.createElement('div'); legend.className = 'mc-leg'; legend.innerHTML = '<i style="background:#fbbf24"></i>50-day <i style="background:#a78bfa"></i>200-day' + (opt.levels ? ' <i style="background:#22c55e"></i>support <i style="background:#f43f5e"></i>resistance' : '');
  wrap.append(legend);
  requestAnimationFrame(draw); new ResizeObserver(draw).observe(wrap);
}
