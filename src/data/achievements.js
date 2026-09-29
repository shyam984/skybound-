// Achievements are evaluated from the save data, so progress is always
// accurate (no separate counters to drift out of sync).

import { CHALLENGES } from './challenges.js';
import { BUILDABLE } from './buildings.js';

export function totalStars(d) {
  let n = 0;
  for (const id of Object.keys(d.challenges || {})) {
    if (CHALLENGES[id]) n += d.challenges[id].stars || 0;
  }
  return n;
}

const builtCount = (d) => BUILDABLE.filter((id) => (d.buildings[id]?.level || 0) > 0).length;
const unlockedNex = (d) => Object.values(d.nex || {}).filter((n) => n.unlocked).length;
const decorPlaced = (d) => Object.values(d.decor?.slots || {}).filter(Boolean).length;

export const ACHIEVEMENTS = [
  { id: 'first_flight', name: 'First Flight', desc: 'Complete your first challenge', icon: 'flag', target: 1, value: (d) => d.stats.challengesCompleted, reward: 25 },
  { id: 'builder', name: 'Builder', desc: 'Construct your first building', icon: 'build', target: 1, value: builtCount, reward: 50 },
  { id: 'energy_hunter', name: 'Energy Hunter', desc: 'Collect 1,000 energy in challenges', icon: 'energy', target: 1000, value: (d) => d.stats.totalEnergy, reward: 150 },
  { id: 'combo_king', name: 'Combo King', desc: 'Reach a x5 combo', icon: 'combo', target: 5, value: (d) => d.stats.bestMultiplier, reward: 60 },
  { id: 'perfect_run', name: 'Perfect Run', desc: 'Complete a challenge without taking damage', icon: 'shield', target: 1, value: (d) => d.stats.perfectRuns, reward: 60 },
  { id: 'collector', name: 'Collector', desc: 'Unlock a second Nex', icon: 'nex', target: 2, value: unlockedNex, reward: 150 },
  { id: 'star_seeker', name: 'Star Seeker', desc: 'Earn 15 challenge stars', icon: 'star', target: 15, value: totalStars, reward: 200 },
  { id: 'decorator', name: 'Decorator', desc: 'Place 3 decorations on your island', icon: 'decor', target: 3, value: decorPlaced, reward: 80 },
  { id: 'architect', name: 'Architect', desc: 'Upgrade the Nexus Hub to level 3', icon: 'hub', target: 3, value: (d) => d.buildings.hub.level, reward: 200 },
  { id: 'overcharged', name: 'Overcharged', desc: 'Use Nex abilities 50 times', icon: 'sparkle', target: 50, value: (d) => d.stats.abilitiesUsed, reward: 120 },
  { id: 'mission_ace', name: 'Mission Ace', desc: 'Complete 10 daily missions', icon: 'mission', target: 10, value: (d) => d.missions.completedTotal, reward: 200 },
  { id: 'full_squad', name: 'Full Squad', desc: 'Unlock all five Nex', icon: 'trophy', target: 5, value: unlockedNex, reward: 500 },
  { id: 'veteran', name: 'Veteran Explorer', desc: 'Complete 25 challenges', icon: 'trophy', target: 25, value: (d) => d.stats.challengesCompleted, reward: 300 },
];
