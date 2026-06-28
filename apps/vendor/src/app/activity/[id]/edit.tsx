import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  Alert,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import {
  Card,
  Button,
  LoadingSpinner,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  useTheme,
} from '@prayana/shared-ui';
import { activityMarketplaceAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Adventure', 'Cultural', 'Food & Drink', 'Nature',
  'Wellness', 'Water Sports', 'Sightseeing', 'Nightlife',
];

const LANGUAGES = [
  'English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam',
  'Marathi', 'Bengali', 'Gujarati', 'French', 'Spanish', 'German',
];

const CANCELLATION_POLICIES = [
  { key: 'flexible', label: 'Flexible', desc: 'Full refund up to 24h before' },
  { key: 'moderate', label: 'Moderate', desc: 'Full refund up to 48h before' },
  { key: 'strict', label: 'Strict', desc: 'No refund within 7 days' },
];

const MAX_IMAGES = 8;

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={20} color={colors.primary[500]} />
      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{title}</Text>
    </View>
  );
}

// ─── Chip Selector ────────────────────────────────────────────────────────────

function ChipSelector({
  options,
  selected,
  onToggle,
  multi = false,
}: {
  options: string[];
  selected: string | string[];
  onToggle: (val: string) => void;
  multi?: boolean;
}) {
  const { themeColors } = useTheme();
  const isSelected = (val: string) =>
    multi ? (selected as string[]).includes(val) : selected === val;

  return (
    <View style={styles.chipContainer}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, { backgroundColor: themeColors.surface, borderColor: themeColors.border }, isSelected(opt) && styles.chipSelected]}
          onPress={() => onToggle(opt)}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, { color: themeColors.textSecondary }, isSelected(opt) && styles.chipTextSelected]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── List Editor ──────────────────────────────────────────────────────────────

