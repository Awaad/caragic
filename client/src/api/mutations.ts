import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { useFlowPersistStore } from "../flow/persistStore";

export interface Answer {
  round_id: string;
  option_id: string;
}

export interface SubmissionRequest {
  outcome: "submitted" | "declined";
  name?: string;
  phone?: string;
  answers: Answer[];
}

export interface SubmissionResponse {
  id: string;
  outcome: "submitted" | "declined";
  attempt_number: number;
  created_at: string;
}

/**
 * Submit a flow completion. Two outcomes:
 * - 'submitted' — carries name + phone + full answers, expects 201 back
 * - 'declined'  — fire-and-forget; server accepts empty/partial answers
 *
 * On success we clear the persist store so the next reload doesn't try to
 * resume a completed flow. `lastOutcome` is set first (before clear) so a
 * follow-up "try again?" UI can read it.
 */
export function useSubmitCapture() {
  return useMutation<SubmissionResponse, Error, SubmissionRequest>({
    mutationFn: (body) =>
      apiFetch<SubmissionResponse>("/visitor/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body as any, 
      }),
    onSuccess: (data) => {
      const store = useFlowPersistStore.getState();
      store.setLastOutcome(data.outcome);
      // Clear progress but leave lastOutcome intact for follow-up UI.
      // We do this by preserving lastOutcome + session_id and resetting the rest.
      store.clearProgress();
    },
  });
}