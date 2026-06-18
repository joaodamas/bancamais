import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#F97316] text-white border border-[rgba(249,115,22,0.35)] hover:bg-[#FB8A3C] hover:shadow-[0_0_0_3px_rgba(249,115,22,0.12)]",
        secondary:
          "bg-[#141414] text-[#EDEDED] border border-[rgba(255,255,255,0.12)] hover:border-[#F97316] hover:bg-[rgba(249,115,22,0.05)]",
        destructive:
          "bg-transparent text-[#EF4444] border border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.08)] hover:border-[rgba(239,68,68,0.5)]",
        outline:
          "bg-transparent text-[#888888] border border-[rgba(255,255,255,0.12)] hover:border-[#F97316] hover:text-[#EDEDED] hover:bg-[rgba(249,115,22,0.05)]",
        ghost:
          "bg-transparent text-[#888888] border border-transparent hover:bg-[rgba(255,255,255,0.04)] hover:text-[#EDEDED]",
        link:
          "bg-transparent text-[#F97316] underline-offset-4 hover:underline p-0 h-auto border-0",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 px-2.5 text-xs rounded",
        lg: "h-10 px-5 text-base",
        icon: "h-8 w-8",
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
