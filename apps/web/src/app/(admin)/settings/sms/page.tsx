'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Smartphone,
  CheckCircle,
  XCircle,
  Send,
  Shield,
  AlertTriangle,
  Settings,
  BarChart3,
  Loader2,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
type Provider = 'stub' | 'twilio'
type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error'
type TestSmsStatus = 'idle' | 'sending' | 'sent' | 'error'

// ─── Page ───────────────────────────────────────────────────
export default function SmsConfigPage() {
  const [provider, setProvider] = useState<Provider>('stub')
  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [showSid, setShowSid] = useState(false)
  const [showToken, setShowToken] = useState(false)

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle')
  const [testSmsPhone, setTestSmsPhone] = useState('')
  const [testSmsStatus, setTestSmsStatus] = useState<TestSmsStatus>('idle')

  const [dailySendLimit, setDailySendLimit] = useState('1000')
  const [optInRequired, setOptInRequired] = useState(true)

  // Mock usage stats
  const messagesSentThisMonth = 847
  const deliveryRate = 97.3

  const handleTestConnection = () => {
    setConnectionStatus('testing')
    setTimeout(() => {
      if (accountSid && authToken && phoneNumber) {
        setConnectionStatus('success')
      } else {
        setConnectionStatus('error')
      }
    }, 1500)
  }

  const handleSendTestSms = () => {
    setTestSmsStatus('sending')
    setTimeout(() => {
      if (testSmsPhone && connectionStatus === 'success') {
        setTestSmsStatus('sent')
      } else {
        setTestSmsStatus('error')
      }
    }, 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="min-h-screen bg-[#FAFAFA]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">SMS Configuration</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure SMS provider and messaging settings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Main Column ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Provider Selection */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.05 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">SMS Provider</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setProvider('stub')}
                className={cn(
                  'p-4 rounded-xl border-2 transition-all text-left',
                  provider === 'stub'
                    ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-500/20'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center',
                    provider === 'stub' ? 'bg-indigo-100' : 'bg-gray-100'
                  )}>
                    <Smartphone className={cn('h-5 w-5', provider === 'stub' ? 'text-indigo-600' : 'text-gray-400')} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Stub</p>
                    <p className="text-xs text-gray-400 mt-0.5">No messages sent (dev mode)</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setProvider('twilio')}
                className={cn(
                  'p-4 rounded-xl border-2 transition-all text-left',
                  provider === 'twilio'
                    ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-500/20'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center',
                    provider === 'twilio' ? 'bg-indigo-100' : 'bg-gray-100'
                  )}>
                    <Send className={cn('h-5 w-5', provider === 'twilio' ? 'text-indigo-600' : 'text-gray-400')} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Twilio</p>
                    <p className="text-xs text-gray-400 mt-0.5">Production SMS delivery</p>
                  </div>
                </div>
              </button>
            </div>
          </motion.div>

          {/* Twilio Configuration */}
          {provider === 'twilio' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Twilio Credentials</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Account SID</label>
                  <div className="relative">
                    <input
                      type={showSid ? 'text' : 'password'}
                      value={accountSid}
                      onChange={(e) => setAccountSid(e.target.value)}
                      placeholder="AC..."
                      className="w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-200 text-sm text-gray-900 font-mono placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                    />
                    <button
                      onClick={() => setShowSid(!showSid)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showSid ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Auth Token</label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                      placeholder="Your auth token"
                      className="w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-200 text-sm text-gray-900 font-mono placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                    />
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showToken ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone Number</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                  />
                </div>

                {/* Test Connection */}
                <div className="pt-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={connectionStatus === 'testing'}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm',
                      connectionStatus === 'testing'
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    )}
                  >
                    {connectionStatus === 'testing' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Settings className="h-4 w-4" />
                    )}
                    Test Connection
                  </button>

                  {connectionStatus === 'success' && (
                    <div className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <p className="text-sm font-medium text-emerald-700">Connection successful. Twilio credentials are valid.</p>
                    </div>
                  )}
                  {connectionStatus === 'error' && (
                    <div className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
                      <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                      <p className="text-sm font-medium text-red-700">Connection failed. Please check your credentials and try again.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Send Test SMS */}
              {connectionStatus === 'success' && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Send Test SMS</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={testSmsPhone}
                      onChange={(e) => setTestSmsPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                    />
                    <button
                      onClick={handleSendTestSms}
                      disabled={testSmsStatus === 'sending' || !testSmsPhone}
                      className={cn(
                        'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                        testSmsStatus === 'sending' || !testSmsPhone
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                      )}
                    >
                      {testSmsStatus === 'sending' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Send Test
                    </button>
                  </div>
                  {testSmsStatus === 'sent' && (
                    <div className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <p className="text-sm font-medium text-emerald-700">Test SMS sent successfully.</p>
                    </div>
                  )}
                  {testSmsStatus === 'error' && (
                    <div className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
                      <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                      <p className="text-sm font-medium text-red-700">Failed to send test SMS. Check the phone number and try again.</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* SMS Settings */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">SMS Settings</p>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Daily Send Limit (per studio)</label>
                <input
                  type="number"
                  value={dailySendLimit}
                  onChange={(e) => setDailySendLimit(e.target.value)}
                  className="w-full max-w-[200px] px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                />
                <p className="text-xs text-gray-400 mt-1.5">Maximum number of SMS messages sent per day per studio location</p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                <div>
                  <p className="text-sm font-bold text-gray-900">Opt-In Required</p>
                  <p className="text-xs text-gray-400 mt-0.5">Members must explicitly opt in to receive SMS messages</p>
                </div>
                <button onClick={() => setOptInRequired(!optInRequired)} className="transition-colors">
                  {optInRequired ? (
                    <ToggleRight className="h-8 w-8 text-indigo-600" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 text-gray-300" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>

          {/* CAN-SPAM Notice */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.15 }}
            className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200"
          >
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">Compliance Notice</p>
              <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                All SMS messages will automatically include opt-out instructions (e.g., "Reply STOP to unsubscribe") in compliance with TCPA and CAN-SPAM regulations. Members who opt out will be suppressed from future SMS campaigns immediately.
              </p>
            </div>
          </motion.div>
        </div>

        {/* ─── Right Column ────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Usage Stats */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.05 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-gray-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Usage This Month</p>
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Messages Sent</p>
                <p className="text-[28px] font-black text-gray-900 tabular-nums leading-none">{messagesSentThisMonth.toLocaleString()}</p>
                <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${(messagesSentThisMonth / parseInt(dailySendLimit || '1000') / 30) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  {messagesSentThisMonth} of ~{(parseInt(dailySendLimit || '1000') * 30).toLocaleString()} monthly capacity
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Delivery Rate</p>
                <p className="text-[28px] font-black text-gray-900 tabular-nums leading-none">{deliveryRate}%</p>
                <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${deliveryRate}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Provider Status */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-gray-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Provider Status</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Active Provider</p>
                <span className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
                  provider === 'twilio'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-100 text-gray-600'
                )}>
                  {provider}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Connection</p>
                <span className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  provider === 'stub'
                    ? 'bg-gray-100 text-gray-500'
                    : connectionStatus === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : connectionStatus === 'error'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-gray-100 text-gray-500'
                )}>
                  {provider === 'stub' ? 'N/A' : connectionStatus === 'success' ? 'Connected' : connectionStatus === 'error' ? 'Failed' : 'Not Tested'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Opt-In Required</p>
                <span className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  optInRequired
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                )}>
                  {optInRequired ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
