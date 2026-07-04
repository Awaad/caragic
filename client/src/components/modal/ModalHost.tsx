import { useModalStore } from "./modalStore";
import { SubmitConfirmDialog } from "../../scene/ui/SubmitConfirmDialog";

export function ModalHost() {
  const submitConfirm = useModalStore((s) => s.submitConfirm);
  const submitConfirmPending = useModalStore((s) => s.submitConfirmPending);
  const closeSubmitConfirm = useModalStore((s) => s.closeSubmitConfirm);

  if (!submitConfirm) return null;

  return (
    <SubmitConfirmDialog
      name={submitConfirm.name}
      phone={submitConfirm.phone}
      mode={submitConfirm.mode}
      accentColor={submitConfirm.accentColor}
      onEdit={closeSubmitConfirm}
      onConfirm={submitConfirm.onConfirm}
      isSubmitting={submitConfirmPending}
    />
  );
}