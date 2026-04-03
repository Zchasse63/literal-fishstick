'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import type { Step } from './types'

export default function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps = [
    { number: 1 as Step, label: 'Setup' },
    { number: 2 as Step, label: 'Content' },
    { number: 3 as Step, label: 'Review' },
  ]

  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((step, i) => (
        <div key={step.number} className="flex items-center">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300',
                currentStep > step.number
                  ? 'bg-emerald-500 text-white'
                  : currentStep === step.number
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
              )}
            >
              {currentStep > step.number ? (
                <Check className="h-4 w-4" />
              ) : (
                step.number
              )}
            </div>
            <span
              className={cn(
                'text-sm font-semibold transition-colors',
                currentStep >= step.number ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
              )}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                'w-16 h-px mx-4 transition-colors duration-300',
                currentStep > step.number ? 'bg-emerald-400' : 'bg-gray-200'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}
