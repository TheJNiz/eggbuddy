import Phaser from 'phaser'
import { asset } from '../assets.js'
import { worldEgg } from './worlds.js'

export const GAME_WIDTH = 800
export const GAME_HEIGHT = 450

// Ground surface the egg's feet rest on.
const GROUND_Y = 372
const GRAVITY = 2000
const JUMP_VELOCITY = -720

// Air time is 2 * 720 / 2000 = 0.72s, so horizontal reach at the 420px/s top speed
// is ~300px. Every spacing below is derived from that so no gap is ever unclearable.
const AIR_TIME = (2 * Math.abs(JUMP_VELOCITY)) / GRAVITY
const BASE_SPEED = 260
const MAX_SPEED_BONUS = 160

// A tap this long before landing still fires the jump, and a tap this long after
// walking off an edge still counts as grounded. Both are what separate a tap-runner
// that feels fair from one that feels broken.
const JUMP_BUFFER_MS = 120
const COYOTE_MS = 80

const HERO_HEIGHT = 104

// The egg PNGs are 2000x2000 *collection badges*: the character sits in the top ~60%
// and the bottom is a coloured plate with the character's name baked in. Running with
// the whole image would drag that name plate along the ground, so the sprite uses a
// cropped frame. Fractions (not pixels) because they hold for all ten badges.
// Measured off the artwork rather than guessed: opaque content runs y 0.10-0.90 and
// x 0.15-0.91, and the egg's own base sits at y 0.663 — below the plate's top edge, so
// the two overlap. Cropping at the egg's base therefore keeps the whole egg and takes a
// thin crescent of plate with it, which HERO_SINK then buries below the ground line.
const HERO_CROP = { x: 0.13, y: 0.09, width: 0.8, height: 0.573 }
// Hitbox over the egg body only, bottom-aligned — deliberately smaller than the art so
// clipping a ray, an arm or a hair curler is never a hit.
const HERO_BODY = { width: 0.42, height: 0.62 }
// Rests the body this many pixels above the sprite's bottom, sinking the plate crescent
// (and the egg's very base) under the ground surface so the egg reads as standing on it.
const HERO_SINK = 11
const INVULNERABLE_MS = 1200
const MAX_COMBO = 8
const START_LIVES = 3

const POWER_PER_COIN = 6
const POWER_PER_PERFECT = 2
const DASH_MS = 3000
const LUCK_MS = 5000

const FONT = '"Nunito", system-ui, -apple-system, "Segoe UI", sans-serif'

export default class RunScene extends Phaser.Scene {
  constructor() {
    super('run')
  }

  init(data) {
    this.world = data.world
    this.best = data.best || 0
    this.onRunEnd = data.onRunEnd || (() => {})

    this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

    this.phase = 'ready'
    this.score = 0
    this.coinsCollected = 0
    this.perfects = 0
    this.combo = 1
    this.maxCombo = 1
    this.lives = START_LIVES
    this.power = 0
    this.speed = BASE_SPEED
    this.distanceToSpawn = 420
    this.invulnerableUntil = 0
    this.lastGroundedAt = 0
    this.jumpQueuedAt = -Infinity
    this.shieldActive = false
    this.dashUntil = 0
    this.luckUntil = 0
    this.startedAt = 0
  }

  preload() {
    const egg = worldEgg(this.world)
    this.heroKey = `hero-${this.world.id}`
    if (!this.textures.exists(this.heroKey)) {
      this.load.image(this.heroKey, asset(`eggs/${egg.image}`))
    }
    this.drawLoadingBar()
  }

  drawLoadingBar() {
    const bar = this.add.graphics()
    const label = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 34, 'Warming up the egg…', {
      fontFamily: FONT, fontSize: '20px', fontStyle: '700', color: '#7a6a4a',
    }).setOrigin(0.5)

