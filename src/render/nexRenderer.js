// Procedural Nex characters.
//
// drawNex(ctx, id, state) draws a Nex centred at (state.x, state.y).
// Every Nex has its own body renderer so silhouettes are genuinely different
// (Bolt: antennae + teardrop, Luma: wide body + floating fins, Echo: tall
// body + orbit rings, Flux: dissolving droplet, Nova: spiky star).
//
// state fields (all optional):
//   t        time in seconds (drives idle animation)
//   scale    size multiplier (body radius is 20 units at scale 1)
//   alpha    opacity
//   lean     body tilt in radians
//   look     {x, y} gaze direction (-1..1)
//   blink    0 = open, 1 = closed
//   expr     'idle' | 'happy' | 'excited' | 'hurt' | 'sad' | 'focus'
//   core     0..1 extra core brightness
//   speed    0..1 normalised speed (antennae sweep back, etc.)
//   ability  true while the ability is active
//   flat     a colour: draw a flat silhouette only (locked cards, afterimages)
//   palette  colours (base palette merged with the equipped skin)
//   quality  'low' | 'medium' | 'high'

import { TAU } from '../core/math.js';
import { glow, ellipsePath, circle, starPath, polyPath, rgba } from './draw.js';
import { NEX } from '../data/nex.js';

const R = 20;

export function drawNex(ctx, id, s) {
  const fn = BODIES[id] || BODIES.bolt;
  const P = s.palette || NEX[id]?.palette || NEX.bolt.palette;
  ctx.save();
  ctx.translate(s.x || 0, s.y || 0);
  const sc = s.scale || 1;
  ctx.scale(sc, sc);
  if (s.alpha != null) ctx.globalAlpha *= s.alpha;
  if (s.lean) ctx.rotate(s.lean);
  if (s.squash) ctx.scale(1 + s.squash, 1 - s.squash);
  fn(ctx, s, P);
  ctx.restore();
}

/** Draw a static portrait into a canvas element (collection cards, avatar). */
export function drawNexPortrait(canvas, id, opts = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
  if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const scale = (Math.min(w, h) / 64) * (opts.zoom || 1);
  drawNex(ctx, id, {
    x: w / 2,
    y: h / 2 + (opts.offsetY || 2) * scale,
    scale,
    t: opts.t ?? 1.3,
    expr: opts.expr || 'idle',
    flat: opts.flat,
    palette: opts.palette,
    look: opts.look || { x: 0.15, y: 0.1 },
    quality: 'high',
    core: opts.core ?? 0.3,
  });
}

