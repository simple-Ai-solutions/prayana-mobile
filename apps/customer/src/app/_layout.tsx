import { useEffect, useRef, useState } from 'react';
import { Platform, Linking } from 'react-native';
import { Stack, useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as SplashScreen from 'expo-splash-screen';
import * as ExpoNotifications from 'expo-notifications';
import Constants from 'expo-constants';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@prayana/shared-hooks';
import { setBaseURL, saveFcmToken, fetchUserProfile } from '@prayana/shared-services';
import { auth } from '@prayana/shared-services/src/firebase';
import { ThemeProvider, useTheme } from '@prayana/shared-ui';
import { setImageServerOrigin } from '@prayana/shared-utils';
import { ENV } from '../config/env';
import { queryClient } from '../lib/queryClient';
import { initSentry, setSentryUser } from '../lib/sentry';
import { resolveDeepLink } from '../lib/deepLinks';
import { useLiveNotifications, ensureNotificationPermission, alreadyShown, routeForLink } from '../lib/notifications';
import { topUpNudges } from '../lib/nudgeScheduler';
import { loadConsent } from '../lib/consent';
import { ConsentSheet } from '../components/consent/ConsentSheet';
import { setTrackingAllowed, identify } from '../lib/analytics';
import { makeGuestUser, isGuest } from '../lib/guestSession';
import { isPlaceholderName, isNameCompleteThisSession } from '../lib/userName';
import { readRedirect } from '../lib/authRedirect';
import { AnimatedSplash } from '../components/common/AnimatedSplash';

// Initialize crash reporting before any other code can crash.
initSentry();

// Keep splash screen visible while we load resources
SplashScreen.preventAutoHideAsync().catch(() => {});

// Configure how notifications appear when app is in foreground (global)
// A server push for an inbox item the socket already showed is kept quiet.
ExpoNotifications.setNotificationHandler({
  handleNotification: async (n) => {
    const data = n.request.content.data as { notificationId?: string } | undefined;
    const isPush = (n.request.trigger as { type?: string } | null)?.type === 'push';
    const show = !(isPush && alreadyShown(data?.notificationId));
    return {
      shouldShowAlert: show,
      shouldPlaySound: show,
      shouldSetBadge: true,
      shouldShowBanner: show,
      shouldShowList: true,
    };
  },
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

  // The bell's count and live in-app notifications.
  useLiveNotifications();
  // Guests get the daily travel nudges too, once notifications are allowed.
  useEffect(() => { topUpNudges(); }, []);

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
      // Ask once after sign-in; Android 13+ and iOS show nothing without it.
      if (!(await ensureNotificationPermission())) return;
      // Keep the next week of daily travel nudges scheduled on the phone.
      topUpNudges();

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
      // An app route wins; else the link, as a universal link or else mapped
      // the way the inbox maps it (community, bookings, eSIM…).
      if (data?.route) {
        router.push(data.route as never);
        return;
      }
      if (data?.url) {
        const route = resolveDeepLink(data.url) || routeForLink(data.url);
        if (route && route !== '/') router.push(route as never);
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
  // The sign-in screen's `redirectTo` (useRequireAuth's redirectAfter), so a
  // guest asked to sign in mid-booking lands back on that booking.
  const { redirectTo } = useGlobalSearchParams<{ redirectTo?: string }>();

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

    // Real (non-guest) signed-in user on an auth screen → on to where sign-in
    // was asked for, else home. This is the one place that navigates after
    // sign-in with a redirect; the sign-in screens leave it to this.
    if (!isGuest(user) && inAuthGroup) {
      router.replace((readRedirect(redirectTo) ?? '/(tabs)') as any);
    }
  }, [isAuthenticated, isLoading, segments, user, setUser, setIsAuthenticated, router, redirectTo]);

  return null;
}

// ── Name Gate ─────────────────────────────────────────────────
// A name is mandatory on every account (web parity: AuthGate +
// ProfileSetupModal). Phone-OTP signups arrive without one, and older accounts
// carry placeholders, so once per signed-in account we read the profile and
// send a nameless user to /complete-profile. Covers every sign-in path
// (phone, Google, email) and cold starts. A failed fetch never blocks the app.
function NameGate() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const checkedUid = useRef<string | null>(null);
  // Read when the fetch resolves, not when it starts: phone-login may have
  // already routed a new signup to the name screen in the meantime.
  const onNameScreen = useRef(false);
  onNameScreen.current = segments[0] === 'complete-profile';

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user?.uid || isGuest(user)) return;
    if (checkedUid.current === user.uid) return;
    checkedUid.current = user.uid;
    const uid = user.uid;
    (async () => {
      try {
        const res: any = await fetchUserProfile();
        const profile = res?.data?.profile;
        if (!profile) return; // unreachable / unexpected shape — don't block
        if (!isPlaceholderName(profile.name)) return;
        if (isNameCompleteThisSession(uid) || auth.currentUser?.uid !== uid) return;
        if (!onNameScreen.current) router.replace('/complete-profile' as never);
      } catch {
        // Backend unreachable: let them in; the check re-runs next launch.
      }
    })();
  }, [isAuthenticated, isLoading, user, router]);

  return null;
}

