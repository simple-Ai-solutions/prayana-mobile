import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Card,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  useTheme,
} from '@prayana/shared-ui';
import Toast from 'react-native-toast-message';

// ============================================================
// TYPES
// ============================================================
interface LinkItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  url?: string;
  action?: () => void;
  iconColor: string;
  iconBg: string;
}

// ============================================================
// CONSTANTS
// ============================================================
const APP_VERSION = '1.0.0';
const BUILD_NUMBER = '1';

const LINK_ITEMS: LinkItem[] = [
  {
    label: 'Terms of Service',
    icon: 'document-text-outline',
    url: 'https://prayanaai.com/terms',
    iconColor: '#3b82f6',
    iconBg: '#eff6ff',
  },
  {
    label: 'Privacy Policy',
    icon: 'shield-checkmark-outline',
    url: 'https://prayanaai.com/privacy',
    iconColor: '#059669',
    iconBg: '#ecfdf5',
  },
  {
    label: 'User Agreement',
    icon: 'reader-outline',
    url: 'https://prayanaai.com/user-agreement',
    iconColor: '#7c3aed',
    iconBg: '#f5f3ff',
  },
  {
    label: 'Rate App',
    icon: 'star-outline',
    url: Platform.select({
      ios: 'https://apps.apple.com/app/id-REPLACE',
      android: 'https://play.google.com/store/apps/details?id=com.prayanaai.customer',
      default: 'https://prayanaai.com',
    }),
    iconColor: '#f59e0b',
    iconBg: '#fffbeb',
  },
  {
    label: 'Contact Support',
    icon: 'mail-outline',
    url: 'mailto:support@prayana.ai',
    iconColor: '#8b5cf6',
    iconBg: '#f3f0ff',
  },
];

// ============================================================
// ABOUT SCREEN
// ============================================================
export default function AboutScreen() {
  const { themeColors, isDarkMode } = useTheme();
  // ============================================================
  // HANDLE LINK PRESS
  // ============================================================
  const handleLinkPress = useCallback(async (item: LinkItem) => {
    if (item.action) {
      item.action();
      return;
    }

    if (item.url) {
      try {
        const canOpen = await Linking.canOpenURL(item.url);
        if (canOpen) {
          await Linking.openURL(item.url);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Cannot open link',
            text2: 'The link could not be opened on your device.',
          });
        }
      } catch (err: any) {
        console.warn('[About] Failed to open URL:', err.message);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to open the link.',
        });
      }
    }
  }, []);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ====== APP LOGO & NAME ====== */}
      <View style={styles.logoSection}>
        <LinearGradient
          colors={[colors.primary[400], colors.primary[600]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoContainer}
        >
          <Ionicons name="airplane" size={40} color="#ffffff" />
        </LinearGradient>
        <Text style={[styles.appName, { color: themeColors.text }]}>Prayana AI</Text>
        <Text style={[styles.tagline, { color: themeColors.textSecondary }]}>Your Intelligent Journey Companion</Text>
      </View>

      {/* ====== VERSION INFO ====== */}
      <Card style={[styles.versionCard, { backgroundColor: themeColors.card }]}>
        <View style={styles.versionRow}>
          <View style={styles.versionInfo}>
            <Text style={[styles.versionLabel, { color: themeColors.textSecondary }]}>Version</Text>
            <Text style={[styles.versionValue, { color: themeColors.text }]}>{APP_VERSION}</Text>
          </View>
          <View style={[styles.versionDivider, { backgroundColor: themeColors.border }]} />
          <View style={styles.versionInfo}>
            <Text style={[styles.versionLabel, { color: themeColors.textSecondary }]}>Build</Text>
            <Text style={[styles.versionValue, { color: themeColors.text }]}>{BUILD_NUMBER}</Text>
          </View>
          <View style={[styles.versionDivider, { backgroundColor: themeColors.border }]} />
          <View style={styles.versionInfo}>
            <Text style={[styles.versionLabel, { color: themeColors.textSecondary }]}>Platform</Text>
            <Text style={[styles.versionValue, { color: themeColors.text }]}>
              {Platform.OS === 'ios' ? 'iOS' : 'Android'}
            </Text>
          </View>
        </View>
      </Card>

      {/* ====== DESCRIPTION ====== */}
      <Card style={[styles.descriptionCard, { backgroundColor: themeColors.card }]}>
        <Text style={[styles.descriptionTitle, { color: themeColors.text }]}>About Prayana AI</Text>
        <Text style={[styles.descriptionText, { color: themeColors.textSecondary }]}>
          Prayana AI is your intelligent travel companion, powered by advanced AI to
          help you plan unforgettable trips. From discovering hidden gems to
          building day-by-day itineraries, booking activities, and collaborating
          with friends in real time -- Prayana makes travel planning effortless
          and enjoyable.
        </Text>
        <View style={styles.featureList}>
          {[
            'AI-powered itinerary generation',
            'Smart activity recommendations',
            'Real-time trip collaboration',
            'Marketplace with instant booking',
            'Budget tracking and management',
          ].map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.primary[500]}
              />
              <Text style={[styles.featureText, { color: themeColors.text }]}>{feature}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* ====== LINKS ====== */}
      <Card style={[styles.linksCard, { backgroundColor: themeColors.card }]}>
        {LINK_ITEMS.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[
              styles.linkItem,
              index < LINK_ITEMS.length - 1 && styles.linkItemBorder,
              index < LINK_ITEMS.length - 1 && { borderBottomColor: themeColors.border },
            ]}
            onPress={() => handleLinkPress(item)}
            activeOpacity={0.7}
          >
            <View style={styles.linkLeft}>
              <View
                style={[
                  styles.linkIconContainer,
                  { backgroundColor: item.iconBg },
                ]}
              >
                <Ionicons name={item.icon} size={20} color={item.iconColor} />
              </View>
              <Text style={[styles.linkLabel, { color: themeColors.text }]}>{item.label}</Text>
            </View>
            <Ionicons
              name="open-outline"
              size={18}
              color={themeColors.textTertiary}
            />
          </TouchableOpacity>
        ))}
      </Card>

      {/* ====== MADE WITH AI BADGE ====== */}
      <View style={styles.footerSection}>
        <View style={[styles.aiBadge, shadow.sm]}>
          <LinearGradient
            colors={[colors.primary[500], colors.primary[600]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.aiBadgeGradient}
          >
            <Ionicons name="sparkles" size={14} color="#ffffff" />
            <Text style={styles.aiBadgeText}>Simple AI Solutions</Text>
          </LinearGradient>
        </View>
        <Text style={[styles.copyrightText, { color: themeColors.textTertiary }]}>
          {'\u00A9'} 2024-2026 Prayana AI. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },

  // --- Logo Section ---
  logoSection: {
    alignItems: 'center',
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.xl,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadow.lg,
  },
  appName: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  tagline: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // --- Version Card ---
  versionCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  versionInfo: {
    alignItems: 'center',
    flex: 1,
  },
  versionLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  versionValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  versionDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },

  // --- Description Card ---
  descriptionCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  descriptionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  descriptionText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  featureList: {
    gap: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },

  // --- Links Card ---
  linksCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    paddingHorizontal: 0,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  linkItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  linkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  linkIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },

  // --- Footer ---
  footerSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  aiBadge: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  aiBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  aiBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  copyrightText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
});
