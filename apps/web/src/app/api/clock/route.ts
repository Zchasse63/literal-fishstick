import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Calculate the distance in meters between two lat/lng points
 * using the Haversine formula.
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * POST /api/clock
 * Clock in or clock out an employee with geofence validation.
 *
 * Body: { action: "clock_in" | "clock_out", lat: number, lng: number, location_id?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, lat, lng, location_id } = body;

    // Validate inputs
    if (!action || !["clock_in", "clock_out"].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "clock_in" or "clock_out"' },
        { status: 400 }
      );
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { error: "lat and lng are required as numbers" },
        { status: 400 }
      );
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: "lat must be between -90 and 90, lng between -180 and 180" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    // Fetch the location for geofence validation
    let locationQuery = supabase
      .from("locations")
      .select("id, name, lat, lng, geofence_radius_meters")
      .eq("studio_id", studioId);

    if (location_id) {
      locationQuery = locationQuery.eq("id", location_id);
    }

    const { data: locations, error: locationError } = await locationQuery;

    if (locationError || !locations || locations.length === 0) {
      return NextResponse.json(
        { error: "No locations found for this studio" },
        { status: 404 }
      );
    }

    // Find the closest location within geofence
    let matchedLocation: (typeof locations)[0] | null = null;
    let closestDistance = Infinity;

    for (const loc of locations) {
      if (loc.lat == null || loc.lng == null) continue;

      const distance = haversineDistance(lat, lng, loc.lat, loc.lng);
      const radius = loc.geofence_radius_meters ?? 100;

      if (distance <= radius && distance < closestDistance) {
        matchedLocation = loc;
        closestDistance = distance;
      }
    }

    if (!matchedLocation) {
      return NextResponse.json(
        {
          error: "You are not within the geofence of any studio location",
          details: {
            your_coordinates: { lat, lng },
            closest_distance_meters: closestDistance === Infinity ? null : Math.round(closestDistance),
          },
        },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    if (action === "clock_in") {
      // Check if already clocked in (no clock_out yet)
      const { data: activeShift } = await supabase
        .from("time_entries")
        .select("id")
        .eq("employee_id", user.id)
        .eq("studio_id", studioId)
        .is("clock_out", null)
        .maybeSingle();

      if (activeShift) {
        return NextResponse.json(
          { error: "You are already clocked in. Please clock out first." },
          { status: 409 }
        );
      }

      const { data: entry, error: insertError } = await supabase
        .from("time_entries")
        .insert({
          employee_id: user.id,
          studio_id: studioId,
          location_id: matchedLocation.id,
          clock_in: now,
          clock_in_lat: lat,
          clock_in_lng: lng,
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }

      // Log activity
      await supabase.from("activity_log").insert({
        studio_id: studioId,
        actor_id: user.id,
        action: "employee_clocked_in",
        entity_type: "time_entry",
        entity_id: entry.id,
        metadata: {
          location_id: matchedLocation.id,
          location_name: matchedLocation.name,
          distance_meters: Math.round(closestDistance),
        },
      });

      return NextResponse.json({
        data: entry,
        location: matchedLocation.name,
        distance_meters: Math.round(closestDistance),
      }, { status: 201 });
    }

    // Clock out — find the active time entry
    const { data: activeEntry, error: findError } = await supabase
      .from("time_entries")
      .select("*")
      .eq("employee_id", user.id)
      .eq("studio_id", studioId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError || !activeEntry) {
      return NextResponse.json(
        { error: "No active clock-in found. Please clock in first." },
        { status: 400 }
      );
    }

    const clockInTime = new Date(activeEntry.clock_in);
    const clockOutTime = new Date(now);
    const hoursWorked =
      (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

    const { data: updatedEntry, error: updateError } = await supabase
      .from("time_entries")
      .update({
        clock_out: now,
        clock_out_lat: lat,
        clock_out_lng: lng,
        hours_worked: Math.round(hoursWorked * 100) / 100,
      })
      .eq("id", activeEntry.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      action: "employee_clocked_out",
      entity_type: "time_entry",
      entity_id: activeEntry.id,
      metadata: {
        location_id: matchedLocation.id,
        location_name: matchedLocation.name,
        hours_worked: Math.round(hoursWorked * 100) / 100,
        distance_meters: Math.round(closestDistance),
      },
    });

    return NextResponse.json({
      data: updatedEntry,
      location: matchedLocation.name,
      hours_worked: Math.round(hoursWorked * 100) / 100,
      distance_meters: Math.round(closestDistance),
    });
  } catch (err) {
    console.error("POST /api/clock error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
