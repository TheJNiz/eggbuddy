// Art hooks for EGGSCAPE.
//
// Collection badges in public/eggs are already the runner hero (cropped) and
// the farm collection. The farm chicken uses public/chicken-walk.png.
//
// Shine hop pads, runner, hop pose strips, splash, golden egg, sky and foreground are on disk.
// Stadium / Kampung hazard PNGs and the luck boost pad stay listed below for when those
// worlds ship (`released: false` in worlds.js). `file: null` means RunScene generates a
// palette fallback. Point `file` at a public/ path once the PNG exists.

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

// Shine hop pose strips from worlds.sprites. Idle / missing-frame fallback is
// `hero` (shine-runner.png). A string is a 256px-cell strip; missing slots
// reuse idle — do not invent stand-in art.
export const HOP_POSE_CELL = 256
export const HOP_FEET_Y = 242

const HOP_POSE_DEFAULTS = {
  run: { frames: 6, fps: 10 },
  jump: { frames: 2, fps: 0 },
  drop: { frames: 2, fps: 8 },
  die: { frames: 2, fps: 8 },
}

export function hopPoseAssets(world) {
  const sprites = world.sprites || {}
  const spec = (pose, value) => {
    if (!value) return null
    const defaults = HOP_POSE_DEFAULTS[pose]
    if (typeof value === 'string') {
      return { file: value, frames: defaults.frames, fps: defaults.fps, cell: HOP_POSE_CELL }
    }
    return {
      file: value.file,
      frames: value.frames ?? defaults.frames,
      fps: value.fps ?? defaults.fps,
      cell: value.cell ?? HOP_POSE_CELL,
    }
  }
  return {
    idle: sprites.hero || null,
    run: spec('run', sprites.heroRun),
    jump: spec('jump', sprites.heroJump),
    drop: spec('drop', sprites.heroDrop),
    die: spec('die', sprites.heroDie),
  }
}
