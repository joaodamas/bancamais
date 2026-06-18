import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-[rgba(255,255,255,0.12)] bg-[#0A0A0A] px-3 py-1.5 text-sm text-[#EDEDED] transition-colors",
          "placeholder:text-[#555555]",
          "focus:border-[#7C3AED] focus:outline-none focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
