/**
 * POST /api/sms/send
 *
 * Send an SMS message. Admin/manager only.
 * Body: { to: string (E.164), body: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createSMSProvider } from '@/lib/sms';
import { rateLimit } from '@/lib/rate-limit';
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID;
const ALLOWED_ROLES = ['owner', 'admin', 'manager'];

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();

  // ── Auth ────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('roles')
    .eq('id', user.id)
    .single();

  const roles: string[] = profile?.roles ?? [];
  const hasPermission = roles.some((r: string) => ALLOWED_ROLES.includes(r));
  if (!hasPermission) {
    return NextResponse.json(
      { error: 'Insufficient permissions. Admin or manager role required.' },
      { status: 403 },
    );
  }

  // Rate limit: 5 requests per minute per user
  const rl = rateLimit(`sms:${user.id}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // ── Parse Body ──────────────────────────────────────────────
  const body = await request.json();
  const { to, body: messageBody } = body as { to: string; body: string };

  if (!to || !messageBody) {
    return NextResponse.json(
      { error: 'Both "to" (E.164 format) and "body" are required.' },
      { status: 400 },
    );
  }

  // Basic E.164 validation
  if (!/^\+[1-9]\d{1,14}$/.test(to)) {
    return NextResponse.json(
      { error: 'Invalid phone number. Must be in E.164 format (e.g., +14155551234).' },
      { status: 400 },
    );
  }

  // ── Send SMS ────────────────────────────────────────────────
  const sms = createSMSProvider();
  const result = await sms.sendSMS({
    to,
    body: messageBody,
    studio_id: STUDIO_ID,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? 'Failed to send SMS' },
      { status: 502 },
    );
  }

  // Log to activity_log
  await supabase.from('activity_log').insert({
    studio_id: STUDIO_ID,
    actor_id: user.id,
    type: 'sms_sent',
    subject_type: 'sms',
    subject_id: result.provider_message_id,
    metadata: { to, segments: result.segments },
  });

  return NextResponse.json({
    success: true,
    message_id: result.provider_message_id,
    segments: result.segments,
  });
}
