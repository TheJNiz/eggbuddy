import { eggs } from '../eggs.js'

// The deck's Phase 1 shortlist: Shine EGGnyway • Move First • Come On Lah.
// Everything world-specific is data so RunScene stays generic — adding worlds 4-10
// later is a matter of appending records, not touching the scene.
// `mode: 'run'` is the ground runner (Stadium, Kampung). `mode: 'hop'` is Shine:
// one-way sunflower heads, no floor after the opening ledge.
//
// `locked: true` restores the deck's collection gating: the select screen requires
// the matching egg in the player's collection. The farm starts with Sunny Maxx
// (egg 0), so Shine EGGnyway is playable on a fresh save.
export const worlds = [
  {
    id: 'shine',
    eggId: 0,
    // Hop: one-way sunflower pads, no ground after the opening ledge.
    // Stadium (`sprint`) and Kampung stay `run`.
    mode: 'hop',
    title: 'Shine EGGnyway',
    subtitle: 'Sunflower Bounce',
    blurb: 'Hop sunflower heads. Miss a pad and the run is over.',
    locked: true,
    power: { key: 'shield', name: 'Sunshine Shield', blurb: 'Saves 1 fall' },
    collectible: 'Sun Drop',
    // PNGs on disk. Display size keeps aspect. `head` is the landable seed-disc AABB,
    // normalized to the sprite top-left (stem is visual only).
    platforms: [
      {
        id: 'sunflower-short',
        band: 'short',
        width: 88,
        height: 50,
        file: 'platforms/shine/sunflower-short.png',
        head: { x: 0.18, y: 0.05, w: 0.64, h: 0.17 },
      },
      {
        id: 'sunflower-mid',
        band: 'mid',
        width: 92,
        height: 89,
        file: 'platforms/shine/sunflower-mid.png',
        head: { x: 0.18, y: 0.04, w: 0.64, h: 0.14 },
      },
      {
        id: 'sunflower-tall',
        band: 'tall',
        width: 96,
        height: 116,
        file: 'platforms/shine/sunflower-tall.png',
        head: { x: 0.14, y: 0.02, w: 0.72, h: 0.14 },
      },
    ],
    hazards: [],
    sprites: {
      boost: null, // TODO(designer): public/pickups/boost.png
      coin: 'platforms/shine/sundrop.png',
      sundrop: 'platforms/shine/sundrop.png',
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
