import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { colors, spacing, fontSize, fontWeight, useTheme } from '@prayana/shared-ui';

interface Tag {
  tag: string;
  count: number;
  emoji: string;
}

interface ExperienceTagFiltersProps {
  tags: Tag[];
  selectedTag: string;
  onTagSelect: (tag: string) => void;
}

const capitalizeFirst = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const ExperienceTagFilters: React.FC<ExperienceTagFiltersProps> = ({
  tags,
  selectedTag,
  onTagSelect,
}) => {
  const { isDarkMode, themeColors } = useTheme();

  const allTag: Tag = {
    tag: 'all',
    count: tags.reduce((sum, t) => sum + t.count, 0),
    emoji: '\uD83C\uDF0D',
  };

  const allTags = [allTag, ...tags];

  const handlePress = useCallback(
    (tag: string) => {
      onTagSelect(tag);
    },
    [onTagSelect]
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.background,
          borderBottomColor: themeColors.border,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {allTags.map((item, index) => {
          const isActive =
            selectedTag === item.tag ||
            (item.tag === 'all' && !selectedTag);

          const pillStyle: StyleProp<ViewStyle> = [
            styles.pill,
            isActive
              ? styles.pillActive
              : {
                  backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6',
                },
          ];

          return (
            <TouchableOpacity
              key={`${item.tag}-${index}`}
              onPress={() => handlePress(item.tag)}
              activeOpacity={0.7}
              style={pillStyle}
            >
              <Text
                style={[
                  styles.pillText,
                  isActive
                    ? styles.pillTextActive
                    : {
                        color: isDarkMode
                          ? colors.gray[300]
                          : colors.gray[700],
                      },
                ]}
                numberOfLines={1}
              >
                {item.emoji}{' '}
                {item.tag === 'all' ? 'All' : capitalizeFirst(item.tag)}{' '}
                ({item.count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.lg,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
  },
  pillActive: {
    backgroundColor: '#10b981',
  },
  pillText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  pillTextActive: {
    color: '#ffffff',
    fontWeight: fontWeight.bold,
  },
});

export default ExperienceTagFilters;
