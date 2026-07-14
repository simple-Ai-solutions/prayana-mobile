// EsimDestinationHero — the destination card the PWA shows above the plans:
// a photo of the country, a sentence naming its real cities and true data range,
// and a 2x2 feature grid.
//
// Every fact in the copy is derived from the loaded bundles (the smallest and
// largest data allowance actually on sale) or from the curated cities table —
// nothing is asserted that the catalogue does not back.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { EsimBundle, formatData } from '../../lib/esim';
import { countryCities, countryImage } from '../../lib/countryAssets';

const FEATURES: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { icon: 'cellular-outline', label: 'Fast 4G LTE internet' },
  { icon: 'globe-outline', label: 'Available top-up options' },
  { icon: 'phone-portrait-outline', label: 'Data eSIM only' },
  { icon: 'chatbubble-ellipses-outline', label: '24/7 support in live chat' },
];

interface Props {
  countryName: string;
  countryCode?: string;
  bundles: EsimBundle[];
}

export const EsimDestinationHero: React.FC<Props> = ({ countryName, countryCode, bundles }) => {
  const { themeColors } = useTheme();

  const image = countryImage(countryCode);
  const cities = countryCities(countryCode);

  // The data range quoted in the copy comes from the plans actually on sale.
  const dataRange = useMemo(() => {
    const sizes = bundles
      .map((b) => b.dataAmountMB ?? 0)
      .filter((mb) => mb > 0)
      .sort((a, b) => a - b);
    if (!sizes.length) return null;
    const lo = formatData(sizes[0]);
    const hi = formatData(sizes[sizes.length - 1]);
    return lo === hi ? lo : `${lo} to ${hi}`;
  }, [bundles]);

  const blurb =
    `Visiting ${countryName}? Stay connected with Prayana Travel eSIM offering instant activation, ` +
    `reliable coverage` +
    (dataRange ? `, and data plans from ${dataRange}` : '') +
    (cities.length === 3
      ? `, perfect for exploring ${cities[0]}, ${cities[1]}, and ${cities[2]}.`
      : '.');

  const body = (
    <View style={styles.inner}>
      <Text style={styles.title}>{countryName}</Text>
      <Text style={styles.blurb}>{blurb}</Text>

      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f.label} style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon} size={13} color="#FFFFFF" />
            </View>
            <Text style={styles.featureText} numberOfLines={2}>
              {f.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  // No curated photo for this country — fall back to the brand gradient rather
  // than a broken or unrelated image.
  if (!image) {
    return (
      <LinearGradient
        colors={['#E61417', '#B91C1C', '#7F1D1D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderColor: themeColors.border }]}
      >
        {body}
      </LinearGradient>
    );
  }

  return (
    <ImageBackground
      source={{ uri: image }}
      style={[styles.card, { borderColor: themeColors.border }]}
      imageStyle={styles.image}
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.72)']}
        style={StyleSheet.absoluteFill}
      />
      {body}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  image: { borderRadius: borderRadius.xl },
  inner: { padding: spacing.lg },

  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.75,
    marginBottom: spacing.sm,
  },
  blurb: {
    color: 'rgba(255,255,255,0.90)',
    fontSize: fontSize.sm,
    lineHeight: 21,
  },

  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.lg,
    rowGap: spacing.md,
  },
  feature: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  featureIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { flex: 1, color: '#FFFFFF', fontSize: 12, lineHeight: 16 },
});

export default EsimDestinationHero;
