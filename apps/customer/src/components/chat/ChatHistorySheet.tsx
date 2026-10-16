import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useIsha } from './ishaTheme';
import { useChatStore } from './useChatStore';
import type { SavedConversation } from './types';

function when(timestamp: string) {
  const d = new Date(timestamp);
  if (d.toDateString() === new Date().toDateString()) {
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Saved conversations. Opening one resumes it, with Isha's memory of it. */
export default function ChatHistorySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useIsha();
  const history = useChatStore((s) => s.conversationHistory);
  const currentId = useChatStore((s) => s.currentConversationId);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      (q ? history.filter((c) => c.title?.toLowerCase().includes(q) || c.subtitle?.toLowerCase().includes(q)) : history)
        .slice()
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)),
    [history, q],
  );

  const options = (conv: SavedConversation) => {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert(conv.title, undefined, [
      { text: conv.pinned ? 'Unpin' : 'Pin', onPress: () => useChatStore.getState().togglePinConversation(conv.id) },
      { text: 'Delete', style: 'destructive', onPress: () => useChatStore.getState().deleteConversation(conv.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const deleteAll = () =>
    Alert.alert(`Delete all ${history.length} saved chats?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete all', style: 'destructive', onPress: () => useChatStore.getState().clearAllConversations() },
    ]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: t.divider }]}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to chat" style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={21} color={t.body} />
          </Pressable>
          <Text style={[styles.title, { color: t.text }]} accessibilityRole="header">
            Your chats
          </Text>
        </View>

        {history.length > 3 && (
          <View style={styles.searchWrap}>
            <View style={[styles.search, { borderColor: t.border, backgroundColor: t.surfaceMuted }]}>
              <Ionicons name="search" size={16} color={t.faint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search your chats"
                placeholderTextColor={t.placeholder}
                returnKeyType="search"
                clearButtonMode="while-editing"
                accessibilityLabel="Search your chats"
                style={[styles.searchInput, { color: t.text }]}
              />
            </View>
          </View>
        )}

        <FlatList
          data={rows}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: conv }) => {
            const current = conv.id === currentId;
            return (
              <Pressable
                onPress={() => {
                  useChatStore.getState().loadConversation(conv.id);
                  onClose();
                }}
                onLongPress={() => options(conv)}
                accessibilityRole="button"
                accessibilityState={{ selected: current }}
                accessibilityHint="Long press for pin and delete"
                style={({ pressed }) => [styles.row, { backgroundColor: pressed || current ? t.surfaceMuted : 'transparent' }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTitle}>
                    {conv.pinned && <Ionicons name="pin" size={12} color={t.text} accessibilityLabel="Pinned" />}
                    <Text style={[styles.convTitle, { color: t.text }]} numberOfLines={1}>
                      {conv.title}
                    </Text>
                  </View>
                  <Text style={[styles.convMeta, { color: t.muted }]} numberOfLines={1}>
                    {when(conv.timestamp)}
                    {conv.subtitle ? ` · ${conv.subtitle}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => options(conv)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Options for ${conv.title}`} style={styles.iconBtn}>
                  <Ionicons name="ellipsis-vertical" size={16} color={t.faint} />
                </Pressable>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: t.muted }]}>
              {q ? `No chats match “${query}”` : 'Your chats with Isha will show up here.'}
            </Text>
          }
        />

        {history.length > 0 && (
          <View style={[styles.footer, { borderTopColor: t.divider }]}>
            <Pressable onPress={deleteAll} accessibilityRole="button" style={({ pressed }) => [styles.deleteAll, pressed && { backgroundColor: t.surfaceMuted }]}>
              <Ionicons name="trash-outline" size={15} color={t.danger} />
              <Text style={[styles.deleteText, { color: t.danger }]}>Delete all chats</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 16, fontWeight: '600' },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  list: { paddingHorizontal: 8, paddingVertical: 12, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingLeft: 12, paddingVertical: 4, minHeight: 60 },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  convTitle: { flex: 1, fontSize: 14.5, fontWeight: '500' },
  convMeta: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', paddingVertical: 40, fontSize: 14 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 8 },
  deleteAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 12 },
  deleteText: { fontSize: 14, fontWeight: '500' },
});
