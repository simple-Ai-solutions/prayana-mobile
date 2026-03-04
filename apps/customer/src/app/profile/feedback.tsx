import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, colors, fontSize, fontWeight, spacing, borderRadius } from '@prayana/shared-ui';

const CATEGORIES = [
  { id: 'general', label: 'General', icon: 'chatbubble-outline' },
  { id: 'bug', label: 'Bug Report', icon: 'bug-outline' },
  { id: 'feature', label: 'Feature Request', icon: 'bulb-outline' },
  { id: 'ai', label: 'AI Suggestions', icon: 'sparkles-outline' },
  { id: 'ux', label: 'UI/UX', icon: 'color-palette-outline' },
];

const RATINGS = [1, 2, 3, 4, 5];

export default function FeedbackScreen() {
  const router = useRouter();
  const { isDarkMode, themeColors } = useTheme();

  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please give us a rating before submitting.');
      return;
    }
    if (message.trim().length < 10) {
      Alert.alert('Feedback Required', 'Please write at least 10 characters of feedback.');
      return;
    }

    setSubmitting(true);
    // TODO: call backend feedback API
    await new Promise((r) => setTimeout(r, 1000));
    setSubmitting(false);

    Alert.alert(
      'Thank you! 🙏',
      'Your feedback has been submitted. We really appreciate you helping us improve Prayana.',
      [{ text: 'Done', onPress: () => router.back() }]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Send Feedback</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Illustration */}
          <View style={styles.illustration}>
            <LinearGradient
              colors={[colors.primary[400], colors.primary[600]]}
              style={styles.illustrationCircle}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="chatbubble-ellipses" size={40} color="#ffffff" />
            </LinearGradient>
            <Text style={[styles.illustTitle, { color: themeColors.text }]}>We'd love to hear from you!</Text>
            <Text style={[styles.illustSub, { color: themeColors.textSecondary }]}>
              Your feedback helps us build a better travel experience.
            </Text>
          </View>

          {/* Overall Rating */}
          <View style={[styles.section, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.sectionLabel, { color: themeColors.text }]}>Overall Rating</Text>
            <View style={styles.starsRow}>
              {RATINGS.map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={36}
                    color={star <= rating ? '#f59e0b' : themeColors.border}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <Text style={[styles.ratingLabel, { color: themeColors.textSecondary }]}>
                {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][rating]}
              </Text>
            )}
          </View>

          {/* Category */}
          <View style={[styles.section, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.sectionLabel, { color: themeColors.text }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
              {CATEGORIES.map((cat) => {
                const selected = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setCategory(cat.id)}
                    activeOpacity={0.8}
                    style={[
                      styles.catChip,
                      selected
                        ? { backgroundColor: colors.primary[500], borderColor: colors.primary[500] }
                        : { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border },
                    ]}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={14}
                      color={selected ? '#ffffff' : themeColors.textSecondary}
                    />
                    <Text style={[styles.catText, { color: selected ? '#ffffff' : themeColors.text }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Message */}
          <View style={[styles.section, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.sectionLabel, { color: themeColors.text }]}>Your Message</Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  color: themeColors.text,
                  backgroundColor: themeColors.backgroundSecondary,
                  borderColor: themeColors.border,
                },
              ]}
              placeholder="Tell us what you think, what's working, what's not, or ideas for improvement..."
              placeholderTextColor={themeColors.textTertiary}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={1000}
            />
            <Text style={[styles.charCount, { color: themeColors.textTertiary }]}>
              {message.length}/1000
            </Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={submitting}
          >
            <LinearGradient
              colors={[colors.primary[500], colors.primary[600]]}
              style={styles.submitBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#ffffff" />
                  <Text style={styles.submitBtnText}>Submit Feedback</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Privacy note */}
          <View style={styles.privacyNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={themeColors.textTertiary} />
            <Text style={[styles.privacyText, { color: themeColors.textTertiary }]}>
              Your feedback is anonymous and helps improve Prayana for everyone.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },

  content: { paddingBottom: 40 },

  illustration: {
    alignItems: 'center',
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  illustrationCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  illustTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: 6,
  },
  illustSub: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },

  section: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
  },
  sectionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },

  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  ratingLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },

  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  catText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },

  textArea: {
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
    fontSize: fontSize.md,
    lineHeight: 22,
    minHeight: 130,
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 6,
  },

  submitBtn: {
    marginHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  submitBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: spacing.lg,
  },
  submitBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },

  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  privacyText: { fontSize: 11, flex: 1, lineHeight: 16 },
});
