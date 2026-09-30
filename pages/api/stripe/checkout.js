import Stripe from 'stripe'
import { getAuth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

// Recurring subscription checkout, tied to a specific business — not the
// old one-time "lifetime" payment. A subscription is what makes "lock
// access once not paid" (apps/desktop/ipc/license.js's getAccessLockState)
// meaningful: it can actually lapse. STRIPE_PRICE_ID must be a recurring
// Price configured in the Stripe dashboard.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  const { userId } = getAuth(req)
  if (!userId) return res.status(401).json({ error: 'Sign in required' })

  const businessId = req.body?.business_id
  if (!businessId) return res.status(400).json({ error: 'business_id is required' })

  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase is not configured' })
  if (!process.env.STRIPE_PRICE_ID) return res.status(500).json({ error: 'STRIPE_PRICE_ID is not configured' })

  try {
    // Authorization: the signed-in Clerk user must actually be an active
    // member of this business — otherwise any signed-in visitor could start
    // a checkout session (and later have a webhook write subscription
    // status) against a business_id they just guessed or copied from a URL.
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('business_members')
      .select('id, users!inner(external_auth_id)')
      .eq('business_id', businessId)
      .eq('users.external_auth_id', userId)
      .eq('is_active', true)
      .maybeSingle()
    if (membershipError) return res.status(500).json({ error: membershipError.message })
    if (!membership) return res.status(403).json({ error: 'Not a member of this business' })

    const { data: business, error: bizError } = await supabaseAdmin
      .from('businesses')
      .select('id, name, email, stripe_customer_id')
      .eq('id', businessId)
      .maybeSingle()
    if (bizError) return res.status(500).json({ error: bizError.message })
    if (!business) return res.status(404).json({ error: 'Business not found' })

    // Reuse the existing Stripe Customer if this business already has one
    // (e.g. a prior canceled subscription) instead of creating a duplicate.
    let customerId = business.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: business.email || undefined,
        name: business.name || undefined,
        metadata: { business_id: businessId, clerk_user_id: userId },
      })
      customerId = customer.id
      await supabaseAdmin.from('businesses').update({ stripe_customer_id: customerId }).eq('id', businessId)
    }

    const origin = req.headers.origin || process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3002'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: businessId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      subscription_data: { metadata: { business_id: businessId } },
      success_url: `${origin}/dashboard?success=true`,
      cancel_url: `${origin}/upgrade?canceled=true`,
    })

    res.status(200).json({ id: session.id })
  } catch (err) {
    console.error('Error creating checkout session:', err.message)
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}
