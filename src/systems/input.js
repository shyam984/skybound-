// Input: keyboard state, a floating virtual joystick for touch, and pointer
// routing to the active scene. Scenes read a normalised movement vector via
// getMove() and never care which device produced it.

import { clamp } from '../core/math.js';

const MOVE_KEYS = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

export class Input {
  constructor(game, canvas, joystickEl) {
    this.game = game;
    this.canvas = canvas;
    this.keys = new Set();
    this.joyEl = joystickEl;
    this.knob = joystickEl.querySelector('.joy-knob');
    this.base = joystickEl.querySelector('.joy-base');
    this.joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
    this.steer = { active: false, id: null, x: 0, y: 0 };
    this.gameplay = false;
    this.lastDevice = 'keyboard';
    this.handler = null; // scene pointer handler

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());

    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: true });
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isTypingTarget(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
  }

  onKeyDown(e) {
    this.game.audio.unlock();
    if (this.isTypingTarget(e) && e.code !== 'Escape') return;
    if (MOVE_KEYS[e.code]) {
      // Don't let arrow keys scroll panels during gameplay.
      if (this.gameplay) e.preventDefault();
      this.keys.add(e.code);
      this.lastDevice = 'keyboard';
    }
    if (e.code === 'Space' && this.gameplay) e.preventDefault();
    if (!e.repeat) this.game.onKey(e);
  }

  /** Enable joystick/steering during challenges. */
  setGameplay(on) {
    this.gameplay = on;
    if (!on) this.reset();
  }

  reset() {
    this.keys.clear();
    this.joy.active = false;
    this.joy.dx = this.joy.dy = 0;
    this.steer.active = false;
    this.joyEl.classList.remove('on');
  }

  onPointerDown(e) {
    this.game.audio.unlock();
    this.lastDevice = e.pointerType === 'touch' || e.pointerType === 'pen' ? 'touch' : 'mouse';
    if (this.gameplay) {
      if (e.pointerType === 'mouse') {
        if (e.button !== 0) return;
        this.steer = { active: true, id: e.pointerId, x: e.clientX, y: e.clientY };
      } else if (!this.joy.active) {
        this.joy = { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
        this.joyEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        this.knob.style.transform = 'translate(0px, 0px)';
        this.joyEl.classList.add('on');
      }
      e.preventDefault();
      return;
    }
    if (this.handler && this.handler.pointerDown) this.handler.pointerDown(e.clientX, e.clientY, e);
  }

  onPointerMove(e) {
    if (this.joy.active && e.pointerId === this.joy.id) {
      let dx = e.clientX - this.joy.ox;
      let dy = e.clientY - this.joy.oy;
      const max = 52;
      const d = Math.hypot(dx, dy);
      if (d > max) {
        // Let the base follow the finger so the stick never "runs out".
        const pull = d - max;
        this.joy.ox += (dx / d) * pull;
        this.joy.oy += (dy / d) * pull;
        dx = e.clientX - this.joy.ox;
        dy = e.clientY - this.joy.oy;
        this.joyEl.style.transform = `translate(${this.joy.ox}px, ${this.joy.oy}px)`;
      }
      this.joy.dx = clamp(dx / max, -1, 1);
      this.joy.dy = clamp(dy / max, -1, 1);
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      return;
    }
    if (this.steer.active && e.pointerId === this.steer.id) {
      this.steer.x = e.clientX;
      this.steer.y = e.clientY;
      return;
    }
    if (this.handler && this.handler.pointerMove) this.handler.pointerMove(e.clientX, e.clientY, e);
  }

  onPointerUp(e) {
    if (this.joy.active && e.pointerId === this.joy.id) {
      this.joy.active = false;
      this.joy.dx = this.joy.dy = 0;
      this.joyEl.classList.remove('on');
      return;
    }
    if (this.steer.active && e.pointerId === this.steer.id) {
      this.steer.active = false;
      return;
    }
    if (this.handler && this.handler.pointerUp) this.handler.pointerUp(e.clientX, e.clientY, e);
  }

  /**
   * Normalised movement vector. `origin` (screen coords of the player) lets
   * mouse-steering compute a direction toward the cursor.
   */
  getMove(origin) {
    let x = 0;
    let y = 0;
    for (const k of this.keys) {
      const v = MOVE_KEYS[k];
      if (v) {
        x += v[0];
        y += v[1];
      }
    }
    if (x || y) {
      const d = Math.hypot(x, y);
      return { x: x / d, y: y / d, mag: 1 };
    }
    if (this.joy.active) {
      const mag = Math.min(1, Math.hypot(this.joy.dx, this.joy.dy));
      if (mag < 0.12) return { x: 0, y: 0, mag: 0 };
      return { x: this.joy.dx / (mag || 1), y: this.joy.dy / (mag || 1), mag };
    }
    if (this.steer.active && origin) {
      const dx = this.steer.x - origin.x;
      const dy = this.steer.y - origin.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) return { x: 0, y: 0, mag: 0 };
      return { x: dx / d, y: dy / d, mag: Math.min(1, d / 120) };
    }
    return { x: 0, y: 0, mag: 0 };
  }

  isTouch() {
    return this.lastDevice === 'touch' || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  }
}
