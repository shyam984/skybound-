// Cosmetic shop. Coins only — no real-money purchases.

import { bindActions, esc } from '../../core/dom.js';
import { fmt, TAU } from '../../core/math.js';
import { SHOP_CATEGORIES, SHOP_ITEMS } from '../../data/shop.js';
import { NEX } from '../../data/nex.js';
import { icon } from '../icons.js';
import { panelShell, tabsHtml } from './common.js';
import { drawNexPortrait, drawNex } from '../../render/nexRenderer.js';
import { glow, starPath, heartPath } from '../../render/draw.js';

export class ShopScreen {
  constructor(game, params) {
    this.game = game;
    this.tab = params.tab || 'skins';
  }

  build() {
    const g = this.game;
    const node = panelShell('Shop', 'shop', {
      tabs: tabsHtml(SHOP_CATEGORIES, this.tab),
      headExtra: `<span class="pill shop-coins">${icon('coin')}<span class="num">${fmt(g.data.profile.coins)}</span></span>`,
    });
    node.classList.add('shop-panel');
    this.node = node;
    this.body = node.querySelector('.panel-body');
    this.render();
    this.unbind = bindActions(node, {
      __disabled: () => g.audio.play('deny'),
      close: () => g.back(),
      tab: (b) => {
        this.tab = b.dataset.tab;
        g.audio.play('tab');
        node.querySelectorAll('.tab').forEach((t) => {
          const on = t.dataset.tab === this.tab;
          t.classList.toggle('active', on);
          t.setAttribute('aria-selected', String(on));
        });
        this.render();
      },
      buy: (b) => {
        if (g.buyItem(b.dataset.id)) this.render(b.dataset.id);
      },
      equip: (b) => {
        g.equipItem(b.dataset.id);
        this.render();
      },
      unequip: (b) => {
        g.unequipItem(b.dataset.id);
        this.render();
      },
    });
    return node;
  }

  render(justBought) {
    const g = this.game;
    const d = g.data;
    this.node.querySelector('.shop-coins .num').textContent = fmt(d.profile.coins);
    const items = SHOP_ITEMS.filter((i) => i.cat === this.tab);
    const note =
      this.tab === 'decor'
        ? d.buildings.garden.level > 0
          ? 'Decorations are placed on your island from the Garden. Each placed decoration adds +1% energy from challenges.'
          : 'Build the Garden on your island to place decorations.'
        : this.tab === 'skins'
          ? 'Skins change your Nex colours. Equip them here or on the Nex screen.'
          : this.tab === 'trails'
            ? 'Trails follow your Nex while moving fast in challenges.'
            : 'Energy FX change the burst when you collect orbs.';
    this.body.innerHTML = `<p class="shop-note muted">${esc(note)}</p><div class="shop-grid">${items.map((it) => this.cardHtml(it, it.id === justBought)).join('')}</div>`;
    for (const c of this.body.querySelectorAll('canvas[data-item]')) this.drawPreview(c, SHOP_ITEMS.find((i) => i.id === c.dataset.item));
  }

