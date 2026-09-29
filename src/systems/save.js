// Save system.
//
// The game talks to SaveSystem only; the storage backend is an adapter with
// load/save/clear. LocalStorageAdapter is used in Version 1 — a cloud adapter
// (with the same three methods) can be dropped in later without touching
// gameplay code.

import { NEX_ORDER } from '../data/nex.js';
import { num } from '../core/math.js';

export const SAVE_VERSION = 1;
const STORAGE_KEY = 'neon-nexus.save';

export class LocalStorageAdapter {
  constructor(key = STORAGE_KEY) {
    this.key = key;
    this.available = (() => {
      try {
        const k = '__nn_test__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
      } catch {
        return false;
      }
    })();
  }

  load() {
    if (!this.available) return null;
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  save(data) {
    if (!this.available) return false;
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  clear() {
    if (!this.available) return;
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }
}

export function createDefaultSave() {
  const prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Phones/tablets start on Medium graphics; everything can be changed in Settings.
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const nex = {};
  for (const id of NEX_ORDER) nex[id] = { unlocked: id === 'bolt', level: 1, xp: 0, skin: null };
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    profile: { level: 1, xp: 0, coins: 0, energy: 0 },
    activeNex: 'bolt',
    nex,
    fragments: { luma: 0 },
    buildings: {
      hub: { level: 1 },
      portal: { level: 1 },
      shop: { level: 1 },
      generator: { level: 0, stored: 0, lastTick: now },
      lab: { level: 0 },
      garden: { level: 0 },
    },
    decor: { slots: {}, inventory: {} },
    cosmetics: { owned: [], trail: null, effect: null },
    challenges: {},
    missions: { day: '', list: [], completedTotal: 0 },
    achievements: {},
    stats: {
      totalEnergy: 0,
      challengesPlayed: 0,
      challengesCompleted: 0,
      perfectRuns: 0,
      bestMultiplier: 1,
      bestCombo: 0,
      abilitiesUsed: 0,
      goldOrbs: 0,
      specialOrbs: 0,
    },
    tutorial: { intro: false, firstChallenge: false, firstBuild: false, islandsHint: false, labHint: false },
    settings: { music: 0.5, sfx: 0.8, quality: coarse ? 'medium' : 'high', reducedMotion: prefersReduced },
  };
}

/** Merge a loaded save onto defaults so new fields added later always exist. */
function mergeDefaults(def, loaded) {
  if (loaded === null || loaded === undefined) return def;
  if (def === null) return loaded; // nullable fields (e.g. equipped cosmetics)
  if (Array.isArray(def)) return Array.isArray(loaded) ? loaded : def;
  if (typeof def === 'object' && def !== null) {
    if (typeof loaded !== 'object' || Array.isArray(loaded)) return def;
    const out = { ...loaded };
    for (const k of Object.keys(def)) out[k] = mergeDefaults(def[k], loaded[k]);
    return out;
  }
  if (typeof def === 'number') return num(loaded, def);
  if (typeof def !== typeof loaded) return def;
  return loaded;
}

function migrate(data) {
  // Future schema migrations go here, keyed on data.version.
  data.version = SAVE_VERSION;
  return data;
}

export class SaveSystem {
  constructor(adapter = new LocalStorageAdapter()) {
    this.adapter = adapter;
    this.data = null;
    this.timer = 0;
    this.lastSaveOk = true;
  }

  load() {
    const raw = this.adapter.load();
    let data = createDefaultSave();
    if (raw && typeof raw === 'object') {
      try {
        data = migrate(mergeDefaults(data, raw));
      } catch (err) {
        console.warn('[save] could not read save, starting fresh', err);
        data = createDefaultSave();
      }
    }
    this.data = data;
    return data;
  }

  /** Debounced save for frequent small changes. */
  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveNow(), 400);
  }

  saveNow() {
    clearTimeout(this.timer);
    if (!this.data) return false;
    this.data.updatedAt = Date.now();
    this.lastSaveOk = this.adapter.save(this.data);
    return this.lastSaveOk;
  }

  reset() {
    clearTimeout(this.timer);
    this.adapter.clear();
    this.data = createDefaultSave();
    this.saveNow();
    return this.data;
  }
}
