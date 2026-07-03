import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, shadow, borderRadius } from '@prayana/shared-ui';
import { esimAPI } from '@prayana/shared-services';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// DATA
// ============================================================

const POPULAR_COUNTRIES = [
  { name: 'USA', flag: '\u{1F1FA}\u{1F1F8}', code: 'US' },
  { name: 'Japan', flag: '\u{1F1EF}\u{1F1F5}', code: 'JP' },
  { name: 'Thailand', flag: '\u{1F1F9}\u{1F1ED}', code: 'TH' },
  { name: 'France', flag: '\u{1F1EB}\u{1F1F7}', code: 'FR' },
  { name: 'Italy', flag: '\u{1F1EE}\u{1F1F9}', code: 'IT' },
  { name: 'UK', flag: '\u{1F1EC}\u{1F1E7}', code: 'GB' },
  { name: 'Singapore', flag: '\u{1F1F8}\u{1F1EC}', code: 'SG' },
  { name: 'Australia', flag: '\u{1F1E6}\u{1F1FA}', code: 'AU' },
  { name: 'UAE', flag: '\u{1F1E6}\u{1F1EA}', code: 'AE' },
  { name: 'Spain', flag: '\u{1F1EA}\u{1F1F8}', code: 'ES' },
  { name: 'Germany', flag: '\u{1F1E9}\u{1F1EA}', code: 'DE' },
  { name: 'South Korea', flag: '\u{1F1F0}\u{1F1F7}', code: 'KR' },
];

// Mock eSIM plans (replace with Airalo API integration later)
const ESIM_PLANS = [
  { id: '1', country: 'USA', flag: '\u{1F1FA}\u{1F1F8}', name: 'USA Stacked', data: '2 GB', validity: '7 days', price: 8.99, currency: 'USD', popular: true },
  { id: '2', country: 'USA', flag: '\u{1F1FA}\u{1F1F8}', name: 'USA Unlimited Plus', data: 'Unlimited', validity: '15 days', price: 24.99, currency: 'USD', popular: false },
  { id: '3', country: 'Japan', flag: '\u{1F1EF}\u{1F1F5}', name: 'Japan Explorer', data: '5 GB', validity: '7 days', price: 12.50, currency: 'USD', popular: true },
  { id: '4', country: 'France', flag: '\u{1F1EB}\u{1F1F7}', name: 'France Connect', data: '5 GB', validity: '15 days', price: 15.99, currency: 'USD', popular: false },
  { id: '5', country: 'UK', flag: '\u{1F1EC}\u{1F1E7}', name: 'UK Premium', data: '15 GB', validity: '30 days', price: 24.99, currency: 'USD', popular: false },
  { id: '6', country: 'Thailand', flag: '\u{1F1F9}\u{1F1ED}', name: 'Thailand Travel', data: '10 GB', validity: '15 days', price: 14.99, currency: 'USD', popular: true },
  { id: '7', country: 'Singapore', flag: '\u{1F1F8}\u{1F1EC}', name: 'Singapore Basic', data: '3 GB', validity: '7 days', price: 9.99, currency: 'USD', popular: false },
  { id: '8', country: 'Australia', flag: '\u{1F1E6}\u{1F1FA}', name: 'Australia Plus', data: '10 GB', validity: '30 days', price: 29.99, currency: 'USD', popular: false },
  { id: '9', country: 'UAE', flag: '\u{1F1E6}\u{1F1EA}', name: 'UAE Explorer', data: '3 GB', validity: '7 days', price: 10.99, currency: 'USD', popular: false },
  { id: '10', country: 'Italy', flag: '\u{1F1EE}\u{1F1F9}', name: 'Italy Traveler', data: '5 GB', validity: '10 days', price: 13.99, currency: 'USD', popular: true },
  { id: '11', country: 'Spain', flag: '\u{1F1EA}\u{1F1F8}', name: 'Spain Connect', data: '8 GB', validity: '15 days', price: 18.99, currency: 'USD', popular: false },
  { id: '12', country: 'Germany', flag: '\u{1F1E9}\u{1F1EA}', name: 'Germany Plus', data: '5 GB', validity: '7 days', price: 11.99, currency: 'USD', popular: false },
  { id: '13', country: 'South Korea', flag: '\u{1F1F0}\u{1F1F7}', name: 'Korea Unlimited', data: 'Unlimited', validity: '7 days', price: 19.99, currency: 'USD', popular: true },
];

