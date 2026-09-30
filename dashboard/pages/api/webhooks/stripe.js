import Stripe from 'stripe'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'

// We need to disable the default Next.js body parser so we can get the raw body for Stripe signature verification
export const config = {
  api: {
    bodyParser: false,
  },
}

async function buffer(readable) {
  const chunks = []
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

// Maps a Stripe subscription.status onto the values businesses.subscription_status
// accepts (supabase/migrations/045_billing_subscription.sql's CHECK constraint).
// Stripe also has 'trialing' and 'incomplete'/'incomplete_expired' — a
// subscription created via Checkout always starts 'active' or 'trialing'
// depending on price config, never 'incomplete' (that's the legacy
// PaymentIntent-confirmation flow this app doesn't use), so those two map to
// our own 'trialing' rather than inventing a status desktop doesn't know.
function mapStripeStatus(stripeStatus) {
  switch (stripeStatus) {
    case 'active': return 'active'
    case 'trialing': return 'trialing'
    case 'past_due': return 'past_due'
    case 'unpaid': return 'unpaid'
    case 'canceled':
    case 'incomplete_expired': return 'canceled'
    case 'incomplete': return 'trialing'
    default: return 'past_due' // unknown status — fail toward "needs attention", never silently "active"
  }
}

async function updateBusinessFromSubscription(subscription) {
  if (!supabaseAdmin) return
  const businessId = subscription.metadata?.business_id
  const update = {
    subscription_status: mapStripeStatus(subscription.status),
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    stripe_subscription_id: subscription.id,
  }
  const query = supabaseAdmin.from('businesses').update(update)
  const { error } = businessId
    ? await query.eq('id', businessId)
    : await query.eq('stripe_customer_id', subscription.customer)
  if (error) console.error('[stripe webhook] failed to update business subscription status:', error.message)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  const sig = req.headers['stripe-signature']
  const reqBuffer = await buffer(req)

  let event

  try {
    // Verify the event came from Stripe
    event = stripe.webhooks.constructEvent(reqBuffer, sig, webhookSecret)
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        // Only subscription-mode sessions reach here (the old one-time
        // "lifetime" `mode: 'payment'` checkout no longer exists in
        // pages/api/stripe/checkout.js) — session.subscription is the new
        // subscription's id. Fetch it for its real status/period rather than
        // assuming 'active', since a price with a trial starts 'trialing'.
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription)
          // client_reference_id is the authoritative business_id (set at
          // checkout-session creation) — subscription.metadata.business_id
          // (set via subscription_data.metadata) should already match, but
          // prefer the session's own reference in case that ever diverges.
          if (session.client_reference_id && !subscription.metadata?.business_id) {
            subscription.metadata = { ...subscription.metadata, business_id: session.client_reference_id }
          }
          if (supabaseAdmin && session.client_reference_id) {
            await supabaseAdmin.from('businesses')
              .update({ stripe_customer_id: String(session.customer) })
              .eq('id', session.client_reference_id)
          }
          await updateBusinessFromSubscription(subscription)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await updateBusinessFromSubscription(event.data.object)
        break
      }

      case 'invoice.payment_failed': {
        // Stripe itself will also emit customer.subscription.updated with
        // status=past_due for this — this handler exists so the lock takes
        // effect on the FIRST failed payment rather than waiting for that
        // second event, and to cover invoices not tied to a subscription
        // status change (e.g. still within Stripe's own retry schedule).
        const invoice = event.data.object
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription)
          await updateBusinessFromSubscription(subscription)
        }
        break
      }

      default:
        // Unhandled event types are expected — Stripe sends many we don't
        // act on (invoice.paid, customer.updated, ...). Not an error.
        break
    }
  } catch (err) {
    // A processing bug here must not make Stripe think the webhook itself
    // failed (which would trigger retries of an event that may already be
    // partially applied) — log and still 200, same posture as the Clerk
    // webhook's own error handling.
    console.error('[stripe webhook] handler error:', err.message)
  }

  res.status(200).json({ received: true })
}
