/* Blackrock app: tower state, analysis flow, calls, watchlist, waiting-on-me, progression. */
'use strict';
const BUILD = 'b12';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- roster
const SEAT = (f, cx) => ({ f, gx: cx, gy: 3.15, pose: 'type' });
const ANALYSTS = {
  chartist:   { name: 'Chartist',    title: 'Trend, momentum & levels',     color: '#1d9bf0', shape: 'circle',   lvl: 1, home: SEAT(1, 2.55) },
  quant:      { name: 'Quant',       title: 'Volatility, drawdown & beta',  color: '#8b5cf6', shape: 'hex',      lvl: 2, home: SEAT(1, 7.65) },
  accountant: { name: 'Accountant',  title: 'Revenue, margins & valuation', color: '#10b981', shape: 'squircle', lvl: 1, home: SEAT(2, 2.55) },
  crypto:     { name: 'Crypto Desk', title: 'Market cap, supply & funding', color: '#f97316', shape: 'pebble',   lvl: 1, home: SEAT(2, 7.65) },
  reporter:   { name: 'Reporter',    title: 'Headlines & catalysts',        color: '#ec4899', shape: 'triangle', lvl: 1, home: SEAT(3, 2.55) },
  macro:      { name: 'Macro',       title: 'Market backdrop & FX',         color: '#3b82f6', shape: 'cloud',    lvl: 3, home: SEAT(3, 7.65) },
  insider:    { name: 'Insider',     title: 'Congress, CEO & fund trades',  color: '#64748b', shape: 'droplet',  lvl: 1, home: SEAT(4, 2.85) },
  bear:       { name: 'Bear',        title: 'The risk case',                color: '#f43f5e', shape: 'pill',     lvl: 1, home: SEAT(4, 7.65) },
  earnings:   { name: 'Earnings',    title: 'Report dates & beat history',  color: '#a855f7', shape: 'droplet',  lvl: 6, home: SEAT(5, 2.55) },
  boss:       { name: 'Boss',        title: 'Verdict',                      color: '#f59e0b', shape: 'cloud',    lvl: 1, home: { f: 6, gx: 8.0, gy: 2.0, pose: 'type' } },
  you:        { name: 'You',         title: 'Your desk',                    color: '#14b8a6', shape: 'squircle', lvl: 1, home: SEAT(0, 7.65) }
};
const ORDER_STOCK = ['chartist', 'accountant', 'earnings', 'reporter', 'insider', 'quant', 'macro', 'bear'];
const ORDER_COIN = ['chartist', 'crypto', 'reporter', 'insider', 'quant', 'macro', 'bear'];
// top-floor meeting table (world: centre x -1.0, z 0.4) expressed in tower grid units
const TABLE = { gx: 25 / 6, gy: 2.2 };
const BOSS_HEAD = { f: 6, gx: 2.5, gy: 2.2, pose: 'stand', face: TABLE };
const SEAT_ANG = [115, 65, 150, 30, 0, -30, -65, -115, -150];
function tableSeat(i) { const a = SEAT_ANG[i % SEAT_ANG.length] * Math.PI / 180; const x = -1.0 + Math.cos(a) * 2.0, z = 0.4 - Math.sin(a) * 1.22; return { f: 6, gx: (x + 6) / 1.2, gy: (z + 4) / 2, pose: 'stand', face: TABLE }; }
const UNLOCKS = [
  { lvl: 2, id: 'quant', kind: 'analyst', label: 'Quant joins the Research floor', sub: 'Volatility, drawdown and beta vs the market' },
  { lvl: 3, id: 'macro', kind: 'analyst', label: 'Macro desk opens in the Newsroom', sub: 'Market backdrop, Fear & Greed and FX' },
  { lvl: 4, id: 'screens', kind: 'room', label: 'Better screens', sub: 'Ultrawide wall screens and bigger monitors on every desk' },
  { lvl: 5, id: 'trading', kind: 'floor', label: 'Trading floor opens', sub: 'Floor 5: a shared trading desk' },
  { lvl: 6, id: 'earnings', kind: 'analyst', label: 'Earnings bot joins floor 5', sub: 'Next report date, EPS forecast and beat history (stocks)' },
  { lvl: 7, id: 'lounge', kind: 'room', label: 'Lobby lounge', sub: 'Coffee bar and a new sofa' },
  { lvl: 8, id: 'terrace', kind: 'room', label: 'Penthouse upgrade', sub: 'Gold-trim verdict table and more plants' },
  { lvl: 9, id: 'roof', kind: 'room', label: 'Rooftop garden and helipad' },
  { lvl: 10, id: 'art', kind: 'room', label: 'Penthouse art wall' }
];
const LOCK_LABEL = { quant: 'Level 2 · Quant', macro: 'Level 3 · Macro', trading: 'Level 5 · Trading desk', earnings: 'Level 6 · Earnings bot' };
const lvlXP = L => 50 * L * (L - 1); // total points to reach level L
const levelOf = xp => { let L = 1; while (xp >= lvlXP(L + 1)) L++; return L; };

