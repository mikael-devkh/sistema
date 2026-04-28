import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "border-border bg-card text-foreground",
        success: "border-transparent bg-success/10 text-success",
        warning: "border-transparent bg-warning/15 text-foreground",
        info: "border-transparent bg-info/10 text-info",
        critical: "border-transparent bg-critical/10 text-critical",
        terminal: "border-transparent bg-[hsl(var(--terminal-soft))] text-[hsl(var(--terminal))]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
