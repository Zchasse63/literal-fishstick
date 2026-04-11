import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { normalizePhone } from '@/lib/validation'

const ALLOWED_ROLES = ['owner', 'manager']
const BATCH_SIZE = 100

// ─── CSV Parsing ─────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function normalizeDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (usMatch) {
    const [, month, day, year] = usMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return null
}

function normalizeAmount(value: string): number {
  return parseFloat(value.replace(/[$,\s]/g, '')) || 0
}

// ─── Table Mapping ───────────────────────────────────────────

type DataType = 'members' | 'bookings' | 'transactions' | 'classes'

const TABLE_MAP: Record<DataType, string> = {
  members: 'profiles',
  bookings: 'bookings',
  transactions: 'transactions',
  classes: 'classes',
}

/**
 * POST /api/migration/import
 *
 * Start a migration import job.
 * Body: { file_url, data_type, wave }
 *
 * - Checks for concurrent active jobs for the same studio + data_type (409)
 * - Creates migration_job row
 * - Processes CSV rows in batches of 100
 * - Tags all inserted rows with migration_job_id
 * - Updates migration_job progress as it goes
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // ─── Auth ──────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID

    // ─── Parse Body ──────────────────────────────────────────
    const body = await request.json()
    const { file_url, data_type, wave } = body as {
      file_url: string
      data_type: DataType
      wave?: number
    }

    if (!file_url || !data_type) {
      return NextResponse.json(
        { error: 'file_url and data_type are required' },
        { status: 400 }
      )
    }

    const validTypes: DataType[] = ['members', 'bookings', 'transactions', 'classes']
    if (!validTypes.includes(data_type)) {
      return NextResponse.json(
        { error: `data_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // ─── Concurrent Prevention ───────────────────────────────
    const { data: activeJobs } = await supabase
      .from('migration_jobs')
      .select('id, status')
      .eq('studio_id', studioId)
      .eq('data_type', data_type)
      .in('status', ['importing', 'validating'])

    if (activeJobs && activeJobs.length > 0) {
      return NextResponse.json(
        {
          error: `An active ${data_type} import job is already running. Wait for it to complete before starting a new one.`,
          active_job_id: activeJobs[0].id,
        },
        { status: 409 }
      )
    }

    // ─── Download File ───────────────────────────────────────
    const bucketName = 'migration-uploads'
    const pathMatch = file_url.match(new RegExp(`${bucketName}/(.+)$`))
    const storagePath = pathMatch ? pathMatch[1] : null

    if (!storagePath) {
      return NextResponse.json(
        { error: 'Invalid file_url' },
        { status: 400 }
      )
    }

    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from(bucketName)
      .download(storagePath)

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: `Failed to download file: ${downloadError?.message ?? 'File not found'}` },
        { status: 404 }
      )
    }

    const text = await fileData.text()
    const lines = text.split('\n').filter((line) => line.trim().length > 0)

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV must have a header row and at least one data row' },
        { status: 400 }
      )
    }

    const headers = parseCSVLine(lines[0]).map((h) =>
      h.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    )

    const dataRows = lines.slice(1)
    const sourceRowCount = dataRows.length

    // ─── Create Migration Job ────────────────────────────────
    const { data: job, error: jobError } = await supabase
      .from('migration_jobs')
      .insert({
        studio_id: studioId,
        data_type,
        file_url,
        wave: wave ?? 1,
        source_row_count: sourceRowCount,
        processed_count: 0,
        success_count: 0,
        error_count: 0,
        errors: [],
        status: 'importing',
        started_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { error: `Failed to create migration job: ${jobError?.message}` },
        { status: 500 }
      )
    }

    const targetTable = TABLE_MAP[data_type]
    const errors: { row: number; error: string }[] = []
    let successCount = 0
    let processedCount = 0

    // ─── Process in Batches ──────────────────────────────────
    for (let batch = 0; batch < dataRows.length; batch += BATCH_SIZE) {
      const batchRows = dataRows.slice(batch, batch + BATCH_SIZE)
      const insertRows: Record<string, unknown>[] = []

      for (let i = 0; i < batchRows.length; i++) {
        const rowIndex = batch + i + 1 // 1-indexed, accounting for header
        const values = parseCSVLine(batchRows[i])
        const row: Record<string, string> = {}

        for (let j = 0; j < headers.length; j++) {
          row[headers[j]] = values[j] ?? ''
        }

        try {
          const mapped = mapRowToTable(data_type, row, studioId, job.id, wave ?? 1)
          if (mapped) {
            insertRows.push(mapped)
          }
        } catch (mapErr) {
          errors.push({
            row: rowIndex,
            error: mapErr instanceof Error ? mapErr.message : 'Unknown mapping error',
          })
        }
      }

      // Bulk insert the batch
      if (insertRows.length > 0) {
        const { error: insertError, count } = await supabase
          .from(targetTable)
          .insert(insertRows, { count: 'exact' })

        if (insertError) {
          // If bulk fails, try one by one
          for (let i = 0; i < insertRows.length; i++) {
            const { error: singleError } = await supabase
              .from(targetTable)
              .insert(insertRows[i])

            if (singleError) {
              errors.push({
                row: batch + i + 1,
                error: singleError.message,
              })
            } else {
              successCount++
            }
          }
        } else {
          successCount += count ?? insertRows.length
        }
      }

      processedCount += batchRows.length

      // Update job progress
      await supabase
        .from('migration_jobs')
        .update({
          processed_count: processedCount,
          success_count: successCount,
          error_count: errors.length,
          errors,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
    }

    // ─── Finalize Job ────────────────────────────────────────
    const finalStatus = errors.length === 0 ? 'completed' : 'completed_with_errors'

    const { data: finalJob, error: finalError } = await supabase
      .from('migration_jobs')
      .update({
        status: finalStatus,
        processed_count: processedCount,
        success_count: successCount,
        error_count: errors.length,
        errors,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .select()
      .single()

    if (finalError) {
      console.error('Failed to finalize migration job:', finalError)
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      type: 'migration_import_completed',
      subject_type: 'migration_job',
      subject_id: job.id,
      metadata: {
        data_type,
        wave: wave ?? 1,
        source_row_count: sourceRowCount,
        success_count: successCount,
        error_count: errors.length,
        status: finalStatus,
      },
    })

    return NextResponse.json({
      data: {
        ...(finalJob ?? job),
        progress_pct: sourceRowCount > 0
          ? Math.round((processedCount / sourceRowCount) * 100)
          : 0,
      },
    }, { status: 201 })
  } catch (err) {
    console.error('POST /api/migration/import error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Row Mapping ─────────────────────────────────────────────

function mapRowToTable(
  dataType: DataType,
  row: Record<string, string>,
  studioId: string,
  migrationJobId: string,
  wave: number,
): Record<string, unknown> {
  switch (dataType) {
    case 'members':
      return {
        studio_id: studioId,
        email: (row['email'] ?? '').trim().toLowerCase(),
        first_name: row['first_name'] ?? row['firstname'] ?? '',
        last_name: row['last_name'] ?? row['lastname'] ?? '',
        phone: normalizePhone(row['phone'] ?? row['phone_number']) ?? null,
        membership_status: row['status'] ?? 'active',
        join_date: normalizeDate(row['join_date'] ?? row['created_at'] ?? '') ?? new Date().toISOString().slice(0, 10),
        migration_job_id: migrationJobId,
        migration_wave: wave,
        source: 'glofox',
      }
    case 'bookings':
      return {
        studio_id: studioId,
        member_email: (row['member_email'] ?? row['email'] ?? '').trim().toLowerCase(),
        class_name: row['class_name'] ?? row['class'] ?? '',
        date: normalizeDate(row['date'] ?? row['booking_date'] ?? '') ?? null,
        // F2 fix: 'confirmed' was a phantom enum value (the bookings_status_check
        // enum allows 'booked', 'checked_in', etc — never 'confirmed').
        status: row['status'] ?? 'booked',
        migration_job_id: migrationJobId,
        source: 'glofox',
      }
    case 'transactions':
      return {
        studio_id: studioId,
        member_email: (row['member_email'] ?? row['email'] ?? '').trim().toLowerCase(),
        amount: normalizeAmount(row['amount'] ?? '0'),
        type: row['type'] ?? row['transaction_type'] ?? 'membership',
        status: 'completed',
        created_at: normalizeDate(row['date'] ?? row['created_at'] ?? '') ?? new Date().toISOString(),
        migration_job_id: migrationJobId,
        source: 'glofox',
      }
    case 'classes':
      return {
        studio_id: studioId,
        name: row['name'] ?? row['class_name'] ?? '',
        date: normalizeDate(row['date'] ?? '') ?? null,
        start_time: row['start_time'] ?? null,
        end_time: row['end_time'] ?? null,
        capacity: parseInt(row['capacity'] ?? '12', 10),
        instructor_name: row['instructor'] ?? row['trainer'] ?? null,
        migration_job_id: migrationJobId,
        source: 'glofox',
      }
    default:
      throw new Error(`Unknown data type: ${dataType}`)
  }
}