// ------------------------------------------------------------------ shared parts
function eyes(ctx, s, P, o) {
  const expr = s.expr || 'idle';
  const look = s.look || { x: 0, y: 0 };
  const blink = expr === 'happy' ? 0 : s.blink || 0;
  for (const side of [-1, 1]) {
    const cx = side * o.gap + look.x * o.w * 0.25;
    const cy = o.y + look.y * o.h * 0.15;
    ctx.save();
    if (expr === 'happy') {
      ctx.strokeStyle = o.happyColor || P.eye;
      ctx.lineWidth = o.w * 0.45;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy + o.h * 0.25, o.w * 0.72, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    let w = o.w;
    let h = o.h;
    if (expr === 'hurt') {
      w *= 1.12;
      h *= 1.12;
    }
    h *= Math.max(0.08, 1 - blink);
    if (h < o.h * 0.15) {
      ctx.strokeStyle = o.lidColor || P.dark;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.9, cy);
      ctx.lineTo(cx + w * 0.9, cy);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    // sclera
    ctx.fillStyle = o.sclera || '#ffffff';
    ellipsePath(ctx, cx, cy, w, h, o.tilt ? side * o.tilt : 0);
    ctx.fill();
    ctx.save();
    ellipsePath(ctx, cx, cy, w, h, o.tilt ? side * o.tilt : 0);
    ctx.clip();
    // pupil
    const pr = expr === 'hurt' ? w * 0.38 : expr === 'excited' ? w * 0.8 : w * (o.pupil || 0.68);
    const px = cx + look.x * w * 0.35;
    const py = cy + look.y * h * 0.3 + h * 0.08;
    ctx.fillStyle = o.pupilColor || P.eye;
    ellipsePath(ctx, px, py, pr, pr * 1.12);
    ctx.fill();
    if (o.iris) {
      ctx.fillStyle = o.iris;
      ellipsePath(ctx, px, py + pr * 0.35, pr * 0.7, pr * 0.5);
      ctx.fill();
    }
    // highlights
    ctx.fillStyle = '#ffffff';
    if (expr === 'excited') {
      starPath(ctx, px - pr * 0.3, py - pr * 0.35, 4, pr * 0.55, pr * 0.18);
      ctx.fill();
    } else {
      circle(ctx, px - pr * 0.35, py - pr * 0.4, pr * 0.34);
      ctx.fill();
      circle(ctx, px + pr * 0.35, py + pr * 0.35, pr * 0.14);
      ctx.fill();
    }
    // lids for moods
    const lid = o.lidColor || P.dark;
    const lidTop = o.baseLid || 0;
    if (expr === 'sad' || expr === 'focus' || lidTop > 0) {
      ctx.fillStyle = lid;
      ctx.beginPath();
      if (expr === 'sad') {
        ctx.moveTo(cx - w * 1.2, cy - h * 1.2);
        ctx.lineTo(cx + w * 1.2, cy - h * 1.2);
        ctx.lineTo(cx + w * 1.2, cy - h * (side > 0 ? 0.45 : 0.05));
        ctx.lineTo(cx - w * 1.2, cy - h * (side > 0 ? 0.05 : 0.45));
      } else {
        const cover = expr === 'focus' ? 0.25 : 1 - lidTop * 2;
        const tiltY = expr === 'focus' ? h * 0.25 : 0;
        ctx.moveTo(cx - w * 1.2, cy - h * 1.2);
        ctx.lineTo(cx + w * 1.2, cy - h * 1.2);
        ctx.lineTo(cx + w * 1.2, cy - h * cover + (side > 0 ? -tiltY : tiltY));
        ctx.lineTo(cx - w * 1.2, cy - h * cover + (side > 0 ? tiltY : -tiltY));
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }
}

function mouth(ctx, s, x, y, size, color, style = 'normal') {
  const expr = s.expr || 'idle';
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size * 0.28;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (expr === 'hurt') {
    ellipsePath(ctx, x, y + size * 0.2, size * 0.32, size * 0.42);
    ctx.fill();
  } else if (expr === 'sad') {
    ctx.arc(x, y + size * 0.7, size * 0.6, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  } else if (expr === 'happy' || expr === 'excited' || style === 'grin') {
    ctx.moveTo(x - size * 0.75, y - size * 0.05);
    ctx.quadraticCurveTo(x, y + size * 1.25, x + size * 0.75, y - size * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff7a9a';
    ellipsePath(ctx, x, y + size * 0.45, size * 0.32, size * 0.18);
    ctx.fill();
  } else if (expr === 'focus') {
    ctx.moveTo(x - size * 0.4, y + size * 0.2);
    ctx.lineTo(x + size * 0.4, y + size * 0.2);
    ctx.stroke();
  } else if (style === 'smirk') {
    ctx.moveTo(x - size * 0.5, y + size * 0.1);
    ctx.quadraticCurveTo(x + size * 0.1, y + size * 0.55, x + size * 0.65, y - size * 0.15);
    ctx.stroke();
  } else {
    ctx.arc(x, y - size * 0.15, size * 0.5, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  }
  ctx.restore();
}

function glossy(ctx, x, y, rx, ry, rot, a = 0.5) {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = '#ffffff';
  ellipsePath(ctx, x, y, rx, ry, rot);
  ctx.fill();
  ctx.restore();
}

function bodyGradient(ctx, P, rx, ry, ox = -0.35, oy = -0.5) {
  const g = ctx.createRadialGradient(rx * ox, ry * oy, 1, 0, 0, Math.max(rx, ry) * 1.35);
  g.addColorStop(0, P.light);
  g.addColorStop(0.45, P.body);
  g.addColorStop(1, P.dark);
  return g;
}

function coreGlow(ctx, s, P, x, y, size) {
  const k = 0.55 + 0.45 * Math.sin((s.t || 0) * 2.4) * 0.5 + (s.core || 0) * 0.8 + (s.ability ? 0.6 : 0);
  if (s.quality !== 'low') glow(ctx, x, y, size * (2.4 + k), P.glow, 0.35 + k * 0.35);
  return k;
}

// ------------------------------------------------------------------ BOLT
function boltPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(0, -R);
  ctx.bezierCurveTo(R * 0.62, -R, R * 1.02, -R * 0.58, R * 1.02, -R * 0.02);
  ctx.bezierCurveTo(R * 1.02, R * 0.55, R * 0.55, R * 0.98, 0, R * 1.3);
  ctx.bezierCurveTo(-R * 0.55, R * 0.98, -R * 1.02, R * 0.55, -R * 1.02, -R * 0.02);
  ctx.bezierCurveTo(-R * 1.02, -R * 0.58, -R * 0.62, -R, 0, -R);
  ctx.closePath();
}

function bolt(ctx, s, P) {
  const t = s.t || 0;
  const sp = s.speed || 0;
  // Antennae twitch every few seconds and sweep back with speed.
  const twitchPhase = t % 3.7;
  const twitch = twitchPhase < 0.3 ? Math.sin(twitchPhase * 40) * 0.18 : 0;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * R * 0.36, -R * 0.84);
    ctx.rotate(side * (0.32 + sp * 0.35) + twitch * side);
    ctx.strokeStyle = s.flat || P.dark;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.quadraticCurveTo(side * 2, -R * 0.4, 0, -R * 0.62);
    ctx.stroke();
    if (!s.flat) glow(ctx, 0, -R * 0.66, 9 + (s.core || 0) * 6, P.glow, 0.8);
    ctx.fillStyle = s.flat || P.core;
    circle(ctx, 0, -R * 0.66, 4);
    ctx.fill();
    ctx.restore();
  }
  if (s.flat) {
    ctx.fillStyle = s.flat;
    boltPath(ctx);
    ctx.fill();
    return;
  }
  ctx.fillStyle = bodyGradient(ctx, P, R, R);
  boltPath(ctx);
  ctx.fill();
  // rim light
  ctx.save();
  boltPath(ctx);
  ctx.clip();
  ctx.strokeStyle = rgba(P.accent || '#ffffff', 0.35);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(R * 0.1, R * 0.15, R * 1.05, -0.2, 1.2);
  ctx.stroke();
  ctx.restore();
  glossy(ctx, -R * 0.42, -R * 0.58, R * 0.26, R * 0.14, -0.6, 0.55);
  // cheek lightning marks
  ctx.strokeStyle = P.cheek;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const x = side * R * 0.7;
    const y = R * 0.14;
    ctx.beginPath();
    ctx.moveTo(x - side * 3, y - 5);
    ctx.lineTo(x + side * 1, y - 1);
    ctx.lineTo(x - side * 2, y + 1);
    ctx.lineTo(x + side * 3, y + 5);
    ctx.stroke();
  }
  // core
  const k = coreGlow(ctx, s, P, 0, R * 0.62, R * 0.26);
  ctx.fillStyle = '#ffffff';
  circle(ctx, 0, R * 0.62, R * 0.26);
  ctx.fill();
  ctx.fillStyle = P.core;
  circle(ctx, 0, R * 0.62, R * 0.19 + k * 0.6);
  ctx.fill();
  ctx.strokeStyle = rgba(P.dark, 0.6);
  ctx.lineWidth = 1.5;
  circle(ctx, 0, R * 0.62, R * 0.28);
  ctx.stroke();
  eyes(ctx, s, P, { gap: R * 0.37, y: -R * 0.22, w: R * 0.24, h: R * 0.32, pupilColor: P.eye, iris: rgba(P.glow, 0.9), lidColor: P.body });
  mouth(ctx, s, 0, R * 0.2, R * 0.2, P.eye);
  if (s.ability) {
    // Overdrive lightning crackle
    ctx.strokeStyle = rgba(P.core, 0.9);
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const a = t * 9 + (i * TAU) / 3;
      const r1 = R * 1.35;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a + 0.15) * (r1 + 6), Math.sin(a + 0.15) * (r1 + 6) - 3);
      ctx.lineTo(Math.cos(a + 0.3) * (r1 + 2), Math.sin(a + 0.3) * (r1 + 2));
      ctx.stroke();
    }
  }
}

