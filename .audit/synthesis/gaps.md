# Coverage Gaps

Generated: 2026-04-02
Source layers: 10

Areas that were insufficiently covered by all auditors combined.

---

## Uncovered Source Files

The following categories of files received zero or minimal examination across all 10 layers:

### Hooks (13 files in `src/hooks/`)
- `useClasses`, `useMembers`, `useBookings`, `useClockAction`, `useEmployeeProfile`, etc.
- **What is missing**: No layer audited the hook implementations for correctness. Testing-quality noted zero hook tests exist. UI-UX referenced hooks indirectly. Performance-infra noted TanStack Query is installed but unused, and hooks use manual `setInterval` polling. But no layer verified that the hooks query the correct columns, handle errors gracefully, or clean up polling on unmount.
- **Why it matters**: These hooks are the primary data access layer for the entire frontend. A bug in `useClasses` (e.g., wrong column name in `.select()`) would break the schedule for all users.
- **Recommendation**: The hooks warrant a dedicated review pass, ideally combined with adding the first hook tests using Vitest + Testing Library.

### Shared UI Components (`components/ui/` -- 24 shadcn files)
- **What is missing**: UI-UX noted which shadcn components are installed vs actually used by pages, but no layer examined the component implementations for customization bugs, prop handling issues, or accessibility regressions introduced during shadcn code-generation.
- **Why it matters**: Components like `Dialog`, `Sheet`, and `DropdownMenu` are correctly installed but unused -- the finding is at the page level (pages build their own modals). The components themselves are likely fine (generated from Radix), but any local modifications would be unaudited.
- **Recommendation**: Low priority. The shadcn components are well-tested upstream. Focus on the pages that bypass them.

### Python Scripts (`scripts/import_glofox_members.py`, `scripts/import_classes.py`)
- **What is missing**: No layer examined the Python import scripts. These scripts presumably import data from Glofox into Supabase.
- **Why it matters**: If these scripts are still used for data import, they could introduce data quality issues (wrong formats, missing fields, duplicate records). The data-model layer identified phone number format inconsistencies that may originate from these scripts.
- **Recommendation**: Low priority if the Inngest-based Glofox sync has replaced these scripts. If they are still used, they should be reviewed for data validation.

### Email Templates (`lib/email-templates.ts`)
- **What is missing**: Integration flagged the hardcoded `thesaunaguys.com` URLs (I-L4). No layer audited the template rendering logic, Handlebars variable injection, HTML email compatibility, or dark mode rendering in email clients.
- **Why it matters**: Email is a core deliverable of the Marketing module. Broken templates in production emails damage brand credibility.
- **Recommendation**: Add to Phase 2 Marketing testing scope.

---

## Uncovered Concerns

### Logging and Observability
- **What is missing**: Performance-infra (PERF-19, PERF-21) noted no structured logging and no error tracking (Sentry/Datadog). Integration (I-L7) independently noted the same. But no layer assessed the current console.log/console.error patterns for information leakage, PII exposure in logs, or correlation capability.
- **Why it matters**: In a Netlify serverless environment, console output is ephemeral. A production failure in a Stripe webhook or AI endpoint will produce no alert and the logs may roll off before anyone notices. The platform handles real money (Stripe) and real personal data (member profiles).
- **Recommendation**: Install Sentry before production launch. Add structured logging (pino) with request IDs for cross-function correlation.

### Backup and Recovery
- **What is missing**: No layer assessed backup strategy. The data-model layer identified that Phase 1 schema has no DDL file (H-002), which means there is no ability to recreate the database from source. But no layer checked: Does Supabase have point-in-time recovery enabled? Is there a backup verification process? What is the RPO/RTO?
- **Why it matters**: The platform stores financial records (transactions, payroll), membership data, and business metrics. Data loss would be catastrophic for a studio relying on Meridian as its primary operating system.
- **Recommendation**: Verify Supabase PITR is enabled on the production project. Document the RPO (should be minutes, not days). Export and commit the Phase 1 schema DDL (`pg_dump --schema-only`).

