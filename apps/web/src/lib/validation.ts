/**
 * Shared Zod validation utility for API route handlers.
 *
 * Usage:
 *   const { data, error } = validateBody(mySchema, body);
 *   if (error) return error;
 *   // data is now typed and validated
 */
import { z } from 'zod';
import { NextResponse } from 'next/server';

export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { data: T; error: null } | { data: null; error: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      ),
    };
  }
  return { data: result.data, error: null };
}

// ─── Schemas for critical POST endpoints ──────────────────────────

/** POST /api/bookings */
export const bookingCreateSchema = z.object({
  class_id: z.string().uuid(),
  member_id: z.string().uuid(),
});

/** POST /api/corporate */
export const corporateCreateSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  contact_name: z.string().min(1, 'Contact name is required'),
  contact_email: z.string().email('Valid email is required'),
  legal_name: z.string().optional(),
  tax_id: z.string().optional(),
  industry: z.string().optional(),
  company_size: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_title: z.string().optional(),
  billing_email: z.string().email().optional(),
  billing_address: z.record(z.unknown()).optional(),
  stripe_customer_id: z.string().optional(),
  payment_terms: z.string().optional(),
  contract_start: z.string().optional(),
  contract_end: z.string().optional(),
  contract_value: z.number().nonnegative().optional(),
  monthly_credit_allocation: z.number().int().nonnegative().optional(),
  credit_rollover_cap: z.number().int().nonnegative().optional(),
  auto_renew: z.boolean().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/** POST /api/events */
export const eventCreateSchema = z.object({
  name: z.string().min(1, 'Event name is required'),
  event_type: z.string().min(1, 'Event type is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  description: z.string().optional(),
  setup_time_minutes: z.number().int().nonnegative().optional(),
  cleanup_time_minutes: z.number().int().nonnegative().optional(),
  min_guests: z.number().int().nonnegative().optional(),
  max_guests: z.number().int().nonnegative().optional(),
  expected_guests: z.number().int().nonnegative().optional(),
  base_price: z.number().nonnegative().optional(),
  per_person_price: z.number().nonnegative().optional(),
  total_price: z.number().nonnegative().optional(),
  deposit_amount: z.number().nonnegative().optional(),
  company_id: z.string().uuid().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().optional(),
  special_requests: z.string().optional(),
  internal_notes: z.string().optional(),
  assigned_staff: z.array(z.string()).optional(),
  resources_reserved: z.array(z.unknown()).optional(),
});
