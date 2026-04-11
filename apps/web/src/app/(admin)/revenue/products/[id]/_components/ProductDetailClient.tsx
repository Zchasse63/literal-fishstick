'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
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
  Loader2,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'
// ─── Types ──────────────────────────────────────────────────
export interface ProductDetail {
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

// ─── Helpers ────────────────────────────────────────────────
function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

const statusConfig: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  shipped: { label: 'Shipped', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
}

interface ProductDetailClientProps {
  product: ProductDetail | null
}

// ─── Page ───────────────────────────────────────────────────
export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const router = useRouter()
  const [ORDER_HISTORY] = useState<OrderHistoryItem[]>([])

  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [category, setCategory] = useState(product?.category ?? 'apparel')
  const [priceInCents, setPriceInCents] = useState(product?.priceInCents ?? 0)
  const [compareAtPrice, setCompareAtPrice] = useState(product?.compareAtPriceInCents ?? 0)
  const [inventory, setInventory] = useState(product?.inventory ?? 0)
  const [lowStockThreshold, setLowStockThreshold] = useState(product?.lowStockThreshold ?? 5)
  const [sku, setSku] = useState(product?.sku ?? '')
  const [barcode, setBarcode] = useState(product?.barcode ?? '')
  const [weightOz, setWeightOz] = useState(product?.weightOz ?? 0)
  const [active, setActive] = useState(product?.active ?? true)

  // BUG-009 GAP-5: Save + Delete buttons were unwired visual stubs. Wire them
  // to the real API routes. `handleSave` PUTs the full field set; `handleDelete`
  // confirms then soft-deletes via DELETE.
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!product) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          category,
          price: priceInCents,
          compare_at_price: compareAtPrice || null,
          sku,
          barcode,
          inventory_count: inventory,
          low_stock_threshold: lowStockThreshold,
          weight_oz: weightOz,
          is_active: active,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to save product.')
        return
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!product) return
    if (!confirm(`Delete "${product.name}"? This will soft-delete the product (set it inactive). This action can be reversed by re-activating the product.`)) {
      return
    }
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Failed to delete product.')
        setDeleting(false)
        return
      }
      router.push('/revenue/products')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product.')
      setDeleting(false)
    }
  }

  if (!product) {
    return (
      <div data-testid="revenue-products-detail-not-found" className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-lg font-bold text-gray-700 dark:text-gray-300">Product not found</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">This product may have been deleted or does not exist.</p>
          <Link href="/revenue/products" className="text-sm text-indigo-600 hover:text-indigo-700 mt-2 inline-block">
            Back to Products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      data-testid="revenue-products-detail-root"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="space-y-6"
    >
      {/* Back link */}
      <Link
        href="/revenue/products"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-indigo-600 transition-colors mb-5"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Products
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">{product.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{product.sku}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            disabled={deleting || saving}
            data-testid="revenue-products-detail-delete-btn"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-white dark:bg-gray-950 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || deleting}
            data-testid="revenue-products-detail-save-btn"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          data-testid="revenue-products-detail-error"
          className="rounded-xl bg-red-50 border border-red-200 p-4"
        >
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ─── Two-Column Layout ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        {/* Left Column — 3/5 */}
        <div className="lg:col-span-3 space-y-6">
          {/* Images */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.05 }}
            className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Product Images</p>
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors cursor-pointer">
              <ImagePlus className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Drag and drop images here</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">or click to browse. PNG, JPG up to 5MB each.</p>
              <button className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <Upload className="h-4 w-4" />
                Upload Images
              </button>
            </div>
          </motion.div>

          {/* Product Details */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Product Details</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Product Name</label>
                <input
                  data-testid="revenue-products-detail-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Description</label>
                <textarea
                  data-testid="revenue-products-detail-description-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Category</label>
                <select
                  data-testid="revenue-products-detail-category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors bg-white dark:bg-gray-950"
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
            className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Pricing</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Price (cents)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">$</span>
                  <input
                    data-testid="revenue-products-detail-price-input"
                    type="text"
                    value={(priceInCents / 100).toFixed(2)}
                    onChange={(e) => setPriceInCents(Math.round(parseFloat(e.target.value || '0') * 100))}
                    className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-gray-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Compare-at Price (for sales)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">$</span>
                  <input
                    data-testid="revenue-products-detail-compare-price-input"
                    type="text"
                    value={compareAtPrice ? (compareAtPrice / 100).toFixed(2) : ''}
                    onChange={(e) => setCompareAtPrice(Math.round(parseFloat(e.target.value || '0') * 100))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-gray-100 tabular-nums placeholder:text-gray-400 dark:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Inventory */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Box className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Inventory</p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Quantity</label>
                  <input
                    data-testid="revenue-products-detail-inventory-input"
                    type="number"
                    value={inventory}
                    onChange={(e) => setInventory(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-gray-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Low Stock Alert</label>
                  <input
                    data-testid="revenue-products-detail-low-stock-input"
                    type="number"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-gray-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">SKU</label>
                <input
                  data-testid="revenue-products-detail-sku-input"
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Barcode</label>
                <input
                  data-testid="revenue-products-detail-barcode-input"
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors font-mono text-xs"
                />
              </div>
            </div>
          </motion.div>

          {/* Shipping */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.15 }}
            className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Truck className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Shipping</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Weight (oz)</label>
              <input
                data-testid="revenue-products-detail-weight-input"
                type="number"
                value={weightOz}
                onChange={(e) => setWeightOz(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-gray-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">Used for shipping rate calculations</p>
            </div>
          </motion.div>

          {/* Status Toggle */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.2 }}
            className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Product Status</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {active ? 'Visible to customers' : 'Hidden from store'}
                </p>
              </div>
              <button
                onClick={() => setActive(!active)}
                data-testid="revenue-products-detail-active-toggle"
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
        className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Recent Orders</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Orders containing this product</p>
          </div>
          <ShoppingBag className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>

        {/* Table header */}
        <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
          <div className="w-24">Order</div>
          <div className="flex-1 min-w-0">Customer</div>
          <div className="w-28">Date</div>
          <div className="w-12 text-center">Qty</div>
          <div className="w-20 text-right">Total</div>
          <div className="w-24 text-center">Status</div>
        </div>

        <div className="divide-y divide-gray-50">
          {ORDER_HISTORY.map((order) => (
            <div key={order.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors">
              <div className="w-24">
                <p className="text-sm font-semibold text-indigo-600 tabular-nums">{order.orderId}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{order.customerName}</p>
              </div>
              <div className="w-28">
                <p className="text-sm text-gray-500 dark:text-gray-400">{order.date}</p>
              </div>
              <div className="w-12 text-center">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">{order.quantity}</p>
              </div>
              <div className="w-20 text-right">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{formatCents(order.total)}</p>
              </div>
              <div className="w-24 text-center">
                <span className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  statusConfig[order.status]?.className ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
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