const HOW_IT_WORKS = [
  { step: 1, title: 'Check Compatibility', desc: 'Verify your phone supports eSIM technology', icon: 'phone-portrait-outline' as const },
  { step: 2, title: 'Select Destination', desc: 'Choose your travel country and data plan', icon: 'globe-outline' as const },
  { step: 3, title: 'Install & Activate', desc: 'Scan QR code to install your eSIM profile', icon: 'flash-outline' as const },
  { step: 4, title: 'Stay Connected', desc: 'Enjoy data from the moment you land abroad', icon: 'checkmark-circle-outline' as const },
];

const BENEFITS = [
  { title: 'Instant Activation', desc: 'No physical SIM needed', icon: 'flash-outline' as const },
  { title: 'Global Coverage', desc: '190+ countries supported', icon: 'earth-outline' as const },
  { title: 'Affordable Rates', desc: 'Save up to 90% on roaming', icon: 'wallet-outline' as const },
  { title: 'Secure Connection', desc: 'Private & encrypted data', icon: 'shield-checkmark-outline' as const },
  { title: 'Flexible Plans', desc: 'Pay only for what you need', icon: 'stats-chart-outline' as const },
  { title: '24/7 Support', desc: 'Help whenever you need it', icon: 'headset-outline' as const },
];

const TAB_OPTIONS = ['Country', 'Regional', 'Global'] as const;

// ============================================================
// COMPONENT
// ============================================================

