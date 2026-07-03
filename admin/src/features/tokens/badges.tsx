import { cn } from "@/lib/utils";
import type { TokenStatus, TokenKind } from "@/api/types";

function BadgeBase({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest border",
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_STYLES: Record<TokenStatus, string> = {
  active: "border-success/40 bg-success/10 text-success",
  inactive: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
  revoked: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function TokenStatusBadge({ status }: { status: TokenStatus }) {
  return <BadgeBase className={STATUS_STYLES[status]}>{status}</BadgeBase>;
}

export function TokenKindBadge({ kind }: { kind: TokenKind }) {
  return (
    <BadgeBase
      className={cn(
        "border-primary/30 text-primary",
        kind === "card" ? "bg-primary/10" : "bg-primary/5",
      )}
    >
      {kind}
    </BadgeBase>
  );
}