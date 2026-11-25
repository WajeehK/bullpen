/* Bullpen app: game state, analysis flow, calls, watchlist, profile. */
'use strict';
const BUILD = 'b1';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- roster
const SKIN = ['#f2c7a5', '#e0a779', '#c68642', '#8d5524', '#f6d5bd'];
const L = (gy) => ({ seat: [0.62, gy], out: [2.3, gy], desk: { wall: 'L', box: [0.95, gy - 0.6, 1.65, gy + 0.6] } });
const R = (gx) => ({ seat: [gx, 0.62], out: [gx, 2.3], desk: { wall: 'R', box: [gx - 0.6, 0.95, gx + 0.6, 1.65] } });
const ANALYSTS = {
  chartist: { name: 'Chartist', short: 'Chartist', title: 'Trend, momentum & levels', color: '#38bdf8', mon: 'chart', lvl: 1, ...L(3.4), spot: [3.45, 5.2], look: { skin: SKIN[1], hair: '#2b1d14', hairStyle: 'spiky', shirt: '#0e7490', pants: '#1f2937', acc: ['hoodie', 'headphones', 'glasses'], accent: '#38bdf8' } },
  accountant: { name: 'Accountant', short: 'Accountant', title: 'Revenue, margins & valuation', color: '#22c55e', mon: 'bars', lvl: 1, ...L(5.2), spot: [3.96, 6.44], look: { skin: SKIN[0], hair: '#6b4f3a', hairStyle: 'side', shirt: '#e5e7eb', pants: '#374151', acc: ['vest', 'visor'], accent: '#475569', tie: '#16a34a' } },
  reporter: { name: 'Reporter', short: 'Reporter', title: 'Headlines & catalysts', color: '#f59e0b', mon: 'text', lvl: 1, ...L(7.0), spot: [5.2, 6.95], look: { skin: SKIN[3], hair: '#111111', hairStyle: 'bun', shirt: '#7c2d12', pants: '#3f3f46', acc: ['trench', 'press', 'pencil'], blush: true } },
  quant: { name: 'Quant', short: 'Quant', title: 'Volatility, drawdown & beta', color: '#e879f9', mon: 'quant', lvl: 2, ...L(8.8), spot: [6.07, 6.72], look: { skin: SKIN[4], hair: '#d6d3d1', hairStyle: 'spiky', shirt: '#6d28d9', pants: '#312e81', acc: ['labcoat', 'glasses'] } },
  insider: { name: 'Insider', short: 'Insider', title: 'Congress, CEO & fund trades', color: '#a3a3a3', mon: 'radar', lvl: 1, ...R(3.4), spot: [5.2, 3.45], look: { skin: SKIN[2], hair: '#0f0f0f', hairStyle: 'short', shirt: '#111827', pants: '#0b0f19', acc: ['suit', 'shades', 'tie'], tie: '#64748b' } },
  crypto: { name: 'Crypto Desk', short: 'Crypto', title: 'On-chain, supply & funding', color: '#f7931a', mon: 'candles', lvl: 1, ...R(5.2), spot: [6.44, 3.96], look: { skin: SKIN[0], hair: '#b45309', hairStyle: 'long', shirt: '#4c1d95', pants: '#1e1b4b', acc: ['hoodie', 'beanie', 'logo'], accent: '#f7931a' } },
  bear: { name: 'The Bear', short: 'Bear', title: 'The risk case', color: '#f43f5e', mon: 'down', lvl: 1, ...R(7.0), spot: [6.95, 5.2], look: { skin: SKIN[1], hair: '#7a5134', hairStyle: 'short', shirt: '#7a5134', pants: '#44403c', acc: ['bearhood'], beard: true } },
  macro: { name: 'Macro', short: 'Macro', title: 'Market backdrop & FX', color: '#60a5fa', mon: 'chart', lvl: 3, ...R(8.8), spot: [6.72, 6.07], look: { skin: SKIN[2], hair: '#9ca3af', hairStyle: 'side', shirt: '#1e3a8a', pants: '#1f2937', acc: ['suit', 'tie', 'clipboard'], tie: '#60a5fa', mustache: true } },
  boss: { name: 'The Boss', short: 'Boss', title: 'Verdict', color: '#fbbf24', mon: null, lvl: 1, seat: [0.75, 0.75], out: [2.75, 2.75], desk: null, spot: [3.85, 3.85], look: { skin: SKIN[0], hair: '#9ca3af', hairStyle: 'bald', shirt: '#1e293b', pants: '#0f172a', acc: ['suit', 'tie'], tie: '#fbbf24', mustache: true } },
  you: { name: 'You', short: 'You', title: '', color: '#34d399', mon: null, lvl: 1, seat: [8.75, 8.75], out: [8.75, 8.75], desk: null, backView: true, look: { skin: SKIN[1], hair: '#1a1a1a', hairStyle: 'short', shirt: '#0f766e', pants: '#1f2937', acc: ['hoodie', 'cap'], accent: '#111827' } }
};
const ORDER_STOCK = ['chartist', 'accountant', 'reporter', 'insider', 'quant', 'macro', 'bear'];
const ORDER_COIN = ['chartist', 'crypto', 'reporter', 'insider', 'quant', 'macro', 'bear'];
const UNLOCKS = [
  { lvl: 2, kind: 'analyst', id: 'quant', label: 'The Quant joins (volatility, drawdown, beta)' }, { lvl: 2, kind: 'decor', id: 'cooler', label: 'Water cooler' },
  { lvl: 3, kind: 'analyst', id: 'macro', label: 'Macro desk joins (market backdrop, FX)' }, { lvl: 3, kind: 'decor', id: 'coffee', label: 'Espresso machine' },
  { lvl: 4, kind: 'decor', id: 'rug', label: 'Gold-trim rug' }, { lvl: 4, kind: 'decor', id: 'neon', label: 'Neon BULLPEN sign' },
  { lvl: 5, kind: 'decor', id: 'arcade', label: 'Arcade cabinet' }, { lvl: 5, kind: 'decor', id: 'plants', label: 'More plants' },
  { lvl: 6, kind: 'decor', id: 'aquarium', label: 'Aquarium' }, { lvl: 7, kind: 'decor', id: 'bull', label: 'Golden bull statue' },
  { lvl: 8, kind: 'decor', id: 'server', label: 'Server rack' }, { lvl: 8, kind: 'decor', id: 'lamp', label: 'Lava lamp' },
  { lvl: 9, kind: 'decor', id: 'cat', label: 'Office cat' }, { lvl: 10, kind: 'decor', id: 'trophy', label: 'Trophy cabinet' }
];
const lvlXP = L => 50 * L * (L - 1); // total XP to reach level L
const levelOf = xp => { let L = 1; while (xp >= lvlXP(L + 1)) L++; return L; };

