import { Stack } from 'expo-router';
import { colors } from '@prayana/shared-ui';

export default function BookingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
