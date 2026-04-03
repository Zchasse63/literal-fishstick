import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";

/**
 * GET /api/glofox/status
 * Get current Glofox sync state for all entity types.
 * Auth: owner or manager
 */
export async function GET() {
  const auth = await requireRole(["owner", "manager"]);
  if (auth.error) return auth.error;
  const { supabase, studioId } = auth;

  const { data, error } = await supabase
    .from("glofox_sync_state")
    .select("entity_type, last_synced_at, last_full_sync_at, records_synced, status, error_message, updated_at")
    .eq("studio_id", studioId)
    .order("entity_type", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const isSyncing = (data ?? []).some((row) => row.status === "syncing");

  return NextResponse.json({
    data: data ?? [],
    is_syncing: isSyncing,
  });
}
