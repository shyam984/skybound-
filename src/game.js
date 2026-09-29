// Game orchestrator: owns every system, the single main loop, the state
// machine and the high-level flows (start challenge, results, building,
// shopping, first-time tutorial).
//
// States: BOOT → MAIN_MENU ⇄ (CHALLENGE_SELECT | NEX_COLLECTION | ISLAND |
// MISSIONS | SHOP | SETTINGS | DECORATING) → PLAYING ⇄ PAUSED → RESULTS

import { Emitter } from './core/events.js';
import { Loop, Tweens } from './core/loop.js';
import { SaveSystem, LocalStorageAdapter } from './systems/save.js';
import { Progression } from './systems/progression.js';
import { MissionSystem } from './systems/missions.js';
import { AchievementSystem } from './systems/achievements.js';
import { AudioSystem } from './systems/audio.js';
import { Input } from './systems/input.js';
import { CanvasView } from './render/view.js';
import { Particles } from './render/particles.js';
import { drawDecor } from './render/islandArt.js';
import { IslandScene } from './island/islandScene.js';
import { ChallengeScene } from './game/challengeScene.js';
import { UI } from './ui/ui.js';
import { SplashScreen, IntroScreen, PauseScreen, Celebration } from './ui/screens/overlays.js';
import { ResultsScreen } from './ui/screens/results.js';
import { NEX, NEX_ORDER, getAbilityParams, getNexDescription } from './data/nex.js';
import { CHALLENGES } from './data/challenges.js';
import { BUILDINGS, BUILDABLE, DECOR_SLOTS } from './data/buildings.js';
import { SKINS, getShopItem } from './data/shop.js';
import { icon } from './ui/icons.js';
import { fmt } from './core/math.js';

const PANEL_STATES = ['CHALLENGE_SELECT', 'NEX_COLLECTION', 'SHOP', 'MISSIONS', 'SETTINGS', 'ISLAND'];

export class Game {
  constructor() {
    this.state = null;
    this.scene = null;
    this.paletteCache = new Map();
    this.celebrations = [];
    this.celebrating = null;
    this.resultsDone = true;
  }

  get data() {
    return this.save.data;
  }

  get quality() {
    return this.data.settings.quality;
  }

  get reducedMotion() {
    return !!this.data.settings.reducedMotion;
  }

  boot() {
    this.events = new Emitter();
    this.tweens = new Tweens();
    this.save = new SaveSystem(new LocalStorageAdapter());
    this.save.load();
    this.audio = new AudioSystem();
    this.view = new CanvasView(document.getElementById('game-canvas'));
    this.particles = new Particles();
    this.progress = new Progression(this);
    this.missions = new MissionSystem(this);
    this.achievements = new AchievementSystem(this);
    this.input = new Input(this, document.getElementById('game-canvas'), document.getElementById('joystick'));
    this.ui = new UI(this);
    this.island = new IslandScene(this);
    this.challenge = new ChallengeScene(this);
    this.applySettings();
    this.missions.refresh();
    this.progress.updateGenerator();

    this.events.on('level:up', (info) => this.queueCelebration({ type: 'level', ...info }));
    this.events.on('nex:unlocked', (e) => this.queueCelebration({ type: 'nex', id: e.id }));
    this.events.on('nex:active', () => this.ui.updateBadges());

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('pagehide', () => this.saveNow());

    this.loop = new Loop((dt) => this.tick(dt));
    this.setState('BOOT');
    this.loop.start();
  }

  // ---------------------------------------------------------------- loop
  tick(dt) {
    this.tweens.update(dt);
    if (this.scene) {
      this.scene.update(dt);
      this.scene.render();
    }
    this.ui.update(dt);
    if (this.celebrating) this.celebrating.update(dt);
  }

  onResize() {
    this.view.resize();
    this.island.resize();
    this.challenge.resize();
  }

  onVisibility() {
    if (document.hidden) {
      if (this.state === 'PLAYING' && this.challenge.phase === 'play') this.pause();
      this.audio.suspend();
      this.saveNow();
    } else {
      this.audio.resume();
    }
  }

  saveNow() {
    this.save.saveNow();
  }

  // ---------------------------------------------------------------- state machine
  setState(next, params = {}) {
    const prev = this.state;
    if (prev && STATES[prev].exit) STATES[prev].exit(this, next);
    this.state = next;
    STATES[next].enter(this, params, prev);
    this.events.emit('state', { state: next, prev });
  }

