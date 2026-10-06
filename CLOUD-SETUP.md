# debbit OS — Cloud Owner Dashboard setup and verification status

The dashboard (`apps/dashboard`, Next.js + Clerk + Supabase) shows an owner their
business numbers (P&L, cash, AR/AP, 7-day revenue, smart alerts) read live from
the Supabase cloud that the desktop app syncs into.

## Status

The owner dashboard, tenant admin, and support pages use the Clerk-authenticated
Supabase client. Dashboard and support reads also filter by the selected
business id; Supabase RLS remains the server-side tenant boundary. Production
builds pass in both the website repo and the product repo's dashboard copy.

The production Clerk-to-Supabase third-party-auth configuration and a live
two-business isolation test still need verification. The dashboard currently
selects the owner's oldest visible business; a business switcher is not yet
available when an owner belongs to more than one business.

## Production verification still required

1. In Supabase Authentication, configure Clerk as a third-party auth provider
   for this exact project. The client sends a fresh Clerk session token using
   Supabase's `accessToken` option.
2. Sign in as an owner of Business A and verify its dashboard, admin, and support
   data load. Then verify Business B's rows are never returned to that user.
   Repeat with an unaffiliated Clerk account and confirm it sees no tenant data.
3. Configure the public Supabase URL, anon key, Clerk publishable key, and the
   server-side Clerk secret in the deployment environment. Never expose the
   Clerk secret or Supabase service-role key to the browser.

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