### Deployment Pipeline
- **What is missing**: Performance-infra audited the CI pipeline (GitHub Actions) and noted E2E tests are not included (PERF-09). But no layer assessed the deployment pipeline itself: How are deployments triggered? Is there a staging environment? Is there a rollback procedure? Are environment variables managed via Netlify dashboard or IaC?
- **Why it matters**: A misconfigured deployment (missing env var, wrong Node version) could take the platform offline. The Node version mismatch (CI: 22, Netlify: 20) is evidence that the deployment config has drifted from the development config.
- **Recommendation**: Document the deployment process. Add a staging environment with identical config. Consider Netlify's deploy preview feature for PR-based testing.

### Internationalization (i18n)
- **What is missing**: No layer assessed i18n readiness. The ui-ux layer noted `<html lang="en">` is set correctly and mentioned potential Spanish language support for a Florida studio. All user-facing strings are hardcoded in English in TSX files.
- **Why it matters**: Low priority for Phase 1 (admin-only tool in English). Becomes relevant if member-facing surfaces serve Spanish-speaking members in Tampa.
- **Recommendation**: Not blocking for any current phase. Note for Phase 5 planning.

### Dependency Vulnerabilities
- **What is missing**: Security (SEC-L1) noted no `npm audit` in CI and no Dependabot configuration. No layer ran an actual dependency audit. The security layer mentioned `handlebars ^4.7.8` as warranting monitoring (historical prototype pollution).
- **Why it matters**: The project has 80+ direct dependencies including Stripe SDK, Anthropic SDK, Twilio SDK, and Supabase SDK. A CVE in any of these could expose financial or personal data.
- **Recommendation**: Add `npm audit --audit-level=high` to CI. Enable Dependabot or Snyk for automated monitoring.

### Accessibility (beyond ARIA)
- **What is missing**: UI-UX provided a thorough ARIA and keyboard navigation audit. However, no layer performed actual accessibility testing with a screen reader or automated tool (axe-core, Lighthouse accessibility). Color contrast was noted as "likely passing" without measurement. The `text-gray-400` on `bg-gray-50` combination was flagged as borderline but not measured.
- **Why it matters**: If the platform serves ADA-covered businesses (fitness studios in the US), accessibility compliance is a legal requirement for member-facing surfaces. Even for admin tools, accessibility is a quality differentiator.
- **Recommendation**: Run Lighthouse accessibility audit on 5 key pages. Add axe-core to the E2E test suite. Priority increases significantly in Phase 5 (member-facing).

### Multi-Tenant Data Isolation Verification
- **What is missing**: Multiple layers flagged the hardcoded studio ID and the unset RLS session variable. But no layer performed an actual data isolation test: Can a user from Studio A access Studio B's data by manipulating request parameters? The security layer noted that the SQL execution endpoint has "bypassable studio isolation" (SEC-C3) but acknowledged it was analyzing code, not testing runtime behavior.
- **Why it matters**: This is the fundamental security property of a SaaS platform. The code-level findings suggest isolation is enforced by application-level `.eq()` filters, not by database-level RLS. Any route that omits the filter leaks data.
- **Recommendation**: Before onboarding a second studio, perform a dedicated multi-tenant security test with two studio accounts. Verify every API route returns only the correct studio's data.

### Mobile/Responsive Testing
- **What is missing**: UI-UX (M-3) noted that the admin layout's sidebar does not collapse for mobile viewports and the employee portal has no mobile accommodation. But no layer tested actual mobile rendering, touch interactions, or the employee portal's clock-in flow on a phone.
- **Why it matters**: The employee portal is explicitly designed for field use (clock in/out). Employees will use it on their phones. If the layout does not work on mobile, the clock-in feature is unusable in practice.
- **Recommendation**: Test the employee portal on a mobile viewport. Priority: HIGH for the employee portal, MEDIUM for the admin dashboard.
