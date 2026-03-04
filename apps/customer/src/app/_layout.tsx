import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as ExpoNotifications from 'expo-notifications';
import Constants from 'expo-constants';
import { AuthProvider, useAuth } from '@prayana/shared-hooks';
import { setBaseURL, saveFcmToken } from '@prayana/shared-services';
import { ThemeProvider, useTheme } from '@prayana/shared-ui';
import { setImageServerOrigin } from '@prayana/shared-utils';

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

// Set API URL immediately at module load time (before any component renders)
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.31.185:5000/api';
setBaseURL(API_URL);
// Set image server origin for resolving relative proxy URLs in React Native
// Strip "/api" suffix to get the server origin (e.g. "http://192.168.31.185:5000")
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
        lightColor: '#2EC4B6',
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

    // Try registering silently (only if already permitted)
    (async () => {
      const { status } = await ExpoNotifications.getPermissionsAsync();
      if (status === 'granted') {
        try {
          const projectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId;
          const tokenData = projectId
            ? await ExpoNotifications.getExpoPushTokenAsync({ projectId })
            : await ExpoNotifications.getExpoPushTokenAsync();

          const device = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
          await saveFcmToken(tokenData.data, device).catch(() => {});
          tokenRegistered.current = true;
        } catch {
          // Token registration failed silently
        }
      }
    })();

    // Foreground: show toast for received notifications
    notifListener.current = ExpoNotifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      Toast.show({ type: 'info', text1: title || 'Notification', text2: body || '', visibilityTime: 4000 });
    });

    // Background/killed: user tapped notification → deep link
    responseListener.current = ExpoNotifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.route) {
        router.push(data.route);
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
function AuthGuard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    // Guest users can still navigate freely — they're "authenticated" but not real
    const isGuest = user?.uid === 'guest-user';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && !isGuest && inAuthGroup) {
      // Only redirect real signed-in users away from auth screens
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, user]);

  return null;
}

function RootNavigator() {
  const { isDarkMode } = useTheme();

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
        <Stack.Screen name="hotels/index" />
        <Stack.Screen name="activities/index" />
        <Stack.Screen name="profile/travel-preferences" />
        <Stack.Screen name="profile/favorites" />
        <Stack.Screen name="profile/membership" />
        <Stack.Screen name="profile/feedback" />
      </Stack>
      <Toast />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <RootNavigator />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </AuthProvider>
    </ThemeProvider>
  );
}
