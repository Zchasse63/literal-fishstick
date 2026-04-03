import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ['owner', 'manager']

/**
 * POST /api/migration/upload
 *
 * Upload a Glofox CSV file to Supabase Storage.
 * Accepts multipart form data with a CSV file.
 * Returns the file URL and basic stats (row count).
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

    // ─── Parse Form Data ─────────────────────────────────────
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json(
        { error: 'Only CSV files are accepted' },
        { status: 400 }
      )
    }

    // ─── Read File Content for Stats ─────────────────────────
    const text = await file.text()
    const lines = text.split('\n').filter((line) => line.trim().length > 0)
    const rowCount = Math.max(0, lines.length - 1) // Subtract header row

    // ─── Upload to Supabase Storage ──────────────────────────
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${studioId}/${timestamp}_${sanitizedName}`

    const { error: uploadError } = await supabase
      .storage
      .from('migration-uploads')
      .upload(storagePath, file, {
        contentType: 'text/csv',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Get the public URL
    const { data: urlData } = supabase
      .storage
      .from('migration-uploads')
      .getPublicUrl(storagePath)

    const fileUrl = urlData.publicUrl

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      type: 'migration_file_uploaded',
      subject_type: 'migration',
      subject_id: studioId,
      metadata: {
        file_name: file.name,
        file_size: file.size,
        row_count: rowCount,
        storage_path: storagePath,
      },
    })

    return NextResponse.json({
      data: {
        file_url: fileUrl,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        row_count: rowCount,
        header_columns: lines.length > 0 ? lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '')) : [],
      },
    }, { status: 201 })
  } catch (err) {
    console.error('POST /api/migration/upload error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
