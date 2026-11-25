/* Bullpen isometric trading floor. Logical pixel canvas scaled by an integer factor. */
'use strict';
class FloorScene {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.H = 156; this.W = 208; this.scale = 3;
    this.N = 10; this.T = 0; this.last = 0; this.running = false;
    this.chars = new Map(); this.decor = new Set(); this.tickerItems = []; this.fx = []; this.bubbles = new Map();
    this.buf = PX.canvas(10, 10);
    this.static = null; this.furn = [];
    this.spot = null; this.quoteBoard = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    cv.addEventListener('click', e => this.onClick(e));
  }
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.min(this.cv.parentElement.clientWidth || 380, 640);
    const devW = Math.round(cssW * dpr);
    let s = Math.max(2, Math.round(devW / 190));
    let W = Math.ceil(devW / s);
    if (W < 178) { s = Math.max(1, Math.floor(devW / 178)); W = Math.ceil(devW / s); }
    this.scale = s; this.W = W; this.H = Math.max(140, Math.round(W * 0.76));
    this.cv.width = W * s; this.cv.height = this.H * s;
    this.cv.style.width = (W * s / dpr) + 'px'; this.cv.style.height = (this.H * s / dpr) + 'px';
    this.buf.width = W; this.buf.height = this.H;
    this.ox = Math.round(W / 2); this.oy = Math.max(53, Math.round(this.H * 0.37));
    this.static = null;
  }
  iso(gx, gy, z = 0) { return [this.ox + (gx - gy) * 8, this.oy + (gx + gy) * 4 - z]; }
  // ------------------------------------------------------------ setup
  setRoster(list) {
    const keep = new Set(list.map(a => a.id));
    for (const k of [...this.chars.keys()]) if (!keep.has(k)) this.chars.delete(k);
    for (const a of list) {
      let c = this.chars.get(a.id);
      if (!c) { c = { id: a.id, gx: a.seat[0], gy: a.seat[1], path: [], state: 'type', view: 'front', frame: 0, ft: 0, flip: false, blinkT: 2 + Math.random() * 3, home: a.seat }; this.chars.set(a.id, c); }
      Object.assign(c, { look: a.look, seat: a.seat, out: a.out, desk: a.desk, locked: a.locked, color: a.color, name: a.short, home: a.seat, back: !!a.backView, mon: a.mon });
      if (a.locked) { c.gx = a.seat[0]; c.gy = a.seat[1]; c.path = []; }
    }
    this.static = null;
  }
  setDecor(set) { this.decor = new Set(set); this.static = null; }
  setTicker(items) { this.tickerItems = items || []; }
  // ------------------------------------------------------------ static layer
  buildStatic() {
    const W = this.W, H = this.H, cv = PX.canvas(W, H), c = cv.getContext('2d');
    const N = this.N;
    // background
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d0b18'); g.addColorStop(1, '#07060d');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const wallH = 46;
    const P = (gx, gy, z) => this.iso(gx, gy, z);
    // walls
    PX.poly(c, [P(0, 0, wallH), P(0, N, wallH), P(0, N, 0), P(0, 0, 0)], '#2b2546');
    PX.poly(c, [P(0, 0, wallH), P(N, 0, wallH), P(N, 0, 0), P(0, 0, 0)], '#352d57');
    // wall trim
    PX.poly(c, [P(0, 0, wallH + 3), P(0, N, wallH + 3), P(0, N, wallH), P(0, 0, wallH)], '#1c1830');
    PX.poly(c, [P(0, 0, wallH + 3), P(N, 0, wallH + 3), P(N, 0, wallH), P(0, 0, wallH)], '#221d3b');
    PX.poly(c, [P(0, 0, 4), P(0, N, 4), P(0, N, 0), P(0, 0, 0)], '#1f1a35');
    PX.poly(c, [P(0, 0, 4), P(N, 0, 4), P(N, 0, 0), P(0, 0, 0)], '#2a2347');
    // windows on left wall (skyline drawn dynamically into these rects)
    this.windows = [];
    for (const [a, b] of [[2.2, 3.9], [5.0, 6.7], [7.8, 9.5]]) {
      const q = [P(0, a, 38), P(0, b, 38), P(0, b, 14), P(0, a, 14)];
      PX.poly(c, q, '#141026');
      this.windows.push({ a, b });
    }
    // floor tiles
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
      const col = (x + y) % 2 ? '#2a2f45' : '#262a3f';
      PX.poly(c, [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], col);
    }
    // floor grid shine lines
    c.globalAlpha = 0.18;
    for (let i = 0; i <= N; i++) { PX.poly(c, [P(i, 0), P(i + 0.04, 0), P(i + 0.04, N), P(i, N)], '#6b7bb5'); PX.poly(c, [P(0, i), P(N, i), P(N, i + 0.04), P(0, i + 0.04)], '#6b7bb5'); }
    c.globalAlpha = 1;
    // rug under the table
    const rug = (x0, y0, x1, y1, col, edge) => { PX.poly(c, [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], edge); PX.poly(c, [P(x0 + .2, y0 + .2), P(x1 - .2, y0 + .2), P(x1 - .2, y1 - .2), P(x0 + .2, y1 - .2)], col); };
    rug(3.4, 3.4, 7.0, 7.0, '#3b2a5c', '#5a3f8a');
    if (this.decor.has('rug')) rug(3.6, 3.6, 6.8, 6.8, '#6b2140', '#d4a017');
    rug(0.1, 0.1, 2.6, 2.6, '#40233a', '#7a3b5c'); // boss corner
    // front edge
    PX.poly(c, [P(0, N), P(N, N), P(N, N, -5), P(0, N, -5)], '#151827');
    PX.poly(c, [P(N, 0), P(N, N), P(N, N, -5), P(N, 0, -5)], '#1b1f32');
    // big LED board on the right wall
    this.board = { a: 2.4, b: 8.6, z0: 24, z1: 40 };
    PX.poly(c, [P(this.board.a - .15, 0, 41.5), P(this.board.b + .15, 0, 41.5), P(this.board.b + .15, 0, 22.5), P(this.board.a - .15, 0, 22.5)], '#0a0a10');
    PX.poly(c, [P(this.board.a, 0, 40), P(this.board.b, 0, 40), P(this.board.b, 0, 24), P(this.board.a, 0, 24)], '#05060a');
    // clock + sign spots
    this.static = cv;
    this.buildFurniture();
  }
  isoBox(c, x0, y0, x1, y1, z0, h, top, left, right) {
    const P = (gx, gy, z) => this.iso(gx, gy, z);
    PX.poly(c, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z0 + h), P(x0, y1, z0 + h)], left);
    PX.poly(c, [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z0 + h), P(x1, y0, z0 + h)], right);
    PX.poly(c, [P(x0, y0, z0 + h), P(x1, y0, z0 + h), P(x1, y1, z0 + h), P(x0, y1, z0 + h)], top);
  }
  // furniture pieces are pre-rendered full-size layers with a depth key
  piece(depth, fn) { const cv = PX.canvas(this.W, this.H); fn(cv.getContext('2d')); this.furn.push({ depth, cv, fn: null }); }
  dyn(depth, fn) { this.furn.push({ depth, cv: null, fn }); }
  buildFurniture() {
    this.furn = [];
    const S = (x) => PX.shade('#8a5a3c', x);
    // central table
    this.piece(5.2 + 5.2 + 0.4, c => {
      this.isoBox(c, 4.3, 4.3, 6.1, 6.1, 0, 3, '#1d1a2e', '#16131f', '#1a1726');
      this.isoBox(c, 4.95, 4.95, 5.45, 5.45, 3, 4, '#2e2a40', '#221f30', '#28243a');
      this.isoBox(c, 4.0, 4.0, 6.4, 6.4, 7, 2, '#3b3355', '#2a2440', '#312a4b');
      PX.poly(c, [this.iso(4.2, 4.2, 9), this.iso(6.2, 4.2, 9), this.iso(6.2, 6.2, 9), this.iso(4.2, 6.2, 9)], '#4a4070');
    });
    // holo display on the table (dynamic)
    this.dyn(99, (c, t) => this.drawHolo(c, t));
    // desks
    for (const ch of this.chars.values()) {
      const d = ch.desk; if (!d) continue;
      const [x0, y0, x1, y1] = d.box;
      const depth = (x0 + x1) / 2 + (y0 + y1) / 2 + 0.2;
      const top = ch.locked ? '#3a3a48' : '#9b6b47', left = ch.locked ? '#2a2a34' : '#6e4a31', right = ch.locked ? '#30303c' : '#7d553a';
      this.piece(depth, c => {
        this.isoBox(c, x0, y0, x1, y1, 0, 8, top, left, right);
        PX.poly(c, [this.iso(x0 + .1, y0 + .1, 8), this.iso(x1 - .1, y0 + .1, 8), this.iso(x1 - .1, y0 + .14, 8), this.iso(x0 + .1, y0 + .14, 8)], PX.shade(top, .25));
      });
      // chair behind the seat
      const [sx, sy] = ch.seat;
      this.piece(sx + sy - 0.35, c => {
        this.isoBox(c, sx - .35, sy - .35, sx + .35, sy + .35, 0, 5, '#3c3f58', '#2b2d40', '#33354b');
        if (d.wall === 'L') this.isoBox(c, sx - .45, sy - .35, sx - .3, sy + .35, 5, 9, '#4a4e6b', '#33364b', '#3d4059');
        else this.isoBox(c, sx - .35, sy - .45, sx + .35, sy - .3, 5, 9, '#4a4e6b', '#33364b', '#3d4059');
      });
      // monitor (dynamic glow) sits on the desk, screen faces the seat
      this.dyn(depth + 0.05, (c, t) => this.drawMonitor(c, ch, t));
    }
    // decor
    const D = this.decor;
    const plant = (gx, gy, big) => this.piece(gx + gy, c => {
      this.isoBox(c, gx - .25, gy - .25, gx + .25, gy + .25, 0, 6, '#c26b4a', '#8e4a33', '#a4583d');
      const [x, y] = this.iso(gx, gy, 6);
      const leaf = [[0, -10, 3], [-3, -7, 3], [3, -7, 3], [-4, -3, 3], [4, -3, 3], [0, -5, 4], [-2, -13, 2], [2, -12, 2]];
      for (const [dx, dy, r] of leaf) { c.fillStyle = '#2f8f4e'; c.fillRect(x + dx - r, y + dy - r + 2, r * 2, r * 2 - 1); c.fillStyle = '#4fc26f'; c.fillRect(x + dx - r + 1, y + dy - r + 2, r, r - 1); }
      if (big) { c.fillStyle = '#2f8f4e'; c.fillRect(x - 2, y - 20, 4, 8); c.fillStyle = '#4fc26f'; c.fillRect(x - 1, y - 20, 2, 5); }
    });
    plant(0.5, 9.4, true); plant(9.4, 0.5, true);
    if (D.has('plants')) { plant(2.8, 0.45); plant(0.45, 2.8); plant(9.4, 4.0); }
    if (D.has('cooler')) this.piece(9.5 + 2.4, c => {
      this.isoBox(c, 9.2, 2.1, 9.75, 2.65, 0, 12, '#dfe7f2', '#aab4c5', '#c3ccda');
      const [x, y] = this.iso(9.47, 2.37, 12); c.fillStyle = '#7cc8ff'; c.fillRect(x - 3, y - 9, 6, 9); c.fillStyle = '#b9e3ff'; c.fillRect(x - 2, y - 8, 2, 6);
    });
    if (D.has('arcade')) this.dyn(9.4 + 6.4, (c, t) => {
      this.isoBox(c, 9.1, 6.0, 9.8, 6.8, 0, 22, '#2b1f4f', '#1d1538', '#251a45');
      const [x, y] = this.iso(9.1, 6.4, 16); const hue = (t * 60) % 360;
      c.fillStyle = `hsl(${hue},90%,60%)`; c.fillRect(x - 4, y - 4, 7, 5); c.fillStyle = '#0b0b16'; c.fillRect(x - 3, y - 3, 5, 3);
      c.fillStyle = '#ffe14d'; c.fillRect(x - 3 + Math.floor(t * 3) % 5, y - 2, 1, 1); c.fillStyle = '#ff4d6d'; c.fillRect(x - 5, y + 3, 2, 1);
    });
    if (D.has('bull')) this.piece(7.6 + 9.2, c => {
      this.isoBox(c, 7.2, 8.8, 8.0, 9.6, 0, 4, '#3b3355', '#2a2440', '#312a4b');
      const [x, y] = this.iso(7.6, 9.2, 4); const gd = '#e6b422', gl = '#ffe08a', gs = '#a9790f';
      c.fillStyle = gs; c.fillRect(x - 6, y - 4, 2, 4); c.fillRect(x + 3, y - 4, 2, 4);
      c.fillStyle = gd; c.fillRect(x - 7, y - 9, 12, 6); c.fillRect(x + 4, y - 11, 5, 5);
      c.fillStyle = gl; c.fillRect(x - 6, y - 9, 8, 2); c.fillRect(x + 5, y - 11, 3, 1);
      c.fillStyle = '#fff4c2'; c.fillRect(x + 8, y - 13, 1, 2); c.fillRect(x + 4, y - 13, 1, 2);
      c.fillStyle = gs; c.fillRect(x - 8, y - 8, 1, 3);
    });
    if (D.has('aquarium')) this.dyn(2.0 + 9.6, (c, t) => {
      this.isoBox(c, 1.0, 9.3, 3.0, 9.85, 0, 7, '#2a2440', '#1d1830', '#241e38');
      this.isoBox(c, 1.05, 9.35, 2.95, 9.8, 7, 10, 'rgba(90,180,255,0.35)', 'rgba(40,120,210,0.55)', 'rgba(60,150,230,0.5)');
      for (let i = 0; i < 3; i++) { const p = ((t * 0.15 + i * 0.33) % 1); const [x, y] = this.iso(1.2 + p * 1.6, 9.8, 10 + i * 2); c.fillStyle = ['#ff8a3d', '#ffd23d', '#ff5d8f'][i]; c.fillRect(x, y, 2, 1); c.fillRect(x + (i % 2 ? -1 : 2), y, 1, 1); }
    });
    if (D.has('neon')) this.dyn(0.01, (c, t) => {
      const on = Math.sin(t * 3) > -0.92;
      const [x, y] = this.iso(0, 1.2, 44); const s = 'BULLPEN';
      c.globalAlpha = on ? 1 : 0.35;
      PX.text(c, s, x - PX.textW(s) - 3, y + 2, '#ff4fd8'); PX.text(c, s, x - PX.textW(s) - 3, y + 1, '#ffd1f6');
      c.globalAlpha = 1;
    });
    if (D.has('trophy')) this.piece(9.5 + 8.6, c => {
      this.isoBox(c, 9.2, 8.2, 9.8, 9.0, 0, 9, '#5b4636', '#3f3026', '#4c3a2d');
      const [x, y] = this.iso(9.5, 8.6, 9); c.fillStyle = '#f5c542'; c.fillRect(x - 3, y - 7, 6, 4); c.fillRect(x - 1, y - 3, 2, 2); c.fillRect(x - 2, y - 1, 4, 1); c.fillStyle = '#fff1a8'; c.fillRect(x - 2, y - 7, 2, 2);
    });
    if (D.has('coffee')) this.dyn(9.5 + 5.3, (c, t) => {
      this.isoBox(c, 9.2, 5.0, 9.8, 5.6, 0, 9, '#3a3d4f', '#262838', '#2f3244');
      this.isoBox(c, 9.3, 5.1, 9.7, 5.5, 9, 6, '#c0392b', '#8e2a20', '#a53226');
      const [x, y] = this.iso(9.3, 5.3, 12);
      c.fillStyle = '#f4f1de'; c.fillRect(x - 1, y + 1, 2, 2);
      for (let i = 0; i < 3; i++) { const p = (t * 0.6 + i / 3) % 1; c.globalAlpha = 1 - p; c.fillStyle = '#d9d9e8'; c.fillRect(x + Math.round(Math.sin(p * 6 + i) * 1.5), y - 4 - p * 8, 1, 1); }
      c.globalAlpha = 1;
    });
    if (D.has('lamp')) this.dyn(0.02, (c, t) => {
      const [x, y] = this.iso(0, 4.5, 24);
      c.fillStyle = '#2b2546'; c.fillRect(x - 2, y + 6, 5, 2);
      c.fillStyle = '#7c3aed'; c.fillRect(x - 1, y - 6, 3, 12);
      const by = y - 4 + Math.round((Math.sin(t * 1.3) + 1) * 4); c.fillStyle = '#fb7185'; c.fillRect(x, by, 1, 2);
    });
    if (D.has('server')) this.dyn(9.6 + 4.3, (c, t) => {
      this.isoBox(c, 9.25, 3.9, 9.85, 4.7, 0, 24, '#1b1d2a', '#111219', '#161822');
      for (let i = 0; i < 6; i++) { const [x, y] = this.iso(9.25, 4.0 + (i % 2) * 0.35, 4 + Math.floor(i / 2) * 6); c.fillStyle = Math.sin(t * 7 + i * 1.7) > 0 ? '#34d399' : '#0f5132'; c.fillRect(x - 1, y - 1, 1, 1); c.fillStyle = Math.sin(t * 5 + i) > .5 ? '#fbbf24' : '#3b2c06'; c.fillRect(x - 3, y, 1, 1); }
    });
    if (D.has('cat')) this.dyn(-1, () => {});
    // boss desk
    this.piece(2.0 + 2.0 - 0.2, c => {
      this.isoBox(c, 1.55, 0.7, 2.25, 2.25, 0, 8, '#4a2b1e', '#2f1b13', '#3b2218');
      this.isoBox(c, 0.7, 1.55, 1.55, 2.25, 0, 8, '#4a2b1e', '#2f1b13', '#3b2218');
      const [x, y] = this.iso(2.25, 1.5, 6); c.fillStyle = '#d4a017'; c.fillRect(x - 3, y - 1, 6, 2);
    });
    // player desk (front corner)
    this.piece(8.0 + 8.0 + 0.1, c => {
      this.isoBox(c, 7.3, 7.6, 8.4, 8.4, 0, 8, '#3a6ea5', '#26476c', '#2f5a87');
      this.isoBox(c, 7.6, 7.3, 8.4, 7.6, 0, 8, '#3a6ea5', '#26476c', '#2f5a87');
    });
    this.dyn(8.0 + 8.0 + 0.15, (c, t) => {
      const [x, y] = this.iso(7.85, 7.85, 8);
      c.fillStyle = '#10131f'; c.fillRect(x - 6, y - 9, 12, 8); c.fillStyle = '#1e293b'; c.fillRect(x - 1, y - 1, 2, 2);
      c.fillStyle = '#0b1220'; c.fillRect(x - 5, y - 8, 10, 6);
      const pts = []; for (let i = 0; i < 10; i++) pts.push(Math.round(Math.sin(t * 1.5 + i * 0.7) * 1.5 + Math.cos(i * 1.3) * 1));
      for (let i = 0; i < 10; i++) { c.fillStyle = pts[i] > 0 ? '#22c55e' : '#ef4444'; c.fillRect(x - 5 + i, y - 5 - pts[i], 1, 1); }
    });
    this.furn.sort((a, b) => a.depth - b.depth);
  }
  drawMonitor(c, ch, t) {
    const d = ch.desk; const [x0, y0, x1, y1] = d.box;
    const mx = d.wall === 'L' ? x0 + 0.25 : (x0 + x1) / 2, my = d.wall === 'L' ? (y0 + y1) / 2 : y0 + 0.25;
    const [x, y] = this.iso(mx, my, 8);
    c.fillStyle = '#0f1020'; c.fillRect(x - 6, y - 10, 12, 9);
    c.fillStyle = '#272a3d'; c.fillRect(x - 1, y - 1, 2, 2); c.fillRect(x - 3, y, 6, 1);
    const on = !ch.locked;
    c.fillStyle = on ? '#071226' : '#15151c'; c.fillRect(x - 5, y - 9, 10, 7);
    if (!on) { // padlock
      c.fillStyle = '#9ca3af'; c.fillRect(x - 2, y - 6, 4, 3); c.fillRect(x - 1, y - 8, 1, 2); c.fillRect(x + 1, y - 8, 1, 2); c.fillRect(x - 1, y - 8, 3, 1);
      return;
    }
    const col = ch.color || '#38bdf8', kind = ch.mon || 'chart';
    if (kind === 'chart' || kind === 'quant') {
      for (let i = 0; i < 10; i++) { const v = Math.round(Math.sin(t * 2 + i * 0.8 + ch.gx) * 2 + Math.sin(i * 2.1) * 1); c.fillStyle = col; c.fillRect(x - 5 + i, y - 5 - v, 1, 1); }
    } else if (kind === 'text') {
      for (let r = 0; r < 3; r++) { const w = 3 + ((Math.floor(t * 2) + r * 3 + ch.gy * 2) % 6); c.fillStyle = r === 0 ? col : '#64748b'; c.fillRect(x - 4, y - 8 + r * 2, w, 1); }
    } else if (kind === 'bars') {
      for (let i = 0; i < 5; i++) { const h = 1 + Math.round((Math.sin(t * 1.5 + i) + 1) * 2); c.fillStyle = i % 2 ? col : PX.shade(col, -0.3); c.fillRect(x - 4 + i * 2, y - 3 - h, 1, h); }
    } else if (kind === 'candles') {
      for (let i = 0; i < 5; i++) { const up = Math.sin(t + i * 1.7) > 0; const h = 2 + (i % 3); c.fillStyle = up ? '#22c55e' : '#ef4444'; c.fillRect(x - 4 + i * 2, y - 7 + (i % 2), 1, h); }
    } else if (kind === 'radar') {
      const a = t * 3; c.fillStyle = '#14532d'; c.fillRect(x - 3, y - 8, 7, 5); c.fillStyle = col; c.fillRect(x + Math.round(Math.cos(a) * 2), y - 6 + Math.round(Math.sin(a) * 1.5), 1, 1);
    } else if (kind === 'down') {
      for (let i = 0; i < 10; i++) { c.fillStyle = col; c.fillRect(x - 5 + i, y - 8 + Math.floor(i * 0.55) + Math.round(Math.sin(t * 3 + i)), 1, 1); }
    }
    if (Math.sin(t * 9 + ch.gy) > 0.97) { c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(x - 5, y - 9, 10, 7); }
  }
  drawHolo(c, t) {
    const act = this.holo;
    const [x, y] = this.iso(5.2, 5.2, act ? 24 : 9);
    if (act) { c.globalAlpha = 0.18; c.fillStyle = '#5eead4'; const [bx, by] = this.iso(5.2, 5.2, 9); PX.poly(c, [[bx - 2, by], [bx + 2, by], [x + 1, y], [x - 1, y]], '#5eead4'); c.globalAlpha = 1; c.fillStyle = 'rgba(6,20,32,0.82)'; c.fillRect(x - 12, y - 21, 24, 18); c.fillStyle = '#5eead4'; c.fillRect(x - 12, y - 21, 24, 1); c.fillRect(x - 12, y - 4, 24, 1); }
    const a = act ? 0.9 : 0.35;
    c.globalAlpha = a * 0.25; c.fillStyle = '#5eead4';
    if (!act) PX.poly(c, [[x - 10, y], [x + 10, y], [x + 6, y - 22], [x - 6, y - 22]], '#5eead4');
    c.globalAlpha = a;
    if (act && act.series) {
      const s = act.series, n = s.length; let mn = Infinity, mx = -Infinity; for (const v of s) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
      const w = 18, h = 12, k = Math.min(n, Math.floor((t * 20) % (n + 30)));
      for (let i = 0; i < Math.min(k, n); i++) { const px = x - 9 + Math.round(i / (n - 1) * w), py = y - 6 - Math.round((s[i] - mn) / (mx - mn || 1) * h); c.fillStyle = act.up ? '#4ade80' : '#f87171'; c.fillRect(px, py, 1, 1); }
      if (act.label) { const w2 = PX.textW(act.label); c.fillStyle = '#0b1324'; c.fillRect(x - Math.ceil(w2 / 2) - 1, y - 30, w2 + 2, 7); PX.text(c, act.label, x - Math.ceil(w2 / 2), y - 29, '#a5f3fc'); }
    } else {
      const r = 5 + Math.sin(t * 2) * 1; c.fillStyle = '#5eead4';
      for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2 + t; c.fillRect(x + Math.round(Math.cos(an) * r), y - 10 + Math.round(Math.sin(an) * r * 0.5), 1, 1); }
    }
    c.globalAlpha = 1;
  }
  drawSky(c, t) {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const night = h < 6 || h > 19.5, dusk = (h >= 6 && h < 8) || (h > 17 && h <= 19.5);
    const top = night ? '#0b1030' : dusk ? '#3b2a6b' : '#3a7bd5', bot = night ? '#1b1f4a' : dusk ? '#f0826b' : '#9fd3ff';
    for (const w of this.windows) {
      for (let gy = w.a; gy < w.b; gy += 0.125) {
        const [x, y0] = this.iso(0, gy, 38); const [, y1] = this.iso(0, gy, 14);
        const grd = c.createLinearGradient(0, y0, 0, y1); grd.addColorStop(0, top); grd.addColorStop(1, bot);
        c.fillStyle = grd; c.fillRect(x, y0 + 1, 1, y1 - y0 - 1);
        const bh = 4 + Math.floor((Math.sin(gy * 7.3) + 1) * 4 + (Math.sin(gy * 2.1) + 1) * 3);
        c.fillStyle = night ? '#0a0c1c' : dusk ? '#2a1f45' : '#4b6a9a';
        c.fillRect(x, y1 - bh, 1, bh);
        if ((night || dusk) && Math.sin(gy * 31) > 0.3) { const ly = y1 - 2 - Math.floor((Math.sin(gy * 13) + 1) * (bh - 3) / 2); if (Math.sin(t * 0.7 + gy * 9) > -0.6) { c.fillStyle = '#ffd86b'; c.fillRect(x, ly, 1, 1); } }
      }
      // mullion
      const m = (w.a + w.b) / 2; const [mx, my0] = this.iso(0, m, 38); const [, my1] = this.iso(0, m, 14);
      c.fillStyle = '#141026'; c.fillRect(mx, my0, 1, my1 - my0);
    }
    if (night) { c.fillStyle = '#fff7d6'; const [x, y] = this.iso(0, 8.2, 34); c.fillRect(x, y, 2, 2); }
  }
  drawBoard(c, t) {
    const b = this.board, items = this.tickerItems;
    // project board as sheared strip along the right wall: draw text column by column
    const len = b.b - b.a, pxLen = len * 8; // horizontal pixels
    if (!this._bt || this._btKey !== items.map(i => i.t).join()) {
      // pre-render a flat strip
      let s = items.length ? items : [{ t: 'BULLPEN TRADING FLOOR  ·  ASK THE ANALYSTS', c: '#fbbf24' }];
      const parts = s.map(i => ({ t: i.t + '   ', c: i.c }));
      const w = parts.reduce((a, p) => a + PX.textW(p.t) + 4, 0) + 8;
      const st = PX.canvas(Math.max(w, 10), 5); const sc = st.getContext('2d'); let xx = 0;
      for (const p of parts) { PX.text(sc, p.t, xx, 0, p.c); xx += PX.textW(p.t) + 4; }
      this._bt = st; this._btKey = items.map(i => i.t).join();
    }
    const st = this._bt, off = Math.floor(t * 18) % st.width;
    for (let i = 0; i < pxLen; i++) {
      const gx = b.a + i / 8; const [x, y] = this.iso(gx, 0, 36);
      const srcX = (off + i) % st.width;
      c.drawImage(st, srcX, 0, 1, 5, x, y, 1, 5);
    }
    // second row: static label
    for (let i = 0; i < pxLen; i += 2) { const [x, y] = this.iso(b.a + i / 8, 0, 27); c.fillStyle = (i / 2 + Math.floor(t * 4)) % 9 === 0 ? '#22d3ee' : '#0e2a33'; c.fillRect(x, y, 1, 1); }
  }
  // ------------------------------------------------------------ movement API
  goTo(id, pts) { const c = this.chars.get(id); if (!c || c.locked) return Promise.resolve(); if (c.onArrive) { const f = c.onArrive; c.onArrive = null; f(); } c.path = pts.map(p => [p[0], p[1]]); c.state = 'walk'; return new Promise(r => { c.onArrive = r; }); }
  gather(order, spots) {
    const ps = [];
    order.forEach((id, i) => {
      const c = this.chars.get(id); if (!c) return;
      const sp = spots[i];
      const route = [c.out, [sp[0], sp[1]]];
      ps.push(new Promise(res => setTimeout(() => this.goTo(id, route).then(() => { c.face = sp[2]; res(); }), i * 180)));
    });
    return Promise.all(ps);
  }
  dismiss(ids) {
    return Promise.all(ids.map((id, i) => new Promise(res => setTimeout(() => {
      const c = this.chars.get(id); if (!c) return res();
      this.bubbles.delete(id);
      this.goTo(id, [c.out, c.seat]).then(() => { c.state = 'type'; c.face = null; res(); });
    }, i * 120))));
  }
  say(id, txt) { const c = this.chars.get(id); if (!c) return; this.bubbles.set(id, { txt: (txt || '...').toUpperCase().slice(0, 14), t: this.T }); c.state = 'talk'; this.spot = id; }
  quiet(id) { const c = this.chars.get(id); this.bubbles.delete(id); if (c && c.state === 'talk') c.state = 'stand'; if (this.spot === id) this.spot = null; }
  cheer(ids) { for (const id of ids) { const c = this.chars.get(id); if (c && !c.path.length) { c.state = 'cheer'; setTimeout(() => { if (c.state === 'cheer') c.state = 'stand'; }, 1600); } } }
  burst(gx, gy, n = 40) { for (let i = 0; i < n; i++) this.fx.push({ gx, gy, z: 14, vx: (Math.random() - .5) * 2.4, vy: (Math.random() - .5) * 2.4, vz: 30 + Math.random() * 40, col: ['#fbbf24', '#22c55e', '#38bdf8', '#f472b6', '#a78bfa'][i % 5], life: 1.6 + Math.random() }); }
  float(gx, gy, txt, col) { this.fx.push({ kind: 'txt', gx, gy, z: 30, txt, col: col || '#fde047', life: 1.8 }); }
  onClick(e) {
    const r = this.cv.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * this.W, y = (e.clientY - r.top) / r.height * this.H;
    let best = null, bd = 14;
    for (const c of this.chars.values()) { const [sx, sy] = this.iso(c.gx, c.gy); const d = Math.hypot(sx - x, sy - 12 - y); if (d < bd) { bd = d; best = c; } }
    if (best && this.onCharClick) this.onCharClick(best.id);
  }
  // ------------------------------------------------------------ loop
  start() { if (this.running) return; this.running = true; this.last = performance.now(); const loop = (now) => { if (!this.running) return; const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.step(dt); this.render(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  stop() { this.running = false; }
  step(dt) {
    this.T += dt;
    for (const c of this.chars.values()) {
      c.ft += dt;
      c.blinkT -= dt; if (c.blinkT < -0.12) c.blinkT = 2 + Math.random() * 4;
      if (c.path.length) {
        const [tx, ty] = c.path[0]; const dx = tx - c.gx, dy = ty - c.gy, d = Math.hypot(dx, dy);
        const sp = 2.6 * dt * (c.fast || 1);
        const sx = (dx - dy), sy = (dx + dy);
        c.flip = sx < 0; c.view = sy < 0 ? 'back' : 'front';
        if (d <= sp) { c.gx = tx; c.gy = ty; c.path.shift(); if (!c.path.length) { c.state = 'stand'; c.view = 'front'; const f = c.onArrive; c.onArrive = null; f && f(); } }
        else { c.gx += dx / d * sp; c.gy += dy / d * sp; }
        if (c.ft > 0.11) { c.ft = 0; c.frame = (c.frame + 1) % 4; }
      } else if (c.ft > (c.state === 'type' ? 0.16 : c.state === 'talk' ? 0.14 : 0.4)) { c.ft = 0; c.frame = (c.frame + 1) % 4; }
      if (!c.path.length && c.face) { c.flip = c.face < 0; }
    }
    // cat wanders
    if (this.decor.has('cat')) {
      const k = this.cat || (this.cat = { gx: 8.5, gy: 3, tx: 8, ty: 4, f: 0, ft: 0, wait: 0 });
      if (k.wait > 0) k.wait -= dt; else {
        const dx = k.tx - k.gx, dy = k.ty - k.gy, d = Math.hypot(dx, dy);
        if (d < 0.05) { k.wait = 1 + Math.random() * 4; const spots = [[8.5, 3], [7, 6.8], [3, 8.5], [2.8, 3], [9, 9], [6.8, 2.4]]; const s = spots[Math.floor(Math.random() * spots.length)]; k.tx = s[0]; k.ty = s[1]; }
        else { const sp = 1.2 * dt; k.gx += dx / d * Math.min(sp, d); k.gy += dy / d * Math.min(sp, d); k.flip = (dx - dy) < 0; }
        k.ft += dt; if (k.ft > 0.15) { k.ft = 0; k.f = (k.f + 1) % 2; }
      }
    }
    this.fx = this.fx.filter(p => (p.life -= dt) > 0);
    for (const p of this.fx) { if (p.kind === 'txt') { p.z += 14 * dt; continue; } p.gx += p.vx * dt; p.gy += p.vy * dt; p.z += p.vz * dt; p.vz -= 90 * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; } }
  }
  render() {
    if (!this.static) this.buildStatic();
    const c = this.buf.getContext('2d'), W = this.W, H = this.H, t = this.T;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.static, 0, 0);
    this.drawSky(c, t);
    this.drawBoard(c, t);
    // ceiling light pools
    c.globalAlpha = 0.07 + 0.01 * Math.sin(t * 2);
    for (const [gx, gy] of [[5.2, 5.2], [2.5, 6], [6, 2.5], [8, 8]]) { const [x, y] = this.iso(gx, gy); c.fillStyle = '#c7d2fe'; for (let r = 18; r > 4; r -= 5) { c.fillRect(x - r, y - r / 2, r * 2, r); } }
    c.globalAlpha = 1;
    // spotlight on speaker
    if (this.spot && this.chars.get(this.spot)) {
      const s = this.chars.get(this.spot); const [x, y] = this.iso(s.gx, s.gy);
      c.globalAlpha = 0.22; c.fillStyle = s.color || '#fff'; PX.poly(c, [[x - 9, y + 2], [x + 9, y + 2], [x + 3, y - 60], [x - 3, y - 60]], s.color || '#fff'); c.globalAlpha = 0.35;
      PX.poly(c, [[x - 9, y], [x, y - 4], [x + 9, y], [x, y + 4]], s.color || '#fff'); c.globalAlpha = 1;
    }
    // depth-sorted drawables
    const list = this.furn.map(f => ({ d: f.depth, f }));
    for (const ch of this.chars.values()) list.push({ d: ch.gx + ch.gy, ch });
    if (this.decor.has('cat') && this.cat) list.push({ d: this.cat.gx + this.cat.gy, cat: this.cat });
    list.sort((a, b) => a.d - b.d);
    for (const it of list) {
      if (it.f) { if (it.f.cv) c.drawImage(it.f.cv, 0, 0); else it.f.fn(c, t); }
      else if (it.ch) this.drawChar(c, it.ch, t);
      else if (it.cat) this.drawCat(c, it.cat);
    }
    // bubbles
    for (const [id, b] of this.bubbles) { const ch = this.chars.get(id); if (ch) this.drawBubble(c, ch, b, t); }
    // particles
    for (const p of this.fx) {
      const [x, y] = this.iso(p.gx, p.gy, p.z);
      if (p.kind === 'txt') { c.globalAlpha = Math.min(1, p.life); const w = PX.textW(p.txt); PX.text(c, p.txt, x - (w >> 1) + 1, y + 1, '#000'); PX.text(c, p.txt, x - (w >> 1), y, p.col); c.globalAlpha = 1; }
      else { c.fillStyle = p.col; c.fillRect(x, y, 1 + (p.life > 1 ? 1 : 0), 1); }
    }
    // vignette
    const ctx = this.ctx; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buf, 0, 0, W * this.scale, H * this.scale);
  }
  drawChar(c, ch, t) {
    const seated = !ch.path.length && (ch.state === 'type') && Math.hypot(ch.gx - ch.seat[0], ch.gy - ch.seat[1]) < 0.05;
    const view = seated ? (ch.back ? 'back' : 'front') : ch.view;
    let state = seated ? 'type' : ch.state;
    if (ch.locked) state = 'stand';
    const mouth = state === 'talk' && (ch.frame % 2 === 0);
    const spr = PX.sprite(ch.id, ch.look, { view, state, frame: ch.frame, blink: ch.blinkT < 0, mouth });
    const [x, y] = this.iso(ch.gx, ch.gy);
    // shadow
    c.globalAlpha = 0.35; c.fillStyle = '#000'; c.fillRect(Math.round(x) - 5, Math.round(y) - 1, 10, 2); c.fillRect(Math.round(x) - 3, Math.round(y) - 2, 6, 4); c.globalAlpha = 1;
    if (ch.locked) { c.globalAlpha = 0.0; }
    const bounce = state === 'talk' ? -((ch.frame % 2)) : 0;
    const dy = seated ? 5 : 0;
    c.save();
    if (ch.flip && !seated) { c.translate(Math.round(x), 0); c.scale(-1, 1); c.drawImage(spr, -8, Math.round(y) - PX.SH + 1 + dy + bounce); }
    else c.drawImage(spr, Math.round(x) - 8, Math.round(y) - PX.SH + 1 + dy + bounce);
    c.restore();
    c.globalAlpha = 1;
    if (ch.alert) { const [ax, ay] = [Math.round(x), Math.round(y) - PX.SH - 6]; if (Math.floor(t * 4) % 2) { c.fillStyle = '#ef4444'; c.fillRect(ax - 2, ay - 1, 5, 8); PX.text(c, '!', ax - 1, ay, '#fff'); } }
  }
  drawCat(c, k) {
    const [x, y] = this.iso(k.gx, k.gy); const X = Math.round(x), Y = Math.round(y);
    const cv = PX.canvas(12, 8), q = cv.getContext('2d');
    q.fillStyle = '#f59e0b'; q.fillRect(2, 3, 7, 3); q.fillRect(8, 1, 3, 3); q.fillRect(8, 0, 1, 1); q.fillRect(10, 0, 1, 1);
    q.fillStyle = '#b45309'; q.fillRect(4, 3, 1, 3); q.fillRect(6, 3, 1, 3);
    q.fillRect(1, 2 - k.f, 1, 2); q.fillRect(0, 1 - k.f, 1, 1);
    q.fillStyle = '#f59e0b'; q.fillRect(2 + k.f, 6, 1, 1); q.fillRect(7 - k.f, 6, 1, 1);
    q.fillStyle = '#111'; q.fillRect(9, 2, 1, 1);
    PX.outline(cv);
    c.save(); if (k.flip) { c.translate(X, 0); c.scale(-1, 1); c.drawImage(cv, -6, Y - 8); } else c.drawImage(cv, X - 6, Y - 8); c.restore();
  }
  drawBubble(c, ch, b, t) {
    const [x, y] = this.iso(ch.gx, ch.gy);
    const txt = b.txt; const n = Math.min(txt.length, Math.floor((t - b.t) * 24) + 1);
    const s = txt.slice(0, n); const w = Math.max(PX.textW(txt), 7) + 6, h = 11;
    let bx = Math.round(x - w / 2), by = Math.round(y - PX.SH - h - 4);
    bx = Math.max(1, Math.min(this.W - w - 1, bx)); by = Math.max(1, by);
    c.fillStyle = PX.OUT; c.fillRect(bx - 1, by, w + 2, h); c.fillRect(bx, by - 1, w, h + 2);
    c.fillStyle = '#fbfaff'; c.fillRect(bx, by, w, h);
    c.fillStyle = ch.color || '#38bdf8'; c.fillRect(bx, by + h - 2, w, 2);
    const tx = Math.max(bx + 2, Math.min(bx + w - 4, Math.round(x) - 1));
    c.fillStyle = PX.OUT; c.fillRect(tx - 1, by + h + 1, 4, 1); c.fillRect(tx, by + h + 2, 2, 1); c.fillStyle = '#fbfaff'; c.fillRect(tx, by + h, 2, 1); c.fillRect(tx, by + h + 1, 2, 1);
    PX.text(c, s, bx + 3, by + 2, '#1b1530');
  }
}