  navigate(state, params = {}) {
    if (!STATES[state]) return;
    if (['PLAYING', 'PAUSED', 'RESULTS', 'BOOT'].includes(this.state)) return;
    if (this.island.construction) return; // let the build animation finish
    if (state === 'CHALLENGE_SELECT' && !this.data.tutorial.firstChallenge) {
      // First launch: PLAY goes straight into the tutorial challenge.
      this.startChallenge('first_flight');
      return;
    }
    if (this.state === state && PANEL_STATES.includes(state)) {
      this.back();
      return;
    }
    this.setState(state, params);
  }

  /** Escape / close button / backdrop. */
  back() {
    if (this.ui.modalOpen) {
      this.ui.modalOpen.close();
      return;
    }
    if (this.celebrating) {
      this.celebrating.close();
      return;
    }
    switch (this.state) {
      case 'PAUSED':
        if (this.pauseSettings) this.closePauseSettings();
        else this.resume();
        break;
      case 'PLAYING':
        if (this.challenge.phase === 'intro') this.exitChallenge();
        else this.pause();
        break;
      case 'RESULTS':
        if (this.ui.overlay && this.ui.overlay.finished) this.returnToIsland();
        else if (this.ui.overlay && this.ui.overlay.skip) this.ui.overlay.skip();
        break;
      case 'DECORATING':
        if (this.ui.decorPicker) this.ui.closeDecorPicker();
        else this.endDecorating();
        break;
      default:
        if (PANEL_STATES.includes(this.state)) {
          this.audio.play('back');
          this.setState('MAIN_MENU');
        }
    }
  }

  onKey(e) {
    const code = e.code;
    if (this.celebrating) {
      this.celebrating.onKey(e);
      return;
    }
    if (this.ui.modalOpen) {
      if (code === 'Escape') this.back();
      return;
    }
    const ov = this.ui.overlay;
    if (ov && ov.onKey && this.state !== 'PAUSED') ov.onKey(e);
    if (code === 'Escape' || (code === 'KeyP' && (this.state === 'PLAYING' || this.state === 'PAUSED'))) {
      this.back();
      return;
    }
    if (this.state === 'PLAYING' && ['Space', 'ShiftLeft', 'ShiftRight', 'KeyJ', 'KeyK'].includes(code)) {
      this.challenge.useAbility();
      return;
    }
    if (this.state === 'MAIN_MENU' && (code === 'KeyE' || code === 'Enter')) {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
      this.island.interact();
    }
  }

  // ---------------------------------------------------------------- settings
  applySettings() {
    const s = this.data.settings;
    this.audio.setVolumes(s.music, s.sfx);
    this.view.setQuality(s.quality);
    this.particles.setQuality(s.quality);
    document.body.classList.toggle('reduced-motion', !!s.reducedMotion);
    this.island.cam.reducedMotion = !!s.reducedMotion;
    this.challenge.cam.reducedMotion = !!s.reducedMotion;
    this.onResize();
  }

  setSetting(key, value) {
    this.data.settings[key] = value;
    if (key === 'music' || key === 'sfx') this.audio.setVolumes(this.data.settings.music, this.data.settings.sfx);
    else this.applySettings();
    this.save.save();
  }

  resetProgress() {
    this.save.reset();
    this.paletteCache.clear();
    this.celebrations = [];
    this.island.entered = false;
    this.island.player.x = -140;
    this.island.player.y = 120;
    this.applySettings();
    this.missions.refresh();
    this.ui.closePanel(true);
    this.setState('MAIN_MENU');
    this.ui.refreshTopbar(true);
    this.ui.refreshAvatar();
    this.ui.toast({ kicker: 'Settings', title: 'Progress reset', text: 'A fresh start on Nexus Island.', icon: 'reset' });
  }

  // ---------------------------------------------------------------- nex helpers
  getPalette(id) {
    const nx = this.data.nex[id];
    const skinId = nx ? nx.skin : null;
    const key = `${id}|${skinId || ''}`;
    let p = this.paletteCache.get(key);
    if (!p) {
      const base = (NEX[id] || NEX.bolt).palette;
      const skin = skinId ? SKINS.find((s) => s.id === skinId) : null;
      p = skin ? { ...base, ...skin.palette } : base;
      this.paletteCache.set(key, p);
    }
    return p;
  }

