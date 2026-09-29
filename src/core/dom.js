// DOM helpers used by the UI layer.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html != null) e.innerHTML = html;
  return e;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Re-trigger a CSS animation class. */
export function pulseClass(node, cls) {
  if (!node) return;
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

/**
 * Delegated click handling: any element with data-action="name" calls
 * handlers[name](element, event). Returns an unbind function.
 */
export function bindActions(root, handlers) {
  const onClick = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target || !root.contains(target)) return;
    if (target.disabled || target.getAttribute('aria-disabled') === 'true') {
      handlers.__disabled && handlers.__disabled(target, e);
      return;
    }
    const fn = handlers[target.dataset.action];
    if (fn) fn(target, e);
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
