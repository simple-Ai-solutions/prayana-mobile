import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput as RNTextInput,
  Image,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { Card, Badge, useTheme } from '@prayana/shared-ui';
import { Button } from '../../../components/ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '../../../theme/vendorColors';
import {
  StepProps,
  PackageImage,
  CancellationRule,
} from './packageTypes';

// ─── Constants (ported verbatim from the web InclusionsMediaStep) ────────────

const COMMON_INCLUSIONS = [
  'Accommodation', 'Breakfast', 'Lunch', 'Dinner', 'All meals',
  'Airport transfers', 'Local sightseeing', 'Guide services',
  'Entry fees', 'Boat rides', 'Safari charges', 'Travel insurance',
  'Welcome drink', 'Mineral water', 'AC vehicle',
];

const COMMON_EXCLUSIONS = [
  'Airfare', 'Personal expenses', 'Tips and gratuities',
  'Laundry', 'Room service', 'Optional activities',
  'Camera/video charges', 'Travel insurance', 'GST (5%)',
  'Anything not mentioned in inclusions',
];

const CANCELLATION_TYPES: {
  value: 'flexible' | 'moderate' | 'strict' | 'non_refundable';
  label: string;
  desc: string;
  emoji: string;
}[] = [
  { value: 'flexible', label: 'Flexible', desc: 'Full refund 7+ days before, 50% within 3-7 days', emoji: '😊' },
  { value: 'moderate', label: 'Moderate', desc: '75% refund 14+ days, 50% 7-14 days', emoji: '🤝' },
  { value: 'strict', label: 'Strict', desc: '50% refund 30+ days, 25% 14-30 days', emoji: '📋' },
  { value: 'non_refundable', label: 'Non-refundable', desc: 'No refunds after booking', emoji: '🔒' },
];

const MAX_IMAGES = 10;

// ─── Small presentational helper ─────────────────────────────────────────────

