<script setup>
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { asset } from './assets.js'
import { eggs, randomEggOfRarity, rollEggRarity } from './eggs.js'
import { worlds } from './game/worlds.js'
import { redeemCarton } from './qr.js'

const STORAGE_KEY = 'eggbuddy-v1'
const chickenWalkImage = `url("${asset('chicken-walk.png')}")`

// Async so the overlay — and the Phaser chunk it dynamically imports — stays out of
// the farm's initial bundle.
const EggscapeOverlay = defineAsyncComponent(() => import('./components/EggscapeOverlay.vue'))

// `key` matches the state field it stocks, so buy() stays data-driven.
// Prices are set against the loop: 1 feed yields ~1.72 lays = ~34 coins, so feed
// at 20 keeps a healthy margin and makes one duplicate egg buy exactly one feed.
// Sell price is half of buy (rounded down), so a buy/sell round trip always costs
// something and the shop can't be used as a lossless bank.
const shopItems = [
  { key: 'food', icon: '🌽', name: 'Chicken Feed', price: 20, sell: 10, effect: '+28 Fullness · +4 Happiness' },
  { key: 'vitamins', icon: '💊', name: 'Vitamin', price: 35, sell: 17, effect: '+25 Health · +10 Energy' },
]

function defaultState() {
  return {
    chickenName: 'Bok Bok',
    hunger: 72,
    happiness: 81,
    energy: 64,
    health: 90,
    food: 3,
    vitamins: 1,
    coins: 120,
    eggsLaid: 0,
    collection: [0],
    lastTick: Date.now(),
    muted: false,
    eggscape: { best: {}, runs: 0 },
    message: 'Your chicken is ready to start its EGGventure!',
  }
}

// The shallow merge in loadState() would happily restore `eggscape: 42` from a hand-edited
// save, so the nested shape gets checked the same way `collection` does.
function sanitizeEggscape(saved, fallback) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return fallback

  const best = {}
  for (const world of worlds) {
    const value = saved.best?.[world.id]
    if (Number.isFinite(value) && value > 0) best[world.id] = Math.floor(value)
  }

  return { best, runs: Number.isFinite(saved.runs) && saved.runs > 0 ? Math.floor(saved.runs) : 0 }
}

function loadState() {
  const defaults = defaultState()

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return defaults

    return {
      ...defaults,
      ...saved,
      collection: Array.isArray(saved.collection)
        ? saved.collection.filter((id) => Number.isInteger(id) && id >= 0 && id < eggs.length)
        : defaults.collection,
      lastTick: Number.isFinite(saved.lastTick) ? saved.lastTick : defaults.lastTick,
      muted: typeof saved.muted === 'boolean' ? saved.muted : defaults.muted,
      eggscape: sanitizeEggscape(saved.eggscape, defaults.eggscape),
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return defaults
  }
}

const state = reactive(loadState())
const activeAction = ref('walk')
const actionCycle = ref(0)
let actionTimer

// Deliberately outside `state` — that object is deep-watched into localStorage,
// and a popup must not survive a reload.
const revealEgg = ref(null)
const revealButton = ref(null)
let revealShowTimer
let revealHideTimer

function closeReveal() {
  window.clearTimeout(revealShowTimer)
  window.clearTimeout(revealHideTimer)
  revealEgg.value = null
}

function showReveal(payload) {
  revealEgg.value = payload
  revealHideTimer = window.setTimeout(() => { revealEgg.value = null }, 4000)
  nextTick(() => revealButton.value?.focus())
}

function onKeydown(event) {
  if (event.key !== 'Escape') return
  // The overlay owns Escape while it's up (it pauses instead of closing) and stops the
  // event in the capture phase; this guard just makes that explicit.
  if (eggscapeOpen.value) return
  closeReveal()
  closeShop()
}

const bgm = ref(null)
const BGM_VOLUME = 0.4

// Browsers reject play() until the page has seen a user gesture, so the first
// attempt on load usually fails. onGesture retries after the user's first tap.
function applyAudio() {
  const el = bgm.value
  if (!el) return

  el.volume = BGM_VOLUME
  el.muted = state.muted

  if (state.muted) {
    el.pause()
    return
  }
  el.play().then(armGesture.stop, armGesture.start)
}

