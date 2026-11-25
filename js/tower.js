/* Blackrock Tower v4: three.js low-poly isometric cutaway office tower.
   Orthographic 3/4 camera, procedural geometry merged per material, blob bots with HTML name tags and bubbles,
   lift rides between floors, fixed camera, tap a bot for its name, throttled rendering. */
'use strict';
const TW = { W: 12, D: 8, FH: 2.7, SLAB: 0.24, N: 7, TOPW: 2.3, AZ: 26 * Math.PI / 180, EL: 34 * Math.PI / 180, LIFT_X: 6.77, LIFT_Z: -2.6, DOOR_X: 5.35, TX: -1.0, TZ: 0.4, TRX: 1.45, TRZ: 0.72, BOT_R: 0.32, BOT_H: 0.84, BOT_S: 1.12 };
TW.HW = TW.W / 2; TW.HD = TW.D / 2; TW.IH = TW.FH - TW.SLAB;
const AISLE = [3.3, 3.3, 3.3, 3.3, 3.3, 3.3, 1.55];
const gx2x = gx => gx * 1.2 - 6, gy2z = gy => gy * 2 - 4, x2gx = x => (x + 6) / 1.2, z2gy = z => (z + 4) / 2;
const FLOORS = [
  { id: 'lobby', name: 'Lobby' }, { id: 'research', name: 'Research' }, { id: 'fund', name: 'Fundamentals' }, { id: 'news', name: 'Newsroom' },
  { id: 'vault', name: 'Vault & Risk' }, { id: 'trading', name: 'Trading' }, { id: 'ph', name: 'Top floor' }
];
const ROOMS = [['lobby', 'you'], ['chart', 'quant'], ['bars', 'candles'], ['news', 'macro'], ['vault', 'risk'], ['earnings', 'trading']];
const RUG = { lobby: '#cf7a45', you: '#3f9e88', chart: '#4d86b8', quant: '#7d68c4', bars: '#4f9e74', candles: '#d9813f', news: '#c9617f', macro: '#5a7fcf', vault: '#7a8496', risk: '#c95a57', earnings: '#9066c4', trading: '#3aa597' };

