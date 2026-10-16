// Joining someone else's trip from a link — the phone version of the web's
// app/trip/share/[shareToken]/page.js and app/trip/invite/[token]/page.js.
//
//   share:  GET  /api/share/:shareToken/join   (InviteSheet's share link)
//   invite: POST /api/invites/:token/accept    (the emailed invite)
//
// Both need a signed-in (non-guest) user and cost 5 Planner Credits; a 402
// INSUFFICIENT_PLANNER_CREDITS gets its own state with ways to earn more, as on
// the web. On success the server returns the whole trip, which is loaded into
// the trip store and opened in the planner (the web opens /create-trip).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, useTheme } from '@prayana/shared-ui';
import { makeAPICall, getAuthToken } from '@prayana/shared-services';
import { useCreateTripStore } from '@prayana/shared-stores';
import { useAuth } from '@prayana/shared-hooks';
import { isGuest } from '../../lib/guestSession';
import { useRequireAuth } from '../../lib/useRequireAuth';
import { useGoBack } from '../../lib/goBack';

type Mode = 'share' | 'invite';
type Status = 'loading' | 'login' | 'working' | 'success' | 'error' | 'needs_credits';

const COPY = {
  share: {
    loginBody: 'Sign in to join this trip and start collaborating with your travel buddies.',
    loginCta: 'Sign In to Join Trip',
    working: 'Joining Trip...',
    workingMsg: 'Joining trip...',
    success: 'Success!',
    failed: 'Unable to Join Trip',
  },
  invite: {
    loginBody: 'Sign in to accept this invite and start collaborating with your travel buddies.',
    loginCta: 'Sign In to Accept Invite',
    working: 'Accepting Invite...',
    workingMsg: 'Accepting invite...',
    success: "You're In!",
    failed: 'Unable to Accept Invite',
  },
} as const;

const ACCENT = colors.primary[500];

