import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { inngest } from "@/lib/inngest/client";

const ALL_ENTITY_TYPES = [
  "members",
  "events",
  "bookings",
  "transactions",
];

/**
 * POST /api/glofox/backfill
 * Trigger a full historical Glofox data import via Inngest.
 * Auth: owner only — this is a heavy operation.
 */
export async function POST() {
  const auth = await requireRole(["owner"]);
  if (auth.error) return auth.error;
  const { supabase, studioId } = auth;

  // Mark all entity types as syncing
  for (const entityType of ALL_ENTITY_TYPES) {
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
    name: "glofox/backfill",
    data: {
      studio_id: studioId!,
    },
  });

  return NextResponse.json({
    message: "Backfill triggered",
    entity_types: ALL_ENTITY_TYPES,
  });
}
