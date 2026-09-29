// Inline SVG icon set (24×24). Currency icons carry their own colours so
// they read the same everywhere; the rest use currentColor.

const P = {
  coin: '<circle cx="12" cy="12" r="10" fill="#ffc93a"/><circle cx="12" cy="12" r="7.2" fill="#ffab1f"/><path d="M12 7.2l1.4 3 3.2.3-2.4 2.1.7 3.2L12 14.2l-2.9 1.6.7-3.2-2.4-2.1 3.2-.3z" fill="#fff3b0"/><path d="M6 8.5a7 7 0 0 1 4-3.6" stroke="#fff6cf" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  energy: '<path d="M13.6 2 5 13.4h5.6L9.4 22 19 10h-5.8z" fill="#35e8ff" stroke="#bff8ff" stroke-width="1.2" stroke-linejoin="round"/>',
  xp: '<path d="M12 2.5l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8z" fill="#b88cff" stroke="#e8d8ff" stroke-width="1.2" stroke-linejoin="round"/>',
  star: '<path d="M12 2.5l2.9 5.9 6.4.9-4.6 4.5 1.1 6.4L12 17.2l-5.8 3 1.1-6.4-4.6-4.5 6.4-.9z" fill="currentColor"/>',
  shield: '<path d="M12 2.5 20 5.5v6.2c0 5-3.4 8.6-8 9.8-4.6-1.2-8-4.8-8-9.8V5.5z" fill="currentColor"/>',
  play: '<path d="M8 5.2v13.6a1 1 0 0 0 1.5.9l10.7-6.8a1 1 0 0 0 0-1.8L9.5 4.3A1 1 0 0 0 8 5.2z" fill="currentColor"/>',
  pause: '<rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="currentColor"/>',
  gear: '<path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm9 4.6-.1-2.4-2.2-.6a7 7 0 0 0-.8-1.8l1.1-2-1.7-1.7-2 1.1c-.6-.4-1.2-.6-1.8-.8L13.2 3h-2.4l-.6 2.2c-.6.2-1.2.4-1.8.8l-2-1.1-1.7 1.7 1.1 2c-.4.6-.6 1.2-.8 1.8L3 11v2.4l2.2.6c.2.6.4 1.2.8 1.8l-1.1 2 1.7 1.7 2-1.1c.6.4 1.2.6 1.8.8l.6 2.2h2.4l.6-2.2c.6-.2 1.2-.4 1.8-.8l2 1.1 1.7-1.7-1.1-2c.4-.6.6-1.2.8-1.8z" fill="currentColor"/>',
  close: '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
  back: '<path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="3" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2.4" fill="none"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  nex: '<path d="M12 3.5c4.6 0 8 3.2 8 7.6 0 4.7-3.6 8.5-8 9.4-4.4-.9-8-4.7-8-9.4 0-4.4 3.4-7.6 8-7.6z" fill="currentColor"/><circle cx="9" cy="10.5" r="2" fill="#0b1030"/><circle cx="15" cy="10.5" r="2" fill="#0b1030"/><circle cx="12" cy="15.5" r="1.6" fill="#0b1030"/><path d="M9 4.5 7.5 1.8M15 4.5l1.5-2.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  island: '<path d="M3 11.5c0-2 4-3.5 9-3.5s9 1.5 9 3.5-4 3.5-9 3.5-9-1.5-9-3.5z" fill="currentColor"/><path d="M5 13.5l4 7 3 1.5 3-1.5 4-7" fill="currentColor" opacity=".6"/><path d="M12 8V3.5l3.5 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  missions: '<rect x="4.5" y="3.5" width="15" height="17" rx="3" fill="currentColor" opacity=".35"/><path d="M8 9l1.5 1.5L12.5 7.5M8 15l1.5 1.5 3-3M14.5 9.5H17M14.5 15.5H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  shop: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" fill="currentColor"/><path d="M9 10V7a3 3 0 0 1 6 0v3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  trophy: '<path d="M7 3.5h10v5a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M10 13.5h4l.5 4h-5zM7.5 17.5h9v3h-9z" fill="currentColor"/>',
  build: '<path d="M14.5 4.2a4.5 4.5 0 0 0-5.3 5.9l-5 5a1.8 1.8 0 0 0 2.6 2.6l5-5a4.5 4.5 0 0 0 5.9-5.3l-2.6 2.6-2.4-.4-.4-2.4z" fill="currentColor"/>',
  hub: '<rect x="9" y="6" width="6" height="14" rx="2" fill="currentColor"/><rect x="3.5" y="11" width="4.5" height="9" rx="1.8" fill="currentColor" opacity=".7"/><rect x="16" y="11" width="4.5" height="9" rx="1.8" fill="currentColor" opacity=".7"/><circle cx="12" cy="3.5" r="2" fill="currentColor"/>',
  decor: '<circle cx="12" cy="8" r="3" fill="currentColor"/><circle cx="7.5" cy="11" r="3" fill="currentColor" opacity=".75"/><circle cx="16.5" cy="11" r="3" fill="currentColor" opacity=".75"/><circle cx="12" cy="11" r="2" fill="#0b1030"/><path d="M12 13.5V21M12 17c-2 0-3.5-1-4-2.5M12 18c2 0 3.2-.8 3.8-2.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  sparkle: '<path d="M12 2.5c.6 4.3 2.5 6.4 7 7-4.5.6-6.4 2.7-7 7-.6-4.3-2.5-6.4-7-7 4.5-.6 6.4-2.7 7-7zM18.5 14.5c.3 2 1.1 2.8 3 3.1-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3.1z" fill="currentColor"/>',
  combo: '<path d="M12 2.5c1 3.3 5.5 5.2 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.4 1.1-3.8 2.3-5 .2 1.7 1 2.6 2 3-.4-3.5.2-6 1.2-8.5z" fill="currentColor"/>',
  flag: '<path d="M6 21V4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M6.5 4.5h11l-2.5 4 2.5 4h-11z" fill="currentColor"/>',
  mission: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M12 13.5V9.5M9.5 2.5h5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  music: '<path d="M9 18V6l10-2v12" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.8" fill="currentColor"/><circle cx="16.5" cy="16" r="2.8" fill="currentColor"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M6 10h1M9.5 10h1M13 10h1M16.5 10h1M7 14h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M4 3.5v4.5h4.5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  gift: '<rect x="3.5" y="9" width="17" height="4" rx="1.2" fill="currentColor"/><rect x="5" y="13" width="14" height="8" rx="1.5" fill="currentColor" opacity=".75"/><path d="M12 9v12M12 9c-1.5-3.5-5.5-4-5.5-1.5S10 9 12 9zm0 0c1.5-3.5 5.5-4 5.5-1.5S14 9 12 9z" stroke="#0b1030" stroke-width="1.5" fill="none"/>',
  fragment: '<path d="M12 2.5l6 6-2 11-8 2-3.5-8z" fill="currentColor"/><path d="M12 2.5 11 13l5 6.5M11 13l-6.5.5" stroke="#0b1030" stroke-width="1.2" opacity=".5" fill="none"/>',
  arrow: '<path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="currentColor"/>',
};

export function icon(name, cls = '') {
  const body = P[name] || P.sparkle;
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}