// ---------------------------------------------------------------- state
const KEY = 'bullpen.v1'; // kept so existing progress carries over
const ST = Object.assign({ xp: 0, analyses: 0, seen: {}, calls: [], watch: [], cur: 'GBP', sound: false, decorOff: {}, history: [], lastDay: '', alerted: {}, inbox: [] }, JSON.parse(localStorage.getItem(KEY) || '{}'));
if (!Array.isArray(ST.inbox)) ST.inbox = []; ST.inbox = ST.inbox.slice(0, 4);
if (!Array.isArray(ST.calls)) ST.calls = [];
if (!ST.theme) ST.theme = 'black';
const THEMES = { black: 'Black', graphite: 'Graphite', midnight: 'Midnight blue', light: 'Light' };
function applyTheme(id, persist) {
  const t = THEMES[id] ? id : 'black';
  ST.theme = t;
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  const stage = (getComputedStyle(document.documentElement).getPropertyValue('--stage') || '#000000').trim();
  if (meta) meta.setAttribute('content', stage);
  if (scene && scene.setTheme) scene.setTheme(t);
  if (persist !== false) save();
}
const save = () => localStorage.setItem(KEY, JSON.stringify(ST));
function callDupeKey(c) {
  return c.aid ? c.aid + '|' + c.dir : [c.id, c.dir, Math.round((c.price || 0) * 100), new Date(c.at).toDateString()].join('|');
}
function dedupeCalls() {
  const groups = new Map();
  for (const c of ST.calls) {
    const k = callDupeKey(c);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  if ([...groups.values()].every(g => g.length === 1)) return;
  const used = new Set(), out = [];
  for (const c of ST.calls) {
    const k = callDupeKey(c);
    if (used.has(k)) continue;
    used.add(k);
    const g = groups.get(k);
    const best = g.reduce((a, b) => {
      const sa = (a.s30 ? 4 : 0) + (a.s7 ? 2 : 0) + (a.snap ? 1 : 0);
      const sb = (b.s30 ? 4 : 0) + (b.s7 ? 2 : 0) + (b.snap ? 1 : 0);
      if (sb !== sa) return sb > sa ? b : a;
      return a.at <= b.at ? a : b;
    });
    if (!best.snap) { const x = g.find(y => y.snap); if (x) best.snap = x.snap; }
    if (!best.aid) { const x = g.find(y => y.aid); if (x) best.aid = x.aid; }
    out.push(best);
  }
  ST.calls = out; save();
}
dedupeCalls();
const level = () => levelOf(ST.xp);
const unlocked = id => (ANALYSTS[id] ? ANALYSTS[id].lvl || 1 : (UNLOCKS.find(u => u.id === id) || { lvl: 1 }).lvl) <= level();

// ---------------------------------------------------------------- money
function conv(v, from) { const fx = DATA.fx(); if (v == null || !isFinite(v)) return null; if (!fx || from === ST.cur) return { v, c: from }; if (from === 'USD' && ST.cur === 'GBP') return { v: v / fx, c: 'GBP' }; if (from === 'GBP' && ST.cur === 'USD') return { v: v * fx, c: 'USD' }; return { v, c: from }; }
function fmtMoney(v, from, big) {
  const r = conv(v, from); if (!r) return 'n/a'; const sym = r.c === 'GBP' ? '£' : r.c === 'USD' ? '$' : r.c + ' ';
  if (big) return (r.v < 0 ? '-' : '') + sym + W.big(Math.abs(r.v));
  const a = Math.abs(r.v); const d = a >= 1000 ? 0 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  return (r.v < 0 ? '-' : '') + sym + a.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ---------------------------------------------------------------- sound (off by default, soft tones)
const SFX = { ctx: null, play(kind) { if (!ST.sound) return; try { this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)(); const c = this.ctx, t = c.currentTime; const seq = { tick: [[1200, .01]], blip: [[740, .06], [988, .08]], win: [[523, .1], [659, .1], [784, .18]], lvl: [[523, .1], [659, .1], [784, .1], [1047, .25]], alert: [[880, .08], [660, .1]] }[kind] || [[440, .05]]; let o = 0; for (const [f, d] of seq) { const os = c.createOscillator(), g = c.createGain(); os.type = 'sine'; os.frequency.value = f; g.gain.setValueAtTime(0.06, t + o); g.gain.exponentialRampToValueAtTime(0.0001, t + o + d); os.connect(g).connect(c.destination); os.start(t + o); os.stop(t + o + d + 0.02); o += d; } } catch (e) { } } };

// ---------------------------------------------------------------- scene
let scene;
function roster() {
  const list = Object.entries(ANALYSTS).map(([id, a]) => ({ id, name: a.name, color: a.color, shape: a.shape, home: a.home, hidden: !unlocked(id) }));
  scene.setBots(list);
  const set = UNLOCKS.filter(u => u.lvl <= level() && !(u.kind === 'room' && ST.decorOff[u.id])).map(u => u.id);
  const locks = {}; for (const k of Object.keys(LOCK_LABEL)) if (!unlocked(k)) locks[k] = LOCK_LABEL[k];
  scene.setUnlocks(set, locks);
}
function avatar(id, size = 40) { const a = ANALYSTS[id]; return BOT.avatar({ color: a.color, shape: a.shape, role: id }, size); }
// ---------------------------------------------------------------- search & autocomplete
const askIn = () => $('#q');
function renderAC(items) {
  const ac = $('#ac'); if (!items.length) { ac.hidden = true; return; }
  ac.innerHTML = items.map((x, i) => `<button type="button" data-i="${i}" class="ac-row"><span class="ac-sym">${esc(x.id)}</span><span class="ac-name">${esc(x.name)}</span><span class="ac-kind ${x.kind}">${x.kind === 'crypto' ? 'Coin' : x.kind === 'etf' ? 'ETF' : (x.ex === 'LSE' ? 'LSE' : 'Stock')}</span></button>`).join('');
  ac.hidden = false; $$('.ac-row', ac).forEach(b => b.onclick = () => { ac.hidden = true; askIn().value = ''; startAnalysis(items[+b.dataset.i]); });
}
async function onType() { await DATA.loadSearch(); const p = DATA.parse(askIn().value); renderAC(p.term.length ? DATA.rank(p.term, p.crypto) : []); }
async function resolve(text) {
  await DATA.loadSearch(); const p = DATA.parse(text); if (!p.term) return null;
  const r = DATA.rank(p.term, p.crypto); if (r.length && r[0].sc >= 60) return r[0];
  // fall back to Yahoo search through the public reader proxy
  try { const d = await DATA.yahooSearch(p.term); const q = (d.quotes || []).find(x => ['EQUITY', 'ETF'].includes(x.quoteType) && !/\.(F|DE|MX|BA|SA|TO|V|NE)$/.test(x.symbol)); if (q) return { id: q.symbol, name: q.longname || q.shortname || q.symbol, kind: q.quoteType === 'ETF' ? 'etf' : 'equity', ex: /\.L$/.test(q.symbol) ? 'LSE' : 'US', ondemand: true }; } catch (e) { }
  return r[0] || null;
}


async function buildContext(item) {
  const crypto = item.kind === 'crypto'; const sym = item.id;
  await DATA.loadQuotes();
  const money = v => fmtMoney(v, ctx.cur), moneyUSD = (v, big) => fmtMoney(v, 'USD', big);
  const ctx = { item, sym, crypto, name: item.name, money, moneyUSD, fx: DATA.fx() };
  const jobs = [];
  if (crypto) {
    const c = await DATA.coin(sym); if (!c.bars || !c.bars.length) throw new Error('no price history');
    Object.assign(ctx, { coin: c.market, bars: c.bars, cur: 'USD', live: c.price, funding: c.funding, news: c.news, priceUSD: c.price, liveSrc: c.liveSrc, coinDetail: c.detail, newsAt: c.file && c.file.newsAt });
    const cr = await DATA.loadCrypto(); ctx.glob = cr.global; ctx.fng = cr.fng;
    jobs.push(DATA.insider(sym).then(x => ctx.ins = x));
    if (unlocked('quant') || unlocked('macro')) jobs.push(sym === 'BTC' ? Promise.resolve(ctx.btc = c.bars) : DATA.coin('BTC').then(b => ctx.btc = b.bars).catch(() => { }));
  } else {
    const s = item.ondemand ? await DATA.stockOnDemand(item.id, item.name) : await DATA.stock(item.id);
    if (!s || !s.d || !s.d.length) throw new Error('no price history');
    Object.assign(ctx, { s, bars: s.d, cur: s.cur, news: s.news, name: s.name || item.name, priceUSD: s.cur === 'USD' ? s.price : (s.cur === 'GBP' && DATA.fx() ? s.price * DATA.fx() : s.price), newsAt: s.newsAt });
    const t = s.sym || sym; jobs.push(DATA.insider(t.replace('-', '.')).then(x => x || DATA.insider(t)).then(x => ctx.ins = x), DATA.holders(t).then(x => ctx.holders = x));
    if (unlocked('quant') || unlocked('macro')) jobs.push(DATA.stock('SPY').then(x => ctx.spy = x.d).catch(() => { }));
    if (unlocked('macro')) jobs.push(DATA.stockFng().then(x => ctx.stockFng = x));
    ctx.nextEarnings = nextEarnings(s); ctx.divNext = nextDiv(s);
  }
  await Promise.all(jobs);
  ctx.bench = crypto ? (sym === 'BTC' ? null : ctx.btc) : (sym === 'SPY' ? null : ctx.spy); ctx.benchName = crypto ? 'BTC' : 'the S&P 500';
  W.seed = [...sym].reduce((a, c) => a + c.charCodeAt(0), 7) + new Date().getDate();
  return ctx;
}
function nextEarnings(s) {
  if (s.earn && s.earn.date) return { ts: new Date(s.earn.date + 'T12:00:00Z').getTime(), time: s.earn.time, epsF: s.earn.epsF, est: false };
  const h = s.an && s.an.earningsHistory; if (h && h.length) { const last = h.map(x => x.dateReported).filter(Boolean).sort().pop(); if (last) { let t = new Date(last + 'T12:00:00Z').getTime(); while (t < Date.now() - 86400000) t += 91 * 86400000; if (t - Date.now() < 120 * 86400000) return { ts: t, est: true }; } }
  return null;
}
function nextDiv(s) { const d = (s.div || []).map(x => x[0] * 1000).filter(t => t > Date.now() - 800 * 86400000); if (d.length < 2) return null; const gaps = d.slice(1).map((t, i) => t - d[i]).sort((a, b) => a - b); const g = gaps[gaps.length >> 1]; let t = d[d.length - 1] + g; while (t < Date.now()) t += g; return t - Date.now() < 130 * 86400000 ? { ts: t } : null; }


// ---------------------------------------------------------------- report rendering
function srcLine(ctx) {
  const t = []; const s = ctx.s;
  if (ctx.crypto) { t.push(`Prices: ${ctx.liveSrc || 'Kraken'} daily candles (live)`); t.push(`Market data: CoinGecko${ctx.coin && ctx.coin.last_updated ? ' (' + W.ago(new Date(ctx.coin.last_updated).getTime()) + ')' : ''}`); if (ctx.funding) t.push(`Funding: ${ctx.funding.src}`); }
  else { t.push(`Prices: Yahoo Finance daily bars${s.asOf ? ', last ' + new Date(s.asOf * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' UK' : ''} (delayed)`); if (s.fund) t.push(`Financials: SEC EDGAR XBRL, filed ${s.fund.filed || 'n/a'}`); if (s.an) t.push('Analysts: Nasdaq via Ticker'); }
  return t.join(' · ');
}
function renderHeader(ctx) {
  const rep = $('#report'); const p = ctx.bars[ctx.bars.length - 1][4], prev = ctx.crypto ? ctx.bars[ctx.bars.length - 2][4] : (ctx.s.prev || ctx.bars[ctx.bars.length - 2][4]);
  const price = ctx.crypto ? ctx.live : ctx.s.price; const chg = price / prev - 1;
  const lg = DATA.logo(ctx.crypto ? ctx.sym : ctx.item.id, ctx.crypto);
  const h = document.createElement('div'); h.className = 'rhead card';
  h.innerHTML = `<div class="rh-l">${lg ? `<img class="logo ${lg.chip ? 'chip' : ''}" src="${esc(lg.src)}" alt="">` : `<div class="logo mono">${esc(ctx.sym.slice(0, 2))}</div>`}<div><div class="rh-sym">${esc(ctx.sym)} <span class="kind">${ctx.crypto ? 'Crypto' : ctx.s.kind === 'etf' ? 'ETF' : (ctx.s.exch || ctx.s.ex || '')}</span></div><div class="rh-name">${esc(ctx.name)}</div></div></div><div class="rh-r"><div class="rh-px">${esc(fmtMoney(price, ctx.cur))}</div><div class="rh-chg ${chg >= 0 ? 'up' : 'dn'}">${W.pct(chg, 2)} ${ctx.crypto ? 'today (UTC)' : 'day'}</div></div>`;
  rep.append(h);
  const src = document.createElement('div'); src.className = 'srcline'; src.textContent = srcLine(ctx); rep.append(src);
}
function factsHTML(f) { return f && f.length ? `<div class="facts">${f.map(x => `<div><span>${esc(x.k)}</span><b>${esc(x.v)}</b></div>`).join('')}</div>` : ''; }
function renderCard(sec, ctx, animate, host) {
  const a = ANALYSTS[sec.by]; const card = document.createElement('section'); card.className = 'card sec' + (animate ? ' pop' : ''); card.style.setProperty('--c', a.color);
  const head = document.createElement('div'); head.className = 'sec-h'; head.append(avatar(sec.by, 36));
  head.insertAdjacentHTML('beforeend', `<div class="sec-t"><b>${esc(a.name)}</b><span>${esc(a.title)}</span></div><span class="chip">${esc(nice(sec.headline || ''))}</span>`);
  card.append(head);
  const body = document.createElement('div'); body.className = 'sec-b';
  body.innerHTML = sec.lines.map(l => l.startsWith('•') ? `<li>${esc(l.slice(1).trim())}</li>` : `<p>${esc(l)}</p>`).join('').replace(/(<li>.*?<\/li>)+/gs, m => `<ul>${m}</ul>`);
  card.append(body);
  if (sec.id === 'chartist' && ctx.bars.length > 20) { const h = document.createElement('div'); body.prepend(h); miniChart(h, ctx.bars, { fmt: v => fmtMoney(v, ctx.cur), levels: sec.levels, crypto: ctx.crypto }); }
  if (sec.revQ && sec.revQ.length > 2) {
    const mx = Math.max(...sec.revQ.map(x => x[1])); const b = document.createElement('div'); b.className = 'revq';
    b.innerHTML = '<div class="revq-t">Quarterly revenue (SEC filings)</div><div class="revq-bars">' + sec.revQ.map(([d, v]) => `<div class="rq"><i style="height:${Math.max(3, v / mx * 100)}%"></i><span>${esc(fmtMoney(v, 'USD', true))}</span><em>${esc(new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }))}</em></div>`).join('') + '</div>';
    body.append(b);
  }
  if (sec.peerTable && sec.peerTable.top && sec.peerTable.top.length) {
    const pr = sec.peerTable; const f = ctx.s.m || {};
    const row = (n, x, me) => `<tr class="${me ? 'me' : ''}"><td>${esc(n)}</td><td>${x.pe ? x.pe.toFixed(1) : '–'}</td><td>${x.ps ? x.ps.toFixed(1) : '–'}</td><td>${x.g != null ? W.pct(x.g, 0) : '–'}</td><td>${x.nm != null ? W.pct(x.nm, 0) : '–'}</td></tr>`;
    body.insertAdjacentHTML('beforeend', `<div class="tbl-t">Peers · ${esc(pr.label)}</div><div class="tblw"><table class="tbl"><tr><th></th><th>P/E</th><th>P/S</th><th>Growth</th><th>Net m.</th></tr>${row(ctx.sym, f, true)}${pr.top.slice(0, 5).map(x => row(x.id, x)).join('')}${row('Median', pr.med)}</table></div>`);
  }
  if (sec.items) {
    body.insertAdjacentHTML('beforeend', '<div class="news">' + sec.items.slice(0, 8).map(n => `<a class="nw" href="${esc(n.u)}" target="_blank" rel="noopener">${n.img ? `<img decoding="async" referrerpolicy="no-referrer" src="${esc(n.img)}" alt="" onerror="this.remove()">` : '<div class="noimg">News</div>'}<div><b>${esc(n.t)}</b><span>${esc(n.s || '')}${n.ts ? ' · ' + W.ago(n.ts * 1000) : ''}${n.tone ? ` · <i class="${n.tone > 0 ? 'up' : 'dn'}">${n.tone > 0 ? 'positive' : 'negative'}</i>` : ''}</span></div></a>`).join('') + '</div>');
  }
  if (sec.catalysts && sec.catalysts.length) body.insertAdjacentHTML('beforeend', '<div class="cats">' + sec.catalysts.map(c => `<div class="cat"><b>${esc(W.dshort(c.ts))}</b><span>${esc(c.label)}</span><em>${W.daysTo(c.ts)} days</em></div>`).join('') + '</div>');
  if (sec.rows) {
    body.insertAdjacentHTML('beforeend', `<div class="tbl-t">Latest filings (The Insider House)</div><div class="tblw"><table class="tbl ins"><tr><th>Who</th><th></th><th>Amount</th><th>Traded</th></tr>${sec.rows.slice(0, 8).map(r => `<tr><td>${esc(r.politician)}<small>${esc(r.chamber)}${r.party ? ' · ' + esc(r.party) : ''}</small></td><td class="${r.side === 'buy' ? 'up' : 'dn'}">${r.side === 'buy' ? 'Buy' : r.side === 'sell' ? 'Sell' : esc(r.tx_type || '')}</td><td>${esc(r.amount || '')}</td><td>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.tx_date)}</a>` : esc(r.tx_date)}</td></tr>`).join('')}</table></div><a class="more" href="${IH}#t=${encodeURIComponent(ctx.sym)}" target="_blank" rel="noopener">Open ${esc(ctx.sym)} in The Insider House ↗</a>`);
  }
  if (sec.holders && sec.holders.length && !sec.rows) body.insertAdjacentHTML('beforeend', `<a class="more" href="${IH}#t=${encodeURIComponent(ctx.sym)}" target="_blank" rel="noopener">Open ${esc(ctx.sym)} in The Insider House ↗</a>`);
  body.insertAdjacentHTML('beforeend', factsHTML(sec.facts));
  if (sec.signals && sec.signals.length) body.insertAdjacentHTML('beforeend', '<div class="sigs">' + sec.signals.map(g => `<span class="sg ${g.s > 0.15 ? 'up' : g.s < -0.15 ? 'dn' : ''}">${esc(g.name)}: ${esc(g.reading)}</span>`).join('') + '</div>');
  const un = (sec.unavailable || []).filter(Boolean); if (un.length) body.insertAdjacentHTML('beforeend', '<div class="unav">' + un.map(u => `<div>Unavailable: ${esc(u)}</div>`).join('') + '</div>');
  if (sec.src) body.insertAdjacentHTML('beforeend', `<a class="more" href="${esc(sec.src)}" target="_blank" rel="noopener">SEC filings ↗</a>`);
  (host || $('#report')).append(card);
}
function verdictInner(ctx, v, xp, compact) {
  const gauge = `<div class="gauge"><div class="g-bar"><i style="left:${v.score}%"></i></div><div class="g-lab"><span>Bearish</span><span>Neutral</span><span>Bullish</span></div></div>`;
  const sigRows = v.sigs.map(g => `<tr><td>${esc(g.name)}<small>${esc((ANALYSTS[g.by] || {}).name || g.by)}</small></td><td>${esc(g.reading)}</td><td class="${g.s > 0 ? 'up' : g.s < 0 ? 'dn' : ''}">${g.s > 0 ? '+' : ''}${g.s.toFixed(2)}</td><td>×${g.w}</td></tr>`).join('');
  return `<div class="v-top"><div class="v-score" style="--s:${v.score}"><b>${v.score}</b><span>/100</span></div><div><div class="v-stance">${esc(v.stance)}</div><div class="v-conf">Confidence ${v.conf}% · ${v.sigs.length} signals</div><div class="nfa">Not financial advice</div></div></div>${gauge}
  <div class="v-cols"><div class="v-col bull"><h4><i></i>Bull case</h4>${v.bull.length ? '<ul>' + v.bull.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '<p class="muted">No strong bullish points in the data.</p>'}</div><div class="v-col bear"><h4><i></i>Bear case</h4>${v.bear.length ? '<ul>' + v.bear.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '<p class="muted">No strong bearish points in the data.</p>'}</div></div>
  <h4 class="v-h">Dated catalysts</h4>${v.cats.length ? '<div class="cats">' + v.cats.map(c => `<div class="cat"><b>${esc(W.dshort(c.ts))}</b><span>${esc(c.label)}</span><em>${W.daysTo(c.ts)} days</em></div>`).join('') + '</div>' : '<p class="muted">None in the feeds. I won\'t make one up.</p>'}
  <details class="v-how"${compact ? '' : ''}><summary>How the score is computed</summary><p>Each analyst turns a real reading into a signal from −1 (bearish) to +1 (bullish) with a weight. Score = 50 + 50 × (Σ weight × signal ÷ Σ weight) = <b>${v.score}</b>. Confidence = (0.55 × |net signal| + 0.45 × share of weight agreeing with the net direction) × data coverage (${Math.round(v.coverage * 100)}%) = <b>${v.conf}%</b>.</p><div class="tblw"><table class="tbl"><tr><th>Signal</th><th>Reading</th><th>Score</th><th>Weight</th></tr>${sigRows}</table></div></details>
  ${xp ? `<div class="v-xp">Tower progress +${xp.gain} points${xp.notes.length ? ' · ' + esc(xp.notes.join(' · ')) : ''}</div>` : ''}`;
}
function renderVerdictCard(ctx, v, done, xp) {
  const card = document.createElement('section'); card.className = 'card verdict-card pop'; card.style.setProperty('--c', '#fbbf24');
  const head = document.createElement('div'); head.className = 'sec-h'; head.append(avatar('boss', 36)); head.insertAdjacentHTML('beforeend', `<div class="sec-t"><b>Boss</b><span>Verdict on ${esc(ctx.sym)}</span></div><span class="chip">${v.score}/100</span>`);
  card.append(head); const b = document.createElement('div'); b.className = 'sec-b'; b.innerHTML = verdictInner(ctx, v, null) + callButtons(ctx); card.append(b); $('#report').append(card); wireCallButtons(card, ctx);
}
function callLogged(t, dir) {
  if (t.aid) return ST.calls.some(c => c.aid === t.aid && c.dir === dir);
  return ST.calls.some(c => c.id === t.id && c.dir === dir && Math.abs((c.price || 0) - (t.price || 0)) < 1e-9 && new Date(c.at).toDateString() === new Date().toDateString());
}
function callBtnLabel(ctx, dir) {
  const t = typeof ctx.item === 'object' ? callTarget(ctx) : ctx;
  if (callLogged(t, dir)) return `<button class="btn ${dir} logged" data-dir="${dir}" disabled>Call logged</button>`;
  return `<button class="btn ${dir}" data-dir="${dir}">Make call: ${dir === 'bull' ? 'Bullish' : 'Bearish'}</button>`;
}
function callButtons(ctx) {
  const watched = ST.watch.some(w => w.id === ctx.item.id);
  return `<div class="callrow">${callBtnLabel(ctx, 'bull')}${callBtnLabel(ctx, 'bear')}</div><button class="btn ghost wbtn" data-watch${watched ? ' disabled' : ''}>${watched ? 'On your watchlist' : 'Add ' + esc(ctx.sym) + ' to watchlist'}</button>`;
}
function markLogged(dir) {
  $$(`[data-dir="${dir}"]`).forEach(b => { b.disabled = true; b.textContent = 'Call logged'; b.classList.add('logged'); });
}
function wireCallButtons(root, ctx) {
  $$('[data-dir]', root).forEach(b => b.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); if (b.disabled) return; logCall(callTarget(ctx), b.dataset.dir); });
  $$('[data-watch]', root).forEach(b => b.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); addWatch({ id: ctx.item.id, kind: ctx.item.kind, name: ctx.name, ondemand: !!ctx.item.ondemand }); b.textContent = 'On your watchlist'; b.disabled = true; });
}

function snapOf(ctx, v, done, aid) {
  const price = ctx.crypto ? ctx.live : (ctx.s && ctx.s.price);
  return {
    aid, at: Date.now(),
    sym: ctx.item.id, name: ctx.name, kind: ctx.item.kind,
    ondemand: !!ctx.item.ondemand, cur: ctx.cur, price, crypto: !!ctx.crypto,
    fund: ctx.s && ctx.s.m || null,
    bars: (ctx.bars || []).slice(-180).map(b => [b[0], b[1], b[2], b[3], b[4], b[5] || 0]),
    v: { score: v.score, stance: v.stance, conf: v.conf, coverage: v.coverage, bull: v.bull || [], bear: v.bear || [], cats: v.cats || [], lines: v.lines || [], sigs: v.sigs || [] },
    done: (done || []).map(sec => ({
      id: sec.id, by: sec.by, headline: sec.headline, lines: sec.lines || [],
      facts: sec.facts, signals: sec.signals, unavailable: sec.unavailable,
      catalysts: sec.catalysts,
      items: sec.items && sec.items.slice(0, 8).map(n => ({ t: n.t, s: n.s, u: n.u, ts: n.ts, tone: n.tone, img: n.img })),
      rows: sec.rows && sec.rows.slice(0, 8),
      holders: sec.holders && sec.holders.length ? 1 : undefined,
      src: sec.src, revQ: sec.revQ, peerTable: sec.peerTable, levels: sec.levels
    }))
  };
}
function ctxFromSnap(snap) {
  return {
    item: { id: snap.sym, kind: snap.kind, ondemand: snap.ondemand },
    sym: snap.sym, name: snap.name, cur: snap.cur, crypto: !!snap.crypto,
    bars: snap.bars || [], live: snap.price, s: { price: snap.price, m: snap.fund || {} },
    aid: snap.aid, snap, score: snap.v && snap.v.score
  };
}

let sheetOpen = false, sheetPushed = false, sheetHideT = 0;
function overlayOff(on) {
  document.body.classList.toggle('sheet-on', !!on);
  if (scene && scene.setHud) scene.setHud(!on);
}
function fillSheetHead(kind, name, sym) {
  const hd = $('#sheet .shead'); hd.innerHTML = '';
  const left = document.createElement('div'); left.className = 'shead-l';
  left.append(avatar('boss', 40));
  left.insertAdjacentHTML('beforeend', `<div><div class="vm-k">${kind}</div><div class="vm-t">${esc(name)} <span>${esc(sym)}</span></div></div>`);
  hd.append(left);
  hd.insertAdjacentHTML('beforeend', '<button class="stx" type="button" aria-label="Close">✕</button>');
}
function callInfoHTML(c, live) {
  const dl = c.dir === 'bull' ? 'Bullish' : 'Bearish';
  const r = live != null && c.price ? live / c.price - 1 : null;
  const signed = r == null ? null : (c.dir === 'bull' ? r : -r);
  const d7 = Math.max(0, Math.ceil((c.at + 7 * 864e5 - Date.now()) / 864e5));
  const d30 = Math.max(0, Math.ceil((c.at + 30 * 864e5 - Date.now()) / 864e5));
  const st7 = c.s7 ? `7d ${c.s7.ok ? 'right' : 'wrong'} ${W.pct(c.s7.ret)}` : (Date.now() < c.at + 7 * 864e5 ? `7d scores in ${d7} day${d7 === 1 ? '' : 's'}` : '7d waiting for a close');
  const st30 = c.s30 ? `30d ${c.s30.ok ? 'right' : 'wrong'} ${W.pct(c.s30.ret)}` : (Date.now() < c.at + 30 * 864e5 ? `30d scores in ${d30} day${d30 === 1 ? '' : 's'}` : '30d waiting for a close');
  return `<section class="card call-meta"><div class="sec-b">
    <div class="cm-row"><span>Direction</span><b class="dir ${c.dir}">${dl}</b></div>
    <div class="cm-row"><span>Entry</span><b>${esc(fmtMoney(c.price, c.cur))}</b></div>
    <div class="cm-row"><span>Logged</span><b>${esc(W.dshort(c.at))}</b></div>
    <div class="cm-row"><span>Live since</span>${r != null ? `<b class="${signed >= 0 ? 'up' : 'dn'}" data-livepct>${W.pct(r)}</b>` : '<b class="muted" data-livepct>—</b>'}</div>
    <div class="cm-row"><span>Scoring</span><b>${esc(st7)} · ${esc(st30)}</b></div>
  </div></section>`;
}
function pxToCallCur(px, from, cur) {
  if (px == null || !isFinite(px)) return null;
  if (!from || !cur || from === cur) return px;
  const fx = DATA.fx(); if (!fx) return null;
  if (from === 'USD' && cur === 'GBP') return px / fx;
  if (from === 'GBP' && cur === 'USD') return px * fx;
  return px;
}
async function livePrice(c) {
  try {
    if (c.kind === 'crypto') {
      const x = await DATA.coin(c.id);
      const px = x && (x.price != null ? x.price : x.bars && x.bars.length ? x.bars[x.bars.length - 1][4] : null);
      return pxToCallCur(px, 'USD', c.cur || 'USD');
    }
    await DATA.loadQuotes();
    const q = DATA.quotes && DATA.quotes.q && DATA.quotes.q[c.id];
    if (q && q[0] != null) return q[0];
    const s = c.ondemand ? await DATA.stockOnDemand(c.id) : await DATA.stock(c.id);
    const px = s && (s.price != null ? s.price : s.d && s.d.length ? s.d[s.d.length - 1][4] : null);
    return pxToCallCur(px, (s && s.cur) || c.cur, c.cur);
  } catch (e) { return null; }
}
function fillSheet(snap, opts) {
  const el = $('#sheet');
  const name = (opts.call && (opts.call.name || opts.call.id)) || (snap && snap.name) || '';
  const sym = (opts.call && opts.call.id) || (snap && snap.sym) || '';
  fillSheetHead(opts.mode === 'call' ? 'Call' : 'Verdict', name, sym);
  const body = $('.sbody', el); body.innerHTML = '';
  if (snap && snap.v) {
    const ctx = ctxFromSnap(snap);
    const vcard = document.createElement('section'); vcard.className = 'card verdict-card'; vcard.style.setProperty('--c', '#fbbf24');
    const head = document.createElement('div'); head.className = 'sec-h'; head.append(avatar('boss', 36));
    head.insertAdjacentHTML('beforeend', `<div class="sec-t"><b>Boss</b><span>Verdict on ${esc(snap.sym)}</span></div><span class="chip">${snap.v.score}/100</span>`);
    vcard.append(head);
    const vb = document.createElement('div'); vb.className = 'sec-b'; vb.innerHTML = verdictInner(ctx, snap.v, opts.xp || null); vcard.append(vb);
    body.append(vcard);
    (snap.done || []).forEach(sec => renderCard(sec, ctx, false, body));
    if (!opts.call) { body.insertAdjacentHTML('beforeend', callButtons(ctx)); wireCallButtons(body, ctx); }
  } else {
    body.insertAdjacentHTML('beforeend', '<p class="muted pad">The full analysis for this call wasn\'t saved. New calls keep a snapshot so you can open them offline.</p>');
  }
  if (opts.call) {
    body.insertAdjacentHTML('beforeend', callInfoHTML(opts.call, null));
    livePrice(opts.call).then(px => {
      const n = $('[data-livepct]', el); if (!n || px == null || !opts.call.price) return;
      const r = px / opts.call.price - 1, signed = opts.call.dir === 'bull' ? r : -r;
      n.textContent = W.pct(r); n.className = signed >= 0 ? 'up' : 'dn';
    });
  }
}
function openSheetEl() {
  const el = $('#sheet'), scrim = $('#scrim');
  el.scrollTop = 0; el.style.transform = '';
  el.hidden = false; scrim.hidden = false;
  overlayOff(true);
  requestAnimationFrame(() => { el.classList.add('open'); scrim.classList.add('on'); });
  if (!sheetOpen) { sheetPushed = true; history.pushState({ brSheet: 1 }, '', location.href); }
  sheetOpen = true;
  clearTimeout(sheetHideT);
}
function hideSheet() {
  const el = $('#sheet'), scrim = $('#scrim');
  el.classList.remove('open', 'dragging'); el.style.transform = '';
  scrim.classList.remove('on');
  overlayOff(false);
  sheetOpen = false;
  sheetHideT = setTimeout(() => { if (!sheetOpen) { el.hidden = true; scrim.hidden = true; } }, 400);
}
function closeSheet() {
  if (sheetPushed && history.state && history.state.brSheet) { sheetPushed = false; history.back(); }
  else hideSheet();
}
function closeVerdict() { closeSheet(); }
function openVerdict(ctx, v, xp) {
  const last = LAST && LAST.sym === ctx.item.id ? LAST : null;
  const snap = (last && last.snap) || snapOf(ctx, v, last && last.done || [], last && last.aid);
  fillSheet(snap, { mode: 'verdict', xp });
  openSheetEl();
}
function openCallSheet(c) {
  const snap = c.snap || (LAST && LAST.sym === c.id && LAST.snap) || null;
  fillSheet(snap, { mode: c.dir ? 'call' : 'verdict', call: c.dir ? c : null, xp: null });
  openSheetEl();
}
function wireSheet() {
  const el = $('#sheet'), scrim = $('#scrim');
  const zones = el.querySelectorAll('.grab, .shead, .stop');
  let d = null;
  const down = e => { if (e.button > 0 || e.target.closest('button:not(.grab), a, input')) return; d = { y: e.clientY, t: performance.now(), dy: 0 }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { } el.classList.add('dragging'); };
  const move = e => { if (!d) return; d.dy = Math.max(0, e.clientY - d.y); el.style.transform = `translate3d(0,${d.dy}px,0)`; };
  const end = e => { if (!d) return; const { dy, t } = d; const tap = dy < 6 && performance.now() - t < 500; const onGrab = e.currentTarget.classList.contains('grab') || e.target.closest && e.target.closest('.grab'); d = null; el.classList.remove('dragging'); el.style.transform = ''; if (e.type !== 'pointercancel' && (dy > 70 || (tap && onGrab))) closeSheet(); };
  zones.forEach(z => { z.addEventListener('pointerdown', down); z.addEventListener('pointermove', move); z.addEventListener('pointerup', end); z.addEventListener('pointercancel', end); });
  let y0 = null, dy = 0;
  el.addEventListener('touchstart', e => { y0 = el.scrollTop <= 0 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  el.addEventListener('touchmove', e => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy > 0 && el.scrollTop <= 0) { el.classList.add('dragging'); el.style.transform = `translate3d(0,${dy * .9}px,0)`; } }, { passive: true });
  el.addEventListener('touchend', () => { if (y0 == null) return; el.classList.remove('dragging'); el.style.transform = ''; if (dy > 110) closeSheet(); y0 = null; });
  el.addEventListener('click', e => { if (e.target.closest('.stx')) closeSheet(); });
  scrim.addEventListener('click', () => closeSheet());
  addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen) closeSheet(); });
  addEventListener('popstate', () => { if (sheetOpen) { sheetPushed = false; hideSheet(); } });
}


// ---------------------------------------------------------------- analysis flow
let RUN = null, LAST = null;
function toast(html, ms = 3500) { const t = $('#toast'); t.innerHTML = html; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms); }
function setBusy(b) { document.body.classList.toggle('busy', b); }
function setActivity(txt, on) { const a = $('#activity'); $('span', a).textContent = txt; a.classList.toggle('on', !!on); }
const isLand = () => matchMedia('(orientation: landscape) and (max-height: 560px)').matches;

function earningsSection(ctx) {
  const s = ctx.s || {}, e = ctx.nextEarnings, h = (s.an && s.an.earningsHistory) || [];
  const out = { id: 'earnings', lines: [], signals: [], facts: [], unavailable: [], headline: '' };
  if (e) {
    out.lines.push(`Next report is ${W.date(e.ts)}, in ${W.daysTo(e.ts)} days${e.est ? '. That date is estimated from past report dates, because Nasdaq has not listed one yet' : ''}.`);
    out.facts.push({ k: 'Next report', v: W.dshort(e.ts) + (e.est ? ' (est.)' : '') });
    if (e.time) out.facts.push({ k: 'Timing', v: /pre/i.test(e.time) ? 'Before open' : /after/i.test(e.time) ? 'After close' : e.time });
    if (e.epsF != null && e.epsF !== '') out.facts.push({ k: 'EPS forecast', v: '$' + e.epsF });
  } else out.unavailable.push('next earnings date (not in the Nasdaq calendar)');
  if (h.length) {
    const beats = h.filter(x => x.surprisePct > 0).length, inl = h.filter(x => x.surprisePct === 0).length;
    out.lines.push(`Over the last ${h.length} reports it beat the EPS consensus ${beats} times${inl ? ` and matched it ${inl} time${inl > 1 ? 's' : ''}` : ''}.`);
    const last = h[0]; if (last && last.eps != null) out.lines.push(`Latest (${last.fiscalQtrEnd}): EPS $${last.eps} vs $${last.consensusForecast} expected, a ${last.surprisePct >= 0 ? '+' : ''}${(+last.surprisePct).toFixed(1)}% surprise.`);
    for (const x of h.slice(0, 4)) out.lines.push(`• ${x.fiscalQtrEnd}: $${x.eps} vs $${x.consensusForecast} (${x.surprisePct >= 0 ? '+' : ''}${(+x.surprisePct).toFixed(1)}%)`);
  } else out.unavailable.push('EPS beat history');
  out.lines.push('Context only: this does not change the score, because the Accountant already scores the beat record.');
  out.headline = e ? `${W.daysTo(e.ts)}d to report` : 'No date yet';
  return out;
}

const pick = a => a[Math.floor(Math.random() * a.length)];
let runGen = 0;
const runAlive = gen => runGen === gen;

async function startAnalysis(item) {
  if (RUN && RUN.ctx && (RUN.done || []).length) {
    try {
      const prev = RUN; prev.skip = true;
      const v = prev.v || AN.verdict(prev.ctx, prev.done);
      finishAnalysis(prev.ctx, v, prev.done, prev.item, prev.order || [], prev.gen);
    } catch (e) { console.error('flush previous run', e); }
  } else if (RUN) { RUN.skip = true; try { if (dlgResolve) dlgResolve(); } catch (e) { } }
  const gen = ++runGen;
  if (sheetOpen) { hideSheet(); sheetPushed = false; }
  if (typeof item === 'string') {
    setBusy(true);
    let r = null;
    try { r = await resolve(item); } catch (e) { console.error(e); }
    if (!runAlive(gen)) return;
    if (!r) { setBusy(false); toast('I couldn\'t find that ticker or coin. Try the symbol, like PLTR or BTC.'); return; }
    item = r;
  }
  showTab('floor'); document.body.classList.remove('rep-open');
  RUN = { item, skip: false, gen, ctx: null, done: [], order: null, v: null };
  setBusy(true);
  hideDialog();
  const crypto = item.kind === 'crypto', sym = item.id;
  const order = (crypto ? ORDER_COIN : ORDER_STOCK).filter(id => unlocked(id) && (id !== 'earnings' || !crypto));
  $('#report').innerHTML = '<button class="rep-x" id="repClose" type="button">Close</button>'; $('#repClose').onclick = () => document.body.classList.remove('rep-open');
  stopIdle(); syncNeeds();
  for (const id of Object.keys(ANALYSTS)) { scene.quiet(id); if (id !== 'you' && !order.includes(id) && id !== 'boss' && !scene.isHome(id)) scene.goHome(id, 1.4); }
  setActivity(`${sym} · team to the table`, true);
  scene.hop('boss'); scene.say('boss', `Table! ${sym.replace('.L', '')}`); SFX.play('blip');
  const intro = dialog('boss', `Team, to the table. We're looking at ${item.name} (${sym}).`, { auto: 1800 });
  const seats = new Map(order.map((id, i) => [id, tableSeat(i)]));
  const gather = Promise.all([scene.walk('boss', BOSS_HEAD, 1.2), ...order.map((id, i) => sleep(i * 240).then(() => scene.walk(id, seats.get(id), 1.45)))]);
  let ctx = null, done = [];
  try {
    try { [ctx] = await Promise.all([buildContext(item), intro]); }
    catch (e) {
      console.error(e);
      if (!runAlive(gen)) return;
      scene.quiet('boss'); await dialog('boss', `I couldn't load real data for ${sym} right now (${e.message || e}). Nothing to analyse, so no guessing.`, { auto: 0 });
      if (!runAlive(gen)) return;
      hideDialog(); setBusy(false); setActivity('Tap a bot'); RUN = null; syncNeeds(); order.forEach((id, i) => setTimeout(() => scene.goHome(id, 1.2), i * 300)); scene.goHome('boss'); startIdle(); return;
    }
    if (!runAlive(gen)) return;
    if (RUN && RUN.gen === gen) { RUN.ctx = ctx; RUN.order = order; }
    scene.quiet('boss');
    const closes = (ctx.bars || []).map(b => b[4]).slice(-120);
    if (closes.length) scene.setHolo({ series: closes, up: closes[closes.length - 1] >= closes[0], label: sym.replace('.L', '').slice(0, 8) });
    try { renderHeader(ctx); } catch (e) { console.error(e); }
    for (const id of order) {
      if (id === 'bear') continue;
      let sec; try { sec = id === 'earnings' ? earningsSection(ctx) : AN[id](ctx); } catch (e) { console.error(id, e); sec = { id, lines: [`My numbers didn't compute for this one (${e.message}).`], signals: [], headline: 'Error' }; }
      sec.by = id; done.push(sec);
      if (RUN && RUN.gen === gen) RUN.done = done;
    }
    if (order.includes('bear')) {
      try { const bearSec = AN.bear(ctx, done); if (bearSec) { bearSec.by = 'bear'; done.push(bearSec); } }
      catch (e) { console.error('bear', e); done.push({ id: 'bear', by: 'bear', lines: [`I couldn't finish the bear case (${e.message}).`], signals: [], headline: 'Error' }); }
    }
    setActivity(`${sym} · gathering upstairs`, true);
    if (!RUN.skip) await Promise.race([gather, sleep(15000)]);
    if (!runAlive(gen)) return;
    for (const id of order) if (!scene.isAt(id, seats.get(id))) scene.place(id, seats.get(id));
    if (!scene.isAt('boss', BOSS_HEAD)) scene.place('boss', BOSS_HEAD);
    for (let i = 0; i < done.length; i++) {
      const sec = done[i], id = sec.by;
      if (RUN.skip) { try { renderCard(sec, ctx); } catch (e) { console.error(e); } continue; }
      setActivity(`${sym} · ${ANALYSTS[id].name} reporting`, true);
      scene.hop(id); scene.say(id, nice(sec.headline || '…')); SFX.play('blip');
      try { renderCard(sec, ctx, true); } catch (e) { console.error(e); }
      const pages = (sec.lines || []).filter(x => !String(x).startsWith('•')).slice(0, 2);
      for (const p of pages) { if (RUN.skip || !runAlive(gen)) break; await dialog(id, p, { auto: Math.min(6500, 1500 + p.length * 34), step: `${i + 1} of ${done.length}` }); }
      if (!runAlive(gen)) return;
      scene.quiet(id);
      if (!RUN.skip) {
        const tone = (sec.signals || []).reduce((a, g) => a + (g.s || 0) * (g.w || 1), 0);
        const others = [...order.filter(o => o !== id), 'boss']; const o = Math.random() < 0.35 ? 'boss' : pick(others);
        const line = tone > 0.6 ? pick(['Agreed.', 'Good read.', 'Nice, noted.', 'That helps the bull case.']) : tone < -0.6 ? pick(['Hmm, that\'s a worry.', 'Noted. Risky.', 'Not great.', 'That hurts the bull case.']) : pick(['Fair.', 'Mixed, then.', 'OK, next.', 'Noted.']);
        scene.say(o, line); setTimeout(() => scene.quiet(o), 1700); await sleep(500);
        if (!runAlive(gen)) return;
      }
    }
    let v;
    try { v = AN.verdict(ctx, done); } catch (e) {
      console.error('verdict', e);
      v = { score: 50, stance: 'Mixed', conf: 0, coverage: 0, sigs: [], bull: [], bear: [], cats: [], lines: ['I could not finish the score for this one. The reports below still stand.'] };
    }
    if (!runAlive(gen)) return;
    if (RUN && RUN.gen === gen) { RUN.v = v; RUN.done = done; }
    setActivity(`${sym} · Boss verdict`, true);
    if (scene.holo) scene.setHolo(Object.assign({}, scene.holo, { score: v.score }));
    scene.hop('boss'); scene.say('boss', `${v.score}/100 · ${v.stance}`);
    if (!RUN.skip) await dialog('boss', (v.lines && v.lines[0]) || (`${v.score}/100 · ${v.stance}`), { auto: 2600, step: 'Verdict' });
    if (!runAlive(gen)) return;
    finishAnalysis(ctx, v, done, item, order, gen);
  } catch (e) {
    console.error('analysis', e);
    if (!runAlive(gen)) return;
    if (ctx) {
      let v; try { v = AN.verdict(ctx, done); } catch (e2) { v = { score: 50, stance: 'Mixed', conf: 0, coverage: 0, sigs: [], bull: [], bear: [], cats: [], lines: ['I could not finish the score for this one.'] }; }
      finishAnalysis(ctx, v, done, item, order, gen);
    } else {
      hideDialog(); setBusy(false); RUN = null; setActivity('Tap a bot'); startIdle();
      toast('The run hit a snag before I had enough data. Try asking again.');
    }
  }
}

