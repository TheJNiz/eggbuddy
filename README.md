# EGGbuddy Game V1

Vue 3 + Vite prototype for a physical egg brand / virtual chicken collectible game.

## Run

Requires Node.js 16 or newer.

```bash
npm install
npm run dev
```

## Current loop
- Raise a chicken with Hunger, Happiness, Energy and Health
- Feed, vitamin, play and nap actions
- Lay eggs when the chicken is healthy enough
- 10 collectible IP eggs from the supplied character sheet
- Rarity system: Common / Rare / Epic / Legendary
- QR reward demo (random reward)
- Duplicate eggs turn into coins
- Browser localStorage persistence + offline stat decay
- **EGGSCAPE** one-tap endless runner mini-game (see below)

## EGGSCAPE mini-game

A Phaser 3 demo of the EGGSCAPE endless runner, playable from the farm's
**🎮 Play EGGSCAPE** button. The egg auto-runs, one tap jumps — that is the whole
control scheme, on a canvas or with Space / ArrowUp.

Three launch worlds, matching the deck's Phase 1 shortlist:

| World | Buddy | Signature power |
|---|---|---|
| Shine EGGnyway | Sunny Maxx | Sunshine Shield — absorbs one mistake |
| Move First, Magic Follow | Eggxercise | First Move Dash — 3s untouchable burst |
| Come On Lah | Walao Egg | Lah! Luck — turns hazards into boost pads |

Scoring is +1 per hazard cleared, +2 for a tight "perfect" clear, and coins pay out
×combo (combo caps at ×8, resets on a hit). Three hearts per run. The power meter
fills on coin pickups; tap the HUD power button or press `P` to spend it.

### How it plugs into the pet

The runner is wired into the same economy as the farm, so it is a reason to keep the
chicken fed rather than a way around it:

- Needs 20 energy to start; each run costs **15 energy + 5 fullness**, charged when the
  run actually begins.
- Pays `score / 4` coins, capped at 80 per run, plus +8 happiness.
- A run scoring 60+ rolls an egg drop through the same rarity ladder as laying, with a
  small score-derived luck bonus. Duplicates pay the usual 20 coins.
- Per-world best scores and a run counter persist in the same localStorage save.

### Code layout

- `src/game/worlds.js` — the three world definitions (palette, hazards, power). Everything
  world-specific is data, so worlds 4–10 are new records, not new scene code. Each has a
  `locked` flag: it is `false` everywhere so a demo viewer can play all three, and flipping
  it to `true` restores the deck's "collect the egg to unlock the world" gating.
- `src/game/RunScene.js` — the runner itself. Backgrounds, hazards and coins are generated
  at runtime from the world palette, so the mini-game adds no new art files.
- `src/game/createGame.js` — the Phaser factory, and the lazy-import boundary.
- `src/components/EggscapeOverlay.vue` — select / play / results screens; owns the Phaser
  lifecycle. `src/App.vue` owns all the economy math.

Phaser is dynamically imported, so it ships as its own ~345 KB gzip chunk that only
downloads when someone opens the mini-game — the farm's initial bundle is unchanged.

The egg PNGs are 2000×2000 collection badges with the character's name on a plate in the
lower third. `HERO_CROP` in `RunScene.js` crops that plate off the running sprite, and
`HERO_SINK` buries the resulting flat edge just under the ground line.

## Production QR design
Replace `scan()` in `src/App.vue` with an API call such as POST `/api/qr/redeem`.
The server should store unique hashed carton codes and reject repeated redemption. Never keep valid QR codes only in frontend JavaScript.

Suggested backend tables:
- users
- chickens
- egg_characters
- user_egg_collection
- inventory_items
- user_inventory
- qr_codes
- qr_redemptions
- egg_lay_events

## Artwork
The egg collection uses the transparent PNG artwork in `public/eggs`. Matching `-character.png` files are retained for future character views.
The animated farm scene uses the four-frame transparent `public/chicken-walk.png` sprite sheet.
