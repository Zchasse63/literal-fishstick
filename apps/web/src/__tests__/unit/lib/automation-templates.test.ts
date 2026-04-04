/**
 * Structural validation tests for AUTOMATION_TEMPLATES.
 *
 * Ensures every template has required fields, unique slugs, valid trigger
 * types, valid step types, and proper wait step configuration. These tests
 * act as a contract — if someone adds or modifies a template, these will
 * catch missing fields or invalid values immediately.
 */
import { describe, it, expect } from 'vitest'
import {
  AUTOMATION_TEMPLATES,
  type AutomationTemplate,
  type AutomationTemplateStep,
} from '@/lib/automation-templates'

describe('AUTOMATION_TEMPLATES', () => {
  it('has exactly 6 templates', () => {
    expect(AUTOMATION_TEMPLATES).toHaveLength(6)
  })

  it.each(AUTOMATION_TEMPLATES)('$name has all required fields', (template: AutomationTemplate) => {
    expect(template.name).toBeTruthy()
    expect(typeof template.name).toBe('string')

    expect(template.slug).toBeTruthy()
    expect(typeof template.slug).toBe('string')

    expect(template.trigger_type).toBeTruthy()
    expect(typeof template.trigger_type).toBe('string')

    expect(template.category).toBeTruthy()
    expect(typeof template.category).toBe('string')

    expect(template.description).toBeTruthy()
    expect(typeof template.description).toBe('string')

    expect(template.steps).toBeInstanceOf(Array)
    expect(template.steps.length).toBeGreaterThan(0)

    expect(template.trigger_config).toBeDefined()
    expect(typeof template.trigger_config).toBe('object')

    expect(template.exit_conditions).toBeDefined()
    expect(typeof template.exit_conditions).toBe('object')

    expect(typeof template.allow_reenrollment).toBe('boolean')
    expect(typeof template.reenrollment_cooldown_days).toBe('number')
    expect(template.reenrollment_cooldown_days).toBeGreaterThanOrEqual(0)
  })

  it('has no duplicate slugs', () => {
    const slugs = AUTOMATION_TEMPLATES.map((t) => t.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('all slugs are kebab-case', () => {
    const kebabRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/
    for (const t of AUTOMATION_TEMPLATES) {
      expect(t.slug).toMatch(kebabRegex)
    }
  })

  it('all trigger_types are valid', () => {
    const validTypes = [
      'never_booked',
      'classpass_repeat',
      'one_and_done',
      'cooling_off',
      'plan_upgrade_candidate',
      'class_type_fan',
    ]
    for (const t of AUTOMATION_TEMPLATES) {
      expect(validTypes).toContain(t.trigger_type)
    }
  })

  it('has no duplicate trigger_types', () => {
    const triggerTypes = AUTOMATION_TEMPLATES.map((t) => t.trigger_type)
    expect(new Set(triggerTypes).size).toBe(triggerTypes.length)
  })

  it('all step types are valid', () => {
    const validStepTypes = [
      'email',
      'sms',
      'wait',
      'condition',
      'tag',
      'update_field',
    ]
    for (const t of AUTOMATION_TEMPLATES) {
      for (const step of t.steps) {
        expect(validStepTypes).toContain(step.type)
      }
    }
  })

  it('wait steps have positive duration', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      for (const step of t.steps) {
        if (step.type === 'wait') {
          expect(step.delay_minutes).toBeDefined()
          expect(step.delay_minutes).toBeGreaterThan(0)
        }
      }
    }
  })

  it('email steps have subject and body', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      for (const step of t.steps) {
        if (step.type === 'email') {
          expect(step.subject).toBeTruthy()
          expect(typeof step.subject).toBe('string')
          expect(step.body).toBeTruthy()
          expect(typeof step.body).toBe('string')
        }
      }
    }
  })

  it('condition steps have condition_type and branch references', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      for (const step of t.steps) {
        if (step.type === 'condition') {
          expect(step.condition_type).toBeTruthy()
          expect(typeof step.condition_type).toBe('string')
          expect(step.config).toBeDefined()
          expect(typeof step.true_branch).toBe('number')
          expect(typeof step.false_branch).toBe('number')
        }
      }
    }
  })

  it('tag steps have tag_name and action', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      for (const step of t.steps) {
        if (step.type === 'tag') {
          expect(step.tag_name).toBeTruthy()
          expect(['add', 'remove']).toContain(step.action)
        }
      }
    }
  })

  it('update_field steps have field and value', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      for (const step of t.steps) {
        if (step.type === 'update_field') {
          expect(step.field).toBeTruthy()
          expect(step.value).toBeDefined()
        }
      }
    }
  })

  it('condition branch indices are within step array bounds', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      const maxIndex = t.steps.length - 1
      for (const step of t.steps) {
        if (step.type === 'condition') {
          expect(step.true_branch).toBeGreaterThanOrEqual(0)
          expect(step.true_branch).toBeLessThanOrEqual(maxIndex)
          expect(step.false_branch).toBeGreaterThanOrEqual(0)
          expect(step.false_branch).toBeLessThanOrEqual(maxIndex)
        }
      }
    }
  })

  it('all categories are valid', () => {
    const validCategories = [
      'onboarding',
      'retention',
      'upsell',
      'engagement',
      'winback',
      'conversion',
    ]
    for (const t of AUTOMATION_TEMPLATES) {
      expect(validCategories).toContain(t.category)
    }
  })

  it('each template has at least one email step', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      const hasEmail = t.steps.some((s) => s.type === 'email')
      expect(hasEmail).toBe(true)
    }
  })

  it('email templates contain personalization placeholders', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      const emailSteps = t.steps.filter((s) => s.type === 'email')
      for (const step of emailSteps) {
        // Every email body should have at least {{first_name}}
        expect(step.body).toContain('{{first_name}}')
      }
    }
  })
})
