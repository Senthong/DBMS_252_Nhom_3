export default function SectionHeader({ eyebrow, title, center = false }) {
  return (
    <div style={{
      textAlign: center ? 'center' : 'left',
      marginBottom: 48,
    }}>
      {eyebrow && (
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.68rem',
          letterSpacing: '0.22em',
          color: 'var(--gold)',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}>{eyebrow}</p>
      )}
      <h2 style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 'clamp(1.8rem, 3vw, 2.8rem)',
        fontWeight: 700,
        color: 'var(--navy)',
        lineHeight: 1.15,
        letterSpacing: '-0.01em',
      }}>{title}</h2>
      <div style={{
        width: center ? 60 : 48,
        height: 1,
        background: 'var(--gold)',
        marginTop: 18,
        marginLeft: center ? 'auto' : 0,
        marginRight: center ? 'auto' : 0,
      }} />
    </div>
  )
}
