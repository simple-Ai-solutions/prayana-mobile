import { useEffect } from 'react';
import { Linking, LogBox } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@prayana/shared-hooks';
import { ThemeProvider, useTheme } from '@prayana/shared-ui';
import { colors as vendorColors } from '../theme/vendorColors';
import { setBaseURL } from '@prayana/shared-services';
import { ENV } from '../config/env';
import { queryClient } from '../lib/queryClient';
import { initSentry, setSentryUser } from '../lib/sentry';
import { resolveDeepLink } from '../lib/deepLinks';

// Suppress the on-screen LogBox overlay (dev-only, pinned at the bottom).
// User-facing errors are surfaced via top toasts; the bottom LogBox is just
// redundant dev noise, so notifications only appear at the top.
LogBox.ignoreAllLogs();

// Initialize crash reporting before anything else can crash.
initSentry();

// Set API URL immediately at module load time (before any component renders).
const API_URL = ENV.apiUrl;
setBaseURL(API_URL);
console.log('[VendorApp] API URL set to:', API_URL);

function AuthGuard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Unauthenticated users go straight to sign-in. The marketing hero lives
      // on the web /business page; someone who already installed the app just
      // needs to get in. Signup is reachable from login's "Register your
      // business" link.
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  // Tag Sentry with the current vendor.
  useEffect(() => {
    if (isAuthenticated && user?.uid) {
      setSentryUser(user.uid, user.email);
    } else {
      setSentryUser(null);
    }
  }, [isAuthenticated, user?.uid, user?.email]);

  // Deep links (custom scheme prayanabiz:// or universal business.prayanaai.com/app/...)
  useEffect(() => {
    let mounted = true;
    Linking.getInitialURL()
      .then((url) => {
        if (!mounted || !url) return;
        const route = resolveDeepLink(url);
        if (route && route !== '/') router.push(route as never);
      })
      .catch(() => {});

    const sub = Linking.addEventListener('url', (event) => {
      const route = resolveDeepLink(event.url);
      if (route && route !== '/') router.push(route as never);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [router]);

  return null;
}

function RootNavigator() {
  const { isDarkMode } = useTheme();
  return (
    <>
      <AuthGuard />
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="booking" />
        <Stack.Screen name="analytics" />
        <Stack.Screen name="quality" />
        <Stack.Screen name="messaging" />
        <Stack.Screen name="earnings" />
        <Stack.Screen name="reviews" />
        <Stack.Screen name="support" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="finance" />
        <Stack.Screen name="payout" />
        <Stack.Screen name="performance" />
        <Stack.Screen name="coupons" />
        <Stack.Screen name="verification" />
        <Stack.Screen name="packages" />
        <Stack.Screen name="transport" />
        <Stack.Screen name="drivers" />
      </Stack>
      <Toast />
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider brand={vendorColors.primary}>
        <AuthProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
              <RootNavigator />
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
