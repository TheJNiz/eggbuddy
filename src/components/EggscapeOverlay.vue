<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { asset } from '../assets.js'
import { worlds, worldEgg, worldIsLocked } from '../game/worlds.js'

const props = defineProps({
  bests: { type: Object, required: true },
  collection: { type: Array, required: true },
  canRun: { type: Boolean, required: true },
  energyCost: { type: Number, required: true },
})

const emit = defineEmits(['close', 'run-start', 'run-end'])

// 'select' | 'loading' | 'play' | 'results'
const phase = ref('select')
const paused = ref(false)
const activeWorld = shallowRef(null)
const summary = ref(null)
const canvasHost = ref(null)
const shell = ref(null)

// The results panel normally replaces the canvas 750ms after the egg dies, which is too
// fast to screenshot the frame that caused the death. Under ?hopdebug the final frame is
// held instead, and the results are one click away.
const holdOnEnd = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('hopdebug')
const held = ref(false)

// Phaser instances are big and self-managing — reactivity would only cost proxy
// overhead and risk Vue walking the whole scene graph.
let runner = null
let disposed = false

const bestFor = (world) => props.bests[world.id] || 0
const owned = (world) => props.collection.includes(world.eggId)
const locked = (world) => worldIsLocked(world, props.collection)
const eggArt = (world) => asset(`eggs/${worldEgg(world).image}`)

const newBest = computed(() =>
  summary.value ? summary.value.score > (props.bests[summary.value.worldId] || 0) : false)

function focusFirst() {
  nextTick(() => shell.value?.querySelector('button:not([disabled])')?.focus())
}

async function choose(world) {
  if (!props.canRun || locked(world)) return
  activeWorld.value = world
  phase.value = 'loading'

  const { createGame } = await import('../game/createGame.js')
  // The overlay can be closed during that import; without this the game would mount
  // a canvas into a detached node and leak.
  if (disposed || phase.value !== 'loading') return

  phase.value = 'play'
  await nextTick()
  if (disposed || !canvasHost.value) return

  runner = createGame({
    parent: canvasHost.value,
    world,
    best: bestFor(world),
    onRunEnd: handleRunEnd,
    onPause: () => {
      if (phase.value === 'play' && !paused.value) togglePause()
    },
  })

  // Charged only once the run genuinely exists, so a failed load never costs energy.
  emit('run-start', world)
}

function handleRunEnd(result) {
  if (disposed) return
  summary.value = result
  emit('run-end', result)
  // Freeze on the last rendered frame; the scene is already in its 'over' phase, so
  // leaving the runner alive costs nothing but keeps the canvas on screen.
  if (holdOnEnd) {
    held.value = true
    return
  }
  phase.value = 'results'
  teardown()
  focusFirst()
}

function revealHeldResults() {
  held.value = false
  phase.value = 'results'
  teardown()
  focusFirst()
}

function teardown() {
  runner?.destroy()
  runner = null
  paused.value = false
  held.value = false
}

function togglePause() {
  if (phase.value !== 'play' || held.value) return
  paused.value = !paused.value
  if (paused.value) runner?.pause()
  else runner?.resume()
}

function quitRun() {
  teardown()
  phase.value = 'select'
  activeWorld.value = null
  focusFirst()
}

function playAgain() {
  const world = activeWorld.value
  summary.value = null
  if (world) choose(world)
}

function backToSelect() {
  summary.value = null
  phase.value = 'select'
  activeWorld.value = null
  focusFirst()
}

function close() {
  teardown()
  emit('close')
}

// Escape pauses mid-run rather than quitting — losing a run to a stray keypress is
// worse than an extra click. Captured so App.vue's own Escape handler doesn't also fire.
function onKeydown(event) {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  if (held.value) revealHeldResults()
  else if (phase.value === 'play') togglePause()
  else if (phase.value === 'results') backToSelect()
  else close()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown, true)
  // Without this, dragging on a phone scrolls the farm behind the full-screen game.
  document.body.style.overflow = 'hidden'
  focusFirst()
})

onUnmounted(() => {
  disposed = true
  window.removeEventListener('keydown', onKeydown, true)
  document.body.style.overflow = ''
  teardown()
})
</script>

