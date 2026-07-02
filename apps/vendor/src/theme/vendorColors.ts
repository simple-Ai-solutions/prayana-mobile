// Vendor-scoped color tokens — INDIGO brand, matching the web Business Portal
// (components/business/BusinessLayout.jsx uses #4F46E5 as its primary).
//
// The shared theme (@prayana/shared-ui) is ORANGE and is used by the customer +
// support-agent apps, so we must NOT mutate it. Instead we re-export every shared
// token and override only the brand ramp (primary) + focus border to indigo.
// Vendor screens import `colors` (and the rest) from HERE instead of shared-ui.
//
// Source of truth for indigo ramp: Tailwind `indigo` (600 = #4F46E5, the PWA brand).

import {
  colors as sharedColors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadow,
  motion,
  zIndex,
  layout,
} from '@prayana/shared-ui';

// Tailwind indigo ramp — 600 (#4F46E5) is the PWA's brand color.
const indigo = {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5', // PWA Business Portal brand
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
} as const;

export const colors = {
  ...sharedColors,
  // Override the brand ramp with indigo. We keep the [500]-as-main convention the
  // screens use, but map it to indigo-600 so `colors.primary[500]` == #4f46e5
  // (the exact PWA brand). The rest of the ramp shifts one step for depth.
  primary: {
    50: indigo[50],
    100: indigo[100],
    200: indigo[200],
    300: indigo[300],
    400: indigo[500],
    500: indigo[600], // main = #4f46e5, the PWA brand
    600: indigo[700],
    700: indigo[800],
    800: indigo[900],
    900: '#232066',
  },
  borderFocused: indigo[600],
} as const;

// Re-export the untouched shared tokens so vendor screens can import everything
// design-related from this one module.
export { spacing, borderRadius, fontSize, fontWeight, shadow, motion, zIndex, layout };

export const vendorTheme = {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadow,
  motion,
  zIndex,
  layout,
} as const;

export default vendorTheme;