// ---------------------------------------------------------------- state
const KEY = 'bullpen.v1';
const ST = Object.assign({ xp: 0, analyses: 0, seen: {}, calls: [], watch: [], cur: 'GBP', sound: false, decorOff: {}, history: [], lastDay: '', alerted: {} }, JSON.parse(localStorage.getItem(KEY) || '{}'));
const save = () => localStorage.setItem(KEY, JSON.stringify(ST));
const level = () => levelOf(ST.xp);
const unlocked = id => (ANALYSTS[id].lvl || 1) <= level();

// ---------------------------------------------------------------- money
function conv(v, from) { const fx = DATA.fx(); if (v == null || !isFinite(v)) return null; if (!fx || from === ST.cur) return { v, c: from }; if (from === 'USD' && ST.cur === 'GBP') return { v: v / fx, c: 'GBP' }; if (from === 'GBP' && ST.cur === 'USD') return { v: v * fx, c: 'USD' }; return { v, c: from }; }
function fmtMoney(v, from, big) {
  const r = conv(v, from); if (!r) return 'n/a'; const sym = r.c === 'GBP' ? '£' : r.c === 'USD' ? '$' : r.c + ' ';
  if (big) return (r.v < 0 ? '-' : '') + sym + W.big(Math.abs(r.v));
  const a = Math.abs(r.v); const d = a >= 1000 ? 0 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  return (r.v < 0 ? '-' : '') + sym + a.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ---------------------------------------------------------------- sound (off by default)
const SFX = { ctx: null, play(kind) { if (!ST.sound) return; try { this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)(); const c = this.ctx, t = c.currentTime; const seq = { tick: [[1400, .015]], blip: [[660, .05], [990, .06]], step: [[180, .03]], win: [[523, .09], [659, .09], [784, .09], [1047, .18]], lvl: [[392, .08], [523, .08], [659, .08], [784, .08], [1047, .25]], alert: [[880, .08], [660, .08], [880, .12]] }[kind] || [[440, .05]]; let o = 0; for (const [f, d] of seq) { const os = c.createOscillator(), g = c.createGain(); os.type = 'square'; os.frequency.value = f; g.gain.setValueAtTime(0.05, t + o); g.gain.exponentialRampToValueAtTime(0.0001, t + o + d); os.connect(g).connect(c.destination); os.start(t + o); os.stop(t + o + d + 0.02); o += d; } } catch (e) { } } };

// ---------------------------------------------------------------- scene
let scene;
function roster() {
  const list = [];
  for (const [id, a] of Object.entries(ANALYSTS)) list.push({ id, look: a.look, seat: a.seat, out: a.out, desk: a.desk, locked: !unlocked(id), color: a.color, short: a.short, mon: a.mon, backView: a.backView });
  scene.setRoster(list);
  const dec = UNLOCKS.filter(u => u.kind === 'decor' && u.lvl <= level() && !ST.decorOff[u.id]).map(u => u.id);
  scene.setDecor(dec);
}
function portrait(id, size = 48) {
  const a = ANALYSTS[id]; const spr = PX.sprite(id, a.look, { view: 'front', state: 'stand', frame: 0 });
  const cv = PX.canvas(16, 15); const c = cv.getContext('2d'); c.drawImage(spr, 0, 0, 16, 15, 0, 0, 16, 15);
  const out = document.createElement('canvas'); out.width = 16 * 6; out.height = 15 * 6; out.className = 'portrait'; out.style.width = size + 'px'; out.style.height = Math.round(size * 15 / 16) + 'px';
  const o = out.getContext('2d'); o.imageSmoothingEnabled = false; o.drawImage(cv, 0, 0, out.width, out.height);
  return out;
}

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

// ---------------------------------------------------------------- analysis flow
let RUN = null;
function toast(html, ms = 3500) { const t = $('#toast'); t.innerHTML = html; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms); }
function setBusy(b) { document.body.classList.toggle('busy', b); $('#askBtn').disabled = b; }

