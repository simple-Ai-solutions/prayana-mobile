import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@prayana/shared-hooks';
import { isGuest } from './guestSession';

/**
 * Hook to gate any action behind a real (non-guest) signed-in user.
 *
 * Usage:
 *   const requireAuth = useRequireAuth();
 *
 *   const handleBook = () => {
 *     if (!requireAuth({ reason: 'Sign in to book this activity.' })) return;
 *     // ...proceed with booking
 *   };
 *
 * Returns `true` if the user is a real signed-in user (caller can proceed).
 * Returns `false` if the user is a guest — also shows a sign-in prompt that
 * navigates to the login screen on confirm.
 */
type RequireAuthOptions = {
  /** Title of the prompt. Default: "Sign in required". */
  title?: string;
  /** Body of the prompt. Default: "Sign in to continue." */
  reason?: string;
  /** Where to land after a successful sign-in. Defaults to current screen. */
  redirectAfter?: string;
};

export function useRequireAuth() {
  const { user } = useAuth();
  const router = useRouter();

  return useCallback(
    (options: RequireAuthOptions = {}): boolean => {
      if (!isGuest(user)) return true;

      const {
        title = 'Sign in required',
        reason = 'Sign in to continue. Your booking, saved places, and trips are tied to your account.',
        redirectAfter,
      } = options;

      Alert.alert(title, reason, [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Sign in',
          onPress: () => {
            // Pass the desired post-login route via params so login can route back.
            const params = redirectAfter ? { redirectTo: redirectAfter } : undefined;
            router.push({ pathname: '/(auth)/login', params } as never);
          },
        },
      ]);
      return false;
    },
    [user, router],
  );
}
