// Checks and formats a message sent from the contact form on the homepage.
// Kept free of Next.js and nodemailer so it can be tested on its own.

const LIMITS = { name: 120, business: 160, email: 200, country: 80, product: 60, message: 4000, lang: 8 }

export function cleanContact(input) {
  const src = input && typeof input === 'object' ? input : {}
  // A hidden field only bots fill in. Accept quietly and send nothing.
  if (typeof src.website === 'string' && src.website.trim() !== '') return { ok: true, spam: true }
  const out = {}
  for (const [key, max] of Object.entries(LIMITS)) {
    const v = typeof src[key] === 'string' ? src[key] : ''
    out[key] = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max)
  }
  if (!out.name) return { ok: false, error: 'name' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) return { ok: false, error: 'email' }
  return { ok: true, data: out }
}

export function contactEmail(d) {
  const oneLine = s => s.replace(/[\r\n]+/g, ' ')
  const subject = oneLine(`Website enquiry: ${d.product || 'Not sure yet'} from ${d.name}${d.business ? ` (${d.business})` : ''}`).slice(0, 200)
  const text = [
    `Name: ${d.name}`,
    `Business: ${d.business || '-'}`,
    `Email: ${d.email}`,
    `Country: ${d.country || '-'}`,
    `Interested in: ${d.product || '-'}`,
    `Site language: ${d.lang || 'en'}`,
    '',
    d.message || '(no message)',
  ].join('\n')
  return { subject, text, replyTo: oneLine(d.email) }
}