function recordAnalysis(ctx, v, aid, snap) {
  const price = ctx.crypto ? ctx.live : (ctx.s && ctx.s.price);
  const row = { id: ctx.item.id, kind: ctx.item.kind, name: ctx.name, dir: null, price, cur: ctx.cur, at: Date.now(), score: v.score, stance: v.stance, ondemand: !!ctx.item.ondemand, aid, snap };
  const ix = ST.calls.findIndex(c => c.aid === aid);
  if (ix >= 0) { Object.assign(ST.calls[ix], { snap, score: v.score, stance: v.stance, price: price ?? ST.calls[ix].price }); }
  else ST.calls.unshift(row);
  save(); renderCalls();
}

function finishAnalysis(ctx, v, done, item, order, gen) {
  if (!runAlive(gen)) return;
  hideDialog();
  try {
    scene.quiet('boss'); SFX.play('win'); scene.cheer([...(order || []), 'boss']);
    let pts = null;
    try { pts = awardPoints(item, v); } catch (e) { console.error(e); }
    try { renderVerdictCard(ctx, v, done, pts); } catch (e) { console.error(e); }
    ST.history.unshift({ id: item.id, name: item.name, kind: item.kind, score: v.score, stance: v.stance, at: Date.now() }); ST.history = ST.history.slice(0, 30);
    const aid = item.id + '|' + Date.now();
    let snap;
    try { snap = snapOf(ctx, v, done, aid); } catch (e) { console.error(e); snap = { aid, at: Date.now(), sym: item.id, name: ctx.name, kind: ctx.item.kind, cur: ctx.cur, price: ctx.crypto ? ctx.live : (ctx.s && ctx.s.price), crypto: !!ctx.crypto, v, done: done || [] }; }
    LAST = { ctx, v, pts, sym: item.id, done, aid, snap };
    try { recordAnalysis(ctx, v, aid, snap); } catch (e) { console.error(e); }
    try { postAnalysisPrompts(ctx, v, done); } catch (e) { console.error(e); }
    try { openVerdict(ctx, v, pts); } catch (e) { console.error(e); toast('Verdict is ready — open it from Calls.'); }
  } catch (e) {
    console.error('finish', e);
    hideDialog();
    toast('The run finished with a problem opening the verdict. Try Calls.');
  } finally {
    if (!runAlive(gen)) return;
    const ids = [...(done || []).map(s => s.by), 'boss'];
    setBusy(false); RUN = null; renderChips(); setActivity('Tap a bot'); syncNeeds();
    setTimeout(async () => { if (RUN) return; ids.forEach((id, i) => setTimeout(() => { if (!RUN) scene.goHome(id, 1.2); }, i * 450)); setTimeout(() => { if (!RUN && scene.holo && LAST && scene.holo.label === LAST.ctx.sym.replace('.L', '').slice(0, 8)) scene.setHolo(null); }, 12000); startIdle(); }, 4000);
  }
}

