// The Isha chat screen. Composes the pieces in components/chat; the
// conversation itself lives in the chat store, so leaving this screen only
// minimises it (a reply in flight carries on and shows on the launcher).
import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import { useAuth } from '@prayana/shared-hooks';
import { auth, socketService } from '@prayana/shared-services';
import { isGuest } from '../../lib/guestSession';
import { goBack } from '../../lib/goBack';
import ChatHeader from '../../components/chat/ChatHeader';
import ChatHistorySheet from '../../components/chat/ChatHistorySheet';
import ChatInput from '../../components/chat/ChatInput';
import ChatMessage from '../../components/chat/ChatMessage';
import ChatWelcome from '../../components/chat/ChatWelcome';
import HandoffBanners from '../../components/chat/HandoffBanners';
import LoginPrompt from '../../components/chat/LoginPrompt';
import { plainLabel, useIsha } from '../../components/chat/ishaTheme';
import useIsOnline from '../../components/chat/useIsOnline';
import { useChatStore } from '../../components/chat/useChatStore';
import type { ChatMessage as Msg } from '../../components/chat/types';

class ChatErrorBoundary extends Component<{ children: React.ReactNode; colors: { text: string; muted: string; ink: string; onInk: string } }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('Isha chat render failed:', error);
  }
  render() {
    const c = this.props.colors;
    if (this.state.hasError) {
      return (
        <View style={styles.boundary} accessibilityRole="alert">
          <Text style={[styles.boundaryTitle, { color: c.text }]}>Something went wrong showing this chat</Text>
          <Text style={{ color: c.muted, fontSize: 14 }}>Your messages are safe.</Text>
          <Pressable onPress={() => this.setState({ hasError: false })} style={[styles.boundaryBtn, { backgroundColor: c.ink }]}>
            <Text style={{ color: c.onInk, fontWeight: '600' }}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

// Asked once per launch, and only when already allowed: never a permission
// prompt just for opening the chat (the menu has "Share my location")
let triedSilentLocation = false;

async function locate(ask: boolean) {
  const perm = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
  if (perm.status !== 'granted') return null;
  const pos =
    (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 }).catch(() => null)) ||
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  const places = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }).catch(() => []);
  const p = places?.[0];
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    city: p?.city || p?.subregion || p?.region || null,
    country: p?.country || null,
  };
}

