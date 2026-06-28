// tripTheme — mobile mirror of the PWA's create-trip theme
// (travel-ai-nextjs/components/create-trip/theme.js). The trip planner uses a
// cyan / sky-blue accent (distinct from the app's global orange brand) so the
// mobile planner matches the web design. Import TRIP from here instead of
// hardcoding hex values; this is the single source of truth for planner accents.

export const TRIP = {
  // Primary — vibrant cyan / sky blue
  primary: '#06B6D4',
  primaryVia: '#0EA5E9',
  primaryDark: '#0284C7',
  primaryLight: '#67E8F9',
  // Soft fills for chips/badges/icon backgrounds
  primarySoft: '#ECFEFF', // cyan-50
  primarySoftBorder: '#A5F3FC', // cyan-200

  // Secondary — deep cyan
  secondary: '#0891B2',
  secondaryDark: '#0E7490',

  // Success — emerald
  success: '#10B981',
  successDark: '#059669',

  danger: '#EF4444',

  // Primary CTA gradient (cyan → sky → blue)
  gradient: ['#06B6D4', '#0EA5E9', '#0284C7'] as [string, string, string],

  // Per-day accent rotation for timeline/maps — cyan-led, replacing the old
  // coral-led rainbow so Day 1 reads as brand cyan.
  dayColors: ['#06B6D4', '#8B5CF6', '#10B981', '#F59E0B', '#0EA5E9', '#EC4899', '#3B82F6'],

  // Time-slot colors (match the PWA amber/sky/violet/indigo families)
  timeSlots: {
    morning: { dot: '#F59E0B', text: '#B45309', bg: '#FFFBEB', grad: ['#FBBF24', '#F97316'] as [string, string] },
    afternoon: { dot: '#0EA5E9', text: '#0369A1', bg: '#F0F9FF', grad: ['#38BDF8', '#3B82F6'] as [string, string] },
    evening: { dot: '#8B5CF6', text: '#6D28D9', bg: '#F5F3FF', grad: ['#A78BFA', '#A855F7'] as [string, string] },
    night: { dot: '#6366F1', text: '#4338CA', bg: '#EEF2FF', grad: ['#6366F1', '#7C3AED'] as [string, string] },
  },
} as const;

export type TripTheme = typeof TRIP;
export default TRIP;
