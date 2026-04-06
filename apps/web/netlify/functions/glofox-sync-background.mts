/**
 * Netlify Background Scheduled Function: Glofox Hourly Sync
 *
 * The "-background" suffix gives this function a 15-minute timeout.
 * Calls POST /api/glofox/sync which streams NDJSON progress lines.
 *
 * Required env vars:
 *   - CRON_SECRET
 *   - URL (auto-set by Netlify)
 */
import type { Config } from '@netlify/functions'

export default async () => {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL
  if (!siteUrl) {
    console.error('[glofox-sync] No site URL available')
    return
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[glofox-sync] CRON_SECRET not configured')
    return
  }

  console.log(`[glofox-sync] Triggering sync at ${siteUrl}/api/glofox/sync`)

  try {
    const res = await fetch(`${siteUrl}/api/glofox/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    })

    // Read the NDJSON stream line by line
    const text = await res.text()
    const lines = text.trim().split('\n').filter(Boolean)

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        if (parsed.progress) console.log(`[sync] ${parsed.progress}`)
        if (parsed.result) {
          console.log(`[glofox-sync] DONE: ${parsed.result.status} — ` +
            `fetched=${parsed.result.summary?.fetched ?? 0}, ` +
            `created=${parsed.result.summary?.created ?? 0}, ` +
            `errors=${parsed.result.summary?.errors ?? 0}, ` +
            `duration=${parsed.result.duration_ms ?? 0}ms`)
        }
        if (parsed.error) console.error(`[glofox-sync] ERROR: ${parsed.error}`)
      } catch { /* ignore parse errors */ }
    }

    if (!res.ok) {
      console.error(`[glofox-sync] HTTP ${res.status}`)
    }
  } catch (err) {
    console.error('[glofox-sync] Request failed:', err)
  }
}

export const config: Config = {
  schedule: '0 * * * *',
}
