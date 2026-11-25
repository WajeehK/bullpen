/* Blackrock Tower: native-scrolling isometric SVG cutaway floors + inline SVG Grok Bots moved via CSS transform. */
'use strict';
const FLOORS = [
  { id: 'lobby',    name: 'Lobby',        short: 'L',  rooms: [{ key: 'lobby',    name: 'Lobby',         theme: 'lobby' },    { key: 'you',      name: 'Your desk',    theme: 'you' }] },
  { id: 'research', name: 'Research',     short: '1',  rooms: [{ key: 'chart',    name: 'Charts',        theme: 'chart' },    { key: 'quant',    name: 'Quant lab',    theme: 'quant' }] },
  { id: 'fund',     name: 'Fundamentals', short: '2',  rooms: [{ key: 'bars',     name: 'Accounts',      theme: 'bars' },     { key: 'candles',  name: 'Crypto desk',  theme: 'candles' }] },
  { id: 'news',     name: 'Newsroom',     short: '3',  rooms: [{ key: 'news',     name: 'Newsroom',      theme: 'news' },     { key: 'macro',    name: 'Macro desk',   theme: 'macro' }] },
  { id: 'vault',    name: 'Vault & Risk', short: '4',  rooms: [{ key: 'vault',    name: 'Insider vault', theme: 'vault' },    { key: 'risk',     name: 'Risk room',    theme: 'risk' }] },
  { id: 'trading',  name: 'Trading',      short: '5',  rooms: [{ key: 'earnings', name: 'Earnings',      theme: 'earnings' }, { key: 'trading',  name: 'Trading desk', theme: 'trading' }] },
  { id: 'ph',       name: 'Penthouse',    short: 'PH', rooms: [{ key: 'ph',       name: 'Penthouse',     theme: 'ph' }] }
];
const THEMES = {
  lobby:    { floor: '#ebe0cf', wallL: '#f6f3fa', wallR: '#e7e2f0', rug: '#f3cfb0', acc: '#f59e0b' },
  you:      { floor: '#e7e2d8', wallL: '#f6f3fa', wallR: '#e7e2f0', rug: '#c4ead9', acc: '#10b981' },
  chart:    { floor: '#dfe8f2', wallL: '#f3f6fb', wallR: '#e2e9f4', rug: '#c9e4f6', acc: '#0ea5e9' },
  quant:    { floor: '#e9e2f3', wallL: '#f5f2fa', wallR: '#e6e0f2', rug: '#e1d1f7', acc: '#8b5cf6' },
  bars:     { floor: '#e0ecdf', wallL: '#f3f8f4', wallR: '#e3eee5', rug: '#cdebd3', acc: '#10b981' },
  candles:  { floor: '#f1e6d9', wallL: '#faf5ef', wallR: '#ece2d6', rug: '#f8d5b8', acc: '#f97316' },
  news:     { floor: '#f2e7dc', wallL: '#faf5ef', wallR: '#ede3d8', rug: '#f6dcb0', acc: '#ec4899' },
  macro:    { floor: '#dfe6f4', wallL: '#f3f6fb', wallR: '#e2e8f3', rug: '#cfdcf6', acc: '#3b82f6' },
  vault:    { floor: '#dce0e8', wallL: '#eef0f5', wallR: '#dde1ea', rug: '#cfd5e2', acc: '#64748b' },
  risk:     { floor: '#f3e1e4', wallL: '#fbf3f4', wallR: '#efe0e3', rug: '#f7cdd3', acc: '#f43f5e' },
  earnings: { floor: '#e7e2f4', wallL: '#f5f3fa', wallR: '#e6e1f2', rug: '#ddd3f6', acc: '#a855f7' },
  trading:  { floor: '#e0edef', wallL: '#f2f7f8', wallR: '#e1ecef', rug: '#c5e8e4', acc: '#14b8a6' },
  ph:       { floor: '#2b2638', wallL: '#3b344f', wallR: '#2e2940', rug: '#473d63', acc: '#fbbf24', dark: true }
};

