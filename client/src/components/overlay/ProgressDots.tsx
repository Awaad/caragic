interface ProgressDotsProps {
  total: number;
  current: number;
}

export function ProgressDots({ total, current }: ProgressDotsProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
        position: 'absolute',
        top: 24,
        left: 0,
        right: 0,
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background:
              i < current
                ? 'rgba(255,255,255,0.7)'
                : i === current
                  ? 'rgba(180, 200, 255, 1)'
                  : 'rgba(255,255,255,0.2)',
            transition: 'background 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}