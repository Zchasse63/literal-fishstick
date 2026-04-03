'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings,
  Building2,
  Clock,
  CreditCard,
  Bell,
  Plug,
  Upload,
  Save,
  Shield,
  AlertTriangle,
  Users,
  Thermometer,
  Droplets,
  Link,
  Key,
  Mail,
  MessageSquare,
  ChevronRight,
  Pencil,
  Plus,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import DataSyncButton from '@/components/glofox/DataSyncButton'

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
interface OperatingHour {
  day: string
  open: string
  close: string
  enabled: boolean
}

interface MembershipPlan {
  id: string
  name: string
  price: number
  interval: 'monthly' | 'weekly' | 'one-time'
  description: string
  isActive: boolean
}

// ─── Section Header ─────────────────────────────────────────
function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-base font-bold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-0.5">{description}</p>
    </div>
  )
}

// ─── Field Row ──────────────────────────────────────────────
function FieldRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-semibold text-gray-900">{label}</Label>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      <div className="w-64 flex-shrink-0">{children}</div>
    </div>
  )
}

// ─── General Tab ────────────────────────────────────────────
function GeneralTab() {
  const [operatingHours, setOperatingHours] = useState<OperatingHour[]>([
    { day: 'Monday', open: '08:00', close: '21:00', enabled: true },
    { day: 'Tuesday', open: '08:00', close: '21:00', enabled: true },
    { day: 'Wednesday', open: '08:00', close: '21:00', enabled: true },
    { day: 'Thursday', open: '08:00', close: '21:00', enabled: true },
    { day: 'Friday', open: '08:00', close: '21:00', enabled: true },
    { day: 'Saturday', open: '09:00', close: '18:00', enabled: true },
    { day: 'Sunday', open: '09:00', close: '16:00', enabled: false },
  ])

  const updateHour = (index: number, field: keyof OperatingHour, value: string | boolean) => {
    setOperatingHours(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  return (
    <div className="space-y-8">
      {/* Studio Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            Studio Information
          </CardTitle>
          <CardDescription>Basic details about your studio location</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <FieldRow label="Studio Name">
            <Input defaultValue="The Sauna Guys" />
          </FieldRow>
          <FieldRow label="Address">
            <Input defaultValue="Tampa, FL" />
          </FieldRow>
          <FieldRow label="Phone">
            <Input type="tel" defaultValue="(813) 555-0100" />
          </FieldRow>
          <FieldRow label="Email">
            <Input type="email" defaultValue="hello@thesaunaguys.com" />
          </FieldRow>
          <FieldRow label="Timezone">
            <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
              <option value="America/New_York">Eastern (ET)</option>
              <option value="America/Chicago">Central (CT)</option>
              <option value="America/Denver">Mountain (MT)</option>
              <option value="America/Los_Angeles">Pacific (PT)</option>
            </select>
          </FieldRow>
          <FieldRow label="Logo" description="Upload your studio logo (PNG, SVG, max 2MB)">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg">
                S
              </div>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Upload
              </Button>
            </div>
          </FieldRow>
        </CardContent>
      </Card>

      {/* Operating Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            Operating Hours
          </CardTitle>
          <CardDescription>Set your weekly studio schedule</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Header row */}
            <div className="grid grid-cols-[120px_1fr_1fr_60px] gap-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-2 border-b border-gray-100">
              <span>Day</span>
              <span>Open</span>
              <span>Close</span>
              <span className="text-center">Active</span>
            </div>
            {operatingHours.map((hour, i) => (
              <div
                key={hour.day}
                className={cn(
                  'grid grid-cols-[120px_1fr_1fr_60px] gap-3 items-center py-2',
                  !hour.enabled && 'opacity-50'
                )}
              >
                <span className="text-sm font-semibold text-gray-900">{hour.day}</span>
                <Input
                  type="time"
                  value={hour.open}
                  onChange={(e) => updateHour(i, 'open', e.target.value)}
                  disabled={!hour.enabled}
                />
                <Input
                  type="time"
                  value={hour.close}
                  onChange={(e) => updateHour(i, 'close', e.target.value)}
                  disabled={!hour.enabled}
                />
                <div className="flex justify-center">
                  <Switch
                    checked={hour.enabled}
                    onCheckedChange={(val) => updateHour(i, 'enabled', val)}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
      </div>
    </div>
  )
}

// ─── Booking Rules Tab ──────────────────────────────────────
function BookingRulesTab() {
  const [strikeSystemEnabled, setStrikeSystemEnabled] = useState(true)
  const [unlimitedWarningOnly, setUnlimitedWarningOnly] = useState(true)

  return (
    <div className="space-y-8">
      {/* Cancellation & Strikes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            Cancellation &amp; Strike System
          </CardTitle>
          <CardDescription>
            Configure late cancellation policies and progressive penalties
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <FieldRow
            label="Late Cancellation Window"
            description="Hours before class start when cancellation incurs a strike"
          >
            <div className="flex items-center gap-2">
              <Input type="number" defaultValue={8} min={1} max={48} className="w-20" />
              <span className="text-sm text-gray-500">hours</span>
            </div>
          </FieldRow>
          <FieldRow
            label="Strike System"
            description="Enable progressive penalties for late cancellations and no-shows"
          >
            <Switch
              checked={strikeSystemEnabled}
              onCheckedChange={setStrikeSystemEnabled}
            />
          </FieldRow>
          {strikeSystemEnabled && (
            <>
              <FieldRow
                label="2nd Strike Penalty"
                description="Fee charged on the second strike in the rolling window"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">$</span>
                  <Input type="number" defaultValue={5} min={0} className="w-20" />
                </div>
              </FieldRow>
              <FieldRow
                label="3rd Strike Penalty"
                description="Fee charged on the third strike and beyond"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">$</span>
                  <Input type="number" defaultValue={10} min={0} className="w-20" />
                </div>
              </FieldRow>
              <FieldRow
                label="Rolling Window"
                description="Days over which strikes are counted before resetting"
              >
                <div className="flex items-center gap-2">
                  <Input type="number" defaultValue={30} min={7} max={90} className="w-20" />
                  <span className="text-sm text-gray-500">days</span>
                </div>
              </FieldRow>
              <FieldRow
                label="Unlimited Members: Warning Only"
                description="Unlimited members receive warnings instead of monetary penalties"
              >
                <Switch
                  checked={unlimitedWarningOnly}
                  onCheckedChange={setUnlimitedWarningOnly}
                />
              </FieldRow>
            </>
          )}
        </CardContent>
      </Card>

      {/* Capacity & Waitlists */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            Capacity &amp; Waitlists
          </CardTitle>
          <CardDescription>
            Session capacity limits and waitlist behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <FieldRow
            label="Capacity Per Session"
            description="Maximum number of members per time slot"
          >
            <div className="flex items-center gap-2">
              <Input type="number" defaultValue={12} min={1} max={100} className="w-20" />
              <span className="text-sm text-gray-500">members</span>
            </div>
          </FieldRow>
          <FieldRow
            label="Cold Plunge Count"
            description="Number of cold plunges available for facility status display"
          >
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-sky-500" />
              <Input type="number" defaultValue={6} min={0} max={50} className="w-20" />
            </div>
          </FieldRow>
          <FieldRow
            label="Waitlist Claim Window"
            description="Minutes a promoted member has to confirm their spot"
          >
            <div className="flex items-center gap-2">
              <Input type="number" defaultValue={30} min={5} max={120} className="w-20" />
              <span className="text-sm text-gray-500">minutes</span>
            </div>
          </FieldRow>
        </CardContent>
      </Card>

      {/* Credits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            Credit Packs
          </CardTitle>
          <CardDescription>Prepaid credit pack expiration settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <FieldRow
            label="Expiry Grace Period"
            description="Additional days after credit expiry before they become unusable"
          >
            <div className="flex items-center gap-2">
              <Input type="number" defaultValue={7} min={0} max={30} className="w-20" />
              <span className="text-sm text-gray-500">days</span>
            </div>
          </FieldRow>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
      </div>
    </div>
  )
}

// ─── Membership & Pricing Tab ───────────────────────────────
function MembershipPricingTab() {
  const [plans] = useState<MembershipPlan[]>([
    {
      id: '1',
      name: 'Unlimited Monthly',
      price: 149,
      interval: 'monthly',
      description: 'Unlimited sauna sessions, all time slots',
      isActive: true,
    },
    {
      id: '2',
      name: '10-Class Pack',
      price: 120,
      interval: 'one-time',
      description: '10 sessions, valid for 90 days',
      isActive: true,
    },
    {
      id: '3',
      name: '6-Class Pack',
      price: 80,
      interval: 'one-time',
      description: '6 sessions, valid for 60 days',
      isActive: true,
    },
    {
      id: '4',
      name: 'Drop-In',
      price: 20,
      interval: 'one-time',
      description: 'Single session pass',
      isActive: true,
    },
  ])

  return (
    <div className="space-y-8">
      {/* Membership Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            Membership Plans
          </CardTitle>
          <CardDescription>Manage your studio membership tiers and pricing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{plan.name}</span>
                    {plan.isActive ? (
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>
                </div>
                <span className="text-lg font-black text-gray-900 tabular-nums">
                  ${plan.price}
                  {plan.interval === 'monthly' && (
                    <span className="text-xs font-medium text-gray-400">/mo</span>
                  )}
                </span>
                <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <Pencil className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ))}
            <button className="flex items-center gap-2 w-full p-3 rounded-xl border border-dashed border-gray-300 text-sm font-semibold text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
              <Plus className="w-4 h-4" />
              Add Membership Plan
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Member Discount */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            Member Discount
          </CardTitle>
          <CardDescription>
            Automatic discount for active recurring members on merch and gift cards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <FieldRow
            label="Discount Percentage"
            description="Applied at the database level when membership is active. Locked at checkout start."
          >
            <div className="flex items-center gap-2">
              <Input type="number" defaultValue={10} min={0} max={100} className="w-20" />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </FieldRow>
        </CardContent>
      </Card>

      {/* Event Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-indigo-600" />
            Event &amp; Private Session Pricing
          </CardTitle>
          <CardDescription>
            Pricing for private bookings and corporate events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <FieldRow
            label="First Hour Rate"
            description="Base rate for the first hour of a private session or event"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">$</span>
              <Input type="number" defaultValue={250} min={0} className="w-24" />
            </div>
          </FieldRow>
          <FieldRow
            label="Additional Hour Rate"
            description="Tapered rate for each additional hour"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">$</span>
              <Input type="number" defaultValue={150} min={0} className="w-24" />
            </div>
          </FieldRow>
          <FieldRow
            label="Pilot Discount"
            description="Early adopter discount for corporate accounts during pilot period"
          >
            <div className="flex items-center gap-2">
              <Input type="number" defaultValue={20} min={0} max={100} className="w-20" />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </FieldRow>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
      </div>
    </div>
  )
}

// ─── Notifications Tab ──────────────────────────────────────
function NotificationsTab() {
  const [notifications, setNotifications] = useState({
    bookingConfirmation: true,
    bookingReminder: true,
    cancellationNotice: true,
    waitlistPromotion: true,
    paymentReceipt: true,
    membershipRenewal: true,
    strikeWarning: true,
    marketingCampaigns: false,
  })

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-8">
      {/* Email Provider */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-600" />
            Email Provider
          </CardTitle>
          <CardDescription>Transactional and marketing email configuration via Resend</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <FieldRow label="Provider" description="Resend is configured as the default email provider">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Resend
              </span>
            </div>
          </FieldRow>
          <FieldRow label="API Key" description="Your Resend API key for sending emails">
            <Input type="password" defaultValue="re_••••••••••••" />
          </FieldRow>
          <FieldRow label="From Address" description="Default sender email address">
            <Input type="email" defaultValue="noreply@thesaunaguys.com" />
          </FieldRow>
        </CardContent>
      </Card>

      {/* SMS Provider */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            SMS Provider
          </CardTitle>
          <CardDescription>SMS notifications (provider TBD, infrastructure is provider-agnostic)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">SMS Provider Not Configured</p>
              <p className="text-xs text-amber-700 mt-0.5">
                SMS infrastructure is built and provider-agnostic. Connect a provider when ready.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-600" />
            Notification Types
          </CardTitle>
          <CardDescription>Choose which notifications are sent to members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          {[
            { key: 'bookingConfirmation' as const, label: 'Booking Confirmation', desc: 'Sent when a member books a class' },
            { key: 'bookingReminder' as const, label: 'Booking Reminder', desc: 'Sent before a scheduled class' },
            { key: 'cancellationNotice' as const, label: 'Cancellation Notice', desc: 'Sent when a booking is cancelled' },
            { key: 'waitlistPromotion' as const, label: 'Waitlist Promotion', desc: 'Sent when a member is promoted from the waitlist' },
            { key: 'paymentReceipt' as const, label: 'Payment Receipt', desc: 'Sent after a successful payment' },
            { key: 'membershipRenewal' as const, label: 'Membership Renewal', desc: 'Sent before membership auto-renews' },
            { key: 'strikeWarning' as const, label: 'Strike Warning', desc: 'Sent when a member receives a strike' },
            { key: 'marketingCampaigns' as const, label: 'Marketing Campaigns', desc: 'Allow marketing emails (Phase 2)' },
          ].map(({ key, label, desc }) => (
            <FieldRow key={key} label={label} description={desc}>
              <Switch
                checked={notifications[key]}
                onCheckedChange={() => toggleNotification(key)}
              />
            </FieldRow>
          ))}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
      </div>
    </div>
  )
}

// ─── Integrations Tab ───────────────────────────────────────
function IntegrationsTab() {
  return (
    <div className="space-y-8">
      {/* Stripe */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            Stripe
          </CardTitle>
          <CardDescription>
            Payment processing via direct Stripe integration (not Stripe Connect)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <FieldRow label="Connection Status">
            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-md flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Connected
            </span>
          </FieldRow>
          <FieldRow label="Account ID">
            <span className="text-sm text-gray-600 font-mono">acct_••••••••••</span>
          </FieldRow>
          <FieldRow label="Webhook Endpoint">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-mono truncate">/api/webhooks/stripe</span>
              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded">Active</span>
            </div>
          </FieldRow>
          <FieldRow label="Dashboard">
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Open Stripe Dashboard
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </FieldRow>
        </CardContent>
      </Card>

      {/* Supabase */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="w-4 h-4 text-indigo-600" />
            Supabase
          </CardTitle>
          <CardDescription>
            Database, authentication, and real-time infrastructure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <FieldRow label="Project Status">
            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-md flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Connected
            </span>
          </FieldRow>
          <FieldRow label="Project URL">
            <span className="text-xs text-gray-500 font-mono truncate">
              {process.env.NEXT_PUBLIC_SUPABASE_URL ? '••••••.supabase.co' : 'Not configured'}
            </span>
          </FieldRow>
          <FieldRow label="Auth Method">
            <span className="text-sm text-gray-600">Magic Link / SSO (Passwordless)</span>
          </FieldRow>
          <FieldRow label="Real-time">
            <span className="text-sm text-gray-600">60-second polling (Phase 1)</span>
          </FieldRow>
        </CardContent>
      </Card>

      {/* Glofox Data Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="w-4 h-4 text-indigo-600" />
            Glofox Data Sync
          </CardTitle>
          <CardDescription>
            Sync member, booking, and class data from Glofox. Hourly auto-sync is active.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataSyncButton />
        </CardContent>
      </Card>

      {/* Instagram / SnapWidget */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="w-4 h-4 text-indigo-600" />
            Instagram Feed (SnapWidget)
          </CardTitle>
          <CardDescription>
            Embedded Instagram feed on the member app and website
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <FieldRow label="SnapWidget Embed ID" description="Your SnapWidget widget ID for the embed">
            <Input defaultValue="" placeholder="e.g., abc123xyz" />
          </FieldRow>
          <FieldRow label="Display Location">
            <span className="text-sm text-gray-600">iOS App + Web Booking Portal</span>
          </FieldRow>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-600" />
            API Keys
          </CardTitle>
          <CardDescription>
            Open API access — available from day one, not gated behind premium tiers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Production Key</p>
                <p className="text-xs font-mono text-gray-500 mt-0.5">mk_live_••••••••••••••••</p>
              </div>
              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase rounded-full">
                Active
              </span>
              <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                Reveal
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Test Key</p>
                <p className="text-xs font-mono text-gray-500 mt-0.5">mk_test_••••••••••••••••</p>
              </div>
              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase rounded-full">
                Test
              </span>
              <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                Reveal
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <button className="flex items-center gap-2 w-full p-3 rounded-xl border border-dashed border-gray-300 text-sm font-semibold text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
              <Plus className="w-4 h-4" />
              Generate New API Key
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
      </div>
    </div>
  )
}

// ─── Tab Configuration ──────────────────────────────────────
const tabs = [
  { icon: Building2, label: 'General' },
  { icon: Shield, label: 'Booking Rules' },
  { icon: CreditCard, label: 'Membership & Pricing' },
  { icon: Bell, label: 'Notifications' },
  { icon: Plug, label: 'Integrations' },
]

// ─── Settings Page ──────────────────────────────────────────
export default function SettingsPage() {
  return (
    <motion.div {...fadeInUp} className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure your studio, booking rules, pricing, and integrations
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={0}>
        <TabsList variant="line" className="border-b border-gray-200 w-full justify-start gap-0">
          {tabs.map((tab, i) => (
            <TabsTrigger key={tab.label} value={i} className="gap-1.5 px-4 pb-3">
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value={0}>
            <GeneralTab />
          </TabsContent>
          <TabsContent value={1}>
            <BookingRulesTab />
          </TabsContent>
          <TabsContent value={2}>
            <MembershipPricingTab />
          </TabsContent>
          <TabsContent value={3}>
            <NotificationsTab />
          </TabsContent>
          <TabsContent value={4}>
            <IntegrationsTab />
          </TabsContent>
        </div>
      </Tabs>
    </motion.div>
  )
}
