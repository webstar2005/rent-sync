import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "link";
type Size = "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-burgundy-600 text-white shadow-cta hover:bg-burgundy-700 focus-visible:ring-burgundy-600 border border-transparent",
  secondary:
    "bg-white text-ink border border-ink/10 hover:bg-gray-100 focus-visible:ring-ink",
  ghost:
    "bg-transparent text-ink hover:bg-gray-100 border border-transparent focus-visible:ring-ink",
  link: "bg-transparent text-burgundy-600 underline-offset-4 hover:underline hover:text-burgundy-700 border border-transparent px-0 py-0 h-auto shadow-none",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-9 px-4 text-small",
  md: "h-10 px-6 py-2.5 text-sm",
  lg: "h-12 px-8 text-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const isLink = variant === "link";
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          !isLink && "shadow-sm",
          variantStyles[variant],
          !isLink && sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