const armGesture = {
  active: false,
  start() {
    if (armGesture.active) return
    armGesture.active = true
    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)
  },
  stop() {
    if (!armGesture.active) return
    armGesture.active = false
    window.removeEventListener('pointerdown', onGesture)
    window.removeEventListener('keydown', onGesture)
  },
}

function onGesture() {
  if (state.muted) return armGesture.stop()
  applyAudio()
}

function toggleMute() {
  state.muted = !state.muted
  applyAudio()
}

const shopOpen = ref(false)
const shopCloseButton = ref(null)

function openShop() {
  // Also cancels a reveal scheduled by a lay in the last 1.8s — the one window
  // where both modals could otherwise stack.
  closeReveal()
  shopOpen.value = true
  nextTick(() => shopCloseButton.value?.focus())
}

function closeShop() {
  shopOpen.value = false
}

function buy(item) {
  if (state.coins < item.price) {
    return say(`Not enough coins for ${item.name} — lay more eggs to earn some!`)
  }
  state.coins -= item.price
  state[item.key]++
  say(`Bought 1 ${item.name} for ${item.price} coins 🪙`)
}

function sell(item) {
  if (!state[item.key]) return say(`No ${item.name} to sell.`)
  state[item.key]--
  state.coins += item.sell
  say(`Sold 1 ${item.name} for ${item.sell} coins 🪙`)
}

