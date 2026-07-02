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

interface EraseRequestResponse {
  accepted: boolean;
  message: string;
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
      store.setLastSubmissionId(data.id); 
      // Clear progress but leave lastOutcome intact for follow-up UI.
      // We do this by preserving lastOutcome + session_id and resetting the rest.
      //store.clearProgress();
    },
  });
}

/**
 * Visitor-side erase request. Sets the submission's status to erase_requested;
 * admin finalizes separately. On success we clear the persist store so this
 * device is effectively signed out — the visitor has to tap the card again
 * to get a new session.
 */
export function useRequestErasure() {
  return useMutation<EraseRequestResponse, Error, { submissionId: string }>({
    mutationFn: ({ submissionId }) =>
      apiFetch<EraseRequestResponse>(
        `/visitor/submissions/${submissionId}/erase-request`,
        { method: "POST" },
      ),
    onSuccess: () => {
      // Cookie stays on the server side but locally we wipe everything.
      // The visitor's next action is either to close the tab or start over
      // via NFC tap.
      useFlowPersistStore.getState().clear();
    },
  });
}