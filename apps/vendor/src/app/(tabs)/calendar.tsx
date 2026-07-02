import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  StatusBadge,
  LoadingSpinner,
} from '../../components/ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '../../theme/vendorColors';
import { businessAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_SIZE = (SCREEN_WIDTH - spacing.xl * 2 - spacing.xs * 6) / 7;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Tabs mirror the PWA calendar page (Activities / Packages).
const TABS = [
  {
    id: 'activities' as const,
    label: 'Activities',
    icon: 'ticket-outline' as const,
    description: 'View bookings at a glance and block unavailable dates',
  },
  {
    id: 'packages' as const,
    label: 'Packages',
    icon: 'map-outline' as const,
    description: 'View upcoming trips and departures across your packages',
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Booking {
  _id: string;
  bookingReference?: string;
  status: string;
  activityName?: string;
  activity?: { title?: string; name?: string };
  activitySnapshot?: { title?: string };
  customerName?: string;
  customer?: { name?: string; firstName?: string };
  date?: string;
  bookingDate?: string;
  totalAmount?: number;
  payment?: { total?: number };
  pricing?: { totalAmount?: number };
  participants?: {
    adults?: { count?: number };
    children?: { count?: number };
  };
  timeSlot?: { startTime?: string; label?: string };
}

interface CalendarDay {
  date: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isBlocked: boolean;
  bookingCount: number;
  hasConfirmed: boolean;
  hasPending: boolean;
  hasCompleted: boolean;
  hasCancelled: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ─── Calendar Day Cell ────────────────────────────────────────────────────────

function DayCell({
  day,
  selected,
  onPress,
}: {
  day: CalendarDay;
  selected: boolean;
  onPress: () => void;
}) {
  if (day.date === 0) {
    return <View style={styles.dayCell} />;
  }

  return (
    <TouchableOpacity
      style={[
        styles.dayCell,
        !day.isCurrentMonth && styles.dayCellOtherMonth,
        day.isPast && styles.dayCellPast,
        day.isBlocked && styles.dayCellBlocked,
        day.isToday && styles.dayCellToday,
        selected && styles.dayCellSelected,
      ]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Text
        style={[
          styles.dayText,
          !day.isCurrentMonth && styles.dayTextOtherMonth,
          day.isPast && styles.dayTextPast,
          day.isToday && styles.dayTextToday,
          selected && styles.dayTextSelected,
        ]}
      >
        {day.date}
      </Text>
      {day.isBlocked ? (
        <View style={styles.blockedTag}>
          <Ionicons name="ban" size={8} color={colors.error} />
        </View>
      ) : day.bookingCount > 0 ? (
        <View style={styles.dotRow}>
          {day.hasPending && <View style={[styles.dot, { backgroundColor: colors.warning }]} />}
          {day.hasConfirmed && <View style={[styles.dot, { backgroundColor: colors.success }]} />}
          {day.hasCompleted && <View style={[styles.dot, { backgroundColor: colors.info }]} />}
          {day.hasCancelled && <View style={[styles.dot, { backgroundColor: colors.error }]} />}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Booking Item ─────────────────────────────────────────────────────────────

function BookingItem({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const activityName =
    booking.activitySnapshot?.title ||
    booking.activityName ||
    booking.activity?.title ||
    booking.activity?.name ||
    'Activity';
  const customerName =
    booking.customerName || booking.customer?.name || booking.customer?.firstName || 'Customer';
  const amount =
    booking.pricing?.totalAmount ?? booking.totalAmount ?? booking.payment?.total;

  const adults = booking.participants?.adults?.count || 0;
  const children = booking.participants?.children?.count || 0;
  const participantsLabel =
    adults || children
      ? `${adults} adult${adults !== 1 ? 's' : ''}${children > 0 ? `, ${children} child${children !== 1 ? 'ren' : ''}` : ''}`
      : '';

  return (
    <TouchableOpacity style={styles.bookingItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.bookingItemContent}>
        <View style={styles.bookingItemMain}>
          <Text style={styles.bookingItemCustomer} numberOfLines={1}>
            {customerName}
          </Text>
          <Text style={styles.bookingItemActivity} numberOfLines={1}>
            {activityName}
            {participantsLabel ? ` · ${participantsLabel}` : ''}
          </Text>
          {booking.bookingReference ? (
            <Text style={styles.bookingRef} numberOfLines={1}>
              {booking.bookingReference}
            </Text>
          ) : null}
        </View>
        <View style={styles.bookingItemRight}>
          {amount != null ? (
            <Text style={styles.bookingAmount}>₹{Number(amount).toLocaleString('en-IN')}</Text>
          ) : (
            <Text style={styles.bookingAmount}>—</Text>
          )}
          <StatusBadge status={booking.status} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const router = useRouter();
  const { businessAccount } = useBusinessStore();

  const today = new Date();
  const [activeTab, setActiveTab] = useState<'activities' | 'packages'>('activities');
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>(
    dateKey(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const activeTabMeta = TABS.find((t) => t.id === activeTab) || TABS[0];

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchBookings = useCallback(async () => {
    if (!businessAccount?._id) return;
    try {
      // Mirror the PWA: query by explicit start/end date range.
      const start = dateKey(currentYear, currentMonth, 1);
      const end = dateKey(currentYear, currentMonth, getDaysInMonth(currentYear, currentMonth));
      const res = await businessAPI.getMyBookings({
        startDate: start,
        endDate: end,
        limit: '200',
      });
      const data = res?.data || res?.bookings || res || [];
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[Calendar] fetch error:', err);
    }
  }, [businessAccount?._id, currentMonth, currentYear]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await fetchBookings();
    setLoading(false);
  }, [fetchBookings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  }, [fetchBookings]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Navigation ───────────────────────────────────────────────────────────

  const goToPrevMonth = useCallback(() => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }, [currentMonth, currentYear]);

  const goToNextMonth = useCallback(() => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }, [currentMonth, currentYear]);

  const goToToday = useCallback(() => {
    const now = new Date();
    setCurrentMonth(now.getMonth());
    setCurrentYear(now.getFullYear());
    setSelectedDate(dateKey(now.getFullYear(), now.getMonth(), now.getDate()));
  }, []);

  // ── Block / unblock a date (client-side toggle, mirrors PWA) ──────────────

  const toggleBlock = useCallback(
    (key: string) => {
      setBlockedDates((prev) =>
        prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
      );
    },
    []
  );

  // ── Build bookings-per-day map ───────────────────────────────────────────

  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings.forEach((b) => {
      const d = b.bookingDate || b.date;
      if (!d) return;
      const dt = new Date(d);
      const key = dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return map;
  }, [bookings]);

  // ── Build calendar grid ──────────────────────────────────────────────────

  const calendarDays = useMemo(() => {
    const days: CalendarDay[] = [];
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const todayObj = new Date();
    const todayMidnight = new Date(
      todayObj.getFullYear(),
      todayObj.getMonth(),
      todayObj.getDate()
    );

    for (let i = 0; i < firstDay; i++) {
      days.push({
        date: 0,
        month: currentMonth,
        year: currentYear,
        isCurrentMonth: false,
        isToday: false,
        isPast: false,
        isBlocked: false,
        bookingCount: 0,
        hasConfirmed: false,
        hasPending: false,
        hasCompleted: false,
        hasCancelled: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const key = dateKey(currentYear, currentMonth, d);
      const dayBookings = bookingsByDate[key] || [];
      const cellDate = new Date(currentYear, currentMonth, d);
      const isToday =
        d === todayObj.getDate() &&
        currentMonth === todayObj.getMonth() &&
        currentYear === todayObj.getFullYear();
      days.push({
        date: d,
        month: currentMonth,
        year: currentYear,
        isCurrentMonth: true,
        isToday,
        isPast: cellDate < todayMidnight,
        isBlocked: blockedDates.includes(key),
        bookingCount: dayBookings.length,
        hasConfirmed: dayBookings.some((b) => b.status === 'confirmed'),
        hasPending: dayBookings.some((b) => b.status === 'pending'),
        hasCompleted: dayBookings.some((b) => b.status === 'completed'),
        hasCancelled: dayBookings.some((b) => b.status === 'cancelled'),
      });
    }

    return days;
  }, [currentYear, currentMonth, bookingsByDate, blockedDates]);

  // ── Selected day bookings ────────────────────────────────────────────────

  const selectedBookings = useMemo(() => {
    return bookingsByDate[selectedDate] || [];
  }, [bookingsByDate, selectedDate]);

  const selectedIsBlocked = blockedDates.includes(selectedDate);

  const selectedDateFormatted = useMemo(() => {
    const parts = selectedDate.split('-');
    const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return dt.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [selectedDate]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.subtitle}>{activeTabMeta.description}</Text>
        </View>

        {/* Tabs (Activities / Packages) */}
        <View style={styles.tabsRow}>
          {TABS.map((t) => {
            const isActive = t.id === activeTab;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(t.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={t.icon}
                  size={16}
                  color={isActive ? '#ffffff' : colors.textSecondary}
                />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 'packages' ? (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyDay}>
              <Ionicons name="map-outline" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyDayText}>
                View upcoming trips and departures across your packages
              </Text>
              <TouchableOpacity
                style={styles.emptyCTA}
                onPress={() => router.push('/packages')}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyCTAText}>Go to Packages</Text>
                <Ionicons name="arrow-forward" size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </Card>
        ) : (
          <>
            {/* Month Navigation */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={goToPrevMonth} style={styles.monthArrow}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={goToToday}>
                <Text style={styles.monthTitle}>
                  {MONTHS[currentMonth]}{' '}
                  <Text style={styles.monthTitleYear}>{currentYear}</Text>
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={goToNextMonth} style={styles.monthArrow}>
                <Ionicons name="chevron-forward" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Calendar Grid */}
            <Card style={styles.calendarCard}>
              <View style={styles.weekdayRow}>
                {WEEKDAYS.map((day) => (
                  <View key={day} style={styles.weekdayCell}>
                    <Text style={styles.weekdayText}>{day.toUpperCase()}</Text>
                  </View>
                ))}
              </View>

              {loading ? (
                <View style={styles.calendarLoading}>
                  <LoadingSpinner size="small" />
                </View>
              ) : (
                <View style={styles.daysGrid}>
                  {calendarDays.map((day, i) => (
                    <DayCell
                      key={i}
                      day={day}
                      selected={
                        day.date > 0 &&
                        selectedDate === dateKey(day.year, day.month, day.date)
                      }
                      onPress={() => {
                        if (day.date > 0 && day.isCurrentMonth) {
                          setSelectedDate(dateKey(day.year, day.month, day.date));
                        }
                      }}
                    />
                  ))}
                </View>
              )}

              {/* Legend */}
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                  <Text style={styles.legendText}>Confirmed</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
                  <Text style={styles.legendText}>Pending</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.info }]} />
                  <Text style={styles.legendText}>Completed</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
                  <Text style={styles.legendText}>Cancelled</Text>
                </View>
              </View>
            </Card>

            {/* Selected Date Panel */}
            <Card style={styles.selectedCard}>
              <View style={styles.selectedHeader}>
                <View style={styles.selectedHeaderText}>
                  <Text style={styles.selectedDateTitle}>{selectedDateFormatted}</Text>
                  <Text style={styles.selectedCount}>
                    {selectedBookings.length} booking{selectedBookings.length !== 1 ? 's' : ''} on this date
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.blockBtn,
                    selectedIsBlocked ? styles.unblockBtn : styles.blockBtnActive,
                  ]}
                  onPress={() => toggleBlock(selectedDate)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={selectedIsBlocked ? 'lock-open-outline' : 'ban-outline'}
                    size={16}
                    color={selectedIsBlocked ? colors.success : colors.error}
                  />
                  <Text
                    style={[
                      styles.blockBtnText,
                      { color: selectedIsBlocked ? colors.success : colors.error },
                    ]}
                  >
                    {selectedIsBlocked ? 'Unblock date' : 'Block date'}
                  </Text>
                </TouchableOpacity>
              </View>

              {selectedBookings.length === 0 ? (
                <View style={styles.emptyDay}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="calendar-outline" size={22} color={colors.primary[500]} />
                  </View>
                  <Text style={styles.emptyDayText}>No bookings on this date</Text>
                </View>
              ) : (
                <View style={styles.bookingsList}>
                  {selectedBookings.map((booking) => (
                    <BookingItem
                      key={booking._id}
                      booking={booking}
                      onPress={() => router.push(`/booking/${booking._id}`)}
                    />
                  ))}
                </View>
              )}
            </Card>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  tabActive: {
    backgroundColor: colors.primary[600],
    ...shadow.sm,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#ffffff',
  },

  // Month Nav
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  monthArrow: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  monthTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  monthTitleYear: {
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },

  // Calendar Card
  calendarCard: {
    marginHorizontal: spacing.xl,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekdayCell: {
    width: DAY_SIZE,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarLoading: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Day Cell
  dayCell: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    marginVertical: 1,
  },
  dayCellOtherMonth: {
    opacity: 0.3,
  },
  dayCellPast: {
    opacity: 0.5,
  },
  dayCellBlocked: {
    backgroundColor: colors.errorLight || 'rgba(239,68,68,0.08)',
  },
  dayCellToday: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  dayCellSelected: {
    backgroundColor: colors.primary[500],
  },
  dayText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  dayTextOtherMonth: {
    color: colors.textTertiary,
  },
  dayTextPast: {
    color: colors.textTertiary,
  },
  dayTextToday: {
    color: colors.primary[600],
    fontWeight: fontWeight.bold,
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: fontWeight.bold,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  blockedTag: {
    marginTop: 2,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },

  // Selected Card
  selectedCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  selectedHeaderText: {
    flex: 1,
    minWidth: 160,
  },
  selectedDateTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  selectedCount: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  blockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  blockBtnActive: {
    backgroundColor: colors.errorLight || 'rgba(239,68,68,0.1)',
  },
  unblockBtn: {
    backgroundColor: colors.successLight || 'rgba(34,197,94,0.1)',
  },
  blockBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },

  // Bookings List
  bookingsList: {
    gap: spacing.sm,
  },
  bookingItem: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  bookingItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.sm,
  },
  bookingItemMain: {
    flex: 1,
    minWidth: 0,
  },
  bookingItemCustomer: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  bookingItemActivity: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bookingRef: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  bookingItemRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  bookingAmount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },

  // Empty
  emptyCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  emptyDay: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyDayText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[600],
  },
  emptyCTAText: {
    color: '#ffffff',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
