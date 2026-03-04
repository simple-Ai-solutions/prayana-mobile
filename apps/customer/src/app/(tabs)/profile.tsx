import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  Avatar,
  Card,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  useTheme,
} from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import { fetchUserProfile } from '@prayana/shared-services';
import Toast from 'react-native-toast-message';

// ============================================================
// TYPES
// ============================================================
interface UserStats {
  totalTrips: number;
  totalBookings: number;
  memberSince: string;
  loyaltyPoints: number;
}

interface MenuItem {
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
  action?: () => void;
  iconColor?: string;
  iconBg?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

// ============================================================
// STAT CARD COMPONENT
// ============================================================
function StatItem({
  value,
  label,
  icon,
}: {
  value: string | number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statIconContainer}>
        <Ionicons name={icon} size={18} color={colors.primary[500]} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ============================================================
// MENU ITEM COMPONENT
// ============================================================
function MenuItemRow({
  item,
  isLast,
  onPress,
}: {
  item: MenuItem;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, !isLast && styles.menuItemBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <View
          style={[
            styles.menuIconContainer,
            { backgroundColor: item.iconBg || colors.primary[50] },
          ]}
        >
          <Ionicons
            name={item.icon}
            size={20}
            color={item.iconColor || colors.primary[500]}
          />
        </View>
        <View style={styles.menuTextContainer}>
          <Text style={styles.menuLabel}>{item.label}</Text>
          {item.subtitle && (
            <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
          )}
        </View>
      </View>
      <Ionicons
        name="chevron-forward-outline"
        size={20}
        color={colors.textTertiary}
      />
    </TouchableOpacity>
  );
}

// ============================================================
// FORMAT DATE
// ============================================================
function formatMemberSince(dateString: string | undefined): string {
  if (!dateString) return 'Recently joined';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Recently joined';
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  } catch {
    return 'Recently joined';
  }
}

// ============================================================
// MAIN PROFILE SCREEN
// ============================================================
export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme, themeColors } = useTheme();

  // --- State ---
  const [stats, setStats] = useState<UserStats>({
    totalTrips: 0,
    totalBookings: 0,
    memberSince: '',
    loyaltyPoints: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // ============================================================
  // FETCH USER STATS
  // ============================================================
  const loadUserStats = useCallback(async () => {
    if (!user?.uid || user.uid === 'guest-user') {
      setLoading(false);
      return;
    }

    try {
      const profile = await fetchUserProfile(user.uid);
      if (profile) {
        setStats({
          totalTrips: profile.totalTrips ?? profile.tripsCount ?? 0,
          totalBookings: profile.totalBookings ?? profile.bookingsCount ?? 0,
          memberSince:
            profile.memberSince ??
            profile.createdAt ??
            user.metadata?.creationTime ??
            '',
          loyaltyPoints: profile.membership?.loyaltyPoints ?? 0,
        });
      }
    } catch (err: any) {
      console.warn('[Profile] Failed to fetch user stats:', err.message);
      // Fallback: use Firebase metadata
      setStats((prev) => ({
        ...prev,
        memberSince: user.metadata?.creationTime ?? '',
      }));
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadUserStats();
  }, [loadUserStats]);

  // ============================================================
  // PULL TO REFRESH
  // ============================================================
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserStats();
    setRefreshing(false);
  }, [loadUserStats]);

  // ============================================================
  // SIGN OUT
  // ============================================================
  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your data will be synced when you sign back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
              Toast.show({
                type: 'success',
                text1: 'Signed out',
                text2: 'You have been signed out successfully.',
              });
            } catch (err: any) {
              console.warn('[Profile] Sign out failed:', err.message);
              Toast.show({
                type: 'error',
                text1: 'Sign out failed',
                text2: 'Please try again.',
              });
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  }, [logout]);

  // ============================================================
  // MENU SECTIONS
  // ============================================================
  const menuSections: MenuSection[] = [
    {
      title: 'Account',
      items: [
        {
          label: 'Edit Profile',
          subtitle: 'Update your name, email, and phone',
          icon: 'person-outline',
          route: '/settings/edit-profile',
          iconColor: colors.primary[500],
          iconBg: colors.primary[50],
        },
        {
          label: 'Travel Preferences',
          subtitle: 'Interests, travel style & budget',
          icon: 'options-outline',
          route: '/profile/travel-preferences',
          iconColor: '#8b5cf6',
          iconBg: '#f3f0ff',
        },
        {
          label: 'Notification Preferences',
          subtitle: 'Manage push and email notifications',
          icon: 'notifications-outline',
          route: '/settings/notifications',
          iconColor: '#f59e0b',
          iconBg: '#fffbeb',
        },
      ],
    },
    {
      title: 'Travel',
      items: [
        {
          label: 'My Trips',
          subtitle: 'View and manage your trips',
          icon: 'map-outline',
          route: '/(tabs)/trips',
          iconColor: '#059669',
          iconBg: '#ecfdf5',
        },
        {
          label: 'My Favorites',
          subtitle: 'Saved destinations & places',
          icon: 'heart-outline',
          route: '/profile/favorites',
          iconColor: '#ef4444',
          iconBg: '#fef2f2',
        },
      ],
    },
    {
      title: 'Membership',
      items: [
        {
          label: 'Membership & Rewards',
          subtitle: `${stats.loyaltyPoints.toLocaleString()} points · Premium Member`,
          icon: 'ribbon-outline',
          route: '/profile/membership',
          iconColor: '#f97316',
          iconBg: '#fff7ed',
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          label: 'Send Feedback',
          subtitle: 'Share your experience with us',
          icon: 'chatbubble-ellipses-outline',
          route: '/profile/feedback',
          iconColor: '#0ea5e9',
          iconBg: '#f0f9ff',
        },
        {
          label: 'Help Center',
          subtitle: 'FAQs and customer support',
          icon: 'help-circle-outline',
          route: '/settings/help',
          iconColor: '#6366f1',
          iconBg: '#eef2ff',
        },
        {
          label: 'About',
          subtitle: 'App version and legal info',
          icon: 'information-circle-outline',
          route: '/settings',
          iconColor: colors.textSecondary,
          iconBg: colors.backgroundSecondary,
        },
      ],
    },
  ];

  // ============================================================
  // HANDLE MENU PRESS
  // ============================================================
  const handleMenuPress = useCallback(
    (item: MenuItem) => {
      if (item.action) {
        item.action();
      } else if (item.route) {
        router.push(item.route as any);
      }
    },
    [router]
  );

  // ============================================================
  // DISPLAY VALUES
  // ============================================================
  const displayName = user?.displayName || 'Prayana User';
  const displayEmail = user?.email || 'No email linked';
  const displayPhoto = user?.photoURL || undefined;
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
      >
        {/* ====== HEADER ====== */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>Profile</Text>
        </View>

        {/* ====== USER INFO CARD ====== */}
        <View style={styles.profileCardWrapper}>
          <LinearGradient
            colors={[colors.primary[500], colors.primary[600]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileGradient}
          >
            <View style={styles.profileRow}>
              <View style={styles.avatarWrapper}>
                <Avatar
                  name={displayName}
                  imageUrl={displayPhoto}
                  size={72}
                />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.profileEmail} numberOfLines={1}>
                  {displayEmail}
                </Text>
                {stats.memberSince ? (
                  <Text style={styles.profileMemberSince}>
                    Member since {formatMemberSince(stats.memberSince)}
                  </Text>
                ) : null}
                <View style={styles.profileBadgeRow}>
                  <View style={styles.memberBadge}>
                    <Ionicons name="star" size={10} color="#92400E" />
                    <Text style={styles.memberBadgeText}>Premium</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editProfileBadge}
                    onPress={() => router.push('/settings/edit-profile' as any)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="pencil-outline" size={12} color="#ffffff" />
                    <Text style={styles.editProfileBadgeText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* ====== STATS ROW ====== */}
        <Card style={[styles.statsCard, { backgroundColor: themeColors.card }]}>
          {loading ? (
            <View style={styles.statsLoading}>
              <ActivityIndicator size="small" color={colors.primary[500]} />
              <Text style={[styles.statsLoadingText, { color: themeColors.textSecondary }]}>Loading stats...</Text>
            </View>
          ) : (
            <View style={styles.statsRow}>
              <StatItem
                value={stats.totalTrips}
                label="Trips"
                icon="airplane-outline"
              />
              <View style={[styles.statDivider, { backgroundColor: themeColors.border }]} />
              <StatItem
                value={stats.totalBookings}
                label="Bookings"
                icon="ticket-outline"
              />
              <View style={[styles.statDivider, { backgroundColor: themeColors.border }]} />
              <StatItem
                value={stats.loyaltyPoints.toLocaleString()}
                label="Points"
                icon="star-outline"
              />
            </View>
          )}
        </Card>

        {/* ====== DARK MODE TOGGLE ====== */}
        <View style={styles.menuSection}>
          <Text style={[styles.menuSectionTitle, { color: themeColors.textSecondary }]}>
            Appearance
          </Text>
          <Card style={[styles.menuCard, { backgroundColor: themeColors.card }]}>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <View
                  style={[
                    styles.menuIconContainer,
                    { backgroundColor: isDarkMode ? '#1e1b4b' : '#eef2ff' },
                  ]}
                >
                  <Ionicons
                    name={isDarkMode ? 'moon' : 'sunny-outline'}
                    size={20}
                    color={isDarkMode ? '#a5b4fc' : '#6366f1'}
                  />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuLabel, { color: themeColors.text }]}>
                    Dark Mode
                  </Text>
                  <Text style={[styles.menuSubtitle, { color: themeColors.textSecondary }]}>
                    {isDarkMode ? 'On' : 'Off'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: '#d4d4d4', true: '#06B6D4' }}
                thumbColor={isDarkMode ? '#ffffff' : '#fafafa'}
                ios_backgroundColor="#d4d4d4"
              />
            </View>
          </Card>
        </View>

        {/* ====== MENU SECTIONS ====== */}
        {menuSections.map((section, sectionIndex) => (
          <View key={section.title} style={styles.menuSection}>
            <Text style={[styles.menuSectionTitle, { color: themeColors.textSecondary }]}>{section.title}</Text>
            <Card style={[styles.menuCard, { backgroundColor: themeColors.card }]}>
              {section.items.map((item, itemIndex) => (
                <MenuItemRow
                  key={item.label}
                  item={item}
                  isLast={itemIndex === section.items.length - 1}
                  onPress={() => handleMenuPress(item)}
                />
              ))}
            </Card>
          </View>
        ))}

        {/* ====== AI ASSISTANT QUICK ACTION ====== */}
        <View style={styles.aiSection}>
          <TouchableOpacity
            style={[styles.aiCard, shadow.md]}
            onPress={() => router.push('/chat' as any)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[colors.primary[500], colors.primary[600]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.aiCardGradient}
            >
              <View style={styles.aiCardContent}>
                <View style={styles.aiIconContainer}>
                  <Ionicons name="chatbubbles" size={28} color="#ffffff" />
                </View>
                <View style={styles.aiTextContainer}>
                  <Text style={styles.aiTitle}>AI Travel Assistant</Text>
                  <Text style={styles.aiSubtitle}>
                    Ask anything about your travels
                  </Text>
                </View>
                <Ionicons
                  name="arrow-forward-circle"
                  size={28}
                  color="rgba(255,255,255,0.8)"
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ====== SIGN OUT BUTTON ====== */}
        <View style={styles.signOutSection}>
          <TouchableOpacity
            style={[styles.signOutButton, isDarkMode && { backgroundColor: '#1c1017', borderColor: '#4a1c1c' }]}
            onPress={handleSignOut}
            activeOpacity={0.7}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            )}
            <Text style={styles.signOutText}>
              {loggingOut ? 'Signing out...' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ====== APP VERSION ====== */}
        <View style={styles.versionSection}>
          <Text style={[styles.versionText, { color: themeColors.textTertiary }]}>Prayana AI v1.0.0</Text>
          <Text style={[styles.versionSubtext, { color: themeColors.textTertiary }]}>
            Your Intelligent Journey Companion
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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

  // --- Header ---
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },

  // --- Profile Card ---
  profileCardWrapper: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadow.lg,
  },
  profileGradient: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
  },
  profileInfo: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  profileName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  profileEmail: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  profileMemberSince: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 3,
  },
  profileBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 8,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: '#f59e0b',
    gap: 4,
  },
  memberBadgeText: {
    fontSize: 10,
    fontWeight: '700' as any,
    color: '#92400E',
  },
  editProfileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    gap: 4,
  },
  editProfileBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },

  // --- Stats Card ---
  statsCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: 2,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  statsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  statsLoadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // --- Menu Sections ---
  menuSection: {
    marginBottom: spacing.lg,
  },
  menuSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  menuCard: {
    marginHorizontal: spacing.xl,
    paddingHorizontal: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  menuLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  menuSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // --- AI Assistant Card ---
  aiSection: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  aiCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  aiCardGradient: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  aiCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTextContainer: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  aiTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  aiSubtitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  // --- Sign Out ---
  signOutSection: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: spacing.sm,
  },
  signOutText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#ef4444',
  },

  // --- Version ---
  versionSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  versionText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
  },
  versionSubtext: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
});
