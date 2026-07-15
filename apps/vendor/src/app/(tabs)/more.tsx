import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Avatar } from '../../components/ui';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '../../theme/vendorColors';
import { useAuth } from '@prayana/shared-hooks';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItemData {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  route: string;
}

interface MenuSection {
  title: string;
  items: MenuItemData[];
}

// Every tile is the same dark-blue glyph on a light-blue gradient, so the list
// reads as one system and the labels — not the colors — carry the meaning.
const ICON_COLOR = colors.primary[700];
const ICON_TILE_GRADIENT = [colors.primary[50], colors.primary[100]] as const;

// ─── Menu Item ────────────────────────────────────────────────────────────────

function MenuItem({ item, onPress }: { item: MenuItemData; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <LinearGradient
        colors={ICON_TILE_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.menuIcon}
      >
        <Ionicons name={item.icon} size={20} color={ICON_COLOR} />
      </LinearGradient>
      <View style={styles.menuContent}>
        <Text style={styles.menuLabel}>{item.label}</Text>
        {item.subtitle && <Text style={styles.menuSubtitle}>{item.subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.primary[500]} />
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MoreScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { businessAccount } = useBusinessStore();

  const businessName = businessAccount?.businessName || businessAccount?.name || 'Business';
  const email = businessAccount?.contact?.email || user?.email || '';

  // Grouped to mirror the web Business Portal sidebar
  // (components/business/dashboard/DashboardSidebar.jsx):
  // Workspace(Overview=Dashboard tab) · Listings · Operations · Growth · Account.
  const menuSections: MenuSection[] = [
    {
      title: 'Listings',
      items: [
        {
          icon: 'ticket-outline',
          label: 'Activities',
          subtitle: 'Your listed experiences',
          route: '/activity',
        },
        {
          icon: 'cube-outline',
          label: 'Holiday Packages',
          subtitle: 'Multi-day packages & departures',
          route: '/packages',
        },
        {
          icon: 'car-outline',
          label: 'Transport',
          subtitle: 'Vehicle rentals & drivers',
          route: '/transport',
        },
      ],
    },
    {
      title: 'Operations',
      items: [
        {
          icon: 'calendar-outline',
          label: 'Bookings',
          subtitle: 'Incoming & past orders',
          route: '/(tabs)/orders',
        },
        {
          icon: 'chatbubbles-outline',
          label: 'Messages',
          subtitle: 'Customer conversations',
          route: '/messaging',
        },
        {
          icon: 'today-outline',
          label: 'Calendar',
          subtitle: 'Availability & schedule',
          route: '/(tabs)/calendar',
        },
      ],
    },
    {
      title: 'Growth',
      items: [
        {
          icon: 'bar-chart-outline',
          label: 'Analytics',
          subtitle: 'Revenue, bookings & trends',
          route: '/analytics',
        },
        {
          icon: 'star-outline',
          label: 'Performance',
          subtitle: 'Quality score & reviews',
          route: '/performance',
        },
        {
          icon: 'pricetag-outline',
          label: 'Coupons',
          subtitle: 'Create & manage promo codes',
          route: '/coupons',
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          icon: 'wallet-outline',
          label: 'Finance',
          subtitle: 'Earnings, payouts & bank details',
          route: '/finance',
        },
        {
          icon: 'shield-checkmark-outline',
          label: 'Verification',
          subtitle: 'KYC, GSTIN, PAN & documents',
          route: '/verification',
        },
        {
          icon: 'settings-outline',
          label: 'Settings',
          subtitle: 'Profile, notifications & payouts',
          route: '/settings',
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help-buoy-outline',
          label: 'Help & Support',
          subtitle: 'Tickets, FAQ, contact us',
          route: '/support',
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>More</Text>
        </View>

        {/* Profile Preview */}
        <Card style={styles.profileCard}>
          <TouchableOpacity
            style={styles.profileRow}
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
          >
            <Avatar name={businessName} uri={businessAccount?.logo} size={48} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{businessName}</Text>
              <Text style={styles.profileEmail}>{email}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primary[500]} />
          </TouchableOpacity>
        </Card>

        {/* Menu Sections */}
        {menuSections.map((section, sIndex) => (
          <View key={sIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Card padding="sm">
              {section.items.map((item, iIndex) => (
                <View key={iIndex}>
                  <MenuItem
                    item={item}
                    onPress={() => router.push(item.route as any)}
                  />
                  {iIndex < section.items.length - 1 && <View style={styles.menuDivider} />}
                </View>
              ))}
            </Card>
          </View>
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },

  // Profile
  profileCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  profileEmail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Sections
  section: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Menu Items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    // Blue-tinted lift rather than a grey one, so it sits under the gradient.
    shadowColor: colors.primary[700],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  menuSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 36 + spacing.md,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
