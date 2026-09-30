// Money formatting for the cloud dashboard. The Malaysia beachhead uses MYR /
// en-MY (the desktop app is already en-MY). Once the dashboard resolves the
// owner's business (after the Clerk→Supabase tenant bridge lands), pass that
// business's `currency` here instead of relying on the default.
export function money(n, currency = 'MYR', locale = 'en-MY') {
  const value = Math.abs(Number(n) || 0)
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

export function monthLabel(locale = 'en-MY') {
  return new Date().toLocaleString(locale, { month: 'long', year: 'numeric' })
}
