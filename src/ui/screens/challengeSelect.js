// Challenge select: pick a challenge (and quickly switch Nex) then start.

import { bindActions, esc } from '../../core/dom.js';
import { fmt, fmtTime } from '../../core/math.js';
import { CHALLENGES, CHALLENGE_ORDER, DIFFICULTY_LABELS } from '../../data/challenges.js';
import { NEX, NEX_ORDER } from '../../data/nex.js';
import { icon } from '../icons.js';
import { panelShell, starsHtml, difficultyHtml } from './common.js';
import { drawNexPortrait } from '../../render/nexRenderer.js';

export class ChallengeSelectScreen {
  constructor(game, params) {
    this.game = game;
    this.selected = params.id || game.progress.recommendedChallenge();
  }

  build() {
    const g = this.game;
    const total = g.progress.totalStars();
    const node = panelShell('Challenges', 'play', {
      headExtra: `<span class="chip star-chip">${icon('star')} ${total} / ${CHALLENGE_ORDER.length * 3}</span>`,
    });
    node.classList.add('challenge-panel');
    this.body = node.querySelector('.panel-body');
    this.render();
    this.unbind = bindActions(node, {
      close: () => g.back(),
      select: (b) => {
        this.selected = b.dataset.id;
        g.audio.play('tab');
        this.render();
      },
      start: () => g.startChallenge(this.selected),
      nex: (b) => {
        if (g.progress.setActiveNex(b.dataset.id)) {
          g.audio.play('voice', { id: b.dataset.id });
          this.render();
        }
      },
    });
    return node;
  }

  render() {
    const g = this.game;
    const d = g.data;
    const def = CHALLENGES[this.selected];
    const st = g.progress.challengeStatus(def.id);
    const rec = st.record;
    const unlockedNex = NEX_ORDER.filter((id) => d.nex[id]?.unlocked);
    const fr = def.rewards.fragments ? Object.entries(def.rewards.fragments).filter(([id]) => !d.nex[id]?.unlocked) : [];
    const objective = def.type === 'tutorial' ? def.objective.text : `Collect ${def.objective.energy} energy${def.time ? ` in ${fmtTime(def.time)}` : ''}`;
    this.body.innerHTML = `
      <div class="cs-layout">
        <div class="cs-detail card ${st.unlocked ? '' : 'locked'}">
          <div class="cs-top">
            <div>
              <div class="cs-kicker">${def.special ? `<span class="chip special">${icon('sparkle')} Special</span>` : ''}<span class="chip">${DIFFICULTY_LABELS[def.difficulty]}</span>${difficultyHtml(def.difficulty)}</div>
              <h3 class="cs-name">${esc(def.name)}</h3>
            </div>
            ${starsHtml(rec.stars || 0, 3, 'lg')}
          </div>
          <p class="cs-blurb">${esc(def.blurb)}</p>
          <div class="cs-objective">${icon('flag')}<div><div class="lbl">Objective</div><b>${esc(objective)}</b></div></div>
          <div class="cs-grid">
            <div class="cs-stars">
              <div class="lbl">Stars</div>
              <div class="row">${starsHtml(1, 1)}<span>Complete the objective</span></div>
              <div class="row">${starsHtml(2, 2)}<span>Score ${fmt(def.stars[0])}</span></div>
              <div class="row">${starsHtml(3, 3)}<span>Score ${fmt(def.stars[1])} · max 1 hit</span></div>
            </div>
            <div class="cs-best">
              <div class="lbl">Personal best</div>
              <div class="row"><span>Score</span><b class="num">${rec.bestScore ? fmt(rec.bestScore) : '—'}</b></div>
              <div class="row"><span>Best combo</span><b class="num">${rec.bestCombo ? rec.bestCombo : '—'}</b></div>
              <div class="row"><span>Fastest clear</span><b class="num">${rec.bestTime ? `${rec.bestTime.toFixed(1)}s` : '—'}</b></div>
            </div>
          </div>
          <div class="cs-rewards">
            <span class="lbl">Rewards</span>
            <span class="rw">${icon('coin')}${fmt(def.rewards.coins)}+</span>
            <span class="rw">${icon('xp')}${fmt(def.rewards.xp)}+ XP</span>
            ${fr.map(([id, n]) => `<span class="rw frag" style="--c:${NEX[id].color}">${icon('fragment')}${n}+ ${esc(NEX[id].name)} fragments</span>`).join('')}
            ${def.id === 'supernova_trial' && !d.nex.nova.unlocked ? `<span class="rw frag" style="--c:${NEX.nova.color}">${icon('nex')} Unlocks Nova</span>` : ''}
            ${!(rec.clears > 0) && def.type !== 'tutorial' ? `<span class="rw bonus">${icon('gift')} First-clear bonus</span>` : ''}
          </div>
          <div class="cs-nex">
            <span class="lbl">Your Nex</span>
            <div class="nex-chips">
              ${unlockedNex.map((id) => `<button class="nex-chip ${id === d.activeNex ? 'on' : ''}" data-action="nex" data-id="${id}" aria-pressed="${id === d.activeNex}" aria-label="Play as ${NEX[id].name}"><canvas data-nex="${id}"></canvas><span>${esc(NEX[id].name)}</span></button>`).join('')}
            </div>
            <div class="nex-ability muted">${icon('sparkle')} ${esc(NEX[d.activeNex].ability.name)} — ${esc(g.nexAbilityText(d.activeNex))}</div>
          </div>
          ${st.unlocked
            ? `<button class="btn btn-play btn-xl btn-block btn-shine" data-action="start" autofocus>${icon('play')} START CHALLENGE</button>`
            : `<button class="btn btn-xl btn-block" disabled>${icon('lock')} ${esc(st.reason)}</button>`}
        </div>
        <div class="cs-list" role="list">
          ${CHALLENGE_ORDER.map((id, i) => this.cardHtml(id, i)).join('')}
        </div>
      </div>`;
    for (const c of this.body.querySelectorAll('canvas[data-nex]')) {
      drawNexPortrait(c, c.dataset.nex, { palette: g.getPalette(c.dataset.nex), zoom: 1.1 });
    }
  }

  cardHtml(id, i) {
    const g = this.game;
    const def = CHALLENGES[id];
    const st = g.progress.challengeStatus(id);
    const rec = st.record;
    const isNew = st.unlocked && !(rec.clears > 0);
    return `<button role="listitem" class="cs-card ${id === this.selected ? 'sel' : ''} ${st.unlocked ? '' : 'locked'}" data-action="select" data-id="${id}" aria-pressed="${id === this.selected}">
      <span class="cs-num">${st.unlocked ? i + 1 : icon('lock')}</span>
      <span class="cs-card-main"><b>${esc(def.name)}</b><small>${st.unlocked ? DIFFICULTY_LABELS[def.difficulty] : esc(st.reason)}</small></span>
      ${isNew ? '<span class="chip new">NEW</span>' : starsHtml(rec.stars || 0)}
    </button>`;
  }

  destroy() {
    if (this.unbind) this.unbind();
  }
}
