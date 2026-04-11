<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:e2e-testid-convention -->
# data-testid seeding for E2E tests

The Meridian QA pipeline (`/qa-council`) runs Playwright against the real UI and relies on `data-testid` attributes to target elements reliably. CSS classes, generated ids, and text content are forbidden as primary selectors because they are brittle — this doc is the single source of truth for how to add testids.

## Naming convention

```
data-testid="{module}-{component}-{action-or-role}"
```

- **module** — the top-level page/section. Recognized prefixes (keep this list updated as new tiers run through `/qa-council`):
  - `login` — auth pages (`/login`)
  - `command` — Command Center (`/`)
  - `schedule` — Schedule module (`/schedule`)
  - `members` — Members directory + detail (`/members`, `/members/[id]`)
  - `revenue` — Revenue module + orders + products (`/revenue`, `/revenue/orders`, `/revenue/products/*`)
  - `marketing` — Marketing campaigns, automations, content, leads (`/marketing/*`)
  - `corporate` — Corporate accounts + events (`/corporate/*`)
  - `analytics` — Analytics dashboards, insights, KPI, reports, trainers, pricing (`/analytics/*`)
  - `operations` — Operations, documents, payroll (`/operations/*`)
  - `settings` — Settings, geofence, SMS (`/settings/*`)
  - `segments` — Smart Segments (`/segments`)
  - `engagement` — Engagement (`/engagement`)
  - `docs` — API docs (`/docs/api`)
  - `employee` — Employee portal (all `/employee/*` pages)
  - `toast` — Global toast notification (single element, not module-scoped)
- **component** — the UI unit: `transactions-table`, `record-payment-dialog`, `smart-segment-form`, `class-calendar`, `member-card`
- **action-or-role** — what the element is or does: `btn`, `input`, `submit`, `row`, `header`, `empty-state`, `error`

Join with hyphens. Lower case only. No PascalCase. No abbreviations beyond the common set (`btn`, `nav`, `hdr`).

## Examples

✅ Good:

| Element | testid |
|---|---|
| "Record Payment" primary button on `/revenue/transactions` | `revenue-record-payment-btn` |
| Amount input inside the Record Payment dialog | `revenue-payment-form-amount-input` |
| Submit button inside the same dialog | `revenue-payment-form-submit` |
| Row in the transactions table (per-row) | `revenue-transactions-row` (plus `key` or index in test) |
| Empty state on the members directory | `members-directory-empty-state` |
| "Mark All Read" button in Command Center activity feed | `command-activity-mark-all-btn` |
| Class tile on the schedule grid | `schedule-class-tile` |
| Success toast after a save (handled automatically by BasePage) | `toast-notification` (single element) |

❌ Bad:

| Wrong testid | Why |
|---|---|
| `btn-1` | Not scoped, not describing purpose |
| `recordPaymentButton` | camelCase, missing module |
| `revenue_record_payment_btn` | underscores, not hyphens |
| `revenue-record-payment` | missing role/action suffix |
| `save-btn` | no module — collides with every other save button |

## Where to add them

Add a testid when one of these is true:

1. The element is **interactive** and tests will click/fill/select it.
2. The element is a **container** whose visibility tests will assert (dialogs, tables, empty states, loaders, toasts).
3. The element represents a **list item** that tests will enumerate or index.

Do NOT add testids to:
- Plain text paragraphs
- Purely decorative elements (icons, dividers, backgrounds)
- Elements that already have a unique accessible role + name that Playwright can target via `getByRole` / `getByLabel`

Prefer `getByRole` / `getByLabel` / `getByText` when the element has a clear accessible identity. Testid is the fallback when accessible targeting is unreliable (shadcn `Popover`, nested menus, Radix animated content).

## Seeding workflow (pipeline-driven)

1. The Analyst's spec lists every testid the scenarios need. Missing ones are flagged `[NEEDS SEEDING]`.
2. The Architect's plan enumerates the exact source files that must be edited.
3. The Engineer adds the attributes in **Step 1** of their execution checklist, BEFORE writing the tests.
4. The Sentinel greps for undocumented testid usage and blocks the suite if any test references a testid not present in source.

## Minimal diff discipline

- One attribute per element.
- Never rename existing testids (that breaks the suite).
- Never restructure a component just to add a testid. If the structure makes it impossible, add a wrapper `<div data-testid="..." />` or raise a question back to the Architect.
- Keep the diff scoped: the PR that adds a testid should only add that attribute, no refactors.

## Shadcn / Radix specifics

- **Dialog:** already exposes `role="dialog"`. Use `getByRole('dialog', { name: 'Record Payment' })`. Add a testid only for the dialog's *inner* form container if you need to scope locators.
- **Popover / DropdownMenu / Command (cmdk):** animated and portal-rendered. ADD testids liberally to triggers and menu items — Radix's internal state makes role-based selection unreliable during animations.
- **Select:** use `getByRole('combobox', { name: 'Type' })` for the trigger, and `getByRole('option', { name: 'Drop-in' })` for options. Testid as backup.
- **Toast (Meridian custom):** Meridian does NOT use sonner. It uses a single `<ToastNotification>` component (`src/components/ui/toast-notification.tsx`) with `data-testid="toast-notification"` + `role="status"`. Use `BasePage.expectToast(message?)`. There is no success/error type distinction — check the message text if you need to disambiguate.
- **Table rows:** if rows have a unique key, add `data-testid="revenue-transactions-row"` + `data-row-key={id}` so the test can target by both selector and key.
- **Form fields:** prefer `getByLabel('Amount')` (shadcn's `<Label>` wires `htmlFor` correctly). Add testid if the label is ambiguous or localized.

## Relationship to the QA pipeline

The commands in `.claude/commands/qa-*.md` depend on this convention. If you change the convention, update:
- `.claude/commands/qa-analyst.md` (§6 Data-testid requirements)
- `.claude/commands/qa-architect.md` (POM skeleton guidance)
- `.claude/commands/qa-engineer.md` (Step 1 — Seed testids)
- `.claude/commands/qa-sentinel.md` (grep for forbidden patterns)
- `apps/web/e2e/pages/BasePage.ts` (the `byTestId` helper)

And re-run any feature's `/qa-council` to regenerate specs + tests.
<!-- END:e2e-testid-convention -->
