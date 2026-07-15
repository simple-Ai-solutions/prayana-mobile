import React from 'react';
import { Tabs } from 'expo-router';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useTheme } from '@prayana/shared-ui';
import { colors } from '../../theme/vendorColors';

// The selected tab is a solid, brand-blue glyph; the rest are light outlines in
// the same grey as their labels. Weight (filled vs stroked) does the work, so
// the active tab reads instantly even at a glance. Uses the same primary[500]
// (#2563eb) as every other primary action, so the app's blue stays consistent.
const ACTIVE_COLOR = colors.primary[500];

interface IconProps {
  color: string;
  size: number;
  focused: boolean;
  /** Tab-bar background, used to knock details out of a filled glyph. */
  knockout: string;
}

function DashboardIcon({ color, size, focused }: IconProps) {
  const boxes = [
    { x: 3, y: 3 },
    { x: 14, y: 3 },
    { x: 3, y: 14 },
    { x: 14, y: 14 },
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {boxes.map((b) => (
        <Rect
          key={`${b.x}-${b.y}`}
          x={b.x}
          y={b.y}
          width={7}
          height={7}
          rx={1}
          fill={focused ? color : 'none'}
          stroke={focused ? 'none' : color}
          strokeWidth={2}
        />
      ))}
    </Svg>
  );
}

function OrdersIcon({ color, size, focused, knockout }: IconProps) {
  if (focused) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x="5" y="5" width="14" height="16" rx="2" fill={color} />
        <Rect x="9" y="3" width="6" height="4" rx="1" fill={color} />
        {/* Check knocked out of the solid body. */}
        <Path
          d="M9 14l2 2 4-4"
          fill="none"
          stroke={knockout}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <Rect x="9" y="3" width="6" height="4" rx="1" />
      <Path d="M9 14l2 2 4-4" />
    </Svg>
  );
}

// A ticket — the same metaphor the More menu already uses for Activities.
const TICKET_BODY =
  'M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z';
const TICKET_PERFORATION = 'M15 5v2M15 11v2M15 17v2';

function ActivitiesIcon({ color, size, focused, knockout }: IconProps) {
  if (focused) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={TICKET_BODY} fill={color} />
        {/* Perforation sits inside the solid body — knock it out. */}
        <Path
          d={TICKET_PERFORATION}
          stroke={knockout}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={TICKET_BODY} />
      <Path d={TICKET_PERFORATION} />
    </Svg>
  );
}

function CalendarIcon({ color, size, focused, knockout }: IconProps) {
  if (focused) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {/* Hangers first, so the filled body overlaps their lower half. */}
        <Path d="M8 2v4M16 2v4" stroke={color} strokeWidth={2} strokeLinecap="round" />
        <Rect x="3" y="4" width="18" height="18" rx="2" fill={color} />
        {/* Header rule knocked out of the solid body. */}
        <Path d="M3 10h18" stroke={knockout} strokeWidth={2} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  );
}

function MoreIcon({ color, size, focused }: IconProps) {
  // Dots are solid either way; the focused state just grows them slightly.
  const r = focused ? 2 : 1.75;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <Circle cx="5" cy="12" r={r} />
      <Circle cx="12" cy="12" r={r} />
      <Circle cx="19" cy="12" r={r} />
    </Svg>
  );
}

export default function TabLayout() {
  const { themeColors } = useTheme();

  const renderIcon =
    (Icon: (p: IconProps) => React.ReactElement) =>
    ({ focused }: { focused: boolean }) => (
      <Icon
        focused={focused}
        color={focused ? ACTIVE_COLOR : themeColors.textTertiary}
        knockout={themeColors.tabBar}
        size={24}
      />
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: themeColors.textTertiary,
        tabBarStyle: {
          backgroundColor: themeColors.tabBar,
          borderTopColor: themeColors.tabBarBorder,
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 30,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: renderIcon(DashboardIcon) }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: 'Orders', tabBarIcon: renderIcon(OrdersIcon) }}
      />
      <Tabs.Screen
        name="activities"
        options={{ title: 'Listings', tabBarIcon: renderIcon(ActivitiesIcon) }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendar', tabBarIcon: renderIcon(CalendarIcon) }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: renderIcon(MoreIcon) }}
      />
    </Tabs>
  );
}
