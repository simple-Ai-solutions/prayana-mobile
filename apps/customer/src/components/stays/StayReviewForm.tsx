// StayReviewForm — "How was your stay?" on a completed booking: overall
// stars, optional aspect scores, who you travelled with, a title, the
// review, and up to five photos. Posts through staysAPI.submitReview (JSON,
// or multipart when there are photos).
//
// The server allows one review per booking and only once the stay is
// completed; a 409 means it's already in, so the screen just refreshes.
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Button, StarRating, TextInput, useTheme, colors, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { staysAPI } from '@prayana/shared-services';
import { REVIEW_ASPECTS, TRIP_TYPES } from '../../lib/stayLabels';
import { asApiError, errorText, type ReviewAspect } from '../../lib/stays';

const MAX_PHOTOS = 5;
const MAX_PHOTO_MB = 10;
const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
const AMBER = '#F59E0B';

type Photo = { uri: string; name: string; type: string };
type TripType = (typeof TRIP_TYPES)[number]['id'];

export function StayReviewForm({ bookingId, onSubmitted }: { bookingId: string; onSubmitted: () => void }) {
  const { themeColors, brand, isDarkMode } = useTheme();
  const [rating, setRating] = useState(0);
  const [aspects, setAspects] = useState<Partial<Record<ReviewAspect, number>>>({});
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState(false);

  const addPhotos = async () => {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access to your photos to add them to your review.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 0.8,
    });
    if (picked.canceled || !picked.assets?.length) return;
    const tooBig = picked.assets.filter((a) => (a.fileSize ?? 0) > MAX_PHOTO_MB * 1024 * 1024);
    if (tooBig.length) Toast.show({ type: 'error', text1: `${tooBig.length} photo(s) over ${MAX_PHOTO_MB} MB were skipped` });
    const next = picked.assets
      .filter((a) => !tooBig.includes(a))
      .map((a, i) => {
        const type = a.mimeType || 'image/jpeg';
        const sub = type.split('/')[1];
        const ext = sub === 'jpeg' ? 'jpg' : sub || 'jpg';
        return { uri: a.uri, name: a.fileName || `stay-review-${Date.now()}-${i}.${ext}`, type };
      });
    setPhotos((prev) => [...prev, ...next].slice(0, MAX_PHOTOS));
  };

  const submit = async () => {
    if (!rating) {
      setRatingError(true);
      Toast.show({ type: 'error', text1: 'Give the stay 1 to 5 stars' });
      return;
    }
    setSubmitting(true);
    try {
      const review = {
        rating,
        aspects,
        tripType: tripType || undefined,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      };
      const res = await staysAPI.submitReview(bookingId, review, photos);
      Toast.show({ type: 'success', text1: res?.message || 'Thanks for your review!' });
      onSubmitted();
    } catch (e) {
      if (asApiError(e).status === 409) {
        Toast.show({ type: 'info', text1: "You've already reviewed this stay" });
        onSubmitted();
      } else {
        Toast.show({ type: 'error', text1: "Couldn't post your review", text2: errorText(e, 'Please try again.') });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const chipBg = isDarkMode ? 'rgba(249,115,22,0.18)' : brand[50];

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.center}>
        <StarRating
          rating={rating}
          size={34}
          interactive
          color={AMBER}
          onRatingChange={(n) => {
            setRating(n);
            setRatingError(false);
          }}
        />
        <Text style={[styles.ratingWord, { color: ratingError ? colors.error : themeColors.textSecondary }]}>
          {rating ? RATING_WORDS[rating] : ratingError ? 'Tap a star to rate your stay' : 'Tap to rate'}
        </Text>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={[styles.label, { color: themeColors.text }]}>Rate the details (optional)</Text>
        {REVIEW_ASPECTS.map((a) => (
          <View key={a.id} style={styles.aspectRow}>
            <Text style={[styles.aspectLabel, { color: themeColors.textSecondary }]}>{a.label}</Text>
            <StarRating
              rating={aspects[a.id] || 0}
              size={20}
              interactive
              color={AMBER}
              onRatingChange={(n) => setAspects((prev) => ({ ...prev, [a.id]: prev[a.id] === n ? undefined : n }))}
            />
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={[styles.label, { color: themeColors.text }]}>Who did you travel with?</Text>
        <View style={styles.chips}>
          {TRIP_TYPES.map((t) => {
            const on = tripType === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setTripType(on ? null : t.id)}
                style={[styles.chip, { borderColor: on ? brand[500] : themeColors.border }, on && { backgroundColor: chipBg }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Ionicons name={t.icon} size={14} color={on ? brand[600] : themeColors.textSecondary} />
                <Text style={[styles.chipText, { color: on ? brand[600] : themeColors.text }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TextInput label="Title (optional)" value={title} onChangeText={setTitle} placeholder="Sum up your stay" maxLength={100} />
      <View>
        <TextInput
          label="Your review (optional)"
          value={body}
          onChangeText={setBody}
          placeholder="What did you like? What could be better? Tips for other guests…"
          multiline
          numberOfLines={5}
          maxLength={2000}
          style={styles.textarea}
        />
        <Text style={[styles.counter, { color: themeColors.textTertiary }]}>{body.length}/2000</Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={[styles.label, { color: themeColors.text }]}>
          Photos (optional, up to {MAX_PHOTOS})
        </Text>
        <View style={styles.photos}>
          {photos.map((p, i) => (
            <View key={`${p.uri}-${i}`}>
              <Image source={{ uri: p.uri }} style={styles.photo} contentFit="cover" />
              <TouchableOpacity
                onPress={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                style={styles.photoRemove}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${i + 1}`}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <TouchableOpacity
              onPress={addPhotos}
              style={[styles.addPhoto, { borderColor: themeColors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Add photos"
            >
              <Ionicons name="camera-outline" size={22} color={themeColors.textSecondary} />
              <Text style={[styles.addPhotoText, { color: themeColors.textSecondary }]}>Add</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <Button title="Post review" onPress={submit} size="lg" fullWidth loading={submitting} disabled={submitting} />
      <Text style={[styles.note, { color: themeColors.textTertiary }]}>
        Your first name and review appear on the property's page. The property can reply.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 6 },
  ratingWord: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  aspectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 2 },
  aspectLabel: { flex: 1, fontSize: fontSize.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  counter: { fontSize: 10, textAlign: 'right', marginTop: -spacing.sm },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: { width: 72, height: 72, borderRadius: borderRadius.md },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addPhotoText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  note: { fontSize: fontSize.xs, textAlign: 'center' },
});
