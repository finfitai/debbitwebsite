// Clerk's widget renders its own DOM outside our control — theme it via the
// appearance API so it doesn't clash with the surrounding brand chrome (see
// Debbit_Brand_Book.pdf's Color System: Debbit Purple panel, Balance Pink
// accent, Paper White text on dark, Inter for body/UI). Shared by every page
// that embeds <SignUp>/<SignIn> (register.js, login.js, desktop-link.js).
export const clerkAppearance = {
  variables: {
    colorPrimary: '#E08BB0',
    colorBackground: '#3a1552',
    colorText: '#FAF9FB',
    colorTextSecondary: '#C9B8D9',
    colorInputBackground: '#1C0A2E',
    colorInputText: '#FAF9FB',
    colorDanger: '#F4756B',
    colorSuccess: '#2FBF8F',
    borderRadius: '10px',
    fontFamily: 'var(--font-inter), Inter, sans-serif',
  },
  elements: {
    card: { boxShadow: 'none', background: 'transparent' },
    headerTitle: { fontFamily: 'var(--font-poppins), Poppins, sans-serif', color: '#FAF9FB' },
    headerSubtitle: { color: '#C9B8D9' },
    formButtonPrimary: { background: '#E08BB0', color: '#321148', fontWeight: 600, '&:hover': { background: '#e9a3c3' } },
    footerActionLink: { color: '#E08BB0' },
  },
}