class Tower {
  constructor(root) {
    this.root = root;
    this.bots = new Map();
    this.unl = new Set();
    this.locks = {};
    this.ticker = [];
    this.holo = null;
    this.curF = 6;
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.floorEls = [];
    this.botLayer = null;
    this.holoEl = null;
    this.ioAnim = null;
    this.ioFloor = null;
    this._ratios = new Map();
    this.build();
    new ResizeObserver(() => this.relayoutBots()).observe(root);
  }
  skyColors() {
    const h = +new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23' });
    if (h >= 8 && h < 16) return ['#8ec5f2', '#d9ecfb', 0];
    if ((h >= 6 && h < 8) || (h >= 16 && h < 18)) return ['#f6a5c0', '#fcd9a8', 0.4];
    return ['#1b1d47', '#3b3a78', 1];
  }
  build() {
    const sky = this.skyColors();
    const garden = this.unl.has('roof');
    const roofSVG = `<svg class="roof-svg" viewBox="0 0 400 84" aria-hidden="true">
      <defs><linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${sky[0]}"/><stop offset="100%" stop-color="${sky[1]}"/></linearGradient></defs>
      <polygon points="18,62 200,16 344,50 180,82" fill="#42485c"/>
      <polygon points="18,62 180,82 180,84 18,68" fill="#2b3040"/>
      <polygon points="180,82 344,50 344,56 180,84" fill="#202430"/>
      ${garden
        ? `<polygon points="48,58 180,26 232,39 102,71" fill="#3a8c5c"/><circle cx="115" cy="48" r="11" fill="#2f9e62"/><circle cx="145" cy="40" r="9" fill="#45c27c"/><ellipse cx="255" cy="51" rx="34" ry="15" fill="#2a2f3e" stroke="#fbbf24" stroke-width="1.6"/><text x="255" y="55" text-anchor="middle" fill="#fbbf24" font-size="13" font-weight="700">H</text>`
        : `<polygon points="222,42 252,35 280,42 250,49" fill="#5c6478"/><polygon points="222,42 250,49 250,62 222,55" fill="#454b5c"/><polygon points="250,49 280,42 280,55 250,62" fill="#363b4a"/>`
      }
      <line x1="308" y1="45" x2="308" y2="14" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round"/>
      <circle class="beacon" cx="308" cy="12" r="3.4" fill="#fb7185"/>
      <g transform="translate(88,24)">
        <rect x="0" y="0" width="114" height="22" rx="6" fill="rgba(12,14,22,.9)" stroke="rgba(255,255,255,.16)"/>
        <polygon points="11,16 16,5 21,16" fill="#a78bfa"/>
        <text x="28" y="15" fill="#f8fafc" font-size="10.5" font-weight="700" letter-spacing="1.2">BLACKROCK</text>
      </g>
      <polygon points="348,46 388,46 388,84 348,84" fill="rgba(186,230,253,.08)" stroke="rgba(255,255,255,.22)"/>
      <line x1="368" y1="46" x2="368" y2="84" stroke="rgba(255,255,255,.16)"/>
    </svg>`;

    const floorsHTML = [];
    for (let f = FLOORS.length - 1; f >= 0; f--) {
      floorsHTML.push(this.renderFloorHTML(f, sky));
    }
    this.root.innerHTML = `<div class="troof">${roofSVG}</div><div class="tfloors">${floorsHTML.join('')}</div><div class="tholo" id="tholo" hidden></div><div class="bots-layer" id="botsLayer"></div>`;
    this.floorEls = [];
    for (let f = 0; f < FLOORS.length; f++) {
      this.floorEls[f] = this.root.querySelector(`.tfloor[data-floor="${f}"]`);
    }
    this.botLayer = this.root.querySelector('#botsLayer');
    this.holoEl = this.root.querySelector('#tholo');
    this.renderHolo();
    this.mountAllBots();
    this.setupObservers();
  }
  roomLocked(r) { return this.locks[r.key] != null; }
  floorSVG(f, sky) {
    const F = FLOORS[f], dark = F.rooms[0].theme === 'ph';
    const thL = THEMES[F.rooms[0].theme], thR = THEMES[(F.rooms[1] || F.rooms[0]).theme];
    const wTop = 28, wBot = 122, fBot = 192;
    const wins = () => {
      const bars = [];
      for (let i = 0; i < 11; i++) {
        const x = 32 + i * 26;
        const h = 16 + ((i * 29 + f * 13) % 24);
        bars.push(`<rect x="${x}" y="${wBot - 16 - h}" width="18" height="${h}" fill="${sky[2] > 0.5 ? 'rgba(20,24,52,.7)' : 'rgba(120,145,185,.32)'}"/>`);
      }
      const mullions = [28, 72, 116, 160, 204, 248, 292, 336].map(x => `<line x1="${x}" y1="${wTop + 6}" x2="${x}" y2="${wBot - 14}" stroke="${dark ? '#494164' : '#ffffff'}" stroke-width="2"/>`).join('');
      return `<rect x="24" y="${wTop + 6}" width="318" height="${wBot - wTop - 20}" rx="2" fill="url(#skyG)"/>${bars.join('')}${mullions}<rect x="24" y="${wBot - 16}" width="318" height="4" fill="${dark ? '#28223a' : '#d8d3e4'}"/>`;
    };
    const big = this.unl.has('screens');
    const screen = (x, col, kind) => {
      const sw = big ? 70 : 54, sh = big ? 36 : 30, sx = x - sw / 2, sy = 52;
      let art = '';
      if (kind === 'chart' || kind === 'macro' || kind === 'ph') art = `<polyline points="${sx + 6},${sy + sh - 8} ${sx + 18},${sy + sh - 15} ${sx + 30},${sy + sh - 11} ${sx + 44},${sy + 9} ${sx + sw - 6},${sy + 6}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      else if (kind === 'bars' || kind === 'earnings') art = [0.4, 0.7, 0.55, 0.85, 0.65, 0.9].map((v, i) => `<rect x="${sx + 7 + i * ((sw - 14) / 6)}" y="${sy + sh - 5 - v * (sh - 11)}" width="5" height="${v * (sh - 11)}" rx="1.5" fill="${col}" opacity="${0.65 + (i % 2) * 0.35}"/>`).join('');
      else if (kind === 'candles' || kind === 'trading') art = [1, -1, 1, 1, -1, 1].map((d, i) => `<rect x="${sx + 8 + i * ((sw - 16) / 6)}" y="${sy + (d > 0 ? 8 : 13)}" width="4.5" height="${d > 0 ? 13 : 10}" rx="1" fill="${d > 0 ? '#34d399' : '#fb7185'}"/>`).join('');
      else if (kind === 'quant') art = [[14, 18], [22, 11], [31, 20], [39, 13], [46, 8]].map(([px, py]) => `<circle cx="${sx + px}" cy="${sy + py}" r="2.2" fill="${col}"/>`).join('');
      else if (kind === 'news') art = `<rect x="${sx + 7}" y="${sy + 7}" width="16" height="14" rx="2" fill="${col}" opacity=".85"/><line x1="${sx + 27}" y1="${sy + 10}" x2="${sx + sw - 7}" y2="${sy + 10}" stroke="#cbd5e1" stroke-width="2.2"/><line x1="${sx + 27}" y1="${sy + 16}" x2="${sx + sw - 11}" y2="${sy + 16}" stroke="#94a3b8" stroke-width="2"/>`;
      else if (kind === 'radar') art = `<circle cx="${x}" cy="${sy + sh / 2}" r="10" fill="none" stroke="rgba(148,163,184,.55)"/><circle cx="${x}" cy="${sy + sh / 2}" r="5" fill="none" stroke="rgba(148,163,184,.45)"/><line x1="${x}" y1="${sy + sh / 2}" x2="${x + 8}" y2="${sy + sh / 2 - 6}" stroke="#a5f3fc" stroke-width="1.6"/>`;
      else if (kind === 'risk') art = `<polyline points="${sx + 6},${sy + 9} ${sx + 22},${sy + 14} ${sx + 36},${sy + 20} ${sx + sw - 6},${sy + sh - 7}" fill="none" stroke="#fb7185" stroke-width="2" stroke-linecap="round"/>`;
      else art = `<text x="${x}" y="${sy + 18}" text-anchor="middle" fill="#a7f3d0" font-size="8.5" font-weight="600">PLTR · NVDA · BTC</text>`;
      return `<rect x="${sx - 2}" y="${sy - 2}" width="${sw + 4}" height="${sh + 4}" rx="5" fill="#141926"/><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="3.5" fill="#0d1322"/>${art}`;
    };
    const desk = (cx, acc) => `<g>
      <rect x="${cx - 28}" y="138" width="56" height="16" rx="4" fill="#f4f1ec" stroke="rgba(0,0,0,.08)"/>
      <rect x="${cx - 28}" y="150" width="56" height="8" rx="2" fill="#dad3c7"/>
      <rect x="${cx - 10}" y="131" width="20" height="11" rx="2" fill="#cbd5e1"/>
      <rect x="${cx - 24}" y="124" width="12" height="15" rx="2" fill="#1e293b"/>
      <rect x="${cx - 22}" y="126" width="8" height="11" rx="1" fill="${acc}"/>
      <circle cx="${cx + 19}" cy="143" r="3" fill="#ffffff"/>
    </g>`;
    const plant = (x, y) => `<g><rect x="${x - 6}" y="${y}" width="12" height="11" rx="3" fill="#e5dfd5"/><circle cx="${x}" cy="${y - 5}" r="9" fill="#2f9e62"/><circle cx="${x - 4}" cy="${y - 9}" r="5.5" fill="#4ccf86"/></g>`;
    const sofa = (x, col) => `<g><rect x="${x - 32}" y="124" width="64" height="22" rx="6" fill="${col}"/><rect x="${x - 35}" y="131" width="8" height="16" rx="3" fill="rgba(0,0,0,.14)"/><rect x="${x + 27}" y="131" width="8" height="16" rx="3" fill="rgba(0,0,0,.14)"/><rect x="${x - 28}" y="136" width="56" height="11" rx="4" fill="rgba(255,255,255,.12)"/></g>`;

    const drawSide = (r, x0, x1, th) => {
      const cx = (x0 + x1) / 2, locked = this.roomLocked(r);
      const rug = `<polygon points="${x0 + 18},${wBot + 24} ${x1 - 18},${wBot + 24} ${x1 - 10},${fBot - 12} ${x0 + 10},${fBot - 12}" fill="${th.rug}" opacity="${locked ? 0.25 : 0.92}"/>`;
      if (locked) {
        return `<polygon points="${x0},${wBot} ${x1},${wBot} ${x1},${fBot} ${x0},${fBot}" fill="rgba(28,31,46,.52)"/>${rug}
          <rect x="${x0 + 6}" y="${wTop + 10}" width="${x1 - x0 - 12}" height="${fBot - wTop - 16}" rx="8" fill="rgba(14,16,26,.45)" stroke="rgba(251,191,36,.45)" stroke-dasharray="6 5"/>
          <g transform="translate(${cx},106)"><rect x="-66" y="-14" width="132" height="28" rx="14" fill="rgba(15,17,28,.88)" stroke="rgba(255,255,255,.15)"/><text x="0" y="4" text-anchor="middle" fill="#f8fafc" font-size="11" font-weight="600">${this.locks[r.key]}</text></g>
          <g transform="translate(${cx},177)"><rect x="-46" y="-10" width="92" height="20" rx="10" fill="rgba(15,17,28,.65)"/><text x="0" y="3.5" text-anchor="middle" fill="#cbd5e1" font-size="10" font-weight="600">${r.name}</text></g>`;
      }
      let furn = '';
      if (r.theme === 'lobby') {
        furn = `${screen(cx - 20, th.acc, 'ticker')}<rect x="34" y="132" width="54" height="26" rx="5" fill="#2b2f3c"/><rect x="34" y="128" width="54" height="7" rx="3" fill="#f4f1ec"/><text x="61" y="149" text-anchor="middle" fill="#e2e8f0" font-size="7.5" font-weight="700" letter-spacing=".8">BLACKROCK</text>${sofa(136, this.unl.has('lounge') ? '#8b9df5' : '#9aa5be')}${plant(24, 145)}`;
      } else if (r.theme === 'you') {
        furn = `${screen(cx, th.acc, 'watch')}${desk(cx, th.acc)}${plant(x1 - 18, 146)}`;
      } else if (r.theme === 'vault') {
        furn = `<circle cx="${x0 + 34}" cy="84" r="21" fill="#94a3b8"/><circle cx="${x0 + 34}" cy="84" r="15" fill="#cbd5e1"/><path d="M${x0 + 34} 71v26M${x0 + 21} 84h26" stroke="#64748b" stroke-width="2.2"/>${screen(cx + 22, th.acc, 'radar')}${desk(cx + 12, th.acc)}`;
      } else if (r.theme === 'risk') {
        furn = `${screen(cx, th.acc, 'risk')}${desk(cx, th.acc)}<rect x="${x1 - 24}" y="126" width="12" height="28" rx="3" fill="#e5e7eb"/><circle cx="${x1 - 18}" cy="122" r="5" fill="#f43f5e"/>`;
      } else if (r.theme === 'trading') {
        furn = `${screen(cx, th.acc, 'trading')}<rect x="${x0 + 18}" y="138" width="${x1 - x0 - 36}" height="18" rx="4" fill="#f4f1ec"/>${[0, 1, 2, 3].map(i => `<rect x="${x0 + 26 + i * 28}" y="124" width="20" height="14" rx="2" fill="#1e293b"/><rect x="${x0 + 28 + i * 28}" y="126" width="16" height="10" rx="1" fill="${i % 2 ? '#22c55e' : '#f43f5e'}"/>`).join('')}`;
      } else if (r.theme === 'ph') {
        furn = `${screen(212, th.acc, 'ph')}<rect x="40" y="134" width="60" height="20" rx="5" fill="#524234" stroke="${this.unl.has('terrace') ? '#fbbf24' : 'none'}"/><rect x="52" y="120" width="22" height="14" rx="2" fill="#1e293b"/>
          <ellipse cx="222" cy="150" rx="68" ry="26" fill="#2b2434"/><ellipse cx="222" cy="144" rx="68" ry="26" fill="#f5f0e6" stroke="${this.unl.has('terrace') ? '#fbbf24' : '#d8cfbf'}" stroke-width="2"/>
          <ellipse cx="222" cy="144" rx="34" ry="12" fill="rgba(56,189,248,.16)"/>
          ${sofa(310, this.unl.has('terrace') ? '#c9a54a' : '#5b5378')}${plant(26, 144)}`;
      } else {
        furn = `${screen(cx, th.acc, r.theme)}${desk(cx, th.acc)}${plant(x0 + 18, 144)}`;
      }
      const badge = `<g transform="translate(${cx},177)"><rect x="-46" y="-10" width="92" height="20" rx="10" fill="${dark ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.82)'}"/><text x="0" y="3.5" text-anchor="middle" fill="${dark ? '#f8fafc' : '#334155'}" font-size="10" font-weight="600">${r.name}</text></g>`;
      return `<polygon points="${x0},${wBot} ${x1},${wBot} ${x1},${fBot} ${x0},${fBot}" fill="${th.floor}"/>${rug}${furn}${badge}`;
    };

    const divider = F.rooms.length > 1 ? `<rect x="180" y="${wTop + 4}" width="4" height="${fBot - wTop - 4}" fill="rgba(148,163,184,.25)"/><rect x="180" y="${wTop + 4}" width="1" height="${fBot - wTop - 4}" fill="rgba(255,255,255,.4)"/>` : '';
    const roomsSVG = F.rooms.length === 1
      ? drawSide(F.rooms[0], 18, 344, thL)
      : drawSide(F.rooms[0], 18, 180, thL) + drawSide(F.rooms[1], 184, 344, thR);

    return `<svg class="floor-svg" viewBox="0 0 400 205" aria-hidden="true">
      <rect x="14" y="0" width="332" height="${wTop}" fill="#1d202d"/>
      <polygon points="14,${wTop} 18,${wTop} 18,${fBot} 14,${fBot}" fill="#323747"/>
      <polygon points="18,${wTop} 344,${wTop} 344,${wBot} 18,${wBot}" fill="${thL.wallL}"/>
      ${wins()}
      ${roomsSVG}
      ${divider}
      <rect x="14" y="${fBot}" width="332" height="13" fill="#2c3140"/>
      <rect x="14" y="${fBot}" width="332" height="2" fill="rgba(255,255,255,.12)"/>
      <!-- continuous glass elevator shaft -->
      <rect x="348" y="0" width="40" height="205" fill="rgba(186,230,253,.09)" stroke="rgba(255,255,255,.22)"/>
      <rect x="348" y="56" width="5" height="96" rx="2" fill="rgba(30,41,59,.7)" stroke="rgba(255,255,255,.28)"/>
      <line x1="368" y1="0" x2="368" y2="205" stroke="rgba(255,255,255,.14)"/>
      <rect x="346" y="${fBot}" width="44" height="5" fill="rgba(203,213,225,.4)"/>
    </svg>`;
  }
  renderFloorHTML(f, sky) {
    const F = FLOORS[f];
    return `<section class="tfloor" data-floor="${f}" id="floor-${f}" aria-label="Floor ${F.short}: ${F.name}">${this.floorSVG(f, sky)}</section>`;
  }
  // ------------------------------------------------------------ bots
  setBots(list) {
    const keep = new Set(list.map(b => b.id));
    for (const k of [...this.bots.keys()]) if (!keep.has(k)) { const b = this.bots.get(k); b.el && b.el.remove(); this.bots.delete(k); }
    for (const a of list) {
      let b = this.bots.get(a.id);
      if (!b) {
        b = { id: a.id, f: a.home.f, gx: a.home.gx, gy: a.home.gy, state: a.home.pose || 'type', phase: Math.random() * 4, _gen: 0 };
        this.bots.set(a.id, b);
      }
      Object.assign(b, { name: a.name, color: a.color, shape: a.shape, role: a.id, home: a.home, hidden: !!a.hidden });
    }
    this.mountAllBots();
  }
  mountAllBots() {
    if (!this.botLayer) return;
    for (const b of this.bots.values()) {
      if (!b.el) {
        const el = document.createElement('button');
        el.type = 'button'; el.className = 'gbot'; el.dataset.id = b.id;
        el.innerHTML = `<div class="gb-say" hidden></div><div class="gb-needs" hidden></div><div class="gb-art">${BOT.svg({ color: b.color, shape: b.shape, role: b.role }, { shadow: true, delay: -b.phase })}</div><div class="gb-name"><i style="background:${b.color}"></i><span>${b.name}</span></div>`;
        el.onclick = () => { if (this.onBotTap) this.onBotTap(b.id); };
        b.el = el; this.botLayer.append(el);
        if (this.ioAnim) this.ioAnim.observe(el);
      }
      b.el.hidden = !!b.hidden;
      b.el.dataset.state = b.state || 'type';
      this.positionBot(b, 0);
    }
  }
  coords(f, gx, gy) {
    const fel = this.floorEls[f];
    if (!fel) return [0, 0];
    const w = fel.offsetWidth || 380, h = fel.offsetHeight || 195;
    // Map logical tower grid (gx: 0..11.2, gy: 0..4.2) onto the 400x205 isometric room SVG
    const x = Math.max(22, Math.min(378, 22 + (gx / 10.6) * 324)) / 400 * w;
    const y = fel.offsetTop + Math.max(92, Math.min(182, 108 + (gy / 4.0) * 62)) / 205 * h;
    return [x, y];
  }
  positionBot(b, durMs) {
    if (!b.el || b.hidden) return;
    const [x, y] = this.coords(b.f, b.gx, b.gy);
    b.el.style.transitionDuration = (this.reduce ? 0 : durMs) + 'ms';
    b.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }
  relayoutBots() { for (const b of this.bots.values()) this.positionBot(b, 0); }
  setUnlocks(set, locks) {
    const key = [...set].sort().join(',') + '|' + JSON.stringify(locks || {});
    if (this._unlKey === key) return;
    this._unlKey = key;
    this.unl = new Set(set); this.locks = locks || {};
    const sky = this.skyColors();
    for (let f = 0; f < FLOORS.length; f++) {
      if (this.floorEls[f]) this.floorEls[f].innerHTML = this.floorSVG(f, sky);
    }
    this.relayoutBots();
  }
  setTicker(items) { this.ticker = items || []; }
  renderHolo() {
    if (!this.holoEl) return;
    const h = this.holo;
    if (!h || !h.series || h.series.length < 2) { this.holoEl.hidden = true; return; }
    this.holoEl.hidden = false;
    const s = h.series, mn = Math.min(...s), mx = Math.max(...s), col = h.up ? '#34d399' : '#fb7185';
    const pts = s.map((v, i) => `${(4 + i / (s.length - 1) * 112).toFixed(1)},${(38 - (v - mn) / (mx - mn || 1) * 26).toFixed(1)}`).join(' ');
    this.holoEl.innerHTML = `<div class="hl-top"><b>${h.label}</b>${h.score != null ? `<span style="color:${col}">${h.score}/100</span>` : ''}</div><svg viewBox="0 0 120 44"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  setHolo(h) { this.holo = h; this.renderHolo(); }
  say(id, txt) {
    const b = this.bots.get(id); if (!b || !b.el) return;
    const s = b.el.querySelector('.gb-say'); s.textContent = txt; s.hidden = false;
    b.el.classList.add('talking'); if (!b.walking) { b.state = 'talk'; b.el.dataset.state = 'talk'; }
  }
  quiet(id) {
    const b = this.bots.get(id); if (!b || !b.el) return;
    b.el.querySelector('.gb-say').hidden = true; b.el.classList.remove('talking');
    if (b.state === 'talk') { b.state = 'stand'; b.el.dataset.state = 'stand'; }
  }
  needs(id, txt) {
    const b = this.bots.get(id); if (!b || !b.el) return;
    const n = b.el.querySelector('.gb-needs');
    if (txt) { n.textContent = txt; n.hidden = false; b.el.classList.add('needs'); }
    else { n.hidden = true; b.el.classList.remove('needs'); }
  }
  place(id, d) {
    const b = this.bots.get(id); if (!b) return;
    b._gen++; b.walking = false; b.f = d.f; b.gx = d.gx; b.gy = d.gy; b.state = d.pose || 'stand';
    if (b.el) b.el.dataset.state = b.state;
    this.positionBot(b, 0);
  }
  isHome(id) { const b = this.bots.get(id); return b && !b.walking && b.f === b.home.f && Math.abs(b.gx - b.home.gx) < 0.08 && Math.abs(b.gy - b.home.gy) < 0.08; }
  isAt(id, d) { const b = this.bots.get(id); return b && !b.walking && b.f === d.f && Math.abs(b.gx - d.gx) < 0.08 && Math.abs(b.gy - d.gy) < 0.08; }
  goHome(id, fast) { const b = this.bots.get(id); return b ? this.walk(id, b.home, fast) : Promise.resolve(); }
  async walk(id, d, fast = 1) {
    const b = this.bots.get(id); if (!b || b.hidden || !b.el) return false;
    const gen = ++b._gen; b.walking = true;
    const stepWait = (f, gx, gy, state, ms) => new Promise(res => {
      if (gen !== b._gen) return res(false);
      b.f = f; b.gx = gx; b.gy = gy; b.state = state; b.el.dataset.state = state;
      this.positionBot(b, ms);
      setTimeout(() => res(gen === b._gen), this.reduce ? 20 : ms);
    });
    const sp = 1 / Math.max(0.6, fast);
    if (d.f !== b.f) {
      if (!(await stepWait(b.f, 9.8, 2.2, 'walk', Math.round(550 * sp)))) return false;
      if (!(await stepWait(b.f, 10.75, 2.2, 'walk', Math.round(280 * sp)))) return false;
      const floors = Math.abs(d.f - b.f);
      if (!(await stepWait(d.f, 10.75, 2.2, 'ride', Math.round((450 + floors * 260) * sp)))) return false;
      if (!(await stepWait(d.f, 9.7, 2.2, 'walk', Math.round(260 * sp)))) return false;
    }
    const dist = Math.hypot(d.gx - b.gx, d.gy - b.gy);
    const ms = Math.max(280, Math.round((320 + dist * 130) * sp));
    if (!(await stepWait(d.f, d.gx, d.gy, 'walk', ms))) return false;
    b.walking = false; b.state = d.pose || 'stand'; b.el.dataset.state = b.state;
    return true;
  }
  stats() {
    let moving = 0, working = 0, idle = 0;
    for (const b of this.bots.values()) {
      if (b.hidden || b.id === 'you') continue;
      if (b.walking) moving++;
      else if (b.state === 'type' || b.state === 'talk') working++;
      else idle++;
    }
    return { moving, working, idle };
  }
  focusFloor(f, opts = {}) {
    const el = this.floorEls[f]; if (!el) return;
    this.curF = f; this.onFloor && this.onFloor(f);
    el.scrollIntoView({ behavior: opts.instant || this.reduce ? 'auto' : 'smooth', block: 'center' });
  }
  follow(id) {
    if (!id) return;
    const b = this.bots.get(id);
    if (b && !b.hidden) this.focusFloor(b.f);
  }
  setupObservers() {
    if (this.ioAnim) this.ioAnim.disconnect();
    if (this.ioFloor) this.ioFloor.disconnect();
    this.ioAnim = new IntersectionObserver(entries => {
      for (const e of entries) e.target.classList.toggle('offscreen', !e.isIntersecting);
    }, { rootMargin: '80px 0px' });
    this.floorEls.forEach(el => this.ioAnim.observe(el));
    for (const b of this.bots.values()) if (b.el) this.ioAnim.observe(b.el);

    this.ioFloor = new IntersectionObserver(entries => {
      for (const e of entries) this._ratios.set(+e.target.dataset.floor, e.isIntersecting ? e.intersectionRatio : 0);
      let best = this.curF, br = -1;
      for (const [f, r] of this._ratios) if (r > br) { br = r; best = f; }
      if (br > 0.05 && best !== this.curF) { this.curF = best; this.onFloor && this.onFloor(best); }
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    this.floorEls.forEach(el => this.ioFloor.observe(el));
  }
  start() { this.relayoutBots(); }
  stop() {}
  resize() { this.relayoutBots(); }
  setLayout() { this.relayoutBots(); }
}