export function TripJoinScreen({ mode, token }: { mode: Mode; token: string }) {
  const router = useRouter();
  const goBack = useGoBack('/(tabs)');
  const requireAuth = useRequireAuth();
  const { themeColors } = useTheme();
  const { user, isLoading: authLoading } = useAuth();
  const loadTrip = useCreateTripStore((s: any) => s.loadTrip);
  const copy = COPY[mode];

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Loading...');
  const [credits, setCredits] = useState<{ balance: number; required: number } | null>(null);
  const attempted = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const signedIn = !isGuest(user);
  const redirectAfter = `/trip/${mode}/${encodeURIComponent(token)}`;

  const openTrip = useCallback((trip: any, delay: number) => {
    setTimeout(() => {
      if (!alive.current) return;
      if (trip && (trip.tripId || trip._id)) {
        loadTrip({ ...trip, tripId: trip.tripId || trip._id });
        router.replace('/trip/planner' as any);
      } else {
        router.replace('/(tabs)/trips' as any);
      }
    }, delay);
  }, [loadTrip, router]);

  const call = useCallback(async () => {
    // The web sends the ID token as a query param too, since a proxy in front
    // of the API has been seen to strip Authorization.
    const idToken = await getAuthToken().catch(() => null);
    const qs = idToken ? `?token=${encodeURIComponent(idToken)}` : '';
    const t = encodeURIComponent(token);
    return mode === 'share'
      ? makeAPICall(`/share/${t}/join${qs}`)
      : makeAPICall(`/invites/${t}/accept${qs}`, { method: 'POST', body: JSON.stringify({}) });
  }, [mode, token]);

  const join = useCallback(async () => {
    setStatus('working');
    setMessage(copy.workingMsg);
    setCredits(null);
    let res: any;
    try {
      try {
        res = await call();
      } catch (err: any) {
        // A stale token: retry once, as the web does.
        if (err?.status !== 401) throw err;
        await new Promise((r) => setTimeout(r, 1000));
        res = await call();
      }
      if (!alive.current) return;
      if (res?.success) {
        setStatus('success');
        setMessage('Successfully joined trip! Redirecting...');
        openTrip(res.trip, 1200);
      } else {
        setStatus('error');
        setMessage(res?.message || (mode === 'share' ? 'Failed to join trip' : 'Failed to accept invite'));
      }
    } catch (err: any) {
      if (!alive.current) return;
      const code = err?.status;
      const data = err?.data || {};
      if (code === 402 && data.code === 'INSUFFICIENT_PLANNER_CREDITS') {
        setCredits({ balance: data.balance ?? 0, required: data.required ?? 5 });
        setStatus('needs_credits');
        setMessage(data.message || 'Not enough Planner Credits to join.');
        return;
      }
      if (code === 401) {
        setStatus('login');
        setMessage('Authentication failed. Please sign in again.');
        attempted.current = false;
        return;
      }
      setStatus('error');
      const msg: string | undefined = data.message;
      if (code === 404) {
        setMessage(mode === 'share'
          ? 'Trip not found or link is invalid'
          : 'Invite not found or has expired. Ask the trip owner to send a new one.');
      } else if (code === 400) {
        if (mode === 'share' && msg?.includes('owner')) {
          setMessage('You are the owner of this trip. Redirecting...');
          openTrip(data.trip, 1500);
        } else if (mode === 'invite' && msg?.includes('already a collaborator')) {
          setMessage("You're already a collaborator on this trip. Redirecting...");
          if (data.trip) openTrip(data.trip, 1500);
        } else if (mode === 'invite' && msg?.includes('expired')) {
          setMessage('This invite has expired. Ask the trip owner for a new invite.');
        } else {
          setMessage(msg || (mode === 'share' ? 'Share link has expired' : 'Unable to accept invite'));
        }
      } else {
        setMessage(mode === 'share' ? 'Failed to join trip. Please try again.' : 'Failed to accept invite. Please try again.');
      }
    }
  }, [call, copy, mode, openTrip]);

  // Join as soon as there is a real signed-in user — including the moment
  // they come back from the login screen.
  useEffect(() => {
    if (authLoading) {
      setStatus('loading');
      setMessage('Checking authentication...');
      return;
    }
    if (!signedIn) {
      setStatus('login');
      setMessage(mode === 'share' ? 'Sign in to join this trip' : 'Sign in to accept this invite');
      attempted.current = false;
      return;
    }
    if (!attempted.current && token) {
      attempted.current = true;
      join();
    }
  }, [authLoading, signedIn, token, join, mode]);

  const signIn = () => {
    if (requireAuth({ title: 'Sign in to join', reason: copy.loginBody, redirectAfter })) {
      attempted.current = true;
      join();
    }
  };

  const goHome = () => router.replace('/(tabs)' as any);

  const card = { backgroundColor: themeColors.surface, borderColor: themeColors.border };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={themeColors.text} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, card]}>
          {status === 'login' ? (
            <>
              <View style={[styles.iconCircle, { backgroundColor: ACCENT + '1f' }]}>
                <Ionicons name="location" size={30} color={ACCENT} />
              </View>
              <Text style={[styles.title, { color: themeColors.text }]}>You've been invited to a trip!</Text>
              <Text style={[styles.body, { color: themeColors.textSecondary }]}>{copy.loginBody}</Text>
              <View style={styles.creditNote}>
                <Ionicons name="sparkles" size={13} color="#b45309" />
                <Text style={styles.creditNoteText}>Joining costs 5 Planner Credits (you get 100 free at signup)</Text>
              </View>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: ACCENT }]} onPress={signIn} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>{copy.loginCta}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={goHome} style={styles.linkBtn}>
                <Text style={[styles.linkText, { color: themeColors.textSecondary }]}>Go to Home</Text>
              </TouchableOpacity>
            </>
          ) : status === 'needs_credits' ? (
            <>
              <View style={[styles.iconCircle, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="sparkles" size={30} color="#d97706" />
              </View>
              <Text style={[styles.title, { color: themeColors.text }]}>Need a few more credits</Text>
              <Text style={[styles.body, { color: themeColors.textSecondary }]}>
                Joining costs <Text style={styles.bold}>{credits?.required ?? 5}</Text> Planner Credits. You currently have{' '}
                <Text style={styles.bold}>{credits?.balance ?? 0}</Text>.
              </Text>
              <View style={styles.earnBox}>
                <Text style={styles.earnHead}>THREE WAYS TO EARN MORE</Text>
                <Text style={styles.earnLine}>• Complete a booking — up to 40 credits per trip</Text>
                <Text style={styles.earnLine}>• Refer a friend — 50 credits when they sign up</Text>
                <Text style={styles.earnLine}>• Get VIP — 500 credits + unlimited Quick Itineraries</Text>
              </View>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#c026d3' }]} onPress={() => router.push('/vip' as any)} activeOpacity={0.85}>
                <Ionicons name="diamond" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Get VIP — ₹999/year</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#059669', marginTop: 10 }]} onPress={() => router.push('/profile/refer' as any)} activeOpacity={0.85}>
                <Ionicons name="people" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Refer a friend</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={goHome} style={styles.linkBtn}>
                <Text style={[styles.linkText, { color: themeColors.textSecondary }]}>Go to Home</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {status === 'loading' || status === 'working' ? (
                <ActivityIndicator size="large" color={ACCENT} style={{ marginBottom: 18 }} />
              ) : (
                <View style={[styles.iconCircle, { backgroundColor: status === 'success' ? '#dcfce7' : '#fee2e2' }]}>
                  <Ionicons name={status === 'success' ? 'checkmark' : 'close'} size={34} color={status === 'success' ? '#16a34a' : '#dc2626'} />
                </View>
              )}
              <Text style={[styles.title, { color: status === 'error' ? '#dc2626' : status === 'success' ? '#16a34a' : themeColors.text }]}>
                {status === 'loading'
                  ? (mode === 'share' ? 'Loading Trip...' : 'Loading Invite...')
                  : status === 'working' ? copy.working
                  : status === 'success' ? copy.success
                  : copy.failed}
              </Text>
              <Text style={[styles.body, { color: themeColors.textSecondary }]}>{message}</Text>
              {status === 'error' ? (
                <>
                  <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: ACCENT }]} onPress={() => { attempted.current = true; join(); }} activeOpacity={0.85}>
                    <Text style={styles.primaryBtnText}>Try Again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.outlineBtn, { borderColor: themeColors.border }]} onPress={goHome} activeOpacity={0.85}>
                    <Text style={[styles.outlineBtnText, { color: themeColors.text }]}>Go to Home</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingHorizontal: 12, paddingVertical: 6 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 16, paddingBottom: 48 },
  card: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 22, paddingVertical: 32, alignItems: 'center' },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  body: { fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginBottom: 16 },
  bold: { fontWeight: '800' },
  creditNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20, paddingHorizontal: 8 },
  creditNoteText: { fontSize: 12, color: '#b45309', flexShrink: 1, textAlign: 'center' },
  earnBox: { alignSelf: 'stretch', backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 18 },
  earnHead: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: '#b45309', marginBottom: 8 },
  earnLine: { fontSize: 13, lineHeight: 20, color: '#92400e' },
  primaryBtn: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  outlineBtn: { alignSelf: 'stretch', alignItems: 'center', borderRadius: 14, paddingVertical: 14, borderWidth: 1, marginTop: 10 },
  outlineBtnText: { fontSize: 15, fontWeight: '600' },
  linkBtn: { marginTop: 14, padding: 4 },
  linkText: { fontSize: 13.5 },
});
