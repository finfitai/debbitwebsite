// Hand-drawn line icons in debbit's visual language (rounded, 1.75px stroke,
// currentColor) — no icon library dependency, no external image requests
// (keeps the CSP simple and the bundle light). Used by the business-type
// tiles in onboarding and the auth screens' decorative panel.

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' }

export function RetailIcon(props) {
  return (
    <svg viewBox="0 0 48 48" width={props.size || 28} height={props.size || 28} {...base}>
      <path d="M8 18v20a2 2 0 0 0 2 2h28a2 2 0 0 0 2-2V18" />
      <path d="M6 10h36l3 8a4 4 0 0 1-8 1 4 4 0 0 1-8 0 4 4 0 0 1-8 0 4 4 0 0 1-8 0 4 4 0 0 1-8-1l3-8Z" />
      <path d="M19 40v-9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v9" />
    </svg>
  )
}

export function FoodBeverageIcon(props) {
  return (
    <svg viewBox="0 0 48 48" width={props.size || 28} height={props.size || 28} {...base}>
      <path d="M12 6v14a6 6 0 0 0 6 6h0a6 6 0 0 0 6-6V6" />
      <path d="M15 6v10M21 6v10" />
      <path d="M18 26v16" />
      <path d="M34 6c-4 0-6 3-6 7 0 3 2 5 2 8v3a4 4 0 0 0 8 0V21c0-3 2-5 2-8 0-4-2-7-6-7Z" />
      <path d="M34 42h0" />
      <path d="M10 42h16" />
    </svg>
  )
}

export function WholesaleIcon(props) {
  return (
    <svg viewBox="0 0 48 48" width={props.size || 28} height={props.size || 28} {...base}>
      <path d="M24 5 6 13v4l18 8 18-8v-4L24 5Z" />
      <path d="M6 17v18l18 8 18-8V17" />
      <path d="M24 25v18" />
      <path d="M6 13l18 8 18-8" />
    </svg>
  )
}

export function ManufacturingIcon(props) {
  return (
    <svg viewBox="0 0 48 48" width={props.size || 28} height={props.size || 28} {...base}>
      <path d="M6 42V22l10 7v-7l10 7v-7l10 7v13H6Z" />
      <path d="M12 42V32M20 42V32M28 42V32M36 42V32" />
      <circle cx="35" cy="10" r="5" />
      <path d="M35 6v1.4M35 12.6V14M31.4 10h1.4M37.2 10h1.4M32.3 7.3l1 1M36.7 11.7l1 1M32.3 12.7l1-1M36.7 8.3l1-1" />
    </svg>
  )
}

export function ServiceIcon(props) {
  return (
    <svg viewBox="0 0 48 48" width={props.size || 28} height={props.size || 28} {...base}>
      <path d="M27 10a9 9 0 0 0-12.6 12.6l-8 8a3 3 0 0 0 4.2 4.2l8-8A9 9 0 0 0 31 14l-5.5 5.5-4-4L27 10Z" />
      <path d="M31 14l5 5" />
    </svg>
  )
}

export function ConstructionIcon(props) {
  return (
    <svg viewBox="0 0 48 48" width={props.size || 28} height={props.size || 28} {...base}>
      <path d="M7 41h34M11 41V22l13-9 13 9v19" />
      <path d="M19 41V29h10v12M18 22h.01M30 22h.01" />
      <path d="M19 12a5 5 0 0 1 10 0v3H19v-3ZM17 15h14" />
    </svg>
  )
}

export function LogisticsIcon(props) {
  return (
    <svg viewBox="0 0 48 48" width={props.size || 28} height={props.size || 28} {...base}>
      <path d="M5 12h23v22H5zM28 20h8l7 8v6H28z" />
      <path d="M35 20v8h8M12 38a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM36 38a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    </svg>
  )
}

export const BUSINESS_TYPE_ICONS = {
  RETAIL: RetailIcon,
  FOOD_BEVERAGE: FoodBeverageIcon,
  WHOLESALE: WholesaleIcon,
  MANUFACTURING: ManufacturingIcon,
  SERVICE: ServiceIcon,
  CONSTRUCTION: ConstructionIcon,
  LOGISTICS: LogisticsIcon,
}

export function CheckBadgeIcon(props) {
  return (
    <svg viewBox="0 0 48 48" width={props.size || 48} height={props.size || 48} {...base}>
      <circle cx="24" cy="24" r="19" />
      <path d="M16 24.5l5.5 5.5L33 18" />
    </svg>
  )
}

export function LockKeyIcon(props) {
  return (
    <svg viewBox="0 0 48 48" width={props.size || 28} height={props.size || 28} {...base}>
      <rect x="10" y="21" width="28" height="19" rx="4" />
      <path d="M16 21v-6a8 8 0 0 1 16 0v6" />
      <circle cx="24" cy="30" r="2.6" fill="currentColor" stroke="none" />
      <path d="M24 32.6V36" />
    </svg>
  )
}

export function RocketIcon(props) {
  return (
    <svg viewBox="0 0 48 48" width={props.size || 28} height={props.size || 28} {...base}>
      <path d="M24 5c6 3 10 10 10 18 0 4-1 7-2 9l-8 8-8-8c-1-2-2-5-2-9 0-8 4-15 10-18Z" />
      <circle cx="24" cy="19" r="4" />
      <path d="M17 32l-5 9 9-5M31 32l5 9-9-5" />
    </svg>
  )
}

// A loose constellation built from the brand's "=" mark — the decorative
// panel on the auth/onboarding screens, not a literal diagram of anything.
export function BrandConstellation(props) {
  const w = props.width || 420
  const h = props.height || 420
  return (
    <svg viewBox="0 0 420 420" width={w} height={h} style={{ display: 'block' }}>
      <defs>
        <radialGradient id="bc-glow" cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#5B2D82" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#5B2D82" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="210" cy="170" r="190" fill="url(#bc-glow)" />
      {[
        [90, 110], [150, 70], [230, 95], [320, 150], [60, 220],
        [140, 260], [250, 230], [330, 270], [190, 330], [100, 330],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 4 : 2.4} fill="#E08BB0" opacity={i % 2 ? 0.9 : 0.5} />
      ))}
      <path d="M90 110 150 70 230 95 320 150 M60 220 140 260 250 230 330 270 M190 330 100 330" stroke="#E08BB0" strokeOpacity="0.28" strokeWidth="1.2" fill="none" />
      {[[150, 185], [150, 195], [260, 185], [260, 195]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="30" height="4" rx="2" fill="#E08BB0" opacity={i < 2 ? 1 : 0.85} />
      ))}
    </svg>
  )
}
