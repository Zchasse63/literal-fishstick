'use client'

import { useState, useCallback, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Play,
  Zap,
  Mail,
  Clock,
  GitBranch,
  Loader2,
  Phone,
  Tag,
  Plus,
  X,
  ChevronDown,
  AlertCircle,
  Trash2,
  MessageSquare,
  Repeat,
  UserX,
  TrendingDown,
  Target,
  Users,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ──────────────────────────────────────────────────
type TriggerType =
  | 'signup'
  | 'no_show'
  | 'churn_risk'
  | 'credit_expiry'
  | 'birthday'
  | 'milestone'
  | 'membership_change'
  | 'booking_completed'
  | 'failed_payment'
  | 'inactivity'
  | 'referral'

type StepType = 'trigger' | 'email' | 'wait' | 'condition' | 'sms' | 'tag'

interface NodeData {
  stepType: StepType
  label: string
  sublabel?: string
  subject?: string
  body?: string
  duration?: number
  durationUnit?: 'minutes' | 'hours' | 'days'
  conditionField?: string
  conditionOp?: string
  conditionValue?: string
  tagName?: string
  tagAction?: 'add' | 'remove'
  triggerType?: TriggerType
  branchLabel?: string
}

// ─── Trigger options ────────────────────────────────────────
const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: 'signup', label: 'New Signup' },
  { value: 'no_show', label: 'No-Show' },
  { value: 'churn_risk', label: 'Churn Risk (AI)' },
  { value: 'credit_expiry', label: 'Credit Expiry' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'milestone', label: 'Milestone Reached' },
  { value: 'membership_change', label: 'Membership Change' },
  { value: 'booking_completed', label: 'Booking Completed' },
  { value: 'failed_payment', label: 'Failed Payment' },
  { value: 'inactivity', label: 'Inactivity' },
  { value: 'referral', label: 'Referral' },
]

const CONDITION_FIELDS = [
  { value: 'email_opened', label: 'Email Opened' },
  { value: 'link_clicked', label: 'Link Clicked' },
  { value: 'days_since_last_visit', label: 'Days Since Last Visit' },
  { value: 'membership_type', label: 'Membership Type' },
]

const NODE_PALETTE: { type: StepType; label: string; icon: typeof Mail; color: string }[] = [
  { type: 'email', label: 'Send Email', icon: Mail, color: 'bg-indigo-600' },
  { type: 'wait', label: 'Wait', icon: Clock, color: 'bg-gray-50 dark:bg-gray-9000' },
  { type: 'condition', label: 'Condition', icon: GitBranch, color: 'bg-amber-500' },
  { type: 'sms', label: 'Send SMS', icon: Phone, color: 'bg-emerald-600' },
  { type: 'tag', label: 'Add/Remove Tag', icon: Tag, color: 'bg-violet-600' },
]

// ─── Default Flow Nodes & Edges ─────────────────────────────
const defaultNodes: Node<NodeData>[] = [
  {
    id: 'trigger-1',
    type: 'triggerNode',
    position: { x: 300, y: 40 },
    data: { stepType: 'trigger', label: 'New Signup', triggerType: 'signup' },
  },
  {
    id: 'wait-1',
    type: 'waitNode',
    position: { x: 300, y: 180 },
    data: { stepType: 'wait', label: 'Wait 1 day', duration: 1, durationUnit: 'days' },
  },
  {
    id: 'email-1',
    type: 'emailNode',
    position: { x: 300, y: 320 },
    data: { stepType: 'email', label: 'Welcome Email', subject: 'Welcome to The Sauna Guys!', body: 'Hi {{first_name}}, welcome to the crew! Here is what to expect for your first session...' },
  },
  {
    id: 'condition-1',
    type: 'conditionNode',
    position: { x: 300, y: 480 },
    data: { stepType: 'condition', label: 'Opened email?', conditionField: 'email_opened', conditionOp: 'equals', conditionValue: 'true' },
  },
  {
    id: 'tag-1',
    type: 'tagNode',
    position: { x: 100, y: 660 },
    data: { stepType: 'tag', label: 'Tag: engaged', tagName: 'engaged', tagAction: 'add', branchLabel: 'Yes' },
  },
  {
    id: 'wait-2',
    type: 'waitNode',
    position: { x: 500, y: 660 },
    data: { stepType: 'wait', label: 'Wait 2 days', duration: 2, durationUnit: 'days', branchLabel: 'No' },
  },
  {
    id: 'email-2',
    type: 'emailNode',
    position: { x: 500, y: 800 },
    data: { stepType: 'email', label: 'Follow-up', subject: 'Did you see our welcome guide?', body: 'Hi {{first_name}}, just checking in! Here are some tips for getting the most out of your sauna sessions...' },
  },
]

