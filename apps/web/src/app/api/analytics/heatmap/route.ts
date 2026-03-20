import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/analytics/heatmap
 * Fetch attendance heatmap data: day_of_week x hour_of_day with fill rates.
 * Query params: start_date, end_date, class_type (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const classType = searchParams.get("class_type");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start_date and end_date are required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // ─── Auth ──────────────────────────────────────────────────
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    // ─── RPC Call ─────────────────────────────────────────────
    const rpcParams: Record<string, unknown> = {
      p_studio_id: studioId,
      p_start_date: startDate,
      p_end_date: endDate,
    };

    if (classType) {
      rpcParams.p_class_type = classType;
    }

    const { data, error } = await supabase.rpc(
      "get_attendance_heatmap",
      rpcParams
    );

    if (error) {
      console.error("get_attendance_heatmap RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch heatmap data" },
        { status: 500 }
      );
    }

    // ─── Format grid data ─────────────────────────────────────
    // RPC returns rows with day_of_week, hour_of_day, total_bookings,
    // total_capacity, fill_rate. Reshape into a grid.
    const grid: Record<
      number,
      Record<
        number,
        { bookings: number; capacity: number; fill_rate: number }
      >
    > = {};

    // Initialize 7 days x 24 hours
    for (let day = 0; day < 7; day++) {
      grid[day] = {};
      for (let hour = 0; hour < 24; hour++) {
        grid[day][hour] = { bookings: 0, capacity: 0, fill_rate: 0 };
      }
    }

    for (const row of data ?? []) {
      const day = row.day_of_week;
      const hour = row.hour_of_day;
      if (grid[day] && grid[day][hour] !== undefined) {
        grid[day][hour] = {
          bookings: row.total_bookings ?? 0,
          capacity: row.total_capacity ?? 0,
          fill_rate:
            row.fill_rate != null
              ? Math.round(row.fill_rate * 100) / 100
              : 0,
        };
      }
    }

    return NextResponse.json({
      data: {
        start_date: startDate,
        end_date: endDate,
        class_type: classType ?? "all",
        grid,
      },
    });
  } catch (err) {
    console.error("GET /api/analytics/heatmap error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
