/**
 * Inngest Function: Glofox Attendance Write-back
 *
 * Fires when a member checks in via Meridian. Marks the corresponding
 * Glofox booking as attended via POST 2.0/attendances.
 *
 * Fire-and-forget: Supabase is already updated before this runs.
 * Failures are logged to glofox_sync_conflicts via onFailure, never surfaced to the user.
 */
import { inngest } from '@/lib/inngest/client'
import { getAdminClient } from '@/lib/inngest/helpers'
import { GlofoxClient } from '@/lib/glofox/client'

export const glofoxMarkAttendance = inngest.createFunction(
  {
    id: 'glofox-mark-attendance',
    name: 'Glofox Attendance Write-back',
    retries: 3,
    triggers: [{ event: 'glofox/mark-attendance' }],
    onFailure: async ({ event, error, step }) => {
      // Runs once after ALL retries exhausted — safe to log the conflict
      const originalData = (event.data as { event: { data: {
        booking_id: string
        glofox_booking_id: string
        glofox_user_id: string
        studio_id: string
      } } }).event.data

      const { booking_id, glofox_booking_id, glofox_user_id, studio_id } = originalData

      await step.run('log-attendance-failure', async () => {
        const db = getAdminClient()
        await db.from('glofox_sync_conflicts').insert({
          studio_id,
          entity_type: 'attendance',
          entity_id: booking_id,
          glofox_id: glofox_booking_id,
          conflict_type: 'write_back_failed',
          glofox_data: {
            glofox_booking_id,
            glofox_user_id,
            error: error.message,
          },
          meridian_data: { booking_id },
        })
      })
    },
  },
  async ({ event, step }) => {
    // Feature flag: gate Glofox write-back behind env var
    if (process.env.GLOFOX_WRITE_BACK_ENABLED !== 'true') {
      return { status: 'skipped' as const, reason: 'GLOFOX_WRITE_BACK_ENABLED is not true' }
    }

    const { glofox_booking_id, glofox_user_id } = event.data

    const result = await step.run('mark-attendance-in-glofox', async () => {
      const glofox = new GlofoxClient()
      const response = await glofox.markAttendance(glofox_booking_id, glofox_user_id)
      return { status: 'success' as const, glofox_booking_id, response }
    })

    return result
  },
)
