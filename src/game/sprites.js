// Art hooks for EGGSCAPE.
//
// Collection badges in public/eggs are already the runner hero (cropped) and
// the farm collection. The farm chicken uses public/chicken-walk.png.
//
// Hazard / pickup PNGs have not been delivered. Each world lists the slots a
// designer should fill. `file: null` means RunScene generates a palette
// fallback. Point `file` at a public/ path (e.g. 'hazards/shine/sunflower.png')
// once the PNG exists — preload will load it and spawn will use it.

export const DEFAULT_HAZARDS = [
  { id: 'fence', fallback: 'fence', width: 34, height: 68, file: null },
  { id: 'stump', fallback: 'stump', width: 48, height: 56, file: null },
  { id: 'shell', fallback: 'shell', width: 62, height: 40, file: null },
]

// Designer needs — isolated sprites, not the full-bleed -character.png scenes.
export const DESIGNER_NEEDS = [
  { path: 'hazards/shine/sunflower.png', use: 'Shine EGGnyway — sunflower stalk hazard' },
  { path: 'hazards/shine/stump.png', use: 'Shine EGGnyway — ground stump hazard' },
  { path: 'hazards/shine/shell.png', use: 'Shine EGGnyway — cracked-shell hazard' },
  { path: 'hazards/sprint/hurdle.png', use: 'Stadium Sprint — track hurdle' },
  { path: 'hazards/sprint/cone.png', use: 'Stadium Sprint — training cone' },
  { path: 'hazards/sprint/trophy.png', use: 'Stadium Sprint — trophy block hazard' },
  { path: 'hazards/kampung/laundry.png', use: 'Kampung Waddle — laundry pole' },
  { path: 'hazards/kampung/banana.png', use: 'Kampung Waddle — banana peel' },
  { path: 'hazards/kampung/bucket.png', use: 'Kampung Waddle — pail / village clutter' },
  { path: 'pickups/boost.png', use: 'Luck power boost pad' },
  { path: 'pickups/golden-egg.png', use: 'Run collectible (replaces generated coin)' },
]

export function artKey(worldId, id) {
  return `${worldId}-art-${id}`
}

export function worldHazards(world) {
  return world.hazards?.length ? world.hazards : DEFAULT_HAZARDS
}

export function worldPickup(world, slot) {
  return world.sprites?.[slot] || null
}
