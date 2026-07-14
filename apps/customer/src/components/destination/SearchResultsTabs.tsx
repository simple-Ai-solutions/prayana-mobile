// Tab bar for the destination search-results page.
// Mirrors the PWA SearchResultsTabs: Places · Videos · Activities · Hidden Gems.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
// MUST come from gesture-handler, not react-native: this tab bar renders inside
// the destination page's gesture-handler <ScrollView>, and a plain RN
// TouchableOpacity nested in one never receives the tap — the scroll gesture
// swallows it, so the tabs looked dead (Videos/Activities/Hidden Gems wouldn't
// switch).
import { TouchableOpacity } from 'react-native-gesture-handler';
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
          // The flex lives on this View, not on the Touchable: gesture-handler's
          // TouchableOpacity doesn't stretch to a flex:1 style the way RN's does,
          // so the four tabs sized to their own text and bunched up on the left.
          // The View splits the bar into quarters; the Touchable fills its quarter.
          <View key={tab.id} style={styles.tabSlot}>
            <TouchableOpacity
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
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {tab.label}
              </Text>
              {active && <View style={styles.underline} />}
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    // The bar lives inside the page's ScrollView, whose content container does
    // not stretch children — without an explicit full width the row collapsed to
    // its content and the four tabs bunched up on the left instead of splitting
    // the screen into quarters.
    width: '100%',
    alignSelf: 'stretch',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  // Layout: each slot takes exactly one quarter of the bar.
  tabSlot: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  // Touch target: fills its slot.
  tab: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: 2,
    position: 'relative',
  },
  label: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    height: 2.5,
    width: '60%',
    borderRadius: 2,
    backgroundColor: colors.primary[500],
  },
});
