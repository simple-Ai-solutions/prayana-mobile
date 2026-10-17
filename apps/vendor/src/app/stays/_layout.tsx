import { Stack } from 'expo-router';

// Stays: My properties → onboarding wizard ([id]) → rates & availability,
// calendar sync, bookings and reviews.
export default function StaysLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      {/* Back inside the wizard steps back through it; the iOS edge swipe
          can't be redirected like that, so it's off there. */}
      <Stack.Screen name="[id]/index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="[id]/calendar" />
      <Stack.Screen name="[id]/sync" />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="reviews" />
    </Stack>
  );
}