function TEX(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }
function rnd(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

class Tower {
  constructor(root) {
    this.root = root; this.bots = new Map(); this.unl = new Set(); this.locks = {}; this.ticker = []; this.holo = null; this.curF = 6;
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ins = { l: 0, r: 0, t: 0, b: 0 }; this.zoom = 1; this.u = 0; this.v = 0; this.vel = { u: 0, v: 0 }; this.anim = null; this.followId = null;
    this.running = false; this.visible = true; this.t = 0; this.last = 0; this.lastDraw = 0; this.dirty = true; this.ptrs = new Map();
    this.root.classList.add('t3');
    this.wrap = document.createElement('div'); this.wrap.className = 't3-ovl'; root.appendChild(this.wrap);
    try {
      this.r = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.r.setClearColor(0x17181d, 1);
      root.insertBefore(this.r.domElement, this.wrap); this.r.domElement.className = 't3-cv';
    } catch (e) { this.r = null; const m = document.createElement('div'); m.className = 't3-nogl'; m.textContent = 'The 3D tower needs WebGL, which this browser has turned off.'; root.appendChild(m); }
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-10, 10, 5, -5, 1, 400);
    this.dir = new THREE.Vector3(Math.sin(TW.AZ) * Math.cos(TW.EL), Math.sin(TW.EL), Math.cos(TW.AZ) * Math.cos(TW.EL));
    this.cam.position.copy(this.dir).multiplyScalar(100); this.cam.lookAt(0, 0, 0); this.cam.updateMatrixWorld();
    this.ax = { r: new THREE.Vector3().setFromMatrixColumn(this.cam.matrixWorld, 0), up: new THREE.Vector3().setFromMatrixColumn(this.cam.matrixWorld, 1) };
    this.base = new THREE.Vector3(0.6, 6 * TW.FH, 0);
    this.bounds();
    this.lights(); this.textures(); this.world(); this.lift();
    if (this.r) this.input();
    new ResizeObserver(() => this.resize()).observe(root);
    new IntersectionObserver(es => { this.visible = es[0].isIntersecting; if (this.visible) this.kick(); }, { threshold: 0 }).observe(root);
    this.resize(); this.home(true);
    this._loop = ts => this.loop(ts);
  }
  // ------------------------------------------------------------------ setup
  lights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xf2efff, 0x5a4636, 0.8));
    s.add(new THREE.AmbientLight(0xffffff, 0.12));
    const d = new THREE.DirectionalLight(0xfff0dc, 0.52); d.position.set(4, 10, 7); s.add(d);
    const p1 = new THREE.PointLight(0xffb066, 0.9, 7.5, 1.6); p1.position.set(TW.TX, 6 * TW.FH + 1.9, TW.TZ); s.add(p1);
    const p2 = new THREE.PointLight(0xffc27a, 0.55, 6, 1.6); p2.position.set(3.6, 6 * TW.FH + 1.6, -0.2); s.add(p2);
  }
  textures() {
    this.tx = {};
    this.tx.wood = TEX(256, 256, (g, w, h) => {
      const R = rnd(7); g.fillStyle = '#bf8650'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) for (let x = -((y / 32) % 2) * 64; x < w; x += 128) {
        const l = 0.88 + R() * 0.2; g.fillStyle = `rgb(${191 * l | 0},${134 * l | 0},${80 * l | 0})`; g.fillRect(x + 1, y + 1, 126, 30);
        g.strokeStyle = 'rgba(120,70,30,.10)'; for (let i = 0; i < 3; i++) { g.beginPath(); const yy = y + 6 + R() * 20; g.moveTo(x + 4, yy); g.bezierCurveTo(x + 40, yy + 3, x + 80, yy - 3, x + 124, yy + 1); g.stroke(); }
      }
      g.fillStyle = 'rgba(90,50,20,.35)'; for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 1);
    });
    this.tx.wood.wrapS = this.tx.wood.wrapT = THREE.RepeatWrapping; this.tx.wood.repeat.set(4, 2.6);
    this.tx.night = TEX(512, 128, (g, w, h) => {
      const R = rnd(11); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0b1330'); gr.addColorStop(0.7, '#1a2a5c'); gr.addColorStop(1, '#2b3c74'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.5})`; g.fillRect(R() * w, R() * h * 0.45, 1, 1); }
      for (let x = 0; x < w;) { const bw = 14 + R() * 30, bh = 18 + R() * 50; g.fillStyle = '#111c3e'; g.fillRect(x, h - bh, bw, bh); for (let yy = h - bh + 4; yy < h - 3; yy += 6) for (let xx = x + 3; xx < x + bw - 3; xx += 5) if (R() < 0.35) { g.fillStyle = R() < 0.7 ? 'rgba(255,214,140,.75)' : 'rgba(170,210,255,.6)'; g.fillRect(xx, yy, 2, 2); } x += bw + 2 + R() * 6; }
    });
    this.tx.night.wrapS = THREE.RepeatWrapping;
    this.tx.mon = TEX(128, 80, (g, w, h) => {
      const R = rnd(3); g.fillStyle = '#0d1630'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#34d399'; g.lineWidth = 2; g.beginPath(); let y = 50; for (let x = 6; x < w - 6; x += 8) { y += (R() - 0.45) * 12; y = Math.max(14, Math.min(66, y)); x === 6 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
      for (let i = 0; i < 5; i++) { g.fillStyle = R() < 0.5 ? 'rgba(96,165,250,.8)' : 'rgba(167,139,250,.7)'; g.fillRect(8 + i * 8, 6, 5, 4); }
      g.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 4; i++) g.fillRect(72, 8 + i * 6, 40 - R() * 18, 2);
    });
    this.tx.glow = TEX(128, 128, (g, w) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
    this.tx.shadow = TEX(64, 64, (g, w) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,.6)'); r.addColorStop(0.55, 'rgba(0,0,0,.3)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
    this.screenCv = document.createElement('canvas'); this.screenCv.width = 512; this.screenCv.height = 192;
    this.tx.screen = new THREE.CanvasTexture(this.screenCv); this.tx.screen.anisotropy = 4;
    this.mats = {};
  }
  M(hex, dim = 1, o = {}) {
    const k = hex + '|' + dim + '|' + JSON.stringify(o, (key, v) => (v && v.isTexture) ? v.uuid : v);
    if (this.mats[k]) return this.mats[k];
    const c = new THREE.Color(hex).multiplyScalar(dim);
    let m;
    if (o.basic) m = new THREE.MeshBasicMaterial({ color: c, map: o.map || null, transparent: !!o.transparent, opacity: o.opacity ?? 1, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !o.transparent, side: o.double ? THREE.DoubleSide : THREE.FrontSide });
    else m = new THREE.MeshStandardMaterial({ color: c, map: o.map || null, roughness: o.rough ?? 0.85, metalness: 0, flatShading: !!o.flat, transparent: !!o.transparent, opacity: o.opacity ?? 1, depthWrite: !o.transparent, emissive: o.em ? new THREE.Color(o.em) : new THREE.Color(0), emissiveIntensity: o.emi ?? 1 });
    return (this.mats[k] = m);
  }
  // geometry helpers: everything goes under a temp root, then merges per material
  G() { if (!this._g) this._g = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 24), cyl8: new THREE.CylinderGeometry(1, 1, 1, 10), ico: new THREE.IcosahedronGeometry(1, 0), plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), vplane: new THREE.PlaneGeometry(1, 1), cone: new THREE.CylinderGeometry(0.45, 1, 1, 12, 1, true), sph: new THREE.SphereGeometry(1, 16, 10) }; return this._g; }
  grp(p, x, y, z, ry = 0) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g); return g; }
  box(p, w, h, d, x, y, z, m, ry = 0) { const me = new THREE.Mesh(this.G().box, m); me.scale.set(w, h, d); me.position.set(x, y + h / 2, z); me.rotation.y = ry; p.add(me); return me; }
  cyl(p, r, h, x, y, z, m, rz = r, seg) { const me = new THREE.Mesh(seg === 8 ? this.G().cyl8 : this.G().cyl, m); me.scale.set(r, h, rz); me.position.set(x, y + h / 2, z); p.add(me); return me; }
  ico(p, r, x, y, z, m, sy = 1) { const me = new THREE.Mesh(this.G().ico, m); me.scale.set(r, r * sy, r); me.position.set(x, y, z); me.rotation.set(x * 3.1, z * 1.7, 0); p.add(me); return me; }
  decal(p, x, y, z, sx, sz, m) { const me = new THREE.Mesh(this.G().plane, m); me.scale.set(sx, 1, sz); me.position.set(x, y, z); p.add(me); return me; }
  merge(root, into) {
    root.updateMatrixWorld(true); const groups = new Map();
    root.traverse(o => { if (o.isMesh) { if (!groups.has(o.material)) groups.set(o.material, []); groups.get(o.material).push(o); } });
    for (const [m, list] of groups) {
      let n = 0; const gs = list.map(me => { const g = me.geometry.index ? me.geometry.toNonIndexed() : me.geometry.clone(); g.applyMatrix4(me.matrixWorld); n += g.attributes.position.count; return g; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
      for (const g of gs) { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += c; g.dispose(); }
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); bg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); bg.computeBoundingSphere();
      const mesh = new THREE.Mesh(bg, m); mesh.matrixAutoUpdate = false; if (m.transparent) mesh.renderOrder = m.blending === THREE.AdditiveBlending ? 3 : 2; into.add(mesh);
    }
  }
  // ------------------------------------------------------------------ static world
  world() {
    if (this.static) { this.scene.remove(this.static); this.static.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); }); }
    this.static = new THREE.Group(); this.scene.add(this.static);
    const root = new THREE.Group(); this.lockSpots = []; this.glows = []; this.shadowM = this.M('#000000', 1, { basic: true, map: this.tx.shadow, transparent: true, opacity: 0.55 });
    for (let f = 0; f < TW.N; f++) { this.shell(root, f); if (f === 6) this.topFloor(root); else this.lowerFloor(root, f); }
    this.merge(root, this.static);
    // dynamic-texture wall screen (top floor back wall)
    const big = this.unl.has('screens'); const sw = big ? 3.8 : 3.2, sh = big ? 1.42 : 1.2, sx = 1.85, sy = 6 * TW.FH + 0.78;
    const scr = new THREE.Mesh(this.G().vplane, this.M('#ffffff', 1, { basic: true, map: this.tx.screen })); scr.scale.set(sw - 0.12, sh - 0.12, 1); scr.position.set(sx, sy + sh / 2, -TW.HD + 0.226); this.static.add(scr);
    this.drawScreen(); this.dirty = true;
  }
  shell(p, f) {
    const y0 = f * TW.FH, top = f === 6, dim = top ? 1 : 0.84, h = top ? TW.TOPW : TW.IH, { W, D, HW, HD, SLAB } = TW;
    const wall = this.M('#eceef2', dim), frame = this.M('#f4f5f7', dim), slab = this.M('#dfe2e8', 1), night = this.M('#ffffff', top ? 1 : 0.85, { basic: true, map: this.tx.night });
    this.box(p, W + 0.3, SLAB, D + 0.3, 0, y0 - SLAB, 0, slab);
    this.box(p, W + 0.3, 0.03, D + 0.3, 0, y0 - SLAB - 0.03, 0, this.M('#9aa0ab'));
    if (f === 0) this.box(p, W + 0.8, 0.5, D + 0.8, 0, -SLAB - 0.5, 0, this.M('#2a2c33'));
    this.box(p, W, 0.02, D, 0, y0, 0, this.M('#ffffff', dim * (top ? 1 : 0.92), { map: this.tx.wood, rough: 0.7 }));
    // back wall with night windows
    this.box(p, W, 0.32, 0.2, 0, y0, -HD + 0.1, wall);
    this.box(p, W, 0.16, 0.2, 0, y0 + h - 0.16, -HD + 0.1, wall);
    this.box(p, W, h - 0.48, 0.03, 0, y0 + 0.32, -HD + 0.03, night);
    for (let i = 0; i <= 10; i++) this.box(p, 0.07, h - 0.48, 0.12, -HW + i * 1.2, y0 + 0.32, -HD + 0.1, frame);
    // left wall with windows
    this.box(p, 0.2, 0.32, D, -HW + 0.1, y0, 0, wall);
    this.box(p, 0.2, 0.16, D, -HW + 0.1, y0 + h - 0.16, 0, wall);
    const lw = this.box(p, D, h - 0.48, 0.03, -HW + 0.03, y0 + 0.32, 0, night, Math.PI / 2);
    for (let i = 0; i <= 6; i++) this.box(p, 0.12, h - 0.48, 0.07, -HW + 0.1, y0 + 0.32, -HD + i * (D / 6), frame);
    this.box(p, 0.32, h, 0.32, -HW, y0, -HD, wall);
    if (!top) {
      const glass = this.M('#b9d6ff', 1, { transparent: true, opacity: 0.07, rough: 0.1 });
      this.box(p, W, TW.IH, 0.02, 0, y0, HD, glass);
      this.box(p, 0.02, TW.IH, D, HW, y0, 0, glass);
      for (const x of [-HW, -3, 0, 3]) this.box(p, 0.06, TW.IH, 0.06, x, y0, HD, frame);
      this.box(p, 0.1, TW.IH, 0.1, HW, y0, HD, frame);
      for (const z of [-HD, 0]) this.box(p, 0.06, TW.IH, 0.06, HW, y0, z, frame);
      this.box(p, W, 0.05, 0.05, 0, y0 + 0.9, HD, this.M('#e3e6ea', 0.9));
    }
  }
  // ---------------------------------------------------------------- furniture kit
  desk(p, x, z, o = {}) {
    const d = o.dim || 1, g = this.grp(p, x, o.y || 0, z, o.ry || 0), w = o.w || 1.3;
    this.box(g, w, 0.05, 0.62, 0, 0.68, 0, this.M('#f7f7f5', d));
    this.box(g, 0.05, 0.68, 0.56, -w / 2 + 0.06, 0, 0, this.M('#d4d7dd', d)); this.box(g, 0.05, 0.68, 0.56, w / 2 - 0.06, 0, 0, this.M('#d4d7dd', d));
    this.box(g, w - 0.2, 0.3, 0.03, 0, 0.36, -0.26, this.M('#e4e6ea', d));
    const mons = o.mons ?? 1, big = this.unl.has('screens');
    for (let i = 0; i < mons; i++) {
      const mx = mons === 1 ? (o.monX ?? -0.18) : -0.32 + i * 0.64 / (mons - 1 || 1), mw = big ? 0.66 : 0.54, mh = big ? 0.4 : 0.34;
      const mg = this.grp(g, mx, 0.73, -0.12, mons > 1 ? (i === 0 ? 0.25 : i === mons - 1 ? -0.25 : 0) : 0.15);
      this.box(mg, 0.16, 0.02, 0.12, 0, 0, 0, this.M('#2b2f3a', d)); this.box(mg, 0.04, 0.2, 0.04, 0, 0, -0.02, this.M('#2b2f3a', d));
      this.box(mg, mw, mh, 0.035, 0, 0.17, 0, this.M('#1a1d26', d));
      if (!o.off) { const s = new THREE.Mesh(this.G().vplane, this.M('#ffffff', 1, { basic: true, map: this.tx.mon })); s.scale.set(mw - 0.05, mh - 0.05, 1); s.position.set(0, 0.17 + mh / 2, 0.02); mg.add(s); }
    }
    if (o.lamp !== false) this.lamp(g, w / 2 - 0.16, 0.73, -0.1, d, !o.off);
    this.decal(p, x, (o.y || 0) + 0.025, z + 0.05, w + 0.5, 1.1, this.shadowM);
    return g;
  }
  lamp(p, x, y, z, d = 1, on = true) {
    this.cyl(p, 0.07, 0.02, x, y, z, this.M('#2b2f3a', d)); this.box(p, 0.02, 0.32, 0.02, x, y, z, this.M('#2b2f3a', d));
    const sh = new THREE.Mesh(this.G().cone, on ? this.M('#ffd79a', 1, { basic: true }) : this.M('#cfd3da', d)); sh.scale.set(0.12, 0.12, 0.12); sh.position.set(x, y + 0.36, z); p.add(sh);
    if (on) { p.updateWorldMatrix(true, false); const v = new THREE.Vector3(x, y, z); p.localToWorld(v); this.glows.push([v.x, v.z, 1.5, 0.75]); }
  }
  plant(p, x, y, z, s = 1, d = 1, pot = '#ece7df') {
    this.cyl(p, 0.17 * s, 0.32 * s, x, y, z, this.M(pot, d), 0.17 * s, 8);
    const g1 = this.M('#3f9b57', d, { flat: true }), g2 = this.M('#2f7d47', d, { flat: true });
    this.ico(p, 0.3 * s, x, y + 0.58 * s, z, g1, 1.25); this.ico(p, 0.22 * s, x + 0.12 * s, y + 0.86 * s, z - 0.05, g2, 1.2); this.ico(p, 0.18 * s, x - 0.1 * s, y + 0.78 * s, z + 0.1 * s, g1);
    this.decal(p, x, y + 0.02, z, 0.8 * s, 0.8 * s, this.shadowM);
  }
  sofa(p, x, z, len, ry = 0, col = '#2f8f8c', d = 1, y = 0) {
    const g = this.grp(p, x, y, z, ry), c = this.M(col, d), c2 = this.M(new THREE.Color(col).offsetHSL(0, 0, 0.06).getHexString().replace(/^/, '#'), d);
    this.box(g, len, 0.26, 0.78, 0, 0.04, 0, c); this.box(g, len - 0.34, 0.12, 0.62, 0, 0.3, 0.05, c2);
    this.box(g, len, 0.5, 0.2, 0, 0.3, -0.3, c); this.box(g, 0.18, 0.46, 0.78, -len / 2 + 0.09, 0.04, 0, c); this.box(g, 0.18, 0.46, 0.78, len / 2 - 0.09, 0.04, 0, c);
    for (const lx of [-len / 2 + 0.12, len / 2 - 0.12]) for (const lz of [-0.3, 0.3]) this.box(g, 0.05, 0.05, 0.05, lx, 0, lz, this.M('#3a2f28', d));
    this.decal(p, x, y + 0.02, z, len + 0.6, 1.3, this.shadowM);
  }
  rug(p, x, y, z, rx, rz, col, d = 1) {
    this.cyl(p, rx, 0.012, x, y + 0.02, z, this.M(col, d), rz, 0);
    this.cyl(p, rx * 0.86, 0.014, x, y + 0.022, z, this.M(new THREE.Color(col).offsetHSL(0, -0.05, 0.07).getHexString().replace(/^/, '#'), d), rz * 0.86);
    this.cyl(p, rx * 0.5, 0.016, x, y + 0.024, z, this.M(col, d), rz * 0.5);
  }
  shelf(p, x, y, z, ry, d = 1) {
    const g = this.grp(p, x, y, z, ry), w = this.M('#f1f1ef', d);
    this.box(g, 1.1, 1.5, 0.34, 0, 0, 0, w);
    const cols = ['#d9773f', '#2f8f8c', '#e8c27a', '#5a7fcf', '#c95a57', '#8b6fd6'], R = rnd(Math.round(x * 13 + z * 7 + y + 99));
    for (let s = 0; s < 3; s++) { this.box(g, 1.0, 0.03, 0.3, 0, 0.12 + s * 0.46, 0.03, this.M('#d9dbe0', d)); let bx = -0.44; while (bx < 0.4) { const bw = 0.05 + R() * 0.07, bh = 0.22 + R() * 0.14; this.box(g, bw, bh, 0.22, bx + bw / 2, 0.15 + s * 0.46, 0.04, this.M(cols[(R() * cols.length) | 0], d)); bx += bw + 0.012; } }
    return g;
  }
  glowDecals(p, y, dim = 1) { for (const [x, z, r, a] of this.glows) this.decal(p, x, y + 0.03, z, r * 2, r * 2, this.M('#ffae55', a * dim, { basic: true, map: this.tx.glow, transparent: true, add: true })); this.glows = []; }
  topFloor(p) {
    const y = 6 * TW.FH, { TX, TZ, TRX, TRZ, HW, HD } = TW;
    // meeting zone
    this.rug(p, TX, y, TZ, 2.75, 1.75, '#c8663a');
    const tbl = this.M('#a86a3e', 1, { rough: 0.6 });
    this.cyl(p, TRX, 0.07, TX, y + 0.68, TZ, tbl, TRZ, 0);
    if (this.unl.has('terrace')) this.cyl(p, TRX + 0.04, 0.03, TX, y + 0.7, TZ, this.M('#e8b84a', 1, { rough: 0.35 }), TRZ + 0.04);
    for (const dx of [-0.7, 0.7]) { this.cyl(p, 0.08, 0.68, TX + dx, y, TZ, this.M('#6b4a35')); this.cyl(p, 0.32, 0.03, TX + dx, y, TZ, this.M('#6b4a35'), 0.22); }
    this.decal(p, TX, y + 0.026, TZ, TRX * 2.6, TRZ * 2.8, this.shadowM);
    // pendant over the table
    this.glows.push([TX, TZ, 2.4, 0.55]);
    // boss zone: right, on a rectangular rug, under the big wall screen
    this.box(p, 2.6, 0.015, 2.3, 3.55, y + 0.02, -0.55, this.M('#b85b36'));
    this.box(p, 2.3, 0.017, 2.0, 3.55, y + 0.021, -0.55, this.M('#c9714a'));
    this.desk(p, 3.55, -0.85, { w: 1.7, mons: 2, y });
    this.shelf(p, 5.3, y, 0.9, -Math.PI / 2);
    // wall screen frame (texture mesh added in world())
    const big = this.unl.has('screens'), sw = big ? 3.8 : 3.2, sh = big ? 1.42 : 1.2;
    this.box(p, sw, sh, 0.08, 1.85, y + 0.78, -HD + 0.17, this.M('#1a1d26'));
    this.glows.push([1.85, -HD + 0.9, 1.6, 0.35]);
    // back-left hot desks
    this.desk(p, -4.55, -3.05, { y }); this.desk(p, -2.75, -3.05, { monX: 0.2, y });
    this.plant(p, -5.45, y, -3.45, 1.1);
    this.shelf(p, -5.72, y, -0.9, Math.PI / 2);
    // front lounge: teal sofa facing the room-front, coffee table, floor lamp
    this.sofa(p, 0.9, 2.55, 2.3, 0, '#2f8f8c', 1, y);
    const ct = this.grp(p, 0.9, y, 3.35); this.box(ct, 1.0, 0.05, 0.52, 0, 0.36, 0, this.M('#b07a4a')); for (const lx of [-0.42, 0.42]) this.box(ct, 0.05, 0.36, 0.42, lx, 0, 0, this.M('#3a2f28'));
    this.box(ct, 0.2, 0.08, 0.14, -0.2, 0.41, 0, this.M('#e8c27a')); this.cyl(ct, 0.05, 0.1, 0.25, 0.41, 0.05, this.M('#f4f1ea'));
    this.decal(p, 0.9, y + 0.025, 3.35, 1.4, 0.9, this.shadowM);
    this.cyl(p, 0.12, 0.02, -0.65, y, 2.35, this.M('#2b2f3a')); this.box(p, 0.03, 1.35, 0.03, -0.65, y, 2.35, this.M('#2b2f3a'));
    const fl = new THREE.Mesh(this.G().cone, this.M('#ffd79a', 1, { basic: true })); fl.scale.set(0.2, 0.2, 0.2); fl.position.set(-0.65, y + 1.42, 2.35); p.add(fl); this.glows.push([-0.65, 2.35, 1.4, 0.7]);
    // orange armchair front-left
    const ac = this.grp(p, -3.9, y, 2.75, 0.5); const ao = this.M('#d9773f'); this.box(ac, 0.75, 0.3, 0.7, 0, 0.04, 0, ao); this.box(ac, 0.75, 0.42, 0.16, 0, 0.3, -0.27, ao); this.box(ac, 0.14, 0.24, 0.7, -0.31, 0.3, 0, ao); this.box(ac, 0.14, 0.24, 0.7, 0.31, 0.3, 0, ao); this.decal(p, -3.9, y + 0.02, 2.75, 1.2, 1.2, this.shadowM);
    this.plant(p, 2.8, y, 3.45, 0.9); this.plant(p, -5.45, y, 3.45, 1.15); this.plant(p, 5.45, y, 3.45, 1.0); this.plant(p, 5.45, y, -3.45, 0.95);
    if (this.unl.has('terrace')) { this.plant(p, -2.8, y, 3.5, 0.8); this.plant(p, 4.4, y, 2.4, 0.8); }
    if (this.unl.has('art')) { const cols = ['#d9773f', '#5a7fcf', '#e8c27a']; [0.9, 2.2].forEach((z, i) => { this.box(p, 0.05, 0.75, 1.0, -HW + 0.24, y + 0.95, z, this.M('#2b2f3a')); this.box(p, 0.03, 0.65, 0.9, -HW + 0.28, y + 1.0, z, this.M(cols[i])); this.box(p, 0.02, 0.3, 0.4, -HW + 0.3, y + 1.15, z - 0.1, this.M(cols[i + 1])); }); }
    if (this.unl.has('roof')) { for (let i = 0; i < 5; i++) { const x = -5.2 + i * 2.4; this.box(p, 1.4, 0.28, 0.4, x, y + TW.TOPW, -HD + 0.1, this.M('#8a8f99')); this.ico(p, 0.32, x - 0.35, y + TW.TOPW + 0.4, -HD + 0.1, this.M('#3f9b57', 1, { flat: true })); this.ico(p, 0.28, x + 0.3, y + TW.TOPW + 0.38, -HD + 0.1, this.M('#2f7d47', 1, { flat: true })); } }
    this.glowDecals(p, y);
  }
  lowerFloor(p, f) {
    const y = f * TW.FH, d = 0.84, rooms = ROOMS[f], locked5 = f === 5 && !this.unl.has('trading');
    const homeX = [gx2x(2.55), gx2x(7.65)], hz = gy2z(3.15);
    // a little life in the (mostly hidden) back half
    this.shelf(p, -0.2, y, -TW.HD + 0.35, 0, d); this.plant(p, 1.2, y, -TW.HD + 0.5, 0.9, d);
    rooms.forEach((k, side) => {
      const hx = homeX[side], lockLabel = this.locks[k] || null;
      const off = !!lockLabel || (f === 5 && locked5);
      this.rug(p, hx, y, hz + 0.05, 1.35, 0.88, RUG[k], off ? d * 0.75 : d);
      if (k === 'lobby') {
        this.sofa(p, -1.68, 2.05, 2.1, 0, '#2f8f8c', d, y);
        this.box(p, 0.42, 0.42, 0.42, -0.35, y, 2.2, this.M('#b07a4a', d)); this.lamp(p, -0.35, y + 0.42, 2.2, d);
        this.plant(p, -5.4, y, 3.4, 1.15, d); this.plant(p, -0.2, y, 3.45, 0.85, d);
        if (this.unl.has('lounge')) { const g = this.grp(p, -4.75, y, 1.3); this.box(g, 1.3, 0.95, 0.5, 0, 0, 0, this.M('#f4f1ea', d)); this.box(g, 1.3, 0.05, 0.56, 0, 0.95, 0, this.M('#b07a4a', d)); this.box(g, 0.28, 0.4, 0.25, -0.3, 1.0, 0, this.M('#2b2f3a', d)); this.box(g, 0.06, 0.04, 0.02, -0.3, 1.25, 0.13, this.M('#ef4444', 1, { basic: true })); this.cyl(g, 0.06, 0.1, 0.25, 1.0, 0.05, this.M('#ffffff', d)); this.decal(p, -4.75, y + 0.02, 1.3, 1.8, 1.0, this.shadowM); this.glows.push([-4.75, 1.6, 1.2, 0.5]); }
        else { this.box(p, 1.2, 0.4, 0.45, -4.6, y, 2.0, this.M('#c9cdd4', d)); }
        return;
      }
      if (k === 'trading' && !locked5) { this.desk(p, 3.2, 1.5, { w: 2.6, mons: 3, dim: d, y }); this.plant(p, 4.75, y, 2.9, 0.8, d); return; }
      if (f === 5 && locked5 && k === 'trading') { this.box(p, 2.4, 0.75, 0.7, 3.2, y, 1.5, this.M('#c9ccd3', d)); this.box(p, 0.8, 0.9, 0.6, 1.5, y, 2.6, this.M('#c9ccd3', d)); this.lockSpots.push({ f, x: 3.2, z: 2.2, label: this.locks.trading || 'Level 5 · Trading desk' }); return; }
      if (off) { this.box(p, 1.3, 0.75, 0.62, hx - 0.1, y, hz - 0.62, this.M('#c9ccd3', d)); this.lockSpots.push({ f, x: hx, z: hz, label: lockLabel || 'Locked' }); return; }
      this.desk(p, hx - 0.1, hz - 0.62, { dim: d, y, mons: k === 'chart' || k === 'trading' ? 2 : 1 });
      const px = side === 0 ? hx - 1.55 : hx + 1.4, pz = 1.55;
      switch (k) {
        case 'you': this.plant(p, hx + 1.35, y, 1.5, 0.9, d); this.shelf(p, hx - 1.6, y, 1.25, 0.35, d); break;
        case 'chart': case 'news': case 'earnings': { const g = this.grp(p, px, y, pz, 0.45); this.box(g, 0.06, 1.0, 0.06, 0, 0, 0, this.M('#2b2f3a', d)); this.box(g, 0.9, 0.58, 0.05, 0, 0.95, 0, this.M('#1a1d26', d)); const s = new THREE.Mesh(this.G().vplane, k === 'earnings' ? this.M('#f4f1ea', d * 1.1) : this.M('#ffffff', 1, { basic: true, map: this.tx.mon })); s.scale.set(0.82, 0.5, 1); s.position.set(0, 1.24, 0.03); g.add(s); if (k === 'earnings') for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) this.box(g, 0.14, 0.1, 0.01, -0.27 + i * 0.18, 1.04 + j * 0.14, 0.04, this.M(i + j === 3 ? '#9066c4' : '#d9dbe0', d)); this.decal(p, px, y + 0.02, pz, 0.8, 0.8, this.shadowM); break; }
        case 'quant': case 'candles': { this.box(p, 0.5, 1.3, 0.45, px, y, pz, this.M('#2b2f3a', d)); for (let i = 0; i < 5; i++) this.box(p, 0.36, 0.03, 0.01, px, y + 0.25 + i * 0.2, pz + 0.23, this.M(k === 'quant' ? '#60a5fa' : '#fb923c', 1, { basic: true })); this.decal(p, px, y + 0.02, pz, 0.9, 0.9, this.shadowM); this.glows.push([px, pz + 0.4, 0.8, 0.35]); break; }
        case 'bars': { for (let i = 0; i < 2; i++) { this.box(p, 0.45, 0.95, 0.45, px - 0.25 + i * 0.5, y, pz, this.M('#e4dccb', d)); for (let j = 0; j < 3; j++) this.box(p, 0.12, 0.03, 0.01, px - 0.25 + i * 0.5, y + 0.2 + j * 0.3, pz + 0.23, this.M('#8a8f99', d)); } this.decal(p, px, y + 0.02, pz, 1.4, 0.9, this.shadowM); break; }
        case 'macro': { this.cyl(p, 0.12, 0.03, px, y, pz, this.M('#2b2f3a', d)); this.box(p, 0.03, 0.75, 0.03, px, y, pz, this.M('#2b2f3a', d)); const gl = new THREE.Mesh(this.G().sph, this.M('#4a7fd0', d, { rough: 0.5 })); gl.scale.setScalar(0.26); gl.position.set(px, y + 1.0, pz); p.add(gl); this.ico(p, 0.12, px + 0.08, y + 1.06, pz + 0.15, this.M('#4f9e74', d, { flat: true })); this.plant(p, hx - 1.5, y, 1.5, 0.8, d); break; }
        case 'vault': { this.box(p, 0.65, 0.75, 0.55, px, y, pz, this.M('#5b6474', d, { rough: 0.5 })); this.cyl(p, 0.12, 0.04, px, y + 0.37, pz + 0.28, this.M('#c0c6d0', d)); this.decal(p, px, y + 0.02, pz, 1.0, 0.9, this.shadowM); this.plant(p, hx + 1.4, y, 1.5, 0.8, d); break; }
        case 'risk': { this.box(p, 0.04, 1.1, 0.04, px, y, pz, this.M('#2b2f3a', d)); const bl = new THREE.Mesh(this.G().sph, this.M('#ef4444', 1, { basic: true })); bl.scale.setScalar(0.1); bl.position.set(px, y + 1.18, pz); p.add(bl); this.glows.push([px, pz, 0.8, 0.3]); this.plant(p, hx - 1.5, y, 1.5, 0.8, d); break; }
      }
      if (!['you', 'macro', 'vault', 'risk'].includes(k)) this.plant(p, side === 0 ? hx + 1.35 : hx - 1.5, y, 1.45, 0.8, d);
    });
    this.glowDecals(p, y, 0.9);
  }
  lift() {
    const root = new THREE.Group(), x = TW.LIFT_X, z = TW.LIFT_Z, w = 1.3, d = 1.6, y0 = -TW.SLAB, y1 = 6 * TW.FH + TW.TOPW + 0.7, h = y1 - y0;
    const post = this.M('#e9ecf1'), glass = this.M('#bfe0ff', 1, { transparent: true, opacity: 0.13, rough: 0.1 });
    for (const dx of [-w / 2, w / 2]) for (const dz of [-d / 2, d / 2]) this.box(root, 0.08, h, 0.08, x + dx, y0, z + dz, post);
    this.box(root, 0.02, h, d, x + w / 2, y0, z, glass); this.box(root, w, h, 0.02, x, y0, z + d / 2, glass); this.box(root, w, h, 0.02, x, y0, z - d / 2, glass);
    for (let f = 0; f <= TW.N; f++) { const yy = Math.min(f * TW.FH - 0.06, y1 - 0.12); this.box(root, w + 0.08, 0.06, 0.08, x, yy, z + d / 2, post); this.box(root, 0.08, 0.06, d + 0.08, x + w / 2, yy, z, post); }
    this.box(root, w + 0.25, 0.14, d + 0.25, x, y1, z, this.M('#dfe2e8'));
    const bea = new THREE.Mesh(this.G().sph, this.M('#fbbf24', 1, { basic: true })); bea.scale.setScalar(0.07); bea.position.set(x, y1 + 0.22, z); root.add(bea);
    this.box(root, 0.04, 0.12, 0.04, x, y1 + 0.1, z, this.M('#9aa0ab'));
    const g = new THREE.Group(); this.merge(root, g); this.scene.add(g);
    // cab
    this.cab = new THREE.Group(); const cm = this.M('#f4f5f7'), cg = this.M('#dff1ff', 1, { transparent: true, opacity: 0.18 });
    this.box(this.cab, w - 0.12, 0.06, d - 0.12, 0, 0, 0, cm); this.box(this.cab, w - 0.12, 0.05, d - 0.12, 0, 1.25, 0, cm);
    for (const dx of [-(w - 0.14) / 2, (w - 0.14) / 2]) for (const dz of [-(d - 0.14) / 2, (d - 0.14) / 2]) this.box(this.cab, 0.04, 1.25, 0.04, dx, 0, dz, cm);
    this.box(this.cab, 0.02, 1.2, d - 0.16, (w - 0.14) / 2, 0.05, 0, cg);
    const cl = new THREE.Mesh(this.G().plane, this.M('#ffe2ad', 0.9, { basic: true, map: this.tx.glow, transparent: true, add: true })); cl.scale.set(1.2, 1, 1.4); cl.position.y = 0.07; this.cab.add(cl);
    this.cab.position.set(x, 6 * TW.FH, z); this.scene.add(this.cab);
  }
  // ------------------------------------------------------------------ wall screen
  drawScreen() {
    const c = this.screenCv, g = c.getContext('2d'), w = c.width, h = c.height;
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0d1428'); bg.addColorStop(1, '#0a0f1e'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.font = '600 15px Inter,system-ui,sans-serif'; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText('BLACKROCK · MARKETS', 18, 26);
    const hl = this.holo;
    if (hl && hl.series && hl.series.length > 2) {
      const s = hl.series, lo = Math.min(...s), hi = Math.max(...s), col = hl.up ? '#34d399' : '#fb7185';
      g.font = '700 30px Inter,system-ui,sans-serif'; g.fillStyle = '#fff'; g.fillText(hl.label || '', 18, 64);
      if (hl.score != null) { g.fillStyle = hl.score >= 60 ? '#34d399' : hl.score >= 40 ? '#fbbf24' : '#fb7185'; g.beginPath(); g.roundRect ? g.roundRect(w - 150, 38, 132, 36, 18) : g.rect(w - 150, 38, 132, 36); g.fill(); g.fillStyle = '#0b1020'; g.font = '700 20px Inter,system-ui,sans-serif'; g.fillText(`${hl.score}/100`, w - 128, 63); }
      const X = i => 18 + i / (s.length - 1) * (w - 36), Y = v => h - 16 - (v - lo) / ((hi - lo) || 1) * (h - 100);
      g.beginPath(); s.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))); g.lineTo(X(s.length - 1), h - 10); g.lineTo(18, h - 10); g.closePath();
      const fg = g.createLinearGradient(0, 80, 0, h); fg.addColorStop(0, hl.up ? 'rgba(52,211,153,.35)' : 'rgba(251,113,133,.35)'); fg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fg; g.fill();
      g.beginPath(); s.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))); g.strokeStyle = col; g.lineWidth = 3; g.stroke();
    } else {
      const t = this.ticker.length ? this.ticker : [{ t: 'Loading markets…', c: '#94a3b8' }];
      g.font = '700 17px Inter,system-ui,sans-serif';
      t.slice(0, 12).forEach((x, i) => { const col = i % 3, row = (i / 3) | 0, xx = 18 + col * 165, yy = 58 + row * 34; g.fillStyle = x.c; g.fillText(x.t, xx, yy); const m = /([+-]?\d+(\.\d+)?)%/.exec(x.t); if (m) { const v = Math.max(-6, Math.min(6, +m[1])); g.fillRect(xx, yy + 7, Math.max(4, Math.abs(v) * 18), 4); } });
    }
    this.tx.screen.needsUpdate = true; this.dirty = true;
  }
  // ------------------------------------------------------------------ bots
  botGeo() {
    if (this._bg) return this._bg; const r = TW.BOT_R, H = TW.BOT_H, pts = [new THREE.Vector2(0, 0), new THREE.Vector2(r - 0.05, 0), new THREE.Vector2(r - 0.01, 0.015), new THREE.Vector2(r, 0.05), new THREE.Vector2(r, H - r)];
    for (let i = 1; i <= 10; i++) { const a = i / 10 * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.001, Math.cos(a) * r), H - r + Math.sin(a) * r)); }
    return (this._bg = new THREE.LatheGeometry(pts, 28));
  }
  makeBot(s) {
    const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
    const col = new THREE.Color(s.color);
    const body = new THREE.Mesh(this.botGeo(), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, emissive: col, emissiveIntensity: 0.14 })); inner.add(body);
    if (!this._eye) this._eye = new THREE.CapsuleGeometry(0.037, 0.115, 4, 10);
    const eyes = new THREE.Group(), em = this.M('#ffffff', 1, { basic: true });
    for (const ex of [-0.088, 0.088]) { const e = new THREE.Mesh(this._eye, em); e.position.set(ex, 0, 0); eyes.add(e); }
    eyes.position.set(0, 0.5, TW.BOT_R - 0.012); inner.add(eyes);
    const sh = new THREE.Mesh(this.G().plane, this.shadowBotM || (this.shadowBotM = this.M('#000000', 1, { basic: true, map: this.tx.shadow, transparent: true, opacity: 0.75 }))); sh.scale.set(0.95, 1, 0.95); sh.position.y = 0.03; sh.renderOrder = 2; g.add(sh);
    const plat = new THREE.Mesh(this.G().cyl, this.M('#ffe2ad', 1, { basic: true, transparent: true, opacity: 0.5 })); plat.scale.set(0.42, 0.03, 0.42); plat.visible = false; g.add(plat);
    g.scale.setScalar(TW.BOT_S); this.scene.add(g);
    const el = document.createElement('div'); el.className = 'b3';
    el.innerHTML = `<div class="b3-in"><div class="b3-needs" hidden></div><div class="b3-say" hidden></div><div class="b3-tag"><i></i><span></span></div></div>`;
    this.wrap.appendChild(el); const q = c => el.querySelector(c);
    return { g, inner, body, eyes, sh, plat, el, needEl: q('.b3-needs'), sayEl: q('.b3-say'), tagEl: q('.b3-tag'), dot: q('.b3-tag i'), nameEl: q('.b3-tag span'), ry: TW.AZ, tRy: TW.AZ, segs: [], walking: false, state: 'stand', hopT: -9, blinkT: 2 + Math.random() * 4, seed: Math.random() * 10 };
  }
  setBots(list) {
    for (const s of list) {
      let b = this.bots.get(s.id);
      if (!b) { b = Object.assign(this.makeBot(s), { id: s.id }); this.bots.set(s.id, b); b.home = s.home; this.placeAt(b, s.home); }
      Object.assign(b, { name: s.name, color: s.color, home: s.home });
      b.nameEl.textContent = s.name; b.hidden = !!s.hidden; b.g.visible = !b.hidden;
      b.body.material.color.set(s.color); b.body.material.emissive.set(s.color);
    }
    this.dirty = true;
  }
  setUnlocks(set, locks) {
    const key = [...set].sort().join(',') + '|' + Object.keys(locks || {}).sort().join(',');
    this.unl = new Set(set); this.locks = locks || {};
    if (key === this._uk) return; this._uk = key; this.world(); this.lockEls();
  }
  lockEls() {
    (this._lockEls || []).forEach(e => e.remove());
    this._lockEls = (this.lockSpots || []).map(s => { const e = document.createElement('div'); e.className = 'b3-lock'; e.textContent = '🔒 ' + s.label; e._s = s; this.wrap.appendChild(e); return e; });
  }
  setTicker(t) { this.ticker = t || []; this.drawScreen(); }
  setHolo(h) { this.holo = h; this.drawScreen(); }
  say(id, text) { const b = this.bots.get(id); if (!b) return; b.sayEl.textContent = text; b.sayEl.hidden = !text; b.talking = !!text; b.el.classList.toggle('talking', !!text); this.dirty = true; }
  quiet(id) { this.say(id, ''); }
  needs(id, text) { const b = this.bots.get(id); if (!b) return; b.needs = text || null; b.needEl.textContent = text ? '! ' + text : ''; b.needEl.hidden = !text; this.dirty = true; }
  hop(id, delay = 0) { const b = this.bots.get(id); if (b) b.hopT = this.t + delay; this.kick(); }
  cheer(ids) { (ids || [...this.bots.keys()]).forEach((id, i) => this.hop(id, i * 0.08)); }
  // ------------------------------------------------------------------ movement
  faceFor(b, d) {
    if (!d) return TW.AZ;
    if (d.face) { const a = Math.atan2(gx2x(d.face.gx) - b.g.position.x, gy2z(d.face.gy) - b.g.position.z), da = Math.atan2(Math.sin(TW.AZ - a), Math.cos(TW.AZ - a)); return a + da * 0.5; }
    if (d.back) return Math.PI;
    if (d.look) return d.look < 0 ? -Math.PI / 2 : Math.PI / 2;
    return TW.AZ;
  }
  placeAt(b, d) {
    b.g.position.set(gx2x(d.gx), d.f * TW.FH + (d.pose === 'sofa' ? 0.3 : 0), gy2z(d.gy));
    b.f = d.f; b.gx = d.gx; b.gy = d.gy; b.state = d.pose || 'stand'; b.at = d; b.exitVia = d.via ? [...d.via].reverse() : null;
    b.ry = b.tRy = this.faceFor(b, d); b.g.rotation.y = b.ry; b.riding = false; b.plat.visible = false;
  }
  cancel(b) { if (b.res) { const r = b.res; b.res = null; r(false); } b.segs = []; b.walking = false; }
  place(id, d) { const b = this.bots.get(id); if (!b) return; this.cancel(b); this.placeAt(b, d); this.dirty = true; }
  near(b, d) { return !b.walking && b.f === d.f && Math.hypot(b.g.position.x - gx2x(d.gx), b.g.position.z - gy2z(d.gy)) < 0.12; }
  isHome(id) { const b = this.bots.get(id); return !!b && this.near(b, b.home); }
  isAt(id, d) { const b = this.bots.get(id); return !!b && this.near(b, d); }
  goHome(id, fast = 1) { const b = this.bots.get(id); return b ? this.walk(id, b.home, fast) : Promise.resolve(false); }
  behindTable(x, z) { return Math.abs(x - TW.TX) < TW.TRX + 0.85 && z < TW.TZ + 0.15 && z > TW.TZ - TW.TRZ - 0.9; }
  toAisle(P, f, via) {
    const ais = AISLE[f], out = [];
    if (via) for (const v of via) out.push({ x: gx2x(v.gx), z: gy2z(v.gy) });
    const L = out.length ? out[out.length - 1] : P;
    if (f === 6 && this.behindTable(L.x, L.z)) { const sx = L.x < TW.TX ? TW.TX - TW.TRX - 0.95 : TW.TX + TW.TRX + 0.95; out.push({ x: sx, z: L.z }, { x: sx, z: ais }); }
    else out.push({ x: L.x, z: ais });
    return out;
  }
  floorPath(A, B, f, exitVia, enterVia) {
    let cur = { x: A.x, z: A.z }; const pts = [];
    if (cur.x > 6.0) { cur = { x: TW.DOOR_X, z: TW.LIFT_Z }; pts.push(cur); }
    if (Math.hypot(B.x - cur.x, B.z - cur.z) < 1.2 && !exitVia && !enterVia && !(f === 6 && (this.behindTable(cur.x, cur.z) !== this.behindTable(B.x, B.z)))) { pts.push({ x: B.x, z: B.z }); return pts; }
    const out = this.toAisle(cur, f, exitVia), inn = this.toAisle(B, f, enterVia).reverse();
    pts.push(...out, ...inn, { x: B.x, z: B.z });
    return pts.filter((p, i, a) => i === 0 || Math.hypot(p.x - a[i - 1].x, p.z - a[i - 1].z) > 0.02);
  }
  walk(id, d, fast = 1) {
    const b = this.bots.get(id); if (!b || b.hidden) return Promise.resolve(false);
    this.cancel(b);
    if (b.riding) { b.f = Math.max(0, Math.min(6, Math.round(b.g.position.y / TW.FH))); b.g.position.y = b.f * TW.FH; b.riding = false; b.plat.visible = false; }
    if (b.state === 'sofa') b.g.position.y = b.f * TW.FH;
    const A = { x: b.g.position.x, z: b.g.position.z }, B = { x: gx2x(d.gx), z: gy2z(d.gy) }, door = { x: TW.DOOR_X, z: TW.LIFT_Z };
    const enterVia = d.via ? d.via.map(v => v) : null; let segs = [];
    if (b.f === d.f) segs = this.floorPath(A, B, b.f, b.exitVia, enterVia).map(p => ({ x: p.x, z: p.z }));
    else {
      segs = this.floorPath(A, door, b.f, b.exitVia, null).map(p => ({ x: p.x, z: p.z }));
      segs.push({ x: TW.LIFT_X, z: TW.LIFT_Z }, { ride: d.f }, { x: door.x, z: door.z });
      segs.push(...this.floorPath(door, B, d.f, null, enterVia).slice(0).map(p => ({ x: p.x, z: p.z })));
    }
    b.exitVia = null; b.segs = segs; b.dest = d; b.walking = true; b.state = 'walk'; b.speed = 1.8 * fast;
    this.kick();
    return new Promise(res => { b.res = res; });
  }
  arrive(b) {
    const d = b.dest; b.walking = false; b.f = d.f; b.gx = d.gx; b.gy = d.gy; b.state = d.pose || 'stand'; b.at = d;
    b.exitVia = d.via ? [...d.via].reverse() : null; b.tRy = this.faceFor(b, d);
    if (d.pose === 'sofa') b.g.position.y = d.f * TW.FH + 0.3;
    if (b.res) { const r = b.res; b.res = null; r(true); }
  }
  stepBot(b, dt) {
    let moving = false;
    if (b.walking && b.segs.length) {
      moving = true; const s = b.segs[0];
      if (s.ride != null) {
        const ty = s.ride * TW.FH, y = b.g.position.y, sp = 5.2 * dt * (b.speed / 1.8);
        b.riding = true; b.plat.visible = true; b.tRy = -Math.PI / 2 + 0.6;
        if (Math.abs(ty - y) <= sp) { b.g.position.y = ty; b.f = s.ride; b.segs.shift(); b.riding = false; b.plat.visible = false; }
        else b.g.position.y += Math.sign(ty - y) * sp;
        if (!this._rider || this._rider === b) { this._rider = b; this.cab.position.y = b.g.position.y - 0.04; }
      } else {
        const p = b.g.position, dx = s.x - p.x, dz = s.z - p.z, dist = Math.hypot(dx, dz), st = b.speed * dt;
        if (dist > 0.001) b.tRy = Math.atan2(dx, dz);
        if (dist <= st) { p.x = s.x; p.z = s.z; b.segs.shift(); } else { p.x += dx / dist * st; p.z += dz / dist * st; }
        b.gx = x2gx(p.x); b.gy = z2gy(p.z);
      }
      if (!b.segs.length) this.arrive(b);
    }
    if (this._rider === b && !b.riding) this._rider = null;
    // turn
    let da = b.tRy - b.ry; da = Math.atan2(Math.sin(da), Math.cos(da)); b.ry += da * Math.min(1, dt * 10); b.g.rotation.y = b.ry;
    if (Math.abs(da) > 0.01) moving = true;
    // body animation
    const t = this.t + b.seed, inn = b.inner; let y = 0, sy = 1, rz = 0;
    if (this.reduce) { }
    else if (b.walking && !b.riding) { y = Math.abs(Math.sin(t * 11)) * 0.06; rz = Math.sin(t * 11) * 0.07; sy = 1 - Math.abs(Math.cos(t * 11)) * 0.04; }
    else if (b.talking) { y = Math.abs(Math.sin(t * 9)) * 0.035; sy = 1 + Math.sin(t * 18) * 0.025; }
    else if (b.state === 'type') { sy = 1 + Math.sin(t * 4.5) * 0.02; rz = Math.sin(t * 1.3) * 0.03; }
    else if (b.state === 'tap') { y = Math.abs(Math.sin(t * 7)) * 0.08; }
    else { y = (Math.sin(t * 2) + 1) * 0.012; }
    const ht = this.t - b.hopT; if (ht >= 0 && ht < 0.9) { y += Math.sin(ht / 0.9 * Math.PI) * 0.45; moving = true; sy *= 1 + Math.sin(ht / 0.9 * Math.PI * 2) * 0.06; }
    inn.position.y = y; inn.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy)); inn.rotation.z = rz;
    b.sh.scale.setScalar(0.95 - y * 0.6); b.sh.material.opacity;
    // blink
    b.blinkT -= dt; let ey = b.state === 'sofa' ? 0.45 : 1; if (b.blinkT < 0) { ey *= 0.15; if (b.blinkT < -0.12) b.blinkT = 2.5 + Math.random() * 4; }
    b.eyes.scale.y = ey;
    return moving;
  }
  // ------------------------------------------------------------------ camera
  uvOf(x, y, z) { const v = new THREE.Vector3(x, y, z).sub(this.base); return { u: v.dot(this.ax.r), v: v.dot(this.ax.up) }; }
  bounds() {
    const ext = (pts) => { let a = { u0: 1e9, u1: -1e9, v0: 1e9, v1: -1e9 }; for (const p of pts) { const q = this.uvOf(...p); a.u0 = Math.min(a.u0, q.u); a.u1 = Math.max(a.u1, q.u); a.v0 = Math.min(a.v0, q.v); a.v1 = Math.max(a.v1, q.v); } return a; };
    const yT = 6 * TW.FH, corners = [];
    for (const x of [-TW.HW, TW.LIFT_X + 0.7]) for (const z of [-TW.HD, TW.HD]) for (const y of [-0.8, yT + TW.TOPW + 0.9]) corners.push([x, y, z]);
    this.bAll = ext(corners);
    const top = []; for (const x of [-TW.HW - 0.15, TW.LIFT_X + 0.7]) for (const z of [-TW.HD, TW.HD]) for (const y of [yT - TW.SLAB, yT + TW.TOPW]) top.push([x, y, z]);
    this.bTop = ext(top);
  }
  free() { const w = this.w, h = this.h, i = this.ins; return { x: i.l, y: i.t, w: Math.max(80, w - i.l - i.r), h: Math.max(80, h - i.t - i.b), cx: i.l + (w - i.l - i.r) / 2, cy: i.t + (h - i.t - i.b) / 2 }; }
  ppu() { return this.basePPU * this.zoom; }
  clamp() { const a = this.bAll, fr = this.free(), mu = fr.w * 0.35 / this.ppu(), mv = fr.h * 0.35 / this.ppu(); this.u = Math.max(a.u0 + mu, Math.min(a.u1 - mu, this.u)); this.v = Math.max(a.v0 + mv, Math.min(a.v1 - mv, this.v)); this.zoom = Math.max(0.55, Math.min(3.2, this.zoom)); }
  applyCam() {
    const fr = this.free(), k = this.ppu(), c = this.cam;
    const t = this.base.clone().addScaledVector(this.ax.r, this.u).addScaledVector(this.ax.up, this.v);
    c.position.copy(t).addScaledVector(this.dir, 100);
    c.left = -fr.cx / k; c.right = (this.w - fr.cx) / k; c.top = fr.cy / k; c.bottom = -(this.h - fr.cy) / k;
    c.updateProjectionMatrix(); c.updateMatrixWorld();
  }
  lockCam() {
    const fr = this.free(), land = this.w > this.h * 1.3;
    const ext = pts => { const a = { u0: 1e9, u1: -1e9, v0: 1e9, v1: -1e9 }; for (const p of pts) { const q = this.uvOf(...p); a.u0 = Math.min(a.u0, q.u); a.u1 = Math.max(a.u1, q.u); a.v0 = Math.min(a.v0, q.v); a.v1 = Math.max(a.v1, q.v); } return a; };
    if (!land) {
      const t = this.bTop, k = this.basePPU;
      this.u = (t.u0 + t.u1) / 2; this.v = t.v1 - (fr.cy - fr.y - 4) / k; this.zoom = 1;
    } else {
      // whole top floor + 2-3 floors below + lift, with a little margin; table stays above the caption band
      const yT = 6 * TW.FH, pts = [];
      for (const x of [-TW.HW - 0.1, TW.LIFT_X + 0.75]) for (const z of [-TW.HD, TW.HD]) for (const y of [yT - 2.15 * TW.FH, yT + TW.TOPW + 0.35]) pts.push([x, y, z]);
      const b = ext(pts), capH = 100, m = 8;
      const k = Math.min((fr.w - 8) / (b.u1 - b.u0), (fr.h - capH - m) / (b.v1 - b.v0)) * 1.08;
      this.zoom = k / this.basePPU; this.u = (b.u0 + b.u1) / 2; this.v = b.v1 - (fr.cy - (fr.y + m)) / k;
      const tbl = this.uvOf(TW.TX, yT + 0.55, TW.TZ), capTop = fr.y + fr.h - capH;
      const tblY = fr.cy - (tbl.v - this.v) * k;
      if (tblY > capTop - 10) this.v += (tblY - (capTop - 10)) / k;
    }
    this.anim = null; this.vel.u = this.vel.v = 0; this.followId = null; this.dirty = true;
  }
  home() { this.lockCam(); }
  camTo() { this.lockCam(); }
  focusFloor(f) { this.curF = f; this.onFloor && this.onFloor(f); }
  frameTable() { this.lockCam(); }
  follow() {}
  screenOf(x, y, z) { const v = this._sv || (this._sv = new THREE.Vector3()); v.set(x, y, z).project(this.cam); return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h }; }
  stepCam() { return false; }
  // ------------------------------------------------------------------ input (tap a bot only; never move the camera, never block page scroll)
  input() {
    const el = this.r.domElement;
    const pos = e => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    let down = null;
    el.addEventListener('pointerdown', e => { const p = pos(e); down = { id: e.pointerId, x: p.x, y: p.y, t0: performance.now() }; });
    el.addEventListener('pointerup', e => {
      if (!down || down.id !== e.pointerId) return;
      const p = pos(e), d = down; down = null;
      if (Math.hypot(p.x - d.x, p.y - d.y) < 8 && performance.now() - d.t0 < 400) this.tap(p.x, p.y);
    });
    el.addEventListener('pointercancel', () => { down = null; });
  }
  tap(x, y) {
    let best = null, bd = 34;
    for (const b of this.bots.values()) { if (b.hidden || this.occluded(b)) continue; const s = this.screenOf(b.g.position.x, b.g.position.y + 0.4, b.g.position.z); const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = b; } }
    if (best && this.onBotTap) this.onBotTap(best.id);
  }
  occluded(b) { return b.f < 6 && !b.riding && b.g.position.z < 1.15 && b.g.position.x < 6; }

  // ------------------------------------------------------------------ loop & overlays
  kick() { this.dirty = true; if (this.running && !this.raf) { this.last = 0; this.raf = requestAnimationFrame(this._loop); } }
  loop(ts) {
    this.raf = 0; if (!this.running) return;
    const dt = this.last ? Math.min(0.05, (ts - this.last) / 1000) : 0.016; this.last = ts; this.t += dt;
    let act = false; for (const b of this.bots.values()) if (!b.hidden && this.stepBot(b, dt)) act = true;
    if (this.stepCam(dt, performance.now())) act = true;
    if (this.ptrs.size) act = true;
    this.raf = requestAnimationFrame(this._loop);
    if (!this.visible || !this.r) return;
    if (!act && !this.dirty && ts - this.lastDraw < 66) return;
    this.lastDraw = ts; this.dirty = false; this.draw();
  }
  draw() {
    this.applyCam(); this.r.render(this.scene, this.cam);
    const W = this.w, H = this.h;
    for (const b of this.bots.values()) {
      const show = !b.hidden && !this.occluded(b);
      if (!show) { if (b._vis !== false) { b.el.style.display = 'none'; b._vis = false; } continue; }
      const p = b.g.position, s = this.screenOf(p.x, p.y + (b.inner.position.y + TW.BOT_H) * TW.BOT_S + 0.06, p.z);
      const on = s.x > -60 && s.x < W + 60 && s.y > -40 && s.y < H + 80;
      if (!on) { if (b._vis !== false) { b.el.style.display = 'none'; b._vis = false; } continue; }
      if (b._vis !== true) { b.el.style.display = ''; b._vis = true; }
      const tf = `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0)`; if (tf !== b._tf) { b.el.style.transform = tf; b._tf = tf; }
      const st = b.needs ? 'wt' : b.state === 'sofa' ? 'br' : 'wk'; if (st !== b._st) { b.dot.className = st; b._st = st; }
      const zi = String(b.talking || b.needs ? 9000 + (s.y | 0) : 1000 + (s.y | 0)); if (zi !== b._zi) { b.el.style.zIndex = zi; b._zi = zi; }
    }
    for (const e of this._lockEls || []) { const sp = e._s, s = this.screenOf(sp.x, sp.f * TW.FH + 1.0, sp.z); e.style.transform = `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0) translate(-50%,-50%)`; e.style.display = s.x > -80 && s.x < W + 80 && s.y > -20 && s.y < H + 20 ? '' : 'none'; }
  }
  stats() {
    let moving = 0, working = 0, idle = 0;
    for (const b of this.bots.values()) { if (b.hidden || b.id === 'you') continue; if (b.walking) moving++; else if (b.state === 'sofa') idle++; else working++; }
    return { moving, working, idle };
  }
  setInsets(ins) { const k = JSON.stringify(ins); if (k === this._ik) return; this._ik = k; this.ins = Object.assign({ l: 0, r: 0, t: 0, b: 0 }, ins); this.resize(true); }
  resize(rehome) {
    const w = Math.max(1, this.root.clientWidth), h = Math.max(1, this.root.clientHeight);
    const changed = w !== this.w || h !== this.h; this.w = w; this.h = h;
    if (this.r && changed) this.r.setSize(w, h, false);
    const fr = this.free(), t = this.bTop, uw = t.u1 - t.u0, vh = t.v1 - t.v0;
    const land = w > h * 1.3;
    this.basePPU = land ? Math.min(fr.w * 0.97 / uw, fr.h * 1.02 / vh) : fr.w * 0.98 / uw;
    this.lockCam();
    if (this.running && this.r && this.visible) this.draw();
  }
  setLayout() { this.resize(true); }
  start() { if (this.running) return; this.running = true; this.kick(); }
  stop() { this.running = false; if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
}
