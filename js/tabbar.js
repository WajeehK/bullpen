/* Liquid glass tab bar: spring-driven pill that stretches toward its direction of travel, a gooey trailing drop,
   bouncing icons and press-and-drag scrubbing. Falls back to instant moves for prefers-reduced-motion. */
'use strict';
const TabBar = {
  init(nav, onSelect) {
    this.nav = nav; this.onSelect = onSelect; this.btns = [...nav.querySelectorAll('.tab-b')];
    this.pill = nav.querySelector('.tb-pill'); this.drop = nav.querySelector('.tb-drop'); this.rim = nav.querySelector('.tb-rim');
    this.mq = matchMedia('(prefers-reduced-motion: reduce)'); this.idx = 0;
    this.x = null; this.v = 0; this.dx = 0; this.dv = 0; this.target = 0; this.drag = false; this.raf = 0;
    const measure = () => { this.layout(); this.snap(); };
    new ResizeObserver(measure).observe(nav); addEventListener('orientationchange', () => setTimeout(measure, 200));
    nav.addEventListener('pointerdown', e => {
      if (e.button) return; nav.setPointerCapture(e.pointerId); this.drag = true; this.moved = 0; this.p0 = this.coord(e);
      this.target = this.clampPos(this.coord(e)); nav.classList.add('scrub'); this.kick();
    });
    nav.addEventListener('pointermove', e => { if (!this.drag) return; const p = this.coord(e); this.moved = Math.max(this.moved, Math.abs(p - this.p0)); this.target = this.clampPos(p); this.kick(); });
    const end = e => { if (!this.drag) return; this.drag = false; nav.classList.remove('scrub'); const i = this.nearest(this.target); this.set(i); this.onSelect(i); };
    nav.addEventListener('pointerup', end); nav.addEventListener('pointercancel', end);
    this.btns.forEach((b, i) => b.addEventListener('click', e => { if (e.detail === 0) { this.set(i); this.onSelect(i); } }));
    measure();
  },
  get vert() { return this.nav.classList.contains('rail') || getComputedStyle(this.nav).flexDirection === 'column'; },
  coord(e) { const r = this.nav.getBoundingClientRect(); return this.vert ? e.clientY - r.top : e.clientX - r.left; },
  layout() {
    const r = this.nav.getBoundingClientRect(); this.centers = this.btns.map(b => { const q = b.getBoundingClientRect(); return this.vert ? q.top - r.top + q.height / 2 : q.left - r.left + q.width / 2; });
    const q = this.btns[0].getBoundingClientRect(); this.bw = q.width; this.bh = q.height;
    this.cross = this.vert ? r.width / 2 : r.height / 2;
  },
  clampPos(p) { return Math.max(this.centers[0], Math.min(this.centers[this.centers.length - 1], p)); },
  nearest(p) { let best = 0, bd = 1e9; this.centers.forEach((c, i) => { const d = Math.abs(c - p); if (d < bd) { bd = d; best = i; } }); return best; },
  set(i) {
    const prev = this.idx; this.idx = i; this.target = this.centers ? this.centers[i] : 0;
    this.btns.forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i); });
    if (prev !== i && !this.mq.matches) { const ic = this.btns[i]; ic.classList.remove('bounce'); void ic.offsetWidth; ic.classList.add('bounce'); }
    this.kick();
  },
  snap() { if (!this.centers) return; this.target = this.centers[this.idx]; this.x = this.dx = this.target; this.v = this.dv = 0; this.paint(); },
  kick() { if (this.mq.matches) { this.x = this.dx = this.target; this.v = this.dv = 0; this.paint(); return; } if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(t => this.tick(t)); } },
  tick(now) {
    const dt = Math.min(0.032, (now - this.last) / 1000); this.last = now; this.raf = 0;
    if (this.x == null) this.x = this.dx = this.target;
    const k = this.drag ? 900 : 380, c = this.drag ? 48 : 24;
    // integrate in small steps for stability
    for (let s = 0; s < 4; s++) { const h = dt / 4; const a = -k * (this.x - this.target) - c * this.v; this.v += a * h; this.x += this.v * h; const a2 = -150 * (this.dx - this.x) - 17 * this.dv; this.dv += a2 * h; this.dx += this.dv * h; }
    this.paint();
    if (Math.abs(this.v) > 2 || Math.abs(this.x - this.target) > 0.3 || Math.abs(this.dx - this.x) > 0.3 || this.drag) this.raf = requestAnimationFrame(t => this.tick(t));
    else { this.x = this.dx = this.target; this.v = this.dv = 0; this.paint(); }
  },
  paint() {
    if (this.x == null || !this.centers) return;
    const red = this.mq.matches; const st = red ? 0 : Math.min(0.55, Math.abs(this.v) / 1500); const press = this.drag && !red ? 0.06 : 0;
    const w = this.bw, h = this.bh, V = this.vert;
    const along = 1 + st + press, across = 1 - st * 0.32 + press * 0.5;
    const sx = V ? across : along, sy = V ? along : across;
    const tx = V ? this.cross - w / 2 : this.x - w / 2, ty = V ? this.x - h / 2 : this.cross - h / 2;
    const tf = `translate(${tx}px,${ty}px) scale(${sx},${sy})`;
    this.pill.style.width = this.rim.style.width = w + 'px'; this.pill.style.height = this.rim.style.height = h + 'px';
    this.pill.style.transform = tf; this.rim.style.transform = tf;
    const ds = Math.min(w, h) * (0.55 + Math.min(0.35, Math.abs(this.dx - this.x) / 120));
    this.drop.style.width = this.drop.style.height = ds + 'px';
    this.drop.style.transform = V ? `translate(${this.cross - ds / 2}px,${this.dx - ds / 2}px)` : `translate(${this.dx - ds / 2}px,${this.cross - ds / 2}px)`;
    this.btns.forEach((b, i) => { const d = Math.abs(this.centers[i] - this.x) / (V ? h : w); const m = red ? 1 : 1 + 0.14 * Math.max(0, 1 - d); b.style.setProperty('--mag', m.toFixed(3)); b.classList.toggle('near', d < 0.5); });
  }
};
