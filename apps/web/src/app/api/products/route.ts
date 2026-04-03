import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['owner', 'manager']

/**
 * GET /api/products
 *
 * List products with filtering and pagination.
 * Query params: category, is_active, search, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

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
    if (!profile || !roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile.studio_id || '11111111-1111-1111-1111-111111111111'

    // ─── Query Params ──────────────────────────────────────────
    const { searchParams } = request.nextUrl
    const category = searchParams.get('category')
    const isActive = searchParams.get('is_active')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    // ─── Build Query ───────────────────────────────────────────
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) {
      query = query.eq('category', category)
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      query = query.eq('is_active', isActive === 'true')
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,sku.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json({ data, count })
  } catch (err) {
    console.error('GET /api/products error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/products
 *
 * Create a new product.
 * Body: { name, description?, category?, price, compare_at_price?, sku?, barcode?,
 *         quantity?, low_stock_threshold?, images?, weight_oz?, is_active? }
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
      .select('id, roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!profile || !roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile.studio_id || '11111111-1111-1111-1111-111111111111'

    // ─── Parse Body ────────────────────────────────────────────
    const body = await request.json()
    const {
      name,
      description,
      category,
      price,
      compare_at_price,
      sku,
      barcode,
      quantity,
      low_stock_threshold,
      images,
      weight_oz,
      is_active,
    } = body as {
      name: string
      description?: string
      category?: string
      price: number
      compare_at_price?: number
      sku?: string
      barcode?: string
      quantity?: number
      low_stock_threshold?: number
      images?: string[]
      weight_oz?: number
      is_active?: boolean
    }

    if (!name || price === undefined || price === null) {
      return NextResponse.json(
        { error: 'name and price are required' },
        { status: 400 }
      )
    }

    if (typeof price !== 'number' || price < 0) {
      return NextResponse.json(
        { error: 'price must be a non-negative integer (cents)' },
        { status: 400 }
      )
    }

    // ─── Insert ────────────────────────────────────────────────
    const { data: product, error: insertError } = await supabase
      .from('products')
      .insert({
        studio_id: studioId,
        name,
        description: description ?? null,
        category: category ?? null,
        price,
        compare_at_price: compare_at_price ?? null,
        sku: sku ?? null,
        barcode: barcode ?? null,
        quantity: quantity ?? 0,
        low_stock_threshold: low_stock_threshold ?? 5,
        images: images ?? [],
        weight_oz: weight_oz ?? null,
        is_active: is_active ?? true,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      type: 'product_created',
      subject_type: 'product',
      subject_id: product.id,
      metadata: { name, price, category: category ?? null },
    })

    return NextResponse.json({ data: product }, { status: 201 })
  } catch (err) {
    console.error('POST /api/products error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