  nexAbility(id) {
    return getAbilityParams(id, this.data.nex[id]?.level || 1);
  }

  nexAbilityText(id) {
    return getNexDescription(id, this.data.nex[id]?.level || 1);
  }

  equippedCosmetic(slot) {
    const id = this.data.cosmetics[slot];
    return id ? getShopItem(id) : null;
  }

  upgradeNex(id) {
    if (!this.progress.upgradeNex(id)) return false;
    const n = this.data.nex[id];
    this.audio.play('levelUp');
    this.audio.play('voice', { id, gap: 0 });
    this.ui.toast({ kicker: 'Nex upgraded', title: `${NEX[id].name} reached level ${n.level}!`, icon: 'nex', cls: 'cyan' });
    this.ui.refreshTopbar();
    return true;
  }

  setSkin(nexId, skinId) {
    const n = this.data.nex[nexId];
    if (!n) return;
    if (skinId && !this.data.cosmetics.owned.includes(skinId)) return;
    n.skin = skinId || null;
    this.paletteCache.clear();
    this.audio.play('purchase');
    this.ui.refreshAvatar();
    this.save.save();
  }

  nexUpgradeableCount() {
    return NEX_ORDER.filter((id) => this.progress.nexUpgradeStatus(id).ok).length;
  }

  // ---------------------------------------------------------------- challenges
  startChallenge(id) {
    const st = this.progress.challengeStatus(id);
    if (!st.unlocked) {
      this.audio.play('deny');
      return;
    }
    this.ui.clearCoach();
    this.island.hideSpeech();
    this.audio.play('whoosh');
    if (this.scene === this.island) this.island.cam.zoomPunch(0.25);
    this.saveNow();
    this.ui.transition(() => this.setState('PLAYING', { id }));
  }

  restartChallenge() {
    const id = this.challenge.def?.id;
    if (!id) return;
    this.ui.transition(() => this.setState('PLAYING', { id }), { dark: true });
  }

  exitChallenge() {
    this.ui.transition(() => this.setState('MAIN_MENU'), { dark: true });
  }

  returnToIsland() {
    this.ui.transition(() => this.setState('MAIN_MENU', { fromResults: true }));
  }

  pause() {
    if (this.state !== 'PLAYING') return;
    // Only a live run can be paused (the intro card is already a menu).
    if (this.challenge.phase !== 'play' && this.challenge.phase !== 'countdown') return;
    this.setState('PAUSED');
  }

  resume() {
    if (this.state !== 'PAUSED') return;
    this.setState('PLAYING', { resume: true });
  }

  openSettingsFromPause() {
    this.pauseSettings = true;
    if (this.ui.overlay && this.ui.overlay.el) this.ui.overlay.el.hidden = true;
    const s = this.ui.openPanel('SETTINGS', { fromPause: true });
    if (s) s.backdrop.onclick = null;
  }

  closePauseSettings() {
    this.pauseSettings = false;
    this.ui.closePanel();
    if (this.ui.overlay && this.ui.overlay.el) {
      this.ui.overlay.el.hidden = false;
      this.ui.overlay.mount();
    }
  }

  onChallengeEnded(run) {
    const reward = this.progress.applyChallengeResult(run);
    if (run.id === 'first_flight' && run.success) this.data.tutorial.firstChallenge = true;
    this.events.emit('challenge:finished', { ...run, stars: reward.stars });
    this.saveNow();
    this.setState('RESULTS', { run, reward });
  }

  // ---------------------------------------------------------------- celebrations
  queueCelebration(item) {
    this.celebrations.push(item);
    this.flushCelebrations();
  }

  flushCelebrations() {
    if (this.celebrating || !this.celebrations.length) return;
    if (['PLAYING', 'PAUSED', 'BOOT'].includes(this.state)) return;
    if (this.state === 'RESULTS' && this.ui.overlay && !this.ui.overlay.finished) return;
    const item = this.celebrations.shift();
    const c = new Celebration(this, item, () => {
      this.celebrating = null;
      this.ui.refreshTopbar();
      this.flushCelebrations();
      if (!this.celebrating) this.afterCelebrations();
    });
    const node = c.build();
    document.getElementById('modal-root').appendChild(node);
    c.el = node;
    c.mount();
    this.celebrating = c;
  }

  afterCelebrations() {
    if (this.state === 'MAIN_MENU') this.runTutorialFlow();
  }

