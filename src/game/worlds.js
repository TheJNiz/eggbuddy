import { eggs } from '../eggs.js'

// The deck's Phase 1 shortlist: Shine EGGnyway • Move First • Come On Lah.
// Everything world-specific is data so RunScene stays generic — adding worlds 4-10
// later is a matter of appending records, not touching the scene.
//
// `locked: false` on every world because this is a demo people click through. To ship
// the deck's collection gating, set `locked: true` and the select screen will require
// the matching egg in the player's collection.
export const worlds = [
  {
    id: 'shine',
    eggId: 0,
    title: 'Shine EGGnyway',
    subtitle: 'Sunflower Bounce',
    blurb: 'A bright opening run that teaches rhythm and timing.',
    locked: false,
    power: { key: 'shield', name: 'Sunshine Shield', blurb: 'Absorbs 1 mistake' },
    collectible: 'Sun Drop',
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
    title: 'Move First, Magic Follow',
    subtitle: 'Stadium Sprint',
    blurb: 'Fast reactions build a streak while trophies reward perfect timing.',
    locked: false,
    power: { key: 'dash', name: 'First Move Dash', blurb: '3s untouchable burst' },
    collectible: 'Medal',
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
    title: 'Come On Lah',
    subtitle: 'Kampung Waddle',
    blurb: 'Dodge bananas, laundry and village surprises.',
    locked: false,
    power: { key: 'luck', name: 'Lah! Luck', blurb: 'Turns hazards into boosts' },
    collectible: 'Ketupat',
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

export function worldEgg(world) {
  return eggs[world.eggId]
}
