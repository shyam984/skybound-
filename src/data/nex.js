// Nex character definitions. Everything about a Nex that isn't drawing code
// lives here, so adding a character is: add an entry below + a body renderer
// in render/nexRenderer.js (or reuse an existing one with a new palette).

export const RARITY = {
  common: { label: 'Common', color: '#8fd3ff' },
  rare: { label: 'Rare', color: '#c49bff' },
  epic: { label: 'Epic', color: '#ff6fd0' },
  mythic: { label: 'Mythic', color: '#ffc04a' },
};

export const NEX_ORDER = ['bolt', 'luma', 'echo', 'flux', 'nova'];

/** Player-facing stat labels (values are out of 10). */
export const STAT_KEYS = [
  { id: 'speed', label: 'Speed' },
  { id: 'collection', label: 'Collection' },
  { id: 'defence', label: 'Defence' },
  { id: 'ability', label: 'Ability' },
  { id: 'control', label: 'Control' },
];

/** XP needed and coin cost to reach each Nex level (index = level). */
export const NEX_LEVELS = [
  null,
  { xp: 0, coins: 0 },
  { xp: 150, coins: 150 },
  { xp: 400, coins: 350 },
  { xp: 800, coins: 700 },
  { xp: 1400, coins: 1200 },
];
export const MAX_NEX_LEVEL = 5;

export const NEX = {
  bolt: {
    id: 'bolt',
    name: 'Bolt',
    rarity: 'common',
    title: 'The Spark Explorer',
    personality: 'Energetic · Curious · Playful',
    bio: 'Always first through the portal. Bolt runs on pure curiosity and zips around like a live wire.',
    color: '#2f8cff',
    stats: { speed: 9, collection: 5, defence: 5, ability: 8, control: 8 },
    ability: {
      id: 'overdrive',
      name: 'Overdrive',
      duration: 5,
      cooldown: 14,
      power: 0.35,
      describe: (a) => `Boost movement speed by ${Math.round(a.power * 100)}% for ${a.duration.toFixed(1)}s.`,
    },
    unlock: { type: 'default' },
    palette: {
      body: '#2f8cff', light: '#8fdcff', dark: '#1646b8', core: '#6ff7ff', glow: '#39d9ff',
      accent: '#b8f7ff', cheek: '#8ef3ff', eye: '#0b1640', trail: '#4fd8ff',
    },
    celebrate: 'spin',
  },
  luma: {
    id: 'luma',
    name: 'Luma',
    rarity: 'rare',
    title: 'The Gentle Collector',
    personality: 'Calm · Friendly · Gentle',
    bio: 'Stray sparks drift toward Luma like moths to a lantern. She never leaves an orb behind.',
    color: '#b27bff',
    stats: { speed: 6, collection: 10, defence: 5, ability: 9, control: 7 },
    ability: {
      id: 'magnet',
      name: 'Magnet',
      duration: 6,
      cooldown: 16,
      power: 300,
      describe: (a) => `Pull in every energy orb within ${Math.round(a.power)} range for ${a.duration.toFixed(1)}s.`,
    },
    unlock: { type: 'fragments', count: 20, text: 'Collect 20 Luma fragments from challenges' },
    palette: {
      body: '#a86bff', light: '#f4c2ff', dark: '#6436c4', core: '#fff3ff', glow: '#e08cff',
      accent: '#ff7ad9', accent2: '#7ff1ff', cheek: '#ff8fd6', eye: '#2a0f4a', trail: '#d58cff',
    },
    celebrate: 'stars',
  },
  echo: {
    id: 'echo',
    name: 'Echo',
    rarity: 'rare',
    title: 'The Rhythm Keeper',
    personality: 'Focused · Mysterious · Confident',
    bio: 'Echo hears the beat inside every combo and refuses to let it drop.',
    color: '#ff4fc8',
    stats: { speed: 7, collection: 6, defence: 5, ability: 9, control: 9 },
    ability: {
      id: 'double_combo',
      name: 'Double Combo',
      duration: 5,
      cooldown: 15,
      power: 0.25,
      describe: (a) => `Combo timer drains ${Math.round((1 - a.power) * 100)}% slower for ${a.duration.toFixed(1)}s and refills when activated.`,
    },
    unlock: { type: 'level', level: 5, text: 'Reach player level 5' },
    palette: {
      body: '#5a2ca8', light: '#a77bff', dark: '#2a1164', core: '#ff5fd0', glow: '#ff4fc8',
      accent: '#ff8ce4', ring: '#f5e8ff', cheek: '#ff7ce0', eye: '#ffffff', trail: '#ff6fd6',
    },
    celebrate: 'afterimage',
  },
  flux: {
    id: 'flux',
    name: 'Flux',
    rarity: 'epic',
    title: 'The Slippery Drifter',
    personality: 'Relaxed · Clever · Mischievous',
    bio: 'Half creature, half current. Flux slips through danger with a smirk.',
    color: '#27d4c0',
    stats: { speed: 7, collection: 6, defence: 9, ability: 8, control: 7 },
    ability: {
      id: 'phase',
      name: 'Phase',
      duration: 4,
      cooldown: 16,
      power: 1,
      describe: (a) => `Become intangible for ${a.duration.toFixed(1)}s — hazards pass straight through you.`,
    },
    unlock: { type: 'stars', count: 15, text: 'Earn 15 challenge stars' },
    palette: {
      body: '#22c9b8', light: '#b6fff0', dark: '#0d7f86', core: '#c6fff4', glow: '#3dffd0',
      accent: '#63ff9f', cheek: '#8dffd9', eye: '#063b3d', trail: '#6dffe0',
    },
    celebrate: 'dissolve',
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    rarity: 'mythic',
    title: 'The Blazing Star',
    personality: 'Bold · Loud · Fearless',
    bio: 'Nova would rather blow an obstacle apart than walk around it.',
    color: '#ff8a2a',
    stats: { speed: 7, collection: 6, defence: 7, ability: 10, control: 6 },
    ability: {
      id: 'burst',
      name: 'Burst',
      duration: 4,
      cooldown: 18,
      power: 260,
      describe: (a) => `Blast a ${Math.round(a.power)}-range shockwave that knocks out nearby hazards for ${a.duration.toFixed(1)}s.`,
    },
    unlock: { type: 'challenge', challenge: 'supernova_trial', text: 'Complete the Supernova Trial' },
    palette: {
      body: '#ff8a2a', light: '#ffe27a', dark: '#d63d1c', core: '#fff8d6', glow: '#ffae3a',
      accent: '#ffd23d', spike: '#ffb938', cheek: '#ff5d3a', eye: '#3a1204', trail: '#ffa23a',
    },
    celebrate: 'burst',
  },
};

