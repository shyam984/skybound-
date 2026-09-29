// Scripted first challenge. Teaches through play: each step spawns content,
// shows one short hint and waits for the player to do the thing.

export class TutorialScript {
  constructor(scene) {
    this.s = scene;
    this.i = -1;
    this.stepTime = 0;
    const touch = scene.game.input.isTouch();
    this.steps = [
      {
        hint: touch ? 'Drag anywhere to fly' : 'Fly with WASD or the arrow keys',
        enter: (s) => {
          this.start = { x: s.player.x, y: s.player.y };
          this.travel = 0;
        },
        done: (s) => {
          this.travel += Math.hypot(s.player.vx, s.player.vy) * s.lastDt;
          return this.travel > 260;
        },
      },
      {
        hint: 'Fly into <b>energy orbs</b> to collect them',
        enter: (s) => s.addOrbGroup({ p: 'line', x: 0, y: -60, n: 5, angle: 0, spacing: 80 }),
        done: (s) => s.stats.energy >= 5,
      },
      {
        hint: 'Grab orbs quickly in a row to build a <b>COMBO</b>!',
        enter: (s) => {
          s.addOrbGroup({ p: 'arc', x: 0, y: 40, r: 300, a0: 200, a1: 340, n: 8, respawn: 3 });
          s.addOrbGroup({ p: 'zigzag', x: 0, y: 220, n: 7, angle: 0, spacing: 80, amp: 30, respawn: 3 });
        },
        done: (s) => s.stats.energy >= 20,
      },
      {
        hint: 'Lasers crack your shields. <b>Dodge</b> it!',
        enter: (s) => {
          s.addHazard({ type: 'laser', x: 0, y: -40, len: 420, angle: 0, move: { dx: 0, dy: 150, period: 5 }, at: s.time });
          s.addOrbGroup({ p: 'circle', x: -380, y: -230, r: 70, n: 6, respawn: 4 });
          s.addOrbGroup({ p: 'circle', x: 380, y: 200, r: 70, n: 6, respawn: 4 });
        },
        done: (s) => s.stats.energy >= 30 || this.stepTime > 16,
      },
      {
        hint: touch ? 'Tap the <b>ability button</b> to use Overdrive!' : 'Press <b>SPACE</b> to use your ability!',
        enter: (s) => {
          s.player.abilityCd = 0;
          s.game.ui.hud.highlightAbility(true);
        },
        done: (s) => s.stats.abilityUses > 0,
        exit: (s) => s.game.ui.hud.highlightAbility(false),
      },
      {
        hint: '<b>Gold orbs</b> are worth 5 energy!',
        enter: (s) => s.spawnSpecial('gold', 420, -250, Infinity),
        done: (s) => s.stats.gold > 0,
      },
      {
        hint: 'Fly into the <b>gate</b> to finish!',
        enter: (s) => s.openGate(),
        done: () => false,
      },
    ];
    this.next();
  }

  next() {
    const prev = this.steps[this.i];
    if (prev && prev.exit) prev.exit(this.s);
    this.i += 1;
    this.stepTime = 0;
    const step = this.steps[this.i];
    if (!step) return;
    step.enter(this.s);
    this.s.hint(step.hint);
  }

  update(dt) {
    const step = this.steps[this.i];
    if (!step) return;
    this.stepTime += dt;
    if (step.done(this.s)) {
      this.s.game.audio.play('achievement');
      this.next();
    }
  }

  /** The tutorial can't be failed: shields never drop below one. */
  get protectShields() {
    return true;
  }
}
