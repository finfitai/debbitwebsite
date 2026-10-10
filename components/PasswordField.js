import { useState } from 'react'

// A password box with the "show" eye, like every login form people know. Same props as <input>; the box keeps its own style.
export default function PasswordField({ style, ...rest }) {
  const [shown, setShown] = useState(false)
  const { width, flex, margin, marginTop, marginBottom, ...boxStyle } = style || {}
  return (
    <div style={{ position: 'relative', width: width || '100%', flex, margin, marginTop, marginBottom }}>
      <input {...rest} type={shown ? 'text' : 'password'} style={{ ...boxStyle, width: '100%', paddingRight: 42, boxSizing: 'border-box' }} />
      <button
        type='button'
        tabIndex={-1}
        onMouseDown={e => e.preventDefault()}
        onClick={() => setShown(v => !v)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        title={shown ? 'Hide' : 'Show'}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
      >
        <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.75' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
          {shown ? (
            <>
              <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' />
              <line x1='1' y1='1' x2='23' y2='23' />
            </>
          ) : (
            <>
              <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
              <circle cx='12' cy='12' r='3' />
            </>
          )}
        </svg>
      </button>
    </div>
  )
}
