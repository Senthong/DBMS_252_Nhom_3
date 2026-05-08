import { useState } from 'react'

const TABS = ['COMMIT', 'ROLLBACK', 'SAVEPOINT', 'TRANSFER', 'REDIS', 'HISTORY']

export default function Navbar({ active, onSelect }) {
  return (
    <nav style={{
      background: 'var(--navy)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 40px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
    }}>
      {/* Logo */}
      <div style={{
        fontFamily: 'var(--font-serif)',
        color: 'var(--white)',
        fontSize: '1.1rem',
        fontWeight: 700,
        letterSpacing: '0.05em',
        padding: '18px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        whiteSpace: 'nowrap',
      }}>
        <span style={{ color: 'var(--gold)', fontSize: '1.2rem' }}>✦</span>
        DBMS · Topic IV
      </div>

      {/* Nav items */}
      <div style={{ display: 'flex' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => onSelect(tab)}
            style={{
              background: 'none',
              border: 'none',
              color: active === tab ? 'var(--white)' : 'rgba(255,255,255,0.55)',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: '0.72rem',
              letterSpacing: '0.12em',
              padding: '22px 20px',
              cursor: 'pointer',
              borderBottom: active === tab ? '2px solid var(--gold)' : '2px solid transparent',
              transition: 'color 0.2s, border-color 0.2s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Right badge */}
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: '0.7rem',
        letterSpacing: '0.1em',
        color: 'rgba(255,255,255,0.35)',
        whiteSpace: 'nowrap',
      }}>
        PostgreSQL · Redis
      </div>
    </nav>
  )
}
