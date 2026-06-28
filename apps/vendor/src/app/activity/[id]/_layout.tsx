import { Stack } from 'expo-router';
import { colors } from '@prayana/shared-ui';

export default function ActivityDetailLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="edit" />
      <Stack.Screen name="variants" />
      <Stack.Screen name="time-slots" />
      <Stack.Screen name="pricing" />
    </Stack>
  );
}
