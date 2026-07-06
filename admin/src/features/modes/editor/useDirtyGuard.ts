import { useEffect } from "react";

/**
 * Attaches a beforeunload handler while `dirty` is true so browser
 * refresh / tab close prompts the user. Does NOT block in-app
 * navigation (sidebar link clicks, browser back) — that would need
 * useBlocker + a data router, which the admin doesn't use. The
 * editor pages compensate with a visible "unsaved" indicator and
 * an explicit Cancel-confirmation button.
 */
export function useDirtyGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages; setting returnValue
      // is what triggers the confirmation dialog.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}