function ListEditor({
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  items: string[];
  onAdd: (val: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}) {
  const { themeColors } = useTheme();
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const val = input.trim();
    if (val && !items.includes(val)) {
      onAdd(val);
      setInput('');
    }
  };

  return (
    <View>
      <View style={styles.listEditorInput}>
        <RNTextInput
          value={input}
          onChangeText={setInput}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textTertiary}
          style={[styles.listEditorTextInput, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }]}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.listEditorAddBtn} onPress={handleAdd}>
          <Ionicons name="add" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>
      {items.length > 0 && (
        <View style={styles.listEditorItems}>
          {items.map((item, i) => (
            <View key={i} style={[styles.listEditorItem, { backgroundColor: themeColors.inputBackground }]}>
              <Text style={[styles.listEditorItemText, { color: themeColors.text }]}>{item}</Text>
              <TouchableOpacity onPress={() => onRemove(i)}>
                <Ionicons name="close-circle" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EditActivityScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { updateListingInStore, removeListingFromStore } = useBusinessStore();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [highlights, setHighlights] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [adultPrice, setAdultPrice] = useState('');
  const [childPrice, setChildPrice] = useState('');
  const [groupDiscount, setGroupDiscount] = useState(false);
  const [duration, setDuration] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [languages, setLanguages] = useState<string[]>(['English']);
  const [includes, setIncludes] = useState<string[]>([]);
  const [whatToBring, setWhatToBring] = useState<string[]>([]);
  const [meetingPoint, setMeetingPoint] = useState('');
  const [city, setCity] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('flexible');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch Activity ───────────────────────────────────────────────────────

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await activityMarketplaceAPI.getActivityById(id);
        const a = res?.data || res?.activity || res;
        if (a) {
          setName(a.title || a.name || '');
          setCategory(a.category || '');
          setDescription(a.description || '');
          setHighlights(a.highlights || []);
          setImages(a.images || []);
          setAdultPrice(String(a.pricing?.basePrice || a.pricing?.adultPrice || a.price || ''));
          setChildPrice(String(a.pricing?.childPrice || ''));
          setGroupDiscount(a.pricing?.groupDiscount || false);
          setDuration(String(a.duration || ''));
          setMaxParticipants(String(a.maxParticipants || ''));
          setLanguages(a.languages || ['English']);
          setIncludes(a.includes || []);
          setWhatToBring(a.whatToBring || []);
          setMeetingPoint(a.location?.meetingPoint || '');
          setCity(a.location?.city || a.city || '');
          setMapsLink(a.location?.mapsLink || '');
          setCancellationPolicy(a.cancellationPolicy || 'flexible');
        }
      } catch (err) {
        Toast.show({ type: 'error', text1: 'Failed to load activity' });
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchActivity();
  }, [id]);

  // ── Image Picker ─────────────────────────────────────────────────────────

  const pickImages = useCallback(async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limit reached', `You can add up to ${MAX_IMAGES} images.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please grant photo library access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newUris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...newUris].slice(0, MAX_IMAGES));
    }
  }, [images.length]);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const toggleLanguage = useCallback((lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  }, []);

  // ── Update ───────────────────────────────────────────────────────────────

  const handleUpdate = useCallback(async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Activity name is required' });
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        title: name.trim(),
        category,
        description: description.trim(),
        highlights,
        pricing: {
          basePrice: Number(adultPrice) || 0,
          childPrice: Number(childPrice) || 0,
          groupDiscount,
        },
        duration: Number(duration) || 0,
        maxParticipants: Number(maxParticipants) || 20,
        languages,
        includes,
        whatToBring,
        location: {
          meetingPoint: meetingPoint.trim(),
          city: city.trim(),
          mapsLink: mapsLink.trim(),
        },
        cancellationPolicy,
      };

      const res = await activityMarketplaceAPI.updateListing(id, data);
      const activity = res?.data || res?.activity || res;
      if (activity) {
        updateListingInStore(id, activity);
        Toast.show({ type: 'success', text1: 'Activity updated' });
        router.back();
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to update', text2: err?.message });
    } finally {
      setSubmitting(false);
    }
  }, [
    id, name, category, description, highlights, adultPrice, childPrice,
    groupDiscount, duration, maxParticipants, languages, includes,
    whatToBring, meetingPoint, city, mapsLink, cancellationPolicy,
    updateListingInStore, router,
  ]);

  // ── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Activity',
      'Are you sure you want to delete this activity? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await activityMarketplaceAPI.deleteListing(id);
              removeListingFromStore(id);
              Toast.show({ type: 'success', text1: 'Activity deleted' });
              router.back();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: 'Failed to delete', text2: err?.message });
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [id, removeListingFromStore, router]);

  // ── Loading ──────────────────────────────────────────────────────────────

  // Theme overrides for repeated style fragments (StyleSheet kept static).
  const labelStyle = [styles.label, { color: themeColors.textSecondary }];
  const inputStyle = [styles.input, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text }];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>Edit Activity</Text>
          <View style={styles.headerSpacer} />
        </View>
        <LoadingSpinner fullScreen message="Loading activity..." />
      </SafeAreaView>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Edit Activity</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteHeaderBtn}>
          <Ionicons name="trash-outline" size={22} color={colors.error} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basic Info */}
          <Card style={styles.formSection}>
            <SectionHeader title="Basic Info" icon="information-circle-outline" />

            <Text style={labelStyle}>Activity Name *</Text>
            <RNTextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sunset Kayaking in Goa"
              placeholderTextColor={themeColors.textTertiary}
              style={inputStyle}
            />

            <Text style={labelStyle}>Category *</Text>
            <ChipSelector
              options={CATEGORIES}
              selected={category}
              onToggle={(val) => setCategory(val === category ? '' : val)}
            />

            <Text style={labelStyle}>Description *</Text>
            <RNTextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your activity..."
              placeholderTextColor={themeColors.textTertiary}
              style={[...inputStyle, styles.inputMultiline]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={labelStyle}>Highlights</Text>
            <ListEditor
              items={highlights}
              onAdd={(val) => setHighlights((prev) => [...prev, val])}
              onRemove={(i) => setHighlights((prev) => prev.filter((_, idx) => idx !== i))}
              placeholder="Add a highlight..."
            />
          </Card>

          {/* Media */}
          <Card style={styles.formSection}>
            <SectionHeader title="Media" icon="camera-outline" />
            <Text style={labelStyle}>
              Photos ({images.length}/{MAX_IMAGES})
            </Text>
            <View style={styles.imageGrid}>
              {images.map((uri, i) => (
                <View key={i} style={styles.imageThumb}>
                  <Image source={{ uri }} style={styles.imageThumbImg} />
                  <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => removeImage(i)}>
                    <Ionicons name="close-circle" size={22} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < MAX_IMAGES && (
                <TouchableOpacity style={styles.imageAddBtn} onPress={pickImages}>
                  <Ionicons name="add-outline" size={28} color={colors.primary[500]} />
                  <Text style={styles.imageAddText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>

          {/* Pricing */}
          <Card style={styles.formSection}>
            <SectionHeader title="Pricing" icon="pricetag-outline" />
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Adult Price ({'\u20B9'}) *</Text>
                <RNTextInput
                  value={adultPrice}
                  onChangeText={setAdultPrice}
                  placeholder="0"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Child Price ({'\u20B9'})</Text>
                <RNTextInput
                  value={childPrice}
                  onChangeText={setChildPrice}
                  placeholder="0"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setGroupDiscount(!groupDiscount)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={groupDiscount ? 'checkbox' : 'square-outline'}
                size={22}
                color={groupDiscount ? colors.primary[500] : themeColors.textTertiary}
              />
              <Text style={[styles.checkboxLabel, { color: themeColors.text }]}>Enable group discounts</Text>
            </TouchableOpacity>
          </Card>

          {/* Details */}
          <Card style={styles.formSection}>
            <SectionHeader title="Details" icon="document-text-outline" />
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Duration (hours) *</Text>
                <RNTextInput
                  value={duration}
                  onChangeText={setDuration}
                  placeholder="e.g. 3"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Max Participants</Text>
                <RNTextInput
                  value={maxParticipants}
                  onChangeText={setMaxParticipants}
                  placeholder="e.g. 20"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={labelStyle}>Languages Offered</Text>
            <ChipSelector
              options={LANGUAGES}
              selected={languages}
              onToggle={toggleLanguage}
              multi
            />

            <Text style={labelStyle}>What's Included</Text>
            <ListEditor
              items={includes}
              onAdd={(val) => setIncludes((prev) => [...prev, val])}
              onRemove={(i) => setIncludes((prev) => prev.filter((_, idx) => idx !== i))}
              placeholder="e.g. Equipment rental"
            />

            <Text style={labelStyle}>What to Bring</Text>
            <ListEditor
              items={whatToBring}
              onAdd={(val) => setWhatToBring((prev) => [...prev, val])}
              onRemove={(i) => setWhatToBring((prev) => prev.filter((_, idx) => idx !== i))}
              placeholder="e.g. Sunscreen"
            />
          </Card>

          {/* Location */}
          <Card style={styles.formSection}>
            <SectionHeader title="Location" icon="location-outline" />
            <Text style={labelStyle}>Meeting Point Address</Text>
            <RNTextInput
              value={meetingPoint}
              onChangeText={setMeetingPoint}
              placeholder="Where participants should meet"
              placeholderTextColor={themeColors.textTertiary}
              style={inputStyle}
            />
            <Text style={labelStyle}>City *</Text>
            <RNTextInput
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Goa"
              placeholderTextColor={themeColors.textTertiary}
              style={inputStyle}
            />
            <Text style={labelStyle}>Google Maps Link (optional)</Text>
            <RNTextInput
              value={mapsLink}
              onChangeText={setMapsLink}
              placeholder="https://maps.google.com/..."
              placeholderTextColor={themeColors.textTertiary}
              style={inputStyle}
              autoCapitalize="none"
              keyboardType="url"
            />
          </Card>

          {/* Inventory & Pricing Tools */}
          <Card style={styles.formSection}>
            <SectionHeader title="Inventory & Pricing" icon="layers-outline" />
            <TouchableOpacity
              style={styles.manageLink}
              onPress={() => router.push(`/activity/${id}/variants`)}
              activeOpacity={0.7}
            >
              <Ionicons name="layers-outline" size={20} color={colors.primary[500]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.manageLinkLabel, { color: themeColors.text }]}>Variants & pricing tiers</Text>
                <Text style={[styles.manageLinkDesc, { color: themeColors.textTertiary }]}>Standard / VIP / Private with their own prices</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
            </TouchableOpacity>
            <View style={[styles.manageDivider, { backgroundColor: themeColors.border }]} />
            <TouchableOpacity
              style={styles.manageLink}
              onPress={() => router.push(`/activity/${id}/time-slots`)}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={20} color={colors.primary[500]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.manageLinkLabel, { color: themeColors.text }]}>Time slots & availability</Text>
                <Text style={[styles.manageLinkDesc, { color: themeColors.textTertiary }]}>Multiple batches per day with capacity limits</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
            </TouchableOpacity>
            <View style={[styles.manageDivider, { backgroundColor: themeColors.border }]} />
            <TouchableOpacity
              style={styles.manageLink}
              onPress={() => router.push(`/activity/${id}/pricing`)}
              activeOpacity={0.7}
            >
              <Ionicons name="pricetags-outline" size={20} color={colors.primary[500]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.manageLinkLabel, { color: themeColors.text }]}>Pricing rules</Text>
                <Text style={[styles.manageLinkDesc, { color: themeColors.textTertiary }]}>Bulk discounts, seasonal rates & date overrides</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
            </TouchableOpacity>
          </Card>

          {/* Cancellation Policy */}
          <Card style={styles.formSection}>
            <SectionHeader title="Cancellation Policy" icon="shield-checkmark-outline" />
            {CANCELLATION_POLICIES.map((policy) => (
              <TouchableOpacity
                key={policy.key}
                style={[
                  styles.policyOption,
                  { borderBottomColor: themeColors.border },
                  cancellationPolicy === policy.key && styles.policyOptionSelected,
                ]}
                onPress={() => setCancellationPolicy(policy.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={cancellationPolicy === policy.key ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={cancellationPolicy === policy.key ? colors.primary[500] : themeColors.textTertiary}
                />
                <View style={styles.policyText}>
                  <Text style={[styles.policyLabel, { color: themeColors.text }]}>{policy.label}</Text>
                  <Text style={[styles.policyDesc, { color: themeColors.textSecondary }]}>{policy.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Card>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title="Update Activity"
              onPress={handleUpdate}
              size="lg"
              loading={submitting}
              disabled={deleting}
              fullWidth
            />
          </View>

          <Button
            title="Delete Activity"
            onPress={handleDelete}
            variant="danger"
            size="lg"
            loading={deleting}
            disabled={submitting}
            fullWidth
            style={styles.deleteBtn}
          />

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  deleteHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.xl,
  },

  // Form sections
  formSection: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },

  // Labels & Inputs
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },

  // Chips
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primary[600],
    fontWeight: fontWeight.semibold,
  },

  // List Editor
  listEditorInput: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  listEditorTextInput: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  listEditorAddBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  listEditorItems: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  listEditorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  listEditorItemText: {
    fontSize: fontSize.sm,
    color: colors.text,
    flex: 1,
  },

  // Images
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  imageThumb: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    position: 'relative',
  },
  imageThumbImg: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
  },
  imageAddBtn: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary[300],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
  },
  imageAddText: {
    fontSize: fontSize.xs,
    color: colors.primary[500],
    marginTop: 2,
  },

  // Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  checkboxLabel: {
    fontSize: fontSize.md,
    color: colors.text,
  },

  // Inventory manage links
  manageLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  manageLinkLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  manageLinkDesc: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  manageDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  // Policy
  policyOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  policyOptionSelected: {
    backgroundColor: colors.primary[50],
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderBottomWidth: 0,
  },
  policyText: {
    flex: 1,
  },
  policyLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  policyDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Actions
  actions: {
    marginTop: spacing.xl,
  },
  deleteBtn: {
    marginTop: spacing.md,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
