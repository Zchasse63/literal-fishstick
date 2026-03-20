'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  User,
  CreditCard,
  FileText,
  Save,
  Tag,
  X,
} from 'lucide-react'

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Page ───────────────────────────────────────────────────
export default function NewCompanyPage() {
  const [tags, setTags] = useState<string[]>(['enterprise', 'tampa'])
  const [tagInput, setTagInput] = useState('')
  const [autoRenew, setAutoRenew] = useState(true)

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all'
  const labelClass = 'text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="min-h-screen bg-[#FAFAFA]"
    >
      {/* Back Link */}
      <Link
        href="/corporate"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Corporate
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">New Corporate Account</h1>
          <p className="text-sm text-gray-500 mt-0.5">Add a new company partnership</p>
        </div>
        <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
          <Save className="h-4 w-4" />
          Save Account
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column — Main Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Company Info */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-indigo-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Company Information</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Company Name</label>
                <input type="text" placeholder="e.g. Acme Corp" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Legal Name</label>
                <input type="text" placeholder="e.g. Acme Corporation LLC" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Industry</label>
                <input type="text" placeholder="e.g. Technology, Healthcare" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Company Size</label>
                <select className={inputClass}>
                  <option value="">Select size...</option>
                  <option value="1-10">1-10 employees</option>
                  <option value="11-50">11-50 employees</option>
                  <option value="51-200">51-200 employees</option>
                  <option value="201-500">201-500 employees</option>
                  <option value="500+">500+ employees</option>
                </select>
              </div>
            </div>
          </motion.div>

          {/* Primary Contact */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.05 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                <User className="h-4 w-4 text-indigo-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Primary Contact</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Contact Name</label>
                <input type="text" placeholder="e.g. John Smith" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Title</label>
                <input type="text" placeholder="e.g. HR Director" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" placeholder="e.g. john@acme.com" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input type="tel" placeholder="e.g. (813) 555-0100" className={inputClass} />
              </div>
            </div>
          </motion.div>

          {/* Billing */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-indigo-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Billing</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Billing Email</label>
                <input type="email" placeholder="e.g. billing@acme.com" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Payment Terms</label>
                <select className={inputClass}>
                  <option value="net15">Net 15</option>
                  <option value="net30">Net 30</option>
                  <option value="net45">Net 45</option>
                  <option value="net60">Net 60</option>
                  <option value="due_on_receipt">Due on Receipt</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Street Address</label>
                <input type="text" placeholder="e.g. 123 Main St" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input type="text" placeholder="e.g. Tampa" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>State</label>
                  <input type="text" placeholder="FL" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>ZIP</label>
                  <input type="text" placeholder="33601" className={inputClass} />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Contract */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.15 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                <FileText className="h-4 w-4 text-indigo-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Contract</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Start Date</label>
                <input type="date" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>End Date</label>
                <input type="date" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Contract Value (Annual)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <input type="number" placeholder="0.00" className={cn(inputClass, 'pl-7')} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Monthly Credit Allocation</label>
                <input type="number" placeholder="e.g. 30" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Rollover Cap</label>
                <input type="number" placeholder="e.g. 10" className={inputClass} />
              </div>
              <div className="flex items-end">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAutoRenew(!autoRenew)}
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      autoRenew ? 'bg-indigo-600' : 'bg-gray-200'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                        autoRenew ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                  <label className="text-sm font-semibold text-gray-700">Auto-Renew</label>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column — Status, Tags, Notes */}
        <div className="space-y-4">
          {/* Status */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.05 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <h3 className="text-base font-bold text-gray-900 mb-3">Status</h3>
            <select className={inputClass}>
              <option value="prospect">Prospect</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </motion.div>

          {/* Tags */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <h3 className="text-base font-bold text-gray-900 mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-xs font-semibold text-gray-600"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-gray-900 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                className={cn(inputClass, 'flex-1')}
              />
              <button
                onClick={addTag}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:border-gray-300 transition-colors"
              >
                Add
              </button>
            </div>
          </motion.div>

          {/* Notes */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.15 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <h3 className="text-base font-bold text-gray-900 mb-3">Notes</h3>
            <textarea
              rows={6}
              placeholder="Add any notes about this company..."
              className={cn(inputClass, 'resize-none')}
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
