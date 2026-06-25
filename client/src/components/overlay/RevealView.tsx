import type { ModeReveal } from '../../modes/types';

interface RevealViewProps {
  reveal: ModeReveal;
}

export function RevealView({ reveal }: RevealViewProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        margin: 'auto 0',
        pointerEvents: 'auto',
      }}
    >
      <div>
        <h1
          style={{
            color: 'white',
            fontSize: 32,
            fontWeight: 600,
            margin: 0,
            textShadow: '0 2px 16px rgba(0,0,0,0.6)',
          }}
        >
          {reveal.name}
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 17,
            marginTop: 8,
            textShadow: '0 2px 12px rgba(0,0,0,0.6)',
          }}
        >
          {reveal.tagline}
        </p>
      </div>

      {reveal.links.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reveal.links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '14px 18px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: 'white',
                textDecoration: 'none',
                fontSize: 15,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}