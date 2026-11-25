import { Stack } from 'expo-router';

// Packages share the app-wide orange; they used to override the brand to blue,
// which made Book Now / Pay a different colour from every other screen.
export default function PackagesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
