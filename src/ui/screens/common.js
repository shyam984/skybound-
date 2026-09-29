// Shared bits for screen markup.

import { el, esc } from '../../core/dom.js';
import { fmt } from '../../core/math.js';
import { icon } from '../icons.js';

/** Standard panel with a header (title + close) and a scrolling body. */
export function panelShell(title, iconName, { tabs = '', headExtra = '' } = {}) {
  const node = el('section');
  node.innerHTML = `
    <div class="panel-head">
      <h2>${icon(iconName)}${esc(title)}</h2>
      <div class="spacer"></div>
      ${headExtra}
      <button class="btn btn-icon btn-ghost" data-action="close" aria-label="Close">${icon('close')}</button>
    </div>
    ${tabs}
    <div class="panel-body"></div>`;
  node.setAttribute('aria-label', title);
  return node;
}

export function costHtml(cost = {}, profile = null) {
  const parts = [];
  if (cost.coins) {
    const short = profile && profile.coins < cost.coins;
    parts.push(`<span class="cost ${short ? 'short' : ''}">${icon('coin')}${fmt(cost.coins)}</span>`);
  }
  if (cost.energy) {
    const short = profile && profile.energy < cost.energy;
    parts.push(`<span class="cost ${short ? 'short' : ''}">${icon('energy')}${fmt(cost.energy)}</span>`);
  }
  return parts.join('') || '<span class="cost">Free</span>';
}

export function starsHtml(n, total = 3, cls = '') {
  let s = '';
  for (let i = 0; i < total; i++) s += `<span class="star-ico ${i < n ? 'on' : ''} ${cls}">${icon('star')}</span>`;
  return `<span class="stars" role="img" aria-label="${n} of ${total} stars">${s}</span>`;
}

export function difficultyHtml(level) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<i class="${i <= level ? 'on' : ''}"></i>`;
  return `<span class="diff" aria-label="Difficulty ${level} of 5">${s}</span>`;
}

export function tabsHtml(tabs, active) {
  return `<div class="tabs" role="tablist">${tabs
    .map((t) => `<button class="tab ${t.id === active ? 'active' : ''}" role="tab" aria-selected="${t.id === active}" data-action="tab" data-tab="${t.id}">${t.icon ? icon(t.icon) : ''}${esc(t.label)}</button>`)
    .join('')}</div>`;
}
