import { create } from "zustand";
import type { Mode } from "../../modes/types";

interface SubmitConfirmPayload {
  name: string;
  phone: string;
  mode: Mode;
  accentColor: string;
  onConfirm: () => void;
}

interface ModalState {
  submitConfirm: SubmitConfirmPayload | null;
  submitConfirmPending: boolean;
  openSubmitConfirm: (payload: SubmitConfirmPayload) => void;
  setSubmitConfirmPending: (pending: boolean) => void;
  closeSubmitConfirm: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  submitConfirm: null,
  submitConfirmPending: false,
  openSubmitConfirm: (payload) =>
    set({ submitConfirm: payload, submitConfirmPending: false }),
  setSubmitConfirmPending: (pending) => set({ submitConfirmPending: pending }),
  closeSubmitConfirm: () =>
    set({ submitConfirm: null, submitConfirmPending: false }),
}));