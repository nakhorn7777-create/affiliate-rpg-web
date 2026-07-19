# Architecture & Hardening Review

_Last updated: 2026-07-19_

This document is a retrospective and reference for the engineering-hardening
work done on AffiliateRPG, covering the Brand Verification Lifecycle, the
CI/testing pipeline, and the security/architecture patterns that came out of
it. It's meant to be readable by anyone maintaining this project later,
including without an AI assistant in the room.

## 1. What shipped

### Product features
- **Novice Academy** — quest system (schema, RPCs, `/academy` page, nav entry).
- **Brand Mode**, full lifecycle:
  - Self-serve toggle (`has_brand`) + brand info form, reusing existing RLS
    rather than a new RPC where a direct `.update()` was already safe.
  - **Verification lifecycle**: `brand_status` (`pending` → `processing` →
    `rejected`) plus a separate `is_official_brand` flag for actual
    verification. Display precedence is `rejected` > `is_official_brand` >
    `processing` > `pending` — rejected always wins, even over an existing
    verified flag, as a UI kill-switch.
  - **Post-Match Contact Reveal** — contact details (`profile_contacts`,
    owner-only RLS) are revealed to the other party only after a job
    application is accepted, via a `SECURITY DEFINER` RPC
    (`get_matched_contact`) rather than loosening RLS on the base table.
  - **Admin review dashboard** (`/admin/brand-audit`) — mark under review /
    reject & clear, gated by a real `is_admin` flag (not just page-level
    hiding).
- **Job Board lifecycle completion** — `reject_deal_reply` and
  `cancel_brand_deal`, closing the gap where only accept/complete existed.
- **`/dashboard` → `/settings`** — route rename to a tabbed sidebar layout
  (General / Contact / Brand / Affiliate Links), with the route-protection
  prefix, root redirect, and nav links all updated together.

### Engineering hardening
- **CI pipeline** (`.github/workflows/ci.yml`): a `build` job (`tsc` + `eslint`
  + `vitest` + `next build`) gates every push/PR to `main`. A separate
  `integration-tests` job runs DB/RPC tests against a **dedicated test
  Supabase project** — only on PRs or manual dispatch, to conserve free-tier
  limits, and structured so it never blocks the fast job.
- **Strict Supabase-generated types** — wired `Database` (from
  `supabase gen types typescript`) into `createBrowserClient`/
  `createServerClient`. Fixing the ~27 type errors this surfaced also
  uncovered two real, previously invisible production bugs:
  - `public.feedback` had never actually been applied to production —
    migration `0001` existed in the repo but was never run. Every feedback
    submission had been silently failing.
  - `deal_reviews` has two foreign keys to `profiles` (reviewer and
    reviewee); the untyped embed was ambiguous and needed an explicit
    `profiles!deal_reviews_reviewer_id_fkey(...)` hint.
- **Test suite** — Vitest + React Testing Library for pure logic and
  component precedence (e.g. the brand-status kill-switch), plus a DB/RPC
  integration harness (`supabase/tests/`) that creates real users via the
  Supabase Admin API and signs in with `signInWithPassword`, so RLS/RPC
  security is actually exercised rather than mocked or bypassed.
- **Migration formalization** — `supabase/migrations/0000_baseline_schema_v2.sql`
  now tracks what used to be a manually-applied `schema_v2.sql`, so
  `supabase db push` can bootstrap a project from zero. This is exactly what
  surfaced the missing-`feedback`-table bug above.
- **Admin Audit Trail** (`admin_audit_logs`) — an `AFTER UPDATE` trigger logs
  actor, target, and old/new `brand_status` whenever an admin RPC changes it.
  Deliberately excludes the transition back to `pending`, since that's driven
  by the profile owner's own resubmission, not an admin action.
- **Rate Limiting** — a generic `enforce_rate_limit()` helper backed by
  `rate_limit_hits`, wired in via `BEFORE INSERT` triggers on `brand_deals`
  (5/hour) and `deal_replies` (20/hour) per user. Trigger-based rather than
  RPC-based because both tables are written via direct client `.insert()`
  under RLS, not through an RPC.

## 2. Golden rules

Hard-won lessons from real bugs and design decisions made this round —
not generic advice.

