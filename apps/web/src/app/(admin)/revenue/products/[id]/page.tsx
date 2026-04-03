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

  const product: ProductDetail | null = data
    ? {
        id: data.id,
        name: data.name || '',
        description: data.description || '',
        category: data.category || 'apparel',
        priceInCents: data.price_in_cents ?? 0,
        compareAtPriceInCents: data.compare_at_price_in_cents || null,
        sku: data.sku || '',
        barcode: data.barcode || '',
        inventory: data.inventory ?? 0,
        lowStockThreshold: data.low_stock_threshold ?? 5,
        weightOz: data.weight_oz ?? 0,
        active: data.active ?? true,
        images: data.images || [],
      }
    : null

  return <ProductDetailClient product={product} />
}
