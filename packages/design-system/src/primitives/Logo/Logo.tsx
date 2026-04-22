import { forwardRef, type SVGAttributes } from "react";

export type LogoVariant = "mark" | "wordmark";

export interface LogoProps extends SVGAttributes<SVGSVGElement> {
  /** `"mark"` shows just the paint-blob; `"wordmark"` shows blob + "streamteam" text. */
  variant?: LogoVariant;
  /** Height in px. For the mark this is both width and height; for the
   * wordmark the SVG preserves its aspect ratio. */
  size?: number;
}

/** StreamTeam paint-blob mark — copied from `assets/logo.svg`. */
export const Logo = forwardRef<SVGSVGElement, LogoProps>(function Logo(
  { variant = "mark", size = 24, ...rest },
  ref,
) {
  if (variant === "wordmark") {
    const width = Math.round((size * 280) / 48);
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 280 48"
        fill="none"
        width={width}
        height={size}
        role="img"
        aria-label="StreamTeam"
        {...rest}
      >
        <g transform="translate(0, 0)">
          <path
            d="M 12 22 Q 10 10, 22 10 Q 36 8, 38 20 Q 40 32, 30 36 Q 18 40, 12 32 Q 8 28, 12 22 Z"
            fill="#5939b8"
            opacity="0.85"
          />
          <path
            d="M 16 16 Q 14 6, 26 8 Q 38 10, 36 22 Q 38 34, 26 32 Q 14 30, 16 16 Z"
            fill="#8b5cf6"
          />
          <circle cx="22" cy="16" r="2" fill="#c4b5fd" opacity="0.9" />
          <path d="M 24 34 Q 24 40, 26 42 Q 28 40, 26 34 Z" fill="#8b5cf6" />
        </g>
        <text
          x="56"
          y="32"
          fontFamily="'KG Second Chances', 'Bricolage Grotesque', 'Archivo Black', sans-serif"
          fontWeight="700"
          fontSize="26"
          fill="#e6e8ef"
          letterSpacing="-0.5"
        >
          streamteam
        </text>
      </svg>
    );
  }
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      width={size}
      height={size}
      role="img"
      aria-label="StreamTeam"
      {...rest}
    >
      <path
        d="M 12 22 Q 10 10, 22 10 Q 36 8, 38 20 Q 40 32, 30 36 Q 18 40, 12 32 Q 8 28, 12 22 Z"
        fill="#5939b8"
        opacity="0.85"
      />
      <path
        d="M 16 16 Q 14 6, 26 8 Q 38 10, 36 22 Q 38 34, 26 32 Q 14 30, 16 16 Z"
        fill="#8b5cf6"
      />
      <circle cx="22" cy="16" r="2" fill="#c4b5fd" opacity="0.9" />
      <path d="M 24 34 Q 24 40, 26 42 Q 28 40, 26 34 Z" fill="#8b5cf6" />
    </svg>
  );
});
