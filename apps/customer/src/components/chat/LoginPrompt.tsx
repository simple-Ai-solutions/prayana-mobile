import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import IshaAvatar from './IshaAvatar';
import { useIsha } from './ishaTheme';
import { goToLogin } from './links';
import { useChatStore } from './useChatStore';
import { InkButton } from './ui';

const BENEFITS: Array<{ icon: React.ComponentProps<typeof Ionicons>['name']; text: string }> = [
  { icon: 'chatbubbles-outline', text: 'Keep chatting with Isha' },
  { icon: 'bookmark-outline', text: 'Your chats and plans, saved' },
  { icon: 'sparkles-outline', text: 'Picks tuned to how you travel' },
  { icon: 'phone-portrait-outline', text: 'Same account on the web' },
];

/**
 * After a guest's free messages: sign in to keep going. Skipping gives a few
 * more; the third time it can't be skipped (forceLogin).
 */
export default function LoginPrompt({ visible, forceLogin, onClose }: { visible: boolean; forceLogin: boolean; onClose: () => void }) {
  const t = useIsha();
  const router = useRouter();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={forceLogin ? () => router.back() : onClose}>
      <Pressable style={[styles.scrim, { backgroundColor: t.scrim }]} onPress={forceLogin ? undefined : onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: t.surface, borderColor: t.border }]} onPress={() => {}}>
          {!forceLogin && (
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
              <Ionicons name="close" size={20} color={t.muted} />
            </Pressable>
          )}
          <View style={styles.head}>
            <IshaAvatar size={64} ring={3} />
            <Text style={[styles.title, { color: t.text }]}>{forceLogin ? 'Sign in to keep chatting' : 'Continue your journey'}</Text>
            <Text style={[styles.sub, { color: t.muted }]}>
              {forceLogin
                ? 'Sign in to carry on with Isha. It only takes a moment.'
                : 'Sign in for unlimited chat, saved conversations and picks made for you.'}
            </Text>
          </View>
          <View style={[styles.benefits, { backgroundColor: t.surfaceMuted }]}>
            {BENEFITS.map((b) => (
              <View key={b.text} style={styles.benefit}>
                <Ionicons name={b.icon} size={18} color={t.text} />
                <Text style={[styles.benefitText, { color: t.body }]}>{b.text}</Text>
              </View>
            ))}
          </View>
          <View style={styles.actions}>
            <InkButton
              size="lg"
              label="Sign in / Sign up"
              icon="log-in-outline"
              onPress={() => {
                // Hidden first: a Modal would sit on top of the login screen
                useChatStore.setState({ showLoginPrompt: false });
                goToLogin(router);
              }}
            />
            {!forceLogin && (
              <Pressable onPress={onClose} style={({ pressed }) => [styles.guest, pressed && { backgroundColor: t.sunken }]}>
                <Text style={[styles.guestText, { color: t.muted }]}>Continue as guest</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  sheet: { width: '100%', maxWidth: 420, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  close: { position: 'absolute', top: 14, right: 14, zIndex: 2, padding: 4 },
  head: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 18, gap: 10 },
  title: { fontSize: 21, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  sub: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  benefits: { paddingHorizontal: 24, paddingVertical: 16, gap: 12 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitText: { fontSize: 14, fontWeight: '500' },
  actions: { padding: 20, gap: 8 },
  guest: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  guestText: { fontSize: 14, fontWeight: '500' },
});
