/**
 * Shared test data constants — referenced by auth.setup.ts, fixture helpers,
 * and individual spec files. Keep this file lean: only values that must be
 * consistent across the entire test suite.
 */

// ---------------------------------------------------------------------------
// Studio IDs
// ---------------------------------------------------------------------------

/**
 * The "default" studio hardcoded by 43 admin pages (see BUG-001 /
 * specs/bugs/revenue-default-studio-coupling.md). Must match
 * `src/lib/constants.ts::DEFAULT_STUDIO_ID` exactly or admin pages will
 * not see seeded data.
 *
 * When BUG-001 is resolved (admin reads studio_id from the session instead of
 * this constant), tests can switch to ISOLATED_TEST_STUDIO_ID for full isolation.
 */
export const DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'

/**
 * Legacy isolated test studio used before the pilot pivot. Not queried by the
 * admin UI, so seeded data here is invisible to Tier 2+ tests. Retained in case
 * a future spec needs guaranteed isolation.
 */
export const ISOLATED_TEST_STUDIO_ID = '00000000-0000-4000-a000-000000000000'

/**
 * The studio E2E tests seed to by default. Resolves to DEFAULT_STUDIO_ID so
 * the admin UI can see the rows. CI or advanced users can override by setting
 * the `E2E_STUDIO_ID` env var.
 */
export const E2E_STUDIO_ID: string =
  process.env.E2E_STUDIO_ID ?? DEFAULT_STUDIO_ID

/**
 * @deprecated Historical alias — now resolves to {@link E2E_STUDIO_ID}. Existing
 * imports keep working, but new code should use `E2E_STUDIO_ID` directly.
 */
export const TEST_STUDIO_ID: string = E2E_STUDIO_ID

export const TEST_STUDIO_NAME = 'E2E Test Studio'
export const TEST_STUDIO_SLUG = 'e2e-test-studio'
export const TEST_STUDIO_TIMEZONE = 'America/New_York'

// ---------------------------------------------------------------------------
// Test data marker patterns (used by resetStudioTestData for scoped cleanup)
// ---------------------------------------------------------------------------

/** Email pattern for seeded member profiles — used by cleanup filters. */
export const E2E_MEMBER_EMAIL_PATTERN = 'e2e-member-%@test.meridian.app'

/** Title prefix for seeded classes — used by cleanup filters. */
export const E2E_CLASS_TITLE_PREFIX = 'E2E Test'

/** Description prefix for seeded transactions — used by cleanup filters. */
export const E2E_TRANSACTION_DESCRIPTION_PREFIX = 'E2E Test'

/** Name prefix for seeded products — used by cleanup filters. */
export const E2E_PRODUCT_NAME_PREFIX = 'E2ETestProduct_'

/**
 * Full-name prefix for member rows created via the admin "Add Member" modal
 * flow (Tier 3.5). Used by the test suite to scope DB assertions to test-only
 * rows. Email addresses for these rows must match
 * {@link E2E_MEMBER_EMAIL_PATTERN} so the cleanup function picks them up.
 */
export const E2E_MEMBER_NAME_PREFIX = 'E2ETestMember_'

// ---------------------------------------------------------------------------
// Auth users
// ---------------------------------------------------------------------------

/** Admin (owner) test user — pre-seeded by auth.setup.ts. */
export const ADMIN_USER = {
  email: 'meridian-e2e-admin@test.meridian.app',
  password: 'e2e-test-admin-password-2026!',
  fullName: 'E2E Admin',
  roles: ['owner'],
} as const

/** Employee (trainer) test user — pre-seeded by auth.setup.ts. */
export const EMPLOYEE_USER = {
  email: 'meridian-e2e-employee@test.meridian.app',
  password: 'e2e-test-employee-password-2026!',
  fullName: 'E2E Trainer',
  roles: ['trainer'],
} as const

/** Default test member for revenue/booking flows. */
export const TEST_MEMBER = {
  email: 'meridian-e2e-member@test.meridian.app',
  fullName: 'E2E Test Member',
  phone: '+15555550100',
} as const

// ---------------------------------------------------------------------------
// Class type references (Tier 3.8+)
// ---------------------------------------------------------------------------

/**
 * UUID of the "Open Sauna" class_type in the default test studio. These rows
 * are seeded at DB init and never recreated by tests — the test suite references
 * them by ID for create-class flows. Confirmed stable via Tier 3.8 Analyst probe
 * on 2026-04-10.
 */
export const DEFAULT_CLASS_TYPE_OPEN_SAUNA_ID =
  '314f0ddf-dc6d-4402-beaa-22ed19172b18'

/**
 * Display name of the "Open Sauna" class_type. Used as the expected default
 * `title` value in Tier 3.8 Scenario 4 (blank-title defaulting — BUG-015 L2).
 */
export const DEFAULT_CLASS_TYPE_OPEN_SAUNA_NAME = 'Open Sauna'
