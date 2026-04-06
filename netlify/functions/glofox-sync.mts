/**
 * Netlify Scheduled Function: Glofox Hourly Sync
 *
 * Calls the Next.js API route POST /api/glofox/sync every hour.
 * The actual sync logic lives in the route handler — this function
 * is just a cron trigger.
 *
 * Required env vars (set in Netlify dashboard):
 *   - CRON_SECRET: shared secret for authenticating cron requests
 *   - URL: automatically set by Netlify to the site's primary URL
 */
import type { Config } from '@netlify/functions'

export default async () => {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL
  if (!siteUrl) {
    console.error('[glofox-sync] No site URL available (URL / DEPLOY_PRIME_URL)')
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

    const data = await res.json()
    console.log(
      `[glofox-sync] ${res.status} — ${data.status ?? 'unknown'} — ` +
        `fetched=${data.summary?.fetched ?? 0}, ` +
        `created=${data.summary?.created ?? 0}, ` +
        `updated=${data.summary?.updated ?? 0}, ` +
        `errors=${data.summary?.errors ?? 0}, ` +
        `duration=${data.duration_ms ?? 0}ms`,
    )

    if (!res.ok) {
      console.error('[glofox-sync] Sync failed:', JSON.stringify(data))
    }
  } catch (err) {
    console.error('[glofox-sync] Request failed:', err)
  }
}

export const config: Config = {
  schedule: '0 * * * *', // Every hour, on the hour
}
