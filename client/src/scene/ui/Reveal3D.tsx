import { Html, Text } from '@react-three/drei';
import { useFlow } from '../../flow/useFlow';
import { getContentForMode } from '../../modes/content';

export function Reveal3D() {
  const { phase, mode } = useFlow();
  if (phase !== 'reveal') return null;

  const content = getContentForMode(mode);
  const { reveal } = content;

  return (
    <>
      <Text
        position={[0, 1.2, 0]}
        fontSize={0.25}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {reveal.name}
      </Text>

      <Html
        position={[0, -0.8, 0]}
        center
        distanceFactor={6}
        style={{ width: 320, textAlign: 'center', pointerEvents: 'auto' }}
      >
        <div
          style={{
            color: 'rgba(255,255,255,0.92)',
            fontSize: 15,
            textShadow: '0 2px 16px rgba(0,0,0,0.8)',
            marginBottom: 14,
          }}
        >
          {reveal.tagline}
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
                  padding: '10px 16px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: 14,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </Html>
    </>
  );
}