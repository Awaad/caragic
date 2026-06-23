import type { PermissionPromptProps } from '../types';

export function PermissionPrompt({ onAccept }: PermissionPromptProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        zIndex: 10,
      }}
    >
      <button
        onClick={onAccept}
        style={{
          padding: '1rem 2rem',
          fontSize: '1.1rem',
          borderRadius: '999px',
          border: 'none',
          background: 'white',
          cursor: 'pointer',
        }}
      >
        Tap to wake it up
      </button>
    </div>
  );
}