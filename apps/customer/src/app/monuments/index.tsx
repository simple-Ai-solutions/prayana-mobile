// /monuments — search + results for ASI monument tickets over ONDC (TRV14).
// Mobile port of the web app/monuments/page.js. Fires ondcAPI.searchMonuments,
// polls for on_search, flattens providers[].items[] into cards. Tapping a card
// selects the item (ondcAPI.selectTicket → poll on_select) and routes to the
// booking wizard with the transactionId.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { ondcAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';

const ACCENT = '#4AC0CC';
const SAFFRON = '#E38B29'; // heritage accent for monuments

type MonumentItem = {
  providerId: string;
  providerName?: string;
  itemId: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  image?: string | null;
  location?: string;
};

// Flatten the ONDC on_search catalog (providers[].items[]) into flat cards.
function flattenCatalog(searchResults: any): MonumentItem[] {
  const providers = searchResults?.providers || searchResults?.['bpp/providers'] || [];
  const out: MonumentItem[] = [];
  (Array.isArray(providers) ? providers : []).forEach((p: any) => {
    const items = p?.items || [];
    (Array.isArray(items) ? items : []).forEach((it: any) => {
      out.push({
        providerId: p.id || p.providerId,
        providerName: p.descriptor?.name || p.name,
        itemId: it.id || it.itemId,
        name: it.descriptor?.name || it.name || 'Ticket',
        description: it.descriptor?.short_desc || it.description,
        price: Number(it.price?.value ?? it.price ?? 0) || undefined,
        currency: it.price?.currency || 'INR',
        image: it.descriptor?.images?.[0]?.url || it.descriptor?.images?.[0] || it.image || null,
        location: p.descriptor?.long_desc || it.location,
      });
    });
  });
  return out;
}

export default function MonumentsScreen() {
  const { themeColors } = useTheme();
  const { user } = useAuth();

  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [items, setItems] = useState<MonumentItem[]>([]);
  const [txnId, setTxnId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'searching' | 'results'>('idle');
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (!q.trim()) { Alert.alert('Enter a monument', 'Try “Taj Mahal”, “Red Fort”, “Qutub Minar”.'); return; }
    if (!user || (user as any).uid === 'guest-user') {
      Alert.alert('Sign in to continue', 'Please sign in to book monument tickets.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    setPhase('searching'); setSearched(true); setItems([]); setTxnId(null);
    try {
      const res: any = await ondcAPI.searchMonuments({ monumentName: q.trim(), city: city.trim() || undefined });
      if (!res?.success || !res?.transactionId) {
        Alert.alert('Search failed', res?.message || 'Please try again.');
        setPhase('idle'); return;
      }
      const txn: any = await ondcAPI.pollForCallback(res.transactionId, 'on_search');
      if (!txn) {
        Alert.alert('No response yet', 'The ticketing network is slow right now. Please try again.');
        setPhase('idle'); return;
      }
      setTxnId(res.transactionId); // same txn carries through select→init→confirm
      setItems(flattenCatalog(txn.searchResults));
      setPhase('results');
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message || 'Please try again.');
      setPhase('idle');
    }
  }, [q, city, user]);

  // Hand off to the booking wizard, which owns select→init→confirm against the
  // SAME transactionId the search produced (a new search would orphan the item).
  const select = useCallback((item: MonumentItem) => {
    if (!txnId) { Alert.alert('Please search again', 'Your session expired — re-run the search.'); return; }
    router.push({
      pathname: '/monuments/book',
      params: {
        transactionId: txnId,
        providerId: item.providerId,
        itemId: item.itemId,
        name: item.name,
        price: String(item.price ?? ''),
        currency: item.currency || 'INR',
        monumentName: q.trim(),
      },
    } as any);
  }, [txnId, q]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Monument Tickets</Text>
        <TouchableOpacity onPress={() => router.push('/monuments/my-tickets' as any)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ticket-outline" size={22} color={themeColors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={[styles.searchCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <View style={[styles.field, { borderColor: themeColors.border }]}>
            <Ionicons name="business-outline" size={18} color={themeColors.textSecondary} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Monument (e.g. Taj Mahal)"
              placeholderTextColor={themeColors.textSecondary}
              style={[styles.input, { color: themeColors.text }]}
              returnKeyType="search"
              onSubmitEditing={search}
            />
          </View>
          <View style={[styles.field, { borderColor: themeColors.border }]}>
            <Ionicons name="location-outline" size={18} color={themeColors.textSecondary} />
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="City (optional)"
              placeholderTextColor={themeColors.textSecondary}
              style={[styles.input, { color: themeColors.text }]}
              returnKeyType="search"
              onSubmitEditing={search}
            />
          </View>
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: SAFFRON, opacity: phase === 'searching' ? 0.7 : 1 }]}
            onPress={search}
            disabled={phase === 'searching'}
          >
            {phase === 'searching'
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.searchBtnText}>Search Tickets</Text>}
          </TouchableOpacity>
        </View>

        {phase === 'searching' && (
          <View style={styles.note}>
            <ActivityIndicator size="small" color={SAFFRON} />
            <Text style={[styles.noteText, { color: themeColors.textSecondary }]}>
              Asking the ONDC network for live availability…
            </Text>
          </View>
        )}

        {phase !== 'searching' && searched && items.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={40} color={themeColors.textSecondary} />
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              No tickets found. Try the exact monument name or add a city.
            </Text>
          </View>
        )}

        {items.map((item, i) => (
          <TouchableOpacity
            key={`${item.itemId}-${i}`}
            activeOpacity={0.85}
            style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            onPress={() => select(item)}
          >
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.cardImg} />
            ) : (
              <View style={[styles.cardImg, styles.cardImgPh, { backgroundColor: themeColors.border }]}>
                <Ionicons name="business" size={22} color={themeColors.textSecondary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={1}>{item.name}</Text>
              {!!item.providerName && (
                <Text style={[styles.cardSub, { color: themeColors.textSecondary }]} numberOfLines={1}>{item.providerName}</Text>
              )}
              {item.price != null && (
                <Text style={[styles.cardPrice, { color: SAFFRON }]}>
                  ₹{item.price.toLocaleString('en-IN')}<Text style={[styles.cardPer, { color: themeColors.textSecondary }]}> /person</Text>
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },

  searchCard: { borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.md, gap: spacing.sm },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: fontSize.md },
  searchBtn: { borderRadius: 999, alignItems: 'center', paddingVertical: 13, marginTop: 2 },
  searchBtnText: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.md },

  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, justifyContent: 'center' },
  noteText: { fontSize: fontSize.sm },

  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing['3xl'] },
  emptyText: { fontSize: fontSize.sm, textAlign: 'center', maxWidth: 260 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.md,
  },
  cardImg: { width: 56, height: 56, borderRadius: 12 },
  cardImgPh: { alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  cardSub: { fontSize: fontSize.xs, marginTop: 2 },
  cardPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: 4 },
  cardPer: { fontSize: fontSize.xs, fontWeight: fontWeight.normal },
});
