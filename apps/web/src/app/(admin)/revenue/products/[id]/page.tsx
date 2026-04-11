import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import ProductDetailClient from './_components/ProductDetailClient'
import type { ProductDetail } from './_components/ProductDetailClient'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .single()

  // BUG-009 Part B: map DB column names → client-side prop names.
  // DB uses price / compare_at_price / inventory_count / is_active / image_url
  // (single). Client prop shape is unchanged so the form's existing bindings
  // keep working. `images` on the client is an array; we adapt from the
  // single `image_url` column.
  const product: ProductDetail | null = data
    ? {
        id: data.id,
        name: data.name || '',
        description: data.description || '',
        category: data.category || 'apparel',
        priceInCents: data.price ?? 0,
        compareAtPriceInCents: data.compare_at_price || null,
        sku: data.sku || '',
        barcode: data.barcode || '',
        inventory: data.inventory_count ?? 0,
        lowStockThreshold: data.low_stock_threshold ?? 5,
        weightOz: data.weight_oz ?? 0,
        active: data.is_active ?? true,
        images: data.image_url ? [data.image_url] : [],
      }
    : null

  return <ProductDetailClient product={product} />
}
