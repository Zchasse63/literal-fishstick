import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import OrdersClient from './_components/OrdersClient'
import type { Order } from './_components/OrdersClient'

export default async function OrdersPage() {
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .order('created_at', { ascending: false })

  const orders: Order[] = (data ?? []).map((o: any) => ({
    id: o.id,
    orderId: o.order_number || `#${o.id.slice(0, 8)}`,
    customerName: o.customer_name || 'Unknown',
    customerEmail: o.customer_email || '',
    date: o.created_at
      ? new Date(o.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '',
    items: (o.order_items || []).map((item: any) => ({
      name: item.product_name || item.name || 'Product',
      quantity: item.quantity ?? 1,
      priceInCents: item.price_in_cents ?? 0,
    })),
    totalInCents: o.total_in_cents ?? 0,
    fulfillmentType: (o.fulfillment_type || 'pickup') as Order['fulfillmentType'],
    status: (o.status || 'pending') as Order['status'],
    shippingAddress: o.shipping_address || undefined,
    trackingNumber: o.tracking_number || undefined,
  }))

  return <OrdersClient initialOrders={orders} />
}
