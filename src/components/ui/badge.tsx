import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold font-mono tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[rgba(249,115,22,0.12)] text-[#F97316] border-[rgba(249,115,22,0.28)]",
        secondary:
          "bg-[rgba(255,255,255,0.05)] text-[#888888] border-[rgba(255,255,255,0.1)]",
        destructive:
          "bg-[rgba(239,68,68,0.12)] text-[#EF4444] border-[rgba(239,68,68,0.28)]",
        outline:
          "bg-transparent text-[#EDEDED] border-[rgba(255,255,255,0.12)]",
        success:
          "bg-[rgba(34,197,94,0.12)] text-[#22C55E] border-[rgba(34,197,94,0.28)]",
        warning:
          "bg-[rgba(245,158,11,0.12)] text-[#F59E0B] border-[rgba(245,158,11,0.28)]",
        info:
          "bg-[rgba(6,182,212,0.1)] text-[#06B6D4] border-[rgba(6,182,212,0.25)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
