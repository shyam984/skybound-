// Nexus Island artwork: terrain, buildings (with visible level evolution),
// decorations, ambient NPC bots, hover vehicles and distant islands.
// Everything is drawn procedurally in island world units.

import { TAU, mulberry32 } from '../core/math.js';
import { glow, softBlob, ellipsePath, circle, cylinder, dome, rgba, polyPath, starPath, roundRectPath, shadow } from './draw.js';
import { drawNex } from './nexRenderer.js';

export const ISLAND = { rx: 600, ry: 340, cliff: 48, depth: 380 };

// ------------------------------------------------------------------ terrain
let undersideCache = null;
function undersideShape() {
  if (undersideCache) return undersideCache;
  const rng = mulberry32(1234);
  const pts = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const u = i / n; // 0 left → 1 right
    const x = -ISLAND.rx + u * ISLAND.rx * 2;
    const edge = Math.sin(u * Math.PI);
    const y = ISLAND.cliff + ISLAND.ry * 0.2 + edge * ISLAND.depth * (0.75 + rng() * 0.35) + (i % 2 ? rng() * 30 : 0);
    pts.push([x * (1 - edge * 0.12), y]);
  }
  const rocks = [];
  for (let i = 0; i < 9; i++) {
    rocks.push({ x: (rng() - 0.5) * ISLAND.rx * 2.1, y: ISLAND.ry * 0.9 + rng() * 260, r: 10 + rng() * 26, ph: rng() * TAU, sp: 0.5 + rng() });
  }
  const crystals = [];
  for (let i = 0; i < 7; i++) {
    const u = 0.2 + rng() * 0.6;
    crystals.push({ x: -ISLAND.rx + u * ISLAND.rx * 2, len: 30 + rng() * 60, w: 10 + rng() * 10, c: i % 2 ? '#35e8ff' : '#b88cff' });
  }
  undersideCache = { pts, rocks, crystals };
  return undersideCache;
}

let sceneryCache = null;
export function scenery() {
  if (sceneryCache) return sceneryCache;
  const rng = mulberry32(99);
  const trees = [
    { x: -520, y: -60, s: 1.0, c: '#4fe0a8' },
    { x: -470, y: -170, s: 0.8, c: '#ff8ad6' },
    { x: 510, y: -150, s: 0.9, c: '#4fe0a8' },
    { x: 540, y: -40, s: 0.75, c: '#7ab8ff' },
    { x: -240, y: -250, s: 0.7, c: '#4fe0a8' },
    { x: 250, y: -255, s: 0.65, c: '#ff8ad6' },
    { x: -430, y: 230, s: 0.7, c: '#ffd36a' },
    { x: 450, y: 240, s: 0.8, c: '#4fe0a8' },
  ];
  const tufts = [];
  for (let i = 0; i < 60; i++) {
    const a = rng() * TAU;
    const r = Math.sqrt(rng()) * 0.95;
    tufts.push({ x: Math.cos(a) * ISLAND.rx * r, y: Math.sin(a) * ISLAND.ry * r, c: rng() < 0.3 ? '#9dffd6' : '#2fa886', s: 0.6 + rng() * 0.8 });
  }
  const rocks = [
    { x: -560, y: 110, r: 18 },
    { x: 575, y: 90, r: 14 },
    { x: 60, y: -300, r: 12 },
    { x: -80, y: 305, r: 12 },
  ];
  sceneryCache = { trees, tufts, rocks };
  return sceneryCache;
}

/**
 * part: 'back' = floating rocks behind (animated), 'static' = rock mass
 * (cacheable), 'live' = veins, crystal glows and the pulsing core.
 */
export function drawIslandUnderside(ctx, t, night, part = 'all') {
  const { pts, rocks, crystals } = undersideShape();
  const all = part === 'all';
  if (all || part === 'back') drawUndersideRocks(ctx, t, night, rocks);
  if (all || part === 'static') drawUndersideMass(ctx, pts, crystals);
  if (all || part === 'live') drawUndersideLive(ctx, t, night, pts, crystals);
}

function drawUndersideRocks(ctx, t, night, rocks) {
  for (const r of rocks) {
    const y = r.y + Math.sin(t * r.sp + r.ph) * 8;
    ctx.fillStyle = '#3a2f86';
    polyPath(ctx, r.x, y, 6, r.r, r.ph);
    ctx.fill();
    ctx.fillStyle = '#5b4bc0';
    polyPath(ctx, r.x - r.r * 0.15, y - r.r * 0.2, 6, r.r * 0.65, r.ph);
    ctx.fill();
    glow(ctx, r.x, y + r.r * 0.6, r.r * 0.8, '#35e8ff', 0.25 + night * 0.3);
  }
}

