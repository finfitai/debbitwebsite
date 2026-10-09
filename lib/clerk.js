import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, useAuth as useClerkAuth, useUser as useClerkUser, useClerk as useClerkClerk, useSignIn as useClerkSignIn } from '@clerk/nextjs'

export { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn }

export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

// clerkEnabled is a build-time constant (NEXT_PUBLIC_* is inlined at build),
// so this branch never changes between renders within a given build — safe
// under React's rules of hooks. Pages call these unconditionally (hooks
// can't themselves be called behind an `if`), so when Clerk isn't
// configured they need a stable fallback instead of touching Clerk's real
// hooks, which throw outside a <ClerkProvider> (see pages/_app.js, which
// only mounts ClerkProvider when a publishableKey exists). getToken is
// included because useClerkSupabaseClient() (lib/supabase.js) destructures
// it and calls it directly.
const NOOP_AUTH = { isLoaded: true, isSignedIn: false, userId: null, getToken: async () => null }
const NOOP_USER = { isLoaded: true, isSignedIn: false, user: null }
const NOOP_CLERK = { signOut: async () => {} }
const NOOP_SIGN_IN = { isLoaded: true, signIn: null, setActive: async () => {} }

export function useAuth() {
  return clerkEnabled ? useClerkAuth() : NOOP_AUTH
}

export function useUser() {
  return clerkEnabled ? useClerkUser() : NOOP_USER
}

export function useClerk() {
  return clerkEnabled ? useClerkClerk() : NOOP_CLERK
}

export function useSignIn() {
  return clerkEnabled ? useClerkSignIn() : NOOP_SIGN_IN
}

export function clerkOrFallbackMessage() {
  return clerkEnabled
    ? ''
    : 'Configure NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to enable Clerk authentication.'
}
