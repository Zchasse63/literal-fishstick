# Meridian — Future Plans & Deferred Features

**Last updated:** March 20, 2026

This document tracks features that were scoped, designed, and intentionally deferred to keep delivery timelines realistic. Each item includes the original design spec so it can be picked up without re-discovery.

---

## 1. Custom Dashboard Builder (Deferred from Phase 3 → Phase 4)

**What it is:** A drag-and-drop dashboard builder allowing studio owners to create custom analytics views with configurable widgets.

**Why deferred:**
- Estimated 2-3 weeks of development for low near-term value
- `react-grid-layout` has unverified React 19 compatibility
- 3 pre-built dashboards (Executive Overview, Daily Operations, Growth & Retention) deliver 90% of the value
- Competes poorly with free BI tools (Metabase, Grafana) that power users already know

**Original design:**

### Database Tables

```sql
CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  layout JSONB NOT NULL DEFAULT '[]', -- react-grid-layout format
  is_default BOOLEAN DEFAULT FALSE,
  is_shared BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  studio_id UUID NOT NULL,
  widget_type TEXT NOT NULL CHECK (widget_type IN (
    'metric_card', 'line_chart', 'bar_chart', 'pie_chart',
    'area_chart', 'heatmap', 'cohort_chart', 'table',
    'leaderboard', 'ai_insight', 'funnel', 'gauge'
  )),
  title TEXT NOT NULL,
  subtitle TEXT,
  data_source TEXT NOT NULL,
  metric_key TEXT,
  aggregation TEXT,
  time_range TEXT DEFAULT '30d',
  custom_start DATE,
  custom_end DATE,
  group_by TEXT,
  filters JSONB DEFAULT '{}',
  color TEXT DEFAULT '#4F46E5',
  show_trend BOOLEAN DEFAULT TRUE,
  comparison_period TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/dashboards` | List all dashboards for studio |
| POST | `/api/dashboards` | Create new dashboard |
| GET | `/api/dashboards/[id]` | Get dashboard with widgets |
| PUT | `/api/dashboards/[id]` | Update dashboard (name, layout) |
| DELETE | `/api/dashboards/[id]` | Delete dashboard |
| POST | `/api/dashboards/[id]/widgets` | Add widget to dashboard |
| PUT | `/api/dashboards/[id]/widgets/[wid]` | Update widget config |
| DELETE | `/api/dashboards/[id]/widgets/[wid]` | Remove widget |
| POST | `/api/dashboards/[id]/duplicate` | Clone a dashboard |

### UI Spec

- **react-grid-layout** powered drag-and-drop canvas
- Widget toolbar: 12 widget types with visual previews
- Click widget to configure: data source, metric, time range, grouping, colors
- Auto-save layout on drag/resize
- "Share" toggle for team visibility
- "Export Dashboard as PDF" button

### Implementation Notes

- Widget data resolver must use a hardcoded `DATA_SOURCE_MAP` object (not dynamic table names) to prevent SQL injection
- Validate `react-grid-layout` compatibility with React 19 before starting
- Consider `@hello-pangea/dnd` as alternative if react-grid-layout doesn't work

---

## 2. Dashboard Export as PDF (Cut from Phase 3)

**What it is:** Render all dashboard widgets to a single branded PDF document.

**Why cut:** Disproportionate complexity vs. use frequency. Browser print (`Cmd+P`) provides adequate functionality.

**If revisited:** Use `html2canvas` + `jsPDF` to capture the dashboard DOM. Handle chart SVG rendering carefully.

---

*Items below this line are features that were considered and may be added in future phases.*

---

## 3. Natural Language Analytics Queries (Phase 4+)

**What it is:** Ask questions like "What was our busiest day last month?" and get answers from analytics data.

**Requires:** pgvector infrastructure, embedding pipeline for schema metadata, query-to-SQL translation via Claude.

**Status:** pgvector is in the tech stack but not yet deployed. Stub the UI in Phase 3 AI Insights hub ("Ask Meridian" input field, disabled with "Coming soon" tooltip).

---

## 4. WebSocket Real-Time (Phase 4+)

**What it is:** Replace 60-second polling with Supabase Realtime WebSocket subscriptions for live facility status, activity feed, and booking updates.

**Status:** Phase 1 shipped with 60-second polling. Reassess in Phase 4 based on user feedback and scale requirements.
