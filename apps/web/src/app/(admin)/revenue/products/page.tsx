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

  // BUG-009 Part B: map DB column names → client-side prop names.
  // DB: price / compare_at_price / inventory_count / is_active (source of truth).
  // Client: priceInCents / compareAtPriceInCents / inventory / active (unchanged).
  const products: Product[] = (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name || 'Unnamed Product',
    category: (p.category || 'all') as Product['category'],
    priceInCents: p.price ?? 0,
    compareAtPriceInCents: p.compare_at_price || undefined,
    sku: p.sku || '',
    inventory: p.inventory_count ?? 0,
    image: p.image_url || null,
    active: p.is_active ?? true,
  }))

  return <ProductsClient initialProducts={products} />
}