async function startAnalysis(item) {
  if (RUN) return;
  if (typeof item === 'string') { setBusy(true); const r = await resolve(item); setBusy(false); if (!r) { toast('I couldn\'t find that ticker or coin. Try the symbol, like PLTR or BTC.'); return; } item = r; }
  showTab('floor');
  RUN = { item, skip: false, step: null };
  setBusy(true);
  const crypto = item.kind === 'crypto';
  const sym = item.id; const order = (crypto ? ORDER_COIN : ORDER_STOCK).filter(unlocked);
  const rep = $('#report'); rep.innerHTML = '';
  $('#stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
  dialog('boss', `Team, to the table. We're looking at ${item.name} (${sym}).`, { auto: 1600 });
  scene.say('boss', 'TABLE! ' + sym.slice(0, 7));
  SFX.play('blip');
  for (const c of scene.chars.values()) c.fast = 1.25;
  // fetch everything in parallel while they walk
  const ctxP = buildContext(item);
  const walk = scene.gather(order, order.map(id => { const sp = ANALYSTS[id].spot; return [sp[0], sp[1], (5.2 - sp[0]) - (5.2 - sp[1]) < 0 ? -1 : 1]; }));
  let ctx;
  try { [ctx] = await Promise.all([ctxP, walk]); }
  catch (e) { console.error(e); dialog('boss', `I couldn't load real data for ${sym} right now (${esc(e.message || e)}). Nothing to analyse, so no guessing.`, { auto: 0 }); scene.quiet('boss'); await scene.dismiss(order); setBusy(false); RUN = null; return; }
  scene.quiet('boss');
  const closes = ctx.bars.map(b => b[4]).slice(-120);
  scene.holo = { series: closes, up: closes[closes.length - 1] >= closes[0], label: sym.replace('.L', '').slice(0, 6) };
  renderHeader(ctx);
  const done = [];
  for (const id of order) {
    if (id === 'bear') continue;
    let sec; try { sec = AN[id](ctx); } catch (e) { console.error(id, e); sec = { id, lines: [`My numbers didn't compute for this one (${e.message}).`], signals: [], headline: 'ERROR' }; }
    sec.by = id; done.push(sec);
  }
  const bearSec = unlocked('bear') ? AN.bear(ctx, done) : null; if (bearSec) { bearSec.by = 'bear'; done.push(bearSec); }
  // present
  for (const sec of done) {
    if (RUN.skip) { renderCard(sec, ctx); continue; }
    scene.say(sec.by, sec.headline || '...'); SFX.play('blip');
    renderCard(sec, ctx, true);
    const pages = sec.lines.filter(x => !x.startsWith('•')).slice(0, 2);
    for (const p of pages) { if (RUN.skip) break; await dialog(sec.by, p, { auto: Math.min(6500, 1400 + p.length * 32) }); }
    scene.quiet(sec.by);
  }
  // boss verdict
  const v = AN.verdict(ctx, done);
  await scene.goTo('boss', [ANALYSTS.boss.out, ANALYSTS.boss.spot]);
  scene.say('boss', v.score + '/100');
  await dialog('boss', v.lines[0], { auto: RUN.skip ? 900 : 2600 });
  scene.quiet('boss');
  scene.burst(5.2, 5.2, 60); scene.cheer(order); SFX.play('win');
  const xp = awardXP(item, v);
  renderVerdictCard(ctx, v, done, xp);
  ST.history.unshift({ id: item.id, name: item.name, kind: item.kind, score: v.score, stance: v.stance, at: Date.now() }); ST.history = ST.history.slice(0, 30); save();
  openVerdict(ctx, v, xp);
  hideDialog();
  RUN.done = { ctx, v };
  setTimeout(async () => { scene.holo = null; await Promise.all([scene.dismiss(order), scene.dismiss(['boss'])]); for (const c of scene.chars.values()) c.fast = 1; }, 2600);
  setBusy(false); RUN = null; renderChips();
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

// ---------------------------------------------------------------- dialogue box
let dlgResolve = null, dlgTimer = null, typeTimer = null;
function dialog(id, text, o = {}) {
  const a = ANALYSTS[id]; const d = $('#dialog'); d.hidden = false; d.style.setProperty('--c', a.color);
  const pf = $('.dlg-face', d); pf.innerHTML = ''; pf.append(portrait(id, 44));
  $('.dlg-name', d).textContent = a.name; $('.dlg-name', d).style.background = a.color;
  const body = $('.dlg-text', d); body.textContent = '';
  clearInterval(typeTimer); clearTimeout(dlgTimer);
  let i = 0; const full = text; d.classList.remove('done');
  return new Promise(res => {
    dlgResolve = () => { clearInterval(typeTimer); clearTimeout(dlgTimer); body.textContent = full; dlgResolve = null; res(); };
    typeTimer = setInterval(() => { i += 2; body.textContent = full.slice(0, i); if (i % 6 === 0) SFX.play('tick'); if (i >= full.length) { clearInterval(typeTimer); d.classList.add('done'); if (o.auto) { const bar = $('.dlg-bar', d); bar.style.transition = 'none'; bar.style.width = '0%'; requestAnimationFrame(() => { bar.style.transition = `width ${o.auto}ms linear`; bar.style.width = '100%'; }); dlgTimer = setTimeout(() => dlgResolve && dlgResolve(), o.auto); } } }, 18);
  });
}
function hideDialog() { $('#dialog').hidden = true; }
function dlgTap() { const d = $('#dialog'); const body = $('.dlg-text', d); if (!d.classList.contains('done')) { clearInterval(typeTimer); d.classList.add('done'); body.textContent = body.textContent; if (dlgResolve) dlgResolve(); } else if (dlgResolve) dlgResolve(); }

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
function renderCard(sec, ctx, animate) {
  const a = ANALYSTS[sec.by]; const card = document.createElement('section'); card.className = 'card sec' + (animate ? ' pop' : ''); card.style.setProperty('--c', a.color);
  const head = document.createElement('div'); head.className = 'sec-h'; head.append(portrait(sec.by, 34));
  head.insertAdjacentHTML('beforeend', `<div class="sec-t"><b>${esc(a.name)}</b><span>${esc(a.title)}</span></div><span class="chip">${esc(sec.headline || '')}</span>`);
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
    body.insertAdjacentHTML('beforeend', '<div class="news">' + sec.items.slice(0, 8).map(n => `<a class="nw" href="${esc(n.u)}" target="_blank" rel="noopener">${n.img ? `<img decoding="async" referrerpolicy="no-referrer" src="${esc(n.img)}" alt="" onerror="this.remove()">` : '<div class="noimg">📰</div>'}<div><b>${esc(n.t)}</b><span>${esc(n.s || '')}${n.ts ? ' · ' + W.ago(n.ts * 1000) : ''}${n.tone ? ` · <i class="${n.tone > 0 ? 'up' : 'dn'}">${n.tone > 0 ? 'positive' : 'negative'}</i>` : ''}</span></div></a>`).join('') + '</div>');
  }
  if (sec.catalysts && sec.catalysts.length) body.insertAdjacentHTML('beforeend', '<div class="cats">' + sec.catalysts.map(c => `<div class="cat"><b>${esc(W.dshort(c.ts))}</b><span>${esc(c.label)}</span><em>${W.daysTo(c.ts)} days</em></div>`).join('') + '</div>');
  if (sec.rows) {
    body.insertAdjacentHTML('beforeend', `<div class="tbl-t">Latest filings (The Insider House)</div><div class="tblw"><table class="tbl ins"><tr><th>Who</th><th></th><th>Amount</th><th>Traded</th></tr>${sec.rows.slice(0, 8).map(r => `<tr><td>${esc(r.politician)}<small>${esc(r.chamber)}${r.party ? ' · ' + esc(r.party) : ''}</small></td><td class="${r.side === 'buy' ? 'up' : 'dn'}">${r.side === 'buy' ? 'Buy' : r.side === 'sell' ? 'Sell' : esc(r.tx_type || '')}</td><td>${esc(r.amount || '')}</td><td>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.tx_date)}</a>` : esc(r.tx_date)}</td></tr>`).join('')}</table></div><a class="more" href="${IH}#t=${encodeURIComponent(ctx.sym)}" target="_blank" rel="noopener">Open ${esc(ctx.sym)} in The Insider House ↗</a>`);
  }
  if (sec.holders && sec.holders.length && !sec.rows) body.insertAdjacentHTML('beforeend', `<a class="more" href="${IH}#t=${encodeURIComponent(ctx.sym)}" target="_blank" rel="noopener">Open ${esc(ctx.sym)} in The Insider House ↗</a>`);
  body.insertAdjacentHTML('beforeend', factsHTML(sec.facts));
  if (sec.signals && sec.signals.length) body.insertAdjacentHTML('beforeend', '<div class="sigs">' + sec.signals.map(g => `<span class="sg ${g.s > 0.15 ? 'up' : g.s < -0.15 ? 'dn' : ''}">${esc(g.name)}: ${esc(g.reading)}</span>`).join('') + '</div>');
  const un = (sec.unavailable || []).filter(Boolean); if (un.length) body.insertAdjacentHTML('beforeend', '<div class="unav">' + un.map(u => `<div>⚠ Unavailable: ${esc(u)}</div>`).join('') + '</div>');
  if (sec.src) body.insertAdjacentHTML('beforeend', `<a class="more" href="${esc(sec.src)}" target="_blank" rel="noopener">SEC filings ↗</a>`);
  $('#report').append(card);
}
function verdictInner(ctx, v, xp, compact) {
  const gauge = `<div class="gauge"><div class="g-bar"><i style="left:${v.score}%"></i></div><div class="g-lab"><span>Bearish</span><span>Neutral</span><span>Bullish</span></div></div>`;
  const sigRows = v.sigs.map(g => `<tr><td>${esc(g.name)}<small>${esc(ANALYSTS[g.by].short)}</small></td><td>${esc(g.reading)}</td><td class="${g.s > 0 ? 'up' : g.s < 0 ? 'dn' : ''}">${g.s > 0 ? '+' : ''}${g.s.toFixed(2)}</td><td>×${g.w}</td></tr>`).join('');
  return `<div class="v-top"><div class="v-score" style="--s:${v.score}"><b>${v.score}</b><span>/100</span></div><div><div class="v-stance">${esc(v.stance)}</div><div class="v-conf">Confidence ${v.conf}% · ${v.sigs.length} signals</div><div class="nfa">Not financial advice</div></div></div>${gauge}
  <div class="v-cols"><div class="v-col bull"><h4>🐂 Bull case</h4>${v.bull.length ? '<ul>' + v.bull.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '<p class="muted">No strong bullish points in the data.</p>'}</div><div class="v-col bear"><h4>🐻 Bear case</h4>${v.bear.length ? '<ul>' + v.bear.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '<p class="muted">No strong bearish points in the data.</p>'}</div></div>
  <h4 class="v-h">Dated catalysts</h4>${v.cats.length ? '<div class="cats">' + v.cats.map(c => `<div class="cat"><b>${esc(W.dshort(c.ts))}</b><span>${esc(c.label)}</span><em>${W.daysTo(c.ts)} days</em></div>`).join('') + '</div>' : '<p class="muted">None in the feeds. I won\'t make one up.</p>'}
  <details class="v-how"${compact ? '' : ''}><summary>How the score is computed</summary><p>Each analyst turns a real reading into a signal from −1 (bearish) to +1 (bullish) with a weight. Score = 50 + 50 × (Σ weight × signal ÷ Σ weight) = <b>${v.score}</b>. Confidence = (0.55 × |net signal| + 0.45 × share of weight agreeing with the net direction) × data coverage (${Math.round(v.coverage * 100)}%) = <b>${v.conf}%</b>.</p><div class="tblw"><table class="tbl"><tr><th>Signal</th><th>Reading</th><th>Score</th><th>Weight</th></tr>${sigRows}</table></div></details>
  ${xp ? `<div class="v-xp">+${xp.gain} XP${xp.notes.length ? ' · ' + esc(xp.notes.join(' · ')) : ''}</div>` : ''}`;
}
function renderVerdictCard(ctx, v, done, xp) {
  const card = document.createElement('section'); card.className = 'card verdict-card pop'; card.style.setProperty('--c', '#fbbf24');
  const head = document.createElement('div'); head.className = 'sec-h'; head.append(portrait('boss', 34)); head.insertAdjacentHTML('beforeend', `<div class="sec-t"><b>The Boss</b><span>Verdict on ${esc(ctx.sym)}</span></div><span class="chip">${v.score}/100</span>`);
  card.append(head); const b = document.createElement('div'); b.className = 'sec-b'; b.innerHTML = verdictInner(ctx, v, null) + callButtons(ctx); card.append(b); $('#report').append(card); wireCallButtons(card, ctx);
}
function callButtons(ctx) { return `<div class="callrow"><button class="btn bull" data-dir="bull">🐂 Call it bull</button><button class="btn bear" data-dir="bear">🐻 Call it bear</button></div><button class="btn ghost wbtn" data-watch>☆ Add ${esc(ctx.sym)} to watchlist</button>`; }
function wireCallButtons(root, ctx) {
  $$('[data-dir]', root).forEach(b => b.onclick = () => { makeCall(ctx, b.dataset.dir); closeVerdict(); });
  $$('[data-watch]', root).forEach(b => b.onclick = () => { addWatch({ id: ctx.item.id, kind: ctx.item.kind, name: ctx.name, ondemand: !!ctx.item.ondemand }); b.textContent = '★ On your watchlist'; });
}
function openVerdict(ctx, v, xp) {
  const m = $('#verdict'); $('.vm-body', m).innerHTML = `<div class="vm-head"></div>` + verdictInner(ctx, v, xp) + callButtons(ctx);
  const hd = $('.vm-head', m); hd.append(portrait('boss', 52)); hd.insertAdjacentHTML('beforeend', `<div><div class="vm-k">Verdict</div><div class="vm-t">${esc(ctx.name)} <span>${esc(ctx.sym)}</span></div></div>`);
  wireCallButtons(m, ctx); m.hidden = false; requestAnimationFrame(() => m.classList.add('on'));
}
function closeVerdict() { const m = $('#verdict'); m.classList.remove('on'); setTimeout(() => m.hidden = true, 250); }

// ---------------------------------------------------------------- XP
function awardXP(item, v) {
  const before = level(); let gain = 40; const notes = [];
  if (!ST.seen[item.id]) { gain += 20; notes.push('new ticker +20'); ST.seen[item.id] = 1; }
  const day = new Date().toDateString(); if (ST.lastDay !== day) { gain += 30; notes.push('first today +30'); ST.lastDay = day; }
  ST.xp += gain; ST.analyses++; save();
  scene.float(5.2, 5.2, '+' + gain + ' XP', '#fde047');
  const after = level(); if (after > before) levelUp(after);
  renderHUD(); return { gain, notes };
}
function addXP(n, why) { const b = level(); ST.xp += n; save(); renderHUD(); if (level() > b) levelUp(level()); }
function levelUp(L) {
  const un = UNLOCKS.filter(u => u.lvl === L);
  setTimeout(() => { toast(`<b>Level ${L}!</b>${un.length ? ' Unlocked: ' + un.map(u => esc(u.label)).join(', ') : ''}`, 5000); SFX.play('lvl'); roster(); scene.burst(8.75, 8.75, 40); }, 1200);
}
function renderHUD() {
  const L = level(), lo = lvlXP(L), hi = lvlXP(L + 1); $('#lvl').textContent = 'Lv ' + L; $('#xpbar i').style.width = Math.round((ST.xp - lo) / (hi - lo) * 100) + '%';
  $('#xptxt').textContent = `${ST.xp - lo}/${hi - lo} XP`;
  $$('.cur-t button').forEach(b => b.classList.toggle('on', b.dataset.c === ST.cur));
}

// ---------------------------------------------------------------- calls
function makeCall(ctx, dir) {
  const price = ctx.crypto ? ctx.live : ctx.s.price;
  ST.calls.unshift({ id: ctx.item.id, kind: ctx.item.kind, name: ctx.name, dir, price, cur: ctx.cur, at: Date.now(), score: RUN && RUN.done ? RUN.done.v.score : null, ondemand: !!ctx.item.ondemand });
  save(); addXP(15); toast(`${dir === 'bull' ? '🐂' : '🐻'} Call logged: ${esc(ctx.item.id)} at ${esc(fmtMoney(price, ctx.cur))}. Scored at 7 and 30 days against real closes.`); SFX.play('blip'); renderCalls();
}
async function histFor(c) { if (c.kind === 'crypto') { const x = await DATA.coin(c.id); return x.bars; } const s = c.ondemand ? await DATA.stockOnDemand(c.id) : await DATA.stock(c.id); return s.d; }
async function scoreCalls() {
  let changed = false;
  for (const c of ST.calls) {
    for (const h of [7, 30]) {
      const k = 's' + h; if (c[k]) continue; const due = c.at + h * 86400000; if (Date.now() < due) continue;
      try {
        const bars = await histFor(c); const day = Math.floor(due / 86400000); const b = bars.find(x => x[0] >= day); if (!b) continue;
        const ret = b[4] / c.price - 1, dret = c.dir === 'bull' ? ret : -ret;
        c[k] = { price: b[4], day: b[0], ret, dret, ok: dret > 0 }; changed = true; addXP(c[k].ok ? (h === 7 ? 60 : 120) : 10);
        toast(`${c[k].ok ? '✅' : '❌'} Your ${h}-day ${c.dir} call on ${esc(c.id)}: ${W.pct(ret)}`);
      } catch (e) { }
    }
  }
  if (changed) { save(); renderCalls(); }
}
async function renderCalls() {
  const host = $('#calls'); if (!host) return;
  const sc7 = ST.calls.filter(c => c.s7), sc30 = ST.calls.filter(c => c.s30);
  const acc = a => a.length ? Math.round(a.filter(c => c.ok).length / a.length * 100) + '%' : '–';
  const best = ST.calls.map(c => ({ c, r: c.s30 ? c.s30.dret : c.s7 ? c.s7.dret : null, h: c.s30 ? 30 : 7 })).filter(x => x.r != null).sort((a, b) => b.r - a.r).slice(0, 10);
  await DATA.loadQuotes();
  const live = c => { if (c.kind === 'crypto') return null; const q = DATA.quotes.q[c.id]; return q ? q[0] : null; };
  const open = ST.calls.filter(c => !c.s30);
  host.innerHTML = `<div class="stats3"><div><b>${acc(sc7.map(c => c.s7))}</b><span>7-day accuracy<br>${sc7.length} scored</span></div><div><b>${acc(sc30.map(c => c.s30))}</b><span>30-day accuracy<br>${sc30.length} scored</span></div><div><b>${ST.calls.length}</b><span>calls made</span></div></div>
  <h3 class="h3">Best calls</h3>${best.length ? '<div class="lb">' + best.map((x, i) => `<div class="lbr"><span class="rk">${i + 1}</span><b>${esc(x.c.id)}</b><span class="dir ${x.c.dir}">${x.c.dir === 'bull' ? '🐂 bull' : '🐻 bear'}</span><span class="muted">${x.h}d · ${W.dshort(x.c.at)}</span><b class="${x.r >= 0 ? 'up' : 'dn'}">${W.pct(x.r)}</b></div>`).join('') + '</div>' : '<p class="muted pad">Your leaderboard fills up once calls hit 7 days. Make a call from any verdict card.</p>'}
  <h3 class="h3">Open calls</h3>${open.length ? open.map(c => { const lp = live(c); const r = lp ? lp / c.price - 1 : null; const d7 = Math.max(0, Math.ceil((c.at + 7 * 864e5 - Date.now()) / 864e5)), d30 = Math.max(0, Math.ceil((c.at + 30 * 864e5 - Date.now()) / 864e5)); return `<div class="callc"><div><b>${esc(c.id)}</b> <span class="dir ${c.dir}">${c.dir === 'bull' ? '🐂 bull' : '🐻 bear'}</span><div class="muted">at ${esc(fmtMoney(c.price, c.cur))} · ${W.dshort(c.at)}${c.score != null ? ' · board ' + c.score : ''}</div></div><div class="cc-r">${r != null ? `<b class="${(c.dir === 'bull' ? r : -r) >= 0 ? 'up' : 'dn'}">${W.pct(r)}</b>` : ''}<div class="muted">${c.s7 ? `7d ${c.s7.ok ? '✅' : '❌'} ${W.pct(c.s7.ret)}` : `7d in ${d7}d`} · 30d in ${d30}d</div></div></div>`; }).join('') : '<p class="muted pad">No open calls.</p>'}
  ${ST.calls.filter(c => c.s30).length ? '<h3 class="h3">Settled</h3>' + ST.calls.filter(c => c.s30).map(c => `<div class="callc"><div><b>${esc(c.id)}</b> <span class="dir ${c.dir}">${c.dir}</span><div class="muted">${W.dshort(c.at)} at ${esc(fmtMoney(c.price, c.cur))}</div></div><div class="cc-r">7d ${c.s7 && c.s7.ok ? '✅' : '❌'} · 30d ${c.s30.ok ? '✅' : '❌'} <b class="${c.s30.dret >= 0 ? 'up' : 'dn'}">${W.pct(c.s30.ret)}</b></div></div>`).join('') : ''}`;
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
  const id = w.kind === 'crypto' ? 'crypto' : 'chartist'; const c = scene.chars.get(id); if (!c || RUN) return;
  const txt = `${w.id} ${W.pct(q.chg, 1)}`;
  SFX.play('alert'); if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
  toast(`<span class="tapper"></span><b>${esc(ANALYSTS[id].name)}:</b> psst, ${esc(w.id)} is ${q.chg > 0 ? 'up' : 'down'} ${W.pctAbs(q.chg)} today (${esc(fmtMoney(q.p, q.cur))}). <button class="btn tiny" id="tapgo">Analyse</button>`, 9000);
  const b = $('#tapgo'); if (b) b.onclick = () => startAnalysis(w.kind === 'crypto' ? { id: w.id, name: w.name, kind: 'crypto' } : { id: w.id, name: w.name, kind: w.kind, ondemand: w.ondemand });
  const tp = $('.tapper'); if (tp) tp.append(portrait(id, 26));
  c.alert = true; await scene.goTo(id, [c.out, [9.35, 8.3]]); c.flip = true; c.state = 'tap'; scene.say(id, txt.slice(0, 14));
  await sleep(3200); scene.quiet(id); c.alert = false; await scene.goTo(id, [c.out, c.seat]); c.state = 'type';
}
function renderWatch() {
  const host = $('#watch'); if (!host) return;
  if (!ST.watch.length) { host.innerHTML = '<p class="muted pad">Nothing on your watchlist yet. Add from a verdict card or search above. While the app is open, an analyst will walk over and tap you when a holding moves more than 5% in a day.</p>'; return; }
  host.innerHTML = ST.watch.map((w, i) => { const q = WQ[w.id]; const lg = DATA.logo(w.id, w.kind === 'crypto'); return `<div class="wrow"><div class="wl">${lg ? `<img class="logo sm ${lg.chip ? 'chip' : ''}" src="${esc(lg.src)}" alt="">` : `<div class="logo sm mono">${esc(w.id.slice(0, 2))}</div>`}<div><b>${esc(w.id)}</b><span>${esc(w.name || '')}</span></div></div><div class="wr"><b>${q ? esc(fmtMoney(q.p, q.cur)) : '…'}</b><span class="${q && q.chg >= 0 ? 'up' : 'dn'}">${q && q.chg != null ? W.pct(q.chg, 2) : ''}${q && Math.abs(q.chg) >= 0.05 ? ' ⚡' : ''}</span></div><div class="wb"><button class="btn tiny" data-a="${i}">Analyse</button><button class="btn tiny ghost" data-r="${i}">✕</button></div></div>`; }).join('') + `<p class="muted small">Stocks: Yahoo via the Actions build (delayed, refreshed about every 30 min). Coins: Kraken live, change vs today's UTC open.</p>`;
  $$('[data-a]', host).forEach(b => b.onclick = () => { const w = ST.watch[+b.dataset.a]; startAnalysis({ id: w.id, name: w.name, kind: w.kind, ondemand: w.ondemand }); });
  $$('[data-r]', host).forEach(b => b.onclick = () => { ST.watch.splice(+b.dataset.r, 1); save(); renderWatch(); });
}

