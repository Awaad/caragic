import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FlowProvider } from "./flow/FlowContext";
import { EntryGate } from "./components/EntryGate";
import { useContent } from "./api/hooks";
import { reconcileWithSession } from "./flow/persistStore";
import { Scene } from "./scene/Scene";
import { Overlay } from "./components/overlay/Overlay";
import { DebugOverlay } from "./components/DebugOverlay";
import type { Phase } from "./flow/types";
import { Farewell } from "./scene/ui/Farewell";
import { useFlow } from "./flow/useFlow";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false },
  },
});

function GatedFlow() {
  const { data: content } = useContent();
  
  // EntryGate guarantees this only renders once content resolved successfully.
  if (!content) return null;

  // Reconcile persisted flow state with the current session. This runs
  // synchronously during render fine because zustand's persist middleware
  // hydrates from localStorage at store creation, before any component mounts.
  const reconciled = reconcileWithSession(content.session_id);

  const resumeRound = content.rounds[reconciled.roundIndex];
  let initialPhase: Phase = "opening";
  if (reconciled.resume) {
    if (reconciled.lastOutcome === "submitted") {
      initialPhase = "reveal";
    } else if (reconciled.lastOutcome === "declined") {
      // Land on the capture form — CaptureForm3D handles showing 'choice'
      // step so the visitor gets another shot.
      initialPhase = "capturing";
    } else {
      initialPhase = resumeRound?.type === "capture" ? "capturing" : "round";
    }
  }

  return (
    <FlowProvider
      initialMode={content.mode}
      resume={reconciled.resume}
      initialPhase={initialPhase}
      initialRoundIndex={reconciled.roundIndex}
      initialAnswers={reconciled.answers}
      initialHasWarpedBefore={reconciled.hasWarpedBefore}
      initialLastOutcome={reconciled.lastOutcome}
    >
      <div style={backgroundStyle}>
        <FarewellGate />
      </div>
    </FlowProvider>
  );
}


function FarewellGate() {
  const { phase } = useFlow();
  if (phase === "farewell") {
    return <Farewell />;
  }
  return (
    <>
      <Scene />
      <Overlay />
      <DebugOverlay />
    </>
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
