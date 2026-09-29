// UI manager: top bar, bottom navigation, panels (one at a time), overlays,
// toasts, confirm dialogs, coach marks and screen transitions.
// Screens are small classes in ui/screens/ with build()/destroy()/update().

import { $, el, esc, pulseClass, bindActions } from '../core/dom.js';
import { fmt, fmtCompact, damp } from '../core/math.js';
import { icon } from './icons.js';
import { HUD } from './hud.js';
import { drawNexPortrait } from '../render/nexRenderer.js';
import { SCREENS } from './screens/index.js';
import { DECOR_ITEMS } from '../data/buildings.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.topbarEl = $('#topbar');
    this.navEl = $('#nav');
    this.panelRoot = $('#panel-root');
    this.overlayRoot = $('#overlay-root');
    this.modalRoot = $('#modal-root');
    this.toastRoot = $('#toast-root');
    this.coachRoot = $('#coach-root');
    this.fadeEl = $('#fade');
    this.hud = new HUD(game, $('#hud'));
    this.panel = null;
    this.overlay = null;
    this.toastQueue = [];
    this.toastsHeld = false;
    this.activeToasts = 0;
    this.shown = { coins: 0, energy: 0, xp: 0 };
    this.coachState = null;
    this.buildTopbar();
    this.buildNav();

    const ev = game.events;
    ev.on('currency', () => this.refreshTopbar());
    ev.on('achievement:unlocked', (a) =>
      this.toast({ kicker: 'Achievement unlocked', title: a.name, icon: 'trophy', cls: 'gold', reward: `+${a.reward} ${icon('coin')}`, sound: 'achievement' }),
    );
    ev.on('mission:complete', (m) => this.toast({ kicker: 'Mission complete', title: m.text, icon: 'mission', cls: 'cyan', text: 'Claim your reward in Missions', sound: 'achievement' }));
    ev.on('nex:active', () => this.refreshAvatar());
  }

  update(dt) {
    if (this.panel && this.panel.update) this.panel.update(dt);
    if (this.overlay && this.overlay.update) this.overlay.update(dt);
    this.animateTopbar(dt);
    if (this.coachState) this.positionCoach();
  }

  // ---------------------------------------------------------------- top bar
  buildTopbar() {
    this.topbarEl.innerHTML = `
      <button class="profile" data-action="profile" aria-label="Player profile and Nex collection">
        <div class="avatar"><canvas width="44" height="44"></canvas><span class="lvl-badge">1</span></div>
        <div class="profile-info">
          <div class="label"><span class="lvl-label">Level 1</span><span class="xp-num num"></span></div>
          <div class="bar xp" role="progressbar" aria-label="Experience"><i></i></div>
        </div>
      </button>
      <div class="spacer"></div>
      <div class="res">
        <div class="pill coin-pill" title="Coins" aria-label="Coins">${icon('coin')}<span class="num">0</span></div>
        <div class="pill energy-pill" title="Energy" aria-label="Energy">${icon('energy')}<span class="num">0</span></div>
      </div>
      <button class="btn btn-icon btn-ghost settings-btn" data-action="settings" aria-label="Settings">${icon('gear')}</button>`;
    this.tb = {
      avatar: this.topbarEl.querySelector('.avatar canvas'),
      lvl: this.topbarEl.querySelector('.lvl-badge'),
      lvlLabel: this.topbarEl.querySelector('.lvl-label'),
      xpNum: this.topbarEl.querySelector('.xp-num'),
      xpBar: this.topbarEl.querySelector('.bar.xp > i'),
      xpBarWrap: this.topbarEl.querySelector('.bar.xp'),
      coins: this.topbarEl.querySelector('.coin-pill span'),
      coinPill: this.topbarEl.querySelector('.coin-pill'),
      energy: this.topbarEl.querySelector('.energy-pill span'),
      energyPill: this.topbarEl.querySelector('.energy-pill'),
    };
    bindActions(this.topbarEl, {
      profile: () => this.game.navigate('NEX_COLLECTION'),
      settings: () => this.game.navigate('SETTINGS'),
    });
  }

  showTopbar(on) {
    this.topbarEl.hidden = !on;
    if (on) {
      this.refreshTopbar(true);
      this.refreshAvatar();
    }
  }

  refreshAvatar() {
    const id = this.game.data.activeNex;
    requestAnimationFrame(() => drawNexPortrait(this.tb.avatar, id, { palette: this.game.getPalette(id), zoom: 1.05 }));
  }

  refreshTopbar(instant = false) {
    const p = this.game.data.profile;
    const need = this.game.progress.xpToNext(p.level);
    this.tb.lvl.textContent = p.level;
    this.tb.lvlLabel.textContent = `Level ${p.level}`;
    this.tb.xpNum.textContent = `${fmt(p.xp)}/${fmt(need)}`;
    this.tb.xpBar.style.width = `${Math.min(100, (p.xp / need) * 100)}%`;
    this.tb.xpBarWrap.setAttribute('aria-valuenow', String(Math.round((p.xp / need) * 100)));
    if (instant) {
      this.shown.coins = p.coins;
      this.shown.energy = p.energy;
      this.tb.coins.textContent = fmtCompact(p.coins);
      this.tb.energy.textContent = fmtCompact(p.energy);
    }
    this.updateBadges();
  }

  animateTopbar(dt) {
    if (this.topbarEl.hidden) return;
    const p = this.game.data.profile;
    for (const key of ['coins', 'energy']) {
      const target = p[key];
      const cur = this.shown[key];
      if (cur === target) continue;
      let next = damp(cur, target, 7, dt);
      if (Math.abs(next - target) < 1) next = target;
      if (Math.round(next) > Math.round(cur) && target > cur) {
        const pill = key === 'coins' ? this.tb.coinPill : this.tb.energyPill;
        if (!pill.classList.contains('bump')) pulseClass(pill, 'bump');
        if (key === 'coins' && Math.random() < 0.3) this.game.audio.play('count', { gap: 50 });
      }
      this.shown[key] = next;
      (key === 'coins' ? this.tb.coins : this.tb.energy).textContent = fmtCompact(next);
    }
  }

  // ---------------------------------------------------------------- navigation
  buildNav() {
    const items = [
      { id: 'NEX_COLLECTION', label: 'NEX', icon: 'nex' },
      { id: 'ISLAND', label: 'ISLAND', icon: 'island' },
      { id: 'PLAY', label: 'PLAY', icon: 'play', play: true },
      { id: 'MISSIONS', label: 'MISSIONS', icon: 'missions' },
      { id: 'SHOP', label: 'SHOP', icon: 'shop' },
    ];
    const inner = el('div', 'nav-inner');
    for (const it of items) {
      const b = el('button', it.play ? 'nav-play btn-shine' : 'nav-btn', `${icon(it.icon)}<span>${it.label}</span>`);
      b.dataset.nav = it.id;
      b.setAttribute('aria-label', it.play ? 'Play a challenge' : it.label.toLowerCase());
      b.addEventListener('click', () => {
        this.game.audio.play('click');
        if (it.play) this.game.navigate('CHALLENGE_SELECT');
        else this.game.navigate(it.id);
      });
      inner.appendChild(b);
    }
    this.navEl.appendChild(inner);
  }

  showNav(on) {
    this.navEl.hidden = !on;
    if (on) this.updateBadges();
  }

  setNavActive(state) {
    for (const b of this.navEl.querySelectorAll('[data-nav]')) {
      const active = b.dataset.nav === state || (state === 'CHALLENGE_SELECT' && b.dataset.nav === 'PLAY');
      b.classList.toggle('active', active);
      if (active) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
  }

  updateBadges() {
    const g = this.game;
    const set = (id, n) => {
      const b = this.navEl.querySelector(`[data-nav="${id}"]`);
      if (!b) return;
      let dot = b.querySelector('.dot');
      if (n > 0) {
        if (!dot) {
          dot = el('span', 'dot');
          b.appendChild(dot);
        }
        dot.textContent = n > 9 ? '9+' : String(n);
      } else if (dot) dot.remove();
    };
    set('MISSIONS', g.missions.claimableCount());
    set('ISLAND', g.buildableCount());
    set('NEX_COLLECTION', g.nexUpgradeableCount());
  }

  // ---------------------------------------------------------------- panels
  openPanel(name, params = {}) {
    this.closePanel(true);
    const Screen = SCREENS[name];
    if (!Screen) return null;
    const screen = new Screen(this.game, params);
    const backdrop = el('div', 'panel-backdrop');
    backdrop.addEventListener('click', () => this.game.back());
    const node = screen.build();
    node.classList.add('panel');
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'true');
    this.panelRoot.append(backdrop, node);
    screen.el = node;
    screen.backdrop = backdrop;
    this.panel = screen;
    if (screen.mount) screen.mount();
    // Move focus into the panel for keyboard users.
    requestAnimationFrame(() => {
      const f = node.querySelector('[autofocus]') || node.querySelector('.panel-head .btn') || node.querySelector('button');
      if (f && this.game.input.lastDevice === 'keyboard') f.focus({ preventScroll: true });
    });
    return screen;
  }

  closePanel(instant = false) {
    const s = this.panel;
    if (!s) return;
    this.panel = null;
    if (s.destroy) s.destroy();
    const { el: node, backdrop } = s;
    if (instant || this.game.reducedMotion) {
      node.remove();
      backdrop.remove();
      return;
    }
    node.classList.add('closing');
    backdrop.classList.add('closing');
    setTimeout(() => {
      node.remove();
      backdrop.remove();
    }, 200);
  }

  // ---------------------------------------------------------------- overlays (results, pause, intro…)
  openOverlay(screen) {
    this.closeOverlay();
    const node = screen.build();
    this.overlayRoot.appendChild(node);
    screen.el = node;
    this.overlay = screen;
    if (screen.mount) screen.mount();
    return screen;
  }

  closeOverlay() {
    const s = this.overlay;
    if (!s) return;
    this.overlay = null;
    if (s.destroy) s.destroy();
    if (s.el) s.el.remove();
  }

  // ---------------------------------------------------------------- toasts
  toast(o) {
    this.toastQueue.push(o);
    this.flushToasts();
  }

  holdToasts(on) {
    this.toastsHeld = on;
    if (!on) this.flushToasts();
  }

  flushToasts() {
    if (this.toastsHeld) return;
    while (this.toastQueue.length && this.activeToasts < 2) {
      const o = this.toastQueue.shift();
      this.activeToasts++;
      const t = el(
        'div',
        `toast ${o.cls || ''}`,
        `<div class="t-icon">${icon(o.icon || 'sparkle')}</div>
         <div class="t-body">${o.kicker ? `<div class="t-kicker">${esc(o.kicker)}</div>` : ''}<div class="t-title">${esc(o.title || '')}</div>${o.text ? `<div class="muted" style="font-size:13px">${esc(o.text)}</div>` : ''}</div>
         ${o.reward ? `<div class="t-reward">${o.reward}</div>` : ''}`,
      );
      t.setAttribute('role', 'status');
      this.toastRoot.appendChild(t);
      if (o.sound) this.game.audio.play(o.sound);
      const remove = () => {
        if (!t.isConnected) return;
        t.classList.add('out');
        setTimeout(() => {
          t.remove();
          this.activeToasts--;
          this.flushToasts();
        }, 220);
      };
      t.addEventListener('click', remove);
      setTimeout(remove, o.duration || 2800);
    }
  }

  // ---------------------------------------------------------------- confirm dialog
  confirm({ title, text, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
    return new Promise((resolve) => {
      const wrap = el('div', 'modal-wrap');
      wrap.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mdl-t">
        <h3 id="mdl-t">${esc(title)}</h3><p>${esc(text)}</p>
        <div class="row"><button class="btn btn-ghost" data-r="0">${esc(cancelLabel)}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-r="1">${esc(confirmLabel)}</button></div></div>`;
      const done = (v) => {
        wrap.remove();
        this.modalOpen = null;
        this.game.audio.play(v ? 'click' : 'back');
        resolve(v);
      };
      wrap.addEventListener('click', (e) => {
        const b = e.target.closest('[data-r]');
        if (b) done(b.dataset.r === '1');
        else if (e.target === wrap) done(false);
      });
      this.modalRoot.appendChild(wrap);
      this.modalOpen = { close: () => done(false) };
      requestAnimationFrame(() => wrap.querySelector('[data-r="0"]').focus({ preventScroll: true }));
    });
  }

  // ---------------------------------------------------------------- transitions
  transition(fn, { dark = false, hold = 60 } = {}) {
    return new Promise((resolve) => {
      const f = this.fadeEl;
      f.classList.toggle('dark', dark);
      f.classList.add('on');
      setTimeout(async () => {
        try {
          await fn();
        } catch (err) {
          console.error(err);
        }
        setTimeout(() => {
          f.classList.remove('on');
          resolve();
        }, hold);
      }, 270);
    });
  }

  // ---------------------------------------------------------------- coach marks
  coach(target, html, opts = {}) {
    this.clearCoach();
    const ring = el('div', 'coach-ring');
    const bubble = el('div', 'coach-bubble', html + (opts.button ? `<div><button class="btn btn-primary btn-sm">${esc(opts.button)}</button></div>` : ''));
    this.coachRoot.append(ring, bubble);
    if (opts.button) bubble.querySelector('button').addEventListener('click', () => {
      this.clearCoach();
      opts.onButton && opts.onButton();
    });
    this.coachState = { target, ring, bubble, place: opts.place || 'above' };
    this.positionCoach();
  }

  positionCoach() {
    const c = this.coachState;
    const t = typeof c.target === 'string' ? document.querySelector(c.target) : c.target;
    if (!t || !t.isConnected || t.offsetParent === null) {
      c.ring.style.display = 'none';
      c.bubble.style.display = 'none';
      return;
    }
    const r = t.getBoundingClientRect();
    c.ring.style.display = '';
    c.bubble.style.display = '';
    const pad = 6;
    Object.assign(c.ring.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const bw = c.bubble.offsetWidth;
    const bh = c.bubble.offsetHeight;
    let x = r.left + r.width / 2 - bw / 2;
    x = Math.max(12, Math.min(window.innerWidth - bw - 12, x));
    const y = c.place === 'below' ? r.bottom + 16 : r.top - bh - 16;
    c.bubble.style.left = `${x}px`;
    c.bubble.style.top = `${Math.max(12, y)}px`;
  }

  clearCoach() {
    if (!this.coachState) return;
    this.coachState.ring.remove();
    this.coachState.bubble.remove();
    this.coachState = null;
  }

  // ---------------------------------------------------------------- decorating
  showDecorateBar() {
    this.hideDecorateBar();
    const bar = el('div', 'decorate-bar');
    bar.innerHTML = `<div class="db-text">${icon('decor')} Tap a glowing spot to decorate</div><button class="btn btn-primary" data-action="done">Done</button>`;
    bar.querySelector('button').addEventListener('click', () => this.game.endDecorating());
    this.overlayRoot.appendChild(bar);
    this.decorBar = bar;
  }

  hideDecorateBar() {
    if (this.decorBar) this.decorBar.remove();
    this.decorBar = null;
    this.closeDecorPicker();
  }

  openDecorPicker(slotId) {
    this.closeDecorPicker();
    const g = this.game;
    const d = g.data;
    const current = d.decor.slots[slotId];
    const inv = d.decor.inventory;
    const owned = Object.keys(DECOR_ITEMS).filter((k) => (inv[k] || 0) > 0);
    const sheet = el('div', 'decor-picker');
    sheet.innerHTML = `
      <div class="dp-head"><b>${current ? `Placed: ${esc(DECOR_ITEMS[current].name)}` : 'Empty spot'}</b><button class="btn btn-icon btn-ghost btn-sm" data-action="close" aria-label="Close">${icon('close')}</button></div>
      <div class="dp-list">
        ${owned.length ? owned.map((k) => `<button class="dp-item" data-action="place" data-item="${k}"><canvas width="64" height="64" data-decor="${k}"></canvas><span>${esc(DECOR_ITEMS[k].name)}</span><small>×${inv[k]}</small></button>`).join('') : `<div class="dp-empty">You don't own any decorations yet.<br/>Buy them in the Shop.</div>`}
      </div>
      <div class="dp-actions">
        ${current ? `<button class="btn btn-ghost" data-action="remove">Remove</button>` : ''}
        <button class="btn btn-pink" data-action="shop">${icon('shop')} Shop decor</button>
      </div>`;
    this.overlayRoot.appendChild(sheet);
    this.decorPicker = sheet;
    for (const c of sheet.querySelectorAll('canvas[data-decor]')) g.drawDecorPreview(c, c.dataset.decor);
    bindActions(sheet, {
      close: () => this.closeDecorPicker(),
      place: (b) => {
        g.placeDecor(slotId, b.dataset.item);
        this.closeDecorPicker();
      },
      remove: () => {
        g.placeDecor(slotId, null);
        this.closeDecorPicker();
      },
      shop: () => {
        this.closeDecorPicker();
        g.endDecorating();
        g.navigate('SHOP', { tab: 'decor' });
      },
    });
  }

  closeDecorPicker() {
    if (this.decorPicker) this.decorPicker.remove();
    this.decorPicker = null;
  }
}
