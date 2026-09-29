// Cosmetic shop catalogue. All purchases use coins earned in play.

import { DECOR_ITEMS } from './buildings.js';

export const SHOP_CATEGORIES = [
  { id: 'skins', label: 'Nex Skins', icon: 'nex' },
  { id: 'trails', label: 'Trails', icon: 'sparkle' },
  { id: 'effects', label: 'Energy FX', icon: 'energy' },
  { id: 'decor', label: 'Decor', icon: 'decor' },
];

export const SKINS = [
  {
    id: 'skin_bolt_solar', cat: 'skins', nex: 'bolt', name: 'Solar Bolt', price: 350,
    palette: { body: '#ff9a2e', light: '#ffe58a', dark: '#c4480f', core: '#fff7c2', glow: '#ffc14a', cheek: '#fff0a0', trail: '#ffc14a' },
  },
  {
    id: 'skin_bolt_midnight', cat: 'skins', nex: 'bolt', name: 'Midnight Bolt', price: 450,
    palette: { body: '#27306e', light: '#6c7cff', dark: '#11163d', core: '#ff5fd0', glow: '#ff5fd0', cheek: '#ff9fe6', trail: '#ff5fd0' },
  },
  {
    id: 'skin_luma_aurora', cat: 'skins', nex: 'luma', name: 'Aurora Luma', price: 500,
    palette: { body: '#3fd8b8', light: '#c9fff1', dark: '#1a8f8a', core: '#ffffff', glow: '#7affd9', accent: '#ffe066', accent2: '#8fb8ff', trail: '#7affd9' },
  },
  {
    id: 'skin_echo_prism', cat: 'skins', nex: 'echo', name: 'Prism Echo', price: 500,
    palette: { body: '#e8eeff', light: '#ffffff', dark: '#8a96d8', core: '#35e8ff', glow: '#35e8ff', accent: '#9b5cff', ring: '#35e8ff', eye: '#2a2f6a', trail: '#8fe9ff' },
  },
  {
    id: 'skin_flux_ember', cat: 'skins', nex: 'flux', name: 'Ember Flux', price: 550,
    palette: { body: '#ff5a5a', light: '#ffc0a0', dark: '#a8203e', core: '#fff0c8', glow: '#ff8a5a', accent: '#ffd23d', eye: '#3a0612', trail: '#ff8a5a' },
  },
  {
    id: 'skin_nova_frost', cat: 'skins', nex: 'nova', name: 'Frost Nova', price: 600,
    palette: { body: '#6fb8ff', light: '#e2f6ff', dark: '#2d5ad6', core: '#ffffff', glow: '#9fe0ff', spike: '#bfeaff', accent: '#e2f6ff', eye: '#0a1a44', trail: '#9fe0ff' },
  },
];

export const TRAILS = [
  { id: 'trail_starfall', cat: 'trails', name: 'Starfall', price: 250, colors: ['#ffe46b', '#fff6cf'], shape: 'star' },
  { id: 'trail_bubble', cat: 'trails', name: 'Bubble Pop', price: 200, colors: ['#8fe9ff', '#ffffff'], shape: 'ring' },
  { id: 'trail_rainbow', cat: 'trails', name: 'Rainbow Ribbon', price: 400, colors: ['#ff5470', '#ff9838', '#ffd34a', '#48f5a0', '#35e8ff', '#9b5cff'], shape: 'dot' },
];

export const EFFECTS = [
  { id: 'fx_confetti', cat: 'effects', name: 'Confetti Pop', price: 200, colors: ['#ff4fb8', '#ffd34a', '#35e8ff', '#48f5a0'], shape: 'square' },
  { id: 'fx_prism', cat: 'effects', name: 'Prism Stars', price: 280, colors: ['#ffffff', '#b8f7ff', '#e0b8ff'], shape: 'star' },
  { id: 'fx_hearts', cat: 'effects', name: 'Heartbeat', price: 240, colors: ['#ff6f9f', '#ffb3cc'], shape: 'heart' },
];

export const DECOR_SHOP = Object.values(DECOR_ITEMS).map((d) => ({
  id: `decor_${d.id}`, cat: 'decor', decor: d.id, name: d.name, price: d.price, stackable: true,
}));

export const SHOP_ITEMS = [...SKINS, ...TRAILS, ...EFFECTS, ...DECOR_SHOP];

export function getShopItem(id) {
  return SHOP_ITEMS.find((i) => i.id === id) || null;
}
