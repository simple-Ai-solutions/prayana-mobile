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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Card,
  Badge,
  EmptyState,
  TextInput,
} from '@prayana/shared-ui';
// Brand-colored (BLUE) components come from the vendor barrel.
import { Button } from '../../components/ui';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../theme/vendorColors';
import { supportAPI } from '@prayana/shared-services';

const SUPPORT_PHONE = '+919632790625';

type Ticket = {
  _id: string;
  subject: string;
  ticketRef?: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_on_business' | 'resolved' | 'closed';
  createdAt?: string;
  updatedAt?: string;
  lastAdminMessageAt?: string;
  messages?: Array<{ sender: 'business' | 'admin' | 'system'; message: string; createdAt?: string }>;
  unreadCount?: number;
  unreadByBusinessCount?: number;
};

const STATUS_CFG: Record<string, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' }> = {
  open: { label: 'Open', variant: 'info' },
  in_progress: { label: 'In Progress', variant: 'warning' },
  waiting_on_business: { label: 'Waiting on You', variant: 'info' },
  resolved: { label: 'Resolved', variant: 'success' },
  closed: { label: 'Closed', variant: 'default' },
};

// Filter tabs mirror the PWA (all + each status).
const FILTER_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'waiting_on_business', label: 'Waiting on You' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

// Category list aligned to the PWA.
const CATEGORY_OPTIONS = [
  { key: 'onboarding_help', label: 'Onboarding Help' },
  { key: 'listing_issue', label: 'Listing Issue' },
  { key: 'booking_issue', label: 'Booking Issue' },
  { key: 'payment_issue', label: 'Payment Issue' },
  { key: 'payout_issue', label: 'Payout Issue' },
  { key: 'technical_issue', label: 'Technical Issue' },
  { key: 'account_issue', label: 'Account Issue' },
  { key: 'document_help', label: 'Document Help' },
  { key: 'general_inquiry', label: 'General Inquiry' },
  { key: 'feature_request', label: 'Feature Request' },
  { key: 'other', label: 'Other' },
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
  const [filter, setFilter] = useState('all');

  // New ticket form
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general_inquiry');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await supportAPI.listTickets({
        limit: 30,
        ...(filter !== 'all' ? { status: filter } : {}),
      } as any);
      // Support several response shapes (data array, data.tickets, tickets).
      const list = Array.isArray(res?.data)
        ? res.data
        : res?.data?.tickets || res?.tickets || [];
      setTickets(list);
    } catch (err: any) {
      console.warn('[Support] fetch failed:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
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

  const ListHeader = (
    <View>
      {/* Header — mirrors PWA "24/7 Support" */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>24/7 Support</Text>
        <Text style={styles.pageSubtitle}>Get help anytime — our team is here to assist you</Text>
      </View>

      {/* Quick contact card */}
      <LinearGradient
        colors={[colors.primary[600], colors.primary[700]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.contactCard}
      >
        <TouchableOpacity
          style={styles.contactRow}
          activeOpacity={0.8}
          onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}
        >
          <View style={styles.contactIcon}>
            <Ionicons name="call" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.contactLabel}>CALL US</Text>
            <Text style={styles.contactValue}>+91 9632 790 625</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactRow}
          activeOpacity={0.8}
          onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_PHONE.replace('+', '')}`)}
        >
          <View style={styles.contactIcon}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.contactLabel}>WHATSAPP</Text>
            <Text style={styles.contactValue}>+91 9632 790 625</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.contactRow}>
          <View style={styles.contactIcon}>
            <Ionicons name="time" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.contactLabel}>RESPONSE TIME</Text>
            <Text style={styles.contactValue}>Under 30 minutes</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_OPTIONS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterTab, active && styles.filterTabActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Support</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : (
        <FlashList
          data={tickets}
          keyExtractor={(t) => t._id}
          ListHeaderComponent={ListHeader}
          renderItem={({ item }) => (
            <TicketCard ticket={item} onPress={() => router.push(`/support/${item._id}`)} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="headset-outline" size={30} color={colors.primary[500]} />
              </View>
              <Text style={styles.emptyTitle}>No support tickets yet</Text>
              <Text style={styles.emptyDesc}>Create a ticket to get help from our team</Text>
              <View style={styles.emptyCta}>
                <Button title="New Ticket" onPress={() => setShowNew(true)} variant="primary" size="md" />
              </View>
            </View>
          }
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
            <Text style={styles.modalTitle}>Create Support Ticket</Text>
            <TouchableOpacity onPress={() => setShowNew(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalIntro}>
                Tell us what's going on and we'll get back within 30 minutes.
              </Text>
              <TextInput
                label="Subject *"
                value={subject}
                onChangeText={setSubject}
                placeholder="Brief description of your issue"
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

              <Text style={styles.fieldLabel}>Message *</Text>
              <RNTextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Describe your issue in detail..."
                placeholderTextColor={colors.textTertiary}
                multiline
                style={styles.bigInput}
                maxLength={2000}
              />
              <Text style={styles.charCount}>{message.length} / 2000</Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Submit Ticket"
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
  const unread = ticket.unreadCount ?? ticket.unreadByBusinessCount ?? 0;
  const categoryLabel = ticket.category
    ? CATEGORY_OPTIONS.find((c) => c.key === ticket.category)?.label || ticket.category.replace(/_/g, ' ')
    : '';
  const updated = ticket.updatedAt
    ? new Date(ticket.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.cardWrap}>
      <Card style={styles.ticketCard}>
        <View style={styles.ticketHead}>
          <Text style={styles.ticketSubject} numberOfLines={1}>{ticket.subject}</Text>
          {unread > 0 ? (
            <View style={styles.unreadDot}>
              <Text style={styles.unreadDotText}>{unread}</Text>
            </View>
          ) : null}
          {updated ? <Text style={styles.updatedText}>{updated}</Text> : null}
        </View>
        <View style={styles.ticketMeta}>
          <Badge label={cfg.label} variant={cfg.variant} size="sm" />
          {ticket.ticketRef ? (
            <Text style={styles.ticketRef}>{ticket.ticketRef}</Text>
          ) : null}
          {categoryLabel ? (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>{categoryLabel}</Text>
            </>
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

  // Page header (mirrors PWA "24/7 Support")
  pageHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  pageTitle: { fontSize: fontSize['2xl'] ?? 28, fontWeight: fontWeight.bold, color: colors.text, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },

  // Quick contact gradient card
  contactCard: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.xl ?? 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactLabel: { fontSize: 10, fontWeight: fontWeight.bold, color: 'rgba(255,255,255,0.75)', letterSpacing: 1 },
  contactValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: '#fff', marginTop: 2 },

  // Filter tabs
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  filterTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  filterTabActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  filterTabText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  filterTabTextActive: { color: '#fff' },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing['2xl'] ?? 48 },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.xl ?? 16,
    backgroundColor: colors.primary[50] ?? '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  emptyDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  emptyCta: { marginTop: spacing.lg },

  cardWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  ticketCard: { padding: spacing.lg, gap: spacing.sm },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ticketSubject: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  updatedText: { fontSize: fontSize.xs, color: colors.textTertiary },
  ticketMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  ticketRef: { fontSize: fontSize.xs, color: colors.textTertiary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  metaText: { fontSize: fontSize.xs, color: colors.textTertiary },
  metaDot: { fontSize: fontSize.xs, color: colors.textTertiary },
  unreadDot: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
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
  modalIntro: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs },
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