  // ---------------------------------------------------------------- island & buildings
  buildableCount() {
    let n = 0;
    for (const id of [...BUILDABLE, 'hub']) {
      const st = this.progress.buildStatus(id);
      if (st.state === 'available' && st.afford) n++;
    }
    return n;
  }

  buildBuilding(id) {
    const st = this.progress.buildStatus(id);
    if (st.state !== 'available' || !st.afford) {
      this.audio.play('deny');
      this.ui.toast({ title: st.reason || 'Not available yet', icon: 'lock' });
      return false;
    }
    if (!this.progress.build(id)) return false;
    if (this.state !== 'MAIN_MENU') this.setState('MAIN_MENU', { quiet: true });
    this.ui.clearCoach();
    this.island.hideSpeech();
    this.island.playConstruction(id);
    this.ui.refreshTopbar();
    return true;
  }

  onConstructionDone(id) {
    const b = BUILDINGS[id];
    const lvl = this.data.buildings[id].level;
    this.island.react('excited', 1.4);
    this.audio.play('voice', { id: this.data.activeNex });
    this.ui.toast({ kicker: lvl > 1 ? 'Upgrade complete' : 'Construction complete', title: lvl > 1 ? `${b.name} is now level ${lvl}` : `${b.name} built!`, icon: b.icon, cls: 'cyan' });
    this.ui.updateBadges();
    if (id === 'generator' && !this.data.tutorial.firstBuild) {
      this.data.tutorial.firstBuild = true;
      this.saveNow();
    }
    this.runTutorialFlow();
  }

  onBuildingAction(id, action) {
    switch (action) {
      case 'play':
        this.navigate('CHALLENGE_SELECT');
        break;
      case 'shop':
        this.navigate('SHOP');
        break;
      case 'nex':
        this.navigate('NEX_COLLECTION');
        break;
      case 'islandPanel':
        this.navigate('ISLAND', { focus: id });
        break;
      case 'build':
        this.buildBuilding(id);
        break;
      case 'decorate':
        this.startDecorating();
        break;
      case 'collect': {
        const n = this.progress.collectGenerator();
        if (n > 0) {
          this.audio.play('collect');
          const s = BUILDINGS.generator.slot;
          this.particles.burst(s.x, s.y - 120, { count: 18, colors: ['#35e8ff', '#ffffff'], speed: 260, life: 0.7 });
          this.island.react('happy');
          this.ui.toast({ title: `+${n} energy collected`, icon: 'energy', cls: 'cyan', duration: 1600 });
          this.ui.refreshTopbar();
        }
        break;
      }
      default:
        break;
    }
  }

  startDecorating() {
    if (!(this.data.buildings.garden.level > 0)) {
      this.audio.play('deny');
      return;
    }
    this.setState('DECORATING');
  }

  endDecorating() {
    if (this.state === 'DECORATING') this.setState('MAIN_MENU');
  }

  placeDecor(slotId, itemId) {
    const d = this.data;
    const inv = d.decor.inventory;
    const cur = d.decor.slots[slotId];
    if (itemId && !(inv[itemId] > 0)) return;
    if (cur) inv[cur] = (inv[cur] || 0) + 1;
    if (itemId) {
      inv[itemId] -= 1;
      d.decor.slots[slotId] = itemId;
    } else {
      delete d.decor.slots[slotId];
    }
    const slot = DECOR_SLOTS.find((s) => s.id === slotId);
    if (slot) {
      this.particles.burst(slot.x, slot.y - 20, { count: 16, colors: ['#ff7ad9', '#35e8ff', '#ffffff'], speed: 200, type: 'star', size: 3, life: 0.6 });
      this.particles.ring(slot.x, slot.y, { color: '#ffffff', radius: 60, life: 0.4, width: 3 });
    }
    this.audio.play(itemId ? 'buildDone' : 'back');
    this.events.emit('decor:placed', { slotId, itemId });
    this.saveNow();
  }