function animateAction(name, duration) {
  window.clearTimeout(actionTimer)
  activeAction.value = name
  actionCycle.value++
  // No cycle bump here — returning to walk only needs the class removed. Remounting
  // would restart the sprite's leg cycle for nothing (the effects layer already
  // unmounts via its own v-if chain).
  actionTimer = window.setTimeout(() => {
    activeAction.value = 'walk'
  }, duration)
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function say(text) {
  state.message = text
}

function decay() {
  const now = Date.now()
  const hours = Math.max(0, Math.min(24, (now - state.lastTick) / 3600000))

  if (hours > 0.02) {
    state.hunger = clamp(state.hunger - hours * 4)
    state.happiness = clamp(state.happiness - hours * 2)
    state.energy = clamp(state.energy - hours * 2.5)
    state.health = clamp(state.health - (state.hunger < 20 ? hours * 3 : 0))
    state.lastTick = now
  }
}

function feed() {
  if (!state.food) return say('No feed left — tap your 🪙 coins to buy more, or scan a QR.')
  state.food--
  state.hunger = clamp(state.hunger + 28)
  state.happiness = clamp(state.happiness + 4)
  animateAction('feed', 1300)
  say(`Crunch crunch! ${state.chickenName} loved the feed 🌽`)
}

function vitamin() {
  if (!state.vitamins) return say('No vitamins left — tap your 🪙 coins to buy more, or scan a QR.')
  state.vitamins--
  state.health = clamp(state.health + 25)
  state.energy = clamp(state.energy + 10)
  animateAction('vitamin', 1500)
  say('Vitamin boost! Health is looking egg-cellent ✨')
}

function play() {
  if (state.energy < 12) return say('Too sleepy to play.')
  state.energy = clamp(state.energy - 12)
  state.happiness = clamp(state.happiness + 18)
  state.hunger = clamp(state.hunger - 6)
  animateAction('play', 1500)
  say('Play time! Happiness went up 🪶')
}

function rest() {
  state.energy = clamp(state.energy + 25)
  state.hunger = clamp(state.hunger - 5)
  animateAction('nap', 2700)
  say('A cozy nap restored some energy 💤')
}

// Shared by laying and by EGGSCAPE run drops: adds a new egg to the collection, or
// pays the duplicate bounty. Returns whether it was new.
const DUPLICATE_BOUNTY = 20

function collectEgg(egg) {
  const fresh = !state.collection.includes(egg.id)
  if (fresh) state.collection.push(egg.id)
  else state.coins += DUPLICATE_BOUNTY
  return fresh
}

function layEgg() {
  closeReveal()

  if (state.hunger < 45 || state.health < 55 || state.happiness < 40) {
    animateAction('refuse', 1600)
    return say(`${state.chickenName} isn't well enough to lay an egg right now!`)
  }
  if (state.energy < 30) {
    animateAction('refuse', 1600)
    return say(`${state.chickenName} is too tired to lay right now — try a nap. 💤`)
  }

  const egg = randomEggOfRarity(rollEggRarity())

  state.eggsLaid++
  state.energy = clamp(state.energy - 22)
  state.hunger = clamp(state.hunger - 12)
  state.happiness = clamp(state.happiness + 5)

  const fresh = collectEgg(egg)

  animateAction('lay', 2000)
  say(fresh
    ? `NEW EGG! You collected ${egg.name} 🎉`
    : `${state.chickenName} laid another ${egg.name}. +20 coins!`)

  // Land the reveal as the dropped egg settles (eggDrop ends at 1.75s).
  revealShowTimer = window.setTimeout(() => showReveal({ ...egg, fresh }), 1800)
}

// --- EGGSCAPE mini-game -----------------------------------------------------
// A run costs energy up front and pays out on the results screen, so the runner is a
// reason to keep the chicken fed rather than a way to bypass the farm.
const RUN_ENERGY_COST = 15
const RUN_HUNGER_COST = 5
const RUN_MIN_ENERGY = 20
// Feed costs 20 coins, so the cap keeps a great run worth ~4 feeds and no more —
// the runner should top up the farm, not trivialise it.
const RUN_COIN_CAP = 80
const RUN_EGG_DROP_SCORE = 60

const eggscapeOpen = ref(false)
const canRunEggscape = computed(() => state.energy >= RUN_MIN_ENERGY)

function openEggscape() {
  if (!canRunEggscape.value) {
    return say(`${state.chickenName} is too tired for an EGGSCAPE run — try a nap. 💤`)
  }
  closeReveal()
  closeShop()
  eggscapeOpen.value = true
}

function closeEggscape() {
  eggscapeOpen.value = false
}

function onRunStart() {
  state.energy = clamp(state.energy - RUN_ENERGY_COST)
  state.hunger = clamp(state.hunger - RUN_HUNGER_COST)
  state.eggscape.runs++
}

function onRunEnd(result) {
  const payout = Math.min(RUN_COIN_CAP, Math.round(result.score / 4))
  state.coins += payout
  state.happiness = clamp(state.happiness + 8)

  const best = state.eggscape.best[result.worldId] || 0
  if (result.score > best) state.eggscape.best[result.worldId] = result.score

  if (result.score < RUN_EGG_DROP_SCORE) {
    return say(`EGGSCAPE run: ${result.score} points · +${payout} coins 🪙`)
  }

  // A strong run nudges the rarity roll, but only slightly — the ladder is still
  // mostly luck, exactly as it is when laying.
  const egg = randomEggOfRarity(rollEggRarity(Math.min(0.15, result.score / 1500)))
  const fresh = collectEgg(egg)

  say(fresh
    ? `EGGSCAPE run: ${result.score} points · +${payout} coins · NEW EGG ${egg.name} 🎉`
    : `EGGSCAPE run: ${result.score} points · +${payout} coins · another ${egg.name}`)

  // Close the overlay first — the reveal is teleported to <body> and would otherwise
  // stack behind the full-screen game.
  closeEggscape()
  revealShowTimer = window.setTimeout(() => showReveal({ ...egg, fresh }), 260)
}

const qrBusy = ref(false)

// Demo-only sequence: each tap pretends a carton was scanned. Valid codes are
// hashed in server/cartons.json; the last entry is unknown so the demo can
// show invalid / already-used. Grants restock feed and energy only (no coins, no IAP).
const DEMO_SCANS = ['CARTON-SHINE-01', 'CARTON-MOVE-01', 'CARTON-LAH-01', 'CARTON-FAKE-01']
let demoScanIndex = 0

async function scan() {
  if (qrBusy.value) return
  qrBusy.value = true
  try {
    const code = DEMO_SCANS[demoScanIndex % DEMO_SCANS.length]
    demoScanIndex++
    const result = await redeemCarton(code)
    if (!result.ok) return say(result.error)

    const food = Number.isFinite(result.reward?.food) ? Math.max(0, Math.floor(result.reward.food)) : 0
    const energy = Number.isFinite(result.reward?.energy) ? Math.max(0, Math.floor(result.reward.energy)) : 0
    if (food) state.food += food
    if (energy) state.energy = clamp(state.energy + energy)

    const bits = []
    if (food) bits.push(`+${food} feed`)
    if (energy) bits.push(`+${energy} energy`)
    say(`QR scanned: ${result.reward?.label || 'Restock'} unlocked!${bits.length ? ` ${bits.join(' · ')}` : ''} 📦`)
  } finally {
    qrBusy.value = false
  }
}

function reset() {
  // Sound is a device preference, not save data — carry it through the reset.
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultState(), muted: state.muted }))
  location.reload()
}

