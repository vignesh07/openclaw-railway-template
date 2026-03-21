import { cn } from "@/lib/utils";

const variantClasses = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline: "border border-border bg-transparent text-foreground hover:bg-muted/60",
  ghost: "bg-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground",
  destructive: "bg-danger/90 text-foreground hover:bg-danger",
};

const sizeClasses = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3 text-xs",
  lg: "h-11 px-6",
};

export function buttonVariants({ variant = "default", size = "default", className } = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export function Button({ className, variant = "default", size = "default", type = "button", ...props }) {
  return <button className={buttonVariants({ variant, size, className })} type={type} {...props} />;
}
