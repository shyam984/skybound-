// Nex abilities. Each entry receives the challenge scene, the player and the
// level-scaled params from data/nex.js. New Nex can register new abilities
// here without touching the scene.

import { TAU, rand } from '../core/math.js';

export const ABILITIES = {
  overdrive: {
    activate(scene, p, a) {
      p.speedMult = 1 + a.power;
      p.setExpr('excited', a.duration);
      scene.particles.ring(p.x, p.y, { color: p.palette.glow, radius: 90, life: 0.4, width: 5 });
      scene.particles.burst(p.x, p.y, { count: 14, colors: ['#ffffff', p.palette.glow], speed: 320, type: 'spark', life: 0.4, width: 2 });
    },
    end(scene, p) {
      p.speedMult = 1;
    },
  },

  magnet: {
    activate(scene, p, a) {
      p.magnetBoost = a.power;
      p.setExpr('happy', 0.8);
      scene.particles.ring(p.x, p.y, { color: p.palette.accent, radius: a.power, life: 0.6, width: 4 });
    },
    update(scene, p, dt) {
      // Soft purple field particles drifting inward.
      if (Math.random() < dt * 30) {
        const ang = rand(0, TAU);
        const r = p.magnetBoost * rand(0.6, 1);
        scene.particles.spawn({ x: p.x + Math.cos(ang) * r, y: p.y + Math.sin(ang) * r, target: p, homing: 900, life: 0.7, size: 2.5, color: p.palette.accent, type: 'dot', drag: 1 });
      }
    },
    end(scene, p) {
      p.magnetBoost = 0;
    },
  },

  double_combo: {
    activate(scene, p, a) {
      scene.combo.drainMult = a.power;
      scene.combo.refill();
      p.setExpr('focus', a.duration);
      scene.particles.ring(p.x, p.y, { color: p.palette.accent, radius: 70, life: 0.5, width: 4 });
      scene.particles.ring(p.x, p.y, { color: '#ffffff', radius: 110, life: 0.7, width: 2 });
    },
    end(scene) {
      scene.combo.drainMult = 1;
    },
  },

  phase: {
    activate(scene, p) {
      p.phased = true;
      p.setExpr('happy', 0.6);
      scene.particles.burst(p.x, p.y, { count: 18, colors: [p.palette.light, p.palette.accent], speed: 180, type: 'square', life: 0.6, size: 4 });
    },
    end(scene, p) {
      p.phased = false;
      scene.particles.burst(p.x, p.y, { count: 10, colors: [p.palette.light], speed: 120, type: 'square', life: 0.4, size: 3 });
    },
  },

  burst: {
    // Instant shockwave; the hazards stay disabled for `duration` seconds.
    activeTime: 0.6,
    activate(scene, p, a) {
      p.setExpr('excited', 0.8);
      const radius = a.power;
      let hits = 0;
      for (const h of scene.hazards) {
        if (!h.visible) continue;
        if (h.distanceTo(p.x, p.y) <= radius) {
          h.disabled = Math.max(h.disabled, a.duration);
          hits++;
          scene.particles.burst(h.x ?? h.def.x, h.y ?? h.def.y, { count: 10, colors: ['#ffd34a', '#ffffff'], speed: 260, type: 'spark', life: 0.5, width: 2 });
        }
      }
      scene.particles.ring(p.x, p.y, { color: '#ffd34a', radius, life: 0.55, width: 8 });
      scene.particles.ring(p.x, p.y, { color: '#ffffff', radius: radius * 0.7, life: 0.4, width: 4 });
      scene.particles.burst(p.x, p.y, { count: 26, colors: ['#ffb938', '#ffd34a', '#ffffff'], speed: 420, type: 'spark', life: 0.5, width: 3 });
      scene.flash('#ffd34a', 0.25);
      scene.cam.shake(6);
      if (hits) scene.game.audio.play('hazardOff');
    },
    end() {},
  },
};
