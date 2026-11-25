/* Blackrock blob bots (original design): soft dome-topped, flat-bottomed blobs with two tall white pill eyes.
   Used for 2D avatars in the HUD; the 3D tower builds the same silhouette in three.js. */
'use strict';
const BOT = {
  shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
    return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('');
  },
  _n: 0,
  // dome top, straight sides, flat rounded-corner bottom
  BODY: 'M12 50V31C12 18.5 21 10 32 10S52 18.5 52 31V50Q52 54 48 54H16Q12 54 12 50Z',
  svg(look, opt = {}) {
    const c = look.color || '#8b5cf6', id = 'bb' + (++BOT._n);
    const hi = BOT.shade(c, 0.28), lo = BOT.shade(c, -0.22);
    const eyes = opt.sleepy
      ? '<rect x="23" y="30" width="6" height="3" rx="1.5" fill="#fff"/><rect x="35" y="30" width="6" height="3" rx="1.5" fill="#fff"/>'
      : '<rect x="23" y="23" width="6" height="13" rx="3" fill="#fff"/><rect x="35" y="23" width="6" height="13" rx="3" fill="#fff"/>';
    return `<svg class="bb-svg" viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="${id}" cx="38%" cy="28%" r="80%"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${lo}"/></radialGradient></defs>`
      + `<ellipse cx="32" cy="57.5" rx="18" ry="3.2" fill="rgba(0,0,0,.28)"/>`
      + `<path d="${BOT.BODY}" fill="url(#${id})"/>`
      + `<path d="M19 22C21 16 26 13.5 31 13" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2.4" stroke-linecap="round"/>`
      + eyes + '</svg>';
  },
  avatar(look, size = 40) {
    const s = document.createElement('span'); s.className = 'avatar';
    s.style.width = s.style.height = size + 'px';
    s.style.background = `color-mix(in srgb, ${look.color || '#8b5cf6'} 18%, rgba(255,255,255,.04))`;
    s.innerHTML = BOT.svg(look); return s;
  }
};
