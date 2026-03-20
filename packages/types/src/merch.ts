// Merchandise & Inventory types

export type OrderStatus = 'pending' | 'ready_for_pickup' | 'collected' | 'cancelled' | 'refunded'
export type FulfillmentType = 'pickup' | 'shipping' // shipping inactive Phase 1

export interface Product {
  id: string
  studio_id: string
  name: string
  description: string | null
  price: number // cents
  sku: string | null
  category: string | null
  image_url: string | null
  inventory_count: number
  inventory_hold_count: number // reserved during checkout (15-min hold)
  is_active: boolean
  sort_order: number
  // Shipping fields (built but inactive Phase 1)
  weight_oz: number | null
  dimensions: string | null
  requires_shipping: boolean
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  studio_id: string
  member_id: string
  status: OrderStatus
  fulfillment_type: FulfillmentType
  subtotal: number // cents
  discount_amount: number // cents (member 10% discount)
  total: number // cents
  payment_id: string | null
  notes: string | null
  // Shipping fields (inactive Phase 1)
  shipping_address: ShippingAddress | null
  tracking_number: string | null
  shipped_at: string | null
  collected_at: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number // cents
  total: number // cents
  created_at: string
}

export interface InventoryHold {
  id: string
  product_id: string
  member_id: string
  quantity: number
  expires_at: string // 15 minutes from creation
  created_at: string
}

export interface ShippingAddress {
  line1: string
  line2: string | null
  city: string
  state: string
  postal_code: string
  country: string
}