function drawUndersideMass(ctx, pts, crystals) {
  // main rock mass
  const g = ctx.createLinearGradient(0, 0, 0, ISLAND.depth + 120);
  g.addColorStop(0, '#5a47c2');
  g.addColorStop(0.45, '#3a2d8f');
  g.addColorStop(1, '#1a1452');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-ISLAND.rx, 0);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(ISLAND.rx, 0);
  ctx.closePath();
  ctx.fill();
  // rock facets
  ctx.fillStyle = 'rgba(20,14,60,0.35)';
  for (let i = 2; i < pts.length - 2; i += 3) {
    const [x, y] = pts[i];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 40, ISLAND.cliff + 60);
    ctx.lineTo(x - 30, ISLAND.cliff + 70);
    ctx.closePath();
    ctx.fill();
  }
  for (const c of crystals) {
    const bottom = crystalBottom(pts, c);
    ctx.fillStyle = c.c;
    ctx.beginPath();
    ctx.moveTo(c.x - c.w / 2, bottom - 20);
    ctx.lineTo(c.x + c.w / 2, bottom - 20);
    ctx.lineTo(c.x, bottom + c.len);
    ctx.closePath();
    ctx.fill();
  }
}

function crystalBottom(pts, c) {
  return pts[Math.round(((c.x + ISLAND.rx) / (ISLAND.rx * 2)) * (pts.length - 1))][1] - 10;
}

function drawUndersideLive(ctx, t, night, pts, crystals) {
  // energy veins
  ctx.strokeStyle = rgba('#35e8ff', 0.35 + night * 0.35);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x0 = -300 + i * 200;
    ctx.beginPath();
    ctx.moveTo(x0, ISLAND.cliff + 40);
    ctx.quadraticCurveTo(x0 * 0.6 + 20, 180, x0 * 0.2, ISLAND.depth * 0.8 + 40);
    ctx.stroke();
  }
  // hanging crystal glows
  for (const c of crystals) {
    glow(ctx, c.x, crystalBottom(pts, c) + c.len * 0.6, c.len * 0.8, c.c, 0.35 + night * 0.3);
  }
  // glowing energy core at the tip
  const tip = pts[Math.floor(pts.length / 2)];
  const pulse = 0.7 + Math.sin(t * 2) * 0.3;
  glow(ctx, tip[0], tip[1] - 30, 140 * pulse, '#35e8ff', 0.5 + night * 0.3);
  glow(ctx, tip[0], tip[1] - 30, 60, '#ffffff', 0.35);
  ctx.fillStyle = '#bff8ff';
  polyPath(ctx, tip[0], tip[1] - 30, 4, 26, t * 0.5);
  ctx.fill();
}

/** part: 'static' = terrain (cacheable), 'live' = animated path lights. */
export function drawIslandTop(ctx, t, night, paths, part = 'all') {
  const { rx, ry, cliff } = ISLAND;
  if (part === 'live') {
    for (const p of paths) {
      ctx.strokeStyle = rgba('#35e8ff', 0.3 + night * 0.5);
      ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 14]);
      ctx.lineDashOffset = -t * 20;
      ctx.beginPath();
      ctx.moveTo(p.x0, p.y0);
      ctx.quadraticCurveTo(p.cx, p.cy, p.x1, p.y1);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    return;
  }
  // cliff side band
  const side = ctx.createLinearGradient(0, 0, 0, cliff + ry);
  side.addColorStop(0, '#8b7cf0');
  side.addColorStop(1, '#4a3bb0');
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(-rx, cliff);
  ctx.ellipse(0, cliff, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  // grass lip
  ctx.fillStyle = '#2fb88f';
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI);
  ctx.ellipse(0, 12, rx * 0.995, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  // top surface
  const g = ctx.createRadialGradient(-80, -60, 40, 0, 0, rx * 1.05);
  g.addColorStop(0, '#8ff5c8');
  g.addColorStop(0.55, '#4fd6a4');
  g.addColorStop(1, '#2aa888');
  ctx.fillStyle = g;
  ellipsePath(ctx, 0, 0, rx, ry);
  ctx.fill();
  // subtle concentric terrace ring
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 3;
  ellipsePath(ctx, 0, 0, rx * 0.8, ry * 0.8);
  ctx.stroke();
  // tufts
  const sc = scenery();
  for (const tf of sc.tufts) {
    ctx.fillStyle = tf.c;
    ellipsePath(ctx, tf.x, tf.y, 7 * tf.s, 3 * tf.s);
    ctx.fill();
  }
  // plaza around hub
  ctx.fillStyle = '#aeb8ee';
  ellipsePath(ctx, 0, -12, 152, 80);
  ctx.fill();
  ctx.fillStyle = '#e6ecff';
  ellipsePath(ctx, 0, -20, 150, 78);
  ctx.fill();
  ctx.strokeStyle = rgba('#35e8ff', 0.5);
  ctx.lineWidth = 2;
  ellipsePath(ctx, 0, -20, 130, 68);
  ctx.stroke();
  // paths
  for (const p of paths) {
    ctx.strokeStyle = '#d7defc';
    ctx.lineWidth = 30;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x0, p.y0);
    ctx.quadraticCurveTo(p.cx, p.cy, p.x1, p.y1);
    ctx.stroke();
    ctx.strokeStyle = '#eef2ff';
    ctx.lineWidth = 22;
    ctx.stroke();
  }
  if (part === 'all') drawIslandTop(ctx, t, night, paths, 'live');
  // rim glow
  ctx.strokeStyle = rgba('#9ffcff', 0.5);
  ctx.lineWidth = 3;
  ellipsePath(ctx, 0, 0, rx - 2, ry - 2);
  ctx.stroke();
  // rocks
  for (const r of sc.rocks) {
    ctx.fillStyle = '#7f72d8';
    ellipsePath(ctx, r.x, r.y, r.r, r.r * 0.65);
    ctx.fill();
    ctx.fillStyle = '#a99ff0';
    ellipsePath(ctx, r.x - r.r * 0.2, r.y - r.r * 0.25, r.r * 0.6, r.r * 0.35);
    ctx.fill();
  }
}

