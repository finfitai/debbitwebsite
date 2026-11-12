import nodemailer from 'nodemailer'
import { cleanContact, contactEmail } from '../../lib/contactMessage.mjs'

// Contact form on the homepage. Sends the enquiry by email through the same
// Gmail account the Clerk welcome email uses (GMAIL_USER / GMAIL_APP_PASSWORD).
// CONTACT_INBOX sets where enquiries go; without it they go to GMAIL_USER.

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
})

// Best-effort limit per server instance: 5 messages per address per 10 minutes.
const recent = new Map()
function tooMany(ip) {
  const now = Date.now(), windowMs = 10 * 60 * 1000
  const list = (recent.get(ip) || []).filter(t => now - t < windowMs)
  list.push(now); recent.set(ip, list)
  if (recent.size > 5000) recent.clear()
  return list.length > 5
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method' }) }
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
  if (tooMany(ip)) return res.status(429).json({ ok: false, error: 'busy' })
  const checked = cleanContact(req.body)
  if (!checked.ok) return res.status(400).json({ ok: false, error: checked.error })
  if (checked.spam) return res.status(200).json({ ok: true })
  const to = process.env.CONTACT_INBOX || process.env.GMAIL_USER
  if (!to || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('contact: email is not configured (GMAIL_USER, GMAIL_APP_PASSWORD, CONTACT_INBOX)')
    return res.status(503).json({ ok: false, error: 'not_configured' })
  }
  const mail = contactEmail(checked.data)
  try {
    await transporter.sendMail({ from: `debbit website <${process.env.GMAIL_USER}>`, to, replyTo: mail.replyTo, subject: mail.subject, text: mail.text })
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('contact: send failed', err && err.message)
    return res.status(502).json({ ok: false, error: 'send_failed' })
  }
}
