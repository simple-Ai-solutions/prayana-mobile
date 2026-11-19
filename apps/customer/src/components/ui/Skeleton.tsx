// Loading placeholders: grey shapes of the page that's coming, with a soft
// light sweeping across them. A page that shows its outline at once feels
// fast even while the data is still on its way; a lone spinner feels slow.
//
// The grey is see-through, so the same placeholder works on a white page, in
// dark mode and on the dark themed category pages without a tone switch.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle, StyleProp, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

// One clock for every placeholder on screen, so they sweep together.
const sweep = new Animated.Value(0);
let running = 0;
let loop: Animated.CompositeAnimation | null = null;
function useSweep() {
  useEffect(() => {
    running += 1;
    if (!loop) {
      sweep.setValue(0);
      loop = Animated.loop(
        Animated.timing(sweep, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      );
      loop.start();
    }
    return () => {
      running -= 1;
      if (running === 0 && loop) {
        loop.stop();
        loop = null;
      }
    };
  }, []);
  return sweep;
}

export function Skeleton({
  width = '100%', height = 14, radius = 8, style,
}: {
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useSweep();
  const { width: screenW } = useWindowDimensions();
  const x = t.interpolate({ inputRange: [0, 1], outputRange: [-screenW * 0.6, screenW] });
  return (
    <View
      style={[styles.base, { width, height, borderRadius: radius }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[StyleSheet.absoluteFill, { width: screenW * 0.6, transform: [{ translateX: x }] }]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/** Two columns of photo cards, the shape of ExperienceCard. */
export function SkeletonCardGrid({ count = 4, padded = false }: { count?: number; padded?: boolean }) {
  return (
    <View style={[styles.grid, padded && { paddingHorizontal: 16 }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.gridCell}>
          <View style={{ aspectRatio: 1 }}>
            <Skeleton height="100%" radius={18} />
          </View>
          <Skeleton width="90%" height={13} style={{ marginTop: 10 }} />
          <Skeleton width="60%" height={11} style={{ marginTop: 7 }} />
          <Skeleton width="40%" height={14} style={{ marginTop: 9 }} />
        </View>
      ))}
    </View>
  );
}

/** A detail page: big photo, title, a row of fact tiles and some text. */
export function SkeletonDetailPage({ facts = true, photo }: {
  facts?: boolean;
  /** The photo the tapped card was showing; shown at once in place of the grey hero. */
  photo?: string | null;
}) {
  const settle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!photo) return;
    Animated.timing(settle, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [photo, settle]);
  return (
    <View>
      {photo ? (
        <Animated.View
          style={{
            height: 300,
            overflow: 'hidden',
            opacity: settle.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
            transform: [{ scale: settle.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] }) }],
          }}
        >
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
        </Animated.View>
      ) : (
        <Skeleton height={300} radius={0} />
      )}
      <View style={styles.detailBody}>
        <Skeleton width={110} height={11} />
        <Skeleton width="85%" height={24} style={{ marginTop: 12 }} />
        <Skeleton width="55%" height={24} style={{ marginTop: 8 }} />
        <Skeleton width={140} height={13} style={{ marginTop: 14 }} />
        {facts && (
          <View style={styles.factsRow}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={74} radius={14} style={{ flex: 1 }} />
            ))}
          </View>
        )}
        <Skeleton width={90} height={18} style={{ marginTop: 28 }} />
        {['100%', '96%', '92%', '70%'].map((w, i) => (
          <Skeleton key={i} width={w as any} height={13} style={{ marginTop: 10 }} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: 'rgba(127,127,140,0.16)', overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 22, marginTop: 16 },
  gridCell: { width: '48%' },
  detailBody: { paddingHorizontal: 20, paddingTop: 18 },
  factsRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
});

export default Skeleton;