const nice = s => { s = String(s); return /[a-z]/.test(s) ? s : s.charAt(0) + s.slice(1).toLowerCase(); };

// ---------------------------------------------------------------- presentation message card
let dlgResolve = null, dlgTimer = null, typeTimer = null;
function dialog(id, text, o = {}) {
  const a = ANALYSTS[id]; const d = $('#dialog'); d.hidden = false; d.style.setProperty('--c', a.color);
  const av = $('.msg-av', d); av.innerHTML = ''; av.append(avatar(id, 22));
  $('.msg-name', d).textContent = a.name; $('.msg-role', d).textContent = a.title; $('.msg-step', d).textContent = o.step || '';
  const skip = $('#skipBtn'); if (skip) skip.hidden = o.step === 'Verdict';
  const body = $('.msg-text', d);
  const parts = String(text).split(/(\s+)/); body.innerHTML = parts.map(w => /^\s+$/.test(w) ? w : `<span>${esc(w)}</span>`).join('');
  const words = $$('span', body);
  clearInterval(typeTimer); clearTimeout(dlgTimer);
  const bar = $('.msg-bar i', d); bar.style.transition = 'none'; bar.style.width = '0%';
  let i = 0; d.classList.remove('done');
  const all = () => words.forEach(w => w.classList.add('on'));
  return new Promise(res => {
    dlgResolve = () => { clearTimeout(typeTimer); clearTimeout(dlgTimer); all(); dlgResolve = null; res(); };
    const finish = () => { clearTimeout(typeTimer); all(); d.classList.add('done'); if (o.auto) { requestAnimationFrame(() => { bar.style.transition = `width ${o.auto}ms linear`; bar.style.width = '100%'; }); dlgTimer = setTimeout(() => dlgResolve && dlgResolve(), o.auto); } };
    if (REDUCE || !words.length) { finish(); return; }
    const next = () => { if (i >= words.length) { finish(); return; } const w = words[i++]; w.classList.add('on'); typeTimer = setTimeout(next, 60 + Math.min(110, w.textContent.length * 14)); };
    next();
  });
}
function hideDialog() { const d = $('#dialog'); d.hidden = true; const skip = $('#skipBtn'); if (skip) skip.hidden = false; }
function dlgTap() { const d = $('#dialog'); clearTimeout(typeTimer); d.classList.add('done'); if (dlgResolve) dlgResolve(); }

