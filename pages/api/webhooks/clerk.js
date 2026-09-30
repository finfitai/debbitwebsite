import { Webhook } from 'svix'
import nodemailer from 'nodemailer'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export const config = {
  api: {
    // We need the raw body to verify the webhook signature
    bodyParser: false,
  },
}

// Helper to get raw body from Next.js request
async function buffer(readable) {
  const chunks = []
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

// Configure Google SMTP Transport
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

// ISSUES.md #19: this webhook used to only send a welcome email — it never
// wrote the external_auth_id-linked `users` row, so Supabase RLS (which
// resolves the current tenant via `external_auth_id = auth.jwt() ->> 'sub'`,
// see supabase/migrations/002_rls_policies.sql) could never recognize a
// brand-new Clerk user until they happened to call bootstrap_owner_registration
// or accept_tenant_invite — the two RPCs that lazily upsert the same row on
// first use. This keeps that row in sync eagerly, right at sign-up/profile
// update/delete, using the same upsert shape those RPCs use (matched by the
// column's own UNIQUE constraint) so both paths can never disagree.
// SERVICE_ROLE is required here — a webhook has no user JWT for RLS to key
// off, so this is the one place that legitimately needs it (see lib/supabaseAdmin.js).

function primaryEmail(userData) {
  const emailData = userData.email_addresses?.find(
    (email) => email.id === userData.primary_email_address_id
  ) || userData.email_addresses?.[0]
  return emailData?.email_address || null
}

// Upsert (create or refresh) the `users` row for this Clerk identity. Never
// throws — a Supabase misconfiguration or outage must not fail the webhook
// (Clerk retries on non-2xx, and the lazy-upsert RPCs remain a fallback).
async function syncClerkUser(userData) {
  if (!supabaseAdmin) {
    console.warn('[clerk webhook] SUPABASE_SERVICE_ROLE_KEY not configured — skipping users row sync')
    return
  }
  const email = primaryEmail(userData)
  if (!email) return
  const fullName = [userData.first_name, userData.last_name].filter(Boolean).join(' ') || email.split('@')[0]
  const { error } = await supabaseAdmin.from('users').upsert({
    external_auth_id: userData.id,
    auth_provider: 'clerk',
    email,
    full_name: fullName,
    phone: userData.primary_phone_number_id
      ? userData.phone_numbers?.find((p) => p.id === userData.primary_phone_number_id)?.phone_number ?? null
      : null,
    avatar_url: userData.image_url || null,
  }, { onConflict: 'external_auth_id' })
  if (error) console.error('[clerk webhook] failed to upsert users row:', error.message)
}

// Soft-deactivate rather than delete — matches `users.is_active`'s existing
// purpose elsewhere, and avoids cascading into a tenant's historical data
// (created_by/audit references, etc.) that a hard delete would orphan.
async function deactivateClerkUser(clerkUserId) {
  if (!supabaseAdmin) return
  const { error } = await supabaseAdmin
    .from('users')
    .update({ is_active: false })
    .eq('external_auth_id', clerkUserId)
  if (error) console.error('[clerk webhook] failed to deactivate users row:', error.message)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // Get headers
  const svix_id = req.headers['svix-id']
  const svix_timestamp = req.headers['svix-timestamp']
  const svix_signature = req.headers['svix-signature']

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ message: 'Error occured -- no svix headers' })
  }

  // Get the raw body
  const body = await buffer(req)
  const payloadString = body.toString()

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt

  // Verify the payload with the headers
  try {
    evt = wh.verify(payloadString, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    })
  } catch (err) {
    console.error('Error verifying webhook:', err.message)
    return res.status(400).json({ message: 'Error verifying webhook' })
  }

  const { id } = evt.data
  const eventType = evt.type

  if (eventType === 'user.created' || eventType === 'user.updated') {
    await syncClerkUser(evt.data)
  }

  if (eventType === 'user.deleted') {
    // Clerk sends { id, deleted: true } with no profile fields on delete.
    if (id) await deactivateClerkUser(id)
  }

  if (eventType === 'user.created') {
    const email = primaryEmail(evt.data)
    const firstName = evt.data.first_name || 'there'

    if (email) {
      console.log(`Sending welcome email via Google SMTP to ${email}`)
      try {
        await transporter.sendMail({
          from: `"debbit OS" <${process.env.GMAIL_USER}>`,
          to: email,
          subject: 'Welcome to debbit OS!',
          html: `<p>Hi ${firstName},</p><p>Welcome to debbit OS! We are excited to have you on board.</p><p>Let us know if you have any questions during setup.</p>`,
        })
        console.log('Email sent successfully via Google SMTP')
      } catch (error) {
        console.error('Error sending email via Google SMTP:', error)
        // We still return 200 to Clerk so it doesn't retry infinitely
      }
    }
  }

  return res.status(200).json({ success: true, message: 'Webhook received' })
}
