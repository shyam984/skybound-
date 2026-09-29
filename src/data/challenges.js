// Handcrafted challenge layouts.
//
// Coordinates are arena-local (0,0 = centre). Orb groups use named patterns
// (see game/patterns.js) so levels read like a designer's sketch:
//   { p: 'arc', x, y, r, a0, a1, n }  → n orbs along an arc
// Hazards list a spawn time `at` (seconds after GO); each one telegraphs with
// a warning before becoming dangerous. New challenge types can be added by
// giving a definition a new `type` and handling it in game/challengeScene.js.

export const THEMES = {
  meadow: {
    skyTop: '#0a1233', skyBottom: '#2b1f66', ground: '#17506a', ground2: '#1f6e78', grid: 'rgba(130,255,235,0.07)',
    edge: '#35e8ff', rock: '#2b2868', rockDark: '#151238', accent: '#48f5a0', props: ['bush', 'crystal', 'lamp', 'flower'],
  },
  garden: {
    skyTop: '#0d1030', skyBottom: '#40205e', ground: '#1f5250', ground2: '#2b6a58', grid: 'rgba(255,160,230,0.06)',
    edge: '#ff7ad9', rock: '#34265e', rockDark: '#191236', accent: '#ff9fe2', props: ['flower', 'bush', 'tree', 'flower'],
  },
  city: {
    skyTop: '#070b26', skyBottom: '#1c2066', ground: '#1f2560', ground2: '#28307a', grid: 'rgba(80,170,255,0.12)',
    edge: '#3d9bff', rock: '#222a66', rockDark: '#10143a', accent: '#35e8ff', props: ['lamp', 'pylon', 'lamp', 'crystal'],
  },
  hive: {
    skyTop: '#0b0a2a', skyBottom: '#2d1a5c', ground: '#322263', ground2: '#3f2c78', grid: 'rgba(200,150,255,0.08)',
    edge: '#b88cff', rock: '#2c1f5a', rockDark: '#150e33', accent: '#d9a8ff', props: ['crystal', 'crystal', 'pylon', 'bush'],
  },
  storm: {
    skyTop: '#0a0820', skyBottom: '#351446', ground: '#2a1d55', ground2: '#35226a', grid: 'rgba(255,90,190,0.08)',
    edge: '#ff4fb8', rock: '#2b1a4e', rockDark: '#140c2a', accent: '#ff8ad6', props: ['pylon', 'crystal', 'lamp', 'bush'],
  },
  core: {
    skyTop: '#07061a', skyBottom: '#3a1a28', ground: '#2c1d3c', ground2: '#3c2748', grid: 'rgba(255,190,80,0.08)',
    edge: '#ffb640', rock: '#2a1a30', rockDark: '#120a18', accent: '#ffd34a', props: ['crystal', 'pylon', 'crystal', 'lamp'],
  },
};

export const DIFFICULTY_LABELS = ['', 'Tutorial', 'Easy', 'Normal', 'Hard', 'Expert'];

export const CHALLENGE_ORDER = [
  'first_flight',
  'sunrise_rush',
  'pulse_garden',
  'laser_lanes',
  'drone_hive',
  'storm_circuit',
  'supernova_trial',
];

