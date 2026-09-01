import { eggs } from '../eggs.js'

// Phase 1 shortlist lives here as data so RunScene stays generic — shipping a
// later world is flipping `released`, not touching the scene.
// `mode: 'run'` is the ground runner (Stadium, Kampung). `mode: 'hop'` is Shine:
// one-way sunflower heads, no ground strip; the run starts on a pad.
//
// Only `released: true` worlds appear in EGGSCAPE. Shine is the current drop;
// Stadium and Kampung stay in this file until those buddies ship.
//
// `locked: true` restores the deck's collection gating: the select screen requires
// the matching egg in the player's collection. The farm starts with Sunny Maxx
// (egg 0), so Shine EGGnyway is playable on a fresh save.
const ALL_WORLDS = [
  {
    id: 'shine',
    eggId: 0,
    // Hop: one-way sunflower pads, no ground strip. Start standing on a sunflower.
    // Stadium (`sprint`) and Kampung stay `run`.
    mode: 'hop',
    title: 'Shine EGGnyway',
    subtitle: 'Sunflower Bounce',
    blurb: 'Hop sunflower heads. Jump for a floating ❤️ to gain an extra heart.',
    released: true,
    locked: true,
    power: { key: 'shield', name: 'Sunshine Shield', blurb: '2s save' },
    collectible: 'Golden Egg',
    // Restyle pads are all 768-wide, but the flower fills a different share of each frame
    // (86% on mid, 80% on tall). `width` is the whole frame, so a shared display width
    // would hand the pads different landing areas. These widths are therefore back-solved
    // from each frame's own head fraction to put ~150 display px of standable disc on
    // every pad; height follows the PNG aspect.
    //
    // `band` is elevation, not flower size — the same flower on a shorter stem — so the
    // short band reuses the tall art. sunflower-short.png is a zoomed-in crop whose petal
    // ring was cropped away on its left, right and top edges, which reads as a broken
    // sprite once the pad is scaled up enough to give a fair landing surface.
    //
    // One-way collider is that pad's GREEN disc in source pixels (origin top-left of the
    // PNG), scaled with the sprite; petals / stem / leaves are not solid. `crown` is the
    // source row where the petal ring ends and the bare stem begins — the bands are lifted
    // to keep everything above it on screen, since a clipped petal ring reads as a broken
    // sprite while a clipped stem just reads as rooted past the bottom edge.
    platforms: [
      {
        id: 'sunflower-short',
        band: 'short',
        width: 187,
        height: 172,
        src: { w: 768, h: 708 },
        file: 'platforms/shine/sunflower-tall.png',
        head: { x: 84, y: 17, w: 615, h: 140 },
        crown: 227,
      },
      {
        id: 'sunflower-mid',
        band: 'mid',
        width: 175,
        height: 155,
        src: { w: 768, h: 682 },
        file: 'platforms/shine/sunflower-mid.png',
        head: { x: 95, y: 17, w: 657, h: 144 },
        crown: 242,
      },
      {
        id: 'sunflower-tall',
        band: 'tall',
        width: 187,
        height: 172,
        src: { w: 768, h: 708 },
        file: 'platforms/shine/sunflower-tall.png',
        head: { x: 84, y: 17, w: 615, h: 140 },
        crown: 227,
      },
    ],
    hazards: [],
    sprites: {
      boost: null, // TODO(designer): public/pickups/boost.png
      coin: 'pickups/golden-egg.png',
      sundrop: 'pickups/golden-egg.png',
      hero: 'heroes/shine-runner.png',
      // Designer hop strips: 256px cells, feet near y=242. RunScene bottom-aligns.
      heroRun: 'heroes/shine-run.png',   // 6 cells L→R, loop 10 fps on a pad
      heroJump: 'heroes/shine-jump.png', // rise, then apex near hang
      heroDrop: 'heroes/shine-drop.png', // 2 cells, loop 8 fps while falling
      heroDie: 'heroes/shine-die.png',   // splat then KO; play once, hold last
      splash: 'fx/bounce-splash.png',
      fg: 'bg/shine/fg.png',
      sky: 'bg/shine/sky.png',
    },
    palette: {
      skyTop: 0x8ed6ff,
      skyBottom: 0xffe9a8,
      hillFar: 0xbfe08a,
      hillNear: 0x8fc55d,
      ground: 0xe3b96b,
      groundEdge: 0x7cb342,
      hazard: 0xd9c9a8,
      hazardEdge: 0xa8926a,
      accent: 0xffc61a,
      banner: 0xff8a3d,
    },
  },
  {
    id: 'sprint',
    eggId: 4,
    mode: 'run',
    title: 'Move First, Magic Follow',
    subtitle: 'Stadium Sprint',
    blurb: 'Fast reactions build a streak while trophies reward perfect timing.',
    released: false,
    locked: true,
    power: { key: 'dash', name: 'First Move Dash', blurb: '3s untouchable burst' },
    collectible: 'Medal',
    // TODO(designer): public/hazards/sprint/{hurdle,cone,trophy}.png
    hazards: [
      { id: 'hurdle', fallback: 'fence', width: 34, height: 68, file: null },
      { id: 'cone', fallback: 'stump', width: 48, height: 56, file: null },
      { id: 'trophy', fallback: 'shell', width: 62, height: 40, file: null },
    ],
    sprites: {
      boost: null,
      coin: null,
    },
    palette: {
      skyTop: 0xff9d6b,
      skyBottom: 0xffd9c0,
      hillFar: 0xef7a5a,
      hillNear: 0xd94f3d,
      ground: 0xc94a3a,
      groundEdge: 0x7cb342,
      hazard: 0xb07a4a,
      hazardEdge: 0x7c5230,
      accent: 0xffcf3d,
      banner: 0xe23c2e,
    },
  },
  {
    id: 'kampung',
    eggId: 3,
    mode: 'run',
    title: 'Come On Lah',
    subtitle: 'Kampung Waddle',
    blurb: 'Dodge bananas, laundry and village surprises.',
    released: false,
    locked: true,
    power: { key: 'luck', name: 'Lah! Luck', blurb: 'Turns hazards into boosts' },
    collectible: 'Ketupat',
    // TODO(designer): public/hazards/kampung/{laundry,banana,bucket}.png
    hazards: [
      { id: 'laundry', fallback: 'fence', width: 34, height: 68, file: null },
      { id: 'banana', fallback: 'stump', width: 48, height: 56, file: null },
      { id: 'bucket', fallback: 'shell', width: 62, height: 40, file: null },
    ],
    sprites: {
      boost: null,
      coin: null,
    },
    palette: {
      skyTop: 0x2b2350,
      skyBottom: 0x6b4a7a,
      hillFar: 0x4a3a63,
      hillNear: 0x3a2c4f,
      ground: 0x6d5642,
      groundEdge: 0x3f5f2e,
      hazard: 0xf2c744,
      hazardEdge: 0xb9902a,
      accent: 0x9ad84f,
      banner: 0xd94f7a,
    },
  },
]

export const worlds = ALL_WORLDS.filter((world) => world.released)

export function worldById(id) {
  return worlds.find((world) => world.id === id) || worlds[0]
}

export function worldMode(world) {
  return world.mode || 'run'
}

export function worldEgg(world) {
  return eggs[world.eggId]
}

export function worldIsLocked(world, collection) {
  return !!world.locked && !collection.includes(world.eggId)
}
