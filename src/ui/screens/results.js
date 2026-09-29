// Results: title, stars, animated score breakdown, run stats, and a reward
// capsule that bursts open to show exactly what was earned.

import { el, esc, bindActions, pulseClass } from '../../core/dom.js';
import { fmt, fmtTime, ease } from '../../core/math.js';
import { icon } from '../icons.js';
import { NEX } from '../../data/nex.js';
import { CHALLENGES, nextChallengeId } from '../../data/challenges.js';
import { xpToNext } from '../../systems/progression.js';

export class ResultsScreen {
  constructor(game, run, reward) {
    this.game = game;
    this.run = run;
    this.reward = reward;
    this.cancels = [];
    this.finished = false;
  }

  build() {
    const g = this.game;
    const run = this.run;
    const rw = this.reward;
    const def = CHALLENGES[run.id];
    const b = run.breakdown;
    const next = nextChallengeId(run.id);
    const nextOk = run.success && next && g.progress.challengeStatus(next).unlocked;
    const rows = [
      ['Energy points', b.energy],
      ['Combo bonus', b.combo],
      ['Time bonus', b.time],
      ['Perfect bonus', b.perfect],
    ];
    const frag = Object.entries(rw.fragments || {});
    const node = el('div', 'results-wrap');
    node.innerHTML = `
      <div class="results-card ${run.success ? 'ok' : 'fail'}" role="dialog" aria-modal="true" aria-label="Results">
        <div class="rs-kicker">${esc(def.name)}</div>
        <h2 class="rs-title">${run.success ? 'CHALLENGE COMPLETE' : 'CHALLENGE FAILED'}</h2>
        <div class="rs-stars" role="img" aria-label="${rw.stars} of 3 stars">
          ${[0, 1, 2].map((i) => `<span class="rs-star ${i < rw.stars ? 'earn' : ''}" style="--d:${i}">${icon('star')}</span>`).join('')}
        </div>
        ${!run.success ? `<p class="rs-fail muted">${run.reason === 'shields' ? 'All shields lost' : 'Time ran out before the objective'} — you still keep your energy and earn some rewards.</p>` : ''}
        <div class="rs-score"><span class="lbl">Score</span><b class="num rs-total">0</b>${rw.newBest && run.score > 0 ? '<span class="chip new-best">NEW BEST</span>' : ''}</div>
        <div class="rs-breakdown">
          ${rows.map(([k, v], i) => `<div class="rs-row ${v ? '' : 'zero'}" style="--d:${i}"><span>${k}</span><b class="num" data-v="${v}">${v ? '0' : '—'}</b></div>`).join('')}
          <div class="rs-row total"><span>Total</span><b class="num">${fmt(b.total)}</b></div>
        </div>
        <div class="rs-stats">
          <div><span class="lbl">Energy</span><b class="num">${fmt(run.energy)}</b></div>
          <div><span class="lbl">Best combo</span><b class="num">${run.bestCombo} <small>x${run.bestMult}</small></b></div>
          <div><span class="lbl">${def.time ? 'Time left' : 'Time'}</span><b class="num">${def.time ? fmtTime(run.timeLeft) : `${run.elapsed.toFixed(0)}s`}</b></div>
          <div><span class="lbl">Damage</span><b class="num">${run.damage}${run.perfect ? ` ${icon('check')}` : ''}</b></div>
        </div>
        <div class="rs-rewards">
          <button class="capsule" aria-label="Open rewards"><span class="cap-top"></span><span class="cap-bottom"></span><span class="cap-glow"></span></button>
          <div class="rw-items">
            <div class="rw-item coin" style="--d:0">${icon('coin')}<b class="num" data-v="${rw.coins}">+0</b><span>Coins</span></div>
            <div class="rw-item xp" style="--d:1">${icon('xp')}<b class="num" data-v="${rw.xp}">+0</b><span>XP</span></div>
            <div class="rw-item energy" style="--d:2">${icon('energy')}<b class="num" data-v="${rw.energy}">+0</b><span>Energy</span></div>
            ${frag.map(([id, n], i) => `<div class="rw-item frag" style="--d:${3 + i};--c:${NEX[id].color}">${icon('fragment')}<b class="num" data-v="${n}">+0</b><span>${esc(NEX[id].name)} fragments</span></div>`).join('')}
            <div class="rw-item nexxp" style="--d:${3 + frag.length}">${icon('nex')}<b class="num" data-v="${rw.nexXP}">+0</b><span>${esc(NEX[run.nexId].name)} XP</span></div>
          </div>
          <div class="rs-xp">
            <div class="row"><span class="lvl">Level ${rw.before.level}</span><span class="muted num xp-txt"></span></div>
            <div class="bar xp"><i></i></div>
          </div>
        </div>
        <div class="rs-actions">
          <button class="btn btn-lg" data-action="again">${icon('reset')} ${run.success ? 'Play again' : 'Try again'}</button>
          ${nextOk ? `<button class="btn btn-lg btn-pink" data-action="next">Next ${icon('arrow')}</button>` : ''}
          <button class="btn btn-primary btn-lg" data-action="continue">${run.success ? 'Continue' : 'Return to island'}</button>
        </div>
      </div>`;
    this.unbind = bindActions(node, {
      again: () => g.restartChallenge(),
      next: () => g.startChallenge(next),
      continue: () => g.returnToIsland(),
    });
    node.querySelector('.capsule').addEventListener('click', () => this.openCapsule());
    node.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('button')) this.skip();
    });
    return node;
  }

  mount() {
    const g = this.game;
    const tw = g.tweens;
    const run = this.run;
    const rw = this.reward;
    const card = this.el.querySelector('.results-card');
    requestAnimationFrame(() => card.classList.add('in'));
    this.setXp(rw.before.level, rw.before.xp);
    // stars
    this.el.querySelectorAll('.rs-star.earn').forEach((s, i) => {
      this.cancels.push(tw.add({ delay: 0.35 + i * 0.3, duration: 0.01, done: () => {
        s.classList.add('pop');
        g.audio.play('star', { i, gap: 0 });
      } }));
    });
    const t0 = 0.4 + rw.stars * 0.3;
    // total count-up
    const total = this.el.querySelector('.rs-total');
    this.cancels.push(tw.add({ delay: t0, duration: 0.9, ease: ease.outCubic, update: (k) => {
      total.textContent = fmt(run.score * k);
      if (Math.random() < 0.25) g.audio.play('count', { gap: 40 });
    }, done: () => (total.textContent = fmt(run.score)) }));
    this.el.querySelectorAll('.rs-row b[data-v]').forEach((b, i) => {
      const v = Number(b.dataset.v);
      if (!v) return;
      this.cancels.push(tw.add({ delay: t0 + i * 0.15, duration: 0.6, ease: ease.outCubic, update: (k) => (b.textContent = fmt(v * k)), done: () => (b.textContent = fmt(v)) }));
    });
    this.cancels.push(tw.add({ delay: t0 + 1.1, duration: 0.01, done: () => this.openCapsule() }));
    g.audio.play(run.success ? 'reward' : 'click', { gap: 0 });
    requestAnimationFrame(() => this.el && this.el.querySelector('[data-action="continue"]').focus({ preventScroll: true }));
  }

  setXp(level, xp) {
    const need = xpToNext(level);
    this.el.querySelector('.rs-xp .lvl').textContent = `Level ${level}`;
    this.el.querySelector('.xp-txt').textContent = `${fmt(xp)} / ${fmt(need)} XP`;
    this.el.querySelector('.rs-xp .bar > i').style.width = `${Math.min(100, (xp / need) * 100)}%`;
  }

  openCapsule() {
    if (this.opened || !this.el) return;
    this.opened = true;
    const g = this.game;
    const tw = g.tweens;
    const rw = this.reward;
    const wrap = this.el.querySelector('.rs-rewards');
    wrap.classList.add('open');
    g.audio.play('reward', { gap: 0 });
    this.el.querySelectorAll('.rw-item b[data-v]').forEach((b, i) => {
      const v = Number(b.dataset.v);
      this.cancels.push(tw.add({ delay: 0.25 + i * 0.12, duration: 0.7, ease: ease.outCubic, update: (k) => (b.textContent = `+${fmt(v * k)}`), done: () => {
        b.textContent = `+${fmt(v)}`;
        if (i === 0) g.audio.play('coin');
      } }));
    });
    // XP bar: animate through each level gained
    const steps = [];
    let lvl = rw.before.level;
    let xp = rw.before.xp;
    let remaining = rw.xp;
    while (remaining > 0 && steps.length < 12) {
      const need = xpToNext(lvl);
      const add = Math.min(remaining, need - xp);
      steps.push({ lvl, from: xp, to: xp + add, need });
      remaining -= add;
      xp += add;
      if (xp >= need) {
        lvl++;
        xp = 0;
      }
    }
    let delay = 0.6;
    for (const s of steps) {
      this.cancels.push(tw.add({ delay, duration: 0.6, ease: ease.inOutCubic, update: (k) => this.setXp(s.lvl, s.from + (s.to - s.from) * k), done: () => {
        if (s.to >= s.need) {
          this.setXp(s.lvl + 1, 0);
          pulseClass(this.el.querySelector('.rs-xp'), 'lvl-up');
          g.audio.play('levelUp', { gap: 0 });
        }
      } }));
      delay += 0.65;
    }
    this.cancels.push(tw.add({ delay: delay + 0.1, duration: 0.01, done: () => this.finish() }));
  }

  /** Jump every animation to its end state. */
  skip() {
    if (this.finished) return;
    for (const c of this.cancels) c();
    this.cancels = [];
    const run = this.run;
    const rw = this.reward;
    this.el.querySelectorAll('.rs-star.earn').forEach((s) => s.classList.add('pop'));
    this.el.querySelector('.rs-total').textContent = fmt(run.score);
    this.el.querySelectorAll('.rs-row b[data-v]').forEach((b) => {
      const v = Number(b.dataset.v);
      if (v) b.textContent = fmt(v);
    });
    this.el.querySelector('.rs-rewards').classList.add('open');
    this.opened = true;
    this.el.querySelectorAll('.rw-item b[data-v]').forEach((b) => (b.textContent = `+${fmt(Number(b.dataset.v))}`));
    this.setXp(rw.after.level, rw.after.xp);
    this.finish();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.el.querySelector('.results-card').classList.add('done');
    this.game.ui.holdToasts(false);
    this.game.flushCelebrations();
  }

  onKey(e) {
    if (e.code === 'Space' && !this.finished) {
      e.preventDefault();
      this.skip();
    }
  }

  destroy() {
    for (const c of this.cancels) c();
    if (this.unbind) this.unbind();
  }
}