// ------------------------------------------------------------------ nature
export function drawTree(ctx, x, y, s, t, color, night = 0) {
  const sway = Math.sin(t * 1.2 + x * 0.01) * 3 * s;
  shadow(ctx, x, y, 34 * s, 12 * s, 0.25);
  ctx.fillStyle = '#6b4a9a';
  roundRectPath(ctx, x - 5 * s, y - 40 * s, 10 * s, 42 * s, 4 * s);
  ctx.fill();
  const cx = x + sway;
  const cy = y - 62 * s;
  ctx.fillStyle = color;
  circle(ctx, cx, cy, 30 * s);
  ctx.fill();
  circle(ctx, cx - 20 * s, cy + 10 * s, 20 * s);
  ctx.fill();
  circle(ctx, cx + 20 * s, cy + 8 * s, 22 * s);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  circle(ctx, cx - 10 * s, cy - 12 * s, 13 * s);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,30,0.12)';
  ellipsePath(ctx, cx + 4 * s, cy + 22 * s, 32 * s, 8 * s);
  ctx.fill();
  if (night > 0.2) {
    for (let i = 0; i < 3; i++) {
      glow(ctx, cx + (i - 1) * 16 * s, cy + ((i % 2) * 10 - 4) * s, 10 * s, '#fff2a8', night * 0.7);
    }
  }
}

// ------------------------------------------------------------------ buildings
const WHITE = '#f1f3ff';
const LILAC = '#b9b6f2';
const LILAC_D = '#7f7bd0';

function windowBand(ctx, x, y, rx, h, night, color = '#8fe9ff') {
  ctx.fillStyle = night > 0.3 ? rgba('#ffe58a', 0.6 + night * 0.4) : rgba(color, 0.75);
  for (let i = -2; i <= 2; i++) {
    const wx = x + i * rx * 0.36;
    roundRectPath(ctx, wx - rx * 0.1, y - h, rx * 0.2, h, 3);
    ctx.fill();
  }
  if (night > 0.3) glow(ctx, x, y - h / 2, rx * 1.3, '#ffe58a', night * 0.35);
}

function energyOrb(ctx, x, y, r, t, color = '#35e8ff') {
  glow(ctx, x, y, r * 4, color, 0.55);
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#bff8ff');
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  circle(ctx, x, y, r);
  ctx.fill();
  ctx.strokeStyle = rgba(color, 0.8);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.9, r * 0.55, Math.sin(t) * 0.2, 0, TAU);
  ctx.stroke();
}

