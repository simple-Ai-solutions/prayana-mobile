import { Stack } from 'expo-router';
import { useIsha } from '../../components/chat/ishaTheme';

export default function ChatLayout() {
  // Isha's own background, so the slide-in never flashes the wrong colour in dark mode
  const t = useIsha();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.bg },
        animation: 'slide_from_bottom',
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