1. **RLS is not column-aware.** Row Level Security policies decide which
   *rows* a role can touch, not which *columns*. If some columns on a table
   need a stricter write boundary than the rest (e.g. `brand_status`,
   `is_official_brand`), reach for `REVOKE UPDATE (column) ON table FROM
   authenticated, anon` plus a `SECURITY DEFINER` function as the only
   writer — not a bigger RLS policy.

2. **`auth.uid()` / `auth.role()` reflect the original request's JWT, not
   which function or trigger is currently executing.** A trigger that checks
   `auth.role() = 'service_role'` will also block your own trusted
   `SECURITY DEFINER` RPCs if a normal authenticated user calls them —
   because the check can't distinguish "a trusted code path called this" from
   "the original caller is untrusted." This is the single most
   counter-intuitive fact in the whole system; it's why column-privilege
   revocation (point 1) exists as a separate mechanism from the
   `is_official_brand`/`is_admin` flag-protection trigger, rather than one
   mechanism doing both jobs.

3. **Every state-changing RPC must trust `auth.uid()`, never a
   client-supplied actor id parameter.** This was a real IDOR fixed in
   migration `0005` — `accept_deal_reply`/`complete_deal` used to accept a
   `p_actor_id` argument from the client and trust it outright. Any new RPC
   must follow the `auth.uid()`-only pattern from day one.

4. **Tables written via direct client `.insert()` (no RPC) need
   trigger-based protection, not RPC-based.** Not everything goes through an
   RPC — `brand_deals`/`deal_replies` are plain RLS-gated inserts. Rate
   limiting, audit logging, or any other cross-cutting concern targeting
   these needs a `BEFORE`/`AFTER INSERT` trigger, since there's no function
   call to hook into.

5. **Generated types go stale the moment the schema changes.** Regenerate
   `database.types.ts` after every migration — otherwise `tsc` stops proving
   anything about column names, RPC signatures, or table shapes, silently.

6. **Never skip test-project validation before touching production.**
   The workflow that actually works: write the migration → validate it via
   `workflow_dispatch` against the disposable test Supabase project → only
   then paste into production's SQL Editor → verify with
   `information_schema` / `pg_proc` / `pg_trigger` queries afterward.
   Skipping the test-project step is exactly the gap that let the
   `feedback` table bug go unnoticed for as long as it did.

7. **A green CI pipeline proves the code compiles and doesn't break existing
   assertions — nothing more.** It does not prove a feature behaves
   correctly unless there's an actual test asserting that behavior. Don't
   let a green checkmark create false confidence about untested paths.

8. **Migration files are an append-only sequence.** Never edit or renumber
   a file that's already been applied anywhere (test or production) — always
   add the next unused number.

9. **A table with `for select using (true)` means the *entire row* is
   world-readable via the REST API, not just whatever the UI happens to
   render.** Before adding a sensitive new column to an already-public
   table, ask whether it needs its own restricted table instead (the
   `profile_contacts` pattern) rather than living on the public one.

## 3. Known gaps (as of this review)

Not bugs — deliberate deferrals, tracked here so they don't get "rediscovered"
as if they were new problems:

- Insights CSV bulk-upload is content-platform-only (Facebook/TikTok);
  commerce platforms (Shopee/Lazada) were never circled back to.
- `niche_tags` / `portfolio_items` schema exists with zero frontend.
- The game itself is still a placeholder Phaser scene (walkable field, no
  NPCs). Novice Academy shipped as a standalone `/academy` page rather than
  living inside the game world.
- Login page's planned cinematic video background never started.
- Theme inconsistency: `/login`, `/`, `/insights`, `/jobs`, `/[username]`,
  `/academy` use the navy/gold theme; `/settings`, `/game`, `/stats` still
  use plain neutral styling.
- Production migrations remain a deliberate manual step (paste into Studio),
  not automated via CI — the project owner wants to stay the final human
  checkpoint on the live data boundary. Worth revisiting if the team grows
  beyond a single maintainer.
- Integration test coverage is currently a single test case
  (`accept_deal_reply`'s ownership check). The harness is proven out; the
  highest-leverage next step is extending it to `purchase_from_listing`,
  the admin brand RPCs, and the new rate-limit triggers.