  cardHtml(it, fresh) {
    const g = this.game;
    const d = g.data;
    const owned = d.cosmetics.owned.includes(it.id);
    const afford = d.profile.coins >= it.price;
    let action = '';
    let status = '';
    if (it.cat === 'decor') {
      const n = d.decor.inventory[it.decor] || 0;
      const placed = Object.values(d.decor.slots).filter((v) => v === it.decor).length;
      status = n || placed ? `Owned ×${n + placed}` : '';
      if (!(d.buildings.garden.level > 0)) action = `<button class="btn btn-sm btn-block" aria-disabled="true" data-action="buy" data-id="${it.id}">${icon('lock')} Needs Garden</button>`;
      else action = `<button class="btn btn-sm btn-block ${afford ? 'btn-primary' : ''}" ${afford ? '' : 'aria-disabled="true"'} data-action="buy" data-id="${it.id}">${icon('coin')}${fmt(it.price)}</button>`;
    } else if (it.cat === 'skins') {
      const nx = d.nex[it.nex];
      if (owned) {
        const on = nx.skin === it.id;
        action = on
          ? `<button class="btn btn-sm btn-block btn-ghost" data-action="unequip" data-id="${it.id}">${icon('check')} Equipped</button>`
          : `<button class="btn btn-sm btn-block btn-green" data-action="equip" data-id="${it.id}">Equip</button>`;
        status = 'Owned';
      } else if (!nx.unlocked) {
        action = `<button class="btn btn-sm btn-block" aria-disabled="true" data-action="buy" data-id="${it.id}">${icon('lock')} Unlock ${esc(NEX[it.nex].name)}</button>`;
      } else {
        action = `<button class="btn btn-sm btn-block ${afford ? 'btn-primary' : ''}" ${afford ? '' : 'aria-disabled="true"'} data-action="buy" data-id="${it.id}">${icon('coin')}${fmt(it.price)}</button>`;
      }
    } else {
      const slot = it.cat === 'trails' ? 'trail' : 'effect';
      if (owned) {
        const on = d.cosmetics[slot] === it.id;
        action = on
          ? `<button class="btn btn-sm btn-block btn-ghost" data-action="unequip" data-id="${it.id}">${icon('check')} Equipped</button>`
          : `<button class="btn btn-sm btn-block btn-green" data-action="equip" data-id="${it.id}">Equip</button>`;
        status = 'Owned';
      } else {
        action = `<button class="btn btn-sm btn-block ${afford ? 'btn-primary' : ''}" ${afford ? '' : 'aria-disabled="true"'} data-action="buy" data-id="${it.id}">${icon('coin')}${fmt(it.price)}</button>`;
      }
    }
    const sub = it.cat === 'skins' ? `For ${esc(NEX[it.nex].name)}` : '';
    return `<div class="shop-card card ${fresh ? 'fresh' : ''}">
      <canvas data-item="${it.id}" aria-hidden="true"></canvas>
      <div class="sc-name">${esc(it.name)}</div>
      <div class="sc-sub muted">${sub}${status ? `${sub ? ' · ' : ''}<span class="owned">${status}</span>` : ''}</div>
      ${action}
    </div>`;
  }

  drawPreview(c, it) {
    const g = this.game;
    if (!it) return;
    if (it.cat === 'skins') {
      drawNexPortrait(c, it.nex, { palette: { ...NEX[it.nex].palette, ...it.palette }, zoom: 1.05, expr: 'happy' });
      return;
    }
    if (it.cat === 'decor') {
      g.drawDecorPreview(c, it.decor);
      return;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth || 120;
    const h = c.clientHeight || 90;
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (it.cat === 'trails') {
      for (let i = 0; i < 26; i++) {
        const k = i / 25;
        const x = 14 + k * (w - 40);
        const y = h / 2 + Math.sin(k * TAU) * h * 0.2;
        const col = it.colors[i % it.colors.length];
        const r = 2 + k * 5;
        if (it.shape === 'star') {
          ctx.fillStyle = col;
          starPath(ctx, x, y, 4, r * 1.4, r * 0.5, i);
          ctx.fill();
        } else if (it.shape === 'ring') {
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.stroke();
        } else glow(ctx, x, y, r * 2.4, col, 0.9);
      }
      const id = g.data.activeNex;
      drawNex(ctx, id, { x: w - 28, y: h / 2 + 2, scale: 0.85, t: 1.2, palette: g.getPalette(id), expr: 'happy', look: { x: 0.6, y: 0 } });
      return;
    }
    // effects
    const cx = w / 2;
    const cy = h / 2;
    glow(ctx, cx, cy, 26, '#35e8ff', 0.8);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const r = 18 + (i % 3) * 9;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      ctx.fillStyle = it.colors[i % it.colors.length];
      if (it.shape === 'square') ctx.fillRect(x - 3, y - 2, 6, 4);
      else if (it.shape === 'heart') {
        heartPath(ctx, x, y, 6);
        ctx.fill();
      } else {
        starPath(ctx, x, y, 4, 6, 2, a);
        ctx.fill();
      }
    }
  }

  destroy() {
    if (this.unbind) this.unbind();
  }
}
