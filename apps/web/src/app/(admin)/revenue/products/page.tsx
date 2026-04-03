import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import ProductsClient from './_components/ProductsClient'
import type { Product } from './_components/ProductsClient'

export default async function ProductsPage() {
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .order('name')

  const products: Product[] = (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name || 'Unnamed Product',
    category: (p.category || 'all') as Product['category'],
    priceInCents: p.price_in_cents ?? 0,
    compareAtPriceInCents: p.compare_at_price_in_cents || undefined,
    sku: p.sku || '',
    inventory: p.inventory ?? 0,
    image: p.image_url || null,
    active: p.active ?? true,
  }))

  return <ProductsClient initialProducts={products} />
}
