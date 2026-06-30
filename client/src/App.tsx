import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FlowProvider } from "./flow/FlowContext";
import { EntryGate } from "./components/EntryGate";
import { useContent } from "./api/hooks";
import { Scene } from "./scene/Scene";
import { Overlay } from "./components/overlay/Overlay";
import { DebugOverlay } from "./components/DebugOverlay";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false },
  },
});

function GatedFlow() {
  const { data: content } = useContent();
  // EntryGate guarantees this only renders once content resolved successfully.
  if (!content) return null;

  return (
    <FlowProvider initialMode={content.mode}>
      <div style={backgroundStyle}>
        <Scene />
        <Overlay />
        <DebugOverlay />
      </div>
    </FlowProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <EntryGate>
        <GatedFlow />
      </EntryGate>
    </QueryClientProvider>
  );
}

const backgroundStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: `
    radial-gradient(ellipse at 30% 40%, rgba(80, 50, 150, 0.4) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 60%, rgba(40, 80, 180, 0.35) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 80%, rgba(150, 40, 100, 0.25) 0%, transparent 60%),
    radial-gradient(circle at center, #0a0a1f 0%, #020208 100%)
  `,
};
