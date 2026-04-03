/**
 * Inngest Function: Glofox Booking Cancel Write-back
 *
 * Fires when a booking is cancelled in Meridian. Cancels the corresponding
 * booking in Glofox via DELETE 2.3/branches/{branchId}/bookings/{bookingId}.
 *
 * Fire-and-forget: Supabase is already updated before this runs.
 * Failures are logged to glofox_sync_conflicts via onFailure.
 */
import { inngest } from '@/lib/inngest/client'
import { getAdminClient } from '@/lib/inngest/helpers'
import { GlofoxClient } from '@/lib/glofox/client'

export const glofoxCancelBooking = inngest.createFunction(
  {
    id: 'glofox-cancel-booking',
    name: 'Glofox Booking Cancel Write-back',
    retries: 3,
    triggers: [{ event: 'glofox/cancel-booking' }],
    onFailure: async ({ event, error, step }) => {
      const originalData = (event.data as { event: { data: {
        booking_id: string
        glofox_booking_id: string
        studio_id: string
      } } }).event.data

      const { booking_id, glofox_booking_id, studio_id } = originalData

      await step.run('log-cancel-booking-failure', async () => {
        const db = getAdminClient()
        await db.from('glofox_sync_conflicts').insert({
          studio_id,
          entity_type: 'booking',
          entity_id: booking_id,
          glofox_id: glofox_booking_id,
          conflict_type: 'cancel_write_back_failed',
          glofox_data: {
            glofox_booking_id,
            error: error.message,
          },
          meridian_data: { booking_id },
        })

        // Update booking row with failure status for audit trail
        await db
          .from('bookings')
          .update({
            glofox_write_status: 'cancel_failed',
            glofox_write_error: error.message,
          })
          .eq('id', booking_id)
      })
    },
  },
  async ({ event, step }) => {
    const { booking_id, glofox_booking_id } = event.data

    const result = await step.run('cancel-booking-in-glofox', async () => {
      const glofox = new GlofoxClient()
      // Uses this.branchId from GlofoxClient constructor (env-based)
      const response = await glofox.cancelBooking(glofox_booking_id)
      return {
        status: 'success' as const,
        glofox_booking_id,
        booking_id,
        response,
      }
    })

    return result
  },
)
