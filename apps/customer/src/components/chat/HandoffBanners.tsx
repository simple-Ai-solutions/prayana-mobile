import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { ISHA_AVATAR } from './IshaAvatar';
import { useIsha } from './ishaTheme';
import { useChatStore } from './useChatStore';
import { InkButton } from './ui';

const failed = () => Toast.show({ type: 'error', text1: "Couldn't reach our team", text2: 'Try again in a moment.' });

/**
 * Above the composer: the offer to bring in a person (asked first, never
 * automatic), and while a person is in the chat, who's there and the way back.
 */
export default function HandoffBanners() {
  const t = useIsha();
  const mode = useChatStore((s) => s.mode);
  const handoffOffered = useChatStore((s) => s.handoffOffered);
  const reason = useChatStore((s) => s.handoffOfferReason);
  const isEscalating = useChatStore((s) => s.isEscalating);
  const isCancelling = useChatStore((s) => s.isCancellingHandoff);
  const withPerson = mode === 'human' || mode === 'queued';

  if (handoffOffered && mode === 'ai') {
    return (
      <View style={styles.pad} accessibilityLiveRegion="polite">
        <View style={[styles.offer, { borderColor: t.border, backgroundColor: t.surfaceMuted }]}>
          <View style={styles.offerRow}>
            <Ionicons name="headset-outline" size={16} color={t.muted} style={{ marginTop: 2 }} />
            <Text style={[styles.offerText, { color: t.body }]}>
              {reason === 'frustration'
                ? "Sorry this isn't quite right. Want someone from our team to take over? They'll see this chat."
                : "Someone from our team may answer this better. Want me to bring them in? They'll see this chat."}
            </Text>
          </View>
          <View style={styles.offerActions}>
            <InkButton
              size="sm"
              label={isEscalating ? 'Connecting…' : 'Talk to a person'}
              busy={isEscalating}
              onPress={() => useChatStore.getState().acceptHandoffOffer().catch(failed)}
            />
            <Pressable onPress={() => useChatStore.getState().dismissHandoffOffer()} style={({ pressed }) => [styles.noThanks, pressed && { backgroundColor: t.sunken }]}>
              <Text style={[styles.noThanksText, { color: t.body }]}>No thanks</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (!withPerson && mode !== 'resolved') return null;
  return (
    <View style={styles.pad} accessibilityLiveRegion="polite">
      <View style={[styles.person, { borderColor: t.agentBorder, backgroundColor: t.agentBg }]}>
        <Text style={[styles.personText, { color: t.agentText }]}>
          {mode === 'human' && "You're chatting with a person. Isha is paused."}
          {mode === 'queued' && "Finding someone from our team. Keep typing, they'll see it."}
          {mode === 'resolved' && 'This conversation was marked resolved.'}
        </Text>
        {withPerson && (
          <Pressable
            onPress={() => useChatStore.getState().cancelHandoff().catch(failed)}
            disabled={isCancelling}
            accessibilityRole="button"
            style={({ pressed }) => [styles.back, { borderColor: t.agentBorder, backgroundColor: t.surface }, (pressed || isCancelling) && { opacity: 0.7 }]}
          >
            <Image source={ISHA_AVATAR} style={[styles.backAvatar, { backgroundColor: t.sunken }]} />
            <Text style={[styles.backText, { color: t.text }]}>
              {isCancelling ? 'Switching…' : mode === 'queued' ? 'Cancel' : 'Back to Isha'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 6 },
  offer: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
  offerRow: { flexDirection: 'row', gap: 10 },
  offerText: { flex: 1, fontSize: 13.5, lineHeight: 20 },
  offerActions: { flexDirection: 'row', gap: 8, paddingLeft: 26 },
  noThanks: { height: 36, paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center' },
  noThanksText: { fontSize: 13, fontWeight: '500' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingVertical: 8, paddingLeft: 12, paddingRight: 8 },
  personText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, borderWidth: 1, borderRadius: 10, paddingLeft: 6, paddingRight: 10 },
  backAvatar: { width: 20, height: 20, borderRadius: 10 },
  backText: { fontSize: 12.5, fontWeight: '600' },
});
