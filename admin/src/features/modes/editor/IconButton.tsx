import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";

interface Props {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string; // accessible label
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}


export function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center h-7 w-7 rounded",
        "border border-border bg-background",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-accent transition-colors",
        "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-background",
        danger && "hover:text-destructive hover:border-destructive/50",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}