/** Ability numbers after level scaling and the Ability stat. */
export function getAbilityParams(id, level = 1) {
  const def = NEX[id] || NEX.bolt;
  const a = def.ability;
  const lv = Math.max(1, Math.min(MAX_NEX_LEVEL, level)) - 1;
  const statFactor = 1.24 - def.stats.ability * 0.03; // ability 8 → 0.998, 10 → 0.94
  return {
    ...a,
    duration: a.duration * (1 + 0.08 * lv),
    cooldown: a.cooldown * (1 - 0.06 * lv) * statFactor,
    power: a.id === 'double_combo' ? a.power : a.power * (1 + 0.05 * lv),
  };
}

/** Movement / collection parameters derived from stats (+2% per level). */
export function getNexGameplay(id, level = 1) {
  const def = NEX[id] || NEX.bolt;
  const s = def.stats;
  const lv = Math.max(1, Math.min(MAX_NEX_LEVEL, level)) - 1;
  const bonus = 1 + lv * 0.02;
  return {
    maxSpeed: (300 + s.speed * 22) * bonus,
    accel: 1150 + s.control * 150,
    friction: 3.2 + s.control * 0.45,
    magnet: 34 + s.collection * 9 + lv * 4,
    invuln: 0.9 + s.defence * 0.05,
    knockback: 520 - s.defence * 22,
    radius: 20,
  };
}

export function getNexDescription(id, level = 1) {
  const params = getAbilityParams(id, level);
  return params.describe(params);
}
