// Vendor-branded UI components (BLUE).
//
// The shared-ui components (@prayana/shared-ui) hardcode the shared ORANGE brand
// (colors.primary[500] == #f97316), used by the customer app. We can't change
// shared-ui without turning the customer app blue too. So the vendor app imports
// its interactive/brand-colored components from HERE: thin wrappers that render
// the shared component but override the brand color to blue (colors.primary from
// vendorColors, == #2563eb).
//
// Non-branded shared-ui components (Card, EmptyState, SearchBar, Avatar w/o
// brand, useTheme, etc.) can still be imported directly from '@prayana/shared-ui'
// — only the ones that paint the brand color are wrapped here.

import React from 'react';
import {
  StyleProp,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import {
  Button as SharedButton,
  LoadingSpinner as SharedLoadingSpinner,
  StarRating as SharedStarRating,
} from '@prayana/shared-ui';
import { colors } from '../../theme/vendorColors';

// ─────────────────────────────────────────────────────────────
// Button — override the brand background (primary) / border+text
// (outline, ghost) to blue. Secondary/danger keep shared styling.
// ─────────────────────────────────────────────────────────────
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
}

export function Button({ variant = 'primary', style, textStyle, ...rest }: ButtonProps) {
  // Blue overrides per variant, layered on top of the shared component's own style.
  let brandStyle: StyleProp<ViewStyle> | undefined;
  let brandTextStyle: StyleProp<TextStyle> | undefined;

  if (variant === 'primary') {
    brandStyle = { backgroundColor: colors.primary[500] };
  } else if (variant === 'outline') {
    brandStyle = { borderColor: colors.primary[500] };
    brandTextStyle = { color: colors.primary[500] };
  } else if (variant === 'ghost') {
    brandTextStyle = { color: colors.primary[500] };
  }

  return (
    <SharedButton
      variant={variant}
      {...rest}
      style={[brandStyle, style]}
      textStyle={[brandTextStyle, textStyle]}
    />
  );
}

// LoadingSpinner + StarRating accept a `color` prop — default it to blue so
// callers that don't pass one still render on-brand.
export function LoadingSpinner(props: React.ComponentProps<typeof SharedLoadingSpinner>) {
  return <SharedLoadingSpinner color={colors.primary[500]} {...props} />;
}
export function StarRating(props: React.ComponentProps<typeof SharedStarRating>) {
  return <SharedStarRating color={colors.primary[500]} {...props} />;
}

// ─────────────────────────────────────────────────────────────
// Re-export the rest of shared-ui verbatim so a single import line
// from this barrel works for vendor screens. (These either aren't
// brand-colored, or their orange is negligible; TextInput/Stepper/Badge bake
// the color into StyleSheet with no prop, so they'd need a shared-ui change to
// fully rebrand — deferred.)
// ─────────────────────────────────────────────────────────────
export {
  Card,
  StatusBadge,
  Badge,
  Avatar,
  TextInput,
  SearchBar,
  Stepper,
  EmptyState,
  useTheme,
  ThemeProvider,
} from '@prayana/shared-ui';
