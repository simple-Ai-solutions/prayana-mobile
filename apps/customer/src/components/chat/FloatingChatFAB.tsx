import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@prayana/shared-ui';

export const FloatingChatFAB: React.FC = () => {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const [showGreeting, setShowGreeting] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const greetingOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Continuous pulse ring animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Subtle bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Show greeting after 3 seconds, hide after 7
    const showTimer = setTimeout(() => {
      setShowGreeting(true);
      Animated.timing(greetingOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 3000);

    const hideTimer = setTimeout(() => {
      Animated.timing(greetingOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowGreeting(false));
    }, 7500);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.15, 0],
  });
  const bounceY = bounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  const handlePress = () => {
    router.push({
      pathname: '/chat',
      params: { initialMessage: '', context: 'home' },
    });
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Greeting Tooltip */}
      {showGreeting && (
        <Animated.View
          style={[
            styles.greetingContainer,
            { opacity: greetingOpacity },
          ]}
        >
          <View
            style={[
              styles.greetingBubble,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(31,41,55,0.95)'
                  : 'rgba(255,255,255,0.95)',
                borderColor: isDarkMode ? '#374151' : '#E5E7EB',
              },
            ]}
          >
            <Text
              style={[
                styles.greetingTitle,
                { color: isDarkMode ? '#ffffff' : '#1F2937' },
              ]}
            >
              Hi! I'm Isha
            </Text>
            <Text
              style={[
                styles.greetingSubtitle,
                { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
              ]}
            >
              Your AI Travel Assistant
            </Text>
          </View>
          {/* Arrow */}
          <View
            style={[
              styles.greetingArrow,
              {
                borderTopColor: isDarkMode
                  ? 'rgba(31,41,55,0.95)'
                  : 'rgba(255,255,255,0.95)',
              },
            ]}
          />
        </Animated.View>
      )}

      {/* Pulse Rings */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            transform: [{ scale: pulseScale }],
            opacity: pulseOpacity,
          },
        ]}
      />

      {/* FAB Button */}
      <Animated.View style={{ transform: [{ translateY: bounceY }] }}>
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.85}
          style={styles.fabTouchable}
        >
          <LinearGradient
            colors={['#0EA5E9', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            {/* Inner bot circle */}
            <View style={styles.botCircle}>
              <Ionicons name="chatbubble-ellipses" size={26} color="#0EA5E9" />
            </View>

            {/* Sparkle badge */}
            <View style={styles.sparkleBadge}>
              <LinearGradient
                colors={['#FFE66D', '#FBBF24', '#FFE66D']}
                style={styles.sparkleBadgeGradient}
              >
                <Ionicons name="sparkles" size={10} color="#92400E" />
              </LinearGradient>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    alignItems: 'flex-end',
    zIndex: 200,
  },
  greetingContainer: {
    alignItems: 'flex-end',
    marginBottom: 8,
    paddingRight: 4,
  },
  greetingBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  greetingTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  greetingSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  greetingArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginRight: 20,
  },
  pulseRing: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0EA5E9',
  },
  fabTouchable: {
    borderRadius: 32,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
  },
  fabGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  botCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkleBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    borderRadius: 10,
    overflow: 'hidden',
  },
  sparkleBadgeGradient: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default FloatingChatFAB;
