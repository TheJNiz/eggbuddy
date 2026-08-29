import Phaser from 'phaser'
import RunScene, { REFERENCE_WIDTH } from './RunScene.js'

// Below this container width the HUD's wide layout no longer fits and the player is
// almost certainly on a phone, so the scene switches to its compact, narrower world.
const NARROW_CONTAINER = 620
const NARROW_WIDTH = 560

// How far the logical canvas may stray from 16:9. The floor keeps a desktop window on
// today's 800x450; the ceiling stops a tall phone from getting a canvas that is mostly
// empty sky.
const MIN_ASPECT_RATIO = 0.56
const MAX_ASPECT_RATIO = 1.4

// Picks the logical resolution to render at, given the box the canvas has to live in.
// Matching the container's own aspect means Phaser's FIT has nothing to letterbox, so the
// game fills the space it is given instead of sitting in a thin strip.
export function pickGameSize(containerWidth, containerHeight) {
  const width = containerWidth < NARROW_CONTAINER ? NARROW_WIDTH : REFERENCE_WIDTH
  const aspect = containerWidth / containerHeight
  const height = Phaser.Math.Clamp(
    Math.round(width / aspect),
    Math.round(width * MIN_ASPECT_RATIO),
    Math.round(width * MAX_ASPECT_RATIO),
  )

  return { width, height }
}

// This module is the lazy-import entry point: nothing here is reachable from the
// Tamagotchi's initial bundle, so Vite splits Phaser into its own chunk that only
// downloads when the player actually opens EGGSCAPE.
export function createGame({ parent, world, best, onRunEnd, onPause }) {
  // The overlay awaits nextTick before calling us, so the stage has its final size here.
  const { width, height } = pickGameSize(
    parent.clientWidth || REFERENCE_WIDTH,
    parent.clientHeight || Math.round(REFERENCE_WIDTH * MIN_ASPECT_RATIO),
  )

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width,
    height,
    // Only ever seen behind the loading bar — the scene paints its own sky.
    backgroundColor: '#fff8e8',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false },
    },
    audio: { noAudio: true },
    scene: [RunScene],
  })

  game.scene.start('run', { world, best, onRunEnd, onPause })

  return {
    game,
    pause() {
      game.scene.getScene('run')?.scene.pause()
    },
    resume() {
      game.scene.getScene('run')?.scene.resume()
    },
    destroy() {
      game.destroy(true)
    },
  }
}