function drawHub(ctx, lvl, t, night) {
  const bob = Math.sin(t * 1.5) * 5;
  if (lvl <= 1) {
    cylinder(ctx, 0, 0, 80, 34, 16, WHITE, LILAC, LILAC_D);
    ctx.strokeStyle = rgba('#35e8ff', 0.8);
    ctx.lineWidth = 2;
    ellipsePath(ctx, 0, -16, 64, 26);
    ctx.stroke();
    cylinder(ctx, 0, -16, 26, 11, 34, WHITE, LILAC, LILAC_D);
    energyOrb(ctx, 0, -86 + bob, 17, t);
    return;
  }
  if (lvl === 2) {
    cylinder(ctx, 0, 0, 95, 40, 18, WHITE, LILAC, LILAC_D);
    for (const s of [-1, 1]) {
      cylinder(ctx, s * 78, 12, 26, 11, 30, WHITE, LILAC, LILAC_D);
      glow(ctx, s * 78, -26, 20, '#ff7ad9', 0.6);
      ctx.fillStyle = '#ff7ad9';
      circle(ctx, s * 78, -26, 6);
      ctx.fill();
    }
    cylinder(ctx, 0, -18, 34, 14, 50, WHITE, LILAC, LILAC_D);
    windowBand(ctx, 0, -32, 34, 14, night);
    energyOrb(ctx, 0, -108 + bob, 21, t);
    return;
  }
  // Level 3+: towers
  const base = lvl >= 5 ? 125 : lvl === 4 ? 110 : 100;
  cylinder(ctx, 0, 0, base, base * 0.42, 20, WHITE, LILAC, LILAC_D);
  ctx.strokeStyle = rgba('#35e8ff', 0.7);
  ctx.lineWidth = 2;
  ellipsePath(ctx, 0, -20, base * 0.82, base * 0.34);
  ctx.stroke();
  const sideH = lvl >= 4 ? 90 : 70;
  const towers = lvl >= 4 ? [[-80, -8, 20, sideH * 0.8], [80, -8, 20, sideH * 0.8], [-64, 24, 22, sideH], [64, 24, 22, sideH]] : [[-66, 10, 22, sideH], [66, 10, 22, sideH]];
  towers.sort((a, b) => a[1] - b[1]);
  const centreH = lvl >= 5 ? 190 : lvl === 4 ? 150 : 115;
  const drawCentre = () => {
    cylinder(ctx, 0, -18, 38, 15, centreH, WHITE, LILAC, LILAC_D);
    for (let i = 1; i < centreH / 40; i++) windowBand(ctx, 0, -18 - i * 40 + 16, 38, 14, night);
    dome(ctx, 0, -18 - centreH, 38, 15, 26, '#5fd8ff', '#e6fdff');
    if (lvl >= 4) {
      ctx.strokeStyle = rgba('#ff7ad9', 0.85);
      ctx.lineWidth = 3;
      ellipsePath(ctx, 0, -18 - centreH * 0.55, 62, 18);
      ctx.stroke();
    }
  };
  for (const [x, y, r, h] of towers) {
    if (y > -18) continue;
    cylinder(ctx, x, y, r, r * 0.42, h, WHITE, LILAC, LILAC_D);
    windowBand(ctx, x, y - h * 0.4, r, 10, night);
    dome(ctx, x, y - h, r, r * 0.42, 14, '#ff9fe2', '#fff0fb');
  }
  drawCentre();
  for (const [x, y, r, h] of towers) {
    if (y <= -18) continue;
    cylinder(ctx, x, y, r, r * 0.42, h, WHITE, LILAC, LILAC_D);
    windowBand(ctx, x, y - h * 0.4, r, 10, night);
    dome(ctx, x, y - h, r, r * 0.42, 14, '#ff9fe2', '#fff0fb');
  }
  const coreY = -18 - centreH - 60 + bob;
  const coreR = lvl >= 5 ? 30 : lvl === 4 ? 25 : 20;
  if (lvl >= 5) {
    // energy beams from side towers to the core
    ctx.strokeStyle = rgba('#8fe9ff', 0.45 + Math.sin(t * 6) * 0.15);
    ctx.lineWidth = 3;
    for (const [x, y, , h] of towers) {
      ctx.beginPath();
      ctx.moveTo(x, y - h - 10);
      ctx.lineTo(0, coreY);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba('#ffd34a', 0.8);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, coreY, coreR * 2.4, coreR * 0.9, t * 0.6, 0, TAU);
    ctx.stroke();
  }
  energyOrb(ctx, 0, coreY, coreR, t);
}

function drawPortal(ctx, t, night) {
  cylinder(ctx, 0, 0, 74, 30, 12, WHITE, LILAC, LILAC_D);
  cylinder(ctx, 0, -12, 60, 24, 8, '#dfe4ff', LILAC, LILAC_D);
  const cy = -86;
  // pillars
  for (const s of [-1, 1]) {
    cylinder(ctx, s * 68, -8, 10, 4, 104, WHITE, LILAC, LILAC_D);
    glow(ctx, s * 68, -118, 18, '#ffd34a', 0.8);
    ctx.fillStyle = '#ffe58a';
    polyPath(ctx, s * 68, -118, 4, 7, t);
    ctx.fill();
  }
  // swirl
  ctx.save();
  ellipsePath(ctx, 0, cy, 46, 58);
  ctx.clip();
  const bg = ctx.createRadialGradient(0, cy, 4, 0, cy, 60);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.3, '#8ff4ff');
  bg.addColorStop(0.7, '#6d4dff');
  bg.addColorStop(1, '#2b1a7a');
  ctx.fillStyle = bg;
  ctx.fillRect(-50, cy - 62, 100, 124);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = t * 2.2 + (i * TAU) / 5;
    ctx.strokeStyle = i % 2 ? rgba('#ff7ad9', 0.75) : rgba('#ffffff', 0.7);
    ctx.beginPath();
    ctx.ellipse(0, cy, 14 + i * 8, (14 + i * 8) * 1.25, 0, a, a + 1.6);
    ctx.stroke();
  }
  ctx.restore();
  glow(ctx, 0, cy, 70, '#35e8ff', 0.45 + night * 0.25);
  // ring frame
  ctx.strokeStyle = '#eef1ff';
  ctx.lineWidth = 12;
  ellipsePath(ctx, 0, cy, 50, 62);
  ctx.stroke();
  ctx.strokeStyle = '#9d98ea';
  ctx.lineWidth = 3;
  ellipsePath(ctx, 0, cy + 2, 55, 67);
  ctx.stroke();
  ctx.strokeStyle = rgba('#35e8ff', 0.9);
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.lineDashOffset = -t * 30;
  ellipsePath(ctx, 0, cy, 50, 62);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawShop(ctx, t, night) {
  cylinder(ctx, 0, 0, 56, 23, 50, WHITE, LILAC, LILAC_D);
  // counter window
  ctx.fillStyle = night > 0.3 ? '#ffe58a' : '#8fe9ff';
  roundRectPath(ctx, -30, -40, 60, 22, 6);
  ctx.fill();
  if (night > 0.3) glow(ctx, 0, -30, 50, '#ffe58a', night * 0.5);
  // awning
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#ff5fb8';
    ctx.beginPath();
    const x0 = -62 + (i * 124) / stripes;
    const x1 = x0 + 124 / stripes;
    ctx.moveTo(x0 + 6, -64);
    ctx.lineTo(x1 + 6, -64);
    ctx.lineTo(x1, -46);
    ctx.quadraticCurveTo((x0 + x1) / 2, -40, x0, -46);
    ctx.closePath();
    ctx.fill();
  }
  cylinder(ctx, 0, -64, 50, 20, 6, '#f7f8ff', LILAC, LILAC_D);
  // holographic rotating coin
  const bob = Math.sin(t * 2) * 4;
  const sx = Math.cos(t * 2.2);
  glow(ctx, 0, -104 + bob, 30, '#ffd34a', 0.6);
  ctx.save();
  ctx.translate(0, -104 + bob);
  ctx.scale(Math.max(0.12, Math.abs(sx)), 1);
  ctx.fillStyle = '#ffd34a';
  circle(ctx, 0, 0, 15);
  ctx.fill();
  ctx.fillStyle = '#ffb020';
  circle(ctx, 0, 0, 10);
  ctx.fill();
  ctx.fillStyle = '#fff3b0';
  starPath(ctx, 0, 0, 5, 6, 3);
  ctx.fill();
  ctx.restore();
  // little robot assistant
  const rb = Math.sin(t * 3) * 3;
  shadow(ctx, 50, 18, 12, 5, 0.3);
  ctx.fillStyle = '#ffffff';
  circle(ctx, 50, -6 + rb, 11);
  ctx.fill();
  ctx.fillStyle = '#10173f';
  roundRectPath(ctx, 43, -10 + rb, 14, 7, 3);
  ctx.fill();
  ctx.fillStyle = '#35e8ff';
  circle(ctx, 47 + Math.sin(t) * 2, -6.5 + rb, 1.8);
  ctx.fill();
  circle(ctx, 53 + Math.sin(t) * 2, -6.5 + rb, 1.8);
  ctx.fill();
}

