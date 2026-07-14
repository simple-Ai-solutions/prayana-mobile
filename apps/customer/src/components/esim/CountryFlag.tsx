// CountryFlag — a real flag image, not an emoji.
//
// Emoji flags render as "?" boxes on the iOS Simulator, and the design system
// (PRAYANA_DESIGN_SYSTEM.pdf §7) forbids bundling a webfont to fix that. A CDN
// image renders identically everywhere and needs no font.
//
// Falls back to a neutral globe tile when the country code is missing or the
// image fails to load, so a broken URL never leaves a hole in the layout.
import React, { useState } from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, borderRadius } from '@prayana/shared-ui';
import { flagUrl } from '../../lib/esim';

interface Props {
  countryCode?: string;
  size?: number;
  rounded?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const CountryFlag: React.FC<Props> = ({ countryCode, size = 28, rounded = true, style }) => {
  const { themeColors } = useTheme();
  const [failed, setFailed] = useState(false);

  const uri = flagUrl(countryCode, size > 40 ? 160 : 80);
  const radius = rounded ? borderRadius.sm : 0;
  // Flags are 4:3; keep the aspect so they never look stretched.
  const height = Math.round((size * 3) / 4);

  if (!uri || failed) {
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height, borderRadius: radius, backgroundColor: themeColors.backgroundSecondary },
          style,
        ]}
      >
        <Ionicons name="globe-outline" size={Math.round(size * 0.5)} color={themeColors.textTertiary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      style={[styles.img, { width: size, height, borderRadius: radius }, style as StyleProp<ImageStyle>]}
      resizeMode="cover"
      accessibilityLabel={countryCode ? `${countryCode} flag` : undefined}
    />
  );
};

const styles = StyleSheet.create({
  img: { backgroundColor: 'transparent' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});

export default CountryFlag;
