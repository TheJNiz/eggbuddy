import Phaser from 'phaser'
import { asset } from '../assets.js'
import { worldEgg } from './worlds.js'

// The width the speeds and spacings below were tuned against. A narrower canvas shows
// less track ahead, so horizontal motion is scaled by width / REFERENCE_WIDTH to keep the
// player's reaction time — in seconds — the same on every screen.
export const REFERENCE_WIDTH = 800

const GRAVITY = 2000
const JUMP_VELOCITY = -720

// Air time is 2 * 720 / 2000 = 0.72s, so horizontal reach at the 420px/s top speed
// is ~300px. Every spacing below is derived from that so no gap is ever unclearable.
const AIR_TIME = (2 * Math.abs(JUMP_VELOCITY)) / GRAVITY
const BASE_SPEED = 260
const MAX_SPEED_BONUS = 160

// A hazard only spawns if the current jump covers its span with this much room to spare.
const CLEARANCE_MARGIN = 1.25

// Below this logical width the wide HUD's panels collide, so it switches to one compact
// row plus a round power button.
const COMPACT_WIDTH = 640

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

    this.layout()

    this.phase = 'ready'
    this.score = 0
    this.coinsCollected = 0
    this.perfects = 0
    this.combo = 1
    this.maxCombo = 1
    this.lives = START_LIVES
    this.power = 0
    this.speed = this.baseSpeed
    this.distanceToSpawn = this.width * 0.525
    this.invulnerableUntil = 0
    this.lastGroundedAt = 0
    this.jumpQueuedAt = -Infinity
    this.shieldActive = false
    this.dashUntil = 0
    this.luckUntil = 0
    this.startedAt = 0
  }

  // Every dimension the scene uses, derived from whatever canvas createGame picked. The
  // constants are chosen so a 800x450 canvas lands on the numbers the game was originally
  // tuned with, which keeps desktop pixel-for-pixel where it was.
  layout() {
    const { width, height } = this.scale
    this.width = width
    this.height = height
    this.compact = width < COMPACT_WIDTH

    this.groundStrip = Phaser.Math.Clamp(Math.round(height * 0.17), 78, 150)
    this.groundY = height - this.groundStrip          // 450 -> 372
    this.hillBand = Phaser.Math.Clamp(Math.round(height * 0.36), 160, 300)
    this.heroX = Math.round(width * 0.19)             // 800 -> 152

    // Where the top HUD row ends. Clouds and the sun start below it so they never smudge
    // the panels.
    this.hudTop = this.compact ? 10 : 14
    this.hudRowHeight = this.compact ? 56 : 52
    this.hudBottom = this.hudTop + this.hudRowHeight + (this.compact ? 8 : 34)

    // Horizontal motion scales with the view so the player always gets the same number of
    // seconds to read a hazard, no matter how much track fits on screen.
    this.motion = width / REFERENCE_WIDTH
    this.baseSpeed = BASE_SPEED * this.motion
    this.maxSpeedBonus = MAX_SPEED_BONUS * this.motion
  }

  // How far the egg travels horizontally during one jump, at the current speed.
  get jumpReach() {
    return AIR_TIME * this.speed
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
    const midX = this.width / 2
    const midY = this.height / 2
    const barWidth = Math.min(240, this.width - 80)

    const bar = this.add.graphics()
    const label = this.add.text(midX, midY - 34, 'Warming up the egg…', {
      fontFamily: FONT, fontSize: '20px', fontStyle: '700', color: '#7a6a4a',
    }).setOrigin(0.5)

    this.load.on('progress', (value) => {
      bar.clear()
      bar.fillStyle(0xe8dcc0, 1).fillRoundedRect(midX - barWidth / 2, midY, barWidth, 14, 7)
      bar.fillStyle(0xffc61a, 1).fillRoundedRect(midX - barWidth / 2, midY, barWidth * value, 14, 7)
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
    const key = `${this.world.id}-sky-${this.height}`
    if (this.textures.exists(key)) return key

    const hex = (value) => `#${value.toString(16).padStart(6, '0')}`
    const canvas = this.textures.createCanvas(key, 8, this.height)
    const ctx = canvas.getContext()
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height)
    gradient.addColorStop(0, hex(this.world.palette.skyTop))
    gradient.addColorStop(1, hex(this.world.palette.skyBottom))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 8, this.height)
    canvas.refresh()

    return key
  }

  buildTextures() {
    const p = this.world.palette

    // Sine-silhouette hills. The 200px period divides the 400px texture width, so the
    // TileSprite repeats seamlessly. Height follows the canvas, so a tall portrait screen
    // gets proportionally taller hills instead of a lonely strip above the ground.
    const band = this.hillBand
    const hill = (key, color, amplitude, base) =>
      this.makeTexture(`${key}-${band}`, 400, band, (g) => {
        const points = [{ x: 0, y: band }]
        for (let x = 0; x <= 400; x += 8) {
          points.push({ x, y: base - amplitude * Math.sin((x / 200) * Math.PI * 2) })
        }
        points.push({ x: 400, y: band })
        g.fillStyle(color, 1).fillPoints(points, true)
      })

    // Deliberately low silhouettes: tall hills sit right behind the runner and swallow
    // it. `base` is the sine midline in texture space, so a bigger base means a
    // shorter hill.
    this.texHillFar = hill('hill-far', p.hillFar, band * 0.125, band * 0.6)
    this.texHillNear = hill('hill-near', p.hillNear, band * 0.163, band * 0.775)

    const strip = this.groundStrip
    this.texGround = this.makeTexture(`ground-${strip}`, 96, strip, (g) => {
      g.fillStyle(p.ground, 1).fillRect(0, 0, 96, strip)
      g.fillStyle(p.groundEdge, 1).fillRect(0, 0, 96, 12)
      g.fillStyle(p.ground, 0.55).fillRect(0, 12, 96, 4)
      g.fillStyle(0x000000, 0.07)
        .fillEllipse(24, strip * 0.49, 30, 9)
        .fillEllipse(70, strip * 0.73, 24, 7)
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
      .setDisplaySize(this.width, this.height)
      .setDepth(-3)

    // The open sky between the HUD and the hilltops. On a phone held sideways there is
    // barely any, so the sun is sized to fit and dropped entirely rather than jammed
    // half-behind the HUD.
    const skyTop = this.hudBottom
    const skyBand = this.groundY - this.hillBand - skyTop

    if (skyBand > 60) {
      const sunY = skyTop + skyBand * 0.4
      const radius = Phaser.Math.Clamp(skyBand * 0.4, 24, 46)
      this.add.circle(this.width * 0.65, sunY, radius, 0xffffff, 0.5).setDepth(-2)
      this.add.circle(this.width * 0.65, sunY, radius * 0.7, 0xfff3c4, 0.9).setDepth(-2)
    }

    // Kept clear of the HUD panels along the top edge, which they'd otherwise smudge.
    this.clouds = []
    const cloudTop = skyTop + 12
    const cloudBand = Math.max(30, (this.groundY - this.hillBand - cloudTop) * 0.7)
    for (let i = 0; i < 4; i++) {
      const cloud = this.add.image(
        this.width * (0.1 + i * 0.26),
        cloudTop + (i % 3) * (cloudBand / 3),
        this.texCloud,
      )
        .setScale(0.6 + (i % 3) * 0.22)
        .setAlpha(0.75)
        .setDepth(-2)
      this.clouds.push(cloud)
    }

    // Both hill bands are anchored so their *base* lands exactly on the ground line —
    // otherwise the silhouettes spill over the ground strip and the egg reads as
    // running waist-deep through the scenery.
    const hillTop = this.groundY - this.hillBand
    this.hillFar = this.add.tileSprite(0, hillTop, this.width, this.hillBand, this.texHillFar)
      .setOrigin(0, 0).setDepth(-1)
    this.hillNear = this.add.tileSprite(0, hillTop, this.width, this.hillBand, this.texHillNear)
      .setOrigin(0, 0).setDepth(-1)
  }

  buildGround() {
    this.groundTile = this.add
      .tileSprite(0, this.groundY, this.width, this.groundStrip, this.texGround)
      .setOrigin(0, 0).setDepth(1)

    this.groundBody = this.add.rectangle(
      this.width / 2, this.groundY + 20, this.width, 40, 0x000000, 0,
    )
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

    this.heroShadow = this.add
      .ellipse(this.heroX, this.groundY + 1, 70, 17, 0x000000, 0.2).setDepth(2)

    this.hero = this.physics.add.sprite(this.heroX, this.groundY, this.heroKey, frameName)
    this.hero.setScale(scale).setOrigin(0.5, 1)
    this.hero.setDepth(5)

    const bodyW = frame.width * HERO_BODY.width
    const bodyH = frame.height * HERO_BODY.height
    // Used by the spawn clearance check: the on-screen width of the egg's hitbox.
    this.heroBodyWidth = bodyW * scale
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
    this.hudPanels = this.add.graphics().setScrollFactor(0).setDepth(20)
    this.powerPanel = this.add.graphics().setScrollFactor(0).setDepth(20)

    // `color` needs a real default: Phaser reads the key off the style object, so passing
    // an explicit undefined leaves the fill unset and the text renders invisible.
    const text = (x, y, size, color = '#fff8e8', weight = '900') => this.add.text(x, y, '', {
      fontFamily: FONT, fontSize: `${size}px`, fontStyle: weight, color,
    }).setScrollFactor(0).setDepth(21)

    if (this.compact) this.buildCompactHud(text)
    else this.buildWideHud(text)

    this.updateHud()
  }

  buildWideHud(text) {
    const top = this.hudTop
    const h = this.hudRowHeight

    this.hudPanels.fillStyle(0x2b261d, 0.72)
      .fillRoundedRect(14, top, 132, h, 12)
      .fillRoundedRect(156, top, 108, h, 12)
      .fillRoundedRect(274, top, 108, h, 12)

    const label = (x, value) => text(x, top + 8, 12, '#ffd43b', '800').setText(value)
    const readout = (x) => text(x, top + 22, 22, '#fff8e8')

    label(26, 'SCORE')
    this.scoreText = readout(26)
    label(168, 'BEST')
    this.bestText = readout(168)
    label(286, 'COMBO')
    this.comboText = readout(286)

    this.heartsText = text(this.width - 20, top + h + 12, 20, '#ffffff').setOrigin(1, 0)

    // Taps inside this rect fire the power instead of a jump.
    this.powerRect = new Phaser.Geom.Rectangle(this.width - 208, top, 194, h)
    this.powerName = text(this.powerRect.x + 14, top + 8, 13, '#fff8e8')
      .setText(this.world.power.name.toUpperCase())
    this.powerHint = text(this.powerRect.x + 14, top + 28, 11, '#ffd43b', '700')
  }

  // One tight row of readouts, and the power moved to a round button in the bottom-right
  // where a thumb already rests. Type is a size up from the wide layout: the HUD does not
  // affect gameplay, so it can be scaled harder than the world to stay legible.
  buildCompactHud(text) {
    const top = this.hudTop
    const h = this.hudRowHeight
    const rowWidth = this.width - 20

    this.hudPanels.fillStyle(0x2b261d, 0.72).fillRoundedRect(10, top, rowWidth, h, 12)

    this.scoreText = text(20, top + 4, 24)
    this.bestText = text(20, top + 36, 10, '#ffd43b', '800')
    this.comboText = text(this.width * 0.5, top + 14, 22, '#ffd43b')
    this.heartsText = text(this.width - 20, top + 16, 16).setOrigin(1, 0)

    // Bottom-right, clear of the ground line so it never sits on top of a hazard the
    // player is trying to read.
    const radius = 42
    this.powerCircle = new Phaser.Geom.Circle(
      this.width - radius - 16,
      this.groundY - radius - 28,
      radius,
    )
    this.powerName = text(this.powerCircle.x, this.powerCircle.y - 14, 20)
      .setOrigin(0.5)
      .setText('⚡')
    this.powerHint = text(this.powerCircle.x, this.powerCircle.y + 4, 11, '#ffd43b', '800')
      .setOrigin(0.5)
  }

  // Rect in the wide layout, circle in the compact one — one call site for bindInput.
  pointInPower(x, y) {
    if (this.powerCircle) return Phaser.Geom.Circle.Contains(this.powerCircle, x, y)
    return Phaser.Geom.Rectangle.Contains(this.powerRect, x, y)
  }

  updateHud() {
    const ready = this.power >= 100

    this.scoreText.setText(String(this.score))
    this.bestText.setText(this.compact
      ? `BEST ${Math.max(this.best, this.score)}`
      : String(Math.max(this.best, this.score)))
    this.comboText.setText(`×${this.combo}`)
    this.heartsText.setText('❤️'.repeat(this.lives) + '🤎'.repeat(START_LIVES - this.lives))

    this.powerPanel.clear()

    if (this.powerCircle) {
      const c = this.powerCircle
      this.powerPanel.fillStyle(ready ? 0x8a4bd4 : 0x2b261d, ready ? 0.95 : 0.78)
        .fillCircle(c.x, c.y, c.radius)
      // A light rim keeps the button readable against dark hills and night skies.
      this.powerPanel.lineStyle(3, 0xfff8e8, 0.85).strokeCircle(c.x, c.y, c.radius)
      // Charge reads as a ring filling clockwise from the top.
      this.powerPanel.lineStyle(6, 0x000000, 0.3).strokeCircle(c.x, c.y, c.radius - 7)
      if (this.power > 0) {
        this.powerPanel.lineStyle(6, this.world.palette.accent, 1).beginPath()
        this.powerPanel.arc(
          c.x, c.y, c.radius - 7,
          Phaser.Math.DegToRad(-90),
          Phaser.Math.DegToRad(-90 + 360 * (this.power / 100)),
        )
        this.powerPanel.strokePath()
      }
      this.powerHint.setText(ready ? 'GO!' : `${Math.round(this.power)}%`)
      return
    }

    const r = this.powerRect
    this.powerPanel.fillStyle(ready ? 0x8a4bd4 : 0x2b261d, ready ? 0.95 : 0.72)
    this.powerPanel.fillRoundedRect(r.x, r.y, r.width, r.height, 12)
    this.powerPanel.fillStyle(0x000000, 0.35).fillRoundedRect(r.x + 12, r.y + 38, r.width - 24, 7, 4)
    this.powerPanel.fillStyle(this.world.palette.accent, 1)
      .fillRoundedRect(r.x + 12, r.y + 38, (r.width - 24) * (this.power / 100), 7, 4)
    this.powerHint.setText(ready ? 'TAP TO USE!' : this.world.power.blurb)
  }

  buildReadyBanner() {
    // Sits between the HUD and the hills, and never wider than the canvas.
    const plateWidth = Math.min(460, this.width - 40)
    const half = plateWidth / 2
    const restY = (this.hudBottom + (this.groundY - this.hillBand)) / 2

    this.readyGroup = this.add.container(this.width / 2, restY).setDepth(30)

    const plate = this.add.graphics()
      .fillStyle(0xfff8e8, 0.94).fillRoundedRect(-half, -58, plateWidth, 116, 20)
      .lineStyle(4, this.world.palette.banner, 1).strokeRoundedRect(-half, -58, plateWidth, 116, 20)

    const title = this.add.text(0, -28, this.world.title.toUpperCase(), {
      fontFamily: FONT, fontSize: '26px', fontStyle: '900', color: '#2b261d', align: 'center',
      wordWrap: { width: plateWidth - 28 },
    }).setOrigin(0.5)

    const sub = this.add.text(0, 4, this.world.subtitle, {
      fontFamily: FONT, fontSize: '16px', fontStyle: '700', color: '#a2703a',
    }).setOrigin(0.5)

    const cta = this.add.text(0, 34, this.compact ? 'TAP to jump' : 'TAP  ·  SPACE  ·  ▲   to jump', {
      fontFamily: FONT, fontSize: '15px', fontStyle: '800', color: '#2e7dd7',
    }).setOrigin(0.5)

    this.readyGroup.add([plate, title, sub, cta])

    if (!this.reduceMotion) {
      this.tweens.add({
        targets: this.readyGroup,
        y: restY + 10,
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
    }
  }

  bindInput() {
    this.input.on('pointerdown', (pointer) => {
      if (this.pointInPower(pointer.x, pointer.y)) {
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
      this.scrollBackground(this.baseSpeed * 0.25, dt)
      this.bobHero(time)
      return
    }

    const dashing = time < this.dashUntil
    this.speed = this.baseSpeed + Math.min(this.maxSpeedBonus, this.score * 3 * this.motion)
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
      if (cloud.x < -100) cloud.x = this.width + 100
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
      this.spawnDust(this.hero.x - 6, this.groundY, 3)
    }

    this.wasGrounded = grounded
  }

  onLand() {
    this.spawnDust(this.hero.x - 6, this.groundY, 4)
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
    const height = Phaser.Math.Clamp((this.groundY - this.hero.y) / 170, 0, 1)
    this.heroShadow.setScale(1 - height * 0.55).setAlpha(0.22 * (1 - height * 0.7))

    this.shieldRing.setPosition(this.hero.x, this.hero.y - HERO_HEIGHT / 2)
  }

  // ------------------------------------------------------------------ spawns

  // Whether one jump at the current speed crosses a cluster of this width with room to
  // spare. The egg's own body has to clear the hazard too, so it counts toward the span.
  canClear(clusterWidth) {
    return (clusterWidth + this.heroBodyWidth) * CLEARANCE_MARGIN <= this.jumpReach
  }

  spawnCluster(time) {
    const lucky = time < this.luckUntil
    const reach = this.jumpReach

    if (lucky) {
      this.spawnBoost()
    } else {
      // Widest hazard the current jump can actually clear. On a narrow phone canvas the
      // jump covers fewer pixels, so the opening speed offers only the slim fence and the
      // chunkier hazards unlock as the run speeds up — rather than spawning something
      // impossible. On desktop everything passes from the first spawn.
      const options = [
        { texture: this.texFence, width: 34, height: 68 },
        { texture: this.texStump, width: 48, height: 56 },
        { texture: this.texShell, width: 62, height: 40 },
      ].filter((option) => this.canClear(option.width))

      const pick = options.length
        ? options[Math.floor(Math.random() * options.length)]
        : null

      if (pick) {
        this.spawnHazard(pick.texture, pick.width, pick.height)

        // A second hazard tucked just behind the first — still one jump, but it asks
        // for a committed one. Only when the pair genuinely fits inside one arc, which
        // means it turns up once the run has some speed behind it (score ~19 on desktop).
        // 60 rather than 70 so the pair stays reachable at a phone's lower top speed.
        const offset = 60 * this.motion
        if (this.score > 12 && Math.random() < 0.28 && this.canClear(offset + 62)) {
          this.spawnHazard(this.texShell, 62, 40, offset)
        }
      }
    }

    if (Math.random() < 0.78) this.spawnCoinArc()

    // Never tighter than the jump can cover: reach is the full arc, and the cluster
    // needs clearing plus landing room before the next one arrives.
    this.distanceToSpawn = Math.max(300 * this.motion, reach * 1.15)
      + Math.random() * 180 * this.motion
  }

  spawnHazard(texture, width, height, offsetX = 0) {
    const hazard = this.hazards.create(
      this.width + 60 + offsetX, this.groundY - height / 2 + 4, texture,
    )
    hazard.setDepth(4)
    hazard.body.setSize(width * 0.78, height * 0.8)
    hazard.setData('scored', false)
    hazard.setData('minClearance', Infinity)
    hazard.setData('boost', false)
    return hazard
  }

  spawnBoost() {
    const pad = this.hazards.create(this.width + 60, this.groundY - 13, this.texBoost)
    pad.setDepth(4)
    pad.body.setSize(52, 22)
    pad.setData('scored', false)
    pad.setData('minClearance', Infinity)
    pad.setData('boost', true)
    return pad
  }

  spawnCoinArc() {
    const count = 3 + Math.floor(Math.random() * 3)
    const peak = this.groundY - 150 - Math.random() * 40
    const startX = this.width + 90
    const step = 46 * this.motion

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1)
      const y = this.groundY - 60 - Math.sin(t * Math.PI) * (this.groundY - 60 - peak)
      const coin = this.coins.create(startX + i * step, y, this.texCoin)
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
    if (text) this.showFloater(x, this.groundY - 170, text, '#ffffff')
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

    this.add.text(this.width / 2, this.height * 0.42, 'RUN OVER', {
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
