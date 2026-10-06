// Resolve a saved dashboard selection only against businesses returned by the
// authenticated client. A stale or inaccessible ID always falls back safely.
export function chooseAccessibleBusiness(businesses, preferredId) {
  if (!Array.isArray(businesses) || businesses.length === 0) return null
  return businesses.find((business) => business.id === preferredId) || businesses[0]
}