export const CHALLENGES = {
  first_flight: {
    id: 'first_flight',
    name: 'First Flight',
    type: 'tutorial',
    blurb: 'Learn to fly, collect energy and build your first combo.',
    difficulty: 1,
    theme: 'meadow',
    time: 0, // untimed
    objective: { energy: 30, text: 'Learn the basics' },
    stars: [800, 1300],
    comboWindow: 3.4,
    arena: { w: 1300, h: 900 },
    spawn: { x: 0, y: 200 },
    gate: { x: 0, y: -330 },
    requires: {},
    rewards: { coins: 50, xp: 60 },
    // Tutorial content is spawned step by step by game/tutorialScript.js
    orbs: [],
    specials: [],
    hazards: [],
  },

  sunrise_rush: {
    id: 'sunrise_rush',
    name: 'Sunrise Rush',
    type: 'energy_rush',
    blurb: 'A friendly warm-up. Sweep the arcs and dodge the drifting lasers.',
    difficulty: 2,
    theme: 'meadow',
    time: 75,
    objective: { energy: 50 },
    stars: [2800, 5600],
    comboWindow: 3,
    arena: { w: 1700, h: 1150 },
    spawn: { x: 0, y: 250 },
    gate: { x: 0, y: -470 },
    requires: { prev: 'first_flight' },
    rewards: { coins: 40, xp: 70, fragments: { luma: 6 } },
    orbs: [
      { p: 'line', x: 0, y: 30, n: 7, angle: 0, spacing: 70, respawn: 6 },
      { p: 'arc', x: 0, y: -140, r: 300, a0: 200, a1: 340, n: 9, respawn: 8 },
      { p: 'arc', x: 0, y: 160, r: 300, a0: 30, a1: 150, n: 7, respawn: 8 },
      { p: 'zigzag', x: -620, y: 0, n: 7, angle: 90, spacing: 62, amp: 40, respawn: 8 },
      { p: 'zigzag', x: 620, y: 0, n: 7, angle: 90, spacing: 62, amp: 40, respawn: 8 },
      { p: 'circle', x: -430, y: -300, r: 85, n: 8, respawn: 10 },
      { p: 'circle', x: 430, y: 300, r: 85, n: 8, respawn: 10 },
    ],
    specials: [
      { type: 'gold', x: 0, y: -330, at: 6, every: 16, life: 10 },
      { type: 'gold', x: -620, y: 390, at: 14, every: 16, life: 10 },
      { type: 'gold', x: 620, y: -390, at: 22, every: 16, life: 10 },
      { type: 'rainbow', x: 0, y: 30, at: 30, every: 30, life: 8 },
      { type: 'time', x: -720, y: -420, at: 34, every: 30, life: 10 },
      { type: 'shield', x: -430, y: -300, at: 40, every: 30, life: 12 },
      { type: 'giant', x: 430, y: 300, at: 46 },
    ],
    hazards: [
      { type: 'laser', x: 0, y: -150, len: 380, angle: 0, move: { dx: 0, dy: 110, period: 5.5 }, at: 2 },
      { type: 'mine', x: -430, y: -300, r: 45, speed: 1.3, at: 12 },
      { type: 'laser', x: 280, y: 0, len: 300, angle: 90, move: { dx: 110, dy: 0, period: 6, phase: 0.5 }, at: 20 },
    ],
  },

  pulse_garden: {
    id: 'pulse_garden',
    name: 'Pulse Garden',
    type: 'energy_rush',
    blurb: 'Time your dash between the sweeping barrier arms. Patrol drones circle the garden.',
    difficulty: 2,
    theme: 'garden',
    time: 80,
    objective: { energy: 65 },
    stars: [1500, 2800],
    comboWindow: 3,
    arena: { w: 1700, h: 1150 },
    spawn: { x: 0, y: 400 },
    gate: { x: 0, y: -470 },
    requires: { prev: 'sunrise_rush', level: 2 },
    rewards: { coins: 50, xp: 80, fragments: { luma: 6 } },
    orbs: [
      { p: 'circle', x: 0, y: 0, r: 150, n: 10, respawn: 7 },
      { p: 'circle', x: 0, y: 0, r: 300, n: 14, respawn: 9 },
      { p: 'line', x: -620, y: -320, n: 5, angle: 0, spacing: 60, respawn: 8 },
      { p: 'line', x: 620, y: -320, n: 5, angle: 0, spacing: 60, respawn: 8 },
      { p: 'line', x: -620, y: 320, n: 5, angle: 0, spacing: 60, respawn: 8 },
      { p: 'line', x: 620, y: 320, n: 5, angle: 0, spacing: 60, respawn: 8 },
      { p: 'arc', x: -620, y: 0, r: 120, a0: 100, a1: 260, n: 6, respawn: 9 },
      { p: 'arc', x: 620, y: 0, r: 120, a0: -80, a1: 80, n: 6, respawn: 9 },
    ],
    specials: [
      { type: 'gold', x: 0, y: 0, at: 8, every: 14, life: 9 },
      { type: 'gold', x: 620, y: 0, at: 16, every: 16, life: 9 },
      { type: 'rainbow', x: -620, y: 0, at: 20, every: 25, life: 8 },
      { type: 'time', x: 0, y: 470, at: 30, every: 30, life: 10 },
      { type: 'giant', x: 620, y: -440, at: 40 },
      { type: 'shield', x: -620, y: -440, at: 45, every: 30, life: 12 },
    ],
    hazards: [
      { type: 'barrier', x: 0, y: 0, len: 245, arms: 2, speed: 0.8, at: 2 },
      { type: 'drone', path: [[-450, -420], [450, -420], [450, 420], [-450, 420]], speed: 110, at: 12 },
      { type: 'drone', path: [[-450, -420], [450, -420], [450, 420], [-450, 420]], speed: 110, offset: 0.5, at: 24 },
    ],
  },

  laser_lanes: {
    id: 'laser_lanes',
    name: 'Laser Lanes',
    type: 'energy_rush',
    blurb: 'Three sweeping beams guard three rich lanes. Read the rhythm, then commit.',
    difficulty: 3,
    theme: 'city',
    time: 90,
    objective: { energy: 90 },
    stars: [2500, 5000],
    comboWindow: 3,
    arena: { w: 1800, h: 1200 },
    spawn: { x: 0, y: 460 },
    gate: { x: 0, y: -500 },
    requires: { prev: 'pulse_garden', level: 3 },
    rewards: { coins: 60, xp: 95, fragments: { luma: 5 } },
    orbs: [
      { p: 'line', x: -450, y: 0, n: 9, angle: 90, spacing: 70, respawn: 8 },
      { p: 'line', x: 0, y: 0, n: 9, angle: 90, spacing: 70, respawn: 8 },
      { p: 'line', x: 450, y: 0, n: 9, angle: 90, spacing: 70, respawn: 8 },
      { p: 'zigzag', x: -225, y: 0, n: 7, angle: 90, spacing: 80, amp: 30, respawn: 8 },
      { p: 'zigzag', x: 225, y: 0, n: 7, angle: 90, spacing: 80, amp: 30, respawn: 8 },
      { p: 'circle', x: -760, y: -380, r: 100, n: 8, respawn: 10 },
      { p: 'circle', x: 760, y: 380, r: 100, n: 8, respawn: 10 },
      { p: 'arc', x: 0, y: 330, r: 200, a0: 200, a1: 340, n: 7, respawn: 9 },
    ],
    specials: [
      { type: 'gold', x: -225, y: -450, at: 5, every: 15, life: 10 },
      { type: 'gold', x: 225, y: 450, at: 12, every: 15, life: 10 },
      { type: 'rainbow', x: 0, y: 0, at: 25, every: 25, life: 8 },
      { type: 'time', x: -760, y: 380, at: 30, every: 30, life: 10 },
      { type: 'shield', x: -760, y: -380, at: 40, every: 35, life: 12 },
      { type: 'giant', x: 760, y: -380, at: 50 },
    ],
    hazards: [
      { type: 'laser', x: -450, y: 0, len: 220, angle: 0, move: { dx: 0, dy: 320, period: 9, phase: 0 }, at: 2 },
      { type: 'laser', x: 0, y: 0, len: 220, angle: 0, move: { dx: 0, dy: 320, period: 9, phase: 0.33 }, at: 6 },
      { type: 'laser', x: 450, y: 0, len: 220, angle: 0, move: { dx: 0, dy: 320, period: 9, phase: 0.66 }, at: 14 },
      { type: 'barrier', x: -760, y: -380, len: 150, arms: 1, speed: 1.2, at: 20 },
      { type: 'barrier', x: 760, y: 380, len: 150, arms: 1, speed: -1.2, at: 20 },
    ],
  },

  drone_hive: {
    id: 'drone_hive',
    name: 'Drone Hive',
    type: 'energy_rush',
    blurb: 'Patrol drones, drifting mines and a flickering storm. Stay light on your feet.',
    difficulty: 3,
    theme: 'hive',
    time: 90,
    objective: { energy: 110 },
    stars: [3600, 7200],
    comboWindow: 3,
    arena: { w: 1800, h: 1200 },
    spawn: { x: 0, y: 460 },
    gate: { x: 0, y: -500 },
    requires: { prev: 'laser_lanes', level: 4 },
    rewards: { coins: 70, xp: 110, fragments: { luma: 5 } },
    orbs: [
      { p: 'circle', x: 0, y: 0, r: 150, n: 12, respawn: 8 },
      { p: 'line', x: 0, y: -250, n: 9, angle: 0, spacing: 110, respawn: 8 },
      { p: 'line', x: 0, y: 250, n: 9, angle: 0, spacing: 110, respawn: 8 },
      { p: 'zigzag', x: -680, y: 0, n: 8, angle: 90, spacing: 70, amp: 35, respawn: 9 },
      { p: 'zigzag', x: 680, y: 0, n: 8, angle: 90, spacing: 70, amp: 35, respawn: 9 },
      { p: 'circle', x: -400, y: -130, r: 90, n: 7, respawn: 10 },
      { p: 'circle', x: 400, y: 130, r: 90, n: 7, respawn: 10 },
    ],
    specials: [
      { type: 'gold', x: -680, y: 420, at: 8, every: 16, life: 10 },
      { type: 'rainbow', x: 680, y: -420, at: 15, every: 24, life: 8 },
      { type: 'time', x: -680, y: -440, at: 30, every: 30, life: 10 },
      { type: 'gold', x: 0, y: -380, at: 36, every: 14, life: 9 },
      { type: 'shield', x: 680, y: 440, at: 45, every: 30, life: 12 },
      { type: 'giant', x: 0, y: 0, at: 50 },
    ],
    hazards: [
      { type: 'drone', path: [[-600, -360], [600, -360]], speed: 150, at: 2 },
      { type: 'drone', path: [[600, 360], [-600, 360]], speed: 150, at: 5 },
      { type: 'mine', x: 0, y: 0, r: 70, speed: 1.5, at: 8 },
      { type: 'drone', path: [[-300, 0], [0, -230], [300, 0], [0, 230]], speed: 170, at: 14 },
      { type: 'mine', x: -400, y: -130, r: 55, speed: -1.3, at: 25 },
      { type: 'mine', x: 400, y: 130, r: 55, speed: 1.3, at: 25 },
      { type: 'storm', x: 0, y: -380, r: 120, on: 3, off: 4, at: 34 },
    ],
  },

  storm_circuit: {
    id: 'storm_circuit',
    name: 'Storm Circuit',
    type: 'energy_rush',
    blurb: 'Storm zones pulse on a strict rhythm. Ride the circuit between them.',
    difficulty: 4,
    theme: 'storm',
    time: 100,
    objective: { energy: 115 },
    stars: [2600, 5200],
    comboWindow: 2.7,
    arena: { w: 1900, h: 1250 },
    spawn: { x: 0, y: 490 },
    gate: { x: 0, y: -530 },
    requires: { prev: 'drone_hive', level: 5 },
    rewards: { coins: 85, xp: 130 },
    orbs: [
      { p: 'circle', x: -450, y: -200, r: 110, n: 8, respawn: 8 },
      { p: 'circle', x: 450, y: -200, r: 110, n: 8, respawn: 8 },
      { p: 'circle', x: 0, y: 200, r: 120, n: 10, respawn: 8 },
      { p: 'circle', x: -720, y: 300, r: 120, n: 8, respawn: 9 },
      { p: 'circle', x: 720, y: 300, r: 120, n: 8, respawn: 9 },
      { p: 'arc', x: 0, y: -300, r: 280, a0: 200, a1: 340, n: 9, respawn: 9 },
      { p: 'line', x: 0, y: -40, n: 9, angle: 0, spacing: 80, respawn: 7 },
    ],
    specials: [
      { type: 'gold', x: -450, y: -200, at: 6, every: 12, life: 8 },
      { type: 'gold', x: 450, y: -200, at: 12, every: 12, life: 8 },
      { type: 'rainbow', x: 0, y: 200, at: 20, every: 20, life: 8 },
      { type: 'time', x: -840, y: -20, at: 25, every: 25, life: 10 },
      { type: 'giant', x: 0, y: -300, at: 45 },
      { type: 'time', x: 840, y: -20, at: 50, every: 25, life: 10 },
      { type: 'shield', x: 0, y: 520, at: 55, every: 30, life: 12 },
    ],
    hazards: [
      { type: 'storm', x: -450, y: -200, r: 150, on: 3, off: 3.5, phase: 0, at: 2 },
      { type: 'storm', x: 450, y: -200, r: 150, on: 3, off: 3.5, phase: 3.2, at: 2 },
      { type: 'barrier', x: -720, y: 300, len: 190, arms: 2, speed: 1.1, at: 6 },
      { type: 'barrier', x: 720, y: 300, len: 190, arms: 2, speed: -1.1, at: 6 },
      { type: 'storm', x: 0, y: 200, r: 170, on: 3, off: 3.5, phase: 1.6, at: 10 },
      { type: 'barrier', x: 0, y: -300, len: 220, arms: 3, speed: 0.7, at: 15 },
      { type: 'laser', x: 0, y: 0, len: 300, angle: 90, move: { dx: 720, dy: 0, period: 10 }, at: 25 },
      { type: 'drone', path: [[-820, -480], [820, -480]], speed: 200, at: 30 },
    ],
  },

  supernova_trial: {
    id: 'supernova_trial',
    name: 'Supernova Trial',
    type: 'energy_rush',
    special: true,
    blurb: 'The ultimate test. Clear it and a blazing new Nex will join you.',
    difficulty: 5,
    theme: 'core',
    time: 110,
    objective: { energy: 160 },
    stars: [3000, 6000],
    comboWindow: 2.5,
    arena: { w: 2000, h: 1300 },
    spawn: { x: 0, y: 520 },
    gate: { x: 0, y: -540 },
    requires: { prev: 'storm_circuit', level: 6 },
    rewards: { coins: 110, xp: 160 },
    orbs: [
      { p: 'circle', x: 0, y: 0, r: 170, n: 12, respawn: 8 },
      { p: 'circle', x: 0, y: 0, r: 330, n: 16, respawn: 10 },
      { p: 'circle', x: -520, y: -330, r: 115, n: 8, respawn: 9 },
      { p: 'circle', x: 520, y: 330, r: 115, n: 8, respawn: 9 },
      { p: 'circle', x: 520, y: -330, r: 115, n: 8, respawn: 9 },
      { p: 'circle', x: -520, y: 330, r: 115, n: 8, respawn: 9 },
      { p: 'zigzag', x: -860, y: 0, n: 8, angle: 90, spacing: 75, amp: 35, respawn: 9 },
      { p: 'zigzag', x: 860, y: 0, n: 8, angle: 90, spacing: 75, amp: 35, respawn: 9 },
    ],
    specials: [
      { type: 'gold', x: -520, y: -330, at: 6, every: 14, life: 8 },
      { type: 'gold', x: 520, y: 330, at: 13, every: 14, life: 8 },
      { type: 'rainbow', x: 0, y: 0, at: 20, every: 22, life: 7 },
      { type: 'time', x: -860, y: -480, at: 25, every: 25, life: 10 },
      { type: 'shield', x: 860, y: 480, at: 35, every: 30, life: 12 },
      { type: 'time', x: 860, y: -480, at: 50, every: 25, life: 10 },
      { type: 'giant', x: 0, y: -440, at: 55 },
    ],
    hazards: [
      { type: 'barrier', x: 0, y: 0, len: 260, arms: 4, speed: 0.75, at: 2 },
      { type: 'laser', x: -700, y: 0, len: 340, angle: 90, move: { dx: 140, dy: 0, period: 5 }, at: 4 },
      { type: 'laser', x: 700, y: 0, len: 340, angle: 90, move: { dx: 140, dy: 0, period: 5, phase: 0.5 }, at: 4 },
      { type: 'drone', path: [[-860, -540], [860, -540], [860, 540], [-860, 540]], speed: 220, at: 9 },
      { type: 'mine', x: -520, y: -330, r: 60, speed: 1.4, at: 14 },
      { type: 'mine', x: 520, y: 330, r: 60, speed: 1.4, at: 14 },
      { type: 'mine', x: 520, y: -330, r: 60, speed: -1.4, at: 20 },
      { type: 'mine', x: -520, y: 330, r: 60, speed: -1.4, at: 20 },
      { type: 'drone', path: [[-860, -540], [860, -540], [860, 540], [-860, 540]], speed: 220, offset: 0.5, at: 26 },
      { type: 'storm', x: 0, y: -440, r: 130, on: 3, off: 3, at: 30 },
      { type: 'storm', x: 0, y: 450, r: 130, on: 3, off: 3, phase: 3, at: 30 },
    ],
  },
};

