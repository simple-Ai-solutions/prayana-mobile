// Tab bar for the destination search-results page.
// Mirrors the PWA SearchResultsTabs: Places · Videos · Activities · Hidden Gems.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, Sparkles, Gem } from 'lucide-react-native';
import { useTheme, colors, spacing, fontSize, fontWeight } from '@prayana/shared-ui';
import { YouTubeIcon } from './YouTubeIcon';

export type SearchTabId = 'places' | 'videos' | 'activities' | 'gems';

export const SEARCH_TABS: {
  id: SearchTabId;
  label: string;
  Icon: any;
  brand?: boolean; // brand icon keeps its own color regardless of active state
}[] = [
  { id: 'places', label: 'Places', Icon: MapPin },
  { id: 'videos', label: 'Videos', Icon: YouTubeIcon, brand: true },
  { id: 'activities', label: 'Activities', Icon: Sparkles },
  { id: 'gems', label: 'Hidden Gems', Icon: Gem },
];

interface Props {
  activeTab: SearchTabId;
  onChange: (id: SearchTabId) => void;
}

export const SearchResultsTabs: React.FC<Props> = ({ activeTab, onChange }) => {
  const { themeColors } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]}>
      {SEARCH_TABS.map((tab) => {
        const active = activeTab === tab.id;
        const Icon = tab.Icon;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => onChange(tab.id)}
          >
            <Icon
              size={18}
              color={
                tab.brand
                  ? '#FF0000'
                  : active
                  ? colors.primary[500]
                  : themeColors.textTertiary
              }
            />
            <Text
              style={[
                styles.label,
                { color: active ? colors.primary[600] : themeColors.textTertiary },
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            {active && <View style={styles.underline} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    position: 'relative',
  },
  label: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  underline: {
    position: 'absolute',
    bottom: 0,
    height: 2.5,
    width: '60%',
    borderRadius: 2,
    backgroundColor: colors.primary[500],
  },
});