// ---------------------------------------------------------------- tower progression
function awardPoints(item, v) {
  const before = level(); let gain = 40; const notes = [];
  if (!ST.seen[item.id]) { gain += 20; notes.push('new ticker +20'); ST.seen[item.id] = 1; }
  const day = new Date().toDateString(); if (ST.lastDay !== day) { gain += 30; notes.push('first today +30'); ST.lastDay = day; }
  ST.xp += gain; ST.analyses++; save();
  if (level() > before) levelUp(level());
  renderProgress(); return { gain, notes };
}
function addPoints(n) { const b = level(); ST.xp += n; save(); renderProgress(); if (level() > b) levelUp(level()); }
function levelUp(L) {
  const un = UNLOCKS.filter(u => u.lvl === L);
  setTimeout(() => { toast(`<b>Tower level ${L}</b>${un.length ? ' · ' + un.map(u => esc(u.label)).join(', ') : ''}`, 5000); SFX.play('lvl'); roster(); }, 1200);
}
function nextUnlock() { return UNLOCKS.find(u => u.lvl > level()); }
function progressHTML() {
  const L = level(), lo = lvlXP(L), hi = lvlXP(L + 1), pct = Math.round((ST.xp - lo) / (hi - lo) * 100), nx = nextUnlock();
  return `<div class="prog-top"><b>Tower level ${L}</b><span>${(ST.xp - lo).toLocaleString('en-GB')} / ${(hi - lo).toLocaleString('en-GB')} pts</span></div><div class="pbar"><i style="width:${pct}%"></i></div>
  <div class="prog-next">${nx ? `Next at level ${nx.lvl}: <b>${esc(nx.label)}</b>` : 'Every floor and upgrade is open.'}<br><em>Analyses, new tickers and accurate calls build the tower.</em></div>`;
}
function renderProgress() { const p = $('#progress'); if (p) p.innerHTML = progressHTML(); updateStatus(); }
function updateStatus() {
  if (!scene) return; const s = scene.stats(); const n = Object.keys(ANALYSTS).filter(id => id !== 'you' && unlocked(id)).length;
  $('#stTime').textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  $('#stBots').textContent = `${n} bots`; const lv = $('#stLvl'); if (lv) lv.textContent = 'Lv ' + level();
  $('#cMove').textContent = s.moving; $('#cWork').textContent = s.working; $('#cWait').textContent = ST.inbox.length;
  const wc = $('#wcount'); wc.textContent = ST.inbox.length; wc.classList.toggle('zero', !ST.inbox.length);
  $$('.cur-t button').forEach(b => b.classList.toggle('on', b.dataset.c === ST.cur));
}