function owned(id) {
  return state.collection.includes(id)
}

function pct(value) {
  return { width: `${value}%` }
}

const stopSaving = watch(state, () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), { deep: true })
decay()
const decayTimer = window.setInterval(decay, 30000)
window.addEventListener('keydown', onKeydown)
onMounted(applyAudio)
onUnmounted(() => {
  window.clearInterval(decayTimer)
  window.clearTimeout(actionTimer)
  window.clearTimeout(revealShowTimer)
  window.clearTimeout(revealHideTimer)
  window.removeEventListener('keydown', onKeydown)
  armGesture.stop()
  bgm.value?.pause()
  stopSaving()
})
</script>

<template>
  <div class="app-shell">
    <header>
      <div class="brand">
        <div class="logo">🥚</div>
        <div><b>EGGbuddy</b><small>Raise • Feed • Collect</small></div>
      </div>
      <div class="header-actions">
        <button
          type="button"
          class="ghost mute-toggle"
          :aria-pressed="state.muted"
          :aria-label="state.muted ? 'Unmute music' : 'Mute music'"
          :title="state.muted ? 'Unmute music' : 'Mute music'"
          @click="toggleMute"
        >{{ state.muted ? '🔇' : '🔊' }}</button>
        <button type="button" class="ghost" @click="reset">Reset demo</button>
      </div>
    </header>

    <!-- Don't spend 1.4MB on someone who loaded the page muted; unmuting fetches it. -->
    <audio ref="bgm" :src="asset('bgm/bgm.mp3')" loop :preload="state.muted ? 'none' : 'auto'"></audio>

    <main>
      <section class="hero card">
        <div
          :class="['scene', `action-${activeAction}`]"
          :style="{ '--chicken-walk': chickenWalkImage }"
          aria-hidden="true"
        >
          <div class="sky-shine"></div>
          <div class="sun"></div>
          <div class="cloud-belt">
            <span></span><span></span><span></span><span></span>
          </div>
          <div class="far-hills"></div>

          <div class="farm-track">
            <div v-for="copy in 2" :key="copy" class="farm-strip">
              <div class="tree tree-one"><i></i></div>
              <div class="barn"><i></i><b></b></div>
              <div class="silo"></div>
              <div class="tree tree-two"><i></i></div>
              <div class="hay-bale"></div>
            </div>
          </div>

          <div class="fence-track"></div>
          <div class="walking-ground"></div>
          <div class="chicken-walker">
            <div :key="actionCycle" :class="['chicken-actor', `is-${activeAction}`]">
              <div class="chicken-shadow"></div>
              <div class="chicken-sprite"></div>
            </div>
          </div>

          <div :key="`effect-${actionCycle}`" class="action-effects">
            <div v-if="activeAction === 'feed'" class="action-effect feed-effect">
              <span class="effect-bubble">Yum!</span>
              <span class="feed-corn">🌽</span>
              <i v-for="crumb in 3" :key="crumb" :class="`crumb crumb-${crumb}`"></i>
            </div>

            <div v-else-if="activeAction === 'vitamin'" class="action-effect vitamin-effect">
              <span class="effect-bubble">Boost!</span>
              <span class="vitamin-pill">💊</span>
              <i v-for="sparkle in 4" :key="sparkle" :class="`sparkle sparkle-${sparkle}`">✦</i>
            </div>

            <div v-else-if="activeAction === 'play'" class="action-effect play-effect">
              <span class="effect-bubble">Wheee!</span>
              <span v-for="feather in 3" :key="feather" :class="`play-feather feather-${feather}`">🪶</span>
            </div>

            <div v-else-if="activeAction === 'nap'" class="action-effect nap-effect">
              <span class="dream-cloud"></span>
              <span class="sleep-z z-one">Z</span>
              <span class="sleep-z z-two">z</span>
              <span class="sleep-z z-three">z</span>
            </div>

            <div v-else-if="activeAction === 'lay'" class="action-effect lay-effect">
              <span class="effect-bubble">Pop!</span>
              <span class="laid-egg"></span>
              <i v-for="sparkle in 3" :key="sparkle" :class="`egg-spark egg-spark-${sparkle}`">✦</i>
            </div>

            <div v-else-if="activeAction === 'refuse'" class="action-effect refuse-effect">
              <span class="effect-bubble">Not now…</span>
              <span class="refuse-sign">🚫</span>
              <i v-for="drop in 2" :key="drop" :class="`sweat-drop sweat-drop-${drop}`">💧</i>
            </div>
          </div>
        </div>

        <div class="pet-panel">
          <div class="title-row">
            <div><span class="eyebrow">YOUR CHICKEN</span><h1>{{ state.chickenName }}</h1></div>
            <button
              type="button"
              class="coins"
              aria-haspopup="dialog"
              :aria-expanded="shopOpen"
              :aria-label="`Open shop — you have ${state.coins} coins`"
              title="Tap to spend your coins"
              @click="openShop"
            >🪙 {{ state.coins }}</button>
          </div>

          <div class="stats">
            <div><span>🌽 Fullness <b>{{ state.hunger }}%</b></span><i role="progressbar" aria-label="Fullness" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="state.hunger"><em :style="pct(state.hunger)"></em></i></div>
            <div><span>💛 Happiness <b>{{ state.happiness }}%</b></span><i role="progressbar" aria-label="Happiness" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="state.happiness"><em :style="pct(state.happiness)"></em></i></div>
            <div><span>⚡ Energy <b>{{ state.energy }}%</b></span><i role="progressbar" aria-label="Energy" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="state.energy"><em :style="pct(state.energy)"></em></i></div>
            <div><span>❤️ Health <b>{{ state.health }}%</b></span><i role="progressbar" aria-label="Health" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="state.health"><em :style="pct(state.health)"></em></i></div>
          </div>

          <div class="actions">
            <button type="button" @click="feed">🌽 Feed <small>x{{ state.food }}</small></button>
            <button type="button" @click="vitamin">💊 Vitamin <small>x{{ state.vitamins }}</small></button>
            <button type="button" @click="play">🪶 Play</button>
            <button type="button" @click="rest">💤 Nap</button>
            <button type="button" class="primary" @click="layEgg">🥚 Lay an Egg</button>
            <button
              type="button"
              class="primary play-eggscape"
              :title="canRunEggscape ? 'Play the EGGSCAPE runner' : 'Needs 20 energy'"
              @click="openEggscape"
            >🎮 Play EGGSCAPE <small>−{{ RUN_ENERGY_COST }}⚡</small></button>
          </div>
          <div class="message" role="status" aria-live="polite">{{ state.message }}</div>
        </div>
      </section>

      <section class="qr card">
        <div>
          <span class="eyebrow">REAL PRODUCT → DIGITAL REWARD</span>
          <h2>Scan your EGGbuddy QR</h2>
          <p>In production, each carton QR is unique and single-use. This demo pretends to scan one and restocks feed and energy — never coins, never pay in-app.</p>
        </div>
        <button type="button" class="scan" :disabled="qrBusy" @click="scan">
          ▦<span>{{ qrBusy ? 'Scanning…' : 'Scan demo QR' }}</span>
        </button>
      </section>

      <section class="collection card" aria-labelledby="collection-title">
        <div class="collection-head">
          <div>
            <span class="eyebrow">THE FIRST 10</span>
            <h2 id="collection-title">Egg Collection</h2>
            <p>{{ state.collection.length }} / 10 discovered · {{ state.eggsLaid }} eggs laid</p>
          </div>
          <div class="legend"><span>Common</span><span>Rare</span><span>Epic</span><span>Legendary</span></div>
        </div>

        <div class="grid" role="list" aria-label="Egg collectibles" tabindex="0">
          <article v-for="egg in eggs" :key="egg.id" role="listitem" :class="['egg-card', !owned(egg.id) && 'locked']">
            <div class="art">
              <img
                :src="asset(`eggs/${egg.image}`)"
                :alt="owned(egg.id) ? egg.name : 'Undiscovered egg'"
              >
              <div v-if="!owned(egg.id)" class="lock">?</div>
            </div>
            <h3>{{ owned(egg.id) ? egg.name : 'Mystery Egg' }}</h3>
            <span :class="['rarity', egg.rarity.toLowerCase()]">{{ owned(egg.id) ? egg.rarity : 'Undiscovered' }}</span>
          </article>
        </div>
      </section>
    </main>

    <footer>EGGbuddy V1 prototype · Progress is saved in this browser</footer>

    <Teleport to="body">
      <EggscapeOverlay
        v-if="eggscapeOpen"
        :bests="state.eggscape.best"
        :collection="state.collection"
        :can-run="canRunEggscape"
        :energy-cost="RUN_ENERGY_COST"
        @close="closeEggscape"
        @run-start="onRunStart"
        @run-end="onRunEnd"
      />
    </Teleport>

    <Teleport to="body">
      <Transition name="reveal">
        <div v-if="revealEgg" class="reveal-backdrop" @click="closeReveal">
          <div
            class="reveal-card"
            role="dialog"
            aria-modal="true"
            :aria-label="`${revealEgg.fresh ? 'New egg' : 'Duplicate egg'}: ${revealEgg.name}`"
            @click.stop
          >
            <span class="reveal-eyebrow">{{ revealEgg.fresh ? '✨ NEW EGG!' : 'ANOTHER ONE' }}</span>
            <div :class="['reveal-art', `aura-${revealEgg.rarity.toLowerCase()}`]">
              <img :src="asset(`eggs/${revealEgg.image}`)" alt="">
              <i v-for="s in 4" :key="s" :class="`reveal-spark spark-${s}`" aria-hidden="true">✦</i>
            </div>
            <h2>{{ revealEgg.name }}</h2>
            <span :class="['rarity', revealEgg.rarity.toLowerCase()]">{{ revealEgg.rarity }}</span>
            <p>{{ revealEgg.fresh ? 'Added to your collection!' : '+20 coins for the duplicate.' }}</p>
            <button ref="revealButton" type="button" class="primary" @click="closeReveal">Nice!</button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="reveal">
        <div v-if="shopOpen" class="reveal-backdrop" @click="closeShop">
          <div class="reveal-card shop-card" role="dialog" aria-modal="true" aria-label="Shop" @click.stop>
            <span class="reveal-eyebrow">🪙 {{ state.coins }} COINS</span>
            <h2>Shop</h2>

            <ul class="shop-list">
              <li v-for="item in shopItems" :key="item.key" class="shop-row">
                <span class="shop-icon" aria-hidden="true">{{ item.icon }}</span>
                <div class="shop-info">
                  <b>{{ item.name }}</b>
                  <small>{{ item.effect }}</small>
                </div>
                <span class="shop-qty" :title="`You own ${state[item.key]} ${item.name}`">×{{ state[item.key] }}</span>
                <div class="shop-actions">
                  <button
                    type="button"
                    class="shop-buy"
                    :disabled="state.coins < item.price"
                    :aria-label="`Buy one ${item.name} for ${item.price} coins`"
                    @click="buy(item)"
                  >Buy 🪙{{ item.price }}</button>
                  <button
                    type="button"
                    class="shop-buy shop-sell"
                    :disabled="!state[item.key]"
                    :aria-label="`Sell one ${item.name} for ${item.sell} coins`"
                    @click="sell(item)"
                  >Sell 🪙{{ item.sell }}</button>
                </div>
              </li>
            </ul>

            <p>Lay eggs to earn coins — duplicates pay 20.</p>
            <button ref="shopCloseButton" type="button" class="primary" @click="closeShop">Done</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
