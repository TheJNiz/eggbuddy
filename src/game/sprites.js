// Art hooks for EGGSCAPE.
//
// Collection badges in public/eggs are already the runner hero (cropped) and
// the farm collection. The farm chicken uses public/chicken-walk.png.
//
// Shine hop pads, runner, splash, golden egg, sky and foreground are on disk.
// Remaining Stadium / Kampung hazard PNGs and the luck boost pad are listed below.
// `file: null` means RunScene generates a palette fallback. Point `file` at a
// public/ path once the PNG exists — preload will load it and spawn will use it.

export const DEFAULT_HAZARDS = [
  { id: 'fence', fallback: 'fence', width: 34, height: 68, file: null },
  { id: 'stump', fallback: 'stump', width: 48, height: 56, file: null },
  { id: 'shell', fallback: 'shell', width: 62, height: 40, file: null },
]

// Designer needs — isolated sprites, not the full-bleed -character.png scenes.
export const DESIGNER_NEEDS = [
  { path: 'hazards/sprint/hurdle.png', use: 'Stadium Sprint — track hurdle' },
  { path: 'hazards/sprint/cone.png', use: 'Stadium Sprint — training cone' },
  { path: 'hazards/sprint/trophy.png', use: 'Stadium Sprint — trophy block hazard' },
  { path: 'hazards/kampung/laundry.png', use: 'Kampung Waddle — laundry pole' },
  { path: 'hazards/kampung/banana.png', use: 'Kampung Waddle — banana peel' },
  { path: 'hazards/kampung/bucket.png', use: 'Kampung Waddle — pail / village clutter' },
  { path: 'pickups/boost.png', use: 'Luck power boost pad' },
]

export function artKey(worldId, id) {
  return `${worldId}-art-${id}`
}

export function worldHazards(world) {
  if (world.mode === 'hop') return []
  return world.hazards?.length ? world.hazards : DEFAULT_HAZARDS
}

export function worldPickup(world, slot) {
  return world.sprites?.[slot] || null
}

export function worldPlatforms(world) {
  return world.platforms?.length ? world.platforms : []
}