// ---------------------------------------------------------------- waiting on me
function addInbox(it) { it.at = Date.now(); ST.inbox = ST.inbox.filter(x => x.key !== it.key); ST.inbox.unshift(it); ST.inbox = ST.inbox.slice(0, 4); save(); renderInbox(); }
function itemOf(x) { return { id: x.sym, name: x.name, kind: x.kind, ondemand: x.ondemand }; }
const leanOf = x => x.score >= 55 ? 'bull' : x.score <= 45 ? 'bear' : null;
function question(x) {
  if (x.type === 'prompt') return x.title;
  if (x.type === 'analysis') { const d = leanOf(x); return `${x.sym} scored ${x.score}/100, ${String(x.stance || '').toLowerCase()}. ${d ? `Log a ${d === 'bull' ? 'bullish' : 'bearish'} call at ${fmtMoney(x.price, x.cur)}?` : 'Add it to your watchlist?'}`; }
  if (x.type === 'move') return `${x.title}. Run the team on it again?`;
  if (x.type === 'call') return `${x.title} (${x.sub}). Re-check it?`;
  if (x.type === 'due') return `${x.title}. Re-check it now?`;
  return x.title;
}
function syncNeeds() {
  if (!scene) return; const by = new Set(ST.inbox.map(x => x.by).filter(Boolean));
  for (const id of Object.keys(ANALYSTS)) if (id !== 'you') scene.needs(id, !RUN && by.has(id) ? 'Needs you' : null);
}
function renderInbox() {
  const host = $('#wlist'); if (!host) return; updateStatus(); syncNeeds();
  const empty = !ST.inbox.length;
  const wait = $('#waiting'), side = $('#side');
  if (wait) wait.hidden = empty;
  if (side) side.classList.toggle('has-wait', !empty);
  if (empty) { host.innerHTML = ''; return; }
  host.innerHTML = ST.inbox.map((x, i) => { const a = ANALYSTS[x.by] || ANALYSTS.boss; return `<div class="wi" data-i="${i}"><div class="wi-h"><span class="wi-av"></span><b>${esc(a.name)}</b><span class="wi-ago">${esc(W.ago(x.at))}</span></div><div class="wi-q">${esc(question(x))}</div>
  <div class="wi-a"><button class="btn ok" data-act="approve">Approve</button><button class="btn rp" data-act="reply">Reply</button><button class="btn sk" data-act="skip">Skip</button></div></div>`; }).join('');
  $$('.wi', host).forEach(el => {
    const x = ST.inbox[+el.dataset.i]; $('.wi-av', el).append(avatar(x.by || 'boss', 24));
    $$('[data-act]', el).forEach(b => b.onclick = () => inboxAct(x, b.dataset.act, el));
  });
}
function dropInbox(x) { ST.inbox = ST.inbox.filter(y => y !== x); save(); renderInbox(); }
function openReport(x) { if (LAST && LAST.sym === x.sym) { openVerdict(LAST.ctx, LAST.v, null); return true; } return false; }
function toWatch(x, msg) {
  const it = { id: x.sym, name: x.name, kind: x.kind, ondemand: x.ondemand };
  const had = ST.watch.find(w => w.id === it.id);
  if (!had) { ST.watch.push(it); save(); }
  renderWatch(); pollWatch();
  toast(msg || (had ? esc(it.id) + ' is already on your watchlist' : 'Added ' + esc(it.id) + ' to your watchlist'));
}
function inboxAct(x, act, el) {
  if (act === 'skip') { dropInbox(x); return; }
  if (act === 'approve') {
    if (x.type === 'prompt') {
      dropInbox(x);
      if (x.action === 'call') {
        const d = x.dir || leanOf(x);
        if (d) logCall(callFromInbox(x), d);
        else if (!openReport(x)) { const c = ST.calls.find(k => k.aid === x.aid || (k.id === x.sym && !k.dir)); if (c) openCallSheet(c); else toast('Open Calls to make a call on ' + esc(x.sym) + '.'); }
      }
      else if (x.action === 'watch' || x.action === 'alert' || x.action === 'remind') { toWatch(x, x.action === 'alert' ? 'Added <b>' + esc(x.sym) + '</b> to your watchlist. I\'ll flag a move over 5%.' : x.action === 'remind' ? 'Added <b>' + esc(x.sym) + '</b> to your watchlist. Ask again around earnings.' : null); }
      return;
    }
    if (x.type === 'analysis') { const d = leanOf(x); dropInbox(x); if (d) logCall(callFromInbox(x), d); else toWatch(x); return; }
    dropInbox(x); startAnalysis(itemOf(x)); return;
  }
  if (act === 'reply') {
    if (x.type === 'prompt' || x.type === 'analysis') { if (!openReport(x)) { dropInbox(x); startAnalysis(itemOf(x)); } return; }
    if (x.type === 'call' || x.type === 'due') { showTab('calls'); return; }
    const row = $('.wi-a', el); row.innerHTML = '<button class="btn bull" data-d="bull">Bullish call</button><button class="btn bear" data-d="bear">Bearish call</button><button class="btn sk" data-d="x">Cancel</button>';
    $$('[data-d]', row).forEach(b => b.onclick = ev => { ev.stopPropagation(); if (b.dataset.d === 'x') { renderInbox(); return; } logCall(callFromInbox(x), b.dataset.d); dropInbox(x); });
  }
}
function lastFor(id) { return LAST && LAST.sym === id ? LAST : null; }
function callTarget(ctx) {
  const last = lastFor(ctx.item.id);
  return { id: ctx.item.id, kind: ctx.item.kind, name: ctx.name, ondemand: !!ctx.item.ondemand, price: ctx.crypto ? ctx.live : (ctx.s && ctx.s.price), cur: ctx.cur, score: last ? last.v.score : (ctx.score != null ? ctx.score : null), aid: ctx.aid || (last && last.aid), snap: ctx.snap || (last && last.snap) || null };
}
function callFromInbox(x) {
  const last = lastFor(x.sym);
  return { id: x.sym, kind: x.kind, name: x.name, ondemand: x.ondemand, price: x.price, cur: x.cur, score: x.score, aid: x.aid || (last && last.aid), snap: last && last.snap || null };
}
function logCall(t, dir) {
  if (!t.price) { toast('No live price to log this call against.'); return false; }
  const last = lastFor(t.id);
  if (!t.aid && last) t.aid = last.aid;
  if (!t.snap && last) t.snap = last.snap;
  if (callLogged(t, dir)) { markLogged(dir); toast('Call already logged'); return false; }
  const aid = t.aid || (t.id + '|' + Date.now());
  const pending = ST.calls.find(c => c.aid === aid && !c.dir);
  if (pending) {
    pending.dir = dir; pending.price = t.price; pending.cur = t.cur || pending.cur; pending.at = Date.now();
    pending.score = t.score ?? pending.score ?? (last && last.v.score) ?? null;
    if (t.snap) pending.snap = t.snap;
  } else {
    ST.calls.unshift({ id: t.id, kind: t.kind, name: t.name, dir, price: t.price, cur: t.cur, at: Date.now(), score: t.score ?? (last && last.v.score) ?? null, ondemand: !!t.ondemand, aid, snap: t.snap || null });
  }
  const n = ST.inbox.length;
  ST.inbox = ST.inbox.filter(x => !(x.sym === t.id && x.action === 'call' && (x.dir || leanOf(x)) === dir));
  save(); addPoints(15); toast(`${dir === 'bull' ? 'Bullish' : 'Bearish'} call logged on <b>${esc(t.id)}</b> at ${esc(fmtMoney(t.price, t.cur))}. Scored at 7 and 30 days against real closes.`); SFX.play('blip');
  markLogged(dir); renderCalls(); if (ST.inbox.length !== n) renderInbox();
  return true;
}
async function histFor(c) { if (c.kind === 'crypto') { const x = await DATA.coin(c.id); return x.bars; } const s = c.ondemand ? await DATA.stockOnDemand(c.id) : await DATA.stock(c.id); return s.d; }
async function scoreCalls() {
  let changed = false;
  for (const c of ST.calls) {
    if (!c.dir || !c.price) continue;
    for (const h of [7, 30]) {
      const k = 's' + h; if (c[k]) continue; const due = c.at + h * 86400000; if (Date.now() < due) continue;
      try {
        const bars = await histFor(c); const day = Math.floor(due / 86400000); const b = bars.find(x => x[0] >= day);
        if (!b) { addInbox({ type: 'due', key: `d|${c.id}|${c.at}|${h}`, sym: c.id, kind: c.kind, name: c.name, ondemand: c.ondemand, by: 'chartist', title: `Your ${h}-day ${c.dir === 'bull' ? 'bullish' : 'bearish'} call on ${c.id} is due`, sub: 'Waiting for the next daily close to score it.' }); continue; }
        const ret = b[4] / c.price - 1, dret = c.dir === 'bull' ? ret : -ret;
        c[k] = { price: b[4], day: b[0], ret, dret, ok: dret > 0 }; changed = true; addPoints(c[k].ok ? (h === 7 ? 60 : 120) : 10);
        ST.inbox = ST.inbox.filter(x => x.key !== `d|${c.id}|${c.at}|${h}`);
        addInbox({ type: 'call', key: `c|${c.id}|${c.at}|${h}`, sym: c.id, kind: c.kind, name: c.name, ondemand: c.ondemand, price: b[4], cur: c.cur, by: c.kind === 'crypto' ? 'crypto' : 'chartist', title: `${h}-day ${c.dir === 'bull' ? 'bullish' : 'bearish'} call on ${c.id}: ${c[k].ok ? 'right' : 'wrong'}`, sub: `${W.pct(ret)} since ${W.dshort(c.at)} · ${c[k].ok ? '+' + (h === 7 ? 60 : 120) : '+10'} pts` });
      } catch (e) { }
    }
  }
  if (changed) { save(); renderCalls(); }
}
async function renderCalls() {
  const host = $('#calls'); if (!host) return;
  const logged = ST.calls.filter(c => c.dir);
  const sc7 = logged.filter(c => c.s7), sc30 = logged.filter(c => c.s30);
  const acc = a => a.length ? Math.round(a.filter(c => c.ok).length / a.length * 100) + '%' : '–';
  const best = logged.map(c => ({ c, r: c.s30 ? c.s30.dret : c.s7 ? c.s7.dret : null, h: c.s30 ? 30 : 7 })).filter(x => x.r != null).sort((a, b) => b.r - a.r).slice(0, 10);
  await DATA.loadQuotes();
  const live = c => { if (c.kind === 'crypto') return null; const q = DATA.quotes.q[c.id]; return q ? q[0] : null; };
  const open = ST.calls.filter(c => !c.s30); const dl = d => d === 'bull' ? 'Bullish' : d === 'bear' ? 'Bearish' : 'Make call';
  const dchip = c => `<span class="dir ${c.dir || 'none'}">${dl(c.dir)}</span>`;
  const key = c => `data-at="${c.at}" data-id="${esc(c.id)}" data-dir="${c.dir || ''}" role="button" tabindex="0"`;
  host.innerHTML = `<div class="stats3"><div><b>${acc(sc7.map(c => c.s7))}</b><span>7-day accuracy<br>${sc7.length} scored</span></div><div><b>${acc(sc30.map(c => c.s30))}</b><span>30-day accuracy<br>${sc30.length} scored</span></div><div><b>${ST.calls.length}</b><span>in history</span></div></div>
  <h3 class="h3">Best calls</h3>${best.length ? '<div class="lb">' + best.map((x, i) => `<div class="lbr" ${key(x.c)}><span class="rk">${i + 1}</span><b>${esc(x.c.id)}</b>${dchip(x.c)}<span class="muted">${x.h}d · ${W.dshort(x.c.at)}</span><b class="${x.r >= 0 ? 'up' : 'dn'}">${W.pct(x.r)}</b></div>`).join('') + '</div>' : '<p class="muted pad">Your leaderboard fills up once calls reach 7 days. Make a call from any verdict.</p>'}
  <h3 class="h3">Open</h3>${open.length ? open.map(c => { const lp = c.dir ? live(c) : null; const r = lp && c.price ? lp / c.price - 1 : null; const d7 = Math.max(0, Math.ceil((c.at + 7 * 864e5 - Date.now()) / 864e5)), d30 = Math.max(0, Math.ceil((c.at + 30 * 864e5 - Date.now()) / 864e5)); return `<div class="callc" ${key(c)}><div><b>${esc(c.id)}</b> ${dchip(c)}<div class="muted">${c.price ? 'at ' + esc(fmtMoney(c.price, c.cur)) + ' · ' : ''}${W.dshort(c.at)}${c.score != null ? ' · verdict ' + c.score : ''}</div></div><div class="cc-r">${r != null ? `<b class="${(c.dir === 'bull' ? r : -r) >= 0 ? 'up' : 'dn'}">${W.pct(r)}</b>` : ''}<div class="muted">${!c.dir ? 'Tap to open · make a call' : (c.s7 ? `7d ${c.s7.ok ? 'right' : 'wrong'} ${W.pct(c.s7.ret)}` : `7d in ${d7}d`) + ' · 30d in ' + d30 + 'd'}</div></div></div>`; }).join('') : '<p class="muted pad">Ask a ticker and the analysis will show up here.</p>'}
  ${sc30.length ? '<h3 class="h3">Settled</h3>' + sc30.map(c => `<div class="callc" ${key(c)}><div><b>${esc(c.id)}</b> <span class="dir ${c.dir}">${dl(c.dir)}</span><div class="muted">${W.dshort(c.at)} at ${esc(fmtMoney(c.price, c.cur))}</div></div><div class="cc-r">7d ${c.s7 && c.s7.ok ? 'right' : 'wrong'} · 30d ${c.s30.ok ? 'right' : 'wrong'} <b class="${c.s30.dret >= 0 ? 'up' : 'dn'}">${W.pct(c.s30.ret)}</b></div></div>`).join('') : ''}`;
  const openCall = el => {
    const c = ST.calls.find(x => String(x.at) === el.dataset.at && x.id === el.dataset.id && (x.dir || '') === (el.dataset.dir || ''));
    if (c) openCallSheet(c);
  };
  $$('#calls .callc, #calls .lbr').forEach(el => { el.onclick = () => openCall(el); el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCall(el); } }; });
}

