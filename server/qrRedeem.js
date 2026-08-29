import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const CARTONS_PATH = path.join(dir, 'cartons.json')
const REDEMPTIONS_PATH = path.join(dir, '.redemptions.json')

function loadJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function hashCode(code) {
  return createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex')
}

const cartons = new Map(
  (loadJson(CARTONS_PATH, { cartons: [] }).cartons || []).map((row) => [row.hash, row]),
)

const redemptions = new Map(
  Object.entries(loadJson(REDEMPTIONS_PATH, {})),
)

function persistRedemptions() {
  writeFileSync(REDEMPTIONS_PATH, JSON.stringify(Object.fromEntries(redemptions), null, 2))
}

// Unique, single-use carton redeem. Valid codes live here as hashes, never in
// the Vue bundle. Rewards restock scarce feed / energy — no coins, no IAP.
export function redeem(code) {
  const trimmed = String(code ?? '').trim()
  if (!trimmed) {
    return { status: 400, body: { ok: false, error: 'Enter the code printed on your carton.' } }
  }

  const hash = hashCode(trimmed)
  const carton = cartons.get(hash)
  if (!carton) {
    return { status: 404, body: { ok: false, error: 'This code is not a valid EGGbuddy carton.' } }
  }

  if (redemptions.has(hash)) {
    return { status: 409, body: { ok: false, error: 'This carton has already been redeemed.' } }
  }

  redemptions.set(hash, { redeemedAt: new Date().toISOString() })
  try {
    persistRedemptions()
  } catch {
    // Still grant this process — uniqueness holds in memory for the session.
  }

  const { food = 0, energy = 0, label = 'Carton restock' } = carton.reward || {}
  return {
    status: 200,
    body: {
      ok: true,
      reward: {
        food: Math.max(0, Math.floor(Number(food) || 0)),
        energy: Math.max(0, Math.floor(Number(energy) || 0)),
        label: String(label),
      },
    },
  }
}

export async function handleRedeemRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: false, error: 'POST a carton code to redeem.' }))
    return
  }

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)

  let payload = {}
  try {
    const raw = Buffer.concat(chunks).toString('utf8')
    payload = raw ? JSON.parse(raw) : {}
  } catch {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: false, error: 'Carton code must be JSON: { "code": "..." }.' }))
    return
  }

  const result = redeem(payload.code)
  res.statusCode = result.status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(result.body))
}