// ---------------------------------------------------------------- profile
function renderProfile() {
  const host = $('#profile'); const L = level();
  const sc = ST.calls.filter(c => c.s30 || c.s7); const ok = sc.filter(c => (c.s30 || c.s7).ok).length;
  host.innerHTML = `<div class="prof-top"><div id="youface"></div><div><div class="p-l">Level ${L}</div><div class="muted">${ST.xp} XP total · ${lvlXP(L + 1) - ST.xp} XP to level ${L + 1}</div></div></div>
  <div class="stats3"><div><b>${ST.analyses}</b><span>analyses</span></div><div><b>${Object.keys(ST.seen).length}</b><span>tickers</span></div><div><b>${sc.length ? Math.round(ok / sc.length * 100) + '%' : '–'}</b><span>call accuracy</span></div></div>
  <h3 class="h3">Unlocks</h3><div class="unl">${UNLOCKS.map(u => { const has = u.lvl <= L; return `<label class="u ${has ? 'has' : ''}"><span class="ul">Lv ${u.lvl}</span><span class="un">${esc(u.label)}</span>${u.kind === 'decor' && has ? `<input type="checkbox" data-d="${u.id}" ${ST.decorOff[u.id] ? '' : 'checked'}>` : `<span class="ui">${has ? '✓' : '🔒'}</span>`}</label>`; }).join('')}</div>
  <h3 class="h3">Settings</h3><div class="set"><label>Prices in <span class="seg cur-t"><button data-c="GBP">£ GBP</button><button data-c="USD">$ USD</button></span></label><label>Sound effects <input type="checkbox" id="sndT" ${ST.sound ? 'checked' : ''}></label></div>
  <h3 class="h3">Recent analyses</h3>${ST.history.length ? ST.history.slice(0, 8).map(h => `<button class="hist" data-h="${esc(h.id)}" data-k="${h.kind}"><b>${esc(h.id)}</b><span>${esc(h.stance)}</span><em>${h.score}/100</em><small>${W.ago(h.at)}</small></button>`).join('') : '<p class="muted pad">None yet.</p>'}
  <h3 class="h3">Where the data comes from</h3><div class="srcs" id="srcs"></div>
  <p class="nfa big">Not financial advice. Everything here is computed from public data by fixed rules; nothing is made up, and missing data is marked as unavailable.</p>
  <button class="btn ghost danger" id="reset">Reset progress</button>`;
  $('#youface').append(portrait('you', 56));
  $$('[data-d]', host).forEach(i => i.onchange = () => { ST.decorOff[i.dataset.d] = !i.checked; save(); roster(); });
  $('#sndT').onchange = e => { ST.sound = e.target.checked; save(); SFX.play('blip'); };
  $$('.cur-t button', host).forEach(b => b.onclick = () => setCur(b.dataset.c));
  $$('[data-h]', host).forEach(b => b.onclick = () => { const it = (DATA.search || []).find(x => x.id === b.dataset.h && x.kind === b.dataset.k) || { id: b.dataset.h, name: b.dataset.h, kind: b.dataset.k }; startAnalysis(it); });
  $('#reset').onclick = () => { if (confirm('Reset XP, calls and watchlist on this device?')) { localStorage.removeItem(KEY); location.reload(); } };
  renderHUD();
  DATA.meta().then(m => {
    const age = m ? W.ago(m.built * 1000) : 'unknown';
    $('#srcs').innerHTML = `<ul>
<li><b>Stock & ETF prices</b>: Yahoo Finance daily bars, built by GitHub Actions (data ${esc(age)}). Delayed.</li>
<li><b>Company financials</b>: SEC EDGAR XBRL company facts (US listings).</li>
<li><b>Earnings dates</b>: Nasdaq earnings calendar; otherwise estimated from past report dates and labelled as estimated.</li>
<li><b>Analyst targets</b>: Nasdaq, via Ticker's Actions build.</li>
<li><b>News</b>: Bing News RSS (article links and images), built by Actions.</li>
<li><b>Insider, Congress & fund trades</b>: The Insider House (House, Senate, OGE, SEC Form 4 and 13F).</li>
<li><b>Crypto</b>: Kraken (live prices and candles), CoinGecko (market cap, supply, dominance), OKX and Kraken Futures (funding), alternative.me (Fear & Greed).</li>
<li><b>Logos</b>: Ticker's stored logo set.</li></ul>${m && m.errors && m.errors.length ? `<div class="unav">Last build notes: ${m.errors.map(esc).join('; ')}</div>` : ''}<p class="muted small">Build ${BUILD}</p>`;
  });
}
function setCur(c) { ST.cur = c; save(); renderHUD(); renderWatch(); renderCalls(); if ($('#tab-profile').classList.contains('on')) renderProfile(); toast('Prices now in ' + (c === 'GBP' ? 'pounds' : 'dollars') + '. New analyses use it.'); }

