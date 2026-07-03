import { Stack } from 'expo-router';
import { colors } from '@prayana/shared-ui';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_bottom',
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
