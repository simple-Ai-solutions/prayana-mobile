import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import IshaAvatar, { ISHA_AVATAR } from './IshaAvatar';
import { FLAME, useIsha } from './ishaTheme';
import { useChatStore } from './useChatStore';

/**
 * The launcher: Isha in the logo's flame. A reply that lands while the chat
 * is minimised shows as a badge and its first line, the way the website's
 * launcher does; someone mid-conversation isn't pitched the greeting again.
 */
export const FloatingChatFAB: React.FC = () => {
  const t = useIsha();
  const router = useRouter();
  const unreadCount = useChatStore((s) => s.unreadCount);
  const replyPreview = useChatStore((s) => s.replyPreview);
  const hasConversation = useChatStore((s) => s.messages.length > 0);
  const isSending = useChatStore((s) => s.isSending);
  const [showGreeting, setShowGreeting] = useState(false);

  const pulse = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const bubble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(1200),
      ]),
    );
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    ring.start();
    float.start();
    return () => {
      ring.stop();
      float.stop();
    };
  }, [pulse, bob]);

  // The greeting, once, a few seconds in; not for someone mid-conversation
  useEffect(() => {
    if (hasConversation) return undefined;
    const show = setTimeout(() => setShowGreeting(true), 3000);
    const hide = setTimeout(() => setShowGreeting(false), 7500);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [hasConversation]);

  const card = replyPreview ? 'reply' : showGreeting && !hasConversation ? 'greeting' : null;
  useEffect(() => {
    Animated.timing(bubble, { toValue: card ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [card, bubble]);

  const open = () => router.push({ pathname: '/chat', params: { initialMessage: '', context: 'home' } });

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.28, 0.12, 0] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const label =
    unreadCount > 0 ? `Open chat with Isha, ${unreadCount} new ${unreadCount === 1 ? 'reply' : 'replies'}` : 'Open Isha chat';

  return (
    <View style={styles.container} pointerEvents="box-none">
      {card && (
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: t.surface,
              borderColor: t.border,
              shadowColor: t.shadow,
              opacity: bubble,
              transform: [{ translateY: bubble.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
            },
          ]}
        >
          <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={card === 'reply' ? `Isha replied: ${replyPreview}` : 'Open Isha chat'} style={styles.cardBody}>
            <Image source={ISHA_AVATAR} style={[styles.cardAvatar, { backgroundColor: t.sunken }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.cardTitle, { color: t.text }]}>{card === 'reply' ? 'Isha replied' : "Hi! I'm Isha"}</Text>
              <Text style={[styles.cardText, { color: t.muted }]} numberOfLines={2}>
                {card === 'reply' ? replyPreview : 'Plan, price and book your next trip with me.'}
              </Text>
            </View>
          </Pressable>
          {card === 'reply' && (
            <Pressable
              onPress={() => useChatStore.getState().dismissReplyPreview()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Hide this preview"
              style={styles.cardClose}
            >
              <Ionicons name="close" size={14} color={t.faint} />
            </Pressable>
          )}
        </Animated.View>
      )}

      <Animated.View
        pointerEvents="none"
        style={[styles.pulse, { backgroundColor: FLAME[1], opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]}
      />

      <Animated.View style={{ transform: [{ translateY: bobY }] }}>
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => [styles.fab, { shadowColor: FLAME[0], backgroundColor: t.bg }, pressed && { transform: [{ scale: 0.94 }] }]}
        >
          <IshaAvatar size={62} ring={3} working={isSending} />
        </Pressable>
        {unreadCount > 0 && (
          <View pointerEvents="none" style={[styles.badge, { borderColor: t.bg, backgroundColor: FLAME[0] }]}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 24, right: 20, alignItems: 'flex-end', zIndex: 200 },
  card: {
    width: 260,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 30,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 10,
  },
  cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardAvatar: { width: 32, height: 32, borderRadius: 16 },
  cardTitle: { fontSize: 13.5, fontWeight: '600' },
  cardText: { fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  cardClose: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', bottom: 4, right: 4, width: 54, height: 54, borderRadius: 27 },
  fab: {
    borderRadius: 31,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 10,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

export default FloatingChatFAB;
