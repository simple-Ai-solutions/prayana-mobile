/**
 * DraggableActivityList - Drag-to-reorder activity cards with distance display
 * Uses React Native built-in PanResponder + Animated (NO react-native-reanimated
 * to avoid Worklets version mismatch with Expo Go).
 *
 * Matches PWA design: draggable cards with distance/time between activities,
 * order badges, time slot editing, and directions links.
 *
 * FIX: Uses long-press on drag handle to initiate drag, which avoids the
 * ScrollView gesture conflict. Parent must pass onDragStart/onDragEnd to
 * disable/enable ScrollView scrolling.
 */
import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Linking,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '@prayana/shared-ui';
import { calculateActivityDistance, hasValidCoords } from '@prayana/shared-utils';
import ActivityImage from './ActivityImage';

type TimeSlotKey = 'morning' | 'afternoon' | 'evening' | 'night';

interface Activity {
  activityId?: string;
  name: string;
  description?: string;
  timeSlot: TimeSlotKey;
  startTime?: string;
  duration?: number;
  rating?: number;
  category?: string;
  coordinates?: { lat: number; lng: number };
  image?: string;
  notes?: string;
  order?: number;
  source?: string;
  estimatedCost?: string | number;
}

const TIME_SLOT_COLORS: Record<TimeSlotKey, { emoji: string; label: string; color: string; bgColor: string; iconName: string }> = {
  morning: { emoji: '\u2600\uFE0F', label: 'Morning', color: '#f59e0b', bgColor: '#fffbeb', iconName: 'sunny' },
  afternoon: { emoji: '\u2601\uFE0F', label: 'Afternoon', color: '#3b82f6', bgColor: '#eff6ff', iconName: 'partly-sunny' },
  evening: { emoji: '\uD83C\uDF19', label: 'Evening', color: '#8b5cf6', bgColor: '#f5f3ff', iconName: 'moon' },
  night: { emoji: '\u2B50', label: 'Night', color: '#1e3a5f', bgColor: '#f0f4f8', iconName: 'star' },
};

// Estimated card + connector height for drop position calculation
const CARD_HEIGHT = 110;

