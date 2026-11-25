/* Grok Bot characters: flat solid geometric/organic shapes with angled white pill eyes and subtle role accessories.
   Rendered as inline SVG with transform-only CSS animations. */
'use strict';
const BOT = {
  SHAPES: {
    circle: '<circle cx="32" cy="35" r="21"/>',
    pebble: '<path d="M11 37C9.5 22 21.5 13 33.5 14C46.5 15 53.5 25 52.5 37C51.5 48.5 41.5 56 29.5 55C16.5 54 12.5 47.5 11 37Z"/>',
    squircle: '<rect x="11" y="14" width="42" height="42" rx="14"/>',
    pill: '<rect x="8" y="20" width="48" height="31" rx="15.5"/>',
    triangle: '<path d="M27.8 14.5Q32 8.5 36.2 14.5L52 44Q55.5 51 48 53Q32 55.5 16 53Q8.5 51 12 44Z"/>',
    hex: '<path d="M29 12Q32 10.5 35 12L49.5 20.5Q52.5 22.2 52.5 25.5L52.5 42.5Q52.5 45.8 49.5 47.5L35 56Q32 57.5 29 56L14.5 47.5Q11.5 45.8 11.5 42.5L11.5 25.5Q11.5 22.2 14.5 20.5Z"/>',
    cloud: '<path d="M18 51H46C52 51 56 46 55 40C54.5 35.5 51 32.5 47 32C46 23 39 17 31 17C23.5 17 17.5 22.5 16.5 30C11.5 31 8 35.5 8.5 41C9 46.5 13 51 18 51Z"/>',
    droplet: '<path d="M32 11C34.5 11 49 27.5 49 39.5C49 49.2 41.4 56 32 56C22.6 56 15 49.2 15 39.5C15 27.5 29.5 11 32 11Z"/>'
  },
  // Signature tilted white pill eyes per shape (like Grok Bot's opening-quote ticks)
  EYES: {
    circle:   [[36.5, 29, -18], [44.5, 27.5, -18]],
    pebble:   [[26, 33, 19],    [34.5, 33, -19]],
    squircle: [[37, 27.5, -16], [45, 26.5, -16]],
    pill:     [[35.5, 30, -18], [43.5, 29, -18]],
    triangle: [[35, 31, -18],   [42, 30, -18]],
    hex:      [[26.5, 33, 20],  [35.5, 33, -20]],
    cloud:    [[35.5, 32, -16], [43.5, 31, -16]],
    droplet:  [[34.5, 35, -18], [41.5, 34, -18]]
  },
  // Subtle, minimal role accessories so every bot still unmistakably reads as a Grok Bot
  ACC: {
    chartist:  '<path d="M14 23C19 11 45 11 50 23" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="2.6" stroke-linecap="round"/><circle cx="13" cy="26" r="3.4" fill="rgba(255,255,255,.9)"/>',
    quant:     '<g fill="none" stroke="rgba(255,255,255,.85)" stroke-width="2"><circle cx="26.5" cy="33" r="5.5"/><circle cx="37.5" cy="33" r="5.5"/><path d="M32 33h0"/></g>',
    accountant:'<path d="M29 20.5h18c1.5 0 2.5 1 2 2.5l-1.5 2.5H30.5z" fill="#065f46" opacity=".88"/><rect x="17" y="42" width="10" height="7" rx="2" fill="rgba(255,255,255,.26)"/>',
    crypto:    '<circle cx="19" cy="44" r="5.5" fill="rgba(255,255,255,.25)"/><path d="M19 40.5v7M17.2 42h3.2c1 0 1.4.6 1.4 1.2s-.4 1.1-1.4 1.1h-3.2M17.2 44.3h3.4c1 0 1.5.5 1.5 1.2s-.5 1.2-1.5 1.2h-3.4" fill="none" stroke="#fff" stroke-width="1.15" stroke-linecap="round"/>',
    reporter:  '<circle cx="18" cy="45" r="4" fill="rgba(255,255,255,.28)"/><path d="M18 43v4M16 45h4" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>',
    macro:     '<circle cx="18" cy="41" r="5.2" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.3"/><ellipse cx="18" cy="41" rx="2.4" ry="5.2" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.1"/><path d="M13 41h10" stroke="rgba(255,255,255,.7)" stroke-width="1.1"/>',
    insider:   '<path d="M29 31.5l17-1.6-.6 4.6c-.4 2-2 3.2-4 3l-2.5-.2-1-2-1.4 2.1-2.6.2c-2 .1-3.6-1-4-3z" fill="#0f172a" opacity=".85"/>',
    bear:      '<circle cx="15" cy="20" r="6" fill="currentColor"/><circle cx="49" cy="20" r="6" fill="currentColor"/><circle cx="15" cy="20" r="3" fill="rgba(0,0,0,.22)"/><circle cx="49" cy="20" r="3" fill="rgba(0,0,0,.22)"/>',
    earnings:  '<rect x="19" y="40" width="9" height="8" rx="2" fill="rgba(255,255,255,.26)"/><path d="M19 42.5h9" stroke="#fff" stroke-width="1.2"/>',
    boss:      '<path d="M21 18l3.5-8 6 5.5 6-5.5L40 18z" fill="#fde68a" stroke="#b45309" stroke-width="1" stroke-linejoin="round"/>',
    you:       '<path d="M15 24C20 12 44 12 49 24" fill="none" stroke="rgba(255,255,255,.82)" stroke-width="2.2" stroke-linecap="round"/><circle cx="14" cy="27" r="3" fill="#fff"/>'
  },
  shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = amt < 0 ? 0 : 255, t = Math.abs(amt);
    r = Math.round(r + (f - r) * t); g = Math.round(g + (f - g) * t); b = Math.round(b + (f - b) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  },
  svg(look, opt = {}) {
    const sh = look.shape || 'circle', col = look.color || '#1d9bf0', role = look.role || '';
    const body = BOT.SHAPES[sh] || BOT.SHAPES.circle;
    const eyes = BOT.EYES[sh] || BOT.EYES.circle;
    const acc = BOT.ACC[role] || '';
    const eh = sh === 'pill' || sh === 'triangle' ? 9.5 : 10.5;
    const ew = 4.6;
    const eyeSVG = eyes.map(([x, y, a]) => `<rect x="${x - ew / 2}" y="${y - eh / 2}" width="${ew}" height="${eh}" rx="${ew / 2}" fill="#ffffff" transform="rotate(${a} ${x} ${y})"/>`).join('');
    const shadow = opt.shadow ? '<ellipse class="gb-sh" cx="32" cy="57" rx="16" ry="4.5" fill="rgba(10,12,24,.28)"/>' : '';
    const cls = opt.cls ? ' ' + opt.cls : '';
    const delay = opt.delay != null ? ` style="animation-delay:${opt.delay.toFixed(2)}s"` : '';
    return `<svg viewBox="0 0 64 64" class="gbot-svg${cls}" aria-hidden="true">${shadow}<g class="gb-body" style="color:${col}"${delay}><g fill="${col}">${role === 'bear' ? acc : ''}${body}</g>${role === 'bear' ? '' : acc}<g class="gb-eyes">${eyeSVG}</g></g></svg>`;
  },
  avatar(look, size = 40) {
    const wrap = document.createElement('span');
    wrap.className = 'avatar';
    wrap.style.width = wrap.style.height = size + 'px';
    wrap.style.background = `linear-gradient(180deg, ${BOT.shade(look.color, 0.78)}, ${BOT.shade(look.color, 0.58)})`;
    wrap.innerHTML = BOT.svg(look, { shadow: false });
    return wrap;
  }
};
