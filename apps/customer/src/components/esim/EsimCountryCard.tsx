// EsimCountryCard — the destination card the PWA's "Recommended for You" grid
// uses: a photo of the country, a price badge, and the flag + name overlaid at
// the bottom. Two per row.
//
// The price is the cheapest bundle the catalogue actually returns for that
// country. Until that lands the badge is simply absent — it never guesses.
import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { CountryFlag } from './CountryFlag';
import { countryImage } from '../../lib/countryAssets';

interface Props {
  iso: string;
  name: string;
  fromINR?: number;
  planCount?: number;
  selected?: boolean;
  onPress: () => void;
}

export const EsimCountryCard: React.FC<Props> = ({
  iso,
  name,
  fromINR,
  planCount,
  selected = false,
  onPress,
}) => {
  const { themeColors } = useTheme();
  const image = countryImage(iso);

  const overlay = (
    <>
      <LinearGradient
        colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.80)']}
        style={StyleSheet.absoluteFill}
      />

      {!!fromINR && (
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>₹{fromINR.toLocaleString('en-IN')}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <CountryFlag countryCode={iso} size={22} />
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
      </View>
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        fromINR ? `${name}, from ₹${fromINR}${planCount ? `, ${planCount} plans` : ''}` : name
      }
      style={({ pressed }) => [
        styles.card,
        selected && { borderWidth: 2, borderColor: '#E61417' },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {image ? (
        <ImageBackground source={{ uri: image }} style={styles.fill} imageStyle={styles.img}>
          {overlay}
        </ImageBackground>
      ) : (
        // No curated photo — a neutral tile rather than a wrong image.
        <View style={[styles.fill, { backgroundColor: themeColors.backgroundSecondary }]}>
          {overlay}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    height: 150,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  fill: { flex: 1, justifyContent: 'flex-end' },
  img: { borderRadius: borderRadius.xl },

  priceBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  priceText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.md,
  },
  name: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
});

export default EsimCountryCard;
