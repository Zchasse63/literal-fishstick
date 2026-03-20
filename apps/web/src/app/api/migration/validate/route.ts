import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['owner', 'manager']

// ─── Validation Rules ────────────────────────────────────────

interface ValidationIssue {
  row: number
  field: string
  error: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const REQUIRED_FIELDS_BY_TYPE: Record<string, string[]> = {
  members: ['email', 'first_name', 'last_name'],
  bookings: ['member_email', 'class_name', 'date'],
  transactions: ['member_email', 'amount', 'date', 'type'],
  classes: ['name', 'date', 'start_time', 'end_time'],
}

function normalizeDate(value: string): string | null {
  // Try common date formats
  const formats = [
    // ISO
    /^\d{4}-\d{2}-\d{2}/,
    // US: MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    // EU: DD/MM/YYYY
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})/,
  ]

  if (formats[0].test(value)) return value.slice(0, 10)

  const usMatch = value.match(formats[1])
  if (usMatch) {
    const [, month, day, year] = usMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const euMatch = value.match(formats[2])
  if (euMatch) {
    const [, day, month, year] = euMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return null
}

function normalizeAmount(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

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

/**
 * POST /api/migration/validate
 *
 * Validate an uploaded CSV (dry run).
 * Body: { file_url, data_type }
 * Does NOT insert any data.
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
    const { file_url, data_type } = body as {
      file_url: string
      data_type: string
    }

    if (!file_url || !data_type) {
      return NextResponse.json(
        { error: 'file_url and data_type are required' },
        { status: 400 }
      )
    }

    const validTypes = ['members', 'bookings', 'transactions', 'classes']
    if (!validTypes.includes(data_type)) {
      return NextResponse.json(
        { error: `data_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // ─── Download File from Storage ──────────────────────────
    // Extract storage path from URL
    const bucketName = 'migration-uploads'
    const pathMatch = file_url.match(new RegExp(`${bucketName}/(.+)$`))
    const storagePath = pathMatch ? pathMatch[1] : null

    if (!storagePath) {
      return NextResponse.json(
        { error: 'Invalid file_url — could not extract storage path' },
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

    // ─── Parse Header ────────────────────────────────────────
    const headers = parseCSVLine(lines[0]).map((h) =>
      h.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    )

    const requiredFields = REQUIRED_FIELDS_BY_TYPE[data_type] ?? []

    // Check that required columns exist
    const missingColumns = requiredFields.filter((f) => !headers.includes(f))
    if (missingColumns.length > 0) {
      return NextResponse.json({
        valid_rows: 0,
        invalid_rows: lines.length - 1,
        issues: [{
          row: 0,
          field: missingColumns.join(', '),
          error: `Missing required column(s): ${missingColumns.join(', ')}`,
        }],
        sample_data: [],
      })
    }

    // ─── Validate Rows ───────────────────────────────────────
    const issues: ValidationIssue[] = []
    const validRows: Record<string, string>[] = []
    const invalidRowNums: number[] = []
    const seenEmails = new Set<string>()

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      const row: Record<string, string> = {}
      let rowValid = true

      // Map values to headers
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] ?? ''
      }

      // Check required fields
      for (const field of requiredFields) {
        if (!row[field] || row[field].trim() === '') {
          issues.push({ row: i, field, error: `Missing required field: ${field}` })
          rowValid = false
        }
      }

      // Email format validation
      const emailField = row['email'] || row['member_email']
      if (emailField && emailField.trim() !== '') {
        if (!EMAIL_REGEX.test(emailField.trim())) {
          issues.push({
            row: i,
            field: row['email'] ? 'email' : 'member_email',
            error: `Invalid email format: "${emailField}"`,
          })
          rowValid = false
        }

        // Duplicate detection (for members data type)
        if (data_type === 'members') {
          const normalizedEmail = emailField.trim().toLowerCase()
          if (seenEmails.has(normalizedEmail)) {
            issues.push({
              row: i,
              field: 'email',
              error: `Duplicate email: "${normalizedEmail}"`,
            })
            rowValid = false
          }
          seenEmails.add(normalizedEmail)
        }
      }

      // Date normalization check
      const dateField = row['date'] || row['booking_date'] || row['created_at']
      if (dateField && dateField.trim() !== '') {
        const normalized = normalizeDate(dateField.trim())
        if (!normalized) {
          issues.push({
            row: i,
            field: 'date',
            error: `Unrecognized date format: "${dateField}"`,
          })
          rowValid = false
        }
      }

      // Amount normalization check (for transactions)
      if (data_type === 'transactions' && row['amount']) {
        const normalized = normalizeAmount(row['amount'])
        if (normalized === null) {
          issues.push({
            row: i,
            field: 'amount',
            error: `Invalid amount format: "${row['amount']}"`,
          })
          rowValid = false
        }
      }

      if (rowValid) {
        validRows.push(row)
      } else {
        invalidRowNums.push(i)
      }
    }

    // Check for duplicates against existing data in database
    if (data_type === 'members' && validRows.length > 0) {
      const emails = validRows
        .map((r) => (r['email'] ?? '').trim().toLowerCase())
        .filter(Boolean)

      if (emails.length > 0) {
        // Check in batches of 100
        for (let batch = 0; batch < emails.length; batch += 100) {
          const batchEmails = emails.slice(batch, batch + 100)
          const { data: existingMembers } = await supabase
            .from('profiles')
            .select('email')
            .eq('studio_id', studioId)
            .in('email', batchEmails)

          if (existingMembers && existingMembers.length > 0) {
            const existingSet = new Set(existingMembers.map((m) => m.email?.toLowerCase()))
            for (const email of batchEmails) {
              if (existingSet.has(email)) {
                issues.push({
                  row: -1, // Cannot map back to specific row in batch context
                  field: 'email',
                  error: `Email already exists in database: "${email}"`,
                })
              }
            }
          }
        }
      }
    }

    // ─── Build Sample Data ───────────────────────────────────
    const sampleData = validRows.slice(0, 5)

    return NextResponse.json({
      valid_rows: validRows.length,
      invalid_rows: invalidRowNums.length,
      total_rows: lines.length - 1,
      issues,
      sample_data: sampleData,
      columns: headers,
    })
  } catch (err) {
    console.error('POST /api/migration/validate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
