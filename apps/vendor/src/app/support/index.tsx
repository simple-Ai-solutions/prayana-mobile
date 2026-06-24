import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Card,
  Button,
  Badge,
  EmptyState,
  TextInput,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '@prayana/shared-ui';
import { supportAPI } from '@prayana/shared-services';

type Ticket = {
  _id: string;
  subject: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'pending_customer' | 'resolved' | 'closed';
  createdAt?: string;
  updatedAt?: string;
  lastAdminMessageAt?: string;
  messages?: Array<{ sender: 'business' | 'admin' | 'system'; message: string; createdAt?: string }>;
  unreadByBusinessCount?: number;
};

const STATUS_CFG: Record<string, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' }> = {
  open: { label: 'Open', variant: 'info' },
  in_progress: { label: 'In progress', variant: 'primary' },
  pending_customer: { label: 'Awaiting you', variant: 'warning' },
  resolved: { label: 'Resolved', variant: 'success' },
  closed: { label: 'Closed', variant: 'default' },
};

const CATEGORY_OPTIONS = [
  { key: 'general_inquiry', label: 'General' },
  { key: 'payments', label: 'Payments' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'listings', label: 'Listings' },
  { key: 'kyc', label: 'KYC' },
  { key: 'technical', label: 'Technical' },
];

const PRIORITY_OPTIONS = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
  { key: 'urgent', label: 'Urgent' },
];

export default function SupportScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // New ticket form
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general_inquiry');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await supportAPI.listTickets({ limit: 30 });
      setTickets(res?.data?.tickets || res?.tickets || []);
    } catch (err: any) {
      console.warn('[Support] fetch failed:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetch();
  }, [fetch]);

  const submitTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      Toast.show({ type: 'error', text1: 'Subject and message required' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await supportAPI.createTicket({
        subject: subject.trim(),
        category,
        priority,
        message: message.trim(),
      });
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: 'Ticket created' });
        setShowNew(false);
        setSubject('');
        setMessage('');
        setCategory('general_inquiry');
        setPriority('medium');
        await fetch();
        // Open the new ticket immediately
        if (res.data?._id) router.push(`/support/${res.data._id}`);
      } else {
        Toast.show({ type: 'error', text1: 'Could not create ticket', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Help & Support</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="help-buoy-outline" size={56} color={colors.gray[300]} />}
          title="No support tickets yet"
          description="If you need help, raise a ticket and our team will respond shortly."
          actionLabel="Raise a ticket"
          onAction={() => setShowNew(true)}
        />
      ) : (
        <FlashList
          data={tickets}
          keyExtractor={(t) => t._id}
          renderItem={({ item }) => (
            <TicketCard ticket={item} onPress={() => router.push(`/support/${item._id}`)} />
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowNew(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      {/* New ticket modal */}
      <Modal
        visible={showNew}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNew(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New ticket</Text>
            <TouchableOpacity onPress={() => setShowNew(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <TextInput
                label="Subject"
                value={subject}
                onChangeText={setSubject}
                placeholder="Brief summary of the issue"
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.chipRow}>
                {CATEGORY_OPTIONS.map((c) => {
                  const active = category === c.key;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      onPress={() => setCategory(c.key)}
                      style={[styles.chip, active && styles.chipActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Priority</Text>
              <View style={styles.chipRow}>
                {PRIORITY_OPTIONS.map((p) => {
                  const active = priority === p.key;
                  return (
                    <TouchableOpacity
                      key={p.key}
                      onPress={() => setPriority(p.key as any)}
                      style={[styles.chip, active && styles.chipActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Describe your issue</Text>
              <RNTextInput
                value={message}
                onChangeText={setMessage}
                placeholder="What's happening? Include reservation IDs or screenshots references."
                placeholderTextColor={colors.textTertiary}
                multiline
                style={styles.bigInput}
                maxLength={2000}
              />
              <Text style={styles.charCount}>{message.length} / 2000</Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Submit"
                onPress={submitTicket}
                variant="primary"
                size="lg"
                fullWidth
                loading={submitting}
                disabled={submitting}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function TicketCard({ ticket, onPress }: { ticket: Ticket; onPress: () => void }) {
  const cfg = STATUS_CFG[ticket.status] || STATUS_CFG.open;
  const lastMsg = ticket.messages?.[ticket.messages.length - 1];
  const updated = ticket.updatedAt
    ? new Date(ticket.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.cardWrap}>
      <Card style={styles.ticketCard}>
        <View style={styles.ticketHead}>
          <Text style={styles.ticketSubject} numberOfLines={1}>{ticket.subject}</Text>
          <Badge label={cfg.label} variant={cfg.variant} size="sm" />
        </View>
        {lastMsg ? (
          <Text style={styles.ticketSnippet} numberOfLines={2}>
            <Text style={styles.snippetSender}>{lastMsg.sender === 'admin' ? 'Support: ' : 'You: '}</Text>
            {lastMsg.message}
          </Text>
        ) : null}
        <View style={styles.ticketMeta}>
          {ticket.category ? (
            <Text style={styles.metaText}>{ticket.category.replace(/_/g, ' ')}</Text>
          ) : null}
          {updated ? (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>Updated {updated}</Text>
            </>
          ) : null}
          {ticket.unreadByBusinessCount && ticket.unreadByBusinessCount > 0 ? (
            <View style={styles.unreadDot}>
              <Text style={styles.unreadDotText}>{ticket.unreadByBusinessCount}</Text>
            </View>
          ) : null}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },

  cardWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  ticketCard: { padding: spacing.lg, gap: spacing.sm },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ticketSubject: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  ticketSnippet: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  snippetSender: { fontWeight: fontWeight.semibold, color: colors.text },
  ticketMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { fontSize: fontSize.xs, color: colors.textTertiary },
  metaDot: { fontSize: fontSize.xs, color: colors.textTertiary },
  unreadDot: {
    marginLeft: 'auto',
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDotText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },

  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  modalScroll: { padding: spacing.lg, gap: spacing.md },
  modalFooter: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },

  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  chipText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  chipTextActive: { color: '#fff' },

  bigInput: {
    minHeight: 160,
    maxHeight: 280,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: fontSize.xs, color: colors.textTertiary, alignSelf: 'flex-end' },
});
