# Meridian Security Audit Report

**Project:** Meridian — Fitness Studio Operating System
**Codebase:** `/Users/zach/Desktop/literal-fishstick`
**Auditor:** Security Auditor Agent (Codebase Cartographer)
**Date:** 2026-03-21
**Scope:** Static heuristic analysis of `apps/web/` — Next.js 16 App Router, Supabase, Stripe, Anthropic AI

---

## Important Disclaimer

This report is the output of **static heuristic analysis** of source code. It is not a penetration test, dynamic scan, or full security audit. Findings are based on code patterns, configuration review, and known vulnerability classes. False positives and missed findings are possible.

**Recommended complementary tools before production launch:**
- [Semgrep](https://semgrep.dev/) — static analysis rules for OWASP Top 10
- [Snyk](https://snyk.io/) — dependency vulnerability scanning (run `snyk test` in `apps/web/`)
- [OWASP ZAP](https://owasp.org/www-project-zap/) — dynamic application scanning against a staging environment
- `npm audit` — run immediately to get current CVE status

---

## Executive Summary

Meridian is a well-structured Next.js 16 monorepo with generally sound auth patterns. Most sensitive API routes use `supabase.auth.getUser()` for authentication and check roles before mutating data. Stripe and Resend webhook handlers implement proper signature verification. However, **three critical issues require immediate action before any production traffic**: live API credentials committed to the repository (or resident on developer machines and at risk of accidental commit), an open redirect in the OAuth callback, and the `SUPABASE_SERVICE_ROLE_KEY` present in `.env.local` alongside a live Supabase URL and Anthropic key.

Beyond those, the audit surfaces a cluster of HIGH-severity issues: missing security headers across all responses, a cryptographically weak gift card code generator, Handlebars templates compiled with HTML escaping disabled, an in-memory rate limiter that resets on every serverless cold start, and a missing `PUT /api/members/[id]` role check that lets any authenticated user escalate their own `roles` array.

---

## Findings

### CRITICAL

---

#### CRIT-01: Live API Credentials in `.env.local`

**File:** `apps/web/.env.local`
**Lines:** 1–6

The `.env.local` file contains three live credentials:

- `NEXT_PUBLIC_SUPABASE_URL` — the production Supabase project URL (`rhdmiyttafsbfuflnjza.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — the anon/publishable key (prefix `sb_publishable_`)
- `SUPABASE_SERVICE_ROLE_KEY` — a **full service-role JWT** that bypasses all Row Level Security
- `ANTHROPIC_API_KEY` — a live Anthropic API key (`sk-ant-api03-T83V3Tfo7OcWCX9...`)

The `.gitignore` at both the root and `apps/web/` correctly excludes `.env*` files, so these credentials are not currently in the git history. However:

1. If any developer accidentally runs `git add -f .env.local` or modifies the `.gitignore`, these rotate to the repo and every clone of it.
2. The `SUPABASE_SERVICE_ROLE_KEY` can be decoded from the JWT — it encodes the project `ref` and the `service_role` claim. Anyone who obtains this key can bypass all RLS policies and read or write every row in every table.
3. The `ANTHROPIC_API_KEY` has no scope restrictions; it can be used to generate API calls at the account's expense.

**Remediation:**
1. Immediately rotate the `SUPABASE_SERVICE_ROLE_KEY` in the Supabase dashboard (Settings > API > Service Role Key > Regenerate).
2. Immediately rotate the `ANTHROPIC_API_KEY` in the Anthropic console.
3. Confirm with `git log --all --full-history -- '**/.env.local'` that the file has never been committed.
4. Add a pre-commit hook (e.g., `detect-secrets` or `git-secrets`) to prevent future accidental commits of credential patterns.
5. Store production secrets in Netlify's environment variable vault, not in `.env.local`.

---

#### CRIT-02: Open Redirect in OAuth Callback

**File:** `apps/web/src/app/(auth)/auth/callback/route.ts`
**Lines:** 6–19

```typescript
const redirect = searchParams.get("redirect") || "/";
// ...
return NextResponse.redirect(`${origin}${redirect}`);
```

The `redirect` query parameter is taken directly from the URL and appended to the current origin without any validation. An attacker can craft a phishing URL such as:

```
https://app.meridian.studio/auth/callback?code=VALID_CODE&redirect=//evil.com/steal-session
```

After the OAuth code is exchanged and the user is authenticated, they are redirected to `https://app.meridian.studio//evil.com/steal-session`. Browsers interpret `//evil.com` as a protocol-relative URL and follow it, delivering the authenticated user's session context to the attacker's domain.

**Remediation:**
```typescript
// Validate that redirect is a relative path only
const rawRedirect = searchParams.get("redirect") || "/";
const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
  ? rawRedirect
  : "/";
return NextResponse.redirect(`${origin}${redirect}`);
```

Also apply the same fix to `apps/web/src/middleware.ts` line 81 where `redirect` is set as a query param on the login URL (ensuring the callback receives a safe value in the first place).

---

#### CRIT-03: `PUT /api/members/[id]` Missing Role Check — Privilege Escalation

**File:** `apps/web/src/app/api/members/[id]/route.ts`
**Lines:** 137–242 (the `PUT` handler)

The `GET` and `DELETE` handlers on this route check that the caller has the `owner` or `manager` role (lines 38–43 and 268–273 respectively). The `PUT` handler at line 137 checks **only authentication** — it fetches the profile to resolve `studio_id` but never checks `roles`.

The `allowedFields` array at line 167 includes:
```typescript
"roles",
```

This means any authenticated user — including a basic `member` — can `PUT /api/members/<their-own-id>` with `{ "roles": ["owner"] }` and self-escalate to owner. The update is gated only by `studio_id` match (which they already satisfy because their profile is in the studio), and the `studio_id` filter at line 199 does not prevent a member from updating their own profile row.

**Remediation:**
Add the same role check present in the `GET` handler immediately after the `authProfile` fetch in the `PUT` handler:
```typescript
const roles: string[] = authProfile?.roles ?? [];
if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

Additionally, the `roles` field should be removed from `allowedFields` entirely or moved to a separate admin-only endpoint, as allowing any admin to modify roles via a general member-update endpoint is itself a risk.

---

### HIGH

---

#### HIGH-01: Missing Security Headers on All Responses

**File:** `apps/web/next.config.ts`
**Lines:** 1–11

`next.config.ts` contains only image remote pattern configuration. No security headers are set. The following are absent from all HTTP responses:

| Header | Risk of Absence |
|--------|-----------------|
| `Content-Security-Policy` | XSS attacks can execute arbitrary scripts |
| `X-Frame-Options` | Clickjacking — page can be embedded in an iframe |
| `X-Content-Type-Options: nosniff` | MIME sniffing attacks |
| `Strict-Transport-Security` | Downgrades to HTTP; MITM possible |
| `Referrer-Policy` | Internal URLs and auth tokens leak in Referer header |
| `Permissions-Policy` | Unnecessary browser API access (camera, microphone) |

**Remediation:** Add a `headers()` export to `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",  // tighten later
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://*.supabase.co",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  // ... existing config
};
```

---

#### HIGH-02: Handlebars Templates Compiled with `noEscape: true` — Potential XSS in Emails

**File:** `apps/web/src/lib/email-templates.ts`
**Line:** 56

```typescript
const template = Handlebars.compile(templateStr, { noEscape: true })
```

The `noEscape: true` option disables Handlebars' built-in HTML escaping. This means any merge tag value (e.g., `{{first_name}}`) that contains HTML will be injected verbatim into the email body.

Because `templateStr` comes from `campaign.body_template` stored in the database (set by admins via the campaign builder UI), and merge data includes fields like `full_name` and `membership_name` from user profiles, a member who set their name to `<script>alert(1)</script>` would inject that string into emails sent to everyone in the campaign. This is a stored XSS vector in the email rendering path.

While scripts in email clients are universally blocked, HTML injection in emails can still be exploited for phishing (injecting fake links, forms, or images that load from attacker-controlled domains).

**Remediation:**
Remove `{ noEscape: true }` unless the template author is explicitly wrapping in triple-mustache `{{{value}}}` for trusted HTML content:

```typescript
const template = Handlebars.compile(templateStr)
// Use {{{body_html}}} for pre-rendered HTML blocks
// Use {{first_name}} for user-supplied values (auto-escaped)
```

---

#### HIGH-03: Gift Card Code Generator Uses Non-CSPRNG

**File:** `apps/web/src/app/api/webhooks/stripe/route.ts`
**Lines:** 204–212

```typescript
function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-'
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
```

`Math.random()` is a pseudorandom number generator. It is not cryptographically secure. Gift card codes generated this way are predictable if an attacker can observe enough samples or knows the PRNG seed. A valid gift card code grants wallet credit with no expiry.

The same pattern is used for tracking label generation:
`apps/web/src/app/api/orders/[id]/ship/route.ts` line 150: `Math.random().toString(36).substring(2, 10)`

**Remediation:** Replace with `crypto.randomBytes`:
```typescript
import crypto from 'crypto'

function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(9) // 9 bytes * (32 chars) >= 12 chars of entropy
  let code = ''
  for (let i = 0; i < 9; i++) {
    if (i > 0 && i % 3 === 0) code += '-'
    code += chars[bytes[i] % chars.length]
  }
  return code
}
```

---

#### HIGH-04: A/B Test Variant Assignment Uses Non-CSPRNG

**Files:**
- `apps/web/src/app/api/campaigns/send/route.ts` line 248
- `apps/web/src/app/api/campaigns/process-scheduled/route.ts` line 237

```typescript
variant = Math.random() * 100 < splitPct ? 'A' : 'B'
```

`Math.random()` for variant assignment means the A/B split is not statistically uniform. More critically, the same PRNG seed issue applies: if `Math.random()` is seeded predictably in a given serverless invocation, an adversary who can trigger campaign sends could influence which variant recipients receive, skewing A/B test results.

**Remediation:** Use `crypto.randomInt(0, 100) < splitPct` (Node.js `crypto.randomInt` is CSPRNG).

---

#### HIGH-05: In-Memory Rate Limiter Ineffective in Serverless Environment

**File:** `apps/web/src/lib/rate-limit.ts`
**Lines:** 1–50

The rate limiter stores counts in a module-level `Map`:
```typescript
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
```

The file itself acknowledges the limitation in a comment:
> Suitable for single-instance deployments. For multi-instance / serverless, replace with a Redis-backed implementation.

Netlify (the hosting target per `CLAUDE.md`) runs Next.js route handlers as serverless functions. Each function invocation may be a separate cold start with a fresh `rateLimitMap`. This means:
- An attacker can saturate AI endpoints (each costing ~$0.003–$0.015/call) by making requests across multiple parallel connections — each gets a fresh limiter.
- The rate limit on `POST /api/leads/capture` (10 req/min/IP) also resets per-instance.
- The IP-based rate limit for leads capture uses `x-forwarded-for` without validation; a proxy or VPN can trivially rotate IPs.

**Remediation:**
1. Short-term: deploy to a single persistent server or use Netlify Blobs/Edge Config for shared counters.
2. Recommended: replace with an [Upstash Redis](https://upstash.com/) backed rate limiter using the `@upstash/ratelimit` package. The integration is 10 lines of code.

---

#### HIGH-06: EasyPost Webhook Accepts Unauthenticated Requests When Secret Not Set

**File:** `apps/web/src/app/api/webhooks/easypost/route.ts`
**Lines:** 49–51

```typescript
// No secret configured — parse body directly (development mode)
const event = await request.json()
return await handleEvent(event)
```

If `EASYPOST_WEBHOOK_SECRET` is not set in the environment, the endpoint processes any incoming request without verification. In production, if this variable is missing from the deployment environment, a malicious actor can POST a crafted `tracker.updated` event to mark any tracked shipment as `delivered`, triggering order status updates and delivery timestamps.

The same conditional-verification pattern appears for the Twilio webhook (though Twilio at least logs a warning):
`apps/web/src/app/api/webhooks/twilio/route.ts` lines 13–46.

**Remediation:** Fail closed, not open. If the secret is not set, return 503 with a server misconfiguration error — do not process unauthenticated events in any environment:

```typescript
const webhookSecret = process.env.EASYPOST_WEBHOOK_SECRET
if (!webhookSecret) {
  console.error('[webhook:easypost] EASYPOST_WEBHOOK_SECRET is not set — refusing request')
  return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
}
```

---

### MEDIUM

---

#### MED-01: Hardcoded Studio UUID Throughout Codebase

**Files (representative sample):**
- `apps/web/src/app/api/ai/churn-prediction/route.ts` line 11: `const STUDIO_ID = "11111111-1111-1111-1111-111111111111"`
- `apps/web/src/app/api/webhooks/stripe/route.ts` lines 47, 72, 91, 107: hardcoded in `studio_id:` fields
- `apps/web/src/app/api/campaigns/send/route.ts` line 6
- `apps/web/src/app/api/sms/send/route.ts` line 12
- `apps/web/src/lib/stripe.ts` line 37
- `apps/web/src/contexts/auth-context.tsx` line 46

~20+ files contain the literal UUID `11111111-1111-1111-1111-111111111111`. The Stripe webhook handler uses this hardcoded value when writing transactions to the database rather than resolving it from the event's metadata or the member's actual `studio_id`. This means that in a multi-tenant deployment, Stripe subscription events for Studio B would write records tagged with Studio A's ID.

**Remediation:** The `requireRole` helper in `apps/web/src/lib/auth/require-role.ts` already resolves `studioId` correctly from the authenticated user's profile. All route handlers that use `requireRole` should use `auth.studioId` rather than the constant. For webhook handlers (which have no user context), the studio_id should be stored as metadata on Stripe subscriptions/invoices and read from `event.data.object.metadata.studio_id`.

---

#### MED-02: Unsubscribe Token Has No Expiry Enforcement

**File:** `apps/web/src/app/api/unsubscribe/[token]/route.ts`
**Lines:** 26–46

The HMAC token includes a `timestamp` field in its payload and the token is signed correctly. However, neither the `GET` nor the `POST` handler checks whether the timestamp is within an acceptable window. A token issued two years ago is still accepted as valid.

This means:
- Unsubscribe links forwarded or published in screenshots remain permanently functional.
- An attacker who obtains a valid token can unsubscribe a member at any future time without their knowledge.

The default `UNSUBSCRIBE_SECRET` at line 5 is also weak:
```typescript
const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || "meridian-unsubscribe-secret";
```
If `UNSUBSCRIBE_SECRET` is not set in production, the fallback `"meridian-unsubscribe-secret"` is a known plaintext string that any attacker reading this codebase can use to forge tokens.

**Remediation:**
1. Enforce a token age limit (e.g., 90 days) by comparing `timestamp` to `Date.now()`.
2. Remove the default fallback value; throw an error if the environment variable is missing.

---

#### MED-03: `GET /api/cron/waitlist-promote` Delegates to State-Mutating POST

**File:** `apps/web/src/app/api/cron/waitlist-promote/route.ts`
**Lines:** 10–12

```typescript
export async function GET(request: Request) {
  return POST(request);
}
```

A GET handler that mutates database state (creating bookings, updating waitlist entries) violates HTTP semantics. Browser link prefetching, CDN caches, and crawlers can trigger GET requests unintentionally. The `middleware.ts` correctly allows all `CRON_API_PREFIX` routes through unauthenticated — if a CDN or prefetch agent hits this URL with no credentials, it falls through to the `POST` function which still requires auth, but the surface area is needlessly exposed.

**Remediation:** Remove the `GET` handler or return `405 Method Not Allowed`. Document that the cron provider must POST with the `x-cron-secret` header.

---

#### MED-04: `NEXT_PUBLIC_` Prefix Exposes Supabase Anon Key to Client Bundle

**Files:**
- `apps/web/src/lib/supabase/server.ts` line 9
- `apps/web/src/lib/supabase/middleware.ts` line 11
- `apps/web/src/contexts/auth-context.tsx` line 42

```typescript
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
```

The `NEXT_PUBLIC_` prefix intentionally includes this variable in the client-side JavaScript bundle. For Supabase's publishable (anon) key, this is expected and documented behavior. However, the key name is `PUBLISHABLE_DEFAULT_KEY` — confirming this is the anon key — so this is not a vulnerability in isolation.

The risk is that developers may see the `NEXT_PUBLIC_` pattern and replicate it for secrets that should not be exposed. The `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` does not have the `NEXT_PUBLIC_` prefix (correct), but this convention should be explicitly documented to prevent future mistakes.

**Remediation:** Add a comment in `apps/web/.env.local` and in the `server.ts` file explaining why the anon key is `NEXT_PUBLIC_` and explicitly noting that `SUPABASE_SERVICE_ROLE_KEY` must never receive that prefix.

---

#### MED-05: Migration Import Trusts Client-Provided `file_url` Without Ownership Verification

**File:** `apps/web/src/app/api/migration/import/route.ts`
**Lines:** 100–156

The endpoint accepts a `file_url` from the request body and extracts a `storagePath` by regex-matching the bucket name:
```typescript
const pathMatch = file_url.match(new RegExp(`${bucketName}/(.+)$`))
```

This means an authenticated admin from one studio could supply the `file_url` of a file uploaded by a different studio (or a crafted path) and trigger a migration import against it. The path is not validated to start with the requesting studio's `studioId`.

**Remediation:** After extracting `storagePath`, verify it starts with `${studioId}/`:
```typescript
if (!storagePath.startsWith(`${studioId}/`)) {
  return NextResponse.json({ error: 'File does not belong to your studio' }, { status: 403 })
}
```

---

#### MED-06: Search Parameter Injection Risk in Supabase `.or()` Calls

**Files:**
- `apps/web/src/app/api/members/route.ts` lines 61–63
- `apps/web/src/app/api/leads/route.ts` lines 80–83

```typescript
query = query.or(
  `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
);
```

The `search` parameter is interpolated directly into a Supabase PostgREST filter string. While Supabase's PostgREST layer is not SQL and does not expose traditional SQL injection, string interpolation into `.or()` filter syntax can be abused to inject additional filter clauses. For example, a `search` value of `%,studio_id.eq.aaaabbbb` would extend the OR clause to include `studio_id.eq.aaaabbbb`, potentially returning records from another studio that happen to match.

Because these queries also filter by `studio_id` at the query level (`.eq("studio_id", studioId)` precedes the `.or()`), the actual cross-tenant risk is low. However, injected filters could still cause unintended query behavior or information leakage within a studio.

**Remediation:** Sanitize the `search` parameter before interpolation, escaping PostgREST special characters:
```typescript
const safesearch = search.replace(/[%,()]/g, '')
query = query.or(`full_name.ilike.%${safeSearch}%,...`)
```

---

#### MED-07: Inngest Endpoint Has No Signing Key Verification Configured in Code

**File:** `apps/web/src/app/api/inngest/route.ts`
**Lines:** 1–11

```typescript
export const { GET, POST, PUT } = serve({ client: inngest, functions });
```

The `serve()` call does not pass a `signingKey` option. Inngest's SDK verifies the signing key via the `INNGEST_SIGNING_KEY` environment variable. If this variable is unset (or misconfigured), Inngest will accept requests from any source claiming to be the Inngest cloud, potentially triggering automation functions with crafted event payloads.

**Remediation:** Confirm `INNGEST_SIGNING_KEY` is set in the Netlify environment and add an assertion at startup:
```typescript
if (!process.env.INNGEST_SIGNING_KEY) {
  throw new Error('INNGEST_SIGNING_KEY must be set in production')
}
```

---

### LOW

---

#### LOW-01: No Content-Type Validation on Request Bodies

Most route handlers call `await request.json()` without checking `Content-Type: application/json` first. If a client sends a request with `Content-Type: text/plain` but a JSON body, `request.json()` may still parse it, or may throw a 500 error that leaks stack information. More importantly, no routes use Zod for body validation — types are cast with `as { field: type }` rather than parsed and validated.

**Affected files:** Most `POST`/`PUT`/`PATCH` handlers under `apps/web/src/app/api/`.

**Remediation:** Adopt Zod schemas for request body validation on all mutation endpoints. Zod is already a dependency (`"zod": "^3.24.0"`). Example pattern:
```typescript
const schema = z.object({ first_name: z.string().min(1).max(100), ... })
const body = schema.safeParse(await request.json())
if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })
```

---

#### LOW-02: `POST /api/members/[id]` Does Not Exist but `PUT` Does — Inconsistent HTTP Method for Create vs Update

The members API uses `PUT` for updates on `[id]` and `POST` for creation on the collection route. This is conventional. However, `GET /api/members` returns sensitive PII (email, phone, roles) without field selection — the `select("*")` at line 52 returns all columns of the `profiles` table including any future fields added. This creates a passive data exposure risk as the schema evolves.

**Remediation:** Replace `select("*")` with an explicit field list for list endpoints.

---

#### LOW-03: Gift Card Code Stored in Database Without Hashing

**File:** `apps/web/src/app/api/webhooks/stripe/route.ts`
**Lines:** 165–173

Gift card codes are stored as plaintext in the `gift_cards` table. If the database is compromised, all outstanding gift card balances are immediately recoverable. The codes function as bearer tokens — whoever has the code can redeem the balance.

**Remediation:** Store a HMAC of the code in the database; compare HMACs at redemption time. Alternatively, use a short-lived lookup with a separate redemption secret.

---

#### LOW-04: No Lock File for Exact Dependency Pinning in CI

**File:** `apps/web/package.json`

All production dependencies use `^` (caret) version ranges. While a `package-lock.json` file should exist locally (the project uses `npm`), it was not observed in the repository root. Without a committed lock file, CI builds can silently pull in newer transitive dependency versions that introduce vulnerabilities.

**Remediation:** Commit `package-lock.json` to the repository and run `npm ci` (not `npm install`) in CI to reproduce deterministic builds.

---

#### LOW-05: `roles` Array Is Mutable via `PUT /api/members/[id]` (Separate from CRIT-03)

Even after fixing the missing role check in CRIT-03, the `allowedFields` array at `apps/web/src/app/api/members/[id]/route.ts` line 167 includes `"roles"`. This means any admin or manager can change another member's roles through the general member-update endpoint — including promoting a `member` to `owner`. Role changes should be isolated to a dedicated, owner-only endpoint with explicit audit logging and restrictions (e.g., no user can modify their own roles).

---

#### LOW-06: `unsubscribe_url` Hardcoded in Email Template Defaults

**File:** `apps/web/src/lib/email-templates.ts`
**Line:** 35

```typescript
unsubscribe_url: 'https://thesaunaguys.com/unsubscribe',
```

The default unsubscribe URL points to a hardcoded domain rather than being dynamically generated with the HMAC token. Emails sent using this default will link to an unsubscribe page that may not exist or may not process requests for the current member.

---

### INFO

---

#### INFO-01: `SUPABASE_SERVICE_ROLE_KEY` Bypasses RLS — Intended, But Requires Careful Scoping

**File:** `apps/web/src/lib/inngest/helpers.ts` lines 20–34

The Inngest background job engine uses a service-role client to bypass Row Level Security, which is necessary for background jobs that run outside the HTTP request lifecycle. This is the correct pattern. However, the service-role client is cached as a module-level singleton:
```typescript
let _admin: ReturnType<typeof createClient<any>> | null = null;
```
This is safe in a serverless context (each function invocation has its own module scope). The `TODO` comment in `middleware.ts` at line 36 correctly identifies that when client-side access is added in Phase 5, RLS policies must be rewritten. This should remain a tracked architecture task.

---

#### INFO-02: Admin Layout Has No Server-Side Auth Check

**File:** `apps/web/src/app/(admin)/layout.tsx`

The admin layout is a `'use client'` component. It renders immediately without an auth check — the `AuthProvider` context manages auth state on the client side. Auth protection for the admin routes relies entirely on `middleware.ts` redirecting unauthenticated users to `/login`.

While `middleware.ts` does implement this redirect correctly, the absence of a server-side check in the layout means that if middleware is ever bypassed (e.g., during a Next.js version upgrade that changes matching behavior), the admin shell would render for unauthenticated users. A server component layout that calls `supabase.auth.getUser()` would provide defense-in-depth.

---

#### INFO-03: Stripe Integration Placeholder — Actual Proration Call Not Made

**Files:**
- `apps/web/src/app/api/members/[id]/upgrade/route.ts` lines 127–131
- `apps/web/src/app/api/members/[id]/downgrade/route.ts` lines 94–99

Both endpoints log a comment acknowledging that the actual Stripe subscription update call is not implemented — only the local database record is changed. When Stripe integration is completed, the webhook and the upgrade endpoint must be made idempotent against each other to avoid double-application of plan changes.

---

#### INFO-04: `NEXT_PUBLIC_APP_URL` Not Set — Falls Back to Hardcoded Production Domain

**File:** `apps/web/src/app/api/qr/member/[id]/route.ts`
**Line:** 87–88

```typescript
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.meridian.studio";
```

In development or staging, QR codes will encode `https://app.meridian.studio` URLs, which point to production. Members scanning these codes during testing will be directed to production.

---

## Summary Table

| ID | Severity | Title |
|----|----------|-------|
| CRIT-01 | CRITICAL | Live API credentials in `.env.local` |
| CRIT-02 | CRITICAL | Open redirect in OAuth callback |
| CRIT-03 | CRITICAL | `PUT /api/members/[id]` missing role check — privilege escalation |
| HIGH-01 | HIGH | Missing security headers on all responses |
| HIGH-02 | HIGH | Handlebars `noEscape: true` — XSS in email rendering |
| HIGH-03 | HIGH | Gift card code generator uses non-CSPRNG |
| HIGH-04 | HIGH | A/B test variant assignment uses non-CSPRNG |
| HIGH-05 | HIGH | In-memory rate limiter ineffective in serverless deployment |
| HIGH-06 | HIGH | EasyPost/Twilio webhooks accept unauthenticated requests when secret unset |
| MED-01 | MEDIUM | Hardcoded studio UUID in 20+ files — multi-tenancy break |
| MED-02 | MEDIUM | Unsubscribe token has no expiry; weak default secret |
| MED-03 | MEDIUM | Cron GET endpoint delegates to state-mutating POST |
| MED-04 | MEDIUM | `NEXT_PUBLIC_` anon key in bundle — documentation gap |
| MED-05 | MEDIUM | Migration import trusts client-provided `file_url` without ownership check |
| MED-06 | MEDIUM | Search parameter injection into Supabase `.or()` filter strings |
| MED-07 | MEDIUM | Inngest signing key not asserted at startup |
| LOW-01 | LOW | No Zod body validation on API endpoints |
| LOW-02 | LOW | `select("*")` on list endpoints — over-fetching PII |
| LOW-03 | LOW | Gift card codes stored in plaintext |
| LOW-04 | LOW | Lock file not confirmed committed — non-deterministic builds |
| LOW-05 | LOW | `roles` field mutable via general member-update endpoint |
| LOW-06 | LOW | Hardcoded `unsubscribe_url` in email template defaults |
| INFO-01 | INFO | Service-role client bypasses RLS (intended) — Phase 5 note |
| INFO-02 | INFO | Admin layout has no server-side auth check |
| INFO-03 | INFO | Stripe proration not wired — upgrade/downgrade only updates DB |
| INFO-04 | INFO | `NEXT_PUBLIC_APP_URL` fallback points to production |

---

## Prioritized Remediation Order

**Do immediately (before next deploy):**
1. CRIT-01 — Rotate `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY`
2. CRIT-03 — Add role check to `PUT /api/members/[id]` and remove `roles` from `allowedFields`
3. CRIT-02 — Validate the `redirect` param in the OAuth callback

**Do before any public traffic (Phase 5 prep):**
4. HIGH-01 — Add security headers in `next.config.ts`
5. HIGH-02 — Remove `noEscape: true` from Handlebars compile
6. HIGH-03, HIGH-04 — Replace `Math.random()` with `crypto.randomBytes`/`crypto.randomInt`
7. HIGH-05 — Replace in-memory rate limiter with Redis-backed implementation
8. HIGH-06 — Fail closed on missing webhook secrets

**Do as part of multi-tenancy work:**
9. MED-01 — Eliminate hardcoded studio UUID from all route handlers
10. MED-05 — Verify `file_url` ownership before migration import

**Technical debt (next sprint):**
11. MED-02 — Token expiry on unsubscribe links
12. MED-06 — Sanitize search params before PostgREST filter interpolation
13. LOW-01 — Adopt Zod schemas for request validation
14. Remaining LOW/INFO items

---

*Generated by Codebase Cartographer Security Auditor — static heuristic analysis only. Complement with Semgrep, Snyk, and OWASP ZAP.*
