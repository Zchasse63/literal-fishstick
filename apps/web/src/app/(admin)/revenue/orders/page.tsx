'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  ShoppingBag,
  Clock,
  PackageCheck,
  Truck,
  Search,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  CheckCircle,
  MapPin,
  Package,
  X,
  ArrowUpRight,
  CalendarDays,
  Loader2,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

// ─── Types ──────────────────────────────────────────────────
type OrderStatus = 'pending' | 'processing' | 'ready_for_pickup' | 'shipped' | 'delivered' | 'completed'
type FulfillmentType = 'pickup' | 'shipping'

interface OrderItem {
  name: string
  quantity: number
  priceInCents: number
}

interface Order {
  id: string
  orderId: string
  customerName: string
  customerEmail: string
  date: string
  items: OrderItem[]
  totalInCents: number
  fulfillmentType: FulfillmentType
  status: OrderStatus
  shippingAddress?: string
  trackingNumber?: string
}

const STUDIO_ID = DEFAULT_STUDIO_ID

const STATUS_FILTERS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
]

const FULFILLMENT_FILTERS: { value: FulfillmentType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'shipping', label: 'Shipping' },
]

// ─── Helpers ────────────────────────────────────────────────
function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  processing: { label: 'Processing', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  ready_for_pickup: { label: 'Ready', className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  shipped: { label: 'Shipped', className: 'bg-violet-50 text-violet-700 border border-violet-200' },
  delivered: { label: 'Delivered', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600' },
}

const fulfillmentConfig: Record<FulfillmentType, { label: string; className: string }> = {
  pickup: { label: 'Pickup', className: 'bg-gray-100 text-gray-600' },
  shipping: { label: 'Shipping', className: 'bg-blue-50 text-blue-600 border border-blue-200' },
}

// ─── Components ─────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon: Icon,
  iconBg,
  delay = 0,
}: {
  label: string
  value: string
  icon: typeof ShoppingBag
  iconBg: string
  delay?: number
}) {
  return (
    <motion.div
      {...fadeInUp}
      transition={{ ...fadeInUp.transition, delay }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center', iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-[28px] font-black text-gray-900 tabular-nums leading-none">{value}</p>
    </motion.div>
  )
}

function ShippingLabelModal({
  order,
  onClose,
}: {
  order: Order
  onClose: () => void
}) {
  const [selectedRate, setSelectedRate] = useState<string | null>(null)

  const rates = [
    { id: 'usps_priority', carrier: 'USPS Priority Mail', price: '$8.50', eta: '2-3 business days' },
    { id: 'usps_express', carrier: 'USPS Express Mail', price: '$24.99', eta: '1-2 business days' },
    { id: 'usps_ground', carrier: 'USPS Ground Advantage', price: '$5.99', eta: '5-7 business days' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl border border-gray-200 shadow-xl p-6 w-full max-w-md mx-4"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-gray-900">Create Shipping Label</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Ship To</p>
          <div className="flex items-start gap-2 p-3 rounded-xl bg-gray-50">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{order.customerName}</p>
              <p className="text-xs text-gray-500 mt-0.5">{order.shippingAddress}</p>
            </div>
          </div>
        </div>

        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Select Rate</p>
          <div className="space-y-2">
            {rates.map((rate) => (
              <button
                key={rate.id}
                onClick={() => setSelectedRate(rate.id)}
                className={cn(
                  'w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left',
                  selectedRate === rate.id
                    ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-500/20'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{rate.carrier}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{rate.eta}</p>
                </div>
                <p className="text-sm font-black text-gray-900 tabular-nums">{rate.price}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!selectedRate}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm',
              selectedRate
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            Create Label
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────
export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [shippingModalOrder, setShippingModalOrder] = useState<Order | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  async function updateOrderStatus(orderId: string, newStatus: OrderStatus, trackingNumber?: string) {
    setActionLoading(prev => ({ ...prev, [orderId]: true }))
    try {
      const body: any = { status: newStatus }
      if (trackingNumber) body.tracking_number = trackingNumber

      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Update failed') }

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus, ...(trackingNumber ? { trackingNumber } : {}) } : o))
    } catch (err) {
      console.error('Order status update failed:', err)
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: false }))
    }
  }

  async function handleShipOrder(orderId: string) {
    const res = await fetch(`/api/orders/${orderId}/ship`, { method: 'POST' })
    if (res.ok) {
      const json = await res.json()
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'shipped' as OrderStatus, trackingNumber: json.data?.tracking_number } : o))
    }
  }

  useEffect(() => {
    let cancelled = false
    const supabase = createBrowserClient()

    async function loadOrders() {
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('studio_id', STUDIO_ID)
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (data) {
        setOrders(data.map((o: any) => ({
          id: o.id,
          orderId: o.order_number || `#${o.id.slice(0, 8)}`,
          customerName: o.customer_name || 'Unknown',
          customerEmail: o.customer_email || '',
          date: o.created_at ? new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
          items: (o.order_items || []).map((item: any) => ({
            name: item.product_name || item.name || 'Product',
            quantity: item.quantity ?? 1,
            priceInCents: item.price_in_cents ?? 0,
          })),
          totalInCents: o.total_in_cents ?? 0,
          fulfillmentType: (o.fulfillment_type || 'pickup') as FulfillmentType,
          status: (o.status || 'pending') as OrderStatus,
          shippingAddress: o.shipping_address || undefined,
          trackingNumber: o.tracking_number || undefined,
        })))
      }

      setLoading(false)
    }

    loadOrders()
    return () => { cancelled = true }
  }, [])

  const filtered = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    if (fulfillmentFilter !== 'all' && o.fulfillmentType !== fulfillmentFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!o.orderId.toLowerCase().includes(q) && !o.customerName.toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalOrders = orders.length
  const pendingCount = orders.filter((o) => o.status === 'pending').length
  const readyCount = orders.filter((o) => o.status === 'ready_for_pickup').length
  const shippedCount = orders.filter((o) => o.status === 'shipped').length

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="min-h-screen bg-[#FAFAFA]"
    >
      {/* Shipping Label Modal */}
      <AnimatePresence>
        {shippingModalOrder && (
          <ShippingLabelModal order={shippingModalOrder} onClose={() => setShippingModalOrder(null)} />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage merchandise orders and fulfillment</p>
        </div>
      </div>

      {/* ─── KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={ShoppingBag} label="Total Orders" value={String(totalOrders)} iconBg="bg-indigo-50 text-indigo-600" delay={0} />
        <MetricCard icon={Clock} label="Pending" value={String(pendingCount)} iconBg="bg-amber-50 text-amber-600" delay={0.05} />
        <MetricCard icon={PackageCheck} label="Ready for Pickup" value={String(readyCount)} iconBg="bg-emerald-50 text-emerald-600" delay={0.1} />
        <MetricCard icon={Truck} label="Shipped" value={String(shippedCount)} iconBg="bg-blue-50 text-blue-600" delay={0.15} />
      </div>

      {/* ─── Filters ──────────────────────────────────────────── */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.1 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Status pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  statusFilter === s.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-gray-200" />

          {/* Fulfillment toggle */}
          <div className="flex items-center gap-1.5">
            {FULFILLMENT_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFulfillmentFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  fulfillmentFilter === f.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders or customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
            />
          </div>
        </div>
      </motion.div>

      {/* ─── Orders Table ─────────────────────────────────────── */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.15 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      >
        {/* Table header */}
        <div className="flex items-center gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
          <div className="w-6" />
          <div className="w-24">Order</div>
          <div className="flex-1 min-w-0">Customer</div>
          <div className="w-28">Date</div>
          <div className="w-14 text-center">Items</div>
          <div className="w-20 text-right">Total</div>
          <div className="w-20 text-center">Type</div>
          <div className="w-24 text-center">Status</div>
          <div className="w-28 text-right">Actions</div>
        </div>

        <div className="divide-y divide-gray-50">
          {filtered.map((order) => {
            const isExpanded = expandedOrder === order.id
            const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

            return (
              <div key={order.id}>
                {/* Main row */}
                <div
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/80 transition-colors cursor-pointer"
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                >
                  <div className="w-6">
                    <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </motion.div>
                  </div>
                  <div className="w-24">
                    <p className="text-sm font-semibold text-indigo-600 tabular-nums">{order.orderId}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{order.customerName}</p>
                  </div>
                  <div className="w-28">
                    <p className="text-sm text-gray-500">{order.date}</p>
                  </div>
                  <div className="w-14 text-center">
                    <p className="text-sm font-medium text-gray-700 tabular-nums">{itemCount}</p>
                  </div>
                  <div className="w-20 text-right">
                    <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatCents(order.totalInCents)}</p>
                  </div>
                  <div className="w-20 text-center">
                    <span className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      fulfillmentConfig[order.fulfillmentType].className
                    )}>
                      {fulfillmentConfig[order.fulfillmentType].label}
                    </span>
                  </div>
                  <div className="w-24 text-center">
                    <span className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      statusConfig[order.status].className
                    )}>
                      {statusConfig[order.status].label}
                    </span>
                  </div>
                  <div className="w-28 text-right flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {actionLoading[order.id] ? (
                      <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                    ) : (
                      <>
                        {order.status === 'pending' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, order.fulfillmentType === 'pickup' ? 'ready_for_pickup' : 'processing')}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors"
                          >
                            Mark Ready
                          </button>
                        )}
                        {order.status === 'ready_for_pickup' && order.fulfillmentType === 'pickup' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'completed')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                          >
                            Complete
                          </button>
                        )}
                        {(order.status === 'pending' || order.status === 'processing') && order.fulfillmentType === 'shipping' && (
                          <button
                            onClick={() => setShippingModalOrder(order)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-colors"
                          >
                            Ship
                          </button>
                        )}
                        {order.status === 'shipped' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'delivered')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                          >
                            Delivered
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded row */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 pt-1 ml-10 border-l-2 border-indigo-100">
                        {/* Order items */}
                        <div className="mb-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Items</p>
                          <div className="space-y-1.5">
                            {order.items.map((item, i) => (
                              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-lg bg-gray-200 flex items-center justify-center">
                                    <Package className="h-3.5 w-3.5 text-gray-400" />
                                  </div>
                                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                  <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                                  <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatCents(item.priceInCents * item.quantity)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Shipping info */}
                        {order.shippingAddress && (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Shipping Address</p>
                            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50">
                              <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                              <p className="text-sm text-gray-700">{order.shippingAddress}</p>
                            </div>
                          </div>
                        )}

                        {/* Tracking */}
                        {order.trackingNumber && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Tracking</p>
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
                              <Truck className="h-4 w-4 text-gray-400 shrink-0" />
                              <p className="text-sm font-mono text-gray-700">{order.trackingNumber}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <ShoppingBag className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500">No orders found</p>
            <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