// ---------------------------------------------------------------- tabs
const TABS = ['floor', 'calls', 'watch', 'profile'];
function showTab(t) {
  TABS.forEach(x => { $('#tab-' + x).classList.toggle('on', x === t); });
  const i = TABS.indexOf(t); const bar = $('.tabbar'); bar.style.setProperty('--i', i); $$('.tab-b', bar).forEach((b, k) => b.classList.toggle('on', k === i));
  const blob = $('.tab-blob'); blob.classList.remove('stretch'); void blob.offsetWidth; blob.classList.add('stretch');
  if (t === 'floor') scene.start(); else scene.stop();
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

// ---------------------------------------------------------------- boot
async function boot() {
  scene = new FloorScene($('#floor'));
  roster(); scene.start();
  scene.onCharClick = id => { if (RUN || id === 'you') return; const a = ANALYSTS[id]; if (!unlocked(id)) { toast(`🔒 ${esc(a.name)} unlocks at level ${a.lvl}.`); return; } scene.say(id, id === 'boss' ? 'ASK ME!' : 'HI!'); toast(`<b>${esc(a.name)}</b>: ${esc(a.title)}`); setTimeout(() => scene.quiet(id), 1500); };
  $('#ask').onsubmit = e => { e.preventDefault(); const v = askIn().value.trim(); if (!v) return; $('#ac').hidden = true; askIn().blur(); const ac = $$('#ac .ac-row'); askIn().value = ''; startAnalysis(v); };
  askIn().addEventListener('input', onType); askIn().addEventListener('focus', onType);
  document.addEventListener('click', e => { if (!e.target.closest('#ask')) $('#ac').hidden = true; });
  $('#dialog').onclick = dlgTap; $('#skipBtn').onclick = e => { e.stopPropagation(); if (RUN) { RUN.skip = true; dlgResolve && dlgResolve(); } };
  $('#verdict').onclick = e => { if (e.target.id === 'verdict' || e.target.closest('.vm-x')) closeVerdict(); };
  $$('.tab-b').forEach((b, i) => b.onclick = () => showTab(TABS[i]));
  $$('.cur-t button').forEach(b => b.onclick = () => setCur(b.dataset.c));
  renderHUD(); renderChips();
  const q = await DATA.loadQuotes();
  DATA.loadSearch().catch(() => { }); DATA.loadLogos();
  const cr = await DATA.loadCrypto();
  const tick = []; for (const id of ['SPY', 'QQQ', 'PLTR', 'NVDA', 'AAPL', 'TSLA', 'MSFT', 'AMZN', 'META', 'VUSA.L']) { const x = q.q[id]; if (x && x[1] != null) tick.push({ t: `${id} ${x[1] >= 0 ? '+' : ''}${x[1].toFixed(1)}%`, c: x[1] >= 0 ? '#4ade80' : '#f87171' }); }
  for (const c of (cr.coins || []).slice(0, 5)) tick.push({ t: `${c.symbol.toUpperCase()} ${c.price_change_percentage_24h >= 0 ? '+' : ''}${(c.price_change_percentage_24h || 0).toFixed(1)}%`, c: c.price_change_percentage_24h >= 0 ? '#4ade80' : '#f87171' });
  scene.setTicker(tick);
  const t = (location.hash || '').slice(1); if (TABS.includes(t) && t !== 'floor') showTab(t);
  const ask = new URLSearchParams(location.search).get('ask'); if (ask) startAnalysis(ask);
  scoreCalls(); pollWatch(); setInterval(pollWatch, 60000); setInterval(scoreCalls, 3600000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) scene.stop(); else if ($('#tab-floor').classList.contains('on')) scene.start(); });
}
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then(r => { r.update(); });
  let reloaded = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded) return; reloaded = true; location.reload(); });
}
boot();
