/* Bullpen data layer. Actions-built JSON first, live public APIs where they allow browser reads. */
'use strict';
const TICKER = 'https://wajeehk.github.io/ticker/';
const IH = 'https://wajeehk.github.io/congress-trades/';
const JINA = 'https://r.jina.ai/';
const DATA = {
  search: null, quotes: null, crypto: null, logos: null, cache: new Map(), fails: [],
  async j(url, ms = 12000, opt = {}) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try { const r = await fetch(url, { signal: ctl.signal, cache: opt.cache || 'default' }); if (!r.ok) throw new Error('HTTP ' + r.status); const tx = await r.text(); return JSON.parse(opt.jina ? tx.slice(tx.indexOf('{'), tx.lastIndexOf('}') + 1) : tx); }
    finally { clearTimeout(t); }
  },
  bust(min = 5) { return 't=' + Math.floor(Date.now() / (min * 60000)); },
  async loadSearch() { if (!this.search) { const d = await this.j('data/search.json?' + this.bust(30)); this.search = d.items.map(x => ({ id: x[0], name: x[1], kind: x[2], ex: x[3], rank: x[4], cg: x[2] === 'crypto' ? x[3] : null })); } return this.search; },
  async loadQuotes(force) { if (!this.quotes || force) { try { this.quotes = await this.j('data/q.json?' + this.bust(force ? 1 : 5), 10000, { cache: 'no-cache' }); } catch (e) { if (!this.quotes) this.quotes = { q: {}, fx: {} }; } } return this.quotes; },
  async loadCrypto() { if (!this.crypto) { try { this.crypto = await this.j('data/crypto.json?' + this.bust(15)); } catch (e) { this.crypto = { coins: [], funding: {}, kraken: {} }; } } return this.crypto; },
  fx() { return (this.quotes && this.quotes.fx && this.quotes.fx.GBPUSD) || null; },
  async loadLogos() { if (this.logos) return this.logos; try { this.logos = await this.j(TICKER + 'img/manifest.json?' + this.bust(600), 8000); } catch (e) { this.logos = {}; } return this.logos; },
  logo(id, crypto) { const m = this.logos || {}; const k = crypto ? id + '-USD' : id; const e = m[k]; return e ? { src: TICKER + e.src, chip: e.chip } : null; },
  // ---------------------------------------------------------------- resolve a free-text question
  parse(q) {
    let s = (q || '').trim();
    const crypto = /\b(crypto|coin|token)\b/i.test(s);
    if (!/\s/.test(s)) return { term: s.replace(/^\$/, '').replace(/[?!]+$/, ''), crypto };
    s = s.replace(/^(hey|yo|ok|so)[, ]+/i, '').replace(/\b(should i (look at|buy|sell|get|invest in)|what (about|do you think of|'?s up with)|how about|analy[sz]e|analysis (of|on)|tell me about|thoughts on|is it time to buy|look at|check|review|research|deep dive( on| into)?|run|the team on|please|pls|stock|shares|share price|crypto|coin|token|price|now|today|right now)\b/gi, ' ');
    s = s.replace(/[?!,"']/g, ' ').replace(/\.(\s|$)/g, ' ').replace(/\$/g, '').replace(/\s+/g, ' ').trim();
    return { term: s, crypto };
  },
  rank(term, wantCrypto) {
    const L = this.search || []; const t = term.toLowerCase(), T = term.toUpperCase(); if (!t) return [];
    const out = [];
    for (const x of L) {
      const nm = x.name.toLowerCase(); let sc = 0;
      if (x.id.toUpperCase() === T || x.id.toUpperCase() === T + '.L') sc = 100; else if (x.id.toUpperCase().startsWith(T)) sc = 60 - x.id.length;
      if (nm === t) sc = Math.max(sc, 95); else if (nm.startsWith(t)) sc = Math.max(sc, 80); else if (new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(nm)) sc = Math.max(sc, 70); else if (t.length > 3 && nm.includes(t)) sc = Math.max(sc, 40);
      if (!sc) continue;
      if (x.kind === 'crypto') { sc += wantCrypto ? 30 : -3; if (x.rank) sc += Math.max(0, 10 - x.rank / 20); }
      else if (wantCrypto) sc -= 20;
      out.push({ ...x, sc });
    }
    out.sort((a, b) => b.sc - a.sc);
    return out.slice(0, 8);
  },
  async yahooSearch(term) {
    const u = 'https://query2.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(term) + '&quotesCount=6&newsCount=8';
    const d = await this.j(JINA + u, 20000, { jina: true });
    return d;
  },
  // ---------------------------------------------------------------- stocks
  async stock(id) {
    const k = 's:' + id; if (this.cache.has(k)) return this.cache.get(k);
    let s = null;
    try { s = await this.j('data/s/' + encodeURIComponent(id) + '.json?' + this.bust(10)); s.src = 'actions'; }
    catch (e) { s = await this.stockOnDemand(id); }
    this.cache.set(k, s); return s;
  },
  async stockOnDemand(id, name) {
    const u = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(id) + '?range=2y&interval=1d&events=div';
    const d = await this.j(JINA + u, 25000, { jina: true });
    const r = d.chart.result[0], m = r.meta, q = r.indicators.quote[0]; const sc = (m.currency === 'GBp' || m.currency === 'GBX') ? 0.01 : 1;
    const rows = []; r.timestamp.forEach((t, i) => { if (q.close[i] == null) return; const f = v => v == null ? q.close[i] * sc : v * sc; rows.push([Math.floor(t / 86400), f(q.open[i]), f(q.high[i]), f(q.low[i]), q.close[i] * sc, q.volume[i] || 0]); });
    let news = [];
    try { const sr = await this.yahooSearch(id); news = (sr.news || []).map(n => ({ t: n.title, u: n.link, s: n.publisher, ts: n.providerPublishTime, img: n.thumbnail && n.thumbnail.resolutions ? (n.thumbnail.resolutions.find(x => x.width >= 140 && x.width < 400) || n.thumbnail.resolutions[0]).url : null })); } catch (e) { }
    const divs = Object.values((r.events || {}).dividends || {}).map(v => [v.date, v.amount * sc]).sort((a, b) => a[0] - b[0]);
    return { id, sym: id.replace(/\.L$/, ''), name: m.longName || m.shortName || name || id, kind: (m.instrumentType || '').toLowerCase() === 'etf' ? 'etf' : 'equity', ex: /\.L$/.test(id) ? 'LSE' : 'US', cur: sc !== 1 ? 'GBP' : (m.currency || 'USD'), exch: m.fullExchangeName, price: m.regularMarketPrice * sc, prev: rows.length > 1 ? rows[rows.length - 2][4] : null, asOf: m.regularMarketTime, hi52: m.fiftyTwoWeekHigh * sc, lo52: m.fiftyTwoWeekLow * sc, d: rows, div: divs, news, newsAt: Date.now() / 1000, fund: null, peers: null, an: null, earn: null, src: 'ondemand' };
  },
  // ---------------------------------------------------------------- crypto
  async coin(sym) {
    const k = 'c:' + sym; if (this.cache.has(k)) return this.cache.get(k);
    const cr = await this.loadCrypto();
    const mk = (cr.coins || []).find(c => c.symbol.toUpperCase() === sym) || null;
    let file = null; try { file = await this.j('data/c/' + encodeURIComponent(sym) + '.json?' + this.bust(10)); } catch (e) { }
    const pair = (file && file.pair) || (cr.kraken || {})[sym];
    const out = { sym, market: mk, file, pair, bars: (file && file.d) || null, news: (file && file.news) || [], liveSrc: null };
    const jobs = [];
    if (pair) jobs.push(this.j('https://api.kraken.com/0/public/OHLC?pair=' + pair + '&interval=1440', 10000).then(d => { const rows = Object.entries(d.result).find(([k]) => k !== 'last')[1]; out.bars = rows.map(x => [Math.floor(x[0] / 86400), +x[1], +x[2], +x[3], +x[4], Math.round(+x[6] * +x[5])]); out.liveSrc = 'Kraken'; }).catch(() => { }));
    jobs.push(this.j('https://www.okx.com/api/v5/public/funding-rate?instId=' + sym + '-USDT-SWAP', 8000).then(d => { const f = d.data && d.data[0]; if (f) { const hrs = f.nextFundingTime && f.fundingTime ? (f.nextFundingTime - f.fundingTime) / 3600000 : 8; out.funding = { rate: +f.fundingRate, interval: (hrs || 8) + 'h', perDay: 24 / (hrs || 8), src: 'OKX' }; } }).catch(() => { }));
    const cgId = mk ? mk.id : null;
    if (cgId) jobs.push(this.j('https://api.coingecko.com/api/v3/coins/' + cgId + '?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false', 9000).then(d => { const m = d.market_data; out.detail = { cats: (d.categories || []).filter(Boolean).slice(0, 4), desc: (d.description && d.description.en || '').replace(/<[^>]+>/g, '').split('. ').slice(0, 2).join('. '), genesis: d.genesis_date }; if (m && out.market) { Object.assign(out.market, { current_price: m.current_price.usd, market_cap: m.market_cap.usd, total_volume: m.total_volume.usd, circulating_supply: m.circulating_supply, total_supply: m.total_supply, max_supply: m.max_supply, fully_diluted_valuation: m.fully_diluted_valuation && m.fully_diluted_valuation.usd, price_change_percentage_7d_in_currency: m.price_change_percentage_7d, price_change_percentage_30d_in_currency: m.price_change_percentage_30d }); out.cgLive = true; } }).catch(() => { }));
    await Promise.all(jobs);
    if (!out.bars && cgId) { try { const d = await this.j('https://api.coingecko.com/api/v3/coins/' + cgId + '/market_chart?vs_currency=usd&days=365&interval=daily', 12000); out.bars = d.prices.map(p => { const c = p[1]; return [Math.floor(p[0] / 86400000), c, c, c, c, 0]; }); out.liveSrc = 'CoinGecko'; } catch (e) { } }
    if (!out.funding && cr.funding && cr.funding[sym]) { const f = cr.funding[sym]; out.funding = { rate: f.rel, interval: '1h', perDay: 24, src: 'Kraken Futures (Actions snapshot)' }; }
    out.price = out.bars && out.bars.length ? out.bars[out.bars.length - 1][4] : mk && mk.current_price;
    this.cache.set(k, out); return out;
  },
  async krakenTicker(pairs) { if (!pairs.length) return {}; const d = await this.j('https://api.kraken.com/0/public/Ticker?pair=' + pairs.join(','), 9000, { cache: 'no-store' }); return d.result || {}; },
  // ---------------------------------------------------------------- insider (The Insider House, split by our Action)
  async insider(sym) { try { return await this.j('data/ins/' + encodeURIComponent(sym) + '.json?' + this.bust(30)); } catch (e) { return null; } },
  async holders(sym) { try { const d = await this.j(IH + 'data/stock/' + encodeURIComponent(sym) + '.json', 8000); return d.holders || []; } catch (e) { return []; } },
  async stockFng() { try { const d = await this.j(TICKER + 'data/market_sentiment.json?' + this.bust(60), 8000); return d.fearGreed; } catch (e) { return null; } },
  async meta() { try { return await this.j('data/meta.json?' + this.bust(5)); } catch (e) { return null; } }
};