const defaultEdges: Edge[] = [
  { id: 'e-trigger-wait', source: 'trigger-1', target: 'wait-1', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' } },
  { id: 'e-wait-email', source: 'wait-1', target: 'email-1', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' } },
  { id: 'e-email-condition', source: 'email-1', target: 'condition-1', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' } },
  { id: 'e-condition-yes', source: 'condition-1', sourceHandle: 'yes', target: 'tag-1', animated: true, style: { stroke: '#10b981', strokeWidth: 2 }, label: 'Yes', labelStyle: { fontWeight: 700, fontSize: 11, fill: '#10b981' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' } },
  { id: 'e-condition-no', source: 'condition-1', sourceHandle: 'no', target: 'wait-2', animated: true, style: { stroke: '#f97316', strokeWidth: 2 }, label: 'No', labelStyle: { fontWeight: 700, fontSize: 11, fill: '#f97316' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },
  { id: 'e-wait2-email2', source: 'wait-2', target: 'email-2', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' } },
]

// ─── Custom Nodes ───────────────────────────────────────────

function TriggerNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div className={cn(
      'w-56 px-4 py-3 rounded-2xl bg-blue-600 text-white shadow-lg border-2 transition-all',
      selected ? 'border-blue-300 ring-2 ring-blue-300/30' : 'border-blue-500'
    )}>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-blue-200 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Trigger</p>
          <p className="text-sm font-semibold truncate">{data.label}</p>
        </div>
      </div>
    </div>
  )
}

function EmailNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div className={cn(
      'w-56 px-4 py-3 rounded-2xl bg-indigo-600 text-white shadow-lg border-2 transition-all',
      selected ? 'border-indigo-300 ring-2 ring-indigo-300/30' : 'border-indigo-500'
    )}>
      <Handle type="target" position={Position.Top} className="!bg-indigo-400 !w-3 !h-3 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-indigo-200 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Email</p>
          <p className="text-sm font-semibold truncate">{data.subject || data.label}</p>
        </div>
      </div>
    </div>
  )
}

function WaitNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div className={cn(
      'w-56 px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-9000 text-white shadow-lg border-2 transition-all',
      selected ? 'border-gray-300 ring-2 ring-gray-300/30' : 'border-gray-400'
    )}>
      <Handle type="target" position={Position.Top} className="!bg-gray-300 !w-3 !h-3 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-300 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-gray-200 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-200">Wait</p>
          <p className="text-sm font-semibold truncate">
            {data.duration} {data.durationUnit}
          </p>
        </div>
      </div>
    </div>
  )
}

function ConditionNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div className={cn(
      'w-56 px-4 py-4 bg-amber-50 border-2 shadow-lg transition-all',
      selected ? 'border-amber-400 ring-2 ring-amber-300/30' : 'border-amber-300',
    )} style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Handle type="target" position={Position.Top} className="!bg-amber-400 !w-3 !h-3 !border-2 !border-white" style={{ top: -6 }} />
      <Handle type="source" position={Position.Left} id="yes" className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-white" style={{ left: -6 }} />
      <Handle type="source" position={Position.Right} id="no" className="!bg-orange-500 !w-3 !h-3 !border-2 !border-white" style={{ right: -6 }} />
      <div className="text-center">
        <GitBranch className="h-4 w-4 text-amber-500 mx-auto mb-0.5" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Condition</p>
        <p className="text-xs font-semibold text-amber-800 mt-0.5">{data.label}</p>
      </div>
    </div>
  )
}

function SMSNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div className={cn(
      'w-56 px-4 py-3 rounded-2xl bg-emerald-600 text-white shadow-lg border-2 transition-all relative',
      selected ? 'border-emerald-300 ring-2 ring-emerald-300/30' : 'border-emerald-500'
    )}>
      <Handle type="target" position={Position.Top} className="!bg-emerald-400 !w-3 !h-3 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-400 !w-3 !h-3 !border-2 !border-white" />
      <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wider">Stub</span>
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-emerald-200 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">SMS</p>
          <p className="text-sm font-semibold truncate">{data.body || data.label}</p>
        </div>
      </div>
    </div>
  )
}

function TagNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div className={cn(
      'w-56 px-4 py-3 rounded-2xl bg-violet-600 text-white shadow-lg border-2 transition-all',
      selected ? 'border-violet-300 ring-2 ring-violet-300/30' : 'border-violet-500'
    )}>
      <Handle type="target" position={Position.Top} className="!bg-violet-400 !w-3 !h-3 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!bg-violet-400 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-violet-200 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-200">
            {data.tagAction === 'remove' ? 'Remove Tag' : 'Add Tag'}
          </p>
          <p className="text-sm font-semibold truncate">{data.tagName || data.label}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Config Panels ──────────────────────────────────────────

function TriggerConfigPanel({
  triggerType,
  setTriggerType,
  inactivityDays,
  setInactivityDays,
  exitCondition,
  setExitCondition,
}: {
  triggerType: TriggerType
  setTriggerType: (t: TriggerType) => void
  inactivityDays: number
  setInactivityDays: (d: number) => void
  exitCondition: string
  setExitCondition: (e: string) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-2">Trigger Type</label>
        <div className="relative">
          <select
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value as TriggerType)}
            className="w-full appearance-none bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-8"
          >
            {TRIGGER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {triggerType === 'inactivity' && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-2">Days Inactive</label>
          <input
            type="number"
            value={inactivityDays}
            onChange={(e) => setInactivityDays(Number(e.target.value))}
            min={1}
            className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </motion.div>
      )}

      {triggerType === 'milestone' && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-2">Milestone Type</label>
          <select className="w-full appearance-none bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
            <option value="10_sessions">10 Sessions</option>
            <option value="25_sessions">25 Sessions</option>
            <option value="50_sessions">50 Sessions</option>
            <option value="100_sessions">100 Sessions</option>
            <option value="1_year">1 Year Anniversary</option>
          </select>
        </motion.div>
      )}

      <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Exit Conditions</label>
        </div>
        <textarea
          value={exitCondition}
          onChange={(e) => setExitCondition(e.target.value)}
          placeholder="e.g., Member books a class, membership becomes active..."
          rows={3}
          className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 dark:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
        />
      </div>
    </div>
  )
}

