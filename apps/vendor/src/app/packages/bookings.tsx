import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Card, useTheme } from '../../components/ui';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../theme/vendorColors';
import { packageAPI } from '@prayana/shared-services';
import { DEV_BYPASS_AUTH } from '../../config/devFlags';

// ─── Port of web PackageBookingsCalendar.jsx ───────────────────────────────────
// Custom month grid (mirrors activity/[id]/availability.tsx) + bookings-for-date
// logic + status colors + selected-day detail list.

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Tailwind swatches from the web ground truth, mapped to hex for RN.
const STATUS_COLORS: Record<string, string> = {
  pending_payment: '#f59e0b', // amber-500
  partially_paid: '#fbbf24', // amber-400
  confirmed: '#3b82f6', // blue-500
  in_progress: '#22c55e', // green-500
  completed: '#4ade80', // green-400
  cancelled: '#ef4444', // red-500
};

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Pending payment',
  partially_paid: 'Partially paid',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// ─── Types ─────────────────────────────────────────────────────────────────────

type PackageBooking = {
  _id: string;
  travelStartDate?: string;
  travelEndDate?: string;
  status?: string;
  packageSnapshot?: { title?: string; primaryDestination?: string };
  bookingReference?: string;
  totalTravelers?: { adults?: number; children?: number };
  pricing?: { totalAmount?: number };
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function rupee(n?: number): string {
  if (n == null || isNaN(n)) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function statusColor(status?: string): string {
  return (status && STATUS_COLORS[status]) || colors.gray[400];
}

function statusLabel(status?: string): string {
  if (!status) return 'Booking';
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function PackageBookingsScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<PackageBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await packageAPI.getBusinessBookings('all', 1);
      const list = res?.data || res?.bookings || res || [];
      setBookings(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.warn('[PackageBookings] fetch failed:', err?.message);
      // Under the dev auth bypass every authenticated call 401s; that's expected,
      // so stay quiet and let the empty state cover it (matches packages/index).
      if (!DEV_BYPASS_AUTH) {
        Toast.show({ type: 'error', text1: 'Failed to load bookings', text2: err?.message });
      }
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on mount and whenever the visible month changes.
  useEffect(() => {
    loadBookings();
  }, [loadBookings, year, month]);

  // ── Calendar grid (Sun-first, same shape as availability.tsx) ──
  const days = useMemo<(Date | null)[]>(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const list: (Date | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) list.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) list.push(new Date(year, month, d));
    return list;
  }, [year, month]);

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();

  const changeMonth = (direction: number) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + direction);
      return next;
    });
    setSelectedDate(null);
  };

  // A booking shows on `date` if it falls within [start 00:00 … end 23:59].
  const getBookingsForDate = useCallback(
    (date: Date): PackageBooking[] => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return bookings.filter((b) => {
        if (!b.travelStartDate || !b.travelEndDate) return false;
        const start = new Date(b.travelStartDate);
        const end = new Date(b.travelEndDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return d >= start && d <= end;
      });
    },
    [bookings],
  );

  const selectedBookings = selectedDate ? getBookingsForDate(selectedDate) : [];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Package Bookings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Calendar card ── */}
        <Card style={styles.calendarCard}>
          {/* Month navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthNavBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.monthTitleWrap}>
              <Text style={[styles.monthTitle, { color: themeColors.text }]}>{monthName}</Text>
              {loading && <ActivityIndicator size="small" color={colors.primary[500]} />}
            </View>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthNavBtn} hitSlop={8}>
              <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Week day headers */}
          <View style={styles.grid}>
            {WEEK_DAYS.map((day) => (
              <View key={day} style={styles.cellWrap}>
                <Text style={[styles.weekDayText, { color: themeColors.textTertiary }]}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Date grid */}
          <View style={styles.grid}>
            {days.map((date, index) => {
              if (!date) return <View key={`empty-${index}`} style={styles.cellWrap} />;

              const dayBookings = getBookingsForDate(date);
              const hasBookings = dayBookings.length > 0;
              const isSelected = !!selectedDate && sameDay(selectedDate, date);
              const isToday = sameDay(today, date);

              let bg: string = themeColors.surface;
              let border: string = themeColors.border;
              if (isSelected) {
                bg = colors.primary[500];
                border = colors.primary[500];
              } else if (hasBookings) {
                bg = colors.primary[50];
                border = colors.primary[100];
              }

              return (
                <View key={date.toDateString()} style={styles.cellWrap}>
                  <TouchableOpacity
                    onPress={() => setSelectedDate(date)}
                    activeOpacity={0.7}
                    style={[styles.cell, { backgroundColor: bg, borderColor: border }]}
                  >
                    <View
                      style={[
                        styles.dayNumWrap,
                        isToday && !isSelected && { backgroundColor: colors.primary[500] },
                        isSelected && { backgroundColor: '#ffffff' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNum,
                          { color: themeColors.text },
                          isToday && !isSelected && { color: '#ffffff' },
                          isSelected && { color: colors.primary[600], fontWeight: fontWeight.bold as any },
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                    </View>

                    {hasBookings && (
                      <View style={styles.dotsRow}>
                        {dayBookings.slice(0, 3).map((b, i) => (
                          <View
                            key={b._id || i}
                            style={[styles.dot, { backgroundColor: statusColor(b.status) }]}
                          />
                        ))}
                        {dayBookings.length > 3 && (
                          <Text
                            style={[
                              styles.dotMore,
                              { color: isSelected ? '#ffffff' : themeColors.textSecondary },
                            ]}
                          >
                            +{dayBookings.length - 3}
                          </Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </Card>

        {/* ── Legend ── */}
        <View style={styles.legendRow}>
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS[status] }]} />
              <Text style={[styles.legendText, { color: themeColors.textSecondary }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── Selected day detail ── */}
        <View style={styles.detailSection}>
          <Text style={[styles.detailTitle, { color: themeColors.text }]}>
            {selectedDate
              ? selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : 'Day details'}
          </Text>
          <Text style={[styles.detailSubtitle, { color: themeColors.textSecondary }]}>
            {selectedDate
              ? `${selectedBookings.length} ${selectedBookings.length === 1 ? 'trip' : 'trips'} on this date`
              : 'Pick a date from the calendar'}
          </Text>

          {!selectedDate && (
            <Card style={styles.emptyCard}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primary[50] }]}>
                <Ionicons name="calendar-outline" size={22} color={colors.primary[500]} />
              </View>
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No date selected</Text>
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                Tap a calendar date to see trips for that day.
              </Text>
            </Card>
          )}

          {selectedDate && selectedBookings.length === 0 && (
            <Card style={styles.emptyCard}>
              <View style={[styles.emptyIcon, { backgroundColor: themeColors.inputBackground }]}>
                <Ionicons name="airplane-outline" size={22} color={themeColors.textTertiary} />
              </View>
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No trips on this day</Text>
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>Try a different date.</Text>
            </Card>
          )}

          {selectedDate &&
            selectedBookings.map((booking) => {
              const start = booking.travelStartDate ? new Date(booking.travelStartDate) : null;
              const end = booking.travelEndDate ? new Date(booking.travelEndDate) : null;
              const isStart = !!start && sameDay(start, selectedDate);
              const isEnd = !!end && sameDay(end, selectedDate);
              const adults = booking.totalTravelers?.adults ?? 0;
              const children = booking.totalTravelers?.children ?? 0;

              return (
                <Card key={booking._id} style={styles.bookingCard}>
                  <View style={styles.bookingTop}>
                    <View style={styles.bookingTitleWrap}>
                      <Text style={[styles.bookingTitle, { color: themeColors.text }]} numberOfLines={1}>
                        {booking.packageSnapshot?.title || 'Package Booking'}
                      </Text>
                      {!!booking.packageSnapshot?.primaryDestination && (
                        <View style={styles.metaLine}>
                          <Ionicons name="location-outline" size={12} color={themeColors.textTertiary} />
                          <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                            {booking.packageSnapshot.primaryDestination}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: statusColor(booking.status) }]}>
                      <Text style={styles.statusPillText}>{statusLabel(booking.status)}</Text>
                    </View>
                  </View>

                  {!!booking.bookingReference && (
                    <Text style={[styles.bookingRef, { color: themeColors.textTertiary }]}>
                      {booking.bookingReference}
                    </Text>
                  )}

                  <View style={styles.metaLine}>
                    <Ionicons name="people-outline" size={14} color={themeColors.textSecondary} />
                    <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                      {adults} {adults === 1 ? 'adult' : 'adults'}
                      {children > 0 ? `, ${children} ${children === 1 ? 'child' : 'children'}` : ''}
                    </Text>
                  </View>

                  <View style={styles.metaLine}>
                    <Ionicons name="cash-outline" size={14} color={themeColors.text} />
                    <Text style={[styles.bookingAmount, { color: themeColors.text }]}>
                      {rupee(booking.pricing?.totalAmount)}
                    </Text>
                  </View>

                  {(isStart || isEnd) && (
                    <View style={styles.flagRow}>
                      {isStart && (
                        <View style={[styles.flag, { backgroundColor: colors.successLight }]}>
                          <Text style={[styles.flagText, { color: colors.success }]}>Trip starts</Text>
                        </View>
                      )}
                      {isEnd && (
                        <View style={[styles.flag, { backgroundColor: colors.errorLight }]}>
                          <Text style={[styles.flagText, { color: colors.error }]}>Trip ends</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {!!booking.customerName && (
                    <View style={[styles.customerRow, { borderTopColor: themeColors.border }]}>
                      <Text style={[styles.customerName, { color: themeColors.textSecondary }]} numberOfLines={1}>
                        {booking.customerName}
                        {booking.customerPhone || booking.customerEmail
                          ? ` · ${booking.customerPhone || booking.customerEmail}`
                          : ''}
                      </Text>
                    </View>
                  )}
                </Card>
              );
            })}
        </View>

        <View style={{ height: spacing['3xl'] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold as any },

  scroll: { padding: spacing.lg },

  // Calendar
  calendarCard: { marginBottom: spacing.md },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthNavBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  monthTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold as any },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { width: `${100 / 7}%`, padding: 2 },
  weekDayText: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium as any,
    paddingVertical: spacing.xs,
  },
  cell: {
    minHeight: 60,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 4,
    alignItems: 'flex-start',
  },
  dayNumWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold as any },
  dotsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotMore: { fontSize: 9, fontWeight: fontWeight.bold as any },

  // Legend
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: fontSize.xs },

  // Detail section
  detailSection: { marginTop: spacing.xs },
  detailTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold as any },
  detailSubtitle: { fontSize: fontSize.xs, marginTop: 2, marginBottom: spacing.md },

  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold as any },
  emptyText: { fontSize: fontSize.xs, marginTop: 2, textAlign: 'center' },

  // Booking card
  bookingCard: { marginBottom: spacing.md },
  bookingTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bookingTitleWrap: { flex: 1 },
  bookingTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold as any },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  statusPillText: { fontSize: 10, fontWeight: fontWeight.bold as any, color: '#ffffff' },
  bookingRef: { fontSize: fontSize.xs, marginTop: spacing.sm },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  metaText: { fontSize: fontSize.xs, flex: 1 },
  bookingAmount: { fontSize: fontSize.md, fontWeight: fontWeight.bold as any },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  flag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  flagText: { fontSize: 10, fontWeight: fontWeight.bold as any },
  customerRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  customerName: { fontSize: fontSize.xs, fontWeight: fontWeight.medium as any },
});
