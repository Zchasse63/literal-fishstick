'use client'

import { motion } from 'framer-motion'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  FileCheck,
  AlertTriangle,
  XCircle,
  Pencil,
  Heart,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

const certifications = [
  { name: 'CPR / First Aid', issuer: 'American Red Cross', expires: 'Apr 1, 2026', status: 'expiring' as const },
  { name: 'Breathwork Facilitator', issuer: 'International Breathwork Foundation', expires: 'Nov 15, 2026', status: 'current' as const },
  { name: 'Personal Training (NASM)', issuer: 'NASM', expires: 'Sep 30, 2026', status: 'current' as const },
  { name: 'Lifeguard Certification', issuer: 'American Red Cross', expires: 'Jan 12, 2025', status: 'expired' as const },
]

const documents = [
  { name: 'Employment Agreement', signed: 'Jun 15, 2024' },
  { name: 'NDA — Confidentiality Agreement', signed: 'Jun 15, 2024' },
  { name: 'Safety & Emergency Procedures', signed: 'Jun 20, 2024' },
  { name: 'Direct Deposit Authorization', signed: 'Jun 15, 2024' },
]

const certStatusConfig = {
  current: { icon: Shield, label: 'Current', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  expiring: { icon: AlertTriangle, label: 'Expiring Soon', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  expired: { icon: XCircle, label: 'Expired', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
}

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center">
          <span className="text-white text-xl font-bold">WC</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Whitney Cooper</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 text-xs font-bold uppercase tracking-wider">
              Trainer
            </span>
            <span className="text-sm text-gray-500">Since June 2024</span>
          </div>
        </div>
      </motion.div>

      {/* Personal Info + Emergency Contact */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Personal Info */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.05 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Personal Information</h3>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Full Name</p>
                <p className="text-sm font-medium text-gray-900">Whitney Cooper</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Email</p>
                <p className="text-sm font-medium text-gray-900">whitney@meridianstudio.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Phone</p>
                <p className="text-sm font-medium text-gray-900">(813) 555-0182</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Address</p>
                <p className="text-sm font-medium text-gray-900">1245 Bay Shore Blvd, Tampa, FL 33606</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Emergency Contact + Employment */}
        <div className="space-y-5">
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <h3 className="text-sm font-bold text-gray-900 mb-4">Emergency Contact</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Heart className="w-4 h-4 text-red-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Sarah Cooper</p>
                  <p className="text-xs text-gray-500">Sister — (813) 555-0199</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.15 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <h3 className="text-sm font-bold text-gray-900 mb-4">Employment Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Hire Date</span>
                <span className="text-sm font-medium text-gray-900">June 15, 2024</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Role</span>
                <span className="text-sm font-medium text-gray-900">Trainer / Instructor</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Pay Rate</span>
                <span className="text-sm font-medium text-gray-900">$28.00/hr + bonuses</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Employment Type</span>
                <span className="text-sm font-medium text-gray-900">Part-Time</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Certifications */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.2 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
      >
        <h3 className="text-sm font-bold text-gray-900 mb-4">Certifications</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {certifications.map((cert, i) => {
            const status = certStatusConfig[cert.status]
            return (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border',
                  status.bg, status.border
                )}
              >
                <status.icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', status.color)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{cert.name}</p>
                  <p className="text-xs text-gray-500">{cert.issuer}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">Expires {cert.expires}</span>
                  </div>
                </div>
                <span className={cn(
                  'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex-shrink-0',
                  status.bg, status.color
                )}>
                  {status.label}
                </span>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Signed Documents */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.25 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
      >
        <h3 className="text-sm font-bold text-gray-900 mb-4">Signed Documents</h3>
        <div className="space-y-2">
          {documents.map((doc, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <FileCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-gray-900">{doc.name}</span>
              </div>
              <span className="text-xs text-gray-500">Signed {doc.signed}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
