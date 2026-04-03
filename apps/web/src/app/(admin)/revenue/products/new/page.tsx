'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Package,
  Save,
  ImagePlus,
  Loader2,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

const CATEGORIES = [
  { value: 'apparel', label: 'Apparel' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'supplements', label: 'Supplements' },
]

export default function NewProductPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priceStr, setPriceStr] = useState('')
  const [compareAtPriceStr, setCompareAtPriceStr] = useState('')
  const [category, setCategory] = useState('apparel')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [inventory, setInventory] = useState('0')
  const [lowStockThreshold, setLowStockThreshold] = useState('5')
  const [active, setActive] = useState(true)

  async function handleSave() {
    if (!name.trim()) {
      setError('Product name is required.')
      return
    }
    const priceInCents = Math.round(parseFloat(priceStr || '0') * 100)
    if (priceInCents <= 0) {
      setError('Price must be greater than zero.')
      return
    }

    setSaving(true)
    setError(null)

    const supabase = createBrowserClient()
    const compareAtPriceInCents = compareAtPriceStr
      ? Math.round(parseFloat(compareAtPriceStr) * 100)
      : null

    const { data, error: insertError } = await supabase
      .from('products')
      .insert({
        studio_id: STUDIO_ID,
        name: name.trim(),
        description: description.trim() || null,
        price_in_cents: priceInCents,
        compare_at_price_in_cents: compareAtPriceInCents,
        category,
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        inventory: parseInt(inventory, 10) || 0,
        low_stock_threshold: parseInt(lowStockThreshold, 10) || 5,
        active,
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    router.push(`/revenue/products/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="max-w-[800px] mx-auto px-6 py-8">
        {/* Back */}
        <motion.div {...fadeInUp}>
          <Link
            href="/revenue/products"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Products
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.05 }} className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Package className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">New Product</h1>
            <p className="text-sm text-gray-500 mt-0.5">Add a new product to your inventory</p>
          </div>
        </motion.div>

        {/* Form */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.1 }}
          className="space-y-6"
        >
          {/* Basic Info */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Basic Information</h2>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Meridian Logo Tee"
                className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1.5">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the product..."
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors resize-none"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1.5">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Image Placeholder */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Product Image</h2>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
              <ImagePlus className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Image upload coming soon</p>
              <p className="text-xs text-gray-400 mt-1">Drag and drop or click to upload (Phase 2)</p>
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pricing</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceStr}
                    onChange={(e) => setPriceStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-200 pl-7 pr-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="compareAtPrice" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Compare-at Price
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <input
                    id="compareAtPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={compareAtPriceStr}
                    onChange={(e) => setCompareAtPriceStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-200 pl-7 pr-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Inventory */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Inventory</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1.5">
                  SKU
                </label>
                <input
                  id="sku"
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="e.g., TSG-TEE-BLK-M"
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="barcode" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Barcode
                </label>
                <input
                  id="barcode"
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="UPC or EAN"
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="inventory" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Initial Stock
                </label>
                <input
                  id="inventory"
                  type="number"
                  min="0"
                  value={inventory}
                  onChange={(e) => setInventory(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="lowStock" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Low Stock Threshold
                </label>
                <input
                  id="lowStock"
                  type="number"
                  min="0"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Status</h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                onClick={() => setActive(!active)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
                  active ? 'bg-indigo-600' : 'bg-gray-200'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    active ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">
                {active ? 'Active — visible in store' : 'Inactive — hidden from store'}
              </span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/revenue/products"
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Creating...' : 'Create Product'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