export default function ChatScreen() {
  const t = useIsha();
  const insets = useSafeAreaInsets();
  // FloatingChatFAB and EmbeddedChatWidget push /chat with these
  const params = useLocalSearchParams<{ initialMessage?: string; context?: string }>();
  const { user, isAuthenticated } = useAuth();
  const isOnline = useIsOnline();
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<Msg>>(null);

  const messages = useChatStore((s) => s.messages);
  const isSending = useChatStore((s) => s.isSending);
  const mode = useChatStore((s) => s.mode);
  const sessionId = useChatStore((s) => s.currentSessionId);
  const sessionKey = useChatStore((s) => s.currentSessionKey);
  const showLoginPrompt = useChatStore((s) => s.showLoginPrompt);
  const forceLogin = useChatStore((s) => s.forceLogin);
  const guestCount = useChatStore((s) => s.guestMessageCount);
  const maxGuest = useChatStore((s) => s.maxGuestMessages);
  const userCity = useChatStore((s) => s.chatContext.userLocation?.city || null);

  const signedIn = !!isAuthenticated && !isGuest(user);
  useEffect(() => {
    useChatStore.getState().setAuthenticated(signedIn);
  }, [signedIn]);

  // A destination page passes its name: Isha knows it, and the welcome asks about it
  const context = (params.context || '').trim();
  const pageName = context && context !== 'home' ? context : null;

  // Open on focus (resuming the same conversation), minimise on leaving
  const initialSent = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const store = useChatStore.getState();
      store
        .openChat(pageName ? { destination: pageName, pageEntity: { kind: 'destination', name: pageName } } : { pageEntity: null })
        .then(() => {
          const initial = (params.initialMessage || '').trim();
          if (active && initial && !initialSent.current) {
            initialSent.current = true;
            useChatStore.getState().sendMessage(initial);
          }
        });
      return () => {
        active = false;
        useChatStore.getState().closeChat();
      };
    }, [pageName, params.initialMessage]),
  );

  // A person from the team joins over the /customer-chat socket; the session
  // key lets this phone into its room
  useEffect(() => {
    if (!sessionId) return undefined;
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    (async () => {
      let token: string | null = null;
      try {
        token = (await auth.currentUser?.getIdToken()) || null;
      } catch {
        token = null;
      }
      if (cancelled) return;
      const store = useChatStore.getState();
      cleanup = socketService.connectCustomerChat(
        token,
        sessionId,
        {
          onModeChanged: (payload: any) => !cancelled && store.onModeChanged(payload || {}),
          onAgentMessage: (payload: any) => !cancelled && store.onAgentMessage(payload),
          onAgentTyping: (payload: any) => !cancelled && store.onAgentTyping(payload || {}),
          onAgentsAllBusy: () =>
            !cancelled &&
            Toast.show({
              type: 'info',
              text1: 'Everyone on the team is busy',
              text2: "We've let them know, and you can keep typing.",
              visibilityTime: 6000,
            }),
        },
        sessionKey,
      ) as unknown as () => void;
    })();
    return () => {
      cancelled = true;
      try {
        cleanup?.();
      } catch {
        /* already closed */
      }
    };
  }, [sessionId, sessionKey]);

  // Location helps answers like "cabs near me" and fills the trip options' starting city
  useEffect(() => {
    if (triedSilentLocation || userCity) return;
    triedSilentLocation = true;
    locate(false)
      .then((loc) => loc && useChatStore.getState().setUserLocation(loc))
      .catch(() => {});
  }, [userCity]);

  const [locating, setLocating] = useState(false);
  const shareLocation = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    try {
      const loc = await locate(true);
      if (!loc) {
        Toast.show({ type: 'error', text1: 'Location is off for Prayana', text2: 'Allow it in Settings to get answers near you.' });
        return;
      }
      useChatStore.getState().setUserLocation(loc);
      Toast.show({ type: 'success', text1: loc.city ? `Isha knows you're near ${loc.city}` : 'Location shared' });
    } catch {
      Toast.show({ type: 'error', text1: "Couldn't find your location" });
    } finally {
      setLocating(false);
    }
  }, [locating]);

  const escalate = useCallback(() => {
    useChatStore
      .getState()
      .escalateToHuman()
      .catch(() => Toast.show({ type: 'error', text1: "Couldn't reach our team", text2: 'Try again in a moment.' }));
  }, []);

  const [historyOpen, setHistoryOpen] = useState(false);

  // ── The conversation, newest at the bottom (an inverted list) ──
  const data = useMemo(() => messages.slice().reverse(), [messages]);
  const latestReplyId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].senderType !== 'agent') return messages[i].id;
    }
    return null;
  }, [messages]);

  // Its follow-ups sit above the composer, where the next message starts
  const lastReply = !isSending && latestReplyId ? messages.find((m) => m.id === latestReplyId) : null;
  const followUps = (lastReply?.suggestions || [])
    .slice(0, 3)
    .map((s) => plainLabel(s.text))
    .filter(Boolean);

  const renderItem = useCallback(
    ({ item }: { item: Msg }) => (
      <View style={styles.item}>
        <ChatMessage message={item} isLatest={item.id === latestReplyId} isAuthenticated={signedIn} />
      </View>
    ),
    [latestReplyId, signedIn],
  );

  // Follow the conversation while the reader is at the bottom; if they've
  // scrolled up to read, leave them there and offer a way back
  const [awayFromBottom, setAway] = useState(false);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const away = e.nativeEvent.contentOffset.y > 140;
    setAway((prev) => (prev === away ? prev : away));
  }, []);
  const toBottom = useCallback((animated = true) => {
    listRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);

  // A message you send always brings you to it
  const lastUserId = useRef<string | null>(null);
  useEffect(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser && lastUser.id !== lastUserId.current) {
      if (lastUserId.current !== null) toBottom(true);
      lastUserId.current = lastUser.id;
    } else if (!lastUser) {
      lastUserId.current = null;
    }
  }, [messages, toBottom]);

  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const guestLeft = Math.max(0, maxGuest - guestCount);
  const footnote =
    !signedIn && mode === 'ai'
      ? guestLeft > 0
        ? `${guestLeft} free message${guestLeft === 1 ? '' : 's'} left. Sign in to keep chatting.`
        : 'Sign in to keep chatting with Isha.'
      : 'Isha can make mistakes. Prices and availability are confirmed at checkout.';

  const boundaryColors = { text: t.text, muted: t.muted, ink: t.ink, onInk: t.onInk };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <ChatHeader
        isOnline={isOnline}
        onMinimise={() => goBack()}
        onHistory={() => {
          Keyboard.dismiss();
          setHistoryOpen(true);
        }}
        onEscalate={escalate}
        onShareLocation={shareLocation}
        locating={locating}
        locationCity={userCity}
      />

      {!isOnline && (
        <View accessibilityRole="alert" style={[styles.offline, { backgroundColor: t.warnBg, borderBottomColor: t.warnBorder }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={t.warnText} />
          <Text style={[styles.offlineText, { color: t.warnText }]}>
            You're offline. Nothing is lost: messages send as soon as you're back.
          </Text>
        </View>
      )}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.flex}>
          {messages.length === 0 ? (
            <ScrollView
              contentContainerStyle={styles.welcome}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
            >
              <ChatWelcome />
            </ScrollView>
          ) : (
            <ChatErrorBoundary colors={boundaryColors}>
              <FlatList
                ref={listRef}
                data={data}
                inverted
                renderItem={renderItem}
                keyExtractor={(m) => m.id}
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScroll={onScroll}
                scrollEventThrottle={64}
                // At the bottom the inverted list follows new words by itself;
                // scrolled up to read, the view holds still while Isha writes
                maintainVisibleContentPosition={awayFromBottom ? { minIndexForVisible: 1 } : undefined}
                initialNumToRender={8}
                maxToRenderPerBatch={6}
                windowSize={9}
                showsVerticalScrollIndicator={false}
              />
            </ChatErrorBoundary>
          )}

          {/* In the corner, so it never sits on a card's button */}
          {awayFromBottom && messages.length > 0 && (
            <Pressable
              onPress={() => toBottom(true)}
              accessibilityRole="button"
              accessibilityLabel="Jump to the latest message"
              style={({ pressed }) => [
                styles.jump,
                isSending && styles.jumpWide,
                { borderColor: t.border, backgroundColor: t.surface, shadowColor: t.shadow },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="arrow-down" size={16} color={t.body} />
              {isSending && <Text style={[styles.jumpText, { color: t.body }]}>Isha is replying</Text>}
            </Pressable>
          )}
        </View>

        <HandoffBanners />

        <View style={[styles.composer, { paddingBottom: keyboardUp ? 8 : Math.max(insets.bottom, 12) }]}>
          {followUps.length > 0 && mode === 'ai' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.followRail}
              contentContainerStyle={styles.follow}
            >
              {followUps.map((label) => (
                <Pressable
                  key={label}
                  onPress={() => useChatStore.getState().sendMessage(label)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.followChip, { borderColor: t.border, backgroundColor: pressed ? t.pressed : t.surface }]}
                >
                  <Text style={[styles.followText, { color: t.body }]} numberOfLines={1}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <ChatInput ref={inputRef} isOnline={isOnline} />
          {!keyboardUp && <Text style={[styles.footnote, { color: t.faint }]}>{footnote}</Text>}
        </View>
      </KeyboardAvoidingView>

      <ChatHistorySheet visible={historyOpen} onClose={() => setHistoryOpen(false)} />
      <LoginPrompt
        visible={showLoginPrompt && !signedIn}
        forceLogin={forceLogin}
        onClose={() => useChatStore.getState().closeLoginPrompt()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  offlineText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  welcome: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  item: { paddingVertical: 10 },
  jump: {
    position: 'absolute',
    right: 16,
    bottom: 12,
    height: 40,
    minWidth: 40,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  jumpWide: { paddingLeft: 12, paddingRight: 14 },
  jumpText: { fontSize: 13, fontWeight: '500' },
  composer: { paddingHorizontal: 16, paddingTop: 8 },
  followRail: { marginHorizontal: -16, marginBottom: 10, flexGrow: 0 },
  follow: { gap: 8, paddingHorizontal: 16 },
  followChip: { height: 34, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, justifyContent: 'center', maxWidth: 260 },
  followText: { fontSize: 13, fontWeight: '500' },
  footnote: { fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 8 },
  boundary: { alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 40 },
  boundaryTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  boundaryBtn: { height: 40, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
