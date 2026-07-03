import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing } from './theme';
import { useTheme } from './ThemeProvider';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  color?: string;
}

function StarIcon({ filled, size, color, emptyColor }: { filled: boolean; size: number; color: string; emptyColor: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={filled ? color : 'transparent'}
        stroke={filled ? color : emptyColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function StarRating({
  rating,
  maxRating = 5,
  size = 20,
  interactive = false,
  onRatingChange,
  color = colors.primary[500],
}: StarRatingProps) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.container}>
      {Array.from({ length: maxRating }, (_, i) => {
        const starValue = i + 1;
        const filled = starValue <= rating;
        const star = <StarIcon filled={filled} size={size} color={color} emptyColor={themeColors.border} />;

        if (interactive) {
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onRatingChange?.(starValue)}
              style={{ marginRight: spacing.xs }}
            >
              {star}
            </TouchableOpacity>
          );
        }

        return (
          <View key={i} style={{ marginRight: 2 }}>
            {star}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
