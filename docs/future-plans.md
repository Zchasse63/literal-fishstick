# Meridian — Future Plans & Deferred Features

**Last updated:** March 20, 2026

This document tracks features that were scoped, designed, and intentionally deferred to keep delivery timelines realistic. Each item includes the original design spec so it can be picked up without re-discovery.

---

## 1. Custom Dashboard Builder (Deferred from Phase 3 → Phase 4 → Future)

**What it is:** A drag-and-drop dashboard builder allowing studio owners to create custom analytics views with configurable widgets.

**Why deferred:**
- Estimated 2-3 weeks of development for low near-term value
- 3 pre-built dashboards (Executive Overview, Daily Operations, Growth & Retention) deliver 90% of the value
- Competes poorly with free BI tools (Metabase, Grafana) that power users already know
- Should use `@dnd-kit` (already installed) rather than `react-grid-layout` (React 19 compatibility issues)

**Original design:**

### Database Tables

```sql
CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  layout JSONB NOT NULL DEFAULT '[]', -- grid layout format
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

- **@dnd-kit** powered drag-and-drop canvas (already installed in project)
- Widget toolbar: 12 widget types with visual previews
- Click widget to configure: data source, metric, time range, grouping, colors
- Auto-save layout on drag/resize
- "Share" toggle for team visibility

### Implementation Notes

- Widget data resolver must use a hardcoded `DATA_SOURCE_MAP` object (not dynamic table names) to prevent SQL injection
- Use `@dnd-kit/sortable` for grid layout — avoids adding a new dependency

---

## 2. Dashboard Export as PDF (Cut from Phase 3)

**What it is:** Render all dashboard widgets to a single branded PDF document.

**Why cut:** Disproportionate complexity vs. use frequency. Browser print (`Cmd+P`) provides adequate functionality.

**If revisited:** Use `html2canvas` + `jsPDF` to capture the dashboard DOM. Handle chart SVG rendering carefully.

---

## 3. Natural Language Analytics Queries (Future)

**What it is:** Ask questions like "What was our busiest day last month?" and get answers from analytics data.

**Requires:** pgvector infrastructure, embedding pipeline for schema metadata, query-to-SQL translation via Claude.

**Status:** pgvector is in the tech stack but not yet deployed. Stub the UI in Phase 3 AI Insights hub ("Ask Meridian" input field, disabled with "Coming soon" tooltip).

---

## 4. WebSocket Real-Time (Future)

**What it is:** Replace 60-second polling with Supabase Realtime WebSocket subscriptions for live facility status, activity feed, and booking updates.

**Status:** Phase 1 shipped with 60-second polling. Reassess based on user feedback and scale requirements.

---

## 5. SaaS Multi-Tenant Onboarding (Deferred from Phase 4 → Future)

**What it is:** A complete onboarding wizard and subscription management system for selling Meridian to other fitness studios as a SaaS product.

**Why deferred:**
- No external customer is ready to sign up yet — building from assumptions wastes time
- The onboarding wizard will need to be shaped by the first real pilot customer's needs
- Estimated 4-6 weeks of work that would be rebuilt once real feedback arrives
- The right time to build this is when the first external studio is ready to sign

**Original design:**

### Database Tables

```sql
CREATE TABLE saas_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'paused')),
  member_limit INT,
  staff_limit INT,
  location_limit INT DEFAULT 1,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  monthly_amount NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  studio_info_completed BOOLEAN DEFAULT FALSE,
  billing_completed BOOLEAN DEFAULT FALSE,
  branding_completed BOOLEAN DEFAULT FALSE,
  import_completed BOOLEAN DEFAULT FALSE,
  team_invited BOOLEAN DEFAULT FALSE,
  first_class_created BOOLEAN DEFAULT FALSE,
  first_booking_received BOOLEAN DEFAULT FALSE,
  current_step INT DEFAULT 1,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(studio_id)
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{read}',
  last_used_at TIMESTAMPTZ,
  request_count INT DEFAULT 0,
  rate_limit INT DEFAULT 1000,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/onboarding/studio` | Create new studio (provisioning) |
| GET | `/api/onboarding/progress` | Get onboarding progress |
| PUT | `/api/onboarding/progress` | Update onboarding step |
| POST | `/api/onboarding/invite` | Invite team members |
| GET | `/api/subscription` | Get current SaaS subscription |
| POST | `/api/subscription/upgrade` | Upgrade SaaS plan |
| POST | `/api/subscription/cancel` | Cancel SaaS subscription |
| POST | `/api/webhooks/stripe-saas` | SaaS billing webhooks |
| GET | `/api/api-keys` | List API keys |
| POST | `/api/api-keys` | Generate new API key |
| DELETE | `/api/api-keys/[id]` | Revoke API key |
| GET | `/api/api-keys/[id]/usage` | Get key usage stats |

### UI Pages

- **Onboarding Wizard** — Multi-step setup (studio info → billing → branding → import → invite team → first class)
- **Subscription Management** — Current plan, usage, upgrade/downgrade, billing history
- **API Key Management** — Generate, revoke, view usage

### Implementation Notes

- Use Stripe Billing for SaaS subscription (separate from studio payment processing)
- Route SaaS billing events through existing `/api/webhooks/stripe` handler using `metadata.subscription_type: 'saas'` — do NOT create a separate webhook endpoint
- OpenAPI spec should be static YAML (not `next-swagger-doc` which only works with Pages Router), served via GET route, rendered with `swagger-ui-react` (dynamically imported to avoid bundle bloat)

---

*Items below this line are features that may be added based on user feedback and business needs.*

---

## 6. IoT Equipment Logging

**What it is:** Connect sauna/plunge temperature sensors, usage counters, and maintenance alerts.

**Status:** DEFER — requires hardware integration research.

---

## 7. Weather Correlation Analytics

**What it is:** Correlate attendance patterns with local weather data to predict busy/slow days.

**Status:** DEFER — needs sufficient historical data + weather API integration.
