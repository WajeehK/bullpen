/* Bullpen analysis: indicators and rule-based write-ups from real numbers only. */
'use strict';
const TA = {
  sma(a, n) { const o = new Array(a.length).fill(null); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n; } return o; },
  ema(a, n) { const o = new Array(a.length).fill(null); const k = 2 / (n + 1); let e = null; for (let i = 0; i < a.length; i++) { if (a[i] == null) continue; e = e == null ? a[i] : a[i] * k + e * (1 - k); if (i >= n - 1) o[i] = e; } return o; },
  rsi(a, n = 14) {
    const o = new Array(a.length).fill(null); if (a.length <= n) return o;
    let g = 0, l = 0; for (let i = 1; i <= n; i++) { const d = a[i] - a[i - 1]; if (d > 0) g += d; else l -= d; }
    g /= n; l /= n; o[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    for (let i = n + 1; i < a.length; i++) { const d = a[i] - a[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    return o;
  },
  macd(a) { const e12 = TA.ema(a, 12), e26 = TA.ema(a, 26); const m = a.map((_, i) => e12[i] != null && e26[i] != null ? e12[i] - e26[i] : null); const firstIdx = m.findIndex(v => v != null); const sig = new Array(a.length).fill(null); const s2 = TA.ema(m.slice(firstIdx), 9); s2.forEach((v, i) => sig[i + firstIdx] = v); return { m, sig, h: m.map((v, i) => v != null && sig[i] != null ? v - sig[i] : null) }; },
  lastCross(x, y, from = 0) { for (let i = x.length - 1; i > Math.max(1, from); i--) { if (x[i] == null || y[i] == null || x[i - 1] == null || y[i - 1] == null) return null; const a = x[i] - y[i], b = x[i - 1] - y[i - 1]; if ((a > 0) !== (b > 0)) return { i, up: a > 0 }; } return null; },
  ret(a, n) { return a.length > n ? a[a.length - 1] / a[a.length - 1 - n] - 1 : null; },
  vol(a, n, ann) { const r = []; for (let i = Math.max(1, a.length - n); i < a.length; i++) r.push(Math.log(a[i] / a[i - 1])); if (r.length < 5) return null; const m = r.reduce((x, y) => x + y, 0) / r.length; const v = r.reduce((x, y) => x + (y - m) ** 2, 0) / (r.length - 1); return Math.sqrt(v * ann); },
  maxDD(a, n) { let pk = -Infinity, dd = 0, at = null; for (let i = Math.max(0, a.length - n); i < a.length; i++) { pk = Math.max(pk, a[i]); const d = a[i] / pk - 1; if (d < dd) { dd = d; at = i; } } return { dd, at }; },
  levels(h, l, c, look = 180) {
    const n = h.length, st = Math.max(0, n - look), piv = [];
    for (let i = st + 3; i < n - 3; i++) {
      let hi = true, lo = true;
      for (let k = 1; k <= 3; k++) { if (h[i] < h[i - k] || h[i] < h[i + k]) hi = false; if (l[i] > l[i - k] || l[i] > l[i + k]) lo = false; }
      if (hi) piv.push({ p: h[i], i, t: 'h' }); if (lo) piv.push({ p: l[i], i, t: 'l' });
    }
    piv.sort((a, b) => a.p - b.p);
    const cl = [];
    for (const p of piv) { const g = cl[cl.length - 1]; if (g && p.p / g.lo - 1 < 0.025) { g.pts.push(p); g.hi = p.p; } else cl.push({ lo: p.p, hi: p.p, pts: [p] }); }
    const price = c[n - 1];
    const lv = cl.map(g => ({ p: g.pts.reduce((a, b) => a + b.p, 0) / g.pts.length, n: g.pts.length, last: Math.max(...g.pts.map(x => x.i)) }));
    const sup = lv.filter(x => x.p < price * 0.995).sort((a, b) => (b.n * 2 - (price - b.p) / price * 40) - (a.n * 2 - (price - a.p) / price * 40))[0];
    const res = lv.filter(x => x.p > price * 1.005).sort((a, b) => (b.n * 2 - (b.p - price) / price * 40) - (a.n * 2 - (a.p - price) / price * 40))[0];
    return { sup, res };
  },
  beta(a, b) { // aligned arrays of closes
    const ra = [], rb = []; for (let i = 1; i < a.length; i++) { ra.push(a[i] / a[i - 1] - 1); rb.push(b[i] / b[i - 1] - 1); }
    if (ra.length < 30) return null; const ma = ra.reduce((x, y) => x + y) / ra.length, mb = rb.reduce((x, y) => x + y) / rb.length;
    let cov = 0, vb = 0; for (let i = 0; i < ra.length; i++) { cov += (ra[i] - ma) * (rb[i] - mb); vb += (rb[i] - mb) ** 2; }
    const corr = cov / Math.sqrt(vb * ra.reduce((x, y) => x + (y - ma) ** 2, 0)); return { beta: cov / vb, corr };
  }
};

// ---------------------------------------------------------------- wording helpers
const W = {
  seed: 1,
  pick(arr) { W.seed = (W.seed * 9301 + 49297) % 233280; return arr[Math.floor(W.seed / 233280 * arr.length)]; },
  pct(x, d = 1) { if (x == null || !isFinite(x)) return 'n/a'; return (x >= 0 ? '+' : '') + (x * 100).toFixed(d) + '%'; },
  pctAbs(x, d = 1) { return x == null ? 'n/a' : (Math.abs(x) * 100).toFixed(d) + '%'; },
  n(x, d = 1) { return x == null || !isFinite(x) ? 'n/a' : x.toFixed(d); },
  big(x) { if (x == null || !isFinite(x)) return 'n/a'; const a = Math.abs(x); const s = x < 0 ? '-' : ''; if (a >= 1e12) return s + (a / 1e12).toFixed(2) + 'T'; if (a >= 1e9) return s + (a / 1e9).toFixed(a >= 1e11 ? 0 : 1) + 'B'; if (a >= 1e6) return s + (a / 1e6).toFixed(1) + 'M'; if (a >= 1e3) return s + (a / 1e3).toFixed(1) + 'K'; return s + a.toFixed(0); },
  date(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); },
  dshort(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); },
  ago(ts) { const s = (Date.now() - ts) / 1000; if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm ago'; if (s < 86400) return Math.round(s / 3600) + 'h ago'; return Math.round(s / 86400) + 'd ago'; },
  daysTo(ts) { return Math.round((ts - Date.now()) / 86400000); }
};

// signal helper: s in [-1,1], w weight
function sig(name, reading, s, w, group) { return { name, reading, s: Math.max(-1, Math.min(1, s)), w, group }; }

const POS = ['beat', 'beats', 'surge', 'surges', 'soar', 'soars', 'record', 'upgrade', 'upgraded', 'raises', 'raised', 'jump', 'jumps', 'rally', 'rallies', 'gain', 'gains', 'strong', 'growth', 'wins', 'win', 'contract', 'approval', 'approved', 'bullish', 'outperform', 'partnership', 'profit', 'boost', 'tops', 'expands', 'rebound', 'rises', 'higher', 'climbs', 'breakout', 'buys', 'bought', 'buyback', 'beat', 'upgrades'];
const NEG = ['miss', 'misses', 'plunge', 'plunges', 'slump', 'slumps', 'falls', 'fall', 'drop', 'drops', 'cut', 'cuts', 'downgrade', 'downgraded', 'lawsuit', 'probe', 'investigation', 'selling', 'bearish', 'weak', 'loss', 'losses', 'decline', 'declines', 'tumble', 'tumbles', 'crash', 'warning', 'warns', 'risk', 'fraud', 'layoffs', 'recall', 'sinks', 'lower', 'slides', 'slide', 'hack', 'exploit', 'delay', 'delayed', 'bubble', 'overvalued'];
function tone(title) { const w = title.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/); let p = 0, n = 0; for (const x of w) { if (POS.includes(x)) p++; if (NEG.includes(x)) n++; } return p > n ? 1 : n > p ? -1 : 0; }

