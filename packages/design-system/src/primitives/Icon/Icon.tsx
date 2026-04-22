import { forwardRef, type SVGAttributes } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";

export type IconName = keyof typeof LucideIcons;

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, "name"> {
  /** Lucide icon name, e.g. `"Plus"`, `"Settings"`, `"MessageSquare"`. */
  name: IconName;
  /** Rendered pixel size (width & height). Default 16. */
  size?: number | string;
  /** SVG stroke-width. Default 1.5 per design-system iconography spec. */
  strokeWidth?: number;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { name, size = 16, strokeWidth = 1.5, ...rest },
  ref,
) {
  const Cmp = LucideIcons[name] as React.ComponentType<LucideProps> | undefined;
  if (!Cmp) {
    // Fallback to a neutral circle if the icon name is misspelled — still a valid SVG.
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        <circle cx="12" cy="12" r="4" />
      </svg>
    );
  }
  return (
    <Cmp
      ref={ref}
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      {...(rest as LucideProps)}
    />
  );
});
