# debbit OS — Cloud Owner Dashboard: setup & the tenant-scoping gap

The dashboard (`apps/dashboard`, Next.js + Clerk + Supabase) shows an owner their
business numbers (P&L, cash, AR/AP, 7-day revenue, smart alerts) read live from
the Supabase cloud that the desktop app syncs into.

## Status

Functional UI + queries are in place, **but the data layer is not yet scoped to
the signed-in owner's business.** The reads in `pages/dashboard.js` go through the
**anon** Supabase key with **no per-business filter and no authenticated user
token**, because the Clerk→Supabase identity bridge is not finalized
(see the comment in `lib/supabase.js`). With a permissive anon role this means a
query can read across tenants.

➡️ **Treat the dashboard as single-/demo-tenant only until the bridge below is
done. Do not onboard multiple paying tenants to it as-is.**

## What completes it (requires cloud config — owner action)

1. **Clerk → Supabase JWT bridge.** Configure a Clerk JWT template for Supabase
   (or use Supabase third-party auth with Clerk) so the web app sends an
   authenticated token carrying the user identity. Then create the Supabase
   client with that token (e.g. `accessToken: () => clerkGetToken()`), so reads
   run as the authenticated user — not anon.
2. **RLS by business.** Ensure row-level security on `gl_entries`, `sales`,
   `gl_accounts`, `shift_reconciliations`, `budgets`, etc. restricts rows to the
   businesses the authenticated user belongs to (`business_members`). The desktop
   sync + edge functions already use the service role; the *dashboard* must use
   the user token so RLS applies.
3. **Resolve the owner's business** from `business_members` for the signed-in
   user and add `.eq('business_id', <id>)` to every query in `dashboard.js`
   (defense-in-depth on top of RLS), with a business switcher for multi-business
   owners (the `pages/ops.js` selector is a starting pattern).

## Env

`.env.local` (gitignored) — set:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # public by design (RLS enforces access)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
```

Currency/locale: the dashboard formats money via `lib/format.js` (MYR / en-MY for
the Malaysia beachhead). Once a business is resolved, pass its `currency` to
`money()` instead of the default.

## Build / run

```
npm run --workspace @debbit/dashboard build   # what CI runs (check:dashboard)
npm run --workspace @debbit/dashboard dev      # local, port 3002
```
