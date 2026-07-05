import { Check, CheckCheck } from "lucide-react";

interface ReadReceiptProps {
  read: boolean;
}

/**
 * Sent/read state on visitor's own messages.
 * - sent (not yet read): single check, faint
 * - read: double check, filled, pops in with a scale animation
 *
 * The animation runs each time `read` flips true. React remounts the
 * CheckCheck element (different component than Check), so the keyframe
 * fires without needing a ref-based trigger.
 */
export function ReadReceipt({ read }: ReadReceiptProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        marginTop: 3,
        paddingRight: 4,
      }}
    >
      {read ? (
        <CheckCheck
          size={12}
          color="rgba(127,220,180,0.9)"
          style={{ animation: "receiptPop 0.35s ease-out" }}
        />
      ) : (
        <Check size={12} color="rgba(180,200,240,0.45)" />
      )}
    </div>
  );
}