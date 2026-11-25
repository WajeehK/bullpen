/* Blackrock analyst bots: soft rounded robots drawn in vector, used by the tower and as avatars. */
'use strict';
const BOT = {
  shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = amt < 0 ? 0 : 255, t = Math.abs(amt);
    r = Math.round(r + (f - r) * t); g = Math.round(g + (f - g) * t); b = Math.round(b + (f - b) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  },
  rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); },
  /* Draw a bot with its feet at (x, y); s = pixels per unit (bot is ~1.25 units tall).
     o: { color, eye, pose: stand|walk|sit|sofa|talk|type|wave|tap, t, phase, back, look (-1..1), blink } */
  draw(c, x, y, s, o) {
    const col = o.color || '#8b5cf6', eye = o.eye || '#a5f3fc', t = o.t || 0, ph = o.phase || 0;
    const pose = o.pose || 'stand'; const seated = pose === 'sit' || pose === 'sofa' || pose === 'type';
    const walk = pose === 'walk';
    const bob = walk ? Math.abs(Math.sin(t * 9 + ph)) * 0.05 : seated ? Math.sin(t * 2 + ph) * 0.008 : Math.sin(t * 2.2 + ph) * 0.018;
    c.save(); c.translate(x, y); c.scale(s, s);
    // shadow
    c.fillStyle = 'rgba(10,10,25,.22)'; c.beginPath(); c.ellipse(0, 0, 0.32, 0.11, 0, 0, Math.PI * 2); c.fill();
    const dy = (seated ? 0.16 : 0) + bob;
    c.translate(0, -dy);
    const body = col, dark = BOT.shade(col, -0.28), light = BOT.shade(col, 0.22), lighter = BOT.shade(col, 0.45);
    // legs
    if (!seated) {
      const sw = walk ? Math.sin(t * 9 + ph) * 0.07 : 0;
      c.fillStyle = dark;
      BOT.rr(c, -0.16, -0.17 + Math.max(0, sw), 0.11, 0.17, 0.05); c.fill();
      BOT.rr(c, 0.05, -0.17 + Math.max(0, -sw), 0.11, 0.17, 0.05); c.fill();
    } else {
      c.fillStyle = dark; BOT.rr(c, -0.17, -0.08, 0.13, 0.08, 0.04); c.fill(); BOT.rr(c, 0.04, -0.08, 0.13, 0.08, 0.04); c.fill();
    }
    // arms (behind body when back view)
    const armA = (side) => {
      let a = 0.12 * side;
      if (walk) a = Math.sin(t * 9 + ph + (side > 0 ? Math.PI : 0)) * 0.45;
      else if (pose === 'type') a = -0.9 * side + Math.sin(t * 16 + ph + side) * 0.18;
      else if (pose === 'talk') a = side > 0 ? -0.6 + Math.sin(t * 4 + ph) * 0.35 : 0.15;
      else if (pose === 'wave') a = side > 0 ? -2.4 + Math.sin(t * 10) * 0.35 : 0.15;
      else if (pose === 'tap') a = side > 0 ? -1.3 + Math.sin(t * 14) * 0.25 : 0.15;
      else if (pose === 'sofa') a = 0.35 * side;
      c.save(); c.translate(0.31 * side, -0.52); c.rotate(a); c.fillStyle = light; BOT.rr(c, -0.05, -0.02, 0.1, 0.27, 0.05); c.fill(); c.restore();
    };
    if (o.back) { armA(-1); armA(1); }
    // body
    const g = c.createLinearGradient(0, -0.6, 0, -0.14); g.addColorStop(0, light); g.addColorStop(1, body);
    c.fillStyle = g; BOT.rr(c, -0.28, -0.6, 0.56, 0.46, 0.17); c.fill();
    if (!o.back) { c.fillStyle = 'rgba(255,255,255,.28)'; BOT.rr(c, -0.12, -0.45, 0.24, 0.12, 0.05); c.fill(); c.fillStyle = eye; c.globalAlpha = 0.9; c.beginPath(); c.arc(0.06, -0.39, 0.022, 0, 7); c.fill(); c.globalAlpha = 1; }
    if (!o.back) { armA(-1); armA(1); }
    // neck
    c.fillStyle = dark; BOT.rr(c, -0.08, -0.66, 0.16, 0.08, 0.03); c.fill();
    // head
    const hg = c.createLinearGradient(0, -1.12, 0, -0.62); hg.addColorStop(0, lighter); hg.addColorStop(1, light);
    c.fillStyle = hg; BOT.rr(c, -0.36, -1.12, 0.72, 0.5, 0.2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.08)'; c.lineWidth = 0.02; c.stroke();
    // ear pods
    c.fillStyle = body; BOT.rr(c, -0.42, -0.95, 0.08, 0.17, 0.04); c.fill(); BOT.rr(c, 0.34, -0.95, 0.08, 0.17, 0.04); c.fill();
    // antenna
    c.strokeStyle = dark; c.lineWidth = 0.035; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -1.12); c.lineTo(0, -1.25); c.stroke();
    const glow = 0.6 + 0.4 * Math.sin(t * 3 + ph);
    c.fillStyle = o.needs ? '#fbbf24' : eye; c.globalAlpha = 0.35 * glow; c.beginPath(); c.arc(0, -1.29, 0.09, 0, 7); c.fill(); c.globalAlpha = 1;
    c.beginPath(); c.arc(0, -1.29, 0.05, 0, 7); c.fill();
    if (!o.back) {
      // screen face
      c.fillStyle = '#10141f'; BOT.rr(c, -0.28, -1.04, 0.56, 0.35, 0.13); c.fill();
      c.fillStyle = 'rgba(255,255,255,.07)'; BOT.rr(c, -0.25, -1.02, 0.5, 0.1, 0.05); c.fill();
      const lx = (o.look || 0) * 0.06; const blink = o.blink ? 0.2 : 1;
      c.fillStyle = eye; c.shadowColor = eye; c.shadowBlur = 0.12 * s > 2 ? 6 : 0;
      const eh = 0.15 * blink;
      if (pose === 'sofa' && !o.blink) { // content, half-closed eyes
        c.lineWidth = 0.04; c.strokeStyle = eye; c.beginPath(); c.arc(-0.1 + lx, -0.86, 0.05, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.beginPath(); c.arc(0.1 + lx, -0.86, 0.05, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      } else {
        BOT.rr(c, -0.145 + lx, -0.87 - eh / 2, 0.085, eh, 0.04); c.fill();
        BOT.rr(c, 0.06 + lx, -0.87 - eh / 2, 0.085, eh, 0.04); c.fill();
      }
      if (pose === 'talk') { const m = 0.02 + Math.abs(Math.sin(t * 11)) * 0.03; BOT.rr(c, -0.05 + lx, -0.77, 0.1, m, 0.015); c.fill(); }
      c.shadowBlur = 0;
    } else {
      c.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 3; i++) { BOT.rr(c, -0.16, -0.98 + i * 0.08, 0.32, 0.03, 0.015); c.fill(); }
    }
    c.restore();
  },
  avatar(look, size = 40) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cv = document.createElement('canvas'); cv.width = cv.height = Math.round(size * dpr); cv.className = 'avatar'; cv.style.width = cv.style.height = size + 'px';
    const c = cv.getContext('2d'); const s = size * dpr;
    const g = c.createLinearGradient(0, 0, 0, s); g.addColorStop(0, BOT.shade(look.color, 0.75)); g.addColorStop(1, BOT.shade(look.color, 0.55));
    c.fillStyle = g; BOT.rr(c, 0, 0, s, s, s * 0.3); c.fill();
    BOT.draw(c, s / 2, s * 1.08, s * 0.72, { color: look.color, eye: look.eye, pose: 'stand', t: 0.6 });
    return cv;
  }
};
