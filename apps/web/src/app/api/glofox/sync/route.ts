import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { inngest } from "@/lib/inngest/client";

const VALID_ENTITY_TYPES = [
  "members",
  "events",
  "bookings",
  "transactions",
  "programs",
  "facilities",
  "appointments",
  "discounts",
];

/**
 * POST /api/glofox/sync
 * Trigger a manual Glofox data sync via Inngest.
 * Body: { entity_types?: string[] } — optional filter
 * Auth: owner or manager only
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(["owner", "manager"]);
  if (auth.error) return auth.error;
  const { supabase, studioId } = auth;

  let entityTypes: string[] | undefined;

  try {
    const body = await request.json();
    if (body.entity_types && Array.isArray(body.entity_types)) {
      const invalid = body.entity_types.filter(
        (t: string) => !VALID_ENTITY_TYPES.includes(t)
      );
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Invalid entity types: ${invalid.join(", ")}` },
          { status: 400 }
        );
      }
      entityTypes = body.entity_types;
    }
  } catch {
    // Empty body is fine — sync all entity types
  }

  const types = entityTypes ?? VALID_ENTITY_TYPES;

  // Mark entity types as syncing
  for (const entityType of types) {
    await supabase
      .from("glofox_sync_state")
      .upsert(
        {
          studio_id: studioId,
          entity_type: entityType,
          status: "syncing",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "studio_id,entity_type" }
      );
  }

  // Send event to Inngest
  await inngest.send({
    name: "glofox/sync-manual",
    data: {
      studio_id: studioId!,
      entity_types: types,
    },
  });

  return NextResponse.json({
    message: "Sync triggered",
    entity_types: types,
  });
}
