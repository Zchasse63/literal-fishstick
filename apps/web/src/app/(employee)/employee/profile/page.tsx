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
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmployeeProfile, useEmployeeDocuments } from '@/hooks/use-employee'
import { useAuth } from '@/contexts/auth-context'
import { fadeInUp } from '@/lib/motion'

const certStatusConfig = {
  current: { icon: Shield, label: 'Current', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  expiring: { icon: AlertTriangle, label: 'Expiring Soon', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  expired: { icon: XCircle, label: 'Expired', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
}

function getCertStatus(expiresAt: string | null): 'current' | 'expiring' | 'expired' {
  if (!expiresAt) return 'current'
  const daysUntil = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
  if (daysUntil < 0) return 'expired'
  if (daysUntil <= 30) return 'expiring'
  return 'current'
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function ProfilePage() {
  const { profile } = useAuth()
  const { employee, trainer, fullName, email, phone, loading: profileLoading } = useEmployeeProfile()
  const { documents, loading: docsLoading } = useEmployeeDocuments(employee?.id)

  const loading = profileLoading || docsLoading

  // Separate certifications (have expiry) from signed documents
  const certifications = documents.filter((d) => d.document_type === 'certification' || d.expires_at)
  const signedDocs = documents.filter((d) => d.document_type !== 'certification' && !d.expires_at)

  const roles = profile?.roles ?? []
  const roleLabel = roles.includes('trainer') ? 'Trainer' : roles.includes('admin') ? 'Admin' : 'Employee'
  const hireDate = employee?.hire_date
    ? new Date(employee.hire_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null
  const hireDateFull = employee?.hire_date
    ? new Date(employee.hire_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'N/A'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center">
          <span className="text-white text-xl font-bold">{getInitials(fullName)}</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fullName}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 text-xs font-bold uppercase tracking-wider">
              {roleLabel}
            </span>
            {hireDate && <span className="text-sm text-gray-500 dark:text-gray-400">Since {hireDate}</span>}
          </div>
        </div>
      </motion.div>

      {/* Personal Info + Emergency Contact */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Personal Info */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.05 }}
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Personal Information</h3>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Full Name</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{fullName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Email</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{email}</p>
              </div>
            </div>
            {phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Phone</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{phone}</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Emergency Contact + Employment */}
        <div className="space-y-5">
          {employee?.emergency_contact_name && (
            <motion.div
              {...fadeInUp}
              transition={{ ...fadeInUp.transition, delay: 0.1 }}
              className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
            >
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">Emergency Contact</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Heart className="w-4 h-4 text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{employee.emergency_contact_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {employee.emergency_contact_relationship ?? 'Contact'}
                      {employee.emergency_contact_phone ? ` — ${employee.emergency_contact_phone}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.15 }}
            className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
          >
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">Employment Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Hire Date</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{hireDateFull}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Role</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {roleLabel}{trainer ? ' / Instructor' : ''}
                </span>
              </div>
              {employee?.pay_rate && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Pay Rate</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    ${employee.pay_rate.toFixed(2)}/{employee.pay_type === 'salary' ? 'yr' : 'hr'} + bonuses
                  </span>
                </div>
              )}
              {employee?.employment_type && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Employment Type</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{employee.employment_type}</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Certifications */}
      {certifications.length > 0 && (
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.2 }}
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
        >
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">Certifications</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {certifications.map((cert) => {
              const certStatus = getCertStatus(cert.expires_at)
              const status = certStatusConfig[certStatus]
              return (
                <div
                  key={cert.id}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border',
                    status.bg, status.border
                  )}
                >
                  <status.icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', status.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{cert.name}</p>
                    {cert.expires_at && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Calendar className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Expires {new Date(cert.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )}
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
      )}

      {/* Signed Documents */}
      {signedDocs.length > 0 && (
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.25 }}
          className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5"
        >
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">Signed Documents</h3>
          <div className="space-y-2">
            {signedDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-center gap-3">
                  <FileCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{doc.name}</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {doc.uploaded_at
                    ? `Signed ${new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : ''}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
