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
- QR carton redeem stub (server-side unique codes restock feed and energy)
- Duplicate eggs turn into coins
- Browser localStorage persistence + offline stat decay
- **EGGSCAPE** one-tap endless runner mini-game (see below)

## EGGSCAPE mini-game

A Phaser 3 demo of the EGGSCAPE endless runner, playable from the farm's
**🎮 Play EGGSCAPE** button. The egg auto-runs and one tap jumps — that is the whole
control scheme, on the canvas or with Space / ArrowUp.

Tapping again in mid-air gives a **double jump**: one extra boost per airborne stretch,
refunded on landing, at 75% of the ground jump's strength so it extends a jump rather than
doubling its height (measured: ~123px of lift becomes ~174px). The egg flips as it fires,
so the second jump is unmistakable.

The double jump is a safety net, never a requirement — spawning still guarantees
everything is clearable in a *single* jump (see below). It does have a cost: a full double
jump keeps the egg airborne ~1.08s against a spawn gap of ~0.85–1.0s, so spending it can
carry you into the next hazard or pad.

Three launch worlds, matching the deck's Phase 1 shortlist:

| World | Buddy | Signature power |
|---|---|---|
| Shine EGGnyway | Sunny Maxx | Sunshine Shield — saves one fall |
| Move First, Magic Follow | Eggxercise | First Move Dash — 3s untouchable burst |
| Come On Lah | Walao Egg | Lah! Luck — turns hazards into boost pads |

Each world has a `mode`. **Shine is hop**: designer sunflower PNGs
(`public/platforms/shine/sunflower-{short,mid,tall}.png`, 512-wide) display at ~176–192px
with height following the PNG aspect so the head and stem both read. All three share one
one-way pad collider `{ x: 8, y: 8, w: 496, h: 40 }` in source pixels, scaled to display
size; the stem is visual. The run starts already standing on a sunflower — no ground
strip at ready or at run start. Miss a pad and the run is over instantly. Sun Drops sit
on the seed disc, not in the air between pads. Sunshine Shield saves one fall. Double
jump is a safety net, never required.
Stadium and Kampung stay the ground runner (three hearts, jump the hazards).

Scoring is +1 per hazard cleared or pad landed, +2 for a tight "perfect", and coins pay out
×combo (combo caps at ×8, resets on a hit). The power meter fills on coin pickups; tap the
HUD power button or press `P` to spend it.

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

- `src/game/worlds.js` — the three world definitions (mode, palette, hazards or hop pads,
  power). Everything world-specific is data, so worlds 4–10 are new records, not new scene
  code. Each world is `locked: true` and needs the matching collectible egg (Shine starts
  unlocked because a fresh save already owns Sunny Maxx). Sprite slots list a `file` path;
  `null` means the palette-generated fallback until designer art lands.
- `src/game/sprites.js` — art-hook helpers and the designer-needs list for missing sprites.
- `src/game/RunScene.js` — the runner itself. `world.mode` selects hop vs run inside one
  scene. It loads a world sprite when `file` is set and otherwise generates that piece from
  the world palette.
- `src/game/createGame.js` — the Phaser factory, and the lazy-import boundary.
- `src/components/EggscapeOverlay.vue` — select / play / results screens; owns the Phaser
  lifecycle and world locks. `src/App.vue` owns all the economy math.

Phaser is dynamically imported, so it ships as its own ~345 KB gzip chunk that only
downloads when someone opens the mini-game — the farm's initial bundle is unchanged.

The egg PNGs are 2000×2000 collection badges with the character's name on a plate in the
lower third. `HERO_CROP` in `RunScene.js` crops that plate off the running sprite, and
`HERO_SINK` buries the resulting flat edge just under the ground line.

### Screen sizes

`RunScene` has no fixed resolution. `pickGameSize()` in `createGame.js` measures the box the
canvas has to live in and picks a logical size matching its shape, and the scene derives
every dimension — ground line, hill band, hero position, HUD — from that in `layout()`. A
800×450 canvas reproduces the numbers the game was originally tuned with, so desktop is
where it always was.

| Viewport | Logical | Canvas |
|---|---|---|
| Desktop 1100×900 | 800×450 | 848×477 |
| Phone portrait 390×844 | 560×747 | 374×499 |
| Phone landscape 844×390 | 560×315 | 498×280 |

A narrower canvas shows less track ahead, so horizontal motion — speeds, spawn spacing,
coin spacing — scales by `width / REFERENCE_WIDTH`, which keeps the player's reaction time
in *seconds* the same on every screen. Object sizes deliberately do not scale; that is what
makes the egg and hazards render larger on a phone.

Because jump reach shrinks with the view while object widths do not, spawns are gated on a
clearance check rather than tuned per device. Run worlds use `canClear()`: a hazard only
spawns if one jump at the current speed crosses it with 25% to spare. Hop pads use the same
single-jump reach (`flightTime` + `hopGap`) so a fair gap never needs the double jump. On a
phone the ground runner ramps gently (fence from the start, stump ~score 4, shell ~16,
doubled hazards ~50); on desktop everything is available immediately. Nothing unclearable
can ever spawn at any size.

Below 640 logical px the HUD switches to a compact single row with the power as a round
button in the bottom-right, within thumb reach.

**Known limitation:** the size is chosen when a run starts. Rotating the phone *between*
runs works — the overlay builds a fresh Phaser game each time — but rotating *mid-run*
leaves that run letterboxed until it ends, rather than killing the run to resize.

## Production QR design

The farm **Scan demo QR** button pretends a carton was scanned and posts to `POST /api/qr/redeem` through `src/qr.js`. There is no typed-code form and no camera.

On the Vite dev server, a Vite plugin (`server/vitePlugin.js`) serves that route from `server/qrRedeem.js`.

Valid carton codes live only as SHA-256 hashes in `server/cartons.json`.

Each hash is single-use; redemptions persist in `server/.redemptions.json` (gitignored).

Rewards restock feed and energy only — no coins, no IAP.

GitHub Pages will not run this Node stub. Static hosting has no `/api/qr/redeem`; scan will fail there until a real backend exists.

The demo button cycles three hashed local codes, then an unknown code so you can see invalid / already-redeemed (later taps wrap onto already-used):

1. `CARTON-SHINE-01` — +2 feed, +20 energy
2. `CARTON-MOVE-01` — +2 feed, +20 energy
3. `CARTON-LAH-01` — +3 feed, +25 energy
4. unknown (`CARTON-FAKE-01`) — invalid

Suggested production backend tables:

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
The farm walk cycle uses `public/chicken-walk.png`, wired through `asset()` for the GitHub Pages base path. Shine hop pads and the Sun Drop live in `public/platforms/shine/`. Remaining missing EGGSCAPE sprites are listed in `src/game/sprites.js` (`DESIGNER_NEEDS`).
