import { createClient } from '@supabase/supabase-js'

// Service-role client for server-only code (API routes, webhooks) that must
// read/write across tenants without a user JWT — e.g. a Stripe webhook has
// no Clerk session to authenticate as. Never import this into anything that
// runs in the browser; SUPABASE_SERVICE_ROLE_KEY bypasses RLS entirely.
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null
