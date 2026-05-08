const ACID_MAP = {
  A: { letter: 'A', label: 'Atomicity',   color: '#b89a6a' },
  C: { letter: 'C', label: 'Consistency', color: '#5a7a6a' },
  I: { letter: 'I', label: 'Isolation',   color: '#4a6a8a' },
  D: { letter: 'D', label: 'Durability',  color: '#7a5a8a' },
}

export default function HeroSplit({ tag, title, subtitle, acid = '', rightContent }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      minHeight: '72vh',
    }}>
      {/* Left — text */}
      <div style={{
        background: 'var(--cream)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '64px 72px',
      }}>
        {tag && (
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.72rem',
            letterSpacing: '0.2em',
            color: 'var(--text-muted)',
            marginBottom: 20,
            textTransform: 'uppercase',
          }}>{tag}</p>
        )}

        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(3rem, 6vw, 5.5rem)',
          fontWeight: 700,
          color: 'var(--navy)',
          lineHeight: 1.05,
          marginBottom: 28,
        }}>
          {title}
        </h1>

        {subtitle && (
          <p style={{
            fontFamily: 'var(--font-light)',
            fontSize: '1.05rem',
            color: 'var(--text-muted)',
            lineHeight: 1.7,
            maxWidth: 400,
            marginBottom: 32,
          }}>
            {subtitle}
          </p>
        )}

        {acid && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {acid.split('').map(l => {
              const m = ACID_MAP[l]
              if (!m) return null
              return (
                <div key={l} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <div style={{
                    width: 42, height: 42,
                    borderRadius: '50%',
                    border: `1.5px solid ${m.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-serif)',
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: m.color,
                  }}>{m.letter}</div>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                    {m.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Right — visual */}
      <div style={{
        background: 'var(--navy)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative circles */}
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 240, height: 240, borderRadius: '50%',
          border: '1px solid rgba(184,154,106,0.15)',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, left: -40,
          width: 180, height: 180, borderRadius: '50%',
          border: '1px solid rgba(184,154,106,0.1)',
        }} />
        {rightContent}
      </div>
    </div>
  )
}
