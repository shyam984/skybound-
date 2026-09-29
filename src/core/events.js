// Tiny event bus. Systems (missions, achievements, audio, UI) listen to
// gameplay events instead of being called directly, which keeps them decoupled.

export class Emitter {
  constructor() {
    this.map = new Map();
  }

  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
    return () => this.off(evt, fn);
  }

  off(evt, fn) {
    const set = this.map.get(evt);
    if (set) set.delete(fn);
  }

  emit(evt, payload) {
    const set = this.map.get(evt);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[events] handler for "${evt}" failed`, err);
      }
    }
  }
}
