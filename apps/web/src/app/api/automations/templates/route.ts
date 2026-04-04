import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { AUTOMATION_TEMPLATES } from '@/lib/automation-templates';

const ALLOWED_ROLES = ['owner', 'admin', 'manager'];

/**
 * GET /api/automations/templates
 *
 * Returns the list of pre-built automation flow templates.
 * Optional query params:
 *   - category: filter by template category (onboarding, retention, upsell, etc.)
 *   - trigger_type: filter by trigger type (never_booked, classpass_repeat, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

    const category = searchParams.get('category');
    const triggerType = searchParams.get('trigger_type');

    // ── Auth check ────────────────────────────────────────────
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single();

    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin or manager role required.' },
        { status: 403 },
      );
    }

    // ── Filter templates ──────────────────────────────────────
    let templates = AUTOMATION_TEMPLATES;

    if (category) {
      templates = templates.filter((t) => t.category === category);
    }

    if (triggerType) {
      templates = templates.filter((t) => t.trigger_type === triggerType);
    }

    return NextResponse.json({
      data: templates,
      count: templates.length,
    });
  } catch (err) {
    console.error('GET /api/automations/templates error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
