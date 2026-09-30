import { Stack } from 'expo-router';
import { ThemeProvider, colors } from '@prayana/shared-ui';

// Holiday packages are themed blue rather than the app-wide orange.
//
// Re-pointing `colors.primary` inside the package screens only recolours what
// those files declare themselves. The shared-ui components they render —
// Stepper, Button, TextInput — paint from the theme's `brand` ramp, which is
// why the step rail and the Continue button stayed orange. ThemeProvider
// already supports a brand override (the vendor app passes blue), so scope it
// to this route group instead of prop-drilling a colour into every component.
export default function PackagesLayout() {
  return (
    <ThemeProvider brand={colors.accent}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