    this.load.on('progress', (value) => {
      bar.clear()
      bar.fillStyle(0xe8dcc0, 1).fillRoundedRect(GAME_WIDTH / 2 - 120, GAME_HEIGHT / 2, 240, 14, 7)
      bar.fillStyle(0xffc61a, 1).fillRoundedRect(GAME_WIDTH / 2 - 120, GAME_HEIGHT / 2, 240 * value, 14, 7)
    })

    this.load.once('complete', () => {
      bar.destroy()
      label.destroy()
    })
  }

  create() {
    this.buildTextures()
    this.buildBackground()
    this.buildGround()
    this.buildHero()
    this.buildGroups()
    this.buildHud()
    this.buildReadyBanner()
    this.bindInput()
  }

  // ---------------------------------------------------------------- textures

  makeTexture(key, width, height, draw) {
    const namespaced = `${this.world.id}-${key}`
    if (this.textures.exists(namespaced)) return namespaced

    const g = this.make.graphics({ x: 0, y: 0 }, false)
    draw(g)
    g.generateTexture(namespaced, width, height)
    g.destroy()
    return namespaced
  }

  makeSkyTexture() {
    const key = `${this.world.id}-sky`
    if (this.textures.exists(key)) return key

    const hex = (value) => `#${value.toString(16).padStart(6, '0')}`
    const canvas = this.textures.createCanvas(key, 8, GAME_HEIGHT)
    const ctx = canvas.getContext()
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT)
    gradient.addColorStop(0, hex(this.world.palette.skyTop))
    gradient.addColorStop(1, hex(this.world.palette.skyBottom))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 8, GAME_HEIGHT)
    canvas.refresh()

    return key
  }

  buildTextures() {
    const p = this.world.palette

    // Sine-silhouette hills. The 200px period divides the 400px texture width, so the
    // TileSprite repeats seamlessly.
    const hill = (key, color, amplitude, base) =>
      this.makeTexture(key, 400, 160, (g) => {
        const points = [{ x: 0, y: 160 }]
        for (let x = 0; x <= 400; x += 8) {
          points.push({ x, y: base - amplitude * Math.sin((x / 200) * Math.PI * 2) })
        }
        points.push({ x: 400, y: 160 })
        g.fillStyle(color, 1).fillPoints(points, true)
      })

    // Deliberately low silhouettes: tall hills sit right behind the runner and swallow
    // it. `base` is the sine midline in texture space, so a bigger base means a
    // shorter hill.
    this.texHillFar = hill('hill-far', p.hillFar, 20, 96)
    this.texHillNear = hill('hill-near', p.hillNear, 26, 124)

    this.texGround = this.makeTexture('ground', 96, 90, (g) => {
      g.fillStyle(p.ground, 1).fillRect(0, 0, 96, 90)
      g.fillStyle(p.groundEdge, 1).fillRect(0, 0, 96, 12)
      g.fillStyle(p.ground, 0.55).fillRect(0, 12, 96, 4)
      g.fillStyle(0x000000, 0.07).fillEllipse(24, 44, 30, 9).fillEllipse(70, 66, 24, 7)
    })

    this.texCloud = this.makeTexture('cloud', 150, 60, (g) => {
      g.fillStyle(0xffffff, 0.85)
      g.fillEllipse(48, 38, 70, 34).fillEllipse(88, 32, 62, 40).fillEllipse(116, 42, 48, 26)
    })

    this.texStump = this.makeTexture('stump', 48, 56, (g) => {
      g.fillStyle(p.hazardEdge, 1).fillRoundedRect(0, 6, 48, 50, 8)
      g.fillStyle(p.hazard, 1).fillRoundedRect(3, 0, 42, 48, 8)
      g.fillStyle(p.hazardEdge, 0.45).fillEllipse(24, 10, 30, 10)
    })

    this.texShell = this.makeTexture('shell', 62, 40, (g) => {
      g.fillStyle(p.hazardEdge, 1).fillEllipse(31, 30, 62, 32)
      g.fillStyle(0xfdf3e0, 1)
      g.fillPoints([
        { x: 2, y: 30 }, { x: 10, y: 12 }, { x: 20, y: 24 }, { x: 31, y: 4 },
        { x: 42, y: 22 }, { x: 52, y: 10 }, { x: 60, y: 30 }, { x: 31, y: 40 },
      ], true)
    })

    this.texFence = this.makeTexture('fence', 34, 68, (g) => {
      g.fillStyle(p.hazardEdge, 1).fillRoundedRect(11, 0, 12, 68, 5)
      g.fillStyle(p.hazard, 1).fillRoundedRect(0, 16, 34, 9, 4).fillRoundedRect(0, 38, 34, 9, 4)
    })

    this.texBoost = this.makeTexture('boost', 56, 26, (g) => {
      g.fillStyle(0x2f7d32, 1).fillRoundedRect(0, 8, 56, 18, 8)
      g.fillStyle(p.accent, 1).fillRoundedRect(0, 0, 56, 18, 8)
      g.fillStyle(0xffffff, 0.9)
      g.fillTriangle(28, 2, 20, 13, 36, 13)
    })

    this.texCoin = this.makeTexture('coin', 26, 32, (g) => {
      g.fillStyle(0xd79b0b, 1).fillEllipse(13, 17, 24, 30)
      g.fillStyle(p.accent, 1).fillEllipse(13, 15, 22, 28)
      g.fillStyle(0xffffff, 0.7).fillEllipse(9, 10, 6, 9)
    })

    this.texDust = this.makeTexture('dust', 18, 18, (g) => {
      g.fillStyle(0xffffff, 0.85).fillCircle(9, 9, 9)
    })

    this.texSpark = this.makeTexture('spark', 16, 16, (g) => {
      g.fillStyle(p.accent, 1).fillCircle(8, 8, 8)
    })
  }

  // -------------------------------------------------------------- background

  buildBackground() {
    const p = this.world.palette

    // Graphics.fillGradientStyle only gradients under WebGL — under the Canvas renderer
    // it silently no-ops and every world ends up showing the config's background colour.
    // A canvas-texture gradient renders identically under both.
    this.add.image(0, 0, this.makeSkyTexture())
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(-3)

    this.add.circle(520, 116, 46, 0xffffff, 0.5).setDepth(-2)
    this.add.circle(520, 116, 32, 0xfff3c4, 0.9).setDepth(-2)

    // Kept clear of the HUD panels along the top edge, which they'd otherwise smudge.
    this.clouds = []
    for (let i = 0; i < 4; i++) {
      const cloud = this.add.image(80 + i * 210, 96 + (i % 3) * 30, this.texCloud)
        .setScale(0.6 + (i % 3) * 0.22)
        .setAlpha(0.75)
        .setDepth(-2)
      this.clouds.push(cloud)
    }

    // Both hill bands are anchored so their *base* lands exactly on the ground line —
    // otherwise the silhouettes spill over the ground strip and the egg reads as
    // running waist-deep through the scenery.
    this.hillFar = this.add.tileSprite(0, GROUND_Y - 160, GAME_WIDTH, 160, this.texHillFar)
      .setOrigin(0, 0).setDepth(-1)
    this.hillNear = this.add.tileSprite(0, GROUND_Y - 160, GAME_WIDTH, 160, this.texHillNear)
      .setOrigin(0, 0).setDepth(-1)
  }

  buildGround() {
    this.groundTile = this.add.tileSprite(0, GROUND_Y, GAME_WIDTH, 90, this.texGround)
      .setOrigin(0, 0).setDepth(1)

    this.groundBody = this.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 20, GAME_WIDTH, 40, 0x000000, 0)
    this.physics.add.existing(this.groundBody, true)
  }

  buildHero() {
    const texture = this.textures.get(this.heroKey)
    const source = texture.getSourceImage()

    // Cut the name plate off the badge and keep only the character.
    const frameName = 'character'
    if (!texture.has(frameName)) {
      texture.add(
        frameName, 0,
        Math.round(source.width * HERO_CROP.x),
        Math.round(source.height * HERO_CROP.y),
        Math.round(source.width * HERO_CROP.width),
        Math.round(source.height * HERO_CROP.height),
      )
    }

    const frame = texture.get(frameName)
    const scale = HERO_HEIGHT / frame.height
    // Recorded up front, not lazily in bobHero(): the ground collider can fire onLand()
    // before the first scene update, and the squash tween needs a rest scale to return to.
    this.heroScale = scale

    this.heroShadow = this.add.ellipse(150, GROUND_Y + 1, 70, 17, 0x000000, 0.2).setDepth(2)

    this.hero = this.physics.add.sprite(150, GROUND_Y, this.heroKey, frameName)
    this.hero.setScale(scale).setOrigin(0.5, 1)
    this.hero.setDepth(5)

    const bodyW = frame.width * HERO_BODY.width
    const bodyH = frame.height * HERO_BODY.height
    this.hero.body.setSize(bodyW, bodyH)
    this.hero.body.setOffset((frame.width - bodyW) / 2, frame.height - bodyH - HERO_SINK / scale)
    this.hero.body.setGravityY(GRAVITY)

    this.physics.add.collider(this.hero, this.groundBody, () => {
      if (!this.wasGrounded) this.onLand()
    })

    this.shieldRing = this.add.circle(0, 0, 58, 0xffffff, 0)
      .setStrokeStyle(4, this.world.palette.accent, 0.9)
      .setVisible(false)
      .setDepth(4)
  }

  buildGroups() {
    this.hazards = this.physics.add.group({ allowGravity: false, immovable: true })
    this.coins = this.physics.add.group({ allowGravity: false, immovable: true })

    this.physics.add.overlap(this.hero, this.hazards, (hero, hazard) => this.onHazard(hazard))
    this.physics.add.overlap(this.hero, this.coins, (hero, coin) => this.collectCoin(coin))
  }

  // --------------------------------------------------------------------- HUD

  buildHud() {
    const panel = (x, y, w, h) => this.add.graphics().setScrollFactor(0).setDepth(20)
      .fillStyle(0x2b261d, 0.72).fillRoundedRect(x, y, w, h, 12)

    panel(14, 14, 132, 52)
    panel(156, 14, 108, 52)
    panel(274, 14, 108, 52)

    const label = (x, text) => this.add.text(x, 22, text, {
      fontFamily: FONT, fontSize: '12px', fontStyle: '800', color: '#ffd43b',
    }).setScrollFactor(0).setDepth(21)

    const value = (x, text) => this.add.text(x, 36, text, {
      fontFamily: FONT, fontSize: '22px', fontStyle: '900', color: '#fff8e8',
    }).setScrollFactor(0).setDepth(21)

    label(26, 'SCORE')
    this.scoreText = value(26, '0')
    label(168, 'BEST')
    this.bestText = value(168, String(this.best))
    label(286, 'COMBO')
    this.comboText = value(286, '×1')

    this.heartsText = this.add.text(GAME_WIDTH - 20, 78, '', {
      fontFamily: FONT, fontSize: '20px',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(21)

    // Power button. Taps inside this rect fire the power instead of a jump.
    this.powerRect = new Phaser.Geom.Rectangle(GAME_WIDTH - 208, 14, 194, 52)
    this.powerPanel = this.add.graphics().setScrollFactor(0).setDepth(20)
    this.powerName = this.add.text(this.powerRect.x + 14, 22, this.world.power.name.toUpperCase(), {
      fontFamily: FONT, fontSize: '13px', fontStyle: '900', color: '#fff8e8',
    }).setScrollFactor(0).setDepth(21)
    this.powerHint = this.add.text(this.powerRect.x + 14, 42, this.world.power.blurb, {
      fontFamily: FONT, fontSize: '11px', fontStyle: '700', color: '#ffd43b',
    }).setScrollFactor(0).setDepth(21)

    this.updateHud()
  }

  updateHud() {
    this.scoreText.setText(String(this.score))
    this.bestText.setText(String(Math.max(this.best, this.score)))
    this.comboText.setText(`×${this.combo}`)
    this.heartsText.setText('❤️'.repeat(this.lives) + '🤎'.repeat(START_LIVES - this.lives))

    const ready = this.power >= 100
    const r = this.powerRect
    this.powerPanel.clear()
    this.powerPanel.fillStyle(ready ? 0x8a4bd4 : 0x2b261d, ready ? 0.95 : 0.72)
    this.powerPanel.fillRoundedRect(r.x, r.y, r.width, r.height, 12)
    this.powerPanel.fillStyle(0x000000, 0.35).fillRoundedRect(r.x + 12, r.y + 38, r.width - 24, 7, 4)
    this.powerPanel.fillStyle(this.world.palette.accent, 1)
      .fillRoundedRect(r.x + 12, r.y + 38, (r.width - 24) * (this.power / 100), 7, 4)
    this.powerHint.setText(ready ? 'TAP TO USE!' : this.world.power.blurb)
  }

  buildReadyBanner() {
    this.readyGroup = this.add.container(GAME_WIDTH / 2, 190).setDepth(30)

    const plate = this.add.graphics()
      .fillStyle(0xfff8e8, 0.94).fillRoundedRect(-230, -58, 460, 116, 20)
      .lineStyle(4, this.world.palette.banner, 1).strokeRoundedRect(-230, -58, 460, 116, 20)

    const title = this.add.text(0, -28, this.world.title.toUpperCase(), {
      fontFamily: FONT, fontSize: '26px', fontStyle: '900', color: '#2b261d', align: 'center',
    }).setOrigin(0.5)

    const sub = this.add.text(0, 4, this.world.subtitle, {
      fontFamily: FONT, fontSize: '16px', fontStyle: '700', color: '#a2703a',
    }).setOrigin(0.5)

    const cta = this.add.text(0, 34, 'TAP  ·  SPACE  ·  ▲   to jump', {
      fontFamily: FONT, fontSize: '15px', fontStyle: '800', color: '#2e7dd7',
    }).setOrigin(0.5)

    this.readyGroup.add([plate, title, sub, cta])

    if (!this.reduceMotion) {
      this.tweens.add({ targets: this.readyGroup, y: 200, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
  }

  bindInput() {
    this.input.on('pointerdown', (pointer) => {
      if (Phaser.Geom.Rectangle.Contains(this.powerRect, pointer.x, pointer.y)) {
        this.usePower()
        return
      }
      this.tap()
    })

    // Without capture, Space and ArrowUp scroll the page behind the overlay while the
    // player is trying to jump.
    this.input.keyboard.addCapture('SPACE,UP,P')
    this.input.keyboard.on('keydown-SPACE', () => this.tap())
    this.input.keyboard.on('keydown-UP', () => this.tap())
    this.input.keyboard.on('keydown-P', () => this.usePower())
  }

  // ------------------------------------------------------------------- input

  tap() {
    if (this.phase === 'ready') return this.startRun()
    if (this.phase !== 'running') return
    this.jumpQueuedAt = this.time.now
  }

  startRun() {
    this.phase = 'running'
    this.startedAt = this.time.now
    this.tweens.killTweensOf(this.readyGroup)
    this.tweens.add({
      targets: this.readyGroup,
      alpha: 0,
      y: 140,
      duration: 260,
      onComplete: () => this.readyGroup.destroy(),
    })
  }

  usePower() {
    if (this.phase !== 'running' || this.power < 100) return
    this.power = 0

    const key = this.world.power.key
    if (key === 'shield') {
      this.shieldActive = true
      this.shieldRing.setVisible(true)
    } else if (key === 'dash') {
      this.dashUntil = this.time.now + DASH_MS
    } else if (key === 'luck') {
      this.luckUntil = this.time.now + LUCK_MS
    }

    this.showFloater(this.hero.x, this.hero.y - 110, this.world.power.name.toUpperCase(), '#8a4bd4')
    this.updateHud()
  }

  // -------------------------------------------------------------------- loop

  update(time, delta) {
    const dt = delta / 1000

    if (this.phase === 'over') return

    if (this.phase === 'ready') {
      this.scrollBackground(BASE_SPEED * 0.25, dt)
      this.bobHero(time)
      return
    }

    const dashing = time < this.dashUntil
    this.speed = BASE_SPEED + Math.min(MAX_SPEED_BONUS, this.score * 3)
    const speed = this.speed * (dashing ? 1.5 : 1)

    this.scrollBackground(speed, dt)
    this.handleJump(time)
    this.bobHero(time)

    this.hazards.setVelocityX(-speed)
    this.coins.setVelocityX(-speed)

    this.distanceToSpawn -= speed * dt
    if (this.distanceToSpawn <= 0) this.spawnCluster(time)

    this.scoreHazards()
    this.recycle()

    if (dashing) this.magnetiseCoins(dt)
    this.updateEffects(time)
  }

  scrollBackground(speed, dt) {
    this.hillFar.tilePositionX += speed * dt * 0.18
    this.hillNear.tilePositionX += speed * dt * 0.42
    this.groundTile.tilePositionX += speed * dt

    for (const cloud of this.clouds) {
      cloud.x -= speed * dt * 0.08
      if (cloud.x < -100) cloud.x = GAME_WIDTH + 100
    }
  }

  handleJump(time) {
    const grounded = this.hero.body.blocked.down || this.hero.body.touching.down
    if (grounded) this.lastGroundedAt = time

    const canJump = grounded || time - this.lastGroundedAt <= COYOTE_MS
    const buffered = time - this.jumpQueuedAt <= JUMP_BUFFER_MS

    if (canJump && buffered) {
      this.hero.body.setVelocityY(JUMP_VELOCITY)
      this.jumpQueuedAt = -Infinity
      this.lastGroundedAt = -Infinity
      this.spawnDust(this.hero.x - 6, GROUND_Y, 3)
    }

    this.wasGrounded = grounded
  }

  onLand() {
    this.spawnDust(this.hero.x - 6, GROUND_Y, 4)
    if (this.reduceMotion) return
    this.hero.setScale(this.hero.scaleX * 1.12, this.hero.scaleY * 0.88)
    this.tweens.add({
      targets: this.hero,
      scaleX: this.heroScale, scaleY: this.heroScale,
      duration: 160,
      ease: 'Back.easeOut',
    })
  }

  bobHero(time) {
    const airborne = !(this.hero.body.blocked.down || this.hero.body.touching.down)
    if (airborne) {
      const rising = this.hero.body.velocity.y < 0
      this.hero.setAngle(Phaser.Math.Linear(this.hero.angle, rising ? -12 : 10, 0.12))
    } else {
      this.hero.setAngle(this.reduceMotion ? 0 : Math.sin(time / 70) * 4)
    }

    // Shadow shrinks with height, which is most of what sells the jump arc.
    const height = Phaser.Math.Clamp((GROUND_Y - this.hero.y) / 170, 0, 1)
    this.heroShadow.setScale(1 - height * 0.55).setAlpha(0.22 * (1 - height * 0.7))

    this.shieldRing.setPosition(this.hero.x, this.hero.y - HERO_HEIGHT / 2)
  }

  // ------------------------------------------------------------------ spawns

  spawnCluster(time) {
    const lucky = time < this.luckUntil
    const speed = this.speed
    const reach = AIR_TIME * speed

    if (lucky) {
      this.spawnBoost()
    } else {
      const roll = Math.random()
      if (roll < 0.34) this.spawnHazard(this.texStump, 48, 56)
      else if (roll < 0.68) this.spawnHazard(this.texShell, 62, 40)
      else this.spawnHazard(this.texFence, 34, 68)

      // A second hazard tucked just behind the first — still one jump, but it asks
      // for a committed one. Only once the player has some speed under them.
      if (this.score > 12 && Math.random() < 0.28) {
        this.spawnHazard(this.texShell, 62, 40, 70)
      }
    }

    if (Math.random() < 0.78) this.spawnCoinArc()

    // Never tighter than the jump can cover: reach is the full arc, and the cluster
    // needs clearing plus landing room before the next one arrives.
    this.distanceToSpawn = Math.max(300, reach * 1.15) + Math.random() * 180
  }

  spawnHazard(texture, width, height, offsetX = 0) {
    const hazard = this.hazards.create(GAME_WIDTH + 60 + offsetX, GROUND_Y - height / 2 + 4, texture)
    hazard.setDepth(4)
    hazard.body.setSize(width * 0.78, height * 0.8)
    hazard.setData('scored', false)
    hazard.setData('minClearance', Infinity)
    hazard.setData('boost', false)
    return hazard
  }

  spawnBoost() {
    const pad = this.hazards.create(GAME_WIDTH + 60, GROUND_Y - 13, this.texBoost)
    pad.setDepth(4)
    pad.body.setSize(52, 22)
    pad.setData('scored', false)
    pad.setData('minClearance', Infinity)
    pad.setData('boost', true)
    return pad
  }

  spawnCoinArc() {
    const count = 3 + Math.floor(Math.random() * 3)
    const peak = GROUND_Y - 150 - Math.random() * 40
    const startX = GAME_WIDTH + 90

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1)
      const y = GROUND_Y - 60 - Math.sin(t * Math.PI) * (GROUND_Y - 60 - peak)
      const coin = this.coins.create(startX + i * 46, y, this.texCoin)
      coin.setDepth(4)
      coin.body.setCircle(12, 1, 4)
      if (!this.reduceMotion) {
        this.tweens.add({ targets: coin, scaleX: 0.72, duration: 420, yoyo: true, repeat: -1 })
      }
    }
  }

  // ----------------------------------------------------------------- scoring

  scoreHazards() {
    const heroLeft = this.hero.x - this.hero.displayWidth / 2
    const heroRight = this.hero.x + this.hero.displayWidth / 2
    const heroBottom = this.hero.y

    for (const hazard of this.hazards.getChildren()) {
      if (hazard.getData('scored')) continue

      const left = hazard.x - hazard.displayWidth / 2
      const right = hazard.x + hazard.displayWidth / 2
      const top = hazard.y - hazard.displayHeight / 2

      if (right > heroLeft && left < heroRight) {
        hazard.setData('minClearance', Math.min(hazard.getData('minClearance'), top - heroBottom))
      }

      if (right >= heroLeft) continue

      hazard.setData('scored', true)
      if (hazard.getData('boost')) {
        this.addScore(3, hazard.x, 'BOOST!')
        continue
      }

      const clearance = hazard.getData('minClearance')
      const perfect = clearance >= 0 && clearance <= 40
      if (perfect) {
        this.perfects++
        this.bumpCombo()
        this.addScore(2, hazard.x, 'PERFECT +2')
      } else {
        this.addScore(1, hazard.x, null)
      }
    }
  }

  collectCoin(coin) {
    const doubled = this.time.now < this.dashUntil || this.time.now < this.luckUntil
    const gain = this.combo * (doubled ? 2 : 1)

    this.coinsCollected++
    this.power = Math.min(100, this.power + POWER_PER_COIN)
    this.bumpCombo()
    this.addScore(gain, coin.x, `+${gain}`)

    this.spawnSpark(coin.x, coin.y)
    this.killCoin(coin)
  }

  // Coins carry an infinite spin tween. destroy() alone leaves it in the manager, and a
  // run spawns hundreds of them, so the tween goes first.
  killCoin(coin) {
    this.tweens.killTweensOf(coin)
    coin.destroy()
  }

  bumpCombo() {
    this.combo = Math.min(MAX_COMBO, this.combo + 1)
    this.maxCombo = Math.max(this.maxCombo, this.combo)
    if (this.combo > 1) this.power = Math.min(100, this.power + POWER_PER_PERFECT)
  }

  addScore(amount, x, text) {
    this.score += amount
    if (text) this.showFloater(x, GROUND_Y - 170, text, '#ffffff')
    this.updateHud()
  }

  onHazard(hazard) {
    if (hazard.getData('boost')) return
    if (this.time.now < this.invulnerableUntil || this.time.now < this.dashUntil) return

    if (this.shieldActive) {
      this.shieldActive = false
      this.shieldRing.setVisible(false)
      this.invulnerableUntil = this.time.now + INVULNERABLE_MS
      this.showFloater(this.hero.x, this.hero.y - 120, 'SHIELDED!', '#ffd43b')
      return
    }

    this.lives--
    this.combo = 1
    this.invulnerableUntil = this.time.now + INVULNERABLE_MS
    this.updateHud()

    if (!this.reduceMotion) {
      this.cameras.main.shake(180, 0.008)
      this.tweens.add({ targets: this.hero, alpha: 0.3, duration: 120, yoyo: true, repeat: 4 })
    }

    if (this.lives <= 0) this.endRun()
    else this.showFloater(this.hero.x, this.hero.y - 120, 'OUCH!', '#e23c2e')
  }

  endRun() {
    this.phase = 'over'
    this.hero.setAlpha(1)
    this.hazards.setVelocityX(0)
    this.coins.setVelocityX(0)

    this.add.text(GAME_WIDTH / 2, 190, 'RUN OVER', {
      fontFamily: FONT, fontSize: '46px', fontStyle: '900', color: '#fff8e8',
      stroke: '#2b261d', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(30)

    this.time.delayedCall(750, () => {
      this.onRunEnd({
        worldId: this.world.id,
        score: this.score,
        perfects: this.perfects,
        maxCombo: this.maxCombo,
        coinsCollected: this.coinsCollected,
        durationMs: Math.round(this.time.now - this.startedAt),
      })
    })
  }

  // ----------------------------------------------------------------- effects

  updateEffects(time) {
    if (this.shieldActive) {
      this.shieldRing.setAlpha(0.5 + Math.sin(time / 120) * 0.3)
    }

    this.hero.setTint(time < this.dashUntil ? 0xfff0a0 : 0xffffff)
  }

  magnetiseCoins(dt) {
    for (const coin of this.coins.getChildren()) {
      const distance = Phaser.Math.Distance.Between(coin.x, coin.y, this.hero.x, this.hero.y - 40)
      if (distance > 240) continue
      coin.x = Phaser.Math.Linear(coin.x, this.hero.x, dt * 4)
      coin.y = Phaser.Math.Linear(coin.y, this.hero.y - 40, dt * 4)
    }
  }

  spawnDust(x, y, count) {
    for (let i = 0; i < count; i++) {
      const puff = this.add.image(x + Math.random() * 16 - 8, y - Math.random() * 6, this.texDust)
        .setScale(0.3 + Math.random() * 0.3)
        .setAlpha(0.7)
        .setDepth(3)
      this.tweens.add({
        targets: puff,
        x: puff.x - 40 - Math.random() * 30,
        y: puff.y - 10 - Math.random() * 14,
        alpha: 0,
        scale: 0.1,
        duration: 420,
        onComplete: () => puff.destroy(),
      })
    }
  }

  spawnSpark(x, y) {
    const spark = this.add.image(x, y, this.texSpark).setDepth(6)
    this.tweens.add({
      targets: spark,
      scale: 2.2,
      alpha: 0,
      duration: 300,
      onComplete: () => spark.destroy(),
    })
  }

  showFloater(x, y, text, color) {
    const floater = this.add.text(x, y, text, {
      fontFamily: FONT, fontSize: '20px', fontStyle: '900', color,
      stroke: '#2b261d', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(25)

    this.tweens.add({
      targets: floater,
      y: y - 46,
      alpha: 0,
      duration: 700,
      onComplete: () => floater.destroy(),
    })
  }

  recycle() {
    for (const hazard of [...this.hazards.getChildren()]) {
      if (hazard.x < -120) hazard.destroy()
    }
    // getChildren() is live, so iterate a copy while destroying out of it.
    for (const coin of [...this.coins.getChildren()]) {
      if (coin.x < -60) this.killCoin(coin)
    }
  }
}