function StepConfigPanel({
  node,
  onUpdate,
  onDelete,
  onClose,
}: {
  node: Node<NodeData>
  onUpdate: (id: string, data: Partial<NodeData>) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const d = node.data

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 capitalize">{d.stepType} Configuration</h3>
        <button onClick={onClose} className="h-7 w-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 transition-colors">
          <X className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {d.stepType === 'email' && (
        <>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-2">Subject Line</label>
            <input
              type="text"
              value={d.subject || ''}
              onChange={(e) => onUpdate(node.id, { subject: e.target.value })}
              className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter email subject..."
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-2">Body</label>
            <textarea
              value={d.body || ''}
              onChange={(e) => onUpdate(node.id, { body: e.target.value })}
              rows={5}
              className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Write your email body..."
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['{{first_name}}', '{{studio_name}}', '{{next_class}}', '{{membership_type}}'].map((tag) => (
                <button
                  key={tag}
                  onClick={() => onUpdate(node.id, { body: (d.body || '') + ' ' + tag })}
                  className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-100 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {d.stepType === 'wait' && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-2">Duration</label>
            <input
              type="number"
              value={d.duration || 1}
              onChange={(e) => onUpdate(node.id, { duration: Number(e.target.value), label: `Wait ${e.target.value} ${d.durationUnit || 'days'}` })}
              min={1}
              className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-2">Unit</label>
            <select
              value={d.durationUnit || 'days'}
              onChange={(e) => {
                const unit = e.target.value as 'minutes' | 'hours' | 'days'
                onUpdate(node.id, { durationUnit: unit, label: `Wait ${d.duration || 1} ${unit}` })
              }}
              className="w-full appearance-none bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </div>
      )}

      {d.stepType === 'condition' && (
        <>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-2">Field</label>
            <select
              value={d.conditionField || 'email_opened'}
              onChange={(e) => onUpdate(node.id, { conditionField: e.target.value })}
              className="w-full appearance-none bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {CONDITION_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-2">Comparison</label>
              <select
                value={d.conditionOp || 'equals'}
                onChange={(e) => onUpdate(node.id, { conditionOp: e.target.value })}
                className="w-full appearance-none bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="equals">Equals</option>
                <option value="not_equals">Not Equals</option>
                <option value="greater_than">Greater Than</option>
                <option value="less_than">Less Than</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-2">Value</label>
              <input
                type="text"
                value={d.conditionValue || ''}
                onChange={(e) => onUpdate(node.id, { conditionValue: e.target.value })}
                className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="true"
              />
            </div>
          </div>
        </>
      )}

      {d.stepType === 'sms' && (
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-2">Message Body</label>
          <textarea
            value={d.body || ''}
            onChange={(e) => onUpdate(node.id, { body: e.target.value })}
            rows={4}
            maxLength={160}
            className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            placeholder="Type your SMS message..."
          />
          <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-1 text-right tabular-nums">
            {(d.body || '').length}/160 characters
          </p>
          <div className="flex items-center gap-1.5 mt-2 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <p className="text-[10px] text-amber-700 font-medium">SMS provider is stubbed. Messages will not be sent.</p>
          </div>
        </div>
      )}

      {d.stepType === 'tag' && (
        <>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-2">Tag Name</label>
            <input
              type="text"
              value={d.tagName || ''}
              onChange={(e) => onUpdate(node.id, { tagName: e.target.value, label: `Tag: ${e.target.value}` })}
              className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="e.g., engaged, at-risk, vip"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-2">Action</label>
            <div className="flex gap-2">
              {(['add', 'remove'] as const).map((action) => (
                <button
                  key={action}
                  onClick={() => onUpdate(node.id, { tagAction: action })}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all capitalize',
                    (d.tagAction || 'add') === action
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  )}
                >
                  {action} Tag
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => onDelete(node.id)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors w-full justify-center"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Step
        </button>
      </div>
    </div>
  )
}

// ─── Template category config ─────────────────────────────
const TEMPLATE_CATEGORIES: Record<string, { label: string; color: string }> = {
  onboarding: { label: 'Onboarding', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  retention: { label: 'Retention', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  upsell: { label: 'Upsell', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300' },
  engagement: { label: 'Engagement', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  winback: { label: 'Win-Back', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
  conversion: { label: 'Conversion', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' },
}

const TRIGGER_ICONS: Record<string, typeof Mail> = {
  never_booked: UserX,
  classpass_repeat: Repeat,
  one_and_done: TrendingDown,
  cooling_off: AlertCircle,
  plan_upgrade_candidate: Target,
  class_type_fan: Sparkles,
  signup: Users,
  inactivity: Clock,
  failed_payment: AlertCircle,
  churn_risk: Zap,
}

interface TemplateData {
  slug: string
  name: string
  description: string
  trigger_type: string
  category: string
  steps: unknown[]
}

// ─── Template Gallery ─────────────────────────────────────
function TemplateGallery({ onSelectTemplate, onSkip }: { onSelectTemplate: (t: TemplateData) => void; onSkip: () => void }) {
  const [templates, setTemplates] = useState<TemplateData[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchTemplates() {
      try {
        const res = await fetch('/api/automations/templates')
        if (res.ok) {
          const json = await res.json()
          if (!cancelled) {
            setTemplates(json.data ?? [])
          }
        }
      } catch (err) {
        console.error('Failed to load automation templates:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchTemplates()
    return () => { cancelled = true }
  }, [])

  const filteredTemplates = useMemo(() => {
    if (!filterCategory) return templates
    return templates.filter((t) => t.category === filterCategory)
  }, [templates, filterCategory])

  const categories = useMemo(() => {
    const cats = new Set(templates.map((t) => t.category))
    return Array.from(cats)
  }, [templates])

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/marketing/automations"
            className="h-9 w-9 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Choose a Template</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Start with a pre-built automation flow or build from scratch</p>
          </div>
        </div>
        <button
          onClick={onSkip}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Start from Scratch
        </button>
      </div>

      {/* Category Filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterCategory(null)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
            !filterCategory
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          )}
        >
          All
        </button>
        {categories.map((cat) => {
          const config = TEMPLATE_CATEGORIES[cat]
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize',
                filterCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              {config?.label ?? cat}
            </button>
          )
        })}
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm text-gray-400 dark:text-gray-500">No templates found for this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const catConfig = TEMPLATE_CATEGORIES[template.category]
            const TriggerIcon = TRIGGER_ICONS[template.trigger_type] ?? Zap

            return (
              <div
                key={template.slug}
                className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                    <TriggerIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                      {template.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {catConfig && (
                        <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider', catConfig.color)}>
                          {catConfig.label}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                        {template.steps.length} steps
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4 line-clamp-2">
                  {template.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    <Zap className="h-3 w-3" />
                    {template.trigger_type.replace(/_/g, ' ')}
                  </span>
                  <button
                    onClick={() => onSelectTemplate(template)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    Use Template
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

// ─── Flow Builder (inner component) ────────────────────────
function FlowBuilderInner() {
  const searchParams = useSearchParams()
  const templateId = searchParams.get('template')

  // Show template gallery when no template is pre-selected
  const [showGallery, setShowGallery] = useState(!templateId)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateData | null>(null)

  const handleSelectTemplate = useCallback((template: TemplateData) => {
    setSelectedTemplate(template)
    setShowGallery(false)
  }, [])

  const handleSkipGallery = useCallback(() => {
    setShowGallery(false)
  }, [])

  // Resolve initial name and trigger from template (URL param or gallery selection)
  const resolvedTemplateName = selectedTemplate?.name ?? (templateId ? getTemplateName(templateId) : 'New Automation')
  const resolvedTriggerType = (selectedTemplate?.trigger_type as TriggerType) ?? (templateId ? getTemplateTrigger(templateId) : 'signup')

  const [flowName, setFlowName] = useState(resolvedTemplateName)
  const [triggerType, setTriggerType] = useState<TriggerType>(resolvedTriggerType)
  const [inactivityDays, setInactivityDays] = useState(14)
  const [exitCondition, setExitCondition] = useState('Member books a class or membership becomes active')

  // Update flow name and trigger when template is selected from gallery
  useEffect(() => {
    if (selectedTemplate) {
      setFlowName(selectedTemplate.name)
      if (selectedTemplate.trigger_type) {
        setTriggerType(selectedTemplate.trigger_type as TriggerType)
      }
    }
  }, [selectedTemplate])
  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges)
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null)

  const nodeTypes = useMemo(() => ({
    triggerNode: TriggerNode,
    emailNode: EmailNode,
    waitNode: WaitNode,
    conditionNode: ConditionNode,
    smsNode: SMSNode,
    tagNode: TagNode,
  }), [])

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge({ ...params, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' } }, eds)
      ),
    [setEdges]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<NodeData>) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const handleUpdateNode = useCallback((id: string, data: Partial<NodeData>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n))
    )
    setSelectedNode((prev) => prev && prev.id === id ? { ...prev, data: { ...prev.data, ...data } } : prev)
  }, [setNodes])

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id))
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
    setSelectedNode(null)
  }, [setNodes, setEdges])

  const [saving, setSaving] = useState(false)
  const [activating, setActivating] = useState(false)

  const serializeFlow = useCallback(() => ({
    name: flowName,
    trigger_type: triggerType,
    trigger_config: {
      inactivity_days: triggerType === 'inactivity' ? inactivityDays : undefined,
    },
    exit_condition: exitCondition,
    steps: nodes.map(n => ({
      id: n.id,
      type: n.data.stepType,
      position: n.position,
      config: n.data,
    })),
    connections: edges.map(e => ({
      id: e.id,
      source: e.source,
      source_handle: e.sourceHandle ?? null,
      target: e.target,
    })),
  }), [flowName, triggerType, inactivityDays, exitCondition, nodes, edges])

  const handleSaveDraft = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...serializeFlow(), status: 'draft' }),
      })
      if (res.ok) {
        const data = await res.json()
        window.location.href = `/marketing/automations/${data.id ?? ''}`
      }
    } catch (err) {
      console.error('Failed to save automation draft:', err)
    } finally {
      setSaving(false)
    }
  }, [serializeFlow])

  const handleSaveAndActivate = useCallback(async () => {
    setActivating(true)
    try {
      // Create the automation
      const createRes = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...serializeFlow(), status: 'draft' }),
      })
      if (!createRes.ok) return
      const automation = await createRes.json()

      // Activate it
      await fetch(`/api/automations/${automation.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      window.location.href = `/marketing/automations/${automation.id}`
    } catch (err) {
      console.error('Failed to save & activate automation:', err)
    } finally {
      setActivating(false)
    }
  }, [serializeFlow])

  const addNode = useCallback((type: StepType) => {
    const typeMap: Record<StepType, string> = {
      trigger: 'triggerNode',
      email: 'emailNode',
      wait: 'waitNode',
      condition: 'conditionNode',
      sms: 'smsNode',
      tag: 'tagNode',
    }
    const id = `${type}-${Date.now()}`
    const newNode: Node<NodeData> = {
      id,
      type: typeMap[type],
      position: { x: 300 + Math.random() * 100, y: 400 + Math.random() * 100 },
      data: {
        stepType: type,
        label: type === 'email' ? 'New Email' : type === 'wait' ? 'Wait' : type === 'condition' ? 'New Condition' : type === 'sms' ? 'New SMS' : type === 'tag' ? 'New Tag' : type,
        ...(type === 'wait' ? { duration: 1, durationUnit: 'days' as const } : {}),
        ...(type === 'email' ? { subject: '', body: '' } : {}),
        ...(type === 'sms' ? { body: '' } : {}),
        ...(type === 'tag' ? { tagName: '', tagAction: 'add' as const } : {}),
        ...(type === 'condition' ? { conditionField: 'email_opened', conditionOp: 'equals', conditionValue: 'true' } : {}),
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [setNodes])

  // Show template gallery before the builder
  if (showGallery) {
    return (
      <TemplateGallery
        onSelectTemplate={handleSelectTemplate}
        onSkip={handleSkipGallery}
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/marketing/automations" className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <ArrowLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <input
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="text-lg font-black text-gray-900 dark:text-gray-100 tracking-tight bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-64"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {nodes.length} steps &middot; {edges.length} connections
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving || !flowName.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={handleSaveAndActivate}
            disabled={activating || !flowName.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="h-4 w-4" />
            {activating ? 'Activating...' : 'Save & Activate'}
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-140px)]">
        {/* Left Panel — Trigger Config */}
        <div className="w-72 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 p-5 overflow-y-auto shrink-0">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Trigger Configuration</h2>
          <TriggerConfigPanel
            triggerType={triggerType}
            setTriggerType={setTriggerType}
            inactivityDays={inactivityDays}
            setInactivityDays={setInactivityDays}
            exitCondition={exitCondition}
            setExitCondition={setExitCondition}
          />

          {/* Node Palette */}
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Add Step</h2>
            <div className="space-y-2">
              {NODE_PALETTE.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.type}
                    onClick={() => addNode(item.type)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left group"
                  >
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0', item.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:hover:text-gray-100 transition-colors">{item.label}</span>
                    <Plus className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 ml-auto group-hover:text-indigo-600 transition-colors" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Center — ReactFlow Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            className="bg-[#FAFAFA] dark:bg-[#0F0F11]"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e5e7eb" gap={20} size={1} />
            <Controls
              showInteractive={false}
              className="!bg-white dark:bg-gray-950 !border-gray-200 dark:border-gray-800 !rounded-xl !shadow-sm [&>button]:!border-gray-200 dark:border-gray-800 [&>button]:!rounded-lg [&>button:hover]:!bg-gray-50 dark:bg-gray-900"
            />
          </ReactFlow>
        </div>

        {/* Right Panel — Step Config */}
        <AnimatePresence mode="wait">
          {selectedNode && selectedNode.data.stepType !== 'trigger' && (
            <motion.div
              key={selectedNode.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="w-80 bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 p-5 overflow-y-auto shrink-0"
            >
              <StepConfigPanel
                node={selectedNode}
                onUpdate={handleUpdateNode}
                onDelete={handleDeleteNode}
                onClose={() => setSelectedNode(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Helper functions ───────────────────────────────────────
function getTemplateName(templateId: string): string {
  const names: Record<string, string> = {
    welcome: 'Welcome Sequence',
    winback: 'Win-Back: 14-Day Inactive',
    failed_payment: 'Failed Payment Recovery',
    churn: 'Churn Prevention',
  }
  return names[templateId] || 'New Automation'
}

function getTemplateTrigger(templateId: string): TriggerType {
  const triggers: Record<string, TriggerType> = {
    welcome: 'signup',
    winback: 'inactivity',
    failed_payment: 'failed_payment',
    churn: 'churn_risk',
  }
  return triggers[templateId] || 'signup'
}

// ─── Page ───────────────────────────────────────────────────
export default function NewAutomationPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-100" />
          <div className="h-4 w-32 rounded bg-gray-200" />
        </div>
      </div>
    }>
      <FlowBuilderInner />
    </Suspense>
  )
}