function SectionHeader({
  title,
  icon,
  iconColor,
  subtitle,
  right,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={20} color={iconColor || colors.primary[500]} />
      <View style={styles.sectionHeaderText}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.sectionSubtitle, { color: themeColors.textTertiary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function InclusionsMediaStep({ values, onChange }: StepProps) {
  const { themeColors } = useTheme();

  const [newInclusion, setNewInclusion] = useState('');
  const [newExclusion, setNewExclusion] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');

  const inputStyle = [
    styles.input,
    { backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder, color: themeColors.text },
  ];

  // ── Inclusions / Exclusions ────────────────────────────────────────────────

  const addInclusion = (text: string) => {
    const t = text.trim();
    if (t && !values.inclusions.includes(t)) {
      onChange({ inclusions: [...values.inclusions, t] });
    }
    setNewInclusion('');
  };

  const removeInclusion = (idx: number) => {
    onChange({ inclusions: values.inclusions.filter((_, i) => i !== idx) });
  };

  const addExclusion = (text: string) => {
    const t = text.trim();
    if (t && !values.exclusions.includes(t)) {
      onChange({ exclusions: [...values.exclusions, t] });
    }
    setNewExclusion('');
  };

  const removeExclusion = (idx: number) => {
    onChange({ exclusions: values.exclusions.filter((_, i) => i !== idx) });
  };

  // ── Cancellation policy ────────────────────────────────────────────────────

  const rules = values.cancellationPolicy?.rules || [];

  const setCancellationType = (type: (typeof CANCELLATION_TYPES)[number]['value']) => {
    onChange({ cancellationPolicy: { ...values.cancellationPolicy, type } });
  };

  const addRule = () => {
    onChange({
      cancellationPolicy: {
        ...values.cancellationPolicy,
        rules: [...rules, { daysBeforeTravel: 7, refundPercent: 50 }],
      },
    });
  };

  const updateRule = (idx: number, key: keyof CancellationRule, num: number) => {
    const next = rules.map((r, i) => (i === idx ? { ...r, [key]: num } : r));
    onChange({ cancellationPolicy: { ...values.cancellationPolicy, rules: next } });
  };

  const removeRule = (idx: number) => {
    onChange({
      cancellationPolicy: {
        ...values.cancellationPolicy,
        rules: rules.filter((_, i) => i !== idx),
      },
    });
  };

  // ── Vendor story ───────────────────────────────────────────────────────────

  const story = values.vendorStory || { headline: '', narrative: '', localInsights: [] };

  const updateStory = (patch: Partial<typeof story>) => {
    onChange({ vendorStory: { ...story, ...patch } });
  };

  // ── SEO ────────────────────────────────────────────────────────────────────

  const seo = values.seo || { metaTitle: '', metaDescription: '', keywords: [] };

  const updateSeo = (patch: Partial<typeof seo>) => {
    onChange({ seo: { ...seo, ...patch } });
  };

  // Ported EXACTLY from the web autoFillSEO. In this contract `nights` is the
  // top-level field (duration.days is derived as nights + 1) and categories
  // live on `values.category`.
  const autoFillSEO = () => {
    const dests = (values.destinations || [])
      .map((d) => d.city || d.name)
      .filter(Boolean);
    const nights = values.nights || 0;
    const days = nights + 1;
    const title = values.title || '';
    const categories = values.category || [];

    const metaTitle = (
      title.length > 60 ? title.substring(0, 60) + ' | Prayana AI' : `${title} | Prayana AI`
    ).substring(0, 70);

    const destStr = dests.slice(0, 3).join(', ');
    const metaDescription =
      `Book ${title || 'this holiday package'} — ${nights}N/${days}D covering ${destStr || 'amazing destinations'}. Best prices, verified operators. Book on Prayana AI.`.substring(
        0,
        160,
      );

    const keywords = [
      ...dests.map((d) => d.toLowerCase()),
      ...categories.map((c) => c.toLowerCase()),
      `${nights}n ${days}d package`,
      'holiday package',
      'prayana ai',
    ].filter(Boolean);

    onChange({ seo: { metaTitle, metaDescription, keywords } });
    Toast.show({ type: 'success', text1: 'SEO generated', text2: 'Review and tweak as needed.' });
  };

  // ── Images ─────────────────────────────────────────────────────────────────
  // The web sends images INLINE in the package body as base64 data URLs — there
  // is no separate package image-upload endpoint. expo-image-manipulator is not
  // installed in this app, so we lean on expo-image-picker's own base64 output
  // (low quality to keep the payload manageable) and build a data URL from it.

  const images = values.images || [];
  const imageCount = images.length;

  const pickImages = useCallback(async () => {
    const current = values.images || [];
    const remaining = MAX_IMAGES - current.length;
    if (remaining <= 0) {
      Toast.show({ type: 'error', text1: `Maximum ${MAX_IMAGES} images allowed` });
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please grant photo library access to add images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.4, // low quality — base64 data URL ships inline in the body
      base64: true,
    });
    if (result.canceled || !result.assets) return;

    const base = values.images || [];
    const added: PackageImage[] = [];
    result.assets.slice(0, MAX_IMAGES - base.length).forEach((a) => {
      if (!a.base64) return;
      const overallIndex = base.length + added.length;
      added.push({
        url: `data:image/jpeg;base64,${a.base64}`,
        caption: '',
        isPrimary: overallIndex === 0, // first image overall becomes the cover
        order: overallIndex,
        _isFile: true,
      });
    });
    if (added.length > 0) {
      onChange({ images: [...base, ...added] });
    }
  }, [values.images, onChange]);

  const addImageUrl = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    const current = values.images || [];
    if (current.length >= MAX_IMAGES) {
      Toast.show({ type: 'error', text1: `Maximum ${MAX_IMAGES} images allowed` });
      return;
    }
    onChange({
      images: [
        ...current,
        { url, caption: '', isPrimary: current.length === 0, order: current.length },
      ],
    });
    setImageUrlInput('');
  };

  const removeImage = (idx: number) => {
    const next = (values.images || []).filter((_, i) => i !== idx);
    // If the removed image was the primary one, promote the new first image.
    if (next.length > 0 && !next.some((img) => img.isPrimary)) {
      next[0] = { ...next[0], isPrimary: true };
    }
    onChange({ images: next.map((img, i) => ({ ...img, order: i })) });
  };

  const setPrimaryImage = (idx: number) => {
    onChange({
      images: (values.images || []).map((img, i) => ({ ...img, isPrimary: i === idx })),
    });
  };

  const updateCaption = (idx: number, caption: string) => {
    onChange({
      images: (values.images || []).map((img, i) => (i === idx ? { ...img, caption } : img)),
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const availableInclusions = COMMON_INCLUSIONS.filter((i) => !values.inclusions.includes(i));
  const availableExclusions = COMMON_EXCLUSIONS.filter((i) => !values.exclusions.includes(i));

  return (
    <View style={styles.container}>
      {/* ═══ Inclusions ═══ */}
      <Card style={styles.section}>
        <SectionHeader
          title="What's Included"
          icon="checkmark-circle-outline"
          iconColor={colors.success}
          right={<Badge label={`${values.inclusions.length} items`} variant="success" />}
        />

        {availableInclusions.length > 0 && (
          <View style={styles.chipWrap}>
            {availableInclusions.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.suggestChip, { borderColor: colors.success }]}
                onPress={() => addInclusion(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={13} color={colors.success} />
                <Text style={[styles.suggestChipText, { color: colors.success }]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {values.inclusions.length > 0 && (
          <View style={styles.chipWrap}>
            {values.inclusions.map((item, idx) => (
              <View key={`${item}-${idx}`} style={[styles.addedChip, { backgroundColor: colors.successLight }]}>
                <Ionicons name="checkmark" size={13} color={colors.success} />
                <Text style={[styles.addedChipText, { color: colors.success }]}>{item}</Text>
                <TouchableOpacity onPress={() => removeInclusion(idx)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                  <Ionicons name="close" size={13} color={colors.success} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.addRow}>
          <RNTextInput
            value={newInclusion}
            onChangeText={setNewInclusion}
            onSubmitEditing={() => addInclusion(newInclusion)}
            placeholder="Add custom inclusion..."
            placeholderTextColor={themeColors.textTertiary}
            style={[...inputStyle, styles.addInput]}
            returnKeyType="done"
          />
          <Button title="Add" onPress={() => addInclusion(newInclusion)} size="md" disabled={!newInclusion.trim()} />
        </View>
      </Card>

      {/* ═══ Exclusions ═══ */}
      <Card style={styles.section}>
        <SectionHeader
          title="What's Not Included"
          icon="close-circle-outline"
          iconColor={colors.error}
          right={<Badge label={`${values.exclusions.length} items`} variant="error" />}
        />

        {availableExclusions.length > 0 && (
          <View style={styles.chipWrap}>
            {availableExclusions.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.suggestChip, { borderColor: colors.error }]}
                onPress={() => addExclusion(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={13} color={colors.error} />
                <Text style={[styles.suggestChipText, { color: colors.error }]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {values.exclusions.length > 0 && (
          <View style={styles.chipWrap}>
            {values.exclusions.map((item, idx) => (
              <View key={`${item}-${idx}`} style={[styles.addedChip, { backgroundColor: colors.errorLight }]}>
                <Ionicons name="close" size={13} color={colors.error} />
                <Text style={[styles.addedChipText, { color: colors.error }]}>{item}</Text>
                <TouchableOpacity onPress={() => removeExclusion(idx)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                  <Ionicons name="close" size={13} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.addRow}>
          <RNTextInput
            value={newExclusion}
            onChangeText={setNewExclusion}
            onSubmitEditing={() => addExclusion(newExclusion)}
            placeholder="Add custom exclusion..."
            placeholderTextColor={themeColors.textTertiary}
            style={[...inputStyle, styles.addInput]}
            returnKeyType="done"
          />
          <Button title="Add" onPress={() => addExclusion(newExclusion)} size="md" disabled={!newExclusion.trim()} />
        </View>
      </Card>

      {/* ═══ Cancellation Policy ═══ */}
      <Card style={styles.section}>
        <SectionHeader title="Cancellation Policy" icon="shield-outline" subtitle="How refunds work for this package" />

        <View style={styles.policyGrid}>
          {CANCELLATION_TYPES.map((ct) => {
            const active = values.cancellationPolicy?.type === ct.value;
            return (
              <TouchableOpacity
                key={ct.value}
                style={[
                  styles.policyCard,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                  active && styles.policyCardActive,
                ]}
                onPress={() => setCancellationType(ct.value)}
                activeOpacity={0.7}
              >
                {active && (
                  <View style={styles.policyCheck}>
                    <Ionicons name="checkmark" size={12} color="#ffffff" />
                  </View>
                )}
                <Text style={styles.policyEmoji}>{ct.emoji}</Text>
                <Text style={[styles.policyLabel, { color: themeColors.text }]}>{ct.label}</Text>
                <Text style={[styles.policyDesc, { color: themeColors.textTertiary }]}>{ct.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom refund rules */}
        <View style={[styles.rulesBox, { backgroundColor: themeColors.inputBackground }]}>
          <Text style={[styles.rulesTitle, { color: themeColors.textSecondary }]}>CUSTOM REFUND RULES</Text>
          {rules.map((rule, idx) => (
            <View key={idx} style={styles.ruleRow}>
              <RNTextInput
                value={String(rule.daysBeforeTravel)}
                onChangeText={(t) => updateRule(idx, 'daysBeforeTravel', Number(t.replace(/[^0-9]/g, '')) || 0)}
                keyboardType="numeric"
                style={[...inputStyle, styles.ruleInput]}
                placeholderTextColor={themeColors.textTertiary}
              />
              <Text style={[styles.ruleText, { color: themeColors.textTertiary }]}>+ days =</Text>
              <RNTextInput
                value={String(rule.refundPercent)}
                onChangeText={(t) =>
                  updateRule(idx, 'refundPercent', Math.min(100, Number(t.replace(/[^0-9]/g, '')) || 0))
                }
                keyboardType="numeric"
                style={[...inputStyle, styles.ruleInput]}
                placeholderTextColor={themeColors.textTertiary}
              />
              <Text style={[styles.ruleText, { color: themeColors.textTertiary }]}>% refund</Text>
              <TouchableOpacity onPress={() => removeRule(idx)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <Ionicons name="close" size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addRuleBtn} onPress={addRule} activeOpacity={0.7}>
            <Ionicons name="add" size={14} color={colors.primary[500]} />
            <Text style={styles.addRuleText}>Add refund rule</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* ═══ Vendor Story ═══ */}
      <Card style={styles.section}>
        <SectionHeader
          title="Your Story"
          icon="star-outline"
          iconColor={colors.warning}
          subtitle="Help customers connect with you — builds trust and increases bookings."
        />

        <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Headline</Text>
        <RNTextInput
          value={story.headline}
          onChangeText={(t) => updateStory({ headline: t })}
          maxLength={200}
          placeholder='e.g., "20 Years of Crafting Unforgettable Taiwan Experiences"'
          placeholderTextColor={themeColors.textTertiary}
          style={inputStyle}
        />

        <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Narrative</Text>
        <RNTextInput
          value={story.narrative}
          onChangeText={(t) => updateStory({ narrative: t })}
          maxLength={2000}
          placeholder="Your expertise, local connections, what makes your service stand out..."
          placeholderTextColor={themeColors.textTertiary}
          style={[...inputStyle, styles.multiline]}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Local Insider Tips (one per line)</Text>
        <RNTextInput
          value={(story.localInsights || []).join('\n')}
          onChangeText={(t) => updateStory({ localInsights: t.split('\n').filter((s) => s.trim()) })}
          placeholder={
            'Best time to visit Jiufen: early morning before crowds\nTry bubble tea at the original shop in Tainan\nCarry a rain jacket — mountain weather is unpredictable'
          }
          placeholderTextColor={themeColors.textTertiary}
          style={[...inputStyle, styles.multiline]}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </Card>

      {/* ═══ SEO ═══ */}
      <Card style={styles.section}>
        <SectionHeader
          title="SEO"
          icon="search-outline"
          subtitle="Helps this package rank on Google"
          right={
            <TouchableOpacity style={styles.autoBtn} onPress={autoFillSEO} activeOpacity={0.7}>
              <Ionicons name="sparkles-outline" size={13} color={colors.primary[500]} />
              <Text style={styles.autoBtnText}>Auto-generate</Text>
            </TouchableOpacity>
          }
        />

        <View style={styles.labelRow}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Meta Title</Text>
          <Text style={[styles.counter, { color: seo.metaTitle.length > 60 ? colors.primary[500] : themeColors.textTertiary }]}>
            {seo.metaTitle.length}/70
          </Text>
        </View>
        <RNTextInput
          value={seo.metaTitle}
          onChangeText={(t) => updateSeo({ metaTitle: t })}
          maxLength={70}
          placeholder="SEO Title — what shows in Google search results"
          placeholderTextColor={themeColors.textTertiary}
          style={inputStyle}
        />

        <View style={styles.labelRow}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Meta Description</Text>
          <Text
            style={[
              styles.counter,
              { color: seo.metaDescription.length > 150 ? colors.primary[500] : themeColors.textTertiary },
            ]}
          >
            {seo.metaDescription.length}/160
          </Text>
        </View>
        <RNTextInput
          value={seo.metaDescription}
          onChangeText={(t) => updateSeo({ metaDescription: t })}
          maxLength={160}
          placeholder="SEO Description — the snippet below your title on Google"
          placeholderTextColor={themeColors.textTertiary}
          style={[...inputStyle, styles.multiline]}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Keywords (comma-separated)</Text>
        <RNTextInput
          value={(seo.keywords || []).join(', ')}
          onChangeText={(t) => updateSeo({ keywords: t.split(',').map((k) => k.trim()).filter(Boolean) })}
          placeholder="goa, beach holiday, 3n 4d package"
          placeholderTextColor={themeColors.textTertiary}
          style={inputStyle}
          autoCapitalize="none"
        />
      </Card>

      {/* ═══ Images ═══ */}
      <Card style={styles.section}>
        <SectionHeader
          title="Package Images"
          icon="images-outline"
          subtitle="First image is the cover · JPG/PNG"
          right={<Badge label={`${imageCount}/${MAX_IMAGES}`} variant={imageCount > 0 ? 'primary' : 'default'} />}
        />

        {imageCount > 0 && (
          <View style={styles.imageGrid}>
            {images.map((img, idx) => (
              <View key={`${idx}-${img.url.slice(0, 24)}`} style={styles.imageTile}>
                <View
                  style={[
                    styles.imageThumbWrap,
                    { borderColor: img.isPrimary ? colors.primary[500] : themeColors.border },
                  ]}
                >
                  <Image source={{ uri: img.url }} style={styles.imageThumb} resizeMode="cover" />

                  {img.isPrimary && (
                    <View style={styles.coverBadge}>
                      <Ionicons name="star" size={9} color="#ffffff" />
                      <Text style={styles.coverBadgeText}>Cover</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => removeImage(idx)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close" size={14} color="#ffffff" />
                  </TouchableOpacity>

                  {!img.isPrimary && (
                    <TouchableOpacity
                      style={styles.setCoverBtn}
                      onPress={() => setPrimaryImage(idx)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="star-outline" size={11} color="#ffffff" />
                      <Text style={styles.setCoverText}>Set as cover</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <RNTextInput
                  value={img.caption}
                  onChangeText={(t) => updateCaption(idx, t)}
                  placeholder="Add caption..."
                  placeholderTextColor={themeColors.textTertiary}
                  style={[
                    styles.captionInput,
                    { backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder, color: themeColors.text },
                  ]}
                />
              </View>
            ))}
          </View>
        )}

        {imageCount < MAX_IMAGES ? (
          <TouchableOpacity
            style={[styles.addImageBtn, { borderColor: colors.primary[300] }]}
            onPress={pickImages}
            activeOpacity={0.8}
          >
            <Ionicons name="cloud-upload-outline" size={26} color={colors.primary[500]} />
            <Text style={styles.addImageText}>
              {imageCount === 0 ? 'Tap to add photos' : 'Add more'}
            </Text>
            <Text style={[styles.addImageSub, { color: themeColors.textTertiary }]}>
              {MAX_IMAGES - imageCount} remaining
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.limitBanner, { backgroundColor: themeColors.inputBackground }]}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
            <Text style={[styles.limitBannerText, { color: themeColors.textSecondary }]}>
              Maximum {MAX_IMAGES} images reached
            </Text>
          </View>
        )}

        {/* Add via URL (replaces the web prompt()) */}
        <View style={styles.addRow}>
          <RNTextInput
            value={imageUrlInput}
            onChangeText={setImageUrlInput}
            onSubmitEditing={addImageUrl}
            placeholder="Or paste an image URL..."
            placeholderTextColor={themeColors.textTertiary}
            style={[...inputStyle, styles.addInput]}
            autoCapitalize="none"
            keyboardType="url"
            autoCorrect={false}
            returnKeyType="done"
          />
          <Button
            title="Add"
            onPress={addImageUrl}
            size="md"
            variant="outline"
            disabled={!imageUrlInput.trim() || imageCount >= MAX_IMAGES}
          />
        </View>
      </Card>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  section: { gap: spacing.md },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  sectionSubtitle: { fontSize: fontSize.xs, marginTop: 2 },

  // Inputs
  input: {
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    minHeight: 44,
  },
  multiline: { minHeight: 90, paddingTop: spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addInput: { flex: 1 },

  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: -2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { fontSize: fontSize.xs },

  // Chips
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  suggestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  suggestChipText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  addedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  addedChipText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  // Cancellation policy
  policyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  policyCard: {
    width: '48%',
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: 2,
  },
  policyCardActive: { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
  policyCheck: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyEmoji: { fontSize: 18 },
  policyLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  policyDesc: { fontSize: 11, lineHeight: 15 },

  rulesBox: { borderRadius: borderRadius.md, padding: spacing.md, gap: spacing.sm },
  rulesTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.6 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  ruleInput: { width: 64, minHeight: 38, textAlign: 'center', paddingVertical: spacing.xs },
  ruleText: { fontSize: fontSize.xs },
  addRuleBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' },
  addRuleText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.primary[500] },

  // SEO auto button
  autoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  autoBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.primary[500] },

  // Images
  imageGrid: { gap: spacing.md },
  imageTile: { width: '100%' },
  imageThumbWrap: {
    position: 'relative',
    aspectRatio: 4 / 3,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#00000010',
  },
  imageThumb: { width: '100%', height: '100%' },
  coverBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  coverBadgeText: { fontSize: 9, fontWeight: fontWeight.bold, color: '#ffffff' },
  removeImageBtn: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setCoverBtn: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(37,99,235,0.95)',
    paddingVertical: 5,
  },
  setCoverText: { fontSize: 11, fontWeight: fontWeight.semibold, color: '#ffffff' },
  captionInput: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 11,
    minHeight: 34,
  },

  addImageBtn: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addImageText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary[500] },
  addImageSub: { fontSize: fontSize.xs },

  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  limitBannerText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
});
