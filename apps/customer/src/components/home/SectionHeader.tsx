// The one title style for every home section: a bold left-aligned heading and,
// when there's more to see, a quiet "See all" on the right. Keeping every
// section on this one header is what makes the home page read as one app.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';

export const SECTION_PAD = 16;

export function SectionHeader({
  title, eyebrow, onSeeAll, align = 'left', color,
}: {
  title: string;
  /** Small coloured label above the title, for a section with its own theme. */
  eyebrow?: string;
  onSeeAll?: () => void;
  align?: 'left' | 'center';
  /** Title colour, for sections drawn on their own backdrop. */
  color?: string;
}) {
  const { themeColors } = useTheme();
  return (
    <View style={[styles.row, align === 'center' && styles.center]}>
      <View style={[styles.text, align === 'center' && { alignItems: 'center' }]}>
        {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text
          style={[styles.title, { color: color ?? themeColors.text }, align === 'center' && { textAlign: 'center' }]}
          accessibilityRole="header"
        >
          {title}
        </Text>
      </View>
      {onSeeAll && (
        <Pressable
          onPress={onSeeAll}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`See all ${title}`}
          style={({ pressed }) => [styles.seeAll, pressed && { opacity: 0.5 }]}
        >
          <Text style={[styles.seeAllText, { color: themeColors.textSecondary }]}>See all</Text>
          <Ionicons name="chevron-forward" size={15} color={themeColors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SECTION_PAD,
    marginBottom: 16,
  },
  center: { justifyContent: 'center' },
  text: { flex: 1 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: '#D97706',
    marginBottom: 4,
  },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingBottom: 3, marginLeft: 12 },
  seeAllText: { fontSize: 14, fontWeight: '600' },
});

export default SectionHeader;
