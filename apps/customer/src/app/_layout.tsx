import { useEffect, useRef } from 'react';
import { Platform, Linking } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as SplashScreen from 'expo-splash-screen';
import * as ExpoNotifications from 'expo-notifications';
import Constants from 'expo-constants';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@prayana/shared-hooks';
import { setBaseURL, saveFcmToken } from '@prayana/shared-services';
import { ThemeProvider, useTheme } from '@prayana/shared-ui';
import { setImageServerOrigin } from '@prayana/shared-utils';
import { ENV } from '../config/env';
import { queryClient } from '../lib/queryClient';
import { initSentry, setSentryUser } from '../lib/sentry';
import { resolveDeepLink } from '../lib/deepLinks';
import { setTrackingAllowed, identify } from '../lib/analytics';
import { makeGuestUser, isGuest } from '../lib/guestSession';

// Initialize crash reporting before any other code can crash.
initSentry();

// Keep splash screen visible while we load resources
SplashScreen.preventAutoHideAsync().catch(() => {});

// Configure how notifications appear when app is in foreground (global)
ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Set API URL immediately at module load time (before any component renders).
// Source of truth: src/config/env.ts (validated EXPO_PUBLIC_* vars).
const API_URL = ENV.apiUrl;
setBaseURL(API_URL);
// Strip "/api" suffix so the image origin resolver gets just the server root.
setImageServerOrigin(API_URL.replace(/\/api\/?$/, ''));
console.log('[App] API URL set to:', API_URL);

// ── Push notification manager ──────────────────────────────
// Runs once after the user signs in. Registers for push tokens and wires
// up foreground/background notification listeners app-wide.
function PushNotificationManager() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const notifListener = useRef<ExpoNotifications.EventSubscription | null>(null);
  const responseListener = useRef<ExpoNotifications.EventSubscription | null>(null);
  const tokenRegistered = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.uid || user.uid === 'guest-user') return;
    if (tokenRegistered.current) return;

    // Android: create notification channels
    if (Platform.OS === 'android') {
      ExpoNotifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: ExpoNotifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#f97316',
      });
      ExpoNotifications.setNotificationChannelAsync('bookings', {
        name: 'Booking Updates',
        importance: ExpoNotifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#059669',
        sound: 'default',
      });
      ExpoNotifications.setNotificationChannelAsync('trips', {
        name: 'Trip Reminders',
        importance: ExpoNotifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500],
        lightColor: '#8b5cf6',
      });
    }

    // Try registering silently (only if already permitted).
    // In dev builds where the EAS projectId is a placeholder, skip — getExpoPushTokenAsync
    // throws if the projectId is invalid, and we want push errors out of dev noise.
    (async () => {
      const { status } = await ExpoNotifications.getPermissionsAsync();
      if (status !== 'granted') return;

      const projectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId;
      const validProjectId =
        typeof projectId === 'string' &&
        projectId &&
        !projectId.startsWith('REPLACE_WITH');

      if (!validProjectId && !__DEV__) {
        // Production build with no projectId is a misconfiguration.
        console.warn('[Push] EAS projectId not set — push token registration skipped.');
        return;
      }

      try {
        const tokenData = validProjectId
          ? await ExpoNotifications.getExpoPushTokenAsync({ projectId })
          : await ExpoNotifications.getExpoPushTokenAsync();

        const device =
          Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
        await saveFcmToken(tokenData.data, device).catch(() => {});
        tokenRegistered.current = true;
      } catch (err) {
        // Don't crash the app on push registration failure — log for Sentry.
        console.warn('[Push] token registration failed:', (err as Error)?.message);
      }
    })();

    // Foreground: show toast for received notifications
    notifListener.current = ExpoNotifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      Toast.show({ type: 'info', text1: title || 'Notification', text2: body || '', visibilityTime: 4000 });
    });

    // Background/killed: user tapped notification → resolve & deep-link.
    // Push payloads can carry either a relative `route` (e.g. "/bookings/abc")
    // or a full url (e.g. "https://prayanaai.com/app/bookings/abc"). We
    // run them through the same resolver as universal links to be consistent.
    responseListener.current = ExpoNotifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { route?: string; url?: string };
      if (data?.url) {
        const route = resolveDeepLink(data.url);
        if (route && route !== '/') {
          router.push(route as never);
          return;
        }
      }
      if (data?.route) {
        router.push(data.route as never);
      }
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isAuthenticated, user?.uid]);

  return null;
}

