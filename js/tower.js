/* Blackrock Tower: vector isometric cutaway building. Floors stack upward; bots walk, type, ride the lift and present. */
'use strict';
const TW = { FW: 10, FD: 4.5, FH: 7, SLAB: 0.3, LANE: 3.3, DOOR: [9.7, 3.3], SHAFT: [10.75, 3.3], CX: 0.8660254 };
const FLOORS = [
  { id: 'lobby', name: 'Lobby', short: 'L', rooms: [{ key: 'lobby', name: 'Lobby', x0: 0, x1: 5, theme: 'lobby' }, { key: 'you', name: 'Your desk', x0: 5, x1: 10, theme: 'you' }] },
  { id: 'research', name: 'Research', short: '1', rooms: [{ key: 'chart', name: 'Charts', x0: 0, x1: 5, theme: 'chart' }, { key: 'quant', name: 'Quant lab', x0: 5, x1: 10, theme: 'quant' }] },
  { id: 'fund', name: 'Fundamentals', short: '2', rooms: [{ key: 'bars', name: 'Accounts', x0: 0, x1: 5, theme: 'bars' }, { key: 'candles', name: 'Crypto desk', x0: 5, x1: 10, theme: 'candles' }] },
  { id: 'news', name: 'Newsroom', short: '3', rooms: [{ key: 'news', name: 'Newsroom', x0: 0, x1: 5, theme: 'news' }, { key: 'macro', name: 'Macro desk', x0: 5, x1: 10, theme: 'macro' }] },
  { id: 'vault', name: 'Vault & Risk', short: '4', rooms: [{ key: 'vault', name: 'Insider vault', x0: 0, x1: 5, theme: 'vault' }, { key: 'risk', name: 'Risk room', x0: 5, x1: 10, theme: 'risk' }] },
  { id: 'trading', name: 'Trading floor', short: '5', rooms: [{ key: 'earnings', name: 'Earnings room', x0: 0, x1: 5, theme: 'earnings' }, { key: 'trading', name: 'Trading desk', x0: 5, x1: 10, theme: 'trading' }] },
  { id: 'ph', name: 'Penthouse', short: 'PH', rooms: [{ key: 'ph', name: 'Penthouse', x0: 0, x1: 10, theme: 'ph' }] }
];
const THEMES = {
  lobby: { floor: '#e8dccb', accent: '#f59e0b', rug: '#f3cfae' }, you: { floor: '#e6e0d5', accent: '#34d399', rug: '#c4ead9' },
  chart: { floor: '#dde7f0', accent: '#38bdf8', rug: '#c9e4f6' }, quant: { floor: '#e8e1f2', accent: '#c084fc', rug: '#e2d2f7' },
  bars: { floor: '#dfeadf', accent: '#22c55e', rug: '#cdebd3' }, candles: { floor: '#f0e5d8', accent: '#f97316', rug: '#f8d5b8' },
  news: { floor: '#f1e6da', accent: '#f59e0b', rug: '#f6dcb0' }, macro: { floor: '#dee5f2', accent: '#60a5fa', rug: '#cfdcf6' },
  vault: { floor: '#d9dce5', accent: '#94a3b8', rug: '#cfd5e2' }, risk: { floor: '#f2e0e2', accent: '#f43f5e', rug: '#f7cdd3' },
  earnings: { floor: '#e6e2f3', accent: '#a78bfa', rug: '#ddd3f6' }, trading: { floor: '#dfecee', accent: '#14b8a6', rug: '#c5e8e4' },
  ph: { floor: '#2d2839', accent: '#fbbf24', rug: '#463b62', dark: true }
};
class Tower {
  constructor(cv) {
    this.cv = cv; this.c = cv.getContext('2d'); this.T = 0; this.running = false;
    this.bots = new Map(); this.unl = new Set(); this.locks = {}; this.ticker = []; this.holo = null;
    this.zoom = 1; this.cam = { x: 2.4, y: 2.6 }; this.camT = { x: 2.4, y: 2.6 }; this.followId = null; this.hold = 0; this.curF = 0;
    this.pad = { l: 0, r: 0, t: 0, b: 0 }; this.fy = 0.42; this.land = false;
    this.ptrs = new Map(); this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(cv.parentElement);
    this.bindInput();
  }
  // ------------------------------------------------------------ layout & camera
  setLayout(o) { Object.assign(this.pad, o.pad || {}); this.land = !!o.land; this.fy = o.fy || 0.42; this.resize(); }
  resize() {
    const p = this.cv.parentElement; const vw = p.clientWidth || 380, vh = p.clientHeight || 520; const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.vw = vw; this.vh = vh; this.dpr = dpr; this.cv.width = Math.round(vw * dpr); this.cv.height = Math.round(vh * dpr);
    this.cv.style.width = vw + 'px'; this.cv.style.height = vh + 'px';
    const uw = Math.max(200, vw - this.pad.l - this.pad.r), uh = Math.max(200, vh - this.pad.t - this.pad.b);
    this.fit = Math.min(uw * 0.94 / 12.9, this.land ? uh / (TW.FH * 2.25) : uh / (TW.FH * 1.55));
    this.ox = this.pad.l + uw / 2; this.oy = this.pad.t + uh * this.fy;
    if (!this.running) this.render();
  }
  get S() { return this.fit * this.zoom; }
  p(f, gx, gy, z = 0) { const S = this.S; return [((gx - gy) * TW.CX - this.cam.x) * S + this.ox, ((gx + gy) * 0.5 - z - f * TW.FH - this.cam.y) * S + this.oy]; }
  floorY(f) { return 2.3 - f * TW.FH; }
  focusFloor(f, hard) { this.followId = null; this.camT.y = this.floorY(f); this.camT.x = 2.4; if (hard) { this.cam.y = this.camT.y; this.cam.x = this.camT.x; } this.hold = 0; }
  follow(id) { this.followId = id; this.hold = 0; }
  clampCam() {
    const S = this.S; const top = -(FLOORS.length * TW.FH) - 3.5, bot = 9;
    const minY = top + (this.oy - this.pad.t) / S, maxY = bot - (this.vh - this.oy) / S;
    const cl = (v, a, b) => a > b ? (a + b) / 2 : Math.max(a, Math.min(b, v));
    this.camT.y = cl(this.camT.y, minY, maxY); this.cam.y = cl(this.cam.y, minY - 2, maxY + 2);
    const span = Math.max(0, 12.9 - (this.vw - this.pad.l - this.pad.r) / S) / 2 + 1;
    this.camT.x = Math.max(2.4 - span, Math.min(2.4 + span, this.camT.x));
  }
  bindInput() {
    const cv = this.cv; let moved = 0, start = null, pinch = null;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); this.ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; start = [e.clientX, e.clientY]; if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: this.zoom }; } });
    cv.addEventListener('pointermove', e => {
      if (!this.ptrs.has(e.pointerId)) return; const prev = this.ptrs.get(e.pointerId); const dx = e.clientX - prev[0], dy = e.clientY - prev[1]; this.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      this.hold = this.T + 5; this.followId = this.followId; moved += Math.abs(dx) + Math.abs(dy);
      if (this.ptrs.size === 2 && pinch) { const [a, b] = [...this.ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); this.setZoom(pinch.z * d / pinch.d); return; }
      if (this.ptrs.size === 1) { const S = this.S; this.camT.x -= dx / S; this.camT.y -= dy / S; this.cam.x -= dx / S; this.cam.y -= dy / S; }
    });
    const up = e => { const had = this.ptrs.has(e.pointerId); this.ptrs.delete(e.pointerId); if (this.ptrs.size < 2) pinch = null; if (had && moved < 8 && start) this.tap(e); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { this.ptrs.delete(e.pointerId); pinch = null; });
    cv.addEventListener('wheel', e => { e.preventDefault(); if (e.ctrlKey) this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.01)); else { this.camT.y += e.deltaY / this.S; this.camT.x += e.deltaX / this.S; } this.hold = this.T + 5; }, { passive: false });
  }
  setZoom(z) { this.zoom = Math.max(0.7, Math.min(2.6, z)); this.hold = this.T + 5; }
  tap(e) {
    const r = this.cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; let best = null, bd = 1e9;
    for (const b of this.bots.values()) { if (b.hidden) continue; const [sx, sy] = this.p(b.fz, b.gx, b.gy, 0); const S = this.S; if (x > sx - 0.45 * S && x < sx + 0.45 * S && y > sy - 1.45 * S && y < sy + 0.1 * S) { const d = Math.abs(sy - 0.6 * S - y); if (d < bd) { bd = d; best = b; } } }
    if (best && this.onBotTap) this.onBotTap(best.id);
  }
  // ------------------------------------------------------------ roster & state
  setBots(list) {
    const keep = new Set(list.map(b => b.id)); for (const k of [...this.bots.keys()]) if (!keep.has(k)) this.bots.delete(k);
    for (const a of list) {
      let b = this.bots.get(a.id);
      if (!b) { b = { id: a.id, f: a.home.f, fz: a.home.f, gx: a.home.gx, gy: a.home.gy, path: [], state: a.home.pose || 'type', phase: Math.random() * 6, blinkT: 2 + Math.random() * 3, out: a.home.via ? [...a.home.via].reverse() : null }; this.bots.set(a.id, b); }
      Object.assign(b, { name: a.name, color: a.color, eye: a.eye, home: a.home, hidden: !!a.hidden });
    }
  }
  setUnlocks(set, locks) { this.unl = new Set(set); this.locks = locks || {}; }
  setTicker(items) { this.ticker = items || []; }
  say(id, txt) { const b = this.bots.get(id); if (!b) return; b.say = txt; if (!b.path.length) b.state = 'talk'; }
  quiet(id) { const b = this.bots.get(id); if (!b) return; b.say = null; if (b.state === 'talk') b.state = 'stand'; }
  needs(id, txt) { const b = this.bots.get(id); if (b) b.needs = txt || null; }
  place(id, d) { const b = this.bots.get(id); if (!b) return; this.cancel(b); b.f = b.fz = d.f; b.gx = d.gx; b.gy = d.gy; b.state = d.pose || 'stand'; b.back = !!d.back; b.look = 0; b.out = d.via ? [...d.via].reverse() : null; }
  cancel(b) { b.path = []; if (b.onArrive) { const f = b.onArrive; b.onArrive = null; f(false); } }
  isHome(id) { const b = this.bots.get(id); return b && !b.path.length && b.f === b.home.f && Math.abs(b.gx - b.home.gx) < 0.05 && Math.abs(b.gy - b.home.gy) < 0.05; }
  isAt(id, d) { const b = this.bots.get(id); return b && !b.path.length && b.f === d.f && Math.abs(b.gx - d.gx) < 0.05 && Math.abs(b.gy - d.gy) < 0.05; }
  goHome(id, fast) { const b = this.bots.get(id); return b ? this.walk(id, b.home, fast) : Promise.resolve(); }
  walk(id, d, fast) {
    const b = this.bots.get(id); if (!b || b.hidden) return Promise.resolve(false);
    this.cancel(b);
    const L = TW.LANE, pts = [...(b.out || [])]; b.out = null;
    const inShaft = b.gx > 10.05; const via = d.via || [];
    const first = via[0] || [d.gx, d.gy];
    if (inShaft || d.f !== b.f) {
      if (!inShaft) { const cur = pts.length ? pts[pts.length - 1] : [b.gx, b.gy]; pts.push([cur[0], L], [TW.DOOR[0], L]); }
      pts.push([TW.SHAFT[0], TW.SHAFT[1]], { ride: d.f }, [TW.DOOR[0], L], [first[0], L]);
    } else {
      const cur = pts.length ? pts[pts.length - 1] : [b.gx, b.gy];
      const sameSpot = Math.hypot(cur[0] - first[0], cur[1] - first[1]) < 1.2 && Math.abs(cur[1] - L) > 0.6 && Math.abs(first[1] - L) > 0.6 && Math.abs(cur[0] - first[0]) < 0.6;
      if (!sameSpot) pts.push([cur[0], L], [first[0], L]);
    }
    pts.push(...via, [d.gx, d.gy]);
    b.path = pts; b.fast = fast || 1; b.dest = d; b.state = 'walk';
    return new Promise(r => { b.onArrive = r; });
  }
  stats() { let moving = 0, working = 0, idle = 0; for (const b of this.bots.values()) { if (b.hidden || b.id === 'you') continue; if (b.path.length) moving++; else if (b.state === 'type' || b.state === 'talk') working++; else idle++; } return { moving, working, idle }; }
  // ------------------------------------------------------------ loop
  start() { if (this.running) return; this.running = true; this.last = performance.now(); const loop = now => { if (!this.running) return; const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.step(dt); this.render(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  stop() { this.running = false; }
  step(dt) {
    this.T += dt;
    for (const b of this.bots.values()) {
      b.blinkT -= dt; if (b.blinkT < -0.13) b.blinkT = 2 + Math.random() * 4;
      if (!b.path.length) { b.fz = b.f; continue; }
      const n = b.path[0];
      if (n.ride != null) {
        const d = n.ride - b.fz, sp = 1.25 * dt * Math.min(1.6, b.fast || 1); b.state = 'ride';
        if (Math.abs(d) <= sp) { b.fz = b.f = n.ride; b.path.shift(); } else b.fz += Math.sign(d) * sp;
        continue;
      }
      const dx = n[0] - b.gx, dy = n[1] - b.gy, d = Math.hypot(dx, dy), sp = 1.9 * dt * (b.fast || 1);
      if (d > 0.001) { b.look = Math.max(-1, Math.min(1, (dx - dy) / (d * 1.2))); b.back = (dx + dy) < -0.1 * d; }
      b.state = 'walk';
      if (d <= sp) {
        b.gx = n[0]; b.gy = n[1]; b.path.shift();
        if (!b.path.length) { const dd = b.dest || {}; b.state = dd.pose || 'stand'; b.back = !!dd.back; b.look = dd.look || 0; b.out = dd.via ? [...dd.via].reverse() : null; const f = b.onArrive; b.onArrive = null; f && f(true); }
      } else { b.gx += dx / d * sp; b.gy += dy / d * sp; }
    }
    // camera
    if (this.T > this.hold) {
      const fb = this.followId && this.bots.get(this.followId);
      if (fb) { this.camT.y = (fb.gx + fb.gy) * 0.5 - fb.fz * TW.FH - 1.2; this.camT.x = this.zoom > 1.15 ? (fb.gx - fb.gy) * TW.CX : 2.4; }
    }
    this.clampCam();
    const k = this.reduce ? 1 : 1 - Math.pow(0.0025, dt);
    this.cam.x += (this.camT.x - this.cam.x) * k; this.cam.y += (this.camT.y - this.cam.y) * k;
    const f = Math.round((2.3 - this.cam.y) / TW.FH); const cf = Math.max(0, Math.min(FLOORS.length - 1, f));
    if (cf !== this.curF) { this.curF = cf; this.onFloor && this.onFloor(cf); }
  }
  // ------------------------------------------------------------ primitives
  poly(pts, fill, stroke, lw) { const c = this.c; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); } }
  box(f, x0, y0, x1, y1, z0, h, col, o = {}) {
    const P = (a, b, z) => this.p(f, a, b, z), z1 = z0 + h;
    this.poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], o.l || BOT.shade(col, -0.1));
    this.poly([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], o.r || BOT.shade(col, -0.22));
    this.poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], o.t || col, o.edge, 1);
  }
  isoEllipse(f, cx, cy, rx, ry, z, n = 32) { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push(this.p(f, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, z)); } return pts; }
  plane(f, gx, gy, z, axis) { const S = this.S, d = this.dpr, [sx, sy] = this.p(f, gx, gy, z); if (axis === 'x') this.c.setTransform(d * TW.CX * S, d * 0.5 * S, 0, d * S, d * sx, d * sy); else this.c.setTransform(-d * TW.CX * S, d * 0.5 * S, 0, d * S, d * sx, d * sy); }
  reset() { this.c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }
  rr(x, y, w, h, r) { BOT.rr(this.c, x, y, w, h, r); }
  sky() {
    if (!this._sky || this.T - this._skyT > 60) { this._skyT = this.T; const h = +new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23' }); this._sky = h >= 8 && h < 16 ? ['#8ec5f2', '#d9ecfb', 0] : h >= 6 && h < 8 || h >= 16 && h < 18 ? ['#f6a5c0', '#fcd9a8', 0.4] : ['#1b1d47', '#3b3a78', 1]; }
    return this._sky;
  }
  // ------------------------------------------------------------ render
  render() {
    const c = this.c, S = this.S; this.reset(); c.clearRect(0, 0, this.vw, this.vh);
    this.drawGround();
    const N = FLOORS.length; this.overlay = [];
    for (let f = 0; f < N; f++) {
      const top = this.p(f, 0, 0, TW.FH)[1], bot = this.p(f, TW.FW, TW.FD, -TW.SLAB - 1)[1];
      if (bot < -40 || top > this.vh + 40) continue;
      this.drawFloor(f);
    }
    this.drawRoof(N);
    this.drawShaft(N);
    this.drawOverlay();
  }
  drawGround() {
    const c = this.c; const P = (a, b) => this.p(0, a, b, -TW.SLAB);
    if (P(0, 0)[1] - 400 > this.vh) return;
    this.poly([P(-3, -2.2), P(14, -2.2), P(14, 8.5), P(-3, 8.5)], 'rgba(255,255,255,.035)');
    this.poly([P(-1.6, -1), P(12.6, -1), P(12.6, 6.6), P(-1.6, 6.6)], 'rgba(255,255,255,.05)');
    // path to the door
    this.poly([P(3, 4.6), P(5, 4.6), P(5, 8.5), P(3, 8.5)], 'rgba(255,255,255,.05)');
    for (const [x, y] of [[-1.1, 5.8], [12, 5.6], [12, -0.4], [-1.2, 1.4]]) this.tree(0, x, y, -TW.SLAB, 1.1);
  }
  tree(f, x, y, z, s) {
    const c = this.c, [sx, sy] = this.p(f, x, y, z), S = this.S * s;
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(sx, sy, 0.45 * S, 0.17 * S, 0, 0, 7); c.fill();
    c.fillStyle = '#6b4f3a'; c.fillRect(sx - 0.05 * S, sy - 0.6 * S, 0.1 * S, 0.6 * S);
    c.fillStyle = '#2f9e62'; c.beginPath(); c.arc(sx, sy - 0.95 * S, 0.45 * S, 0, 7); c.fill();
    c.fillStyle = '#45c27c'; c.beginPath(); c.arc(sx - 0.12 * S, sy - 1.08 * S, 0.26 * S, 0, 7); c.fill();
  }
  roomLocked(r) { return this.locks[r.key] != null; }
  drawFloor(f) {
    const c = this.c, F = FLOORS[f], { FW, FD, FH, SLAB } = TW, P = (a, b, z = 0) => this.p(f, a, b, z);
    // slab
    this.poly([P(0, FD, -SLAB), P(FW, FD, -SLAB), P(FW, FD, 0), P(0, FD, 0)], '#3a3f4f');
    this.poly([P(FW, 0, -SLAB), P(FW, FD, -SLAB), P(FW, FD, 0), P(FW, 0, 0)], '#2a2e3b');
    for (const r of F.rooms) { const th = THEMES[r.theme]; this.poly([P(r.x0, 0), P(r.x1, 0), P(r.x1, FD), P(r.x0, FD)], th.floor); }
    // floor seams
    c.strokeStyle = 'rgba(0,0,0,.045)'; c.lineWidth = 1;
    for (let x = 1; x < FW; x++) { const a = P(x, 0), b = P(x, FD); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    // walls (full height; the floor above covers the top)
    const WH = FH - SLAB, RH = 3.15, sky = this.sky(), dark = F.rooms[0].theme === 'ph';
    const wl = dark ? '#3b3550' : '#f2eff7', wr = dark ? '#2f2a44' : '#e2deec';
    // structure band above the ceiling, then the room walls
    this.poly([P(0, 0, RH), P(0, FD, RH), P(0, FD, WH), P(0, 0, WH)], '#20232f');
    this.poly([P(0, 0, RH), P(FW, 0, RH), P(FW, 0, WH), P(0, 0, WH)], '#1a1d28');
    this.poly([P(0, 0, 0), P(0, FD, 0), P(0, FD, RH), P(0, 0, RH)], wl);
    this.poly([P(0, 0, 0), P(FW, 0, 0), P(FW, 0, RH), P(0, 0, RH)], wr);
    const win = (axis, len, segs) => {
      this.plane(f, 0, 0, 0, axis);
      const top = RH - 0.18, g = c.createLinearGradient(0, -top, 0, -0.8); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
      c.fillStyle = g; c.fillRect(0.15, -top, len - 0.3, top - 0.8);
      c.fillStyle = sky[2] > 0.5 ? 'rgba(20,20,50,.75)' : 'rgba(120,140,180,.35)';
      for (let i = 0; i < len * 2; i++) { const hh = 0.3 + ((i * 37 + f * 11) % 7) * 0.1; c.fillRect(0.15 + i * 0.5, -0.8 - hh, 0.42, hh); }
      if (sky[2] > 0.5) { c.fillStyle = 'rgba(253,230,138,.8)'; for (let i = 0; i < len * 3; i++) if ((i * 13 + f) % 4 === 0) c.fillRect(0.25 + i * 0.33, -1.0 - ((i * 7) % 5) * 0.09, 0.05, 0.05); }
      c.fillStyle = dark ? '#4a4366' : '#ffffff'; for (let i = 0; i <= segs; i++) c.fillRect(0.12 + i * (len - 0.3) / segs, -top, 0.06, top - 0.8);
      c.fillRect(0.12, -0.86, len - 0.24, 0.08); c.fillRect(0.12, -top - 0.04, len - 0.24, 0.08);
      c.fillStyle = dark ? '#251f36' : '#d6d1e2'; c.fillRect(0, -0.12, len, 0.12);
      // ceiling light strip
      c.fillStyle = dark ? 'rgba(251,191,36,.5)' : 'rgba(255,255,255,.9)'; c.fillRect(0, -RH, len, 0.05);
      this.reset();
    };
    win('y', FD, 3); win('x', FW, 8);
    // rooms
    for (const r of F.rooms) this.drawRoom(f, r);
    // partition between rooms
    if (F.rooms.length > 1) {
      const x = F.rooms[0].x1;
      this.poly([P(x, 0, 0), P(x, 2.4, 0), P(x, 2.4, 1.25), P(x, 0, 1.25)], 'rgba(200,220,255,.28)', 'rgba(255,255,255,.65)', 1);
    }
    // outer corner pillars
    this.box(f, -0.12, FD - 0.06, 0.06, FD + 0.12, 0, WH, '#3d4252');
    this.box(f, FW - 0.06, -0.12, FW + 0.12, 0.06, 0, WH, '#4a4f61');
  }
  drawRoom(f, r) {
    const c = this.c, th = THEMES[r.theme], cx = (r.x0 + r.x1) / 2, P = (a, b, z = 0) => this.p(f, a, b, z), t = this.T;
    const locked = this.roomLocked(r); const objs = [];
    const add = (k, d) => objs.push({ k, d });
    // rug
    if (!locked) { const rx0 = r.x0 + 0.7, rx1 = r.x1 - 0.7; this.poly([P(rx0, 2.65), P(rx1, 2.65), P(rx1, 4.05), P(rx0, 4.05)], th.rug); }
    if (locked) {
      this.poly([P(r.x0, 0), P(r.x1, 0), P(r.x1, TW.FD), P(r.x0, TW.FD)], 'rgba(28,30,44,.55)');
      // scaffold stripes on the back wall
      this.plane(f, r.x0, 0, 0, 'x'); c.fillStyle = 'rgba(251,191,36,.55)'; for (let i = 0; i < (r.x1 - r.x0) * 2; i++) { c.save(); c.translate(0.3 + i * 0.5, -0.5); c.rotate(-0.6); c.fillRect(0, 0, 0.12, 0.5); c.restore(); } this.reset();
      this.overlay.push({ kind: 'lock', f, gx: cx, gy: 2.2, txt: this.locks[r.key] });
      this.overlay.push({ kind: 'room', f, gx: cx, gy: TW.FD - 0.15, txt: r.name, dim: true });
      return;
    }
    this.overlay.push({ kind: 'room', f, gx: cx, gy: TW.FD - 0.15, txt: r.name });
    const up = this.unl;
    const big = up.has('screens');
    // wall screen
    const wallScreen = (x0, x1, kind, col) => {
      const w = x1 - x0, z1 = 2.05, z0 = big ? 0.85 : 1.05, h = z1 - z0;
      this.plane(f, x0, 0, z1, 'x');
      c.fillStyle = '#151a26'; this.rr(-0.06, -0.06, w + 0.12, h + 0.12, 0.08); c.fill();
      c.fillStyle = '#0d1220'; this.rr(0, 0, w, h, 0.05); c.fill();
      this.screenArt(kind, w, h, col, t + f);
      this.reset();
    };
    const desk = (dx, opts = {}) => {
      const w = opts.w || 0.95;
      add(dx + 1.3 - 0.01, () => { // chair behind the seat
        this.box(f, dx - 0.22, 1.05, dx + 0.22, 1.18, 0.3, 0.55, '#3f4656');
        this.box(f, dx - 0.24, 1.15, dx + 0.24, 1.55, 0.26, 0.08, '#4b5366');
      });
      add(dx + 2.12, () => {
        this.box(f, dx - w, 1.85, dx + w, 2.4, 0, 0.42, '#f4f1ec', { l: '#ddd6ca', r: '#cfc7b9' });
        // laptop (back toward camera) and a side monitor
        this.box(f, dx - 0.22, 1.98, dx + 0.22, 2.24, 0.42, 0.02, '#c9ced8');
        this.poly([P(dx - 0.22, 1.98, 0.44), P(dx + 0.22, 1.98, 0.44), P(dx + 0.22, 1.9, 0.72), P(dx - 0.22, 1.9, 0.72)], '#b8bfcc');
        const mx = dx - w + 0.1; const mw = big ? 0.75 : 0.5;
        this.box(f, mx + 0.15, 2.05, mx + 0.25, 2.15, 0.42, 0.2, '#30364a');
        this.box(f, mx, 2.0, mx + mw, 2.06, 0.62, big ? 0.48 : 0.38, '#20263a');
        this.poly([P(mx + mw, 2.0, 0.66), P(mx + mw, 2.06, 0.66), P(mx + mw, 2.06, big ? 1.06 : 0.96), P(mx + mw, 2.0, big ? 1.06 : 0.96)], th.accent);
        this.box(f, dx + w - 0.42, 2.0, dx + w - 0.18, 2.24, 0.42, 0.12, '#ffffff'); // mug
        this.poly([P(dx + w - 0.4, 2.02, 0.54), P(dx + w - 0.2, 2.02, 0.54), P(dx + w - 0.2, 2.22, 0.54), P(dx + w - 0.4, 2.22, 0.54)], '#6b4f3a');
      });
    };
    const plant = (x, y, s = 1) => add(x + y, () => {
      this.box(f, x - 0.17 * s, y - 0.17 * s, x + 0.17 * s, y + 0.17 * s, 0, 0.32 * s, '#ece7df');
      const [sx, sy] = P(x, y, 0.32 * s), S = this.S * s; c.fillStyle = '#2f9e62'; c.beginPath(); c.arc(sx, sy - 0.25 * S, 0.27 * S, 0, 7); c.fill(); c.fillStyle = '#4ccf86'; c.beginPath(); c.arc(sx - 0.1 * S, sy - 0.36 * S, 0.17 * S, 0, 7); c.fill(); c.beginPath(); c.arc(sx + 0.13 * S, sy - 0.18 * S, 0.14 * S, 0, 7); c.fill();
    });
    const sofa = (x0, x1, col) => add((x0 + x1) / 2 + 0.6, () => {
      this.box(f, x0, 0.25, x1, 0.95, 0, 0.32, col);
      this.box(f, x0, 0.2, x1, 0.42, 0.32, 0.42, BOT.shade(col, -0.06));
      this.box(f, x0 - 0.12, 0.25, x0 + 0.1, 0.95, 0, 0.55, BOT.shade(col, -0.1));
      this.box(f, x1 - 0.1, 0.25, x1 + 0.12, 0.95, 0, 0.55, BOT.shade(col, -0.1));
    });
    switch (r.theme) {
      case 'lobby': {
        wallScreen(0.4, 2.2, 'ticker', th.accent);
        sofa(2.5, 4.5, up.has('lounge') ? '#8b9df5' : '#a7b0c4');
        add(1.0 + 2.0, () => { this.box(f, 0.55, 1.7, 1.95, 2.3, 0, 0.62, '#2b2f3c', { t: '#f4f1ec' }); this.plane(f, 0.55, 2.3, 0.55, 'x'); c.fillStyle = '#e8e2d8'; c.font = '600 0.2px Inter,system-ui,sans-serif'; c.fillText('BLACKROCK', 0.18, 0.28); this.reset(); });
        plant(0.35, 0.4, 1.2); plant(4.65, 0.45, 1);
        if (up.has('lounge')) add(0.45 + 1.0, () => { this.box(f, 0.15, 0.7, 0.75, 1.5, 0, 0.6, '#5b4636', { t: '#e7e2da' }); this.box(f, 0.25, 0.85, 0.55, 1.1, 0.6, 0.36, '#2f3442'); this.box(f, 0.3, 1.2, 0.45, 1.35, 0.6, 0.12, '#ffffff'); });
        break;
      }
      case 'you': wallScreen(6.4, 8.6, 'watch', th.accent); desk(7.5, { w: 1.1 }); plant(9.6, 0.45, 1.1); add(9.0 + 3.6, () => this.box(f, 8.8, 3.4, 9.3, 3.9, 0, 0.5, '#e7e2da')); break;
      case 'chart': case 'quant': case 'bars': case 'candles': case 'news': case 'macro': case 'earnings':
        wallScreen(cx - (big ? 1.5 : 1.1), cx + (big ? 1.5 : 1.1), r.theme, th.accent); desk(cx);
        plant(r.x0 + 0.38, 0.38); if (r.theme === 'news') add(r.x1 - 0.6 + 0.6, () => { this.box(f, r.x1 - 0.95, 0.2, r.x1 - 0.25, 0.5, 0, 1.6, '#a0785a'); for (let i = 0; i < 4; i++) this.box(f, r.x1 - 0.92, 0.22, r.x1 - 0.28, 0.48, 0.3 + i * 0.38, 0.05, '#7a5a42'); });
        break;
      case 'vault': {
        this.plane(f, 0, 0.6, 2.0, 'y'); c.fillStyle = '#9aa3b5'; c.beginPath(); c.arc(1.6, 0.95, 0.85, 0, 7); c.fill(); c.fillStyle = '#c3cad8'; c.beginPath(); c.arc(1.6, 0.95, 0.7, 0, 7); c.fill(); c.strokeStyle = '#6b7385'; c.lineWidth = 0.06; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + t * 0.2; c.beginPath(); c.moveTo(1.6, 0.95); c.lineTo(1.6 + Math.cos(a) * 0.5, 0.95 + Math.sin(a) * 0.5); c.stroke(); } c.fillStyle = '#6b7385'; c.beginPath(); c.arc(1.6, 0.95, 0.14, 0, 7); c.fill(); this.reset();
        wallScreen(cx - 0.9, cx + 1.3, 'radar', th.accent); desk(cx + 0.2); break;
      }
      case 'risk': wallScreen(cx - 1.1, cx + 1.1, 'risk', th.accent); desk(cx);
        add(r.x1 - 0.5 + 0.5, () => { this.box(f, r.x1 - 0.7, 0.3, r.x1 - 0.3, 0.7, 0, 0.9, '#e5e7eb'); const [sx, sy] = P(r.x1 - 0.5, 0.5, 1.05); c.fillStyle = `rgba(244,63,94,${0.55 + 0.45 * Math.sin(t * 4)})`; c.beginPath(); c.arc(sx, sy, 0.13 * this.S, 0, 7); c.fill(); });
        break;
      case 'trading': wallScreen(5.4, 9.6, 'trading', th.accent);
        add(7.5 + 2.1, () => { this.box(f, 5.6, 1.7, 9.4, 2.35, 0, 0.42, '#f4f1ec', { l: '#ddd6ca', r: '#cfc7b9' }); for (let i = 0; i < 5; i++) { const x = 5.8 + i * 0.72; this.box(f, x, 1.85, x + 0.6, 1.9, 0.5, 0.36, '#20263a'); this.poly([P(x + 0.6, 1.85, 0.54), P(x + 0.6, 1.9, 0.54), P(x + 0.6, 1.9, 0.82), P(x + 0.6, 1.85, 0.82)], i % 2 ? '#22c55e' : '#f43f5e'); } });
        break;
      case 'ph': {
        wallScreen(3.6, 8.9, 'ph', th.accent);
        add(1.65 + 2.12, () => { this.box(f, 0.8, 1.85, 2.5, 2.45, 0, 0.44, '#4a3a2c', { t: '#6b5440', edge: up.has('terrace') ? '#fbbf24' : null }); this.box(f, 1.0, 2.0, 1.5, 2.06, 0.44, 0.36, '#1d2233'); });
        add(1.65 + 1.3 - 0.01, () => { this.box(f, 1.4, 1.02, 1.9, 1.18, 0.3, 0.7, '#7c5a3c'); this.box(f, 1.38, 1.12, 1.92, 1.56, 0.26, 0.1, '#8a6748'); });
        sofa(8.2, 9.7, up.has('terrace') ? '#c9a54a' : '#5b5378');
        plant(0.35, 0.35, 1.3); plant(9.7, 3.9, 1.3); if (up.has('terrace')) { plant(3.3, 0.35, 1.1); plant(9.7, 1.4, 1.1); }
        if (up.has('art')) { this.plane(f, 0, 3.2, 2.0, 'y'); c.fillStyle = '#e8d5a3'; this.rr(0, 0, 1.0, 0.75, 0.04); c.fill(); c.fillStyle = '#24365c'; this.rr(0.08, 0.08, 0.84, 0.59, 0.03); c.fill(); c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(0.5, 0.36, 0.17, 0, 7); c.fill(); this.reset(); }
        // verdict table
        add(6.3 + 2.25, () => {
          const T = this.isoEllipse(f, 6.3, 2.25, 1.55, 0.85, 0.5), B = this.isoEllipse(f, 6.3, 2.25, 1.55, 0.85, 0.38);
          this.box(f, 6.15, 2.1, 6.45, 2.4, 0, 0.38, '#3b3346');
          this.poly(B, '#2a2333'); this.poly(T, '#f5f0e6', up.has('terrace') ? '#fbbf24' : '#d8cfbf', 1.5);
          const [sx, sy] = P(6.3, 2.25, 0.5); c.fillStyle = 'rgba(56,189,248,.18)'; c.beginPath(); c.ellipse(sx, sy, 0.9 * this.S, 0.4 * this.S, 0, 0, 7); c.fill();
          if (this.holo) this.overlay.push({ kind: 'holo', f });
        });
        break;
      }
    }
    // bots on this floor inside this room (not in the shaft)
    for (const b of this.bots.values()) {
      if (b.hidden || b.gx > 10.05 || Math.round(b.fz) !== f || b.path.length && b.path[0].ride != null) continue;
      if (b.gx < r.x0 - 0.001 || b.gx >= r.x1 && r.x1 < TW.FW) continue;
      add(b.gx + b.gy + 0.02, () => this.drawBot(b));
    }
    objs.sort((a, b) => a.k - b.k); for (const o of objs) o.d();
  }
  drawBot(b, fz) {
    const [sx, sy] = this.p(fz != null ? fz : b.fz, b.gx, b.gy, 0); const S = this.S;
    let pose = b.state; if (pose === 'ride') pose = 'stand';
    if (pose === 'chair') this.drawStool(b);
    BOT.draw(this.c, sx, sy, S, { color: b.color, eye: b.eye, pose: pose === 'chair' ? 'sit' : pose, t: this.T, phase: b.phase, back: b.back, look: b.look || 0, blink: b.blinkT < 0, needs: !!b.needs });
    this.overlay.push({ kind: 'bot', b, sx, sy });
  }
  drawStool(b) { const f = b.fz; this.box(f, b.gx - 0.2, b.gy - 0.2, b.gx + 0.2, b.gy + 0.05, 0, 0.28, '#5b5378'); }
  drawHolo(f) {
    const c = this.c, h = this.holo, [sx, sy] = this.p(f, 6.3, 2.25, 2.7), S = this.S, w = 3.6 * S, hh = 1.4 * S;
    const col = h.up ? '#34d399' : '#fb7185';
    c.save(); c.globalAlpha = 0.92;
    const g = c.createLinearGradient(0, sy - hh / 2, 0, sy + hh / 2); g.addColorStop(0, 'rgba(15,23,42,.88)'); g.addColorStop(1, 'rgba(30,41,59,.78)');
    c.fillStyle = g; BOT.rr(c, sx - w / 2, sy - hh / 2, w, hh, 0.14 * S); c.fill(); c.strokeStyle = 'rgba(148,197,255,.55)'; c.lineWidth = 1; c.stroke();
    const s = h.series, mn = Math.min(...s), mx = Math.max(...s), x0 = sx - w / 2 + 0.15 * S, x1 = sx + w / 2 - 0.15 * S, y0 = sy - hh / 2 + 0.36 * S, y1 = sy + hh / 2 - 0.12 * S;
    c.beginPath(); s.forEach((v, i) => { const x = x0 + (x1 - x0) * i / (s.length - 1), y = y1 - (y1 - y0) * (v - mn) / (mx - mn || 1); i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.strokeStyle = col; c.lineWidth = Math.max(1.5, 0.05 * S); c.stroke();
    c.fillStyle = '#e2e8f0'; c.font = `600 ${Math.max(9, 0.24 * S)}px Inter,system-ui,sans-serif`; c.textBaseline = 'top'; c.fillText(h.label, x0, sy - hh / 2 + 0.1 * S);
    if (h.score != null) { c.textAlign = 'right'; c.fillStyle = col; c.fillText(h.score + '/100', x1, sy - hh / 2 + 0.1 * S); c.textAlign = 'left'; }
    c.restore();
  }
  screenArt(kind, w, h, col, t) {
    const c = this.c; c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
    c.lineWidth = 0.04; c.lineJoin = 'round';
    const line = (fn, color, n = 24) => { c.strokeStyle = color; c.beginPath(); for (let i = 0; i <= n; i++) { const x = 0.1 + (w - 0.2) * i / n, y = fn(i / n); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); };
    const mid = h / 2;
    switch (kind) {
      case 'chart': case 'macro': case 'ph':
        line(u => mid + Math.sin(u * 7 + t * 0.8) * h * 0.18 - u * h * 0.2, col);
        line(u => mid + Math.sin(u * 4 + t * 0.4) * h * 0.1 - u * h * 0.12 + 0.1, 'rgba(251,191,36,.7)');
        c.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 1; i < 4; i++) c.fillRect(0.05, h * i / 4, w - 0.1, 0.01);
        break;
      case 'bars': case 'earnings': for (let i = 0; i < 8; i++) { const v = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(i * 1.3 + t * 0.5)); c.fillStyle = i % 2 ? col : BOT.shade(col, 0.35); c.fillRect(0.12 + i * (w - 0.2) / 8, h - 0.08 - v * (h - 0.25), (w - 0.2) / 8 * 0.6, v * (h - 0.25)); } break;
      case 'candles': case 'trading': for (let i = 0; i < 14; i++) { const o = Math.sin(i * 0.9 + t * 0.6), cl = Math.sin(i * 0.9 + 0.8 + t * 0.6); const up = cl > o; c.fillStyle = up ? '#34d399' : '#fb7185'; const x = 0.12 + i * (w - 0.24) / 14, y0 = mid - Math.max(o, cl) * h * 0.3, y1 = mid - Math.min(o, cl) * h * 0.3; c.fillRect(x + 0.03, y0 - 0.08, 0.015, y1 - y0 + 0.16); c.fillRect(x, y0, 0.08, Math.max(0.02, y1 - y0)); } break;
      case 'quant': for (let i = 0; i < 40; i++) { const a = i * 2.39996, r = Math.sqrt(i) * 0.06; c.fillStyle = i % 3 ? col : '#f0abfc'; c.fillRect(w / 2 + Math.cos(a + t * 0.2) * r * w * 0.6, mid + Math.sin(a + t * 0.2) * r * h * 0.9, 0.05, 0.05); } break;
      case 'news': c.fillStyle = col; c.fillRect(0.12, 0.12, w * 0.35, h * 0.32); c.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 5; i++) c.fillRect(w * 0.45, 0.14 + i * 0.13, (w * 0.45) * (0.6 + 0.4 * ((i * 7) % 3) / 2), 0.05); for (let i = 0; i < 3; i++) c.fillRect(0.12, h * 0.55 + i * 0.13, w - 0.24 - i * 0.3, 0.05); break;
      case 'radar': { c.strokeStyle = 'rgba(148,163,184,.5)'; for (let i = 1; i <= 3; i++) { c.beginPath(); c.arc(w / 2, mid, i * h * 0.14, 0, 7); c.stroke(); } const a = t * 1.6; c.strokeStyle = '#a5f3fc'; c.beginPath(); c.moveTo(w / 2, mid); c.lineTo(w / 2 + Math.cos(a) * h * 0.42, mid + Math.sin(a) * h * 0.42); c.stroke(); c.fillStyle = '#34d399'; c.fillRect(w / 2 + 0.2, mid - 0.15, 0.06, 0.06); c.fillStyle = '#fb7185'; c.fillRect(w / 2 - 0.25, mid + 0.1, 0.06, 0.06); break; }
      case 'risk': line(u => 0.2 + u * h * 0.6 + Math.sin(u * 9 + t) * 0.06, '#fb7185'); c.fillStyle = 'rgba(251,113,133,.15)'; c.fillRect(0.05, h * 0.65, w - 0.1, h * 0.3); break;
      case 'watch': case 'ticker': {
        const items = this.ticker.length ? this.ticker : [{ t: 'BLACKROCK TOWER', c: '#e2e8f0' }];
        c.font = '600 0.22px Inter,system-ui,sans-serif'; c.textBaseline = 'middle';
        let total = 0; const ws = items.map(x => { const m = c.measureText(x.t).width + 0.4; total += m; return m; });
        const off = (t * 0.45) % total; let x = -off;
        for (let rep = 0; rep < 3 && x < w; rep++) items.forEach((it, i) => { c.fillStyle = it.c; c.fillText(it.t, x + 0.1, kind === 'ticker' ? mid : h * 0.3); x += ws[i]; });
        if (kind === 'watch') line(u => h * 0.72 + Math.sin(u * 6 + t * 0.6) * h * 0.1, col);
        break;
      }
    }
    c.restore();
  }
  drawRoof(N) {
    const c = this.c, { FW, FD } = TW, f = N, P = (a, b, z = 0) => this.p(f, a, b, z);
    if (P(FW, FD, 0)[1] < -60 || P(0, 0, 1.5)[1] > this.vh + 60) return;
    this.poly([P(0, FD, -TW.SLAB), P(FW, FD, -TW.SLAB), P(FW, FD, 0), P(0, FD, 0)], '#3a3f4f');
    this.poly([P(FW, 0, -TW.SLAB), P(FW, FD, -TW.SLAB), P(FW, FD, 0), P(FW, 0, 0)], '#2a2e3b');
    this.poly([P(0, 0), P(FW, 0), P(FW, FD), P(0, FD)], '#474d5f');
    const garden = this.unl.has('roof');
    if (garden) { this.poly([P(0.4, 0.4), P(4.2, 0.4), P(4.2, 4.1), P(0.4, 4.1)], '#3f8f5f'); const pad = this.isoEllipse(f, 7.2, 2.25, 1.4, 1.4, 0.01); this.poly(pad, '#2f3443', '#fbbf24', 2); const [hx, hy] = P(7.2, 2.25, 0.01); c.fillStyle = '#fbbf24'; c.font = `700 ${0.6 * this.S}px Inter,system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', hx, hy); c.textAlign = 'left'; this.tree(f, 1.2, 1.2, 0, 0.8); this.tree(f, 3.2, 3.2, 0, 0.7); }
    else { this.box(f, 6.4, 0.6, 8.2, 1.8, 0, 0.6, '#5b6275'); this.box(f, 8.6, 0.5, 9.4, 1.3, 0, 0.9, '#5b6275'); }
    // parapet
    this.box(f, 0, 0, FW, 0.12, 0, 0.35, '#5a6073'); this.box(f, 0, 0, 0.12, FD, 0, 0.35, '#5a6073');
    this.box(f, 0, FD - 0.12, FW, FD, 0, 0.35, '#5a6073'); this.box(f, FW - 0.12, 0, FW, FD, 0, 0.35, '#5a6073');
    // sign
    this.plane(f, 1.2, FD, 1.25, 'x'); c.fillStyle = 'rgba(12,14,22,.85)'; this.rr(0, 0, 4.6, 0.85, 0.12); c.fill();
    c.fillStyle = '#f8fafc'; c.font = '700 0.48px Inter,system-ui,sans-serif'; c.textBaseline = 'middle'; c.fillText('BLACKROCK', 0.75, 0.45);
    c.fillStyle = '#a78bfa'; c.beginPath(); c.moveTo(0.3, 0.68); c.lineTo(0.45, 0.17); c.lineTo(0.6, 0.68); c.closePath(); c.fill();
    this.reset();
    this.box(f, 1.3, FD - 0.1, 1.4, FD, 0, 1.25, '#5a6073'); this.box(f, 5.6, FD - 0.1, 5.7, FD, 0, 1.25, '#5a6073');
    // antenna
    this.box(f, 8.9, 3.0, 9.05, 3.15, 0, 2.6, '#9aa3b5'); const [ax, ay] = P(8.97, 3.07, 2.7); c.fillStyle = `rgba(244,63,94,${0.5 + 0.5 * Math.sin(this.T * 3)})`; c.beginPath(); c.arc(ax, ay, 0.1 * this.S, 0, 7); c.fill();
  }
  drawShaft(N) {
    const c = this.c, x0 = 10.15, x1 = 11.35, y0 = 2.75, y1 = 3.85, ztop = N * TW.FH + 0.5, P = (a, b, z) => this.p(0, a, b, z - TW.SLAB);
    // back faces
    this.poly([P(x0, y0, 0), P(x1, y0, 0), P(x1, y0, ztop), P(x0, y0, ztop)], 'rgba(148,163,184,.10)');
    this.poly([P(x0, y0, 0), P(x0, y1, 0), P(x0, y1, ztop), P(x0, y0, ztop)], 'rgba(148,163,184,.14)');
    // floor door frames
    for (let f = 0; f < N; f++) { const z = f * TW.FH + TW.SLAB; this.poly([P(x0, 2.95, z), P(x0, 3.65, z), P(x0, 3.65, z + 1.5), P(x0, 2.95, z + 1.5)], 'rgba(30,35,50,.55)', 'rgba(255,255,255,.35)', 1); }
    // cabs with riders
    for (const b of this.bots.values()) {
      if (b.hidden || b.gx <= 10.05) continue;
      const z = b.fz * TW.FH + TW.SLAB; const f = b.fz;
      this.box(f, 10.25, 2.85, 11.25, 3.75, -0.08, 0.08, '#cbd5e1');
      this.drawBot(b, f);
      const Q = (a, bb, zz) => this.p(f, a, bb, zz);
      this.poly([Q(10.25, 3.75, 0), Q(11.25, 3.75, 0), Q(11.25, 3.75, 1.55), Q(10.25, 3.75, 1.55)], 'rgba(186,230,253,.16)', 'rgba(255,255,255,.5)', 1);
      this.poly([Q(11.25, 2.85, 0), Q(11.25, 3.75, 0), Q(11.25, 3.75, 1.55), Q(11.25, 2.85, 1.55)], 'rgba(186,230,253,.12)', 'rgba(255,255,255,.5)', 1);
      this.box(f, 10.25, 2.85, 11.25, 3.75, 1.55, 0.06, '#94a3b8');
    }
    // front glass
    this.poly([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, ztop), P(x0, y1, ztop)], 'rgba(186,230,253,.09)', 'rgba(255,255,255,.35)', 1);
    this.poly([P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, ztop), P(x1, y0, ztop)], 'rgba(186,230,253,.06)', 'rgba(255,255,255,.3)', 1);
    for (let f = 0; f <= N; f++) { const z = f * TW.FH; this.poly([P(x0, y1, z), P(x1, y1, z), P(x1, y0, z)].concat([P(x1, y0, z + 0.1), P(x1, y1, z + 0.1), P(x0, y1, z + 0.1)]), 'rgba(203,213,225,.5)'); }
  }
  drawOverlay() {
    const c = this.c, S = this.S; const fs = Math.max(10, Math.min(13, S * 0.38));
    c.textBaseline = 'middle'; c.textAlign = 'center';
    const pill = (x, y, txt, bg, fg, o = {}) => {
      c.font = `${o.w || 600} ${o.fs || fs}px Inter,system-ui,-apple-system,sans-serif`; const tw = c.measureText(txt).width; const ph = (o.fs || fs) + 8, pw = tw + 16 + (o.dot ? 12 : 0);
      c.fillStyle = bg; BOT.rr(c, x - pw / 2, y - ph / 2, pw, ph, ph / 2); c.fill(); if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = 1; c.stroke(); }
      if (o.dot) { c.fillStyle = o.dot; c.beginPath(); c.arc(x - pw / 2 + 11, y, 3.5, 0, 7); c.fill(); }
      c.fillStyle = fg; c.fillText(txt, x + (o.dot ? 6 : 0), y + 0.5); return pw;
    };
    for (const o of this.overlay) if (o.kind === 'holo' && this.holo) this.drawHolo(o.f);
    for (const o of this.overlay) {
      if (o.kind === 'room') { const [x, y] = this.p(o.f, o.gx, o.gy, 0); if (S < 16) continue; pill(x, y, o.txt, o.dim ? 'rgba(15,17,26,.55)' : 'rgba(255,255,255,.72)', o.dim ? '#cbd5e1' : '#334155', { fs: Math.max(9, fs - 2), w: 600 }); }
      if (o.kind === 'lock') { const [x, y] = this.p(o.f, o.gx, o.gy, 0.9); pill(x, y, '🔒  ' + o.txt, 'rgba(15,17,26,.82)', '#f8fafc', { fs: Math.max(10, fs - 1), stroke: 'rgba(255,255,255,.15)' }); }
    }
    for (const o of this.overlay) {
      if (o.kind !== 'bot') continue; const b = o.b; const ty = o.sy - (b.state === 'type' || b.state === 'sofa' || b.state === 'chair' ? 1.32 : 1.48) * S - 6;
      if (b.needs) { const k = 0.5 + 0.5 * Math.sin(this.T * 5); c.fillStyle = `rgba(251,191,36,${0.25 * k})`; c.beginPath(); c.arc(o.sx, ty, 22 + 6 * k, 0, 7); c.fill(); pill(o.sx, ty, b.needs, '#fbbf24', '#1c1917', { w: 700, dot: '#b45309' }); }
      else if (b.say || (S >= 14 && (b.state !== 'chair' || S >= 40))) pill(o.sx, ty, b.name, 'rgba(17,19,28,.78)', '#f8fafc', { dot: b.color, w: 600, fs: Math.max(9.5, fs - 1) });
      if (b.say) {
        c.font = `600 ${fs + 1}px Inter,system-ui,sans-serif`; const tw = Math.min(220, c.measureText(b.say).width); const w = tw + 22, h = fs + 16, y = ty - h - 8;
        c.save(); c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 12; c.shadowOffsetY = 4; c.fillStyle = '#ffffff'; BOT.rr(c, o.sx - w / 2, y, w, h, 12); c.fill(); c.restore();
        c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(o.sx - 6, y + h - 1); c.lineTo(o.sx + 6, y + h - 1); c.lineTo(o.sx, y + h + 6); c.fill();
        c.fillStyle = b.color; c.fillRect(o.sx - w / 2 + 9, y + 8, 3, h - 16);
        c.fillStyle = '#0f172a'; c.fillText(b.say, o.sx + 3, y + h / 2, 220);
      }
    }
    c.textAlign = 'left';
  }
}
