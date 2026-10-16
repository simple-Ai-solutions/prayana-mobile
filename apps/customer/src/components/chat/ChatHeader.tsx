import React, { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ENV } from '../../config/env';
import IshaAvatar from './IshaAvatar';
import { useIsha } from './ishaTheme';
import { useChatStore } from './useChatStore';

// The same numbers as the Help & support screen
const WHATSAPP_NUMBER = (ENV.enquiryWhatsapp || '919449753920').replace(/\D/g, '');
const PHONE_NUMBER = '+919449753920';
const EMAIL = ENV.enquiryEmail || 'simpleaisolutions@prayanaai.com';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type MenuItem = { icon: IconName; label: string; onPress: () => void; color?: string; disabled?: boolean };

function IconButton({ icon, label, onPress, disabled, size = 21 }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; size?: number }) {
  const t = useIsha();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: t.sunken }, disabled && { opacity: 0.35 }]}
    >
      <Ionicons name={icon} size={size} color={t.muted} />
    </Pressable>
  );
}

/**
 * Isha's name, what she's doing, and the chat's controls: your chats, new
 * chat, and one button for the ways to reach a person (so the header stays
 * about Isha).
 */
export default function ChatHeader({
  isOnline,
  onMinimise,
  onHistory,
  onEscalate,
  onShareLocation,
  locating,
  locationCity,
}: {
  isOnline: boolean;
  onMinimise: () => void;
  onHistory: () => void;
  onEscalate: () => void;
  onShareLocation: () => void;
  locating: boolean;
  locationCity: string | null;
}) {
  const t = useIsha();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const isSending = useChatStore((s) => s.isSending);
  const connectionStatus = useChatStore((s) => s.connectionStatus);
  const mode = useChatStore((s) => s.mode);
  const agentName = useChatStore((s) => s.assignedAgent?.name);
  const agentTyping = useChatStore((s) => s.agentTyping);
  const isEscalating = useChatStore((s) => s.isEscalating);
  const hasMessages = useChatStore((s) => s.messages.length > 0);

  const withPerson = mode === 'human' || mode === 'queued';
  let status = 'Plans and books trips';
  let strong = false;
  if (!isOnline) status = 'Waiting for your connection';
  else if (mode === 'human') status = `${agentName || 'Someone from our team'} is here${agentTyping ? ' · typing…' : ''}`;
  else if (mode === 'queued') status = 'Finding someone from our team…';
  else if (isSending) {
    status = 'Working on it…';
    strong = true;
  } else if (connectionStatus === 'connecting') status = 'Connecting…';

  const close = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };
  const whatsapp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi Prayana AI! I'd like to know more about a holiday package.")}`;
  const items: MenuItem[] = [
    ...(mode === 'ai'
      ? [{ icon: 'headset-outline' as IconName, label: isEscalating ? 'Connecting…' : 'Talk to a person', onPress: close(onEscalate), disabled: isEscalating }]
      : []),
    { icon: 'logo-whatsapp', label: 'WhatsApp us', color: '#1FAE54', onPress: close(() => Linking.openURL(whatsapp).catch(() => {})) },
    { icon: 'call-outline', label: 'Call us', onPress: close(() => Linking.openURL(`tel:${PHONE_NUMBER}`).catch(() => {})) },
    { icon: 'mail-outline', label: 'Email an enquiry', onPress: close(() => Linking.openURL(`mailto:${EMAIL}?subject=${encodeURIComponent('Trip enquiry')}`).catch(() => {})) },
    {
      icon: locationCity ? 'location' : 'location-outline',
      label: locating ? 'Finding you…' : locationCity ? `Near ${locationCity}` : 'Share my location',
      onPress: close(onShareLocation),
      disabled: locating,
    },
  ];

  return (
    <View style={[styles.header, { borderBottomColor: t.divider }]}>
      <IconButton icon="chevron-down" label="Minimise chat" onPress={onMinimise} size={23} />
      <IshaAvatar size={40} working={isSending} dot={isOnline && (connectionStatus === 'connected' || withPerson) ? 'online' : 'offline'} />
      <View style={styles.titleCol}>
        <Text style={[styles.name, { color: t.text }]} accessibilityRole="header">
          Isha
        </Text>
        <Text
          style={[styles.status, { color: strong ? t.text : t.muted, fontWeight: strong ? '500' : '400' }]}
          numberOfLines={1}
          accessibilityLiveRegion="polite"
        >
          {status}
        </Text>
      </View>
      <IconButton icon="time-outline" label="Your chats" onPress={onHistory} />
      <IconButton icon="create-outline" label="New chat" disabled={!hasMessages} onPress={() => useChatStore.getState().startNewChat()} />
      <IconButton icon="ellipsis-horizontal" label="Talk to a person or contact us" onPress={() => setMenuOpen(true)} />

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)} statusBarTranslucent>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu" />
        <View style={[styles.menu, { top: insets.top + 56, borderColor: t.border, backgroundColor: t.surface, shadowColor: t.shadow }]} accessibilityRole="menu">
          {items.map((it) => (
            <Pressable
              key={it.label}
              onPress={it.onPress}
              disabled={it.disabled}
              accessibilityRole="menuitem"
              style={({ pressed }) => [styles.item, pressed && { backgroundColor: t.surfaceMuted }, it.disabled && { opacity: 0.5 }]}
            >
              <Ionicons name={it.icon} size={17} color={it.color || t.muted} />
              <Text style={[styles.itemText, { color: t.body }]} numberOfLines={1}>
                {it.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: 6, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titleCol: { flex: 1, minWidth: 0, marginLeft: 2 },
  name: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  status: { fontSize: 12, lineHeight: 16 },
  menu: {
    position: 'absolute',
    right: 10,
    width: 232,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 6,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  itemText: { fontSize: 14, flex: 1 },
});
