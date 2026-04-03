import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['admin', 'manager', 'owner']
const STORAGE_BUCKET = 'employee-documents'

/**
 * GET /api/employees/[id]/documents/[did]
 *
 * Get a single employee document by ID.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; did: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id: employeeId, did: documentId } = await params

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

    // ─── Fetch Document ────────────────────────────────────────
    const { data: document, error: docError } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('id', documentId)
      .eq('employee_id', employeeId)
      .eq('studio_id', studioId)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ data: document })
  } catch (err) {
    console.error('GET /api/employees/[id]/documents/[did] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/employees/[id]/documents/[did]
 *
 * Update document status (approve/reject). Admin/manager/owner only.
 * Body: { status: 'approved' | 'rejected', name?, description? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; did: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id: employeeId, did: documentId } = await params

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
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin, manager, or owner role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || '11111111-1111-1111-1111-111111111111'

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json()
    const { status, name, description } = body as {
      status?: 'approved' | 'rejected'
      name?: string
      description?: string
    }

    const updateData: Record<string, unknown> = {}

    if (status) {
      if (!['approved', 'rejected'].includes(status)) {
        return NextResponse.json(
          { error: 'status must be "approved" or "rejected"' },
          { status: 400 }
        )
      }
      updateData.status = status
      updateData.reviewed_by = user.id
      updateData.reviewed_at = new Date().toISOString()
    }

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // ─── Update ────────────────────────────────────────────────
    const { data: document, error: updateError } = await supabase
      .from('employee_documents')
      .update(updateData)
      .eq('id', documentId)
      .eq('employee_id', employeeId)
      .eq('studio_id', studioId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      type: status ? `employee_document_${status}` : 'employee_document_updated',
      subject_type: 'employee_document',
      subject_id: documentId,
      metadata: {
        employee_id: employeeId,
        ...updateData,
      },
    })

    return NextResponse.json({ data: document })
  } catch (err) {
    console.error('PUT /api/employees/[id]/documents/[did] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/employees/[id]/documents/[did]
 *
 * Delete a document — removes file from Supabase Storage and the database record.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; did: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id: employeeId, did: documentId } = await params

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

    // ─── Fetch Document to Get File URL ────────────────────────
    const { data: document, error: docError } = await supabase
      .from('employee_documents')
      .select('id, file_url')
      .eq('id', documentId)
      .eq('employee_id', employeeId)
      .eq('studio_id', studioId)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // ─── Delete File from Storage ──────────────────────────────
    // Extract storage path from the public URL
    if (document.file_url) {
      const urlParts = document.file_url.split(`/${STORAGE_BUCKET}/`)
      if (urlParts.length > 1) {
        const storagePath = urlParts[1]
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
      }
    }

    // ─── Delete Record ─────────────────────────────────────────
    const { error: deleteError } = await supabase
      .from('employee_documents')
      .delete()
      .eq('id', documentId)
      .eq('employee_id', employeeId)
      .eq('studio_id', studioId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      type: 'employee_document_deleted',
      subject_type: 'employee_document',
      subject_id: documentId,
      metadata: { employee_id: employeeId },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/employees/[id]/documents/[did] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