// ── Auth Guard ────────────────────────────────────────────────
// Behaviour: web-parity guest browsing. Users land on the home tab without
// being forced to log in. Gated actions (book, save, chat, profile-only screens)
// call requireAuth() from `lib/requireAuth` which prompts a sign-in.
//
// Apple App Store guideline 5.1.1 (v) requires this for non-purchase content.
function AuthGuard() {
  const { isAuthenticated, isLoading, user, setUser, setIsAuthenticated } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated) {
      // First launch / signed out: auto-create a guest session so the user
      // lands on the home tab. They can sign in later from the profile tab
      // or via requireAuth() prompts on gated actions.
      if (!inAuthGroup) {
        setUser(makeGuestUser());
        setIsAuthenticated(true);
      }
      return;
    }

    // Real (non-guest) signed-in user lands on auth screen → push them home.
    if (!isGuest(user) && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, user, setUser, setIsAuthenticated, router]);

  return null;
}

function RootNavigator() {
  const { isDarkMode } = useTheme();
  const { isLoading, user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  // Tag Sentry + analytics with the current user so events are attributable.
  useEffect(() => {
    if (isAuthenticated && user?.uid && user.uid !== 'guest-user') {
      setSentryUser(user.uid, user.email);
      identify(user.uid, { method: user?.providerData?.[0]?.providerId });
    } else {
      setSentryUser(null);
    }
  }, [isAuthenticated, user?.uid, user?.email]);

  // iOS App Tracking Transparency. Apple guideline: don't show the prompt
  // immediately on launch — wait until the app has been in foreground briefly.
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      setTrackingAllowed(true);
      return;
    }
    const t = setTimeout(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const ATT = require('expo-tracking-transparency');
        const { status } = await ATT.requestTrackingPermissionsAsync();
        setTrackingAllowed(status === 'granted');
      } catch {
        // Module not linked yet (first dev build) — keep tracking off.
        setTrackingAllowed(false);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  // Deep link handling — works for both custom scheme (prayana://...) and
  // universal links (https://prayanaai.com/app/...). Cold-start case uses
  // getInitialURL; warm-start uses the addEventListener subscription.
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

  return (
    <>
      <AuthGuard />
      <PushNotificationManager />
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="trip" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="bookings" />
        <Stack.Screen name="search" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="chat" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="destination" />
        <Stack.Screen name="interest/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="place" />
        <Stack.Screen name="place-detail" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="esim/index" />
        <Stack.Screen name="esim/checkout/[bundle]" />
        <Stack.Screen name="esim/my-orders/index" />
        <Stack.Screen name="hotels/index" />
        <Stack.Screen name="packages/index" />
        <Stack.Screen name="packages/[id]" />
        <Stack.Screen name="packages/checkout/[id]" />
        <Stack.Screen name="transport/index" />
        <Stack.Screen name="transport/[id]" />
        <Stack.Screen name="transport/checkout/[id]" />
        <Stack.Screen name="activities/index" />
        <Stack.Screen name="profile/travel-preferences" />
        <Stack.Screen name="profile/favorites" />
        <Stack.Screen name="profile/membership" />
        <Stack.Screen name="profile/feedback" />
        <Stack.Screen name="profile/identity" />
        <Stack.Screen name="profile/payment-methods" />
        <Stack.Screen name="profile/notifications" />
      </Stack>
      <Toast />
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
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
