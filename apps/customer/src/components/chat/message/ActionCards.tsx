import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { favoritesAPI } from '@prayana/shared-services';
import { useIsha } from '../ishaTheme';
import { goToLogin, openHref, qs } from '../links';
import type { ActionCard } from '../types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const ICONS: Record<string, IconName> = {
  view_itinerary: 'map-outline',
  buy_esim: 'phone-portrait-outline',
  save_favorite: 'heart-outline',
  confirm_booking: 'ticket-outline',
  book_cab: 'car-outline',
  book_captain_tour: 'people-outline',
  book_package: 'cube-outline',
};

/**
 * One-tap cards the agent set up (book, buy, save). They never act on their
 * own: each opens the screen where the user confirms, signs in or pays,
 * already filled with what the agent gathered (date, travellers, variant…).
 */
export default function ActionCards({
  cards,
  isAuthenticated,
  onOpenItinerary,
}: {
  cards?: ActionCard[];
  isAuthenticated: boolean;
  onOpenItinerary?: (card: ActionCard) => void;
}) {
  const t = useIsha();
  const router = useRouter();
  const list = (cards || []).filter((c) => c && c.type !== 'trip_choices');
  if (!list.length) return null;

  const go = (href: string) => router.push(href as never);

  const run = async (card: ActionCard) => {
    try {
      if (card.type === 'view_itinerary') {
        onOpenItinerary?.(card);
        return;
      }
      if (card.requiresAuth && !isAuthenticated) {
        goToLogin(router);
        return;
      }
      const d = card.data || {};
      switch (card.type) {
        case 'buy_esim':
          if (!isAuthenticated) {
            goToLogin(router);
            return;
          }
          if (d.bundleName) go(`/esim/checkout/${encodeURIComponent(d.bundleName)}${qs({ country: d.countryCode || d.country })}`);
          else go(/^[a-z]{2}$/i.test(d.countryCode || '') ? `/esim/${String(d.countryCode).toUpperCase()}` : '/esim');
          break;
        case 'save_favorite': {
          if (!isAuthenticated) {
            goToLogin(router);
            return;
          }
          const result = await favoritesAPI.addFavorite({
            placeId: d.placeId,
            placeName: d.placeName,
            placeImage: d.placeImage,
            placeLocation: d.placeLocation,
            placeData: d.placeData,
          });
          if (result?.success) Toast.show({ type: 'success', text1: `Saved ${d.placeName || ''}`.trim() });
          else Toast.show({ type: 'error', text1: result?.error === 'Already in favorites' ? 'Already saved' : "Couldn't save that. Try again." });
          break;
        }
        case 'book_cab':
          // The cab screen collects name, phone and payment: chat never books
          go(`/outstation-cabs${qs({
            fromText: d.from || d.fromText,
            toText: d.to || d.toText,
            date: d.departureDate || d.date,
            time: d.pickupTime || d.time,
          })}`);
          break;
        case 'book_captain_tour': {
          // Group trips need every traveller's details, so the screen collects them
          const slug = d.tourSlug || d.slug || (typeof d.url === 'string' ? d.url.split('/').filter(Boolean).pop() : '');
          go(slug ? `/captain-tours/${encodeURIComponent(slug)}${qs({ batchId: d.batchId })}` : '/captain-tours');
          break;
        }
        case 'confirm_booking': {
          const id = d.activityId || d.listingId;
          if (!id) {
            go('/activities');
            break;
          }
          // The detail screen, not straight into checkout: the card can't tell
          // our inventory from a partner's, and the detail screen can. The
          // prefilled choices carry over either way.
          go(`/activity/${id}${qs({
            date: d.date,
            adults: d.adults ?? d.participants?.adults,
            children: d.children ?? d.participants?.children,
            variantId: d.variantId,
            autobook: '1',
          })}`);
          break;
        }
        case 'book_package':
          go(`/packages/checkout/${encodeURIComponent(d.packageId || '')}${qs({
            variant: d.variantName || d.variant,
            departureId: d.departureId,
            startDate: d.startDate || d.date,
            adults: d.adults,
          })}`);
          break;
        default:
          if (d.url) openHref(router, String(d.url));
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Something went wrong. Try again.' });
    }
  };

  return (
    <View style={{ gap: 8 }}>
      {list.map((card, idx) => {
        const price = card.data?.price?.finalPrice ? `₹${Math.round(card.data.price.finalPrice).toLocaleString('en-IN')}` : null;
        const needsSignIn = card.requiresAuth && !isAuthenticated;
        return (
          <Pressable
            key={`${card.type}-${idx}`}
            onPress={() => run(card)}
            accessibilityRole="button"
            accessibilityLabel={`${card.label}${price ? `, ${price}` : ''}`}
            style={({ pressed }) => [styles.card, { backgroundColor: t.ink }, pressed && { opacity: 0.86, transform: [{ scale: 0.99 }] }]}
          >
            <Ionicons name={ICONS[card.type] || 'sparkles-outline'} size={18} color={t.onInk} />
            <Text style={[styles.label, { color: t.onInk }]} numberOfLines={2}>
              {card.label}
              {price ? <Text style={styles.price}> · {price}</Text> : null}
            </Text>
            <View style={styles.cta}>
              <Text style={[styles.ctaText, { color: t.onInk }]}>
                {needsSignIn ? 'Sign in' : card.type === 'view_itinerary' ? 'Open' : 'Continue'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={t.onInk} style={{ opacity: 0.8 }} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  label: { flex: 1, fontSize: 14, fontWeight: '600' },
  price: { fontWeight: '400', opacity: 0.8 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ctaText: { fontSize: 12, opacity: 0.8 },
});
