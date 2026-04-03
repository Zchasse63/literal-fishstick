import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['admin', 'manager', 'owner']
const STORAGE_BUCKET = 'employee-documents'

/**
 * GET /api/employees/[id]/documents
 *
 * List documents for a specific employee.
 * Query params: document_type, tax_year, limit, offset
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id: employeeId } = await params

    // ─── Auth ──────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    // Employees can view their own documents; admins/managers/owners can view any
    const isSelf = user.id === employeeId
    if (!isSelf && !roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || '11111111-1111-1111-1111-111111111111'

    // ─── Query Params ──────────────────────────────────────────
    const { searchParams } = request.nextUrl
    const documentType = searchParams.get('document_type')
    const taxYear = searchParams.get('tax_year')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    // ─── Build Query ───────────────────────────────────────────
    let query = supabase
      .from('employee_documents')
      .select('*', { count: 'exact' })
      .eq('studio_id', studioId)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (documentType) {
      query = query.eq('document_type', documentType)
    }

    if (taxYear) {
      query = query.eq('tax_year', parseInt(taxYear, 10))
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json({ data, count })
  } catch (err) {
    console.error('GET /api/employees/[id]/documents error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/employees/[id]/documents
 *
 * Upload a document for an employee.
 * Accepts multipart form data with fields:
 *   file (File), document_type, name?, description?, tax_year?
 * Uploads to Supabase Storage bucket 'employee-documents'.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id: employeeId } = await params

    // ─── Auth ──────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    const isSelf = user.id === employeeId
    if (!isSelf && !roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || '11111111-1111-1111-1111-111111111111'

    // ─── Parse Form Data ───────────────────────────────────────
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const documentType = formData.get('document_type') as string | null
    const name = formData.get('name') as string | null
    const description = formData.get('description') as string | null
    const taxYear = formData.get('tax_year') as string | null

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    if (!documentType) {
      return NextResponse.json({ error: 'document_type is required' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be under 10MB' },
        { status: 400 }
      )
    }

    // ─── Upload to Supabase Storage ────────────────────────────
    const fileExt = file.name.split('.').pop() ?? 'bin'
    const timestamp = Date.now()
    const storagePath = `${studioId}/${employeeId}/${timestamp}-${file.name}`

    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath)

    const fileUrl = urlData.publicUrl

    // ─── Create Document Record ────────────────────────────────
    const { data: document, error: insertError } = await supabase
      .from('employee_documents')
      .insert({
        studio_id: studioId,
        employee_id: employeeId,
        document_type: documentType,
        name: name || file.name,
        description: description || null,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        tax_year: taxYear ? parseInt(taxYear, 10) : null,
        status: 'pending',
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      // Clean up uploaded file on DB insert failure
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      type: 'employee_document_uploaded',
      subject_type: 'employee_document',
      subject_id: document.id,
      metadata: {
        employee_id: employeeId,
        document_type: documentType,
        file_name: file.name,
        file_size: file.size,
      },
    })

    return NextResponse.json({ data: document }, { status: 201 })
  } catch (err) {
    console.error('POST /api/employees/[id]/documents error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
