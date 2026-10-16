// Careers → My applications. Port of the web's /careers/my-applications:
// list the candidate's own applications with status, and withdraw (which
// deletes the row and the stored resume). The server scopes every call to the
// caller's uid.
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import { makeAPICall } from '@prayana/shared-services';
import { InfoTopBar } from '../../components/common/InfoTopBar';
import { isGuest } from '../../lib/guestSession';
import { JobApplication, STATUS_STYLE, ApplicationStatus } from '../../lib/careers';

const TEAL = '#0d9488';

function formatDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MyApplicationsScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const signedIn = !isGuest(user);
  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const card = { backgroundColor: themeColors.surface, borderColor: line };

  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!signedIn) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      const res: any = await makeAPICall('/careers/my-applications');
      if (!res?.success) throw new Error(res?.message);
      setApps(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(err?.message || "Couldn't load your applications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signedIn]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const withdraw = (app: JobApplication) => {
    Alert.alert(
      'Withdraw application?',
      `This permanently deletes your application for ${app.roleTitle || 'this role'} and any resume you attached. This can't be undone.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            setBusyId(app._id);
            try {
              const res: any = await makeAPICall(`/careers/my-applications/${app._id}`, { method: 'DELETE' });
              if (!res?.success) throw new Error(res?.message);
              setApps((prev) => prev.filter((a) => a._id !== app._id));
              Toast.show({ type: 'success', text1: 'Application withdrawn', text2: 'Your data has been deleted.' });
            } catch (err: any) {
              Toast.show({ type: 'error', text1: "Couldn't withdraw", text2: err?.message || 'Please try again.' });
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: JobApplication }) => {
    const status = (item.status && STATUS_STYLE[item.status as ApplicationStatus] ? item.status : 'new') as ApplicationStatus;
    const st = STATUS_STYLE[status];
    const details = [
      { k: 'Name', v: item.fullName },
      { k: 'Phone', v: item.phone },
      { k: 'Location', v: item.location },
      { k: 'Experience', v: item.experience },
      { k: 'Available', v: item.availableFrom },
      { k: 'Resume', v: item.hasResume ? item.resume?.filename || 'Attached' : 'None' },
    ].filter((d) => d.v);
    return (
      <View style={[s.item, card]}>
        <View style={s.itemHead}>
          <View style={{ flex: 1 }}>
            <Text style={[s.itemTitle, { color: themeColors.text }]}>{item.roleTitle || item.roleSlug}</Text>
            <Text style={[s.itemDate, { color: themeColors.textTertiary }]}>Applied {formatDate(item.createdAt)}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: isDarkMode ? st.bgDark : st.bg }]}>
            <Text style={[s.badgeText, { color: st.fg }]}>{st.label}</Text>
          </View>
        </View>
        <View style={[s.grid, { borderTopColor: line }]}>
          {details.map((d) => (
            <View key={d.k} style={s.cell}>
              <Text style={[s.cellK, { color: themeColors.textTertiary }]}>{d.k}</Text>
              <Text style={[s.cellV, { color: themeColors.text }]} numberOfLines={1}>{d.v}</Text>
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => withdraw(item)}
          disabled={busyId === item._id}
          style={({ pressed }) => [s.withdraw, { borderColor: isDarkMode ? 'rgba(244,63,94,0.35)' : '#fecdd3' }, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          {busyId === item._id ? <ActivityIndicator size="small" color="#e11d48" /> : <Ionicons name="trash-outline" size={15} color="#e11d48" />}
          <Text style={s.withdrawText}>Withdraw application</Text>
        </Pressable>
      </View>
    );
  };

  const header = (
    <View style={{ gap: 12, marginBottom: 4 }}>
      <Text style={[s.lead, { color: themeColors.textSecondary }]}>
        Track the roles you've applied for. You control your data — withdrawing permanently deletes your application and resume.
      </Text>
      {error ? (
        <View style={[s.alert, { backgroundColor: isDarkMode ? 'rgba(244,63,94,0.12)' : '#fff1f2' }]}>
          <Ionicons name="alert-circle" size={16} color="#e11d48" />
          <Text style={s.alertText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );

  const empty = loading ? (
    <ActivityIndicator style={{ marginTop: 40 }} color={TEAL} />
  ) : (
    <View style={s.empty}>
      <Ionicons name={signedIn ? 'briefcase-outline' : 'lock-closed-outline'} size={34} color={themeColors.textTertiary} />
      <Text style={[s.emptyTitle, { color: themeColors.text }]}>
        {signedIn ? "You haven't applied yet" : 'Sign in to see your applications'}
      </Text>
      <Pressable
        onPress={() => (signedIn ? router.replace('/careers' as never) : router.push({ pathname: '/(auth)/login', params: { redirectTo: '/careers/my-applications' } } as never))}
        style={s.primary}
      >
        <Text style={s.primaryText}>{signedIn ? 'Browse open roles' : 'Sign in'}</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[s.safe, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <InfoTopBar title="My applications" />
      <FlatList
        data={apps}
        keyExtractor={(a) => a._id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={s.body}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          signedIn ? <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={TEAL} colors={[TEAL]} /> : undefined
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  lead: { fontSize: 14, lineHeight: 20 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12 },
  alertText: { flex: 1, color: '#e11d48', fontSize: 13.5, fontWeight: '600' },
  item: { borderWidth: 1, borderRadius: 18, padding: 16 },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemTitle: { fontSize: 16.5, fontWeight: '900' },
  itemDate: { fontSize: 12.5, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontSize: 11.5, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, rowGap: 10 },
  cell: { width: '50%', paddingRight: 8 },
  cellK: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  cellV: { fontSize: 13.5, fontWeight: '600', marginTop: 1 },
  withdraw: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 10, marginTop: 14 },
  withdrawText: { color: '#e11d48', fontSize: 13.5, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 10, paddingTop: 48 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  primary: { backgroundColor: TEAL, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12, marginTop: 6 },
  primaryText: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
});
