import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import Toast from 'react-native-toast-message';

// ============================================================
// TYPES
// ============================================================
interface FAQItem {
  question: string;
  answer: string;
}

// ============================================================
// DATA
// ============================================================
const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'How do I create a trip?',
    answer:
      'Tap the "Create" tab at the bottom to start planning a new trip. Follow the guided steps to set up your destination, dates, and itinerary.',
  },
  {
    question: 'Can I collaborate with friends?',
    answer:
      'Yes! Once you create a trip, you can invite others to collaborate in real-time. They can add activities, suggest changes, and chat within the trip.',
  },
  {
    question: 'How do I book activities?',
    answer:
      'Browse activities in the Explore tab, select one you like, choose your date and time, and complete the booking in a few easy steps.',
  },
  {
    question: 'Can I cancel a booking?',
    answer:
      'You can cancel bookings from the My Bookings section. Cancellation policies vary by activity provider. Refunds are processed based on the cancellation policy.',
  },
  {
    question: 'Is the AI assistant free to use?',
    answer:
      'Yes! Our AI travel assistant is included with your Prayana account at no extra cost. Use it to get trip ideas, activity suggestions, and travel advice.',
  },
];

// ============================================================
// FAQ ACCORDION ITEM
// ============================================================
function FAQAccordion({ item }: { item: FAQItem }) {
  const [expanded, setExpanded] = React.useState(false);
  const { themeColors } = useTheme();

  return (
    <TouchableOpacity
      style={styles.faqItem}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQuestion, { color: themeColors.text }]}>{item.question}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={themeColors.textSecondary}
        />
      </View>
      {expanded && <Text style={[styles.faqAnswer, { color: themeColors.textSecondary }]}>{item.answer}</Text>}
    </TouchableOpacity>
  );
}

// ============================================================
// HELP CENTER SCREEN
// ============================================================
export default function HelpScreen() {
  const { themeColors } = useTheme();
  const handleContactSupport = useCallback(async () => {
    try {
      await Linking.openURL('mailto:support@prayana.ai?subject=Help%20Request');
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Cannot open email',
        text2: 'Please email support@prayana.ai directly.',
      });
    }
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ====== FAQ SECTION ====== */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Frequently Asked Questions</Text>
        <Card style={[styles.faqCard, { backgroundColor: themeColors.card }]}>
          {FAQ_ITEMS.map((item, index) => (
            <View key={index}>
              <FAQAccordion item={item} />
              {index < FAQ_ITEMS.length - 1 && <View style={[styles.faqDivider, { backgroundColor: themeColors.border }]} />}
            </View>
          ))}
        </Card>
      </View>

      {/* ====== CONTACT SECTION ====== */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Need More Help?</Text>
        <Card style={[styles.contactCard, { backgroundColor: themeColors.card }]}>
          <TouchableOpacity
            style={styles.contactItem}
            onPress={handleContactSupport}
            activeOpacity={0.7}
          >
            <View style={styles.contactIconBg}>
              <Ionicons name="mail-outline" size={22} color={colors.primary[500]} />
            </View>
            <View style={styles.contactText}>
              <Text style={[styles.contactLabel, { color: themeColors.text }]}>Email Support</Text>
              <Text style={[styles.contactValue, { color: themeColors.textSecondary }]}>support@prayana.ai</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={themeColors.textTertiary} />
          </TouchableOpacity>
        </Card>
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

  // --- Section ---
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },

  // --- FAQ ---
  faqCard: {
    marginHorizontal: spacing.xl,
    paddingHorizontal: 0,
  },
  faqItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginRight: spacing.md,
  },
  faqAnswer: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  faqDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },

  // --- Contact ---
  contactCard: {
    marginHorizontal: spacing.xl,
    paddingHorizontal: 0,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  contactIconBg: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    flex: 1,
  },
  contactLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  contactValue: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
