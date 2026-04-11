'use client'

import { cn } from '@/lib/utils'
import {
  Lock,
  Pencil,
  Check,
} from 'lucide-react'
import type { PermissionRow } from './types'

function PermCheckbox({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange?: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'inline-flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-150',
        checked
          ? 'bg-indigo-600 border-indigo-600 text-white'
          : 'bg-white dark:bg-gray-950 border-gray-300',
        disabled && !checked && 'opacity-40',
        disabled && checked && 'opacity-70',
        !disabled && !checked && 'hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer',
        !disabled && checked && 'hover:bg-indigo-700 cursor-pointer',
        disabled && 'cursor-default'
      )}
    >
      {checked && <Check className="h-3 w-3" />}
    </button>
  )
}

export default function PermissionsTab({
  permissions,
  setPermissions,
  editMode,
  setEditMode,
}: {
  permissions: PermissionRow[]
  setPermissions: (p: PermissionRow[]) => void
  editMode: boolean
  setEditMode: (b: boolean) => void
}) {
  const categories = [...new Set(permissions.map(p => p.category))]

  function togglePermission(idx: number, role: 'admin' | 'trainer' | 'receptionist') {
    if (!editMode) return
    const updated = [...permissions]
    updated[idx] = { ...updated[idx], [role]: !updated[idx][role] }
    setPermissions(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Role Permissions</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Define what each role can access and modify</p>
        </div>
        <button
          onClick={() => setEditMode(!editMode)}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
            editMode
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          )}
        >
          {editMode ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          {editMode ? 'Save Changes' : 'Edit Mode'}
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 w-48">Permission</th>
                <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  <div className="flex items-center justify-center gap-1">
                    Owner
                    <Lock className="h-3 w-3 text-gray-300" />
                  </div>
                </th>
                <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Admin</th>
                <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Trainer</th>
                <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Receptionist</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <>
                  <tr key={`cat-${cat}`} className="bg-gray-50 dark:bg-gray-900/80">
                    <td colSpan={5} className="px-5 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{cat}</span>
                    </td>
                  </tr>
                  {permissions.filter(p => p.category === cat).map((perm, _i) => {
                    const globalIdx = permissions.indexOf(perm)
                    return (
                      <tr key={perm.permission} className="border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300">{perm.permission}</td>
                        <td className="px-5 py-3 text-center">
                          <PermCheckbox checked={perm.owner} disabled />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <PermCheckbox
                            checked={perm.admin}
                            disabled={!editMode}
                            onChange={() => togglePermission(globalIdx, 'admin')}
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <PermCheckbox
                            checked={perm.trainer}
                            disabled={!editMode}
                            onChange={() => togglePermission(globalIdx, 'trainer')}
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <PermCheckbox
                            checked={perm.receptionist}
                            disabled={!editMode}
                            onChange={() => togglePermission(globalIdx, 'receptionist')}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