<template>
  <div class="eggscape-backdrop" role="dialog" aria-modal="true" aria-label="EGGSCAPE mini-game">
    <div ref="shell" class="eggscape-shell">
      <header class="eggscape-bar">
        <div class="eggscape-brand">
          <b>EGGSCAPE</b>
          <small>{{ activeWorld ? activeWorld.subtitle : 'Pick your buddy' }}</small>
        </div>
        <div class="eggscape-bar-actions">
          <button
            v-if="phase === 'play' && !held"
            type="button"
            class="ghost"
            :aria-pressed="paused"
            @click="togglePause"
          >{{ paused ? '▶ Resume' : '⏸ Pause' }}</button>
          <button type="button" class="ghost" @click="close">✕ Back to farm</button>
        </div>
      </header>

      <!-- SELECT -->
      <div v-if="phase === 'select'" class="eggscape-select">
        <p class="eggscape-lede">
          One tap to jump. Clear hazards, chain combos, collect golden eggs — a run costs
          <b>{{ energyCost }} energy</b> and pays out in coins.
        </p>
        <p v-if="!canRun" class="eggscape-warning" role="status">
          Your chicken is too tired for a run. Take a 💤 nap first.
        </p>

        <div class="world-grid">
          <button
            v-for="world in worlds"
            :key="world.id"
            type="button"
            :class="['world-card', locked(world) && 'is-locked']"
            :disabled="!canRun || locked(world)"
            :title="locked(world) ? `Collect ${worldEgg(world).name} to unlock this world` : undefined"
            @click="choose(world)"
          >
            <span class="world-art"><img :src="eggArt(world)" alt=""></span>
            <b>{{ world.title }}</b>
            <small>{{ world.subtitle }}</small>
            <span class="world-power">⚡ {{ world.power.name }}</span>
            <span class="world-meta">
              <i>Best {{ bestFor(world) }}</i>
              <i :class="locked(world) ? 'is-locked' : (owned(world) ? 'is-owned' : 'is-open')">
                {{ locked(world) ? `Needs ${worldEgg(world).name}` : (owned(world) ? 'Collected ✓' : 'Open') }}
              </i>
            </span>
          </button>
        </div>
      </div>

      <!-- LOADING / PLAY -->
      <div v-show="phase === 'loading' || phase === 'play'" class="eggscape-stage">
        <div ref="canvasHost" class="eggscape-canvas"></div>
        <p v-if="phase === 'loading'" class="eggscape-loading">Hatching the world…</p>
        <div v-if="paused" class="eggscape-paused">
          <b>Paused</b>
          <div>
            <button type="button" class="primary" @click="togglePause">Resume</button>
            <button type="button" class="ghost" @click="quitRun">Quit run</button>
          </div>
        </div>
        <div v-if="held" class="eggscape-held" role="status">
          <span>Frame held for debugging · {{ summary?.score ?? 0 }} points</span>
          <button type="button" class="primary" @click="revealHeldResults">Show results</button>
        </div>
      </div>

      <!-- RESULTS -->
      <div v-if="phase === 'results' && summary" class="eggscape-results">
        <span class="reveal-eyebrow">{{ newBest ? '🏆 NEW BEST!' : 'RUN COMPLETE' }}</span>
        <h2>{{ summary.score }} points</h2>

        <ul class="result-rows">
          <li><span>Golden eggs</span><b>{{ summary.coinsCollected }}</b></li>
          <li><span>Perfect clears</span><b>{{ summary.perfects }}</b></li>
          <li><span>Best combo</span><b>×{{ summary.maxCombo }}</b></li>
          <li><span>Time on the run</span><b>{{ Math.round(summary.durationMs / 1000) }}s</b></li>
        </ul>

        <div class="result-actions">
          <button type="button" class="primary" :disabled="!canRun" @click="playAgain">Run again</button>
          <button type="button" class="ghost" @click="backToSelect">Change buddy</button>
          <button type="button" class="ghost" @click="close">Back to farm</button>
        </div>
      </div>
    </div>
  </div>
</template>
