import { type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { useContent } from '../api/hooks';

interface EntryGateProps {
  children: ReactNode;
}

export function EntryGate({ children }: EntryGateProps) {
  const { data, isLoading, error } = useContent();

  if (isLoading) return <LoadingScreen />;

  if (error instanceof ApiError) {
    // 401 = no session yet, 410 = session's mode was deactivated.
    // Both land on the landing screen — distinction matters for logs, not UX.
    if (error.status === 401 || error.status === 410) return <LandingScreen />;
    return <ErrorScreen requestId={error.requestId} />;
  }

  if (error) return <ErrorScreen requestId={null} />;
  if (!data) return <LandingScreen />;

  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div style={fullScreenStyle}>
      <div style={{ color: '#88aaff', fontFamily: 'monospace', letterSpacing: 2 }}>
        loading…
      </div>
    </div>
  );
}

function LandingScreen() {
  return (
    <div style={fullScreenStyle}>
      <div style={landingTextStyle}>
        <div style={{ fontSize: 18, marginBottom: 12 }}>this card is asleep.</div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          tap an nfc card or open a shared link to begin.
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({ requestId }: { requestId: string | null }) {
  return (
    <div style={fullScreenStyle}>
      <div style={landingTextStyle}>
        <div style={{ fontSize: 18, marginBottom: 12 }}>something is not acting right.</div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          try again in a moment.
          {requestId && (
            <>
              <br />
              <span style={{ opacity: 0.5, fontSize: 11 }}>ref: {requestId}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const fullScreenStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'radial-gradient(ellipse at center, #0a0420 0%, #02010a 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const landingTextStyle: React.CSSProperties = {
  color: '#bbc5ff',
  fontFamily: 'monospace',
  letterSpacing: 1.5,
  textAlign: 'center',
  maxWidth: 320,
  padding: 24,
};