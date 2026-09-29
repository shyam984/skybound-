// NEON NEXUS entry point.

import { Game } from './game.js';

function start() {
  try {
    const game = new Game();
    game.boot();
    // Handy for debugging from the console; not used by the game itself.
    window.__neonNexus = game;
  } catch (err) {
    console.error(err);
    const msg = document.createElement('div');
    msg.className = 'noscript';
    msg.textContent = 'NEON NEXUS could not start in this browser. Please try a recent version of Chrome, Safari, Firefox or Edge.';
    document.body.appendChild(msg);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
