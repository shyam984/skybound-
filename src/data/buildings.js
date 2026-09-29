// Island buildings. `slot` is the building's position on Nexus Island
// (island-local units; the island top is an ellipse ~560 x 330).
// `levels[n]` is the cost/requirement to reach level n.

export const BUILDINGS = {
  hub: {
    id: 'hub',
    name: 'Nexus Hub',
    icon: 'hub',
    desc: 'The heart of your island. It grows with you and boosts coins from every challenge.',
    slot: { x: 0, y: -40 },
    radius: 92,
    prebuilt: true,
    maxLevel: 5,
    levels: [
      null,
      { coins: 0, energy: 0, reqLevel: 1 },
      { coins: 250, energy: 60, reqLevel: 3 },
      { coins: 600, energy: 150, reqLevel: 5 },
      { coins: 1200, energy: 300, reqLevel: 7 },
      { coins: 2000, energy: 500, reqLevel: 9 },
    ],
    effect: (lvl) => (lvl > 1 ? `+${(lvl - 1) * 5}% coins from challenges` : 'No coin bonus yet'),
    action: 'upgrade',
  },
  portal: {
    id: 'portal',
    name: 'Challenge Portal',
    icon: 'play',
    desc: 'Your gateway to challenges.',
    slot: { x: 0, y: 200 },
    radius: 70,
    prebuilt: true,
    fixed: true,
    maxLevel: 1,
    action: 'play',
  },
  shop: {
    id: 'shop',
    name: 'Nexus Shop',
    icon: 'shop',
    desc: 'Cosmetics and decorations.',
    slot: { x: 350, y: 170 },
    radius: 62,
    prebuilt: true,
    fixed: true,
    maxLevel: 1,
    action: 'shop',
  },
  generator: {
    id: 'generator',
    name: 'Energy Generator',
    icon: 'energy',
    desc: 'Produces energy over time, even while you are away. Tap it to collect.',
    slot: { x: -350, y: 160 },
    radius: 60,
    maxLevel: 3,
    levels: [
      null,
      { coins: 100, energy: 0, reqLevel: 1, rate: 3, cap: 60 },
      { coins: 400, energy: 80, reqLevel: 4, rate: 5, cap: 120 },
      { coins: 900, energy: 200, reqLevel: 6, rate: 8, cap: 220 },
    ],
    effect: (lvl, def) => {
      const l = def.levels[Math.max(1, lvl)];
      return `${l.rate} energy / min · stores ${l.cap}`;
    },
    action: 'collect',
  },
  lab: {
    id: 'lab',
    name: 'Character Lab',
    icon: 'nex',
    desc: 'Lets you upgrade your Nex. Your active Nex is shown on its display platform.',
    slot: { x: 340, y: -70 },
    radius: 66,
    maxLevel: 1,
    levels: [null, { coins: 200, energy: 40, reqLevel: 2 }],
    effect: () => 'Enables Nex upgrades',
    action: 'nex',
  },
  garden: {
    id: 'garden',
    name: 'Garden',
    icon: 'decor',
    desc: 'Opens 8 decoration spots. Each decoration placed adds +1% energy from challenges.',
    slot: { x: -340, y: -70 },
    radius: 70,
    maxLevel: 1,
    levels: [null, { coins: 300, energy: 80, reqLevel: 3 }],
    effect: () => 'Unlocks island decorating',
    action: 'decorate',
  },
};

export const BUILDABLE = ['generator', 'lab', 'garden'];
export const BUILDING_ORDER = ['hub', 'generator', 'lab', 'garden', 'portal', 'shop'];

export const DECOR_SLOTS = [
  { id: 'd1', x: -160, y: 50 },
  { id: 'd2', x: 160, y: 50 },
  { id: 'd3', x: -485, y: 50 },
  { id: 'd4', x: 485, y: 45 },
  { id: 'd5', x: -175, y: -205 },
  { id: 'd6', x: 175, y: -205 },
  { id: 'd7', x: -165, y: 245 },
  { id: 'd8', x: 170, y: 250 },
];

export const DECOR_ITEMS = {
  lamp: { id: 'lamp', name: 'Neon Lamp', price: 80 },
  bench: { id: 'bench', name: 'Hover Bench', price: 60 },
  flowers: { id: 'flowers', name: 'Glow Flowers', price: 90 },
  tree: { id: 'tree', name: 'Energy Tree', price: 120 },
  sign: { id: 'sign', name: 'Holo Sign', price: 150 },
  crystal: { id: 'crystal', name: 'Crystal Cluster', price: 180 },
  fountain: { id: 'fountain', name: 'Plasma Fountain', price: 250 },
  statue: { id: 'statue', name: 'Nex Statue', price: 400 },
};

/** Distant islands shown around Nexus Island. Not playable in Version 1. */
export const WORLD_ISLANDS = [
  { id: 'sky_garden', name: 'Sky Garden', x: -900, y: -330, scale: 0.34, theme: 'garden', note: 'Arrives in a future update' },
  { id: 'volt_city', name: 'Volt City', x: 930, y: -300, scale: 0.36, theme: 'city', note: 'Arrives in a future update' },
  { id: 'crystal_cove', name: 'Crystal Cove', x: 330, y: -620, scale: 0.22, theme: 'crystal', note: 'Arrives in a future update' },
];
