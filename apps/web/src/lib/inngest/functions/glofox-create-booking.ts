/**
 * Inngest Function: Glofox Booking Create Write-back
 *
 * Fires when a booking is created in Meridian. Creates the corresponding
 * booking in Glofox via POST 2.3/branches/{branchId}/bookings.
 *
 * Fire-and-forget: Supabase is already updated before this runs.
 * On success, stores the returned glofox_id on the booking row
 * so the hourly sync doesn't re-import it as a duplicate.
 * Failures are logged to glofox_sync_conflicts via onFailure.
 */
import { inngest } from '@/lib/inngest/client'
import { getAdminClient } from '@/lib/inngest/helpers'
import { GlofoxClient } from '@/lib/glofox/client'

export const glofoxCreateBooking = inngest.createFunction(
  {
    id: 'glofox-create-booking',
    name: 'Glofox Booking Create Write-back',
    retries: 3,
    triggers: [{ event: 'glofox/create-booking' }],
    onFailure: async ({ event, error, step }) => {
      const originalData = (event.data as { event: { data: {
        booking_id: string
        glofox_event_id: string
        glofox_user_id: string
        studio_id: string
      } } }).event.data

      const { booking_id, glofox_event_id, glofox_user_id, studio_id } = originalData

      await step.run('log-create-booking-failure', async () => {
        const db = getAdminClient()
        await db.from('glofox_sync_conflicts').insert({
          studio_id,
          entity_type: 'booking',
          entity_id: booking_id,
          glofox_id: glofox_event_id,
          conflict_type: 'write_back_failed',
          glofox_data: {
            glofox_event_id,
            glofox_user_id,
            error: error.message,
          },
          meridian_data: { booking_id },
        })

        // Mark booking write status as failed
        await db
          .from('bookings')
          .update({ glofox_write_status: 'failed', glofox_write_error: error.message })
          .eq('id', booking_id)
      })
    },
  },
  async ({ event, step }) => {
    // Feature flag: gate Glofox write-back behind env var
    if (process.env.GLOFOX_WRITE_BACK_ENABLED !== 'true') {
      return { status: 'skipped' as const, reason: 'GLOFOX_WRITE_BACK_ENABLED is not true' }
    }

    const { booking_id, glofox_event_id, glofox_user_id, studio_id } = event.data

    const result = await step.run('create-booking-in-glofox', async () => {
      const glofox = new GlofoxClient()
      const response = await glofox.createBooking({
        model: 'event',
        model_id: glofox_event_id,
        user_id: glofox_user_id,
      })

      // Store the returned glofox_id so hourly sync doesn't duplicate
      const glofoxBookingId = response._id ?? response.booking?._id
      if (!glofoxBookingId) {
        throw new Error(
          `Glofox createBooking succeeded but returned no _id. Response: ${JSON.stringify(response)}`,
        )
      }

      const db = getAdminClient()
      await db
        .from('bookings')
        .update({
          glofox_id: glofoxBookingId,
          glofox_write_status: 'synced',
          glofox_write_error: null,
        })
        .eq('id', booking_id)

      return {
        status: 'success' as const,
        glofox_booking_id: glofoxBookingId,
        booking_id,
      }
    })

    return result
  },
)
