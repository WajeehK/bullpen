/* Bullpen pixel kit: tiny font, crisp polygons, procedural character sprites. All art is drawn in code. */
'use strict';
const PX = (() => {
  const OUT = '#120e1a';
  // 3x5 font, rows top->bottom, 3 bits each
  const G = {
    'A':'010101111101101','B':'110101110101110','C':'011100100100011','D':'110101101101110','E':'111100110100111','F':'111100110100100',
    'G':'011100101101011','H':'101101111101101','I':'111010010010111','J':'001001001101010','K':'101101110101101','L':'100100100100111',
    'M':'101111111101101','N':'110101101101101','O':'010101101101010','P':'110101110100100','Q':'010101101111011','R':'110101110101101',
    'S':'011100010001110','T':'111010010010010','U':'101101101101111','V':'101101101101010','W':'101101111111101','X':'101101010101101',
    'Y':'101101010010010','Z':'111001010100111','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110',
    '4':'101101111001001','5':'111100110001110','6':'011100111101111','7':'111001010010010','8':'111101111101111','9':'111101111001110',
    '.':'000000000000010',',':'000000000010100','%':'101001010100101','+':'000010111010000','-':'000000111000000','$':'011110010011110',
    '£':'011010111010111','!':'010010010000010','?':'110001010000010',':':'000010000010000','/':'001001010100100',' ':'000000000000000',
    '^':'010101000000000','=':'000111000111000','(':'010100100100010',')':'010001001001010','#':'101111101111101','>':'100010001010100','<':'001010100010001',
    '*':'000101010101000','\'':'010010000000000','&':'010101010101011','~':'000011110000000'
  };
  function textW(s) { return s.length * 4 - 1; }
  function text(ctx, s, x, y, col) {
    ctx.fillStyle = col;
    s = String(s).toUpperCase();
    for (let i = 0; i < s.length; i++) {
      const g = G[s[i]] || G['?'];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r * 3 + c] === '1') ctx.fillRect(x + i * 4 + c, y + r, 1, 1);
    }
  }
  // integer scanline polygon fill (no antialiasing)
  function poly(ctx, pts, col) {
    ctx.fillStyle = col;
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    minY = Math.floor(minY); maxY = Math.ceil(maxY);
    for (let y = minY; y < maxY; y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const x0 = Math.round(xs[i]), x1 = Math.round(xs[i + 1]);
        if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1);
      }
    }
  }
  function outline(cv, col) {
    const ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
    const im = ctx.getImageData(0, 0, w, h), d = im.data, o = new Uint8ClampedArray(d);
    const c = hex(col || OUT);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] > 0) continue;
      const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && d[(yy * w + xx) * 4 + 3] > 0;
      if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) { o[i] = c[0]; o[i + 1] = c[1]; o[i + 2] = c[2]; o[i + 3] = 255; }
    }
    im.data.set(o); ctx.putImageData(im, 0, 0);
    return cv;
  }
  function hex(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function shade(h, f) { const c = hex(h); const m = v => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)))); return '#' + c.map(m).map(v => v.toString(16).padStart(2, '0')).join(''); }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // ---------------------------------------------------------------- characters
  // look: {skin, hair, shirt, pants, shoes, acc:[...], accent, hairStyle}
  const SW = 16, SH = 26;
  function drawChar(look, o) {
    // o: {view:'front'|'back', frame:0..3, state:'stand'|'walk'|'talk'|'type'|'tap'|'cheer', blink, mouth}
    const cv = canvas(SW, SH), c = cv.getContext('2d');
    const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const sk = look.skin, skS = shade(sk, -0.18), hr = look.hair, hrH = shade(hr, 0.25), sh = look.shirt, shS = shade(sh, -0.25), shH = shade(sh, 0.18);
    const pa = look.pants || '#2b2f45', paS = shade(pa, -0.25), so = look.shoes || '#1a1a22';
    const acc = look.acc || [];
    const back = o.view === 'back';
    const f = o.frame || 0, st = o.state || 'stand';
    const walk = st === 'walk';
    const bob = (walk && (f === 1 || f === 3)) ? -1 : 0;
    const cheer = st === 'cheer';
    const by = 1 + bob + (cheer && f % 2 ? -2 : 0); // base y offset
    // legs
    let lL = 0, rL = 0;
    if (walk) { lL = f === 0 ? -1 : f === 2 ? 1 : 0; rL = -lL; }
    const legTop = 17 + by;
    R(5, legTop, 2, 5 + (lL < 0 ? -1 : 0), pa); R(9, legTop, 2, 5 + (rL < 0 ? -1 : 0), paS);
    R(4 + (lL > 0 ? -1 : 0), legTop + 5 + (lL < 0 ? -1 : 0), 3, 1, so);
    R(9 + (rL > 0 ? 1 : 0), legTop + 5 + (rL < 0 ? -1 : 0), 3, 1, so);
    // torso
    const tTop = 11 + by;
    const coat = acc.includes('labcoat') ? '#e9eef5' : acc.includes('trench') ? '#b8935a' : null;
    R(4, tTop, 8, 7, coat || sh);
    R(11, tTop, 1, 7, coat ? shade(coat, -0.2) : shS);
    R(4, tTop, 1, 6, coat ? shade(coat, 0.15) : shH);
    if (coat && !back) { R(7, tTop, 2, 7, sh); R(6, tTop + 1, 1, 6, shade(coat, -0.12)); R(9, tTop + 1, 1, 6, shade(coat, -0.12)); }
    if (acc.includes('suit') && !back) { R(7, tTop, 2, 3, '#f1f1f1'); R(6, tTop, 1, 4, shS); R(9, tTop, 1, 4, shS); }
    if (acc.includes('vest') && !back) { R(5, tTop + 1, 6, 5, look.accent || '#4b4f63'); R(7, tTop, 2, 6, '#f4f4f4'); R(7, tTop + 1, 2, 1, look.tie || '#c0392b'); }
    if (acc.includes('tie') && !back) { R(7, tTop, 2, 1, shade(look.tie || '#d4a017', -0.2)); R(7, tTop + 1, 2, 4, look.tie || '#d4a017'); R(7, tTop + 5, 2, 1, shade(look.tie || '#d4a017', -0.3)); }
    if (acc.includes('hoodie')) { R(4, tTop, 8, 1, shS); if (!back) { R(6, tTop + 1, 1, 3, '#e8e8e8'); R(9, tTop + 1, 1, 3, '#e8e8e8'); R(5, tTop + 4, 6, 2, shS); } }
    if (acc.includes('logo') && !back) { R(6, tTop + 2, 4, 3, look.accent || '#f7931a'); R(7, tTop + 3, 2, 1, sh); }
    if (acc.includes('press') && !back) { R(9, tTop + 1, 2, 2, '#f4f1de'); }
    R(4, tTop + 6, 8, 1, shade(pa, -0.1)); // belt
    // arms
    const armCol = coat || sh, armS = coat ? shade(coat, -0.2) : shS;
    let aL = 0, aR = 0;
    if (walk) { aL = f === 0 ? 1 : f === 2 ? -1 : 0; aR = -aL; }
    if (st === 'type') { aL = (f % 2) ? -1 : 0; aR = (f % 2) ? 0 : -1; }
    if (st === 'talk') { aR = f % 2 ? -3 : -1; }
    if (st === 'tap') { aR = -5 + (f % 2); }
    if (cheer) { aL = -6; aR = -6; }
    // left arm
    if (aL <= -4) { R(2, tTop - 4, 2, 6, armCol); R(2, tTop - 6, 2, 2, sk); }
    else { R(2, tTop + 1 + Math.min(aL, 0), 2, 5, armCol); R(2, tTop + 6 + aL, 2, 1, sk); }
    if (aR <= -4) { R(12, tTop - 4, 2, 6, armS); R(12, tTop - 6, 2, 2, sk); }
    else { R(12, tTop + 1 + Math.min(aR, 0), 2, 5, armS); R(12, tTop + 6 + aR, 2, 1, sk); }
    if (acc.includes('clipboard') && !back && aL > -4) { R(1, tTop + 3, 3, 4, '#c79a5b'); R(1, tTop + 4, 3, 2, '#f7f3e8'); }
    // head
    const hTop = 2 + by;
    R(4, hTop + 1, 8, 8, sk);
    R(11, hTop + 2, 1, 7, skS);
    R(5, hTop + 9, 6, 1, skS); // neck shadow
    if (!back) {
      // eyes
      const ey = hTop + 5;
      if (o.blink) { R(5, ey + 1, 2, 1, shade(sk, -0.4)); R(9, ey + 1, 2, 1, shade(sk, -0.4)); }
      else { R(5, ey, 2, 2, '#ffffff'); R(6, ey, 1, 2, '#1b1530'); R(9, ey, 2, 2, '#ffffff'); R(10, ey, 1, 2, '#1b1530'); }
      R(4, hTop + 7, 1, 1, shade(sk, -0.08)); // cheek
      if (look.blush) { R(4, ey + 2, 1, 1, '#f08a8a'); R(11, ey + 2, 1, 1, '#f08a8a'); }
      // mouth
      if (o.mouth) { R(7, hTop + 8, 2, 1, '#7a2234'); }
      else R(7, hTop + 8, 2, 1, shade(sk, -0.35));
      if (look.mustache) R(6, hTop + 7, 4, 1, hr);
      if (look.beard) { R(4, hTop + 7, 1, 2, hr); R(11, hTop + 7, 1, 2, hr); R(5, hTop + 8, 6, 1, hr); }
    }
    // hair
    const hs = look.hairStyle || 'short';
    if (hs === 'bald') { R(4, hTop + 2, 1, 3, hr); R(11, hTop + 2, 1, 3, hr); R(5, hTop + 1, 2, 1, shade(sk, 0.35)); if (back) R(4, hTop + 2, 8, 5, sk); }
    else {
      R(4, hTop, 8, 3, hr); R(5, hTop - 1, 6, 1, hr); R(5, hTop, 3, 1, hrH);
      R(3, hTop + 1, 1, 5, hr); R(12, hTop + 1, 1, 5, hr);
      if (hs === 'long') { R(3, hTop + 1, 2, 10, hr); R(11, hTop + 1, 2, 10, hr); }
      if (hs === 'spiky') { R(4, hTop - 2, 1, 2, hr); R(7, hTop - 2, 1, 2, hr); R(10, hTop - 2, 1, 2, hr); }
      if (hs === 'bun') { R(6, hTop - 3, 4, 3, hr); }
      if (hs === 'side') { R(4, hTop + 3, 3, 1, hr); }
      if (back) { R(3, hTop, 10, 8, hr); R(5, hTop, 3, 1, hrH); }
    }
    // accessories on head
    if (acc.includes('glasses') && !back) { const ey = hTop + 5; R(4, ey - 1, 4, 1, '#20202a'); R(8, ey - 1, 4, 1, '#20202a'); R(4, ey + 2, 4, 1, '#20202a'); R(8, ey + 2, 4, 1, '#20202a'); R(4, ey, 1, 2, '#20202a'); R(7, ey, 2, 1, '#20202a'); R(11, ey, 1, 2, '#20202a'); }
    if (acc.includes('shades') && !back) { const ey = hTop + 5; R(4, ey, 8, 2, '#0b0b12'); R(5, ey, 2, 1, '#5d6a8a'); R(9, ey, 2, 1, '#5d6a8a'); }
    if (acc.includes('headphones')) { R(3, hTop - 1, 10, 1, '#2a2d3a'); R(2, hTop + 3, 2, 4, look.accent || '#38bdf8'); R(12, hTop + 3, 2, 4, look.accent || '#38bdf8'); }
    if (acc.includes('visor')) { R(3, hTop + 1, 10, 2, '#22c55e'); R(2, hTop + 3, 12, 1, 'rgba(34,197,94,0.75)'); }
    if (acc.includes('fedora')) { R(1, hTop + 1, 14, 1, '#5b4636'); R(4, hTop - 3, 8, 4, '#6d5644'); R(4, hTop, 8, 1, '#2a1f18'); if (!back) R(10, hTop - 2, 2, 2, '#f4f1de'); }
    if (acc.includes('bearhood')) { R(3, hTop - 1, 10, 4, '#7a5134'); R(3, hTop + 3, 1, 6, '#7a5134'); R(12, hTop + 3, 1, 6, '#7a5134'); R(2, hTop - 3, 3, 3, '#7a5134'); R(11, hTop - 3, 3, 3, '#7a5134'); R(3, hTop - 2, 1, 1, '#d98b8b'); R(12, hTop - 2, 1, 1, '#d98b8b'); if (back) R(3, hTop, 10, 9, '#7a5134'); }
    if (acc.includes('beanie')) { R(3, hTop - 2, 10, 4, look.accent || '#f7931a'); R(3, hTop + 1, 10, 1, shade(look.accent || '#f7931a', -0.25)); R(7, hTop - 4, 2, 2, '#fff1c1'); }
    if (acc.includes('cap')) { R(3, hTop - 1, 10, 3, look.accent || '#ef4444'); if (!back) R(2, hTop + 2, 7, 1, shade(look.accent || '#ef4444', -0.3)); }
    if (acc.includes('crown')) { R(4, hTop - 3, 8, 2, '#f5c542'); R(4, hTop - 5, 1, 2, '#f5c542'); R(7, hTop - 5, 2, 2, '#f5c542'); R(11, hTop - 5, 1, 2, '#f5c542'); R(7, hTop - 2, 2, 1, '#e11d48'); }
    if (acc.includes('pencil') && !back) { R(12, hTop + 2, 1, 4, '#f5c542'); R(12, hTop + 2, 1, 1, '#f9a8d4'); }
    return outline(cv);
  }
  const cache = new Map();
  function sprite(key, look, o) {
    const k = key + '|' + (o.view || 'front') + '|' + (o.state || 'stand') + '|' + (o.frame || 0) + '|' + (o.blink ? 1 : 0) + '|' + (o.mouth ? 1 : 0);
    let s = cache.get(k);
    if (!s) { s = drawChar(look, o); cache.set(k, s); }
    return s;
  }
  return { text, textW, poly, outline, shade, hex, canvas, sprite, drawChar, SW, SH, OUT };
})();
