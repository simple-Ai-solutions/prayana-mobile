import { Stack } from 'expo-router';

export default function TripLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="plan" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="setup" />
      <Stack.Screen name="destinations" />
      <Stack.Screen name="planner" />
      <Stack.Screen name="search-activity" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="review" />
      <Stack.Screen name="itinerary" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