interface DraggableActivityListProps {
  dayIndex: number;
  activities: Activity[];
  destinationName?: string;
  expandedCards: Record<number, boolean>;
  onToggleExpand: (index: number) => void;
  onEditActivity: (index: number, activity: Activity) => void;
  onRemoveActivity: (index: number) => void;
  onReorder: (dayIndex: number, fromIndex: number, toIndex: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

// ─── Single Draggable Card ───

interface DraggableCardProps {
  activity: Activity;
  index: number;
  totalCount: number;
  dayIndex: number;
  destinationName?: string;
  isExpanded: boolean;
  nextActivity?: Activity;
  onToggleExpand: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onReorder: (dayIndex: number, from: number, to: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const DraggableCard: React.FC<DraggableCardProps> = ({
  activity,
  index,
  totalCount,
  dayIndex,
  destinationName,
  isExpanded,
  nextActivity,
  onToggleExpand,
  onEdit,
  onRemove,
  onReorder,
  onDragStart,
  onDragEnd,
}) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const elevation = useRef(new Animated.Value(2)).current;
  const [isDragging, setIsDragging] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragActive = useRef(false);
  const slotCfg = TIME_SLOT_COLORS[activity.timeSlot] || TIME_SLOT_COLORS.morning;

  // Store current props in refs so PanResponder closure can read latest values
  const propsRef = useRef({ index, totalCount, dayIndex, onReorder, onDragStart, onDragEnd });
  propsRef.current = { index, totalCount, dayIndex, onReorder, onDragStart, onDragEnd };

  // Calculate distance to next activity
  const distanceInfo = useMemo(() => {
    if (!nextActivity) return null;
    return calculateActivityDistance(activity, nextActivity);
  }, [activity, nextActivity]);

  const panResponder = useRef(
    PanResponder.create({
      // Capture touch immediately on the drag handle
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => isDragActive.current,
      onMoveShouldSetPanResponderCapture: () => isDragActive.current,
      onPanResponderGrant: () => {
        // Start long-press timer - drag activates after 200ms hold
        longPressTimer.current = setTimeout(() => {
          isDragActive.current = true;
          setIsDragging(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          propsRef.current.onDragStart?.();
          Animated.parallel([
            Animated.spring(scale, { toValue: 1.03, useNativeDriver: true, friction: 8 }),
            Animated.timing(elevation, { toValue: 12, duration: 150, useNativeDriver: false }),
          ]).start();
        }, 200);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isDragActive.current) {
          // If moved too much before long-press completes, cancel drag
          if (Math.abs(gestureState.dy) > 5 || Math.abs(gestureState.dx) > 5) {
            if (longPressTimer.current) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
          }
          return;
        }
        translateY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        if (!isDragActive.current) {
          // Was not dragging - just a tap
          return;
        }

        const { index: curIndex, totalCount: curTotal, dayIndex: curDay, onReorder: curReorder } = propsRef.current;
        const rawNewIndex = Math.round(curIndex + gestureState.dy / CARD_HEIGHT);
        const newIndex = Math.max(0, Math.min(curTotal - 1, rawNewIndex));

        isDragActive.current = false;
        setIsDragging(false);
        propsRef.current.onDragEnd?.();
        Animated.parallel([
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8 }),
          Animated.timing(elevation, { toValue: 2, duration: 150, useNativeDriver: false }),
        ]).start();

        if (newIndex !== curIndex) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          curReorder(curDay, curIndex, newIndex);
        }
      },
      onPanResponderTerminate: () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        isDragActive.current = false;
        setIsDragging(false);
        propsRef.current.onDragEnd?.();
        Animated.parallel([
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        ]).start();
      },
    })
  ).current;

  const handleOpenDirections = useCallback(() => {
    if (!activity.coordinates || !hasValidCoords(activity.coordinates)) return;
    const { lat, lng } = activity.coordinates;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(activity.name)}`;
    Linking.openURL(url);
  }, [activity]);

  const isAISuggested = activity.source === 'ai_suggested' || activity.source === 'ai';

  return (
    <>
      <Animated.View
        style={[
          styles.card,
          {
            transform: [
              { translateY },
              { scale },
            ],
            zIndex: isDragging ? 999 : 0,
            ...(isDragging ? styles.cardDragging : {}),
          },
        ]}
      >
        {/* Order Badge (top-left, overlapping) */}
        <View style={styles.orderBadge}>
          <Text style={styles.orderBadgeText}>{index + 1}</Text>
        </View>

        {/* Drag Handle — PanResponder attached here */}
        <View style={styles.dragHandle} {...panResponder.panHandlers}>
          <View style={styles.dragDots}>
            <View style={[styles.dragDot, isDragging && styles.dragDotActive]} />
            <View style={[styles.dragDot, isDragging && styles.dragDotActive]} />
            <View style={[styles.dragDot, isDragging && styles.dragDotActive]} />
            <View style={[styles.dragDot, isDragging && styles.dragDotActive]} />
            <View style={[styles.dragDot, isDragging && styles.dragDotActive]} />
            <View style={[styles.dragDot, isDragging && styles.dragDotActive]} />
          </View>
        </View>

        {/* Image */}
        <ActivityImage
          activity={activity}
          destinationName={destinationName}
          size={52}
          borderRadius={borderRadius.md}
          fallbackColor={slotCfg.bgColor}
          fallbackIconColor={slotCfg.color}
        />

        {/* Content */}
        <View style={styles.content}>
          {/* Row 1: Name + AI Badge */}
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {activity.name}
            </Text>
            {isAISuggested && (
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={8} color="#06B6D4" />
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
            )}
          </View>

          {/* Row 2: Time Slot + Duration + Rating */}
          <View style={styles.badgeRow}>
            <TouchableOpacity
              style={[styles.slotBadge, { backgroundColor: slotCfg.bgColor }]}
              onPress={onEdit}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 10 }}>{slotCfg.emoji}</Text>
              <Text style={[styles.slotText, { color: slotCfg.color }]}>
                {slotCfg.label}
              </Text>
            </TouchableOpacity>

            {activity.startTime ? (
              <View style={styles.timeBadge}>
                <Ionicons name="time-outline" size={9} color="#3b82f6" />
                <Text style={styles.timeText}>{activity.startTime}</Text>
              </View>
            ) : null}

            {activity.duration ? (
              <View style={styles.durationBadge}>
                <Ionicons name="hourglass-outline" size={9} color={colors.textTertiary} />
                <Text style={styles.durationText}>{activity.duration}h</Text>
              </View>
            ) : null}

            {activity.rating ? (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={10} color="#f59e0b" />
                <Text style={styles.ratingText}>{activity.rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>

          {/* Row 3: Category + Cost + Directions */}
          <View style={styles.metaRow}>
            {activity.category ? (
              <View style={styles.catBadge}>
                <Text style={styles.catText}>{activity.category}</Text>
              </View>
            ) : null}

            {activity.estimatedCost ? (
              <View style={styles.costBadge}>
                <Text style={styles.costText}>
                  {typeof activity.estimatedCost === 'number' ? `₹${activity.estimatedCost}` : activity.estimatedCost}
                </Text>
              </View>
            ) : null}

            {hasValidCoords(activity.coordinates) && (
              <TouchableOpacity
                style={styles.directionsBtn}
                onPress={handleOpenDirections}
                activeOpacity={0.7}
              >
                <Ionicons name="navigate-outline" size={10} color="#3b82f6" />
                <Text style={styles.directionsText}>Directions</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Expand/Collapse */}
          {(activity.description || activity.notes) ? (
            <TouchableOpacity
              onPress={onToggleExpand}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              style={styles.expandBtn}
            >
              <Text style={styles.expandText}>
                {isExpanded ? 'Less' : 'More'}
              </Text>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={colors.primary[500]}
              />
            </TouchableOpacity>
          ) : null}

          {/* Expanded Content */}
          {isExpanded && (
            <View style={styles.expandedContent}>
              {activity.description ? (
                <Text style={styles.descText}>{activity.description}</Text>
              ) : null}
              {activity.notes ? (
                <View style={styles.notesRow}>
                  <Ionicons name="document-text-outline" size={12} color={colors.textTertiary} />
                  <Text style={styles.notesText}>{activity.notes}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Right Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onEdit}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={styles.editBtn}
          >
            <Ionicons name="create-outline" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onRemove}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={14} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Route Connector with Distance Display between cards */}
      {index < totalCount - 1 && (
        <View style={styles.routeConnector}>
          <View style={styles.routeLineContainer}>
            <View style={styles.routeGradientTop} />
            <View style={styles.routeDot} />
            <View style={styles.routeGradientBottom} />
          </View>
          {distanceInfo && (
            <View style={styles.distanceBadge}>
              <Ionicons name="navigate" size={8} color="#06B6D4" />
              <Text style={styles.distanceText}>{distanceInfo.distance}</Text>
              <Text style={styles.distanceSep}>·</Text>
              <Text style={styles.distanceTimeText}>{distanceInfo.time}</Text>
            </View>
          )}
        </View>
      )}
    </>
  );
};

// ─── Main List ───

const DraggableActivityList: React.FC<DraggableActivityListProps> = ({
  dayIndex,
  activities,
  destinationName,
  expandedCards,
  onToggleExpand,
  onEditActivity,
  onRemoveActivity,
  onReorder,
  onDragStart,
  onDragEnd,
}) => {
  if (activities.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="add-circle-outline" size={44} color={colors.gray[300]} />
        <Text style={styles.emptyTitle}>No activities planned</Text>
        <Text style={styles.emptySubtitle}>
          Tap + below to add activities or use AI to generate
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Drag hint */}
      {activities.length > 1 && (
        <View style={styles.dragHint}>
          <Ionicons name="hand-left-outline" size={13} color={colors.textTertiary} />
          <Text style={styles.dragHintText}>Hold & drag the dots to reorder</Text>
        </View>
      )}

      {activities.map((activity, index) => (
        <DraggableCard
          key={activity.activityId || `act-${index}-${activity.name}`}
          activity={activity}
          index={index}
          totalCount={activities.length}
          dayIndex={dayIndex}
          destinationName={destinationName}
          isExpanded={!!expandedCards[index]}
          nextActivity={index < activities.length - 1 ? activities[index + 1] : undefined}
          onToggleExpand={() => onToggleExpand(index)}
          onEdit={() => onEditActivity(index, activity)}
          onRemove={() => onRemoveActivity(index)}
          onReorder={onReorder}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}
    </View>
  );
};

// ─── Styles ───

const styles = StyleSheet.create({
  container: {},
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  // Drag hint
  dragHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  dragHintText: {
    fontSize: 11,
    color: colors.textTertiary,
  },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    paddingLeft: spacing.sm,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
  },
  cardDragging: {
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 12,
    borderColor: '#06B6D4',
  },

  // Order Badge (top-left corner, PWA-style cyan gradient)
  orderBadge: {
    position: 'absolute',
    top: -8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#06B6D4',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  orderBadgeText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },

  // Drag Handle (6-dot grid pattern)
  dragHandle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    paddingVertical: 8,
  },
  dragDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 12,
    gap: 3,
    justifyContent: 'center',
  },
  dragDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: colors.gray[300],
  },
  dragDotActive: {
    backgroundColor: '#06B6D4',
  },

  // Content
  content: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#f0fdfc',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#99f6ef',
  },
  aiBadgeText: {
    fontSize: 8,
    fontWeight: fontWeight.bold,
    color: '#06B6D4',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  slotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  timeText: {
    fontSize: 9,
    color: '#3b82f6',
    fontWeight: fontWeight.medium,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.gray[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },

  // Meta Row (Category + Cost + Directions)
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  catBadge: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  catText: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  costBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  costText: {
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    color: '#059669',
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  directionsText: {
    fontSize: 9,
    color: '#3b82f6',
    fontWeight: fontWeight.medium,
  },

  // Expand
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  expandText: {
    fontSize: fontSize.xs,
    color: colors.primary[500],
    fontWeight: fontWeight.medium,
  },
  expandedContent: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  descText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    lineHeight: 16,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 4,
  },
  notesText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },

  // Actions
  actions: {
    alignItems: 'center',
    gap: 6,
  },
  editBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  deleteBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: '#fef2f2',
  },

  // Route Connector with Distance (PWA-matching design)
  routeConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingLeft: 28,
    gap: 8,
  },
  routeLineContainer: {
    alignItems: 'center',
  },
  routeGradientTop: {
    width: 2,
    height: 6,
    backgroundColor: '#5eead4',
    borderRadius: 1,
  },
  routeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#06B6D4',
    borderWidth: 1.5,
    borderColor: '#99f6ef',
  },
  routeGradientBottom: {
    width: 2,
    height: 6,
    backgroundColor: '#5eead4',
    borderRadius: 1,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fafafa',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  distanceText: {
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  distanceSep: {
    fontSize: 9,
    color: colors.gray[300],
  },
  distanceTimeText: {
    fontSize: 9,
    color: colors.textTertiary,
  },
});

export default React.memo(DraggableActivityList);
