/**
 * Glyphs in mkan's DLS convention (template/header/menu-glyphs.tsx): 32-unit
 * viewBox, currentColor, 2px round strokes, aria-hidden. lucide-react covers
 * everything else, exactly as in mkan.
 */
import type React from "react"

export const StrokeGlyph = ({ size = 20, className, children }: { size?: number; className?: string; children: React.ReactNode }) => (
  <svg
    viewBox="0 0 32 32"
    aria-hidden="true"
    role="presentation"
    focusable="false"
    className={className}
    style={{
      display: "block",
      height: size,
      width: size,
      flexShrink: 0,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      overflow: "visible",
    }}
  >
    {children}
  </svg>
)

/** Shopping bag — the cart. */
export const BagGlyph = ({ size, className }: { size?: number; className?: string }) => (
  <StrokeGlyph size={size} className={className}>
    <path d="M6 10h20l-1.6 16.2a2 2 0 0 1-2 1.8H9.6a2 2 0 0 1-2-1.8z" />
    <path d="M11 13V9a5 5 0 0 1 10 0v4" />
  </StrokeGlyph>
)

/** Burger — the menu. */
export const BurgerGlyph = ({ size, className }: { size?: number; className?: string }) => (
  <StrokeGlyph size={size} className={className}>
    <path d="M5 14c0-5 4.9-8 11-8s11 3 11 8z" />
    <path d="M4 18.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5" />
    <path d="M5 22h22v1a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" />
  </StrokeGlyph>
)

/** Receipt — the order queue. */
export const ReceiptGlyph = ({ size, className }: { size?: number; className?: string }) => (
  <StrokeGlyph size={size} className={className}>
    <path d="M8 4h16v24l-3-2-2.5 2-2.5-2-2.5 2-2.5-2-3 2z" />
    <path d="M12 11h8M12 16h8M12 21h5" />
  </StrokeGlyph>
)

/** Chef hat — the kitchen. */
export const ChefGlyph = ({ size, className }: { size?: number; className?: string }) => (
  <StrokeGlyph size={size} className={className}>
    <path d="M10 26h12v-6.5a6 6 0 1 0-3-10.9 6 6 0 0 0-6 0 6 6 0 1 0-3 10.9z" />
    <path d="M10 22h12" />
  </StrokeGlyph>
)

/** Sliders — admin. */
export const SettingsGlyph = ({ size, className }: { size?: number; className?: string }) => (
  <StrokeGlyph size={size} className={className}>
    <path d="M5 9h14M25 9h2M5 16h4M15 16h12M5 23h14M25 23h2" />
    <circle cx="22" cy="9" r="3" />
    <circle cx="12" cy="16" r="3" />
    <circle cx="22" cy="23" r="3" />
  </StrokeGlyph>
)

/** WhatsApp brand mark (filled, 24 grid — same convention as mkan brand-icons). */
export const WhatsAppIcon = ({ size = 20, className }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" className={className} fill="currentColor">
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.01c0-5.2 4.23-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.24 9.42-9.44 9.42zm8.03-17.45A11.27 11.27 0 0 0 12.05.72C5.8.72.7 5.8.7 12.07c0 2 .52 3.95 1.52 5.67L.6 23.28l5.67-1.49a11.33 11.33 0 0 0 5.78 1.47h.01c6.25 0 11.34-5.08 11.35-11.34 0-3.03-1.18-5.88-3.33-8.02z" />
  </svg>
)
