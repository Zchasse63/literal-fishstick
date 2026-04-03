'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  Upload,
  ImagePlus,
  Package,
  Save,
  Trash2,
  DollarSign,
  Box,
  Truck,
  ToggleLeft,
  ToggleRight,
  ShoppingBag,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

// ─── Types ──────────────────────────────────────────────────
interface Product {
  id: string
  name: string
  description: string
  category: string
  priceInCents: number
  compareAtPriceInCents: number | null
  sku: string
  barcode: string
  inventory: number
  lowStockThreshold: number
  weightOz: number
  active: boolean
  images: string[]
}

interface OrderHistoryItem {
  id: string
  orderId: string
  customerName: string
  date: string
  quantity: number
  total: number
  status: string
}

const STUDIO_ID = DEFAULT_STUDIO_ID

// ─── Helpers ────────────────────────────────────────────────
function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

const statusConfig: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  shipped: { label: 'Shipped', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
}

// ─── Page ───────────────────────────────────────────────────
export default function ProductDetailPage() {
  const params = useParams()
  const productId = params.id as string
  const [product, setProduct] = useState<Product | null>(null)
  const [ORDER_HISTORY, setOrderHistory] = useState<OrderHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('apparel')
  const [priceInCents, setPriceInCents] = useState(0)
  const [compareAtPrice, setCompareAtPrice] = useState(0)
  const [inventory, setInventory] = useState(0)
  const [lowStockThreshold, setLowStockThreshold] = useState(5)
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [weightOz, setWeightOz] = useState(0)

  useEffect(() => {
    let cancelled = false
    const supabase = createBrowserClient()

    async function loadProduct() {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('studio_id', STUDIO_ID)
        .single()

      if (cancelled) return

      if (data) {
        const p: Product = {
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
        setProduct(p)
        setName(p.name)
        setDescription(p.description)
        setCategory(p.category)
        setPriceInCents(p.priceInCents)
        setCompareAtPrice(p.compareAtPriceInCents ?? 0)
        setInventory(p.inventory)
        setLowStockThreshold(p.lowStockThreshold)
        setSku(p.sku)
        setBarcode(p.barcode)
        setWeightOz(p.weightOz)
      }

      setLoading(false)
    }

    loadProduct()
    return () => { cancelled = true }
  }, [productId])
  const [active, setActive] = useState(true)

  // Update active when product loads
  useEffect(() => {
    if (product) setActive(product.active)
  }, [product])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-lg font-bold text-gray-700">Product not found</p>
          <p className="text-sm text-gray-400 mt-1">This product may have been deleted or does not exist.</p>
          <Link href="/revenue/products" className="text-sm text-indigo-600 hover:text-indigo-700 mt-2 inline-block">
            Back to Products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="min-h-screen bg-[#FAFAFA]"
    >
      {/* Back link */}
      <Link
        href="/revenue/products"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-indigo-600 transition-colors mb-5"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Products
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{product.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{product.sku}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-white text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </div>

      {/* ─── Two-Column Layout ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        {/* Left Column — 3/5 */}
        <div className="lg:col-span-3 space-y-6">
          {/* Images */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.05 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Product Images</p>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors cursor-pointer">
              <ImagePlus className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">Drag and drop images here</p>
              <p className="text-xs text-gray-400 mt-1">or click to browse. PNG, JPG up to 5MB each.</p>
              <button className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <Upload className="h-4 w-4" />
                Upload Images
              </button>
            </div>
          </motion.div>

          {/* Product Details */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Product Details</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Product Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors bg-white"
                >
                  <option value="apparel">Apparel</option>
                  <option value="accessories">Accessories</option>
                  <option value="equipment">Equipment</option>
                  <option value="supplements">Supplements</option>
                </select>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column — 2/5 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pricing */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.05 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pricing</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Price (cents)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <input
                    type="text"
                    value={(priceInCents / 100).toFixed(2)}
                    onChange={(e) => setPriceInCents(Math.round(parseFloat(e.target.value || '0') * 100))}
                    className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Compare-at Price (for sales)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <input
                    type="text"
                    value={compareAtPrice ? (compareAtPrice / 100).toFixed(2) : ''}
                    onChange={(e) => setCompareAtPrice(Math.round(parseFloat(e.target.value || '0') * 100))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 tabular-nums placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Inventory */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Box className="h-4 w-4 text-gray-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Inventory</p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quantity</label>
                  <input
                    type="number"
                    value={inventory}
                    onChange={(e) => setInventory(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Low Stock Alert</label>
                  <input
                    type="number"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">SKU</label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Barcode</label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors font-mono text-xs"
                />
              </div>
            </div>
          </motion.div>

          {/* Shipping */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.15 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Truck className="h-4 w-4 text-gray-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Shipping</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Weight (oz)</label>
              <input
                type="number"
                value={weightOz}
                onChange={(e) => setWeightOz(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1.5">Used for shipping rate calculations</p>
            </div>
          </motion.div>

          {/* Status Toggle */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.2 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">Product Status</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {active ? 'Visible to customers' : 'Hidden from store'}
                </p>
              </div>
              <button
                onClick={() => setActive(!active)}
                className="transition-colors"
              >
                {active ? (
                  <ToggleRight className="h-8 w-8 text-indigo-600" />
                ) : (
                  <ToggleLeft className="h-8 w-8 text-gray-300" />
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ─── Order History ─────────────────────────────────────── */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.2 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">Recent Orders</h3>
            <p className="text-xs text-gray-400 mt-0.5">Orders containing this product</p>
          </div>
          <ShoppingBag className="h-4 w-4 text-gray-400" />
        </div>

        {/* Table header */}
        <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
          <div className="w-24">Order</div>
          <div className="flex-1 min-w-0">Customer</div>
          <div className="w-28">Date</div>
          <div className="w-12 text-center">Qty</div>
          <div className="w-20 text-right">Total</div>
          <div className="w-24 text-center">Status</div>
        </div>

        <div className="divide-y divide-gray-50">
          {ORDER_HISTORY.map((order) => (
            <div key={order.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/80 transition-colors">
              <div className="w-24">
                <p className="text-sm font-semibold text-indigo-600 tabular-nums">{order.orderId}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{order.customerName}</p>
              </div>
              <div className="w-28">
                <p className="text-sm text-gray-500">{order.date}</p>
              </div>
              <div className="w-12 text-center">
                <p className="text-sm font-medium text-gray-700 tabular-nums">{order.quantity}</p>
              </div>
              <div className="w-20 text-right">
                <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatCents(order.total)}</p>
              </div>
              <div className="w-24 text-center">
                <span className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  statusConfig[order.status]?.className ?? 'bg-gray-100 text-gray-600'
                )}>
                  {statusConfig[order.status]?.label ?? order.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