export default function ESIMPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // --- Filtered plans ---
  const filteredPlans = useMemo(() => {
    let plans = ESIM_PLANS;
    if (selectedCountry) {
      plans = plans.filter((p) => p.country === selectedCountry);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      plans = plans.filter(
        (p) =>
          p.country.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
      );
    }
    return plans;
  }, [searchQuery, selectedCountry]);

  // --- Handlers ---
  const handleCountrySelect = useCallback((name: string) => {
    setSelectedCountry((prev) => (prev === name ? null : name));
    setSearchQuery('');
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
    setSelectedCountry(null);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ======= HEADER ======= */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Travel eSIM</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="help-circle-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={true}
      >
        {/* ======= HERO SECTION ======= */}
        <LinearGradient
          colors={[colors.primary[500], colors.primary[700]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Decorative circles */}
          <View style={styles.heroDecorCircle1} />
          <View style={styles.heroDecorCircle2} />

          <View style={styles.heroContent}>
            <View style={styles.heroIconContainer}>
              <Ionicons name="cellular-outline" size={32} color="#ffffff" />
            </View>
            <Text style={styles.heroTitle}>{'Stay Connected\nAnywhere'}</Text>
            <Text style={styles.heroSubtitle}>
              {'Get instant data access in 190+ countries\nNo physical SIM card needed'}
            </Text>
          </View>

          {/* ======= SEARCH CARD (glass effect) ======= */}
          <View style={styles.searchCard}>
            {/* Tabs */}
            <View style={styles.tabs}>
              {TAB_OPTIONS.map((tab, idx) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === idx && styles.tabActive]}
                  onPress={() => setActiveTab(idx)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, activeTab === idx && styles.tabTextActive]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Search input */}
            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={20} color={colors.textTertiary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search country or destination..."
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={handleSearchClear}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.poweredBy}>
              Powered by Airalo  {'\u2022'}  Instant activation  {'\u2022'}  190+ countries
            </Text>
          </View>
        </LinearGradient>

        {/* ======= POPULAR DESTINATIONS ======= */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular Destinations</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.countriesRow}
          >
            {POPULAR_COUNTRIES.map((c) => {
              const isActive = selectedCountry === c.name;
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.countryChip, isActive && styles.countryChipActive]}
                  onPress={() => handleCountrySelect(c.name)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.countryFlag}>{c.flag}</Text>
                  <Text style={[styles.countryName, isActive && styles.countryNameActive]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ======= PLANS ======= */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedCountry ? `${selectedCountry} Plans` : 'Available Plans'}
            </Text>
            {selectedCountry && (
              <TouchableOpacity onPress={() => setSelectedCountry(null)} activeOpacity={0.7}>
                <Text style={styles.clearFilter}>Clear filter</Text>
              </TouchableOpacity>
            )}
          </View>

          {filteredPlans.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.emptyTitle}>No plans found</Text>
              <Text style={styles.emptySubtitle}>
                Try a different country or search term.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={handleSearchClear}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={16} color="#ffffff" />
                <Text style={styles.emptyBtnText}>Reset Search</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredPlans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[styles.planCard, shadow.md]}
                activeOpacity={0.85}
              >
                {/* Plan header row */}
                <View style={styles.planHeader}>
                  <View style={styles.planCountryRow}>
                    <Text style={styles.planFlag}>{plan.flag}</Text>
                    <View style={styles.planNameCol}>
                      <Text style={styles.planName} numberOfLines={1}>{plan.name}</Text>
                      <Text style={styles.planCountry}>{plan.country}</Text>
                    </View>
                  </View>
                  {plan.popular && (
                    <View style={styles.popularBadge}>
                      <Ionicons name="flame" size={12} color="#ffffff" />
                      <Text style={styles.popularBadgeText}>Popular</Text>
                    </View>
                  )}
                </View>

                {/* Divider */}
                <View style={styles.planDivider} />

                {/* Plan details: 3-column row */}
                <View style={styles.planDetails}>
                  <View style={styles.planDetail}>
                    <Ionicons name="cloud-download-outline" size={16} color={colors.primary[500]} />
                    <Text style={styles.planDetailLabel}>Data</Text>
                    <Text style={styles.planDetailValue}>{plan.data}</Text>
                  </View>
                  <View style={[styles.planDetail, styles.planDetailCenter]}>
                    <Ionicons name="time-outline" size={16} color={colors.primary[500]} />
                    <Text style={styles.planDetailLabel}>Validity</Text>
                    <Text style={styles.planDetailValue}>{plan.validity}</Text>
                  </View>
                  <View style={styles.planDetail}>
                    <Ionicons name="pricetag-outline" size={16} color={colors.primary[500]} />
                    <Text style={styles.planDetailLabel}>Price</Text>
                    <Text style={styles.planPriceValue}>${plan.price.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Buy button */}
                <TouchableOpacity style={styles.buyBtn} activeOpacity={0.8}>
                  <Text style={styles.buyBtnText}>Buy Now</Text>
                  <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ======= HOW IT WORKS ======= */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>How It Works</Text>
          </View>
          <View style={styles.stepsContainer}>
            {HOW_IT_WORKS.map((item, idx) => (
              <View key={item.step} style={styles.stepRow}>
                {/* Step number + connecting line */}
                <View style={styles.stepLineCol}>
                  <LinearGradient
                    colors={[colors.primary[400], colors.primary[600]]}
                    style={styles.stepCircle}
                  >
                    <Text style={styles.stepNumber}>{item.step}</Text>
                  </LinearGradient>
                  {idx < HOW_IT_WORKS.length - 1 && <View style={styles.stepLine} />}
                </View>

                {/* Step content */}
                <View style={[styles.stepContent, shadow.sm]}>
                  <View style={styles.stepIconWrapper}>
                    <Ionicons name={item.icon} size={22} color={colors.primary[500]} />
                  </View>
                  <View style={styles.stepTextCol}>
                    <Text style={styles.stepTitle}>{item.title}</Text>
                    <Text style={styles.stepDesc}>{item.desc}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ======= BENEFITS ======= */}
        <View style={[styles.section, { marginBottom: spacing['4xl'] }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Why Choose eSIM?</Text>
          </View>
          <View style={styles.benefitsGrid}>
            {BENEFITS.map((b) => (
              <View key={b.title} style={[styles.benefitCard, shadow.sm]}>
                <View style={styles.benefitIconWrapper}>
                  <Ionicons name={b.icon} size={24} color={colors.primary[500]} />
                </View>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ======= COMPATIBILITY CTA ======= */}
        <View style={[styles.section, { marginBottom: spacing['5xl'] }]}>
          <LinearGradient
            colors={[colors.primary[50], colors.primary[100]]}
            style={styles.ctaCard}
          >
            <View style={styles.ctaIconWrapper}>
              <Ionicons name="phone-portrait-outline" size={28} color={colors.primary[600]} />
            </View>
            <Text style={styles.ctaTitle}>Is your phone eSIM compatible?</Text>
            <Text style={styles.ctaSubtitle}>
              Most phones released after 2020 support eSIM. Check your device settings or tap below.
            </Text>
            <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.8}>
              <Text style={styles.ctaBtnText}>Check Compatibility</Text>
              <Ionicons name="arrow-forward" size={16} color="#ffffff" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================

const CARD_HORIZONTAL_PADDING = spacing.xl;
const BENEFIT_CARD_WIDTH = (SCREEN_WIDTH - CARD_HORIZONTAL_PADDING * 2 - spacing.md) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing['2xl'],
  },

  // --- Header ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Hero ---
  hero: {
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'] + 60, // Extra space for overlapping search card
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    position: 'relative',
    overflow: 'hidden',
  },
  heroDecorCircle1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroDecorCircle2: {
    position: 'absolute',
    bottom: 20,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroContent: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  heroIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heroTitle: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 38,
  },
  heroSubtitle: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },

  // --- Search Card (glass effect inside hero) ---
  searchCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadow.lg,
    // Positioned to overlap the hero bottom
    position: 'absolute',
    bottom: -40,
    left: CARD_HORIZONTAL_PADDING,
    right: CARD_HORIZONTAL_PADDING,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
    padding: 3,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  tabActive: {
    backgroundColor: colors.primary[500],
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: fontWeight.semibold,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: 0,
  },
  poweredBy: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // --- Section ---
  section: {
    marginTop: spacing['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  clearFilter: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
  },

  // --- Popular Countries ---
  countriesRow: {
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    gap: spacing.sm,
  },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.border,
  },
  countryChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  countryFlag: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  countryName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  countryNameActive: {
    color: colors.primary[600],
    fontWeight: fontWeight.semibold,
  },

  // --- Plan Cards ---
  planCard: {
    marginHorizontal: CARD_HORIZONTAL_PADDING,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  planCountryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  planFlag: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  planNameCol: {
    flex: 1,
  },
  planName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  planCountry: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  planDetails: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  planDetail: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  planDetailCenter: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  planDetailLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
  },
  planDetailValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  planPriceValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary[600],
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  buyBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },

  // --- Empty State ---
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing['2xl'],
    marginHorizontal: CARD_HORIZONTAL_PADDING,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  emptyBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },

  // --- How It Works ---
  stepsContainer: {
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
  },
  stepRow: {
    flexDirection: 'row',
    minHeight: 80,
  },
  stepLineCol: {
    width: 40,
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.primary[200],
    marginVertical: 4,
  },
  stepContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginLeft: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stepTextCol: {
    flex: 1,
  },
  stepTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  stepDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },

  // --- Benefits Grid (2 columns) ---
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    gap: spacing.md,
  },
  benefitCard: {
    width: BENEFIT_CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  benefitIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  benefitTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  benefitDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 16,
  },

  // --- Compatibility CTA ---
  ctaCard: {
    marginHorizontal: CARD_HORIZONTAL_PADDING,
    borderRadius: borderRadius.xl,
    padding: spacing['2xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  ctaIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  ctaTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  ctaSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  ctaBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
});
