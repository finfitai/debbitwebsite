import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanContact, contactEmail } from './contactMessage.mjs'

test('needs a name and a real-looking email', () => {
  assert.deepEqual(cleanContact({ email: 'a@b.co' }), { ok: false, error: 'name' })
  assert.deepEqual(cleanContact({ name: 'Aisyah', email: 'nope' }), { ok: false, error: 'email' })
  assert.equal(cleanContact({ name: 'Aisyah', email: 'a@b.co' }).ok, true)
})

test('the hidden field marks a bot and nothing is sent', () => {
  assert.deepEqual(cleanContact({ name: 'x', email: 'a@b.co', website: 'http://spam' }), { ok: true, spam: true })
})

test('trims, drops control characters and caps lengths', () => {
  const r = cleanContact({ name: '  Ai\u0007syah ', email: 'a@b.co', message: 'x'.repeat(5000) })
  assert.equal(r.data.name, 'Aisyah')
  assert.equal(r.data.message.length, 4000)
})

test('non-string values are ignored', () => {
  const r = cleanContact({ name: 'A', email: 'a@b.co', business: { evil: 1 } })
  assert.equal(r.data.business, '')
})

test('subject and reply-to cannot carry new lines', () => {
  const e = contactEmail({ name: 'A\r\nBcc: x@y.z', email: 'a@b.co', business: '', product: 'debbitPro', message: 'hi', country: '', lang: 'fr' })
  assert.ok(!/[\r\n]/.test(e.subject))
  assert.ok(e.text.includes('Site language: fr'))
})