function drawGenerator(ctx, lvl, t, night, fill = 0) {
  cylinder(ctx, 0, 0, 48, 20, 16, WHITE, LILAC, LILAC_D);
  if (lvl >= 2) {
    for (const s of [-1, 1]) {
      cylinder(ctx, s * 40, 4, 12, 5, 36, WHITE, LILAC, LILAC_D);
      glow(ctx, s * 40, -36, 12, '#48f5a0', 0.7);
    }
  }
  const h = lvl >= 3 ? 104 : 86;
  // glass tube
  const x = -18;
  const w = 36;
  ctx.fillStyle = 'rgba(180,240,255,0.25)';
  roundRectPath(ctx, x, -16 - h, w, h, 16);
  ctx.fill();
  // energy fill level
  const lv = Math.max(0.12, Math.min(1, fill));
  const fh = (h - 8) * lv;
  const pulse = 0.8 + Math.sin(t * 4) * 0.2;
  const g = ctx.createLinearGradient(0, -20 - fh, 0, -20);
  g.addColorStop(0, '#bff8ff');
  g.addColorStop(1, '#2a8dff');
  ctx.fillStyle = g;
  roundRectPath(ctx, x + 5, -20 - fh, w - 10, fh, 12);
  ctx.fill();
  glow(ctx, 0, -20 - fh / 2, 40 + fh * 0.3, '#35e8ff', 0.35 * pulse + night * 0.2);
  // bubbles
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.7 + i * 0.27) % 1;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    circle(ctx, x + 12 + ((i * 7) % 14), -22 - ph * fh, 2.2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2.5;
  roundRectPath(ctx, x, -16 - h, w, h, 16);
  ctx.stroke();
  // spinning rings
  for (let i = 0; i < 2; i++) {
    const y = -16 - h * (0.35 + i * 0.35);
    ctx.strokeStyle = rgba(i ? '#ff7ad9' : '#ffd34a', 0.9);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, y, 30, 9, 0, Math.PI + t * 2 * (i ? -1 : 1), Math.PI + t * 2 * (i ? -1 : 1) + 4.5);
    ctx.stroke();
  }
  cylinder(ctx, 0, -12 - h, 24, 10, 8, '#f7f8ff', LILAC, LILAC_D);
}

function drawLab(ctx, t, night, nexId, palette) {
  // main building
  cylinder(ctx, 0, 0, 66, 27, 58, WHITE, LILAC, LILAC_D);
  windowBand(ctx, 0, -18, 66, 18, night, '#b8a8ff');
  dome(ctx, 0, -58, 50, 20, 40, 'rgba(120,200,255,0.55)', 'rgba(240,252,255,0.9)');
  glow(ctx, 0, -80, 34, '#9b5cff', 0.35 + night * 0.3);
  // satellite dish
  ctx.save();
  ctx.translate(42, -80);
  ctx.rotate(-0.5 + Math.sin(t * 0.6) * 0.15);
  ctx.fillStyle = '#e6e9ff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 8, 0, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = '#9d98ea';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -14);
  ctx.stroke();
  glow(ctx, 0, -14, 8, '#ff7ad9', 0.9);
  ctx.restore();
  // display platform with hologram of the active Nex
  cylinder(ctx, -70, 22, 24, 10, 8, '#dfe4ff', LILAC, LILAC_D);
  ctx.fillStyle = rgba('#35e8ff', 0.18);
  ctx.beginPath();
  ctx.moveTo(-90, 14);
  ctx.lineTo(-80, -42);
  ctx.lineTo(-60, -42);
  ctx.lineTo(-50, 14);
  ctx.closePath();
  ctx.fill();
  const flicker = Math.sin(t * 23) > 0.93 ? 0.4 : 0.85;
  drawNex(ctx, nexId, { x: -70, y: -24 + Math.sin(t * 2) * 3, scale: 0.8, t, palette, alpha: flicker, look: { x: 0.4, y: 0 } });
}

