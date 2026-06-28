import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Badge,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '@prayana/shared-ui';
import { supportAPI } from '@prayana/shared-services';

type Message = {
  _id?: string;
  sender: 'business' | 'admin' | 'system';
  senderName?: string;
  message: string;
  createdAt?: string;
};

type Ticket = {
  _id: string;
  subject: string;
  category?: string;
  priority?: string;
  status: string;
  messages: Message[];
  createdAt?: string;
  updatedAt?: string;
};

const STATUS_CFG: Record<string, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' }> = {
  open: { label: 'Open', variant: 'info' },
  in_progress: { label: 'In progress', variant: 'primary' },
  pending_customer: { label: 'Awaiting you', variant: 'warning' },
  resolved: { label: 'Resolved', variant: 'success' },
  closed: { label: 'Closed', variant: 'default' },
};

export default function TicketDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const fetchTicket = useCallback(async () => {
    if (!id) return;
    try {
      const res = await supportAPI.getTicket(id);
      setTicket(res?.data || res?.ticket || null);
    } catch (err: any) {
      console.warn('[Ticket] fetch failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (ticket?.messages?.length) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [ticket?.messages?.length]);

  const sendMessage = async () => {
    if (!draft.trim() || !id) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    try {
      const res = await supportAPI.addMessage(id, text);
      if (res?.success) {
        Haptics.selectionAsync();
        // Refetch to get the canonical thread state
        await fetchTicket();
      } else {
        Toast.show({ type: 'error', text1: 'Could not send', text2: res?.message });
        setDraft(text); // restore
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Send failed', text2: err?.message });
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (!ticket) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>Ticket not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const cfg = STATUS_CFG[ticket.status] || STATUS_CFG.open;
  const closed = ticket.status === 'resolved' || ticket.status === 'closed';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: spacing.md }}>
          <Text style={styles.subject} numberOfLines={1}>{ticket.subject}</Text>
          <Text style={styles.subMeta}>
            {ticket.category?.replace(/_/g, ' ') || ''}
            {ticket.priority ? ` · ${ticket.priority}` : ''}
          </Text>
        </View>
        <Badge label={cfg.label} variant={cfg.variant} size="sm" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.thread}
          showsVerticalScrollIndicator={false}
        >
          {ticket.messages.map((m, idx) => (
            <MessageBubble key={m._id || idx} message={m} />
          ))}
        </ScrollView>

        {closed ? (
          <View style={styles.closedBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.closedText}>This ticket is {cfg.label.toLowerCase()}.</Text>
          </View>
        ) : (
          <View style={styles.composerRow}>
            <RNTextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a reply..."
              placeholderTextColor={colors.textTertiary}
              multiline
              style={styles.composer}
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!draft.trim() || sending}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isMine = message.sender === 'business';
  const isSystem = message.sender === 'system';
  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : '';

  if (isSystem) {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{message.message}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        {!isMine && message.senderName ? (
          <Text style={styles.bubbleAuthor}>{message.senderName}</Text>
        ) : null}
        <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{message.message}</Text>
        <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  errorText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  subject: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  subMeta: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
  thread: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },

  systemRow: { alignItems: 'center', paddingVertical: spacing.sm },
  systemText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    fontStyle: 'italic',
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },

  bubbleRow: { flexDirection: 'row', marginVertical: spacing.xs },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  bubbleMine: {
    backgroundColor: colors.primary[500],
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.background,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleAuthor: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[700],
    marginBottom: 2,
  },
  bubbleText: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.8)' },

  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  composer: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.gray[100],
    fontSize: fontSize.md,
    color: colors.text,
    textAlignVertical: 'center',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },

  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.successLight,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closedText: { fontSize: fontSize.sm, color: colors.success, fontWeight: fontWeight.semibold },
});
