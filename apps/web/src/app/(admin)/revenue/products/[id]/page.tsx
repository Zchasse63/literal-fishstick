'use client'

import { useState } from 'react'
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

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

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

// ─── Mock Data ──────────────────────────────────────────────
const PRODUCTS_DB: Record<string, Product> = {
  '1': { id: '1', name: 'Meridian Logo Tee — Black', description: 'Premium cotton blend tee featuring the Meridian logo. Soft-washed for comfort. Unisex fit.', category: 'apparel', priceInCents: 3500, compareAtPriceInCents: null, sku: 'APP-TEE-BLK-001', barcode: '850012345001', inventory: 24, lowStockThreshold: 5, weightOz: 6, active: true, images: [] },
  '2': { id: '2', name: 'Meridian Logo Tee — White', description: 'Premium cotton blend tee featuring the Meridian logo in contrasting dark print. Unisex fit.', category: 'apparel', priceInCents: 3500, compareAtPriceInCents: null, sku: 'APP-TEE-WHT-001', barcode: '850012345002', inventory: 18, lowStockThreshold: 5, weightOz: 6, active: true, images: [] },
  '3': { id: '3', name: 'Recovery Hoodie — Charcoal', description: 'Heavyweight fleece hoodie with kangaroo pocket. Perfect for post-session warmth. Relaxed fit.', category: 'apparel', priceInCents: 6500, compareAtPriceInCents: 7500, sku: 'APP-HOD-CHR-001', barcode: '850012345003', inventory: 12, lowStockThreshold: 3, weightOz: 18, active: true, images: [] },
  '4': { id: '4', name: 'Sauna Session Shorts', description: 'Quick-dry athletic shorts designed for sauna sessions. Antimicrobial fabric, 7-inch inseam.', category: 'apparel', priceInCents: 4200, compareAtPriceInCents: null, sku: 'APP-SHR-BLK-001', barcode: '850012345004', inventory: 8, lowStockThreshold: 5, weightOz: 4, active: true, images: [] },
  '5': { id: '5', name: 'Insulated Water Bottle — 32oz', description: 'Double-walled vacuum insulated stainless steel. Keeps cold 24hrs, hot 12hrs. BPA-free.', category: 'accessories', priceInCents: 2800, compareAtPriceInCents: null, sku: 'ACC-BTL-32-001', barcode: '850012345005', inventory: 31, lowStockThreshold: 10, weightOz: 12, active: true, images: [] },
  '6': { id: '6', name: 'Meridian Sport Towel', description: 'Quick-dry microfiber sport towel with Meridian branding. 40x20 inches.', category: 'accessories', priceInCents: 1800, compareAtPriceInCents: null, sku: 'ACC-TWL-SPT-001', barcode: '850012345006', inventory: 45, lowStockThreshold: 10, weightOz: 5, active: true, images: [] },
  '7': { id: '7', name: 'Eucalyptus Sauna Oil — 4oz', description: 'Pure eucalyptus essential oil blend for sauna aromatherapy. Lab-tested, therapeutic grade.', category: 'supplements', priceInCents: 2200, compareAtPriceInCents: null, sku: 'SUP-OIL-EUC-001', barcode: '850012345007', inventory: 6, lowStockThreshold: 5, weightOz: 5, active: true, images: [] },
  '8': { id: '8', name: 'Cold Plunge Recovery Balm', description: 'Menthol and arnica recovery balm for post-cold plunge muscle relief. 2oz tin.', category: 'supplements', priceInCents: 1900, compareAtPriceInCents: 2400, sku: 'SUP-BLM-RCV-001', barcode: '850012345008', inventory: 2, lowStockThreshold: 5, weightOz: 3, active: true, images: [] },
  '9': { id: '9', name: 'Breathwork Timer — Pro', description: 'Guided breathwork timer with customizable intervals and haptic feedback. USB-C charging.', category: 'equipment', priceInCents: 4900, compareAtPriceInCents: null, sku: 'EQP-TMR-PRO-001', barcode: '850012345009', inventory: 5, lowStockThreshold: 3, weightOz: 4, active: true, images: [] },
  '10': { id: '10', name: 'Sauna Hat — Wool Felt', description: 'Traditional wool felt sauna hat for head protection. One size fits most.', category: 'accessories', priceInCents: 2400, compareAtPriceInCents: null, sku: 'ACC-HAT-WOL-001', barcode: '850012345010', inventory: 0, lowStockThreshold: 3, weightOz: 3, active: false, images: [] },
  '11': { id: '11', name: 'Electrolyte Mix — 30 Pack', description: 'Sugar-free electrolyte powder packets. Essential hydration for hot/cold therapy sessions.', category: 'supplements', priceInCents: 3200, compareAtPriceInCents: null, sku: 'SUP-ELT-30P-001', barcode: '850012345011', inventory: 15, lowStockThreshold: 10, weightOz: 8, active: true, images: [] },
  '12': { id: '12', name: 'Meridian Gym Bag', description: 'Durable canvas gym bag with shoe compartment and wet/dry separation. 35L capacity.', category: 'accessories', priceInCents: 5500, compareAtPriceInCents: null, sku: 'ACC-BAG-GYM-001', barcode: '850012345012', inventory: 9, lowStockThreshold: 5, weightOz: 24, active: true, images: [] },
}

const ORDER_HISTORY: OrderHistoryItem[] = [
  { id: '1', orderId: '#MER-0012', customerName: 'Sarah Mitchell', date: 'Mar 18, 2026', quantity: 2, total: 7000, status: 'completed' },
  { id: '2', orderId: '#MER-0009', customerName: 'Jake Torres', date: 'Mar 15, 2026', quantity: 1, total: 3500, status: 'completed' },
  { id: '3', orderId: '#MER-0007', customerName: 'Emily Chen', date: 'Mar 12, 2026', quantity: 1, total: 3500, status: 'shipped' },
  { id: '4', orderId: '#MER-0003', customerName: 'Michael Brown', date: 'Mar 8, 2026', quantity: 3, total: 10500, status: 'completed' },
]

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
  const product = PRODUCTS_DB[productId]

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

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-lg font-bold text-gray-700">Product not found</p>
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