// ---------------------------------------------------------------- watchlist
function addWatch(x) { if (!ST.watch.find(w => w.id === x.id)) { ST.watch.push(x); save(); toast('Added ' + esc(x.id) + ' to your watchlist'); } renderWatch(); pollWatch(); }
let WQ = {};
async function pollWatch() {
  if (!ST.watch.length) return;
  await DATA.loadQuotes(true); const cr = await DATA.loadCrypto();
  for (const w of ST.watch) if (w.kind !== 'crypto') { const q = DATA.quotes.q[w.id]; if (q) WQ[w.id] = { p: q[0], chg: q[1] / 100, cur: q[3], asOf: q[2] }; }
  const coins = ST.watch.filter(w => w.kind === 'crypto'); const pairs = coins.map(w => cr.kraken && cr.kraken[w.id]).filter(Boolean);
  try { const t = await DATA.krakenTicker(pairs); for (const w of coins) { const pk = cr.kraken[w.id]; const e = t[pk] || Object.values(t).find((v, i) => Object.keys(t)[i].includes(w.id)); if (e) { const p = +e.c[0], o = +e.o; WQ[w.id] = { p, chg: p / o - 1, cur: 'USD', asOf: Date.now() / 1000, live: true }; } } } catch (e) { }
  for (const w of coins) if (!WQ[w.id]) { const m = (cr.coins || []).find(c => c.symbol.toUpperCase() === w.id); if (m) WQ[w.id] = { p: m.current_price, chg: m.price_change_percentage_24h / 100, cur: 'USD', asOf: new Date(m.last_updated).getTime() / 1000 }; }
  renderWatch(); checkMoves();
}
function checkMoves() {
  const day = new Date().toDateString();
  for (const w of ST.watch) { const q = WQ[w.id]; if (!q || q.chg == null || Math.abs(q.chg) < 0.05) continue; const k = w.id + '|' + day + '|' + (q.chg > 0 ? 'u' : 'd'); if (ST.alerted[k]) continue; ST.alerted[k] = 1; save(); tapUser(w, q); break; }
}
async function tapUser(w, q) {
  const id = w.kind === 'crypto' ? 'crypto' : 'chartist';
  addInbox({ type: 'move', key: `m|${w.id}|${new Date().toDateString()}`, sym: w.id, kind: w.kind, name: w.name, ondemand: w.ondemand, price: q.p, cur: q.cur, by: id, title: `${w.id} is ${q.chg > 0 ? 'up' : 'down'} ${W.pctAbs(q.chg)} today`, sub: `${fmtMoney(q.p, q.cur)} · ${ANALYSTS[id].name} spotted it` });
  SFX.play('alert'); if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
  if (RUN) return;
  stopIdle(); scene.needs(id, 'Needs you');
  await scene.walk(id, { f: 0, gx: 8.42, gy: 3.45, pose: 'tap' }, 1.5); if (RUN) return;
  scene.say(id, `${w.id} ${W.pct(q.chg, 1)}`); await sleep(4500); scene.quiet(id); syncNeeds();
  if (!RUN) { scene.goHome(id); startIdle(); }
}
function renderWatch() {
  const host = $('#watch'); if (!host) return;
  if (!ST.watch.length) { host.innerHTML = '<p class="muted pad">Nothing on your watchlist yet. Add from a verdict. While the app is open, an analyst bot takes the lift down to your desk when a holding moves more than 5% in a day, and the move lands in Waiting on me.</p>'; return; }
  host.innerHTML = ST.watch.map((w, i) => { const q = WQ[w.id]; const lg = DATA.logo(w.id, w.kind === 'crypto'); return `<div class="wrow"><div class="wl">${lg ? `<img class="logo sm ${lg.chip ? 'chip' : ''}" src="${esc(lg.src)}" alt="">` : `<div class="logo sm mono">${esc(w.id.slice(0, 2))}</div>`}<div><b>${esc(w.id)}</b><span>${esc(w.name || '')}</span></div></div><div class="wr"><b>${q ? esc(fmtMoney(q.p, q.cur)) : '…'}</b><span class="${q && q.chg >= 0 ? 'up' : 'dn'}">${q && q.chg != null ? W.pct(q.chg, 2) : ''}</span></div><div class="wb"><button class="btn tiny" data-a="${i}">Analyse</button><button class="btn tiny ghost" data-r="${i}" aria-label="Remove">✕</button></div></div>`; }).join('') + `<p class="muted small">Stocks: Yahoo via the Actions build (delayed, refreshed about every 30 min). Coins: Kraken live, change vs today's UTC open.</p>`;
  $$('[data-a]', host).forEach(b => b.onclick = () => { const w = ST.watch[+b.dataset.a]; startAnalysis({ id: w.id, name: w.name, kind: w.kind, ondemand: w.ondemand }); });
  $$('[data-r]', host).forEach(b => b.onclick = () => { ST.watch.splice(+b.dataset.r, 1); save(); renderWatch(); });
}

// ---------------------------------------------------------------- profile
const ICON_OK = '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>', ICON_LOCK = '<svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v3h6V7a3 3 0 0 0-3-3z"/></svg>';
function renderProfile() {
  const host = $('#profile'); const L = level();
  const sc = ST.calls.filter(c => c.s30 || c.s7); const ok = sc.filter(c => (c.s30 || c.s7).ok).length;
  host.innerHTML = `<section class="panel glass">${progressHTML()}</section>
  <div class="stats3" style="margin-top:12px"><div><b>${ST.analyses}</b><span>analyses</span></div><div><b>${Object.keys(ST.seen).length}</b><span>tickers</span></div><div><b>${sc.length ? Math.round(ok / sc.length * 100) + '%' : '–'}</b><span>call accuracy</span></div></div>
  <h3 class="h3">The team</h3><div class="team">${Object.entries(ANALYSTS).filter(([id]) => id !== 'you').map(([id, a]) => `<div class="tm ${unlocked(id) ? '' : 'off'}" data-av="${id}"><span></span><div><b>${esc(a.name)}</b><small>${unlocked(id) ? esc(a.title) : 'Joins at level ' + a.lvl}</small></div></div>`).join('')}</div>
  <h3 class="h3">Floors, rooms and upgrades</h3><div class="unl">${UNLOCKS.map(u => { const has = u.lvl <= L; return `<label class="u ${has ? 'has' : ''}"><span class="ul">Level ${u.lvl}</span><span class="un">${esc(u.label)}${u.sub ? `<small>${esc(u.sub)}</small>` : ''}</span>${u.kind === 'room' && has ? `<input type="checkbox" data-d="${u.id}" ${ST.decorOff[u.id] ? '' : 'checked'} aria-label="Show ${esc(u.label)}">` : `<span class="ui">${has ? ICON_OK : ICON_LOCK}</span>`}</label>`; }).join('')}</div>
  <h3 class="h3">Settings</h3><div class="set"><label>Prices in <span class="seg cur-t"><button data-c="GBP">£ GBP</button><button data-c="USD">$ USD</button></span></label><label>Theme <span class="seg theme-t">${Object.entries(THEMES).map(([id, lab]) => `<button data-th="${id}" class="${ST.theme === id ? 'on' : ''}">${lab}</button>`).join('')}</span></label><label>Sound <input type="checkbox" id="sndT" ${ST.sound ? 'checked' : ''}></label></div>
  <h3 class="h3">Recent analyses</h3>${ST.history.length ? ST.history.slice(0, 8).map(h => `<button class="hist" data-h="${esc(h.id)}" data-k="${h.kind}"><b>${esc(h.id)}</b><span>${esc(h.stance)}</span><em>${h.score}/100</em><small>${W.ago(h.at)}</small></button>`).join('') : '<p class="muted pad">None yet.</p>'}
  <h3 class="h3">Where the data comes from</h3><div class="srcs" id="srcs"></div>
  <p class="nfa big">Not financial advice. Everything here is computed from public data by fixed rules; nothing is made up, and missing data is marked as unavailable.</p>
  <button class="btn ghost danger" id="reset">Reset progress</button>`;
  $$('[data-av]', host).forEach(el => $('span', el).append(avatar(el.dataset.av, 32)));
  $$('[data-d]', host).forEach(i => i.onchange = () => { ST.decorOff[i.dataset.d] = !i.checked; save(); roster(); });
  $('#sndT').onchange = e => { ST.sound = e.target.checked; save(); SFX.play('blip'); };
  $$('.cur-t button', host).forEach(b => b.onclick = () => setCur(b.dataset.c));
  $$('.theme-t button', host).forEach(b => b.onclick = () => { applyTheme(b.dataset.th, true); renderProfile(); toast('Theme: ' + THEMES[ST.theme]); });
  $$('[data-h]', host).forEach(b => b.onclick = () => { const it = (DATA.search || []).find(x => x.id === b.dataset.h && x.kind === b.dataset.k) || { id: b.dataset.h, name: b.dataset.h, kind: b.dataset.k }; startAnalysis(it); });
  $('#reset').onclick = () => { if (confirm('Reset tower progress, calls and watchlist on this device?')) { localStorage.removeItem(KEY); location.reload(); } };
  updateStatus();
  DATA.meta().then(m => {
    const age = m ? W.ago(m.built * 1000) : 'unknown';
    $('#srcs').innerHTML = `<ul>
<li><b>Stock & ETF prices</b>: Yahoo Finance daily bars, built by GitHub Actions (data ${esc(age)}). Delayed.</li>
<li><b>Company financials</b>: SEC EDGAR XBRL company facts (US listings).</li>
<li><b>Earnings dates & EPS history</b>: Nasdaq earnings calendar and Nasdaq data via Ticker; otherwise estimated from past report dates and labelled as estimated.</li>
<li><b>News</b>: Bing News RSS (article links and images), built by Actions.</li>
<li><b>Insider, Congress & fund trades</b>: The Insider House (House, Senate, OGE, SEC Form 4 and 13F).</li>
<li><b>Crypto</b>: Kraken (live prices and candles), CoinGecko (market cap, supply, dominance), OKX and Kraken Futures (funding), alternative.me (Fear & Greed).</li>
<li><b>Logos</b>: Ticker's stored logo set.</li></ul>${m && m.errors && m.errors.length ? `<div class="unav">Last build notes: ${m.errors.map(esc).join('; ')}</div>` : ''}<p class="muted small">Build ${BUILD}</p>`;
  });
}
function setCur(c) { ST.cur = c; save(); updateStatus(); renderWatch(); renderCalls(); if ($('#tab-profile').classList.contains('on')) renderProfile(); toast('Prices now in ' + (c === 'GBP' ? 'pounds' : 'dollars') + '. New analyses use it.'); }

// ---------------------------------------------------------------- tabs
const TABS = ['floor', 'calls', 'watch', 'profile'];
function showTab(t) {
  if (sheetOpen) { hideSheet(); sheetPushed = false; }
  TABS.forEach(x => { $('#tab-' + x).classList.toggle('on', x === t); });
  TabBar.set(TABS.indexOf(t));
  if (t === 'floor') { scene.start(); requestAnimationFrame(() => applyLayout()); } else scene.stop();
  if (t === 'calls') { renderCalls(); scoreCalls(); }
  if (t === 'watch') { renderWatch(); pollWatch(); }
  if (t === 'profile') renderProfile();
  if (location.hash !== '#' + t) history.replaceState(null, '', '#' + t);
  window.scrollTo({ top: 0 });
}
function renderChips() {
  const base = ['PLTR', 'NVDA', 'BTC', 'TSLA', 'ETH', 'AAPL', 'VUSA.L', 'SOL'];
  const rec = ST.history.map(h => h.id); const list = [...new Set([...rec.slice(0, 3), ...base])].slice(0, 9);
  $('#chips').innerHTML = list.map(s => `<button class="chipb" data-s="${esc(s)}">${esc(s)}</button>`).join('');
  $$('#chips .chipb').forEach(b => b.onclick = async () => { await DATA.loadSearch(); const it = DATA.search.find(x => x.id === b.dataset.s && (['BTC', 'ETH', 'SOL'].includes(b.dataset.s) ? x.kind === 'crypto' : x.kind !== 'crypto')) || DATA.search.find(x => x.id === b.dataset.s); if (it) startAnalysis(it); });
}

