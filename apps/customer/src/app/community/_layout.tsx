// app/community/_layout.tsx — Community stack navigator
import { Stack } from "expo-router";

export default function CommunityLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="ask" />
      <Stack.Screen name="visual" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