// ------------------------------------------------------------------ LUMA
function lumaPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(0, -R * 0.98);
  ctx.bezierCurveTo(R * 0.8, -R * 0.98, R * 1.18, -R * 0.4, R * 1.16, R * 0.12);
  ctx.bezierCurveTo(R * 1.12, R * 0.72, R * 0.62, R * 1.0, 0, R * 1.0);
  ctx.bezierCurveTo(-R * 0.62, R * 1.0, -R * 1.12, R * 0.72, -R * 1.16, R * 0.12);
  ctx.bezierCurveTo(-R * 1.18, -R * 0.4, -R * 0.8, -R * 0.98, 0, -R * 0.98);
  ctx.closePath();
}

function lumaFin(ctx, s, P, side) {
  const t = s.t || 0;
  ctx.save();
  const bob = Math.sin(t * 1.8 + side) * 2;
  ctx.translate(side * R * 0.98, -R * 0.78 + bob);
  ctx.rotate(side * (0.55 + Math.sin(t * 1.6 + side * 0.7) * 0.18));
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.bezierCurveTo(side * R * 0.34, -R * 0.1, side * R * 0.32, -R * 0.62, 0, -R * 0.78);
  ctx.bezierCurveTo(-side * R * 0.2, -R * 0.5, -side * R * 0.16, -R * 0.05, 0, 4);
  ctx.closePath();
  if (s.flat) {
    ctx.fillStyle = s.flat;
  } else {
    const g = ctx.createLinearGradient(0, 4, 0, -R * 0.78);
    g.addColorStop(0, P.accent);
    g.addColorStop(1, P.accent2 || P.light);
    ctx.fillStyle = g;
  }
  ctx.fill();
  if (!s.flat) {
    ctx.strokeStyle = rgba('#ffffff', 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(side * R * 0.12, -R * 0.35, 0, -R * 0.62);
    ctx.stroke();
  }
  ctx.restore();
}

function luma(ctx, s, P) {
  const t = s.t || 0;
  const orbit = (front) => {
    if (s.flat || s.quality === 'low') return;
    const strength = 0.6 + (s.nearby || 0) * 0.8 + (s.ability ? 0.8 : 0);
    for (let i = 0; i < 4; i++) {
      const a = t * 1.3 + (i * TAU) / 4;
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      const x = Math.cos(a) * R * 1.55;
      const y = Math.sin(a) * R * 0.45 + R * 0.25;
      glow(ctx, x, y, 7 * strength, i % 2 ? P.accent : P.accent2 || P.glow, 0.9);
      ctx.fillStyle = '#ffffff';
      circle(ctx, x, y, 1.8);
      ctx.fill();
    }
  };
  orbit(false);
  lumaFin(ctx, s, P, -1);
  lumaFin(ctx, s, P, 1);
  if (s.flat) {
    ctx.fillStyle = s.flat;
    lumaPath(ctx);
    ctx.fill();
    return;
  }
  ctx.fillStyle = bodyGradient(ctx, P, R * 1.15, R);
  lumaPath(ctx);
  ctx.fill();
  glossy(ctx, -R * 0.5, -R * 0.5, R * 0.3, R * 0.15, -0.5, 0.5);
  // blush
  ctx.fillStyle = rgba(P.cheek, 0.55);
  ellipsePath(ctx, -R * 0.68, R * 0.2, R * 0.2, R * 0.12);
  ctx.fill();
  ellipsePath(ctx, R * 0.68, R * 0.2, R * 0.2, R * 0.12);
  ctx.fill();
  // star core
  const k = coreGlow(ctx, s, P, 0, R * 0.58, R * 0.28);
  ctx.fillStyle = '#ffffff';
  starPath(ctx, 0, R * 0.58, 5, R * 0.3 + k, R * 0.13, -Math.PI / 2 + Math.sin(t * 0.8) * 0.2);
  ctx.fill();
  ctx.fillStyle = P.core;
  starPath(ctx, 0, R * 0.58, 5, R * 0.18, R * 0.08, -Math.PI / 2 + Math.sin(t * 0.8) * 0.2);
  ctx.fill();
  eyes(ctx, s, P, { gap: R * 0.42, y: -R * 0.14, w: R * 0.25, h: R * 0.29, pupilColor: P.eye, iris: rgba(P.accent, 0.8), lidColor: P.body, pupil: 0.72 });
  // lashes
  if ((s.expr || 'idle') !== 'happy' && (s.blink || 0) < 0.5) {
    ctx.strokeStyle = P.eye;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * R * 0.62, -R * 0.34);
      ctx.lineTo(side * R * 0.76, -R * 0.44);
      ctx.stroke();
    }
  }
  mouth(ctx, s, 0, R * 0.24, R * 0.17, P.eye);
  orbit(true);
  if (s.ability) {
    ctx.strokeStyle = rgba(P.accent, 0.5);
    ctx.lineWidth = 2;
    circle(ctx, 0, R * 0.1, R * 1.9 + Math.sin(t * 8) * 2);
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ ECHO
function echoRing(ctx, s, P, rx, ry, rot, speed, front) {
  const t = s.t || 0;
  ctx.save();
  ctx.rotate(rot);
  ctx.strokeStyle = s.flat || rgba(P.ring || '#ffffff', 0.85);
  ctx.lineWidth = s.flat ? 3.2 : 2.4;
  ctx.beginPath();
  // Front half = lower half of the ellipse.
  if (front) ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI);
  else ctx.ellipse(0, 0, rx, ry, 0, Math.PI, TAU);
  ctx.stroke();
  if (!s.flat) {
    for (let i = 0; i < 2; i++) {
      const a = (t * speed + i * Math.PI) % TAU;
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      glow(ctx, x, y, 7, P.glow, 0.9);
      ctx.fillStyle = '#ffffff';
      circle(ctx, x, y, 2.2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function echoPath(ctx) {
  ellipsePath(ctx, 0, R * 0.05, R * 0.78, R * 1.12);
}

function echo(ctx, s, P) {
  const t = s.t || 0;
  const ringSpeed = s.ability ? 7 : 1.6;
  const r1 = 0.25 + Math.sin(t * 0.7) * 0.05;
  const r2 = -0.38 + Math.cos(t * 0.5) * 0.05;
  echoRing(ctx, s, P, R * 1.42, R * 0.34, r1, ringSpeed, false);
  echoRing(ctx, s, P, R * 1.22, R * 0.28, r2, -ringSpeed * 1.4, false);
  // floating crest diamond
  const dy = -R * 1.55 + Math.sin(t * 2) * 2;
  ctx.fillStyle = s.flat || P.core;
  polyPath(ctx, 0, dy, 4, R * 0.2, 0);
  ctx.fill();
  if (!s.flat) glow(ctx, 0, dy, 10, P.glow, 0.7);
  if (s.flat) {
    ctx.fillStyle = s.flat;
    echoPath(ctx);
    ctx.fill();
  } else {
    ctx.fillStyle = bodyGradient(ctx, P, R * 0.8, R * 1.1, -0.3, -0.55);
    echoPath(ctx);
    ctx.fill();
    // pink rim light on one side
    ctx.save();
    echoPath(ctx);
    ctx.clip();
    ctx.strokeStyle = rgba(P.accent, 0.55);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(R * 0.1, R * 0.05, R * 0.78, R * 1.12, 0, -0.9, 1.4);
    ctx.stroke();
    ctx.restore();
    glossy(ctx, -R * 0.32, -R * 0.62, R * 0.18, R * 0.1, -0.7, 0.5);
    // expanding core wave every few seconds
    const wave = (t % 2.6) / 2.6;
    if (s.quality !== 'low') {
      ctx.strokeStyle = rgba(P.glow, 0.5 * (1 - wave));
      ctx.lineWidth = 1.5;
      circle(ctx, 0, R * 0.5, R * 0.2 + wave * R * 1.1);
      ctx.stroke();
    }
    const k = coreGlow(ctx, s, P, 0, R * 0.5, R * 0.24);
    ctx.fillStyle = '#ffffff';
    polyPath(ctx, 0, R * 0.5, 4, R * 0.27 + k * 0.8, 0);
    ctx.fill();
    ctx.fillStyle = P.core;
    polyPath(ctx, 0, R * 0.5, 4, R * 0.17, 0);
    ctx.fill();
    // glowing slit eyes
    const expr = s.expr || 'idle';
    const blink = s.blink || 0;
    for (const side of [-1, 1]) {
      const look = s.look || { x: 0, y: 0 };
      const cx = side * R * 0.3 + look.x * 2;
      const cy = -R * 0.22 + look.y * 1.5;
      if (expr === 'happy') {
        ctx.strokeStyle = P.eye;
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy + 3, R * 0.16, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        continue;
      }
      let h = R * (expr === 'focus' ? 0.07 : expr === 'hurt' ? 0.2 : 0.13) * Math.max(0.1, 1 - blink);
      const w = R * (expr === 'hurt' ? 0.2 : 0.23);
      if (s.quality !== 'low') glow(ctx, cx, cy, 10, P.glow, 0.5);
      ctx.fillStyle = P.eye;
      ctx.beginPath();
      ctx.moveTo(cx - w, cy + side * 0);
      ctx.quadraticCurveTo(cx, cy - h * 2, cx + w, cy - side * h * 0.3);
      ctx.quadraticCurveTo(cx, cy + h * 1.4, cx - w, cy);
      ctx.fill();
      ctx.fillStyle = P.core;
      circle(ctx, cx + look.x * 3, cy - h * 0.1, Math.min(h, R * 0.08));
      ctx.fill();
      h = 0;
    }
    if (expr === 'happy' || expr === 'excited' || expr === 'hurt' || expr === 'sad') {
      mouth(ctx, s, 0, R * 0.1, R * 0.14, P.eye);
    }
  }
  echoRing(ctx, s, P, R * 1.42, R * 0.34, r1, ringSpeed, true);
  echoRing(ctx, s, P, R * 1.22, R * 0.28, r2, -ringSpeed * 1.4, true);
}

// ------------------------------------------------------------------ FLUX
function fluxPath(ctx, t, dissolve = 0) {
  ctx.beginPath();
  ctx.moveTo(-R, R * 0.2);
  ctx.bezierCurveTo(-R * 1.05, -R * 0.75, -R * 0.45, -R * 1.02, 0, -R * 0.98);
  // wisp on top
  ctx.quadraticCurveTo(R * 0.25, -R * 1.45 - Math.sin(t * 2.2) * 3, R * 0.55, -R * 1.25);
  ctx.quadraticCurveTo(R * 0.35, -R * 1.02, R * 0.45, -R * 0.92);
  ctx.bezierCurveTo(R * 0.95, -R * 0.7, R * 1.05, -R * 0.3, R, R * 0.2);
  // wavy dissolving hem
  const lobes = 3;
  const w = (R * 2) / lobes;
  for (let i = 0; i < lobes; i++) {
    const x0 = R - i * w;
    const x1 = x0 - w;
    const depth = R * (0.95 + Math.sin(t * 3 + i * 1.7) * 0.18) + dissolve * 8;
    ctx.quadraticCurveTo((x0 + x1) / 2, R * 0.2 + depth, x1, R * 0.2 + (i < lobes - 1 ? R * 0.35 : 0));
  }
  ctx.closePath();
}

function flux(ctx, s, P) {
  const t = s.t || 0;
  const dissolve = s.dissolve || 0;
  // falling fragments
  if (!s.flat && s.quality !== 'low') {
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.6 + i * 0.25) % 1;
      const x = (i - 1.5) * R * 0.45 + Math.sin(t + i) * 3;
      const y = R * 1.15 + ph * R * 0.9;
      ctx.save();
      ctx.globalAlpha *= (1 - ph) * 0.8;
      ctx.translate(x, y);
      ctx.rotate(t * 2 + i);
      ctx.fillStyle = i % 2 ? P.accent : P.light;
      ctx.fillRect(-2.5, -2.5, 5, 5);
      ctx.restore();
    }
  }
  if (s.flat) {
    ctx.fillStyle = s.flat;
    fluxPath(ctx, t);
    ctx.fill();
    return;
  }
  const phaseAlpha = s.ability ? 0.55 : 0.88 - dissolve * 0.4;
  ctx.save();
  ctx.globalAlpha *= phaseAlpha;
  const g = ctx.createLinearGradient(0, -R * 1.2, 0, R * 1.3);
  g.addColorStop(0, P.light);
  g.addColorStop(0.5, P.body);
  g.addColorStop(1, rgba(P.dark, 0.3));
  ctx.fillStyle = g;
  fluxPath(ctx, t, dissolve);
  ctx.fill();
  // inner swirl
  ctx.save();
  fluxPath(ctx, t, dissolve);
  ctx.clip();
  ctx.strokeStyle = rgba('#ffffff', 0.28);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-R * 0.1, R * 0.35, R * 0.7, t * 1.2, t * 1.2 + 2.2);
  ctx.stroke();
  ctx.strokeStyle = rgba(P.accent, 0.35);
  ctx.beginPath();
  ctx.arc(R * 0.2, R * 0.1, R * 0.95, -t * 0.9, -t * 0.9 + 1.6);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  glossy(ctx, -R * 0.45, -R * 0.55, R * 0.22, R * 0.12, -0.6, 0.45);
  // hexagon core
  const k = coreGlow(ctx, s, s.ability ? { ...P, glow: P.accent } : P, 0, R * 0.42, R * 0.26);
  ctx.fillStyle = rgba('#ffffff', 0.85);
  polyPath(ctx, 0, R * 0.42, 6, R * 0.28 + k * 0.6, t * 0.4);
  ctx.fill();
  ctx.fillStyle = s.ability ? P.accent : P.core;
  polyPath(ctx, 0, R * 0.42, 6, R * 0.17, t * 0.4);
  ctx.fill();
  // relaxed half-lidded eyes looking sideways
  const look = s.look || { x: 0, y: 0 };
  const expr = s.expr || 'idle';
  eyes(ctx, { ...s, look: { x: look.x * 0.6 + 0.35, y: look.y } }, P, {
    gap: R * 0.36, y: -R * 0.2, w: R * 0.22, h: R * 0.27, pupilColor: P.eye, lidColor: P.body,
    baseLid: expr === 'idle' ? 0.2 : 0,
  });
  mouth(ctx, s, R * 0.05, R * 0.14, R * 0.17, P.eye, 'smirk');
  if (s.ability && s.quality !== 'low') {
    ctx.strokeStyle = rgba(P.accent, 0.7);
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -t * 30;
    ctx.lineWidth = 2;
    circle(ctx, 0, 0, R * 1.6);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ------------------------------------------------------------------ NOVA
function novaSpikes(ctx, s, P) {
  const t = s.t || 0;
  const n = 8;
  const pulse = s.ability ? 1.4 : 1;
  for (let i = 0; i < n; i++) {
    const a = t * 0.35 + (i * TAU) / n;
    const long = i % 2 === 0;
    const len = R * (long ? 0.52 : 0.32) * (1 + Math.sin(t * 3 + i) * 0.12) * pulse;
    const base = R * 0.98;
    const w = long ? 0.26 : 0.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - w) * base, Math.sin(a - w) * base);
    ctx.lineTo(Math.cos(a) * (base + len), Math.sin(a) * (base + len));
    ctx.lineTo(Math.cos(a + w) * base, Math.sin(a + w) * base);
    ctx.closePath();
    ctx.fillStyle = s.flat || (long ? P.spike : P.accent);
    ctx.fill();
  }
}

function nova(ctx, s, P) {
  const t = s.t || 0;
  novaSpikes(ctx, s, P);
  if (s.flat) {
    ctx.fillStyle = s.flat;
    circle(ctx, 0, 0, R * 1.06);
    ctx.fill();
    return;
  }
  ctx.fillStyle = bodyGradient(ctx, P, R * 1.06, R * 1.06, -0.3, -0.6);
  circle(ctx, 0, 0, R * 1.06);
  ctx.fill();
  glossy(ctx, -R * 0.45, -R * 0.6, R * 0.26, R * 0.13, -0.5, 0.55);
  // flame cheeks
  ctx.fillStyle = rgba(P.cheek, 0.6);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * R * 0.62, R * 0.3);
    ctx.quadraticCurveTo(side * R * 0.82, R * 0.12, side * R * 0.7, -R * 0.02);
    ctx.quadraticCurveTo(side * R * 0.95, R * 0.2, side * R * 0.62, R * 0.3);
    ctx.fill();
  }
  // burst core with periodic flare
  const flare = (t % 3.2) < 0.25 ? 1 - (t % 3.2) / 0.25 : 0;
  const k = coreGlow(ctx, { ...s, core: (s.core || 0) + flare }, P, 0, R * 0.55, R * 0.28);
  ctx.fillStyle = '#ffffff';
  starPath(ctx, 0, R * 0.55, 8, R * 0.32 + k * 0.8, R * 0.15, t * 0.5);
  ctx.fill();
  ctx.fillStyle = P.core;
  circle(ctx, 0, R * 0.55, R * 0.12);
  ctx.fill();
  eyes(ctx, s, P, { gap: R * 0.38, y: -R * 0.2, w: R * 0.24, h: R * 0.3, pupilColor: P.eye, lidColor: P.body, pupil: 0.74 });
  // bold brows
  const expr = s.expr || 'idle';
  if (expr !== 'happy') {
    ctx.strokeStyle = P.dark;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    const raise = expr === 'hurt' ? -4 : expr === 'sad' ? 2 : 0;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      if (expr === 'sad') {
        ctx.moveTo(side * R * 0.2, -R * 0.62 + raise);
        ctx.lineTo(side * R * 0.56, -R * 0.52 + raise);
      } else {
        ctx.moveTo(side * R * 0.18, -R * 0.6 + raise);
        ctx.quadraticCurveTo(side * R * 0.4, -R * 0.72 + raise, side * R * 0.6, -R * 0.64 + raise);
      }
      ctx.stroke();
    }
  }
  mouth(ctx, s, 0, R * 0.16, R * 0.2, P.eye, expr === 'idle' ? 'grin' : 'normal');
}

const BODIES = { bolt, luma, echo, flux, nova };
