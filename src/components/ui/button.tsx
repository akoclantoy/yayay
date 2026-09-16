import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/30 active:scale-[0.98]",
        secondary:
          "bg-white/80 text-foreground border border-border shadow-sm hover:bg-white dark:bg-white/10 dark:hover:bg-white/15",
        outline:
          "border border-primary/30 bg-transparent text-primary hover:bg-primary/5",
        ghost: "hover:bg-primary/5 text-foreground",
        destructive:
          "bg-danger text-white shadow-lg shadow-danger/20 hover:bg-danger/90",
        glass:
          "bg-white/60 backdrop-blur-xl border border-white/40 shadow-lg hover:bg-white/70 dark:bg-white/10 dark:border-white/10",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
