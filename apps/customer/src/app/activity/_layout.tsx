import { Stack } from 'expo-router';

export default function ActivityLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="book" />
      <Stack.Screen name="reviews/[id]" />
    </Stack>
  );
}
