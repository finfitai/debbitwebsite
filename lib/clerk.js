import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, useAuth, useUser } from '@clerk/nextjs'

export { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, useAuth, useUser }

export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

export function clerkOrFallbackMessage() {
  return clerkEnabled
    ? ''
    : 'Configure NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to enable Clerk authentication.'
}
