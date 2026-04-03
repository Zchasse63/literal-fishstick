'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  XCircle,
  CheckCircle,
  LayoutGrid,
  List,
  Pencil,
  ArrowUpRight,
  ShoppingBag,
  Box,
  Tag,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'
// ─── Types ──────────────────────────────────────────────────
type Category = 'all' | 'apparel' | 'accessories' | 'equipment' | 'supplements'
type ViewMode = 'grid' | 'table'

export interface Product {
  id: string
  name: string
  category: Category
  priceInCents: number
  compareAtPriceInCents?: number
  sku: string
  inventory: number
  image: string | null
  active: boolean
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'apparel', label: 'Apparel' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'supplements', label: 'Supplements' },
]

// ─── Helpers ────────────────────────────────────────────────
function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function inventoryColor(count: number) {
  if (count > 10) return 'text-emerald-600 bg-emerald-50'
  if (count >= 3) return 'text-amber-600 bg-amber-50'
  return 'text-red-600 bg-red-50'
}

function inventoryBadgeColor(count: number) {
  if (count > 10) return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  if (count >= 3) return 'bg-amber-50 text-amber-700 border border-amber-200'
  return 'bg-red-50 text-red-700 border border-red-200'
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
  icon: typeof Package
  iconBg: string
  delay?: number
}) {
  return (
    <motion.div
      {...fadeInUp}
      transition={{ ...fadeInUp.transition, delay }}
      className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</p>
        <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center', iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-[28px] font-black text-gray-900 dark:text-gray-100 tabular-nums leading-none">{value}</p>
    </motion.div>
  )
}

function ProductGridCard({ product, delay }: { product: Product; delay: number }) {
  return (
    <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay }}>
      <Link
        href={`/revenue/products/${product.id}`}
        className="group bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all block"
      >
        {/* Image placeholder */}
        <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Package className="h-10 w-10 text-gray-300" />
        </div>
        <div className="p-4">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 transition-colors">
            {product.name}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 uppercase">{product.sku}</p>
          <div className="flex items-center justify-between mt-3">
            <p className="text-base font-black text-gray-900 dark:text-gray-100 tabular-nums">
              {formatCents(product.priceInCents)}
            </p>
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium tabular-nums',
                inventoryBadgeColor(product.inventory)
              )}
            >
              {product.inventory} in stock
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Page ───────────────────────────────────────────────────
interface ProductsClientProps {
  initialProducts: Product[]
}

export default function ProductsClient({ initialProducts }: ProductsClientProps) {
  const [products] = useState<Product[]>(initialProducts)
  const [category, setCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const filtered = products.filter((p) => {
    if (category !== 'all' && p.category !== category) return false
    if (inStockOnly && p.inventory === 0) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalProducts = products.length
  const inStock = products.filter((p) => p.inventory > 0).length
  const lowStock = products.filter((p) => p.inventory >= 1 && p.inventory <= 10).length
  const outOfStock = products.filter((p) => p.inventory === 0).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0F11]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Products</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage merchandise and inventory</p>
        </div>
        <Link
          href="/revenue/products/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Link>
      </div>

      {/* ─── KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={Package} label="Total Products" value={String(totalProducts)} iconBg="bg-indigo-50 text-indigo-600" delay={0} />
        <MetricCard icon={CheckCircle} label="In Stock" value={String(inStock)} iconBg="bg-emerald-50 text-emerald-600" delay={0.05} />
        <MetricCard icon={AlertTriangle} label="Low Stock" value={String(lowStock)} iconBg="bg-amber-50 text-amber-600" delay={0.1} />
        <MetricCard icon={XCircle} label="Out of Stock" value={String(outOfStock)} iconBg="bg-red-50 text-red-600" delay={0.15} />
      </div>

      {/* ─── Filters ──────────────────────────────────────────── */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.1 }}
        className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 mb-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Category pills */}
          <div className="flex items-center gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  category === cat.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search products or SKUs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
            />
          </div>

          {/* In-stock toggle */}
          <button
            onClick={() => setInStockOnly(!inStockOnly)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border',
              inStockOnly
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white dark:bg-gray-950 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
            )}
          >
            In Stock Only
          </button>

          {/* View toggle */}
          <div className="flex items-center gap-1 border border-gray-200 dark:border-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'table' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ─── Product Grid ─────────────────────────────────────── */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((product, i) => (
              <ProductGridCard key={product.id} product={product} delay={i * 0.03} />
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No products found</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try adjusting your filters</p>
            </div>
          )}
        </div>
      ) : (
        /* ─── Table View ─────────────────────────────────────── */
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.15 }}
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden"
        >
          {/* Table header */}
          <div className="flex items-center gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
            <div className="w-10" />
            <div className="flex-1 min-w-0">Product</div>
            <div className="w-24">Category</div>
            <div className="w-20 text-right">Price</div>
            <div className="w-24 text-right">Inventory</div>
            <div className="w-20 text-center">Status</div>
            <div className="w-16 text-right">Actions</div>
          </div>

          <div className="divide-y divide-gray-50">
            {filtered.map((product) => (
              <Link
                key={product.id}
                href={`/revenue/products/${product.id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-gray-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 transition-colors">
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{product.sku}</p>
                </div>
                <div className="w-24">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 capitalize">
                    {product.category}
                  </span>
                </div>
                <div className="w-20 text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                    {formatCents(product.priceInCents)}
                  </p>
                </div>
                <div className="w-24 text-right">
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium tabular-nums',
                      inventoryBadgeColor(product.inventory)
                    )}
                  >
                    {product.inventory}
                  </span>
                </div>
                <div className="w-20 text-center">
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      product.active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    )}
                  >
                    {product.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="w-16 text-right">
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-indigo-50 transition-colors">
                    <Pencil className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 group-hover:text-indigo-600" />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No products found</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try adjusting your filters</p>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