function drawGarden(ctx, t, night) {
  // flower beds
  const beds = [[-60, 16], [58, 18], [0, 30]];
  for (const [x, y] of beds) {
    ctx.fillStyle = '#7a5bd0';
    ellipsePath(ctx, x, y, 34, 13);
    ctx.fill();
    ctx.fillStyle = '#3f9e6e';
    ellipsePath(ctx, x, y - 3, 30, 10);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const fx = x - 20 + i * 10;
      const fy = y - 6 - (i % 2) * 4 + Math.sin(t * 2 + i) * 1.5;
      const c = ['#ff7ad9', '#ffd34a', '#35e8ff', '#ff9838', '#b88cff'][i];
      ctx.fillStyle = c;
      circle(ctx, fx, fy, 4.5);
      ctx.fill();
      if (night > 0.3) glow(ctx, fx, fy, 10, c, night * 0.6);
    }
  }
  // greenhouse arch
  ctx.fillStyle = 'rgba(160,255,220,0.35)';
  ctx.beginPath();
  ctx.moveTo(-48, -6);
  ctx.bezierCurveTo(-48, -96, 48, -96, 48, -6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f1f3ff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-48, -6);
  ctx.bezierCurveTo(-48, -96, 48, -96, 48, -6);
  ctx.stroke();
  ctx.lineWidth = 2;
  for (const k of [-0.5, 0, 0.5]) {
    ctx.beginPath();
    ctx.moveTo(k * 48, -6);
    ctx.quadraticCurveTo(k * 40, -80, 0, -73);
    ctx.stroke();
  }
  // plant inside
  ctx.fillStyle = '#4fe0a8';
  circle(ctx, -10, -34, 16);
  ctx.fill();
  circle(ctx, 12, -30, 13);
  ctx.fill();
  ctx.fillStyle = '#ff8ad6';
  circle(ctx, 0, -48, 6);
  ctx.fill();
  glow(ctx, 0, -40, 40, '#48f5a0', 0.25 + night * 0.3);
}

/**
 * Draw any building at the current origin (slot position is applied by the
 * caller). `opts` may carry { fill, nexId, palette }.
 */
export function drawBuilding(ctx, id, level, t, night, opts = {}) {
  switch (id) {
    case 'hub':
      return drawHub(ctx, level, t, night);
    case 'portal':
      return drawPortal(ctx, t, night);
    case 'shop':
      return drawShop(ctx, t, night);
    case 'generator':
      return drawGenerator(ctx, level, t, night, opts.fill);
    case 'lab':
      return drawLab(ctx, t, night, opts.nexId || 'bolt', opts.palette);
    case 'garden':
      return drawGarden(ctx, t, night);
    default:
      return undefined;
  }
}

/** Approximate building heights (for prompts / construction clipping). */
export function buildingHeight(id, level) {
  switch (id) {
    case 'hub':
      return level >= 5 ? 300 : level === 4 ? 250 : level === 3 ? 210 : level === 2 ? 140 : 110;
    case 'portal':
      return 160;
    case 'shop':
      return 130;
    case 'generator':
      return 130;
    case 'lab':
      return 120;
    case 'garden':
      return 100;
    default:
      return 100;
  }
}

/** Empty construction pad. state: 'available' | 'locked' | 'afford' */
export function drawPlot(ctx, t, state, label) {
  const col = state === 'locked' ? '#8a90c0' : '#35e8ff';
  ctx.save();
  ctx.scale(1, 0.45);
  ctx.fillStyle = rgba(col, state === 'locked' ? 0.12 : 0.16);
  polyPath(ctx, 0, 0, 6, 62, Math.PI / 6);
  ctx.fill();
  ctx.strokeStyle = rgba(col, 0.9);
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -t * 20;
  polyPath(ctx, 0, 0, 6, 62, Math.PI / 6);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  const bob = Math.sin(t * 2) * 4;
  if (state !== 'locked') {
    glow(ctx, 0, -40 + bob, 34, '#35e8ff', 0.5 + Math.sin(t * 3) * 0.15);
    ctx.fillStyle = '#e8fdff';
    roundRectPath(ctx, -4, -54 + bob, 8, 28, 3);
    ctx.fill();
    roundRectPath(ctx, -14, -44 + bob, 28, 8, 3);
    ctx.fill();
  } else {
    // padlock
    ctx.strokeStyle = '#c6cbee';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -46 + bob, 8, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#c6cbee';
    roundRectPath(ctx, -12, -46 + bob, 24, 18, 4);
    ctx.fill();
  }
  if (label) {
    /* label drawn by DOM */
  }
}

