import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, useTheme } from '@prayana/shared-ui';

// Tab icons using react-native-svg (matching web BottomNavigation)
function HomeIcon({ color, size, fill = 'none' }: { color: string; size: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <Path d="M9 22V12h6v10" />
    </Svg>
  );
}

function ExploreIcon({ color, size, fill = 'none' }: { color: string; size: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12" />
    </Svg>
  );
}

function PlusIcon({ color, size }: { color: string; size: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

function TripsIcon({ color, size, fill = 'none' }: { color: string; size: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <Path d="M14 2v6h6" />
      <Path d="M16 13H8M16 17H8M10 9H8" />
    </Svg>
  );
}

function ProfileIcon({ color, size, fill = 'none' }: { color: string; size: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

type IconProps = { color: string; size: number; fill?: string };

/**
 * A tab icon that answers when it's chosen: a soft orange pill grows in
 * behind it, the outline fills in lightly, and the icon gives a small
 * spring bounce.
 */
function TabIcon({ Icon, color, focused }: { Icon: React.FC<IconProps>; color: string; focused: boolean }) {
  const on = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const bounce = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(on, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
    if (focused) {
      bounce.setValue(0.82);
      Animated.spring(bounce, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }).start();
    }
  }, [focused, on, bounce]);
  return (
    <View style={tabStyles.slot}>
      <Animated.View
        style={[tabStyles.pill, { opacity: on, transform: [{ scaleX: on.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}
      />
      <Animated.View style={{ transform: [{ scale: bounce }] }}>
        <Icon color={color} size={22} fill={focused ? `${colors.primary[500]}2E` : 'none'} />
      </Animated.View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  slot: { width: 52, height: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  pill: { ...StyleSheet.absoluteFillObject, borderRadius: 14, backgroundColor: `${colors.primary[500]}1F` },
});

export default function TabLayout() {
  const { themeColors } = useTheme();

  return (
    <Tabs
      // A light tap on every tab press, like the system tab bars.
      screenListeners={{
        tabPress: () => {
          if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[500],
        tabBarInactiveTintColor: colors.gray[400],
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
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={HomeIcon} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={ExploreIcon} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="create-trip"
        options={{
          title: 'Planner',
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={PlusIcon} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'My Trips',
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={TripsIcon} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={ProfileIcon} color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