// ---------------------------------------------------------------- suggested waiting cards (real figures only)
function rsiOf(done) { const ch = (done || []).find(s => s.id === 'chartist'); const g = ch && (ch.signals || []).find(x => /RSI/.test(x.name)); const n = g ? +g.reading : NaN; return isFinite(n) ? n : null; }
function sma50Of(done) { const ch = (done || []).find(s => s.id === 'chartist'); const f = ch && (ch.facts || []).find(x => x.k === '50-day'); return f && f.v && f.v !== 'n/a' ? f.v : null; }
function promptBase(ctx, v) {
  const price = ctx.crypto ? ctx.live : ctx.s && ctx.s.price;
  return { type: 'prompt', sym: ctx.item.id, kind: ctx.item.kind, name: ctx.name, ondemand: !!ctx.item.ondemand, price, cur: ctx.cur, score: v && v.score, stance: v && v.stance, aid: LAST && LAST.sym === ctx.item.id ? LAST.aid : undefined };
}
function promptCandidates(ctx, v, done) {
  if (!ctx || !ctx.item) return [];
  const b = promptBase(ctx, v), sym = b.sym, out = [];
  const px = b.price != null && isFinite(b.price) ? fmtMoney(b.price, b.cur) : null;
  const R = rsiOf(done), sma = sma50Of(done);
  if (R != null && R >= 70) out.push(Object.assign({}, b, { action: 'alert', by: 'chartist', key: 'p|alert|' + (b.aid || sym), title: sma ? `${sym}'s RSI is ${R}. Set a pullback alert at ${sma}?` : `${sym}'s RSI is ${R}, overbought. Add it to your watchlist?` }));
  else if (R != null && R <= 30) out.push(Object.assign({}, b, { action: 'alert', by: 'chartist', key: 'p|alert|' + (b.aid || sym), title: px ? `${sym}'s RSI is ${R}, oversold. Watch for a bounce from ${px}?` : `${sym}'s RSI is ${R}, oversold. Add it to your watchlist?` }));
  const aidk = b.aid || sym;
  if (v && px) {
    const d = v.score >= 52 ? 'bull' : v.score <= 48 ? 'bear' : null;
    if (d) out.push(Object.assign({}, b, { action: 'call', dir: d, by: d === 'bear' && unlocked('bear') ? 'bear' : 'boss', key: 'p|call|' + aidk, title: `Log a ${d === 'bull' ? 'bullish' : 'bearish'} call on ${sym} at ${px}?` }));
    else out.push(Object.assign({}, b, { action: 'call', dir: null, by: 'boss', key: 'p|call|' + aidk, title: `${sym} scored ${v.score}/100. Make a call at ${px}?` }));
  }
  if (!ST.watch.find(w => w.id === sym)) out.push(Object.assign({}, b, { action: 'watch', by: unlocked('quant') ? 'quant' : 'chartist', key: 'p|watch|' + aidk, title: `Add ${sym} to your watchlist?` }));
  const e = ctx.nextEarnings;
  if (e && unlocked('earnings') && W.daysTo(e.ts) >= 0 && W.daysTo(e.ts) <= 21) { const d = W.daysTo(e.ts); out.push(Object.assign({}, b, { action: 'remind', by: 'earnings', key: 'p|earn|' + (b.aid || (sym + '|' + e.ts)), title: d === 0 ? `Earnings today for ${sym}. Remind you after the report?` : `Earnings in ${d} day${d === 1 ? '' : 's'}. Remind you?` })); }
  return out;
}
function pushPrompts(list, n) {
  const have = new Set(ST.inbox.map(x => x.key));
  const fresh = list.filter(x => x && !have.has(x.key));
  for (let i = fresh.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [fresh[i], fresh[j]] = [fresh[j], fresh[i]]; }
  fresh.slice(0, n).forEach(it => addInbox(it));
}
function postAnalysisPrompts(ctx, v, done) { const list = promptCandidates(ctx, v, done); pushPrompts(list, Math.min(3, Math.max(1, list.length))); }
function idlePrompts() {
  if (RUN || document.hidden || ST.inbox.length >= 4) return;
  const opts = [];
  if (LAST && LAST.ctx) opts.push(...promptCandidates(LAST.ctx, LAST.v, LAST.done));
  for (const w of ST.watch) {
    const q = WQ[w.id]; if (!q || q.p == null || !isFinite(q.p) || q.chg == null || !isFinite(q.chg)) continue;
    const dir = q.chg >= 0 ? 'bull' : 'bear';
    opts.push({ type: 'prompt', action: 'call', dir, by: w.kind === 'crypto' ? 'crypto' : 'chartist', key: 'p|move|' + w.id + '|' + new Date().toDateString(), sym: w.id, kind: w.kind, name: w.name, ondemand: w.ondemand, price: q.p, cur: q.cur, title: `${w.id} is ${q.chg >= 0 ? 'up' : 'down'} ${W.pctAbs(q.chg)} today at ${fmtMoney(q.p, q.cur)}. Log a ${dir === 'bull' ? 'bullish' : 'bearish'} call?` });
  }
  if (opts.length) pushPrompts(opts, 1);
}

function applyLayout() {
  const land = isLand(); document.body.classList.toggle('land', land);
  askIn().placeholder = land ? 'Ask a ticker' : 'Ask a ticker or coin';
  requestAnimationFrame(() => scene.setInsets({ l: 0, r: 0, t: 0, b: 0 }));
  renderInbox();
}

// ---------------------------------------------------------------- idle life in the tower
let idleOn = true, tripN = 0; const trips = new Map();
const G = (x, z) => ({ gx: (x + 6) / 1.2, gy: (z + 4) / 2 });
const SOFA_TOP = [0.2, 0.9, 1.6].map(x => Object.assign({ f: 6, pose: 'sofa', via: [G(x, 2.98), G(2.3, 2.98)] }, G(x, 2.62)));
const SOFA_LOBBY = [-2.38, -1.68, -0.98].map(x => Object.assign({ f: 0, pose: 'sofa' }, G(x, 2.15)));
const SPOTS = () => {
  const s = [
    Object.assign({ f: 6, pose: 'stand', back: true, line: 'Nice view tonight.' }, G(4.75, -3.25)),
    Object.assign({ f: 6, pose: 'stand', back: true, line: 'screen' }, G(1.85, -1.8)),
    Object.assign({ f: 6, pose: 'type', line: 'Borrowing a hot desk.' }, G(-4.55, -2.42)),
    Object.assign({ f: 6, pose: 'type', line: null }, G(-2.75, -2.42))
  ];
  if (unlocked('lounge')) s.push(Object.assign({ f: 0, pose: 'stand', back: true, line: 'Coffee!' }, G(-4.75, 2.1)));
  if (unlocked('trading')) s.push(Object.assign({ f: 5, pose: 'stand', back: true, line: 'screen' }, G(2.2 + Math.random() * 2, 2.35)));
  return s;
};
const CHAT = [['Coffee run?', 'Always.'], ['Busy day?', 'Charts never sleep.'], ['Lift\'s quick today.', 'Express to the top.'], ['Ask me anything.', 'Real data only.'], ['What are we watching?', 'Whatever he asks.']];
function tickerLine() { const t = scene.ticker.filter(x => /[+-]\d/.test(x.t)); if (!t.length) return null; const x = pick(t); const up = /\+/.test(x.t); return [`${x.t} today.`, up ? pick(['Strong tape.', 'Holding up well.', 'Nice move.']) : pick(['Ouch.', 'Watching that one.', 'Soft today.'])]; }
function stopIdle() { idleOn = false; trips.clear(); }
function startIdle() { idleOn = true; }
async function idleTick() {
  if (!idleOn || RUN || document.hidden || (scene && scene.intro) || document.body.classList.contains('intro') || !$('#tab-floor').classList.contains('on') || trips.size >= 3) return;
  const ids = Object.keys(ANALYSTS).filter(id => id !== 'you' && unlocked(id) && scene.isHome(id) && !trips.has(id)); if (!ids.length) return;
  const id = pick(ids), n = ++tripN; trips.set(id, n);
  const alive = () => idleOn && !RUN && trips.get(id) === n;
  const busy = new Set([...scene.bots.values()].filter(b => b.at && b.at.pose === 'sofa').map(b => b.at.f + ':' + b.gx.toFixed(2)));
  const r = Math.random(); let dest, wait = 5000, line = null, partner = null;
  const sofas = [...SOFA_TOP, ...SOFA_LOBBY].filter(s => !busy.has(s.f + ':' + s.gx.toFixed(2)));
  if (r < 0.3 && sofas.length) { dest = pick(sofas); wait = 7000 + Math.random() * 6000; line = pick(['Break time.', 'Two minutes.', null]); }
  else if (r < 0.62) { const others = Object.keys(ANALYSTS).filter(o => o !== id && o !== 'you' && unlocked(o) && scene.isHome(o)); if (others.length) { partner = pick(others); const h = ANALYSTS[partner].home; dest = { f: h.f, gx: h.gx + 0.62, gy: h.gy + 0.18, pose: 'talk', face: { gx: h.gx, gy: h.gy } }; wait = 900; } }
  if (!dest) { const sp = pick(SPOTS()); dest = sp; line = sp.line === 'screen' ? (tickerLine() || ['Markets.'])[0] : sp.line; wait = 4500; }
  try {
    const ok = await scene.walk(id, dest, 1); if (!ok || !alive()) return;
    if (partner) {
      const pair = Math.random() < 0.55 ? (tickerLine() || pick(CHAT)) : pick(CHAT);
      scene.say(id, pair[0]); await sleep(1900); scene.quiet(id); if (!alive()) return;
      scene.say(partner, pair[1]); scene.hop(partner); await sleep(1900); scene.quiet(partner); if (!alive()) return;
    } else if (line) { scene.say(id, line); await sleep(2200); scene.quiet(id); }
    await sleep(wait); if (!alive()) return;
    await scene.goHome(id);
  } finally { if (trips.get(id) === n) trips.delete(id); }
}


function startCinematic() {
  const sp = window.BRSplash;
  const hash = (location.hash || '').slice(1);
  const skipAsk = new URLSearchParams(location.search).has('ask');
  const otherTab = TABS.includes(hash) && hash !== 'floor';
  const skip = !sp || sp.ended || sp.skipped || sp.reduce || skipAsk || otherTab;
  window.__brSkipIntro = () => { if (scene && scene.skipIntro) scene.skipIntro(); if (sp) sp.end(); };
  if (skip) { if (sp) sp.end(); return; }
  document.body.classList.add('intro');
  applyLayout();
  const kick = () => {
    if (!sp || sp.ended || sp.skipped) { document.body.classList.remove('intro'); applyLayout(); if (sp) sp.end(); return; }
    scene.resize();
    sp.play();
    scene.playIntro({
      onBrand() { sp.brand(); },
      onFloor(f) { if (sp.el) sp.el.dataset.floor = String(f); }
    }).then(() => { document.body.classList.remove('intro'); applyLayout(); sp.end(); });
  };
  requestAnimationFrame(() => requestAnimationFrame(kick));
}

// ---------------------------------------------------------------- boot
async function boot() {
  scene = new Tower($('#tower')); applyTheme(ST.theme || 'black', false);
  roster(); $('#stIco').append(avatar('boss', 22), avatar('chartist', 22), avatar('crypto', 22));
  TabBar.init($('.tabbar'), i => showTab(TABS[i]));
  applyLayout(); matchMedia('(orientation: landscape) and (max-height: 560px)').addEventListener('change', () => setTimeout(applyLayout, 60)); addEventListener('resize', () => { clearTimeout(boot._r); boot._r = setTimeout(applyLayout, 120); });
  scene.start();
  startCinematic();
  scene.onBotTap = id => { if (RUN) return; const a = ANALYSTS[id]; if (id === 'you') { toast('That\'s you. Bots come down here when something needs you.'); return; } scene.hop(id); scene.say(id, a.title); setTimeout(() => scene.quiet(id), 2200); toast(`<b>${esc(a.name)}</b> · ${esc(a.title)}`); };
  $('#ask').onsubmit = e => { e.preventDefault(); const v = askIn().value.trim(); if (!v) return; $('#ac').hidden = true; askIn().blur(); askIn().value = ''; startAnalysis(v); };
  askIn().addEventListener('input', onType); askIn().addEventListener('focus', onType);
  document.addEventListener('click', e => { if (!e.target.closest('#ask')) $('#ac').hidden = true; });
  $('#dialog').onclick = dlgTap; $('#skipBtn').onclick = e => { e.stopPropagation(); if (RUN) { RUN.skip = true; dlgResolve && dlgResolve(); } };
  $('#repClose').onclick = () => document.body.classList.remove('rep-open');
  wireSheet();
  renderProgress(); renderInbox(); renderChips(); setInterval(updateStatus, 700);
  const q = await DATA.loadQuotes();
  DATA.loadSearch().catch(() => { }); DATA.loadLogos();
  const cr = await DATA.loadCrypto();
  const tick = []; for (const id of ['SPY', 'QQQ', 'PLTR', 'NVDA', 'AAPL', 'TSLA', 'MSFT', 'AMZN', 'META', 'VUSA.L']) { const x = q.q[id]; if (x && x[1] != null) tick.push({ t: `${id} ${x[1] >= 0 ? '+' : ''}${x[1].toFixed(1)}%`, c: x[1] >= 0 ? '#4ade80' : '#f87171' }); }
  for (const c of (cr.coins || []).slice(0, 5)) tick.push({ t: `${c.symbol.toUpperCase()} ${c.price_change_percentage_24h >= 0 ? '+' : ''}${(c.price_change_percentage_24h || 0).toFixed(1)}%`, c: c.price_change_percentage_24h >= 0 ? '#4ade80' : '#f87171' });
  scene.setTicker(tick);
  const t = (location.hash || '').slice(1); if (TABS.includes(t) && t !== 'floor') showTab(t);
  const sp = new URLSearchParams(location.search); const ask = sp.get('ask'); if (ask) startAnalysis(ask);
  if (sp.has('noidle')) stopIdle();
  setInterval(idleTick, 3200);
  setInterval(idlePrompts, 180000);
  scoreCalls(); pollWatch(); setInterval(pollWatch, 60000); setInterval(scoreCalls, 3600000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (scene.intro) { scene.skipIntro(); if (window.BRSplash) window.BRSplash.end(); }
      scene.stop();
    } else if ($('#tab-floor').classList.contains('on')) scene.start();
  });
}
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then(r => { r.update(); });
  let reloaded = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded) return; reloaded = true; location.reload(); });
}
boot();
