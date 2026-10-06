import test from 'node:test'
import assert from 'node:assert/strict'
import { chooseAccessibleBusiness } from './businessSelection.mjs'

const businesses = [
  { id: 'biz-a', name: 'Alpha' },
  { id: 'biz-b', name: 'Beta' },
]

test('restores a preferred business only when it is in the accessible result', () => {
  assert.equal(chooseAccessibleBusiness(businesses, 'biz-b'), businesses[1])
})

test('falls back to the first accessible business when the saved ID is stale', () => {
  assert.equal(chooseAccessibleBusiness(businesses, 'biz-removed'), businesses[0])
})

test('returns null when the signed-in user has no accessible businesses', () => {
  assert.equal(chooseAccessibleBusiness([], 'biz-a'), null)
  assert.equal(chooseAccessibleBusiness(null, 'biz-a'), null)
})
