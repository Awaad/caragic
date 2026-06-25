import { FlowProvider } from './flow/FlowContext';
import { parseModeFromUrl } from './flow/parseModeFromUrl';
import { Scene } from './scene/Scene';
import { Overlay } from './components/overlay/Overlay';
import { DebugOverlay } from './components/DebugOverlay';

export default function App() {
  const initialMode = parseModeFromUrl();

  return (
    <FlowProvider initialMode={initialMode}>
      <div style={{
          position: 'fixed',
          inset: 0,
          background: `
            radial-gradient(ellipse at 30% 40%, rgba(80, 50, 150, 0.4) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 60%, rgba(40, 80, 180, 0.35) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, rgba(150, 40, 100, 0.25) 0%, transparent 60%),
            radial-gradient(circle at center, #0a0a1f 0%, #020208 100%)`,
        }}>
        <Scene />
        <Overlay />
        <DebugOverlay />
      </div>
    </FlowProvider>
  );
}