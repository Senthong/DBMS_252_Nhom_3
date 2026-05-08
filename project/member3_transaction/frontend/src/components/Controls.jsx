import { useState } from 'react'

export function RunButton({ onClick, loading, label = 'RUN DEMO' }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        background: loading ? 'var(--navy-mid)' : 'var(--navy)',
        color: 'var(--white)',
        border: '1px solid var(--navy)',
        padding: '13px 36px',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize: '0.72rem',
        letterSpacing: '0.18em',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
      }}
      onMouseEnter={e => { if (!loading) { e.target.style.background = 'var(--gold)'; e.target.style.borderColor = 'var(--gold)' } }}
      onMouseLeave={e => { if (!loading) { e.target.style.background = 'var(--navy)'; e.target.style.borderColor = 'var(--navy)' } }}
    >
      {loading ? '◌ RUNNING...' : `▸ ${label}`}
    </button>
  )
}

export function ResultBox({ result, error }) {
  if (!result && !error) return null
  const isErr = !!error
  const data = error || result

  return (
    <div style={{
      marginTop: 24,
      border: `1px solid ${isErr ? '#c0392b' : 'var(--navy-mid)'}`,
      background: isErr ? '#fdf0ef' : 'var(--navy-deep)',
    }}>
      {/* header bar */}
      <div style={{
        background: isErr ? '#c0392b' : 'var(--navy)',
        padding: '8px 20px',
        fontFamily: 'var(--font-body)',
        fontSize: '0.65rem',
        letterSpacing: '0.15em',
        color: 'rgba(255,255,255,0.8)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span>{isErr ? '✕ ERROR' : '✓ SUCCESS'}</span>
      </div>
      {/* body */}
      <pre style={{
        margin: 0,
        padding: '20px 24px',
        fontFamily: "'Fira Code', 'Cascadia Code', monospace",
        fontSize: '0.78rem',
        lineHeight: 1.65,
        color: isErr ? '#8b1a1a' : 'rgba(255,255,255,0.75)',
        overflowX: 'auto',
        maxHeight: 300,
        overflowY: 'auto',
        whiteSpace: 'pre-wrap',
      }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}
