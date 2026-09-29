# NEON NEXUS

A colourful, futuristic collect-and-build arcade game for the browser. Fly a small energy creature (a **Nex**) around floating-island challenges, collect energy, chain combos, dodge hazards, then spend what you earn to grow your home, **Nexus Island**.

This is the **Version 1 vertical slice**. It's plain HTML, CSS and JavaScript (ES modules) with a Canvas 2D renderer, and it has **no dependencies and no build step**.

## Running it

The game uses ES modules, so it has to be served over HTTP (opening `index.html` straight from disk won't work). Any static server will do. For example:

```bash
# from the repository root
python3 -m http.server 8080
# or
npx serve .
```

Then open http://localhost:8080.

**Deploying:** upload the repository as-is to any free static host (GitHub Pages, Netlify, Cloudflare Pages, Vercel). There's nothing to build.

## Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Move | WASD / arrow keys, or hold the left mouse button to steer | Drag anywhere (floating joystick) |
| Use ability | Space / Shift | Ability button (bottom right) |
| Pause / close panels | Esc or P | Pause button |
| Interact with a building | E / Enter | Tap the prompt |
| Move around the island | WASD / arrows or click the ground | Tap the ground |

## What's in Version 1

- **Nexus Island hub.** You can walk around it. It has a Nexus Hub that visibly evolves through 5 levels, a Challenge Portal and a Shop kiosk, plus 3 buildings you construct yourself (Energy Generator, Character Lab, Garden), each with a construction animation. There are 8 decoration spots, NPC bots, hover vehicles, a visual day/night cycle and floating distant islands.
- **Five Nex characters.** Each has its own silhouette, animation, trail, celebration, sound and ability:
  - **Bolt**, Overdrive: a speed boost. Unlocked from the start.
  - **Luma**, Magnet: pulls orbs toward her. Unlocked by collecting 20 fragments.
  - **Echo**, Double Combo: the combo timer drains slower. Unlocked at level 5.
  - **Flux**, Phase: hazards pass through. Unlocked at 15 stars.
  - **Nova**, Burst: disables nearby hazards. Unlocked by clearing the Supernova Trial.

  Each Nex has five stats, levels 1–5 (Nex XP plus coins, which needs the Lab) and a purchasable skin.
- **Seven handcrafted challenges.** A scripted tutorial (*First Flight*) plus six *Energy Rush* stages across difficulties 2–5.
- **Collectibles:** blue, gold, rainbow (+5 combo), giant, time and shield orbs, laid out in designed patterns that respawn.
- **Hazards:** moving lasers, rotating barriers, patrol drones, orbiting mines and pulsing energy storms. Each one shows a warning before it becomes active.
- **Combat rules:** three shields with brief invulnerability after a hit, and a combo multiplier from x1 to x5 driven by a combo timer.
- **Exit gate.** Once the objective is done, a gate opens: warp out early for a time bonus, or stay and keep scoring.
- **Scoring and stars:** the score breakdown covers energy, combo, time and perfect-run bonuses. Each challenge has 1–3 stars, and personal bests are tracked.
- **Results screen:** an animated breakdown and a reward capsule, plus XP-bar and level-up celebrations and a new-Nex unlock celebration.
- **Progression:** player levels (up to 30), coins, energy, Luma fragments and first-clear bonuses.
- **Daily missions and achievements.** Three daily missions are seeded by date, and there are 13 achievements with progress bars.
- **Cosmetic shop.** It sells Nex skins, trails, energy effects and decorations, all bought with coins. There are no real-money purchases.
- **Settings:** music and SFX volume, graphics quality (low/medium/high), reduced motion, a controls reference, and reset progress (with confirmation).
- **Audio:** every sound effect is synthesised with the Web Audio API, and there are two generated music tracks. No audio files are downloaded.
- **Saving:** progress auto-saves to `localStorage` after challenges, builds, upgrades, purchases and achievements, and when you leave the island or the tab.

### Deliberately not in Version 1

These are shown honestly in the game rather than faked:

- **Sky Garden, Volt City and Crystal Cove** appear in the distance with a lock and the note *"Arrives in a future update"*. You can't unlock or visit them yet.
- **Emotes** from the shop brief aren't included, so there's no shop tab for them.
- **Only one challenge type (Energy Rush)** ships, alongside the tutorial. The system is built to take more types.
- Online accounts, cloud saves, leaderboards, multiplayer and events aren't included. The code has clean extension points for them (see below).

## Project structure

```
index.html            App shell (canvas + UI layers)
styles/base.css       Design tokens, layout, buttons, panels, toasts
styles/screens.css    HUD, results, collection, shop, missions, settings…
src/main.js           Entry point
src/game.js           Orchestrator: state machine, main loop, high-level flows
src/core/             math, event bus, single RAF loop + tweens, DOM helpers
src/data/             All content as data: nex, challenges, buildings, shop,
                      missions, achievements
src/systems/          save, progression/economy, missions, achievements,
                      audio (SFX + music sequencer), input
src/render/           canvas view/camera, particles, sky, Nex renderer,
                      island art (terrain, buildings, decor)
src/game/             challenge scene, player, combo, hazards, abilities,
                      orb patterns, tutorial script
src/island/           island hub scene
src/ui/               UI manager, HUD, icons, screens/ (panels + overlays)
```

**Game states:** `BOOT → MAIN_MENU ⇄ CHALLENGE_SELECT | NEX_COLLECTION | ISLAND | MISSIONS | SHOP | SETTINGS | DECORATING → PLAYING ⇄ PAUSED → RESULTS`

Everything runs from one `requestAnimationFrame` loop (`src/core/loop.js`). Scenes and UI screens clean up their DOM and listeners when they close.

## Extending the game

- **New Nex:** add an entry to `src/data/nex.js` (stats, ability, unlock rule, palette), a body renderer in `src/render/nexRenderer.js`, and, if the ability is new, an entry in `src/game/abilities.js`.
- **New challenge:** add a layout to `src/data/challenges.js` using orb patterns (`line`, `arc`, `circle`, `zigzag`), timed specials and hazards. For a new challenge *type*, branch on `def.type` in `src/game/challengeScene.js`.
- **New hazard:** add a class with `update / collide / distanceTo / draw` to `src/game/hazards.js` and register it in `HAZARD_TYPES`.
- **New building:** add it to `BUILDINGS` in `src/data/buildings.js` and a draw case in `src/render/islandArt.js`.
- **Cloud saves:** `SaveSystem` takes a storage adapter with `load / save / clear`. Swap `LocalStorageAdapter` for a network-backed one.
- **Recorded music:** replace `MusicPlayer` in `src/systems/audio.js` with any object that has `play(trackId)` and `stop()`.
- **Balancing:** challenge objectives, star thresholds, rewards and the costs of buildings and upgrades all live in `src/data/`.
