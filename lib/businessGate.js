import { useEffect, useState } from 'react'
import { useAuth } from './clerk'
import { useClerkSupabaseClient } from './supabase'

// Whether the signed-in Clerk user already owns/belongs to a business.
// Drives the gate in components/Protected.js: no Clerk session -> /register,
// a session with no business yet -> /onboarding, otherwise the real app.
export function useBusinessStatus() {
  const { isLoaded, isSignedIn } = useAuth()
  const clerkSupabase = useClerkSupabaseClient()
  const [state, setState] = useState({ loading: true, hasBusiness: null })

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setState({ loading: false, hasBusiness: false })
      return
    }
    if (!clerkSupabase) return
    let cancelled = false
    setState((current) => ({ ...current, loading: true }))
    clerkSupabase
      .from('businesses')
      .select('id')
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled) return
        // A query error (e.g. a transient network blip) leaves hasBusiness
        // null rather than false, so Protected keeps showing the loader
        // instead of bouncing someone with a real business into onboarding.
        setState({ loading: false, hasBusiness: error ? null : Boolean(data?.length) })
      })
    return () => { cancelled = true }
  }, [isLoaded, isSignedIn, clerkSupabase])

  return { isLoaded, isSignedIn, ...state }
}