// ------------------------------------------------------------------ decorations
export function drawDecor(ctx, type, t, night, extra = {}) {
  switch (type) {
    case 'lamp': {
      shadow(ctx, 0, 2, 12, 5, 0.3);
      ctx.fillStyle = '#e6e9ff';
      roundRectPath(ctx, -3, -56, 6, 58, 3);
      ctx.fill();
      const c = Math.sin(t * 0.8) > 0 ? '#35e8ff' : '#ff7ad9';
      glow(ctx, 0, -62, 20 + night * 30, c, 0.6 + night * 0.4);
      ctx.fillStyle = '#ffffff';
      circle(ctx, 0, -62, 8);
      ctx.fill();
      break;
    }
    case 'bench': {
      const b = Math.sin(t * 2) * 2;
      glow(ctx, 0, -2, 26, '#35e8ff', 0.4 + night * 0.3);
      ctx.fillStyle = '#ff8ad6';
      roundRectPath(ctx, -26, -22 + b, 52, 10, 5);
      ctx.fill();
      ctx.fillStyle = '#ffb3e6';
      roundRectPath(ctx, -26, -36 + b, 52, 10, 5);
      ctx.fill();
      break;
    }
    case 'flowers': {
      const cols = ['#ff7ad9', '#ffd34a', '#35e8ff', '#b88cff', '#48f5a0'];
      for (let i = 0; i < 6; i++) {
        const x = (i - 2.5) * 9;
        const y = -((i * 7) % 12) - 6 + Math.sin(t * 2 + i) * 1.5;
        ctx.strokeStyle = '#2f9e6e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, y);
        ctx.stroke();
        glow(ctx, x, y, 8 + night * 8, cols[i % 5], 0.5 + night * 0.4);
        ctx.fillStyle = cols[i % 5];
        starPath(ctx, x, y, 5, 5, 2.4, t * 0.3 + i);
        ctx.fill();
      }
      break;
    }
    case 'tree':
      drawTree(ctx, 0, 0, 0.75, t, '#ff8ad6', night);
      for (let i = 0; i < 3; i++) glow(ctx, (i - 1) * 14, -48 - (i % 2) * 10, 8, '#35e8ff', 0.8);
      break;
    case 'sign': {
      ctx.fillStyle = '#e6e9ff';
      roundRectPath(ctx, -3, -40, 6, 42, 3);
      ctx.fill();
      const fl = Math.sin(t * 17) > 0.95 ? 0.5 : 1;
      ctx.globalAlpha *= fl;
      ctx.fillStyle = rgba('#35e8ff', 0.25);
      roundRectPath(ctx, -34, -72, 68, 30, 8);
      ctx.fill();
      ctx.strokeStyle = '#35e8ff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#e8fdff';
      ctx.font = '700 13px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(extra.text || 'NEXUS', 0, -57);
      glow(ctx, 0, -57, 40, '#35e8ff', 0.3 + night * 0.4);
      ctx.globalAlpha /= fl;
      break;
    }
    case 'crystal': {
      const cols = ['#b88cff', '#35e8ff', '#ff7ad9'];
      [[-12, 0, 12, 44], [10, 2, 10, 34], [0, 6, 9, 24]].forEach(([x, y, w, h], i) => {
        ctx.fillStyle = cols[i];
        ctx.beginPath();
        ctx.moveTo(x - w, y);
        ctx.lineTo(x - w * 0.6, y - h);
        ctx.lineTo(x, y - h - 10);
        ctx.lineTo(x + w * 0.6, y - h);
        ctx.lineTo(x + w, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(x - w * 0.6, y - h);
        ctx.lineTo(x, y - h - 10);
        ctx.lineTo(x, y);
        ctx.lineTo(x - w, y);
        ctx.closePath();
        ctx.fill();
        glow(ctx, x, y - h * 0.5, h * 0.8, cols[i], 0.3 + night * 0.4);
      });
      break;
    }
    case 'fountain': {
      ctx.fillStyle = '#b9b6f2';
      ellipsePath(ctx, 0, 0, 38, 15);
      ctx.fill();
      ctx.fillStyle = '#5fd8ff';
      ellipsePath(ctx, 0, -4, 32, 11);
      ctx.fill();
      ctx.fillStyle = '#e6e9ff';
      roundRectPath(ctx, -5, -34, 10, 32, 4);
      ctx.fill();
      ctx.strokeStyle = rgba('#bff8ff', 0.8);
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) {
        const s = i % 2 ? 1 : -1;
        const k = ((t * 1.5 + i * 0.25) % 1);
        ctx.globalAlpha = 1 - k * 0.5;
        ctx.beginPath();
        ctx.moveTo(0, -36);
        ctx.quadraticCurveTo(s * (10 + i * 4), -60 - k * 6, s * (16 + i * 4), -8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      glow(ctx, 0, -40, 34, '#35e8ff', 0.45 + night * 0.3);
      break;
    }
    case 'statue': {
      cylinder(ctx, 0, 0, 24, 10, 20, '#f1f3ff', '#b9b6f2', '#7f7bd0');
      drawNex(ctx, extra.nexId || 'bolt', { x: 0, y: -46, scale: 1.1, t: 0.5, flat: '#f2c14e' });
      glow(ctx, 0, -46, 30, '#ffd34a', 0.25 + night * 0.3);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ellipsePath(ctx, -6, -58, 6, 4, -0.5);
      ctx.fill();
      break;
    }
    default:
      break;
  }
}

// ------------------------------------------------------------------ NPCs & vehicles
export function drawBot(ctx, x, y, t, color, facing = 1, phase = 0) {
  const bob = Math.sin(t * 4 + phase) * 2.5;
  shadow(ctx, x, y, 10, 4, 0.3);
  ctx.fillStyle = '#ffffff';
  circle(ctx, x, y - 14 + bob, 9);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - 14 + bob, 9, 0.15, Math.PI - 0.15);
  ctx.fill();
  ctx.fillStyle = '#10173f';
  roundRectPath(ctx, x - 6 + facing * 1.5, y - 19 + bob, 12, 6, 3);
  ctx.fill();
  ctx.fillStyle = '#8ff4ff';
  circle(ctx, x - 2 + facing * 3, y - 16 + bob, 1.4);
  ctx.fill();
  circle(ctx, x + 2 + facing * 3, y - 16 + bob, 1.4);
  ctx.fill();
  ctx.strokeStyle = '#c6cbee';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 23 + bob);
  ctx.lineTo(x, y - 29 + bob);
  ctx.stroke();
  ctx.fillStyle = color;
  circle(ctx, x, y - 30 + bob, 2.4);
  ctx.fill();
}

