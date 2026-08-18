import Phaser from 'phaser'
import RunScene, { GAME_HEIGHT, GAME_WIDTH } from './RunScene.js'

// This module is the lazy-import entry point: nothing here is reachable from the
// Tamagotchi's initial bundle, so Vite splits Phaser into its own chunk that only
// downloads when the player actually opens EGGSCAPE.
export function createGame({ parent, world, best, onRunEnd }) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
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

  game.scene.start('run', { world, best, onRunEnd })

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
