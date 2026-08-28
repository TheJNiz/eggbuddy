// Client for the carton redeem stub. Valid codes are hashed on the server
// (server/cartons.json) — this module never lists them.

const ENDPOINTS = ['/api/qr/redeem', `${import.meta.env.BASE_URL}api/qr/redeem`]

export async function redeemCarton(code) {
  const body = JSON.stringify({ code: String(code ?? '').trim() })
  let lastError = 'Redeem is unavailable. The carton server is not running on this host.'

  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      const data = await res.json().catch(() => null)
      // HTML 404 (API not mounted) has no JSON body — try the next path.
      // A JSON error (unknown / already used) is the server answering: stop.
      if (!data || typeof data !== 'object') continue
      if (data.ok) return { ok: true, reward: data.reward }
      return { ok: false, error: data.error || `Redeem failed (${res.status}).` }
    } catch {
      // Try the BASE_URL-prefixed path next (vite --base).
    }
  }

  return { ok: false, error: lastError }
}
