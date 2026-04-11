import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/validation'

/**
 * T28 / B15 — Self-service profile update.
 *
 * PUT /api/profile — lets the authenticated user update their own profile
 * fields. Available to all authed roles (owner, admin, manager, trainer,
 * staff, member). Writes only to the caller's own profile row — never
 * allows updating another profile via this endpoint.
 *
 * Editable fields:
 *   - full_name
 *   - phone (normalized)
 *   - avatar_url
 *   - emergency_contact_name
 *   - emergency_contact_phone (normalized)
 *
 * Does NOT allow updating:
 *   - email (requires re-verification flow via Supabase Auth)
 *   - roles (admin-only, handled via /api/members/[id])
 *   - studio_id (multi-tenant boundary)
 *   - is_active (admin-only archive flow)
 */

const ALLOWED_FIELDS = [
  'full_name',
  'phone',
  'avatar_url',
  'emergency_contact_name',
  'emergency_contact_phone',
] as const

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Whitelist the writable fields
    const updates: Record<string, unknown> = {}
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Normalize phone fields
    if (updates.phone !== undefined) {
      updates.phone = normalizePhone(updates.phone as string | null)
    }
    if (updates.emergency_contact_phone !== undefined) {
      updates.emergency_contact_phone = normalizePhone(
        updates.emergency_contact_phone as string | null
      )
    }

    // Validate full_name if provided
    if (updates.full_name !== undefined) {
      const name = String(updates.full_name ?? '').trim()
      if (name.length === 0) {
        return NextResponse.json(
          { error: 'full_name cannot be empty' },
          { status: 400 }
        )
      }
      if (name.length > 200) {
        return NextResponse.json(
          { error: 'full_name is too long (max 200 chars)' },
          { status: 400 }
        )
      }
      updates.full_name = name
    }

    // Validate avatar_url is a URL-ish string if provided
    if (updates.avatar_url !== undefined && updates.avatar_url !== null) {
      const url = String(updates.avatar_url)
      if (url.length > 500) {
        return NextResponse.json(
          { error: 'avatar_url is too long (max 500 chars)' },
          { status: 400 }
        )
      }
    }

    updates.updated_at = new Date().toISOString()

    // Update the caller's own profile — scoped by user.id, never a URL param
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('id, full_name, email, phone, avatar_url, emergency_contact_name, emergency_contact_phone, roles, studio_id')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Log activity (capture-and-log pattern)
    const { error: activityError } = await supabase.from('activity_log').insert({
      studio_id: (updated as { studio_id?: string }).studio_id ?? null,
      actor_id: user.id,
      type: 'profile',
      subject_type: 'profile',
      subject_id: user.id,
      description: `Profile updated: ${Object.keys(updates).filter((k) => k !== 'updated_at').join(', ')}`,
      metadata: { fields: Object.keys(updates).filter((k) => k !== 'updated_at') },
    })

    if (activityError) {
      console.error(
        'PUT /api/profile: activity_log insert failed',
        activityError.message
      )
    }

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('PUT /api/profile error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/profile — return the caller's own profile.
 * Useful for client hydration + test inspection.
 */
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, avatar_url, emergency_contact_name, emergency_contact_phone, roles, studio_id')
      .eq('id', user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('GET /api/profile error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