function RootNavigator() {
  const { isDarkMode } = useTheme();
  const { isLoading, user, isAuthenticated } = useAuth();
  const router = useRouter();

  // Once resources are ready, hide the native (static) splash and hand off to
  // the branded AnimatedSplash overlay — the mobile counterpart of the PWA's
  // cinematic launch animation. It fades itself out and clears showSplash.
  const [showSplash, setShowSplash] = useState(true);
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

  // No cross-app/site tracking: the app runs no ads and does no ad attribution,
  // so it does NOT show the App Tracking Transparency prompt (showing it while
  // declaring "no tracking" in App Privacy would be an App Store mismatch).
  // Analytics stays product-only (never linked to ad networks).
  // Analytics runs only if the person allowed it in Privacy choices (lib/consent).
  useEffect(() => {
    setTrackingAllowed(false);
    loadConsent();
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
      <NameGate />
      <PushNotificationManager />
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="complete-profile" options={{ gestureEnabled: false }} />
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
        {/* stays/_layout.tsx owns this group (search, property, checkout,
            booking), so the root registers the group, not each screen. */}
        <Stack.Screen name="stays" />
        {/* packages/_layout.tsx owns this group (it scopes the blue brand
            ramp), so the root registers the group, not each screen. */}
        <Stack.Screen name="packages" />
        <Stack.Screen name="transport/index" />
        <Stack.Screen name="outstation-cabs/index" />
        <Stack.Screen name="transport/[id]" />
        <Stack.Screen name="transport/checkout/[id]" />
        <Stack.Screen name="activities/index" />
        <Stack.Screen name="experiences/[slug]" />
        <Stack.Screen name="quick-itinerary/index" />
        <Stack.Screen name="quick-itinerary/result" />
        <Stack.Screen name="global-experiences/index" />
        <Stack.Screen name="india-experiences/index" />
        <Stack.Screen name="explore-nearby/index" />
        <Stack.Screen name="favorites/index" />
        <Stack.Screen name="captain-tours/index" />
        <Stack.Screen name="captain-tours/[slug]" />
        <Stack.Screen name="theme-itineraries/index" />
        <Stack.Screen name="travel-guides/index" />
        <Stack.Screen name="divya-darshana/index" />
        <Stack.Screen name="divya-darshana/packages" />
        <Stack.Screen name="profile/travel-preferences" />
        <Stack.Screen name="profile/favorites" />
        <Stack.Screen name="profile/membership" />
        <Stack.Screen name="profile/feedback" />
        <Stack.Screen name="profile/identity" />
        <Stack.Screen name="profile/payment-methods" />
        <Stack.Screen name="profile/notifications" />
        <Stack.Screen name="vip/index" />
        <Stack.Screen name="my-expenses/index" />
        <Stack.Screen name="monuments/index" />
        <Stack.Screen name="monuments/book" />
        <Stack.Screen name="monuments/my-tickets" />
      </Stack>
      {/* First-launch privacy choice, the app's cookie banner. */}
      <ConsentSheet />
      <Toast />
      {/* Cinematic launch animation (web/PWA parity). Sits on top until it
          fades itself out, then unmounts. Only after resources are ready so it
          doesn't compete with the native splash. */}
      {showSplash && !isLoading && <AnimatedSplash onDone={() => setShowSplash(false)} />}
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
