import { cn } from "@/lib/utils";

const variantClasses = {
  default: "border-primary/20 bg-primary/15 text-primary",
  secondary: "border-border bg-muted/70 text-muted-foreground",
  success: "border-success/20 bg-success/15 text-success",
  warning: "border-warning/20 bg-warning/15 text-warning",
  danger: "border-danger/20 bg-danger/15 text-danger",
  outline: "border-border bg-transparent text-foreground",
};

export function Badge({ className, variant = "default", ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
