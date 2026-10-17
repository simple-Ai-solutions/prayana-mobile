import { Stack } from 'expo-router';

// Stays (hotels, homestays, hostels, resorts, villas): search → property →
// checkout → booking/voucher. The group keeps the app-wide orange brand, so
// unlike packages/_layout.tsx there is no ThemeProvider override here — a
// nested provider would also start its own dark-mode state.
export default function StaysLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