  drawDecorPreview(canvas, id) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 64;
    const h = canvas.clientHeight || 64;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = Math.min(w, h) / 100;
    ctx.translate(w / 2, h * 0.86);
    ctx.scale(s, s);
    drawDecor(ctx, id, 1.2, 0.6, { nexId: this.data.activeNex });
  }

  // ---------------------------------------------------------------- shop
  buyItem(id) {
    const it = getShopItem(id);
    const d = this.data;
    if (!it) return false;
    let reason = '';
    if (it.cat === 'decor' && !(d.buildings.garden.level > 0)) reason = 'Build the Garden first';
    else if (it.cat === 'skins' && !d.nex[it.nex]?.unlocked) reason = `Unlock ${NEX[it.nex].name} first`;
    else if (!it.stackable && d.cosmetics.owned.includes(id)) reason = 'Already owned';
    else if (d.profile.coins < it.price) reason = `Need ${fmt(it.price - d.profile.coins)} more coins`;
    if (reason) {
      this.audio.play('deny');
      this.ui.toast({ title: reason, icon: 'lock', duration: 1800 });
      return false;
    }
    if (!this.progress.spend({ coins: it.price })) return false;
    if (it.cat === 'decor') d.decor.inventory[it.decor] = (d.decor.inventory[it.decor] || 0) + 1;
    else {
      d.cosmetics.owned.push(id);
      this.equipItem(id, true);
    }
    this.audio.play('purchase');
    this.ui.toast({ kicker: 'Purchased', title: it.name, icon: 'shop', cls: 'gold', reward: `−${fmt(it.price)} ${icon('coin')}`, duration: 1800 });
    this.ui.refreshTopbar();
    this.saveNow();
    return true;
  }

  equipItem(id, quiet = false) {
    const it = getShopItem(id);
    const d = this.data;
    if (!it || !d.cosmetics.owned.includes(id)) return;
    if (it.cat === 'skins') this.setSkin(it.nex, id);
    else if (it.cat === 'trails') d.cosmetics.trail = id;
    else if (it.cat === 'effects') d.cosmetics.effect = id;
    if (!quiet) this.audio.play('click');
    this.save.save();
  }

  unequipItem(id) {
    const it = getShopItem(id);
    const d = this.data;
    if (!it) return;
    if (it.cat === 'skins') this.setSkin(it.nex, null);
    else if (it.cat === 'trails' && d.cosmetics.trail === id) d.cosmetics.trail = null;
    else if (it.cat === 'effects' && d.cosmetics.effect === id) d.cosmetics.effect = null;
    this.audio.play('back');
    this.save.save();
  }

  // ---------------------------------------------------------------- missions
  claimMission(id) {
    const res = this.missions.claim(id);
    if (!res) return false;
    this.audio.play('reward');
    this.ui.toast({ kicker: 'Mission reward', title: `+${res.reward.coins} coins · +${res.reward.xp} XP`, icon: 'gift', cls: 'gold', duration: 1800 });
    this.ui.refreshTopbar();
    this.flushCelebrations();
    return true;
  }

  // ---------------------------------------------------------------- first-time experience
  runTutorialFlow() {
    if (this.state !== 'MAIN_MENU' || this.celebrating || this.island.construction) return;
    const tut = this.data.tutorial;
    const isl = this.island;
    const nexName = NEX[this.data.activeNex].name;
    if (!tut.firstChallenge) {
      isl.say(`Hi, I'm <b>${nexName}</b>! I run on <b>energy</b> ⚡<br/>Let's go collect some!`);
      this.ui.coach('.nav-play', 'Tap <b>PLAY</b> to start your first flight', { place: 'above' });
      return;
    }
    if (!tut.firstBuild) {
      if (this.data.buildings.generator.level > 0) {
        tut.firstBuild = true;
      } else {
        isl.say('Great flying! Let\'s use those coins to <b>build</b> something.');
        this.ui.coach('[data-nav="ISLAND"]', 'Open <b>ISLAND</b> to build your first building', { place: 'above' });
        return;
      }
    }
    if (!tut.islandsHint) {
      tut.islandsHint = true;
      this.saveNow();
      isl.say('The generator makes <b>energy</b> over time — tap it to collect!', 5);
      setTimeout(() => {
        if (this.state === 'MAIN_MENU' && !this.celebrating) {
          isl.say('See the islands in the distance? They\'re locked for now — your Nexus will reach them in future updates. Keep growing!', 7);
        }
      }, 5200);
    }
  }
}