const AN = {
  // ---------------------------------------------------------------- Chartist
  chartist(ctx) {
    const { bars, name, money } = ctx; const c = bars.map(b => b[4]), h = bars.map(b => b[2]), l = bars.map(b => b[3]);
    const n = c.length, p = c[n - 1];
    const out = { id: 'chartist', lines: [], signals: [], bull: [], bear: [], facts: [] };
    if (n < 30) { out.lines.push(`I only have ${n} daily bars for ${name}, which is too short for a proper chart read.`); out.headline = 'NOT ENOUGH DATA'; return out; }
    const s50 = TA.sma(c, 50), s200 = TA.sma(c, 200), r = TA.rsi(c), m = TA.macd(c);
    const S50 = s50[n - 1], S200 = s200[n - 1], R = r[n - 1], H = m.h[n - 1];
    const r1m = TA.ret(c, 21), r3m = TA.ret(c, 63), r1y = TA.ret(c, ctx.crypto ? 365 : 252);
    const lv = TA.levels(h, l, c);
    const hi = Math.max(...h.slice(-(ctx.crypto ? 365 : 252))), lo = Math.min(...l.slice(-(ctx.crypto ? 365 : 252)));
    const pos = (p - lo) / (hi - lo || 1);
    // trend
    let trend;
    if (S200 != null) {
      const a50 = p > S50, a200 = p > S200, g = S50 > S200;
      if (a50 && a200 && g) { trend = 'up'; out.lines.push(W.pick([`${name} is in a clean uptrend: price is above both the 50-day (${money(S50)}) and 200-day (${money(S200)}) averages, and the 50 sits above the 200.`, `Trend is up. At ${money(p)} it trades over its 50-day average of ${money(S50)} and its 200-day of ${money(S200)}, with the faster line on top.`])); }
      else if (!a50 && !a200 && !g) { trend = 'down'; out.lines.push(W.pick([`${name} is in a downtrend: price is below the 50-day (${money(S50)}) and 200-day (${money(S200)}) averages, and the 50 is under the 200.`, `The chart is pointing down. ${money(p)} is under both the 50-day (${money(S50)}) and 200-day (${money(S200)}) averages.`])); }
      else if (!a50 && !a200 && g) { trend = 'breaking'; out.lines.push(`Price (${money(p)}) has dropped under both the 50-day (${money(S50)}) and 200-day (${money(S200)}) averages. The 50 is still above the 200, but if this holds a death cross could follow.`); }
      else if (a50 && a200 && !g) { trend = 'turning'; out.lines.push(`Price (${money(p)}) is back above both the 50-day (${money(S50)}) and 200-day (${money(S200)}) averages. The 50 is still under the 200, so a golden cross would confirm the turn.`); }
      else if (!a50 && a200) { trend = 'pullback'; out.lines.push(`Long-term trend is still up (above the 200-day at ${money(S200)}), but price has slipped under the 50-day at ${money(S50)}, so this is a pullback inside an uptrend.`); }
      else if (a50 && !a200) { trend = 'recovery'; out.lines.push(`Price has climbed back above the 50-day (${money(S50)}) but is still under the 200-day (${money(S200)}), so it's an attempted recovery, not a confirmed uptrend yet.`); }
      else { trend = 'mixed'; out.lines.push(`Mixed picture: price ${money(p)}, 50-day ${money(S50)}, 200-day ${money(S200)}.`); }
      const sc = { up: 1, down: -1, pullback: 0.25, recovery: 0, breaking: -0.6, turning: 0.5 }[trend] || 0;
      out.signals.push(sig('Trend (50/200-day averages)', trend, sc, 2, 'tech'));
      const x = TA.lastCross(s50, s200);
      if (x) { const ago = n - 1 - x.i; const dt = bars[x.i][0] * 86400000; out.facts.push({ k: x.up ? 'Golden cross' : 'Death cross', v: W.date(dt) }); if (ago < 60) out.lines.push(`${x.up ? 'A golden cross' : 'A death cross'} (50-day crossing ${x.up ? 'above' : 'below'} the 200-day) printed ${ago} trading days ago, on ${W.date(dt)}.`); }
    } else if (S50 != null) {
      trend = p > S50 ? 'up' : 'down';
      out.lines.push(`There isn't 200 days of history yet. Against the 50-day average (${money(S50)}) price is ${p > S50 ? 'above' : 'below'}.`);
      out.signals.push(sig('Trend (50-day average)', trend, p > S50 ? 0.6 : -0.6, 1.5, 'tech'));
    }
    // momentum
    if (R != null) {
      let t; if (R >= 70) t = `RSI is ${R.toFixed(0)}, overbought territory, so a cool-off wouldn't be surprising.`; else if (R <= 30) t = `RSI is ${R.toFixed(0)}, oversold, which often comes before a bounce but can stay low in a real sell-off.`; else if (R >= 55) t = `RSI ${R.toFixed(0)} shows healthy momentum without being stretched.`; else if (R <= 45) t = `RSI ${R.toFixed(0)} says sellers have the edge on momentum.`; else t = `RSI is neutral at ${R.toFixed(0)}.`;
      out.lines.push(t);
      const sc = R >= 75 ? -0.5 : R >= 55 ? 0.5 : R <= 25 ? 0.3 : R <= 45 ? -0.5 : 0;
      out.signals.push(sig('RSI (14)', R.toFixed(0), sc, 1, 'tech'));
      if (R >= 70) out.bear.push(`RSI ${R.toFixed(0)} is overbought`);
      if (R <= 30) out.bull.push(`RSI ${R.toFixed(0)} is oversold, so a rebound is possible`);
    }
    if (H != null) {
      const x = TA.lastCross(m.m, m.sig, n - 40); const rising = H > (m.h[n - 2] || 0);
      let t = `MACD is ${H > 0 ? 'above' : 'below'} its signal line`; if (x) t += ` after a ${x.up ? 'bullish' : 'bearish'} crossover ${n - 1 - x.i} days ago`; t += `, and the histogram is ${rising ? 'rising' : 'falling'}.`;
      out.lines.push(t);
      out.signals.push(sig('MACD (12,26,9)', H > 0 ? (rising ? 'bullish, rising' : 'bullish, fading') : (rising ? 'bearish, improving' : 'bearish'), H > 0 ? (rising ? 0.8 : 0.4) : (rising ? -0.3 : -0.8), 1, 'tech'));
    }
    // levels
    if (lv.sup || lv.res) {
      const parts = [];
      if (lv.sup) parts.push(`support near ${money(lv.sup.p)} (${W.pct(lv.sup.p / p - 1)}, tested ${lv.sup.n}×)`);
      if (lv.res) parts.push(`resistance near ${money(lv.res.p)} (${W.pct(lv.res.p / p - 1)}, tested ${lv.res.n}×)`);
      out.lines.push(`From swing highs and lows over the last 9 months, I see ${parts.join(' and ')}.`);
      out.levels = lv;
    }
    out.lines.push(`Over a month it's ${W.pct(r1m)}, three months ${W.pct(r3m)}${r1y != null ? `, one year ${W.pct(r1y)}` : ''}. It sits ${Math.round(pos * 100)}% of the way up its 52-week range (${money(lo)} to ${money(hi)}).`);
    if (r3m != null) out.signals.push(sig('3-month return', W.pct(r3m), Math.max(-1, Math.min(1, r3m / 0.25)), 1, 'tech'));
    if (pos < 0.15) out.bear.push(`Trading near its 52-week low (${money(lo)})`);
    if (p / hi - 1 < -0.3) out.bear.push(`${W.pctAbs(p / hi - 1, 0)} below its 52-week high`);
    if (trend === 'up') out.bull.push(`Uptrend: above the 50 and 200-day averages`);
    if (trend === 'down' || trend === 'breaking') out.bear.push(`Below both the 50 and 200-day averages`);
    if (trend === 'turning') out.bull.push('Back above the 50 and 200-day averages');
    out.headline = { up: 'TREND IS UP', down: 'TREND IS DOWN', pullback: 'PULLBACK', breaking: 'BREAKING DOWN', turning: 'TURNING UP', recovery: 'RECOVERING' }[trend] || 'RSI ' + (R || 0).toFixed(0);
    out.facts.push({ k: 'RSI 14', v: R != null ? R.toFixed(0) : 'n/a' }, { k: '50-day', v: money(S50) }, { k: '200-day', v: S200 != null ? money(S200) : 'n/a' }, { k: '1Y', v: W.pct(r1y) });
    out.ind = { s50, s200, r, m };
    return out;
  },
  // ---------------------------------------------------------------- Accountant
  accountant(ctx) {
    const { s, name, moneyUSD, money } = ctx; const out = { id: 'accountant', lines: [], signals: [], bull: [], bear: [], facts: [], unavailable: [] };
    if (s.kind === 'etf') {
      out.headline = 'IT\'S AN ETF';
      out.lines.push(`${name} is an ETF${s.issuer ? ` from ${s.issuer}` : ''}, so there are no company accounts to read.`);
      if (s.er != null) { out.lines.push(`Its published expense ratio is ${s.er.toFixed(2)}% a year${s.er <= 0.1 ? ', which is very cheap' : s.er >= 0.6 ? ', on the expensive side for an ETF' : ''}.`); out.facts.push({ k: 'Expense ratio', v: s.er.toFixed(2) + '%' }); if (s.er >= 0.6) out.bear.push(`High fees: ${s.er.toFixed(2)}% a year`); }
      const dv = (s.div || []).filter(d => d[0] * 1000 > Date.now() - 366 * 86400000);
      if (dv.length) { const tot = dv.reduce((a, d) => a + d[1], 0); out.lines.push(`It paid ${dv.length} distributions in the last year, totalling ${money(tot)}, a trailing yield of about ${(tot / s.price * 100).toFixed(2)}%.`); out.facts.push({ k: 'Trailing yield', v: (tot / s.price * 100).toFixed(2) + '%' }); }
      out.unavailable.push('Holdings breakdown isn\'t in the data feed');
      return out;
    }
    const f = s.fund, m = s.m || {};
    if (!f || !f.rev_ttm) {
      out.headline = 'NO FILINGS';
      out.lines.push(s.ex === 'US' && !s.fundAt && s.src === 'actions' ? `${name}'s SEC filings haven't been processed yet; the data build works through every US company within a day.` : s.ex === 'LSE' ? `${name} is London-listed. My accounts feed is SEC filings, which only cover US-listed companies, so I can't give you revenue or margins here.` : `I couldn't find recent SEC filings for ${name}, so the revenue, margins and valuation numbers are unavailable.`);
      out.unavailable.push('Company financials (SEC XBRL) unavailable for this listing');
    } else {
      const g = f.rev_ttm_prev ? f.rev_ttm / f.rev_ttm_prev - 1 : null;
      const gp = f.gp_ttm != null ? f.gp_ttm : (f.cogs_ttm != null ? f.rev_ttm - f.cogs_ttm : null);
      const gm = gp != null ? gp / f.rev_ttm : null, om = f.op_ttm != null ? f.op_ttm / f.rev_ttm : null, nm = f.ni_ttm != null ? f.ni_ttm / f.rev_ttm : null;
      const qEnd = f.end ? W.date(new Date(f.end).getTime()) : '';
      out.lines.push(W.pick([`Over the last four quarters (to ${qEnd}) ${name} brought in ${moneyUSD(f.rev_ttm, true)} of revenue${g != null ? `, ${g >= 0 ? 'up' : 'down'} ${W.pctAbs(g)} on the year before` : ''}.`, `Trailing twelve-month revenue is ${moneyUSD(f.rev_ttm, true)} through ${qEnd}${g != null ? `, a ${W.pct(g)} change year on year` : ''}.`]));
      if (f.rev_q_yoy != null) out.lines.push(`The latest quarter alone grew ${W.pct(f.rev_q_yoy)} against the same quarter last year${g != null && f.rev_q_yoy > g + 0.03 ? ', so growth is speeding up' : g != null && f.rev_q_yoy < g - 0.03 ? ', so growth is slowing' : ''}.`);
      const mg = []; if (gm != null) mg.push(`gross ${W.pctAbs(gm, 0)}`); if (om != null) mg.push(`operating ${W.pct(om, 0)}`); if (nm != null) mg.push(`net ${W.pct(nm, 0)}`);
      if (mg.length) out.lines.push(`Margins: ${mg.join(', ')}.${nm != null && nm < 0 ? ' It is losing money on a net basis.' : ''}`);
      if (f.ocf_ttm != null) { const fcf = f.ocf_ttm - (f.capex_ttm || 0); out.lines.push(`Free cash flow was ${moneyUSD(fcf, true)} (operating cash ${moneyUSD(f.ocf_ttm, true)} minus capex ${moneyUSD(f.capex_ttm || 0, true)}).`); out.facts.push({ k: 'Free cash flow', v: moneyUSD(fcf, true) }); if (fcf < 0) out.bear.push(`Burning cash: free cash flow ${moneyUSD(fcf, true)}`); else out.bull.push(`Positive free cash flow of ${moneyUSD(fcf, true)}`); out.signals.push(sig('Free cash flow', moneyUSD(fcf, true), fcf > 0 ? 0.6 : -0.7, 1, 'fund')); }
      const debt = (f.ltd || 0) + (f.std || 0), cash = (f.cash || 0) + (f.sti || 0);
      if (f.cash != null || debt) { const net = cash - debt; out.lines.push(`Balance sheet: ${moneyUSD(cash, true)} of cash and short-term investments against ${moneyUSD(debt, true)} of debt, so ${net >= 0 ? `net cash of ${moneyUSD(net, true)}` : `net debt of ${moneyUSD(-net, true)}`}.`); out.signals.push(sig('Net cash / debt', net >= 0 ? 'net cash' : 'net debt ' + moneyUSD(-net, true), net >= 0 ? 0.5 : (f.eq && -net > f.eq ? -0.8 : -0.3), 1, 'fund')); if (f.eq && debt / f.eq > 1.5) out.bear.push(`High leverage: debt is ${(debt / f.eq).toFixed(1)}× equity`); }
      if (g != null) { out.signals.push(sig('Revenue growth (TTM)', W.pct(g), g > 0.25 ? 1 : g > 0.08 ? 0.5 : g > 0 ? 0 : -0.8, 1.5, 'fund')); if (g > 0.2) out.bull.push(`Revenue growing ${W.pct(g, 0)} a year`); if (g < 0) out.bear.push(`Revenue shrinking (${W.pct(g)})`); }
      if (nm != null) out.signals.push(sig('Net margin', W.pct(nm, 0), nm > 0.15 ? 0.7 : nm > 0 ? 0.2 : -0.7, 1, 'fund'));
      // valuation vs peers
      const pr = s.peers;
      const pe = f.eps_ttm > 0 ? ctx.priceUSD / f.eps_ttm : null; const mcap = f.shares ? ctx.priceUSD * f.shares : null; const ps = mcap ? mcap / f.rev_ttm : null;
      if (pe && pe > 60) out.bear.push(`A P/E of ${pe.toFixed(0)} prices in a lot of future growth`);
      if (pe) out.facts.push({ k: 'P/E (TTM)', v: pe.toFixed(1) }); else if (f.eps_ttm != null) out.facts.push({ k: 'P/E', v: 'n/a (loss)' });
      if (ps) out.facts.push({ k: 'P/S', v: ps.toFixed(1) });
      if (mcap) out.facts.push({ k: 'Market cap', v: moneyUSD(mcap, true) });
      if (pr && pr.med) {
        const md = pr.med; const bits = [];
        if (pe && md.pe) bits.push(`P/E ${pe.toFixed(1)} vs a peer median of ${md.pe.toFixed(1)}`);
        if (ps && md.ps) bits.push(`price-to-sales ${ps.toFixed(1)} vs ${md.ps.toFixed(1)}`);
        if (bits.length) {
          const prem = pe && md.pe ? pe / md.pe - 1 : ps && md.ps ? ps / md.ps - 1 : 0;
          out.lines.push(`Against ${pr.n} ${pr.scope === 'industry' ? pr.label : pr.label + ' sector'} peers: ${bits.join(', ')}. That's ${Math.abs(prem) < 0.15 ? 'roughly in line' : prem > 0 ? `a ${W.pctAbs(prem, 0)} premium` : `a ${W.pctAbs(prem, 0)} discount`}${prem > 0.5 && g != null && g > (md.g || 0) * 2 ? ', which the faster growth partly explains' : ''}.`);
          out.signals.push(sig('Valuation vs peers', Math.abs(prem) < 0.15 ? 'in line' : (prem > 0 ? '+' : '') + (prem * 100).toFixed(0) + '%', prem > 1 ? -0.8 : prem > 0.3 ? -0.4 : prem < -0.2 ? 0.5 : 0.1, 1.5, 'fund'));
          if (prem > 0.6) out.bear.push(`Rich valuation: ${W.pctAbs(prem, 0)} above peers`);
          if (prem < -0.2) out.bull.push(`Cheaper than peers (${W.pctAbs(prem, 0)} discount)`);
        }
        out.peerTable = pr;
      } else if (pe) out.lines.push(`It trades on ${pe.toFixed(1)} times trailing earnings.`);
      else if (f.eps_ttm != null && f.eps_ttm <= 0) out.lines.push(`Earnings per share over the last year were ${moneyUSD(f.eps_ttm)}, so there's no meaningful P/E.`);
      out.facts.push({ k: 'Revenue TTM', v: moneyUSD(f.rev_ttm, true) }, { k: 'Rev growth', v: W.pct(g) }, { k: 'Gross margin', v: gm != null ? W.pctAbs(gm, 0) : 'n/a' }, { k: 'Net margin', v: W.pct(nm, 0) });
      out.revQ = f.rev_q;
      out.headline = g != null ? 'REV ' + W.pct(g, 0) : 'THE NUMBERS';
      out.src = f.src;
    }
    // analysts (Nasdaq via Ticker)
    const a = s.an;
    if (a && a.consensus && a.consensus.n) {
      const cs = a.consensus, tg = a.targets || {};
      let t = `Wall Street: ${cs.buy || 0} buy, ${cs.hold || 0} hold, ${cs.sell || 0} sell (${cs.key || 'n/a'} consensus).`;
      if (tg.mean) { const up = tg.mean / ctx.priceUSD - 1; t += ` The average price target is ${moneyUSD(tg.mean)} (${W.pct(up, 0)} from here), ranging ${moneyUSD(tg.low)} to ${moneyUSD(tg.high)}.`; out.signals.push(sig('Analyst target upside', W.pct(up, 0), up > 0.25 ? 0.8 : up > 0.08 ? 0.4 : up > -0.05 ? 0 : -0.6, 1, 'fund')); out.facts.push({ k: 'Avg target', v: moneyUSD(tg.mean) }); }
      out.lines.push(t);
    }
    // earnings
    const e = ctx.nextEarnings;
    if (e) out.lines.push(e.est ? `Next earnings should land around ${W.date(e.ts)} (estimated from the usual quarterly cadence, not confirmed).` : `Next earnings: ${W.date(e.ts)}${e.time && e.time !== 'time-not-supplied' ? (e.time === 'time-pre-market' ? ', before the open' : e.time === 'time-after-hours' ? ', after the close' : '') : ''}${e.epsF ? `, with consensus EPS of ${e.epsF}` : ''}.`);
    if (a && a.earningsHistory && a.earningsHistory.length) { const beats = a.earningsHistory.filter(x => x.surprisePct > 0).length; out.lines.push(`It beat EPS estimates in ${beats} of the last ${a.earningsHistory.length} quarters.`); out.signals.push(sig('Earnings beats', `${beats}/${a.earningsHistory.length}`, (beats / a.earningsHistory.length - 0.5) * 1.6, 0.75, 'fund')); }
    if (!out.headline) out.headline = 'THE NUMBERS';
    return out;
  },
  // ---------------------------------------------------------------- Crypto desk
  crypto(ctx) {
    const { coin, live, money, moneyUSD, name, glob, funding } = ctx; const out = { id: 'crypto', lines: [], signals: [], bull: [], bear: [], facts: [], unavailable: [] };
    if (!coin) { out.lines.push(`I couldn't load market data for ${name}.`); out.headline = 'NO DATA'; return out; }
    const mc = coin.market_cap, vol = coin.total_volume, circ = coin.circulating_supply, tot = coin.total_supply, max = coin.max_supply, fdv = coin.fully_diluted_valuation;
    out.lines.push(`${name} is ranked #${coin.market_cap_rank} by market cap at ${moneyUSD(mc, true)}, with ${moneyUSD(vol, true)} traded in the last 24 hours (${(vol / mc * 100).toFixed(1)}% of its market cap).`);
    out.facts.push({ k: 'Market cap', v: moneyUSD(mc, true) }, { k: 'Rank', v: '#' + coin.market_cap_rank }, { k: '24h volume', v: moneyUSD(vol, true) });
    if (circ) {
      const cap = max || tot; const share = cap ? circ / cap : null;
      out.lines.push(`Supply: ${W.big(circ)} ${ctx.sym} circulating${max ? ` of a ${W.big(max)} hard cap` : tot ? ` of ${W.big(tot)} total` : ' with no maximum supply'}${share != null ? ` (${(share * 100).toFixed(0)}% issued)` : ''}.`);
      if (share != null) { out.facts.push({ k: 'Issued', v: (share * 100).toFixed(0) + '%' }); out.signals.push(sig('Supply overhang', (share * 100).toFixed(0) + '% issued', share > 0.9 ? 0.4 : share > 0.7 ? 0 : -0.7, 1, 'chain')); if (share < 0.7) out.bear.push(`Only ${(share * 100).toFixed(0)}% of supply is out, so future unlocks or emissions could dilute holders`); }
      if (!max) out.bear.push('No hard cap on supply');
      if (fdv && mc && fdv / mc > 1.3) out.lines.push(`Fully diluted value is ${moneyUSD(fdv, true)}, ${(fdv / mc).toFixed(1)}× today's market cap, which is the size of the supply still to come.`);
    }
    out.unavailable.push('Token unlock schedule (no free public unlock feed), so I use issued vs max supply as the proxy');
    if (coin.ath) { const dd = live / coin.ath - 1; out.lines.push(`It's ${W.pctAbs(dd, 0)} below its all-time high of ${moneyUSD(coin.ath)} from ${W.date(new Date(coin.ath_date).getTime())}.`); out.facts.push({ k: 'From ATH', v: W.pct(dd, 0) }); }
    if (funding && funding.rate != null) {
      const ann = funding.rate * (funding.perDay || 3) * 365;
      out.lines.push(`Perpetual funding on ${funding.src} is ${(funding.rate * 100).toFixed(4)}% per ${funding.interval || '8h'} (about ${W.pct(ann, 0)} a year). ${funding.rate > 0.0003 ? 'Longs are paying a lot to stay in, so the trade is crowded and squeezes are possible.' : funding.rate > 0 ? 'Mildly positive: longs pay shorts, which is normal.' : 'Negative: shorts are paying longs, so traders lean bearish, which sometimes sets up short squeezes.'}`);
      out.signals.push(sig('Funding rate', (funding.rate * 100).toFixed(4) + '%', funding.rate > 0.0005 ? -0.6 : funding.rate > 0.0001 ? 0.1 : funding.rate >= 0 ? 0.2 : 0.3, 0.75, 'chain'));
      out.facts.push({ k: 'Funding', v: (funding.rate * 100).toFixed(4) + '%' });
      if (funding.rate > 0.0005) out.bear.push('Funding is hot, so leverage is crowded long');
    } else out.unavailable.push('Funding rate (no perpetual market found)');
    if (glob && glob.dom) {
      const bd = glob.dom.btc, ed = glob.dom.eth;
      out.lines.push(`Market backdrop: Bitcoin dominance is ${bd.toFixed(1)}%${ed ? ` and Ethereum ${ed.toFixed(1)}%` : ''}; total crypto market cap ${moneyUSD(glob.mcap, true)}${glob.mcapChg24h != null ? ` (${W.pct(glob.mcapChg24h / 100)} 24h)` : ''}.`);
      out.facts.push({ k: 'BTC dominance', v: bd.toFixed(1) + '%' });
      if (ctx.sym !== 'BTC' && bd > 58) out.bear.push(`Bitcoin dominance is high (${bd.toFixed(0)}%), which usually means altcoins are lagging`);
    }
    const c7 = coin.price_change_percentage_7d_in_currency, c30 = coin.price_change_percentage_30d_in_currency;
    if (c7 != null) out.lines.push(`Momentum: ${W.pct(c7 / 100)} over 7 days and ${W.pct((c30 || 0) / 100)} over 30 days.`);
    if (ctx.fng) { out.lines.push(`The crypto Fear & Greed Index reads ${ctx.fng.v} (${ctx.fng.label}).`); out.signals.push(sig('Crypto Fear & Greed', ctx.fng.v + ' ' + ctx.fng.label, ctx.fng.v < 25 ? 0.3 : ctx.fng.v > 75 ? -0.4 : 0, 0.5, 'chain')); }
    out.headline = '#' + coin.market_cap_rank + ' ' + moneyUSD(mc, true);
    return out;
  },
  // ---------------------------------------------------------------- Reporter
  reporter(ctx) {
    const { news, name } = ctx; const out = { id: 'reporter', lines: [], signals: [], bull: [], bear: [], facts: [], catalysts: [], unavailable: [] };
    if (!news || !news.length) { if (!ctx.newsAt) { out.lines.push(`My news feed hasn't reached ${name} yet. The data build fetches it within a few hours.`); out.unavailable.push('Headlines not fetched yet for this ticker'); } else { out.lines.push(`No recent headlines came through for ${name}.`); out.unavailable.push('News feed returned nothing'); } out.headline = 'NO NEWS YET'; }
    else {
      let p = 0, n = 0; const scored = news.map(x => ({ ...x, tone: tone(x.t) })); scored.forEach(x => { if (x.tone > 0) p++; if (x.tone < 0) n++; });
      const fresh = news.filter(x => x.ts && Date.now() - x.ts * 1000 < 3 * 86400000).length;
      out.lines.push(W.pick([`I've got ${news.length} recent headlines, ${fresh} from the last three days.`, `${news.length} stories on the wire, ${fresh} of them in the past 72 hours.`]) + ` The top one: "${news[0].t}" (${news[0].s}).`);
      out.lines.push(`Headline tone by keyword count: ${p} positive, ${n} negative, ${news.length - p - n} neutral. ${p > n + 1 ? 'Coverage leans upbeat.' : n > p + 1 ? 'Coverage leans negative.' : 'Coverage is mixed.'}`);
      out.signals.push(sig('Headline tone', `${p}+ / ${n}−`, (p - n) / Math.max(3, news.length) * 2, 0.75, 'news'));
      out.items = scored;
      const neg = scored.filter(x => x.tone < 0).slice(0, 2); neg.forEach(x => out.bear.push(`Headline: "${x.t}"`));
      const pos = scored.filter(x => x.tone > 0).slice(0, 2); pos.forEach(x => out.bull.push(`Headline: "${x.t}"`));
      out.headline = p > n ? 'GOOD PRESS' : n > p ? 'ROUGH PRESS' : news.length + ' STORIES';
    }
    // dated catalysts only from real data
    const e = ctx.nextEarnings; if (e) out.catalysts.push({ ts: e.ts, label: e.est ? 'Earnings (estimated date)' : 'Earnings report', est: e.est });
    const dv = ctx.divNext; if (dv) out.catalysts.push({ ts: dv.ts, label: 'Next dividend (estimated from past ex-dates)', est: true });
    if (out.catalysts.length) out.lines.push('Coming up: ' + out.catalysts.map(c => `${c.label.toLowerCase()} ${W.date(c.ts)}`).join('; ') + '.');
    else out.lines.push(ctx.crypto ? 'No dated catalysts in my feeds for this coin (unlock calendars aren\'t freely available).' : 'No dated catalysts found in my feeds.');
    return out;
  },
  // ---------------------------------------------------------------- Insider
  insider(ctx) {
    const { ins, holders, name, sym } = ctx; const out = { id: 'insider', lines: [], signals: [], bull: [], bear: [], facts: [], unavailable: [] };
    if (ctx.crypto) { out.lines.push(`Disclosure rules don't cover coins directly, so here's what I have: ${ins && ins.rows.length ? '' : 'no Congress, executive or insider filings name ' + sym + '.'}`); }
    if (!ins || !ins.rows || !ins.rows.length) {
      if (!ctx.crypto) out.lines.push(`The Insider House has no Congress, executive, corporate-insider or fund trades in ${sym} in the last three years.`);
      out.headline = 'NOBODY\'S TRADING'; out.unavailable.push(ctx.crypto ? 'Insider data covers stocks only' : '');
    } else {
      const C = ins.cols, ix = k => C.indexOf(k); const rows = ins.rows.map(r => Object.fromEntries(C.map((k, i) => [k, r[i]])));
      const since = d => rows.filter(r => r.tx_date && Date.now() - new Date(r.tx_date).getTime() < d * 86400000);
      const r90 = since(90), r365 = since(365);
      const grp = (rs, ch) => rs.filter(r => ch.includes(r.chamber));
      const cnt = rs => ({ b: rs.filter(r => r.side === 'buy').length, s: rs.filter(r => r.side === 'sell').length, bv: rs.filter(r => r.side === 'buy').reduce((a, r) => a + ((r.amount_low || 0) + (r.amount_high || r.amount_low || 0)) / 2, 0), sv: rs.filter(r => r.side === 'sell').reduce((a, r) => a + ((r.amount_low || 0) + (r.amount_high || r.amount_low || 0)) / 2, 0) });
      const pol = cnt(grp(r365, ['House', 'Senate', 'Executive'])), corp = cnt(grp(r90, ['Insider'])), corpY = cnt(grp(r365, ['Insider']));
      if (pol.b + pol.s) out.lines.push(`Politicians: in the past year, members of Congress and the executive branch disclosed ${pol.b} buys and ${pol.s} sells of ${sym}.`);
      else out.lines.push(`No Congress or executive trades in ${sym} in the past year.`);
      const names = [...new Set(grp(r365, ['House', 'Senate', 'Executive']).map(r => r.politician))].slice(0, 4);
      if (names.length) out.lines.push(`Names on the filings include ${names.join(', ')}.`);
      if (corpY.b + corpY.s) {
        out.lines.push(`Company insiders (SEC Form 4): ${corp.b} open-market buys and ${corp.s} sells in the last 90 days${corp.sv || corp.bv ? `, about ${ctx.moneyUSD(corp.bv, true)} bought vs ${ctx.moneyUSD(corp.sv, true)} sold` : ''}.`);
        if (corp.b > 0) out.bull.push(`Insiders bought shares on the open market in the last 90 days`);
        if (corp.sv > 5 * (corp.bv + 1) && corp.s >= 3) out.bear.push(`Heavy insider selling: ${corp.s} sales in 90 days`);
      }
      const net = (pol.b - pol.s) + (corp.b * 2 - corp.s * 0.5);
      out.signals.push(sig('Insider / Congress flow', `${pol.b + corp.b} buys / ${pol.s + corp.s} sells`, Math.max(-1, Math.min(1, net / 6)), 0.75, 'flow'));
      const latest = rows[0]; out.lines.push(`Most recent: ${latest.politician} (${latest.chamber}) ${latest.side === 'buy' ? 'bought' : latest.side === 'sell' ? 'sold' : latest.tx_type} ${latest.amount || ''} on ${W.date(new Date(latest.tx_date).getTime())}, disclosed ${latest.disclosure_date ? W.date(new Date(latest.disclosure_date).getTime()) : 'n/a'}.`);
      out.rows = rows.slice(0, 12);
      out.headline = (pol.b + corp.b) > (pol.s + corp.s) ? 'THEY\'RE BUYING' : (pol.s + corp.s) > (pol.b + corp.b) ? 'THEY\'RE SELLING' : 'MIXED FLOWS';
    }
    if (holders && holders.length) {
      const funds = holders.filter(h => h.chamber === 'Institution').slice(0, 4);
      if (funds.length) out.lines.push(`Funds on the latest 13F filings: ${funds.map(h => `${h.politician} (${ctx.moneyUSD(h.value, true)})`).join(', ')}.`);
      out.holders = holders.slice(0, 8);
    }
    return out;
  },
  // ---------------------------------------------------------------- Quant (unlockable)
  quant(ctx) {
    const { bars, bench, benchName } = ctx; const c = bars.map(b => b[4]); const out = { id: 'quant', lines: [], signals: [], bull: [], bear: [], facts: [] };
    const ann = ctx.crypto ? 365 : 252; const v = TA.vol(c, ann, ann), v20 = TA.vol(c, 20, ann), dd = TA.maxDD(c, ann);
    out.lines.push(`Annualised volatility is ${W.pctAbs(v, 0)} over the past year and ${W.pctAbs(v20, 0)} over the last 20 days${v20 > v * 1.3 ? ', so it has been unusually jumpy lately' : v20 < v * 0.7 ? ', so things have calmed down' : ''}.`);
    out.lines.push(`The worst peak-to-trough drop in the past year was ${W.pct(dd.dd, 0)}${dd.at != null ? `, bottoming ${W.date(bars[dd.at][0] * 86400000)}` : ''}.`);
    const daily = []; for (let i = Math.max(1, c.length - ann); i < c.length; i++) daily.push(c[i] / c[i - 1] - 1);
    if (daily.length) out.lines.push(`Best day ${W.pct(Math.max(...daily))}, worst day ${W.pct(Math.min(...daily))}; up on ${Math.round(daily.filter(x => x > 0).length / daily.length * 100)}% of days.`);
    if (bench && bench.length) {
      const map = new Map(bench.map(b => [b[0], b[4]])); const a = [], b = []; for (const r of bars.slice(-ann)) { const y = map.get(r[0]); if (y) { a.push(r[4]); b.push(y); } }
      const be = TA.beta(a, b); if (be) { out.lines.push(`Against ${benchName}, beta is ${be.beta.toFixed(2)} and correlation ${be.corr.toFixed(2)}${be.beta > 1.5 ? ', so it tends to swing harder than the market both ways' : be.beta < 0.6 ? ', so it moves more on its own story than with the market' : ''}.`); out.facts.push({ k: 'Beta', v: be.beta.toFixed(2) }); }
      const rr = TA.ret(a, Math.min(63, a.length - 1)), rb = TA.ret(b, Math.min(63, b.length - 1)); if (rr != null && rb != null) { out.lines.push(`Relative strength: ${W.pct(rr)} vs ${benchName} ${W.pct(rb)} over three months.`); out.signals.push(sig('3M vs ' + benchName, W.pct(rr - rb), Math.max(-1, Math.min(1, (rr - rb) / 0.15)), 1, 'tech')); }
    }
    const r1 = TA.ret(c, Math.min(ann, c.length - 1)); if (r1 != null && v) { const sh = r1 / v; out.lines.push(`Return per unit of risk over the year (return ÷ volatility) is ${sh.toFixed(2)}.`); out.facts.push({ k: 'Return/vol', v: sh.toFixed(2) }); }
    out.facts.push({ k: 'Volatility', v: W.pctAbs(v, 0) }, { k: 'Max drawdown', v: W.pct(dd.dd, 0) });
    if (v > (ctx.crypto ? 0.9 : 0.55)) out.bear.push(`Very volatile (${W.pctAbs(v, 0)} a year)`);
    if (dd.dd < -0.4) out.bear.push(`Fell ${W.pctAbs(dd.dd, 0)} peak to trough this year`);
    out.signals.push(sig('Volatility', W.pctAbs(v, 0), v > (ctx.crypto ? 1 : 0.6) ? -0.5 : v < 0.25 ? 0.3 : 0, 0.5, 'tech'));
    out.headline = 'VOL ' + W.pctAbs(v, 0);
    return out;
  },
  // ---------------------------------------------------------------- Macro (unlockable)
  macro(ctx) {
    const out = { id: 'macro', lines: [], signals: [], bull: [], bear: [], facts: [] };
    const spy = ctx.spy; if (spy && spy.length > 200) { const c = spy.map(b => b[4]); const s200 = TA.sma(c, 200)[c.length - 1], p = c[c.length - 1]; const r1 = TA.ret(c, 21); out.lines.push(`The S&P 500 (SPY) is ${p > s200 ? 'above' : 'below'} its 200-day average and ${W.pct(r1)} over the past month, so the broad market is ${p > s200 ? 'a tailwind' : 'a headwind'}.`); out.signals.push(sig('Market trend (SPY vs 200-day)', p > s200 ? 'risk-on' : 'risk-off', p > s200 ? 0.5 : -0.5, 0.75, 'macro')); }
    if (ctx.btc && ctx.crypto) { const c = ctx.btc.map(b => b[4]); const s200 = TA.sma(c, 200)[c.length - 1], p = c[c.length - 1]; if (s200) { out.lines.push(`Bitcoin is ${p > s200 ? 'above' : 'below'} its 200-day average, and alts rarely outrun a weak BTC.`); out.signals.push(sig('BTC trend', p > s200 ? 'up' : 'down', p > s200 ? 0.5 : -0.5, 0.75, 'macro')); } }
    const fg = ctx.stockFng; if (fg && !ctx.crypto) { out.lines.push(`CNN's Fear & Greed index is ${Math.round(fg.score)} (${fg.rating})${fg.previous1Week != null ? `, from ${Math.round(fg.previous1Week)} a week ago` : ''}.`); out.signals.push(sig('Stock Fear & Greed', Math.round(fg.score) + ' ' + fg.rating, fg.score < 25 ? 0.3 : fg.score > 75 ? -0.4 : 0, 0.5, 'macro')); }
    if (ctx.fx) out.lines.push(`GBP/USD is ${ctx.fx.toFixed(4)}, which matters for a US-listed holding when you count in pounds.`);
    if (!out.lines.length) out.lines.push('Macro feeds are unavailable right now.');
    out.headline = 'BIG PICTURE';
    return out;
  },
  // ---------------------------------------------------------------- Bear
  bear(ctx, done) {
    const out = { id: 'bear', lines: [], signals: [], bull: [], bear: [], facts: [] };
    const risks = []; for (const s of done) for (const b of (s.bear || [])) risks.push(b);
    const neg = []; for (const s of done) for (const g of (s.signals || [])) if (g.s < -0.2) neg.push(g);
    if (!risks.length && !neg.length) out.lines.push(W.pick([`Honestly, the data gives me little to growl about. That itself is a risk: when everything looks fine, a surprise hurts more.`, `I'm struggling to find red flags in the numbers. Popular, clean stories can still fall when expectations are high.`]));
    else {
      out.lines.push(W.pick([`Here's what could go wrong with ${ctx.name}:`, `Let me spoil the party. The risks I see for ${ctx.name}:`, `My case against ${ctx.name}:`]));
      risks.slice(0, 6).forEach(r => out.lines.push('• ' + r));
      if (neg.length) out.lines.push(`Bearish signals on the board: ${neg.map(g => `${g.name} (${g.reading})`).join(', ')}.`);
    }
    if (ctx.crypto) out.lines.push('And the standing crypto risks: exchange and regulatory events, and 24/7 trading means big moves happen while you sleep.');
    else if (ctx.nextEarnings && W.daysTo(ctx.nextEarnings.ts) < 21 && W.daysTo(ctx.nextEarnings.ts) >= 0) out.lines.push(`Earnings are only ${W.daysTo(ctx.nextEarnings.ts)} days away, and a miss can gap the price.`);
    out.risks = risks;
    out.headline = risks.length > 3 ? 'BEWARE' : risks.length ? 'CAREFUL' : 'GRR... FINE';
    return out;
  },
  // ---------------------------------------------------------------- Boss verdict
  verdict(ctx, done) {
    const sigs = []; for (const s of done) for (const g of (s.signals || [])) sigs.push({ ...g, by: s.id });
    const tw = sigs.reduce((a, g) => a + g.w, 0); const raw = tw ? sigs.reduce((a, g) => a + g.w * g.s, 0) / tw : 0;
    const score = Math.round(50 + raw * 50);
    const agree = tw ? sigs.reduce((a, g) => a + g.w * (Math.sign(g.s) === Math.sign(raw) && g.s !== 0 ? 1 : 0), 0) / tw : 0;
    const expected = ctx.crypto ? 11 : 13; const coverage = Math.min(1, sigs.length / expected);
    const conf = Math.round(Math.min(95, (Math.abs(raw) * 0.55 + agree * 0.45) * coverage * 100));
    const stance = score >= 62 ? 'Bullish lean' : score <= 38 ? 'Bearish lean' : score >= 54 ? 'Mildly bullish' : score <= 46 ? 'Mildly bearish' : 'Neutral, mixed signals';
    const bull = [], bear = []; for (const s of done) { (s.bull || []).forEach(x => bull.push(x)); (s.bear || []).forEach(x => bear.push(x)); }
    const cats = []; for (const s of done) (s.catalysts || []).forEach(c => cats.push(c));
    cats.sort((a, b) => a.ts - b.ts);
    const top = [...sigs].sort((a, b) => Math.abs(b.s * b.w) - Math.abs(a.s * a.w)).slice(0, 3);
    const lines = [];
    lines.push(W.pick([`Team, thanks. On ${ctx.name} the board scores ${score}/100: ${stance.toLowerCase()}.`, `Right. ${ctx.name} comes out at ${score} out of 100 on our signals. Call it ${stance.toLowerCase()}.`]));
    if (top.length) lines.push(`The biggest drivers were ${top.map(g => `${g.name} (${g.reading})`).join(', ')}.`);
    lines.push(`Confidence is ${conf}%, from how strongly and how consistently ${sigs.length} signals point the same way.`);
    return { score, stance, conf, coverage, agree, raw, sigs, bull: [...new Set(bull)].slice(0, 6), bear: [...new Set(bear)].slice(0, 6), cats, lines, headline: score + '/100' };
  }
};
