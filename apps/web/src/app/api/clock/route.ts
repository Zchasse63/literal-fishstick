import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

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
 * Body: {
 *   action: "clock_in" | "clock_out",
 *   latitude?: number,
 *   longitude?: number,
 *   lat?: number,   // legacy alias
 *   lng?: number,   // legacy alias
 *   location_id?: string
 * }
 *
 * If latitude/longitude are provided, validates against geofence_locations.
 * Sets geofence_verified_in/out, geofence_location_id, distance_from_studio on the clock entry.
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

    // Role check — any staff member can clock in/out
    const { data: _rp } = await supabase.from("profiles").select("roles").eq("id", user.id).single();
    if (!_rp?.roles?.some((r: string) => ["owner", "manager", "trainer", "staff"].includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action, location_id } = body;
    // Support both latitude/longitude and legacy lat/lng
    const lat: number | undefined = body.latitude ?? body.lat;
    const lng: number | undefined = body.longitude ?? body.lng;

    // Validate inputs
    if (!action || !["clock_in", "clock_out"].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "clock_in" or "clock_out"' },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? DEFAULT_STUDIO_ID;

    // ─── Geofence Verification (optional) ─────────────────────
    let geofenceVerified = false;
    let geofenceLocationId: string | null = null;
    let distanceFromStudio: number | null = null;
    let matchedLocationName: string | null = null;

    if (typeof lat === "number" && typeof lng === "number") {
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return NextResponse.json(
          { error: "lat must be between -90 and 90, lng between -180 and 180" },
          { status: 400 }
        );
      }

      // Query geofence_locations for this studio's active geofences
      const { data: geofences, error: geoError } = await supabase
        .from("geofence_locations")
        .select("id, name, latitude, longitude, radius_meters")
        .eq("studio_id", studioId)
        .eq("is_active", true);

      if (geoError) {
        return NextResponse.json(
          { error: geoError.message },
          { status: 500 }
        );
      }

      if (!geofences || geofences.length === 0) {
        // No geofences configured — fall back to legacy locations table
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
        let closestDistance = Infinity;
        let matchedLocation: (typeof locations)[0] | null = null;

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
              error: "You are too far from the studio to clock in",
              details: {
                your_coordinates: { lat, lng },
                closest_distance_meters: closestDistance === Infinity ? null : Math.round(closestDistance),
              },
            },
            { status: 403 }
          );
        }

        geofenceVerified = true;
        distanceFromStudio = Math.round(closestDistance);
        matchedLocationName = matchedLocation.name;
      } else {
        // Use geofence_locations table
        let closestDistance = Infinity;
        let matchedGeofence: (typeof geofences)[0] | null = null;

        for (const geo of geofences) {
          if (geo.latitude == null || geo.longitude == null) continue;
          const distance = haversineDistance(lat, lng, geo.latitude, geo.longitude);
          if (distance <= geo.radius_meters && distance < closestDistance) {
            matchedGeofence = geo;
            closestDistance = distance;
          }
        }

        if (!matchedGeofence) {
          // Find the absolute closest for error details
          for (const geo of geofences) {
            if (geo.latitude == null || geo.longitude == null) continue;
            const distance = haversineDistance(lat, lng, geo.latitude, geo.longitude);
            if (distance < closestDistance) {
              closestDistance = distance;
            }
          }

          return NextResponse.json(
            {
              error: "You are too far from the studio to clock in",
              details: {
                your_coordinates: { lat, lng },
                closest_distance_meters: closestDistance === Infinity ? null : Math.round(closestDistance),
              },
            },
            { status: 403 }
          );
        }

        geofenceVerified = true;
        geofenceLocationId = matchedGeofence.id;
        distanceFromStudio = Math.round(closestDistance);
        matchedLocationName = matchedGeofence.name;
      }
    }

    const now = new Date().toISOString();

    if (action === "clock_in") {
      // Check if already clocked in (no clock_out yet)
      const { data: activeShift } = await supabase
        .from("clock_entries")
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

      const insertData: Record<string, unknown> = {
        employee_id: user.id,
        studio_id: studioId,
        location_id: location_id ?? null,
        clock_in: now,
        status: "active",
      };

      // Add geofence fields if coordinates were provided
      if (typeof lat === "number" && typeof lng === "number") {
        insertData.latitude_in = lat;
        insertData.longitude_in = lng;
        insertData.geofence_verified_in = geofenceVerified;
        if (geofenceLocationId) {
          insertData.geofence_location_id = geofenceLocationId;
        }
        if (distanceFromStudio !== null) {
          insertData.distance_from_studio = distanceFromStudio;
        }
      }

      const { data: entry, error: insertError } = await supabase
        .from("clock_entries")
        .insert(insertData)
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
        type: "employee_clocked_in",
        subject_type: "clock_entry",
        subject_id: entry.id,
        metadata: {
          location_name: matchedLocationName,
          geofence_verified: geofenceVerified,
          distance_meters: distanceFromStudio,
        },
      });

      return NextResponse.json({
        data: entry,
        location: matchedLocationName,
        geofence_verified: geofenceVerified,
        distance_meters: distanceFromStudio,
      }, { status: 201 });
    }

    // ─── Clock Out ────────────────────────────────────────────
    const { data: activeEntry, error: findError } = await supabase
      .from("clock_entries")
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
    const totalHours =
      (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

    const updateData: Record<string, unknown> = {
      clock_out: now,
      total_hours: Math.round(totalHours * 100) / 100,
      status: "completed",
    };

    // Add geofence fields for clock out
    if (typeof lat === "number" && typeof lng === "number") {
      updateData.latitude_out = lat;
      updateData.longitude_out = lng;
      updateData.geofence_verified_out = geofenceVerified;
    }

    const { data: updatedEntry, error: updateError } = await supabase
      .from("clock_entries")
      .update(updateData)
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
      type: "employee_clocked_out",
      subject_type: "clock_entry",
      subject_id: activeEntry.id,
      metadata: {
        location_name: matchedLocationName,
        total_hours: Math.round(totalHours * 100) / 100,
        geofence_verified: geofenceVerified,
        distance_meters: distanceFromStudio,
      },
    });

    return NextResponse.json({
      data: updatedEntry,
      location: matchedLocationName,
      total_hours: Math.round(totalHours * 100) / 100,
      geofence_verified: geofenceVerified,
      distance_meters: distanceFromStudio,
    });
  } catch (err) {
    console.error("POST /api/clock error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
