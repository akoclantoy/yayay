import { cn } from "@/lib/utils";

function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "secondary" | "outline" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variant === "default" &&
          "border-transparent bg-primary/15 text-primary",
        variant === "secondary" &&
          "border-transparent bg-secondary/15 text-secondary",
        variant === "outline" && "text-foreground",
        variant === "success" &&
          "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        variant === "warning" &&
          "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