// ------------------------------------------------------------------ states
function enterMenuPanel(name) {
  return {
    enter(g, params) {
      g.scene = g.island;
      g.island.setInteractive(false);
      g.ui.showTopbar(true);
      g.ui.showNav(true);
      g.ui.setNavActive(name);
      g.island.hideSpeech();
      g.ui.clearCoach();
      g.ui.openPanel(name, params);
      g.audio.play('click', { gap: 80 });
      if (name === 'ISLAND' && !g.data.tutorial.firstBuild && g.data.tutorial.firstChallenge) {
        setTimeout(() => g.ui.coach('[data-card="generator"] [data-action="build"]', 'Build the <b>Energy Generator</b>', { place: 'below' }), 350);
      }
    },
    exit(g) {
      g.ui.clearCoach();
      g.ui.closePanel();
      g.ui.setNavActive(null);
    },
  };
}

const STATES = {
  BOOT: {
    enter(g) {
      g.scene = g.island;
      g.island.enter();
      g.island.setInteractive(false);
      g.ui.openOverlay(new SplashScreen(g, () => g.setState('MAIN_MENU')));
    },
    exit(g) {
      g.ui.closeOverlay();
      g.audio.playMusic('island');
    },
  },
  MAIN_MENU: {
    enter(g, params, prev) {
      if (g.challenge.active) g.challenge.stop();
      g.ui.closeOverlay();
      g.ui.hud.hide();
      if (g.scene !== g.island || prev === 'RESULTS' || prev === 'PLAYING' || prev === 'PAUSED') {
        g.scene = g.island;
        g.island.enter();
        g.particles.clear();
      }
      g.island.setInteractive(true);
      g.ui.showTopbar(true);
      g.ui.showNav(true);
      g.ui.setNavActive(null);
      g.ui.holdToasts(false);
      g.audio.playMusic('island');
      if (prev === 'RESULTS') g.island.react('happy', 1.5);
      g.flushCelebrations();
      if (!params.quiet) setTimeout(() => g.runTutorialFlow(), prev === 'BOOT' ? 500 : 250);
    },
    exit(g, next) {
      g.island.setInteractive(false);
      g.island.hideSpeech();
      if (next !== 'DECORATING') g.ui.clearCoach();
      g.saveNow();
    },
  },
  CHALLENGE_SELECT: enterMenuPanel('CHALLENGE_SELECT'),
  NEX_COLLECTION: enterMenuPanel('NEX_COLLECTION'),
  SHOP: enterMenuPanel('SHOP'),
  MISSIONS: enterMenuPanel('MISSIONS'),
  SETTINGS: enterMenuPanel('SETTINGS'),
  ISLAND: enterMenuPanel('ISLAND'),
  DECORATING: {
    enter(g) {
      g.scene = g.island;
      g.ui.clearCoach();
      g.island.setInteractive(false);
      g.island.decorating = true;
      g.ui.showNav(false);
      g.ui.showDecorateBar();
    },
    exit(g) {
      g.island.decorating = false;
      g.ui.hideDecorateBar();
      g.ui.showNav(true);
    },
  },
  PLAYING: {
    enter(g, params) {
      if (params.resume) {
        g.ui.closeOverlay();
        g.challenge.paused = false;
        if (g.challenge.phase === 'play') g.input.setGameplay(true);
        g.audio.resume();
        return;
      }
      g.ui.closePanel(true);
      g.ui.closeOverlay();
      g.ui.clearCoach();
      g.ui.showTopbar(false);
      g.ui.showNav(false);
      g.ui.holdToasts(true);
      g.island.exit();
      if (g.challenge.active) g.challenge.stop();
      g.scene = g.challenge;
      g.challenge.start(params.id);
      g.audio.playMusic('challenge');
      const def = CHALLENGES[params.id];
      g.ui.openOverlay(
        new IntroScreen(g, def, {
          onStart: () => {
            g.ui.closeOverlay();
            g.challenge.beginCountdown();
          },
          onBack: () => g.exitChallenge(),
        }),
      );
    },
  },
  PAUSED: {
    enter(g) {
      g.challenge.paused = true;
      g.input.setGameplay(false);
      g.audio.play('pause');
      g.ui.openOverlay(new PauseScreen(g, g.challenge));
    },
    exit(g) {
      if (g.pauseSettings) {
        g.pauseSettings = false;
        g.ui.closePanel(true);
      }
    },
  },
  RESULTS: {
    enter(g, { run, reward }) {
      g.ui.hud.hide();
      g.input.setGameplay(false);
      g.ui.holdToasts(true);
      g.ui.openOverlay(new ResultsScreen(g, run, reward));
    },
    exit(g) {
      g.ui.closeOverlay();
    },
  },
};
