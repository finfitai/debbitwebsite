import { useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useAuth } from './clerk'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Supabase remains the tenant/data plane even after Clerk becomes the web identity layer.
//
// `supabase` above is anon-key-only — every request it sends carries no user
// identity, so RLS policies and SECURITY DEFINER functions that resolve
// auth.uid()/auth.jwt() (bootstrap_owner_registration, accept_tenant_invite,
// auth_business_ids(), the "members can read" policy on businesses, ...) see
// NOTHING and fail closed. Use it only for genuinely anonymous reads (the
// invite-token lookup before anyone has signed in).
//
// For anything done as a signed-in Clerk user, use useClerkSupabaseClient()
// below instead — it configures supabase-js's `accessToken` option (native
// third-party auth support, since supabase-js v2.43) to fetch a fresh Clerk
// session token per request, so Supabase can verify auth.jwt()->>'sub' the
// same way bootstrap_owner_registration's own SQL already expects. This
// requires the Supabase project to have Clerk configured as a third-party
// auth provider (Authentication → Sign In / Providers → Clerk) — without
// that, requests just look anonymous, same as the plain `supabase` client.
export function useClerkSupabaseClient() {
  const { getToken } = useAuth()
  return useMemo(() => {
    if (!hasSupabaseConfig) return null
    return createClient(supabaseUrl, supabaseAnonKey, {
      accessToken: async () => (await getToken()) ?? null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data?.session || null
}

export async function signInWithMagicLink(email) {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
    },
  })
}

export async function signInWithPassword(email, password) {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUpWithPassword(email, password, metadata = {}) {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/register` : undefined,
      data: metadata,
    },
  })
}

export async function requestPasswordReset(email) {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
  })
}

// These three RPCs all resolve auth.uid()/auth.jwt()->>'sub' server-side, so
// they need an IDENTIFIED client — pass the client from useClerkSupabaseClient(),
// not the anon `supabase` singleton (which would just hit each RPC's "auth
// required" guard). `client` is required, not defaulted, so a caller can't
// accidentally fall back to the anon client and get a confusing auth error.
export async function bootstrapOwnerRegistration(client, payload) {
  if (!client) throw new Error('Supabase is not configured')
  return client.rpc('bootstrap_owner_registration', payload)
}

export async function getInviteByToken(inviteToken) {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase.rpc('fetch_tenant_invite', { p_invite_token: inviteToken })
}

export async function acceptTenantInvite(client, payload) {
  if (!client) throw new Error('Supabase is not configured')
  return client.rpc('accept_tenant_invite', payload)
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}
