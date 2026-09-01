// Demo carton redeem — fully client-side so GitHub Pages can run it.
// Production would hash unique codes on a backend. This catalog is the
// demo sequence only; used codes persist in localStorage until Reset demo.

const REDEEM_KEY = 'eggbuddy-qr-demo'

const CARTONS = {
  'CARTON-SHINE-01': { food: 2, energy: 20, label: 'Farm restock' },
  'CARTON-MOVE-01': { food: 2, energy: 20, label: 'Farm restock' },
  'CARTON-LAH-01': { food: 3, energy: 25, label: 'Premium carton restock' },
}

function loadUsed() {
  try {
    const raw = JSON.parse(localStorage.getItem(REDEEM_KEY) || '[]')
    return new Set(Array.isArray(raw) ? raw.map(String) : [])
  } catch {
    return new Set()
  }
}

function saveUsed(used) {
  localStorage.setItem(REDEEM_KEY, JSON.stringify([...used]))
}

export function resetDemoRedemptions() {
  localStorage.removeItem(REDEEM_KEY)
}

export function redeemCarton(code) {
  const trimmed = String(code ?? '').trim().toUpperCase()
  if (!trimmed) {
    return { ok: false, error: 'Enter the code printed on your carton.' }
  }

  const carton = CARTONS[trimmed]
  if (!carton) {
    return { ok: false, error: 'This code is not a valid EGGbuddy carton.' }
  }

  const used = loadUsed()
  if (used.has(trimmed)) {
    return { ok: false, error: 'This carton has already been redeemed.' }
  }

  used.add(trimmed)
  saveUsed(used)
  return { ok: true, reward: { ...carton } }
}
