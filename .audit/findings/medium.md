# Medium Findings

**Date:** 2026-04-08

---

## MEDIUM-1: wallet_balance Denormalization Without Transaction Safety
Data-model layer. Wallet balance is stored denormalized on the members row. If a wallet transaction write succeeds but the member row update fails, the wallet will be inconsistent.

---

## MEDIUM-2: No Index on members(studio_id, membership_status)
Data-model / performance-infra. Member directory filtering by status runs without index support.

---

## MEDIUM-3: Dark Mode Preference Not Persisted
UI/UX layer. The `useTheme()` context loses dark mode preference on page refresh (no localStorage or cookie backing).

---

## MEDIUM-4: Command Palette Quick Actions URL Params May Not Be Consumed
User-flow layer. Quick actions navigate to routes like `/schedule?action=new-class` but destination pages may not consume these params to open modals.

---

## MEDIUM-5: Employee Portal Trainer Nav Shows for All Roles
User-flow / ui-ux. The trainer nav section (My Classes, Performance, Promo Code) renders for all employees regardless of whether they have the `trainer` role.

---

## MEDIUM-6: AI Responses Not Validated Against Zod Schema
AI-layer. LLM JSON responses are parsed with `parseAIJson<T>()` but no Zod validation is performed on the parsed result. Schema changes in Claude responses propagate as silent TypeScript type mismatches.

---

## MEDIUM-7: /segments and /engagement Not in Navigation
User-flow. These implemented modules are inaccessible from the primary navigation, effectively hiding finished features from users.

---

## MEDIUM-8: Glofox Cron Not Configured in Infrastructure
Project-structure / integration. No Netlify scheduled function or external cron is configured in the repo to trigger the hourly Glofox sync. The sync only runs if manually triggered or by an external service not documented in the codebase.

---

## MEDIUM-9: DEFAULT_STUDIO_ID Used in Stripe Customer Creation
Integration. `getOrCreateCustomer()` in `lib/stripe.ts` uses `DEFAULT_STUDIO_ID` in Stripe metadata. For multi-studio deployments, all Stripe customers would be tagged to the same studio.

---

## MEDIUM-10: CSP unsafe-inline + unsafe-eval (Planned Phase 5 Fix)
Security. The current CSP allows inline scripts and eval, neutralizing most XSS mitigation. Documented as a technical debt item with a Phase 5 nonce-based CSP plan.

---

## MEDIUM-11: No Client-Side Caching Layer
Performance-infra. Every page navigation re-fetches all data from the server. Adding React Query or SWR would significantly improve perceived performance and reduce database load.

---

## MEDIUM-12: Integration Tests Not Running in CI
Performance-infra / testing-quality. Integration tests are implemented but commented out in CI. They require a dedicated Supabase test instance that hasn't been provisioned.

---

## MEDIUM-13: Glofox Sync Has No Circuit Breaker
Integration. When Glofox is down, the hourly sync continues triggering with no exponential backoff at the schedule level.

---

## MEDIUM-14: Stripe API Version Uses Non-Standard Suffix
Integration. `'2026-02-25.clover'` is unusual. Standard Stripe API versions use `YYYY-MM-DD` format without suffixes. Verify this is intentional.

---

## MEDIUM-15: AI Module Tests Coverage at 0%
Testing-quality. 22 of 23 AI library modules have no direct unit tests. These modules implement critical business logic (churn scoring, health scoring) and should have happy-path + error-handling coverage.

