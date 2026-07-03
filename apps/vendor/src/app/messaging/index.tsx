import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  Avatar,
  LoadingSpinner,
  EmptyState,
  SearchBar,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { businessAPI, messageAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MessageThread {
  _id: string;
  bookingId: string;
  bookingReference?: string;
  customerName: string;
  customerAvatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  activityName?: string;
}

// ─── Thread Item ──────────────────────────────────────────────────────────────

function ThreadItem({ thread, onPress }: { thread: MessageThread; onPress: () => void }) {
  const timeStr = thread.lastMessageTime
    ? getRelativeTime(new Date(thread.lastMessageTime))
    : '';

  return (
    <TouchableOpacity style={styles.threadItem} onPress={onPress} activeOpacity={0.7}>
      <Avatar
        name={thread.customerName}
        uri={thread.customerAvatar}
        size={48}
      />
      <View style={styles.threadContent}>
        <View style={styles.threadTop}>
          <Text style={styles.threadName} numberOfLines={1}>
            {thread.customerName}
          </Text>
          {timeStr ? <Text style={styles.threadTime}>{timeStr}</Text> : null}
        </View>
        {thread.activityName && (
          <Text style={styles.threadActivity} numberOfLines={1}>
            {thread.activityName}
          </Text>
        )}
        {thread.lastMessage && (
          <Text
            style={[
              styles.threadPreview,
              thread.unreadCount > 0 && styles.threadPreviewUnread,
            ]}
            numberOfLines={1}
          >
            {thread.lastMessage}
          </Text>
        )}
      </View>
      {thread.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadCount}>
            {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MessagingScreen() {
  const router = useRouter();
  const { businessAccount } = useBusinessStore();

  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [filteredThreads, setFilteredThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchThreads = useCallback(async () => {
    if (!businessAccount?._id) return;
    try {
      // Fetch bookings that have messages
      const res = await businessAPI.getMyBookings({});
      const bookings = res?.data || res?.bookings || res || [];

      // Build thread list from bookings
      const threadList: MessageThread[] = [];
      for (const b of (Array.isArray(bookings) ? bookings : [])) {
        const customerName =
          b.customerName ||
          [b.customer?.firstName, b.customer?.lastName].filter(Boolean).join(' ') ||
          b.customer?.name ||
          'Customer';

        // Try to get unread count
        let unreadCount = 0;
        try {
          const unreadRes = await messageAPI.getUnreadCount(b._id);
          unreadCount = unreadRes?.data?.count || unreadRes?.count || 0;
        } catch (_) {
          // Skip if messages endpoint not available
        }

        threadList.push({
          _id: b._id,
          bookingId: b._id,
          bookingReference: b.bookingReference,
          customerName,
          customerAvatar: b.customer?.avatar,
          lastMessage: b.lastMessage?.content || '',
          lastMessageTime: b.lastMessage?.createdAt || b.updatedAt || b.createdAt,
          unreadCount,
          activityName:
            b.activityName || b.activity?.title || b.activity?.name || '',
        });
      }

      // Sort by most recent
      threadList.sort((a, b) => {
        const ta = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const tb = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return tb - ta;
      });

      setThreads(threadList);
      setFilteredThreads(threadList);
    } catch (err) {
      console.warn('[Messaging] fetch error:', err);
    }
  }, [businessAccount?._id]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await fetchThreads();
    setLoading(false);
  }, [fetchThreads]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchThreads();
    setRefreshing(false);
  }, [fetchThreads]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Search ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredThreads(threads);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredThreads(
        threads.filter(
          (t) =>
            t.customerName.toLowerCase().includes(q) ||
            t.activityName?.toLowerCase().includes(q) ||
            t.bookingReference?.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery, threads]);

  // ── Render ───────────────────────────────────────────────────────────────

  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Messages</Text>
          {totalUnread > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search conversations..."
        />
      </View>

      {/* Thread List */}
      {loading ? (
        <LoadingSpinner message="Loading conversations..." />
      ) : (
        <FlatList
          data={filteredThreads}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <ThreadItem
              thread={item}
              onPress={() => {
                // Navigate to booking detail for now (full chat is future work)
                router.push(`/booking/${item.bookingId}`);
              }}
            />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />}
              title="No conversations"
              description="Messages from customers about their bookings will appear here."
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary[500]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  headerBadge: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  headerSpacer: {
    width: 36,
  },

  // Search
  searchWrap: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },

  // List
  listContent: {
    paddingBottom: spacing['3xl'],
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.xl + 48 + spacing.md,
    marginRight: spacing.xl,
  },

  // Thread Item
  threadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  threadContent: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  threadTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  threadName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  threadTime: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  threadActivity: {
    fontSize: fontSize.xs,
    color: colors.primary[500],
    marginTop: 1,
  },
  threadPreview: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: 2,
  },
  threadPreviewUnread: {
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  unreadBadge: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
});
