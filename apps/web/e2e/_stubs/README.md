# Legacy E2E stubs (quarantined)

These 8 spec files predate the QA pipeline (`/qa-council`). They use forbidden patterns:

- Raw CSS selectors like `[class*="table" i]`
- `page.waitForTimeout(...)` (in `members.spec.ts`)
- `page.waitForLoadState('networkidle')` as primary wait
- Fuzzy body-text assertions (`body!.length > 50`)
- No POM (Page Object Model) usage
- No `data-testid` discipline

## Why they're quarantined, not deleted

They serve as **exploration references** for the Analyst phase. When a council run targets a feature (e.g., Revenue Record Payment), the Analyst can read the corresponding stub to understand:

- Which pages exist and at what routes
- What the legacy dev thought was worth testing
- Historical context for edge cases

The Engineer phase will **replace** the stub with a proper POM-backed spec.

## Quarantined files

| Stub | Tier replacement | Planned council run |
|---|---|---|
| `analytics.spec.ts` | Tier 2.7 (smoke) + Tier 6 (writes) | `/qa-council analytics smoke` |
| `command-center.spec.ts` | Tier 2.1 (smoke) | `/qa-council command-center smoke` |
| `corporate.spec.ts` | Tier 2.6 (smoke) + Tier 4.5/4.6 (writes) | `/qa-council corporate smoke` |
| `employee-portal.spec.ts` | Tier 2.11 (smoke) + Tier 7 (writes) | `/qa-council employee-portal smoke` |
| `marketing.spec.ts` | Tier 2.5 (smoke) + Tier 5 (writes) | `/qa-council marketing smoke` |
| `members.spec.ts` | Tier 2.3 (smoke) + Tier 3.5/3.6/3.7 (writes) | `/qa-council members smoke` |
| `revenue.spec.ts` | Tier 2.4 (smoke) + Tier 3.1/3.2/3.3 (writes) | `/qa-council revenue smoke` |
| `schedule.spec.ts` | Tier 2.2 (smoke) + Tier 3.8-3.11 (writes) | `/qa-council schedule smoke` |

## Ignored by Playwright

`playwright.config.ts` has `testIgnore: [/login/, /_stubs/]` on the admin and employee projects so these files never run.

**Do not add new tests here.** Run `/qa-council <feature>` to generate proper specs instead.