export function drawVehicle(ctx, x, y, dir, t, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  glow(ctx, -26, 2, 18, color, 0.7);
  ctx.strokeStyle = rgba(color, 0.4);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-24, 2);
  ctx.lineTo(-90, 2);
  ctx.stroke();
  ctx.fillStyle = '#eef1ff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba('#8fe9ff', 0.9);
  ctx.beginPath();
  ctx.ellipse(6, -5, 10, 6, 0, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(-18, 1, 30, 3);
  ctx.restore();
  void t;
}

// ------------------------------------------------------------------ distant islands
export function drawDistantIsland(ctx, x, y, scale, theme, t) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 0.6 + x) * 8);
  ctx.scale(scale, scale);
  // underside
  ctx.fillStyle = '#3a2f86';
  ctx.beginPath();
  ctx.moveTo(-260, 0);
  ctx.quadraticCurveTo(-120, 260, 0, 330);
  ctx.quadraticCurveTo(120, 260, 260, 0);
  ctx.closePath();
  ctx.fill();
  glow(ctx, 0, 280, 90, theme === 'city' ? '#3d9bff' : theme === 'garden' ? '#48f5a0' : '#b88cff', 0.5);
  // top
  ctx.fillStyle = theme === 'city' ? '#5a63c8' : theme === 'garden' ? '#46cf9a' : '#8a6fe0';
  ellipsePath(ctx, 0, 0, 260, 110);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ellipsePath(ctx, -30, -20, 200, 70);
  ctx.fill();
  if (theme === 'garden') {
    drawTree(ctx, -120, 10, 1.6, t, '#ff8ad6');
    drawTree(ctx, 80, -10, 1.9, t, '#4fe0a8');
    drawTree(ctx, 150, 40, 1.2, t, '#ffd36a');
    // waterfall
    ctx.fillStyle = rgba('#8fe9ff', 0.7);
    ctx.fillRect(200, 30, 18, 160);
  } else if (theme === 'city') {
    const towers = [[-140, 20, 40, 190, '#35e8ff'], [-60, -10, 46, 280, '#ff7ad9'], [40, 10, 40, 230, '#ffd34a'], [130, 30, 36, 170, '#35e8ff']];
    for (const [tx, ty, w, h, c] of towers) {
      ctx.fillStyle = '#dfe3ff';
      roundRectPath(ctx, tx - w / 2, ty - h, w, h, 14);
      ctx.fill();
      ctx.fillStyle = c;
      for (let i = 1; i < h / 34; i++) {
        ctx.fillRect(tx - w * 0.3, ty - h + i * 34, w * 0.6, 8);
      }
      glow(ctx, tx, ty - h, 40, c, 0.6);
    }
  } else {
    const cols = ['#b88cff', '#35e8ff', '#ff7ad9'];
    [[-120, 20, 40, 190], [0, -10, 60, 300], [110, 20, 44, 200]].forEach(([cx, cy, w, h], i) => {
      ctx.fillStyle = cols[i];
      ctx.beginPath();
      ctx.moveTo(cx - w, cy);
      ctx.lineTo(cx, cy - h);
      ctx.lineTo(cx + w, cy);
      ctx.closePath();
      ctx.fill();
      glow(ctx, cx, cy - h * 0.5, h * 0.7, cols[i], 0.4);
    });
  }
  ctx.restore();
}

export { softBlob };