export function getChallenge(id) {
  return CHALLENGES[id] || null;
}

export function nextChallengeId(id) {
  const i = CHALLENGE_ORDER.indexOf(id);
  return i >= 0 && i < CHALLENGE_ORDER.length - 1 ? CHALLENGE_ORDER[i + 1] : null;
}

/** Scoring constants (base points before the combo multiplier). */
export const ORB_TYPES = {
  blue: { energy: 1, points: 10, radius: 11, color: '#35e8ff', core: '#e8feff' },
  gold: { energy: 5, points: 50, radius: 15, color: '#ffc93a', core: '#fff6cf' },
  rainbow: { energy: 1, points: 100, radius: 15, color: '#ff6fd6', core: '#ffffff' },
  giant: { energy: 20, points: 200, radius: 30, color: '#6ff0ff', core: '#ffffff' },
  time: { energy: 0, points: 20, radius: 15, color: '#8dff7a', core: '#effff0', seconds: 5 },
  shield: { energy: 0, points: 30, radius: 15, color: '#7aa8ff', core: '#eef4ff', fullBonus: 150 },
};

export const COMBO_TIERS = [
  { at: 0, mult: 1 },
  { at: 5, mult: 2 },
  { at: 10, mult: 3 },
  { at: 20, mult: 4 },
  { at: 30, mult: 5 },
];
