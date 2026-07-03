import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
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
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { businessAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_SIZE = (SCREEN_WIDTH - spacing.xl * 2 - spacing.xs * 6) / 7;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Booking {
  _id: string;
  bookingReference: string;
  status: string;
  activityName?: string;
  activity?: { title?: string; name?: string };
  customerName?: string;
  customer?: { name?: string; firstName?: string };
  date?: string;
  bookingDate?: string;
  totalAmount?: number;
  payment?: { total?: number };
  timeSlot?: { startTime?: string; label?: string };
}

interface CalendarDay {
  date: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  bookingCount: number;
  hasConfirmed: boolean;
  hasPending: boolean;
  hasCompleted: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
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
          day.isToday && styles.dayTextToday,
          selected && styles.dayTextSelected,
        ]}
      >
        {day.date}
      </Text>
      {/* Dots */}
      {day.bookingCount > 0 && (
        <View style={styles.dotRow}>
          {day.hasPending && <View style={[styles.dot, { backgroundColor: colors.warning }]} />}
          {day.hasConfirmed && <View style={[styles.dot, { backgroundColor: colors.success }]} />}
          {day.hasCompleted && <View style={[styles.dot, { backgroundColor: colors.info }]} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Booking Item ─────────────────────────────────────────────────────────────

function BookingItem({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const activityName =
    booking.activityName || booking.activity?.title || booking.activity?.name || 'Activity';
  const customerName =
    booking.customerName || booking.customer?.name || booking.customer?.firstName || 'Customer';
  const time = booking.timeSlot?.startTime || booking.timeSlot?.label || '';

  const statusColor =
    booking.status === 'confirmed'
      ? colors.success
      : booking.status === 'pending'
      ? colors.warning
      : booking.status === 'completed'
      ? colors.info
      : colors.gray[400];

  return (
    <TouchableOpacity style={styles.bookingItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.bookingStatusBar, { backgroundColor: statusColor }]} />
      <View style={styles.bookingItemContent}>
        <View style={styles.bookingItemTop}>
          {time ? <Text style={styles.bookingTime}>{time}</Text> : null}
          <StatusBadge status={booking.status} />
        </View>
        <Text style={styles.bookingItemActivity} numberOfLines={1}>
          {activityName}
        </Text>
        <Text style={styles.bookingItemCustomer} numberOfLines={1}>
          {customerName}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const router = useRouter();
  const { businessAccount } = useBusinessStore();

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>(
    dateKey(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchBookings = useCallback(async () => {
    if (!businessAccount?._id) return;
    try {
      const res = await businessAPI.getMyBookings({
        month: String(currentMonth + 1),
        year: String(currentYear),
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

  // ── Build bookings-per-day map ───────────────────────────────────────────

  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings.forEach((b) => {
      const d = b.date || b.bookingDate;
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

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push({
        date: 0,
        month: currentMonth,
        year: currentYear,
        isCurrentMonth: false,
        isToday: false,
        bookingCount: 0,
        hasConfirmed: false,
        hasPending: false,
        hasCompleted: false,
      });
    }

    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const key = dateKey(currentYear, currentMonth, d);
      const dayBookings = bookingsByDate[key] || [];
      days.push({
        date: d,
        month: currentMonth,
        year: currentYear,
        isCurrentMonth: true,
        isToday:
          d === todayObj.getDate() &&
          currentMonth === todayObj.getMonth() &&
          currentYear === todayObj.getFullYear(),
        bookingCount: dayBookings.length,
        hasConfirmed: dayBookings.some((b) => b.status === 'confirmed'),
        hasPending: dayBookings.some((b) => b.status === 'pending'),
        hasCompleted: dayBookings.some((b) => b.status === 'completed'),
      });
    }

    return days;
  }, [currentYear, currentMonth, bookingsByDate]);

  // ── Selected day bookings ────────────────────────────────────────────────

  const selectedBookings = useMemo(() => {
    return bookingsByDate[selectedDate] || [];
  }, [bookingsByDate, selectedDate]);

  const selectedDateFormatted = useMemo(() => {
    const parts = selectedDate.split('-');
    const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return dt.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
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
          <Text style={styles.title}>Availability Calendar</Text>
          <Text style={styles.subtitle}>Manage your activity schedule</Text>
        </View>

        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={goToToday}>
            <Text style={styles.monthTitle}>
              {MONTHS[currentMonth]} {currentYear}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToNextMonth} style={styles.monthArrow}>
            <Ionicons name="chevron-forward" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <Card style={styles.calendarCard}>
          {/* Weekday headers */}
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day) => (
              <View key={day} style={styles.weekdayCell}>
                <Text style={styles.weekdayText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Days grid */}
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
              <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
              <Text style={styles.legendText}>Pending</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>Confirmed</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.info }]} />
              <Text style={styles.legendText}>Completed</Text>
            </View>
          </View>
        </Card>

        {/* Selected Date Bookings */}
        <View style={styles.selectedSection}>
          <Text style={styles.selectedDateTitle}>{selectedDateFormatted}</Text>
          <Text style={styles.selectedCount}>
            {selectedBookings.length} booking{selectedBookings.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {selectedBookings.length === 0 ? (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyDay}>
              <Ionicons name="calendar-outline" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyDayText}>No bookings on this day</Text>
            </View>
          </Card>
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
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
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

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
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
  },

  // Selected Section
  selectedSection: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing['2xl'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  selectedDateTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  selectedCount: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // Bookings List
  bookingsList: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  bookingItem: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadow.sm,
  },
  bookingStatusBar: {
    width: 4,
  },
  bookingItemContent: {
    flex: 1,
    padding: spacing.md,
  },
  bookingItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  bookingTime: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },
  bookingItemActivity: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  bookingItemCustomer: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Empty
  emptyCard: {
    marginHorizontal: spacing.xl,
  },
  emptyDay: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyDayText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
