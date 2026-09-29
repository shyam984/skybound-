// Daily mission templates. Three are picked per day from a date-seeded RNG,
// so the system can later be swapped for server-driven or seasonal missions.

export const MISSION_TEMPLATES = [
  { id: 'energy', stat: 'energy', text: (n) => `Collect ${n} energy`, values: [80, 120, 180], reward: { coins: 60, xp: 40 }, icon: 'energy' },
  { id: 'clears', stat: 'clears', text: (n) => `Complete ${n} challenges`, values: [2, 3, 3], reward: { coins: 80, xp: 50 }, icon: 'flag' },
  { id: 'combo', stat: 'comboMax', mode: 'max', text: (n) => `Reach a x${n} combo`, values: [3, 4, 5], reward: { coins: 70, xp: 45 }, icon: 'combo' },
  { id: 'stars', stat: 'stars', text: (n) => `Earn ${n} stars in challenges`, values: [3, 4, 6], reward: { coins: 70, xp: 45 }, icon: 'star' },
  { id: 'gold', stat: 'gold', text: (n) => `Collect ${n} gold orbs`, values: [3, 5, 7], reward: { coins: 60, xp: 40 }, icon: 'coin' },
  { id: 'ability', stat: 'ability', text: (n) => `Use your Nex ability ${n} times`, values: [3, 5, 8], reward: { coins: 50, xp: 35 }, icon: 'sparkle' },
  { id: 'perfect', stat: 'perfect', text: () => 'Finish a challenge without taking damage', values: [1, 1, 1], reward: { coins: 90, xp: 60 }, icon: 'shield' },
];

export const MISSION_NEX_XP = 50;
